import React, { useState } from "react";

interface ItemMateriaPrima {
  codigo: string;
  nombre: string;
  especificacion: string;
  unidad: string;
  stockActual: number;
  categoria: string;
}

export default function MateriaPrima() {
  const [tipoCableFiltro, setTipoCableFiltro] = useState<"TODOS" | "FTTH" | "ASU" | "ADSS">("TODOS");

  // Insumos estructurados por especificaciones exactas de FTTH, ASU y ADSS
  const insumosMateriaPrima: Record<string, ItemMateriaPrima[]> = {
    FTTH: [
      { codigo: "MP-FO-01", nombre: "Fibras Ópticas Coloreadas G.657.A1/A2", especificacion: "2 hilos coloreados (UV-cured)", unidad: "km", stockActual: 1500, categoria: "Fibras Ópticas" },
      { codigo: "MP-FRP-01", nombre: "Refuerzo Lateral Dieléctrico FRP (Delgado)", especificacion: "2 varillas de FRP (0.45 mm - 1.0 mm)", unidad: "km", stockActual: 3200, categoria: "Refuerzos Dieléctricos" },
      { codigo: "MP-RES-01", nombre: "Cubierta Exterior LSZH / PE UV", especificacion: "Compuesto termoplástico retardo de llama / UV", unidad: "kg", stockActual: 4500, categoria: "Resinas de Extrusión" },
      { codigo: "MP-RIP-01", nombre: "Hilo de Desgarre (Ripcord)", especificacion: "Hilo sintético de alta resistencia a la tracción", unidad: "km", stockActual: 2100, categoria: "Elementos Auxiliares" }
    ],
    ASU: [
      { codigo: "MP-FO-02", nombre: "Fibras Ópticas Coloreadas G.652.D", especificacion: "Hilos de fibra coloreada estándar", unidad: "km", stockActual: 2800, categoria: "Fibras Ópticas" },
      { codigo: "MP-PBT-01", nombre: "Tubo Holgado (Loose Tube PBT)", especificacion: "Polibutileno Tereftalato para extrusión de tubo", unidad: "kg", stockActual: 1800, categoria: "Resinas de Extrusión" },
      { codigo: "MP-GEL-01", nombre: "Gel de Relleno Hidrófugo (Tube Gel)", especificacion: "Gel tixotrópico de inyección para tubos", unidad: "kg", stockActual: 950, categoria: "Compuestos Hidrófugos" },
      { codigo: "MP-FRP-02", nombre: "Varillas de Refuerzo FRP (Gruesas)", especificacion: "2 varillas laterales gruesas de FRP (1.5 - 2.5 mm)", unidad: "km", stockActual: 1900, categoria: "Refuerzos Dieléctricos" },
      { codigo: "MP-BLO-01", nombre: "Cinta/Hilos Hinchables (Water-blocking)", especificacion: "Material superabsorbente (SAP) autosellante", unidad: "km", stockActual: 1200, categoria: "Compuestos Hidrófugos" },
      { codigo: "MP-RES-02", nombre: "Cubierta Exterior HDPE / MDPE UV", especificacion: "Polietileno de alta/media densidad baja fricción", unidad: "kg", stockActual: 6200, categoria: "Resinas de Extrusión" },
      { codigo: "MP-RIP-01", nombre: "Hilo de Desgarre (Ripcord)", especificacion: "Hilo sintético de alta resistencia a la tracción", unidad: "km", stockActual: 2100, categoria: "Elementos Auxiliares" }
    ],
    ADSS: [
      { codigo: "MP-FO-02", nombre: "Fibras Ópticas Coloreadas G.652.D", especificacion: "Hilos de fibra coloreada distribuidos por tubos", unidad: "km", stockActual: 2800, categoria: "Fibras Ópticas" },
      { codigo: "MP-CSM-01", nombre: "Núcleo Central de Refuerzo (CSM FRP)", especificacion: "Varilla central de FRP para trenzado de tubos", unidad: "km", stockActual: 850, categoria: "Refuerzos Dieléctricos" },
      { codigo: "MP-PBT-01", nombre: "Tubos Holgados PBT y Fillers", especificacion: "PBT para tubos con fibras y tubos ciegos de relleno", unidad: "kg", stockActual: 1800, categoria: "Resinas de Extrusión" },
      { codigo: "MP-GEL-01", nombre: "Compuestos de Bloqueo Hidrófugo (Gel/Cinta)", especificacion: "Gel tixotrópico y cinta hinchable alrededor del núcleo", unidad: "kg", stockActual: 950, categoria: "Compuestos Hidrófugos" },
      { codigo: "MP-RES-03", nombre: "Cubierta Interna MDPE / HDPE", especificacion: "Chaqueta interna para configuración doble cubierta", unidad: "kg", stockActual: 3400, categoria: "Resinas de Extrusión" },
      { codigo: "MP-ARAM-01", nombre: "Hilados de Aramida (Kevlar) / Glass Yarns", especificacion: "Hilados de tracción y span para resistencia de vano", unidad: "km", stockActual: 1400, categoria: "Refuerzos Dieléctricos" },
      { codigo: "MP-RES-04", nombre: "Cubierta Exterior HDPE UV / AT (Anti-Tracking)", especificacion: "HDPE resistente a UV o chaqueta AT para alto voltaje", unidad: "kg", stockActual: 5100, categoria: "Resinas de Extrusión" },
      { codigo: "MP-RIP-01", nombre: "Hilo de Desgarre (Ripcord)", especificacion: "Hilo sintético para fácil apertura de cubierta", unidad: "km", stockActual: 2100, categoria: "Elementos Auxiliares" }
    ]
  };

  const obtenerInsumosFiltrados = () => {
    if (tipoCableFiltro === "FTTH") return insumosMateriaPrima.FTTH;
    if (tipoCableFiltro === "ASU") return insumosMateriaPrima.ASU;
    if (tipoCableFiltro === "ADSS") return insumosMateriaPrima.ADSS;

    // Todos los insumos únicos combinados
    const mapaUnico = new Map<string, ItemMateriaPrima>();
    Object.values(insumosMateriaPrima).flat().forEach(item => {
      mapaUnico.set(item.codigo, item);
    });
    return Array.from(mapaUnico.values());
  };

  return (
    <div style={cardBox}>
      <div style={{ marginBottom: "20px" }}>
        <h2 style={{ color: "#DAA520", fontSize: "1.1rem", textTransform: "uppercase" }}>
          CONTROL DE BODEGA DE MATERIA PRIMA POR TIPO DE CABLE
        </h2>
        <p style={{ color: "#aaa", fontSize: "0.8rem" }}>
          Estructura de insumos (BOM) y existencias para producción de cables de fibra óptica.
        </p>
      </div>

      {/* FILTROS POR TIPO DE CABLE */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <button onClick={() => setTipoCableFiltro("TODOS")} style={tabBtn(tipoCableFiltro === "TODOS")}>TODAS LAS MATERIAS PRIMAS</button>
        <button onClick={() => setTipoCableFiltro("FTTH")} style={tabBtn(tipoCableFiltro === "FTTH")}>FTTH / FTTX DROP (2 HILOS PLANO)</button>
        <button onClick={() => setTipoCableFiltro("ASU")} style={tabBtn(tipoCableFiltro === "ASU")}>ASU AUTOSOPORTADO (MONOTUBO)</button>
        <button onClick={() => setTipoCableFiltro("ADSS")} style={tabBtn(tipoCableFiltro === "ADSS")}>ADSS DIELÉCTRICO (MULTITUBO)</button>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", color: "#fff", fontSize: "0.85rem" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid rgba(218, 165, 32, 0.4)", backgroundColor: "#000", color: "#DAA520" }}>
            <th style={thStyle}>CÓDIGO</th>
            <th style={thStyle}>MATERIAL / INSUMO</th>
            <th style={thStyle}>CATEGORÍA</th>
            <th style={thStyle}>ESPECIFICACIÓN TÉCNICA</th>
            <th style={thStyle}>CANTIDAD EN INVENTARIO</th>
            <th style={thStyle}>UNIDAD</th>
          </tr>
        </thead>
        <tbody>
          {obtenerInsumosFiltrados().map((item, idx) => (
            <tr key={idx} style={{ borderBottom: "1px solid #111" }}>
              <td style={{ ...tdStyle, color: "#DAA520", fontWeight: "bold" }}>{item.codigo}</td>
              <td style={tdStyle}>{item.nombre}</td>
              <td style={tdStyle}>{item.categoria}</td>
              <td style={tdStyle}>{item.especificacion}</td>
              <td style={{ ...tdStyle, color: "#2ecc71", fontWeight: "bold", fontSize: "0.95rem" }}>
                {item.stockActual.toLocaleString()}
              </td>
              <td style={tdStyle}>{item.unidad}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const cardBox: React.CSSProperties = { backgroundColor: "#080808", border: "1px solid rgba(218, 165, 32, 0.3)", borderRadius: "8px", padding: "20px" };
const thStyle: React.CSSProperties = { padding: "10px", fontSize: "0.75rem", textTransform: "uppercase" };
const tdStyle: React.CSSProperties = { padding: "10px" };
const tabBtn = (isActive: boolean): React.CSSProperties => ({
  backgroundColor: isActive ? "#DAA520" : "transparent",
  color: isActive ? "#000" : "#DAA520",
  border: "1px solid #DAA520",
  borderRadius: "4px",
  padding: "8px 14px",
  fontWeight: "bold",
  fontSize: "0.75rem",
  cursor: "pointer"
});