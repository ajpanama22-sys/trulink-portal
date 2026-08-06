import { useEffect, useMemo, useState } from 'react';

type ClienteResumen = {
  id: string;
  razon_social: string;
  email: string;
  pais: string;
  tipo_cliente: string;
  perfil_cliente: string;
  price_list: string;
  industria: string;
  status: string;
  totalComprado: number;
  cantidadCompras: number;
  saldoPendiente: number;
  montoAtrasado: number;
  facturasAtrasadas: number;
};

export default function SegmentacionClientes() {
  const [clientes, setClientes] = useState<ClienteResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filtroPais, setFiltroPais] = useState('todos');
  const [filtroPerfil, setFiltroPerfil] = useState('todos');
  const [filtroPriceList, setFiltroPriceList] = useState('todos');
  const [soloAtrasados, setSoloAtrasados] = useState(false);
  const [orden, setOrden] = useState<'totalComprado' | 'montoAtrasado' | 'razon_social'>('totalComprado');

  useEffect(() => {
    fetch('/api/admin/segmentacion-clientes')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setClientes(data.clientes || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const paises = useMemo(
    () => Array.from(new Set(clientes.map((c) => c.pais))).sort(),
    [clientes]
  );
  const perfiles = useMemo(
    () => Array.from(new Set(clientes.map((c) => c.perfil_cliente).filter(Boolean))).sort(),
    [clientes]
  );
  const priceLists = useMemo(
    () => Array.from(new Set(clientes.map((c) => c.price_list))).sort(),
    [clientes]
  );

  const filtrados = useMemo(() => {
    return clientes
      .filter((c) => filtroPais === 'todos' || c.pais === filtroPais)
      .filter((c) => filtroPerfil === 'todos' || c.perfil_cliente === filtroPerfil)
      .filter((c) => filtroPriceList === 'todos' || c.price_list === filtroPriceList)
      .filter((c) => !soloAtrasados || c.facturasAtrasadas > 0)
      .sort((a, b) => {
        if (orden === 'razon_social') return a.razon_social.localeCompare(b.razon_social);
        return (b[orden] as number) - (a[orden] as number);
      });
  }, [clientes, filtroPais, filtroPerfil, filtroPriceList, soloAtrasados, orden]);

  const totales = useMemo(() => {
    return filtrados.reduce(
      (acc, c) => ({
        clientes: acc.clientes + 1,
        comprado: acc.comprado + c.totalComprado,
        atrasado: acc.atrasado + c.montoAtrasado,
        facturasAtrasadas: acc.facturasAtrasadas + c.facturasAtrasadas,
      }),
      { clientes: 0, comprado: 0, atrasado: 0, facturasAtrasadas: 0 }
    );
  }, [filtrados]);

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-PA', { style: 'currency', currency: 'USD' }).format(n);

  const selectClass =
    'bg-black border border-yellow-700 text-yellow-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-yellow-400';

  if (loading)
    return <div className="p-4 text-yellow-300">Cargando segmentación de clientes...</div>;
  if (error)
    return <div className="p-4 text-red-400">Error: {error}</div>;

  return (
    <div className="space-y-4 text-gray-200">
      {/* Tarjetas resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-black border border-yellow-700/50 rounded-lg shadow p-4">
          <p className="text-sm text-yellow-500/80">Clientes (filtro actual)</p>
          <p className="text-2xl font-bold text-yellow-300">{totales.clientes}</p>
        </div>
        <div className="bg-black border border-yellow-700/50 rounded-lg shadow p-4">
          <p className="text-sm text-yellow-500/80">Total comprado</p>
          <p className="text-2xl font-bold text-green-400">{fmt(totales.comprado)}</p>
        </div>
        <div className="bg-black border border-yellow-700/50 rounded-lg shadow p-4">
          <p className="text-sm text-yellow-500/80">Monto atrasado</p>
          <p className="text-2xl font-bold text-red-400">{fmt(totales.atrasado)}</p>
        </div>
        <div className="bg-black border border-yellow-700/50 rounded-lg shadow p-4">
          <p className="text-sm text-yellow-500/80">Facturas atrasadas</p>
          <p className="text-2xl font-bold text-orange-400">{totales.facturasAtrasadas}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-black border border-yellow-700/50 rounded-lg shadow p-4 flex flex-wrap gap-3 items-center">
        <select value={filtroPais} onChange={(e) => setFiltroPais(e.target.value)} className={selectClass}>
          <option value="todos">Todos los países</option>
          {paises.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        <select value={filtroPerfil} onChange={(e) => setFiltroPerfil(e.target.value)} className={selectClass}>
          <option value="todos">Todos los perfiles</option>
          {perfiles.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        <select value={filtroPriceList} onChange={(e) => setFiltroPriceList(e.target.value)} className={selectClass}>
          <option value="todos">Toda price list</option>
          {priceLists.map((pl) => <option key={pl} value={pl}>{pl}</option>)}
        </select>

        <label className="flex items-center gap-2 text-sm text-yellow-300">
          <input
            type="checkbox"
            checked={soloAtrasados}
            onChange={(e) => setSoloAtrasados(e.target.checked)}
            className="accent-yellow-500"
          />
          Solo con pagos atrasados
        </label>

        <select
          value={orden}
          onChange={(e) => setOrden(e.target.value as any)}
          className={selectClass + ' ml-auto'}
        >
          <option value="totalComprado">Ordenar: mayor compra</option>
          <option value="montoAtrasado">Ordenar: mayor atraso</option>
          <option value="razon_social">Ordenar: nombre A-Z</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="bg-black border border-yellow-700/50 rounded-lg shadow overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-yellow-900/20">
            <tr>
              <th className="text-left p-2 text-yellow-400">Cliente</th>
              <th className="text-left p-2 text-yellow-400">País</th>
              <th className="text-left p-2 text-yellow-400">Perfil</th>
              <th className="text-left p-2 text-yellow-400">Price List</th>
              <th className="text-right p-2 text-yellow-400">Compras</th>
              <th className="text-right p-2 text-yellow-400">Total comprado</th>
              <th className="text-right p-2 text-yellow-400">Saldo pendiente</th>
              <th className="text-right p-2 text-yellow-400">Atrasado</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((c) => (
              <tr
                key={c.id}
                className={`border-t border-yellow-900/30 ${
                  c.facturasAtrasadas > 0 ? 'bg-red-950/30' : ''
                }`}
              >
                <td className="p-2">
                  <div className="font-medium text-gray-100">{c.razon_social}</div>
                  <div className="text-xs text-gray-500">{c.email}</div>
                </td>
                <td className="p-2 text-gray-300">{c.pais}</td>
                <td className="p-2 text-gray-300">{c.perfil_cliente}</td>
                <td className="p-2 text-gray-300">{c.price_list}</td>
                <td className="p-2 text-right text-gray-300">{c.cantidadCompras}</td>
                <td className="p-2 text-right text-gray-100">{fmt(c.totalComprado)}</td>
                <td className="p-2 text-right text-gray-100">{fmt(c.saldoPendiente)}</td>
                <td className="p-2 text-right">
                  {c.facturasAtrasadas > 0 ? (
                    <span className="text-red-400 font-semibold">
                      {fmt(c.montoAtrasado)} ({c.facturasAtrasadas})
                    </span>
                  ) : (
                    <span className="text-gray-600">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}