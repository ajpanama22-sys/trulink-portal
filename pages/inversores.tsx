import { useState } from "react";
import { getSupabase } from "../lib/supabaseClient";
import { uploadAndLinkDocument } from "../services/documentService";

// Forzamos a Next.js a no intentar pre-renderizar esta página durante el build
export const dynamic = 'force-dynamic';

export default function InversoresPage() {
  const [formData, setFormData] = useState({
    nombre_fondo: "",
    website: "",
    representante: "",
    cargo: "",
    correo: "",
    telefono: "",
  });

  const [files, setFiles] = useState<{ nda: File | null; identificacion: File | null }>({
    nda: null,
    identificacion: null,
  });

  const [cargando, setCargando] = useState(false);

  const inputStyle: React.CSSProperties = {
    width: "100%",
    marginBottom: "15px",
    padding: "12px",
    backgroundColor: "#111",
    color: "#DAA520",
    border: "2px solid #DAA520",
    borderRadius: "15px",
    outline: "none",
    transition: "all 0.3s ease",
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, files: inputFiles } = e.target;
    if (inputFiles) {
      setFiles((prev) => ({ ...prev, [name]: inputFiles[0] }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!files.nda || !files.identificacion) {
      alert("Por favor, sube ambos archivos (NDA e Identificación).");
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      alert("Error: Configuración de cliente no disponible.");
      return;
    }

    setCargando(true);

    try {
      // 1. Insertar en base de datos
      const { data: insertData, error: dbError } = await supabase
        .from("solicitudes_acceso")
        .insert([{
          tipo_solicitud: "Inversor Estratégico",
          razon_social: formData.nombre_fondo,
          email: formData.correo,
          estado: "pendiente",
          datos_completos: formData,
        }])
        .select()
        .single();

      if (dbError) throw dbError;

      // 2. Subir y amarrar ambos archivos
      await uploadAndLinkDocument(files.nda, "inversores", insertData.id, "solicitudes_acceso");
      await uploadAndLinkDocument(files.identificacion, "inversores", insertData.id, "solicitudes_acceso");

      alert("Solicitud y documentos de inversor enviados con éxito.");
    } catch (error: any) {
      alert("Error al procesar la solicitud: " + error.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={{ 
      backgroundColor: "#000", 
      color: "#DAA520", 
      minHeight: "100vh", 
      padding: "40px", 
      fontFamily: "sans-serif",
      margin: 0,
      width: "100%" 
    }}>
      
      <style jsx global>{`
        html, body {
          margin: 0;
          padding: 0;
          background-color: #000 !important;
          color: #DAA520;
        }
        @keyframes pulse-border {
          0% { box-shadow: 0 0 10px #DAA520; }
          50% { box-shadow: 0 0 30px #DAA520; }
          100% { box-shadow: 0 0 10px #DAA520; }
        }
        .container-fiber {
          animation: pulse-border 2s infinite;
        }
      `}</style>

      <div className="container-fiber" style={{ 
        maxWidth: "800px",
        margin: "0 auto",
        padding: "40px", 
        border: "2px solid #DAA520", 
        borderRadius: "30px",
        backgroundColor: "#050505"
      }}>
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
          <img src="/images/logo.png" alt="Trulink Fiber Logo" style={{ width: "150px" }} />
          <h1 style={{ color: "#DAA520" }}>Portal de Inversores Estratégicos</h1>
          <p>Bienvenido al área de registro exclusivo para inversores.</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column" }}>
          <input type="text" name="nombre_fondo" placeholder="Nombre del Fondo / Family Office" style={inputStyle} onChange={handleChange} required />
          <input type="url" name="website" placeholder="Sitio Web Corporativo" style={inputStyle} onChange={handleChange} required />
          <input type="text" name="representante" placeholder="Nombre del Representante" style={inputStyle} onChange={handleChange} required />
          <input type="text" name="cargo" placeholder="Cargo" style={inputStyle} onChange={handleChange} required />
          <input type="email" name="correo" placeholder="Correo Corporativo" style={inputStyle} onChange={handleChange} required />
          <input type="tel" name="telefono" placeholder="Teléfono" style={inputStyle} onChange={handleChange} required />

          <label style={{ color: "#DAA520", marginBottom: "10px" }}>Subir NDA (PDF):</label>
          <input type="file" name="nda" accept="application/pdf" style={inputStyle} onChange={handleChange} required />
          
          <label style={{ color: "#DAA520", marginBottom: "10px" }}>Subir Identificación Oficial (PDF):</label>
          <input type="file" name="identificacion" accept="application/pdf" style={inputStyle} onChange={handleChange} required />

          <button type="submit" disabled={cargando} style={{ 
            backgroundColor: "#DAA520", 
            color: "#000", 
            padding: "15px", 
            fontWeight: "bold",
            border: "none",
            borderRadius: "15px",
            marginTop: "20px",
            cursor: "pointer"
          }}>
            {cargando ? "Enviando..." : "Enviar Solicitud"}
          </button>
        </form>
      </div>

      <p style={{ marginTop: "40px", fontSize: "12px", color: "#DAA520", textAlign: "center" }}>
        © 2026 Marca registrada – Derechos reservados – Propiedad de Trulink Fiber LLC
      </p>
    </div>
  );
}
