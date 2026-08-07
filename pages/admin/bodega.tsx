import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { theme } from "../../lib/theme";
import { Card, Button, inputStyle } from "../../lib/ui";

/**
 * Esquema REAL confirmado en cablesdb / accesoriosdb / herrajesdb
 * (las 3 tablas son consistentes entre sí):
 *   "Ítem #" / "Ítem"   bigint/text  -> correlativo (no se usa en el código)
 *   Familia              text
 *   SKU                  text        -> NO existe variante en minúscula
 *   Descripción          text        -> NO existe variante en minúscula
 *   Especificaciones     text
 *   estado_inventario    text
 *   image_url            text        -> ojo: NO es "imagen_url"
 *   precio_a/b/c/d       numeric
 *   Cantidad             integer     -> ojo: con mayúscula, NO "cantidad"
 *
 * Ninguna de las 3 tablas tiene columna "id". Por eso todo match de
 * edición/eliminación se hace por SKU (única columna que sirve de
 * identificador natural).
 */
interface Producto {
  SKU?: string;
  Descripción?: string;
  Especificaciones?: string;
  Familia?: string;
  estado_inventario?: string;
  precio_a?: number;
  precio_b?: number;
  precio_c?: number;
  precio_d?: number;
  Cantidad?: number;
  image_url?: string;
}

