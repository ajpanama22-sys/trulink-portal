export default function Clientes() {
  // Objeto de estilos reutilizable para los campos
  const inputStyle: React.CSSProperties = {
    width: "100%",
    marginBottom: "15px",
    padding: "12px",
    backgroundColor: "#111",
    color: "#DAA520",
    border: "2px solid #DAA520",
    borderRadius: "15px",
    outline: "none",
    transition: "all 0.3s ease",
  };

  const focusEffect = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.target.style.boxShadow = "0 0 15px #DAA520";
    e.target.style.borderColor = "#FFF";
  };

  const blurEffect = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.target.style.boxShadow = "none";
    e.target.style.borderColor = "#DAA520";
  };

  return (
    <div style={{ backgroundColor: "#000", color: "#DAA520", minHeight: "100vh", padding: "40px", fontFamily: "sans-serif" }}>
      
      {/* Estilos dinámicos para el haz de luz y efectos */}
      <style>{`
        @keyframes pulse-border {
          0% { box-shadow: 0 0 10px #DAA520; }
          50% { box-shadow: 0 0 30px #DAA520; }
          100% { box-shadow: 0 0 10px #DAA520; }
        }
        .container-fiber {
          animation: pulse-border 2s infinite;
        }
      `}</style>

      {/* Contenedor Principal con efecto de Borde "Fibra" */}
      <div className="container-fiber" style={{ 
        display: "flex", 
        gap: "40px", 
        padding: "40px", 
        border: "2px solid #DAA520", 
        borderRadius: "30px",
        backgroundColor: "#050505"
      }}>
        
        {/* Logo a la izquierda */}
        <div style={{ flex: 1, textAlign: "center" }}>
          <img src="/images/logo.png" alt="Trulink Fiber Logo" style={{ width: "180px", marginBottom: "20px" }} />
          <h2 style={{ color: "#DAA520" }}>Trulink Fiber LLC</h2>
        </div>

        {/* Formulario corporativo */}
        <div style={{ flex: 2 }}>
          <h2 style={{ color: "#DAA520", marginBottom: "20px" }}>REGISTRO CORPORATIVO</h2>

          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "5px" }}>
              <input type="radio" name="tipo" value="cliente" style={{ marginRight: "10px" }} /> Cliente B2B
            </label>
            <label style={{ display: "block" }}>
              <input type="radio" name="tipo" value="inversor" style={{ marginRight: "10px" }} /> Inversor Estratégico
            </label>
          </div>

          <h3 style={{ color: "#DAA520" }}>Información de la Empresa</h3>
          <input type="text" placeholder="Nombre o Razón Social" style={inputStyle} onFocus={focusEffect} onBlur={blurEffect} />
          <input type="text" placeholder="Identificación Fiscal (RUC / NIT / EIN)" style={inputStyle} onFocus={focusEffect} onBlur={blurEffect} />
          <input type="url" placeholder="Sitio Web Corporativo" style={inputStyle} onFocus={focusEffect} onBlur={blurEffect} />
          <input type="text" placeholder="Industria / Sector" style={inputStyle} onFocus={focusEffect} onBlur={blurEffect} />
          <input type="text" placeholder="Dirección de Facturación" style={inputStyle} onFocus={focusEffect} onBlur={blurEffect} />

          <h3 style={{ color: "#DAA520" }}>Información del Contacto</h3>
          <input type="text" placeholder="Nombre Completo del Representante" style={inputStyle} onFocus={focusEffect} onBlur={blurEffect} />
          <input type="text" placeholder="Cargo en la Empresa" style={inputStyle} onFocus={focusEffect} onBlur={blurEffect} />
          <input type="email" placeholder="Correo Electrónico Corporativo" style={inputStyle} onFocus={focusEffect} onBlur={blurEffect} />
          <input type="tel" placeholder="Teléfono Fijo o Móvil de Empresa" style={inputStyle} onFocus={focusEffect} onBlur={blurEffect} />

          <h3 style={{ color: "#DAA520" }}>Documentación de Soporte</h3>
          <input type="file" style={{ ...inputStyle, padding: "10px" }} />
          <ul style={{ fontSize: "12px", color: "#DAA520", marginBottom: "20px" }}>
            <li>Registro Fiscal vigente</li>
            <li>Certificación Legal (últimos 90 días)</li>
            <li>Identificación Oficial o Pasaporte</li>
            <li>Nombramiento de Autoridad Legal</li>
            <li>Acuerdo de Confidencialidad NDA firmado</li>
          </ul>

          <h3 style={{ color: "#DAA520" }}>Términos y Condiciones</h3>
          <textarea 
            rows={6} 
            style={inputStyle} 
            onFocus={focusEffect} 
            onBlur={blurEffect}
          >
            El acceso al Portal B2B de Trulink Fiber LLC está sujeto a estricta verificación corporativa. 
            El solicitante se compromete a entregar documentación válida y vigente. 
            El incumplimiento de requisitos legales, fiscales o de confidencialidad será motivo de rechazo inmediato. 
            Toda la información enviada será tratada bajo confidencialidad y protección de datos. 
            El acceso aprobado implica aceptación plena de estas condiciones.
          </textarea>
          
          <div style={{ marginBottom: "20px" }}>
            <input type="checkbox" style={{ marginRight: "10px" }} /> 
            He leído y acepto los Términos y Condiciones
          </div>

          <button style={{ 
            backgroundColor: "#DAA520", 
            color: "#000", 
            padding: "15px 30px", 
            border: "none", 
            fontWeight: "bold", 
            borderRadius: "15px", 
            cursor: "pointer",
            width: "100%",
            fontSize: "16px",
            transition: "transform 0.2s"
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.02)"}
          onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
          >
            Enviar Solicitud
          </button>
        </div>
      </div>

      <p style={{ marginTop: "40px", fontSize: "12px", color: "#DAA520", textAlign: "center" }}>
        © 2026 Marca registrada – Derechos reservados – Propiedad de Trulink Fiber LLC
      </p>
    </div>
  );
}