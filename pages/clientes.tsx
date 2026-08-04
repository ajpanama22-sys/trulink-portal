import { useState } from "react";
import type { CSSProperties } from "react";
import { getSupabase } from "../lib/supabaseClient";
import { theme } from "../lib/theme";
import { Card, Heading, Button, inputStyle } from "../lib/ui";

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
      const filesArray = Array.from(e.target.files);
      for (const file of filesArray) {
        if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
          alert("Restricción del sistema: Solo se permiten archivos en formato PDF.");
          e.target.value = "";
          return;
        }
      }
      setSelectedFiles(filesArray);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminosAceptados) {
      alert("Debe leer y aceptar los Términos y Condiciones para continuar.");
      return;
    }
    if (selectedFiles.length === 0) {
      alert("Por favor, adjunta al menos un documento PDF de soporte.");
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
      const tempId = crypto.randomUUID();
      let rutasArchivos: string[] = [];
      const categoria = formData.tipo_solicitud === "Cliente B2B" ? "b2b" : "inversores";

      for (const file of selectedFiles) {
        const timestamp = Date.now();
        const limpiarNombre = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
        const filePath = `${categoria}/${tempId}_${timestamp}_${limpiarNombre}`;

        const { error: uploadError } = await supabase.storage
          .from("registros")
          .upload(filePath, file, { upsert: true });

        if (uploadError) {
          console.error("Error al subir archivo:", uploadError);
          continue;
        }

        const { data: publicUrlData } = supabase.storage
          .from("registros")
          .getPublicUrl(filePath);

        if (publicUrlData?.publicUrl) {
          rutasArchivos.push(publicUrlData.publicUrl);
        }
      }

      if (rutasArchivos.length === 0) {
        throw new Error("No se pudo completar la subida de los archivos al Storage.");
      }

      const { error: dbError } = await supabase
        .from("solicitudes_acceso")
        .insert([{
          tipo_solicitud: formData.tipo_solicitud,
          perfil_cliente: formData.perfil_cliente,
          razon_social: formData.razon_social,
          identificacion_fiscal: formData.identificacion_fiscal,
          sitio_web: formData.sitio_web,
          industria: formData.industria,
          pais: formData.pais,
          direccion: formData.direccion,
          nombre_representante: formData.nombre_representante,
          cargo: formData.cargo,
          email: formData.email,
          telefono_oficina: telefonoOficinaCompleto,
          telefono_celular: telefonoCelularCompleto,
          status: "pendiente",
          documento_url: rutasArchivos
        }]);

      if (dbError) throw dbError;

      alert("¡Solicitud y documentos PDF enviados con éxito de forma automática!");
      window.location.reload();
    } catch (error: any) {
      alert("Error al procesar la solicitud: " + error.message);
    } finally {
      setCargando(false);
    }
  };

  const fieldStyle: CSSProperties = {
    ...inputStyle,
    width: "100%",
    marginBottom: "18px",
    boxSizing: "border-box",
  };

  const selectFieldStyle: CSSProperties = {
    ...fieldStyle,
    cursor: "pointer",
  };

  return (
    <div style={{
      backgroundColor: theme.background,
      color: theme.gold,
      minHeight: "100vh",
      padding: "40px 20px",
      fontFamily: theme.fontFamily,
      boxSizing: "border-box",
      width: "100%"
    }}>
      <style jsx global>{`
        html, body {
          margin: 0;
          padding: 0;
          background-color: ${theme.background} !important;
          color: ${theme.gold};
        }
        input:focus, select:focus, textarea:focus {
          border-color: ${theme.gold} !important;
          box-shadow: 0 0 12px rgba(218, 165, 32, 0.3), inset 0 1px 3px rgba(0,0,0,0.8) !important;
        }
        input[type="radio"], input[type="checkbox"] {
          accent-color: ${theme.gold};
          cursor: pointer;
          transform: scale(1.1);
        }
      `}</style>

      <Card style={{ maxWidth: "900px", margin: "0 auto" }}>
        <div style={{ textAlign: "center", borderBottom: `1px solid ${theme.borderGoldLight}`, paddingBottom: "25px", marginBottom: "20px" }}>
          <img src="/images/logo.png" alt="Trulink Fiber Logo" style={{ width: "130px", marginBottom: "15px", filter: "drop-shadow(0 0 10px rgba(218,165,32,0.2))" }} />
          <h1 style={{ color: theme.gold, fontSize: "1.8rem", fontWeight: 700, letterSpacing: "1.5px", margin: "0 0 5px 0" }}>
            REGISTRO CORPORATIVO
          </h1>
          <p style={{ color: theme.textMuted, fontSize: "0.95rem", margin: 0, letterSpacing: "0.5px" }}>
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
            backgroundColor: theme.inputBg,
            borderRadius: theme.radiusMd,
            border: `1px solid ${theme.borderGoldLight}`
          }}>
            <label style={{ display: "flex", alignItems: "center", cursor: "pointer", fontWeight: 500, color: theme.gold }}>
              <input type="radio" name="tipo_solicitud" value="Cliente B2B" onChange={handleInputChange} defaultChecked style={{ marginRight: "10px" }} /> Cliente B2B
            </label>
            <label style={{ display: "flex", alignItems: "center", cursor: "pointer", fontWeight: 500, color: theme.gold }}>
              <input type="radio" name="tipo_solicitud" value="Inversor Estratégico" onChange={handleInputChange} style={{ marginRight: "10px" }} /> Inversor Estratégico
            </label>
          </div>

          <Heading>Perfil del Cliente</Heading>
          <select name="perfil_cliente" style={selectFieldStyle} onChange={handleInputChange} defaultValue="ISP">
            <option value="ISP">ISP</option>
            <option value="MAYORISTA">MAYORISTA</option>
            <option value="INTEGRADOR">INTEGRADOR</option>
            <option value="CLIENTE FINAL">CLIENTE FINAL</option>
          </select>

          <Heading>Información de la Empresa</Heading>
          <input name="razon_social" type="text" placeholder="Nombre o Razón Social" style={fieldStyle} onChange={handleInputChange} required />
          <input name="identificacion_fiscal" type="text" placeholder="Identificación Fiscal (RUC / NIT / EIN)" style={fieldStyle} onChange={handleInputChange} required />
          <input name="sitio_web" type="url" placeholder="Sitio Web Corporativo" style={fieldStyle} onChange={handleInputChange} />
          <input name="industria" type="text" placeholder="Industria / Sector" style={fieldStyle} onChange={handleInputChange} />
          <input name="pais" type="text" placeholder="País" style={fieldStyle} onChange={handleInputChange} required />
          <input name="direccion" type="text" placeholder="Dirección de Facturación" style={fieldStyle} onChange={handleInputChange} required />

          <Heading>Información del Contacto</Heading>
          <input name="nombre_representante" type="text" placeholder="Nombre Completo del Representante" style={fieldStyle} onChange={handleInputChange} required />
          <input name="cargo" type="text" placeholder="Cargo en la Empresa" style={fieldStyle} onChange={handleInputChange} />
          <input name="email" type="email" placeholder="Correo Electrónico Corporativo" style={fieldStyle} onChange={handleInputChange} required />

          <label style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem", fontWeight: 600, color: theme.gold }}>Teléfono de Oficina</label>
          <div style={{ display: "flex", gap: "10px", marginBottom: "18px" }}>
            <select name="codigo_pais_oficina" value={formData.codigo_pais_oficina} onChange={handleInputChange} style={{ ...selectFieldStyle, width: "150px", marginBottom: 0 }}>
              {codigosPaises.map((item) => (
                <option key={item.codigo} value={item.codigo}>{item.pais}</option>
              ))}
            </select>
            <input name="telefono_oficina" type="tel" placeholder="Número de Oficina" value={formData.telefono_oficina} onChange={handleInputChange} style={{ ...fieldStyle, marginBottom: 0, flex: 1 }} />
          </div>

          <label style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem", fontWeight: 600, color: theme.gold }}>Teléfono Celular / Móvil</label>
          <div style={{ display: "flex", gap: "10px", marginBottom: "18px" }}>
            <select name="codigo_pais_celular" value={formData.codigo_pais_celular} onChange={handleInputChange} style={{ ...selectFieldStyle, width: "150px", marginBottom: 0 }}>
              {codigosPaises.map((item) => (
                <option key={item.codigo} value={item.codigo}>{item.pais}</option>
              ))}
            </select>
            <input name="telefono_celular" type="tel" placeholder="Número Celular" value={formData.telefono_celular} onChange={handleInputChange} style={{ ...fieldStyle, marginBottom: 0, flex: 1 }} required />
          </div>

          <Heading>Documentación de Soporte (Solo Archivos PDF)</Heading>
          <div style={{ ...fieldStyle, padding: "12px", display: "flex", alignItems: "center" }}>
            <input
              type="file"
              multiple
              accept="application/pdf"
              onChange={handleFileChange}
              style={{
                color: theme.gold,
                width: "100%",
                background: "transparent",
                border: "none",
                outline: "none",
                cursor: "pointer"
              }}
            />
          </div>
          {selectedFiles.length > 0 && (
            <div style={{ fontSize: "0.85rem", color: theme.gold, marginBottom: "15px" }}>
              Archivos PDF seleccionados ({selectedFiles.length}): {selectedFiles.map(f => f.name).join(", ")}
            </div>
          )}
          <ul style={{ fontSize: "0.85rem", color: theme.textMuted, marginBottom: "25px", paddingLeft: "20px", lineHeight: "1.6" }}>
            <li><strong style={{ color: theme.gold }}>Nota Obligatoria:</strong> Únicamente se aceptan documentos en formato <strong style={{ color: theme.gold }}>PDF</strong>.</li>
            <li>Registro Fiscal vigente</li>
            <li>Certificación Legal (últimos 90 días)</li>
            <li>Identificación Oficial o Pasaporte</li>
            <li>Nombramiento de Autoridad Legal</li>
            <li>Acuerdo de Confidencialidad NDA firmado</li>
          </ul>

          <Heading>Términos y Condiciones</Heading>
          <textarea rows={6} style={{ ...fieldStyle, resize: "vertical", color: theme.textMuted, fontSize: "0.9rem", lineHeight: "1.5" }} readOnly>
            El acceso al Portal B2B de Trulink Fiber LLC está sujeto a estricta verificación corporativa.
            El solicitante se compromete a entregar documentación válida, vigente y exclusivamente en formato PDF.
            El incumplimiento de requisitos legales, fiscales o de formato será motivo de rechazo inmediato.
            Toda la información enviada será tratada bajo confidencialidad y protección de datos.
            El acceso approved implica aceptación plena de estas condiciones.
          </textarea>

          <div style={{ display: "flex", alignItems: "center", marginBottom: "25px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={terminosAceptados}
              onChange={(e) => setTerminosAceptados(e.target.checked)}
              style={{ marginRight: "12px" }}
            />
            <span style={{ fontSize: "0.95rem", fontWeight: 500, color: theme.gold }}>He leído y acepto los Términos y Condiciones</span>
          </div>

          <Button type="submit" variant="gold" disabled={cargando} style={{ width: "100%", padding: "16px 30px", borderRadius: theme.radiusMd, fontSize: "1rem", letterSpacing: "0.5px" }}>
            {cargando ? "Procesando y subiendo documentos..." : "Enviar Solicitud"}
          </Button>
        </form>
      </Card>

      <p style={{ marginTop: "35px", fontSize: "0.75rem", color: theme.textMuted, textAlign: "center", letterSpacing: "0.5px" }}>
        © 2026 Marca registrada – Derechos reservados – Propiedad de Trulink Fiber LLC
      </p>
    </div>
  );
}
