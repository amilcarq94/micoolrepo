/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Lote, MovimientoStock, PlantaConfig } from '../types';
import { formatKg, formatDateStr } from '../utils/formatters';
import {
  X,
  ArrowRightLeft,
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
  Warehouse,
  MapPin,
} from 'lucide-react';

export type TipoMovimientoId = 'intermedio_a_final' | 'intermedio_a_final_tratado' | 'final_a_final_tratado';

export interface MovimientoLoteResult {
  loteOrigenActualizado: Lote;
  nuevoLoteGenerado: Lote;
  tipoMovimientoLabel: string;
}

interface MovimientoLoteModalProps {
  isOpen: boolean;
  lote: Lote | null;
  allLotes: Lote[];
  plantaConfig?: PlantaConfig;
  currentUser: { nombre: string; rol: string };
  onClose: () => void;
  onConfirmMovimiento: (result: MovimientoLoteResult) => Promise<void> | void;
}

/**
 * Calcula la sugerencia de nombre del nuevo lote según el tipo de movimiento:
 * 1- Intermedio a Final: ER01-INT -> ER01-FIN
 * 2- Intermedio a Final Tratado: ER01-INT -> ER01-TRA
 * 3- Final a Final Tratado: ER01-FIN -> ER01-TRA
 */
export function suggestMovementLoteName(
  originalName: string,
  movType: TipoMovimientoId
): string {
  const name = (originalName || '').trim();
  if (!name) return 'LOTE-FIN';

  if (movType === 'intermedio_a_final') {
    if (name.toUpperCase().includes('-INT')) return name.replace(/-INT/gi, '-FIN');
    if (name.toUpperCase().includes('_INT')) return name.replace(/_INT/gi, '_FIN');
    if (/INT$/i.test(name)) return name.replace(/INT$/i, 'FIN');
    return `${name}-FIN`;
  }

  if (movType === 'intermedio_a_final_tratado') {
    if (name.toUpperCase().includes('-INT')) return name.replace(/-INT/gi, '-TRA');
    if (name.toUpperCase().includes('_INT')) return name.replace(/_INT/gi, '_TRA');
    if (/INT$/i.test(name)) return name.replace(/INT$/i, 'TRA');
    return `${name}-TRA`;
  }

  if (movType === 'final_a_final_tratado') {
    if (name.toUpperCase().includes('-FIN')) return name.replace(/-FIN/gi, '-TRA');
    if (name.toUpperCase().includes('_FIN')) return name.replace(/_FIN/gi, '_TRA');
    if (/FIN$/i.test(name)) return name.replace(/FIN$/i, 'TRA');
    return `${name}-TRA`;
  }

  return `${name}-MOV`;
}

