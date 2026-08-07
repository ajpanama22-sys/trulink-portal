import { useState } from "react";
import Sidebar from "./Sidebar";
import { theme, pageWrapStyle } from "../../lib/theme";
import { Card, Heading, PageHeader, Button, inputStyle } from "../../lib/ui";
import { getSupabase } from "../../lib/supabaseClient";

const labelStyle = {
  fontSize: "0.85rem",
  color: theme.textMuted,
  display: "block",
  marginBottom: "8px",
  letterSpacing: "0.5px",
};

const checkboxLabelStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  cursor: "pointer",
  color: theme.gold,
  fontSize: "0.9rem",
};

const checkboxInputStyle = {
  width: "16px",
  height: "16px",
  accentColor: theme.gold,
};

export default function AdminNotificaciones() {
  const [mensaje, setMensaje] = useState("");
  const [destinatario, setDestinatario] = useState("todos");
  const [enviarEmail, setEnviarEmail] = useState(true);
  const [enviarSms, setEnviarSms] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<string>("");

  const enviarAlerta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mensaje.trim()) {
      alert("Por favor escribe el contenido de la notificación.");
      return;
    }

    if (!enviarEmail && !enviarSms) {
      alert("Selecciona al menos un canal: Email o SMS.");
      return;
    }

    setEnviando(true);
    setResultado("");

    const canales: string[] = [];
    if (enviarEmail) canales.push("email");
    if (enviarSms) canales.push("sms");

    try {
      const supabase = getSupabase();
      const { data: sessionData } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      const token = sessionData?.session?.access_token;

      const res = await fetch("/api/notificar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ destinatario, mensaje, canales }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al enviar la notificación");
      }

      if (data.total === 0) {
        setResultado(data.mensaje || "No se encontraron destinatarios para esa categoría.");
      } else {
        const partes: string[] = [];
        if (data.email) {
          partes.push(
            `Email: ${data.email.enviados} de ${data.total} enviados` +
            (data.email.fallidos > 0 ? ` (${data.email.fallidos} fallaron)` : "")
          );
        }
        if (data.sms) {
          partes.push(
            `SMS: ${data.sms.enviados} de ${data.total} enviados` +
            (data.sms.fallidos > 0 ? ` (${data.sms.fallidos} fallaron)` : "")
          );
        }
        setResultado(partes.join(" | "));
        setMensaje("");
      }
    } catch (err: any) {
      setResultado("Error: " + err.message);
    } finally {
      setEnviando(false);
    }
  };

  const canalTexto = [enviarEmail && "EMAIL", enviarSms && "SMS"].filter(Boolean).join(" + ") || "NINGUNO";

  return (
    <div style={{ display: "flex" }}>
      <Sidebar currentActive="notificaciones" />

      <div style={pageWrapStyle()}>
        <PageHeader
          title="Centro de Notificaciones y Alertas"
          subtitle="Envía avisos operativos, alertas de despacho o comunicados directos a los usuarios del sistema."
          counterLabel={`CANAL ACTIVO: ${canalTexto}`}
        />

        <Card style={{ maxWidth: 700 }}>
          <Heading>Nueva Alerta Operativa</Heading>

          <form onSubmit={enviarAlerta} style={{ display: "flex", flexDirection: "column", gap: "25px" }}>

            <div>
              <label style={labelStyle}>Destinatario:</label>
              <select
                value={destinatario}
                onChange={(e) => setDestinatario(e.target.value)}
                style={inputStyle}
              >
                <option value="todos">Todos los Integradores / Clientes (activos)</option>
                <option value="equipo">Equipo Administrativo y Planta</option>
                <option value="pendientes">Usuarios con Validaciones Pendientes</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Canal de envío:</label>
              <div style={{ display: "flex", gap: "25px" }}>
                <label style={checkboxLabelStyle}>
                  <input
                    type="checkbox"
                    checked={enviarEmail}
                    onChange={(e) => setEnviarEmail(e.target.checked)}
                    style={checkboxInputStyle}
                  />
                  Email
                </label>
                <label style={checkboxLabelStyle}>
                  <input
                    type="checkbox"
                    checked={enviarSms}
                    onChange={(e) => setEnviarSms(e.target.checked)}
                    style={checkboxInputStyle}
                  />
                  SMS
                </label>
              </div>
              <p style={{ fontSize: "0.75rem", color: theme.textMuted, marginTop: "8px" }}>
                Puedes marcar ambos. El sistema busca el email y/o el teléfono registrado de cada destinatario según lo que elijas.
              </p>
            </div>

            <div>
              <label style={labelStyle}>Mensaje / Alerta:</label>
              <textarea
                rows={6}
                placeholder="Escribe el comunicado o alerta..."
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                style={{ ...inputStyle, width: "100%", resize: "vertical", boxSizing: "border-box" }}
              />
              {enviarSms && (
                <p style={{ fontSize: "0.75rem", color: theme.textMuted, marginTop: "6px" }}>
                  📱 Recuerda: los SMS son más efectivos si el mensaje es corto y directo.
                </p>
              )}
            </div>

            <Button type="submit" variant="gold" disabled={enviando} style={{ width: "100%" }}>
              {enviando ? "Enviando..." : `ENVIAR NOTIFICACIÓN (${canalTexto})`}
            </Button>

            {resultado && (
              <p style={{
                fontSize: "0.85rem",
                color: resultado.startsWith("Error") ? theme.red : theme.green,
                textAlign: "center",
                margin: 0
              }}>
                {resultado}
              </p>
            )}

          </form>
        </Card>

        {/* Aviso sobre canal aun no disponible, para expectativa clara */}
        <Card style={{ maxWidth: 700, marginTop: "20px", border: `1px dashed ${theme.borderGold}` }}>
          <p style={{ fontSize: "0.8rem", color: theme.textMuted, margin: 0 }}>
            📌 <strong style={{ color: theme.gold }}>Push en la app móvil</strong> aún no está conectado — se activará cuando se publique la aplicación.
          </p>
        </Card>

      </div>
    </div>
  );
}