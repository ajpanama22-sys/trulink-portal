import { useEffect, useState } from "react";
import { getSupabase } from "../../../lib/supabaseClient";
import { theme } from "../../../lib/theme";
import { Card, Button, Badge, inputStyle } from "../../../lib/ui";

type ProveedorHomolog = {
  id: string;
  nombre: string;
  email: string | null;
  tipo_insumo: string | null;
  pais: string | null;
  estado_homologacion: string;
  observaciones_homologacion: string | null;
  portal_activo: boolean;
  auth_user_id: string | null;
};

const labelStyle = {
  display: "block", fontSize: "0.66rem", color: theme.textMuted,
  marginBottom: "5px", textTransform: "uppercase" as const, letterSpacing: "0.5px",
};

export default function Homologacion() {
  const supabase = getSupabase();
  const [proveedores, setProveedores] = useState<ProveedorHomolog[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState<"Pendiente" | "En Revisión" | "Homologado" | "Rechazado" | "TODOS">("Pendiente");

  const [modalAcceso, setModalAcceso] = useState<{ open: boolean; proveedor: ProveedorHomolog | null }>({ open: false, proveedor: null });
  const [emailAcceso, setEmailAcceso] = useState("");
  const [passwordAcceso, setPasswordAcceso] = useState("");
  const [creandoAcceso, setCreandoAcceso] = useState(false);

  const cargar = async () => {
    if (!supabase) { setCargando(false); return; }
    setCargando(true);
    const { data, error } = await supabase
      .from("proveedores")
      .select("id, nombre, email, tipo_insumo, pais, estado_homologacion, observaciones_homologacion, portal_activo, auth_user_id")
      .order("id", { ascending: false });
    if (error) console.error(error.message);
    setProveedores(data || []);
    setCargando(false);
  };

  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, []);

  const cambiarEstado = async (p: ProveedorHomolog, estado: string) => {
    if (!supabase) return;
    const obs = estado === "Rechazado" ? prompt("Motivo del rechazo (se guarda como observación):") : null;
    const { error } = await supabase.from("proveedores").update({
      estado_homologacion: estado,
      estado: estado === "Homologado" ? "Activo" : estado === "Rechazado" ? "Inactivo" : "Pendiente",
      fecha_homologacion: estado === "Homologado" ? new Date().toISOString() : null,
      observaciones_homologacion: obs,
    }).eq("id", p.id);
    if (error) return alert("Error: " + error.message);
    cargar();
  };

  const abrirCrearAcceso = (p: ProveedorHomolog) => {
    setModalAcceso({ open: true, proveedor: p });
    setEmailAcceso(p.email || "");
    setPasswordAcceso("");
  };

  const crearAcceso = async () => {
    const p = modalAcceso.proveedor;
    if (!p) return;
    if (!emailAcceso || passwordAcceso.length < 8) {
      return alert("Correo requerido y contraseña de al menos 8 caracteres.");
    }
    setCreandoAcceso(true);
    try {
      const res = await fetch("/api/proveedores/crear-acceso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proveedorId: p.id, email: emailAcceso, password: passwordAcceso }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error desconocido");
      alert(`Acceso creado para ${p.nombre}.\n\nCompárteles:\nUsuario: ${emailAcceso}\nContraseña: ${passwordAcceso}\n\nURL: /vendor-portal/login`);
      setModalAcceso({ open: false, proveedor: null });
      cargar();
    } catch (err: any) {
      alert("Error al crear el acceso: " + err.message);
    } finally {
      setCreandoAcceso(false);
    }
  };

  const filtrados = proveedores.filter((p) => filtro === "TODOS" || p.estado_homologacion === filtro);

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
        <h3 style={{ color: theme.gold, fontSize: "1rem", textTransform: "uppercase", margin: 0 }}>
          Homologación de Proveedores ({filtrados.length})
        </h3>
        <select style={{ ...inputStyle, width: "auto" }} value={filtro} onChange={(e) => setFiltro(e.target.value as any)}>
          <option value="Pendiente">Pendientes</option>
          <option value="En Revisión">En revisión</option>
          <option value="Homologado">Homologados</option>
          <option value="Rechazado">Rechazados</option>
          <option value="TODOS">Todos</option>
        </select>
      </div>

      {cargando ? (
        <p style={{ color: theme.textMuted, textAlign: "center", padding: "30px" }}>Cargando...</p>
      ) : filtrados.length === 0 ? (
        <p style={{ color: theme.textMuted, textAlign: "center", padding: "30px" }}>No hay proveedores en este estado.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
            <thead>
              <tr>
                {["Fábrica", "Categoría", "País", "Estado", "Portal", "Acciones"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "10px", color: theme.gold, fontSize: "0.68rem", textTransform: "uppercase", borderBottom: "1px solid rgba(218,165,32,0.25)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => (
                <tr key={p.id}>
                  <td style={{ padding: "10px", borderBottom: "1px solid #141414" }}>
                    <div style={{ color: theme.gold, fontWeight: 700 }}>{p.nombre}</div>
                    <div style={{ fontSize: "0.7rem", color: "#888" }}>{p.email}</div>
                  </td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #141414" }}>{p.tipo_insumo || "—"}</td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #141414" }}>{p.pais || "—"}</td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #141414" }}>
                    <Badge tone={p.estado_homologacion === "Homologado" ? "success" : p.estado_homologacion === "Rechazado" ? "danger" : "gold"}>
                      {p.estado_homologacion}
                    </Badge>
                  </td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #141414" }}>
                    {p.portal_activo ? <span style={{ color: theme.green, fontSize: "0.75rem" }}>✓ Activo</span> : <span style={{ color: "#666", fontSize: "0.75rem" }}>Sin acceso</span>}
                  </td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #141414", whiteSpace: "nowrap" }}>
                    {p.estado_homologacion !== "Homologado" && p.estado_homologacion !== "Rechazado" && (
                      <>
                        <Button variant="outline-green" style={{ padding: "5px 10px", fontSize: "0.7rem", marginRight: "6px" }}
                          onClick={() => cambiarEstado(p, "En Revisión")}>En revisión</Button>
                        <Button variant="gold" style={{ padding: "5px 10px", fontSize: "0.7rem", marginRight: "6px" }}
                          onClick={() => cambiarEstado(p, "Homologado")}>Homologar</Button>
                        <Button variant="outline-red" style={{ padding: "5px 10px", fontSize: "0.7rem" }}
                          onClick={() => cambiarEstado(p, "Rechazado")}>Rechazar</Button>
                      </>
                    )}
                    {p.estado_homologacion === "Homologado" && !p.portal_activo && (
                      <Button variant="gold" style={{ padding: "5px 10px", fontSize: "0.7rem" }} onClick={() => abrirCrearAcceso(p)}>
                        + Crear acceso Vendor Portal
                      </Button>
                    )}
                    {p.estado_homologacion === "Homologado" && p.portal_activo && (
                      <Button variant="ghost" style={{ padding: "5px 10px", fontSize: "0.7rem" }} onClick={() => abrirCrearAcceso(p)}>
                        Restablecer contraseña
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalAcceso.open && modalAcceso.proveedor && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
          <div style={{ background: theme.panelBg, border: `1px solid ${theme.borderGoldCounter}`, borderRadius: theme.radiusLg, padding: "26px", width: "100%", maxWidth: "420px" }}>
            <h3 style={{ color: theme.gold, marginTop: 0 }}>Acceso al Vendor Portal</h3>
            <p style={{ color: "#bbb", fontSize: "0.82rem", marginBottom: "16px" }}>{modalAcceso.proveedor.nombre}</p>

            <label style={labelStyle}>Correo (usuario)</label>
            <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box", marginBottom: "12px" }}
              value={emailAcceso} onChange={(e) => setEmailAcceso(e.target.value)} />

            <label style={labelStyle}>Contraseña (mínimo 8 caracteres)</label>
            <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box", marginBottom: "18px" }}
              type="text" value={passwordAcceso} onChange={(e) => setPasswordAcceso(e.target.value)}
              placeholder="Genera o escribe una contraseña temporal" />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <Button variant="ghost" onClick={() => setModalAcceso({ open: false, proveedor: null })}>Cancelar</Button>
              <Button variant="gold" disabled={creandoAcceso} onClick={crearAcceso}>
                {creandoAcceso ? "Creando..." : "Crear / Actualizar acceso"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
