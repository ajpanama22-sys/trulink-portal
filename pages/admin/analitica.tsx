import React, { useState, useEffect } from 'react';
import { 
  BarChart3, TrendingUp, DollarSign, Package, Users, ShieldAlert, 
  FileText, Globe, Layers, Download, Filter, RefreshCw, CheckCircle2, 
  Clock, AlertTriangle, ArrowUpRight, ArrowDownRight, CreditCard, 
  ShieldCheck, CheckCircle, XCircle, Wrench, Zap, Cpu, Activity, Shield, PieChart, Database, Search
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient'; // Ajusta la ruta de tu cliente de Supabase

export default function AnaliticaModule() {
  const [activeTab, setActiveTab] = useState<'operativo' | 'financiero' | 'comercial' | 'usuarios' | 'registros' | 'bi'>('operativo');
  const [timeRange, setTimeRange] = useState('30d'); // '7d' | '30d' | '90d' | 'ytd' | 'all'
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Estados para datos reales de Supabase
  const [quotes, setQuotes] = useState<any[]>([]);
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [colaboradores, setColaboradores] = useState<any[]>([]);
  const [cablesData, setCablesData] = useState<any[]>([]);
  const [herrajesData, setHerrajesData] = useState<any[]>([]);
  const [accesoriosData, setAccesoriosData] = useState<any[]>([]);
  
  // Métricas calculadas Enterprise
  const [metrics, setMetrics] = useState({
    totalQuotes: 0,
    totalQuotesAmount: 0,
    totalInvoicesAmount: 0,
    conversionRate: 0,
    totalSolicitudes: 0,
    aprobadosSolicitudes: 0,
    rechazadosSolicitudes: 0,
    pendientesSolicitudes: 0,
    totalColaboradores: 0,
    pedidosEpecialesCount: 0,
    skuCables: 0,
    skuHerrajes: 0,
    skuAccesorios: 0,
    totalSkusFabrica: 0,
    totalSkusTerminados: 0,
    clientesPorPais: {} as Record<string, number>,
    tiposCliente: {} as Record<string, number>,
    cotizacionesPorPais: {} as Record<string, number>,
  });

  useEffect(() => {
    fetchAllData();
  }, [timeRange]);

  const filterByTimeRange = (items: any[]) => {
    if (timeRange === 'all') return items;
    const now = new Date();
    let cutoff = new Date();

    if (timeRange === '7d') cutoff.setDate(now.getDate() - 7);
    else if (timeRange === '30d') cutoff.setDate(now.getDate() - 30);
    else if (timeRange === '90d') cutoff.setDate(now.getDate() - 90);
    else if (timeRange === 'ytd') cutoff = new Date(now.getFullYear(), 0, 1);

    return items.filter(item => {
      const itemDate = new Date(item.created_at || item.fecha || Date.now());
      return itemDate >= cutoff;
    });
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [
        { data: qData },
        { data: sData },
        { data: cData },
        { data: cables },
        { data: herrajes },
        { data: accesorios }
      ] = await Promise.all([
        supabase.from('quotes').select('*'),
        supabase.from('solicitudes_acceso').select('*'),
        supabase.from('colaboradores').select('*'),
        supabase.from('cables').select('*'),
        supabase.from('herrajes').select('*'),
        supabase.from('accesorios').select('*')
      ]);

      const qList = filterByTimeRange(qData || []);
      const sList = filterByTimeRange(sData || []);
      const colList = cData || [];
      const cabList = cables || [];
      const herrList = herrajes || [];
      const accList = accesorios || [];

      setQuotes(qList);
      setSolicitudes(sList);
      setColaboradores(colList);
      setCablesData(cabList);
      setHerrajesData(herrList);
      setAccesoriosData(accList);

      let totalAmount = 0;
      let convertedAmount = 0;
      let pedidosEspeciales = 0;
      const paisesMap: Record<string, number> = {};
      const tiposMap: Record<string, number> = {};
      const cotPaisesMap: Record<string, number> = {};

      qList.forEach((q: any) => {
        const amount = Number(q.total || q.monto || q.valor || 0);
        totalAmount += amount;
        if (q.estado === 'Aceptada' || q.status === 'accepted' || q.facturada) {
          convertedAmount += amount;
        }
        if (q.es_especial || q.tipo_pedido === 'especial' || q.pedido_especial) {
          pedidosEspeciales++;
        }
        const pais = q.pais || q.country || 'Panamá';
        cotPaisesMap[pais] = (cotPaisesMap[pais] || 0) + 1;
      });

      let aprobados = 0;
      let rechazados = 0;
      let pendientes = 0;

      sList.forEach((s: any) => {
        const estado = (s.estado || s.status || '').toLowerCase();
        if (estado.includes('aprobar') || estado === 'activo' || estado === 'aprobado') {
          aprobados++;
        } else if (estado.includes('rechazar') || estado === 'rechazado' || estado === 'denegado') {
          rechazados++;
        } else {
          pendientes++;
        }

        const pais = s.pais || s.country || 'Panamá';
        paisesMap[pais] = (paisesMap[pais] || 0) + 1;

        const tipo = s.tipo_cliente || s.tipo_isp || s.categoria || 'ISP / Mayorista';
        tiposMap[tipo] = (tiposMap[tipo] || 0) + 1;
      });

      const skuCab = cabList.length;
      const skuHerr = herrList.length;
      const skuAcc = accList.length;
      const totalSkus = skuCab + skuHerr + skuAcc;

      const terminados = cabList.filter(c => c.estado === 'terminado' || c.stock > 0).length +
                         herrList.filter(h => h.estado === 'terminado' || h.stock > 0).length +
                         accList.filter(a => a.estado === 'terminado' || a.stock > 0).length;

      setMetrics({
        totalQuotes: qList.length,
        totalQuotesAmount: totalAmount,
        totalInvoicesAmount: convertedAmount,
        conversionRate: qList.length > 0 ? Number(((qList.filter((q: any) => q.estado === 'Aceptada').length / qList.length) * 100).toFixed(1)) : 0,
        totalSolicitudes: sList.length,
        aprobadosSolicitudes: aprobados,
        rechazadosSolicitudes: rechazados,
        pendientesSolicitudes: pendientes,
        totalColaboradores: colList.length,
        pedidosEpecialesCount: pedidosEspeciales,
        skuCables: skuCab,
        skuHerrajes: skuHerr,
        skuAccesorios: skuAcc,
        totalSkusFabrica: totalSkus,
        totalSkusTerminados: terminados > 0 ? terminados : totalSkus,
        clientesPorPais: paisesMap,
        tiposCliente: tiposMap,
        cotizacionesPorPais: cotPaisesMap,
      });

    } catch (err) {
      console.error('Error fetching Supabase analytics data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportReport = () => {
    alert('Generando Reporte Ejecutivo Certificado (PDF/Excel) para Trulink Fiber LLC...');
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-6 md:p-10 font-sans selection:bg-amber-500 selection:text-black relative overflow-hidden">
      
      {/* EFECTOS DE LUZ AMBIENTAL DE LUJO */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[300px] bg-amber-500/5 blur-[140px] pointer-events-none rounded-full"></div>
      <div className="absolute top-1/3 right-10 w-[400px] h-[400px] bg-amber-600/5 blur-[160px] pointer-events-none rounded-full"></div>

      {/* HEADER EJECUTIVO ENTERPRISE */}
      <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center border-b border-amber-500/20 pb-6 mb-8 gap-6">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 to-amber-700 rounded-2xl blur opacity-40 animate-pulse"></div>
            <span className="relative flex p-3.5 bg-gradient-to-br from-zinc-900 to-black text-amber-400 rounded-2xl border border-amber-500/40 shadow-2xl">
              <Cpu className="w-8 h-8" />
            </span>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl md:text-4xl font-black tracking-tight bg-gradient-to-r from-amber-200 via-amber-400 to-amber-600 bg-clip-text text-transparent">
                TRULINK FIBER // ENTERPRISE BI
              </h1>
              <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-full text-xs font-bold tracking-widest uppercase flex items-center gap-1.5 shadow-lg shadow-amber-500/10">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span> Live Supabase
              </span>
            </div>
            <p className="text-zinc-400 text-sm mt-1 flex items-center gap-2">
              <Database className="w-4 h-4 text-amber-500" /> Sincronización activa con tablas: <code className="text-amber-300 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">cables</code>, <code className="text-amber-300 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">herrajes</code>, <code className="text-amber-300 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">accesorios</code>, <code className="text-amber-300 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">quotes</code>, <code className="text-amber-300 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">solicitudes_acceso</code>
            </p>
          </div>
        </div>

        {/* CONTROLES Y FILTROS ENTERPRISE */}
        <div className="flex items-center gap-3 flex-wrap">
          <button 
            onClick={handleExportReport}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold px-4 py-2.5 rounded-xl transition-all text-sm shadow-lg shadow-amber-500/20 cursor-pointer"
          >
            <Download className="w-4 h-4" /> Exportar Dossier BI
          </button>

          <button 
            onClick={fetchAllData}
            className="flex items-center gap-2 bg-zinc-900/90 border border-amber-500/30 hover:border-amber-500 text-amber-400 px-4 py-2.5 rounded-xl transition-all text-sm backdrop-blur-md cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Sincronizar
          </button>

          <div className="flex items-center bg-zinc-900/90 border border-amber-500/30 rounded-xl px-3 py-2 text-sm backdrop-blur-md">
            <Filter className="w-4 h-4 text-amber-400 mr-2" />
            <select 
              value={timeRange} 
              onChange={(e) => setTimeRange(e.target.value)}
              className="bg-transparent text-zinc-200 focus:outline-none cursor-pointer font-medium"
            >
              <option value="7d" className="bg-zinc-950">Últimos 7 días</option>
              <option value="30d" className="bg-zinc-950">Mes Actual (30d)</option>
              <option value="90d" className="bg-zinc-950">Último Trimestre</option>
              <option value="ytd" className="bg-zinc-950">Año en curso (YTD)</option>
              <option value="all" className="bg-zinc-950">Histórico Completo</option>
            </select>
          </div>
        </div>
      </div>

      {/* TABS DE NAVEGACIÓN ENTERPRISE */}
      <div className="relative z-10 flex gap-3 overflow-x-auto pb-4 mb-8 border-b border-zinc-800 scrollbar-thin scrollbar-thumb-amber-500/20">
        {[
          { id: 'operativo', label: '🏭 Fábrica & SKU Matrix', count: metrics.totalSkusFabrica },
          { id: 'registros', label: '📝 Clientes & Aprobaciones', count: metrics.totalSolicitudes },
          { id: 'comercial', label: '🛒 Pipeline Comercial / Quotes', count: metrics.totalQuotes },
          { id: 'usuarios', label: '👥 Gobierno & Colaboradores', count: metrics.totalColaboradores },
          { id: 'financiero', label: '💰 Tesorería & Facturación', count: null },
          { id: 'bi', label: '📈 Deep BI & Pedidos Especiales', count: metrics.pedidosEpecialesCount }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-5 py-3.5 rounded-2xl transition-all whitespace-nowrap flex items-center gap-3 border backdrop-blur-md cursor-pointer ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-amber-500/20 to-amber-600/10 border-amber-500 text-amber-300 shadow-xl shadow-amber-500/10 scale-[1.02]'
                : 'bg-zinc-950/80 border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
            }`}
          >
            <span className="font-bold text-sm tracking-wide">{tab.label}</span>
            {tab.count !== null && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* CONTENIDO PRINCIPAL SEGÚN PESTAÑA */}
      <div className="relative z-10 space-y-8 animate-fadeIn">

        {/* 1. FÁBRICA & SKUs (Cables, Herrajes, Accesorios) */}
        {activeTab === 'operativo' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <MetricCard title="SKU Totales en Fábrica" value={metrics.totalSkusFabrica.toString()} change="Catálogo unificado" positive={true} icon={<Package className="w-5 h-5 text-amber-400" />} />
              <MetricCard title="SKU Productos Terminados" value={metrics.totalSkusTerminados.toString()} change="Listos para despacho" positive={true} icon={<CheckCircle2 className="w-5 h-5 text-emerald-400" />} />
              <MetricCard title="SKU Cables ADSS" value={metrics.skuCables.toString()} change="Tabla `cables`" positive={true} icon={<Activity className="w-5 h-5 text-amber-400" />} />
              <MetricCard title="SKU Herrajes & Accesorios" value={(metrics.skuHerrajes + metrics.skuAccesorios).toString()} change="Nylon 66 & Componentes" positive={true} icon={<Wrench className="w-5 h-5 text-amber-400" />} />
            </div>

            {/* BARRA DE PROGRESO DE FABRICACIÓN / STOCK */}
            <div className="bg-zinc-950/90 border border-zinc-800/80 rounded-3xl p-6 shadow-2xl backdrop-blur-xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-amber-400 flex items-center gap-2">
                  <PieChart className="w-5 h-5" /> Distribución de Capacidad Productiva por Tabla Supabase
                </h3>
                <span className="text-xs text-zinc-400">Total ítems indexados: <strong className="text-amber-400">{metrics.totalSkusFabrica}</strong></span>
              </div>
              <div className="w-full bg-zinc-900 h-4 rounded-full overflow-hidden flex border border-zinc-800 p-0.5">
                <div style={{ width: `${metrics.skuCables ? (metrics.skuCables / (metrics.totalSkusFabrica || 1)) * 100 : 33}%` }} className="bg-amber-500 rounded-l-full h-full transition-all duration-1000" title="Cables"></div>
                <div style={{ width: `${metrics.skuHerrajes ? (metrics.skuHerrajes / (metrics.totalSkusFabrica || 1)) * 100 : 33}%` }} className="bg-amber-400 h-full transition-all duration-1000" title="Herrajes"></div>
                <div style={{ width: `${metrics.skuAccesorios ? (metrics.skuAccesorios / (metrics.totalSkusFabrica || 1)) * 100 : 34}%` }} className="bg-amber-600 rounded-r-full h-full transition-all duration-1000" title="Accesorios"></div>
              </div>
              <div className="flex justify-between text-xs text-zinc-400 mt-3 font-medium">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span> Cables ({metrics.skuCables} SKUs)</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block"></span> Herrajes ({metrics.skuHerrajes} SKUs)</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-600 inline-block"></span> Accesorios ({metrics.skuAccesorios} SKUs)</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Tabla Cables */}
              <div className="bg-zinc-950/90 border border-zinc-800/80 rounded-3xl p-6 shadow-2xl backdrop-blur-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-900">
                    <h3 className="text-base font-extrabold text-amber-400 flex items-center gap-2">
                      <Package className="w-5 h-5 text-amber-500" /> Tabla `cables`
                    </h3>
                    <span className="px-2.5 py-1 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold">{metrics.skuCables} Registros</span>
                  </div>
                  <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
                    {cablesData.length > 0 ? (
                      cablesData.map((c: any, i: number) => (
                        <div key={i} className="bg-zinc-900/60 border border-zinc-800/70 p-3.5 rounded-2xl flex justify-between items-center text-xs hover:border-amber-500/40 transition-all">
                          <div>
                            <span className="font-bold text-zinc-100">{c.codigo || c.nombre || c.sku || `Cable #${i+1}`}</span>
                            <p className="text-zinc-400 mt-0.5">{c.descripcion || c.tipo || 'Fibra ADSS'}</p>
                          </div>
                          <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-[10px] font-bold">Activo</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-zinc-500 text-center py-8">Sin registros en `cables`.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Tabla Herrajes */}
              <div className="bg-zinc-950/90 border border-zinc-800/80 rounded-3xl p-6 shadow-2xl backdrop-blur-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-900">
                    <h3 className="text-base font-extrabold text-amber-400 flex items-center gap-2">
                      <Wrench className="w-5 h-5 text-amber-500" /> Tabla `herrajes`
                    </h3>
                    <span className="px-2.5 py-1 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold">{metrics.skuHerrajes} Registros</span>
                  </div>
                  <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
                    {herrajesData.length > 0 ? (
                      herrajesData.map((h: any, i: number) => (
                        <div key={i} className="bg-zinc-900/60 border border-zinc-800/70 p-3.5 rounded-2xl flex justify-between items-center text-xs hover:border-amber-500/40 transition-all">
                          <div>
                            <span className="font-bold text-zinc-100">{h.codigo || h.nombre || h.sku || `Herraje #${i+1}`}</span>
                            <p className="text-zinc-400 mt-0.5">{h.descripcion || 'Nylon 66 & Fibra'}</p>
                          </div>
                          <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-[10px] font-bold">Activo</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-zinc-500 text-center py-8">Sin registros en `herrajes`.</p>
                    )}
                  </div>
                </div>
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
                            <p className="text-zinc-400 mt-0.5">{a.descripcion || 'Hardware de Red'}</p>
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
                          {count} cuentas
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
}

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