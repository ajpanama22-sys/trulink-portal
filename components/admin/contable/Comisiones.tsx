import React, { useState, useEffect } from 'react';
import { getSupabase } from '../../../lib/supabaseClient';

interface ReglaComision {
  id: string;
  rol: string;
  porcentaje: number;
  base: string;
}

interface Bonificacion {
  id: string;
  colaborador: string;
  rol: string;
  tipo_bono: string;
  monto: number;
  fecha_programada: string;
  estado: 'PROGRAMADO' | 'APROBADO' | 'PAGADO';
  notas: string;
}

const TIPOS_BONO = [
  { value: 'NAVIDAD_FIN_ANO', label: '🎄 Navidad / Fin de Año' },
  { value: 'META_TRIMESTRAL', label: '🎯 Meta Trimestral' },
  { value: 'PROYECTO_ESPECIAL', label: '⭐ Proyecto Especial' },
  { value: 'EFICIENCIA_BODEGA', label: '📦 Eficiencia / KPI' },
];

const ESTADOS_BONO = ['PROGRAMADO', 'APROBADO', 'PAGADO'] as const;

const inputSt: React.CSSProperties = {
  background: '#0a0a0a', border: '1px solid rgba(218,165,32,0.3)', borderRadius: '6px',
  color: '#fff', padding: '8px 10px', fontSize: '0.82rem', width: '100%', boxSizing: 'border-box',
};

const btnGold: React.CSSProperties = {
  background: '#DAA520', color: '#000', border: 'none', padding: '8px 14px',
  borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem',
};

const btnOutline: React.CSSProperties = {
  background: 'transparent', color: '#DAA520', border: '1px solid #DAA520', padding: '6px 12px',
  borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem',
};

