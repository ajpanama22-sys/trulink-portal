import React from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';

interface SidebarProps {
  currentActive: string;
}

interface MenuItem {
  key: string;
  label: string;
  path: string;
}

interface MenuBlock {
  category: string;
  items: MenuItem[];
}

export default function Sidebar({ currentActive }: SidebarProps) {
  const router = useRouter();

  // Módulos agrupados por flujo lógico de negocio
  const menuBlocks: MenuBlock[] = [
    {
      category: 'COMERCIAL',
      items: [
        { key: 'cotizaciones', label: 'Cotizaciones', path: '/admin/cotizaciones' },
        { key: 'validaciones', label: 'Validaciones', path: '/admin/validaciones' },
        { key: 'marketing', label: 'Marketing', path: '/admin/marketing' },
      ],
    },
    {
      category: 'OPERACIONES & CADENA DE SUMINISTRO',
      items: [
        { key: 'proveedores', label: 'Proveedores y Fábricas', path: '/admin/proveedores' },
        { key: 'manufactura', label: 'Manufactura', path: '/admin/manufactura' },
        { key: 'inventario', label: 'Inventario', path: '/admin/inventario' },
        { key: 'despachos', label: 'Despachos (EXW)', path: '/admin/despachos' },
      ],
    },
    {
      category: 'FINANZAS',
      items: [
        { key: 'modulo-contable', label: 'Módulo Contable', path: '/admin/ModuloContable' },
      ],
    },
    {
      category: 'POSTVENTA',
      items: [
        { key: 'rmas', label: 'RMA y Garantías', path: '/admin/rmas' },
      ],
    },
    {
      category: 'INTELIGENCIA DE NEGOCIO',
      items: [
        { key: 'analitica', label: 'Analítica', path: '/admin/analitica' },
        { key: 'reportes', label: 'Reportes', path: '/admin/reportes' },
      ],
    },
    {
      category: 'CONFIGURACIÓN',
      items: [
        { key: 'usuarios', label: 'Usuarios', path: '/admin/usuarios' },
        { key: 'notificaciones', label: 'Notificaciones', path: '/admin/notificaciones' },
      ],
    },
  ];

  const handleCerrarSesion = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    sessionStorage.clear();
    localStorage.clear();
    router.push('/');
  };

  return (
    <aside style={{ width: "280px", borderRight: "2px solid #DAA520", padding: "20px", backgroundColor: "#000", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "space-between", boxSizing: "border-box" }}>
      {/* SECCIÓN SUPERIOR CON SCROLL SI ES NECESARIO */}
      <div style={{ display: "flex", flexDirection: "column", overflowY: "auto", maxHeight: "calc(100vh - 150px)", paddingRight: "4px" }}>
        
        {/* LOGO Y ENCABEZADO */}
        <div style={{ textAlign: "center", marginBottom: "25px" }}>
          <img src="/images/logo.png" alt="Trulink Fiber" style={{ width: "100px", marginBottom: "10px", filter: "drop-shadow(0 0 5px rgba(218,165,32,0.3))" }} />
          <h2 style={{ color: "#DAA520", fontSize: "1.1rem", letterSpacing: "1px", margin: 0 }}>ADMIN PANEL</h2>
        </div>

        {/* NAVEGACIÓN AGRUPADA */}
        <nav style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {menuBlocks.map((block) => (
            <div key={block.category} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {/* ETINQUETA DEL BLOQUE DE NEGOCIO */}
              <span style={{ color: "#777777", fontSize: "0.65rem", fontWeight: "bold", letterSpacing: "1px", textTransform: "uppercase", paddingLeft: "6px" }}>
                {block.category}
              </span>

              {/* OPCIONES DEL BLOQUE */}
              {block.items.map((item) => {
                const isActive = currentActive === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => router.push(item.path)}
                    style={{
                      padding: "10px 14px",
                      borderRadius: "8px",
                      border: isActive ? "1px solid #DAA520" : "1px solid transparent",
                      background: isActive ? "#111" : "transparent",
                      color: "#DAA520",
                      width: "100%",
                      cursor: "pointer",
                      fontWeight: "bold",
                      fontSize: "0.85rem",
                      textAlign: "left",
                      transition: "all 0.2s ease"
                    }}
                    onMouseOver={(e) => {
                      if (!isActive) e.currentTarget.style.backgroundColor = "rgba(218, 165, 32, 0.05)";
                    }}
                    onMouseOut={(e) => {
                      if (!isActive) e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* BOTONES FIJOS INFERIORES */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", paddingTop: "15px", borderTop: "1px solid rgba(218, 165, 32, 0.2)" }}>
        <button
          onClick={() => router.push('/portal-cliente')}
          style={{
            padding: "10px",
            borderRadius: "8px",
            border: "1px solid #DAA520",
            background: "transparent",
            color: "#DAA520",
            width: "100%",
            cursor: "pointer",
            fontWeight: "bold",
            transition: "all 0.2s ease"
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(218, 165, 32, 0.1)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          ← Volver al Portal
        </button>

        <button
          onClick={handleCerrarSesion}
          style={{
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid rgba(231, 76, 60, 0.5)",
            background: "transparent",
            color: "#e74c3c",
            width: "100%",
            cursor: "pointer",
            fontWeight: "bold",
            letterSpacing: "0.5px",
            transition: "all 0.2s ease"
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(231, 76, 60, 0.1)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          Cerrar Sesión
        </button>
      </div>
    </aside>
  );
}