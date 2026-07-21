import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Admin() {
  const [seccion, setSeccion] = useState<string>("VALIDAR");
  const [db, setDb] = useState<string>(""); 
  const [accion, setAccion] = useState<string>(""); 
  const [skuTarget, setSkuTarget] = useState<string>(""); 
  const [listaPreciosFiltro, setListaPreciosFiltro] = useState<string>("precio_a");
  const [formData, setFormData] = useState({
    SKU: "",
    Item: "" as any,
    Familia: "",
    Descripción: "",
    Especificaciones: "",
    precio_a: "" as any,
    precio_b: "" as any,
    precio_c: "" as any,
    precio_d: "" as any,
    estado_inventario: "disponible"
  });
  const [dataList, setDataList] = useState<any[]>([]);
  const [paso, setPaso] = useState<number>(0); 

  useEffect(() => { 
    if (seccion === "PRODUCTOS" && !db) return;
    cargarDatos(seccion); 
  }, [seccion, db]);

  const cargarDatos = async (seccionActual: string) => {
    if (!supabase) return;
    setDataList([]);
    let query;
    if (seccionActual === "COTIZACIONES") {
      query = supabase.from("quotes").select("*").order("created_at", { ascending: false });
    } else if (seccionActual === "VALIDAR") {
      query = supabase.from("solicitudes_acceso").select("*");
    } else if (seccionActual === "PRODUCTOS") {
      if (db) {
        query = supabase.from(db).select("*");
      }
    }

    if (query) {
      const { data, error } = await query;
      if (error) console.error("Error al cargar datos:", error);
      else setDataList(data || []);
    }
  };

  const procesarSolicitud = async (id: string, tipo: 'ACTIVAR' | 'RECHAZAR', emailCliente: string, razonSocialParam: string) => {
    if (!supabase) return;

    if (tipo === 'ACTIVAR') {
      const passwordToken = "trulink_" + Math.random().toString(36).substring(2) + Date.now().toString(36);
      
      const { error: updateError } = await supabase
        .from("solicitudes_acceso")
        .update({ status: 'active', password_token: passwordToken })
        .eq('id', id);

      if (updateError) {
        alert("Error al activar en base de datos: " + updateError.message);
        return;
      }

      try {
        const response = await fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipo: "ACTIVACION",
            email: emailCliente,
            razon_social: razonSocialParam,
            link: `${window.location.origin}/auth/crear-password?token=${passwordToken}`
          })
        });
        if (!response.ok) throw new Error("Fallo al enviar correo de activación");
        alert(`Solicitud activada con éxito. Correo enviado a ${emailCliente}`);
      } catch (err: any) {
        alert("Solicitud activada en BD, pero hubo un error enviando el correo: " + err.message);
      }

    } else {
      try {
        const response = await fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipo: "RECHAZO",
            email: emailCliente,
            razon_social: razonSocialParam
          })
        });
        if (!response.ok) throw new Error("Fallo al enviar correo de rechazo");
      } catch (err: any) {
        console.error("Error enviando correo de rechazo:", err);
      }

      const { error: deleteError } = await supabase
        .from("solicitudes_acceso")
        .update({ status: 'rejected' })
        .eq('id', id);

      if (deleteError) {
        await supabase.from("solicitudes_acceso").delete().eq('id', id);
      }

      alert(`La solicitud de ${razonSocialParam} ha sido rechazada y se ha notificado al solicitante.`);
    }

    cargarDatos(seccion);
  };

  const prepararFormularioCrear = async () => {
    if (!supabase || !db) {
      alert("Por favor selecciona una base de datos primero.");
      return;
    }
    
    const { data, error } = await supabase
      .from(db)
      .select("Item")
      .order("Item", { ascending: false })
      .limit(1);

    if (error) {
      console.error("Error consultando último Item en", db, error);
    }

    let siguienteItem = 1;
    if (!error && data && data.length > 0) {
      const ultimoItem = Number(data[0].Item);
      if (!isNaN(ultimoItem)) {
        siguienteItem = ultimoItem + 1;
      }
    }

    setFormData({
      SKU: "",
      Item: siguienteItem,
      Familia: "",
      Descripción: "",
      Especificaciones: "",
      precio_a: "",
      precio_b: "",
      precio_c: "",
      precio_d: "",
      estado_inventario: "disponible"
    });
    setAccion("CREAR");
    setPaso(1);
  };

  const buscarSkuParaEditar = async () => {
    if (!supabase || !db || !skuTarget) return;
    const { data, error } = await supabase.from(db).select("*").ilike("SKU", skuTarget.trim());
    if (error || !data || data.length === 0) {
      alert("No se encontró ningún registro con ese SKU.");
    } else {
      const reg = data[0];
      setFormData({
        SKU: reg.SKU || "",
        Item: reg.Item ?? "",
        Familia: reg.Familia || "",
        Descripción: reg.Descripción || "",
        Especificaciones: reg.Especificaciones || "",
        precio_a: reg.precio_a ?? "",
        precio_b: reg.precio_b ?? "",
        precio_c: reg.precio_c ?? "",
        precio_d: reg.precio_d ?? "",
        estado_inventario: reg.estado_inventario || "disponible"
      });
      setPaso(3); 
    }
  };

  const ejecutarAccion = async () => {
    if (!supabase || !db) return;
    let query;

    const dataToSubmit = {
      ...formData,
      Item: formData.Item === "" ? 0 : Number(formData.Item) || 0,
      precio_a: formData.precio_a === "" ? 0 : parseFloat(formData.precio_a) || 0,
      precio_b: formData.precio_b === "" ? 0 : parseFloat(formData.precio_b) || 0,
      precio_c: formData.precio_c === "" ? 0 : parseFloat(formData.precio_c) || 0,
      precio_d: formData.precio_d === "" ? 0 : parseFloat(formData.precio_d) || 0,
    };

    if (accion === "CREAR") {
      query = supabase.from(db).insert([dataToSubmit]);
    } else if (accion === "EDITAR") {
      query = supabase.from(db).update(dataToSubmit).eq("SKU", skuTarget);
    } else if (accion === "ELIMINAR") {
      query = supabase.from(db).delete().eq("SKU", skuTarget);
    } else if (accion === "INACTIVAR") {
      query = supabase.from(db).update({ estado_inventario: 'inactivo' }).eq("SKU", skuTarget);
    }
    
    const { error } = await (query as any);
    if (error) {
      alert("Error RLS: " + error.message);
    } else { 
      alert("Operación exitosa"); 
      setAccion(""); 
      setPaso(0); 
      setFormData({
        SKU: "", 
        Item: "", 
        Familia: "", 
        Descripción: "", 
        Especificaciones: "", 
        precio_a: "", 
        precio_b: "", 
        precio_c: "", 
        precio_d: "", 
        estado_inventario: "disponible"
      }); 
      setSkuTarget("");
      cargarDatos(seccion); 
    }
  };

  const imprimirPrecios = async () => {
    if (!supabase || !db) return;
    
    const { data, error } = await supabase.from(db).select("*");
    if (error) {
      alert("Error al cargar datos para imprimir: " + error.message);
      return;
    }
    const listaParaImprimir = data || [];

    const ventanaImpresion = window.open("", "_blank");
    if (!ventanaImpresion) {
      alert("Por favor, permite las ventanas emergentes (pop-ups) para imprimir el listado.");
      return;
    }

    const fechaHoraActual = new Date().toLocaleString();
    const nombreListaMap: Record<string, string> = {
      precio_a: "Lista A - ISP",
      precio_b: "Lista B - Mayorista",
      precio_c: "Lista C - Integrador",
      precio_d: "Lista D - Cliente Final"
    };

    const tituloBase = db.toUpperCase();

    const contenidoHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Listado de Precios - Trulink Fiber LLC</title>
          <style>
            body { background: #fff; color: #000; font-family: sans-serif; padding: 20px; }
            .header-container { text-align: center; margin-bottom: 20px; }
            .logo { max-width: 150px; height: auto; margin-bottom: 10px; }
            h2 { margin: 5px 0; color: #333; font-size: 18px; }
            .meta-info { font-size: 12px; color: #555; margin-bottom: 15px; text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; font-size: 11px; }
            th { background: #DAA520; color: #fff; text-align: center; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            tr:nth-child(odd) { background-color: #DAA52015; }
          </style>
        </head>
        <body>
          <div class="header-container">
            <img src="/images/logo.png" alt="Trulink Fiber Logo" class="logo" />
            <h2>Trulink Fiber LLC - Listado de Precios</h2>
            <div class="meta-info">
              Base: ${tituloBase} | <strong>${nombreListaMap[listaPreciosFiltro] || listaPreciosFiltro}</strong><br/>
              Fecha y Hora de Creación: ${fechaHoraActual}
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Item</th>
                <th>Familia</th>
                <th>Descripción</th>
                <th>Especificaciones</th>
                <th>Precio (${nombreListaMap[listaPreciosFiltro] || listaPreciosFiltro})</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              ${listaParaImprimir.map(item => `
                <tr>
                  <td>${item.SKU || "-"}</td>
                  <td>${item.Item || "-"}</td>
                  <td>${item.Familia || "-"}</td>
                  <td>${item.Descripción || "-"}</td>
                  <td>${item.Especificaciones || "-"}</td>
                  <td>$${Number(item[listaPreciosFiltro] || 0).toFixed(2)}</td>
                  <td>${item.estado_inventario || "disponible"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 300);
            };
          </script>
        </body>
      </html>
    `;

    ventanaImpresion.document.open();
    ventanaImpresion.document.write(contenidoHtml);
    ventanaImpresion.document.close();
  };

  const renderInputs = () => (
    <div style={{ display: "grid", gap: "10px", marginTop: "15px" }}>
      <input placeholder="SKU" onChange={(e) => setFormData({...formData, SKU: e.target.value})} style={inputEstilo} value={formData.SKU}/>
      <input type="number" placeholder="Item" onChange={(e) => setFormData({...formData, Item: e.target.value})} style={inputEstilo} value={formData.Item}/>
      <input placeholder="Familia" onChange={(e) => setFormData({...formData, Familia: e.target.value})} style={inputEstilo} value={formData.Familia}/>
      <input placeholder="Descripción" onChange={(e) => setFormData({...formData, Descripción: e.target.value})} style={inputEstilo} value={formData.Descripción}/>
      <input placeholder="Especificaciones" onChange={(e) => setFormData({...formData, Especificaciones: e.target.value})} style={inputEstilo} value={formData.Especificaciones}/>
      <input type="number" placeholder="Precio A" onChange={(e) => setFormData({...formData, precio_a: e.target.value})} style={inputEstilo} value={formData.precio_a}/>
      <input type="number" placeholder="Precio B" onChange={(e) => setFormData({...formData, precio_b: e.target.value})} style={inputEstilo} value={formData.precio_b}/>
      <input type="number" placeholder="Precio C" onChange={(e) => setFormData({...formData, precio_c: e.target.value})} style={inputEstilo} value={formData.precio_c}/>
      <input type="number" placeholder="Precio D" onChange={(e) => setFormData({...formData, precio_d: e.target.value})} style={inputEstilo} value={formData.precio_d}/>
      <input placeholder="Estado Inventario" onChange={(e) => setFormData({...formData, estado_inventario: e.target.value})} style={inputEstilo} value={formData.estado_inventario}/>
    </div>
  );

  return (
    <div style={{ backgroundColor: "#000", minHeight: "100vh", display: "flex", color: "#DAA520", fontFamily: "sans-serif" }}>
      <div style={{ width: "280px", borderRight: "2px solid #DAA520", padding: "20px" }}>
        <h2 style={{ textAlign: "center", marginBottom: "30px" }}>ADMIN PANEL</h2>
        <button onClick={() => {setSeccion("VALIDAR"); setPaso(0); setAccion(""); setDb("");}} style={btnNav}>VALIDAR INSCRIPCIONES</button>
        <button onClick={() => {setSeccion("COTIZACIONES"); setPaso(0); setAccion(""); setDb("");}} style={btnNav}>COTIZACIONES GENERADAS</button>
        <button onClick={() => {setSeccion("PRODUCTOS"); setPaso(0); setAccion(""); setDb(""); setDataList([]);}} style={btnNav}>PRODUCTOS</button>
      </div>

      <div style={{ flex: 1, padding: "40px" }}>
        {seccion === "VALIDAR" && dataList.map((item: any) => {
          let docUrl = item.documentos_url || item.url || "";
          if (!docUrl && supabase) {
            const { data: publicData } = supabase.storage.from("documentos").getPublicUrl(`${item.id}_documento`);
            docUrl = publicData?.publicUrl || "#";
          }

          return (
            <div key={item.id} style={{ borderBottom: "1px solid #333", padding: "20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ fontWeight: "bold" }}>RAZON SOCIAL: <span style={{color: "#DAA520"}}>{item.razon_social}</span> | EMAIL: <span style={{color: "#DAA520"}}>{item.email}</span></div>
                <a href={docUrl} target="_blank" rel="noreferrer" style={{...btnAccion, background: "blue", color: "#fff", width: "fit-content", textAlign: "center", textDecoration: "none"}}>VER DOCUMENTOS</a>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={() => procesarSolicitud(item.id, 'ACTIVAR', item.email, item.razon_social)} style={{...btnAccion, background: "green", color: "#000"}}>ACTIVAR</button>
                <button onClick={() => procesarSolicitud(item.id, 'RECHAZAR', item.email, item.razon_social)} style={{...btnAccion, background: "red", color: "#000"}}>RECHAZAR</button>
              </div>
            </div>
          );
        })}

        {seccion === "COTIZACIONES" && dataList.map((item: any) => {
          const esProd = item.type === 'producto';
          const refCot = item.referencia || item.reference || `QT-${item.id}`;
          
          let pdfUrl = item.pdf_url;
          if (!pdfUrl && supabase) {
            const { data: publicData } = supabase.storage.from("documentos").getPublicUrl(`${refCot}.pdf`);
            pdfUrl = publicData?.publicUrl || "";
          }

          return (
            <div key={item.id} style={{ border: "1px solid #DAA520", padding: "20px", marginBottom: "20px", borderRadius: "10px" }}>
              <p>
                <strong>REF:</strong> <span style={{ color: "#DAA520" }}>{refCot}</span> | 
                <strong> FECHA:</strong> {item.created_at ? new Date(item.created_at).toLocaleString() : "N/A"} | 
                <strong> EMAIL:</strong> {item.user_email || item.email || item.client_email || "N/A"} | 
                <strong> TELÉFONO:</strong> {item.user_telefono || item.telefono || item.client_phone || "N/A"}
              </p>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "10px 0" }}>
                <p style={{ margin: 0 }}><strong>TOTAL:</strong> ${typeof item.total === 'number' ? item.total.toFixed(2) : (Number(item.total) || 0).toFixed(2)}</p>
                {pdfUrl ? (
                  <a href={pdfUrl} target="_blank" rel="noreferrer" style={{...btnAccion, background: "#DAA520", color: "#000", padding: "6px 15px", fontSize: "0.85rem", textDecoration: "none"}}>
                    VER PDF COTIZACIÓN
                  </a>
                ) : (
                  <span style={{ fontSize: "0.85rem", color: "#888", fontStyle: "italic" }}>PDF no disponible</span>
                )}
              </div>
              <table style={{ width: "100%", color: "#fff", borderCollapse: "collapse", marginTop: "10px", fontSize: "0.9rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #DAA520" }}>
                    {esProd && <th style={{ padding: "8px" }}>SKU</th>}
                    <th style={{ padding: "8px" }}>{esProd ? "Descripción" : "Prod"}</th>
                    {!esProd && <th style={{ padding: "8px" }}>Km</th>}
                    {!esProd && <th style={{ padding: "8px" }}>Hilos</th>}
                    <th style={{ padding: "8px" }}>Cant</th>
                    <th style={{ padding: "8px" }}>P. Unitario</th>
                    <th style={{ padding: "8px" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {item.items?.map((it: any, i: number) => {
                    const skuVal = it.SKU || it.sku || "-";
                    const descVal = it.descripcion || it.nombre || it.tipo || it.product || "Artículo";
                    const kmVal = it.longitudKm ?? it.km ?? "-";
                    const hilosVal = it.hilos !== undefined ? it.hilos : "-";
                    const cantVal = it.cantidad ?? 1;
                    const unitPrice = Number(it.precioUnitario ?? it.precioCarrete ?? it.precioMetro ?? 0);
                    const lineTotal = it.total ?? (unitPrice * cantVal);

                    return (
                      <tr key={i} style={{ textAlign: "center", borderBottom: "1px solid #222" }}>
                        {esProd && <td style={{ padding: "8px" }}>{skuVal}</td>}
                        <td style={{ padding: "8px" }}>{descVal}</td>
                        {!esProd && <td style={{ padding: "8px" }}>{kmVal}</td>}
                        {!esProd && <td style={{ padding: "8px" }}>{hilosVal}</td>}
                        <td style={{ padding: "8px" }}>{cantVal}</td>
                        <td style={{ padding: "8px" }}>${unitPrice.toFixed(2)}</td>
                        <td style={{ padding: "8px" }}>${Number(lineTotal).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}

        {seccion === "PRODUCTOS" && (
          <>
            <div style={{ border: "1px solid #DAA520", padding: "20px", marginBottom: "20px" }}>
              {paso > 0 && (
                <button onClick={() => { setPaso(0); setAccion(""); setSkuTarget(""); }} style={{...btnAccion, background: "#333", color: "#DAA520", border: "1px solid #DAA520", marginBottom: "15px"}}>
                  ← VOLVER
                </button>
              )}
              {paso === 0 && (
                <>
                  <div style={{ marginBottom: "15px" }}>
                    <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Selecciona la base de datos a trabajar:</label>
                    <select onChange={(e) => setDb(e.target.value)} style={selectEstilo} value={db}>
                      <option value="">-- Selecciona una base de datos --</option>
                      <option value="cablesdb">Cables DB</option>
                      <option value="herrajesdb">Herrajes DB</option>
                      <option value="accesoriosdb">Accesorios DB</option>
                    </select>
                  </div>
                  {db && (
                    <>
                      <button onClick={prepararFormularioCrear} style={{...btnAccion, background: "green", color: "#fff"}}>CREAR</button>
                      <button onClick={() => {setAccion("EDITAR"); setPaso(2); setSkuTarget("");}} style={{...btnAccion, background: "#DAA520", color: "#000"}}>EDITAR</button>
                      <button onClick={() => {setAccion("ELIMINAR"); setPaso(2); setSkuTarget("");}} style={{...btnAccion, background: "red", color: "#fff"}}>ELIMINAR</button>
                      <button onClick={() => {
                        const seleccionLista = prompt("Seleccionar Lista de Precios:\n1. precio_a (Lista A - ISP)\n2. precio_b (Lista B - Mayorista)\n3. precio_c (Lista C - Integrador)\n4. precio_d (Lista D - Cliente Final)\n\nEscribe precio_a, precio_b, precio_c o precio_d:", "precio_a");
                        if (seleccionLista && ["precio_a", "precio_b", "precio_c", "precio_d"].includes(seleccionLista)) {
                          setListaPreciosFiltro(seleccionLista);
                        }
                        imprimirPrecios();
                      }} style={{...btnAccion, background: "#fff", color: "#000"}}>IMPRIMIR PRECIOS</button>
                    </>
                  )}
                </>
              )}
              {paso === 1 && (
                <>
                  <div style={{ marginBottom: "10px", fontSize: "0.9rem", color: "#DAA520" }}>Base de datos activa: <strong>{db}</strong></div>
                  {renderInputs()}
                  <div style={{ marginTop: "15px" }}>
                    <button onClick={ejecutarAccion} style={{...btnAccion, background: "green", color: "#fff"}}>GUARDAR</button>
                    <button onClick={() => {setPaso(0); setAccion("");}} style={{...btnAccion, background: "gray", color: "#fff"}}>CANCELAR</button>
                  </div>
                </>
              )}
              {paso === 2 && (
                <>
                  <div style={{ marginBottom: "10px", fontSize: "0.9rem", color: "#DAA520" }}>Base de datos activa: <strong>{db}</strong></div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <input 
                      placeholder="Ingresa el SKU a procesar y presiona Enter o Buscar" 
                      onChange={(e) => setSkuTarget(e.target.value)} 
                      onKeyDown={(e) => { if (e.key === 'Enter') { buscarSkuParaEditar(); } }}
                      style={inputEstilo} 
                      value={skuTarget} 
                    />
                    <button onClick={buscarSkuParaEditar} style={{...btnAccion, background: "#DAA520", color: "#000", height: "42px"}}>BUSCAR SKU</button>
                  </div>
                  <div style={{ marginTop: "15px" }}>
                    <button onClick={() => {setPaso(0); setAccion(""); setSkuTarget("");}} style={{...btnAccion, background: "gray", color: "#fff"}}>CANCELAR</button>
                  </div>
                </>
              )}
              {paso === 3 && (
                <>
                  <div style={{ marginBottom: "10px", fontSize: "0.9rem", color: "#DAA520" }}>Base de datos activa: <strong>{db}</strong> (Editando SKU: <strong>{skuTarget}</strong>)</div>
                  {renderInputs()}
                  <div style={{ marginTop: "15px" }}>
                    <button onClick={ejecutarAccion} style={{...btnAccion, background: "green", color: "#fff"}}>GUARDAR CAMBIOS</button>
                    <button onClick={() => {setPaso(0); setAccion(""); setSkuTarget("");}} style={{...btnAccion, background: "gray", color: "#fff"}}>CANCELAR</button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const btnNav = { padding: "15px", borderRadius: "30px", border: "1px solid #DAA520", background: "transparent", color: "#DAA520", width: "100%", marginBottom: "10px", cursor: "pointer", fontWeight: "bold", textAlign: "left" as const };
const btnAccion = { padding: "10px 20px", cursor: "pointer", border: "none", borderRadius: "5px", fontWeight: "bold", marginRight: "10px", display: "inline-block", textDecoration: "none" };
const selectEstilo = { background: "#000", color: "#DAA520", padding: "10px", border: "1px solid #DAA520", width: "100%", marginBottom: "10px" };
const inputEstilo = { background: "#000", color: "#DAA520", padding: "10px", border: "1px solid #DAA520", width: "100%", marginBottom: "10px" };