export default function Comisiones() {
  const [subTab, setSubTab] = useState<'comisiones' | 'bonificaciones'>('comisiones');
  const [cargando, setCargando] = useState(true);

  const [reglas, setReglas] = useState<ReglaComision[]>([]);
  const [editandoRegla, setEditandoRegla] = useState<string | null>(null);
  const [formRegla, setFormRegla] = useState({ rol: '', porcentaje: 0, base: 'UTILIDAD_NETA' });
  const [mostrarNuevaRegla, setMostrarNuevaRegla] = useState(false);

  const [bonificaciones, setBonificaciones] = useState<Bonificacion[]>([]);
  const [modalBono, setModalBono] = useState<{ open: boolean; bono: Bonificacion | null }>({ open: false, bono: null });
  const [formBono, setFormBono] = useState({
    colaborador: '', rol: '', tipo_bono: 'NAVIDAD_FIN_ANO', monto: 0,
    fecha_programada: new Date().toISOString().slice(0, 10), notas: '',
  });
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { cargarTodo(); }, []);

  const cargarTodo = async () => {
    const supabase = getSupabase();
    if (!supabase) { setCargando(false); return; }
    setCargando(true);
    try {
      const [rReglas, rBonos] = await Promise.all([
        supabase.from('reglas_comisiones').select('*').order('rol'),
        supabase.from('bonificaciones').select('*').order('fecha_programada', { ascending: true }),
      ]);
      if (rReglas.error) console.error('reglas_comisiones (¿corriste el SQL?):', rReglas.error.message);
      if (rBonos.error) console.error('bonificaciones (¿corriste el SQL?):', rBonos.error.message);
      setReglas(rReglas.data || []);
      setBonificaciones(rBonos.data || []);
    } catch (err) {
      console.error('Error cargando comisiones:', err);
    } finally {
      setCargando(false);
    }
  };

  /* ---------------- REGLAS DE COMISIÓN ---------------- */

  const abrirEditarRegla = (r: ReglaComision) => {
    setEditandoRegla(r.id);
    setFormRegla({ rol: r.rol, porcentaje: r.porcentaje, base: r.base });
  };

  const abrirNuevaRegla = () => {
    setMostrarNuevaRegla(true);
    setEditandoRegla(null);
    setFormRegla({ rol: '', porcentaje: 0, base: 'UTILIDAD_NETA' });
  };

  const guardarRegla = async () => {
    const supabase = getSupabase();
    if (!supabase) return alert('No se pudo conectar con la base de datos.');
    if (!formRegla.rol.trim()) return alert('Ingresa el nombre del rol o grupo.');

    setGuardando(true);
    try {
      if (editandoRegla) {
        const { error } = await supabase.from('reglas_comisiones')
          .update({ rol: formRegla.rol, porcentaje: formRegla.porcentaje, base: formRegla.base })
          .eq('id', editandoRegla);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('reglas_comisiones')
          .insert([{ rol: formRegla.rol, porcentaje: formRegla.porcentaje, base: formRegla.base }]);
        if (error) throw error;
      }
      setEditandoRegla(null);
      setMostrarNuevaRegla(false);
      cargarTodo();
    } catch (err: any) {
      alert('Error al guardar la regla: ' + (err.message || err));
    } finally {
      setGuardando(false);
    }
  };

  const eliminarRegla = async (id: string) => {
    if (!confirm('¿Eliminar esta regla de comisión?')) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase.from('reglas_comisiones').delete().eq('id', id);
    if (error) return alert('Error al eliminar: ' + error.message);
    cargarTodo();
  };

  /* ---------------- BONIFICACIONES ---------------- */

  const abrirNuevoBono = () => {
    setFormBono({
      colaborador: '', rol: '', tipo_bono: 'NAVIDAD_FIN_ANO', monto: 0,
      fecha_programada: new Date().toISOString().slice(0, 10), notas: '',
    });
    setModalBono({ open: true, bono: null });
  };

  const abrirEditarBono = (b: Bonificacion) => {
    setFormBono({
      colaborador: b.colaborador, rol: b.rol, tipo_bono: b.tipo_bono,
      monto: b.monto, fecha_programada: b.fecha_programada, notas: b.notas || '',
    });
    setModalBono({ open: true, bono: b });
  };

  const guardarBono = async () => {
    const supabase = getSupabase();
    if (!supabase) return alert('No se pudo conectar con la base de datos.');
    if (!formBono.colaborador.trim()) return alert('Ingresa el colaborador o grupo beneficiario.');
    if (formBono.monto <= 0) return alert('El monto debe ser mayor a cero.');

    setGuardando(true);
    try {
      if (modalBono.bono) {
        const { error } = await supabase.from('bonificaciones')
          .update({ ...formBono })
          .eq('id', modalBono.bono.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('bonificaciones')
          .insert([{ ...formBono, estado: 'PROGRAMADO' }]);
        if (error) throw error;
      }
      setModalBono({ open: false, bono: null });
      cargarTodo();
    } catch (err: any) {
      alert('Error al guardar el bono: ' + (err.message || err));
    } finally {
      setGuardando(false);
    }
  };

  const cambiarEstadoBono = async (id: string, estado: string) => {
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase.from('bonificaciones').update({ estado }).eq('id', id);
    if (error) return alert('Error: ' + error.message);
    setBonificaciones((prev) => prev.map((b) => (b.id === id ? { ...b, estado: estado as any } : b)));
  };

  const eliminarBono = async (id: string) => {
    if (!confirm('¿Eliminar esta bonificación?')) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase.from('bonificaciones').delete().eq('id', id);
    if (error) return alert('Error al eliminar: ' + error.message);
    cargarTodo();
  };

  /* ---------------- MÉTRICAS ---------------- */

  const bonosProgramadosTotal = bonificaciones
    .filter((b) => b.estado !== 'PAGADO')
    .reduce((a, b) => a + Number(b.monto || 0), 0);
  const bonosPagadosTotal = bonificaciones
    .filter((b) => b.estado === 'PAGADO')
    .reduce((a, b) => a + Number(b.monto || 0), 0);
  const reservaNavidad = bonificaciones
    .filter((b) => b.tipo_bono === 'NAVIDAD_FIN_ANO' && b.estado !== 'PAGADO')
    .reduce((a, b) => a + Number(b.monto || 0), 0);

  const labelTipoBono = (tipo: string) => TIPOS_BONO.find((t) => t.value === tipo)?.label || tipo;

  const colorEstado: Record<string, string> = {
    PROGRAMADO: '#f1c40f', APROBADO: '#3498db', PAGADO: '#2ecc71',
  };

  if (cargando) {
    return <p style={{ color: '#888', padding: '20px' }}>Cargando comisiones y bonificaciones...</p>;
  }

  return (
    <div>
      {/* NAVEGACIÓN INTERNA DEL SUBMÓDULO */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <button
          onClick={() => setSubTab('comisiones')}
          style={{
            padding: "8px 16px", borderRadius: "6px",
            border: subTab === 'comisiones' ? "1px solid #DAA520" : "1px solid #333",
            background: subTab === 'comisiones' ? "#DAA520" : "#111",
            color: subTab === 'comisiones' ? "#000" : "#DAA520",
            fontWeight: "bold", cursor: "pointer", fontSize: "0.82rem"
          }}
        >
          📈 Comisiones por Utilidad de Venta
        </button>

        <button
          onClick={() => setSubTab('bonificaciones')}
          style={{
            padding: "8px 16px", borderRadius: "6px",
            border: subTab === 'bonificaciones' ? "1px solid #DAA520" : "1px solid #333",
            background: subTab === 'bonificaciones' ? "#DAA520" : "#111",
            color: subTab === 'bonificaciones' ? "#000" : "#DAA520",
            fontWeight: "bold", cursor: "pointer", fontSize: "0.82rem"
          }}
        >
          🎁 Bonificaciones, Metas & Feriados
        </button>
      </div>

      {/* MÉTRICAS CABECERA */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px", marginBottom: "25px" }}>
        <div style={{ background: "#111111", border: "1px solid rgba(218, 165, 32, 0.3)", padding: "16px", borderRadius: "10px" }}>
          <span style={{ color: "#aaa", fontSize: "0.75rem", textTransform: "uppercase" }}>Bonos Pagados</span>
          <h2 style={{ color: "#2ecc71", margin: "6px 0 2px 0", fontSize: "1.4rem" }}>${bonosPagadosTotal.toFixed(2)} USD</h2>
          <span style={{ color: "#666", fontSize: "0.72rem" }}>Total histórico liquidado</span>
        </div>

        <div style={{ background: "#111111", border: "1px solid rgba(218, 165, 32, 0.3)", padding: "16px", borderRadius: "10px" }}>
          <span style={{ color: "#aaa", fontSize: "0.75rem", textTransform: "uppercase" }}>Bonos Programados</span>
          <h2 style={{ color: "#DAA520", margin: "6px 0 2px 0", fontSize: "1.4rem" }}>${bonosProgramadosTotal.toFixed(2)} USD</h2>
          <span style={{ color: "#666", fontSize: "0.72rem" }}>Pendientes de pago</span>
        </div>

        <div style={{ background: "#111111", border: "1px solid rgba(218, 165, 32, 0.3)", padding: "16px", borderRadius: "10px" }}>
          <span style={{ color: "#aaa", fontSize: "0.75rem", textTransform: "uppercase" }}>Reserva Fondo Navideño</span>
          <h2 style={{ color: "#e67e22", margin: "6px 0 2px 0", fontSize: "1.4rem" }}>${reservaNavidad.toFixed(2)} USD</h2>
          <span style={{ color: "#666", fontSize: "0.72rem" }}>Programado, sin pagar aún</span>
        </div>
      </div>

      {/* VISTA 1: COMISIONES POR VENTA */}
      {subTab === 'comisiones' && (
        <div style={{ background: "#111", border: "1px solid rgba(218, 165, 32, 0.25)", borderRadius: "10px", padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px", flexWrap: "wrap", gap: "10px" }}>
            <h3 style={{ color: "#DAA520", margin: 0, fontSize: "1rem", textTransform: "uppercase", letterSpacing: "0.8px" }}>
              ⚙️ Porcentajes de Comisión sobre Utilidad Real
            </h3>
            <button style={btnGold} onClick={abrirNuevaRegla}>+ Nueva Regla</button>
          </div>

          {(mostrarNuevaRegla || editandoRegla) && (
            <div style={{ background: "#0a0a0a", border: "1px dashed rgba(218,165,32,0.4)", borderRadius: "8px", padding: "16px", marginBottom: "18px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.4fr auto", gap: "10px", alignItems: "end" }}>
                <div>
                  <label style={{ fontSize: '0.68rem', color: '#888', display: 'block', marginBottom: 4 }}>Grupo / Rol</label>
                  <input style={inputSt} value={formRegla.rol}
                    onChange={(e) => setFormRegla({ ...formRegla, rol: e.target.value })}
                    placeholder="Ej: Vendedores Directos" />
                </div>
                <div>
                  <label style={{ fontSize: '0.68rem', color: '#888', display: 'block', marginBottom: 4 }}>Porcentaje (%)</label>
                  <input style={inputSt} type="number" min={0} max={100} step="0.1" value={formRegla.porcentaje}
                    onChange={(e) => setFormRegla({ ...formRegla, porcentaje: Number(e.target.value) || 0 })} />
                </div>
                <div>
                  <label style={{ fontSize: '0.68rem', color: '#888', display: 'block', marginBottom: 4 }}>Base de cálculo</label>
                  <select style={inputSt} value={formRegla.base}
                    onChange={(e) => setFormRegla({ ...formRegla, base: e.target.value })}>
                    <option value="UTILIDAD_NETA">Utilidad Neta</option>
                    <option value="VENTA_BRUTA">Venta Bruta</option>
                    <option value="MONTO_FIJO">Monto Fijo</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button style={btnGold} disabled={guardando} onClick={guardarRegla}>
                    {guardando ? 'Guardando...' : 'Guardar'}
                  </button>
                  <button style={btnOutline} onClick={() => { setMostrarNuevaRegla(false); setEditandoRegla(null); }}>
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          {reglas.length === 0 ? (
            <p style={{ color: '#666', fontSize: '0.85rem', textAlign: 'center', padding: '20px' }}>
              No hay reglas de comisión cargadas. Crea la primera con "+ Nueva Regla".
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", color: "#fff", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "#181818", borderBottom: "1px solid rgba(218, 165, 32, 0.3)", color: "#DAA520", textAlign: "left" }}>
                    <th style={{ padding: "10px" }}>GRUPO / ROL</th>
                    <th style={{ padding: "10px" }}>PORCENTAJE</th>
                    <th style={{ padding: "10px" }}>BASE DE CÁLCULO</th>
                    <th style={{ padding: "10px", textAlign: "right" }}>ACCIÓN</th>
                  </tr>
                </thead>
                <tbody>
                  {reglas.map((r) => (
                    <tr key={r.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <td style={{ padding: "10px", fontWeight: "bold" }}>{r.rol}</td>
                      <td style={{ padding: "10px", color: "#DAA520", fontWeight: "bold" }}>{r.porcentaje}%</td>
                      <td style={{ padding: "10px", color: "#aaa" }}>
                        {r.base === 'UTILIDAD_NETA' ? 'Utilidad Real (Venta − Costo)' : r.base === 'VENTA_BRUTA' ? 'Venta Bruta' : 'Monto Fijo'}
                      </td>
                      <td style={{ padding: "10px", textAlign: "right", whiteSpace: 'nowrap' }}>
                        <button style={{ ...btnOutline, marginRight: 6 }} onClick={() => abrirEditarRegla(r)}>Editar</button>
                        <button style={{ ...btnOutline, color: '#e74c3c', borderColor: '#e74c3c' }} onClick={() => eliminarRegla(r.id)}>Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VISTA 2: BONIFICACIONES & FERIADOS */}
      {subTab === 'bonificaciones' && (
        <div style={{ background: "#111", border: "1px solid rgba(218, 165, 32, 0.25)", borderRadius: "10px", padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px", flexWrap: "wrap", gap: "10px" }}>
            <h3 style={{ color: "#DAA520", margin: 0, fontSize: "1rem", textTransform: "uppercase", letterSpacing: "0.8px" }}>
              🎄 Programación de Bonificaciones Estacionales & Desempeño
            </h3>
            <button style={btnGold} onClick={abrirNuevoBono}>+ Programar Nuevo Bono</button>
          </div>

          {bonificaciones.length === 0 ? (
            <p style={{ color: '#666', fontSize: '0.85rem', textAlign: 'center', padding: '20px' }}>
              No hay bonificaciones programadas todavía.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", color: "#fff", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "#181818", borderBottom: "1px solid rgba(218, 165, 32, 0.3)", color: "#DAA520", textAlign: "left" }}>
                    <th style={{ padding: "10px" }}>BENEFICIARIO / GRUPO</th>
                    <th style={{ padding: "10px" }}>TIPO DE BONO</th>
                    <th style={{ padding: "10px" }}>FECHA PAGO</th>
                    <th style={{ padding: "10px", textAlign: "right" }}>MONTO ($)</th>
                    <th style={{ padding: "10px", textAlign: "center" }}>ESTADO</th>
                    <th style={{ padding: "10px", textAlign: "right" }}>ACCIÓN</th>
                  </tr>
                </thead>
                <tbody>
                  {bonificaciones.map((b) => (
                    <tr key={b.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <td style={{ padding: "12px 10px" }}>
                        <div style={{ fontWeight: "bold" }}>{b.colaborador}</div>
                        {b.notas && <div style={{ fontSize: "0.75rem", color: "#666" }}>{b.notas}</div>}
                      </td>
                      <td style={{ padding: "12px 10px", fontSize: "0.78rem" }}>{labelTipoBono(b.tipo_bono)}</td>
                      <td style={{ padding: "12px 10px", color: "#aaa" }}>{b.fecha_programada}</td>
                      <td style={{ padding: "12px 10px", textAlign: "right", color: "#DAA520", fontWeight: "bold" }}>
                        ${Number(b.monto).toFixed(2)}
                      </td>
                      <td style={{ padding: "12px 10px", textAlign: "center" }}>
                        <select
                          value={b.estado}
                          onChange={(e) => cambiarEstadoBono(b.id, e.target.value)}
                          style={{
                            background: '#0a0a0a', border: `1px solid ${colorEstado[b.estado]}55`,
                            color: colorEstado[b.estado], borderRadius: '4px', padding: '4px 8px',
                            fontSize: '0.72rem', fontWeight: 'bold',
                          }}
                        >
                          {ESTADOS_BONO.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: "12px 10px", textAlign: "right", whiteSpace: 'nowrap' }}>
                        <button style={{ ...btnOutline, marginRight: 6 }} onClick={() => abrirEditarBono(b)}>Editar</button>
                        <button style={{ ...btnOutline, color: '#e74c3c', borderColor: '#e74c3c' }} onClick={() => eliminarBono(b.id)}>Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL: NUEVO / EDITAR BONO */}
      {modalBono.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: '#111', border: '1px solid rgba(218,165,32,0.3)', borderRadius: '10px', padding: '24px', maxWidth: '480px', width: '100%' }}>
            <h3 style={{ color: '#DAA520', marginTop: 0, fontSize: '1rem', textTransform: 'uppercase' }}>
              {modalBono.bono ? 'Editar Bonificación' : 'Programar Nueva Bonificación'}
            </h3>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: '0.68rem', color: '#888', display: 'block', marginBottom: 4 }}>Beneficiario / Grupo</label>
              <input style={inputSt} value={formBono.colaborador}
                onChange={(e) => setFormBono({ ...formBono, colaborador: e.target.value })}
                placeholder="Ej: Equipo Operativo & Bodega" />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: '0.68rem', color: '#888', display: 'block', marginBottom: 4 }}>Rol</label>
              <input style={inputSt} value={formBono.rol}
                onChange={(e) => setFormBono({ ...formBono, rol: e.target.value })}
                placeholder="Ej: Bodega / Logística" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: '0.68rem', color: '#888', display: 'block', marginBottom: 4 }}>Tipo de bono</label>
                <select style={inputSt} value={formBono.tipo_bono}
                  onChange={(e) => setFormBono({ ...formBono, tipo_bono: e.target.value })}>
                  {TIPOS_BONO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.68rem', color: '#888', display: 'block', marginBottom: 4 }}>Monto ($ USD)</label>
                <input style={inputSt} type="number" min={0} step="0.01" value={formBono.monto}
                  onChange={(e) => setFormBono({ ...formBono, monto: Number(e.target.value) || 0 })} />
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: '0.68rem', color: '#888', display: 'block', marginBottom: 4 }}>Fecha programada</label>
              <input style={inputSt} type="date" value={formBono.fecha_programada}
                onChange={(e) => setFormBono({ ...formBono, fecha_programada: e.target.value })} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: '0.68rem', color: '#888', display: 'block', marginBottom: 4 }}>Notas</label>
              <textarea style={{ ...inputSt, resize: 'vertical', minHeight: 60 }} value={formBono.notas}
                onChange={(e) => setFormBono({ ...formBono, notas: e.target.value })}
                placeholder="Ej: Bono por despacho 100% a tiempo Q3" />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button style={btnOutline} onClick={() => setModalBono({ open: false, bono: null })}>Cancelar</button>
              <button style={btnGold} disabled={guardando} onClick={guardarBono}>
                {guardando ? 'Guardando...' : 'Guardar Bono'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}