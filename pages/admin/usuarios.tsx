import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import Sidebar from "./Sidebar";
import { theme, pageWrapStyle } from "../../lib/theme";
import {
  Card,
  Heading,
  PageHeader,
  Button,
  Badge,
  estadoToTone,
  inputStyle,
} from "../../lib/ui";

// ─────────────────────────────────────────────────────────────
// CONFIGURACIÓN DE ROLES, JERARQUÍAS Y PERMISOS
// Ajusta este objeto para agregar/quitar roles o cambiar su nivel.
// Nivel más bajo = más privilegios (1 = máximo).
// ─────────────────────────────────────────────────────────────
const ROLES_CONFIG: Record<string, { jerarquia: number; permisos: string[]; descripcion: string }> = {
  "Super Administrador": {
    jerarquia: 1,
    permisos: ["gestionar_usuarios", "gestionar_roles", "ver_auditoria", "acceso_total"],
    descripcion: "Acceso total, incluida la gestión de otros administradores",
  },
  "Administrador": {
    jerarquia: 2,
    permisos: ["gestionar_usuarios", "ver_auditoria", "gestionar_pedidos", "gestionar_cotizaciones"],
    descripcion: "Gestión operativa completa: usuarios, pedidos, cotizaciones y reportes",
  },
  "Ventas": {
    jerarquia: 3,
    permisos: ["ver_pedidos", "gestionar_cotizaciones"],
    descripcion: "Cotizaciones, pedidos y seguimiento de clientes",
  },
  "Soporte Técnico": {
    jerarquia: 3,
    permisos: ["ver_pedidos", "soporte_clientes"],
    descripcion: "Atención a clientes y resolución de incidencias",
  },
  "Producción": {
    jerarquia: 3,
    permisos: ["ver_manufactura", "actualizar_manufactura"],
    descripcion: "Órdenes de manufactura y estado de producción",
  },
  "Bodega": {
    jerarquia: 3,
    permisos: ["ver_despachos", "actualizar_despachos"],
    descripcion: "Despachos e inventario",
  },
  "Utility": {
    jerarquia: 4,
    permisos: ["acceso_basico"],
    descripcion: "Acceso básico de solo lectura",
  },
};

const TIPOS_CLIENTE = ["Integrador", "Distribuidor", "Directo", "Inversionista"];

type Vista = "clientes" | "inversionistas" | "equipo" | "auditoria";

const ACCIONES_LABEL: Record<string, string> = {
  creacion: "Creación",
  edicion: "Edición",
  suspension: "Suspensión",
  reactivacion: "Reactivación",
  invitacion: "Invitación enviada",
};

