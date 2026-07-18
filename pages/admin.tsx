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
    // Verificación de seguridad para evitar errores de tipo en tiempo de compilación
    if (!supabase) {
      console.error("Supabase no ha sido inicializado");
      return;
    }

    const { data, error } = await supabase.from("solicitudes_acceso").select("*");
    if (error) {
      console.error("Error al cargar registros:", error);
    } else {
      setSolicitudes(data || []);
    }
  };

  return (
    <div style={{ 
      backgroundColor: "#000", 
      color: "#DAA520", 
      minHeight: "100vh", 
      display: "flex", 
      fontFamily: "sans-serif" 
    }}>
      <style jsx global>{`
        html, body { margin: 0; padding: 0; background-color: #000 !important; color: #DAA520; }
        @keyframes pulse-border { 0% { box-shadow: 0 0 10px #DAA520; } 50% { box-shadow: 0 0 30px #DAA520; } 100% { box-shadow: 0 0 10px #DAA520; } }
        .container-fiber { animation: pulse-border 2s infinite; }
      `}</style>

      {/* Menú Lateral */}
      <div style={{ 
        width: "250px", 
        borderRight: "2px solid #DAA520", 
        padding: "20px", 
        display: "flex", 
        flexDirection: "column", 
        gap: "20px" 
      }}>
        <img src="/images/logo.png" alt="Logo" style={{ width: "100px", margin: "0 auto" }} />
        <h2 style={{ fontSize: "1.2rem", textAlign: "center" }}>ADMIN PANEL</h2>
        
        <button onClick={() => setSeccion("VALIDAR")} style={{ backgroundColor: seccion === "VALIDAR" ? "#DAA520" : "transparent", color: seccion === "VALIDAR" ? "#000" : "#DAA520", border: "1px solid #DAA520", padding: "10px", borderRadius: "10px", cursor: "pointer", fontWeight: "bold" }}>
          VALIDAR REGISTROS
        </button>
        
        <button onClick={() => setSeccion("COTIZACIONES")} style={{ backgroundColor: seccion === "COTIZACIONES" ? "#DAA520" : "transparent", color: seccion === "COTIZACIONES" ? "#000" : "#DAA520", border: "1px solid #DAA520", padding: "10px", borderRadius: "10px", cursor: "pointer", fontWeight: "bold" }}>
          COTIZACIONES
        </button>

        <button onClick={() => setSeccion("PRODUCTOS")} style={{ backgroundColor: seccion === "PRODUCTOS" ? "#DAA520" : "transparent", color: seccion === "PRODUCTOS" ? "#000" : "#DAA520", border: "1px solid #DAA520", padding: "10px", borderRadius: "10px", cursor: "pointer", fontWeight: "bold" }}>
          PRODUCTOS
        </button>
      </div>

      {/* Contenido Principal */}
      <div style={{ flex: 1, padding: "40px" }}>
        <h1 style={{ textAlign: "center", borderBottom: "2px solid #DAA520", paddingBottom: "20px" }}>
          {seccion === "VALIDAR" ? "Validación de Solicitudes" : 
           seccion === "COTIZACIONES" ? "Seguimiento de Cotizaciones" : "Gestión de Productos"}
        </h1>

        <div className="container-fiber" style={{ 
          backgroundColor: "#050505", 
          padding: "30px", 
          borderRadius: "20px", 
          marginTop: "20px",
          border: "1px solid #DAA520"
        }}>
          {seccion === "VALIDAR" ? (
            <div>
              <h3>Registros Pendientes (Bucket: registros)</h3>
              {solicitudes.length > 0 ? (
                solicitudes.map((sol) => (
                  <div key={sol.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px", borderBottom: "1px solid #333" }}>
                    <span>Usuario: {sol.email} | Doc: {sol.nombre_archivo}</span>
                    <button style={{ backgroundColor: "#DAA520", border: "none", padding: "5px 15px", borderRadius: "5px", fontWeight: "bold", cursor: "pointer" }}>Activar</button>
                  </div>
                ))
              ) : (
                <p>No hay registros pendientes.</p>
              )}
            </div>
          ) : seccion === "COTIZACIONES" ? (
            <div>
              <h3>PDFs Generados (Bucket: documentos)</h3>
              <p>Historial de cotizaciones emitidas por Trulink Fiber LLC.</p>
            </div>
          ) : (
            <div>
              <h3>Gestión de Productos</h3>
              <select value={db} onChange={(e) => setDb(e.target.value)} style={{ backgroundColor: "#000", color: "#DAA520", padding: "10px", borderRadius: "10px", border: "1px solid #DAA520", marginBottom: "20px", width: "100%" }}>
                <option value="cabledb">Cable DB</option>
                <option value="herrajesdb">Herrajes DB</option>
                <option value="accesoriosdb">Accesorios DB</option>
              </select>
              <div style={{ display: "flex", gap: "10px" }}>
                <button style={{ backgroundColor: "#00FF00", border: "none", padding: "10px", borderRadius: "5px", cursor: "pointer" }}>CREAR</button>
                <button style={{ backgroundColor: "#FFFF00", border: "none", padding: "10px", borderRadius: "5px", cursor: "pointer" }}>EDITAR</button>
                <button style={{ backgroundColor: "#FF0000", border: "none", padding: "10px", borderRadius: "5px", cursor: "pointer" }}>ELIMINAR</button>
                <button style={{ backgroundColor: "#FFA500", border: "none", padding: "10px", borderRadius: "5px", cursor: "pointer" }}>INACTIVAR</button>
              </div>
              <p style={{ marginTop: "20px" }}>Gestionando: <strong>{db}</strong></p>
            </div>
          )}
        </div>

        {/* Footer institucional */}
        <p style={{ marginTop: "60px", fontSize: "12px", textAlign: "center" }}>
          © 2026 Trulink Fiber LLC – Configuración SMTP: {`{smtp-relay.brevo.com:587}`}
        </p>
      </div>
    </div>
  );
}
