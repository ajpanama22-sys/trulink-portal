import { useState } from "react";
import { getSupabase } from "../lib/supabaseClient";
import { uploadAndLinkDocument } from "../services/documentService";
import { theme } from "../lib/theme";
import { Card, Heading, Button, inputStyle } from "../lib/ui";

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

const TIPOS_INSUMO = [
  "Cables ADSS / OPGW",
  "Herrajes",
  "Accesorios de fibra",
  "Herramientas",
  "Empaque / Embalaje",
  "Otro",
];

export default function ProveedoresRegistro() {
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
      alert("Por favor, sube al menos la certificación ISO (o equivalente) y la ficha técnica de fábrica.");
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      alert("Error: Configuración de cliente no disponible.");
      return;
    }

    setCargando(true);
    try {
      // 1. Crear el proveedor en estado Pendiente (no activo, no homologado).
      // Generamos el id acá mismo (en vez de pedirle a Postgres que lo
      // devuelva con RETURNING/.select()), porque un visitante sin sesión
      // no tiene permiso de SELECT sobre la fila que acaba de insertar
      // (solo el propio proveedor logueado o el staff pueden leerla) — pedir
      // el RETURNING chocaba con esa policy y Postgres lo reportaba como
      // "violates row-level security policy" aunque el INSERT en sí era válido.
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
      `}</style>

      <div style={{ maxWidth: "820px", margin: "0 auto" }}>
        <Card style={{ padding: "40px", borderRadius: "30px" }}>
          <div style={{ textAlign: "center", marginBottom: "30px" }}>
            <img src="/images/logo.png" alt="Trulink Fiber Logo" style={{ width: "150px" }} />
            <Heading style={{ fontSize: "1.6rem", textAlign: "center" }}>
              Registro de Proveedores — Convenio Marco
            </Heading>
            <p style={{ color: theme.textLight, maxWidth: "560px", margin: "10px auto 0" }}>
              Trulink Fiber opera bajo un modelo de proveedores homologados: una vez aprobado,
              tu fábrica queda dentro del catálogo autorizado para cotizar y recibir órdenes
              de compra directas cuando el volumen lo amerite, con condiciones, precios y
              plazos pactados por adelantado.
            </p>
          </div>

          {enviado ? (
            <div style={{ textAlign: "center", padding: "30px 10px" }}>
              <h3 style={{ color: theme.green || "#2ecc71" }}>Solicitud recibida</h3>
              <p style={{ color: theme.textLight }}>
                Nuestro equipo va a revisar tu documentación y perfil. Te contactaremos por
                correo con el resultado de la homologación y, si es aprobada, tus credenciales
                de acceso al Portal de Proveedores.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column" }}>
              <p style={{ color: theme.gold, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px" }}>
                Datos de la empresa
              </p>
              <input type="text" name="nombre" placeholder="Nombre de la fábrica / empresa" style={fieldStyle} onChange={handleChange} required />
              <input type="text" name="ruc" placeholder="RUC / Tax ID" style={fieldStyle} onChange={handleChange} required />
              <input type="text" name="pais" placeholder="País de origen" style={fieldStyle} onChange={handleChange} required />
              <input type="text" name="direccion" placeholder="Dirección de fábrica" style={fieldStyle} onChange={handleChange} />
              <input type="url" name="website" placeholder="Sitio web corporativo" style={fieldStyle} onChange={handleChange} />

              <select name="tipo_insumo" style={fieldStyle} onChange={handleChange} value={formData.tipo_insumo}>
                {TIPOS_INSUMO.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>

              <p style={{ color: theme.gold, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.5px", margin: "10px 0" }}>
                Contacto comercial
              </p>
              <input type="text" name="contacto" placeholder="Nombre del representante" style={fieldStyle} onChange={handleChange} required />
              <input type="text" name="cargo" placeholder="Cargo" style={fieldStyle} onChange={handleChange} required />
              <input type="email" name="correo" placeholder="Correo corporativo" style={fieldStyle} onChange={handleChange} required />
              <input type="tel" name="telefono" placeholder="Teléfono / WhatsApp" style={fieldStyle} onChange={handleChange} required />
              <textarea name="condiciones_pago" placeholder="Condiciones de pago que propones (ej: 50% anticipo, 50% contra entrega)"
                style={{ ...fieldStyle, resize: "vertical" }} rows={2} onChange={handleChange} />

              <p style={{ color: theme.gold, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.5px", margin: "10px 0" }}>
                Documentación de homologación
              </p>
              <label style={{ color: theme.gold, marginBottom: "6px", fontSize: "0.85rem" }}>Certificación ISO / calidad (PDF) *</label>
              <input type="file" name="iso" accept="application/pdf" style={fieldStyle} onChange={handleChange} required />

              <label style={{ color: theme.gold, marginBottom: "6px", fontSize: "0.85rem" }}>Ficha técnica de fábrica (PDF) *</label>
              <input type="file" name="ficha_tecnica" accept="application/pdf" style={fieldStyle} onChange={handleChange} required />

              <label style={{ color: theme.gold, marginBottom: "6px", fontSize: "0.85rem" }}>Estados financieros (PDF, opcional)</label>
              <input type="file" name="estados_financieros" accept="application/pdf" style={fieldStyle} onChange={handleChange} />

              <label style={{ color: theme.gold, marginBottom: "6px", fontSize: "0.85rem" }}>Licencia de fabricación (PDF, opcional)</label>
              <input type="file" name="licencia_fabricacion" accept="application/pdf" style={fieldStyle} onChange={handleChange} />

              <div style={{ marginTop: "20px", alignSelf: "center" }}>
                <Button type="submit" variant="gold" disabled={cargando}>
                  {cargando ? "Enviando..." : "Enviar Solicitud de Homologación"}
                </Button>
              </div>
            </form>
          )}
        </Card>
      </div>

      <p style={{ marginTop: "40px", fontSize: "12px", color: theme.gold, textAlign: "center" }}>
        © 2026 Marca registrada – Derechos reservados – Propiedad de Trulink Fiber LLC
      </p>
    </div>
  );
}