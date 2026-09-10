/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { formatKg } from '../utils/formatters';
import {
  CategoriaEnvaseKg,
  calcularBolsasYLotes,
  LoteDesgloseItem
} from '../utils/calculoBolsas';
import {
  Calculator,
  Package,
  TrendingDown,
  Scale,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Plus,
  Minus,
  Check,
  Building2,
  Warehouse,
  Droplets,
  Layers
} from 'lucide-react';
import { SiloId, CAPACIDAD_MAX_SILO, MovimientoSilo } from '../types';
import { getSiloDetailedInfo } from '../utils/siloValidation';

interface CalculoBolsasDashboardProps {
  siloStocks?: Record<string, number>;
  movimientosSilo?: any[];
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
  siloStocks = {},
  movimientosSilo = [],
  onAplicarAPrecarga,
  onCerrar,
}) => {
  // =========================================================================
  // ESTADO - CARGA MANUAL DE TOTAL DE KILOS BRUTOS A PROCESAR
  // =========================================================================
  const [totalKilosBrutos, setTotalKilosBrutos] = useState<number>(28000); // 28.000 kg por defecto (1 lote natural)
  const [porcentajeMerma, setPorcentajeMerma] = useState<number>(0);
  const [pesoEnvaseKg, setPesoEnvaseKg] = useState<CategoriaEnvaseKg>(800); // 800 kg por defecto para Big Bag
  const [cargarConDecimal, setCargarConDecimal] = useState<boolean>(true);

  // =========================================================================
  // DASHBOARD DE SILOS - SELECCIÓN INTERACTIVA PARA CÁLCULO DE BOLSAS
  // =========================================================================
  const [selectedSilos, setSelectedSilos] = useState<Record<string, boolean>>({});
  const [autoSyncSilos, setAutoSyncSilos] = useState<boolean>(true);

  // Información detallada de los 6 silos físicos
  const silosInfoList = useMemo(() => {
    return (['Silo 1', 'Silo 2', 'Silo 3', 'Silo 4', 'Silo 5', 'Silo 6'] as SiloId[]).map((sId) => {
      const detailed = getSiloDetailedInfo(sId, (movimientosSilo as MovimientoSilo[]) || []);
      const stockKg = siloStocks[sId] !== undefined ? Number(siloStocks[sId]) : detailed.stockKg;
      return {
        siloId: sId,
        stockKg,
        stockTn: (stockKg / 1000).toFixed(1),
        pct: Math.min(100, Math.round((stockKg / CAPACIDAD_MAX_SILO) * 100)),
        cliente: detailed.cliente || '',
        variedad: detailed.variedad || '',
        especie: detailed.especie || '',
        humedad: detailed.humedad || ''
      };
    });
  }, [siloStocks, movimientosSilo]);

  // Stock total de los silos seleccionados
  const totalKgSilosSeleccionados = useMemo(() => {
    return silosInfoList.reduce((acc, curr) => {
      if (selectedSilos[curr.siloId]) {
        return acc + curr.stockKg;
      }
      return acc;
    }, 0);
  }, [silosInfoList, selectedSilos]);

  const countSilosSeleccionados = useMemo(() => {
    return Object.values(selectedSilos).filter(Boolean).length;
  }, [selectedSilos]);

  // Nombres de los silos seleccionados
  const nombresSilosSeleccionados = useMemo(() => {
    return Object.keys(selectedSilos).filter((s) => selectedSilos[s]).join(', ');
  }, [selectedSilos]);

  // Manejar selección de silos
  const handleToggleSilo = (siloId: string) => {
    const nextSelected = { ...selectedSilos, [siloId]: !selectedSilos[siloId] };
    setSelectedSilos(nextSelected);

    if (autoSyncSilos) {
      const nextTotal = silosInfoList.reduce((acc, curr) => {
        if (nextSelected[curr.siloId]) {
          return acc + curr.stockKg;
        }
        return acc;
      }, 0);
      setTotalKilosBrutos(nextTotal > 0 ? nextTotal : 0);
    }
  };

  const handleSeleccionarTodosSilos = () => {
    const nextSelected: Record<string, boolean> = {};
    let total = 0;
    silosInfoList.forEach((s) => {
      if (s.stockKg > 0) {
        nextSelected[s.siloId] = true;
        total += s.stockKg;
      }
    });
    setSelectedSilos(nextSelected);
    if (autoSyncSilos && total > 0) {
      setTotalKilosBrutos(total);
    }
  };

  const handleDeseleccionarTodosSilos = () => {
    setSelectedSilos({});
    if (autoSyncSilos) {
      setTotalKilosBrutos(0);
    }
  };

  const handleAplicarStockSilosSeleccionados = () => {
    setTotalKilosBrutos(totalKgSilosSeleccionados);
  };

  // Stock total registrado en silos (si existe en base de datos)
  const totalStockSilosRegistrado = useMemo(() => {
    return Object.values(siloStocks).reduce((acc: number, curr) => acc + (Number(curr) || 0), 0);
  }, [siloStocks]);

  // Actualizar kilos brutos manualmente
  const handleSetKilos = (nuevoTotal: number) => {
    const totalSeguro = Math.max(0, isNaN(nuevoTotal) ? 0 : nuevoTotal);
    setTotalKilosBrutos(totalSeguro);
  };

  // Ajustar kilos por delta (incremento/decremento)
  const handleAjustarKilos = (delta: number) => {
    setTotalKilosBrutos((prev) => Math.max(0, prev + delta));
  };

  // Limpiar kilos a 0
  const handleLimpiarKilos = () => {
    setTotalKilosBrutos(0);
  };

  // =========================================================================
  // CÁLCULO EN TIEMPO REAL CON LOS KILOS CARGADOS MANUALMENTE
  // =========================================================================
  const calculoResultado = useMemo(() => {
    return calcularBolsasYLotes({
      kilosBrutosManuales: totalKilosBrutos,
      porcentajeMerma,
      pesoEnvaseKg,
    });
  }, [totalKilosBrutos, porcentajeMerma, pesoEnvaseKg]);

  // Transferir cálculo a formulario de Precarga
  const handleTransferirAPrecarga = () => {
    if (!onAplicarAPrecarga) return;

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
      silosOrigenNombres: nombresSilosSeleccionados || 'Carga Manual',
    });
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl border border-emerald-950/10 overflow-hidden" id="dashboard-calculo-bolsas">
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
                  Módulo de Ingeniería
                </span>
                <span className="text-[10px] font-bold text-emerald-200 bg-emerald-800/80 px-2 py-0.5 rounded-md">
                  Stock de Silos & Cálculo de Bolsas
                </span>
              </div>
              <h2 className="font-serif text-2xl font-bold mt-1 tracking-tight">
                Dashboard: Silos & Cálculo de Bolsas (BLS)
              </h2>
              <p className="text-xs text-emerald-100/90 mt-0.5 max-w-2xl">
                Seleccione uno o varios silos con su stock actual en planta o ingrese kilos manualmente para calcular bolsas y lotes en tiempo real.
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
      </div>

      {/* 2. CONTENIDO PRINCIPAL: DASHBOARD DE SILOS + PARÁMETROS + RESULTADOS */}
      <div className="p-5 sm:p-7 space-y-6">

        {/* =================================================================== */}
        {/* SECCIÓN A: DASHBOARD CON SILOS Y CANTIDAD DE KG EN STOCK            */}
        {/* =================================================================== */}
        <div className="bg-slate-50/90 rounded-3xl p-5 sm:p-6 border border-slate-200/80 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-100 text-[#00603C] rounded-xl">
                <Warehouse className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif text-base font-bold text-slate-900">
                  Dashboard de Silos & Stock Disponible
                </h3>
                <p className="text-[11px] text-slate-500">
                  Haga clic en los silos para seleccionarlos y calcular automáticamente las bolsas (BLS).
                </p>
              </div>
            </div>

            {/* Acciones de Selección de Silos */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSeleccionarTodosSilos}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 shadow-2xs transition cursor-pointer"
              >
                Seleccionar Silos con Stock
              </button>
              <button
                type="button"
                onClick={handleDeseleccionarTodosSilos}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-600 text-xs font-bold rounded-xl border border-slate-300 shadow-2xs transition cursor-pointer"
              >
                Limpiar Selección
              </button>

              <label className="flex items-center gap-1.5 text-xs text-slate-700 font-bold ml-1 cursor-pointer select-none bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200">
                <input
                  type="checkbox"
                  checked={autoSyncSilos}
                  onChange={(e) => setAutoSyncSilos(e.target.checked)}
                  className="w-3.5 h-3.5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                />
                <span>Auto-sincronizar Kilos</span>
              </label>
            </div>
          </div>

          {/* Grilla de los 6 Silos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {silosInfoList.map((silo) => {
              const isSelected = !!selectedSilos[silo.siloId];
              const tieneStock = silo.stockKg > 0;

              return (
                <div
                  key={silo.siloId}
                  id={`silo-calc-card-${silo.siloId.replace(/\s+/g, '')}`}
                  onClick={() => handleToggleSilo(silo.siloId)}
                  className={`rounded-2xl p-4 border-2 transition-all duration-200 cursor-pointer relative overflow-hidden shadow-2xs ${
                    isSelected
                      ? 'bg-emerald-50/90 border-[#00603C] ring-2 ring-emerald-500/30'
                      : tieneStock
                      ? 'bg-white border-slate-200 hover:border-slate-300'
                      : 'bg-slate-100/70 border-slate-200/60 opacity-80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-[#00603C] text-white' : 'bg-slate-100 text-slate-700'}`}>
                        <Warehouse className="w-4 h-4" />
                      </div>
                      <span className="font-serif font-black text-sm text-slate-900">{silo.siloId}</span>
                    </div>

                    {/* Checkbox de Selección Visual */}
                    <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition ${
                      isSelected
                        ? 'bg-[#00603C] border-[#00603C] text-white'
                        : 'border-slate-300 bg-white'
                    }`}>
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>

                  {/* Kilos en Stock */}
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between">
                      <div>
                        <span className="text-[10px] font-mono text-slate-500 uppercase block font-bold">
                          Stock Actual
                        </span>
                        <span className="font-mono text-lg font-black text-slate-900">
                          {formatKg(silo.stockKg)} <span className="text-xs font-normal text-slate-500">kg</span>
                        </span>
                      </div>
                      <div className="text-right font-mono text-xs font-bold text-emerald-800">
                        {silo.stockTn} Tn
                      </div>
                    </div>

                    {/* Barra de Porcentaje */}
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          silo.pct >= 90 ? 'bg-red-500' : silo.pct >= 70 ? 'bg-amber-400' : 'bg-emerald-600'
                        }`}
                        style={{ width: `${silo.pct}%` }}
                      />
                    </div>

                    {/* Detalles de Cliente, Variedad y Humedad */}
                    <div className="pt-1.5 border-t border-slate-200/60 text-[11px] space-y-0.5">
                      <div className="truncate text-slate-700">
                        <span className="text-slate-400">Cliente:</span>{' '}
                        <strong className="font-semibold text-slate-900">
                          {silo.cliente || 'Sin asignar'}
                        </strong>
                      </div>
                      <div className="truncate text-slate-700">
                        <span className="text-slate-400">Variedad:</span>{' '}
                        <strong className="font-semibold text-emerald-900">
                          {silo.variedad || 'Descontaminado'}
                        </strong>
                      </div>
                      {silo.humedad && silo.humedad !== '—' && (
                        <div className="text-blue-900 font-mono font-bold flex items-center gap-1 text-[10px]">
                          <Droplets className="w-2.5 h-2.5 text-blue-600" />
                          <span>{silo.humedad}% Humedad</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Barra de Resumen de Silos Seleccionados */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 text-amber-900 rounded-xl border border-amber-200">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold uppercase text-slate-500 block">
                  Stock Total de Silos Seleccionados ({countSilosSeleccionados} silo(s))
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-xl font-black text-slate-900">
                    {formatKg(totalKgSilosSeleccionados)} kg
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-800">
                    ({(totalKgSilosSeleccionados / 1000).toFixed(1)} Tn)
                  </span>
                </div>
              </div>
            </div>

            {!autoSyncSilos && (
              <button
                type="button"
                onClick={handleAplicarStockSilosSeleccionados}
                disabled={totalKgSilosSeleccionados <= 0}
                className="px-5 py-2.5 bg-[#00603C] hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
              >
                Usar Stock de Silos Seleccionados
              </button>
            )}
          </div>
        </div>

        {/* =================================================================== */}
        {/* SECCIÓN B: PARÁMETROS DE CÁLCULO Y RESULTADOS                       */}
        {/* =================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* COLUMNA IZQUIERDA: PARÁMETROS (CARGA MANUAL, MERMA, ENVASE) */}
          <div className="lg:col-span-7 space-y-6">

            {/* KILOS BRUTOS A PROCESAR */}
            <div className="bg-slate-50/90 rounded-2xl p-5 sm:p-6 border border-slate-200/80 space-y-4 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/70 pb-3">
                <div>
                  <label className="text-xs font-mono font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                    <Scale className="w-4 h-4 text-[#00603C]" />
                    <span>Kilos Brutos a Procesar</span>
                  </label>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Modifique o ajuste los kilos brutos para determinar la cantidad exacta de bolsas y lotes.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleLimpiarKilos}
                    className="text-[11px] font-bold text-slate-500 hover:text-red-700 transition cursor-pointer px-2.5 py-1 bg-white rounded-lg border border-slate-200 shadow-2xs flex items-center gap-1"
                    title="Poner todos los kilos manuales en cero"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Poner en 0</span>
                  </button>
                </div>
              </div>

              {/* Display y Campo Principal de Kilos Brutos */}
              <div className="bg-white rounded-2xl p-4 sm:p-5 border-2 border-[#00603C]/30 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono font-black uppercase tracking-wider text-slate-400 block">
                      KILOS BRUTOS INGRESADOS
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl sm:text-3xl font-mono font-black text-[#00603C]">
                        {formatKg(totalKilosBrutos)}
                      </span>
                      <span className="text-sm font-mono font-bold text-slate-500">
                        ({(totalKilosBrutos / 1000).toFixed(1)} Tn)
                      </span>
                    </div>
                  </div>

                  <div className="w-full sm:w-56">
                    <label className="text-[10px] font-mono font-bold uppercase text-slate-500 block mb-1">
                      Edición Rápida (kg)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={totalKilosBrutos || ''}
                        onChange={(e) => handleSetKilos(Number(e.target.value))}
                        placeholder="ej: 28000"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border-2 border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 focus:border-[#00603C] focus:bg-white outline-none transition"
                      />
                      <span className="absolute right-3 top-2.5 text-xs font-mono font-bold text-slate-400 pointer-events-none">
                        kg
                      </span>
                    </div>
                  </div>
                </div>

                {/* Botones de Presets de Kilos */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-mono font-bold uppercase text-slate-400 mr-1">
                    Presets:
                  </span>
                  {[
                    { label: '1 Lote (28 Tn)', valor: 28000 },
                    { label: '2 Lotes (56 Tn)', valor: 56000 },
                    { label: '3 Lotes (84 Tn)', valor: 84000 },
                    { label: '4 Lotes (112 Tn)', valor: 112000 },
                    { label: '5 Lotes (140 Tn)', valor: 140000 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handleSetKilos(preset.valor)}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-200 bg-slate-50 hover:bg-[#00603C] hover:text-white transition shadow-2xs cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. CONFIGURACIÓN DE MERMA Y ENVASE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* PORCENTAJE DE MERMA */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
                <label className="text-xs font-mono font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <TrendingDown className="w-4 h-4 text-amber-600" />
                  <span>Porcentaje de Merma (%)</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="50"
                    step="0.5"
                    value={porcentajeMerma}
                    onChange={(e) => setPorcentajeMerma(Math.max(0, Number(e.target.value)))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-sm font-bold text-slate-900 focus:border-amber-500 outline-none"
                  />
                  <span className="font-mono text-xs font-bold text-slate-500">%</span>
                </div>
                <div className="flex gap-1">
                  {[0, 2, 3, 5, 8].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPorcentajeMerma(m)}
                      className={`flex-1 py-1 text-xs font-bold rounded-lg border transition ${
                        porcentajeMerma === m
                          ? 'bg-amber-500 text-white border-amber-600'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {m}%
                    </button>
                  ))}
                </div>
              </div>

              {/* CATEGORÍA DE ENVASE */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
                <label className="text-xs font-mono font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-[#00603C]" />
                  <span>Envase (kg por Bolsa)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { kg: 800, label: '800 kg (Big Bag)' },
                    { kg: 40, label: '40 kg (Bolsa)' },
                    { kg: 25, label: '25 kg' },
                    { kg: 50, label: '50 kg' },
                  ].map((env) => (
                    <button
                      key={env.kg}
                      type="button"
                      onClick={() => setPesoEnvaseKg(env.kg as CategoriaEnvaseKg)}
                      className={`py-2 px-2 text-xs font-bold rounded-xl border transition text-center ${
                        pesoEnvaseKg === env.kg
                          ? 'bg-[#00603C] text-white border-[#00603C] shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {env.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* ================================================================= */}
          {/* COLUMNA DERECHA: RESULTADO EN TIEMPO REAL - BOLSAS (BLS) Y LOTES  */}
          {/* ================================================================= */}
          <div className="lg:col-span-5 space-y-6">

            <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white rounded-3xl p-6 border border-slate-800 shadow-xl space-y-5">
              <div className="border-b border-white/10 pb-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold block">
                    RESULTADO EN TIEMPO REAL
                  </span>
                  <h3 className="font-serif text-xl font-bold mt-0.5 text-white">
                    Cálculo de Bolsas (BLS)
                  </h3>
                </div>
                <div className="p-2 bg-amber-400/20 rounded-xl text-amber-300">
                  <Calculator className="w-6 h-6" />
                </div>
              </div>

              {/* Resumen de Kilos Brutos, Merma y Netos */}
              <div className="space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between text-slate-300 py-1 border-b border-white/5">
                  <span>Kilos Brutos:</span>
                  <span className="font-bold text-white">{formatKg(totalKilosBrutos)} kg</span>
                </div>
                <div className="flex items-center justify-between text-amber-300 py-1 border-b border-white/5">
                  <span>Merma ({porcentajeMerma}%):</span>
                  <span className="font-bold">-{formatKg(calculoResultado.kilosMermaKg)} kg</span>
                </div>
                <div className="flex items-center justify-between py-2 bg-emerald-950/80 px-3.5 rounded-xl border border-emerald-600/40 text-emerald-300">
                  <span className="font-bold uppercase tracking-wider text-xs text-white">
                    Kilos Netos a Procesar:
                  </span>
                  <span className="font-black text-lg text-amber-300">
                    {formatKg(calculoResultado.kilosNetosKg)} kg
                  </span>
                </div>
              </div>

              {/* Indicadores Principales: Bolsas (BLS) y Lotes */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                {/* Bolsas (BLS) Calculadas */}
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 text-center">
                  <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider block font-bold">
                    Bolsas (BLS)
                  </span>
                  <div className="font-serif text-3xl font-black text-white mt-1">
                    {calculoResultado.cantidadBolsasEnteras}
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 mt-1 block">
                    {calculoResultado.cantidadBolsasDecimal.toFixed(2)} BLS exactas
                  </span>
                </div>

                {/* Lotes Resultantes */}
                <div className="bg-amber-400/10 p-4 rounded-2xl border border-amber-400/30 text-center">
                  <span className="text-[10px] font-mono uppercase text-amber-300 tracking-wider block font-bold">
                    Lotes Resultantes
                  </span>
                  <div className="font-serif text-3xl font-black text-amber-400 mt-1">
                    {cargarConDecimal && calculoResultado.excedeLoteNatural
                      ? calculoResultado.cantidadLotes1Decimal
                      : Math.max(1, calculoResultado.cantidadLotesEnteros)}
                  </div>
                  <span className="text-[10px] font-mono text-amber-200 mt-1 block">
                    {calculoResultado.desgloseLotes.length} lote(s) en desglose
                  </span>
                </div>
              </div>

              {/* Desglose de Lotes */}
              <div className="bg-black/30 p-4 rounded-2xl border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-300">
                  <span>Desglose por Lote:</span>
                  <span className="text-amber-400 text-[11px]">
                    35 Bolsas ({pesoEnvaseKg} kg) = 1 Lote
                  </span>
                </div>
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {calculoResultado.desgloseLotes.map((lote) => (
                    <div
                      key={lote.nroLote}
                      className="flex items-center justify-between text-xs p-2 rounded-lg bg-white/5 border border-white/5"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[10px] font-bold">
                          #{lote.nroLote}
                        </span>
                        <span className="text-slate-200 font-medium">
                          {lote.esLoteCompleto ? 'Lote Completo' : 'Lote Fraccionario'}
                        </span>
                      </div>
                      <div className="text-right font-mono text-xs">
                        <span className="font-bold text-white">{lote.bolsas} BLS</span>
                        <span className="text-slate-400 text-[10px] ml-1.5">
                          ({formatKg(lote.totalKg)})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Botón de Transferencia a Precarga (si está disponible) */}
              {onAplicarAPrecarga && (
                <button
                  type="button"
                  id="btn-aplicar-calculo-precarga"
                  onClick={handleTransferirAPrecarga}
                  disabled={calculoResultado.kilosNetosKg <= 0}
                  className="w-full py-3.5 bg-[#00603C] hover:bg-[#00784b] text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg transition flex items-center justify-center gap-2.5 cursor-pointer border border-emerald-400/30 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                  <CheckCircle2 className="w-5 h-5 text-amber-300" />
                  <span>
                    {cargarConDecimal && calculoResultado.excedeLoteNatural
                      ? `Aplicar ${calculoResultado.cantidadLotes1Decimal} Lote(s) a Precarga`
                      : `Aplicar ${Math.max(1, calculoResultado.cantidadLotesEnteros)} Lote(s) Entero(s) a Precarga`}
                  </span>
                  <ArrowRight className="w-4 h-4 text-amber-300" />
                </button>
              )}
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
