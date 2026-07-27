import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

interface Producto {
  id?: string;
  sku?: string;
  SKU?: string;
  descripcion?: string;
  Descripción?: string;
  especificaciones?: string;
  Especificaciones?: string;
  familia?: string;
  Familia?: string;
  precio_a?: number;
  precio_b?: number;
  precio_c?: number;
  precio_d?: number;
  cantidad?: number;
  imagen_url?: string;
}

export default function Bodega() {
  const [subModulo, setSubModulo] = useState<"buscador" | "crear" | "editar" | "eliminar">("buscador");
  
  // Selección de tablas/buckets
  const [tablaActiva, setTablaActiva] = useState<string>("cabledb");
  const tablasDisponibles = ["cabledb", "accesoriosdb", "equiposdb"];

  // Buscador y Resultados
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(false);
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null);

  // Estados Formulario Crear (Comienza sin tabla seleccionada para forzar la elección previa)
  const [tablaCreacion, setTablaCreacion] = useState<string>("");
  const [familiasCreacion, setFamiliasCreacion] = useState<string[]>([]);
  const [nuevaFamiliaSeleccionada, setNuevaFamiliaSeleccionada] = useState("");
  const [nombreNuevaFamilia, setNombreNuevaFamilia] = useState("");
  const [nuevoSku, setNuevoSku] = useState("");
  const [nuevaDescripcion, setNuevaDescripcion] = useState("");
  const [nuevasEspecificaciones, setNuevasEspecificaciones] = useState("");
  const [nuevoPrecioA, setNuevoPrecioA] = useState<number | "">("");
  const [nuevoPrecioB, setNuevoPrecioB] = useState<number | "">("");
  const [nuevoPrecioC, setNuevoPrecioC] = useState<number | "">("");
  const [nuevoPrecioD, setNuevoPrecioD] = useState<number | "">("");
  const [nuevaCantidad, setNuevaCantidad] = useState<number | "">("");
  const [nuevaImagenUrl, setNuevaImagenUrl] = useState("");
  const [subiendoImagen, setSubiendoImagen] = useState(false);

  // Estados Formulario Editar (Precios A, B, C, D)
  const [editPrecioA, setEditPrecioA] = useState<number | "">("");
  const [editPrecioB, setEditPrecioB] = useState<number | "">("");
  const [editPrecioC, setEditPrecioC] = useState<number | "">("");
  const [editPrecioD, setEditPrecioD] = useState<number | "">("");
  const [editCantidad, setEditCantidad] = useState<number | "">("");
  const [editImagenUrl, setEditImagenUrl] = useState("");
  const [editDescripcion, setEditDescripcion] = useState("");
  const [editEspecificaciones, setEditEspecificaciones] = useState("");

  // Estado Eliminar
  const [pasoEliminar, setPasoEliminar] = useState<1 | 2>(1);

  // Cargar productos por tabla activa en el buscador
  useEffect(() => {
    if (subModulo === "buscador") {
      buscarProductos();
    }
  }, [tablaActiva, subModulo]);

  const buscarProductos = async () => {
    setCargando(true);
    try {
      let query = supabase.from(tablaActiva).select("*");
      if (busqueda.trim() !== "") {
        query = query.or(`SKU.ilike.%${busqueda}%,sku.ilike.%${busqueda}%,Descripción.ilike.%${busqueda}%,descripcion.ilike.%${busqueda}%`);
      }
      const { data, error } = await query.limit(50);
      if (error) throw error;
      setResultados(data || []);
    } catch (err) {
      console.error("Error al consultar inventario:", err);
    } finally {
      setCargando(false);
    }
  };

  // Selección explícita de base de datos para la creación
  const seleccionarTablaCreacion = async (tabla: string) => {
    setTablaCreacion(tabla);
    setFamiliasCreacion([]);
    setNuevaFamiliaSeleccionada("");
    setNombreNuevaFamilia("");
    
    // Consultar familias existentes en la tabla seleccionada
    try {
      const { data, error } = await supabase.from(tabla).select("Familia, familia");
      if (!error && data) {
        const unicas = Array.from(
          new Set(data.map((item) => item.Familia || item.familia).filter(Boolean))
        ) as string[];
        setFamiliasCreacion(unicas);
      }
    } catch (err) {
      console.error("Error al consultar familias:", err);
    }
  };

  // Subir imagen a Supabase Storage
  const handleSubirImagen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
    const filePath = `productos/${fileName}`;

    setSubiendoImagen(true);
    try {
      const { error: uploadError } = await supabase.storage.from('catalogos').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('catalogos').getPublicUrl(filePath);
      setNuevaImagenUrl(urlData.publicUrl);
    } catch (err: any) {
      alert("Error al subir imagen: " + err.message);
    } finally {
      setSubiendoImagen(false);
    }
  };

  const guardarNuevoProducto = async () => {
    if (!tablaCreacion) {
      alert("Debes seleccionar una base de datos.");
      return;
    }
    if (!nuevoSku.trim()) {
      alert("El SKU es obligatorio.");
      return;
    }

    const familiaFinal = nuevaFamiliaSeleccionada === "__NUEVA__" ? nombreNuevaFamilia : nuevaFamiliaSeleccionada;

    const nuevoProducto = {
      SKU: nuevoSku.trim(),
      Descripción: nuevaDescripcion.trim(),
      Especificaciones: nuevasEspecificaciones.trim(),
      Familia: familiaFinal.trim(),
      precio_a: nuevoPrecioA === "" ? 0 : Number(nuevoPrecioA),
      precio_b: nuevoPrecioB === "" ? 0 : Number(nuevoPrecioB),
      precio_c: nuevoPrecioC === "" ? 0 : Number(nuevoPrecioC),
      precio_d: nuevoPrecioD === "" ? 0 : Number(nuevoPrecioD),
      cantidad: nuevaCantidad === "" ? 0 : Number(nuevaCantidad),
      imagen_url: nuevaImagenUrl
    };

    try {
      const { error } = await supabase.from(tablaCreacion).insert([nuevoProducto]);
      if (error) throw error;

      alert("Producto creado con éxito.");
      // Limpiar formulario y reiniciar flujo
      setTablaCreacion("");
      setNuevoSku("");
      setNuevaDescripcion("");
      setNuevasEspecificaciones("");
      setNuevoPrecioA("");
      setNuevoPrecioB("");
      setNuevoPrecioC("");
      setNuevoPrecioD("");
      setNuevaCantidad("");
      setNuevaImagenUrl("");
      setSubModulo("buscador");
    } catch (err: any) {
      alert("Error al crear producto: " + err.message);
    }
  };

  const seleccionarParaEditar = (prod: Producto) => {
    setProductoSeleccionado(prod);
    setEditPrecioA(prod.precio_a ?? "");
    setEditPrecioB(prod.precio_b ?? "");
    setEditPrecioC(prod.precio_c ?? "");
    setEditPrecioD(prod.precio_d ?? "");
    setEditCantidad(prod.cantidad ?? "");
    setEditImagenUrl(prod.imagen_url || "");
    setEditDescripcion(prod.Descripción || prod.descripcion || "");
    setEditEspecificaciones(prod.Especificaciones || prod.especificaciones || "");
    setSubModulo("editar");
  };

  const guardarCambiosInteligente = async () => {
    if (!productoSeleccionado) return;
    const idProd = productoSeleccionado.id;
    const skuProd = productoSeleccionado.SKU || productoSeleccionado.sku;

    const payload = {
      precio_a: editPrecioA === "" ? 0 : Number(editPrecioA),
      precio_b: editPrecioB === "" ? 0 : Number(editPrecioB),
      precio_c: editPrecioC === "" ? 0 : Number(editPrecioC),
      precio_d: editPrecioD === "" ? 0 : Number(editPrecioD),
      cantidad: editCantidad === "" ? 0 : Number(editCantidad),
      imagen_url: editImagenUrl,
      Descripción: editDescripcion,
      Especificaciones: editEspecificaciones
    };

    try {
      let error;
      if (idProd) {
        ({ error } = await supabase.from(tablaActiva).update(payload).eq("id", idProd));
      } else if (skuProd) {
        ({ error } = await supabase.from(tablaActiva).update(payload).or(`SKU.eq.${skuProd},sku.eq.${skuProd}`));
      }

      if (error) throw error;
      alert("Producto actualizado con éxito.");
      setSubModulo("buscador");
      buscarProductos();
    } catch (err: any) {
      alert("Error al guardar cambios: " + err.message);
    }
  };

  const confirmarEliminacion = async (respuesta: 'S' | 'N') => {
    if (respuesta === 'N') {
      setSubModulo("buscador");
      setPasoEliminar(1);
      return;
    }

    if (pasoEliminar === 1) {
      setPasoEliminar(2);
      return;
    }

    if (pasoEliminar === 2 && productoSeleccionado) {
      try {
        const idProd = productoSeleccionado.id;
        const skuProd = productoSeleccionado.SKU || productoSeleccionado.sku;
        let error;

        if (idProd) {
          ({ error } = await supabase.from(tablaActiva).delete().eq("id", idProd));
        } else if (skuProd) {
          ({ error } = await supabase.from(tablaActiva).delete().or(`SKU.eq.${skuProd},sku.eq.${skuProd}`));
        }

        if (error) throw error;
        alert("Producto eliminado correctamente.");
        setSubModulo("buscador");
        setPasoEliminar(1);
        buscarProductos();
      } catch (err: any) {
        alert("Error al eliminar producto: " + err.message);
      }
    }
  };

  return (
    <div style={{ width: "100%" }}>
      {/* MENÚ DE SUBMÓDULO BODEGA */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <button onClick={() => setSubModulo("buscador")} style={subTabBtn(subModulo === "buscador")}>🔍 BUSCADOR BODEGA</button>
        <button onClick={() => { setSubModulo("crear"); setTablaCreacion(""); }} style={subTabBtn(subModulo === "crear")}>+ NUEVO PRODUCTO</button>
      </div>

      {/* SUBMÓDULO 1: BUSCADOR */}
      {subModulo === "buscador" && (
        <div style={cardBox}>
          {/* SELECTOR DE TABLAS DE BODEGA */}
          <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
            {tablasDisponibles.map((t) => (
              <button
                key={t}
                onClick={() => setTablaActiva(t)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "4px",
                  border: "1px solid #DAA520",
                  backgroundColor: tablaActiva === t ? "#DAA520" : "transparent",
                  color: tablaActiva === t ? "#000" : "#DAA520",
                  fontWeight: "bold",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                  textTransform: "uppercase"
                }}
              >
                {t.replace("db", "").toUpperCase()}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
            <input
              type="text"
              placeholder="Buscar por SKU o Descripción..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={inputStyle}
            />
            <button onClick={buscarProductos} style={btnAccion}>BUSCAR</button>
          </div>

          {/* TABLA DE PRODUCTOS CON PRECIOS A, B, C, D */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", color: "#fff", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(218, 165, 32, 0.4)", backgroundColor: "#000", color: "#DAA520" }}>
                  <th style={thStyle}>Foto</th>
                  <th style={thStyle}>SKU</th>
                  <th style={thStyle}>Descripción</th>
                  <th style={thStyle}>P. A (ISP)</th>
                  <th style={thStyle}>P. B (May.)</th>
                  <th style={thStyle}>P. C (Integ.)</th>
                  <th style={thStyle}>P. D (Final)</th>
                  <th style={thStyle}>Stock</th>
                  <th style={thStyle}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  <tr><td colSpan={9} style={{ textTransform: "uppercase", padding: "20px", textAlign: "center", color: "#DAA520" }}>Cargando catálogo...</td></tr>
                ) : resultados.length === 0 ? (
                  <tr><td colSpan={9} style={{ textTransform: "uppercase", padding: "20px", textAlign: "center", color: "#666" }}>No se encontraron productos.</td></tr>
                ) : (
                  resultados.map((prod, idx) => (
                    <tr key={prod.id || idx} style={{ borderBottom: "1px solid #111" }}>
                      <td style={tdStyle}>
                        {prod.imagen_url ? (
                          <img src={prod.imagen_url} alt="Prod" style={{ width: "35px", height: "35px", objectFit: "contain", borderRadius: "3px" }} />
                        ) : (
                          <div style={{ width: "35px", height: "35px", backgroundColor: "#111", borderRadius: "3px" }} />
                        )}
                      </td>
                      <td style={{ ...tdStyle, color: "#DAA520", fontWeight: "bold" }}>{prod.SKU || prod.sku}</td>
                      <td style={tdStyle}>{prod.Descripción || prod.descripcion}</td>
                      <td style={tdStyle}>${prod.precio_a ?? 0}</td>
                      <td style={tdStyle}>${prod.precio_b ?? 0}</td>
                      <td style={tdStyle}>${prod.precio_c ?? 0}</td>
                      <td style={tdStyle}>${prod.precio_d ?? 0}</td>
                      <td style={{ ...tdStyle, fontWeight: "bold" }}>{prod.cantidad ?? 0}</td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", gap: "5px" }}>
                          <button onClick={() => seleccionarParaEditar(prod)} style={btnAccionSmall}>EDITAR</button>
                          <button onClick={() => { setProductoSeleccionado(prod); setSubModulo("eliminar"); }} style={{ ...btnAccionSmall, color: "#e74c3c", borderColor: "#e74c3c" }}>BORRAR</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBMÓDULO 2: CREAR PRODUCTO (SELECCIÓN PREVIA DE BASE DE DATOS) */}
      {subModulo === "crear" && (
        <div style={{ ...cardBox, maxWidth: "750px" }}>
          {!tablaCreacion ? (
            <div>
              <h2 style={{ fontSize: "1.1rem", marginBottom: "15px", color: "#DAA520", textTransform: "uppercase" }}>
                PASO 1: SELECCIONA LA BASE DE DATOS DE DESTINO
              </h2>
              <p style={{ color: "#aaa", fontSize: "0.85rem", marginBottom: "20px" }}>
                Por favor, elige el inventario en el cual deseas registrar el nuevo producto:
              </p>
              <div style={{ display: "flex", gap: "15px", flexWrap: "wrap" }}>
                {tablasDisponibles.map((t) => (
                  <button
                    key={t}
                    onClick={() => seleccionarTablaCreacion(t)}
                    style={{
                      padding: "15px 25px",
                      borderRadius: "6px",
                      border: "1px solid #DAA520",
                      backgroundColor: "#000",
                      color: "#DAA520",
                      fontWeight: "bold",
                      fontSize: "0.9rem",
                      cursor: "pointer",
                      textTransform: "uppercase"
                    }}
                  >
                    📦 {t.replace("db", "").toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h2 style={{ fontSize: "1.1rem", color: "#fff" }}>
                  CREANDO EN: <span style={{ color: "#DAA520", textTransform: "uppercase" }}>{tablaCreacion.replace("db", "")}</span>
                </h2>
                <button onClick={() => setTablaCreacion("")} style={{ ...btnSecundario, fontSize: "0.7rem" }}>
                  CHANGE BASE DE DATOS
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
                <div>
                  <label style={labelStyle}>SKU / Código *</label>
                  <input type="text" value={nuevoSku} onChange={(e) => setNuevoSku(e.target.value)} placeholder="Ej: TL-FO-101" style={inputStyleFull} />
                </div>
                <div>
                  <label style={labelStyle}>Familia de Producto</label>
                  <select
                    value={nuevaFamiliaSeleccionada}
                    onChange={(e) => setNuevaFamiliaSeleccionada(e.target.value)}
                    style={inputStyleFull}
                  >
                    <option value="">-- Seleccionar Familia --</option>
                    {familiasCreacion.map((f, i) => (
                      <option key={i} value={f}>{f}</option>
                    ))}
                    <option value="__NUEVA__">+ CREAR NUEVA FAMILIA</option>
                  </select>
                </div>
              </div>

              {nuevaFamiliaSeleccionada === "__NUEVA__" && (
                <div style={{ marginBottom: "15px" }}>
                  <label style={labelStyle}>Nombre de la Nueva Familia</label>
                  <input type="text" value={nombreNuevaFamilia} onChange={(e) => setNombreNuevaFamilia(e.target.value)} placeholder="Escribe la nueva familia..." style={inputStyleFull} />
                </div>
              )}

              <div style={{ marginBottom: "15px" }}>
                <label style={labelStyle}>Descripción</label>
                <input type="text" value={nuevaDescripcion} onChange={(e) => setNuevaDescripcion(e.target.value)} placeholder="Descripción detallada del producto" style={inputStyleFull} />
              </div>

              <div style={{ marginBottom: "15px" }}>
                <label style={labelStyle}>Especificaciones Técnicas</label>
                <textarea value={nuevasEspecificaciones} onChange={(e) => setNuevasEspecificaciones(e.target.value)} placeholder="Especificaciones principales..." style={{ ...inputStyleFull, height: "60px", resize: "vertical" }} />
              </div>

              {/* MATRIZ DE PRECIOS */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "10px", marginBottom: "15px" }}>
                <div>
                  <label style={labelStyle}>P. A (ISP)</label>
                  <input type="number" step="0.01" value={nuevoPrecioA} onChange={(e) => setNuevoPrecioA(e.target.value)} style={inputStyleFull} />
                </div>
                <div>
                  <label style={labelStyle}>P. B (Mayorista)</label>
                  <input type="number" step="0.01" value={nuevoPrecioB} onChange={(e) => setNuevoPrecioB(e.target.value)} style={inputStyleFull} />
                </div>
                <div>
                  <label style={labelStyle}>P. C (Integrador)</label>
                  <input type="number" step="0.01" value={nuevoPrecioC} onChange={(e) => setNuevoPrecioC(e.target.value)} style={inputStyleFull} />
                </div>
                <div>
                  <label style={labelStyle}>P. D (Final)</label>
                  <input type="number" step="0.01" value={nuevoPrecioD} onChange={(e) => setNuevoPrecioD(e.target.value)} style={inputStyleFull} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "20px" }}>
                <div>
                  <label style={labelStyle}>Stock Inicial</label>
                  <input type="number" value={nuevaCantidad} onChange={(e) => setNuevaCantidad(e.target.value)} style={inputStyleFull} />
                </div>
                <div>
                  <label style={labelStyle}>Imagen del Producto</label>
                  <input type="file" accept="image/*" onChange={handleSubirImagen} style={{ color: "#aaa", fontSize: "0.8rem" }} />
                  {subiendoImagen && <span style={{ color: "#DAA520", fontSize: "0.75rem", display: "block" }}>Subiendo imagen...</span>}
                  {nuevaImagenUrl && <img src={nuevaImagenUrl} alt="Vista previa" style={{ width: "40px", height: "40px", marginTop: "5px", objectFit: "contain", borderRadius: "3px" }} />}
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={guardarNuevoProducto} style={btnAccion}>REGISTRAR PRODUCTO</button>
                <button onClick={() => setSubModulo("buscador")} style={btnSecundario}>CANCELAR</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUBMÓDULO 3: EDITAR PRECIOS / STOCK / DATOS */}
      {subModulo === "editar" && productoSeleccionado && (
        <div style={{ ...cardBox, maxWidth: "700px" }}>
          <h2 style={{ fontSize: "1.1rem", marginBottom: "20px", color: "#fff" }}>
            Editando SKU: <span style={{ color: "#DAA520" }}>{productoSeleccionado.SKU || productoSeleccionado.sku}</span>
          </h2>
          <div style={{ marginBottom: "15px" }}>
            <label style={labelStyle}>Descripción</label>
            <input type="text" value={editDescripcion} onChange={(e) => setEditDescripcion(e.target.value)} style={inputStyleFull} />
          </div>
          <div style={{ marginBottom: "15px" }}>
            <label style={labelStyle}>Especificaciones</label>
            <textarea value={editEspecificaciones} onChange={(e) => setEditEspecificaciones(e.target.value)} style={{ ...inputStyleFull, height: "60px", resize: "vertical" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
            <div>
              <label style={labelStyle}>Precio A (ISP)</label>
              <input type="number" step="0.01" value={editPrecioA} onChange={(e) => setEditPrecioA(e.target.value)} style={inputStyleFull} />
            </div>
            <div>
              <label style={labelStyle}>Precio B (Mayorista)</label>
              <input type="number" step="0.01" value={editPrecioB} onChange={(e) => setEditPrecioB(e.target.value)} style={inputStyleFull} />
            </div>
            <div>
              <label style={labelStyle}>Precio C (Integrador)</label>
              <input type="number" step="0.01" value={editPrecioC} onChange={(e) => setEditPrecioC(e.target.value)} style={inputStyleFull} />
            </div>
            <div>
              <label style={labelStyle}>Precio D (Cliente Final)</label>
              <input type="number" step="0.01" value={editPrecioD} onChange={(e) => setEditPrecioD(e.target.value)} style={inputStyleFull} />
            </div>
          </div>
          <div style={{ marginBottom: "15px" }}>
            <label style={labelStyle}>Stock / Cantidad</label>
            <input type="number" value={editCantidad} onChange={(e) => setEditCantidad(e.target.value === "" ? "" : Number(e.target.value))} style={inputStyleFull} />
          </div>
          <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
            <button onClick={guardarCambiosInteligente} style={btnAccion}>GUARDAR CAMBIOS</button>
            <button onClick={() => setSubModulo("buscador")} style={btnSecundario}>CANCELAR</button>
          </div>
        </div>
      )}

      {/* SUBMÓDULO 4: ELIMINAR CON DOUBLE CHECK */}
      {subModulo === "eliminar" && productoSeleccionado && (
        <div style={{ ...cardBox, maxWidth: "500px", border: "1px solid #e74c3c" }}>
          <h2 style={{ fontSize: "1rem", color: "#e74c3c", marginBottom: "15px" }}>⚠️ ELIMINAR PRODUCTO DE BODEGA</h2>
          <p style={{ color: "#fff", fontSize: "0.85rem", marginBottom: "20px" }}>
            Estás a punto de borrar el SKU: <b style={{ color: "#DAA520" }}>{productoSeleccionado.SKU || productoSeleccionado.sku}</b>
          </p>
          {pasoEliminar === 1 ? (
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => confirmarEliminacion('S')} style={btnPeligro}>SÍ, ELIMINAR</button>
              <button onClick={() => confirmarEliminacion('N')} style={btnSecundario}>CANCELAR</button>
            </div>
          ) : (
            <div>
              <p style={{ color: "#e74c3c", fontWeight: "bold", fontSize: "0.85rem", marginBottom: "15px" }}>¿Seguro? Esta acción es irreversible.</p>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={() => confirmarEliminacion('S')} style={btnPeligro}>CONFIRMAR ELIMINACIÓN</button>
                <button onClick={() => confirmarEliminacion('N')} style={btnSecundario}>REGRESAR</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const cardBox: React.CSSProperties = { backgroundColor: "#080808", border: "1px solid rgba(218, 165, 32, 0.3)", borderRadius: "8px", padding: "20px" };
const inputStyle: React.CSSProperties = { flex: 1, backgroundColor: "#000", border: "1px solid rgba(218, 165, 32, 0.4)", borderRadius: "4px", padding: "8px 12px", color: "#fff" };
const inputStyleFull: React.CSSProperties = { width: "100%", backgroundColor: "#000", border: "1px solid rgba(218, 165, 32, 0.4)", borderRadius: "4px", padding: "8px 12px", color: "#fff", boxSizing: "border-box" };
const labelStyle: React.CSSProperties = { fontSize: "0.75rem", color: "#DAA520", display: "block", marginBottom: "4px", textTransform: "uppercase" };
const btnAccion: React.CSSProperties = { backgroundColor: "#DAA520", color: "#000", border: "none", borderRadius: "4px", padding: "8px 16px", fontWeight: "bold", cursor: "pointer", fontSize: "0.75rem" };
const btnSecundario: React.CSSProperties = { backgroundColor: "transparent", color: "#aaa", border: "1px solid #444", borderRadius: "4px", padding: "8px 16px", cursor: "pointer", fontSize: "0.75rem" };
const btnPeligro: React.CSSProperties = { backgroundColor: "#e74c3c", color: "#fff", border: "none", borderRadius: "4px", padding: "8px 16px", fontWeight: "bold", cursor: "pointer", fontSize: "0.75rem" };
const btnAccionSmall: React.CSSProperties = { backgroundColor: "transparent", color: "#DAA520", border: "1px solid #DAA520", borderRadius: "3px", padding: "3px 6px", fontSize: "0.7rem", cursor: "pointer" };
const subTabBtn = (isActive: boolean): React.CSSProperties => ({ backgroundColor: isActive ? "#DAA520" : "transparent", color: isActive ? "#000" : "#DAA520", border: "1px solid #DAA520", borderRadius: "4px", padding: "6px 12px", fontWeight: "bold", fontSize: "0.75rem", cursor: "pointer" });
const thStyle: React.CSSProperties = { padding: "10px", fontSize: "0.75rem", textTransform: "uppercase" };
const tdStyle: React.CSSProperties = { padding: "10px" };