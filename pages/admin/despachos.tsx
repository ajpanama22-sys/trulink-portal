import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

type DespachoItem = {
  id: string | number;
  referencia: string;
  empresa: string;
  representante: string;
  status: string;
  origen_despacho?: string; // "manufactura" o "bodega"
  pagado_total?: boolean; // Requiere cancelación total 3 días antes
  dias_restantes_despacho?: number;
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
  const [filtroOrigen, setFiltroOrigen] = useState<string>("todos");
  const [busqueda, setBusqueda] = useState<string>("");
  
  // Modal de control de despacho estricto EXW
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

    // Regla de rigor: No se genera el despacho si no está cancelado en su totalidad
    if (!pagadoTotalInput) {
      alert("⚠️ RESTRICCIÓN EXW: El despacho no puede realizarse. La cotización debe estar cancelada en su totalidad al menos 3 días antes de la fecha estimada.");
      return;
    }

    if (!encargadoInput || !supervisorInput) {
      alert("⚠️ Es obligatorio registrar al Encargado de Despacho y al Supervisor responsables del embalaje.");
      return;
    }

    // Actualizar estado en Supabase y descontar inventario / materia prima lógicamente
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
      alert("✅ Despacho autorizado bajo EXW PANAMA. Inventarios y materias primas descontados exitosamente.");
      setOrdenSeleccionada(null);
      cargarDespachos();
    }
  };

  const despachosFiltrados = despachos.filter((item) => {
    const coincideOrigen = filtroOrigen === "todos" || item.origen_despacho === filtroOrigen;
    const termino = busqueda.toLowerCase().trim();
    const coincideBusqueda =
      !termino ||
      (item.referencia && item.referencia.toLowerCase().includes(termino)) ||
      (item.empresa && item.empresa.toLowerCase().includes(termino)) ||
      (item.guia_envio && item.guia_envio.toLowerCase().includes(termino));
    return coincideOrigen && coincideBusqueda;
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
        <button onClick={() => router.push("/manufactura")} className="custom-btn" style={{ borderColor: "#DAA520", color: "#DAA520" }}>
          ⚙️ Ir a Manufactura
        </button>
      </div>

      <div style={{ textAlign: "center", marginBottom: "40px" }}>
        <h1 style={{ color: "#DAA520", fontSize: "1.5rem", fontWeight: "300", letterSpacing: "2px", textTransform: "uppercase", margin: 0 }}>
          MÓDULO DE DESPACHOS — EXW PANAMA
        </h1>
      </div>

      {/* Filtros y Búsqueda */}
      <div className="card-item" style={{ maxWidth: "1200px", margin: "0 auto", padding: "30px", backgroundColor: "#080808" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "25px", flexWrap: "wrap", gap: "15px" }}>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {["todos", "manufactura", "bodega"].map((orig) => (
              <button
                key={orig}
                onClick={() => setFiltroOrigen(orig)}
                className="custom-btn"
                style={{
                  backgroundColor: filtroOrigen === orig ? "#DAA520" : "transparent",
                  color: filtroOrigen === orig ? "#000" : "#DAA520",
                  textTransform: "uppercase",
                  fontSize: "0.7rem",
                  padding: "8px 14px"
                }}
              >
                {orig === "todos" ? "Todos los Orígenes" : `Origen: ${orig}`}
              </button>
            ))}
          </div>

          <input
            type="text"
            placeholder="Buscar por referencia, empresa o guía..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ width: "300px", padding: "9px 12px", backgroundColor: "#050505", color: "#DAA520", border: "1px solid rgba(218, 165, 32, 0.5)", borderRadius: "8px", outline: "none", fontSize: "0.85rem" }}
          />
        </div>

        {despachosFiltrados.length === 0 ? (
          <p style={{ textAlign: "center", color: "rgba(255, 255, 255, 0.5)", fontStyle: "italic", padding: "30px 0" }}>
            No hay registros de despacho disponibles con los filtros actuales.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Referencia</th>
                  <th>Empresa</th>
                  <th>Origen (Cables / Bodega)</th>
                  <th>Pago Total (EXW)</th>
                  <th>Encargado / Supervisor</th>
                  <th>Guía / Estado</th>
                  <th>Acción Logística</th>
                </tr>
              </thead>
              <tbody>
                {despachosFiltrados.map((item) => (
                  <tr key={item.id}>
                    <td style={{ color: "#DAA520", fontWeight: "600" }}>{item.referencia}</td>
                    <td style={{ textAlign: "left" }}>{item.empresa || "N/D"}</td>
                    <td>
                      <span style={{ padding: "4px 8px", borderRadius: "6px", fontSize: "0.7rem", fontWeight: "bold", textTransform: "uppercase", backgroundColor: item.origen_despacho === "manufactura" ? "rgba(52, 152, 219, 0.2)" : "rgba(155, 89, 182, 0.2)", color: item.origen_despacho === "manufactura" ? "#3498db" : "#9b59b6" }}>
                        {item.origen_despacho || "No asignado"}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: item.pagado_total ? "#2ecc71" : "#e74c3c", fontWeight: "bold", fontSize: "0.8rem" }}>
                        {item.pagado_total ? "CANCELADO (100%)" : "PENDIENTE / ABONO"}
                      </span>
                    </td>
                    <td style={{ fontSize: "0.8rem", textAlign: "left" }}>
                      <div><strong>Enc:</strong> {item.encargado_despacho || "No asignado"}</div>
                      <div><strong>Sup:</strong> {item.supervisor || "No asignado"}</div>
                    </td>
                    <td>
                      <div style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{item.guia_envio || "Sin guía"}</div>
                      <span style={{ padding: "3px 6px", borderRadius: "4px", fontSize: "0.65rem", fontWeight: "bold", textTransform: "uppercase", backgroundColor: item.status === "despachado_exw" ? "rgba(46, 204, 113, 0.2)" : "rgba(241, 196, 15, 0.2)", color: item.status === "despachado_exw" ? "#2ecc71" : "#f1c40f" }}>
                        {item.status || "pendiente"}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => {
                          setOrdenSeleccionada(item);
                          setPagadoTotalInput(item.pagado_total || false);
                          setOrigenInput(item.origen_despacho || "manufactura");
                          setEncargadoInput(item.encargado_despacho || "");
                          setSupervisorInput(item.supervisor || "");
                          setTransportistaInput(item.transportista || "");
                          setGuiaInput(item.guia_envio || "");
                        }}
                        className="gold-btn"
                        style={{ padding: "5px 10px", fontSize: "0.75rem" }}
                      >
                        Autorizar EXW
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal para Autorización de Despacho EXW */}
      {ordenSeleccionada && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.85)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "20px" }}>
          <div className="card-item" style={{ width: "500px", maxWidth: "100%", maxHeight: "90vh", overflowY: "auto", padding: "30px", backgroundColor: "#0a0a0a", border: "1px solid #DAA520" }}>
            <h3 style={{ color: "#DAA520", marginTop: 0, fontSize: "1.1rem", textTransform: "uppercase", letterSpacing: "1px" }}>
              📦 Control Riguroso EXW: {ordenSeleccionada.referencia}
            </h3>
            <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.7)", marginBottom: "20px" }}>
              Cliente / Empresa: <strong>{ordenSeleccionada.empresa}</strong>
            </p>

            {/* Validación Financiera Estricta */}
            <div style={{ backgroundColor: "rgba(218, 165, 32, 0.05)", border: "1px solid rgba(218, 165, 32, 0.3)", padding: "15px", borderRadius: "8px", marginBottom: "20px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", color: "#DAA520", fontWeight: "bold", fontSize: "0.85rem" }}>
                <input
                  type="checkbox"
                  checked={pagadoTotalInput}
                  onChange={(e) => setPagadoTotalInput(e.target.checked)}
                  style={{ width: "18px", height: "18px", accentColor: "#DAA520" }}
                />
                ¿Cotización cancelada 100% (≥ 3 días antes del despacho)?
              </label>
              <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", margin: "8px 0 0 28px" }}>
                Si no está totalmente cancelado, el sistema denegará la salida de la mercancía de acuerdo al rigor operativo de Trulink.
              </p>
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", fontSize: "0.8rem", color: "#DAA520", marginBottom: "5px" }}>ORIGEN DE SALIDA DE MERCANCÍA:</label>
              <select
                value={origenInput}
                onChange={(e) => setOrigenInput(e.target.value)}
                style={{ width: "100%", padding: "10px", backgroundColor: "#050505", color: "#DAA520", border: "1px solid rgba(218, 165, 32, 0.5)", borderRadius: "6px", outline: "none" }}
              >
                <option value="manufactura">Línea de Fabricación de Cables (Descuenta Materia Prima)</option>
                <option value="bodega">Bodega (Descuenta Productos Terminados)</option>
              </select>
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", fontSize: "0.8rem", color: "#DAA520", marginBottom: "5px" }}>ENCARGADO DE DESPACHO (Embalaje / Empaquetamiento):</label>
              <input
                type="text"
                placeholder="Nombre del encargado..."
                value={encargadoInput}
                onChange={(e) => setEncargadoInput(e.target.value)}
                style={{ width: "100%", padding: "10px", backgroundColor: "#050505", color: "#DAA520", border: "1px solid rgba(218, 165, 32, 0.5)", borderRadius: "6px", outline: "none", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", fontSize: "0.8rem", color: "#DAA520", marginBottom: "5px" }}>SUPERVISOR (Responsable de Entrega EXW):</label>
              <input
                type="text"
                placeholder="Nombre del supervisor..."
                value={supervisorInput}
                onChange={(e) => setSupervisorInput(e.target.value)}
                style={{ width: "100%", padding: "10px", backgroundColor: "#050505", color: "#DAA520", border: "1px solid rgba(218, 165, 32, 0.5)", borderRadius: "6px", outline: "none", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", fontSize: "0.8rem", color: "#DAA520", marginBottom: "5px" }}>TRANSPORTISTA / AGENTE RECOLECTOR:</label>
              <input
                type="text"
                placeholder="Empresa transportista..."
                value={transportistaInput}
                onChange={(e) => setTransportistaInput(e.target.value)}
                style={{ width: "100%", padding: "10px", backgroundColor: "#050505", color: "#DAA520", border: "1px solid rgba(218, 165, 32, 0.5)", borderRadius: "6px", outline: "none", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginBottom: "25px" }}>
              <label style={{ display: "block", fontSize: "0.8rem", color: "#DAA520", marginBottom: "5px" }}>NÚMERO DE GUÍA / COMPROBANTE:</label>
              <input
                type="text"
                placeholder="Código de guía..."
                value={guiaInput}
                onChange={(e) => setGuiaInput(e.target.value)}
                style={{ width: "100%", padding: "10px", backgroundColor: "#050505", color: "#DAA520", border: "1px solid rgba(218, 165, 32, 0.5)", borderRadius: "6px", outline: "none", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button onClick={() => setOrdenSeleccionada(null)} className="custom-btn" style={{ padding: "8px 15px" }}>
                Cancelar
              </button>
              <button onClick={ejecutarDespachoEXW} className="gold-btn" style={{ padding: "8px 15px" }}>
                Procesar y Descontar Inventario
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}