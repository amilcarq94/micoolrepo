/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Lote, OrdenProceso, EstadoOrdenProceso } from '../types';
import { formatNumberArg, formatKg } from '../utils/formatters';
import { OrdenProcesoGauge } from './OrdenProcesoGauge';
import { EditarCumplimientoModal } from './EditarCumplimientoModal';
import {
  Factory,
  FlaskConical,
  Calendar,
  Clock,
  Zap,
  TrendingUp,
  Filter,
  RotateCcw,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  Boxes,
  PieChart as PieChartIcon,
  BarChart3,
  Search,
  Scale,
  ChevronRight,
  Info,
  Building2,
  CalendarDays,
  Sparkles,
  Layers,
  Tag,
  Check,
  Target,
  Sliders,
  Save,
  Package,
  SlidersHorizontal,
  AlertCircle
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
  Cell,
  PieChart,
  Pie
} from 'recharts';

interface DashboardReporteProduccionProps {
  lotes: Lote[];
  ordenesProceso?: OrdenProceso[];
  siloStocks?: Record<string, number>;
  onSelectLote?: (lote: Lote) => void;
  onNavigateToSilos?: () => void;
  onSaveOrden?: (ordenActualizada: OrdenProceso) => void;
}

interface OrdenCumplimientoCardProps {
  orden: OrdenProceso;
  onSaveOrden?: (ordenActualizada: OrdenProceso) => void;
  onOpenModal?: (orden: OrdenProceso) => void;
}

