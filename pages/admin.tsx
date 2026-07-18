import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Admin() {
  const [seccion, setSeccion] = useState<string>("VALIDAR");
  const [db, setDb] = useState<string>("cabledb");
  const [dataList, setDataList] = useState<any[]>([]);

  useEffect(() => {
    cargarDatos();
  }, [seccion, db]);

  const cargarDatos = async () => {
    if (!supabase) return;
    let tabla = seccion === "VALIDAR" ? "solicitudes_acceso" : seccion === "COTIZACIONES" ? "quotes" : db;
    const { data, error } = await supabase.from(tabla).select("*").order("created_at", { ascending: false });
    if (!error) setDataList(data || []);
  };

  const ejecutarAccion = (accion: string, item: any = null) => {
    alert(`Ejecutando ${accion} sobre ID: ${item?.id || "NUEVO"}`);
  };

  const abrirArchivo = (ruta: string | null | undefined, bucket: string) => {
    if (!ruta || ruta === "EMPTY") return alert("No hay archivo");
    const nombreCodificado = encodeURIComponent(ruta.split('/').pop() || "");
    const { data } = supabase.storage.from(bucket).getPublicUrl(nombreCodificado);
    window.open(data.publicUrl, "_blank");
  };

  // Estilos Corporativos
  const btnMenu = {
    padding: "12px 20px", borderRadius: "20px", cursor: "pointer", border: "1px solid #DAA520",
    background: "transparent", color: "#DAA520", transition: "all 0.3s ease", fontWeight: "bold", fontSize: "14px"
  };

  return (
    <div style={{ backgroundColor: "#000", minHeight: "100vh", display: "flex", color: "#DAA520", fontFamily: "sans-serif" }}>
      <style>{`
        .btn-glow:hover { transform: scale(1.05); box-shadow: 0 0 15px #DAA520; background: #1a1a1a; }
        .btn-crud { border: none; padding: 8px 15px; border-radius: 10px; cursor: pointer; color: #fff; font-weight: bold; transition: 0.3s; }
        .btn-crud:hover { transform: scale(1.1); box-shadow: 0 0 10px #fff; }
      `}</style>

      {/* Menú Lateral */}
      <div style={{ width: "300px", borderRight: "2px solid #DAA520", padding: "20px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <h2 style={{ textAlign: "center", color: "#DAA520" }}>ADMIN PANEL</h2>
        <button className="btn-glow" onClick={() => setSeccion("VALIDAR")} style={btnMenu}>VALIDAR INSCRIPCIONES</button>
        <button className="btn-glow" onClick={() => setSeccion("COTIZACIONES")} style={btnMenu}>COTIZACIONES GENERADAS</button>
        <button className="btn-glow" onClick={() => setSeccion("PRODUCTOS")} style={btnMenu}>PRODUCTOS</button>
      </div>

      {/* Contenido Principal */}
      <div style={{ flex: 1, padding: "40px" }}>
        {seccion === "PRODUCTOS" && (
          <div style={{ marginBottom: "20px" }}>
            <label style={{ marginRight: "10px" }}>Seleccionar Base de Datos:</label>
            <select value={db} onChange={(e) => setDb(e.target.value)} style={{ background: "#000", color: "#DAA520", padding: "10px", borderRadius: "10px", border: "1px solid #DAA520" }}>
              <option value="cabledb">Cable DB</option>
              <option value="herrajesdb">Herrajes DB</option>
              <option value="accesoriosdb">Accesorios DB</option>
            </select>
          </div>
        )}

        {dataList.map((item) => (
          <div key={item.id} style={{ display: "flex", justifyContent: "space-between", padding: "15px", borderBottom: "1px solid #333", alignItems: "center" }}>
            <span style={{ fontWeight: "bold" }}>{item.razon_social || item.email || item.id}</span>
            <div style={{ display: "flex", gap: "10px" }}>
              {seccion === "PRODUCTOS" ? (
                <>
                  <button className="btn-crud" onClick={() => ejecutarAccion("CREAR", item)} style={{ backgroundColor: "green" }}>CREAR</button>
                  <button className="btn-crud" onClick={() => ejecutarAccion("EDITAR", item)} style={{ backgroundColor: "gold", color: "#000" }}>EDITAR</button>
                  <button className="btn-crud" onClick={() => ejecutarAccion("ELIMINAR", item)} style={{ backgroundColor: "red" }}>ELIMINAR</button>
                  <button className="btn-crud" onClick={() => ejecutarAccion("INACTIVAR", item)} style={{ backgroundColor: "gray" }}>INACTIVAR</button>
                  <button className="btn-crud" onClick={() => ejecutarAccion("VISUALIZAR", item)} style={{ backgroundColor: "blue" }}>VISUALIZAR</button>
                </>
              ) : (
                <button className="btn-glow" onClick={() => abrirArchivo(seccion === "VALIDAR" ? item.documento_url : item.pdf_url, seccion === "VALIDAR" ? "registros" : "documentos")} style={btnMenu}>REVISAR</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
