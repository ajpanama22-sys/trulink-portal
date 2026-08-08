import { useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import { theme } from "../lib/theme";
import { Button, inputStyle as baseInputStyle } from "../lib/ui";
import { useI18n } from "../lib/i18n/LanguageContext";
import LanguageSwitcher from "../components/LanguageSwitcher";

export default function Login() {
  const { t } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState(
    router.query.error === "no_autorizado"
      ? "Tu cuenta de proveedor aún no está homologada o el portal no ha sido activado para tu perfil."
      : ""
  );

  // Se conserva el borderRadius "15px" distintivo de esta página vía override.
  const inputStyle: React.CSSProperties = {
    ...baseInputStyle,
    width: "100%",
    marginBottom: "15px",
    padding: "12px",
    borderRadius: "15px",
    transition: "all 0.3s ease",
    boxSizing: "border-box"
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!supabase) {
      setMensaje(t("login.errNoClient"));
      return;
    }

    setMensaje(t("login.msgChecking"));

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMensaje(t("login.msgDenied") + error.message);
      return;
    }

    setMensaje(t("login.msgGranted"));

    // Verificar si el usuario está registrado en la tabla de clientes
    const { data: clienteData } = await supabase
      .from('clientes')
      .select('email')
      .eq('email', email)
      .single();

    if (clienteData) {
      window.location.href = '/portal-cliente';
      return;
    }

    // Verificar si es colaborador (Unidad Administrativa)
    const { data: colaboradorData } = await supabase
      .from('colaboradores')
      .select('email')
      .eq('email', email)
      .single();

    if (colaboradorData) {
      window.location.href = '/admin';
      return;
    }

    // Verificar si es proveedor: la sesión ya es válida (mismo Supabase
    // Auth), así que se lo manda directo a su portal.
    const { data: proveedorData } = await supabase
      .from('proveedores')
      .select('email')
      .eq('email', email)
      .single();

    if (proveedorData) {
      window.location.href = '/vendor-portal';
      return;
    }

    // Ningún rol conocido: no dejar pasar a una pantalla genérica.
    await supabase.auth.signOut();
    setMensaje("Tu cuenta no tiene un rol asignado. Contactá a un administrador.");
  };

  return (
    <div style={{
      backgroundColor: theme.background,
      color: theme.gold,
      minHeight: "100vh",
      textAlign: "center",
      padding: "40px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center"
    }}>

      <style jsx global>{`
        html, body {
          margin: 0;
          padding: 0;
          background-color: ${theme.background} !important;
          color: ${theme.gold};
        }
        @keyframes pulse-border {
          0% { box-shadow: 0 0 10px ${theme.gold}; }
          50% { box-shadow: 0 0 30px ${theme.gold}; }
          100% { box-shadow: 0 0 10px ${theme.gold}; }
        }
        .container-fiber {
          animation: pulse-border 2s infinite;
        }
      `}</style>

      <div style={{ position: "absolute", top: "18px", right: "18px" }}>
        <LanguageSwitcher />
      </div>

      <img src="/images/logo.png" alt="Trulink Fiber Logo" style={{ width: "150px", marginBottom: "20px" }} />

      <h1 style={{ color: theme.gold, marginBottom: "30px" }}>
        {t("login.title")}
      </h1>

      <form
        onSubmit={handleLogin}
        className="container-fiber"
        style={{
          maxWidth: "400px",
          width: "100%",
          margin: "0 auto",
          border: `2px solid ${theme.gold}`,
          padding: "30px",
          borderRadius: "30px",
          backgroundColor: theme.sidebarBg
        }}
      >
        <h2 style={{ color: theme.gold, marginBottom: "25px" }}>{t("login.cardTitle")}</h2>

        <label style={{ display: "block", textAlign: "left", marginBottom: "5px", color: theme.textMuted }}>{t("login.labelUser")}</label>
        <input
          type="email"
          placeholder={t("login.placeholderUser")}
          style={inputStyle}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label style={{ display: "block", textAlign: "left", marginBottom: "5px", color: theme.textMuted }}>{t("login.labelPassword")}</label>
        <input
          type="password"
          placeholder="********"
          style={inputStyle}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <Button
          type="submit"
          variant="gold"
          style={{
            padding: "15px",
            borderRadius: "15px",
            width: "100%",
            fontSize: "16px",
            marginTop: "10px"
          }}
        >
          {t("login.btnSubmit")}
        </Button>

        {mensaje && (
          <p style={{ marginTop: "15px", color: mensaje.includes("concedido") || mensaje.includes("granted") ? theme.green : theme.red }}>
            {mensaje}
          </p>
        )}
      </form>

      <p style={{ marginTop: "40px", fontSize: "12px", color: theme.gold }}>
        {t("common.companyFooter")}
      </p>
    </div>
  );
}