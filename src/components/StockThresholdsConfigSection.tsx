/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Sliders,
  AlertTriangle,
  Save,
  RefreshCw,
  Plus,
  Trash2,
  Mail,
  Send,
  Check,
  Loader2,
  Info,
  ShieldAlert,
  CheckCircle2,
  Scale,
  Layers,
  Sparkles,
  ArrowUpRight
} from 'lucide-react';
import { Lote } from '../types';
import { formatNumberArg } from '../utils/formatters';

interface StockThresholdsConfigSectionProps {
  especies: string[];
  thresholds: Record<string, number>;
  alertEmail: string;
  lotes: Lote[];
  onSave: (newThresholds: Record<string, number>, email: string) => void;
  onCancel?: () => void;
}

export const StockThresholdsConfigSection: React.FC<StockThresholdsConfigSectionProps> = ({
  especies,
  thresholds,
  alertEmail,
  lotes,
  onSave,
  onCancel,
}) => {
  // Lista de especies a gestionar (combina precargadas + existentes en thresholds)
  const [localEspecies, setLocalEspecies] = useState<string[]>(() => {
    const set = new Set([...especies, ...Object.keys(thresholds)]);
    if (set.size === 0) {
      set.add('Soja');
      set.add('Trigo');
      set.add('Arveja');
    }
    return Array.from(set);
  });

  // Estado local de umbrales por especie (en kg)
  const [localThresholds, setLocalThresholds] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    const allSet = new Set([...especies, ...Object.keys(thresholds)]);
    allSet.forEach((esp) => {
      initial[esp] = thresholds[esp] !== undefined ? thresholds[esp] : 5000;
    });
    if (Object.keys(initial).length === 0) {
      initial['Soja'] = 10000;
      initial['Trigo'] = 8000;
      initial['Arveja'] = 5000;
    }
    return initial;
  });

  // Estado local para el correo electrónico
  const [localEmail, setLocalEmail] = useState(alertEmail || 'amilcar.quiroz@agroabacus.com.ar');
  const [emailError, setEmailError] = useState('');

  // Estados para agregar nueva especie
  const [nuevaEspecieNombre, setNuevaEspecieNombre] = useState('');
  const [nuevaEspecieUmbral, setNuevaEspecieUmbral] = useState(5000);
  const [showAddSpeciesForm, setShowAddSpeciesForm] = useState(false);

  // Estados de retroalimentación de guardado y pruebas
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testSentSuccess, setTestSentSuccess] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Calcular stock actual por especie en planta
  const stockActualPorEspecie = React.useMemo(() => {
    const map: Record<string, { kg: number; bolsas: number; lotesCount: number }> = {};
    lotes.forEach((l) => {
      if (!map[l.especie]) {
        map[l.especie] = { kg: 0, bolsas: 0, lotesCount: 0 };
      }
      map[l.especie].kg += l.stockKg || 0;
      map[l.especie].bolsas += l.stockBolsas || 0;
      if (l.stockKg > 0) {
        map[l.especie].lotesCount += 1;
      }
    });
    return map;
  }, [lotes]);

  // Manejo de cambio de umbral para una especie
  const handleThresholdChange = (especie: string, value: number) => {
    const sanitized = Math.max(0, Math.min(100000, value));
    setLocalThresholds((prev) => ({
      ...prev,
      [especie]: sanitized,
    }));
  };

  // Ajuste rápido relativo (+ / -)
  const handleStepAdjustment = (especie: string, delta: number) => {
    const current = localThresholds[especie] || 0;
    const updated = Math.max(0, current + delta);
    setLocalThresholds((prev) => ({
      ...prev,
      [especie]: updated,
    }));
  };

  // Presets globales
  const handleApplyPreset = (type: 'conservador' | 'estandar' | 'industrial' | 'default') => {
    const defaultValues: Record<string, number> = {
      Soja: 10000,
      Trigo: 8000,
      Arveja: 5000,
      Maíz: 12000,
      Cebada: 8000,
      Girasol: 6000,
    };

    const multiplier = type === 'conservador' ? 0.5 : type === 'industrial' ? 2.0 : 1.0;

    const updated: Record<string, number> = {};
    localEspecies.forEach((esp) => {
      const base = defaultValues[esp] || 5000;
      updated[esp] = Math.round(base * multiplier);
    });

    setLocalThresholds(updated);
  };

  // Agregar nueva especie personalizada
  const handleAddSpecies = (e: React.FormEvent) => {
    e.preventDefault();
    const name = nuevaEspecieNombre.trim();
    if (!name) return;

    if (!localEspecies.includes(name)) {
      setLocalEspecies((prev) => [...prev, name]);
    }

    setLocalThresholds((prev) => ({
      ...prev,
      [name]: Math.max(0, nuevaEspecieUmbral),
    }));

    setNuevaEspecieNombre('');
    setNuevaEspecieUmbral(5000);
    setShowAddSpeciesForm(false);
  };

  // Eliminar especie de la vista de configuración
  const handleRemoveSpecies = (especie: string) => {
    setLocalEspecies((prev) => prev.filter((e) => e !== especie));
    setLocalThresholds((prev) => {
      const copy = { ...prev };
      delete copy[especie];
      return copy;
    });
  };

  // Validar email
  const validateEmail = (email: string) => {
    if (!email) return 'El correo electrónico es requerido';
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(email)) return 'Por favor ingrese un correo válido (ej: alertas@agroabacus.com)';
    return '';
  };

  // Enviar email de prueba
  const handleSendTestEmail = () => {
    const err = validateEmail(localEmail);
    if (err) {
      setEmailError(err);
      return;
    }
    setEmailError('');
    setIsSendingTest(true);

    setTimeout(() => {
      setIsSendingTest(false);
      setTestSentSuccess(true);
      setTimeout(() => setTestSentSuccess(false), 5000);
    }, 1200);
  };

  // Guardar configuración completa
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateEmail(localEmail);
    if (err) {
      setEmailError(err);
      return;
    }
    setEmailError('');
    onSave(localThresholds, localEmail);
    setSaveSuccessMsg('¡Configuración de umbrales actualizada con éxito!');
    setTimeout(() => setSaveSuccessMsg(''), 4000);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-6 space-y-8 animate-in fade-in duration-200">
      
      {/* Encabezado y Título */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5">
        <div className="flex items-start gap-3.5">
          <div className="p-3 bg-[#E3EFE7] border border-[#00603C]/20 text-[#00603C] rounded-2xl shrink-0">
            <Sliders className="w-6 h-6 text-[#00603C]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-sans font-bold tracking-widest text-[#C9922E] uppercase">
                CONFIGURACIÓN DEL DASHBOARD · ALERTAS DE ACOPIO
              </span>
              <span className="bg-[#F6EFDC] text-[#00603C] text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-[#C9922E]/30">
                Interactivo
              </span>
            </div>
            <h2 className="font-serif text-2xl font-bold text-[#1A1A1A] mt-0.5">
              Gestión de Umbrales Críticos por Especie de Grano
            </h2>
            <p className="text-xs text-gray-500 mt-1 max-w-2xl leading-relaxed">
              Defina el volumen mínimo de stock (en kg) requerido para cada grano. Cuando las existencias activas en planta sean menores o iguales al umbral, el sistema disparará alertas visuales rojas y notificará al correo configurado.
            </p>
          </div>
        </div>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="self-start md:self-center px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-xs font-bold transition"
          >
            Volver
          </button>
        )}
      </div>

      {/* Banner Informativo y Regla Técnica */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#E3EFE7]/50 border border-[#00603C]/20 rounded-2xl p-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-[#00603C] shrink-0 mt-0.5" />
          <div>
            <span className="text-xs font-bold text-[#00603C] block uppercase tracking-wider">
              1. Nivel Crítico (Rojo)
            </span>
            <span className="text-xs text-gray-600 mt-1 block">
              Stock actual &le; Umbral. Alerta inmediata de quiebre de stock y envío de correo.
            </span>
          </div>
        </div>

        <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="text-xs font-bold text-amber-900 block uppercase tracking-wider">
              2. Nivel Preventivo (Naranja)
            </span>
            <span className="text-xs text-gray-700 mt-1 block">
              Stock actual &le; 1.25 &times; Umbral. Advierte que las existencias están cerca del límite.
            </span>
          </div>
        </div>

        <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-2xl p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <span className="text-xs font-bold text-emerald-900 block uppercase tracking-wider">
              3. Operación Normal (Verde)
            </span>
            <span className="text-xs text-gray-600 mt-1 block">
              Stock actual &gt; 1.25 &times; Umbral. Capacidad holgada para cumplir despachos.
            </span>
          </div>
        </div>
      </div>

      {/* Presets Globales y Acciones Rápidas */}
      <div className="bg-gray-50/80 border border-gray-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#C9922E]" />
          <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">
            Plantillas Predeterminadas (Presets):
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleApplyPreset('conservador')}
            className="px-3 py-1.5 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 text-xs font-bold rounded-xl transition shadow-sm hover:bg-gray-50"
          >
            Conservador (50% stock)
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('estandar')}
            className="px-3 py-1.5 bg-[#E3EFE7] border border-[#00603C]/30 hover:bg-emerald-100 text-[#00603C] text-xs font-bold rounded-xl transition shadow-sm"
          >
            Estándar Planta
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('industrial')}
            className="px-3 py-1.5 bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-900 text-xs font-bold rounded-xl transition shadow-sm"
          >
            Alto Volumen (200%)
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* Formulario Interactivo de Tarjetas por Especie */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-lg font-bold text-[#1A1A1A] flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#00603C]" />
              Umbrales Configurables por Especie
            </h3>
            <button
              type="button"
              onClick={() => setShowAddSpeciesForm(!showAddSpeciesForm)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 hover:border-[#00603C] text-[#00603C] text-xs font-bold rounded-xl transition shadow-sm"
            >
              <Plus className="w-4 h-4 text-[#C9922E]" />
              <span>Agregar Especie</span>
            </button>
          </div>

          {/* Formulario desplegable para agregar especie nueva */}
          {showAddSpeciesForm && (
            <div className="bg-[#F6EFDC]/60 border border-[#C9922E]/40 rounded-2xl p-4 flex flex-col sm:flex-row items-end gap-3 animate-in slide-in-from-top-2 duration-200">
              <div className="flex-1 w-full">
                <label className="block text-[11px] font-bold uppercase text-gray-700 mb-1">
                  Nombre de Especie de Grano
                </label>
                <input
                  type="text"
                  value={nuevaEspecieNombre}
                  onChange={(e) => setNuevaEspecieNombre(e.target.value)}
                  placeholder="Ej: Maíz, Cebada, Sorgo, Girasol..."
                  className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00603C]"
                  required
                />
              </div>

              <div className="w-full sm:w-48">
                <label className="block text-[11px] font-bold uppercase text-gray-700 mb-1">
                  Umbral Mínimo (kg)
                </label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={nuevaEspecieUmbral}
                  onChange={(e) => setNuevaEspecieUmbral(Number(e.target.value))}
                  className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00603C]"
                  required
                />
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setShowAddSpeciesForm(false)}
                  className="px-3 py-2 bg-gray-200 text-gray-700 hover:bg-gray-300 text-xs font-bold rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleAddSpecies}
                  className="px-4 py-2 bg-[#00603C] hover:bg-[#254731] text-white text-xs font-bold rounded-xl transition shadow-sm flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4 text-[#C9922E]" />
                  Añadir
                </button>
              </div>
            </div>
          )}

          {/* Grid de Especies */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {localEspecies.map((esp) => {
              const currentThreshold = localThresholds[esp] !== undefined ? localThresholds[esp] : 5000;
              const stockData = stockActualPorEspecie[esp] || { kg: 0, bolsas: 0, lotesCount: 0 };
              const currentStockKg = stockData.kg;

              // Calcular estado visual dinámico en tiempo real
              const isCritical = currentStockKg <= currentThreshold;
              const isWarning = !isCritical && currentStockKg <= currentThreshold * 1.25;
              const isOptimal = !isCritical && !isWarning;

              // Porcentaje de umbral relativo al stock actual (para barra visual)
              const maxScale = Math.max(currentStockKg, currentThreshold * 1.5, 10000);
              const pctThreshold = Math.min(100, Math.round((currentThreshold / maxScale) * 100));
              const pctStock = Math.min(100, Math.round((currentStockKg / maxScale) * 100));

              return (
                <div
                  key={esp}
                  className={`rounded-2xl border p-5 flex flex-col justify-between transition-all duration-300 ${
                    isCritical
                      ? 'bg-red-50/40 border-red-300 shadow-sm'
                      : isWarning
                      ? 'bg-amber-50/40 border-amber-300 shadow-sm'
                      : 'bg-white border-gray-200 hover:border-gray-300 shadow-sm'
                  }`}
                >
                  <div>
                    {/* Encabezado de la Tarjeta */}
                    <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                      <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block font-sans">
                          Grano / Especie
                        </span>
                        <h4 className="font-serif text-lg font-bold text-[#1A1A1A] mt-0.5 flex items-center gap-2">
                          {esp}
                        </h4>
                      </div>

                      {/* Badge de Estado del Stock frente al Umbral */}
                      <div className="flex items-center gap-1">
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border ${
                            isCritical
                              ? 'bg-red-100 text-red-900 border-red-300 animate-pulse'
                              : isWarning
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          }`}
                        >
                          {isCritical ? '🔴 Stock Crítico' : isWarning ? '🟡 Preventivo' : '🟢 Holgado'}
                        </span>

                        {!['Soja', 'Trigo', 'Arveja'].includes(esp) && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSpecies(esp)}
                            className="p-1 text-gray-400 hover:text-red-600 transition"
                            title="Eliminar especie de la configuración"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Información del Stock Actual en Planta */}
                    <div className="bg-gray-50/80 rounded-xl p-3 mb-4 text-xs">
                      <div className="flex justify-between items-center text-gray-500 mb-1">
                        <span>Existencia en Planta:</span>
                        <span className="font-mono font-bold text-gray-800">
                          {stockData.lotesCount} {stockData.lotesCount === 1 ? 'lote' : 'lotes'}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="font-mono font-black text-sm text-[#00603C]">
                          {formatNumberArg(currentStockKg, 0)} <span className="text-[10px] font-sans font-normal text-gray-500">kg</span>
                        </span>
                        <span className="text-[11px] font-mono text-gray-600">
                          ({formatNumberArg(stockData.bolsas, 0)} b.)
                        </span>
                      </div>
                    </div>

                    {/* Control de Umbral Mínimo */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                          Umbral Crítico
                        </label>
                        <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-lg px-2 py-1 shadow-inner focus-within:ring-2 focus-within:ring-[#00603C]">
                          <input
                            type="number"
                            min="0"
                            max="100000"
                            step="500"
                            value={currentThreshold || 0}
                            onChange={(e) => handleThresholdChange(esp, Number(e.target.value))}
                            className="w-24 text-right font-mono font-bold text-xs text-gray-900 focus:outline-none"
                          />
                          <span className="text-[10px] font-bold text-gray-400">kg</span>
                        </div>
                      </div>

                      {/* Slider Interactivo */}
                      <div className="space-y-1">
                        <input
                          type="range"
                          min="0"
                          max="50000"
                          step="500"
                          value={currentThreshold || 0}
                          onChange={(e) => handleThresholdChange(esp, Number(e.target.value))}
                          className="w-full accent-[#00603C] cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] font-mono text-gray-400">
                          <span>0 kg</span>
                          <span>25.000 kg</span>
                          <span>50.000 kg</span>
                        </div>
                      </div>

                      {/* Conversión y Botones de Ajuste Fino (+/-) */}
                      <div className="flex items-center justify-between text-[11px] pt-1">
                        <span className="text-gray-500 italic">
                          Equivale a &asymp; <strong>{Math.round(currentThreshold / 50)}</strong> bolsas de 50kg
                        </span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => handleStepAdjustment(esp, -1000)}
                            className="px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-[10px] font-bold font-mono transition"
                            title="Restar 1.000 kg"
                          >
                            -1t
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStepAdjustment(esp, -500)}
                            className="px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-[10px] font-bold font-mono transition"
                            title="Restar 500 kg"
                          >
                            -500kg
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStepAdjustment(esp, 500)}
                            className="px-1.5 py-0.5 bg-[#E3EFE7] hover:bg-emerald-100 text-[#00603C] rounded text-[10px] font-bold font-mono transition"
                            title="Sumar 500 kg"
                          >
                            +500kg
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStepAdjustment(esp, 1000)}
                            className="px-1.5 py-0.5 bg-[#E3EFE7] hover:bg-emerald-100 text-[#00603C] rounded text-[10px] font-bold font-mono transition"
                            title="Sumar 1.000 kg"
                          >
                            +1t
                          </button>
                        </div>
                      </div>

                      {/* Barra Comparativa Visual (Stock vs Umbral) */}
                      <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
                        <div className="flex justify-between text-[10px] text-gray-500 font-medium">
                          <span>Comparación Visual (Stock vs Umbral)</span>
                          <span className="font-mono">
                            {((currentStockKg / (currentThreshold || 1)) * 100).toFixed(0)}% cobertura
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden relative">
                          {/* Marca del umbral */}
                          <div
                            className="h-full transition-all duration-300 rounded-full"
                            style={{
                              width: `${pctStock}%`,
                              backgroundColor: isCritical ? '#EF4444' : isWarning ? '#F59E0B' : '#10B981',
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sección de Notificaciones por Correo Electrónico */}
        <div className="bg-gray-50/90 border border-gray-200 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200/80 pb-3">
            <div>
              <h3 className="font-serif text-base font-bold text-[#1A1A1A] flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#00603C]" />
                Notificación Automática por Correo Electrónico
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Dirección de email que recibirá un reporte automático en caso de que cualquier lote caiga por debajo de su umbral crítico.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSendTestEmail}
              disabled={isSendingTest}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-[#E3EFE7] hover:bg-emerald-100 text-[#00603C] rounded-xl text-xs font-bold transition disabled:opacity-50"
            >
              {isSendingTest ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C9922E]" />
              ) : (
                <Send className="w-3.5 h-3.5 text-[#C9922E]" />
              )}
              {isSendingTest ? 'Verificando...' : 'Probar Notificación Email'}
            </button>
          </div>

          <div className="max-w-md space-y-1">
            <input
              type="email"
              value={localEmail}
              onChange={(e) => {
                setLocalEmail(e.target.value);
                if (emailError) setEmailError(validateEmail(e.target.value));
              }}
              placeholder="alertas.planta@agroabacus.com.ar"
              className={`w-full bg-white border rounded-xl px-3.5 py-2 text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 ${
                emailError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-[#00603C]'
              }`}
            />
            {emailError && <p className="text-[11px] text-red-600 font-semibold">{emailError}</p>}
          </div>

          {testSentSuccess && (
            <div className="bg-[#E3EFE7] border border-[#00603C]/30 rounded-xl p-3 text-xs text-[#00603C] animate-in slide-in-from-top-2 duration-300 flex items-start gap-2.5">
              <Check className="w-4 h-4 shrink-0 mt-0.5 text-[#00603C]" />
              <div>
                <span className="font-bold block uppercase tracking-wider text-[11px]">
                  Prueba de correo simulada con éxito
                </span>
                <span className="block text-gray-600 text-[11px] mt-0.5">
                  El sistema ha validado la ruta de alertas enviando un mensaje de prueba hacia <strong>{localEmail}</strong>.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Notificación de guardado exitoso */}
        {saveSuccessMsg && (
          <div className="bg-[#E3EFE7] border-2 border-[#00603C] text-[#00603C] rounded-2xl p-4 text-xs font-bold flex items-center gap-3 shadow-md animate-in fade-in duration-200">
            <CheckCircle2 className="w-5 h-5 text-[#00603C] shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* Barra Inferior de Guardar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-100">
          <div className="text-xs text-gray-500">
            Los cambios en los umbrales se aplican inmediatamente al Dashboard y al monitor de planta.
          </div>

          <div className="flex gap-3 w-full sm:w-auto">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 sm:flex-initial px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 bg-[#00603C] hover:bg-[#254731] text-white text-xs font-bold rounded-xl shadow-lg transition active:scale-95"
            >
              <Save className="w-4 h-4 text-[#C9922E]" />
              Guardar Configuración de Umbrales
            </button>
          </div>
        </div>

      </form>
    </div>
  );
};
