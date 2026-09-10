/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from 'react';
import {
  SiloId,
  MovimientoSilo,
  CAPACIDAD_MAX_SILO,
  SilosEstadoMap,
  EstadoSiloManual,
  SILOS_ESTADO_DEFAULT
} from '../types';
import { getSiloDetailedInfo } from '../utils/siloValidation';
import { formatKg, formatNumberArg } from '../utils/formatters';
import { CircularSiloCard } from './CircularSiloCard';
import { SiloVinculadoDashboard } from './SiloVinculadoDashboard';
import {
  Warehouse,
  Scale,
  Sparkles,
  Info,
  Clock,
  Layers,
  FileText,
  X,
  ArrowDownRight,
  ArrowUpRight,
  Droplets,
  Calendar,
  Building2,
  CheckCircle2
} from 'lucide-react';

interface VisorSilosPlantaMovilProps {
  siloStocks?: Record<string, number>;
  movimientosSilo: MovimientoSilo[];
  silosEstadoManual?: SilosEstadoMap;
  onUpdateSiloEstadoManual?: (siloId: SiloId, estado: EstadoSiloManual) => void;
  onSelectSilo?: (siloId: SiloId) => void;
}

// Orden físico idéntico a la hoja "silos clasificadora" (Col 1: Silo 4, 5, 6 | Col 2: Silo 3, 2, 1)
const SILOS_ORDEN_CLASIFICADORA: SiloId[] = ['Silo 4', 'Silo 3', 'Silo 5', 'Silo 2', 'Silo 6', 'Silo 1'];

