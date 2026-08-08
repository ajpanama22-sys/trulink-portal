import { useState } from "react";
import type { CSSProperties } from "react";
import { getSupabase } from "../lib/supabaseClient";
import { theme } from "../lib/theme";
import { Card, Heading, Button, inputStyle } from "../lib/ui";
import { useI18n } from "../lib/i18n/LanguageContext";
import LanguageSwitcher from "../components/LanguageSwitcher";

export const dynamic = 'force-dynamic';

const codigosPaises = [
  { codigo: "+507", es: "Panamá (+507)", en: "Panama (+507)" },
  { codigo: "+1", es: "Estados Unidos / Canadá (+1)", en: "United States / Canada (+1)" },
  { codigo: "+52", es: "México (+52)", en: "Mexico (+52)" },
  { codigo: "+57", es: "Colombia (+57)", en: "Colombia (+57)" },
  { codigo: "+54", es: "Argentina (+54)", en: "Argentina (+54)" },
  { codigo: "+55", es: "Brasil (+55)", en: "Brazil (+55)" },
  { codigo: "+56", es: "Chile (+56)", en: "Chile (+56)" },
  { codigo: "+51", es: "Perú (+51)", en: "Peru (+51)" },
  { codigo: "+58", es: "Venezuela (+58)", en: "Venezuela (+58)" },
  { codigo: "+593", es: "Ecuador (+593)", en: "Ecuador (+593)" },
  { codigo: "+34", es: "España (+34)", en: "Spain (+34)" },
  { codigo: "+506", es: "Costa Rica (+506)", en: "Costa Rica (+506)" },
  { codigo: "+503", es: "El Salvador (+503)", en: "El Salvador (+503)" },
  { codigo: "+502", es: "Guatemala (+502)", en: "Guatemala (+502)" },
  { codigo: "+504", es: "Honduras (+504)", en: "Honduras (+504)" },
  { codigo: "+505", es: "Nicaragua (+505)", en: "Nicaragua (+505)" },
  { codigo: "+53", es: "Cuba (+53)", en: "Cuba (+53)" },
  { codigo: "+1-809", es: "República Dominicana (+1 809)", en: "Dominican Republic (+1 809)" },
  { codigo: "+598", es: "Uruguay (+598)", en: "Uruguay (+598)" },
  { codigo: "+595", es: "Paraguay (+595)", en: "Paraguay (+595)" },
  { codigo: "+44", es: "Reino Unido (+44)", en: "United Kingdom (+44)" },
  { codigo: "+33", es: "Francia (+33)", en: "France (+33)" },
  { codigo: "+49", es: "Alemania (+49)", en: "Germany (+49)" },
  { codigo: "+86", es: "China (+86)", en: "China (+86)" },
  { codigo: "+81", es: "Japón (+81)", en: "Japan (+81)" },
];

