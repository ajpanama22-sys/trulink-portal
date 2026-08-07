import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { getSupabase } from "../lib/supabaseClient";

/* ============================================================
   CONTROL DE PEDIDOS — PORTAL DEL CLIENTE
   ------------------------------------------------------------
   Qué estaba roto en la versión anterior:

   1. Filtraba por quotes.client_id, columna que NO EXISTE.
      Las cotizaciones se guardan con "email", no con esa llave.
      Resultado: la pantalla nunca mostraba nada.

   2. order.id.slice(0, 8) — quotes.id es numérico, no texto.
      Esa línea revienta la página apenas entra un registro.

   3. Los estados mapeados (en_cola, control_calidad,
      listo_despacho) no son los que usa el sistema. Los reales
      salen del flujo administrativo: pending, aprobada,
      en_produccion, despachado_exw.

   Regla de negocio que se conserva:
   NUNCA se muestran precios, cantidades ni totales en esta
   pantalla. El cliente ve avance, no cifras.
   ============================================================ */

type Pedido = {
  id: any;
  referencia: string | null;
  type: string | null;
  status: string | null;
  created_at: string | null;
  fecha_estimada_entrega: string | null;
  aprobada: boolean | null;
  fecha_aprobacion: string | null;
  guia_envio: string | null;
  transportista: string | null;
  fecha_despacho: string | null;
  especificaciones_texto: string | null;
};

type OrdenProduccion = {
  quote_id: string | null;
  estado: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
};

/** Las cuatro etapas visibles para el cliente. */
const ETAPAS = ["Recibido", "Aprobado", "En producción", "Despachado"] as const;

const COLOR_ETAPA: Record<string, string> = {
  "Recibido": "#f39c12",
  "Aprobado": "#3498db",
  "En producción": "#9b59b6",
  "Despachado": "#2ecc71",
  "No aprobado": "#e74c3c",
};

const ETIQUETA_TIPO: Record<string, string> = {
  fabricacion: "Fabricación de cables",
  producto: "Productos terminados",
  especiales: "Pedido especial",
};

