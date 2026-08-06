// pages/api/admin/pagar-bono.ts
//
// Convierte "marcar bono como PAGADO" en un egreso real de tesorería.
// Antes, cambiar el estado en Comisiones.tsx solo actualizaba una etiqueta
// y el bono nunca aparecía en cobros_cliente/pagos_proveedor — es decir,
// nunca bajaba de caja ni entraba al Flujo de Efectivo o Estado de
// Resultados. Este endpoint usa el mismo procesarEgreso() que ya usa el
// modal "Registrar Gasto", así que el bono queda trazado exactamente igual
// que cualquier otro egreso.
//
// NOTA: ajustá la ruta del import de procesarEgreso si tu archivo no está
// en lib/procesarEgreso.ts — es el mismo módulo que ya usa
// /api/admin/registrar-gasto (el que llama RegistrarGastoModal.tsx).

import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { procesarEgreso } from "../../../lib/procesarEgreso";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido." });
  }

  const { bonoId, bancoOrigen, referenciaBancaria, autor } = req.body;

  if (!bonoId || !bancoOrigen) {
    return res.status(400).json({ error: "Falta bonoId o bancoOrigen." });
  }

  try {
    const { data: bono, error: bonoErr } = await supabase
      .from("bonificaciones")
      .select("*")
      .eq("id", bonoId)
      .single();

    if (bonoErr || !bono) throw new Error("Bonificación no encontrada.");
    if (bono.estado === "PAGADO") throw new Error("Este bono ya fue marcado como pagado.");
    if (!bono.monto || Number(bono.monto) <= 0) throw new Error("El bono no tiene un monto válido.");

    // Reusa exactamente la misma función que usa el modal de gastos —
    // crea la cuenta_por_pagar (ya pagada) + el pago_proveedor + auditoría.
    const resumen = await procesarEgreso({
      categoria: "Comisiones & Bonos",
      tercero: bono.colaborador,
      monto: Number(bono.monto),
      bancoOrigen,
      referenciaBancaria,
      concepto: `${bono.tipo_bono}${bono.notas ? " — " + bono.notas : ""}`,
      autor,
      cuentaCodigo: "6102",
      cuentaNombre: "Comisiones y Bonificaciones",
    });

    const { error: updErr } = await supabase
      .from("bonificaciones")
      .update({ estado: "PAGADO", cuenta_por_pagar_id: resumen.cuentaId })
      .eq("id", bonoId);

    if (updErr) throw new Error(`El egreso se registró, pero no se pudo actualizar el bono: ${updErr.message}`);

    return res.status(200).json({ resumen });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || "Error al pagar el bono." });
  }
}
