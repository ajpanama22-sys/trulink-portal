import { useState } from "react";
import { getSupabase } from "../lib/supabaseClient";
import { uploadAndLinkDocument } from "../services/documentService";

// Forzamos a Next.js a no intentar pre-renderizar esta página durante el build
export const dynamic = 'force-dynamic';

const codigosPaises = [
  { codigo: "+507", pais: "Panamá (+507)" },
  { codigo: "+1", pais: "Estados Unidos / Canadá (+1)" },
  { codigo: "+52", pais: "México (+52)" },
  { codigo: "+57", pais: "Colombia (+57)" },
  { codigo: "+54", pais: "Argentina (+54)" },
  { codigo: "+55", pais: "Brasil (+55)" },
  { codigo: "+56", pais: "Chile (+56)" },
  { codigo: "+51", pais: "Perú (+51)" },
  { codigo: "+58", pais: "Venezuela (+58)" },
  { codigo: "+593", pais: "Ecuador (+593)" },
  { codigo: "+34", pais: "España (+34)" },
  { codigo: "+506", pais: "Costa Rica (+506)" },
  { codigo: "+503", pais: "El Salvador (+503)" },
  { codigo: "+502", pais: "Guatemala (+502)" },
  { codigo: "+504", pais: "Honduras (+504)" },
  { codigo: "+505", pais: "Nicaragua (+505)" },
  { codigo: "+53", pais: "Cuba (+53)" },
  { codigo: "+1-809", pais: "República Dominicana (+1 809)" },
  { codigo: "+598", pais: "Uruguay (+598)" },
  { codigo: "+595", pais: "Paraguay (+595)" },
  { codigo: "+44", pais: "Reino Unido (+44)" },
  { codigo: "+33", pais: "Francia (+33)" },
  { codigo: "+49", pais: "Alemania (+49)" },
  { codigo: "+86", pais: "China (+86)" },
  { codigo: "+81", pais: "Japón (+81)" },
];

