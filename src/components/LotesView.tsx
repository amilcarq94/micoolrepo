/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Lote, EstadoLoteType, TipoLoteType, MovimientoSilo, LoteLimitsConfig, PlantaConfig, AuditLogEntry, CategoriaType, CATEGORIAS_OFICIALES } from '../types';
import { formatNumberArg, formatKg, formatDateStr } from '../utils/formatters';
import { Search, Grid, List, Plus, Filter, Eye, Edit2, Edit3, ArrowDownRight, Trash2, QrCode, Download, Lock, ShieldAlert, KeyRound, X, Flame, Warehouse, Layers, Info, SlidersHorizontal, Check, Pin, RotateCcw, ChevronDown, Package, Sprout, Clock, CheckCircle2, BarChart2, Building2, Tag, FlaskConical, PieChart, Wheat, Sliders, PackagePlus, RefreshCw, FileText, ListFilter, Copy, Scale, FileSpreadsheet, Calendar, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown, Maximize2, Minimize2, ArrowRightLeft } from 'lucide-react';
import { BatchPrintIdBolsasModal } from './BatchPrintIdBolsasModal';
import { BatchPrintLotesModal } from './BatchPrintLotesModal';
import { ImprimirFichaTecnica } from './ImprimirFichaTecnica';
import { QrCodeModal } from './QrCodeModal';
import { LoteLimitsConfigModal } from './LoteLimitsConfigModal';
import { ProcesarLoteModal } from './ProcesarLoteModal';
import { MovRealizadoModal } from './MovRealizadoModal';
import { BulkEditLotesModal } from './BulkEditLotesModal';
import { TratarLoteModal } from './TratarLoteModal';
import { MovimientoLoteModal, MovimientoLoteResult } from './MovimientoLoteModal';
import { EditarMovimientoModal, EditarMovimientoResult } from './EditarMovimientoModal';
import { PaginationControls } from './PaginationControls';
import { SiloId, BolsonCampo } from '../types';
import { LotesUnifiedDashboard } from './LotesUnifiedDashboard';
import { ConfirmationDialog } from './ConfirmationDialog';

/**
 * Determina de forma unificada si un lote posee tratamiento químico aplicado
 */
export function isLoteTratado(l: Lote): boolean {
  if (!l) return false;
  const trats = Array.isArray(l.tratamiento) ? l.tratamiento : (l.tratamiento ? [l.tratamiento] : []);
  const hasTratadoKeyword = trats.some(t => {
    if (!t) return false;
    const s = String(t).trim().toLowerCase();
    return s === 'tratado' || (s !== '' && s !== 'sin tratar' && s !== 'sin tratamiento' && s !== 'ninguno');
  });

  const hasMovTratado = Boolean(l.tipoMovimiento && l.tipoMovimiento.toLowerCase().includes('tratado'));
  const hasProductoAplicado = Boolean(
    l.productoAplicado &&
    l.productoAplicado.trim() !== '' &&
    l.productoAplicado !== 'Sin Tratamiento' &&
    l.productoAplicado !== 'Ninguno'
  );
  const hasProducto = Boolean(
    l.producto &&
    !['Ninguno', 'Sin Tratamiento', 'FINAL', 'INTERMEDIO', 'Sin Tratar', ''].includes(l.producto.trim())
  );

  return hasTratadoKeyword || hasMovTratado || hasProductoAplicado || hasProducto;
}

export function getLoteProductoTratamiento(l: Lote): string | null {
  if (!isLoteTratado(l)) return null;
  if (l.productoAplicado && l.productoAplicado.trim() && l.productoAplicado !== 'Sin Tratamiento' && l.productoAplicado !== 'Ninguno') {
    return l.productoAplicado.trim();
  }
  if (l.producto && !['Ninguno', 'Sin Tratamiento', 'FINAL', 'INTERMEDIO', 'Sin Tratar', ''].includes(l.producto.trim())) {
    return l.producto.trim();
  }
  if (Array.isArray(l.tratamiento)) {
    const chemical = l.tratamiento.find(t => t && !['Sin Tratar', 'Tratado', 'Sin Tratamiento', 'Ninguno'].includes(t.trim()));
    if (chemical) return chemical.trim();
  }
  return null;
}

/**
 * Determina si un lote es o fue originado por un movimiento
 */
export function isMovimientoLote(l: Lote): boolean {
  if (!l) return false;
  return Boolean(
    l.esMovimiento ||
    l.tipoMovimiento ||
    l.loteOrigen ||
    (l.loteNro && (l.loteNro.toUpperCase().includes('MOV') || l.loteNro.toUpperCase().includes('-FIN') || l.loteNro.toUpperCase().includes('-TRA'))) ||
    l.fechaRealizacionMovimiento
  );
}

interface MultiSelectDropdownProps {
  id: string;
  label: string;
  options: string[];
  selectedValues: string[];
  onChange: (newSelected: string[]) => void;
  getOptionCount?: (opt: string) => number;
}

const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  id,
  label,
  options,
  selectedValues,
  onChange,
  getOptionCount,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');

  const filteredOptions = useMemo(() => {
    if (!filterQuery.trim()) return options;
    return options.filter(opt => opt.toLowerCase().includes(filterQuery.toLowerCase()));
  }, [options, filterQuery]);

  const isAllSelected = options.length > 0 && selectedValues.length === options.length;

  const toggleOption = (val: string) => {
    if (selectedValues.includes(val)) {
      onChange(selectedValues.filter(v => v !== val));
    } else {
      onChange([...selectedValues, val]);
    }
  };

  const handleSelectAll = () => {
    if (isAllSelected) {
      onChange([]);
    } else {
      onChange([...options]);
    }
  };

  const handleClear = () => {
    onChange([]);
  };

  const displayButtonText = useMemo(() => {
    if (selectedValues.length === 0) return `${label}: Todos`;
    if (selectedValues.length === 1) return `${label}: ${selectedValues[0]}`;
    return `${label}: ${selectedValues.length} sel.`;
  }, [label, selectedValues]);

  return (
    <div className="relative" id={`container-${id}`}>
      <button
        type="button"
        id={id}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 text-xs rounded-xl border transition-all flex items-center justify-between h-10 font-medium cursor-pointer ${
          selectedValues.length > 0
            ? 'bg-[#E3EFE7] text-[#00603C] border-[#00603C]/40 font-bold shadow-2xs'
            : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
        }`}
      >
        <span className="truncate pr-1">{displayButtonText}</span>
        <div className="flex items-center gap-1 shrink-0">
          {selectedValues.length > 0 && (
            <span className="bg-[#00603C] text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
              {selectedValues.length}
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 mt-1.5 w-60 bg-white border border-gray-200 rounded-2xl shadow-xl p-3 z-40 animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="flex justify-between items-center pb-2 mb-2 border-b border-gray-100">
              <span className="text-[11px] font-bold text-[#00603C] uppercase tracking-wider">{label}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-[10px] font-bold text-[#00603C] hover:underline cursor-pointer"
                >
                  {isAllSelected ? 'Ninguno' : 'Todos'}
                </button>
                {selectedValues.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-[10px] font-bold text-red-600 hover:underline cursor-pointer"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            {options.length > 5 && (
              <div className="mb-2">
                <input
                  type="text"
                  placeholder={`Buscar ${label.toLowerCase()}...`}
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#00603C]"
                />
              </div>
            )}

            <div className="max-h-52 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
              {filteredOptions.length === 0 ? (
                <div className="text-[11px] text-gray-400 py-2 text-center">Sin opciones</div>
              ) : (
                filteredOptions.map((opt) => {
                  const isChecked = selectedValues.includes(opt);
                  const count = getOptionCount ? getOptionCount(opt) : undefined;
                  return (
                    <label
                      key={opt}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition ${
                        isChecked ? 'bg-[#E3EFE7]/60 font-semibold text-[#00603C]' : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleOption(opt)}
                          className="w-3.5 h-3.5 rounded text-[#00603C] focus:ring-[#00603C] cursor-pointer"
                        />
                        <span className="truncate">{opt}</span>
                      </div>
                      {count !== undefined && (
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${isChecked ? 'bg-[#00603C] text-white' : 'bg-gray-100 text-gray-500'}`}>
                          {count}
                        </span>
                      )}
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export const normalizeCliente = (c?: string): string => {
  if (!c) return '';
  const trimmed = c.trim();
  const upper = trimmed.toUpperCase();
  if (upper === 'SAN DIEGO' || upper === 'SAN DIEGO SEMILLA' || upper === 'SAN DIEGO SEMILLAS') {
    return 'San Diego Semillas';
  }
  return trimmed;
};

interface LotesViewProps {
  lotes: Lote[];
  movimientosSilo?: MovimientoSilo[];
  siloStocks?: Record<SiloId, number>;
  bolsones?: BolsonCampo[];
  clientes?: string[];
  especies?: string[];
  plantaConfig?: PlantaConfig;
  loteLimits?: LoteLimitsConfig;
  onUpdateLoteLimits?: (limits: LoteLimitsConfig) => void;
  onSelectLote: (lote: Lote) => void;
  onEditLote: (lote: Lote) => void;
  onAddLote: () => void;
  onRegistrarSalidaLote: (lote: Lote) => void;
  onDeleteLote: (id: string) => void;
  onDeleteMultipleLotes: (ids: string[]) => void;
  currentUser: { nombre: string; rol: string };
  onWipeStocks: () => Promise<void>;
  onSaveLote?: (lote: Lote) => Promise<void>;
  onBatchUpdateLotes?: (lotes: Lote[]) => Promise<void>;
  onRefresh?: () => Promise<void> | void;
}

