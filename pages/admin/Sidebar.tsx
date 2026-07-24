import React from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';

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
        </nav>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
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