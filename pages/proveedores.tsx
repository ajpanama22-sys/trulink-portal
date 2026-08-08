import { useState } from "react";
import { getSupabase } from "../lib/supabaseClient";
import { uploadAndLinkDocument } from "../services/documentService";
import { theme } from "../lib/theme";
import { Card, Heading, Button, inputStyle } from "../lib/ui";
import { useI18n } from "../lib/i18n/LanguageContext";
import LanguageSwitcher from "../components/LanguageSwitcher";

// Forzamos a Next.js a no intentar pre-renderizar esta página durante el build
export const dynamic = 'force-dynamic';

/* ============================================================
   REGISTRO Y HOMOLOGACIÓN DE PROVEEDORES — CONVENIO MARCO
   ------------------------------------------------------------
   Reemplaza el antiguo /inversores. El proveedor NO queda activo
   automáticamente: entra con estado_homologacion = 'Pendiente' y
   el equipo interno lo homologa desde el panel admin (pestaña
   "Homologación" dentro de Proveedores.tsx).
   ============================================================ */

export default function ProveedoresRegistro() {
  const { t } = useI18n();

  const TIPOS_INSUMO = [
    t("proveedores.tiposInsumo.cables"),
    t("proveedores.tiposInsumo.herrajes"),
    t("proveedores.tiposInsumo.accesorios"),
    t("proveedores.tiposInsumo.herramientas"),
    t("proveedores.tiposInsumo.empaque"),
    t("proveedores.tiposInsumo.otro"),
  ];

  const [formData, setFormData] = useState({
    nombre: "",
    ruc: "",
    pais: "",
    direccion: "",
    website: "",
    contacto: "",
    cargo: "",
    correo: "",
    telefono: "",
    tipo_insumo: TIPOS_INSUMO[0],
    condiciones_pago: "",
  });

  const [files, setFiles] = useState<{
    iso: File | null;
    ficha_tecnica: File | null;
    estados_financieros: File | null;
    licencia_fabricacion: File | null;
  }>({
    iso: null,
    ficha_tecnica: null,
    estados_financieros: null,
    licencia_fabricacion: null,
  });

  const [cargando, setCargando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, files: inputFiles } = e.target as HTMLInputElement;
    if (inputFiles) {
      setFiles((prev) => ({ ...prev, [name]: inputFiles[0] }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!files.iso || !files.ficha_tecnica) {
      alert(t("proveedores.errFiles"));
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      alert(t("proveedores.errConfig"));
      return;
    }

    setCargando(true);
    try {
      // 1. Crear el proveedor en estado Pendiente (no activo, no homologado).
      // Generamos el id acá mismo (en vez de pedirle a Postgres que lo
      // devuelva con RETURNING/.select()), porque un visitante sin sesión
      // no tiene permiso de SELECT sobre la fila que acaba de insertar.
      const proveedorId = crypto.randomUUID();

      const { error: dbError } = await supabase
        .from("proveedores")
        .insert([{
          id: proveedorId,
          nombre: formData.nombre,
          ruc: formData.ruc,
          pais: formData.pais,
          direccion: formData.direccion,
          contacto: formData.contacto,
          email: formData.correo,
          telefono: formData.telefono,
          tipo_insumo: formData.tipo_insumo,
          condiciones_pago: formData.condiciones_pago || null,
          estado: "Pendiente",
          estado_homologacion: "Pendiente",
          descripcion: formData.website ? `Sitio web: ${formData.website}. Cargo del contacto: ${formData.cargo}` : `Cargo del contacto: ${formData.cargo}`,
        }]);

      if (dbError) throw dbError;

      // 2. Subir documentos de homologación (reutiliza el servicio existente)
      await uploadAndLinkDocument(files.iso, "proveedores/iso", proveedorId, "proveedores");
      await uploadAndLinkDocument(files.ficha_tecnica, "proveedores/ficha-tecnica", proveedorId, "proveedores");
      if (files.estados_financieros) {
        await uploadAndLinkDocument(files.estados_financieros, "proveedores/estados-financieros", proveedorId, "proveedores");
      }
      if (files.licencia_fabricacion) {
        await uploadAndLinkDocument(files.licencia_fabricacion, "proveedores/licencia-fabricacion", proveedorId, "proveedores");
      }

      setEnviado(true);
    } catch (error: any) {
      alert(t("proveedores.errSubmit") + error.message);
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
      `}</style>

      <div style={{ position: "absolute", top: "18px", right: "18px", zIndex: 2 }}>
        <LanguageSwitcher />
      </div>

      <div style={{ maxWidth: "820px", margin: "0 auto" }}>
        <Card style={{ padding: "40px", borderRadius: "30px" }}>
          <div style={{ textAlign: "center", marginBottom: "30px" }}>
            <img src="/images/logo.png" alt="Trulink Fiber Logo" style={{ width: "150px" }} />
            <Heading style={{ fontSize: "1.6rem", textAlign: "center" }}>
              {t("proveedores.pageTitle")}
            </Heading>
            <p style={{ color: theme.textLight, maxWidth: "560px", margin: "10px auto 0" }}>
              {t("proveedores.intro")}
            </p>
          </div>

          {enviado ? (
            <div style={{ textAlign: "center", padding: "30px 10px" }}>
              <h3 style={{ color: theme.green || "#2ecc71" }}>{t("proveedores.sentTitle")}</h3>
              <p style={{ color: theme.textLight }}>
                {t("proveedores.sentBody")}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column" }}>
              <p style={{ color: theme.gold, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px" }}>
                {t("proveedores.sectionCompany")}
              </p>
              <input type="text" name="nombre" placeholder={t("proveedores.nombre")} style={fieldStyle} onChange={handleChange} required />
              <input type="text" name="ruc" placeholder={t("proveedores.ruc")} style={fieldStyle} onChange={handleChange} required />
              <input type="text" name="pais" placeholder={t("proveedores.pais")} style={fieldStyle} onChange={handleChange} required />
              <input type="text" name="direccion" placeholder={t("proveedores.direccion")} style={fieldStyle} onChange={handleChange} />
              <input type="url" name="website" placeholder={t("proveedores.website")} style={fieldStyle} onChange={handleChange} />

              <select name="tipo_insumo" style={fieldStyle} onChange={handleChange} value={formData.tipo_insumo}>
                {TIPOS_INSUMO.map((opcion) => <option key={opcion} value={opcion}>{opcion}</option>)}
              </select>

              <p style={{ color: theme.gold, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.5px", margin: "10px 0" }}>
                {t("proveedores.sectionContact")}
              </p>
              <input type="text" name="contacto" placeholder={t("proveedores.contacto")} style={fieldStyle} onChange={handleChange} required />
              <input type="text" name="cargo" placeholder={t("proveedores.cargo")} style={fieldStyle} onChange={handleChange} required />
              <input type="email" name="correo" placeholder={t("proveedores.correo")} style={fieldStyle} onChange={handleChange} required />
              <input type="tel" name="telefono" placeholder={t("proveedores.telefono")} style={fieldStyle} onChange={handleChange} required />
              <textarea name="condiciones_pago" placeholder={t("proveedores.condicionesPago")}
                style={{ ...fieldStyle, resize: "vertical" }} rows={2} onChange={handleChange} />

              <p style={{ color: theme.gold, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.5px", margin: "10px 0" }}>
                {t("proveedores.sectionDocs")}
              </p>
              <label style={{ color: theme.gold, marginBottom: "6px", fontSize: "0.85rem" }}>{t("proveedores.docIso")}</label>
              <input type="file" name="iso" accept="application/pdf" style={fieldStyle} onChange={handleChange} required />

              <label style={{ color: theme.gold, marginBottom: "6px", fontSize: "0.85rem" }}>{t("proveedores.docFicha")}</label>
              <input type="file" name="ficha_tecnica" accept="application/pdf" style={fieldStyle} onChange={handleChange} required />

              <label style={{ color: theme.gold, marginBottom: "6px", fontSize: "0.85rem" }}>{t("proveedores.docFinanciero")}</label>
              <input type="file" name="estados_financieros" accept="application/pdf" style={fieldStyle} onChange={handleChange} />

              <label style={{ color: theme.gold, marginBottom: "6px", fontSize: "0.85rem" }}>{t("proveedores.docLicencia")}</label>
              <input type="file" name="licencia_fabricacion" accept="application/pdf" style={fieldStyle} onChange={handleChange} />

              <div style={{ marginTop: "20px", alignSelf: "center" }}>
                <Button type="submit" variant="gold" disabled={cargando}>
                  {cargando ? t("proveedores.btnSubmitting") : t("proveedores.btnSubmit")}
                </Button>
              </div>
            </form>
          )}
        </Card>
      </div>

      <p style={{ marginTop: "40px", fontSize: "12px", color: theme.gold, textAlign: "center" }}>
        {t("common.companyFooter")}
      </p>
    </div>
  );
}
