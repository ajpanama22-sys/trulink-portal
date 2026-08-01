import { useState } from "react";
import { useRouter } from "next/router";
import { theme } from "../../lib/theme";
import { Card, Heading, Button, inputStyle } from "../../lib/ui";

export default function CrearPassword() {
  const router = useRouter();
  const { token } = router.query;
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCrearPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert("Las contraseñas no coinciden");
      return;
    }
    if (password.length < 6) {
      alert("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (!token) {
      alert("Token no válido o ausente");
      return;
    }

    setLoading(true);

    try {
      // Este endpoint corre en el servidor: valida el token, crea el usuario
      // en Supabase Auth (ya confirmado) y activa al cliente en la tabla clientes.
      const res = await fetch("/api/activar-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al crear la contraseña");
      }

      alert("¡Contraseña creada con éxito! Ahora puedes iniciar sesión.");
      router.push("/login"); // Ajusta si tu ruta de login es otra
    } catch (err: any) {
      alert("Error al guardar la contraseña: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        backgroundColor: theme.background,
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        color: theme.textLight,
        fontFamily: theme.fontFamily,
      }}
    >
      <Card style={{ width: "100%", maxWidth: "400px", boxSizing: "border-box", padding: "40px" }}>
        <form onSubmit={handleCrearPassword}>
          <Heading style={{ textAlign: "center", fontSize: "1.5rem", marginBottom: "20px" }}>
            CREAR CONTRASEÑA
          </Heading>

          <div style={{ marginBottom: "15px", display: "flex", flexDirection: "column", gap: "5px" }}>
            <label style={{ fontSize: "0.8rem", color: theme.textMuted }}>Nueva Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ marginBottom: "25px", display: "flex", flexDirection: "column", gap: "5px" }}>
            <label style={{ fontSize: "0.8rem", color: theme.textMuted }}>Confirmar Contraseña</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
            />
          </div>

          <Button type="submit" variant="gold" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Guardando..." : "Guardar Contraseña"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
