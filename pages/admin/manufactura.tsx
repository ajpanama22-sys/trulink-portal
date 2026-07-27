import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";
import Sidebar from "../../components/admin/Sidebar";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

type OrdenManufactura = {
  id: string | number;
  referencia: string;
  empresa: string;
  representante: string;
  status: string;
  tipo_cotizacion?: string; // "fabrica" o "producto"
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
      // Filtrar estrictamente solo las de tipo fábrica
      const soloFabrica = (data || []).filter(
        (item) => item.tipo_cotizacion === "fabrica" || !item.tipo_cotizacion // Tolerancia inicial si no estuviera mapeado
      );
      setOrdenes(soloFabrica);
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
    <div style={{ display: "flex", backgroundColor: "#000", minHeight: "100vh", fontFamily: "sans-serif" }}>
      <Sidebar currentActive="manufactura" />

      <main style={{ flex: 1, padding: "40px 30px", color: "#DAA520", boxSizing: "border-box", overflowX: "auto" }}>
        <style jsx global>{`
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
            padding: 8px 16px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 0.8rem;
            cursor: pointer;
            transition: all 0.3s ease;
          }
          .custom-btn:hover {
            background-color: #DAA520 !important;
            color: #000 !important;
          }
          .gold-btn {
            background-color: #DAA520;
            color: #000;
            border: none;
            padding: 8px 14px;
            border-radius: 8px;
            font-weight: bold;
            font-size: 0.8rem;
            cursor: pointer;
            transition: all 0.3s ease;
          }
          .gold-btn:hover {
            background-color: #f1c40f;
          }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid rgba(218, 165, 32, 0.3); padding: 12px; text-align: center; color: #FFF; font-size: 0.9rem; }
          th { background-color: #111; color: #DAA520; font-weight: 600; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 1px; }
        `}</style>

        <div style={{ marginBottom: "30px" }}>
          <h1 style={{ color: "#DAA520", fontSize: "1.4rem", fontWeight: "300", letterSpacing: "2px", textTransform: "uppercase", margin: 0 }}>
            PANEL DE MANUFACTURA (LÍNEA DE FÁBRICA Y MATERIA PRIMA)
          </h1>
        </div>

        {/* Estado de Insumos / T-FAP */}
        <div className="card-item" style={{ padding: "20px 25px", marginBottom: "25px" }}>
          <h2 style={{ fontSize: "0.95rem", fontWeight: "500", color: "#DAA520", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "12px", marginTop: 0 }}>
            ⚙️ Insumos Activos de Planta (Nylon 66 & Fibra Óptica)
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "15px" }}>
            <div style={{ backgroundColor: "#050505", padding: "10px 15px", borderRadius: "6px", border: "1px solid rgba(218, 165, 32, 0.2)" }}>
              <span style={{ fontSize: "0.7rem", color: "rgba(255, 255, 255, 0.5)", display: "block" }}>ESTRUCTURA</span>
              <strong style={{ color: "#FFF", fontSize: "0.85rem" }}>Nylon 66:</strong> <span style={{ color: "#2ecc71", fontSize: "0.8rem" }}>Stock Óptimo</span>
            </div>
            <div style={{ backgroundColor: "#050505", padding: "10px 15px", borderRadius: "6px", border: "1px solid rgba(218, 165, 32, 0.2)" }}>
              <span style={{ fontSize: "0.7rem", color: "rgba(255, 255, 255, 0.5)", display: "block" }}>NÚCLEO</span>
              <strong style={{ color: "#FFF", fontSize: "0.85rem" }}>Fibra Óptica:</strong> <span style={{ color: "#2ecc71", fontSize: "0.8rem" }}>Stock Óptimo</span>
            </div>
          </div>
        </div>

        {/* Listado de Órdenes */}
        <div className="card-item" style={{ padding: "25px", backgroundColor: "#080808" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "15px" }}>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {["todos", "pending", "en_produccion", "completado"].map((estado) => (
                <button
                  key={estado}
                  onClick={() => setFiltroEstado(estado)}
                  className="custom-btn"
                  style={{
                    backgroundColor: filtroEstado === estado ? "#DAA520" : "transparent",
                    color: filtroEstado === estado ? "#000" : "#DAA520",
                    textTransform: "uppercase",
                    fontSize: "0.65rem",
                    padding: "6px 12px"
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
              style={{ width: "260px", padding: "8px 10px", backgroundColor: "#050505", color: "#DAA520", border: "1px solid rgba(218, 165, 32, 0.5)", borderRadius: "6px", outline: "none", fontSize: "0.8rem" }}
            />
          </div>

          {ordenesFiltradas.length === 0 ? (
            <p style={{ textAlign: "center", color: "rgba(255, 255, 255, 0.5)", fontStyle: "italic", padding: "25px 0" }}>
              No hay órdenes de manufactura de fábrica registradas.
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
                    <th>Acción Planta</th>
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
                        <span style={{ padding: "4px 8px", borderRadius: "6px", fontSize: "0.65rem", fontWeight: "bold", textTransform: "uppercase", backgroundColor: ord.status === "completado" ? "rgba(46, 204, 113, 0.2)" : ord.status === "en_produccion" ? "rgba(241, 196, 15, 0.2)" : "rgba(231, 76, 60, 0.2)", color: ord.status === "completado" ? "#2ecc71" : ord.status === "en_produccion" ? "#f1c40f" : "#e74c3c" }}>
                          {ord.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                          {ord.status !== "en_produccion" && (
                            <button onClick={() => actualizarEstado(ord.referencia, "en_produccion")} className="gold-btn" style={{ padding: "4px 8px", fontSize: "0.7rem" }}>
                              Iniciar
                            </button>
                          )}
                          {ord.status !== "completado" && (
                            <button onClick={() => actualizarEstado(ord.referencia, "completado")} className="custom-btn" style={{ padding: "4px 8px", fontSize: "0.7rem", borderColor: "#2ecc71", color: "#2ecc71" }}>
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
      </main>
    </div>
  );
}