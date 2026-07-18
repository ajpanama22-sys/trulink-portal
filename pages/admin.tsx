import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Admin() {
  const [seccion, setSeccion] = useState("VALIDAR");
  const [db, setDb] = useState("cabledb");
  const [solicitudes, setSolicitudes] = useState<any[]>([]);

  useEffect(() => {
    if (seccion === "VALIDAR") {
      fetchRegistros();
    }
  }, [seccion]);

  const fetchRegistros = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from("solicitudes_acceso").select("*").order("created_at", { ascending: false });
    if (error) console.error("Error al cargar:", error);
    else setSolicitudes(data || []);
  };

  const abrirDocumento = (url: string) => {
    // Si la URL está en el bucket, se abre directamente
    window.open(url, "_blank");
  };

  return (
    <div style={{ backgroundColor: "#000", color: "#DAA520", minHeight: "100vh", display: "flex", fontFamily: "sans-serif" }}>
      <style jsx global>{`
        html, body { margin: 0; padding: 0; background-color: #000 !important; color: #DAA520; }
        @keyframes pulse-border { 0% { box-shadow: 0 0 10px #DAA520; } 50% { box-shadow: 0 0 30px #DAA520; } 100% { box-shadow: 0 0 10px #DAA520; } }
        .container-fiber { animation: pulse-border 2s infinite; }
      `}</style>

      {/* Menú Lateral */}
      <div style={{ width: "250px", borderRight: "2px solid #DAA520", padding: "20px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <img src="/images/logo.png" alt="Logo" style={{ width: "100px", margin: "0 auto" }} />
        <h2 style={{ fontSize: "1.2rem", textAlign: "center" }}>ADMIN PANEL</h2>
        <button onClick={() => setSeccion("VALIDAR")} style={{ backgroundColor: seccion === "VALIDAR" ? "#DAA520" : "transparent", color: seccion === "VALIDAR" ? "#000" : "#DAA520", border: "1px solid #DAA520", padding: "10px", borderRadius: "10px", cursor: "pointer", fontWeight: "bold" }}>VALIDAR REGISTROS</button>
        <button onClick={() => setSeccion("COTIZACIONES")} style={{ backgroundColor: seccion === "COTIZACIONES" ? "#DAA520" : "transparent", color: seccion === "COTIZACIONES" ? "#000" : "#DAA520", border: "1px solid #DAA520", padding: "10px", borderRadius: "10px", cursor: "pointer", fontWeight: "bold" }}>COTIZACIONES</button>
        <button onClick={() => setSeccion("PRODUCTOS")} style={{ backgroundColor: seccion === "PRODUCTOS" ? "#DAA520" : "transparent", color: seccion === "PRODUCTOS" ? "#000" : "#DAA520", border: "1px solid #DAA520", padding: "10px", borderRadius: "10px", cursor: "pointer", fontWeight: "bold" }}>PRODUCTOS</button>
      </div>

      {/* Contenido Principal */}
      <div style={{ flex: 1, padding: "40px" }}>
        <h1 style={{ textAlign: "center", borderBottom: "2px solid #DAA520", paddingBottom: "20px" }}>
          {seccion === "VALIDAR" ? "Validación de Solicitudes" : seccion === "COTIZACIONES" ? "Seguimiento de Cotizaciones" : "Gestión de Productos"}
        </h1>

        <div className="container-fiber" style={{ backgroundColor: "#050505", padding: "30px", borderRadius: "20px", marginTop: "20px", border: "1px solid #DAA520" }}>
          {seccion === "VALIDAR" ? (
            <div>
              <h3>Registros Pendientes</h3>
              {solicitudes.length > 0 ? solicitudes.map((sol) => (
                <div key={sol.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px", borderBottom: "1px solid #333" }}>
                  <div style={{ fontSize: "0.9rem" }}>
                    <strong>{sol.razon_social}</strong> | {sol.tipo_solicitud}<br/>
                    <span style={{ color: "#aaa" }}>Email: {sol.email}</span><br/>
                    <span style={{ color: "#888" }}>Fecha: {new Date(sol.created_at).toLocaleString()} | Estado: {sol.estado}</span>
                  </div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button onClick={() => abrirDocumento(sol.documento_url)} style={{ backgroundColor: "transparent", color: "#DAA520", border: "1px solid #DAA520", padding: "5px 15px", borderRadius: "5px", cursor: "pointer" }}>REVISAR</button>
                    <button style={{ backgroundColor: "#DAA520", border: "none", padding: "5px 15px", borderRadius: "5px", fontWeight: "bold", cursor: "pointer" }}>ACTIVAR</button>
                  </div>
                </div>
              )) : <p>No hay registros pendientes.</p>}
            </div>
          ) : seccion === "PRODUCTOS" ? (
            <div>
              <h3>Gestión de Productos</h3>
              <select value={db} onChange={(e) => setDb(e.target.value)} style={{ backgroundColor: "#000", color: "#DAA520", padding: "10px", borderRadius: "10px", border: "1px solid #DAA520", marginBottom: "20px", width: "100%" }}>
                <option value="cabledb">Cable DB</option>
                <option value="herrajesdb">Herrajes DB</option>
                <option value="accesoriosdb">Accesorios DB</option>
              </select>
            </div>
          ) : (
            <p>Historial de cotizaciones.</p>
          )}
        </div>

        <p style={{ marginTop: "60px", fontSize: "12px", textAlign: "center" }}>© 2026 Trulink Fiber LLC</p>
      </div>
    </div>
  );
}
