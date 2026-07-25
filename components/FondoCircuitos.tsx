export default function FondoCircuitos() {
  return (
    <>
      <svg className="circuito-bg" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="circuit-pattern" width="180" height="180" patternUnits="userSpaceOnUse" viewBox="0 0 200 200">
            <g className="base-path">
              <path d="M0 20 h40 l40 40 v50 l-30 30 h-50 M0 28 h36 l40 40 v50 l-30 30 h-46 M0 36 h32 l40 40 v50 l-30 30 h-42" />
              <path d="M200 30 v40 l-40 40 h-30 v50 l35 35 M200 38 v36 l-40 40 h-30 v50 l35 35" />
              <path d="M100 0 v20 l-25 25 h-15 v40 l20 20 h40 v40 M40 200 v-30 l30 -30 v-40 l-15 -15 h-55" />
            </g>
            <g>
              <path className="foton f1" d="M0 20 h40 l40 40 v50 l-30 30 h-50" />
              <path className="foton f2" d="M200 30 v40 l-40 40 h-30 v50 l35 35" />
              <path className="foton f3" d="M100 0 v20 l-25 25 h-15 v40 l20 20 h40 v40" />
              <path className="foton f4" d="M40 200 v-30 l30 -30 v-40 l-15 -15 h-55" />
            </g>
            <g>
              <path className="rayo-linea r1" d="M0 28 h36 l40 40 v50 l-30 30 h-46" />
              <path className="rayo-linea r2" d="M200 38 v36 l-40 40 h-30 v50 l35 35" />
            </g>
            <circle className="nodo" cx="80" cy="60" r="2.3" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#circuit-pattern)" />
      </svg>

      <style jsx global>{`
        .circuito-bg {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          z-index: 0;
          pointer-events: none;
        }
        .circuito-bg pattern g {
          stroke: #d4af37;
          stroke-width: 1.2;
          stroke-linecap: round;
          stroke-linejoin: round;
          fill: none;
        }
        .base-path { stroke-opacity: 0.14; }
        
        .foton {
          stroke-opacity: 0;
          stroke: #d4af37;
          stroke-dasharray: 20 800;
          animation: viajarFoton linear infinite;
        }
        .f1 { animation-duration: 12s; animation-delay: 0s; }
        .f2 { animation-duration: 15s; animation-delay: 5s; animation-direction: reverse; }
        .f3 { animation-duration: 14s; animation-delay: 2s; }
        .f4 { animation-duration: 18s; animation-delay: 7s; }

        .rayo-linea {
          stroke: #d4af37;
          stroke-width: 1.3; 
          stroke-opacity: 0;
          stroke-dasharray: 30 700;
          filter: drop-shadow(0 0 2px #d4af37);
          animation: correrRayoCircuito linear infinite;
        }
        .r1 { animation-duration: 9s; animation-delay: 1s; }
        .r2 { animation-duration: 11s; animation-delay: 4s; animation-direction: reverse; }

        .nodo {
          fill: #d4af37;
          fill-opacity: 0.05;
          transform-origin: center;
          animation: brillarNodo 6s ease-in-out infinite alternate; 
          animation-delay: 0.5s;
        }

        @keyframes viajarFoton {
          0% { opacity: 0; stroke-dashoffset: 820; filter: drop-shadow(0 0 1px #d4af37); }
          10% { opacity: 0.15; }
          90% { opacity: 0.15; }
          100% { opacity: 0; stroke-dashoffset: -820; filter: drop-shadow(0 0 2px #d4af37); }
        }

        @keyframes correrRayoCircuito {
          0% { stroke-dashoffset: 730; stroke-opacity: 0; }
          15% { stroke-opacity: 0.18; }
          85% { stroke-opacity: 0.18; }
          100% { stroke-dashoffset: -730; stroke-opacity: 0; }
        }
        
        @keyframes brillarNodo {
          0% { fill-opacity: 0.03; r: 2.2; filter: none; }
          45% { fill-opacity: 0.3; r: 2.8; filter: drop-shadow(0 0 2px #d4af37); }
          90%, 100% { fill-opacity: 0.03; r: 2.2; filter: none; }
        }
      `}</style>
    </>
  );
}