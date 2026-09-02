/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { OrdenProceso, EstadoOrdenProceso } from '../types';
import { OrdenProcesoGauge } from './OrdenProcesoGauge';
import { X, CheckCircle2, Sliders, Scale, Target, Package, AlertCircle } from 'lucide-react';
import { getKgPorEnvase } from './OrdenProcesoModal';

interface EditarCumplimientoModalProps {
  isOpen: boolean;
  orden: OrdenProceso | null;
  onSave: (ordenActualizada: OrdenProceso) => void;
  onClose: () => void;
}

export const EditarCumplimientoModal: React.FC<EditarCumplimientoModalProps> = ({
  isOpen,
  orden,
  onSave,
  onClose,
}) => {
  const [bbPedidos, setBbPedidos] = useState<number>(0);
  const [hechos, setHechos] = useState<number>(0);
  const [estado, setEstado] = useState<EstadoOrdenProceso>('EN CURSO');
  const [porcentajeInput, setPorcentajeInput] = useState<number>(0);

  useEffect(() => {
    if (orden) {
      const p = orden.bbPedidos || 50;
      const h = orden.hechos || 0;
      setBbPedidos(p);
      setHechos(h);
      setEstado(orden.estado || 'EN CURSO');
      const calcPct = p > 0 ? Math.round((h / p) * 100) : 0;
      setPorcentajeInput(calcPct);
    }
  }, [orden]);

  if (!isOpen || !orden) return null;

  const currentKgEnvase = getKgPorEnvase(orden.envaseDestino || '');

  // Handle direct percentage edit slider or number
  const handlePorcentajeChange = (newPct: number) => {
    const validPct = Math.max(0, Math.min(200, newPct));
    setPorcentajeInput(validPct);
    if (bbPedidos > 0) {
      const newHechos = Math.round((validPct * bbPedidos) / 100);
      setHechos(newHechos);
    }
  };

  // Handle hechos change directly
  const handleHechosChange = (newHechos: number) => {
    const validH = Math.max(0, newHechos);
    setHechos(validH);
    if (bbPedidos > 0) {
      const calcPct = Math.round((validH / bbPedidos) * 100);
      setPorcentajeInput(calcPct);
    }
  };

  // Handle bbPedidos change
  const handleBbPedidosChange = (newPedidos: number) => {
    const validP = Math.max(1, newPedidos);
    setBbPedidos(validP);
    if (validP > 0) {
      const calcPct = Math.round((hechos / validP) * 100);
      setPorcentajeInput(calcPct);
    }
  };

  const handleQuickPctSelect = (targetPct: number) => {
    handlePorcentajeChange(targetPct);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const ordenActualizada: OrdenProceso = {
      ...orden,
      bbPedidos: Number(bbPedidos) || 1,
      hechos: Number(hechos) || 0,
      estado,
    };
    onSave(ordenActualizada);
    onClose();
  };

  const currentPct = bbPedidos > 0 ? Math.round((hechos / bbPedidos) * 100) : 0;
  const totalKgHechos = hechos * currentKgEnvase;
  const totalKgPedidos = bbPedidos * currentKgEnvase;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-emerald-950 via-[#00603C] to-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-400/20 text-amber-300 rounded-xl border border-amber-400/30">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base tracking-wide uppercase flex items-center gap-2">
                <span>Editar Dashboard de Cumplimiento</span>
              </h3>
              <p className="text-xs text-emerald-200/80 font-mono">
                N° Orden: <strong className="text-white">{orden.numeroOrden}</strong> {orden.numeroOrdenMovimiento ? `(${orden.numeroOrdenMovimiento})` : ''} • {orden.cliente || 'Cliente'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-6">
          
          {/* Live Gauge Dashboard Preview */}
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-around gap-4 text-center sm:text-left">
            <div className="shrink-0">
              <OrdenProcesoGauge
                hechos={hechos}
                bbPedidos={bbPedidos}
                size={130}
              />
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
                Progreso Calculado
              </div>
              <div className="text-2xl font-black font-mono text-[#00603C]">
                {currentPct}% <span className="text-xs font-bold text-slate-500 font-sans">de objetivo</span>
              </div>
              <div className="text-slate-700 font-medium leading-tight">
                <span className="font-bold text-emerald-800">{hechos}</span> de <span className="font-bold text-slate-800">{bbPedidos}</span> bultos/bolsas ({orden.envaseDestino || 'Big Bag'})
              </div>
              <div className="text-[11px] font-mono text-slate-500 font-semibold bg-white px-2.5 py-1 rounded-lg border border-slate-200 inline-block">
                <Scale className="w-3 h-3 inline text-emerald-600 mr-1" />
                {totalKgHechos.toLocaleString('es-AR')} kg / {totalKgPedidos.toLocaleString('es-AR')} kg
              </div>
            </div>
          </div>

          {/* Preset percentage buttons */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Ajuste Rápido de Porcentaje
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[0, 25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => handleQuickPctSelect(pct)}
                  className={`py-1.5 px-2 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer ${
                    currentPct === pct
                      ? 'bg-[#00603C] text-white border-[#00603C] shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50 hover:border-emerald-300'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          {/* Slider for percentage */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs font-bold text-slate-700">
              <span>Deslizador de Cumplimiento (%):</span>
              <span className="font-mono text-[#00603C] text-sm">{porcentajeInput}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="150"
              step="1"
              value={porcentajeInput}
              onChange={(e) => handlePorcentajeChange(Number(e.target.value))}
              className="w-full accent-[#00603C] cursor-pointer"
            />
          </div>

          {/* Numeric Inputs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Target Bolsas / BB */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Target className="w-3.5 h-3.5 text-emerald-700" />
                Objetivo (BB / Bolsas) *
              </label>
              <input
                type="number"
                min="1"
                value={bbPedidos}
                onChange={(e) => handleBbPedidosChange(Number(e.target.value))}
                required
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-bold font-mono"
              />
            </div>

            {/* Bolsas Cumplidas / Vinculadas (Hechos) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Package className="w-3.5 h-3.5 text-amber-600" />
                Bolsas Cumplidas (Hechos) *
              </label>
              <input
                type="number"
                min="0"
                value={hechos}
                onChange={(e) => handleHechosChange(Number(e.target.value))}
                required
                className="w-full px-3.5 py-2 text-sm border border-emerald-300 bg-emerald-50/20 rounded-xl focus:ring-2 focus:ring-emerald-500 font-bold font-mono text-[#00603C]"
              />
            </div>
          </div>

          {/* Estado Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Estado de la Orden
            </label>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value as EstadoOrdenProceso)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-semibold bg-white"
            >
              <option value="SIN INICIAR">🔴 SIN INICIAR</option>
              <option value="EN CURSO">🟡 EN CURSO</option>
              <option value="TERMINADO">🟢 TERMINADO</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2 bg-[#00603C] hover:bg-[#254731] text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md transition cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-amber-300" />
              <span>Guardar Dashboard</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
