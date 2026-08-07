import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { procesarEgreso } from "../../../lib/contabilidad";
import { verificarSesionAdmin } from "../../../lib/verificarSesionAdmin";

const ROLES_PERMITIDOS = ["Super Administrador", "Administrador"];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido." });
  }

  const auth = await verificarSesionAdmin(req, ROLES_PERMITIDOS);
  if (!auth.autorizado) {
    return res.status(auth.status).json({ error: auth.mensaje });
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

    const resumen = await procesarEgreso({
      categoria: "Comisiones & Bonos",
      tercero: bono.colaborador,
      monto: Number(bono.monto),
      bancoOrigen,
      referenciaBancaria,
      concepto: `${bono.tipo_bono}${bono.notas ? " — " + bono.notas : ""}`,
      autor: auth.email || autor,
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