import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Admin() {
  const [seccion, setSeccion] = useState("VALIDAR");
  const [db, setDb] = useState("cabledb");
  const [dataList, setDataList] = useState<any[]>([]);

  useEffect(() => {
    cargarDatos();
  }, [seccion, db]);

  const cargarDatos = async () => {
    if (!supabase) return;
    let tabla = "";
    if (seccion === "VALIDAR") tabla = "inscripcionesdb";
    else if (seccion === "COTIZACIONES") tabla = "cotizacionesdb";
    else if (seccion === "PRODUCTOS") tabla = db;

    if (tabla) {
      const { data } = await supabase.from(tabla).select("*");
      setDataList(data || []);
    }
  };

  const ejecutarAccion = (accion: string, item: any = null) => {
    alert(`Acción: ${accion} ejecutada en ${seccion === "PRODUCTOS" ? db : "tabla"} sobre ${item ? item.id : "nuevo registro"}`);
  };

  const btnStyle = {
    padding: "15px", cursor: "pointer", background: "transparent", color: "#DAA520", 
    border: "1px solid #DAA520", fontWeight: "bold", transition: "0.3s"
  };

  return (
    <div style={{ backgroundColor: "#000", minHeight: "100vh", display: "flex", color: "#DAA520", fontFamily: "sans-serif" }}>
      <style>{`
        .menu-btn:hover, .menu-btn.active { box-shadow: 0 0 15px #DAA520; background: #1a1a1a !important; }
      `}</style>

      {/* Menú Lateral */}
      <div style={{ width: "300px", borderRight: "2px solid #DAA520", display: "flex", flexDirection: "column", gap: "10px", padding: "20px" }}>
        <h2 style={{ textAlign: "center" }}>PANEL ADMIN</h2>
        {["VALIDAR", "COTIZACIONES", "PRODUCTOS"].map((s) => (
          <button key={s} className={`menu-btn ${seccion === s ? "active" : ""}`} onClick={() => setSeccion(s)} style={btnStyle}>
            {s === "VALIDAR" ? "VALIDAR INSCRIPCIONES" : s === "COTIZACIONES" ? "COTIZACIONES GENERADAS" : s}
          </button>
        ))}
      </div>

      {/* Contenido Principal */}
      <div style={{ flex: 1, padding: "40px" }}>
        {seccion === "PRODUCTOS" && (
          <select onChange={(e) => setDb(e.target.value)} style={{ background: "#000", color: "#DAA520", padding: "10px", marginBottom: "20px" }}>
            <option value="cabledb">Cable DB</option>
            <option value="herrajesdb">Herrajes DB</option>
            <option value="accesoriosdb">Accesorios DB</option>
          </select>
        )}

        <table style={{ width: "100%", borderCollapse: "collapse", color: "#DAA520" }}>
          <thead><tr style={{ borderBottom: "1px solid #DAA520" }}><th>ID</th><th>Datos</th><th>Acciones</th></tr></thead>
          <tbody>
            {dataList.map((item) => (
              <tr key={item.id} style={{ borderBottom: "1px solid #333" }}>
                <td>{item.id}</td>
                <td>{JSON.stringify(item).substring(0, 50)}...</td>
                <td style={{ display: "flex", gap: "5px" }}>
                  {seccion === "PRODUCTOS" ? (
                    <>
                      <button onClick={() => ejecutarAccion("CREAR", item)} style={{ background: "green", color: "#fff", border: "none" }}>CREAR</button>
                      <button onClick={() => ejecutarAccion("EDITAR", item)} style={{ background: "yellow", color: "#000", border: "none" }}>EDITAR</button>
                      <button onClick={() => ejecutarAccion("ELIMINAR", item)} style={{ background: "red", color: "#fff", border: "none" }}>ELIMINAR</button>
                      <button onClick={() => ejecutarAccion("INACTIVAR", item)} style={{ background: "gray", color: "#fff", border: "none" }}>INACTIVAR</button>
                      <button onClick={() => ejecutarAccion("VISUALIZAR", item)} style={{ background: "blue", color: "#fff", border: "none" }}>VISUALIZAR</button>
                    </>
                  ) : <button onClick={() => alert("Revisando...")} style={btnStyle}>REVISAR</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
