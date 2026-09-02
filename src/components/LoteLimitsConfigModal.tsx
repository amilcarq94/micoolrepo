/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { LoteLimitsConfig, DEFAULT_LOTE_LIMITS } from '../types';
import { Sliders, X, Check, RefreshCw, AlertCircle, Scale, Package } from 'lucide-react';

interface LoteLimitsConfigModalProps {
  isOpen: boolean;
  limits: LoteLimitsConfig;
  onSave: (newLimits: LoteLimitsConfig) => void;
  onClose: () => void;
}

export const LoteLimitsConfigModal: React.FC<LoteLimitsConfigModalProps> = ({
  isOpen,
  limits,
  onSave,
  onClose,
}) => {
  const [maxKg, setMaxKg] = useState<number>(limits.maxKgPorLote || DEFAULT_LOTE_LIMITS.maxKgPorLote);
  const [maxBolsas, setMaxBolsas] = useState<number>(limits.maxBolsasPorLote || DEFAULT_LOTE_LIMITS.maxBolsasPorLote);
  const [kgBolsa, setKgBolsa] = useState<number>(limits.kgPorBolsaDefault || DEFAULT_LOTE_LIMITS.kgPorBolsaDefault);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleResetDefaults = () => {
    setMaxKg(DEFAULT_LOTE_LIMITS.maxKgPorLote);
    setMaxBolsas(DEFAULT_LOTE_LIMITS.maxBolsasPorLote);
    setKgBolsa(DEFAULT_LOTE_LIMITS.kgPorBolsaDefault);
    setErrorMsg('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(maxKg) || maxKg <= 0) {
      setErrorMsg('El máximo de kilogramos por lote debe ser un número positivo.');
      return;
    }
    if (isNaN(maxBolsas) || maxBolsas <= 0) {
      setErrorMsg('El máximo de bolsas por lote debe ser un número positivo.');
      return;
    }
    if (isNaN(kgBolsa) || kgBolsa <= 0) {
      setErrorMsg('El peso predeterminado por bolsa debe ser mayor a 0 kg.');
      return;
    }

    setErrorMsg('');
    const newConfig: LoteLimitsConfig = {
      maxKgPorLote: Math.round(maxKg),
      maxBolsasPorLote: Math.round(maxBolsas),
      kgPorBolsaDefault: Math.round(kgBolsa),
    };

    onSave(newConfig);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
        {/* Encabezado */}
        <div className="bg-[#00603C] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <Sliders className="w-5 h-5 text-[#C9922E]" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg leading-tight">
                Límites Máximos de Carga por Lote
              </h3>
              <p className="text-[11px] text-emerald-100">
                Configuración global de capacidad máxima y acumulaciones
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3.5 text-xs text-emerald-900 space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-[#00603C]" />
              Límites obligatorios inquebrantables
            </p>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Cualquier alta o acumulación por número de lote repetido que supere estos valores será bloqueada de forma estricta en el Reporte Diario y en Cargas por Excel.
            </p>
          </div>

          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                <span>Kilogramos Máximos por Lote (kg)</span>
                <span className="text-[10px] text-slate-400 font-normal">Predeterminado: 28.000 kg</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1000"
                  step="100"
                  value={maxKg}
                  onChange={(e) => setMaxKg(Number(e.target.value))}
                  className="w-full pl-3 pr-12 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00603C]"
                />
                <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">kg</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Límite de masa total acumulada en stock por cada lote.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                <span>Bolsas Máximas por Lote (unidades)</span>
                <span className="text-[10px] text-slate-400 font-normal">Predeterminado: 35 bolsas</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={maxBolsas}
                  onChange={(e) => setMaxBolsas(Number(e.target.value))}
                  className="w-full pl-3 pr-16 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00603C]"
                />
                <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">bolsas</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Límite de empaque físico en bolsas gigantes / big bags.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                <span>Peso Estándar por Bolsa (kg/bolsa)</span>
                <span className="text-[10px] text-slate-400 font-normal">Predeterminado: 800 kg</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  step="5"
                  value={kgBolsa}
                  onChange={(e) => setKgBolsa(Number(e.target.value))}
                  className="w-full pl-3 pr-16 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00603C]"
                />
                <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">kg/bolsa</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Peso unitario usado para calcular el stock equivalente ({maxBolsas} bolsas × {kgBolsa} kg = {maxBolsas * kgBolsa} kg).
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
              title="Restablecer a valores por defecto (28.000 kg / 35 bolsas de 800 kg)"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Valores por defecto</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-5 py-2 bg-[#00603C] hover:bg-[#254731] text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow transition cursor-pointer"
              >
                {savedSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-[#C9922E]" />
                    <span>¡Guardado!</span>
                  </>
                ) : (
                  <span>Guardar Límites</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
