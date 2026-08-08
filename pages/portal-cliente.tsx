import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import { useRequiereCliente } from "../lib/useRequiereCliente";
import { theme } from "../lib/theme";
import { Card, Heading, Button } from "../lib/ui";
import { useI18n } from "../lib/i18n/LanguageContext";
import LanguageSwitcher from "../components/LanguageSwitcher";

export default function PortalCliente() {
  const router = useRouter();
  const { t } = useI18n();
  const { cargando, autorizado } = useRequiereCliente();
  const [mostrarModalNotif, setMostrarModalNotif] = useState(false);
  const [pushNotif, setPushNotif] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [userCelular, setUserCelular] = useState("");
  const [mensajeModal, setMensajeModal] = useState("");

  useEffect(() => {
    if (!autorizado) return;
    const debeMostrar = sessionStorage.getItem("trulink_mostrar_modal_notif");
    if (debeMostrar === "true") {
      setMostrarModalNotif(true);
      cargarDatosUsuario();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autorizado]);

  const cargarDatosUsuario = async () => {
    if (!supabase) return;

    let authEmail = "";
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.email) {
        authEmail = user.email;
      }
    } catch (e) {
      console.error("Error obteniendo usuario auth:", e);
    }

    const tablaSesion = sessionStorage.getItem("trulink_usuario_tabla");
    const idUsuario = sessionStorage.getItem("trulink_usuario_id");
    const emailSession = authEmail || sessionStorage.getItem("trulink_usuario_email") || sessionStorage.getItem("userEmail");

    const tablasAConsultar = [tablaSesion, "clientes", "clients"].filter(Boolean) as string[];
    const tablasUnicas = Array.from(new Set(tablasAConsultar));

    let telefonoEncontrado = "";
    let emailEncontrado = emailSession || "";

    if (idUsuario && tablaSesion) {
      const { data, error } = await supabase
        .from(tablaSesion)
        .select("email, telefono_celular, telefono_oficina")
        .eq("id", idUsuario)
        .maybeSingle();

      if (error) {
        console.error(`Error consultando ${tablaSesion} por id:`, error);
      }

      if (data) {
        telefonoEncontrado = data.telefono_celular || data.telefono_oficina || "";
        if (data.email) emailEncontrado = data.email;
      }
    }

    if (!telefonoEncontrado && emailSession) {
      for (const t of tablasUnicas) {
        const { data, error } = await supabase
          .from(t)
          .select("email, telefono_celular, telefono_oficina")
          .ilike("email", emailSession)
          .maybeSingle();

        if (error) {
          console.error(`Error consultando ${t} por email:`, error);
        }

        if (data) {
          const tel = data.telefono_celular || data.telefono_oficina;
          if (tel) {
            telefonoEncontrado = tel;
            if (data.email) emailEncontrado = data.email;
            break;
          }
        }
      }
    }

    setUserEmail(emailEncontrado || emailSession || "No registrado");
    setUserCelular(telefonoEncontrado || "No registrado");
  };

  const handleGuardarNotificaciones = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    const tabla = sessionStorage.getItem("trulink_usuario_tabla") || "clientes";
    const idUsuario = sessionStorage.getItem("trulink_usuario_id");

    if (idUsuario) {
      const { error } = await supabase
        .from(tabla)
        .update({
          email: userEmail,
          telefono_celular: userCelular !== "No registrado" ? userCelular : null
        })
        .eq('id', idUsuario);

      if (error) {
        setMensajeModal("Error al guardar: " + error.message);
        return;
      }
    }

    sessionStorage.removeItem("trulink_mostrar_modal_notif");
    sessionStorage.removeItem("trulink_usuario_tabla");
    sessionStorage.removeItem("trulink_usuario_id");
    setMostrarModalNotif(false);
  };

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    sessionStorage.clear();
    localStorage.clear();
    router.push("/");
  };

  if (cargando) {
    return (
      <div style={{
        backgroundColor: theme.background,
        color: theme.gold,
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: theme.fontFamily,
      }}>
        <p>{t("common.loadingVerifying")}</p>
      </div>
    );
  }
  if (!autorizado) return null;

  return (
    <div style={{
      backgroundColor: theme.background,
      color: theme.gold,
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "space-between",
      position: "relative",
      padding: "40px 20px",
      fontFamily: theme.fontFamily,
      overflowX: "hidden"
    }}>
      <style jsx global>{`
        html, body {
          margin: 0;
          padding: 0;
          background-color: ${theme.background} !important;
          color: ${theme.gold};
        }
        .trulink-card {
          background: linear-gradient(145deg, rgba(15,15,15,0.9), rgba(5,5,5,0.95));
          border: 1px solid rgba(218, 165, 32, 0.3);
          border-radius: 16px;
          padding: 22px;
          width: 270px;
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 10px 30px rgba(0,0,0,0.9);
          position: relative;
          z-index: 2;
          overflow: hidden;
          box-sizing: border-box;
          text-align: center;
          backdrop-filter: blur(5px);
        }
        .trulink-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(218, 165, 32, 0.12), transparent);
          transition: 0.5s;
        }
        .trulink-card:hover::before {
          left: 100%;
        }
        .trulink-card:hover {
          transform: translateY(-8px);
          border-color: ${theme.gold};
          box-shadow: 0 0 35px ${theme.borderGoldCounter}, 0 15px 35px rgba(0,0,0,0.9);
        }
        .card-img-container {
          width: 100%;
          height: 155px;
          border-radius: 10px;
          overflow: hidden;
          margin-bottom: 18px;
          border: 1px solid ${theme.borderGoldLight};
        }
        .card-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .trulink-card:hover .card-img {
          transform: scale(1.08);
        }
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        .modal-content {
          animation: fadeInScale 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {mostrarModalNotif && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          backgroundColor: "rgba(0, 0, 0, 0.85)",
          backdropFilter: "blur(8px)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 9999,
          padding: "20px"
        }}>
          <Card style={{ maxWidth: "460px", width: "100%", boxSizing: "border-box", marginBottom: 0 }}>
            <div className="modal-content">
              <Heading
                style={{
                  textAlign: "center",
                  fontSize: "1.1rem",
                  textTransform: "uppercase",
                  letterSpacing: "1.5px",
                  marginBottom: "12px",
                }}
              >
                {t("portalCliente.modalTitle")}
              </Heading>
              <p style={{ fontSize: "0.85rem", color: theme.textMuted, marginBottom: "25px", textAlign: "center", lineHeight: "1.6" }}>
                {t("portalCliente.modalBody")}
              </p>

              <div style={{ backgroundColor: theme.background, border: `1px solid ${theme.borderGold}`, padding: "18px", borderRadius: theme.radiusMd, marginBottom: "25px" }}>
                <p style={{ fontSize: "0.88rem", marginBottom: "10px", color: theme.textLight }}>
                  📧 <strong style={{ color: theme.gold, marginLeft: "6px" }}>{t("portalCliente.modalEmail")}</strong> {userEmail || t("common.loading")}
                </p>
                <p style={{ fontSize: "0.88rem", color: theme.textLight, margin: 0 }}>
                  📱 <strong style={{ color: theme.gold, marginLeft: "6px" }}>{t("portalCliente.modalCelular")}</strong> {userCelular || t("portalCliente.modalCelularEmpty")}
                </p>
              </div>

              <form onSubmit={handleGuardarNotificaciones}>
                <div style={{ display: "flex", alignItems: "center", marginBottom: "25px", gap: "12px" }}>
                  <input
                    type="checkbox"
                    id="pushCheck"
                    checked={pushNotif}
                    onChange={(e) => setPushNotif(e.target.checked)}
                    style={{ accentColor: theme.gold, width: "18px", height: "18px", cursor: "pointer" }}
                  />
                  <label htmlFor="pushCheck" style={{ fontSize: "0.83rem", cursor: "pointer", color: theme.textLight }}>
                    {t("portalCliente.modalCheckboxLabel")}
                  </label>
                </div>

                <Button
                  type="submit"
                  variant="gold"
                  style={{
                    width: "100%",
                    padding: "14px",
                    textTransform: "uppercase",
                    letterSpacing: "1.5px",
                  }}
                >
                  {t("portalCliente.modalBtnConfirm")}
                </Button>

                {mensajeModal && (
                  <p style={{ marginTop: "15px", color: theme.red, textAlign: "center", fontSize: "0.85rem" }}>{mensajeModal}</p>
                )}
              </form>
            </div>
          </Card>
        </div>
      )}

      <div style={{ width: "100%", maxWidth: "1200px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", zIndex: 2, position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <img src="/images/trulink-logo.png" alt="Trulink Fiber" style={{ height: "36px", objectFit: "contain" }} onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
          <span style={{ fontSize: "0.75rem", letterSpacing: "3px", color: theme.gold, opacity: 0.6, textTransform: "uppercase" }}>{t("portalCliente.badge")}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <LanguageSwitcher />
          <Button variant="outline-gold" onClick={handleLogout}>
            {t("common.logout")}
          </Button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", margin: "auto 0", zIndex: 2, position: "relative" }}>
        <div style={{ textAlign: "center", marginBottom: "45px" }}>
          <Heading
            style={{
              textAlign: "center",
              fontSize: "1.7rem",
              fontWeight: 400,
              textTransform: "uppercase",
              letterSpacing: "3px",
              marginBottom: "10px",
            }}
          >
            {t("portalCliente.heading")}
          </Heading>
          <div style={{ width: "60px", height: "2px", backgroundColor: theme.gold, margin: "0 auto", opacity: 0.6 }}></div>
        </div>

        <div style={{ display: "flex", gap: "25px", flexWrap: "wrap", justifyContent: "center", maxWidth: "1200px" }}>
          <div className="trulink-card" onClick={() => router.push("/especiales")}>
            <div className="card-img-container">
              <img src="/images/especiales.jpg" alt={t("portalCliente.cardEspeciales")} className="card-img" />
            </div>
            <h2 style={{ color: theme.gold, fontSize: "1rem", margin: 0, fontWeight: 500, letterSpacing: "0.8px" }}>{t("portalCliente.cardEspeciales")}</h2>
          </div>

          <div className="trulink-card" onClick={() => router.push("/fabricacion")}>
            <div className="card-img-container">
              <img src="/images/fabrica.png" alt={t("portalCliente.cardFabricacion")} className="card-img" />
            </div>
            <h2 style={{ color: theme.gold, fontSize: "1rem", margin: 0, fontWeight: 500, letterSpacing: "0.8px" }}>{t("portalCliente.cardFabricacion")}</h2>
          </div>

          <div className="trulink-card" onClick={() => router.push("/productos")}>
            <div className="card-img-container">
              <img src="/images/terminado.png" alt={t("portalCliente.cardProductos")} className="card-img" />
            </div>
            <h2 style={{ color: theme.gold, fontSize: "1rem", margin: 0, fontWeight: 500, letterSpacing: "0.8px" }}>{t("portalCliente.cardProductos")}</h2>
          </div>

          <div className="trulink-card" onClick={() => router.push("/seguimiento")}>
            <div className="card-img-container">
              <img src="/images/pedidos.png" alt={t("portalCliente.cardSeguimiento")} className="card-img" />
            </div>
            <h2 style={{ color: theme.gold, fontSize: "1rem", margin: 0, fontWeight: 500, letterSpacing: "0.8px" }}>{t("portalCliente.cardSeguimiento")}</h2>
          </div>
        </div>
      </div>

      <div style={{ width: "100%", textAlign: "center", marginTop: "40px", fontSize: "0.75rem", color: theme.gold, opacity: 0.4, letterSpacing: "1px", zIndex: 2, position: "relative" }}>
        {t("common.companyFooterAlt")}
      </div>
    </div>
  );
}
