import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import Sidebar from "./Sidebar";

export default function AdminInventario() {
  const [subModulo, setSubModulo] = useState<"buscador" | "lista" | "crear" | "editar" | "eliminar">("buscador");
  const [tablaActiva, setTablaActiva] = useState<"cablesdb" | "herrajesdb" | "accesoriosdb">("cablesdb");
  
  const [skuInput, setSkuInput] = useState("");
  const [familiaSeleccionada, setFamiliaSeleccionada] = useState("");
  const [familiasDisponibles, setFamiliasDisponibles] = useState<string[]>([]);
  const [productoSeleccionado, setProductoSeleccionado] = useState<any>(null);
  const [listaResultados, setListaResultados] = useState<any[]>([]);
  const [todosItems, setTodosItems] = useState<any[]>([]);

  // Estados para Creación de Producto
  const [tablaCreacion, setTablaCreacion] = useState<"cablesdb" | "herrajesdb" | "accesoriosdb">("cablesdb");
  const [familiasCreacion, setFamiliasCreacion] = useState<string[]>([]);
  const [nuevaFamiliaSeleccionada, setNuevaFamiliaSeleccionada] = useState("");
  const [nombreNuevaFamilia, setNombreNuevaFamilia] = useState("");
  const [nuevoSku, setNuevoSku] = useState("");
  const [nuevaDescripcion, setNuevaDescripcion] = useState("");
  const [nuevasEspecificaciones, setNuevasEspecificaciones] = useState("");
  const [nuevaImagenUrl, setNuevaImagenUrl] = useState("");
  const [subiendoImagen, setSubiendoImagen] = useState(false);

  // Estados para Edición de los 4 Precios Comerciales y Stock
  const [editDescripcion, setEditDescripcion] = useState("");
  const [editEspecificaciones, setEditEspecificaciones] = useState("");
  const [editImagenUrl, setEditImagenUrl] = useState("");
  const [editPrecioA, setEditPrecioA] = useState<number | string>("");
  const [editPrecioB, setEditPrecioB] = useState<number | string>("");
  const [editPrecioC, setEditPrecioC] = useState<number | string>("");
  const [editPrecioD, setEditPrecioD] = useState<number | string>("");
  const [editCantidad, setEditCantidad] = useState<number | "">("");

  // Estados para Eliminación
  const [pasoEliminar, setPasoEliminar] = useState<1 | 2>(1);

  useEffect(() => {
    cargarBaseDatos(tablaActiva);
  }, [tablaActiva]);

  useEffect(() => {
    cargarFamiliasCreacion(tablaCreacion);
  }, [tablaCreacion]);

  const cargarBaseDatos = async (tabla: string) => {
    if (!supabase) return;
    const { data, error } = await supabase.from(tabla).select("*").order("SKU", { ascending: true });
    if (!error && data) {
      setTodosItems(data);
      
      const familiasSet = new Set<string>();
      data.forEach((item: any) => {
        const fam = item.Familia || item.familia;
        if (fam && typeof fam === "string" && fam.trim() !== "") {
          familiasSet.add(fam.trim());
        }
      });
      const listaFamilias = Array.from(familiasSet).sort();
      setFamiliasDisponibles(listaFamilias);
      setFamiliaSeleccionada(listaFamilias.length > 0 ? listaFamilias[0] : "TODAS");
    } else {
      console.error("Error al cargar base de datos:", error?.message);
    }
  };

  const cargarFamiliasCreacion = async (tabla: string) => {
    if (!supabase) return;
    const { data, error } = await supabase.from(tabla).select("Familia, familia");
    if (!error && data) {
      const familiasSet = new Set<string>();
      data.forEach((item: any) => {
        const fam = item.Familia || item.familia;
        if (fam && typeof fam === "string" && fam.trim() !== "") {
          familiasSet.add(fam.trim());
        }
      });
      const lista = Array.from(familiasSet).sort();
      setFamiliasCreacion(lista);
      setNuevaFamiliaSeleccionada(lista.length > 0 ? lista[0] : "CREAR_NUEVA");
      setNombreNuevaFamilia("");
    }
  };

  const manejarSubidaImagen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !supabase) return;

    setSubiendoImagen(true);
    const nombreBucket = tablaCreacion.replace("db", "");
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(nombreBucket)
      .upload(filePath, file);

    if (uploadError) {
      alert("Error al subir la imagen al bucket: " + uploadError.message);
      setSubiendoImagen(false);
      return;
    }

    const { data } = supabase.storage.from(nombreBucket).getPublicUrl(filePath);
    if (data?.publicUrl) {
      setNuevaImagenUrl(data.publicUrl);
    }
    setSubiendoImagen(false);
  };

  const buscarPorSku = async () => {
    if (!skuInput.trim() || !supabase) return;
    
    const skuBuscado = skuInput.trim();
    const { data, error } = await supabase
      .from(tablaActiva)
      .select("*")
      .ilike("SKU", skuBuscado);

    if (!error && data && data.length > 0) {
      const encontrado = data[0];
      setProductoSeleccionado(encontrado);
      inicializarEdicion(encontrado);
      setSubModulo("editar");
    } else {
      const encontradoLocal = todosItems.find(
        (item) => item.SKU?.toString().toLowerCase() === skuBuscado.toLowerCase()
      );
      if (encontradoLocal) {
        setProductoSeleccionado(encontradoLocal);
        inicializarEdicion(encontradoLocal);
        setSubModulo("editar");
      } else {
        alert("No se encontró ningún producto con ese SKU en la base de datos activa.");
      }
    }
  };

  const filtrarPorFamiliaAction = () => {
    if (!familiaSeleccionada || familiaSeleccionada === "TODAS") {
      setListaResultados(todosItems);
    } else {
      const filtrados = todosItems.filter(
        (item) => 
          (item.Familia && item.Familia.trim() === familiaSeleccionada) ||
          (item.familia && item.familia.trim() === familiaSeleccionada)
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
    setEditDescripcion(item.Descripción || item.descripcion || "");
    setEditEspecificaciones(item.Especificaciones || item.especificaciones || "");
    setEditImagenUrl(item.image_url || item.Image_url || "");
    
    const formatPrecio = (val: any) => (val !== null && val !== undefined && val !== "" ? Number(val).toFixed(2) : "");
    setEditPrecioA(formatPrecio(item.precio_a ?? item.Precio_A));
    setEditPrecioB(formatPrecio(item.precio_b ?? item.Precio_B));
    setEditPrecioC(formatPrecio(item.precio_c ?? item.Precio_C));
    setEditPrecioD(formatPrecio(item.precio_d ?? item.Precio_D));
    
    setEditCantidad(item.cantidad ?? item.Cantidad ?? item.Stock ?? item.stock ?? "");
  };

  // Guardado Inteligente: detecta cambios campo por campo
  const guardarCambiosInteligente = async () => {
    if (!supabase || !productoSeleccionado) return;

    const skuKey = productoSeleccionado.SKU !== undefined ? "SKU" : "sku";
    const skuValue = productoSeleccionado[skuKey];

    const datosModificados: any = {};

    const descOriginal = productoSeleccionado.Descripción || productoSeleccionado.descripcion || "";
    if (editDescripcion !== descOriginal) {
      datosModificados.Descripción = editDescripcion;
    }

    const specOriginal = productoSeleccionado.Especificaciones || productoSeleccionado.especificaciones || "";
    if (editEspecificaciones !== specOriginal) {
      datosModificados.Especificaciones = editEspecificaciones;
    }

    const imgOriginal = productoSeleccionado.image_url || productoSeleccionado.Image_url || "";
    if (editImagenUrl !== imgOriginal) {
      if (productoSeleccionado.image_url !== undefined) {
        datosModificados.image_url = editImagenUrl;
      } else {
        datosModificados.Image_url = editImagenUrl;
      }
    }

    const paOriginal = productoSeleccionado.precio_a ?? productoSeleccionado.Precio_A ?? "";
    const paFinal = editPrecioA === "" ? null : Number(editPrecioA);
    if (paFinal !== (paOriginal === "" ? null : Number(paOriginal))) {
      datosModificados.precio_a = paFinal;
    }

    const pbOriginal = productoSeleccionado.precio_b ?? productoSeleccionado.Precio_B ?? "";
    const pbFinal = editPrecioB === "" ? null : Number(editPrecioB);
    if (pbFinal !== (pbOriginal === "" ? null : Number(pbOriginal))) {
      datosModificados.precio_b = pbFinal;
    }

    const pcOriginal = productoSeleccionado.precio_c ?? productoSeleccionado.Precio_C ?? "";
    const pcFinal = editPrecioC === "" ? null : Number(editPrecioC);
    if (pcFinal !== (pcOriginal === "" ? null : Number(pcOriginal))) {
      datosModificados.precio_c = pcFinal;
    }

    const pdOriginal = productoSeleccionado.precio_d ?? productoSeleccionado.Precio_D ?? "";
    const pdFinal = editPrecioD === "" ? null : Number(editPrecioD);
    if (pdFinal !== (pdOriginal === "" ? null : Number(pdOriginal))) {
      datosModificados.precio_d = pdFinal;
    }

    const cantOriginal = productoSeleccionado.cantidad ?? productoSeleccionado.Cantidad ?? productoSeleccionado.Stock ?? productoSeleccionado.stock ?? "";
    const cantFinal = editCantidad === "" ? 0 : Number(editCantidad);
    if (cantFinal !== (cantOriginal === "" ? 0 : Number(cantOriginal))) {
      if (productoSeleccionado.cantidad !== undefined) {
        datosModificados.cantidad = cantFinal;
      } else {
        datosModificados.Cantidad = cantFinal;
      }
    }

    if (Object.keys(datosModificados).length === 0) {
      alert("No se detectó ningún cambio para guardar.");
      return;
    }

    const { error } = await supabase
      .from(tablaActiva)
      .update(datosModificados)
      .eq(skuKey, skuValue);

    if (error) {
      alert("Error al actualizar el producto: " + error.message);
    } else {
      alert("¡Precios comerciales y cambios actualizados inteligentemente con éxito!");
      cargarBaseDatos(tablaActiva);
      setSubModulo("buscador");
    }
  };

  const guardarNuevoProducto = async () => {
    if (!supabase) return;
    if (!nuevoSku.trim() || !nuevaDescripcion.trim()) {
      alert("Por favor complete al menos el SKU y la Descripción.");
      return;
    }

    let familiaFinal = nuevaFamiliaSeleccionada;
    if (familiaFinal === "CREAR_NUEVA") {
      if (!nombreNuevaFamilia.trim()) {
        alert("Por favor ingrese el nombre de la nueva familia.");
        return;
      }
      familiaFinal = nombreNuevaFamilia.trim();
    }

    const nuevoObjeto: any = {
      SKU: nuevoSku.trim(),
      Descripción: nuevaDescripcion.trim(),
      Especificaciones: nuevasEspecificaciones.trim(),
      image_url: nuevaImagenUrl.trim(),
      precio_a: 1.00,
      precio_b: 2.00,
      precio_c: 3.00,
      precio_d: 4.00,
      cantidad: 0
    };

    if (familiaFinal) {
      nuevoObjeto.Familia = familiaFinal;
    }

    const { error } = await supabase
      .from(tablaCreacion)
      .insert([nuevoObjeto]);

    if (error) {
      alert("Error al crear el producto: " + error.message);
    } else {
      alert("¡Producto creado con éxito en " + tablaCreacion + "!");
      setNuevoSku("");
      setNuevaDescripcion("");
      setNuevasEspecificaciones("");
      setNuevaImagenUrl("");
      setNombreNuevaFamilia("");
      cargarBaseDatos(tablaActiva);
      setSubModulo("buscador");
    }
  };

  const confirmarEliminacion = async (decision: 'S' | 'N') => {
    if (decision === 'N') {
      setPasoEliminar(1);
      return;
    }

    if (pasoEliminar === 1) {
      setPasoEliminar(2);
    } else if (pasoEliminar === 2) {
      if (!supabase || !productoSeleccionado) return;

      const skuKey = productoSeleccionado.SKU !== undefined ? "SKU" : "sku";
      const skuValue = productoSeleccionado[skuKey];

      const { error } = await supabase
        .from(tablaActiva)
        .delete()
        .eq(skuKey, skuValue);

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

        <div style={{ display: "flex", gap: "10px", marginBottom: "30px", borderBottom: "1px solid #1a1a1a", paddingBottom: "15px", flexWrap: "wrap" }}>
          <button onClick={() => setSubModulo("buscador")} style={subTabBtn(subModulo === "buscador")}>1. Buscar / SKU</button>
          <button onClick={() => { setListaResultados(todosItems); setSubModulo("lista"); }} style={subTabBtn(subModulo === "lista")}>2. Ver Todos / Familia</button>
          <button 
            onClick={() => { 
              setTablaCreacion(tablaActiva);
              setSubModulo("crear"); 
            }} 
            style={subTabBtn(subModulo === "crear")}
          >
            + Crear Producto
          </button>
          {productoSeleccionado && (
            <>
              <button onClick={() => setSubModulo("editar")} style={subTabBtn(subModulo === "editar")}>3. Editar / Ajustes</button>
              <button onClick={() => { setSubModulo("eliminar"); setPasoEliminar(1); }} style={subTabBtn(subModulo === "eliminar", true)}>4. Eliminar Producto</button>
            </>
          )}
        </div>

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
              <h3 style={{ fontSize: "1rem", marginBottom: "12px", color: "#fff" }}>
                Filtrar por Familia de <span style={{ color: "#DAA520", textTransform: "uppercase" }}>{tablaActiva.replace("db", "")}</span>
              </h3>
              <div style={{ display: "flex", gap: "10px" }}>
                <select
                  value={familiaSeleccionada}
                  onChange={(e) => setFamiliaSeleccionada(e.target.value)}
                  style={inputStyle}
                >
                  {familiasDisponibles.map((fam) => (
                    <option key={fam} value={fam} style={{ backgroundColor: "#050505", color: "#DAA520" }}>
                      {fam}
                    </option>
                  ))}
                  <option value="TODAS" style={{ backgroundColor: "#050505", color: "#DAA520", fontWeight: "bold" }}>
                    Mostrar Todas
                  </option>
                </select>
                <button onClick={filtrarPorFamiliaAction} style={btnAccion}>MOSTRAR</button>
              </div>
            </div>
          </div>
        )}

        {subModulo === "lista" && (
          <div>
            <div style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ color: "#aaa", fontSize: "0.9rem" }}>
                Base de Datos: <b style={{ color: "#DAA520", textTransform: "uppercase" }}>{tablaActiva.replace("db", "")}</b> | Filtro: <b style={{ color: "#DAA520" }}>{familiaSeleccionada}</b>
              </p>
              <button onClick={() => setSubModulo("buscador")} style={btnSecundario}>← Volver al buscador</button>
            </div>
            
            <div style={{ overflowX: "auto", border: "1px solid rgba(218, 165, 32, 0.2)", borderRadius: "6px", backgroundColor: "#050505" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(218, 165, 32, 0.3)", color: "#DAA520", backgroundColor: "#0a0a0a" }}>
                    <th style={thStyle}>SKU</th>
                    <th style={thStyle}>DESCRIPCIÓN</th>
                    <th style={thStyle}>FAMILIA</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>SELECCIONAR</th>
                  </tr>
                </thead>
                <tbody>
                  {listaResultados.map((item: any, idx: number) => (
                    <tr key={item.SKU || idx} style={{ borderBottom: "1px solid #141414" }}>
                      <td style={{ ...tdStyle, color: "#DAA520", fontWeight: "600" }}>{item.SKU || item.sku || "N/A"}</td>
                      <td style={{ ...tdStyle, color: "#fff", fontWeight: "500" }}>{item.Descripción || item.descripcion || "N/A"}</td>
                      <td style={{ ...tdStyle, color: "#aaa" }}>{item.Familia || item.familia || "N/A"}</td>
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

        {subModulo === "crear" && (
          <div style={{ ...cardBox, maxWidth: "700px" }}>
            <h2 style={{ fontSize: "1.2rem", marginBottom: "20px", color: "#fff" }}>
              CREAR NUEVO PRODUCTO
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div>
                <label style={labelStyle}>Seleccionar Base de Datos de Destino</label>
                <div style={{ display: "flex", gap: "10px", marginTop: "5px" }}>
                  {(["cablesdb", "herrajesdb", "accesoriosdb"] as const).map((db) => (
                    <button
                      key={db}
                      type="button"
                      onClick={() => setTablaCreacion(db)}
                      style={{
                        flex: 1,
                        padding: "10px",
                        borderRadius: "4px",
                        border: `1px solid ${tablaCreacion === db ? "#DAA520" : "rgba(218, 165, 32, 0.3)"}`,
                        backgroundColor: tablaCreacion === db ? "#DAA520" : "#050505",
                        color: tablaCreacion === db ? "#000" : "#DAA520",
                        fontWeight: "600",
                        fontSize: "0.8rem",
                        cursor: "pointer",
                        textTransform: "uppercase"
                      }}
                    >
                      {db.replace("db", "")}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                <div>
                  <label style={labelStyle}>SKU *</label>
                  <input
                    type="text"
                    placeholder="Ej. GJPFJH-4F"
                    value={nuevoSku}
                    onChange={(e) => setNuevoSku(e.target.value)}
                    style={inputStyleFull}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Familia (Bucket: {tablaCreacion.replace("db", "")})</label>
                  <select
                    value={nuevaFamiliaSeleccionada}
                    onChange={(e) => setNuevaFamiliaSeleccionada(e.target.value)}
                    style={inputStyleFull}
                  >
                    {familiasCreacion.map((fam) => (
                      <option key={fam} value={fam} style={{ backgroundColor: "#050505", color: "#DAA520" }}>
                        {fam}
                      </option>
                    ))}
                    <option value="CREAR_NUEVA" style={{ backgroundColor: "#050505", color: "#DAA520", fontWeight: "bold" }}>
                      + Crear nueva familia...
                    </option>
                  </select>
                </div>
              </div>

              {nuevaFamiliaSeleccionada === "CREAR_NUEVA" && (
                <div style={{ padding: "15px", backgroundColor: "#050505", border: "1px dashed rgba(218, 165, 32, 0.5)", borderRadius: "4px" }}>
                  <label style={labelStyle}>Nombre de la Nueva Familia *</label>
                  <input
                    type="text"
                    placeholder="Escribe el nombre de la nueva familia..."
                    value={nombreNuevaFamilia}
                    onChange={(e) => setNombreNuevaFamilia(e.target.value)}
                    style={inputStyleFull}
                  />
                </div>
              )}

              <div>
                <label style={labelStyle}>Descripción *</label>
                <textarea
                  rows={3}
                  placeholder="Descripción detallada del producto..."
                  value={nuevaDescripcion}
                  onChange={(e) => setNuevaDescripcion(e.target.value)}
                  style={{ ...inputStyleFull, resize: "vertical" }}
                />
              </div>

              <div>
                <label style={labelStyle}>Especificaciones</label>
                <textarea
                  rows={4}
                  placeholder="Especificaciones técnicas..."
                  value={nuevasEspecificaciones}
                  onChange={(e) => setNuevasEspecificaciones(e.target.value)}
                  style={{ ...inputStyleFull, resize: "vertical" }}
                />
              </div>

              <div>
                <label style={labelStyle}>Imagen del Producto</label>
                <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={manejarSubidaImagen}
                    style={{ color: "#aaa", fontSize: "0.85rem" }}
                  />
                  {subiendoImagen && <span style={{ color: "#DAA520", fontSize: "0.85rem" }}>Subiendo imagen...</span>}
                </div>
                {nuevaImagenUrl && (
                  <div style={{ marginTop: "10px", padding: "10px", backgroundColor: "#050505", border: "1px solid rgba(218, 165, 32, 0.3)", borderRadius: "4px", display: "inline-block" }}>
                    <img 
                      src={nuevaImagenUrl} 
                      alt="Vista previa" 
                      style={{ width: "80px", height: "80px", objectFit: "contain", borderRadius: "4px", backgroundColor: "#000" }} 
                    />
                    <p style={{ fontSize: "0.7rem", color: "#888", marginTop: "4px", wordBreak: "break-all" }}>{nuevaImagenUrl}</p>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: "15px", marginTop: "30px" }}>
              <button onClick={guardarNuevoProducto} style={btnAccion}>GUARDAR NUEVO PRODUCTO</button>
              <button onClick={() => setSubModulo("buscador")} style={btnSecundario}>CANCELAR</button>
            </div>
          </div>
        )}

        {subModulo === "editar" && productoSeleccionado && (
          <div style={{ ...cardBox, maxWidth: "700px" }}>
            <h2 style={{ fontSize: "1.2rem", marginBottom: "20px", color: "#fff" }}>
              Editando Producto SKU: <span style={{ color: "#DAA520" }}>{productoSeleccionado.SKU || productoSeleccionado.sku}</span>
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              
              {/* Sección de las Listas de Precios Comerciales y Stock */}
              <div style={{ padding: "15px", backgroundColor: "#0c0c0c", border: "1px solid rgba(218, 165, 32, 0.4)", borderRadius: "4px" }}>
                <h3 style={{ fontSize: "0.95rem", color: "#DAA520", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Listas de Precios Comerciales y Stock
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "12px" }}>
                  <div>
                    <label style={labelStyle}>Precio A (ISP) — <span style={{ color: "#DAA520" }}>precio_a</span></label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={editPrecioA}
                      onChange={(e) => setEditPrecioA(e.target.value)}
                      style={inputStyleFull}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Precio B (Mayorista) — <span style={{ color: "#DAA520" }}>precio_b</span></label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={editPrecioB}
                      onChange={(e) => setEditPrecioB(e.target.value)}
                      style={inputStyleFull}
                    />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                  <div>
                    <label style={labelStyle}>Precio C (Integrador) — <span style={{ color: "#DAA520" }}>precio_c</span></label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={editPrecioC}
                      onChange={(e) => setEditPrecioC(e.target.value)}
                      style={inputStyleFull}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Precio D (Cliente Final) — <span style={{ color: "#DAA520" }}>precio_d</span></label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={editPrecioD}
                      onChange={(e) => setEditPrecioD(e.target.value)}
                      style={inputStyleFull}
                    />
                  </div>
                </div>
                <div style={{ marginTop: "15px" }}>
                  <label style={labelStyle}>Cantidad / Stock — <span style={{ color: "#DAA520" }}>cantidad</span></label>
                  <input
                    type="number"
                    placeholder="0"
                    value={editCantidad}
                    onChange={(e) => setEditCantidad(e.target.value === "" ? "" : Number(e.target.value))}
                    style={inputStyleFull}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Imagen del Producto</label>
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "20px", 
                  padding: "15px", 
                  backgroundColor: "#050505", 
                  border: "1px solid rgba(218, 165, 32, 0.3)", 
                  borderRadius: "4px" 
                }}>
                  {editImagenUrl ? (
                    <img 
                      src={editImagenUrl} 
                      alt="Producto" 
                      style={{ width: "90px", height: "90px", objectFit: "contain", borderRadius: "4px", backgroundColor: "#000", border: "1px solid #333" }} 
                    />
                  ) : (
                    <div style={{ width: "90px", height: "90px", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#111", color: "#666", fontSize: "0.75rem", borderRadius: "4px" }}>
                      Sin Imagen
                    </div>
                  )}
                  <div>
                    <p style={{ fontSize: "0.85rem", color: "#fff", marginBottom: "5px" }}>Enlace actual de la imagen.</p>
                    <input
                      type="text"
                      value={editImagenUrl}
                      onChange={(e) => setEditImagenUrl(e.target.value)}
                      style={inputStyleFull}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Descripción</label>
                <textarea rows={3} value={editDescripcion} onChange={(e) => setEditDescripcion(e.target.value)} style={{ ...inputStyleFull, resize: "vertical" }} />
              </div>

              <div>
                <label style={labelStyle}>Especificaciones</label>
                <textarea rows={4} value={editEspecificaciones} onChange={(e) => setEditEspecificaciones(e.target.value)} style={{ ...inputStyleFull, resize: "vertical" }} />
              </div>
            </div>

            <div style={{ display: "flex", gap: "15px", marginTop: "25px" }}>
              <button onClick={guardarCambiosInteligente} style={btnAccion}>GUARDAR CAMBIOS</button>
              <button onClick={() => setSubModulo("buscador")} style={btnSecundario}>CANCELAR</button>
            </div>
          </div>
        )}

        {subModulo === "eliminar" && productoSeleccionado && (
          <div style={{ ...cardBox, maxWidth: "500px", textAlign: "center", padding: "40px" }}>
            <h2 style={{ fontSize: "1.3rem", marginBottom: "15px", color: "#e74c3c" }}>ELIMINAR PRODUCTO</h2>
            
            {pasoEliminar === 1 ? (
              <>
                <p style={{ fontSize: "1rem", marginBottom: "25px", color: "#fff" }}>
                  ¿Desea eliminar el producto SKU <b>{productoSeleccionado.SKU || productoSeleccionado.sku}</b>?
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

// Estilos
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