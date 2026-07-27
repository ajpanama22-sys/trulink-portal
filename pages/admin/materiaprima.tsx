import React, { useState, useMemo } from 'react';
import { 
  Layers, 
  Search, 
  Filter, 
  ShieldCheck, 
  Boxes, 
  CheckCircle2, 
  Info,
  ChevronRight,
  Database
} from 'lucide-react';

// ==========================================
// 1. TIPOS E INTERFACES (TypeScript)
// ==========================================

export type CableFamily = 'FTTH' | 'ASU' | 'ADSS';
export type MaterialCategory = 'fibra' | 'resina' | 'refuerzo' | 'bloqueo' | 'auxiliar';

export interface RawMaterial {
  id: string;
  name: string;
  category: MaterialCategory;
  categoryLabel: string;
  specification: string;
  description: string;
  applicableCables: CableFamily[];
  unit: 'km' | 'kg' | 'm' | 'bobina';
  isOptional?: boolean;
}

export interface CableSpecHeader {
  id: CableFamily;
  name: string;
  fullTitle: string;
  tubeType: 'Sin tubo' | 'Monotubo (Uni-tube)' | 'Multitubo (Loose Tube)';
  reinforcementType: 'FRP Lateral' | 'FRP Lateral Grueso' | 'CSM Central + Aramida/Vidrio';
}

// ==========================================
// 2. DATA MASTER DE MATERIA PRIMA (BOM)
// ==========================================

export const CABLE_HEADERS: Record<CableFamily, CableSpecHeader> = {
  FTTH: {
    id: 'FTTH',
    name: 'FTTH / FTTX Drop',
    fullTitle: 'Cable FTTH Drop (2 Hilos, Plano, Sin Mensajero)',
    tubeType: 'Sin tubo',
    reinforcementType: 'FRP Lateral'
  },
  ASU: {
    id: 'ASU',
    name: 'ASU Auto-soportado',
    fullTitle: 'Cable ASU (Auto-soportado Monotubo / Uni-tube)',
    tubeType: 'Monotubo (Uni-tube)',
    reinforcementType: 'FRP Lateral Grueso'
  },
  ADSS: {
    id: 'ADSS',
    name: 'ADSS Dieléctrico',
    fullTitle: 'Cable ADSS (All-Dielectric Self-Supporting - Multitubo)',
    tubeType: 'Multitubo (Loose Tube)',
    reinforcementType: 'CSM Central + Aramida/Vidrio'
  }
};

