import type { NextApiRequest, NextApiResponse } from "next";
import { procesarEgreso } from "../../../lib/contabilidad";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  try {
    const { categoria, tercero, monto, bancoOrigen, referenciaBancaria, concepto, autor } = req.body;

    if (!tercero || !monto || !bancoOrigen) {
      return res.status(400).json({ error: "Faltan campos obligatorios: tercero, monto, bancoOrigen." });
    }

    const resumen = await procesarEgreso({
      categoria,
      tercero,
      monto: parseFloat(monto),
      bancoOrigen,
      referenciaBancaria,
      concepto,
      autor,
    });

    return res.status(200).json({ resumen });
  } catch (err: any) {
    console.error("❌ Error registrando egreso:", err.message);
    return res.status(400).json({ error: err.message });
  }
}
