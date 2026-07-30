import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import Sidebar from "./Sidebar";

export default function AdminUsuarios() {
  const [vistaActiva, setVistaActiva] = useState<"clientes" | "equipo">("clientes");
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(false);
  const [mensajeModal, setMensajeModal] = useState("");

  // Estados para nuevo colaborador
  const [mostrarModalColaborador, setMostrarModalColaborador] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoEmail, setNuevoEmail] = useState("");
  const [nuevoPassword, setNuevoPassword] = useState("");
  const [nuevoRol, setNuevoRol] = useState("Administrador");

  useEffect(() => {
    cargarUsuarios(vistaActiva);
  }, [vistaActiva]);

  const cargarUsuarios = async (vista: "clientes" | "equipo") => {
    if (!supabase) return;
    setCargando(true);
    setUsuarios([]);

    const tabla = vista === "clientes" ? "clientes" : "colaboradores"; 

    const { data, error } = await supabase
      .from(tabla)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(`Error al cargar ${vista}:`, error);
    } else {
      setUsuarios(data || []);
    }
    
    setCargando(false);
  };

  const toggleEstadoUsuario = async (id: string, estadoActual: boolean, vista: "clientes" | "equipo") => {
    if (!supabase) return;
    const nuevoEstado = !estadoActual;
    const tabla = vista === "clientes" ? "clientes" : "colaboradores";

    const { error } = await supabase
      .from(tabla)
      .update({ activo: nuevoEstado })
      .eq("id", id);

    if (error) {
      alert("Error al actualizar el estado: " + error.message);
    } else {
      setUsuarios(usuarios.map(u => u.id === id ? { ...u, activo: nuevoEstado } : u));
    }
  };

  const enviarInvitacionCliente = async (emailCliente: string) => {
    if (!supabase) return;
    const { error } = await supabase.auth.resetPasswordForEmail(emailCliente, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });

    if (error) {
      alert("Error al enviar correo de invitación: " + error.message);
    } else {
      setMensajeModal(`¡Correo de admisión e invitación enviado exitosamente a ${emailCliente}!`);
      setTimeout(() => setMensajeModal(""), 4000);
    }
  };

  const crearColaborador = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: nuevoEmail,
      password: nuevoPassword,
    });

    if (authError) {
      alert("Error al crear credenciales de autenticación: " + authError.message);
      return;
    }

    // auth_id vincula esta fila con el usuario real de Supabase Auth
    // (columna agregada vía SQL: ALTER TABLE colaboradores ADD COLUMN
    // auth_id uuid REFERENCES auth.users(id)).
    const { error: dbError } = await supabase
      .from("colaboradores")
      .insert([
        { 
          nombre: nuevoNombre, 
          email: nuevoEmail, 
          rol: nuevoRol,
          auth_id: authData.user?.id,
          activo: true 
        }
      ]);

    if (dbError) {
      alert("Usuario creado en Auth pero hubo un error en la tabla colaboradores: " + dbError.message);
    } else {
      setMensajeModal("¡Colaborador creado y registrado exitosamente!");
      setMostrarModalColaborador(false);
      setNuevoNombre("");
      setNuevoEmail("");
      setNuevoPassword("");
      setNuevoRol("Administrador");
      cargarUsuarios("equipo");
      setTimeout(() => setMensajeModal(""), 4000);
    }
  };

  const usuariosFiltrados = usuarios.filter((user) =>
    user.razon_social?.toLowerCase().includes(busqueda.toLowerCase()) ||
    user.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    user.email?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div style={{ backgroundColor: "#080808", minHeight: "100vh", display: "flex", color: "#E0E0E0", fontFamily: "sans-serif" }}>
      <Sidebar currentActive="usuarios" />

      <div style={{ flex: 1, padding: "40px 50px", overflowY: "auto", boxSizing: "border-box" }}>
        
        {/* Header Superior con Estilo Premium Black & Gold */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "35px", borderBottom: "1px solid rgba(218, 165, 32, 0.2)", paddingBottom: "20px" }}>
          <div>
            <h1 style={{ fontSize: "1.8rem", fontWeight: "700", color: "#DAA520", margin: "0 0 8px 0", letterSpacing: "1.5px" }}>
              GESTIÓN DE USUARIOS
            </h1>
            <p style={{ fontSize: "0.9rem", color: "#888", margin: 0, letterSpacing: "0.5px" }}>
              Administra el acceso, credenciales y estados de clientes integradores y del equipo corporativo.
            </p>
          </div>
          
          {vistaActiva === "equipo" && (
            <button
              onClick={() => setMostrarModalColaborador(true)}
              style={{
                backgroundColor: "#DAA520",
                color: "#000",
                border: "none",
                borderRadius: "8px",
                padding: "12px 22px",
                fontWeight: "700",
                cursor: "pointer",
                fontSize: "0.9rem",
                letterSpacing: "1px",
                boxShadow: "0 4px 15px rgba(218, 165, 32, 0.2)",
                transition: "all 0.2s ease"
              }}
              onMouseOver={(e) => { e.currentTarget.style.backgroundColor = "#e6b835"; }}
              onMouseOut={(e) => { e.currentTarget.style.backgroundColor = "#DAA520"; }}
            >
              + NUEVO COLABORADOR
            </button>
          )}
        </div>

        {mensajeModal && (
          <div style={{ marginBottom: "25px", padding: "15px 20px", backgroundColor: "rgba(0, 255, 0, 0.08)", border: "1px solid rgba(0, 255, 0, 0.4)", color: "#00FF00", borderRadius: "8px", fontSize: "0.9rem", letterSpacing: "0.5px" }}>
            {mensajeModal}
          </div>
        )}

        {/* CONTROLES DE FILTRADO Y VISTAS */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px", flexWrap: "wrap", gap: "20px" }}>
          
          {/* Selector de Vistas */}
          <div style={{ display: "flex", gap: "15px" }}>
            <button
              onClick={() => setVistaActiva("clientes")}
              style={{
                padding: "12px 22px",
                borderRadius: "8px",
                border: `1px solid ${vistaActiva === "clientes" ? "#DAA520" : "rgba(218, 165, 32, 0.3)"}`,
                backgroundColor: vistaActiva === "clientes" ? "#DAA520" : "#111111",
                color: vistaActiva === "clientes" ? "#000" : "#DAA520",
                fontWeight: "700",
                cursor: "pointer",
                fontSize: "0.85rem",
                letterSpacing: "1px",
                transition: "all 0.2s ease"
              }}
            >
              CLIENTES E INTEGRADORES
            </button>
            <button
              onClick={() => setVistaActiva("equipo")}
              style={{
                padding: "12px 22px",
                borderRadius: "8px",
                border: `1px solid ${vistaActiva === "equipo" ? "#DAA520" : "rgba(218, 165, 32, 0.3)"}`,
                backgroundColor: vistaActiva === "equipo" ? "#DAA520" : "#111111",
                color: vistaActiva === "equipo" ? "#000" : "#DAA520",
                fontWeight: "700",
                cursor: "pointer",
                fontSize: "0.85rem",
                letterSpacing: "1px",
                transition: "all 0.2s ease"
              }}
            >
              EQUIPO ADMINISTRATIVO
            </button>
          </div>

          {/* Buscador */}
          <div style={{ flex: "1", maxWidth: "350px", minWidth: "250px" }}>
            <input
              type="text"
              placeholder={`Buscar en ${vistaActiva}...`}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={inputStyle}
            />
          </div>

        </div>

        {/* Modal Crear Colaborador */}
        {mostrarModalColaborador && (
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(5px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
            <form onSubmit={crearColaborador} style={{ backgroundColor: "#111111", border: "1px solid rgba(218, 165, 32, 0.5)", padding: "40px", borderRadius: "12px", width: "100%", maxWidth: "450px", boxShadow: "0 10px 30px rgba(0,0,0,0.8)" }}>
              <h2 style={{ color: "#DAA520", marginBottom: "25px", fontSize: "1.2rem", letterSpacing: "1px", textTransform: "uppercase", borderLeft: "3px solid #DAA520", paddingLeft: "12px" }}>
                Nuevo Colaborador
              </h2>
              
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "0.85rem", color: "#aaa" }}>Nombre Completo</label>
                <input type="text" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} required style={inputStyle} />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "0.85rem", color: "#aaa" }}>Correo Electrónico</label>
                <input type="email" value={nuevoEmail} onChange={(e) => setNuevoEmail(e.target.value)} required style={inputStyle} />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "0.85rem", color: "#aaa" }}>Contraseña Inicial</label>
                <input type="password" value={nuevoPassword} onChange={(e) => setNuevoPassword(e.target.value)} required style={inputStyle} />
              </div>

              <div style={{ marginBottom: "30px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "0.85rem", color: "#aaa" }}>Rol / Permisos</label>
                <select value={nuevoRol} onChange={(e) => setNuevoRol(e.target.value)} style={inputStyle}>
                  <option value="Administrador" style={{ backgroundColor: "#111", color: "#DAA520" }}>Administrador</option>
                  <option value="Ventas" style={{ backgroundColor: "#111", color: "#DAA520" }}>Ventas</option>
                  <option value="Soporte Técnico" style={{ backgroundColor: "#111", color: "#DAA520" }}>Soporte Técnico</option>
                  <option value="Producción" style={{ backgroundColor: "#111", color: "#DAA520" }}>Producción</option>
                  <option value="Bodega" style={{ backgroundColor: "#111", color: "#DAA520" }}>Bodega</option>
                  <option value="Utility" style={{ backgroundColor: "#111", color: "#DAA520" }}>Utility</option>
                </select>
              </div>

              <div style={{ display: "flex", gap: "15px" }}>
                <button type="submit" style={{ flex: 1, padding: "14px", backgroundColor: "#DAA520", color: "#000", border: "none", fontWeight: "700", borderRadius: "8px", cursor: "pointer", letterSpacing: "1px" }}>Guardar</button>
                <button type="button" onClick={() => setMostrarModalColaborador(false)} style={{ flex: 1, padding: "14px", backgroundColor: "transparent", color: "#DAA520", border: "1px solid rgba(218, 165, 32, 0.4)", fontWeight: "700", borderRadius: "8px", cursor: "pointer", letterSpacing: "1px" }}>Cancelar</button>
              </div>
            </form>
          </div>
        )}

        {/* Listado de Usuarios */}
        {cargando ? (
          <div style={{ backgroundColor: "#111111", border: "1px solid rgba(218, 165, 32, 0.2)", borderRadius: "12px", padding: "40px", textAlign: "center" }}>
            <p style={{ color: "#888", fontStyle: "italic", margin: 0, letterSpacing: "0.5px" }}>Cargando registros de {vistaActiva}...</p>
          </div>
        ) : usuariosFiltrados.length === 0 ? (
          <div style={{ backgroundColor: "#111111", border: "1px solid rgba(218, 165, 32, 0.2)", borderRadius: "12px", padding: "40px", textAlign: "center" }}>
            <p style={{ color: "#666", fontStyle: "italic", margin: 0, letterSpacing: "0.5px" }}>No se encontraron registros en la categoría {vistaActiva}.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            {usuariosFiltrados.map((user: any) => {
              const estaActivo = user.activo !== false; 
              return (
                <div
                  key={user.id}
                  style={{
                    backgroundColor: "#111111",
                    border: `1px solid ${estaActivo ? "rgba(218, 165, 32, 0.25)" : "rgba(255, 0, 0, 0.4)"}`,
                    borderRadius: "12px",
                    padding: "20px 25px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    boxShadow: "0 4px 15px rgba(0,0,0,0.4)",
                    transition: "all 0.2s ease"
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.borderColor = estaActivo ? "rgba(218, 165, 32, 0.6)" : "rgba(255, 0, 0, 0.7)"; }}
                  onMouseOut={(e) => { e.currentTarget.style.borderColor = estaActivo ? "rgba(218, 165, 32, 0.25)" : "rgba(255, 0, 0, 0.4)"; }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ fontWeight: "700", fontSize: "1.05rem", color: "#fff", letterSpacing: "0.5px" }}>
                      {user.razon_social || user.nombre || "Usuario Sin Nombre"}
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#aaa", letterSpacing: "0.5px" }}>Email: {user.email || "N/A"}</div>
                    
                    {vistaActiva === "clientes" && (
                      <div style={{ fontSize: "0.8rem", color: "#888", display: "flex", gap: "12px", alignItems: "center", marginTop: "2px" }}>
                        <span>Tipo: <strong style={{ color: "#ccc" }}>{user.tipo_cliente || "Integrador"}</strong></span> | 
                        <span>Lista: <strong style={{ color: "#DAA520" }}>{user.price_list || "C"}</strong></span> | 
                        <span>Estado: <strong style={{ color: estaActivo ? "#00FF00" : "#FF5555" }}>{estaActivo ? "Activo" : "Inactivo"}</strong></span>
                      </div>
                    )}

                    {vistaActiva === "equipo" && (
                      <div style={{ fontSize: "0.8rem", color: "#888", display: "flex", gap: "12px", alignItems: "center", marginTop: "2px" }}>
                        <span>Rol: <strong style={{ color: "#DAA520" }}>{user.rol || "Administrador"}</strong></span> | 
                        <span>Estado: <strong style={{ color: estaActivo ? "#00FF00" : "#FF5555" }}>{estaActivo ? "Activo" : "Inactivo"}</strong></span>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: "12px" }}>
                    {vistaActiva === "clientes" && (
                      <button
                        onClick={() => enviarInvitacionCliente(user.email)}
                        style={{
                          padding: "10px 16px",
                          backgroundColor: "transparent",
                          border: "1px solid rgba(218, 165, 32, 0.5)",
                          color: "#DAA520",
                          borderRadius: "8px",
                          cursor: "pointer",
                          fontWeight: "700",
                          fontSize: "0.75rem",
                          letterSpacing: "1px",
                          transition: "all 0.2s ease"
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.backgroundColor = "rgba(218, 165, 32, 0.1)"; }}
                        onMouseOut={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                      >
                        ENVIAR ACCESO / PASS
                      </button>
                    )}

                    <button
                      onClick={() => toggleEstadoUsuario(user.id, estaActivo, vistaActiva)}
                      style={{
                        padding: "10px 16px",
                        backgroundColor: estaActivo ? "rgba(100, 0, 0, 0.3)" : "rgba(0, 80, 0, 0.3)",
                        border: `1px solid ${estaActivo ? "#FF4444" : "#00FF00"}`,
                        color: estaActivo ? "#FF6666" : "#00FF00",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontWeight: "700",
                        fontSize: "0.75rem",
                        letterSpacing: "1px",
                        transition: "all 0.2s ease"
                      }}
                    >
                      {estaActivo ? "INACTIVAR" : "ACTIVAR"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  backgroundColor: "#0b0b0b",
  border: "1px solid rgba(218, 165, 32, 0.3)",
  borderRadius: "8px",
  padding: "12px 16px",
  color: "#DAA520",
  outline: "none",
  fontSize: "0.9rem",
  letterSpacing: "0.5px",
  boxSizing: "border-box" as const
};
