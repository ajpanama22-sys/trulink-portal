import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import Sidebar from './Sidebar';
import { supabase } from '../../lib/supabaseClient';

/**
 * Módulo de RMA y Garantías
 * --------------------------------------------------
 * Esquema REAL de la tabla "rmas" en Supabase (confirmado por el usuario):
 *   id                    uuid
 *   rma_number            text   -> número correlativo del RMA (ej. RMA-00001)
 *   referencia            text   -> referencia de la FACTURA DESPACHADA (quotes.referencia)
 *   cliente_nombre        text
 *   cliente_email         text
 *   motivo                text
 *   descripcion           text   -> producto / ítem reportado
 *   estado                text
 *   tipo_resolucion       text   -> 'Cambio de Producto' | 'Nota de Crédito' | null
 *   producto_cambio       text
 *   numero_nota_credito   text
 *   monto_nota_credito    numeric
 *   notas_seguimiento     text   -> bitácora en texto plano
 *   created_at            timestamptz
 *   updated_at            timestamptz
 *
 * Regla de negocio clave: un RMA NUNCA se abre sobre una cotización.
 * Solo se abre sobre una FACTURA YA DESPACHADA (quotes.status = 'despachado_exw'):
 * pago verificado al 100% contra cuentas_por_cobrar y salida autorizada en el
 * Centro de Despachos EXW. Por eso el formulario consulta esa lista real en
 * vez de aceptar un código escrito a mano.
 *
 * Tampoco se realizan reparaciones. Toda garantía se resuelve únicamente de 2 formas:
 *   1) Cambio de Producto
 *   2) Nota de Crédito a favor del cliente
 *
 * Flujo: Pendiente -> En Revisión -> (Rechazado | Finalizado)
 * Al Finalizar se exige elegir tipo_resolucion.
 */

type Estado = 'Pendiente' | 'En Revisión' | 'Rechazado' | 'Finalizado';
type TipoResolucion = 'Cambio de Producto' | 'Nota de Crédito';

interface RmaItem {
  id: string;
  rma_number: string | null;
  referencia: string;
  cliente_nombre: string;
  cliente_email: string | null;
  motivo: string;
  descripcion: string;
  estado: Estado;
  tipo_resolucion: TipoResolucion | null;
  producto_cambio: string | null;
  numero_nota_credito: string | null;
  monto_nota_credito: number | null;
  notas_seguimiento: string | null;
  created_at: string;
  updated_at?: string;
}

interface FacturaDespachada {
  referencia: string;
  empresa: string | null;
  email: string | null;
  fecha_despacho: string | null;
  guia_envio: string | null;
}

const ESTADOS: Estado[] = ['Pendiente', 'En Revisión', 'Rechazado', 'Finalizado'];

