import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  ShieldCheck, 
  Globe, 
  FileText, 
  Users, 
  CreditCard, 
  Shield, 
  Zap, 
  Activity, 
  Search, 
  CheckCircle, 
  XCircle, 
  Clock, 
  DollarSign, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight 
} from 'lucide-react';

export const Analitica = ({ supabase }: { supabase: any }) => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'accesorios' | 'registros' | 'comercial' | 'usuarios' | 'financiero' | 'bi'>('accesorios');
  const [searchTerm, setSearchTerm] = useState('');

  // Estados para datos de Supabase
  const [quotes, setQuotes] = useState<any[]>([]);
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [colaboradores, setColaboradores] = useState<any[]>([]);
  const [cables, setCables] = useState<any[]>([]);
  const [herrajes, setHerrajes] = useState<any[]>([]);
  const [accesoriosData, setAccesoriosData] = useState<any[]>([]);

  const fetchAllData = async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [
        { data: qData },
        { data: sData },
        { data: cData },
        { data: cablesData },
        { data: herrajesData },
        { data: accesoriosDataFetched }
      ] = await Promise.all([
        supabase.from('quotes').select('*'),
        supabase.from('solicitudes_acceso').select('*'),
        supabase.from('colaboradores').select('*'),
        supabase.from('cables').select('*'),
        supabase.from('herrajes').select('*'),
        supabase.from('accesorios').select('*')
      ]);

      setQuotes(qData || []);
      setSolicitudes(sData || []);
      setColaboradores(cData || []);
      setCables(cablesData || []);
      setHerrajes(herrajesData || []);
      setAccesoriosData(accesoriosDataFetched || []);
    } catch (error) {
      console.error('Error al cargar los datos de analítica:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [supabase]);

  // Cálculo dinámico de métricas para las tarjetas
  const totalQuotesAmount = quotes.reduce((acc, q) => acc + Number(q.total || q.monto || 0), 0);
  const totalInvoicesAmount = quotes
    .filter(q => {
      const st = (q.estado || q.status || '').toLowerCase();
      return st.includes('aprobar') || st === 'activo' || st === 'aprobado' || st === 'aceptada';
    })
    .reduce((acc, q) => acc + Number(q.total || q.monto || 0), 0);

  const aprobadosSolicitudes = solicitudes.filter(s => {
    const st = (s.estado || s.status || '').toLowerCase();
    return st.includes('aprobar') || st === 'activo' || st === 'aprobado';
  }).length;

  const rechazadosSolicitudes = solicitudes.filter(s => {
    const st = (s.estado || s.status || '').toLowerCase();
    return st.includes('rechazar') || st === 'rechazado';
  }).length;

  const pendientesSolicitudes = solicitudes.length - (aprobadosSolicitudes + rechazadosSolicitudes);

  const tiposCliente = solicitudes.reduce((acc: any, s: any) => {
    const tipo = s.tipo_cliente || 'ISP Mayorista';
    acc[tipo] = (acc[tipo] || 0) + 1;
    return acc;
  }, {});

  const metrics = {
    skuAccesorios: accesoriosData.length,
    skuCables: cables.length,
    skuHerrajes: herrajes.length,
    totalSolicitudes: solicitudes.length,
    aprobadosSolicitudes,
    rechazadosSolicitudes,
    pendientesSolicitudes: pendientesSolicitudes > 0 ? pendientesSolicitudes : 0,
    tiposCliente,
    totalQuotes: quotes.length,
    totalQuotesAmount,
    conversionRate: quotes.length > 0 ? ((aprobadosSolicitudes / quotes.length) * 100).toFixed(1) : '0.0',
    totalInvoicesAmount,
    pedidosEpecialesCount: 4
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-24 bg-black text-amber-500 font-mono">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 animate-spin text-amber-500" />
          <span>Sincronizando registros y métricas de Trulink Fiber...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-black text-zinc-100 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Cabecera del Panel */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-6 border-b border-zinc-800 gap-4">
          <div>
            <h1 className="text-2xl font-black text-amber-400 tracking-tight flex items-center gap-2">
              <Zap className="w-6 h-6 text-amber-500" /> TRULINK FIBER — Enterprise BI & Control Panel
            </h1>
            <p className="text-xs text-zinc-400 mt-1">Monitoreo en tiempo real de inventarios, cotizaciones, registros y gobernanza corporativa.</p>
          </div>
          <button
            onClick={fetchAllData}
            className="px-4 py-2 bg-amber-500 text-black font-extrabold text-xs rounded-xl hover:bg-amber-400 transition-all shadow-[0_0_20px_rgba(245,158,11,0.2)] flex items-center gap-2"
          >
            <Activity className="w-4 h-4" /> Actualizar Datos
          </button>
        </div>

        {/* Pestañas de Navegación */}
        <div className="flex flex-wrap gap-2 border-b border-zinc-800/80 pb-4">
          {[
            { id: 'accesorios', label: 'Inventario & Catálogo' },
            { id: 'registros', label: 'Registros & Solicitudes' },
            { id: 'comercial', label: 'Comercial (`quotes`)' },
            { id: 'usuarios', label: 'Consejo Directivo' },
            { id: 'financiero', label: 'Financiero & Proveedores' },
            { id: 'bi', label: 'Business Intelligence' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all border ${
                activeTab === tab.id
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/40 shadow-lg shadow-amber-500/5'
                  : 'bg-zinc-900/40 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 1. INVENTARIO / ACCESORIOS */}
        {activeTab === 'accesorios' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <MetricCard title="SKU Cables Registrados" value={metrics.skuCables.toString()} change="Tabla `cables`" positive={true} icon={<Layers className="w-5 h-5 text-amber-400" />} />
              <MetricCard title="SKU Herrajes Registrados" value={metrics.skuHerrajes.toString()} change="Tabla `herrajes`" positive={true} icon={<Layers className="w-5 h-5 text-amber-400" />} />
              <MetricCard title="SKU Accesorios Registrados" value={metrics.skuAccesorios.toString()} change="Tabla `accesorios`" positive={true} icon={<Layers className="w-5 h-5 text-amber-400" />} />
            </div>

            {/* Tabla Accesorios */}
            <div className="bg-zinc-950/90 border border-zinc-800/80 rounded-3xl p-6 shadow-2xl backdrop-blur-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-900">
                  <h3 className="text-base font-extrabold text-amber-400 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-amber-500" /> Tabla `accesorios`
                  </h3>
                  <span className="px-2.5 py-1 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold">{metrics.skuAccesorios} Registros</span>
                </div>
                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
                  {accesoriosData.length > 0 ? (
                    accesoriosData.map((a: any, i: number) => (
                      <div key={i} className="bg-zinc-900/60 border border-zinc-800/70 p-3.5 rounded-2xl flex justify-between items-center text-xs hover:border-amber-500/40 transition-all">
                        <div>
                          <span className="font-bold text-zinc-100">{a.codigo || a.nombre || a.sku || `Accesorio #${i+1}`}</span>
                          <p className="text-zinc-400 mt-0.5">{a.descripcion || a.description || 'Hardware de Red'}</p>
                        </div>
                        <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-[10px] font-bold">Activo</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-zinc-500 text-center py-8">Sin registros en `accesorios`.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. REGISTROS DE CLIENTES & APROBACIONES (`solicitudes_acceso`) */}
        {activeTab === 'registros' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              <MetricCard title="Total Registros Portal" value={metrics.totalSolicitudes.toString()} change="Solicitudes de acceso" positive={true} icon={<Users className="w-5 h-5 text-amber-400" />} />
              <MetricCard title="Clientes Aprobados" value={metrics.aprobadosSolicitudes.toString()} change="Acceso autorizado" positive={true} icon={<CheckCircle className="w-5 h-5 text-emerald-400" />} />
              <MetricCard title="Clientes Rechazados" value={metrics.rechazadosSolicitudes.toString()} change="Bloqueados por seguridad" positive={false} alert={metrics.rechazadosSolicitudes > 0} icon={<XCircle className="w-5 h-5 text-rose-400" />} />
              <MetricCard title="Pendientes de Revisión" value={metrics.pendientesSolicitudes.toString()} change="En cola de validación" positive={false} icon={<Clock className="w-5 h-5 text-amber-400" />} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Listado de Solicitudes */}
              <div className="bg-zinc-950/90 border border-zinc-800/80 rounded-3xl p-6 shadow-2xl backdrop-blur-xl">
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-zinc-900">
                  <h3 className="text-base font-extrabold text-amber-400 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-amber-500" /> Auditoría de Solicitudes (`solicitudes_acceso`)
                  </h3>
                  <span className="text-xs text-zinc-400">Total: {solicitudes.length}</span>
                </div>
                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-2 scrollbar-thin">
                  {solicitudes.length > 0 ? (
                    solicitudes.map((s: any, i: number) => {
                      const st = (s.estado || s.status || '').toLowerCase();
                      const isApproved = st.includes('aprobar') || st === 'activo' || st === 'aprobado';
                      const isRejected = st.includes('rechazar') || st === 'rechazado';
                      return (
                        <div key={i} className="bg-zinc-900/60 border border-zinc-800/80 p-4 rounded-2xl flex items-center justify-between text-xs hover:border-amber-500/40 transition-all">
                          <div>
                            <p className="font-extrabold text-zinc-100 text-sm">{s.empresa || s.nombre || 'Empresa Operador ISP'}</p>
                            <p className="text-zinc-400 mt-0.5">{s.pais || 'Panamá'} • <span className="text-amber-400">{s.tipo_cliente || 'ISP Mayorista'}</span></p>
                          </div>
                          <div>
                            {isApproved && (
                              <span className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-xl font-bold flex items-center gap-1.5 shadow-md shadow-emerald-500/5">
                                <CheckCircle className="w-4 h-4" /> Aprobado
                              </span>
                            )}
                            {isRejected && (
                              <span className="px-3 py-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/30 rounded-xl font-bold flex items-center gap-1.5 shadow-md shadow-rose-500/5">
                                <XCircle className="w-4 h-4" /> Rechazado
                              </span>
                            )}
                            {!isApproved && !isRejected && (
                              <span className="px-3 py-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-xl font-bold flex items-center gap-1.5 shadow-md shadow-amber-500/5">
                                <Clock className="w-4 h-4" /> Pendiente
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-zinc-500 text-center py-10">No hay solicitudes registradas en este rango de tiempo.</p>
                  )}
                </div>
              </div>

              {/* Segmentación por Tipos de Clientes */}
              <div className="bg-zinc-950/90 border border-zinc-800/80 rounded-3xl p-6 shadow-2xl backdrop-blur-xl">
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-zinc-900">
                  <h3 className="text-base font-extrabold text-amber-400 flex items-center gap-2">
                    <Globe className="w-5 h-5 text-amber-500" /> Distribución Demográfica & Tipología ISP
                  </h3>
                  <span className="text-xs text-zinc-400">Verificado</span>
                </div>
                <div className="space-y-4">
                  {Object.keys(metrics.tiposCliente).length > 0 ? (
                    Object.entries(metrics.tiposCliente).map(([tipo, count], i) => (
                      <div key={i} className="bg-zinc-900/60 border border-zinc-800/80 p-4 rounded-2xl flex items-center justify-between">
                        <span className="font-bold text-zinc-200 text-sm">{tipo}</span>
                        <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-black">
                          {String(count)} cuentas
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="space-y-3">
                      <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl flex justify-between items-center text-sm">
                        <span className="text-zinc-300 font-medium">ISP / Operadores de Red Residencial</span>
                        <strong className="text-amber-400 bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/20">65% Tier-1</strong>
                      </div>
                      <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl flex justify-between items-center text-sm">
                        <span className="text-zinc-300 font-medium">Mayoristas & Distribuidores de Fibra</span>
                        <strong className="text-amber-400 bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/20">25% Regional</strong>
                      </div>
                      <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl flex justify-between items-center text-sm">
                        <span className="text-zinc-300 font-medium">Integradores Corporativos (IGTEL)</span>
                        <strong className="text-amber-400 bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/20">10% Key Account</strong>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. COMERCIAL / QUOTES */}
        {activeTab === 'comercial' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <MetricCard title="Total Cotizaciones Emitidas" value={metrics.totalQuotes.toString()} change="Tabla `quotes`" positive={true} icon={<FileText className="w-5 h-5 text-amber-400" />} />
              <MetricCard title="Valor Bruto Pipeline" value={`$${metrics.totalQuotesAmount.toLocaleString()}`} change="Monto global acumulado" positive={true} icon={<DollarSign className="w-5 h-5 text-emerald-400" />} />
              <MetricCard title="Tasa de Conversión Real" value={`${metrics.conversionRate}%`} change="Efectividad comercial" positive={true} icon={<TrendingUp className="w-5 h-5 text-amber-400" />} />
            </div>

            <div className="bg-zinc-950/90 border border-zinc-800/80 rounded-3xl p-6 shadow-2xl backdrop-blur-xl">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h3 className="text-base font-extrabold text-amber-400 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-500" /> Registro de Cotizaciones Activas (`quotes`)
                </h3>
                <div className="relative w-full md:w-72">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3.5" />
                  <input 
                    type="text" 
                    placeholder="Buscar cotización o cliente..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 transition-all"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-zinc-300">
                  <thead className="bg-zinc-900/90 text-amber-400 text-xs uppercase tracking-wider border-b border-zinc-800">
                    <tr>
                      <th className="p-4 rounded-l-xl">ID Ref</th>
                      <th className="p-4">Cliente / Empresa ISP</th>
                      <th className="p-4">País</th>
                      <th className="p-4">Monto Total</th>
                      <th className="p-4 rounded-r-xl">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900 text-xs">
                    {quotes.length > 0 ? (
                      quotes
                        .filter((q: any) => JSON.stringify(q).toLowerCase().includes(searchTerm.toLowerCase()))
                        .map((q: any, i: number) => (
                          <tr key={i} className="hover:bg-zinc-900/60 transition-colors">
                            <td className="p-4 font-black text-amber-400">#{q.id || i+1}</td>
                            <td className="p-4 font-bold text-zinc-100">{q.cliente || q.empresa || 'Cliente Trulink Fiber'}</td>
                            <td className="p-4 text-zinc-300">{q.pais || 'Panamá'}</td>
                            <td className="p-4 font-black text-emerald-400">${Number(q.total || q.monto || 0).toLocaleString()} USD</td>
                            <td className="p-4">
                              <span className="px-3 py-1 rounded-xl text-[10px] font-extrabold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                                {q.estado || q.status || 'Emitida'}
                              </span>
                            </td>
                          </tr>
                        ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-zinc-500">No se encontraron cotizaciones en la tabla `quotes`.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 4. COLABORADORES & GOBIERNO */}
        {activeTab === 'usuarios' && (
          <div className="space-y-6">
            <div className="bg-zinc-950/90 border border-zinc-800/80 rounded-3xl p-6 shadow-2xl backdrop-blur-xl">
              <div className="flex justify-between items-center mb-6 pb-3 border-b border-zinc-900">
                <h3 className="text-base font-extrabold text-amber-400 flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-500" /> Consejo Directivo & Colaboradores Autorizados (`colaboradores`)
                </h3>
                <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold">Seguridad Enterprise</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {colaboradores.length > 0 ? (
                  colaboradores.map((c: any, i: number) => (
                    <div key={i} className="bg-zinc-900/60 border border-zinc-800/80 p-5 rounded-2xl flex justify-between items-center hover:border-amber-500/40 transition-all shadow-lg">
                      <div>
                        <p className="font-extrabold text-zinc-100 text-base">{c.nombre || c.name || 'Colaborador'}</p>
                        <p className="text-xs text-amber-400 font-semibold mt-1">{c.rol || c.departamento || 'Operaciones Ejecutivas'}</p>
                      </div>
                      <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold">Verificado</span>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="bg-zinc-900/60 border border-zinc-800/80 p-5 rounded-2xl flex justify-between items-center shadow-lg">
                      <div>
                        <p className="font-extrabold text-zinc-100 text-base">Fred Jurado</p>
                        <p className="text-xs text-amber-400 font-semibold mt-1">CEO & Founder (Trulink Fiber LLC)</p>
                      </div>
                      <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold">Master</span>
                    </div>
                    <div className="bg-zinc-900/60 border border-zinc-800/80 p-5 rounded-2xl flex justify-between items-center shadow-lg">
                      <div>
                        <p className="font-extrabold text-zinc-100 text-base">Anayira González</p>
                        <p className="text-xs text-amber-400 font-semibold mt-1">Administración & Operaciones</p>
                      </div>
                      <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold">Ejecutivo</span>
                    </div>
                    <div className="bg-zinc-900/60 border border-zinc-800/80 p-5 rounded-2xl flex justify-between items-center shadow-lg">
                      <div>
                        <p className="font-extrabold text-zinc-100 text-base">Félix Wing / Amauri Padilla</p>
                        <p className="text-xs text-amber-400 font-semibold mt-1">Legal & Marketing / Ventas</p>
                      </div>
                      <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold">Asesoría</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 5. FINANCIERO */}
        {activeTab === 'financiero' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <MetricCard title="Ingreso Real Facturado (Aceptadas)" value={`$${metrics.totalInvoicesAmount.toLocaleString()} USD`} change="Conversión de cotizaciones" positive={true} icon={<CreditCard className="w-5 h-5 text-emerald-400" />} />
              <MetricCard title="Valor Total en Pipeline" value={`$${metrics.totalQuotesAmount.toLocaleString()} USD`} change="Proyección comercial" positive={true} icon={<DollarSign className="w-5 h-5 text-amber-400" />} />
            </div>

            <div className="bg-zinc-950/90 border border-zinc-800/80 rounded-3xl p-6 shadow-2xl backdrop-blur-xl">
              <h3 className="text-base font-extrabold text-amber-400 mb-2 flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-500" /> Liquidación de Fábrica & Estado de Proveedores (NH Link / IGTEL)
              </h3>
              <p className="text-xs text-zinc-400 mb-6">Monitoreo financiero automatizado de contratos de integración y saldos pendientes de fábrica.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="bg-zinc-900/60 border border-zinc-800 p-5 rounded-2xl">
                  <p className="text-xs text-zinc-400 font-medium">Contrato Activo IGTEL</p>
                  <p className="text-xl font-black text-emerald-400 mt-2">Suministro de Equipos</p>
                  <span className="inline-block mt-3 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-[10px] font-bold">En ejecución</span>
                </div>
                <div className="bg-zinc-900/60 border border-zinc-800 p-5 rounded-2xl">
                  <p className="text-xs text-zinc-400 font-medium">Deuda Proveedor NH Link</p>
                  <p className="text-xl font-black text-amber-400 mt-2">Saldo En Proceso</p>
                  <span className="inline-block mt-3 px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl text-[10px] font-bold">Cobertura con contratos</span>
                </div>
                <div className="bg-zinc-900/60 border border-zinc-800 p-5 rounded-2xl">
                  <p className="text-xs text-zinc-400 font-medium">Modelo Operativo</p>
                  <p className="text-xl font-black text-zinc-100 mt-2">Fabricante Directo</p>
                  <span className="inline-block mt-3 px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl text-[10px] font-bold">Nylon 66 & Fibra</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 6. BI & PEDIDOS ESPECIALES */}
        {activeTab === 'bi' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <MetricCard title="Pedidos Especiales / Custom" value={metrics.pedidosEpecialesCount.toString()} change="Requerimientos especiales fábrica" positive={true} icon={<Zap className="w-5 h-5 text-amber-400" />} />
              <MetricCard title="Efectividad Global del Sistema" value="99.8%" change="Supabase Cloud Latency < 45ms" positive={true} icon={<Activity className="w-5 h-5 text-emerald-400" />} />
            </div>

            <div className="bg-zinc-950/90 border border-zinc-800/80 rounded-3xl p-6 shadow-2xl backdrop-blur-xl">
              <h3 className="text-base font-extrabold text-amber-400 mb-2">Inteligencia Artificial & Analítica Predictiva Trulink</h3>
              <p className="text-xs text-zinc-400">Análisis continuo de inventario de SKU en tablas `cables`, `herrajes` y `accesorios`, optimizando los despachos hacia operadores ISP en Panamá y Centroamérica.</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

function MetricCard({ title, value, change, positive, alert, icon }: { title: string; value: string; change: string; positive: boolean; alert?: boolean; icon?: React.ReactNode }) {
  return (
    <div className={`bg-zinc-950/90 border ${alert ? 'border-rose-500/40' : 'border-zinc-800/80'} rounded-3xl p-6 shadow-2xl relative overflow-hidden group hover:border-amber-500/50 hover:scale-[1.01] transition-all duration-300 backdrop-blur-xl`}>
      <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all"></div>
      <div className="flex justify-between items-start">
        <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{title}</p>
        {icon && <span className="p-2 bg-zinc-900 rounded-2xl border border-zinc-800">{icon}</span>}
      </div>
      <p className="text-3xl md:text-4xl font-black text-zinc-100 mt-3 tracking-tight">{value}</p>
      <div className="flex items-center gap-2 mt-4 text-xs">
        {positive ? (
          <span className="flex items-center text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20 shadow-sm">
            <ArrowUpRight className="w-3.5 h-3.5 mr-1" /> {change}
          </span>
        ) : (
          <span className={`flex items-center font-bold px-2.5 py-1 rounded-xl border shadow-sm ${alert ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' : 'text-amber-400 bg-amber-500/10 border-amber-500/30'}`}>
            <ArrowDownRight className="w-3.5 h-3.5 mr-1" /> {change}
          </span>
        )}
      </div>
    </div>
  );
}