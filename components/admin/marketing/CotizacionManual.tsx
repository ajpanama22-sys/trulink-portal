import { useState, useEffect, useMemo } from "react";
import { getSupabase } from "../../../lib/supabaseClient";
import {
  TipoCable,
  ItemCable,
  ItemProducto,
  calcularItemCable,
  detalleConfigCable,
  totalItemsCable,
  totalItemsProducto,
  formatearItemsCableParaQuotes,
  formatearItemsProductoParaQuotes,
  calcularFechaEntrega,
  generarReferencia,
} from "../../../lib/cotizadorEngine";

type PedidoEspecial = {
  id: string;
  email: string;
  empresa: string | null;
  representante: string | null;
  telefono_celular: string | null;
  especificaciones_texto: string | null;
  archivo_adjunto_url: string | null;
  cantidad_aproximada: string | null;
  created_at: string;
};

type LineaManual = {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
};

const fmt = (n: number) => "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CotizacionManual() {
  const supabase = getSupabase();

  const [modo, setModo] = useState<"pedido_especial" | "cable" | "producto">("pedido_especial");

  // ── Pedidos especiales pendientes (ahora leídos de quotes) ──
  const [pedidosEspeciales, setPedidosEspeciales] = useState<PedidoEspecial[]>([]);
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<PedidoEspecial | null>(null);
  const [cargandoPedidos, setCargandoPedidos] = useState(true);

  // ── Líneas manuales (para Pedido Especial) ──
  const [lineasManuales, setLineasManuales] = useState<LineaManual[]>([{ descripcion: "", cantidad: 1, precioUnitario: 0 }]);

  // ── Cable (reutiliza cotizadorEngine) ──
  const [itemsCable, setItemsCable] = useState<ItemCable[]>([]);
  const [tipoCable, setTipoCable] = useState<TipoCable>("ASU");
  const [hilosCable, setHilosCable] = useState(12);
  const [kmCable, setKmCable] = useState(3);
  const [cantidadCable, setCantidadCable] = useState(1);
  const [vanoCable, setVanoCable] = useState<number | null>(100);
  const [mensajeroCable, setMensajeroCable] = useState(false);

  // ── Producto terminado ──
  const [tablaProducto, setTablaProducto] = useState<"cablesdb" | "herrajesdb" | "accesoriosdb">("cablesdb");
  const [catalogoProductos, setCatalogoProductos] = useState<any[]>([]);
  const [busquedaProducto, setBusquedaProducto] = useState("");
  const [itemsProducto, setItemsProducto] = useState<ItemProducto[]>([]);
  const [cargandoCatalogo, setCargandoCatalogo] = useState(false);

  // ── Datos del cliente destino ──
  const [clienteEmail, setClienteEmail] = useState("");
  const [empresaCliente, setEmpresaCliente] = useState("");
  const [representanteCliente, setRepresentanteCliente] = useState("");
  const [telefonoCliente, setTelefonoCliente] = useState("");
  const [buscandoCliente, setBuscandoCliente] = useState(false);

  const [referencia, setReferencia] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setReferencia(generarReferencia());
    cargarPedidosEspeciales();
  }, []);

  useEffect(() => {
    if (modo === "producto") cargarCatalogoProducto(tablaProducto);
  }, [modo, tablaProducto]);

  /**
   * Antes leía de la tabla "pedidos_especiales", que quedó huérfana:
   * nada la llenaba. La solicitud real del cliente (especiales.tsx) cae
   * en "quotes" con type = "especiales" y status = "pendiente_cotizar".
   * Ahora leemos de ahí directamente.
   */
  const cargarPedidosEspeciales = async () => {
    if (!supabase) { setCargandoPedidos(false); return; }
    setCargandoPedidos(true);
    const { data, error } = await supabase
      .from("quotes")
      .select("*")
      .eq("type", "especiales")
      .eq("status", "pendiente_cotizar")
      .order("created_at", { ascending: false });
    if (error) console.error("Error cargando pedidos especiales:", error.message);
    setPedidosEspeciales(data || []);
    setCargandoPedidos(false);
  };

  const cargarCatalogoProducto = async (tabla: string) => {
    if (!supabase) return;
    setCargandoCatalogo(true);
    const { data, error } = await supabase.from(tabla).select("*");
    if (error) console.error(`Error cargando ${tabla}:`, error.message);
    setCatalogoProductos(data || []);
    setCargandoCatalogo(false);
  };

  /** Al elegir un pedido especial, precarga los datos que ya vinieron en la fila de quotes. */
  const seleccionarPedido = async (pedido: PedidoEspecial) => {
    setPedidoSeleccionado(pedido);
    setClienteEmail(pedido.email);
    setEmpresaCliente(pedido.empresa || "");
    setRepresentanteCliente(pedido.representante || "");
    setTelefonoCliente(pedido.telefono_celular || "");
    if (!pedido.empresa) await buscarDatosCliente(pedido.email);
  };

  const buscarDatosCliente = async (email: string) => {
    if (!supabase || !email) return;
    setBuscandoCliente(true);
    try {
      const { data } = await supabase.from("clientes").select("*").ilike("email", email.trim()).maybeSingle();
      if (data) {
        setEmpresaCliente(data.razon_social || "");
        setRepresentanteCliente(data.nombre_representante || "");
        setTelefonoCliente(data.telefono_celular || data.telefono_oficina || "");
      } else {
        setEmpresaCliente("");
        setRepresentanteCliente("");
        setTelefonoCliente("");
      }
    } finally {
      setBuscandoCliente(false);
    }
  };

  // ── Líneas manuales ──
  const agregarLineaManual = () => setLineasManuales([...lineasManuales, { descripcion: "", cantidad: 1, precioUnitario: 0 }]);
  const quitarLineaManual = (idx: number) => setLineasManuales(lineasManuales.filter((_, i) => i !== idx));
  const actualizarLineaManual = (idx: number, campo: keyof LineaManual, valor: string | number) => {
    setLineasManuales(lineasManuales.map((l, i) => (i === idx ? { ...l, [campo]: valor } : l)));
  };

  // ── Cable ──
  const agregarCable = () => {
    const nuevo = calcularItemCable(tipoCable, hilosCable, kmCable, cantidadCable, tipoCable === "FTTX" ? null : vanoCable, tipoCable === "FTTX" ? mensajeroCable : false);
    setItemsCable([...itemsCable, nuevo]);
  };
  const quitarCable = (idx: number) => setItemsCable(itemsCable.filter((_, i) => i !== idx));

  // ── Producto terminado ──
  const catalogoFiltrado = useMemo(() => {
    const q = busquedaProducto.toLowerCase().trim();
    if (!q) return catalogoProductos;
    return catalogoProductos.filter((p) =>
      [p.SKU, p.Descripción, p.Ítem].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
    );
  }, [catalogoProductos, busquedaProducto]);

  const agregarProducto = (prod: any) => {
    setItemsProducto([...itemsProducto, {
      SKU: prod.SKU || "Sin SKU",
      nombre: prod.Descripción || prod.Ítem || prod.SKU,
      cantidad: 1,
      precio: Number(prod.precio_a || 0),
      descripcion: prod.Descripción,
    }]);
  };
  const quitarProducto = (idx: number) => setItemsProducto(itemsProducto.filter((_, i) => i !== idx));
  const actualizarCantidadProducto = (idx: number, cantidad: number) => {
    setItemsProducto(itemsProducto.map((it, i) => (i === idx ? { ...it, cantidad } : it)));
  };

  // ── Total consolidado (todas las fuentes juntas, por si se mezclan) ──
  const totalManual = lineasManuales.reduce((acc, l) => acc + l.cantidad * l.precioUnitario, 0);
  const totalGeneral = totalManual + totalItemsCable(itemsCable) + totalItemsProducto(itemsProducto);

  const hayContenido = lineasManuales.some((l) => l.descripcion.trim() && l.cantidad > 0) || itemsCable.length > 0 || itemsProducto.length > 0;

  /**
   * Si la cotización viene de una solicitud real del cliente (pedidoSeleccionado),
   * actualiza esa misma fila de quotes en vez de crear una nueva — si no, la
   * solicitud original se queda eternamente en "pendiente_cotizar" duplicada.
   * Si es cable/producto o un pedido especial armado desde cero, sí crea fila nueva.
   */
  const guardarCotizacion = async () => {
    if (!supabase) return alert("No se pudo conectar con la base de datos.");
    if (!clienteEmail.trim()) return alert("Falta el email del cliente destino.");
    if (!hayContenido) return alert("Agregá al menos un ítem (línea manual, cable o producto) antes de guardar.");

    setGuardando(true);
    try {
      const itemsManualesFormateados = lineasManuales
        .filter((l) => l.descripcion.trim() && l.cantidad > 0)
        .map((l) => ({
          SKU: "MANUAL",
          descripcion: l.descripcion,
          cantidad: l.cantidad,
          precioUnitario: l.precioUnitario,
          total: l.cantidad * l.precioUnitario,
        }));

      const itemsFinal = [
        ...itemsManualesFormateados,
        ...formatearItemsCableParaQuotes(itemsCable),
        ...formatearItemsProductoParaQuotes(itemsProducto),
      ];

      if (modo === "pedido_especial" && pedidoSeleccionado) {
        // La fila ya existe (la creó el cliente en especiales.tsx) — se actualiza, no se duplica
        const { data, error } = await supabase
          .from("quotes")
          .update({
            empresa: empresaCliente || clienteEmail,
            representante: representanteCliente || null,
            telefono_celular: telefonoCliente || null,
            total: totalGeneral,
            items: itemsFinal,
            status: "pending",
            origen_admin: true,
          })
          .eq("id", pedidoSeleccionado.id)
          .select()
          .single();
        if (error) throw new Error(error.message);

        try {
          await supabase.from("audit_log").insert([{
            accion: "cotizacion_manual_creada",
            entidad: "quote",
            entidad_id: String(data.id),
            detalle: `Pedido especial de ${clienteEmail} cotizado por ${fmt(totalGeneral)}.`,
          }]);
        } catch { /* no frena */ }

        alert(`Cotización guardada por ${fmt(totalGeneral)}. El cliente ya puede verla en su portal / recibir el enlace de pago.`);
      } else {
        // Cable, producto, o pedido especial armado desde cero (sin solicitud previa del cliente)
        const tipoOrigen = modo === "pedido_especial" ? "especiales" : modo === "cable" ? "fabricacion" : "producto";

        const { data, error } = await supabase.from("quotes").insert([{
          referencia,
          type: tipoOrigen,
          origen_admin: true,
          empresa: empresaCliente || clienteEmail,
          representante: representanteCliente || null,
          email: clienteEmail.trim(),
          telefono_celular: telefonoCliente || null,
          total: totalGeneral,
          items: itemsFinal,
          status: "pending",
          fecha_estimada_entrega: calcularFechaEntrega(),
        }]).select().single();
        if (error) throw new Error(error.message);

        try {
          await supabase.from("audit_log").insert([{
            accion: "cotizacion_manual_creada",
            entidad: "quote",
            entidad_id: String(data.id),
            detalle: `Cotización manual ${referencia} creada para ${clienteEmail} (${tipoOrigen}) por ${fmt(totalGeneral)}.`,
          }]);
        } catch { /* no frena */ }

        alert(`Cotización ${referencia} guardada correctamente por ${fmt(totalGeneral)}. El cliente ya puede verla en su portal / recibir el enlace de pago.`);
      }

      // Reset del formulario
      setReferencia(generarReferencia());
      setLineasManuales([{ descripcion: "", cantidad: 1, precioUnitario: 0 }]);
      setItemsCable([]);
      setItemsProducto([]);
      setPedidoSeleccionado(null);
      setClienteEmail("");
      setEmpresaCliente("");
      setRepresentanteCliente("");
      setTelefonoCliente("");
      cargarPedidosEspeciales(); // refresca — la que se acaba de cotizar ya no debe salir en pendientes
    } catch (err: any) {
      alert(`Error al guardar la cotización: ${err.message}`);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div style={{ color: "#DAA520" }}>
      <style jsx>{`
        input, select, textarea {
          background-color: #050505; color: #DAA520;
          border: 1px solid rgba(218,165,32,0.4);
          padding: 9px 11px; border-radius: 6px; outline: none;
          font-size: 0.82rem; box-sizing: border-box; width: 100%;
        }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th, td { border: 1px solid rgba(218,165,32,0.25); padding: 9px; text-align: center; color: #FFF; font-size: 0.8rem; }
        th { background-color: #0a0a0a; color: #DAA520; font-weight: 600; text-transform: uppercase; font-size: 0.65rem; }
      `}</style>

      {/* ── Selector de modo ── */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "25px" }}>
        {[
          { key: "pedido_especial", label: "📋 Pedido Especial" },
          { key: "cable", label: "🧵 Fabricación de Cable" },
          { key: "producto", label: "📦 Producto Terminado" },
        ].map((m) => (
          <button
            key={m.key}
            onClick={() => setModo(m.key as any)}
            style={{
              padding: "9px 16px", borderRadius: "6px",
              border: modo === m.key ? "1px solid #DAA520" : "1px solid #333",
              background: modo === m.key ? "#DAA520" : "#111",
              color: modo === m.key ? "#000" : "#DAA520",
              fontWeight: 600, cursor: "pointer", fontSize: "0.78rem",
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "22px" }}>

        {/* ── Columna izquierda: captura según modo ── */}
        <div style={{ background: "#080808", border: "1px solid rgba(218,165,32,0.3)", borderRadius: "10px", padding: "22px" }}>

          {modo === "pedido_especial" && (
            <>
              <h3 style={{ color: "#DAA520", fontSize: "0.9rem", textTransform: "uppercase", marginTop: 0 }}>Pedidos Especiales Pendientes</h3>
              {cargandoPedidos ? (
                <p style={{ color: "#888", fontSize: "0.82rem" }}>Cargando...</p>
              ) : pedidosEspeciales.length === 0 ? (
                <p style={{ color: "#888", fontSize: "0.82rem" }}>No hay pedidos especiales registrados.</p>
              ) : (
                <div style={{ maxHeight: "220px", overflowY: "auto", border: "1px solid rgba(218,165,32,0.2)", borderRadius: "6px", marginBottom: "18px" }}>
                  {pedidosEspeciales.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => seleccionarPedido(p)}
                      style={{
                        padding: "10px 14px", cursor: "pointer",
                        borderBottom: "1px solid #141414",
                        background: pedidoSeleccionado?.id === p.id ? "rgba(218,165,32,0.1)" : "transparent",
                      }}
                    >
                      <div style={{ color: pedidoSeleccionado?.id === p.id ? "#DAA520" : "#FFF", fontWeight: 600, fontSize: "0.8rem" }}>
                        {p.empresa || p.email}
                      </div>
                      <div style={{ color: "#888", fontSize: "0.72rem", marginTop: "2px" }}>
                        {p.especificaciones_texto || "Sin descripción (ver adjunto)"}
                      </div>
                      {p.cantidad_aproximada && (
                        <div style={{ color: "#666", fontSize: "0.68rem", marginTop: "2px" }}>
                          Cantidad aprox: {p.cantidad_aproximada}
                        </div>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                        <span style={{ color: "#666", fontSize: "0.68rem" }}>{new Date(p.created_at).toLocaleDateString()}</span>
                        {p.archivo_adjunto_url && (
                          <a href={p.archivo_adjunto_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "#29B6F6", fontSize: "0.68rem" }}>
                            📎 Ver adjunto
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <h3 style={{ color: "#DAA520", fontSize: "0.9rem", textTransform: "uppercase", marginBottom: "12px" }}>Líneas de la Cotización (manual)</h3>
              {lineasManuales.map((linea, idx) => (
                <div key={idx} style={{ display: "grid", gridTemplateColumns: "2fr 70px 90px 30px", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
                  <input placeholder="Descripción del producto/servicio a cotizar" value={linea.descripcion}
                    onChange={(e) => actualizarLineaManual(idx, "descripcion", e.target.value)} />
                  <input type="number" min={1} placeholder="Cant" value={linea.cantidad}
                    onChange={(e) => actualizarLineaManual(idx, "cantidad", parseInt(e.target.value) || 0)} />
                  <input type="number" min={0} step={0.01} placeholder="P. Unit" value={linea.precioUnitario}
                    onChange={(e) => actualizarLineaManual(idx, "precioUnitario", parseFloat(e.target.value) || 0)} />
                  <button onClick={() => quitarLineaManual(idx)} style={{ background: "none", border: "none", color: "#e74c3c", cursor: "pointer", fontSize: "1rem" }}>✕</button>
                </div>
              ))}
              <button onClick={agregarLineaManual} style={{ background: "none", border: "1px dashed rgba(218,165,32,0.4)", color: "#DAA520", padding: "8px", borderRadius: "6px", width: "100%", cursor: "pointer", fontSize: "0.78rem", marginTop: "6px" }}>
                + Agregar línea
              </button>
            </>
          )}

          {modo === "cable" && (
            <>
              <h3 style={{ color: "#DAA520", fontSize: "0.9rem", textTransform: "uppercase", marginTop: 0 }}>Fabricación de Cable</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                <div>
                  <label style={{ fontSize: "0.68rem", color: "#888", display: "block", marginBottom: "3px" }}>Tipo</label>
                  <select value={tipoCable} onChange={(e) => setTipoCable(e.target.value as TipoCable)}>
                    <option value="ASU">ASU</option>
                    <option value="ADSS">ADSS</option>
                    <option value="FTTX">FTTX</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "0.68rem", color: "#888", display: "block", marginBottom: "3px" }}>Hilos</label>
                  <input type="number" min={1} value={hilosCable} onChange={(e) => setHilosCable(parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label style={{ fontSize: "0.68rem", color: "#888", display: "block", marginBottom: "3px" }}>Km / Carrete</label>
                  <input type="number" min={0.5} step={0.5} value={kmCable} onChange={(e) => setKmCable(parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <label style={{ fontSize: "0.68rem", color: "#888", display: "block", marginBottom: "3px" }}>Cantidad</label>
                  <input type="number" min={1} value={cantidadCable} onChange={(e) => setCantidadCable(parseInt(e.target.value) || 1)} />
                </div>
                {tipoCable !== "FTTX" ? (
                  <div>
                    <label style={{ fontSize: "0.68rem", color: "#888", display: "block", marginBottom: "3px" }}>Vano</label>
                    <select value={vanoCable ?? 100} onChange={(e) => setVanoCable(parseInt(e.target.value))}>
                      <option value={100}>100 m</option>
                      <option value={120}>120 m</option>
                      <option value={150}>150 m</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label style={{ fontSize: "0.68rem", color: "#888", display: "block", marginBottom: "3px" }}>Mensajero</label>
                    <select value={mensajeroCable ? "si" : "no"} onChange={(e) => setMensajeroCable(e.target.value === "si")}>
                      <option value="no">Sin mensajero</option>
                      <option value="si">Con mensajero</option>
                    </select>
                  </div>
                )}
              </div>
              <button onClick={agregarCable} style={{ background: "#DAA520", color: "#000", border: "none", padding: "9px", borderRadius: "6px", width: "100%", cursor: "pointer", fontWeight: 700, fontSize: "0.8rem" }}>
                + Agregar Cable
              </button>

              {itemsCable.length > 0 && (
                <table>
                  <thead><tr><th>Tipo</th><th>Detalle</th><th>Cant</th><th>Total</th><th></th></tr></thead>
                  <tbody>
                    {itemsCable.map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.tipo}</td>
                        <td style={{ fontSize: "0.7rem" }}>{detalleConfigCable(item)}</td>
                        <td>{item.cantidad}</td>
                        <td>{fmt(item.precioCarrete * item.cantidad)}</td>
                        <td><button onClick={() => quitarCable(idx)} style={{ background: "none", border: "none", color: "#e74c3c", cursor: "pointer" }}>✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}

          {modo === "producto" && (
            <>
              <h3 style={{ color: "#DAA520", fontSize: "0.9rem", textTransform: "uppercase", marginTop: 0 }}>Producto Terminado</h3>
              <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
                {[["cablesdb", "Cables"], ["herrajesdb", "Herrajes"], ["accesoriosdb", "Accesorios"]].map(([k, label]) => (
                  <button key={k} onClick={() => setTablaProducto(k as any)}
                    style={{
                      padding: "7px 12px", borderRadius: "5px", fontSize: "0.72rem", cursor: "pointer",
                      border: tablaProducto === k ? "1px solid #DAA520" : "1px solid #333",
                      background: tablaProducto === k ? "#DAA520" : "transparent",
                      color: tablaProducto === k ? "#000" : "#DAA520",
                    }}>
                    {label}
                  </button>
                ))}
              </div>
              <input placeholder="Buscar por SKU o descripción..." value={busquedaProducto} onChange={(e) => setBusquedaProducto(e.target.value)} style={{ marginBottom: "10px" }} />

              {cargandoCatalogo ? (
                <p style={{ color: "#888", fontSize: "0.8rem" }}>Cargando catálogo...</p>
              ) : (
                <div style={{ maxHeight: "220px", overflowY: "auto", border: "1px solid rgba(218,165,32,0.2)", borderRadius: "6px" }}>
                  {catalogoFiltrado.slice(0, 50).map((prod, idx) => (
                    <div key={idx} onClick={() => agregarProducto(prod)} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderBottom: "1px solid #141414", cursor: "pointer" }}>
                      <div>
                        <span style={{ color: "#DAA520", fontWeight: 700, fontSize: "0.75rem" }}>{prod.SKU}</span>
                        <span style={{ color: "#ccc", fontSize: "0.75rem", marginLeft: "8px" }}>{prod.Descripción || prod.Ítem}</span>
                      </div>
                      <span style={{ color: "#2ecc71", fontSize: "0.75rem" }}>${Number(prod.precio_a || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}

              {itemsProducto.length > 0 && (
                <table>
                  <thead><tr><th>SKU</th><th>Cant</th><th>P. Unit</th><th>Total</th><th></th></tr></thead>
                  <tbody>
                    {itemsProducto.map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.SKU}</td>
                        <td><input type="number" min={1} value={item.cantidad} onChange={(e) => actualizarCantidadProducto(idx, parseInt(e.target.value) || 1)} style={{ width: "50px", padding: "3px" }} /></td>
                        <td>{fmt(item.precio)}</td>
                        <td>{fmt(item.precio * item.cantidad)}</td>
                        <td><button onClick={() => quitarProducto(idx)} style={{ background: "none", border: "none", color: "#e74c3c", cursor: "pointer" }}>✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>

        {/* ── Columna derecha: datos del cliente + resumen + guardar ── */}
        <div style={{ background: "#080808", border: "1px solid rgba(218,165,32,0.3)", borderRadius: "10px", padding: "22px" }}>
          <h3 style={{ color: "#DAA520", fontSize: "0.9rem", textTransform: "uppercase", marginTop: 0, marginBottom: "16px" }}>Cliente Destino</h3>

          <div style={{ marginBottom: "10px" }}>
            <label style={{ fontSize: "0.68rem", color: "#888", display: "block", marginBottom: "3px" }}>Email del cliente</label>
            <input
              type="email"
              placeholder="cliente@empresa.com"
              value={clienteEmail}
              onChange={(e) => setClienteEmail(e.target.value)}
              onBlur={() => buscarDatosCliente(clienteEmail)}
            />
            {buscandoCliente && <span style={{ fontSize: "0.68rem", color: "#888" }}>Buscando cliente...</span>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "18px" }}>
            <div>
              <label style={{ fontSize: "0.68rem", color: "#888", display: "block", marginBottom: "3px" }}>Empresa</label>
              <input value={empresaCliente} onChange={(e) => setEmpresaCliente(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: "0.68rem", color: "#888", display: "block", marginBottom: "3px" }}>Representante</label>
              <input value={representanteCliente} onChange={(e) => setRepresentanteCliente(e.target.value)} />
            </div>
            <div style={{ gridColumn: "1 / 3" }}>
              <label style={{ fontSize: "0.68rem", color: "#888", display: "block", marginBottom: "3px" }}>Teléfono</label>
              <input value={telefonoCliente} onChange={(e) => setTelefonoCliente(e.target.value)} />
            </div>
          </div>

          <div style={{ background: "rgba(218,165,32,0.06)", border: "1px dashed rgba(218,165,32,0.3)", borderRadius: "8px", padding: "16px", marginBottom: "18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#888", marginBottom: "6px" }}>
              <span>Referencia</span>
              <strong style={{ color: "#DAA520" }}>{referencia}</strong>
            </div>
            {lineasManuales.some((l) => l.descripcion.trim()) && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#888" }}>
                <span>Líneas manuales</span><span>{fmt(totalManual)}</span>
              </div>
            )}
            {itemsCable.length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#888" }}>
                <span>Cables ({itemsCable.length})</span><span>{fmt(totalItemsCable(itemsCable))}</span>
              </div>
            )}
            {itemsProducto.length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#888" }}>
                <span>Productos ({itemsProducto.length})</span><span>{fmt(totalItemsProducto(itemsProducto))}</span>
              </div>
            )}
            <div style={{ borderTop: "1px solid rgba(218,165,32,0.3)", marginTop: "10px", paddingTop: "10px", display: "flex", justifyContent: "space-between" }}>
              <strong style={{ color: "#FFF" }}>TOTAL</strong>
              <strong style={{ color: "#DAA520", fontSize: "1.1rem" }}>{fmt(totalGeneral)}</strong>
            </div>
          </div>

          <button
            onClick={guardarCotizacion}
            disabled={guardando || !hayContenido || !clienteEmail.trim()}
            style={{
              width: "100%", padding: "13px", borderRadius: "6px", fontWeight: 700, fontSize: "0.85rem",
              background: guardando || !hayContenido || !clienteEmail.trim() ? "#333" : "#DAA520",
              color: guardando || !hayContenido || !clienteEmail.trim() ? "#777" : "#000",
              border: "none", cursor: guardando || !hayContenido || !clienteEmail.trim() ? "not-allowed" : "pointer",
            }}
          >
            {guardando ? "Guardando..." : "💾 Guardar Cotización"}
          </button>
          <p style={{ fontSize: "0.7rem", color: "#666", marginTop: "10px", lineHeight: 1.5 }}>
            La cotización se guarda directo en <code>quotes</code>, igual que si el cliente la hubiera armado él mismo — queda integrada con checkout, pagos y contabilidad automáticamente.
          </p>
        </div>
      </div>
    </div>
  );
}