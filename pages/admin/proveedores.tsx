import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../lib/supabaseClient";
import Sidebar from "./Sidebar";

/* ============================================================
   PROVEEDORES Y ABASTECIMIENTO — TRULINK FIBER LLC
   ------------------------------------------------------------
   Pestañas:
     1. Directorio        — ficha maestra + crédito y saldo vivo
     2. Órdenes de compra — del pedido a la recepción
     3. Cuentas por pagar — deuda real y antigüedad de saldos
     4. Estado de cuenta  — todo lo de un proveedor en un lugar

   Regla de oro contable: crear un proveedor NO genera deuda.
   La deuda nace al recibir la mercancía, que es cuando se
   crea la cuenta por pagar y entra el stock al inventario.
   ============================================================ */

type Proveedor = {
  id: string;
  nombre: string;
  contacto?: string | null;
  email?: string | null;
  telefono?: string | null;
  pais?: string | null;
  tipo_insumo?: string | null;
  condiciones_pago?: string | null;
  estado?: string | null;
  descripcion?: string | null;
  ruc?: string | null;
  direccion?: string | null;
  limite_credito?: number | null;
  dias_credito?: number | null;
  moneda?: string | null;
  banco?: string | null;
  cuenta_bancaria?: string | null;
  swift?: string | null;
  incoterm?: string | null;
  calificacion?: number | null;
  notas_internas?: string | null;
};

type MateriaPrima = {
  id: number;
  codigo: string;
  nombre: string;
  unidad: string;
  stock_actual: number;
  categoria?: string | null;
};

type OrdenCompra = {
  id: number;
  numero: string | null;
  proveedor_id: string | null;
  proveedor_nombre: string | null;
  fecha: string;
  fecha_estimada_entrega: string | null;
  estado: string;
  moneda: string | null;
  subtotal: number;
  impuestos: number;
  total: number;
  incoterm: string | null;
  notas: string | null;
  fecha_recepcion: string | null;
};

type ItemOC = {
  id?: number;
  orden_id?: number;
  destino: "materia_prima" | "bodega";
  materia_prima_id: number | null;
  tabla_bodega: string | null;
  sku_bodega: string | null;
  descripcion: string;
  unidad: string;
  cantidad: number;
  cantidad_recibida?: number;
  precio_unitario: number;
  total: number;
};

type CuentaPorPagar = {
  id: number;
  proveedor_id: string | null;
  proveedor_nombre: string | null;
  orden_id: number | null;
  numero_factura: string | null;
  fecha_emision: string;
  fecha_vencimiento: string | null;
  moneda: string | null;
  monto_total: number;
  saldo_pendiente: number;
  estado: string;
  notas: string | null;
};

type PagoProveedor = {
  id: number;
  cuenta_por_pagar_id: number;
  proveedor_id: string | null;
  fecha: string;
  monto: number;
  metodo_pago: string | null;
  referencia: string | null;
  autor: string | null;
};

const ESTADOS_OC = ["Borrador", "Enviada", "Confirmada", "Recibida", "Cancelada"] as const;
const TABLAS_BODEGA = [
  { key: "cablesdb", label: "Cables" },
  { key: "accesoriosdb", label: "Accesorios" },
  { key: "herrajesdb", label: "Herrajes" },
];

const fmt = (n: any) =>
  "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const hoyISO = () => new Date().toISOString().slice(0, 10);

/** Días transcurridos desde el vencimiento. Negativo = aún no vence. */
const diasVencido = (fechaVenc?: string | null): number => {
  if (!fechaVenc) return 0;
  const hoy = new Date(hoyISO()).getTime();
  const venc = new Date(fechaVenc).getTime();
  return Math.floor((hoy - venc) / 86400000);
};

/** Cubeta de antigüedad de saldos, el reporte clave de cuentas por pagar. */
const cubetaAging = (fechaVenc?: string | null): string => {
  const d = diasVencido(fechaVenc);
  if (d <= 0) return "Corriente";
  if (d <= 30) return "1-30";
  if (d <= 60) return "31-60";
  if (d <= 90) return "61-90";
  return "+90";
};

const COLOR_AGING: Record<string, string> = {
  Corriente: "#2ecc71",
  "1-30": "#f1c40f",
  "31-60": "#e67e22",
  "61-90": "#e74c3c",
  "+90": "#c0392b",
};