export const RAW_MATERIALS_DATABASE: RawMaterial[] = [
  // --- FIBRAS ---
  {
    id: 'MAT-FIB-01',
    name: 'Fibras Ópticas Precoloreadas G.657.A1/A2',
    category: 'fibra',
    categoryLabel: 'Fibras Ópticas',
    specification: '2 hilos coloreados (UV-cured)',
    description: 'Fibras monomodo con radio de curvatura reducido para aplicaciones de acceso Drop.',
    applicableCables: ['FTTH'],
    unit: 'km'
  },
  {
    id: 'MAT-FIB-02',
    name: 'Fibras Ópticas Precoloreadas G.652.D',
    category: 'fibra',
    categoryLabel: 'Fibras Ópticas',
    specification: 'Hilos coloreados estándar de dispersión no desplazada',
    description: 'Fibras para tubos holgados PBT en cables de planta exterior ASU y ADSS.',
    applicableCables: ['ASU', 'ADSS'],
    unit: 'km'
  },

  // --- RESINAS / POLÍMEROS ---
  {
    id: 'MAT-RES-01',
    name: 'Compuesto Termoplástico LSZH / PE UV',
    category: 'resina',
    categoryLabel: 'Resinas de Extrusión',
    specification: 'Low Smoke Zero Halogen / PE resistente a rayos UV',
    description: 'Cubierta exterior plana para cable Drop de baja emisión de humos y retardo de llama.',
    applicableCables: ['FTTH'],
    unit: 'kg'
  },
  {
    id: 'MAT-RES-02',
    name: 'Polibutileno Tereftalato (PBT)',
    category: 'resina',
    categoryLabel: 'Resinas de Extrusión',
    specification: 'Grado extrusión para Loose Tube',
    description: 'Polímero de alta rigidez utilizado para extruir los tubos holgados que alojan las fibras.',
    applicableCables: ['ASU', 'ADSS'],
    unit: 'kg'
  },
  {
    id: 'MAT-RES-03',
    name: 'Polietileno de Alta/Media Densidad (HDPE / MDPE)',
    category: 'resina',
    categoryLabel: 'Resinas de Extrusión',
    specification: 'Grado exterior con protección UV y baja fricción',
    description: 'Chaqueta exterior resistente para cables ASU y cubiertas interna/externa de cables ADSS.',
    applicableCables: ['ASU', 'ADSS'],
    unit: 'kg'
  },
  {
    id: 'MAT-RES-04',
    name: 'Resina Especial Anti-Tracking (AT)',
    category: 'resina',
    categoryLabel: 'Resinas de Extrusión',
    specification: 'Chaqueta AT para entornos de alto voltaje (>110kV)',
    description: 'Polímero resistente al arborescente eléctrico (*tracking*) para cables ADSS cerca de líneas eléctricas.',
    applicableCables: ['ADSS'],
    unit: 'kg',
    isOptional: true
  },

  // --- REFUERZOS DIELÉCTRICOS ---
  {
    id: 'MAT-REF-01',
    name: 'Varillas FRP Lateral (Delgadas)',
    category: 'refuerzo',
    categoryLabel: 'Refuerzos Dieléctricos',
    specification: '2 varillas de FRP (0.45 mm - 1.0 mm)',
    description: 'Soporte estructural paralelo integrado a los lados del cable Drop plano.',
    applicableCables: ['FTTH'],
    unit: 'km'
  },
  {
    id: 'MAT-REF-02',
    name: 'Varillas FRP Lateral (Gruesas)',
    category: 'refuerzo',
    categoryLabel: 'Refuerzos Dieléctricos',
    specification: '2 varillas gruesas de FRP (1.5 mm - 2.5 mm)',
    description: 'Elementos de fuerza integrados a la cubierta exterior para cables autosoportados ASU.',
    applicableCables: ['ASU'],
    unit: 'km'
  },
  {
    id: 'MAT-REF-03',
    name: 'Varilla Central de Refuerzo (CSM FRP)',
    category: 'refuerzo',
    categoryLabel: 'Refuerzos Dieléctricos',
    specification: 'Central Strength Member de plástico reforzado con fibra',
    description: 'Núcleo central estructural sobre el cual se trenzan los tubos PBT en cables ADSS.',
    applicableCables: ['ADSS'],
    unit: 'km'
  },
  {
    id: 'MAT-REF-04',
    name: 'Hilados de Aramida (Kevlar) / Fibra de Vidrio',
    category: 'refuerzo',
    categoryLabel: 'Refuerzos Dieléctricos',
    specification: 'Yarns dieléctricos de alta tenacidad para tensión de vano (*span*)',
    description: 'Absorben el esfuerzo mecánico y tracción en cables ADSS para vanos aéreos.',
    applicableCables: ['ADSS'],
    unit: 'kg'
  },

  // --- BLOQUEO HIDRÓFUGO / GELES ---
  {
    id: 'MAT-BLO-01',
    name: 'Gel Tixotrópico Hidrófugo (Tube Gel)',
    category: 'bloqueo',
    categoryLabel: 'Compuestos Hidrófugos',
    specification: 'Compuesto tixotrópico de inyección para tubos',
    description: 'Rellena el tubo PBT previniendo la penetración de humedad y protegiendo las fibras.',
    applicableCables: ['ASU', 'ADSS'],
    unit: 'kg'
  },
  {
    id: 'MAT-BLO-02',
    name: 'Hilos / Cinta Hinchable (Water-blocking Yarn/Tape)',
    category: 'bloqueo',
    categoryLabel: 'Compuestos Hidrófugos',
    specification: 'Material superabsorbente (SAP) autosellante',
    description: 'Bloqueo seco longitudinal contra el agua alrededor del núcleo y tubos.',
    applicableCables: ['ASU', 'ADSS'],
    unit: 'km'
  },

  // --- AUXILIARES ---
  {
    id: 'MAT-AUX-01',
    name: 'Hilo de Desgarre (Ripcord)',
    category: 'auxiliar',
    categoryLabel: 'Elementos Auxiliares',
    specification: 'Hilo sintético de alta resistencia a la tracción',
    description: 'Facilita la apertura longitudinal de la cubierta sin dañar el núcleo óptico.',
    applicableCables: ['FTTH', 'ASU', 'ADSS'],
    unit: 'km',
    isOptional: true
  },
  {
    id: 'MAT-AUX-02',
    name: 'Tubos de Relleno Sintéticos (Fillers)',
    category: 'auxiliar',
    categoryLabel: 'Elementos Auxiliares',
    specification: 'Cilindros ciegos de PE/PBT para balance geométrico',
    description: 'Rellenan las posiciones vacías en el trenzado SZ de cables ADSS de baja cuenta de hilos.',
    applicableCables: ['ADSS'],
    unit: 'km',
    isOptional: true
  }
];

