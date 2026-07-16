// ===============================================
// Panel de Administración
// Menú lateral en negro con íconos dorados
// Sección VALIDAR:
//   - Lista de registros con documentos adjuntos
//   - Botón “Activar” → envía correo con link (auth Supabase)
// Sección COTIZACIONES:
//   - Listado de PDFs generados con seguimiento
// SMTP configurado:
//   Servidor: smtp-relay.brevo.com
//   Puerto: 587
//   Usuario: b05854001@smtp-brevo.com
//   Clave: bsk0BBgjQ0GG5f3
//   Remitente: fred.jurado@trulinkfiber.com
// ===============================================
export default function Admin() {
  return (
    <div style={{ backgroundColor: "#000", color: "#DAA520", minHeight: "100vh", padding: "40px" }}>
      {/* Logo y título */}
      <div style={{ textAlign: "center", marginBottom: "30px" }}>
        <img src="/images/logo.png" alt="Trulink Fiber Logo" style={{ width: "150px", marginBottom: "20px" }} />
        <h1 style={{ color: "#DAA520" }}>Panel Administrativo - Trulink Fiber LLC</h1>
      </div>

      {/* Contenedor principal */}
      <div style={{ maxWidth: "800px", margin: "0 auto", border: "1px solid #DAA520", padding: "20px", borderRadius: "12px" }}>
        <h2 style={{ color: "#DAA520", marginBottom: "20px" }}>Gestión de Usuarios y Solicitudes</h2>

        {/* Opciones administrativas */}
        <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <button style={{ 
            backgroundColor: "#DAA520", 
            color: "#000", 
            padding: "12px 24px", 
            border: "none", 
            fontWeight: "bold", 
            borderRadius: "12px",   // 👈 esquinas biseladas
            cursor: "pointer"
          }}>
            Revisar Solicitudes de Registro
          </button>

          <button style={{ 
            backgroundColor: "#DAA520", 
            color: "#000", 
            padding: "12px 24px", 
            border: "none", 
            fontWeight: "bold", 
            borderRadius: "12px", 
            cursor: "pointer"
          }}>
            Aprobar / Rechazar Accesos
          </button>

          <button style={{ 
            backgroundColor: "#DAA520", 
            color: "#000", 
            padding: "12px 24px", 
            border: "none", 
            fontWeight: "bold", 
            borderRadius: "12px", 
            cursor: "pointer"
          }}>
            Administrar Usuarios Activos
          </button>

          <button style={{ 
            backgroundColor: "#DAA520", 
            color: "#000", 
            padding: "12px 24px", 
            border: "none", 
            fontWeight: "bold", 
            borderRadius: "12px", 
            cursor: "pointer"
          }}>
            Configuración del Portal
          </button>
        </div>
      </div>

      {/* Footer institucional */}
      <p style={{ marginTop: "40px", fontSize: "12px", color: "#DAA520", textAlign: "center" }}>
        © 2026 Marca registrada – Derechos reservados – Propiedad de Trulink Fiber LLC
      </p>
    </div>
  );
}
