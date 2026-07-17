import { useEffect } from "react";

export default function Home() {
  useEffect(() => {
    const canvas = document.getElementById("fiber-cable");
    const ctx = canvas.getContext("2d");

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const startX = 100;
    const startY = canvas.height / 2;
    const endX = canvas.width - 100;
    const endY = canvas.height / 2;

    let pulseX = startX;
    let opacity = 1;
    let fading = true;

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Cable delgado dorado
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = "#DAA520";
      ctx.lineWidth = 1.5; // más delgado
      ctx.shadowColor = "#FFD700";
      ctx.shadowBlur = 6;
      ctx.stroke();

      // Haz de luz titilante
      ctx.beginPath();
      ctx.arc(pulseX, startY, 6, 0, Math.PI * 2, false);
      ctx.fillStyle = `rgba(255, 215, 0, ${opacity})`; // dorado con opacidad variable
      ctx.shadowColor = "#FFD700";
      ctx.shadowBlur = 25;
      ctx.fill();

      // Movimiento del pulso
      pulseX += 3;
      if (pulseX > endX) {
        pulseX = startX;
      }

      // Titileo (sube y baja opacidad)
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
  }, []);

  return (
    <div
      style={{
        backgroundColor: "#000",
        color: "#DAA520",
        minHeight: "100vh",
        textAlign: "center",
        padding: "40px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Canvas cable de fibra */}
      <canvas
        id="fiber-cable"
        style={{ position: "absolute", top: 0, left: 0, zIndex: 0 }}
      ></canvas>

      {/* Logo */}
      <img
        src="/images/logo.png"
        alt="Trulink Fiber Logo"
        style={{
          width: "150px",
          marginBottom: "20px",
          position: "relative",
          zIndex: 1,
        }}
      />

      {/* Nombre institucional */}
      <h1
        style={{
          color: "#DAA520",
          marginBottom: "40px",
          position: "relative",
          zIndex: 1,
        }}
      >
        Trulink Fiber LLC
      </h1>

      {/* Botones principales */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "30px",
          position: "relative",
          zIndex: 1,
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

      {/* Footer institucional */}
      <p
        style={{
          marginTop: "60px",
          fontSize: "12px",
          color: "#DAA520",
          position: "relative",
          zIndex: 1,
        }}
      >
        © 2026 Marca registrada – Derechos reservados – Propiedad de Trulink Fiber LLC
      </p>

      {/* Estilos CSS */}
      <style jsx>{`
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
