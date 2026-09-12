/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Lote, MovimientoStock, EstadoLoteType, OrdenCarga } from '../types';
import { formatNumberArg, formatDateStr } from '../utils/formatters';
import {
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Search,
  Filter,
  Calendar,
  Layers,
  FileSpreadsheet,
  Truck,
  RotateCcw,
  User,
  Package,
  AlertCircle,
  X,
  CheckCircle,
  CheckCircle2,
  Edit3,
  Trash2,
  Clock,
} from 'lucide-react';
import * as XLSX from 'xlsx';

export interface BitacoraRegistro {
  id: string;
  direccion: 'Entrada' | 'Salida';
  fecha: string; // YYYY-MM-DD
  tipoMovimiento: 'Alta' | 'Salida manual' | 'Despacho' | 'Salida por movimiento' | 'Pasado a Consumo' | 'Ajuste de Auditoría';
  cantidadBolsas: number;
  cantidadKg: number;
  esPrecarga?: boolean; // Indica si es una precarga preliminar informativa que no suma stock
  remitoCliente?: string;
  destino?: string;
  chofer?: string;
  detalle?: string;
  ordenId?: string;
}

interface BitacoraMovimientosTableProps {
  lote: Lote;
  ordenesCarga?: OrdenCarga[];
  onUpdateLoteStock: (
    loteId: string,
    nuevosMovimientos: MovimientoStock[],
    nuevoStockBolsas: number,
    nuevoStockKg: number,
    nuevoEstado: EstadoLoteType
  ) => void;
  onSaveLote?: (lote: Lote) => Promise<void> | void;
  readOnly?: boolean;
}

// Formatear fecha YYYY-MM-DD a formato estricto dd/mm/aaaa
export const formatToDDMMAAAA = (dateStr: string): string => {
  if (!dateStr) return '—';
  try {
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      const [yyyy, mm, dd] = parts;
      return `${dd.padStart(2, '0')}/${mm.padStart(2, '0')}/${yyyy}`;
    }
  } catch (e) {
    // Fallback
  }
  return dateStr;
};

