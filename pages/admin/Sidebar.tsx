import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { puedeVerItem } from '../../lib/accesoModulos';

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

const CACHE_KEY_ROL = 'trulink_admin_rol_cache';

export default function Sidebar({ currentActive }: SidebarProps) {
  const router = useRouter();
  // Se inicializa leyendo el último rol conocido de sessionStorage, en vez
  // de arrancar siempre en null. Así, si la consulta a "colaboradores"
  // falla transitoriamente (red lenta, carrera con las queries pesadas de
  // analitica.tsx, etc.), el menú no colapsa a solo "Recursos Humanos" --
  // sigue mostrando el último menú correcto mientras se refresca en segundo plano.
  const [rolActual, setRolActual] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      return sessionStorage.getItem(CACHE_KEY_ROL);
    } catch {
      return null;
    }
  });
  const [rolCargado, setRolCargado] = useState(false);

  // ── Cargar el rol real del colaborador logueado, para filtrar el menú ──
  useEffect(() => {
    async function cargarRol() {
      if (!supabase) { setRolCargado(true); return; }
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.email) { setRolCargado(true); return; }

        // maybeSingle() en vez de single(): single() lanza una excepción si
        // la consulta devuelve 0 filas o más de 1, y ese error terminaba en
        // el catch de abajo sin volver a fijar rolActual -- dejando el menú
        // colapsado a rolActual=null (solo "*", o sea solo RRHH).
        const { data, error } = await supabase
          .from('colaboradores')
          .select('rol')
          .eq('email', user.email)
          .maybeSingle();

        if (error) {
          console.error('Error consultando el rol del colaborador:', error.message);
          // No pisamos rolActual: se queda con el valor cacheado (si había)
          // en vez de colapsar el menú por una falla puntual de red.
          return;
        }

        if (data?.rol) {
          setRolActual(data.rol);
          try { sessionStorage.setItem(CACHE_KEY_ROL, data.rol); } catch { /* no-op */ }
        } else {
          console.warn('El colaborador no tiene rol asignado o no existe en la tabla colaboradores:', user.email);
        }
      } catch (err) {
        console.error('No se pudo determinar el rol del colaborador:', err);
        // Igual que arriba: se conserva el rol cacheado en vez de resetear.
      } finally {
        setRolCargado(true);
      }
    }
    cargarRol();
  }, []);

  const menuBlocksBase: MenuBlock[] = [
    {
      category: 'COMERCIAL',
      items: [
        { key: 'validaciones', label: 'Validaciones', path: '/admin/validaciones' },
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
        { key: 'estado-cuenta', label: 'Estado de Cuenta por Cliente', path: '/admin/estado-cuenta' },
        { key: 'planilla', label: 'Planilla', path: '/admin/planilla' },
        { key: 'planilla-empleados', label: 'Planilla — Empleados', path: '/admin/planilla-empleados' },
        { key: 'planilla-dispersion', label: 'Planilla — Dispersión', path: '/admin/planilla-dispersion' },
      ],
    },
    {
      category: 'RECURSOS HUMANOS',
      items: [
        { key: 'rrhh', label: 'Autoservicio (RRHH)', path: '/admin/rrhh' },
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
      ],
    },
  ];

  // ── Filtrar ítems según el rol, y ocultar categorías que queden vacías ──
  const menuBlocks: MenuBlock[] = menuBlocksBase
    .map((block) => ({
      ...block,
      items: block.items.filter((item) => puedeVerItem(rolActual, item.key)),
    }))
    .filter((block) => block.items.length > 0);

  // ── Acordeón real: solo una categoría abierta a la vez ──
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  // Al cargar (o cambiar de rol), abre automáticamente la categoría de la página actual
  useEffect(() => {
    const activeBlock = menuBlocks.find((block) =>
      block.items.some((item) => item.key === currentActive)
    );
    setOpenCategory(activeBlock ? activeBlock.category : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolActual, rolCargado]);

  const toggleCategory = (category: string) => {
    setOpenCategory((prev) => (prev === category ? null : category));
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
      <aside style={{ width: "280px", borderRight: "2px solid #DAA520", padding: "20px", backgroundColor: "#000000", height: "100vh", display: "flex", flexDirection: "column", boxSizing: "border-box", position: "sticky", top: 0, left: 0 }}>
        <div className="sidebar-scroll" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflowY: "auto", paddingRight: "6px" }}>
          <div style={{ textAlign: "center", marginBottom: "25px", flexShrink: 0 }}>
            <img src="/images/logo.png" alt="Trulink Fiber" style={{ width: "100px", marginBottom: "10px", filter: "drop-shadow(0 0 5px rgba(218,165,32,0.3))" }} />
            <h2 style={{ color: "#DAA520", fontSize: "1.1rem", letterSpacing: "1px", margin: 0 }}>ADMIN PANEL</h2>
          </div>

          {!rolCargado && !rolActual ? (
            <p style={{ color: "#666", fontSize: "0.78rem", textAlign: "center" }}>Cargando menú...</p>
          ) : (
            <nav style={{ display: "flex", flexDirection: "column", gap: "15px", paddingBottom: "15px" }}>
              {menuBlocks.map((block) => {
                const isOpen = openCategory === block.category;
                const hasActiveChild = block.items.some((item) => item.key === currentActive);
                return (
                  <div key={block.category} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
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
          )}

          {/* Imagen biku.png ampliada 3 veces (~220px) */}
          <div style={{ textAlign: "center", margin: "15px 0 20px 0", flexShrink: 0 }}>
            <img 
              src="/images/biku.png" 
              alt="Biku" 
              style={{ 
                width: "220px", 
                height: "auto", 
                borderRadius: "10px", 
                border: "1px solid rgba(218, 165, 32, 0.4)",
                boxShadow: "0 0 20px rgba(218, 165, 32, 0.3)",
                objectFit: "contain"
              }} 
            />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px", paddingTop: "15px", borderTop: "1px solid rgba(218, 165, 32, 0.2)", flexShrink: 0 }}>
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