import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

interface UserSessionProfile {
  id: string;
  email: string;
  nombre: string;
  empresa: string;
  rol: string;
  tipo: "admin" | "colaborador" | "cliente" | "invitado";
  tipo_registro: string;
  perfil_cliente: string;
  lista_precio: "LISTA_A" | "LISTA_B" | "LISTA_C" | "LISTA_D";
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);

  const inputStyle: React.CSSProperties = {
    width: "100%",
    marginBottom: "20px",
    padding: "14px 18px",
    backgroundColor: "#050505",
    color: "#DAA520",
    border: "1px solid rgba(218, 165, 32, 0.4)",
    borderRadius: "10px",
    outline: "none",
    transition: "all 0.3s ease",
    boxSizing: "border-box",
    fontSize: "0.95rem"
  };

  /**
   * Determina la Lista de Precios según el Perfil B2B del Cliente.
   * ISP        -> LISTA A
   * MAYORISTA  -> LISTA B
   * INTEGRADOR -> LISTA C
   * OTROS/DEFAULT -> LISTA D
   *
   * `priceListDB` es el valor guardado en la columna real `price_list`
   * de la tabla clientes, que se guarda como una sola letra: 'A' | 'B' | 'C' | 'D'.
   * Si viene con valor válido, se respeta (permite asignar una lista distinta
   * al default por negociación especial). Si no, se calcula por el perfil.
   */
  const determinarListaPrecio = (
    perfil?: string,
    priceListDB?: string
  ): "LISTA_A" | "LISTA_B" | "LISTA_C" | "LISTA_D" => {
    const letraMap: Record<string, "LISTA_A" | "LISTA_B" | "LISTA_C" | "LISTA_D"> = {
      A: "LISTA_A",
      B: "LISTA_B",
      C: "LISTA_C",
      D: "LISTA_D",
    };

    const letra = (priceListDB || "").toUpperCase().trim();
    if (letra && letraMap[letra]) {
      return letraMap[letra];
    }

    const p = (perfil || "").toUpperCase().trim();
    switch (p) {
      case "ISP":
        return "LISTA_A";
      case "MAYORISTA":
        return "LISTA_B";
      case "INTEGRADOR":
        return "LISTA_C";
      case "CLIENTE FINAL":
      default:
        return "LISTA_D";
    }
  };

  const verificarPrimerLoginInteligente = async (
    tabla: string,
    columnaId: string,
    idValor: string
  ) => {
    if (!supabase) return;
    try {
      const { data: record } = await supabase
        .from(tabla)
        .select("notificaciones_configuradas")
        .eq(columnaId, idValor)
        .single();

      if (record && !record.notificaciones_configuradas) {
        sessionStorage.setItem("trulink_mostrar_modal_notif", "true");
        sessionStorage.setItem("trulink_usuario_tabla", tabla);
        sessionStorage.setItem("trulink_usuario_id", idValor);
      }
    } catch (err) {
      console.warn("Aviso al verificar primer login:", err);
    }
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!supabase) {
      setMensaje("Error: Cliente de Supabase no inicializado.");
      return;
    }

    setCargando(true);
    setMensaje("Verificando credenciales...");

    // 1. Autenticación contra Supabase Auth
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setCargando(false);
      setMensaje("Acceso denegado: " + error.message);
      return;
    }

    setMensaje("Acceso concedido. Identificando perfil...");

    const userEmail = (authData.user?.email || email).trim().toLowerCase();
    const EMAIL_SUPERUSER = "fred.jurado@trulinkfiber.com";

    // 2. CASO A: SUPER ADMINISTRADOR
    if (userEmail === EMAIL_SUPERUSER) {
      const superUserProfile: UserSessionProfile = {
        id: authData.user?.id || "super-admin",
        email: userEmail,
        nombre: "Fred Jurado",
        empresa: "Trulink Fiber LLC",
        rol: "Super Administrador",
        tipo: "admin",
        tipo_registro: "Administración Directiva",
        perfil_cliente: "Super Admin",
        lista_precio: "LISTA_A"
      };

      sessionStorage.setItem("trulink_user", JSON.stringify(superUserProfile));
      window.location.href = "/admin";
      return;
    }

    // 3. CASO B: COLABORADOR INTERNO
    const { data: colaboradorData } = await supabase
      .from("colaboradores")
      .select("id, email, nombre, cargo")
      .eq("email", userEmail)
      .single();

    if (colaboradorData) {
      const colaboradorProfile: UserSessionProfile = {
        id: colaboradorData.id,
        email: colaboradorData.email,
        nombre: colaboradorData.nombre || "Colaborador",
        empresa: "Trulink Fiber LLC",
        rol: colaboradorData.cargo || "Colaborador",
        tipo: "colaborador",
        tipo_registro: "Equipo Interno",
        perfil_cliente: "Colaborador",
        lista_precio: "LISTA_A"
      };

      sessionStorage.setItem("trulink_user", JSON.stringify(colaboradorProfile));
      await verificarPrimerLoginInteligente("colaboradores", "id", colaboradorData.id);
      window.location.href = "/admin";
      return;
    }

    // 4. CASO C: CLIENTE B2B O INVERSOR ESTRATÉGICO
    const { data: clienteData } = await supabase
      .from("clientes")
      .select("id, email, razon_social, tipo_registro, perfil_cliente, price_list")
      .eq("email", userEmail)
      .single();

    if (clienteData) {
      const perfilEfectivo = clienteData.perfil_cliente || "CLIENTE FINAL";
      const listaAsignada = determinarListaPrecio(perfilEfectivo, clienteData.price_list);

      const clienteProfile: UserSessionProfile = {
        id: clienteData.id,
        email: clienteData.email,
        nombre: clienteData.razon_social || "Cliente Registrado",
        empresa: clienteData.razon_social || "N/A",
        rol: perfilEfectivo, // ej: "ISP", "MAYORISTA", "INTEGRADOR"
        tipo: "cliente",
        tipo_registro: clienteData.tipo_registro || "Cliente B2B",
        perfil_cliente: perfilEfectivo,
        lista_precio: listaAsignada // "LISTA_A", "LISTA_B", "LISTA_C", "LISTA_D"
      };

      sessionStorage.setItem("trulink_user", JSON.stringify(clienteProfile));
      await verificarPrimerLoginInteligente("clientes", "id", clienteData.id);

      // Redirección inteligente según el tipo de registro
      if (clienteData.tipo_registro === "Inversor Estratégico") {
        window.location.href = "/portal-cliente"; // O "/inversor" si existe vista dedicada
      } else {
        window.location.href = "/portal-cliente";
      }
      return;
    }

    // 5. CASO FALLBACK / INVITADO UNIFICADO
    const guestProfile: UserSessionProfile = {
      id: authData.user?.id || "guest",
      email: userEmail,
      nombre: userEmail.split("@")[0],
      empresa: "Usuario Invitado",
      rol: "Usuario Registrado",
      tipo: "invitado",
      tipo_registro: "Usuario Portal",
      perfil_cliente: "CLIENTE FINAL",
      lista_precio: "LISTA_D"
    };

    sessionStorage.setItem("trulink_user", JSON.stringify(guestProfile));
    window.location.href = "/selector";
  };

  return (
    <div
      style={{
        backgroundColor: "#000",
        color: "#DAA520",
        minHeight: "100vh",
        textAlign: "center",
        padding: "40px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "sans-serif",
        position: "relative",
        overflow: "hidden"
      }}
    >
      <style jsx global>{`
        html,
        body {
          margin: 0;
          padding: 0;
          background-color: #000 !important;
          color: #daa520;
        }
        @keyframes pulse-gold {
          0% {
            box-shadow: 0 0 15px rgba(218, 165, 32, 0.15);
            border-color: rgba(218, 165, 32, 0.4);
          }
          50% {
            box-shadow: 0 0 35px rgba(218, 165, 32, 0.4);
            border-color: #daa520;
          }
          100% {
            box-shadow: 0 0 15px rgba(218, 165, 32, 0.15);
            border-color: rgba(218, 165, 32, 0.4);
          }
        }
        .container-fiber {
          animation: pulse-gold 4s infinite ease-in-out;
        }
        input:focus {
          border-color: #daa520 !important;
          box-shadow: 0 0 10px rgba(218, 165, 32, 0.3);
        }
      `}</style>

      {/* Logo Corporativo */}
      <img
        src="/images/logo.png"
        alt="Trulink Fiber Logo"
        style={{
          width: "130px",
          marginBottom: "20px",
          filter: "drop-shadow(0 0 10px rgba(218,165,32,0.3))"
        }}
      />

      <h1
        style={{
          color: "#DAA520",
          marginBottom: "35px",
          fontSize: "1.6rem",
          letterSpacing: "2px",
          fontWeight: "300",
          textTransform: "uppercase"
        }}
      >
        Trulink Fiber LLC
      </h1>

      {/* Formulario de Login */}
      <form
        onSubmit={handleLogin}
        className="container-fiber"
        style={{
          maxWidth: "420px",
          width: "100%",
          margin: "0 auto",
          border: "1px solid rgba(218, 165, 32, 0.4)",
          padding: "40px 35px",
          borderRadius: "12px",
          backgroundColor: "#080808",
          boxShadow: "0 10px 30px rgba(0,0,0,0.8)",
          boxSizing: "border-box"
        }}
      >
        <h2
          style={{
            color: "#fff",
            marginBottom: "30px",
            fontSize: "1.2rem",
            letterSpacing: "1px",
            fontWeight: "500",
            textTransform: "uppercase"
          }}
        >
          Acceso Portal B2B
        </h2>

        {/* Input Usuario */}
        <div style={{ textAlign: "left", marginBottom: "5px" }}>
          <label
            style={{
              fontSize: "0.75rem",
              color: "#DAA520",
              fontWeight: "600",
              textTransform: "uppercase",
              letterSpacing: "0.5px"
            }}
          >
            Usuario
          </label>
        </div>
        <input
          type="email"
          placeholder="correo@empresa.com"
          style={inputStyle}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        {/* Input Contraseña */}
        <div style={{ textAlign: "left", marginBottom: "5px" }}>
          <label
            style={{
              fontSize: "0.75rem",
              color: "#DAA520",
              fontWeight: "600",
              textTransform: "uppercase",
              letterSpacing: "0.5px"
            }}
          >
            Contraseña
          </label>
        </div>
        <input
          type="password"
          placeholder="••••••••"
          style={inputStyle}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {/* Botón de Submit */}
        <button
          type="submit"
          disabled={cargando}
          style={{
            backgroundColor: "#DAA520",
            color: "#000",
            padding: "14px",
            border: "none",
            fontWeight: "bold",
            borderRadius: "8px",
            cursor: cargando ? "wait" : "pointer",
            width: "100%",
            fontSize: "0.9rem",
            marginTop: "10px",
            letterSpacing: "1px",
            textTransform: "uppercase",
            transition: "opacity 0.2s ease",
            opacity: cargando ? 0.7 : 1
          }}
        >
          {cargando ? "Verificando..." : "Acceder"}
        </button>

        {/* Mensajes de Estado */}
        {mensaje && (
          <p
            style={{
              marginTop: "20px",
              fontSize: "0.85rem",
              color:
                mensaje.includes("concedido") || mensaje.includes("Identificando")
                  ? "#DAA520"
                  : "#e74c3c",
              letterSpacing: "0.5px",
              fontWeight: "500"
            }}
          >
            {mensaje}
          </p>
        )}
      </form>

      <p
        style={{
          marginTop: "40px",
          fontSize: "11px",
          color: "rgba(218, 165, 32, 0.6)",
          letterSpacing: "0.5px"
        }}
      >
        © 2026 Marca registrada – Derechos reservados – Propiedad de Trulink Fiber LLC
      </p>
    </div>
  );
}
