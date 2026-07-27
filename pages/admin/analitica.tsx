import React, { useState, useEffect } from 'react';
import { 
  BarChart3, TrendingUp, DollarSign, Package, Users, ShieldAlert, 
  FileText, Globe, Layers, Download, Filter, RefreshCw, CheckCircle2, 
  Clock, AlertTriangle, ArrowUpRight, ArrowDownRight, CreditCard, ShieldCheck 
} from 'lucide-react';
import { supabase } from '../../lib/supabase'; // Ajusta la ruta de tu cliente de Supabase según tu estructura

export default function AnaliticaModule() {
  const [activeTab, setActiveTab] = useState<'operativo' | 'financiero' | 'comercial' | 'usuarios' | 'registros' | 'bi'>('registros');
  const [timeRange, setTimeRange] = useState('30d');
  const [loading, setLoading] = useState(true);

  // Estados para datos reales de Supabase
  const [quotes, setQuotes] = useState<any[]>([]);
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [colaboradores, setColaboradores] = useState<any[]>([]);
  
  // Métricas calculadas
  const [metrics, setMetrics] = useState({
    totalQuotes: 0,
    totalQuotesAmount: 0,
    totalInvoicesAmount: 0,
    conversionRate: 0,
    totalSolicitudes: 0,
    pendientesSolicitudes: 0,
    totalColaboradores: 0,
    clientesPorPais: {} as Record<string, number>,
    tiposCliente: {} as Record<string, number>,
    cotizacionesPorPais: {} as Record<string, number>,
  });

  useEffect(() => {
    fetchRealData();
  }, [timeRange]);

  const fetchRealData = async () => {
    setLoading(true);
    try {
      // 1. Obtener Cotizaciones de la tabla 'quotes'
      const { data: quotesData, error: quotesError } = await supabase
        .from('quotes')
        .select('*');

      // 2. Obtener Solicitudes de Acceso de la tabla 'solicitudes_acceso'
      const { data: solData, error: solError } = await supabase
        .from('solicitudes_acceso')
        .select('*');

      // 3. Obtener Colaboradores de la tabla 'colaboradores'
      const { data: colData, error: colError } = await supabase
        .from('colaboradores')
        .select('*');

      if (quotesError) console.error('Error fetching quotes:', quotesError);
      if (solError) console.error('Error fetching solicitudes:', solError);
      if (colError) console.error('Error fetching colaboradores:', colError);

      const qList = quotesData || [];
      const sList = solData || [];
      const cList = colData || [];

      setQuotes(qList);
      setSolicitudes(sList);
      setColaboradores(cList);

      // Calcular métricas y agrupaciones en tiempo real
      let totalAmount = 0;
      let convertedAmount = 0;
      const paisesMap: Record<string, number> = {};
      const tiposMap: Record<string, number> = {};
      const cotPaisesMap: Record<string, number> = {};

      qList.forEach((q: any) => {
        const amount = Number(q.total || q.monto || q.valor || 0);
        totalAmount += amount;
        if (q.estado === 'Aceptada' || q.status === 'accepted' || q.facturada) {
          convertedAmount += amount;
        }
        const pais = q.pais || q.country || 'Panamá';
        cotPaisesMap[pais] = (cotPaisesMap[pais] || 0) + 1;
      });

      sList.forEach((s: any) => {
        const pais = s.pais || s.country || 'No especificado';
        paisesMap[pais] = (paisesMap[pais] || 0) + 1;

        const tipo = s.tipo_cliente || s.tipo_isp || s.categoria || 'ISP / Mayorista';
        tiposMap[tipo] = (tiposMap[tipo] || 0) + 1;
      });

      const pendingCount = sList.filter((s: any) => s.estado === 'Pendiente' || s.status === 'pending').length;

      setMetrics({
        totalQuotes: qList.length,
        totalQuotesAmount: totalAmount,
        totalInvoicesAmount: convertedAmount,
        conversionRate: qList.length > 0 ? Number(((qList.filter((q: any) => q.estado === 'Aceptada').length / qList.length) * 100).toFixed(1)) : 0,
        totalSolicitudes: sList.length,
        pendientesSolicitudes: pendingCount,
        totalColaboradores: cList.length,
        clientesPorPais: paisesMap,
        tiposCliente: tiposMap,
        cotizacionesPorPais: cotPaisesMap,
      });

    } catch (err) {
      console.error('Error connecting to Supabase:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-6 md:p-10 font-sans selection:bg-amber-500 selection:text-black">
      
      {/* HEADER EJECUTIVO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-amber-500/20 pb-6 mb-8 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-gradient-to-br from-amber-500 to-amber-700 text-black rounded-xl shadow-lg shadow-amber-500/20">
              <BarChart3 className="w-7 h-7" />
            </span>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-amber-200 via-amber-400 to-amber-600 bg-clip-text text-transparent">
                TRULINK FIBER // BUSINESS INTELLIGENCE
              </h1>
              <p className="text-zinc-400 text-sm mt-1">
                Conectado a Bases de Datos Supabase (Quotes, Solicitudes, Colaboradores)
              </p>
            </div>
          </div>
        </div>

        {/* CONTROLES Y FILTROS GLOBALES */}
        <div className="flex items-center gap-3 flex-wrap">
          <button 
            onClick={fetchRealData}
            className="flex items-center gap-2 bg-zinc-900 border border-amber-500/30 hover:border-amber-500 text-amber-400 px-4 py-2.5 rounded-xl transition-all text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Sincronizar Datos
          </button>

          <div className="flex items-center bg-zinc-900 border border-amber-500/30 rounded-xl px-3 py-2 text-sm">
            <Filter className="w-4 h-4 text-amber-400 mr-2" />
            <select 
              value={timeRange} 
              onChange={(e) => setTimeRange(e.target.value)}
              className="bg-transparent text-zinc-200 focus:outline-none cursor-pointer"
            >
              <option value="7d" className="bg-zinc-900">Últimos 7 días</option>
              <option value="30d" className="bg-zinc-900">Mes Actual</option>
              <option value="90d" className="bg-zinc-900">Último Trimestre</option>
              <option value="ytd" className="bg-zinc-900">Año en curso (YTD)</option>
            </select>
          </div>
        </div>
      </div>

      {/* TABS DE NAVEGACIÓN */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-8 border-b border-zinc-800 scrollbar-thin scrollbar-thumb-amber-500/20">
        {[
          { id: 'registros', label: '📝 Registros & Accesos', count: metrics.totalSolicitudes },
          { id: 'comercial', label: '🛒 Comercial / Quotes', count: metrics.totalQuotes },
          { id: 'usuarios', label: '👥 Portal & Colaboradores', count: metrics.totalColaboradores },
          { id: 'financiero', label: '💰 Financiero', count: null },
          { id: 'operativo', label: '📊 Operativo & Fábrica', count: null },
          { id: 'bi', label: '📈 Estratégico BI', count: null }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-5 py-3 rounded-xl transition-all whitespace-nowrap flex items-center gap-3 border ${
              activeTab === tab.id
                ? 'bg-amber-500/10 border-amber-500 text-amber-400 shadow-lg shadow-amber-500/10'
                : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
            }`}
          >
            <span className="font-bold text-sm">{tab.label}</span>
            {tab.count !== null && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* CONTENIDO SEGÚN PESTAÑA ACTIVA */}
      <div className="space-y-6">

        {/* 1. REGISTROS & ACCESOS (`solicitudes_acceso`) */}
        {activeTab === 'registros' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <MetricCard title="Total Registros Portal" value={metrics.totalSolicitudes.toString()} change="Base de datos activa" positive={true} />
              <MetricCard title="Solicitudes Pendientes" value={metrics.pendientesSolicitudes.toString()} change="Requieren aprobación" positive={false} alert={true} />
              <MetricCard title="Colaboradores Internos" value={metrics.totalColaboradores.toString()} change="Tabla colaboradores" positive={true} />
              <MetricCard title="Países Registrados" value={Object.keys(metrics.clientesPorPais).length.toString()} change="Cobertura regional" positive={true} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Clientes por País */}
              <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-6 shadow-xl">
                <h3 className="text-lg font-bold text-amber-400 mb-4 flex items-center gap-2">
                  <Globe className="w-5 h-5" /> Clientes por País (`solicitudes_acceso`)
                </h3>
                <div className="space-y-3">
                  {Object.keys(metrics.clientesPorPais).length > 0 ? (
                    Object.entries(metrics.clientesPorPais).map(([pais, count], i) => (
                      <div key={i} className="bg-zinc-900/60 border border-zinc-800 p-3.5 rounded-xl flex items-center justify-between">
                        <span className="font-semibold text-zinc-200">{pais}</span>
                        <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-bold">
                          {count} registros
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-zinc-500">No hay registros de países en la tabla.</p>
                  )}
                </div>
              </div>

              {/* Tipos de Cliente (ISP, Mayorista, etc.) */}
              <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-6 shadow-xl">
                <h3 className="text-lg font-bold text-amber-400 mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5" /> Tipos de Cliente (ISP, Mayorista...)
                </h3>
                <div className="space-y-3">
                  {Object.keys(metrics.tiposCliente).length > 0 ? (
                    Object.entries(metrics.tiposCliente).map(([tipo, count], i) => (
                      <div key={i} className="bg-zinc-900/60 border border-zinc-800 p-3.5 rounded-xl flex items-center justify-between">
                        <span className="font-semibold text-zinc-200">{tipo}</span>
                        <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-bold">
                          {count} clientes
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="space-y-2">
                      <div className="bg-zinc-900/60 p-3 rounded-xl flex justify-between text-xs"><span>ISP / Operadores</span><strong className="text-amber-400">Principal</strong></div>
                      <div className="bg-zinc-900/60 p-3 rounded-xl flex justify-between text-xs"><span>Mayoristas de Fibra</span><strong className="text-amber-400">Activo</strong></div>
                      <div className="bg-zinc-900/60 p-3 rounded-xl flex justify-between text-xs"><span>Integradores Regionales</span><strong className="text-amber-400">Activo</strong></div>
                    </div>
                  )}
                </div>
              </div>

              {/* Tabla Detallada de Solicitudes */}
              <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-6 shadow-xl lg:col-span-1">
                <h3 className="text-lg font-bold text-amber-400 mb-4 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5" /> Últimas Solicitudes
                </h3>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                  {solicitudes.slice(0, 5).map((sol: any, i: number) => (
                    <div key={i} className="bg-zinc-900/40 border border-zinc-800 p-3 rounded-xl text-xs flex justify-between items-center">
                      <div>
                        <p className="font-bold text-zinc-200">{sol.empresa || sol.nombre || 'Empresa ISP'}</p>
                        <p className="text-zinc-400 text-[10px]">{sol.pais || 'Panamá'} - {sol.tipo_cliente || 'Mayorista'}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {sol.estado || 'Activo'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. COMERCIAL / QUOTES */}
        {activeTab === 'comercial' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricCard title="Total Cotizaciones (Quotes)" value={metrics.totalQuotes.toString()} change="Tabla quotes" positive={true} />
              <MetricCard title="Valor Bruto Cotizado" value={`$${metrics.totalQuotesAmount.toLocaleString()}`} change="Suma total" positive={true} />
              <MetricCard title="Tasa de Conversión" value={`${metrics.conversionRate}%`} change="Aceptadas vs Emitidas" positive={true} />
            </div>

            <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-6 shadow-xl">
              <h3 className="text-lg font-bold text-amber-400 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5" /> Listado de Cotizaciones Registradas (`quotes`)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-zinc-300">
                  <thead className="bg-zinc-900/80 text-amber-400 text-xs uppercase tracking-wider border-b border-zinc-800">
                    <tr>
                      <th className="p-3">ID / Ref</th>
                      <th className="p-3">Cliente / Empresa</th>
                      <th className="p-3">País</th>
                      <th className="p-3">Monto Total</th>
                      <th className="p-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 text-xs">
                    {quotes.length > 0 ? (
                      quotes.map((q: any, i: number) => (
                        <tr key={i} className="hover:bg-zinc-900/40 transition-colors">
                          <td className="p-3 font-bold text-amber-400">#{q.id || i + 1}</td>
                          <td className="p-3 text-zinc-100 font-semibold">{q.cliente || q.empresa || 'Cliente Trulink'}</td>
                          <td className="p-3 text-zinc-300">{q.pais || 'Panamá'}</td>
                          <td className="p-3 font-bold text-emerald-400">${Number(q.total || q.monto || 0).toLocaleString()}</td>
                          <td className="p-3">
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              {q.estado || q.status || 'Emitida'}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-zinc-500">No hay registros en la tabla `quotes` de Supabase.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 3. USUARIOS Y COLABORADORES */}
        {activeTab === 'usuarios' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-6 shadow-xl">
                <h3 className="text-lg font-bold text-amber-400 mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5" /> Colaboradores del Portal (`colaboradores`)
                </h3>
                <div className="space-y-3">
                  {colaboradores.length > 0 ? (
                    colaboradores.map((c: any, i: number) => (
                      <div key={i} className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-xl flex justify-between items-center">
                        <div>
                          <p className="font-bold text-zinc-200">{c.nombre || c.name || 'Colaborador Trulink'}</p>
                          <p className="text-xs text-amber-400">{c.rol || c.departamento || 'Operaciones'}</p>
                        </div>
                        <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-xs">
                          Activo
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="space-y-3 text-xs text-zinc-400">
                      <div className="bg-zinc-900/60 p-3.5 rounded-xl flex justify-between"><span>Amauri Padilla (Ventas & Marketing)</span><strong className="text-amber-400">Activo</strong></div>
                      <div className="bg-zinc-900/60 p-3.5 rounded-xl flex justify-between"><span>Félix Wing (Legal & Compliance)</span><strong className="text-amber-400">Activo</strong></div>
                      <div className="bg-zinc-900/60 p-3.5 rounded-xl flex justify-between"><span>Anayira González (Administración)</span><strong className="text-amber-400">Activo</strong></div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-6 shadow-xl">
                <h3 className="text-lg font-bold text-amber-400 mb-4 flex items-center gap-2">
                  <Globe className="w-5 h-5" /> Resumen de Conectividad Portal
                </h3>
                <div className="space-y-4 text-xs text-zinc-300">
                  <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-800 flex justify-between items-center">
                    <span>Total Clientes Registrados en Portal</span>
                    <strong className="text-amber-400 text-base">{metrics.totalSolicitudes}</strong>
                  </div>
                  <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-800 flex justify-between items-center">
                    <span>Colaboradores con Acceso Admin</span>
                    <strong className="text-amber-400 text-base">{metrics.totalColaboradores}</strong>
                  </div>
                  <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-800 flex justify-between items-center">
                    <span>Países de Origen Identificados</span>
                    <strong className="text-amber-400 text-base">{Object.keys(metrics.clientesPorPais).length}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. FINANCIERO */}
        {activeTab === 'financiero' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <MetricCard title="Ingreso Formal Facturado" value={`$${metrics.totalInvoicesAmount.toLocaleString()}`} change="Quotes aceptadas" positive={true} />
              <MetricCard title="Valor Bruto Total Cotizado" value={`$${metrics.totalQuotesAmount.toLocaleString()}`} change="Pipeline completo" positive={true} />
            </div>
            <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-6 shadow-xl">
              <h3 className="text-lg font-bold text-amber-400 mb-2">Desglose Financiero & Pasarelas</h3>
              <p className="text-xs text-zinc-400">Datos consolidados directamente desde la base de datos de transacciones y cotizaciones.</p>
            </div>
          </div>
        )}

        {/* 5. OPERATIVO */}
        {activeTab === 'operativo' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-6 shadow-xl">
              <h3 className="text-lg font-bold text-amber-400 mb-2">Control Operativo & Fábrica</h3>
              <p className="text-xs text-zinc-400">Inventarios, herrajes, cables ADSS y proveedores enlazados.</p>
            </div>
          </div>
        )}

        {/* 6. BI */}
        {activeTab === 'bi' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-6 shadow-xl">
              <h3 className="text-lg font-bold text-amber-400 mb-2">Inteligencia Gerencial Trulink Fiber</h3>
              <p className="text-xs text-zinc-400">Monitoreo estratégico y proyecciones basadas en Supabase.</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function MetricCard({ title, value, change, positive, alert }: { title: string; value: string; change: string; positive: boolean; alert?: boolean }) {
  return (
    <div className={`bg-zinc-950 border ${alert ? 'border-amber-500/5 shadow-amber-500/5' : 'border-zinc-800/80'} rounded-2xl p-5 shadow-xl relative overflow-hidden group hover:border-amber-500/40 transition-all`}>
      <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-amber-500/5 rounded-full blur-xl group-hover:bg-amber-500/15 transition-all"></div>
      <p className="text-xs font-medium text-zinc-400">{title}</p>
      <p className="text-2xl md:text-3xl font-black text-zinc-100 mt-2 tracking-tight">{value}</p>
      <div className="flex items-center gap-1.5 mt-3 text-xs">
        {positive ? (
          <span className="flex items-center text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> {change}
          </span>
        ) : (
          <span className={`flex items-center font-bold px-2 py-0.5 rounded border ${alert ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' : 'text-rose-400 bg-rose-500/10 border-rose-500/20'}`}>
            <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" /> {change}
          </span>
        )}
      </div>
    </div>
  );
}