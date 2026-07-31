import { createClient } from "@supabase/supabase-js";
import { generarYEnviarDocumento } from "./generarYEnviarDocumento";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const hoyISO = () => new Date().toISOString().slice(0, 10);

export type MetodoPago = "Stripe" | "PayPal" | "Transferencia" | "Yappy" | "ACH" | "Efectivo" | "Cheque";

interface ProcesarPagoParams {
  referencia: string;          // referencia de la cotización (quotes.referencia)
  montoPagado: number;
  metodoPago: MetodoPago;
  customerEmail?: string;
  referenciaBancaria?: string; // n° de comprobante / transacción
  autor?: string;               // quién lo registró (solo en carga manual)
  esAnticipo?: boolean;
}

interface ResultadoPago {
  quote: any;
  cuentaId: number;
  montoTotalCotizacion: number;
  abonoActualRegistrado: number;
  acumuladoPagado: number;
  saldoPendiente: number;
  estatusActualizado: string;
  documentoEmitido: string;
  referencia: string;
}

/**
 * Punto único de entrada para CUALQUIER ingreso: webhook de Stripe, webhook
 * de PayPal, o carga manual de transferencia. Todo cae en las mismas tablas
 * (cuentas_por_cobrar + cobros_cliente) que ya lee CuentasPorCobrar.tsx y
 * de las que lee ResumenTesoreria.tsx. No existen más caminos paralelos.
 */
export async function procesarPagoConfirmado(params: ProcesarPagoParams): Promise<ResultadoPago> {
  const { referencia, montoPagado, metodoPago, customerEmail, referenciaBancaria, autor, esAnticipo } = params;

  if (!referencia) throw new Error("Falta la referencia de la cotización.");
  if (!montoPagado || montoPagado <= 0) throw new Error("El monto pagado debe ser mayor a cero.");

  // 1. Cotización
  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("*")
    .eq("referencia", referencia)
    .single();

  if (quoteError || !quote) {
    throw new Error(`Cotización ${referencia} no encontrada.`);
  }

  const totalCotizacion = parseFloat(quote.total || "0");

  // 2. Cliente (para forma_pago / condiciones, si existe)
  const { data: cliente } = await supabase
    .from("clientes")
    .select("*")
    .eq("email", customerEmail || quote.email || "")
    .maybeSingle();

  // 3. Buscar o crear la cuenta por cobrar
  let { data: cuenta } = await supabase
    .from("cuentas_por_cobrar")
    .select("*")
    .eq("quote_referencia", referencia)
    .maybeSingle();

  if (!cuenta) {
    let venc = new Date();
    const forma = String(cliente?.forma_pago || "").trim();
    if (forma === "100%") {
      // vence hoy
    } else if (quote.fecha_estimada_entrega) {
      venc = new Date(quote.fecha_estimada_entrega);
      venc.setDate(venc.getDate() - 3);
      if (venc.getTime() < Date.now()) venc = new Date();
    } else {
      venc.setDate(venc.getDate() + 15);
    }

    const { data: nuevaCuenta, error: insErr } = await supabase
      .from("cuentas_por_cobrar")
      .insert([{
        cliente_id: cliente?.id ? String(cliente.id) : null,
        cliente_nombre: quote.empresa || cliente?.razon_social || quote.representante || "Cliente",
        quote_id: String(quote.id),
        quote_referencia: referencia,
        numero_factura: referencia,
        fecha_emision: hoyISO(),
        fecha_vencimiento: venc.toISOString().slice(0, 10),
        moneda: "USD",
        monto_total: totalCotizacion,
        saldo_pendiente: totalCotizacion,
        estado: "Pendiente",
        forma_pago: cliente?.forma_pago || null,
        porcentaje_inicial: cliente?.porcentaje_pago ?? null,
        notas: `Generada automáticamente por pago vía ${metodoPago} el ${hoyISO()}.`,
      }])
      .select()
      .single();

    if (insErr) throw new Error(`Error creando cuenta por cobrar: ${insErr.message}`);
    cuenta = nuevaCuenta;
  }

  // 4. Registrar el cobro (nunca se sobrepasa el saldo pendiente real)
  const saldoActual = Number(cuenta.saldo_pendiente || 0);
  const montoAplicado = Math.min(montoPagado, saldoActual > 0 ? saldoActual : montoPagado);

  const { error: cobroErr } = await supabase.from("cobros_cliente").insert([{
    cuenta_por_cobrar_id: cuenta.id,
    cliente_id: cuenta.cliente_id,
    fecha: hoyISO(),
    monto: montoAplicado,
    metodo_pago: metodoPago,
    referencia: referenciaBancaria || null,
    es_anticipo: !!esAnticipo,
    autor: autor || (metodoPago === "Stripe" || metodoPago === "PayPal" ? "Webhook automático" : null),
  }]);
  if (cobroErr) throw new Error(`Error registrando el cobro: ${cobroErr.message}`);

  // 5. Actualizar saldo/estado de la cuenta
  const nuevoSaldo = Number((saldoActual - montoAplicado).toFixed(2));
  const nuevoEstado = nuevoSaldo <= 0.009 ? "Cobrada" : "Parcial";

  const { error: updErr } = await supabase
    .from("cuentas_por_cobrar")
    .update({ saldo_pendiente: Math.max(0, nuevoSaldo), estado: nuevoEstado })
    .eq("id", cuenta.id);
  if (updErr) throw new Error(`Error actualizando saldo: ${updErr.message}`);

  // 6. Espejo en 'quotes' (para portal-cliente, smartquote, etc. que ya leen de ahí)
  const pagadoAnteriorQuote = parseFloat(quote.monto_pagado || "0");
  const acumuladoQuote = pagadoAnteriorQuote + montoAplicado;
  const saldoQuote = totalCotizacion - acumuladoQuote;
  await supabase
    .from("quotes")
    .update({
      monto_pagado: acumuladoQuote,
      saldo_pendiente: saldoQuote > 0 ? saldoQuote : 0,
      status: saldoQuote <= 0 ? "paid" : "partial",
      metodo_pago: metodoPago,
    })
    .eq("referencia", referencia);

  // 7. Auditoría
  try {
    await supabase.from("audit_log").insert([{
      accion: "cobro_registrado",
      entidad: "cuenta_por_cobrar",
      entidad_id: String(cuenta.id),
      detalle: `Cobro de $${montoAplicado.toFixed(2)} vía ${metodoPago} para ${referencia}. Saldo: $${Math.max(0, nuevoSaldo).toFixed(2)}.`,
      autor: autor || null,
    }]);
  } catch { /* no frena el flujo */ }

  // 8. Documento (factura o recibo parcial) por Brevo
  const documentoEmitido = nuevoEstado === "Cobrada" ? "Factura Comercial" : "Recibo de Pago Parcial";
  try {
    await generarYEnviarDocumento({ referencia });
  } catch (e: any) {
    console.error("⚠️ Error generando/enviando documento:", e.message);
  }

  return {
    quote,
    cuentaId: cuenta.id,
    montoTotalCotizacion: totalCotizacion,
    abonoActualRegistrado: montoAplicado,
    acumuladoPagado: acumuladoQuote,
    saldoPendiente: Math.max(0, nuevoSaldo),
    estatusActualizado: nuevoEstado,
    documentoEmitido,
    referencia,
  };
}

