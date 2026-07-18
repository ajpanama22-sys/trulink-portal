import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Admin() {
  const [seccion, setSeccion] = useState<string>("VALIDAR");
  const [db, setDb] = useState<string>("cabledb");
  const [accion, setAccion] = useState<string>(""); 
  const [sku, setSku] = useState<string>("");
  const [datosForm, setDatosForm] = useState<any>({});
  const [dataList, setDataList] = useState<any[]>([]);
  const [paso, setPaso] = useState<number>(0); 

  useEffect(() => {
    cargarDatos(seccion);
  }, [seccion]);

  const cargarDatos = async (seccionActual: string) => {
    if (!supabase) return;
    setDataList([]);
    let query;
    if (seccionActual === "COTIZACIONES") query = supabase.from("quotes").select("*");
    else if (seccionActual === "VALIDAR") query = supabase.from("solicitudes_acceso").select("*");
    else if (seccionActual === "PRODUCTOS") query = supabase.from(db).select("*");

    if (query) {
      const { data, error } = await query;
      if (error) console.error("Error:", error);
      else setDataList(data || []);
    }
  };

  const procesarSolicitud = async (id: string, tipo: 'ACTIVAR' | 'RECHAZAR') => {
    if (!supabase) return;
    if (tipo === 'ACTIVAR') await supabase.from("solicitudes_acceso").update({ status: 'active' }).eq('id', id);
    else await supabase.from("solicitudes_acceso").delete().eq('id', id);
    cargarDatos(seccion);
  };

  const ejecutarAccion = async () => {
    if (!supabase) return;
    let query;
    if (accion === "CREAR") query = supabase.from(db).insert([datosForm]);
    else if (accion === "EDITAR") query = supabase.from(db).update(datosForm).eq("sku", sku);
    else if (accion === "ELIMINAR") query = supabase.from(db).delete().eq("sku", sku);
    else if (accion === "INACTIVAR") query = supabase.from(db).update({ status: 'inactive' }).eq("sku", sku);
    else if (accion === "VISUALIZAR") query = supabase.from(db).select("*").eq("sku", sku);
    
    const { data, error } = await (query as any);
    if (error) alert("Error: " + error.message);
    else { 
      if (accion === "VISUALIZAR") setDataList(data);
      else { alert("Operación exitosa"); setAccion(""); setPaso(0); cargarDatos(seccion); }
    }
  };

  return (
    <div style={{ backgroundColor: "#000", minHeight: "100vh", display: "flex", color: "#DAA520", fontFamily: "sans-serif" }}>
      <div style={{ width: "280px", borderRight: "2px solid #DAA520", padding: "20px" }}>
        <h2 style={{ textAlign: "center" }}>ADMIN PANEL</h2>
        <button onClick={() => {setSeccion("VALIDAR"); setPaso(0);}} style={btnNav}>VALIDAR INSCRIPCIONES</button>
        <button onClick={() => {setSeccion("COTIZACIONES"); setPaso(0);}} style={btnNav}>COTIZACIONES GENERADAS</button>
        <button onClick={() => {setSeccion("PRODUCTOS"); setPaso(0);}} style={btnNav}>PRODUCTOS</button>
      </div>

      <div style={{ flex: 1, padding: "40px" }}>
        {seccion === "VALIDAR" && dataList.map((item: any) => (
          <div key={item.id} style={{ borderBottom: "1px solid #333", padding: "20px" }}>
            <div><strong>RAZON SOCIAL:</strong> {item.razon_social} | <strong>EMAIL:</strong> {item.email}</div>
            
            {/* INTENTO DE ENLACE - Ajusta 'documentos_url' al nombre real de tu columna */}
            <a href={item.documentos_url || item.url || "#"} target="_blank" rel="noreferrer" 
               style={{...btnAccion, background: "blue", color: "#fff", margin: "10px 0"}}>
               VER DOCUMENTOS
            </a>

            <button onClick={() => procesarSolicitud(item.id, 'ACTIVAR')} style={{...btnAccion, background: "green"}}>ACTIVAR</button>
            <button onClick={() => procesarSolicitud(item.id, 'RECHAZAR')} style={{...btnAccion, background: "red"}}>RECHAZAR</button>
          </div>
        ))}

        {seccion === "COTIZACIONES" && dataList.map((item: any) => (
          <div key={item.id} style={{ border: "1px solid #DAA520", padding: "20px", marginBottom: "20px", borderRadius: "10px" }}>
            <p><strong>ID:</strong> {item.id} | <strong>USUARIO:</strong> {item.user_email || item.user_id}</p>
            <p><strong>TOTAL:</strong> ${item.total}</p>
            <table style={{ width: "100%", color: "#fff", borderCollapse: "collapse", marginTop: "10px" }}>
              <thead><tr style={{ borderBottom: "1px solid #DAA520" }}><th>Prod</th><th>Km</th><th>Hilos</th><th>Cant</th><th>Total</th></tr></thead>
              <tbody>
                {item.items?.map((it: any, i: number) => (
                  <tr key={i} style={{ textAlign: "center" }}><td>{it.product}</td><td>{it.km}</td><td>{it.hilos}</td><td>{it.cantidad}</td><td>{it.lineTotal}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {seccion === "PRODUCTOS" && (
          <>
            <div style={{ border: "1px solid #DAA520", padding: "20px", marginBottom: "20px" }}>
              {paso === 0 && (
                <>
                  <button onClick={() => {setAccion("CREAR"); setPaso(1);}} style={{...btnAccion, background: "green"}}>CREAR</button>
                  <button onClick={() => {setAccion("EDITAR"); setPaso(1);}} style={{...btnAccion, background: "#DAA520", color: "#000"}}>EDITAR</button>
                  <button onClick={() => {setAccion("ELIMINAR"); setPaso(1);}} style={{...btnAccion, background: "red"}}>ELIMINAR</button>
                  <button onClick={() => {setAccion("INACTIVAR"); setPaso(1);}} style={{...btnAccion, background: "orange"}}>INACTIVAR</button>
                  <button onClick={() => {setAccion("VISUALIZAR"); setPaso(1);}} style={{...btnAccion, background: "blue", color: "#fff"}}>VISUALIZAR</button>
                </>
              )}
              {paso === 1 && (
                <>
                  <select onChange={(e) => setDb(e.target.value)} style={selectEstilo}>
                    <option value="cabledb">Cable DB</option>
                    <option value="herrajesdb">Herrajes DB</option>
                    <option value="accesoriosdb">Accesorios DB</option>
                  </select>
                  <button onClick={() => setPaso(2)} style={{...btnAccion, background: "green"}}>ACEPTAR</button>
                </>
              )}
              {paso === 2 && (
                <>
                  {(accion !== "CREAR") && <input placeholder="SKU" onChange={(e) => setSku(e.target.value)} style={inputEstilo} />}
                  <input placeholder="Datos (JSON)" onChange={(e) => {try{setDatosForm(JSON.parse(e.target.value))}catch(e){}}} style={inputEstilo} />
                  <button onClick={ejecutarAccion} style={{...btnAccion, background: "green"}}>EJECUTAR</button>
                  <button onClick={() => {setPaso(0); setAccion("");}} style={{...btnAccion, background: "gray"}}>CANCELAR</button>
                </>
              )}
            </div>
            {dataList.map((item: any, idx: number) => (
              <div key={idx} style={{ border: "1px solid #333", padding: "10px", marginBottom: "5px" }}>
                {Object.entries(item).map(([k, v]) => <span key={k} style={{marginRight: "10px"}}><strong>{k}:</strong> {String(v)}</span>)}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

const btnNav = { padding: "15px", borderRadius: "30px", border: "1px solid #DAA520", background: "transparent", color: "#DAA520", width: "100%", marginBottom: "10px", cursor: "pointer", fontWeight: "bold", textAlign: "left" as const };
const btnAccion = { padding: "10px 20px", cursor: "pointer", border: "none", borderRadius: "5px", fontWeight: "bold", marginRight: "10px", display: "inline-block", textDecoration: "none", color: "#000" };
const selectEstilo = { background: "#000", color: "#DAA520", padding: "10px", border: "1px solid #DAA520", width: "100%", marginBottom: "10px" };
const inputEstilo = { background: "#000", color: "#DAA520", padding: "10px", border: "1px solid #DAA520", width: "100%", marginBottom: "10px" };
