// ── CAMBIO 1: agregar este import arriba del archivo, junto a los demás imports ──
import { destinoSegunRol } from "../lib/rolesConfig";

// ── CAMBIO 2: reemplazar el bloque completo de "colaboradorData" en handleLogin ──
// (busca desde "const { data: colaboradorData }" hasta el "return;" de ese bloque)

const { data: colaboradorData } = await supabase
  .from("colaboradores")
  .select("id, email, nombre, rol, activo") // <- antes decía "cargo"; la columna real es "rol"
  .ilike("email", userEmail)
  .single();

if (colaboradorData) {
  if (colaboradorData.activo === false) {
    setCargando(false);
    setMensaje("Tu cuenta de colaborador está suspendida. Contacta a un administrador.");
    return;
  }

  const colaboradorProfile: UserSessionProfile = {
    id: colaboradorData.id,
    email: colaboradorData.email,
    nombre: colaboradorData.nombre || "Colaborador",
    empresa: "Trulink Fiber LLC",
    rol: colaboradorData.rol || "Colaborador",
    tipo: "colaborador",
    tipo_registro: "Equipo Interno",
    perfil_cliente: "Colaborador",
    lista_precio: "LISTA_A",
  };

  sessionStorage.setItem("trulink_user", JSON.stringify(colaboradorProfile));
  await verificarPrimerLoginInteligente("colaboradores", "id", colaboradorData.id);

  // Antes: window.location.href = "/admin";  (mandaba a TODOS los colaboradores al panel admin)
  // Ahora: se decide por jerarquía del rol (ver lib/rolesConfig.ts)
  window.location.href = destinoSegunRol(colaboradorData.rol);
  return;
}