export default function AdminUsuarios() {
  const [vistaActiva, setVistaActiva] = useState<Vista>("clientes");
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(false);
  const [mensajeModal, setMensajeModal] = useState("");

  // Estados para nuevo colaborador
  const [mostrarModalColaborador, setMostrarModalColaborador] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoEmail, setNuevoEmail] = useState("");
  const [nuevoCedula, setNuevoCedula] = useState("");
  const [nuevoTelefono, setNuevoTelefono] = useState("");
  const [nuevoDepartamento, setNuevoDepartamento] = useState("");
  const [nuevoPassword, setNuevoPassword] = useState("");
  const [nuevoRol, setNuevoRol] = useState("Administrador");
  const [nuevoAceptaEmail, setNuevoAceptaEmail] = useState(true);
  const [nuevoAceptaPush, setNuevoAceptaPush] = useState(false);
  const [nuevoNotificaciones, setNuevoNotificaciones] = useState(false);

  // Estados para edición (clientes, inversionistas o equipo)
  const [mostrarModalEditar, setMostrarModalEditar] = useState(false);
  const [editando, setEditando] = useState<any>(null);

  // Estados para auditoría
  const [registrosAuditoria, setRegistrosAuditoria] = useState<any[]>([]);
  const [cargandoAuditoria, setCargandoAuditoria] = useState(false);
  const [filtroAccion, setFiltroAccion] = useState("todas");

  useEffect(() => {
    if (vistaActiva === "auditoria") {
      cargarAuditoria();
    } else {
      cargarUsuarios(vistaActiva);
    }
  }, [vistaActiva]);

  // ── Identidad de quien ejecuta la acción (para auditoría) ──
  const obtenerAdminActual = async (): Promise<string> => {
    if (!supabase) return "Sistema";
    const { data } = await supabase.auth.getUser();
    return data?.user?.email || "Sistema";
  };

  const registrarAuditoria = async (
    accion: string,
    tablaOrigen: string,
    usuarioAfectadoId: string,
    usuarioAfectadoNombre: string,
    detalle: string
  ) => {
    if (!supabase) return;
    const realizadoPor = await obtenerAdminActual();
    const { error } = await supabase.from("auditoria").insert([
      {
        usuario_afectado_id: usuarioAfectadoId,
        usuario_afectado_nombre: usuarioAfectadoNombre,
        tabla_origen: tablaOrigen,
        accion,
        detalle,
        realizado_por: realizadoPor,
      },
    ]);
    if (error) console.error("Error registrando auditoría:", error);
  };

  const tablaDe = (vista: Vista) => (vista === "equipo" ? "colaboradores" : "clientes");

  // ── Carga de usuarios (clientes / inversionistas / equipo) ──
  const cargarUsuarios = async (vista: Vista) => {
    if (!supabase) return;
    setCargando(true);
    setUsuarios([]);

    let query;
    if (vista === "equipo") {
      query = supabase.from("colaboradores").select("*").order("created_at", { ascending: false });
    } else if (vista === "inversionistas") {
      query = supabase
        .from("clientes")
        .select("*")
        .eq("tipo_cliente", "Inversionista")
        .order("created_at", { ascending: false });
    } else {
      // clientes: todo lo que NO sea inversionista (incluye tipo_cliente nulo)
      query = supabase
        .from("clientes")
        .select("*")
        .or("tipo_cliente.neq.Inversionista,tipo_cliente.is.null")
        .order("created_at", { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      console.error(`Error al cargar ${vista}:`, error);
    } else {
      setUsuarios(data || []);
    }

    setCargando(false);
  };

  // ── Auditoría ──
  const cargarAuditoria = async () => {
    if (!supabase) return;
    setCargandoAuditoria(true);
    const { data, error } = await supabase
      .from("auditoria")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("Error al cargar auditoría:", error);
    } else {
      setRegistrosAuditoria(data || []);
    }
    setCargandoAuditoria(false);
  };

  // ── Suspender / reactivar ──
  const toggleEstadoUsuario = async (id: string, estadoActual: boolean, vista: Vista, nombreUsuario: string) => {
    if (!supabase) return;
    const nuevoEstado = !estadoActual;
    const tabla = tablaDe(vista);

    const { error } = await supabase.from(tabla).update({ activo: nuevoEstado }).eq("id", id);

    if (error) {
      alert("Error al actualizar el estado: " + error.message);
    } else {
      setUsuarios(usuarios.map((u) => (u.id === id ? { ...u, activo: nuevoEstado } : u)));
      await registrarAuditoria(
        nuevoEstado ? "reactivacion" : "suspension",
        tabla,
        id,
        nombreUsuario,
        `Usuario ${nuevoEstado ? "reactivado" : "suspendido"} desde el panel de administración`
      );
    }
  };

  // Enviar correo de "acceso / restablecer contraseña" vía Supabase Auth.
  // Funciona para cualquier usuario con fila en auth.users (clientes o
  // colaboradores) — solo cambia la tabla de origen para la auditoría.
  const enviarAcceso = async (emailUsuario: string, id: string, nombreUsuario: string, tabla: string) => {
    if (!supabase) return;
    const { error } = await supabase.auth.resetPasswordForEmail(emailUsuario, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });

    if (error) {
      alert("Error al enviar correo de acceso: " + error.message);
    } else {
      setMensajeModal(`¡Correo de acceso enviado exitosamente a ${emailUsuario}!`);
      setTimeout(() => setMensajeModal(""), 4000);
      await registrarAuditoria("invitacion", tabla, id, nombreUsuario, `Acceso enviado a ${emailUsuario}`);
    }
  };

  const crearColaborador = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: nuevoEmail,
      password: nuevoPassword,
    });

    if (authError) {
      alert("Error al crear credenciales de autenticación: " + authError.message);
      return;
    }

    // auth_id vincula esta fila con el usuario real de Supabase Auth
    // (columna agregada vía SQL: ALTER TABLE colaboradores ADD COLUMN
    // auth_id uuid REFERENCES auth.users(id)).
    const { data: nuevaFila, error: dbError } = await supabase
      .from("colaboradores")
      .insert([
        {
          nombre: nuevoNombre,
          email: nuevoEmail,
          cedula: nuevoCedula,
          telefono: nuevoTelefono,
          departamento: nuevoDepartamento,
          rol: nuevoRol,
          auth_id: authData.user?.id,
          activo: true,
          acepta_email: nuevoAceptaEmail,
          acepta_push: nuevoAceptaPush,
          notificaciones_configuradas: nuevoNotificaciones,
        },
      ])
      .select()
      .single();

    if (dbError) {
      alert("Usuario creado en Auth pero hubo un error en la tabla colaboradores: " + dbError.message);
    } else {
      setMensajeModal("¡Colaborador creado y registrado exitosamente!");
      setMostrarModalColaborador(false);
      await registrarAuditoria(
        "creacion",
        "colaboradores",
        nuevaFila?.id || "",
        nuevoNombre,
        `Colaborador creado con rol "${nuevoRol}" (nivel ${ROLES_CONFIG[nuevoRol]?.jerarquia ?? "N/A"})`
      );
      setNuevoNombre("");
      setNuevoEmail("");
      setNuevoCedula("");
      setNuevoTelefono("");
      setNuevoDepartamento("");
      setNuevoPassword("");
      setNuevoRol("Administrador");
      setNuevoAceptaEmail(true);
      setNuevoAceptaPush(false);
      setNuevoNotificaciones(false);
      cargarUsuarios("equipo");
      setTimeout(() => setMensajeModal(""), 4000);
    }
  };

  // ── Edición de perfiles ──
  const abrirModalEditar = (user: any, vista: Vista) => {
    setEditando({ ...user, _vista: vista });
    setMostrarModalEditar(true);
  };

  const guardarEdicion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !editando) return;

    const vista: Vista = editando._vista;
    const tabla = tablaDe(vista);
    const cambios: any = {};

    if (vista === "equipo") {
      cambios.nombre = editando.nombre;
      cambios.email = editando.email;
      cambios.cedula = editando.cedula;
      cambios.telefono = editando.telefono;
      cambios.departamento = editando.departamento;
      cambios.rol = editando.rol;
      cambios.acepta_email = editando.acepta_email;
      cambios.acepta_push = editando.acepta_push;
      cambios.notificaciones_configuradas = editando.notificaciones_configuradas;
    } else {
      cambios.razon_social = editando.razon_social;
      cambios.email = editando.email;
      cambios.tipo_cliente = editando.tipo_cliente;
      cambios.price_list = editando.price_list;
    }

    const { error } = await supabase.from(tabla).update(cambios).eq("id", editando.id);

    if (error) {
      alert("Error al guardar los cambios: " + error.message);
    } else {
      await registrarAuditoria(
        "edicion",
        tabla,
        editando.id,
        editando.nombre || editando.razon_social || "Sin nombre",
        "Datos de perfil modificados desde el panel de administración"
      );
      setMostrarModalEditar(false);
      setEditando(null);
      setMensajeModal("¡Datos actualizados exitosamente!");
      cargarUsuarios(vista);
      setTimeout(() => setMensajeModal(""), 4000);
    }
  };

  const usuariosFiltrados = usuarios.filter(
    (user) =>
      user.razon_social?.toLowerCase().includes(busqueda.toLowerCase()) ||
      user.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
      user.email?.toLowerCase().includes(busqueda.toLowerCase()) ||
      user.cedula?.toLowerCase().includes(busqueda.toLowerCase())
  );

  const registrosAuditoriaFiltrados = registrosAuditoria.filter(
    (r) => filtroAccion === "todas" || r.accion === filtroAccion
  );

  return (
    <div style={{ display: "flex" }}>
      <Sidebar currentActive="usuarios" />

      <div style={pageWrapStyle()}>
        <PageHeader
          title="Gestión de Usuarios"
          subtitle="Administra el acceso, credenciales, roles y estados de clientes, inversionistas y equipo corporativo."
        />

        {vistaActiva === "equipo" && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
            <Button onClick={() => setMostrarModalColaborador(true)}>+ Nuevo Colaborador</Button>
          </div>
        )}

        {mensajeModal && (
          <div
            style={{
              marginBottom: "25px",
              padding: "15px 20px",
              backgroundColor: theme.greenBg,
              border: `1px solid ${theme.greenBorder}`,
              color: theme.green,
              borderRadius: theme.radiusSm,
              fontSize: "0.9rem",
              letterSpacing: "0.5px",
            }}
          >
            {mensajeModal}
          </div>
        )}

        {/* CONTROLES DE FILTRADO Y VISTAS */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px", flexWrap: "wrap", gap: "20px" }}>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <Button variant={vistaActiva === "clientes" ? "gold" : "outline-gold"} onClick={() => setVistaActiva("clientes")}>
              CLIENTES
            </Button>
            <Button variant={vistaActiva === "inversionistas" ? "gold" : "outline-gold"} onClick={() => setVistaActiva("inversionistas")}>
              INVERSIONISTAS
            </Button>
            <Button variant={vistaActiva === "equipo" ? "gold" : "outline-gold"} onClick={() => setVistaActiva("equipo")}>
              EQUIPO ADMINISTRATIVO
            </Button>
            <Button variant={vistaActiva === "auditoria" ? "gold" : "outline-gold"} onClick={() => setVistaActiva("auditoria")}>
              AUDITORÍA
            </Button>
          </div>

          {vistaActiva !== "auditoria" && (
            <div style={{ flex: "1", maxWidth: "350px", minWidth: "250px" }}>
              <input
                type="text"
                placeholder={`Buscar en ${vistaActiva}...`}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
              />
            </div>
          )}

          {vistaActiva === "auditoria" && (
            <div style={{ minWidth: "220px" }}>
              <select
                value={filtroAccion}
                onChange={(e) => setFiltroAccion(e.target.value)}
                style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
              >
                <option value="todas" style={optionStyle}>Todas las acciones</option>
                {Object.keys(ACCIONES_LABEL).map((a) => (
                  <option key={a} value={a} style={optionStyle}>{ACCIONES_LABEL[a]}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Modal Crear Colaborador */}
        {mostrarModalColaborador && (
          <div style={overlayModal}>
            <Card style={{ maxWidth: 450, width: "100%", maxHeight: "85vh", overflowY: "auto" }}>
              <form onSubmit={crearColaborador}>
                <Heading style={modalTitleStyle}>Nuevo Colaborador</Heading>

                <Campo label="Nombre Completo">
                  <input
                    type="text"
                    value={nuevoNombre}
                    onChange={(e) => setNuevoNombre(e.target.value)}
                    required
                    style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
                  />
                </Campo>

                <Campo label="Correo Electrónico">
                  <input
                    type="email"
                    value={nuevoEmail}
                    onChange={(e) => setNuevoEmail(e.target.value)}
                    required
                    style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
                  />
                </Campo>

                <Campo label="Cédula">
                  <input
                    type="text"
                    value={nuevoCedula}
                    onChange={(e) => setNuevoCedula(e.target.value)}
                    required
                    placeholder="8-123-4567"
                    style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
                  />
                </Campo>

                <Campo label="Teléfono">
                  <input
                    type="text"
                    value={nuevoTelefono}
                    onChange={(e) => setNuevoTelefono(e.target.value)}
                    style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
                  />
                </Campo>

                <Campo label="Departamento">
                  <input
                    type="text"
                    value={nuevoDepartamento}
                    onChange={(e) => setNuevoDepartamento(e.target.value)}
                    style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
                  />
                </Campo>

                <Campo label="Contraseña Inicial">
                  <input
                    type="password"
                    value={nuevoPassword}
                    onChange={(e) => setNuevoPassword(e.target.value)}
                    required
                    style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
                  />
                </Campo>

                <div style={{ marginBottom: "10px" }}>
                  <label style={labelStyle}>Rol / Jerarquía</label>
                  <select
                    value={nuevoRol}
                    onChange={(e) => setNuevoRol(e.target.value)}
                    style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
                  >
                    {Object.entries(ROLES_CONFIG).map(([rol, cfg]) => (
                      <option key={rol} value={rol} style={optionStyle}>
                        {rol} — Nivel {cfg.jerarquia}
                      </option>
                    ))}
                  </select>
                  <p style={{ fontSize: "0.75rem", color: theme.textMuted, marginTop: "8px" }}>
                    {ROLES_CONFIG[nuevoRol]?.descripcion}
                  </p>
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label style={labelStyle}>Preferencias de notificación</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <label style={checkboxLabelStyle}>
                      <input
                        type="checkbox"
                        checked={nuevoAceptaEmail}
                        onChange={(e) => setNuevoAceptaEmail(e.target.checked)}
                      />
                      Acepta notificaciones por correo
                    </label>
                    <label style={checkboxLabelStyle}>
                      <input
                        type="checkbox"
                        checked={nuevoAceptaPush}
                        onChange={(e) => setNuevoAceptaPush(e.target.checked)}
                      />
                      Acepta notificaciones push
                    </label>
                    <label style={checkboxLabelStyle}>
                      <input
                        type="checkbox"
                        checked={nuevoNotificaciones}
                        onChange={(e) => setNuevoNotificaciones(e.target.checked)}
                      />
                      Notificaciones configuradas (onboarding completo)
                    </label>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "15px", marginTop: "20px" }}>
                  <Button type="submit" style={{ flex: 1 }}>Guardar</Button>
                  <Button
                    type="button"
                    variant="outline-gold"
                    style={{ flex: 1 }}
                    onClick={() => setMostrarModalColaborador(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* Modal Editar Perfil (clientes, inversionistas o equipo) */}
        {mostrarModalEditar && editando && (
          <div style={overlayModal}>
            <Card style={{ maxWidth: 450, width: "100%", maxHeight: "85vh", overflowY: "auto" }}>
              <form onSubmit={guardarEdicion}>
                <Heading style={modalTitleStyle}>
                  Modificar {editando._vista === "equipo" ? "Colaborador" : "Perfil"}
                </Heading>

                {editando._vista === "equipo" ? (
                  <>
                    <Campo label="Nombre Completo">
                      <input
                        type="text"
                        value={editando.nombre || ""}
                        onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
                        required
                        style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
                      />
                    </Campo>
                    <Campo label="Correo Electrónico">
                      <input
                        type="email"
                        value={editando.email || ""}
                        onChange={(e) => setEditando({ ...editando, email: e.target.value })}
                        required
                        style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
                      />
                    </Campo>
                    <Campo label="Cédula">
                      <input
                        type="text"
                        value={editando.cedula || ""}
                        onChange={(e) => setEditando({ ...editando, cedula: e.target.value })}
                        placeholder="8-123-4567"
                        style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
                      />
                    </Campo>
                    <Campo label="Teléfono">
                      <input
                        type="text"
                        value={editando.telefono || ""}
                        onChange={(e) => setEditando({ ...editando, telefono: e.target.value })}
                        style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
                      />
                    </Campo>
                    <Campo label="Departamento">
                      <input
                        type="text"
                        value={editando.departamento || ""}
                        onChange={(e) => setEditando({ ...editando, departamento: e.target.value })}
                        style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
                      />
                    </Campo>
                    <div style={{ marginBottom: "10px" }}>
                      <label style={labelStyle}>Rol / Jerarquía</label>
                      <select
                        value={editando.rol || "Administrador"}
                        onChange={(e) => setEditando({ ...editando, rol: e.target.value })}
                        style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
                      >
                        {Object.entries(ROLES_CONFIG).map(([rol, cfg]) => (
                          <option key={rol} value={rol} style={optionStyle}>{rol} — Nivel {cfg.jerarquia}</option>
                        ))}
                      </select>
                      <p style={{ fontSize: "0.75rem", color: theme.textMuted, marginTop: "8px" }}>
                        {ROLES_CONFIG[editando.rol]?.descripcion}
                      </p>
                    </div>
                    <div style={{ marginBottom: "20px" }}>
                      <label style={labelStyle}>Preferencias de notificación</label>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <label style={checkboxLabelStyle}>
                          <input
                            type="checkbox"
                            checked={editando.acepta_email ?? true}
                            onChange={(e) => setEditando({ ...editando, acepta_email: e.target.checked })}
                          />
                          Acepta notificaciones por correo
                        </label>
                        <label style={checkboxLabelStyle}>
                          <input
                            type="checkbox"
                            checked={editando.acepta_push ?? false}
                            onChange={(e) => setEditando({ ...editando, acepta_push: e.target.checked })}
                          />
                          Acepta notificaciones push
                        </label>
                        <label style={checkboxLabelStyle}>
                          <input
                            type="checkbox"
                            checked={editando.notificaciones_configuradas ?? false}
                            onChange={(e) => setEditando({ ...editando, notificaciones_configuradas: e.target.checked })}
                          />
                          Notificaciones configuradas (onboarding completo)
                        </label>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <Campo label="Razón Social / Nombre">
                      <input
                        type="text"
                        value={editando.razon_social || ""}
                        onChange={(e) => setEditando({ ...editando, razon_social: e.target.value })}
                        required
                        style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
                      />
                    </Campo>
                    <Campo label="Correo Electrónico">
                      <input
                        type="email"
                        value={editando.email || ""}
                        onChange={(e) => setEditando({ ...editando, email: e.target.value })}
                        required
                        style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
                      />
                    </Campo>
                    <div style={{ marginBottom: "20px" }}>
                      <label style={labelStyle}>Tipo de Cliente</label>
                      <select
                        value={editando.tipo_cliente || "Integrador"}
                        onChange={(e) => setEditando({ ...editando, tipo_cliente: e.target.value })}
                        style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
                      >
                        {TIPOS_CLIENTE.map((t) => (
                          <option key={t} value={t} style={optionStyle}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <Campo label="Lista de Precios">
                      <input
                        type="text"
                        value={editando.price_list || ""}
                        onChange={(e) => setEditando({ ...editando, price_list: e.target.value })}
                        style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
                      />
                    </Campo>
                  </>
                )}

                <div style={{ display: "flex", gap: "15px", marginTop: "10px" }}>
                  <Button type="submit" style={{ flex: 1 }}>Guardar Cambios</Button>
                  <Button
                    type="button"
                    variant="outline-gold"
                    style={{ flex: 1 }}
                    onClick={() => { setMostrarModalEditar(false); setEditando(null); }}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* ── VISTA: AUDITORÍA ── */}
        {vistaActiva === "auditoria" ? (
          cargandoAuditoria ? (
            <EstadoVacio texto="Cargando registros de auditoría..." />
          ) : registrosAuditoriaFiltrados.length === 0 ? (
            <EstadoVacio texto="No hay registros de auditoría para este filtro." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {registrosAuditoriaFiltrados.map((r) => (
                <Card
                  key={r.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "20px",
                    padding: "16px 22px",
                    marginBottom: 0,
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ fontWeight: 700, color: theme.textLight, fontSize: "0.95rem" }}>
                      {ACCIONES_LABEL[r.accion] || r.accion} — {r.usuario_afectado_nombre || "N/A"}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: theme.textMuted }}>{r.detalle}</div>
                    <div style={{ fontSize: "0.75rem", color: theme.textMuted }}>
                      Realizado por: <span style={{ color: theme.gold }}>{r.realizado_por}</span> · Tabla: {r.tabla_origen}
                    </div>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: theme.textMuted, whiteSpace: "nowrap" }}>
                    {new Date(r.created_at).toLocaleString("es-PA")}
                  </div>
                </Card>
              ))}
            </div>
          )
        ) : cargando ? (
          <EstadoVacio texto={`Cargando registros de ${vistaActiva}...`} />
        ) : usuariosFiltrados.length === 0 ? (
          <EstadoVacio texto={`No se encontraron registros en la categoría ${vistaActiva}.`} atenuado />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            {usuariosFiltrados.map((user: any) => {
              const estaActivo = user.activo !== false;
              const nombreMostrado = user.razon_social || user.nombre || "Usuario Sin Nombre";
              return (
                <Card
                  key={user.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "20px 25px",
                    marginBottom: 0,
                    border: `1px solid ${estaActivo ? theme.borderGold : theme.redBorder}`,
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ fontWeight: "700", fontSize: "1.05rem", color: theme.textLight, letterSpacing: "0.5px" }}>
                      {nombreMostrado}
                    </div>
                    <div style={{ fontSize: "0.85rem", color: theme.textMuted, letterSpacing: "0.5px" }}>Email: {user.email || "N/A"}</div>

                    {(vistaActiva === "clientes" || vistaActiva === "inversionistas") && (
                      <div style={{ fontSize: "0.8rem", color: theme.textMuted, display: "flex", gap: "12px", alignItems: "center", marginTop: "2px" }}>
                        <span>Tipo: <strong style={{ color: theme.textLight }}>{user.tipo_cliente || "Integrador"}</strong></span> |
                        <span>Lista: <strong style={{ color: theme.gold }}>{user.price_list || "C"}</strong></span> |
                        <span>Estado: <Badge tone={estadoToTone(estaActivo ? "activo" : "inactivo")}>{estaActivo ? "Activo" : "Inactivo"}</Badge></span>
                      </div>
                    )}

                    {vistaActiva === "equipo" && (
                      <div style={{ fontSize: "0.8rem", color: theme.textMuted, display: "flex", gap: "12px", alignItems: "center", marginTop: "2px", flexWrap: "wrap" }}>
                        <span>Cédula: <strong style={{ color: theme.textLight }}>{user.cedula || "N/A"}</strong></span> |
                        <span>Tel: <strong style={{ color: theme.textLight }}>{user.telefono || "N/A"}</strong></span> |
                        <span>Depto: <strong style={{ color: theme.textLight }}>{user.departamento || "N/A"}</strong></span> |
                        <span>Rol: <strong style={{ color: theme.gold }}>{user.rol || "Administrador"}</strong></span> |
                        <span>Jerarquía: <strong style={{ color: theme.textLight }}>Nivel {ROLES_CONFIG[user.rol]?.jerarquia ?? "N/A"}</strong></span> |
                        <span>Estado: <Badge tone={estadoToTone(estaActivo ? "activo" : "inactivo")}>{estaActivo ? "Activo" : "Suspendido"}</Badge></span>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: "12px" }}>
                    <Button
                      variant="outline-gold"
                      onClick={() => enviarAcceso(user.email, user.id, nombreMostrado, tablaDe(vistaActiva))}
                    >
                      ENVIAR ACCESO / PASS
                    </Button>

                    <Button variant="outline-gold" onClick={() => abrirModalEditar(user, vistaActiva)}>
                      MODIFICAR
                    </Button>

                    <Button
                      variant={estaActivo ? "outline-red" : "outline-green"}
                      onClick={() => toggleEstadoUsuario(user.id, estaActivo, vistaActiva, nombreMostrado)}
                    >
                      {vistaActiva === "equipo"
                        ? estaActivo ? "SUSPENDER" : "REACTIVAR"
                        : estaActivo ? "INACTIVAR" : "ACTIVAR"}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Subcomponentes de apoyo
// ─────────────────────────────────────────────────────────────
function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function EstadoVacio({ texto }: { texto: string; atenuado?: boolean }) {
  return (
    <Card style={{ textAlign: "center", padding: "40px" }}>
      <p style={{ color: theme.textMuted, fontStyle: "italic", margin: 0, letterSpacing: "0.5px" }}>{texto}</p>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// Estilos reutilizables (sin equivalente directo en lib/ui)
// ─────────────────────────────────────────────────────────────
const optionStyle = { backgroundColor: theme.panelBg, color: theme.gold };

const labelStyle = { display: "block", marginBottom: "8px", fontSize: "0.85rem", color: theme.textMuted };

const checkboxLabelStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "0.85rem",
  color: theme.textMuted,
} as const;

const overlayModal = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  backgroundColor: "rgba(0,0,0,0.85)",
  backdropFilter: "blur(5px)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000,
} as const;

const modalTitleStyle = {
  fontSize: "1.2rem",
  letterSpacing: "1px",
  textTransform: "uppercase",
  borderLeft: `3px solid ${theme.gold}`,
  paddingLeft: "12px",
  marginBottom: "25px",
} as const;
