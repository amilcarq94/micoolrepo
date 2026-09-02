/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Lote, OrdenProceso, SiloId, MovimientoSilo, CAPACIDAD_MAX_SILO } from '../types';
import { formatNumberArg } from '../utils/formatters';
import { getKgPorEnvase } from './OrdenProcesoModal';
import {
  Factory,
  Filter,
  RotateCcw,
  Download,
  Calendar,
  Layers,
  Search,
  ChevronDown,
  X,
  Check,
  TrendingUp,
  Boxes,
  PieChart as PieChartIcon,
  BarChart3,
  Scale,
  FileSpreadsheet,
  CheckSquare,
  Square,
  AlertTriangle,
  Clock,
  ShieldAlert,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  ArrowRight,
  Hourglass,
  Warehouse,
  Users,
  Zap,
  Gauge,
  Calculator,
  Target
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  Legend,
  AreaChart,
  Area,
  ReferenceLine
} from 'recharts';

interface DashboardProduccionProps {
  lotes: Lote[];
  ordenesProceso?: OrdenProceso[];
  siloStocks?: Record<SiloId, number>;
  movimientosSilo?: MovimientoSilo[];
  onSelectLote?: (lote: Lote) => void;
  onNavigateToSilos?: () => void;
}

interface ProductionRecord {
  id: string;
  loteNro: string;
  fechaProduccion: string; // YYYY-MM-DD
  fechaHoraProduccion?: string; // YYYY-MM-DDTHH:mm
  estadoRegistro: 'PRE-CARGA' | 'REALIZADO' | 'EN_CURSO';
  cliente: string;
  especie: string;
  variedad: string;
  categoria: string;
  tipo: string;
  tratamientos: string[];
  tratamientoStr: string;
  bolsasProducidas: number;
  kgProducidos: number;
  kgPorBolsa: number;
  loteOriginal: Lote;
}

// Colores institucionales
const COLOR_PALETTE = [
  '#00603C', // Verde institucional Agro Abacus
  '#C9922E', // Dorado / Ámbar
  '#2E8B57', // Verde Selva
  '#A0522D', // Terracota / Bronce
  '#4682B4', // Azul Acero
  '#8B4513', // Marrón
  '#2F4F4F', // Pizarra
  '#D2691E'  // Canela
];

// Recharts Custom Tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const kg = data.kgProducidos ?? data.kg ?? data.value ?? 0;
    const bolsas = data.bolsasProducidas ?? data.bolsas ?? 0;
    const ton = (kg / 1000).toFixed(1);

    return (
      <div className="bg-[#1A1A1A] text-white p-3.5 rounded-xl border border-gray-800 text-xs shadow-2xl font-sans text-left min-w-[200px]">
        <p className="font-bold text-[#C9922E] uppercase tracking-wider mb-2 border-b border-gray-800 pb-1">
          {data.name || label || 'Producción'}
        </p>
        <div className="space-y-1.5">
          <p className="flex justify-between gap-4">
            <span className="text-gray-400">Total Producido:</span>
            <span className="font-mono font-bold text-emerald-400">{formatNumberArg(kg, 0)} kg</span>
          </p>
          <p className="flex justify-between gap-4">
            <span className="text-gray-400">Volumen Toneladas:</span>
            <span className="font-mono font-bold text-[#F6EFDC]">{ton} Tn</span>
          </p>
          <p className="flex justify-between gap-4">
            <span className="text-gray-400">Bolsas Totales:</span>
            <span className="font-mono font-bold text-white">{formatNumberArg(bolsas, 0)} b.</span>
          </p>
          {data.lotesCount !== undefined && (
            <p className="flex justify-between gap-4 border-t border-gray-800/60 pt-1">
              <span className="text-gray-400">Lotes de Producción:</span>
              <span className="font-mono font-bold text-amber-300">{data.lotesCount}</span>
            </p>
          )}
        </div>
      </div>
    );
  }
  return null;
};

// Componente Reutilizable de Multi-Select Dropdown
interface MultiSelectDropdownProps {
  label: string;
  icon?: React.ReactNode;
  options: string[];
  selectedValues: string[];
  onChange: (newSelected: string[]) => void;
}

