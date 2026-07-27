import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

type OrdenManufactura = {
  id: string | number;
  referencia: string;
  empresa: string;
  representante: string;
  status: string;
  fecha_estimada_entrega: string;
  total: number;
  created_at?: string;
};

export default function ManufacturaDashboard() {
  const router = useRouter();
  const [ordenes, setOrdenes] = useState<OrdenManufactura[]>([]);
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [busqueda, setBusqueda] = useState<string>("");

  useEffect(() => {
    cargarOrdenesManufactura();
  }, []);

  const cargarOrdenesManufactura = async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("quotes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error al cargar órdenes de manufactura:", error);
    } else {
      setOrdenes(data || []);
    }
  };

  const actualizarEstado = async (referencia: string, nuevoEstado: string) => {
    const { error } = await supabase
      .from("quotes")
      .update({ status: nuevoEstado })
      .eq("referencia", referencia);

    if (error) {
      alert(`Error al actualizar estado: ${error.message}`);
    } else {
      cargarOrdenesManufactura();
    }
  };

  const ordenesFiltradas = ordenes.filter((orden) => {
    const coincideEstado = filtroEstado === "todos" || orden.status === filtroEstado;
    const termino = busqueda.toLowerCase().trim();
    const coincideBusqueda =
      !termino ||
      (orden.referencia && orden.referencia.toLowerCase().includes(termino)) ||
      (orden.empresa && orden.empresa.toLowerCase().includes(termino));
    return coincideEstado && coincideBusqueda;
  });

  return (
    <div style={{ backgroundColor: "#000", color: "#DAA520", minHeight: "100vh", padding: "50px 30px", fontFamily: "sans-serif" }}>
      <style jsx global>{`
        html, body {
          margin: 0;
          padding: 0;
          background-color: #000 !important;
          color: #DAA520;
        }
        .card-item {
          background-color: #080808;
          border: 1px solid rgba(218, 165, 32, 0.3);
          border-radius: 12px;
          transition: all 0.3s ease;
        }
        .card-item:hover {
          border-color: #DAA520;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8), 0 0 20px rgba(218, 165, 32, 0.2);
        }
        .custom-btn {
          background-color: transparent;
          color: #DAA520;
          border: 1px solid rgba(218, 165, 32, 0.5);
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 0.85rem;
          letter-spacing: 0.5px;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        .custom-btn:hover {
          background-color: #DAA520 !important;
          color: #000 !important;
          box-shadow: 0 0 15px rgba(218, 165, 32, 0.4);
        }
        .gold-btn {
          background-color: #DAA520;
          color: #000;
          border: none;
          padding: 10px 18px;
          border-radius: 8px;
          font-weight: bold;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        .gold-btn:hover {
          background-color: #f1c40f;
          box-shadow: 0 0 15px rgba(218, 165, 32, 0.4);
        }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid rgba(218, 165, 32, 0.3); padding: 12px; text-align: center; color: #FFF; font-size: 0.9rem; }
        th { background-color: #111; color: #DAA520; font-weight: 600; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 1px; }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px", maxWidth: "1200px", margin: "0 auto 40px auto", flexWrap: "wrap", gap: "15px" }}>
        <button onClick={() => router.push("/admin")} className="custom-btn">
          ← Volver al Panel Admin
        </button>
        <button onClick={() => router.push("/despachos")} className="custom-btn" style={{ borderColor: "#2ecc71", color: "#2ecc71" }}>
          📦 Ir a Módulo de Despachos
        </button>
      </div>

      <div style={{ textAlign: "center", marginBottom: "40px" }}>
        <h1 style={{ color: "#DAA520", fontSize: "1.5rem", fontWeight: "300", letterSpacing: "2px", textTransform: "uppercase", margin: 0 }}>
          DASHBOARD PRINCIPAL DE MANUFACTURA
        </h1>
      </div>

      {/* Estado general de insumos / sistema T-FAP */}
      <div className="card-item" style={{ maxWidth: "1200px", margin: "0 auto 30px auto", padding: "25px 30px" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: "500", color: "#DAA520", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "15px", marginTop: 0 }}>
          ⚙️ Estado de Planta y Línea T-FAP (100% Nylon y Fibra)
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "20px" }}>
          <div style={{ backgroundColor: "#050505", padding: "12px 18px", borderRadius: "8px", border: "1px solid rgba(218, 165, 32, 0.2)" }}>
            <span style={{ fontSize: "0.75rem", color: "rgba(255, 255, 255, 0.5)", display: "block", marginBottom: "4px" }}>ESTADO DE LÍNEA</span>
            <strong style={{ color: "#FFF", fontSize: "0.9rem" }}>Línea de Producción:</strong> <span style={{ color: "#2ecc71", fontSize: "0.85rem" }}>Operativa (100%)</span>
          </div>
          <div style={{ backgroundColor: "#050505", padding: "12px 18px", borderRadius: "8px", border: "1px solid rgba(218, 165, 32, 0.2)" }}>
            <span style={{ fontSize: "0.75rem", color: "rgba(255, 255, 255, 0.5)", display: "block", marginBottom: "4px" }}>MATERIA PRIMA</span>
            <strong style={{ color: "#FFF", fontSize: "0.9rem" }}>Nylon 66 / Insumos:</strong> <span style={{ color: "#2ecc71", fontSize: "0.85rem" }}>Stock Disponible</span>
          </div>
          <div style={{ backgroundColor: "#050505", padding: "12px 18px", borderRadius: "8px", border: "1px solid rgba(218, 165, 32, 0.2)" }}>
            <span style={{ fontSize: "0.75rem", color: "rgba(255, 255, 255, 0.5)", display: "block", marginBottom: "4px" }}>CONTROL TÉCNICO</span>
            <strong style={{ color: "#FFF", fontSize: "0.9rem" }}>Estructura Metal-Free:</strong> <span style={{ color: "#2ecc71", fontSize: "0.85rem" }}>Verificado</span>
          </div>
        </div>
      </div>

      {/* Tabla de Órdenes de Cotizaciones vinculadas a Manufactura */}
      <div className="card-item" style={{ maxWidth: "1200px", margin: "0 auto", padding: "30px", backgroundColor: "#080808" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "25px", flexWrap: "wrap", gap: "15px" }}>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {["todos", "pending", "en_produccion", "completado"].map((estado) => (
              <button
                key={estado}
                onClick={() => setFiltroEstado(estado)}
                className="custom-btn"
                style={{
                  backgroundColor: filtroEstado === estado ? "#DAA520" : "transparent",
                  color: filtroEstado === estado ? "#000" : "#DAA520",
                  textTransform: "uppercase",
                  fontSize: "0.7rem",
                  padding: "8px 14px"
                }}
              >
                {estado === "todos" ? "Todas" : estado.replace("_", " ")}
              </button>
            ))}
          </div>

          <input
            type="text"
            placeholder="Filtrar por referencia o empresa..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ width: "280px", padding: "9px 12px", backgroundColor: "#050505", color: "#DAA520", border: "1px solid rgba(218, 165, 32, 0.5)", borderRadius: "8px", outline: "none", fontSize: "0.85rem" }}
          />
        </div>

        {ordenesFiltradas.length === 0 ? (
          <p style={{ textAlign: "center", color: "rgba(255, 255, 255, 0.5)", fontStyle: "italic", padding: "30px 0" }}>
            No hay órdenes de manufactura en este filtro.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Referencia</th>
                  <th>Empresa</th>
                  <th>Representante</th>
                  <th>Entrega Estimada</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th>Acción de Planta</th>
                </tr>
              </thead>
              <tbody>
                {ordenesFiltradas.map((ord) => (
                  <tr key={ord.id}>
                    <td style={{ color: "#DAA520", fontWeight: "600" }}>{ord.referencia}</td>
                    <td style={{ textAlign: "left" }}>{ord.empresa || "N/D"}</td>
                    <td>{ord.representante || "N/D"}</td>
                    <td>{ord.fecha_estimada_entrega || "Por definir"}</td>
                    <td style={{ fontWeight: "600" }}>${Number(ord.total || 0).toFixed(2)}</td>
                    <td>
                      <span style={{ padding: "4px 8px", borderRadius: "6px", fontSize: "0.7rem", fontWeight: "bold", textTransform: "uppercase", backgroundColor: ord.status === "completado" ? "rgba(46, 204, 113, 0.2)" : ord.status === "en_produccion" ? "rgba(241, 196, 15, 0.2)" : "rgba(231, 76, 60, 0.2)", color: ord.status === "completado" ? "#2ecc71" : ord.status === "en_produccion" ? "#f1c40f" : "#e74c3c" }}>
                        {ord.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                        {ord.status !== "en_produccion" && (
                          <button onClick={() => actualizarEstado(ord.referencia, "en_produccion")} className="gold-btn" style={{ padding: "5px 10px", fontSize: "0.75rem" }}>
                            Iniciar
                          </button>
                        )}
                        {ord.status !== "completado" && (
                          <button onClick={() => actualizarEstado(ord.referencia, "completado")} className="custom-btn" style={{ padding: "5px 10px", fontSize: "0.75rem", borderColor: "#2ecc71", color: "#2ecc71" }}>
                            Completar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}