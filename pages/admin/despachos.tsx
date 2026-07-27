import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";
import Sidebar from "../../components/admin/Sidebar";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

type DespachoItem = {
  id: string | number;
  referencia: string;
  empresa: string;
  representante: string;
  status: string;
  tipo_cotizacion?: string; // "fabrica" o "producto"
  origen_despacho?: string;
  pagado_total?: boolean;
  encargado_despacho?: string;
  supervisor?: string;
  transportista?: string;
  guia_envio?: string;
  total: number;
  created_at?: string;
};

export default function DespachosDashboard() {
  const router = useRouter();
  const [despachos, setDespachos] = useState<DespachoItem[]>([]);
  
  // Pestaña activa: "fabrica" o "producto"
  const [pestanaActiva, setPestanaActiva] = useState<"fabrica" | "producto">("fabrica");
  
  const [busqueda, setBusqueda] = useState<string>("");
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<DespachoItem | null>(null);
  const [pagadoTotalInput, setPagadoTotalInput] = useState<boolean>(false);
  const [origenInput, setOrigenInput] = useState<string>("manufactura");
  const [encargadoInput, setEncargadoInput] = useState<string>("");
  const [supervisorInput, setSupervisorInput] = useState<string>("");
  const [transportistaInput, setTransportistaInput] = useState<string>("");
  const [guiaInput, setGuiaInput] = useState<string>("");

  useEffect(() => {
    cargarDespachos();
  }, []);

  const cargarDespachos = async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("quotes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error al cargar despachos:", error);
    } else {
      setDespachos(data || []);
    }
  };

  const ejecutarDespachoEXW = async () => {
    if (!ordenSeleccionada) return;

    if (!pagadoTotalInput) {
      alert("⚠️ RESTRICCIÓN EXW: El despacho no puede realizarse. La cotización debe estar cancelada al 100% al menos 3 días antes.");
      return;
    }

    if (!encargadoInput || !supervisorInput) {
      alert("⚠️ Es obligatorio registrar al Encargado de Despacho y al Supervisor responsables.");
      return;
    }

    const { error } = await supabase
      .from("quotes")
      .update({
        pagado_total: true,
        origen_despacho: origenInput,
        encargado_despacho: encargadoInput,
        supervisor: supervisorInput,
        transportista: transportistaInput,
        guia_envio: guiaInput,
        status: "despachado_exw"
      })
      .eq("referencia", ordenSeleccionada.referencia);

    if (error) {
      alert(`Error al registrar el despacho: ${error.message}`);
    } else {
      alert("✅ Despacho autorizado bajo EXW PANAMA. Control de inventarios y trazabilidad actualizados.");
      setOrdenSeleccionada(null);
      cargarDespachos();
    }
  };

  // Filtrado estrictamente basado en la pestaña activa y barra de búsqueda
  const despachosFiltrados = despachos.filter((item) => {
    // Si no tiene tipo asignado, por defecto lo agrupamos en fábrica o según convenga, o validamos exacto:
    const tipoItem = item.tipo_cotizacion || "fabrica";
    const coincidePestana = tipoItem === pestanaActiva;
    
    const termino = busqueda.toLowerCase().trim();
    const coincideBusqueda =
      !termino ||
      (item.referencia && item.referencia.toLowerCase().includes(termino)) ||
      (item.empresa && item.empresa.toLowerCase().includes(termino)) ||
      (item.guia_envio && item.guia_envio.toLowerCase().includes(termino));

    return coincidePestana && coincideBusqueda;
  });

  // Métricas rápidas para la pestaña activa
  const totalPestana = despachos.filter(i => (i.tipo_cotizacion || "fabrica") === pestanaActiva).length;
  const despachadosPestana = despachos.filter(i => (i.tipo_cotizacion || "fabrica") === pestanaActiva && i.status === "despachado_exw").length;

  return (
    <div style={{ display: "flex", backgroundColor: "#000", minHeight: "100vh", fontFamily: "sans-serif" }}>
      <Sidebar currentActive="despachos" />

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

        {/* Encabezado de Alto Nivel */}
        <div style={{ marginBottom: "25px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "15px" }}>
          <div>
            <span style={{ fontSize: "0.7rem", color: "rgba(218, 165, 32, 0.7)", letterSpacing: "3px", textTransform: "uppercase", display: "block", marginBottom: "5px" }}>
              Trulink Fiber LLC — Logística Global
            </span>
            <h1 style={{ color: "#DAA520", fontSize: "1.5rem", fontWeight: "300", letterSpacing: "2px", textTransform: "uppercase", margin: 0 }}>
              Centro de Despachos EXW Panamá
            </h1>
          </div>
          <div style={{ display: "flex", gap: "15px" }}>
            <div style={{ backgroundColor: "#080808", border: "1px solid rgba(218, 165, 32, 0.3)", padding: "10px 15px", borderRadius: "8px", textAlign: "center" }}>
              <span style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.5)", display: "block" }}>TOTAL REGISTROS</span>
              <strong style={{ color: "#DAA520", fontSize: "1.1rem" }}>{totalPestana}</strong>
            </div>
            <div style={{ backgroundColor: "#080808", border: "1px solid rgba(46, 204, 113, 0.3)", padding: "10px 15px", borderRadius: "8px", textAlign: "center" }}>
              <span style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.5)", display: "block" }}>DESPACHADOS</span>
              <strong style={{ color: "#2ecc71", fontSize: "1.1rem" }}>{despachadosPestana}</strong>
            </div>
          </div>
        </div>

        {/* Pestañas de Navegación de Categoría (Fábrica vs Productos Terminados) */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "25px", borderBottom: "1px solid rgba(218, 165, 32, 0.2)", paddingBottom: "15px" }}>
          <button
            onClick={() => setPestanaActiva("fabrica")}
            style={{
              padding: "12px 24px",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "0.85rem",
              letterSpacing: "1px",
              textTransform: "uppercase",
              border: pestanaActiva === "fabrica" ? "1px solid #3498db" : "1px solid rgba(218, 165, 32, 0.3)",
              background: pestanaActiva === "fabrica" ? "rgba(52, 152, 219, 0.15)" : "#080808",
              color: pestanaActiva === "fabrica" ? "#3498db" : "rgba(255, 255, 255, 0.6)",
              transition: "all 0.3s ease",
              display: "flex",
              alignItem: "center",
              gap: "8px"
            }}
          >
            🏭 Línea de Fábrica <span style={{ fontSize: "0.7rem", backgroundColor: "rgba(52, 152, 219, 0.2)", padding: "2px 6px", borderRadius: "4px" }}>Materia Prima / T-FAP</span>
          </button>

          <button
            onClick={() => setPestanaActiva("producto")}
            style={{
              padding: "12px 24px",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "0.85rem",
              letterSpacing: "1px",
              textTransform: "uppercase",
              border: pestanaActiva === "producto" ? "1px solid #9b59b6" : "1px solid rgba(218, 165, 32, 0.3)",
              background: pestanaActiva === "producto" ? "rgba(155, 89, 182, 0.15)" : "#080808",
              color: pestanaActiva === "producto" ? "#9b59b6" : "rgba(255, 255, 255, 0.6)",
              transition: "all 0.3s ease",
              display: "flex",
              alignItem: "center",
              gap: "8px"
            }}
          >
            📦 Productos Terminados <span style={{ fontSize: "0.7rem", backgroundColor: "rgba(155, 89, 182, 0.2)", padding: "2px 6px", borderRadius: "4px" }}>Bodega Comercial</span>
          </button>
        </div>

        {/* Contenedor Principal de la Pestaña Activa */}
        <div className="card-item" style={{ padding: "25px", backgroundColor: "#080808" }}>
          
          {/* Banner indicador dinámico según la pestaña */}
          <div style={{ 
            backgroundColor: pestanaActiva === "fabrica" ? "rgba(52, 152, 219, 0.05)" : "rgba(155, 89, 182, 0.05)",
            border: `1px solid ${pestanaActiva === "fabrica" ? "rgba(52, 152, 219, 0.3)" : "rgba(155, 89, 182, 0.3)"}`,
            padding: "15px 20px",
            borderRadius: "8px",
            marginBottom: "20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px"
          }}>
            <div>
              <h2 style={{ fontSize: "0.95rem", color: pestanaActiva === "fabrica" ? "#3498db" : "#9b59b6", margin: "0 0 4px 0", textTransform: "uppercase", letterSpacing: "1px" }}>
                {pestanaActiva === "fabrica" ? "⚙️ Despachos de Manufactura y Fábrica" : "📦 Despachos de Productos Terminados (Bodega)"}
              </h2>
              <p style={{ fontSize: "0.75rem", color: "rgba(255, 255, 255, 0.6)", margin: 0 }}>
                {pestanaActiva === "fabrica" 
                  ? "Gestión de salidas bajo condiciones de planta, descuento directo sobre insumos y materias primas (Nylon 66 y Fibra)."
                  : "Gestión de salidas de inventario de stock disponible en bodega para entrega inmediata EXW."}
              </p>
            </div>

            <input
              type="text"
              placeholder="Buscar referencia, empresa..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{ width: "240px", padding: "8px 12px", backgroundColor: "#050505", color: "#DAA520", border: "1px solid rgba(218, 165, 32, 0.4)", borderRadius: "6px", outline: "none", fontSize: "0.8rem" }}
            />
          </div>

          {despachosFiltrados.length === 0 ? (
            <p style={{ textAlign: "center", color: "rgba(255, 255, 255, 0.5)", fontStyle: "italic", padding: "35px 0" }}>
              No se encuentran registros en esta sección de despachos.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Referencia</th>
                    <th>Empresa Cliente</th>
                    <th>Representante</th>
                    <th>Estado de Pago (EXW)</th>
                    <th>Responsables (Enc / Sup)</th>
                    <th>Guía & Estado Logístico</th>
                    <th>Acción EXW</th>
                  </tr>
                </thead>
                <tbody>
                  {despachosFiltrados.map((item) => (
                    <tr key={item.id}>
                      <td style={{ color: "#DAA520", fontWeight: "600" }}>{item.referencia}</td>
                      <td style={{ textAlign: "left" }}>{item.empresa || "N/D"}</td>
                      <td>{item.representante || "N/D"}</td>
                      <td>
                        <span style={{ padding: "4px 8px", borderRadius: "6px", fontSize: "0.7rem", fontWeight: "bold", backgroundColor: item.pagado_total ? "rgba(46, 204, 113, 0.15)" : "rgba(231, 76, 60, 0.15)", color: item.pagado_total ? "#2ecc71" : "#e74c3c" }}>
                          {item.pagado_total ? "CANCELADO 100%" : "PENDIENTE PAGO"}
                        </span>
                      </td>
                      <td style={{ fontSize: "0.75rem", textAlign: "left" }}>
                        <div><strong>Enc:</strong> {item.encargado_despacho || "Por asignar"}</div>
                        <div><strong>Sup:</strong> {item.supervisor || "Por asignar"}</div>
                      </td>
                      <td>
                        <div style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#DAA520" }}>{item.guia_envio || "S/G"}</div>
                        <span style={{ padding: "2px 6px", borderRadius: "4px", fontSize: "0.6rem", fontWeight: "bold", textTransform: "uppercase", backgroundColor: item.status === "despachado_exw" ? "rgba(46, 204, 113, 0.2)" : "rgba(241, 196, 15, 0.2)", color: item.status === "despachado_exw" ? "#2ecc71" : "#f1c40f" }}>
                          {item.status || "pendiente"}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => {
                            setOrdenSeleccionada(item);
                            setPagadoTotalInput(item.pagado_total || false);
                            setOrigenInput(pestanaActiva === "fabrica" ? "manufactura" : "bodega");
                            setEncargadoInput(item.encargado_despacho || "");
                            setSupervisorInput(item.supervisor || "");
                            setTransportistaInput(item.transportista || "");
                            setGuiaInput(item.guia_envio || "");
                          }}
                          className="gold-btn"
                          style={{ padding: "6px 12px", fontSize: "0.75rem" }}
                        >
                          Autorizar Despacho
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal de Control Ejecutivo EXW */}
        {ordenSeleccionada && (
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.85)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "20px" }}>
            <div className="card-item" style={{ width: "500px", maxWidth: "100%", maxHeight: "90vh", overflowY: "auto", padding: "30px", backgroundColor: "#0a0a0a", border: "1px solid #DAA520" }}>
              <h3 style={{ color: "#DAA520", marginTop: 0, fontSize: "1.05rem", textTransform: "uppercase", letterSpacing: "1px" }}>
                📦 Autorización de Salida EXW — {ordenSeleccionada.referencia}
              </h3>
              <p style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.7)", marginBottom: "15px" }}>
                Cliente Corporativo: <strong>{ordenSeleccionada.empresa}</strong> | Flujo: <span style={{ color: pestanaActiva === "fabrica" ? "#3498db" : "#9b59b6", textTransform: "uppercase" }}>{pestanaActiva}</span>
              </p>

              <div style={{ backgroundColor: "rgba(218, 165, 32, 0.05)", border: "1px solid rgba(218, 165, 32, 0.3)", padding: "12px", borderRadius: "6px", marginBottom: "15px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", color: "#DAA520", fontWeight: "bold", fontSize: "0.8rem" }}>
                  <input
                    type="checkbox"
                    checked={pagadoTotalInput}
                    onChange={(e) => setPagadoTotalInput(e.target.checked)}
                    style={{ width: "16px", height: "16px", accentColor: "#DAA520" }}
                  />
                  ¿Cancelado al 100% (≥ 3 días antes de la ejecución)?
                </label>
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "0.75rem", color: "#DAA520", marginBottom: "4px" }}>ORÍGEN DE INVENTARIO ASOCIADO:</label>
                <select
                  value={origenInput}
                  onChange={(e) => setOrigenInput(e.target.value)}
                  style={{ width: "100%", padding: "8px", backgroundColor: "#050505", color: "#DAA520", border: "1px solid rgba(218, 165, 32, 0.5)", borderRadius: "6px", outline: "none", fontSize: "0.8rem" }}
                >
                  <option value="manufactura">Línea de Manufactura / Fábrica (Descuenta Insumos)</option>
                  <option value="bodega">Bodega de Productos Terminados (Descuenta Stock)</option>
                </select>
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "0.75rem", color: "#DAA520", marginBottom: "4px" }}>ENCARGADO DE DESPACHO (Embalaje/Logística):</label>
                <input
                  type="text"
                  placeholder="Nombre completo del encargado..."
                  value={encargadoInput}
                  onChange={(e) => setEncargadoInput(e.target.value)}
                  style={{ width: "100%", padding: "8px", backgroundColor: "#050505", color: "#DAA520", border: "1px solid rgba(218, 165, 32, 0.5)", borderRadius: "6px", outline: "none", boxSizing: "border-box", fontSize: "0.8rem" }}
                />
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "0.75rem", color: "#DAA520", marginBottom: "4px" }}>SUPERVISOR (Control y Entrega EXW):</label>
                <input
                  type="text"
                  placeholder="Nombre del supervisor..."
                  value={supervisorInput}
                  onChange={(e) => setSupervisorInput(e.target.value)}
                  style={{ width: "100%", padding: "8px", backgroundColor: "#050505", color: "#DAA520", border: "1px solid rgba(218, 165, 32, 0.5)", borderRadius: "6px", outline: "none", boxSizing: "border-box", fontSize: "0.8rem" }}
                />
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "0.75rem", color: "#DAA520", marginBottom: "4px" }}>EMPRESA TRANSPORTISTA:</label>
                <input
                  type="text"
                  placeholder="Nombre de la transportista..."
                  value={transportistaInput}
                  onChange={(e) => setTransportistaInput(e.target.value)}
                  style={{ width: "100%", padding: "8px", backgroundColor: "#050505", color: "#DAA520", border: "1px solid rgba(218, 165, 32, 0.5)", borderRadius: "6px", outline: "none", boxSizing: "border-box", fontSize: "0.8rem" }}
                />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "0.75rem", color: "#DAA520", marginBottom: "4px" }}>NÚMERO DE GUÍA / COMPROBANTE:</label>
                <input
                  type="text"
                  placeholder="Código de guía o tracking..."
                  value={guiaInput}
                  onChange={(e) => setGuiaInput(e.target.value)}
                  style={{ width: "100%", padding: "8px", backgroundColor: "#050505", color: "#DAA520", border: "1px solid rgba(218, 165, 32, 0.5)", borderRadius: "6px", outline: "none", boxSizing: "border-box", fontSize: "0.8rem" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button onClick={() => setOrdenSeleccionada(null)} className="custom-btn" style={{ padding: "8px 16px", fontSize: "0.75rem" }}>
                  Cancelar
                </button>
                <button onClick={ejecutarDespachoEXW} className="gold-btn" style={{ padding: "8px 16px", fontSize: "0.75rem" }}>
                  Validar y Ejecutar Salida
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}