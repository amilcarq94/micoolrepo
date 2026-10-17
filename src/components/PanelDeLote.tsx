/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Lote,
  MovimientoStock,
  EstadoLoteType,
  OrdenCarga,
  AuditLogEntry,
  PlantaConfig,
  BolsaRegistro,
} from '../types';
import { formatNumberArg } from '../utils/formatters';
import { db, mapLoteToFirestore, sanitizeForFirestore, mapMovimientoStockToFirestore } from '../lib/firebase';
import { collection, doc, writeBatch, updateDoc } from 'firebase/firestore';
import { MovimientoLoteModal, MovimientoLoteResult } from './MovimientoLoteModal';
import { EditarMovimientoModal, EditarMovimientoResult } from './EditarMovimientoModal';
import { DesdoblarLoteModal, HijoDesdobleDraft } from './DesdoblarLoteModal';
import { AccionesLoteModal, AccionLoteResult } from './AccionesLoteModal';
import { VisorBolsasLote } from './VisorBolsasLote';
import {
  normalizarEstado,
  normalizarTratamiento,
  normalizarEnvase,
  normalizarCategoria,
  normalizarTipo,
  generarBolsasParaLote,
  generarCaratulaParaLote,
  puedeOperarLote,
  getKilajeEnvase,
  getBolsasDeLote,
  calcularResumenLoteDesdeBolsas,
} from '../utils/loteEspecUtils';
import { registrarMovimientoOficial, guardarCaratulaYBolsasFirestore } from '../lib/firebase';
import {
  ArrowUpRight,
  ArrowDownRight,
  ArrowRightLeft,
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
  ShieldCheck,
  AlertTriangle,
  Loader2,
  Save,
  Columns2,
  Sparkles,
  FlaskConical,
  Tag,
  ChevronRight,
  Info,
  Scale,
  CornerDownRight,
  ExternalLink,
  Scissors,
  SlidersHorizontal,
  Lock,
  Unlock,
  QrCode,
  Printer,
  GitFork,
  FileText,
  Eye,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { IdBolsaLabel } from './IdBolsaLabel';
import { QrTrazabilidadLote, getPublicLoteTraceUrl } from './QrTrazabilidadLote';

// Formato de registro unificado para la tabla del Panel de Lote
export interface PanelLoteMovimientoRow {
  id: string;
  fecha: string; // YYYY-MM-DD
  // Ingresos (Alta)
  esIngreso: boolean;
  ingresoBolsas: number;
  ingresoKg: number;
  esPrecarga?: boolean;
  esTratado?: boolean;
  kgTratados?: number;
  tratamientoNombre?: string;
  // Movimiento cualitativo (Intermedio a Final, Int a Final Tratado, Final a Final Tratado, etc.)
  esMovimiento: boolean;
  tipoMovimientoTexto?: string;
  tratamientoMovimiento?: string;
  // Salidas (Despachos, Baja por calidad, Pasado a consumo, etc.)
  esSalida: boolean;
  salidaTipo: 'Despacho' | 'Baja por calidad' | 'Pasado a Consumo' | 'Salida por movimiento' | 'Salida manual' | '';
  salidaBolsas: number;
  salidaKg: number;
  // Stock progresivo tras el movimiento
  saldoBolsas: number;
  saldoKg: number;
  // Trazabilidad
  remitoCliente?: string;
  destino?: string;
  chofer?: string;
  detalle?: string;
  ordenId?: string;
}

export interface PanelDeLoteProps {
  lote: Lote;
  allLotes?: Lote[];
  ordenesCarga?: OrdenCarga[];
  plantaConfig?: PlantaConfig;
  currentUser?: { nombre: string; rol: string };
  onUpdateLoteStock: (
    loteId: string,
    nuevosMovimientos: MovimientoStock[],
    nuevoStockBolsas: number,
    nuevoStockKg: number,
    nuevoEstado: EstadoLoteType,
    motivoAuditoria?: string,
    idMovimientoEliminado?: string
  ) => void;
  onSaveLote?: (lote: Lote) => Promise<void> | void;
  onBatchUpdateLotes?: (updatedLotes: Lote[]) => Promise<void> | void;
  onDeleteOrdenCarga?: (ordenId: string) => Promise<void> | void;
  onSaveOrdenCarga?: (orden: OrdenCarga) => Promise<void> | void;
  onSelectLote?: (lote: Lote) => void;
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

// Helper para determinar si un lote o alta está marcado como tratado
export const isLoteTratadoHelper = (l: Lote): boolean => {
  if (!l) return false;
  const t = (l as any).tratamiento;
  if (Array.isArray(t)) {
    return t.some(item => {
      const s = String(item).toLowerCase().trim();
      return s !== 'sin tratar' && s !== 'ninguno' && s !== '' && !s.includes('sin');
    });
  }
  if (typeof t === 'string') {
    const s = String(t).toLowerCase().trim();
    return s !== 'sin tratar' && s !== 'ninguno' && s !== '' && !s.includes('sin');
  }
  if (l.producto && l.producto.toLowerCase().trim() !== 'ninguno' && l.producto.trim() !== '') return true;
  if (l.productoAplicado && l.productoAplicado.toLowerCase().trim() !== 'ninguno' && l.productoAplicado.trim() !== '') return true;
  if (l.tipo && l.tipo.toLowerCase().includes('tratado')) return true;
  if (l.tipoMovimiento && l.tipoMovimiento.toLowerCase().includes('tratado')) return true;
  return false;
};

export const PanelDeLote: React.FC<PanelDeLoteProps> = ({
  lote,
  allLotes = [],
  ordenesCarga = [],
  plantaConfig,
  currentUser = { nombre: 'Operador Planta', rol: 'Operario' },
  onUpdateLoteStock,
  onSaveLote,
  onBatchUpdateLotes,
  onDeleteOrdenCarga,
  onSaveOrdenCarga,
  onSelectLote,
  readOnly = false,
}) => {
  // 1. Estados de Guardado y Persistencia en BD
  const [isSavingModal, setIsSavingModal] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isSavingGeneral, setIsSavingGeneral] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('');
  const [lastSavedTimestamp, setLastSavedTimestamp] = useState<string>('');

  // 2. Estado para Modal "Movimiento de Lote" (trasladado desde la vista de tabla)
  const [showMovimientoModal, setShowMovimientoModal] = useState<boolean>(false);
  const [loteToEditMovimiento, setLoteToEditMovimiento] = useState<Lote | null>(null);

  // 3. Estado de División del Panel (Capacidad de dividir panel por desdoblamiento)
  const [isPanelDivided, setIsPanelDivided] = useState<boolean>(false);
  const [criterioDivision, setCriterioDivision] = useState<'tratamiento' | 'tipo' | 'categoria'>('tratamiento');

  // Modales de la nueva especificación
  const [showDesdoblarModal, setShowDesdoblarModal] = useState<boolean>(false);
  const [showAccionesModal, setShowAccionesModal] = useState<boolean>(false);
  const [accionesInitialTab, setAccionesInitialTab] = useState<'estado' | 'tratamiento' | 'envase' | 'categoria' | 'tipo' | 'bloqueo'>('estado');
  const [panelSubTab, setPanelSubTab] = useState<'movimientos' | 'genealogia' | 'bolsas'>('movimientos');
  const [selectedBolsaParaVer, setSelectedBolsaParaVer] = useState<any | null>(null);

  // Listado oficial de bolsas asociadas al lote (modelo de datos centrado en la bolsa)
  const [bolsasLote, setBolsasLote] = useState<BolsaRegistro[]>(() => getBolsasDeLote(lote));

  useEffect(() => {
    setBolsasLote(getBolsasDeLote(lote));
  }, [lote.id, lote.bolsas, lote.stockBolsas, lote.cantidadBolsas, lote.envase]);

  // Resumen del lote calculado dinámicamente desde sus bolsas
  const resumenDesdeBolsas = useMemo(() => {
    return calcularResumenLoteDesdeBolsas(bolsasLote, lote);
  }, [bolsasLote, lote]);

  const listaBolsasLote = bolsasLote;

  // Actualización en vivo de bolsas desde el visor
  const handleActualizarBolsasDesdeVisor = async (nuevasBolsas: BolsaRegistro[], descripcionMov: string) => {
    setBolsasLote(nuevasBolsas);
    const nuevoResumen = calcularResumenLoteDesdeBolsas(nuevasBolsas, lote);
    const caratulaDoc = generarCaratulaParaLote(lote);

    const loteActualizado: Lote = {
      ...lote,
      bolsas: nuevasBolsas,
      kg: nuevoResumen.kgTotales,
      stockKg: nuevoResumen.stockKg,
      stockBolsas: nuevoResumen.stockBolsas,
      cantidadBolsas: nuevoResumen.totalBolsas,
      estado: nuevoResumen.estado as any,
      categoria: nuevoResumen.categoria as any,
      tipo: nuevoResumen.tipo as any,
      tratamiento:
        nuevoResumen.desglose.tratamientos.curado === nuevoResumen.totalBolsas && nuevoResumen.totalBolsas > 0
          ? ['Curado']
          : nuevoResumen.desglose.tratamientos.curado > 0
          ? ['Curado', 'Sin Curar']
          : ['Sin Curar'],
    };

    try {
      await guardarCaratulaYBolsasFirestore(caratulaDoc, nuevasBolsas);
      const loteRef = doc(db, 'lotes', lote.id);
      await updateDoc(loteRef, sanitizeForFirestore(loteActualizado) as any);
    } catch (e) {
      console.warn('Error sincronizando bolsas con Firestore:', e);
    }

    if (onBatchUpdateLotes) {
      await onBatchUpdateLotes([loteActualizado]);
    } else if (onSaveLote) {
      await onSaveLote(loteActualizado);
    }
    onUpdateLoteStock(lote.id, lote.historial, nuevoResumen.stockBolsas, nuevoResumen.stockKg, nuevoResumen.estado as any, descripcionMov);
  };

  // Árbol genealógico: Padre, Hermanos e Hijos
  const lotePadre = useMemo(() => {
    if (!lote.padreId && !lote.loteOrigen) return null;
    return allLotes.find(l =>
      l.id === lote.padreId ||
      (lote.loteOrigen && (l.loteNro === lote.loteOrigen || l.codigo === lote.loteOrigen || l.id === lote.loteOrigen))
    ) || null;
  }, [allLotes, lote]);

  const lotesHijos = useMemo(() => {
    const normCodigo = (lote.codigo || lote.loteNro || lote.id).trim().toLowerCase();
    return allLotes.filter(l =>
      (l.padreId && l.padreId === lote.id) ||
      (l.loteOrigen && l.loteOrigen.trim().toLowerCase() === normCodigo && l.id !== lote.id)
    );
  }, [allLotes, lote]);

  // 4. Estados de Filtros de la Tabla
  const [filterDireccion, setFilterDireccion] = useState<'' | 'Ingresos' | 'Movimientos' | 'Salidas'>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // 5. Estados del Modal "Registrar / Modificar Movimiento en Panel"
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingRow, setEditingRow] = useState<PanelLoteMovimientoRow | null>(null);
  const [formDireccion, setFormDireccion] = useState<'Entrada' | 'Salida' | 'Movimiento'>('Entrada');
  const [formTipoMov, setFormTipoMov] = useState<string>('Alta');
  const [formFecha, setFormFecha] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formBolsas, setFormBolsas] = useState<number>(0);
  const [formKg, setFormKg] = useState<number>(0);
  const [formRemitoCliente, setFormRemitoCliente] = useState<string>('');
  const [formDestino, setFormDestino] = useState<string>('');
  const [formChofer, setFormChofer] = useState<string>('');
  const [formDetalle, setFormDetalle] = useState<string>('');
  const [formError, setFormError] = useState<string>('');

  // 6. Estados de Modal "Eliminar Movimiento"
  const [deletingRow, setDeletingRow] = useState<PanelLoteMovimientoRow | null>(null);
  const [deleteConfirmChecked, setDeleteConfirmChecked] = useState<boolean>(false);
  const [deleteConfirmPhrase, setDeleteConfirmPhrase] = useState<string>('');

  // 7. Modal "Editar Alta de Lote"
  const [showEditarAltaModal, setShowEditarAltaModal] = useState<boolean>(false);
  const [altaConfirmPhrase, setAltaConfirmPhrase] = useState<string>('');
  const [altaNuevaBolsas, setAltaNuevaBolsas] = useState<number>(lote.stockBolsas);
  const [altaNuevaKgPorBolsa, setAltaNuevaKgPorBolsa] = useState<number>(lote.kgPorBolsa || 40);
  const [altaNuevaFecha, setAltaNuevaFecha] = useState<string>(lote.fechaIngreso || new Date().toISOString().split('T')[0]);
  const [altaNuevoDetalle, setAltaNuevoDetalle] = useState<string>('');
  const [isSavingAlta, setIsSavingAlta] = useState<boolean>(false);

  // 8. Modal "Pasar a Realizado" (para lotes en PRE-CARGA)
  const [showConfirmRealizadoModal, setShowConfirmRealizadoModal] = useState<boolean>(false);
  const [fechaRealizadoConfirm, setFechaRealizadoConfirm] = useState<string>(new Date().toISOString().split('T')[0]);
  const [pesoDeMilConfirm, setPesoDeMilConfirm] = useState<string>(() =>
    lote.pesoDeMil !== undefined && lote.pesoDeMil !== null ? String(lote.pesoDeMil) : ''
  );
  const [isActivatingRealizado, setIsActivatingRealizado] = useState<boolean>(false);

  // 9. Detección de lotes desdoblados relacionados en el sistema
  const lotesDesdobladosRelacionados = useMemo(() => {
    if (!allLotes || allLotes.length === 0) return [];
    const currentNro = (lote.loteNro || '').trim().toLowerCase();
    const currentId = (lote.id || '').trim().toLowerCase();
    const origenLote = (lote.loteOrigen || '').trim().toLowerCase();

    return allLotes.filter((other) => {
      if (other.id === lote.id) return false;
      const otherNro = (other.loteNro || '').trim().toLowerCase();
      const otherId = (other.id || '').trim().toLowerCase();
      const otherOrigen = (other.loteOrigen || '').trim().toLowerCase();

      // Caso A: El otro lote tiene como origen este lote
      if (otherOrigen && (otherOrigen === currentNro || otherOrigen === currentId)) {
        return true;
      }
      // Caso B: Este lote es hijo y el otro es el padre
      if (origenLote && (origenLote === otherNro || origenLote === otherId)) {
        return true;
      }
      // Caso C: Comparten el mismo lote de origen (hermanos de desdoblamiento)
      if (origenLote && otherOrigen && origenLote === otherOrigen) {
        return true;
      }
      return false;
    });
  }, [allLotes, lote]);

  // Lote desdoblado seleccionado para la vista dividida
  const loteDesdobladoActivo = useMemo(() => {
    if (lotesDesdobladosRelacionados.length === 0) return null;
    if (criterioDivision === 'tratamiento') {
      const otroTrat = lotesDesdobladosRelacionados.find((l) => {
        const isThisTratado = Array.isArray(lote.tratamiento)
          ? lote.tratamiento.some((t) => t.toLowerCase().includes('tratado') || t.toLowerCase().includes('curado'))
          : String(lote.tratamiento || '').toLowerCase().includes('tratado');
        const isOtherTratado = Array.isArray(l.tratamiento)
          ? l.tratamiento.some((t) => t.toLowerCase().includes('tratado') || t.toLowerCase().includes('curado'))
          : String(l.tratamiento || '').toLowerCase().includes('tratado');
        return isThisTratado !== isOtherTratado;
      });
      return otroTrat || lotesDesdobladosRelacionados[0];
    }
    if (criterioDivision === 'tipo') {
      const otroTipo = lotesDesdobladosRelacionados.find((l) => (l.tipo || '') !== (lote.tipo || ''));
      return otroTipo || lotesDesdobladosRelacionados[0];
    }
    if (criterioDivision === 'categoria') {
      const otraCat = lotesDesdobladosRelacionados.find((l) => (l.categoria || '') !== (lote.categoria || ''));
      return otraCat || lotesDesdobladosRelacionados[0];
    }
    return lotesDesdobladosRelacionados[0];
  }, [lotesDesdobladosRelacionados, criterioDivision, lote]);

  // 10. Construcción de la lista consolidada de movimientos para la tabla
  const rowsMovimientos = useMemo<PanelLoteMovimientoRow[]>(() => {
    const list: PanelLoteMovimientoRow[] = [];

    // a) Movimiento de Alta Inicial
    const historial = lote.historial || [];
    const hasExplicitAlta = historial.some((m) => {
      const t = (m.tipo || '').toLowerCase();
      return t === 'alta' || m.id.startsWith('MOV-ALTA-') || m.id.startsWith('alta-');
    });

    if (!hasExplicitAlta) {
      const isPrecarga = lote.estadoRegistro === 'PRE-CARGA';
      const esLoteMov = Boolean(lote.esMovimiento || lote.tipoMovimiento || lote.loteOrigen);
      const kgAlta = lote.stockKg || lote.stockBolsas * (lote.kgPorBolsa || 40);
      const esTratadoAlta = isLoteTratadoHelper(lote);
      const tratNombre = lote.producto || (Array.isArray(lote.tratamiento) ? lote.tratamiento.join(', ') : lote.tratamiento) || '';

      list.push({
        id: `alta-inicial-${lote.id}`,
        fecha: lote.fechaIngreso || new Date().toISOString().split('T')[0],
        esIngreso: true,
        ingresoBolsas: lote.stockBolsas,
        ingresoKg: kgAlta,
        esPrecarga: isPrecarga,
        esTratado: esTratadoAlta,
        kgTratados: esTratadoAlta ? kgAlta : 0,
        tratamientoNombre: esTratadoAlta ? tratNombre : undefined,
        esMovimiento: esLoteMov,
        tipoMovimientoTexto: esLoteMov ? (lote.tipoMovimiento || 'Movimiento Realizado') : undefined,
        tratamientoMovimiento: tratNombre,
        esSalida: false,
        salidaTipo: '',
        salidaBolsas: 0,
        salidaKg: 0,
        saldoBolsas: isPrecarga ? 0 : lote.stockBolsas,
        saldoKg: isPrecarga ? 0 : kgAlta,
        remitoCliente: (lote as any).remitoCliente || '',
        destino: lote.ubicacionAcopio || '',
        chofer: '',
        detalle: esLoteMov
          ? `Lote originado por movimiento (${lote.tipoMovimiento || 'Desdoble'}) desde origen #${lote.loteOrigen || lote.loteNro}`
          : (isPrecarga ? 'Alta de lote en Pre-carga' : (esTratadoAlta ? `Alta inicial de lote en planta (Tratado: ${formatNumberArg(kgAlta, 0)} kg)` : 'Alta inicial de lote en planta')),
      });
    }

    // b) Historial registrado en el lote
    historial.forEach((m) => {
      const t = (m.tipo || '').toLowerCase();
      const det = (m.detalle || '').toLowerCase();

      const esEntrada =
        t.startsWith('entrada') ||
        t === 'alta' ||
        t.includes('ingreso') ||
        t.includes('excel') ||
        m.id.startsWith('MOV-ALTA-') ||
        m.id.startsWith('alta-');

      const esSalidaMov =
        t.includes('movimiento') ||
        det.includes('intermedio a final') ||
        det.includes('final a final') ||
        det.includes('curado parcial') ||
        det.includes('desdoble') ||
        det.includes('desdoblamiento');

      const esSalida =
        !esEntrada &&
        (t.includes('salida') ||
          t.includes('despacho') ||
          t.includes('consumo') ||
          t.includes('baja') ||
          esSalidaMov);

      let salidaTipoCategorizada: PanelLoteMovimientoRow['salidaTipo'] = 'Salida manual';
      if (t.includes('despacho') || (m.ordenId && m.ordenId.trim() !== '')) {
        salidaTipoCategorizada = 'Despacho';
      } else if (t.includes('consumo') || det.includes('consumo')) {
        salidaTipoCategorizada = 'Pasado a Consumo';
      } else if (det.includes('calidad') || t.includes('baja por calidad') || det.includes('rechazo') || det.includes('descarte')) {
        salidaTipoCategorizada = 'Baja por calidad';
      } else if (esSalidaMov) {
        salidaTipoCategorizada = 'Salida por movimiento';
      }

      // Detectar etiqueta de movimiento cualitativo
      let tipoMovLabel = '';
      if (
        esSalidaMov ||
        t.includes('movimiento') ||
        t.includes('intermedio a final') ||
        t.includes('final a final') ||
        t.includes('curado') ||
        t.includes('desdoble') ||
        det.includes('intermedio a final') ||
        det.includes('final a final') ||
        det.includes('desdoble') ||
        det.includes('movimiento') ||
        m.id.startsWith('MOV-') ||
        m.id.startsWith('mov-') ||
        (esEntrada && (lote.esMovimiento || Boolean(lote.tipoMovimiento)))
      ) {
        if (det.includes('intermedio a final tratado') || t.includes('intermedio a final tratado')) {
          tipoMovLabel = 'Intermedio a Final Tratado';
        } else if (det.includes('final a final tratado') || t.includes('final a final tratado')) {
          tipoMovLabel = 'Final a Final Tratado';
        } else if (det.includes('intermedio a final') || t.includes('intermedio a final')) {
          tipoMovLabel = 'Intermedio a Final';
        } else if (det.includes('curado') || t.includes('curado')) {
          tipoMovLabel = 'Curado / Tratamiento';
        } else if (det.includes('cambio de envase') || t.includes('cambio_envase')) {
          tipoMovLabel = 'Cambio de Envase';
        } else if (lote.tipoMovimiento && lote.tipoMovimiento.trim() !== '') {
          tipoMovLabel = lote.tipoMovimiento;
        } else {
          tipoMovLabel = m.tipo || 'Movimiento Realizado';
        }
      }

      const bolsas = Number(m.cantidadBolsas) || 0;
      const kg = Number(m.cantidadKg) || bolsas * (Number(m.kgPorBolsa) || Number(lote.kgPorBolsa) || 40);

      const esTratadoEntrada =
        esEntrada &&
        (isLoteTratadoHelper(lote) ||
          (m.tratamiento && !String(m.tratamiento).toLowerCase().includes('sin') && String(m.tratamiento).trim() !== '') ||
          (m.producto && !String(m.producto).toLowerCase().includes('ninguno') && String(m.producto).trim() !== ''));

      const tratNombreEntrada = m.producto || (Array.isArray(m.tratamiento) ? m.tratamiento.join(', ') : m.tratamiento) || (Array.isArray(lote.tratamiento) ? lote.tratamiento.join(', ') : lote.tratamiento) || '';

      list.push({
        id: m.id,
        fecha: m.fecha || lote.fechaIngreso || new Date().toISOString().split('T')[0],
        esIngreso: esEntrada,
        ingresoBolsas: esEntrada ? bolsas : 0,
        ingresoKg: esEntrada ? kg : 0,
        esTratado: esTratadoEntrada,
        kgTratados: esTratadoEntrada ? kg : 0,
        tratamientoNombre: esTratadoEntrada ? tratNombreEntrada : undefined,
        esMovimiento: Boolean(tipoMovLabel),
        tipoMovimientoTexto: tipoMovLabel,
        tratamientoMovimiento: lote.producto || (Array.isArray(lote.tratamiento) ? lote.tratamiento.join(', ') : lote.tratamiento),
        esSalida: esSalida,
        salidaTipo: esSalida ? salidaTipoCategorizada : '',
        salidaBolsas: esSalida ? bolsas : 0,
        salidaKg: esSalida ? kg : 0,
        saldoBolsas: 0, // Se calcula progresivamente abajo
        saldoKg: 0,
        remitoCliente: m.remitoCliente || '',
        destino: m.destino || '',
        chofer: m.chofer || '',
        detalle: m.detalle,
        ordenId: m.ordenId,
      });
    });

    // c) Vincular Órdenes de Carga del Lote que aún no estén en historial
    ordenesCarga.forEach((oc) => {
      const yaExiste = list.some(
        (r) => r.ordenId === oc.id || (r.id && r.id.includes(oc.id)) || (r.detalle && r.detalle.includes(oc.id))
      );
      if (!yaExiste && (oc.estado === 'Despachada' || oc.estado === 'Aceptada')) {
        const itemLote = oc.lotesOrigen?.find((item) => item.loteId === lote.id || item.loteNro === lote.loteNro) ||
          (oc.loteId === lote.id || oc.loteId === lote.loteNro ? { cantidadBolsas: oc.cantidadBolsas, kgTotales: oc.kgTotales } : null);
        if (itemLote && itemLote.cantidadBolsas > 0) {
          list.push({
            id: `OC-${oc.id}`,
            fecha: oc.fechaCarga || oc.fecha || new Date().toISOString().split('T')[0],
            esIngreso: false,
            ingresoBolsas: 0,
            ingresoKg: 0,
            esMovimiento: false,
            esSalida: true,
            salidaTipo: 'Despacho',
            salidaBolsas: itemLote.cantidadBolsas,
            salidaKg: itemLote.kgTotales || itemLote.cantidadBolsas * (lote.kgPorBolsa || 40),
            saldoBolsas: 0,
            saldoKg: 0,
            remitoCliente: oc.remitoCliente || '',
            destino: oc.destino || '',
            chofer: oc.chofer || '',
            detalle: `Despacho Orden de Carga #${oc.id}`,
            ordenId: oc.id,
          });
        }
      }
    });

    // Ordenar cronológicamente para calcular saldos progresivos
    const sortedAsc = [...list].sort((a, b) => {
      const cmp = (a.fecha || '').localeCompare(b.fecha || '');
      if (cmp !== 0) return cmp;
      if (a.esIngreso && !b.esIngreso) return -1;
      if (!a.esIngreso && b.esIngreso) return 1;
      return (a.id || '').localeCompare(b.id || '');
    });

    let acumBolsas = 0;
    let acumKg = 0;
    sortedAsc.forEach((r) => {
      if (r.esIngreso && !r.esPrecarga) {
        acumBolsas += r.ingresoBolsas;
        acumKg += r.ingresoKg;
      }
      if (r.esSalida) {
        acumBolsas = Math.max(0, acumBolsas - r.salidaBolsas);
        acumKg = Math.max(0, acumKg - r.salidaKg);
      }
      r.saldoBolsas = acumBolsas;
      r.saldoKg = acumKg;
    });

    return sortedAsc;
  }, [lote, ordenesCarga]);

  // Lista filtrada y ordenada para la visualización en la tabla
  const rowsFiltradas = useMemo(() => {
    return [...rowsMovimientos]
      .filter((r) => {
        if (filterDireccion === 'Ingresos' && !r.esIngreso) return false;
        if (filterDireccion === 'Movimientos' && !r.esMovimiento) return false;
        if (filterDireccion === 'Salidas' && !r.esSalida) return false;

        if (searchTerm) {
          const t = searchTerm.toLowerCase();
          const matchDet = (r.detalle || '').toLowerCase().includes(t);
          const matchRem = (r.remitoCliente || '').toLowerCase().includes(t);
          const matchDest = (r.destino || '').toLowerCase().includes(t);
          const matchChof = (r.chofer || '').toLowerCase().includes(t);
          const matchMov = (r.tipoMovimientoTexto || '').toLowerCase().includes(t);
          if (!matchDet && !matchRem && !matchDest && !matchChof && !matchMov) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const cmp = (a.fecha || '').localeCompare(b.fecha || '');
        return sortOrder === 'desc' ? -cmp : cmp;
      });
  }, [rowsMovimientos, filterDireccion, searchTerm, sortOrder]);

  // Métricas de balance
  const metrics = useMemo(() => {
    let entradasBolsas = 0;
    let entradasKg = 0;
    let salidasBolsas = 0;
    let salidasKg = 0;
    let movimientosCount = 0;
    let altaTratadosKg = 0;

    rowsMovimientos.forEach((r) => {
      if (r.esIngreso && !r.esPrecarga) {
        entradasBolsas += r.ingresoBolsas;
        entradasKg += r.ingresoKg;
        if (r.esTratado && r.kgTratados) {
          altaTratadosKg += r.kgTratados;
        }
      }
      if (r.esSalida) {
        salidasBolsas += r.salidaBolsas;
        salidasKg += r.salidaKg;
      }
      if (r.esMovimiento) {
        movimientosCount += 1;
      }
    });

    const stockActualBolsas = lote.stockBolsas;
    const stockActualKg = lote.stockKg;

    return {
      entradasBolsas,
      entradasKg,
      altaTratadosKg,
      salidasBolsas,
      salidasKg,
      stockActualBolsas,
      stockActualKg,
      movimientosCount,
    };
  }, [rowsMovimientos, lote]);

  // Recalcular stock a partir de nuevo historial
  const recalcularStockDesdeHistorial = (nuevoHistorial: MovimientoStock[]) => {
    let stockBolsasCalc = 0;
    let stockKgCalc = 0;
    const kgPorBolsa = lote.kgPorBolsa || 40;

    nuevoHistorial.forEach((m) => {
      const t = (m.tipo || '').toLowerCase();
      const esEntrada =
        t.startsWith('entrada') ||
        t === 'alta' ||
        t.includes('ingreso') ||
        t.includes('excel') ||
        m.id.startsWith('MOV-ALTA-') ||
        m.id.startsWith('alta-');

      const esPrecarga = m.id.startsWith('alta-pre') || t.includes('pre-carga');

      const bolsas = Number(m.cantidadBolsas) || 0;
      const kg = Number(m.cantidadKg) || bolsas * (Number(m.kgPorBolsa) || kgPorBolsa);

      if (esEntrada && !esPrecarga) {
        stockBolsasCalc += bolsas;
        stockKgCalc += kg;
      } else if (!esEntrada) {
        stockBolsasCalc -= bolsas;
        stockKgCalc -= kg;
      }
    });

    const stockBolsasFinal = Math.max(0, stockBolsasCalc);
    const stockKgFinal = Math.max(0, stockKgCalc);
    let nuevoEstado: EstadoLoteType = lote.estado || 'Disponible';
    if (stockBolsasFinal === 0) {
      nuevoEstado = 'Agotado';
    } else if (lote.estado === 'Agotado' && stockBolsasFinal > 0) {
      nuevoEstado = 'Disponible';
    }

    return {
      nuevoStockBolsas: stockBolsasFinal,
      nuevoStockKg: stockKgFinal,
      nuevoEstado,
    };
  };

  // Confirmar Movimiento de Lote desde el Modal de Movimientos
  const handleConfirmMovimiento = async (result: MovimientoLoteResult) => {
    try {
      const { loteOrigenActualizado, nuevoLoteGenerado, tipoMovimientoLabel, esTransformacionCompleta } = result;

      if (esTransformacionCompleta || !nuevoLoteGenerado) {
        if (onBatchUpdateLotes) {
          await onBatchUpdateLotes([loteOrigenActualizado]);
        } else if (onSaveLote) {
          await onSaveLote(loteOrigenActualizado);
        }
        setSaveSuccessMsg(`¡Movimiento "${tipoMovimientoLabel}" registrado con éxito en Lote #${loteOrigenActualizado.loteNro}!`);
      } else {
        if (onBatchUpdateLotes) {
          await onBatchUpdateLotes([loteOrigenActualizado, nuevoLoteGenerado]);
        } else if (onSaveLote) {
          await onSaveLote(loteOrigenActualizado);
          await onSaveLote(nuevoLoteGenerado);
        }
        setSaveSuccessMsg(
          `¡Lote desdoblado por movimiento "${tipoMovimientoLabel}"! Nuevo Lote #${nuevoLoteGenerado.loteNro} generado manteniendo trazabilidad con origen #${loteOrigenActualizado.loteNro}.`
        );
      }

      setShowMovimientoModal(false);
      setTimeout(() => setSaveSuccessMsg(''), 5000);
    } catch (err) {
      console.error('Error al registrar movimiento desde panel de lote:', err);
      alert('Error al registrar el movimiento.');
    }
  };

  // Handler para Desdoblamiento Recursivo (Especificación Sección 5)
  const handleConfirmDesdobleEspec = async (hijosDraft: HijoDesdobleDraft[]) => {
    try {
      const fechaHoy = new Date().toISOString().split('T')[0];
      const usuarioNombre = currentUser?.nombre || 'Operador';
      const kgPadre = Number(lote.kg) || Number(lote.stockKg) || ((Number(lote.cantidadBolsas) || Number(lote.stockBolsas) || 0) * getKilajeEnvase(lote.envase || lote.kgPorBolsa));

      // 1. Marcar lote padre como "desdoblado" y deja de contar stock
      const lotePadreActualizado: Lote = {
        ...lote,
        estadoEspec: 'desdoblado',
        estado: 'Agotado', // Deja de contar stock en existencia
        stockBolsas: 0,
        stockKg: 0,
        cantidadBolsas: 0,
        kg: 0,
        activo: true
      };

      // Registrar movimiento de desdoblamiento en el padre
      const movPadreId = await registrarMovimientoOficial({
        loteId: lote.id,
        usuario: usuarioNombre,
        tipo: 'desdoblamiento',
        valorAnterior: lote.estadoEspec || lote.estado,
        valorNuevo: 'desdoblado',
        observaciones: `Desdoblado en ${hijosDraft.length} hijos: ${hijosDraft.map(h => h.codigoCompleto).join(', ')}`,
        fecha: fechaHoy
      });

      // 1. Bolsas del padre: pasan a 'reasignada' manteniendo trazabilidad
      const bolsasPadre = generarBolsasParaLote(lote, lote.caratulaId || `CARAT-${lote.id}`);
      const bolsasPadreReasignadas = bolsasPadre.map(b => ({
        ...b,
        estado: 'reasignada' as const,
      }));

      // 2. Generar lotes hijos con IDs nuevos, caratulas nuevas e IDs de bolsa nuevos vinculados a bolsaOrigenId
      const nuevosLotesHijos: Lote[] = [];
      const bolsasTotalesAGuardar: any[] = [...bolsasPadreReasignadas];
      const caratulasTotalesAGuardar: any[] = [];

      let offsetBolsasPadre = 0;
      for (const h of hijosDraft) {
        const hijoId = `${lote.cliente}_${h.codigoCompleto}`.replace(/\s+/g, '_');
        const kgEnvaseHijo = getKilajeEnvase(h.envase);
        const kgTotalesHijo = h.cantidadBolsas * kgEnvaseHijo;

        const caratulaId = `CARAT-${hijoId}-${Date.now()}`;
        const caratulaDoc = {
          id: caratulaId,
          loteId: hijoId,
          fechaEmision: new Date().toISOString(),
          numeroLote: h.codigoCompleto,
          cliente: lote.cliente,
          variedad: lote.variedad,
          especie: lote.especie,
          categoria: h.categoria,
          kgIniciales: kgTotalesHijo
        };
        caratulasTotalesAGuardar.push(caratulaDoc);

        const bolsasOrigenIdsHijo = bolsasPadre
          .slice(offsetBolsasPadre, offsetBolsasPadre + h.cantidadBolsas)
          .map(b => b.id);
        offsetBolsasPadre += h.cantidadBolsas;

        const bolsasHijo = generarBolsasParaLote(
          {
            id: hijoId,
            codigo: h.codigoCompleto,
            loteNro: h.codigoCompleto,
            cantidadBolsas: h.cantidadBolsas,
            stockBolsas: h.cantidadBolsas,
            envase: h.envase,
            kgPorBolsa: kgEnvaseHijo,
            caratulaId
          },
          caratulaId,
          bolsasOrigenIdsHijo
        );
        bolsasTotalesAGuardar.push(...bolsasHijo);

        const nuevoLoteHijo: Lote = {
          id: hijoId,
          loteNro: h.codigoCompleto,
          codigo: h.codigoCompleto,
          padreId: lote.id, // Vínculo recursivo al padre
          siloOrigen: lote.siloOrigen || lote.silosOrigen?.[0]?.siloId || undefined,
          especie: lote.especie,
          variedad: lote.variedad,
          cliente: lote.cliente,
          kg: kgTotalesHijo,
          kgIniciales: kgTotalesHijo,
          envase: h.envase,
          cantidadBolsas: h.cantidadBolsas,
          stockBolsas: h.cantidadBolsas,
          kgPorBolsa: kgEnvaseHijo,
          stockKg: kgTotalesHijo,
          categoria: (h.categoria === 'preba' ? 'Preba' : (h.categoria === 'original' ? 'Original' : 'Primu')) as any,
          tipo: (h.tipo === 'intermedio' ? 'Intermedio' : 'Final') as any,
          estado: 'Disponible',
          estadoEspec: h.estado,
          estadoRegistro: 'REALIZADO',
          tratamiento: [h.tratamiento === 'curado' ? 'Curado' : 'Sin Curar'],
          producto: h.tratamiento === 'curado' ? 'Tratamiento Químico' : 'Ninguno',
          fecha: fechaHoy,
          fechaIngreso: fechaHoy,
          activo: true,
          caratulaId,
          historial: [
            {
              id: `MOV-ALTA-HIJO-${Date.now()}-${h.codigoCompleto}`,
              fecha: fechaHoy,
              tipo: 'Entrada manual',
              cantidadBolsas: h.cantidadBolsas,
              kgPorBolsa: kgEnvaseHijo,
              cantidadKg: kgTotalesHijo,
              detalle: `Alta por desdoblamiento de lote padre #${lote.codigo || lote.loteNro}`
            }
          ]
        };

        nuevosLotesHijos.push(nuevoLoteHijo);
      }

      // Persistir carátulas y bolsas
      for (let i = 0; i < caratulasTotalesAGuardar.length; i++) {
        const car = caratulasTotalesAGuardar[i];
        const bolsasDeEstaCaratula = bolsasTotalesAGuardar.filter(b => b.caratulaId === car.id);
        await guardarCaratulaYBolsasFirestore(car, bolsasDeEstaCaratula);
      }

      // Actualizar en lote padre e hijos
      const todosLosLotesActualizados = [lotePadreActualizado, ...nuevosLotesHijos];
      if (onBatchUpdateLotes) {
        await onBatchUpdateLotes(todosLosLotesActualizados);
      } else if (onSaveLote) {
        for (const l of todosLosLotesActualizados) {
          await onSaveLote(l);
        }
      }

      setSaveSuccessMsg(`¡Lote #${lote.codigo || lote.loteNro} desdoblado exitosamente en ${nuevosLotesHijos.length} hijos!`);
      setShowDesdoblarModal(false);
      setTimeout(() => setSaveSuccessMsg(''), 5000);
    } catch (err: any) {
      console.error('Error desdoblando lote:', err);
      alert(err.message || 'Error al ejecutar desdoblamiento.');
    }
  };

  // Handler para Acciones Cualitativas (cambio de estado, curado, envase, categoría, tipo, bloqueo)
  const handleConfirmAccionEspec = async (result: AccionLoteResult) => {
    try {
      const fechaHoy = new Date().toISOString().split('T')[0];
      const usuarioNombre = currentUser?.nombre || 'Operador';
      const { tipoAccion, valorAnterior, valorNuevo, observaciones, loteActualizado } = result;

      // 1. Si cambió el envase, pasar bolsas anteriores a 'reenvasada' y generar IDs nuevos
      if (tipoAccion === 'cambio_envase') {
        const caratulaId = loteActualizado.caratulaId || `CARAT-${loteActualizado.id}-${Date.now()}`;
        const bolsasAnteriores = generarBolsasParaLote(lote, lote.caratulaId || caratulaId);
        const bolsasReenvasadas = bolsasAnteriores.map(b => ({
          ...b,
          estado: 'reenvasada' as const,
        }));
        const nuevasBolsas = generarBolsasParaLote(loteActualizado, caratulaId);
        await guardarCaratulaYBolsasFirestore(
          generarCaratulaParaLote(loteActualizado),
          [...bolsasReenvasadas, ...nuevasBolsas]
        );
      }

      // 2. Registrar movimiento con fecha y usuario (Regla 1: Nunca editar directamente sin movimiento)
      await registrarMovimientoOficial({
        loteId: loteActualizado.id,
        usuario: usuarioNombre,
        tipo: tipoAccion,
        valorAnterior,
        valorNuevo,
        observaciones,
        fecha: fechaHoy
      });

      // 3. Guardar lote actualizado
      if (onBatchUpdateLotes) {
        await onBatchUpdateLotes([loteActualizado]);
      } else if (onSaveLote) {
        await onSaveLote(loteActualizado);
      }

      setSaveSuccessMsg(`¡Acción "${tipoAccion}" aplicada con éxito sobre Lote #${loteActualizado.codigo || loteActualizado.loteNro}!`);
      setShowAccionesModal(false);
      setTimeout(() => setSaveSuccessMsg(''), 5000);
    } catch (err: any) {
      console.error('Error aplicando acción sobre lote:', err);
      alert(err.message || 'Error al guardar acción.');
    }
  };

  // Handler para Confirmar Existencia Física: de "precarga" a "sin clasificar"
  const handleConfirmarExistenciaFisica = async () => {
    try {
      const fechaHoy = new Date().toISOString().split('T')[0];
      const usuarioNombre = currentUser?.nombre || 'Operador';
      const caratulaId = lote.caratulaId || `CARAT-${lote.id}-${Date.now()}`;
      const caratulaDoc = generarCaratulaParaLote(lote, new Date().toISOString());
      const nuevasBolsas = generarBolsasParaLote(lote, caratulaId);

      await guardarCaratulaYBolsasFirestore(caratulaDoc, nuevasBolsas);

      await registrarMovimientoOficial({
        loteId: lote.id,
        usuario: usuarioNombre,
        tipo: 'cambio_estado',
        valorAnterior: lote.estadoEspec || 'precarga',
        valorNuevo: 'sin clasificar',
        observaciones: 'Confirmación física de existencia del lote. Entra en existencia con IDs de bolsa.',
        fecha: fechaHoy,
      });

      const loteActualizado: Lote = {
        ...lote,
        estadoEspec: 'sin clasificar',
        estadoRegistro: 'REALIZADO',
        estado: 'Disponible',
        caratulaId,
        activo: true,
      };

      if (onBatchUpdateLotes) {
        await onBatchUpdateLotes([loteActualizado]);
      } else if (onSaveLote) {
        await onSaveLote(loteActualizado);
      }

      setSaveSuccessMsg(`¡Lote #${lote.codigo || lote.loteNro} confirmado físicamente! Entró en existencia y se generaron ${nuevasBolsas.length} bolsas.`);
      setTimeout(() => setSaveSuccessMsg(''), 5000);
    } catch (err: any) {
      console.error('Error confirmando existencia física:', err);
      alert(err.message || 'Error al confirmar lote.');
    }
  };

  // Abrir Modal "Editar Movimiento" para una línea de movimiento realizado
  const handleAbrirEditarMovimiento = (row: PanelLoteMovimientoRow) => {
    // 1. Si el lote actual es el originado por movimiento
    if (lote.esMovimiento || Boolean(lote.tipoMovimiento) || Boolean(lote.loteOrigen)) {
      setLoteToEditMovimiento(lote);
      return;
    }

    // 2. Si el movimiento generó un lote desdoblado en el sistema, buscarlo
    const loteHijo = (allLotes || []).find(
      (other) =>
        other.id !== lote.id &&
        (other.loteOrigen === lote.loteNro || other.loteOrigen === lote.id) &&
        (other.id === row.id || (row.detalle && row.detalle.includes(other.loteNro)))
    );
    if (loteHijo) {
      setLoteToEditMovimiento(loteHijo);
      return;
    }

    // 3. Si hay lotes relacionados por desdoblamiento
    if (lotesDesdobladosRelacionados.length > 0) {
      const loteRel = lotesDesdobladosRelacionados.find((l) => l.esMovimiento || Boolean(l.tipoMovimiento));
      if (loteRel) {
        setLoteToEditMovimiento(loteRel);
        return;
      }
      setLoteToEditMovimiento(lotesDesdobladosRelacionados[0]);
      return;
    }

    // Fallback: abrir modal con el lote actual
    setLoteToEditMovimiento(lote);
  };

  // Confirmar Edición de Movimiento desde EditarMovimientoModal
  const handleConfirmEditMovimiento = async (result: EditarMovimientoResult) => {
    try {
      const { loteActualizado, loteOrigenActualizado, resumenCambios } = result;
      const lotesToSave: Lote[] = [loteActualizado];
      if (loteOrigenActualizado) {
        lotesToSave.push(loteOrigenActualizado);
      }

      const batch = writeBatch(db);
      for (const l of lotesToSave) {
        const ref = doc(db, 'lotes', l.id);
        batch.set(ref, mapLoteToFirestore(l));
      }
      await batch.commit();

      if (onBatchUpdateLotes) {
        await onBatchUpdateLotes(lotesToSave);
      } else if (onSaveLote) {
        for (const l of lotesToSave) {
          await onSaveLote(l);
        }
      }

      const updatedThisLote = lotesToSave.find((l) => l.id === lote.id);
      if (updatedThisLote) {
        onUpdateLoteStock(
          updatedThisLote.id,
          updatedThisLote.historial || [],
          updatedThisLote.stockBolsas,
          updatedThisLote.stockKg,
          updatedThisLote.estado,
          `Edición de movimiento: ${resumenCambios}`
        );
      }

      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastSavedTimestamp(timeStr);
      setSaveSuccessMsg(`¡Movimiento actualizado con éxito! ${resumenCambios} (${timeStr}).`);
      setLoteToEditMovimiento(null);
    } catch (err: any) {
      console.error('Error al actualizar movimiento de lote:', err);
      alert('Error al guardar las modificaciones del movimiento.');
    }
  };

  // Abrir modal de nuevo registro
  const handleAbrirNuevo = () => {
    setEditingRow(null);
    setFormDireccion('Salida');
    setFormTipoMov('Despacho');
    setFormFecha(new Date().toISOString().split('T')[0]);
    setFormBolsas(0);
    setFormKg(0);
    setFormRemitoCliente('');
    setFormDestino('');
    setFormChofer('');
    setFormDetalle('');
    setFormError('');
    setShowModal(true);
  };

  // Abrir modal para editar registro existente
  const handleAbrirEditar = (row: PanelLoteMovimientoRow) => {
    setEditingRow(row);
    setFormFecha(row.fecha || new Date().toISOString().split('T')[0]);
    setFormRemitoCliente(row.remitoCliente || '');
    setFormDestino(row.destino || '');
    setFormChofer(row.chofer || '');
    setFormDetalle(row.detalle || '');
    setFormError('');

    if (row.esIngreso) {
      setFormDireccion('Entrada');
      setFormTipoMov('Alta');
      setFormBolsas(row.ingresoBolsas);
      setFormKg(row.ingresoKg);
    } else {
      setFormDireccion('Salida');
      setFormTipoMov(row.salidaTipo || 'Salida manual');
      setFormBolsas(row.salidaBolsas);
      setFormKg(row.salidaKg);
    }

    setShowModal(true);
  };

  // Guardar (crear o modificar) movimiento desde el modal
  const handleGuardarMovimiento = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (formBolsas <= 0 || !Number.isInteger(formBolsas)) {
      setFormError('La cantidad de bolsas debe ser un número entero mayor a 0.');
      return;
    }
    if (formKg <= 0) {
      setFormError('La cantidad de kilos debe ser mayor a 0.');
      return;
    }

    setIsSavingModal(true);

    try {
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
      let movGuardado: MovimientoStock;

      if (editingRow) {
        const targetId = editingRow.id;
        const exists = baseHistory.some((m) => m.id === targetId);

        const movModificado: MovimientoStock = mapMovimientoStockToFirestore({
          id: targetId,
          fecha: formFecha,
          tipo: formTipoMov,
          cantidadBolsas: formBolsas,
          kgPorBolsa: lote.kgPorBolsa || 40,
          cantidadKg: formKg,
          remitoCliente: formRemitoCliente.trim() || '',
          destino: formDestino.trim() || '',
          chofer: formChofer.trim() || '',
          detalle: formDetalle.trim() || `${formTipoMov} editada en panel de lote`,
          ...(editingRow.ordenId ? { ordenId: editingRow.ordenId } : {}),
        });
        movGuardado = movModificado;

        if (exists) {
          nuevoHistorial = baseHistory.map((m) => (m.id === targetId ? movModificado : m));
        } else {
          nuevoHistorial = [movModificado, ...baseHistory];
        }

        // Si era una orden de carga vinculada, sincronizar orden
        if (editingRow.ordenId && onSaveOrdenCarga) {
          const ordenMatch = ordenesCarga.find((o) => o.id === editingRow.ordenId);
          if (ordenMatch) {
            const ordenActualizada: OrdenCarga = {
              ...ordenMatch,
              fecha: formFecha,
              remitoCliente: formRemitoCliente.trim() || ordenMatch.remitoCliente || '',
              destino: formDestino.trim() || ordenMatch.destino || '',
              chofer: formChofer.trim() || ordenMatch.chofer || '',
              cantidadBolsas: (ordenMatch.loteId === lote.id || ordenMatch.loteId === lote.loteNro) ? formBolsas : ordenMatch.cantidadBolsas,
              kgTotales: (ordenMatch.loteId === lote.id || ordenMatch.loteId === lote.loteNro) ? formKg : ordenMatch.kgTotales,
              lotesOrigen: (ordenMatch.lotesOrigen || []).map((item) =>
                item.loteId === lote.id || item.loteNro === lote.loteNro
                  ? { ...item, cantidadBolsas: formBolsas, kgTotales: formKg }
                  : item
              ),
            };
            try {
              await onSaveOrdenCarga(ordenActualizada);
            } catch (errSync) {
              console.warn('Error al sincronizar orden de carga vinculada:', errSync);
            }
          }
        }
      } else {
        // Nuevo Movimiento
        const nuevoMov: MovimientoStock = mapMovimientoStockToFirestore({
          id: `MOV-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          fecha: formFecha,
          tipo: formTipoMov,
          cantidadBolsas: formBolsas,
          kgPorBolsa: lote.kgPorBolsa || 40,
          cantidadKg: formKg,
          remitoCliente: formRemitoCliente.trim() || '',
          destino: formDestino.trim() || '',
          chofer: formChofer.trim() || '',
          detalle: formDetalle.trim() || `${formTipoMov} registrada en panel de lote`,
        });
        movGuardado = nuevoMov;
        nuevoHistorial = [nuevoMov, ...baseHistory];
      }

      const { nuevoStockBolsas, nuevoStockKg, nuevoEstado } = recalcularStockDesdeHistorial(nuevoHistorial);

      const auditDesc = editingRow
        ? `Modificación en Panel de Lote (${formTipoMov}): ${formBolsas} b. (${formatNumberArg(formKg, 2)} kg).`
        : `Nuevo movimiento en Panel de Lote (${formTipoMov}): ${formBolsas} b. (${formatNumberArg(formKg, 2)} kg).`;

      const auditEntry: AuditLogEntry = {
        id: `AUD-MOV-${Date.now()}`,
        fechaHora: new Date().toISOString(),
        tipo: 'Stock',
        usuario: currentUser.nombre || 'Operador Planta',
        descripcion: auditDesc,
        detalles: `Stock disponible recalculado en todas las hojas: ${nuevoStockBolsas} b. (${formatNumberArg(nuevoStockKg, 2)} kg). Fecha: ${formFecha}.`,
      };

      const loteActualizado: Lote = {
        ...lote,
        stockBolsas: nuevoStockBolsas,
        stockKg: nuevoStockKg,
        estado: nuevoEstado,
        historial: nuevoHistorial,
        auditoria: [auditEntry, ...(lote.auditoria || [])],
      };

      // Guardar en Firestore Batch
      const batch = writeBatch(db);
      const loteRef = doc(db, 'lotes', lote.id);
      batch.set(loteRef, mapLoteToFirestore(loteActualizado));
      if (movGuardado.id && !movGuardado.id.startsWith('OC-')) {
        const movRef = doc(collection(db, 'lotes', lote.id, 'movimientos'), movGuardado.id);
        batch.set(movRef, mapMovimientoStockToFirestore(movGuardado));
      }
      await batch.commit();

      if (onSaveLote) {
        await onSaveLote(loteActualizado);
      }
      onUpdateLoteStock(lote.id, nuevoHistorial, nuevoStockBolsas, nuevoStockKg, nuevoEstado, auditDesc);

      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastSavedTimestamp(timeStr);
      setSaveSuccessMsg(
        editingRow
          ? `¡Movimiento modificado y guardado con éxito! Impacto asentado en Lotes, Reporte de Producción y Despachos.`
          : `¡Movimiento registrado y guardado con éxito! Stock actualizado en todas las hojas.`
      );

      setShowModal(false);
      setEditingRow(null);
    } catch (err) {
      console.error('Error al guardar movimiento en panel de lote:', err);
      setFormError('Error al guardar en la base de datos. Por favor reintente.');
    } finally {
      setIsSavingModal(false);
    }
  };

  // Confirmar eliminación de movimiento con frase de seguridad
  const handleConfirmarEliminar = async () => {
    if (!deletingRow) return;
    if (!deleteConfirmChecked || deleteConfirmPhrase.trim().toLowerCase() !== 'eliminar movimiento') {
      return;
    }

    setIsDeleting(true);

    try {
      const recordId = deletingRow.id;

      // Si correspondía a una orden de carga vinculada, eliminar también la orden
      if (deletingRow.ordenId || recordId.startsWith('OC-')) {
        const ordId = deletingRow.ordenId || recordId.replace('OC-', '');
        if (onDeleteOrdenCarga) {
          try {
            await onDeleteOrdenCarga(ordId);
          } catch (delOrdErr) {
            console.warn('Error al eliminar orden de carga vinculada:', delOrdErr);
          }
        }
      }

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

      const nuevoHistorial = baseHistory.filter((m) => {
        if (m.id === recordId) return false;
        if (recordId.startsWith('OC-')) {
          const ocClean = recordId.replace('OC-', '');
          if (m.ordenId === ocClean || (m.detalle && m.detalle.includes(ocClean))) return false;
        }
        if (recordId.startsWith('alta-') || recordId.startsWith('MOV-ALTA-')) {
          const t = (m.tipo || '').toLowerCase();
          if (t === 'alta' || m.id.startsWith('alta-') || m.id.startsWith('MOV-ALTA-')) return false;
        }
        if (m.id && recordId.includes(m.id)) return false;
        return true;
      });

      const { nuevoStockBolsas, nuevoStockKg, nuevoEstado } = recalcularStockDesdeHistorial(nuevoHistorial);

      const auditDesc = `Eliminación en Panel de Lote: ${deletingRow.esIngreso ? 'Ingreso/Alta' : deletingRow.salidaTipo} (${deletingRow.esIngreso ? deletingRow.ingresoBolsas : deletingRow.salidaBolsas} b. / ${formatNumberArg(deletingRow.esIngreso ? deletingRow.ingresoKg : deletingRow.salidaKg, 2)} kg).`;

      const auditEntry: AuditLogEntry = {
        id: `AUD-DEL-${Date.now()}`,
        fechaHora: new Date().toISOString(),
        tipo: 'Eliminación',
        usuario: currentUser.nombre || 'Operador Planta',
        descripcion: auditDesc,
        detalles: `Stock disponible recalculado en todas las hojas vinculadas: ${nuevoStockBolsas} b. (${formatNumberArg(nuevoStockKg, 2)} kg). Registro eliminado: ${recordId}.`,
      };

      const loteActualizado: Lote = {
        ...lote,
        stockBolsas: nuevoStockBolsas,
        stockKg: nuevoStockKg,
        estado: nuevoEstado,
        historial: nuevoHistorial,
        auditoria: [auditEntry, ...(lote.auditoria || [])],
      };

      // Guardar en Firestore Batch y registrar contraasiento oficial de anulación
      const batch = writeBatch(db);
      const loteRef = doc(db, 'lotes', lote.id);
      batch.set(loteRef, mapLoteToFirestore(loteActualizado));
      if (recordId && !recordId.startsWith('OC-') && !recordId.startsWith('alta-')) {
        const movRef = doc(collection(db, 'lotes', lote.id, 'movimientos'), recordId);
        batch.delete(movRef);
      }
      await batch.commit();

      // Registrar movimiento de anulación (contraasiento)
      await registrarMovimientoOficial({
        loteId: lote.id,
        usuario: currentUser?.nombre || 'Operador',
        tipo: 'anulacion',
        valorAnterior: recordId,
        valorNuevo: null,
        observaciones: `Contraasiento por anulación de movimiento ${recordId} (${deletingRow.esIngreso ? 'Ingreso' : deletingRow.salidaTipo})`,
        fecha: new Date().toISOString().split('T')[0]
      });

      if (onSaveLote) {
        await onSaveLote(loteActualizado);
      }
      onUpdateLoteStock(lote.id, nuevoHistorial, nuevoStockBolsas, nuevoStockKg, nuevoEstado, auditDesc, recordId);

      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastSavedTimestamp(timeStr);
      setSaveSuccessMsg('¡Movimiento eliminado! Modificaciones asentadas en el lote y en todas las hojas vinculadas.');

      setDeletingRow(null);
      setDeleteConfirmChecked(false);
      setDeleteConfirmPhrase('');
    } catch (err) {
      console.error('Error al eliminar movimiento de panel de lote:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Guardar y Asentar Manualmente todas las modificaciones de la Bitácora en BD y todas las hojas vinculadas
  const handleAsentarCambiosPanel = async () => {
    setIsSavingGeneral(true);
    setSaveSuccessMsg('');
    try {
      const hist = [...(lote.historial || [])];
      const { nuevoStockBolsas, nuevoStockKg, nuevoEstado } = recalcularStockDesdeHistorial(hist);

      const auditEntry: AuditLogEntry = {
        id: `AUD-SYNC-${Date.now()}`,
        fechaHora: new Date().toISOString(),
        tipo: 'Edición',
        usuario: currentUser.nombre || 'Operador Planta',
        descripcion: `Asentamiento general de Panel de Lote #${lote.loteNro} guardado en Base de Datos.`,
        detalles: `Stock confirmado en todas las hojas vinculadas: ${nuevoStockBolsas} b. (${formatNumberArg(nuevoStockKg, 2)} kg). Total movimientos: ${hist.length}.`,
      };

      const loteActualizado: Lote = {
        ...lote,
        stockBolsas: nuevoStockBolsas,
        stockKg: nuevoStockKg,
        estado: nuevoEstado,
        historial: hist,
        auditoria: [auditEntry, ...(lote.auditoria || [])],
      };

      const batch = writeBatch(db);
      const loteRef = doc(db, 'lotes', lote.id);
      batch.set(loteRef, mapLoteToFirestore(loteActualizado));

      if (hist.length > 0) {
        for (const mov of hist) {
          if (mov.id && !mov.id.startsWith('OC-')) {
            const movRef = doc(collection(db, 'lotes', lote.id, 'movimientos'), mov.id);
            batch.set(movRef, mapMovimientoStockToFirestore(mov));
          }
        }
      }
      await batch.commit();

      if (onSaveLote) {
        await onSaveLote(loteActualizado);
      }
      onUpdateLoteStock(lote.id, hist, nuevoStockBolsas, nuevoStockKg, nuevoEstado, auditEntry.descripcion);

      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastSavedTimestamp(timeStr);
      setSaveSuccessMsg(`¡Modificaciones asentadas con éxito! Los datos impactan en Lotes, Reporte de Producción, Despachos y Silos (${timeStr}).`);
    } catch (err) {
      console.error('Error al asentar modificaciones de panel de lote:', err);
      setSaveSuccessMsg('Error al guardar en base de datos. Por favor reintente.');
    } finally {
      setIsSavingGeneral(false);
    }
  };

  // Exportar Panel a Excel
  const handleExportExcel = () => {
    const dataToExport = rowsFiltradas.map((item) => ({
      Fecha: formatToDDMMAAAA(item.fecha),
      'Ingresos (Alta)': item.esIngreso
        ? `${item.ingresoKg} kg / ${item.ingresoBolsas} b.${item.esTratado ? ` (Tratado: ${item.kgTratados || item.ingresoKg} kg)` : ''}`
        : '—',
      Movimiento: item.esMovimiento ? item.tipoMovimientoTexto : '—',
      'Salidas (Despacho / Consumo / Baja)': item.esSalida
        ? `${item.salidaKg} kg / ${item.salidaBolsas} b. (${item.salidaTipo})`
        : '—',
      'Saldo Resultante': `${item.saldoKg} kg / ${item.saldoBolsas} b.`,
      'N° Remito Cliente': item.remitoCliente || '—',
      Destino: item.destino || '—',
      Chofer: item.chofer || '—',
      'Detalle / Observaciones': item.detalle || '—',
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Panel de Lote');
    XLSX.writeFile(wb, `Panel_Lote_${lote.loteNro}_${lote.cliente}.xlsx`);
  };

  return (
    <div className="space-y-5 text-left">
      {/* CABECERA PRINCIPAL: PANEL DE LOTE */}
      <div className="bg-gradient-to-r from-emerald-950 via-[#00603C] to-[#254731] text-white p-5 sm:p-6 rounded-2xl shadow-md border border-emerald-800/40 space-y-4">
        {/* BLOQUE SUPERIOR COMPLETO: TÍTULO Y METADATOS DEL LOTE */}
        <div className="space-y-2 border-b border-emerald-800/60 pb-3.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-sans font-black tracking-widest text-emerald-950 uppercase bg-amber-400 px-2.5 py-0.5 rounded-full shadow-2xs">
              Panel de Lote
            </span>
            <span className="text-xs text-emerald-200 font-mono font-semibold bg-emerald-900/60 px-2.5 py-0.5 rounded-lg border border-emerald-700/50">
              Lote #{lote.loteNro} · {lote.cliente}
            </span>
            <span className="text-xs text-amber-200/90 font-medium bg-emerald-900/40 px-2.5 py-0.5 rounded-lg border border-emerald-700/40">
              {lote.especie} · {lote.variedad}
            </span>
          </div>
          <h3 className="font-serif text-2xl sm:text-3xl font-black text-[#F6EFDC] flex items-center gap-2.5 tracking-tight uppercase">
            <Layers className="w-7 h-7 text-[#C9922E]" />
            <span>PANEL DE LOTE</span>
          </h3>
        </div>

        {/* BOTONERA DE ACCIÓN UBICADA POR DEBAJO DEL TÍTULO */}
        <div className="flex flex-wrap items-center gap-2.5 pt-0.5">


          {/* Botón "Desdoblar Lote" */}
          {!readOnly && (
            <button
              type="button"
              id={`panel-btn-desdoblar-${lote.id}`}
              onClick={() => {
                const op = puedeOperarLote(lote);
                if (!op.permitido) {
                  alert(op.motivo);
                  return;
                }
                setShowDesdoblarModal(true);
              }}
              disabled={!puedeOperarLote(lote).permitido}
              className="px-3.5 py-2 bg-purple-700 hover:bg-purple-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95 border border-purple-500"
              title={puedeOperarLote(lote).permitido ? "Desdoblar lote en N hijos con bolsas completas" : puedeOperarLote(lote).motivo}
            >
              <Scissors className="w-4 h-4 text-purple-200" />
              <span>Desdoblar Lote</span>
            </button>
          )}

          {/* Botón Bloquear / Desbloquear */}
          {!readOnly && (
            normalizarEstado(lote.estadoEspec || lote.estado, lote.estadoRegistro) === 'bloqueado' ? (
              <button
                type="button"
                id={`panel-btn-desbloquear-${lote.id}`}
                onClick={() => {
                  setAccionesInitialTab('bloqueo');
                  setShowAccionesModal(true);
                }}
                className="px-3.5 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-black rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer active:scale-95 border border-amber-300"
                title="Lote BLOQUEADO. Clic para desbloquear y retornar al estado anterior."
              >
                <Unlock className="w-4 h-4 text-slate-950" />
                <span>Desbloquear</span>
              </button>
            ) : (
              <button
                type="button"
                id={`panel-btn-bloquear-${lote.id}`}
                onClick={() => {
                  setAccionesInitialTab('bloqueo');
                  setShowAccionesModal(true);
                }}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-slate-200 text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer border border-slate-600"
                title="Bloquear lote: impide despacho, curado y desdoblamiento hasta desbloquear."
              >
                <Lock className="w-4 h-4 text-amber-300" />
                <span>Bloquear</span>
              </button>
            )
          )}

          {/* 2. Botón "+ Registrar Movimiento" */}
          {!readOnly && (
            <button
              type="button"
              id={`panel-btn-registrar-mov-${lote.id}`}
              onClick={handleAbrirNuevo}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition cursor-pointer active:scale-95 border border-emerald-500"
              title="Registrar salida manual, baja por calidad o consumo"
            >
              <Plus className="w-4 h-4 text-emerald-200" />
              <span>+ Registrar Movimiento</span>
            </button>
          )}

          {/* 3. Botón "Dividir Panel" (capacidad de dividir panel en caso de desdoblamiento) */}
          <button
            type="button"
            id={`panel-btn-dividir-${lote.id}`}
            onClick={() => setIsPanelDivided((prev) => !prev)}
            className={`px-3.5 py-2 text-xs font-black rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer border ${
              isPanelDivided
                ? 'bg-amber-400 text-emerald-950 border-amber-300 ring-2 ring-amber-300/60'
                : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
            }`}
            title={
              isPanelDivided
                ? 'Volver a Vista Unificada del Lote'
                : 'Dividir Panel por Desdoblamiento (Tipo de Tratamiento, Tipo de Lote o Categoría)'
            }
          >
            <Columns2 className="w-4 h-4" />
            <span>{isPanelDivided ? 'Vista Unificada' : 'Dividir Panel'}</span>
            {lotesDesdobladosRelacionados.length > 0 && (
              <span className="px-1.5 py-0.25 text-[10px] font-mono rounded-full bg-emerald-900 text-emerald-200">
                {lotesDesdobladosRelacionados.length}
              </span>
            )}
          </button>

          {/* 4. Botón "Guardar y Asentar en Todas las Hojas" */}
          {!readOnly && (
            <button
              type="button"
              id={`panel-btn-asentar-${lote.id}`}
              onClick={handleAsentarCambiosPanel}
              disabled={isSavingGeneral}
              className="px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition cursor-pointer active:scale-95 border border-emerald-700 disabled:opacity-50"
              title="Asentar modificaciones del panel en base de datos para impactar en todas las hojas vinculadas"
            >
              {isSavingGeneral ? (
                <Loader2 className="w-4 h-4 animate-spin text-emerald-200" />
              ) : (
                <Save className="w-4 h-4 text-amber-300" />
              )}
              <span>Guardar y Asentar</span>
            </button>
          )}

          {/* 5. Exportar Excel */}
          <button
            type="button"
            id={`panel-btn-excel-${lote.id}`}
            onClick={handleExportExcel}
            className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer border border-white/20"
            title="Descargar tabla en formato Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
            <span>Excel</span>
          </button>
        </div>

        {/* NOTIFICACIÓN DE ÉXITO O IMPACTO */}
        {saveSuccessMsg && (
          <div className="mt-4 p-3 bg-emerald-900/90 border border-emerald-400 text-emerald-100 rounded-xl text-xs flex items-center justify-between shadow-md animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
              <span className="font-semibold">{saveSuccessMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setSaveSuccessMsg('')}
              className="text-emerald-300 hover:text-white p-1 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* TARJETAS RESUMEN DE BALANCE EN CABECERA */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
          {/* Ingresos (Alta) */}
          <div className="bg-emerald-900/40 p-3 rounded-xl border border-emerald-700/50">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5" /> Total Ingresos (Alta)
              </span>
              <span className="text-[10px] font-mono text-emerald-200 font-semibold bg-emerald-800/80 px-2 py-0.5 rounded">
                Alta
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-xl font-black text-white">
                +{formatNumberArg(metrics.entradasKg, 0)}{' '}
                <span className="text-xs font-normal text-emerald-300">kg</span>
              </span>
              <span className="text-xs font-mono text-emerald-300 font-semibold">
                (+{formatNumberArg(metrics.entradasBolsas, 0)} b.)
              </span>
            </div>
            {metrics.altaTratadosKg > 0 && (
              <div className="mt-2 pt-1.5 border-t border-emerald-800/60 flex items-center justify-between text-[10px]">
                <span className="text-purple-300 font-bold flex items-center gap-1">
                  <FlaskConical className="w-3 h-3 text-purple-300" /> Curado en Alta:
                </span>
                <span className="font-mono font-black text-purple-200">
                  {formatNumberArg(metrics.altaTratadosKg, 0)} kg
                </span>
              </div>
            )}
          </div>

          {/* Salidas (Despachos / Consumo / Bajas) */}
          <div className="bg-amber-950/40 p-3 rounded-xl border border-amber-700/40">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1">
                <ArrowDownRight className="w-3.5 h-3.5" /> Total Salidas (Despachos/Consumo)
              </span>
              <span className="text-[10px] font-mono text-amber-200 font-semibold bg-amber-900/80 px-2 py-0.5 rounded">
                Egresos
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-xl font-black text-amber-200">
                -{formatNumberArg(metrics.salidasKg, 0)}{' '}
                <span className="text-xs font-normal text-amber-300">kg</span>
              </span>
              <span className="text-xs font-mono text-amber-300 font-semibold">
                (-{formatNumberArg(metrics.salidasBolsas, 0)} b.)
              </span>
            </div>
          </div>

          {/* Stock Disponible Actual */}
          <div className="bg-white/10 p-3 rounded-xl border border-white/20">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-200 flex items-center gap-1">
                <Scale className="w-3.5 h-3.5" /> Stock Disponible Actual
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-400 text-emerald-950">
                {lote.estado}
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-xl font-black text-amber-300">
                {formatNumberArg(metrics.stockActualKg, 0)}{' '}
                <span className="text-xs font-normal text-emerald-200">kg</span>
              </span>
              <span className="text-xs font-mono text-emerald-200 font-semibold">
                ({formatNumberArg(metrics.stockActualBolsas, 0)} b.)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SECCIÓN DIVIDIDA: EN CASO DE DESDOBLAMIENTO (POR TRATAMIENTO, TIPO DE LOTE O CATEGORÍA) */}
      {isPanelDivided && (
        <div className="bg-slate-50 p-5 rounded-2xl border-2 border-indigo-200 shadow-sm space-y-4 animate-in fade-in duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-sans font-black tracking-wider text-indigo-900 uppercase bg-indigo-100 px-2 py-0.5 rounded">
                  División de Panel de Lote
                </span>
                <span className="text-xs text-gray-500">
                  Desdoblamientos por Tratamiento, Tipo o Categoría
                </span>
              </div>
              <h4 className="font-serif text-base font-bold text-gray-900 mt-1 flex items-center gap-2">
                <Columns2 className="w-4 h-4 text-indigo-600" />
                <span>Paneles Desdoblados de Lote #{lote.loteNro}</span>
              </h4>
            </div>

            {/* Selector de Criterio de División */}
            <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-indigo-200 shadow-2xs self-start sm:self-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-2">
                Dividir por:
              </span>
              <button
                type="button"
                onClick={() => setCriterioDivision('tratamiento')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                  criterioDivision === 'tratamiento'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <FlaskConical className="w-3.5 h-3.5" />
                <span>Tipo de Tratamiento</span>
              </button>
              <button
                type="button"
                onClick={() => setCriterioDivision('tipo')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                  criterioDivision === 'tipo'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                <span>Tipo de Lote</span>
              </button>
              <button
                type="button"
                onClick={() => setCriterioDivision('categoria')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                  criterioDivision === 'categoria'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Categoría</span>
              </button>
            </div>
          </div>

          {/* CUADRO COMPARATIVO DE LOS PANELES DIVIDIDOS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* PANEL A: FRACCIÓN / LOTE BASE */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                    Panel Principal · Lote #{lote.loteNro}
                  </span>
                  <h5 className="font-serif text-sm font-bold text-gray-900 mt-1">
                    {criterioDivision === 'tratamiento'
                      ? `Fracción: ${Array.isArray(lote.tratamiento) ? lote.tratamiento.join(', ') : lote.tratamiento || 'Sin Curar'}`
                      : criterioDivision === 'tipo'
                      ? `Fracción: ${lote.tipo}`
                      : `Categoría: ${lote.categoria}`}
                  </h5>
                </div>
                <div className="text-right font-mono">
                  <span className="text-sm font-black text-gray-900 block">
                    {formatNumberArg(lote.stockKg, 0)} kg
                  </span>
                  <span className="text-[11px] text-gray-500 font-semibold">
                    {formatNumberArg(lote.stockBolsas, 0)} bolsas
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs bg-gray-50 p-2.5 rounded-lg text-gray-600">
                <div>
                  <span className="text-[9px] uppercase font-bold text-gray-400 block">Tipo</span>
                  <span className="font-semibold text-gray-800">{lote.tipo}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-gray-400 block">Tratamiento</span>
                  <span className="font-semibold text-gray-800 truncate block">
                    {Array.isArray(lote.tratamiento) ? lote.tratamiento.join(', ') : lote.tratamiento || 'Sin Curar'}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-gray-400 block">Categoría</span>
                  <span className="font-semibold text-gray-800">{lote.categoria}</span>
                </div>
              </div>

              <div className="text-xs text-gray-500 flex items-center justify-between pt-1">
                <span>Movimientos registrados en esta fracción:</span>
                <span className="font-mono font-bold text-gray-800">{rowsMovimientos.length}</span>
              </div>
            </div>

            {/* PANEL B: FRACCIÓN DESDOBLADA O DERIVADA */}
            <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-200 shadow-xs space-y-3">
              {loteDesdobladoActivo ? (
                <>
                  <div className="flex items-center justify-between border-b border-indigo-100 pb-2.5">
                    <div>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-900 bg-indigo-100 px-2 py-0.5 rounded">
                        Panel Desdoblado · Lote #{loteDesdobladoActivo.loteNro}
                      </span>
                      <h5 className="font-serif text-sm font-bold text-indigo-950 mt-1">
                        {criterioDivision === 'tratamiento'
                          ? `Fracción: ${Array.isArray(loteDesdobladoActivo.tratamiento) ? loteDesdobladoActivo.tratamiento.join(', ') : loteDesdobladoActivo.tratamiento || 'Curado'}`
                          : criterioDivision === 'tipo'
                          ? `Fracción: ${loteDesdobladoActivo.tipo}`
                          : `Categoría: ${loteDesdobladoActivo.categoria}`}
                      </h5>
                    </div>
                    <div className="text-right font-mono">
                      <span className="text-sm font-black text-indigo-950 block">
                        {formatNumberArg(loteDesdobladoActivo.stockKg, 0)} kg
                      </span>
                      <span className="text-[11px] text-indigo-700 font-semibold">
                        {formatNumberArg(loteDesdobladoActivo.stockBolsas, 0)} bolsas
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs bg-white p-2.5 rounded-lg text-gray-600 border border-indigo-100">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-indigo-400 block">Tipo</span>
                      <span className="font-semibold text-gray-800">{loteDesdobladoActivo.tipo}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-indigo-400 block">Tratamiento</span>
                      <span className="font-semibold text-indigo-900 font-bold truncate block">
                        {Array.isArray(loteDesdobladoActivo.tratamiento)
                          ? loteDesdobladoActivo.tratamiento.join(', ')
                          : loteDesdobladoActivo.tratamiento || 'Curado'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-indigo-400 block">Categoría</span>
                      <span className="font-semibold text-gray-800">{loteDesdobladoActivo.categoria}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-indigo-900">
                      Origen: Lote #{loteDesdobladoActivo.loteOrigen || lote.loteNro}
                    </span>
                    {onSelectLote && (
                      <button
                        type="button"
                        onClick={() => onSelectLote(loteDesdobladoActivo)}
                        className="text-xs font-bold text-indigo-700 hover:text-indigo-900 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>Abrir este lote</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="h-full flex flex-col justify-center items-center text-center p-4 space-y-2.5">
                  <div className="p-3 bg-indigo-100 text-indigo-700 rounded-full">
                    <ArrowRightLeft className="w-6 h-6" />
                  </div>
                  <div>
                    <h5 className="font-bold text-xs text-indigo-950 uppercase tracking-wider">
                      Sin Desdoblamiento Activo por {criterioDivision.toUpperCase()}
                    </h5>
                    <p className="text-xs text-gray-500 mt-1 max-w-xs">
                      Este lote aún no se ha desdoblado en un sub-lote por {criterioDivision}. Puede registrar un desdoblamiento ahora.
                    </p>
                  </div>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => setShowMovimientoModal(true)}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition cursor-pointer active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Desdoblar Lote Ahora</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* NAVEGACIÓN DE SUB-PESTAÑAS DEL DETALLE DE LOTE (ESPECIFICACIÓN OFICIAL SECCIÓN 8) */}
      <div className="bg-white p-2 rounded-2xl border border-gray-200 shadow-xs flex flex-wrap items-center gap-2">
        <button
          type="button"
          id="btn-subtab-movimientos"
          onClick={() => setPanelSubTab('movimientos')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            panelSubTab === 'movimientos'
              ? 'bg-[#00603C] text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Historial de Movimientos ({rowsFiltradas.length})</span>
        </button>

        <button
          type="button"
          id="btn-subtab-genealogia"
          onClick={() => setPanelSubTab('genealogia')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            panelSubTab === 'genealogia'
              ? 'bg-[#00603C] text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <GitFork className="w-4 h-4" />
          <span>Árbol de Genealogía {lotesHijos.length > 0 || lotePadre ? `(${lotesHijos.length + (lotePadre ? 1 : 0)})` : ''}</span>
        </button>

        <button
          type="button"
          id="btn-subtab-bolsas"
          onClick={() => setPanelSubTab('bolsas')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            panelSubTab === 'bolsas'
              ? 'bg-[#00603C] text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Bolsas y QR ({listaBolsasLote.length})</span>
        </button>

      </div>

      {/* PESTAÑA 1: HISTORIAL DE MOVIMIENTOS */}
      {panelSubTab === 'movimientos' && (
        <>
          {/* BARRA DE FILTROS Y BÚSQUEDA DE LA TABLA */}
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-gray-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Selector de Dirección / Tipo */}
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setFilterDireccion('')}
                  className={`px-3 py-1.5 rounded-md transition cursor-pointer ${
                    filterDireccion === '' ? 'bg-[#00603C] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Todos ({rowsMovimientos.length})
                </button>
            <button
              type="button"
              onClick={() => setFilterDireccion('Ingresos')}
              className={`px-3 py-1.5 rounded-md transition flex items-center gap-1 cursor-pointer ${
                filterDireccion === 'Ingresos'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Ingresos</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterDireccion('Movimientos')}
              className={`px-3 py-1.5 rounded-md transition flex items-center gap-1 cursor-pointer ${
                filterDireccion === 'Movimientos'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Movimientos ({metrics.movimientosCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterDireccion('Salidas')}
              className={`px-3 py-1.5 rounded-md transition flex items-center gap-1 cursor-pointer ${
                filterDireccion === 'Salidas'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <ArrowDownRight className="w-3.5 h-3.5" />
              <span>Salidas</span>
            </button>
          </div>

          {/* Input de Búsqueda */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por remito, chofer, destino..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs w-48 sm:w-64 focus:outline-none focus:ring-1 focus:ring-[#00603C]"
            />
          </div>

          {(filterDireccion || searchTerm) && (
            <button
              type="button"
              onClick={() => {
                setFilterDireccion('');
                setSearchTerm('');
              }}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded transition cursor-pointer"
              title="Limpiar filtros"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-gray-500 text-xs self-end md:self-center">
          <span>Orden:</span>
          <button
            type="button"
            onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg font-semibold text-gray-800 transition cursor-pointer"
          >
            {sortOrder === 'desc' ? 'Más recientes primero' : 'Más antiguos primero'}
          </button>
        </div>
      </div>

      {/* TABLA PRINCIPAL DEL PANEL DE LOTE */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gradient-to-r from-emerald-950 via-[#00603C] to-emerald-900 text-white font-bold text-[11px] tracking-wide">
                {/* 1. Fecha */}
                <th className="py-3 px-3.5 whitespace-nowrap">Fecha</th>

                {/* 2. Ingresos (kg / bolsas) (Alta) */}
                <th className="py-3 px-3.5 text-right whitespace-nowrap">
                  Ingresos (kg / bolsas) (Alta)
                </th>

                {/* 3. Movimiento */}
                <th className="py-3 px-3.5 whitespace-nowrap">
                  Movimiento (Intermedio, Final, Tratado)
                </th>

                {/* 4. Salidas (kg / bolsas) (Despachos, Bajas, Consumo) */}
                <th className="py-3 px-3.5 text-right whitespace-nowrap">
                  Salidas (kg / bolsas) (Despachos/Baja/Consumo)
                </th>

                {/* 5. Saldo Resultante */}
                <th className="py-3 px-3.5 text-right whitespace-nowrap">
                  Saldo Resultante (kg / b.)
                </th>

                {/* 6. Documentación / Trazabilidad */}
                <th className="py-3 px-3.5 whitespace-nowrap">
                  Remito / Chofer / Destino
                </th>

                {/* 7. Acciones (Editar / Eliminar) */}
                {!readOnly && (
                  <th className="py-3 px-3.5 text-center whitespace-nowrap">
                    Acciones
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rowsFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={readOnly ? 6 : 7} className="py-10 text-center text-gray-400 text-xs">
                    No se encontraron movimientos registrados con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                rowsFiltradas.map((row, idx) => {
                  return (
                    <tr
                      key={`${row.id}-${idx}`}
                      className={`transition ${
                        idx % 2 === 0 ? 'bg-white hover:bg-emerald-50/30' : 'bg-slate-50/50 hover:bg-emerald-50/30'
                      }`}
                    >
                      {/* 1. FECHA: FORMATO dd/mm/aaaa */}
                      <td className="py-3 px-3.5 font-semibold text-gray-800 whitespace-nowrap font-mono">
                        {formatToDDMMAAAA(row.fecha)}
                      </td>

                      {/* 2. INGRESOS (EXPRESADO EN KG / BOLSAS) (ALTA) */}
                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
                        {row.esIngreso ? (
                          <div className="inline-flex flex-col items-end">
                            <span className="font-mono font-black text-xs text-[#00603C] flex items-center gap-1">
                              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
                              +{formatNumberArg(row.ingresoKg, 0)} kg
                            </span>
                            <span className="text-[10px] font-mono text-emerald-700 font-semibold">
                              +{formatNumberArg(row.ingresoBolsas, 0)} bolsas
                            </span>
                            {row.esPrecarga && (
                              <span className="mt-0.5 text-[9px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-bold">
                                Pre-carga
                              </span>
                            )}
                            {/* Kilos dados de alta marcados como Tratados */}
                            {row.esTratado && (
                              <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-900 border border-purple-300 shadow-2xs">
                                <FlaskConical className="w-3 h-3 text-purple-700 shrink-0" />
                                <span>Alta Curado: {formatNumberArg(row.kgTratados || row.ingresoKg, 0)} kg</span>
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-300 font-mono">—</span>
                        )}
                      </td>

                      {/* 3. MOVIMIENTO (EJ: INTERMEDIO A FINAL, INT A FINAL TRATADO, FINAL A FINAL TRATADO) */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {row.esMovimiento ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="inline-flex flex-col items-start gap-0.5">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-100 text-indigo-900 border border-indigo-300 shadow-2xs">
                                <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-700 stroke-[2.5]" />
                                <span>{row.tipoMovimientoTexto || 'Movimiento Realizado'}</span>
                              </span>
                              {row.tratamientoMovimiento && (
                                <span className="text-[10px] text-indigo-700 font-medium pl-1 flex items-center gap-1">
                                  <FlaskConical className="w-2.5 h-2.5 text-indigo-500" />
                                  {row.tratamientoMovimiento}
                                </span>
                              )}
                            </div>

                            {/* Botón "Editar Movimiento" específicamente junto a la línea de movimiento realizado */}
                            {!readOnly && (
                              <button
                                type="button"
                                id={`btn-editar-movimiento-${row.id}`}
                                onClick={() => handleAbrirEditarMovimiento(row)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-100 hover:bg-purple-200 text-purple-950 border border-purple-300 rounded-lg text-xs font-black shadow-2xs transition cursor-pointer active:scale-95 shrink-0"
                                title="Editar Movimiento Realizado: Modificar cantidad de bolsas pasadas, cualidad y tratamiento"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-purple-700 stroke-[2.5]" />
                                <span>Editar Movimiento</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-300 font-mono">—</span>
                        )}
                      </td>

                      {/* 4. SALIDAS (EXPRESADO EN KG / BOLSAS) (DESPACHOS, BAJA POR CALIDAD, PASADO A CONSUMO) */}
                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
                        {row.esSalida ? (
                          <div className="inline-flex flex-col items-end">
                            <span className="font-mono font-black text-xs text-[#A0522D] flex items-center gap-1">
                              <ArrowDownRight className="w-3.5 h-3.5 text-amber-700" />
                              -{formatNumberArg(row.salidaKg, 0)} kg
                            </span>
                            <span className="text-[10px] font-mono text-amber-800 font-semibold">
                              -{formatNumberArg(row.salidaBolsas, 0)} bolsas
                            </span>
                            <span className={`mt-0.5 text-[9px] px-1.5 py-0.2 rounded font-bold ${
                              row.salidaTipo === 'Despacho'
                                ? 'bg-blue-100 text-blue-900'
                                : row.salidaTipo === 'Pasado a Consumo'
                                ? 'bg-amber-100 text-amber-900'
                                : row.salidaTipo === 'Baja por calidad'
                                ? 'bg-rose-100 text-rose-900'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {row.salidaTipo || 'Salida'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-300 font-mono">—</span>
                        )}
                      </td>

                      {/* 5. SALDO RESULTANTE */}
                      <td className="py-3 px-3.5 text-right whitespace-nowrap font-mono">
                        <span className="font-bold text-gray-900 block">
                          {formatNumberArg(row.saldoKg, 0)} kg
                        </span>
                        <span className="text-[10px] text-gray-500 font-medium">
                          {formatNumberArg(row.saldoBolsas, 0)} b.
                        </span>
                      </td>

                      {/* 6. TRAZABILIDAD / REMITO / CHOFER */}
                      <td className="py-3 px-3.5 max-w-[200px]">
                        <div className="truncate font-medium text-gray-800" title={row.detalle}>
                          {row.detalle || '—'}
                        </div>
                        {(row.remitoCliente || row.chofer || row.destino) && (
                          <div className="text-[10px] text-gray-500 flex flex-wrap gap-1 mt-0.5">
                            {row.remitoCliente && (
                              <span className="bg-gray-100 px-1 py-0.2 rounded font-mono">
                                R: {row.remitoCliente}
                              </span>
                            )}
                            {row.chofer && (
                              <span className="bg-gray-100 px-1 py-0.2 rounded">
                                Ch: {row.chofer}
                              </span>
                            )}
                            {row.destino && (
                              <span className="bg-gray-100 px-1 py-0.2 rounded">
                                D: {row.destino}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 7. ACCIONES: EDITAR O ELIMINAR CADA MOVIMIENTO */}
                      {!readOnly && (
                        <td className="py-3 px-3.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {row.esMovimiento ? (
                              <button
                                type="button"
                                onClick={() => handleAbrirEditarMovimiento(row)}
                                className="p-1.5 text-purple-700 hover:text-purple-900 hover:bg-purple-100 rounded-lg transition cursor-pointer"
                                title="Editar movimiento realizado"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleAbrirEditar(row)}
                                className="p-1.5 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                                title="Editar este movimiento"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setDeletingRow(row);
                                setDeleteConfirmChecked(false);
                                setDeleteConfirmPhrase('');
                              }}
                              className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Eliminar este movimiento"
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
      </div>
      </>
      )}

      {/* PESTAÑA 2: ÁRBOL DE GENEALOGÍA (ESPECIFICACIÓN OFICIAL SECCIÓN 8) */}
      {panelSubTab === 'genealogia' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
          <div className="border-b border-gray-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#00603C]">
                Árbol Genealógico de Trazabilidad
              </span>
              <h4 className="font-serif text-lg font-bold text-gray-900 mt-0.5">
                Genealogía Recursiva del Lote #{lote.codigo || lote.loteNro}
              </h4>
              <p className="text-xs text-gray-500 mt-0.5">
                Estructura de parentesco basada en padreId. Refleja divisiones sucesivas y trazabilidad histórica.
              </p>
            </div>
            {!readOnly && (
              <button
                type="button"
                onClick={() => {
                  const op = puedeOperarLote(lote);
                  if (!op.permitido) {
                    alert(op.motivo);
                    return;
                  }
                  setShowDesdoblarModal(true);
                }}
                disabled={!puedeOperarLote(lote).permitido}
                className="px-3.5 py-1.5 bg-purple-700 hover:bg-purple-800 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Scissors className="w-4 h-4" />
                <span>Desdoblar este lote</span>
              </button>
            )}
          </div>

          {/* 1. Lote Padre Ancestral */}
          {lotePadre ? (
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                Lote de Origen (Padre Ancestral)
              </span>
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      Lote #{lotePadre.codigo || lotePadre.loteNro}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900">
                      Padre
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-800">
                      {normalizarEstado(lotePadre.estadoEspec || lotePadre.estado, lotePadre.estadoRegistro)}
                    </span>
                  </div>
                  <span className="text-xs text-slate-600 block mt-1">
                    {lotePadre.cliente} · {lotePadre.variedad} ({lotePadre.especie}) · {normalizarEnvase(lotePadre.envase || lotePadre.kgPorBolsa)}
                  </span>
                </div>
                {onSelectLote && (
                  <button
                    type="button"
                    onClick={() => onSelectLote(lotePadre)}
                    className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Ver Padre</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="flex justify-center py-1">
                <ChevronRight className="w-5 h-5 text-gray-400 rotate-90" />
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200/80 p-3 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Este lote es de <strong>origen inicial</strong> (padreId: null). No proviene de un desdoble.</span>
            </div>
          )}

          {/* 2. Lote Actual */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-[#00603C] uppercase tracking-wider block">
              Lote Actual ({lote.id})
            </span>
            <div className="bg-emerald-50/60 border-2 border-[#00603C] p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-black text-emerald-950 text-base">
                    Lote #{lote.codigo || lote.loteNro}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#00603C] text-white">
                    Lote Actual
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    normalizarEstado(lote.estadoEspec || lote.estado, lote.estadoRegistro) === 'bloqueado'
                      ? 'bg-rose-100 text-rose-900'
                      : normalizarEstado(lote.estadoEspec || lote.estado, lote.estadoRegistro) === 'desdoblado'
                      ? 'bg-purple-100 text-purple-900'
                      : normalizarEstado(lote.estadoEspec || lote.estado, lote.estadoRegistro) === 'agotado'
                      ? 'bg-gray-200 text-gray-800'
                      : 'bg-emerald-100 text-emerald-900'
                  }`}>
                    {normalizarEstado(lote.estadoEspec || lote.estado, lote.estadoRegistro).toUpperCase()}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    normalizarTratamiento(lote.tratamiento) === 'curado'
                      ? 'bg-purple-100 text-purple-900'
                      : 'bg-amber-100 text-amber-900'
                  }`}>
                    {normalizarTratamiento(lote.tratamiento).toUpperCase()}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-200 text-slate-800">
                    {normalizarEnvase(lote.envase || lote.kgPorBolsa)}
                  </span>
                </div>
                <div className="text-xs text-gray-600 mt-1.5 flex flex-wrap items-center gap-3">
                  <span>Stock Actual: <strong>{lote.stockBolsas} bolsas</strong> ({formatNumberArg(lote.stockKg, 0)} kg)</span>
                  <span>Categoría: <strong>{normalizarCategoria(lote.categoria).toUpperCase()}</strong></span>
                  <span>Tipo: <strong>{normalizarTipo(lote.tipo).toUpperCase()}</strong></span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Lotes Hijos (si existen) */}
          {lotesHijos.length > 0 ? (
            <div className="space-y-3 pt-2">
              <div className="flex justify-center py-1">
                <ChevronRight className="w-5 h-5 text-gray-400 rotate-90" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-purple-900 uppercase tracking-wider block">
                  Lotes Hijos Resultantes ({lotesHijos.length} sub-lotes)
                </span>
                <span className="text-xs font-mono text-gray-500">
                  Total transferido: {formatNumberArg(lotesHijos.reduce((acc, h) => acc + (Number(h.stockKg) || 0), 0), 0)} kg
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {lotesHijos.map(hijo => (
                  <div
                    key={hijo.id}
                    className="p-3.5 bg-purple-50/50 border border-purple-200 rounded-xl space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-sm text-purple-950">
                        #{hijo.codigo || hijo.loteNro}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-200 text-purple-900">
                        {normalizarTratamiento(hijo.tratamiento).toUpperCase()}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-gray-500 block">Bolsas / Kg:</span>
                        <span className="font-mono font-bold text-gray-800">
                          {hijo.stockBolsas} b. ({formatNumberArg(hijo.stockKg, 0)} kg)
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 block">Envase:</span>
                        <span className="font-mono font-bold text-gray-800">
                          {normalizarEnvase(hijo.envase || hijo.kgPorBolsa)}
                        </span>
                      </div>
                    </div>
                    {onSelectLote && (
                      <button
                        type="button"
                        onClick={() => onSelectLote(hijo)}
                        className="w-full mt-2 py-1.5 bg-white border border-purple-300 hover:bg-purple-100 text-purple-900 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <span>Abrir este lote hijo</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl text-xs text-gray-600 text-center space-y-2">
              <p>Este lote no ha sido desdoblado en lotes hijos.</p>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => setShowDesdoblarModal(true)}
                  disabled={!puedeOperarLote(lote).permitido}
                  className="px-3.5 py-1.5 bg-purple-700 hover:bg-purple-800 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span>Desdoblar en Lotes Hijos</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA 3: BOLSAS Y CÓDIGOS QR (VISOR DE BOLSAS EN FORMATO TABLA CON MOVIMIENTO) */}
      {panelSubTab === 'bolsas' && (
        <VisorBolsasLote
          lote={lote}
          bolsas={bolsasLote}
          readOnly={readOnly}
          currentUser={currentUser}
          onUpdateBolsas={handleActualizarBolsasDesdeVisor}
          onVerQr={(b) => setSelectedBolsaParaVer(b)}
        />
      )}



      {/* MODAL PREVIEW DE ETIQUETA QR DE BOLSA */}
      {selectedBolsaParaVer && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full p-6 space-y-4 border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#00603C] block font-bold">
                  Etiqueta Oficial de Bolsa con QR
                </span>
                <h4 className="font-mono text-lg font-bold text-gray-900">
                  Bolsa #{selectedBolsaParaVer.id}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBolsaParaVer(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-2 border border-gray-200 rounded-2xl bg-slate-50 flex justify-center overflow-x-auto">
              <IdBolsaLabel
                lote={lote}
                bagNumber={selectedBolsaParaVer.numero}
                totalBags={selectedBolsaParaVer.totalBolsas}
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-gray-500">
                <span>Estado: <strong>{selectedBolsaParaVer.estado}</strong></span>
                {selectedBolsaParaVer.bolsaOrigenId && (
                  <span className="ml-3 font-mono">Origen: {selectedBolsaParaVer.bolsaOrigenId}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedBolsaParaVer(null)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-[#00603C] hover:bg-[#254731] text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-4 h-4 text-amber-300" />
                  <span>Imprimir Etiqueta</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: MOVIMIENTO DE LOTE (TRASLADADO DESDE LA VISTA DE TABLA) */}
      {showMovimientoModal && (
        <MovimientoLoteModal
          isOpen={showMovimientoModal}
          lote={lote}
          allLotes={allLotes}
          plantaConfig={plantaConfig}
          currentUser={currentUser}
          onClose={() => setShowMovimientoModal(false)}
          onConfirmMovimiento={handleConfirmMovimiento}
        />
      )}

      {/* MODAL 1.5: EDITAR MOVIMIENTO DE LOTE (TRASLADADO DESDE LA TABLA DE LOTES JUNTO A LA LÍNEA DE MOVIMIENTO) */}
      {loteToEditMovimiento && (
        <EditarMovimientoModal
          isOpen={Boolean(loteToEditMovimiento)}
          lote={loteToEditMovimiento}
          allLotes={allLotes}
          plantaConfig={plantaConfig}
          currentUser={currentUser}
          onClose={() => setLoteToEditMovimiento(null)}
          onConfirmEditMovimiento={handleConfirmEditMovimiento}
        />
      )}

      {/* MODAL 2: REGISTRAR / MODIFICAR MOVIMIENTO MANUAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <h4 className="font-serif text-base font-bold text-gray-900 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#00603C]" />
                <span>
                  {editingRow ? 'Modificar Movimiento en Panel' : 'Registrar Nuevo Movimiento'}
                </span>
              </h4>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGuardarMovimiento} className="space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Fecha</label>
                  <input
                    type="date"
                    value={formFecha}
                    onChange={(e) => setFormFecha(e.target.value)}
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-1 focus:ring-[#00603C]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Tipo de Salida / Operación</label>
                  <select
                    value={formTipoMov}
                    onChange={(e) => setFormTipoMov(e.target.value)}
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-1 focus:ring-[#00603C]"
                  >
                    <option value="Despacho">Despacho</option>
                    <option value="Baja por calidad">Baja por calidad</option>
                    <option value="Pasado a Consumo">Pasado a Consumo</option>
                    <option value="Salida por movimiento">Salida por movimiento</option>
                    <option value="Salida manual">Salida manual</option>
                    <option value="Alta">Alta / Entrada</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Cantidad de Bolsas</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={formBolsas || ''}
                    onChange={(e) => {
                      const b = Number(e.target.value);
                      setFormBolsas(b);
                      setFormKg(b * (lote.kgPorBolsa || 40));
                    }}
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-1 focus:ring-[#00603C] font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Total Kilogramos (kg)</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={formKg || ''}
                    onChange={(e) => setFormKg(Number(e.target.value))}
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-1 focus:ring-[#00603C] font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">N° Remito Cliente</label>
                  <input
                    type="text"
                    value={formRemitoCliente}
                    onChange={(e) => setFormRemitoCliente(e.target.value)}
                    placeholder="Ej: R-00045"
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Destino</label>
                  <input
                    type="text"
                    value={formDestino}
                    onChange={(e) => setFormDestino(e.target.value)}
                    placeholder="Ej: Planta Tandil"
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Chofer</label>
                  <input
                    type="text"
                    value={formChofer}
                    onChange={(e) => setFormChofer(e.target.value)}
                    placeholder="Ej: Carlos Gómez"
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">Detalle / Justificación</label>
                <textarea
                  rows={2}
                  value={formDetalle}
                  onChange={(e) => setFormDetalle(e.target.value)}
                  placeholder="Observaciones del movimiento registrado..."
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingModal}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingModal ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 text-emerald-200" />
                  )}
                  <span>Guardar y Asentar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CONFIRMAR ELIMINACIÓN DE MOVIMIENTO */}
      {deletingRow && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-rose-200 space-y-4 text-left animate-in fade-in duration-150">
            <div className="flex items-center gap-3 text-rose-600 border-b border-rose-100 pb-3">
              <div className="p-2.5 bg-rose-50 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-serif text-base font-bold text-gray-900">
                  Confirmar Eliminación Definitiva
                </h4>
                <p className="text-xs text-gray-500">
                  Esta acción recalculará el stock en todas las hojas.
                </p>
              </div>
            </div>

            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-xs space-y-1">
              <div>
                <span className="font-bold text-gray-500">Registro:</span>{' '}
                <span className="font-semibold text-gray-800">
                  {deletingRow.esIngreso ? 'Ingreso/Alta' : deletingRow.salidaTipo}
                </span>
              </div>
              <div>
                <span className="font-bold text-gray-500">Fecha:</span>{' '}
                <span className="font-mono">{formatToDDMMAAAA(deletingRow.fecha)}</span>
              </div>
              <div>
                <span className="font-bold text-gray-500">Volumen:</span>{' '}
                <span className="font-mono font-bold text-rose-700">
                  {deletingRow.esIngreso ? deletingRow.ingresoBolsas : deletingRow.salidaBolsas} b. (
                  {formatNumberArg(deletingRow.esIngreso ? deletingRow.ingresoKg : deletingRow.salidaKg, 2)} kg)
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deleteConfirmChecked}
                  onChange={(e) => setDeleteConfirmChecked(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500"
                />
                <span className="font-semibold text-gray-800">
                  Entiendo que se ajustará el stock del lote y las hojas vinculadas.
                </span>
              </label>

              <div>
                <label className="block text-gray-700 font-bold mb-1">
                  Escriba <span className="font-mono text-rose-600">"eliminar movimiento"</span> para confirmar:
                </label>
                <input
                  type="text"
                  value={deleteConfirmPhrase}
                  onChange={(e) => setDeleteConfirmPhrase(e.target.value)}
                  placeholder="eliminar movimiento"
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setDeletingRow(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={
                  !deleteConfirmChecked ||
                  deleteConfirmPhrase.trim().toLowerCase() !== 'eliminar movimiento' ||
                  isDeleting
                }
                onClick={handleConfirmarEliminar}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>Eliminar Movimiento</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Desdoblamiento de Lote (Especificación Sección 5) */}
      {showDesdoblarModal && (
        <DesdoblarLoteModal
          isOpen={showDesdoblarModal}
          lote={lote}
          currentUser={currentUser}
          onClose={() => setShowDesdoblarModal(false)}
          onConfirmDesdoble={handleConfirmDesdobleEspec}
        />
      )}

      {/* Modal de Acciones Cualitativas y Operativas (Especificación Sección 5 y Bloqueo) */}
      {showAccionesModal && (
        <AccionesLoteModal
          isOpen={showAccionesModal}
          lote={lote}
          currentUser={currentUser}
          initialTab={accionesInitialTab}
          onClose={() => setShowAccionesModal(false)}
          onConfirmAccion={handleConfirmAccionEspec}
        />
      )}
    </div>
  );
};
