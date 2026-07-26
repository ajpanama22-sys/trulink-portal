import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

interface UserProfile {
  id?: string;
  email?: string;
  nombre?: string;
  empresa?: string;
  rol?: string;
  tipo?: string;
  razon_social?: string;
  tipo_cliente?: string;
}

export default function HeaderUser() {
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      // 1. Probar en sessionStorage y localStorage
      const storedUser = 
        sessionStorage.getItem("trulink_user") || 
        localStorage.getItem("trulink_user") ||
        sessionStorage.getItem("user") ||
        localStorage.getItem("user");

      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          if (parsed && (parsed.nombre || parsed.email || parsed.razon_social)) {
            setUser({
              ...parsed,
              nombre: parsed.nombre || parsed.razon_social || parsed.email?.split('@')[0],
              rol: parsed.rol || parsed.tipo_cliente || parsed.tipo?.toUpperCase() || 'CLIENTE'
            });
            return;
          }
        } catch (e) {
          console.error("Error al leer perfil almacenado:", e);
        }
      }

      // 2. Fallback con Supabase Auth + consulta a la tabla 'clientes' si se recarga la pantalla
      if (supabase) {
        const { data: sessionData } = await supabase.auth.getSession();
        let email = sessionData?.session?.user?.email;

        if (!email) {
          const { data: authData } = await supabase.auth.getUser();
          email = authData?.user?.email;
        }

        if (email) {
          const { data: cliente } = await supabase
            .from("clientes")
            .select("razon_social, tipo_cliente")
            .ilike("email", email.trim())
            .maybeSingle();

          const userData: UserProfile = {
            email: email,
            nombre: cliente?.razon_social || email.split('@')[0],
            rol: cliente?.tipo_cliente || 'CLIENTE'
          };

          setUser(userData);
          sessionStorage.setItem("trulink_user", JSON.stringify(userData));
        }
      }
    };

    fetchUserData();
  }, []);

  const handleLogout = async () => {
    sessionStorage.clear();
    localStorage.removeItem("trulink_user");
    localStorage.removeItem("user");
    if (supabase) {
      await supabase.auth.signOut();
    }
    window.location.href = "/";
  };

  if (!user) return null;

  const nombreAMostrar = user.nombre || user.razon_social || user.email || "Usuario";
  const rolAMostrar = user.rol || user.tipo_cliente || user.tipo?.toUpperCase() || "CLIENTE";

  const iniciales = nombreAMostrar
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase() || "U";

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
          letterSpacing: "0.5px",
          flexShrink: 0
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
            letterSpacing: "0.5px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "180px"
          }}
        >
          {nombreAMostrar}
        </div>
        <div
          style={{
            fontSize: "0.7rem",
            color: "#DAA520",
            letterSpacing: "0.3px",
            textTransform: "uppercase"
          }}
        >
          {rolAMostrar}
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
          marginLeft: "4px",
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