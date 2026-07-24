import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import Sidebar from "./Sidebar";

export default function AdminInventario() {
  const [subModulo, setSubModulo] = useState<"buscador" | "lista" | "editar" | "eliminar">("buscador");
  const [tablaActiva, setTablaActiva] = useState<"cablesdb" | "herrajesdb" | "accesoriosdb">("cablesdb");
  
  // Estados para búsqueda por SKU o Familia
  const [skuInput, setSkuInput] = useState("");
  const [familiaInput, setFamiliaInput] = useState("");
  const [productoSeleccionado, setProductoSeleccionado] = useState<any>(null);
  const [listaResultados, setListaResultados] = useState<any[]>([]);
  const [todosItems, setTodosItems] = useState<any[]>([]);

  // Estados para Edición (Solo nombre, especificaciones/descripción, imagen)
  const [editNombre, setEditNombre] = useState("");
  const [editDescripcion, setEditDescripcion] = useState("");
  const [editImagen, setEditImagen] = useState("");

  // Estados para Eliminación con doble confirmación
  const [pasoEliminar, setPasoEliminar] = useState<1 | 2>(1);

  // Cargar todos los elementos de la base de datos activa para listados o filtros rápidos
  useEffect(() => {
    cargarBaseDatos(tablaActiva);
  }, [tablaActiva]);

  const cargarBaseDatos = async (tabla: string) => {
    if (!supabase) return;
    const { data, error } = await supabase.from(tabla).select("*").order("id", { ascending: true });
    if (!error) {
      setTodosItems(data || []);
    }
  };

  // Buscar por SKU exacto (al presionar Enter o botón)
  const buscarPorSku = () => {
    if (!skuInput.trim()) return;
    const encontrado = todosItems.find(
      (item) => item.sku?.toLowerCase() === skuInput.trim().toLowerCase()
    );
    if (encontrado) {
      setProductoSeleccionado(encontrado);
      inicializarEdicion(encontrado);
      setSubModulo("editar");
    } else {
      alert("No se encontró ningún producto con ese SKU en la base de datos activa.");
    }
  };

  // Filtrar por Familia (si aplica el campo o categoría)
  const buscarPorFamilia = () => {
    if (!familiaInput.trim()) {
      setListaResultados(todosItems);
    } else {
      const filtrados = todosItems.filter(
        (item) => 
          item.familia?.toLowerCase().includes(familiaInput.trim().toLowerCase()) ||
          item.categoria?.toLowerCase().includes(familiaInput.trim().toLowerCase())
      );
      setListaResultados(filtrados);
    }
    setSubModulo("lista");
  };

  const seleccionarProducto = (item: any) => {
    setProductoSeleccionado(item);
    inicializarEdicion(item);
    setSubModulo("editar");
    setPasoEliminar(1);
  };

  const inicializarEdicion = (item: any) => {
    setEditNombre(item.nombre || item.title || "");
    setEditDescripcion(item.descripcion || item.description || "");
    setEditImagen(item.imagen || item.image_url || "");
  };

  // Guardar cambios (restringido a Nombre, Especificaciones/Descripción e Imagen)
  const guardarCambios = async () => {
    if (!supabase || !productoSeleccionado) return;

    const { error } = await supabase
      .from(tablaActiva)
      .update({
        nombre: editNombre,
        descripcion: editDescripcion,
        imagen: editImagen
      })
      .eq("id", productoSeleccionado.id);

    if (error) {
      alert("Error al actualizar el producto: " + error.message);
    } else {
      alert("¡Producto actualizado con éxito!");
      cargarBaseDatos(tablaActiva);
      setSubModulo("buscador");
    }
  };

  // Proceso de eliminación con doble confirmación S/N
  const confirmarEliminacion = async (decision: 'S' | 'N') => {
    if (decision === 'N') {
      setPasoEliminar(1);
      return;
    }

    if (pasoEliminar === 1) {
      setPasoEliminar(2);
    } else if (pasoEliminar === 2) {
      if (!supabase || !productoSeleccionado) return;

      const { error } = await supabase
        .from(tablaActiva)
        .delete()
        .eq("id", productoSeleccionado.id);

      if (error) {
        alert("Error al eliminar el producto: " + error.message);
      } else {
        alert("El producto ha sido eliminado correctamente.");
        cargarBaseDatos(tablaActiva);
        setProductoSeleccionado(null);
        setSubModulo("buscador");
        setPasoEliminar(1);
      }
    }
  };

  return (
    <div style={{ backgroundColor: "#000", minHeight: "100vh", display: "flex", color: "#DAA520", fontFamily: "sans-serif" }}>
      <Sidebar currentActive="inventario" />

      <div style={{ flex: 1, padding: "40px", overflowY: "auto" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "20px", borderBottom: "1px solid rgba(218, 165, 32, 0.3)", paddingBottom: "10px", letterSpacing: "1px" }}>
          CONTROL DE INVENTARIO Y PRODUCTOS
        </h1>

        {/* Selector de Bases de Datos (Tablas) */}
        <div style={{ display: "flex", gap: "15px", marginBottom: "20px" }}>
          {(["cablesdb", "herrajesdb", "accesoriosdb"] as const).map((tabla) => {
            const isActive = tablaActiva === tabla;
            return (
              <button
                key={tabla}
                onClick={() => { setTablaActiva(tabla); setSubModulo("buscador"); setProductoSeleccionado(null); }}
                style={{
                  padding: "8px 16px",
                  borderRadius: "4px",
                  border: "1px solid rgba(218, 165, 32, 0.4)",
                  backgroundColor: isActive ? "#DAA520" : "transparent",
                  color: isActive ? "#000" : "#DAA520",
                  fontWeight: "600",
                  fontSize: "0.75rem",
                  letterSpacing: "0.8px",
                  cursor: "pointer",
                  textTransform: "uppercase"
                }}
              >
                {tabla.replace("db", "")}
              </button>
            );
          })}
        </div>

        {/* Submenús de Navegación del Módulo */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "30px", borderBottom: "1px solid #1a1a1a", paddingBottom: "15px" }}>
          <button onClick={() => setSubModulo("buscador")} style={subTabBtn(subModulo === "buscador")}>1. Buscar / SKU</button>
          <button onClick={() => { setListaResultados(todosItems); setSubModulo("lista"); }} style={subTabBtn(subModulo === "lista")}>2. Ver Todos / Familia</button>
          {productoSeleccionado && (
            <>
              <button onClick={() => setSubModulo("editar")} style={subTabBtn(subModulo === "editar")}>3. Editar Producto</button>
              <button onClick={() => { setSubModulo("eliminar"); setPasoEliminar(1); }} style={subTabBtn(subModulo === "eliminar", true)}>4. Eliminar Producto</button>
            </>
          )}
        </div>

        {/* VISTA 1: BUSCADOR POR SKU O FAMILIA */}
        {subModulo === "buscador" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "25px", maxWidth: "500px" }}>
            <div style={cardBox}>
              <h3 style={{ fontSize: "1rem", marginBottom: "12px", color: "#fff" }}>Llamada directa por SKU (Presiona Enter)</h3>
              <div style={{ display: "flex", gap: "10px" }}>
                <input
                  type="text"
                  placeholder="Ingrese SKU exacto..."
                  value={skuInput}
                  onChange={(e) => setSkuInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') buscarPorSku(); }}
                  style={inputStyle}
                />
                <button onClick={buscarPorSku} style={btnAccion}>BUSCAR</button>
              </div>
            </div>

            <div style={cardBox}>
              <h3 style={{ fontSize: "1rem", marginBottom: "12px", color: "#fff" }}>Filtrar por Familia / Mostrar Todos</h3>
              <div style={{ display: "flex", gap: "10px" }}>
                <input
                  type="text"
                  placeholder="Familia o dejar vacío para ver todo..."
                  value={familiaInput}
                  onChange={(e) => setFamiliaInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') buscarPorFamilia(); }}
                  style={inputStyle}
                />
                <button onClick={buscarPorFamilia} style={btnAccion}>MOSTRAR</button>
              </div>
            </div>
          </div>
        )}

        {/* VISTA 2: LISTADO GENERAL / FILTRADO */}
        {subModulo === "lista" && (
          <div>
            <div style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ color: "#aaa", fontSize: "0.9rem" }}>Seleccione un producto de la lista para gestionar su información:</p>
              <button onClick={() => setSubModulo("buscador")} style={btnSecundario}>← Volver al buscador</button>
            </div>
            
            <div style={{ overflowX: "auto", border: "1px solid rgba(218, 165, 32, 0.2)", borderRadius: "6px", backgroundColor: "#050505" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(218, 165, 32, 0.3)", color: "#DAA520", backgroundColor: "#0a0a0a" }}>
                    <th style={thStyle}>SKU</th>
                    <th style={thStyle}>NOMBRE</th>
                    <th style={thStyle}>PRECIO (Fijo)</th>
                    <th style={thStyle}>STOCK (Fijo)</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>SELECCIONAR</th>
                  </tr>
                </thead>
                <tbody>
                  {listaResultados.map((item: any) => (
                    <tr key={item.id} style={{ borderBottom: "1px solid #141414" }}>
                      <td style={{ ...tdStyle, color: "#DAA520", fontWeight: "600" }}>{item.sku || "N/A"}</td>
                      <td style={{ ...tdStyle, color: "#fff", fontWeight: "500" }}>{item.nombre || item.title}</td>
                      <td style={{ ...tdStyle, color: "#aaa" }}>${Number(item.precio || item.price || 0).toFixed(2)}</td>
                      <td style={{ ...tdStyle, color: "#aaa" }}>{item.stock ?? "N/A"}</td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        <button onClick={() => seleccionarProducto(item)} style={btnAccionSmall}>SELECCIONAR</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VISTA 3: EDITAR PRODUCTO (Restringido: Solo Nombre, Especificaciones e Imagen) */}
        {subModulo === "editar" && productoSeleccionado && (
          <div style={{ ...cardBox, maxWidth: "700px" }}>
            <h2 style={{ fontSize: "1.2rem", marginBottom: "20px", color: "#fff" }}>
              Editando Producto: <span style={{ color: "#DAA520" }}>{productoSeleccionado.sku}</span>
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
              <div>
                <label style={labelStyle}>Precio (Bloqueado por seguridad)</label>
                <input type="text" disabled value={`$${Number(productoSeleccionado.precio || productoSeleccionado.price || 0).toFixed(2)}`} style={inputDisabled} />
              </div>
              <div>
                <label style={labelStyle}>Cantidad / Stock (Bloqueado)</label>
                <input type="text" disabled value={productoSeleccionado.stock ?? "N/A"} style={inputDisabled} />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              <div>
                <label style={labelStyle}>Nombre del Producto</label>
                <input type="text" value={editNombre} onChange={(e) => setEditNombre(e.target.value)} style={inputStyleFull} />
              </div>

              <div>
                <label style={labelStyle}>Especificaciones / Descripción</label>
                <textarea rows={4} value={editDescripcion} onChange={(e) => setEditDescripcion(e.target.value)} style={{ ...inputStyleFull, resize: "vertical" }} />
              </div>

              <div>
                <label style={labelStyle}>URL de la Imagen</label>
                <input type="text" value={editImagen} onChange={(e) => setEditImagen(e.target.value)} style={inputStyleFull} />
                {editImagen && (
                  <div style={{ marginTop: "10px" }}>
                    <img src={editImagen} alt="Vista previa" style={{ maxWidth: "120px", maxHeight: "120px", borderRadius: "4px", border: "1px solid #333" }} />
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: "15px", marginTop: "25px" }}>
              <button onClick={guardarCambios} style={btnAccion}>GUARDAR CAMBIOS</button>
              <button onClick={() => setSubModulo("buscador")} style={btnSecundario}>CANCELAR</button>
            </div>
          </div>
        )}

        {/* VISTA 4: ELIMINAR PRODUCTO (Doble Pregunta S/N) */}
        {subModulo === "eliminar" && productoSeleccionado && (
          <div style={{ ...cardBox, maxWidth: "500px", textAlign: "center", padding: "40px" }}>
            <h2 style={{ fontSize: "1.3rem", marginBottom: "15px", color: "#e74c3c" }}>ELIMINAR PRODUCTO</h2>
            
            {pasoEliminar === 1 ? (
              <>
                <p style={{ fontSize: "1rem", marginBottom: "25px", color: "#fff" }}>
                  ¿Desea eliminar el producto <b>{productoSeleccionado.nombre || productoSeleccionado.sku}</b>?
                </p>
                <div style={{ display: "flex", justifyContent: "center", gap: "20px" }}>
                  <button onClick={() => confirmarEliminacion('S')} style={btnSi}>S (Sí)</button>
                  <button onClick={() => confirmarEliminacion('N')} style={btnNo}>N (No)</button>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: "1rem", marginBottom: "25px", color: "#e74c3c", fontWeight: "bold" }}>
                  ¿ESTÁ SEGURO? Esta acción es irreversible.
                </p>
                <div style={{ display: "flex", justifyContent: "center", gap: "20px" }}>
                  <button onClick={() => confirmarEliminacion('S')} style={btnSiRoho}>S (Sí, eliminar)</button>
                  <button onClick={() => confirmarEliminacion('N')} style={btnNo}>N (No, regresar)</button>
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

// Estilos de Apoyo Elegantes
const cardBox = {
  backgroundColor: "#080808",
  border: "1px solid rgba(218, 165, 32, 0.2)",
  borderRadius: "6px",
  padding: "25px"
};

const inputStyle = {
  flex: 1,
  padding: "10px 14px",
  backgroundColor: "#050505",
  border: "1px solid rgba(218, 165, 32, 0.4)",
  borderRadius: "4px",
  color: "#DAA520",
  outline: "none",
  fontSize: "0.9rem"
};

const inputStyleFull = {
  width: "100%",
  padding: "10px 14px",
  backgroundColor: "#050505",
  border: "1px solid rgba(218, 165, 32, 0.4)",
  borderRadius: "4px",
  color: "#DAA520",
  outline: "none",
  fontSize: "0.9rem",
  boxSizing: "border-box" as const
};

const inputDisabled = {
  ...inputStyleFull,
  backgroundColor: "#111",
  color: "#666",
  cursor: "not-allowed",
  border: "1px solid #222"
};

const labelStyle = {
  display: "block",
  fontSize: "0.8rem",
  color: "#aaa",
  marginBottom: "6px",
  letterSpacing: "0.5px",
  textTransform: "uppercase" as const
};

const btnAccion = {
  padding: "10px 20px",
  backgroundColor: "#DAA520",
  color: "#000",
  fontWeight: "600",
  fontSize: "0.8rem",
  letterSpacing: "0.8px",
  border: "none",
  borderRadius: "4px",
  cursor: "pointer"
};

const btnAccionSmall = {
  padding: "6px 12px",
  backgroundColor: "transparent",
  color: "#DAA520",
  border: "1px solid rgba(218, 165, 32, 0.4)",
  fontWeight: "600",
  fontSize: "0.75rem",
  borderRadius: "4px",
  cursor: "pointer"
};

const btnSecundario = {
  padding: "10px 20px",
  backgroundColor: "transparent",
  color: "#aaa",
  border: "1px solid #444",
  fontWeight: "600",
  fontSize: "0.8rem",
  borderRadius: "4px",
  cursor: "pointer"
};

const btnSi = {
  padding: "10px 25px",
  backgroundColor: "transparent",
  color: "#2ecc71",
  border: "1px solid rgba(46, 204, 113, 0.5)",
  fontWeight: "bold",
  borderRadius: "4px",
  cursor: "pointer"
};

const btnSiRoho = {
  padding: "10px 25px",
  backgroundColor: "#e74c3c",
  color: "#fff",
  border: "none",
  fontWeight: "bold",
  borderRadius: "4px",
  cursor: "pointer"
};

const btnNo = {
  padding: "10px 25px",
  backgroundColor: "transparent",
  color: "#aaa",
  border: "1px solid #555",
  fontWeight: "bold",
  borderRadius: "4px",
  cursor: "pointer"
};

const subTabBtn = (activo: boolean, esPeligro = false) => ({
  padding: "8px 16px",
  backgroundColor: activo ? (esPeligro ? "#e74c3c" : "#DAA520") : "transparent",
  color: activo ? (esPeligro ? "#fff" : "#000") : (esPeligro ? "#e74c3c" : "#DAA520"),
  border: `1px solid ${esPeligro ? "#e74c3c" : "rgba(218, 165, 32, 0.4)"}`,
  borderRadius: "4px",
  fontWeight: "600",
  fontSize: "0.75rem",
  letterSpacing: "0.8px",
  cursor: "pointer"
});

const thStyle = {
  padding: "12px 16px",
  fontWeight: "600",
  letterSpacing: "0.8px",
  fontSize: "0.75rem",
  textTransform: "uppercase" as const
};

const tdStyle = {
  padding: "12px 16px",
  letterSpacing: "0.4px"
};