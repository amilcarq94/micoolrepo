/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Lote, SalidaRegistrada, SiloId, MovimientoSilo, CAPACIDAD_MAX_SILO, SILOS_PHYSICAL_ORDER } from '../types';
import { SiloIcon } from './Logo';
import { formatNumberArg } from '../utils/formatters';
import { getPreviousCampaniaId, getCampaniaIdFromDate } from '../utils/campanias';
import {
  Layers,
  Users,
  TrendingUp,
  TrendingDown,
  Inbox,
  ArrowDownRight,
  Plus,
  Upload,
  Settings,
  AlertTriangle,
  Sliders,
  Bell,
  Search,
  X,
  Clock,
  Calendar,
  Scale,
  Minus,
  Warehouse,
  Factory,
  ArrowUpRight,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  Coins
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar
} from 'recharts';
import { StockAlertsConfigModal } from './StockAlertsConfigModal';
import { DashboardAnalitico } from './DashboardAnalitico';
import { StockThresholdsConfigSection } from './StockThresholdsConfigSection';
import { Smartphone } from 'lucide-react';

interface DashboardProps {
  lotes: Lote[];
  salidas: SalidaRegistrada[];
  especies: string[];
  thresholds: Record<string, number>;
  alertEmail: string;
  activeCampaniaId?: string;
  allLotes?: Lote[];
  siloStocks?: Record<SiloId, number>;
  movimientosSilo?: MovimientoSilo[];
  onUpdateThresholds: (newThresholds: Record<string, number>, email: string) => void;
  onNavigate: (view: 'lotes' | 'alta-lote' | 'importar' | 'registrar-salida' | 'salidas-registradas' | 'ingreso-silos' | 'modo-planta') => void;
  onSelectLote?: (lote: Lote) => void;
}

const CustomPieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[#1A1A1A] text-white p-3 rounded-xl border border-gray-800 text-xs shadow-xl font-sans text-left">
        <p className="font-bold text-[#C9922E] uppercase tracking-wider mb-1.5">{data.name}</p>
        <p className="flex justify-between gap-6 my-0.5">
          <span className="text-gray-400 font-medium">Stock en Planta:</span>
          <span className="font-mono font-bold text-white">{formatNumberArg(data.value, 0)} kg</span>
        </p>
        <p className="flex justify-between gap-6">
          <span className="text-gray-400 font-medium">Equivalente:</span>
          <span className="font-mono font-bold text-[#E3EFE7]">{formatNumberArg(data.bolsas, 0)} b.</span>
        </p>
      </div>
    );
  }
  return null;
};

const CustomExitsTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[#1A1A1A] text-white p-3 rounded-xl border border-gray-800 text-xs shadow-xl font-sans text-left">
        <p className="font-bold border-b border-gray-800 pb-1.5 mb-1.5 text-gray-300 font-mono">{data.date}</p>
        <p className="flex justify-between gap-6 my-0.5">
          <span className="text-gray-400 font-medium">Despacho Total:</span>
          <span className="font-mono font-bold text-[#C9922E]">{formatNumberArg(data.kg, 0)} kg</span>
        </p>
        <p className="flex justify-between gap-6">
          <span className="text-gray-400 font-medium">Cantidad Envases:</span>
          <span className="font-mono font-bold text-white">{formatNumberArg(data.bolsas, 0)} bolsas</span>
        </p>
      </div>
    );
  }
  return null;
};

const CustomBarTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[#1A1A1A] text-white p-3 rounded-xl border border-gray-800 text-xs shadow-xl font-sans text-left">
        <p className="font-bold text-[#C9922E] uppercase tracking-wider mb-1.5">{data.name}</p>
        <p className="flex justify-between gap-6 my-0.5">
          <span className="text-gray-400 font-medium font-sans">Stock Total:</span>
          <span className="font-mono font-bold text-white">{formatNumberArg(data.value, 0)} kg</span>
        </p>
        <p className="flex justify-between gap-6">
          <span className="text-gray-400 font-medium font-sans">Cantidad Bolsas:</span>
          <span className="font-mono font-bold text-[#E3EFE7]">{formatNumberArg(data.bolsas, 0)} b.</span>
        </p>
      </div>
    );
  }
  return null;
};

const CustomMonthlyTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[#1A1A1A] text-white p-3 rounded-xl border border-gray-800 text-xs shadow-xl font-sans text-left">
        <p className="font-bold text-[#C9922E] uppercase tracking-wider mb-1.5">{data.label}</p>
        <p className="flex justify-between gap-6 my-0.5">
          <span className="text-gray-400 font-medium font-sans">Volumen Despachado:</span>
          <span className="font-mono font-bold text-white">{formatNumberArg(data.kg, 0)} kg</span>
        </p>
        <p className="flex justify-between gap-6">
          <span className="text-gray-400 font-medium font-sans">Bolsas Despachadas:</span>
          <span className="font-mono font-bold text-[#E3EFE7]">{formatNumberArg(data.bolsas, 0)} b.</span>
        </p>
      </div>
    );
  }
  return null;
};