function nowStamp() {
  return new Date().toLocaleString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function appendLog(existing: string | null, entry: string) {
  const line = `[${nowStamp()}] ${entry}`;
  return existing ? `${existing}\n${line}` : line;
}

export default function RmasAdmin() {
  const router = useRouter();
  const [rmas, setRmas] = useState<RmaItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filtroEstado, setFiltroEstado] = useState<string>('Todos');

  // Modal: registrar nuevo RMA (recepción)
  const [showModal, setShowModal] = useState<boolean>(false);
  const [referenciaSel, setReferenciaSel] = useState('');
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteEmail, setClienteEmail] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [motivo, setMotivo] = useState('');

  // Facturas EXW ya despachadas (pago verificado + salida autorizada).
  // Solo sobre estas se puede abrir un RMA — no sobre una simple cotización.
  const [facturasDespachadas, setFacturasDespachadas] = useState<FacturaDespachada[]>([]);
  const [cargandoFacturas, setCargandoFacturas] = useState(false);

  // Modal: resolver RMA (cambio de producto / nota de crédito)
  const [resolviendoId, setResolviendoId] = useState<string | null>(null);
  const [tipoResolucion, setTipoResolucion] = useState<TipoResolucion>('Cambio de Producto');
  const [productoCambio, setProductoCambio] = useState('');
  const [numeroNotaCredito, setNumeroNotaCredito] = useState('');
  const [montoNotaCredito, setMontoNotaCredito] = useState('');

  // Modal: ver bitácora
  const [verLogId, setVerLogId] = useState<string | null>(null);

  useEffect(() => {
    fetchRmas();
  }, []);

  // Si se llega desde el módulo de Cotizaciones/Despachos con ?buscar=QT-1234, precarga el filtro
  useEffect(() => {
    if (!router.isReady) return;
    const buscar = router.query.buscar;
    if (buscar && typeof buscar === 'string') {
      setSearchTerm(buscar);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query.buscar]);

  const fetchRmas = async () => {
    setLoading(true);
    if (!supabase) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('rmas')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error al cargar RMAs:', error.message);
    } else {
      setRmas(data || []);
    }
    setLoading(false);
  };

  // Solo se puede abrir un RMA sobre una factura EXW ya despachada
  // (pago verificado al 100% y salida autorizada en el Centro de Despachos).
  const fetchFacturasDespachadas = async () => {
    if (!supabase) return;
    setCargandoFacturas(true);
    const { data, error } = await supabase
      .from('quotes')
      .select('referencia, empresa, email, fecha_despacho, guia_envio')
      .eq('status', 'despachado_exw')
      .order('fecha_despacho', { ascending: false });

    if (error) {
      console.error('Error al cargar facturas despachadas:', error.message);
      setFacturasDespachadas([]);
    } else {
      setFacturasDespachadas(data || []);
    }
    setCargandoFacturas(false);
  };

  const abrirRegistro = () => {
    setShowModal(true);
    fetchFacturasDespachadas();
  };

  const handleSeleccionarFactura = (referencia: string) => {
    setReferenciaSel(referencia);
    const factura = facturasDespachadas.find((f) => f.referencia === referencia);
    if (factura) {
      if (factura.empresa && !clienteNombre) setClienteNombre(factura.empresa);
      if (factura.email && !clienteEmail) setClienteEmail(factura.email);
    }
  };

  const generarNumeroRma = () => {
    const siguiente = rmas.length + 1;
    return `RMA-${String(siguiente).padStart(5, '0')}`;
  };

  const handleCreateRma = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    if (!referenciaSel) {
      alert('Selecciona la factura despachada sobre la que se abre este RMA.');
      return;
    }

    const { error } = await supabase.from('rmas').insert([
      {
        rma_number: generarNumeroRma(),
        referencia: referenciaSel,
        cliente_nombre: clienteNombre,
        cliente_email: clienteEmail || null,
        motivo,
        descripcion,
        estado: 'Pendiente',
        tipo_resolucion: null,
        producto_cambio: null,
        numero_nota_credito: null,
        monto_nota_credito: null,
        notas_seguimiento: appendLog(null, `RMA recibido. Producto: "${descripcion}". Motivo: ${motivo}`),
        created_at: new Date().toISOString(),
      },
    ]);

    if (error) {
      alert('Error al registrar RMA: ' + error.message);
    } else {
      alert('RMA registrado exitosamente.');
      setShowModal(false);
      setReferenciaSel('');
      setClienteNombre('');
      setClienteEmail('');
      setDescripcion('');
      setMotivo('');
      fetchRmas();
    }
  };

  const handleUpdateEstadoSimple = async (item: RmaItem, nuevoEstado: Estado) => {
    if (!supabase) return;
    const log = appendLog(item.notas_seguimiento, `Estado cambiado a "${nuevoEstado}"`);
    const { error } = await supabase
      .from('rmas')
      .update({ estado: nuevoEstado, notas_seguimiento: log, updated_at: new Date().toISOString() })
      .eq('id', item.id);

    if (error) {
      alert('Error al actualizar estado: ' + error.message);
    } else {
      fetchRmas();
    }
  };

  const abrirResolucion = (item: RmaItem) => {
    setResolviendoId(item.id);
    setTipoResolucion('Cambio de Producto');
    setProductoCambio('');
    setNumeroNotaCredito('');
    setMontoNotaCredito('');
  };

  const handleResolver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !resolviendoId) return;

    const item = rmas.find((r) => r.id === resolviendoId);
    if (!item) return;

    if (tipoResolucion === 'Cambio de Producto' && !productoCambio.trim()) {
      alert('Indica el producto entregado en el cambio.');
      return;
    }
    if (tipoResolucion === 'Nota de Crédito' && (!montoNotaCredito || !numeroNotaCredito.trim())) {
      alert('Indica el número y monto de la nota de crédito.');
      return;
    }

    const detalle =
      tipoResolucion === 'Cambio de Producto'
        ? `Resuelto por CAMBIO DE PRODUCTO. Producto entregado: "${productoCambio}"`
        : `Resuelto por NOTA DE CRÉDITO. N° ${numeroNotaCredito} por $${montoNotaCredito}`;

    const { error } = await supabase
      .from('rmas')
      .update({
        estado: 'Finalizado',
        tipo_resolucion: tipoResolucion,
        producto_cambio: tipoResolucion === 'Cambio de Producto' ? productoCambio : null,
        numero_nota_credito: tipoResolucion === 'Nota de Crédito' ? numeroNotaCredito : null,
        monto_nota_credito: tipoResolucion === 'Nota de Crédito' ? parseFloat(montoNotaCredito) : null,
        notas_seguimiento: appendLog(item.notas_seguimiento, detalle),
        updated_at: new Date().toISOString(),
      })
      .eq('id', resolviendoId);

    if (error) {
      alert('Error al finalizar RMA: ' + error.message);
    } else {
      setResolviendoId(null);
      fetchRmas();
    }
  };

  const filteredRmas = useMemo(() => {
    return rmas.filter((item) => {
      const t = searchTerm.toLowerCase();
      const matchesSearch =
        item.referencia?.toLowerCase().includes(t) ||
        item.cliente_nombre?.toLowerCase().includes(t) ||
        item.descripcion?.toLowerCase().includes(t) ||
        item.rma_number?.toLowerCase().includes(t);
      const matchesEstado = filtroEstado === 'Todos' || item.estado === filtroEstado;
      return matchesSearch && matchesEstado;
    });
  }, [rmas, searchTerm, filtroEstado]);

  const stats = useMemo(() => {
    const total = rmas.length;
    const pendientes = rmas.filter((r) => r.estado === 'Pendiente').length;
    const enRevision = rmas.filter((r) => r.estado === 'En Revisión').length;
    const cambios = rmas.filter((r) => r.tipo_resolucion === 'Cambio de Producto').length;
    const notasCredito = rmas.filter((r) => r.tipo_resolucion === 'Nota de Crédito').length;
    const montoTotalCredito = rmas
      .filter((r) => r.monto_nota_credito)
      .reduce((acc, r) => acc + (r.monto_nota_credito || 0), 0);
    return { total, pendientes, enRevision, cambios, notasCredito, montoTotalCredito };
  }, [rmas]);

  const estadoColor = (estado: Estado) => {
    switch (estado) {
      case 'Finalizado':
        return { bg: 'rgba(46, 204, 113, 0.2)', fg: '#2ecc71' };
      case 'Rechazado':
        return { bg: 'rgba(231, 76, 60, 0.2)', fg: '#e74c3c' };
      case 'En Revisión':
        return { bg: 'rgba(52, 152, 219, 0.2)', fg: '#3498db' };
      default:
        return { bg: 'rgba(241, 196, 15, 0.2)', fg: '#f1c40f' };
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px',
    borderRadius: '6px',
    backgroundColor: '#000',
    border: '1px solid rgba(218,165,32,0.5)',
    color: '#fff',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '5px',
    fontSize: '0.85rem',
    color: '#DAA520',
  };

  const statCard = (titulo: string, valor: string | number, color = '#FFD700') => (
    <div
      style={{
        flex: 1,
        minWidth: '140px',
        backgroundColor: '#111',
        border: '1px solid rgba(218,165,32,0.25)',
        borderRadius: '10px',
        padding: '16px 18px',
      }}
    >
      <p style={{ color: '#888', fontSize: '0.75rem', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {titulo}
      </p>
      <p style={{ color, fontSize: '1.5rem', fontWeight: 800 }}>{valor}</p>
    </div>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#000', color: '#DAA520', fontFamily: 'sans-serif' }}>
      <Sidebar currentActive="rmas" />

      <main style={{ flex: 1, padding: '40px', boxSizing: 'border-box', overflowY: 'auto' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '25px',
            borderBottom: '1px solid rgba(218,165,32,0.3)',
            paddingBottom: '20px',
          }}
        >
          <div>
            <h1 style={{ fontSize: '1.8rem', color: '#FFD700', marginBottom: '5px', fontWeight: '800', letterSpacing: '1px' }}>
              RMA y Garantías
            </h1>
            <p style={{ color: '#aaa', fontSize: '0.9rem' }}>
              Solo se abren sobre <strong style={{ color: '#DAA520' }}>facturas ya pagadas y despachadas</strong> (EXW).
              Toda garantía se resuelve por <strong style={{ color: '#DAA520' }}>cambio de producto</strong> o{' '}
              <strong style={{ color: '#DAA520' }}>nota de crédito</strong> — no se realizan reparaciones.
            </p>
          </div>
          <button
            onClick={abrirRegistro}
            style={{
              padding: '12px 20px',
              backgroundColor: '#DAA520',
              color: '#000',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 0 15px rgba(218,165,32,0.4)',
              whiteSpace: 'nowrap',
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#FFD700')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#DAA520')}
          >
            + Registrar Nuevo RMA
          </button>
        </div>

        {/* Estadísticas rápidas */}
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '25px' }}>
          {statCard('Total RMA', stats.total)}
          {statCard('Pendientes', stats.pendientes, '#f1c40f')}
          {statCard('En Revisión', stats.enRevision, '#3498db')}
          {statCard('Cambios de Producto', stats.cambios, '#2ecc71')}
          {statCard('Notas de Crédito', stats.notasCredito, '#2ecc71')}
          {statCard('Monto Total en Créditos', `$${stats.montoTotalCredito.toFixed(2)}`, '#FFD700')}
        </div>

        {/* Buscador + filtro estado */}
        <div style={{ display: 'flex', gap: '15px', marginBottom: '25px', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Buscar por N° RMA, referencia de factura, cliente o producto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: 1,
              minWidth: '260px',
              padding: '12px 18px',
              borderRadius: '8px',
              backgroundColor: '#111',
              border: '1px solid rgba(218,165,32,0.5)',
              color: '#FFD700',
              outline: 'none',
              fontSize: '0.95rem',
              boxSizing: 'border-box',
            }}
          />
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            style={{
              padding: '12px 18px',
              borderRadius: '8px',
              backgroundColor: '#111',
              border: '1px solid rgba(218,165,32,0.5)',
              color: '#FFD700',
              fontSize: '0.95rem',
            }}
          >
            <option value="Todos">Todos los estados</option>
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>

        {/* Tabla de Registros */}
        {loading ? (
          <p style={{ color: '#DAA520', textAlign: 'center', marginTop: '50px' }}>Cargando registros de RMA...</p>
        ) : filteredRmas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px', backgroundColor: '#111', borderRadius: '12px', border: '1px solid rgba(218,165,32,0.2)' }}>
            <p style={{ color: '#888', fontSize: '1.1rem' }}>No se encontraron registros de RMA o garantías.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#111', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(218,165,32,0.3)' }}>
              <thead>
                <tr style={{ backgroundColor: '#1a1a1a', borderBottom: '1px solid rgba(218,165,32,0.4)', textAlign: 'left' }}>
                  <th style={{ padding: '15px', color: '#FFD700', fontSize: '0.85rem' }}>N° RMA</th>
                  <th style={{ padding: '15px', color: '#FFD700', fontSize: '0.85rem' }}>Factura Despachada</th>
                  <th style={{ padding: '15px', color: '#FFD700', fontSize: '0.85rem' }}>Cliente</th>
                  <th style={{ padding: '15px', color: '#FFD700', fontSize: '0.85rem' }}>Producto</th>
                  <th style={{ padding: '15px', color: '#FFD700', fontSize: '0.85rem' }}>Motivo / Falla</th>
                  <th style={{ padding: '15px', color: '#FFD700', fontSize: '0.85rem' }}>Estado</th>
                  <th style={{ padding: '15px', color: '#FFD700', fontSize: '0.85rem' }}>Resolución</th>
                  <th style={{ padding: '15px', color: '#FFD700', fontSize: '0.85rem' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredRmas.map((item) => {
                  const colors = estadoColor(item.estado);
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid rgba(218,165,32,0.1)' }}>
                      <td style={{ padding: '15px', color: '#ccc', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                        {item.rma_number || '—'}
                      </td>
                      <td style={{ padding: '15px', fontWeight: 'bold' }}>
                        <button
                          onClick={() => router.push(`/admin/cotizaciones?ref=${encodeURIComponent(item.referencia)}`)}
                          title="Ver la factura/despacho original en el módulo de Cotizaciones"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#FFD700',
                            textDecoration: 'underline',
                            cursor: 'pointer',
                            padding: 0,
                            fontWeight: 'bold',
                            fontSize: '0.9rem',
                          }}
                        >
                          {item.referencia} ↗
                        </button>
                      </td>
                      <td style={{ padding: '15px', color: '#eee' }}>
                        {item.cliente_nombre}
                        {item.cliente_email && (
                          <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '2px' }}>{item.cliente_email}</div>
                        )}
                      </td>
                      <td style={{ padding: '15px', color: '#ccc' }}>{item.descripcion}</td>
                      <td style={{ padding: '15px', color: '#bbb', maxWidth: '220px' }}>{item.motivo}</td>
                      <td style={{ padding: '15px' }}>
                        <span
                          style={{
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontSize: '0.8rem',
                            fontWeight: 'bold',
                            backgroundColor: colors.bg,
                            color: colors.fg,
                            border: `1px solid ${colors.fg}`,
                          }}
                        >
                          {item.estado}
                        </span>
                      </td>
                      <td style={{ padding: '15px', color: '#ccc', fontSize: '0.85rem' }}>
                        {item.tipo_resolucion === 'Cambio de Producto' && (
                          <span>🔁 Cambio: {item.producto_cambio}</span>
                        )}
                        {item.tipo_resolucion === 'Nota de Crédito' && (
                          <span>
                            💳 NC {item.numero_nota_credito} — ${item.monto_nota_credito?.toFixed(2)}
                          </span>
                        )}
                        {!item.tipo_resolucion && <span style={{ color: '#555' }}>—</span>}
                      </td>
                      <td style={{ padding: '15px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '160px' }}>
                          {item.estado !== 'Finalizado' && (
                            <>
                              <select
                                value={item.estado}
                                onChange={(e) => handleUpdateEstadoSimple(item, e.target.value as Estado)}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  backgroundColor: '#000',
                                  color: '#DAA520',
                                  border: '1px solid rgba(218,165,32,0.5)',
                                  cursor: 'pointer',
                                  fontSize: '0.8rem',
                                }}
                              >
                                <option value="Pendiente">Pendiente</option>
                                <option value="En Revisión">En Revisión</option>
                                <option value="Rechazado">Rechazado</option>
                              </select>
                              <button
                                onClick={() => abrirResolucion(item)}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  backgroundColor: 'rgba(46,204,113,0.15)',
                                  color: '#2ecc71',
                                  border: '1px solid #2ecc71',
                                  cursor: 'pointer',
                                  fontSize: '0.8rem',
                                  fontWeight: 'bold',
                                }}
                              >
                                Finalizar (Cambio / NC)
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => setVerLogId(item.id)}
                            style={{
                              padding: '6px 10px',
                              borderRadius: '6px',
                              backgroundColor: 'transparent',
                              color: '#888',
                              border: '1px solid #444',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                            }}
                          >
                            Ver bitácora
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal: Registrar nuevo RMA */}
        {showModal && (
          <div style={overlayStyle}>
            <div style={modalStyle}>
              <h2 style={{ color: '#FFD700', marginBottom: '20px', fontSize: '1.3rem' }}>Registrar RMA / Garantía</h2>
              <form onSubmit={handleCreateRma} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div>
                  <label style={labelStyle}>Factura Despachada (EXW — pago verificado)</label>
                  {cargandoFacturas ? (
                    <p style={{ color: '#DAA520', fontSize: '0.85rem', fontStyle: 'italic' }}>Cargando facturas despachadas...</p>
                  ) : facturasDespachadas.length === 0 ? (
                    <p style={{ color: '#e74c3c', fontSize: '0.8rem', fontStyle: 'italic' }}>
                      No hay ninguna factura en estado "despachado_exw" todavía. Un RMA solo puede abrirse sobre una
                      factura ya pagada y despachada — genera primero el despacho en el módulo de Despachos.
                    </p>
                  ) : (
                    <select
                      required
                      value={referenciaSel}
                      onChange={(e) => handleSeleccionarFactura(e.target.value)}
                      style={{ ...inputStyle, color: '#DAA520' }}
                    >
                      <option value="">Selecciona la factura despachada...</option>
                      {facturasDespachadas.map((f) => (
                        <option key={f.referencia} value={f.referencia}>
                          {f.referencia} — {f.empresa || 'Sin empresa'}
                          {f.fecha_despacho ? ` — despachado ${new Date(f.fecha_despacho).toLocaleDateString()}` : ''}
                          {f.guia_envio ? ` — Guía ${f.guia_envio}` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                  <p style={{ fontSize: '0.75rem', color: '#777', marginTop: '4px' }}>
                    Solo se listan facturas con pago verificado al 100% y salida autorizada (EXW).
                  </p>
                </div>
                <div>
                  <label style={labelStyle}>Cliente</label>
                  <input
                    type="text"
                    required
                    placeholder="Nombre del cliente o empresa"
                    value={clienteNombre}
                    onChange={(e) => setClienteNombre(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Email del Cliente (opcional)</label>
                  <input
                    type="email"
                    placeholder="cliente@empresa.com"
                    value={clienteEmail}
                    onChange={(e) => setClienteEmail(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Producto / Ítem</label>
                  <input
                    type="text"
                    required
                    placeholder="Descripción del producto"
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Motivo de la Garantía</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Detalle de la falla o motivo reportado..."
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button
                    type="submit"
                    style={{
                      ...primaryButtonStyle,
                      opacity: facturasDespachadas.length === 0 ? 0.5 : 1,
                      cursor: facturasDespachadas.length === 0 ? 'not-allowed' : 'pointer',
                    }}
                    disabled={facturasDespachadas.length === 0}
                  >
                    Guardar
                  </button>
                  <button type="button" onClick={() => setShowModal(false)} style={secondaryButtonStyle}>
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Resolver RMA (Cambio o Nota de Crédito) */}
        {resolviendoId && (
          <div style={overlayStyle}>
            <div style={modalStyle}>
              <h2 style={{ color: '#FFD700', marginBottom: '10px', fontSize: '1.3rem' }}>Finalizar Garantía</h2>
              <p style={{ color: '#999', fontSize: '0.85rem', marginBottom: '20px' }}>
                Selecciona cómo se resuelve esta garantía. No se registran reparaciones.
              </p>
              <form onSubmit={handleResolver} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div>
                  <label style={labelStyle}>Tipo de Resolución</label>
                  <select
                    value={tipoResolucion}
                    onChange={(e) => setTipoResolucion(e.target.value as TipoResolucion)}
                    style={{ ...inputStyle, color: '#DAA520' }}
                  >
                    <option value="Cambio de Producto">Cambio de Producto</option>
                    <option value="Nota de Crédito">Nota de Crédito</option>
                  </select>
                </div>

                {tipoResolucion === 'Cambio de Producto' ? (
                  <div>
                    <label style={labelStyle}>Producto entregado en el cambio</label>
                    <input
                      type="text"
                      required
                      placeholder="Descripción / serial del producto de reemplazo"
                      value={productoCambio}
                      onChange={(e) => setProductoCambio(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                ) : (
                  <>
                    <div>
                      <label style={labelStyle}>N° de Nota de Crédito</label>
                      <input
                        type="text"
                        required
                        placeholder="Ej. NC-0001"
                        value={numeroNotaCredito}
                        onChange={(e) => setNumeroNotaCredito(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Monto de la Nota de Crédito ($)</label>
                      <input
                        type="number"
                        required
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={montoNotaCredito}
                        onChange={(e) => setMontoNotaCredito(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                  </>
                )}

                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button type="submit" style={primaryButtonStyle}>
                    Confirmar y Finalizar
                  </button>
                  <button type="button" onClick={() => setResolviendoId(null)} style={secondaryButtonStyle}>
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Ver bitácora / log */}
        {verLogId && (
          <div style={overlayStyle}>
            <div style={{ ...modalStyle, maxWidth: '600px' }}>
              <h2 style={{ color: '#FFD700', marginBottom: '15px', fontSize: '1.3rem' }}>Bitácora del RMA</h2>
              <div
                style={{
                  backgroundColor: '#000',
                  border: '1px solid rgba(218,165,32,0.3)',
                  borderRadius: '8px',
                  padding: '15px',
                  maxHeight: '350px',
                  overflowY: 'auto',
                  whiteSpace: 'pre-line',
                  color: '#ccc',
                  fontSize: '0.85rem',
                  lineHeight: 1.6,
                }}
              >
                {rmas.find((r) => r.id === verLogId)?.notas_seguimiento || 'Sin registros de bitácora.'}
              </div>
              <div style={{ marginTop: '20px' }}>
                <button onClick={() => setVerLogId(null)} style={secondaryButtonStyle}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  backgroundColor: 'rgba(0,0,0,0.85)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  backgroundColor: '#111',
  padding: '30px',
  borderRadius: '12px',
  border: '1px solid #DAA520',
  width: '100%',
  maxWidth: '500px',
  boxShadow: '0 0 30px rgba(218,165,32,0.3)',
  boxSizing: 'border-box',
};

const primaryButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: '12px',
  backgroundColor: '#DAA520',
  color: '#000',
  border: 'none',
  borderRadius: '6px',
  fontWeight: 'bold',
  cursor: 'pointer',
};

const secondaryButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: '12px',
  backgroundColor: 'transparent',
  color: '#DAA520',
  border: '1px solid #DAA520',
  borderRadius: '6px',
  fontWeight: 'bold',
  cursor: 'pointer',
};