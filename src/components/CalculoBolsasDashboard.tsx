/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { SiloId, MovimientoSilo, SILOS_DISPONIBLES, EspecieType } from '../types';
import { formatKg } from '../utils/formatters';
import {
  CategoriaEnvaseKg,
  calcularBolsasYLotes,
  filtrarMovimientosIngreso,
  consolidarIngresos,
  FiltrosIngresos,
  LoteDesgloseItem
} from '../utils/calculoBolsas';
import {
  Calculator,
  Filter,
  Layers,
  Package,
  TrendingDown,
  Scale,
  Calendar,
  Building2,
  Wheat,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Search,
  ChevronRight,
  Database,
  FileSpreadsheet,
  Download,
  Percent
} from 'lucide-react';

interface CalculoBolsasDashboardProps {
  siloStocks: Record<SiloId, number>;
  movimientosSilo: MovimientoSilo[];
  clientes?: string[];
  especies?: string[];
  onAplicarAPrecarga?: (config: {
    cantidadLotes: number;
    cantidadLotes1Decimal?: number;
    permitirLotesConDecimal?: boolean;
    desgloseLotes?: LoteDesgloseItem[];
    stockBolsasPorLote: number;
    kgPorBolsa: CategoriaEnvaseKg;
    totalKgNetos: number;
    silosOrigenNombres?: string;
  }) => void;
  onCerrar?: () => void;
}

