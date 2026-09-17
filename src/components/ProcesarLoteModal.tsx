/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Lote, SiloId, SiloExtraccion, MovimientoSilo, LoteLimitsConfig, EstadoRegistroLote, MovimientoStock } from '../types';
import { formatKg } from '../utils/formatters';
import { getLoteLimits } from '../utils/loteLimits';
import { ModalVentanaOperacion } from './ModalVentanaOperacion';
import { Check, CheckCircle2, Play, AlertTriangle, Building2 } from 'lucide-react';

const SILOS_DISPONIBLES: string[] = ['Silo 1', 'Silo 2', 'Silo 3', 'Silo 4', 'Silo 5', 'Silo 6', 'Sin Silo'];

interface ProcesarLoteModalProps {
  isOpen: boolean;
  lote: Lote | null;
  lotesToProcess?: Lote[];
  siloStocks?: Record<SiloId, number>;
  movimientosSilo?: MovimientoSilo[];
  bolsones?: any[];
  loteLimits?: LoteLimitsConfig;
  onConfirm: (lotesActualizados: Lote | Lote[]) => void;
  onClose: () => void;
}

export const ProcesarLoteModal: React.FC<ProcesarLoteModalProps> = ({
  isOpen,
  lote,
  lotesToProcess = [],
  loteLimits,
  onConfirm,
  onClose,
}) => {
  if (!isOpen || (!lote && lotesToProcess.length === 0)) return null;

  const targetLotes = lotesToProcess.length > 0 ? lotesToProcess : (lote ? [lote] : []);
  const primaryLote = targetLotes[0];

  const activeLimits = loteLimits || getLoteLimits();

  // Estados del modal
  const [estadoResultado, setEstadoResultado] = useState<EstadoRegistroLote>('REALIZADO');
  const [fechaRealizacion, setFechaRealizacion] = useState(() => new Date().toISOString().split('T')[0]);

  const [bolsasProducidas, setBolsasProducidas] = useState<number>(primaryLote.stockBolsas || 35);
  const [kgPorBolsa, setKgPorBolsa] = useState<number>(primaryLote.kgPorBolsa || activeLimits.kgPorBolsaDefault);
  const [kgTotales, setKgTotales] = useState<number>((primaryLote.stockBolsas || 35) * (primaryLote.kgPorBolsa || activeLimits.kgPorBolsaDefault));
  const [pesoDeMil, setPesoDeMil] = useState<string>(() => (primaryLote.pesoDeMil !== undefined && primaryLote.pesoDeMil !== null ? String(primaryLote.pesoDeMil) : ''));

  // Silo de origen informativo (sin afectar stock ni requerir kg extraídos)
  const [siloSeleccionado, setSiloSeleccionado] = useState<string>(() => {
    return primaryLote.siloOrigen || (primaryLote.silosOrigen && primaryLote.silosOrigen[0]?.siloId) || 'Silo 1';
  });

  const [ala, setAla] = useState(primaryLote.ala || 'A');
  const [sector, setSector] = useState(primaryLote.sector || '1');
  const [observaciones, setObservaciones] = useState(primaryLote.observaciones || '');
  const [errorMsg, setErrorMsg] = useState('');

  // Sincronizar kgTotales cuando cambien bolsasProducidas o kgPorBolsa
  useEffect(() => {
    const b = isNaN(bolsasProducidas) ? 0 : bolsasProducidas;
    const kgB = isNaN(kgPorBolsa) ? activeLimits.kgPorBolsaDefault : kgPorBolsa;
    setKgTotales(b * kgB);
  }, [bolsasProducidas, kgPorBolsa, activeLimits]);

  // Sincronizar campos cuando cambie el lote objetivo
  useEffect(() => {
    if (primaryLote) {
      const now = new Date();
      setFechaRealizacion(now.toISOString().split('T')[0]);
      const bProd = primaryLote.stockBolsas || 35;
      const kgB = primaryLote.kgPorBolsa || activeLimits.kgPorBolsaDefault;
      setBolsasProducidas(bProd);
      setKgPorBolsa(kgB);
      setKgTotales(bProd * kgB);
      setSiloSeleccionado(primaryLote.siloOrigen || (primaryLote.silosOrigen && primaryLote.silosOrigen[0]?.siloId) || 'Silo 1');
      setAla(primaryLote.ala || 'A');
      setSector(primaryLote.sector || '1');
      setObservaciones(primaryLote.observaciones || '');
      setPesoDeMil(primaryLote.pesoDeMil !== undefined && primaryLote.pesoDeMil !== null ? String(primaryLote.pesoDeMil) : '');
    }
  }, [primaryLote, activeLimits]);

  // Submit guardar / confirmar
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!fechaRealizacion) {
      setErrorMsg('Debe ingresar la fecha de realización.');
      return;
    }

    const fechaHoraStr = fechaRealizacion;

    // Peso de mil manual (cantidad determinada de gramos)
    const cleanedPeso = pesoDeMil.trim().replace(',', '.');
    const numPesoDeMil = cleanedPeso !== '' && !isNaN(Number(cleanedPeso)) ? Number(cleanedPeso) : undefined;

    // Silo de origen como dato descriptivo/informativo sin afectar stock
    const finalSiloOrigen = (siloSeleccionado && siloSeleccionado !== 'Sin Silo') ? siloSeleccionado.trim() : '';
    const silosOrigenFinal: SiloExtraccion[] = finalSiloOrigen
      ? [{ siloId: finalSiloOrigen as SiloId, kgExtraidos: 0, kg: 0 }]
      : [];

    const ubicacionStr = ala && sector ? `Ala ${ala} - Sector ${sector}` : (ala || sector || primaryLote.ubicacionAcopio || 'Sin asignar');

    const updatedLotesList: Lote[] = targetLotes.map(currLote => {
      const currentBolsas = targetLotes.length === 1 ? bolsasProducidas : (currLote.stockBolsas || 35);
      const currentKgB = targetLotes.length === 1 ? kgPorBolsa : (currLote.kgPorBolsa || activeLimits.kgPorBolsaDefault);
      const currentKgTot = targetLotes.length === 1 ? kgTotales : (currentBolsas * currentKgB);

      const detalleOrigen = finalSiloOrigen ? ` (Silo: ${finalSiloOrigen})` : '';

      const movimientoRealizacion: MovimientoStock = {
        id: `MOV-PROC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        fecha: fechaRealizacion,
        tipo: 'Alta',
        cantidadBolsas: currentBolsas,
        kgPorBolsa: currentKgB,
        cantidadKg: currentKgTot,
        detalle: `Alta por Pase a ${estadoResultado}${detalleOrigen} - ${fechaHoraStr}`
      };

      // Limpiar movimientos de precarga previos o altas iniciales para no duplicar el alta de bolsas ni el stock
      const historialSinPrecarga = (currLote.historial || []).filter(mov => {
        const idLower = (mov.id || '').toLowerCase();
        const detLower = (mov.detalle || '').toLowerCase();
        const tipoLower = (mov.tipo || '').toLowerCase();
        const isPrecargaOrOldAlta =
          idLower.startsWith('mov-pre') ||
          idLower.startsWith('mov-proc') ||
          idLower.startsWith('alta-inicial') ||
          idLower.startsWith('alta-precarga') ||
          tipoLower.includes('precarga') ||
          detLower.includes('precarga') ||
          detLower.includes('pre-carga') ||
          detLower.includes('carga inicial') ||
          detLower.includes('alta inicial') ||
          detLower.includes('pase a');
        return !isPrecargaOrOldAlta;
      });

      const nuevoHistorial = [movimientoRealizacion, ...historialSinPrecarga];

      return {
        ...currLote,
        estadoRegistro: estadoResultado,
        fechaHoraProduccion: fechaHoraStr,
        fechaIngreso: fechaRealizacion,
        stockBolsas: currentBolsas,
        kgPorBolsa: currentKgB,
        stockKg: currentKgTot,
        estado: currentBolsas > 0 ? 'Disponible' : 'Agotado',
        pesoDeMil: numPesoDeMil !== undefined ? numPesoDeMil : currLote.pesoDeMil,
        siloOrigen: finalSiloOrigen || currLote.siloOrigen,
        silosOrigen: silosOrigenFinal.length > 0 ? silosOrigenFinal : (currLote.silosOrigen || []),
        ala,
        sector,
        ubicacionAcopio: ubicacionStr,
        observaciones: observaciones.trim() || currLote.observaciones,
        historial: nuevoHistorial
      };
    });

    if (targetLotes.length === 1) {
      onConfirm(updatedLotesList[0]);
    } else {
      onConfirm(updatedLotesList);
    }
  };

  const modalTitle = targetLotes.length === 1
    ? `Pasar Lote N° ${primaryLote.loteNro} a Realizado`
    : `Pasar ${targetLotes.length} Lotes a Realizado`;

  const modalSubtitle = targetLotes.length === 1
    ? `${primaryLote.cliente} — ${primaryLote.especie} (${primaryLote.variedad})`
    : `Lotes seleccionados: ${targetLotes.map(l => l.loteNro).join(', ')}`;

  return (
    <ModalVentanaOperacion
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      subtitle={modalSubtitle}
      icon={CheckCircle2}
      maxWidth="max-w-4xl"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-6">

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3.5 rounded-xl flex items-center gap-2.5">
            <AlertTriangle className="w-4.5 h-4.5 text-red-500 shrink-0" />
            <span className="font-bold">{errorMsg}</span>
          </div>
        )}

        {/* 1. Estado del Registro Destino */}
        <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-700 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400 block font-sans">
            1. Estado de Registro Destino *
          </span>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setEstadoResultado('REALIZADO')}
              className={`py-3 px-4 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition cursor-pointer ${
                estadoResultado === 'REALIZADO'
                  ? 'bg-emerald-600 text-white border-emerald-400 shadow-lg font-extrabold'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-300" />
              <span>REALIZADO (Completo)</span>
              <span className="text-[10px] font-normal opacity-80">Lote finalizado para inventario activo</span>
            </button>

            <button
              type="button"
              onClick={() => setEstadoResultado('EN_CURSO')}
              className={`py-3 px-4 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition cursor-pointer ${
                estadoResultado === 'EN_CURSO'
                  ? 'bg-amber-600 text-white border-amber-400 shadow-lg font-extrabold'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <Play className="w-5 h-5 text-amber-300" />
              <span>EN CURSO (Parcial)</span>
              <span className="text-[10px] font-normal opacity-80">Mantiene lote abierto para producción</span>
            </button>
          </div>
        </div>

        {/* 2. Fecha de Realización */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1 font-sans">
              Fecha de Realización *
            </label>
            <input
              type="date"
              value={fechaRealizacion}
              onChange={(e) => setFechaRealizacion(e.target.value)}
              required
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* 3. Selector de Silo de Origen (Informativo, sin afectar stock ni pedir kg extraídos) */}
        <div className="bg-amber-50/60 border border-amber-200/90 p-5 rounded-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/80 pb-3">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-[#00603C] flex items-center gap-2 font-sans">
                <Building2 className="w-4 h-4 text-[#C9922E]" />
                3. Silo de Origen
              </span>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Seleccione el silo de procedencia. Solo se registra este dato como procedencia del lote sin afectar el stock del silo ni requerir kg extraídos.
              </p>
            </div>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wider font-sans shrink-0">
              Sin Afectar Stock
            </span>
          </div>

          {/* Botones de selección rápida de Silo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
            {SILOS_DISPONIBLES.map((siloOpt) => {
              const isSelected = siloSeleccionado === siloOpt || (siloOpt === 'Sin Silo' && !siloSeleccionado);
              return (
                <button
                  key={siloOpt}
                  type="button"
                  onClick={() => setSiloSeleccionado(siloOpt === 'Sin Silo' ? '' : siloOpt)}
                  className={`p-3 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-[#00603C] text-white border-[#00603C] shadow-md font-extrabold ring-2 ring-[#C9922E]'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50/50 hover:border-emerald-300'
                  }`}
                >
                  <Building2 className={`w-4 h-4 ${isSelected ? 'text-[#C9922E]' : 'text-slate-400'}`} />
                  <span className="font-sans text-xs">{siloOpt}</span>
                </button>
              );
            })}
          </div>

          {/* Menú desplegable alternativo */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 font-sans">
              Silo Asignado:
            </label>
            <select
              value={siloSeleccionado || ''}
              onChange={(e) => setSiloSeleccionado(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#00603C] outline-none"
            >
              <option value="">Sin especificar / Ninguno</option>
              <option value="Silo 1">Silo 1</option>
              <option value="Silo 2">Silo 2</option>
              <option value="Silo 3">Silo 3</option>
              <option value="Silo 4">Silo 4</option>
              <option value="Silo 5">Silo 5</option>
              <option value="Silo 6">Silo 6</option>
            </select>
          </div>
        </div>

        {/* 4. Producción y Calidad (Aplica para lote individual) */}
        {targetLotes.length === 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1 font-sans">
                Stock Bolsas Producidas *
              </label>
              <input
                type="number"
                min="0"
                value={bolsasProducidas}
                onChange={(e) => setBolsasProducidas(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1 font-sans">
                Kg por Bolsa
              </label>
              <input
                type="number"
                min="1"
                value={kgPorBolsa}
                onChange={(e) => setKgPorBolsa(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1 font-sans">
                Stock Total Calculado
              </label>
              <div className="px-3 py-2 bg-emerald-100 border border-emerald-300 rounded-xl text-xs font-bold font-mono text-emerald-900">
                {formatKg(kgTotales)}
              </div>
            </div>

            {/* Celda: Peso de mil (dato a mano que refleja gramos) */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1 font-sans flex items-center justify-between">
                <span>Peso de mil</span>
                <span className="text-[10px] text-emerald-700 font-bold font-mono uppercase">Gramos (g)</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Ej: 165.4"
                  value={pesoDeMil}
                  onChange={(e) => setPesoDeMil(e.target.value)}
                  className="w-full px-3 py-2 pr-8 bg-white border-2 border-emerald-500/60 rounded-xl text-xs font-bold font-mono text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 shadow-2xs"
                  title="Peso de mil semillas en gramos (ingreso manual)"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                  g
                </span>
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Refleja cantidad de gramos (PMS)
              </span>
            </div>
          </div>
        )}

        {/* Peso de mil para lote múltiple si se procesan varios */}
        {targetLotes.length > 1 && (
          <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 font-sans">
                Peso de mil (g) para los {targetLotes.length} lotes:
              </label>
              <span className="text-[11px] text-slate-500">
                Dato manual que refleja una cantidad determinada de gramos (PMS) para los lotes seleccionados.
              </span>
            </div>
            <div className="relative w-full sm:w-48 shrink-0">
              <input
                type="text"
                inputMode="decimal"
                placeholder="Ej: 165.4"
                value={pesoDeMil}
                onChange={(e) => setPesoDeMil(e.target.value)}
                className="w-full px-3 py-2 pr-8 bg-white border-2 border-emerald-500/60 rounded-xl text-xs font-bold font-mono text-slate-900 focus:ring-2 focus:ring-emerald-600 shadow-2xs"
                title="Peso de mil semillas en gramos (ingreso manual)"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                g
              </span>
            </div>
          </div>
        )}

        {/* 5. Ubicación Acopio y Observaciones */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1 font-sans">
              Ala de Acopio
            </label>
            <select
              value={ala}
              onChange={(e) => setAla(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
            >
              <option value="A">Ala A</option>
              <option value="B">Ala B</option>
              <option value="C">Ala C</option>
              <option value="D">Ala D</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1 font-sans">
              Sector de Acopio
            </label>
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
            >
              <option value="1">Sector 1</option>
              <option value="2">Sector 2</option>
              <option value="3">Sector 3</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1 font-sans">
            Observaciones
          </label>
          <textarea
            rows={2}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Notas u observaciones de realización..."
            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800"
          />
        </div>

        {/* Botones de acción */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-2.5 bg-[#00603C] hover:bg-[#254731] text-white rounded-xl text-xs font-extrabold uppercase tracking-wider shadow-md transition cursor-pointer"
          >
            <Check className="w-4 h-4 text-amber-300" />
            <span>Confirmar Pasaje a {estadoResultado}</span>
          </button>
        </div>
      </form>
    </ModalVentanaOperacion>
  );
};


