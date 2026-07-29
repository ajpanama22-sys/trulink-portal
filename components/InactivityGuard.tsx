import { useEffect } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

// Tiempo de inactividad antes de cerrar sesión automáticamente (5 minutos).
const TIEMPO_INACTIVIDAD_MS = 5 * 60 * 1000;

/**
 * InactivityGuard centraliza el cierre de sesión por inactividad para TODO
 * el portal de clientes (antes cada página como fabricacion.tsx tenía su
 * propia copia de este temporizador, y páginas como productos.tsx no tenían
 * ninguna — esto normaliza la regla en un solo lugar).
 *
 * No renderiza nada visible; solo corre el temporizador en segundo plano.
 * Se monta condicionalmente desde _app.tsx solo en las rutas del portal de
 * clientes (no en /admin, /login, /auth, ni en la raíz).
 */
export default function InactivityGuard() {
  const router = useRouter();

  useEffect(() => {
    let inactivityTimer: ReturnType<typeof setTimeout>;

    const cerrarPorInactividad = async () => {
      await supabase.auth.signOut();
      // Limpiamos también el perfil de sesión guardado en sessionStorage,
      // para que el HeaderUser no siga mostrando un nombre "fantasma"
      // después de que la sesión real de Supabase ya expiró.
      sessionStorage.removeItem("trulink_user");
      router.push("/login");
    };

    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(cerrarPorInactividad, TIEMPO_INACTIVIDAD_MS);
    };

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((event) => {
      window.addEventListener(event, resetInactivityTimer);
    });

    resetInactivityTimer();

    return () => {
      clearTimeout(inactivityTimer);
      events.forEach((event) => {
        window.removeEventListener(event, resetInactivityTimer);
      });
    };
  }, [router]);

  return null;
}