export const CalculoBolsasDashboard: React.FC<CalculoBolsasDashboardProps> = ({
  siloStocks = {
    'Silo 1': 0,
    'Silo 2': 0,
    'Silo 3': 0,
    'Silo 4': 0,
    'Silo 5': 0,
    'Silo 6': 0,
  },
  movimientosSilo = [],
  clientes = ['San Diego Semillas', 'Eco Rural', 'Pampa', 'Stine', 'Elementa Foods'],
  especies = ['Soja', 'Trigo', 'Maíz', 'Cebada', 'Girasol', 'Sorgo', 'Garbanzo', 'Arveja'],
  onAplicarAPrecarga,
  onCerrar,
}) => {
  // Pestaña activa del Dashboard: 'calculo' (Opción 1) | 'filtrado-ingresos' (Opción 2)
  const [activeTab, setActiveTab] = useState<'calculo' | 'filtrado-ingresos'>('calculo');

  // ==========================================
  // ESTADO - PESTAÑA 1: ESTIMACIÓN Y CÁLCULO
  // ==========================================
  const [silosSeleccionados, setSilosSeleccionados] = useState<(SiloId | 'TODOS')[]>(['TODOS']);
  const [porcentajeMerma, setPorcentajeMerma] = useState<number>(0);
  const [pesoEnvaseKg, setPesoEnvaseKg] = useState<CategoriaEnvaseKg>(800); // 800 kg por defecto para Big Bag
  // Opción para cargar con 1 decimal en caso de que exceda la cantidad natural de un lote (35 bolsas)
  const [cargarConDecimal, setCargarConDecimal] = useState<boolean>(true);

  // Toggle silo individual o "Todos"
  const handleToggleSilo = (silo: SiloId | 'TODOS') => {
    if (silo === 'TODOS') {
      setSilosSeleccionados(['TODOS']);
      return;
    }

    setSilosSeleccionados((prev) => {
      const sinTodos = prev.filter((s) => s !== 'TODOS') as SiloId[];
      if (sinTodos.includes(silo)) {
        const remaining = sinTodos.filter((s) => s !== silo);
        return remaining.length === 0 ? ['TODOS'] : remaining;
      } else {
        const nextList = [...sinTodos, silo];
        if (nextList.length === SILOS_DISPONIBLES.length) {
          return ['TODOS'];
        }
        return nextList;
      }
    });
  };

  // Cálculo en tiempo real
  const calculoResultado = useMemo(() => {
    return calcularBolsasYLotes({
      silosSeleccionados,
      siloStocks,
      porcentajeMerma,
      pesoEnvaseKg,
    });
  }, [silosSeleccionados, siloStocks, porcentajeMerma, pesoEnvaseKg]);

  // ==========================================
  // ESTADO - PESTAÑA 2: FILTRADO CONSOLIDADO
  // ==========================================
  const [modoFecha, setModoFecha] = useState<'rango' | 'multiples'>('rango');
  const [fechaDesde, setFechaDesde] = useState<string>('');
  const [fechaHasta, setFechaHasta] = useState<string>('');
  const [fechasSeleccionadas, setFechasSeleccionadas] = useState<string[]>([]);
  const [especiesFiltro, setEspeciesFiltro] = useState<string[]>([]);
  const [clientesFiltro, setClientesFiltro] = useState<string[]>([]);
  const [variedadesFiltro, setVariedadesFiltro] = useState<string[]>([]);
  const [silosFiltro, setSilosFiltro] = useState<SiloId[]>([]);
  const [busquedaTexto, setBusquedaTexto] = useState<string>('');

  // Variedades disponibles en los ingresos existentes
  const variedadesDisponibles = useMemo(() => {
    const setVar = new Set<string>();
    movimientosSilo.forEach((m) => {
      if (m.tipo === 'INGRESO' && m.variedad && m.variedad.trim() !== '') {
        setVar.add(m.variedad.trim());
      }
    });
    return Array.from(setVar).sort();
  }, [movimientosSilo]);

  // Fechas únicas disponibles en los ingresos
  const fechasDisponibles = useMemo(() => {
    const setFechas = new Set<string>();
    movimientosSilo.forEach((m) => {
      if (m.tipo === 'INGRESO' && m.fecha) {
        setFechas.add(m.fecha);
      }
    });
    return Array.from(setFechas).sort().reverse();
  }, [movimientosSilo]);

  // Aplicar filtros de ingresos
  const ingresosFiltrados = useMemo(() => {
    const filtros: FiltrosIngresos = {
      modoFecha,
      fechaDesde: fechaDesde || undefined,
      fechaHasta: fechaHasta || undefined,
      fechasSeleccionadas: fechasSeleccionadas.length > 0 ? fechasSeleccionadas : undefined,
      especies: especiesFiltro,
      clientes: clientesFiltro,
      variedades: variedadesFiltro,
      silos: silosFiltro,
      busquedaTexto,
    };
    return filtrarMovimientosIngreso(movimientosSilo, filtros);
  }, [
    movimientosSilo,
    modoFecha,
    fechaDesde,
    fechaHasta,
    fechasSeleccionadas,
    especiesFiltro,
    clientesFiltro,
    variedadesFiltro,
    silosFiltro,
    busquedaTexto,
  ]);

  // Resumen consolidado de los ingresos filtrados
  const consolidado = useMemo(() => {
    return consolidarIngresos(ingresosFiltrados);
  }, [ingresosFiltrados]);

  // Helpers para toggle de filtros multi-selección
  const toggleFiltroItem = (
    currentList: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    item: string
  ) => {
    if (currentList.includes(item)) {
      setter(currentList.filter((i) => i !== item));
    } else {
      setter([...currentList, item]);
    }
  };

  const toggleSiloFiltro = (silo: SiloId) => {
    if (silosFiltro.includes(silo)) {
      setSilosFiltro(silosFiltro.filter((s) => s !== silo));
    } else {
      setSilosFiltro([...silosFiltro, silo]);
    }
  };

  // Resetear filtros
  const handleLimpiarFiltros = () => {
    setFechaDesde('');
    setFechaHasta('');
    setFechasSeleccionadas([]);
    setEspeciesFiltro([]);
    setClientesFiltro([]);
    setVariedadesFiltro([]);
    setSilosFiltro([]);
    setBusquedaTexto('');
  };

  // Presets rápidos de fechas
  const handlePresetFecha = (dias: number | 'mes' | 'todos') => {
    if (dias === 'todos') {
      setFechaDesde('');
      setFechaHasta('');
      return;
    }
    const hoy = new Date();
    const hastaStr = hoy.toISOString().split('T')[0];
    setFechaHasta(hastaStr);

    if (dias === 'mes') {
      const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      setFechaDesde(inicioMes.toISOString().split('T')[0]);
    } else {
      const desdeDate = new Date();
      desdeDate.setDate(hoy.getDate() - dias);
      setFechaDesde(desdeDate.toISOString().split('T')[0]);
    }
  };

  // Transferir cálculo a formulario de Precarga
  const handleTransferirAPrecarga = () => {
    if (!onAplicarAPrecarga) return;

    let silosNombres = 'Todos los Silos';
    if (!silosSeleccionados.includes('TODOS')) {
      silosNombres = (silosSeleccionados as SiloId[]).join(', ');
    }

    const lotesAGenerar = cargarConDecimal && calculoResultado.excedeLoteNatural
      ? calculoResultado.cantidadLotes1Decimal
      : Math.max(1, calculoResultado.cantidadLotesEnteros || 1);

    onAplicarAPrecarga({
      cantidadLotes: lotesAGenerar,
      cantidadLotes1Decimal: calculoResultado.cantidadLotes1Decimal,
      permitirLotesConDecimal: cargarConDecimal,
      desgloseLotes: cargarConDecimal ? calculoResultado.desgloseLotes : calculoResultado.desgloseLotes.filter((l) => l.esLoteCompleto),
      stockBolsasPorLote: 35,
      kgPorBolsa: pesoEnvaseKg,
      totalKgNetos: calculoResultado.kilosNetosKg,
      silosOrigenNombres: silosNombres,
    });
  };

  // Transferir Kilos Filtrados de Opción 2 a la Opción 1 para calcular
  const handleUsarKilosFiltradosEnCalculo = () => {
    // Si queremos transferir los kilos netos filtrados como base
    setActiveTab('calculo');
  };

  // Exportar a CSV simple de ingresos filtrados
  const handleExportarCsv = () => {
    if (ingresosFiltrados.length === 0) return;
    const headers = ['ID', 'Fecha', 'Hora', 'Silo', 'Especie', 'Variedad', 'Cliente', 'Kilos Netos', 'Humedad %', 'Carta de Porte / Remito', 'Chofer', 'Patente'];
    const rows = ingresosFiltrados.map((i) => [
      `"${i.id || ''}"`,
      `"${i.fecha || ''}"`,
      `"${i.hora || ''}"`,
      `"${i.siloId || ''}"`,
      `"${i.especie || ''}"`,
      `"${i.variedad || ''}"`,
      `"${i.cliente || ''}"`,
      i.kg || 0,
      i.humedad || '',
      `"${i.comprobanteCartaPorte || i.remito || ''}"`,
      `"${i.chofer || ''}"`,
      `"${i.patentes || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ingresos_consolidados_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-emerald-950/10 overflow-hidden">
      {/* 1. Header Principal del Dashboard */}
      <div className="bg-gradient-to-r from-emerald-950 via-[#00603C] to-[#254731] text-white p-5 sm:p-6 border-b border-emerald-800/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-amber-400/20 text-amber-300 rounded-2xl border border-amber-400/30 shrink-0">
              <Calculator className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-black uppercase tracking-widest text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">
                  Módulo de Ingeniería de Stock
                </span>
                <span className="text-[10px] font-bold text-emerald-200 bg-emerald-800/80 px-2 py-0.5 rounded-md">
                  Precarga de Lotes
                </span>
              </div>
              <h2 className="font-serif text-2xl font-bold mt-1 tracking-tight">
                Dashboard: Cálculo de Bolsas
              </h2>
              <p className="text-xs text-emerald-100/90 mt-0.5 max-w-2xl">
                Herramienta de estimación en tiempo real según stock bruto en silos, % de merma y categoría de envase, o mediante consolidación de ingresos.
              </p>
            </div>
          </div>

          {onCerrar && (
            <button
              type="button"
              onClick={onCerrar}
              className="self-start md:self-center px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition border border-white/20 cursor-pointer"
            >
              Volver a Precarga
            </button>
          )}
        </div>

        {/* Selector de Pestañas Principales (Opción 1 vs Opción 2) */}
        <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-emerald-800/60">
          <button
            type="button"
            onClick={() => setActiveTab('calculo')}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
              activeTab === 'calculo'
                ? 'bg-amber-400 text-slate-950 shadow-md font-black'
                : 'bg-emerald-900/60 text-emerald-200 hover:bg-emerald-900/90 border border-emerald-700/50'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>Pestaña 1: Estimación y Cálculo de Bolsas (Opción 1)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('filtrado-ingresos')}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
              activeTab === 'filtrado-ingresos'
                ? 'bg-amber-400 text-slate-950 shadow-md font-black'
                : 'bg-emerald-900/60 text-emerald-200 hover:bg-emerald-900/90 border border-emerald-700/50'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>Pestaña 2: Filtrado Consolidado de Ingresos (Opción 2)</span>
            <span className="text-[10px] font-mono font-bold bg-black/30 px-1.5 py-0.2 rounded-full text-white">
              {ingresosFiltrados.length}
            </span>
          </button>
        </div>
      </div>

      {/* 2. CONTENIDO SEGÚN LA PESTAÑA SELECCIONADA */}
      <div className="p-5 sm:p-7 space-y-6">

        {/* ========================================================================= */}
        {/* PESTAÑA 1: ESTIMACIÓN Y CÁLCULO DE BOLSAS (OPCIÓN 1)                      */}
        {/* ========================================================================= */}
        {activeTab === 'calculo' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Grid de Parámetros de Entrada */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

              {/* Columna Izquierda: Parámetros (Silos, Merma, Envase) */}
              <div className="lg:col-span-7 space-y-6">

                {/* 1. Selección de Silos */}
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-mono font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                      <Database className="w-4 h-4 text-[#00603C]" />
                      <span>1. Selección de Silos de Origen</span>
                    </label>
                    <span className="text-[11px] font-mono font-bold text-slate-500">
                      {silosSeleccionados.includes('TODOS')
                        ? '6 Silos seleccionados'
                        : `${silosSeleccionados.length} Silo(s) seleccionado(s)`}
                    </span>
                  </div>

                  {/* Botones de Selección Rápida de Silos */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleToggleSilo('TODOS')}
                      className={`p-3 rounded-xl text-xs font-bold uppercase tracking-wider transition border text-left cursor-pointer col-span-2 sm:col-span-4 flex items-center justify-between ${
                        silosSeleccionados.includes('TODOS')
                          ? 'bg-[#00603C] text-white border-[#00603C] shadow-sm'
                          : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className={`w-4 h-4 ${silosSeleccionados.includes('TODOS') ? 'text-amber-300' : 'text-slate-400'}`} />
                        <span>Todos los Silos (Silo 1 al 6)</span>
                      </div>
                      <span className="font-mono font-bold text-[11px]">
                        {formatKg(Object.values(siloStocks).reduce((a, b) => a + (Number(b) || 0), 0))}
                      </span>
                    </button>

                    {SILOS_DISPONIBLES.map((siloId) => {
                      const isSelected =
                        silosSeleccionados.includes('TODOS') ||
                        silosSeleccionados.includes(siloId);
                      const stock = Number(siloStocks[siloId]) || 0;

                      return (
                        <button
                          key={siloId}
                          type="button"
                          onClick={() => handleToggleSilo(siloId)}
                          className={`p-3 rounded-xl text-left border transition cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'bg-emerald-50 border-emerald-600 text-emerald-950 font-bold shadow-xs'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold">{siloId}</span>
                            <span
                              className={`w-2 h-2 rounded-full ${
                                stock > 0 ? 'bg-emerald-500' : 'bg-slate-300'
                              }`}
                            />
                          </div>
                          <div className="mt-2 text-xs font-mono font-bold text-slate-900">
                            {formatKg(stock)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Descuento por Merma y Categoría de Envase */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Descuento por Merma */}
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 space-y-3">
                    <label className="text-xs font-mono font-bold uppercase tracking-wider text-slate-800 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Percent className="w-4 h-4 text-amber-600" />
                        2. % Descuento por Merma
                      </span>
                      <span className="text-amber-700 font-mono font-bold">{porcentajeMerma}%</span>
                    </label>

                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={porcentajeMerma}
                        onChange={(e) => setPorcentajeMerma(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                        className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-[#00603C] focus:border-[#00603C]"
                        placeholder="0"
                      />
                      <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400 pointer-events-none">
                        %
                      </span>
                    </div>

                    {/* Botones de presets rápidos de merma */}
                    <div className="flex items-center gap-1.5 pt-1">
                      {[0, 1, 2, 3, 5, 10].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setPorcentajeMerma(val)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition cursor-pointer border ${
                            porcentajeMerma === val
                              ? 'bg-amber-500 text-slate-950 border-amber-500 font-extrabold'
                              : 'bg-white text-slate-600 hover:bg-slate-200 border-slate-300'
                          }`}
                        >
                          {val}%
                        </button>
                      ))}
                    </div>

                    <p className="text-[11px] text-slate-500 leading-tight">
                      Fórmula: <code className="font-mono bg-slate-200/80 px-1 py-0.5 rounded text-[10px] text-slate-800">Neto = Bruto * (1 - %Merma)</code>
                    </p>
                  </div>

                  {/* 3. Categoría de Envase */}
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 space-y-3">
                    <label className="text-xs font-mono font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-[#00603C]" />
                      3. Categoría de Envase
                    </label>

                    <div className="space-y-2">
                      {([
                        { peso: 25, label: 'Bolsa 25 kg', desc: 'Envase fraccionado estándar' },
                        { peso: 40, label: 'Bolsa 40 kg', desc: 'Envase semillero 40 kg' },
                        { peso: 800, label: 'Big Bag 800 kg', desc: 'Bolsón industrial (1 lote = 35 bolsas)' },
                      ] as { peso: CategoriaEnvaseKg; label: string; desc: string }[]).map((env) => {
                        const isSelected = pesoEnvaseKg === env.peso;
                        return (
                          <button
                            key={env.peso}
                            type="button"
                            onClick={() => setPesoEnvaseKg(env.peso)}
                            className={`w-full p-2.5 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
                              isSelected
                                ? 'bg-emerald-900 text-white border-emerald-900 shadow-xs'
                                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <div>
                              <div className="text-xs font-extrabold flex items-center gap-2">
                                <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-amber-300 bg-amber-400' : 'border-slate-400'}`}>
                                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                                </span>
                                <span>{env.label}</span>
                              </div>
                              <div className={`text-[10px] mt-0.5 ml-5.5 ${isSelected ? 'text-emerald-200' : 'text-slate-500'}`}>
                                {env.desc}
                              </div>
                            </div>
                            <span className={`text-xs font-mono font-black px-2 py-0.5 rounded-md ${isSelected ? 'bg-amber-400 text-slate-950' : 'bg-slate-100 text-slate-800'}`}>
                              {env.peso} kg
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

              </div>

              {/* Columna Derecha: KPI Cards y Resultados del Cálculo */}
              <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
                <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950 text-white rounded-2xl p-6 shadow-lg border border-emerald-500/20 space-y-5">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <span className="text-xs font-mono font-bold uppercase tracking-widest text-amber-300 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" />
                      Resultados del Cálculo
                    </span>
                    <span className="text-[10px] font-mono bg-white/10 px-2 py-0.5 rounded text-emerald-200">
                      Envase {pesoEnvaseKg} kg
                    </span>
                  </div>

                  {/* Stock Bruto vs Kilos Netos */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                      <div className="text-[10px] font-mono uppercase text-slate-400">
                        Stock Bruto Seleccionado
                      </div>
                      <div className="text-lg font-mono font-black text-white mt-1">
                        {formatKg(calculoResultado.stockBrutoKg)}
                      </div>
                    </div>

                    <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                      <div className="text-[10px] font-mono uppercase text-amber-300/90 flex items-center gap-1">
                        <TrendingDown className="w-3 h-3 text-amber-400" />
                        Descuento por Merma ({calculoResultado.porcentajeMerma}%)
                      </div>
                      <div className="text-lg font-mono font-black text-amber-300 mt-1">
                        - {formatKg(calculoResultado.kilosMermaKg)}
                      </div>
                    </div>
                  </div>

                  {/* Kilos Netos a Envasar */}
                  <div className="p-4 bg-emerald-900/40 rounded-xl border border-emerald-500/30 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-300 font-bold">
                        Kilos Netos Disponibles (A Envasar)
                      </div>
                      <div className="text-2xl font-mono font-black text-white mt-0.5">
                        {formatKg(calculoResultado.kilosNetosKg)}
                      </div>
                    </div>
                    <Scale className="w-8 h-8 text-emerald-400/50" />
                  </div>

                  {/* KPI PRINCIPALES: Cantidad de Bolsas & Cantidad de Lotes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* KPI 1: Cantidad de Bolsas */}
                    <div className="bg-gradient-to-b from-amber-500/20 to-amber-500/5 rounded-2xl p-4 border border-amber-400/40">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-300">
                          Cantidad de Bolsas
                        </span>
                        <Package className="w-4 h-4 text-amber-400" />
                      </div>
                      <div className="text-3xl font-mono font-black text-amber-300 mt-2">
                        {calculoResultado.cantidadBolsasEnteras.toLocaleString('es-AR')}
                        <span className="text-xs font-normal text-amber-200/80 ml-1">unidades</span>
                      </div>
                      <div className="text-[11px] font-mono text-amber-200/70 mt-1">
                        Exacto: {calculoResultado.cantidadBolsasDecimal.toLocaleString('es-AR')} bolsas
                      </div>
                      {calculoResultado.kilosRemanentes > 0 && (
                        <div className="text-[10px] text-amber-100/60 mt-1">
                          Remanente: {formatKg(calculoResultado.kilosRemanentes)}
                        </div>
                      )}
                    </div>

                    {/* KPI 2: Cantidad de Lotes (Con opción de 1 decimal si excede lote natural de 35 bolsas) */}
                    <div className="bg-gradient-to-b from-emerald-500/20 to-emerald-500/5 rounded-2xl p-4 border border-emerald-400/40 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-300">
                            Cantidad de Lotes
                          </span>
                          <Layers className="w-4 h-4 text-emerald-400 shrink-0" />
                        </div>

                        {/* Selector de Modo: 1 Decimal vs Lotes Enteros */}
                        <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-emerald-500/30 mt-2">
                          <button
                            type="button"
                            onClick={() => setCargarConDecimal(true)}
                            className={`flex-1 py-1 px-1.5 rounded-lg text-[9.5px] font-mono font-bold transition cursor-pointer text-center ${
                              cargarConDecimal
                                ? 'bg-emerald-400 text-slate-950 shadow-xs font-black'
                                : 'text-emerald-200/80 hover:text-white'
                            }`}
                            title="Calcula y precarga lotes con 1 decimal en caso de exceder 35 bolsas"
                          >
                            1 Decimal ({calculoResultado.cantidadLotes1Decimal})
                          </button>
                          <button
                            type="button"
                            onClick={() => setCargarConDecimal(false)}
                            className={`flex-1 py-1 px-1.5 rounded-lg text-[9.5px] font-mono font-bold transition cursor-pointer text-center ${
                              !cargarConDecimal
                                ? 'bg-emerald-400 text-slate-950 shadow-xs font-black'
                                : 'text-emerald-200/80 hover:text-white'
                            }`}
                            title="Solo genera lotes enteros de 35 bolsas"
                          >
                            Enteros ({calculoResultado.cantidadLotesEnteros})
                          </button>
                        </div>

                        {/* Valor Principal de Lotes */}
                        <div className="text-3xl font-mono font-black text-emerald-300 mt-2.5">
                          {cargarConDecimal
                            ? calculoResultado.cantidadLotes1Decimal
                            : calculoResultado.cantidadLotesEnteros}
                          <span className="text-xs font-normal text-emerald-200/80 ml-1.5">
                            {cargarConDecimal
                              ? (calculoResultado.excedeLoteNatural ? 'lotes (con 1 decimal)' : 'lotes exactos')
                              : 'lotes completos'}
                          </span>
                        </div>

                        {/* Explicación / Desglose */}
                        <div className="text-[11px] font-mono text-emerald-200/80 mt-1 leading-tight">
                          {cargarConDecimal ? (
                            calculoResultado.excedeLoteNatural ? (
                              <span className="text-amber-200 font-bold">
                                {calculoResultado.cantidadLotesEnteros} lote(s) de 35 b. + 1 de {calculoResultado.bolsasRemanentesLote} b. (0.{(calculoResultado.bolsasRemanentesLote / 35).toFixed(1).replace('0.', '')} lote)
                              </span>
                            ) : (
                              `${calculoResultado.cantidadLotesEnteros} lote(s) exacto(s) de 35 bolsas`
                            )
                          ) : (
                            calculoResultado.bolsasRemanentesLote > 0
                              ? `+ ${calculoResultado.bolsasRemanentesLote} bolsas sueltas remanentes`
                              : 'Lotes exactos de 35 bolsas'
                          )}
                        </div>
                      </div>

                      {/* Badge / Aviso si excede la cantidad natural */}
                      {calculoResultado.excedeLoteNatural && (
                        <div className="mt-2.5 pt-2 border-t border-emerald-500/20 text-[10px] text-amber-300/90 flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
                          <span>
                            {cargarConDecimal
                              ? `Excede lote natural: precargará ${calculoResultado.desgloseLotes.length} lotes (${calculoResultado.cantidadLotes1Decimal} lotes en total)`
                              : `Excede lote natural (+${calculoResultado.bolsasRemanentesLote} bolsas no asignadas a lote)`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Resumen explicativo y desglose de lotes */}
                  <div className="text-[11px] text-slate-300 bg-black/30 p-3.5 rounded-xl border border-white/5 space-y-2">
                    <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                      <span className="font-bold text-slate-200">Regla Estándar de Planta:</span>
                      <span className="text-[10px] font-mono text-amber-300">1 Lote Natural = 35 Bolsas</span>
                    </div>

                    {cargarConDecimal && calculoResultado.excedeLoteNatural && calculoResultado.desgloseLotes.length > 0 ? (
                      <div className="space-y-1">
                        <div className="text-[10px] font-mono uppercase font-bold text-emerald-300">
                          Desglose a cargar en Precarga ({calculoResultado.cantidadLotes1Decimal} Lotes):
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-24 overflow-y-auto pt-0.5">
                          {calculoResultado.desgloseLotes.map((lote) => (
                            <div
                              key={lote.nroLote}
                              className={`px-2 py-1 rounded text-[10px] font-mono flex items-center justify-between border ${
                                lote.esLoteCompleto
                                  ? 'bg-emerald-950/60 border-emerald-500/30 text-emerald-200'
                                  : 'bg-amber-950/60 border-amber-400/40 text-amber-200'
                              }`}
                            >
                              <span>Lote #{lote.nroLote}: {lote.bolsas} bolsas</span>
                              <span className="font-bold">
                                {lote.esLoteCompleto ? '1.0 lote' : `${lote.fraccionLoteDecimal} lote`}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10.5px] text-slate-300 leading-relaxed">
                        • Fórmula: <code className="text-amber-300">Bolsas = Netos / {pesoEnvaseKg} kg</code> | <code className="text-emerald-300">Lotes = Bolsas / 35</code>
                      </div>
                    )}
                  </div>
                </div>

                {/* Botón de Acción para precargar lotes directamente */}
                {onAplicarAPrecarga && (
                  <button
                    type="button"
                    onClick={handleTransferirAPrecarga}
                    disabled={calculoResultado.kilosNetosKg <= 0}
                    className="w-full py-4 bg-[#00603C] hover:bg-[#254731] text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg transition flex items-center justify-center gap-3 cursor-pointer border border-emerald-400/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CheckCircle2 className="w-5 h-5 text-amber-300" />
                    <span>
                      {cargarConDecimal && calculoResultado.excedeLoteNatural
                        ? `Aplicar ${calculoResultado.cantidadLotes1Decimal} Lote(s) a Precarga (${calculoResultado.desgloseLotes.length} lotes)`
                        : `Aplicar ${Math.max(1, calculoResultado.cantidadLotesEnteros)} Lote(s) Entero(s) a Precarga`}
                    </span>
                    <ArrowRight className="w-4 h-4 text-amber-300" />
                  </button>
                )}
              </div>

            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PESTAÑA 2: FILTRADO CONSOLIDADO DE INGRESOS (OPCIÓN 2)                    */}
        {/* ========================================================================= */}
        {activeTab === 'filtrado-ingresos' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* 1. Barra de Filtros Combinados */}
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-slate-800">
                  <Filter className="w-4 h-4 text-[#00603C]" />
                  <span>Filtros Combinados de Ingresos a Silos</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleLimpiarFiltros}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-red-700 transition cursor-pointer px-3 py-1 bg-white rounded-lg border border-slate-300"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Limpiar Filtros</span>
                  </button>
                </div>
              </div>

              {/* Filtros: Fila 1 (Fechas y Búsqueda) */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Control de Fechas */}
                <div className="md:col-span-7 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-mono font-bold uppercase text-slate-700 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#00603C]" />
                      <span>Rango de Fechas de Ingreso</span>
                    </label>
                    <div className="flex items-center gap-1 text-[10px]">
                      <button
                        type="button"
                        onClick={() => handlePresetFecha(0)}
                        className="px-2 py-0.5 rounded bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 font-mono"
                      >
                        Hoy
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePresetFecha(7)}
                        className="px-2 py-0.5 rounded bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 font-mono"
                      >
                        7 días
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePresetFecha(30)}
                        className="px-2 py-0.5 rounded bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 font-mono"
                      >
                        30 días
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePresetFecha('mes')}
                        className="px-2 py-0.5 rounded bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 font-mono"
                      >
                        Este Mes
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePresetFecha('todos')}
                        className="px-2 py-0.5 rounded bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 font-mono"
                      >
                        Todos
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-500 font-mono">Desde:</span>
                      <input
                        type="date"
                        value={fechaDesde}
                        onChange={(e) => setFechaDesde(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-[#00603C]"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-mono">Hasta:</span>
                      <input
                        type="date"
                        value={fechaHasta}
                        onChange={(e) => setFechaHasta(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-[#00603C]"
                      />
                    </div>
                  </div>
                </div>

                {/* Búsqueda de Texto Libre */}
                <div className="md:col-span-5 space-y-2">
                  <label className="text-[11px] font-mono font-bold uppercase text-slate-700 flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5 text-[#00603C]" />
                    <span>Búsqueda Rápida (Comprobante, Chofer, Patente)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={busquedaTexto}
                      onChange={(e) => setBusquedaTexto(e.target.value)}
                      placeholder="Ej: Carta porte, Chofer, Patente..."
                      className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-[#00603C]"
                    />
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  </div>
                </div>
              </div>

              {/* Filtros: Fila 2 (Especies, Clientes, Variedades, Silos) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-slate-200">
                {/* 1. Multi-selección Especies */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-mono font-bold uppercase text-slate-700 flex items-center gap-1">
                      <Wheat className="w-3.5 h-3.5 text-[#00603C]" />
                      <span>Especie ({especiesFiltro.length || 'Todas'})</span>
                    </label>
                    {especiesFiltro.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setEspeciesFiltro([])}
                        className="text-[10px] text-red-600 hover:underline cursor-pointer"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1.5 bg-white rounded-xl border border-slate-200">
                    {especies.map((esp) => {
                      const isSelected = especiesFiltro.includes(esp);
                      return (
                        <button
                          key={esp}
                          type="button"
                          onClick={() => toggleFiltroItem(especiesFiltro, setEspeciesFiltro, esp)}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer ${
                            isSelected
                              ? 'bg-[#00603C] text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {esp}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Multi-selección Clientes */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-mono font-bold uppercase text-slate-700 flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-[#00603C]" />
                      <span>Cliente ({clientesFiltro.length || 'Todos'})</span>
                    </label>
                    {clientesFiltro.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setClientesFiltro([])}
                        className="text-[10px] text-red-600 hover:underline cursor-pointer"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1.5 bg-white rounded-xl border border-slate-200">
                    {clientes.map((cli) => {
                      const isSelected = clientesFiltro.includes(cli);
                      return (
                        <button
                          key={cli}
                          type="button"
                          onClick={() => toggleFiltroItem(clientesFiltro, setClientesFiltro, cli)}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer ${
                            isSelected
                              ? 'bg-[#00603C] text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {cli}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Multi-selección Variedades */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-mono font-bold uppercase text-slate-700 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-[#00603C]" />
                      <span>Variedad ({variedadesFiltro.length || 'Todas'})</span>
                    </label>
                    {variedadesFiltro.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setVariedadesFiltro([])}
                        className="text-[10px] text-red-600 hover:underline cursor-pointer"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1.5 bg-white rounded-xl border border-slate-200">
                    {variedadesDisponibles.length > 0 ? (
                      variedadesDisponibles.map((v) => {
                        const isSelected = variedadesFiltro.includes(v);
                        return (
                          <button
                            key={v}
                            type="button"
                            onClick={() => toggleFiltroItem(variedadesFiltro, setVariedadesFiltro, v)}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold transition cursor-pointer ${
                              isSelected
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {v}
                          </button>
                        );
                      })
                    ) : (
                      <span className="text-[10px] text-slate-400 italic p-1">Sin variedades registradas</span>
                    )}
                  </div>
                </div>

                {/* 4. Multi-selección Silos */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-mono font-bold uppercase text-slate-700 flex items-center gap-1">
                      <Database className="w-3.5 h-3.5 text-[#00603C]" />
                      <span>Silo Destino ({silosFiltro.length || 'Todos'})</span>
                    </label>
                    {silosFiltro.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSilosFiltro([])}
                        className="text-[10px] text-red-600 hover:underline cursor-pointer"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1.5 bg-white rounded-xl border border-slate-200">
                    {SILOS_DISPONIBLES.map((sil) => {
                      const isSelected = silosFiltro.includes(sil);
                      return (
                        <button
                          key={sil}
                          type="button"
                          onClick={() => toggleSiloFiltro(sil)}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-800 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {sil}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Resumen Consolidado Destacado (Total de Kilos Netos) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Card 1: Total Kilos Netos */}
              <div className="bg-gradient-to-br from-[#00603C] to-[#254731] text-white rounded-2xl p-5 shadow-md flex items-center justify-between border border-emerald-500/30">
                <div>
                  <div className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-200">
                    Total Kilos Netos Filtrados
                  </div>
                  <div className="text-3xl font-mono font-black text-amber-300 mt-1">
                    {formatKg(consolidado.totalKilosNetos)}
                  </div>
                  <div className="text-xs text-emerald-100 mt-1">
                    {consolidado.totalIngresosCount} ingreso(s) registrado(s)
                  </div>
                </div>
                <Scale className="w-10 h-10 text-amber-300/40" />
              </div>

              {/* Card 2: Equivalencia en Bolsas y Lotes (Big Bag 800 kg) */}
              <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-md flex items-center justify-between border border-slate-800">
                <div>
                  <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                    Equivalencia Estimada (800 kg)
                  </div>
                  <div className="text-2xl font-mono font-bold text-white mt-1">
                    {Math.floor(consolidado.totalKilosNetos / 800).toLocaleString('es-AR')}{' '}
                    <span className="text-xs text-slate-300">bolsas</span>
                  </div>
                  <div className="text-xs text-emerald-400 font-mono mt-1">
                    ≈ {(consolidado.totalKilosNetos / 28000).toFixed(2)} lotes de 35 bolsas
                  </div>
                </div>
                <Package className="w-10 h-10 text-emerald-400/40" />
              </div>

              {/* Card 3: Humedad Promedio y Acciones */}
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-mono font-bold uppercase text-slate-500">
                      Humedad Promedio
                    </div>
                    <div className="text-xl font-mono font-bold text-slate-900 mt-0.5">
                      {consolidado.promedioHumedad > 0 ? `${consolidado.promedioHumedad}%` : 'N/D'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportarCsv}
                    disabled={ingresosFiltrados.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold rounded-xl border border-slate-300 shadow-2xs transition cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5 text-[#00603C]" />
                    <span>Exportar CSV</span>
                  </button>
                </div>

                <div className="mt-2 text-[11px] text-slate-600 flex items-center justify-between">
                  <span>Desglose por cliente: {Object.keys(consolidado.desglosePorCliente).length}</span>
                  <span>Especies: {Object.keys(consolidado.desglosePorEspecie).length}</span>
                </div>
              </div>
            </div>

            {/* 3. Tabla con los Detalles de los Ingresos Filtrados */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-serif font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Database className="w-4 h-4 text-[#00603C]" />
                  <span>Detalle de Registros de Ingreso ({ingresosFiltrados.length})</span>
                </h3>
                <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                  Total: {formatKg(consolidado.totalKilosNetos)}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 text-slate-700 font-mono text-[11px] uppercase border-b border-slate-200">
                      <th className="py-3 px-4 font-bold">ID / Comprobante</th>
                      <th className="py-3 px-4 font-bold">Fecha / Hora</th>
                      <th className="py-3 px-4 font-bold">Silo</th>
                      <th className="py-3 px-4 font-bold">Especie</th>
                      <th className="py-3 px-4 font-bold">Variedad</th>
                      <th className="py-3 px-4 font-bold">Cliente</th>
                      <th className="py-3 px-4 font-bold text-right">Kilos Netos</th>
                      <th className="py-3 px-4 font-bold text-center">Humedad</th>
                      <th className="py-3 px-4 font-bold">Chofer / Patente</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ingresosFiltrados.length > 0 ? (
                      ingresosFiltrados.map((mov, idx) => (
                        <tr
                          key={mov.id || idx}
                          className="hover:bg-emerald-50/40 transition duration-150"
                        >
                          <td className="py-3 px-4">
                            <div className="font-mono font-bold text-slate-900">{mov.id}</div>
                            {(mov.comprobanteCartaPorte || mov.remito || mov.cartaPorte) && (
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                Doc: {mov.comprobanteCartaPorte || mov.remito || mov.cartaPorte}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-mono text-slate-800">{mov.fecha}</div>
                            {mov.hora && <div className="text-[10px] text-slate-400 font-mono">{mov.hora} hs</div>}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-block px-2 py-0.5 bg-emerald-100 text-[#00603C] rounded-md font-mono font-bold text-[11px]">
                              {mov.siloId}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-800">
                            {mov.especie || '—'}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                              {mov.variedad || '—'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-700">
                            {mov.cliente || '—'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="font-mono font-black text-slate-900 text-sm">
                              {formatKg(mov.kg)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {mov.humedad !== undefined && mov.humedad !== null ? (
                              <span className="font-mono font-bold text-slate-800 bg-amber-100 text-amber-900 px-2 py-0.5 rounded text-[11px]">
                                {mov.humedad}%
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            <div className="font-medium text-slate-800">{mov.chofer || '—'}</div>
                            {mov.patentes && (
                              <div className="text-[10px] font-mono text-slate-500">{mov.patentes}</div>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-500">
                          <div className="max-w-md mx-auto space-y-2">
                            <Filter className="w-8 h-8 text-slate-400 mx-auto" />
                            <div className="font-bold text-slate-700">No se encontraron ingresos con los filtros seleccionados</div>
                            <p className="text-xs text-slate-500">
                              Intente ampliar el rango de fechas o limpiar los filtros de Especie, Cliente o Silo.
                            </p>
                            <button
                              type="button"
                              onClick={handleLimpiarFiltros}
                              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#00603C] text-white text-xs font-bold rounded-xl shadow-xs"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Restablecer Filtros</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
