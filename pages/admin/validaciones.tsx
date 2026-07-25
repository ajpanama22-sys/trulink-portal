import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import Sidebar from "./Sidebar";

export default function AdminValidaciones() {
  const [dataList, setDataList] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    cargarSolicitudes();
  }, []);

  const cargarSolicitudes = async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase.from("solicitudes_acceso").select("*");
    if (error) {
      console.error("Error al cargar solicitudes:", error);
    } else {
      setDataList(data || []);
    }
    setLoading(false);
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
    <div style={{ backgroundColor: "#080808", minHeight: "100vh", display: "flex", color: "#E0E0E0", fontFamily: "sans-serif" }}>
      <Sidebar currentActive="validaciones" />

      <div style={{ flex: 1, padding: "40px 50px", overflowY: "auto", boxSizing: "border-box" }}>
        
        {/* Header Superior con Estilo Premium Black & Gold */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "35px", borderBottom: "1px solid rgba(218, 165, 32, 0.2)", paddingBottom: "20px" }}>
          <div>
            <h1 style={{ fontSize: "1.8rem", fontWeight: "700", color: "#DAA520", margin: "0 0 8px 0", letterSpacing: "1.5px" }}>
              VALIDACIÓN DE INSCRIPCIONES
            </h1>
            <p style={{ fontSize: "0.9rem", color: "#888", margin: 0, letterSpacing: "0.5px" }}>
              Gestión y aprobación de solicitudes de acceso para nuevos integradores y socios comerciales.
            </p>
          </div>
          <div style={{ background: "rgba(218, 165, 32, 0.08)", border: "1px solid rgba(218, 165, 32, 0.3)", padding: "10px 20px", borderRadius: "8px", color: "#DAA520", fontWeight: "600", fontSize: "0.85rem", letterSpacing: "1px" }}>
            PENDIENTES: {dataList.length}
          </div>
        </div>

        {/* Contenido Principal */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px", color: "#666", fontSize: "1rem", letterSpacing: "1px" }}>
            Cargando solicitudes de acceso...
          </div>
        ) : dataList.length === 0 ? (
          <div style={{ background: "#111", border: "1px solid #222", borderRadius: "12px", padding: "60px", textAlign: "center" }}>
            <p style={{ color: "#777", fontStyle: "italic", fontSize: "1rem", margin: 0, letterSpacing: "0.5px" }}>
              No hay solicitudes pendientes por validar en este momento.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "20px" }}>
            {dataList.map((item: any) => {
              let docUrl = item.documentos_url || item.url || "";
              if (!docUrl && supabase) {
                const { data: publicData } = supabase.storage.from("registros").getPublicUrl(`${item.id}_documento`);
                docUrl = publicData?.publicUrl || "#";
              }

              const fechaCreacion = item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Reciente';

              return (
                <div 
                  key={item.id} 
                  style={{ 
                    background: "#111111", 
                    border: "1px solid #222", 
                    borderRadius: "12px", 
                    padding: "25px 30px", 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "space-between",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
                    transition: "all 0.3s ease"
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1, marginRight: "30px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                      <span style={{ fontSize: "0.75rem", background: "rgba(218, 165, 32, 0.15)", color: "#DAA520", padding: "3px 8px", borderRadius: "4px", fontWeight: "600", letterSpacing: "0.5px" }}>
                        ID: {item.id ? item.id.substring(0, 8) : 'N/A'}
                      </span>
                      <span style={{ fontSize: "0.75rem", color: "#666" }}>
                        Fecha: {fechaCreacion}
                      </span>
                    </div>

                    <div style={{ fontWeight: "600", fontSize: "1.05rem", letterSpacing: "0.5px", color: "#FFF" }}>
                      {item.razon_social || 'Sin Razón Social'}
                    </div>

                    <div style={{ fontSize: "0.88rem", color: "#AAA", letterSpacing: "0.3px" }}>
                      Correo Electrónico: <span style={{ color: "#DAA520", fontWeight: "500" }}>{item.email}</span>
                    </div>

                    <div>
                      <a href={docUrl} target="_blank" rel="noreferrer" style={btnDocumentos}>
                        VER DOCUMENTOS ADJUNTOS
                      </a>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <button 
                      onClick={() => procesarSolicitud(item.id, 'ACTIVAR', item.email, item.razon_social, item)} 
                      style={btnActivar}
                      onMouseOver={(e) => { e.currentTarget.style.background = "rgba(46, 204, 113, 0.15)"; }}
                      onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      ACTIVAR
                    </button>
                    <button 
                      onClick={() => procesarSolicitud(item.id, 'RECHAZAR', item.email, item.razon_social, item)} 
                      style={btnRechazar}
                      onMouseOver={(e) => { e.currentTarget.style.background = "rgba(231, 76, 60, 0.15)"; }}
                      onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      RECHAZAR
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const baseBtn = {
  padding: "11px 22px",
  cursor: "pointer",
  borderRadius: "6px",
  fontWeight: "600",
  fontSize: "0.8rem",
  letterSpacing: "0.8px",
  transition: "all 0.2s ease",
  textDecoration: "none",
  display: "inline-block",
  textAlign: "center" as const
};

const btnDocumentos = {
  ...baseBtn,
  background: "rgba(218, 165, 32, 0.05)",
  color: "#DAA520",
  border: "1px solid rgba(218, 165, 32, 0.4)",
  width: "220px",
  boxSizing: "border-box" as const,
  marginTop: "5px"
};

const btnActivar = {
  ...baseBtn,
  background: "transparent",
  color: "#2ecc71",
  border: "1px solid rgba(46, 204, 113, 0.5)",
  minWidth: "110px"
};

const btnRechazar = {
  ...baseBtn,
  background: "transparent",
  color: "#e74c3c",
  border: "1px solid rgba(231, 76, 60, 0.5)",
  minWidth: "110px"
};