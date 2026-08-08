-- ============================================================
-- 004 — RFQ POR ITEM UNICO (blind bidding visible a todos los
-- invitados) + RECEPCION CON APROBACION + RECLAMOS PROVEEDOR
-- ============================================================
-- Correr DESPUES de 001, 002 y 003. Convenciones seguidas del repo real:
--   • ids bigint identity en rfq_*, ordenes_compra, orden_compra_items
--   • proveedores.id es uuid
--   • creado_por / revisado_por / capturado_por = text (email), NO fk
--     a colaboradores(id) — así lo hacen 001 y 002.
--   • catalogo_otros calza EXACTO con cablesdb/herrajesdb/accesoriosdb:
--     columnas "SKU","Descripción","Especificaciones","Familia",
--     estado_inventario, image_url, precio_a/b/c/d, "Cantidad" — sin id.
--   • Se reutiliza movimientos_inventario para la bitácora (ya existe),
--     no se crea una tabla de log nueva.
--   • NO se modifica el flujo de RFQ multi-criterio existente (peso_precio/
--     peso_calidad/peso_lead_time). Se agrega `tipo` a rfq_licitaciones
--     para distinguir 'multi_criterio' (el que ya tenías) de 'item_unico'
--     (el nuevo). El código de adjudicación actual sigue funcionando igual.

-- ── 1. rfq_licitaciones: distinguir tipo + campos del item único ──
alter table rfq_licitaciones
  add column if not exists tipo text not null default 'multi_criterio'
    check (tipo in ('multi_criterio','item_unico')),
  add column if not exists descripcion_referencia text,   -- lo que ven TODOS los vendors invitados (blind)
  add column if not exists puerto_destino_definido text
    check (puerto_destino_definido in ('Cristobal','Balboa')), -- si Trulink lo fuerza en vez del vendor
  add column if not exists fecha_publicacion timestamptz not null default now(),
  add column if not exists fecha_cierre timestamptz;       -- = fecha_publicacion + 15 dias, calculado al crear

comment on column rfq_licitaciones.tipo is 'multi_criterio = flujo original (score precio/calidad/lead time). item_unico = RFQ nuevo, un solo item, blind visible entre vendors.';

-- ── 2. rfq_ofertas: campos del formulario de oferta item único ──
-- Nota: la tabla ya tiene UNIQUE(rfq_id, proveedor_id) — una fila por
-- vendor por RFQ, se actualiza in-place. Eso ya resuelve solo "un cambio
-- de precio": simplemente se controla con cambio_precio_realizado.
alter table rfq_ofertas
  add column if not exists sku_vendor text,                -- SKU propio del vendor (no del catálogo Trulink)
  add column if not exists descripcion_item text,
  add column if not exists cantidad numeric,
  add column if not exists total_producto numeric,          -- precio_unitario * cantidad
  add column if not exists costo_envio_cif numeric,
  add column if not exists total_oferta numeric generated always as
    (coalesce(total_producto,0) + coalesce(costo_envio_cif,0)) stored,
  add column if not exists puerto_origen text,
  add column if not exists puerto_destino text check (puerto_destino in ('Cristobal','Balboa')),
  add column if not exists fecha_salida_estimada date,
  add column if not exists fecha_llegada_estimada date,
  add column if not exists pdf_cotizacion_url text,         -- path privado en bucket rfq-adjuntos
  add column if not exists pdf_especificaciones_url text,
  add column if not exists id_unico_vendor text,            -- lo único visible entre vendors (nunca su identidad)
  add column if not exists cambio_precio_realizado boolean not null default false,
  add column if not exists fecha_cambio_precio timestamptz;

create unique index if not exists uq_rfq_ofertas_id_unico on rfq_ofertas(id_unico_vendor) where id_unico_vendor is not null;

comment on column rfq_ofertas.id_unico_vendor is 'Ej: "VDR-4F2A". Visible para todos los vendors invitados al mismo RFQ. Amarrado internamente a proveedor_id, nunca expuesto en el portal.';

-- Regla de "un solo cambio, solo reduciendo, solo días 1-7" se valida en
-- la API route (no en DB) porque necesita comparar contra
-- rfq_licitaciones.fecha_publicacion y el precio anterior. Ejemplo de
-- chequeo en el endpoint de update:
--   if (oferta.cambio_precio_realizado) -> rechazar
--   if (nuevoPrecio >= oferta.precio_unitario) -> rechazar ("solo reducción")
--   if (now() > rfq.fecha_publicacion + interval '7 days') -> rechazar

