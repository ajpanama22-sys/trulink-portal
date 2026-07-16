// ===============================================
// Portal de Clientes
// Opción Fábrica:
//   - ASU: carretes 3km con 6/12/24/48 hilos
//   - ADSS: carretes 3km con 72/96/144 hilos
//   - FTTX: carretes 1km/3km con 1/2 hilos
// Carrito de compras dinámico (agregar/eliminar artículos)
// Cotización en pantalla con total y nota "PRECIOS EXW PANAMÁ"
// Guardar cotización → PDF con imágenes y especificaciones
// ===============================================
export default function Clientes() {
  return (
    <div style={{ backgroundColor: "#000", color: "#DAA520", minHeight: "100vh", padding: "40px" }}>
      <div style={{ display: "flex", gap: "40px" }}>
        
        {/* Logo a la izquierda */}
        <div style={{ flex: 1, textAlign: "center" }}>
          <img src="/images/logo.png" alt="Trulink Fiber Logo" style={{ width: "180px", marginBottom: "20px" }} />
          <h2 style={{ color: "#DAA520" }}>Trulink Fiber LLC</h2>
        </div>

        {/* Formulario corporativo */}
        <div style={{ flex: 2, border: "1px solid #DAA520", padding: "20px" }}>
          <h2 style={{ color: "#DAA520" }}>REGISTRO CORPORATIVO</h2>

          {/* Selector Cliente/Inversor */}
          <div style={{ marginBottom: "20px" }}>
            <label>
              <input type="radio" name="tipo" value="cliente" /> Cliente B2B
            </label>
            <br />
            <label>
              <input type="radio" name="tipo" value="inversor" /> Inversor Estratégico
            </label>
          </div>

          {/* Información de la Empresa */}
          <h3 style={{ color: "#DAA520" }}>Información de la Empresa</h3>
          <input type="text" placeholder="Nombre o Razón Social" style={{ width: "100%", marginBottom: "10px" }} />
          <input type="text" placeholder="Identificación Fiscal (RUC / NIT / EIN)" style={{ width: "100%", marginBottom: "10px" }} />
          <input type="url" placeholder="Sitio Web Corporativo" style={{ width: "100%", marginBottom: "10px" }} />
          <input type="text" placeholder="Industria / Sector" style={{ width: "100%", marginBottom: "10px" }} />
          <input type="text" placeholder="Dirección de Facturación" style={{ width: "100%", marginBottom: "20px" }} />

          {/* Información del Contacto */}
          <h3 style={{ color: "#DAA520" }}>Información del Contacto</h3>
          <input type="text" placeholder="Nombre Completo del Representante" style={{ width: "100%", marginBottom: "10px" }} />
          <input type="text" placeholder="Cargo en la Empresa" style={{ width: "100%", marginBottom: "10px" }} />
          <input type="email" placeholder="Correo Electrónico Corporativo" style={{ width: "100%", marginBottom: "10px" }} />
          <input type="tel" placeholder="Teléfono Fijo o Móvil de Empresa" style={{ width: "100%", marginBottom: "20px" }} />

          {/* Documentación */}
          <h3 style={{ color: "#DAA520" }}>Documentación de Soporte</h3>
          <input type="file" style={{ marginBottom: "10px" }} />
          <ul style={{ fontSize: "12px", color: "#DAA520" }}>
            <li>Registro Fiscal vigente</li>
            <li>Certificación Legal (últimos 90 días)</li>
            <li>Identificación Oficial o Pasaporte</li>
            <li>Nombramiento de Autoridad Legal</li>
            <li>Acuerdo de Confidencialidad NDA firmado</li>
          </ul>

          {/* Términos estrictos */}
          <h3 style={{ color: "#DAA520" }}>Términos y Condiciones</h3>
          <textarea 
            rows="6" 
            style={{ 
              width: "100%", 
              marginBottom: "10px", 
              backgroundColor: "#111", 
              color: "#DAA520", 
              border: "1px solid #DAA520" 
            }}
          >
            El acceso al Portal B2B de Trulink Fiber LLC está sujeto a estricta verificación corporativa. 
            El solicitante se compromete a entregar documentación válida y vigente. 
            El incumplimiento de requisitos legales, fiscales o de confidencialidad será motivo de rechazo inmediato. 
            Toda la información enviada será tratada bajo confidencialidad y protección de datos. 
            El acceso aprobado implica aceptación plena de estas condiciones.
          </textarea>
          <div style={{ marginBottom: "20px" }}>
            <input type="checkbox" /> He leído y acepto los Términos y Condiciones
          </div>

          {/* Botón biselado */}
          <button style={{ 
            backgroundColor: "#DAA520", 
            color: "#000", 
            padding: "12px 24px", 
            border: "none", 
            fontWeight: "bold", 
            borderRadius: "12px",   // 👈 esquinas biseladas
            cursor: "pointer"
          }}>
            Enviar Solicitud
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
