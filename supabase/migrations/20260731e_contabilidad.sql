-- ============================================================
-- Módulo CONTABLE base (partida doble simple)
-- Si ya tenías tablas contables con otro nombre, avísame y
-- migramos/renombramos en vez de duplicar.
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'asiento_origen') then
    create type asiento_origen as enum ('planilla', 'manual', 'ventas', 'compras', 'ajuste');
  end if;
end $$;

-- Catálogo de cuentas mínimo (puedes ampliarlo luego)
create table if not exists cuentas_contables (
  id uuid primary key default gen_random_uuid(),
  codigo text unique not null,
  nombre text not null,
  tipo text not null,           -- activo | pasivo | patrimonio | ingreso | gasto
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

-- Cuentas base que usa el módulo de planilla; ajusta códigos/nombres
-- a tu propio catálogo si ya tienes uno.
insert into cuentas_contables (codigo, nombre, tipo)
values
  ('5100', 'Gasto de planilla', 'gasto'),
  ('1100', 'Banco', 'activo'),
  ('2100', 'Deducciones por pagar (CSS / Seguro Educativo)', 'pasivo'),
  ('2110', 'Décimo tercer mes por pagar', 'pasivo')
on conflict (codigo) do nothing;

-- Cabecera del asiento
create table if not exists asientos_contables (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  descripcion text,
  origen asiento_origen not null default 'manual',
  referencia_id uuid,             -- ej. planilla_periodos.id cuando origen = 'planilla'
  creado_por uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_asientos_origen on asientos_contables(origen);
create index if not exists idx_asientos_referencia on asientos_contables(referencia_id);

-- Líneas del asiento (debe = haber en total, por convención de negocio;
-- no se fuerza con constraint aquí para no bloquear inserciones parciales,
-- pero puedes agregar una validación a nivel de función si quieres ser estricto)
create table if not exists asiento_lineas (
  id uuid primary key default gen_random_uuid(),
  asiento_id uuid not null references asientos_contables(id) on delete cascade,
  cuenta_codigo text not null references cuentas_contables(codigo),
  debito numeric(14,2) not null default 0,
  credito numeric(14,2) not null default 0,
  descripcion text,
  created_at timestamptz not null default now()
);

create index if not exists idx_asiento_lineas_asiento on asiento_lineas(asiento_id);
create index if not exists idx_asiento_lineas_cuenta on asiento_lineas(cuenta_codigo);

-- RLS básica (ajusta a tu esquema de roles real, igual que en planilla)
alter table cuentas_contables enable row level security;
alter table asientos_contables enable row level security;
alter table asiento_lineas enable row level security;

drop policy if exists cuentas_contables_auth on cuentas_contables;
create policy cuentas_contables_auth on cuentas_contables
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists asientos_contables_auth on asientos_contables;
create policy asientos_contables_auth on asientos_contables
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists asiento_lineas_auth on asiento_lineas;
create policy asiento_lineas_auth on asiento_lineas
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ------------------------------------------------------------
-- Reemplaza planilla_generar_asiento con la versión real,
-- ya conectada a estas tablas.
-- ------------------------------------------------------------
create or replace function planilla_generar_asiento(p_periodo_id uuid)
returns uuid as $$
declare
  p record;
  nuevo_asiento_id uuid;
  total_decimo numeric(14,2);
begin
  select * into p from planilla_periodos where id = p_periodo_id;
  if not found then
    raise exception 'periodo % no existe', p_periodo_id;
  end if;

  if p.asiento_contable_id is not null then
    return p.asiento_contable_id;
  end if;

  insert into asientos_contables (fecha, descripcion, origen, referencia_id)
  values (
    p.fecha_fin,
    'Planilla ' || p.modo || ' ' || p.fecha_inicio || ' a ' || p.fecha_fin,
    'planilla',
    p.id
  )
  returning id into nuevo_asiento_id;

  -- décimo provisión (solo aplica panama; suma desde el detalle)
  select coalesce(sum((deducciones->>'decimo_provision_referencial')::numeric), 0)
  into total_decimo
  from planilla_detalle
  where periodo_id = p_periodo_id;

  -- Debe: gasto de planilla por el bruto
  insert into asiento_lineas (asiento_id, cuenta_codigo, debito, credito, descripcion)
  values (nuevo_asiento_id, '5100', p.total_bruto, 0, 'Gasto de planilla bruto');

  -- Haber: banco por el neto pagado
  insert into asiento_lineas (asiento_id, cuenta_codigo, debito, credito, descripcion)
  values (nuevo_asiento_id, '1100', 0, p.total_neto, 'Pago neto a empleados');

  -- Haber: deducciones por pagar (CSS + seguro educativo) si hay
  if p.total_deducciones > 0 then
    insert into asiento_lineas (asiento_id, cuenta_codigo, debito, credito, descripcion)
    values (nuevo_asiento_id, '2100', 0, p.total_deducciones, 'CSS + Seguro Educativo por pagar');
  end if;

  -- Haber: décimo provisión, si aplica
  if total_decimo > 0 then
    insert into asiento_lineas (asiento_id, cuenta_codigo, debito, credito, descripcion)
    values (nuevo_asiento_id, '2110', 0, total_decimo, 'Provisión décimo tercer mes');
  end if;

  update planilla_periodos
  set asiento_contable_id = nuevo_asiento_id
  where id = p_periodo_id;

  return nuevo_asiento_id;
end;
$$ language plpgsql;
