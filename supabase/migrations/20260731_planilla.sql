-- ============================================================
-- Módulo PLANILLA DUAL (Panamá / Corporación Americana)
-- Independiente del módulo contable. Solo se comunica con
-- contabilidad a través de un asiento generado al aprobar
-- un periodo (ver planilla_periodos.asiento_contable_id).
-- ============================================================

-- Tipo de modo de operación
do $$
begin
  if not exists (select 1 from pg_type where typname = 'planilla_modo') then
    create type planilla_modo as enum ('panama', 'us_corp');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'planilla_estado_periodo') then
    create type planilla_estado_periodo as enum ('borrador', 'aprobado', 'pagado', 'anulado');
  end if;
end $$;

-- ------------------------------------------------------------
-- Empleados
-- ------------------------------------------------------------
create table if not exists planilla_empleados (
  id uuid primary key default gen_random_uuid(),
  modo planilla_modo not null,
  nombre text not null,
  identificacion text not null,            -- cédula (PA) o SSN/ITIN (US), según modo
  puesto text,
  email text,
  salario_base numeric(14,2) not null default 0,
  moneda text not null default 'USD',
  fecha_ingreso date not null default current_date,
  activo boolean not null default true,
  -- datos bancarios para dispersión
  banco text,
  cuenta_bancaria text,
  tipo_cuenta text,
  -- solo aplica modo panama
  numero_css text,
  -- solo aplica modo us_corp
  estado_us text,               -- estado de EE.UU. de referencia para nómina, si aplica
  clasificacion_us text,        -- 'w2' | '1099' | null
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_planilla_empleados_modo on planilla_empleados(modo);
create index if not exists idx_planilla_empleados_activo on planilla_empleados(activo);

-- ------------------------------------------------------------
-- Periodos de planilla (una corrida quincenal/mensual)
-- ------------------------------------------------------------
create table if not exists planilla_periodos (
  id uuid primary key default gen_random_uuid(),
  modo planilla_modo not null,
  fecha_inicio date not null,
  fecha_fin date not null,
  estado planilla_estado_periodo not null default 'borrador',
  total_bruto numeric(14,2) not null default 0,
  total_deducciones numeric(14,2) not null default 0,
  total_neto numeric(14,2) not null default 0,
  aprobado_por uuid references auth.users(id),
  aprobado_at timestamptz,
  -- puente hacia contabilidad: se llena solo cuando se aprueba
  asiento_contable_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_planilla_periodos_modo on planilla_periodos(modo);
create index if not exists idx_planilla_periodos_estado on planilla_periodos(estado);

-- ------------------------------------------------------------
-- Detalle por empleado dentro de un periodo
-- ------------------------------------------------------------
create table if not exists planilla_detalle (
  id uuid primary key default gen_random_uuid(),
  periodo_id uuid not null references planilla_periodos(id) on delete cascade,
  empleado_id uuid not null references planilla_empleados(id),
  salario_base numeric(14,2) not null default 0,
  horas_extra numeric(10,2) not null default 0,
  monto_horas_extra numeric(14,2) not null default 0,
  bonos numeric(14,2) not null default 0,
  -- deducciones flexibles por modo, ej:
  -- panama: {"css": 123.45, "seguro_educativo": 12.30, "decimo_provision": 45.00}
  -- us_corp: {"federal": 0, "state": 0, "otros": 0}
  deducciones jsonb not null default '{}'::jsonb,
  total_deducciones numeric(14,2) not null default 0,
  neto numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (periodo_id, empleado_id)
);

create index if not exists idx_planilla_detalle_periodo on planilla_detalle(periodo_id);
create index if not exists idx_planilla_detalle_empleado on planilla_detalle(empleado_id);

-- ------------------------------------------------------------
-- Comprobantes de pago (recibos)
-- ------------------------------------------------------------
create table if not exists planilla_comprobantes (
  id uuid primary key default gen_random_uuid(),
  detalle_id uuid not null references planilla_detalle(id) on delete cascade,
  url_pdf text,
  generado_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Dispersión bancaria (corrida de pago)
-- ------------------------------------------------------------
create table if not exists planilla_dispersion (
  id uuid primary key default gen_random_uuid(),
  periodo_id uuid not null references planilla_periodos(id) on delete cascade,
  banco text,
  referencia text,
  monto_total numeric(14,2) not null default 0,
  estado text not null default 'pendiente',  -- pendiente | enviado | confirmado | error
  archivo_lote text,                          -- ruta/url del archivo ACH o similar
  ejecutado_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_planilla_dispersion_periodo on planilla_dispersion(periodo_id);

-- ------------------------------------------------------------
-- Trigger genérico para updated_at
-- ------------------------------------------------------------
create or replace function planilla_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_planilla_empleados_updated on planilla_empleados;
create trigger trg_planilla_empleados_updated
  before update on planilla_empleados
  for each row execute function planilla_set_updated_at();

drop trigger if exists trg_planilla_periodos_updated on planilla_periodos;
create trigger trg_planilla_periodos_updated
  before update on planilla_periodos
  for each row execute function planilla_set_updated_at();

-- ------------------------------------------------------------
-- RLS
-- NOTA: ajusta estas políticas al mismo patrón de roles que ya
-- usas en tus otros módulos (por ejemplo si tienes una tabla
-- `perfiles` con columna `rol`). Aquí dejo una base que solo
-- permite acceso a usuarios autenticados; restringe según
-- tu esquema real de roles (RRHH/admin) antes de ir a producción,
-- porque estos datos incluyen salarios e identificación personal.
-- ------------------------------------------------------------
alter table planilla_empleados enable row level security;
alter table planilla_periodos enable row level security;
alter table planilla_detalle enable row level security;
alter table planilla_comprobantes enable row level security;
alter table planilla_dispersion enable row level security;

drop policy if exists planilla_empleados_auth on planilla_empleados;
create policy planilla_empleados_auth on planilla_empleados
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists planilla_periodos_auth on planilla_periodos;
create policy planilla_periodos_auth on planilla_periodos
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists planilla_detalle_auth on planilla_detalle;
create policy planilla_detalle_auth on planilla_detalle
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists planilla_comprobantes_auth on planilla_comprobantes;
create policy planilla_comprobantes_auth on planilla_comprobantes
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists planilla_dispersion_auth on planilla_dispersion;
create policy planilla_dispersion_auth on planilla_dispersion
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
