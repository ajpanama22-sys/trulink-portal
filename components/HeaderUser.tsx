import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

interface UserProfile {
  id?: string;
  email?: string;
  nombre?: string;
  empresa?: string;
  rol?: string;
  tipo?: string;
}

export default function HeaderUser() {
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    // 1. Cargar desde sessionStorage
    const storedUser = sessionStorage.getItem("trulink_user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
        return;
      } catch (e) {
        console.error("Error al leer perfil almacenado:", e);
      }
    }

    // 2. Fallback de verificación directa con Supabase Auth si se refresca la pantalla
    const checkSupabaseAuth = async () => {
      if (!supabase) return;
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setUser({
          email: data.user.email,
          nombre: data.user.email?.split('@')[0],
          rol: 'Usuario Autenticado'
        });
      }
    };

    checkSupabaseAuth();
  }, []);

  const handleLogout = async () => {
    sessionStorage.clear();
    if (supabase) {
      await supabase.auth.signOut();
    }
    window.location.href = "/";
  };

  if (!user) return null;

  const iniciales = (user.nombre || user.email || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        background: "rgba(15, 15, 15, 0.9)",
        border: "1px solid rgba(218, 165, 32, 0.3)",
        padding: "8px 16px",
        borderRadius: "30px",
        boxShadow: "0 4px 15px rgba(0,0,0,0.5)",
        backdropFilter: "blur(5px)"
      }}
    >
      {/* Avatar circular dorado con iniciales */}
      <div
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "50%",
          background: "linear-gradient(135deg, #DAA520, #8B6508)",
          color: "#000",
          fontWeight: "bold",
          fontSize: "0.85rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          letterSpacing: "0.5px"
        }}
      >
        {iniciales}
      </div>

      {/* Datos del Usuario */}
      <div style={{ textAlign: "left", lineHeight: "1.2" }}>
        <div
          style={{
            fontSize: "0.85rem",
            fontWeight: "600",
            color: "#FFFFFF",
            letterSpacing: "0.5px"
          }}
        >
          {user.nombre}
        </div>
        <div
          style={{
            fontSize: "0.7rem",
            color: "#DAA520",
            letterSpacing: "0.3px"
          }}
        >
          {user.rol || user.tipo?.toUpperCase()}
        </div>
      </div>

      {/* Botón de Salir */}
      <button
        onClick={handleLogout}
        title="Cerrar Sesión"
        style={{
          background: "transparent",
          border: "none",
          color: "rgba(255,255,255,0.4)",
          cursor: "pointer",
          padding: "4px 8px",
          fontSize: "0.9rem",
          marginLeft: "8px",
          transition: "color 0.2s ease"
        }}
        onMouseOver={(e) => (e.currentTarget.style.color = "#e74c3c")}
        onMouseOut={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
      >
        ✕
      </button>
    </div>
  );
}