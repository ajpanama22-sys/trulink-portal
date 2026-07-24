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

  // Cambiar estado de activación (Activo / Inactivo) para Clientes o Colaboradores
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

  // Enviar correo de admisión con link para crear contraseña
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

  // Crear nuevo colaborador de forma sencilla
  const crearColaborador = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    // 1. Crear usuario en Auth de Supabase
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: nuevoEmail,
      password: nuevoPassword,
    });

    if (authError) {
      alert("Error al crear credenciales de autenticación: " + authError.message);
      return;
    }

    // 2. Replicar automáticamente en la tabla colaboradores con estado activo por defecto
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
    <div style={{ backgroundColor: "#000", minHeight: "100vh", display: "flex", color: "#DAA520", fontFamily: "sans-serif" }}>
      <Sidebar currentActive="usuarios" />

      <div style={{ flex: 1, padding: "40px", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", borderBottom: "1px solid #333", paddingBottom: "10px" }}>
          <h1 style={{ fontSize: "1.5rem", margin: 0 }}>GESTIÓN DE USUARIOS</h1>
          
          {vistaActiva === "equipo" && (
            <button
              onClick={() => setMostrarModalColaborador(true)}
              style={{
                padding: "10px 20px",
                backgroundColor: "#DAA520",
                color: "#000",
                border: "none",
                borderRadius: "6px",
                fontWeight: "bold",
                cursor: "pointer"
              }}
            >
              + NUEVO COLABORADOR
            </button>
          )}
        </div>

        {mensajeModal && (
          <div style={{ marginBottom: "20px", padding: "12px", backgroundColor: "#111", border: "1px solid #00FF00", color: "#00FF00", borderRadius: "6px" }}>
            {mensajeModal}
          </div>
        )}

        {/* Selector de Vistas */}
        <div style={{ display: "flex", gap: "15px", marginBottom: "25px" }}>
          <button
            onClick={() => setVistaActiva("clientes")}
            style={{
              padding: "10px 20px",
              borderRadius: "6px",
              border: "1px solid #DAA520",
              backgroundColor: vistaActiva === "clientes" ? "#DAA520" : "transparent",
              color: vistaActiva === "clientes" ? "#000" : "#DAA520",
              fontWeight: "bold",
              cursor: "pointer",
              transition: "all 0.2s ease"
            }}
          >
            CLIENTES E INTEGRADORES
          </button>
          <button
            onClick={() => setVistaActiva("equipo")}
            style={{
              padding: "10px 20px",
              borderRadius: "6px",
              border: "1px solid #DAA520",
              backgroundColor: vistaActiva === "equipo" ? "#DAA520" : "transparent",
              color: vistaActiva === "equipo" ? "#000" : "#DAA520",
              fontWeight: "bold",
              cursor: "pointer",
              transition: "all 0.2s ease"
            }}
          >
            EQUIPO ADMINISTRATIVO
          </button>
        </div>

        {/* Buscador */}
        <div style={{ marginBottom: "25px" }}>
          <input
            type="text"
            placeholder={`Buscar en ${vistaActiva} por nombre, empresa o email...`}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{
              width: "100%",
              maxWidth: "400px",
              padding: "12px",
              backgroundColor: "#111",
              border: "1px solid #DAA520",
              borderRadius: "5px",
              color: "#DAA520",
              outline: "none"
            }}
          />
        </div>

        {/* Modal Crear Colaborador */}
        {mostrarModalColaborador && (
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
            <form onSubmit={crearColaborador} style={{ backgroundColor: "#050505", border: "2px solid #DAA520", padding: "30px", borderRadius: "12px", width: "100%", maxWidth: "400px" }}>
              <h2 style={{ color: "#DAA520", marginBottom: "20px" }}>Nuevo Colaborador</h2>
              
              <label style={{ display: "block", marginBottom: "5px" }}>Nombre Completo</label>
              <input type="text" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} required style={{ width: "100%", padding: "10px", marginBottom: "15px", backgroundColor: "#111", color: "#DAA520", border: "1px solid #DAA520", borderRadius: "5px", boxSizing: "border-box" }} />

              <label style={{ display: "block", marginBottom: "5px" }}>Correo Electrónico</label>
              <input type="email" value={nuevoEmail} onChange={(e) => setNuevoEmail(e.target.value)} required style={{ width: "100%", padding: "10px", marginBottom: "15px", backgroundColor: "#111", color: "#DAA520", border: "1px solid #DAA520", borderRadius: "5px", boxSizing: "border-box" }} />

              <label style={{ display: "block", marginBottom: "5px" }}>Contraseña Inicial</label>
              <input type="password" value={nuevoPassword} onChange={(e) => setNuevoPassword(e.target.value)} required style={{ width: "100%", padding: "10px", marginBottom: "15px", backgroundColor: "#111", color: "#DAA520", border: "1px solid #DAA520", borderRadius: "5px", boxSizing: "border-box" }} />

              <label style={{ display: "block", marginBottom: "5px" }}>Rol / Permisos</label>
              <select value={nuevoRol} onChange={(e) => setNuevoRol(e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "20px", backgroundColor: "#111", color: "#DAA520", border: "1px solid #DAA520", borderRadius: "5px", boxSizing: "border-box" }}>
                <option value="Administrador">Administrador</option>
                <option value="Ventas">Ventas</option>
                <option value="Soporte Técnico">Soporte Técnico</option>
                <option value="Producción">Producción</option>
                <option value="Bodega">Bodega</option>
                <option value="Utility">Utility</option>
              </select>

              <div style={{ display: "flex", gap: "10px" }}>
                <button type="submit" style={{ flex: 1, padding: "10px", backgroundColor: "#DAA520", color: "#000", border: "none", fontWeight: "bold", borderRadius: "5px", cursor: "pointer" }}>Guardar</button>
                <button type="button" onClick={() => setMostrarModalColaborador(false)} style={{ flex: 1, padding: "10px", backgroundColor: "transparent", color: "#DAA520", border: "1px solid #DAA520", fontWeight: "bold", borderRadius: "5px", cursor: "pointer" }}>Cancelar</button>
              </div>
            </form>
          </div>
        )}

        {/* Listado de Usuarios */}
        {cargando ? (
          <p style={{ color: "#888", fontStyle: "italic" }}>Cargando registros de {vistaActiva}...</p>
        ) : usuariosFiltrados.length === 0 ? (
          <p style={{ color: "#666", fontStyle: "italic" }}>No se encontraron registros en la categoría {vistaActiva}.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {usuariosFiltrados.map((user: any) => {
              const estaActivo = user.activo !== false; 
              return (
                <div
                  key={user.id}
                  style={{
                    backgroundColor: "#0a0a0a",
                    border: `1px solid ${estaActivo ? "#333" : "#550000"}`,
                    borderRadius: "8px",
                    padding: "15px 20px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ fontWeight: "bold", fontSize: "1.1rem", color: "#fff" }}>
                      {user.razon_social || user.nombre || "Usuario Sin Nombre"}
                    </div>
                    <div style={{ fontSize: "0.9rem", color: "#aaa" }}>Email: {user.email || "N/A"}</div>
                    
                    {vistaActiva === "clientes" && (
                      <div style={{ fontSize: "0.85rem", color: "#888", display: "flex", gap: "10px", alignItems: "center" }}>
                        <span>Tipo: {user.tipo_cliente || "Integrador"}</span> | 
                        <span>Lista: <span style={{ color: "#DAA520" }}>{user.price_list || "C"}</span></span> | 
                        <span>Estado: <strong style={{ color: estaActivo ? "#00FF00" : "#FF0000" }}>{estaActivo ? "Activo" : "Inactivo"}</strong></span>
                      </div>
                    )}

                    {vistaActiva === "equipo" && (
                      <div style={{ fontSize: "0.85rem", color: "#888", display: "flex", gap: "10px", alignItems: "center" }}>
                        <span>Rol: <span style={{ color: "#DAA520" }}>{user.rol || "Administrador"}</span></span> | 
                        <span>Estado: <strong style={{ color: estaActivo ? "#00FF00" : "#FF0000" }}>{estaActivo ? "Activo" : "Inactivo"}</strong></span>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: "10px" }}>
                    {vistaActiva === "clientes" && (
                      <button
                        onClick={() => enviarInvitacionCliente(user.email)}
                        style={{
                          padding: "8px 12px",
                          backgroundColor: "transparent",
                          border: "1px solid #DAA520",
                          color: "#DAA520",
                          borderRadius: "5px",
                          cursor: "pointer",
                          fontWeight: "bold",
                          fontSize: "0.8rem"
                        }}
                      >
                        ENVIAR ACCESO / PASS
                      </button>
                    )}

                    <button
                      onClick={() => toggleEstadoUsuario(user.id, estaActivo, vistaActiva)}
                      style={{
                        padding: "8px 12px",
                        backgroundColor: estaActivo ? "#550000" : "#003300",
                        border: `1px solid ${estaActivo ? "#FF0000" : "#00FF00"}`,
                        color: "#fff",
                        borderRadius: "5px",
                        cursor: "pointer",
                        fontWeight: "bold",
                        fontSize: "0.8rem"
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