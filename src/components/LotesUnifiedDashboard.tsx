import React, { useState, useMemo } from 'react';
import {
  Package,
  Scale,
  Hash,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Layers,
  Filter,
  Sprout,
  Wheat,
  Building2,
  Tag,
  FlaskConical,
  CheckCircle2,
  Warehouse,
  BarChart2,
  PieChart,
  Search,
  Share2,
  Table as TableIcon,
  LayoutGrid,
  ArrowUpDown,
  Sparkles,
  X,
  TrendingUp,
} from 'lucide-react';
import { Lote } from '../types';
import { formatNumberArg, formatKg } from '../utils/formatters';

export type DashboardDimension =
  | 'TODOS'
  | 'ESPECIE'
  | 'VARIEDAD'
  | 'CLIENTE'
  | 'CATEGORIA'
  | 'TIPO'
  | 'TRATAMIENTO'
  | 'ESTADO'
  | 'ENVASE'
  | 'ALA';

interface LotesUnifiedDashboardProps {
  lotes: Lote[];
  filteredLotes: Lote[];
  hasActiveFilters: boolean;
  activeFiltersCount?: number;
  activeFilterDimensions?: {
    CLIENTE: boolean;
    ESPECIE: boolean;
    VARIEDAD: boolean;
    CATEGORIA: boolean;
    TIPO: boolean;
    TRATAMIENTO: boolean;
    ESTADO: boolean;
    ALA?: boolean;
  };
  onSelectLote?: (lote: Lote) => void;
  onQuickFilter?: (dimension: string, value: string) => void;
}

interface GroupSummary {
  id: string;
  label: string;
  sublabel?: string;
  bolsas: number;
  kg: number;
  lotes: number;
  loteItems: Lote[];
}

