import { useEffect } from "react";

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

      // Ajuste: Calculamos la posición Y para que quede arriba del copyright
      // Si el copyright está abajo, ponemos el hilo a un 85% de la altura total
      const yPosition = canvas.height * 0.85;

      // 1. Línea central dorada
      ctx.beginPath();
      ctx.moveTo(0, yPosition);
      ctx.lineTo(canvas.width, yPosition);
      ctx.strokeStyle = "#DAA520";
      ctx.lineWidth = 1;
      ctx.shadowColor = "#FFD700";
      ctx.shadowBlur = 4;
      ctx.stroke();

      // 2. Punto de luz
      ctx.beginPath();
      ctx.arc(pulseX, yPosition, 4, 0, Math.PI * 2, false);
      ctx.fillStyle = `rgba(255, 215, 0, ${opacity})`;
      ctx.shadowColor = "#FFD700";
      ctx.shadowBlur = 15;
      ctx.fill();

      pulseX += 2;
      if (pulseX > canvas.width) {
        pulseX = 0;
      }

      if (fading) {
        opacity -= 0.02;
        if (opacity <= 0.3) fading = false;
      } else {
        opacity += 0.02;
        if (opacity >= 1) fading = true;
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
        backgroundColor: "#000",
        color: "#DAA520",
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

      <div style={{ position: "relative", zIndex: 1, padding: "40px" }}>
        <img
          src="/images/logo.png"
          alt="Trulink Fiber Logo"
          style={{ width: "150px", marginBottom: "20px" }}
        />

        <h1 style={{ color: "#DAA520", marginBottom: "40px" }}>
          Trulink Fiber LLC
        </h1>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "30px",
            flexWrap: "wrap"
          }}
        >
          <a href="/clientes">
            <button className="trulink-btn">Registro Cliente B2B</button>
          </a>
          <a href="/inversores">
            <button className="trulink-btn">Registro Inversor Estratégico</button>
          </a>
          <a href="/login">
            <button className="trulink-btn">Acceso con User + Pass</button>
          </a>
        </div>

        {/* El hilo dorado aparecerá por encima de este párrafo */}
        <p style={{ marginTop: "60px", fontSize: "12px", color: "#DAA520" }}>
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
        .trulink-btn {
          background-color: #DAA520;
          color: #000;
          padding: 15px 30px;
          border: 2px solid transparent;
          font-weight: bold;
          border-radius: 12px;
          cursor: pointer;
          transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .trulink-btn:hover {
          transform: scale(1.05);
          border-color: #FFD700;
          box-shadow: 0 0 15px #FFD700;
        }
        .trulink-btn:active {
          transform: scale(0.95);
          border-color: #FFD700;
          box-shadow: 0 0 25px #FFD700;
        }
      `}</style>
    </div>
  );
}