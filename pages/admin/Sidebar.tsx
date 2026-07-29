import React, { useState } from 'react';
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

  // Módulos agrupados según el flujo operativo real del negocio
  const menuBlocks: MenuBlock[] = [
    {
      category: 'COMERCIAL',
      items: [
        { key: 'validaciones', label: 'Validaciones', path: '/admin/validaciones' },
        { key: 'cotizaciones', label: 'Cotizaciones', path: '/admin/cotizaciones' },
        { key: 'crm', label: 'CRM & Oportunidades', path: '/admin/crm' },
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

  // Estado para controlar qué categorías están abiertas. 
  // Por defecto, abrimos la categoría que contenga el ítem activo actual.
  const [openCategories, setOpenCategories] = useState<{ [key: string]: boolean }>(() => {
    const initial: { [key: string]: boolean } = {};
    menuBlocks.forEach((block) => {
      const hasActiveItem = block.items.some((item) => item.key === currentActive);
      initial[block.category] = hasActiveItem; // Abierto si contiene la ruta actual, cerrado si no.
    });
    return initial;
  });

  const toggleCategory = (category: string) => {
    setOpenCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const handleCerrarSesion = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    sessionStorage.clear();
    localStorage.clear();
    router.push('/');
  };

  return (
    <>
      {/* ESTILOS DE SCROLLBAR DORADO/NEGRO */}
      <style>{`
        .sidebar-scroll::-webkit-scrollbar {
          width: 5px;
        }
        .sidebar-scroll::-webkit-scrollbar-track {
          background: #000000;
        }
        .sidebar-scroll::-webkit-scrollbar-thumb {
          background: rgba(218, 165, 32, 0.4);
          border-radius: 10px;
        }
        .sidebar-scroll::-webkit-scrollbar-thumb:hover {
          background: #DAA520;
          box-shadow: 0 0 8px rgba(218, 165, 32, 0.8);
        }
        .sidebar-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(218, 165, 32, 0.4) #000000;
        }
      `}</style>

      <aside style={{ width: "280px", borderRight: "2px solid #DAA520", padding: "20px", backgroundColor: "#000000", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "space-between", boxSizing: "border-box" }}>
        {/* SECCIÓN SUPERIOR CON SCROLL PERSONALIZADO */}
        <div className="sidebar-scroll" style={{ display: "flex", flexDirection: "column", overflowY: "auto", maxHeight: "calc(100vh - 150px)", paddingRight: "6px" }}>
          
          {/* LOGO Y ENCABEZADO */}
          <div style={{ textAlign: "center", marginBottom: "25px" }}>
            <img src="/images/logo.png" alt="Trulink Fiber" style={{ width: "100px", marginBottom: "10px", filter: "drop-shadow(0 0 5px rgba(218,165,32,0.3))" }} />
            <h2 style={{ color: "#DAA520", fontSize: "1.1rem", letterSpacing: "1px", margin: 0 }}>ADMIN PANEL</h2>
          </div>

          {/* NAVEGACIÓN AGRUPADA */}
          <nav style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            {menuBlocks.map((block) => {
              const isOpen = openCategories[block.category];
              const hasActiveChild = block.items.some((item) => item.key === currentActive);

              return (
                <div key={block.category} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  
                  {/* TÍTULO DEL MÓDULO INTERACTIVO (CLICKEABLE) */}
                  <div
                    onClick={() => toggleCategory(block.category)}
                    style={{
                      textAlign: "center",
                      border: hasActiveChild ? "1px solid #DAA520" : "1px solid rgba(218, 165, 32, 0.4)",
                      background: hasActiveChild ? "rgba(218, 165, 32, 0.15)" : "rgba(218, 165, 32, 0.08)",
                      borderRadius: "6px",
                      padding: "8px 10px",
                      margin: "0",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      transition: "all 0.2s ease"
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = "rgba(218, 165, 32, 0.2)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = hasActiveChild ? "rgba(218, 165, 32, 0.15)" : "rgba(218, 165, 32, 0.08)";
                    }}
                  >
                    <span style={{
                      color: "#DAA520",
                      fontSize: "0.68rem",
                      fontWeight: "bold",
                      letterSpacing: "1.2px",
                      textTransform: "uppercase",
                      flex: 1,
                      textAlign: "center"
                    }}>
                      {block.category}
                    </span>
                    <span style={{ color: "#DAA520", fontSize: "0.75rem", fontWeight: "bold" }}>
                      {isOpen ? '▲' : '▼'}
                    </span>
                  </div>

                  {/* OPCIONES DEL BLOQUE (SE MUESTRAN SOLO SI ESTÁ ABIERTO) */}
                  {isOpen && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", paddingLeft: "8px", animation: "fadeIn 0.2s ease-in-out" }}>
                      {block.items.map((item) => {
                        const isActive = currentActive === item.key;
                        return (
                          <button
                            key={item.key}
                            onClick={() => router.push(item.path)}
                            style={{
                              padding: "9px 12px",
                              borderRadius: "6px",
                              border: isActive ? "1px solid #DAA520" : "1px solid transparent",
                              background: isActive ? "#111111" : "transparent",
                              color: isActive ? "#FFDF00" : "#d1a73e",
                              textShadow: isActive 
                                ? "0 0 10px rgba(255, 223, 0, 0.8), 0 0 20px rgba(218, 165, 32, 0.5)" 
                                : "none",
                              boxShadow: isActive ? "0 0 12px rgba(218, 165, 32, 0.2)" : "none",
                              width: "100%",
                              cursor: "pointer",
                              fontWeight: isActive ? "800" : "bold",
                              fontSize: "0.82rem",
                              textAlign: "left",
                              transition: "all 0.2s ease-in-out"
                            }}
                            onMouseOver={(e) => {
                              if (!isActive) {
                                e.currentTarget.style.backgroundColor = "rgba(218, 165, 32, 0.08)";
                                e.currentTarget.style.color = "#FFDF00";
                                e.currentTarget.style.textShadow = "0 0 8px rgba(255, 223, 0, 0.6)";
                              }
                            }}
                            onMouseOut={(e) => {
                              if (!isActive) {
                                e.currentTarget.style.backgroundColor = "transparent";
                                e.currentTarget.style.color = "#d1a73e";
                                e.currentTarget.style.textShadow = "none";
                              }
                            }}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
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
    </>
  );
}