/**
 * Registra un egreso directo (no viene de una orden de compra con crédito):
 * pago a proveedor, servicio, nómina, comisión, etc. Se crea la cuenta por
 * pagar YA PAGADA para que quede trazabilidad en CxP sin dejar saldo falso.
 */
export async function procesarEgreso(params: {
  categoria: string;
  tercero: string;
  monto: number;
  bancoOrigen: string;
  referenciaBancaria?: string;
  concepto?: string;
  autor?: string;
}) {
  const { categoria, tercero, monto, bancoOrigen, referenciaBancaria, concepto, autor } = params;

  if (!tercero) throw new Error("Falta el beneficiario.");
  if (!monto || monto <= 0) throw new Error("El monto debe ser mayor a cero.");

  const { data: cuenta, error: cuentaErr } = await supabase
    .from("cuentas_por_pagar")
    .insert([{
      proveedor_id: null,
      proveedor_nombre: tercero,
      orden_id: null,
      numero_factura: referenciaBancaria || null,
      fecha_emision: hoyISO(),
      fecha_vencimiento: hoyISO(),
      moneda: "USD",
      monto_total: monto,
      saldo_pendiente: 0,
      estado: "Pagada",
      notas: `${categoria}${concepto ? " — " + concepto : ""} (banco: ${bancoOrigen})`,
    }])
    .select()
    .single();
  if (cuentaErr) throw new Error(`Error creando cuenta por pagar: ${cuentaErr.message}`);

  const { error: pagoErr } = await supabase.from("pagos_proveedor").insert([{
    cuenta_por_pagar_id: cuenta.id,
    proveedor_id: null,
    fecha: hoyISO(),
    monto,
    metodo_pago: bancoOrigen,
    referencia: referenciaBancaria || null,
    autor: autor || null,
  }]);
  if (pagoErr) throw new Error(`Error registrando el pago: ${pagoErr.message}`);

  try {
    await supabase.from("audit_log").insert([{
      accion: "egreso_registrado",
      entidad: "cuenta_por_pagar",
      entidad_id: String(cuenta.id),
      detalle: `Egreso de $${monto.toFixed(2)} a ${tercero} (${categoria}). Banco: ${bancoOrigen}.`,
      autor: autor || null,
    }]);
  } catch { /* no frena */ }

  return {
    estatus: "EXITOSO",
    monto,
    beneficiario: tercero,
    referencia: referenciaBancaria || "N/A",
    cuentaId: cuenta.id,
  };
}
