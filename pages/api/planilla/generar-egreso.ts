import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabase } from "../../../lib/supabaseClient";
import { procesarEgreso } from "../../../lib/contabilidad";

type Body = {
  periodo_id: string;
  banco_origen?: string;
  referencia_bancaria?: string;
  autor?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(500).json({ error: "No se pudo inicializar Supabase" });
  }

  const { periodo_id, banco_origen, referencia_bancaria, autor } = req.body as Body;

  if (!periodo_id) {
    return res.status(400).json({ error: "Falta periodo_id" });
  }

  try {
    // 1. Leer el periodo
    const { data: periodo, error: errPeriodo } = await supabase
      .from("planilla_periodos")
      .select("*")
      .eq("id", periodo_id)
      .single();

    if (errPeriodo || !periodo) {
      return res.status(404).json({ error: "Periodo no encontrado" });
    }

    // 2. Si ya tiene cuenta por pagar asignada, no duplicar el egreso
    if (periodo.cuenta_por_pagar_id) {
      return res.status(409).json({
        error: "Este periodo ya tiene un egreso generado",
        cuentaId: periodo.cuenta_por_pagar_id,
      });
    }

    if (!periodo.total_neto || Number(periodo.total_neto) <= 0) {
      return res.status(400).json({ error: "El periodo no tiene total_neto válido" });
    }

    // 3. Armar descripción del tercero según el modo
    const modoLabel = periodo.modo === "us_corp" ? "Corporación Americana" : "Panamá";
    const tercero = `Planilla ${modoLabel} - Periodo ${periodo.fecha_inicio ?? ""} a ${periodo.fecha_fin ?? ""}`;

    // 4. Procesar el egreso contra el módulo contable real
    const resultado = await procesarEgreso({
      categoria: "Planilla",
      tercero,
      monto: Number(periodo.total_neto),
      bancoOrigen: banco_origen ?? "",
      referenciaBancaria: referencia_bancaria,
      concepto: `Dispersión de planilla - ${modoLabel} - periodo ${periodo_id}`,
      autor,
    });

    // 5. Actualizar el periodo con la cuenta por pagar generada
    const { error: errUpdate } = await supabase
      .from("planilla_periodos")
      .update({
        cuenta_por_pagar_id: resultado.cuentaId,
        estado: "pagado",
      })
      .eq("id", periodo_id);

    if (errUpdate) {
      return res.status(500).json({
        error: "El egreso se creó pero falló al actualizar el periodo",
        detalle: errUpdate.message,
        cuentaId: resultado.cuentaId,
      });
    }

    return res.status(200).json({
      ok: true,
      cuentaId: resultado.cuentaId,
      estado: "pagado",
    });
  } catch (err: any) {
    console.error("Error en generar-egreso:", err);
    return res.status(500).json({ error: err?.message ?? "Error desconocido" });
  }
}
