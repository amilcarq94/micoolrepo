/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SiloAlertConfig, CAPACIDAD_MAX_SILO } from '../types';
import { Warehouse, AlertTriangle, Bell, Mail, Save, X, Info } from 'lucide-react';

interface SiloAlertsConfigModalProps {
  config: SiloAlertConfig;
  onSave: (config: SiloAlertConfig) => void;
  onClose: () => void;
}

export const SiloAlertsConfigModal: React.FC<SiloAlertsConfigModalProps> = ({
  config,
  onSave,
  onClose
}) => {
  const [porcentaje, setPorcentaje] = useState<number>(config.porcentajeAlerta || 85);
  const [notificarEmail, setNotificarEmail] = useState<boolean>(config.notificarEmail ?? true);
  const [emailDestino, setEmailDestino] = useState<string>(config.emailDestino || 'amilcarQ94@gmail.com');

  const kgUmbral = Math.round((CAPACIDAD_MAX_SILO * porcentaje) / 100);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      porcentajeAlerta: porcentaje,
      notificarEmail,
      emailDestino: emailDestino.trim()
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-[#00603C] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <Warehouse className="w-5 h-5 text-[#C9922E]" />
            </div>
            <div>
              <span className="text-[10px] font-mono tracking-widest uppercase text-[#C9922E] block">
                Capacidad y Seguridad
              </span>
              <h3 className="font-serif text-base font-bold">
                Alertas de Ocupación de Silo
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs">
          {/* Slider de porcentaje configurable */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-gray-800 uppercase tracking-wider text-[11px]">
                Umbral de Alerta de Ocupación
              </label>
              <span className="px-2.5 py-1 bg-amber-100 text-amber-900 font-mono font-bold rounded-full text-xs">
                {porcentaje}%
              </span>
            </div>

            <input
              type="range"
              min={60}
              max={98}
              step={1}
              value={porcentaje}
              onChange={(e) => setPorcentaje(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#00603C]"
            />

            <div className="flex justify-between text-[10px] text-gray-400 font-mono">
              <span>60% (108 Tn)</span>
              <span>85% (153 Tn)</span>
              <span>98% (176 Tn)</span>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 space-y-1 mt-2">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Disparo de Alerta a partir de:</span>
              </div>
              <p className="font-mono text-sm font-black text-amber-950">
                {kgUmbral.toLocaleString('es-AR')} kg ({(kgUmbral / 1000).toFixed(1)} Tn)
              </p>
              <p className="text-[11px] text-amber-800">
                Sobre una capacidad máxima nominal de {CAPACIDAD_MAX_SILO.toLocaleString('es-AR')} kg (180 Tn) por silo.
              </p>
            </div>
          </div>

          {/* Notificación por Email */}
          <div className="space-y-3 pt-2 border-t border-gray-100">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={notificarEmail}
                onChange={(e) => setNotificarEmail(e.target.checked)}
                className="rounded text-[#00603C] focus:ring-[#00603C]"
              />
              <span className="font-bold text-gray-800">
                Notificar por correo electrónico al superar el umbral
              </span>
            </label>

            {notificarEmail && (
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 font-semibold uppercase">
                  Correo electrónico del responsable
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={emailDestino}
                    onChange={(e) => setEmailDestino(e.target.value)}
                    required={notificarEmail}
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00603C]"
                    placeholder="ej: amilcarQ94@gmail.com"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Botones de acción */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-semibold transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#00603C] hover:bg-[#254731] text-white rounded-lg font-bold shadow transition flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              Guardar Configuración
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
