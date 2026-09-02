/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Lote, OrdenProceso, TratamientoType, MovimientoStock } from '../types';
import { formatNumberArg, formatKg } from '../utils/formatters';
import {
  FlaskConical,
  X,
  Calendar,
  FileText,
  Boxes,
  Scale,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Layers,
  Sparkles
} from 'lucide-react';
import { ModalVentanaOperacion } from './ModalVentanaOperacion';

interface TratarLoteModalProps {
  isOpen?: boolean;
  lote: Lote;
  allLotes: Lote[];
  ordenesProceso?: OrdenProceso[];
  onClose: () => void;
  onConfirmTratamiento: (params: {
    loteOriginal: Lote;
    bolsasACurar: number;
    fechaTratamiento: string;
    numeroOrdenMovimiento: string;
    productoQuimico: string;
    loteExistenteT?: Lote;
  }) => void;
}

export const TratarLoteModal: React.FC<TratarLoteModalProps> = ({
  isOpen = true,
  lote,
  allLotes,
  ordenesProceso = [],
  onClose,
  onConfirmTratamiento
}) => {
  // 1. Estado para el formulario de curado
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [fechaTratamiento, setFechaTratamiento] = useState<string>(todayStr);
  const [bolsasACurar, setBolsasACurar] = useState<number>(lote.stockBolsas || 1);
  const [numeroOrdenMovimiento, setNumeroOrdenMovimiento] = useState<string>('');
  const [productoQuimico, setProductoQuimico] = useState<string>(lote.producto || 'Maxim Quattro + Inoculante');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // 2. Verificar si ya existe un lote "T" generado previamente
  const nombreLoteT = `${lote.loteNro}T`;
  const loteExistenteT = useMemo(() => {
    return allLotes.find(l => 
      l.cliente?.toLowerCase() === lote.cliente?.toLowerCase() &&
      (l.loteNro?.toUpperCase() === nombreLoteT.toUpperCase() ||
       l.loteNro?.toUpperCase() === `${lote.loteNro}-T`.toUpperCase())
    );
  }, [allLotes, lote, nombreLoteT]);

  // 3. Órdenes de movimiento disponibles
  const ordenesMovimientoDisponibles = useMemo(() => {
    return ordenesProceso.filter(o => o.tipoOrden === 'MOVIMIENTO');
  }, [ordenesProceso]);

  // Cálculos derivados
  const maxBolsas = lote.stockBolsas || 0;
  const kgACurar = bolsasACurar * (lote.kgPorBolsa || 800);
  const bolsasRestantes = Math.max(0, maxBolsas - bolsasACurar);
  const esCuradoTotal = bolsasACurar >= maxBolsas;

  // Manejador de confirmación
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!fechaTratamiento) {
      setErrorMsg('Debe seleccionar la fecha de tratamiento.');
      return;
    }

    if (!numeroOrdenMovimiento.trim()) {
      setErrorMsg('Debe ingresar o seleccionar la Orden de Movimiento vinculada.');
      return;
    }

    if (bolsasACurar <= 0 || bolsasACurar > maxBolsas) {
      setErrorMsg(`La cantidad de bolsas a curar debe ser entre 1 y ${maxBolsas}.`);
      return;
    }

    onConfirmTratamiento({
      loteOriginal: lote,
      bolsasACurar,
      fechaTratamiento,
      numeroOrdenMovimiento: numeroOrdenMovimiento.trim(),
      productoQuimico: productoQuimico.trim(),
      loteExistenteT
    });
  };

  return (
    <ModalVentanaOperacion
      isOpen={isOpen}
      onClose={onClose}
      title={`Curar Semilla: Lote ${lote.loteNro}`}
      subtitle="Tratamiento de Semilla y Generación de Lote T"
      icon={FlaskConical}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {/* Alerta informativa de estado existente de Lote T */}
          {loteExistenteT ? (
            <div className="bg-amber-50 border border-amber-300/80 p-3.5 rounded-xl text-xs text-amber-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Ya existe el Lote Tratado "{loteExistenteT.loteNro}"</span>
              </div>
              <p className="text-[11px] text-amber-800/90 leading-relaxed">
                Este curado descontará <strong>{bolsasACurar} bolsas</strong> del lote sin tratar ({lote.loteNro}) mediante un egreso por Orden de Movimiento e ingresará automáticamente las bolsas en el lote tratado existente <strong>{loteExistenteT.loteNro}</strong>.
              </p>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl text-xs text-emerald-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-[#00603C]">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Primer Curado — Generación de Lote "{nombreLoteT}"</span>
              </div>
              <p className="text-[11px] text-emerald-800/90 leading-relaxed">
                {esCuradoTotal ? (
                  <>El curado total renombrará el lote a <strong>"{nombreLoteT}"</strong> con estado <strong>Tratado</strong>.</>
                ) : (
                  <>Se creará automáticamente el lote tratado <strong>"{nombreLoteT}"</strong> con <strong>{bolsasACurar} bolsas</strong>. Las <strong>{bolsasRestantes} bolsas</strong> no curadas permanecerán en el lote original <strong>"{lote.loteNro}"</strong>.</>
                )}
              </p>
            </div>
          )}

          {/* Fila 1: Resumen del Lote Base */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-mono">
            <div>
              <span className="text-[9px] font-sans font-bold text-slate-400 uppercase block">Cliente</span>
              <span className="font-bold text-slate-800 truncate block">{lote.cliente}</span>
            </div>
            <div>
              <span className="text-[9px] font-sans font-bold text-slate-400 uppercase block">Especie/Var.</span>
              <span className="font-bold text-slate-800 truncate block">{lote.especie} {lote.variedad}</span>
            </div>
            <div>
              <span className="text-[9px] font-sans font-bold text-slate-400 uppercase block">Stock Disponible</span>
              <span className="font-black text-[#00603C] block">{lote.stockBolsas} b. ({formatKg(lote.stockKg)})</span>
            </div>
            <div>
              <span className="text-[9px] font-sans font-bold text-slate-400 uppercase block">Kg / Bolsa</span>
              <span className="font-bold text-slate-700 block">{lote.kgPorBolsa} kg</span>
            </div>
          </div>

          {/* Fila 2: Cantidad de Bolsas a Curar */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Boxes className="w-4 h-4 text-[#00603C]" />
                Bolsas a Curar / Tratar *
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                Máximo: {maxBolsas} b.
              </span>
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max={maxBolsas}
                value={bolsasACurar}
                onChange={(e) => setBolsasACurar(Math.min(maxBolsas, Math.max(1, Number(e.target.value) || 0)))}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-mono text-base font-black text-slate-900 focus:ring-2 focus:ring-[#00603C]"
                required
              />
              <button
                type="button"
                onClick={() => setBolsasACurar(maxBolsas)}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer shrink-0"
              >
                Curar Todo ({maxBolsas} b)
              </button>
            </div>
            <p className="text-[11px] text-slate-500 font-mono">
              Equivale a <strong className="text-[#00603C] font-black">{formatNumberArg(kgACurar, 0)} kg</strong> a tratar.
            </p>
          </div>

          {/* Fila 3: Fecha de Tratamiento & Orden de Movimiento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Fecha de Tratamiento */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#00603C]" />
                Fecha de Tratamiento *
              </label>
              <input
                type="date"
                value={fechaTratamiento}
                onChange={(e) => setFechaTratamiento(e.target.value)}
                required
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#00603C]"
              />
            </div>

            {/* Orden de Movimiento */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-[#C9922E]" />
                Orden de Movimiento *
              </label>

              {ordenesMovimientoDisponibles.length > 0 ? (
                <div className="space-y-1.5">
                  <select
                    value={numeroOrdenMovimiento}
                    onChange={(e) => setNumeroOrdenMovimiento(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#00603C]"
                  >
                    <option value="">-- Seleccionar o escribir --</option>
                    {ordenesMovimientoDisponibles.map(om => (
                      <option key={om.id} value={om.numeroOrdenMovimiento || `OM-${om.numeroOrden}`}>
                        {om.numeroOrdenMovimiento || `OM-${om.numeroOrden}`} - {om.tratamiento || 'Movimiento Semilla'}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="O escribir N° Orden Movimiento..."
                    value={numeroOrdenMovimiento}
                    onChange={(e) => setNumeroOrdenMovimiento(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800"
                  />
                </div>
              ) : (
                <input
                  type="text"
                  placeholder="Ej: OM-2026-001"
                  value={numeroOrdenMovimiento}
                  onChange={(e) => setNumeroOrdenMovimiento(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#00603C]"
                />
              )}
            </div>

          </div>

          {/* Fila 4: Producto Químico / Principio Activo */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Producto Aplicado / Principio Activo
            </label>
            <input
              type="text"
              placeholder="Ej: Maxim Quattro + Inoculante Rizoflo"
              value={productoQuimico}
              onChange={(e) => setProductoQuimico(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-[#00603C]"
            />
          </div>

          {/* Mensaje de Error */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Botones de Acción */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase rounded-xl transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 bg-[#00603C] hover:bg-[#004D30] text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg transition cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              <span>Confirmar Curado</span>
            </button>
          </div>

        </form>
    </ModalVentanaOperacion>
  );
};