// ==========================================
// 3. COMPONENTE PRINCIPAL
// ==========================================

export default function MateriaPrimaModule() {
  const [selectedCable, setSelectedCable] = useState<CableFamily | 'ALL'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<MaterialCategory | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Filtrado de materiales en tiempo real
  const filteredMaterials = useMemo(() => {
    return RAW_MATERIALS_DATABASE.filter((mat) => {
      const matchCable = selectedCable === 'ALL' || mat.applicableCables.includes(selectedCable);
      const matchCat = selectedCategory === 'ALL' || mat.category === selectedCategory;
      const matchSearch =
        mat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mat.specification.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mat.id.toLowerCase().includes(searchTerm.toLowerCase());

      return matchCable && matchCat && matchSearch;
    });
  }, [selectedCable, selectedCategory, searchTerm]);

  // Indicadores cuantitativos
  const stats = useMemo(() => {
    return {
      totalItems: RAW_MATERIALS_DATABASE.length,
      filteredCount: filteredMaterials.length,
      ftthCount: RAW_MATERIALS_DATABASE.filter((m) => m.applicableCables.includes('FTTH')).length,
      asuCount: RAW_MATERIALS_DATABASE.filter((m) => m.applicableCables.includes('ASU')).length,
      adssCount: RAW_MATERIALS_DATABASE.filter((m) => m.applicableCables.includes('ADSS')).length
    };
  }, [filteredMaterials]);

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      {/* Header del Módulo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold tracking-wide uppercase mb-1">
            <Boxes className="w-4 h-4" /> Control de Producción e Insumos
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            Gestión de Materia Prima por Tipo de Cable
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Estructura de insumos (BOM) para cables ópticos con fibras precoloreadas.
          </p>
        </div>

        {/* Badge de Base de Datos / Supabase Status */}
        <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 self-start md:self-auto">
          <Database className="w-5 h-5 text-emerald-400" />
          <div className="text-xs">
            <p className="text-slate-400">Estado BDD</p>
            <p className="text-emerald-400 font-medium">Sincronizado</p>
          </div>
        </div>
      </div>

      {/* Tarjetas resumen por Cable */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {(Object.keys(CABLE_HEADERS) as CableFamily[]).map((familyKey) => {
          const spec = CABLE_HEADERS[familyKey];
          const isSelected = selectedCable === familyKey;
          const count =
            familyKey === 'FTTH' ? stats.ftthCount : familyKey === 'ASU' ? stats.asuCount : stats.adssCount;

          return (
            <button
              key={familyKey}
              onClick={() => setSelectedCable(isSelected ? 'ALL' : familyKey)}
              className={`text-left transition-all duration-200 p-5 rounded-xl border ${
                isSelected
                  ? 'bg-amber-500/10 border-amber-500/50 shadow-lg shadow-amber-500/5'
                  : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold tracking-wider px-2.5 py-1 rounded-md bg-slate-800 text-amber-400 border border-amber-500/20">
                  {spec.id}
                </span>
                <span className="text-xs text-slate-400 font-mono">{count} Insumos</span>
              </div>
              <h3 className="font-semibold text-white text-base mb-1">{spec.name}</h3>
              <p className="text-xs text-slate-400 mb-3">{spec.tubeType}</p>
              <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-800/80 pt-2 mt-2">
                <span>Refuerzo: {spec.reinforcementType}</span>
                <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'rotate-90 text-amber-400' : ''}`} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
        {/* Campo de Búsqueda */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por código, material o especificación..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 transition-colors"
          />
        </div>

        {/* Filtro por Categoría */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-xs text-slate-400 shrink-0 mr-1">Categoría:</span>

          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`text-xs px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
              selectedCategory === 'ALL'
                ? 'bg-amber-500 text-slate-950 font-semibold'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Todas ({stats.filteredCount})
          </button>

          {[
            { id: 'fibra', label: 'Fibras' },
            { id: 'resina', label: 'Resinas' },
            { id: 'refuerzo', label: 'Refuerzos' },
            { id: 'bloqueo', label: 'Geles/Hidrófugo' },
            { id: 'auxiliar', label: 'Auxiliares' }
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id as MaterialCategory)}
              className={`text-xs px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla de Resultados de Materia Prima */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Código</th>
                <th className="py-3.5 px-4">Material / Insumo</th>
                <th className="py-3.5 px-4">Categoría</th>
                <th className="py-3.5 px-4">Especificación Técnica</th>
                <th className="py-3.5 px-4">Aplica a Cables</th>
                <th className="py-3.5 px-4 text-center">Unidad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredMaterials.length > 0 ? (
                filteredMaterials.map((material) => (
                  <tr key={material.id} className="hover:bg-slate-800/40 transition-colors group">
                    {/* ID */}
                    <td className="py-4 px-4 font-mono text-amber-400/90 font-medium">
                      {material.id}
                    </td>

                    {/* Nombre y descripción */}
                    <td className="py-4 px-4">
                      <div className="font-semibold text-slate-100 group-hover:text-amber-300 transition-colors">
                        {material.name}
                      </div>
                      <div className="text-slate-400 text-[11px] mt-0.5 line-clamp-1">
                        {material.description}
                      </div>
                    </td>

                    {/* Categoría */}
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                        {material.categoryLabel}
                      </span>
                    </td>

                    {/* Especificación */}
                    <td className="py-4 px-4 text-slate-300 font-mono text-[11px]">
                      {material.specification}
                      {material.isOptional && (
                        <span className="ml-2 text-[10px] text-amber-400/80 bg-amber-400/10 px-1.5 py-0.5 rounded">
                          Opcional
                        </span>
                      )}
                    </td>

                    {/* Cables aplicables */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1.5">
                        {material.applicableCables.map((cable) => (
                          <span
                            key={cable}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              cable === 'FTTH'
                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                : cable === 'ASU'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                            }`}
                          >
                            {cable}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Unidad de medida */}
                    <td className="py-4 px-4 text-center font-mono text-slate-400">
                      {material.unit}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <Info className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    No se encontraron materias primas que coincidan con los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer de la tabla */}
        <div className="bg-slate-950 px-4 py-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
          <span>Mostrando {filteredMaterials.length} de {RAW_MATERIALS_DATABASE.length} materiales registrados</span>
          <span className="flex items-center gap-1.5 text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> Fibras precoloreadas configuradas (Línea UV omitida)
          </span>
        </div>
      </div>
    </div>
  );
}