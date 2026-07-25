import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import Sidebar from "./Sidebar";

export default function Proveedores() {
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [idProveedorActivo, setIdProveedorActivo] = useState<string | null>(null);

  // Campos correspondientes al módulo de Proveedores / Fábricas
  const [nombre, setNombre] = useState("");
  const [contacto, setContacto] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [pais, setPais] = useState("");
  const [tipoInsumo, setTipoInsumo] = useState("");
  const [condicionesPago, setCondicionesPago] = useState("50% anticipo, 50% contra entrega");
  const [estado, setEstado] = useState("Activo");
  const [descripcion, setDescripcion] = useState("");

  useEffect(() => {
    cargarProveedores();
  }, []);

  const cargarProveedores = async () => {
    if (!supabase) return;
    setCargando(true);
    try {
      const { data, error } = await supabase.from("proveedores").select("*").order("created_at", { ascending: false });
      if (error) {
        console.error("Error al cargar proveedores:", error);
      } else {
        setProveedores(data || []);
      }
    } catch (err) {
      console.error("Error inesperado:", err);
    } finally {
      setCargando(false);
    }
  };

  const abrirModalNuevo = () => {
    setModoEdicion(false);
    setIdProveedorActivo(null);
    setNombre("");
    setContacto("");
    setEmail("");
    setTelefono("");
    setPais("");
    setTipoInsumo("");
    setCondicionesPago("50% anticipo, 50% contra entrega");
    setEstado("Activo");
    setDescripcion("");
    setModalAbierto(true);
  };

  const abrirModalEditar = (prov: any) => {
    setModoEdicion(true);
    setIdProveedorActivo(prov.id);
    setNombre(prov.nombre || "");
    setContacto(prov.contacto || "");
    setEmail(prov.email || "");
    setTelefono(prov.telefono || "");
    setPais(prov.pais || "");
    setTipoInsumo(prov.tipo_insumo || "");
    setCondicionesPago(prov.condiciones_pago || "");
    setEstado(prov.estado || "Activo");
    setDescripcion(prov.descripcion || "");
    setModalAbierto(true);
  };

  const guardarProveedor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    const datosProveedor = {
      nombre,
      contacto,
      email,
      telefono,
      pais,
      tipo_insumo: tipoInsumo,
      condiciones_pago: condicionesPago,
      estado,
      descripcion
    };

    try {
      if (modoEdicion && idProveedorActivo) {
        const { error } = await supabase.from("proveedores").update(datosProveedor).eq("id", idProveedorActivo);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("proveedores").insert([datosProveedor]);
        if (error) throw error;
      }

      setModalAbierto(false);
      cargarProveedores();
    } catch (err: any) {
      console.error("Error al guardar proveedor:", err);
      alert("Hubo un error al guardar el proveedor: " + (err.message || err));
    }
  };

  const eliminarProveedor = async (id: string) => {
    if (!supabase) return;
    if (window.confirm("¿Estás seguro de eliminar este proveedor / fábrica?")) {
      try {
        const { error } = await supabase.from("proveedores").delete().eq("id", id);
        if (error) throw error;
        cargarProveedores();
      } catch (err: any) {
        console.error("Error al eliminar:", err);
        alert("No se pudo eliminar el proveedor.");
      }
    }
  };

  return (
    <div style={{ backgroundColor: "#000", minHeight: "100vh", display: "flex", color: "#DAA520", fontFamily: "sans-serif" }}>
      <Sidebar currentActive="proveedores" />

      <div style={{ flex: 1, padding: "40px", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "25px", borderBottom: "2px solid rgba(218, 165, 32, 0.4)", paddingBottom: "15px" }}>
          <h1 style={{ fontSize: "1.8rem", background: "linear-gradient(135deg, #FFD700 0%, #DAA520 50%, #B8860B 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "1.5px", fontWeight: "800", textTransform: "uppercase", margin: 0 }}>
            MÓDULO DE PROVEEDORES Y FÁBRICAS
          </h1>
          <button onClick={abrirModalNuevo} style={btnPrimary}>
            + Registrar Nueva Fábrica / Proveedor
          </button>
        </div>

        <div style={cardBoxStyle}>
          <h3 style={{ color: "#FFD700", marginBottom: "18px", fontSize: "1.1rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.8px" }}>
            Directorio Activo de Fabricantes y Suministros ({proveedores.length})
          </h3>

          {cargando ? (
            <div style={{ padding: "40px", textAlign: "center" }}>
              <p style={{ color: "#FFD700", fontStyle: "italic" }}>Cargando directorio de proveedores...</p>
            </div>
          ) : proveedores.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center" }}>
              <p style={{ color: "#888" }}>No hay proveedores registrados en la base de datos.</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.88rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid rgba(218, 165, 32, 0.4)", color: "#FFD700" }}>
                    <th style={{ padding: "12px" }}>Fábrica / Empresa</th>
                    <th style={{ padding: "12px" }}>Contacto / País</th>
                    <th style={{ padding: "12px" }}>Tipo de Insumo / Producto</th>
                    <th style={{ padding: "12px" }}>Condiciones de Pago</th>
                    <th style={{ padding: "12px" }}>Estado</th>
                    <th style={{ padding: "12px", textAlign: "right" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {proveedores.map((prov) => (
                    <tr key={prov.id} style={{ borderBottom: "1px solid #1c1c1c", color: "#ccc" }}>
                      <td style={{ padding: "12px" }}>
                        <div style={{ color: "#FFD700", fontWeight: "bold", fontSize: "0.95rem" }}>{prov.nombre}</div>
                        <div style={{ fontSize: "0.78rem", color: "#888" }}>{prov.email} | {prov.telefono}</div>
                      </td>
                      <td style={{ padding: "12px" }}>
                        <div style={{ color: "#fff" }}>{prov.contacto || "---"}</div>
                        <div style={{ fontSize: "0.78rem", color: "#DAA520" }}>📍 {prov.pais || "Internacional"}</div>
                      </td>
                      <td style={{ padding: "12px" }}>
                        <span style={{ backgroundColor: "rgba(218,165,32,0.1)", color: "#FFD700", padding: "4px 10px", borderRadius: "6px", fontSize: "0.78rem", border: "1px solid rgba(218,165,32,0.3)" }}>
                          {prov.tipo_insumo || "General"}
                        </span>
                      </td>
                      <td style={{ padding: "12px", fontSize: "0.82rem", color: "#aaa" }}>{prov.condiciones_pago}</td>
                      <td style={{ padding: "12px" }}>
                        <span style={{ color: prov.estado === "Activo" ? "#2ecc71" : "#e74c3c", fontWeight: "bold" }}>
                          ● {prov.estado}
                        </span>
                      </td>
                      <td style={{ padding: "12px", textAlign: "right" }}>
                        <button onClick={() => abrirModalEditar(prov)} style={btnSmallEdit}>Editar</button>
                        <button onClick={() => eliminarProveedor(prov.id)} style={btnSmallDelete}>Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {modalAbierto && (
          <div style={modalOverlayStyle}>
            <div style={modalContentStyle}>
              <h2 style={{ color: "#FFD700", marginBottom: "20px", fontSize: "1.3rem", textTransform: "uppercase" }}>
                {modoEdicion ? "Editar Proveedor / Fábrica" : "Registrar Nueva Fábrica / Proveedor"}
              </h2>

              <form onSubmit={guardarProveedor}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
                  <div>
                    <label style={labelStyle}>Nombre de la Fábrica / Empresa *</label>
                    <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} required style={inputStyle} placeholder="Ej: FiberOptic Tech China" />
                  </div>
                  <div>
                    <label style={labelStyle}>Persona de Contacto</label>
                    <input type="text" value={contacto} onChange={(e) => setContacto(e.target.value)} style={inputStyle} placeholder="Ej: Mr. Wang / Manager" />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
                  <div>
                    <label style={labelStyle}>Correo Electrónico</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} placeholder="contacto@fabrica.com" />
                  </div>
                  <div>
                    <label style={labelStyle}>Teléfono / WhatsApp</label>
                    <input type="text" value={telefono} onChange={(e) => setTelefono(e.target.value)} style={inputStyle} placeholder="+86 ..." />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
                  <div>
                    <label style={labelStyle}>País de Origen</label>
                    <input type="text" value={pais} onChange={(e) => setPais(e.target.value)} style={inputStyle} placeholder="Ej: China / Tailandia" />
                  </div>
                  <div>
                    <label style={labelStyle}>Tipo de Insumo / Producto</label>
                    <input type="text" value={tipoInsumo} onChange={(e) => setTipoInsumo(e.target.value)} style={inputStyle} placeholder="Ej: Cables ADSS, Herrajes, Materia Prima" />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
                  <div>
                    <label style={labelStyle}>Condiciones de Pago</label>
                    <input type="text" value={condicionesPago} onChange={(e) => setCondicionesPago(e.target.value)} style={inputStyle} placeholder="Ej: 50% anticipo, 50% contra entrega" />
                  </div>
                  <div>
                    <label style={labelStyle}>Estado</label>
                    <select value={estado} onChange={(e) => setEstado(e.target.value)} style={inputStyle}>
                      <option value="Activo" style={{ background: "#111", color: "#DAA520" }}>Activo</option>
                      <option value="Inactivo" style={{ background: "#111", color: "#DAA520" }}>Inactivo</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label style={labelStyle}>Descripción / Notas Adicionales</label>
                  <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} style={{ ...inputStyle, height: "80px", resize: "vertical" }} placeholder="Detalles de fabricación, tiempos de entrega, etc." />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                  <button type="button" onClick={() => setModalAbierto(false)} style={btnCancel}>
                    Cancelar
                  </button>
                  <button type="submit" style={btnPrimary}>
                    {modoEdicion ? "Actualizar Proveedor" : "Guardar Proveedor"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const cardBoxStyle = {
  background: "linear-gradient(145deg, #080808 0%, #121212 100%)",
  border: "1px solid rgba(218, 165, 32, 0.3)",
  borderRadius: "10px",
  padding: "22px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.5)"
};

const labelStyle = {
  display: "block",
  fontSize: "0.78rem",
  color: "#aaa",
  textTransform: "uppercase" as const,
  letterSpacing: "0.6px",
  marginBottom: "6px",
  fontWeight: "bold"
};

const inputStyle = {
  width: "100%",
  backgroundColor: "#0d0d0d",
  border: "1px solid rgba(218, 165, 32, 0.5)",
  borderRadius: "6px",
  padding: "11px 15px",
  color: "#FFD700",
  outline: "none",
  fontSize: "0.92rem",
  fontWeight: "600",
  boxSizing: "border-box" as const
};

const btnPrimary = {
  background: "linear-gradient(135deg, #FFD700 0%, #DAA520 100%)",
  color: "#000",
  border: "none",
  borderRadius: "6px",
  padding: "10px 20px",
  fontWeight: "800",
  cursor: "pointer",
  fontSize: "0.88rem",
  boxShadow: "0 4px 15px rgba(218,165,32,0.4)"
};

const btnCancel = {
  background: "transparent",
  color: "#888",
  border: "1px solid #444",
  borderRadius: "6px",
  padding: "10px 20px",
  fontWeight: "700",
  cursor: "pointer",
  fontSize: "0.88rem"
};

const btnSmallEdit = {
  background: "rgba(218,165,32,0.1)",
  color: "#FFD700",
  border: "1px solid rgba(218,165,32,0.4)",
  borderRadius: "4px",
  padding: "5px 10px",
  fontSize: "0.75rem",
  fontWeight: "bold",
  cursor: "pointer",
  marginRight: "6px"
};

const btnSmallDelete = {
  background: "rgba(231,76,60,0.1)",
  color: "#e74c3c",
  border: "1px solid rgba(231,76,60,0.4)",
  borderRadius: "4px",
  padding: "5px 10px",
  fontSize: "0.75rem",
  fontWeight: "bold",
  cursor: "pointer"
};

const modalOverlayStyle = {
  position: "fixed" as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0,0,0,0.85)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000,
  padding: "20px"
};

const modalContentStyle = {
  background: "linear-gradient(145deg, #0d0d0d 0%, #161616 100%)",
  border: "1px solid rgba(218, 165, 32, 0.7)",
  borderRadius: "12px",
  padding: "30px",
  width: "100%",
  maxWidth: "650px",
  boxShadow: "0 12px 40px rgba(0,0,0,0.8)",
  maxHeight: "90vh",
  overflowY: "auto" as const
};