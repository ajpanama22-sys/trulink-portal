-- ============================================================
-- DOCUMENTACIÓN: esquema real de `ordenes_produccion`
-- ============================================================
-- Esta tabla YA EXISTE en producción (Supabase) pero, a diferencia de
-- planilla_* y cuentas_contables/asientos_contables/asiento_lineas, nunca
-- tuvo un CREATE TABLE versionado en este repo. Es la tabla central del
-- módulo Manufactura (pages/admin/manufactura.tsx) y también la consultan
-- Despachos, Analítica y Seguimiento (portal cliente).
--
-- Este archivo NO crea la tabla en el sentido de "bootstrap" — usa
-- `create table if not exists`, así que correrlo contra producción es un
-- no-op (la tabla ya existe con esta misma forma). El propósito es dejar
-- el esquema real versionado en git para que quede trazado en el
-- historial y no dependa solo de lo que el código de la app "asume".
--
-- Origen de la información: query directa a information_schema en el
-- SQL Editor de Supabase (2026-08-06):
--
--   select column_name, is_nullable, data_type
--   from information_schema.columns
--   where table_name = 'ordenes_produccion';
--
-- Esa query solo devuelve columna + nullable + tipo — NO devuelve
-- primary key, foreign keys, defaults, índices ni políticas RLS. Por lo
-- tanto, deliberadamente NO se declaran acá:
--   - PRIMARY KEY en `id`: es bigint not null y casi seguro es la PK
--     (patrón estándar de Supabase), pero no está confirmado con
--     information_schema.table_constraints — no se agrega la restricción
--     para no afirmar algo que no se verificó.
--   - FOREIGN KEY de `quote_id` hacia quotes(id): `quote_id` es tipo
--     `text` (confirmado por la query), mientras que el resto del código
--     castea explícitamente `String(q.id)` al escribirlo
--     (pages/admin/manufactura.tsx:444) — el tipo text en vez de
--     bigint/uuid sugiere que probablemente NO hay una FK real hacia
--     quotes.id, solo una referencia informal por texto. No confirmado.
--   - FOREIGN KEY de `configuracion_id` hacia producto_configuraciones(id):
--     mismo caso — referenciado por convención en el código
--     (pages/admin/manufactura.tsx), no confirmado como constraint real.
--   - Índices y políticas RLS: no se verificaron en este relevamiento.
--
-- Si en algún momento se necesita esta tabla con garantías reales de
-- integridad (PK/FK/RLS), hay que confirmar cada constraint con
-- information_schema.table_constraints / information_schema.key_column_usage
-- (o pg_indexes para índices) antes de codificarla acá.
-- ============================================================

create table if not exists ordenes_produccion (
  id                  bigint not null,
  numero              text,
  quote_id            text,
  quote_referencia    text,
  cliente_nombre      text,
  configuracion_id    bigint,
  numero_hilos        integer not null,
  carretes            integer not null,
  km_totales          numeric not null,
  sku_destino         text,
  estado              text not null,
  fecha_inicio        date,
  fecha_fin           date,
  -- Texto libre que arma manufactura.tsx al "Cerrar Producción" cuando algún
  -- insumo no alcanzaba (stock quedó negativo). Lo lee analitica.tsx para el
  -- KPI "Órdenes con Faltantes". Null/vacío = se cerró sin problemas de stock.
  faltantes           text,
  notas               text,
  created_at          timestamptz not null,
  metros_por_carrete  integer
);

-- Nota: no se agrega RLS ni políticas acá — no se verificó cuáles rigen
-- hoy sobre la tabla real, y agregar una política nueva sin confirmarlo
-- podría cambiar el comportamiento de acceso en producción. Confirmar
-- primero en el dashboard de Supabase (Authentication > Policies) antes
-- de declarar RLS para esta tabla en una migración futura.