export default function SeguimientoPedidos() {
  const router = useRouter();
  const supabase = getSupabase();

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [producciones, setProducciones] = useState<OrdenProduccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [emailCliente, setEmailCliente] = useState("");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    if (!supabase) { setLoading(false); return; }
    setLoading(true);
    setMensaje("");

    try {
      // El correo se busca primero en la sesión de Supabase Auth y, si no
      // está, en la sesión propia del portal. Se cubren ambos casos porque
      // el login del portal no siempre genera sesión de Auth.
      let email = "";
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) email = user.email.trim();
      } catch { /* sin sesión de Auth */ }

      if (!email) {
        email =
          sessionStorage.getItem("trulink_usuario_email") ||
          sessionStorage.getItem("userEmail") ||
          "";
      }

      if (!email) {
        setMensaje("No se pudo identificar tu sesión. Vuelve a iniciar sesión desde el portal.");
        setLoading(false);
        return;
      }

      setEmailCliente(email);

      // ilike en vez de eq: evita que una diferencia de mayúsculas entre
      // Auth y la tabla deje al cliente sin ver sus propios pedidos.
      const { data, error } = await supabase
        .from("quotes")
        .select("id, referencia, type, status, created_at, fecha_estimada_entrega, aprobada, fecha_aprobacion, guia_envio, transportista, fecha_despacho, especificaciones_texto")
        .ilike("email", email)
        .order("created_at", { ascending: false });

      if (error) {
        setMensaje("No se pudo cargar el seguimiento en este momento.");
        console.error("Error consultando quotes:", error.message);
      } else {
        setPedidos(data || []);
      }

      // Las órdenes de producción refinan el estado de lo fabricado
      const { data: ops } = await supabase
        .from("ordenes_produccion")
        .select("quote_id, estado, fecha_inicio, fecha_fin");
      setProducciones(ops || []);
    } catch (err) {
      console.error("Error cargando seguimiento:", err);
      setMensaje("Ocurrió un problema al cargar tus pedidos.");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Traduce el estado interno a la etapa que ve el cliente.
   * Se apoya en el flujo administrativo real: aprobación en
   * Manufactura, orden de producción y despacho EXW.
   */
  const etapaDe = (p: Pedido): { etapa: string; detalle: string } => {
    const st = String(p.status || "").toLowerCase();

    if (st === "despachado_exw") {
      return {
        etapa: "Despachado",
        detalle: p.guia_envio
          ? `Guía ${p.guia_envio}${p.transportista ? ` · ${p.transportista}` : ""}`
          : "Mercancía entregada bajo condición EXW Panamá",
      };
    }

    if (st === "rechazada" || st === "rechazado") {
      return { etapa: "No aprobado", detalle: "Contáctanos para revisar tu solicitud" };
    }

    const op = producciones.find((o) => String(o.quote_id) === String(p.id));
    if (op) {
      if (op.estado === "Completada") {
        return { etapa: "En producción", detalle: "Producción terminada, preparando despacho" };
      }
      if (op.estado === "En producción") {
        return { etapa: "En producción", detalle: "Tu pedido está en la línea de fabricación" };
      }
      return { etapa: "Aprobado", detalle: "Producción programada" };
    }

    if (p.aprobada) {
      return { etapa: "Aprobado", detalle: "Tu pedido fue aprobado y entró en cola" };
    }

    return { etapa: "Recibido", detalle: "Estamos revisando tu solicitud" };
  };

  const indiceEtapa = (etapa: string) => {
    const i = ETAPAS.indexOf(etapa as any);
    return i >= 0 ? i : -1;
  };

  /**
   * Filtra los pedidos por referencia (o por número de pedido si la
   * referencia viene vacía). Búsqueda insensible a mayúsculas/acentos
   * simples, por coincidencia parcial.
   */
  const pedidosFiltrados = pedidos.filter((p) => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return true;
    const ref = (p.referencia || "").toLowerCase();
    const idStr = String(p.id || "").toLowerCase();
    return ref.includes(q) || idStr.includes(q);
  });

  /* ========================================================
     RENDER
     ======================================================== */

  return (
    <div style={{ backgroundColor: "#000", minHeight: "100vh", color: "#fff", padding: "40px 20px", fontFamily: "'Inter', sans-serif" }}>
      <style jsx global>{`
        html, body { margin:0; padding:0; background:#000 !important; }
        .sg-volver { background:transparent; color:#DAA520; border:1px solid #DAA520;
                     padding:9px 18px; border-radius:8px; cursor:pointer; font-weight:600;
                     font-size:0.82rem; transition:all .3s ease; }
        .sg-volver:hover { background:#DAA520; color:#000; }
        .sg-card { background:#0a0a0a; border:1px solid rgba(218,165,32,0.35); border-radius:14px;
                   padding:22px 24px; transition:all .3s ease; }
        .sg-card:hover { border-color:#DAA520; box-shadow:0 0 20px rgba(218,165,32,0.12); }
        .sg-punto { width:11px; height:11px; border-radius:50%; flex-shrink:0; }
        .sg-linea { flex:1; height:2px; }
        .sg-buscador { width:100%; box-sizing:border-box; background:#0a0a0a; color:#fff;
                       border:1px solid rgba(218,165,32,0.35); border-radius:10px;
                       padding:12px 16px; font-size:0.9rem; font-family:'Inter', sans-serif;
                       outline:none; transition:border-color .3s ease; }
        .sg-buscador:focus { border-color:#DAA520; }
        .sg-buscador::placeholder { color:#666; }
        .sg-limpiar { background:transparent; color:#888; border:1px solid #333; border-radius:8px;
                      padding:12px 16px; cursor:pointer; font-size:0.82rem; white-space:nowrap; }
        .sg-limpiar:hover { color:#DAA520; border-color:#DAA520; }
      `}</style>

      <div style={{ maxWidth: "860px", margin: "0 auto" }}>
        <button onClick={() => router.push("/portal-cliente")} className="sg-volver" style={{ marginBottom: "30px" }}>
          ← Volver al Portal
        </button>

        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <h1 style={{ color: "#DAA520", margin: "0 0 10px 0", letterSpacing: "2px", fontSize: "1.6rem", fontWeight: 400, textTransform: "uppercase" }}>
            Control de Pedidos
          </h1>
          <div style={{ width: "60px", height: "2px", background: "#DAA520", margin: "0 auto 14px auto", opacity: 0.6 }} />
          <p style={{ color: "#888", fontSize: "0.9rem", margin: 0 }}>
            Seguimiento de tus solicitudes especiales, de fabricación y de bodega
          </p>
        </div>

        {!loading && !mensaje && pedidos.length > 0 && (
          <div style={{ display: "flex", gap: "10px", marginBottom: "26px" }}>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por referencia o número de pedido..."
              className="sg-buscador"
            />
            {busqueda && (
              <button onClick={() => setBusqueda("")} className="sg-limpiar">
                Limpiar
              </button>
            )}
          </div>
        )}

        {loading ? (
          <p style={{ textAlign: "center", color: "#DAA520" }}>Cargando seguimiento...</p>
        ) : mensaje ? (
          <div style={{ textAlign: "center", padding: "40px", border: "1px dashed #333", borderRadius: "12px" }}>
            <p style={{ color: "#e74c3c", margin: "0 0 8px 0" }}>{mensaje}</p>
            <button onClick={cargar} className="sg-volver" style={{ marginTop: "10px" }}>Reintentar</button>
          </div>
        ) : pedidos.length === 0 ? (
          <div style={{ textAlign: "center", padding: "50px 40px", border: "1px dashed #333", borderRadius: "12px" }}>
            <p style={{ color: "#888", fontSize: "1rem", margin: "0 0 8px 0" }}>
              Todavía no tienes pedidos registrados.
            </p>
            <p style={{ color: "#555", fontSize: "0.85rem", margin: 0 }}>
              Cuando solicites una cotización, aparecerá aquí con su avance.
            </p>
          </div>
        ) : pedidosFiltrados.length === 0 ? (
          <div style={{ textAlign: "center", padding: "50px 40px", border: "1px dashed #333", borderRadius: "12px" }}>
            <p style={{ color: "#888", fontSize: "1rem", margin: "0 0 8px 0" }}>
              No se encontraron pedidos que coincidan con "{busqueda}".
            </p>
            <button onClick={() => setBusqueda("")} className="sg-volver" style={{ marginTop: "10px" }}>
              Ver todos los pedidos
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            {pedidosFiltrados.map((p) => {
              const { etapa, detalle } = etapaDe(p);
              const idx = indiceEtapa(etapa);
              const color = COLOR_ETAPA[etapa] || "#DAA520";
              const rechazado = etapa === "No aprobado";

              return (
                <div key={String(p.id)} className="sg-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "14px", marginBottom: "18px" }}>
                    <div>
                      <h3 style={{ color: "#DAA520", margin: "0 0 6px 0", fontSize: "1.05rem", letterSpacing: "0.5px" }}>
                        {p.referencia || `Pedido #${String(p.id)}`}
                      </h3>
                      <p style={{ color: "#bbb", margin: "0 0 4px 0", fontSize: "0.86rem" }}>
                        {ETIQUETA_TIPO[String(p.type || "").toLowerCase()] || "Solicitud"}
                      </p>
                      {p.especificaciones_texto && (
                        <p style={{ color: "#777", margin: "0 0 4px 0", fontSize: "0.78rem", maxWidth: "440px" }}>
                          {p.especificaciones_texto.length > 110
                            ? p.especificaciones_texto.slice(0, 110) + "..."
                            : p.especificaciones_texto}
                        </p>
                      )}
                      <span style={{ fontSize: "0.74rem", color: "#666" }}>
                        Solicitado el {p.created_at ? new Date(p.created_at).toLocaleDateString() : "—"}
                      </span>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={{
                        display: "inline-block", padding: "7px 16px", borderRadius: "20px",
                        background: `${color}20`, border: `1px solid ${color}`, color,
                        fontWeight: "bold", fontSize: "0.82rem", whiteSpace: "nowrap",
                      }}>
                        ● {etapa}
                      </div>
                      {p.fecha_estimada_entrega && !rechazado && etapa !== "Despachado" && (
                        <div style={{ fontSize: "0.72rem", color: "#777", marginTop: "7px" }}>
                          Entrega estimada: {new Date(p.fecha_estimada_entrega).toLocaleDateString()}
                        </div>
                      )}
                      {p.fecha_despacho && (
                        <div style={{ fontSize: "0.72rem", color: "#2ecc71", marginTop: "7px" }}>
                          Despachado el {new Date(p.fecha_despacho).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Barra de avance por etapas */}
                  {!rechazado && (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
                      {ETAPAS.map((e, i) => {
                        const alcanzada = idx >= i;
                        const c = alcanzada ? COLOR_ETAPA[e] : "#2a2a2a";
                        return (
                          <div key={e} style={{ display: "flex", alignItems: "center", flex: i < ETAPAS.length - 1 ? 1 : "0 0 auto", gap: "6px" }}>
                            <div className="sg-punto" style={{
                              background: c,
                              boxShadow: idx === i ? `0 0 10px ${c}` : "none",
                            }} />
                            {i < ETAPAS.length - 1 && (
                              <div className="sg-linea" style={{ background: idx > i ? COLOR_ETAPA[ETAPAS[i + 1]] : "#2a2a2a" }} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {!rechazado && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "#666", marginBottom: "12px" }}>
                      {ETAPAS.map((e, i) => (
                        <span key={e} style={{ color: idx >= i ? COLOR_ETAPA[e] : "#444", flex: 1, textAlign: i === 0 ? "left" : i === ETAPAS.length - 1 ? "right" : "center" }}>
                          {e}
                        </span>
                      ))}
                    </div>
                  )}

                  <p style={{ color: "#999", fontSize: "0.82rem", margin: 0, paddingTop: "12px", borderTop: "1px solid #1a1a1a" }}>
                    {detalle}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {emailCliente && !loading && (
          <p style={{ textAlign: "center", color: "#444", fontSize: "0.72rem", marginTop: "35px" }}>
            Mostrando pedidos de {emailCliente}
            {busqueda && pedidosFiltrados.length !== pedidos.length
              ? ` · ${pedidosFiltrados.length} de ${pedidos.length} resultados`
              : ""}
          </p>
        )}
      </div>
    </div>
  );
}
