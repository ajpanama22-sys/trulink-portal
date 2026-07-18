import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Admin() {
  const [seccion, setSeccion] = useState<string>("VALIDAR");
  const [db, setDb] = useState<string>("cabledb");
  const [dataList, setDataList] = useState<any[]>([]);
  const [modo, setModo] = useState<string | null>(null);
  const [itemSeleccionado, setItemSeleccionado] = useState<any>(null);

  useEffect(() => {
    cargarDatos();
  }, [seccion, db]);

  const cargarDatos = async () => {
    if (!supabase) return;
    let tabla = seccion === "VALIDAR" ? "solicitudes_acceso" : seccion === "COTIZACIONES" ? "quotes" : db;
    const { data, error } = await supabase.from(tabla).select("*");
    if (!error) setDataList(data || []);
  };

  const ejecutarAccion = async (accion: string, item: any = null) => {
    if (accion === "ELIMINAR") {
      const confirmacion = window.confirm("¿ESTÁS TOTALMENTE SEGURO QUE DESEA ELIMINAR ESTE ITEM? (S/N)");
      if (confirmacion) {
        await supabase.from(db).delete().eq('id', item.id);
        cargarDatos();
      }
    } else {
      setModo(accion);
      setItemSeleccionado(item);
    }
  };

  const renderFormulario = () => {
    if (!itemSeleccionado) return null;
    return (
      <div style={{ padding: "20px", border: "1px solid #DAA520", borderRadius: "15px" }}>
        <h3>{modo} PRODUCTO: {itemSeleccionado.sku || "NUEVO"}</h3>
        {Object.keys(itemSeleccionado).map((key) => (
          <div key={key} style={{ marginBottom: "10px" }}>
            <label style={{ display: "block", color: "#DAA520" }}>{key.toUpperCase()}</label>
            <input 
              defaultValue={itemSeleccionado[key]} 
              readOnly={modo === "VISUALIZAR"}
              style={{ width: "100%", padding: "8px", background: "#111", color: "#fff", border: "1px solid #DAA520" }}
            />
          </div>
        ))}
        <button onClick={() => setModo(null)} style={{ marginTop: "20px", padding: "10px 20px", borderRadius: "20px", cursor: "pointer" }}>GUARDAR Y CERRAR</button>
      </div>
    );
  };

  return (
    <div style={{ backgroundColor: "#000", minHeight: "100vh", display: "flex", color: "#DAA520", fontFamily: "sans-serif" }}>
      {/* MENÚ LATERAL */}
      <div style={{ width: "300px", borderRight: "2px solid #DAA520", padding: "30px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <h2 style={{ textAlign: "center" }}>ADMIN PANEL</h2>
        <button onClick={() => {setSeccion("VALIDAR"); setModo(null);}} style={btnEstilo}>VALIDAR INSCRIPCIONES</button>
        <button onClick={() => {setSeccion("COTIZACIONES"); setModo(null);}} style={btnEstilo}>COTIZACIONES GENERADAS</button>
        <button onClick={() => {setSeccion("PRODUCTOS"); setModo(null);}} style={btnEstilo}>PRODUCTOS</button>
      </div>

      {/* CONTENIDO */}
      <div style={{ flex: 1, padding: "40px" }}>
        {seccion === "PRODUCTOS" && (
          <div style={{ marginBottom: "30px" }}>
            <select value={db} onChange={(e) => setDb(e.target.value)} style={selectEstilo}>
              <option value="cabledb">Cable DB</option>
              <option value="herrajesdb">Herrajes DB</option>
              <option value="accesoriosdb">Accesorios DB</option>
            </select>
          </div>
        )}

        {modo ? renderFormulario() : (
          dataList.map((item) => (
            <div key={item.id} style={{ display: "flex", justifyContent: "space-between", padding: "15px", borderBottom: "1px solid #333" }}>
              <span>{item.sku || item.razon_social || item.id}</span>
              <div style={{ display: "flex", gap: "10px" }}>
                {seccion === "PRODUCTOS" ? (
                  <>
                    <button onClick={() => ejecutarAccion("CREAR", {})} style={{...crudBtn, background: "green"}}>CREAR</button>
                    <button onClick={() => ejecutarAccion("EDITAR", item)} style={{...crudBtn, background: "gold", color: "#000"}}>EDITAR</button>
                    <button onClick={() => ejecutarAccion("ELIMINAR", item)} style={{...crudBtn, background: "red"}}>ELIMINAR</button>
                    <button onClick={() => ejecutarAccion("INACTIVAR", item)} style={{...crudBtn, background: "gray"}}>INACTIVAR</button>
                    <button onClick={() => ejecutarAccion("VISUALIZAR", item)} style={{...crudBtn, background: "blue"}}>VISUALIZAR</button>
                  </>
                ) : (
                  <button onClick={() => window.open(supabase.storage.from(seccion === "VALIDAR" ? "registros" : "documentos").getPublicUrl(item.documento_url || item.pdf_url).data.publicUrl, "_blank")} style={btnEstilo}>VER DOCUMENTO</button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ESTILOS ESTÁTICOS
const btnEstilo = { padding: "15px", borderRadius: "30px", border: "1px solid #DAA520", background: "transparent", color: "#DAA520", cursor: "pointer", fontWeight: "bold" };
const selectEstilo = { background: "#000", color: "#DAA520", padding: "10px", borderRadius: "20px", border: "1px solid #DAA520", width: "200px" };
const crudBtn = { border: "none", padding: "8px 15px", borderRadius: "20px", cursor: "pointer", color: "#fff", fontWeight: "bold" };
