import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { getSupabase } from "../lib/supabaseClient";

/* ============================================================
   PEDIDOS ESPECIALES — PORTAL DEL CLIENTE
   ------------------------------------------------------------
   Qué estaba roto en la versión anterior:

   1. Enviaba user_id en el payload. quotes tiene una llave
      foránea hacia "profiles", y los usuarios creados vía Auth
      admin no generan fila ahí. Resultado: error 23503 y la
      solicitud NO se guardaba.

   2. Tenía toda la maquinaria de ítems (estado, cálculo de
      total, tabla en el PDF)... pero ninguna interfaz para
      agregarlos. El arreglo siempre estaba vacío: código
      muerto que solo confundía.

   3. Consultaba la tabla "perfiles" con .single(), que lanza
      error si no encuentra fila. El resto del portal usa
      "clientes".

   4. createClient directo en vez del singleton.

   Cambio de enfoque:
   Un pedido especial NO es una cotización, es una SOLICITUD DE
   COTIZACIÓN. El cliente describe lo que necesita; el precio
   lo pone Trulink después. Por eso el total entra en cero y el
   estado es "pendiente_cotizar", no se manda a checkout.
   ============================================================ */

export default function EspecialesPage() {
  const router = useRouter();
  const supabase = getSupabase();

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

  /**
   * Misma lógica que fabricacion.tsx: se toma el correo de la
   * sesión de Auth y se busca al cliente en "clientes" con ilike,
   * para que una diferencia de mayúsculas no rompa el match.
   */
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

      // NOTA: no se envía user_id. La tabla quotes tiene una FK hacia
      // "profiles" que los usuarios creados vía Auth admin no satisfacen,
      // y eso rompía el guardado con error 23503. La identidad del cliente
      // queda en empresa, representante, email y teléfono.
      const payload = {
        referencia,
        total: 0,                       // lo cotiza Trulink después
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

      setEnviado(true);
    } catch (err: any) {
      console.error("Error al enviar la solicitud:", err);
      alert("No se pudo enviar la solicitud: " + (err.message || err));
    } finally {
      setEnviando(false);
    }
  };

  /* ========================================================
     PANTALLA DE CONFIRMACIÓN
     ======================================================== */

  if (enviado) {
    return (
      <div style={contenedor}>
        <style jsx global>{estilosGlobales}</style>
        <div style={{ maxWidth: "560px", margin: "0 auto", textAlign: "center", paddingTop: "80px" }}>
          <div style={{ fontSize: "3rem", marginBottom: "20px" }}>✓</div>
          <h1 style={{ color: "#2ecc71", fontSize: "1.4rem", letterSpacing: "1px", marginBottom: "14px" }}>
            Solicitud Recibida
          </h1>
          <p style={{ color: "#bbb", fontSize: "0.92rem", lineHeight: 1.7, marginBottom: "10px" }}>
            Tu referencia es <strong style={{ color: "#DAA520" }}>{referencia}</strong>
          </p>
          <p style={{ color: "#888", fontSize: "0.85rem", lineHeight: 1.7, marginBottom: "32px" }}>
            Nuestro equipo técnico va a revisar tus especificaciones y te enviará
            la cotización por correo. Puedes seguir el avance desde Control de Pedidos.
          </p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => router.push("/seguimiento")} className="esp-btn">
              Ver mis pedidos
            </button>
            <button onClick={() => router.push("/portal-cliente")} className="esp-btn-alt">
              Volver al portal
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ========================================================
     FORMULARIO
     ======================================================== */

  return (
    <div style={contenedor}>
      <style jsx global>{estilosGlobales}</style>

      <div style={{ maxWidth: "820px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px", flexWrap: "wrap", gap: "12px" }}>
          <button onClick={() => router.push("/portal-cliente")} className="esp-btn-alt">
            ← Volver al Portal
          </button>
          <span style={{ color: "#888", fontSize: "0.82rem" }}>
            Referencia: <strong style={{ color: "#DAA520" }}>{referencia}</strong>
          </span>
        </div>

        <div style={{ textAlign: "center", marginBottom: "35px" }}>
          <h1 style={{ color: "#DAA520", fontSize: "1.5rem", letterSpacing: "2px", textTransform: "uppercase", margin: "0 0 10px 0", fontWeight: 400 }}>
            Pedidos Especiales
          </h1>
          <div style={{ width: "60px", height: "2px", background: "#DAA520", margin: "0 auto 14px auto", opacity: 0.6 }} />
          <p style={{ color: "#888", fontSize: "0.88rem", margin: 0, lineHeight: 1.6 }}>
            Cuéntanos qué necesitas y te preparamos una cotización a la medida.
          </p>
        </div>

        {/* Datos del cliente */}
        <div className="esp-card" style={{ marginBottom: "22px" }}>
          <h3 style={{ color: "#DAA520", marginTop: 0, fontSize: "0.95rem", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "14px" }}>
            Tus Datos
          </h3>
          {cargandoSesion ? (
            <p style={{ color: "#888", fontSize: "0.85rem", margin: 0 }}>Cargando...</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", fontSize: "0.85rem" }}>
              <div>
                <span className="esp-lb">Empresa</span>
                <strong style={{ color: "#fff" }}>{nombreEmpresa || "No registrada"}</strong>
              </div>
              <div>
                <span className="esp-lb">Representante</span>
                <strong style={{ color: "#fff" }}>{representante || "No registrado"}</strong>
              </div>
              <div>
                <span className="esp-lb">Correo</span>
                <strong style={{ color: "#fff" }}>{mailCliente || "No registrado"}</strong>
              </div>
              <div>
                <span className="esp-lb">Teléfono</span>
                <strong style={{ color: "#fff" }}>{telefonoCliente || "No registrado"}</strong>
              </div>
            </div>
          )}
        </div>

        {/* Especificaciones */}
        <div className="esp-card" style={{ marginBottom: "22px" }}>
          <h3 style={{ color: "#DAA520", marginTop: 0, fontSize: "0.95rem", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "6px" }}>
            Qué Necesitas
          </h3>
          <p style={{ color: "#777", fontSize: "0.78rem", margin: "0 0 16px 0", lineHeight: 1.6 }}>
            Mientras más detalle nos des, más precisa será la cotización.
            Tipo de cable, cantidad de hilos, longitud, condiciones de instalación, normas que debe cumplir.
          </p>

          <label className="esp-lb">Descripción del requerimiento</label>
          <textarea
            value={especificaciones}
            onChange={(e) => setEspecificaciones(e.target.value)}
            placeholder="Ej: Necesito 5 km de cable ADSS de 48 hilos para vanos de 200 metros, con cubierta anti-tracking para línea de alta tensión..."
            rows={6}
            className="esp-in"
            style={{ resize: "vertical", marginBottom: "16px" }}
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <label className="esp-lb">Cantidad aproximada</label>
              <input className="esp-in" placeholder="Ej: 5 km, 10 carretes..."
                value={cantidadAprox} onChange={(e) => setCantidadAprox(e.target.value)} />
            </div>
            <div>
              <label className="esp-lb">¿Para cuándo lo necesitas?</label>
              <input className="esp-in" type="date"
                value={fechaRequerida} onChange={(e) => setFechaRequerida(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Adjunto */}
        <div className="esp-card" style={{ marginBottom: "26px" }}>
          <h3 style={{ color: "#DAA520", marginTop: 0, fontSize: "0.95rem", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "6px" }}>
            Documentos Técnicos
          </h3>
          <p style={{ color: "#777", fontSize: "0.78rem", margin: "0 0 16px 0" }}>
            Opcional. Planos, fichas técnicas, pliegos de licitación o cualquier especificación en archivo.
          </p>

          <input type="file" id="espArchivo" style={{ display: "none" }}
            onChange={(e) => { if (e.target.files?.[0]) setArchivo(e.target.files[0]); }} />
          <label htmlFor="espArchivo" className="esp-btn-alt" style={{ display: "inline-block" }}>
            {archivo ? `📎 ${archivo.name}` : "📎 Adjuntar archivo"}
          </label>
          {archivo && (
            <button onClick={() => setArchivo(null)}
              style={{ background: "transparent", color: "#e74c3c", border: "none", cursor: "pointer", fontSize: "0.78rem", marginLeft: "12px" }}>
              Quitar
            </button>
          )}
        </div>

        <div style={{ background: "rgba(218,165,32,0.05)", border: "1px dashed rgba(218,165,32,0.3)",
          borderRadius: "10px", padding: "16px 20px", marginBottom: "24px" }}>
          <p style={{ color: "#999", fontSize: "0.8rem", margin: 0, lineHeight: 1.6 }}>
            📌 Este es un <strong style={{ color: "#DAA520" }}>pedido a la medida</strong>, así que no lleva precio
            todavía. Nuestro equipo revisa tus especificaciones y te envía la cotización por correo.
          </p>
        </div>

        <div style={{ textAlign: "center" }}>
          <button onClick={enviarSolicitud} disabled={enviando || cargandoSesion}
            className="esp-btn" style={{ padding: "14px 40px", fontSize: "0.9rem", opacity: enviando ? 0.6 : 1 }}>
            {enviando ? "Enviando..." : "Enviar Solicitud"}
          </button>
        </div>

        <p style={{ textAlign: "center", color: "rgba(218,165,32,0.4)", fontSize: "0.74rem", marginTop: "40px", letterSpacing: "1px" }}>
          © 2026 Trulink Fiber LLC — Excelencia y Vanguardia Tecnológica
        </p>
      </div>
    </div>
  );
}

const contenedor: React.CSSProperties = {
  backgroundColor: "#000",
  color: "#DAA520",
  minHeight: "100vh",
  padding: "40px 20px",
  fontFamily: "'Inter', sans-serif",
  boxSizing: "border-box",
};

const estilosGlobales = `
  html, body { margin:0; padding:0; background:#000 !important; }
  .esp-card { background:linear-gradient(145deg, rgba(15,15,15,0.9), rgba(5,5,5,0.95));
              border:1px solid rgba(218,165,32,0.3); border-radius:16px; padding:24px;
              box-shadow:0 10px 30px rgba(0,0,0,0.8); }
  .esp-in { width:100%; background:#000; color:#DAA520;
            border:1px solid rgba(218,165,32,0.4); border-radius:8px; padding:12px;
            font-size:0.88rem; outline:none; box-sizing:border-box; font-family:inherit; }
  .esp-in:focus { border-color:#DAA520; box-shadow:0 0 10px rgba(218,165,32,0.25); }
  .esp-lb { display:block; font-size:0.7rem; color:rgba(255,255,255,0.55);
            margin-bottom:6px; text-transform:uppercase; letter-spacing:0.8px; }
  .esp-btn { background:linear-gradient(135deg,#DAA520 0%,#B8860B 100%); color:#000;
             border:none; padding:12px 26px; border-radius:10px; font-weight:700;
             font-size:0.85rem; cursor:pointer; letter-spacing:0.5px; transition:all .3s ease; }
  .esp-btn:hover { filter:brightness(1.12); box-shadow:0 0 20px rgba(218,165,32,0.35); }
  .esp-btn:disabled { opacity:.5; cursor:not-allowed; }
  .esp-btn-alt { background:linear-gradient(135deg,#0a0a0a 0%,#161616 100%); color:#DAA520;
                 border:1px solid rgba(218,165,32,0.45); padding:11px 22px; border-radius:10px;
                 font-weight:600; font-size:0.82rem; cursor:pointer; transition:all .3s ease; }
  .esp-btn-alt:hover { background:rgba(218,165,32,0.1); box-shadow:0 0 15px rgba(218,165,32,0.2); }
`;
