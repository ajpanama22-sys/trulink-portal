// lib/useRequiereCliente.ts
//
// Hook de guard de página: verifica que el usuario logueado sea un
// CLIENTE activo antes de mostrar cualquier página del portal B2B
// (/portal-cliente, /especiales, /fabricacion, /productos, /seguimiento,
// /pago-exitoso, etc). Si no hay sesión, si el email no corresponde a
// un cliente (por ejemplo es un colaborador), o si el cliente está
// suspendido, redirige a /login.
//
// Es el equivalente de useRequiereRol.ts pero para el lado de clientes.
//
// Uso dentro de cualquier página del portal B2B:
//
//   const { cargando, autorizado } = useRequiereCliente();
//   if (cargando) return <p style={{color:"#DAA520"}}>Verificando acceso...</p>;
//   if (!autorizado) return null; // ya se redirigió
//
// IMPORTANTE: esto es una capa de UX, no de seguridad real. La barrera
// verdadera debe reforzarse con políticas RLS en Supabase, porque un
// usuario podría seguir llamando a la API/tabla directo desde el navegador.

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "./supabaseClient";

interface ResultadoGuardCliente {
  cargando: boolean;
  autorizado: boolean;
  clienteId: string | null;
}

export function useRequiereCliente(): ResultadoGuardCliente {
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  const [autorizado, setAutorizado] = useState(false);
  const [clienteId, setClienteId] = useState<string | null>(null);

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
        .from("clientes")
        .select("id, status")
        .ilike("email", user.email)
        .maybeSingle();

      if (!activo) return;

      if (error || !data) {
        // El email autenticado no corresponde a ningún cliente registrado
        // (por ejemplo, es un colaborador tratando de entrar al portal B2B).
        router.replace("/login");
        return;
      }

      if (data.status !== "activo") {
        // Cuenta suspendida/pendiente -> no puede usar el portal.
        router.replace("/login?motivo=suspendido");
        return;
      }

      setClienteId(data.id);
      setAutorizado(true);
      setCargando(false);
    }

    verificar();
    return () => {
      activo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { cargando, autorizado, clienteId };
}