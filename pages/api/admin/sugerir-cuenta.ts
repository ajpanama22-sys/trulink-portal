import type { NextApiRequest, NextApiResponse } from "next";
import { sugerirCuentaContable } from "../../../lib/clasificadorContable";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }
  try {
    const { concepto, categoria, tercero } = req.body;
    const texto = [categoria, tercero, concepto].filter(Boolean).join(" - ");
    if (!texto.trim()) return res.status(400).json({ error: "Falta concepto, categoría o tercero." });

    const sugerencia = await sugerirCuentaContable(texto);
    return res.status(200).json({ sugerencia });
  } catch (err: any) {
    console.error("Error sugiriendo cuenta:", err.message);
    return res.status(500).json({ error: err.message });
  }
}