-- ── 3. Bucket privado rfq-adjuntos (crear desde el dashboard) ──
-- Nombre: rfq-adjuntos | Public: FALSE (a diferencia de "documentos"/
-- "registros" que sí son públicos — acá NO puede serlo por blind bidding).
-- Paths: rfq-adjuntos/{rfq_id}/{proveedor_id}/cotizacion.pdf
--        rfq-adjuntos/{rfq_id}/{proveedor_id}/especificaciones.pdf
-- Acceso: vendor solo su propia carpeta {proveedor_id}; staff todo.
-- Se sirven con createSignedUrl(), nunca getPublicUrl().

-- ── 4. ordenes_compra: origen + trazabilidad al RFQ item único ──
alter table ordenes_compra
  add column if not exists origen text not null default 'manual'
    check (origen in ('rfq','manual')),
  add column if not exists nota_interna_sku text;    -- resumen rápido; el detalle real vive en mapeo_sku_proveedor
-- rfq_licitaciones.orden_compra_id YA vincula la OC a su RFQ de origen,
-- no hace falta duplicar rfq_id acá.

-- ── 5. mapeo_sku_proveedor: SKU del vendor -> SKU real de Trulink ──
-- Interno, invisible al proveedor. tabla_sku_trulink indica en cuál de
-- las 4 tablas de catálogo vive el sku_trulink (no hay FK cruzada posible
-- porque cada catálogo usa SKU como llave natural en tablas distintas).
create table if not exists mapeo_sku_proveedor (
  id bigint generated always as identity primary key,
  proveedor_id uuid not null references proveedores(id),
  orden_compra_id bigint references ordenes_compra(id),
  sku_vendor text not null,
  sku_trulink text not null,
  tabla_sku_trulink text not null check (tabla_sku_trulink in
    ('cablesdb','herrajesdb','accesoriosdb','catalogo_otros')),
  creado_por text,                          -- email del colaborador (convención del repo)
  created_at timestamptz not null default now(),
  unique (proveedor_id, sku_vendor)
);

comment on table mapeo_sku_proveedor is 'Nota interna de la OC: a qué SKU real de Trulink corresponde el SKU del vendor. No se muestra en el vendor portal.';

-- ── 6. catalogo_otros — mismo esquema EXACTO que cablesdb/herrajesdb/accesoriosdb ──
-- Solo se usa cuando un producto nuevo no encaja en ninguna de las 3
-- categorías existentes. Sin columna id (igual que las otras 3): "SKU"
-- es la llave natural.
create table if not exists catalogo_otros (
  "Ítem #" bigint,
  "Familia" text,
  "SKU" text primary key,
  "Descripción" text,
  "Especificaciones" text,
  estado_inventario text,
  image_url text,
  precio_a numeric,
  precio_b numeric,
  precio_c numeric,
  precio_d numeric,
  "Cantidad" integer default 0
);

-- ── 7. reportes_recepcion: cabecera (la llena Bodega = "el contador") ──
create table if not exists reportes_recepcion (
  id bigint generated always as identity primary key,
  orden_compra_id bigint not null references ordenes_compra(id),
  capturado_por text,                       -- email, rol esperado: Bodega
  estado text not null default 'Pendiente de aprobacion'
    check (estado in ('Pendiente de aprobacion','Aprobado','Devuelto - corregir')),
  comentario_supervisor text,
  revisado_por text,                        -- email, rol esperado: Administrador / Super Administrador
  fecha_captura timestamptz not null default now(),
  fecha_revision timestamptz
);

create index if not exists idx_reportes_recepcion_oc on reportes_recepcion(orden_compra_id);
create index if not exists idx_reportes_recepcion_estado on reportes_recepcion(estado);

-- ── 8. reportes_recepcion_items: detalle por renglón de la OC ──
create table if not exists reportes_recepcion_items (
  id bigint generated always as identity primary key,
  reporte_id bigint not null references reportes_recepcion(id) on delete cascade,
  orden_compra_item_id bigint not null references orden_compra_items(id),
  cantidad_esperada numeric not null,
  cantidad_buena numeric not null default 0,
  cantidad_danada numeric not null default 0,
  cantidad_faltante numeric generated always as
    (cantidad_esperada - cantidad_buena - cantidad_danada) stored,
  fotos_evidencia_urls text[]                -- paths en bucket reclamos-evidencia; solo si cantidad_danada > 0
);

