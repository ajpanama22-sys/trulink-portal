// lib/useRequiereRol.ts
//
// Hook de guard de página: verifica que el colaborador logueado
// esté activo y tenga uno de los roles permitidos para ver la página
// actual. Si no, redirige a /login (sin sesión / no es colaborador /
// suspendido) o a /admin/rrhh (colaborador activo pero sin permiso
// para esta página en particular, su autoservicio siempre accesible).
//
// Uso dentro de cualquier página de pages/admin/*.tsx:
//
//   const { cargando, autorizado } = useRequiereRol(["Super Administrador", "Administrador"]);
//   if (cargando) return <p style={{color:"#DAA520"}}>Verificando acceso...</p>;
//   if (!autorizado) return null; // ya se redirigió
//
// IMPORTANTE: esto es una capa de UX, no de seguridad real. La barrera
// verdadera debe reforzarse con políticas RLS en Supabase, porque un
// usuario podría seguir llamando a la API/tabla directo desde el navegador.

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "./supabaseClient";

interface ResultadoGuard {
  cargando: boolean;
  autorizado: boolean;
  rol: string | null;
}

export function useRequiereRol(rolesPermitidos: string[]): ResultadoGuard {
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  const [autorizado, setAutorizado] = useState(false);
  const [rol, setRol] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;

    async function verificar() {
      if (!supabase) {
        if (activo) setCargando(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("colaboradores")
        .select("rol, activo")
        .eq("email", user.email)
        .single();

      if (!activo) return;

      if (error || !data) {
        // No es colaborador registrado -> fuera del panel admin
        router.replace("/login");
        return;
      }

      if (data.activo === false) {
        // Colaborador suspendido -> no puede entrar a ningún módulo del panel
        router.replace("/login?motivo=suspendido");
        return;
      }

      setRol(data.rol);

      if (!rolesPermitidos.includes(data.rol)) {
        // Rol reconocido pero sin permiso para esta página -> a su autoservicio
        router.replace("/admin/rrhh?motivo=sin_permiso");
        return;
      }

      setAutorizado(true);
      setCargando(false);
    }

    verificar();
    return () => {
      activo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { cargando, autorizado, rol };
}