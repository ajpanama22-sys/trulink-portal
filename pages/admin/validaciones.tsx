import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import Sidebar from "./Sidebar";

export default function AdminValidaciones() {
  const [dataList, setDataList] = useState<any[]>([]);
  const [filteredList, setFilteredList] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Estados para filtros y ordenamiento
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [filterType, setFilterType] = useState<"todos" | "anio" | "mes" | "dia" | "rango">("todos");
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  useEffect(() => {
    cargarSolicitudes();
  }, []);

  useEffect(() => {
    aplicarFiltrosYOrden();
  }, [dataList, sortOrder, filterType, selectedYear, selectedMonth, selectedDate, dateFrom, dateTo]);

  const cargarSolicitudes = async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase.from("solicitudes_acceso").select("*");
    if (error) {
      console.error("Error al cargar solicitudes:", error);
    } else {
      setDataList(data || []);
    }
    setLoading(false);
  };

  const aplicarFiltrosYOrden = () => {
    let resultado = [...dataList];

    // 1. Filtrado
    if (filterType === "anio" && selectedYear) {
      resultado = resultado.filter(item => {
        if (!item.created_at) return false;
        const itemYear = new Date(item.created_at).getFullYear().toString();
        return itemYear === selectedYear;
      });
    } else if (filterType === "mes" && selectedMonth) {
      // selectedMonth viene en formato "YYYY-MM"
      resultado = resultado.filter(item => {
        if (!item.created_at) return false;
        const dateObj = new Date(item.created_at);
        const itemMonth = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
        return itemMonth === selectedMonth;
      });
    } else if (filterType === "dia" && selectedDate) {
      // selectedDate viene en formato "YYYY-MM-DD"
      resultado = resultado.filter(item => {
        if (!item.created_at) return false;
        const dateObj = new Date(item.created_at);
        const itemDate = dateObj.toISOString().split('T')[0];
        return itemDate === selectedDate;
      });
    } else if (filterType === "rango") {
      resultado = resultado.filter(item => {
        if (!item.created_at) return false;
        const itemDate = item.created_at.split('T')[0];
        if (dateFrom && itemDate < dateFrom) return false;
        if (dateTo && itemDate > dateTo) return false;
        return true;
      });
    }

    // 2. Ordenamiento por fecha (created_at)
    resultado.sort((a, b) => {
      const fechaA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const fechaB = b.created_at ? new Date(b.created_at).getTime() : 0;
      
      if (sortOrder === "desc") {
        return fechaB - fechaA; // Más recientes primero
      } else {
        return fechaA - fechaB; // Más antiguos primero
      }
    });

    setFilteredList(resultado);
  };

  const procesarSolicitud = async (id: string, tipo: 'ACTIVAR' | 'RECHAZAR', emailCliente: string, razonSocialParam: string, itemCompleto: any) => {
    if (!supabase) return;

    if (tipo === 'ACTIVAR') {
      const passwordToken = "trulink_" + Math.random().toString(36).substring(2) + Date.now().toString(36);
      
      const { error: updateError } = await supabase
        .from("solicitudes_acceso")
        .update({ status: 'active', password_token: passwordToken })
        .eq('id', id);

      if (updateError) {
        alert("Error al activar en base de datos: " + updateError.message);
        return;
      }

      const datosCompletos = itemCompleto.datos_completos || {};
      const tipoClienteVal = datosCompletos.tipo_cliente || itemCompleto.tipo_solicitud || 'Integrador';
      const priceListVal = datosCompletos.price_list || 'C';

      const { error: clienteError } = await supabase
        .from("clientes")
        .upsert({
          razon_social: razonSocialParam,
          email: emailCliente,
          tipo_cliente: tipoClienteVal,
          price_list: priceListVal,
          status: 'pendiente_password',
          password_token: passwordToken
        }, { onConflict: 'email' });

      if (clienteError) {
        console.error("Error replicando en tabla clientes:", clienteError);
      }

      try {
        const response = await fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipo: "ACTIVACION",
            email: emailCliente,
            razon_social: razonSocialParam,
            link: `${window.location.origin}/auth/crear-password?token=${passwordToken}`
          })
        });
        if (!response.ok) throw new Error("Fallo al enviar correo de activación");
        alert(`Solicitud activada con éxito. Cliente replicado y correo enviado a ${emailCliente}`);
      } catch (err: any) {
        alert("Solicitud activada en BD y replicada, pero hubo un error enviando el correo: " + err.message);
      }

    } else {
      try {
        const response = await fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipo: "RECHAZO",
            email: emailCliente,
            razon_social: razonSocialParam
          })
        });
        if (!response.ok) throw new Error("Fallo al enviar correo de rechazo");
      } catch (err: any) {
        console.error("Error enviando correo de rechazo:", err);
      }

      const { error: deleteError } = await supabase
        .from("solicitudes_acceso")
        .update({ status: 'rejected' })
        .eq('id', id);

      if (deleteError) {
        await supabase.from("solicitudes_acceso").delete().eq('id', id);
      }

      alert(`La solicitud de ${razonSocialParam} ha sido rechazada y se ha notificado al solicitante.`);
    }

    cargarSolicitudes();
  };

  return (
    <div style={{ backgroundColor: "#080808", minHeight: "100vh", display: "flex", color: "#E0E0E0", fontFamily: "sans-serif" }}>
      <Sidebar currentActive="validaciones" />

      <div style={{ flex: 1, padding: "40px 50px", overflowY: "auto", boxSizing: "border-box" }}>
        
        {/* Header Superior con Estilo Premium Black & Gold */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "25px", borderBottom: "1px solid rgba(218, 165, 32, 0.2)", paddingBottom: "20px" }}>
          <div>
            <h1 style={{ fontSize: "1.8rem", fontWeight: "700", color: "#DAA520", margin: "0 0 8px 0", letterSpacing: "1.5px" }}>
              VALIDACIÓN DE INSCRIPCIONES
            </h1>
            <p style={{ fontSize: "0.9rem", color: "#888", margin: 0, letterSpacing: "0.5px" }}>
              Gestión y aprobación de solicitudes de acceso para nuevos integradores y socios comerciales.
            </p>
          </div>
          <div style={{ background: "rgba(218, 165, 32, 0.08)", border: "1px solid rgba(218, 165, 32, 0.3)", padding: "10px 20px", borderRadius: "8px", color: "#DAA520", fontWeight: "600", fontSize: "0.85rem", letterSpacing: "1px" }}>
            PENDIENTES: {filteredList.length} {filteredList.length !== dataList.length && `(de ${dataList.length})`}
          </div>
        </div>

        {/* Barra de Filtros y Ordenamiento (Black & Gold Theme) */}
        <div style={{ background: "#111111", border: "1px solid #222", borderRadius: "10px", padding: "20px", marginBottom: "30px", display: "flex", flexWrap: "wrap", gap: "15px", alignItems: "center", justifyContent: "space-between" }}>
          
          <div style={{ display: "flex", flexWrap: "wrap", gap: "15px", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              <label style={{ fontSize: "0.75rem", color: "#DAA520", fontWeight: "600", letterSpacing: "0.5px" }}>FILTRAR POR:</label>
              <select 
                value={filterType} 
                onChange={(e) => setFilterType(e.target.value as any)}
                style={selectStyle}
              >
                <option value="todos" style={{ background: "#111" }}>Todos los registros</option>
                <option value="dia" style={{ background: "#111" }}>Por Día</option>
                <option value="mes" style={{ background: "#111" }}>Por Mes</option>
                <option value="anio" style={{ background: "#111" }}>Por Año</option>
                <option value="rango" style={{ background: "#111" }}>Por Rango de Fechas</option>
              </select>
            </div>

            {/* Opciones dinámicas según el filtro seleccionado */}
            {filterType === "dia" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                <label style={{ fontSize: "0.75rem", color: "#DAA520", fontWeight: "600", letterSpacing: "0.5px" }}>SELECCIONAR DÍA:</label>
                <input 
                  type="date" 
                  value={selectedDate} 
                  onChange={(e) => setSelectedDate(e.target.value)} 
                  style={inputStyle}
                />
              </div>
            )}

            {filterType === "mes" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                <label style={{ fontSize: "0.75rem", color: "#DAA520", fontWeight: "600", letterSpacing: "0.5px" }}>SELECCIONAR MES:</label>
                <input 
                  type="month" 
                  value={selectedMonth} 
                  onChange={(e) => setSelectedMonth(e.target.value)} 
                  style={inputStyle}
                />
              </div>
            )}

            {filterType === "anio" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                <label style={{ fontSize: "0.75rem", color: "#DAA520", fontWeight: "600", letterSpacing: "0.5px" }}>AÑO:</label>
                <input 
                  type="number" 
                  value={selectedYear} 
                  onChange={(e) => setSelectedYear(e.target.value)} 
                  style={{ ...inputStyle, width: "100px" }}
                  placeholder="Ej. 2026"
                />
              </div>
            )}

            {filterType === "rango" && (
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  <label style={{ fontSize: "0.75rem", color: "#DAA520", fontWeight: "600", letterSpacing: "0.5px" }}>DESDE:</label>
                  <input 
                    type="date" 
                    value={dateFrom} 
                    onChange={(e) => setDateFrom(e.target.value)} 
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  <label style={{ fontSize: "0.75rem", color: "#DAA520", fontWeight: "600", letterSpacing: "0.5px" }}>HASTA:</label>
                  <input 
                    type="date" 
                    value={dateTo} 
                    onChange={(e) => setDateTo(e.target.value)} 
                    style={inputStyle}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Control de Ordenamiento */}
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            <label style={{ fontSize: "0.75rem", color: "#DAA520", fontWeight: "600", letterSpacing: "0.5px" }}>ORDENAR POR FECHA:</label>
            <select 
              value={sortOrder} 
              onChange={(e) => setSortOrder(e.target.value as "desc" | "asc")}
              style={selectStyle}
            >
              <option value="desc" style={{ background: "#111" }}>Más recientes primero (Default)</option>
              <option value="asc" style={{ background: "#111" }}>Más antiguos primero</option>
            </select>
          </div>

        </div>

        {/* Contenido Principal */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px", color: "#666", fontSize: "1rem", letterSpacing: "1px" }}>
            Cargando solicitudes de acceso...
          </div>
        ) : filteredList.length === 0 ? (
          <div style={{ background: "#111", border: "1px solid #222", borderRadius: "12px", padding: "60px", textAlign: "center" }}>
            <p style={{ color: "#777", fontStyle: "italic", fontSize: "1rem", margin: 0, letterSpacing: "0.5px" }}>
              No se encontraron solicitudes con los criterios de filtrado seleccionados.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "20px" }}>
            {filteredList.map((item: any) => {
              let docUrl = item.documentos_url || item.url || "";
              if (!docUrl && supabase) {
                const { data: publicData } = supabase.storage.from("registros").getPublicUrl(`${item.id}_documento`);
                docUrl = publicData?.publicUrl || "#";
              }

              const fechaCreacion = item.created_at ? new Date(item.created_at).toLocaleString() : 'Reciente';

              return (
                <div 
                  key={item.id} 
                  style={{ 
                    background: "#111111", 
                    border: "1px solid #222", 
                    borderRadius: "12px", 
                    padding: "25px 30px", 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "space-between",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
                    transition: "all 0.3s ease"
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1, marginRight: "30px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                      <span style={{ fontSize: "0.75rem", background: "rgba(218, 165, 32, 0.15)", color: "#DAA520", padding: "3px 8px", borderRadius: "4px", fontWeight: "600", letterSpacing: "0.5px" }}>
                        ID: {item.id ? item.id.substring(0, 8) : 'N/A'}
                      </span>
                      <span style={{ fontSize: "0.75rem", color: "#888" }}>
                        Fecha: {fechaCreacion}
                      </span>
                    </div>

                    <div style={{ fontWeight: "600", fontSize: "1.05rem", letterSpacing: "0.5px", color: "#FFF" }}>
                      {item.razon_social || 'Sin Razón Social'}
                    </div>

                    <div style={{ fontSize: "0.88rem", color: "#AAA", letterSpacing: "0.3px" }}>
                      Correo Electrónico: <span style={{ color: "#DAA520", fontWeight: "500" }}>{item.email}</span>
                    </div>

                    <div>
                      <a href={docUrl} target="_blank" rel="noreferrer" style={btnDocumentos}>
                        VER DOCUMENTOS ADJUNTOS
                      </a>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <button 
                      onClick={() => procesarSolicitud(item.id, 'ACTIVAR', item.email, item.razon_social, item)} 
                      style={btnActivar}
                      onMouseOver={(e) => { e.currentTarget.style.background = "rgba(46, 204, 113, 0.15)"; }}
                      onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      ACTIVAR
                    </button>
                    <button 
                      onClick={() => procesarSolicitud(item.id, 'RECHAZAR', item.email, item.razon_social, item)} 
                      style={btnRechazar}
                      onMouseOver={(e) => { e.currentTarget.style.background = "rgba(231, 76, 60, 0.15)"; }}
                      onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      RECHAZAR
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const selectStyle = {
  background: "#1a1a1a",
  color: "#E0E0E0",
  border: "1px solid rgba(218, 165, 32, 0.3)",
  borderRadius: "6px",
  padding: "8px 12px",
  fontSize: "0.85rem",
  outline: "none",
  cursor: "pointer"
};

const inputStyle = {
  background: "#1a1a1a",
  color: "#E0E0E0",
  border: "1px solid rgba(218, 165, 32, 0.3)",
  borderRadius: "6px",
  padding: "7px 10px",
  fontSize: "0.85rem",
  outline: "none"
};

const baseBtn = {
  padding: "11px 22px",
  cursor: "pointer",
  borderRadius: "6px",
  fontWeight: "600",
  fontSize: "0.8rem",
  letterSpacing: "0.8px",
  transition: "all 0.2s ease",
  textDecoration: "none",
  display: "inline-block",
  textAlign: "center" as const
};

const btnDocumentos = {
  ...baseBtn,
  background: "rgba(218, 165, 32, 0.05)",
  color: "#DAA520",
  border: "1px solid rgba(218, 165, 32, 0.4)",
  width: "220px",
  boxSizing: "border-box" as const,
  marginTop: "5px"
};

const btnActivar = {
  ...baseBtn,
  background: "transparent",
  color: "#2ecc71",
  border: "1px solid rgba(46, 204, 113, 0.5)",
  minWidth: "110px"
};

const btnRechazar = {
  ...baseBtn,
  background: "transparent",
  color: "#e74c3c",
  border: "1px solid rgba(231, 76, 60, 0.5)",
  minWidth: "110px"
};