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

        <p style={{
          marginTop: "65px",
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