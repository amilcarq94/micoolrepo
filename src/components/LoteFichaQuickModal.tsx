/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Lote } from '../types';
import { formatNumberArg, formatKg, formatDateStr } from '../utils/formatters';
import {
  X,
  Warehouse,
  MapPin,
  QrCode,
  FileText,
  Tag,
  Building2,
  Sprout,
  ShieldCheck,
  Calendar,
  Layers,
  ExternalLink,
  Droplets,
  Scale
} from 'lucide-react';

interface LoteFichaQuickModalProps {
  lote: Lote;
  onClose: () => void;
  onLocalizarEnMapa?: (lote: Lote) => void;
  onOpenQrModal?: (lote: Lote) => void;
  onSelectFullFicha?: (lote: Lote) => void;
}

export const LoteFichaQuickModal: React.FC<LoteFichaQuickModalProps> = ({
  lote,
  onClose,
  onLocalizarEnMapa,
  onOpenQrModal,
  onSelectFullFicha,
}) => {
  // Normalizar tratamientos
  const tratamientos = React.useMemo(() => {
    if (!lote.tratamiento) return ['Sin Tratar'];
    if (Array.isArray(lote.tratamiento)) {
      return lote.tratamiento.filter(Boolean);
    }
    if (typeof lote.tratamiento === 'string') {
      return [lote.tratamiento];
    }
    return ['Sin Tratar'];
  }, [lote.tratamiento]);

  const esTratado = tratamientos.some(
    (t) =>
      t.toLowerCase().includes('tratado') ||
      t.toLowerCase().includes('curado') ||
      t.toLowerCase().includes('curasemilla') ||
      t.toLowerCase().includes('inocula')
  );

  const tieneUbicacion = Boolean(lote.ala && lote.sector);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      id="modal-ficha-rapida-lote"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
        {/* Cabecera Oficial */}
        <div className="bg-gradient-to-r from-emerald-950 via-[#00603C] to-[#1c3a26] text-white p-5 sm:p-6 border-b border-emerald-800/40 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl transition cursor-pointer"
            title="Cerrar Ficha"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-black uppercase tracking-widest text-amber-300 bg-amber-400/20 px-2 py-0.5 rounded-md border border-amber-400/30">
              Ficha Técnica
            </span>
            <span className="text-[10px] font-bold text-emerald-200 bg-emerald-800/80 px-2 py-0.5 rounded-md">
              Planta Móvil · Acopio
            </span>
          </div>

          <div className="flex items-baseline justify-between gap-3 mt-1">
            <h3 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-tight">
              N° {lote.loteNro}
            </h3>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                lote.estado === 'Disponible'
                  ? 'bg-emerald-400 text-emerald-950'
                  : lote.estado === 'Reservado'
                  ? 'bg-amber-300 text-amber-950'
                  : 'bg-slate-300 text-slate-900'
              }`}
            >
              {lote.estado}
            </span>
          </div>

          <p className="text-xs text-emerald-100/90 font-medium mt-1">
            {lote.cliente} · Estancia La Barrancosa
          </p>
        </div>

        {/* Cuerpo con Scroll */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
          {/* SECCIÓN DESTACADA: UBICACIÓN FÍSICA EN ACOPIO */}
          <div
            className={`p-4 rounded-2xl border-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              tieneUbicacion
                ? 'bg-emerald-50/70 border-emerald-600/40 text-emerald-950'
                : 'bg-amber-50 border-amber-300 text-amber-950'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  tieneUbicacion ? 'bg-[#00603C] text-white shadow-sm' : 'bg-amber-500 text-white'
                }`}
              >
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-black uppercase tracking-wider block text-slate-500">
                  Ubicación Física en Acopio
                </span>
                <div className="font-serif text-lg font-black tracking-tight">
                  {tieneUbicacion ? (
                    <span className="text-[#00603C]">
                      ALA {lote.ala} · SECTOR {lote.sector}
                    </span>
                  ) : (
                    <span className="text-amber-800">Sin Ubicación Asignada</span>
                  )}
                </div>
                <span className="text-xs text-slate-600 block">
                  {lote.ubicacionAcopio || (tieneUbicacion ? `Depósito Central de Semillas - Cuadrícula Ala ${lote.ala}` : 'No se ha registrado celda en el depósito')}
                </span>
              </div>
            </div>

            {tieneUbicacion && onLocalizarEnMapa && (
              <button
                type="button"
                onClick={() => {
                  onLocalizarEnMapa(lote);
                  onClose();
                }}
                className="px-4 py-2.5 bg-[#00603C] hover:bg-[#254731] text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                <Warehouse className="w-4 h-4 text-amber-300" />
                <span>Ver en Mapa</span>
              </button>
            )}
          </div>

          {/* DATOS AGRONÓMICOS & ESPECIFICACIONES */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase block">
                Especie
              </span>
              <span className="font-bold text-slate-900 text-sm mt-0.5 block flex items-center gap-1.5">
                <Sprout className="w-4 h-4 text-[#00603C]" />
                {lote.especie || 'No definida'}
              </span>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase block">
                Variedad
              </span>
              <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                {lote.variedad || 'Sin variedad'}
              </span>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase block">
                Tratamiento
              </span>
              <div className="mt-1 flex flex-wrap gap-1">
                {tratamientos.map((t, idx) => (
                  <span
                    key={idx}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${
                      esTratado
                        ? 'bg-sky-100 text-sky-900 border border-sky-300'
                        : 'bg-slate-200 text-slate-800'
                    }`}
                  >
                    <ShieldCheck className="w-3 h-3 text-sky-700" />
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase block">
                Categoría / Tipo
              </span>
              <span className="font-bold text-slate-800 text-xs mt-0.5 block">
                {lote.categoria || 'Original'} · {lote.tipo || 'Semilla'}
              </span>
            </div>
          </div>

          {/* STOCK Y BALANCE DE KILOS */}
          <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-3">
            <span className="text-[10px] font-mono font-black uppercase text-amber-300 tracking-wider block">
              Existencias y Presentación
            </span>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white/10 p-2.5 rounded-xl">
                <span className="text-[10px] text-slate-300 block">Total Kilos</span>
                <span className="font-mono font-bold text-base text-white">
                  {formatKg(lote.stockKg)}
                </span>
              </div>
              <div className="bg-white/10 p-2.5 rounded-xl">
                <span className="text-[10px] text-slate-300 block">Total Bolsas</span>
                <span className="font-mono font-bold text-base text-amber-300">
                  {formatNumberArg(lote.stockBolsas, 0)} b.
                </span>
              </div>
              <div className="bg-white/10 p-2.5 rounded-xl">
                <span className="text-[10px] text-slate-300 block">Peso Unitario</span>
                <span className="font-mono font-bold text-base text-slate-200">
                  {lote.kgPorBolsa || 800} kg
                </span>
              </div>
            </div>

            {typeof lote.humedad === 'number' && (
              <div className="flex items-center justify-between text-xs pt-1 border-t border-white/10 text-slate-300">
                <span className="flex items-center gap-1">
                  <Droplets className="w-3.5 h-3.5 text-sky-400" />
                  Humedad de Granos:
                </span>
                <span className="font-mono font-bold text-white">{lote.humedad}%</span>
              </div>
            )}
          </div>

          {/* DATOS DE ORIGEN Y TRAZABILIDAD */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1.5">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
              Origen y Fechas
            </span>
            <div className="flex justify-between text-slate-700">
              <span className="text-slate-500">Fecha de Ingreso / Alta:</span>
              <span className="font-mono font-bold">
                {formatDateStr(lote.fechaIngreso || (lote.fechaHoraProduccion ? lote.fechaHoraProduccion.split('T')[0] : '')) || '—'}
              </span>
            </div>
            {lote.siloOrigen && (
              <div className="flex justify-between text-slate-700">
                <span className="text-slate-500">Silo de Origen:</span>
                <span className="font-bold text-[#00603C]">{lote.siloOrigen}</span>
              </div>
            )}
            {lote.bolsonOrigenNro && (
              <div className="flex justify-between text-slate-700">
                <span className="text-slate-500">Bolsón de Origen:</span>
                <span className="font-bold text-[#00603C]">Bolsón #{lote.bolsonOrigenNro}</span>
              </div>
            )}
            {lote.observaciones && (
              <div className="pt-2 border-t border-slate-200/80 text-[11px] text-slate-600 italic">
                "{lote.observaciones}"
              </div>
            )}
          </div>
        </div>

        {/* Footer con Acciones */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          {onOpenQrModal && (
            <button
              type="button"
              onClick={() => {
                onOpenQrModal(lote);
                onClose();
              }}
              className="w-full sm:w-auto px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
            >
              <QrCode className="w-4 h-4 text-[#C9922E]" />
              <span>Código QR</span>
            </button>
          )}

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {onSelectFullFicha && (
              <button
                type="button"
                onClick={() => {
                  onSelectFullFicha(lote);
                  onClose();
                }}
                className="flex-1 sm:flex-initial px-4 py-2.5 bg-[#00603C] hover:bg-[#254731] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
                title="Abrir Ficha Técnica Oficial Completa en el sistema"
              >
                <FileText className="w-4 h-4 text-amber-300" />
                <span>Ver Ficha Completa</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
