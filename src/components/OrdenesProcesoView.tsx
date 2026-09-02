/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { OrdenProceso, Lote, EstadoOrdenProceso, TipoOrdenProceso, SiloId, MovimientoSilo } from '../types';
import { OrdenProcesoGauge } from './OrdenProcesoGauge';
import { OrdenProcesoModal, getKgPorEnvase } from './OrdenProcesoModal';
import { EditarCumplimientoModal } from './EditarCumplimientoModal';
import { ConfirmationDialog } from './ConfirmationDialog';
import {
  Factory,
  Truck,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  CircleDashed,
  Edit,
  Sliders,
  Trash2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Package,
  Layers,
  Sparkles,
  Grid,
  List,
  Calendar as CalendarIcon,
  AlertCircle,
  Building2,
  Users
} from 'lucide-react';

interface OrdenesProcesoViewProps {
  ordenes: OrdenProceso[];
  lotes: Lote[];
  activeCampaniaId?: string;
  siloStocks?: Record<SiloId, number>;
  movimientosSilo?: MovimientoSilo[];
  onSaveOrden: (orden: OrdenProceso) => void;
  onDeleteOrden: (id: string) => void;
  onUpdateEstadoOrden: (id: string, nuevoEstado: EstadoOrdenProceso) => void;
  onSelectLote?: (lote: Lote) => void;
  onNavigateToAltaLote?: () => void;
}

