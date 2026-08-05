import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export interface SugerenciaCuenta {
  codigo: string;
  nombre: string;
  confianza: number; // 0 a 1
  origen: "regla" | "ia" | "fallback";
}

// Reglas rápidas por palabra clave — cubren los casos obvios sin gastar
// tokens de IA. Se evalúan en orden; la primera que matchea gana.
const REGLAS: { patrones: RegExp; codigo: string; nombre: string }[] = [
  { patrones: /f[aá]brica|nh\s*link|proveedor.*cable|proveedor.*herraje/i, codigo: "6211", nombre: "Proveedor / Fábrica (Costo de Mercancía)" },
  { patrones: /despacho|aduana|flete|exw|log[ií]stica|naviera/i, codigo: "6212", nombre: "Despacho, Aduanas y Logística" },
  { patrones: /sueldo|salario|planilla|n[oó]mina|honorario/i, codigo: "6101", nombre: "Sueldos y Salarios" },
  { patrones: /comisi[oó]n|bono|bonificaci[oó]n/i, codigo: "6102", nombre: "Comisiones y Bonificaciones" },
  { patrones: /luz|electricidad|agua\b|edemet|enel|ideaal/i, codigo: "6201", nombre: "Servicios Públicos (Luz, Agua)" },
  { patrones: /internet|tel[eé]fono|claro|tigo|cable\s*&?\s*wireless|movistar/i, codigo: "6202", nombre: "Internet y Telecomunicaciones" },
  { patrones: /hosting|servidor|vercel|supabase|aws|dominio|software|saas|licencia|brevo|github|openai|anthropic/i, codigo: "6203", nombre: "Hosting, Servidores y Software (SaaS)" },
  { patrones: /marketing|publicidad|\bads\b|facebook|google\s*ads|instagram|campa[nñ]a/i, codigo: "6204", nombre: "Marketing y Publicidad" },
  { patrones: /abogado|legal|contad|auditor|consultor/i, codigo: "6205", nombre: "Servicios Profesionales (Legal, Contable)" },
  { patrones: /mantenimiento|reparaci[oó]n|t[eé]cnico/i, codigo: "6206", nombre: "Mantenimiento y Reparaciones" },
  { patrones: /seguro/i, codigo: "6207", nombre: "Seguros" },
  { patrones: /gasolina|combustible|transporte|env[ií]o local/i, codigo: "6208", nombre: "Transporte y Combustible" },
  { patrones: /papeler[ií]a|oficina|suministro/i, codigo: "6209", nombre: "Papelería y Suministros de Oficina" },
  { patrones: /alquiler|arrendamiento|renta\s*local/i, codigo: "6210", nombre: "Arrendamiento / Alquiler" },
];

function intentarPorReglas(texto: string): SugerenciaCuenta | null {
  const t = texto.toLowerCase();
  for (const r of REGLAS) {
    if (r.patrones.test(t)) {
      return { codigo: r.codigo, nombre: r.nombre, confianza: 0.9, origen: "regla" };
    }
  }
  return null;
}

async function intentarPorIA(texto: string): Promise<SugerenciaCuenta | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("ANTHROPIC_API_KEY no configurada — se omite clasificación por IA.");
    return null;
  }

  const { data: catalogo } = await supabase
    .from("plan_cuentas")
    .select("codigo, nombre")
    .eq("tipo", "GASTO")
    .eq("activa", true);

  if (!catalogo || catalogo.length === 0) return null;

  const listaCatalogo = catalogo.map((c) => `${c.codigo} - ${c.nombre}`).join("\n");

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        system:
          "Sos un clasificador contable. Dado un concepto de gasto, elegí la cuenta MÁS apropiada del catálogo. " +
          "Respondé SOLO con JSON, sin texto adicional, con este formato exacto: " +
          '{"codigo":"XXXX","nombre":"...","confianza":0.0}. ' +
          "confianza es un número entre 0 y 1 que indica qué tan seguro estás. " +
          "El código DEBE ser exactamente uno de los que aparecen en el catálogo, sin inventar códigos nuevos.",
        messages: [
          {
            role: "user",
            content: `Catálogo de cuentas de gasto disponibles:\n${listaCatalogo}\n\nConcepto a clasificar: "${texto}"`,
          },
        ],
      }),
    });

    const json = await resp.json();
    const textoRespuesta = json?.content?.[0]?.text || "";
    const limpio = textoRespuesta.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(limpio);

    if (!parsed.codigo || !parsed.nombre) return null;

    // Validación crítica: la IA solo puede elegir un código que
    // REALMENTE exista en el catálogo. Si alucina uno, se descarta
    // y se cae al fallback en vez de guardar una cuenta inválida.
    const existe = catalogo.find((c) => c.codigo === parsed.codigo);
    if (!existe) {
      console.warn(`IA sugirió código inexistente: ${parsed.codigo}. Se descarta la sugerencia.`);
      return null;
    }

    return { codigo: existe.codigo, nombre: existe.nombre, confianza: Number(parsed.confianza) || 0.5, origen: "ia" };
  } catch (err) {
    console.error("Error clasificando por IA:", err);
    return null;
  }
}

/**
 * Sugiere la cuenta contable de gasto más probable para un concepto dado.
 * 1) Prueba reglas rápidas por palabra clave (gratis, instantáneo).
 * 2) Si no matchea nada, usa IA contra el catálogo real de Supabase.
 * 3) Si todo falla (o la IA no está configurada / alucina), cae en
 *    "Otros Gastos Operativos".
 * SIEMPRE es una sugerencia — la UI debe pedir confirmación antes de guardar.
 */
export async function sugerirCuentaContable(textoConcepto: string): Promise<SugerenciaCuenta> {
  const porRegla = intentarPorReglas(textoConcepto);
  if (porRegla) return porRegla;

  const porIA = await intentarPorIA(textoConcepto);
  if (porIA) return porIA;

  return { codigo: "6299", nombre: "Otros Gastos Operativos", confianza: 0.3, origen: "fallback" };
}