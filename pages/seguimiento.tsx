import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { getSupabase } from "../lib/supabaseClient";
import { useRequiereCliente } from "../lib/useRequiereCliente";
import { theme } from "../lib/theme";
import { Card, Button, DataRow, inputStyle } from "../lib/ui";
import { useI18n } from "../lib/i18n/LanguageContext";
import LanguageSwitcher from "../components/LanguageSwitcher";

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

const ETAPAS_KEY = ["recibido", "aprobado", "enProduccion", "despachado"] as const;

const COLOR_ETAPA: Record<string, string> = {
  "Recibido": "#f39c12",
  "Aprobado": "#3498db",
  "En producción": "#9b59b6",
  "Despachado": theme.green,
  "No aprobado": theme.red,
};

export default function SeguimientoPedidos() {
  const router = useRouter();
  const { t } = useI18n();
  const supabase = getSupabase();
  const { cargando: cargandoGuard, autorizado } = useRequiereCliente();

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
        setMensaje(t("seguimiento.errNoSesion"));
        setLoading(false);
        return;
      }

      setEmailCliente(email);

      const { data, error } = await supabase
        .from("quotes")
        .select("id, referencia, type, status, created_at, fecha_estimada_entrega, aprobada, fecha_aprobacion, guia_envio, transportista, fecha_despacho, especificaciones_texto")
        .ilike("email", email)
        .order("created_at", { ascending: false });

      if (error) {
        setMensaje(t("seguimiento.errCarga"));
        console.error("Error consultando quotes:", error.message);
      } else {
        setPedidos(data || []);
      }

      const { data: ops } = await supabase
        .from("ordenes_produccion")
        .select("quote_id, estado, fecha_inicio, fecha_fin");
      setProducciones(ops || []);
    } catch (err) {
      console.error("Error cargando seguimiento:", err);
      setMensaje(t("seguimiento.errGeneral"));
    } finally {
      setLoading(false);
    }
  };

  const ETAPAS = [
    t("seguimiento.etapas.recibido"),
    t("seguimiento.etapas.aprobado"),
    t("seguimiento.etapas.enProduccion"),
    t("seguimiento.etapas.despachado"),
  ];

  const etapaDe = (p: Pedido): { etapa: string; detalle: string } => {
    const st = String(p.status || "").toLowerCase();

    if (st === "despachado_exw") {
      return {
        etapa: t("seguimiento.etapas.despachado"),
        detalle: p.guia_envio
          ? `Guía ${p.guia_envio}${p.transportista ? ` · ${p.transportista}` : ""}`
          : t("seguimiento.detalleDespachadoDefault"),
      };
    }

    if (st === "rechazada" || st === "rechazado") {
      return { etapa: t("seguimiento.etapas.noAprobado"), detalle: t("seguimiento.detalleNoAprobado") };
    }

    const op = producciones.find((o) => String(o.quote_id) === String(p.id));
    if (op) {
      if (op.estado === "Completada") {
        return { etapa: t("seguimiento.etapas.enProduccion"), detalle: t("seguimiento.detalleProduccionTerminada") };
      }
      if (op.estado === "En producción") {
        return { etapa: t("seguimiento.etapas.enProduccion"), detalle: t("seguimiento.detalleEnProduccion") };
      }
      return { etapa: t("seguimiento.etapas.aprobado"), detalle: t("seguimiento.detalleProduccionProgramada") };
    }

    if (p.aprobada) {
      return { etapa: t("seguimiento.etapas.aprobado"), detalle: t("seguimiento.detalleAprobado") };
    }

    return { etapa: t("seguimiento.etapas.recibido"), detalle: t("seguimiento.detalleRecibido") };
  };

  const indiceEtapa = (etapa: string) => {
    const i = ETAPAS.indexOf(etapa);
    return i >= 0 ? i : -1;
  };

  const etiquetaTipo = (tipo: string) => {
    const key = tipo.toLowerCase();
    if (key === "fabricacion") return t("seguimiento.tipoFabricacion");
    if (key === "producto") return t("seguimiento.tipoProducto");
    if (key === "especiales") return t("seguimiento.tipoEspeciales");
    return t("seguimiento.tipoSolicitud");
  };

  const pedidosFiltrados = pedidos.filter((p) => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return true;
    const ref = (p.referencia || "").toLowerCase();
    const idStr = String(p.id || "").toLowerCase();
    return ref.includes(q) || idStr.includes(q);
  });

  if (cargandoGuard) {
    return <p style={{ color: "#DAA520", textAlign: "center", marginTop: "60px" }}>{t("common.loadingVerifying")}</p>;
  }
  if (!autorizado) return null;

  return (
    <div style={{ backgroundColor: theme.background, minHeight: "100vh", color: theme.textLight, padding: "40px 20px", fontFamily: theme.fontFamily }}>
      <style jsx global>{`
        html, body { margin:0; padding:0; background:${theme.background} !important; }
        .sg-card-hover:hover > div { border-color:${theme.gold} !important; box-shadow:0 0 20px rgba(218,165,32,0.12) !important; }
        .sg-punto { width:11px; height:11px; border-radius:50%; flex-shrink:0; }
        .sg-linea { flex:1; height:2px; }
        .sg-buscador:focus { border-color:${theme.gold} !important; }
        .sg-buscador::placeholder { color:${theme.textMuted}; }
      `}</style>

      <div style={{ maxWidth: "860px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px", flexWrap: "wrap", gap: "12px" }}>
          <Button variant="outline-gold" onClick={() => router.push("/portal-cliente")}>
            {t("common.backToPortal")}
          </Button>
          <LanguageSwitcher />
        </div>

        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <h1 style={{ color: theme.gold, margin: "0 0 10px 0", letterSpacing: "2px", fontSize: "1.6rem", fontWeight: 400, textTransform: "uppercase" }}>
            {t("seguimiento.title")}
          </h1>
          <div style={{ width: "60px", height: "2px", background: theme.gold, margin: "0 auto 14px auto", opacity: 0.6 }} />
          <p style={{ color: theme.textMuted, fontSize: "0.9rem", margin: 0 }}>
            {t("seguimiento.subtitle")}
          </p>
        </div>

        {!loading && !mensaje && pedidos.length > 0 && (
          <div style={{ display: "flex", gap: "10px", marginBottom: "26px" }}>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder={t("seguimiento.placeholderBuscar")}
              className="sg-buscador"
              style={{ ...inputStyle, width: "100%", boxSizing: "border-box", padding: "12px 16px", fontSize: "0.9rem" }}
            />
            {busqueda && (
              <Button variant="ghost" onClick={() => setBusqueda("")} style={{ whiteSpace: "nowrap" }}>
                {t("seguimiento.btnLimpiar")}
              </Button>
            )}
          </div>
        )}

        {loading ? (
          <p style={{ textAlign: "center", color: theme.gold }}>{t("seguimiento.loading")}</p>
        ) : mensaje ? (
          <div style={{ textAlign: "center", padding: "40px", border: `1px dashed ${theme.neutralBorder}`, borderRadius: theme.radiusLg }}>
            <p style={{ color: theme.red, margin: "0 0 8px 0" }}>{mensaje}</p>
            <Button variant="outline-gold" onClick={cargar} style={{ marginTop: "10px" }}>{t("common.retry")}</Button>
          </div>
        ) : pedidos.length === 0 ? (
          <div style={{ textAlign: "center", padding: "50px 40px", border: `1px dashed ${theme.neutralBorder}`, borderRadius: theme.radiusLg }}>
            <p style={{ color: theme.textMuted, fontSize: "1rem", margin: "0 0 8px 0" }}>
              {t("seguimiento.emptyTitle")}
            </p>
            <p style={{ color: theme.textMuted, opacity: 0.7, fontSize: "0.85rem", margin: 0 }}>
              {t("seguimiento.emptyBody")}
            </p>
          </div>
        ) : pedidosFiltrados.length === 0 ? (
          <div style={{ textAlign: "center", padding: "50px 40px", border: `1px dashed ${theme.neutralBorder}`, borderRadius: theme.radiusLg }}>
            <p style={{ color: theme.textMuted, fontSize: "1rem", margin: "0 0 8px 0" }}>
              {t("seguimiento.noResultsTitle")} "{busqueda}".
            </p>
            <Button variant="outline-gold" onClick={() => setBusqueda("")} style={{ marginTop: "10px" }}>
              {t("seguimiento.btnVerTodos")}
            </Button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            {pedidosFiltrados.map((p) => {
              const { etapa, detalle } = etapaDe(p);
              const idx = indiceEtapa(etapa);
              const color = COLOR_ETAPA[etapa] || theme.gold;
              const rechazado = etapa === t("seguimiento.etapas.noAprobado");

              return (
                <div key={String(p.id)} className="sg-card-hover">
                  <Card style={{ marginBottom: 0, transition: "all 0.3s ease" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "14px", marginBottom: "18px" }}>
                      <div>
                        <h3 style={{ color: theme.gold, margin: "0 0 6px 0", fontSize: "1.05rem", letterSpacing: "0.5px" }}>
                          {p.referencia || `#${String(p.id)}`}
                        </h3>
                        <p style={{ color: theme.textMuted, margin: "0 0 4px 0", fontSize: "0.86rem" }}>
                          {etiquetaTipo(String(p.type || ""))}
                        </p>
                        {p.especificaciones_texto && (
                          <p style={{ color: theme.textMuted, opacity: 0.8, margin: "0 0 4px 0", fontSize: "0.78rem", maxWidth: "440px" }}>
                            {p.especificaciones_texto.length > 110
                              ? p.especificaciones_texto.slice(0, 110) + "..."
                              : p.especificaciones_texto}
                          </p>
                        )}
                        <DataRow label={t("seguimiento.solicitado")} valor={p.created_at ? new Date(p.created_at).toLocaleDateString() : "—"} />
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <div style={{
                          display: "inline-block", padding: "7px 16px", borderRadius: "20px",
                          background: `${color}20`, border: `1px solid ${color}`, color,
                          fontWeight: "bold", fontSize: "0.82rem", whiteSpace: "nowrap",
                        }}>
                          ● {etapa}
                        </div>
                        {p.fecha_estimada_entrega && !rechazado && etapa !== t("seguimiento.etapas.despachado") && (
                          <div style={{ marginTop: "7px" }}>
                            <DataRow label={t("seguimiento.entregaEstimada")} valor={new Date(p.fecha_estimada_entrega).toLocaleDateString()} />
                          </div>
                        )}
                        {p.fecha_despacho && (
                          <div style={{ marginTop: "7px" }}>
                            <DataRow label={t("seguimiento.despachadoEl")} valor={<span style={{ color: theme.green }}>{new Date(p.fecha_despacho).toLocaleDateString()}</span>} />
                          </div>
                        )}
                      </div>
                    </div>

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
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: theme.textMuted, marginBottom: "12px" }}>
                        {ETAPAS.map((e, i) => (
                          <span key={e} style={{ color: theme.textMuted, opacity: idx >= i ? 1 : 0.4, flex: 1, textAlign: i === 0 ? "left" : i === ETAPAS.length - 1 ? "right" : "center" }}>
                            {e}
                          </span>
                        ))}
                      </div>
                    )}

                    <p style={{ color: theme.textMuted, fontSize: "0.82rem", margin: 0, paddingTop: "12px", borderTop: `1px solid ${theme.borderGoldLight}` }}>
                      {detalle}
                    </p>
                  </Card>
                </div>
              );
            })}
          </div>
        )}

        {emailCliente && !loading && (
          <p style={{ textAlign: "center", color: theme.textMuted, opacity: 0.6, fontSize: "0.72rem", marginTop: "35px" }}>
            {t("seguimiento.mostrandoPedidos")} {emailCliente}
            {busqueda && pedidosFiltrados.length !== pedidos.length
              ? ` · ${pedidosFiltrados.length} ${t("seguimiento.deResultados")} ${pedidos.length} ${t("seguimiento.resultados")}`
              : ""}
          </p>
        )}
      </div>
    </div>
  );
}
