import React from 'react';
import { useRouter } from 'next/router';

interface SidebarProps {
  currentActive: string;
}

export default function Sidebar({ currentActive }: SidebarProps) {
  const router = useRouter();

  const menuItems = [
    { key: 'validaciones', label: 'Validaciones', path: '/admin/validaciones' },
    { key: 'cotizaciones', label: 'Cotizaciones', path: '/admin/cotizaciones' },
    { key: 'manufactura', label: 'Manufactura', path: '/admin/manufactura' },
    { key: 'inventario', label: 'Inventario', path: '/admin/inventario' },
    { key: 'usuarios', label: 'Usuarios', path: '/admin/usuarios' },
    { key: 'analitica', label: 'Analítica', path: '/admin/analitica' },
    { key: 'notificaciones', label: 'Notificaciones', path: '/admin/notificaciones' },
    { key: 'marketing', label: 'Marketing', path: '/admin/marketing' },
  ];

  return (
    <aside style={{ width: "280px", borderRight: "2px solid #DAA520", padding: "20px", backgroundColor: "#000", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <div>
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
          <img src="/images/logo.png" alt="Trulink Fiber" style={{ width: "100px", marginBottom: "10px", filter: "drop-shadow(0 0 5px rgba(218,165,32,0.3))" }} />
          <h2 style={{ color: "#DAA520", fontSize: "1.1rem", letterSpacing: "1px" }}>ADMIN PANEL</h2>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {menuItems.map((item) => {
            const isActive = currentActive === item.key;
            return (
              <button
                key={item.key}
                onClick={() => router.push(item.path)}
                style={{
                  padding: "12px 15px",
                  borderRadius: "8px",
                  border: isActive ? "1px solid #DAA520" : "1px solid transparent",
                  background: isActive ? "#111" : "transparent",
                  color: "#DAA520",
                  width: "100%",
                  cursor: "pointer",
                  fontWeight: "bold",
                  textAlign: "left",
                  transition: "all 0.2s ease"
                }}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div>
        <button
          onClick={() => router.push('https://portal.trulinkfiber.org/portal-cliente')}
          style={{
            padding: "10px",
            borderRadius: "8px",
            border: "1px solid #DAA520",
            background: "transparent",
            color: "#DAA520",
            width: "100%",
            cursor: "pointer",
            fontWeight: "bold",
            marginBottom: "10px"
          }}
        >
          ← Volver al Portal
        </button>
      </div>
    </aside>
  );
}