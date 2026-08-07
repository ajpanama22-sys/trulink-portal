import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { getSupabase } from "../lib/supabaseClient";
import { useRequiereCliente } from "../lib/useRequiereCliente";
import { theme } from "../lib/theme";
import { Card, Heading, Button, inputStyle, DataRow } from "../lib/ui";

export default function EspecialesPage() {
  const router = useRouter();
  const supabase = getSupabase();
  const { cargando: cargandoGuard, autorizado } = useRequiereCliente();

  const [referencia, setReferencia] = useState("");
  const [cargandoSesion, setCargandoSesion] = useState(true);

  const [clienteData, setClienteData] = useState<any>(null);
  const [nombreEmpresa, setNombreEmpresa] = useState("");
  const [representante, setRepresentante] = useState("");
  const [mailCliente, setMailCliente] = useState("");
  const [telefonoCliente, setTelefonoCliente] = useState("");

  const [especificaciones, setEspecificaciones] = useState("");
  const [cantidadAprox, setCantidadAprox] = useState("");
  const [fechaRequerida, setFechaRequerida] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);

  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    setReferencia(`ESP-${Date.now().toString().slice(-6)}`);
    cargarCliente();
  }, []);

  const cargarCliente = async () => {
    if (!supabase) { setCargandoSesion(false); return; }

    try {
      let email = "";
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) email = user.email.trim();
      } catch { /* sin sesión de Auth */ }

      if (!email) {
        email =
          sessionStorage.getItem("trulink_usuario_email") ||
          sessionStorage.getItem("userEmail") || "";
      }

      if (email) {
        setMailCliente(email);
        const { data, error } = await supabase
          .from("clientes").select("*").ilike("email", email).maybeSingle();

        if (error) console.error("Error consultando clientes:", error.message);

        if (data) {
          setClienteData(data);
          setNombreEmpresa(data.razon_social || "");
          setRepresentante(data.nombre_representante || "");
          setMailCliente(data.email || email);
          setTelefonoCliente(data.telefono_celular || data.telefono_oficina || "");
        }
      }
    } finally {
      setCargandoSesion(false);
    }
  };

  const subirAdjunto = async (): Promise<string | null> => {
    if (!archivo || !supabase) return null;
    try {
      const ext = archivo.name.split(".").pop();
      const ruta = `adjuntos/${referencia}_especificacion.${ext}`;

      const { error } = await supabase.storage
        .from("documentos")
        .upload(ruta, archivo, { contentType: archivo.type, upsert: true });

      if (error) {
        console.error("Error al subir el adjunto:", error.message);
        return null;
      }

      const { data } = supabase.storage.from("documentos").getPublicUrl(ruta);
      return data?.publicUrl || null;
    } catch (err) {
      console.error("Excepción al subir adjunto:", err);
      return null;
    }
  };

  /**
   * Avisa al equipo comercial que llegó una solicitud nueva, reusando
   * /api/notificar con el mismo segmento "equipo" que usa el Centro de
   * Notificaciones (notificaciones.tsx). Si esto falla, NO debe frenar
   * la solicitud del cliente — el registro en quotes ya quedó guardado,
   * que es lo que realmente importa. El admin igual la va a ver en el
   * panel de Cotizaciones -> Pedido Especial.
   */
  const notificarEquipo = async (empresaDestino: string, emailDestino: string) => {
    if (!supabase) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        console.error("No hay sesión activa; no se pudo notificar al equipo (la solicitud sí quedó guardada).");
        return;
      }

      const res = await fetch("/api/notificar-pedido-especial", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          referencia,
          empresa: empresaDestino,
          email: emailDestino,
          especificaciones,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error("No se pudo notificar al equipo (la solicitud sí quedó guardada):", data?.error);
      }
    } catch (err) {
      console.error("No se pudo notificar al equipo (la solicitud sí quedó guardada):", err);
    }
  };

  const enviarSolicitud = async () => {
    if (!especificaciones.trim() && !archivo) {
      return alert("Describe lo que necesitas o adjunta un archivo con las especificaciones.");
    }
    if (!supabase) return alert("No se pudo conectar. Intenta de nuevo.");

    setEnviando(true);
    try {
      const adjuntoUrl = await subirAdjunto();

      const fechaEstimada = new Date();
      fechaEstimada.setDate(fechaEstimada.getDate() + 15);

      const payload = {
        referencia,
        total: 0,
        items: [],
        status: "pendiente_cotizar",
        type: "especiales",
        empresa: clienteData?.razon_social || nombreEmpresa || null,
        representante: clienteData?.nombre_representante || representante || null,
        email: clienteData?.email || mailCliente,
        telefono_celular: clienteData?.telefono_celular || telefonoCliente || null,
        fecha_estimada_entrega: fechaRequerida || fechaEstimada.toISOString().slice(0, 10),
        especificaciones_texto: especificaciones || null,
        archivo_adjunto_url: adjuntoUrl,
        cantidad_aproximada: cantidadAprox || null,
      };

      const { error } = await supabase.from("quotes").insert([payload]);
      if (error) throw error;

      // Avisa al equipo comercial — best-effort, no bloquea el flujo del cliente
      await notificarEquipo(
        clienteData?.razon_social || nombreEmpresa || mailCliente,
        clienteData?.email || mailCliente
      );

      setEnviado(true);
    } catch (err: any) {
      console.error("Error al enviar la solicitud:", err);
      alert("No se pudo enviar la solicitud: " + (err.message || err));
    } finally {
      setEnviando(false);
    }
  };

  if (cargandoGuard) {
    return <p style={{ color: "#DAA520", textAlign: "center", marginTop: "60px" }}>Verificando acceso...</p>;
  }
  if (!autorizado) return null;

  if (enviado) {
    return (
      <div style={contenedor}>
        <div style={{ maxWidth: "560px", margin: "0 auto", textAlign: "center", paddingTop: "80px" }}>
          <div style={{ fontSize: "3rem", marginBottom: "20px" }}>✓</div>
          <h1 style={{ color: theme.green, fontSize: "1.4rem", letterSpacing: "1px", marginBottom: "14px" }}>
            Solicitud Recibida
          </h1>
          <p style={{ color: theme.textMuted, fontSize: "0.92rem", lineHeight: 1.7, marginBottom: "10px" }}>
            Tu referencia es <strong style={{ color: theme.gold }}>{referencia}</strong>
          </p>
          <p style={{ color: "#888", fontSize: "0.85rem", lineHeight: 1.7, marginBottom: "32px" }}>
            Nuestro equipo técnico va a revisar tus especificaciones y te enviará
            la cotización por correo. Puedes seguir el avance desde Control de Pedidos.
          </p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            <Button variant="gold" onClick={() => router.push("/seguimiento")}>
              Ver mis pedidos
            </Button>
            <Button variant="outline-gold" onClick={() => router.push("/portal-cliente")}>
              Volver al portal
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={contenedor}>
      <div style={{ maxWidth: "820px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px", flexWrap: "wrap", gap: "12px" }}>
          <Button variant="outline-gold" onClick={() => router.push("/portal-cliente")}>
            ← Volver al Portal
          </Button>
          <span style={{ color: "#888", fontSize: "0.82rem" }}>
            Referencia: <strong style={{ color: theme.gold }}>{referencia}</strong>
          </span>
        </div>

        <div style={{ textAlign: "center", marginBottom: "35px" }}>
          <h1 style={{ color: theme.gold, fontSize: "1.5rem", letterSpacing: "2px", textTransform: "uppercase", margin: "0 0 10px 0", fontWeight: 400 }}>
            Pedidos Especiales
          </h1>
          <div style={{ width: "60px", height: "2px", background: theme.gold, margin: "0 auto 14px auto", opacity: 0.6 }} />
          <p style={{ color: "#888", fontSize: "0.88rem", margin: 0, lineHeight: 1.6 }}>
            Cuéntanos qué necesitas y te preparamos una cotización a la medida.
          </p>
        </div>

        <Card style={{ marginBottom: "22px" }}>
          <Heading>Tus Datos</Heading>
          {cargandoSesion ? (
            <p style={{ color: "#888", fontSize: "0.85rem", margin: 0 }}>Cargando...</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
              <DataRow label="Empresa" valor={nombreEmpresa || "No registrada"} />
              <DataRow label="Representante" valor={representante || "No registrado"} />
              <DataRow label="Correo" valor={mailCliente || "No registrado"} />
              <DataRow label="Teléfono" valor={telefonoCliente || "No registrado"} />
            </div>
          )}
        </Card>

        <Card style={{ marginBottom: "22px" }}>
          <Heading>Qué Necesitas</Heading>
          <p style={{ color: "#777", fontSize: "0.78rem", margin: "0 0 16px 0", lineHeight: 1.6 }}>
            Mientras más detalle nos des, más precisa será la cotización.
            Tipo de cable, cantidad de hilos, longitud, condiciones de instalación, normas que debe cumplir.
          </p>

          <label style={labelStyle}>Descripción del requerimiento</label>
          <textarea
            value={especificaciones}
            onChange={(e) => setEspecificaciones(e.target.value)}
            placeholder="Ej: Necesito 5 km de cable ADSS de 48 hilos para vanos de 200 metros, con cubierta anti-tracking para línea de alta tensión..."
            rows={6}
            style={{ ...inputStyle, width: "100%", resize: "vertical", marginBottom: "16px", boxSizing: "border-box" }}
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <label style={labelStyle}>Cantidad aproximada</label>
              <input
                style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
                placeholder="Ej: 5 km, 10 carretes..."
                value={cantidadAprox} onChange={(e) => setCantidadAprox(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>¿Para cuándo lo necesitas?</label>
              <input
                style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
                type="date"
                value={fechaRequerida} onChange={(e) => setFechaRequerida(e.target.value)} />
            </div>
          </div>
        </Card>

        <Card style={{ marginBottom: "26px" }}>
          <Heading>Documentos Técnicos</Heading>
          <p style={{ color: "#777", fontSize: "0.78rem", margin: "0 0 16px 0" }}>
            Opcional. Planos, fichas técnicas, pliegos de licitación o cualquier especificación en archivo.
          </p>

          <input type="file" id="espArchivo" style={{ display: "none" }}
            onChange={(e) => { if (e.target.files?.[0]) setArchivo(e.target.files[0]); }} />
          <label htmlFor="espArchivo">
            <Button variant="outline-gold" style={{ display: "inline-block" }}>
              {archivo ? `📎 ${archivo.name}` : "📎 Adjuntar archivo"}
            </Button>
          </label>
          {archivo && (
            <Button variant="ghost" onClick={() => setArchivo(null)} style={{ color: theme.red, marginLeft: "12px" }}>
              Quitar
            </Button>
          )}
        </Card>

        <div style={{ background: theme.goldSoft, border: `1px dashed ${theme.borderGoldInput}`,
          borderRadius: theme.radiusMd, padding: "16px 20px", marginBottom: "24px" }}>
          <p style={{ color: "#999", fontSize: "0.8rem", margin: 0, lineHeight: 1.6 }}>
            📌 Este es un <strong style={{ color: theme.gold }}>pedido a la medida</strong>, así que no lleva precio
            todavía. Nuestro equipo revisa tus especificaciones y te envía la cotización por correo.
          </p>
        </div>

        <div style={{ textAlign: "center" }}>
          <Button variant="gold" onClick={enviarSolicitud} disabled={enviando || cargandoSesion}
            style={{ padding: "14px 40px", fontSize: "0.9rem" }}>
            {enviando ? "Enviando..." : "Enviar Solicitud"}
          </Button>
        </div>

        <p style={{ textAlign: "center", color: "rgba(218,165,32,0.4)", fontSize: "0.74rem", marginTop: "40px", letterSpacing: "1px" }}>
          © 2026 Trulink Fiber LLC — Excelencia y Vanguardia Tecnológica
        </p>
      </div>
    </div>
  );
}

const contenedor: React.CSSProperties = {
  backgroundColor: theme.background,
  color: theme.gold,
  minHeight: "100vh",
  padding: "40px 20px",
  fontFamily: theme.fontFamily,
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.7rem",
  color: theme.textMuted,
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: "0.8px",
};