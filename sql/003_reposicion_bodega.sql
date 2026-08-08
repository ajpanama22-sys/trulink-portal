-- ============================================================
-- EXTENSIÓN: reposición también para BODEGA (producto terminado)
-- ============================================================
-- Correr DESPUÉS de 001 y 002. Es un CREATE OR REPLACE de la misma función
-- de 001 — reemplaza su versión anterior (que solo cubría materia_prima).
--
-- Alcance: NO crea tablas nuevas, NO altera ninguna tabla existente.
-- Solo reemplaza una función. Al ejecutarse, hace SELECT (lectura) sobre
-- cablesdb / herrajesdb / accesoriosdb / cualquier tabla que registres en
-- umbrales_reposicion — nunca las modifica ni les agrega columnas.
-- Valida que la tabla exista (information_schema) antes de tocarla, así que
-- también sirve para productos nuevos que crees a futuro: simplemente
-- registrás su nombre de tabla en umbrales_reposicion, sin migrar nada más.

create or replace function sync_alertas_stock_minimo() returns void as $$
declare
  u record;
  stock_actual numeric;
  existe boolean;
begin
  -- Materia prima (igual que antes)
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

  -- Bodega (producto terminado): cablesdb, herrajesdb, accesoriosdb, o
  -- cualquier tabla nueva que registres en umbrales_reposicion.
  for u in
    select * from umbrales_reposicion
    where tipo_item = 'bodega' and stock_minimo > 0
  loop
    select exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = u.tabla_bodega
    ) into existe;
    if not existe then
      continue;
    end if;

    stock_actual := null;
    begin
      execute format('select cantidad from %I where "SKU" = $1 limit 1', u.tabla_bodega)
        into stock_actual using u.sku_bodega;
    exception when undefined_column then
      begin
        execute format('select cantidad from %I where sku = $1 limit 1', u.tabla_bodega)
          into stock_actual using u.sku_bodega;
      exception when others then
        stock_actual := null;
      end;
    when others then
      stock_actual := null;
    end;

    if stock_actual is not null and stock_actual <= u.stock_minimo then
      if not exists (
        select 1 from alertas_demanda a
        where a.tabla_bodega = u.tabla_bodega and a.sku_bodega = u.sku_bodega
          and a.origen = 'stock_minimo' and a.estado <> 'Cerrada'
      ) then
        insert into alertas_demanda (origen, tipo_item, tabla_bodega, sku_bodega, descripcion, cantidad_sugerida, categoria_insumo, estado)
        values (
          'stock_minimo', 'bodega', u.tabla_bodega, u.sku_bodega,
          'Reposición sugerida: ' || u.sku_bodega || ' (' || u.tabla_bodega || ')',
          greatest(u.stock_minimo * 2 - stock_actual, u.stock_minimo),
          u.categoria_insumo,
          'Abierta'
        );
      end if;
    end if;
  end loop;
end;
$$ language plpgsql security definer;
