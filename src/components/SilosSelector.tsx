/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { SiloId, SiloExtraccion, MovimientoSilo } from '../types';
import { validateSiloLoteMatch } from '../utils/siloValidation';
import { Plus, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { SiloIcon } from './Logo';

export const SILOS_DISPONIBLES: SiloId[] = [
  'Silo 1',
  'Silo 2',
  'Silo 3',
  'Silo 4',
  'Silo 5',
  'Silo 6',
];

interface SilosSelectorProps {
  silosSeleccionados: SiloExtraccion[];
  siloStocks?: Record<SiloId, number>;
  movimientosSilo?: MovimientoSilo[];
  loteCliente?: string;
  loteEspecie?: string;
  loteVariedad?: string;
  targetKg?: number;
  onChange: (silos: SiloExtraccion[]) => void;
  label?: string;
  description?: string;
}

export const SilosSelector: React.FC<SilosSelectorProps> = ({
  silosSeleccionados = [],
  siloStocks = {
    'Silo 1': 0,
    'Silo 2': 0,
    'Silo 3': 0,
    'Silo 4': 0,
    'Silo 5': 0,
    'Silo 6': 0,
  },
  movimientosSilo = [],
  loteCliente,
  loteEspecie,
  loteVariedad,
  targetKg,
  onChange,
  label = 'Silos de Origen (Extracción)',
  description = 'Seleccione de 1 a 3 silos de origen e indique la cantidad de kg extraídos de cada uno.',
}) => {
  const safeSilosSeleccionados = silosSeleccionados || [];
  const totalSilosKg = safeSilosSeleccionados.reduce((acc, item) => acc + (Number(item.kg) || 0), 0);

  const handleAddSilo = () => {
    if (safeSilosSeleccionados.length >= 3) return;
    // Encontrar el primer silo que aún no haya sido seleccionado
    const yaUsados = safeSilosSeleccionados.map((s) => s.siloId);
    const disponible = SILOS_DISPONIBLES.find((s) => !yaUsados.includes(s)) || 'Silo 1';

    // Sugerir kg faltantes si hay un targetKg
    let kgSugeridos = 0;
    if (targetKg && targetKg > totalSilosKg) {
      kgSugeridos = targetKg - totalSilosKg;
    }

    onChange([...safeSilosSeleccionados, { siloId: disponible, kg: kgSugeridos, kgExtraidos: kgSugeridos }]);
  };

  const handleRemoveSilo = (index: number) => {
    const copia = [...safeSilosSeleccionados];
    copia.splice(index, 1);
    onChange(copia);
  };

  const handleSiloChange = (index: number, newSiloId: SiloId) => {
    const copia = [...safeSilosSeleccionados];
    copia[index] = { ...copia[index], siloId: newSiloId };
    onChange(copia);
  };

  const handleKgChange = (index: number, newKg: number) => {
    const copia = [...safeSilosSeleccionados];
    const cantVal = Math.max(0, newKg);
    copia[index] = { ...copia[index], kg: cantVal, kgExtraidos: cantVal };
    onChange(copia);
  };

  // Silos ocupados para filtrar dropdowns (no permitir duplicados)
  const silosUsados = safeSilosSeleccionados.map((s) => s.siloId);

  const coincideSuma = targetKg === undefined || targetKg === 0 || totalSilosKg === targetKg;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <SiloIcon size={24} color="#00603C" className="silo-icon-institucional shrink-0" />
            {label}
          </h4>
          <p className="text-[11px] text-slate-500 mt-0.5">{description}</p>
        </div>

        {safeSilosSeleccionados.length < 3 && (
          <button
            type="button"
            onClick={handleAddSilo}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg transition active:scale-95 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Agregar Silo ({safeSilosSeleccionados.length}/3)</span>
          </button>
        )}
      </div>

      {/* Resumen & Indicador de Necesidad de Kilos Aproximados */}
      {targetKg !== undefined && targetKg > 0 && (
        <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Necesidad de Kilos Aproximados</span>
              <span className="font-mono font-black text-slate-900 text-base">
                {targetKg.toLocaleString('es-AR')} kg
              </span>
            </div>

            <div className="text-xs">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Extracción de Silos</span>
              <span className="font-mono font-black text-emerald-800 text-base">
                {totalSilosKg.toLocaleString('es-AR')} kg
              </span>
            </div>

            <div>
              {coincideSuma && totalSilosKg > 0 ? (
                <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1 rounded-lg text-xs font-black">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  DEMANDA CUBIERTA (100%)
                </span>
              ) : totalSilosKg >= targetKg ? (
                <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1 rounded-lg text-xs font-black">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  CUBIERTO (EXCEDENTE: {(totalSilosKg - targetKg).toLocaleString('es-AR')} KG)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-900 border border-amber-300 px-3 py-1 rounded-lg text-xs font-black">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  {totalSilosKg > 0 ? `FALTAN ${(targetKg - totalSilosKg).toLocaleString('es-AR')} KG` : 'SE REQUIERE ASIGNAR SILO'}
                </span>
              )}
            </div>
          </div>

          {/* Barra de Progreso */}
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
            <div
              className={`h-full transition-all duration-300 ${
                totalSilosKg >= targetKg ? 'bg-emerald-500' : totalSilosKg > 0 ? 'bg-emerald-400' : 'bg-slate-300'
              }`}
              style={{ width: `${Math.min(100, Math.round((totalSilosKg / targetKg) * 100))}%` }}
            />
          </div>
        </div>
      )}

      {silosSeleccionados.length === 0 ? (
        <div className="py-4 text-center text-xs text-slate-400 italic bg-white rounded-lg border border-dashed border-slate-200">
          No ha asignado silos de origen todavía. Presione "Agregar Silo" para vincular extracciones de Silos 1 a 6.
        </div>
      ) : (
        <div className="space-y-2.5">
          {silosSeleccionados.map((item, index) => {
            const stockDisponible = siloStocks[item.siloId] || 0;
            const excedeStock = item.kg > stockDisponible;

            const matchCheck = (loteCliente || loteEspecie || loteVariedad)
              ? validateSiloLoteMatch(
                  item.siloId,
                  { cliente: loteCliente, especie: loteEspecie, variedad: loteVariedad },
                  movimientosSilo
                )
              : { valid: true };

            const isInvalidMatch = !matchCheck.valid;

            return (
              <div
                key={index}
                className={`p-3 rounded-xl border transition space-y-2 ${
                  excedeStock || isInvalidMatch ? 'bg-red-50/90 border-red-300 shadow-2xs' : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                {/* Selector de Silo */}
                <div className="w-full sm:w-56">
                  <label className="block text-xs font-black uppercase text-slate-700 tracking-wider mb-1">
                    Silo de Origen #{index + 1}
                  </label>
                  <select
                    value={item.siloId}
                    onChange={(e) => handleSiloChange(index, e.target.value as SiloId)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-black font-serif text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm"
                  >
                    {SILOS_DISPONIBLES.map((siloOption) => {
                      // Deshabilitar silos que ya están seleccionados en OTRA fila
                      const yaSeleccionadoEnOtro =
                        silosUsados.includes(siloOption) && siloOption !== item.siloId;
                      return (
                        <option
                          key={siloOption}
                          value={siloOption}
                          disabled={yaSeleccionadoEnOtro}
                        >
                          {siloOption} {yaSeleccionadoEnOtro ? '(Ya seleccionado)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Info Stock Disponible & Descuento */}
                <div className="text-xs">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Stock Actual</span>
                  <span
                    className={`font-mono font-bold ${
                      stockDisponible <= 0 ? 'text-red-600' : 'text-slate-800'
                    }`}
                  >
                    {stockDisponible.toLocaleString('es-AR')} kg
                  </span>

                  {item.kg > 0 && (
                    <div className="text-[10px] font-mono mt-0.5">
                      <span className="text-slate-400">Quedará: </span>
                      <strong className={stockDisponible - item.kg < 0 ? 'text-red-600 font-bold' : 'text-emerald-700 font-bold'}>
                        {Math.max(0, stockDisponible - item.kg).toLocaleString('es-AR')} kg
                      </strong>
                    </div>
                  )}
                </div>

                {/* Input de Kg Extraídos */}
                <div className="w-full sm:w-40">
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Kg a Extraer
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      value={item.kg || ''}
                      onChange={(e) => handleKgChange(index, parseFloat(e.target.value) || 0)}
                      className={`w-full px-3 py-1.5 bg-white border rounded-lg text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 ${
                        excedeStock ? 'border-red-500 text-red-900' : 'border-slate-300'
                      }`}
                      placeholder="0"
                    />
                    <span className="absolute right-3 top-1.5 text-xs text-slate-400 font-bold">kg</span>
                  </div>
                </div>

                {/* Botón Eliminar Fila */}
                <button
                  type="button"
                  onClick={() => handleRemoveSilo(index)}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition self-end sm:self-center"
                  title="Eliminar este silo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                </div>

                {isInvalidMatch && (
                  <div className="bg-red-100 border border-red-300 text-red-800 text-[11px] p-2 rounded-lg flex items-center gap-2 font-medium">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    <span className="whitespace-pre-line">{matchCheck.errorMessage}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Resumen de Validación de Kg */}
      {silosSeleccionados.length > 0 && (
        <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">Total Extracción Silos:</span>
            <span className="font-mono font-bold text-slate-900 bg-white px-2.5 py-1 rounded border border-slate-300">
              {totalSilosKg.toLocaleString('es-AR')} kg
            </span>
            {targetKg !== undefined && targetKg > 0 && (
              <span className="text-slate-500">
                (Objetivo: <strong className="font-mono text-slate-800">{targetKg.toLocaleString('es-AR')} kg</strong>)
              </span>
            )}
          </div>

          {targetKg !== undefined && targetKg > 0 && (
            <div>
              {coincideSuma ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-800 font-bold bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Suma coincide con total del lote/orden
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-amber-900 font-bold bg-amber-50 px-2.5 py-1 rounded border border-amber-300 text-[11px] animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  Diferencia: {Math.abs(targetKg - totalSilosKg).toLocaleString('es-AR')} kg
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
