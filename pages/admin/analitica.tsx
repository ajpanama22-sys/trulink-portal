import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface ClientData {
  id: string;
  pais?: string;
  country?: string;
  tipo_cliente?: string;
  status?: string;
  created_at: string;
}

interface QuoteData {
  id: string;
  pais?: string;
  country?: string;
  shipping_country?: string;
  created_at: string;
}

export const Analitica: React.FC = () => {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [quotes, setQuotes] = useState<QuoteData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    cargarDatosAnalitica();
  }, []);

  const cargarDatosAnalitica = async () => {
    try {
      setLoading(true);

      // 1. Corrección del nombre de la tabla: se usa "clients" (o "clientes" según tu base de datos)
      const { data: clientsData, error: clientsError } = await supabase
        .from("clients") 
        .select("*");

      console.log("Clientes desde Supabase:", clientsData, clientsError);

      if (clientsError) {
        throw clientsError;
      }

      // 2. Consulta a la tabla de cotizaciones ('quotes')
      const { data: quotesData, error: quotesError } = await supabase
        .from("quotes")
        .select("*");

      console.log("Cotizaciones desde Supabase:", quotesData, quotesError);

      if (quotesError) {
        throw quotesError;
      }

      setClients(clientsData || []);
      setQuotes(quotesData || []);
    } catch (err: any) {
      console.error("Error al cargar datos de analítica:", err.message || err);
      setErrorMsg(err.message || "Error al cargar los datos analíticos.");
    } finally {
      setLoading(false);
    }
  };

  // Agrupación robusta por país para clientes
  const getCountryDistribution = () => {
    const distribution: { [key: string]: number } = {};
    clients.forEach((u) => {
      const country = u.pais || u.country || "Panamá";
      distribution[country] = (distribution[country] || 0) + 1;
    });
    return distribution;
  };

  // Agrupación robusta por país para cotizaciones (quotes)
  const getQuotesCountryDistribution = () => {
    const distribution: { [key: string]: number } = {};
    quotes.forEach((q) => {
      const country = q.pais || q.country || q.shipping_country || "Panamá";
      distribution[country] = (distribution[country] || 0) + 1;
    });
    return distribution;
  };

  const clientDistribution = getCountryDistribution();
  const quoteDistribution = getQuotesCountryDistribution();

  return (
    <div className="p-6 bg-black text-amber-400 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 border-b border-amber-500/30 pb-4">
        Panel de Analítica y Distribución Geográfica
      </h1>

      {loading ? (
        <div className="flex justify-center items-center h-64 text-amber-300 animate-pulse">
          Cargando datos analíticos...
        </div>
      ) : errorMsg ? (
        <div className="bg-red-950/50 border border-red-500 text-red-300 p-4 rounded-lg mb-6">
          <p><strong>Error:</strong> {errorMsg}</p>
          <p className="text-sm mt-2 text-amber-200/70">
            Verifica el nombre exacto de la tabla en Supabase (ej. "clients" o "clientes") y las políticas RLS.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Distribución de Clientes por País */}
          <div className="bg-neutral-900 border border-amber-500/30 p-6 rounded-xl shadow-lg">
            <h2 className="text-xl font-semibold mb-4 text-amber-300">
              Clientes por País
            </h2>
            {Object.keys(clientDistribution).length === 0 ? (
              <p className="text-neutral-400">No hay registros de clientes disponibles.</p>
            ) : (
              <ul className="space-y-3">
                {Object.entries(clientDistribution).map(([country, count]) => (
                  <li key={country} className="flex justify-between items-center bg-black/40 px-4 py-2 rounded border border-amber-500/20">
                    <span className="text-neutral-200">{country}</span>
                    <span className="font-bold text-amber-400">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Distribución de Cotizaciones por País */}
          <div className="bg-neutral-900 border border-amber-500/30 p-6 rounded-xl shadow-lg">
            <h2 className="text-xl font-semibold mb-4 text-amber-300">
              Cotizaciones (Quotes) por País
            </h2>
            {Object.keys(quoteDistribution).length === 0 ? (
              <p className="text-neutral-400">No hay registros de cotizaciones disponibles.</p>
            ) : (
              <ul className="space-y-3">
                {Object.entries(quoteDistribution).map(([country, count]) => (
                  <li key={country} className="flex justify-between items-center bg-black/40 px-4 py-2 rounded border border-amber-500/20">
                    <span className="text-neutral-200">{country}</span>
                    <span className="font-bold text-amber-400">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Analitica;