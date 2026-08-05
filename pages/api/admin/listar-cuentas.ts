import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end("Method Not Allowed");
  }
  try {
    const { data, error } = await supabase
      .from("plan_cuentas")
      .select("*")
      .order("codigo", { ascending: true });

    if (error) throw new Error(error.message);
    return res.status(200).json({ cuentas: data || [] });
  } catch (err: any) {
    console.error("Error listando plan de cuentas:", err.message);
    return res.status(500).json({ error: err.message });
  }
}