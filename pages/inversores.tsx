import { useState } from "react";
import { getSupabase } from "../lib/supabaseClient";
import { uploadAndLinkDocument } from "../services/documentService";
import { theme } from "../lib/theme";
import { Card, Heading, Button, inputStyle } from "../lib/ui";

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

  const fieldStyle: React.CSSProperties = {
    ...inputStyle,
    width: "100%",
    marginBottom: "15px",
    padding: "12px",
    boxSizing: "border-box",
  };

  return (
    <div style={{
      backgroundColor: theme.background,
      color: theme.gold,
      minHeight: "100vh",
      padding: "40px",
      fontFamily: theme.fontFamily,
      margin: 0,
      width: "100%",
    }}>

      <style jsx global>{`
        html, body {
          margin: 0;
          padding: 0;
          background-color: ${theme.background} !important;
          color: ${theme.gold};
        }
        @keyframes pulse-border {
          0% { box-shadow: 0 0 10px ${theme.gold}; }
          50% { box-shadow: 0 0 30px ${theme.gold}; }
          100% { box-shadow: 0 0 10px ${theme.gold}; }
        }
        .container-fiber {
          animation: pulse-border 2s infinite;
        }
      `}</style>

      <div className="container-fiber" style={{ maxWidth: "800px", margin: "0 auto" }}>
        <Card style={{ padding: "40px", borderRadius: "30px" }}>
          <div style={{ textAlign: "center", marginBottom: "30px" }}>
            <img src="/images/logo.png" alt="Trulink Fiber Logo" style={{ width: "150px" }} />
            <Heading style={{ fontSize: "1.6rem", textAlign: "center" }}>
              Portal de Inversores Estratégicos
            </Heading>
            <p style={{ color: theme.textLight }}>Bienvenido al área de registro exclusivo para inversores.</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column" }}>
            <input type="text" name="nombre_fondo" placeholder="Nombre del Fondo / Family Office" style={fieldStyle} onChange={handleChange} required />
            <input type="url" name="website" placeholder="Sitio Web Corporativo" style={fieldStyle} onChange={handleChange} required />
            <input type="text" name="representante" placeholder="Nombre del Representante" style={fieldStyle} onChange={handleChange} required />
            <input type="text" name="cargo" placeholder="Cargo" style={fieldStyle} onChange={handleChange} required />
            <input type="email" name="correo" placeholder="Correo Corporativo" style={fieldStyle} onChange={handleChange} required />
            <input type="tel" name="telefono" placeholder="Teléfono" style={fieldStyle} onChange={handleChange} required />

            <label style={{ color: theme.gold, marginBottom: "10px" }}>Subir NDA (PDF):</label>
            <input type="file" name="nda" accept="application/pdf" style={fieldStyle} onChange={handleChange} required />

            <label style={{ color: theme.gold, marginBottom: "10px" }}>Subir Identificación Oficial (PDF):</label>
            <input type="file" name="identificacion" accept="application/pdf" style={fieldStyle} onChange={handleChange} required />

            <div style={{ marginTop: "20px", alignSelf: "center" }}>
              <Button type="submit" variant="gold" disabled={cargando}>
                {cargando ? "Enviando..." : "Enviar Solicitud"}
              </Button>
            </div>
          </form>
        </Card>
      </div>

      <p style={{ marginTop: "40px", fontSize: "12px", color: theme.gold, textAlign: "center" }}>
        © 2026 Marca registrada – Derechos reservados – Propiedad de Trulink Fiber LLC
      </p>
    </div>
  );
}