export default function Bodega() {
  const [subModulo, setSubModulo] = useState<"buscador" | "crear" | "editar" | "eliminar">("buscador");

  // Mapeo solicitado: CABLES (cablesdb), ACCESORIOS (accesoriosdb), HERRAJES (herrajesdb)
  const [tablaActiva, setTablaActiva] = useState<string>("cablesdb");
  const tablasDisponibles = [
    { key: "cablesdb", label: "CABLES" },
    { key: "accesoriosdb", label: "ACCESORIOS" },
    { key: "herrajesdb", label: "HERRAJES" }
  ];

  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(false);
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null);

  const [tablaCreacion, setTablaCreacion] = useState<string>("");
  const [familiasCreacion, setFamiliasCreacion] = useState<string[]>([]);
  const [cargandoFamilias, setCargandoFamilias] = useState(false);
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

  const [editPrecioA, setEditPrecioA] = useState<number | "">("");
  const [editPrecioB, setEditPrecioB] = useState<number | "">("");
  const [editPrecioC, setEditPrecioC] = useState<number | "">("");
  const [editPrecioD, setEditPrecioD] = useState<number | "">("");
  const [editCantidad, setEditCantidad] = useState<number | "">("");
  const [editImagenUrl, setEditImagenUrl] = useState("");
  const [editDescripcion, setEditDescripcion] = useState("");
  const [editEspecificaciones, setEditEspecificaciones] = useState("");

  const [pasoEliminar, setPasoEliminar] = useState<1 | 2>(1);

  const parseNumInput = (val: string): number | "" => (val === "" ? "" : Number(val));

  useEffect(() => {
    if (subModulo === "buscador") {
      buscarProductos();
    }
  }, [tablaActiva, subModulo]);

  const buscarProductos = async () => {
    if (!supabase) return;
    setCargando(true);
    try {
      let query = supabase.from(tablaActiva).select("*");
      if (busqueda.trim() !== "") {
        // Solo SKU y Descripción existen realmente en estas 3 tablas.
        // Antes también probaba "sku" y "descripcion" en minúscula, que
        // no existen: Postgres rechazaba TODA la consulta apenas se
        // escribía algo en el buscador.
        query = query.or(`SKU.ilike.%${busqueda}%,Descripción.ilike.%${busqueda}%`);
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

  /**
   * Carga las familias ya existentes en la tabla elegida (cablesdb,
   * accesoriosdb o herrajesdb) para poblar el select. Se pide la fila
   * completa ("*") en vez de columnas fijas, porque pedir una columna
   * que no existe en esa tabla específica hace fallar TODA la consulta
   * en Postgres/Supabase.
   */
  const seleccionarTablaCreacion = async (tabla: string) => {
    setTablaCreacion(tabla);
    setFamiliasCreacion([]);
    setNuevaFamiliaSeleccionada("");
    setNombreNuevaFamilia("");

    if (!supabase) return;

    setCargandoFamilias(true);
    try {
      const { data, error } = await supabase.from(tabla).select("*");
      if (error) {
        console.error(`Error al consultar familias de ${tabla}:`, error.message);
        alert("No se pudieron cargar las familias existentes: " + error.message);
        return;
      }
      const unicas = Array.from(
        new Set(
          (data || [])
            .map((item: any) => item.Familia)
            .filter((f: any) => typeof f === "string" && f.trim() !== "")
        )
      ) as string[];
      unicas.sort((a, b) => a.localeCompare(b));
      setFamiliasCreacion(unicas);
    } catch (err: any) {
      console.error("Error al consultar familias:", err);
      alert("No se pudieron cargar las familias existentes: " + (err?.message || err));
    } finally {
      setCargandoFamilias(false);
    }
  };

  const handleSubirImagen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !supabase) return;
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
    if (!supabase) return;
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
      Cantidad: nuevaCantidad === "" ? 0 : Number(nuevaCantidad),
      image_url: nuevaImagenUrl || null,
      estado_inventario: "disponible",
    };

    try {
      const { error } = await supabase.from(tablaCreacion).insert([nuevoProducto]);
      if (error) throw error;

      alert("Producto creado con éxito.");
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
    setEditCantidad(prod.Cantidad ?? "");
    setEditImagenUrl(prod.image_url || "");
    setEditDescripcion(prod.Descripción || "");
    setEditEspecificaciones(prod.Especificaciones || "");
    setSubModulo("editar");
  };

  const guardarCambiosInteligente = async () => {
    if (!productoSeleccionado || !supabase) return;
    const skuProd = productoSeleccionado.SKU;
    if (!skuProd) {
      alert("Este producto no tiene SKU válido, no se puede identificar para guardar los cambios.");
      return;
    }

    const payload = {
      precio_a: editPrecioA === "" ? 0 : Number(editPrecioA),
      precio_b: editPrecioB === "" ? 0 : Number(editPrecioB),
      precio_c: editPrecioC === "" ? 0 : Number(editPrecioC),
      precio_d: editPrecioD === "" ? 0 : Number(editPrecioD),
      Cantidad: editCantidad === "" ? 0 : Number(editCantidad),
      image_url: editImagenUrl || null,
      Descripción: editDescripcion,
      Especificaciones: editEspecificaciones,
    };

    try {
      // Ninguna de las 3 tablas tiene columna "id" — el único identificador
      // real es SKU. (Antes se probaba también "sku" en minúscula, que no
      // existe, y eso hacía fallar la consulta completa.)
      const { error } = await supabase.from(tablaActiva).update(payload).eq("SKU", skuProd);
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

    if (pasoEliminar === 2 && productoSeleccionado && supabase) {
      const skuProd = productoSeleccionado.SKU;
      if (!skuProd) {
        alert("Este producto no tiene SKU válido, no se puede identificar para eliminarlo.");
        return;
      }
      try {
        const { error } = await supabase.from(tablaActiva).delete().eq("SKU", skuProd);
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
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <Button
          variant={subModulo === "buscador" ? "gold" : "outline-gold"}
          onClick={() => setSubModulo("buscador")}
        >
          🔍 BUSCADOR BODEGA
        </Button>
        <Button
          variant={subModulo === "crear" ? "gold" : "outline-gold"}
          onClick={() => { setSubModulo("crear"); setTablaCreacion(""); }}
        >
          + NUEVO PRODUCTO
        </Button>
      </div>

      {subModulo === "buscador" && (
        <Card>
          <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
            {tablasDisponibles.map((item) => (
              <Button
                key={item.key}
                variant={tablaActiva === item.key ? "gold" : "outline-gold"}
                onClick={() => setTablaActiva(item.key)}
                style={{ padding: "8px 16px", fontSize: "0.75rem", textTransform: "uppercase" }}
              >
                {item.label}
              </Button>
            ))}
          </div>

          <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
            <input
              type="text"
              placeholder="Buscar por SKU o Descripción..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
            <Button variant="gold" onClick={buscarProductos}>BUSCAR</Button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", color: theme.textLight, fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${theme.borderGoldCounter}`, backgroundColor: theme.background, color: theme.gold }}>
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
                  <tr><td colSpan={9} style={{ textTransform: "uppercase", padding: "20px", textAlign: "center", color: theme.gold }}>Cargando catálogo...</td></tr>
                ) : resultados.length === 0 ? (
                  <tr><td colSpan={9} style={{ textTransform: "uppercase", padding: "20px", textAlign: "center", color: theme.textMuted }}>No se encontraron productos.</td></tr>
                ) : (
                  resultados.map((prod, idx) => (
                    <tr key={prod.SKU || idx} style={{ borderBottom: `1px solid ${theme.borderGoldLight}` }}>
                      <td style={tdStyle}>
                        {prod.image_url ? (
                          <img src={prod.image_url} alt="Prod" style={{ width: "35px", height: "35px", objectFit: "contain", borderRadius: "3px" }} />
                        ) : (
                          <div style={{ width: "35px", height: "35px", backgroundColor: theme.panelBg, borderRadius: "3px" }} />
                        )}
                      </td>
                      <td style={{ ...tdStyle, color: theme.gold, fontWeight: "bold" }}>{prod.SKU}</td>
                      <td style={tdStyle}>{prod.Descripción}</td>
                      <td style={tdStyle}>${prod.precio_a ?? 0}</td>
                      <td style={tdStyle}>${prod.precio_b ?? 0}</td>
                      <td style={tdStyle}>${prod.precio_c ?? 0}</td>
                      <td style={tdStyle}>${prod.precio_d ?? 0}</td>
                      <td style={{ ...tdStyle, fontWeight: "bold" }}>{prod.Cantidad ?? 0}</td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", gap: "5px" }}>
                          <Button
                            variant="ghost"
                            style={{ padding: "4px 10px", fontSize: "0.7rem", border: `1px solid ${theme.borderGoldLight}` }}
                            onClick={() => seleccionarParaEditar(prod)}
                          >
                            EDITAR
                          </Button>
                          <Button
                            variant="outline-red"
                            style={{ padding: "4px 10px", fontSize: "0.7rem" }}
                            onClick={() => { setProductoSeleccionado(prod); setSubModulo("eliminar"); }}
                          >
                            BORRAR
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {subModulo === "crear" && (
        <Card style={{ maxWidth: "750px" }}>
          {!tablaCreacion ? (
            <div>
              <h2 style={{ fontSize: "1.1rem", marginBottom: "15px", color: theme.gold, textTransform: "uppercase" }}>
                PASO 1: SELECCIONA LA BASE DE DATOS DE DESTINO
              </h2>
              <div style={{ display: "flex", gap: "15px", flexWrap: "wrap" }}>
                {tablasDisponibles.map((item) => (
                  <Button
                    key={item.key}
                    variant="outline-gold"
                    onClick={() => seleccionarTablaCreacion(item.key)}
                    style={{ padding: "15px 25px", fontSize: "0.9rem" }}
                  >
                    📦 {item.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h2 style={{ fontSize: "1.1rem", color: theme.textLight }}>
                  CREANDO EN: <span style={{ color: theme.gold, textTransform: "uppercase" }}>{tablasDisponibles.find(t => t.key === tablaCreacion)?.label}</span>
                </h2>
                <Button variant="outline-gold" style={{ fontSize: "0.7rem" }} onClick={() => setTablaCreacion("")}>
                  CAMBIAR BASE DE DATOS
                </Button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
                <div>
                  <label style={labelStyle}>SKU / Código *</label>
                  <input type="text" value={nuevoSku} onChange={(e) => setNuevoSku(e.target.value)} placeholder="Ej: TL-FO-101" style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={labelStyle}>Familia de Producto</label>
                  <select
                    value={nuevaFamiliaSeleccionada}
                    onChange={(e) => setNuevaFamiliaSeleccionada(e.target.value)}
                    style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
                    disabled={cargandoFamilias}
                  >
                    <option value="">
                      {cargandoFamilias ? "-- Cargando familias... --" : "-- Seleccionar Familia --"}
                    </option>
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
                  <input type="text" value={nombreNuevaFamilia} onChange={(e) => setNombreNuevaFamilia(e.target.value)} placeholder="Escribe la nueva familia..." style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
                </div>
              )}

              <div style={{ marginBottom: "15px" }}>
                <label style={labelStyle}>Descripción</label>
                <input type="text" value={nuevaDescripcion} onChange={(e) => setNuevaDescripcion(e.target.value)} placeholder="Descripción detallada del producto" style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
              </div>

              <div style={{ marginBottom: "15px" }}>
                <label style={labelStyle}>Especificaciones Técnicas</label>
                <textarea value={nuevasEspecificaciones} onChange={(e) => setNuevasEspecificaciones(e.target.value)} placeholder="Especificaciones principales..." style={{ ...inputStyle, width: "100%", boxSizing: "border-box", height: "60px", resize: "vertical" }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "10px", marginBottom: "15px" }}>
                <div>
                  <label style={labelStyle}>P. A (ISP)</label>
                  <input type="number" step="0.01" value={nuevoPrecioA} onChange={(e) => setNuevoPrecioA(parseNumInput(e.target.value))} style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={labelStyle}>P. B (Mayorista)</label>
                  <input type="number" step="0.01" value={nuevoPrecioB} onChange={(e) => setNuevoPrecioB(parseNumInput(e.target.value))} style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={labelStyle}>P. C (Integrador)</label>
                  <input type="number" step="0.01" value={nuevoPrecioC} onChange={(e) => setNuevoPrecioC(parseNumInput(e.target.value))} style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={labelStyle}>P. D (Final)</label>
                  <input type="number" step="0.01" value={nuevoPrecioD} onChange={(e) => setNuevoPrecioD(parseNumInput(e.target.value))} style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "20px" }}>
                <div>
                  <label style={labelStyle}>Stock Inicial</label>
                  <input type="number" value={nuevaCantidad} onChange={(e) => setNuevaCantidad(parseNumInput(e.target.value))} style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={labelStyle}>Imagen del Producto</label>
                  <input type="file" accept="image/*" onChange={handleSubirImagen} style={{ color: theme.textMuted, fontSize: "0.8rem" }} />
                  {subiendoImagen && <span style={{ color: theme.gold, fontSize: "0.75rem", display: "block" }}>Subiendo imagen...</span>}
                  {nuevaImagenUrl && <img src={nuevaImagenUrl} alt="Vista previa" style={{ width: "40px", height: "40px", marginTop: "5px", objectFit: "contain", borderRadius: "3px" }} />}
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <Button variant="gold" onClick={guardarNuevoProducto}>REGISTRAR PRODUCTO</Button>
                <Button variant="outline-gold" onClick={() => setSubModulo("buscador")}>CANCELAR</Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {subModulo === "editar" && productoSeleccionado && (
        <Card style={{ maxWidth: "700px" }}>
          <h2 style={{ fontSize: "1.1rem", marginBottom: "20px", color: theme.textLight }}>
            Editando SKU: <span style={{ color: theme.gold }}>{productoSeleccionado.SKU}</span>
          </h2>
          <div style={{ marginBottom: "15px" }}>
            <label style={labelStyle}>Descripción</label>
            <input type="text" value={editDescripcion} onChange={(e) => setEditDescripcion(e.target.value)} style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
          </div>
          <div style={{ marginBottom: "15px" }}>
            <label style={labelStyle}>Especificaciones</label>
            <textarea value={editEspecificaciones} onChange={(e) => setEditEspecificaciones(e.target.value)} style={{ ...inputStyle, width: "100%", boxSizing: "border-box", height: "60px", resize: "vertical" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
            <div>
              <label style={labelStyle}>Precio A (ISP)</label>
              <input type="number" step="0.01" value={editPrecioA} onChange={(e) => setEditPrecioA(parseNumInput(e.target.value))} style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={labelStyle}>Precio B (Mayorista)</label>
              <input type="number" step="0.01" value={editPrecioB} onChange={(e) => setEditPrecioB(parseNumInput(e.target.value))} style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={labelStyle}>Precio C (Integrador)</label>
              <input type="number" step="0.01" value={editPrecioC} onChange={(e) => setEditPrecioC(parseNumInput(e.target.value))} style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={labelStyle}>Precio D (Cliente Final)</label>
              <input type="number" step="0.01" value={editPrecioD} onChange={(e) => setEditPrecioD(parseNumInput(e.target.value))} style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
            </div>
          </div>
          <div style={{ marginBottom: "15px" }}>
            <label style={labelStyle}>Stock / Cantidad</label>
            <input type="number" value={editCantidad} onChange={(e) => setEditCantidad(parseNumInput(e.target.value))} style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
          </div>
          <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
            <Button variant="gold" onClick={guardarCambiosInteligente}>GUARDAR CAMBIOS</Button>
            <Button variant="outline-gold" onClick={() => setSubModulo("buscador")}>CANCELAR</Button>
          </div>
        </Card>
      )}

      {subModulo === "eliminar" && productoSeleccionado && (
        <Card style={{ maxWidth: "500px", border: `1px solid ${theme.red}` }}>
          <h2 style={{ fontSize: "1rem", color: theme.red, marginBottom: "15px" }}>⚠️ ELIMINAR PRODUCTO DE BODEGA</h2>
          <p style={{ color: theme.textLight, fontSize: "0.85rem", marginBottom: "20px" }}>
            Estás a punto de borrar el SKU: <b style={{ color: theme.gold }}>{productoSeleccionado.SKU}</b>
          </p>
          {pasoEliminar === 1 ? (
            <div style={{ display: "flex", gap: "10px" }}>
              <Button
                variant="outline-red"
                style={{ background: theme.red, color: "#fff", border: `1px solid ${theme.red}` }}
                onClick={() => confirmarEliminacion('S')}
              >
                SÍ, ELIMINAR
              </Button>
              <Button variant="outline-gold" onClick={() => confirmarEliminacion('N')}>CANCELAR</Button>
            </div>
          ) : (
            <div>
              <p style={{ color: theme.red, fontWeight: "bold", fontSize: "0.85rem", marginBottom: "15px" }}>¿Seguro? Esta acción es irreversible.</p>
              <div style={{ display: "flex", gap: "10px" }}>
                <Button
                  variant="outline-red"
                  style={{ background: theme.red, color: "#fff", border: `1px solid ${theme.red}` }}
                  onClick={() => confirmarEliminacion('S')}
                >
                  CONFIRMAR ELIMINACIÓN
                </Button>
                <Button variant="outline-gold" onClick={() => confirmarEliminacion('N')}>REGRESAR</Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: "0.75rem", color: theme.gold, display: "block", marginBottom: "4px", textTransform: "uppercase" };
const thStyle: React.CSSProperties = { padding: "10px", fontSize: "0.75rem", textTransform: "uppercase" };
const tdStyle: React.CSSProperties = { padding: "10px" };