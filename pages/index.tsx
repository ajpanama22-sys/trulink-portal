import { useEffect } from "react";
import { theme } from "../lib/theme";
import { Button } from "../lib/ui";

export default function Home() {
  useEffect(() => {
    const canvas = document.getElementById("fiber-cable") as HTMLCanvasElement | null;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let pulseX = 0;
    let opacity = 1;
    let fading = true;

    function draw() {
      if (!ctx || !canvas) return;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const yPosition = canvas.height * 0.85;

      // 1. Línea central dorada refinada con menor grosor y resplandor elegante
      ctx.beginPath();
      ctx.moveTo(0, yPosition);
      ctx.lineTo(canvas.width, yPosition);
      ctx.strokeStyle = "rgba(218, 165, 32, 0.6)";
      ctx.lineWidth = 0.75;
      ctx.shadowColor = "#FFD700";
      ctx.shadowBlur = 6;
      ctx.stroke();

      // 2. Punto de luz / pulso de fibra óptica optimizado
      ctx.beginPath();
      ctx.arc(pulseX, yPosition, 3, 0, Math.PI * 2, false);
      ctx.fillStyle = `rgba(255, 215, 0, ${opacity})`;
      ctx.shadowColor = "#FFD700";
      ctx.shadowBlur = 12;
      ctx.fill();

      pulseX += 1.5;
      if (pulseX > canvas.width) {
        pulseX = 0;
      }

      if (fading) {
        opacity -= 0.015;
        if (opacity <= 0.2) fading = false;
      } else {
        opacity += 0.015;
        if (opacity >= 0.9) fading = true;
      }

      requestAnimationFrame(draw);
    }

    draw();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);
    
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div
      style={{
        backgroundColor: theme.background,
        color: theme.gold,
        minHeight: "100vh",
        width: "100vw",
        margin: 0,
        padding: 0,
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <canvas
        id="fiber-cable"
        style={{ 
          position: "absolute", 
          top: 0, 
          left: 0, 
          zIndex: 0,
          pointerEvents: "none" 
        }}
      ></canvas>

      <div style={{ position: "relative", zIndex: 1, padding: "40px", maxWidth: "900px" }}>
        <img
          src="/images/logo.png"
          alt="Trulink Fiber Logo"
          style={{ width: "140px", marginBottom: "25px", filter: "drop-shadow(0 0 12px rgba(218, 165, 32, 0.25))" }}
        />

        <h1 style={{
          color: theme.gold,
          marginBottom: "45px",
          fontSize: "1.8rem", 
          fontWeight: "300", 
          letterSpacing: "3px", 
          textTransform: "uppercase" 
        }}>
          Trulink Fiber LLC
        </h1>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "25px",
            flexWrap: "wrap"
          }}
        >
          <a href="/clientes" style={{ textDecoration: "none" }}>
            <Button variant="outline-gold">Registro Cliente B2B</Button>
          </a>
          <a href="/inversores" style={{ textDecoration: "none" }}>
            <Button variant="outline-gold">Registro Inversor Estratégico</Button>
          </a>
          <a href="/login" style={{ textDecoration: "none" }}>
            <Button variant="outline-gold">Acceso con User + Pass</Button>
          </a>
        </div>

        {/* ===== SELLOS DE CONFIANZA — datos reales verificados ===== */}
        <div
          style={{
            marginTop: "50px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "18px",
          }}
        >
          <div
            style={{
              width: "60px",
              height: "1px",
              backgroundColor: theme.gold,
              opacity: 0.3,
            }}
          ></div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              alignItems: "center",
              gap: "16px",
            }}
          >
            {/* 1. TrustedSite — certificación real, verificada en producción */}
            <a
              href="https://www.trustedsite.com/verify?host=portal.trulinkfiber.org"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "0.68rem",
                color: theme.gold,
                opacity: 0.7,
                letterSpacing: "0.5px",
                border: `1px solid ${theme.gold}`,
                borderRadius: "6px",
                padding: "6px 12px",
                textDecoration: "none",
                transition: "opacity 0.3s",
              }}
            >
              ✅ TrustedSite Certified Secure
            </a>

            {/* 2. SSL Labs — A+ real, verificado 06 Aug 2026 */}
            <a
              href="https://www.ssllabs.com/ssltest/analyze.html?d=portal.trulinkfiber.org"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "0.68rem",
                color: theme.gold,
                opacity: 0.7,
                letterSpacing: "0.5px",
                border: `1px solid ${theme.gold}`,
                borderRadius: "6px",
                padding: "6px 12px",
                textDecoration: "none",
              }}
            >
              🛡️ SSL Labs — Rating A+
            </a>

            {/* 3. Mozilla Observatory — B+ (80/100) real, verificado 06 Aug 2026 */}
            <a
              href="https://developer.mozilla.org/en-US/observatory"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "0.68rem",
                color: theme.gold,
                opacity: 0.7,
                letterSpacing: "0.5px",
                border: `1px solid ${theme.gold}`,
                borderRadius: "6px",
                padding: "6px 12px",
                textDecoration: "none",
              }}
            >
              🔒 Mozilla Observatory — B+ (80/100)
            </a>

            {/* 4. Pasarelas de pago */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "0.68rem",
                color: theme.gold,
                opacity: 0.7,
                letterSpacing: "0.5px",
                border: `1px solid ${theme.gold}`,
                borderRadius: "6px",
                padding: "6px 12px",
              }}
            >
              💳 Pagos vía Stripe / PayPal
            </div>
          </div>

          <p
            style={{
              fontSize: "0.62rem",
              color: theme.gold,
              opacity: 0.4,
              letterSpacing: "0.5px",
              marginTop: "4px",
            }}
          >
            Sitio verificado y auditado por terceros independientes
          </p>
        </div>
        {/* ===== FIN SELLOS DE CONFIANZA ===== */}

        <p style={{
          marginTop: "40px",
          fontSize: "11px",
          color: theme.gold,
          letterSpacing: "1px"
        }}>
          © 2026 Marca registrada – Derechos reservados – Propiedad de Trulink Fiber LLC
        </p>
      </div>

      <style jsx global>{`
        body, html {
          background-color: #000 !important;
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}