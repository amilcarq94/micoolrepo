/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Save, AlertTriangle, Info, Sliders, Mail, Send, Check, Loader2 } from 'lucide-react';
import { formatNumberArg } from '../utils/formatters';

interface StockAlertsConfigModalProps {
  especies: string[];
  thresholds: Record<string, number>;
  alertEmail: string;
  onSave: (newThresholds: Record<string, number>, email: string) => void;
  onClose: () => void;
}

export const StockAlertsConfigModal: React.FC<StockAlertsConfigModalProps> = ({
  especies,
  thresholds,
  alertEmail,
  onSave,
  onClose,
}) => {
  // Inicializar estado local de los umbrales
  const [localThresholds, setLocalThresholds] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    especies.forEach((esp) => {
      initial[esp] = thresholds[esp] !== undefined ? thresholds[esp] : 5000;
    });
    return initial;
  });

  // Estado local para el correo electrónico de alerta
  const [localEmail, setLocalEmail] = useState(alertEmail);
  const [emailError, setEmailError] = useState('');

  // Estados para simulación de envío de email de prueba
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testSentSuccess, setTestSentSuccess] = useState(false);

  const handleInputChange = (especie: string, value: string) => {
    const numValue = Math.max(0, parseInt(value) || 0);
    setLocalThresholds((prev) => ({
      ...prev,
      [especie]: numValue,
    }));
  };

  const handlePreset = (type: 'bajo' | 'medio' | 'alto') => {
    const presets: Record<string, Record<string, number>> = {
      bajo: {
        Soja: 5000, Trigo: 4000, Arveja: 3000
      },
      medio: {
        Soja: 12000, Trigo: 10000, Arveja: 6000
      },
      alto: {
        Soja: 25000, Trigo: 20000, Arveja: 6000
      }
    };

    const selectedPreset = presets[type];
    setLocalThresholds((prev) => {
      const updated = { ...prev };
      especies.forEach((esp) => {
        if (selectedPreset[esp] !== undefined) {
          updated[esp] = selectedPreset[esp];
        } else {
          updated[esp] = type === 'bajo' ? 2000 : type === 'medio' ? 5000 : 10000;
        }
      });
      return updated;
    });
  };

  const validateEmail = (email: string) => {
    if (!email) {
      return 'El correo electrónico es requerido';
    }
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(email)) {
      return 'Por favor, ingrese un correo válido';
    }
    return '';
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalEmail(val);
    if (emailError) {
      setEmailError(validateEmail(val));
    }
  };

  const handleSendTestEmail = () => {
    const err = validateEmail(localEmail);
    if (err) {
      setEmailError(err);
      return;
    }
    setEmailError('');
    setIsSendingTest(true);

    // Simular envío SMTP
    setTimeout(() => {
      setIsSendingTest(false);
      setTestSentSuccess(true);
      setTimeout(() => {
        setTestSentSuccess(false);
      }, 5000);
    }, 1500);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateEmail(localEmail);
    if (err) {
      setEmailError(err);
      return;
    }
    onSave(localThresholds, localEmail);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-100 relative">
        
        {/* Botón Cerrar */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition"
          title="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Cabecera */}
        <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-5">
          <div className="p-2.5 bg-[#F6EFDC] text-[#C9922E] rounded-lg">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-serif text-lg font-bold text-[#1A1A1A]">
              Alertas de Stock Mínimo
            </h3>
            <p className="text-xs text-gray-500">
              Configure el umbral en kg para disparar alertas preventivas y críticas.
            </p>
          </div>
        </div>

        {/* Información Técnica */}
        <div className="bg-amber-50 border border-amber-200/50 rounded-xl p-3 mb-5 text-left flex gap-2.5 items-start">
          <AlertTriangle className="w-5 h-5 text-[#C9922E] shrink-0 mt-0.5" />
          <div>
            <span className="text-[11px] font-bold text-amber-900 block uppercase tracking-wider">
              ¿Cómo funcionan los umbrales?
            </span>
            <span className="text-[11px] text-amber-800 leading-relaxed block mt-0.5">
              • <strong>Crítico (Rojo):</strong> El stock del lote cae por debajo o igual al umbral mínimo.<br />
              • <strong>Preventivo (Naranja):</strong> El stock del lote está un 25% o menos por encima del umbral (se acerca al límite).
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Listado de especies y sus inputs */}
          <div className="max-h-[220px] overflow-y-auto pr-1 space-y-3">
            {especies.map((esp) => (
              <div
                key={esp}
                className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-gray-50 hover:bg-gray-100/50 transition gap-4"
              >
                <div className="text-left shrink-0">
                  <span className="font-bold text-xs text-gray-800 block">{esp}</span>
                  <span className="text-[9px] text-gray-400 uppercase tracking-widest font-sans">Especie</span>
                </div>
                <div className="flex items-center gap-2 max-w-[160px]">
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={localThresholds[esp] || ''}
                    onChange={(e) => handleInputChange(esp, e.target.value)}
                    className="w-full text-right bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 font-mono text-xs font-bold text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#00603C] focus:border-[#00603C]"
                    placeholder="Ej. 10000"
                    required
                  />
                  <span className="text-xs font-semibold text-gray-400">kg</span>
                </div>
              </div>
            ))}

            {especies.length === 0 && (
              <div className="text-center py-6 text-gray-400 text-xs font-sans">
                No hay especies definidas en el sistema.
              </div>
            )}
          </div>

          {/* Ajustes rápidos */}
          {especies.length > 0 && (
            <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Ajustes Rápidos:</span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => handlePreset('bajo')}
                  className="px-2 py-1 text-[10px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded transition"
                >
                  Bajo (2-5t)
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset('medio')}
                  className="px-2 py-1 text-[10px] font-semibold text-[#00603C] bg-[#E3EFE7] hover:bg-emerald-100 rounded transition"
                >
                  Medio (5-12t)
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset('alto')}
                  className="px-2 py-1 text-[10px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 rounded transition"
                >
                  Alto (10-25t)
                </button>
              </div>
            </div>
          )}

          {/* Correo de Contacto para Alertas */}
          <div className="pt-4 border-t border-gray-100 text-left space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#1A1A1A] flex items-center gap-1.5 uppercase tracking-wide">
                <Mail className="w-4 h-4 text-[#00603C]" />
                Contacto de Alertas (Email)
              </label>
              <button
                type="button"
                onClick={handleSendTestEmail}
                disabled={isSendingTest}
                className="text-[10px] font-bold text-[#00603C] hover:text-[#254731] disabled:text-gray-400 flex items-center gap-1 transition"
              >
                {isSendingTest ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C9922E]" />
                ) : (
                  <Send className="w-3 h-3 text-[#C9922E]" />
                )}
                {isSendingTest ? 'Enviando...' : 'Enviar Prueba'}
              </button>
            </div>
            
            <div className="relative">
              <input
                type="email"
                value={localEmail}
                onChange={handleEmailChange}
                placeholder="alertas@agroabacus.com.ar"
                className={`w-full bg-white border rounded-xl px-3.5 py-2 text-xs font-medium text-gray-800 focus:outline-none focus:ring-1 ${
                  emailError 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-gray-200 focus:ring-[#00603C]'
                }`}
              />
              {emailError && (
                <p className="text-[10px] text-red-500 font-semibold mt-1">
                  {emailError}
                </p>
              )}
            </div>

            {/* Simulación visual de envío de correo */}
            {testSentSuccess && (
              <div className="bg-[#E3EFE7] border border-[#00603C]/20 rounded-xl p-3 text-xs text-[#00603C] animate-in slide-in-from-top-2 duration-300">
                <div className="flex gap-2 items-start">
                  <Check className="w-4 h-4 mt-0.5 shrink-0 text-[#00603C]" />
                  <div>
                    <span className="font-bold block text-[11px] uppercase tracking-wider">Email de prueba enviado con éxito</span>
                    <span className="block mt-0.5 text-gray-600 text-[10px]">
                      Se ha simulado un handshake SMTP hacia <strong>{localEmail}</strong> para validar la ruta del sistema de monitoreo.
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Botones de acción */}
          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-xs font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#00603C] text-white rounded-xl hover:bg-[#254731] transition text-xs font-bold shadow-md"
            >
              <Save className="w-4 h-4 text-[#C9922E]" />
              Guardar Configuración
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