export default function Clientes() {
  const { t, idioma } = useI18n();

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
          alert(t("clientes.errFileType"));
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
      alert(t("clientes.errTerms"));
      return;
    }
    if (selectedFiles.length === 0) {
      alert(t("clientes.errNoFiles"));
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      alert(t("clientes.errConfig"));
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
        throw new Error(t("clientes.errUploadFail"));
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

      alert(t("clientes.successMsg"));
      window.location.reload();
    } catch (error: any) {
      alert(t("clientes.errSubmit") + error.message);
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

      <div style={{ maxWidth: "900px", margin: "0 auto 14px auto", display: "flex", justifyContent: "flex-end" }}>
        <LanguageSwitcher />
      </div>

      <Card style={{ maxWidth: "900px", margin: "0 auto" }}>
        <div style={{ textAlign: "center", borderBottom: `1px solid ${theme.borderGoldLight}`, paddingBottom: "25px", marginBottom: "20px" }}>
          <img src="/images/logo.png" alt="Trulink Fiber Logo" style={{ width: "130px", marginBottom: "15px", filter: "drop-shadow(0 0 10px rgba(218,165,32,0.2))" }} />
          <h1 style={{ color: theme.gold, fontSize: "1.8rem", fontWeight: 700, letterSpacing: "1.5px", margin: "0 0 5px 0" }}>
            {t("clientes.pageTitle")}
          </h1>
          <p style={{ color: theme.textMuted, fontSize: "0.95rem", margin: 0, letterSpacing: "0.5px" }}>
            {t("clientes.pageSubtitle")}
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
              <input type="radio" name="tipo_solicitud" value="Cliente B2B" onChange={handleInputChange} defaultChecked style={{ marginRight: "10px" }} /> {t("clientes.optionClientB2B")}
            </label>
            <label style={{ display: "flex", alignItems: "center", cursor: "pointer", fontWeight: 500, color: theme.gold }}>
              <input type="radio" name="tipo_solicitud" value="Inversor Estratégico" onChange={handleInputChange} style={{ marginRight: "10px" }} /> {t("clientes.optionInvestor")}
            </label>
          </div>

          <Heading>{t("clientes.sectionProfile")}</Heading>
          <select name="perfil_cliente" style={selectFieldStyle} onChange={handleInputChange} defaultValue="ISP">
            <option value="ISP">{t("clientes.profileISP")}</option>
            <option value="MAYORISTA">{t("clientes.profileWholesale")}</option>
            <option value="INTEGRADOR">{t("clientes.profileIntegrator")}</option>
            <option value="CLIENTE FINAL">{t("clientes.profileFinalClient")}</option>
          </select>

          <Heading>{t("clientes.sectionCompanyInfo")}</Heading>
          <input name="razon_social" type="text" placeholder={t("clientes.razonSocial")} style={fieldStyle} onChange={handleInputChange} required />
          <input name="identificacion_fiscal" type="text" placeholder={t("clientes.identificacionFiscal")} style={fieldStyle} onChange={handleInputChange} required />
          <input name="sitio_web" type="url" placeholder={t("clientes.sitioWeb")} style={fieldStyle} onChange={handleInputChange} />
          <input name="industria" type="text" placeholder={t("clientes.industria")} style={fieldStyle} onChange={handleInputChange} />
          <input name="pais" type="text" placeholder={t("clientes.pais")} style={fieldStyle} onChange={handleInputChange} required />
          <input name="direccion" type="text" placeholder={t("clientes.direccionFacturacion")} style={fieldStyle} onChange={handleInputChange} required />

          <Heading>{t("clientes.sectionContactInfo")}</Heading>
          <input name="nombre_representante" type="text" placeholder={t("clientes.nombreRepresentante")} style={fieldStyle} onChange={handleInputChange} required />
          <input name="cargo" type="text" placeholder={t("clientes.cargo")} style={fieldStyle} onChange={handleInputChange} />
          <input name="email" type="email" placeholder={t("clientes.email")} style={fieldStyle} onChange={handleInputChange} required />

          <label style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem", fontWeight: 600, color: theme.gold }}>{t("clientes.labelTelOficina")}</label>
          <div style={{ display: "flex", gap: "10px", marginBottom: "18px" }}>
            <select name="codigo_pais_oficina" value={formData.codigo_pais_oficina} onChange={handleInputChange} style={{ ...selectFieldStyle, width: "150px", marginBottom: 0 }}>
              {codigosPaises.map((item) => (
                <option key={item.codigo} value={item.codigo}>{idioma === "en" ? item.en : item.es}</option>
              ))}
            </select>
            <input name="telefono_oficina" type="tel" placeholder={t("clientes.placeholderTelOficina")} value={formData.telefono_oficina} onChange={handleInputChange} style={{ ...fieldStyle, marginBottom: 0, flex: 1 }} />
          </div>

          <label style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem", fontWeight: 600, color: theme.gold }}>{t("clientes.labelTelCelular")}</label>
          <div style={{ display: "flex", gap: "10px", marginBottom: "18px" }}>
            <select name="codigo_pais_celular" value={formData.codigo_pais_celular} onChange={handleInputChange} style={{ ...selectFieldStyle, width: "150px", marginBottom: 0 }}>
              {codigosPaises.map((item) => (
                <option key={item.codigo} value={item.codigo}>{idioma === "en" ? item.en : item.es}</option>
              ))}
            </select>
            <input name="telefono_celular" type="tel" placeholder={t("clientes.placeholderTelCelular")} value={formData.telefono_celular} onChange={handleInputChange} style={{ ...fieldStyle, marginBottom: 0, flex: 1 }} required />
          </div>

          <Heading>{t("clientes.sectionDocs")}</Heading>
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
              {t("clientes.filesSelected")} ({selectedFiles.length}): {selectedFiles.map(f => f.name).join(", ")}
            </div>
          )}
          <ul style={{ fontSize: "0.85rem", color: theme.textMuted, marginBottom: "25px", paddingLeft: "20px", lineHeight: "1.6" }}>
            <li><strong style={{ color: theme.gold }}>{t("clientes.docsNoteTitle")}</strong> {t("clientes.docsNote")} <strong style={{ color: theme.gold }}>{t("clientes.docPdf")}</strong>{idioma === "en" ? ` ${t("clientes.docsNoteEnd")}` : "."}</li>
            <li>{t("clientes.docList1")}</li>
            <li>{t("clientes.docList2")}</li>
            <li>{t("clientes.docList3")}</li>
            <li>{t("clientes.docList4")}</li>
            <li>{t("clientes.docList5")}</li>
          </ul>

          <Heading>{t("clientes.sectionTerms")}</Heading>
          <textarea rows={6} style={{ ...fieldStyle, resize: "vertical", color: theme.textMuted, fontSize: "0.9rem", lineHeight: "1.5" }} readOnly value={t("clientes.termsText")} />

          <div style={{ display: "flex", alignItems: "center", marginBottom: "25px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={terminosAceptados}
              onChange={(e) => setTerminosAceptados(e.target.checked)}
              style={{ marginRight: "12px" }}
            />
            <span style={{ fontSize: "0.95rem", fontWeight: 500, color: theme.gold }}>{t("clientes.acceptTerms")}</span>
          </div>

          <Button type="submit" variant="gold" disabled={cargando} style={{ width: "100%", padding: "16px 30px", borderRadius: theme.radiusMd, fontSize: "1rem", letterSpacing: "0.5px" }}>
            {cargando ? t("clientes.btnSubmitting") : t("clientes.btnSubmit")}
          </Button>
        </form>
      </Card>

      <p style={{ marginTop: "35px", fontSize: "0.75rem", color: theme.textMuted, textAlign: "center", letterSpacing: "0.5px" }}>
        {t("common.companyFooter")}
      </p>
    </div>
  );
}