-- ── 9. Bucket privado reclamos-evidencia ──
-- Nombre: reclamos-evidencia | Public: FALSE (igual razón que rfq-adjuntos).
-- Paths: reclamos-evidencia/{reporte_id}/{item_id}/foto1.jpg
-- Acceso: solo staff (Bodega sube, Administrador/Super Administrador lee).

-- ── 10. reclamos_proveedor ──
-- Se crea automáticamente AL APROBAR el reporte, uno por cada
-- reportes_recepcion_items con cantidad_danada > 0.
create table if not exists reclamos_proveedor (
  id bigint generated always as identity primary key,
  reporte_id bigint not null references reportes_recepcion(id),
  orden_compra_item_id bigint not null references orden_compra_items(id),
  proveedor_id uuid not null references proveedores(id),
  orden_compra_id bigint not null references ordenes_compra(id),
  cantidad_danada numeric not null,
  fotos_evidencia_urls text[],
  estado text not null default 'Abierto'
    check (estado in ('Abierto','En proceso','Resuelto','Cerrado')),
  email_enviado boolean not null default false,
  fecha_envio_email timestamptz,
  procesado_por text,                        -- email del admin que le da seguimiento
  notas_seguimiento text,
  created_at timestamptz not null default now()
);

create index if not exists idx_reclamos_proveedor_estado on reclamos_proveedor(estado);
create index if not exists idx_reclamos_proveedor_prov on reclamos_proveedor(proveedor_id);

-- ── 11. Efecto de "aprobar" un reporte (lógica en la API route, NO trigger) ──
-- Se hace en backend (no trigger SQL) para poder disparar el email del
-- reclamo en la misma operación y reusar los mismos helpers que ya usa
-- recibirOrden() en pages/admin/proveedores.tsx. Por cada item aprobado:
--
--  1. Resolver sku_trulink / tabla_sku_trulink desde mapeo_sku_proveedor
--     (via orden_compra_item_id -> orden_compra_id -> proveedor_id + sku_vendor).
--  2. Si cantidad_buena > 0:
--       UPDATE {tabla_sku_trulink} SET "Cantidad" = "Cantidad" + cantidad_buena
--       WHERE "SKU" = sku_trulink   -- match por SKU, NO por id (ver nota del bug abajo)
--       INSERT INTO movimientos_inventario (tipo='entrada', origen='compra',
--         referencia_id=orden_compra_id, destino='bodega', tabla_bodega=tabla_sku_trulink,
--         sku_bodega=sku_trulink, cantidad_anterior, cantidad=cantidad_buena,
--         cantidad_nueva, motivo='Recepción aprobada — reporte #reporte_id')
--       UPDATE orden_compra_items SET cantidad_recibida = cantidad_buena WHERE id = orden_compra_item_id
--  3. Si cantidad_danada > 0: INSERT INTO reclamos_proveedor (...) + enviar email a la fábrica.
--
-- ⚠️ BUG existente encontrado en recibirOrden() (pages/admin/proveedores.tsx
-- línea ~478): hace `.select("id, cantidad")` contra cablesdb/herrajesdb/
-- accesoriosdb, pero esas 3 tablas NO tienen columna "id" (confirmado en
-- el comentario de pages/admin/bodega.tsx) y la columna real es "Cantidad"
-- con mayúscula, no "cantidad". Es decir: la recepción de items destino
-- "bodega" probablemente está fallando silenciosamente hoy. La lógica
-- nueva de arriba usa "SKU" y "Cantidad" (los nombres reales) para no
-- heredar el mismo bug.

-- ── 12. RLS ──
alter table mapeo_sku_proveedor enable row level security;
alter table reportes_recepcion enable row level security;
alter table reportes_recepcion_items enable row level security;
alter table reclamos_proveedor enable row level security;
alter table catalogo_otros enable row level security;

-- Estas 5 tablas son 100% internas: cero policy de select para vendors.
-- Con RLS activo y sin policy de "vendor_..." nadie autenticado como
-- proveedor puede leerlas. Solo staff, mismo patrón que 001/002:
drop policy if exists staff_acceso_total on mapeo_sku_proveedor;
create policy staff_acceso_total on mapeo_sku_proveedor for all using (
  exists (select 1 from colaboradores c where c.email = auth.email()
    and c.rol in ('Super Administrador','Administrador') and c.activo = true)
) with check (
  exists (select 1 from colaboradores c where c.email = auth.email()
    and c.rol in ('Super Administrador','Administrador') and c.activo = true)
);

