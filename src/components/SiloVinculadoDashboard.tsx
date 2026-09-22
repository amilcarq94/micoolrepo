/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { SiloId, MovimientoSilo, CAPACIDAD_MAX_SILO, EstadoSiloManual } from '../types';
import { getSiloDetailedInfo } from '../utils/siloValidation';
import { formatKg, formatNumberArg } from '../utils/formatters';
import {
  Warehouse,
  Droplets,
  Building2,
  Tag,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Activity,
  Trash2,
  RotateCcw,
  Pencil
} from 'lucide-react';

interface SiloVinculadoDashboardProps {
  siloId: SiloId;
  movimientosSilo: MovimientoSilo[];
  siloStockReal?: number;
  estadoManual?: EstadoSiloManual;
  onUpdateEstado?: (nuevoEstado: EstadoSiloManual) => void;
  onDescontaminarVarietal?: () => void;
  onVerFichaCompleta?: () => void;
  onEditarMovimiento?: (movimiento: MovimientoSilo) => void;
  onEliminarMovimiento?: (movimiento: MovimientoSilo) => void;
  compactMode?: boolean; // Para vista móvil
}

export const SiloVinculadoDashboard: React.FC<SiloVinculadoDashboardProps> = ({
  siloId,
  movimientosSilo,
  siloStockReal,
  estadoManual = 'VACIO_LIMPIO',
  onUpdateEstado,
  onDescontaminarVarietal,
  onVerFichaCompleta,
  onEditarMovimiento,
  onEliminarMovimiento,
  compactMode = false
}) => {
  // Información detallada calculada
  const info = useMemo(() => {
    const detailed = getSiloDetailedInfo(siloId, movimientosSilo);
    const stockKg = siloStockReal !== undefined ? siloStockReal : detailed.stockKg;
    const pct = Math.min(100, Math.max(0, (stockKg / CAPACIDAD_MAX_SILO) * 100));

    // Último ingreso registrado
    const ingresos = (detailed.ingresosActivos || []).slice().sort(
      (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
    );
    const ultimoIngreso = ingresos.length > 0 ? ingresos[0] : null;

    return {
      ...detailed,
      stockKg,
      stockTn: (stockKg / 1000).toFixed(1),
      pctOcupacionNum: pct,
      pctOcupacionStr: pct.toFixed(1),
      disponibleKg: Math.max(0, CAPACIDAD_MAX_SILO - stockKg),
      disponibleTn: (Math.max(0, CAPACIDAD_MAX_SILO - stockKg) / 1000).toFixed(1),
      ultimoIngreso,
      ingresos
    };
  }, [siloId, movimientosSilo, siloStockReal]);

  const hasStock = info.stockKg > 0;

  return (
    <div
      className="bg-white rounded-3xl border-2 border-[#00603C]/30 shadow-lg overflow-hidden space-y-4 animate-in fade-in duration-200"
      id={`dashboard-vinculado-${siloId.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {/* 1. Header con Silo Seleccionado */}
      <div className="bg-gradient-to-r from-[#003d24] via-[#00603C] to-[#004e2e] text-white p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#C9922E]/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center gap-3 relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-[#C9922E]/40 flex items-center justify-center shrink-0 shadow-inner">
            <Warehouse className="w-6 h-6 text-[#C9922E]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-black uppercase tracking-widest text-[#C9922E] bg-black/30 px-2 py-0.5 rounded border border-[#C9922E]/30">
                Silo Seleccionado
              </span>
              <span className="text-[10px] font-mono text-emerald-300 font-bold bg-white/10 px-2 py-0.5 rounded">
                Capacidad 180 Tn
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black font-sans uppercase tracking-tight text-white mt-0.5">
              {siloId.toUpperCase()}
            </h3>
          </div>
        </div>

        {/* Acciones y Estado */}
        <div className="flex items-center gap-2 relative z-10 flex-wrap">
          {onDescontaminarVarietal && (
            <button
              type="button"
              onClick={onDescontaminarVarietal}
              className="px-3 py-1.5 rounded-xl bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-500/40 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              title="Borrar datos del silo y resetear variedad"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-300" />
              <span>Descontaminación Varietal</span>
            </button>
          )}

          {onVerFichaCompleta && (
            <button
              type="button"
              onClick={onVerFichaCompleta}
              className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/20 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-amber-300" />
              <span>Ver Ficha Técnica</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Cuerpo del Dashboard: Métricas de Stock, Semilla y Kilos de Ingreso */}
      <div className="p-4 sm:p-5 pt-0 space-y-4">
        {/* Tarjetas Principales */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Tarjeta 1: Stock Actual */}
          <div className="bg-[#F8FAF9] p-4 rounded-2xl border border-[#00603C]/20 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
                Stock Actual
              </span>
              <span className="text-xs font-mono font-black text-[#00603C] bg-[#00603C]/10 px-2 py-0.5 rounded-md">
                {info.stockTn} Tn
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-black text-slate-900 tracking-tight">
              {formatKg(info.stockKg)}
            </div>

            {/* Nivel y Capacidad */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-500">Ocupación</span>
                <span className="font-bold text-slate-800">{info.pctOcupacionStr}%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    info.pctOcupacionNum > 90
                      ? 'bg-rose-500'
                      : info.pctOcupacionNum > 0
                      ? 'bg-[#00603C]'
                      : 'bg-slate-300'
                  }`}
                  style={{ width: `${Math.max(hasStock ? 5 : 0, info.pctOcupacionNum)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-0.5">
                <span>Disponible:</span>
                <span className="font-bold text-emerald-800">{formatKg(info.disponibleKg)} ({info.disponibleTn} Tn)</span>
              </div>
            </div>
          </div>

          {/* Tarjeta 2: Semilla Ingresada (Variedad & Cliente) */}
          <div className="bg-[#F8FAF9] p-4 rounded-2xl border border-[#00603C]/20 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
                Semilla Ingresada
              </span>
              {info.humedad && info.humedad !== '0.0' && info.humedad !== '—' && (
                <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Droplets className="w-3 h-3" />
                  {info.humedad}% H₂O
                </span>
              )}
            </div>

            {/* Variedad Destacada */}
            <div>
              <span className="text-[10px] font-mono text-slate-500 block uppercase font-bold">
                Variedad
              </span>
              <div className="text-base font-black text-slate-900 truncate mt-0.5">
                {hasStock && info.variedad && info.variedad !== '-' ? (
                  <span className="inline-block px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 font-sans font-black">
                    {info.variedad}
                  </span>
                ) : (
                  <span className="text-slate-400 font-normal italic">Sin variedad / Vacío</span>
                )}
              </div>
            </div>

            {/* Cliente */}
            <div>
              <span className="text-[10px] font-mono text-slate-500 block uppercase font-bold">
                Cliente
              </span>
              <div className="text-xs font-bold text-slate-800 truncate mt-0.5">
                {hasStock && info.cliente && info.cliente !== 'Sin asignación'
                  ? info.cliente
                  : 'Sin cliente asignado'}
              </div>
            </div>
          </div>

          {/* Tarjeta 3: Kilos de Ingreso */}
          <div className="bg-[#F8FAF9] p-4 rounded-2xl border border-[#00603C]/20 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1">
                <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600" />
                Kilos de Ingreso
              </span>
              <span className="text-xs font-mono font-bold text-slate-700 bg-slate-200/80 px-2 py-0.5 rounded">
                {info.totalIngresos} {info.totalIngresos === 1 ? 'ingreso' : 'ingresos'}
              </span>
            </div>

            {info.ultimoIngreso ? (
              <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 text-xs">
                <div className="flex items-center justify-between font-mono font-bold">
                  <span className="text-[10px] uppercase text-emerald-800">Último Ingreso:</span>
                  <span className="text-emerald-700 font-black text-sm">
                    +{formatKg(info.ultimoIngreso.kg)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-emerald-800/80 mt-1 font-mono">
                  <span>{info.ultimoIngreso.fecha || 'Sin fecha'}</span>
                  <span>{info.ultimoIngreso.humedad ? `${info.ultimoIngreso.humedad}% H₂O` : ''}</span>
                </div>
                {info.ultimoIngreso.chofer && (
                  <div className="text-[10px] text-slate-500 truncate mt-1">
                    Chofer: <strong className="text-slate-700">{info.ultimoIngreso.chofer}</strong>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-100 p-2.5 rounded-xl text-center text-xs text-slate-500">
                Sin ingresos registrados
              </div>
            )}

            <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 pt-1">
              <span>Total Ingresado:</span>
              <strong className="text-slate-900 font-bold">{formatKg(info.totalKgIngresados)}</strong>
            </div>
          </div>
        </div>

        {/* 3. Tabla / Listado de Historial del Silo Seleccionado */}
        <div className="border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between pb-2 mb-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5 font-mono">
              <Clock className="w-4 h-4 text-[#00603C]" />
              Movimientos del Silo {siloId} ({info.movimientos.length})
            </h4>
            <span className="text-[11px] font-mono text-slate-500">
              Egresos: {formatKg(info.totalKgEgresados)}
            </span>
          </div>

          {info.movimientos.length > 0 ? (
            <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-mono text-[10px] uppercase sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Fecha</th>
                    <th className="py-2 px-3">Tipo</th>
                    <th className="py-2 px-3 text-right">Kilos</th>
                    <th className="py-2 px-3">Variedad</th>
                    <th className="py-2 px-3">Cliente</th>
                    <th className="py-2 px-3">Humedad</th>
                    <th className="py-2 px-3">Detalle</th>
                    {(onEditarMovimiento || onEliminarMovimiento) && (
                      <th className="py-2 px-3 text-center">Acciones</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {info.movimientos.map((mov, idx) => {
                    const isIngreso = mov.tipo === 'INGRESO';
                    return (
                      <tr key={mov.id || idx} className="hover:bg-slate-50/80 transition">
                        <td className="py-2 px-3 font-mono text-slate-600">{mov.fecha}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isIngreso
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {isIngreso ? (
                              <ArrowDownRight className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <ArrowUpRight className="w-3 h-3 text-amber-600" />
                            )}
                            {mov.tipo}
                          </span>
                        </td>
                        <td
                          className={`py-2 px-3 font-mono font-bold text-right ${
                            isIngreso ? 'text-emerald-700' : 'text-amber-800'
                          }`}
                        >
                          {isIngreso ? `+${formatKg(mov.kg)}` : `-${formatKg(mov.kg)}`}
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-800">{mov.variedad || '-'}</td>
                        <td className="py-2 px-3 text-slate-700 truncate max-w-[130px]">{mov.cliente || '-'}</td>
                        <td className="py-2 px-3 font-mono text-slate-600">
                          {mov.humedad ? `${mov.humedad}%` : '-'}
                        </td>
                        <td className="py-2 px-3 text-slate-500 truncate max-w-[160px]">
                          {mov.chofer || mov.remito || mov.cartaPorte || '-'}
                        </td>
                        {(onEditarMovimiento || onEliminarMovimiento) && (
                          <td className="py-2 px-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              {onEditarMovimiento && (
                                <button
                                  type="button"
                                  onClick={() => onEditarMovimiento(mov)}
                                  className="p-1 text-slate-400 hover:text-[#00603C] hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                                  title="Editar movimiento de silo"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {onEliminarMovimiento && (
                                <button
                                  type="button"
                                  onClick={() => onEliminarMovimiento(mov)}
                                  className="p-1 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                  title="Eliminar carga de silo"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
              No se registran movimientos históricos para este silo.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
