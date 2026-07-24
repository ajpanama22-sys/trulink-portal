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
    backgroundColor: "#111",
    color: "#DAA520",
    border: "2px solid #DAA520",
    borderRadius: "15px",
    outline: "none",
    boxSizing: "border-box",
    fontSize: "16px",
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
      backgroundColor: "#000",
      color: "#DAA520",
      minHeight: "100vh",
      padding: "40px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center"
    }}>
      <button
        onClick={() => router.push("/portal-cliente")}
        style={{
          alignSelf: "flex-start",
          backgroundColor: "transparent",
          color: "#DAA520",
          border: "1px solid #DAA520",
          padding: "10px 20px",
          borderRadius: "10px",
          cursor: "pointer",
          marginBottom: "20px"
        }}
      >
        ← Volver al Portal
      </button>

      <h1 style={{ marginBottom: "10px", textAlign: "center" }}>Pedidos Especiales</h1>
      <p style={{ marginBottom: "40px", textAlign: "center", maxWidth: "600px", color: "#ccc" }}>
        Utiliza este formulario para solicitar productos fuera de catálogo. Adjunta las especificaciones técnicas y las cantidades requeridas.
      </p>

      <form 
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: "600px",
          backgroundColor: "#050505",
          padding: "30px",
          borderRadius: "20px",
          border: "1px solid #DAA520",
          boxShadow: "0 0 15px rgba(218, 165, 32, 0.2)"
        }}
      >
        <label style={{ display: "block", marginBottom: "10px", fontWeight: "bold" }}>
          Nota Descriptiva
        </label>
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Describe brevemente tu solicitud..."
          required
          style={{ ...inputStyle, minHeight: "150px", resize: "vertical" }}
        />

        <label style={{ display: "block", marginBottom: "10px", fontWeight: "bold" }}>
          Adjuntar Especificaciones (PDF, Excel, etc.)
        </label>
        <input
          id="archivo-input"
          type="file"
          onChange={handleFileChange}
          required
          style={{ ...inputStyle, padding: "10px" }}
        />

        <button 
          type="submit"
          disabled={cargando}
          style={{
            backgroundColor: "#DAA520",
            color: "#000",
            width: "100%",
            padding: "15px",
            fontSize: "18px",
            fontWeight: "bold",
            border: "none",
            borderRadius: "15px",
            cursor: cargando ? "not-allowed" : "pointer",
            opacity: cargando ? 0.7 : 1
          }}
        >
          {cargando ? "Enviando..." : "Enviar Pedido Especial"}
        </button>

        {mensaje && (
          <p style={{
            marginTop: "20px",
            textAlign: "center",
            padding: "10px",
            borderRadius: "10px",
            backgroundColor: mensaje.includes("éxito") ? "rgba(0, 255, 0, 0.1)" : "rgba(255, 0, 0, 0.1)",
            color: mensaje.includes("éxito") ? "#00FF00" : "#FF4444",
            border: `1px solid ${mensaje.includes("éxito") ? "#00FF00" : "#FF4444"}`
          }}>
            {mensaje}
          </p>
        )}
      </form>
    </div>
  );
}