export const OrdenesProcesoView: React.FC<OrdenesProcesoViewProps> = ({
  ordenes,
  lotes,
  activeCampaniaId,
  siloStocks,
  movimientosSilo,
  onSaveOrden,
  onDeleteOrden,
  onUpdateEstadoOrden,
  onSelectLote,
  onNavigateToAltaLote,
}) => {
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalInitialType, setModalInitialType] = useState<TipoOrdenProceso>('PRODUCCION');
  const [ordenAEditar, setOrdenAEditar] = useState<OrdenProceso | null>(null);
  const [ordenCumplimientoAEditar, setOrdenCumplimientoAEditar] = useState<OrdenProceso | null>(null);
  const [ordenToDelete, setOrdenToDelete] = useState<OrdenProceso | null>(null);

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('TODOS');
  const [filtroTipo, setFiltroTipo] = useState<string>('TODOS');
  const [filtroCliente, setFiltroCliente] = useState<string>('TODOS');
  const [filtroEspecie, setFiltroEspecie] = useState<string>('TODOS');
  const [filtroVariedad, setFiltroVariedad] = useState<string>('TODOS');
  const [filtroProducto, setFiltroProducto] = useState<string>('TODOS');

  // View Mode: Cards vs Table vs Calendar
  const [viewMode, setViewMode] = useState<'cards' | 'table' | 'calendar'>('cards');
  const [currentCalendarDate, setCurrentCalendarDate] = useState<Date>(new Date());

  const calendarYear = currentCalendarDate.getFullYear();
  const calendarMonth = currentCalendarDate.getMonth();

  const monthNamesSpanish = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const daysOfWeekSpanish = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  const prevMonth = () => {
    setCurrentCalendarDate(new Date(calendarYear, calendarMonth - 1, 1));
  };

  const nextMonth = () => {
    setCurrentCalendarDate(new Date(calendarYear, calendarMonth + 1, 1));
  };

  const todayMonth = () => {
    setCurrentCalendarDate(new Date());
  };

  const calendarGridDays = useMemo(() => {
    const firstDayOfMonth = new Date(calendarYear, calendarMonth, 1);
    const lastDayOfMonth = new Date(calendarYear, calendarMonth + 1, 0);

    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const totalDays = lastDayOfMonth.getDate();
    const days = [];

    const prevMonthLastDay = new Date(calendarYear, calendarMonth, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDay - i;
      const d = new Date(calendarYear, calendarMonth - 1, dayNum);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(dayNum).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      days.push({
        date: d,
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: false,
      });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(calendarYear, calendarMonth, i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(i).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      days.push({
        date: d,
        dateStr,
        dayNumber: i,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
      });
    }

    const totalGridCells = Math.ceil(days.length / 7) * 7;
    const remaining = totalGridCells - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(calendarYear, calendarMonth + 1, i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(i).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      days.push({
        date: d,
        dateStr,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: false,
      });
    }

    return days;
  }, [calendarYear, calendarMonth]);

  // Accordion for expanded lots trace per order
  const [expandedOrdenId, setExpandedOrdenId] = useState<string | null>(null);

  // Group by client toggle (defaults to true as requested)
  const [agruparPorCliente, setAgruparPorCliente] = useState<boolean>(true);

  // Filtered Ordenes list
  const filteredOrdenes = useMemo(() => {
    return ordenes.filter(ord => {
      // Search term
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase().trim();
        const matchesNro = ord.numeroOrden.toLowerCase().includes(term);
        const matchesMovNro = ord.numeroOrdenMovimiento?.toLowerCase().includes(term) || false;
        const matchesVariedad = ord.variedad.toLowerCase().includes(term);
        const matchesProducto = ord.producto.toLowerCase().includes(term);
        const matchesCliente = ord.cliente?.toLowerCase().includes(term) || false;
        const matchesEspecie = ord.especie?.toLowerCase().includes(term) || false;
        if (!matchesNro && !matchesMovNro && !matchesVariedad && !matchesProducto && !matchesCliente && !matchesEspecie) return false;
      }

      // Filter Estado
      if (filtroEstado !== 'TODOS' && ord.estado !== filtroEstado) return false;

      // Filter Tipo
      if (filtroTipo !== 'TODOS' && ord.tipoOrden !== filtroTipo) return false;

      // Filter Cliente
      if (filtroCliente !== 'TODOS' && ord.cliente !== filtroCliente) return false;

      // Filter Especie
      if (filtroEspecie !== 'TODOS' && ord.especie !== filtroEspecie) return false;

      // Filter Variedad
      if (filtroVariedad !== 'TODOS' && ord.variedad !== filtroVariedad) return false;

      // Filter Producto
      if (filtroProducto !== 'TODOS' && ord.producto !== filtroProducto) return false;

      return true;
    });
  }, [ordenes, searchTerm, filtroEstado, filtroTipo, filtroCliente, filtroEspecie, filtroVariedad, filtroProducto]);

  // Unique Lists for Dropdowns
  const clientesList = useMemo(() => {
    const set = new Set<string>();
    ordenes.forEach(o => o.cliente && set.add(o.cliente));
    return Array.from(set).sort();
  }, [ordenes]);

  const especiesList = useMemo(() => {
    const set = new Set<string>();
    ordenes.forEach(o => o.especie && set.add(o.especie));
    return Array.from(set).sort();
  }, [ordenes]);

  const variedadesList = useMemo(() => {
    const set = new Set<string>();
    ordenes.forEach(o => o.variedad && set.add(o.variedad));
    return Array.from(set).sort();
  }, [ordenes]);

  const productosList = useMemo(() => {
    const set = new Set<string>();
    ordenes.forEach(o => o.producto && set.add(o.producto));
    return Array.from(set).sort();
  }, [ordenes]);

  // Grouped by client calculation
  const groupedByCliente = useMemo(() => {
    const map = new Map<string, OrdenProceso[]>();
    filteredOrdenes.forEach(ord => {
      const c = ord.cliente?.trim() || 'Sin Cliente Asignado';
      if (!map.has(c)) {
        map.set(c, []);
      }
      map.get(c)!.push(ord);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([cliente, ordenesCliente]) => {
        const totalBB = ordenesCliente.reduce((acc, o) => acc + (o.bbPedidos || 0), 0);
        const hechosBB = ordenesCliente.reduce((acc, o) => acc + (o.hechos || 0), 0);
        const terminadas = ordenesCliente.filter(o => o.estado === 'TERMINADO').length;
        const enCurso = ordenesCliente.filter(o => o.estado === 'EN CURSO').length;
        const sinIniciar = ordenesCliente.filter(o => o.estado === 'SIN INICIAR').length;
        return {
          cliente,
          ordenes: ordenesCliente,
          totalBB,
          hechosBB,
          terminadas,
          enCurso,
          sinIniciar,
        };
      });
  }, [filteredOrdenes]);

  // Summary Counters
  const counts = useMemo(() => {
    const sinIniciar = ordenes.filter(o => o.estado === 'SIN INICIAR').length;
    const enCurso = ordenes.filter(o => o.estado === 'EN CURSO').length;
    const terminado = ordenes.filter(o => o.estado === 'TERMINADO').length;
    return {
      total: ordenes.length,
      sinIniciar,
      enCurso,
      terminado,
    };
  }, [ordenes]);

  const handleOpenModalNew = (tipo: TipoOrdenProceso) => {
    setOrdenAEditar(null);
    setModalInitialType(tipo);
    setShowModal(true);
  };

  const handleOpenModalEdit = (orden: OrdenProceso) => {
    setOrdenAEditar(orden);
    setShowModal(true);
  };

  const toggleExpand = (ordenId: string) => {
    setExpandedOrdenId(prev => (prev === ordenId ? null : ordenId));
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-emerald-500/10 to-transparent pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold uppercase tracking-wider mb-3">
              <Factory className="w-3.5 h-3.5" />
              Gestión e Integración de Procesos
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Control de Órdenes de Proceso
            </h1>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl">
              Monitoreo y trazabilidad de órdenes de Producción y Movimiento. Seguimiento en tiempo real de cumplimiento de BB pedidos vs hechos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => handleOpenModalNew('PRODUCCION')}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-900/40 flex items-center gap-2 transition-all hover:scale-102 active:scale-98"
            >
              <Plus className="w-4 h-4" />
              Orden de Producción
            </button>
            <button
              onClick={() => handleOpenModalNew('MOVIMIENTO')}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-900/40 flex items-center gap-2 transition-all hover:scale-102 active:scale-98"
            >
              <Truck className="w-4 h-4" />
              Orden de Movimiento
            </button>
          </div>
        </div>

        {/* Counter Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800">
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3.5 border border-white/10">
            <div className="text-xs font-medium text-slate-300 uppercase tracking-wider">Total Órdenes</div>
            <div className="text-2xl font-black mt-1 text-white">{counts.total}</div>
          </div>

          <div className="bg-rose-500/15 backdrop-blur-md rounded-xl p-3.5 border border-rose-500/20">
            <div className="text-xs font-medium text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
              <CircleDashed className="w-3.5 h-3.5 text-rose-400" />
              Sin Iniciar
            </div>
            <div className="text-2xl font-black mt-1 text-rose-200">{counts.sinIniciar}</div>
          </div>

          <div className="bg-amber-500/15 backdrop-blur-md rounded-xl p-3.5 border border-amber-500/20">
            <div className="text-xs font-medium text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              En Curso
            </div>
            <div className="text-2xl font-black mt-1 text-amber-200">{counts.enCurso}</div>
          </div>

          <div className="bg-emerald-500/15 backdrop-blur-md rounded-xl p-3.5 border border-emerald-500/20">
            <div className="text-xs font-medium text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Terminados
            </div>
            <div className="text-2xl font-black mt-1 text-emerald-200">{counts.terminado}</div>
          </div>
        </div>
      </div>

      {/* Control Bar: Filters & Search */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por N° Orden, Cliente, Especie, Variedad..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50/50"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Filter Estado */}
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="px-3 py-2 text-xs font-semibold border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-emerald-500"
            >
              <option value="TODOS">Todos los Estados</option>
              <option value="SIN INICIAR">Sin Iniciar</option>
              <option value="EN CURSO">En Curso</option>
              <option value="TERMINADO">Terminado</option>
            </select>

            {/* Filter Tipo */}
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="px-3 py-2 text-xs font-semibold border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-emerald-500"
            >
              <option value="TODOS">Todos los Tipos</option>
              <option value="PRODUCCION">Producción</option>
              <option value="MOVIMIENTO">Movimiento</option>
            </select>

            {/* Filter Cliente */}
            <select
              value={filtroCliente}
              onChange={(e) => setFiltroCliente(e.target.value)}
              className="px-3 py-2 text-xs font-semibold border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-emerald-500"
            >
              <option value="TODOS">Todos los Clientes</option>
              {clientesList.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Filter Especie */}
            <select
              value={filtroEspecie}
              onChange={(e) => setFiltroEspecie(e.target.value)}
              className="px-3 py-2 text-xs font-semibold border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-emerald-500"
            >
              <option value="TODOS">Todas las Especies</option>
              {especiesList.map(esp => (
                <option key={esp} value={esp}>{esp}</option>
              ))}
            </select>

            {/* Filter Variedad */}
            <select
              value={filtroVariedad}
              onChange={(e) => setFiltroVariedad(e.target.value)}
              className="px-3 py-2 text-xs font-semibold border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-emerald-500"
            >
              <option value="TODOS">Todas las Variedades</option>
              {variedadesList.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>

            {/* Filter Tipo de Lote */}
            <select
              value={filtroProducto}
              onChange={(e) => setFiltroProducto(e.target.value)}
              className="px-3 py-2 text-xs font-semibold border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-emerald-500"
            >
              <option value="TODOS">Todos los Tipos de Lote</option>
              {productosList.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>

            {/* View Mode Toggle & Grouping Toggle */}
            <div className="flex items-center gap-2 ml-auto lg:ml-0 flex-wrap">
              <button
                type="button"
                onClick={() => setAgruparPorCliente(!agruparPorCliente)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border cursor-pointer ${
                  agruparPorCliente
                    ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                    : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                }`}
                title="Agrupar las órdenes por cliente"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Agrupar por Cliente</span>
              </button>

              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => setViewMode('cards')}
                  className={`p-1.5 rounded-lg text-xs font-medium transition-all ${
                    viewMode === 'cards' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                  }`}
                  title="Vista en Tarjetas"
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-lg text-xs font-medium transition-all ${
                    viewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                  }`}
                  title="Vista en Tabla"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('calendar')}
                  className={`p-1.5 rounded-lg text-xs font-medium transition-all ${
                    viewMode === 'calendar' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                  }`}
                  title="Vista en Calendario"
                >
                  <CalendarIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* Main Content Area */}
      {filteredOrdenes.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-slate-300 max-w-lg mx-auto my-8">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No se encontraron Órdenes de Proceso</h3>
          <p className="text-sm text-slate-500 mt-1 mb-5">
            Ajuste los filtros de búsqueda o registre una nueva Orden de Producción o Movimiento.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => handleOpenModalNew('PRODUCCION')}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl"
            >
              + Nueva Orden Producción
            </button>
          </div>
        </div>
      ) : viewMode === 'cards' ? (
        /* Cards View (Grouped by Client or Flat Grid) */
        agruparPorCliente ? (
          <div className="space-y-6">
            {groupedByCliente.map(grupo => (
              <div key={grupo.cliente} className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-4">
                {/* Client Group Header Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-800 text-white flex items-center justify-center font-black shadow-xs shrink-0">
                      <Building2 className="w-5 h-5 text-emerald-100" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-extrabold text-slate-900 tracking-tight">{grupo.cliente}</h3>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          {grupo.ordenes.length} {grupo.ordenes.length === 1 ? 'orden' : 'órdenes'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Progreso acumulado: <span className="font-bold text-slate-800">{grupo.hechosBB}</span> de <span className="font-bold text-slate-800">{grupo.totalBB} BB</span> ({grupo.totalBB > 0 ? Math.round((grupo.hechosBB / grupo.totalBB) * 100) : 0}%)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-bold flex-wrap">
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-100/80 text-emerald-800 border border-emerald-200">
                      🟢 {grupo.terminadas} Terminado
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-amber-100/80 text-amber-800 border border-amber-200">
                      🟡 {grupo.enCurso} En curso
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-rose-100/80 text-rose-800 border border-rose-200">
                      🔴 {grupo.sinIniciar} Sin Iniciar
                    </span>
                  </div>
                </div>

                {/* Grid of Cards for this Client */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {grupo.ordenes.map(orden => {
                    const linkedLotes = lotes.filter(l => l.ordenProcesoId === orden.id);
                    const isExpanded = expandedOrdenId === orden.id;

                    return (
                      <div
                        key={orden.id}
                        className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all duration-200 flex flex-col overflow-hidden group"
                      >
                        {/* Card Header */}
                        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              {orden.tipoOrden === 'PRODUCCION' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <Factory className="w-3 h-3" />
                                  PRODUCCIÓN
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200">
                                  <Truck className="w-3 h-3" />
                                  MOVIMIENTO
                                </span>
                              )}

                              {orden.tipoMovimiento && (
                                <span className="px-2 py-0.5 text-[10px] font-semibold bg-slate-200 text-slate-700 rounded-md">
                                  {orden.tipoMovimiento}
                                </span>
                              )}
                            </div>

                            <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                              N° {orden.numeroOrden}
                              {orden.numeroOrdenMovimiento && (
                                <span className="text-xs font-mono font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                                  {orden.numeroOrdenMovimiento}
                                </span>
                              )}
                            </h3>
                          </div>

                          {/* Status Dropdown */}
                          <select
                            value={orden.estado}
                            onChange={(e) => onUpdateEstadoOrden(orden.id, e.target.value as EstadoOrdenProceso)}
                            className={`text-xs font-black px-2.5 py-1 rounded-lg border shadow-2xs transition-colors cursor-pointer ${
                              orden.estado === 'TERMINADO'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
                                : orden.estado === 'EN CURSO'
                                ? 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200'
                                : 'bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200'
                            }`}
                          >
                            <option value="SIN INICIAR">🔴 SIN INICIAR</option>
                            <option value="EN CURSO">🟡 EN CURSO</option>
                            <option value="TERMINADO">🟢 TERMINADO</option>
                          </select>
                        </div>

                        {/* Card Body: Details & Gauge */}
                        <div className="p-5 flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                          
                          {/* Gauge Progress */}
                          <div className="flex flex-col items-center justify-center py-2 sm:py-0">
                            <OrdenProcesoGauge
                              hechos={orden.hechos}
                              bbPedidos={orden.bbPedidos}
                              size={110}
                            />
                            <button
                              type="button"
                              onClick={() => setOrdenCumplimientoAEditar(orden)}
                              className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-[#00603C] hover:text-white bg-emerald-50 hover:bg-[#00603C] px-3 py-1 rounded-xl border border-emerald-200 transition-all cursor-pointer shadow-2xs group"
                              title="Editar manualmente el porcentaje de cumplimiento y bolsas vinculadas"
                            >
                              <Sliders className="w-3.5 h-3.5 text-[#00603C] group-hover:text-amber-300 transition-colors" />
                              <span>Editar Avance</span>
                            </button>
                          </div>

                          {/* Order Specs */}
                          <div className="space-y-2 text-xs">
                            <div>
                              <span className="text-slate-400 font-medium">Cliente:</span>
                              <div className="font-bold text-slate-900 text-sm truncate">{orden.cliente || 'San Diego Semilla'}</div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="text-slate-400 font-medium">Especie:</span>
                                <div className="font-semibold text-slate-800">{orden.especie || 'Soja'}</div>
                              </div>
                              <div>
                                <span className="text-slate-400 font-medium">Variedad:</span>
                                <div className="font-bold text-slate-900">{orden.variedad}</div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="text-slate-400 font-medium">Tipo de Lote:</span>
                                <div className="font-semibold text-slate-800">{orden.producto}</div>
                              </div>
                              <div>
                                <span className="text-slate-400 font-medium">Categoría:</span>
                                <div className="font-semibold text-slate-800">{orden.categoria}</div>
                              </div>
                            </div>

                            {orden.tipoOrden === 'MOVIMIENTO' && orden.productos && orden.productos.length > 0 && (
                              <div className="mt-1">
                                <span className="text-slate-400 font-medium text-[11px] block mb-1">Productos Aplicados:</span>
                                <div className="flex flex-wrap gap-1">
                                  {orden.productos.map((prod, pIdx) => {
                                    const tiposStr = prod.tipos && prod.tipos.length > 0
                                      ? prod.tipos.map(t => t === 'Otro' && prod.tipoOtro ? prod.tipoOtro : t).join(', ')
                                      : '';
                                    return (
                                      <span key={pIdx} className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md">
                                        {prod.principioActivo || 'Sin PA'} {tiposStr ? `(${tiposStr})` : ''}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-2">
                              {orden.tipoOrden === 'MOVIMIENTO' && (
                                <div>
                                  <span className="text-slate-400 font-medium">Tratamiento:</span>
                                  <div className="font-semibold text-slate-700 truncate">{orden.tratamiento || 'N/I'}</div>
                                </div>
                              )}
                              <div>
                                <span className="text-slate-400 font-medium">Envase Destino:</span>
                                <div className="font-semibold text-slate-800 truncate">{orden.envaseDestino || 'N/I'}</div>
                              </div>
                            </div>

                            {orden.observaciones && (
                              <div className="pt-1 text-[11px] text-slate-500 italic line-clamp-2">
                                "{orden.observaciones}"
                              </div>
                            )}

                            {/* Necesidad de Kilos Aproximados y Cobertura de Origen */}
                            {(() => {
                              const targetKg = (orden.bbPedidos || 0) * getKgPorEnvase(orden.envaseDestino || '');
                              const isMov = orden.tipoOrden === 'MOVIMIENTO';
                              const totalExtraido = isMov
                                ? (orden.lotesOrigen || []).reduce((acc, item) => acc + (item.kgExtraidos || 0), 0)
                                : 0;
                              const porcentaje = targetKg > 0 ? Math.min(100, Math.round((totalExtraido / targetKg) * 100)) : 0;

                              return (
                                <div className="mt-2 p-2 bg-slate-100/90 rounded-xl border border-slate-200 text-[11px] space-y-1">
                                  <div className="flex items-center justify-between font-bold text-slate-800">
                                    <span>Demanda de Kilos:</span>
                                    <span className="font-mono text-emerald-800">{targetKg.toLocaleString('es-AR')} kg</span>
                                  </div>
                                  {isMov && (
                                    <>
                                      <div className="flex items-center justify-between text-[10px] text-slate-600">
                                        <span>Lotes Origen ({orden.lotesOrigen?.length || 0}):</span>
                                        <span className={`font-semibold ${porcentaje >= 100 ? 'text-emerald-700' : 'text-amber-700'}`}>
                                          {totalExtraido.toLocaleString('es-AR')} kg ({porcentaje}%)
                                        </span>
                                      </div>
                                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                        <div
                                          className={`h-full transition-all ${porcentaje >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                          style={{ width: `${porcentaje}%` }}
                                        />
                                      </div>
                                    </>
                                  )}
                                </div>
                              );
                            })()}
                          </div>

                        </div>

                        {/* Linked Lots Traceability Section */}
                        <div className="bg-slate-50 border-t border-slate-100 px-5 py-3 text-xs">
                          <div className="flex items-center justify-between">
                            <button
                              onClick={() => toggleExpand(orden.id)}
                              className="flex items-center gap-1.5 font-bold text-slate-700 hover:text-emerald-700 transition-colors"
                            >
                              <Package className="w-3.5 h-3.5 text-emerald-600" />
                              Lotes Vinculados ({linkedLotes.length})
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleOpenModalEdit(orden)}
                                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
                                title="Editar Orden"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setOrdenToDelete(orden)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Eliminar Orden"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Accordion Content for Lots & Origin */}
                          {isExpanded && (
                            <div className="mt-3 pt-3 border-t border-slate-200/60 space-y-3 animate-in fade-in duration-150">
                              
                              {/* Breakdown of Origin (Silos or Lotes) */}
                              {orden.tipoOrden === 'MOVIMIENTO' && orden.lotesOrigen && orden.lotesOrigen.length > 0 && (
                                <div className="bg-blue-50/70 p-2.5 rounded-xl border border-blue-200/60 text-[11px]">
                                  <div className="font-bold text-blue-900 mb-1 flex items-center gap-1">
                                    <Truck className="w-3.5 h-3.5 text-blue-700" />
                                    Lotes de Origen Extraídos ({orden.lotesOrigen.length}/5):
                                  </div>
                                  <div className="space-y-1">
                                    {orden.lotesOrigen.map((item, idx) => (
                                      <div key={idx} className="flex items-center justify-between bg-white px-2 py-1 rounded-lg border border-blue-100 text-[10px]">
                                        <span className="font-mono font-bold text-slate-800">Lote #{item.loteNro} ({item.variedad})</span>
                                        <span className="font-bold text-blue-700">{item.kgExtraidos?.toLocaleString('es-AR')} kg ({item.cantidadBolsas} BB)</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <div>
                                <div className="text-[11px] font-bold text-slate-700 mb-1">
                                  Lotes Creados / Producidos Vinculados ({linkedLotes.length}):
                                </div>
                                {linkedLotes.length === 0 ? (
                                  <div className="text-slate-400 italic text-[11px] text-center py-2 bg-white rounded-xl border border-dashed border-slate-200">
                                    No hay lotes de destino dados de alta vinculados a esta orden.
                                  </div>
                                ) : (
                                  linkedLotes.map(lote => (
                                    <div
                                      key={lote.id}
                                      onClick={() => onSelectLote && onSelectLote(lote)}
                                      className="p-2.5 bg-white rounded-xl border border-slate-200/80 hover:border-emerald-400 hover:shadow-xs transition-all cursor-pointer flex items-center justify-between mb-1"
                                    >
                                      <div>
                                        <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                                          <span>Lote N° {lote.loteNro}</span>
                                          <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded font-normal">
                                            {lote.cliente}
                                          </span>
                                        </div>
                                        <div className="text-[10px] text-slate-500 mt-0.5">
                                          {lote.stockBolsas} BB ({lote.stockKg.toLocaleString()} kg) • Ala {lote.ala || '-'}{lote.sector || ''}
                                        </div>
                                      </div>
                                      <span className="text-[10px] font-semibold text-emerald-700 hover:underline">Ver detalle →</span>
                                    </div>
                                  ))
                                )}
                              </div>

                              {onNavigateToAltaLote && (
                                <button
                                  onClick={onNavigateToAltaLote}
                                  className="w-full mt-1 py-1.5 text-center text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                                >
                                  + Dar de Alta Lote vinculado
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Flat Grid of Cards */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredOrdenes.map(orden => {
              const linkedLotes = lotes.filter(l => l.ordenProcesoId === orden.id);
              const isExpanded = expandedOrdenId === orden.id;

              return (
                <div
                  key={orden.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all duration-200 flex flex-col overflow-hidden group"
                >
                  {/* Card Header */}
                  <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {orden.tipoOrden === 'PRODUCCION' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <Factory className="w-3 h-3" />
                            PRODUCCIÓN
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200">
                            <Truck className="w-3 h-3" />
                            MOVIMIENTO
                          </span>
                        )}

                        {orden.tipoMovimiento && (
                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-slate-200 text-slate-700 rounded-md">
                            {orden.tipoMovimiento}
                          </span>
                        )}
                      </div>

                      <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                        N° {orden.numeroOrden}
                        {orden.numeroOrdenMovimiento && (
                          <span className="text-xs font-mono font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                            {orden.numeroOrdenMovimiento}
                          </span>
                        )}
                      </h3>
                    </div>

                    {/* Status Dropdown */}
                    <select
                      value={orden.estado}
                      onChange={(e) => onUpdateEstadoOrden(orden.id, e.target.value as EstadoOrdenProceso)}
                      className={`text-xs font-black px-2.5 py-1 rounded-lg border shadow-2xs transition-colors cursor-pointer ${
                        orden.estado === 'TERMINADO'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
                          : orden.estado === 'EN CURSO'
                          ? 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200'
                          : 'bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200'
                      }`}
                    >
                      <option value="SIN INICIAR">🔴 SIN INICIAR</option>
                      <option value="EN CURSO">🟡 EN CURSO</option>
                      <option value="TERMINADO">🟢 TERMINADO</option>
                    </select>
                  </div>

                  {/* Card Body: Details & Gauge */}
                  <div className="p-5 flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                    
                    {/* Gauge Progress */}
                    <div className="flex flex-col items-center justify-center py-2 sm:py-0">
                      <OrdenProcesoGauge
                        hechos={orden.hechos}
                        bbPedidos={orden.bbPedidos}
                        size={110}
                      />
                      <button
                        type="button"
                        onClick={() => setOrdenCumplimientoAEditar(orden)}
                        className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-[#00603C] hover:text-white bg-emerald-50 hover:bg-[#00603C] px-3 py-1 rounded-xl border border-emerald-200 transition-all cursor-pointer shadow-2xs group"
                        title="Editar manualmente el porcentaje de cumplimiento y bolsas vinculadas"
                      >
                        <Sliders className="w-3.5 h-3.5 text-[#00603C] group-hover:text-amber-300 transition-colors" />
                        <span>Editar Avance</span>
                      </button>
                    </div>

                    {/* Order Specs */}
                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-slate-400 font-medium">Cliente:</span>
                        <div className="font-bold text-slate-900 text-sm truncate">{orden.cliente || 'San Diego Semilla'}</div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-slate-400 font-medium">Especie:</span>
                          <div className="font-semibold text-slate-800">{orden.especie || 'Soja'}</div>
                        </div>
                        <div>
                          <span className="text-slate-400 font-medium">Variedad:</span>
                          <div className="font-bold text-slate-900">{orden.variedad}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-slate-400 font-medium">Tipo de Lote:</span>
                          <div className="font-semibold text-slate-800">{orden.producto}</div>
                        </div>
                        <div>
                          <span className="text-slate-400 font-medium">Categoría:</span>
                          <div className="font-semibold text-slate-800">{orden.categoria}</div>
                        </div>
                      </div>

                      {orden.tipoOrden === 'MOVIMIENTO' && orden.productos && orden.productos.length > 0 && (
                        <div className="mt-1">
                          <span className="text-slate-400 font-medium text-[11px] block mb-1">Productos Aplicados:</span>
                          <div className="flex flex-wrap gap-1">
                            {orden.productos.map((prod, pIdx) => {
                              const tiposStr = prod.tipos && prod.tipos.length > 0
                                ? prod.tipos.map(t => t === 'Otro' && prod.tipoOtro ? prod.tipoOtro : t).join(', ')
                                : '';
                              return (
                                <span key={pIdx} className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md">
                                  {prod.principioActivo || 'Sin PA'} {tiposStr ? `(${tiposStr})` : ''}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        {orden.tipoOrden === 'MOVIMIENTO' && (
                          <div>
                            <span className="text-slate-400 font-medium">Tratamiento:</span>
                            <div className="font-semibold text-slate-700 truncate">{orden.tratamiento || 'N/I'}</div>
                          </div>
                        )}
                        <div>
                          <span className="text-slate-400 font-medium">Envase Destino:</span>
                          <div className="font-semibold text-slate-800 truncate">{orden.envaseDestino || 'N/I'}</div>
                        </div>
                      </div>

                      {orden.observaciones && (
                        <div className="pt-1 text-[11px] text-slate-500 italic line-clamp-2">
                          "{orden.observaciones}"
                        </div>
                      )}

                      {/* Necesidad de Kilos Aproximados y Cobertura de Origen */}
                      {(() => {
                        const targetKg = (orden.bbPedidos || 0) * getKgPorEnvase(orden.envaseDestino || '');
                        const isMov = orden.tipoOrden === 'MOVIMIENTO';
                        const totalExtraido = isMov
                          ? (orden.lotesOrigen || []).reduce((acc, item) => acc + (item.kgExtraidos || 0), 0)
                          : 0;
                        const porcentaje = targetKg > 0 ? Math.min(100, Math.round((totalExtraido / targetKg) * 100)) : 0;

                        return (
                          <div className="mt-2 p-2 bg-slate-100/90 rounded-xl border border-slate-200 text-[11px] space-y-1">
                            <div className="flex items-center justify-between font-bold text-slate-800">
                              <span>Demanda de Kilos:</span>
                              <span className="font-mono text-emerald-800">{targetKg.toLocaleString('es-AR')} kg</span>
                            </div>
                            {isMov && (
                              <>
                                <div className="flex items-center justify-between text-[10px] text-slate-600">
                                  <span>Lotes Origen ({orden.lotesOrigen?.length || 0}):</span>
                                  <span className={`font-semibold ${porcentaje >= 100 ? 'text-emerald-700' : 'text-amber-700'}`}>
                                    {totalExtraido.toLocaleString('es-AR')} kg ({porcentaje}%)
                                  </span>
                                </div>
                                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full transition-all ${porcentaje >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                    style={{ width: `${porcentaje}%` }}
                                  />
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                  </div>

                  {/* Linked Lots Traceability Section */}
                  <div className="bg-slate-50 border-t border-slate-100 px-5 py-3 text-xs">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => toggleExpand(orden.id)}
                        className="flex items-center gap-1.5 font-bold text-slate-700 hover:text-emerald-700 transition-colors"
                      >
                        <Package className="w-3.5 h-3.5 text-emerald-600" />
                        Lotes Vinculados ({linkedLotes.length})
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenModalEdit(orden)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
                          title="Editar Orden"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setOrdenToDelete(orden)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Eliminar Orden"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Accordion Content for Lots & Origin */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-slate-200/60 space-y-3 animate-in fade-in duration-150">
                        
                        {/* Breakdown of Origin (Silos or Lotes) */}
                        {orden.tipoOrden === 'MOVIMIENTO' && orden.lotesOrigen && orden.lotesOrigen.length > 0 && (
                          <div className="bg-blue-50/70 p-2.5 rounded-xl border border-blue-200/60 text-[11px]">
                            <div className="font-bold text-blue-900 mb-1 flex items-center gap-1">
                              <Truck className="w-3.5 h-3.5 text-blue-700" />
                              Lotes de Origen Extraídos ({orden.lotesOrigen.length}/5):
                            </div>
                            <div className="space-y-1">
                              {orden.lotesOrigen.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between bg-white px-2 py-1 rounded-lg border border-blue-100 text-[10px]">
                                  <span className="font-mono font-bold text-slate-800">Lote #{item.loteNro} ({item.variedad})</span>
                                  <span className="font-bold text-blue-700">{item.kgExtraidos?.toLocaleString('es-AR')} kg ({item.cantidadBolsas} BB)</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div>
                          <div className="text-[11px] font-bold text-slate-700 mb-1">
                            Lotes Creados / Producidos Vinculados ({linkedLotes.length}):
                          </div>
                          {linkedLotes.length === 0 ? (
                            <div className="text-slate-400 italic text-[11px] text-center py-2 bg-white rounded-xl border border-dashed border-slate-200">
                              No hay lotes de destino dados de alta vinculados a esta orden.
                            </div>
                          ) : (
                            linkedLotes.map(lote => (
                              <div
                                key={lote.id}
                                onClick={() => onSelectLote && onSelectLote(lote)}
                                className="p-2.5 bg-white rounded-xl border border-slate-200/80 hover:border-emerald-400 hover:shadow-xs transition-all cursor-pointer flex items-center justify-between mb-1"
                              >
                                <div>
                                  <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                                    <span>Lote N° {lote.loteNro}</span>
                                    <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded font-normal">
                                      {lote.cliente}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-500 mt-0.5">
                                    {lote.stockBolsas} BB ({lote.stockKg.toLocaleString()} kg) • Ala {lote.ala || '-'}{lote.sector || ''}
                                  </div>
                                </div>
                                <span className="text-[10px] font-semibold text-emerald-700 hover:underline">Ver detalle →</span>
                              </div>
                            ))
                          )}
                        </div>

                        {onNavigateToAltaLote && (
                          <button
                            onClick={onNavigateToAltaLote}
                            className="w-full mt-1 py-1.5 text-center text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                          >
                            + Dar de Alta Lote vinculado
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )
      ) : viewMode === 'table' ? (
        /* Table View */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">N° Orden</th>
                  <th className="py-3.5 px-4">Tipo</th>
                  <th className="py-3.5 px-4">Cliente / Especie</th>
                  <th className="py-3.5 px-4">Variedad / Producto</th>
                  <th className="py-3.5 px-4">Categoría / Tratamiento</th>
                  <th className="py-3.5 px-4">Envase Destino</th>
                  <th className="py-3.5 px-4 text-center">Cumplimiento (% / BB)</th>
                  <th className="py-3.5 px-4">Estado</th>
                  <th className="py-3.5 px-4 text-center">Lotes</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {agruparPorCliente ? (
                  groupedByCliente.map(grupo => (
                    <React.Fragment key={grupo.cliente}>
                      {/* Client Group Separator Row */}
                      <tr className="bg-slate-100/90 border-y border-slate-200 font-bold text-slate-800">
                        <td colSpan={10} className="py-2.5 px-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-emerald-800" />
                              <span className="font-extrabold text-slate-900 text-sm">{grupo.cliente}</span>
                              <span className="px-2 py-0.5 rounded-full text-[11px] bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold">
                                {grupo.ordenes.length} {grupo.ordenes.length === 1 ? 'orden' : 'órdenes'}
                              </span>
                            </div>
                            <div className="text-xs text-slate-600 font-medium flex items-center gap-3">
                              <span>Total BB: <strong className="text-slate-900">{grupo.hechosBB} / {grupo.totalBB}</strong> ({grupo.totalBB > 0 ? Math.round((grupo.hechosBB / grupo.totalBB) * 100) : 0}%)</span>
                              <span className="text-emerald-700">🟢 {grupo.terminadas}</span>
                              <span className="text-amber-700">🟡 {grupo.enCurso}</span>
                              <span className="text-rose-700">🔴 {grupo.sinIniciar}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                      {grupo.ordenes.map(orden => {
                        const linkedLotes = lotes.filter(l => l.ordenProcesoId === orden.id);
                        const pct = orden.bbPedidos > 0 ? Math.round((orden.hechos / orden.bbPedidos) * 100) : 0;

                        return (
                          <tr key={orden.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-slate-900 text-sm">
                              {orden.numeroOrden}
                              {orden.numeroOrdenMovimiento && (
                                <div className="text-[10px] text-blue-700 font-normal">
                                  {orden.numeroOrdenMovimiento}
                                </div>
                              )}
                            </td>

                            <td className="py-3 px-4">
                              {orden.tipoOrden === 'PRODUCCION' ? (
                                <span className="px-2 py-0.5 text-[10px] font-extrabold bg-emerald-100 text-emerald-800 rounded">PRODUCCIÓN</span>
                              ) : (
                                <span className="px-2 py-0.5 text-[10px] font-extrabold bg-blue-100 text-blue-800 rounded">MOVIMIENTO</span>
                              )}
                            </td>

                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-900">{orden.cliente || 'San Diego Semilla'}</div>
                              <div className="text-[10px] text-slate-500 font-medium">{orden.especie || 'Soja'}</div>
                            </td>

                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-900">{orden.variedad}</div>
                              <div className="text-[10px] text-slate-500 font-semibold">Tipo: {orden.producto}</div>
                              {orden.tipoOrden === 'MOVIMIENTO' && orden.productos && orden.productos.length > 0 && (
                                <div className="flex flex-wrap gap-0.5 mt-1 max-w-[180px]">
                                  {orden.productos.map((prod, pIdx) => (
                                    <span key={pIdx} className="px-1 py-0.2 text-[9px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded">
                                      {prod.principioActivo || 'PA'}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>

                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-800">{orden.categoria}</div>
                              {orden.tipoOrden === 'MOVIMIENTO' && (
                                <div className="text-[10px] text-slate-500">{orden.tratamiento || 'N/I'}</div>
                              )}
                            </td>

                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 rounded border border-slate-200 whitespace-nowrap">
                                {orden.envaseDestino || 'N/I'}
                              </span>
                            </td>

                            <td className="py-3 px-4 text-center">
                              <div className="font-black text-sm text-slate-900">{pct}%</div>
                              <div className="text-[10px] text-slate-500">{orden.hechos} / {orden.bbPedidos} BB</div>
                              <button
                                type="button"
                                onClick={() => setOrdenCumplimientoAEditar(orden)}
                                className="mt-1 text-[10px] font-bold text-[#00603C] hover:text-emerald-900 hover:underline inline-flex items-center gap-1 cursor-pointer bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200"
                                title="Editar cumplimiento de objetivos y bolsas vinculadas"
                              >
                                <Sliders className="w-2.5 h-2.5 text-[#00603C]" />
                                <span>Editar</span>
                              </button>
                            </td>

                            <td className="py-3 px-4">
                              <select
                                value={orden.estado}
                                onChange={(e) => onUpdateEstadoOrden(orden.id, e.target.value as EstadoOrdenProceso)}
                                className="text-[11px] font-bold px-2 py-0.5 rounded border cursor-pointer"
                              >
                                <option value="SIN INICIAR">🔴 SIN INICIAR</option>
                                <option value="EN CURSO">🟡 EN CURSO</option>
                                <option value="TERMINADO">🟢 TERMINADO</option>
                              </select>
                            </td>

                            <td className="py-3 px-4 text-center">
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                                {linkedLotes.length}
                              </span>
                            </td>

                            <td className="py-3 px-4 text-right space-x-1">
                              <button
                                onClick={() => handleOpenModalEdit(orden)}
                                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg"
                                title="Editar"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setOrdenToDelete(orden)}
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                                title="Eliminar"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))
                ) : (
                  filteredOrdenes.map(orden => {
                    const linkedLotes = lotes.filter(l => l.ordenProcesoId === orden.id);
                    const pct = orden.bbPedidos > 0 ? Math.round((orden.hechos / orden.bbPedidos) * 100) : 0;

                    return (
                      <tr key={orden.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 text-sm">
                          {orden.numeroOrden}
                          {orden.numeroOrdenMovimiento && (
                            <div className="text-[10px] text-blue-700 font-normal">
                              {orden.numeroOrdenMovimiento}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          {orden.tipoOrden === 'PRODUCCION' ? (
                            <span className="px-2 py-0.5 text-[10px] font-extrabold bg-emerald-100 text-emerald-800 rounded">PRODUCCIÓN</span>
                          ) : (
                            <span className="px-2 py-0.5 text-[10px] font-extrabold bg-blue-100 text-blue-800 rounded">MOVIMIENTO</span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{orden.cliente || 'San Diego Semilla'}</div>
                          <div className="text-[10px] text-slate-500 font-medium">{orden.especie || 'Soja'}</div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{orden.variedad}</div>
                          <div className="text-[10px] text-slate-500 font-semibold">Tipo: {orden.producto}</div>
                          {orden.tipoOrden === 'MOVIMIENTO' && orden.productos && orden.productos.length > 0 && (
                            <div className="flex flex-wrap gap-0.5 mt-1 max-w-[180px]">
                              {orden.productos.map((prod, pIdx) => (
                                <span key={pIdx} className="px-1 py-0.2 text-[9px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded">
                                  {prod.principioActivo || 'PA'}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800">{orden.categoria}</div>
                          {orden.tipoOrden === 'MOVIMIENTO' && (
                            <div className="text-[10px] text-slate-500">{orden.tratamiento || 'N/I'}</div>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 rounded border border-slate-200 whitespace-nowrap">
                            {orden.envaseDestino || 'N/I'}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <div className="font-black text-sm text-slate-900">{pct}%</div>
                          <div className="text-[10px] text-slate-500">{orden.hechos} / {orden.bbPedidos} BB</div>
                          <button
                            type="button"
                            onClick={() => setOrdenCumplimientoAEditar(orden)}
                            className="mt-1 text-[10px] font-bold text-[#00603C] hover:text-emerald-900 hover:underline inline-flex items-center gap-1 cursor-pointer bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200"
                            title="Editar cumplimiento de objetivos y bolsas vinculadas"
                          >
                            <Sliders className="w-2.5 h-2.5 text-[#00603C]" />
                            <span>Editar</span>
                          </button>
                        </td>

                        <td className="py-3 px-4">
                          <select
                            value={orden.estado}
                            onChange={(e) => onUpdateEstadoOrden(orden.id, e.target.value as EstadoOrdenProceso)}
                            className="text-[11px] font-bold px-2 py-0.5 rounded border cursor-pointer"
                          >
                            <option value="SIN INICIAR">🔴 SIN INICIAR</option>
                            <option value="EN CURSO">🟡 EN CURSO</option>
                            <option value="TERMINADO">🟢 TERMINADO</option>
                          </select>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                            {linkedLotes.length}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right space-x-1">
                          <button
                            onClick={() => handleOpenModalEdit(orden)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg"
                            title="Editar"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`¿Confirma eliminar la Orden N° ${orden.numeroOrden}?`)) {
                                onDeleteOrden(orden.id);
                              }
                            }}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Calendar View */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          {/* Calendar Header Navigation */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-black text-slate-900 capitalize">
                {monthNamesSpanish[calendarMonth]} {calendarYear}
              </h2>
              <button
                onClick={todayMonth}
                className="px-3 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200/80 transition-colors"
              >
                Hoy
              </button>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={prevMonth}
                className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition-all"
                title="Mes Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-slate-700 px-2 min-w-[110px] text-center">
                {monthNamesSpanish[calendarMonth]} {calendarYear}
              </span>
              <button
                onClick={nextMonth}
                className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition-all"
                title="Mes Siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Calendar Days Header */}
          <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs uppercase text-slate-500 tracking-wider">
            {daysOfWeekSpanish.map(d => (
              <div key={d} className="py-2 bg-slate-50 rounded-lg border border-slate-100">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Grid Cells */}
          <div className="grid grid-cols-7 gap-1.5 auto-rows-fr">
            {calendarGridDays.map((cell, idx) => {
              // Find matching orders for cell.dateStr
              const ordersOnDay = filteredOrdenes.filter(ord => {
                if (!ord.fechaCreacion) return false;
                return ord.fechaCreacion.startsWith(cell.dateStr);
              });

              return (
                <div
                  key={idx}
                  className={`min-h-[110px] p-2 rounded-xl border transition-all flex flex-col justify-between ${
                    cell.isCurrentMonth
                      ? 'bg-white border-slate-200 hover:border-slate-300'
                      : 'bg-slate-50/60 border-slate-100 text-slate-400'
                  } ${cell.isToday ? 'ring-2 ring-emerald-500 bg-emerald-50/20' : ''}`}
                >
                  {/* Cell Date Header */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-black ${
                        cell.isToday
                          ? 'w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center shadow-xs'
                          : cell.isCurrentMonth
                          ? 'text-slate-800'
                          : 'text-slate-400'
                      }`}
                    >
                      {cell.dayNumber}
                    </span>

                    {ordersOnDay.length > 0 && (
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {ordersOnDay.length}
                      </span>
                    )}
                  </div>

                  {/* List of Orders in Cell */}
                  <div className="space-y-1.5 flex-1 overflow-y-auto max-h-[130px] pr-0.5 scrollbar-thin">
                    {ordersOnDay.map(ord => {
                      const pct = ord.bbPedidos > 0 ? Math.round((ord.hechos / ord.bbPedidos) * 100) : 0;
                      const isTerminado = ord.estado === 'TERMINADO';
                      const isEnCurso = ord.estado === 'EN CURSO';

                      return (
                        <div
                          key={ord.id}
                          onClick={() => handleOpenModalEdit(ord)}
                          className={`p-1.5 rounded-lg text-left border cursor-pointer hover:scale-[1.02] transition-transform ${
                            isTerminado
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                              : isEnCurso
                              ? 'bg-amber-50 border-amber-200 text-amber-900'
                              : 'bg-rose-50 border-rose-200 text-rose-900'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-extrabold text-[11px] leading-tight flex items-center gap-1">
                              {ord.tipoOrden === 'PRODUCCION' ? (
                                <Factory className="w-3 h-3 text-emerald-700 shrink-0" />
                              ) : (
                                <Truck className="w-3 h-3 text-blue-700 shrink-0" />
                              )}
                              N° {ord.numeroOrden}
                            </span>
                            <span className="text-[9px] font-black px-1 rounded bg-white/80 border border-slate-200">
                              {pct}%
                            </span>
                          </div>

                          <div className="text-[10px] font-medium truncate mt-0.5 opacity-90">
                            {ord.cliente ? `${ord.cliente} • ` : ''}{ord.variedad} ({ord.producto})
                          </div>
                          {ord.envaseDestino && (
                            <div className="text-[9px] font-bold text-slate-600 truncate mt-0.5">
                              📦 {ord.envaseDestino}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal for Nueva / Editar Orden */}
      {showModal && (
        <OrdenProcesoModal
          existingOrdenes={ordenes}
          ordenAEditar={ordenAEditar}
          initialType={modalInitialType}
          activeCampaniaId={activeCampaniaId}
          siloStocks={siloStocks}
          lotes={lotes}
          onSave={(ord) => {
            onSaveOrden(ord);
            setShowModal(false);
          }}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* Modal for Editar Dashboard de Cumplimiento / Avance */}
      {ordenCumplimientoAEditar && (
        <EditarCumplimientoModal
          isOpen={!!ordenCumplimientoAEditar}
          orden={ordenCumplimientoAEditar}
          onSave={(ordenActualizada) => {
            onSaveOrden(ordenActualizada);
            setOrdenCumplimientoAEditar(null);
          }}
          onClose={() => setOrdenCumplimientoAEditar(null)}
        />
      )}

      {/* Confirmation Dialog for Deleting Process Orders */}
      <ConfirmationDialog
        isOpen={Boolean(ordenToDelete)}
        title={ordenToDelete ? `Eliminar Orden N° ${ordenToDelete.numeroOrden}` : 'Eliminar Orden de Proceso'}
        variant="danger"
        confirmText="Eliminar Orden"
        cancelText="Cancelar"
        description="¿Confirma la eliminación permanente de esta Orden de Proceso? Esta acción es irreversible y podría afectar la trazabilidad de los lotes vinculados."
        onClose={() => setOrdenToDelete(null)}
        onConfirm={() => {
          if (ordenToDelete) {
            onDeleteOrden(ordenToDelete.id);
            setOrdenToDelete(null);
          }
        }}
      >
        {ordenToDelete && (
          <div className="bg-rose-50/70 rounded-xl border border-rose-100 p-4 space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="font-mono font-black text-rose-900 text-sm">
                ORDEN N° {ordenToDelete.numeroOrden}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-slate-200 text-slate-800">
                {ordenToDelete.tipoOrden}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-slate-700 pt-2 border-t border-rose-200/50">
              <div>
                <span className="text-slate-400 block text-[9px] uppercase font-bold">Cliente</span>
                <span className="font-semibold text-slate-800 truncate block">{ordenToDelete.cliente || 'San Diego Semilla'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px] uppercase font-bold">Especie / Variedad</span>
                <span className="font-semibold text-slate-800 truncate block">{ordenToDelete.especie || 'Soja'} - {ordenToDelete.variedad}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px] uppercase font-bold">Demanda Solicitada</span>
                <span className="font-bold text-slate-900">{ordenToDelete.bbPedidos} BB</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px] uppercase font-bold">Progreso Actual</span>
                <span className="font-bold text-emerald-700">{ordenToDelete.hechos} BB ({ordenToDelete.bbPedidos > 0 ? Math.round((ordenToDelete.hechos / ordenToDelete.bbPedidos) * 100) : 0}%)</span>
              </div>
            </div>
          </div>
        )}
      </ConfirmationDialog>

    </div>
  );
};
