import React, { useState, useEffect } from "react";

interface CuentaCatalogo {
  id: number;
  codigo: string;
  nombre: string;
  tipo: "ACTIVO" | "PASIVO" | "INGRESO" | "GASTO";
  activa: boolean;
}

const colorTipo: Record<string, string> = {
  ACTIVO: "#29B6F6",
  PASIVO: "#e74c3c",
  INGRESO: "#2ecc71",
  GASTO: "#DAA520",
};

export default function PlanCuentas() {
  const [cuentas, setCuentas] = useState<CuentaCatalogo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState<string>("TODOS");
  const [nombreNueva, setNombreNueva] = useState("");
  const [tipoNueva, setTipoNueva] = useState("GASTO");
  const [creando, setCreando] = useState(false);

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setCargando(true);
    try {
      const r = await fetch("/api/admin/listar-cuentas");
      const d = await r.json();
      setCuentas(d.cuentas || []);
    } catch (e) {
      console.error("Error cargando plan de cuentas:", e);
    } finally {
      setCargando(false);
    }
  };

  const crearCuenta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreNueva.trim()) return;
    setCreando(true);
    try {
      const r = await fetch("/api/admin/crear-cuenta-contable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombreNueva, tipo: tipoNueva }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setCuentas((prev) => [...prev, d.cuenta].sort((a, b) => a.codigo.localeCompare(b.codigo)));
      setNombreNueva("");
    } catch (err: any) {
      alert(`No se pudo crear la cuenta: ${err.message}`);
    } finally {
      setCreando(false);
    }
  };

  const cuentasFiltradas = filtroTipo === "TODOS" ? cuentas : cuentas.filter((c) => c.tipo === filtroTipo);

  return (
    <div>
      {/* Formulario para agregar cuenta nueva */}
      <div style={{ background: "#111", border: "1px solid rgba(218, 165, 32, 0.3)", borderRadius: "10px", padding: "18px", marginBottom: "25px" }}>
        <h3 style={{ color: "#DAA520", marginTop: 0, fontSize: "0.95rem", textTransform: "uppercase", letterSpacing: "0.8px" }}>
          ➕ Agregar Cuenta Contable Nueva
        </h3>
        <form onSubmit={crearCuenta} style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: 1, minWidth: "220px" }}>
            <label style={{ display: "block", fontSize: "0.72rem", color: "#aaa", marginBottom: "4px", textTransform: "uppercase" }}>Nombre de la cuenta</label>
            <input
              type="text"
              placeholder="Ej. Certificaciones y Licencias"
              value={nombreNueva}
              onChange={(e) => setNombreNueva(e.target.value)}
              style={{ width: "100%", background: "#0d0d0d", border: "1px solid rgba(218,165,32,0.5)", borderRadius: "6px", padding: "9px 12px", color: "#FFD700", fontSize: "0.85rem", boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.72rem", color: "#aaa", marginBottom: "4px", textTransform: "uppercase" }}>Tipo</label>
            <select
              value={tipoNueva}
              onChange={(e) => setTipoNueva(e.target.value)}
              style={{ background: "#0d0d0d", border: "1px solid rgba(218,165,32,0.5)", borderRadius: "6px", padding: "9px 12px", color: "#FFD700", fontSize: "0.85rem" }}
            >
              <option value="GASTO">Gasto</option>
              <option value="INGRESO">Ingreso</option>
              <option value="ACTIVO">Activo</option>
              <option value="PASIVO">Pasivo</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={creando}
            style={{ background: "#DAA520", color: "#000", border: "none", padding: "10px 18px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "0.82rem" }}
          >
            {creando ? "Creando..." : "Crear Cuenta"}
          </button>
        </form>
      </div>

      {/* Filtro por tipo */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "15px" }}>
        {["TODOS", "GASTO", "INGRESO", "ACTIVO", "PASIVO"].map((t) => (
          <button
            key={t}
            onClick={() => setFiltroTipo(t)}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              border: filtroTipo === t ? "1px solid #DAA520" : "1px solid #333",
              background: filtroTipo === t ? "#DAA520" : "#111",
              color: filtroTipo === t ? "#000" : "#DAA520",
              fontWeight: "bold",
              cursor: "pointer",
              fontSize: "0.78rem",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tabla del catálogo */}
      <div style={{ overflowX: "auto", border: "1px solid rgba(218, 165, 32, 0.2)", borderRadius: "8px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", color: "#fff", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ background: "#181818", borderBottom: "1px solid rgba(218, 165, 32, 0.3)", color: "#DAA520" }}>
              <th style={{ padding: "12px 15px", textAlign: "left" }}>Código</th>
              <th style={{ padding: "12px 15px", textAlign: "left" }}>Nombre de la Cuenta</th>
              <th style={{ padding: "12px 15px", textAlign: "left" }}>Tipo</th>
              <th style={{ padding: "12px 15px", textAlign: "center" }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr><td colSpan={4} style={{ padding: "30px", textAlign: "center", color: "#777" }}>Cargando catálogo...</td></tr>
            ) : cuentasFiltradas.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: "30px", textAlign: "center", color: "#777" }}>No hay cuentas registradas para este filtro.</td></tr>
            ) : (
              cuentasFiltradas.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid #1a1a1a" }}>
                  <td style={{ padding: "12px 15px", fontFamily: "monospace", color: "#DAA520", fontWeight: 700 }}>{c.codigo}</td>
                  <td style={{ padding: "12px 15px" }}>{c.nombre}</td>
                  <td style={{ padding: "12px 15px" }}>
                    <span style={{ color: colorTipo[c.tipo], fontWeight: 600, fontSize: "0.78rem" }}>{c.tipo}</span>
                  </td>
                  <td style={{ padding: "12px 15px", textAlign: "center" }}>
                    <span style={{
                      background: c.activa ? "rgba(46, 204, 113, 0.15)" : "rgba(231, 76, 60, 0.15)",
                      color: c.activa ? "#2ecc71" : "#e74c3c",
                      padding: "3px 10px", borderRadius: "4px", fontSize: "0.72rem", fontWeight: "bold",
                    }}>
                      {c.activa ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}