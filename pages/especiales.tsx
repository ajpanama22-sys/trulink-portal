import { useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

export default function PedidosEspeciales() {
  const router = useRouter();
  const [nota, setNota] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);

  const inputStyle: React.CSSProperties = {
    width: "100%",
    marginBottom: "20px",
    padding: "15px",
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setArchivo(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCargando(true);
    setMensaje("");

    if (!archivo) {
      setMensaje("Por favor, adjunta un archivo con las especificaciones y cantidades.");
      setCargando(false);
      return;
    }

    if (!supabase) {
      setMensaje("Error de configuración: Cliente de Supabase no inicializado.");
      setCargando(false);
      return;
    }

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("No se pudo verificar la sesión del usuario.");

      const clienteEmail = user.email || "";
      const fileExt = archivo.name.split('.').pop();
      const fileName = `${clienteEmail}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("especiales")
        .upload(fileName, archivo);

      if (uploadError) throw new Error("Error al subir el archivo: " + uploadError.message);

      const { data: { publicUrl } } = supabase.storage
        .from("especiales")
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from("pedidos_especiales")
        .insert([
          {
            cliente_email: clienteEmail,
            nota_descriptiva: nota,
            archivo_url: publicUrl,
          }
        ]);

      if (dbError) throw new Error("Error al guardar en la base de datos: " + dbError.message);

      await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: "fred.jurado@trulinkfiber.com",
          subject: `Nuevo Pedido Especial de ${clienteEmail}`,
          text: `El cliente ${clienteEmail} ha enviado un nuevo pedido especial.\n\nNota:\n${nota}\n\nArchivo adjunto:\n${publicUrl}`
        })
      });

      setMensaje("Pedido especial enviado con éxito. Nuestro equipo lo revisará pronto.");
      setNota("");
      setArchivo(null);
      const fileInput = document.getElementById('archivo-input') as HTMLInputElement;
      if (fileInput) fileInput.value = "";

    } catch (error: any) {
      setMensaje(error.message || "Ocurrió un error inesperado.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={{
      backgroundColor: "#000000",
      color: "#DAA520",
      minHeight: "100vh",
      padding: "40px 20px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      boxSizing: "border-box"
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
        .nav-btn {
          background: linear-gradient(135deg, #0a0a0a 0%, #161616 100%) !important;
          color: #DAA520 !important;
          border: 1px solid rgba(218, 165, 32, 0.3) !important;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        .nav-btn:hover {
          background: linear-gradient(135deg, #DAA520 0%, #B8860B 100%) !important;
          color: #000000 !important;
          box-shadow: 0 0 20px rgba(218, 165, 32, 0.4);
          transform: translateY(-1px);
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
        textarea:focus, input[type="file"]:focus {
          border-color: #DAA520 !important;
          box-shadow: 0 0 10px rgba(218, 165, 32, 0.3) !important;
        }
      `}</style>

      {/* Header Bar */}
      <div style={{ width: "100%", maxWidth: "700px", display: "flex", justifyContent: "flex-start", marginBottom: "25px" }}>
        <button
          onClick={() => router.push("/portal-cliente")}
          className="nav-btn"
          style={{ padding: "10px 20px", borderRadius: "10px", fontWeight: "600", cursor: "pointer", fontSize: "0.85rem" }}
        >
          ← Volver al Portal
        </button>
      </div>

      {/* Title Section */}
      <div style={{ textAlign: "center", marginBottom: "35px", maxWidth: "700px" }}>
        <img src="/images/logo.png" alt="Trulink Fiber Logo" style={{ width: "110px", marginBottom: "15px", filter: "drop-shadow(0 0 10px rgba(218,165,32,0.2))" }} />
        <h1 style={{ color: "#DAA520", marginBottom: "10px", fontSize: "2rem", fontWeight: "700", letterSpacing: "1.5px" }}>
          PEDIDOS ESPECIALES
        </h1>
        <p style={{ color: "#C0C0C0", fontSize: "0.95rem", lineHeight: "1.5", maxWidth: "600px", margin: "0 auto" }}>
          Utiliza este formulario para solicitar productos fuera de catálogo. Adjunta las especificaciones técnicas y las cantidades requeridas.
        </p>
      </div>

      {/* Form Container */}
      <form 
        onSubmit={handleSubmit}
        className="container-fiber"
        style={{
          width: "100%",
          maxWidth: "700px",
          backgroundColor: "#060606",
          padding: "35px",
          borderRadius: "24px",
          border: "1px solid rgba(218, 165, 32, 0.3)",
          boxSizing: "border-box"
        }}
      >
        <label style={{ display: "block", marginBottom: "10px", fontWeight: "600", color: "#DAA520", fontSize: "0.95rem", letterSpacing: "0.5px" }}>
          Nota Descriptiva
        </label>
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Describe brevemente tu solicitud..."
          required
          style={{ ...inputStyle, minHeight: "150px", resize: "vertical" }}
        />

        <label style={{ display: "block", marginBottom: "10px", fontWeight: "600", color: "#DAA520", fontSize: "0.95rem", letterSpacing: "0.5px" }}>
          Adjuntar Especificaciones (PDF, Excel, etc.)
        </label>
        <div style={{ ...inputStyle, padding: "12px", display: "flex", alignItems: "center", backgroundColor: "#0a0a0a" }}>
          <input
            id="archivo-input"
            type="file"
            onChange={handleFileChange}
            required
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

        <button 
          type="submit"
          disabled={cargando}
          className="action-btn"
          style={{
            width: "100%",
            padding: "15px",
            fontSize: "1rem",
            borderRadius: "14px",
            cursor: cargando ? "not-allowed" : "pointer",
            opacity: cargando ? 0.7 : 1,
            letterSpacing: "0.5px",
            marginTop: "10px"
          }}
        >
          {cargando ? "Enviando solicitud..." : "Enviar Pedido Especial"}
        </button>

        {mensaje && (
          <div style={{
            marginTop: "25px",
            textAlign: "center",
            padding: "14px",
            borderRadius: "12px",
            backgroundColor: mensaje.includes("éxito") ? "rgba(0, 255, 0, 0.08)" : "rgba(255, 68, 68, 0.08)",
            color: mensaje.includes("éxito") ? "#00FF00" : "#FF5252",
            border: `1px solid ${mensaje.includes("éxito") ? "rgba(0, 255, 0, 0.3)" : "rgba(255, 82, 82, 0.3)"}`,
            fontSize: "0.9rem",
            fontWeight: "500",
            letterSpacing: "0.3px"
          }}>
            {mensaje}
          </div>
        )}
      </form>

      {/* Footer */}
      <p style={{ marginTop: "35px", fontSize: "0.75rem", color: "rgba(218, 165, 32, 0.7)", textAlign: "center", letterSpacing: "0.5px" }}>
        © 2026 Marca registrada – Derechos reservados – Propiedad de Trulink Fiber LLC
      </p>
    </div>
  );
}