import React, { useState } from 'react';
import Sidebar from './Sidebar';

// Sub-módulos contables
import ResumenTesoreria from '../../components/admin/contable/ResumenTesoreria';
import CuentasPorCobrar from '../../components/admin/contable/CuentasPorCobrar';
import CuentasPorPagar from '../../components/admin/contable/CuentasPorPagar';
import GastosServicios from '../../components/admin/contable/GastosServicios';
import PlanillaNomina from '../../components/admin/contable/PlanillaNomina';
import Comisiones from '../../components/admin/contable/Comisiones';

// Modales de Registro de Tesorería
import RegistrarIngresoModal from '../../components/admin/contable/RegistrarIngresoModal';
import RegistrarGastoModal from '../../components/admin/contable/RegistrarGastoModal';

type TabType = 'resumen' | 'cxc' | 'cxp' | 'gastos' | 'planilla' | 'comisiones';

export default function ModuloContable() {
  const [activeTab, setActiveTab] = useState<TabType>('resumen');
  const [mostrarModalIngreso, setMostrarModalIngreso] = useState(false);
  const [mostrarModalGasto, setMostrarModalGasto] = useState(false);

  const tabs: { key: TabType; label: string; icon: string }[] = [
    { key: 'resumen', label: 'Resumen & Tesorería', icon: '📊' },
    { key: 'cxc', label: 'Cuentas por Cobrar (CxC)', icon: '💵' },
    { key: 'cxp', label: 'Cuentas por Pagar (CxP)', icon: '🏷️' },
    { key: 'gastos', label: 'Gastos & Servicios', icon: '⚡' },
    { key: 'planilla', label: 'Planilla & Nómina', icon: '👥' },
    { key: 'comisiones', label: 'Comisiones & Bonos', icon: '💰' },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh", width: "100%", backgroundColor: "#000000", color: "#ffffff" }}>
      <Sidebar currentActive="modulo-contable" />

      <main style={{ flex: 1, minHeight: "100vh", backgroundColor: "#000000", padding: "30px", boxSizing: "border-box", overflowY: "auto" }}>
        
        <div style={{
          backgroundColor: "#0d0d0d",
          border: "1px solid rgba(218, 165, 32, 0.4)",
          borderRadius: "14px",
          padding: "25px",
          boxShadow: "0 0 25px rgba(218, 165, 32, 0.1)"
        }}>
          
          {/* ENCABEZADO SUPERIOR Y BOTONES DE ACCIÓN */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "25px", flexWrap: "wrap", gap: "15px" }}>
            <div>
              <h1 style={{ color: "#DAA520", margin: 0, fontSize: "1.6rem", letterSpacing: "1px", fontWeight: "bold" }}>
                SISTEMA CONTABLE B.I.K.U. V1.0
              </h1>
              <p style={{ color: "#888888", margin: "6px 0 0 0", fontSize: "0.85rem" }}>
                Control Financiero, Tesorería, Cuentas CxC / CxP, Comisiones, Bonos Navideños y Nómina Internacional.
              </p>
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              {/* BOTÓN CONECTADO AL MODAL DE REGISTRO DE INGRESO */}
              <button 
                onClick={() => setMostrarModalIngreso(true)}
                style={{
                  background: "#DAA520",
                  color: "#000000",
                  fontWeight: "bold",
                  border: "none",
                  padding: "10px 18px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  letterSpacing: "0.5px",
                  boxShadow: "0 0 10px rgba(218, 165, 32, 0.3)",
                  transition: "all 0.2s ease"
                }}
              >
                + REGISTRAR INGRESO / COBRO
              </button>
              
              {/* BOTÓN CONECTADO AL MODAL DE REGISTRO DE GASTO */}
              <button 
                onClick={() => setMostrarModalGasto(true)}
                style={{
                  background: "transparent",
                  color: "#DAA520",
                  border: "1px solid #DAA520",
                  fontWeight: "bold",
                  padding: "10px 18px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  letterSpacing: "0.5px",
                  transition: "all 0.2s ease"
                }}
              >
                - REGISTRAR GASTO / PAGO
              </button>
            </div>
          </div>

          {/* BARRA DE NAVEGACIÓN INTERNA (PESTAÑAS) */}
          <div style={{
            display: "flex",
            gap: "10px",
            borderBottom: "1px solid rgba(218, 165, 32, 0.25)",
            paddingBottom: "12px",
            marginBottom: "25px",
            overflowX: "auto"
          }}>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    padding: "10px 18px",
                    borderRadius: "8px",
                    border: isActive ? "1px solid #DAA520" : "1px solid transparent",
                    background: isActive ? "#DAA520" : "rgba(20, 20, 20, 0.8)",
                    color: isActive ? "#000000" : "#DAA520",
                    fontWeight: "bold",
                    cursor: "pointer",
                    fontSize: "0.88rem",
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    transition: "all 0.2s ease",
                    boxShadow: isActive ? "0 0 12px rgba(218, 165, 32, 0.25)" : "none"
                  }}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* VISTAS INTERNAS DINÁMICAS */}
          {activeTab === 'resumen' && <ResumenTesoreria />}
          {activeTab === 'cxc' && <CuentasPorCobrar />}
          {activeTab === 'cxp' && <CuentasPorPagar />}
          {activeTab === 'gastos' && <GastosServicios />}
          {activeTab === 'planilla' && <PlanillaNomina />}
          {activeTab === 'comisiones' && <Comisiones />}

        </div>
      </main>

      {/* RENDERIZADO DE MODALES */}
      <RegistrarIngresoModal 
        isOpen={mostrarModalIngreso} 
        onClose={() => setMostrarModalIngreso(false)} 
      />

      <RegistrarGastoModal 
        isOpen={mostrarModalGasto} 
        onClose={() => setMostrarModalGasto(false)} 
      />
    </div>
  );
}