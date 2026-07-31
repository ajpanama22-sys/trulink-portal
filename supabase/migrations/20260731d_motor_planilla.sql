-- ============================================================
-- Motor de cálculo, comprobantes y puente contable para planilla
-- ============================================================

-- ------------------------------------------------------------
-- 1) Calcular deducciones de un registro de planilla_detalle
--    - Panamá: CSS (9.75%) + Seguro Educativo (1.25%) sobre el
--      salario devengado (base + horas extra + bonos).
--      Además se calcula el décimo tercer mes como PROVISIÓN
--      (8.3333%), que es carga del empleador, no se resta del
--      neto del empleado — se guarda solo como referencia.
--    - US Corp: bajo la excepción fiscal (sin nexo: sin
--      empleados/directivos/ventas/productos en EE.UU.), por
--      defecto NO se calculan retenciones federales/estatales
--      automáticas. Quedan en 0 y editables a mano si tu
--      contador fiscal en EE.UU. determina que sí aplica algo
--      en un caso puntual. Esto es una plantilla, no asesoría.
--
--    NOTA: los porcentajes de Panamá son los vigentes al
--    momento de escribir esto; confírmalos con tu contador
--    antes de producción porque pueden actualizarse.
-- ------------------------------------------------------------
create or replace function planilla_calcular_detalle(p_detalle_id uuid)
returns void as $$
declare
  d record;
  e record;
  devengado numeric(14,2);
  css numeric(14,2) := 0;
  seguro_educativo numeric(14,2) := 0;
  decimo_provision numeric(14,2) := 0;
  total_ded numeric(14,2) := 0;
  ded jsonb;
begin
  select * into d from planilla_detalle where id = p_detalle_id;
  if not found then
    raise exception 'planilla_detalle % no existe', p_detalle_id;
  end if;

  select * into e from planilla_empleados where id = d.empleado_id;

  devengado := coalesce(d.salario_base,0) + coalesce(d.monto_horas_extra,0) + coalesce(d.bonos,0);

  if e.modo = 'panama' then
    css := round(devengado * 0.0975, 2);
    seguro_educativo := round(devengado * 0.0125, 2);
    decimo_provision := round(devengado * 0.083333, 2);
    total_ded := css + seguro_educativo;
    ded := jsonb_build_object(
      'css', css,
      'seguro_educativo', seguro_educativo,
      'decimo_provision_referencial', decimo_provision
    );
  else
    -- us_corp: sin retenciones automáticas bajo excepción fiscal.
    -- Deja el jsonb explícito para que quede claro que se revisó,
    -- no que se olvidó calcular.
    total_ded := coalesce((d.deducciones->>'federal')::numeric, 0)
               + coalesce((d.deducciones->>'estatal')::numeric, 0)
               + coalesce((d.deducciones->>'otros')::numeric, 0);
    ded := jsonb_build_object(
      'federal', coalesce((d.deducciones->>'federal')::numeric, 0),
      'estatal', coalesce((d.deducciones->>'estatal')::numeric, 0),
      'otros', coalesce((d.deducciones->>'otros')::numeric, 0),
      'nota', 'sin retencion automatica por excepcion fiscal (sin nexo US)'
    );
  end if;

  update planilla_detalle
  set deducciones = ded,
      total_deducciones = total_ded,
      neto = devengado - total_ded
  where id = p_detalle_id;
end;
$$ language plpgsql;

-- Calcula todos los detalles de un periodo de una vez
create or replace function planilla_calcular_periodo(p_periodo_id uuid)
returns void as $$
declare
  r record;
  suma_bruto numeric(14,2) := 0;
  suma_ded numeric(14,2) := 0;
  suma_neto numeric(14,2) := 0;
begin
  for r in select id from planilla_detalle where periodo_id = p_periodo_id loop
    perform planilla_calcular_detalle(r.id);
  end loop;

  select
    coalesce(sum(salario_base + monto_horas_extra + bonos), 0),
    coalesce(sum(total_deducciones), 0),
    coalesce(sum(neto), 0)
  into suma_bruto, suma_ded, suma_neto
  from planilla_detalle
  where periodo_id = p_periodo_id;

  update planilla_periodos
  set total_bruto = suma_bruto,
      total_deducciones = suma_ded,
      total_neto = suma_neto
  where id = p_periodo_id;
end;
$$ language plpgsql;

-- ------------------------------------------------------------
-- 2) Generar comprobantes (uno por cada detalle del periodo)
--    Aquí solo se deja el registro con la referencia; la
--    generación del PDF en sí la puedes conectar después
--    (ej. función edge que arma el PDF y sube url_pdf).
-- ------------------------------------------------------------
create or replace function planilla_generar_comprobantes(p_periodo_id uuid)
returns integer as $$
declare
  total_generados integer := 0;
begin
  insert into planilla_comprobantes (detalle_id)
  select d.id
  from planilla_detalle d
  where d.periodo_id = p_periodo_id
    and not exists (
      select 1 from planilla_comprobantes c where c.detalle_id = d.id
    );

  get diagnostics total_generados = row_count;
  return total_generados;
end;
$$ language plpgsql;

-- ------------------------------------------------------------
-- 3) Puente hacia contabilidad: genera el asiento del periodo.
--
--    IMPORTANTE: esta función asume nombres de tabla genéricos
--    (`asientos_contables`, `asiento_lineas`) que TIENES que
--    ajustar a como se llamen realmente tus tablas contables.
--    Si no existen aún, esta función solo deja el periodo
--    marcado y no falla el resto del flujo (usa un bloque
--    try/catch a nivel de aplicación, no aquí, para no romper
--    el commit). Por ahora, si las tablas no existen, comenta
--    esta función o ajusta los nombres antes de usarla.
-- ------------------------------------------------------------
create or replace function planilla_generar_asiento(p_periodo_id uuid)
returns uuid as $$
declare
  p record;
  nuevo_asiento_id uuid;
begin
  select * into p from planilla_periodos where id = p_periodo_id;
  if not found then
    raise exception 'periodo % no existe', p_periodo_id;
  end if;

  if p.asiento_contable_id is not null then
    return p.asiento_contable_id; -- ya tiene asiento, no duplicar
  end if;

  -- AJUSTA este bloque a tu esquema contable real.
  -- Ejemplo de estructura esperada (descomenta y adapta):
  --
  -- insert into asientos_contables (fecha, descripcion, origen)
  -- values (p.fecha_fin, 'Planilla ' || p.modo || ' ' || p.fecha_inicio || ' a ' || p.fecha_fin, 'planilla')
  -- returning id into nuevo_asiento_id;
  --
  -- insert into asiento_lineas (asiento_id, cuenta, debito, credito)
  -- values
  --   (nuevo_asiento_id, 'gasto_planilla', p.total_bruto, 0),
  --   (nuevo_asiento_id, 'banco', 0, p.total_neto),
  --   (nuevo_asiento_id, 'pasivo_deducciones_por_pagar', 0, p.total_deducciones);

  if nuevo_asiento_id is null then
    raise notice 'planilla_generar_asiento: ajusta los nombres de tabla contable antes de usar esta función en producción.';
    return null;
  end if;

  update planilla_periodos
  set asiento_contable_id = nuevo_asiento_id
  where id = p_periodo_id;

  return nuevo_asiento_id;
end;
$$ language plpgsql;
