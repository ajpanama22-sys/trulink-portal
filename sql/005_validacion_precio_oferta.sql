-- ============================================================
-- 005 — VALIDACION: un solo cambio de precio, solo reduccion,
-- solo dentro de los primeros 7 dias del RFQ (tipo item_unico)
-- ============================================================
-- Correr DESPUES de 004_rfq_item_unico.sql

create or replace function validar_cambio_oferta_item_unico() returns trigger as $$
declare
  rfq record;
begin
  select tipo, fecha_publicacion into rfq from rfq_licitaciones where id = new.rfq_id;

  -- Solo aplica a RFQs tipo item_unico; el flujo multi_criterio no toca este trigger.
  if rfq.tipo is distinct from 'item_unico' then
    return new;
  end if;

  -- INSERT (primera oferta): sin restricciones de precio, solo se registra si fue post-dia-7
  -- (queda igual "congelada" porque nunca tendrá permitido un cambio despues).
  if tg_op = 'INSERT' then
    if now() > rfq.fecha_publicacion + interval '7 days' then
      new.cambio_precio_realizado := true; -- nace ya sin cambios disponibles
    end if;
    return new;
  end if;

  -- UPDATE: si el precio no cambió, dejar pasar (edición de otros campos: PDFs, fechas, etc.)
  if new.precio_unitario = old.precio_unitario then
    return new;
  end if;

  if old.cambio_precio_realizado then
    raise exception 'Ya se usó el único cambio de precio permitido para esta oferta.';
  end if;

  if new.precio_unitario >= old.precio_unitario then
    raise exception 'El cambio de precio solo puede ser una reducción.';
  end if;

  if now() > rfq.fecha_publicacion + interval '7 days' then
    raise exception 'La ventana para cambiar el precio (primeros 7 días del RFQ) ya cerró.';
  end if;

  new.cambio_precio_realizado := true;
  new.fecha_cambio_precio := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_validar_cambio_oferta on rfq_ofertas;
create trigger trg_validar_cambio_oferta
  before insert or update on rfq_ofertas
  for each row execute function validar_cambio_oferta_item_unico();
