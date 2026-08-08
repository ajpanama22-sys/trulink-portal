-- ============================================================
-- LICITACIONES PRIVADAS (RFQ) — COMPRA DIRECTA COMPETITIVA
-- ============================================================
-- Correr DESPUÉS de 001_proveedores_convenio_marco.sql
-- Alcance: solo crea tablas nuevas (rfq_licitaciones, rfq_invitados,
-- rfq_ofertas) y activa RLS únicamente sobre esas 3. No toca ninguna
-- tabla existente del sistema.

create table if not exists rfq_licitaciones (
  id bigint generated always as identity primary key,
  titulo text not null,
  descripcion text,
  categoria_insumo text not null,             -- a quién se invita (match con tipo_insumo)
  materia_prima_id bigint references materia_prima(id),
  tabla_bodega text,
  sku_bodega text,
  unidad text,
  cantidad numeric not null default 0,
  especificaciones_tecnicas text,
  fecha_limite_ofertas timestamptz not null,
  peso_precio numeric not null default 50,     -- % del score
  peso_calidad numeric not null default 30,    -- % del score (usa proveedores.calificacion)
  peso_lead_time numeric not null default 20,  -- % del score
  estado text not null default 'Abierta',      -- Abierta | Cerrada | Adjudicada | Cancelada
  rfq_ganador_proveedor_id uuid references proveedores(id),
  orden_compra_id bigint references ordenes_compra(id),
  creado_por text,
  created_at timestamptz not null default now()
);

create table if not exists rfq_invitados (
  id bigint generated always as identity primary key,
  rfq_id bigint not null references rfq_licitaciones(id) on delete cascade,
  proveedor_id uuid not null references proveedores(id),
  invitado_en timestamptz not null default now(),
  unique (rfq_id, proveedor_id)
);

create table if not exists rfq_ofertas (
  id bigint generated always as identity primary key,
  rfq_id bigint not null references rfq_licitaciones(id) on delete cascade,
  proveedor_id uuid not null references proveedores(id),
  precio_unitario numeric not null,
  moneda text not null default 'USD',
  incoterm text,
  dias_credito_propuesto int default 0,
  lead_time_dias int not null,
  notas text,
  enviada_en timestamptz not null default now(),
  unique (rfq_id, proveedor_id)                -- una oferta por proveedor (se actualiza, no se duplica)
);

create index if not exists idx_rfq_invitados_rfq on rfq_invitados(rfq_id);
create index if not exists idx_rfq_invitados_prov on rfq_invitados(proveedor_id);
create index if not exists idx_rfq_ofertas_rfq on rfq_ofertas(rfq_id);
create index if not exists idx_rfq_licitaciones_estado on rfq_licitaciones(estado);

-- ── RLS: blind bidding real — cada proveedor solo ve SU propia oferta,
-- nunca las de sus competidores, ni antes ni después del cierre. ──
alter table rfq_licitaciones enable row level security;
alter table rfq_invitados enable row level security;
alter table rfq_ofertas enable row level security;

drop policy if exists vendor_ve_rfq_invitado on rfq_licitaciones;
create policy vendor_ve_rfq_invitado on rfq_licitaciones
  for select using (
    id in (
      select rfq_id from rfq_invitados
      where proveedor_id in (select id from proveedores where auth_user_id = auth.uid())
    )
  );

drop policy if exists vendor_ve_su_invitacion on rfq_invitados;
create policy vendor_ve_su_invitacion on rfq_invitados
  for select using (
    proveedor_id in (select id from proveedores where auth_user_id = auth.uid())
  );

drop policy if exists vendor_ve_su_oferta on rfq_ofertas;
create policy vendor_ve_su_oferta on rfq_ofertas
  for select using (
    proveedor_id in (select id from proveedores where auth_user_id = auth.uid())
  );

drop policy if exists vendor_inserta_su_oferta on rfq_ofertas;
create policy vendor_inserta_su_oferta on rfq_ofertas
  for insert with check (
    proveedor_id in (select id from proveedores where auth_user_id = auth.uid())
    and exists (
      select 1 from rfq_licitaciones r
      where r.id = rfq_id and r.estado = 'Abierta' and r.fecha_limite_ofertas > now()
    )
  );

drop policy if exists vendor_actualiza_su_oferta on rfq_ofertas;
create policy vendor_actualiza_su_oferta on rfq_ofertas
  for update using (
    proveedor_id in (select id from proveedores where auth_user_id = auth.uid())
    and exists (
      select 1 from rfq_licitaciones r
      where r.id = rfq_id and r.estado = 'Abierta' and r.fecha_limite_ofertas > now()
    )
  );

-- ── Acceso del staff interno (colaboradores) ──
-- El admin necesita crear licitaciones, invitar proveedores, cerrarlas,
-- ver TODAS las ofertas para evaluar (rompiendo el blind bidding solo para
-- el staff autorizado, que es lo esperado) y marcar la adjudicación.
-- Mismo mecanismo confirmado en 001: tabla `colaboradores`, email + rol + activo.
drop policy if exists staff_acceso_total on rfq_licitaciones;
create policy staff_acceso_total on rfq_licitaciones for all using (
  exists (
    select 1 from colaboradores c
    where c.email = auth.email()
      and c.rol in ('Super Administrador', 'Administrador')
      and c.activo = true
  )
) with check (
  exists (
    select 1 from colaboradores c
    where c.email = auth.email()
      and c.rol in ('Super Administrador', 'Administrador')
      and c.activo = true
  )
);

drop policy if exists staff_acceso_total on rfq_invitados;
create policy staff_acceso_total on rfq_invitados for all using (
  exists (
    select 1 from colaboradores c
    where c.email = auth.email()
      and c.rol in ('Super Administrador', 'Administrador')
      and c.activo = true
  )
) with check (
  exists (
    select 1 from colaboradores c
    where c.email = auth.email()
      and c.rol in ('Super Administrador', 'Administrador')
      and c.activo = true
  )
);

drop policy if exists staff_acceso_total on rfq_ofertas;
create policy staff_acceso_total on rfq_ofertas for all using (
  exists (
    select 1 from colaboradores c
    where c.email = auth.email()
      and c.rol in ('Super Administrador', 'Administrador')
      and c.activo = true
  )
) with check (
  exists (
    select 1 from colaboradores c
    where c.email = auth.email()
      and c.rol in ('Super Administrador', 'Administrador')
      and c.activo = true
  )
);
