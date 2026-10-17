/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Lote,
  EnvaseEspecificacion,
  CategoriaEspecificacion,
  TipoLoteEspecificacion,
  TratamientoEspecificacion,
  EstadoRegistroLoteEspec
} from '../types';
import { formatKg } from '../utils/formatters';
import { getKilajeEnvase, normalizarEnvase, normalizarCategoria, normalizarTipo, normalizarTratamiento } from '../utils/loteEspecUtils';
import {
  X,
  Scissors,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Scale,
  Sparkles,
  Layers,
  ArrowRight
} from 'lucide-react';

export interface HijoDesdobleDraft {
  id: string;
  subCodigo: string; // ej. "-A", "-B"
  codigoCompleto: string; // ej. "0153-A"
  cantidadBolsas: number;
  envase: EnvaseEspecificacion;
  categoria: CategoriaEspecificacion;
  tipo: TipoLoteEspecificacion;
  tratamiento: TratamientoEspecificacion;
  estado: EstadoRegistroLoteEspec;
}

interface DesdoblarLoteModalProps {
  isOpen: boolean;
  lote: Lote;
  currentUser: { nombre: string; rol: string };
  onClose: () => void;
  onConfirmDesdoble: (hijos: HijoDesdobleDraft[]) => Promise<void> | void;
}