-- reportes_recepcion: Bodega puede insertar/ver, solo Admin/SuperAdmin aprueba (update estado).
drop policy if exists bodega_crea_reportes on reportes_recepcion;
create policy bodega_crea_reportes on reportes_recepcion for insert with check (
  exists (select 1 from colaboradores c where c.email = auth.email()
    and c.rol in ('Bodega','Administrador','Super Administrador') and c.activo = true)
);
drop policy if exists staff_ve_reportes on reportes_recepcion;
create policy staff_ve_reportes on reportes_recepcion for select using (
  exists (select 1 from colaboradores c where c.email = auth.email()
    and c.rol in ('Bodega','Administrador','Super Administrador') and c.activo = true)
);
drop policy if exists admin_revisa_reportes on reportes_recepcion;
create policy admin_revisa_reportes on reportes_recepcion for update using (
  exists (select 1 from colaboradores c where c.email = auth.email()
    and c.rol in ('Administrador','Super Administrador') and c.activo = true)
);

drop policy if exists staff_acceso_total on reportes_recepcion_items;
create policy staff_acceso_total on reportes_recepcion_items for all using (
  exists (select 1 from colaboradores c where c.email = auth.email()
    and c.rol in ('Bodega','Administrador','Super Administrador') and c.activo = true)
) with check (
  exists (select 1 from colaboradores c where c.email = auth.email()
    and c.rol in ('Bodega','Administrador','Super Administrador') and c.activo = true)
);

drop policy if exists staff_acceso_total on reclamos_proveedor;
create policy staff_acceso_total on reclamos_proveedor for all using (
  exists (select 1 from colaboradores c where c.email = auth.email()
    and c.rol in ('Super Administrador','Administrador') and c.activo = true)
) with check (
  exists (select 1 from colaboradores c where c.email = auth.email()
    and c.rol in ('Super Administrador','Administrador') and c.activo = true)
);

drop policy if exists staff_acceso_total on catalogo_otros;
create policy staff_acceso_total on catalogo_otros for all using (
  exists (select 1 from colaboradores c where c.email = auth.email()
    and c.rol in ('Super Administrador','Administrador') and c.activo = true)
) with check (
  exists (select 1 from colaboradores c where c.email = auth.email()
    and c.rol in ('Super Administrador','Administrador') and c.activo = true)
);
-- catalogo_otros necesita también ser LEGIBLE públicamente si tu tienda
-- pública (pages/productos.tsx, pages/producto/[...SKU].tsx) va a
-- mostrar estos productos igual que cablesdb/herrajesdb/accesoriosdb.
-- Confirmame si querés esa policy de select público también.

-- ── 13. Blind bidding real: todos los invitados ven TODAS las ofertas ──
-- Reemplaza la policy vendor_ve_su_oferta de 002 (que limitaba a solo
-- la propia) por una que cubre item_unico: cualquier invitado al mismo
-- RFQ ve la lista completa, pero por diseño de columnas (arriba) lo que
-- ahí aparece nunca incluye identidad real ni desglose de costos.
drop policy if exists vendor_ve_ofertas_rfq_invitado on rfq_ofertas;
create policy vendor_ve_ofertas_rfq_invitado on rfq_ofertas
  for select using (
    rfq_id in (
      select ri.rfq_id from rfq_invitados ri
      where ri.proveedor_id in (select id from proveedores where auth_user_id = auth.uid())
    )
  );
-- La policy vendor_ve_su_oferta de 002 puede quedar (es más restrictiva,
-- PostgreSQL las combina con OR), o se puede dropear porque esta la
-- cubre. La dejo activa por compatibilidad con el flujo multi_criterio viejo.

-- View de conveniencia para el frontend del portal blind:
create or replace view vw_ofertas_blind as
select
  o.id as oferta_id,
  o.rfq_id,
  r.descripcion_referencia,
  o.id_unico_vendor,
  o.total_oferta,
  o.fecha_salida_estimada,
  o.fecha_llegada_estimada
from rfq_ofertas o
join rfq_licitaciones r on r.id = o.rfq_id
where r.tipo = 'item_unico';
