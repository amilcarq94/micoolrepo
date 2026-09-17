/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Lote,
  SalidaRegistrada,
  MovimientoSilo,
  Chofer,
  SiloId
} from '../types';
import { getGlobalAuditLogs } from '../utils/auditLogger';
import { getLoteAuditoria } from '../utils/audit';
import { formatNumberArg } from '../utils/formatters';
import {
  Activity,
  Warehouse,
  Truck,
  ShieldCheck,
  Calendar,
  Filter,
  Search,
  X,
  FileSpreadsheet,
  Download,
  Layers,
  Clock,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Eye,
  CheckCircle2,
  AlertCircle,
  Building2,
  Scale,
  Boxes,
  User,
  MapPin,
  RotateCcw,
  BarChart3,
  PieChart as PieChartIcon,
  Tag,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  CalendarRange,
  Check,
  Package
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

export type EventSourceType = 'SILOS' | 'SALIDAS' | 'AUDITORIA_LOTE';

export interface UnifiedPlantEvent {
  id: string;
  source: EventSourceType;
  timestamp: number;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:mm
  fechaDisplay: string;
  tipoOperacion: string;
  tipoBadgeVariant: 'ingreso' | 'egreso' | 'salida' | 'creacion' | 'modificacion' | 'ajuste';
  tituloPrincipal: string;
  descripcionSecundaria: string;
  cliente: string;
  especie: string;
  variedad: string;
  kg: number;
  bolsas?: number;
  signoKg: '+' | '-' | '=' | '';
  origenUbicacion?: string;
  destinoUbicacion?: string;
  referenciaId?: string;
  operadorUsuario?: string;
  transporteChofer?: string;
  patente?: string;
  documentoRef?: string;
  observaciones?: string;
  loteAsociado?: Lote;
  rawEvent?: any;
}

interface DashboardOperacionesProps {
  lotes: Lote[];
  movimientosSilo: MovimientoSilo[];
  salidas: SalidaRegistrada[];
  siloStocks?: Record<string, number>;
  clientes: string[];
  especies: string[];
  choferes?: Chofer[];
  currentUser?: string;
  onSelectLote?: (lote: Lote) => void;
  onNavigateToView?: (view: string) => void;
}

const COLORS_MODULE = {
  SILOS: '#C9922E', // Amber / Warehouse
  SALIDAS: '#0284C7', // Sky / Truck
  AUDITORIA_LOTE: '#00603C' // Forest green / Shield
};

export const DashboardOperaciones: React.FC<DashboardOperacionesProps> = ({
  lotes,
  movimientosSilo,
  salidas,
  siloStocks,
  clientes,
  especies,
  choferes = [],
  currentUser = 'Operador Planta',
  onSelectLote,
  onNavigateToView
}) => {
  // Filtros de estado
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSource, setSelectedSource] = useState<'TODOS' | EventSourceType>('TODOS');
  const [selectedCliente, setSelectedCliente] = useState<string>('TODOS');
  const [selectedEspecie, setSelectedEspecie] = useState<string>('TODOS');
  const [dateRangePreset, setDateRangePreset] = useState<'TODOS' | 'HOY' | '7DIAS' | '30DIAS' | 'MES_ACTUAL' | 'CUSTOM'>('TODOS');
  const [fechaDesde, setFechaDesde] = useState<string>('');
  const [fechaHasta, setFechaHasta] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'DESC' | 'ASC'>('DESC');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [activeTab, setActiveTab] = useState<'TIMELINE' | 'GRAFICOS'>('TIMELINE');

  // Mapa rápido de lotes por ID para referencias cruzadas
  const lotesMap = useMemo(() => {
    const map = new Map<string, Lote>();
    lotes.forEach((l) => {
      map.set(l.id, l);
      if (l.loteNro) map.set(l.loteNro, l);
    });
    return map;
  }, [lotes]);

  // 1. CONSTRUCCIÓN DEL HISTORIAL GLOBAL UNIFICADO DE EVENTOS
  const allUnifiedEvents = useMemo<UnifiedPlantEvent[]>(() => {
    const events: UnifiedPlantEvent[] = [];

    // A. Eventos de Movimientos de Silos
    movimientosSilo.forEach((m, idx) => {
      const fechaVal = m.fecha || '2026-01-01';
      const horaVal = m.hora || '09:00';
      const ts = new Date(`${fechaVal}T${horaVal}:00`).getTime() || Date.now();

      const isIngreso = m.tipo === 'INGRESO';
      const isEgreso = m.tipo.includes('EGRESO');
      const isAjuste = m.tipo.includes('AJUSTE') || m.tipo.includes('DESCONTAMINACION');

      let tipoVariant: UnifiedPlantEvent['tipoBadgeVariant'] = 'ingreso';
      if (isEgreso) tipoVariant = 'egreso';
      if (isAjuste) tipoVariant = 'ajuste';

      const origen = m.campoOrigen
        ? `${m.campoOrigen}${m.bolsonOrigenNro ? ` (Bolsón: ${m.bolsonOrigenNro})` : ''}`
        : m.depositoOrigen || m.siloId;

      const destino = isIngreso ? m.siloId : 'Planta de Clasificación / Proceso';

      events.push({
        id: `SILO-${m.id || idx}`,
        source: 'SILOS',
        timestamp: ts,
        fecha: fechaVal,
        hora: horaVal,
        fechaDisplay: `${fechaVal} ${horaVal}`,
        tipoOperacion: isIngreso ? 'Ingreso a Silo' : isEgreso ? 'Egreso de Silo' : 'Ajuste de Silo',
        tipoBadgeVariant: tipoVariant,
        tituloPrincipal: `${isIngreso ? 'Ingreso de Grano' : isEgreso ? 'Extracción / Egreso' : 'Ajuste'} en ${m.siloId}`,
        descripcionSecundaria: `${m.cliente || 'Sin cliente'} • ${m.especie || 'Cereal'} ${m.variedad ? `(${m.variedad})` : ''}`,
        cliente: m.cliente || 'Sin cliente',
        especie: m.especie || 'Sin especie',
        variedad: m.variedad || '—',
        kg: m.kg || 0,
        signoKg: isIngreso ? '+' : isEgreso ? '-' : '=',
        origenUbicacion: origen,
        destinoUbicacion: destino,
        referenciaId: m.siloId,
        operadorUsuario: 'Operador de Silos',
        transporteChofer: m.chofer,
        patente: m.patentes,
        documentoRef: m.remito || m.cartaPorte || m.comprobanteCartaPorte,
        observaciones: m.observaciones || (m.motivoManual ? `Motivo: ${m.motivoManual}` : undefined),
        rawEvent: m
      });
    });

    // B. Eventos de Salidas Registradas (Despachos a clientes)
    salidas.forEach((s) => {
      const fechaVal = s.fecha || '2026-01-01';
      const horaVal = '11:00';
      const ts = new Date(`${fechaVal}T${horaVal}:00`).getTime() || Date.now();
      const loteRef = lotesMap.get(s.loteId);

      events.push({
        id: `SALIDA-${s.id}`,
        source: 'SALIDAS',
        timestamp: ts,
        fecha: fechaVal,
        hora: horaVal,
        fechaDisplay: `${fechaVal} ${horaVal}`,
        tipoOperacion: 'Salida / Despacho',
        tipoBadgeVariant: 'salida',
        tituloPrincipal: `Despacho de Mercadería • Remito ${s.id}`,
        descripcionSecundaria: `${s.cliente} • Lote ${s.loteId} (${s.producto || loteRef?.especie || 'Semilla'})`,
        cliente: s.cliente,
        especie: loteRef?.especie || s.producto || 'Semilla',
        variedad: loteRef?.variedad || '—',
        kg: s.totalKg || 0,
        bolsas: s.cantidadBolsas,
        signoKg: '-',
        origenUbicacion: `Lote ${s.loteId}${loteRef?.ala ? ` (Ala ${loteRef.ala})` : ''}`,
        destinoUbicacion: s.destino || 'Destino Cliente / Acopio',
        referenciaId: s.loteId,
        operadorUsuario: 'Balanza / Despachos',
        transporteChofer: s.choferNombre ? `${s.choferNombre} (DNI: ${s.choferDni || 'S/D'})` : undefined,
        patente: s.patenteCamion,
        documentoRef: s.remitoCliente ? `Remito Cli: ${s.remitoCliente}` : `Remito Int: ${s.id}`,
        observaciones: `Envase: ${s.envase || 'Bolsa'} (${s.kgPorBolsa || 40} kg/b). Tara: ${s.taraCamion ? `${s.taraCamion} kg` : '—'}.`,
        loteAsociado: loteRef,
        rawEvent: s
      });
    });

    // C. Eventos de Auditoría de Lotes y Trazabilidad
    const auditMap = new Map<string, UnifiedPlantEvent>();

    // 1) Recorrer auditorías internas de cada lote
    lotes.forEach((l) => {
      const auditEntries = getLoteAuditoria(l);
      auditEntries.forEach((entry) => {
        const rawDate = entry.fechaHora || l.fechaIngreso || '2026-01-01';
        const parts = rawDate.split('T');
        const fechaVal = parts[0] || '2026-01-01';
        const horaVal = parts[1] ? parts[1].substring(0, 5) : '08:30';
        const ts = new Date(rawDate).getTime() || Date.now();

        const isCreacion = entry.tipo.toLowerCase().includes('creación') || entry.tipo.toLowerCase().includes('alta');
        const isStock = entry.tipo.toLowerCase().includes('stock') || entry.tipo.toLowerCase().includes('ajuste');

        let tipoVariant: UnifiedPlantEvent['tipoBadgeVariant'] = 'modificacion';
        if (isCreacion) tipoVariant = 'creacion';
        else if (isStock) tipoVariant = 'ajuste';

        const uniqueKey = `AUD-LOTE-${entry.id || `${l.id}-${fechaVal}`}`;
        auditMap.set(uniqueKey, {
          id: uniqueKey,
          source: 'AUDITORIA_LOTE',
          timestamp: ts,
          fecha: fechaVal,
          hora: horaVal,
          fechaDisplay: `${fechaVal} ${horaVal}`,
          tipoOperacion: entry.tipo || 'Auditoría Lote',
          tipoBadgeVariant: tipoVariant,
          tituloPrincipal: `${entry.tipo}: Lote ${l.loteNro || l.id}`,
          descripcionSecundaria: `${l.cliente} • ${l.especie} ${l.variedad} • ${entry.descripcion}`,
          cliente: l.cliente,
          especie: l.especie,
          variedad: l.variedad,
          kg: l.stockKg || 0,
          bolsas: l.stockBolsas,
          signoKg: isCreacion ? '+' : '',
          origenUbicacion: l.ala ? `Ala ${l.ala} - Sector ${l.sector || '1'}` : 'Planta',
          destinoUbicacion: 'Inventario de Planta',
          referenciaId: l.loteNro || l.id,
          operadorUsuario: entry.usuario || 'Personal Planta',
          observaciones: entry.detalles || entry.descripcion,
          loteAsociado: l,
          rawEvent: entry
        });
      });
    });

    // 2) Incorporar logs de auditoría global persistidos
    const globalLogs = getGlobalAuditLogs();
    globalLogs.forEach((g) => {
      const rawDate = g.fechaHora || '2026-01-01';
      const parts = rawDate.split('T');
      const fechaVal = parts[0] || '2026-01-01';
      const horaVal = parts[1] ? parts[1].substring(0, 5) : '08:30';
      const ts = new Date(rawDate).getTime() || Date.now();

      const uniqueKey = `GLOBAL-${g.id}`;
      if (!auditMap.has(uniqueKey)) {
        const loteRef = g.entidadId ? lotesMap.get(g.entidadId) : undefined;
        auditMap.set(uniqueKey, {
          id: uniqueKey,
          source: 'AUDITORIA_LOTE',
          timestamp: ts,
          fecha: fechaVal,
          hora: horaVal,
          fechaDisplay: `${fechaVal} ${horaVal}`,
          tipoOperacion: g.tipo || 'Registro de Sistema',
          tipoBadgeVariant: 'modificacion',
          tituloPrincipal: `${g.modulo || 'Planta'}: ${g.descripcion}`,
          descripcionSecundaria: g.detalles || (g.entidadId ? `Referencia: ${g.entidadId}` : 'Operación de auditoría'),
          cliente: loteRef?.cliente || 'Planta Clasificadora',
          especie: loteRef?.especie || 'General',
          variedad: loteRef?.variedad || '—',
          kg: loteRef?.stockKg || 0,
          bolsas: loteRef?.stockBolsas,
          signoKg: '',
          referenciaId: g.entidadId,
          operadorUsuario: g.usuario || 'Sistema',
          observaciones: g.detalles,
          loteAsociado: loteRef,
          rawEvent: g
        });
      }
    });

    events.push(...Array.from(auditMap.values()));

    // Ordenar cronológicamente
    return events.sort((a, b) => b.timestamp - a.timestamp);
  }, [movimientosSilo, salidas, lotes, lotesMap]);

  // 2. FILTRADO MULTIDIMENSIONAL
  const filteredEvents = useMemo(() => {
    // Definir rango de fechas según preset o custom
    const hoyStr = new Date().toISOString().split('T')[0];
    let desde = fechaDesde;
    let hasta = fechaHasta;

    if (dateRangePreset === 'HOY') {
      desde = hoyStr;
      hasta = hoyStr;
    } else if (dateRangePreset === '7DIAS') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      desde = d.toISOString().split('T')[0];
      hasta = hoyStr;
    } else if (dateRangePreset === '30DIAS') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      desde = d.toISOString().split('T')[0];
      hasta = hoyStr;
    } else if (dateRangePreset === 'MES_ACTUAL') {
      const now = new Date();
      desde = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      hasta = hoyStr;
    }

    return allUnifiedEvents.filter((ev) => {
      // Filtro por fuente
      if (selectedSource !== 'TODOS' && ev.source !== selectedSource) {
        return false;
      }

      // Filtro por cliente
      if (selectedCliente !== 'TODOS' && ev.cliente !== selectedCliente) {
        return false;
      }

      // Filtro por especie
      if (selectedEspecie !== 'TODOS' && ev.especie !== selectedEspecie) {
        return false;
      }

      // Filtro por fechas
      if (desde && ev.fecha < desde) return false;
      if (hasta && ev.fecha > hasta) return false;

      // Filtro por texto de búsqueda
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchTitle = ev.tituloPrincipal.toLowerCase().includes(q);
        const matchDesc = ev.descripcionSecundaria.toLowerCase().includes(q);
        const matchCliente = ev.cliente.toLowerCase().includes(q);
        const matchEspecie = ev.especie.toLowerCase().includes(q);
        const matchVariedad = ev.variedad.toLowerCase().includes(q);
        const matchRef = (ev.referenciaId || '').toLowerCase().includes(q);
        const matchDoc = (ev.documentoRef || '').toLowerCase().includes(q);
        const matchChofer = (ev.transporteChofer || '').toLowerCase().includes(q);
        const matchPatente = (ev.patente || '').toLowerCase().includes(q);
        const matchUser = (ev.operadorUsuario || '').toLowerCase().includes(q);
        const matchObs = (ev.observaciones || '').toLowerCase().includes(q);

        if (
          !matchTitle &&
          !matchDesc &&
          !matchCliente &&
          !matchEspecie &&
          !matchVariedad &&
          !matchRef &&
          !matchDoc &&
          !matchChofer &&
          !matchPatente &&
          !matchUser &&
          !matchObs
        ) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      return sortOrder === 'DESC' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp;
    });
  }, [allUnifiedEvents, selectedSource, selectedCliente, selectedEspecie, dateRangePreset, fechaDesde, fechaHasta, searchTerm, sortOrder]);

  // Agrupación por fecha para la línea de tiempo visual
  const groupedEventsByDate = useMemo(() => {
    const groups: { [fecha: string]: UnifiedPlantEvent[] } = {};
    filteredEvents.forEach((ev) => {
      if (!groups[ev.fecha]) {
        groups[ev.fecha] = [];
      }
      groups[ev.fecha].push(ev);
    });
    return groups;
  }, [filteredEvents]);

  // Paginación
  const totalPages = Math.ceil(filteredEvents.length / itemsPerPage) || 1;
  const pagedEvents = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredEvents.slice(start, start + itemsPerPage);
  }, [filteredEvents, currentPage, itemsPerPage]);

  // Paged grouped events
  const pagedGroupedEvents = useMemo(() => {
    const groups: { [fecha: string]: UnifiedPlantEvent[] } = {};
    pagedEvents.forEach((ev) => {
      if (!groups[ev.fecha]) {
        groups[ev.fecha] = [];
      }
      groups[ev.fecha].push(ev);
    });
    return groups;
  }, [pagedEvents]);

  // 3. MÉTRICAS Y KPIS DE OPERACIONES
  const kpis = useMemo(() => {
    let totalKgSilos = 0;
    let countSilos = 0;
    let totalKgSalidas = 0;
    let totalBolsasSalidas = 0;
    let countSalidas = 0;
    let countAuditoria = 0;

    filteredEvents.forEach((ev) => {
      if (ev.source === 'SILOS') {
        countSilos++;
        totalKgSilos += ev.kg;
      } else if (ev.source === 'SALIDAS') {
        countSalidas++;
        totalKgSalidas += ev.kg;
        totalBolsasSalidas += (ev.bolsas || 0);
      } else if (ev.source === 'AUDITORIA_LOTE') {
        countAuditoria++;
      }
    });

    const totalOperaciones = filteredEvents.length;
    const totalKgMovilizados = totalKgSilos + totalKgSalidas;

    return {
      totalOperaciones,
      totalKgMovilizados,
      totalTn: (totalKgMovilizados / 1000).toFixed(1),
      countSilos,
      totalKgSilos,
      countSalidas,
      totalKgSalidas,
      totalBolsasSalidas,
      countAuditoria
    };
  }, [filteredEvents]);

  // 4. DATOS PARA GRÁFICOS VISUALES
  // A. Distribución por Fuente / Módulo
  const dataPieSource = useMemo(() => {
    return [
      { name: 'Silos Clasificadora', value: kpis.countSilos, color: COLORS_MODULE.SILOS },
      { name: 'Salidas y Despachos', value: kpis.countSalidas, color: COLORS_MODULE.SALIDAS },
      { name: 'Auditoría de Lotes', value: kpis.countAuditoria, color: COLORS_MODULE.AUDITORIA_LOTE }
    ].filter(item => item.value > 0);
  }, [kpis]);

  // B. Volumen por Cliente (Top 6)
  const dataTopClientes = useMemo(() => {
    const clientKgMap: { [c: string]: number } = {};
    filteredEvents.forEach((ev) => {
      if (ev.cliente && ev.cliente !== 'Sin cliente' && ev.cliente !== 'Planta Clasificadora') {
        clientKgMap[ev.cliente] = (clientKgMap[ev.cliente] || 0) + ev.kg;
      }
    });

    return Object.entries(clientKgMap)
      .map(([cliente, kg]) => ({
        cliente: cliente.length > 14 ? `${cliente.substring(0, 14)}…` : cliente,
        clienteFull: cliente,
        kg,
        tn: Number((kg / 1000).toFixed(1))
      }))
      .sort((a, b) => b.kg - a.kg)
      .slice(0, 6);
  }, [filteredEvents]);

  // C. Actividad en el tiempo (últimos 10 días activos)
  const dataActivityByDate = useMemo(() => {
    const dateMap: { [fecha: string]: { fecha: string; Silos: number; Salidas: number; Auditoria: number; total: number } } = {};

    filteredEvents.forEach((ev) => {
      if (!dateMap[ev.fecha]) {
        dateMap[ev.fecha] = { fecha: ev.fecha.slice(5), Silos: 0, Salidas: 0, Auditoria: 0, total: 0 };
      }
      if (ev.source === 'SILOS') dateMap[ev.fecha].Silos++;
      else if (ev.source === 'SALIDAS') dateMap[ev.fecha].Salidas++;
      else if (ev.source === 'AUDITORIA_LOTE') dateMap[ev.fecha].Auditoria++;
      dateMap[ev.fecha].total++;
    });

    return Object.values(dateMap)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .slice(-12);
  }, [filteredEvents]);

  // 5. EXPORTACIÓN A EXCEL UNIFICADA
  const handleExportExcel = () => {
    const rows = filteredEvents.map((ev) => ({
      'Fecha y Hora': ev.fechaDisplay,
      'Módulo / Fuente': ev.source === 'SILOS' ? 'Silos Clasificadora' : ev.source === 'SALIDAS' ? 'Salidas y Despachos' : 'Auditoría de Lotes',
      'Tipo de Operación': ev.tipoOperacion,
      'Referencia ID': ev.referenciaId || '—',
      'Título': ev.tituloPrincipal,
      'Cliente': ev.cliente,
      'Especie': ev.especie,
      'Variedad': ev.variedad,
      'Cantidad Kg': ev.kg,
      'Cantidad Bolsas': ev.bolsas ?? '—',
      'Origen': ev.origenUbicacion || '—',
      'Destino': ev.destinoUbicacion || '—',
      'Chofer / Transporte': ev.transporteChofer || '—',
      'Patente': ev.patente || '—',
      'Documento / Remito': ev.documentoRef || '—',
      'Operario / Usuario': ev.operadorUsuario || '—',
      'Observaciones': ev.observaciones || '—'
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const colWidths = Object.keys(rows[0] || {}).map((key) => {
      const maxLen = Math.max(key.length, ...rows.map((r) => String((r as any)[key] || '').length));
      return { wch: Math.min(Math.max(maxLen + 3, 12), 40) };
    });
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Historial de Operaciones');
    XLSX.writeFile(workbook, `Historial_Operaciones_Planta_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Helper para resetear filtros
  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedSource('TODOS');
    setSelectedCliente('TODOS');
    setSelectedEspecie('TODOS');
    setDateRangePreset('TODOS');
    setFechaDesde('');
    setFechaHasta('');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* ENCABEZADO PRINCIPAL DEL DASHBOARD */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#00603C]/10 border border-[#00603C]/20 flex items-center justify-center text-[#00603C]">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 font-sans tracking-tight">
                  Dashboard de Operaciones & Historial Global
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 font-sans mt-0.5">
                  Línea de tiempo unificada con trazabilidad completa de silos, despachos registrados y auditoría de lotes
                </p>
              </div>
            </div>
          </div>

          {/* Botones de acción superior */}
          <div className="flex items-center gap-2.5 w-full lg:w-auto justify-end flex-wrap">
            {/* Selector de modo de vista: Timeline vs Gráficos */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                id="btn-tab-timeline"
                onClick={() => setActiveTab('TIMELINE')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeTab === 'TIMELINE'
                    ? 'bg-white text-[#00603C] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Línea de Tiempo</span>
              </button>
              <button
                id="btn-tab-graficos"
                onClick={() => setActiveTab('GRAFICOS')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeTab === 'GRAFICOS'
                    ? 'bg-white text-[#00603C] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Métricas y Gráficos</span>
              </button>
            </div>

            {/* Exportar Excel */}
            <button
              id="btn-exportar-operaciones-excel"
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-3.5 py-2 bg-[#00603C] hover:bg-[#254731] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-xs"
              title="Descargar reporte consolidado en archivo Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#C9922E]" />
              <span className="hidden sm:inline">Exportar Excel</span>
            </button>
          </div>
        </div>

        {/* BARRA DE KPIS PRINCIPALES */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-slate-100">
          {/* KPI 1: Eventos Operativos Totales */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 sm:p-4">
            <div className="flex items-center justify-between text-slate-500 mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider">Eventos Totales</span>
              <Layers className="w-4 h-4 text-slate-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black font-mono text-slate-900">
                {kpis.totalOperaciones}
              </span>
              <span className="text-xs text-slate-500 font-sans">registros</span>
            </div>
            <div className="mt-2 text-[10.5px] text-slate-500 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
              <span>En el período filtrado</span>
            </div>
          </div>

          {/* KPI 2: Volumen Silos */}
          <div className="bg-amber-50/50 border border-amber-200/80 rounded-xl p-3.5 sm:p-4">
            <div className="flex items-center justify-between text-amber-800 mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider">Movimientos en Silos</span>
              <Warehouse className="w-4 h-4 text-amber-600" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black font-mono text-amber-950">
                {formatNumberArg(kpis.totalKgSilos, 0)}
              </span>
              <span className="text-xs font-bold text-amber-800">kg</span>
            </div>
            <div className="mt-2 text-[10.5px] text-amber-800 font-sans">
              <strong>{kpis.countSilos}</strong> movimientos registrados
            </div>
          </div>

          {/* KPI 3: Salidas y Despachos */}
          <div className="bg-sky-50/50 border border-sky-200/80 rounded-xl p-3.5 sm:p-4">
            <div className="flex items-center justify-between text-sky-800 mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider">Salidas & Despachos</span>
              <Truck className="w-4 h-4 text-sky-600" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black font-mono text-sky-950">
                {formatNumberArg(kpis.totalKgSalidas, 0)}
              </span>
              <span className="text-xs font-bold text-sky-800">kg</span>
            </div>
            <div className="mt-2 text-[10.5px] text-sky-800 font-sans">
              <strong>{kpis.countSalidas}</strong> remitos • <strong>{formatNumberArg(kpis.totalBolsasSalidas, 0)}</strong> bolsas
            </div>
          </div>

          {/* KPI 4: Auditoría de Lotes */}
          <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-xl p-3.5 sm:p-4">
            <div className="flex items-center justify-between text-emerald-800 mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider">Trazabilidad & Auditoría</span>
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-950">
                {kpis.countAuditoria}
              </span>
              <span className="text-xs text-emerald-800 font-sans">eventos</span>
            </div>
            <div className="mt-2 text-[10.5px] text-emerald-800 font-sans">
              Altas, cambios de stock y calibraciones
            </div>
          </div>
        </div>
      </div>

      {/* PANEL DE FILTROS MULTIDIMENSIONALES */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
        {/* Fila 1: Filtro por Fuente (Chips) */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              Módulo:
            </span>
            <button
              onClick={() => { setSelectedSource('TODOS'); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                selectedSource === 'TODOS'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todos ({allUnifiedEvents.length})
            </button>
            <button
              onClick={() => { setSelectedSource('SILOS'); setCurrentPage(1); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                selectedSource === 'SILOS'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              <Warehouse className="w-3.5 h-3.5" />
              <span>Silos ({movimientosSilo.length})</span>
            </button>
            <button
              onClick={() => { setSelectedSource('SALIDAS'); setCurrentPage(1); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                selectedSource === 'SALIDAS'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-200'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Salidas y Despachos ({salidas.length})</span>
            </button>
            <button
              onClick={() => { setSelectedSource('AUDITORIA_LOTE'); setCurrentPage(1); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                selectedSource === 'AUDITORIA_LOTE'
                  ? 'bg-[#00603C] text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Auditoría de Lotes</span>
            </button>
          </div>

          {/* Botón de orden cronológico */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSortOrder(prev => prev === 'DESC' ? 'ASC' : 'DESC')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition cursor-pointer"
              title="Cambiar orden de visualización"
            >
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>{sortOrder === 'DESC' ? 'Más recientes primero' : 'Más antiguos primero'}</span>
            </button>
            {(searchTerm || selectedSource !== 'TODOS' || selectedCliente !== 'TODOS' || selectedEspecie !== 'TODOS' || dateRangePreset !== 'TODOS') && (
              <button
                onClick={handleResetFilters}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold text-red-700 hover:bg-red-50 transition cursor-pointer"
                title="Limpiar todos los filtros aplicados"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restablecer</span>
              </button>
            )}
          </div>
        </div>

        {/* Fila 2: Búsqueda, Fechas y Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2 border-t border-slate-100">
          {/* Input de Búsqueda */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              placeholder="Buscar por lote, silo, remito, chofer, cliente, detalle..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-[#00603C] focus:border-transparent outline-none transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filtro Cliente */}
          <div>
            <select
              value={selectedCliente}
              onChange={(e) => { setSelectedCliente(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-[#00603C]"
            >
              <option value="TODOS">Todos los Clientes</option>
              {clientes.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Filtro Especie */}
          <div>
            <select
              value={selectedEspecie}
              onChange={(e) => { setSelectedEspecie(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-[#00603C]"
            >
              <option value="TODOS">Todas las Especies</option>
              {especies.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>

          {/* Rango de Fechas Preset */}
          <div>
            <select
              value={dateRangePreset}
              onChange={(e) => {
                setDateRangePreset(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-[#00603C]"
            >
              <option value="TODOS">Todas las fechas</option>
              <option value="HOY">Hoy</option>
              <option value="7DIAS">Últimos 7 días</option>
              <option value="30DIAS">Últimos 30 días</option>
              <option value="MES_ACTUAL">Este mes</option>
              <option value="CUSTOM">Rango personalizado...</option>
            </select>
          </div>
        </div>

        {/* Custom date range inputs if selected */}
        {dateRangePreset === 'CUSTOM' && (
          <div className="flex items-center gap-3 pt-2 border-t border-slate-100 flex-wrap text-xs">
            <span className="font-bold text-slate-600 flex items-center gap-1">
              <CalendarRange className="w-3.5 h-3.5 text-slate-400" />
              Período específico:
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Desde:</span>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => { setFechaDesde(e.target.value); setCurrentPage(1); }}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Hasta:</span>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => { setFechaHasta(e.target.value); setCurrentPage(1); }}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              />
            </div>
          </div>
        )}
      </div>

      {/* CONTENIDO PRINCIPAL: VISTA DE LÍNEA DE TIEMPO VS GRÁFICOS */}
      {activeTab === 'GRAFICOS' ? (
        /* VISTA DE GRÁFICOS ANALÍTICOS DE OPERACIONES */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Gráfico 1: Actividad por Módulo */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-[#00603C]" />
                Distribución por Módulo
              </h3>
              <span className="text-[11px] font-mono text-slate-500">
                {kpis.totalOperaciones} ops
              </span>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dataPieSource}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {dataPieSource.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(val: number, name: string) => [`${val} operaciones`, name]}
                    contentStyle={{ borderRadius: '10px', fontSize: '12px' }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    wrapperStyle={{ fontSize: '11px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gráfico 2: Top Clientes por Volumen */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#C9922E]" />
                Top Clientes por Movimiento (Toneladas)
              </h3>
              <span className="text-[11px] font-mono text-slate-500">
                {kpis.totalTn} Tn totales
              </span>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataTopClientes} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="cliente" tick={{ fontSize: 11 }} stroke="#64748B" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#64748B" />
                  <RechartsTooltip
                    formatter={(val: number) => [`${val} Tn`, 'Volumen']}
                    contentStyle={{ borderRadius: '10px', fontSize: '12px' }}
                  />
                  <Bar dataKey="tn" fill="#00603C" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gráfico 3: Actividad Diaria Reciente */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3 lg:col-span-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-sky-600" />
                Operaciones por Día (Evolución Reciente)
              </h3>
              <span className="text-[11px] font-mono text-slate-500">
                Eventos diarios consolidados
              </span>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataActivityByDate} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="fecha" tick={{ fontSize: 11 }} stroke="#64748B" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#64748B" />
                  <RechartsTooltip contentStyle={{ borderRadius: '10px', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="Silos" stackId="a" fill={COLORS_MODULE.SILOS} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Salidas" stackId="a" fill={COLORS_MODULE.SALIDAS} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Auditoria" stackId="a" fill={COLORS_MODULE.AUDITORIA_LOTE} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : (
        /* VISTA DE LÍNEA DE TIEMPO UNIFICADA */
        <div className="space-y-6">
          {filteredEvents.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800">No se encontraron eventos</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No hay registros que coincidan con los filtros seleccionados de módulo, cliente, fechas o búsqueda.
              </p>
              <button
                onClick={handleResetFilters}
                className="px-4 py-2 bg-[#00603C] hover:bg-[#254731] text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Limpiar filtros
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(pagedGroupedEvents).map(([fecha, eventosDelDia]) => {
                const totalKgDia = eventosDelDia.reduce((acc, e) => acc + (e.kg || 0), 0);

                return (
                  <div key={fecha} className="space-y-3">
                    {/* Encabezado del Día */}
                    <div className="sticky top-20 z-10 flex items-center justify-between bg-slate-900/90 backdrop-blur-md text-white px-4 py-2 rounded-xl shadow-xs">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-[#C9922E]" />
                        <span className="text-xs font-black uppercase tracking-wider font-mono">
                          {fecha}
                        </span>
                        <span className="text-[11px] text-slate-300 font-sans hidden sm:inline">
                          • {eventosDelDia.length} operación{eventosDelDia.length > 1 ? 'es' : ''}
                        </span>
                      </div>
                      {totalKgDia > 0 && (
                        <div className="text-[11px] font-mono text-emerald-300 font-bold">
                          {formatNumberArg(totalKgDia, 0)} kg acumulados
                        </div>
                      )}
                    </div>

                    {/* Línea de eventos del día */}
                    <div className="relative pl-6 sm:pl-8 space-y-3 before:absolute before:left-3 sm:before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                      {eventosDelDia.map((ev) => {
                        const isExpanded = expandedEventId === ev.id;

                        // Variantes visuales según fuente
                        let sourceBadgeBg = 'bg-amber-100 text-amber-900 border-amber-300';
                        let sourceIcon = <Warehouse className="w-4 h-4 text-amber-700" />;
                        let nodeRing = 'ring-amber-500 bg-amber-50 text-amber-700';

                        if (ev.source === 'SALIDAS') {
                          sourceBadgeBg = 'bg-sky-100 text-sky-900 border-sky-300';
                          sourceIcon = <Truck className="w-4 h-4 text-sky-700" />;
                          nodeRing = 'ring-sky-500 bg-sky-50 text-sky-700';
                        } else if (ev.source === 'AUDITORIA_LOTE') {
                          sourceBadgeBg = 'bg-emerald-100 text-emerald-900 border-emerald-300';
                          sourceIcon = <ShieldCheck className="w-4 h-4 text-emerald-700" />;
                          nodeRing = 'ring-emerald-600 bg-emerald-50 text-emerald-700';
                        }

                        return (
                          <div key={ev.id} className="relative group">
                            {/* Nodo circular en la guía vertical */}
                            <div className={`absolute -left-6 sm:-left-8 top-3.5 w-6 h-6 rounded-full ring-2 ${nodeRing} flex items-center justify-center shadow-xs z-5`}>
                              {sourceIcon}
                            </div>

                            {/* Tarjeta de Evento */}
                            <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-sm hover:border-slate-300 transition-all p-4">
                              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                {/* Información Principal */}
                                <div className="space-y-1.5 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap text-xs">
                                    {/* Badge Fuente */}
                                    <span className={`px-2 py-0.5 rounded-md border font-bold uppercase text-[10px] tracking-wider ${sourceBadgeBg}`}>
                                      {ev.source === 'SILOS' ? 'Silos Clasificadora' : ev.source === 'SALIDAS' ? 'Salidas y Despachos' : 'Auditoría Lotes'}
                                    </span>

                                    {/* Tipo de Operación */}
                                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[10.5px]">
                                      {ev.tipoOperacion}
                                    </span>

                                    {/* Hora */}
                                    <span className="text-slate-400 font-mono text-[11px] flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {ev.hora} hs
                                    </span>

                                    {/* Referencia ID */}
                                    {ev.referenciaId && (
                                      <span className="font-mono font-bold text-slate-800 text-[11px] bg-slate-100 px-1.5 py-0.5 rounded">
                                        #{ev.referenciaId}
                                      </span>
                                    )}
                                  </div>

                                  {/* Título y subtítulo */}
                                  <h4 className="text-sm font-bold text-slate-900 leading-snug">
                                    {ev.tituloPrincipal}
                                  </h4>
                                  <p className="text-xs text-slate-600">
                                    {ev.descripcionSecundaria}
                                  </p>

                                  {/* Trazabilidad: Origen / Destino / Transporte */}
                                  <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-500 flex-wrap">
                                    {ev.origenUbicacion && (
                                      <span className="flex items-center gap-1">
                                        <span className="font-bold text-slate-700">Origen:</span> {ev.origenUbicacion}
                                      </span>
                                    )}
                                    {ev.destinoUbicacion && (
                                      <span className="flex items-center gap-1">
                                        <ArrowRight className="w-3 h-3 text-slate-400" />
                                        <span className="font-bold text-slate-700">Destino:</span> {ev.destinoUbicacion}
                                      </span>
                                    )}
                                    {ev.transporteChofer && (
                                      <span className="flex items-center gap-1">
                                        <User className="w-3 h-3 text-slate-400" />
                                        <span>Chofer: {ev.transporteChofer}</span>
                                      </span>
                                    )}
                                    {ev.patente && (
                                      <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                                        Patente: {ev.patente}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Columna Derecha: Kilos, Bolsas y Acciones */}
                                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                                  {/* Kilos pill */}
                                  {ev.kg > 0 && (
                                    <div className="text-right">
                                      <div className={`text-base font-black font-mono ${
                                        ev.signoKg === '+'
                                          ? 'text-emerald-700'
                                          : ev.signoKg === '-'
                                          ? 'text-rose-700'
                                          : 'text-slate-800'
                                      }`}>
                                        {ev.signoKg}{formatNumberArg(ev.kg, 0)} <span className="text-xs font-sans font-bold">kg</span>
                                      </div>
                                      {ev.bolsas ? (
                                        <div className="text-[10.5px] font-mono text-slate-500">
                                          {formatNumberArg(ev.bolsas, 0)} bolsas
                                        </div>
                                      ) : null}
                                    </div>
                                  )}

                                  {/* Botón expandir detalle */}
                                  <div className="flex items-center gap-1.5">
                                    {ev.loteAsociado && onSelectLote && (
                                      <button
                                        onClick={() => onSelectLote(ev.loteAsociado!)}
                                        className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-[#00603C] hover:bg-[#00603C]/10 rounded-lg transition cursor-pointer"
                                        title="Ver ficha técnica completa del lote"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                        <span>Ver Lote</span>
                                      </button>
                                    )}
                                    <button
                                      onClick={() => setExpandedEventId(isExpanded ? null : ev.id)}
                                      className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                                    >
                                      <span>{isExpanded ? 'Ocultar' : 'Detalles'}</span>
                                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* Panel Expandible de Trazabilidad Técnica */}
                              {isExpanded && (
                                <div className="mt-3 pt-3 border-t border-slate-100 text-xs bg-slate-50 rounded-lg p-3 space-y-2">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-[11.5px]">
                                    <div>
                                      <span className="text-slate-500 font-bold block">Responsable / Operario:</span>
                                      <span className="text-slate-800 font-medium">{ev.operadorUsuario || 'Personal de Planta'}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-500 font-bold block">Documento de Respaldo:</span>
                                      <span className="text-slate-800 font-mono">{ev.documentoRef || 'Registro Digital'}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-500 font-bold block">ID Registro Unificado:</span>
                                      <span className="text-slate-800 font-mono">{ev.id}</span>
                                    </div>
                                  </div>
                                  {ev.observaciones && (
                                    <div className="pt-2 border-t border-slate-200/60">
                                      <span className="text-slate-500 font-bold block text-[11px]">Observaciones y Anotaciones:</span>
                                      <p className="text-slate-700 italic text-[11.5px] mt-0.5">{ev.observaciones}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* CONTROLES DE PAGINACIÓN */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200">
                  <div className="text-xs text-slate-500">
                    Mostrando <strong>{(currentPage - 1) * itemsPerPage + 1}</strong> a{' '}
                    <strong>{Math.min(currentPage * itemsPerPage, filteredEvents.length)}</strong> de{' '}
                    <strong>{filteredEvents.length}</strong> eventos
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={itemsPerPage}
                      onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                      className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none"
                    >
                      <option value={15}>15 por pág.</option>
                      <option value={25}>25 por pág.</option>
                      <option value={50}>50 por pág.</option>
                      <option value={100}>100 por pág.</option>
                    </select>

                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-bold disabled:opacity-40 hover:bg-slate-50 transition cursor-pointer"
                    >
                      Anterior
                    </button>
                    <span className="text-xs font-mono font-bold text-slate-800 px-2">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-bold disabled:opacity-40 hover:bg-slate-50 transition cursor-pointer"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