export const Dashboard: React.FC<DashboardProps> = ({
  lotes,
  salidas,
  especies,
  thresholds,
  alertEmail,
  activeCampaniaId,
  siloStocks,
  movimientosSilo,
  onUpdateThresholds,
  onNavigate,
  onSelectLote,
}) => {
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [subView, setSubView] = useState<'operativo' | 'analitico' | 'configuracion'>('operativo');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchContainerRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Matching logic
  const filteredLotes = React.useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return lotes.filter(lote => {
      const matchClient = lote.cliente.toLowerCase().includes(q);
      const matchId = lote.id.toLowerCase().includes(q);
      const last4 = lote.id.slice(-4);
      const matchLast4 = last4.includes(q);
      
      return matchClient || matchId || matchLast4;
    });
  }, [searchQuery, lotes]);

  // 1. Cálculos de KPIs de Lotes y Silos
  const totalBolsas = lotes.reduce((acc, l) => acc + l.stockBolsas, 0);
  const totalKgLotes = lotes.reduce((acc, l) => acc + l.stockKg, 0);
  const totalKg = totalKgLotes;
  const lotesActivos = lotes.filter(l => l.stockBolsas > 0).length;
  
  const clientesDistintos = Array.from(new Set(lotes.map(l => l.cliente.trim()))).filter(Boolean).length;

  // Cálculo de Stock de Silos (Stock Actual = Ingresos - Egresos)
  const defaultSiloStocks: Record<SiloId, number> = {
    'Silo 1': 0,
    'Silo 2': 0,
    'Silo 3': 0,
    'Silo 4': 0,
    'Silo 5': 0,
    'Silo 6': 0,
  };
  const activeSiloStocks = siloStocks || defaultSiloStocks;
  const totalKgSilos = (Object.values(activeSiloStocks) as number[]).reduce((acc: number, val: number) => acc + (val || 0), 0);

  // Totales acumulados de Ingresos y Egresos en Silos para mostrar la ecuación (Ingresos - Egresos)
  const totalIngresosSilos = (movimientosSilo || [])
    .filter(m => m.tipo === 'INGRESO')
    .reduce((acc, m) => acc + m.kg, 0);

  const totalEgresosSilos = (movimientosSilo || [])
    .filter(m => m.tipo === 'EGRESO_OP' || (m.tipo as string).startsWith('EGRESO'))
    .reduce((acc, m) => acc + m.kg, 0);

  // Stock Consolidado Total en Planta (Galpones/Lotes + Silos)
  const totalConsolidadoPlantaKg = totalKgLotes + totalKgSilos;

  // Calcular stock por especie para determinar cuál tiene mayor stock
  const stockPorEspecie: { [key: string]: { kg: number, bolsas: number } } = {};
  lotes.forEach(l => {
    if (!stockPorEspecie[l.especie]) {
      stockPorEspecie[l.especie] = { kg: 0, bolsas: 0 };
    }
    stockPorEspecie[l.especie].kg += l.stockKg;
    stockPorEspecie[l.especie].bolsas += l.stockBolsas;
  });

  let especieMayorStock = 'Ninguna';
  let mayorStockKg = 0;
  Object.entries(stockPorEspecie).forEach(([especie, info]) => {
    if (info.kg > mayorStockKg) {
      mayorStockKg = info.kg;
      especieMayorStock = especie;
    }
  });

  // Alertas dinámicas basadas en los umbrales configurados
  const alertsList = lotes
    .filter(l => l.stockKg > 0) // Sólo lotes con stock activo
    .map(l => {
      const threshold = thresholds[l.especie] !== undefined ? thresholds[l.especie] : 5000;
      const isCritical = l.stockKg <= threshold;
      const isWarning = !isCritical && l.stockKg <= threshold * 1.25;

      return {
        lote: l,
        threshold,
        isCritical,
        isWarning,
        isActive: isCritical || isWarning
      };
    })
    .filter(a => a.isActive);

  // Separar para fácil visualización
  const lotesCriticosConThreshold = alertsList.filter(a => a.isCritical).map(a => ({
    lote: a.lote,
    threshold: a.threshold
  }));
  const lotesPreventivosConThreshold = alertsList.filter(a => a.isWarning).map(a => ({
    lote: a.lote,
    threshold: a.threshold
  }));

  const lotesCriticos = lotesCriticosConThreshold.map(a => a.lote);
  const lotesPreventivos = lotesPreventivosConThreshold.map(a => a.lote);

  // 2. Preparar datos para Recharts - Distribución por Especie
  const speciesColors: { [key: string]: string } = {
    "Soja": "#00603C",     // Verde institucional
    "Trigo": "#C9922E",    // Dorado/mostaza
    "Arveja": "#A0522D",     // Terracota/óxido
  };

  const speciesChartData = Object.entries(stockPorEspecie)
    .map(([especie, info]) => {
      const color = speciesColors[especie] || "#6B7280";
      return {
        name: especie,
        value: info.kg,
        bolsas: info.bolsas,
        color
      };
    })
    .filter(item => item.value > 0)
    .sort((a, b) => b.value - a.value);

  // Dedicated dataset for the BarChart to compare the three specific species (Soja, Trigo, Arveja)
  const barChartData = ["Soja", "Trigo", "Arveja"].map((especie) => {
    const info = stockPorEspecie[especie] || { kg: 0, bolsas: 0 };
    return {
      name: especie,
      value: info.kg,
      bolsas: info.bolsas,
      color: speciesColors[especie] || "#6B7280"
    };
  });

  // Include any other dynamically created species if they have stock
  Object.entries(stockPorEspecie).forEach(([especie, info]) => {
    if (!["Soja", "Trigo", "Arveja"].includes(especie) && info.kg > 0) {
      barChartData.push({
        name: especie,
        value: info.kg,
        bolsas: info.bolsas,
        color: speciesColors[especie] || "#6B7280"
      });
    }
  });

  // 3. Preparar datos para Recharts - Volumen de salidas diarias (últimos 7 días)
  const last7DaysData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split('T')[0];
    
    // Formato de etiqueta legible, ej: "09 Jul"
    const day = d.getDate();
    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const label = `${day} ${monthNames[d.getMonth()]}`;

    const daySalidas = salidas.filter(s => s.fecha === dateStr);
    const totalKgSalida = daySalidas.reduce((sum, s) => sum + s.totalKg, 0);
    const totalBolsasSalida = daySalidas.reduce((sum, s) => sum + s.cantidadBolsas, 0);

    return {
      date: dateStr,
      label,
      kg: totalKgSalida,
      bolsas: totalBolsasSalida,
    };
  });

  const hasWeeklyExits = last7DaysData.some(d => d.kg > 0);

  // Preparar datos para Recharts - Volumen de salidas mensuales (Productividad de carga)
  const monthlyChartData = React.useMemo(() => {
    const grouped: Record<string, { kg: number; bolsas: number }> = {};
    
    salidas.forEach(s => {
      if (!s.fecha) return;
      const yearMonth = s.fecha.substring(0, 7); // "YYYY-MM"
      if (!grouped[yearMonth]) {
        grouped[yearMonth] = { kg: 0, bolsas: 0 };
      }
      grouped[yearMonth].kg += s.totalKg || 0;
      grouped[yearMonth].bolsas += s.cantidadBolsas || 0;
    });

    // Obtener los meses ordenados cronológicamente
    const sortedMonths = Object.keys(grouped).sort();

    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    return sortedMonths.map(ym => {
      const [year, monthStr] = ym.split('-');
      const mIndex = parseInt(monthStr, 10) - 1;
      const label = `${monthNames[mIndex] || monthStr} ${year.substring(2)}`;
      
      return {
        monthKey: ym,
        label,
        kg: grouped[ym].kg,
        bolsas: grouped[ym].bolsas,
      };
    });
  }, [salidas]);

  // Proyección de Quiebre de Stock (últimos 30 días)
  const proyeccionesStock = React.useMemo(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    // Agrupar salidas de los últimos 30 días por especie
    const salidasPorEspecie30Dias: Record<string, number> = {};
    salidas.forEach(s => {
      if (!s.fecha) return;
      const sDate = new Date(s.fecha + 'T12:00:00');
      if (sDate >= thirtyDaysAgo && sDate <= today) {
        // Encontrar especie del lote
        const lote = lotes.find(l => l.id === s.loteId);
        const especie = lote ? lote.especie : (s.loteId.toLowerCase().includes('soja') ? 'Soja' : (s.loteId.toLowerCase().includes('trigo') ? 'Trigo' : (s.loteId.toLowerCase().includes('arveja') ? 'Arveja' : 'Sin especificar')));
        salidasPorEspecie30Dias[especie] = (salidasPorEspecie30Dias[especie] || 0) + (s.totalKg || 0);
      }
    });

    // Calcular proyección para cada especie
    return especies.map(especie => {
      const currentStockKg = stockPorEspecie[especie]?.kg || 0;
      const salidasKg = salidasPorEspecie30Dias[especie] || 0;
      const ritmoDiarioKg = salidasKg / 30;

      let diasRestantes = Infinity;
      let fechaQuiebreStr = 'Indefinida';
      let estadoProyeccion: 'agotado' | 'critico' | 'preventivo' | 'estable' | 'sin_consumo' = 'estable';

      if (currentStockKg <= 0) {
        diasRestantes = 0;
        fechaQuiebreStr = 'Sin stock';
        estadoProyeccion = 'agotado';
      } else if (ritmoDiarioKg > 0) {
        diasRestantes = currentStockKg / ritmoDiarioKg;
        
        if (diasRestantes === 0) {
          fechaQuiebreStr = 'Agotado';
          estadoProyeccion = 'agotado';
        } else {
          const estimatedDate = new Date();
          estimatedDate.setDate(today.getDate() + Math.ceil(diasRestantes));
          
          const day = estimatedDate.getDate();
          const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
          fechaQuiebreStr = `${day} ${monthNames[estimatedDate.getMonth()]} ${estimatedDate.getFullYear()}`;
          
          if (diasRestantes <= 10) {
            estadoProyeccion = 'critico';
          } else if (diasRestantes <= 30) {
            estadoProyeccion = 'preventivo';
          } else {
            estadoProyeccion = 'estable';
          }
        }
      } else {
        fechaQuiebreStr = 'Indefinida';
        estadoProyeccion = 'sin_consumo';
      }

      return {
        especie,
        stockActual: currentStockKg,
        salidas30Dias: salidasKg,
        ritmoDiario: ritmoDiarioKg,
        diasRestantes,
        fechaQuiebre: fechaQuiebreStr,
        estadoProyeccion
      };
    }).sort((a, b) => {
      const aVal = a.diasRestantes === Infinity ? 999999 : a.diasRestantes;
      const bVal = b.diasRestantes === Infinity ? 999999 : b.diasRestantes;
      return aVal - bVal;
    });
  }, [lotes, salidas, especies, stockPorEspecie]);

  return (
    <div className="space-y-8" id="dashboard-container">
      {/* Saludo y Título de Sección */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-sans font-semibold tracking-widest text-[#C9922E] uppercase">
              MONITOR DE CONTROL · PLANTA
            </span>
            {activeCampaniaId && (
              <span className="inline-flex items-center gap-1 text-[11px] bg-[#E3EFE7] text-[#00603C] px-2.5 py-0.5 rounded-full font-bold border border-[#00603C]/20">
                <Calendar className="w-3 h-3 text-[#C9922E]" />
                Campaña {activeCampaniaId === 'TODAS' ? 'Todas' : activeCampaniaId}
              </span>
            )}
          </div>
          <h2 className="font-serif text-3xl font-bold text-[#1A1A1A] mt-1">
            Resumen General de Operaciones
          </h2>
        </div>

        {/* Accesos Rápidos */}
        <div className="flex flex-wrap gap-2.5">
          <button
            id="btn-shortcut-planta-movil"
            onClick={() => onNavigate('modo-planta')}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold font-sans uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition shadow-sm cursor-pointer"
            title="Acceso Rápido a Planta Móvil"
          >
            <Smartphone className="w-4 h-4 text-emerald-200" />
            Planta Móvil
          </button>

          <button
            id="btn-shortcut-salida"
            onClick={() => onNavigate('registrar-salida')}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold font-sans uppercase tracking-wider bg-[#00603C] text-white rounded-lg hover:bg-[#254731] transition shadow-sm"
          >
            <ArrowDownRight className="w-4 h-4 text-[#C9922E]" />
            Registrar Salida
            <kbd className="hidden sm:inline-block ml-1.5 px-1 py-0.5 text-[9px] bg-[#254731] text-[#E3EFE7] rounded border border-[#254731] font-mono normal-case">Ctrl+S</kbd>
          </button>
          
          <button
            id="btn-shortcut-importar"
            onClick={() => onNavigate('importar')}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold font-sans uppercase tracking-wider bg-white border-2 border-[#00603C] text-[#00603C] rounded-lg hover:bg-[#E3EFE7] transition"
          >
            <Upload className="w-4 h-4" />
            Importar Excel
            <kbd className="hidden sm:inline-block ml-1.5 px-1 py-0.5 text-[9px] bg-[#E3EFE7] text-[#00603C] rounded border border-[#00603C]/30 font-mono normal-case">Ctrl+I</kbd>
          </button>

          <button
            id="btn-shortcut-nuevo"
            onClick={() => onNavigate('alta-lote')}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold font-sans uppercase tracking-wider bg-white border border-gray-200 text-[#1A1A1A] rounded-lg hover:bg-gray-50 transition"
          >
            <Plus className="w-4 h-4 text-[#00603C]" />
            Nuevo Lote
            <kbd className="hidden sm:inline-block ml-1.5 px-1 py-0.5 text-[9px] bg-gray-100 text-gray-500 rounded border border-gray-200 font-mono normal-case">Ctrl+N</kbd>
          </button>
        </div>
      </div>

      {/* Selector de Pestaña del Dashboard */}
      <div className="flex border-b border-gray-100 pb-px print:hidden flex-wrap">
        <button
          onClick={() => setSubView('operativo')}
          className={`py-3 px-6 text-xs font-sans font-bold tracking-wider uppercase border-b-2 transition-all duration-300 ${
            subView === 'operativo'
              ? 'border-[#00603C] text-[#00603C] font-extrabold'
              : 'border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-200'
          }`}
        >
          Vista General
        </button>
        <button
          onClick={() => setSubView('analitico')}
          className={`py-3 px-6 text-xs font-sans font-bold tracking-wider uppercase border-b-2 transition-all duration-300 flex items-center gap-1.5 ${
            subView === 'analitico'
              ? 'border-[#00603C] text-[#00603C] font-extrabold'
              : 'border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-200'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5 animate-pulse" />
          Dashboard Analítico
        </button>
        <button
          id="btn-tab-configuracion-umbrales"
          onClick={() => setSubView('configuracion')}
          className={`py-3 px-6 text-xs font-sans font-bold tracking-wider uppercase border-b-2 transition-all duration-300 flex items-center gap-1.5 ${
            subView === 'configuracion'
              ? 'border-[#00603C] text-[#00603C] font-extrabold'
              : 'border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-200'
          }`}
        >
          <Sliders className="w-3.5 h-3.5 text-[#C9922E]" />
          Configuración Umbrales
        </button>
      </div>

      {subView === 'configuracion' ? (
        <StockThresholdsConfigSection
          especies={especies}
          thresholds={thresholds}
          alertEmail={alertEmail}
          lotes={lotes}
          onSave={(newThresholds, newEmail) => {
            onUpdateThresholds(newThresholds, newEmail);
          }}
          onCancel={() => setSubView('operativo')}
        />
      ) : subView === 'analitico' ? (
        <DashboardAnalitico lotes={lotes} />
      ) : (
        <>
          {/* Buscador Predictivo */}
      <div ref={searchContainerRef} className="relative bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-sans font-semibold tracking-wider text-[#00603C] uppercase">
              BÚSQUEDA RÁPIDA DE STOCK
            </span>
            <h3 className="font-serif text-lg font-bold text-[#1A1A1A] mt-0.5">
              Localizador de Lotes Inteligente
            </h3>
          </div>
          <span className="text-[10px] font-medium text-gray-400 hidden sm:inline-block">
            Buscador Predictivo Activado
          </span>
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-[#00603C]" />
          </div>
          <input
            type="text"
            className="block w-full pl-11 pr-11 py-3 bg-gray-50/50 hover:bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00603C] focus:bg-white text-sm placeholder-gray-400 font-medium transition duration-150 ease-in-out"
            placeholder="Ingrese los últimos 4 dígitos del lote (ej: 0001) o el nombre del cliente..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsDropdownOpen(true);
            }}
            onFocus={() => setIsDropdownOpen(true)}
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setIsDropdownOpen(false);
              }}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-[#00603C] transition"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <p className="text-[10.5px] text-gray-500 font-sans">
          💡 <strong>Tip de velocidad:</strong> Ingresando solo los 4 números finales del ID de lote (ej: <span className="font-mono bg-gray-100 px-1 py-0.5 rounded text-gray-700">0001</span>) o parte del nombre del comitente (ej: <span className="font-sans bg-gray-100 px-1 py-0.5 rounded text-gray-700">Pampa</span>) el sistema filtrará al instante.
        </p>

        {/* Dropdown de resultados predictivos */}
        {isDropdownOpen && searchQuery.trim().length > 0 && (
          <div className="absolute left-0 right-0 mt-2 bg-white rounded-xl border border-gray-100 shadow-2xl z-40 max-h-[320px] overflow-y-auto divide-y divide-gray-50 animate-in fade-in slide-in-from-top-2 duration-150">
            {filteredLotes.length > 0 ? (
              filteredLotes.map((lote) => {
                const isCritical = thresholds[lote.especie] !== undefined && lote.stockKg <= thresholds[lote.especie];
                const isWarning = !isCritical && thresholds[lote.especie] !== undefined && lote.stockKg <= thresholds[lote.especie] * 1.25;

                return (
                  <button
                    key={lote.id}
                    onClick={() => {
                      if (onSelectLote) {
                        onSelectLote(lote);
                      }
                      setSearchQuery('');
                      setIsDropdownOpen(false);
                    }}
                    className="w-full text-left p-3.5 hover:bg-[#E3EFE7]/30 transition duration-150 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm text-[#00603C] bg-[#E3EFE7] px-2 py-0.5 rounded">
                          {lote.id}
                        </span>
                        <span className="text-xs font-semibold text-gray-800">
                          {lote.cliente}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded font-medium">
                          {lote.especie} · {lote.variedad}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-500 flex items-center gap-1.5">
                        <span>Tipo: <strong className="text-gray-700 font-semibold">{lote.tipo}</strong></span>
                        <span>•</span>
                        <span>Tratamiento: <strong className="text-gray-700 font-semibold">{lote.tratamiento.join(', ') || 'Sin Tratar'}</strong></span>
                      </div>
                    </div>

                    <div className="text-left sm:text-right flex sm:flex-col justify-between sm:justify-center items-center sm:items-end shrink-0 border-t sm:border-t-0 border-gray-100 pt-1.5 sm:pt-0">
                      <div className="text-xs font-bold text-gray-900">
                        {formatNumberArg(lote.stockBolsas, 0)} bolsas <span className="text-[10px] text-gray-400 font-normal">({formatNumberArg(lote.stockKg, 0)} kg)</span>
                      </div>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                          lote.estado === 'Agotado'
                            ? 'bg-red-100 text-red-700'
                            : isCritical
                            ? 'bg-red-100 text-[#A0522D]'
                            : isWarning
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {lote.estado === 'Agotado' ? 'Agotado' : isCritical ? 'Bajo Stock' : isWarning ? 'Alerta' : 'Disponible'}
                      </span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-6 text-center text-gray-500 text-sm flex flex-col items-center justify-center gap-1.5">
                <span className="text-xl">🔍</span>
                <span className="font-medium">No se encontraron lotes coincidentes</span>
                <span className="text-xs text-gray-400">Verifique el ID del lote o el nombre del cliente e intente nuevamente.</span>
              </div>
            )}
          </div>
        )}
      </div>



      {/* Tarjeta Destacada de Stock Consolidado en Toneladas */}
      <div id="kpi-consolidado-toneladas" className="bg-[#00603C] text-white p-6 md:p-8 rounded-2xl border border-[#004D30] shadow-xl hover:shadow-2xl transition-all duration-300 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6 text-left">
        {/* Decoración de fondo sutil */}
        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-12 translate-y-12">
          <Warehouse className="w-64 h-64 text-white" />
        </div>
        
        <div className="space-y-1.5 z-10">
          <span className="text-xs font-sans font-bold tracking-widest text-[#C9922E] uppercase block">
            Existencias Globales Consolidadas
          </span>
          <h3 className="font-serif text-xl font-bold text-white tracking-tight flex items-center gap-2">
            Stock Total en Planta (Galpones + Silos)
          </h3>
          <p className="text-xs text-[#E3EFE7] max-w-xl">
            Acopio integral de semilla procesada en galpones ({formatNumberArg(totalKgLotes, 0)} kg) más el acopio real en silos ({formatNumberArg(totalKgSilos, 0)} kg) calculado como <strong>Ingresos - Egresos</strong>.
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-[#004D30]/60">
            <span className="text-[11px] bg-emerald-950/80 text-emerald-200 px-2.5 py-1 rounded-lg border border-emerald-800/50 font-mono">
              Galpones: <strong>{(totalKgLotes / 1000).toFixed(1)} Tn</strong> ({formatNumberArg(totalKgLotes, 0)} kg)
            </span>
            <span className="text-[11px] bg-amber-950/80 text-amber-200 px-2.5 py-1 rounded-lg border border-amber-800/50 font-mono">
              Silos (Stock Real): <strong>{(totalKgSilos / 1000).toFixed(1)} Tn</strong> ({formatNumberArg(totalKgSilos, 0)} kg)
            </span>
            <span className="text-[11px] bg-black/30 text-white/90 px-2.5 py-1 rounded-lg font-mono">
              Fórmula: Stock Silos = Ingresos ({formatNumberArg(totalIngresosSilos, 0)} kg) - Salidas ({formatNumberArg(totalEgresosSilos, 0)} kg)
            </span>
          </div>
        </div>
        
        <div className="flex flex-col items-start md:items-end z-10 shrink-0">
          <div className="font-sans text-5xl md:text-6xl font-black tracking-tighter text-white flex items-baseline gap-2">
            {formatNumberArg(totalConsolidadoPlantaKg / 1000, 2)}
            <span className="text-xl md:text-2xl font-serif text-[#C9922E] font-extrabold lowercase">Tn</span>
          </div>
          <span className="text-[10px] font-mono tracking-wider uppercase text-[#E3EFE7] mt-1 bg-[#254731] px-2.5 py-1 rounded-full border border-[#004D30]/50 font-bold">
            Consolidado Total: {formatNumberArg(totalConsolidadoPlantaKg, 0)} kg
          </span>
        </div>
      </div>

      {/* Grid de KPIs - Tarjetas con fondos blanco puro y sombras elegantes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* KPI 1: Stock en Galpones */}
        <div id="kpi-stock-total" className="bg-white p-5 rounded-2xl border border-gray-100 shadow-md hover:shadow-lg transition-all duration-300 relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3">
            <div className="p-2 bg-[#E3EFE7]/50 rounded-xl text-[#00603C]">
              <Layers className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-semibold text-[#00603C] uppercase tracking-wider bg-[#E3EFE7]/40 px-2 py-0.5 rounded-full">
              GALPONES
            </span>
          </div>
          <div>
            <div className="font-sans text-2xl font-bold text-[#00603C] leading-none mb-1">
              {formatNumberArg(totalKgLotes, 0)} <span className="text-xs font-sans font-medium text-gray-500">kg</span>
            </div>
            <div className="text-xs font-sans font-semibold text-[#C9922E]">
              {formatNumberArg(totalBolsas, 0)} bolsas embolsadas
            </div>
            <div className="text-[11px] font-sans text-gray-400 mt-2">
              Lotes procesados en almacén
            </div>
          </div>
        </div>

        {/* KPI 2: Stock Actual en Silos (Ingreso - Egreso) */}
        <div 
          id="kpi-stock-silos" 
          onClick={() => onNavigate('ingreso-silos')}
          className="bg-gradient-to-br from-amber-50/80 to-white p-5 rounded-2xl border border-amber-200/80 shadow-md hover:shadow-lg transition-all duration-300 relative overflow-hidden flex flex-col justify-between cursor-pointer group"
        >
          <div className="flex justify-between items-start mb-3">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-xl group-hover:scale-105 transition-transform">
              <Warehouse className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider bg-amber-200/60 px-2 py-0.5 rounded-full">
              STOCK EN SILOS
            </span>
          </div>
          <div>
            <div className="font-sans text-2xl font-bold text-amber-950 leading-none mb-1 flex items-baseline gap-1">
              {formatNumberArg(totalKgSilos, 0)} <span className="text-xs font-sans font-medium text-amber-800">kg</span>
            </div>
            <div className="text-xs font-sans font-bold text-amber-700">
              {(totalKgSilos / 1000).toFixed(1)} Tn acopiadas
            </div>
            <div className="text-[10px] font-mono text-amber-900/80 mt-1.5 bg-amber-100/60 px-1.5 py-0.5 rounded border border-amber-200/50">
              Ingresos - Egresos OP
            </div>
          </div>
        </div>

        {/* KPI 3: Lotes Activos */}
        <div id="kpi-lotes-activos" className="bg-white p-5 rounded-2xl border border-gray-100 shadow-md hover:shadow-lg transition-all duration-300 relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3">
            <div className="p-2 bg-[#F6EFDC]/60 rounded-xl text-[#C9922E]">
              <Inbox className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-semibold text-[#C9922E] uppercase tracking-wider bg-[#F6EFDC]/40 px-2 py-0.5 rounded-full">
              LOTES ACTIVOS
            </span>
          </div>
          <div>
            <div className="font-sans text-2xl font-bold text-[#1A1A1A] leading-none mb-1">
              {lotesActivos}
            </div>
            <div className="text-xs font-sans font-semibold text-[#00603C]">
              De {lotes.length} lotes registrados
            </div>
            <div className="text-[11px] font-sans text-gray-400 mt-2">
              Con disponibilidad para despacho
            </div>
          </div>
        </div>

        {/* KPI 4: Cantidad de Clientes */}
        <div id="kpi-clientes-distintos" className="bg-white p-5 rounded-2xl border border-gray-100 shadow-md hover:shadow-lg transition-all duration-300 relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3">
            <div className="p-2 bg-[#E3EFE7]/50 rounded-xl text-[#00603C]">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-semibold text-[#00603C] uppercase tracking-wider bg-[#E3EFE7]/40 px-2 py-0.5 rounded-full">
              COMITENTES
            </span>
          </div>
          <div>
            <div className="font-sans text-2xl font-bold text-[#1A1A1A] leading-none mb-1">
              {clientesDistintos}
            </div>
            <div className="text-xs font-sans font-semibold text-gray-700">
              Clientes activos en planta
            </div>
            <div className="text-[11px] font-sans text-gray-400 mt-2">
              Productores con semilla
            </div>
          </div>
        </div>

        {/* KPI 5: Especie Mayor Stock */}
        <div id="kpi-especie-mayor-stock" className="bg-white p-5 rounded-2xl border border-gray-100 shadow-md hover:shadow-lg transition-all duration-300 relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3">
            <div className="p-2 bg-[#F5E5DC]/70 rounded-xl text-[#A0522D]">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-semibold text-[#A0522D] uppercase tracking-wider bg-[#F5E5DC]/40 px-2 py-0.5 rounded-full">
              PUNTA DE ACOPIO
            </span>
          </div>
          <div>
            <div className="font-sans text-xl font-bold text-[#A0522D] leading-none mb-1 truncate">
              {especieMayorStock}
            </div>
            <div className="text-xs font-sans font-semibold text-gray-700">
              {formatNumberArg(mayorStockKg, 0)} kg en stock
            </div>
            <div className="text-[11px] font-sans text-gray-400 mt-2">
              Mayor volumen en galpón
            </div>
          </div>
        </div>

      </div>

      {/* Sección Resumen de Stock por Silo (Ingreso - Egreso) */}
      <div id="dashboard-silos-summary" className="bg-white rounded-2xl border border-gray-200/80 shadow-md p-6 text-left">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-gray-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                <Warehouse className="w-5 h-5" />
              </div>
              <h3 className="font-serif text-lg font-bold text-gray-900 tracking-tight">
                Estado Actual de Silos de Planta (Ingresos − Egresos)
              </h3>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Stock neto por silo descontando egresos y extracciones para Ordenes de Proceso. Capacidad estándar: 180.000 kg por silo.
            </p>
          </div>

          <button
            onClick={() => onNavigate('ingreso-silos')}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#00603C] hover:bg-[#004D30] text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer shrink-0"
          >
            <span>Gestión Completa de Silos</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {SILOS_PHYSICAL_ORDER.map((siloId) => {
            const stockSiloKg = activeSiloStocks[siloId] || 0;
            let ingKg = 0;
            let egKg = 0;

            if (stockSiloKg > 0) {
              const movsAsc = (movimientosSilo || [])
                .filter((m) => m.siloId === siloId)
                .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

              let currentBalance = 0;
              let lastZeroIndex = -1;
              movsAsc.forEach((m, idx) => {
                if (m.tipo === 'INGRESO') {
                  currentBalance += m.kg;
                } else if (m.tipo === 'EGRESO_OP' || (m.tipo as string).startsWith('EGRESO')) {
                  currentBalance = Math.max(0, currentBalance - m.kg);
                } else if (m.tipo === 'AJUSTE_ZERO') {
                  currentBalance = 0;
                }
                if (currentBalance === 0) {
                  lastZeroIndex = idx;
                }
              });

              const movsBatchActual = movsAsc.slice(lastZeroIndex + 1);
              ingKg = movsBatchActual.filter(m => m.tipo === 'INGRESO').reduce((a, b) => a + b.kg, 0);
              egKg = movsBatchActual.filter(m => m.tipo === 'EGRESO_OP' || (m.tipo as string).startsWith('EGRESO')).reduce((a, b) => a + b.kg, 0);
            }

            const pct = Math.min(100, Math.round((stockSiloKg / CAPACIDAD_MAX_SILO) * 100));
            const isFullAlert = stockSiloKg >= CAPACIDAD_MAX_SILO * 0.95;

            return (
              <div 
                key={siloId}
                onClick={() => onNavigate('ingreso-silos')}
                className={`p-4 rounded-xl border transition-all cursor-pointer hover:shadow-md flex flex-col justify-between gap-3 ${
                  isFullAlert 
                    ? 'bg-red-50/60 border-red-200 hover:border-red-300' 
                    : stockSiloKg > 0 
                      ? 'bg-amber-50/30 border-amber-200/60 hover:border-amber-300' 
                      : 'bg-gray-50/50 border-gray-200/60 hover:border-gray-300'
                }`}
              >
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <SiloIcon size={16} color={stockSiloKg > 0 ? '#00603C' : '#6b7280'} className="shrink-0" />
                      <span className="font-mono text-xs font-black uppercase tracking-wider text-gray-800">
                        {siloId}
                      </span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isFullAlert 
                        ? 'bg-red-100 text-red-700 animate-pulse' 
                        : stockSiloKg > 0 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : 'bg-gray-200 text-gray-600'
                    }`}>
                      {isFullAlert ? '95%+ Lleno' : stockSiloKg > 0 ? 'Con Stock' : 'Vacío'}
                    </span>
                  </div>

                  <div className="font-sans text-xl font-black text-gray-900 leading-tight">
                    {formatNumberArg(stockSiloKg, 0)} <span className="text-xs font-normal text-gray-500">kg</span>
                  </div>
                  <div className="text-[11px] font-mono text-gray-500">
                    {(stockSiloKg / 1000).toFixed(1)} Tn ({pct}%)
                  </div>
                </div>

                {/* Desglose Ingresos vs Egresos */}
                <div className="space-y-1.5 pt-2 border-t border-gray-200/60 text-[10px]">
                  <div className="flex justify-between text-emerald-700 font-mono">
                    <span>+ Ingresos:</span>
                    <strong>{formatNumberArg(ingKg, 0)} kg</strong>
                  </div>
                  <div className="flex justify-between text-amber-800 font-mono">
                    <span>− Salidas OP:</span>
                    <strong>{formatNumberArg(egKg, 0)} kg</strong>
                  </div>
                  {/* Barra de Ocupación */}
                  <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden mt-1">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        isFullAlert ? 'bg-red-500' : stockSiloKg > 0 ? 'bg-[#00603C]' : 'bg-gray-300'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Acciones Rápidas Destacadas */}
      <div id="dashboard-quick-actions" className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-sans font-semibold tracking-widest text-[#00603C] uppercase">
            OPERACIÓN DIRECTA DE PLANTA
          </span>
          <span className="h-px bg-gray-100 flex-grow ml-4"></span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Registrar Salida */}
          <button
            id="quick-card-registrar-salida"
            onClick={() => onNavigate('registrar-salida')}
            className="group relative text-left bg-white hover:bg-[#E3EFE7]/10 p-6 rounded-2xl border border-gray-100 hover:border-[#00603C]/30 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[#00603C] focus:ring-offset-2 flex flex-col justify-between h-40 cursor-pointer"
          >
            <div className="flex justify-between items-start w-full">
              <div className="p-3 bg-[#E3EFE7]/60 rounded-xl text-[#00603C] shadow-sm group-hover:scale-110 transition-transform duration-300">
                <ArrowDownRight className="w-5 h-5 text-[#C9922E]" />
              </div>
              <span className="text-[10px] font-bold text-[#00603C] uppercase tracking-wider bg-[#E3EFE7]/40 px-2.5 py-1 rounded-full">
                DESPACHAR GRANO
              </span>
            </div>
            <div className="mt-3">
              <h4 className="font-serif text-lg font-bold text-[#00603C]">
                Registrar Despacho / Salida
              </h4>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Generar un nuevo remito de salida y descontar bolsas de un lote activo de forma inmediata.
              </p>
            </div>
          </button>

          {/* Card 2: Registrar Nuevo Lote */}
          <button
            id="quick-card-nuevo-lote"
            onClick={() => onNavigate('alta-lote')}
            className="group relative text-left bg-white hover:bg-[#F6EFDC]/15 p-6 rounded-2xl border border-gray-100 hover:border-[#C9922E]/30 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[#C9922E] focus:ring-offset-2 flex flex-col justify-between h-40 cursor-pointer"
          >
            <div className="flex justify-between items-start w-full">
              <div className="p-3 bg-[#F6EFDC]/60 rounded-xl text-[#C9922E] shadow-sm group-hover:scale-110 transition-transform duration-300">
                <Plus className="w-5 h-5 text-[#00603C]" />
              </div>
              <span className="text-[10px] font-bold text-[#C9922E] uppercase tracking-wider bg-[#F6EFDC]/40 px-2.5 py-1 rounded-full">
                NUEVO INGRESO
              </span>
            </div>
            <div className="mt-3">
              <h4 className="font-serif text-lg font-bold text-[#1A1A1A]">
                Registrar Nuevo Lote
              </h4>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Dar de alta un nuevo lote de grano en el sistema, definiendo especie, comitente y tratamiento.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Sección 1: Gráficos Analíticos de Planta (Recharts) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8" id="dashboard-charts-section">
        
        {/* Gráfico 1: Distribución por Especie */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-md flex flex-col h-[380px]">
          <div className="mb-4">
            <span className="text-[10px] font-sans font-semibold tracking-wider text-[#00603C] uppercase">
              REPARTICIÓN DE EXISTENCIAS
            </span>
            <h3 className="font-serif text-lg font-bold text-[#1A1A1A] mt-0.5">
              Distribución de Stock por Especie
            </h3>
          </div>
          
          <div className="flex-grow flex items-center justify-center relative">
            {speciesChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={speciesChartData}
                    cx="50%"
                    cy="45%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {speciesChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => {
                      const item = speciesChartData.find(d => d.name === value);
                      const percentage = totalKg > 0 ? ((item?.value || 0) / totalKg * 100).toFixed(1) : '0';
                      return (
                        <span className="text-xs font-semibold text-gray-700 font-sans">
                          {value} ({percentage}%)
                        </span>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-gray-400 text-xs font-sans">
                Sin existencias registradas para graficar.
              </div>
            )}
          </div>
        </div>

        {/* Gráfico 2: Volumen de Salidas Diarias */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-md flex flex-col h-[380px]">
          <div className="mb-4">
            <span className="text-[10px] font-sans font-semibold tracking-wider text-[#C9922E] uppercase">
              DESPACHO DE MERCADERÍA
            </span>
            <h3 className="font-serif text-lg font-bold text-[#1A1A1A] mt-0.5">
              Volumen de Salidas Diarias (Última Semana)
            </h3>
          </div>
          
          <div className="flex-grow flex items-center justify-center">
            {hasWeeklyExits ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={last7DaysData}
                  margin={{ top: 10, right: 10, left: -5, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorSalidas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00603C" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#00603C" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                  <XAxis 
                    dataKey="label" 
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#6B7280', fontSize: 10, fontWeight: 500 }}
                  />
                  <YAxis 
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#6B7280', fontSize: 10, fontWeight: 500 }}
                    tickFormatter={(val) => `${formatNumberArg(val, 0)} kg`}
                  />
                  <Tooltip content={<CustomExitsTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="kg" 
                    name="Despacho (kg)"
                    stroke="#00603C" 
                    strokeWidth={2.5}
                    fillOpacity={1} 
                    fill="url(#colorSalidas)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12 text-gray-400 text-xs font-sans w-full flex flex-col items-center justify-center gap-2">
                <span className="p-3 bg-[#F6EFDC] rounded-full border border-[#C9922E] border-opacity-10 text-lg">📉</span>
                <span className="font-medium text-gray-600">No se registraron despachos en los últimos 7 días.</span>
                <button
                  onClick={() => onNavigate('registrar-salida')}
                  className="mt-2 px-3.5 py-1.5 bg-[#E3EFE7] hover:bg-emerald-100 text-[#00603C] rounded-lg font-semibold text-[10px] uppercase tracking-wider transition"
                >
                  Registrar Salida Ahora
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Gráfico 3: Volumen Total Despachado por Mes (Productividad de carga) */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-md flex flex-col h-[380px]" id="dashboard-chart-monthly-volume">
          <div className="mb-4">
            <span className="text-[10px] font-sans font-semibold tracking-wider text-[#00603C] uppercase">
              PRODUCTIVIDAD DE CARGA
            </span>
            <h3 className="font-serif text-lg font-bold text-[#1A1A1A] mt-0.5">
              Volumen Despachado Mensual
            </h3>
          </div>
          
          <div className="flex-grow flex items-center justify-center">
            {monthlyChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={monthlyChartData}
                  margin={{ top: 10, right: 10, left: -5, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                  <XAxis 
                    dataKey="label" 
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#6B7280', fontSize: 10, fontWeight: 500 }}
                  />
                  <YAxis 
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#6B7280', fontSize: 10, fontWeight: 500 }}
                    tickFormatter={(val) => `${formatNumberArg(val, 0)} kg`}
                  />
                  <Tooltip content={<CustomMonthlyTooltip />} />
                  <Bar 
                    dataKey="kg" 
                    name="Despachado (kg)"
                    radius={[4, 4, 0, 0]}
                  >
                    {monthlyChartData.map((entry, index) => {
                      const colors = ['#00603C', '#C9922E', '#A0522D'];
                      const barColor = colors[index % colors.length];
                      return <Cell key={`cell-${index}`} fill={barColor} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12 text-gray-400 text-xs font-sans w-full flex flex-col items-center justify-center gap-2">
                <span className="p-3 bg-[#E3EFE7] rounded-full border border-[#00603C] border-opacity-10 text-lg">📊</span>
                <span className="font-medium text-gray-600">No se registraron despachos históricos para graficar.</span>
                <button
                  onClick={() => onNavigate('registrar-salida')}
                  className="mt-2 px-3.5 py-1.5 bg-[#E3EFE7] hover:bg-emerald-100 text-[#00603C] rounded-lg font-semibold text-[10px] uppercase tracking-wider transition"
                >
                  Registrar Salida Ahora
                </button>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Sección: Fechas estimadas de quiebre de stock */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-md space-y-6" id="projection-stockout-section">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-sans font-semibold tracking-widest text-[#00603C] uppercase flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#C9922E]" />
              PROYECCIÓN DE AGOTAMIENTO Y DISPONIBILIDAD
            </span>
            <h3 className="font-serif text-2xl font-bold text-[#1A1A1A] mt-1">
              Fechas Estimadas de Quiebre de Stock
            </h3>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Estimación en tiempo real del tiempo de vida del stock remanente para cada especie, calculada según el ritmo promedio de despacho de los últimos 30 días.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-left border-collapse min-w-[640px]">
            <thead>
              <tr className="bg-gray-50 text-[10px] font-sans font-bold tracking-wider text-gray-400 uppercase border-b border-gray-100">
                <th className="p-4">Especie</th>
                <th className="p-4 text-right">Stock Actual</th>
                <th className="p-4 text-right">Despachos (Últimos 30d)</th>
                <th className="p-4 text-right">Ritmo de Salida Diario</th>
                <th className="p-4 text-center">Días de Autonomía</th>
                <th className="p-4 text-right">Fecha Est. de Quiebre</th>
                <th className="p-4 text-center">Estado de Alerta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {proyeccionesStock.map(({ especie, stockActual, salidas30Dias, ritmoDiario, diasRestantes, fechaQuiebre, estadoProyeccion }) => {
                const color = speciesColors[especie] || "#6B7280";
                
                let badgeClass = "";
                let badgeText = "";
                let alertIcon = null;

                switch (estadoProyeccion) {
                  case 'agotado':
                    badgeClass = "bg-red-50 text-red-700 border border-red-200";
                    badgeText = "Agotado";
                    alertIcon = <TrendingDown className="w-3.5 h-3.5 shrink-0" />;
                    break;
                  case 'critico':
                    badgeClass = "bg-red-50 text-red-600 border border-red-200 animate-pulse";
                    badgeText = "Crítico Inminente";
                    alertIcon = <AlertTriangle className="w-3.5 h-3.5 shrink-0" />;
                    break;
                  case 'preventivo':
                    badgeClass = "bg-amber-50 text-amber-700 border border-amber-200";
                    badgeText = "Atención Intermedia";
                    alertIcon = <Bell className="w-3.5 h-3.5 shrink-0" />;
                    break;
                  case 'estable':
                    badgeClass = "bg-emerald-50 text-emerald-700 border border-emerald-200";
                    badgeText = "Suministro Seguro";
                    alertIcon = <TrendingUp className="w-3.5 h-3.5 shrink-0" />;
                    break;
                  case 'sin_consumo':
                    badgeClass = "bg-gray-50 text-gray-500 border border-gray-200";
                    badgeText = "Sin consumo";
                    alertIcon = <Clock className="w-3.5 h-3.5 shrink-0" />;
                    break;
                }

                return (
                  <tr key={especie} className="hover:bg-gray-50/50 transition duration-150">
                    <td className="p-4 font-semibold text-[#1A1A1A] flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      {especie}
                    </td>
                    <td className="p-4 text-right font-mono font-bold text-gray-900">
                      {formatNumberArg(stockActual, 0)} kg
                    </td>
                    <td className="p-4 text-right font-mono text-gray-600">
                      {formatNumberArg(salidas30Dias, 0)} kg
                    </td>
                    <td className="p-4 text-right font-mono text-[#00603C] font-semibold">
                      {formatNumberArg(ritmoDiario, 1)} kg/día
                    </td>
                    <td className="p-4 text-center font-semibold text-gray-700">
                      {diasRestantes === Infinity ? (
                        <span className="text-gray-400 font-normal">—</span>
                      ) : (
                        <span className={estadoProyeccion === 'critico' ? 'text-red-600 font-bold' : estadoProyeccion === 'preventivo' ? 'text-amber-700' : 'text-gray-800'}>
                          {Math.ceil(diasRestantes)} {Math.ceil(diasRestantes) === 1 ? 'día' : 'días'}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right font-medium">
                      {fechaQuiebre === 'Sin stock' ? (
                        <span className="text-red-500 font-bold">Sin Stock</span>
                      ) : fechaQuiebre === 'Indefinida' ? (
                        <span className="text-gray-400">Sin fecha de corte</span>
                      ) : (
                        <span className={`font-mono font-semibold ${estadoProyeccion === 'critico' ? 'text-red-600' : 'text-gray-800'}`}>
                          {fechaQuiebre}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold ${badgeClass}`}>
                          {alertIcon}
                          {badgeText}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Alerta / Mensaje descriptivo de recomendación */}
        <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
          <div className="space-y-0.5">
            <span className="text-[10px] font-sans font-bold text-gray-400 uppercase tracking-wider block">
              NOTAS SOBRE LA PROYECCIÓN MATEMÁTICA
            </span>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              El cálculo asume que los ritmos de despachos se mantendrán constantes según el patrón histórico de los últimos 30 días. Las proyecciones se actualizan en tiempo real con cada nuevo despacho o entrada de stock.
            </p>
          </div>
          <button
            onClick={() => onNavigate('registrar-salida')}
            className="shrink-0 px-3 py-1.5 bg-[#E3EFE7] hover:bg-emerald-100 text-[#00603C] rounded-lg text-xs font-bold transition flex items-center gap-1.5"
          >
            <Calendar className="w-3.5 h-3.5 text-[#C9922E]" />
            Ver Registros de Salida
          </button>
        </div>
      </div>

      {/* Sección 2: Información Crítica y Detalle Físico */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Detalle Físico de Acopio */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-md">
          <div className="mb-4">
            <span className="text-[10px] font-sans font-semibold tracking-wider text-[#C9922E] uppercase">
              DETALLE FÍSICO POR ESPECIE
            </span>
            <h3 className="font-serif text-xl font-bold text-[#1A1A1A] mt-1">
              Resumen de Acopio por Especie
            </h3>
          </div>

          <div className="space-y-5 mt-6">
            {ESPECIES_MOCK_CHART(stockPorEspecie, totalKg).map(({ especie, kg, bolsas, porcentaje, color }) => (
              <div key={especie} className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-gray-800 font-semibold">{especie}</span>
                  <span className="text-[#1A1A1A]">
                    {formatNumberArg(kg, 0)} kg <span className="text-gray-400 font-normal">({formatNumberArg(bolsas, 0)} b.)</span> — <span className="font-bold text-[#00603C]">{porcentaje}%</span>
                  </span>
                </div>
                {/* Barra de progreso */}
                <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${porcentaje}%`,
                      backgroundColor: color
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>

          {totalKg === 0 && (
            <div className="text-center py-12 text-gray-400 text-xs font-sans">
              No hay stock registrado en el sistema.
            </div>
          )}
        </div>

        {/* Alertas de Stock Crítico y Preventivo */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start gap-4 mb-4">
              <div>
                <span className="text-[10px] font-sans font-semibold tracking-wider text-[#A0522D] uppercase">
                  ALERTAS DE ACOPIO
                </span>
                <h3 className="font-serif text-xl font-bold text-[#1A1A1A] mt-1">
                  Lotes con Stock Mínimo
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSubView('configuracion')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E3EFE7] hover:bg-[#cbe3d3] text-[#00603C] rounded-lg transition text-xs font-bold shadow-sm shrink-0"
                title="Configurar umbrales de alerta de stock mínimo"
              >
                <Sliders className="w-3.5 h-3.5 text-[#C9922E]" />
                <span className="hidden sm:inline">Configurar Umbrales</span>
              </button>
            </div>

            <div className="space-y-3 mt-4 overflow-y-auto max-h-[220px]">
              {alertsList.length > 0 ? (
                alertsList.map(({ lote, threshold, isCritical, isWarning }) => (
                  <div
                    key={lote.id}
                    className={`p-3 rounded-xl border flex justify-between items-center transition text-left ${
                      isCritical
                        ? 'bg-[#F5E5DC] border-[#A0522D] border-opacity-20'
                        : 'bg-amber-50/50 border-amber-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#1A1A1A]">{lote.id}</span>
                        <span
                          className={`px-1.5 py-0.5 text-[8px] font-bold uppercase rounded ${
                            isCritical
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {isCritical ? 'Crítico' : 'Preventivo'}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-500 mt-1">
                        {lote.especie} ({lote.variedad}) · Umbral: {formatNumberArg(threshold, 0)} kg
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-xs font-bold block ${
                          isCritical ? 'text-[#A0522D]' : 'text-amber-800'
                        }`}
                      >
                        {lote.stockBolsas} b.
                      </span>
                      <span className="text-[9px] text-gray-500 block font-mono">
                        {formatNumberArg(lote.stockKg, 0)} kg
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 bg-[#E3EFE7] bg-opacity-40 rounded-xl text-gray-500 text-xs w-full">
                  No hay lotes con existencias bajas o próximas al límite. ¡Todos los stocks están óptimos!
                </div>
              )}
            </div>
          </div>

          {alertsList.length > 0 && (
            <div className="text-[11px] text-[#A0522D] mt-4 bg-amber-50 p-2.5 rounded-lg border border-amber-100 font-sans text-left">
              <strong>Atención:</strong> Se recomienda revisar los lotes marcados como <strong>Crítico</strong> o <strong>Preventivo</strong> y coordinar reposiciones.
            </div>
          )}
        </div>

      </div>
      </>)}

      {/* Modal de Configuración de Alertas */}
      {showConfigModal && (
        <StockAlertsConfigModal
          especies={especies}
          thresholds={thresholds}
          alertEmail={alertEmail}
          onSave={(newThresholds, newEmail) => {
            onUpdateThresholds(newThresholds, newEmail);
            setShowConfigModal(false);
          }}
          onClose={() => setShowConfigModal(false)}
        />
      )}
    </div>
  );
};

// Generador de datos ordenados para gráfico de barras
function ESPECIES_MOCK_CHART(stockInfo: { [key: string]: { kg: number, bolsas: number } }, totalKg: number) {
  const defaultEspecies = ["Soja", "Trigo", "Arveja"];
  const colors = {
    "Soja": "#00603C", // Verde institucional
    "Trigo": "#C9922E", // Dorado/mostaza
    "Arveja": "#A0522D", // Terracota/óxido
  };

  // Combinar especies existentes en mockData con las de default
  const todasEspecies = Array.from(new Set([...defaultEspecies, ...Object.keys(stockInfo)]));

  return todasEspecies.map(especie => {
    const info = stockInfo[especie] || { kg: 0, bolsas: 0 };
    const pct = totalKg > 0 ? Math.round((info.kg / totalKg) * 100) : 0;
    const color = colors[especie as keyof typeof colors] || "#6B6B6B";
    
    return {
      especie,
      kg: info.kg,
      bolsas: info.bolsas,
      porcentaje: pct,
      color
    };
  }).sort((a, b) => b.kg - a.kg);
}
