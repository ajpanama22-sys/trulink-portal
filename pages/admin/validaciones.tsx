import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import Sidebar from "./Sidebar";

export default function AdminValidaciones() {
  const [dataList, setDataList] = useState<any[]>([]);

  useEffect(() => {
    cargarSolicitudes();
  }, []);

  const cargarSolicitudes = async () => {
    if (!supabase) return;
    setDataList([]);
    const { data, error } = await supabase.from("solicitudes_acceso").select("*");
    if (error) {
      console.error("Error al cargar solicitudes:", error);
    } else {
      setDataList(data || []);
    }
  };

  const procesarSolicitud = async (id: string, tipo: 'ACTIVAR' | 'RECHAZAR', emailCliente: string, razonSocialParam: string, itemCompleto: any) => {
    if (!supabase) return;

    if (tipo === 'ACTIVAR') {
      const passwordToken = "trulink_" + Math.random().toString(36).substring(2) + Date.now().toString(36);
      
      const { error: updateError } = await supabase
        .from("solicitudes_acceso")
        .update({ status: 'active', password_token: passwordToken })
        .eq('id', id);

      if (updateError) {
        alert("Error al activar en base de datos: " + updateError.message);
        return;
      }

      const datosCompletos = itemCompleto.datos_completos || {};
      const tipoClienteVal = datosCompletos.tipo_cliente || itemCompleto.tipo_solicitud || 'Integrador';
      const priceListVal = datosCompletos.price_list || 'C';

      const { error: clienteError } = await supabase
        .from("clientes")
        .upsert({
          razon_social: razonSocialParam,
          email: emailCliente,
          tipo_cliente: tipoClienteVal,
          price_list: priceListVal,
          status: 'pendiente_password',
          password_token: passwordToken
        }, { onConflict: 'email' });

      if (clienteError) {
        console.error("Error replicando en tabla clientes:", clienteError);
      }

      try {
        const response = await fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipo: "ACTIVACION",
            email: emailCliente,
            razon_social: razonSocialParam,
            link: `${window.location.origin}/auth/crear-password?token=${passwordToken}`
          })
        });
        if (!response.ok) throw new Error("Fallo al enviar correo de activación");
        alert(`Solicitud activada con éxito. Cliente replicado y correo enviado a ${emailCliente}`);
      } catch (err: any) {
        alert("Solicitud activada en BD y replicada, pero hubo un error enviando el correo: " + err.message);
      }

    } else {
      try {
        const response = await fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipo: "RECHAZO",
            email: emailCliente,
            razon_social: razonSocialParam
          })
        });
        if (!response.ok) throw new Error("Fallo al enviar correo de rechazo");
      } catch (err: any) {
        console.error("Error enviando correo de rechazo:", err);
      }

      const { error: deleteError } = await supabase
        .from("solicitudes_acceso")
        .update({ status: 'rejected' })
        .eq('id', id);

      if (deleteError) {
        await supabase.from("solicitudes_acceso").delete().eq('id', id);
      }

      alert(`La solicitud de ${razonSocialParam} ha sido rechazada y se ha notificado al solicitante.`);
    }

    cargarSolicitudes();
  };

  return (
    <div style={{ backgroundColor: "#000", minHeight: "100vh", display: "flex", color: "#DAA520", fontFamily: "sans-serif" }}>
      <Sidebar currentActive="validaciones" />

      <div style={{ flex: 1, padding: "40px", overflowY: "auto" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "25px", borderBottom: "1px solid #333", paddingBottom: "10px" }}>VALIDACIÓN DE INSCRIPCIONES</h1>
        
        {dataList.length === 0 ? (
          <p style={{ color: "#666", fontStyle: "italic" }}>No hay solicitudes pendientes por validar.</p>
        ) : (
          dataList.map((item: any) => {
            let docUrl = item.documentos_url || item.url || "";
            if (!docUrl && supabase) {
              const { data: publicData } = supabase.storage.from("documentos").getPublicUrl(`${item.id}_documento`);
              docUrl = publicData?.publicUrl || "#";
            }

            return (
              <div key={item.id} style={{ borderBottom: "1px solid #333", padding: "20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ fontWeight: "bold" }}>RAZON SOCIAL: <span style={{ color: "#DAA520" }}>{item.razon_social}</span> | EMAIL: <span style={{ color: "#DAA520" }}>{item.email}</span></div>
                  <a href={docUrl} target="_blank" rel="noreferrer" style={{...btnAccion, background: "blue", color: "#fff", width: "fit-content", textAlign: "center", textDecoration: "none", fontSize: "0.85rem"}}>VER DOCUMENTOS</a>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button onClick={() => procesarSolicitud(item.id, 'ACTIVAR', item.email, item.razon_social, item)} style={{...btnAccion, background: "green", color: "#000"}}>ACTIVAR</button>
                  <button onClick={() => procesarSolicitud(item.id, 'RECHAZAR', item.email, item.razon_social, item)} style={{...btnAccion, background: "red", color: "#000"}}>RECHAZAR</button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const btnAccion = { padding: "10px 20px", cursor: "pointer", border: "none", borderRadius: "5px", fontWeight: "bold", display: "inline-block", textDecoration: "none" };