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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [terminosAceptados, setTerminosAceptados] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!terminosAceptados) {
      alert("Debe leer y aceptar los Términos y Condiciones para continuar.");
      return;
    }

    if (!selectedFile) {
      alert("Por favor, adjunta un documento de soporte.");
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      alert("Error: Configuración de cliente no disponible.");
      return;
    }

    setCargando(true);

    try {
      // Combinamos el código de país con el número telefónico para un almacenamiento limpio
      const telefonoOficinaCompleto = `${formData.codigo_pais_oficina} ${formData.telefono_oficina}`.trim();
      const telefonoCelularCompleto = `${formData.codigo_pais_celular} ${formData.telefono_celular}`.trim();

      const datosCompletosConTelefonos = {
        ...formData,
        telefono_oficina: telefonoOficinaCompleto,
        telefono_celular: telefonoCelularCompleto
      };

      // 1. Insertar primero en la base de datos para obtener un ID
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

      // 2. Subir archivo y amarrarlo usando el servicio y el ID recién creado
      const categoria = formData.tipo_solicitud === "Cliente B2B" ? "b2b" : "inversores";
      await uploadAndLinkDocument(selectedFile, categoria, insertData.id, "solicitudes_acceso");

      alert("Solicitud y documentos enviados con éxito.");
    } catch (error: any) {
      alert("Error al procesar la solicitud: " + error.message);
    } finally {
      setCargando(false);
    }
  };

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

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: "pointer",
  };

  const focusEffect = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.target.style.boxShadow = "0 0 15px #DAA520";
    e.target.style.borderColor = "#FFF";
  };

  const blurEffect = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.target.style.boxShadow = "none";
    e.target.style.borderColor = "#DAA520";
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
        display: "flex", 
        gap: "40px", 
        padding: "40px", 
        border: "2px solid #DAA520", 
        borderRadius: "30px",
        backgroundColor: "#050505",
        maxWidth: "1000px",
        margin: "0 auto"
      }}>
        <div style={{ flex: 1, textAlign: "center" }}>
          <img src="/images/logo.png" alt="Trulink Fiber Logo" style={{ width: "180px", marginBottom: "20px" }} />
          <h2 style={{ color: "#DAA520" }}>Trulink Fiber LLC</h2>
        </div>

        <form onSubmit={handleSubmit} style={{ flex: 2 }}>
          <h2 style={{ color: "#DAA520", marginBottom: "20px" }}>REGISTRO CORPORATIVO</h2>

          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "5px" }}>
              <input type="radio" name="tipo_solicitud" value="Cliente B2B" onChange={handleInputChange} defaultChecked style={{ marginRight: "10px" }} /> Cliente B2B
            </label>
            <label style={{ display: "block" }}>
              <input type="radio" name="tipo_solicitud" value="Inversor Estratégico" onChange={handleInputChange} style={{ marginRight: "10px" }} /> Inversor Estratégico
            </label>
          </div>

          <h3 style={{ color: "#DAA520" }}>Perfil del Cliente</h3>
          <select name="perfil_cliente" style={selectStyle} onFocus={focusEffect} onBlur={blurEffect} onChange={handleInputChange} defaultValue="ISP">
            <option value="ISP">ISP</option>
            <option value="MAYORISTA">MAYORISTA</option>
            <option value="INTEGRADOR">INTEGRADOR</option>
            <option value="CLIENTE FINAL">CLIENTE FINAL</option>
          </select>

          <h3 style={{ color: "#DAA520" }}>Información de la Empresa</h3>
          <input name="razon_social" type="text" placeholder="Nombre o Razón Social" style={inputStyle} onFocus={focusEffect} onBlur={blurEffect} onChange={handleInputChange} required />
          <input name="identificacion_fiscal" type="text" placeholder="Identificación Fiscal (RUC / NIT / EIN)" style={inputStyle} onFocus={focusEffect} onBlur={blurEffect} onChange={handleInputChange} required />
          <input name="sitio_web" type="url" placeholder="Sitio Web Corporativo" style={inputStyle} onFocus={focusEffect} onBlur={blurEffect} onChange={handleInputChange} />
          <input name="industria" type="text" placeholder="Industria / Sector" style={inputStyle} onFocus={focusEffect} onBlur={blurEffect} onChange={handleInputChange} />
          <input name="pais" type="text" placeholder="País" style={inputStyle} onFocus={focusEffect} onBlur={blurEffect} onChange={handleInputChange} required />
          <input name="direccion" type="text" placeholder="Dirección de Facturación" style={inputStyle} onFocus={focusEffect} onBlur={blurEffect} onChange={handleInputChange} required />

          <h3 style={{ color: "#DAA520" }}>Información del Contacto</h3>
          <input name="nombre_representante" type="text" placeholder="Nombre Completo del Representante" style={inputStyle} onFocus={focusEffect} onBlur={blurEffect} onChange={handleInputChange} required />
          <input name="cargo" type="text" placeholder="Cargo en la Empresa" style={inputStyle} onFocus={focusEffect} onBlur={blurEffect} onChange={handleInputChange} />
          <input name="email" type="email" placeholder="Correo Electrónico Corporativo" style={inputStyle} onFocus={focusEffect} onBlur={blurEffect} onChange={handleInputChange} required />

          {/* Teléfono de Oficina con Código de País */}
          <label style={{ display: "block", marginBottom: "5px", fontSize: "14px", color: "#DAA520" }}>Teléfono de Oficina</label>
          <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
            <select name="codigo_pais_oficina" value={formData.codigo_pais_oficina} onChange={handleInputChange} style={{ ...selectStyle, width: "140px", marginBottom: 0 }} onFocus={focusEffect} onBlur={blurEffect}>
              {codigosPaises.map((item) => (
                <option key={item.codigo} value={item.codigo}>{item.pais}</option>
              ))}
            </select>
            <input name="telefono_oficina" type="tel" placeholder="Número de Oficina" value={formData.telefono_oficina} onChange={handleInputChange} style={{ ...inputStyle, marginBottom: 0, flex: 1 }} onFocus={focusEffect} onBlur={blurEffect} />
          </div>

          {/* Teléfono Celular con Código de País */}
          <label style={{ display: "block", marginBottom: "5px", fontSize: "14px", color: "#DAA520" }}>Teléfono Celular / Móvil</label>
          <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
            <select name="codigo_pais_celular" value={formData.codigo_pais_celular} onChange={handleInputChange} style={{ ...selectStyle, width: "140px", marginBottom: 0 }} onFocus={focusEffect} onBlur={blurEffect}>
              {codigosPaises.map((item) => (
                <option key={item.codigo} value={item.codigo}>{item.pais}</option>
              ))}
            </select>
            <input name="telefono_celular" type="tel" placeholder="Número Celular" value={formData.telefono_celular} onChange={handleInputChange} style={{ ...inputStyle, marginBottom: 0, flex: 1 }} onFocus={focusEffect} onBlur={blurEffect} required />
          </div>

          <h3 style={{ color: "#DAA520" }}>Documentación de Soporte</h3>
          <input type="file" onChange={handleFileChange} style={{ ...inputStyle, padding: "10px" }} />
          <ul style={{ fontSize: "12px", color: "#DAA520", marginBottom: "20px" }}>
            <li>Registro Fiscal vigente</li>
            <li>Certificación Legal (últimos 90 días)</li>
            <li>Identificación Oficial o Pasaporte</li>
            <li>Nombramiento de Autoridad Legal</li>
            <li>Acuerdo de Confidencialidad NDA firmado</li>
          </ul>

          <h3 style={{ color: "#DAA520" }}>Términos y Condiciones</h3>
          <textarea rows={6} style={inputStyle} onFocus={focusEffect} onBlur={blurEffect} readOnly>
            El acceso al Portal B2B de Trulink Fiber LLC está sujeto a estricta verificación corporativa. 
            El solicitante se compromete a entregar documentación válida y vigente. 
            El incumplimiento de requisitos legales, fiscales o de confidencialidad será motivo de rechazo inmediato. 
            Toda la información enviada será tratada bajo confidencialidad y protección de datos. 
            El acceso aprobado implica aceptación plena de estas condiciones.
          </textarea>
          
          <div style={{ marginBottom: "20px" }}>
            <input 
              type="checkbox" 
              checked={terminosAceptados} 
              onChange={(e) => setTerminosAceptados(e.target.checked)} 
              style={{ marginRight: "10px" }} 
            /> 
            He leído y acepto los Términos y Condiciones
          </div>

          <button type="submit" disabled={cargando} style={{ 
            backgroundColor: "#DAA520", 
            color: "#000", 
            padding: "15px 30px", 
            border: "none", 
            fontWeight: "bold", 
            borderRadius: "15px", 
            cursor: "pointer",
            width: "100%",
            fontSize: "16px",
            transition: "transform 0.2s"
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.02)"}
          onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
          >
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