const OrdenCumplimientoCard: React.FC<OrdenCumplimientoCardProps> = ({
  orden,
  onSaveOrden,
  onOpenModal,
}) => {
  const [bbPedidos, setBbPedidos] = useState<number>(orden.bbPedidos || 50);
  const [hechos, setHechos] = useState<number>(orden.hechos || 0);
  const [estado, setEstado] = useState<EstadoOrdenProceso>(orden.estado || 'EN CURSO');
  const [synced, setSynced] = useState<boolean>(false);

  useEffect(() => {
    setBbPedidos(orden.bbPedidos || 50);
    setHechos(orden.hechos || 0);
    setEstado(orden.estado || 'EN CURSO');
  }, [orden.bbPedidos, orden.hechos, orden.estado]);

  const currentPct = bbPedidos > 0 ? Math.round((hechos / bbPedidos) * 100) : 0;

  const triggerSave = (newBb: number, newHechos: number, newEstado: EstadoOrdenProceso) => {
    setBbPedidos(newBb);
    setHechos(newHechos);
    setEstado(newEstado);

    if (onSaveOrden) {
      const updated: OrdenProceso = {
        ...orden,
        bbPedidos: Number(newBb) || 1,
        hechos: Number(newHechos) || 0,
        estado: newEstado,
      };
      onSaveOrden(updated);
      setSynced(true);
      setTimeout(() => setSynced(false), 2000);
    }
  };

  const handleBbChange = (val: number) => {
    const safeVal = Math.max(1, val);
    triggerSave(safeVal, hechos, estado);
  };

  const handleHechosChange = (val: number) => {
    const safeVal = Math.max(0, val);
    triggerSave(bbPedidos, safeVal, estado);
  };

  const handlePctChange = (pct: number) => {
    const validPct = Math.max(0, Math.min(200, pct));
    const newHechos = Math.round((validPct * bbPedidos) / 100);
    triggerSave(bbPedidos, newHechos, estado);
  };

  const handleEstadoChange = (newEst: EstadoOrdenProceso) => {
    triggerSave(bbPedidos, hechos, newEst);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all p-5 space-y-4 text-left">
      {/* Top Header of Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 bg-[#00603C] text-white font-mono font-black text-xs rounded-xl shadow-2xs">
            N° {orden.numeroOrden}
          </span>
          {orden.numeroOrdenMovimiento && (
            <span className="px-2 py-0.5 bg-amber-50 text-amber-800 font-mono text-[11px] font-bold rounded-lg border border-amber-200">
              Mov: {orden.numeroOrdenMovimiento}
            </span>
          )}
          <span className="text-xs font-extrabold text-slate-800">
            {orden.cliente || 'Cliente General'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {synced && (
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 animate-in fade-in flex items-center gap-1">
              <Check className="w-3 h-3 text-emerald-600" />
              Sincronizado
            </span>
          )}

          {/* Estado Selector Direct Input */}
          <select
            value={estado}
            onChange={(e) => handleEstadoChange(e.target.value as EstadoOrdenProceso)}
            className={`px-2.5 py-1 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
              estado === 'TERMINADO'
                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                : estado === 'EN CURSO'
                ? 'bg-amber-100 text-amber-900 border-amber-300'
                : 'bg-slate-100 text-slate-700 border-slate-300'
            }`}
          >
            <option value="SIN INICIAR">🔴 SIN INICIAR</option>
            <option value="EN CURSO">🟡 EN CURSO</option>
            <option value="TERMINADO">🟢 TERMINADO</option>
          </select>

          {onOpenModal && (
            <button
              type="button"
              onClick={() => onOpenModal(orden)}
              className="p-1.5 text-slate-400 hover:text-[#00603C] hover:bg-emerald-50 rounded-lg transition cursor-pointer"
              title="Abrir Editor Deslizador Ampliado"
            >
              <Sliders className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Body */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        {/* Specs */}
        <div className="md:col-span-4 space-y-1.5 text-xs">
          <div className="text-slate-800 font-extrabold flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00603C]" />
            <span>{orden.especie || 'Semilla'}</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-600 font-semibold">{orden.variedad || 'Genérica'}</span>
          </div>
          <div className="text-slate-600 font-medium">
            Envase Destino: <strong className="text-slate-900">{orden.envaseDestino || 'Big Bag 1000kg'}</strong>
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            Tipo: {orden.tipoOrden || 'PRODUCCION'} • Fecha: {orden.fechaCreacion || 'Hoy'}
          </div>
        </div>

        {/* Gauge Visual */}
        <div className="md:col-span-3 flex justify-center py-1">
          <OrdenProcesoGauge hechos={hechos} bbPedidos={bbPedidos} size={85} />
        </div>

        {/* DIRECT EDITABLE INPUT FIELDS */}
        <div className="md:col-span-5 bg-slate-50/90 p-3 rounded-xl border border-slate-200 space-y-2">
          <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500 flex items-center justify-between">
            <span>Edición Manual de Cumplimiento</span>
            <span className="text-[#00603C] font-mono font-black text-xs">{currentPct}% Alcanzado</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Input 1: Objetivo Pedido (BB / Bolsas) */}
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">
                Objetivo (Bolsas/BB)
              </label>
              <input
                type="number"
                min="1"
                value={bbPedidos}
                onChange={(e) => handleBbChange(Number(e.target.value))}
                className="w-full px-2.5 py-1 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00603C] focus:border-[#00603C]"
              />
            </div>

            {/* Input 2: Bolsas Vinculadas / Cumplidas (Hechos) */}
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">
                Bolsas Vinculadas
              </label>
              <input
                type="number"
                min="0"
                value={hechos}
                onChange={(e) => handleHechosChange(Number(e.target.value))}
                className="w-full px-2.5 py-1 text-xs font-mono font-bold text-[#00603C] bg-emerald-50/40 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-[#00603C]"
              />
            </div>
          </div>

          {/* Input 3: Porcentaje Directo & Quick Percent Buttons */}
          <div className="pt-1.5 border-t border-slate-200/80 flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-600 uppercase shrink-0">
              % Directo:
            </span>
            <input
              type="number"
              min="0"
              max="200"
              value={currentPct}
              onChange={(e) => handlePctChange(Number(e.target.value))}
              className="w-16 px-2 py-0.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-[#00603C]"
            />
            <div className="flex items-center gap-1 overflow-x-auto">
              {[25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => handlePctChange(pct)}
                  className={`px-1.5 py-0.5 text-[10px] font-mono font-bold rounded transition cursor-pointer ${
                    currentPct === pct
                      ? 'bg-[#00603C] text-white'
                      : 'bg-white border border-slate-200 hover:bg-emerald-50 text-slate-700'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

// Colores agro-industriales
const COLOR_PALETTE = [
  '#00603C', // Verde institucional
  '#C9922E', // Dorado / Ámbar
  '#2E8B57', // Verde Selva
  '#254731', // Verde Robusto
  '#0284C7', // Azul Cielos
  '#D97706', // Naranja Cosecha
  '#8B4513', // Marrón
  '#475569'  // Pizarra
];

// Recharts Custom Tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const kg = data.kgProducidos ?? data.kg ?? data.value ?? 0;
    const bolsas = data.bolsasProducidas ?? data.bolsas ?? 0;

    return (
      <div className="bg-[#1A1A1A] text-white p-3 rounded-xl border border-gray-800 text-xs shadow-2xl font-sans text-left min-w-[180px]">
        <p className="font-bold text-[#C9922E] uppercase tracking-wider mb-2 border-b border-gray-800 pb-1">
          {data.name || label || 'Producción'}
        </p>
        <div className="space-y-1">
          <p className="flex justify-between gap-4">
            <span className="text-gray-400">Total Producido:</span>
            <span className="font-mono font-bold text-emerald-400">{formatNumberArg(kg, 0)} kg</span>
          </p>
          <p className="flex justify-between gap-4">
            <span className="text-gray-400">Toneladas:</span>
            <span className="font-mono font-bold text-amber-300">{(kg / 1000).toFixed(2)} Tn</span>
          </p>
          {bolsas > 0 && (
            <p className="flex justify-between gap-4">
              <span className="text-gray-400">Bolsas:</span>
              <span className="font-mono font-bold text-white">{formatNumberArg(bolsas, 0)}</span>
            </p>
          )}
        </div>
      </div>
    );
  }
  return null;
};

// Helper fecha YYYY-MM-DD
const getFechaStr = (dateVal?: string): string => {
  if (!dateVal) return '';
  if (dateVal.includes('T')) return dateVal.split('T')[0];
  return dateVal.trim();
};

export const DashboardReporteProduccion: React.FC<DashboardReporteProduccionProps> = ({
  lotes,
  ordenesProceso = [],
  siloStocks = {},
  onSelectLote,
  onNavigateToSilos,
  onSaveOrden
}) => {
  // --- Sub-reporte Activo ('clasificacion' | 'curado' | 'cumplimiento') ---
  const [activeSubReporte, setActiveSubReporte] = useState<'clasificacion' | 'curado' | 'cumplimiento'>('clasificacion');

  // --- Fecha de hoy por defecto YYYY-MM-DD ---
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // --- Filtros comunes ---
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string>(todayStr);
  const [filtrarPorFecha, setFiltrarPorFecha] = useState<boolean>(true); // true = fecha específica, false = todo el período
  const [filtroCliente, setFiltroCliente] = useState<string>('TODOS');
  const [filtroEspecie, setFiltroEspecie] = useState<string>('TODAS');
  const [filtroVariedad, setFiltroVariedad] = useState<string>('TODAS');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('TODAS');
  const [filtroLoteId, setFiltroLoteId] = useState<string>('TODOS');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // --- Filtro y estado para Cumplimiento de Órdenes de Proceso ---
  const [filtroEstadoOrden, setFiltroEstadoOrden] = useState<string>('TODAS');
  const [ordenCumplimientoAEditar, setOrdenCumplimientoAEditar] = useState<OrdenProceso | null>(null);

  const ordenesProcesoFiltradas = useMemo(() => {
    return ordenesProceso.filter(o => {
      if (filtroEstadoOrden !== 'TODAS' && o.estado !== filtroEstadoOrden) return false;
      if (filtroCliente !== 'TODOS') {
        const rawCli = o.cliente || '';
        const upper = rawCli.toUpperCase().trim();
        const normCli = (upper === 'SAN DIEGO' || upper === 'SAN DIEGO SEMILLA' || upper === 'SAN DIEGO SEMILLAS') ? 'San Diego Semillas' : rawCli;
        if (normCli !== filtroCliente && rawCli.toLowerCase() !== filtroCliente.toLowerCase()) return false;
      }
      if (filtroEspecie !== 'TODAS' && o.especie !== filtroEspecie) return false;
      if (searchTerm.trim() !== '') {
        const q = searchTerm.toLowerCase();
        const matchNum = (o.numeroOrden || '').toLowerCase().includes(q);
        const matchCli = (o.cliente || '').toLowerCase().includes(q);
        const matchEsp = (o.especie || '').toLowerCase().includes(q);
        const matchVar = (o.variedad || '').toLowerCase().includes(q);
        if (!matchNum && !matchCli && !matchEsp && !matchVar) return false;
      }
      return true;
    });
  }, [ordenesProceso, filtroEstadoOrden, filtroCliente, filtroEspecie, searchTerm]);

  const totalObjetivoBbGlobal = useMemo(() => {
    return ordenesProcesoFiltradas.reduce((acc, o) => acc + (o.bbPedidos || 0), 0);
  }, [ordenesProcesoFiltradas]);

  const totalHechosBbGlobal = useMemo(() => {
    return ordenesProcesoFiltradas.reduce((acc, o) => acc + (o.hechos || 0), 0);
  }, [ordenesProcesoFiltradas]);

  const pctGlobalCumplimiento = totalObjetivoBbGlobal > 0
    ? Math.round((totalHechosBbGlobal / totalObjetivoBbGlobal) * 100)
    : 0;

  // --- Estado de Horas Trabajadas (persistencia por fecha y subreporte en localStorage) ---
  const [horasTrabajadas, setHorasTrabajadas] = useState<number | ''>(() => {
    try {
      const saved = localStorage.getItem(`prod_horas_${activeSubReporte}_${todayStr}`);
      return saved ? Number(saved) : 8;
    } catch {
      return 8;
    }
  });

  // Cargar horas al cambiar fecha o subreporte
  useEffect(() => {
    try {
      const key = `prod_horas_${activeSubReporte}_${fechaSeleccionada}`;
      const saved = localStorage.getItem(key);
      if (saved !== null && saved !== '') {
        setHorasTrabajadas(Number(saved));
      } else {
        setHorasTrabajadas(8);
      }
    } catch {
      // Ignore
    }
  }, [fechaSeleccionada, activeSubReporte]);

  // Guardar horas trabajadas
  const handleHorasChange = (val: number | '') => {
    setHorasTrabajadas(val);
    try {
      const key = `prod_horas_${activeSubReporte}_${fechaSeleccionada}`;
      if (val === '' || isNaN(Number(val))) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, val.toString());
      }
    } catch {
      // Ignore
    }
  };

  // -------------------------------------------------------------
  // 1. Opciones de Filtros Disponibles en todo el universo de lotes
  // -------------------------------------------------------------
  const clientesDisponibles = useMemo(() => {
    const s = new Set<string>();
    lotes.forEach(l => {
      if (l.cliente) {
        const upper = l.cliente.toUpperCase().trim();
        if (upper === 'SAN DIEGO' || upper === 'SAN DIEGO SEMILLA' || upper === 'SAN DIEGO SEMILLAS') {
          s.add('San Diego Semillas');
        } else {
          s.add(l.cliente);
        }
      }
    });
    return Array.from(s).sort();
  }, [lotes]);

  const especiesDisponibles = useMemo(() => {
    const s = new Set<string>();
    lotes.forEach(l => { if (l.especie) s.add(l.especie); });
    return Array.from(s).sort();
  }, [lotes]);

  const variedadesDisponibles = useMemo(() => {
    const s = new Set<string>();
    lotes.forEach(l => {
      if (filtroEspecie !== 'TODAS' && l.especie !== filtroEspecie) return;
      if (l.variedad) s.add(l.variedad);
    });
    return Array.from(s).sort();
  }, [lotes, filtroEspecie]);

  const categoriasDisponibles = useMemo(() => {
    const s = new Set<string>();
    lotes.forEach(l => { if (l.categoria) s.add(l.categoria); });
    return Array.from(s).sort();
  }, [lotes]);

  const lotesDisponibles = useMemo(() => {
    return lotes
      .filter(l => {
        if (filtroCliente !== 'TODOS') {
          const rawCli = l.cliente || '';
          const upper = rawCli.toUpperCase().trim();
          const normCli = (upper === 'SAN DIEGO' || upper === 'SAN DIEGO SEMILLA' || upper === 'SAN DIEGO SEMILLAS') ? 'San Diego Semillas' : rawCli;
          if (normCli !== filtroCliente && rawCli.toLowerCase() !== filtroCliente.toLowerCase()) return false;
        }
        if (filtroEspecie !== 'TODAS' && l.especie !== filtroEspecie) return false;
        if (filtroVariedad !== 'TODAS' && l.variedad !== filtroVariedad) return false;
        return true;
      })
      .sort((a, b) => a.loteNro.localeCompare(b.loteNro));
  }, [lotes, filtroCliente, filtroEspecie, filtroVariedad]);

  // -------------------------------------------------------------
  // 2. SUB-REPORTE 1: CLASIFICACIÓN
  // Lotes con estadoRegistro === 'REALIZADO'
  // -------------------------------------------------------------
  const lotesClasificados = useMemo(() => {
    return lotes.filter(l => {
      // Must be REALIZADO
      if (l.estadoRegistro !== 'REALIZADO') return false;

      // Date filter
      if (filtrarPorFecha) {
        const fechaLote = getFechaStr(l.fechaHoraProduccion) || getFechaStr(l.fechaIngreso);
        if (fechaLote !== fechaSeleccionada) return false;
      }

      // Cliente
      if (filtroCliente !== 'TODOS') {
        const rawCli = l.cliente || '';
        const upper = rawCli.toUpperCase().trim();
        const normCli = (upper === 'SAN DIEGO' || upper === 'SAN DIEGO SEMILLA' || upper === 'SAN DIEGO SEMILLAS') ? 'San Diego Semillas' : rawCli;
        if (normCli !== filtroCliente && rawCli.toLowerCase() !== filtroCliente.toLowerCase()) return false;
      }
      // Especie
      if (filtroEspecie !== 'TODAS' && l.especie !== filtroEspecie) return false;
      // Variedad
      if (filtroVariedad !== 'TODAS' && l.variedad !== filtroVariedad) return false;
      // Categoría
      if (filtroCategoria !== 'TODAS' && l.categoria !== filtroCategoria) return false;
      // Lote opcional
      if (filtroLoteId !== 'TODOS' && l.id !== filtroLoteId && l.loteNro !== filtroLoteId) return false;

      // Text search
      if (searchTerm.trim() !== '') {
        const q = searchTerm.toLowerCase();
        const matchId = (l.loteNro || l.id).toString().toLowerCase().includes(q);
        const matchEsp = l.especie?.toLowerCase().includes(q);
        const matchVar = l.variedad?.toLowerCase().includes(q);
        const matchCli = l.cliente?.toLowerCase().includes(q);
        if (!matchId && !matchEsp && !matchVar && !matchCli) return false;
      }

      return true;
    });
  }, [
    lotes,
    filtrarPorFecha,
    fechaSeleccionada,
    filtroCliente,
    filtroEspecie,
    filtroVariedad,
    filtroCategoria,
    filtroLoteId,
    searchTerm
  ]);

  // -------------------------------------------------------------
  // 3. SUB-REPORTE 2: CURADO
  // Lotes pasados a estado "Tratado" o con tratamiento
  // -------------------------------------------------------------
  const lotesCurados = useMemo(() => {
    return lotes.filter(l => {
      // Must be treated / curado
      const trats = Array.isArray(l.tratamiento) ? l.tratamiento : [l.tratamiento];
      const isTratado = trats.some(t => 
        String(t).toLowerCase() === 'tratado' ||
        String(t).toLowerCase() === 'curado' ||
        (t && t !== 'Sin Tratar' && t !== 'Sin Tratamiento' && t !== 'Ninguno')
      ) || l.estado === 'Tratado';

      if (!isTratado) return false;

      // Date filter (fechaTratamiento or fechaHoraProduccion or fechaIngreso)
      if (filtrarPorFecha) {
        const fechaTrat = getFechaStr(l.fechaTratamiento) || getFechaStr(l.fechaHoraProduccion) || getFechaStr(l.fechaIngreso);
        if (fechaTrat !== fechaSeleccionada) return false;
      }

      // Cliente
      if (filtroCliente !== 'TODOS') {
        const rawCli = l.cliente || '';
        const upper = rawCli.toUpperCase().trim();
        const normCli = (upper === 'SAN DIEGO' || upper === 'SAN DIEGO SEMILLA' || upper === 'SAN DIEGO SEMILLAS') ? 'San Diego Semillas' : rawCli;
        if (normCli !== filtroCliente && rawCli.toLowerCase() !== filtroCliente.toLowerCase()) return false;
      }
      // Especie
      if (filtroEspecie !== 'TODAS' && l.especie !== filtroEspecie) return false;
      // Variedad
      if (filtroVariedad !== 'TODAS' && l.variedad !== filtroVariedad) return false;
      // Categoría
      if (filtroCategoria !== 'TODAS' && l.categoria !== filtroCategoria) return false;
      // Lote opcional
      if (filtroLoteId !== 'TODOS' && l.id !== filtroLoteId && l.loteNro !== filtroLoteId) return false;

      // Text search
      if (searchTerm.trim() !== '') {
        const q = searchTerm.toLowerCase();
        const matchId = (l.loteNro || l.id).toString().toLowerCase().includes(q);
        const matchEsp = l.especie?.toLowerCase().includes(q);
        const matchVar = l.variedad?.toLowerCase().includes(q);
        const matchCli = l.cliente?.toLowerCase().includes(q);
        const matchProd = l.producto?.toLowerCase().includes(q);
        if (!matchId && !matchEsp && !matchVar && !matchCli && !matchProd) return false;
      }

      return true;
    });
  }, [
    lotes,
    filtrarPorFecha,
    fechaSeleccionada,
    filtroCliente,
    filtroEspecie,
    filtroVariedad,
    filtroCategoria,
    filtroLoteId,
    searchTerm
  ]);

  // Selección activa de lote filtrados según subreporte
  const activeLotesFiltrados = activeSubReporte === 'clasificacion' ? lotesClasificados : lotesCurados;

  // KPIs
  const totalKg = useMemo(() => {
    return activeLotesFiltrados.reduce((acc, l) => acc + (l.stockKg || 0), 0);
  }, [activeLotesFiltrados]);

  const totalBolsas = useMemo(() => {
    return activeLotesFiltrados.reduce((acc, l) => acc + (l.stockBolsas || 0), 0);
  }, [activeLotesFiltrados]);

  const totalLotes = activeLotesFiltrados.length;

  const numHoras = typeof horasTrabajadas === 'number' && horasTrabajadas > 0 ? horasTrabajadas : 0;

  // Rendimiento por hora = Total Kg / Horas trabajadas
  const kgPorHora = useMemo(() => {
    if (numHoras <= 0) return 0;
    return Math.round(totalKg / numHoras);
  }, [totalKg, numHoras]);

  const bolsasPorHora = useMemo(() => {
    if (numHoras <= 0) return 0;
    return Math.round(totalBolsas / numHoras);
  }, [totalBolsas, numHoras]);

  // --- Datos para Gráficos (por Especie) ---
  const chartDataEspecie = useMemo(() => {
    const map = new Map<string, { name: string; kg: number; bolsas: number }>();
    activeLotesFiltrados.forEach(l => {
      const esp = l.especie || 'Sin Especie';
      const prev = map.get(esp) || { name: esp, kg: 0, bolsas: 0 };
      map.set(esp, {
        name: esp,
        kg: prev.kg + (l.stockKg || 0),
        bolsas: prev.bolsas + (l.stockBolsas || 0)
      });
    });
    return Array.from(map.values()).sort((a, b) => b.kg - a.kg);
  }, [activeLotesFiltrados]);

  // Fechas que registran actividad en el subreporte
  const fechasConActividad = useMemo(() => {
    const setF = new Set<string>();
    if (activeSubReporte === 'clasificacion') {
      lotes.filter(l => l.estadoRegistro === 'REALIZADO').forEach(l => {
        const f = getFechaStr(l.fechaHoraProduccion) || getFechaStr(l.fechaIngreso);
        if (f) setF.add(f);
      });
    } else {
      lotes.filter(l => l.tratamiento?.includes('Tratado') || l.estado === 'Tratado').forEach(l => {
        const f = getFechaStr(l.fechaTratamiento) || getFechaStr(l.fechaHoraProduccion) || getFechaStr(l.fechaIngreso);
        if (f) setF.add(f);
      });
    }
    return Array.from(setF).sort().reverse();
  }, [lotes, activeSubReporte]);

  // Exportar Excel
  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();

    const titleSub = activeSubReporte === 'clasificacion' ? 'REPORTE DE CLASIFICACIÓN DE SEMILLA' : 'REPORTE DE CURADO Y TRATAMIENTO DE SEMILLA';

    const summaryData = [
      ['PLANTA CLASIFICADORA Y TRATAMIENTO DE SEMILLA - ABACUS AGRO'],
      [titleSub],
      ['Fecha de Emisión:', new Date().toLocaleDateString('es-AR')],
      ['Filtro de Fecha:', filtrarPorFecha ? fechaSeleccionada : 'Todo el Período Histórico'],
      ['Cliente:', filtroCliente],
      ['Especie:', filtroEspecie],
      ['Variedad:', filtroVariedad],
      ['Categoría:', filtroCategoria],
      ['Horas Trabajadas:', numHoras],
      ['Total Kilos:', totalKg],
      ['Total Bolsas:', totalBolsas],
      ['Total Lotes:', totalLotes],
      [activeSubReporte === 'clasificacion' ? 'Kg Producidos / Hora:' : 'Kg Tratados / Hora:', kgPorHora],
      [],
      [
        'N° Lote',
        'Cliente',
        'Especie',
        'Variedad',
        'Categoría',
        'Bolsas',
        'Kg/Bolsa',
        'Total Kg',
        activeSubReporte === 'clasificacion' ? 'Fecha Realización' : 'Fecha Tratamiento',
        'Orden Movimiento',
        'Ubicación'
      ]
    ];

    const rowsData = activeLotesFiltrados.map(l => ({
      'N° Lote': l.loteNro,
      'Cliente': l.cliente,
      'Especie': l.especie,
      'Variedad': l.variedad,
      'Categoría': l.categoria,
      'Bolsas': l.stockBolsas,
      'Kg/Bolsa': l.kgPorBolsa,
      'Total Kg': l.stockKg,
      'Fecha': activeSubReporte === 'clasificacion' ? (getFechaStr(l.fechaHoraProduccion) || l.fechaIngreso) : (getFechaStr(l.fechaTratamiento) || l.fechaIngreso),
      'Orden Movimiento': l.numeroOrdenMovimiento || l.ordenProcesoId || 'N/A',
      'Ubicación': l.ala && l.sector ? `Ala ${l.ala} - Sector ${l.sector}` : (l.ubicacionAcopio || 'Acopio General')
    }));

    const worksheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.sheet_add_json(worksheet, rowsData, { origin: 'A16' });

    XLSX.utils.book_append_sheet(workbook, worksheet, activeSubReporte === 'clasificacion' ? 'Clasificacion' : 'Curado');
    XLSX.writeFile(workbook, `Reporte_${activeSubReporte.toUpperCase()}_${filtrarPorFecha ? fechaSeleccionada : 'Historico'}.xlsx`);
  };

  const resetFilters = () => {
    setFechaSeleccionada(todayStr);
    setFiltrarPorFecha(true);
    setFiltroCliente('TODOS');
    setFiltroEspecie('TODAS');
    setFiltroVariedad('TODAS');
    setFiltroCategoria('TODAS');
    setFiltroLoteId('TODOS');
    setSearchTerm('');
  };

  return (
    <div className="space-y-6 pb-12 font-sans text-left">
      
      {/* ------------------------------------------------------------- */}
      {/* HEADER PRINCIPAL + SELECTOR DE SUB-REPORTE */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-gradient-to-r from-[#00603C] via-[#004D30] to-[#254731] text-white p-6 rounded-2xl shadow-xl border border-emerald-900/40 relative overflow-hidden">
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase bg-amber-400 text-slate-950 shadow-sm">
                Módulo Industrial
              </span>
              <span className="text-xs text-emerald-200 font-medium">
                Gestión de Rendimiento en Planta
              </span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <Factory className="w-8 h-8 text-amber-300" />
              <span>Reporte de Producción</span>
            </h1>
            
            <p className="text-xs sm:text-sm text-emerald-100/90 mt-1 max-w-2xl">
              Monitoreo diario de clasificación y tratamiento de semillas. Ingrese horas trabajadas para calcular el rendimiento por hora.
            </p>
          </div>

          {/* SELECTOR DE SUB-REPORTES (TABS PRINCIPALES) */}
          <div className="flex flex-wrap sm:flex-nowrap bg-slate-950/40 p-1.5 rounded-2xl border border-white/10 backdrop-blur-md shadow-inner shrink-0 w-full sm:w-auto gap-1">
            
            {/* Opción 1: Reporte de Clasificación */}
            <button
              onClick={() => setActiveSubReporte('clasificacion')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-5 py-2.5 sm:py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                activeSubReporte === 'clasificacion'
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black shadow-lg scale-[1.02]'
                  : 'text-emerald-100 hover:text-white hover:bg-white/10'
              }`}
            >
              <Boxes className="w-4 h-4" />
              <span>Clasificación</span>
            </button>

            {/* Opción 2: Reporte de Curado */}
            <button
              onClick={() => setActiveSubReporte('curado')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-5 py-2.5 sm:py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                activeSubReporte === 'curado'
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black shadow-lg scale-[1.02]'
                  : 'text-emerald-100 hover:text-white hover:bg-white/10'
              }`}
            >
              <FlaskConical className="w-4 h-4" />
              <span>Curado</span>
            </button>

          </div>

        </div>

      </div>

      {/* ------------------------------------------------------------- */}
      {/* BARRA DE FILTROS & HORAS TRABAJADAS */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 space-y-4">
        
        {/* Fila Superior: Fecha & Horas Trabajadas */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end pb-4 border-b border-slate-100">
          
          {/* Selector de Fecha */}
          <div className="md:col-span-5 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#00603C]" />
                <span>Fecha del Reporte</span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setFechaSeleccionada(todayStr); setFiltrarPorFecha(true); }}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded transition ${
                    filtrarPorFecha && fechaSeleccionada === todayStr
                      ? 'bg-[#00603C] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Hoy
                </button>
                <button
                  type="button"
                  onClick={() => setFiltrarPorFecha(!filtrarPorFecha)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded transition ${
                    !filtrarPorFecha
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {filtrarPorFecha ? 'Ver Todo el Período' : 'Ver por Fecha Especifica'}
                </button>
              </div>
            </div>

            <input
              type="date"
              value={fechaSeleccionada}
              disabled={!filtrarPorFecha}
              onChange={(e) => {
                setFechaSeleccionada(e.target.value);
                setFiltrarPorFecha(true);
              }}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00603C] disabled:opacity-50 disabled:bg-slate-100"
            />
          </div>

          {/* Campo Editable: Horas Trabajadas */}
          <div className="md:col-span-4 bg-amber-50/80 p-3 rounded-xl border border-amber-200 space-y-1">
            <label className="text-xs font-extrabold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Horas Trabajadas en Jornada</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="24"
                placeholder="Ej: 8"
                value={horasTrabajadas}
                onChange={(e) => handleHorasChange(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-28 px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-sm font-mono font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00603C]"
              />
              <span className="text-xs font-bold text-amber-800">
                horas
              </span>
            </div>
          </div>

          {/* Acciones de exportación y reseteo */}
          <div className="md:col-span-3 flex items-center justify-end gap-2">
            <button
              onClick={resetFilters}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition cursor-pointer"
              title="Restablecer Filtros"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#00603C] hover:bg-[#004D30] text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
              <span>Exportar Excel</span>
            </button>
          </div>

        </div>

        {/* Fila Inferior: Filtros de Cliente, Especie, Variedad, Categoría, Lote (Opcional) y Búsqueda */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
          
          {/* Filtro Cliente */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Cliente
            </label>
            <select
              value={filtroCliente}
              onChange={(e) => setFiltroCliente(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00603C]"
            >
              <option value="TODOS">Todos los Clientes</option>
              {clientesDisponibles.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Filtro Especie */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Especie
            </label>
            <select
              value={filtroEspecie}
              onChange={(e) => {
                setFiltroEspecie(e.target.value);
                setFiltroVariedad('TODAS');
              }}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00603C]"
            >
              <option value="TODAS">Todas las Especies</option>
              {especiesDisponibles.map(e => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>

          {/* Filtro Variedad */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Variedad
            </label>
            <select
              value={filtroVariedad}
              onChange={(e) => setFiltroVariedad(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00603C]"
            >
              <option value="TODAS">Todas las Variedades</option>
              {variedadesDisponibles.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>

          {/* Filtro Categoría */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Categoría
            </label>
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00603C]"
            >
              <option value="TODAS">Todas las Categorías</option>
              {categoriasDisponibles.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Filtro Lote (Opcional) */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Lote (Opcional)
            </label>
            <select
              value={filtroLoteId}
              onChange={(e) => setFiltroLoteId(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00603C]"
            >
              <option value="TODOS">Todos los Lotes</option>
              {lotesDisponibles.map(l => (
                <option key={l.id} value={l.id}>
                  {l.loteNro} ({l.especie})
                </option>
              ))}
            </select>
          </div>

          {/* Búsqueda por Texto */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Buscar por Texto
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="N° Lote, Cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00603C]"
              />
            </div>
          </div>

        </div>

        {/* Acceso Rápido a Fechas con Actividad */}
        {fechasConActividad.length > 0 && (
          <div className="flex items-center gap-2 pt-2 text-xs border-t border-slate-100 overflow-x-auto pb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0 flex items-center gap-1">
              <CalendarDays className="w-3.5 h-3.5 text-[#00603C]" />
              Fechas con registros:
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              {fechasConActividad.slice(0, 8).map(f => (
                <button
                  key={f}
                  onClick={() => {
                    setFechaSeleccionada(f);
                    setFiltrarPorFecha(true);
                  }}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-mono transition cursor-pointer ${
                    filtrarPorFecha && fechaSeleccionada === f
                      ? 'bg-[#00603C] text-white font-bold shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* ------------------------------------------------------------- */}
      {/* CONTENIDO DEL SUB-REPORTE ACTIVO */}
      {/* ------------------------------------------------------------- */}

      <div className="space-y-6">
        {/* TARJETAS KPI RESUMEN DEL SUB-REPORTE ACTIVO */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* KPI 1: Kilos Totales */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                  {activeSubReporte === 'clasificacion' ? 'Total Kilos Realizados' : 'Total Kilos Tratados'}
                </span>
                <div className="p-2 bg-emerald-50 text-[#00603C] rounded-xl">
                  <Scale className="w-5 h-5" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
                  {formatNumberArg(totalKg, 0)}
                </span>
                <span className="text-xs font-bold text-slate-500">kg</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Equivale a <strong className="text-slate-800 font-mono">{(totalKg / 1000).toFixed(2)} Tn</strong>
              </p>
            </div>

        {/* KPI 2: Bolsas Totales */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
              {activeSubReporte === 'clasificacion' ? 'Total Bolsas Realizadas' : 'Total Bolsas Tratadas'}
            </span>
            <div className="p-2 bg-amber-50 text-[#C9922E] rounded-xl">
              <Boxes className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
              {formatNumberArg(totalBolsas, 0)}
            </span>
            <span className="text-xs font-bold text-slate-500">bolsas</span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            En un total de <strong className="text-slate-800 font-mono">{totalLotes}</strong> lotes.
          </p>
        </div>

        {/* KPI 3: Lotes Totales */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
              {activeSubReporte === 'clasificacion' ? 'Total Lotes Realizados' : 'Total Lotes Tratados'}
            </span>
            <div className="p-2 bg-slate-100 text-slate-700 rounded-xl">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
              {totalLotes}
            </span>
            <span className="text-xs font-bold text-slate-500">lotes</span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            Registrados en el reporte.
          </p>
        </div>

        {/* KPI 4: Rendimiento por Hora (CALCULADO CON HORAS TRABAJADAS) */}
        <div className="bg-gradient-to-br from-[#00603C] to-[#254731] text-white p-5 rounded-2xl border border-emerald-800 shadow-md space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-amber-300 uppercase tracking-widest">
              {activeSubReporte === 'clasificacion' ? 'Kg Producidos / Hora' : 'Kg Tratados / Hora'}
            </span>
            <div className="p-2 bg-amber-400 text-slate-950 rounded-xl shadow-xs">
              <Zap className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-white font-mono">
              {formatNumberArg(kgPorHora, 0)}
            </span>
            <span className="text-xs font-bold text-emerald-200">kg / hr</span>
          </div>
          <p className="text-[11px] text-emerald-100/90 font-medium flex items-center justify-between">
            <span>Rendimiento bolsas:</span>
            <strong className="text-amber-300 font-mono">{formatNumberArg(bolsasPorHora, 0)} b/hr</strong>
          </p>
        </div>

      </div>

      {/* ------------------------------------------------------------- */}
      {/* SECCIÓN GRÁFICA: PRODUCCIÓN / CURADO POR ESPECIE */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Gráfico de Barras por Especie */}
        <div className="lg:col-span-8 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#00603C]" />
                <span>
                  {activeSubReporte === 'clasificacion' ? 'Volumen Clasificado por Especie (Kg)' : 'Volumen Tratado por Especie (Kg)'}
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Distribución en kilos para la fecha o período seleccionado
              </p>
            </div>
          </div>

          {chartDataEspecie.length > 0 ? (
            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartDataEspecie} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="kg" radius={[6, 6, 0, 0]}>
                    {chartDataEspecie.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLOR_PALETTE[index % COLOR_PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-slate-400 text-xs">
              <Boxes className="w-8 h-8 mb-2 stroke-1" />
              <span>Sin datos de {activeSubReporte} para los filtros seleccionados.</span>
            </div>
          )}
        </div>

        {/* Tarjeta Informativa / Métricas Secundarias */}
        <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Detalle del Módulo</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {activeSubReporte === 'clasificacion' ? 'Resumen de lotes clasificados y estado de producción' : 'Resumen de lotes tratados y productos químicos aplicados'}
            </p>

            <div className="mt-4 space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Período de Análisis</span>
                <p className="font-bold text-slate-800">
                  {filtrarPorFecha ? `Jornada ${fechaSeleccionada}` : 'Histórico General'}
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Horas Declaradas</span>
                <p className="font-bold text-[#00603C] font-mono">
                  {numHoras > 0 ? `${numHoras} hrs` : 'Sin horas registradas'}
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Estado Operativo</span>
                <p className="font-bold text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{activeSubReporte === 'clasificacion' ? 'Clasificación Activa' : 'Curado Activo'}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 text-[11px] text-emerald-900 font-medium">
            💡 <strong>Consejo Planta:</strong> Ajuste las <i>Horas Trabajadas</i> al finalizar el turno para obtener el cálculo exacto de rendimiento industrial por hora.
          </div>
        </div>

      </div>

      {/* ------------------------------------------------------------- */}
      {/* TABLA DE DETALLE DE LOTES REALIZADOS / TRATADOS */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              {activeSubReporte === 'clasificacion' ? (
                <>
                  <Boxes className="w-4 h-4 text-[#00603C]" />
                  <span>Lotes Clasificados Realizados ({activeLotesFiltrados.length})</span>
                </>
              ) : (
                <>
                  <FlaskConical className="w-4 h-4 text-[#C9922E]" />
                  <span>Lotes Tratados y Curados ({activeLotesFiltrados.length})</span>
                </>
              )}
            </h3>
            <p className="text-[11px] text-slate-500">
              Listado detallado con bolsas, kilos, fecha y ubicación
            </p>
          </div>
        </div>

        {activeLotesFiltrados.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">N° Lote</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Especie / Variedad</th>
                  <th className="py-3 px-4">Categoría</th>
                  <th className="py-3 px-4 text-right">Bolsas</th>
                  <th className="py-3 px-4 text-right">Kilos Totales</th>
                  <th className="py-3 px-4">
                    {activeSubReporte === 'clasificacion' ? 'Fecha Realización' : 'Fecha Tratamiento'}
                  </th>
                  <th className="py-3 px-4">Orden Movimiento</th>
                  <th className="py-3 px-4">Ubicación</th>
                  <th className="py-3 px-4 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {activeLotesFiltrados.map((lote) => {
                  const fechaDisplay = activeSubReporte === 'clasificacion'
                    ? (getFechaStr(lote.fechaHoraProduccion) || lote.fechaIngreso)
                    : (getFechaStr(lote.fechaTratamiento) || getFechaStr(lote.fechaHoraProduccion) || lote.fechaIngreso);

                  return (
                    <tr key={lote.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {lote.loteNro}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {lote.cliente}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-800">{lote.especie}</span>
                        <span className="text-slate-500 text-[11px] block">{lote.variedad}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[10px]">
                          {lote.categoria}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {formatNumberArg(lote.stockBolsas, 0)} b.
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-[#00603C]">
                        {formatNumberArg(lote.stockKg, 0)} kg
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {fechaDisplay}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {lote.numeroOrdenMovimiento || lote.ordenProcesoId || 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {lote.ala && lote.sector ? (
                          <span className="font-semibold text-slate-800">Ala {lote.ala} - Sec. {lote.sector}</span>
                        ) : (
                          <span>{lote.ubicacionAcopio || 'Acopio'}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {onSelectLote && (
                          <button
                            onClick={() => onSelectLote(lote)}
                            className="p-1.5 text-slate-400 hover:text-[#00603C] hover:bg-[#00603C]/10 rounded-lg transition cursor-pointer"
                            title="Ver Detalle de Lote"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 text-xs">
            <Boxes className="w-8 h-8 mx-auto mb-2 stroke-1" />
            <p>No se encontraron registros de {activeSubReporte} para los criterios seleccionados.</p>
          </div>
        )}

      </div>
    </div>

</div>
);
};
