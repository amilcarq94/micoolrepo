/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { SiloId, EstadoSiloManual } from '../types';
import { formatNumberArg } from '../utils/formatters';
import { Warehouse, Clock, FileText } from 'lucide-react';

interface CircularSiloCardProps {
  siloId: SiloId;
  isSelected: boolean;
  stockKg: number;
  stockTn: string | number;
  variedad?: string;
  cliente?: string;
  humedad?: number | string;
  estadoManual: EstadoSiloManual;
  compact?: boolean;
  onSelect: () => void;
  onUpdateEstado?: (nuevoEstado: EstadoSiloManual) => void;
  onVerHistorial?: () => void;
  onVerFicha?: () => void;
}

export const CircularSiloCard: React.FC<CircularSiloCardProps> = ({
  siloId,
  isSelected,
  stockKg,
  stockTn,
  variedad,
  cliente,
  humedad,
  estadoManual,
  compact = false,
  onSelect,
  onUpdateEstado,
  onVerHistorial,
  onVerFicha
}) => {
  // Capacidad oficial de los 6 silos: 180 tn (180.000 kg)
  const CAPACIDAD_MAX_TN = 180;
  const CAPACIDAD_MAX_KG = 180000;
  const porcentajeLlenado = Math.min(100, Math.max(0, (stockKg / CAPACIDAD_MAX_KG) * 100));

  // Geometría del medidor circular (modo normal ampliado vs modo compacto para planta móvil)
  const viewBoxSize = compact ? 280 : 400;
  const center = viewBoxSize / 2; // 140 o 200
  const strokeWidth = compact ? 9 : 13;
  const radius = compact ? 130 : 186;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference - (porcentajeLlenado / 100) * circumference;

  // Label del estado
  const getEstadoLabel = () => {
    switch (estadoManual) {
      case 'OCUPADO':
        return 'SILO OCUPADO';
      case 'VACIO_SUCIO':
        return 'SILO VACÍO SUCIO';
      case 'VACIO_LIMPIO':
      default:
        return 'SILO VACÍO LIMPIO';
    }
  };

  return (
    <div className="flex flex-col items-center select-none" id={`contenedor-silo-${siloId.toLowerCase().replace(/\s+/g, '-')}`}>
      {/* 1. Header Centrado y Unificado: Nombre del Silo + Indicador de Estado */}
      <div className={`flex items-center justify-center w-full ${compact ? 'mb-1.5' : 'mb-3'}`}>
        <div
          onClick={onSelect}
          id={`header-silo-${siloId.toLowerCase().replace(/\s+/g, '-')}`}
          className={`rounded-xl flex items-center justify-center gap-2 border transition-all duration-200 cursor-pointer shadow-xs ${
            compact ? 'px-3 py-1 text-[10px]' : 'px-4 py-1.5 text-xs'
          } ${
            isSelected
              ? 'bg-slate-800 text-emerald-400 border-2 border-emerald-500 ring-2 ring-emerald-500/20 shadow-md'
              : estadoManual === 'OCUPADO'
              ? 'bg-amber-50 text-slate-800 border-amber-300 hover:border-amber-400'
              : estadoManual === 'VACIO_SUCIO'
              ? 'bg-rose-50 text-slate-800 border-rose-300 hover:border-rose-400'
              : 'bg-emerald-50 text-slate-800 border-emerald-300 hover:border-emerald-400'
          }`}
        >
          <Warehouse
            className={`shrink-0 ${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} ${
              isSelected
                ? 'text-emerald-400'
                : estadoManual === 'OCUPADO'
                ? 'text-amber-600'
                : estadoManual === 'VACIO_SUCIO'
                ? 'text-rose-600'
                : 'text-[#00603C]'
            }`}
          />
          <span className="font-mono font-black uppercase tracking-wider">
            {siloId.toUpperCase()}
          </span>

          <span className={`${isSelected ? 'text-slate-500' : 'text-slate-300'} font-bold`}>•</span>

          <span
            className={`rounded-full shrink-0 ${compact ? 'w-1.5 h-1.5' : 'w-2 h-2'} ${
              estadoManual === 'OCUPADO'
                ? 'bg-amber-500 animate-pulse'
                : estadoManual === 'VACIO_SUCIO'
                ? 'bg-rose-500'
                : 'bg-emerald-500'
            }`}
          />
          <span
            className={`font-mono font-black uppercase tracking-wider ${compact ? 'text-[9.5px]' : 'text-[11px]'} ${
              isSelected
                ? estadoManual === 'OCUPADO'
                  ? 'text-amber-400'
                  : estadoManual === 'VACIO_SUCIO'
                  ? 'text-rose-400'
                  : 'text-emerald-400'
                : estadoManual === 'OCUPADO'
                ? 'text-amber-800'
                : estadoManual === 'VACIO_SUCIO'
                ? 'text-rose-800'
                : 'text-emerald-800'
            }`}
          >
            {getEstadoLabel()}
          </span>

          {isSelected && (
            <span className="bg-emerald-500 text-slate-950 text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded tracking-wider shadow-xs ml-0.5">
              ACTIVO
            </span>
          )}
        </div>
      </div>

      {/* 2. Cuerpo Circular del Silo Ampliado con Contorno Medidor de Llenado Circular Verde (180 Tn) */}
      <div className={`relative flex items-center justify-center ${
        compact 
          ? 'w-[230px] h-[230px] sm:w-[255px] sm:h-[255px]' 
          : 'w-[340px] h-[340px] sm:w-[390px] sm:h-[390px]'
      }`}>
        {/* Anillo de Contorno Circular: Medidor de Llenado con Línea Verde (Capacidad 180 Tn) */}
        <svg
          className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none z-10"
          viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
        >
          {/* Carril de base del contorno circular */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={isSelected ? '#334155' : '#E2E8F0'}
            strokeWidth={strokeWidth}
          />

          {/* Línea verde como indicador de llenado circular (Capacidad 180 Tn) */}
          {porcentajeLlenado > 0 && (
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={isSelected ? '#22C55E' : '#16A34A'}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeOffset}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out drop-shadow-[0_0_8px_rgba(34,197,94,0.4)]"
            />
          )}

          {/* Marcas de referencia de capacidad (0 Tn, 45 Tn, 90 Tn, 135 Tn) */}
          {[0, 0.25, 0.5, 0.75].map((pct, idx) => {
            const angle = pct * 2 * Math.PI;
            const markerX = center + (radius) * Math.cos(angle);
            const markerY = center + (radius) * Math.sin(angle);
            return (
              <circle
                key={idx}
                cx={markerX}
                cy={markerY}
                r={compact ? '2' : '2.5'}
                fill={isSelected ? '#475569' : '#CBD5E1'}
                opacity={0.8}
              />
            );
          })}
        </svg>

        {/* Disco interior interactivo del Silo: Fondo Gris Oscuro cuando está seleccionado */}
        <div
          onClick={onSelect}
          className={`relative rounded-full flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 z-20 ${
            compact ? 'w-[calc(100%-20px)] h-[calc(100%-20px)] p-3' : 'w-[calc(100%-28px)] h-[calc(100%-28px)] p-5'
          } ${
            isSelected
              ? 'bg-slate-800 text-white ring-2 ring-emerald-500/50 shadow-[0_12px_40px_rgba(0,0,0,0.45)] scale-[1.01]'
              : 'bg-white text-slate-800 border-2 border-slate-200/90 hover:border-slate-300 hover:shadow-lg hover:scale-[1.01]'
          }`}
        >
          {/* Indicador de capacidad y llenado */}
          <div className="flex items-center gap-1.5 mb-1">
            <span
              className={`font-mono font-black px-2 py-0.5 rounded-full border shadow-2xs ${
                compact ? 'text-[8.5px]' : 'text-[10px]'
              } ${
                isSelected
                  ? 'bg-slate-900/90 text-emerald-400 border-emerald-500/50'
                  : 'bg-emerald-50 text-emerald-900 border-emerald-200'
              }`}
            >
              {porcentajeLlenado.toFixed(1)}% ({stockTn} / 180 Tn)
            </span>
          </div>

          {/* KILOS NETOS */}
          <span
            className={`font-mono uppercase tracking-widest font-black ${
              compact ? 'text-[8.5px]' : 'text-[10.5px]'
            } ${
              isSelected ? 'text-emerald-400' : 'text-slate-500'
            }`}
          >
            KILOS NETOS
          </span>

          {/* NÚMERO PRINCIPAL */}
          <div className="flex items-baseline justify-center gap-1 my-0.5">
            <span
              className={`font-mono font-black tracking-tight leading-none ${
                compact ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-[42px]'
              } ${
                isSelected ? 'text-white drop-shadow-xs' : 'text-slate-950'
              }`}
            >
              {formatNumberArg(stockKg)}
            </span>
            <span
              className={`font-mono font-black ${compact ? 'text-xs' : 'text-base'} ${
                isSelected ? 'text-emerald-400' : 'text-[#00603C]'
              }`}
            >
              kg
            </span>
          </div>

          {/* TONELADAS NETAS */}
          <span
            className={`font-mono font-bold ${compact ? 'text-[10px]' : 'text-xs'} ${
              isSelected ? 'text-slate-300' : 'text-slate-600'
            }`}
          >
            {stockTn} Tn netas
          </span>

          {/* VARIEDAD */}
          <div className={`w-full ${compact ? 'mt-1 max-w-[170px]' : 'mt-2 max-w-[210px]'}`}>
            <span
              className={`font-mono uppercase tracking-wider font-black block ${
                compact ? 'text-[8px] mb-0' : 'text-[9.5px] mb-0.5'
              } ${
                isSelected ? 'text-amber-400' : 'text-amber-700'
              }`}
            >
              VARIEDAD
            </span>
            <div
              className={`rounded-md font-black tracking-wide truncate border ${
                compact ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'
              } ${
                isSelected
                  ? 'bg-slate-900/90 text-amber-300 border-amber-400/40 shadow-inner'
                  : 'bg-slate-100 text-slate-800 border-slate-200'
              }`}
            >
              {variedad && variedad !== '-' && variedad !== 'Sin variedad'
                ? variedad
                : 'SIN ASIGNAR'}
            </div>
          </div>

          {/* CLIENTE */}
          <div className={`w-full ${compact ? 'mt-1 max-w-[170px]' : 'mt-1.5 max-w-[210px]'}`}>
            <span
              className={`font-mono uppercase tracking-wider font-bold block ${
                compact ? 'text-[8px]' : 'text-[9.5px]'
              } ${
                isSelected ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              CLIENTE
            </span>
            <span
              className={`font-bold block truncate mt-0.5 ${
                compact ? 'text-[10.5px]' : 'text-xs sm:text-[13px]'
              } ${
                isSelected ? 'text-white font-black' : 'text-slate-900 font-black'
              }`}
            >
              {cliente && cliente !== 'Sin asignación' && cliente !== 'Sin asignar'
                ? cliente
                : 'SIN ASIGNAR'}
            </span>
          </div>

          {/* SELECTOR DE ESTADO: OCUPADO, V. SUCIO, V. LIMPIO */}
          <div
            className={`flex items-center gap-1 ${compact ? 'mt-1.5' : 'mt-2.5'}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ocupado */}
            <button
              type="button"
              onClick={() => onUpdateEstado?.('OCUPADO')}
              className={`rounded-full font-bold flex items-center gap-1 transition cursor-pointer ${
                compact ? 'px-2 py-0.5 text-[8.5px]' : 'px-2.5 py-0.5 text-[10px]'
              } ${
                estadoManual === 'OCUPADO'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-xs ring-1 ring-amber-400'
                  : isSelected
                  ? 'bg-slate-700/80 text-slate-300 border border-slate-600 hover:bg-slate-700 hover:text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              title="Marcar como Ocupado"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  estadoManual === 'OCUPADO' ? 'bg-slate-950' : 'bg-amber-500'
                }`}
              />
              <span>Ocupado</span>
            </button>

            {/* V. Sucio */}
            <button
              type="button"
              onClick={() => onUpdateEstado?.('VACIO_SUCIO')}
              className={`rounded-full font-bold flex items-center gap-1 transition cursor-pointer ${
                compact ? 'px-2 py-0.5 text-[8.5px]' : 'px-2.5 py-0.5 text-[10px]'
              } ${
                estadoManual === 'VACIO_SUCIO'
                  ? 'bg-rose-500 text-white font-black shadow-xs ring-1 ring-rose-400'
                  : isSelected
                  ? 'bg-slate-700/80 text-slate-300 border border-slate-600 hover:bg-slate-700 hover:text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              title="Marcar como Vacío Sucio"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  estadoManual === 'VACIO_SUCIO' ? 'bg-white' : 'bg-rose-500'
                }`}
              />
              <span>V. Sucio</span>
            </button>

            {/* V. Limpio */}
            <button
              type="button"
              onClick={() => onUpdateEstado?.('VACIO_LIMPIO')}
              className={`rounded-full font-bold flex items-center gap-1 transition cursor-pointer ${
                compact ? 'px-2 py-0.5 text-[8.5px]' : 'px-2.5 py-0.5 text-[10px]'
              } ${
                estadoManual === 'VACIO_LIMPIO'
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-xs ring-1 ring-emerald-400'
                  : isSelected
                  ? 'bg-slate-700/80 text-slate-300 border border-slate-600 hover:bg-slate-700 hover:text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              title="Marcar como Vacío Limpio"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  estadoManual === 'VACIO_LIMPIO' ? 'bg-white' : 'bg-emerald-500'
                }`}
              />
              <span>V. Limpio</span>
            </button>
          </div>

          {/* ENLACES HISTORIAL Y FICHA */}
          <div
            className={`flex items-center gap-2 font-mono font-bold ${compact ? 'mt-1 text-[8.5px]' : 'mt-2 text-[10px]'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onVerHistorial}
              className={`hover:underline flex items-center gap-1 cursor-pointer transition ${
                isSelected
                  ? 'text-emerald-400 hover:text-emerald-300 font-bold'
                  : 'text-slate-500 hover:text-[#00603C]'
              }`}
            >
              <Clock className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
              <span>Historial</span>
            </button>
            <span className={isSelected ? 'text-slate-600' : 'text-slate-300'}>•</span>
            <button
              type="button"
              onClick={onVerFicha}
              className={`hover:underline flex items-center gap-1 cursor-pointer transition ${
                isSelected
                  ? 'text-emerald-400 hover:text-emerald-300 font-bold'
                  : 'text-slate-500 hover:text-[#00603C]'
              }`}
            >
              <FileText className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
              <span>Ficha</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
