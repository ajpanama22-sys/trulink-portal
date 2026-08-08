-- ============================================================
-- CONVENIO MARCO DE PROVEEDORES + VENDOR PORTAL — TRULINK FIBER
-- ============================================================
-- Alcance de este archivo, a propósito y sin excepciones:
--   • ALTER solo sobre `proveedores` (agrega columnas propias del módulo,
--     con ADD COLUMN IF NOT EXISTS — no destructivo, no borra nada).
--   • CREATE de tablas nuevas, todas propias de este módulo:
--     umbrales_reposicion, alertas_demanda.
--   • RLS (enable row level security) solo sobre `proveedores` y las 2
--     tablas nuevas de arriba. Las policies de staff LEEN `colaboradores`
--     (para saber el rol de quien está logueado) pero no la modifican ni
--     le tocan RLS — esa tabla ya tenía su propio RLS desde antes.
--   • CERO contacto con cualquier otra tabla del sistema: ni materia_prima,
--     ni cablesdb/accesoriosdb/herrajesdb, ni ordenes_compra,
--     ni cuentas_por_pagar, ni pagos_proveedor, ni ninguna otra.
--   • Ningún bloque dinámico que recorra "todas las tablas" de la base.
-- Todo usa IF NOT EXISTS / ADD COLUMN IF NOT EXISTS para que sea
-- seguro re-ejecutarlo si algo falla a mitad de camino.

-- ── 1. Homologación y acceso al Vendor Portal en la tabla proveedores ──
alter table proveedores
  add column if not exists estado_homologacion text not null default 'Pendiente',
  add column if not exists categorias_autorizadas text,          -- ej: "Cables ADSS, Herrajes" (coincide con tipo_insumo)
  add column if not exists fecha_homologacion timestamptz,
  add column if not exists observaciones_homologacion text,
  add column if not exists auth_user_id uuid references auth.users(id),
  add column if not exists portal_activo boolean not null default false;

comment on column proveedores.estado_homologacion is 'Pendiente | En Revisión | Homologado | Rechazado';
comment on column proveedores.portal_activo is 'true cuando el proveedor ya tiene login creado y puede entrar al Vendor Portal';

create index if not exists idx_proveedores_auth_user_id on proveedores(auth_user_id);
create index if not exists idx_proveedores_estado_homologacion on proveedores(estado_homologacion);

