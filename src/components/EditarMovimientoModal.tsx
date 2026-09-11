/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Lote, MovimientoStock, PlantaConfig } from '../types';
import { formatKg, formatDateStr, formatNumberArg } from '../utils/formatters';
import { isLoteTratado, getLoteProductoTratamiento } from './LotesView';
import {
  X,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Package,
  Tag,
  FlaskConical,
  Building2,
  Layers,
  Sparkles,
  Info,
  Scale,
  ArrowRight,
  ArrowRightLeft,
  RotateCcw,
  Check,
} from 'lucide-react';

export type TipoMovimientoId = 'intermedio_a_final' | 'intermedio_a_final_tratado' | 'final_a_final_tratado';

export interface EditarMovimientoResult {
  loteActualizado: Lote;
  loteOrigenActualizado?: Lote;
  resumenCambios: string;
}

interface EditarMovimientoModalProps {
  isOpen: boolean;
  lote: Lote | null;
  allLotes: Lote[];
  plantaConfig?: PlantaConfig;
  currentUser: { nombre: string; rol: string };
  onClose: () => void;
  onConfirmEditMovimiento: (result: EditarMovimientoResult) => Promise<void> | void;
}

export const EditarMovimientoModal: React.FC<EditarMovimientoModalProps> = ({
  isOpen,
  lote,
  allLotes,
  plantaConfig,
  currentUser,
  onClose,
  onConfirmEditMovimiento,
}) => {
  // Si no está abierto o no hay lote seleccionado, no renderizar
  if (!isOpen || !lote) return null;

  // Estado inicial derivado del lote
  const [nombreLote, setNombreLote] = useState<string>('');
  const [tipoMovimiento, setTipoMovimiento] = useState<TipoMovimientoId>('intermedio_a_final');
  const [bolsas, setBolsas] = useState<number>(1);
  const [kgPorBolsa, setKgPorBolsa] = useState<number>(40);
  const [tratamientoOption, setTratamientoOption] = useState<'Sin Tratar' | 'Tratado'>('Sin Tratar');
  const [productoTratamiento, setProductoTratamiento] = useState<string>('');
  const [fechaMovimiento, setFechaMovimiento] = useState<string>('');
  const [loteOrigenStr, setLoteOrigenStr] = useState<string>('');
  const [motivoEdicion, setMotivoEdicion] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Valores originales para comparación
  const initialBolsas = lote.stockBolsas || 0;
  const initialTratado = isLoteTratado(lote);
  const initialProducto = getLoteProductoTratamiento(lote) || lote.producto || '';
  const initialTipoMovimiento = lote.tipoMovimiento || '';
  const initialFecha = lote.fechaMovimiento || lote.fechaRealizacionMovimiento || lote.fechaIngreso || '';

  // Inicializar estados al abrir o cambiar de lote
  useEffect(() => {
    if (lote) {
      setNombreLote(lote.loteNro || '');
      setBolsas(lote.stockBolsas || 1);
      setKgPorBolsa(lote.kgPorBolsa || 40);

      // Determinar tipo de movimiento
      const tMov = (lote.tipoMovimiento || '').toLowerCase();
      if (tMov.includes('final a final') || (lote.tipo === 'Final' && initialTratado && tMov.includes('tratado'))) {
        setTipoMovimiento('final_a_final_tratado');
      } else if (tMov.includes('tratado') || initialTratado) {
        setTipoMovimiento('intermedio_a_final_tratado');
      } else {
        setTipoMovimiento('intermedio_a_final');
      }

      const esTratado = initialTratado;
      setTratamientoOption(esTratado ? 'Tratado' : 'Sin Tratar');
      setProductoTratamiento(initialProducto === 'Sin Tratamiento' ? '' : initialProducto);

      const fechaInit =
        lote.fechaMovimiento ||
        lote.fechaRealizacionMovimiento ||
        lote.fechaIngreso ||
        new Date().toISOString().split('T')[0];
      setFechaMovimiento(fechaInit);

      setLoteOrigenStr(lote.loteOrigen || '');
      setMotivoEdicion('');
      setErrorMsg(null);
    }
  }, [lote]);

  // Lista de productos químicos sugeridos
  const productosSugeridos = useMemo(() => {
    const list = new Set<string>();
    if (plantaConfig?.tratamientos && Array.isArray(plantaConfig.tratamientos)) {
      plantaConfig.tratamientos
        .filter(t => !['Sin Tratar', 'Tratado', 'Sin Tratamiento', 'Ninguno'].includes(t))
        .forEach(p => list.add(p));
    }
    list.add('Maxim Quattro + Inoculante');
    list.add('Maxim XL');
    list.add('Cruiser Maxx Semillero');
    list.add('Derosal Plus');
    list.add('Tiramsam');
    list.add('Standak Top');
    list.add('Inoculante Líquido');
    list.add('Rizoderma');
    allLotes.forEach(l => {
      if (l.producto && !['Sin Tratamiento', 'Ninguno', 'FINAL', 'INTERMEDIO', 'Sin Tratar', ''].includes(l.producto.trim())) {
        list.add(l.producto.trim());
      }
      if (l.productoAplicado && l.productoAplicado.trim() !== '') {
        list.add(l.productoAplicado.trim());
      }
    });
    return Array.from(list);
  }, [plantaConfig, allLotes]);

  // Buscar el lote de origen en el conjunto total de lotes
  const loteOrigenEncontrado = useMemo(() => {
    if (!loteOrigenStr.trim()) return null;
    const target = loteOrigenStr.trim().toLowerCase();
    return allLotes.find(
      l =>
        l.id !== lote.id &&
        ((l.loteNro && l.loteNro.trim().toLowerCase() === target) ||
          l.id.trim().toLowerCase() === target)
    ) || null;
  }, [loteOrigenStr, allLotes, lote.id]);

  // Al cambiar de tipo de movimiento, actualizar automáticamente el tratamiento
  const handleSelectTipoMovimiento = (nuevoTipo: TipoMovimientoId) => {
    setTipoMovimiento(nuevoTipo);
    if (nuevoTipo === 'intermedio_a_final') {
      setTratamientoOption('Sin Tratar');
      setProductoTratamiento('');
    } else {
      setTratamientoOption('Tratado');
      if (!productoTratamiento.trim()) {
        setProductoTratamiento(productosSugeridos[0] || 'Maxim Quattro + Inoculante');
      }
    }
  };

  // Cálculo de diferencia de bolsas
  const diffBolsas = (bolsas || 0) - initialBolsas;
  const kgTotalesCalculados = Math.round((bolsas || 0) * (kgPorBolsa || 40));

  // Cálculo de stock en lote de origen si existe
  const stockOrigenActual = loteOrigenEncontrado?.stockBolsas ?? 0;
  const stockOrigenResultante = stockOrigenActual - diffBolsas;
  const maxBolsasPermitidas = stockOrigenActual + initialBolsas;

  // Validación
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!bolsas || bolsas <= 0) {
      setErrorMsg('Debe ingresar una cantidad válida de bolsas (mayor a 0).');
      return;
    }

    if (!nombreLote.trim()) {
      setErrorMsg('El nombre del lote no puede estar vacío.');
      return;
    }

    const requiereTratamiento = tratamientoOption === 'Tratado' || tipoMovimiento !== 'intermedio_a_final';

    if (requiereTratamiento && !productoTratamiento.trim()) {
      setErrorMsg('Debe ingresar o seleccionar el producto de tratamiento / curado químico aplicado.');
      return;
    }

    // Validar stock disponible en lote de origen si se encontró y se están pidiendo más bolsas
    if (loteOrigenEncontrado && diffBolsas > 0 && stockOrigenResultante < 0) {
      setErrorMsg(
        `El lote de origen "${loteOrigenEncontrado.loteNro}" solo tiene ${stockOrigenActual} bolsas disponibles. El máximo posible para este lote es ${maxBolsasPermitidas} bolsas.`
      );
      return;
    }

    try {
      setIsSubmitting(true);

      const tipoMovimientoLabel =
        tipoMovimiento === 'intermedio_a_final'
          ? 'Intermedio a Final'
          : tipoMovimiento === 'intermedio_a_final_tratado'
          ? 'Intermedio a Final Tratado'
          : 'Final a Final Tratado';

      const productoFinal = requiereTratamiento ? productoTratamiento.trim() : 'Sin Tratamiento';
      const horaActual = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
      const fechaHoy = new Date().toISOString();

      // Registro de historial para el lote de movimiento
      const movAjusteLote: MovimientoStock = {
        id: `MOV-AJUSTE-EDIT-${Date.now()}`,
        fecha: fechaMovimiento,
        hora: horaActual,
        tipo: 'Ajuste',
        cantidadBolsas: bolsas,
        kgPorBolsa: kgPorBolsa,
        cantidadKg: kgTotalesCalculados,
        detalle: `Edición de movimiento: bolsas ajustadas de ${initialBolsas} a ${bolsas} (${diffBolsas >= 0 ? `+${diffBolsas}` : diffBolsas} b.). Movimiento: ${tipoMovimientoLabel}. Tratamiento: ${requiereTratamiento ? `Tratado (${productoFinal})` : 'Sin Tratar'}. ${motivoEdicion ? `Motivo: ${motivoEdicion.trim()}` : ''}`,
      };

      const auditAjusteLote = {
        id: `AUD-EDIT-MOV-${Date.now()}`,
        fechaHora: fechaHoy,
        tipo: 'Edición' as const,
        usuario: currentUser.nombre,
        descripcion: `Edición de movimiento: Bolsas ${initialBolsas} -> ${bolsas}. Tipo: ${tipoMovimientoLabel}. Tratamiento: ${requiereTratamiento ? `Tratado (${productoFinal})` : 'Sin Tratar'}.`,
        detalles: `Fecha movimiento: ${fechaMovimiento}. Kg totales: ${kgTotalesCalculados} kg. ${motivoEdicion ? `Nota: ${motivoEdicion.trim()}` : ''}`,
      };

      const loteActualizado: Lote = {
        ...lote,
        loteNro: nombreLote.trim(),
        stockBolsas: bolsas,
        kgPorBolsa: kgPorBolsa,
        stockKg: kgTotalesCalculados,
        tipo: 'Final',
        tipoMovimiento: tipoMovimientoLabel,
        esMovimiento: true,
        loteOrigen: loteOrigenStr.trim() || lote.loteOrigen,
        tratamiento: requiereTratamiento ? ['Tratado'] : ['Sin Tratar'],
        producto: productoFinal,
        productoAplicado: requiereTratamiento ? productoFinal : '',
        fechaMovimiento: fechaMovimiento,
        fechaRealizacionMovimiento: fechaMovimiento,
        estado: bolsas <= 0 ? 'Agotado' : 'Disponible',
        historial: [movAjusteLote, ...(lote.historial || [])],
        auditoria: [auditAjusteLote, ...(lote.auditoria || [])],
      };

      // Si hay lote de origen y hubo variación de bolsas, ajustar el lote de origen
      let loteOrigenActualizado: Lote | undefined = undefined;

      if (loteOrigenEncontrado && diffBolsas !== 0) {
        const kgOrigenResultante = Math.round(
          stockOrigenResultante * (loteOrigenEncontrado.kgPorBolsa || 40)
        );

        const movAjusteOrigen: MovimientoStock = {
          id: `MOV-AJUSTE-ORIGEN-${Date.now()}`,
          fecha: fechaMovimiento,
          hora: horaActual,
          tipo: diffBolsas > 0 ? 'Salida por movimiento' : 'Entrada por movimiento',
          cantidadBolsas: Math.abs(diffBolsas),
          kgPorBolsa: loteOrigenEncontrado.kgPorBolsa || 40,
          cantidadKg: Math.round(Math.abs(diffBolsas) * (loteOrigenEncontrado.kgPorBolsa || 40)),
          detalle: `Ajuste por edición de movimiento en lote ${nombreLote.trim()}: ${diffBolsas > 0 ? `egreso adicional de ${diffBolsas}` : `reintegro de ${Math.abs(diffBolsas)}`} bolsas. Stock resultante: ${stockOrigenResultante} b.`,
          destino: nombreLote.trim(),
        };

        const auditAjusteOrigen = {
          id: `AUD-AJUSTE-ORIGEN-${Date.now()}`,
          fechaHora: fechaHoy,
          tipo: 'Edición' as const,
          usuario: currentUser.nombre,
          descripcion: `Ajuste de stock por edición de movimiento en lote ${nombreLote.trim()}. ${diffBolsas > 0 ? `Egreso adicional de ${diffBolsas} b.` : `Reintegro de ${Math.abs(diffBolsas)} b.`}`,
          detalles: `Stock anterior: ${stockOrigenActual} b. -> Nuevo stock: ${stockOrigenResultante} b.`,
        };

        loteOrigenActualizado = {
          ...loteOrigenEncontrado,
          stockBolsas: stockOrigenResultante,
          stockKg: kgOrigenResultante,
          estado:
            stockOrigenResultante <= 0
              ? 'Agotado'
              : loteOrigenEncontrado.estado === 'Agotado' && stockOrigenResultante > 0
              ? 'Disponible'
              : loteOrigenEncontrado.estado,
          historial: [movAjusteOrigen, ...(loteOrigenEncontrado.historial || [])],
          auditoria: [auditAjusteOrigen, ...(loteOrigenEncontrado.auditoria || [])],
        };
      }

      const resumenCambios = `${nombreLote.trim()} (${bolsas} bolsas, ${tipoMovimientoLabel}, ${requiereTratamiento ? `Tratado: ${productoFinal}` : 'Sin Tratar'})`;

      await onConfirmEditMovimiento({
        loteActualizado,
        loteOrigenActualizado,
        resumenCambios,
      });

      onClose();
    } catch (err: any) {
      console.error('Error al editar movimiento:', err);
      setErrorMsg(err?.message || 'Error inesperado al guardar los cambios del movimiento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const requiereTratamientoActual =
    tratamientoOption === 'Tratado' || tipoMovimiento !== 'intermedio_a_final';

  return (
    <div
      className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150 overflow-y-auto"
      id="modal-editor-movimiento"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full my-6 overflow-hidden text-left flex flex-col max-h-[94vh]">
        {/* Cabecera del modal */}
        <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 px-5 py-4 text-white flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-200 shadow-inner">
              <Edit3 className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg tracking-tight text-white">
                  Editor de Movimiento
                </h3>
                <span className="px-2 py-0.5 bg-purple-500/30 text-purple-200 border border-purple-400/30 rounded text-[10px] font-black uppercase tracking-wider">
                  Modificar
                </span>
              </div>
              <p className="text-xs text-purple-200/80 mt-0.5 flex flex-wrap items-center gap-1.5 font-medium">
                <span>Lote:</span>
                <span className="font-mono font-bold text-white bg-purple-950/60 px-1.5 py-0.2 rounded border border-purple-700/50">
                  {lote.loteNro}
                </span>
                <span>·</span>
                <span>{lote.cliente}</span>
                <span>·</span>
                <span>{lote.especie} ({lote.variedad})</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/70 hover:text-white hover:bg-white/10 p-2 rounded-xl transition cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido scrollable del formulario */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-slate-800 text-xs">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-start gap-2.5 text-xs font-semibold animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Tarjeta Informativa: Lote de Origen */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0">
                <ArrowRightLeft className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Lote de Origen Vinculado
                </div>
                <div className="font-mono font-black text-sm text-slate-900 flex items-center gap-2">
                  <span>{loteOrigenStr || 'No vinculado / Directo'}</span>
                  {loteOrigenEncontrado && (
                    <span className="text-[10px] font-sans font-extrabold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Stock actual: {formatNumberArg(stockOrigenActual, 0)} b.
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="text-[11px] text-slate-600 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 font-medium shrink-0">
              <span className="text-slate-400">Bolsas originales pasadas:</span>{' '}
              <strong className="font-mono font-bold text-slate-900">{initialBolsas} b.</strong>
            </div>
          </div>

          {/* SECCIÓN 1: Selección del Tipo de Movimiento */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-indigo-600" />
              <span>1. Movimiento Realizado</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Opción 1 */}
              <button
                type="button"
                onClick={() => handleSelectTipoMovimiento('intermedio_a_final')}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  tipoMovimiento === 'intermedio_a_final'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-950 shadow-xs ring-2 ring-emerald-500/20'
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-black text-xs">Intermedio a Final</span>
                    {tipoMovimiento === 'intermedio_a_final' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Lote tipo <strong>Final</strong> sin curasemilla.
                  </p>
                </div>
                <div className="mt-2">
                  <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-slate-200 text-slate-700">
                    Sin Tratar
                  </span>
                </div>
              </button>

              {/* Opción 2 */}
              <button
                type="button"
                onClick={() => handleSelectTipoMovimiento('intermedio_a_final_tratado')}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  tipoMovimiento === 'intermedio_a_final_tratado'
                    ? 'bg-purple-50 border-purple-500 text-purple-950 shadow-xs ring-2 ring-purple-500/20'
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-black text-xs">Intermedio a Final Tratado</span>
                    {tipoMovimiento === 'intermedio_a_final_tratado' && (
                      <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Lote tipo <strong>Final</strong> con curasemilla / químico.
                  </p>
                </div>
                <div className="mt-2">
                  <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-red-600 text-white">
                    Tratado
                  </span>
                </div>
              </button>

              {/* Opción 3 */}
              <button
                type="button"
                onClick={() => handleSelectTipoMovimiento('final_a_final_tratado')}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  tipoMovimiento === 'final_a_final_tratado'
                    ? 'bg-blue-50 border-blue-500 text-blue-950 shadow-xs ring-2 ring-blue-500/20'
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-black text-xs">Final a Final Tratado</span>
                    {tipoMovimiento === 'final_a_final_tratado' && (
                      <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Lote <strong>Final</strong> curado con tratamiento químico.
                  </p>
                </div>
                <div className="mt-2">
                  <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-red-600 text-white">
                    Tratado
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* SECCIÓN 2: Cantidad de Bolsas Pasadas y Ajuste */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-purple-700" />
                <span>2. Cantidad de Bolsas Pasadas</span>
              </label>
              <div className="text-[11px] text-slate-500 font-medium">
                Kg/bolsa:{' '}
                <span className="font-mono font-bold text-slate-800">{kgPorBolsa} kg</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={bolsas || ''}
                    onChange={(e) => setBolsas(parseInt(e.target.value, 10) || 0)}
                    required
                    className="w-full text-base sm:text-lg font-mono font-black px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-slate-900 shadow-2xs"
                    placeholder="Cantidad de bolsas"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    bolsas
                  </span>
                </div>

                {/* Previsualización de Kg Totales */}
                <div className="mt-1.5 text-[11px] text-slate-600 flex items-center gap-1 font-medium">
                  <Scale className="w-3 h-3 text-slate-400" />
                  <span>Total en este lote:</span>
                  <strong className="font-mono font-bold text-slate-900">
                    {formatKg(kgTotalesCalculados)} kg
                  </strong>
                </div>
              </div>

              {/* Tarjeta de Diferencia e Impacto en Origen */}
              <div className="p-3 bg-white border border-slate-200 rounded-xl text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Variación de bolsas:</span>
                  <span
                    className={`font-mono font-black text-xs px-2 py-0.5 rounded ${
                      diffBolsas === 0
                        ? 'bg-slate-100 text-slate-600'
                        : diffBolsas > 0
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {diffBolsas > 0 ? `+${diffBolsas} b.` : diffBolsas < 0 ? `${diffBolsas} b.` : 'Sin cambio'}
                  </span>
                </div>

                {loteOrigenEncontrado ? (
                  <div className="pt-1.5 border-t border-slate-100 text-[11px] text-slate-600">
                    <span>Stock resultante en origen (<strong>{loteOrigenEncontrado.loteNro}</strong>):</span>
                    <div className="font-mono font-bold text-slate-900 mt-0.5 flex items-center gap-1">
                      <span>{stockOrigenResultante} bolsas</span>
                      <span className="text-slate-400 font-normal">
                        ({formatKg(Math.round(stockOrigenResultante * (loteOrigenEncontrado.kgPorBolsa || 40)))} kg)
                      </span>
                    </div>
                    {diffBolsas > 0 && stockOrigenResultante < 0 && (
                      <span className="text-[10px] text-red-600 font-bold block mt-0.5">
                        ¡Stock insuficiente en origen! (Máximo: {maxBolsasPermitidas} b.)
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-400 italic">
                    Sin lote origen específico para ajustar en stock cruzado.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SECCIÓN 3: Tratamiento Utilizado */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <FlaskConical className="w-3.5 h-3.5 text-red-600" />
                <span>3. Tratamiento Utilizado</span>
              </label>

              {/* Botón rápido para alternar Sin Tratar / Tratado */}
              <div className="flex items-center gap-1 bg-slate-200/80 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setTratamientoOption('Sin Tratar');
                    if (tipoMovimiento !== 'intermedio_a_final') {
                      setTipoMovimiento('intermedio_a_final');
                    }
                  }}
                  className={`px-2 py-1 rounded text-[10px] font-extrabold uppercase transition cursor-pointer ${
                    tratamientoOption === 'Sin Tratar'
                      ? 'bg-white text-slate-800 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sin Tratar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTratamientoOption('Tratado');
                    if (tipoMovimiento === 'intermedio_a_final') {
                      setTipoMovimiento('intermedio_a_final_tratado');
                    }
                    if (!productoTratamiento.trim()) {
                      setProductoTratamiento(productosSugeridos[0] || 'Maxim Quattro + Inoculante');
                    }
                  }}
                  className={`px-2 py-1 rounded text-[10px] font-extrabold uppercase transition cursor-pointer ${
                    tratamientoOption === 'Tratado'
                      ? 'bg-red-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tratado
                </button>
              </div>
            </div>

            {requiereTratamientoActual ? (
              <div className="space-y-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Producto de tratamiento / Curasemilla aplicado: <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    list="productos-sugeridos-edit"
                    value={productoTratamiento}
                    onChange={(e) => setProductoTratamiento(e.target.value)}
                    placeholder="Ej: Maxim Quattro + Inoculante, Cruiser Maxx, etc."
                    required={requiereTratamientoActual}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 shadow-2xs"
                  />
                  <datalist id="productos-sugeridos-edit">
                    {productosSugeridos.map((prod, idx) => (
                      <option key={idx} value={prod} />
                    ))}
                  </datalist>
                </div>

                {/* Sugerencias en chips rápidos */}
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Sugerencias frecuentes:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {productosSugeridos.slice(0, 6).map((prod, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setProductoTratamiento(prod)}
                        className={`text-[10px] px-2 py-0.5 rounded border transition cursor-pointer ${
                          productoTratamiento === prod
                            ? 'bg-purple-100 border-purple-400 text-purple-900 font-bold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {prod}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-2.5 bg-slate-100 rounded-lg text-[11px] text-slate-600 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                <span>Lote clasificado <strong>Sin Tratar</strong>. No requiere formulación química adicional.</span>
              </div>
            )}
          </div>

          {/* SECCIÓN 4: Fecha, Identificación y Observaciones */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Fecha del movimiento */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>Fecha del Movimiento</span>
              </label>
              <input
                type="date"
                value={fechaMovimiento}
                onChange={(e) => setFechaMovimiento(e.target.value)}
                required
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 shadow-2xs"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Impacta en el Reporte de Movimientos en Excel
              </span>
            </div>

            {/* Nombre del Lote */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-indigo-600" />
                <span>Nombre del Lote</span>
              </label>
              <input
                type="text"
                value={nombreLote}
                onChange={(e) => setNombreLote(e.target.value)}
                required
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 shadow-2xs"
                placeholder="Identificación del lote"
              />
            </div>
          </div>

          {/* Motivo o detalle de la edición */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Motivo o Detalle del Ajuste (Opcional):
            </label>
            <textarea
              rows={2}
              value={motivoEdicion}
              onChange={(e) => setMotivoEdicion(e.target.value)}
              placeholder="Ej: Corrección de bolsas pasadas, cambio de curasemilla aplicado, etc."
              className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none shadow-2xs"
            />
          </div>

          {/* Resumen de cambios en vivo */}
          <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl text-xs space-y-1">
            <div className="font-bold text-purple-900 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>Resumen de la Modificación:</span>
            </div>
            <div className="text-[11px] text-purple-950 font-medium grid grid-cols-1 sm:grid-cols-2 gap-1 pt-1">
              <div>
                • Bolsas: <span className="line-through text-slate-400">{initialBolsas} b.</span>{' '}
                <strong className="text-purple-900 font-mono">{bolsas} b.</strong> ({formatKg(kgTotalesCalculados)} kg)
              </div>
              <div>
                • Movimiento: <strong className="text-purple-900">{tipoMovimiento === 'intermedio_a_final' ? 'Intermedio a Final' : tipoMovimiento === 'intermedio_a_final_tratado' ? 'Intermedio a Final Tratado' : 'Final a Final Tratado'}</strong>
              </div>
              <div>
                • Tratamiento:{' '}
                <strong className={requiereTratamientoActual ? 'text-red-600' : 'text-slate-600'}>
                  {requiereTratamientoActual ? `Tratado (${productoTratamiento || 'Pendiente'})` : 'Sin Tratar'}
                </strong>
              </div>
              <div>
                • Fecha: <strong className="text-purple-900">{formatDateStr(fechaMovimiento)}</strong>
              </div>
            </div>
          </div>

          {/* Botones de acción al pie */}
          <div className="pt-2 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-4 py-2 border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl transition cursor-pointer text-xs"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 hover:from-purple-800 hover:to-indigo-900 text-white font-black rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-2 text-xs"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Guardando cambios...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>Confirmar y Guardar Movimiento</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