export default function Proveedores() {
  const [tab, setTab] = useState<"directorio" | "ordenes" | "cxp" | "estado">("directorio");

  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [materiasPrimas, setMateriasPrimas] = useState<MateriaPrima[]>([]);
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  const [itemsPorOrden, setItemsPorOrden] = useState<Record<number, ItemOC[]>>({});
  const [cuentas, setCuentas] = useState<CuentaPorPagar[]>([]);
  const [pagos, setPagos] = useState<PagoProveedor[]>([]);
  const [cargando, setCargando] = useState(true);

  // --- Modal de proveedor ---
  const [modalProv, setModalProv] = useState(false);
  const [editandoProv, setEditandoProv] = useState<string | null>(null);
  const [formProv, setFormProv] = useState<any>({});

  // --- Nueva orden de compra ---
  const [modalOC, setModalOC] = useState(false);
  const [formOC, setFormOC] = useState({
    proveedor_id: "", fecha: hoyISO(), fecha_estimada_entrega: "",
    incoterm: "", impuestos: 0, notas: "",
  });
  const [itemsNuevaOC, setItemsNuevaOC] = useState<ItemOC[]>([]);
  const [itemBorrador, setItemBorrador] = useState<any>({
    destino: "materia_prima", materia_prima_id: "", tabla_bodega: "cablesdb",
    sku_bodega: "", descripcion: "", unidad: "", cantidad: 0, precio_unitario: 0,
  });
  const [guardandoOC, setGuardandoOC] = useState(false);

  // --- Recepción ---
  const [modalRecepcion, setModalRecepcion] = useState<{ open: boolean; orden: OrdenCompra | null }>({ open: false, orden: null });
  const [numeroFactura, setNumeroFactura] = useState("");
  const [recibiendo, setRecibiendo] = useState(false);

  // --- Pago ---
  const [modalPago, setModalPago] = useState<{ open: boolean; cuenta: CuentaPorPagar | null }>({ open: false, cuenta: null });
  const [formPago, setFormPago] = useState({ monto: 0, metodo_pago: "Transferencia", referencia: "", fecha: hoyISO(), autor: "" });

  // --- Filtros ---
  const [buscarProv, setBuscarProv] = useState("");
  const [filtroEstadoCxp, setFiltroEstadoCxp] = useState("PENDIENTES");
  const [provEstadoCuenta, setProvEstadoCuenta] = useState("");

  useEffect(() => { cargarTodo(); }, []);

  /* ========================================================
     CARGA
     ======================================================== */

  const cargarTodo = async () => {
    if (!supabase) { setCargando(false); return; }
    setCargando(true);
    try {
      const [provRes, mpRes, ocRes, itemsRes, cxpRes, pagosRes] = await Promise.all([
        supabase.from("proveedores").select("*").order("nombre", { ascending: true }),
        supabase.from("materia_prima").select("id, codigo, nombre, unidad, stock_actual, categoria").eq("activo", true).order("codigo"),
        supabase.from("ordenes_compra").select("*").order("id", { ascending: false }),
        supabase.from("orden_compra_items").select("*"),
        supabase.from("cuentas_por_pagar").select("*").order("fecha_vencimiento", { ascending: true }),
        supabase.from("pagos_proveedor").select("*").order("fecha", { ascending: false }),
      ]);

      if (provRes.error) console.error("proveedores:", provRes.error.message);
      if (mpRes.error) console.error("materia_prima (¿corriste el SQL?):", mpRes.error.message);
      if (ocRes.error) console.error("ordenes_compra:", ocRes.error.message);
      if (cxpRes.error) console.error("cuentas_por_pagar:", cxpRes.error.message);

      setProveedores(provRes.data || []);
      setMateriasPrimas(mpRes.data || []);
      setOrdenes(ocRes.data || []);
      setCuentas(cxpRes.data || []);
      setPagos(pagosRes.data || []);

      const agrupado: Record<number, ItemOC[]> = {};
      (itemsRes.data || []).forEach((it: any) => {
        if (!agrupado[it.orden_id]) agrupado[it.orden_id] = [];
        agrupado[it.orden_id].push(it);
      });
      setItemsPorOrden(agrupado);
    } catch (err) {
      console.error("Error cargando abastecimiento:", err);
    } finally {
      setCargando(false);
    }
  };

  const auditar = async (accion: string, entidad: string, id: any, detalle: string) => {
    if (!supabase) return;
    try {
      await supabase.from("audit_log").insert([{
        accion, entidad, entidad_id: id != null ? String(id) : null, detalle, autor: null,
      }]);
    } catch { /* la auditoría nunca debe frenar la operación */ }
  };

  /* ========================================================
     SALDOS POR PROVEEDOR
     ======================================================== */

  const saldoPorProveedor = useMemo(() => {
    const m: Record<string, { saldo: number; vencido: number; facturas: number }> = {};
    cuentas.forEach((c) => {
      if (c.estado === "Pagada" || c.estado === "Anulada") return;
      const k = String(c.proveedor_id || "");
      if (!m[k]) m[k] = { saldo: 0, vencido: 0, facturas: 0 };
      m[k].saldo += Number(c.saldo_pendiente || 0);
      m[k].facturas += 1;
      if (diasVencido(c.fecha_vencimiento) > 0) m[k].vencido += Number(c.saldo_pendiente || 0);
    });
    return m;
  }, [cuentas]);

  const totalPorPagar = cuentas
    .filter((c) => c.estado !== "Pagada" && c.estado !== "Anulada")
    .reduce((a, c) => a + Number(c.saldo_pendiente || 0), 0);
  const totalVencido = cuentas
    .filter((c) => c.estado !== "Pagada" && c.estado !== "Anulada" && diasVencido(c.fecha_vencimiento) > 0)
    .reduce((a, c) => a + Number(c.saldo_pendiente || 0), 0);

  const agingGlobal = useMemo(() => {
    const cubetas: Record<string, number> = { Corriente: 0, "1-30": 0, "31-60": 0, "61-90": 0, "+90": 0 };
    cuentas.forEach((c) => {
      if (c.estado === "Pagada" || c.estado === "Anulada") return;
      cubetas[cubetaAging(c.fecha_vencimiento)] += Number(c.saldo_pendiente || 0);
    });
    return cubetas;
  }, [cuentas]);

  /* ========================================================
     PROVEEDORES
     ======================================================== */

  const abrirNuevoProv = () => {
    setEditandoProv(null);
    setFormProv({
      nombre: "", contacto: "", email: "", telefono: "", pais: "", tipo_insumo: "",
      condiciones_pago: "50% anticipo, 50% contra entrega", estado: "Activo", descripcion: "",
      ruc: "", direccion: "", limite_credito: 0, dias_credito: 30, moneda: "USD",
      banco: "", cuenta_bancaria: "", swift: "", incoterm: "FOB", calificacion: 0, notas_internas: "",
    });
    setModalProv(true);
  };

  const abrirEditarProv = (p: Proveedor) => {
    setEditandoProv(p.id);
    setFormProv({ ...p });
    setModalProv(true);
  };

  const guardarProveedor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    if (!formProv.nombre?.trim()) return alert("El nombre del proveedor es obligatorio.");

    const datos = {
      nombre: formProv.nombre, contacto: formProv.contacto, email: formProv.email,
      telefono: formProv.telefono, pais: formProv.pais, tipo_insumo: formProv.tipo_insumo,
      condiciones_pago: formProv.condiciones_pago, estado: formProv.estado,
      descripcion: formProv.descripcion, ruc: formProv.ruc, direccion: formProv.direccion,
      limite_credito: Number(formProv.limite_credito) || 0,
      dias_credito: Number(formProv.dias_credito) || 0,
      moneda: formProv.moneda || "USD", banco: formProv.banco,
      cuenta_bancaria: formProv.cuenta_bancaria, swift: formProv.swift,
      incoterm: formProv.incoterm, calificacion: Number(formProv.calificacion) || 0,
      notas_internas: formProv.notas_internas,
    };

    try {
      if (editandoProv) {
        const { error } = await supabase.from("proveedores").update(datos).eq("id", editandoProv);
        if (error) throw error;
        auditar("proveedor_editado", "proveedor", editandoProv, `Se actualizó el proveedor ${datos.nombre}.`);
      } else {
        const { error } = await supabase.from("proveedores").insert([datos]);
        if (error) throw error;
        auditar("proveedor_creado", "proveedor", null, `Se registró el proveedor ${datos.nombre}.`);
      }
      setModalProv(false);
      cargarTodo();
    } catch (err: any) {
      alert("Error al guardar el proveedor: " + (err.message || err));
    }
  };

  const eliminarProveedor = async (p: Proveedor) => {
    if (!supabase) return;
    const s = saldoPorProveedor[String(p.id)];
    if (s && s.saldo > 0) {
      return alert(`No se puede eliminar: ${p.nombre} tiene ${fmt(s.saldo)} pendiente de pago en ${s.facturas} factura(s).`);
    }
    if (!confirm(`¿Eliminar a ${p.nombre} del directorio?`)) return;
    const { error } = await supabase.from("proveedores").delete().eq("id", p.id);
    if (error) return alert("No se pudo eliminar: " + error.message);
    auditar("proveedor_eliminado", "proveedor", p.id, `Se eliminó el proveedor ${p.nombre}.`);
    cargarTodo();
  };

  /* ========================================================
     ÓRDENES DE COMPRA
     ======================================================== */

  const agregarItemBorrador = () => {
    const b = itemBorrador;
    const cantidad = Number(b.cantidad) || 0;
    const precio = Number(b.precio_unitario) || 0;
    if (cantidad <= 0) return alert("La cantidad debe ser mayor a cero.");

    let descripcion = b.descripcion;
    let unidad = b.unidad;
    let materia_prima_id: number | null = null;
    let tabla_bodega: string | null = null;
    let sku_bodega: string | null = null;

    if (b.destino === "materia_prima") {
      if (!b.materia_prima_id) return alert("Selecciona el insumo de materia prima.");
      materia_prima_id = Number(b.materia_prima_id);
      const mp = materiasPrimas.find((m) => m.id === materia_prima_id);
      descripcion = mp ? `${mp.codigo} — ${mp.nombre}` : descripcion;
      unidad = mp?.unidad || unidad;
    } else {
      if (!b.sku_bodega?.trim()) return alert("Escribe el SKU del producto de bodega.");
      tabla_bodega = b.tabla_bodega;
      sku_bodega = b.sku_bodega.trim();
      descripcion = descripcion || sku_bodega;
      unidad = unidad || "und";
    }

    setItemsNuevaOC((prev) => [...prev, {
      destino: b.destino, materia_prima_id, tabla_bodega, sku_bodega,
      descripcion, unidad, cantidad, precio_unitario: precio,
      total: Number((cantidad * precio).toFixed(2)),
    }]);

    setItemBorrador({
      destino: b.destino, materia_prima_id: "", tabla_bodega: b.tabla_bodega,
      sku_bodega: "", descripcion: "", unidad: "", cantidad: 0, precio_unitario: 0,
    });
  };

  const subtotalNuevaOC = itemsNuevaOC.reduce((a, i) => a + Number(i.total || 0), 0);
  const totalNuevaOC = subtotalNuevaOC + (Number(formOC.impuestos) || 0);

  const guardarOrdenCompra = async () => {
    if (!supabase) return;
    if (!formOC.proveedor_id) return alert("Selecciona el proveedor.");
    if (itemsNuevaOC.length === 0) return alert("Agrega al menos un renglón a la orden.");

    const prov = proveedores.find((p) => String(p.id) === String(formOC.proveedor_id));
    setGuardandoOC(true);
    try {
      const numero = "OC-" + Date.now().toString().slice(-8);
      const { data: oc, error } = await supabase.from("ordenes_compra").insert([{
        numero,
        proveedor_id: String(formOC.proveedor_id),
        proveedor_nombre: prov?.nombre || null,
        fecha: formOC.fecha || hoyISO(),
        fecha_estimada_entrega: formOC.fecha_estimada_entrega || null,
        estado: "Enviada",
        moneda: prov?.moneda || "USD",
        subtotal: subtotalNuevaOC,
        impuestos: Number(formOC.impuestos) || 0,
        total: totalNuevaOC,
        incoterm: formOC.incoterm || prov?.incoterm || null,
        notas: formOC.notas || null,
      }]).select().single();

      if (error) throw error;

      const filas = itemsNuevaOC.map((i) => ({
        orden_id: oc.id, destino: i.destino, materia_prima_id: i.materia_prima_id,
        tabla_bodega: i.tabla_bodega, sku_bodega: i.sku_bodega, descripcion: i.descripcion,
        unidad: i.unidad, cantidad: i.cantidad, cantidad_recibida: 0,
        precio_unitario: i.precio_unitario, total: i.total,
      }));
      const { error: errItems } = await supabase.from("orden_compra_items").insert(filas);
      if (errItems) throw errItems;

      auditar("oc_creada", "orden_compra", oc.id,
        `Orden ${numero} a ${prov?.nombre || "proveedor"} por ${fmt(totalNuevaOC)}.`);

      setModalOC(false);
      setItemsNuevaOC([]);
      setFormOC({ proveedor_id: "", fecha: hoyISO(), fecha_estimada_entrega: "", incoterm: "", impuestos: 0, notas: "" });
      cargarTodo();
      alert(`Orden ${numero} creada.`);
    } catch (err: any) {
      alert("Error al crear la orden: " + (err.message || err));
    } finally {
      setGuardandoOC(false);
    }
  };

  const cambiarEstadoOC = async (orden: OrdenCompra, estado: string) => {
    if (!supabase) return;
    const { error } = await supabase.from("ordenes_compra").update({ estado }).eq("id", orden.id);
    if (error) return alert("Error: " + error.message);
    setOrdenes((prev) => prev.map((o) => (o.id === orden.id ? { ...o, estado } : o)));
    auditar("oc_estado", "orden_compra", orden.id, `${orden.numero} pasó a "${estado}".`);
  };

  /**
   * RECEPCIÓN — el momento clave de toda la cadena.
   * Un solo evento produce tres efectos:
   *   1. Suma el stock en materia prima o en la tabla de bodega
   *   2. Deja el movimiento registrado para auditoría
   *   3. Crea la cuenta por pagar con su fecha de vencimiento,
   *      calculada según los días de crédito del proveedor
   */
  const recibirOrden = async () => {
    const orden = modalRecepcion.orden;
    if (!orden || !supabase) return;

    const items = itemsPorOrden[orden.id] || [];
    if (items.length === 0) return alert("Esta orden no tiene renglones.");

    setRecibiendo(true);
    const errores: string[] = [];

    try {
      for (const item of items) {
        const cantidad = Number(item.cantidad || 0);

        if (item.destino === "materia_prima" && item.materia_prima_id) {
          const { data: mp } = await supabase
            .from("materia_prima").select("stock_actual, unidad, codigo")
            .eq("id", item.materia_prima_id).maybeSingle();

          const anterior = Number(mp?.stock_actual || 0);
          const nuevo = anterior + cantidad;

          const { error } = await supabase.from("materia_prima")
            .update({ stock_actual: nuevo }).eq("id", item.materia_prima_id);
          if (error) { errores.push(`${item.descripcion}: ${error.message}`); continue; }

          await supabase.from("movimientos_inventario").insert([{
            tipo: "entrada", origen: "compra", referencia_id: String(orden.id),
            destino: "materia_prima", materia_prima_id: item.materia_prima_id,
            descripcion: item.descripcion, cantidad_anterior: anterior,
            cantidad, cantidad_nueva: nuevo, unidad: item.unidad || mp?.unidad || null,
            motivo: `Recepción de orden ${orden.numero}`,
          }]);

        } else if (item.destino === "bodega" && item.tabla_bodega && item.sku_bodega) {
          const { data: prod } = await supabase
            .from(item.tabla_bodega).select("id, cantidad")
            .or(`SKU.eq.${item.sku_bodega},sku.eq.${item.sku_bodega}`).maybeSingle();

          if (!prod) {
            errores.push(`${item.sku_bodega}: no existe en ${item.tabla_bodega}`);
            continue;
          }

          const anterior = Number(prod.cantidad || 0);
          const nuevo = anterior + cantidad;

          const { error } = await supabase.from(item.tabla_bodega)
            .update({ cantidad: nuevo }).eq("id", prod.id);
          if (error) { errores.push(`${item.sku_bodega}: ${error.message}`); continue; }

          await supabase.from("movimientos_inventario").insert([{
            tipo: "entrada", origen: "compra", referencia_id: String(orden.id),
            destino: "bodega", tabla_bodega: item.tabla_bodega, sku_bodega: item.sku_bodega,
            descripcion: item.descripcion, cantidad_anterior: anterior,
            cantidad, cantidad_nueva: nuevo, unidad: item.unidad || "und",
            motivo: `Recepción de orden ${orden.numero}`,
          }]);
        }

        await supabase.from("orden_compra_items")
          .update({ cantidad_recibida: cantidad }).eq("id", item.id);
      }

      // Fecha de vencimiento según los días de crédito pactados
      const prov = proveedores.find((p) => String(p.id) === String(orden.proveedor_id));
      const dias = Number(prov?.dias_credito || 0);
      const venc = new Date();
      venc.setDate(venc.getDate() + dias);

      const { error: errCxp } = await supabase.from("cuentas_por_pagar").insert([{
        proveedor_id: orden.proveedor_id,
        proveedor_nombre: orden.proveedor_nombre,
        orden_id: orden.id,
        numero_factura: numeroFactura || orden.numero,
        fecha_emision: hoyISO(),
        fecha_vencimiento: venc.toISOString().slice(0, 10),
        moneda: orden.moneda || "USD",
        monto_total: Number(orden.total || 0),
        saldo_pendiente: Number(orden.total || 0),
        estado: "Pendiente",
        notas: `Generada por recepción de ${orden.numero}`,
      }]);
      if (errCxp) errores.push("Cuenta por pagar: " + errCxp.message);

      await supabase.from("ordenes_compra")
        .update({ estado: "Recibida", fecha_recepcion: new Date().toISOString() })
        .eq("id", orden.id);

      auditar("oc_recibida", "orden_compra", orden.id,
        `Se recibió ${orden.numero}. Stock actualizado y cuenta por pagar de ${fmt(orden.total)} generada.`);

      setModalRecepcion({ open: false, orden: null });
      setNumeroFactura("");
      cargarTodo();

      if (errores.length > 0) {
        alert("Recepción completada con avisos:\n\n" + errores.join("\n"));
      } else {
        alert(`Recepción registrada. Stock actualizado y cuenta por pagar de ${fmt(orden.total)} creada con vencimiento a ${dias} días.`);
      }
    } catch (err: any) {
      alert("Error en la recepción: " + (err.message || err));
    } finally {
      setRecibiendo(false);
    }
  };

  /* ========================================================
     PAGOS
     ======================================================== */

  const abrirPago = (c: CuentaPorPagar) => {
    setModalPago({ open: true, cuenta: c });
    setFormPago({ monto: Number(c.saldo_pendiente || 0), metodo_pago: "Transferencia", referencia: "", fecha: hoyISO(), autor: "" });
  };

  const registrarPago = async () => {
    const c = modalPago.cuenta;
    if (!c || !supabase) return;
    const monto = Number(formPago.monto) || 0;
    if (monto <= 0) return alert("El monto debe ser mayor a cero.");
    if (monto > Number(c.saldo_pendiente) + 0.01) {
      return alert(`El monto supera el saldo pendiente (${fmt(c.saldo_pendiente)}).`);
    }

    try {
      const { error } = await supabase.from("pagos_proveedor").insert([{
        cuenta_por_pagar_id: c.id, proveedor_id: c.proveedor_id, fecha: formPago.fecha,
        monto, metodo_pago: formPago.metodo_pago, referencia: formPago.referencia || null,
        autor: formPago.autor || null,
      }]);
      if (error) throw error;

      const nuevoSaldo = Number((Number(c.saldo_pendiente) - monto).toFixed(2));
      const nuevoEstado = nuevoSaldo <= 0.009 ? "Pagada" : "Parcial";

      const { error: errUpd } = await supabase.from("cuentas_por_pagar")
        .update({ saldo_pendiente: Math.max(0, nuevoSaldo), estado: nuevoEstado })
        .eq("id", c.id);
      if (errUpd) throw errUpd;

      auditar("pago_proveedor", "cuenta_por_pagar", c.id,
        `Pago de ${fmt(monto)} a ${c.proveedor_nombre}. Saldo: ${fmt(Math.max(0, nuevoSaldo))}.`);

      setModalPago({ open: false, cuenta: null });
      cargarTodo();
    } catch (err: any) {
      alert("Error al registrar el pago: " + (err.message || err));
    }
  };

  /* ========================================================
     DERIVADOS
     ======================================================== */

  const proveedoresFiltrados = proveedores.filter((p) => {
    const q = buscarProv.toLowerCase().trim();
    if (!q) return true;
    return [p.nombre, p.contacto, p.email, p.pais, p.tipo_insumo, p.ruc]
      .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
  });

  const cuentasFiltradas = cuentas.filter((c) => {
    if (filtroEstadoCxp === "PENDIENTES") return c.estado !== "Pagada" && c.estado !== "Anulada";
    if (filtroEstadoCxp === "VENCIDAS") return c.estado !== "Pagada" && c.estado !== "Anulada" && diasVencido(c.fecha_vencimiento) > 0;
    if (filtroEstadoCxp === "PAGADAS") return c.estado === "Pagada";
    return true;
  });

  const provSel = proveedores.find((p) => String(p.id) === String(provEstadoCuenta));
  const cuentasProvSel = cuentas.filter((c) => String(c.proveedor_id) === String(provEstadoCuenta));
  const ordenesProvSel = ordenes.filter((o) => String(o.proveedor_id) === String(provEstadoCuenta));
  const pagosProvSel = pagos.filter((p) => String(p.proveedor_id) === String(provEstadoCuenta));

  const agingProvSel = useMemo(() => {
    const c: Record<string, number> = { Corriente: 0, "1-30": 0, "31-60": 0, "61-90": 0, "+90": 0 };
    cuentasProvSel.forEach((x) => {
      if (x.estado === "Pagada" || x.estado === "Anulada") return;
      c[cubetaAging(x.fecha_vencimiento)] += Number(x.saldo_pendiente || 0);
    });
    return c;
  }, [cuentasProvSel]);

  /* ========================================================
     RENDER
     ======================================================== */

  return (
    <div style={{ backgroundColor: "#000", minHeight: "100vh", display: "flex", color: "#DAA520", fontFamily: "sans-serif" }}>
      <Sidebar currentActive="proveedores" />

      <div style={{ flex: 1, padding: "35px 30px", overflowY: "auto", boxSizing: "border-box" }}>
        <style jsx global>{`
          .pv-card { background:#080808; border:1px solid rgba(218,165,32,0.3); border-radius:12px; padding:22px; }
          .pv-kpi { background:#0d0d0d; border:1px solid rgba(218,165,32,0.3); border-radius:10px; padding:18px; }
          .pv-tab { background:transparent; color:#DAA520; border:1px solid rgba(218,165,32,0.5); padding:10px 18px;
                    border-radius:8px; font-weight:600; font-size:0.78rem; letter-spacing:0.8px; cursor:pointer; transition:all .25s; }
          .pv-tab:hover, .pv-tab.on { background:#DAA520; color:#000; }
          .pv-gold { background:#DAA520; color:#000; border:none; padding:10px 18px; border-radius:6px;
                     font-weight:700; font-size:0.78rem; cursor:pointer; }
          .pv-gold:disabled { opacity:.5; cursor:not-allowed; }
          .pv-mini { background:transparent; color:#DAA520; border:1px solid rgba(218,165,32,0.45);
                     padding:5px 10px; border-radius:5px; font-size:0.7rem; font-weight:600; cursor:pointer; white-space:nowrap; }
          .pv-mini:hover { background:rgba(218,165,32,0.15); }
          .pv-verde { background:transparent; color:#2ecc71; border:1px solid rgba(46,204,113,0.5);
                      padding:5px 10px; border-radius:5px; font-size:0.7rem; font-weight:600; cursor:pointer; white-space:nowrap; }
          .pv-verde:hover { background:rgba(46,204,113,0.15); }
          .pv-rojo { background:transparent; color:#e74c3c; border:1px solid rgba(231,76,60,0.45);
                     padding:5px 10px; border-radius:5px; font-size:0.7rem; font-weight:600; cursor:pointer; }
          .pv-tabla { width:100%; border-collapse:collapse; font-size:0.82rem; }
          .pv-tabla th { background:#0a0a0a; color:#DAA520; text-transform:uppercase; font-size:0.68rem;
                         letter-spacing:1px; padding:11px 10px; text-align:left; border-bottom:1px solid rgba(218,165,32,0.35); }
          .pv-tabla td { padding:11px 10px; color:#fff; border-bottom:1px solid #141414; }
          .pv-in { width:100%; background:#050505; color:#DAA520; border:1px solid rgba(218,165,32,0.4);
                   padding:9px 11px; border-radius:6px; outline:none; font-size:0.82rem; box-sizing:border-box; font-family:inherit; }
          .pv-lb { display:block; font-size:0.66rem; color:rgba(255,255,255,0.55); margin-bottom:5px;
                   text-transform:uppercase; letter-spacing:0.5px; }
          .pv-ov { position:fixed; inset:0; background:rgba(0,0,0,0.85); display:flex; align-items:center;
                   justify-content:center; z-index:1000; padding:20px; }
          .pv-md { background:#111; border:1px solid rgba(218,165,32,0.5); border-radius:12px; padding:26px;
                   width:100%; max-height:90vh; overflow-y:auto; }
        `}</style>

        <div style={{ marginBottom: "25px", borderBottom: "1px solid rgba(218,165,32,0.3)", paddingBottom: "18px" }}>
          <h1 style={{ fontSize: "1.55rem", color: "#DAA520", textTransform: "uppercase", letterSpacing: "1.2px", margin: "0 0 6px 0", fontWeight: 700 }}>
            Proveedores y Abastecimiento
          </h1>
          <p style={{ color: "#888", fontSize: "0.82rem", margin: "0 0 18px 0" }}>
            Directorio de fábricas, órdenes de compra, cuentas por pagar y control de crédito.
          </p>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button onClick={() => setTab("directorio")} className={`pv-tab ${tab === "directorio" ? "on" : ""}`}>🏭 Directorio</button>
            <button onClick={() => setTab("ordenes")} className={`pv-tab ${tab === "ordenes" ? "on" : ""}`}>📋 Órdenes de Compra</button>
            <button onClick={() => setTab("cxp")} className={`pv-tab ${tab === "cxp" ? "on" : ""}`}>💸 Cuentas por Pagar</button>
            <button onClick={() => setTab("estado")} className={`pv-tab ${tab === "estado" ? "on" : ""}`}>📑 Estado de Cuenta</button>
          </div>
        </div>

        {/* KPIs globales */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "15px", marginBottom: "25px" }}>
          <div className="pv-kpi">
            <span className="pv-lb">Total por Pagar</span>
            <h2 style={{ color: "#e74c3c", fontSize: "1.5rem", margin: "6px 0 0 0", fontWeight: 400 }}>{fmt(totalPorPagar)}</h2>
          </div>
          <div className="pv-kpi">
            <span className="pv-lb">Saldo Vencido</span>
            <h2 style={{ color: totalVencido > 0 ? "#c0392b" : "#2ecc71", fontSize: "1.5rem", margin: "6px 0 0 0", fontWeight: 400 }}>{fmt(totalVencido)}</h2>
          </div>
          <div className="pv-kpi">
            <span className="pv-lb">Proveedores Activos</span>
            <h2 style={{ color: "#DAA520", fontSize: "1.5rem", margin: "6px 0 0 0", fontWeight: 400 }}>
              {proveedores.filter((p) => p.estado === "Activo").length}
            </h2>
          </div>
          <div className="pv-kpi">
            <span className="pv-lb">Órdenes Abiertas</span>
            <h2 style={{ color: "#DAA520", fontSize: "1.5rem", margin: "6px 0 0 0", fontWeight: 400 }}>
              {ordenes.filter((o) => o.estado !== "Recibida" && o.estado !== "Cancelada").length}
            </h2>
          </div>
        </div>

        {cargando ? (
          <div className="pv-card" style={{ textAlign: "center", padding: "40px" }}>
            <p style={{ color: "#888" }}>Cargando información de abastecimiento...</p>
          </div>
        ) : (
          <>
            {/* ============ DIRECTORIO ============ */}
            {tab === "directorio" && (
              <div className="pv-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
                  <h3 style={{ color: "#DAA520", fontSize: "1rem", textTransform: "uppercase", margin: 0 }}>
                    Directorio de Fábricas ({proveedoresFiltrados.length})
                  </h3>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <input className="pv-in" style={{ width: "250px" }} placeholder="Buscar por nombre, país, RUC..."
                      value={buscarProv} onChange={(e) => setBuscarProv(e.target.value)} />
                    <button onClick={abrirNuevoProv} className="pv-gold">+ Nuevo Proveedor</button>
                  </div>
                </div>

                {proveedoresFiltrados.length === 0 ? (
                  <p style={{ color: "#777", textAlign: "center", padding: "30px" }}>No hay proveedores registrados.</p>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table className="pv-tabla">
                      <thead>
                        <tr>
                          <th>Fábrica / Empresa</th><th>Contacto / País</th><th>Insumo</th>
                          <th>Crédito</th><th>Saldo Actual</th><th>Disponible</th><th>Estado</th><th style={{ textAlign: "right" }}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {proveedoresFiltrados.map((p) => {
                          const s = saldoPorProveedor[String(p.id)] || { saldo: 0, vencido: 0, facturas: 0 };
                          const limite = Number(p.limite_credito || 0);
                          const disponible = limite - s.saldo;
                          const excedido = limite > 0 && disponible < 0;
                          return (
                            <tr key={p.id}>
                              <td>
                                <div style={{ color: "#DAA520", fontWeight: 700 }}>{p.nombre}</div>
                                <div style={{ fontSize: "0.72rem", color: "#777" }}>{p.email} {p.telefono ? `| ${p.telefono}` : ""}</div>
                                {p.ruc && <div style={{ fontSize: "0.7rem", color: "#666" }}>RUC: {p.ruc}</div>}
                              </td>
                              <td>
                                <div>{p.contacto || "—"}</div>
                                <div style={{ fontSize: "0.72rem", color: "#DAA520" }}>📍 {p.pais || "Internacional"}</div>
                              </td>
                              <td style={{ fontSize: "0.76rem" }}>{p.tipo_insumo || "General"}</td>
                              <td style={{ fontSize: "0.76rem" }}>
                                {limite > 0 ? fmt(limite) : <span style={{ color: "#666" }}>Sin línea</span>}
                                <div style={{ fontSize: "0.68rem", color: "#777" }}>{p.dias_credito || 0} días</div>
                              </td>
                              <td>
                                <span style={{ color: s.saldo > 0 ? "#e74c3c" : "#2ecc71", fontWeight: 600 }}>{fmt(s.saldo)}</span>
                                {s.vencido > 0 && (
                                  <div style={{ fontSize: "0.68rem", color: "#c0392b" }}>Vencido {fmt(s.vencido)}</div>
                                )}
                              </td>
                              <td>
                                {limite > 0 ? (
                                  <span style={{ color: excedido ? "#c0392b" : "#2ecc71", fontWeight: 600 }}>
                                    {fmt(disponible)}{excedido ? " ⚠" : ""}
                                  </span>
                                ) : <span style={{ color: "#666" }}>—</span>}
                              </td>
                              <td>
                                <span style={{ color: p.estado === "Activo" ? "#2ecc71" : "#e74c3c", fontWeight: 700, fontSize: "0.78rem" }}>
                                  ● {p.estado || "Activo"}
                                </span>
                              </td>
                              <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                <button className="pv-mini" style={{ marginRight: "5px" }} onClick={() => abrirEditarProv(p)}>Editar</button>
                                <button className="pv-mini" style={{ marginRight: "5px" }}
                                  onClick={() => { setProvEstadoCuenta(String(p.id)); setTab("estado"); }}>Estado</button>
                                <button className="pv-rojo" onClick={() => eliminarProveedor(p)}>Eliminar</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ============ ÓRDENES DE COMPRA ============ */}
            {tab === "ordenes" && (
              <div className="pv-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <h3 style={{ color: "#DAA520", fontSize: "1rem", textTransform: "uppercase", margin: 0 }}>
                    Órdenes de Compra ({ordenes.length})
                  </h3>
                  <button onClick={() => setModalOC(true)} className="pv-gold">+ Nueva Orden</button>
                </div>

                {ordenes.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "30px" }}>
                    <p style={{ color: "#777", marginBottom: "6px" }}>No hay órdenes de compra todavía.</p>
                    <p style={{ color: "#555", fontSize: "0.78rem" }}>
                      La orden de compra es el documento que conecta al proveedor con el inventario y con la deuda.
                    </p>
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table className="pv-tabla">
                      <thead>
                        <tr>
                          <th>Orden</th><th>Proveedor</th><th>Fecha</th><th>Entrega Est.</th>
                          <th>Renglones</th><th style={{ textAlign: "right" }}>Total</th><th>Estado</th><th style={{ textAlign: "right" }}>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ordenes.map((o) => {
                          const items = itemsPorOrden[o.id] || [];
                          const recibida = o.estado === "Recibida";
                          return (
                            <tr key={o.id}>
                              <td style={{ color: "#DAA520", fontWeight: 700 }}>{o.numero}</td>
                              <td>{o.proveedor_nombre || "—"}</td>
                              <td style={{ fontSize: "0.76rem", color: "#aaa" }}>{o.fecha ? new Date(o.fecha).toLocaleDateString() : "—"}</td>
                              <td style={{ fontSize: "0.76rem", color: "#aaa" }}>{o.fecha_estimada_entrega ? new Date(o.fecha_estimada_entrega).toLocaleDateString() : "—"}</td>
                              <td style={{ fontSize: "0.76rem" }}>
                                {items.length} ítem(s)
                                <div style={{ fontSize: "0.68rem", color: "#777" }}>
                                  {items.filter((i) => i.destino === "materia_prima").length} MP · {items.filter((i) => i.destino === "bodega").length} bodega
                                </div>
                              </td>
                              <td style={{ textAlign: "right", color: "#DAA520", fontWeight: 600 }}>{fmt(o.total)}</td>
                              <td>
                                <select className="pv-in" style={{ width: "auto", padding: "5px 8px", fontSize: "0.72rem" }}
                                  value={o.estado} disabled={recibida}
                                  onChange={(e) => cambiarEstadoOC(o, e.target.value)}>
                                  {ESTADOS_OC.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                              </td>
                              <td style={{ textAlign: "right" }}>
                                {recibida ? (
                                  <span style={{ color: "#2ecc71", fontSize: "0.72rem" }}>✓ Recibida</span>
                                ) : o.estado === "Cancelada" ? (
                                  <span style={{ color: "#666", fontSize: "0.72rem" }}>Cancelada</span>
                                ) : (
                                  <button className="pv-verde" onClick={() => { setModalRecepcion({ open: true, orden: o }); setNumeroFactura(o.numero || ""); }}>
                                    📦 Recibir
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ============ CUENTAS POR PAGAR ============ */}
            {tab === "cxp" && (
              <div>
                {/* Antigüedad de saldos */}
                <div className="pv-card" style={{ marginBottom: "22px" }}>
                  <h3 style={{ color: "#DAA520", fontSize: "0.95rem", textTransform: "uppercase", marginTop: 0, marginBottom: "6px" }}>
                    Antigüedad de Saldos
                  </h3>
                  <p style={{ color: "#777", fontSize: "0.75rem", margin: "0 0 16px 0" }}>
                    Cuánto debes y hace cuánto venció. Corriente todavía no vence; el resto son días de atraso.
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px" }}>
                    {Object.entries(agingGlobal).map(([cubeta, monto]) => (
                      <div key={cubeta} style={{ background: "#050505", border: `1px solid ${COLOR_AGING[cubeta]}44`, borderRadius: "8px", padding: "14px" }}>
                        <div style={{ fontSize: "0.66rem", color: "#888", textTransform: "uppercase", marginBottom: "5px" }}>
                          {cubeta === "Corriente" ? "Corriente" : `${cubeta} días`}
                        </div>
                        <div style={{ color: COLOR_AGING[cubeta], fontSize: "1.05rem", fontWeight: 700 }}>{fmt(monto)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pv-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "14px" }}>
                    <h3 style={{ color: "#DAA520", fontSize: "1rem", textTransform: "uppercase", margin: 0 }}>
                      Gestión de Cuentas por Pagar ({cuentasFiltradas.length})
                    </h3>
                    <select className="pv-in" style={{ width: "auto" }} value={filtroEstadoCxp} onChange={(e) => setFiltroEstadoCxp(e.target.value)}>
                      <option value="PENDIENTES">Pendientes</option>
                      <option value="VENCIDAS">Solo vencidas</option>
                      <option value="PAGADAS">Pagadas</option>
                      <option value="TODAS">Todas</option>
                    </select>
                  </div>

                  {cuentasFiltradas.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "30px" }}>
                      <p style={{ color: "#777", marginBottom: "6px" }}>No hay cuentas que coincidan con el filtro.</p>
                      <p style={{ color: "#555", fontSize: "0.78rem" }}>
                        Las cuentas por pagar se crean solas al recibir una orden de compra.
                      </p>
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table className="pv-tabla">
                        <thead>
                          <tr>
                            <th>Factura / Orden</th><th>Proveedor</th><th>Emisión</th><th>Vencimiento</th>
                            <th style={{ textAlign: "right" }}>Monto Total</th><th style={{ textAlign: "right" }}>Saldo</th>
                            <th>Antigüedad</th><th>Estado</th><th style={{ textAlign: "right" }}>Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cuentasFiltradas.map((c) => {
                            const d = diasVencido(c.fecha_vencimiento);
                            const cub = cubetaAging(c.fecha_vencimiento);
                            const saldada = c.estado === "Pagada";
                            return (
                              <tr key={c.id}>
                                <td style={{ color: "#DAA520", fontWeight: 600 }}>{c.numero_factura || `CXP-${c.id}`}</td>
                                <td>{c.proveedor_nombre || "—"}</td>
                                <td style={{ fontSize: "0.76rem", color: "#aaa" }}>{new Date(c.fecha_emision).toLocaleDateString()}</td>
                                <td style={{ fontSize: "0.76rem", color: d > 0 && !saldada ? "#e74c3c" : "#aaa" }}>
                                  {c.fecha_vencimiento ? new Date(c.fecha_vencimiento).toLocaleDateString() : "—"}
                                  {!saldada && d > 0 && <div style={{ fontSize: "0.66rem", color: "#c0392b" }}>{d} días vencido</div>}
                                  {!saldada && d <= 0 && c.fecha_vencimiento && <div style={{ fontSize: "0.66rem", color: "#777" }}>faltan {Math.abs(d)} días</div>}
                                </td>
                                <td style={{ textAlign: "right" }}>{fmt(c.monto_total)}</td>
                                <td style={{ textAlign: "right", color: saldada ? "#2ecc71" : "#e74c3c", fontWeight: 700 }}>{fmt(c.saldo_pendiente)}</td>
                                <td>
                                  {saldada ? <span style={{ color: "#666", fontSize: "0.72rem" }}>—</span> : (
                                    <span style={{ padding: "3px 9px", borderRadius: "10px", fontSize: "0.68rem", fontWeight: 600,
                                      background: `${COLOR_AGING[cub]}22`, color: COLOR_AGING[cub], border: `1px solid ${COLOR_AGING[cub]}55` }}>
                                      {cub === "Corriente" ? "Corriente" : `${cub} d`}
                                    </span>
                                  )}
                                </td>
                                <td>
                                  <span style={{ fontSize: "0.72rem", fontWeight: 600,
                                    color: saldada ? "#2ecc71" : c.estado === "Parcial" ? "#f1c40f" : "#e74c3c" }}>
                                    {c.estado}
                                  </span>
                                </td>
                                <td style={{ textAlign: "right" }}>
                                  {saldada ? <span style={{ color: "#2ecc71", fontSize: "0.72rem" }}>✓</span> : (
                                    <button className="pv-verde" onClick={() => abrirPago(c)}>💵 Pagar</button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ============ ESTADO DE CUENTA ============ */}
            {tab === "estado" && (
              <div>
                <div className="pv-card" style={{ marginBottom: "22px" }}>
                  <label className="pv-lb">Seleccionar proveedor</label>
                  <select className="pv-in" style={{ maxWidth: "420px" }} value={provEstadoCuenta} onChange={(e) => setProvEstadoCuenta(e.target.value)}>
                    <option value="">— Elige un proveedor —</option>
                    {proveedores.map((p) => <option key={p.id} value={String(p.id)}>{p.nombre}</option>)}
                  </select>
                </div>

                {!provSel ? (
                  <div className="pv-card" style={{ textAlign: "center", padding: "40px" }}>
                    <p style={{ color: "#777" }}>Elige un proveedor para ver su estado de cuenta completo.</p>
                  </div>
                ) : (
                  <>
                    <div className="pv-card" style={{ marginBottom: "22px" }}>
                      <h3 style={{ color: "#DAA520", fontSize: "1.05rem", marginTop: 0, marginBottom: "14px" }}>{provSel.nombre}</h3>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "16px", fontSize: "0.82rem" }}>
                        <div><span className="pv-lb">Contacto</span><strong style={{ color: "#fff" }}>{provSel.contacto || "—"}</strong></div>
                        <div><span className="pv-lb">País</span><strong style={{ color: "#fff" }}>{provSel.pais || "—"}</strong></div>
                        <div><span className="pv-lb">Condiciones</span><strong style={{ color: "#fff" }}>{provSel.condiciones_pago || "—"}</strong></div>
                        <div><span className="pv-lb">Días de crédito</span><strong style={{ color: "#DAA520" }}>{provSel.dias_credito || 0}</strong></div>
                        <div><span className="pv-lb">Límite de crédito</span><strong style={{ color: "#DAA520" }}>{fmt(provSel.limite_credito)}</strong></div>
                        <div><span className="pv-lb">Incoterm</span><strong style={{ color: "#fff" }}>{provSel.incoterm || "—"}</strong></div>
                        {provSel.banco && <div><span className="pv-lb">Banco</span><strong style={{ color: "#fff" }}>{provSel.banco}</strong></div>}
                        {provSel.cuenta_bancaria && <div><span className="pv-lb">Cuenta</span><strong style={{ color: "#fff" }}>{provSel.cuenta_bancaria}</strong></div>}
                      </div>
                    </div>

                    <div className="pv-card" style={{ marginBottom: "22px" }}>
                      <h4 style={{ color: "#DAA520", fontSize: "0.9rem", textTransform: "uppercase", marginTop: 0, marginBottom: "14px" }}>
                        Antigüedad de su Saldo
                      </h4>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "10px" }}>
                        {Object.entries(agingProvSel).map(([cub, monto]) => (
                          <div key={cub} style={{ background: "#050505", border: `1px solid ${COLOR_AGING[cub]}44`, borderRadius: "8px", padding: "12px" }}>
                            <div style={{ fontSize: "0.64rem", color: "#888", textTransform: "uppercase", marginBottom: "4px" }}>
                              {cub === "Corriente" ? "Corriente" : `${cub} días`}
                            </div>
                            <div style={{ color: COLOR_AGING[cub], fontSize: "0.95rem", fontWeight: 700 }}>{fmt(monto)}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pv-card" style={{ marginBottom: "22px" }}>
                      <h4 style={{ color: "#DAA520", fontSize: "0.9rem", textTransform: "uppercase", marginTop: 0, marginBottom: "10px" }}>
                        Facturas ({cuentasProvSel.length})
                      </h4>
                      {cuentasProvSel.length === 0 ? (
                        <p style={{ color: "#777", fontSize: "0.8rem", textAlign: "center", padding: "14px" }}>Sin facturas registradas.</p>
                      ) : (
                        <table className="pv-tabla">
                          <thead><tr><th>Factura</th><th>Emisión</th><th>Vencimiento</th><th style={{ textAlign: "right" }}>Total</th><th style={{ textAlign: "right" }}>Saldo</th><th>Estado</th></tr></thead>
                          <tbody>
                            {cuentasProvSel.map((c) => (
                              <tr key={c.id}>
                                <td style={{ color: "#DAA520" }}>{c.numero_factura || `CXP-${c.id}`}</td>
                                <td style={{ fontSize: "0.76rem", color: "#aaa" }}>{new Date(c.fecha_emision).toLocaleDateString()}</td>
                                <td style={{ fontSize: "0.76rem", color: "#aaa" }}>{c.fecha_vencimiento ? new Date(c.fecha_vencimiento).toLocaleDateString() : "—"}</td>
                                <td style={{ textAlign: "right" }}>{fmt(c.monto_total)}</td>
                                <td style={{ textAlign: "right", color: c.estado === "Pagada" ? "#2ecc71" : "#e74c3c", fontWeight: 600 }}>{fmt(c.saldo_pendiente)}</td>
                                <td style={{ fontSize: "0.74rem" }}>{c.estado}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "22px" }}>
                      <div className="pv-card">
                        <h4 style={{ color: "#DAA520", fontSize: "0.9rem", textTransform: "uppercase", marginTop: 0, marginBottom: "10px" }}>
                          Órdenes ({ordenesProvSel.length})
                        </h4>
                        {ordenesProvSel.length === 0 ? (
                          <p style={{ color: "#777", fontSize: "0.8rem", textAlign: "center", padding: "14px" }}>Sin órdenes.</p>
                        ) : (
                          <table className="pv-tabla">
                            <thead><tr><th>Orden</th><th>Fecha</th><th style={{ textAlign: "right" }}>Total</th><th>Estado</th></tr></thead>
                            <tbody>
                              {ordenesProvSel.map((o) => (
                                <tr key={o.id}>
                                  <td style={{ color: "#DAA520" }}>{o.numero}</td>
                                  <td style={{ fontSize: "0.76rem", color: "#aaa" }}>{new Date(o.fecha).toLocaleDateString()}</td>
                                  <td style={{ textAlign: "right" }}>{fmt(o.total)}</td>
                                  <td style={{ fontSize: "0.74rem" }}>{o.estado}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>

                      <div className="pv-card">
                        <h4 style={{ color: "#DAA520", fontSize: "0.9rem", textTransform: "uppercase", marginTop: 0, marginBottom: "10px" }}>
                          Pagos ({pagosProvSel.length})
                        </h4>
                        {pagosProvSel.length === 0 ? (
                          <p style={{ color: "#777", fontSize: "0.8rem", textAlign: "center", padding: "14px" }}>Sin pagos registrados.</p>
                        ) : (
                          <table className="pv-tabla">
                            <thead><tr><th>Fecha</th><th>Método</th><th>Referencia</th><th style={{ textAlign: "right" }}>Monto</th></tr></thead>
                            <tbody>
                              {pagosProvSel.map((pg) => (
                                <tr key={pg.id}>
                                  <td style={{ fontSize: "0.76rem", color: "#aaa" }}>{new Date(pg.fecha).toLocaleDateString()}</td>
                                  <td style={{ fontSize: "0.76rem" }}>{pg.metodo_pago || "—"}</td>
                                  <td style={{ fontSize: "0.74rem", color: "#888" }}>{pg.referencia || "—"}</td>
                                  <td style={{ textAlign: "right", color: "#2ecc71", fontWeight: 600 }}>{fmt(pg.monto)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ============ MODAL: PROVEEDOR ============ */}
      {modalProv && (
        <div className="pv-ov">
          <div className="pv-md" style={{ maxWidth: "760px" }}>
            <h2 style={{ color: "#DAA520", marginTop: 0, fontSize: "1.15rem", textTransform: "uppercase" }}>
              {editandoProv ? "Editar Proveedor" : "Registrar Nueva Fábrica / Proveedor"}
            </h2>
            <form onSubmit={guardarProveedor}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
                <div><label className="pv-lb">Nombre de la fábrica *</label>
                  <input className="pv-in" value={formProv.nombre || ""} required placeholder="Ej: FiberOptic Tech China"
                    onChange={(e) => setFormProv({ ...formProv, nombre: e.target.value })} /></div>
                <div><label className="pv-lb">Persona de contacto</label>
                  <input className="pv-in" value={formProv.contacto || ""} placeholder="Ej: Mr. Wang"
                    onChange={(e) => setFormProv({ ...formProv, contacto: e.target.value })} /></div>
                <div><label className="pv-lb">Correo</label>
                  <input className="pv-in" type="email" value={formProv.email || ""}
                    onChange={(e) => setFormProv({ ...formProv, email: e.target.value })} /></div>
                <div><label className="pv-lb">Teléfono / WhatsApp</label>
                  <input className="pv-in" value={formProv.telefono || ""} placeholder="+86 ..."
                    onChange={(e) => setFormProv({ ...formProv, telefono: e.target.value })} /></div>
                <div><label className="pv-lb">RUC / Tax ID</label>
                  <input className="pv-in" value={formProv.ruc || ""}
                    onChange={(e) => setFormProv({ ...formProv, ruc: e.target.value })} /></div>
                <div><label className="pv-lb">País de origen</label>
                  <input className="pv-in" value={formProv.pais || ""} placeholder="Ej: China"
                    onChange={(e) => setFormProv({ ...formProv, pais: e.target.value })} /></div>
                <div style={{ gridColumn: "1 / -1" }}><label className="pv-lb">Dirección</label>
                  <input className="pv-in" value={formProv.direccion || ""}
                    onChange={(e) => setFormProv({ ...formProv, direccion: e.target.value })} /></div>
                <div><label className="pv-lb">Tipo de insumo</label>
                  <input className="pv-in" value={formProv.tipo_insumo || ""} placeholder="Ej: Cables ADSS, Herrajes"
                    onChange={(e) => setFormProv({ ...formProv, tipo_insumo: e.target.value })} /></div>
                <div><label className="pv-lb">Estado</label>
                  <select className="pv-in" value={formProv.estado || "Activo"}
                    onChange={(e) => setFormProv({ ...formProv, estado: e.target.value })}>
                    <option value="Activo">Activo</option><option value="Inactivo">Inactivo</option>
                  </select></div>
              </div>

              <div style={{ background: "rgba(218,165,32,0.05)", border: "1px dashed rgba(218,165,32,0.35)", borderRadius: "8px", padding: "16px", marginBottom: "14px" }}>
                <p style={{ fontSize: "0.7rem", color: "#DAA520", margin: "0 0 12px 0", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Crédito y condiciones comerciales
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "12px" }}>
                  <div><label className="pv-lb">Límite de crédito</label>
                    <input className="pv-in" type="number" min={0} value={formProv.limite_credito ?? 0}
                      onChange={(e) => setFormProv({ ...formProv, limite_credito: e.target.value })} /></div>
                  <div><label className="pv-lb">Días de crédito</label>
                    <input className="pv-in" type="number" min={0} value={formProv.dias_credito ?? 0}
                      onChange={(e) => setFormProv({ ...formProv, dias_credito: e.target.value })} /></div>
                  <div><label className="pv-lb">Moneda</label>
                    <select className="pv-in" value={formProv.moneda || "USD"}
                      onChange={(e) => setFormProv({ ...formProv, moneda: e.target.value })}>
                      <option value="USD">USD</option><option value="EUR">EUR</option><option value="CNY">CNY</option>
                    </select></div>
                  <div><label className="pv-lb">Incoterm</label>
                    <select className="pv-in" value={formProv.incoterm || "FOB"}
                      onChange={(e) => setFormProv({ ...formProv, incoterm: e.target.value })}>
                      <option value="EXW">EXW</option><option value="FOB">FOB</option>
                      <option value="CIF">CIF</option><option value="DDP">DDP</option><option value="CFR">CFR</option>
                    </select></div>
                </div>
                <div style={{ marginTop: "12px" }}>
                  <label className="pv-lb">Condiciones de pago (texto libre)</label>
                  <input className="pv-in" value={formProv.condiciones_pago || ""}
                    onChange={(e) => setFormProv({ ...formProv, condiciones_pago: e.target.value })} />
                </div>
                <p style={{ fontSize: "0.7rem", color: "#777", margin: "10px 0 0 0" }}>
                  Los días de crédito calculan solos la fecha de vencimiento de cada factura al recibir mercancía.
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                <div><label className="pv-lb">Banco</label>
                  <input className="pv-in" value={formProv.banco || ""}
                    onChange={(e) => setFormProv({ ...formProv, banco: e.target.value })} /></div>
                <div><label className="pv-lb">Cuenta bancaria</label>
                  <input className="pv-in" value={formProv.cuenta_bancaria || ""}
                    onChange={(e) => setFormProv({ ...formProv, cuenta_bancaria: e.target.value })} /></div>
                <div><label className="pv-lb">SWIFT</label>
                  <input className="pv-in" value={formProv.swift || ""}
                    onChange={(e) => setFormProv({ ...formProv, swift: e.target.value })} /></div>
              </div>

              <div style={{ marginBottom: "18px" }}>
                <label className="pv-lb">Notas y observaciones</label>
                <textarea className="pv-in" rows={3} style={{ resize: "vertical" }} value={formProv.descripcion || ""}
                  placeholder="Tiempos de entrega, capacidad de producción, historial..."
                  onChange={(e) => setFormProv({ ...formProv, descripcion: e.target.value })} />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" onClick={() => setModalProv(false)}
                  style={{ background: "transparent", color: "#aaa", border: "1px solid #444", borderRadius: "6px", padding: "10px 20px", cursor: "pointer", fontSize: "0.78rem" }}>
                  Cancelar
                </button>
                <button type="submit" className="pv-gold">{editandoProv ? "Actualizar" : "Guardar Proveedor"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============ MODAL: NUEVA ORDEN DE COMPRA ============ */}
      {modalOC && (
        <div className="pv-ov">
          <div className="pv-md" style={{ maxWidth: "880px" }}>
            <h2 style={{ color: "#DAA520", marginTop: 0, fontSize: "1.15rem", textTransform: "uppercase" }}>Nueva Orden de Compra</h2>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "12px", marginBottom: "18px" }}>
              <div><label className="pv-lb">Proveedor *</label>
                <select className="pv-in" value={formOC.proveedor_id} onChange={(e) => setFormOC({ ...formOC, proveedor_id: e.target.value })}>
                  <option value="">— Selecciona —</option>
                  {proveedores.filter((p) => p.estado !== "Inactivo").map((p) => (
                    <option key={p.id} value={String(p.id)}>{p.nombre}</option>
                  ))}
                </select></div>
              <div><label className="pv-lb">Fecha</label>
                <input className="pv-in" type="date" value={formOC.fecha} onChange={(e) => setFormOC({ ...formOC, fecha: e.target.value })} /></div>
              <div><label className="pv-lb">Entrega estimada</label>
                <input className="pv-in" type="date" value={formOC.fecha_estimada_entrega}
                  onChange={(e) => setFormOC({ ...formOC, fecha_estimada_entrega: e.target.value })} /></div>
              <div><label className="pv-lb">Incoterm</label>
                <select className="pv-in" value={formOC.incoterm} onChange={(e) => setFormOC({ ...formOC, incoterm: e.target.value })}>
                  <option value="">Del proveedor</option>
                  <option value="EXW">EXW</option><option value="FOB">FOB</option>
                  <option value="CIF">CIF</option><option value="DDP">DDP</option><option value="CFR">CFR</option>
                </select></div>
            </div>

            {/* Agregar renglón */}
            <div style={{ background: "#050505", border: "1px dashed rgba(218,165,32,0.35)", borderRadius: "8px", padding: "16px", marginBottom: "16px" }}>
              <p style={{ fontSize: "0.7rem", color: "#DAA520", margin: "0 0 12px 0", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Agregar renglón
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr 1fr auto", gap: "10px", alignItems: "end" }}>
                <div><label className="pv-lb">Destino</label>
                  <select className="pv-in" value={itemBorrador.destino}
                    onChange={(e) => setItemBorrador({ ...itemBorrador, destino: e.target.value, materia_prima_id: "", sku_bodega: "" })}>
                    <option value="materia_prima">Materia prima</option>
                    <option value="bodega">Bodega</option>
                  </select></div>

                {itemBorrador.destino === "materia_prima" ? (
                  <div><label className="pv-lb">Insumo</label>
                    <select className="pv-in" value={itemBorrador.materia_prima_id}
                      onChange={(e) => setItemBorrador({ ...itemBorrador, materia_prima_id: e.target.value })}>
                      <option value="">— Selecciona insumo —</option>
                      {materiasPrimas.map((m) => (
                        <option key={m.id} value={m.id}>{m.codigo} — {m.nombre} ({m.unidad})</option>
                      ))}
                    </select></div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <div><label className="pv-lb">Catálogo</label>
                      <select className="pv-in" value={itemBorrador.tabla_bodega}
                        onChange={(e) => setItemBorrador({ ...itemBorrador, tabla_bodega: e.target.value })}>
                        {TABLAS_BODEGA.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                      </select></div>
                    <div><label className="pv-lb">SKU</label>
                      <input className="pv-in" value={itemBorrador.sku_bodega} placeholder="TL-FO-101"
                        onChange={(e) => setItemBorrador({ ...itemBorrador, sku_bodega: e.target.value })} /></div>
                  </div>
                )}

                <div><label className="pv-lb">Cantidad</label>
                  <input className="pv-in" type="number" min={0} value={itemBorrador.cantidad}
                    onChange={(e) => setItemBorrador({ ...itemBorrador, cantidad: e.target.value })} /></div>
                <div><label className="pv-lb">Precio unit.</label>
                  <input className="pv-in" type="number" min={0} step="0.01" value={itemBorrador.precio_unitario}
                    onChange={(e) => setItemBorrador({ ...itemBorrador, precio_unitario: e.target.value })} /></div>
                <button type="button" className="pv-gold" style={{ height: "38px" }} onClick={agregarItemBorrador}>+ Agregar</button>
              </div>
              {itemBorrador.destino === "bodega" && (
                <p style={{ fontSize: "0.7rem", color: "#777", margin: "10px 0 0 0" }}>
                  El SKU debe existir ya en el catálogo de bodega. Si no existe, créalo primero en Inventario.
                </p>
              )}
            </div>

            {/* Renglones cargados */}
            {itemsNuevaOC.length > 0 && (
              <div style={{ marginBottom: "16px", border: "1px solid rgba(218,165,32,0.2)", borderRadius: "8px", overflow: "hidden" }}>
                <table className="pv-tabla">
                  <thead><tr><th>Destino</th><th>Descripción</th><th style={{ textAlign: "right" }}>Cant.</th><th style={{ textAlign: "right" }}>P. Unit.</th><th style={{ textAlign: "right" }}>Total</th><th></th></tr></thead>
                  <tbody>
                    {itemsNuevaOC.map((it, idx) => (
                      <tr key={idx}>
                        <td style={{ fontSize: "0.72rem", color: "#DAA520" }}>
                          {it.destino === "materia_prima" ? "Materia prima" : `Bodega · ${it.tabla_bodega}`}
                        </td>
                        <td style={{ fontSize: "0.78rem" }}>{it.descripcion}</td>
                        <td style={{ textAlign: "right" }}>{it.cantidad} {it.unidad}</td>
                        <td style={{ textAlign: "right" }}>{fmt(it.precio_unitario)}</td>
                        <td style={{ textAlign: "right", color: "#DAA520", fontWeight: 600 }}>{fmt(it.total)}</td>
                        <td style={{ textAlign: "right" }}>
                          <button className="pv-rojo" onClick={() => setItemsNuevaOC((prev) => prev.filter((_, i) => i !== idx))}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px", marginBottom: "18px" }}>
              <div><label className="pv-lb">Notas de la orden</label>
                <textarea className="pv-in" rows={3} style={{ resize: "vertical" }} value={formOC.notas}
                  placeholder="Instrucciones de embarque, especificaciones..."
                  onChange={(e) => setFormOC({ ...formOC, notas: e.target.value })} /></div>
              <div style={{ background: "rgba(218,165,32,0.05)", border: "1px solid rgba(218,165,32,0.25)", borderRadius: "8px", padding: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "8px" }}>
                  <span style={{ color: "#888" }}>Subtotal</span><strong style={{ color: "#fff" }}>{fmt(subtotalNuevaOC)}</strong>
                </div>
                <div style={{ marginBottom: "10px" }}>
                  <label className="pv-lb">Impuestos / flete</label>
                  <input className="pv-in" type="number" min={0} step="0.01" value={formOC.impuestos}
                    onChange={(e) => setFormOC({ ...formOC, impuestos: Number(e.target.value) || 0 })} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(218,165,32,0.25)", paddingTop: "10px" }}>
                  <span style={{ color: "#DAA520", fontSize: "0.82rem" }}>TOTAL</span>
                  <strong style={{ color: "#DAA520", fontSize: "1.1rem" }}>{fmt(totalNuevaOC)}</strong>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button type="button" onClick={() => { setModalOC(false); setItemsNuevaOC([]); }}
                style={{ background: "transparent", color: "#aaa", border: "1px solid #444", borderRadius: "6px", padding: "10px 20px", cursor: "pointer", fontSize: "0.78rem" }}>
                Cancelar
              </button>
              <button className="pv-gold" disabled={guardandoOC} onClick={guardarOrdenCompra}>
                {guardandoOC ? "Guardando..." : "Crear Orden de Compra"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ MODAL: RECEPCIÓN ============ */}
      {modalRecepcion.open && modalRecepcion.orden && (() => {
        const o = modalRecepcion.orden!;
        const items = itemsPorOrden[o.id] || [];
        const prov = proveedores.find((p) => String(p.id) === String(o.proveedor_id));
        const dias = Number(prov?.dias_credito || 0);
        const venc = new Date();
        venc.setDate(venc.getDate() + dias);
        return (
          <div className="pv-ov">
            <div className="pv-md" style={{ maxWidth: "640px" }}>
              <h2 style={{ color: "#2ecc71", marginTop: 0, fontSize: "1.15rem", textTransform: "uppercase" }}>Recibir Mercancía</h2>
              <p style={{ color: "#bbb", fontSize: "0.85rem", marginBottom: "16px" }}>
                Orden <strong style={{ color: "#DAA520" }}>{o.numero}</strong> — {o.proveedor_nombre}
              </p>

              <div style={{ background: "rgba(46,204,113,0.06)", border: "1px dashed rgba(46,204,113,0.35)", borderRadius: "8px", padding: "14px", marginBottom: "16px" }}>
                <p style={{ fontSize: "0.7rem", color: "#2ecc71", margin: "0 0 8px 0", textTransform: "uppercase" }}>Al confirmar sucede esto</p>
                <ul style={{ color: "#ccc", fontSize: "0.78rem", margin: 0, paddingLeft: "18px", lineHeight: 1.7 }}>
                  <li>Se suma el stock de cada renglón a su inventario</li>
                  <li>Queda el movimiento registrado para auditoría</li>
                  <li>Se crea la cuenta por pagar de <strong style={{ color: "#DAA520" }}>{fmt(o.total)}</strong></li>
                  <li>Vence el <strong style={{ color: "#DAA520" }}>{venc.toLocaleDateString()}</strong> ({dias} días de crédito)</li>
                </ul>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label className="pv-lb">Número de factura del proveedor</label>
                <input className="pv-in" value={numeroFactura} placeholder="Ej: FAC-9921"
                  onChange={(e) => setNumeroFactura(e.target.value)} />
              </div>

              <div style={{ maxHeight: "220px", overflowY: "auto", border: "1px solid rgba(218,165,32,0.2)", borderRadius: "8px", marginBottom: "18px" }}>
                <table className="pv-tabla">
                  <thead><tr><th>Renglón</th><th>Destino</th><th style={{ textAlign: "right" }}>Cantidad</th></tr></thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.id}>
                        <td style={{ fontSize: "0.76rem" }}>{it.descripcion}</td>
                        <td style={{ fontSize: "0.7rem", color: "#DAA520" }}>
                          {it.destino === "materia_prima" ? "Materia prima" : `${it.tabla_bodega}`}
                        </td>
                        <td style={{ textAlign: "right", color: "#2ecc71", fontWeight: 600 }}>+{it.cantidad} {it.unidad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {dias === 0 && (
                <p style={{ fontSize: "0.74rem", color: "#e67e22", marginBottom: "14px" }}>
                  ⚠ Este proveedor no tiene días de crédito configurados, así que la factura vencerá hoy mismo.
                  Puedes ajustarlo en su ficha.
                </p>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" onClick={() => setModalRecepcion({ open: false, orden: null })}
                  style={{ background: "transparent", color: "#aaa", border: "1px solid #444", borderRadius: "6px", padding: "10px 20px", cursor: "pointer", fontSize: "0.78rem" }}>
                  Cancelar
                </button>
                <button className="pv-gold" disabled={recibiendo} onClick={recibirOrden}
                  style={{ background: "#2ecc71" }}>
                  {recibiendo ? "Procesando..." : "Confirmar Recepción"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ============ MODAL: PAGO ============ */}
      {modalPago.open && modalPago.cuenta && (
        <div className="pv-ov">
          <div className="pv-md" style={{ maxWidth: "460px" }}>
            <h2 style={{ color: "#2ecc71", marginTop: 0, fontSize: "1.1rem", textTransform: "uppercase" }}>Registrar Pago</h2>
            <p style={{ color: "#bbb", fontSize: "0.84rem", marginBottom: "18px" }}>
              {modalPago.cuenta.proveedor_nombre} — factura <strong style={{ color: "#DAA520" }}>{modalPago.cuenta.numero_factura}</strong>
              <br />
              <span style={{ fontSize: "0.78rem", color: "#888" }}>
                Saldo pendiente: <strong style={{ color: "#e74c3c" }}>{fmt(modalPago.cuenta.saldo_pendiente)}</strong>
              </span>
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
              <div><label className="pv-lb">Monto a pagar</label>
                <input className="pv-in" type="number" min={0} step="0.01" value={formPago.monto}
                  onChange={(e) => setFormPago({ ...formPago, monto: Number(e.target.value) || 0 })} /></div>
              <div><label className="pv-lb">Fecha</label>
                <input className="pv-in" type="date" value={formPago.fecha}
                  onChange={(e) => setFormPago({ ...formPago, fecha: e.target.value })} /></div>
              <div><label className="pv-lb">Método</label>
                <select className="pv-in" value={formPago.metodo_pago}
                  onChange={(e) => setFormPago({ ...formPago, metodo_pago: e.target.value })}>
                  <option value="Transferencia">Transferencia</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Carta de Crédito">Carta de Crédito</option>
                </select></div>
              <div><label className="pv-lb">Referencia</label>
                <input className="pv-in" value={formPago.referencia} placeholder="N° de transferencia"
                  onChange={(e) => setFormPago({ ...formPago, referencia: e.target.value })} /></div>
              <div style={{ gridColumn: "1 / -1" }}><label className="pv-lb">Registrado por</label>
                <input className="pv-in" value={formPago.autor} placeholder="Tu nombre"
                  onChange={(e) => setFormPago({ ...formPago, autor: e.target.value })} /></div>
            </div>

            <div style={{ background: "rgba(218,165,32,0.05)", border: "1px dashed rgba(218,165,32,0.3)", borderRadius: "8px", padding: "13px", marginBottom: "18px", fontSize: "0.8rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#888" }}>Saldo después del pago</span>
                <strong style={{ color: Number(modalPago.cuenta.saldo_pendiente) - formPago.monto <= 0.009 ? "#2ecc71" : "#e74c3c" }}>
                  {fmt(Math.max(0, Number(modalPago.cuenta.saldo_pendiente) - formPago.monto))}
                </strong>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button type="button" onClick={() => setModalPago({ open: false, cuenta: null })}
                style={{ background: "transparent", color: "#aaa", border: "1px solid #444", borderRadius: "6px", padding: "10px 20px", cursor: "pointer", fontSize: "0.78rem" }}>
                Cancelar
              </button>
              <button className="pv-gold" style={{ background: "#2ecc71" }} onClick={registrarPago}>Registrar Pago</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