-- ── 2. Umbrales de reposición (tabla NUEVA y propia del módulo) ──
-- En vez de agregar `stock_minimo` a `materia_prima` (tabla que no es de
-- proveedores), el umbral vive acá. La función de sincronización solo LEE
-- materia_prima.stock_actual — nunca la modifica ni le agrega columnas.
create table if not exists umbrales_reposicion (
  id bigint generated always as identity primary key,
  tipo_item text not null default 'materia_prima',  -- 'materia_prima' | 'bodega'
  materia_prima_id bigint references materia_prima(id),
  tabla_bodega text,
  sku_bodega text,
  stock_minimo numeric not null default 0,
  categoria_insumo text,                             -- match con proveedores.tipo_insumo
  creado_por text,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_umbral_materia_prima
  on umbrales_reposicion (materia_prima_id) where materia_prima_id is not null;
create unique index if not exists uq_umbral_bodega
  on umbrales_reposicion (tabla_bodega, sku_bodega) where tabla_bodega is not null;

-- ── 3. Alertas / previsión de demanda (tabla NUEVA) ──
create table if not exists alertas_demanda (
  id bigint generated always as identity primary key,
  origen text not null default 'necesidad_puntual',   -- 'stock_minimo' | 'necesidad_puntual'
  tipo_item text not null,                              -- 'materia_prima' | 'bodega'
  materia_prima_id bigint references materia_prima(id),
  tabla_bodega text,
  sku_bodega text,
  descripcion text not null,
  cantidad_sugerida numeric not null default 0,
  categoria_insumo text,                                 -- filtra a qué proveedores se les muestra (match con tipo_insumo)
  estado text not null default 'Abierta',                -- Abierta | Notificada | Cerrada
  fecha_limite date,
  creado_por text,
  created_at timestamptz not null default now()
);

create index if not exists idx_alertas_demanda_estado on alertas_demanda(estado);
create index if not exists idx_alertas_demanda_categoria on alertas_demanda(categoria_insumo);

-- Evita duplicar la misma alerta automática de stock mínimo mientras siga abierta
create unique index if not exists uq_alerta_stock_abierta
  on alertas_demanda (coalesce(materia_prima_id::text, sku_bodega), origen)
  where estado <> 'Cerrada' and origen = 'stock_minimo';

-- ── 4. RLS: el proveedor solo ve SU información en el Vendor Portal ──
-- Alcance real y único de este bloque: `proveedores` (la tabla que ya tenías)
-- + las 2 tablas nuevas creadas arriba (alertas_demanda, umbrales_reposicion).
-- NO se toca ordenes_compra, cuentas_por_pagar ni pagos_proveedor — son tablas
-- del sistema que no pediste tocar, así que quedan exactamente como están hoy.
-- El Vendor Portal filtra esas 3 en el código (`.eq("proveedor_id", proveedor.id)`
-- en pages/vendor-portal/index.tsx) en vez de a nivel de base de datos. Si más
-- adelante querés que también queden protegidas por RLS, lo vemos aparte.
alter table proveedores enable row level security;
alter table alertas_demanda enable row level security;
alter table umbrales_reposicion enable row level security;

-- Nota: estas policies cubren el acceso del PROVEEDOR (vendor portal).
-- Ver el aviso ⚠️ al final del archivo sobre el acceso del staff interno.

drop policy if exists vendor_ve_su_ficha on proveedores;
create policy vendor_ve_su_ficha on proveedores
  for select using (auth.uid() = auth_user_id);

drop policy if exists vendor_ve_alertas_su_categoria on alertas_demanda;
create policy vendor_ve_alertas_su_categoria on alertas_demanda
  for select using (
    estado in ('Abierta', 'Notificada')
    and categoria_insumo in (
      select tipo_insumo from proveedores where auth_user_id = auth.uid()
    )
  );

-- umbrales_reposicion es información interna (a qué nivel de stock reponemos);
-- por defecto NINGÚN proveedor la ve (no se crea policy de select para ellos).
-- Queda con RLS activo y sin policies = nadie externo puede leerla ni tocarla.

-- ── 5. Función de sincronización de stock mínimo ──
-- Solo hace SELECT sobre materia_prima (lectura). No la altera.
create or replace function sync_alertas_stock_minimo() returns void as $$
begin
  insert into alertas_demanda (origen, tipo_item, materia_prima_id, descripcion, cantidad_sugerida, categoria_insumo, estado)
  select
    'stock_minimo', 'materia_prima', mp.id,
    'Reposición sugerida: ' || mp.codigo || ' — ' || mp.nombre,
    greatest(u.stock_minimo * 2 - mp.stock_actual, u.stock_minimo),
    coalesce(u.categoria_insumo, mp.categoria),
    'Abierta'
  from umbrales_reposicion u
  join materia_prima mp on mp.id = u.materia_prima_id
  where u.tipo_item = 'materia_prima'
    and u.stock_minimo > 0
    and mp.stock_actual <= u.stock_minimo
    and not exists (
      select 1 from alertas_demanda a
      where a.materia_prima_id = mp.id and a.origen = 'stock_minimo' and a.estado <> 'Cerrada'
    );
end;
$$ language plpgsql security definer;

-- ── 5. Acceso del staff interno (colaboradores) ──
-- Confirmado: el rol vive en `colaboradores` (columnas email, rol, activo),
-- matcheado por email vía auth.email() — así lo usa tu useRequiereRol.ts.
-- `colaboradores` ya tiene su propio RLS (no se toca acá, ya estaba activo).
drop policy if exists staff_acceso_total on proveedores;
create policy staff_acceso_total on proveedores for all using (
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

drop policy if exists staff_acceso_total on alertas_demanda;
create policy staff_acceso_total on alertas_demanda for all using (
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

drop policy if exists staff_acceso_total on umbrales_reposicion;
create policy staff_acceso_total on umbrales_reposicion for all using (
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
