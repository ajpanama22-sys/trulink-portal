import { useState } from "react";
import { useRouter } from "next/router";
import { getSupabase } from "../../lib/supabaseClient";
import { theme } from "../../lib/theme";
import { Card, Heading, Button, inputStyle } from "../../lib/ui";

export default function VendorLogin() {
  const router = useRouter();
  const supabase = getSupabase();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(
    router.query.error === "no_autorizado"
      ? "Tu cuenta aún no está homologada o el portal no ha sido activado para tu perfil."
      : null
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setCargando(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError("Correo o contraseña incorrectos.");
      setCargando(false);
      return;
    }

    router.push("/vendor-portal");
  };

  const fieldStyle = { ...inputStyle, width: "100%", marginBottom: "15px", padding: "12px", boxSizing: "border-box" as const };

  return (
    <div style={{
      backgroundColor: theme.background, color: theme.gold, minHeight: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
    }}>
      <Card style={{ padding: "40px", borderRadius: "24px", width: "100%", maxWidth: "420px" }}>
        <div style={{ textAlign: "center", marginBottom: "26px" }}>
          <img src="/images/logo.png" alt="Trulink Fiber" style={{ width: "120px", marginBottom: "14px" }} />
          <Heading style={{ fontSize: "1.3rem" }}>Portal de Proveedores</Heading>
          <p style={{ color: theme.textLight, fontSize: "0.85rem" }}>Acceso exclusivo para fábricas homologadas</p>
        </div>

        {error && (
          <div style={{ background: "rgba(231,76,60,0.1)", border: "1px solid rgba(231,76,60,0.4)", borderRadius: "8px", padding: "10px 14px", marginBottom: "16px" }}>
            <p style={{ color: "#e74c3c", fontSize: "0.8rem", margin: 0 }}>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <input type="email" placeholder="Correo corporativo" style={fieldStyle} value={email}
            onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="Contraseña" style={fieldStyle} value={password}
            onChange={(e) => setPassword(e.target.value)} required />
          <Button type="submit" variant="gold" disabled={cargando} style={{ width: "100%" }}>
            {cargando ? "Ingresando..." : "Ingresar"}
          </Button>
        </form>

        <p style={{ color: theme.textLight, fontSize: "0.72rem", textAlign: "center", marginTop: "20px" }}>
          ¿No tienes acceso todavía? <a href="/proveedores" style={{ color: theme.gold }}>Registra tu empresa</a>
        </p>
      </Card>
    </div>
  );
}