const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  label,
  icon,
  options,
  selectedValues,
  onChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    return options.filter(o => o.toLowerCase().includes(searchTerm.toLowerCase().trim()));
  }, [options, searchTerm]);

  const toggleOption = (val: string) => {
    if (selectedValues.includes(val)) {
      onChange(selectedValues.filter(v => v !== val));
    } else {
      onChange([...selectedValues, val]);
    }
  };

  const selectAll = () => {
    onChange([...options]);
  };

  const clearAll = () => {
    onChange([]);
  };

  const isAllSelected = options.length > 0 && selectedValues.length === options.length;
  const count = selectedValues.length;

  return (
    <div className="relative text-left">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold rounded-xl border transition shadow-xs ${
          count > 0
            ? 'bg-[#00603C] text-white border-[#00603C]'
            : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {icon}
          <span className="truncate">{label}</span>
          {count > 0 && (
            <span className="ml-1 px-1.5 py-0.2 bg-[#F6EFDC] text-[#00603C] text-[10px] font-bold rounded-full">
              {count}
            </span>
          )}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop para cerrar */}
          <div className="fixed inset-0 z-20" onClick={() => setIsOpen(false)} />

          <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-30 p-2 min-w-[200px] max-w-xs animate-in fade-in zoom-in-95 duration-100">
            {/* Buscador interno si hay muchas opciones */}
            {options.length > 6 && (
              <div className="relative mb-2">
                <input
                  type="text"
                  placeholder={`Buscar ${label.toLowerCase()}...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-7 pr-2 py-1 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#00603C]"
                />
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-2 pointer-events-none" />
              </div>
            )}

            {/* Acciones Rápidas */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-1.5 mb-1.5 text-[10px] font-bold text-gray-500">
              <button
                type="button"
                onClick={selectAll}
                className="hover:text-[#00603C] transition"
              >
                {isAllSelected ? 'Todos seleccionados' : 'Seleccionar Todos'}
              </button>
              {count > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-red-600 hover:underline transition"
                >
                  Limpiar
                </button>
              )}
            </div>

            {/* Lista de Opciones */}
            <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1 text-xs scrollbar-thin">
              {filteredOptions.length === 0 ? (
                <p className="text-gray-400 text-[11px] p-2 text-center italic">Sin coincidencias</p>
              ) : (
                filteredOptions.map((opt) => {
                  const isChecked = selectedValues.includes(opt);
                  return (
                    <label
                      key={opt}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleOption(opt);
                      }}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#E3EFE7] cursor-pointer transition select-none"
                    >
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-[#00603C] shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-300 shrink-0" />
                      )}
                      <span className={`text-xs ${isChecked ? 'font-bold text-gray-900' : 'text-gray-700'}`}>
                        {opt}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export interface VencimientoRecord {
  lote: Lote;
  loteNro: string;
  cliente: string;
  especie: string;
  variedad: string;
  tipo: string;
  stockBolsas: number;
  stockKg: number;
  tratamientoStr: string;
  fechaTratamiento: string;
  fechaVencimiento: string;
  diasRestantes: number;
  estadoVencimiento: 'VENCIDO' | 'CRITICO' | 'ATENCION' | 'VIGENTE';
  ordenProcesoId?: string;
  ordenProcesoNum?: string;
  ordenProceso?: OrdenProceso;
}

export const DashboardProduccion: React.FC<DashboardProduccionProps> = ({ 
  lotes, 
  ordenesProceso = [], 
  siloStocks, 
  movimientosSilo, 
  onSelectLote, 
  onNavigateToSilos 
}) => {
  // Estados para Filtros de la Sección Próximos Vencimientos
  const [vencEspecieFilter, setVencEspecieFilter] = useState<string>('TODAS');
  const [vencOpFilter, setVencOpFilter] = useState<string>('TODAS');
  const [vencEstadoFilter, setVencEstadoFilter] = useState<string>('TODOS');
  const [vencSearchTerm, setVencSearchTerm] = useState<string>('');
  const [vencCurrentPage, setVencCurrentPage] = useState<number>(1);
  const vencItemsPerPage = 8;

  // Estados para la Sección de Índice de Eficiencia Operativa (KG / Horas Hombre)
  const [effEspecieFilter, setEffEspecieFilter] = useState<string>('TODAS');
  const [effClienteFilter, setEffClienteFilter] = useState<string>('TODOS');
  const [effTipoFilter, setEffTipoFilter] = useState<string>('TODOS');
  const [effBenchmarkTarget, setEffBenchmarkTarget] = useState<number>(2000); // Target de benchmark en kg/hh
  const [effTableSearch, setEffTableSearch] = useState<string>('');
  const [effTablePage, setEffTablePage] = useState<number>(1);
  const effTableItemsPerPage = 6;

  // Estados para el Simulador de Eficiencia Operativa
  const [simKg, setSimKg] = useState<number>(40000);
  const [simOperarios, setSimOperarios] = useState<number>(3);
  const [simHoras, setSimHoras] = useState<number>(6.5);

  // Cálculo e Indicadores del Índice de Eficiencia Operativa
  const efficiencyAnalysis = useMemo(() => {
    if (!ordenesProceso || ordenesProceso.length === 0) {
      return {
        finishedOps: [],
        filteredOps: [],
        totalKg: 0,
        totalHH: 0,
        totalHorasPlanta: 0,
        globalIndice: 0,
        avgTnPorHora: 0,
        maxOpRecord: null,
        opsByEspecieChart: [],
        opsChartData: [],
        clientesList: [],
        especiesList: []
      };
    }

    // Filtrar Órdenes de Proceso con estado TERMINADO
    const finishedList = ordenesProceso
      .filter(op => op.estado === 'TERMINADO')
      .map(op => {
        const envase = op.envaseDestino || '';
        const kgPorEnvase = getKgPorEnvase(envase);
        const bultos = op.hechos || op.bbPedidos || 0;
        const kgProcesados = bultos * kgPorEnvase;
        const operarios = op.operarios || 2;
        const horasTrabajadas = op.horasTrabajadas || (op.horasHombre ? op.horasHombre / operarios : 6);
        const horasHombre = op.horasHombre || (operarios * horasTrabajadas);
        const indiceEficiencia = horasHombre > 0 ? Math.round(kgProcesados / horasHombre) : 0;
        const tnPorHora = horasTrabajadas > 0 ? Number(((kgProcesados / 1000) / horasTrabajadas).toFixed(2)) : 0;

        return {
          ...op,
          kgProcesados,
          operarios,
          horasTrabajadas,
          horasHombre,
          indiceEficiencia,
          tnPorHora,
          bultos
        };
      });

    // Listas únicas de clientes y especies para filtros
    const clientesList = Array.from(new Set(finishedList.map(o => o.cliente).filter(Boolean) as string[])).sort();
    const especiesList = Array.from(new Set(finishedList.map(o => o.especie).filter(Boolean) as string[])).sort();

    // Global Totals
    const totalKg = finishedList.reduce((acc, o) => acc + o.kgProcesados, 0);
    const totalHH = finishedList.reduce((acc, o) => acc + o.horasHombre, 0);
    const totalHorasPlanta = finishedList.reduce((acc, o) => acc + o.horasTrabajadas, 0);
    const globalIndice = totalHH > 0 ? Math.round(totalKg / totalHH) : 0;
    const avgTnPorHora = totalHorasPlanta > 0 ? Number(((totalKg / 1000) / totalHorasPlanta).toFixed(2)) : 0;

    // Record máximo
    const maxOpRecord = finishedList.length > 0 
      ? [...finishedList].sort((a, b) => b.indiceEficiencia - a.indiceEficiencia)[0]
      : null;

    // Filtros aplicados
    const filteredOps = finishedList.filter(o => {
      if (effEspecieFilter !== 'TODAS' && o.especie !== effEspecieFilter) return false;
      if (effClienteFilter !== 'TODOS' && o.cliente !== effClienteFilter) return false;
      if (effTipoFilter !== 'TODOS' && o.tipoOrden !== effTipoFilter) return false;
      if (effTableSearch.trim()) {
        const q = effTableSearch.toLowerCase().trim();
        const matchNum = o.numeroOrden.toLowerCase().includes(q);
        const matchCli = (o.cliente || '').toLowerCase().includes(q);
        const matchEsp = (o.especie || '').toLowerCase().includes(q);
        const matchVar = (o.variedad || '').toLowerCase().includes(q);
        if (!matchNum && !matchCli && !matchEsp && !matchVar) return false;
      }
      return true;
    });

    // Chart de Eficiencia por Especie
    const especieMap: Record<string, { especie: string; totalKg: number; totalHH: number }> = {};
    finishedList.forEach(o => {
      const esp = o.especie || 'Sin Especie';
      if (!especieMap[esp]) especieMap[esp] = { especie: esp, totalKg: 0, totalHH: 0 };
      especieMap[esp].totalKg += o.kgProcesados;
      especieMap[esp].totalHH += o.horasHombre;
    });
    const opsByEspecieChart = Object.values(especieMap).map(e => ({
      name: e.especie,
      indice: e.totalHH > 0 ? Math.round(e.totalKg / e.totalHH) : 0,
      totalKg: e.totalKg,
      totalHH: e.totalHH
    }));

    // Chart de OPs filtradas
    const opsChartData = filteredOps.map(o => ({
      name: `OP ${o.numeroOrden}`,
      indice: o.indiceEficiencia,
      kg: o.kgProcesados,
      hh: o.horasHombre,
      cliente: o.cliente,
      especie: o.especie
    }));

    return {
      finishedOps: finishedList,
      filteredOps,
      totalKg,
      totalHH,
      totalHorasPlanta,
      globalIndice,
      avgTnPorHora,
      maxOpRecord,
      opsByEspecieChart,
      opsChartData,
      clientesList,
      especiesList
    };
  }, [ordenesProceso, effEspecieFilter, effClienteFilter, effTipoFilter, effTableSearch]);

  // Lógica de Vencimientos de Tratamiento
  const TODAY_STR = '2026-07-23';

  const vencimientoRecords = useMemo<VencimientoRecord[]>(() => {
    const list: VencimientoRecord[] = [];

    lotes.forEach((lote) => {
      const trats = Array.isArray(lote.tratamiento) ? lote.tratamiento : [lote.tratamiento];
      const hasTratamientoMark = trats.some(t => String(t).toLowerCase().includes('tratad')) ||
                                  (lote.producto && lote.producto !== 'Ninguno') ||
                                  Boolean(lote.fechaTratamiento) ||
                                  Boolean(lote.fechaVencimientoTratamiento) ||
                                  Boolean(lote.ordenProcesoId);

      if (!hasTratamientoMark) return;

      // Buscar Orden de Proceso vinculada por ID o número
      let linkedOp: OrdenProceso | undefined;
      if (lote.ordenProcesoId && ordenesProceso) {
        linkedOp = ordenesProceso.find(op => op.id === lote.ordenProcesoId || op.numeroOrden === lote.ordenProcesoId);
      }
      if (!linkedOp && lote.numeroOrdenMovimiento && ordenesProceso) {
        linkedOp = ordenesProceso.find(op => op.numeroOrdenMovimiento === lote.numeroOrdenMovimiento || op.numeroOrden === lote.numeroOrdenMovimiento);
      }

      // Tratamiento descriptivo
      let tratamientoStr = lote.producto && lote.producto !== 'Ninguno' ? lote.producto : '';
      if (!tratamientoStr && linkedOp?.tratamiento) {
        tratamientoStr = linkedOp.tratamiento;
      }
      if (!tratamientoStr) {
        tratamientoStr = trats.join(', ') || 'Tratamiento Aplicado';
      }

      // Fechas
      const fechaTrat = lote.fechaTratamiento || lote.fechaIngreso || linkedOp?.fechaCreacion || '2026-07-15';
      let fechaVenc = lote.fechaVencimientoTratamiento;

      if (!fechaVenc) {
        const d = new Date(fechaTrat + 'T00:00:00');
        d.setDate(d.getDate() + 90);
        fechaVenc = d.toISOString().split('T')[0];
      }

      // Cálculo de Días Restantes
      const today = new Date(TODAY_STR + 'T00:00:00');
      const venc = new Date(fechaVenc + 'T00:00:00');
      const diffDays = Math.ceil((venc.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      let estadoVencimiento: 'VENCIDO' | 'CRITICO' | 'ATENCION' | 'VIGENTE' = 'VIGENTE';
      if (diffDays <= 0) {
        estadoVencimiento = 'VENCIDO';
      } else if (diffDays <= 15) {
        estadoVencimiento = 'CRITICO';
      } else if (diffDays <= 45) {
        estadoVencimiento = 'ATENCION';
      }

      list.push({
        lote,
        loteNro: lote.loteNro || lote.id,
        cliente: lote.cliente || 'Desconocido',
        especie: lote.especie || 'Sin especificar',
        variedad: lote.variedad || '-',
        tipo: lote.tipo || 'Final',
        stockBolsas: lote.stockBolsas || 0,
        stockKg: lote.stockKg || 0,
        tratamientoStr,
        fechaTratamiento: fechaTrat,
        fechaVencimiento: fechaVenc,
        diasRestantes: diffDays,
        estadoVencimiento,
        ordenProcesoId: lote.ordenProcesoId,
        ordenProcesoNum: linkedOp ? `N° ${linkedOp.numeroOrden}` : (lote.ordenProcesoId ? `N° ${lote.ordenProcesoId}` : undefined),
        ordenProceso: linkedOp
      });
    });

    return list.sort((a, b) => a.diasRestantes - b.diasRestantes);
  }, [lotes, ordenesProceso]);

  // Opciones dinámicas para el filtro de Órdenes de Proceso
  const opcionesOps = useMemo(() => {
    const list: { id: string; label: string }[] = [];
    const setIds = new Set<string>();

    if (ordenesProceso) {
      ordenesProceso.forEach(op => {
        if (!setIds.has(op.id)) {
          setIds.add(op.id);
          list.push({
            id: op.id,
            label: `OP N° ${op.numeroOrden} (${op.tipoOrden} - ${op.variedad})`
          });
        }
      });
    }

    vencimientoRecords.forEach(r => {
      if (r.ordenProcesoId && !setIds.has(r.ordenProcesoId)) {
        setIds.add(r.ordenProcesoId);
        list.push({
          id: r.ordenProcesoId,
          label: `OP N° ${r.ordenProcesoNum || r.ordenProcesoId}`
        });
      }
    });

    return list;
  }, [ordenesProceso, vencimientoRecords]);

  // Filtrado de Vencimientos
  const filteredVencimientos = useMemo(() => {
    return vencimientoRecords.filter(r => {
      // Especie
      if (vencEspecieFilter !== 'TODAS' && r.especie !== vencEspecieFilter) {
        return false;
      }
      // Orden de Proceso
      if (vencOpFilter === 'CON_OP' && !r.ordenProcesoNum) return false;
      if (vencOpFilter === 'SIN_OP' && r.ordenProcesoNum) return false;
      if (vencOpFilter !== 'TODAS' && vencOpFilter !== 'CON_OP' && vencOpFilter !== 'SIN_OP') {
        const matchOp = r.ordenProcesoId === vencOpFilter ||
                        r.ordenProcesoNum?.includes(vencOpFilter) ||
                        r.ordenProceso?.numeroOrden === vencOpFilter;
        if (!matchOp) return false;
      }
      // Estado
      if (vencEstadoFilter === 'SOLO_VENCIDOS' && r.diasRestantes > 0) return false;
      if (vencEstadoFilter === 'SOLO_CRITICOS' && (r.diasRestantes <= 0 || r.diasRestantes > 15)) return false;
      if (vencEstadoFilter === 'PROXIMOS' && r.diasRestantes > 30) return false;

      // Buscador
      if (vencSearchTerm.trim()) {
        const term = vencSearchTerm.toLowerCase().trim();
        const matchText = r.loteNro.toLowerCase().includes(term) ||
                          r.cliente.toLowerCase().includes(term) ||
                          r.variedad.toLowerCase().includes(term) ||
                          r.especie.toLowerCase().includes(term) ||
                          r.tratamientoStr.toLowerCase().includes(term) ||
                          (r.ordenProcesoNum && r.ordenProcesoNum.toLowerCase().includes(term));
        if (!matchText) return false;
      }

      return true;
    });
  }, [vencimientoRecords, vencEspecieFilter, vencOpFilter, vencEstadoFilter, vencSearchTerm]);

  // Métricas del resumen de Vencimientos
  const totalVencidos = useMemo(() => vencimientoRecords.filter(r => r.diasRestantes <= 0).length, [vencimientoRecords]);
  const totalCriticos = useMemo(() => vencimientoRecords.filter(r => r.diasRestantes > 0 && r.diasRestantes <= 15).length, [vencimientoRecords]);
  const totalConOp = useMemo(() => vencimientoRecords.filter(r => Boolean(r.ordenProcesoNum)).length, [vencimientoRecords]);

  // Paginación Vencimientos
  const vencTotalPages = Math.ceil(filteredVencimientos.length / vencItemsPerPage) || 1;
  const paginatedVencimientos = useMemo(() => {
    const start = (vencCurrentPage - 1) * vencItemsPerPage;
    return filteredVencimientos.slice(start, start + vencItemsPerPage);
  }, [filteredVencimientos, vencCurrentPage, vencItemsPerPage]);

  const handleExportVencimientosExcel = () => {
    const dataToExport = filteredVencimientos.map(r => ({
      'N° Lote': r.loteNro,
      'Cliente': r.cliente,
      'Especie': r.especie,
      'Variedad': r.variedad,
      'OP Vinculada': r.ordenProcesoNum || 'Sin OP',
      'Tratamiento Aplicado': r.tratamientoStr,
      'Bolsas Stock': r.stockBolsas,
      'Kg Stock': r.stockKg,
      'Fecha Tratamiento': r.fechaTratamiento,
      'Fecha Vencimiento': r.fechaVencimiento,
      'Días Restantes': r.diasRestantes,
      'Estado Vencimiento': r.estadoVencimiento
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Proximos Vencimientos');
    XLSX.writeFile(workbook, `Vencimientos_Tratamientos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // 1. Transformar lotes existentes en registros de eventos de Producción
  const productionRecords: ProductionRecord[] = useMemo(() => {
    return lotes.map((lote) => {
      // Calcular volumen producido a partir de movimientos de Entrada o saldo original
      const entradas = lote.historial?.filter(m => m.tipo.startsWith('Entrada')) || [];
      const salidas = lote.historial?.filter(m => m.tipo === 'Salida') || [];

      let bolsasProducidas = 0;
      let kgProducidos = 0;

      if (entradas.length > 0) {
        bolsasProducidas = entradas.reduce((sum, m) => sum + (m.cantidadBolsas || 0), 0);
        kgProducidos = entradas.reduce((sum, m) => sum + (m.cantidadKg || 0), 0);
      } else {
        // Fallback: bolsas actuales + bolsas despachadas (salidas)
        const bolsasSalidas = salidas.reduce((sum, m) => sum + (m.cantidadBolsas || 0), 0);
        bolsasProducidas = lote.stockBolsas + bolsasSalidas;
        kgProducidos = bolsasProducidas * (lote.kgPorBolsa || 40);
      }

      // Si por alguna razón dio 0, tomamos el stockKg actual como mínimo producido
      if (kgProducidos === 0 && lote.stockKg > 0) {
        kgProducidos = lote.stockKg;
        bolsasProducidas = lote.stockBolsas;
      }

      // Tratamientos
      const trats = Array.isArray(lote.tratamiento) ? lote.tratamiento : [lote.tratamiento || 'Sin Tratar'];
      const tratamientoStr = trats.join(', ');

      // Normalizar Cliente
      let clientName = lote.cliente?.trim() || 'Desconocido';
      const upperClient = clientName.toUpperCase();
      if (upperClient === 'SAN DIEGO' || upperClient === 'SAN DIEGO SEMILLA' || upperClient === 'SAN DIEGO SEMILLAS') {
        clientName = 'San Diego Semillas';
      }

      // Fecha de producción (fechaIngreso)
      const fechaProduccion = lote.fechaIngreso || (entradas[0]?.fecha) || '2026-07-13';

      // Estado de Registro (PRE-CARGA / REALIZADO)
      const estadoRegistro = lote.estadoRegistro || 'REALIZADO';
      const fechaHoraProduccion = lote.fechaHoraProduccion || (lote.fechaIngreso ? `${lote.fechaIngreso}T09:00` : undefined);

      return {
        id: lote.id,
        loteNro: lote.loteNro || lote.id,
        fechaProduccion,
        fechaHoraProduccion,
        estadoRegistro,
        cliente: clientName,
        especie: lote.especie || 'Sin especificar',
        variedad: lote.variedad || 'Desconocida',
        categoria: lote.categoria || 'Original',
        tipo: lote.tipo || 'Final',
        tratamientos: trats,
        tratamientoStr,
        bolsasProducidas,
        kgProducidos,
        kgPorBolsa: lote.kgPorBolsa || 40,
        loteOriginal: lote
      };
    });
  }, [lotes]);

  // 2. Extraer opciones dinámicas para cada dimensión de filtro
  const opcionesClientes = useMemo(() => {
    const set = new Set<string>();
    productionRecords.forEach(r => { if (r.cliente) set.add(r.cliente); });
    return Array.from(set).sort();
  }, [productionRecords]);

  const opcionesEspecies = useMemo(() => {
    const set = new Set<string>();
    productionRecords.forEach(r => { if (r.especie) set.add(r.especie); });
    return Array.from(set).sort();
  }, [productionRecords]);

  const opcionesVariedades = useMemo(() => {
    const set = new Set<string>();
    productionRecords.forEach(r => { if (r.variedad) set.add(r.variedad); });
    return Array.from(set).sort();
  }, [productionRecords]);

  const opcionesCategorias = useMemo(() => {
    const set = new Set<string>();
    productionRecords.forEach(r => { if (r.categoria) set.add(r.categoria); });
    return Array.from(set).sort();
  }, [productionRecords]);

  const opcionesTipos = useMemo(() => {
    const set = new Set<string>();
    productionRecords.forEach(r => { if (r.tipo) set.add(r.tipo); });
    return Array.from(set).sort();
  }, [productionRecords]);

  const opcionesTratamientos = useMemo(() => {
    const set = new Set<string>();
    productionRecords.forEach(r => {
      r.tratamientos.forEach(t => set.add(t));
    });
    return Array.from(set).sort();
  }, [productionRecords]);

  // 3. Estados de Filtros Multi-Select
  const [selectedEspecies, setSelectedEspecies] = useState<string[]>([]);
  const [selectedClientes, setSelectedClientes] = useState<string[]>([]);
  const [selectedVariedades, setSelectedVariedades] = useState<string[]>([]);
  const [selectedCategorias, setSelectedCategorias] = useState<string[]>([]);
  const [selectedTipos, setSelectedTipos] = useState<string[]>([]);
  const [selectedTratamientos, setSelectedTratamientos] = useState<string[]>([]);
  const [fechaDesde, setFechaDesde] = useState<string>('');
  const [fechaHasta, setFechaHasta] = useState<string>('');
  const [selectedEstadoRegistro, setSelectedEstadoRegistro] = useState<string>('TODOS'); // 'TODOS' | 'PRE-CARGA' | 'REALIZADO'

  // Estado de Agrupación para Gráfico Principal
  const [groupByField, setGroupByField] = useState<'cliente' | 'especie' | 'variedad' | 'categoria' | 'tipo' | 'tratamientoStr'>('cliente');
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');

  // Estado para la tabla de detalle
  const [tableSearch, setTableSearch] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 12;

  // 4. Lógica de Filtrado Combinado (AND entre dimensiones, OR dentro de cada dimensión)
  const filteredRecords = useMemo(() => {
    return productionRecords.filter((record) => {
      // Estado de Registro (PRE-CARGA / REALIZADO)
      if (selectedEstadoRegistro !== 'TODOS' && record.estadoRegistro !== selectedEstadoRegistro) {
        return false;
      }
      // Especie
      if (selectedEspecies.length > 0 && !selectedEspecies.includes(record.especie)) {
        return false;
      }
      // Cliente
      if (selectedClientes.length > 0 && !selectedClientes.includes(record.cliente)) {
        return false;
      }
      // Variedad
      if (selectedVariedades.length > 0 && !selectedVariedades.includes(record.variedad)) {
        return false;
      }
      // Categoría
      if (selectedCategorias.length > 0 && !selectedCategorias.includes(record.categoria)) {
        return false;
      }
      // Tipo
      if (selectedTipos.length > 0 && !selectedTipos.includes(record.tipo)) {
        return false;
      }
      // Tratamiento
      if (selectedTratamientos.length > 0) {
        const hasMatchingTreatment = selectedTratamientos.some(t =>
          record.tratamientos.includes(t) || record.tratamientoStr.includes(t)
        );
        if (!hasMatchingTreatment) return false;
      }
      // Rango de fechas
      if (fechaDesde && record.fechaProduccion < fechaDesde) {
        return false;
      }
      if (fechaHasta && record.fechaProduccion > fechaHasta) {
        return false;
      }

      return true;
    });
  }, [
    productionRecords,
    selectedEstadoRegistro,
    selectedEspecies,
    selectedClientes,
    selectedVariedades,
    selectedCategorias,
    selectedTipos,
    selectedTratamientos,
    fechaDesde,
    fechaHasta
  ]);

  // Reset de Filtros
  const handleResetFilters = () => {
    setSelectedEspecies([]);
    setSelectedClientes([]);
    setSelectedVariedades([]);
    setSelectedCategorias([]);
    setSelectedTipos([]);
    setSelectedTratamientos([]);
    setSelectedEstadoRegistro('TODOS');
    setFechaDesde('');
    setFechaHasta('');
    setTableSearch('');
    setCurrentPage(1);
  };

  const hasActiveFilters =
    selectedEspecies.length > 0 ||
    selectedClientes.length > 0 ||
    selectedVariedades.length > 0 ||
    selectedCategorias.length > 0 ||
    selectedTipos.length > 0 ||
    selectedTratamientos.length > 0 ||
    selectedEstadoRegistro !== 'TODOS' ||
    Boolean(fechaDesde) ||
    Boolean(fechaHasta);

  // 5. Totales e Indicadores Agregados
  const totalKg = useMemo(() => filteredRecords.reduce((acc, r) => acc + r.kgProducidos, 0), [filteredRecords]);
  const totalBolsas = useMemo(() => filteredRecords.reduce((acc, r) => acc + r.bolsasProducidas, 0), [filteredRecords]);
  const totalLotes = filteredRecords.length;
  const promedioKgLote = totalLotes > 0 ? Math.round(totalKg / totalLotes) : 0;
  const totalToneladas = (totalKg / 1000).toFixed(1);

  // Totales por Estado de Registro (Pre-Carga vs Realizado)
  const countRealizados = useMemo(() => filteredRecords.filter(r => r.estadoRegistro === 'REALIZADO').length, [filteredRecords]);
  const countPreCarga = useMemo(() => filteredRecords.filter(r => r.estadoRegistro === 'PRE-CARGA').length, [filteredRecords]);
  const kgRealizados = useMemo(() => filteredRecords.filter(r => r.estadoRegistro === 'REALIZADO').reduce((acc, r) => acc + r.kgProducidos, 0), [filteredRecords]);
  const kgPreCarga = useMemo(() => filteredRecords.filter(r => r.estadoRegistro === 'PRE-CARGA').reduce((acc, r) => acc + r.kgProducidos, 0), [filteredRecords]);

  // Proporción de Producción Tratada
  const totalKgTratado = useMemo(() => {
    return filteredRecords.reduce((acc, r) => {
      const isTratado = r.tratamientos.some(t => String(t).toLowerCase() === 'tratado' || (t && t !== 'Sin Tratar' && t !== 'Sin Tratamiento')) ||
                        Boolean(r.tratamientoStr && !['Sin Tratar', 'Sin Tratamiento', 'Ninguno', ''].includes(r.tratamientoStr));
      return isTratado ? acc + r.kgProducidos : acc;
    }, 0);
  }, [filteredRecords]);

  const totalKgSinTratar = totalKg - totalKgTratado;
  const pctProduccionTratada = totalKg > 0 ? Math.round((totalKgTratado / totalKg) * 100) : 0;
  const pctProduccionSinTratar = totalKg > 0 ? (100 - pctProduccionTratada) : 0;

  // 6. Datos Agrupados para el Gráfico Principal
  const groupedChartData = useMemo(() => {
    const map = new Map<string, { name: string; kgProducidos: number; bolsasProducidas: number; lotesCount: number }>();

    filteredRecords.forEach((r) => {
      let key = '';
      if (groupByField === 'cliente') key = r.cliente;
      else if (groupByField === 'especie') key = r.especie;
      else if (groupByField === 'variedad') key = r.variedad;
      else if (groupByField === 'categoria') key = r.categoria;
      else if (groupByField === 'tipo') key = r.tipo;
      else if (groupByField === 'tratamientoStr') key = r.tratamientoStr;

      if (!key) key = 'Sin clasificar';

      const existing = map.get(key) || { name: key, kgProducidos: 0, bolsasProducidas: 0, lotesCount: 0 };
      existing.kgProducidos += r.kgProducidos;
      existing.bolsasProducidas += r.bolsasProducidas;
      existing.lotesCount += 1;
      map.set(key, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.kgProducidos - a.kgProducidos);
  }, [filteredRecords, groupByField]);

  // 7. Datos de Evolución Temporal de Producción
  const timeChartData = useMemo(() => {
    const map = new Map<string, { fecha: string; kg: number; bolsas: number }>();

    filteredRecords.forEach((r) => {
      const dateKey = r.fechaProduccion || 'Sin Fecha';
      const existing = map.get(dateKey) || { fecha: dateKey, kg: 0, bolsas: 0 };
      existing.kg += r.kgProducidos;
      existing.bolsas += r.bolsasProducidas;
      map.set(dateKey, existing);
    });

    return Array.from(map.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [filteredRecords]);

  // 8. Filtrado por texto para la tabla
  const tableFilteredRecords = useMemo(() => {
    if (!tableSearch.trim()) return filteredRecords;
    const term = tableSearch.toLowerCase().trim();
    return filteredRecords.filter(r =>
      r.loteNro.toLowerCase().includes(term) ||
      r.cliente.toLowerCase().includes(term) ||
      r.especie.toLowerCase().includes(term) ||
      r.variedad.toLowerCase().includes(term) ||
      r.categoria.toLowerCase().includes(term) ||
      r.tipo.toLowerCase().includes(term) ||
      r.tratamientoStr.toLowerCase().includes(term)
    );
  }, [filteredRecords, tableSearch]);

  // Paginación
  const totalPages = Math.ceil(tableFilteredRecords.length / itemsPerPage) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return tableFilteredRecords.slice(start, start + itemsPerPage);
  }, [tableFilteredRecords, currentPage, itemsPerPage]);

  // 9. Funciones de Exportación
  const handleExportExcel = () => {
    const dataToExport = filteredRecords.map(r => ({
      'N° Lote': r.loteNro,
      'Fecha Producción': r.fechaProduccion,
      'Cliente': r.cliente,
      'Especie': r.especie,
      'Variedad': r.variedad,
      'Categoría': r.categoria,
      'Tipo Lote': r.tipo,
      'Tratamiento': r.tratamientoStr,
      'Bolsas Producidas': r.bolsasProducidas,
      'Peso por Bolsa (kg)': r.kgPorBolsa,
      'Kilogramos Producidos (kg)': r.kgProducidos,
      'Toneladas (Tn)': (r.kgProducidos / 1000).toFixed(2)
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte Producción');

    // Auto-ajustar ancho de columnas
    const max_width = dataToExport.reduce((w, r) => {
      return Object.keys(r).map((k, i) => Math.max(w[i] || 10, String(k).length, String((r as any)[k]).length));
    }, [] as number[]);
    worksheet['!cols'] = max_width.map(w => ({ wch: w + 3 }));

    XLSX.writeFile(workbook, `Reporte_Produccion_AgroAbacus_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleExportCSV = () => {
    const headers = ['N° Lote', 'Fecha Produccion', 'Cliente', 'Especie', 'Variedad', 'Categoria', 'Tipo Lote', 'Tratamiento', 'Bolsas Producidas', 'Kg Producidos', 'Toneladas'];
    const rows = filteredRecords.map(r => [
      `"${r.loteNro}"`,
      `"${r.fechaProduccion}"`,
      `"${r.cliente}"`,
      `"${r.especie}"`,
      `"${r.variedad}"`,
      `"${r.categoria}"`,
      `"${r.tipo}"`,
      `"${r.tratamientoStr}"`,
      r.bolsasProducidas,
      r.kgProducidos,
      (r.kgProducidos / 1000).toFixed(2)
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Produccion_Filtrada_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 text-left">
      
      {/* HEADER DE LA VISTA */}
      <div className="bg-gradient-to-r from-[#00603C] to-[#254731] text-white p-6 md:p-8 rounded-3xl shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 flex items-center pr-8 pointer-events-none">
          <Factory className="w-64 h-64 text-white" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 bg-[#F6EFDC] text-[#00603C] text-[10px] font-bold uppercase tracking-widest rounded-md">
                Análisis Histórico de Planta
              </span>
            </div>
            <h1 className="font-serif text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              <Factory className="w-8 h-8 text-[#C9922E]" />
              Dashboard de Producción
            </h1>
            <p className="text-emerald-100 text-xs md:text-sm mt-1 max-w-2xl leading-relaxed">
              Consolidado de eventos de producción acumulados a partir de los registros de altas de lotes. Filtre por múltiples variables simultáneamente y analice volúmenes históricos.
            </p>
          </div>

          {/* Botones de Exportación */}
          <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0">
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#C9922E] hover:bg-[#b07d22] text-white text-xs font-bold rounded-xl shadow-md transition transform active:scale-95"
              title="Descargar archivo Excel .xlsx con los lotes filtrados"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Exportar Excel</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition border border-white/20"
              title="Descargar archivo .CSV con el detalle filtrado"
            >
              <Download className="w-4 h-4" />
              <span>CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECCIÓN DE FILTROS MULTI-SELECT COMBINABLES */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#00603C]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-800">
              Filtros Multivariable de Producción
            </h2>
            <span className="text-[11px] text-gray-500 font-normal">
              (Multi-selección OR dentro de cada campo, combinación AND entre campos)
            </span>
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-lg transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpiar Filtros</span>
            </button>
          )}
        </div>

        {/* Grid de Selectores Múltiples y Estado de Registro */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          {/* Selector Estado de Registro */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-600" />
              Estado Registro
            </span>
            <select
              value={selectedEstadoRegistro}
              onChange={(e) => setSelectedEstadoRegistro(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-900 text-white font-bold text-xs rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
            >
              <option value="TODOS">⚡ TODOS LOS REGISTROS</option>
              <option value="REALIZADO">✅ REALIZADO</option>
              <option value="PRE-CARGA">⏳ PRE-CARGA</option>
            </select>
          </div>

          <MultiSelectDropdown
            label="Especie"
            icon={<Boxes className="w-3.5 h-3.5" />}
            options={opcionesEspecies}
            selectedValues={selectedEspecies}
            onChange={setSelectedEspecies}
          />

          <MultiSelectDropdown
            label="Cliente"
            icon={<Factory className="w-3.5 h-3.5" />}
            options={opcionesClientes}
            selectedValues={selectedClientes}
            onChange={setSelectedClientes}
          />

          <MultiSelectDropdown
            label="Variedad"
            icon={<Layers className="w-3.5 h-3.5" />}
            options={opcionesVariedades}
            selectedValues={selectedVariedades}
            onChange={setSelectedVariedades}
          />

          <MultiSelectDropdown
            label="Categoría"
            options={opcionesCategorias}
            selectedValues={selectedCategorias}
            onChange={setSelectedCategorias}
          />

          <MultiSelectDropdown
            label="Tipo Lote"
            options={opcionesTipos}
            selectedValues={selectedTipos}
            onChange={setSelectedTipos}
          />

          <MultiSelectDropdown
            label="Tratamiento"
            options={opcionesTratamientos}
            selectedValues={selectedTratamientos}
            onChange={setSelectedTratamientos}
          />
        </div>

        {/* Filtro de Rango de Fechas de Producción */}
        <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-bold text-gray-700 flex items-center gap-1.5 uppercase text-[10px] tracking-wider">
              <Calendar className="w-3.5 h-3.5 text-[#00603C]" />
              Fecha de Producción:
            </span>
            <div className="flex items-center gap-2">
              <label className="text-gray-500 text-[11px]">Desde:</label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#00603C]"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-gray-500 text-[11px]">Hasta:</label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#00603C]"
              />
            </div>
          </div>

          <div className="text-[11px] text-gray-500 italic">
            Registros evaluados: <strong className="text-gray-800 font-mono font-bold">{filteredRecords.length}</strong> de {productionRecords.length}
          </div>
        </div>

        {/* Barra Visual de Filtros Activos (Chips / Badges) */}
        {hasActiveFilters && (
          <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Filtros Activos:</span>
            
            {selectedEstadoRegistro !== 'TODOS' && (
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 font-bold rounded-lg text-[11px] ${
                selectedEstadoRegistro === 'PRE-CARGA' ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
              }`}>
                Modo: {selectedEstadoRegistro}
                <button onClick={() => setSelectedEstadoRegistro('TODOS')} className="hover:text-red-700">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            
            {selectedEspecies.map(val => (
              <span key={`esp-${val}`} className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#E3EFE7] text-[#00603C] font-bold rounded-lg text-[11px]">
                Especie: {val}
                <button onClick={() => setSelectedEspecies(selectedEspecies.filter(v => v !== val))} className="hover:text-red-700">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {selectedClientes.map(val => (
              <span key={`cli-${val}`} className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#E3EFE7] text-[#00603C] font-bold rounded-lg text-[11px]">
                Cliente: {val}
                <button onClick={() => setSelectedClientes(selectedClientes.filter(v => v !== val))} className="hover:text-red-700">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {selectedVariedades.map(val => (
              <span key={`var-${val}`} className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-[#C9922E] font-bold rounded-lg text-[11px] border border-amber-200">
                Variedad: {val}
                <button onClick={() => setSelectedVariedades(selectedVariedades.filter(v => v !== val))} className="hover:text-red-700">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {selectedCategorias.map(val => (
              <span key={`cat-${val}`} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-800 font-bold rounded-lg text-[11px]">
                Categoría: {val}
                <button onClick={() => setSelectedCategorias(selectedCategorias.filter(v => v !== val))} className="hover:text-red-700">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {selectedTipos.map(val => (
              <span key={`tipo-${val}`} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-800 font-bold rounded-lg text-[11px]">
                Tipo: {val}
                <button onClick={() => setSelectedTipos(selectedTipos.filter(v => v !== val))} className="hover:text-red-700">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {selectedTratamientos.map(val => (
              <span key={`trat-${val}`} className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#F5E5DC] text-[#A0522D] font-bold rounded-lg text-[11px]">
                Tratamiento: {val}
                <button onClick={() => setSelectedTratamientos(selectedTratamientos.filter(v => v !== val))} className="hover:text-red-700">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {fechaDesde && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-800 font-bold rounded-lg text-[11px]">
                Desde: {fechaDesde}
                <button onClick={() => setFechaDesde('')} className="hover:text-red-700">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {fechaHasta && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-800 font-bold rounded-lg text-[11px]">
                Hasta: {fechaHasta}
                <button onClick={() => setFechaHasta('')} className="hover:text-red-700">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* BANNER DISPONIBILIDAD MATERIA PRIMA EN SILOS */}
      {siloStocks && (() => {
        const totalMateriaPrimaSilosKg = (Object.values(siloStocks) as number[]).reduce((a: number, b: number) => a + (b || 0), 0);
        return (
          <div className="bg-gradient-to-r from-amber-900 to-amber-950 text-white rounded-2xl p-5 shadow-sm border border-amber-800 text-left">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-800/80 rounded-xl text-amber-200">
                  <Warehouse className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                    Materia Prima Disponible en Origen
                  </span>
                  <h3 className="font-serif text-lg font-bold text-white tracking-tight">
                    Disponibilidad en Silos de Acopio: {formatNumberArg(totalMateriaPrimaSilosKg, 0)} kg ({(totalMateriaPrimaSilosKg / 1000).toFixed(1)} Tn)
                  </h3>
                </div>
              </div>

              {onNavigateToSilos && (
                <button
                  onClick={onNavigateToSilos}
                  className="px-3.5 py-1.5 bg-amber-700 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <span>Ver Silos e Ingresos</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <p className="text-xs text-amber-200/80 mb-3">
              Stock real en silos calculado como <strong>Ingresos − Egresos/Extracciones OP</strong>. Disponible para alimentar las órdenes de proceso de planta.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 pt-2 border-t border-amber-800/80">
              {(['Silo 1', 'Silo 2', 'Silo 3', 'Silo 4', 'Silo 5', 'Silo 6'] as SiloId[]).map((sKey) => {
                const kgSilo = siloStocks[sKey] || 0;
                const pctSilo = Math.min(100, Math.round((kgSilo / CAPACIDAD_MAX_SILO) * 100));
                return (
                  <div key={sKey} className="bg-amber-950/60 p-2.5 rounded-xl border border-amber-800/50">
                    <div className="flex justify-between items-center text-[10px] font-mono text-amber-300 font-bold mb-1">
                      <span>{sKey}</span>
                      <span>{pctSilo}%</span>
                    </div>
                    <div className="text-xs font-bold font-mono text-white">
                      {formatNumberArg(kgSilo, 0)} kg
                    </div>
                    <div className="w-full bg-amber-900/80 h-1.5 rounded-full overflow-hidden mt-1.5">
                      <div 
                        className="bg-amber-400 h-full rounded-full" 
                        style={{ width: `${pctSilo}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* KPI CARDS RESUMEN DE PRODUCCIÓN */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        
        {/* Total Kilogramos */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Volumen Producido</span>
            <div className="p-2 bg-[#E3EFE7] rounded-xl text-[#00603C]">
              <Scale className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-2xl md:text-3xl font-bold text-[#00603C]">
              {formatNumberArg(totalKg, 0)}
            </span>
            <span className="text-xs font-sans font-medium text-gray-500">kg</span>
          </div>
          <p className="text-[11px] text-[#2E8B57] font-semibold mt-1">
            ≈ {totalToneladas} Toneladas métricas
          </p>
        </div>

        {/* Realizado vs Pre-Carga Breakdown */}
        <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-700 shadow-sm relative overflow-hidden col-span-1 sm:col-span-2 lg:col-span-2">
          <div className="flex items-center justify-between mb-2 border-b border-slate-800 pb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              Estado de Registro de Lotes
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {countRealizados + countPreCarga} lotes tot.
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="bg-emerald-950/80 p-2.5 rounded-xl border border-emerald-500/30">
              <span className="text-[10px] uppercase font-bold text-emerald-300 block">
                ✅ Realizado
              </span>
              <span className="font-serif text-xl font-bold text-white block mt-0.5">
                {formatNumberArg(kgRealizados, 0)} <span className="text-xs font-sans font-normal text-slate-300">kg</span>
              </span>
              <span className="text-[10px] text-emerald-400/90 font-mono font-semibold">
                {countRealizados} {countRealizados === 1 ? 'lote' : 'lotes'}
              </span>
            </div>

            <div className="bg-amber-950/80 p-2.5 rounded-xl border border-amber-500/30">
              <span className="text-[10px] uppercase font-bold text-amber-300 block">
                ⏳ Pre-Carga
              </span>
              <span className="font-serif text-xl font-bold text-amber-200 block mt-0.5">
                {formatNumberArg(kgPreCarga, 0)} <span className="text-xs font-sans font-normal text-slate-300">kg</span>
              </span>
              <span className="text-[10px] text-amber-400/90 font-mono font-semibold">
                {countPreCarga} {countPreCarga === 1 ? 'lote planificado' : 'lotes planificados'}
              </span>
            </div>
          </div>
        </div>

        {/* Total Bolsas */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Bolsas Producidas</span>
            <div className="p-2 bg-amber-50 rounded-xl text-[#C9922E]">
              <Boxes className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-2xl md:text-3xl font-bold text-[#C9922E]">
              {formatNumberArg(totalBolsas, 0)}
            </span>
            <span className="text-xs font-sans font-medium text-gray-500">bolsas</span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">
            En lotes filtrados activos
          </p>
        </div>

        {/* Promedio Kg por Lote */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Promedio por Lote</span>
            <div className="p-2 bg-[#F5E5DC] rounded-xl text-[#A0522D]">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-2xl md:text-3xl font-bold text-[#A0522D]">
              {formatNumberArg(promedioKgLote, 0)}
            </span>
            <span className="text-xs font-sans font-medium text-gray-500">kg/lote</span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">
            Volumen promedio procesado
          </p>
        </div>

        {/* Proporción de Producción Tratada */}
        <div className="bg-white rounded-2xl p-5 border border-emerald-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900">Producción Tratada</span>
            <div className="p-2 bg-emerald-100 rounded-xl text-emerald-800">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-serif text-2xl md:text-3xl font-bold text-emerald-900">
              {pctProduccionTratada}%
            </span>
            <span className="text-xs font-sans font-semibold text-emerald-700">tratado</span>
          </div>
          
          {/* Barra de Proporción Tratado vs Sin Tratar */}
          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mt-2.5 flex">
            <div
              style={{ width: `${pctProduccionTratada}%` }}
              className="bg-emerald-600 h-full transition-all duration-500"
            />
            <div
              style={{ width: `${pctProduccionSinTratar}%` }}
              className="bg-slate-300 h-full transition-all duration-500"
            />
          </div>

          <div className="flex justify-between items-center text-[10px] text-slate-600 font-semibold mt-1.5">
            <span className="text-emerald-800">{formatNumberArg(totalKgTratado, 0)} kg</span>
            <span className="text-slate-500">{formatNumberArg(totalKgSinTratar, 0)} kg S/T</span>
          </div>
        </div>

      </div>

      {/* SECCIÓN DE GRÁFICOS INTERACTIVOS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* GRÁFICO PRINCIPAL DE AGRUPACIÓN (2 Cols en Desktop) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#00603C]" />
                Distribución de Producción
              </h3>
              <p className="text-[11px] text-gray-500">Visualización de volúmenes agrupados según filtros activos</p>
            </div>

            {/* Controles del Gráfico */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={groupByField}
                onChange={(e) => setGroupByField(e.target.value as any)}
                className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#00603C]"
              >
                <option value="cliente">Por Cliente</option>
                <option value="especie">Por Especie</option>
                <option value="variedad">Por Variedad</option>
                <option value="categoria">Por Categoría</option>
                <option value="tipo">Por Tipo Lote</option>
                <option value="tratamientoStr">Por Tratamiento</option>
              </select>

              <div className="flex bg-gray-100 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => setChartType('bar')}
                  className={`p-1.5 rounded-md transition ${chartType === 'bar' ? 'bg-white shadow-xs text-[#00603C]' : 'text-gray-500'}`}
                  title="Gráfico de Barras"
                >
                  <BarChart3 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setChartType('pie')}
                  className={`p-1.5 rounded-md transition ${chartType === 'pie' ? 'bg-white shadow-xs text-[#00603C]' : 'text-gray-500'}`}
                  title="Gráfico de Torta"
                >
                  <PieChartIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Renderizado de Recharts */}
          <div className="h-72 w-full pt-2">
            {groupedChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-xs italic">
                No hay datos de producción para los filtros seleccionados
              </div>
            ) : chartType === 'bar' ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={groupedChartData} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: '#4B5563' }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#4B5563' }}
                    tickFormatter={(val) => `${(val / 1000).toFixed(0)}k kg`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="kgProducidos" radius={[6, 6, 0, 0]}>
                    {groupedChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLOR_PALETTE[index % COLOR_PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={groupedChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="kgProducidos"
                    nameKey="name"
                    label={({ name, percent }: any) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {groupedChartData.map((_, index) => (
                      <Cell key={`pie-cell-${index}`} fill={COLOR_PALETTE[index % COLOR_PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* EVOLUCIÓN TEMPORAL DE PRODUCCIÓN (1 Col) */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="border-b border-gray-100 pb-3">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#C9922E]" />
              Evolución Temporal
            </h3>
            <p className="text-[11px] text-gray-500">Acumulado de producción por fechas</p>
          </div>

          <div className="h-72 w-full pt-2">
            {timeChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-xs italic">
                Sin registros temporales
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeChartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <defs>
                    <linearGradient id="colorKg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00603C" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#00603C" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: '#4B5563' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#4B5563' }} tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="kg" stroke="#00603C" strokeWidth={2.5} fillOpacity={1} fill="url(#colorKg)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

      {/* SECCIÓN ÍNDICE DE EFICIENCIA OPERATIVA (KG PROCESADOS / HORAS HOMBRE) */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white rounded-3xl p-6 md:p-8 shadow-xl space-y-6 border border-slate-700/60">
        
        {/* Header de la Sección */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-700/60 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <Gauge className="w-3 h-3 text-emerald-400" />
                Métrica OEE / Rendimiento de Planta
              </span>
              <span className="text-xs text-slate-400">• Órdenes de Proceso Finalizadas</span>
            </div>
            <h2 className="text-xl md:text-2xl font-serif font-bold text-white flex items-center gap-2.5">
              <Zap className="w-6 h-6 text-amber-400 shrink-0" />
              Índice de Eficiencia Operativa (KG / Horas Hombre)
            </h2>
            <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
              Calcula y analiza la relación entre el volumen total de semilla procesada y las horas-hombre efectivas invertidas en planta por el equipo técnico durante la ejecución de las Órdenes de Proceso finalizadas (<code className="bg-slate-800 px-1.5 py-0.5 rounded text-emerald-300 font-mono text-[11px]">TERMINADO</code>).
            </p>
          </div>

          {/* Quick Target Benchmark Control */}
          <div className="flex items-center gap-3 bg-slate-800/80 p-3 rounded-2xl border border-slate-700 shrink-0">
            <Target className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Meta Target Planta</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <input
                  type="number"
                  step="100"
                  min="500"
                  max="10000"
                  value={effBenchmarkTarget}
                  onChange={(e) => setEffBenchmarkTarget(Number(e.target.value) || 2000)}
                  className="w-20 px-2 py-0.5 text-xs font-bold font-mono bg-slate-900 border border-slate-600 rounded text-emerald-400 focus:outline-none focus:border-emerald-400"
                />
                <span className="text-xs font-semibold text-slate-300">kg/hh</span>
              </div>
            </div>
          </div>
        </div>

        {/* Top KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Índice Global Promedio */}
          <div className="bg-slate-800/90 rounded-2xl p-5 border border-emerald-500/30 relative overflow-hidden group hover:border-emerald-400 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Índice Global Eficiencia</span>
              <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-400">
                <Gauge className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-serif text-3xl font-bold text-emerald-400">
                {formatNumberArg(efficiencyAnalysis.globalIndice, 0)}
              </span>
              <span className="text-xs font-mono font-medium text-slate-300">kg / hs-hombre</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Vs Target:</span>
              <span className={`font-bold px-2 py-0.5 rounded ${
                efficiencyAnalysis.globalIndice >= effBenchmarkTarget
                  ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-500/40'
                  : 'bg-amber-900/60 text-amber-300 border border-amber-500/40'
              }`}>
                {efficiencyAnalysis.globalIndice >= effBenchmarkTarget ? '▲ Supera Meta' : '▼ Bajo Meta'}
              </span>
            </div>
          </div>

          {/* Card 2: Total KG Procesados */}
          <div className="bg-slate-800/90 rounded-2xl p-5 border border-slate-700/80 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Volumen Procesado OP Finales</span>
              <div className="p-2 bg-blue-500/20 rounded-xl text-blue-400">
                <Scale className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-serif text-3xl font-bold text-white">
                {formatNumberArg(efficiencyAnalysis.totalKg, 0)}
              </span>
              <span className="text-xs font-mono font-medium text-slate-400">kg</span>
            </div>
            <p className="text-[11px] text-blue-400 font-semibold mt-2">
              ≈ {(efficiencyAnalysis.totalKg / 1000).toFixed(1)} Tn métricas en {efficiencyAnalysis.finishedOps.length} OPs
            </p>
          </div>

          {/* Card 3: Total Horas Hombre */}
          <div className="bg-slate-800/90 rounded-2xl p-5 border border-slate-700/80 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Horas Hombre (HH)</span>
              <div className="p-2 bg-amber-500/20 rounded-xl text-amber-400">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-serif text-3xl font-bold text-amber-300">
                {efficiencyAnalysis.totalHH.toFixed(1)}
              </span>
              <span className="text-xs font-mono font-medium text-slate-400">hs-hombre</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 font-medium">
              {efficiencyAnalysis.totalHorasPlanta.toFixed(1)} hs efectivas de trabajo de planta
            </p>
          </div>

          {/* Card 4: Mejor Performance alcanzada */}
          <div className="bg-slate-800/90 rounded-2xl p-5 border border-slate-700/80 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Máximo Rendimiento Registrado</span>
              <div className="p-2 bg-purple-500/20 rounded-xl text-purple-400">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            {efficiencyAnalysis.maxOpRecord ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="font-serif text-3xl font-bold text-purple-300">
                    {formatNumberArg(efficiencyAnalysis.maxOpRecord.indiceEficiencia, 0)}
                  </span>
                  <span className="text-xs font-mono font-medium text-slate-400">kg/hh</span>
                </div>
                <p className="text-[11px] text-slate-300 truncate mt-2">
                  OP N° {efficiencyAnalysis.maxOpRecord.numeroOrden} ({efficiencyAnalysis.maxOpRecord.especie} - {efficiencyAnalysis.maxOpRecord.cliente})
                </p>
              </>
            ) : (
              <p className="text-xs text-slate-400 italic mt-2">Sin OPs finalizadas</p>
            )}
          </div>

        </div>

        {/* Filtros de la Sección Eficiencia & Gráficos */}
        <div className="bg-slate-800/80 rounded-2xl p-5 border border-slate-700/70 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700/60 pb-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <Filter className="w-4 h-4 text-emerald-400" />
              <span>Filtros Específicos para Análisis de Eficiencia</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Filtro Especie */}
              <select
                value={effEspecieFilter}
                onChange={(e) => setEffEspecieFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="TODAS">Especie: Todas</option>
                {efficiencyAnalysis.especiesList.map(esp => (
                  <option key={esp} value={esp}>{esp}</option>
                ))}
              </select>

              {/* Filtro Cliente */}
              <select
                value={effClienteFilter}
                onChange={(e) => setEffClienteFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="TODOS">Cliente: Todos</option>
                {efficiencyAnalysis.clientesList.map(cli => (
                  <option key={cli} value={cli}>{cli}</option>
                ))}
              </select>

              {/* Reset Button */}
              {(effEspecieFilter !== 'TODAS' || effClienteFilter !== 'TODOS' || effTipoFilter !== 'TODOS') && (
                <button
                  type="button"
                  onClick={() => {
                    setEffEspecieFilter('TODAS');
                    setEffClienteFilter('TODOS');
                    setEffTipoFilter('TODOS');
                  }}
                  className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-lg transition flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Gráfico de Eficiencia Comparativo */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
            
            {/* Gráfico Barras por OP (2 Cols) */}
            <div className="lg:col-span-2 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span>Índice de Eficiencia por Orden de Proceso (kg / Horas-Hombre)</span>
                <span className="text-[10px] text-amber-400 font-mono">--- Línea roja: Meta Target ({effBenchmarkTarget} kg/hh)</span>
              </div>
              <div className="h-64 w-full bg-slate-900/60 rounded-xl p-3 border border-slate-700/60">
                {efficiencyAnalysis.opsChartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">
                    No hay OPs finalizadas matching con los filtros
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={efficiencyAnalysis.opsChartData} margin={{ top: 15, right: 15, left: 10, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} tickFormatter={(val) => `${val} kg/hh`} />
                      <Tooltip content={<CustomTooltip />} />
                      <ReferenceLine y={effBenchmarkTarget} stroke="#F59E0B" strokeDasharray="4 4" label={{ value: 'Target', fill: '#F59E0B', fontSize: 10 }} />
                      <Bar dataKey="indice" radius={[6, 6, 0, 0]} name="Índice (kg/hh)">
                        {efficiencyAnalysis.opsChartData.map((entry, index) => (
                          <Cell
                            key={`cell-eff-${index}`}
                            fill={entry.indice >= effBenchmarkTarget ? '#10B981' : '#F59E0B'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Gráfico Eficiencia por Especie (1 Col) */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-300">
                <span>Eficiencia Promedio por Especie (kg/hh)</span>
              </div>
              <div className="h-64 w-full bg-slate-900/60 rounded-xl p-3 border border-slate-700/60">
                {efficiencyAnalysis.opsByEspecieChart.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">
                    Sin datos
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={efficiencyAnalysis.opsByEspecieChart} margin={{ top: 15, right: 15, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="indice" fill="#3B82F6" radius={[6, 6, 0, 0]} name="Kg/HH Promedio" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* SIMULADOR DE EFICIENCIA INTERACTIVO */}
        <div className="bg-slate-800/90 rounded-2xl p-5 border border-slate-700/80 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-700/60 pb-3">
            <Calculator className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Simulador / Calculadora de Eficiencia de Planta</h3>
              <p className="text-[11px] text-slate-400">Estimate el índice de productividad para próximos lotes de producción</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
            
            {/* Input Kg */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Volumen a Procesar (kg)</label>
              <input
                type="number"
                step="5000"
                min="1000"
                value={simKg}
                onChange={(e) => setSimKg(Math.max(1000, Number(e.target.value) || 0))}
                className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white font-mono font-bold focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Input Operarios */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Operarios Asignados</label>
              <input
                type="number"
                min="1"
                max="20"
                value={simOperarios}
                onChange={(e) => setSimOperarios(Math.max(1, Number(e.target.value) || 1))}
                className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white font-mono font-bold focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Input Horas Planta */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Horas Efectivas Planta</label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={simHoras}
                onChange={(e) => setSimHoras(Math.max(0.5, Number(e.target.value) || 0.5))}
                className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white font-mono font-bold focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Resultado Estimado */}
            {(() => {
              const simHH = simOperarios * simHoras;
              const simIndice = simHH > 0 ? Math.round(simKg / simHH) : 0;
              const diffPct = efficiencyAnalysis.globalIndice > 0
                ? (((simIndice - efficiencyAnalysis.globalIndice) / efficiencyAnalysis.globalIndice) * 100).toFixed(1)
                : '0';

              return (
                <div className="bg-slate-900 p-3 rounded-xl border border-emerald-500/40 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Índice Estimado Simulación</span>
                  <div className="flex items-baseline justify-center gap-1 mt-0.5">
                    <span className="font-serif text-2xl font-bold text-emerald-400">{formatNumberArg(simIndice, 0)}</span>
                    <span className="text-[10px] text-slate-300 font-mono">kg/hh</span>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400 block mt-0.5">
                    ({simHH.toFixed(1)} Horas Hombre tot. • {Number(diffPct) >= 0 ? '+' : ''}{diffPct}% vs Promedio)
                  </span>
                </div>
              );
            })()}

          </div>
        </div>

        {/* TABLA DETALLE DE EFICIENCIA POR ÓRDENES FINALIZADAS */}
        <div className="bg-slate-800/90 rounded-2xl p-5 border border-slate-700/80 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700/60 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-emerald-400" />
                Tabla Detalle de Eficiencia por Orden de Proceso Finalizada
              </h3>
              <p className="text-[11px] text-slate-400">Listado consolidado de OPs finalizadas y su rendimiento de Horas-Hombre</p>
            </div>

            {/* Search Box */}
            <div className="relative w-full sm:w-60">
              <input
                type="text"
                placeholder="Buscar N° OP, cliente..."
                value={effTableSearch}
                onChange={(e) => {
                  setEffTableSearch(e.target.value);
                  setEffTablePage(1);
                }}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2 pointer-events-none" />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-700/60">
            <table className="w-full text-left text-xs text-slate-200">
              <thead className="bg-slate-900/80 text-emerald-400 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">N° OP</th>
                  <th className="py-2.5 px-3">Tipo</th>
                  <th className="py-2.5 px-3">Cliente</th>
                  <th className="py-2.5 px-3">Especie / Variedad</th>
                  <th className="py-2.5 px-3">Envase Destino</th>
                  <th className="py-2.5 px-3 text-right">Volumen (kg)</th>
                  <th className="py-2.5 px-3 text-center">Operarios</th>
                  <th className="py-2.5 px-3 text-center">Horas Planta</th>
                  <th className="py-2.5 px-3 text-center">Total HH</th>
                  <th className="py-2.5 px-3 text-right">Índice (kg/hh)</th>
                  <th className="py-2.5 px-3 text-center">Desempeño</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60 text-slate-300">
                {efficiencyAnalysis.filteredOps.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-6 text-center text-slate-400 italic">
                      No se encontraron Órdenes de Proceso finalizadas para los criterios seleccionados.
                    </td>
                  </tr>
                ) : (
                  efficiencyAnalysis.filteredOps
                    .slice((effTablePage - 1) * effTableItemsPerPage, effTablePage * effTableItemsPerPage)
                    .map((op, idx) => {
                      const isOptimal = op.indiceEficiencia >= effBenchmarkTarget;
                      const isWarning = op.indiceEficiencia < effBenchmarkTarget && op.indiceEficiencia >= 1200;

                      return (
                        <tr key={op.id || idx} className="hover:bg-slate-700/40 transition">
                          <td className="py-2.5 px-3 font-mono font-bold text-white">
                            OP {op.numeroOrden}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-700 text-slate-200">
                              {op.tipoOrden}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-emerald-300">
                            {op.cliente}
                          </td>
                          <td className="py-2.5 px-3">
                            {op.especie} <span className="text-slate-400 text-[11px]">({op.variedad})</span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">
                            {op.envaseDestino}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                            {formatNumberArg(op.kgProcesados, 0)} kg
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono">
                            {op.operarios} op.
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono">
                            {op.horasTrabajadas.toFixed(1)} hs
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-amber-300">
                            {op.horasHombre.toFixed(1)} hh
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-extrabold text-emerald-400 text-sm">
                            {formatNumberArg(op.indiceEficiencia, 0)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                              isOptimal
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : isWarning
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-red-500/20 text-red-300 border border-red-500/40'
                            }`}>
                              {isOptimal ? 'Óptimo' : isWarning ? 'Aceptable' : 'Atención'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Pagination */}
          {efficiencyAnalysis.filteredOps.length > effTableItemsPerPage && (
            <div className="flex items-center justify-between pt-2 text-xs text-slate-400">
              <span>
                Página <strong className="text-white">{effTablePage}</strong> de <strong className="text-white">{Math.ceil(efficiencyAnalysis.filteredOps.length / effTableItemsPerPage)}</strong>
              </span>
              <div className="flex items-center gap-1">
                <button
                  disabled={effTablePage === 1}
                  onClick={() => setEffTablePage(p => Math.max(1, p - 1))}
                  className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white rounded font-semibold transition"
                >
                  Anterior
                </button>
                <button
                  disabled={effTablePage >= Math.ceil(efficiencyAnalysis.filteredOps.length / effTableItemsPerPage)}
                  onClick={() => setEffTablePage(p => Math.min(Math.ceil(efficiencyAnalysis.filteredOps.length / effTableItemsPerPage), p + 1))}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded font-semibold transition"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* TABLA DETALLE DE LOTES DE PRODUCCIÓN */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Factory className="w-4 h-4 text-[#00603C]" />
              Detalle Consolidado de Eventos de Producción
            </h3>
            <p className="text-[11px] text-gray-500">
              Listado de lotes producidos matching con los {hasActiveFilters ? 'filtros activos' : 'todos los registros'}
            </p>
          </div>

          {/* Búsqueda dentro de la tabla */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Buscar lote, cliente, especie..."
              value={tableSearch}
              onChange={(e) => {
                setTableSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00603C]"
            />
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5 pointer-events-none" />
          </div>
        </div>

        {/* Tabla Responsive */}
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#E3EFE7] text-[#00603C] uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="py-3 px-4">Modo Registro</th>
                <th className="py-3 px-4">Fecha/Hora Prod.</th>
                <th className="py-3 px-4">N° Lote</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Especie</th>
                <th className="py-3 px-4">Variedad</th>
                <th className="py-3 px-4">Categoría</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Tratamiento</th>
                <th className="py-3 px-4 text-right">Bolsas</th>
                <th className="py-3 px-4 text-right">Kg Producidos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-gray-400 italic">
                    No se encontraron registros de producción para la búsqueda realizada.
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((r, idx) => (
                  <tr key={`${r.id}-${idx}`} className="hover:bg-gray-50 transition">
                    <td className="py-3 px-4 whitespace-nowrap">
                      {r.estadoRegistro === 'PRE-CARGA' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-[10px] rounded-full">
                          <Clock className="w-3 h-3 text-amber-600" />
                          PRE-CARGA
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 font-extrabold text-[10px] rounded-full">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          REALIZADO
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-gray-700 whitespace-nowrap">
                      {r.fechaHoraProduccion ? r.fechaHoraProduccion.replace('T', ' ') : r.fechaProduccion}
                    </td>
                    <td className="py-3 px-4 font-bold text-gray-900 whitespace-nowrap">
                      {r.loteNro}
                    </td>
                    <td className="py-3 px-4 font-semibold text-[#00603C]">
                      {r.cliente}
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-800">
                      {r.especie}
                    </td>
                    <td className="py-3 px-4 font-mono text-gray-700">
                      {r.variedad}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-800 text-[10px] font-bold rounded-md">
                        {r.categoria}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 text-[10px] font-bold rounded-md">
                        {r.tipo}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[11px] text-gray-600 max-w-xs truncate">
                      {r.tratamientoStr}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-gray-800">
                      {formatNumberArg(r.bolsasProducidas, 0)} b.
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-[#00603C]">
                      {formatNumberArg(r.kgProducidos, 0)} kg
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 text-xs text-gray-600">
            <span>
              Página <strong className="text-gray-900">{currentPage}</strong> de <strong className="text-gray-900">{totalPages}</strong>
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 font-bold rounded-lg transition"
              >
                Anterior
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className="px-3 py-1 bg-[#00603C] hover:bg-[#254731] text-white disabled:opacity-50 font-bold rounded-lg transition"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}

      </div>

    </div>
  );
};
