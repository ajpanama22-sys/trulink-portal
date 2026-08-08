-- ============================================================
-- 007 — vw_ofertas_blind no debe exponer RFQ en estado Inactivo
-- ============================================================
-- Correr DESPUES de 006.

create or replace view vw_ofertas_blind as
select
  o.id                        as oferta_id,
  o.rfq_id,
  r.descripcion_referencia,
  o.id_unico_vendor,
  o.total_oferta,
  o.fecha_salida_estimada,
  o.fecha_llegada_estimada
from rfq_ofertas o
join rfq_licitaciones r on r.id = o.rfq_id
where r.tipo = 'item_unico'
  and r.estado in ('Activo', 'Cerrado');
