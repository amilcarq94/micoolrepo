/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Lote, MovimientoStock } from '../types';
import { formatKg } from '../utils/formatters';
import { ModalVentanaOperacion } from './ModalVentanaOperacion';
import { CheckCircle2, Calendar, ArrowRightLeft, AlertCircle, Tag, FlaskConical, Building2 } from 'lucide-react';

interface MovRealizadoModalProps {
  isOpen: boolean;
  lote: Lote | null;
  lotesToProcess?: Lote[];
  onConfirm: (lotesActualizados: Lote | Lote[]) => void;
  onClose: () => void;
}

export const MovRealizadoModal: React.FC<MovRealizadoModalProps> = ({
  isOpen,
  lote,
  lotesToProcess = [],
  onConfirm,
  onClose,
}) => {
  if (!isOpen || (!lote && lotesToProcess.length === 0)) return null;

  const targetLotes = lotesToProcess.length > 0 ? lotesToProcess : (lote ? [lote] : []);
  const primaryLote = targetLotes[0];

  // Fecha manual en la que se realizó efectivamente el movimiento
  const [fechaRealizacion, setFechaRealizacion] = useState<string>(() => {
    return primaryLote.fechaMovimiento || primaryLote.fechaIngreso || new Date().toISOString().split('T')[0];
  });

  const [bolsasProducidas, setBolsasProducidas] = useState<number>(primaryLote.stockBolsas || 0);
  const [ala, setAla] = useState(primaryLote.ala || 'A');
  const [sector, setSector] = useState(primaryLote.sector || '1');
  const [observaciones, setObservaciones] = useState(primaryLote.observaciones || '');
  const [errorMsg, setErrorMsg] = useState('');

  const handleConfirm = () => {
    setErrorMsg('');
    if (!fechaRealizacion.trim()) {
      setErrorMsg('Debe seleccionar la fecha en la que se realizó efectivamente el movimiento.');
      return;
    }

    if (targetLotes.length === 1 && (isNaN(bolsasProducidas) || bolsasProducidas <= 0)) {
      setErrorMsg('La cantidad de bolsas realizadas debe ser mayor a cero.');
      return;
    }

    const updatedLotesList: Lote[] = targetLotes.map(currLote => {
      const currentBolsas = targetLotes.length === 1 ? bolsasProducidas : (currLote.stockBolsas || 0);
      const currentKgB = currLote.kgPorBolsa || 800;
      const currentKgTot = currentBolsas * currentKgB;

      const movimientoStock: MovimientoStock = {
        id: `MOV-REAL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        fecha: fechaRealizacion,
        tipo: 'Entrada manual',
        cantidadBolsas: currentBolsas,
        kgPorBolsa: currentKgB,
        cantidadKg: currentKgTot,
        detalle: `MOV REALIZADO (Efectivizado el ${fechaRealizacion}) - Origen: ${currLote.loteOrigen || 'S/D'}`
      };

      const ubicacionStr = ala && sector ? `Ala ${ala} - Sector ${sector}` : (currLote.ubicacionAcopio || 'Sin asignar');

      return {
        ...currLote,
        estadoRegistro: 'REALIZADO',
        estadoMovimiento: 'REALIZADO',
        fechaRealizacionMovimiento: fechaRealizacion,
        fechaMovimiento: fechaRealizacion,
        fechaIngreso: fechaRealizacion,
        fechaHoraProduccion: `${fechaRealizacion}T${new Date().toTimeString().slice(0, 5)}`,
        stockBolsas: currentBolsas,
        kgPorBolsa: currentKgB,
        stockKg: currentKgTot,
        estado: currentBolsas > 0 ? 'Disponible' : 'Agotado',
        ala: ala || currLote.ala,
        sector: sector || currLote.sector,
        ubicacionAcopio: ubicacionStr,
        observaciones: observaciones.trim()
          ? `${currLote.observaciones ? currLote.observaciones + ' | ' : ''}Mov realizado el ${fechaRealizacion}: ${observaciones.trim()}`
          : currLote.observaciones,
        historial: [movimientoStock, ...(currLote.historial || [])]
      };
    });

    if (targetLotes.length === 1) {
      onConfirm(updatedLotesList[0]);
    } else {
      onConfirm(updatedLotesList);
    }
  };

  const modalTitle = targetLotes.length === 1
    ? `MOV REALIZADO — Lote N° ${primaryLote.loteNro}`
    : `MOV REALIZADO — ${targetLotes.length} Lotes de Movimiento`;

  const modalSubtitle = targetLotes.length === 1
    ? `${primaryLote.cliente} — ${primaryLote.especie} (${primaryLote.variedad}) | Origen: ${primaryLote.loteOrigen || 'S/D'}`
    : `Lotes a efectivizar: ${targetLotes.map(l => l.loteNro).join(', ')}`;

  return (
    <ModalVentanaOperacion
      isOpen={isOpen}
      onClose={onClose}
      titulo={modalTitle}
      subtitulo={modalSubtitle}
      badgeText="MOV REALIZADO"
      icono={<CheckCircle2 className="w-6 h-6 text-white" />}
      maxWidth="max-w-2xl"
    >
      <div className="p-5 sm:p-6 space-y-5">
        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span className="font-medium">{errorMsg}</span>
          </div>
        )}

        {/* 1. SELECCIÓN DE FECHA EN LA QUE SE REALIZÓ EFECTIVAMENTE EL MOVIMIENTO */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-2 text-blue-950 font-black text-sm uppercase tracking-wide">
            <Calendar className="w-5 h-5 text-blue-600" />
            <span>Fijar Día Efectivo del Movimiento</span>
          </div>
          <p className="text-xs text-blue-800 mb-3">
            Indique manualmente la fecha en la que se ejecutó físicamente el movimiento precargado en la planta.
          </p>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <label className="text-xs font-bold text-slate-700 sm:w-44">
              Fecha de Realización <span className="text-red-500">*</span>:
            </label>
            <input
              type="date"
              id="input-fecha-realizacion-mov"
              value={fechaRealizacion}
              onChange={(e) => setFechaRealizacion(e.target.value)}
              className="px-3.5 py-2.5 bg-white border-2 border-blue-400 focus:border-blue-600 rounded-xl text-sm font-bold text-slate-900 shadow-xs focus:ring-2 focus:ring-blue-300 outline-none w-full sm:w-auto"
              required
            />
          </div>
        </div>

        {/* 2. DETALLE DEL MOVIMIENTO PRECARGADO */}
        {targetLotes.length === 1 ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <ArrowRightLeft className="w-4 h-4 text-blue-600" />
                <span>Datos del Movimiento Precargado</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-100 text-blue-800 border border-blue-200 font-mono">
                {primaryLote.tipoMovimiento || 'Movimiento'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Lote Creado</span>
                <span className="font-mono font-black text-slate-900 text-sm text-blue-700">
                  {primaryLote.loteNro}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Lote de Origen</span>
                <span className="font-mono font-black text-amber-800 text-sm">
                  {primaryLote.loteOrigen || 'S/D'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Cliente</span>
                <span className="font-bold text-slate-900 truncate block">
                  {primaryLote.cliente}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Especie / Variedad</span>
                <span className="font-semibold text-slate-800">
                  {primaryLote.especie} — {primaryLote.variedad}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Tipo de Lote</span>
                <span className="font-bold text-slate-800">
                  {primaryLote.tipo}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Tratamiento</span>
                <span className="font-bold text-slate-800">
                  {Array.isArray(primaryLote.tratamiento) ? primaryLote.tratamiento.join(', ') : primaryLote.tratamiento}
                </span>
              </div>
            </div>

            {primaryLote.productoAplicado && (
              <div className="pt-2 border-t border-slate-200/80 flex items-center gap-2 text-xs">
                <FlaskConical className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span className="text-slate-600 font-medium">Producto Aplicado:</span>
                <span className="font-bold text-purple-900 bg-purple-100 px-2 py-0.5 rounded border border-purple-200">
                  {primaryLote.productoAplicado}
                </span>
              </div>
            )}

            {/* Ajuste de Bolsas Realizadas */}
            <div className="pt-2 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Bolsas Realizadas:
                </label>
                <input
                  type="number"
                  min={1}
                  value={bolsasProducidas}
                  onChange={(e) => setBolsasProducidas(Number(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-500 block mb-1">Kg por Bolsa:</span>
                <span className="text-xs font-mono font-bold text-slate-800 block py-1.5">
                  {primaryLote.kgPorBolsa || 800} kg
                </span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-500 block mb-1">Stock Total Resultante:</span>
                <span className="text-xs font-mono font-black text-emerald-700 block py-1.5">
                  {formatKg(bolsasProducidas * (primaryLote.kgPorBolsa || 800))}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-48 overflow-y-auto">
            <span className="text-xs font-black uppercase text-slate-600 block mb-2">
              Lotes de movimiento a confirmar ({targetLotes.length}):
            </span>
            <div className="space-y-1.5">
              {targetLotes.map(l => (
                <div key={l.id} className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-blue-700">{l.loteNro}</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-600">Origen: {l.loteOrigen || 'S/D'}</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-700 font-medium">{l.cliente} ({l.variedad})</span>
                  </div>
                  <div className="font-mono font-bold text-slate-800">
                    {l.stockBolsas} bss ({formatKg(l.stockKg || l.stockBolsas * (l.kgPorBolsa || 800))})
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. UBICACIÓN FÍSICA (OPCIONAL) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3.5 rounded-xl border border-slate-200 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-slate-500" /> Ala de Almacenamiento:
            </label>
            <input
              type="text"
              value={ala}
              onChange={(e) => setAla(e.target.value.toUpperCase())}
              placeholder="Ej: A, B, C..."
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold"
            />
          </div>
          <div>
            <label className="font-bold text-slate-700 block mb-1 flex items-center gap-1">
              Sector:
            </label>
            <input
              type="text"
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              placeholder="Ej: 1, 2, 3..."
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold"
            />
          </div>
        </div>

        {/* Observaciones */}
        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">
            Observaciones del Movimiento (opcional):
          </label>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            rows={2}
            placeholder="Notas sobre la ejecución del movimiento..."
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white outline-none resize-none"
          />
        </div>
      </div>

      {/* FOOTER */}
      <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="button"
          id="btn-confirmar-mov-realizado"
          onClick={handleConfirm}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl shadow-md transition cursor-pointer flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 text-white" />
          <span>CONFIRMAR MOV REALIZADO</span>
        </button>
      </div>
    </ModalVentanaOperacion>
  );
};
