-- ============================================================
-- 006 — RFQ ITEM UNICO: Trulink define SKU/Descripción/Cantidad
-- solicitados + estado de 3 valores (Activo/Inactivo/Cerrado)
-- ============================================================
-- Correr DESPUES de 004 y 005.

alter table rfq_licitaciones
  add column if not exists sku_solicitado text,          -- puede venir de cablesdb/herrajesdb/accesoriosdb o ser nuevo (texto libre)
  add column if not exists tabla_sku_solicitado text      -- de dónde salió el SKU, si existía en catálogo (informativo, no FK real)
    check (tabla_sku_solicitado in ('cablesdb','herrajesdb','accesoriosdb','catalogo_otros', null)),
  add column if not exists cantidad_solicitada numeric;

comment on column rfq_licitaciones.sku_solicitado is 'SKU que Trulink quiere comprar. Puede existir ya en el catálogo o ser un producto nuevo (texto libre, no obligado a existir).';
comment on column rfq_licitaciones.cantidad_solicitada is 'Cantidad que Trulink pide. El vendor oferta precio unitario sobre esta cantidad, no define la suya propia.';

-- No hay CHECK constraint sobre `estado` en esta tabla (es texto libre desde
-- el 002 original), así que para RFQ tipo item_unico simplemente se usan
-- los valores 'Activo' | 'Inactivo' | 'Cerrado' desde la aplicación.
-- El flujo multi_criterio (tipo='multi_criterio') sigue usando
-- 'Abierta'/'Cerrada'/'Adjudicada'/'Cancelada' sin ningún cambio.

-- Migra los RFQ item_unico que ya existan con 'Abierta'/'Cerrada' al
-- nuevo vocabulario, para no dejar datos inconsistentes:
update rfq_licitaciones set estado = 'Activo'  where tipo = 'item_unico' and estado = 'Abierta';
update rfq_licitaciones set estado = 'Cerrado' where tipo = 'item_unico' and estado = 'Cerrada';
