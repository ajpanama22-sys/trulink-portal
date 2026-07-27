import React, { useState } from "react";

interface ItemMateriaPrima {
  codigo: string;
  nombre: string;
  especificacion: string;
  unidad: string;
  stockActual: number;
  categoria: string;
}

interface CompraMateriaPrima {
  id: string;
  fecha: string;
  codigoInsumo: string;
  nombreInsumo: string;
  cantidadComprada: number;
  unidad: string;
  proveedor: string;
  numeroFactura: string;
  costoTotal: number;
  estadoPago: "PENDIENTE" | "PAGADO";
}

interface AjusteInventario {
  id: string;
  fecha: string;
  codigoInsumo: string;
  nombreInsumo: string;
  cantidadAnterior: number;
  cantidadNueva: number;
  diferencia: number;
  motivo: string;
}

export default function MateriaPrima() {
  const [tipoCableFiltro, setTipoCableFiltro] = useState<"TODOS" | "FTTH" | "ASU" | "ADSS">("TODOS");

  // Estados principales de inventario estructurados
  const [insumosMateriaPrima, setInsumosMateriaPrima] = useState<Record<string, ItemMateriaPrima[]>>({
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
  });

  // Historiales para enlaces de pagos y auditoría
  const [historialCompras, setHistorialCompras] = useState<CompraMateriaPrima[]>([
    { id: "OC-501", fecha: "2026-07-20", codigoInsumo: "MP-FO-01", nombreInsumo: "Fibras Ópticas Coloreadas G.657.A1/A2", cantidadComprada: 500, unidad: "km", proveedor: "NH Link Corp", numeroFactura: "FAC-9921", costoTotal: 12500, estadoPago: "PAGADO" },
    { id: "OC-502", fecha: "2026-07-25", codigoInsumo: "MP-RES-01", nombreInsumo: "Cubierta Exterior LSZH / PE UV", cantidadComprada: 1000, unidad: "kg", proveedor: "Asia Fiber Tech", numeroFactura: "FAC-8812", costoTotal: 4800, estadoPago: "PENDIENTE" }
  ]);

  const [historialAjustes, setHistorialAjustes] = useState<AjusteInventario[]>([]);

  // Estados de Modales
  const [modalCompraOpen, setModalCompraOpen] = useState(false);
  const [modalNuevoItemOpen, setModalNuevoItemOpen] = useState(false);
  const [modalAjusteOpen, setModalAjusteOpen] = useState(false);
  const [modalPagosOpen, setModalPagosOpen] = useState(false);
  const [modalBitacoraOpen, setModalBitacoraOpen] = useState(false);

  // Formulario: Registrar Compra
  const [formCompra, setFormCompra] = useState({
    codigoInsumo: "MP-FO-01",
    cantidadComprada: 100,
    proveedor: "",
    numeroFactura: "",
    costoTotal: 0,
    estadoPago: "PENDIENTE" as "PENDIENTE" | "PAGADO"
  });

  // Formulario: Nuevo Ítem
  const [formNuevoItem, setFormNuevoItem] = useState({
    codigo: "",
    nombre: "",
    especificacion: "",
    unidad: "km",
    stockActual: 0,
    categoria: "Fibras Ópticas",
    asignarCable: ["FTTH"] as string[]
  });

  // Formulario: Ajuste de Inventario
  const [itemSeleccionado, setItemSeleccionado] = useState<ItemMateriaPrima | null>(null);
  const [cantidadAjuste, setCantidadAjuste] = useState<number>(0);
  const [motivoAjuste, setMotivoAjuste] = useState<string>("");

  // Obtener lista consolidada de insumos únicos
  const obtenerInsumosUnicos = () => {
    const mapaUnico = new Map<string, ItemMateriaPrima>();
    Object.values(insumosMateriaPrima).flat().forEach(item => {
      mapaUnico.set(item.codigo, item);
    });
    return Array.from(mapaUnico.values());
  };

  const obtenerInsumosFiltrados = () => {
    if (tipoCableFiltro === "FTTH") return insumosMateriaPrima.FTTH;
    if (tipoCableFiltro === "ASU") return insumosMateriaPrima.ASU;
    if (tipoCableFiltro === "ADSS") return insumosMateriaPrima.ADSS;
    return obtenerInsumosUnicos();
  };

  // Manejador para Registrar Compra y actualizar stock automáticamente
  const handleRegistrarCompra = (e: React.FormEvent) => {
    e.preventDefault();
    const insumosUnicos = obtenerInsumosUnicos();
    const itemEncontrado = insumosUnicos.find(i => i.codigo === formCompra.codigoInsumo);
    if (!itemEncontrado) return;

    const nuevaCompra: CompraMateriaPrima = {
      id: `OC-${Math.floor(100 + Math.random() * 900)}`,
      fecha: new Date().toISOString().split("T")[0],
      codigoInsumo: itemEncontrado.codigo,
      nombreInsumo: itemEncontrado.nombre,
      cantidadComprada: Number(formCompra.cantidadComprada),
      unidad: itemEncontrado.unidad,
      proveedor: formCompra.proveedor || "Proveedor General",
      numeroFactura: formCompra.numeroFactura || "S/N",
      costoTotal: Number(formCompra.costoTotal),
      estadoPago: formCompra.estadoPago
    };

    setHistorialCompras([nuevaCompra, ...historialCompras]);

    // Actualizar stock en todas las categorías donde aplique el insumo
    setInsumosMateriaPrima(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(cat => {
        updated[cat] = updated[cat].map(item => {
          if (item.codigo === formCompra.codigoInsumo) {
            return { ...item, stockActual: item.stockActual + Number(formCompra.cantidadComprada) };
          }
          return item;
        });
      });
      return updated;
    });

    setModalCompraOpen(false);
    setFormCompra({ codigoInsumo: "MP-FO-01", cantidadComprada: 100, proveedor: "", numeroFactura: "", costoTotal: 0, estadoPago: "PENDIENTE" });
  };

  // Manejador para Crear Nuevo Ítem
  const handleCrearItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNuevoItem.codigo || !formNuevoItem.nombre) return;

    const nuevoItem: ItemMateriaPrima = {
      codigo: formNuevoItem.codigo.toUpperCase(),
      nombre: formNuevoItem.nombre,
      especificacion: formNuevoItem.especificacion,
      unidad: formNuevoItem.unidad,
      stockActual: Number(formNuevoItem.stockActual),
      categoria: formNuevoItem.categoria
    };

    setInsumosMateriaPrima(prev => {
      const updated = { ...prev };
      formNuevoItem.asignarCable.forEach(tipo => {
        if (updated[tipo]) {
          updated[tipo] = [...updated[tipo], nuevoItem];
        }
      });
      return updated;
    });

    setModalNuevoItemOpen(false);
    setFormNuevoItem({ codigo: "", nombre: "", especificacion: "", unidad: "km", stockActual: 0, categoria: "Fibras Ópticas", asignarCable: ["FTTH"] });
  };

  // Manejador para Ajuste Manual de Cantidades
  const handleGuardarAjuste = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemSeleccionado) return;

    const stockAnterior = itemSeleccionado.stockActual;
    const nuevaCantidad = Number(cantidadAjuste);
    const diferencia = nuevaCantidad - stockAnterior;

    const nuevoRegistroAjuste: AjusteInventario = {
      id: `AJ-${Math.floor(100 + Math.random() * 900)}`,
      fecha: new Date().toISOString().split("T")[0],
      codigoInsumo: itemSeleccionado.codigo,
      nombreInsumo: itemSeleccionado.nombre,
      cantidadAnterior: stockAnterior,
      cantidadNueva: nuevaCantidad,
      diferencia: diferencia,
      motivo: motivoAjuste || "Ajuste manual de inventario"
    };

    setHistorialAjustes([nuevoRegistroAjuste, ...historialAjustes]);

    setInsumosMateriaPrima(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(cat => {
        updated[cat] = updated[cat].map(item => {
          if (item.codigo === itemSeleccionado.codigo) {
            return { ...item, stockActual: nuevaCantidad };
          }
          return item;
        });
      });
      return updated;
    });

    setModalAjusteOpen(false);
    setItemSeleccionado(null);
    setCantidadAjuste(0);
    setMotivoAjuste("");
  };

  return (
    <div style={cardBox}>
      <div style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h2 style={{ color: "#DAA520", fontSize: "1.1rem", textTransform: "uppercase" }}>
            CONTROL DE BODEGA DE MATERIA PRIMA POR TIPO DE CABLE
          </h2>
          <p style={{ color: "#aaa", fontSize: "0.8rem" }}>
            Estructura de insumos (BOM), existencias, compras vinculadas a pagos y ajustes de planta.
          </p>
        </div>
        {/* BOTONERA DE ACCIONES PRINCIPALES */}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button onClick={() => setModalCompraOpen(true)} style={actionBtn("#DAA520", "#000")}>
            + Registrar Compra
          </button>
          <button onClick={() => setModalNuevoItemOpen(true)} style={actionBtn("transparent", "#DAA520")}>
            + Nuevo Insumo
          </button>
          <button onClick={() => setModalPagosOpen(true)} style={actionBtn("transparent", "#2ecc71")}>
            Pagos a Proveedores ({historialCompras.filter(c => c.estadoPago === "PENDIENTE").length} Pend.)
          </button>
          <button onClick={() => setModalBitacoraOpen(true)} style={actionBtn("transparent", "#3498db")}>
            Bitácora de Ajustes
          </button>
        </div>
      </div>

      {/* FILTROS POR TIPO DE CABLE */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
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
            <th style={thStyle}>ACCIONES / AJUSTE</th>
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
              <td style={tdStyle}>
                <button 
                  onClick={() => {
                    setItemSeleccionado(item);
                    setCantidadAjuste(item.stockActual);
                    setModalAjusteOpen(true);
                  }}
                  style={adjustBtnStyle}
                  title="Ajustar cantidad en inventario"
                >
                  ⚙️ Ajustar Stock
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* MODAL 1: REGISTRAR COMPRA Y ENLACE A PAGOS */}
      {modalCompraOpen && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h3 style={{ color: "#DAA520", marginBottom: "15px" }}>Registrar Compra de Materia Prima</h3>
            <form onSubmit={handleRegistrarCompra}>
              <div style={formGroup}>
                <label style={labelStyle}>Seleccionar Insumo:</label>
                <select 
                  value={formCompra.codigoInsumo} 
                  onChange={e => setFormCompra({ ...formCompra, codigoInsumo: e.target.value })}
                  style={inputStyle}
                >
                  {obtenerInsumosUnicos().map(i => (
                    <option key={i.codigo} value={i.codigo}>{i.codigo} - {i.nombre}</option>
                  ))}
                </select>
              </div>
              <div style={formGroup}>
                <label style={labelStyle}>Cantidad Comprada:</label>
                <input 
                  type="number" 
                  value={formCompra.cantidadComprada} 
                  onChange={e => setFormCompra({ ...formCompra, cantidadComprada: Number(e.target.value) })}
                  style={inputStyle}
                  required
                />
              </div>
              <div style={formGroup}>
                <label style={labelStyle}>Proveedor:</label>
                <input 
                  type="text" 
                  placeholder="Ej. NH Link Corp" 
                  value={formCompra.proveedor} 
                  onChange={e => setFormCompra({ ...formCompra, proveedor: e.target.value })}
                  style={inputStyle}
                  required
                />
              </div>
              <div style={formGroup}>
                <label style={labelStyle}>N° de Factura / Orden:</label>
                <input 
                  type="text" 
                  placeholder="Ej. FAC-1024" 
                  value={formCompra.numeroFactura} 
                  onChange={e => setFormCompra({ ...formCompra, numeroFactura: e.target.value })}
                  style={inputStyle}
                  required
                />
              </div>
              <div style={formGroup}>
                <label style={labelStyle}>Costo Total ($):</label>
                <input 
                  type="number" 
                  value={formCompra.costoTotal} 
                  onChange={e => setFormCompra({ ...formCompra, costoTotal: Number(e.target.value) })}
                  style={inputStyle}
                  required
                />
              </div>
              <div style={formGroup}>
                <label style={labelStyle}>Estado del Pago (Módulo Proveedores):</label>
                <select 
                  value={formCompra.estadoPago} 
                  onChange={e => setFormCompra({ ...formCompra, estadoPago: e.target.value as "PENDIENTE" | "PAGADO" })}
                  style={inputStyle}
                >
                  <option value="PENDIENTE">PENDIENTE DE PAGO</option>
                  <option value="PAGADO">PAGADO</option>
                </select>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
                <button type="button" onClick={() => setModalCompraOpen(false)} style={cancelBtnStyle}>Cancelar</button>
                <button type="submit" style={submitBtnStyle}>Guardar y Sumar al Stock</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CREAR NUEVO ÍTEM DE MATERIA PRIMA */}
      {modalNuevoItemOpen && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h3 style={{ color: "#DAA520", marginBottom: "15px" }}>Crear Nuevo Ítem de Materia Prima</h3>
            <form onSubmit={handleCrearItem}>
              <div style={formGroup}>
                <label style={labelStyle}>Código (Ej. MP-FO-03):</label>
                <input 
                  type="text" 
                  value={formNuevoItem.codigo} 
                  onChange={e => setFormNuevoItem({ ...formNuevoItem, codigo: e.target.value })}
                  style={inputStyle}
                  required
                />
              </div>
              <div style={formGroup}>
                <label style={labelStyle}>Nombre del Material:</label>
                <input 
                  type="text" 
                  value={formNuevoItem.nombre} 
                  onChange={e => setFormNuevoItem({ ...formNuevoItem, nombre: e.target.value })}
                  style={inputStyle}
                  required
                />
              </div>
              <div style={formGroup}>
                <label style={labelStyle}>Categoría:</label>
                <select 
                  value={formNuevoItem.categoria} 
                  onChange={e => setFormNuevoItem({ ...formNuevoItem, categoria: e.target.value })}
                  style={inputStyle}
                >
                  <option value="Fibras Ópticas">Fibras Ópticas</option>
                  <option value="Refuerzos Dieléctricos">Refuerzos Dieléctricos</option>
                  <option value="Resinas de Extrusión">Resinas de Extrusión</option>
                  <option value="Compuestos Hidrófugos">Compuestos Hidrófugos</option>
                  <option value="Elementos Auxiliares">Elementos Auxiliares</option>
                </select>
              </div>
              <div style={formGroup}>
                <label style={labelStyle}>Especificación Técnica:</label>
                <input 
                  type="text" 
                  value={formNuevoItem.especificacion} 
                  onChange={e => setFormNuevoItem({ ...formNuevoItem, especificacion: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div style={formGroup}>
                <label style={labelStyle}>Unidad:</label>
                <select 
                  value={formNuevoItem.unidad} 
                  onChange={e => setFormNuevoItem({ ...formNuevoItem, unidad: e.target.value })}
                  style={inputStyle}
                >
                  <option value="km">km</option>
                  <option value="kg">kg</option>
                  <option value="m">m</option>
                  <option value="litros">litros</option>
                </select>
              </div>
              <div style={formGroup}>
                <label style={labelStyle}>Stock Inicial:</label>
                <input 
                  type="number" 
                  value={formNuevoItem.stockActual} 
                  onChange={e => setFormNuevoItem({ ...formNuevoItem, stockActual: Number(e.target.value) })}
                  style={inputStyle}
                />
              </div>
              <div style={formGroup}>
                <label style={labelStyle}>Asociar a Tipos de Cable (BOM):</label>
                <div style={{ display: "flex", gap: "15px", color: "#fff", fontSize: "0.8rem", marginTop: "5px" }}>
                  {["FTTH", "ASU", "ADSS"].map(tipo => (
                    <label key={tipo}>
                      <input 
                        type="checkbox" 
                        checked={formNuevoItem.asignarCable.includes(tipo)}
                        onChange={e => {
                          const list = e.target.checked 
                            ? [...formNuevoItem.asignarCable, tipo]
                            : formNuevoItem.asignarCable.filter(t => t !== tipo);
                          setFormNuevoItem({ ...formNuevoItem, asignarCable: list });
                        }}
                      /> {tipo}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
                <button type="button" onClick={() => setModalNuevoItemOpen(false)} style={cancelBtnStyle}>Cancelar</button>
                <button type="submit" style={submitBtnStyle}>Crear Insumo</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: AJUSTE MANUAL DE CANTIDADES */}
      {modalAjusteOpen && itemSeleccionado && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h3 style={{ color: "#DAA520", marginBottom: "15px" }}>Ajustar Stock: {itemSeleccionado.codigo}</h3>
            <p style={{ color: "#aaa", fontSize: "0.8rem", marginBottom: "15px" }}>
              Material: {itemSeleccionado.nombre} <br />
              Stock Actual en Sistema: <strong style={{ color: "#2ecc71" }}>{itemSeleccionado.stockActual} {itemSeleccionado.unidad}</strong>
            </p>
            <form onSubmit={handleGuardarAjuste}>
              <div style={formGroup}>
                <label style={labelStyle}>Nueva Cantidad Física:</label>
                <input 
                  type="number" 
                  value={cantidadAjuste} 
                  onChange={e => setCantidadAjuste(Number(e.target.value))}
                  style={inputStyle}
                  required
                />
              </div>
              <div style={formGroup}>
                <label style={labelStyle}>Motivo del Ajuste (Merma, Auditoría, Conteo):</label>
                <input 
                  type="text" 
                  placeholder="Ej. Conteo físico trimestral / Merma de extrusión" 
                  value={motivoAjuste} 
                  onChange={e => setMotivoAjuste(e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
                <button type="button" onClick={() => setModalAjusteOpen(false)} style={cancelBtnStyle}>Cancelar</button>
                <button type="submit" style={submitBtnStyle}>Aplicar Ajuste</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: CONTROL DE PAGOS A PROVEEDORES */}
      {modalPagosOpen && (
        <div style={modalOverlay}>
          <div style={{ ...modalContent, width: "700px", maxWidth: "90%" }}>
            <h3 style={{ color: "#DAA520", marginBottom: "15px" }}>Módulo de Pagos a Proveedores (Compras de Materia Prima)</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", color: "#fff", fontSize: "0.8rem", marginBottom: "20px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(218, 165, 32, 0.4)", color: "#DAA520" }}>
                  <th style={thStyle}>OC / Factura</th>
                  <th style={thStyle}>Fecha</th>
                  <th style={thStyle}>Proveedor</th>
                  <th style={thStyle}>Insumo</th>
                  <th style={thStyle}>Total ($)</th>
                  <th style={thStyle}>Estado</th>
                  <th style={thStyle}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {historialCompras.map((compra, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #222" }}>
                    <td style={tdStyle}>{compra.id} ({compra.numeroFactura})</td>
                    <td style={tdStyle}>{compra.fecha}</td>
                    <td style={tdStyle}>{compra.proveedor}</td>
                    <td style={tdStyle}>{compra.nombreInsumo}</td>
                    <td style={tdStyle}>${compra.costoTotal.toLocaleString()}</td>
                    <td style={{ ...tdStyle, color: compra.estadoPago === "PAGADO" ? "#2ecc71" : "#e74c3c", fontWeight: "bold" }}>
                      {compra.estadoPago}
                    </td>
                    <td style={tdStyle}>
                      {compra.estadoPago === "PENDIENTE" && (
                        <button 
                          onClick={() => {
                            setHistorialCompras(historialCompras.map(c => c.id === compra.id ? { ...c, estadoPago: "PAGADO" } : c));
                          }}
                          style={{ backgroundColor: "#2ecc71", color: "#000", border: "none", padding: "4px 8px", borderRadius: "4px", cursor: "pointer", fontSize: "0.7rem", fontWeight: "bold" }}
                        >
                          Marcar Pagado
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setModalPagosOpen(false)} style={cancelBtnStyle}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: BITÁCORA DE AJUSTES */}
      {modalBitacoraOpen && (
        <div style={modalOverlay}>
          <div style={{ ...modalContent, width: "700px", maxWidth: "90%" }}>
            <h3 style={{ color: "#DAA520", marginBottom: "15px" }}>Bitácora de Ajustes de Materia Prima</h3>
            {historialAjustes.length === 0 ? (
              <p style={{ color: "#aaa", fontSize: "0.85rem", padding: "10px 0" }}>No se han registrado ajustes manuales en esta sesión.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", color: "#fff", fontSize: "0.8rem", marginBottom: "20px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(218, 165, 32, 0.4)", color: "#DAA520" }}>
                    <th style={thStyle}>Fecha</th>
                    <th style={thStyle}>Código / Insumo</th>
                    <th style={thStyle}>Anterior</th>
                    <th style={thStyle}>Nuevo</th>
                    <th style={thStyle}>Diferencia</th>
                    <th style={thStyle}>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {historialAjustes.map((aj, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #222" }}>
                      <td style={tdStyle}>{aj.fecha}</td>
                      <td style={tdStyle}>{aj.codigoInsumo}</td>
                      <td style={tdStyle}>{aj.cantidadAnterior}</td>
                      <td style={tdStyle}>{aj.cantidadNueva}</td>
                      <td style={{ ...tdStyle, color: aj.diferencia >= 0 ? "#2ecc71" : "#e74c3c", fontWeight: "bold" }}>
                        {aj.diferencia > 0 ? `+${aj.diferencia}` : aj.diferencia}
                      </td>
                      <td style={tdStyle}>{aj.motivo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setModalBitacoraOpen(false)} style={cancelBtnStyle}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const cardBox: React.CSSProperties = { backgroundColor: "#080808", border: "1px solid rgba(218, 165, 32, 0.3)", borderRadius: "8px", padding: "20px" };
const thStyle: React.CSSProperties = { padding: "10px", fontSize: "0.75rem", textTransform: "uppercase", textAlign: "left" };
const tdStyle: React.CSSProperties = { padding: "10px", textAlign: "left" };
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
const actionBtn = (bg: string, color: string): React.CSSProperties => ({
  backgroundColor: bg,
  color: color,
  border: "1px solid #DAA520",
  borderRadius: "4px",
  padding: "8px 12px",
  fontWeight: "bold",
  fontSize: "0.75rem",
  cursor: "pointer"
});
const adjustBtnStyle: React.CSSProperties = {
  backgroundColor: "transparent",
  color: "#DAA520",
  border: "1px solid rgba(218, 165, 32, 0.5)",
  borderRadius: "4px",
  padding: "4px 8px",
  fontSize: "0.75rem",
  cursor: "pointer"
};
const modalOverlay: React.CSSProperties = {
  position: "fixed",
  top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: "rgba(0,0,0,0.8)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000
};
const modalContent: React.CSSProperties = {
  backgroundColor: "#121212",
  border: "1px solid #DAA520",
  borderRadius: "8px",
  padding: "25px",
  width: "450px",
  maxWidth: "90%",
  boxShadow: "0 4px 20px rgba(218, 165, 32, 0.2)"
};
const formGroup: React.CSSProperties = {
  marginBottom: "15px",
  display: "flex",
  flexDirection: "column" as const
};
const labelStyle: React.CSSProperties = {
  color: "#DAA520",
  fontSize: "0.75rem",
  marginBottom: "5px",
  textTransform: "uppercase" as const
};
const inputStyle: React.CSSProperties = {
  backgroundColor: "#000",
  border: "1px solid #333",
  borderRadius: "4px",
  color: "#fff",
  padding: "8px",
  fontSize: "0.85rem"
};
const cancelBtnStyle: React.CSSProperties = {
  backgroundColor: "transparent",
  color: "#aaa",
  border: "1px solid #555",
  borderRadius: "4px",
  padding: "8px 14px",
  cursor: "pointer",
  fontSize: "0.8rem"
};
const submitBtnStyle: React.CSSProperties = {
  backgroundColor: "#DAA520",
  color: "#000",
  border: "none",
  borderRadius: "4px",
  padding: "8px 14px",
  fontWeight: "bold",
  cursor: "pointer",
  fontSize: "0.8rem"
};