export const BitacoraMovimientosTable: React.FC<BitacoraMovimientosTableProps> = ({
  lote,
  ordenesCarga,
  onUpdateLoteStock,
  onSaveLote,
  readOnly = false,
}) => {
  // Estado para modal de confirmación "Pasar a Realizado (Dar de Alta Bolsas)"
  const [showConfirmRealizadoModal, setShowConfirmRealizadoModal] = useState<boolean>(false);
  const [fechaRealizadoConfirm, setFechaRealizadoConfirm] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [isActivatingRealizado, setIsActivatingRealizado] = useState<boolean>(false);

  // Estados de filtros
  const [filterDireccion, setFilterDireccion] = useState<'' | 'Entrada' | 'Salida'>('');
  const [filterTipoMov, setFilterTipoMov] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Estados del Modal "Registrar / Modificar Movimiento en Bitácora"
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingRecord, setEditingRecord] = useState<BitacoraRegistro | null>(null);
  const [formDireccion, setFormDireccion] = useState<'Entrada' | 'Salida'>('Salida');
  const [formFecha, setFormFecha] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [formTipoMov, setFormTipoMov] = useState<
    'Alta' | 'Salida manual' | 'Despacho' | 'Salida por movimiento'
  >('Salida manual');
  const [formBolsas, setFormBolsas] = useState<number>(10);
  const [formKg, setFormKg] = useState<number>(
    10 * (lote.kgPorBolsa || 40)
  );
  const [formRemitoCliente, setFormRemitoCliente] = useState<string>('');
  const [formDestino, setFormDestino] = useState<string>('');
  const [formChofer, setFormChofer] = useState<string>('');
  const [formDetalle, setFormDetalle] = useState<string>('');
  const [formError, setFormError] = useState<string>('');

  // Estado para modal de eliminación con confirmación obligatoria (check + frase)
  const [deletingRecord, setDeletingRecord] = useState<BitacoraRegistro | null>(null);
  const [deleteConfirmChecked, setDeleteConfirmChecked] = useState<boolean>(false);
  const [deleteConfirmPhrase, setDeleteConfirmPhrase] = useState<string>('');

  const handleAbrirNuevo = () => {
    setEditingRecord(null);
    setFormDireccion('Salida');
    setFormFecha(new Date().toISOString().split('T')[0]);
    setFormTipoMov('Pasado a Consumo');
    setFormBolsas(10);
    setFormKg(10 * (lote.kgPorBolsa || 40));
    setFormRemitoCliente('');
    setFormDestino('Consumo Interno / Descarte');
    setFormChofer('');
    setFormDetalle('');
    setFormError('');
    setShowModal(true);
  };

  const handleAbrirEditar = (row: BitacoraRegistro) => {
    setEditingRecord(row);
    setFormDireccion(row.direccion);
    setFormFecha(row.fecha || new Date().toISOString().split('T')[0]);
    setFormTipoMov(row.tipoMovimiento === 'Salida manual' ? 'Pasado a Consumo' : row.tipoMovimiento);
    setFormBolsas(row.cantidadBolsas);
    setFormKg(row.cantidadKg);
    setFormRemitoCliente(row.remitoCliente && row.remitoCliente !== '-' ? row.remitoCliente : '');
    setFormDestino(row.destino && row.destino !== '-' ? row.destino : '');
    setFormChofer(row.chofer || '');
    setFormDetalle(row.detalle || '');
    setFormError('');
    setShowModal(true);
  };

  const handleAbrirEliminar = (row: BitacoraRegistro) => {
    setDeletingRecord(row);
    setDeleteConfirmChecked(false);
    setDeleteConfirmPhrase('');
  };

  // Sincronizar dropdown condicionado cuando cambia Entrada / Salida
  const handleDireccionChange = (nuevaDir: 'Entrada' | 'Salida') => {
    setFormDireccion(nuevaDir);
    setFormError('');
    if (nuevaDir === 'Entrada') {
      setFormTipoMov('Alta');
    } else {
      setFormTipoMov('Pasado a Consumo');
    }
  };

  // Sincronizar kilos al cambiar bolsas en el formulario
  const handleBolsasChange = (val: number) => {
    const bolsas = Math.max(1, Math.round(val));
    setFormBolsas(bolsas);
    const factor = lote.kgPorBolsa || 40;
    setFormKg(Math.round(bolsas * factor * 100) / 100);
  };

  // Construir la lista completa y unificada de la Bitácora
  const bitacoraList = useMemo(() => {
    const list: BitacoraRegistro[] = [];
    const esLotePrecarga = lote.estadoRegistro === 'PRE-CARGA';

    // Detectar si existe un movimiento formal de pase a realizado
    const hasRealizadoMov = (lote.historial || []).some((m) => {
      const idL = (m.id || '').toLowerCase();
      const detL = (m.detalle || '').toLowerCase();
      return (
        idL.startsWith('mov-proc-') ||
        idL.startsWith('mov-real-') ||
        detL.includes('pase a') ||
        detL.includes('mov realizado')
      );
    });

    // 1. Incorporar movimientos desde lote.historial
    (lote.historial || []).forEach((mov) => {
      const tipoLower = (mov.tipo || '').toLowerCase();
      const detLower = (mov.detalle || '').toLowerCase();
      const idLower = (mov.id || '').toLowerCase();
      const isAjuste = tipoLower.includes('ajuste') || detLower.includes('ajuste');

      const isPrecargaPlaceholder =
        idLower.startsWith('mov-pre-') ||
        detLower.includes('precarga') ||
        detLower.includes('pre-carga') ||
        tipoLower.includes('precarga') ||
        (detLower.includes('carga inicial') && (esLotePrecarga || hasRealizadoMov));

      // Si el lote ya está REALIZADO y tiene un movimiento de realización,
      // omitir el placeholder previo de precarga para no duplicar el alta ni el stock
      if (!esLotePrecarga && hasRealizadoMov && isPrecargaPlaceholder) {
        return;
      }

      let direccion: 'Entrada' | 'Salida' = 'Salida';
      let tipoMov: 'Alta' | 'Salida manual' | 'Despacho' | 'Salida por movimiento' | 'Pasado a Consumo' | 'Ajuste de Auditoría' = 'Pasado a Consumo';
      let esPrecargaMov = false;

      if (isAjuste) {
        tipoMov = 'Ajuste de Auditoría';
        const esResta =
          mov.cantidadBolsas < 0 ||
          tipoLower.includes('salida') ||
          detLower.includes('salida') ||
          detLower.includes('resta') ||
          detLower.includes('disminuye');
        direccion = esResta ? 'Salida' : 'Entrada';
      } else {
        const esEntrada =
          tipoLower.includes('alta') ||
          tipoLower.includes('ingreso') ||
          tipoLower.includes('creación') ||
          tipoLower.includes('creacion') ||
          tipoLower.includes('entrada') ||
          tipoLower.includes('precarga') ||
          mov.tipo === 'Reingreso';

        const esSalida =
          tipoLower.includes('salida') ||
          tipoLower.includes('consumo') ||
          tipoLower.includes('descarte') ||
          tipoLower.includes('despacho') ||
          mov.tipoSalida !== undefined;

        if (esEntrada && !esSalida) {
          direccion = 'Entrada';
          tipoMov = 'Alta';
          // Las bolsas se dan de alta formalmente en el lote al pasar a realizado.
          // En estado de precarga, son informativas y no suman a ingresos comerciales.
          if (esLotePrecarga) {
            esPrecargaMov = true;
          } else {
            esPrecargaMov = false;
          }
        } else {
          direccion = 'Salida';
          if (
            mov.tipoSalida === 'movimiento' ||
            tipoLower.includes('movimiento') ||
            detLower.includes('movimiento') ||
            detLower.includes('transferencia')
          ) {
            tipoMov = 'Salida por movimiento';
          } else if (
            mov.tipoSalida === 'despacho' ||
            tipoLower.includes('despacho') ||
            detLower.includes('despacho') ||
            detLower.includes('remito') ||
            mov.ordenId?.startsWith('OC-')
          ) {
            tipoMov = 'Despacho';
          } else {
            tipoMov = 'Pasado a Consumo';
          }
        }
      }

      list.push({
        id: mov.id,
        direccion,
        fecha: mov.fecha,
        tipoMovimiento: tipoMov,
        esPrecarga: esPrecargaMov,
        cantidadBolsas: Math.abs(mov.cantidadBolsas),
        cantidadKg: Math.abs(mov.cantidadKg),
        remitoCliente: mov.remitoCliente,
        destino: mov.destino,
        chofer: mov.chofer,
        detalle: esPrecargaMov && !mov.detalle?.includes('Pre-carga')
          ? `${mov.detalle || 'Alta preliminar'} (Pre-carga informativa)`
          : mov.detalle,
        ordenId: mov.ordenId,
      });
    });

    // 2. Incorporar Órdenes de Carga despachadas que apliquen a este lote
    if (ordenesCarga) {
      ordenesCarga
        .filter((o) => o.estado === 'Despachada')
        .forEach((o) => {
          const itemOrigen = o.lotesOrigen?.find(
            (lo) => lo.loteId === lote.id || lo.loteNro === lote.loteNro
          );
          const matchesSingle = o.loteId === lote.id || o.loteId === lote.loteNro;

          if (itemOrigen || matchesSingle) {
            const yaEnLista = list.some(
              (item) => item.ordenId === o.id || (item.detalle && item.detalle.includes(o.id))
            );
            if (!yaEnLista) {
              const b = itemOrigen ? itemOrigen.cantidadBolsas : o.cantidadBolsas;
              const k = itemOrigen ? itemOrigen.kgTotales : o.kgTotales;
              list.push({
                id: `OC-${o.id}`,
                direccion: 'Salida',
                fecha: o.fecha,
                tipoMovimiento: 'Despacho',
                cantidadBolsas: b,
                cantidadKg: k,
                remitoCliente: o.remitoCliente || '-',
                destino: o.destino || '-',
                chofer: o.chofer,
                detalle: `Despacho según Orden de Carga ${o.id}`,
                ordenId: o.id,
              });
            }
          }
        });
    }

    // 3. Si no existe ningún movimiento de "Alta", sintetizar el Alta inicial del lote
    const hasAlta = list.some((m) => m.tipoMovimiento === 'Alta');
    if (!hasAlta) {
      if (esLotePrecarga) {
        list.push({
          id: `alta-precarga-${lote.id}`,
          direccion: 'Entrada',
          fecha: lote.fechaIngreso || new Date().toISOString().split('T')[0],
          tipoMovimiento: 'Alta',
          esPrecarga: true,
          cantidadBolsas: lote.stockBolsas,
          cantidadKg: lote.stockKg || lote.stockBolsas * (lote.kgPorBolsa || 40),
          detalle: 'Alta preliminar en Pre-carga (Informativa - no suma a ingresos)',
        });
      } else {
        const totalSalidasBolsas = list
          .filter((m) => m.direccion === 'Salida')
          .reduce((acc, m) => acc + m.cantidadBolsas, 0);

        const bolsasIniciales = Math.max(lote.stockBolsas, lote.stockBolsas + totalSalidasBolsas);
        const kgIniciales = bolsasIniciales * (lote.kgPorBolsa || 40);

        list.push({
          id: `alta-inicial-${lote.id}`,
          direccion: 'Entrada',
          fecha: lote.fechaIngreso || new Date().toISOString().split('T')[0],
          tipoMovimiento: 'Alta',
          esPrecarga: false,
          cantidadBolsas: bolsasIniciales,
          cantidadKg: kgIniciales,
          detalle: 'Alta de bolsas en planta (Lote Realizado)',
        });
      }
    }

    return list;
  }, [lote, ordenesCarga]);

  // Lista filtrada y ordenada
  const filteredList = useMemo(() => {
    let result = [...bitacoraList];

    if (filterDireccion) {
      result = result.filter((item) => item.direccion === filterDireccion);
    }

    if (filterTipoMov) {
      if (filterTipoMov === 'Pasado a Consumo') {
        result = result.filter(
          (item) => item.tipoMovimiento === 'Pasado a Consumo' || item.tipoMovimiento === 'Salida manual'
        );
      } else {
        result = result.filter((item) => item.tipoMovimiento === filterTipoMov);
      }
    }

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      result = result.filter((item) => {
        return (
          item.tipoMovimiento.toLowerCase().includes(q) ||
          item.fecha.includes(q) ||
          formatToDDMMAAAA(item.fecha).includes(q) ||
          (item.remitoCliente && item.remitoCliente.toLowerCase().includes(q)) ||
          (item.destino && item.destino.toLowerCase().includes(q)) ||
          (item.chofer && item.chofer.toLowerCase().includes(q)) ||
          (item.detalle && item.detalle.toLowerCase().includes(q))
        );
      });
    }

    result.sort((a, b) => {
      const cmp = (b.fecha || '').localeCompare(a.fecha || '');
      return sortOrder === 'desc' ? cmp : -cmp;
    });

    return result;
  }, [bitacoraList, filterDireccion, filterTipoMov, searchTerm, sortOrder]);

  // Métricas de totales de la bitácora:
  // - Total Egresado (Salidas): incluye Despachos, Movimientos y Pasado a Consumo / Descarte
  // - Si el lote está en PRE-CARGA, las bolsas son sólo informativas y no suman a ingresos comerciales
  // - Ajustes por Auditoría NO se suman a los ingresos ni egresos comerciales
  const metrics = useMemo(() => {
    const esLotePrecarga = lote.estadoRegistro === 'PRE-CARGA';

    const totalEntradasBolsas = esLotePrecarga
      ? 0
      : bitacoraList
          .filter((m) => m.direccion === 'Entrada' && m.tipoMovimiento !== 'Ajuste de Auditoría' && !m.esPrecarga)
          .reduce((acc, m) => acc + m.cantidadBolsas, 0);

    const totalEntradasKg = esLotePrecarga
      ? 0
      : bitacoraList
          .filter((m) => m.direccion === 'Entrada' && m.tipoMovimiento !== 'Ajuste de Auditoría' && !m.esPrecarga)
          .reduce((acc, m) => acc + m.cantidadKg, 0);

    const totalSalidasBolsas = bitacoraList
      .filter((m) => m.direccion === 'Salida' && m.tipoMovimiento !== 'Ajuste de Auditoría')
      .reduce((acc, m) => acc + m.cantidadBolsas, 0);

    const totalSalidasKg = bitacoraList
      .filter((m) => m.direccion === 'Salida' && m.tipoMovimiento !== 'Ajuste de Auditoría')
      .reduce((acc, m) => acc + m.cantidadKg, 0);

    return {
      entradasBolsas: totalEntradasBolsas,
      entradasKg: totalEntradasKg,
      salidasBolsas: totalSalidasBolsas,
      salidasKg: totalSalidasKg,
    };
  }, [bitacoraList, lote.estadoRegistro]);

  // Helper para recalcular stock a partir del historial completo
  const recalcularStockLote = (hist: MovimientoStock[]) => {
    // Si el lote está en PRE-CARGA, las bolsas son sólo informativas
    if (lote.estadoRegistro === 'PRE-CARGA') {
      return {
        nuevoStockBolsas: lote.stockBolsas,
        nuevoStockKg: lote.stockKg,
        nuevoEstado: 'Disponible' as EstadoLoteType,
      };
    }

    const hasRealizadoMov = hist.some((m) => {
      const idL = (m.id || '').toLowerCase();
      const detL = (m.detalle || '').toLowerCase();
      return (
        idL.startsWith('mov-proc-') ||
        idL.startsWith('mov-real-') ||
        detL.includes('pase a') ||
        detL.includes('mov realizado')
      );
    });

    const histFiltrado = hist.filter((m) => {
      if (!hasRealizadoMov) return true;
      const idL = (m.id || '').toLowerCase();
      const detL = (m.detalle || '').toLowerCase();
      const tipoL = (m.tipo || '').toLowerCase();
      const isPrecargaPlaceholder =
        idL.startsWith('mov-pre-') ||
        detL.includes('precarga') ||
        detL.includes('pre-carga') ||
        detL.includes('carga inicial') ||
        tipoL.includes('precarga');
      return !isPrecargaPlaceholder;
    });

    let entradasB = 0;
    let salidasB = 0;
    let entradasK = 0;
    let salidasK = 0;
    let ajustesNetoB = 0;
    let ajustesNetoK = 0;

    for (const m of histFiltrado) {
      const tipoLower = (m.tipo || '').toLowerCase();
      const detLower = (m.detalle || '').toLowerCase();
      const isAjuste = tipoLower.includes('ajuste') || detLower.includes('ajuste');

      if (isAjuste) {
        const esResta =
          m.cantidadBolsas < 0 ||
          tipoLower.includes('salida') ||
          detLower.includes('salida') ||
          detLower.includes('resta') ||
          detLower.includes('disminuye');
        if (esResta) {
          ajustesNetoB -= Math.abs(m.cantidadBolsas);
          ajustesNetoK -= Math.abs(m.cantidadKg);
        } else {
          ajustesNetoB += Math.abs(m.cantidadBolsas);
          ajustesNetoK += Math.abs(m.cantidadKg);
        }
      } else {
        const isSal =
          tipoLower.includes('salida') ||
          tipoLower.includes('consumo') ||
          tipoLower.includes('descarte') ||
          tipoLower.includes('despacho') ||
          m.tipoSalida !== undefined ||
          m.cantidadBolsas < 0;

        if (isSal) {
          salidasB += Math.abs(m.cantidadBolsas);
          salidasK += Math.abs(m.cantidadKg);
        } else {
          entradasB += Math.abs(m.cantidadBolsas);
          entradasK += Math.abs(m.cantidadKg);
        }
      }
    }

    if (entradasB === 0 && lote.stockBolsas > 0) {
      entradasB = lote.stockBolsas + salidasB;
      entradasK = lote.stockKg > 0 ? (lote.stockKg + salidasK) : (entradasB * (lote.kgPorBolsa || 40));
    }

    const nuevoStockBolsas = Math.max(0, entradasB - salidasB + ajustesNetoB);
    const nuevoStockKg = Math.max(0, entradasK - salidasK + ajustesNetoK);
    const nuevoEstado: EstadoLoteType = nuevoStockBolsas === 0 ? 'Agotado' : 'Disponible';
    return { nuevoStockBolsas, nuevoStockKg, nuevoEstado };
  };

  // Función para confirmar y dar de alta bolsas al pasar a REALIZADO
  const handleConfirmarRealizado = async () => {
    setIsActivatingRealizado(true);
    try {
      const bolsas = lote.stockBolsas > 0 ? lote.stockBolsas : 1;
      const kgB = lote.kgPorBolsa || 40;
      const kgTot = lote.stockKg > 0 ? lote.stockKg : bolsas * kgB;
      const fechaEf = fechaRealizadoConfirm || new Date().toISOString().split('T')[0];

      const nuevoMov: MovimientoStock = {
        id: `MOV-REAL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        fecha: fechaEf,
        tipo: 'Alta',
        cantidadBolsas: bolsas,
        kgPorBolsa: kgB,
        cantidadKg: kgTot,
        detalle: `Alta efectiva de bolsas (Pasado a Realizado el ${fechaEf})`,
      };

      const historialLimpio = (lote.historial || []).filter((m) => {
        const idL = (m.id || '').toLowerCase();
        const detL = (m.detalle || '').toLowerCase();
        const tipoL = (m.tipo || '').toLowerCase();
        return !(
          idL.startsWith('mov-pre') ||
          idL.startsWith('alta-precarga') ||
          tipoL.includes('precarga') ||
          detL.includes('precarga') ||
          detL.includes('pre-carga') ||
          detL.includes('carga inicial')
        );
      });

      const nuevoHistorial = [nuevoMov, ...historialLimpio];

      const loteRealizado: Lote = {
        ...lote,
        estadoRegistro: 'REALIZADO',
        fechaIngreso: fechaEf,
        fechaHoraProduccion: `${fechaEf}T${new Date().toTimeString().slice(0, 5)}`,
        stockBolsas: bolsas,
        kgPorBolsa: kgB,
        stockKg: kgTot,
        estado: bolsas > 0 ? 'Disponible' : 'Agotado',
        historial: nuevoHistorial,
        auditoria: [
          {
            id: `AUD-REAL-${Date.now()}`,
            fechaHora: new Date().toISOString(),
            tipo: 'Edición',
            usuario: 'Operador Planta',
            descripcion: `Lote pasado a REALIZADO: Alta efectiva de ${bolsas} bolsas (${kgTot} kg).`,
          },
          ...(lote.auditoria || []),
        ],
      };

      if (onSaveLote) {
        await onSaveLote(loteRealizado);
      }
      onUpdateLoteStock(lote.id, nuevoHistorial, bolsas, kgTot, 'Disponible');
      setShowConfirmRealizadoModal(false);
    } catch (e) {
      console.error('Error al pasar a realizado:', e);
    } finally {
      setIsActivatingRealizado(false);
    }
  };

  // Guardar (crear o modificar) movimiento desde el formulario modal
  const handleGuardarMovimiento = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (formBolsas <= 0 || !Number.isInteger(formBolsas)) {
      setFormError('La cantidad de bolsas debe ser un número entero mayor a 0.');
      return;
    }

    if (formKg <= 0 || isNaN(formKg)) {
      setFormError('La cantidad de kilos debe ser un número decimal mayor a 0.');
      return;
    }

    const deltaBolsas = formDireccion === 'Entrada' ? formBolsas : -formBolsas;
    const deltaKg = formDireccion === 'Entrada' ? formKg : -formKg;

    // Obtener historial base
    let baseHistory: MovimientoStock[] =
      lote.historial && lote.historial.length > 0
        ? [...lote.historial]
        : [
            {
              id: `MOV-ALTA-${lote.id}`,
              fecha: lote.fechaIngreso || new Date().toISOString().split('T')[0],
              tipo: 'Alta',
              cantidadBolsas: lote.stockBolsas,
              kgPorBolsa: lote.kgPorBolsa || 40,
              cantidadKg: lote.stockKg,
              detalle: 'Alta de lote en planta',
            },
          ];

    let nuevoHistorial: MovimientoStock[] = [];

    if (editingRecord) {
      // Modo Modificar
      const matchIndex = baseHistory.findIndex(
        (m) =>
          m.id === editingRecord.id ||
          (editingRecord.id && m.id && editingRecord.id.includes(m.id)) ||
          (editingRecord.id && m.id && m.id.includes(editingRecord.id))
      );

      const movModificado: MovimientoStock = {
        id: editingRecord.id || `MOV-${Date.now()}`,
        fecha: formFecha,
        tipo: formTipoMov,
        cantidadBolsas: deltaBolsas,
        kgPorBolsa: lote.kgPorBolsa || 40,
        cantidadKg: deltaKg,
        remitoCliente: formRemitoCliente.trim() || undefined,
        destino: formDestino.trim() || undefined,
        chofer: formChofer.trim() || undefined,
        detalle: formDetalle.trim() || `${formTipoMov} modificada en bitácora`,
        tipoSalida:
          formDireccion === 'Salida' && formTipoMov !== 'Ajuste de Auditoría'
            ? formTipoMov === 'Despacho'
              ? 'despacho'
              : formTipoMov === 'Salida por movimiento'
              ? 'movimiento'
              : 'consumo'
            : undefined,
      };

      if (matchIndex >= 0) {
        nuevoHistorial = [...baseHistory];
        nuevoHistorial[matchIndex] = movModificado;
      } else {
        nuevoHistorial = [movModificado, ...baseHistory];
      }
    } else {
      // Modo Nuevo Movimiento
      const nuevoMovimiento: MovimientoStock = {
        id: `MOV-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        fecha: formFecha,
        tipo: formTipoMov,
        cantidadBolsas: deltaBolsas,
        kgPorBolsa: lote.kgPorBolsa || 40,
        cantidadKg: deltaKg,
        remitoCliente: formRemitoCliente.trim() || undefined,
        destino: formDestino.trim() || undefined,
        chofer: formChofer.trim() || undefined,
        detalle: formDetalle.trim() || `${formTipoMov} registrada en bitácora`,
        tipoSalida:
          formDireccion === 'Salida' && formTipoMov !== 'Ajuste de Auditoría'
            ? formTipoMov === 'Despacho'
              ? 'despacho'
              : formTipoMov === 'Salida por movimiento'
              ? 'movimiento'
              : 'consumo'
            : undefined,
      };
      nuevoHistorial = [nuevoMovimiento, ...baseHistory];
    }

    const { nuevoStockBolsas, nuevoStockKg, nuevoEstado } = recalcularStockLote(nuevoHistorial);

    onUpdateLoteStock(lote.id, nuevoHistorial, nuevoStockBolsas, nuevoStockKg, nuevoEstado);

    // Limpiar y cerrar modal
    setShowModal(false);
    setEditingRecord(null);
    setFormRemitoCliente('');
    setFormDestino('');
    setFormChofer('');
    setFormDetalle('');
    setFormError('');
  };

  // Confirmar eliminación definitiva con check y frase requerida: "eliminar movimiento"
  const handleConfirmarEliminar = () => {
    if (!deletingRecord) return;
    if (!deleteConfirmChecked || deleteConfirmPhrase.trim().toLowerCase() !== 'eliminar movimiento') {
      return;
    }

    const recordId = deletingRecord.id;

    let baseHistory: MovimientoStock[] =
      lote.historial && lote.historial.length > 0
        ? [...lote.historial]
        : [
            {
              id: `MOV-ALTA-${lote.id}`,
              fecha: lote.fechaIngreso || new Date().toISOString().split('T')[0],
              tipo: 'Alta',
              cantidadBolsas: lote.stockBolsas,
              kgPorBolsa: lote.kgPorBolsa || 40,
              cantidadKg: lote.stockKg,
              detalle: 'Alta de lote en planta',
            },
          ];

    const nuevoHistorial = baseHistory.filter(
      (m) =>
        m.id !== recordId &&
        (!recordId.includes(m.id) || recordId.startsWith('OC-'))
    );

    const { nuevoStockBolsas, nuevoStockKg, nuevoEstado } = recalcularStockLote(nuevoHistorial);

    onUpdateLoteStock(lote.id, nuevoHistorial, nuevoStockBolsas, nuevoStockKg, nuevoEstado);

    setDeletingRecord(null);
    setDeleteConfirmChecked(false);
    setDeleteConfirmPhrase('');
  };

  // Exportar Bitácora a Excel
  const handleExportExcel = () => {
    const dataToExport = filteredList.map((item) => ({
      'Entrada/Salida': item.direccion,
      'Fecha': formatToDDMMAAAA(item.fecha),
      'Tipo de movimiento': item.tipoMovimiento,
      'Cantidad de bolsas ingresadas/salidas':
        (item.direccion === 'Entrada' ? '+' : '-') + item.cantidadBolsas,
      'Kilos ingresados/salida':
        (item.direccion === 'Entrada' ? '+' : '-') + item.cantidadKg.toFixed(2),
      'N° Remito Cliente': item.remitoCliente || '—',
      'Destino': item.destino || '—',
      'Chofer': item.chofer || '—',
      'Detalle / Observaciones': item.detalle || '—',
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bitácora');
    XLSX.writeFile(wb, `Bitacora_Lote_${lote.loteNro}_${lote.cliente}.xlsx`);
  };

  return (
    <div className="space-y-4">
      {/* CABECERA Y METRICAS DE BITACORA */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-sans font-bold tracking-wider text-[#00603C] uppercase bg-[#E3EFE7] px-2 py-0.5 rounded">
              Auditoría y Trazabilidad de Lote
            </span>
            <span className="text-xs text-gray-400 font-mono">
              Lote #{lote.loteNro} · {lote.cliente}
            </span>
          </div>
          <h4 className="font-serif text-base font-bold text-[#1A1A1A] mt-1 flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#00603C]" />
            Bitácora Completa de Movimientos
          </h4>
          <p className="text-xs text-gray-500 mt-0.5">
            Registro unificado de todos los ingresos y egresos de bolsas y kilos del lote.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Exportar bitácora completa a Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#00603C]" />
            <span>Exportar Excel</span>
          </button>

          {!readOnly && (
            <div className="flex items-center gap-2">
              {lote.estadoRegistro === 'PRE-CARGA' && (
                <button
                  type="button"
                  onClick={() => setShowConfirmRealizadoModal(true)}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition cursor-pointer active:scale-95 border border-emerald-500"
                  title="Pasar a Realizado: Dar de alta bolsas y sumar a movimientos de Total Ingresado (Alta)"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                  <span>Pasar a Realizado</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleAbrirNuevo}
                className="px-3.5 py-1.5 bg-gradient-to-r from-[#00603C] to-[#004D30] hover:from-[#004D30] hover:to-[#003822] text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Registrar Movimiento</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MINI TARJETAS DE BALANCE DE ENTRADAS Y SALIDAS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Total Ingresado (Alta) */}
        <div className={`p-3 rounded-xl border ${
          lote.estadoRegistro === 'PRE-CARGA'
            ? 'bg-amber-50/50 border-amber-200'
            : 'bg-[#E3EFE7]/40 border-emerald-200/70'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
              lote.estadoRegistro === 'PRE-CARGA' ? 'text-amber-800' : 'text-[#00603C]'
            }`}>
              <ArrowUpRight className="w-3 h-3" /> Total Ingresado (Alta)
            </span>
            <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.25 rounded ${
              lote.estadoRegistro === 'PRE-CARGA'
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : 'bg-emerald-100 text-emerald-800'
            }`}>
              {lote.estadoRegistro === 'PRE-CARGA' ? 'Pre-carga (Informativo)' : 'Efectivo'}
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={`font-mono text-lg font-bold ${
              lote.estadoRegistro === 'PRE-CARGA' ? 'text-amber-700' : 'text-[#00603C]'
            }`}>
              +{formatNumberArg(metrics.entradasBolsas, 0)} <span className="text-xs font-normal">bolsas</span>
            </span>
            <span className={`text-xs font-mono font-medium ${
              lote.estadoRegistro === 'PRE-CARGA' ? 'text-amber-600' : 'text-emerald-700'
            }`}>
              (+{formatNumberArg(metrics.entradasKg, 0)} kg)
            </span>
          </div>
          {lote.estadoRegistro === 'PRE-CARGA' && (
            <>
              <p className="text-[10px] text-amber-700 font-medium mt-1">
                Informativo: {formatNumberArg(lote.stockBolsas, 0)} b. en Pre-carga (se activan al pasar a REALIZADO)
              </p>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => setShowConfirmRealizadoModal(true)}
                  className="mt-2.5 w-full py-1.5 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg shadow-xs flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 border border-emerald-500"
                  title="Pasar a Realizado: Dar de alta bolsas y sumar a Total Ingresado (Alta)"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                  <span>Pasar a Realizado (Dar de Alta Bolsas)</span>
                </button>
              )}
            </>
          )}
        </div>

        {/* Total Egresado (Salidas) */}
        <div className="bg-[#F6EFDC]/40 border border-[#C9922E]/30 p-3 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#A0522D] flex items-center gap-1">
              <ArrowDownRight className="w-3 h-3" /> Total Egresado (Salidas)
            </span>
            <span className="text-[10px] font-mono text-[#A0522D] font-semibold bg-amber-100 px-1.5 py-0.25 rounded">
              Salidas
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-lg font-bold text-[#A0522D]">
              -{formatNumberArg(metrics.salidasBolsas, 0)} <span className="text-xs font-normal">bolsas</span>
            </span>
            <span className="text-xs font-mono font-medium text-amber-800">
              (-{formatNumberArg(metrics.salidasKg, 0)} kg)
            </span>
          </div>
        </div>

        {/* Stock Disponible Actual */}
        <div className={`p-3 rounded-xl border shadow-2xs ${
          lote.estadoRegistro === 'PRE-CARGA'
            ? 'bg-amber-50/30 border-amber-200'
            : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1">
              <Package className="w-3 h-3" /> Stock Disponible Actual
            </span>
            <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.25 rounded ${
              lote.estadoRegistro === 'PRE-CARGA'
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : 'bg-gray-100 text-gray-600'
            }`}>
              {lote.estadoRegistro === 'PRE-CARGA' ? 'PRE-CARGA' : lote.estado}
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-lg font-bold text-gray-900">
              {formatNumberArg(lote.stockBolsas, 0)} <span className="text-xs font-normal">bolsas</span>
            </span>
            <span className="text-xs font-mono font-medium text-gray-600">
              ({formatNumberArg(lote.stockKg, 0)} kg)
            </span>
          </div>
          {lote.estadoRegistro === 'PRE-CARGA' && (
            <p className="text-[10px] text-amber-600 font-medium mt-1">
              Bolsas informativas (pendientes de activar al Pasar a Realizado)
            </p>
          )}
        </div>
      </div>

      {/* BARRA DE FILTROS Y CONTROLES */}
      <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Selector Entrada / Salida */}
          <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={() => setFilterDireccion('')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                filterDireccion === ''
                  ? 'bg-white text-gray-900 shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Todos ({bitacoraList.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterDireccion('Entrada')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                filterDireccion === 'Entrada'
                  ? 'bg-[#00603C] text-white shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <ArrowUpRight className="w-3 h-3" />
              Entradas
            </button>
            <button
              type="button"
              onClick={() => setFilterDireccion('Salida')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                filterDireccion === 'Salida'
                  ? 'bg-[#A0522D] text-white shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <ArrowDownRight className="w-3 h-3" />
              Salidas
            </button>
          </div>

          {/* Selector Tipo de Movimiento */}
          <div className="relative">
            <select
              value={filterTipoMov}
              onChange={(e) => setFilterTipoMov(e.target.value)}
              className="pl-2.5 pr-7 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#00603C]"
            >
              <option value="">Todos los Tipos de Movimiento</option>
              <option value="Alta">Alta</option>
              <option value="Pasado a Consumo">Pasado a Consumo</option>
              <option value="Salida por movimiento">Movimientos (Salida)</option>
              <option value="Despacho">Despachos</option>
              <option value="Ajuste de Auditoría">Ajuste de Auditoría</option>
            </select>
          </div>

          {/* Búsqueda rápida */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por remito, chofer, destino..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs w-48 sm:w-64 focus:outline-none focus:ring-1 focus:ring-[#00603C]"
            />
          </div>

          {(filterDireccion || filterTipoMov || searchTerm) && (
            <button
              type="button"
              onClick={() => {
                setFilterDireccion('');
                setFilterTipoMov('');
                setSearchTerm('');
              }}
              className="text-gray-400 hover:text-gray-600 p-1 rounded transition cursor-pointer"
              title="Limpiar filtros"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-gray-500 text-[11px]">
          <span>Orden:</span>
          <button
            type="button"
            onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded font-semibold text-gray-800 transition cursor-pointer"
          >
            {sortOrder === 'desc' ? 'Fecha más reciente primero' : 'Fecha más antigua primero'}
          </button>
        </div>
      </div>

      {/* TABLA PRINCIPAL DE LA BITÁCORA CON FORMATO EXACTO */}
      <div className="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-gradient-to-r from-emerald-950 via-[#00603C] to-emerald-900 text-white font-bold text-[11px] tracking-wide">
              {/* Columna 1: Entrada/Salida */}
              <th className="py-3 px-3.5 whitespace-nowrap">Entrada/Salida</th>

              {/* Columna 2: Fecha */}
              <th className="py-3 px-3.5 whitespace-nowrap">Fecha</th>

              {/* Columna 3: Tipo de movimiento */}
              <th className="py-3 px-3.5 whitespace-nowrap">Tipo de movimiento</th>

              {/* Columna 4: Cantidad de bolsas ingresadas/salidas */}
              <th className="py-3 px-3.5 text-right whitespace-nowrap">
                Cantidad de bolsas ingresadas/salidas
              </th>

              {/* Columna 5: Kilos ingresados/salida */}
              <th className="py-3 px-3.5 text-right whitespace-nowrap">
                Kilos ingresados/salida
              </th>

              {/* Columna 6: Trazabilidad / Documentación complementaria */}
              <th className="py-3 px-3.5 whitespace-nowrap">
                Remito / Destino / Detalle
              </th>

              {/* Columna 7: Acciones */}
              {!readOnly && (
                <th className="py-3 px-3.5 text-center whitespace-nowrap">
                  Acciones
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredList.length === 0 ? (
              <tr>
                <td colSpan={readOnly ? 6 : 7} className="py-8 text-center text-gray-400 text-xs">
                  No se encontraron movimientos registrados con los filtros aplicados.
                </td>
              </tr>
            ) : (
              filteredList.map((row, idx) => {
                const isEntrada = row.direccion === 'Entrada';
                return (
                  <tr
                    key={`${row.id}-${idx}`}
                    className={`transition ${
                      idx % 2 === 0 ? 'bg-white hover:bg-emerald-50/30' : 'bg-[#E3EFE7]/15 hover:bg-emerald-50/30'
                    }`}
                  >
                    {/* ENTRADA / SALIDA */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      {row.esPrecarga ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs" title="Pre-carga informativa (no suma a stock hasta Pasar a Realizado)">
                          <Clock className="w-3.5 h-3.5 text-amber-700" />
                          Pre-carga
                        </span>
                      ) : isEntrada ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#E3EFE7] text-[#00603C] border border-[#00603C]/20 shadow-2xs">
                          <ArrowUpRight className="w-3.5 h-3.5" />
                          Entrada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#F6EFDC] text-[#A0522D] border border-[#A0522D]/20 shadow-2xs">
                          <ArrowDownRight className="w-3.5 h-3.5" />
                          Salida
                        </span>
                      )}
                    </td>

                    {/* FECHA: FORMATO dd/mm/aaaa */}
                    <td className="py-3 px-3.5 font-semibold text-gray-700 whitespace-nowrap font-mono">
                      {formatToDDMMAAAA(row.fecha)}
                    </td>

                    {/* TIPO DE MOVIMIENTO */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      {row.esPrecarga ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <Clock className="w-3 h-3 text-amber-600" />
                          Alta (Pre-carga)
                        </span>
                      ) : row.tipoMovimiento === 'Alta' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-50 text-[#00603C] border border-emerald-200">
                          <CheckCircle className="w-3 h-3 text-[#00603C]" />
                          Alta
                        </span>
                      ) : null}
                      {row.tipoMovimiento === 'Salida manual' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">
                          <ArrowDownRight className="w-3 h-3 text-[#A0522D]" />
                          Salida manual
                        </span>
                      )}
                      {row.tipoMovimiento === 'Despacho' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-blue-50 text-blue-900 border border-blue-200">
                          <Truck className="w-3 h-3 text-blue-600" />
                          Despacho
                        </span>
                      )}
                      {row.tipoMovimiento === 'Salida por movimiento' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-purple-50 text-purple-900 border border-purple-200">
                          <Layers className="w-3 h-3 text-purple-600" />
                          Salida por movimiento
                        </span>
                      )}
                      {row.tipoMovimiento === 'Pasado a Consumo' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-fuchsia-50 text-fuchsia-900 border border-fuchsia-200">
                          <ArrowDownRight className="w-3 h-3 text-fuchsia-600" />
                          Pasado a Consumo
                        </span>
                      )}
                      {row.tipoMovimiento === 'Ajuste de Auditoría' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-rose-50 text-rose-900 border border-rose-200">
                          <ArrowDownRight className="w-3 h-3 text-rose-600" />
                          Ajuste de Auditoría
                        </span>
                      )}
                    </td>

                    {/* CANTIDAD DE BOLSAS INGRESADAS / SALIDAS */}
                    <td className="py-3 px-3.5 text-right font-mono font-bold whitespace-nowrap">
                      {row.esPrecarga ? (
                        <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200" title="Bolsas preliminares no activadas">
                          {formatNumberArg(row.cantidadBolsas, 0)} b. <span className="text-[10px] font-normal text-amber-600">(pre-carga)</span>
                        </span>
                      ) : (
                        <span
                          className={
                            isEntrada
                              ? 'text-[#00603C] bg-emerald-50 px-2 py-0.5 rounded'
                              : 'text-[#A0522D] bg-amber-50 px-2 py-0.5 rounded'
                          }
                        >
                          {isEntrada ? '+' : '-'}
                          {formatNumberArg(row.cantidadBolsas, 0)} b.
                        </span>
                      )}
                    </td>

                    {/* KILOS INGRESADOS / SALIDA */}
                    <td className="py-3 px-3.5 text-right font-mono font-bold whitespace-nowrap">
                      {row.esPrecarga ? (
                        <span className="text-amber-700 text-xs">
                          {formatNumberArg(row.cantidadKg, 2)} kg <span className="text-[10px] text-amber-500">(pre-carga)</span>
                        </span>
                      ) : (
                        <span
                          className={
                            isEntrada
                              ? 'text-[#00603C]'
                              : 'text-[#A0522D]'
                          }
                        >
                          {isEntrada ? '+' : '-'}
                          {formatNumberArg(row.cantidadKg, 2)} kg
                        </span>
                      )}
                    </td>

                    {/* TRAZABILIDAD Y DOCUMENTACIÓN */}
                    <td className="py-3 px-3.5 text-gray-700">
                      <div className="flex flex-wrap items-center gap-2">
                        {row.remitoCliente && row.remitoCliente !== '-' && (
                          <span className="font-mono font-bold text-[10px] bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded border border-gray-200">
                            Remito: {row.remitoCliente}
                          </span>
                        )}
                        {row.destino && row.destino !== '-' && (
                          <span className="text-[11px] font-semibold text-[#00603C]">
                            Destino: {row.destino}
                          </span>
                        )}
                        {row.chofer && (
                          <span className="text-[11px] text-gray-500 flex items-center gap-0.5">
                            <User className="w-3 h-3 text-gray-400" />
                            {row.chofer}
                          </span>
                        )}
                      </div>
                      {row.detalle && (
                        <div className="text-[10px] text-gray-500 italic mt-0.5 truncate max-w-sm" title={row.detalle}>
                          {row.detalle}
                        </div>
                      )}
                    </td>

                    {/* ACCIONES (MODIFICAR / ELIMINAR) */}
                    {!readOnly && (
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleAbrirEditar(row)}
                            className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition cursor-pointer"
                            title="Modificar movimiento"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAbrirEliminar(row)}
                            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition cursor-pointer"
                            title="Eliminar movimiento"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL: REGISTRAR O MODIFICAR MOVIMIENTO EN BITÁCORA */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <span className="text-[10px] font-bold text-[#00603C] uppercase tracking-wider bg-[#E3EFE7] px-2 py-0.5 rounded">
                  Bitácora de Lote
                </span>
                <h3 className="font-serif text-lg font-bold text-gray-900 mt-1">
                  {editingRecord ? 'Modificar Movimiento de Bitácora' : 'Registrar Movimiento en Bitácora'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGuardarMovimiento} className="space-y-4 mt-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* 1. Selector Entrada / Salida */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Entrada / Salida <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleDireccionChange('Entrada')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                      formDireccion === 'Entrada'
                        ? 'bg-[#E3EFE7] text-[#00603C] border-[#00603C] ring-2 ring-[#00603C]/20 shadow-xs'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    Entrada
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDireccionChange('Salida')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                      formDireccion === 'Salida'
                        ? 'bg-[#F6EFDC] text-[#A0522D] border-[#A0522D] ring-2 ring-[#A0522D]/20 shadow-xs'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <ArrowDownRight className="w-4 h-4" />
                    Salida
                  </button>
                </div>
              </div>

              {/* 2. Fecha: Date Picker */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Fecha <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="date"
                    value={formFecha}
                    onChange={(e) => setFormFecha(e.target.value)}
                    required
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#00603C] focus:bg-white"
                  />
                </div>
              </div>

              {/* 3. Tipo de movimiento: dropdown condicionado */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center justify-between">
                  <span>Tipo de movimiento <span className="text-red-500">*</span></span>
                  <span className="text-[10px] text-gray-400 font-normal">
                    {formDireccion === 'Entrada' ? 'Solo Alta para Entradas' : 'Opciones de Egreso'}
                  </span>
                </label>
                <select
                  value={formTipoMov}
                  onChange={(e) =>
                    setFormTipoMov(
                      e.target.value as any
                    )
                  }
                  required
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#00603C] focus:bg-white"
                >
                  {formDireccion === 'Entrada' ? (
                    <>
                      <option value="Alta">Alta</option>
                      <option value="Ajuste de Auditoría">Ajuste de Auditoría (+)</option>
                    </>
                  ) : (
                    <>
                      <option value="Pasado a Consumo">Pasado a Consumo</option>
                      <option value="Salida por movimiento">Salida por movimiento</option>
                      <option value="Despacho">Despacho</option>
                      <option value="Ajuste de Auditoría">Ajuste de Auditoría (-)</option>
                    </>
                  )}
                </select>
                {formTipoMov === 'Ajuste de Auditoría' && (
                  <div className="mt-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                    <strong>Ajuste por Auditoría:</strong> Este registro actualiza el stock disponible sin registrarse en los ingresos o egresos comerciales del lote.
                  </div>
                )}
              </div>

              {/* 4 y 5. Cantidad de bolsas (entero) y Kilos (decimal) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Cantidad de bolsas <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={formBolsas}
                    onChange={(e) => handleBolsasChange(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#00603C] focus:bg-white"
                  />
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    Número entero de bolsas
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Kilos ingresados/salida <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formKg}
                    onChange={(e) => setFormKg(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-bold text-[#00603C] focus:outline-none focus:ring-2 focus:ring-[#00603C] focus:bg-white"
                  />
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    Numérico decimal ({lote.kgPorBolsa || 40} kg/bolsa)
                  </span>
                </div>
              </div>

              {/* CAMPOS DE TRAZABILIDAD (Remito de Cliente, Destino, Chofer, Detalle) */}
              <div className="pt-2 border-t border-gray-100 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      N° Remito Cliente (opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: R-0004-0012345"
                      value={formRemitoCliente}
                      onChange={(e) => setFormRemitoCliente(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#00603C] focus:bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Destino (opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Campo Los Alamos, Lote 4B"
                      value={formDestino}
                      onChange={(e) => setFormDestino(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#00603C] focus:bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Chofer asignado (opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Mario Gómez"
                      value={formChofer}
                      onChange={(e) => setFormChofer(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#00603C] focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Detalle / Motivo
                    </label>
                    <input
                      type="text"
                      placeholder="Observaciones de la operación"
                      value={formDetalle}
                      onChange={(e) => setFormDetalle(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#00603C] focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* BOTONES DE ACCION */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#00603C] hover:bg-[#004D30] text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  {editingRecord ? 'Guardar Cambios' : 'Registrar Movimiento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN CON CHECK Y FRASE EXACTA "eliminar movimiento" */}
      {deletingRecord && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-red-100 overflow-hidden">
            <div className="bg-red-600 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 text-white shrink-0" />
                <h3 className="font-bold text-sm">Eliminar Movimiento de Bitácora</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDeletingRecord(null);
                  setDeleteConfirmChecked(false);
                  setDeleteConfirmPhrase('');
                }}
                className="text-white/80 hover:text-white p-1 rounded-lg text-lg font-bold"
              >
                ×
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-900 space-y-1.5">
                <p className="font-semibold">¿Está seguro de eliminar este registro?</p>
                <div className="bg-white/90 p-2.5 rounded-lg border border-red-100 font-mono text-[11px] space-y-1">
                  <div><strong>Tipo:</strong> {deletingRecord.tipoMovimiento} ({deletingRecord.direccion})</div>
                  <div><strong>Fecha:</strong> {formatToDDMMAAAA(deletingRecord.fecha)}</div>
                  <div><strong>Cantidad:</strong> {deletingRecord.cantidadBolsas} bolsas ({formatNumberArg(deletingRecord.cantidadKg, 2)} kg)</div>
                  {deletingRecord.detalle && <div><strong>Detalle:</strong> {deletingRecord.detalle}</div>}
                </div>
                <p className="text-[11px] text-red-800 pt-1">
                  Esta acción actualizará el stock disponible del lote de forma definitiva.
                </p>
              </div>

              {/* Checkbox de confirmación */}
              <label className="flex items-start gap-2.5 p-2.5 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-100 transition">
                <input
                  type="checkbox"
                  id="check-confirmar-eliminar-movimiento"
                  checked={deleteConfirmChecked}
                  onChange={(e) => setDeleteConfirmChecked(e.target.checked)}
                  className="mt-0.5 rounded text-red-600 focus:ring-red-500 w-4 h-4"
                />
                <span className="text-gray-700 font-medium text-[11px] leading-tight select-none">
                  Confirmo que deseo eliminar este movimiento de la bitácora y recalcular el stock del lote.
                </span>
              </label>

              {/* Frase exacta de confirmación */}
              <div className="space-y-1.5">
                <label className="block text-gray-700 font-bold uppercase tracking-wider text-[10px]">
                  Para habilitar la eliminación, escriba la frase: <span className="text-red-600 font-mono font-extrabold select-all">eliminar movimiento</span>
                </label>
                <input
                  type="text"
                  value={deleteConfirmPhrase}
                  onChange={(e) => setDeleteConfirmPhrase(e.target.value)}
                  placeholder="Escriba aquí: eliminar movimiento"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-mono font-bold focus:bg-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                />
              </div>

              {/* Botones de acción */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setDeletingRecord(null);
                    setDeleteConfirmChecked(false);
                    setDeleteConfirmPhrase('');
                  }}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!deleteConfirmChecked || deleteConfirmPhrase.trim().toLowerCase() !== 'eliminar movimiento'}
                  onClick={handleConfirmarEliminar}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Eliminar Movimiento
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* MODAL DE CONFIRMACIÓN DIRECTA "PASAR A REALIZADO" */}
      {showConfirmRealizadoModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-200 animate-in fade-in zoom-in duration-200">
            <div className="bg-emerald-800 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                <h4 className="font-serif text-sm font-bold uppercase tracking-wider">
                  Pasar Lote a REALIZADO
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmRealizadoModal(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg text-lg font-bold cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-emerald-950 space-y-2">
                <p className="font-semibold text-emerald-900">
                  ¿Desea activar y dar de alta las bolsas de este lote?
                </p>
                <div className="bg-white/95 p-3 rounded-lg border border-emerald-100 font-mono text-[11px] space-y-1.5 shadow-2xs">
                  <div><strong>Lote:</strong> {lote.loteNro} ({lote.especie} - {lote.variedad})</div>
                  <div><strong>Bolsas a dar de alta:</strong> <span className="text-emerald-700 font-bold font-mono">+{formatNumberArg(lote.stockBolsas, 0)} bolsas</span> ({formatNumberArg(lote.stockKg || lote.stockBolsas * (lote.kgPorBolsa || 40), 0)} kg)</div>
                  <div><strong>Estado resultante:</strong> <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold">REALIZADO</span></div>
                </div>
                <p className="text-[11px] text-emerald-800 pt-1 leading-relaxed">
                  Al confirmar, las bolsas se darán de alta formalmente en el lote y se sumarán de inmediato a los movimientos de <strong>Total Ingresado (Alta)</strong>.
                </p>
              </div>

              {/* Selector de fecha efectiva */}
              <div className="space-y-1.5">
                <label className="block text-gray-700 font-bold uppercase tracking-wider text-[10px]">
                  Fecha efectiva del alta / realización:
                </label>
                <input
                  type="date"
                  value={fechaRealizadoConfirm}
                  onChange={(e) => setFechaRealizadoConfirm(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-mono font-bold focus:bg-white focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              {/* Botones de acción */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  disabled={isActivatingRealizado}
                  onClick={() => setShowConfirmRealizadoModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isActivatingRealizado}
                  onClick={handleConfirmarRealizado}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isActivatingRealizado ? 'Dando de alta...' : 'Confirmar y Dar de Alta'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