export default function Clientes() {
  const [formData, setFormData] = useState({
    tipo_solicitud: "Cliente B2B",
    razon_social: "",
    identificacion_fiscal: "",
    sitio_web: "",
    industria: "",
    pais: "",
    direccion: "",
    nombre_representante: "",
    cargo: "",
    email: "",
    codigo_pais_oficina: "+507",
    telefono_oficina: "",
    codigo_pais_celular: "+507",
    telefono_celular: "",
    perfil_cliente: "ISP",
  });

  const [cargando, setCargando] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [terminosAceptados, setTerminosAceptados] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      // Convertimos la lista de archivos seleccionados a un arreglo estándar
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!terminosAceptados) {
      alert("Debe leer y aceptar los Términos y Condiciones para continuar.");
      return;
    }

    if (selectedFiles.length === 0) {
      alert("Por favor, adjunta al menos un documento de soporte.");
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      alert("Error: Configuración de cliente no disponible.");
      return;
    }

    setCargando(true);

    try {
      const telefonoOficinaCompleto = `${formData.codigo_pais_oficina} ${formData.telefono_oficina}`.trim();
      const telefonoCelularCompleto = `${formData.codigo_pais_celular} ${formData.telefono_celular}`.trim();

      const datosCompletosConTelefonos = {
        ...formData,
        telefono_oficina: telefonoOficinaCompleto,
        telefono_celular: telefonoCelularCompleto
      };

      // 1. Insertar la solicitud principal en Supabase
      const { data: insertData, error: dbError } = await supabase
        .from("solicitudes_acceso")
        .insert([{
          tipo_solicitud: formData.tipo_solicitud,
          razon_social: formData.razon_social,
          email: formData.email,
          telefono_oficina: telefonoOficinaCompleto,
          telefono_celular: telefonoCelularCompleto,
          estado: "pendiente",
          datos_completos: datosCompletosConTelefonos,
        }])
        .select()
        .single();

      if (dbError) throw dbError;

      const categoria = formData.tipo_solicitud === "Cliente B2B" ? "b2b" : "inversores";

      // 2. Subir y asociar automáticamente TODOS los archivos seleccionados en un ciclo
      const urlsSubidas: string[] = [];
      for (const file of selectedFiles) {
        const resultadoDoc = await uploadAndLinkDocument(file, categoria, insertData.id, "solicitudes_acceso");
        if (resultadoDoc) {
          urlsSubidas.push(resultadoDoc);
        }
      }

      // 3. Opcional: Actualizar la solicitud con la primera URL principal o arreglo si tu BD lo requiere
      if (urlsSubidas.length > 0) {
        await supabase
          .from("solicitudes_acceso")
          .update({ documento_url: urlsSubidas[0] }) // Guarda la principal para compatibilidad con la vista de administración
          .eq("id", insertData.id);
      }

      alert("¡Solicitud y documentos enviados con éxito de forma automática!");
      
      // Limpiar formulario o recargar
      window.location.reload();

    } catch (error: any) {
      alert("Error al procesar la solicitud: " + error.message);
    } finally {
      setCargando(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    marginBottom: "18px",
    padding: "14px 16px",
    backgroundColor: "#0a0a0a",
    color: "#DAA520",
    border: "1px solid rgba(218, 165, 32, 0.4)",
    borderRadius: "14px",
    outline: "none",
    boxSizing: "border-box",
    fontSize: "0.95rem",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    boxShadow: "inset 0 1px 3px rgba(0,0,0,0.8)"
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: "pointer",
  };

  const sectionHeaderStyle: React.CSSProperties = {
    color: "#DAA520",
    fontSize: "1.1rem",
    fontWeight: "600",
    margin: "30px 0 15px 0",
    borderBottom: "1px solid rgba(218, 165, 32, 0.2)",
    paddingBottom: "8px",
    letterSpacing: "0.5px"
  };

  return (
    <div style={{ 
      backgroundColor: "#000000", 
      color: "#DAA520", 
      minHeight: "100vh", 
      padding: "40px 20px", 
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      boxSizing: "border-box",
      width: "100%" 
    }}>
      <style jsx global>{`
        html, body {
          margin: 0;
          padding: 0;
          background-color: #000000 !important;
          color: #DAA520;
        }
        @keyframes pulse-border {
          0% { box-shadow: 0 0 15px rgba(218, 165, 32, 0.15), inset 0 0 15px rgba(218, 165, 32, 0.05); }
          50% { box-shadow: 0 0 35px rgba(218, 165, 32, 0.35), inset 0 0 25px rgba(218, 165, 32, 0.1); }
          100% { box-shadow: 0 0 15px rgba(218, 165, 32, 0.15), inset 0 0 15px rgba(218, 165, 32, 0.05); }
        }
        .container-fiber {
          animation: pulse-border 4s infinite ease-in-out;
        }
        .action-btn {
          background: linear-gradient(135deg, #DAA520 0%, #B8860B 100%) !important;
          color: #000000 !important;
          font-weight: 600;
          border: none;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .action-btn:hover {
          filter: brightness(1.15);
          box-shadow: 0 0 20px rgba(218, 165, 32, 0.4);
          transform: translateY(-1px);
        }
        input:focus, select:focus, textarea:focus {
          border-color: #DAA520 !important;
          box-shadow: 0 0 12px rgba(218, 165, 32, 0.3), inset 0 1px 3px rgba(0,0,0,0.8) !important;
        }
        input[type="radio"], input[type="checkbox"] {
          accent-color: #DAA520;
          cursor: pointer;
          transform: scale(1.1);
        }
      `}</style>

      <div className="container-fiber" style={{ 
        display: "flex", 
        flexDirection: "column",
        gap: "30px", 
        padding: "45px", 
        border: "1px solid rgba(218, 165, 32, 0.3)", 
        borderRadius: "24px",
        backgroundColor: "#060606",
        maxWidth: "900px",
        margin: "0 auto",
        boxSizing: "border-box"
      }}>
        <div style={{ textAlign: "center", borderBottom: "1px solid rgba(218, 165, 32, 0.2)", paddingBottom: "25px" }}>
          <img src="/images/logo.png" alt="Trulink Fiber Logo" style={{ width: "130px", marginBottom: "15px", filter: "drop-shadow(0 0 10px rgba(218,165,32,0.2))" }} />
          <h1 style={{ color: "#DAA520", fontSize: "1.8rem", fontWeight: "700", letterSpacing: "1.5px", margin: "0 0 5px 0" }}>
            REGISTRO CORPORATIVO
          </h1>
          <p style={{ color: "#C0C0C0", fontSize: "0.95rem", margin: 0, letterSpacing: "0.5px" }}>
            Trulink Fiber LLC — Portal de Acceso y Verificación
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ width: "100%" }}>
          <div style={{ 
            display: "flex", 
            justifyContent: "center", 
            gap: "40px", 
            marginBottom: "10px", 
            padding: "16px", 
            backgroundColor: "#0a0a0a", 
            borderRadius: "14px",
            border: "1px solid rgba(218, 165, 32, 0.2)"
          }}>
            <label style={{ display: "flex", alignItems: "center", cursor: "pointer", fontWeight: "500", color: "#DAA520" }}>
              <input type="radio" name="tipo_solicitud" value="Cliente B2B" onChange={handleInputChange} defaultChecked style={{ marginRight: "10px" }} /> Cliente B2B
            </label>
            <label style={{ display: "flex", alignItems: "center", cursor: "pointer", fontWeight: "500", color: "#DAA520" }}>
              <input type="radio" name="tipo_solicitud" value="Inversor Estratégico" onChange={handleInputChange} style={{ marginRight: "10px" }} /> Inversor Estratégico
            </label>
          </div>

          <h3 style={sectionHeaderStyle}>Perfil del Cliente</h3>
          <select name="perfil_cliente" style={selectStyle} onChange={handleInputChange} defaultValue="ISP">
            <option value="ISP">ISP</option>
            <option value="MAYORISTA">MAYORISTA</option>
            <option value="INTEGRADOR">INTEGRADOR</option>
            <option value="CLIENTE FINAL">CLIENTE FINAL</option>
          </select>

          <h3 style={sectionHeaderStyle}>Información de la Empresa</h3>
          <input name="razon_social" type="text" placeholder="Nombre o Razón Social" style={inputStyle} onChange={handleInputChange} required />
          <input name="identificacion_fiscal" type="text" placeholder="Identificación Fiscal (RUC / NIT / EIN)" style={inputStyle} onChange={handleInputChange} required />
          <input name="sitio_web" type="url" placeholder="Sitio Web Corporativo" style={inputStyle} onChange={handleInputChange} />
          <input name="industria" type="text" placeholder="Industria / Sector" style={inputStyle} onChange={handleInputChange} />
          <input name="pais" type="text" placeholder="País" style={inputStyle} onChange={handleInputChange} required />
          <input name="direccion" type="text" placeholder="Dirección de Facturación" style={inputStyle} onChange={handleInputChange} required />

          <h3 style={sectionHeaderStyle}>Información del Contacto</h3>
          <input name="nombre_representante" type="text" placeholder="Nombre Completo del Representante" style={inputStyle} onChange={handleInputChange} required />
          <input name="cargo" type="text" placeholder="Cargo en la Empresa" style={inputStyle} onChange={handleInputChange} />
          <input name="email" type="email" placeholder="Correo Electrónico Corporativo" style={inputStyle} onChange={handleInputChange} required />

          <label style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem", fontWeight: "600", color: "#DAA520" }}>Teléfono de Oficina</label>
          <div style={{ display: "flex", gap: "10px", marginBottom: "18px" }}>
            <select name="codigo_pais_oficina" value={formData.codigo_pais_oficina} onChange={handleInputChange} style={{ ...selectStyle, width: "150px", marginBottom: 0 }}>
              {codigosPaises.map((item) => (
                <option key={item.codigo} value={item.codigo}>{item.pais}</option>
              ))}
            </select>
            <input name="telefono_oficina" type="tel" placeholder="Número de Oficina" value={formData.telefono_oficina} onChange={handleInputChange} style={{ ...inputStyle, marginBottom: 0, flex: 1 }} />
          </div>

          <label style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem", fontWeight: "600", color: "#DAA520" }}>Teléfono Celular / Móvil</label>
          <div style={{ display: "flex", gap: "10px", marginBottom: "18px" }}>
            <select name="codigo_pais_celular" value={formData.codigo_pais_celular} onChange={handleInputChange} style={{ ...selectStyle, width: "150px", marginBottom: 0 }}>
              {codigosPaises.map((item) => (
                <option key={item.codigo} value={item.codigo}>{item.pais}</option>
              ))}
            </select>
            <input name="telefono_celular" type="tel" placeholder="Número Celular" value={formData.telefono_celular} onChange={handleInputChange} style={{ ...inputStyle, marginBottom: 0, flex: 1 }} required />
          </div>

          <h3 style={sectionHeaderStyle}>Documentación de Soporte (Múltiples Archivos)</h3>
          <div style={{ ...inputStyle, padding: "12px", display: "flex", alignItems: "center", backgroundColor: "#0a0a0a" }}>
            <input 
              type="file" 
              multiple 
              onChange={handleFileChange} 
              style={{ 
                color: "#DAA520", 
                width: "100%", 
                background: "transparent", 
                border: "none", 
                outline: "none",
                cursor: "pointer"
              }} 
            />
          </div>
          {selectedFiles.length > 0 && (
            <div style={{ fontSize: "0.85rem", color: "#DAA520", marginBottom: "15px" }}>
              Archivos seleccionados: {selectedFiles.map(f => f.name).join(", ")}
            </div>
          )}
          <ul style={{ fontSize: "0.85rem", color: "#C0C0C0", marginBottom: "25px", paddingLeft: "20px", lineHeight: "1.6" }}>
            <li>Registro Fiscal vigente</li>
            <li>Certificación Legal (últimos 90 días)</li>
            <li>Identificación Oficial o Pasaporte</li>
            <li>Nombramiento de Autoridad Legal</li>
            <li>Acuerdo de Confidencialidad NDA firmado</li>
          </ul>

          <h3 style={sectionHeaderStyle}>Términos y Condiciones</h3>
          <textarea rows={6} style={{ ...inputStyle, resize: "vertical", color: "#C0C0C0", fontSize: "0.9rem", lineHeight: "1.5" }} readOnly>
            El acceso al Portal B2B de Trulink Fiber LLC está sujeto a estricta verificación corporativa. 
            El solicitante se compromete a entregar documentación válida y vigente. 
            El incumplimiento de requisitos legales, fiscales o de confidencialidad será motivo de rechazo inmediato. 
            Toda la información enviada será tratada bajo confidencialidad y protección de datos. 
            El acceso aprobado implica aceptación plena de estas condiciones.
          </textarea>
          
          <div style={{ display: "flex", alignItems: "center", marginBottom: "25px", cursor: "pointer" }}>
            <input 
              type="checkbox" 
              checked={terminosAceptados} 
              onChange={(e) => setTerminosAceptados(e.target.checked)} 
              style={{ marginRight: "12px" }} 
            /> 
            <span style={{ fontSize: "0.95rem", fontWeight: "500", color: "#DAA520" }}>He leído y acepto los Términos y Condiciones</span>
          </div>

          <button 
            type="submit" 
            disabled={cargando} 
            className="action-btn"
            style={{ 
              padding: "16px 30px", 
              fontWeight: "600", 
              borderRadius: "14px", 
              cursor: cargando ? "not-allowed" : "pointer",
              opacity: cargando ? 0.7 : 1,
              width: "100%",
              fontSize: "1rem",
              letterSpacing: "0.5px"
            }}
          >
            {cargando ? "Procesando y subiendo documentos..." : "Enviar Solicitud"}
          </button>
        </form>
      </div>

      <p style={{ marginTop: "35px", fontSize: "0.75rem", color: "rgba(218, 165, 32, 0.7)", textAlign: "center", letterSpacing: "0.5px" }}>
        © 2026 Marca registrada – Derechos reservados – Propiedad de Trulink Fiber LLC
      </p>
    </div>
  );
}