const LETRAS_SUBCODIGO = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export const DesdoblarLoteModal: React.FC<DesdoblarLoteModalProps> = ({
  isOpen,
  lote,
  currentUser,
  onClose,
  onConfirmDesdoble,
}) => {
  if (!isOpen) return null;

  const codigoPadre = (lote.codigo || lote.loteNro || lote.id || 'LOTE').trim();
  const kgPadre = Number(lote.kg) || Number(lote.stockKg) || ((Number(lote.cantidadBolsas) || Number(lote.stockBolsas) || 0) * getKilajeEnvase(lote.envase || lote.kgPorBolsa));
  const envasePadre = normalizarEnvase(lote.envase || lote.kgPorBolsa);
  const catPadre = normalizarCategoria(lote.categoria);
  const tipoPadre = normalizarTipo(lote.tipo);
  const tratPadre = normalizarTratamiento(lote.tratamiento);

  // Inicializar con 2 hijos por defecto que dividan equitativamente el lote si es posible
  const [hijos, setHijos] = useState<HijoDesdobleDraft[]>(() => {
    const bolsasTotales = Number(lote.cantidadBolsas) || Number(lote.stockBolsas) || 0;
    const b1 = Math.floor(bolsasTotales / 2);
    const b2 = bolsasTotales - b1;

    return [
      {
        id: `hijo-1-${Date.now()}`,
        subCodigo: 'A',
        codigoCompleto: `${codigoPadre}-A`,
        cantidadBolsas: b1 > 0 ? b1 : 1,
        envase: envasePadre,
        categoria: catPadre,
        tipo: tipoPadre,
        tratamiento: 'curado', // Ejemplo clásico: curar parte del lote
        estado: 'clasificado',
      },
      {
        id: `hijo-2-${Date.now()}`,
        subCodigo: 'B',
        codigoCompleto: `${codigoPadre}-B`,
        cantidadBolsas: b2 > 0 ? b2 : 1,
        envase: envasePadre,
        categoria: catPadre,
        tipo: tipoPadre,
        tratamiento: tratPadre,
        estado: 'clasificado',
      },
    ];
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Cálculo de kg por hijo
  const getKgHijo = (h: HijoDesdobleDraft): number => {
    return h.cantidadBolsas * getKilajeEnvase(h.envase);
  };

  const sumaKgHijos = hijos.reduce((acc, h) => acc + getKgHijo(h), 0);
  const diferenciaKg = sumaKgHijos - kgPadre;
  const esSumaExacta = diferenciaKg === 0;

  const handleAddHijo = () => {
    const nextIdx = hijos.length;
    const letter = LETRAS_SUBCODIGO[nextIdx] || `H${nextIdx + 1}`;
    setHijos(prev => [
      ...prev,
      {
        id: `hijo-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        subCodigo: letter,
        codigoCompleto: `${codigoPadre}-${letter}`,
        cantidadBolsas: 1,
        envase: envasePadre,
        categoria: catPadre,
        tipo: tipoPadre,
        tratamiento: tratPadre,
        estado: 'clasificado',
      }
    ]);
  };

  const handleRemoveHijo = (id: string) => {
    if (hijos.length <= 2) {
      setErrorMsg('El desdoblamiento requiere al menos 2 lotes hijos.');
      return;
    }
    setHijos(prev => prev.filter(h => h.id !== id));
  };

  const handleUpdateHijo = (id: string, field: keyof HijoDesdobleDraft, value: any) => {
    setHijos(prev =>
      prev.map(h => {
        if (h.id !== id) return h;
        const updated = { ...h, [field]: value };
        if (field === 'subCodigo') {
          updated.codigoCompleto = `${codigoPadre}-${value}`;
        }
        return updated;
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (hijos.length < 2) {
      setErrorMsg('Debe definir al menos 2 lotes hijos para desdoblar.');
      return;
    }

    for (let i = 0; i < hijos.length; i++) {
      const h = hijos[i];
      if (h.cantidadBolsas <= 0) {
        setErrorMsg(`El lote hijo ${h.codigoCompleto} debe tener al menos 1 bolsa.`);
        return;
      }
      const kg = getKgHijo(h);
      if (kg > 28000) {
        setErrorMsg(`El lote hijo ${h.codigoCompleto} supera el máximo de 28.000 kg (${formatKg(kg)}).`);
        return;
      }
    }

    if (!esSumaExacta) {
      setErrorMsg(
        `Regla de negocio estricta: La suma de kg de los hijos (${formatKg(sumaKgHijos)}) debe ser EXACTAMENTE igual a los kg del padre (${formatKg(kgPadre)}). Diferencia: ${formatKg(diferenciaKg)}.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirmDesdoble(hijos);
      onClose();
    } catch (err: any) {
      console.error('Error desdoblando lote:', err);
      setErrorMsg(err.message || 'Error al ejecutar desdoblamiento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full border border-gray-100 overflow-hidden my-6">
        
        {/* Encabezado */}
        <div className="bg-gradient-to-r from-emerald-950 via-[#00603C] to-slate-900 text-white p-6 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-400/20 text-amber-300 rounded-2xl border border-amber-400/30">
              <Scissors className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-300">
                Operación de Lote · Desdoblamiento Recursivo
              </span>
              <h3 className="font-serif text-xl sm:text-2xl font-bold mt-0.5">
                Desdoblar Lote #{codigoPadre}
              </h3>
              <p className="text-xs text-emerald-100 mt-1">
                Divida el lote en N hijos en bolsas completas. La suma debe ser exactamente igual a {formatKg(kgPadre)}.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Resumen del Lote Padre */}
        <div className="bg-slate-50 border-b border-slate-200 p-4 sm:px-6 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <span className="text-gray-500 text-[10px] uppercase font-bold block">Cliente</span>
              <span className="font-bold text-gray-900">{lote.cliente}</span>
            </div>
            <div>
              <span className="text-gray-500 text-[10px] uppercase font-bold block">Especie / Variedad</span>
              <span className="font-bold text-gray-900">{lote.especie} · {lote.variedad}</span>
            </div>
            <div>
              <span className="text-gray-500 text-[10px] uppercase font-bold block">Envase Origen</span>
              <span className="font-mono font-bold text-gray-900">{envasePadre}</span>
            </div>
            <div>
              <span className="text-gray-500 text-[10px] uppercase font-bold block">Bolsas Totales</span>
              <span className="font-mono font-bold text-gray-900">{lote.cantidadBolsas || lote.stockBolsas} b.</span>
            </div>
          </div>

          <div className="bg-emerald-900 text-white px-4 py-2 rounded-xl text-right">
            <span className="text-[10px] uppercase font-bold text-emerald-200 block">Kilos del Padre</span>
            <span className="font-mono text-base font-black text-amber-300">{formatKg(kgPadre)}</span>
          </div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">

          {errorMsg && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Listado de hijos */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-serif text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#00603C]" />
                <span>Lotes Hijos a Generar ({hijos.length})</span>
              </h4>
              <button
                type="button"
                onClick={handleAddHijo}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-[#00603C] border border-[#00603C]/30 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-amber-500" />
                <span>+ Agregar Hijo</span>
              </button>
            </div>

            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {hijos.map((hijo, idx) => {
                const kgEsteHijo = getKgHijo(hijo);
                return (
                  <div
                    key={hijo.id}
                    className="p-4 bg-white rounded-2xl border border-gray-200 shadow-2xs space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-[#00603C] text-white flex items-center justify-center text-xs font-black">
                          #{idx + 1}
                        </span>
                        <input
                          type="text"
                          value={hijo.codigoCompleto}
                          onChange={(e) => handleUpdateHijo(hijo.id, 'codigoCompleto', e.target.value)}
                          className="font-mono font-black text-sm px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-gray-900 focus:bg-white"
                        />
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-mono font-black text-sm text-[#00603C]">
                          {formatKg(kgEsteHijo)}
                        </span>
                        {hijos.length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveHijo(hijo.id)}
                            className="text-red-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition cursor-pointer"
                            title="Eliminar este hijo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 text-xs">
                      {/* Cantidad de bolsas */}
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">
                          Cantidad Bolsas *
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="1400"
                          value={hijo.cantidadBolsas}
                          onChange={(e) => handleUpdateHijo(hijo.id, 'cantidadBolsas', Math.max(1, Number(e.target.value)))}
                          className="w-full px-2.5 py-1.5 font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg text-gray-900 focus:bg-white"
                        />
                      </div>

                      {/* Envase */}
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">
                          Envase *
                        </label>
                        <select
                          value={hijo.envase}
                          onChange={(e) => handleUpdateHijo(hijo.id, 'envase', e.target.value as EnvaseEspecificacion)}
                          className="w-full px-2.5 py-1.5 font-bold bg-slate-50 border border-slate-200 rounded-lg text-gray-900 focus:bg-white"
                        >
                          <option value="x 800 kg">x 800 kg</option>
                          <option value="x 25 kg">x 25 kg</option>
                          <option value="x 20 kg">x 20 kg</option>
                        </select>
                      </div>

                      {/* Tratamiento */}
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">
                          Tratamiento *
                        </label>
                        <select
                          value={hijo.tratamiento}
                          onChange={(e) => handleUpdateHijo(hijo.id, 'tratamiento', e.target.value as TratamientoEspecificacion)}
                          className="w-full px-2.5 py-1.5 font-bold bg-slate-50 border border-slate-200 rounded-lg text-gray-900 focus:bg-white"
                        >
                          <option value="crudo">crudo (Sin tratar)</option>
                          <option value="curado">curado (Tratado)</option>
                        </select>
                      </div>

                      {/* Categoría */}
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">
                          Categoría *
                        </label>
                        <select
                          value={hijo.categoria}
                          onChange={(e) => handleUpdateHijo(hijo.id, 'categoria', e.target.value as CategoriaEspecificacion)}
                          className="w-full px-2.5 py-1.5 font-bold bg-slate-50 border border-slate-200 rounded-lg text-gray-900 focus:bg-white"
                        >
                          <option value="preba">preba</option>
                          <option value="original">original</option>
                          <option value="primu">primu</option>
                        </select>
                      </div>

                      {/* Tipo */}
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">
                          Tipo *
                        </label>
                        <select
                          value={hijo.tipo}
                          onChange={(e) => handleUpdateHijo(hijo.id, 'tipo', e.target.value as TipoLoteEspecificacion)}
                          className="w-full px-2.5 py-1.5 font-bold bg-slate-50 border border-slate-200 rounded-lg text-gray-900 focus:bg-white"
                        >
                          <option value="intermedio">intermedio</option>
                          <option value="final">final</option>
                        </select>
                      </div>

                      {/* Estado */}
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">
                          Estado *
                        </label>
                        <select
                          value={hijo.estado}
                          onChange={(e) => handleUpdateHijo(hijo.id, 'estado', e.target.value as EstadoRegistroLoteEspec)}
                          className="w-full px-2.5 py-1.5 font-bold bg-slate-50 border border-slate-200 rounded-lg text-gray-900 focus:bg-white"
                        >
                          <option value="sin clasificar">sin clasificar</option>
                          <option value="clasificado">clasificado</option>
                          <option value="bloqueado">bloqueado</option>
                          <option value="descartado">descartado</option>
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Validación Matemática de Balance de Masa */}
          <div
            className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
              esSumaExacta
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : 'bg-amber-50 border-amber-300 text-amber-950'
            }`}
          >
            <div className="space-y-1">
              <span className="font-bold uppercase tracking-wider block flex items-center gap-1.5">
                {esSumaExacta ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Balance de Masa Exacto (100% Coincidente)</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Desbalance de Kilajes ({formatKg(Math.abs(diferenciaKg))})</span>
                  </>
                )}
              </span>
              <p className="text-[11px] text-gray-600">
                Kg Padre: <strong>{formatKg(kgPadre)}</strong> | Suma Hijos: <strong>{formatKg(sumaKgHijos)}</strong>
              </p>
            </div>

            <div className="text-right font-mono">
              <span className="text-[10px] text-gray-500 block uppercase font-bold">Diferencia</span>
              <span className={`text-base font-black ${esSumaExacta ? 'text-emerald-700' : 'text-amber-700'}`}>
                {diferenciaKg > 0 ? `+${formatKg(diferenciaKg)}` : formatKg(diferenciaKg)}
              </span>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!esSumaExacta || isSubmitting}
              className="px-6 py-2.5 bg-[#00603C] hover:bg-[#254731] text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-md transition disabled:opacity-50 cursor-pointer flex items-center gap-2"
            >
              <Scissors className="w-4 h-4 text-amber-300" />
              <span>{isSubmitting ? 'Desdoblando...' : 'Confirmar Desdoblamiento'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
