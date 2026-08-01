// pages/colaborador/perfil.tsx
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";
import { tieneAccesoAdmin } from "../../lib/rolesConfig";
import SidebarColaborador from "./Sidebar";

const GOLD = "#DAA520";
const GOLD_BORDER = "rgba(218, 165, 32, 0.4)";
const GOLD_BORDER_SOFT = "rgba(218, 165, 32, 0.25)";

type FichaColaborador = {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  departamento: string | null;
  telefono: string | null;
  activo: boolean;
  created_at: string | null;
};

const styles = {
  page: { display: "flex", minHeight: "100vh", width: "100%", backgroundColor: "#000000", color: "#ffffff" } as const,
  main: { flex: 1, minHeight: "100vh", backgroundColor: "#000000", padding: "30px", boxSizing: "border-box" as const, overflowY: "auto" as const },
  card: { backgroundColor: "#0d0d0d", border: `1px solid ${GOLD_BORDER}`, borderRadius: "14px", padding: "25px", boxShadow: "0 0 25px rgba(218, 165, 32, 0.1)" },
  h1: { color: GOLD, margin: 0, fontSize: "1.6rem", letterSpacing: "1px", fontWeight: "bold" as const },
  subtitle: { color: "#888888", margin: "6px 0 0 0", fontSize: "0.85rem" },
  section: { backgroundColor: "rgba(20, 20, 20, 0.8)", border: `1px solid ${GOLD_BORDER_SOFT}`, borderRadius: "12px", padding: "20px", marginBottom: "24px" },
  label: { color: "#aaaaaa", fontSize: "0.78rem", letterSpacing: "0.5px", textTransform: "uppercase" as const, display: "block", marginBottom: "6px" },
  valor: { color: "#ffffff", fontSize: "0.95rem", marginBottom: "16px" },
  muted: { color: "#666666" },
  error: { color: "#ff6b6b", background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.3)", borderRadius: "8px", padding: "10px 14px", fontSize: "0.85rem", marginBottom: "20px" },
};

export default function PerfilColaborador() {
  const router = useRouter();
  const [ficha, setFicha] = useState<FichaColaborador | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    verificarSesionYCargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function verificarSesionYCargar() {
    if (!supabase) {
      setError("Cliente de Supabase no inicializado.");
      setCargando(false);
      return;
    }
    setCargando(true);
    setError(null);

    // 1. Sesión real de Supabase Auth (no sessionStorage)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      router.replace("/login");
      return;
    }

    // 2. Buscar la ficha del colaborador por email, igual que hace login.tsx
    const { data, error: errFicha } = await supabase
      .from("colaboradores")
      .select("id, nombre, email, rol, departamento, telefono, activo, created_at")
      .eq("email", user.email)
      .single();

    if (errFicha || !data) {
      // El usuario autenticado no es colaborador (podría ser cliente) -> fuera de este portal
      router.replace("/login");
      return;
    }

    // 3. Los roles de jerarquía 1-2 usan /admin, no este portal self-service
    if (tieneAccesoAdmin(data.rol)) {
      router.replace("/admin");
      return;
    }

    setFicha(data as FichaColaborador);
    setCargando(false);
  }

  return (
    <div style={styles.page}>
      <SidebarColaborador currentActive="perfil" />

      <main style={styles.main}>
        <div style={styles.card}>
          <div style={{ marginBottom: "25px" }}>
            <h1 style={styles.h1}>MI PERFIL</h1>
            <p style={styles.subtitle}>Tus datos como colaborador de Trulink Fiber LLC.</p>
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <section style={styles.section}>
            {cargando ? (
              <p style={styles.muted}>Cargando ficha...</p>
            ) : !ficha ? (
              <p style={styles.muted}>No se encontró tu ficha de colaborador.</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px" }}>
                <div>
                  <label style={styles.label}>Nombre completo</label>
                  <div style={styles.valor}>{ficha.nombre}</div>
                </div>
                <div>
                  <label style={styles.label}>Correo electrónico</label>
                  <div style={styles.valor}>{ficha.email}</div>
                </div>
                <div>
                  <label style={styles.label}>Rol / Puesto</label>
                  <div style={styles.valor}>{ficha.rol}</div>
                </div>
                <div>
                  <label style={styles.label}>Departamento</label>
                  <div style={styles.valor}>{ficha.departamento || "—"}</div>
                </div>
                <div>
                  <label style={styles.label}>Teléfono</label>
                  <div style={styles.valor}>{ficha.telefono || "—"}</div>
                </div>
                <div>
                  <label style={styles.label}>Colaborador desde</label>
                  <div style={styles.valor}>
                    {ficha.created_at ? new Date(ficha.created_at).toLocaleDateString("es-PA") : "—"}
                  </div>
                </div>
                <div>
                  <label style={styles.label}>Estado</label>
                  <div style={{ ...styles.valor, color: ficha.activo ? "#5ac87f" : "#ff6b6b" }}>
                    {ficha.activo ? "Activo" : "Suspendido"}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}