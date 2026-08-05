import React, { useState } from 'react';
import Sidebar from './Sidebar';
import { useRequiereRol } from '../../lib/useRequiereRol';
import { theme, pageWrapStyle } from '../../lib/theme';
import { Card, PageHeader, Button } from '../../lib/ui';

// Sub-módulos contables
import ResumenTesoreria from '../../components/admin/contable/ResumenTesoreria';
import CuentasPorCobrar from '../../components/admin/contable/CuentasPorCobrar';
import CuentasPorPagar from '../../components/admin/contable/CuentasPorPagar';
import GastosServicios from '../../components/admin/contable/GastosServicios';
import Comisiones from '../../components/admin/contable/Comisiones';
import PlanCuentas from '../../components/admin/contable/PlanCuentas';

// Modales de Registro de Tesorería
import RegistrarIngresoModal from '../../components/admin/contable/RegistrarIngresoModal';
import RegistrarGastoModal from '../../components/admin/contable/RegistrarGastoModal';

type TabType = 'resumen' | 'cxc' | 'cxp' | 'gastos' | 'comisiones' | 'plan-cuentas';

export default function ModuloContable() {
  // ── Guard de página: solo Super Administrador y Administrador ──
  const { cargando: cargandoAuth, autorizado } = useRequiereRol(["Super Administrador", "Administrador"]);

  const [activeTab, setActiveTab] = useState<TabType>('resumen');
  const [mostrarModalIngreso, setMostrarModalIngreso] = useState(false);
  const [mostrarModalGasto, setMostrarModalGasto] = useState(false);

  const tabs: { key: TabType; label: string; icon: string }[] = [
    { key: 'resumen', label: 'Resumen & Tesorería', icon: '📊' },
    { key: 'cxc', label: 'Cuentas por Cobrar (CxC)', icon: '💵' },
    { key: 'cxp', label: 'Cuentas por Pagar (CxP)', icon: '🏷️' },
    { key: 'gastos', label: 'Gastos & Servicios', icon: '⚡' },
    { key: 'comisiones', label: 'Comisiones & Bonos', icon: '💰' },
    { key: 'plan-cuentas', label: 'Plan de Cuentas', icon: '📚' },
  ];

  // ── Guard de acceso ──
  if (cargandoAuth) {
    return (
      <div style={{ display: "flex" }}>
        <Sidebar currentActive="modulo-contable" />
        <div style={pageWrapStyle()}>
          <p style={{ color: theme.gold }}>Verificando acceso...</p>
        </div>
      </div>
    );
  }
  if (!autorizado) {
    return null;
  }

  return (
    <div style={{ display: "flex" }}>
      <Sidebar currentActive="modulo-contable" />

      <div style={pageWrapStyle()}>
        <Card>

          {/* ENCABEZADO SUPERIOR Y BOTONES DE ACCIÓN */}
          <PageHeader
            title="SISTEMA CONTABLE B.I.K.U. V1.0"
            subtitle="Control Financiero, Tesorería, Cuentas CxC / CxP, Comisiones, Bonos Navideños y Nómina Internacional."
          />

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginBottom: "25px" }}>
            {/* BOTÓN CONECTADO AL MODAL DE REGISTRO DE INGRESO */}
            <Button variant="gold" onClick={() => setMostrarModalIngreso(true)}>
              + REGISTRAR INGRESO / COBRO
            </Button>

            {/* BOTÓN CONECTADO AL MODAL DE REGISTRO DE GASTO */}
            <Button variant="outline-gold" onClick={() => setMostrarModalGasto(true)}>
              - REGISTRAR GASTO / PAGO
            </Button>
          </div>

          {/* BARRA DE NAVEGACIÓN INTERNA (PESTAÑAS) */}
          <div style={{
            display: "flex",
            gap: "10px",
            borderBottom: `1px solid ${theme.borderGoldLight}`,
            paddingBottom: "12px",
            marginBottom: "25px",
            overflowX: "auto"
          }}>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <Button
                  key={tab.key}
                  variant={isActive ? "gold" : "outline-gold"}
                  onClick={() => setActiveTab(tab.key)}
                >
                  <span>{tab.icon}</span> <span>{tab.label}</span>
                </Button>
              );
            })}
          </div>

          {/* VISTAS INTERNAS DINÁMICAS */}
          {activeTab === 'resumen' && <ResumenTesoreria />}
          {activeTab === 'cxc' && <CuentasPorCobrar />}
          {activeTab === 'cxp' && <CuentasPorPagar />}
          {activeTab === 'gastos' && <GastosServicios />}
          {activeTab === 'comisiones' && <Comisiones />}
          {activeTab === 'plan-cuentas' && <PlanCuentas />}

        </Card>
      </div>

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