export const MovimientoLoteModal: React.FC<MovimientoLoteModalProps> = ({
  isOpen,
  lote,
  allLotes,
  plantaConfig,
  currentUser,
  onClose,
  onConfirmMovimiento,
}) => {
  if (!isOpen || !lote) return null;

  // Determinar la opción por defecto según el tipo del lote origen
  const defaultMovType: TipoMovimientoId = useMemo(() => {
    if (lote.tipo === 'Intermedio') {
      return 'intermedio_a_final';
    }
    return 'final_a_final_tratado';
  }, [lote.tipo]);

  const [tipoMovimiento, setTipoMovimiento] = useState<TipoMovimientoId>(defaultMovType);
  const [fechaMovimiento, setFechaMovimiento] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [cantidadBolsas, setCantidadBolsas] = useState<number>(() => {
    return lote.stockBolsas > 0 ? lote.stockBolsas : 1;
  });

  const [nombreNuevoLote, setNombreNuevoLote] = useState<string>(() => {
    return suggestMovementLoteName(lote.loteNro, defaultMovType);
  });

  const [productoTratamiento, setProductoTratamiento] = useState<string>(() => {
    return lote.producto && lote.producto !== 'Sin Tratamiento' && lote.producto !== 'Ninguno'
      ? lote.producto
      : 'Maxim Quattro + Inoculante';
  });

  const [observaciones, setObservaciones] = useState<string>('');
  
  // Ubicación / Sector de Acopio para el lote nuevo generado
  const [alaNuevoLote, setAlaNuevoLote] = useState<string>(() => lote.ala || 'A');
  const [sectorNuevoLote, setSectorNuevoLote] = useState<string>(() => lote.sector || '1');
  const [ubicacionAcopioNuevoLote, setUbicacionAcopioNuevoLote] = useState<string>(() => {
    if (lote.ubicacionAcopio && lote.ubicacionAcopio.trim()) return lote.ubicacionAcopio.trim();
    if (lote.ala && lote.sector) return `Ala ${lote.ala} · Sector ${lote.sector}`;
    return lote.ala ? `Ala ${lote.ala}` : 'Ala A · Sector 1';
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Actualizar sugerencia cuando cambia el tipo de movimiento si el usuario no lo ha personalizado arbitrariamente
  const handleSelectTipoMovimiento = (newType: TipoMovimientoId) => {
    setTipoMovimiento(newType);
    setNombreNuevoLote(suggestMovementLoteName(lote.loteNro, newType));
    setErrorMsg('');
  };

  const handleSelectAla = (newAla: string) => {
    setAlaNuevoLote(newAla);
    const sec = sectorNuevoLote || '1';
    setUbicacionAcopioNuevoLote(`Ala ${newAla} · Sector ${sec}`);
  };

  const handleSelectSector = (newSector: string) => {
    setSectorNuevoLote(newSector);
    const al = alaNuevoLote || 'A';
    setUbicacionAcopioNuevoLote(`Ala ${al} · Sector ${newSector}`);
  };

  const handleCopyUbicacionOrigen = () => {
    const origUbi = lote.ubicacionAcopio || (lote.ala && lote.sector ? `Ala ${lote.ala} · Sector ${lote.sector}` : (lote.ala ? `Ala ${lote.ala}` : ''));
    setAlaNuevoLote(lote.ala || '');
    setSectorNuevoLote(lote.sector || '');
    setUbicacionAcopioNuevoLote(origUbi);
  };

  // Restablecer valores cuando cambia el lote
  useEffect(() => {
    if (lote) {
      const initType = lote.tipo === 'Intermedio' ? 'intermedio_a_final' : 'final_a_final_tratado';
      setTipoMovimiento(initType);
      setCantidadBolsas(lote.stockBolsas > 0 ? lote.stockBolsas : 1);
      setNombreNuevoLote(suggestMovementLoteName(lote.loteNro, initType));
      setFechaMovimiento(new Date().toISOString().split('T')[0]);
      setAlaNuevoLote(lote.ala || 'A');
      setSectorNuevoLote(lote.sector || '1');
      setUbicacionAcopioNuevoLote(
        lote.ubicacionAcopio && lote.ubicacionAcopio.trim()
          ? lote.ubicacionAcopio.trim()
          : (lote.ala && lote.sector ? `Ala ${lote.ala} · Sector ${lote.sector}` : (lote.ala ? `Ala ${lote.ala}` : 'Ala A · Sector 1'))
      );
      setObservaciones('');
      setErrorMsg('');
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
      if (l.producto && l.producto !== 'Sin Tratamiento' && l.producto !== 'Ninguno' && l.producto.trim() !== '') {
        list.add(l.producto);
      }
      if (l.productoAplicado && l.productoAplicado.trim() !== '') {
        list.add(l.productoAplicado);
      }
    });
    return Array.from(list);
  }, [plantaConfig, allLotes]);

  // Cálculos derivados
  const kgPorBolsa = lote.kgPorBolsa || 800;
  const bolsasOrigenDisponibles = lote.stockBolsas || 0;
  const bolsasEgresadas = Math.max(0, cantidadBolsas || 0);
  const bolsasRemanentes = Math.max(0, bolsasOrigenDisponibles - bolsasEgresadas);
  const kgNuevoLote = bolsasEgresadas * kgPorBolsa;
  const kgRemanentes = bolsasRemanentes * kgPorBolsa;

  const requiereTratamiento = tipoMovimiento !== 'intermedio_a_final';

  // Manejador de confirmación
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!fechaMovimiento) {
      setErrorMsg('Debe seleccionar la Fecha de Movimiento.');
      return;
    }

    if (!nombreNuevoLote.trim()) {
      setErrorMsg('Debe ingresar un nombre o número para el nuevo lote.');
      return;
    }

    if (isNaN(cantidadBolsas) || cantidadBolsas <= 0) {
      setErrorMsg('La cantidad de bolsas a dar de alta debe ser mayor a 0.');
      return;
    }

    if (cantidadBolsas > bolsasOrigenDisponibles) {
      setErrorMsg(
        `La cantidad seleccionada (${cantidadBolsas} bolsas) supera el stock disponible del lote origen (${bolsasOrigenDisponibles} bolsas).`
      );
      return;
    }

    if (requiereTratamiento && !productoTratamiento.trim()) {
      setErrorMsg('Debe completar el producto de tratamiento para lotes tratados.');
      return;
    }

    // Verificar si el ID o nombre de lote colisiona con otro lote existente que no sea el mismo origen
    const nombreNormalizado = nombreNuevoLote.trim().toUpperCase();
    const clienteLote = lote.cliente;
    const nuevoLoteDocId = `${clienteLote.replace(/\s+/g, '_')}_${nombreNuevoLote.trim()}`;
    const colision = allLotes.some(
      l => (l.id.toUpperCase() === nuevoLoteDocId.toUpperCase() || l.loteNro.toUpperCase() === nombreNormalizado) && l.id !== lote.id
    );

    if (colision) {
      const confirmarSobrescritura = window.confirm(
        `Ya existe un lote con la numeración "${nombreNuevoLote.trim()}". ¿Desea continuar asignando este nombre?`
      );
      if (!confirmarSobrescritura) return;
    }

    try {
      setIsSubmitting(true);

      const tipoMovimientoLabel =
        tipoMovimiento === 'intermedio_a_final'
          ? 'Intermedio a Final'
          : tipoMovimiento === 'intermedio_a_final_tratado'
          ? 'Intermedio a Final Tratado'
          : 'Final a Final Tratado';

      const horaActual = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

      // 1. Crear movimiento de EGRESO en el LOTE ACTUAL (origen)
      const movEgresoStock: MovimientoStock = {
        id: `MOV-EGR-${Date.now()}`,
        fecha: fechaMovimiento,
        hora: horaActual,
        tipo: 'Salida por movimiento',
        tipoSalida: 'movimiento',
        cantidadBolsas: bolsasEgresadas,
        kgPorBolsa: kgPorBolsa,
        cantidadKg: kgNuevoLote,
        detalle: `Egreso de ${bolsasEgresadas} bolsas por movimiento (${tipoMovimientoLabel}) hacia nuevo lote ${nombreNuevoLote.trim()}`,
        destino: nombreNuevoLote.trim(),
      };

      const auditEgreso = {
        id: `AUD-MOV-EGR-${Date.now()}`,
        fechaHora: new Date().toISOString(),
        tipo: 'Edición',
        usuario: currentUser.nombre,
        descripcion: `Egreso de ${bolsasEgresadas} bolsas (${formatKg(kgNuevoLote)} kg) por movimiento (${tipoMovimientoLabel}) hacia nuevo lote ${nombreNuevoLote.trim()}.`,
        detalles: `Stock remanente: ${bolsasRemanentes} bolsas (${formatKg(kgRemanentes)} kg). Fecha de movimiento: ${fechaMovimiento}.`,
      };

      const loteOrigenActualizado: Lote = {
        ...lote,
        stockBolsas: bolsasRemanentes,
        stockKg: kgRemanentes,
        estado: bolsasRemanentes <= 0 ? 'Agotado' : lote.estado,
        historial: [movEgresoStock, ...(lote.historial || [])],
        auditoria: [auditEgreso, ...(lote.auditoria || [])],
      };

      // 2. Crear el NUEVO LOTE generado
      const productoFinal = requiereTratamiento ? productoTratamiento.trim() : 'Sin Tratamiento';

      const movIngresoNuevoLote: MovimientoStock = {
        id: `MOV-ING-${Date.now()}`,
        fecha: fechaMovimiento,
        hora: horaActual,
        tipo: 'Entrada por movimiento',
        cantidadBolsas: bolsasEgresadas,
        kgPorBolsa: kgPorBolsa,
        cantidadKg: kgNuevoLote,
        detalle: `Alta de ${bolsasEgresadas} bolsas por movimiento (${tipoMovimientoLabel}) desde lote de origen ${lote.loteNro}`,
      };

      const ubiFinalNuevoLote =
        ubicacionAcopioNuevoLote.trim() ||
        (alaNuevoLote && sectorNuevoLote
          ? `Ala ${alaNuevoLote} · Sector ${sectorNuevoLote}`
          : (alaNuevoLote ? `Ala ${alaNuevoLote}` : ''));

      const auditNuevoLote = {
        id: `AUD-MOV-ALTA-${Date.now()}`,
        fechaHora: new Date().toISOString(),
        tipo: 'Creación',
        usuario: currentUser.nombre,
        descripcion: `Lote ${nombreNuevoLote.trim()} generado por movimiento (${tipoMovimientoLabel}) desde lote ${lote.loteNro}. Ubicación: ${ubiFinalNuevoLote || 'Sin asignar'}.`,
        detalles: `Alta: ${bolsasEgresadas} bolsas (${formatKg(kgNuevoLote)} kg). Tratamiento: ${requiereTratamiento ? `Tratado (${productoFinal})` : 'Sin Tratar'}. Ubicación: ${ubiFinalNuevoLote || 'Sin asignar'}. Fecha movimiento: ${fechaMovimiento}.`,
      };

      const nuevoLoteGenerado: Lote = {
        id: nuevoLoteDocId,
        loteNro: nombreNuevoLote.trim(),
        cliente: lote.cliente,
        especie: lote.especie,
        variedad: lote.variedad,
        tipo: 'Final',
        categoria: lote.categoria || 'PRIMU',
        tratamiento: requiereTratamiento ? ['Tratado'] : ['Sin Tratar'],
        producto: productoFinal,
        productoAplicado: requiereTratamiento ? productoFinal : '',
        stockBolsas: bolsasEgresadas,
        kgPorBolsa: kgPorBolsa,
        stockKg: kgNuevoLote,
        fechaIngreso: fechaMovimiento,
        fechaMovimiento: fechaMovimiento,
        fechaRealizacionMovimiento: fechaMovimiento,
        fechaHoraProduccion: `${fechaMovimiento}T12:00:00`,
        campaniaId: lote.campaniaId,
        estado: 'Disponible',
        estadoRegistro: 'REALIZADO',
        estadoMovimiento: 'REALIZADO',
        esMovimiento: true,
        tipoMovimiento: tipoMovimientoLabel,
        loteOrigen: lote.loteNro || lote.id,
        ala: alaNuevoLote || '',
        sector: sectorNuevoLote || '',
        ubicacionAcopio: ubiFinalNuevoLote,
        humedad: lote.humedad,
        observaciones: observaciones.trim() || `Generado por movimiento (${tipoMovimientoLabel}) a partir de ${lote.loteNro}.`,
        historial: [movIngresoNuevoLote],
        auditoria: [auditNuevoLote],
      };

      await onConfirmMovimiento({
        loteOrigenActualizado,
        nuevoLoteGenerado,
        tipoMovimientoLabel,
      });

      onClose();
    } catch (err: any) {
      console.error('Error al procesar movimiento de lote:', err);
      setErrorMsg(err?.message || 'Ocurrió un error inesperado al registrar el movimiento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150 overflow-y-auto"
      id="modal-movimiento-lote"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full my-6 overflow-hidden text-left flex flex-col max-h-[92vh]">
        {/* Encabezado */}
        <div className="bg-[#00603C] text-white p-4 sm:p-5 flex justify-between items-center border-b border-emerald-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-amber-300 shadow-inner">
              <ArrowRightLeft className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-lg font-bold tracking-wide">
                  Movimiento de Lote
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950">
                  Operación de Stock
                </span>
              </div>
              <p className="text-xs text-emerald-100/90 mt-0.5">
                Lote Origen: <strong className="text-white font-mono">{lote.loteNro}</strong> · {lote.cliente} ({lote.especie} - {lote.variedad})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-emerald-100 hover:text-white hover:bg-emerald-800/80 rounded-xl transition cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info bar del Lote Origen */}
        <div className="bg-[#E3EFE7]/50 border-b border-[#00603C]/20 px-4 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Tipo actual:</span>
            <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded-md border border-slate-200">
              {lote.tipo}
            </span>
            <span className="text-slate-500 ml-1">Tratamiento actual:</span>
            <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded-md border border-slate-200">
              {Array.isArray(lote.tratamiento) ? lote.tratamiento.join(', ') : lote.tratamiento || 'Sin Tratar'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-600 font-medium">Stock disponible:</span>
            <span className="font-mono font-black text-[#00603C] text-sm bg-white px-2.5 py-0.5 rounded-md border border-[#00603C]/30">
              {bolsasOrigenDisponibles} bolsas ({formatKg(lote.stockKg)} kg)
            </span>
          </div>
        </div>

        {/* Formulario con Scroll */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-start gap-2.5 animate-in shake duration-150">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="text-xs font-semibold leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {/* 1. Seleccionar tipo de movimiento */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-2">
              1. Seleccione el Tipo de Movimiento
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Opción 1: Intermedio a Final */}
              <button
                type="button"
                id="btn-mov-intermedio-a-final"
                onClick={() => handleSelectTipoMovimiento('intermedio_a_final')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  tipoMovimiento === 'intermedio_a_final'
                    ? 'border-[#00603C] bg-[#E3EFE7] ring-2 ring-[#00603C]/20 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 text-xs">
                      1. Intermedio a Final
                    </span>
                    {tipoMovimiento === 'intermedio_a_final' && (
                      <CheckCircle2 className="w-4 h-4 text-[#00603C]" />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded">
                      Tipo: Final
                    </span>
                    <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded">
                      Sin Tratar
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    Pasa de Intermedio a Final sin curar. Descuenta bolsas del lote actual.
                  </p>
                </div>
              </button>

              {/* Opción 2: Intermedio a Final Tratado */}
              <button
                type="button"
                id="btn-mov-intermedio-a-final-tratado"
                onClick={() => handleSelectTipoMovimiento('intermedio_a_final_tratado')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  tipoMovimiento === 'intermedio_a_final_tratado'
                    ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 text-xs">
                      2. Intermedio a Final Tratado
                    </span>
                    {tipoMovimiento === 'intermedio_a_final_tratado' && (
                      <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded">
                      Tipo: Final
                    </span>
                    <span className="px-1.5 py-0.5 bg-purple-100 text-purple-800 text-[10px] font-bold rounded">
                      Tratado
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    Pasa de Intermedio a Final y aplica curasemilla químico.
                  </p>
                </div>
              </button>

              {/* Opción 3: Final a Final Tratado */}
              <button
                type="button"
                id="btn-mov-final-a-final-tratado"
                onClick={() => handleSelectTipoMovimiento('final_a_final_tratado')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  tipoMovimiento === 'final_a_final_tratado'
                    ? 'border-purple-600 bg-purple-50/70 ring-2 ring-purple-500/20 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 text-xs">
                      3. Final a Final Tratado
                    </span>
                    {tipoMovimiento === 'final_a_final_tratado' && (
                      <CheckCircle2 className="w-4 h-4 text-purple-600" />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">
                      Mantiene Final
                    </span>
                    <span className="px-1.5 py-0.5 bg-purple-100 text-purple-800 text-[10px] font-bold rounded">
                      Tratado
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    Toma bolsas de un lote Final existente y las cura con tratamiento químico.
                  </p>
                </div>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 2. Fecha de Movimiento */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1.5">
                Fecha del Movimiento <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  id="input-fecha-movimiento"
                  required
                  value={fechaMovimiento}
                  onChange={(e) => setFechaMovimiento(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 font-mono font-medium focus:ring-2 focus:ring-[#00603C] focus:border-[#00603C] transition shadow-2xs"
                />
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                Fecha efectiva registrada para la trazabilidad del movimiento.
              </span>
            </div>

            {/* 3. Nombre del Nuevo Lote (Modificable manualmente) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700">
                  Nombre del Nuevo Lote <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setNombreNuevoLote(suggestMovementLoteName(lote.loteNro, tipoMovimiento))}
                  className="text-[10px] text-[#00603C] hover:underline font-bold cursor-pointer"
                  title="Restablecer sugerencia automática"
                >
                  Restablecer
                </button>
              </div>
              <input
                type="text"
                id="input-nombre-nuevo-lote"
                required
                value={nombreNuevoLote}
                onChange={(e) => setNombreNuevoLote(e.target.value)}
                placeholder="Ej: ER01-FIN, ER01-TRA..."
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono font-black text-sm tracking-wide uppercase focus:ring-2 focus:ring-[#00603C] focus:border-[#00603C] transition shadow-2xs"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Conserva el nombre original y se puede modificar manualmente.
              </span>
            </div>
          </div>

          {/* 4. Cantidad de Bolsas a Transferir */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-800">
                Cantidad de Bolsas para el Nuevo Lote <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-500">Acceso rápido:</span>
                {[1, 5, 10, 20].map((num) => (
                  num <= bolsasOrigenDisponibles && (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setCantidadBolsas(num)}
                      className="px-2 py-0.5 bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 rounded text-[10px] font-bold transition cursor-pointer"
                    >
                      {num}
                    </button>
                  )
                ))}
                <button
                  type="button"
                  onClick={() => setCantidadBolsas(bolsasOrigenDisponibles)}
                  className="px-2 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-[#00603C] border border-emerald-300 rounded text-[10px] font-black transition cursor-pointer"
                >
                  Todo ({bolsasOrigenDisponibles})
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div>
                <div className="relative">
                  <input
                    type="number"
                    id="input-cantidad-bolsas-movimiento"
                    required
                    min={1}
                    max={bolsasOrigenDisponibles}
                    value={cantidadBolsas || ''}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setCantidadBolsas(isNaN(val) ? 0 : val);
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono font-black text-base focus:ring-2 focus:ring-[#00603C] focus:border-[#00603C] transition shadow-2xs"
                  />
                  <span className="absolute right-3 top-2.5 text-slate-400 font-bold text-xs pointer-events-none">
                    bolsas ({kgPorBolsa} kg/bolsa)
                  </span>
                </div>
              </div>

              {/* Indicador en tiempo real */}
              <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200 space-y-1">
                <div className="flex justify-between">
                  <span>Alta en nuevo lote:</span>
                  <strong className="text-emerald-700 font-mono font-bold">
                    {bolsasEgresadas} bolsas ({formatKg(kgNuevoLote)} kg)
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Remanente lote origen:</span>
                  <strong className="text-slate-800 font-mono">
                    {bolsasRemanentes} bolsas ({formatKg(kgRemanentes)} kg)
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* 5. Producto de Tratamiento (Condicional: para opciones 2 y 3) */}
          {requiereTratamiento && (
            <div className="p-3.5 bg-purple-50/60 border border-purple-200 rounded-xl animate-in fade-in-50">
              <label className="block text-[11px] font-black uppercase tracking-wider text-purple-950 mb-1.5">
                Producto Químico de Tratamiento <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="input-producto-tratamiento"
                  list="lista-productos-tratamiento"
                  required={requiereTratamiento}
                  value={productoTratamiento}
                  onChange={(e) => setProductoTratamiento(e.target.value)}
                  placeholder="Ej: Maxim Quattro + Inoculante, Cruiser Maxx..."
                  className="w-full px-3 py-2 bg-white border border-purple-300 rounded-xl text-slate-900 font-semibold text-xs focus:ring-2 focus:ring-purple-600 focus:border-purple-600 transition shadow-2xs"
                />
                <datalist id="lista-productos-tratamiento">
                  {productosSugeridos.map((prod) => (
                    <option key={prod} value={prod} />
                  ))}
                </datalist>
              </div>
              <span className="text-[10px] text-purple-800 mt-1 block">
                Este producto se asignará al lote generado y se reflejará en la columna "Producto Aplicado / Principio Activo" del Excel.
              </span>
            </div>
          )}

          {/* 6. Selección de Sector de Acopio / Ubicación del Nuevo Lote Generado */}
          <div className="p-3.5 bg-emerald-50/70 border border-emerald-300/80 rounded-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-[11px] font-black uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                <Warehouse className="w-4 h-4 text-[#00603C]" />
                Sector de Acopio / Ubicación del Nuevo Lote
              </label>
              <div className="flex items-center gap-1.5">
                {lote.ubicacionAcopio || lote.ala ? (
                  <button
                    type="button"
                    onClick={handleCopyUbicacionOrigen}
                    className="px-2 py-0.5 bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded text-[10px] font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs"
                    title="Asignar la misma ubicación del lote origen"
                  >
                    <ArrowRight className="w-3 h-3 text-[#00603C]" />
                    Copiar de Origen ({lote.ubicacionAcopio || (lote.ala && lote.sector ? `Ala ${lote.ala} · Sec. ${lote.sector}` : `Ala ${lote.ala}`)})
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setAlaNuevoLote('');
                    setSectorNuevoLote('');
                    setUbicacionAcopioNuevoLote('');
                  }}
                  className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded text-[10px] font-medium transition cursor-pointer"
                >
                  Limpiar
                </button>
              </div>
            </div>

            {/* Input de texto para Ubicación / Sector de Acopio */}
            <div>
              <div className="relative">
                <input
                  type="text"
                  id="input-ubicacion-nuevo-lote"
                  value={ubicacionAcopioNuevoLote}
                  onChange={(e) => setUbicacionAcopioNuevoLote(e.target.value)}
                  placeholder="Ej: Ala A · Sector 1, Acopio Central, Galpón 2..."
                  className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-slate-900 font-bold text-xs focus:ring-2 focus:ring-[#00603C] focus:border-[#00603C] transition shadow-2xs"
                />
              </div>
              <span className="text-[10px] text-emerald-800 mt-1 block">
                Especifique o seleccione la celda o sector de acopio donde se almacenará el nuevo lote.
              </span>
            </div>

            {/* Botones de Selección Rápida: Ala y Sector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 block mb-1">
                  Seleccionar Ala:
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {['A', 'B', 'C', 'D'].map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => handleSelectAla(a)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-black transition cursor-pointer border ${
                        alaNuevoLote === a
                          ? 'bg-[#00603C] text-white border-[#00603C] shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50 hover:border-emerald-300'
                      }`}
                    >
                      Ala {a}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 block mb-1">
                  Seleccionar Sector:
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {['1', '2', '3'].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleSelectSector(s)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-black transition cursor-pointer border ${
                        sectorNuevoLote === s
                          ? 'bg-[#00603C] text-white border-[#00603C] shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50 hover:border-emerald-300'
                      }`}
                    >
                      Sector {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Accesos rápidos de acopios comunes */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] font-semibold text-slate-500">Atajos rápidos:</span>
              {[
                { label: 'Ala A · Sector 1', ala: 'A', sec: '1' },
                { label: 'Ala A · Sector 2', ala: 'A', sec: '2' },
                { label: 'Ala B · Sector 1', ala: 'B', sec: '1' },
                { label: 'Ala B · Sector 2', ala: 'B', sec: '2' },
                { label: 'Acopio General', ala: '', sec: '' },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setAlaNuevoLote(preset.ala);
                    setSectorNuevoLote(preset.sec);
                    setUbicacionAcopioNuevoLote(preset.label);
                  }}
                  className="px-2 py-0.5 bg-white hover:bg-emerald-100 text-slate-700 hover:text-emerald-900 border border-slate-200 rounded-md text-[10px] font-medium transition cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* 7. Observaciones (Opcional) */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1.5">
              Observaciones del Movimiento (opcional)
            </label>
            <textarea
              rows={2}
              id="textarea-observaciones-movimiento"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Notas sobre el movimiento, operario responsable, condiciones del curado..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 text-xs focus:ring-2 focus:ring-[#00603C] focus:border-[#00603C] transition shadow-2xs resize-none"
            />
          </div>

          {/* Resumen Final de la Operación */}
          <div className="bg-slate-900 text-white p-3.5 rounded-xl text-xs space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-black text-[11px] uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Resumen de la Transacción de Stock</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-800 text-[11px]">
              <div>
                <div className="text-slate-400">Lote Origen ({lote.loteNro}):</div>
                <div className="font-semibold text-slate-200">
                  Egreso: -{bolsasEgresadas} bolsas · Quedan: {bolsasRemanentes} bolsas
                </div>
              </div>
              <div>
                <div className="text-slate-400">Nuevo Lote ({nombreNuevoLote || '—'}):</div>
                <div className="font-semibold text-emerald-400">
                  Alta: +{bolsasEgresadas} bolsas ({formatKg(kgNuevoLote)} kg) · {requiereTratamiento ? `Tratado (${productoTratamiento})` : 'Sin Tratar'}
                </div>
                <div className="text-[10px] text-emerald-300/90 mt-0.5 flex items-center gap-1 font-mono">
                  <Warehouse className="w-3 h-3 text-amber-300 shrink-0" />
                  <span>Ubicación: <strong>{ubicacionAcopioNuevoLote || (alaNuevoLote && sectorNuevoLote ? `Ala ${alaNuevoLote} · Sector ${sectorNuevoLote}` : 'No asignada')}</strong></span>
                </div>
              </div>
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl border border-slate-300 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              id="btn-confirmar-movimiento-lote"
              disabled={isSubmitting}
              className="px-5 py-2 bg-[#00603C] hover:bg-[#004d30] text-white font-black rounded-xl shadow-md transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-300 stroke-[2.5]" />
              <span>{isSubmitting ? 'Procesando...' : 'Confirmar Movimiento'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
