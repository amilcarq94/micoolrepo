/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Calendar, Pin, ChevronDown, Check, Info, RefreshCw, Filter } from 'lucide-react';
import {
  CAMPAANIAS_PRECARGADAS,
  getCampaniaIdFromDate,
  getNombreCampania,
  getCampaniasDisponibles,
  Campania
} from '../utils/campanias';

interface CampaniaSelectorProps {
  activeCampaniaId: string;
  onSelectCampania: (campaniaId: string) => void;
  isExplicitlyPinned: boolean;
  onPinCampania: (campaniaId: string) => void;
  availableCampaniasIds?: string[];
  fullWidth?: boolean;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

export const CampaniaSelector: React.FC<CampaniaSelectorProps> = ({
  activeCampaniaId,
  onSelectCampania,
  isExplicitlyPinned,
  onPinCampania,
  availableCampaniasIds = [],
  fullWidth = true,
  align = 'left',
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const suggestedId = getCampaniaIdFromDate(new Date());
  const campanias = getCampaniasDisponibles(availableCampaniasIds);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChoose = (id: string) => {
    onSelectCampania(id);
    onPinCampania(id);
    setIsOpen(false);
  };

  const isCurrentSuggested = activeCampaniaId === suggestedId && !isExplicitlyPinned;

  return (
    <div className={`relative ${fullWidth ? 'w-full' : 'inline-block'} text-left ${className}`} ref={dropdownRef}>
      {/* Botón Principal siempre visible */}
      <button
        id="btn-fijar-campania"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs font-semibold font-sans transition-all duration-200 cursor-pointer ${
          fullWidth ? 'w-full' : ''
        } ${
          isExplicitlyPinned
            ? 'bg-[#00603C] text-white border-[#C9922E] shadow-sm hover:bg-[#004d30]'
            : isCurrentSuggested
            ? 'bg-[#F6EFDC] text-[#00603C] border-[#C9922E]/80 hover:bg-[#EFE6CE]'
            : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
        }`}
        title="Haz clic para seleccionar o fijar la campaña activa"
      >
        <div className="flex items-center gap-2 truncate">
          <Calendar className="w-3.5 h-3.5 text-[#C9922E] shrink-0" />
          <span className="truncate flex items-center gap-1.5">
            <span className="font-bold truncate">
              {activeCampaniaId === 'TODAS' ? 'Todas' : activeCampaniaId}
            </span>
            {isExplicitlyPinned ? (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-[#C9922E] text-white text-[9px] font-bold shrink-0">
                <Pin className="w-2.5 h-2.5" /> Fijada
              </span>
            ) : isCurrentSuggested ? (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[9px] font-medium border border-amber-300 shrink-0">
                Sugerida
              </span>
            ) : null}
          </span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Menú Desplegable Adaptativo */}
      {isOpen && (
        <div
          className={`absolute mt-1.5 rounded-xl bg-white shadow-2xl ring-1 ring-black/10 z-50 overflow-hidden border border-gray-200 ${
            fullWidth
              ? 'left-0 right-0 w-full min-w-[230px]'
              : align === 'right'
              ? 'right-0 w-72 max-w-[calc(100vw-24px)]'
              : 'left-0 w-72 max-w-[calc(100vw-24px)]'
          }`}
        >
          <div className="bg-[#00603C] text-white p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Pin className="w-4 h-4 text-[#C9922E]" />
              <span className="font-bold text-xs sm:text-sm">Fijar Campaña Activa</span>
            </div>
            <span className="text-[9px] bg-white/20 px-2 py-0.5 rounded text-white font-mono">
              30/06 → 01/07
            </span>
          </div>

          <div className="p-2 text-xs text-gray-600 bg-amber-50 border-b border-amber-100 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <p className="leading-tight text-[10px] sm:text-[11px] text-amber-900">
              La campaña fijada filtra los datos en todos los dashboards. Todo registro nuevo se asociará según su fecha.
            </p>
          </div>

          <div className="max-h-56 sm:max-h-64 overflow-y-auto p-1.5 space-y-1">
            <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-gray-400">
              Campañas Oficiales
            </div>

            {campanias.map((c) => {
              const isSelected = activeCampaniaId === c.id;
              const isVigenteNow = suggestedId === c.id;

              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleChoose(c.id)}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#F6EFDC] text-[#00603C] font-bold border border-[#C9922E]/50'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="flex items-center gap-1.5 font-semibold text-xs truncate">
                      <span className="truncate">{c.nombre}</span>
                      {isVigenteNow && (
                        <span className="text-[8px] bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-normal shrink-0">
                          Vigente
                        </span>
                      )}
                    </span>
                    <span className="text-[9px] text-gray-400 font-mono truncate">
                      {c.fechaInicio ? `${c.fechaInicio.split('-').reverse().join('/')} al ${c.fechaFin.split('-').reverse().join('/')}` : 'Periodo estándar'}
                    </span>
                  </div>

                  {isSelected && <Check className="w-4 h-4 text-[#00603C] shrink-0" />}
                </button>
              );
            })}

            <div className="border-t border-gray-100 pt-1 mt-1">
              <button
                type="button"
                onClick={() => handleChoose('TODAS')}
                className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer ${
                  activeCampaniaId === 'TODAS'
                    ? 'bg-gray-800 text-white font-bold'
                    : 'hover:bg-gray-100 text-gray-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span>Ver Todas las Campañas</span>
                </div>
                {activeCampaniaId === 'TODAS' && <Check className="w-4 h-4 text-white shrink-0" />}
              </button>
            </div>
          </div>

          <div className="p-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-500">
            <button
              type="button"
              onClick={() => {
                onSelectCampania(suggestedId);
                onPinCampania(suggestedId);
                setIsOpen(false);
              }}
              className="text-[#00603C] hover:underline flex items-center gap-1 font-medium cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" /> Usar actual ({suggestedId})
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
