import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import jsPDF from "jspdf";
import { useRouter } from "next/navigation";

// Inicialización de Supabase (ajusta la ruta de importación si usas un cliente global)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface ItemCotizacion {
  tipo: string;
  hilos: number;
  longitudKm: number;
  cantidad: number;
  precioCarrete: number;
}

export default function EspecialesPage() {
  const router = useRouter();

  // Estados de la sesión y cliente
  const [userId, setUserId] = useState<string | null>(null);
  const [nombreEmpresa, setNombreEmpresa] = useState<string>("");
  const [representante, setRepresentante] = useState<string>("");
  const [mailCliente, setMailCliente] = useState<string>("");
  const [referenciaActual, setReferenciaActual] = useState<string>("");

  // Estados de la cotización y especificaciones
  const [cotizacion, setCotizacion] = useState<ItemCotizacion[]>([]);
  const [especificacionesText, setEspecificacionesText] = useState<string>("");
  const [archivoAdjunto, setArchivoAdjunto] = useState<File | null>(null);
  const [subiendoArchivo, setSubiendoArchivo] = useState<boolean>(false);
  const [granTotal, setGranTotal] = useState<number>(0);

  // Cargar datos del usuario y generar referencia única al montar el componente
  useEffect(() => {
    const inicializarDatos = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        setMailCliente(user.email || "");
        
        // Opcional: Buscar datos adicionales de la empresa del usuario si los tienes en una tabla perfiles
        const { data: perfil } = await supabase
          .from("perfiles")
          .select("empresa, representante")
          .eq("id", user.id)
          .single();

        if (perfil) {
          setNombreEmpresa(perfil.empresa || "");
          setRepresentante(perfil.representante || "");
        }
      }

      // Generar referencia única basada en marca temporal
      const refUnica = `ESP-${Date.now().toString().slice(-6)}`;
      setReferenciaActual(refUnica);
    };

    inicializarDatos();
  }, []);

  // Calcular total cada vez que cambie la cotización
  useEffect(() => {
    const total = cotizacion.reduce((acc, item) => acc + (item.precioCarrete * item.cantidad), 0);
    setGranTotal(total);
  }, [cotizacion]);

  // Simulación de cálculo de fecha de entrega
  const calcularFechaEntrega = () => {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + 15); // 15 días hábiles estimados
    return fecha.toISOString().split("T")[0];
  };

  // Función para generar un PDF básico de respaldo
  const generarDocumentoPDF = () => {
    const doc = new jsPDF();
    doc.setFont("Helvetica", "bold");
    doc.text("Trulink Fiber LLC - Cotización Especial", 14, 20);
    doc.setFont("Helvetica", "normal");
    doc.text(`Referencia: ${referenciaActual}`, 14, 30);
    doc.text(`Empresa: ${nombreEmpresa || "No especificada"}`, 14, 40);
    doc.text(`Representante: ${representante || mailCliente}`, 14, 50);
    doc.text(`Especificaciones: ${especificacionesText || "Ninguna"}`, 14, 60);
    
    let y = 75;
    doc.text("Ítems:", 14, y);
    cotizacion.forEach((item, idx) => {
      y += 10;
      doc.text(`${idx + 1}. Cable ${item.tipo} - ${item.hilos} hilos (${item.longitudKm}km) x ${item.cantidad} = $${item.precioCarrete * item.cantidad}`, 14, y);
    });

    return doc;
  };

  // Subir archivo adjunto a Supabase Storage
  const subirAdjuntoCliente = async (): Promise<string | null> => {
    if (!archivoAdjunto) return null;

    try {
      setSubiendoArchivo(true);
      const fileExt = archivoAdjunto.name.split(".").pop();
      const fileName = `adjuntos/${referenciaActual}_especificacion.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("documentos")
        .upload(fileName, archivoAdjunto, { contentType: archivoAdjunto.type, upsert: true });

      if (uploadError) {
        console.error("Error al subir el archivo del cliente:", uploadError.message);
        return null;
      }

      const { data: publicUrlData } = supabase.storage.from("documentos").getPublicUrl(fileName);
      return publicUrlData?.publicUrl || null;
    } catch (err) {
      console.error("Excepción al subir adjunto:", err);
      return null;
    } finally {
      setSubiendoArchivo(false);
    }
  };

  // Guardar en la tabla 'quotes' de Supabase
  const guardarCotizacionEnSupabase = async (pdfPublicUrl: string, adjuntoClienteUrl?: string | null) => {
    const itemsFormateados = cotizacion.map(item => ({
      SKU: item.tipo,
      descripcion: `Cable ${item.tipo} - ${item.hilos} hilos (${item.longitudKm}km)`,
      cantidad: item.cantidad,
      precioUnitario: item.precioCarrete,
      total: item.precioCarrete * item.cantidad
    }));

    const payload = {
      user_id: userId,
      referencia: referenciaActual,
      total: granTotal,
      items: itemsFormateados,
      status: "pending",
      type: "especiales",
      pdf_url: pdfPublicUrl,
      empresa: nombreEmpresa,
      representante: representante,
      email: mailCliente,
      fecha_estimada_entrega: calcularFechaEntrega(),
      especificaciones_texto: especificacionesText,
      archivo_adjunto_url: adjuntoClienteUrl || null
    };

    const { data: existente } = await supabase
      .from("quotes")
      .select("id")
      .eq("referencia", referenciaActual)
      .single();

    let resultado;
    if (existente) {
      resultado = await supabase
        .from("quotes")
        .update(payload)
        .eq("referencia", referenciaActual)
        .select()
        .single();
    } else {
      resultado = await supabase
        .from("quotes")
        .insert([payload])
        .select()
        .single();
    }

    if (resultado.error) {
      console.error("ERROR DETALLADO DE SUPABASE:", resultado.error);
      throw new Error(resultado.error.message);
    }
    return resultado.data;
  };

  // Manejador principal de envío (botón o tecla Enter)
  const handleEnviarEspecificacion = async () => {
    if (cotizacion.length === 0 && !especificacionesText && !archivoAdjunto) {
      alert("Por favor agregue ítems o detalles de especificación antes de enviar.");
      return;
    }

    try {
      // 1. Subir adjunto del cliente si existe
      const adjuntoUrl = await subirAdjuntoCliente();

      // 2. Generar PDF y subirlo al bucket
      const doc = generarDocumentoPDF();
      const pdfBlob = doc.output("blob");
      const fileName = `${referenciaActual}.pdf`;

      await supabase.storage
        .from("documentos")
        .upload(fileName, pdfBlob, { contentType: "application/pdf", upsert: true });

      const { data: publicUrlData } = supabase.storage.from("documentos").getPublicUrl(fileName);
      const pdfPublicUrl = publicUrlData?.publicUrl || "";

      // 3. Registrar en base de datos vinculando al cliente y sus adjuntos
      await guardarCotizacionEnSupabase(pdfPublicUrl, adjuntoUrl);

      alert(`Especificaciones enviadas con éxito. Referencia: ${referenciaActual}`);
      router.push(`/checkout?id=${referenciaActual}`);
    } catch (err: any) {
      console.error("ERROR AL ENVIAR:", err);
      alert(`Ocurrió un error al procesar el envío: ${err.message || err}`);
    }
  };

  return (
    <div style={{ backgroundColor: "#000000", color: "#FFFFFF", minHeight: "100vh", padding: "30px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        
        {/* Encabezado */}
        <h1 style={{ color: "#DAA520", borderBottom: "1px solid rgba(218, 165, 32, 0.3)", paddingBottom: "15px", marginBottom: "25px" }}>
          Módulo de Especificaciones Especiales
        </h1>

        {/* Sección de Identificación del Cliente */}
        <div style={{ backgroundColor: "#080808", border: "1px solid rgba(218, 165, 32, 0.3)", borderRadius: "16px", padding: "20px", marginBottom: "25px" }}>
          <h3 style={{ color: "#DAA520", marginTop: 0, fontSize: "1.1rem" }}>Información del Cliente y Referencia</h3>
          <p style={{ color: "#CCCCCC", fontSize: "0.9rem", margin: "5px 0" }}>
            Cliente / Empresa: <strong style={{ color: "#DAA520" }}>{nombreEmpresa || mailCliente || "Cargando..."}</strong>
          </p>
          <p style={{ color: "#CCCCCC", fontSize: "0.9rem", margin: "5px 0" }}>
            Referencia Actual: <strong style={{ color: "#DAA520" }}>{referenciaActual}</strong>
          </p>
        </div>

        {/* Sección de Especificaciones y Adjuntos */}
        <div style={{ backgroundColor: "#080808", border: "1px solid rgba(218, 165, 32, 0.3)", borderRadius: "16px", padding: "20px", marginBottom: "25px" }}>
          <h3 style={{ color: "#DAA520", marginTop: 0, fontSize: "1.1rem" }}>Detalles Técnicos y Requerimientos</h3>
          <p style={{ color: "#888888", fontSize: "0.8rem", marginBottom: "12px" }}>
            Escriba sus especificaciones y presione <strong>Enter</strong> o haga clic en enviar para registrar la cotización en la base de datos.
          </p>

          <textarea
            value={especificacionesText}
            onChange={(e) => setEspecificacionesText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleEnviarEspecificacion();
              }
            }}
            placeholder="Escriba aquí los requerimientos especiales... (Presione Enter para enviar)"
            rows={4}
            style={{
              width: "100%",
              backgroundColor: "#000000",
              color: "#DAA520",
              border: "1px solid rgba(218, 165, 32, 0.4)",
              borderRadius: "8px",
              padding: "12px",
              fontSize: "0.9rem",
              outline: "none",
              boxSizing: "border-box",
              marginBottom: "15px"
            }}
          />

          <div style={{ display: "flex", alignItems: "center", gap: "15px", flexWrap: "wrap" }}>
            <input
              type="file"
              id="fileEspecificacion"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setArchivoAdjunto(e.target.files[0]);
                }
              }}
              style={{ display: "none" }}
            />
            <label
              htmlFor="fileEspecificacion"
              style={{
                backgroundColor: "#111111",
                color: "#DAA520",
                border: "1px solid #DAA520",
                padding: "10px 18px",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "0.85rem",
                fontWeight: "bold"
              }}
            >
              {archivoAdjunto ? `📎 ${archivoAdjunto.name}` : "📎 Adjuntar Archivo Técnico"}
            </label>

            <button
              onClick={handleEnviarEspecificacion}
              disabled={subiendoArchivo}
              style={{
                backgroundColor: "#DAA520",
                color: "#000000",
                border: "none",
                padding: "10px 22px",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "0.85rem",
                fontWeight: "bold",
                marginLeft: "auto"
              }}
            >
              {subiendoArchivo ? "Procesando..." : "Enviar Cotización Especial"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}