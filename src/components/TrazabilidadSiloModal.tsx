/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { SiloExtraccion, MovimientoSilo } from '../types';
import { X, Warehouse, FileText, Calendar, ArrowRight, ShieldCheck, Tag, Layers, User } from 'lucide-react';

interface TrazabilidadSiloModalProps {
  title: string;
  loteNroOrOpNum: string;
  silosOrigen?: SiloExtraccion[];
  movimientosSilo: MovimientoSilo[];
  onClose: () => void;
}

export const TrazabilidadSiloModal: React.FC<TrazabilidadSiloModalProps> = ({
  title,
  loteNroOrOpNum,
  silosOrigen = [],
  movimientosSilo,
  onClose,
}) => {
  const totalKgExtraidos = silosOrigen.reduce((acc, s) => acc + (s.kg || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-emerald-900/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600/30 rounded-xl border border-emerald-500/30">
              <Warehouse className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">
                  Trazabilidad de Silos de Origen
                </span>
                <span className="text-xs text-slate-300 font-mono font-bold">
                  Ref: {loteNroOrOpNum}
                </span>
              </div>
              <h2 className="text-lg font-bold font-serif text-white mt-0.5">
                {title}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          
          {/* Silos de Origen Resumen */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              1. Composición y Silo(s) Extraídos
            </h3>

            {silosOrigen.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                No hay información de silos de origen vinculada a este registro.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {silosOrigen.map((item, idx) => {
                  const pct = totalKgExtraidos > 0 ? ((item.kg / totalKgExtraidos) * 100).toFixed(1) : '0';
                  return (
                    <div
                      key={idx}
                      className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between space-y-2 relative overflow-hidden"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold font-serif text-slate-900 text-base">
                          {item.siloId}
                        </span>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 font-extrabold text-[10px] rounded-full">
                          {pct}% del total
                        </span>
                      </div>

                      <div className="text-xl font-black font-mono text-emerald-800">
                        {item.kg.toLocaleString('es-AR')} <span className="text-xs font-normal text-slate-500">kg</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Remontarse a los Ingresos Originales */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-blue-600" />
              2. Trazabilidad Profunda: Ingresos Originales a los Silos de Origen
            </h3>

            {silosOrigen.map((siloItem) => {
              // Obtener todos los ingresos para ese silo específico
              const ingresosDelSilo = movimientosSilo.filter(
                (m) => m.siloId === siloItem.siloId && m.tipo === 'INGRESO'
              );

              return (
                <div key={siloItem.siloId} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                  <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800 flex items-center gap-2">
                      <Warehouse className="w-4 h-4 text-emerald-600" />
                      {siloItem.siloId} — Extracción: {siloItem.kg.toLocaleString('es-AR')} kg
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {ingresosDelSilo.length} Ingreso(s) Registrado(s)
                    </span>
                  </div>

                  {ingresosDelSilo.length === 0 ? (
                    <div className="p-4 text-xs text-slate-400 italic text-center">
                      No hay registros de ingreso grabados previamente para este silo.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 text-xs">
                      {ingresosDelSilo.map((ingreso) => (
                        <div key={ingreso.id} className="p-3.5 hover:bg-slate-50 transition grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              {ingreso.cliente || 'Sin Cliente'}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              Fecha: {ingreso.fecha}
                            </div>
                          </div>

                          <div>
                            <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-900 font-bold text-[10px] rounded border border-emerald-200 mb-1">
                              {ingreso.especie || 'N/A'}
                            </span>
                            <div className="font-mono text-slate-700 font-bold text-[11px]">
                              {ingreso.variedad || 'N/A'} ({ingreso.categoria || 'Cat. N/A'})
                            </div>
                          </div>

                          <div>
                            <div className="text-[11px] font-semibold text-slate-800 flex items-center gap-1">
                              <Tag className="w-3 h-3 text-blue-500" />
                              Bolsón: <strong className="font-mono">{ingreso.bolsonOrigenNro || 'S/N'}</strong>
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Sector: {ingreso.bolsonOrigenSector || '-'} · Depósito: {ingreso.depositoOrigen || '-'}
                            </div>
                          </div>

                          <div className="sm:text-right font-mono font-black text-slate-900">
                            + {ingreso.kg.toLocaleString('es-AR')} kg
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition"
          >
            Cerrar Trazabilidad
          </button>
        </div>

      </div>
    </div>
  );
};
