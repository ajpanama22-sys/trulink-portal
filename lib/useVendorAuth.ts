import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getSupabase } from "./supabaseClient";

/* ============================================================
   GUARD DE ACCESO — VENDOR PORTAL
   ------------------------------------------------------------
   Análogo a useRequiereRol pero para proveedores homologados:
   1. Verifica que haya sesión de Supabase Auth activa.
   2. Busca en `proveedores` la fila con auth_user_id = user.id.
   3. Exige estado_homologacion === 'Homologado' y portal_activo.
   Si algo falla, redirige a /vendor-portal/login.
   ============================================================ */

export type ProveedorSesion = {
  id: string;
  nombre: string;
  tipo_insumo: string | null;
  email: string | null;
  estado_homologacion: string;
};

export function useVendorAuth() {
  const router = useRouter();
  const supabase = getSupabase();

  const [cargando, setCargando] = useState(true);
  const [autorizado, setAutorizado] = useState(false);
  const [proveedor, setProveedor] = useState<ProveedorSesion | null>(null);

  useEffect(() => {
    let activo = true;

    const verificar = async () => {
      if (!supabase) {
        setCargando(false);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;

      if (!user) {
        if (activo) {
          setAutorizado(false);
          setCargando(false);
        }
        router.replace("/vendor-portal/login");
        return;
      }

      const { data: prov, error } = await supabase
        .from("proveedores")
        .select("id, nombre, tipo_insumo, email, estado_homologacion, portal_activo")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!activo) return;

      if (error || !prov || prov.estado_homologacion !== "Homologado" || !prov.portal_activo) {
        setAutorizado(false);
        setCargando(false);
        router.replace("/vendor-portal/login?error=no_autorizado");
        return;
      }

      setProveedor(prov);
      setAutorizado(true);
      setCargando(false);
    };

    verificar();

    const { data: listener } = supabase?.auth.onAuthStateChange(() => verificar()) || { data: null };

    return () => {
      activo = false;
      listener?.subscription?.unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { cargando, autorizado, proveedor };
}
