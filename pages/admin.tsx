import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Admin() {
  const [seccion, setSeccion] = useState<string>("VALIDAR");
  const [db, setDb] = useState<string>(""); 
  const [accion, setAccion] = useState<string>(""); 
  const [skuTarget, setSkuTarget] = useState<string>(""); 
  const [formData, setFormData] = useState({
    SKU: "",
    Item: "",
    Familia: "",
    Descripción: "",
    Especificaciones: "",
    precio: 0,
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
    if (seccionActual === "COTIZACIONES") query = supabase.from("quotes").select("*").order("created_at", { ascending: false });
    else if (seccionActual === "VALIDAR") query = supabase.from("solicitudes_acceso").select("*");
    else if (seccionActual === "PRODUCTOS" && db) query = supabase.from(db).select("*");

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

  const ejecutarAccion = async () => {
    if (!supabase || !db) return;
    let query;
    if (accion === "CREAR") {
      query = supabase.from(db).insert([formData]);
    } else if (accion === "EDITAR") {
      query = supabase.from(db).update(formData).eq("SKU", skuTarget);
    } else if (accion === "ELIMINAR") {
      query = supabase.from(db).delete().eq("SKU", skuTarget);
    } else if (accion === "INACTIVAR") {
      query = supabase.from(db).update({ estado_inventario: 'inactivo' }).eq("SKU", skuTarget);
    } else if (accion === "VISUALIZAR") {
      query = supabase.from(db).select("*").eq("SKU", skuTarget);
    }
    
    const { data, error } = await (query as any);
    if (error) {
      alert("Error RLS: " + error.message);
    } else { 
      if (accion === "VISUALIZAR") {
        setDataList(data || []);
      } else { 
        alert("Operación exitosa"); 
        setAccion(""); 
        setPaso(0); 
        setFormData({SKU: "", Item: "", Familia: "", Descripción: "", Especificaciones: "", precio: 0, estado_inventario: "disponible"}); 
        setSkuTarget("");
        cargarDatos(seccion); 
      }
    }
  };

  const renderInputs = () => (
    <div style={{ display: "grid", gap: "10px", marginTop: "15px" }}>
      <input placeholder="SKU" onChange={(e) => setFormData({...formData, SKU: e.target.value})} style={inputEstilo} value={formData.SKU}/>
      <input placeholder="Item" onChange={(e) => setFormData({...formData, Item: e.target.value})} style={inputEstilo} value={formData.Item}/>
      <input placeholder="Familia" onChange={(e) => setFormData({...formData, Familia: e.target.value})} style={inputEstilo} value={formData.Familia}/>
      <input placeholder="Descripción" onChange={(e) => setFormData({...formData, Descripción: e.target.value})} style={inputEstilo} value={formData.Descripción}/>
      <input placeholder="Especificaciones" onChange={(e) => setFormData({...formData, Especificaciones: e.target.value})} style={inputEstilo} value={formData.Especificaciones}/>
      <input type="number" placeholder="Precio" onChange={(e) => setFormData({...formData, precio: parseFloat(e.target.value) || 0})} style={inputEstilo} value={formData.precio}/>
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
          const refCot = item.referencia || item.reference || item.id;
          
          let pdfUrl = item.pdf_url;
          if (!pdfUrl && supabase) {
            const { data: publicData } = supabase.storage.from("documentos").getPublicUrl(`${item.id}_cotizacion.pdf`);
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
              {paso === 0 && (
                <>
                  <div style={{ marginBottom: "15px" }}>
                    <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Selecciona la base de datos a trabajar:</label>
                    <select onChange={(e) => setDb(e.target.value)} style={selectEstilo} value={db}>
                      <option value="">-- Selecciona una base de datos --</option>
                      <option value="cabledb">Cable DB</option>
                      <option value="herrajesdb">Herrajes DB</option>
                      <option value="accesoriosdb">Accesorios DB</option>
                    </select>
                  </div>
                  {db && (
                    <>
                      <button onClick={() => {setAccion("CREAR"); setPaso(1);}} style={{...btnAccion, background: "green", color: "#fff"}}>CREAR</button>
                      <button onClick={() => {setAccion("EDITAR"); setPaso(2);}} style={{...btnAccion, background: "#DAA520", color: "#000"}}>EDITAR</button>
                      <button onClick={() => {setAccion("ELIMINAR"); setPaso(2);}} style={{...btnAccion, background: "red", color: "#fff"}}>ELIMINAR</button>
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
                  <input placeholder="Ingresa el SKU a procesar" onChange={(e) => setSkuTarget(e.target.value)} style={inputEstilo} value={skuTarget} />
                  {accion === "EDITAR" && renderInputs()}
                  <div style={{ marginTop: "15px" }}>
                    <button onClick={ejecutarAccion} style={{...btnAccion, background: "green", color: "#fff"}}>EJECUTAR</button>
                    <button onClick={() => {setPaso(0); setAccion(""); setSkuTarget("");}} style={{...btnAccion, background: "gray", color: "#fff"}}>CANCELAR</button>
                  </div>
                </>
              )}
            </div>
            
            {db && (
              <div style={{ marginTop: "20px" }}>
                <h3>Listado de {db}</h3>
                {dataList.map((item: any, idx: number) => (
                  <div key={idx} style={{ border: "1px solid #333", padding: "12px", marginBottom: "5px", background: "#111", borderRadius: "4px" }}>
                    {Object.entries(item).map(([k, v]) => (
                      <span key={k} style={{ marginRight: "15px", display: "inline-block" }}>
                        <strong>{k}:</strong> <span style={{ color: "#fff" }}>{String(v)}</span>
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            )}
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