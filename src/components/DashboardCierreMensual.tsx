/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Lote, SiloId } from '../types';
import { formatKg } from '../utils/formatters';
import {
  BarChart3,
  PieChart as PieIcon,
  Layers,
  Package,
  Download,
  Filter,
  RefreshCw,
  FileSpreadsheet,
  CheckCircle2,
  Building2,
  Calendar,
  Search,
  Award,
  Scale,
  Warehouse,
  TrendingUp,
  SlidersHorizontal,
  ChevronRight,
  Sparkles,
  Info
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Line
} from 'recharts';

interface DashboardCierreMensualProps {
  lotes: Lote[];
  siloStocks?: Record<string, number>;
  onNavigate?: (view: string) => void;
}

// Paleta de colores agrícolas profesional para los gráficos recharts
const CHART_COLORS = [
  '#00603C', // Verde Principal Planta
  '#C9922E', // Dorado / Ámbar
  '#254731', // Verde Robusto
  '#0284C7', // Azul Cielos
  '#D97706', // Naranja Cosecha
  '#059669', // Emerald
  '#7C3AED', // Violeta
  '#DC2626', // Rojo Rubí
  '#475569', // Pizarra
  '#0D9488', // Teal
  '#B45309', // Bronce
  '#4338CA', // Índigo
];

