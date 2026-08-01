// pages/colaborador/Sidebar.tsx
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";

const GOLD = "#DAA520";
const GOLD_BORDER_SOFT = "rgba(218, 165, 32, 0.25)";

type ItemNav = {
  key: string;
  label: string;
  icon: string;
  href: string;
};

const NAV: ItemNav[] = [
  { key: "perfil", label: "Mi Perfil", icon: "🪪", href: "/colaborador/perfil" },
  { key: "documentos", label: "Mis Documentos", icon: "📄", href: "/colaborador/documentos" },
  { key: "solicitudes", label: "Vacaciones & Permisos", icon: "🌴", href: "/colaborador/solicitudes" },
  { key: "marcaje", label: "Tiempo & Asistencia", icon: "⏱️", href: "/colaborador/marcaje" },
  { key: "desempeno", label: "Desempeño", icon: "🎯", href: "/colaborador/desempeno" },
  { key: "training", label: "Capacitación", icon: "🎓", href: "/colaborador/training" },
];

export default function SidebarColaborador({ currentActive }: { currentActive: string }) {
  const router = useRouter();

  async function salir() {
    if (supabase) {
      await supabase.auth.signOut();
    }
    sessionStorage.clear();
    localStorage.clear();
    router.push("/login");
  }

  return (
    <aside
      style={{
        width: "240px",
        minHeight: "100vh",
        backgroundColor: "#000000",
        borderRight: `1px solid ${GOLD_BORDER_SOFT}`,
        display: "flex",
        flexDirection: "column",
        padding: "24px 0",
        boxSizing: "border-box",
      }}
    >
      <div style={{ padding: "0 20px 24px 20px", borderBottom: `1px solid ${GOLD_BORDER_SOFT}`, marginBottom: "20px" }}>
        <div style={{ color: GOLD, fontWeight: "bold", fontSize: "1.1rem", letterSpacing: "1px" }}>
          TRULINK
        </div>
        <div style={{ color: "#888", fontSize: "0.72rem", letterSpacing: "0.5px", marginTop: "2px" }}>
          PORTAL COLABORADOR
        </div>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1, padding: "0 12px" }}>
        {NAV.map((item) => {
          const activo = currentActive === item.key;
          return (
            <button
              key={item.key}
              onClick={() => router.push(item.href)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "11px 14px",
                borderRadius: "8px",
                border: "none",
                background: activo ? "rgba(218, 165, 32, 0.15)" : "transparent",
                color: activo ? GOLD : "#aaaaaa",
                fontWeight: activo ? "bold" : "normal",
                fontSize: "0.85rem",
                textAlign: "left",
                cursor: "pointer",
                letterSpacing: "0.3px",
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div style={{ padding: "12px" }}>
        <button
          onClick={salir}
          style={{
            width: "100%",
            padding: "10px 14px",
            borderRadius: "8px",
            border: "1px solid rgba(255,107,107,0.4)",
            background: "transparent",
            color: "#ff6b6b",
            fontWeight: "bold",
            fontSize: "0.8rem",
            cursor: "pointer",
            letterSpacing: "0.5px",
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}