/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CorrelatividadClienteInfo } from '../utils/loteCorrelativo';
import {
  Hash,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Building2,
  CheckCircle2,
  Info,
} from 'lucide-react';

interface VisorCorrelatividadLoteProps {
  info: CorrelatividadClienteInfo;
  cantidadLotesEnTanda?: number;
  onSincronizarDrafts?: () => void;
  className?: string;
}

export const VisorCorrelatividadLote: React.FC<VisorCorrelatividadLoteProps> = ({
  info,
  cantidadLotesEnTanda = 1,
  onSincronizarDrafts,
  className = '',
}) => {
  const {
    cliente,
    prefijo,
    totalLotesCliente,
    loteMasAltoNro,
    numeroMasAlto,
    proximoNumero,
    proximoLoteNro,
  } = info;

  // Rango de lotes en precarga si hay más de uno en la tanda
  const rangoPrecargaStr =
    cantidadLotesEnTanda > 1
      ? `${proximoLoteNro} → ${prefijo}${
          proximoNumero + cantidadLotesEnTanda - 1 < 10
            ? '0' + (proximoNumero + cantidadLotesEnTanda - 1)
            : proximoNumero + cantidadLotesEnTanda - 1
        } (${cantidadLotesEnTanda} lotes)`
      : proximoLoteNro;

  return (
    <div
      id="visor-correlatividad-cliente"
      className={`bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white rounded-2xl p-4 sm:p-5 border border-emerald-500/30 shadow-md ${className}`}
    >
      {/* Encabezado del Visor */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center border border-amber-400/30 shrink-0">
            <Hash className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold tracking-wider text-amber-300 uppercase bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">
                Visor de Correlatividad
              </span>
              <span className="text-[10px] text-slate-300 flex items-center gap-1 font-mono">
                <Info className="w-3 h-3 text-emerald-400" /> Criterio: Mayor número asignado (no fecha)
              </span>
            </div>
            <h4 className="text-sm sm:text-base font-bold text-white mt-0.5">
              Correlatividad de Lotes: <span className="text-amber-300 font-mono">{cliente || 'Sin cliente'}</span>
            </h4>
          </div>
        </div>

        {onSincronizarDrafts && (
          <button
            type="button"
            onClick={onSincronizarDrafts}
            title="Reasignar números correlativos automáticos a todos los lotes de la tanda según este cliente"
            className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 bg-emerald-800/80 hover:bg-emerald-700 text-white text-xs font-mono font-bold rounded-xl border border-emerald-400/30 transition cursor-pointer active:scale-95 shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-300" />
            <span>Sincronizar N° a la tanda</span>
          </button>
        )}
      </div>

      {/* Tarjetas Informativas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
        {/* 1. Cliente & Iniciales */}
        <div className="bg-black/30 border border-white/5 rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-emerald-400" /> Cliente Activo
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {totalLotesCliente} lote{totalLotesCliente !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-sm font-bold text-white truncate max-w-[140px] sm:max-w-[120px]" title={cliente}>
              {cliente}
            </span>
            <span className="text-xs font-mono font-black text-amber-300 bg-amber-950/60 border border-amber-500/40 px-2 py-0.5 rounded-md">
              Prefijo: {prefijo}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 font-sans">
            Iniciales automáticas calculadas para el cliente.
          </p>
        </div>

        {/* 2. Último Lote Creado (Mayor Número) */}
        <div className="bg-black/30 border border-white/5 rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="flex items-center gap-1 text-slate-300 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Lote Creado más Alto
            </span>
            <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-500/30">
              {numeroMasAlto > 0 ? `#${numeroMasAlto}` : 'Sin previas'}
            </span>
          </div>
          <div className="mt-1">
            <span className="text-lg sm:text-xl font-mono font-black text-amber-300 tracking-wider">
              {loteMasAltoNro || 'Ninguno'}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">
            {numeroMasAlto > 0
              ? `Lote con el número más alto registrado para ${cliente}.`
              : 'Primer lote a registrar para este cliente.'}
          </p>
        </div>

        {/* 3. Próximo Lote en Precarga */}
        <div className="bg-gradient-to-br from-emerald-950/90 to-emerald-900/60 border border-emerald-400/40 rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-emerald-200 mb-1">
            <span className="flex items-center gap-1 font-bold text-emerald-300">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Próximo Lote Precarga
            </span>
            <span className="text-[10px] font-mono font-bold text-amber-300 bg-amber-900/60 px-1.5 py-0.5 rounded border border-amber-400/30">
              +{cantidadLotesEnTanda} Consecutivo
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-amber-300 shrink-0 hidden sm:inline" />
            <span className="text-lg sm:text-xl font-mono font-black text-white tracking-wider">
              {rangoPrecargaStr}
            </span>
          </div>
          <p className="text-[10px] text-emerald-100/80 mt-2 font-sans">
            Siguiente consecutivo asignado automáticamente por defecto.
          </p>
        </div>
      </div>
    </div>
  );
};
