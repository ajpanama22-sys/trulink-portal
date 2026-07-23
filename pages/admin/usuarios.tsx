import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import Sidebar from "./Sidebar";

export default function AdminUsuarios() {
  const [vistaActiva, setVistaActiva] = useState<"clientes" | "equipo">("clientes");
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    cargarUsuarios(vistaActiva);
  }, [vistaActiva]);

  const cargarUsuarios = async (vista: "clientes" | "equipo") => {
    if (!supabase) return;
    setCargando(true);
    setUsuarios([]);

    // Asumimos que los clientes están en la tabla 'clientes'
    // y el equipo puede estar en una tabla 'colaboradores' o filtrado por rol.
    // Ajusta el nombre de la tabla si tu equipo administrativo se guarda en otro lado.
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

  const usuariosFiltrados = usuarios.filter((user) =>
    user.razon_social?.toLowerCase().includes(busqueda.toLowerCase()) ||
    user.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    user.email?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div style={{ backgroundColor: "#000", minHeight: "100vh", display: "flex", color: "#DAA520", fontFamily: "sans-serif" }}>
      <Sidebar currentActive="usuarios" />

      <div style={{ flex: 1, padding: "40px", overflowY: "auto" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "20px", borderBottom: "1px solid #333", paddingBottom: "10px" }}>
          GESTIÓN DE USUARIOS
        </h1>

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

        {/* Listado de Usuarios */}
        {cargando ? (
          <p style={{ color: "#888", fontStyle: "italic" }}>Cargando registros de {vistaActiva}...</p>
        ) : usuariosFiltrados.length === 0 ? (
          <p style={{ color: "#666", fontStyle: "italic" }}>No se encontraron registros en la categoría {vistaActiva}.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {usuariosFiltrados.map((user: any) => (
              <div
                key={user.id}
                style={{
                  backgroundColor: "#0a0a0a",
                  border: "1px solid #333",
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
                    <div style={{ fontSize: "0.85rem", color: "#888" }}>
                      Tipo: {user.tipo_cliente || "Integrador"} | Lista de Precio: <span style={{ color: "#DAA520" }}>{user.price_list || "C"}</span>
                    </div>
                  )}
                  {vistaActiva === "equipo" && (
                    <div style={{ fontSize: "0.85rem", color: "#888" }}>
                      Rol: <span style={{ color: "#DAA520" }}>{user.rol || "Administrador"}</span>
                    </div>
                  )}
                </div>

                <div>
                  <button
                    onClick={() => alert(`Editar perfil de ${user.email}`)}
                    style={{
                      padding: "8px 15px",
                      backgroundColor: "transparent",
                      border: "1px solid #DAA520",
                      color: "#DAA520",
                      borderRadius: "5px",
                      cursor: "pointer",
                      fontWeight: "bold",
                      fontSize: "0.85rem"
                    }}
                  >
                    EDITAR / PERMISOS
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}