export const VisorSilosPlantaMovil: React.FC<VisorSilosPlantaMovilProps> = ({
  siloStocks = {},
  movimientosSilo = [],
  silosEstadoManual = SILOS_ESTADO_DEFAULT,
  onUpdateSiloEstadoManual,
  onSelectSilo
}) => {
  // Silo seleccionado actualmente para el visor/dashboard vinculado
  const [selectedSilo, setSelectedSilo] = useState<SiloId>('Silo 4');

  // Modales de Ficha e Historial
  const [fichaModalSilo, setFichaModalSilo] = useState<SiloId | null>(null);
  const [historialModalSilo, setHistorialModalSilo] = useState<SiloId | null>(null);

  const dashboardRef = useRef<HTMLDivElement>(null);

  // Manejar selección de silo con scroll suave hacia el dashboard vinculado si es necesario
  const handleSelectSilo = (siloId: SiloId) => {
    setSelectedSilo(siloId);
    onSelectSilo?.(siloId);
  };

  // Información agregada de los 6 silos en el orden físico de la clasificadora
  const silosData = useMemo(() => {
    return SILOS_ORDEN_CLASIFICADORA.map((sId) => {
      const info = getSiloDetailedInfo(sId, movimientosSilo);
      const estadoManual = silosEstadoManual?.[sId] || (info.stockKg > 0 ? 'OCUPADO' : 'VACIO_LIMPIO');
      const stockReal = siloStocks[sId] !== undefined ? siloStocks[sId] : info.stockKg;
      const stockTn = (stockReal / 1000).toFixed(1);

      return {
        siloId: sId,
        stockKg: stockReal,
        stockTn,
        variedad: info.variedad,
        cliente: info.cliente,
        humedad: info.humedad,
        estadoManual,
        info
      };
    });
  }, [movimientosSilo, silosEstadoManual, siloStocks]);

  // Métricas consolidadas de planta
  const metricasGlobales = useMemo(() => {
    let totalKg = 0;
    let ocupados = 0;
    let vacios = 0;
    const variedades = new Set<string>();
    const clientes = new Set<string>();

    silosData.forEach((s) => {
      totalKg += s.stockKg;
      if (s.stockKg > 0 || s.estadoManual === 'OCUPADO') {
        ocupados++;
        if (s.variedad && s.variedad !== '-' && s.variedad !== 'Sin variedad') {
          variedades.add(s.variedad);
        }
        if (s.cliente && s.cliente !== 'Sin asignación' && s.cliente !== 'Sin asignar') {
          clientes.add(s.cliente);
        }
      } else {
        vacios++;
      }
    });

    return {
      totalKg,
      totalTn: (totalKg / 1000).toFixed(1),
      ocupados,
      vacios,
      variedadesCount: variedades.size,
      clientesCount: clientes.size
    };
  }, [silosData]);

  // Silo activo para modales
  const modalInfo = useMemo(() => {
    const target = fichaModalSilo || historialModalSilo;
    if (!target) return null;
    return silosData.find((s) => s.siloId === target) || null;
  }, [fichaModalSilo, historialModalSilo, silosData]);

  return (
    <div className="space-y-6" id="visor-silos-planta-movil-container">
      {/* ========================================================================= */}
      {/* 1. HEADER: CENTRO DE INFORMACIÓN PLANTA MÓVIL                             */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-br from-[#003d24] via-[#00603C] to-[#004e2e] text-white p-4 sm:p-5 rounded-3xl shadow-lg border-2 border-[#C9922E]/40 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-44 h-44 bg-[#C9922E]/15 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-[#C9922E]/40 flex items-center justify-center shrink-0 shadow-inner">
              <Warehouse className="w-6 h-6 text-[#C9922E]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono tracking-widest text-[#C9922E] uppercase font-bold px-2 py-0.5 rounded-md bg-black/30 border border-[#C9922E]/30">
                  Centro de Información Planta Móvil
                </span>
                <span className="text-[10px] font-mono text-emerald-300 font-bold">
                  Orden Ascendente (1 al 6)
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black font-sans uppercase tracking-tight text-white mt-0.5">
                Visor de Silos
              </h2>
            </div>
          </div>

          {/* Métricas Globales Resumidas */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="bg-black/30 border border-white/10 rounded-2xl px-3.5 py-2 text-right">
              <span className="text-[9px] font-mono text-emerald-300 uppercase block font-bold">
                Stock Total Planta
              </span>
              <span className="font-mono text-base sm:text-lg font-black text-amber-300">
                {formatKg(metricasGlobales.totalKg)} <span className="text-xs font-normal text-white">kg</span>
              </span>
              <span className="text-[10px] font-mono text-slate-300 block">
                ({metricasGlobales.totalTn} Tn)
              </span>
            </div>

            <div className="bg-black/30 border border-white/10 rounded-2xl px-3 py-2 text-center">
              <span className="text-[9px] font-mono text-slate-300 uppercase block font-bold">
                Ocupados / Vacíos
              </span>
              <span className="font-mono text-sm font-black text-white">
                <span className="text-emerald-400">{metricasGlobales.ocupados}</span> / <span className="text-slate-400">{metricasGlobales.vacios}</span>
              </span>
              <span className="text-[9px] font-mono text-amber-300 block">
                {metricasGlobales.variedadesCount} var. activas
              </span>
            </div>
          </div>
        </div>

        {/* Selector Rápido de Silo (Pill Bar con orden físico de clasificadora) */}
        <div className="mt-4 pt-3 border-t border-white/15 flex items-center gap-1.5 overflow-x-auto pb-1">
          <span className="text-[10px] font-mono text-slate-300 uppercase font-bold shrink-0 mr-1">
            Seleccionar:
          </span>
          {SILOS_ORDEN_CLASIFICADORA.map((sId) => {
            const isActivo = selectedSilo === sId;
            return (
              <button
                key={sId}
                type="button"
                onClick={() => handleSelectSilo(sId)}
                className={`px-3 py-1 rounded-xl text-xs font-mono font-bold transition shrink-0 cursor-pointer flex items-center gap-1.5 ${
                  isActivo
                    ? 'bg-amber-400 text-slate-950 shadow-xs ring-2 ring-amber-300 scale-105'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                <span>{sId}</span>
                {isActivo && <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. GRILLA DE SILOS CIRCULARES COMPACTOS (ORDEN SILOS CLASIFICADORA)        */}
      {/* ========================================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#00603C]" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 font-mono">
              Disposición Física de Silos (Orden Silos Clasificadora)
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-500 font-bold">
            Silo Activo: <strong className="text-[#00603C]">{selectedSilo}</strong>
          </span>
        </div>

        {/* Grilla compacta de 2 Columnas idéntica a la hoja Silos Clasificadora (Col 1: Silo 4, 5, 6 | Col 2: Silo 3, 2, 1) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 justify-items-center py-2 max-w-4xl mx-auto">
          {silosData.map((silo) => (
            <CircularSiloCard
              key={silo.siloId}
              siloId={silo.siloId}
              isSelected={selectedSilo === silo.siloId}
              stockKg={silo.stockKg}
              stockTn={silo.stockTn}
              variedad={silo.variedad}
              cliente={silo.cliente}
              humedad={silo.humedad}
              estadoManual={silo.estadoManual}
              compact={true}
              onSelect={() => handleSelectSilo(silo.siloId)}
              onUpdateEstado={(nuevoEstado) =>
                onUpdateSiloEstadoManual?.(silo.siloId, nuevoEstado)
              }
              onVerHistorial={() => setHistorialModalSilo(silo.siloId)}
              onVerFicha={() => setFichaModalSilo(silo.siloId)}
            />
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. VISOR O DASHBOARD VINCULADO DEL SILO SELECCIONADO                      */}
      {/* ========================================================================= */}
      <div ref={dashboardRef} className="pt-2">
        <SiloVinculadoDashboard
          siloId={selectedSilo}
          movimientosSilo={movimientosSilo}
          siloStockReal={siloStocks[selectedSilo]}
          estadoManual={silosEstadoManual[selectedSilo]}
          onUpdateEstado={(nuevo) => onUpdateSiloEstadoManual?.(selectedSilo, nuevo)}
          onVerFichaCompleta={() => setFichaModalSilo(selectedSilo)}
          compactMode={true}
        />
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: FICHA TÉCNICA DETALLADA DEL SILO                                 */}
      {/* ========================================================================= */}
      {fichaModalSilo && modalInfo && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 animate-in fade-in backdrop-blur-xs"
          onClick={() => setFichaModalSilo(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="bg-gradient-to-r from-[#003d24] to-[#00603C] text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Warehouse className="w-5 h-5 text-[#C9922E]" />
                </div>
                <div>
                  <h3 className="font-serif font-black text-xl text-white">
                    Ficha Técnica · {modalInfo.siloId}
                  </h3>
                  <p className="text-xs text-emerald-200 font-mono">
                    Capacidad Máxima: {formatKg(CAPACIDAD_MAX_SILO)} kg (180 Tn)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFichaModalSilo(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido Modal */}
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-mono text-slate-500 block font-bold">
                    Stock Actual
                  </span>
                  <span className="font-mono text-lg font-black text-slate-900">
                    {formatKg(modalInfo.stockKg)} kg
                  </span>
                  <span className="text-xs font-mono text-[#00603C] font-bold block">
                    {modalInfo.stockTn} Tn netas
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-mono text-slate-500 block font-bold">
                    Estado Actual
                  </span>
                  <span className="inline-block mt-1 px-2.5 py-1 rounded-md text-xs font-black uppercase font-mono bg-emerald-100 text-emerald-900 border border-emerald-300">
                    {modalInfo.estadoManual}
                  </span>
                </div>
              </div>

              {/* Variedad y Cliente */}
              <div className="p-3.5 bg-[#F8FAF9] rounded-2xl border border-emerald-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-bold">Variedad:</span>
                  <strong className="text-sm font-black text-slate-900">
                    {modalInfo.variedad || 'Sin variedad asignada'}
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-bold">Cliente:</span>
                  <strong className="text-sm font-bold text-slate-800">
                    {modalInfo.cliente || 'Sin cliente asignado'}
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-bold">Humedad Registrada:</span>
                  <strong className="text-xs font-mono font-black text-blue-700">
                    {modalInfo.humedad ? `${modalInfo.humedad}% H₂O` : '—'}
                  </strong>
                </div>
              </div>

              {/* Botón cerrar */}
              <button
                type="button"
                onClick={() => setFichaModalSilo(null)}
                className="w-full py-2.5 bg-[#00603C] hover:bg-[#004e2e] text-white rounded-xl text-xs font-bold font-mono transition cursor-pointer"
              >
                Cerrar Ficha
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: HISTORIAL DE INGRESOS Y MOVIMIENTOS DEL SILO                     */}
      {/* ========================================================================= */}
      {historialModalSilo && modalInfo && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 animate-in fade-in backdrop-blur-xs"
          onClick={() => setHistorialModalSilo(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="font-serif font-black text-xl text-white">
                    Historial · {modalInfo.siloId}
                  </h3>
                  <p className="text-xs text-slate-300 font-mono">
                    Todos los ingresos y egresos registrados
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHistorialModalSilo(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Listado */}
            <div className="p-5 space-y-3 max-h-[75vh] overflow-y-auto">
              {modalInfo.info.movimientos.length > 0 ? (
                <div className="space-y-2">
                  {modalInfo.info.movimientos.map((mov, idx) => {
                    const isIngreso = mov.tipo === 'INGRESO';
                    return (
                      <div
                        key={mov.id || idx}
                        className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center justify-between gap-2"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isIngreso
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {mov.tipo}
                            </span>
                            <span className="font-mono text-slate-500 text-[10px]">{mov.fecha}</span>
                          </div>
                          <div className="text-slate-800 font-bold">
                            {mov.variedad || 'Sin variedad'} · {mov.cliente || 'Sin cliente'}
                          </div>
                          {mov.chofer && (
                            <div className="text-[10px] text-slate-500">Chofer: {mov.chofer}</div>
                          )}
                        </div>
                        <div
                          className={`font-mono text-sm font-black text-right ${
                            isIngreso ? 'text-emerald-700' : 'text-amber-800'
                          }`}
                        >
                          {isIngreso ? `+${formatKg(mov.kg)}` : `-${formatKg(mov.kg)}`}
                          <span className="text-[10px] font-normal block text-slate-500">
                            {(mov.kg / 1000).toFixed(1)} Tn
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl">
                  No hay movimientos registrados para este silo.
                </div>
              )}

              <button
                type="button"
                onClick={() => setHistorialModalSilo(null)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold font-mono transition cursor-pointer mt-3"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
