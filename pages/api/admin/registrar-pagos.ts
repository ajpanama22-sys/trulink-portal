import type { NextApiRequest, NextApiResponse } from "next";
import { procesarPagoConfirmado } from "../../../lib/contabilidad";
import { verificarSesionAdmin } from "../../../lib/verificarSesionAdmin";

const ROLES_PERMITIDOS = ["Super Administrador", "Administrador"];

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
    const { referencia, montoPagado, banco, referenciaBancaria, autor } = req.body;

    if (!referencia || !montoPagado || !banco) {
      return res.status(400).json({ error: "Faltan campos obligatorios: referencia, montoPagado, banco." });
    }

    const resultado = await procesarPagoConfirmado({
      referencia,
      montoPagado: parseFloat(montoPagado),
      metodoPago: "Transferencia",
      referenciaBancaria: referenciaBancaria ? `${banco} · ${referenciaBancaria}` : banco,
      autor: auth.email || autor,
    });

    return res.status(200).json({ resumen: resultado });
  } catch (err: any) {
    console.error("❌ Error registrando pago manual:", err.message);
    return res.status(400).json({ error: err.message });
  }
}
