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
  EstadoRegistroLoteEspec,
  TipoMovimientoEspecificacion
} from '../types';
import { formatKg } from '../utils/formatters';
import { getKilajeEnvase, normalizarEnvase, normalizarCategoria, normalizarTipo, normalizarTratamiento, normalizarEstado } from '../utils/loteEspecUtils';
import {
  X,
  SlidersHorizontal,
  Package,
  Layers,
  FlaskConical,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  Tag
} from 'lucide-react';

export interface AccionLoteResult {
  tipoAccion: TipoMovimientoEspecificacion;
  valorAnterior: any;
  valorNuevo: any;
  observaciones: string;
  loteActualizado: Lote;
}

interface AccionesLoteModalProps {
  isOpen: boolean;
  lote: Lote;
  currentUser: { nombre: string; rol: string };
  initialTab?: 'estado' | 'tratamiento' | 'envase' | 'categoria' | 'tipo' | 'bloqueo';
  onClose: () => void;
  onConfirmAccion: (result: AccionLoteResult) => Promise<void> | void;
}

export const AccionesLoteModal: React.FC<AccionesLoteModalProps> = ({
  isOpen,
  lote,
  currentUser,
  initialTab = 'estado',
  onClose,
  onConfirmAccion,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'estado' | 'tratamiento' | 'envase' | 'categoria' | 'tipo' | 'bloqueo'>(initialTab);

  // Valores iniciales del lote
  const estadoActual = normalizarEstado(lote.estadoEspec || lote.estado, lote.estadoRegistro);
  const tratActual = normalizarTratamiento(lote.tratamiento);
  const envaseActual = normalizarEnvase(lote.envase || lote.kgPorBolsa);
  const catActual = normalizarCategoria(lote.categoria);
  const tipoActual = normalizarTipo(lote.tipo);

  // Estados de formularios individuales
  const [nuevoEstado, setNuevoEstado] = useState<EstadoRegistroLoteEspec>(estadoActual);
  const [nuevoTratamiento, setNuevoTratamiento] = useState<TratamientoEspecificacion>(tratActual);
  const [nuevoEnvase, setNuevoEnvase] = useState<EnvaseEspecificacion>(envaseActual);
  const [nuevaCategoria, setNuevaCategoria] = useState<CategoriaEspecificacion>(catActual);
  const [nuevoTipo, setNuevoTipo] = useState<TipoLoteEspecificacion>(tipoActual);
  const [observaciones, setObservaciones] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const esBloqueado = estadoActual === 'bloqueado';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      let tipoMov: TipoMovimientoEspecificacion = 'cambio_estado';
      let valorAnt: any = '';
      let valorNue: any = '';
      let loteAct: Lote = { ...lote };

      if (activeTab === 'estado') {
        if (nuevoEstado === estadoActual) {
          setErrorMsg('Seleccione un estado diferente al actual.');
          setIsSubmitting(false);
          return;
        }
        tipoMov = 'cambio_estado';
        valorAnt = estadoActual;
        valorNue = nuevoEstado;
        loteAct = {
          ...loteAct,
          estadoEspec: nuevoEstado,
          estado: (nuevoEstado === 'bloqueado' ? 'Reservado' : (nuevoEstado === 'agotado' ? 'Agotado' : 'Disponible')) as any,
          estadoRegistro: nuevoEstado === 'precarga' ? 'PRE-CARGA' : 'REALIZADO'
        };
      } else if (activeTab === 'tratamiento') {
        if (nuevoTratamiento === tratActual) {
          setErrorMsg('Seleccione un tratamiento diferente al actual.');
          setIsSubmitting(false);
          return;
        }
        tipoMov = 'curado';
        valorAnt = tratActual;
        valorNue = nuevoTratamiento;
        loteAct = {
          ...loteAct,
          tratamiento: [nuevoTratamiento === 'curado' ? 'Tratado' : 'Sin Tratar']
        };
      } else if (activeTab === 'envase') {
        if (nuevoEnvase === envaseActual) {
          setErrorMsg('Seleccione un envase diferente al actual.');
          setIsSubmitting(false);
          return;
        }
        tipoMov = 'cambio_envase';
        valorAnt = envaseActual;
        valorNue = nuevoEnvase;
        const nuevoKgEnvase = getKilajeEnvase(nuevoEnvase);
        const kgTotal = Number(lote.kg) || Number(lote.stockKg) || ((Number(lote.cantidadBolsas) || Number(lote.stockBolsas) || 0) * getKilajeEnvase(envaseActual));
        const nuevasBolsas = Math.floor(kgTotal / nuevoKgEnvase);
        loteAct = {
          ...loteAct,
          envase: nuevoEnvase,
          kgPorBolsa: nuevoKgEnvase,
          cantidadBolsas: nuevasBolsas,
          stockBolsas: nuevasBolsas,
          kg: nuevasBolsas * nuevoKgEnvase,
          stockKg: nuevasBolsas * nuevoKgEnvase
        };
      } else if (activeTab === 'categoria') {
        if (nuevaCategoria === catActual) {
          setErrorMsg('Seleccione una categoría diferente a la actual.');
          setIsSubmitting(false);
          return;
        }
        tipoMov = 'cambio_categoria';
        valorAnt = catActual;
        valorNue = nuevaCategoria;
        loteAct = {
          ...loteAct,
          categoria: nuevaCategoria === 'preba' ? 'Preba' : (nuevaCategoria === 'original' ? 'Original' : 'Primu')
        };
      } else if (activeTab === 'tipo') {
        if (nuevoTipo === tipoActual) {
          setErrorMsg('Seleccione un tipo diferente al actual.');
          setIsSubmitting(false);
          return;
        }
        tipoMov = 'cambio_tipo';
        valorAnt = tipoActual;
        valorNue = nuevoTipo;
        loteAct = {
          ...loteAct,
          tipo: nuevoTipo === 'intermedio' ? 'Intermedio' : 'Final'
        };
      } else if (activeTab === 'bloqueo') {
        if (esBloqueado) {
          // Desbloquear
          tipoMov = 'desbloqueo';
          valorAnt = 'bloqueado';
          valorNue = lote.estadoAnterior || 'clasificado';
          loteAct = {
            ...loteAct,
            estadoEspec: (lote.estadoAnterior || 'clasificado') as any,
            estado: 'Disponible',
            estadoAnterior: null
          };
        } else {
          // Bloquear
          tipoMov = 'bloqueo';
          valorAnt = estadoActual;
          valorNue = 'bloqueado';
          loteAct = {
            ...loteAct,
            estadoAnterior: estadoActual,
            estadoEspec: 'bloqueado',
            estado: 'Reservado'
          };
        }
      }

      await onConfirmAccion({
        tipoAccion: tipoMov,
        valorAnterior: valorAnt,
        valorNuevo: valorNue,
        observaciones: observaciones.trim() || `Modificación cualitativa: ${tipoMov}`,
        loteActualizado: loteAct
      });

      onClose();
    } catch (err: any) {
      console.error('Error aplicando acción sobre lote:', err);
      setErrorMsg(err.message || 'Error al aplicar cambio.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full border border-gray-100 overflow-hidden my-6">

        {/* Encabezado */}
        <div className="bg-gradient-to-r from-emerald-950 via-[#00603C] to-slate-900 text-white p-5 flex items-start justify-between">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-300">
              Acciones Cualitativas y Operativas
            </span>
            <h3 className="font-serif text-lg sm:text-xl font-bold mt-0.5">
              Modificar Lote #{lote.codigo || lote.loteNro}
            </h3>
            <p className="text-xs text-emerald-100 mt-0.5">
              Cada cambio del 100% genera automáticamente un movimiento con fecha y usuario sin desdoblar.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-xl hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pestañas de Acciones */}
        <div className="flex border-b border-gray-200 bg-slate-50 overflow-x-auto text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('estado')}
            className={`px-3.5 py-2.5 transition whitespace-nowrap cursor-pointer border-b-2 ${
              activeTab === 'estado'
                ? 'border-[#00603C] text-[#00603C] bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            Estado
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tratamiento')}
            className={`px-3.5 py-2.5 transition whitespace-nowrap cursor-pointer border-b-2 ${
              activeTab === 'tratamiento'
                ? 'border-[#00603C] text-[#00603C] bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            Tratamiento
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('envase')}
            className={`px-3.5 py-2.5 transition whitespace-nowrap cursor-pointer border-b-2 ${
              activeTab === 'envase'
                ? 'border-[#00603C] text-[#00603C] bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            Envase
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('categoria')}
            className={`px-3.5 py-2.5 transition whitespace-nowrap cursor-pointer border-b-2 ${
              activeTab === 'categoria'
                ? 'border-[#00603C] text-[#00603C] bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            Categoría
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tipo')}
            className={`px-3.5 py-2.5 transition whitespace-nowrap cursor-pointer border-b-2 ${
              activeTab === 'tipo'
                ? 'border-[#00603C] text-[#00603C] bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            Tipo
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bloqueo')}
            className={`px-3.5 py-2.5 transition whitespace-nowrap cursor-pointer border-b-2 ${
              activeTab === 'bloqueo'
                ? 'border-red-600 text-red-600 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {esBloqueado ? 'Desbloquear' : 'Bloquear'}
          </button>
        </div>

        {/* Contenido del Formulario */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {activeTab === 'estado' && (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-gray-700 uppercase">
                Seleccionar Nuevo Estado de Flujo:
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {(['sin clasificar', 'clasificado', 'bloqueado', 'descartado'] as EstadoRegistroLoteEspec[]).map(est => (
                  <button
                    key={est}
                    type="button"
                    onClick={() => setNuevoEstado(est)}
                    className={`p-3 rounded-xl border text-left font-bold capitalize transition cursor-pointer ${
                      nuevoEstado === est
                        ? 'bg-emerald-50 border-[#00603C] text-[#00603C] ring-2 ring-emerald-300'
                        : 'bg-slate-50 border-slate-200 text-gray-700 hover:bg-slate-100'
                    }`}
                  >
                    {est}
                    {est === estadoActual && (
                      <span className="block text-[10px] text-gray-400 font-normal">Estado actual</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'tratamiento' && (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-gray-700 uppercase">
                Tratamiento Químico (El curado no modifica los kg):
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {(['crudo', 'curado'] as TratamientoEspecificacion[]).map(tr => (
                  <button
                    key={tr}
                    type="button"
                    onClick={() => setNuevoTratamiento(tr)}
                    className={`p-3 rounded-xl border text-left font-bold capitalize transition cursor-pointer ${
                      nuevoTratamiento === tr
                        ? 'bg-purple-50 border-purple-600 text-purple-900 ring-2 ring-purple-300'
                        : 'bg-slate-50 border-slate-200 text-gray-700 hover:bg-slate-100'
                    }`}
                  >
                    {tr === 'crudo' ? 'Crudo (Sin Tratar)' : 'Curado (Tratado 100%)'}
                    {tr === tratActual && (
                      <span className="block text-[10px] text-gray-400 font-normal">Tratamiento actual</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'envase' && (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-gray-700 uppercase">
                Cambio de Envase (Bolsas previas pasan a 'reenvasada'):
              </label>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {(['x 800 kg', 'x 25 kg', 'x 20 kg'] as EnvaseEspecificacion[]).map(env => (
                  <button
                    key={env}
                    type="button"
                    onClick={() => setNuevoEnvase(env)}
                    className={`p-3 rounded-xl border text-center font-bold transition cursor-pointer ${
                      nuevoEnvase === env
                        ? 'bg-emerald-50 border-[#00603C] text-[#00603C] ring-2 ring-emerald-300'
                        : 'bg-slate-50 border-slate-200 text-gray-700 hover:bg-slate-100'
                    }`}
                  >
                    {env}
                    {env === envaseActual && (
                      <span className="block text-[10px] text-gray-400 font-normal">Envase actual</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'categoria' && (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-gray-700 uppercase">
                Categoría:
              </label>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {(['preba', 'original', 'primu'] as CategoriaEspecificacion[]).map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setNuevaCategoria(cat)}
                    className={`p-3 rounded-xl border text-center font-bold capitalize transition cursor-pointer ${
                      nuevaCategoria === cat
                        ? 'bg-amber-50 border-amber-600 text-amber-900 ring-2 ring-amber-300'
                        : 'bg-slate-50 border-slate-200 text-gray-700 hover:bg-slate-100'
                    }`}
                  >
                    {cat}
                    {cat === catActual && (
                      <span className="block text-[10px] text-gray-400 font-normal">Categoría actual</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'tipo' && (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-gray-700 uppercase">
                Tipo de Lote:
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {(['intermedio', 'final'] as TipoLoteEspecificacion[]).map(tp => (
                  <button
                    key={tp}
                    type="button"
                    onClick={() => setNuevoTipo(tp)}
                    className={`p-3 rounded-xl border text-center font-bold capitalize transition cursor-pointer ${
                      nuevoTipo === tp
                        ? 'bg-blue-50 border-blue-600 text-blue-900 ring-2 ring-blue-300'
                        : 'bg-slate-50 border-slate-200 text-gray-700 hover:bg-slate-100'
                    }`}
                  >
                    {tp}
                    {tp === tipoActual && (
                      <span className="block text-[10px] text-gray-400 font-normal">Tipo actual</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'bloqueo' && (
            <div className="space-y-3">
              {esBloqueado ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2 text-xs">
                  <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                    <Unlock className="w-4 h-4 text-emerald-700" />
                    <span>Desbloquear Lote (Reversible)</span>
                  </span>
                  <p className="text-gray-600">
                    Al desbloquear el lote volverá a su estado anterior: <strong>{lote.estadoAnterior || 'clasificado'}</strong> y quedará nuevamente habilitado para despachos y curado.
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2 text-xs">
                  <span className="font-bold text-amber-900 flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-amber-700" />
                    <span>Bloquear Lote</span>
                  </span>
                  <p className="text-gray-600">
                    El lote pasará a <strong>bloqueado</strong> (guardando su estado actual: <em>{estadoActual}</em>). Quedarán impedidos despachos, curados y desdoblamientos hasta que sea desbloqueado.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Observaciones */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Observaciones del Movimiento (Opcional):
            </label>
            <textarea
              rows={2}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Detalle o motivo del cambio..."
              className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white text-gray-900"
            />
          </div>

          {/* Botones de acción */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-2 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-md transition disabled:opacity-50 cursor-pointer ${
                activeTab === 'bloqueo' && !esBloqueado
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-[#00603C] hover:bg-[#254731]'
              }`}
            >
              {isSubmitting ? 'Guardando...' : activeTab === 'bloqueo' ? (esBloqueado ? 'Confirmar Desbloqueo' : 'Confirmar Bloqueo') : 'Confirmar Cambio'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
