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

      ctx.beginPath();
      ctx.moveTo(0, yPosition);
      ctx.lineTo(canvas.width, yPosition);
      ctx.strokeStyle = "rgba(218, 165, 32, 0.6)";
      ctx.lineWidth = 0.75;
      ctx.shadowColor = "#FFD700";
      ctx.shadowBlur = 6;
      ctx.stroke();

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

  const sellos = [
    {
      icon: "✓",
      label: "TrustedSite",
      sub: "Certified Secure",
      href: "https://www.trustedsite.com/verify?host=portal.trulinkfiber.org",
      accent: "#4ADE80",
    },
    {
      icon: "🛡",
      label: "SSL Labs",
      sub: "Rating A+",
      href: "https://www.ssllabs.com/ssltest/analyze.html?d=portal.trulinkfiber.org",
      accent: "#60A5FA",
    },
    {
      icon: "🔒",
      label: "Mozilla Observatory",
      sub: "B+ · 80/100",
      href: "https://developer.mozilla.org/en-US/observatory",
      accent: "#DAA520",
    },
    {
      icon: "💳",
      label: "Pagos Protegidos",
      sub: "Stripe · PayPal",
      href: undefined,
      accent: "#C084FC",
    },
  ];

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
          pointerEvents: "none",
        }}
      ></canvas>

      <div style={{ position: "relative", zIndex: 1, padding: "40px", maxWidth: "900px" }}>
        <img
          src="/images/logo.png"
          alt="Trulink Fiber Logo"
          style={{ width: "140px", marginBottom: "25px", filter: "drop-shadow(0 0 12px rgba(218, 165, 32, 0.25))" }}
        />

        <h1
          style={{
            color: theme.gold,
            marginBottom: "45px",
            fontSize: "1.8rem",
            fontWeight: "300",
            letterSpacing: "3px",
            textTransform: "uppercase",
          }}
        >
          Trulink Fiber LLC
        </h1>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "25px",
            flexWrap: "wrap",
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

        {/* ===== SELLOS DE CONFIANZA ===== */}
        <div
          style={{
            marginTop: "55px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "22px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "40px",
                height: "1px",
                background: `linear-gradient(90deg, transparent, ${theme.gold})`,
                opacity: 0.4,
              }}
            />
            <span
              style={{
                fontSize: "0.6rem",
                letterSpacing: "3px",
                color: theme.gold,
                opacity: 0.45,
                textTransform: "uppercase",
              }}
            >
              Sitio Verificado
            </span>
            <div
              style={{
                width: "40px",
                height: "1px",
                background: `linear-gradient(90deg, ${theme.gold}, transparent)`,
                opacity: 0.4,
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "16px",
            }}
          >
            {sellos.map((s) => {
              const Wrapper = (s.href ? "a" : "div") as any;
              return (
                <Wrapper
                  key={s.label}
                  href={s.href}
                  target={s.href ? "_blank" : undefined}
                  rel={s.href ? "noopener noreferrer" : undefined}
                  className="sello-pill"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    textDecoration: "none",
                    background: "linear-gradient(145deg, rgba(20,20,20,0.9), rgba(8,8,8,0.95))",
                    border: "1px solid rgba(218, 165, 32, 0.25)",
                    borderRadius: "999px",
                    padding: "8px 16px 8px 8px",
                    cursor: s.href ? "pointer" : "default",
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "26px",
                      height: "26px",
                      borderRadius: "50%",
                      background: `${s.accent}22`,
                      border: `1px solid ${s.accent}66`,
                      fontSize: "0.75rem",
                      flexShrink: 0,
                    }}
                  >
                    {s.icon}
                  </span>
                  <span style={{ textAlign: "left", lineHeight: 1.25 }}>
                    <span
                      style={{
                        display: "block",
                        fontSize: "0.7rem",
                        color: theme.textLight || "#e8e8e8",
                        fontWeight: 600,
                        letterSpacing: "0.3px",
                      }}
                    >
                      {s.label}
                    </span>
                    <span style={{ display: "block", fontSize: "0.62rem", color: theme.gold, opacity: 0.6 }}>
                      {s.sub}
                    </span>
                  </span>
                </Wrapper>
              );
            })}
          </div>
        </div>
        {/* ===== FIN SELLOS DE CONFIANZA ===== */}

        <p
          style={{
            marginTop: "40px",
            fontSize: "11px",
            color: theme.gold,
            letterSpacing: "1px",
          }}
        >
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
        .sello-pill {
          transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .sello-pill:hover {
          transform: translateY(-3px);
          border-color: rgba(218, 165, 32, 0.7) !important;
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.6), 0 0 16px rgba(218, 165, 32, 0.15);
        }
      `}</style>
    </div>
  );
}
