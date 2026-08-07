import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { verificarSesionAdmin } from "../../../lib/verificarSesionAdmin";

const ROLES_PERMITIDOS = ["Super Administrador", "Administrador"];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  const auth = await verificarSesionAdmin(req, ROLES_PERMITIDOS);
  if (!auth.autorizado) {
    return res.status(auth.status).json({ error: auth.mensaje });
  }

  try {
    const { nombre, tipo } = req.body;
    if (!nombre || !nombre.trim()) return res.status(400).json({ error: "Falta el nombre de la cuenta." });

    const tipoFinal = tipo || "GASTO";
    const prefijo = tipoFinal === "GASTO" ? "6" : tipoFinal === "INGRESO" ? "4" : tipoFinal === "PASIVO" ? "2" : "1";

    const { data: existentes } = await supabase
      .from("plan_cuentas")
      .select("codigo")
      .like("codigo", `${prefijo}%`)
      .order("codigo", { ascending: false })
      .limit(1);

    const ultimo = existentes?.[0]?.codigo ? parseInt(existentes[0].codigo) : Number(`${prefijo}299`);
    const nuevoCodigo = String(ultimo + 1);

    const { data, error } = await supabase
      .from("plan_cuentas")
      .insert([{ codigo: nuevoCodigo, nombre: nombre.trim(), tipo: tipoFinal, activa: true }])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return res.status(200).json({ cuenta: data });
  } catch (err: any) {
    console.error("Error creando cuenta contable:", err.message);
    return res.status(500).json({ error: err.message });
  }
}