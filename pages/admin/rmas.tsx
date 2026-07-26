import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Sidebar from './Sidebar';
import { supabase } from '../../lib/supabaseClient';

interface RmaItem {
  id: string;
  codigo_cotizacion: string;
  cliente: string;
  producto: string;
  motivo: string;
  estado: string;
  created_at: string;
}

export default function RmasAdmin() {
  const router = useRouter();
  const [rmas, setRmas] = useState<RmaItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Estado para el modal de registro de RMA
  const [showModal, setShowModal] = useState<boolean>(false);
  const [codigoCotizacion, setCodigoCotizacion] = useState<string>('');
  const [cliente, setCliente] = useState<string>('');
  const [producto, setProducto] = useState<string>('');
  const [motivo, setMotivo] = useState<string>('');
  const [estado, setEstado] = useState<string>('Pendiente');

  useEffect(() => {
    fetchRmas();
  }, []);

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

  const handleCreateRma = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    const { error } = await supabase.from('rmas').insert([
      {
        codigo_cotizacion: codigoCotizacion,
        cliente,
        producto,
        motivo,
        estado,
        created_at: new Date().toISOString(),
      },
    ]);

    if (error) {
      alert('Error al registrar RMA: ' + error.message);
    } else {
      alert('RMA registrado exitosamente bajo el código Trulink.');
      setShowModal(false);
      setCodigoCotizacion('');
      setCliente('');
      setProducto('');
      setMotivo('');
      setEstado('Pendiente');
      fetchRmas();
    }
  };

  const handleUpdateStatus = async (id: string, nuevoEstado: string) => {
    if (!supabase) return;
    const { error } = await supabase
      .from('rmas')
      .update({ estado: nuevoEstado })
      .eq('id', id);

    if (error) {
      alert('Error al actualizar estado: ' + error.message);
    } else {
      fetchRmas();
    }
  };

  const filteredRmas = rmas.filter(
    (item) =>
      item.codigo_cotizacion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.cliente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.producto?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#000', color: '#DAA520', fontFamily: 'sans-serif' }}>
      <Sidebar currentActive="rmas" />

      <main style={{ flex: 1, padding: '40px', boxSizing: 'border-box', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: '1px solid rgba(218,165,32,0.3)', paddingBottom: '20px' }}>
          <div>
            <h1 style={{ fontSize: '1.8rem', color: '#FFD700', marginBottom: '5px', fontWeight: '800', letterSpacing: '1px' }}>
              RMA y Garantías
            </h1>
            <p style={{ color: '#aaa', fontSize: '0.9rem' }}>
              Control y trazabilidad de devoluciones y garantías vinculadas a facturas y cotizaciones Trulink.
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
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
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#FFD700')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#DAA520')}
          >
            + Registrar Nuevo RMA
          </button>
        </div>

        {/* Buscador */}
        <div style={{ marginBottom: '25px' }}>
          <input
            type="text"
            placeholder="Buscar por código único de cotización/factura, cliente o producto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
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
        </div>

        {/* Tabla de Registros */}
        {loading ? (
          <p style={{ color: '#DAA520', textAlign: 'center', marginTop: '50px' }}>Cargando registros de RMA...</p>
        ) : filteredRmas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px', backgroundColor: '#111', borderRadius: '12px', border: '1px solid rgba(218,165,32,0.2)' }}>
            <p style={{ color: '#888', fontSize: '1.1rem' }}>No se encontraron registros de RMA o garantías activos.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#111', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(218,165,32,0.3)' }}>
              <thead>
                <tr style={{ backgroundColor: '#1a1a1a', borderBottom: '1px solid rgba(218,165,32,0.4)', textAlign: 'left' }}>
                  <th style={{ padding: '15px', color: '#FFD700', fontSize: '0.9rem' }}>Código Trulink (Cot/Factura)</th>
                  <th style={{ padding: '15px', color: '#FFD700', fontSize: '0.9rem' }}>Cliente</th>
                  <th style={{ padding: '15px', color: '#FFD700', fontSize: '0.9rem' }}>Producto</th>
                  <th style={{ padding: '15px', color: '#FFD700', fontSize: '0.9rem' }}>Motivo / Falla</th>
                  <th style={{ padding: '15px', color: '#FFD700', fontSize: '0.9rem' }}>Estado</th>
                  <th style={{ padding: '15px', color: '#FFD700', fontSize: '0.9rem' }}>Cambiar Estado</th>
                </tr>
              </thead>
              <tbody>
                {filteredRmas.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid rgba(218,165,32,0.1)' }}>
                    <td style={{ padding: '15px', fontWeight: 'bold', color: '#FFD700' }}>{item.codigo_cotizacion}</td>
                    <td style={{ padding: '15px', color: '#eee' }}>{item.cliente}</td>
                    <td style={{ padding: '15px', color: '#ccc' }}>{item.producto}</td>
                    <td style={{ padding: '15px', color: '#bbb', maxWidth: '250px' }}>{item.motivo}</td>
                    <td style={{ padding: '15px' }}>
                      <span
                        style={{
                          padding: '6px 12px',
                          borderRadius: '20px',
                          fontSize: '0.8rem',
                          fontWeight: 'bold',
                          backgroundColor:
                            item.estado === 'Aprobado' ? 'rgba(46, 204, 113, 0.2)' :
                            item.estado === 'Rechazado' ? 'rgba(231, 76, 60, 0.2)' :
                            'rgba(241, 196, 15, 0.2)',
                          color:
                            item.estado === 'Aprobado' ? '#2ecc71' :
                            item.estado === 'Rechazado' ? '#e74c3c' :
                            '#f1c40f',
                          border: `1px solid ${
                            item.estado === 'Aprobado' ? '#2ecc71' :
                            item.estado === 'Rechazado' ? '#e74c3c' :
                            '#f1c40f'
                          }`,
                        }}
                      >
                        {item.estado}
                      </span>
                    </td>
                    <td style={{ padding: '15px' }}>
                      <select
                        value={item.estado}
                        onChange={(e) => handleUpdateStatus(item.id, e.target.value)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          backgroundColor: '#000',
                          color: '#DAA520',
                          border: '1px solid rgba(218,165,32,0.5)',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                        }}
                      >
                        <option value="Pendiente">Pendiente</option>
                        <option value="En Revisión">En Revisión</option>
                        <option value="Aprobado">Aprobado</option>
                        <option value="Rechazado">Rechazado</option>
                        <option value="Resuelto">Resuelto</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal de Registro */}
        {showModal && (
          <div style={{
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
          }}>
            <div style={{
              backgroundColor: '#111',
              padding: '30px',
              borderRadius: '12px',
              border: '1px solid #DAA520',
              width: '100%',
              maxWidth: '500px',
              boxShadow: '0 0 30px rgba(218,165,32,0.3)',
              boxSizing: 'border-box',
            }}>
              <h2 style={{ color: '#FFD700', marginBottom: '20px', fontSize: '1.3rem' }}>Registrar RMA / Garantía</h2>
              <form onSubmit={handleCreateRma} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', color: '#DAA520' }}>Código Único (Cotización / Factura Trulink)</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. TRU-COT-2026-001"
                    value={codigoCotizacion}
                    onChange={(e) => setCodigoCotizacion(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#000', border: '1px solid rgba(218,165,32,0.5)', color: '#fff', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', color: '#DAA520' }}>Cliente</label>
                  <input
                    type="text"
                    required
                    placeholder="Nombre del cliente o empresa"
                    value={cliente}
                    onChange={(e) => setCliente(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#000', border: '1px solid rgba(218,165,32,0.5)', color: '#fff', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', color: '#DAA520' }}>Producto / Ítem</label>
                  <input
                    type="text"
                    required
                    placeholder="Descripción del equipo o material"
                    value={producto}
                    onChange={(e) => setProducto(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#000', border: '1px solid rgba(218,165,32,0.5)', color: '#fff', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', color: '#DAA520' }}>Motivo de la Garantía</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Detalle de la falla reportada..."
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#000', border: '1px solid rgba(218,165,32,0.5)', color: '#fff', boxSizing: 'border-box', resize: 'vertical' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', color: '#DAA520' }}>Estado Inicial</label>
                  <select
                    value={estado}
                    onChange={(e) => setEstado(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#000', border: '1px solid rgba(218,165,32,0.5)', color: '#DAA520', boxSizing: 'border-box' }}
                  >
                    <option value="Pendiente">Pendiente</option>
                    <option value="En Revisión">En Revisión</option>
                    <option value="Aprobado">Aprobado</option>
                    <option value="Rechazado">Rechazado</option>
                    <option value="Resuelto">Resuelto</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button
                    type="submit"
                    style={{ flex: 1, padding: '12px', backgroundColor: '#DAA520', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    style={{ flex: 1, padding: '12px', backgroundColor: 'transparent', color: '#DAA520', border: '1px solid #DAA520', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}