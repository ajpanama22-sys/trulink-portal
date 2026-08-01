// pages/colaborador/perfil.tsx
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";
import { tieneAccesoAdmin } from "../../lib/rolesConfig";
import SidebarColaborador from "./Sidebar";
import { theme, pageWrapStyle } from "../../lib/theme";
import { Card, PageHeader, DataRow } from "../../lib/ui";

type FichaColaborador = {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  departamento: string | null;
  telefono: string | null;
  activo: boolean;
  created_at: string | null;
};

export default function PerfilColaborador() {
  const router = useRouter();
  const [ficha, setFicha] = useState<FichaColaborador | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    verificarSesionYCargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function verificarSesionYCargar() {
    if (!supabase) {
      setError("Cliente de Supabase no inicializado.");
      setCargando(false);
      return;
    }
    setCargando(true);
    setError(null);

    // 1. Sesión real de Supabase Auth (no sessionStorage)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      router.replace("/login");
      return;
    }

    // 2. Buscar la ficha del colaborador por email, igual que hace login.tsx
    const { data, error: errFicha } = await supabase
      .from("colaboradores")
      .select("id, nombre, email, rol, departamento, telefono, activo, created_at")
      .eq("email", user.email)
      .single();

    if (errFicha || !data) {
      // El usuario autenticado no es colaborador (podría ser cliente) -> fuera de este portal
      router.replace("/login");
      return;
    }

    // 3. Los roles de jerarquía 1-2 usan /admin, no este portal self-service
    if (tieneAccesoAdmin(data.rol)) {
      router.replace("/admin");
      return;
    }

    setFicha(data as FichaColaborador);
    setCargando(false);
  }

  return (
    <div style={{ display: "flex" }}>
      <SidebarColaborador currentActive="perfil" />

      <div style={pageWrapStyle()}>
        <Card>
          <PageHeader
            title="Mi Perfil"
            subtitle="Tus datos como colaborador de Trulink Fiber LLC."
          />

          {error && (
            <div
              style={{
                color: theme.red,
                background: theme.redBg,
                border: `1px solid ${theme.redBorder}`,
                borderRadius: theme.radiusSm,
                padding: "10px 14px",
                fontSize: "0.85rem",
                marginBottom: "20px",
              }}
            >
              {error}
            </div>
          )}

          {cargando ? (
            <p style={{ color: theme.textMuted }}>Cargando ficha...</p>
          ) : !ficha ? (
            <p style={{ color: theme.textMuted }}>No se encontró tu ficha de colaborador.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px" }}>
              <DataRow label="Nombre completo" valor={ficha.nombre} />
              <DataRow label="Correo electrónico" valor={ficha.email} />
              <DataRow label="Rol / Puesto" valor={ficha.rol} />
              <DataRow label="Departamento" valor={ficha.departamento || "—"} />
              <DataRow label="Teléfono" valor={ficha.telefono || "—"} />
              <DataRow
                label="Colaborador desde"
                valor={ficha.created_at ? new Date(ficha.created_at).toLocaleDateString("es-PA") : "—"}
              />
              <DataRow
                label="Estado"
                valor={
                  <span style={{ color: ficha.activo ? theme.green : theme.red }}>
                    {ficha.activo ? "Activo" : "Suspendido"}
                  </span>
                }
              />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}