export const DashboardCierreMensual: React.FC<DashboardCierreMensualProps> = ({
  lotes,
  siloStocks,
  onNavigate
}) => {
  // --- Estados de Filtros ---
  const [filtroEstadoReg, setFiltroEstadoReg] = useState<string>('REALIZADO');
  const [filtroEspecie, setFiltroEspecie] = useState<string>('TODAS');
  const [filtroCliente, setFiltroCliente] = useState<string>('TODOS');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('TODAS');
  const [unidadMedida, setUnidadMedida] = useState<'kg' | 'tn' | 'bolsas'>('kg');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'resumen' | 'variedades' | 'categorias'>('resumen');

  // --- Listas para Filtros Unicos ---
  const especiesDisponibles = useMemo(() => {
    const setE = new Set<string>();
    lotes.forEach(l => {
      if (l.especie) setE.add(l.especie);
    });
    return Array.from(setE).sort();
  }, [lotes]);

  const clientesDisponibles = useMemo(() => {
    const setC = new Set<string>();
    lotes.forEach(l => {
      if (l.cliente) {
        const upper = l.cliente.toUpperCase().trim();
        if (upper === 'SAN DIEGO' || upper === 'SAN DIEGO SEMILLA' || upper === 'SAN DIEGO SEMILLAS') {
          setC.add('San Diego Semillas');
        } else {
          setC.add(l.cliente);
        }
      }
    });
    return Array.from(setC).sort();
  }, [lotes]);

  const categoriasDisponibles = useMemo(() => {
    const setCat = new Set<string>();
    lotes.forEach(l => {
      if (l.categoria) setCat.add(l.categoria);
    });
    return Array.from(setCat).sort();
  }, [lotes]);

  // --- Lotes Filtrados ---
  const lotesFiltrados = useMemo(() => {
    return lotes.filter(l => {
      // Estado de Registro
      if (filtroEstadoReg !== 'TODOS' && l.estadoRegistro !== filtroEstadoReg) {
        return false;
      }
      // Especie
      if (filtroEspecie !== 'TODAS' && l.especie !== filtroEspecie) {
        return false;
      }
      // Cliente
      if (filtroCliente !== 'TODOS') {
        const rawCli = l.cliente || '';
        const upper = rawCli.toUpperCase().trim();
        const normCli = (upper === 'SAN DIEGO' || upper === 'SAN DIEGO SEMILLA' || upper === 'SAN DIEGO SEMILLAS') ? 'San Diego Semillas' : rawCli;
        if (normCli !== filtroCliente && rawCli.toLowerCase() !== filtroCliente.toLowerCase()) {
          return false;
        }
      }
      // Categoría
      if (filtroCategoria !== 'TODAS' && l.categoria !== filtroCategoria) {
        return false;
      }
      // Búsqueda por texto libre
      if (searchTerm.trim() !== '') {
        const query = searchTerm.toLowerCase();
        const matchLote = l.loteNro?.toString().toLowerCase().includes(query);
        const matchEsp = l.especie?.toLowerCase().includes(query);
        const matchVar = l.variedad?.toLowerCase().includes(query);
        const matchCli = l.cliente?.toLowerCase().includes(query);
        if (!matchLote && !matchEsp && !matchVar && !matchCli) return false;
      }
      return true;
    });
  }, [lotes, filtroEstadoReg, filtroEspecie, filtroCliente, filtroCategoria, searchTerm]);

  // --- Métricas Globales Consolidadas ---
  const kpis = useMemo(() => {
    let totalKg = 0;
    let totalBolsas = 0;
    const lotesConStock = lotesFiltrados.filter(l => (l.stockKg || 0) > 0);
    const especiesSet = new Set<string>();
    const variedadesSet = new Set<string>();

    lotesConStock.forEach(l => {
      totalKg += l.stockKg || 0;
      totalBolsas += l.stockBolsas || 0;
      if (l.especie) especiesSet.add(l.especie);
      if (l.variedad) variedadesSet.add(`${l.especie} - ${l.variedad}`);
    });

    const totalTn = totalKg / 1000;

    return {
      totalKg,
      totalTn,
      totalBolsas,
      cantLotes: lotesConStock.length,
      cantEspecies: especiesSet.size,
      cantVariedades: variedadesSet.size
    };
  }, [lotesFiltrados]);

  // --- Agrupación por Especie (para Gráfico y Tabla) ---
  const dataPorEspecie = useMemo(() => {
    const map = new Map<string, { especie: string; totalKg: number; totalTn: number; totalBolsas: number; cantLotes: number }>();

    lotesFiltrados.forEach(l => {
      if ((l.stockKg || 0) <= 0) return;
      const esp = l.especie || 'Sin Especie';
      const kg = l.stockKg || 0;
      const bolsas = l.stockBolsas || 0;

      const existing = map.get(esp);
      if (existing) {
        existing.totalKg += kg;
        existing.totalTn += kg / 1000;
        existing.totalBolsas += bolsas;
        existing.cantLotes += 1;
      } else {
        map.set(esp, {
          especie: esp,
          totalKg: kg,
          totalTn: Number((kg / 1000).toFixed(2)),
          totalBolsas: bolsas,
          cantLotes: 1
        });
      }
    });

    const arr = Array.from(map.values()).sort((a, b) => b.totalKg - a.totalKg);
    const totalGlobalKg = kpis.totalKg || 1;

    return arr.map((item, index) => ({
      ...item,
      porcentaje: Number(((item.totalKg / totalGlobalKg) * 100).toFixed(1)),
      valorVisual: unidadMedida === 'tn' ? item.totalTn : unidadMedida === 'bolsas' ? item.totalBolsas : item.totalKg,
      fillColor: CHART_COLORS[index % CHART_COLORS.length]
    }));
  }, [lotesFiltrados, kpis.totalKg, unidadMedida]);

  // --- Agrupación por Variedad (Especie + Variedad) ---
  const dataPorVariedad = useMemo(() => {
    const map = new Map<string, {
      key: string;
      especie: string;
      variedad: string;
      nombreCompleto: string;
      totalKg: number;
      totalTn: number;
      totalBolsas: number;
      cantLotes: number;
    }>();

    lotesFiltrados.forEach(l => {
      if ((l.stockKg || 0) <= 0) return;
      const esp = l.especie || 'Sin Especie';
      const varN = l.variedad || 'Sin Variedad';
      const key = `${esp}___${varN}`;
      const nombreCompleto = `${esp} (${varN})`;
      const kg = l.stockKg || 0;
      const bolsas = l.stockBolsas || 0;

      const existing = map.get(key);
      if (existing) {
        existing.totalKg += kg;
        existing.totalTn += kg / 1000;
        existing.totalBolsas += bolsas;
        existing.cantLotes += 1;
      } else {
        map.set(key, {
          key,
          especie: esp,
          variedad: varN,
          nombreCompleto,
          totalKg: kg,
          totalTn: Number((kg / 1000).toFixed(2)),
          totalBolsas: bolsas,
          cantLotes: 1
        });
      }
    });

    const arr = Array.from(map.values()).sort((a, b) => b.totalKg - a.totalKg);
    const totalGlobalKg = kpis.totalKg || 1;

    return arr.map((item, index) => ({
      ...item,
      porcentaje: Number(((item.totalKg / totalGlobalKg) * 100).toFixed(1)),
      valorVisual: unidadMedida === 'tn' ? item.totalTn : unidadMedida === 'bolsas' ? item.totalBolsas : item.totalKg,
      fillColor: CHART_COLORS[index % CHART_COLORS.length]
    }));
  }, [lotesFiltrados, kpis.totalKg, unidadMedida]);

  // --- Agrupación por Categoría de Semilla ---
  const dataPorCategoria = useMemo(() => {
    const map = new Map<string, { categoria: string; totalKg: number; totalTn: number; totalBolsas: number; cantLotes: number }>();

    lotesFiltrados.forEach(l => {
      if ((l.stockKg || 0) <= 0) return;
      const cat = l.categoria || 'Sin Categoría';
      const kg = l.stockKg || 0;
      const bolsas = l.stockBolsas || 0;

      const existing = map.get(cat);
      if (existing) {
        existing.totalKg += kg;
        existing.totalTn += kg / 1000;
        existing.totalBolsas += bolsas;
        existing.cantLotes += 1;
      } else {
        map.set(cat, {
          categoria: cat,
          totalKg: kg,
          totalTn: Number((kg / 1000).toFixed(2)),
          totalBolsas: bolsas,
          cantLotes: 1
        });
      }
    });

    const arr = Array.from(map.values()).sort((a, b) => b.totalKg - a.totalKg);
    const totalGlobalKg = kpis.totalKg || 1;

    return arr.map((item, index) => ({
      ...item,
      porcentaje: Number(((item.totalKg / totalGlobalKg) * 100).toFixed(1)),
      valorVisual: unidadMedida === 'tn' ? item.totalTn : unidadMedida === 'bolsas' ? item.totalBolsas : item.totalKg,
      fillColor: CHART_COLORS[(index + 3) % CHART_COLORS.length]
    }));
  }, [lotesFiltrados, kpis.totalKg, unidadMedida]);

  // Variedad Top 1 para KPI
  const topVariedad = dataPorVariedad[0] || null;

  // --- Exportación Excel Cierre Mensual ---
  const handleExportarExcelCierre = () => {
    // 1. Hoja Resumen Cierre Mensual
    const summaryRows = dataPorVariedad.map(item => ({
      'Especie': item.especie,
      'Variedad': item.variedad,
      'Lotes Activos': item.cantLotes,
      'Total Bolsas': item.totalBolsas,
      'Total Kilogramos (Kg)': item.totalKg,
      'Total Toneladas (Tn)': Number((item.totalKg / 1000).toFixed(2)),
      'Participación (% Kg)': `${item.porcentaje}%`
    }));

    // Fila Total General
    summaryRows.push({
      'Especie': 'TOTAL GENERAL',
      'Variedad': '—',
      'Lotes Activos': kpis.cantLotes,
      'Total Bolsas': kpis.totalBolsas,
      'Total Kilogramos (Kg)': kpis.totalKg,
      'Total Toneladas (Tn)': Number(kpis.totalTn.toFixed(2)),
      'Participación (% Kg)': '100.0%'
    });

    const summaryWs = XLSX.utils.json_to_sheet(summaryRows);
    summaryWs['!cols'] = [
      { wch: 18 },
      { wch: 22 },
      { wch: 15 },
      { wch: 16 },
      { wch: 22 },
      { wch: 22 },
      { wch: 20 }
    ];

    // 2. Hoja Detalle de Lotes Activos
    const detailRows = lotesFiltrados.map(l => ({
      'N° Lote': l.loteNro,
      'Especie': l.especie || '—',
      'Variedad': l.variedad || '—',
      'Categoría': l.categoria || '—',
      'Cliente': l.cliente || '—',
      'Estado Reg.': l.estadoRegistro || 'REALIZADO',
      'Ubicación Acopio': l.ubicacionAcopio || (l.ala && l.sector ? `Ala ${l.ala} - Sec. ${l.sector}` : '—'),
      'Stock Bolsas': l.stockBolsas || 0,
      'Kg/Bolsa': l.kgPorBolsa || 0,
      'Stock Kg': l.stockKg || 0,
      'Stock Tn': Number(((l.stockKg || 0) / 1000).toFixed(2)),
      'Silo Origen': l.siloOrigen || '—'
    }));

    const detailWs = XLSX.utils.json_to_sheet(detailRows);
    detailWs['!cols'] = [
      { wch: 12 },
      { wch: 16 },
      { wch: 20 },
      { wch: 16 },
      { wch: 22 },
      { wch: 14 },
      { wch: 22 },
      { wch: 14 },
      { wch: 12 },
      { wch: 16 },
      { wch: 14 },
      { wch: 14 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, summaryWs, 'Resumen Cierre');
    XLSX.utils.book_append_sheet(workbook, detailWs, 'Detalle de Lotes');

    const fechaHoy = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Cierre_Mensual_Stock_Especie_Variedad_${fechaHoy}.xlsx`);
  };

  // Formateador dinámico para ejes/tooltips de Recharts
  const formatValueTooltip = (val: number) => {
    if (unidadMedida === 'tn') {
      return `${val.toLocaleString('es-AR', { maximumFractionDigits: 2 })} Tn`;
    }
    if (unidadMedida === 'bolsas') {
      return `${val.toLocaleString('es-AR')} u. bolsas`;
    }
    return formatKg(val);
  };

  // Custom Tooltip Recharts
  const CustomRechartsTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs space-y-1 z-50">
          <p className="font-bold text-amber-300 border-b border-slate-700 pb-1 mb-1 font-serif text-sm">
            {label || data.nombreCompleto || data.especie || data.categoria}
          </p>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-300">Stock (Kg):</span>
            <span className="font-mono font-bold text-emerald-400">{formatKg(data.totalKg)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-300">Stock (Tn):</span>
            <span className="font-mono font-bold text-emerald-300">{data.totalTn?.toLocaleString('es-AR')} Tn</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-300">Total Bolsas:</span>
            <span className="font-mono font-bold text-amber-300">{data.totalBolsas?.toLocaleString('es-AR')} u.</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-300">Cant. Lotes:</span>
            <span className="font-mono font-bold text-slate-200">{data.cantLotes}</span>
          </div>
          <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-800">
            <span className="text-slate-400">Participación:</span>
            <span className="font-mono font-extrabold text-white">{data.porcentaje}%</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-4 md:p-8 bg-[#FBF9F4] min-h-screen space-y-8 animate-in fade-in duration-300">
      
      {/* 1. ENCABEZADO GERENCIAL */}
      <div className="bg-gradient-to-r from-emerald-950 via-[#00603C] to-slate-900 text-white p-6 md:p-8 rounded-3xl shadow-xl border border-emerald-900/40 relative overflow-hidden">
        {/* Adorno visual sutil */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full border border-amber-400/30 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Reporte Ejecutivo de Planta</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-serif font-black tracking-tight text-white">
              Cierre Mensual — Inventario por Especie y Variedad
            </h1>
            <p className="text-xs md:text-sm text-emerald-100 max-w-2xl leading-relaxed">
              Consolidación gráfica en tiempo real de niveles de stock, volumen por semilla y distribución de lotes activos para la toma de decisiones gerenciales.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleExportarExcelCierre}
              className="flex items-center gap-2 px-5 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow-lg transition transform active:scale-95 cursor-pointer"
              title="Exportar Resumen Consolidado y Detalle a Excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-slate-950" />
              <span>Exportar Excel Cierre</span>
            </button>

            {onNavigate && (
              <button
                onClick={() => onNavigate('lotes')}
                className="flex items-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider rounded-2xl border border-white/20 transition cursor-pointer"
              >
                <Layers className="w-4 h-4 text-amber-300" />
                <span>Gestión de Lotes</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. BARRA DE FILTROS Y SELECCIÓN DE UNIDAD */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2 text-slate-800 font-extrabold text-xs uppercase tracking-wider">
            <SlidersHorizontal className="w-4 h-4 text-[#00603C]" />
            <span>Filtros de Análisis Gerencial</span>
          </div>

          {/* Toggle de Unidades */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase px-2">Unidad:</span>
            <button
              onClick={() => setUnidadMedida('kg')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                unidadMedida === 'kg'
                  ? 'bg-[#00603C] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Kilogramos (Kg)
            </button>
            <button
              onClick={() => setUnidadMedida('tn')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                unidadMedida === 'tn'
                  ? 'bg-[#00603C] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Toneladas (Tn)
            </button>
            <button
              onClick={() => setUnidadMedida('bolsas')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                unidadMedida === 'bolsas'
                  ? 'bg-[#00603C] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Bolsas (u.)
            </button>
          </div>
        </div>

        {/* Controles de Filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          
          {/* 1. Estado de Registro */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Estado Registro
            </label>
            <select
              value={filtroEstadoReg}
              onChange={(e) => setFiltroEstadoReg(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#00603C]"
            >
              <option value="TODOS">Todos los Estados</option>
              <option value="REALIZADO">REALIZADO (Pase Final)</option>
              <option value="EN_CURSO">EN CURSO (Parcial)</option>
              <option value="PRECARGA">PRECARGA (Ingreso)</option>
            </select>
          </div>

          {/* 2. Especie */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Especie
            </label>
            <select
              value={filtroEspecie}
              onChange={(e) => setFiltroEspecie(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#00603C]"
            >
              <option value="TODAS">Todas las Especies ({especiesDisponibles.length})</option>
              {especiesDisponibles.map(esp => (
                <option key={esp} value={esp}>{esp}</option>
              ))}
            </select>
          </div>

          {/* 3. Cliente */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Cliente
            </label>
            <select
              value={filtroCliente}
              onChange={(e) => setFiltroCliente(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#00603C]"
            >
              <option value="TODOS">Todos los Clientes ({clientesDisponibles.length})</option>
              {clientesDisponibles.map(cli => (
                <option key={cli} value={cli}>{cli}</option>
              ))}
            </select>
          </div>

          {/* 4. Categoría */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Categoría Semilla
            </label>
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#00603C]"
            >
              <option value="TODAS">Todas las Categorías</option>
              {categoriasDisponibles.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* 5. Búsqueda Libre */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Buscar Lote / Variedad
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Ej. DM46i20, Soja..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-[#00603C]"
              />
            </div>
          </div>

        </div>
      </div>

      {/* 3. METRICAS TARJETAS KPI (SUMARIO CONSOLIDADO) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Total Masa en Stock */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
              Stock Total Planta
            </span>
            <div className="p-2 bg-emerald-50 text-[#00603C] rounded-xl">
              <Scale className="w-5 h-5" />
            </div>
          </div>

          <div>
            <div className="text-2xl font-serif font-black text-slate-900">
              {formatKg(kpis.totalKg)}
            </div>
            <p className="text-xs font-semibold text-emerald-700 mt-0.5 font-mono">
              Equivalente a {kpis.totalTn.toLocaleString('es-AR', { maximumFractionDigits: 1 })} Toneladas
            </p>
          </div>
        </div>

        {/* KPI 2: Total Bolsas */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
              Bolsas en Stock
            </span>
            <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
              <Package className="w-5 h-5" />
            </div>
          </div>

          <div>
            <div className="text-2xl font-serif font-black text-slate-900">
              {kpis.totalBolsas.toLocaleString('es-AR')} u.
            </div>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              En {kpis.cantLotes} lotes activos
            </p>
          </div>
        </div>

        {/* KPI 3: Variedad Principal */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
              Variedad Líder en Stock
            </span>
            <div className="p-2 bg-blue-50 text-blue-700 rounded-xl">
              <Award className="w-5 h-5" />
            </div>
          </div>

          <div>
            <div className="text-lg font-serif font-bold text-slate-900 truncate" title={topVariedad ? topVariedad.nombreCompleto : '—'}>
              {topVariedad ? `${topVariedad.especie} (${topVariedad.variedad})` : 'Sin datos'}
            </div>
            <p className="text-xs font-semibold text-blue-700 mt-0.5 font-mono">
              {topVariedad ? `${formatKg(topVariedad.totalKg)} (${topVariedad.porcentaje}%)` : '—'}
            </p>
          </div>
        </div>

        {/* KPI 4: Diversidad en Planta */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
              Variedad / Especies
            </span>
            <div className="p-2 bg-purple-50 text-purple-700 rounded-xl">
              <BarChart3 className="w-5 h-5" />
            </div>
          </div>

          <div>
            <div className="text-2xl font-serif font-black text-slate-900">
              {kpis.cantVariedades} Variedades
            </div>
            <p className="text-xs font-semibold text-purple-700 mt-0.5">
              Distribuidas en {kpis.cantEspecies} Especies
            </p>
          </div>
        </div>

      </div>

      {/* 4. SECCIÓN PRINCIPAL DE GRÁFICOS RECHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* GRÁFICO 1: Nivel de Stock por Especie (Bar Chart + Composed) */}
        <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-serif font-bold text-slate-900 text-base">
                1. Nivel de Stock por Especie
              </h3>
              <p className="text-xs text-slate-500">
                Volumen acumulado en {unidadMedida === 'tn' ? 'Toneladas (Tn)' : unidadMedida === 'bolsas' ? 'Bolsas (u.)' : 'Kilogramos (Kg)'}
              </p>
            </div>

            <div className="flex items-center gap-1 text-[11px] font-bold text-[#00603C] bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Consolidado Planta</span>
            </div>
          </div>

          {dataPorEspecie.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs">
              <Info className="w-8 h-8 mb-2 opacity-50" />
              <span>No hay datos de stock para los filtros seleccionados.</span>
            </div>
          ) : (
            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataPorEspecie} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis
                    dataKey="especie"
                    tick={{ fontSize: 11, fontWeight: 700, fill: '#334155' }}
                    interval={0}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#64748B' }}
                    tickFormatter={(val) => {
                      if (unidadMedida === 'tn') return `${val} Tn`;
                      if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
                      return `${val}`;
                    }}
                  />
                  <Tooltip content={<CustomRechartsTooltip />} />
                  <Bar dataKey="valorVisual" radius={[8, 8, 0, 0]} maxBarSize={50}>
                    {dataPorEspecie.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.fillColor} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* GRÁFICO 2: Distribución Porcentual del Inventario por Especie (Pie Chart) */}
        <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-serif font-bold text-slate-900 text-base">
              2. Participación por Especie (% del Total)
            </h3>
            <p className="text-xs text-slate-500">
              Proporción sobre la masa total depositada en planta
            </p>
          </div>

          {dataPorEspecie.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs">
              <PieIcon className="w-8 h-8 mb-2 opacity-50" />
              <span>Sin datos para mostrar</span>
            </div>
          ) : (
            <div className="h-72 w-full flex flex-col items-center justify-center">
              <ResponsiveContainer width="100%" height="80%">
                <PieChart>
                  <Pie
                    data={dataPorEspecie}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="totalKg"
                    nameKey="especie"
                  >
                    {dataPorEspecie.map((entry, idx) => (
                      <Cell key={`pie-cell-${idx}`} fill={entry.fillColor} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomRechartsTooltip />} />
                </PieChart>
              </ResponsiveContainer>

              {/* Leyenda Personalizada */}
              <div className="flex flex-wrap items-center justify-center gap-2 mt-2 max-h-16 overflow-y-auto px-2">
                {dataPorEspecie.map((item) => (
                  <div key={item.especie} className="flex items-center gap-1.5 text-[11px]">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.fillColor }} />
                    <span className="font-bold text-slate-700">{item.especie}:</span>
                    <span className="font-mono text-slate-900 font-extrabold">{item.porcentaje}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* 5. GRÁFICO SECUNDARIO: TOP VARIEDADES Y DESGLOSE DETALLADO */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-serif font-bold text-slate-900 text-base">
              3. Desglose de Stock por Variedad
            </h3>
            <p className="text-xs text-slate-500">
              Ranking de variedades activas ordenadas por masa total acumulada
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">
              Mostrando {dataPorVariedad.length} Variedades
            </span>
          </div>
        </div>

        {dataPorVariedad.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-slate-400 text-xs">
            Sin variedades registradas con los filtros actuales.
          </div>
        ) : (
          <div className="h-80 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={dataPorVariedad.slice(0, 12)}
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: '#64748B' }}
                  tickFormatter={(val) => {
                    if (unidadMedida === 'tn') return `${val} Tn`;
                    if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
                    return `${val}`;
                  }}
                />
                <YAxis
                  type="category"
                  dataKey="nombreCompleto"
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#334155' }}
                  width={150}
                />
                <Tooltip content={<CustomRechartsTooltip />} />
                <Bar dataKey="valorVisual" radius={[0, 8, 8, 0]} maxBarSize={24}>
                  {dataPorVariedad.slice(0, 12).map((entry, idx) => (
                    <Cell key={`var-cell-${idx}`} fill={entry.fillColor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* 6. TABLA DETALLADA GERENCIAL DE CIERRE MENSUAL */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
        
        {/* Cabecera Tabla */}
        <div className="p-6 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-300 rounded-2xl border border-amber-400/30">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg leading-tight">
                Tabla Consolidada de Cierre — Especie y Variedad
              </h3>
              <p className="text-xs text-slate-300">
                Resumen gerencial ordenado por volumen para informe de cierre mensual
              </p>
            </div>
          </div>

          <button
            onClick={handleExportarExcelCierre}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#00603C] hover:bg-[#254731] text-white rounded-xl text-xs font-extrabold uppercase tracking-wider transition cursor-pointer shadow-md shrink-0"
          >
            <Download className="w-4 h-4 text-amber-300" />
            <span>Descargar Tabla Excel</span>
          </button>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-extrabold uppercase tracking-wider border-b border-slate-200">
                <th className="p-4">#</th>
                <th className="p-4">Especie</th>
                <th className="p-4">Variedad</th>
                <th className="p-4 text-center">Lotes Activos</th>
                <th className="p-4 text-right">Stock Bolsas</th>
                <th className="p-4 text-right">Stock (Kg)</th>
                <th className="p-4 text-right">Stock (Tn)</th>
                <th className="p-4 text-right">% Participación</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-slate-800">
              {dataPorVariedad.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    No se encontraron registros de stock para los criterios seleccionados.
                  </td>
                </tr>
              ) : (
                dataPorVariedad.map((item, idx) => (
                  <tr key={item.key} className="hover:bg-amber-50/40 transition">
                    <td className="p-4 font-mono font-bold text-slate-400">{idx + 1}</td>
                    <td className="p-4 font-bold text-[#00603C] font-serif">{item.especie}</td>
                    <td className="p-4 font-bold text-slate-900">{item.variedad}</td>
                    <td className="p-4 text-center font-mono font-bold">{item.cantLotes} u.</td>
                    <td className="p-4 text-right font-mono font-bold text-amber-800">
                      {item.totalBolsas.toLocaleString('es-AR')} u.
                    </td>
                    <td className="p-4 text-right font-mono font-black text-slate-900">
                      {formatKg(item.totalKg)}
                    </td>
                    <td className="p-4 text-right font-mono font-bold text-emerald-800">
                      {item.totalTn.toLocaleString('es-AR', { maximumFractionDigits: 2 })} Tn
                    </td>
                    <td className="p-4 text-right font-mono">
                      <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-800 rounded-full text-[11px] font-bold border border-slate-200">
                        {item.porcentaje}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* Fila de Totales Generales */}
            {dataPorVariedad.length > 0 && (
              <tfoot>
                <tr className="bg-slate-900 text-white font-black text-xs uppercase tracking-wider">
                  <td className="p-4 font-mono text-amber-400">∑</td>
                  <td className="p-4 font-serif text-amber-300">TOTAL GENERAL</td>
                  <td className="p-4 text-slate-400">—</td>
                  <td className="p-4 text-center font-mono">{kpis.cantLotes} u.</td>
                  <td className="p-4 text-right font-mono text-amber-300">
                    {kpis.totalBolsas.toLocaleString('es-AR')} u.
                  </td>
                  <td className="p-4 text-right font-mono text-emerald-400 text-sm">
                    {formatKg(kpis.totalKg)}
                  </td>
                  <td className="p-4 text-right font-mono text-emerald-300 text-sm">
                    {kpis.totalTn.toLocaleString('es-AR', { maximumFractionDigits: 2 })} Tn
                  </td>
                  <td className="p-4 text-right font-mono text-amber-300">100.0%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

      </div>

    </div>
  );
};