export const LotesUnifiedDashboard: React.FC<LotesUnifiedDashboardProps> = ({
  lotes,
  filteredLotes,
  hasActiveFilters,
  activeFiltersCount = 0,
  activeFilterDimensions,
  onSelectLote,
  onQuickFilter,
}) => {
  // Estados de control interactivo del dashboard
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<DashboardDimension>('ESPECIE');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');
  const [searchBreakdown, setSearchBreakdown] = useState('');
  const [sortBy, setSortBy] = useState<'kg' | 'bolsas' | 'lotes' | 'name'>('kg');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Estados para IDs de lotes
  const [copiedIds, setCopiedIds] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [isIdsExpanded, setIsIdsExpanded] = useState(false);
  const [searchIdQuery, setSearchIdQuery] = useState('');

  // 1. Cálculos de Totales Globales y Lista de Lotes
  const {
    totalBolsas,
    totalKg,
    totalTn,
    lotesList,
    alasCount,
    promedioKgPorBolsa,
    promedioBolsasPorLote,
    envasesSummary,
  } = useMemo(() => {
    let bolsas = 0;
    let kg = 0;
    const alaMap: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
    const envMap: Record<number, { bolsas: number; kg: number }> = {};

    const list = filteredLotes.map((lote) => {
      const b = Number(lote.stockBolsas) || 0;
      const k = lote.stockKg !== undefined ? Number(lote.stockKg) : b * (Number(lote.kgPorBolsa) || 0);
      const ala = (lote.ala || '').toUpperCase();
      const kgEnvase = Number(lote.kgPorBolsa) || 0;

      bolsas += b;
      kg += k;

      if (ala in alaMap) {
        alaMap[ala] += 1;
      }

      if (kgEnvase > 0) {
        if (!envMap[kgEnvase]) envMap[kgEnvase] = { bolsas: 0, kg: 0 };
        envMap[kgEnvase].bolsas += b;
        envMap[kgEnvase].kg += k;
      }

      return {
        id: lote.id,
        loteNro: lote.loteNro || lote.id,
        cliente: lote.cliente || 'Sin cliente',
        especie: lote.especie || 'Sin especie',
        variedad: lote.variedad || '',
        stockBolsas: b,
        stockKg: k,
        ala: lote.ala || 'S/A',
        sector: lote.sector || 'S/S',
        rawLote: lote,
      };
    });

    const envasesArr = Object.entries(envMap)
      .map(([k, v]) => ({ kgPorBolsa: Number(k), ...v }))
      .sort((a, b) => b.kg - a.kg);

    return {
      totalBolsas: bolsas,
      totalKg: kg,
      totalTn: kg / 1000,
      lotesList: list,
      alasCount: alaMap,
      promedioKgPorBolsa: bolsas > 0 ? (kg / bolsas).toFixed(1) : '0',
      promedioBolsasPorLote: list.length > 0 ? (bolsas / list.length).toFixed(0) : '0',
      envasesSummary: envasesArr,
    };
  }, [filteredLotes]);

  // 2. Desglose analítico de todas las dimensiones
  const allDimensionsData = useMemo(() => {
    const mapCliente: Record<string, GroupSummary> = {};
    const mapEspecie: Record<string, GroupSummary> = {};
    const mapVariedad: Record<string, GroupSummary> = {};
    const mapCategoria: Record<string, GroupSummary> = {};
    const mapTipo: Record<string, GroupSummary> = {};
    const mapTratamiento: Record<string, GroupSummary> = {};
    const mapEstado: Record<string, GroupSummary> = {};
    const mapEnvase: Record<string, GroupSummary> = {};
    const mapAla: Record<string, GroupSummary> = {};

    filteredLotes.forEach((lote) => {
      const b = Number(lote.stockBolsas) || 0;
      const k = lote.stockKg !== undefined ? Number(lote.stockKg) : b * (Number(lote.kgPorBolsa) || 0);

      // Helper para insertar o acumular
      const add = (map: Record<string, GroupSummary>, key: string, label: string, sublabel?: string) => {
        const cleanKey = key.trim() || 'Sin Especificar';
        if (!map[cleanKey]) {
          map[cleanKey] = {
            id: cleanKey,
            label: label.trim() || 'Sin Especificar',
            sublabel,
            bolsas: 0,
            kg: 0,
            lotes: 0,
            loteItems: [],
          };
        }
        map[cleanKey].bolsas += b;
        map[cleanKey].kg += k;
        map[cleanKey].lotes += 1;
        map[cleanKey].loteItems.push(lote);
      };

      // Cliente
      let rawCliente = lote.cliente || 'Sin Cliente';
      if (rawCliente.toUpperCase().includes('SAN DIEGO')) rawCliente = 'San Diego Semilla';
      add(mapCliente, rawCliente, rawCliente);

      // Especie
      const esp = lote.especie?.trim() || 'Sin Especie';
      add(mapEspecie, esp, esp);

      // Variedad
      const varName = lote.variedad?.trim() || 'Sin Variedad';
      add(mapVariedad, `${esp} - ${varName}`, varName, esp);

      // Categoría
      const cat = lote.categoria?.trim() || 'PRIMU';
      add(mapCategoria, cat, cat);

      // Tipo
      const tp = lote.tipo?.trim() || 'Final';
      add(mapTipo, tp, tp);

      // Tratamiento
      const tratStr =
        lote.tratamiento && lote.tratamiento.length > 0
          ? lote.tratamiento.join(', ')
          : lote.producto && !['Ninguno', 'Sin Tratamiento', 'FINAL', 'INTERMEDIO', ''].includes(lote.producto)
          ? lote.producto
          : 'Sin Tratar';
      add(mapTratamiento, tratStr, tratStr);

      // Estado
      const est = lote.estado || 'Disponible';
      add(mapEstado, est, est);

      // Envase
      const envKg = lote.kgPorBolsa ? `${lote.kgPorBolsa} kg` : 'Sin definir';
      add(mapEnvase, envKg, `Envases de ${envKg}`);

      // Ala
      const alaStr = lote.ala ? `Ala ${lote.ala}` : 'Sin Ala';
      add(mapAla, alaStr, alaStr);
    });

    return {
      ESPECIE: Object.values(mapEspecie),
      VARIEDAD: Object.values(mapVariedad),
      CLIENTE: Object.values(mapCliente),
      CATEGORIA: Object.values(mapCategoria),
      TIPO: Object.values(mapTipo),
      TRATAMIENTO: Object.values(mapTratamiento),
      ESTADO: Object.values(mapEstado),
      ENVASE: Object.values(mapEnvase),
      ALA: Object.values(mapAla),
    };
  }, [filteredLotes]);

  // Dimensiones aplicadas activamente
  const activeAppliedDimensionsList = useMemo(() => {
    if (!activeFilterDimensions) return [];
    const list: { id: DashboardDimension; label: string; count: number }[] = [];
    if (activeFilterDimensions.ESPECIE)
      list.push({ id: 'ESPECIE', label: 'Especie', count: allDimensionsData.ESPECIE.length });
    if (activeFilterDimensions.VARIEDAD)
      list.push({ id: 'VARIEDAD', label: 'Variedad', count: allDimensionsData.VARIEDAD.length });
    if (activeFilterDimensions.CLIENTE)
      list.push({ id: 'CLIENTE', label: 'Cliente', count: allDimensionsData.CLIENTE.length });
    if (activeFilterDimensions.CATEGORIA)
      list.push({ id: 'CATEGORIA', label: 'Categoría', count: allDimensionsData.CATEGORIA.length });
    if (activeFilterDimensions.TIPO)
      list.push({ id: 'TIPO', label: 'Tipo', count: allDimensionsData.TIPO.length });
    if (activeFilterDimensions.TRATAMIENTO)
      list.push({ id: 'TRATAMIENTO', label: 'Tratamiento', count: allDimensionsData.TRATAMIENTO.length });
    if (activeFilterDimensions.ESTADO)
      list.push({ id: 'ESTADO', label: 'Estado', count: allDimensionsData.ESTADO.length });
    if (activeFilterDimensions.ALA)
      list.push({ id: 'ALA', label: 'Ubicación / Ala', count: allDimensionsData.ALA.length });
    return list;
  }, [activeFilterDimensions, allDimensionsData]);

  // Obtener la lista del tab actual filtrada y ordenada
  const currentGroups = useMemo(() => {
    let list: GroupSummary[] = [];

    if (activeTab === 'TODOS') {
      // Si está en 'TODOS', combinamos las dimensiones activas o especies
      if (activeAppliedDimensionsList.length > 0) {
        // Mostramos la primera dimensión aplicada o especie
        const firstDim = activeAppliedDimensionsList[0].id;
        list = allDimensionsData[firstDim] || [];
      } else {
        list = allDimensionsData.ESPECIE || [];
      }
    } else {
      list = allDimensionsData[activeTab] || [];
    }

    // Filtrar por texto de búsqueda si el usuario ingresó algo
    if (searchBreakdown.trim()) {
      const q = searchBreakdown.toLowerCase().trim();
      list = list.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          (item.sublabel && item.sublabel.toLowerCase().includes(q))
      );
    }

    // Ordenar
    const sorted = [...list].sort((a, b) => {
      let valA: any = a.kg;
      let valB: any = b.kg;
      if (sortBy === 'bolsas') {
        valA = a.bolsas;
        valB = b.bolsas;
      } else if (sortBy === 'lotes') {
        valA = a.lotes;
        valB = b.lotes;
      } else if (sortBy === 'name') {
        valA = a.label.toLowerCase();
        valB = b.label.toLowerCase();
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortOrder === 'desc' ? valB - valA : valA - valB;
    });

    return sorted;
  }, [activeTab, allDimensionsData, activeAppliedDimensionsList, searchBreakdown, sortBy, sortOrder]);

  // IDs visibles filtrados por buscador local
  const visibleLotesChips = useMemo(() => {
    if (!searchIdQuery.trim()) return lotesList;
    const q = searchIdQuery.toLowerCase().trim();
    return lotesList.filter(
      (item) =>
        item.loteNro.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        item.cliente.toLowerCase().includes(q) ||
        item.especie.toLowerCase().includes(q)
    );
  }, [lotesList, searchIdQuery]);

  const MAX_COLLAPSED_CHIPS = 12;
  const displayedChips = isIdsExpanded ? visibleLotesChips : visibleLotesChips.slice(0, MAX_COLLAPSED_CHIPS);
  const remainingCount = Math.max(0, visibleLotesChips.length - MAX_COLLAPSED_CHIPS);

  // Copiar IDs al portapapeles
  const handleCopyIds = async () => {
    if (lotesList.length === 0) return;
    const idsString = lotesList.map((item) => item.loteNro).join(', ');
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(idsString);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = idsString;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedIds(true);
      setTimeout(() => setCopiedIds(false), 2500);
    } catch {
      setCopiedIds(false);
    }
  };

  // Copiar Resumen Ejecutivo de Texto (ideal para WhatsApp / Email)
  const handleCopyExecutiveSummary = async () => {
    if (filteredLotes.length === 0) return;

    const especiesLines = allDimensionsData.ESPECIE.slice(0, 5)
      .map((e) => {
        const pct = totalKg > 0 ? ((e.kg / totalKg) * 100).toFixed(1) : '0';
        return `  • ${e.label}: ${formatNumberArg(e.bolsas, 0)} b. | ${formatKg(e.kg)} (${pct}%)`;
      })
      .join('\n');

    const summaryText = `📊 *RESUMEN DE LOTES EN PLANTA - AGRO ABACUS*
📅 Fecha: ${new Date().toLocaleDateString('es-AR')}
🔍 Estado: ${hasActiveFilters ? `Filtrado (${activeFiltersCount} filtros activos)` : 'Total Planta General'}

📦 *Totales Consolidados:*
• Lotes Visibles: ${filteredLotes.length} de ${lotes.length}
• Bolsas Totales: ${formatNumberArg(totalBolsas, 0)} bolsas
• Kilos Totales: ${formatNumberArg(totalKg, 0)} kg (${totalTn.toFixed(2)} Tn)
• Promedio: ~${promedioKgPorBolsa} kg/bolsa

🌱 *Desglose por Especies:*
${especiesLines}

🏢 *Distribución por Alas:*
• Ala A: ${alasCount.A} lotes | Ala B: ${alasCount.B} lotes | Ala C: ${alasCount.C} lotes | Ala D: ${alasCount.D} lotes`;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(summaryText);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = summaryText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2500);
    } catch {
      setCopiedSummary(false);
    }
  };

  const tabsConfig = [
    { id: 'ESPECIE' as DashboardDimension, label: 'Especie', icon: Sprout, count: allDimensionsData.ESPECIE.length },
    { id: 'VARIEDAD' as DashboardDimension, label: 'Variedad', icon: Wheat, count: allDimensionsData.VARIEDAD.length },
    { id: 'CLIENTE' as DashboardDimension, label: 'Cliente', icon: Building2, count: allDimensionsData.CLIENTE.length },
    { id: 'CATEGORIA' as DashboardDimension, label: 'Categoría', icon: Tag, count: allDimensionsData.CATEGORIA.length },
    { id: 'TIPO' as DashboardDimension, label: 'Tipo', icon: Package, count: allDimensionsData.TIPO.length },
    { id: 'TRATAMIENTO' as DashboardDimension, label: 'Tratamiento', icon: FlaskConical, count: allDimensionsData.TRATAMIENTO.length },
    { id: 'ESTADO' as DashboardDimension, label: 'Estado', icon: CheckCircle2, count: allDimensionsData.ESTADO.length },
    { id: 'ENVASE' as DashboardDimension, label: 'Envase', icon: Scale, count: allDimensionsData.ENVASE.length },
    { id: 'ALA' as DashboardDimension, label: 'Ubicación', icon: Warehouse, count: allDimensionsData.ALA.length },
  ];

  return (
    <div
      id="lotes-unified-dashboard-container"
      className="bg-white rounded-2xl border border-gray-200/90 shadow-sm overflow-hidden transition-all duration-300 font-sans"
    >
      {/* 1. BARRA SUPERIOR PRINCIPAL DEL DASHBOARD UNIFICADO */}
      <div className="bg-gradient-to-r from-[#00603C] via-[#005233] to-[#254731] text-white p-4 sm:p-5 flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/10 text-amber-300 rounded-xl backdrop-blur-xs border border-white/15 shadow-xs">
            <BarChart2 className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold tracking-tight font-sans text-white">
                Dashboard & Resumen General de Lotes
              </h2>
              {hasActiveFilters ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-full shadow-2xs">
                  <Filter className="w-3 h-3 fill-current" />
                  Filtrado ({activeFiltersCount} activo{activeFiltersCount === 1 ? '' : 's'})
                </span>
              ) : (
                <span className="text-[11px] font-semibold bg-white/15 text-emerald-100 px-2.5 py-0.5 rounded-full border border-white/10">
                  Total Acumulado en Planta
                </span>
              )}
            </div>
            <p className="text-xs text-emerald-100/90 mt-0.5">
              Consolidación interactiva y dinámica de existencias, bolsas, peso y dimensiones operativas.
            </p>
          </div>
        </div>

        {/* Acciones y Controles Rápidos */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Botón Copiar Resumen Ejecutivo */}
          <button
            type="button"
            onClick={handleCopyExecutiveSummary}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/20 transition cursor-pointer shadow-xs active:scale-95"
            title="Copiar texto resumen consolidado para WhatsApp o reportes ejecutivos"
          >
            {copiedSummary ? (
              <>
                <Check className="w-3.5 h-3.5 text-amber-300" />
                <span className="text-amber-300">¡Resumen Copiado!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 text-amber-300" />
                <span>Copiar Resumen</span>
              </>
            )}
          </button>

          {/* Botón Plegar / Desplegar */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white text-[#00603C] hover:bg-emerald-50 rounded-xl transition cursor-pointer shadow-xs"
            title={isExpanded ? 'Plegar desglose analítico' : 'Desplegar desglose analítico completo'}
          >
            <span>{isExpanded ? 'Vista Compacta' : 'Ver Desglose Completo'}</span>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 2. GRID DE METRICAS CLAVE / HERO KPI CARDS */}
      <div className="p-4 sm:p-5 bg-gradient-to-b from-gray-50/70 via-white to-white border-b border-gray-100">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          
          {/* TARJETA 1: BOLSAS PRODUCIDAS / STOCK */}
          <div
            id="kpi-bolsas-producidas"
            className="bg-white p-4 rounded-xl border border-emerald-900/15 shadow-2xs hover:border-[#00603C]/40 hover:shadow-xs transition relative overflow-hidden flex flex-col justify-between"
          >
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#00603C] flex items-center gap-1.5">
                <Package className="w-4 h-4 text-[#00603C]" />
                Bolsas Producidas
              </span>
              <span className="text-[10px] font-mono font-bold text-[#00603C] bg-[#E3EFE7] px-2 py-0.5 rounded-md">
                {lotesList.length} {lotesList.length === 1 ? 'lote' : 'lotes'}
              </span>
            </div>

            <div className="my-1">
              <div className="text-3xl sm:text-4xl font-black font-mono text-gray-900 tracking-tight flex items-baseline gap-1.5">
                <span>{formatNumberArg(totalBolsas, 0)}</span>
                <span className="text-sm font-bold text-gray-500 font-sans">bolsas</span>
              </div>
            </div>

            <div className="pt-2.5 border-t border-gray-100 flex flex-wrap justify-between items-center text-xs text-gray-500 font-medium gap-1">
              <span>Promedio / lote:</span>
              <span className="font-mono font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded">
                ~{promedioBolsasPorLote} b.
              </span>
            </div>
          </div>

          {/* TARJETA 2: KILOGRAMOS Y TONELADAS */}
          <div
            id="kpi-kilos-totales"
            className="bg-white p-4 rounded-xl border border-amber-500/20 shadow-2xs hover:border-amber-500/50 hover:shadow-xs transition relative overflow-hidden flex flex-col justify-between"
          >
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-amber-700" />
                Kilos Totales
              </span>
              <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded-md border border-amber-200">
                {totalTn.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Tn
              </span>
            </div>

            <div className="my-1">
              <div className="text-3xl sm:text-4xl font-black font-mono text-gray-900 tracking-tight flex items-baseline gap-1.5">
                <span>{formatNumberArg(totalKg, 0)}</span>
                <span className="text-sm font-bold text-gray-500 font-sans">kg</span>
              </div>
            </div>

            <div className="pt-2.5 border-t border-gray-100 flex flex-wrap justify-between items-center text-xs text-gray-500 font-medium gap-1">
              <span>Promedio / bolsa:</span>
              <span className="font-mono font-bold text-gray-800 bg-amber-50 text-amber-900 border border-amber-200/60 px-2 py-0.5 rounded">
                {promedioKgPorBolsa} kg
              </span>
            </div>
          </div>

          {/* TARJETA 3: LOTES VISIBLES & DISTRIBUCIÓN POR ALA */}
          <div
            id="kpi-lotes-distribucion-ala"
            className="bg-white p-4 rounded-xl border border-blue-900/15 shadow-2xs hover:border-blue-500/40 hover:shadow-xs transition relative overflow-hidden flex flex-col justify-between"
          >
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Warehouse className="w-4 h-4 text-[#00603C]" />
                Lotes en Vista & Alas
              </span>
              <span className="text-[10px] font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                {((filteredLotes.length / (lotes.length || 1)) * 100).toFixed(0)}% del total
              </span>
            </div>

            <div className="my-1 flex items-baseline gap-1.5">
              <span className="text-3xl sm:text-4xl font-black font-mono text-[#00603C] tracking-tight">
                {filteredLotes.length}
              </span>
              <span className="text-sm font-bold text-gray-500 font-sans">
                / {lotes.length} lotes
              </span>
            </div>

            {/* Chips interactivos de Ala A, B, C, D */}
            <div className="pt-2 border-t border-gray-100 flex items-center gap-1.5 overflow-x-auto">
              {(['A', 'B', 'C', 'D'] as const).map((alaKey) => {
                const count = alasCount[alaKey];
                return (
                  <button
                    key={alaKey}
                    type="button"
                    onClick={() => onQuickFilter && onQuickFilter('ala', alaKey)}
                    className="flex-1 text-center py-1 px-1 rounded-md bg-gray-50 hover:bg-[#E3EFE7] hover:text-[#00603C] border border-gray-200/80 transition cursor-pointer group"
                    title={`Filtrar por Ala ${alaKey} (${count} lotes)`}
                  >
                    <div className="text-[9px] uppercase font-bold text-gray-400 group-hover:text-[#00603C] leading-none">
                      {alaKey}
                    </div>
                    <div className="text-xs font-black font-mono text-gray-800 group-hover:text-[#00603C]">
                      {count}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* TARJETA 4: LISTADO DE IDS DE LOTES VISIBLES & COPIADO */}
          <div
            id="kpi-ids-lotes-visibles"
            className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs hover:border-[#00603C]/40 hover:shadow-xs transition relative overflow-hidden flex flex-col justify-between"
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                <Hash className="w-4 h-4 text-[#00603C]" />
                IDs de Lotes ({lotesList.length})
              </span>

              {lotesList.length > 0 && (
                <button
                  type="button"
                  onClick={handleCopyIds}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-[#00603C] hover:text-white bg-[#E3EFE7] hover:bg-[#00603C] rounded-md transition cursor-pointer shadow-2xs active:scale-95"
                  title="Copiar todos los números de lote visibles al portapapeles"
                >
                  {copiedIds ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>¡Copiados!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copiar IDs</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Chips de Lotes */}
            <div className="my-1">
              {lotesList.length === 0 ? (
                <p className="text-xs text-gray-400 italic py-2">
                  No hay lotes con los filtros aplicados.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pr-0.5">
                  {displayedChips.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectLote && onSelectLote(item.rawLote)}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[11px] font-mono font-bold bg-gray-50 text-gray-800 border border-gray-200/90 hover:border-[#00603C] hover:bg-[#E3EFE7] rounded transition cursor-pointer shadow-2xs group"
                      title={`Lote: ${item.loteNro}\nCliente: ${item.cliente}\nEspecie: ${item.especie} ${item.variedad}\nStock: ${item.stockBolsas} b. (${formatKg(item.stockKg)})\nUbicación: Ala ${item.ala} Sector ${item.sector}`}
                    >
                      <span className="text-[#00603C] font-normal">#</span>
                      <span className="group-hover:text-[#00603C]">{item.loteNro}</span>
                    </button>
                  ))}

                  {!isIdsExpanded && remainingCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsIdsExpanded(true)}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold text-[#00603C] bg-[#E3EFE7] hover:bg-[#C2E0CC] rounded transition cursor-pointer"
                      title="Ver todos los números de lote visibles"
                    >
                      <span>+{remainingCount} más</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500 font-medium">
              <span>{lotesList.length} identificadores</span>
              {lotesList.length > MAX_COLLAPSED_CHIPS && (
                <button
                  type="button"
                  onClick={() => setIsIdsExpanded(!isIdsExpanded)}
                  className="text-[11px] font-bold text-[#00603C] hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <span>{isIdsExpanded ? 'Ver menos' : `Ver todos (${lotesList.length})`}</span>
                  {isIdsExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* 3. DESGLOSE INTERACTIVO ANALÍTICO (EXPANSIBLE / COLAPSABLE) */}
      {isExpanded && (
        <div className="p-4 sm:p-5 space-y-4 bg-white animate-in fade-in duration-200">
          
          {/* BARRA DE NAVEGACIÓN DE DIMENSIONES & CONTROLES DE VISTA */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-gray-100 pb-3">
            
            {/* Pestañas de Selección de Dimensión */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-thin">
              {tabsConfig.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                const isFiltered =
                  activeFilterDimensions &&
                  ((tab.id === 'ESPECIE' && activeFilterDimensions.ESPECIE) ||
                    (tab.id === 'VARIEDAD' && activeFilterDimensions.VARIEDAD) ||
                    (tab.id === 'CLIENTE' && activeFilterDimensions.CLIENTE) ||
                    (tab.id === 'CATEGORIA' && activeFilterDimensions.CATEGORIA) ||
                    (tab.id === 'TIPO' && activeFilterDimensions.TIPO) ||
                    (tab.id === 'TRATAMIENTO' && activeFilterDimensions.TRATAMIENTO) ||
                    (tab.id === 'ESTADO' && activeFilterDimensions.ESTADO) ||
                    (tab.id === 'ALA' && activeFilterDimensions.ALA));

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.id);
                      setSearchBreakdown('');
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer shrink-0 relative ${
                      isActive
                        ? 'bg-[#00603C] text-white shadow-xs'
                        : isFiltered
                        ? 'bg-emerald-50 text-[#00603C] border border-[#00603C]/30 hover:bg-emerald-100'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900 border border-gray-200/70'
                    }`}
                  >
                    <Icon
                      className={`w-3.5 h-3.5 ${
                        isActive ? 'text-amber-300' : isFiltered ? 'text-[#00603C]' : 'text-gray-500'
                      }`}
                    />
                    <span>{tab.label}</span>
                    {isFiltered && !isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    )}
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : isFiltered
                          ? 'bg-[#00603C]/15 text-[#00603C]'
                          : 'bg-gray-200/80 text-gray-700'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Controles de Búsqueda Interna, Orden y Formato de Vista */}
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {/* Buscador dentro del desglose */}
              <div className="relative min-w-[160px] sm:min-w-[200px]">
                <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-gray-400 pointer-events-none">
                  <Search className="w-3.5 h-3.5" />
                </span>
                <input
                  type="text"
                  value={searchBreakdown}
                  onChange={(e) => setSearchBreakdown(e.target.value)}
                  placeholder={`Buscar ${activeTab.toLowerCase()}...`}
                  className="w-full pl-8 pr-7 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-[#00603C] focus:ring-1 focus:ring-[#00603C] outline-none transition"
                />
                {searchBreakdown && (
                  <button
                    type="button"
                    onClick={() => setSearchBreakdown('')}
                    className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Selector de Ordenamiento */}
              <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-xl p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    if (sortBy === 'kg') setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
                    else {
                      setSortBy('kg');
                      setSortOrder('desc');
                    }
                  }}
                  className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
                    sortBy === 'kg' ? 'bg-white text-[#00603C] shadow-2xs' : 'text-gray-500 hover:text-gray-800'
                  }`}
                  title="Ordenar por Total Kg"
                >
                  Kg {sortBy === 'kg' && (sortOrder === 'desc' ? '↓' : '↑')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (sortBy === 'bolsas') setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
                    else {
                      setSortBy('bolsas');
                      setSortOrder('desc');
                    }
                  }}
                  className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
                    sortBy === 'bolsas' ? 'bg-white text-[#00603C] shadow-2xs' : 'text-gray-500 hover:text-gray-800'
                  }`}
                  title="Ordenar por Bolsas"
                >
                  Bolsas {sortBy === 'bolsas' && (sortOrder === 'desc' ? '↓' : '↑')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (sortBy === 'name') setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
                    else {
                      setSortBy('name');
                      setSortOrder('asc');
                    }
                  }}
                  className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
                    sortBy === 'name' ? 'bg-white text-[#00603C] shadow-2xs' : 'text-gray-500 hover:text-gray-800'
                  }`}
                  title="Ordenar Alfabéticamente"
                >
                  Nombre {sortBy === 'name' && (sortOrder === 'asc' ? 'A-Z' : 'Z-A')}
                </button>
              </div>

              {/* Conmutador Vista Tarjetas / Tabla */}
              <div className="flex items-center gap-0.5 bg-gray-100 p-0.5 rounded-xl border border-gray-200">
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                    viewMode === 'cards'
                      ? 'bg-white text-[#00603C] shadow-2xs'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                  title="Ver como tarjetas interactivas"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                    viewMode === 'table'
                      ? 'bg-white text-[#00603C] shadow-2xs'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                  title="Ver como tabla comparativa"
                >
                  <TableIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* CONTENIDO DEL DESGLOSE SEGÚN MODO DE VISTA */}
          {currentGroups.length === 0 ? (
            <div className="py-8 text-center bg-gray-50/70 rounded-2xl border border-dashed border-gray-200 space-y-2">
              <p className="text-xs font-semibold text-gray-500">
                No hay elementos en <span className="font-bold text-gray-700">"{activeTab}"</span> que coincidan con la búsqueda o filtros activos.
              </p>
              {searchBreakdown && (
                <button
                  type="button"
                  onClick={() => setSearchBreakdown('')}
                  className="text-xs font-bold text-[#00603C] hover:underline"
                >
                  Limpiar búsqueda de dimensión
                </button>
              )}
            </div>
          ) : viewMode === 'cards' ? (
            /* VISTA DE TARJETAS BENTO CON PROPORCIÓN VISUAL */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {currentGroups.map((group) => {
                const pct = totalKg > 0 ? (group.kg / totalKg) * 100 : 0;
                const tn = group.kg / 1000;

                return (
                  <div
                    key={group.id}
                    className="bg-white p-3.5 rounded-xl border border-gray-200/90 hover:border-[#00603C]/50 hover:shadow-xs transition-all flex flex-col justify-between group"
                  >
                    <div>
                      {/* Encabezado de la tarjeta */}
                      <div className="flex justify-between items-start gap-1.5 mb-2">
                        <div className="min-w-0 flex-1">
                          <h4
                            className="text-xs font-extrabold text-gray-900 truncate group-hover:text-[#00603C] transition"
                            title={group.label}
                          >
                            {group.label}
                          </h4>
                          {group.sublabel && (
                            <p className="text-[10px] text-gray-400 font-medium truncate">
                              {group.sublabel}
                            </p>
                          )}
                        </div>
                        <span className="text-[10px] font-mono font-bold text-[#00603C] bg-[#E3EFE7] px-2 py-0.5 rounded-md shrink-0">
                          {group.lotes} {group.lotes === 1 ? 'lote' : 'lotes'}
                        </span>
                      </div>

                      {/* Métricas Principales */}
                      <div className="space-y-1.5 my-2">
                        <div className="flex justify-between items-baseline text-xs">
                          <span className="text-gray-500 font-medium">Bolsas:</span>
                          <span className="font-black text-gray-900 font-mono">
                            {formatNumberArg(group.bolsas, 0)} b.
                          </span>
                        </div>

                        <div className="flex justify-between items-baseline text-xs border-t border-gray-100 pt-1">
                          <span className="text-gray-500 font-medium">Total Peso:</span>
                          <div className="text-right">
                            <span className="font-black text-[#00603C] font-mono block">
                              {formatKg(group.kg)}
                            </span>
                            <span className="text-[10px] font-mono text-gray-400 block">
                              ({tn.toFixed(2)} Tn)
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Barra de Proporción & Acción Rápida */}
                    <div className="pt-2 border-t border-gray-100 space-y-1.5">
                      <div className="flex justify-between items-center text-[10px] text-gray-500 font-mono">
                        <span>Participación:</span>
                        <span className="font-extrabold text-[#00603C]">{pct.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-[#00603C] to-emerald-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(2, pct))}%` }}
                        />
                      </div>

                      {onQuickFilter && (
                        <div className="pt-1 text-right">
                          <button
                            type="button"
                            onClick={() => onQuickFilter(activeTab.toLowerCase(), group.label)}
                            className="text-[10px] font-bold text-gray-400 hover:text-[#00603C] hover:underline transition cursor-pointer"
                          >
                            + Filtrar por {group.label}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* VISTA DE TABLA RESUMEN COMPARATIVA */
            <div className="overflow-x-auto border border-gray-200 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50/80 text-gray-500 border-b border-gray-200 font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Dimensión / {activeTab}</th>
                    <th className="py-2.5 px-3 text-right">Lotes</th>
                    <th className="py-2.5 px-3 text-right">Bolsas</th>
                    <th className="py-2.5 px-3 text-right">Total Kg</th>
                    <th className="py-2.5 px-3 text-right">Toneladas</th>
                    <th className="py-2.5 px-3 text-right">Proporción</th>
                    {onQuickFilter && <th className="py-2.5 px-3 text-center">Acción</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {currentGroups.map((group, idx) => {
                    const pct = totalKg > 0 ? (group.kg / totalKg) * 100 : 0;
                    const tn = group.kg / 1000;

                    return (
                      <tr key={group.id} className="hover:bg-gray-50/80 transition">
                        <td className="py-2 px-3 font-mono text-gray-400">{idx + 1}</td>
                        <td className="py-2 px-3">
                          <span className="font-bold text-gray-900">{group.label}</span>
                          {group.sublabel && (
                            <span className="text-[10px] text-gray-400 block">{group.sublabel}</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-gray-700">
                          {group.lotes}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-gray-900">
                          {formatNumberArg(group.bolsas, 0)} b.
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-extrabold text-[#00603C]">
                          {formatKg(group.kg)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-gray-600 font-semibold">
                          {tn.toFixed(2)} Tn
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            <div className="w-12 bg-gray-100 h-1.5 rounded-full overflow-hidden hidden sm:block">
                              <div
                                className="bg-[#00603C] h-full rounded-full"
                                style={{ width: `${Math.min(100, Math.max(3, pct))}%` }}
                              />
                            </div>
                            <span className="font-mono font-bold text-[#00603C] text-[11px]">
                              {pct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        {onQuickFilter && (
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => onQuickFilter(activeTab.toLowerCase(), group.label)}
                              className="px-2 py-0.5 text-[10px] font-bold text-[#00603C] bg-[#E3EFE7] hover:bg-[#00603C] hover:text-white rounded transition cursor-pointer"
                            >
                              Filtrar
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                {/* Pie de tabla con totales consolidados */}
                <tfoot className="bg-[#00603C]/5 font-bold border-t border-gray-200 text-gray-900">
                  <tr>
                    <td className="py-2.5 px-3" colSpan={2}>
                      Total en Vista ({currentGroups.length} grupos)
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-[#00603C]">{lotesList.length}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-gray-900">
                      {formatNumberArg(totalBolsas, 0)} b.
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-[#00603C]">{formatKg(totalKg)}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{totalTn.toFixed(2)} Tn</td>
                    <td className="py-2.5 px-3 text-right font-mono text-[#00603C]">100%</td>
                    {onQuickFilter && <td className="py-2.5 px-3" />}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