export const LotesView: React.FC<LotesViewProps> = ({
  lotes,
  movimientosSilo,
  siloStocks,
  bolsones,
  clientes,
  especies,
  plantaConfig,
  loteLimits,
  onUpdateLoteLimits,
  onSelectLote,
  onEditLote,
  onAddLote,
  onRegistrarSalidaLote,
  onDeleteLote,
  onDeleteMultipleLotes,
  currentUser,
  onWipeStocks,
  onSaveLote,
  onBatchUpdateLotes,
  onRefresh,
}) => {
  const [showLimitsModal, setShowLimitsModal] = useState(false);
  const [loteToProcess, setLoteToProcess] = useState<Lote | null>(null);
  const [lotesToProcessBatch, setLotesToProcessBatch] = useState<Lote[]>([]);
  const [loteToTratar, setLoteToTratar] = useState<Lote | null>(null);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [selectedIdBolsasLote, setSelectedIdBolsasLote] = useState<Lote | null>(null);
  const [batchIdBolsasLotes, setBatchIdBolsasLotes] = useState<Lote[] | null>(null);
  const [selectedFichaLote, setSelectedFichaLote] = useState<Lote | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshToast, setRefreshToast] = useState<string | null>(null);
  const [loteToMovRealizado, setLoteToMovRealizado] = useState<Lote | null>(null);
  const [lotesToMovRealizadoBatch, setLotesToMovRealizadoBatch] = useState<Lote[]>([]);
  const [loteToMovimiento, setLoteToMovimiento] = useState<Lote | null>(null);
  const [loteToEditMovimiento, setLoteToEditMovimiento] = useState<Lote | null>(null);

  const handleRefreshInfo = async () => {
    setIsRefreshing(true);
    try {
      if (onRefresh) {
        await onRefresh();
      }
      await new Promise(resolve => setTimeout(resolve, 500));
      setRefreshToast('Información y stocks de lotes actualizados');
      setTimeout(() => setRefreshToast(null), 3000);
    } catch (err) {
      console.error('Error al actualizar información:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleConfirmTratamiento = async ({
    loteOriginal,
    bolsasACurar,
    fechaTratamiento,
    productoQuimico,
    loteExistenteT
  }: {
    loteOriginal: Lote;
    bolsasACurar: number;
    fechaTratamiento: string;
    productoQuimico: string;
    loteExistenteT?: Lote;
  }) => {
    const kgPorBolsa = loteOriginal.kgPorBolsa || 800;
    const kgACurar = bolsasACurar * kgPorBolsa;
    const bolsasTotalOriginal = loteOriginal.stockBolsas || 0;
    const esCuradoTotal = bolsasACurar >= bolsasTotalOriginal;

    if (loteExistenteT) {
      const egresoMov = {
        id: `MOV-EGR-TRAT-${Date.now()}`,
        fecha: fechaTratamiento,
        tipo: 'Salida por movimiento' as const,
        bolsas: bolsasACurar,
        cantidadBolsas: bolsasACurar,
        kgPorBolsa,
        kg: kgACurar,
        cantidadKg: kgACurar,
        detalle: `Salida por movimiento: Curado -> enviado a Lote ${loteExistenteT.loteNro}`
      };

      const nuevasBolsasOriginal = Math.max(0, loteOriginal.stockBolsas - bolsasACurar);
      const nuevosKgOriginal = Math.max(0, loteOriginal.stockKg - kgACurar);
      const nuevoEstadoOriginal = nuevasBolsasOriginal === 0 ? ('Agotado' as const) : loteOriginal.estado;

      const loteOriginalActualizado: Lote = {
        ...loteOriginal,
        stockBolsas: nuevasBolsasOriginal,
        stockKg: nuevosKgOriginal,
        estado: nuevoEstadoOriginal,
        historial: [egresoMov, ...(loteOriginal.historial || [])],
        auditoria: [
          {
            id: `AUD-TRAT-${Date.now()}`,
            fechaHora: new Date().toISOString(),
            tipo: 'Edición',
            usuario: currentUser.nombre,
            descripcion: `Salida por movimiento: Egreso por Curado de ${bolsasACurar} bolsas hacia Lote ${loteExistenteT.loteNro}`
          },
          ...(loteOriginal.auditoria || [])
        ]
      };

      const ingresoMov = {
        id: `MOV-ING-TRAT-${Date.now()}`,
        fecha: fechaTratamiento,
        tipo: 'Entrada manual' as const,
        bolsas: bolsasACurar,
        cantidadBolsas: bolsasACurar,
        kgPorBolsa,
        kg: kgACurar,
        cantidadKg: kgACurar,
        detalle: `Ingreso por Curado desde Lote ${loteOriginal.loteNro}`
      };

      const nuevasBolsasT = (loteExistenteT.stockBolsas || 0) + bolsasACurar;
      const nuevosKgT = (loteExistenteT.stockKg || 0) + kgACurar;

      const loteTActualizado: Lote = {
        ...loteExistenteT,
        stockBolsas: nuevasBolsasT,
        stockKg: nuevosKgT,
        estado: 'Disponible',
        fechaTratamiento,
        producto: productoQuimico || loteExistenteT.producto,
        historial: [ingresoMov, ...(loteExistenteT.historial || [])],
        auditoria: [
          {
            id: `AUD-ING-TRAT-${Date.now()}`,
            fechaHora: new Date().toISOString(),
            tipo: 'Edición',
            usuario: currentUser.nombre,
            descripcion: `Ingreso por Curado de ${bolsasACurar} bolsas desde Lote ${loteOriginal.loteNro}`
          },
          ...(loteExistenteT.auditoria || [])
        ]
      };

      if (onBatchUpdateLotes) {
        await onBatchUpdateLotes([loteOriginalActualizado, loteTActualizado]);
      } else if (onSaveLote) {
        await onSaveLote(loteOriginalActualizado);
        await onSaveLote(loteTActualizado);
      }
    } else {
      if (esCuradoTotal) {
        const nuevoNombreT = `${loteOriginal.loteNro}T`;
        const docIdT = `${loteOriginal.cliente.replace(/\s+/g, '_')}_${nuevoNombreT}`;

        const loteTratadoCompleto: Lote = {
          ...loteOriginal,
          id: docIdT,
          loteNro: nuevoNombreT,
          tratamiento: ['Tratado'],
          estado: 'Disponible',
          fechaTratamiento,
          producto: productoQuimico || 'Maxim Quattro + Inoculante',
          auditoria: [
            {
              id: `AUD-TRAT-TOTAL-${Date.now()}`,
              fechaHora: new Date().toISOString(),
              tipo: 'Edición',
              usuario: currentUser.nombre,
              descripcion: `Curado total. Lote renombrado a ${nuevoNombreT}`
            },
            ...(loteOriginal.auditoria || [])
          ]
        };

        if (onSaveLote) {
          await onSaveLote(loteTratadoCompleto);
        }
      } else {
        const bolsasRestantes = Math.max(0, bolsasTotalOriginal - bolsasACurar);
        const kgRestantes = bolsasRestantes * kgPorBolsa;

        const egresoParcialMov = {
          id: `MOV-EGR-PARCIAL-${Date.now()}`,
          fecha: fechaTratamiento,
          tipo: 'Salida por movimiento' as const,
          bolsas: bolsasACurar,
          cantidadBolsas: bolsasACurar,
          kgPorBolsa,
          kg: kgACurar,
          cantidadKg: kgACurar,
          detalle: `Salida por movimiento: Desdoblamiento por Curado parcial (${bolsasACurar} b.) -> Lote ${loteOriginal.loteNro}T`
        };

        const loteOriginalRestante: Lote = {
          ...loteOriginal,
          stockBolsas: bolsasRestantes,
          stockKg: kgRestantes,
          estado: bolsasRestantes === 0 ? 'Agotado' : loteOriginal.estado,
          historial: [egresoParcialMov, ...(loteOriginal.historial || [])],
          auditoria: [
            {
              id: `AUD-DESDOBLE-${Date.now()}`,
              fechaHora: new Date().toISOString(),
              tipo: 'Edición',
              usuario: currentUser.nombre,
              descripcion: `Salida por movimiento: Desdoblamiento por Curado de ${bolsasACurar} bolsas hacia Lote ${loteOriginal.loteNro}T`
            },
            ...(loteOriginal.auditoria || [])
          ]
        };

        const nuevoNombreT = `${loteOriginal.loteNro}T`;
        const docIdT = `${loteOriginal.cliente.replace(/\s+/g, '_')}_${nuevoNombreT}`;

        const ingresoMovT = {
          id: `MOV-ING-NUEVO-T-${Date.now()}`,
          fecha: fechaTratamiento,
          tipo: 'Entrada manual' as const,
          bolsas: bolsasACurar,
          cantidadBolsas: bolsasACurar,
          kgPorBolsa,
          kg: kgACurar,
          cantidadKg: kgACurar,
          detalle: `Origen: Curado parcial de ${loteOriginal.loteNro}`
        };

        const nuevoLoteT: Lote = {
          ...loteOriginal,
          id: docIdT,
          loteNro: nuevoNombreT,
          stockBolsas: bolsasACurar,
          stockKg: kgACurar,
          tratamiento: ['Tratado'],
          producto: productoQuimico || 'Maxim Quattro + Inoculante',
          estado: 'Disponible',
          fechaTratamiento,
          historial: [ingresoMovT],
          auditoria: [
            {
              id: `AUD-CRE-T-${Date.now()}`,
              fechaHora: new Date().toISOString(),
              tipo: 'Creación',
              usuario: currentUser.nombre,
              descripcion: `Creación por Curado Parcial (${bolsasACurar} bolsas) desde Lote ${loteOriginal.loteNro}`
            }
          ]
        };

        if (onBatchUpdateLotes) {
          await onBatchUpdateLotes([loteOriginalRestante, nuevoLoteT]);
        } else if (onSaveLote) {
          await onSaveLote(loteOriginalRestante);
          await onSaveLote(nuevoLoteT);
        }
      }
    }
  };

  const handleConfirmMovimiento = async (result: MovimientoLoteResult) => {
    try {
      const { loteOrigenActualizado, nuevoLoteGenerado, tipoMovimientoLabel } = result;

      if (onBatchUpdateLotes) {
        await onBatchUpdateLotes([loteOrigenActualizado, nuevoLoteGenerado]);
      } else if (onSaveLote) {
        await onSaveLote(loteOrigenActualizado);
        await onSaveLote(nuevoLoteGenerado);
      }

      setRefreshToast(`Movimiento "${tipoMovimientoLabel}" registrado: Nuevo Lote ${nuevoLoteGenerado.loteNro} generado con éxito.`);
      setTimeout(() => setRefreshToast(null), 4000);
    } catch (err) {
      console.error('Error al registrar movimiento de lote:', err);
      alert('Error al registrar el movimiento.');
    }
  };

  const handleConfirmEditMovimiento = async (result: EditarMovimientoResult) => {
    try {
      const { loteActualizado, loteOrigenActualizado, resumenCambios } = result;
      const lotesToSave: Lote[] = [loteActualizado];
      if (loteOrigenActualizado) {
        lotesToSave.push(loteOrigenActualizado);
      }

      if (onBatchUpdateLotes) {
        await onBatchUpdateLotes(lotesToSave);
      } else if (onSaveLote) {
        for (const l of lotesToSave) {
          await onSaveLote(l);
        }
      }

      setRefreshToast(`Movimiento actualizado: ${resumenCambios}`);
      setTimeout(() => setRefreshToast(null), 4000);
    } catch (err) {
      console.error('Error al actualizar movimiento de lote:', err);
      alert('Error al guardar las modificaciones del movimiento.');
    }
  };
  // Tipos y estados para ordenamiento por columna en la vista de tabla
  type TableSortField =
    | 'fechaAlta'
    | 'cliente'
    | 'especie'
    | 'variedad'
    | 'loteId'
    | 'tipo'
    | 'tratamiento'
    | 'categoria'
    | 'envase'
    | 'bolsas'
    | 'stockKg'
    | 'estado';

  // Constante para almacenamiento persistente del filtro fijado
  const PIN_STORAGE_KEY = 'agroabacus_pinned_lotes_filters_v3';

  // Cargar estado inicial fijado desde localStorage
  const getInitialFilterState = () => {
    try {
      const saved = localStorage.getItem(PIN_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          isPinned: parsed.isPinned !== undefined ? Boolean(parsed.isPinned) : true,
          search: typeof parsed.search === 'string' ? parsed.search : '',
          filterClientes: Array.isArray(parsed.filterClientes) ? parsed.filterClientes : [],
          filterEspecies: Array.isArray(parsed.filterEspecies) ? parsed.filterEspecies : [],
          filterVariedades: Array.isArray(parsed.filterVariedades) ? parsed.filterVariedades : [],
          filterTipos: Array.isArray(parsed.filterTipos) ? parsed.filterTipos : [],
          filterCategorias: Array.isArray(parsed.filterCategorias) ? parsed.filterCategorias : [],
          filterTratamientos: Array.isArray(parsed.filterTratamientos) ? parsed.filterTratamientos : [],
          filterEstados: Array.isArray(parsed.filterEstados) ? parsed.filterEstados : [],
          filterEstadoRegistro: (parsed.filterEstadoRegistro as 'TODOS' | 'REALIZADO' | 'PRE-CARGA') || 'TODOS',
          filterAlas: Array.isArray(parsed.filterAlas) ? parsed.filterAlas : [],
          filterSectores: Array.isArray(parsed.filterSectores) ? parsed.filterSectores : [],
          sortField: (parsed.sortField as TableSortField) || 'fechaAlta',
          sortOrder: (parsed.sortOrder as 'asc' | 'desc') || 'desc',
        };
      }
    } catch (e) {
      console.error('Error al cargar filtros fijados:', e);
    }
    return {
      isPinned: true,
      search: '',
      filterClientes: [],
      filterEspecies: [],
      filterVariedades: [],
      filterTipos: [],
      filterCategorias: [],
      filterTratamientos: [],
      filterEstados: [],
      filterEstadoRegistro: 'TODOS' as const,
      filterAlas: [],
      filterSectores: [],
      sortField: 'fechaAlta' as TableSortField,
      sortOrder: 'desc' as const,
    };
  };

  const initialFilters = useMemo(() => getInitialFilterState(), []);

  // Estados para búsqueda y filtrado múltiple
  const [search, setSearch] = useState<string>(initialFilters.search);
  const [filterClientes, setFilterClientes] = useState<string[]>(initialFilters.filterClientes);
  const [filterEspecies, setFilterEspecies] = useState<string[]>(initialFilters.filterEspecies);
  const [filterVariedades, setFilterVariedades] = useState<string[]>(initialFilters.filterVariedades);
  const [filterTipos, setFilterTipos] = useState<string[]>(initialFilters.filterTipos);
  const [filterCategorias, setFilterCategorias] = useState<string[]>(initialFilters.filterCategorias);
  const [filterTratamientos, setFilterTratamientos] = useState<string[]>(initialFilters.filterTratamientos);
  const [filterEstados, setFilterEstados] = useState<string[]>(initialFilters.filterEstados);
  const [filterEstadoRegistro, setFilterEstadoRegistro] = useState<'TODOS' | 'REALIZADO' | 'PRE-CARGA'>(initialFilters.filterEstadoRegistro);
  const [filterAlas, setFilterAlas] = useState<string[]>(initialFilters.filterAlas);
  const [filterSectores, setFilterSectores] = useState<string[]>(initialFilters.filterSectores);
  const [isFilterPinned, setIsFilterPinned] = useState<boolean>(initialFilters.isPinned);
  const [showLotesIntegrantesModal, setShowLotesIntegrantesModal] = useState<boolean>(false);
  const [copiedLotesSuccess, setCopiedLotesSuccess] = useState<boolean>(false);

  // Identificar qué dimensiones tienen un filtro activo aplicado
  const activeFilterDimensions = useMemo(() => {
    return {
      ESTADO_REGISTRO: filterEstadoRegistro !== 'TODOS',
      CLIENTE: filterClientes.length > 0,
      ESPECIE: filterEspecies.length > 0,
      VARIEDAD: filterVariedades.length > 0,
      CATEGORIA: filterCategorias.length > 0,
      TIPO: filterTipos.length > 0,
      TRATAMIENTO: filterTratamientos.length > 0,
      ESTADO: filterEstados.length > 0,
    };
  }, [filterEstadoRegistro, filterClientes, filterEspecies, filterVariedades, filterCategorias, filterTipos, filterTratamientos, filterEstados]);

  const activeDimensionCount = useMemo(() => {
    return Object.values(activeFilterDimensions).filter(Boolean).length;
  }, [activeFilterDimensions]);

  // Manejador de filtrado rápido interactivo desde el Dashboard Unificado
  const handleQuickFilter = (dimension: string, value: string) => {
    const dim = dimension.toLowerCase();
    if (dim === 'especie') {
      setFilterEspecies(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
    } else if (dim === 'variedad') {
      setFilterVariedades(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
    } else if (dim === 'cliente') {
      const normVal = normalizeCliente(value);
      setFilterClientes(prev => {
        const exists = prev.some(p => normalizeCliente(p) === normVal);
        return exists ? prev.filter(p => normalizeCliente(p) !== normVal) : [...prev, normVal];
      });
    } else if (dim === 'categoria') {
      setFilterCategorias(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
    } else if (dim === 'tipo') {
      setFilterTipos(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
    } else if (dim === 'tratamiento') {
      setFilterTratamientos(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
    } else if (dim === 'estado') {
      setFilterEstados(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
    }
  };

  const [selectedQrLote, setSelectedQrLote] = useState<Lote | null>(null);
  
  // Estado para selección de múltiples lotes
  const [selectedLoteIds, setSelectedLoteIds] = useState<string[]>([]);
  const [showBatchDeleteDialog, setShowBatchDeleteDialog] = useState(false);

  const handleDeleteSelectedLotes = () => {
    if (selectedLoteIds.length === 0) return;
    setShowBatchDeleteDialog(true);
  };
  
  // Estado para tipo de vista (tarjetas o tabla) - Por defecto vista tabla
  const [viewType, setViewType] = useState<'grid' | 'table'>('table');

  // Estado para batch de fichas técnicas en selección múltiple
  const [batchFichasLotes, setBatchFichasLotes] = useState<Lote[] | null>(null);

  // Estado para el menú desplegable de opciones de cada lote en tabla
  const [activeActionDropdownId, setActiveActionDropdownId] = useState<string | null>(null);

  const [sortField, setSortField] = useState<TableSortField>(initialFilters.sortField);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialFilters.sortOrder);

  const handleToggleSort = (field: TableSortField) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Columnas visibles en vista de tabla compacta
  const [visibleColumns, setVisibleColumns] = useState({
    fechaAlta: true,
    cliente: true,
    especie: true,
    variedad: true,
    loteId: true,
    tipo: true,
    tratamiento: true,
    categoria: true,
    envase: true,
    bolsas: true,
    stockKg: true,
    estado: true,
  });
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  // Estados para el borrado de stocks (Amilcar Quiroz)
  const [showWipeModal, setShowWipeModal] = useState(false);
  const [wipePassword, setWipePassword] = useState('');
  const [wipeError, setWipeError] = useState('');
  const [isWiping, setIsWiping] = useState(false);

  // Estado para la confirmación de borrado de un lote individual
  const [loteToDelete, setLoteToDelete] = useState<Lote | null>(null);

  // Estados para Edición Directa de Lote en Tabla (sin abrir hoja distinta)
  const [inlineEditingLoteId, setInlineEditingLoteId] = useState<string | null>(null);
  const [inlineEditData, setInlineEditData] = useState<{
    loteNro: string;
    stockBolsas: number;
    categoria: string;
    estado: EstadoLoteType;
    tipo: TipoLoteType;
    estadoRegistro?: EstadoRegistroLote;
  }>({
    loteNro: '',
    stockBolsas: 0,
    categoria: 'Original',
    estado: 'Disponible',
    tipo: 'Final',
  });
  const [isSavingInline, setIsSavingInline] = useState(false);
  const [inlineSaveError, setInlineSaveError] = useState<string | null>(null);
  const [inlineSaveSuccess, setInlineSaveSuccess] = useState<string | null>(null);

  // Estado para edición rápida de nombre de lote directamente en la celda de la tabla
  const [inlineEditingNameId, setInlineEditingNameId] = useState<string | null>(null);
  const [inlineEditingNameVal, setInlineEditingNameVal] = useState<string>('');
  const [isSavingInlineName, setIsSavingInlineName] = useState<boolean>(false);

  // Estado para expandir vista de tabla
  const [isTableExpanded, setIsTableExpanded] = useState<boolean>(true);

  // Estado para modal rápido de edición en la misma vista (tarjetas o ventana directa)
  const [quickEditModalLote, setQuickEditModalLote] = useState<Lote | null>(null);

  const handleStartEditLoteName = (l: Lote) => {
    setInlineEditingNameId(l.id);
    setInlineEditingNameVal(l.loteNro || l.id);
  };

  const handleSaveLoteNameDirect = async (l: Lote) => {
    const trimmed = inlineEditingNameVal.trim();
    if (!trimmed) {
      alert('El nombre del lote no puede estar vacío.');
      return;
    }
    if (trimmed === (l.loteNro || l.id)) {
      setInlineEditingNameId(null);
      return;
    }

    setIsSavingInlineName(true);
    try {
      const auditEntry: AuditLogEntry = {
        id: `AUD-EDIT-NAME-${Date.now()}`,
        fechaHora: new Date().toISOString(),
        tipo: 'Edición',
        usuario: currentUser.nombre,
        descripcion: `Nombre de lote modificado en tabla: "${l.loteNro || l.id}" ➔ "${trimmed}".`,
        detalles: `Editado directamente en celda de tabla por ${currentUser.nombre}.`
      };

      const updatedLote: Lote = {
        ...l,
        loteNro: trimmed,
        auditoria: [auditEntry, ...(l.auditoria || [])]
      };

      if (onSaveLote) {
        await onSaveLote(updatedLote);
      } else if (onBatchUpdateLotes) {
        await onBatchUpdateLotes([updatedLote]);
      }

      setInlineEditingNameId(null);
      setInlineSaveSuccess(`Nombre de lote actualizado a "${trimmed}".`);
      setTimeout(() => setInlineSaveSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error guardando nombre de lote:', err);
      alert('Error al actualizar el nombre del lote');
    } finally {
      setIsSavingInlineName(false);
    }
  };

  const handleStartInlineEdit = (l: Lote) => {
    setInlineEditingLoteId(l.id);
    setInlineEditData({
      loteNro: l.loteNro || l.id,
      stockBolsas: l.stockBolsas ?? 0,
      categoria: l.categoria || 'Original',
      estado: l.estado || 'Disponible',
      tipo: l.tipo || 'Final',
      estadoRegistro: l.estadoRegistro || 'REALIZADO',
    });
    setInlineSaveError(null);
    setInlineSaveSuccess(null);
  };

  const handleOpenQuickEditModal = (l: Lote) => {
    setQuickEditModalLote(l);
    setInlineEditData({
      loteNro: l.loteNro || l.id,
      stockBolsas: l.stockBolsas ?? 0,
      categoria: l.categoria || 'Original',
      estado: l.estado || 'Disponible',
      tipo: l.tipo || 'Final',
      estadoRegistro: l.estadoRegistro || 'REALIZADO',
    });
    setInlineSaveError(null);
  };

  const handleSaveInlineEdit = async (originalLote: Lote) => {
    if (!inlineEditData.loteNro.trim()) {
      setInlineSaveError('El nombre / N° de lote no puede estar vacío.');
      return;
    }
    if (inlineEditData.stockBolsas < 0) {
      setInlineSaveError('La cantidad de bolsas no puede ser negativa.');
      return;
    }

    setIsSavingInline(true);
    setInlineSaveError(null);

    try {
      const kgPorBolsa = originalLote.kgPorBolsa || 40;
      const nuevoStockKg = inlineEditData.stockBolsas * kgPorBolsa;

      let nuevoEstado = inlineEditData.estado;
      if (inlineEditData.stockBolsas === 0 && nuevoEstado === 'Disponible') {
        nuevoEstado = 'Agotado';
      } else if (inlineEditData.stockBolsas > 0 && nuevoEstado === 'Agotado') {
        nuevoEstado = 'Disponible';
      }

      const cambios: string[] = [];
      if (inlineEditData.loteNro.trim() !== originalLote.loteNro) {
        cambios.push(`Nombre de Lote: "${originalLote.loteNro}" ➔ "${inlineEditData.loteNro.trim()}"`);
      }
      if (inlineEditData.stockBolsas !== originalLote.stockBolsas) {
        cambios.push(`Bolsas dadas de alta: ${originalLote.stockBolsas} ➔ ${inlineEditData.stockBolsas} (${nuevoStockKg.toLocaleString('es-AR')} kg)`);
      }
      if (nuevoEstado !== originalLote.estado) {
        cambios.push(`Estado de Lote: "${originalLote.estado}" ➔ "${nuevoEstado}"`);
      }
      if (inlineEditData.tipo !== originalLote.tipo) {
        cambios.push(`Tipo: "${originalLote.tipo}" ➔ "${inlineEditData.tipo}"`);
      }
      if (inlineEditData.categoria !== (originalLote.categoria || 'Original')) {
        cambios.push(`Categoría: "${originalLote.categoria || 'Original'}" ➔ "${inlineEditData.categoria}"`);
      }

      const auditEntry: AuditLogEntry = {
        id: `AUD-EDIT-TABLA-${Date.now()}`,
        fechaHora: new Date().toISOString(),
        tipo: 'Edición',
        usuario: currentUser.nombre,
        descripcion: `Edición directa en vista de tabla: ${cambios.length > 0 ? cambios.join(' | ') : 'Sin cambios'}.`,
        detalles: `Editado desde tabla por ${currentUser.nombre}.`
      };

      // Si cambió la cantidad de bolsas de alta, actualizar o insertar movimiento inicial de alta en el historial
      let nuevoHistorial = [...(originalLote.historial || [])];
      if (inlineEditData.stockBolsas !== originalLote.stockBolsas) {
        const movAltaIdx = nuevoHistorial.findIndex(m => m.id.startsWith('MOV-ALTA') || m.tipo.includes('Entrada') || m.tipo === 'Entrada manual');
        if (movAltaIdx >= 0) {
          nuevoHistorial[movAltaIdx] = {
            ...nuevoHistorial[movAltaIdx],
            cantidadBolsas: inlineEditData.stockBolsas,
            cantidadKg: nuevoStockKg,
            detalle: `Alta actualizada desde edición de tabla: ${inlineEditData.stockBolsas} bolsas.`
          };
        } else {
          nuevoHistorial.unshift({
            id: `MOV-ALTA-${originalLote.id}`,
            fecha: originalLote.fechaIngreso || new Date().toISOString().split('T')[0],
            tipo: 'Entrada manual',
            cantidadBolsas: inlineEditData.stockBolsas,
            kgPorBolsa: kgPorBolsa,
            cantidadKg: nuevoStockKg,
            detalle: `Alta registrada desde edición de tabla: ${inlineEditData.stockBolsas} bolsas.`
          });
        }
      }

      const updatedLote: Lote = {
        ...originalLote,
        loteNro: inlineEditData.loteNro.trim(),
        tipo: inlineEditData.tipo,
        categoria: (inlineEditData.categoria as CategoriaType) || originalLote.categoria,
        stockBolsas: inlineEditData.stockBolsas,
        stockKg: nuevoStockKg,
        estado: nuevoEstado,
        estadoRegistro: inlineEditData.estadoRegistro || originalLote.estadoRegistro,
        historial: nuevoHistorial,
        auditoria: [auditEntry, ...(originalLote.auditoria || [])]
      };

      if (onSaveLote) {
        await onSaveLote(updatedLote);
      } else if (onBatchUpdateLotes) {
        await onBatchUpdateLotes([updatedLote]);
      }

      setInlineEditingLoteId(null);
      setQuickEditModalLote(null);
      setInlineSaveSuccess(`Lote ${updatedLote.loteNro} actualizado exitosamente.`);
      setTimeout(() => setInlineSaveSuccess(null), 4000);
    } catch (err: any) {
      console.error('Error guardando edición rápida de lote:', err);
      setInlineSaveError(err?.message || 'Error al guardar los datos del lote');
    } finally {
      setIsSavingInline(false);
    }
  };

  // Estados de Paginación de la Tabla de Lotes
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Reset de página al cambiar filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterClientes, filterEspecies, filterVariedades, filterTipos, filterCategorias, filterTratamientos, filterEstados, filterAlas, filterSectores]);

  // Guardar en localStorage cuando se fija o cuando cambian los filtros/orden estando fijados
  useEffect(() => {
    if (isFilterPinned) {
      const stateToSave = {
        isPinned: true,
        search,
        filterClientes,
        filterEspecies,
        filterVariedades,
        filterTipos,
        filterCategorias,
        filterTratamientos,
        filterEstados,
        filterEstadoRegistro,
        filterAlas,
        filterSectores,
        sortField,
        sortOrder,
      };
      localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(stateToSave));
    } else {
      localStorage.removeItem(PIN_STORAGE_KEY);
    }
  }, [
    isFilterPinned,
    search,
    filterClientes,
    filterEspecies,
    filterVariedades,
    filterTipos,
    filterCategorias,
    filterTratamientos,
    filterEstados,
    filterEstadoRegistro,
    filterAlas,
    filterSectores,
    sortField,
    sortOrder,
  ]);

  const handleTogglePinFilter = () => {
    setIsFilterPinned(prev => !prev);
  };

  const handleClearAllFilters = () => {
    setSearch('');
    setFilterClientes([]);
    setFilterEspecies([]);
    setFilterVariedades([]);
    setFilterTipos([]);
    setFilterCategorias([]);
    setFilterTratamientos([]);
    setFilterEstados([]);
    setFilterEstadoRegistro('TODOS');
    setFilterAlas([]);
    setFilterSectores([]);
  };

  const activeFiltersCount =
    (search ? 1 : 0) +
    filterClientes.length +
    filterEspecies.length +
    filterVariedades.length +
    filterTipos.length +
    filterCategorias.length +
    filterTratamientos.length +
    filterEstados.length +
    filterAlas.length +
    filterSectores.length;

  const hasActiveFilters = activeFiltersCount > 0;

  // Helper para alternar selección individual
  const toggleSelectLote = (id: string) => {
    setSelectedLoteIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Helper para eliminación masiva
  const handleBulkDelete = () => {
    if (selectedLoteIds.length === 0) return;
    if (window.confirm(`¿Seguro que desea eliminar los ${selectedLoteIds.length} lotes seleccionados? Esta operación es irreversible.`)) {
      onDeleteMultipleLotes(selectedLoteIds);
      setSelectedLoteIds([]);
    }
  };

  // Normalizar para chequear si es Amilcar Quiroz (con/sin acentos)
  const isAmilcar = currentUser?.nombre?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes("amilcar quiroz");

  // Subconjunto de lotes filtrados por Estado de Registro (REALIZADO / PRE-CARGA) y Cliente para filtros en cascada
  const lotesContextoCliente = useMemo(() => {
    return lotes.filter(l => {
      // Filtro por Estado de Registro
      if (filterEstadoRegistro === 'REALIZADO' && l.estadoRegistro === 'PRE-CARGA') return false;
      if (filterEstadoRegistro === 'PRE-CARGA' && l.estadoRegistro !== 'PRE-CARGA') return false;

      // Filtro por Cliente seleccionado (si hay selección)
      if (filterClientes.length > 0) {
        const rawCliente = l.cliente || '';
        const mappedCliente = normalizeCliente(rawCliente);
        const matchCliente = filterClientes.some(fc => {
          const normFc = normalizeCliente(fc);
          return normFc === mappedCliente || fc.trim().toLowerCase() === rawCliente.trim().toLowerCase();
        });
        if (!matchCliente) return false;
      }
      return true;
    });
  }, [lotes, filterEstadoRegistro, filterClientes]);

  // Opciones disponibles para cada filtro en cascada
  const clientesDisponibles = useMemo(() => {
    const base = (plantaConfig?.clientes && plantaConfig.clientes.length > 0)
      ? plantaConfig.clientes
      : (clientes && clientes.length > 0 ? clientes : ['San Diego Semillas', 'Eco Rural', 'Pampa', 'Stine', 'Elementa Foods']);
    const normalizedBase = base.map(c => normalizeCliente(c)).filter(Boolean);
    const fromLotes = lotes.map(l => normalizeCliente(l.cliente)).filter(Boolean);
    return Array.from(new Set([...normalizedBase, ...fromLotes]))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [lotes, plantaConfig, clientes]);

  const especiesDisponibles = useMemo(() => {
    const fromContext = lotesContextoCliente.map(l => l.especie).filter(Boolean) as string[];
    if (fromContext.length > 0) {
      return Array.from(new Set(fromContext)).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    }
    const base = plantaConfig?.especies || especies || ['Soja', 'Trigo', 'Arveja', 'Cebada', 'Maíz', 'Girasol'];
    const fromLotes = lotes.map(l => l.especie).filter(Boolean) as string[];
    return Array.from(new Set([...base, ...fromLotes])).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [lotesContextoCliente, lotes, plantaConfig, especies]);

  const variedadesDisponibles = useMemo(() => {
    if (filterClientes.length > 0) {
      const fromContext = lotesContextoCliente.map(l => l.variedad).filter(Boolean) as string[];
      const dbList = plantaConfig?.variedadesDb || [];
      const fromDb = dbList.filter(v => {
        const normVCli = normalizeCliente(v.cliente);
        return filterClientes.some(fc => {
          const normFc = normalizeCliente(fc);
          return normFc === normVCli || fc.trim().toLowerCase() === (v.cliente || '').trim().toLowerCase();
        });
      }).map(v => v.nombre).filter(Boolean);

      const combined = Array.from(new Set([...fromContext, ...fromDb]));
      return combined.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    }
    const base = plantaConfig?.variedades || [];
    const fromLotes = lotes.map(l => l.variedad).filter(Boolean) as string[];
    return Array.from(new Set([...base, ...fromLotes])).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [filterClientes, lotesContextoCliente, lotes, plantaConfig]);

  // Al cambiar cliente o especie, depurar variedades seleccionadas que ya no correspondan a las opciones disponibles
  useEffect(() => {
    if (filterVariedades.length > 0) {
      setFilterVariedades(prev => {
        const valid = prev.filter(v => variedadesDisponibles.includes(v));
        return valid.length === prev.length ? prev : valid;
      });
    }
  }, [filterClientes, filterEspecies, variedadesDisponibles]);

  const tiposDisponibles = useMemo(() => {
    const fromContext = lotesContextoCliente.map(l => l.tipo).filter(Boolean) as string[];
    if (fromContext.length > 0) {
      return Array.from(new Set(fromContext)).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    }
    const base = plantaConfig?.tipos || ['Intermedio', 'Final', 'Procesado', 'Semilla', 'Descarte'];
    const fromLotes = lotes.map(l => l.tipo).filter(Boolean) as string[];
    return Array.from(new Set([...base, ...fromLotes])).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [lotesContextoCliente, lotes, plantaConfig]);

  const categoriasDisponibles = useMemo(() => {
    const fromContext = lotesContextoCliente
      .map(l => l.categoria)
      .filter((c): c is string => Boolean(c) && !c.toLowerCase().includes('primera multiplicaci'));
    if (fromContext.length > 0) {
      return Array.from(new Set(fromContext)).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    }
    const base = (plantaConfig?.categorias || ['Fundadora', 'PreBase', 'Original', 'Primu'])
      .filter(c => !c.toLowerCase().includes('primera multiplicaci'));
    const fromLotes = lotes
      .map(l => l.categoria)
      .filter((c): c is string => Boolean(c) && !c.toLowerCase().includes('primera multiplicaci'));
    return Array.from(new Set([...base, ...fromLotes])).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [lotesContextoCliente, lotes, plantaConfig]);

  const categoriasParaEditor = useMemo(() => {
    const oficiales = Array.from(CATEGORIAS_OFICIALES || []).filter(c => !c.toLowerCase().includes('primera multiplicaci'));
    return Array.from(new Set([...oficiales, ...categoriasDisponibles, 'Original', 'Fundadora', 'PreBase', 'Primu', 'Segunda Multiplicación', 'Certificada', 'Identificada', 'Comercial']))
      .filter(c => !c.toLowerCase().includes('primera multiplicaci'));
  }, [categoriasDisponibles]);

  const tratamientosDisponibles = useMemo(() => {
    const base = plantaConfig?.tratamientos || ['Sin Tratar', 'Tratado'];
    const fromLotes: string[] = [];
    lotesContextoCliente.forEach(l => {
      if (Array.isArray(l.tratamiento)) {
        l.tratamiento.forEach(t => { if (t) fromLotes.push(t); });
      } else if (l.tratamiento) {
        fromLotes.push(l.tratamiento as any);
      }
    });
    return Array.from(new Set([...base, ...fromLotes])).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [lotesContextoCliente, plantaConfig]);

  const estadosDisponibles = useMemo(() => ['Disponible', 'Reservado', 'A Consumo', 'Agotado'], []);

  // Lógica de Filtrado Múltiple
  const filteredLotes = useMemo(() => {
    return lotes.filter(l => {
      // 0. Filtro Estado de Registro (Todos / Realizado / Precarga)
      if (filterEstadoRegistro === 'REALIZADO' && l.estadoRegistro === 'PRE-CARGA') {
        return false;
      }
      if (filterEstadoRegistro === 'PRE-CARGA' && l.estadoRegistro !== 'PRE-CARGA') {
        return false;
      }

      // 1. Buscador de Texto
      const searchLower = search.trim().toLowerCase();
      const matchSearch =
        !searchLower ||
        (l.cliente || '').toLowerCase().includes(searchLower) ||
        (l.loteNro || '').toLowerCase().includes(searchLower) ||
        (l.id || '').toLowerCase().includes(searchLower) ||
        (l.especie || '').toLowerCase().includes(searchLower) ||
        (l.variedad || '').toLowerCase().includes(searchLower) ||
        (l.producto || '').toLowerCase().includes(searchLower) ||
        (l.categoria || '').toLowerCase().includes(searchLower);

      if (!matchSearch) return false;

      // 2. Cliente (Selección Múltiple)
      const rawCliente = l.cliente || '';
      const mappedCliente = normalizeCliente(rawCliente);
      if (filterClientes.length > 0) {
        const matchCliente = filterClientes.some(fc => {
          const normFc = normalizeCliente(fc);
          return normFc === mappedCliente || fc.trim().toLowerCase() === rawCliente.trim().toLowerCase();
        });
        if (!matchCliente) {
          return false;
        }
      }

      // 3. Especie (Selección Múltiple)
      const esp = l.especie || 'Sin especificar';
      if (filterEspecies.length > 0 && !filterEspecies.includes(esp)) {
        return false;
      }

      // 3.5. Variedad (Selección Múltiple)
      const varName = l.variedad || 'Sin especificar';
      if (filterVariedades.length > 0 && !filterVariedades.includes(varName)) {
        return false;
      }

      // 4. Tipo de Lote (Selección Múltiple)
      if (filterTipos.length > 0 && !filterTipos.includes(l.tipo)) {
        return false;
      }

      // 5. Categoría (Selección Múltiple)
      const cat = l.categoria || 'PRIMU';
      if (filterCategorias.length > 0 && !filterCategorias.includes(cat)) {
        return false;
      }

      // 6. Tratamiento (Selección Múltiple: Tratado / Sin Tratar)
      if (filterTratamientos.length > 0) {
        const trats = Array.isArray(l.tratamiento) ? l.tratamiento : [l.tratamiento];
        const isTratado = trats.some(t => String(t).toLowerCase() === 'tratado' || (t && t !== 'Sin Tratar' && t !== 'Sin Tratamiento')) ||
                          Boolean(l.producto && !['Ninguno', 'Sin Tratamiento', 'FINAL', 'INTERMEDIO', ''].includes(l.producto));
        const isSinTratar = !isTratado;

        const matchesTratado = filterTratamientos.includes('Tratado') && isTratado;
        const matchesSinTratar = filterTratamientos.includes('Sin Tratar') && isSinTratar;
        const matchesLegacy = l.tratamiento && l.tratamiento.some(t => filterTratamientos.includes(t));

        if (!matchesTratado && !matchesSinTratar && !matchesLegacy) {
          return false;
        }
      }

      // 7. Estado / Disponibilidad (Selección Múltiple)
      // Por defecto no mostrar lotes "agotados" en las listas a menos que se seleccione el estado "agotado" en filtros
      if (filterEstados.length > 0) {
        if (!filterEstados.includes(l.estado)) {
          return false;
        }
      } else {
        if (l.estado === 'Agotado') {
          return false;
        }
      }

      return true;
    });
  }, [lotes, filterEstadoRegistro, search, filterClientes, filterEspecies, filterVariedades, filterTipos, filterCategorias, filterTratamientos, filterEstados]);

  // Lotes filtrados y ordenados según columna seleccionada
  const sortedFilteredLotes = useMemo(() => {
    return [...filteredLotes].sort((a, b) => {
      let aVal: any = '';
      let bVal: any = '';

      switch (sortField) {
        case 'fechaAlta':
          aVal = a.fechaIngreso || a.fechaAlta || (a.fechaHoraProduccion ? a.fechaHoraProduccion.split('T')[0] : '') || '';
          bVal = b.fechaIngreso || b.fechaAlta || (b.fechaHoraProduccion ? b.fechaHoraProduccion.split('T')[0] : '') || '';
          break;
        case 'cliente':
          aVal = (a.cliente || '').toLowerCase();
          bVal = (b.cliente || '').toLowerCase();
          break;
        case 'especie':
          aVal = (a.especie || '').toLowerCase();
          bVal = (b.especie || '').toLowerCase();
          break;
        case 'variedad':
          aVal = (a.variedad || '').toLowerCase();
          bVal = (b.variedad || '').toLowerCase();
          break;
        case 'loteId':
          aVal = (a.loteNro || a.id || '').toLowerCase();
          bVal = (b.loteNro || b.id || '').toLowerCase();
          break;
        case 'tipo':
          aVal = (a.tipo || '').toLowerCase();
          bVal = (b.tipo || '').toLowerCase();
          break;
        case 'tratamiento':
          aVal = isLoteTratado(a) ? 'tratado' : 'sin tratar';
          bVal = isLoteTratado(b) ? 'tratado' : 'sin tratar';
          break;
        case 'categoria':
          aVal = (a.categoria || '').toLowerCase();
          bVal = (b.categoria || '').toLowerCase();
          break;
        case 'envase':
          aVal = a.envase || (a.kgPorBolsa ? `${a.kgPorBolsa}` : '40');
          bVal = b.envase || (b.kgPorBolsa ? `${b.kgPorBolsa}` : '40');
          break;
        case 'bolsas':
          aVal = Number(a.stockBolsas) || 0;
          bVal = Number(b.stockBolsas) || 0;
          break;
        case 'stockKg':
          aVal = Number(a.stockKg) || 0;
          bVal = Number(b.stockKg) || 0;
          break;
        case 'estado':
          aVal = (a.estado || '').toLowerCase();
          bVal = (b.estado || '').toLowerCase();
          break;
        default:
          return 0;
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const cmp = String(aVal).localeCompare(String(bVal), 'es', { numeric: true, sensitivity: 'base' });
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [filteredLotes, sortField, sortOrder]);

  // Lotes paginados según página y tamaño seleccionados
  const paginatedLotes = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedFilteredLotes.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedFilteredLotes, currentPage, itemsPerPage]);

  // Lotes filtrados con todos los criterios excepto filterTipos (para los conteos dinámicos del filtro de tipo en tabla)
  const lotesParaConteoTipos = useMemo(() => {
    return lotes.filter((l) => {
      if (filterEstadoRegistro !== 'TODOS' && (l.estadoRegistro || 'REALIZADO') !== filterEstadoRegistro) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchLote = (l.loteNro || l.id).toLowerCase().includes(q);
        const matchCliente = (l.cliente || '').toLowerCase().includes(q);
        const matchVariedad = (l.variedad || '').toLowerCase().includes(q);
        const matchEspecie = (l.especie || '').toLowerCase().includes(q);
        if (!matchLote && !matchCliente && !matchVariedad && !matchEspecie) {
          return false;
        }
      }
      if (filterClientes.length > 0) {
        const normLoteCl = normalizeCliente(l.cliente);
        const matchesAny = filterClientes.some(cl => {
          return normalizeCliente(cl) === normLoteCl || (l.cliente || '').trim().toLowerCase() === cl.trim().toLowerCase();
        });
        if (!matchesAny) return false;
      }
      if (filterEspecies.length > 0) {
        const esp = l.especie || 'Sin especificar';
        if (!filterEspecies.includes(esp)) return false;
      }
      const varName = l.variedad || 'Sin especificar';
      if (filterVariedades.length > 0 && !filterVariedades.includes(varName)) {
        return false;
      }
      const cat = l.categoria || 'PRIMU';
      if (filterCategorias.length > 0 && !filterCategorias.includes(cat)) {
        return false;
      }
      if (filterTratamientos.length > 0) {
        const trats = Array.isArray(l.tratamiento) ? l.tratamiento : [l.tratamiento];
        const isTratado = trats.some(t => String(t).toLowerCase() === 'tratado' || (t && t !== 'Sin Tratar' && t !== 'Sin Tratamiento')) ||
                          Boolean(l.producto && !['Ninguno', 'Sin Tratamiento', 'FINAL', 'INTERMEDIO', ''].includes(l.producto));
        const isSinTratar = !isTratado;
        const matchesTratado = filterTratamientos.includes('Tratado') && isTratado;
        const matchesSinTratar = filterTratamientos.includes('Sin Tratar') && isSinTratar;
        const matchesLegacy = l.tratamiento && l.tratamiento.some(t => filterTratamientos.includes(t));
        if (!matchesTratado && !matchesSinTratar && !matchesLegacy) {
          return false;
        }
      }
      if (filterEstados.length > 0) {
        if (!filterEstados.includes(l.estado)) return false;
      } else {
        if (l.estado === 'Agotado') return false;
      }
      return true;
    });
  }, [lotes, filterEstadoRegistro, search, filterClientes, filterEspecies, filterVariedades, filterCategorias, filterTratamientos, filterEstados]);

  // Lotes para conteo de opciones de Tratamiento (excluye únicamente filterTratamientos)
  const lotesParaConteoTratamientos = useMemo(() => {
    return lotes.filter((l) => {
      if (filterEstadoRegistro !== 'TODOS') {
        const reg = l.estadoRegistro || 'REALIZADO';
        if (reg !== filterEstadoRegistro) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchLote = (l.loteNro || l.id).toLowerCase().includes(q);
        const matchCliente = (l.cliente || '').toLowerCase().includes(q);
        const matchVariedad = (l.variedad || '').toLowerCase().includes(q);
        const matchEspecie = (l.especie || '').toLowerCase().includes(q);
        if (!matchLote && !matchCliente && !matchVariedad && !matchEspecie) {
          return false;
        }
      }
      if (filterClientes.length > 0) {
        const normLoteCl = normalizeCliente(l.cliente);
        const matchesAny = filterClientes.some(cl => {
          return normalizeCliente(cl) === normLoteCl || (l.cliente || '').trim().toLowerCase() === cl.trim().toLowerCase();
        });
        if (!matchesAny) return false;
      }
      if (filterEspecies.length > 0) {
        const esp = l.especie || 'Sin especificar';
        if (!filterEspecies.includes(esp)) return false;
      }
      const varName = l.variedad || 'Sin especificar';
      if (filterVariedades.length > 0 && !filterVariedades.includes(varName)) {
        return false;
      }
      if (filterTipos.length > 0 && !filterTipos.includes(l.tipo)) {
        return false;
      }
      const cat = l.categoria || 'PRIMU';
      if (filterCategorias.length > 0 && !filterCategorias.includes(cat)) {
        return false;
      }
      if (filterEstados.length > 0) {
        if (!filterEstados.includes(l.estado)) return false;
      } else {
        if (l.estado === 'Agotado') return false;
      }
      return true;
    });
  }, [lotes, filterEstadoRegistro, search, filterClientes, filterEspecies, filterVariedades, filterTipos, filterCategorias, filterEstados]);

  const isLoteMatchingTratamiento = (l: Lote, trat: string) => {
    const trats = Array.isArray(l.tratamiento) ? l.tratamiento : [l.tratamiento];
    const isTratado = trats.some(t => String(t).toLowerCase() === 'tratado' || (t && t !== 'Sin Tratar' && t !== 'Sin Tratamiento')) ||
                      Boolean(l.producto && !['Ninguno', 'Sin Tratamiento', 'FINAL', 'INTERMEDIO', ''].includes(l.producto)) ||
                      Boolean(l.productoAplicado && l.productoAplicado.trim() !== '');
    if (trat.toLowerCase() === 'tratado') return isTratado;
    if (trat.toLowerCase() === 'sin tratar' || trat.toLowerCase() === 'sin tratamiento') return !isTratado;
    return trats.some(t => String(t).toLowerCase() === trat.toLowerCase());
  };

  const formatBolsasLabel = (count: number) => {
    const formatted = formatNumberArg(count);
    return count === 1 ? `${formatted} bolsa` : `${formatted} bolsas`;
  };

  const getTipoBadgeStyle = (tipo?: string) => {
    const t = (tipo || '').toLowerCase().trim();
    if (t.includes('final') || t.includes('terminado')) {
      return 'bg-emerald-100 text-emerald-950 border-emerald-400/80 ring-1 ring-emerald-400/30';
    }
    if (t.includes('intermedio')) {
      return 'bg-sky-100 text-sky-950 border-sky-400/80 ring-1 ring-sky-400/30';
    }
    if (t.includes('semilla')) {
      return 'bg-purple-100 text-purple-950 border-purple-400/80 ring-1 ring-purple-400/30';
    }
    if (t.includes('procesado')) {
      return 'bg-indigo-100 text-indigo-950 border-indigo-400/80 ring-1 ring-indigo-400/30';
    }
    if (t.includes('descarte') || t.includes('rechazo')) {
      return 'bg-rose-100 text-rose-950 border-rose-400/80 ring-1 ring-rose-400/30';
    }
    if (t.includes('bajo consumo') || t.includes('mezcla')) {
      return 'bg-amber-100 text-amber-950 border-amber-400/80 ring-1 ring-amber-400/30';
    }
    return 'bg-slate-100 text-slate-800 border-slate-300';
  };

  const getEstadoBadgeStyle = (estado: EstadoLoteType) => {
    switch (estado) {
      case 'Disponible':
        return 'bg-[#E3EFE7] text-[#00603C] border-[#00603C]';
      case 'Reservado':
        return 'bg-[#F6EFDC] text-[#C9922E] border-[#C9922E]';
      case 'A Consumo':
        return 'bg-purple-100 text-purple-900 border-purple-400';
      case 'Agotado':
        return 'bg-[#A0522D]/10 text-[#A0522D] border-[#A0522D]';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  // Exportar a Excel (.xlsx) con ORDEN ESTRICTO de 17 columnas
  const handleExportExcel = () => {
    // Exportar únicamente los lotes con estado "REALIZADO" (excluir "PRE-CARGA")
    const lotesRealizados = filteredLotes.filter(
      l => (l.estadoRegistro || 'REALIZADO') === 'REALIZADO' && l.estadoRegistro !== 'PRE-CARGA'
    );

    if (lotesRealizados.length === 0) {
      alert('No hay lotes con estado "Realizado" para exportar con los filtros seleccionados.');
      return;
    }

    const dataToExport = lotesRealizados.map(l => {
      let cliente = normalizeCliente(l.cliente) || 'Sin cliente';

      // Fecha de realizado: fechaHoraProduccion o fechaIngreso
      let fechaRealizadoStr = '—';
      if (l.fechaHoraProduccion) {
        if (l.fechaHoraProduccion.includes('T')) {
          const [d, t] = l.fechaHoraProduccion.split('T');
          fechaRealizadoStr = `${formatDateStr(d)} ${t}`;
        } else {
          fechaRealizadoStr = formatDateStr(l.fechaHoraProduccion);
        }
      } else if (l.fechaIngreso) {
        fechaRealizadoStr = formatDateStr(l.fechaIngreso);
      }

      const tratamientoStr = (l.tratamiento && l.tratamiento.length > 0)
        ? l.tratamiento.join(', ')
        : 'Sin tratar';

      const ubicacionStr = (l.ala && l.sector)
        ? `ALA ${l.ala} · SECTOR ${l.sector}`
        : l.ala
        ? `ALA ${l.ala}`
        : l.sector
        ? `SECTOR ${l.sector}`
        : 'Sin asignar';

      const siloOrigenStr = l.siloOrigen
        ? String(l.siloOrigen)
        : l.silosOrigen && l.silosOrigen.length > 0
        ? l.silosOrigen.map(s => s.siloId).join(', ')
        : 'Sin dato';

      const targetSilos = new Set<string>();
      if (l.siloOrigen) targetSilos.add(String(l.siloOrigen));
      if (l.silosOrigen) l.silosOrigen.forEach(s => targetSilos.add(s.siloId));

      const ingresoPrevioSilo = movimientosSilo
        ?.filter(m => m.tipo === 'INGRESO' && targetSilos.has(m.siloId) && m.bolsonOrigenNro)
        .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))[0];

      let bolsonOrigenStr = 'Sin dato';
      let sectorBolsonOrigenStr = '—';

      if (l.origenesBolson && l.origenesBolson.length > 0) {
        const origenesValidos = l.origenesBolson.filter(o => o.bolsonNro && o.bolsonNro.trim() !== '');
        if (origenesValidos.length > 0) {
          bolsonOrigenStr = origenesValidos.map(o => o.bolsonNro!.trim()).join(', ');
          sectorBolsonOrigenStr = origenesValidos.map(o => (o.sector && o.sector.trim()) ? o.sector.trim() : '—').join(', ');
        }
      }

      if (bolsonOrigenStr === 'Sin dato') {
        bolsonOrigenStr =
          l.numeroBolsonOrigen ||
          l.bolsonOrigenNro ||
          ingresoPrevioSilo?.bolsonOrigenNro ||
          'Sin dato';
      }

      if (sectorBolsonOrigenStr === '—') {
        sectorBolsonOrigenStr =
          l.sectorBolsonOrigen ||
          ingresoPrevioSilo?.bolsonOrigenSector ||
          '—';
      }

      return {
        'Fecha de realizado': fechaRealizadoStr,
        'Cliente': cliente,
        'Especie': l.especie || 'Sin especificar',
        'Variedad': l.variedad || 'Sin variedad',
        'Número de lote': l.loteNro || l.id,
        'Bolsas realizadas': l.stockBolsas,
        'Kg por bolsa': l.kgPorBolsa,
        'Stock total': l.stockKg,
        'Tipo de lote': l.tipo || 'Final',
        'Categoría': l.categoria || 'PRIMU',
        'Tratamiento': tratamientoStr,
        'INASE incio': l.inaseInicio || '—',
        'INASE final': l.inaseFinal || '—',
        'N° de Bolsón de origen': bolsonOrigenStr,
        'Sector de bolsón de origen': sectorBolsonOrigenStr
      };
    });

    // Generar Hoja Resumen Consolidada por Cliente, Especie y Variedad para Cierre Mensual Gerencial
    interface ResumenGroup {
      cliente: string;
      especie: string;
      variedad: string;
      cantidadLotes: number;
      totalBolsas: number;
      totalKg: number;
    }

    const summaryMap = new Map<string, ResumenGroup>();
    let grandTotalBolsas = 0;
    let grandTotalKg = 0;

    lotesRealizados.forEach(l => {
      const cli = normalizeCliente(l.cliente) || 'Sin cliente';
      const esp = l.especie || 'Sin especificar';
      const varN = l.variedad || 'Sin variedad';
      const key = `${cli}___${esp}___${varN}`;

      const bolsas = Number(l.stockBolsas) || 0;
      const kg = Number(l.stockKg) || 0;

      grandTotalBolsas += bolsas;
      grandTotalKg += kg;

      const existing = summaryMap.get(key);
      if (existing) {
        existing.cantidadLotes += 1;
        existing.totalBolsas += bolsas;
        existing.totalKg += kg;
      } else {
        summaryMap.set(key, {
          cliente: cli,
          especie: esp,
          variedad: varN,
          cantidadLotes: 1,
          totalBolsas: bolsas,
          totalKg: kg
        });
      }
    });

    const summarySorted = Array.from(summaryMap.values()).sort((a, b) => {
      const cmpCli = a.cliente.localeCompare(b.cliente);
      if (cmpCli !== 0) return cmpCli;
      const cmpEsp = a.especie.localeCompare(b.especie);
      if (cmpEsp !== 0) return cmpEsp;
      return a.variedad.localeCompare(b.variedad);
    });

    const summaryRows = summarySorted.map(g => ({
      'Cliente': g.cliente,
      'Especie': g.especie,
      'Variedad': g.variedad,
      'Cantidad de Lotes': g.cantidadLotes,
      'Total Bolsas': g.totalBolsas,
      'Total Kilogramos (Kg)': g.totalKg,
      'Total Toneladas (Tn)': Number((g.totalKg / 1000).toFixed(2)),
      'Participación (% Kg)': grandTotalKg > 0 ? `${((g.totalKg / grandTotalKg) * 100).toFixed(1)}%` : '0.0%'
    }));

    // Fila consolidada de Total General
    summaryRows.push({
      'Cliente': 'TOTAL GENERAL',
      'Especie': '—',
      'Variedad': '—',
      'Cantidad de Lotes': lotesRealizados.length,
      'Total Bolsas': grandTotalBolsas,
      'Total Kilogramos (Kg)': grandTotalKg,
      'Total Toneladas (Tn)': Number((grandTotalKg / 1000).toFixed(2)),
      'Participación (% Kg)': '100.0%'
    });

    const summaryWorksheet = XLSX.utils.json_to_sheet(summaryRows);

    // Configurar anchos de columna para la hoja resumen
    const summaryKeys = Object.keys(summaryRows[0] || {});
    summaryWorksheet['!cols'] = summaryKeys.map(key => {
      const maxLen = Math.max(
        key.length,
        ...summaryRows.map(row => String((row as any)[key] ?? '').length)
      );
      return { wch: Math.min(Math.max(maxLen + 4, 15), 35) };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);

    // Configurar anchos de columna para lectura clara de detalle
    const keys = Object.keys(dataToExport[0] || {});
    const colWidths = keys.map(key => {
      const maxLen = Math.max(
        key.length,
        ...dataToExport.map(row => String((row as any)[key] ?? '').length)
      );
      return { wch: Math.min(Math.max(maxLen + 3, 12), 40) };
    });
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    // La hoja resumen va al inicio para consulta gerencial inmediata
    XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Resumen Cierre');
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Lotes Realizados');
    
    XLSX.writeFile(workbook, `Reporte_de_Produccion_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Exportar Reporte de Movimientos en formato Excel (2 Hojas: 1- Resumen Cierre, 2- Lotes Mov Realizados)
  const handleExportMovimientosExcel = () => {
    // Filtrar los movimientos realizados (aplicando los filtros de búsqueda si existen)
    const candidateSource = (activeDimensionCount > 0 || search.trim() !== '') ? filteredLotes : lotes;
    let targetMovRealizados = candidateSource.filter(l => {
      const isMov = l.esMovimiento || l.tipoMovimiento || l.loteOrigen || 
                    (l.loteNro && l.loteNro.toUpperCase().includes('MOV')) || 
                    (l.id && l.id.toUpperCase().includes('MOV')) ||
                    l.fechaRealizacionMovimiento ||
                    l.estadoMovimiento;
      const isRealizado = (l.estadoRegistro || 'REALIZADO') === 'REALIZADO' && l.estadoRegistro !== 'PRE-CARGA';
      return isMov && isRealizado;
    });

    // Si los filtros redujeron a 0, intentar con todos los movimientos realizados
    if (targetMovRealizados.length === 0) {
      targetMovRealizados = lotes.filter(l => {
        const isMov = l.esMovimiento || l.tipoMovimiento || l.loteOrigen || 
                      (l.loteNro && l.loteNro.toUpperCase().includes('MOV')) || 
                      (l.id && l.id.toUpperCase().includes('MOV')) ||
                      l.fechaRealizacionMovimiento ||
                      l.estadoMovimiento;
        const isRealizado = (l.estadoRegistro || 'REALIZADO') === 'REALIZADO' && l.estadoRegistro !== 'PRE-CARGA';
        return isMov && isRealizado;
      });
    }

    if (targetMovRealizados.length === 0) {
      alert('No se encontraron movimientos realizados a la fecha para exportar. Asegúrese de pasar los movimientos a REALIZADO con el botón MOV REALIZADO.');
      return;
    }

    // 1. HOJA 1 = RESUMEN CIERRE
    // Columnas: "CLIENTE" / "Especie" / "Variedad" / "Cantidad de Lotes" / "Total Bolsas" / "Total Kilogramos (Kg)" / "KG TRATADOS"
    const resumenMap = new Map<string, {
      cliente: string;
      especie: string;
      variedad: string;
      cantidadLotes: number;
      totalBolsas: number;
      totalKg: number;
      kgTratados: number;
    }>();

    targetMovRealizados.forEach(l => {
      const cl = l.cliente || 'Sin cliente';
      const esp = l.especie || 'Sin especie';
      const varName = l.variedad || 'Sin variedad';
      const key = `${cl}__${esp}__${varName}`;

      const bolsas = Number(l.stockBolsas) || 0;
      const kgBolsa = Number(l.kgPorBolsa) || 800;
      const kgTot = Number(l.stockKg) > 0 ? Number(l.stockKg) : (bolsas * kgBolsa);

      const trats = Array.isArray(l.tratamiento) ? l.tratamiento : [l.tratamiento];
      const isTratado = trats.some(t => String(t).toLowerCase() === 'tratado' || (t && t !== 'Sin Tratar' && t !== 'Sin Tratamiento')) ||
                        (l.tipoMovimiento || '').toLowerCase().includes('tratado') ||
                        Boolean(l.productoAplicado && l.productoAplicado.trim() !== '' && l.productoAplicado !== 'Sin Tratamiento') ||
                        Boolean(l.producto && !['Ninguno', 'Sin Tratamiento', 'FINAL', 'INTERMEDIO', ''].includes(l.producto));

      const current = resumenMap.get(key) || {
        cliente: cl,
        especie: esp,
        variedad: varName,
        cantidadLotes: 0,
        totalBolsas: 0,
        totalKg: 0,
        kgTratados: 0,
      };

      current.cantidadLotes += 1;
      current.totalBolsas += bolsas;
      current.totalKg += kgTot;
      if (isTratado) {
        current.kgTratados += kgTot;
      }

      resumenMap.set(key, current);
    });

    const resumenData = Array.from(resumenMap.values()).map(r => ({
      'Cliente': r.cliente,
      'Especie': r.especie,
      'Variedad': r.variedad,
      'Cantidad de Lotes': r.cantidadLotes,
      'Total Bolsas': r.totalBolsas,
      'Total Kilogramos (Kg)': r.totalKg,
      'KG TRATADOS': r.kgTratados,
    }));

    // Fila de Total General al final de la Hoja 1
    const totalGeneral = resumenData.reduce((acc, row) => ({
      lotes: acc.lotes + row['Cantidad de Lotes'],
      bolsas: acc.bolsas + row['Total Bolsas'],
      kg: acc.kg + row['Total Kilogramos (Kg)'],
      kgTratados: acc.kgTratados + row['KG TRATADOS'],
    }), { lotes: 0, bolsas: 0, kg: 0, kgTratados: 0 });

    resumenData.push({
      'Cliente': 'TOTAL GENERAL',
      'Especie': '—',
      'Variedad': '—',
      'Cantidad de Lotes': totalGeneral.lotes,
      'Total Bolsas': totalGeneral.bolsas,
      'Total Kilogramos (Kg)': totalGeneral.kg,
      'KG TRATADOS': totalGeneral.kgTratados,
    });

    // 2. HOJA 2 = LOTES MOV REALIZADOS
    // Columnas: "Fecha de MOV realizado" / "Cliente" / "Especie" / "Variedad" / "Número de lote" / "Bolsas realizadas" / "Kg por bolsa" / "Stock total" / "Tipo de lote" / "Categoría" / "Tratamiento" / "Producto Aplicado / Principio Activo"
    const lotesMovData = targetMovRealizados.map(l => {
      const fechaRealizadaStr = l.fechaRealizacionMovimiento || l.fechaMovimiento || l.fechaIngreso || l.fechaHoraProduccion?.split('T')[0] || '—';
      const bolsas = Number(l.stockBolsas) || 0;
      const kgBolsa = Number(l.kgPorBolsa) || 800;
      const stockTotal = Number(l.stockKg) > 0 ? Number(l.stockKg) : (bolsas * kgBolsa);

      let tratamientoStr = Array.isArray(l.tratamiento) ? l.tratamiento.join(', ') : (l.tratamiento || 'Original');
      if ((l.tipoMovimiento || '').toLowerCase().includes('tratado') && !tratamientoStr.toLowerCase().includes('tratado')) {
        tratamientoStr = 'Tratado';
      }

      const productoAplicado = l.productoAplicado || l.producto || '—';

      return {
        'Fecha de MOV realizado': fechaRealizadaStr,
        'Cliente': l.cliente || 'Sin cliente',
        'Especie': l.especie || 'Sin especie',
        'Variedad': l.variedad || 'Sin variedad',
        'Número de lote': l.loteNro || l.id,
        'Bolsas realizadas': bolsas,
        'Kg por bolsa': kgBolsa,
        'Stock total': stockTotal,
        'Tipo de lote': l.tipo || 'Final',
        'Categoría': l.categoria || 'PRIMU',
        'Tratamiento': tratamientoStr,
        'Producto Aplicado / Principio Activo': productoAplicado,
      };
    });

    const summaryWorksheet = XLSX.utils.json_to_sheet(resumenData);
    const summaryCols = Object.keys(resumenData[0] || {}).map(key => {
      const maxLen = Math.max(key.length, ...resumenData.map(r => String((r as any)[key] ?? '').length));
      return { wch: Math.min(Math.max(maxLen + 3, 14), 40) };
    });
    summaryWorksheet['!cols'] = summaryCols;

    const detailWorksheet = XLSX.utils.json_to_sheet(lotesMovData);
    const detailCols = Object.keys(lotesMovData[0] || {}).map(key => {
      const maxLen = Math.max(key.length, ...lotesMovData.map(r => String((r as any)[key] ?? '').length));
      return { wch: Math.min(Math.max(maxLen + 3, 15), 45) };
    });
    detailWorksheet['!cols'] = detailCols;

    const workbook = XLSX.utils.book_new();
    // Hoja 1 = Resumen Cierre, Hoja 2 = Lotes Mov Realizados
    XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Resumen Cierre');
    XLSX.utils.book_append_sheet(workbook, detailWorksheet, 'Lotes Mov Realizados');
    XLSX.writeFile(workbook, `Reporte_de_Movimientos_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Exportar CSV delimitado por punto y coma (;) respetando las columnas
  const handleExportCSV = () => {
    const lotesRealizados = filteredLotes.filter(
      l => (l.estadoRegistro || 'REALIZADO') === 'REALIZADO' && l.estadoRegistro !== 'PRE-CARGA'
    );

    if (lotesRealizados.length === 0) {
      alert('No hay lotes con estado "Realizado" para exportar con los filtros seleccionados.');
      return;
    }

    const headers = [
      'Fecha de realizado',
      'Cliente',
      'Especie',
      'Variedad',
      'Número de lote',
      'Bolsas realizadas',
      'Kg por bolsa',
      'Stock total',
      'Tipo de lote',
      'Categoría',
      'Tratamiento',
      'INASE incio',
      'INASE final',
      'N° de Bolsón de origen',
      'Sector de bolsón de origen'
    ];

    const rows = lotesRealizados.map(l => {
      let cliente = normalizeCliente(l.cliente) || 'Sin cliente';

      let fechaRealizadoStr = '—';
      if (l.fechaHoraProduccion) {
        if (l.fechaHoraProduccion.includes('T')) {
          const [d, t] = l.fechaHoraProduccion.split('T');
          fechaRealizadoStr = `${formatDateStr(d)} ${t}`;
        } else {
          fechaRealizadoStr = formatDateStr(l.fechaHoraProduccion);
        }
      } else if (l.fechaIngreso) {
        fechaRealizadoStr = formatDateStr(l.fechaIngreso);
      }

      const tratamientoStr = (l.tratamiento && l.tratamiento.length > 0)
        ? l.tratamiento.join(', ')
        : 'Sin tratar';

      const siloOrigenStr = l.siloOrigen
        ? String(l.siloOrigen)
        : l.silosOrigen && l.silosOrigen.length > 0
        ? l.silosOrigen.map(s => s.siloId).join(', ')
        : 'Sin dato';

      const targetSilosCsv = new Set<string>();
      if (l.siloOrigen) targetSilosCsv.add(String(l.siloOrigen));
      if (l.silosOrigen) l.silosOrigen.forEach(s => targetSilosCsv.add(s.siloId));

      const ingresoPrevioSiloCsv = movimientosSilo
        ?.filter(m => m.tipo === 'INGRESO' && targetSilosCsv.has(m.siloId) && m.bolsonOrigenNro)
        .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))[0];

      let bolsonOrigenStr = 'Sin dato';
      let sectorBolsonOrigenStr = '—';

      if (l.origenesBolson && l.origenesBolson.length > 0) {
        const origenesValidos = l.origenesBolson.filter(o => o.bolsonNro && o.bolsonNro.trim() !== '');
        if (origenesValidos.length > 0) {
          bolsonOrigenStr = origenesValidos.map(o => o.bolsonNro!.trim()).join(', ');
          sectorBolsonOrigenStr = origenesValidos.map(o => (o.sector && o.sector.trim()) ? o.sector.trim() : '—').join(', ');
        }
      }

      if (bolsonOrigenStr === 'Sin dato') {
        bolsonOrigenStr =
          l.numeroBolsonOrigen ||
          l.bolsonOrigenNro ||
          ingresoPrevioSiloCsv?.bolsonOrigenNro ||
          'Sin dato';
      }

      if (sectorBolsonOrigenStr === '—') {
        sectorBolsonOrigenStr =
          l.sectorBolsonOrigen ||
          ingresoPrevioSiloCsv?.bolsonOrigenSector ||
          '—';
      }

      return [
        fechaRealizadoStr,
        cliente,
        l.especie || 'Sin especificar',
        l.variedad || 'Sin variedad',
        l.loteNro || l.id,
        l.stockBolsas,
        l.kgPorBolsa,
        l.stockKg,
        l.tipo || 'Final',
        l.categoria || 'PRIMU',
        tratamientoStr,
        l.inaseInicio || '—',
        l.inaseFinal || '—',
        bolsonOrigenStr,
        sectorBolsonOrigenStr
      ];
    });

    const csvContent = [
      'sep=;',
      headers.join(';'),
      ...rows.map(row => row.map(val => {
        const str = String(val !== undefined && val !== null ? val : '');
        if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(';'))
    ].join('\r\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Reporte_Lotes_Filtrados_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6" id="lotes-view-container">
      {/* Toast de Actualización de Información */}
      {refreshToast && (
        <div className="fixed top-6 right-6 z-[120] bg-[#00603C] text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4 duration-200 border border-emerald-500 font-sans print:hidden">
          <CheckCircle2 className="w-5 h-5 text-amber-300 shrink-0" />
          <span className="text-xs font-bold">{refreshToast}</span>
        </div>
      )}

      {/* Contenido interactivo de Gestión de Lotes (ocultado al imprimir modales de fichas múltiples) */}
      <div id="lotes-view-content" className="space-y-6">
        {/* Cabecera */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
        <div>
          <span className="text-xs font-sans font-semibold tracking-widest text-[#00603C] uppercase">
            MÓDULO DE ACOPIO
          </span>
          <h2 className="font-serif text-3xl font-bold text-[#1A1A1A] mt-1">
            Gestión de Lotes
          </h2>
        </div>

        <div className="flex flex-wrap gap-2.5 self-start sm:self-center items-center">
          {/* Botón Actualización de Información */}
          <button
            id="btn-actualizar-informacion"
            type="button"
            onClick={handleRefreshInfo}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-extrabold font-sans uppercase tracking-wider bg-white text-[#00603C] hover:bg-[#E3EFE7]/40 border border-[#00603C]/30 rounded-lg transition cursor-pointer shadow-2xs disabled:opacity-60"
            title="Actualizar y resincronizar información, existencias y estados de lotes"
          >
            <RefreshCw className={`w-4 h-4 text-[#00603C] ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Actualizando...' : 'Actualizar Información'}</span>
          </button>

          {/* Botón Límites de Lotes */}
          <button
            id="btn-limites-lotes"
            onClick={() => setShowLimitsModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold font-sans uppercase tracking-wider bg-white text-gray-700 hover:text-[#00603C] hover:bg-gray-50 border border-gray-200 rounded-lg transition cursor-pointer shadow-2xs"
            title="Configurar límites máximos por lote (kg, bolsas, kg por bolsa)"
          >
            <Sliders className="w-4 h-4 text-[#C9922E]" />
            <span>Límites de Lotes</span>
          </button>

          {/* Botones de Exportación */}
          <div className="flex items-center gap-1.5 bg-[#E3EFE7]/40 p-1 rounded-xl border border-[#00603C]/20 flex-wrap">
            <button
              id="btn-exportar-lotes-excel"
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold font-sans uppercase tracking-wider bg-[#00603C] text-white hover:bg-[#254731] rounded-lg transition cursor-pointer shadow-2xs"
              title="Descargar archivo de Excel (.xlsx) con el Reporte de Producción oficial"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#C9922E]" />
              <span>Reporte de Producción</span>
            </button>
            <button
              id="btn-reporte-movimientos-excel"
              onClick={handleExportMovimientosExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold font-sans uppercase tracking-wider bg-white text-sky-800 hover:bg-sky-50 border border-sky-300 rounded-lg transition cursor-pointer shadow-2xs"
              title="Descargar archivo de Excel (.xlsx) con el Reporte de Movimientos"
            >
              <Download className="w-4 h-4 text-sky-600" />
              <span>Reporte de Movimientos</span>
            </button>
            <button
              id="btn-exportar-lotes-csv"
              onClick={handleExportCSV}
              className="flex items-center gap-1 px-2.5 py-2 text-xs font-semibold font-sans uppercase tracking-wider text-[#00603C] hover:bg-[#00603C]/10 rounded-lg transition cursor-pointer"
              title="Exportar como CSV delimitado por punto y coma (;)"
            >
              <span>CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* PANEL CONSOLA DE INFORMACIÓN (INFO CONSOLE) PERSISTENTE EN LA PARTE SUPERIOR */}
      {(() => {
        const totalBolsasRealizadas = filteredLotes
          .filter(l => (l.estadoRegistro || 'REALIZADO') === 'REALIZADO' && l.estadoRegistro !== 'PRE-CARGA')
          .reduce((acc, l) => acc + (Number(l.stockBolsas) || 0), 0);

        const totalBolsasPrecarga = filteredLotes
          .filter(l => l.estadoRegistro === 'PRE-CARGA')
          .reduce((acc, l) => acc + (Number(l.stockBolsas) || 0), 0);
        
        const totalBolsasFiltradas = filteredLotes
          .reduce((acc, l) => acc + (Number(l.stockBolsas) || 0), 0);

        const totalKgFiltrados = filteredLotes
          .reduce((acc, l) => acc + (Number(l.stockKg) || 0), 0);

        const totalTnFiltradas = totalKgFiltrados / 1000;

        const avgKgPerBolsa = totalBolsasFiltradas > 0 ? (totalKgFiltrados / totalBolsasFiltradas) : 0;

        const lotesListStr = filteredLotes
          .map(l => l.loteNro || l.id)
          .filter(Boolean)
          .join(', ');

        const handleCopyConsoleLotes = () => {
          navigator.clipboard.writeText(lotesListStr);
          setCopiedLotesSuccess(true);
          setTimeout(() => setCopiedLotesSuccess(false), 2500);
        };

        const hasActiveFilters = activeDimensionCount > 0 || search.trim().length > 0;

        return (
          <div
            id="info-console-lotes"
            className="bg-gradient-to-br from-slate-900 via-[#00603C]/95 to-[#254731] text-white rounded-2xl p-5 shadow-lg border border-[#C9922E]/30 space-y-4"
          >
            {/* Header de la Consola de Información */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-amber-300 font-black">
                  <BarChart2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black uppercase tracking-widest text-amber-300 font-sans">
                      Info Console · Consola Informativa
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      En Vivo
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Cálculo automático de bolsas, peso y lotes según filtros en cascada activos
                  </p>
                </div>
              </div>

              {/* Acciones de la Consola */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  id="btn-console-ver-lotes"
                  onClick={() => setShowLotesIntegrantesModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition shadow-sm cursor-pointer"
                  title="Ver detalle completo de los lotes integrantes que componen este cálculo"
                >
                  <ListFilter className="w-3.5 h-3.5" />
                  <span>Ver Lotes Integrantes ({filteredLotes.length})</span>
                </button>

                <button
                  type="button"
                  id="btn-console-copiar-lotes"
                  onClick={handleCopyConsoleLotes}
                  disabled={filteredLotes.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition cursor-pointer disabled:opacity-50"
                  title="Copiar lista de números de lotes al portapapeles"
                >
                  {copiedLotesSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span className="text-emerald-300 font-bold">¡Copiados!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-300" />
                      <span>Copiar Lotes</span>
                    </>
                  )}
                </button>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleClearAllFilters}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
                    title="Restablecer todos los filtros"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Restablecer</span>
                  </button>
                )}
              </div>
            </div>

            {/* Grid Principal de Métricas Calculadas */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Tarjeta 1: Total Bolsas */}
              <div className="bg-white/10 backdrop-blur-xs p-4 rounded-xl border border-white/10 hover:border-emerald-400/40 transition">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300 font-sans">
                    Total Bolsas
                  </span>
                  <Package className="w-4 h-4 text-emerald-300 opacity-80" />
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-serif font-bold text-white tracking-tight">
                    {formatNumberArg(totalBolsasFiltradas, 0)}
                  </span>
                  <span className="text-xs font-sans text-emerald-200 font-semibold">
                    bolsas
                  </span>
                </div>
                <div className="mt-1.5 pt-1.5 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-300">
                  <span>Realizadas: <strong className="text-white">{formatNumberArg(totalBolsasRealizadas, 0)}</strong></span>
                  {totalBolsasPrecarga > 0 && (
                    <span className="text-amber-300 font-medium">Precarga: {formatNumberArg(totalBolsasPrecarga, 0)}</span>
                  )}
                </div>
              </div>

              {/* Tarjeta 2: Peso Total (Total Weight) */}
              <div className="bg-white/10 backdrop-blur-xs p-4 rounded-xl border border-white/10 hover:border-amber-400/40 transition">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 font-sans">
                    Peso Total en Stock
                  </span>
                  <Scale className="w-4 h-4 text-amber-300 opacity-80" />
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-serif font-bold text-white tracking-tight">
                    {formatNumberArg(totalKgFiltrados, 0)}
                  </span>
                  <span className="text-xs font-sans text-amber-200 font-semibold">
                    kg
                  </span>
                </div>
                <div className="mt-1.5 pt-1.5 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-300">
                  <span>Equivalente: <strong className="text-amber-200">{totalTnFiltradas.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Tn</strong></span>
                  {avgKgPerBolsa > 0 && (
                    <span>Prom: {Math.round(avgKgPerBolsa)} kg/b</span>
                  )}
                </div>
              </div>

              {/* Tarjeta 3: Cantidad de Lotes (Batch Count) */}
              <div className="bg-white/10 backdrop-blur-xs p-4 rounded-xl border border-white/10 hover:border-sky-400/40 transition">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-sky-300 font-sans">
                    Cantidad de Lotes
                  </span>
                  <Layers className="w-4 h-4 text-sky-300 opacity-80" />
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-serif font-bold text-white tracking-tight">
                    {filteredLotes.length}
                  </span>
                  <span className="text-xs font-sans text-sky-200 font-semibold">
                    lotes filtrados
                  </span>
                </div>
                <div className="mt-1.5 pt-1.5 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-300">
                  <span>Total en planta: <strong className="text-white">{lotes.length}</strong></span>
                  <span className="text-slate-300 truncate max-w-[120px]" title={lotesListStr || 'Sin lotes'}>
                    {lotesListStr || '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Resumen del Alcance y Filtros en Cascada Aplicados */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-slate-300">
              <span className="font-semibold text-amber-300/80 mr-1">Alcance en Cascada:</span>
              {filterClientes.length > 0 ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/15 text-white font-semibold">
                  Cliente: {filterClientes.join(', ')}
                </span>
              ) : (
                <span className="text-slate-400">Todos los clientes</span>
              )}

              {filterEspecies.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/15 text-white font-medium">
                  Especie: {filterEspecies.join(', ')}
                </span>
              )}

              {filterVariedades.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/15 text-white font-medium">
                  Variedad: {filterVariedades.join(', ')}
                </span>
              )}

              {filterEstadoRegistro !== 'TODOS' && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold ${filterEstadoRegistro === 'REALIZADO' ? 'bg-emerald-500/30 text-emerald-200' : 'bg-amber-500/30 text-amber-200'}`}>
                  Estado: {filterEstadoRegistro}
                </span>
              )}

              {filterTipos.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/15 text-white font-medium">
                  Tipo: {filterTipos.join(', ')}
                </span>
              )}

              {filterCategorias.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/15 text-white font-medium">
                  Cat: {filterCategorias.join(', ')}
                </span>
              )}

              {filterTratamientos.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/15 text-white font-medium">
                  Trat: {filterTratamientos.join(', ')}
                </span>
              )}

              {filterEstados.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-200 font-medium">
                  Disp: {filterEstados.join(', ')}
                </span>
              )}
            </div>
          </div>
        );
      })()}

      {/* Panel de Filtros con Selección Múltiple, Filtro de Estado de Registro y Botón Fijar Filtro */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-3 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-xs font-bold text-[#00603C] uppercase tracking-wider">
              <Filter className="w-4 h-4 text-[#00603C]" />
              <span>Filtros de Búsqueda</span>
            </div>

            {/* Selector de Estado de Registro (Todos / Realizado / Precarga) */}
            <div className="flex items-center bg-[#E3EFE7]/40 p-1 rounded-xl border border-gray-200 text-xs font-sans">
              <button
                type="button"
                id="filter-estado-todos"
                onClick={() => setFilterEstadoRegistro('TODOS')}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                  filterEstadoRegistro === 'TODOS'
                    ? 'bg-[#00603C] text-white shadow-2xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Todos ({lotes.length})
              </button>
              <button
                type="button"
                id="filter-estado-realizado"
                onClick={() => setFilterEstadoRegistro('REALIZADO')}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                  filterEstadoRegistro === 'REALIZADO'
                    ? 'bg-emerald-700 text-white shadow-2xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Realizado ({lotes.filter(l => (l.estadoRegistro || 'REALIZADO') === 'REALIZADO' && l.estadoRegistro !== 'PRE-CARGA').length})
              </button>
              <button
                type="button"
                id="filter-estado-precarga"
                onClick={() => setFilterEstadoRegistro('PRE-CARGA')}
                className={`px-3 py-1.5 rounded-lg font-extrabold transition cursor-pointer ${
                  filterEstadoRegistro === 'PRE-CARGA'
                    ? 'bg-amber-500 text-slate-950 shadow-2xs ring-1 ring-amber-400'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Precarga ({lotes.filter(l => l.estadoRegistro === 'PRE-CARGA').length})
              </button>
            </div>

            {/* Badge de Filtro Fijado */}
            {isFilterPinned && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#C9922E]/15 text-[#C9922E] border border-[#C9922E]/40 animate-pulse">
                <Pin className="w-3 h-3 fill-[#C9922E]" />
                Filtro Fijado
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Botón Fijar / Desfijar Filtro */}
            <button
              id="btn-fijar-filtro-lotes"
              type="button"
              onClick={handleTogglePinFilter}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs ${
                isFilterPinned
                  ? 'bg-[#C9922E] text-white hover:bg-[#a67520] ring-2 ring-[#C9922E]/30'
                  : 'bg-gray-100 text-gray-700 hover:bg-[#00603C] hover:text-white border border-gray-200'
              }`}
              title={
                isFilterPinned
                  ? "El filtro está fijado persistentemente. Haz clic para desfijar."
                  : "Fijar el filtro actualmente aplicado para conservarlo al navegar o recargar"
              }
            >
              <Pin className={`w-3.5 h-3.5 ${isFilterPinned ? 'fill-current' : ''}`} />
              <span>{isFilterPinned ? 'Filtro Fijado' : 'Fijar Filtro'}</span>
            </button>

            {/* Botón Limpiar Filtros */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition cursor-pointer"
                title="Restablecer todos los filtros aplicados"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpiar ({activeFiltersCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* FILTRO PRINCIPAL: CLIENTE (SIMILAR A LA HOJA PRODUCCIÓN) */}
        <div className="bg-[#E3EFE7]/50 border-2 border-[#00603C]/30 rounded-xl p-3.5 sm:p-4 flex flex-col justify-between space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#00603C] text-white flex items-center justify-center shadow-xs shrink-0">
                <Building2 className="w-4.5 h-4.5 text-[#C9922E]" />
              </div>
              <div>
                <label
                  htmlFor="filtro-principal-cliente-lotes"
                  className="block text-xs font-black uppercase tracking-wider text-[#00603C] font-sans"
                >
                  Filtro Principal: Cliente
                </label>
                <span className="block text-[11px] text-gray-500">
                  Condiciona especies, variedades y disponibilidad vinculada en lotes
                </span>
              </div>
            </div>

            {filterClientes.length > 0 && (
              <button
                type="button"
                onClick={() => setFilterClientes([])}
                className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-bold self-start sm:self-center cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                Quitar Filtro Cliente
              </button>
            )}
          </div>

          <div className="relative">
            <select
              id="filtro-principal-cliente-lotes"
              value={filterClientes.length === 1 ? filterClientes[0] : (filterClientes.length > 1 ? '__multiple__' : '')}
              onChange={(e) => {
                const val = e.target.value;
                if (!val) {
                  setFilterClientes([]);
                } else {
                  setFilterClientes([val]);
                }
              }}
              className="w-full bg-white border-2 border-[#00603C]/40 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#00603C] focus:border-[#00603C] shadow-xs cursor-pointer"
            >
              <option value="">-- Todos los Clientes (Lotes Globales) --</option>
              {filterClientes.length > 1 && (
                <option value="__multiple__" disabled>
                  -- Múltiples Clientes ({filterClientes.join(', ')}) --
                </option>
              )}
              {clientesDisponibles.map((c) => {
                const count = lotes.filter(l => {
                  const normL = normalizeCliente(l.cliente);
                  const normC = normalizeCliente(c);
                  return normL === normC || (l.cliente || '').trim().toLowerCase() === c.trim().toLowerCase();
                }).length;
                return (
                  <option key={c} value={c}>
                    {c} ({count} {count === 1 ? 'lote' : 'lotes'})
                  </option>
                );
              })}
            </select>
          </div>

          <div className="text-[11px] text-[#00603C] font-medium flex flex-wrap items-center justify-between gap-1">
            {filterClientes.length > 0 ? (
              <span>Filtrando lotes exclusivamente para <strong>{filterClientes.join(', ')}</strong></span>
            ) : (
              <span className="text-gray-500">Visualizando partidas de todos los clientes sin restricción</span>
            )}
            {filterClientes.length > 0 && (
              <span className="text-xs font-mono font-bold text-[#00603C] bg-white/80 px-2 py-0.5 rounded-md border border-[#00603C]/20">
                {lotesContextoCliente.length} {lotesContextoCliente.length === 1 ? 'lote activo' : 'lotes activos'}
              </span>
            )}
          </div>
        </div>

        {/* Grid de Controles de Filtrado Secundario en Cascada */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          
          {/* Buscador de Texto */}
          <div className="relative sm:col-span-2 md:col-span-1 lg:col-span-1 xl:col-span-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              id="input-buscador-lotes"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[#E3EFE7]/30 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C] h-10"
              placeholder="Buscar por lote, cliente..."
            />
          </div>

          {/* Filtro Especie (Multi - en cascada) */}
          <MultiSelectDropdown
            id="select-filtro-especie"
            label="Especie"
            options={especiesDisponibles}
            selectedValues={filterEspecies}
            onChange={setFilterEspecies}
            getOptionCount={(esp) => lotesContextoCliente.filter(l => (l.especie || 'Sin especificar') === esp).length}
          />

          {/* Filtro Variedad (Multi - en cascada) */}
          <MultiSelectDropdown
            id="select-filtro-variedad"
            label="Variedad"
            options={variedadesDisponibles}
            selectedValues={filterVariedades}
            onChange={setFilterVariedades}
            getOptionCount={(v) => lotesContextoCliente.filter(l => (l.variedad || 'Sin especificar') === v).length}
          />

          {/* Filtro Tipo (Multi - en cascada) */}
          <MultiSelectDropdown
            id="select-filtro-tipo"
            label="Tipo"
            options={tiposDisponibles}
            selectedValues={filterTipos}
            onChange={setFilterTipos}
            getOptionCount={(tp) => lotesContextoCliente.filter(l => l.tipo === tp).length}
          />

          {/* Filtro Categoría (Multi - en cascada) */}
          <MultiSelectDropdown
            id="select-filtro-categoria"
            label="Categoría"
            options={categoriasDisponibles}
            selectedValues={filterCategorias}
            onChange={setFilterCategorias}
            getOptionCount={(cat) => lotesContextoCliente.filter(l => (l.categoria || 'PRIMU') === cat).length}
          />

          {/* Filtro Tratamiento (Multi - en cascada) */}
          <MultiSelectDropdown
            id="select-filtro-tratamiento"
            label="Tratamiento"
            options={tratamientosDisponibles}
            selectedValues={filterTratamientos}
            onChange={setFilterTratamientos}
          />

          {/* Filtro Disponibilidad / Estado (Multi) */}
          <MultiSelectDropdown
            id="select-filtro-estado"
            label="Disponibilidad"
            options={estadosDisponibles}
            selectedValues={filterEstados}
            onChange={setFilterEstados}
            getOptionCount={(est) => lotesContextoCliente.filter(l => l.estado === est).length}
          />

        </div>

        {/* Etiquetas de Filtros Activos (Pills) */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-gray-50 text-[11px]">
            <span className="font-semibold text-gray-400 mr-1">Filtros activos:</span>

            {filterEstadoRegistro !== 'TODOS' && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold ${filterEstadoRegistro === 'REALIZADO' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>
                Estado: {filterEstadoRegistro}
                <button type="button" onClick={() => setFilterEstadoRegistro('TODOS')} className="hover:text-red-600 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {search && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-medium">
                Búsqueda: "{search}"
                <button type="button" onClick={() => setSearch('')} className="hover:text-red-600 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {filterClientes.map(cl => (
              <span key={`pill-cl-${cl}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#E3EFE7] text-[#00603C] font-semibold">
                Cliente: {cl}
                <button type="button" onClick={() => setFilterClientes(filterClientes.filter(v => v !== cl))} className="hover:text-red-600 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {filterEspecies.map(esp => (
              <span key={`pill-esp-${esp}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#E3EFE7] text-[#00603C] font-semibold">
                Especie: {esp}
                <button type="button" onClick={() => setFilterEspecies(filterEspecies.filter(v => v !== esp))} className="hover:text-red-600 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {filterVariedades.map(varName => (
              <span key={`pill-var-${varName}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#E3EFE7] text-[#00603C] font-semibold">
                Variedad: {varName}
                <button type="button" onClick={() => setFilterVariedades(filterVariedades.filter(v => v !== varName))} className="hover:text-red-600 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {filterTipos.map(tp => (
              <span key={`pill-tp-${tp}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-medium">
                Tipo: {tp}
                <button type="button" onClick={() => setFilterTipos(filterTipos.filter(v => v !== tp))} className="hover:text-red-600 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {filterCategorias.map(cat => (
              <span key={`pill-cat-${cat}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-medium">
                Cat: {cat}
                <button type="button" onClick={() => setFilterCategorias(filterCategorias.filter(v => v !== cat))} className="hover:text-red-600 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {filterTratamientos.map(tr => (
              <span key={`pill-tr-${tr}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-medium">
                Trat: {tr}
                <button type="button" onClick={() => setFilterTratamientos(filterTratamientos.filter(v => v !== tr))} className="hover:text-red-600 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {filterEstados.map(est => (
              <span key={`pill-est-${est}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F6EFDC] text-[#C9922E] font-semibold">
                Disp: {est}
                <button type="button" onClick={() => setFilterEstados(filterEstados.filter(v => v !== est))} className="hover:text-red-600 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Panel de Resumen Consolidado de Existencias y Lotes */}
        {(() => {
          const totalBolsasRealizadas = filteredLotes
            .filter(l => (l.estadoRegistro || 'REALIZADO') === 'REALIZADO' && l.estadoRegistro !== 'PRE-CARGA')
            .reduce((acc, l) => acc + (Number(l.stockBolsas) || 0), 0);
          
          const totalBolsasFiltradas = filteredLotes
            .reduce((acc, l) => acc + (Number(l.stockBolsas) || 0), 0);

          const totalKgFiltrados = filteredLotes
            .reduce((acc, l) => acc + (Number(l.stockKg) || 0), 0);

          const lotesListStr = filteredLotes
            .map(l => l.loteNro || l.id)
            .filter(Boolean)
            .join(', ');

          const handleCopyLotesList = () => {
            navigator.clipboard.writeText(lotesListStr);
            setCopiedLotesSuccess(true);
            setTimeout(() => setCopiedLotesSuccess(false), 2500);
          };

          return (
            <div className="mt-2 bg-gradient-to-br from-[#00603C]/5 via-white to-[#C9922E]/10 rounded-2xl p-4 border border-[#00603C]/20 shadow-2xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-[#00603C]" />
                  <h3 className="text-xs font-black uppercase text-[#00603C] tracking-wider font-sans">
                    Resumen de Existencias Seleccionadas
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowLotesIntegrantesModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold text-[#00603C] bg-white hover:bg-[#00603C] hover:text-white border border-[#00603C]/30 rounded-xl transition shadow-2xs cursor-pointer"
                    title="Ver listado detallado de números de lotes que integran este stock"
                  >
                    <ListFilter className="w-3.5 h-3.5" />
                    <span>Ver Lotes Integrantes ({filteredLotes.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyLotesList}
                    disabled={filteredLotes.length === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-700 bg-white hover:bg-gray-100 border border-gray-200 rounded-xl transition shadow-2xs cursor-pointer disabled:opacity-50"
                    title="Copiar lista de números de lotes al portapapeles"
                  >
                    {copiedLotesSuccess ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700 font-extrabold">¡Copiados!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-gray-500" />
                        <span>Copiar Lotes</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Tarjetas de Métricas de Existencias */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Bolsas Realizadas */}
                <div className="bg-white p-3.5 rounded-xl border border-emerald-100 shadow-2xs flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block font-sans">
                      Bolsas Realizadas
                    </span>
                    <span className="text-xl font-serif font-bold text-emerald-800">
                      {formatNumberArg(totalBolsasRealizadas, 0)}
                    </span>
                    <span className="text-[10px] text-gray-400 block mt-0.5">
                      Total producción terminada ({formatNumberArg(totalBolsasFiltradas, 0)} bolsas totales)
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                </div>

                {/* Kilos Totales */}
                <div className="bg-white p-3.5 rounded-xl border border-amber-100 shadow-2xs flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block font-sans">
                      Kilos Totales en Stock
                    </span>
                    <span className="text-xl font-serif font-bold text-[#C9922E]">
                      {formatNumberArg(totalKgFiltrados, 0)} <span className="text-xs font-sans text-gray-500 font-semibold">kg</span>
                    </span>
                    <span className="text-[10px] text-gray-400 block mt-0.5">
                      {(totalKgFiltrados / 1000).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Tn métricas
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-[#C9922E] flex items-center justify-center font-black">
                    <Scale className="w-5 h-5" />
                  </div>
                </div>

                {/* Lotes que integran este stock */}
                <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-2xs flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block font-sans">
                      Lotes que Integran el Stock
                    </span>
                    <span className="text-xl font-serif font-bold text-slate-800">
                      {filteredLotes.length} <span className="text-xs font-sans text-gray-500 font-semibold">lotes</span>
                    </span>
                    <span className="text-[10px] text-gray-400 block mt-0.5 truncate max-w-[200px]" title={lotesListStr || 'Ningún lote'}>
                      {lotesListStr ? lotesListStr : 'Sin lotes'}
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-black">
                    <Layers className="w-5 h-5" />
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Barra de Acciones Múltiples para Lotes Seleccionados */}
        {selectedLoteIds.length > 0 && (
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-[#00603C] text-white p-3.5 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200 border border-amber-400/30">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 bg-amber-400 text-slate-950 font-black text-xs rounded-lg font-mono">
                {selectedLoteIds.length} {selectedLoteIds.length === 1 ? 'LOTE SELECCIONADO' : 'LOTES SELECCIONADOS'}
              </span>
              <span className="text-xs text-slate-300 hidden sm:inline">
                Acciones grupales para lotes seleccionados (Realizados o Precarga):
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Botón Descargar Fichas Técnicas de Lotes Seleccionados */}
              <button
                type="button"
                id="btn-descargar-fichas-seleccionados"
                onClick={() => {
                  const selected = lotes.filter((l) => selectedLoteIds.includes(l.id));
                  if (selected.length > 0) {
                    setBatchFichasLotes(selected);
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-black text-xs rounded-xl shadow-md hover:shadow-lg transition cursor-pointer tracking-wider uppercase font-sans active:scale-95 border border-emerald-500"
                title={`Abrir Vista Previa y Descargar Fichas Técnicas de los ${selectedLoteIds.length} lotes seleccionados`}
              >
                <FileText className="w-4 h-4 text-amber-300 stroke-[2.5]" />
                <span>Descargar Fichas ({selectedLoteIds.length})</span>
              </button>

              {/* Botón Vista Previa / Descargar ID Bolsas de Lotes Seleccionados */}
              <button
                type="button"
                id="btn-vista-previa-id-bolsas-seleccionados"
                onClick={() => {
                  const selected = lotes.filter((l) => selectedLoteIds.includes(l.id));
                  if (selected.length > 0) {
                    setBatchIdBolsasLotes(selected);
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-md hover:shadow-lg transition cursor-pointer tracking-wider uppercase font-sans active:scale-95 border border-amber-300"
                title={`Abrir Vista Previa y Descargar ID Bolsas de los ${selectedLoteIds.length} lotes seleccionados`}
              >
                <Tag className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                <span>Vista Previa / Descargar ID Bolsas ({selectedLoteIds.length})</span>
              </button>

              {/* Botón Eliminar Seleccionados con Validación Estricta por Prompt */}
              <button
                type="button"
                id="btn-eliminar-lotes-seleccionados"
                onClick={handleDeleteSelectedLotes}
                className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md hover:shadow-lg transition cursor-pointer tracking-wider uppercase font-sans active:scale-95 border border-rose-500"
                title={`Eliminar definitivamente los ${selectedLoteIds.length} lotes seleccionados`}
              >
                <Trash2 className="w-4 h-4 text-white stroke-[2.5]" />
                <span>Eliminar Seleccionados ({selectedLoteIds.length})</span>
              </button>

              {/* Botón Deseleccionar Todos */}
              <button
                type="button"
                onClick={() => setSelectedLoteIds([])}
                className="px-3.5 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
              >
                Deseleccionar
              </button>
            </div>
          </div>
        )}

        {/* Cambiar de Vista */}
        <div className="flex justify-between items-center border-t border-gray-50 pt-3 text-xs text-gray-500">
          <div>
            Mostrando <span className="font-semibold text-[#00603C]">{filteredLotes.length}</span> de <span className="font-semibold text-gray-700">{lotes.length}</span> lotes acopiados
          </div>

          <div className="flex items-center gap-3">
            {/* Selector de Columnas (Solo visible en Vista de Tabla) */}
            {viewType === 'table' && (
              <div className="relative" id="column-selector-container">
                <button
                  onClick={() => setShowColumnSelector(!showColumnSelector)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-800 transition shadow-2xs font-semibold text-xs cursor-pointer"
                  title="Configurar columnas"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[#C9922E]" />
                  <span>Columnas</span>
                </button>

                {showColumnSelector && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowColumnSelector(false)}
                    />
                    <div className="absolute right-0 mt-1.5 w-56 bg-white border border-gray-100 rounded-xl shadow-lg p-3 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="flex justify-between items-center pb-2 mb-2 border-b border-gray-100">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Mostrar Columnas</span>
                        <button 
                          onClick={() => setVisibleColumns({
                            fechaAlta: true,
                            cliente: true,
                            especie: true,
                            variedad: true,
                            loteId: true,
                            tipo: true,
                            tratamiento: true,
                            categoria: true,
                            envase: true,
                            bolsas: true,
                            stockKg: true,
                            estado: true,
                          })}
                          className="text-[9px] font-black text-[#00603C] hover:underline cursor-pointer"
                        >
                          Restablecer
                        </button>
                      </div>
                      <div className="space-y-1.5 max-h-60 overflow-y-auto">
                        {[
                          { key: 'fechaAlta', label: 'Fecha de alta' },
                          { key: 'cliente', label: 'Cliente' },
                          { key: 'especie', label: 'Especie' },
                          { key: 'variedad', label: 'Variedad' },
                          { key: 'loteId', label: 'Lote' },
                          { key: 'tipo', label: 'Tipo de lote' },
                          { key: 'tratamiento', label: 'Tratamiento' },
                          { key: 'categoria', label: 'Categoría' },
                          { key: 'envase', label: 'Envase' },
                          { key: 'bolsas', label: 'Cantidad de bolsas' },
                          { key: 'stockKg', label: 'Cantidad de kg' },
                          { key: 'estado', label: 'Estado' },
                        ].map(({ key, label }) => (
                          <label 
                            key={key} 
                            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 text-xs font-medium text-gray-700 cursor-pointer transition select-none"
                          >
                            <input
                              type="checkbox"
                              checked={visibleColumns[key as keyof typeof visibleColumns]}
                              onChange={() => setVisibleColumns(prev => ({
                                ...prev,
                                [key]: !prev[key as keyof typeof visibleColumns]
                              }))}
                              className="rounded border-gray-300 text-[#00603C] focus:ring-[#00603C] h-3.5 w-3.5 cursor-pointer"
                            />
                            <span className="truncate">{label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg p-0.5 bg-gray-50">
              <button
                onClick={() => setViewType('grid')}
                className={`p-1.5 rounded-md transition ${viewType === 'grid' ? 'bg-[#00603C] text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                title="Vista de Tarjetas"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewType('table')}
                className={`p-1.5 rounded-md transition ${viewType === 'table' ? 'bg-[#00603C] text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                title="Vista de Tabla"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard General y Resumen Unificado de Lotes (Interactivo, Orgánico y Filtrable) */}
      <LotesUnifiedDashboard
        lotes={lotes}
        filteredLotes={filteredLotes}
        activeFilterDimensions={activeFilterDimensions}
        hasActiveFilters={hasActiveFilters}
        activeFiltersCount={activeFiltersCount}
        onLoteClick={onSelectLote}
        onQuickFilter={handleQuickFilter}
      />

      {/* Resultados de Búsqueda */}
      {filteredLotes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
          <Search className="w-10 h-10 mx-auto mb-3 opacity-50 text-[#C9922E]" />
          <h4 className="font-serif text-lg font-bold text-gray-700 mb-1">Sin Resultados</h4>
          <p className="text-xs">No se encontraron lotes que coincidan con los filtros aplicados.</p>
        </div>
      ) : viewType === 'grid' ? (
        
        /* VISTA TARJETAS (GRID) */
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {paginatedLotes.map(l => (
              <div
                key={l.id}
                className="bg-white rounded-2xl border border-gray-100 hover:border-[#00603C] hover:border-opacity-30 shadow-sm hover:shadow-md transition duration-200 flex flex-col justify-between overflow-hidden group"
              >
              {/* Encabezado Tarjeta */}
              <div className="p-5 border-b border-gray-50 bg-[#E3EFE7] bg-opacity-20 flex justify-between items-start gap-4">
                <div className="flex items-start gap-3">
                  {/* Casilla Check */}
                  <input
                    type="checkbox"
                    checked={selectedLoteIds.includes(l.id)}
                    onChange={() => toggleSelectLote(l.id)}
                    className="mt-1 rounded border-gray-300 text-[#00603C] focus:ring-[#00603C] h-4 w-4 cursor-pointer"
                  />
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="px-3 py-1 bg-[#C9922E] text-white text-xs sm:text-sm font-mono font-black rounded-lg shadow-sm tracking-wider">
                        LOTE: {l.loteNro}
                      </span>
                      {l.ala && l.sector && (
                        <span className="px-2.5 py-1 bg-[#00603C] text-white text-[10px] sm:text-[11px] font-mono font-black rounded-lg shadow-sm tracking-wider">
                          UBICACIÓN: {l.ala}-{l.sector}
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-gray-500 font-semibold">
                        ID: {l.id}
                      </span>
                    </div>
                    <h4 className="font-serif text-base font-bold text-[#1A1A1A] mt-1 group-hover:text-[#00603C] transition">
                      {l.especie} · <span className="font-sans font-normal text-sm text-gray-600">{l.variedad}</span>
                    </h4>
                    <div className="text-xs font-semibold text-[#00603C] mt-1">
                      {l.cliente}
                    </div>
                  </div>
                </div>

                <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border ${getEstadoBadgeStyle(l.estado)}`}>
                  {l.estado}
                </span>
              </div>

              {/* Detalles Técnicos */}
              <div className="p-5 space-y-3.5 flex-grow">
                {/* Gran Stock Destacado */}
                <div className="flex justify-between items-end border-b border-dashed border-gray-100 pb-3">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400">
                    Existencias Disponibles
                  </span>
                  <div className="text-right">
                    <span className="font-serif text-xl font-bold text-[#1A1A1A] block">
                      {formatNumberArg(l.stockBolsas, 0)} <span className="text-xs font-sans font-medium text-gray-500">bolsas</span>
                    </span>
                    <span className="text-xs font-mono font-semibold text-[#C9922E]">
                      {formatNumberArg(l.stockKg, 0)} kg
                    </span>
                  </div>
                </div>

                {/* Atributos Secundarios */}
                <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-gray-400 block">Tipo de Semilla</span>
                    <span className="font-medium text-gray-700">{l.tipo}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-gray-400 block">Ingreso</span>
                    <span className="font-medium text-gray-700">{formatDateStr(l.fechaIngreso)}</span>
                  </div>
                  {l.ala && l.sector && (
                    <div className="col-span-2">
                      <span className="text-[9px] uppercase tracking-wider text-gray-400 block">Sector de Acopio</span>
                      <span className="font-semibold text-[#00603C]">ALA: {l.ala} · SECTOR: {l.sector}</span>
                    </div>
                  )}
                  <div className="col-span-2">
                    <span className="text-[9px] uppercase tracking-wider text-gray-400 block">Tratamiento</span>
                    <span className="font-medium text-gray-700 truncate block">
                      {l.tratamiento.join(' + ')} {l.producto !== 'Ninguno' && `(${l.producto})`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Acciones Rápidas del Lote */}
              <div className="p-4 bg-gray-50 border-t border-gray-50 flex items-center justify-between gap-1">
                {/* Eliminar Lote */}
                <button
                  onClick={() => setLoteToDelete(l)}
                  className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                  title="Eliminar Lote"
                >
                  <Trash2 className="w-4.5 h-4.5" />
                </button>

                <div className="flex gap-1.5">
                  {l.estadoRegistro === 'PRE-CARGA' && (
                    (l.esMovimiento || l.tipoMovimiento || l.loteOrigen || (l.loteNro && l.loteNro.toUpperCase().includes('MOV'))) ? (
                      <button
                        type="button"
                        onClick={() => setLoteToMovRealizado(l)}
                        className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-xs flex items-center gap-1 font-bold cursor-pointer border border-blue-500"
                        title="MOV REALIZADO (Fijar manualmente el día en el que se realizó efectivamente el movimiento)"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                        <span>MOV REALIZADO</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setLoteToProcess(l)}
                        className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition text-xs flex items-center gap-1 font-bold cursor-pointer"
                        title="Pasar a Realizado (Ingresar silos y bolsones de origen)"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Realizar</span>
                      </button>
                    )
                  )}

                  {!l.tratamiento.includes('Tratado') && l.stockBolsas > 0 && (
                    <button
                      onClick={() => setLoteToTratar(l)}
                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-lg transition text-xs flex items-center gap-1 cursor-pointer shadow-2xs"
                      title="Curar / Tratar Semilla (Generar Lote T)"
                    >
                      <FlaskConical className="w-3.5 h-3.5" />
                      <span>Curar</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleOpenQuickEditModal(l)}
                    className="p-2 text-gray-500 hover:text-[#00603C] rounded-lg hover:bg-[#E3EFE7] transition text-xs flex items-center gap-1"
                    title="Editar Lote en la misma vista (Nombre, Bolsas, Estado, Tipo)"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Editar</span>
                  </button>

                  <button
                    onClick={() => setSelectedQrLote(l)}
                    className="p-2 text-gray-500 hover:text-[#00603C] rounded-lg hover:bg-[#E3EFE7] transition text-xs flex items-center gap-1"
                    title="Generar QR"
                  >
                    <QrCode className="w-4 h-4 text-[#C9922E]" />
                    <span className="hidden sm:inline">QR</span>
                  </button>

                  {l.stockBolsas > 0 && (
                    <button
                      onClick={() => onRegistrarSalidaLote(l)}
                      className="p-2 text-gray-600 hover:text-[#C9922E] rounded-lg hover:bg-[#F6EFDC] transition text-xs flex items-center gap-1"
                      title="Registrar Despacho"
                    >
                      <ArrowDownRight className="w-4 h-4" />
                      <span className="hidden sm:inline">Despachar</span>
                    </button>
                  )}

                  <button
                    onClick={() => onSelectLote(l)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00603C] text-white rounded-lg hover:bg-[#254731] transition text-xs font-semibold"
                  >
                    <Eye className="w-4 h-4 text-[#C9922E]" />
                    Ver Ficha
                  </button>
                </div>
              </div>
            </div>
          ))}
          </div>

          {/* Paginación Vista Grid */}
          <PaginationControls
            currentPage={currentPage}
            totalPages={Math.ceil(filteredLotes.length / itemsPerPage)}
            totalItems={filteredLotes.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(newSize) => {
              setItemsPerPage(newSize);
              setCurrentPage(1);
            }}
            className="rounded-2xl border border-gray-100 shadow-sm"
          />
        </div>
      ) : (
        
        /* VISTA TABLA (ESTILO DE TABLA INSTITUCIONAL) */
        <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden space-y-0 transition-all ${
          isTableExpanded ? 'w-full ring-1 ring-slate-200' : ''
        }`}>
          {/* Header Superior: Título de la tabla y botón para Expandir / Reducir Vista de Tabla */}
          <div className="bg-[#004D30] text-white px-4 py-2.5 flex items-center justify-between border-b border-emerald-800 flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                Vista de Tabla de Lotes
              </span>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 font-mono font-bold border border-emerald-700">
                {filteredLotes.length} lotes encontrados
              </span>
              {isTableExpanded && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-black uppercase tracking-wide">
                  Modo Expandido
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                id="btn-toggle-expand-tabla-lotes"
                onClick={() => setIsTableExpanded(prev => !prev)}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-900/90 hover:bg-emerald-800 text-amber-300 hover:text-amber-200 rounded-lg text-xs font-black border border-emerald-700 shadow-xs transition cursor-pointer"
                title={isTableExpanded ? 'Cambiar a vista compacta' : 'Expandir vista de tabla para mayor amplitud y comodidad'}
              >
                {isTableExpanded ? (
                  <>
                    <Minimize2 className="w-3.5 h-3.5 text-amber-300" />
                    <span>Vista Compacta</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3.5 h-3.5 text-amber-300" />
                    <span>Expandir Vista de Tabla</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Barras de Filtros Rápidos (Específicos y Visibles para Vista Tabla) */}
          <div className="p-3 sm:p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-[#004D30] text-white border-b border-gray-200/80 space-y-3 shadow-inner">
            {/* 1. Filtro Rápido Tipo */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-400 text-slate-950 font-black text-xs rounded-lg uppercase tracking-wider font-mono shadow-xs">
                  <Filter className="w-3.5 h-3.5 text-slate-950 stroke-[2.5]" />
                  <span>FILTRO TIPO:</span>
                </div>

                {/* Botón 'TODOS' Tipo */}
                <button
                  type="button"
                  id="btn-filtro-tipo-tabla-todos"
                  onClick={() => setFilterTipos([])}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 border shadow-2xs ${
                    filterTipos.length === 0
                      ? 'bg-amber-400 text-slate-950 border-amber-300 ring-2 ring-amber-300/60'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  }`}
                  title="Mostrar todos los tipos de lotes"
                >
                  <span>TODOS</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono font-bold ${
                    filterTipos.length === 0 ? 'bg-slate-950 text-amber-300' : 'bg-slate-900 text-slate-400'
                  }`}>
                    {lotesParaConteoTipos.length}
                  </span>
                </button>

                {/* Chips individuales por cada Tipo disponible */}
                {tiposDisponibles.map((tp) => {
                  const isSelected = filterTipos.includes(tp);
                  const count = lotesParaConteoTipos.filter((l) => (l.tipo || '').trim().toLowerCase() === tp.trim().toLowerCase()).length;

                  return (
                    <button
                      key={tp}
                      type="button"
                      id={`btn-filtro-tipo-tabla-${tp.toLowerCase().replace(/\s+/g, '-')}`}
                      onClick={() => {
                        if (isSelected) {
                          setFilterTipos(filterTipos.filter((t) => t !== tp));
                        } else {
                          setFilterTipos([...filterTipos, tp]);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 border shadow-2xs ${
                        isSelected
                          ? 'bg-emerald-500 text-white border-emerald-400 ring-2 ring-emerald-300/80'
                          : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border-slate-700'
                      }`}
                      title={`Filtrar por Tipo: ${tp} (${count} lotes)`}
                    >
                      <Tag className={`w-3 h-3 ${isSelected ? 'text-amber-300' : 'text-slate-400'}`} />
                      <span className="uppercase">{tp}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono font-bold ${
                          isSelected ? 'bg-emerald-950 text-emerald-200' : 'bg-slate-900 text-slate-400'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {filterTipos.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterTipos([])}
                  className="text-xs font-bold text-amber-300 hover:text-amber-200 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition cursor-pointer"
                  title="Quitar filtro de tipo y ver todos"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Restablecer Tipo</span>
                </button>
              )}
            </div>

            {/* 2. Filtro Rápido Tratamiento (Solicitado para la Tabla de Lotes) */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-700/60">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-cyan-400 text-slate-950 font-black text-xs rounded-lg uppercase tracking-wider font-mono shadow-xs">
                  <FlaskConical className="w-3.5 h-3.5 text-slate-950 stroke-[2.5]" />
                  <span>FILTRO TRATAMIENTO:</span>
                </div>

                {/* Botón 'TODOS' Tratamiento */}
                <button
                  type="button"
                  id="btn-filtro-tratamiento-tabla-todos"
                  onClick={() => setFilterTratamientos([])}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 border shadow-2xs ${
                    filterTratamientos.length === 0
                      ? 'bg-cyan-400 text-slate-950 border-cyan-300 ring-2 ring-cyan-300/60'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  }`}
                  title="Mostrar todos los tratamientos"
                >
                  <span>TODOS</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono font-bold ${
                    filterTratamientos.length === 0 ? 'bg-slate-950 text-cyan-200' : 'bg-slate-900 text-slate-400'
                  }`}>
                    {lotesParaConteoTratamientos.length}
                  </span>
                </button>

                {/* Chips individuales por cada Tratamiento disponible */}
                {tratamientosDisponibles.map((trat) => {
                  const isSelected = filterTratamientos.includes(trat);
                  const count = lotesParaConteoTratamientos.filter((l) => isLoteMatchingTratamiento(l, trat)).length;

                  return (
                    <button
                      key={trat}
                      type="button"
                      id={`btn-filtro-tratamiento-tabla-${trat.toLowerCase().replace(/\s+/g, '-')}`}
                      onClick={() => {
                        if (isSelected) {
                          setFilterTratamientos(filterTratamientos.filter((t) => t !== trat));
                        } else {
                          setFilterTratamientos([...filterTratamientos, trat]);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 border shadow-2xs ${
                        isSelected
                          ? 'bg-cyan-500 text-white border-cyan-400 ring-2 ring-cyan-300/80'
                          : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border-slate-700'
                      }`}
                      title={`Filtrar por Tratamiento: ${trat} (${count} lotes)`}
                    >
                      <FlaskConical className={`w-3 h-3 ${isSelected ? 'text-amber-300' : 'text-cyan-400'}`} />
                      <span className="uppercase">{trat}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono font-bold ${
                          isSelected ? 'bg-cyan-950 text-cyan-200' : 'bg-slate-900 text-slate-400'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {filterTratamientos.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterTratamientos([])}
                  className="text-xs font-bold text-cyan-300 hover:text-cyan-200 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition cursor-pointer"
                  title="Quitar filtro de tratamiento y ver todos"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Restablecer Tratamiento</span>
                </button>
              )}
            </div>
          </div>

          {/* Notificación de Guardado de Edición de Lote */}
          {inlineSaveSuccess && (
            <div className="p-3 bg-emerald-50 border-b border-emerald-300 text-emerald-900 text-xs font-bold flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{inlineSaveSuccess}</span>
              </div>
              <button
                type="button"
                onClick={() => setInlineSaveSuccess(null)}
                className="text-emerald-700 hover:text-emerald-950 p-1 rounded transition cursor-pointer"
                title="Cerrar notificación"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#00603C] text-white font-sans text-xs uppercase tracking-wider">
                  <th className="py-2.5 px-3 font-semibold text-center w-10">
                    <input
                      type="checkbox"
                      checked={filteredLotes.length > 0 && filteredLotes.every(l => selectedLoteIds.includes(l.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          const currentIds = filteredLotes.map(l => l.id);
                          setSelectedLoteIds(prev => Array.from(new Set([...prev, ...currentIds])));
                        } else {
                          const currentIds = filteredLotes.map(l => l.id);
                          setSelectedLoteIds(prev => prev.filter(id => !currentIds.includes(id)));
                        }
                      }}
                      title="Seleccionar todos los lotes"
                      aria-label="Seleccionar todos los lotes"
                      className="rounded border-gray-300 text-[#00603C] focus:ring-offset-0 focus:ring-0 h-4 w-4 cursor-pointer"
                    />
                  </th>

                  {/* 1. Fecha de alta */}
                  {visibleColumns.fechaAlta && (
                    <th
                      onClick={() => handleToggleSort('fechaAlta')}
                      className={`py-2 px-2.5 font-bold uppercase text-[11px] tracking-wider select-none cursor-pointer transition hover:bg-emerald-900/60 whitespace-nowrap ${sortField === 'fechaAlta' ? 'text-amber-300' : 'text-white'}`}
                      title={`Ordenar por Fecha de Alta (${sortField === 'fechaAlta' ? (sortOrder === 'asc' ? 'Ascendente' : 'Descendente') : 'Clic para ordenar'})`}
                    >
                      <div className="inline-flex items-center gap-1">
                        <span>Fecha de alta</span>
                        {sortField === 'fechaAlta' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-amber-300 stroke-[2.5]" /> : <ArrowDown className="w-3.5 h-3.5 text-amber-300 stroke-[2.5]" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-emerald-200/50 hover:text-white" />
                        )}
                      </div>
                    </th>
                  )}

                  {/* 2. Cliente */}
                  {visibleColumns.cliente && (
                    <th
                      onClick={() => handleToggleSort('cliente')}
                      className={`py-2 px-2.5 font-bold uppercase text-[11px] tracking-wider select-none cursor-pointer transition hover:bg-emerald-900/60 whitespace-nowrap ${sortField === 'cliente' ? 'text-amber-300' : 'text-white'}`}
                      title={`Ordenar por Cliente (${sortField === 'cliente' ? (sortOrder === 'asc' ? 'Ascendente' : 'Descendente') : 'Clic para ordenar'})`}
                    >
                      <div className="inline-flex items-center gap-1">
                        <span>Cliente</span>
                        {sortField === 'cliente' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-amber-300 stroke-[2.5]" /> : <ArrowDown className="w-3.5 h-3.5 text-amber-300 stroke-[2.5]" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-emerald-200/50 hover:text-white" />
                        )}
                      </div>
                    </th>
                  )}

                  {/* 3. Especie */}
                  {visibleColumns.especie && (
                    <th
                      onClick={() => handleToggleSort('especie')}
                      className={`py-2 px-2.5 font-bold uppercase text-[11px] tracking-wider select-none cursor-pointer transition hover:bg-emerald-900/60 whitespace-nowrap ${sortField === 'especie' ? 'text-amber-300' : 'text-white'}`}
                      title={`Ordenar por Especie (${sortField === 'especie' ? (sortOrder === 'asc' ? 'Ascendente' : 'Descendente') : 'Clic para ordenar'})`}
                    >
                      <div className="inline-flex items-center gap-1">
                        <span>Especie</span>
                        {sortField === 'especie' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-amber-300 stroke-[2.5]" /> : <ArrowDown className="w-3.5 h-3.5 text-amber-300 stroke-[2.5]" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-emerald-200/50 hover:text-white" />
                        )}
                      </div>
                    </th>
                  )}

                  {/* 4. Variedad */}
                  {visibleColumns.variedad && (
                    <th
                      onClick={() => handleToggleSort('variedad')}
                      className={`py-2 px-2.5 font-bold uppercase text-[11px] tracking-wider select-none cursor-pointer transition hover:bg-emerald-900/60 whitespace-nowrap ${sortField === 'variedad' ? 'text-amber-300' : 'text-white'}`}
                      title={`Ordenar por Variedad (${sortField === 'variedad' ? (sortOrder === 'asc' ? 'Ascendente' : 'Descendente') : 'Clic para ordenar'})`}
                    >
                      <div className="inline-flex items-center gap-1">
                        <span>Variedad</span>
                        {sortField === 'variedad' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-amber-300 stroke-[2.5]" /> : <ArrowDown className="w-3.5 h-3.5 text-amber-300 stroke-[2.5]" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-emerald-200/50 hover:text-white" />
                        )}
                      </div>
                    </th>
                  )}

                  {/* 5. Lote (Grande, claro y fácil de visualizar) */}
                  {visibleColumns.loteId && (
                    <th
                      onClick={() => handleToggleSort('loteId')}
                      className={`py-2 px-2.5 font-black uppercase text-xs tracking-wider select-none cursor-pointer transition hover:bg-emerald-900/60 whitespace-nowrap ${sortField === 'loteId' ? 'text-amber-300' : 'text-amber-400'}`}
                      title={`Ordenar por Lote (${sortField === 'loteId' ? (sortOrder === 'asc' ? 'Ascendente' : 'Descendente') : 'Clic para ordenar'})`}
                    >
                      <div className="inline-flex items-center gap-1">
                        <span>Lote</span>
                        {sortField === 'loteId' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-amber-300 stroke-[2.5]" /> : <ArrowDown className="w-3.5 h-3.5 text-amber-300 stroke-[2.5]" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-amber-300/50 hover:text-amber-300" />
                        )}
                      </div>
                    </th>
                  )}

                  {/* 6. Tipo de lote */}
                  {visibleColumns.tipo && (
                    <th
                      onClick={() => handleToggleSort('tipo')}
                      className={`py-2 px-2.5 font-bold uppercase text-[11px] tracking-wider select-none cursor-pointer transition hover:bg-emerald-900/60 whitespace-nowrap ${sortField === 'tipo' ? 'text-amber-300' : 'text-white'}`}
                      title={`Ordenar por Tipo (${sortField === 'tipo' ? (sortOrder === 'asc' ? 'Ascendente' : 'Descendente') : 'Clic para ordenar'})`}
                    >
                      <div className="inline-flex items-center gap-1">
                        <span>Tipo de lote</span>
                        {sortField === 'tipo' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-amber-300 stroke-[2.5]" /> : <ArrowDown className="w-3.5 h-3.5 text-amber-300 stroke-[2.5]" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-emerald-200/50 hover:text-white" />
                        )}
                      </div>
                    </th>
                  )}

                  {/* 7. Tratamiento */}
                  {visibleColumns.tratamiento && (
                    <th
                      onClick={() => handleToggleSort('tratamiento')}
                      className={`py-2 px-2.5 font-bold uppercase text-[11px] tracking-wider select-none cursor-pointer transition hover:bg-emerald-900/60 whitespace-nowrap ${sortField === 'tratamiento' ? 'text-amber-300' : 'text-white'}`}
                      title={`Ordenar por Tratamiento (${sortField === 'tratamiento' ? (sortOrder === 'asc' ? 'Ascendente' : 'Descendente') : 'Clic para ordenar'})`}
                    >
                      <div className="inline-flex items-center gap-1">
                        <span>Tratamiento</span>
                        {sortField === 'tratamiento' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-amber-300 stroke-[2.5]" /> : <ArrowDown className="w-3.5 h-3.5 text-amber-300 stroke-[2.5]" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-emerald-200/50 hover:text-white" />
                        )}
                      </div>
                    </th>
                  )}

                  {/* 8. Categoría */}
                  {visibleColumns.categoria && (
                    <th
                      onClick={() => handleToggleSort('categoria')}
                      className={`py-2 px-2.5 font-bold uppercase text-[11px] tracking-wider select-none cursor-pointer transition hover:bg-emerald-900/60 whitespace-nowrap ${sortField === 'categoria' ? 'text-amber-300' : 'text-white'}`}
                      title={`Ordenar por Categoría (${sortField === 'categoria' ? (sortOrder === 'asc' ? 'Ascendente' : 'Descendente') : 'Clic para ordenar'})`}
                    >
                      <div className="inline-flex items-center gap-1">
                        <span>Categoría</span>
                        {sortField === 'categoria' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-amber-300 stroke-[2.5]" /> : <ArrowDown className="w-3.5 h-3.5 text-amber-300 stroke-[2.5]" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-emerald-200/50 hover:text-white" />
                        )}
                      </div>
                    </th>
                  )}

                  {/* 8. Envase */}
                  {visibleColumns.envase && (
                    <th
                      onClick={() => handleToggleSort('envase')}
                      className={`py-2 px-2.5 font-bold uppercase text-[11px] tracking-wider select-none cursor-pointer transition hover:bg-emerald-900/60 whitespace-nowrap ${sortField === 'envase' ? 'text-amber-300' : 'text-white'}`}
                      title={`Ordenar por Envase (${sortField === 'envase' ? (sortOrder === 'asc' ? 'Ascendente' : 'Descendente') : 'Clic para ordenar'})`}
                    >
                      <div className="inline-flex items-center gap-1">
                        <span>Envase</span>
                        {sortField === 'envase' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-amber-300 stroke-[2.5]" /> : <ArrowDown className="w-3.5 h-3.5 text-amber-300 stroke-[2.5]" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-emerald-200/50 hover:text-white" />
                        )}
                      </div>
                    </th>
                  )}

                  {/* 9. Cantidad de bolsas en stock */}
                  {visibleColumns.bolsas && (
                    <th
                      onClick={() => handleToggleSort('bolsas')}
                      className={`py-2 px-2.5 font-bold uppercase text-[11px] tracking-wider text-right select-none cursor-pointer transition hover:bg-emerald-900/60 whitespace-nowrap ${sortField === 'bolsas' ? 'text-amber-300' : 'text-white'}`}
                      title={`Ordenar por Bolsas en Stock (${sortField === 'bolsas' ? (sortOrder === 'asc' ? 'Ascendente' : 'Descendente') : 'Clic para ordenar'})`}
                    >
                      <div className="inline-flex items-center gap-1 justify-end">
                        <span>Cantidad bolsas</span>
                        {sortField === 'bolsas' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-amber-300 stroke-[2.5]" /> : <ArrowDown className="w-3.5 h-3.5 text-amber-300 stroke-[2.5]" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-emerald-200/50 hover:text-white" />
                        )}
                      </div>
                    </th>
                  )}

                  {/* 10. Cantidad de kg en stock */}
                  {visibleColumns.stockKg && (
                    <th
                      onClick={() => handleToggleSort('stockKg')}
                      className={`py-2 px-2.5 font-bold uppercase text-[11px] tracking-wider text-right select-none cursor-pointer transition hover:bg-emerald-900/60 whitespace-nowrap ${sortField === 'stockKg' ? 'text-amber-300' : 'text-white'}`}
                      title={`Ordenar por Kg en Stock (${sortField === 'stockKg' ? (sortOrder === 'asc' ? 'Ascendente' : 'Descendente') : 'Clic para ordenar'})`}
                    >
                      <div className="inline-flex items-center gap-1 justify-end">
                        <span>Cantidad kg</span>
                        {sortField === 'stockKg' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-amber-300 stroke-[2.5]" /> : <ArrowDown className="w-3.5 h-3.5 text-amber-300 stroke-[2.5]" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-emerald-200/50 hover:text-white" />
                        )}
                      </div>
                    </th>
                  )}

                  {/* 11. Estado */}
                  {visibleColumns.estado && (
                    <th
                      onClick={() => handleToggleSort('estado')}
                      className={`py-2 px-2.5 font-bold uppercase text-[11px] tracking-wider text-center select-none cursor-pointer transition hover:bg-emerald-900/60 whitespace-nowrap ${sortField === 'estado' ? 'text-amber-300' : 'text-white'}`}
                      title={`Ordenar por Estado (${sortField === 'estado' ? (sortOrder === 'asc' ? 'Ascendente' : 'Descendente') : 'Clic para ordenar'})`}
                    >
                      <div className="inline-flex items-center gap-1 justify-center">
                        <span>Estado</span>
                        {sortField === 'estado' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-amber-300 stroke-[2.5]" /> : <ArrowDown className="w-3.5 h-3.5 text-amber-300 stroke-[2.5]" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-emerald-200/50 hover:text-white" />
                        )}
                      </div>
                    </th>
                  )}

                  {/* 12. Acción */}
                  <th className="py-2 px-2.5 font-bold uppercase text-[11px] tracking-wider text-white text-center whitespace-nowrap">
                    Acción
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 text-xs">
                {paginatedLotes.map((l, index) => (
                  <tr
                    key={l.id}
                    className={
                      index % 2 === 0
                        ? 'bg-white hover:bg-slate-50/80 transition-colors'
                        : 'bg-[#E3EFE7]/30 hover:bg-[#E3EFE7]/60 transition-colors'
                    }
                  >
                    {/* Checkbox de Selección */}
                    <td className="py-2 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedLoteIds.includes(l.id)}
                        onChange={() => toggleSelectLote(l.id)}
                        title="Seleccionar lote"
                        aria-label="Seleccionar lote"
                        className="rounded border-gray-300 text-[#00603C] focus:ring-[#00603C] h-4 w-4 cursor-pointer"
                      />
                    </td>

                    {/* 1. Fecha de alta */}
                    {visibleColumns.fechaAlta && (
                      <td className="py-2 px-2.5 font-mono text-xs text-slate-700 whitespace-nowrap">
                        {formatDateStr(l.fechaIngreso || l.fechaAlta || (l.fechaHoraProduccion ? l.fechaHoraProduccion.split('T')[0] : ''))}
                      </td>
                    )}

                    {/* 2. Cliente */}
                    {visibleColumns.cliente && (
                      <td className="py-2 px-2.5 font-semibold text-slate-900 text-xs whitespace-nowrap max-w-[160px] truncate" title={l.cliente || '—'}>
                        {l.cliente || '—'}
                      </td>
                    )}

                    {/* 3. Especie */}
                    {visibleColumns.especie && (
                      <td className="py-2 px-2.5 text-xs text-slate-700 font-medium whitespace-nowrap">
                        {l.especie || '—'}
                      </td>
                    )}

                    {/* 4. Variedad */}
                    {visibleColumns.variedad && (
                      <td className="py-2 px-2.5 text-xs font-bold text-slate-900 whitespace-nowrap">
                        {l.variedad || '—'}
                      </td>
                    )}

                    {/* 5. Lote (Grande, claro y fácil de visualizar - con edición directa en tabla) */}
                    {visibleColumns.loteId && (
                      <td className="py-2 px-2.5 whitespace-nowrap">
                        {inlineEditingNameId === l.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={inlineEditingNameVal}
                              onChange={(e) => setInlineEditingNameVal(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSaveLoteNameDirect(l);
                                } else if (e.key === 'Escape') {
                                  setInlineEditingNameId(null);
                                }
                              }}
                              autoFocus
                              className="px-2 py-1 text-xs font-black font-mono bg-amber-50 border-2 border-amber-500 rounded focus:outline-none focus:ring-2 focus:ring-emerald-600 text-slate-900 w-36 shadow-xs"
                              placeholder="Nombre lote..."
                            />
                            <button
                              type="button"
                              disabled={isSavingInlineName}
                              onClick={() => handleSaveLoteNameDirect(l)}
                              className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded shadow-xs cursor-pointer"
                              title="Guardar nombre (Enter)"
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </button>
                            <button
                              type="button"
                              disabled={isSavingInlineName}
                              onClick={() => setInlineEditingNameId(null)}
                              className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded shadow-xs cursor-pointer"
                              title="Cancelar (Esc)"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 group/lotename">
                            <span className="text-sm sm:text-base font-black font-mono text-slate-950 px-2.5 py-0.5 bg-amber-200/90 rounded border border-amber-400 shadow-2xs tracking-wider inline-block">
                              {l.loteNro || l.id}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleStartEditLoteName(l)}
                              className="p-1 text-slate-400 hover:text-amber-800 hover:bg-amber-100 rounded transition opacity-60 group-hover/lotename:opacity-100 cursor-pointer"
                              title="Editar nombre de lote desde la tabla"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-amber-700" />
                            </button>
                            {l.estadoRegistro === 'PRE-CARGA' && (
                              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-[9px] rounded font-mono" title="Pre-Carga: Planificado">
                                PRE
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    )}

                    {/* 6. Tipo de lote */}
                    {visibleColumns.tipo && (
                      <td className="py-2 px-2.5 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider border shadow-2xs ${getTipoBadgeStyle(l.tipo)}`}>
                          <Tag className="w-3 h-3 shrink-0" />
                          <span>{l.tipo || 'Final'}</span>
                        </span>
                      </td>
                    )}

                    {/* 7. Tratamiento (Etiqueta Roja para Tratado / Etiqueta Gris para Sin Tratar) */}
                    {visibleColumns.tratamiento && (
                      <td className="py-2 px-2.5 whitespace-nowrap">
                        {isLoteTratado(l) ? (
                          <div className="inline-flex flex-col items-start gap-0.5">
                            <span
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider bg-red-600 hover:bg-red-700 text-white border border-red-700 shadow-2xs transition"
                              title={getLoteProductoTratamiento(l) ? `Tratado con: ${getLoteProductoTratamiento(l)}` : 'Lote Tratado'}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                              <span>TRATADO</span>
                            </span>
                            {getLoteProductoTratamiento(l) && (
                              <span className="text-[10px] text-slate-600 font-bold truncate max-w-[130px] px-0.5" title={getLoteProductoTratamiento(l)!}>
                                {getLoteProductoTratamiento(l)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider bg-slate-200 hover:bg-slate-300 text-slate-700 border border-slate-300 shadow-2xs transition"
                            title="Lote Sin Tratar"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            <span>SIN TRATAR</span>
                          </span>
                        )}
                      </td>
                    )}

                    {/* 8. Categoría */}
                    {visibleColumns.categoria && (
                      <td className="py-2 px-2.5 text-xs font-semibold text-slate-800 whitespace-nowrap">
                        {l.categoria || 'Original'}
                      </td>
                    )}

                    {/* 8. Envase */}
                    {visibleColumns.envase && (
                      <td className="py-2 px-2.5 text-xs text-slate-700 font-medium whitespace-nowrap">
                        {l.envase || (l.kgPorBolsa ? `Bolsa ${l.kgPorBolsa} kg` : 'Bolsa 40 kg')}
                      </td>
                    )}

                    {/* 9. Cantidad de bolsas en stock */}
                    {visibleColumns.bolsas && (
                      <td className="py-2 px-2.5 text-right whitespace-nowrap">
                        <div className="font-mono font-black text-slate-900 text-xs sm:text-sm">
                          {formatNumberArg(l.stockBolsas, 0)} b.
                        </div>
                      </td>
                    )}

                    {/* 10. Cantidad de kg en stock */}
                    {visibleColumns.stockKg && (
                      <td className="py-2 px-2.5 text-right whitespace-nowrap">
                        <div className="font-mono font-bold text-emerald-800 text-xs sm:text-sm">
                          {formatNumberArg(l.stockKg, 0)} kg
                        </div>
                      </td>
                    )}

                    {/* 11. Estado */}
                    {visibleColumns.estado && (
                      <td className="py-2 px-2.5 text-center whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-full border ${getEstadoBadgeStyle(l.estado)}`}>
                          {l.estado}
                        </span>
                      </td>
                    )}

                    {/* 12. Acción */}
                    <td className="py-2 px-2.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Botón Pasar a Realizado (intacto para PRE-CARGA) */}
                        {l.estadoRegistro === 'PRE-CARGA' && (
                          (l.esMovimiento || l.tipoMovimiento || l.loteOrigen || (l.loteNro && l.loteNro.toUpperCase().includes('MOV'))) ? (
                            <button
                              type="button"
                              onClick={() => setLoteToMovRealizado(l)}
                              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-black flex items-center gap-1 shadow-xs transition cursor-pointer border border-blue-500 uppercase tracking-wider shrink-0"
                              title="MOV REALIZADO: Fijar manualmente el día en el que se realizó efectivamente el movimiento"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-white stroke-[2.5]" />
                              <span>MOV REALIZADO</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setLoteToProcess(l)}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-xs transition cursor-pointer shrink-0"
                              title="Pasar a Realizado (Ingresar silos, bolsones y sectores de origen)"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                              <span>Pasar a Realizado</span>
                            </button>
                          )
                        )}

                        {/* Botón Movimiento de Lote */}
                        <button
                          type="button"
                          id={`btn-movimiento-lote-${l.id}`}
                          onClick={() => setLoteToMovimiento(l)}
                          className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-300 rounded-lg text-xs font-black shadow-2xs transition cursor-pointer flex items-center gap-1 shrink-0"
                          title="Movimiento de lote: Intermedio a Final, Intermedio a Final Tratado o Final a Final Tratado"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-700 stroke-[2.5]" />
                          <span className="text-[10px]">Movimiento</span>
                        </button>

                        {/* Botón Editor de Movimiento (cuando el lote fue originado por movimiento o posee movimiento) */}
                        {isMovimientoLote(l) && (
                          <button
                            type="button"
                            id={`btn-editar-movimiento-${l.id}`}
                            onClick={() => setLoteToEditMovimiento(l)}
                            className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-300 rounded-lg text-xs font-black shadow-2xs transition cursor-pointer flex items-center gap-1 shrink-0"
                            title="Editor de Movimiento: Modificar cantidad de bolsas pasadas, movimiento y tratamiento utilizado"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-purple-700 stroke-[2.5]" />
                            <span className="text-[10px]">Editar Mov.</span>
                          </button>
                        )}

                        {/* Botón Editor de Lote (Modificar manualmente cantidad de bolsas de alta, tipo, categoría, nombre) */}
                        <button
                          type="button"
                          id={`btn-editor-lote-${l.id}`}
                          onClick={() => handleOpenQuickEditModal(l)}
                          className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-black shadow-2xs transition cursor-pointer flex items-center gap-1 shrink-0"
                          title="Editor de Lote: Modificar bolsas de alta, tipo, categoría y nombre"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-amber-700" />
                          <span className="text-[10px] hidden sm:inline">Editor</span>
                        </button>

                        {/* Botón Desplegable Opciones: Detalle, Ficha, ID Bolsas */}
                        <div className="relative inline-block text-left">
                          <button
                            type="button"
                            id={`btn-opciones-lote-${l.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveActionDropdownId(prev => prev === l.id ? null : l.id);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 hover:border-slate-400 rounded-lg text-xs font-bold shadow-2xs transition cursor-pointer"
                            title="Opciones del lote"
                          >
                            <span>Opciones</span>
                            <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${activeActionDropdownId === l.id ? 'rotate-180' : ''}`} />
                          </button>

                          {activeActionDropdownId === l.id && (
                            <>
                              <div
                                className="fixed inset-0 z-40"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveActionDropdownId(null);
                                }}
                              />
                              <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in-50 zoom-in-95 text-left">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveActionDropdownId(null);
                                    setLoteToMovimiento(l);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-indigo-900 bg-indigo-50/70 hover:bg-indigo-100 transition text-left cursor-pointer border-b border-indigo-100"
                                >
                                  <ArrowRightLeft className="w-4 h-4 text-indigo-600 stroke-[2.5]" />
                                  <span className="font-bold">Movimiento</span>
                                </button>
                                <button
                                  type="button"
                                  id={`btn-dropdown-editar-movimiento-${l.id}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveActionDropdownId(null);
                                    setLoteToEditMovimiento(l);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-purple-900 bg-purple-50/80 hover:bg-purple-100 transition text-left cursor-pointer border-b border-purple-100"
                                  title="Editar cantidad de bolsas pasadas, movimiento y tratamiento utilizado"
                                >
                                  <Edit3 className="w-4 h-4 text-purple-700 stroke-[2.5]" />
                                  <span className="font-bold">Editor de Movimiento</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveActionDropdownId(null);
                                    handleOpenQuickEditModal(l);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-amber-900 bg-amber-50/50 hover:bg-amber-100 transition text-left cursor-pointer border-b border-amber-100"
                                >
                                  <Edit2 className="w-4 h-4 text-amber-600" />
                                  <span className="font-bold">Editor de Lote</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveActionDropdownId(null);
                                    onSelectLote(l);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 transition text-left cursor-pointer"
                                >
                                  <Eye className="w-4 h-4 text-emerald-600" />
                                  <span>Detalle</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveActionDropdownId(null);
                                    setSelectedFichaLote(l);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 transition text-left cursor-pointer"
                                >
                                  <FileText className="w-4 h-4 text-[#00603C]" />
                                  <span>Ficha</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveActionDropdownId(null);
                                    setSelectedIdBolsasLote(l);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-amber-50 hover:text-amber-900 transition text-left cursor-pointer"
                                >
                                  <Tag className="w-4 h-4 text-amber-600" />
                                  <span>ID Bolsas</span>
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación Vista Tabla */}
          <PaginationControls
            currentPage={currentPage}
            totalPages={Math.ceil(filteredLotes.length / itemsPerPage)}
            totalItems={filteredLotes.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(newSize) => {
              setItemsPerPage(newSize);
              setCurrentPage(1);
            }}
          />
        </div>
      )}
      </div>

      {/* Modal QR Code */}
      {selectedQrLote && (
        <QrCodeModal
          lote={selectedQrLote}
          onClose={() => setSelectedQrLote(null)}
        />
      )}

      {/* Modal para Borrar Stocks (Amilcar Quiroz con clave) */}
      {showWipeModal && (
        <div className="fixed inset-0 bg-[#1A1A1A]/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-red-200 shadow-2xl max-w-md w-full overflow-hidden text-left">
            {/* Header */}
            <div className="bg-red-600 text-white p-5 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-5 h-5 text-[#F6EFDC]" />
                <h3 className="font-serif text-lg font-bold tracking-wide uppercase">
                  Procedimiento de Emergencia
                </h3>
              </div>
              <button
                onClick={() => setShowWipeModal(false)}
                className="text-white hover:text-red-100 p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido */}
            <div className="p-6 space-y-4">
              <div className="bg-red-50 border-l-4 border-red-600 p-4 rounded-r-xl">
                <h4 className="text-xs font-bold text-red-800 uppercase tracking-wider">
                  ⚠️ ¡Atención Amilcar!
                </h4>
                <p className="text-xs text-red-700 mt-1 leading-relaxed">
                  Está a punto de <strong>borrar por completo toda la información de los lotes y sus existencias de stock</strong> en la planta. 
                </p>
                <p className="text-[11px] text-red-600 mt-2 italic">
                  Esta acción es irreversible y eliminará definitivamente todos los registros, procediendo al borrado físico de cada lote de la base de datos de Firestore. No quedará información histórica ni stock.
                </p>
              </div>

              {wipeError && (
                <div className="bg-[#F5E5DC] text-[#A0522D] p-3 rounded-lg text-xs font-semibold border border-red-100">
                  {wipeError}
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#1A1A1A]">
                  Clave de Operación Autorizada *
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                    <KeyRound className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    value={wipePassword}
                    onChange={(e) => setWipePassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                    placeholder="Ingrese su clave secreta"
                    required
                  />
                </div>
                <p className="text-[10px] text-gray-400">
                  Ingrese su clave de supervisor autorizada para continuar con la operación de emergencia.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 p-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowWipeModal(false)}
                className="px-4 py-2 text-xs font-semibold font-sans uppercase tracking-wider text-gray-500 hover:bg-gray-100 rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  setWipeError('');
                  const cleanPass = wipePassword.trim();
                  if (cleanPass === 'amilcar2026' || cleanPass === 'abacus2026' || cleanPass === 'amilcar123') {
                    setIsWiping(true);
                    try {
                      await onWipeStocks();
                      setShowWipeModal(false);
                    } catch (err) {
                      setWipeError('Error al procesar el vaciado de stock en el servidor.');
                    } finally {
                      setIsWiping(false);
                    }
                  } else {
                    setWipeError('Clave incorrecta. Acceso denegado.');
                  }
                }}
                disabled={isWiping}
                className="px-5 py-2 text-xs font-semibold font-sans uppercase tracking-wider bg-red-600 text-white hover:bg-red-700 rounded-lg transition shadow-sm flex items-center gap-1.5"
              >
                {isWiping ? (
                  <span className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></span>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Confirmar Vaciado</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Eliminación de Lote Individual */}
      <ConfirmationDialog
        isOpen={Boolean(loteToDelete)}
        title={loteToDelete ? `Eliminar Lote ${loteToDelete.loteNro || loteToDelete.id}` : 'Eliminar Lote'}
        variant="danger"
        confirmText="Eliminar Lote"
        cancelText="Cancelar"
        description="¿Está seguro de que desea eliminar permanentemente este lote de semilla? Esta acción es irreversible y borrará toda su información de la base de datos."
        onClose={() => setLoteToDelete(null)}
        onConfirm={() => {
          if (loteToDelete) {
            onDeleteLote(loteToDelete.id);
            setLoteToDelete(null);
          }
        }}
      >
        {loteToDelete && (
          <div className="bg-rose-50/70 rounded-xl border border-rose-100 p-4 space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="px-2 py-0.5 bg-[#C9922E] text-white text-[10px] font-mono font-black rounded">
                LOTE: {loteToDelete.loteNro}
              </span>
              <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${getEstadoBadgeStyle(loteToDelete.estado)}`}>
                {loteToDelete.estado}
              </span>
            </div>
            <div className="text-xs text-slate-500 font-semibold font-mono">
              ID: {loteToDelete.id}
            </div>
            <div className="border-t border-rose-100/60 pt-2 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-400 block text-[9px] uppercase font-bold">Cliente</span>
                <span className="font-semibold text-slate-800 truncate block">{loteToDelete.cliente}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px] uppercase font-bold">Especie / Variedad</span>
                <span className="font-semibold text-slate-800 truncate block">{loteToDelete.especie} {loteToDelete.variedad}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px] uppercase font-bold">Bolsas</span>
                <span className="font-bold text-slate-800">{formatNumberArg(loteToDelete.stockBolsas)}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px] uppercase font-bold">Kilogramos</span>
                <span className="font-bold text-[#00603C]">{formatKg(loteToDelete.stockKg)}</span>
              </div>
            </div>
          </div>
        )}
      </ConfirmationDialog>

      {/* Modal de Confirmación de Eliminación Múltiple de Lotes */}
      <ConfirmationDialog
        isOpen={showBatchDeleteDialog}
        title={`Eliminar ${selectedLoteIds.length} ${selectedLoteIds.length === 1 ? 'Lote Seleccionado' : 'Lotes Seleccionados'}`}
        variant="danger"
        confirmText={`Eliminar ${selectedLoteIds.length} ${selectedLoteIds.length === 1 ? 'Lote' : 'Lotes'}`}
        cancelText="Cancelar"
        description="Esta acción es irreversible y eliminará definitivamente los lotes seleccionados junto con sus registros de stock."
        requireConfirmationText="confirmo eliminacion"
        confirmationPlaceholder='Escriba "confirmo eliminacion"'
        onClose={() => setShowBatchDeleteDialog(false)}
        onConfirm={() => {
          onDeleteMultipleLotes(selectedLoteIds);
          setSelectedLoteIds([]);
          setShowBatchDeleteDialog(false);
        }}
      >
        <div className="bg-rose-50/70 rounded-xl border border-rose-100 p-3.5 space-y-2 text-xs">
          <div className="grid grid-cols-2 gap-2 text-slate-700 font-medium">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total de Lotes</span>
              <span className="text-base font-black text-rose-700">{selectedLoteIds.length}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total de Bolsas</span>
              <span className="text-base font-black text-slate-900">
                {formatNumberArg(lotes.filter(l => selectedLoteIds.includes(l.id)).reduce((acc, l) => acc + (Number(l.stockBolsas) || 0), 0))} u.
              </span>
            </div>
          </div>
          <div className="text-[11px] text-slate-500 font-mono border-t border-rose-200/50 pt-2 truncate">
            Lotes: {lotes.filter(l => selectedLoteIds.includes(l.id)).map(l => l.loteNro || l.id).join(', ')}
          </div>
        </div>
      </ConfirmationDialog>

      {/* Modal Configuración de Límites */}
      {showLimitsModal && (
        <LoteLimitsConfigModal
          currentConfig={loteLimits}
          onSave={(newLimits) => {
            if (onUpdateLoteLimits) {
              onUpdateLoteLimits(newLimits);
            }
            setShowLimitsModal(false);
          }}
          onClose={() => setShowLimitsModal(false)}
        />
      )}

      {/* Modal Procesar Lote (Pasar a Realizado) */}
      {(loteToProcess || lotesToProcessBatch.length > 0) && (
        <ProcesarLoteModal
          isOpen={Boolean(loteToProcess || lotesToProcessBatch.length > 0)}
          lote={loteToProcess}
          lotesToProcess={lotesToProcessBatch}
          siloStocks={siloStocks}
          movimientosSilo={movimientosSilo}
          bolsones={bolsones}
          loteLimits={loteLimits}
          onConfirm={(resultado) => {
            const updatedList = Array.isArray(resultado) ? resultado : [resultado];
            if (onBatchUpdateLotes) {
              onBatchUpdateLotes(updatedList);
            } else if (onSaveLote) {
              updatedList.forEach(l => onSaveLote(l));
            }
            setLoteToProcess(null);
            setLotesToProcessBatch([]);
            setSelectedLoteIds([]);
          }}
          onClose={() => {
            setLoteToProcess(null);
            setLotesToProcessBatch([]);
          }}
        />
      )}

      {/* Modal Edición Masiva */}
      {showBulkEditModal && (
        <BulkEditLotesModal
          isOpen={showBulkEditModal}
          selectedLotes={lotes.filter(l => selectedLoteIds.includes(l.id))}
          clientes={clientes}
          especies={especies}
          onConfirm={(updatedLotes) => {
            if (onBatchUpdateLotes) {
              onBatchUpdateLotes(updatedLotes);
            } else if (onSaveLote) {
              updatedLotes.forEach(l => onSaveLote(l));
            }
            setShowBulkEditModal(false);
            setSelectedLoteIds([]);
          }}
          onClose={() => setShowBulkEditModal(false)}
        />
      )}

      {/* Modal Generador y Vista Previa de Etiquetas ID Bolsas (Individual o Por Lotes Múltiples) */}
      {(selectedIdBolsasLote || (batchIdBolsasLotes && batchIdBolsasLotes.length > 0)) && (
        <BatchPrintIdBolsasModal
          isOpen={Boolean(selectedIdBolsasLote || (batchIdBolsasLotes && batchIdBolsasLotes.length > 0))}
          lotes={selectedIdBolsasLote ? [selectedIdBolsasLote] : batchIdBolsasLotes || []}
          onClose={() => {
            setSelectedIdBolsasLote(null);
            setBatchIdBolsasLotes(null);
          }}
        />
      )}

      {/* Modal Ficha Técnica Oficial (A4) del Lote Individual */}
      {selectedFichaLote && (
        <ImprimirFichaTecnica
          isOpen={Boolean(selectedFichaLote)}
          lote={selectedFichaLote}
          onClose={() => setSelectedFichaLote(null)}
          onSaveLote={onSaveLote}
        />
      )}

      {/* Modal Fichas Técnicas (A4) de Lotes Seleccionados */}
      {batchFichasLotes && batchFichasLotes.length > 0 && (
        <BatchPrintLotesModal
          isOpen={Boolean(batchFichasLotes && batchFichasLotes.length > 0)}
          lotes={batchFichasLotes}
          onClose={() => setBatchFichasLotes(null)}
        />
      )}

      {/* Modal Tratar / Curar Semilla */}
      {loteToTratar && (
        <TratarLoteModal
          isOpen={Boolean(loteToTratar)}
          lote={loteToTratar}
          allLotes={lotes}
          onClose={() => setLoteToTratar(null)}
          onConfirmTratamiento={(params) => {
            setLoteToTratar(null);
            handleConfirmTratamiento(params);
          }}
        />
      )}

      {/* Modal Movimiento de Lote (1- Intermedio a Final, 2- Intermedio a Final Tratado, 3- Final a Final Tratado) */}
      {loteToMovimiento && (
        <MovimientoLoteModal
          isOpen={Boolean(loteToMovimiento)}
          lote={loteToMovimiento}
          allLotes={lotes}
          plantaConfig={plantaConfig}
          currentUser={currentUser}
          onClose={() => setLoteToMovimiento(null)}
          onConfirmMovimiento={handleConfirmMovimiento}
        />
      )}

      {/* Modal Editor de Movimiento (modificar bolsas pasadas, movimiento y tratamiento utilizado) */}
      {loteToEditMovimiento && (
        <EditarMovimientoModal
          isOpen={Boolean(loteToEditMovimiento)}
          lote={loteToEditMovimiento}
          allLotes={lotes}
          plantaConfig={plantaConfig}
          currentUser={currentUser}
          onClose={() => setLoteToEditMovimiento(null)}
          onConfirmEditMovimiento={handleConfirmEditMovimiento}
        />
      )}

      {/* Modal Lotes Integrantes del Filtro Seleccionado */}
      {showLotesIntegrantesModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" id="modal-lotes-integrantes">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden text-left">
            {/* Header */}
            <div className="bg-[#00603C] text-white p-5 flex justify-between items-center border-b border-emerald-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-amber-300">
                  <ListFilter className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold tracking-wide">
                    Lotes Integrantes del Cálculo
                  </h3>
                  <p className="text-xs text-emerald-200">
                    Mostrando {filteredLotes.length} lotes según los filtros en cascada aplicados
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLotesIntegrantesModal(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Resumen Superior en el Modal */}
            <div className="bg-[#F8F9FA] p-4 border-b border-gray-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-white p-2.5 rounded-xl border border-gray-200 shadow-2xs">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Lotes Totales</span>
                <span className="text-base font-bold text-slate-800">{filteredLotes.length}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-gray-200 shadow-2xs">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Bolsas Totales</span>
                <span className="text-base font-bold text-emerald-700">
                  {formatNumberArg(filteredLotes.reduce((acc, l) => acc + (Number(l.stockBolsas) || 0), 0), 0)}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-gray-200 shadow-2xs">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Kilos Totales</span>
                <span className="text-base font-bold text-[#C9922E]">
                  {formatNumberArg(filteredLotes.reduce((acc, l) => acc + (Number(l.stockKg) || 0), 0), 0)} kg
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-gray-200 shadow-2xs">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Toneladas</span>
                <span className="text-base font-bold text-slate-700">
                  {(filteredLotes.reduce((acc, l) => acc + (Number(l.stockKg) || 0), 0) / 1000).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Tn
                </span>
              </div>
            </div>

            {/* Tabla de Lotes con scroll */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredLotes.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">
                  No hay lotes que coincidan con los filtros seleccionados.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-gray-50 text-gray-700 font-bold uppercase tracking-wider text-[10px] border-b border-gray-200">
                      <tr>
                        <th className="py-2.5 px-3">Lote N°</th>
                        <th className="py-2.5 px-3">Cliente</th>
                        <th className="py-2.5 px-3">Especie / Variedad</th>
                        <th className="py-2.5 px-3 text-right">Bolsas</th>
                        <th className="py-2.5 px-3 text-right">Kilos (kg)</th>
                        <th className="py-2.5 px-3 text-center">Estado Reg.</th>
                        <th className="py-2.5 px-3 text-center">Disponibilidad</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-sans">
                      {filteredLotes.map((lote) => (
                        <tr key={`modal-lote-${lote.id}`} className="hover:bg-emerald-50/40 transition">
                          <td className="py-2.5 px-3 font-mono font-bold text-[#00603C]">
                            {lote.loteNro || lote.id}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800 truncate max-w-[140px]">
                            {lote.cliente}
                          </td>
                          <td className="py-2.5 px-3 text-gray-700">
                            {lote.especie} - {lote.variedad}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                            {formatNumberArg(lote.stockBolsas, 0)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                            {formatKg(lote.stockKg)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-extrabold ${lote.estadoRegistro === 'PRE-CARGA' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                              {lote.estadoRegistro || 'REALIZADO'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold ${getEstadoBadgeStyle(lote.estado)}`}>
                              {lote.estado}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-gray-50 p-4 border-t border-gray-200 flex justify-between items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const list = filteredLotes.map(l => l.loteNro || l.id).filter(Boolean).join(', ');
                  navigator.clipboard.writeText(list);
                  setCopiedLotesSuccess(true);
                  setTimeout(() => setCopiedLotesSuccess(false), 2500);
                }}
                disabled={filteredLotes.length === 0}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-gray-100 border border-gray-200 rounded-xl transition shadow-2xs cursor-pointer disabled:opacity-50"
              >
                {copiedLotesSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700 font-bold">¡Lotes Copiados!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-gray-500" />
                    <span>Copiar Lista de Lotes</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowLotesIntegrantesModal(false)}
                className="px-5 py-2 text-xs font-bold font-sans uppercase tracking-wider bg-[#00603C] text-white hover:bg-[#254731] rounded-xl transition shadow-2xs cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal MOV REALIZADO: Fijar manualmente el día en el que se realizó efectivamente el movimiento precargado */}
      {(loteToMovRealizado || lotesToMovRealizadoBatch.length > 0) && (
        <MovRealizadoModal
          isOpen={Boolean(loteToMovRealizado || lotesToMovRealizadoBatch.length > 0)}
          lote={loteToMovRealizado}
          lotesToProcess={lotesToMovRealizadoBatch}
          onConfirm={(resultado) => {
            const updatedList = Array.isArray(resultado) ? resultado : [resultado];
            if (onBatchUpdateLotes) {
              onBatchUpdateLotes(updatedList);
            } else if (onSaveLote) {
              updatedList.forEach(l => onSaveLote(l));
            }
            setLoteToMovRealizado(null);
            setLotesToMovRealizadoBatch([]);
            setSelectedLoteIds([]);
            setRefreshToast('Movimiento registrado y stock actualizado con fecha efectiva.');
            setTimeout(() => setRefreshToast(null), 3500);
          }}
          onClose={() => {
            setLoteToMovRealizado(null);
            setLotesToMovRealizadoBatch([]);
          }}
        />
      )}

      {/* Modal de Edición Rápida en la Misma Vista (para Cards / Vista General) */}
      {quickEditModalLote && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-[#00603C] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-400 text-slate-950 rounded-lg shadow-xs">
                  <Edit2 className="w-5 h-5 text-slate-950 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base font-black font-sans tracking-wide">Editor de Lote</h3>
                  <p className="text-xs text-emerald-200">
                    Editar manualmente cantidad de alta de bolsas, tipo, categoría y nombre
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setQuickEditModalLote(null);
                  setInlineSaveError(null);
                }}
                className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <div className="p-5 space-y-4">
              {/* Información Fija de Referencia */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-wrap gap-4 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Cliente</span>
                  <span className="font-extrabold text-slate-800">{quickEditModalLote.cliente || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Variedad / Especie</span>
                  <span className="font-extrabold text-slate-800">{quickEditModalLote.variedad || '—'} {quickEditModalLote.especie ? `(${quickEditModalLote.especie})` : ''}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Peso por Bolsa</span>
                  <span className="font-extrabold text-slate-800 font-mono">{quickEditModalLote.kgPorBolsa || 40} kg/b</span>
                </div>
              </div>

              {/* 1. Nombre de Lote */}
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 block mb-1">
                  Nombre de Lote:
                </label>
                <input
                  type="text"
                  id="quick-edit-nombre-lote"
                  value={inlineEditData.loteNro}
                  onChange={(e) => setInlineEditData(prev => ({ ...prev, loteNro: e.target.value }))}
                  className="w-full px-3 py-2 text-sm font-bold font-mono text-slate-900 bg-white border-2 border-slate-300 focus:border-amber-400 focus:ring-2 focus:ring-emerald-600 rounded-xl outline-none shadow-xs"
                  placeholder="Ej: LOTE-2026-001"
                />
              </div>

              {/* 2. Cantidad de Bolsas dadas de alta */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Cantidad de Bolsas dadas de alta:
                  </label>
                  <span className="text-xs font-mono font-bold text-emerald-800">
                    = {formatNumberArg(inlineEditData.stockBolsas * (quickEditModalLote.kgPorBolsa || 40), 0)} kg
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    id="quick-edit-bolsas-lote"
                    min="0"
                    step="1"
                    value={inlineEditData.stockBolsas}
                    onChange={(e) => setInlineEditData(prev => ({ ...prev, stockBolsas: Math.max(0, parseInt(e.target.value) || 0) }))}
                    className="w-full px-3 py-2 text-sm font-bold font-mono text-slate-900 bg-white border-2 border-slate-300 focus:border-amber-400 focus:ring-2 focus:ring-emerald-600 rounded-xl outline-none shadow-xs pr-16"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400 pointer-events-none">
                    bolsas
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 3. Tipo */}
                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 block mb-1">
                    Tipo de Lote:
                  </label>
                  <select
                    id="quick-edit-tipo-lote"
                    value={inlineEditData.tipo}
                    onChange={(e) => setInlineEditData(prev => ({ ...prev, tipo: e.target.value as TipoLoteType }))}
                    className="w-full px-3 py-2 text-xs font-black text-slate-800 bg-white border-2 border-slate-300 focus:border-amber-400 focus:ring-2 focus:ring-emerald-600 rounded-xl outline-none shadow-xs cursor-pointer"
                  >
                    {(plantaConfig?.tipos && plantaConfig.tipos.length > 0
                      ? plantaConfig.tipos
                      : ['Final', 'Intermedio', 'Procesado', 'Semilla', 'Descarte', 'Bajo Consumo', 'Mezcla', 'Rechazo']
                    ).map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* 4. Categoría */}
                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 block mb-1">
                    Categoría:
                  </label>
                  <select
                    id="quick-edit-categoria-lote"
                    value={inlineEditData.categoria}
                    onChange={(e) => setInlineEditData(prev => ({ ...prev, categoria: e.target.value }))}
                    className="w-full px-3 py-2 text-xs font-black text-slate-800 bg-white border-2 border-slate-300 focus:border-amber-400 focus:ring-2 focus:ring-emerald-600 rounded-xl outline-none shadow-xs cursor-pointer"
                  >
                    {categoriasParaEditor.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 5. Estado de Lote */}
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 block mb-1">
                  Estado de Lote:
                </label>
                <select
                  id="quick-edit-estado-lote"
                  value={inlineEditData.estado}
                  onChange={(e) => setInlineEditData(prev => ({ ...prev, estado: e.target.value as EstadoLoteType }))}
                  className="w-full px-3 py-2 text-xs font-black text-slate-800 bg-white border-2 border-slate-300 focus:border-amber-400 focus:ring-2 focus:ring-emerald-600 rounded-xl outline-none shadow-xs cursor-pointer"
                >
                  <option value="Disponible">Disponible</option>
                  <option value="Reservado">Reservado</option>
                  <option value="Agotado">Agotado</option>
                  <option value="A Consumo">A Consumo</option>
                </select>
              </div>

              {inlineSaveError && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs font-bold text-rose-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{inlineSaveError}</span>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setQuickEditModalLote(null);
                  setInlineSaveError(null);
                }}
                disabled={isSavingInline}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleSaveInlineEdit(quickEditModalLote)}
                disabled={isSavingInline}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-black tracking-wider uppercase shadow-sm transition cursor-pointer border border-emerald-600 disabled:opacity-50"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>{isSavingInline ? 'Guardando...' : 'Guardar Cambios'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
