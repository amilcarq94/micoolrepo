/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Lote, EstadoLoteType, TipoLoteType, OrdenProceso, MovimientoSilo, LoteLimitsConfig, PlantaConfig } from '../types';
import { formatNumberArg, formatKg, formatDateStr } from '../utils/formatters';
import { Search, Grid, List, Plus, Filter, Eye, Edit2, ArrowDownRight, Trash2, QrCode, Download, Lock, ShieldAlert, KeyRound, X, Flame, Warehouse, Layers, Info, SlidersHorizontal, Check, Pin, RotateCcw, ChevronDown, Package, Sprout, Clock, CheckCircle2, BarChart2, Building2, Tag, FlaskConical, PieChart, Wheat, Sliders, PackagePlus, RefreshCw, FileText, ListFilter, Copy, Scale, FileSpreadsheet, Calendar } from 'lucide-react';
import { BatchPrintIdBolsasModal } from './BatchPrintIdBolsasModal';
import { ImprimirFichaTecnica } from './ImprimirFichaTecnica';
import { QrCodeModal } from './QrCodeModal';
import { LoteLimitsConfigModal } from './LoteLimitsConfigModal';
import { ProcesarLoteModal } from './ProcesarLoteModal';
import { MovRealizadoModal } from './MovRealizadoModal';
import { BulkEditLotesModal } from './BulkEditLotesModal';
import { TratarLoteModal } from './TratarLoteModal';
import { PaginationControls } from './PaginationControls';
import { SiloId, BolsonCampo } from '../types';
import { LotesUnifiedDashboard } from './LotesUnifiedDashboard';
import { ConfirmationDialog } from './ConfirmationDialog';

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
  ordenesProceso?: OrdenProceso[];
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
  ordenesProceso,
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
    numeroOrdenMovimiento,
    productoQuimico,
    loteExistenteT
  }: {
    loteOriginal: Lote;
    bolsasACurar: number;
    fechaTratamiento: string;
    numeroOrdenMovimiento: string;
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
        detalle: `Salida por movimiento: Curado por OM ${numeroOrdenMovimiento} -> enviado a Lote ${loteExistenteT.loteNro}`
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
            descripcion: `Salida por movimiento: Egreso por Curado de ${bolsasACurar} bolsas hacia Lote ${loteExistenteT.loteNro}. OM: ${numeroOrdenMovimiento}`
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
        detalle: `Ingreso por Curado desde Lote ${loteOriginal.loteNro} - OM: ${numeroOrdenMovimiento}`
      };

      const nuevasBolsasT = (loteExistenteT.stockBolsas || 0) + bolsasACurar;
      const nuevosKgT = (loteExistenteT.stockKg || 0) + kgACurar;

      const loteTActualizado: Lote = {
        ...loteExistenteT,
        stockBolsas: nuevasBolsasT,
        stockKg: nuevosKgT,
        estado: 'Disponible',
        fechaTratamiento,
        numeroOrdenMovimiento: numeroOrdenMovimiento || loteExistenteT.numeroOrdenMovimiento,
        producto: productoQuimico || loteExistenteT.producto,
        historial: [ingresoMov, ...(loteExistenteT.historial || [])],
        auditoria: [
          {
            id: `AUD-ING-TRAT-${Date.now()}`,
            fechaHora: new Date().toISOString(),
            tipo: 'Edición',
            usuario: currentUser.nombre,
            descripcion: `Ingreso por Curado de ${bolsasACurar} bolsas desde Lote ${loteOriginal.loteNro}. OM: ${numeroOrdenMovimiento}`
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
          numeroOrdenMovimiento,
          producto: productoQuimico || 'Maxim Quattro + Inoculante',
          auditoria: [
            {
              id: `AUD-TRAT-TOTAL-${Date.now()}`,
              fechaHora: new Date().toISOString(),
              tipo: 'Edición',
              usuario: currentUser.nombre,
              descripcion: `Curado total. Lote renombrado a ${nuevoNombreT}. OM: ${numeroOrdenMovimiento}`
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
              descripcion: `Salida por movimiento: Desdoblamiento por Curado de ${bolsasACurar} bolsas hacia Lote ${loteOriginal.loteNro}T. OM: ${numeroOrdenMovimiento}`
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
          detalle: `Origen: Curado parcial de ${loteOriginal.loteNro} - OM: ${numeroOrdenMovimiento}`
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
          numeroOrdenMovimiento,
          historial: [ingresoMovT],
          auditoria: [
            {
              id: `AUD-CRE-T-${Date.now()}`,
              fechaHora: new Date().toISOString(),
              tipo: 'Creación',
              usuario: currentUser.nombre,
              descripcion: `Creación por Curado Parcial (${bolsasACurar} bolsas) desde Lote ${loteOriginal.loteNro}. OM: ${numeroOrdenMovimiento}`
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
  // Constante para almacenamiento persistente del filtro fijado
  const PIN_STORAGE_KEY = 'agroabacus_pinned_lotes_filters_v2';

  // Cargar estado inicial fijado desde localStorage
  const getInitialFilterState = () => {
    try {
      const saved = localStorage.getItem(PIN_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          isPinned: Boolean(parsed.isPinned),
          search: typeof parsed.search === 'string' ? parsed.search : '',
          filterClientes: Array.isArray(parsed.filterClientes) ? parsed.filterClientes : [],
          filterEspecies: Array.isArray(parsed.filterEspecies) ? parsed.filterEspecies : [],
          filterVariedades: Array.isArray(parsed.filterVariedades) ? parsed.filterVariedades : [],
          filterTipos: Array.isArray(parsed.filterTipos) ? parsed.filterTipos : [],
          filterCategorias: Array.isArray(parsed.filterCategorias) ? parsed.filterCategorias : [],
          filterTratamientos: Array.isArray(parsed.filterTratamientos) ? parsed.filterTratamientos : [],
          filterEstados: Array.isArray(parsed.filterEstados) ? parsed.filterEstados : [],
          filterAlas: Array.isArray(parsed.filterAlas) ? parsed.filterAlas : [],
          filterSectores: Array.isArray(parsed.filterSectores) ? parsed.filterSectores : [],
        };
      }
    } catch (e) {
      console.error('Error al cargar filtros fijados:', e);
    }
    return {
      isPinned: false,
      search: '',
      filterClientes: [],
      filterEspecies: [],
      filterVariedades: [],
      filterTipos: [],
      filterCategorias: [],
      filterTratamientos: [],
      filterEstados: [],
      filterAlas: [],
      filterSectores: [],
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
  const [filterEstadoRegistro, setFilterEstadoRegistro] = useState<'TODOS' | 'REALIZADO' | 'PRE-CARGA'>('TODOS');
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
  
  // Estado para tipo de vista (tarjetas, tabla o mapa de calor) - Por defecto vista tabla
  const [viewType, setViewType] = useState<'grid' | 'table' | 'heatmap'>('table');
  const [selectedHeatmapCell, setSelectedHeatmapCell] = useState<{ ala: string; sector: string } | null>(null);

  // Estado para las columnas visibles en la vista de tabla (N° de lote, Cliente, Variedad, Tipo, Tratamiento, Cantidad de bolsas, Estado)
  const [visibleColumns, setVisibleColumns] = useState({
    loteId: true,
    cliente: true,
    variedad: true,
    tipo: true,
    tratamiento: true,
    bolsas: true,
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

  // Estados de Paginación de la Tabla de Lotes
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Reset de página al cambiar filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterClientes, filterEspecies, filterVariedades, filterTipos, filterCategorias, filterTratamientos, filterEstados, filterAlas, filterSectores]);

  // Guardar en localStorage cuando se fija o cuando cambian los filtros estando fijados
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
        filterAlas,
        filterSectores,
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
    filterAlas,
    filterSectores,
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
    const fromContext = lotesContextoCliente.map(l => l.variedad).filter(Boolean) as string[];
    if (fromContext.length > 0) {
      return Array.from(new Set(fromContext)).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    }
    const base = plantaConfig?.variedades || [];
    const fromLotes = lotes.map(l => l.variedad).filter(Boolean) as string[];
    return Array.from(new Set([...base, ...fromLotes])).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [lotesContextoCliente, lotes, plantaConfig]);

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
    const fromContext = lotesContextoCliente.map(l => l.categoria).filter(Boolean) as string[];
    if (fromContext.length > 0) {
      return Array.from(new Set(fromContext)).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    }
    const base = plantaConfig?.categorias || ['Fundadora', 'PreBase', 'Original', 'Primera Multiplicación (PRIMU)'];
    const fromLotes = lotes.map(l => l.categoria).filter(Boolean) as string[];
    return Array.from(new Set([...base, ...fromLotes])).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [lotesContextoCliente, lotes, plantaConfig]);

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

  // Lotes paginados según página y tamaño seleccionados
  const paginatedLotes = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredLotes.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredLotes, currentPage, itemsPerPage]);

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

      // Resolver vinculación a Orden, Silo y Bolsón de Origen
      const linkedOp = ordenesProceso?.find(
        o => o.id === l.ordenProcesoId || o.numeroOrden === l.ordenProcesoId
      );
      const ordenProcesoMovStr = linkedOp
        ? linkedOp.tipoOrden === 'MOVIMIENTO'
          ? (linkedOp.numeroOrdenMovimiento || `OM-${linkedOp.numeroOrden}`)
          : `OP-${linkedOp.numeroOrden}`
        : l.numeroOrdenMovimiento
        ? l.numeroOrdenMovimiento
        : l.ordenProcesoId
        ? `OP-${l.ordenProcesoId}`
        : 'Sin dato';

      const siloOrigenStr = l.siloOrigen
        ? String(l.siloOrigen)
        : l.silosOrigen && l.silosOrigen.length > 0
        ? l.silosOrigen.map(s => s.siloId).join(', ')
        : linkedOp?.silosOrigen && linkedOp.silosOrigen.length > 0
        ? linkedOp.silosOrigen.map(s => s.siloId).join(', ')
        : 'Sin dato';

      const targetSilos = new Set<string>();
      if (l.siloOrigen) targetSilos.add(String(l.siloOrigen));
      if (l.silosOrigen) l.silosOrigen.forEach(s => targetSilos.add(s.siloId));
      if (linkedOp?.silosOrigen) linkedOp.silosOrigen.forEach(s => targetSilos.add(s.siloId));

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
          (linkedOp as any)?.numeroBolsonOrigen ||
          (linkedOp as any)?.bolsonOrigenNro ||
          ingresoPrevioSilo?.bolsonOrigenNro ||
          'Sin dato';
      }

      if (sectorBolsonOrigenStr === '—') {
        sectorBolsonOrigenStr =
          l.sectorBolsonOrigen ||
          (linkedOp as any)?.bolsonOrigenSector ||
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
        'N° Orden de Proceso / Movimiento': ordenProcesoMovStr,
        'Silo de origen': siloOrigenStr,
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
    // Columnas: "Fecha de MOV realizado" / "Cliente" / "Especie" / "Variedad" / "Número de lote" / "Bolsas realizadas" / "Kg por bolsa" / "Stock total" / "Tipo de lote" / "Categoría" / "Tratamiento" / "N° Orden DE MovimientO" / "Producto Aplicado / Principio Activo"
    const lotesMovData = targetMovRealizados.map(l => {
      const fechaRealizadaStr = l.fechaRealizacionMovimiento || l.fechaMovimiento || l.fechaIngreso || l.fechaHoraProduccion?.split('T')[0] || '—';
      const bolsas = Number(l.stockBolsas) || 0;
      const kgBolsa = Number(l.kgPorBolsa) || 800;
      const stockTotal = Number(l.stockKg) > 0 ? Number(l.stockKg) : (bolsas * kgBolsa);

      let tratamientoStr = Array.isArray(l.tratamiento) ? l.tratamiento.join(', ') : (l.tratamiento || 'Original');
      if ((l.tipoMovimiento || '').toLowerCase().includes('tratado') && !tratamientoStr.toLowerCase().includes('tratado')) {
        tratamientoStr = 'Tratado';
      }

      const numOrdenMov = l.numeroOrdenMovimiento || l.ordenMovimientoId || l.ordenProceso || l.numeroOrdenProceso || '—';
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
        'N° Orden DE MovimientO': numOrdenMov,
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
      'N° Orden de Proceso / Movimiento',
      'Silo de origen',
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

      const linkedOp = ordenesProceso?.find(
        o => o.id === l.ordenProcesoId || o.numeroOrden === l.ordenProcesoId
      );
      const ordenProcesoMovStr = linkedOp
        ? linkedOp.tipoOrden === 'MOVIMIENTO'
          ? (linkedOp.numeroOrdenMovimiento || `OM-${linkedOp.numeroOrden}`)
          : `OP-${linkedOp.numeroOrden}`
        : l.numeroOrdenMovimiento
        ? l.numeroOrdenMovimiento
        : l.ordenProcesoId
        ? `OP-${l.ordenProcesoId}`
        : 'Sin dato';

      const siloOrigenStr = l.siloOrigen
        ? String(l.siloOrigen)
        : l.silosOrigen && l.silosOrigen.length > 0
        ? l.silosOrigen.map(s => s.siloId).join(', ')
        : linkedOp?.silosOrigen && linkedOp.silosOrigen.length > 0
        ? linkedOp.silosOrigen.map(s => s.siloId).join(', ')
        : 'Sin dato';

      const targetSilosCsv = new Set<string>();
      if (l.siloOrigen) targetSilosCsv.add(String(l.siloOrigen));
      if (l.silosOrigen) l.silosOrigen.forEach(s => targetSilosCsv.add(s.siloId));
      if (linkedOp?.silosOrigen) linkedOp.silosOrigen.forEach(s => targetSilosCsv.add(s.siloId));

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
          (linkedOp as any)?.numeroBolsonOrigen ||
          (linkedOp as any)?.bolsonOrigenNro ||
          ingresoPrevioSiloCsv?.bolsonOrigenNro ||
          'Sin dato';
      }

      if (sectorBolsonOrigenStr === '—') {
        sectorBolsonOrigenStr =
          l.sectorBolsonOrigen ||
          (linkedOp as any)?.bolsonOrigenSector ||
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
        ordenProcesoMovStr,
        siloOrigenStr,
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

  // Calcular Datos del Mapa de Calor para el acopio
  const alas = ['A', 'B', 'C', 'D'];
  const sectores = ['1', '2', '3'];

  const cellsData: Array<{
    ala: string;
    sector: string;
    totalKg: number;
    totalBolsas: number;
    lotesCount: number;
    species: string[];
    lotes: Lote[];
  }> = [];

  for (const a of alas) {
    for (const s of sectores) {
      const cellLotes = lotes.filter(l => l.ala === a && l.sector === s);
      const totalKg = cellLotes.reduce((sum, l) => sum + (l.stockKg || 0), 0);
      const totalBolsas = cellLotes.reduce((sum, l) => sum + (l.stockBolsas || 0), 0);
      const species = Array.from(new Set(cellLotes.map(l => l.especie).filter((e): e is string => typeof e === 'string'))) as string[];
      cellsData.push({
        ala: a,
        sector: s,
        totalKg,
        totalBolsas,
        lotesCount: cellLotes.length,
        species,
        lotes: cellLotes,
      });
    }
  }

  const maxCellKg = Math.max(...cellsData.map(c => c.totalKg), 1);

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

        {/* Grid de Controles de Filtrado Múltiple en Cascada */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3">
          
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

          {/* Filtro Cliente (Multi) */}
          <MultiSelectDropdown
            id="select-filtro-cliente"
            label="Cliente"
            options={clientesDisponibles}
            selectedValues={filterClientes}
            onChange={setFilterClientes}
            getOptionCount={(cl) => {
              const normCl = normalizeCliente(cl);
              return lotes.filter(l => {
                const normL = normalizeCliente(l.cliente);
                return normL === normCl || (l.cliente || '').trim().toLowerCase() === cl.trim().toLowerCase();
              }).length;
            }}
          />

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
                            loteId: true,
                            cliente: true,
                            variedad: true,
                            tipo: true,
                            tratamiento: true,
                            bolsas: true,
                            estado: true,
                          })}
                          className="text-[9px] font-black text-[#00603C] hover:underline cursor-pointer"
                        >
                          Restablecer
                        </button>
                      </div>
                      <div className="space-y-1.5 max-h-60 overflow-y-auto">
                        {[
                          { key: 'loteId', label: 'N° de lote' },
                          { key: 'cliente', label: 'Cliente' },
                          { key: 'variedad', label: 'Variedad' },
                          { key: 'tipo', label: 'Tipo de lote' },
                          { key: 'tratamiento', label: 'Tratamiento' },
                          { key: 'bolsas', label: 'Cantidad de bolsas' },
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
              <button
                onClick={() => setViewType('heatmap')}
                className={`p-1.5 rounded-md transition ${viewType === 'heatmap' ? 'bg-[#00603C] text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                title="Mapa de Calor de Acopio"
              >
                <Flame className="w-4 h-4" />
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
      {viewType === 'heatmap' ? (
        /* VISTA MAPA DE CALOR DE ACOPIO */
        <div className="space-y-6" id="heatmap-view-section">
          {/* Tarjetas de Insights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-2xs flex items-center gap-4">
              <div className="p-3 bg-[#E3EFE7] text-[#00603C] rounded-xl">
                <Warehouse className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Ocupación de Planta</span>
                <span className="text-lg font-black text-[#00603C] font-mono">
                  {cellsData.filter(c => c.totalKg > 0).length} / 12 <span className="text-xs font-normal text-gray-500">Sectores</span>
                </span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-2xs flex items-center gap-4">
              <div className="p-3 bg-[#F6EFDC] text-[#C9922E] rounded-xl">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Total Kg en Acopio</span>
                <span className="text-lg font-black text-gray-800 font-mono">
                  {formatKg(lotes.reduce((sum, l) => sum + (l.stockKg || 0), 0))}
                </span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-2xs flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Grid className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Total Bolsas</span>
                <span className="text-lg font-black text-gray-800 font-mono">
                  {formatNumberArg(lotes.reduce((sum, l) => sum + (l.stockBolsas || 0), 0))} <span className="text-xs font-normal text-gray-500">und</span>
                </span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-2xs flex items-center gap-4">
              <div className="p-3 bg-[#00603C]/10 text-[#00603C] rounded-xl">
                <Flame className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Mayor Concentración</span>
                <span className="text-xs font-bold text-[#00603C] truncate block max-w-[150px] mt-0.5">
                  {(() => {
                    const sortedCells = [...cellsData].sort((a, b) => b.totalKg - a.totalKg);
                    if (sortedCells[0] && sortedCells[0].totalKg > 0) {
                      return `ALA ${sortedCells[0].ala} - SECTOR ${sortedCells[0].sector} (${formatKg(sortedCells[0].totalKg)})`;
                    }
                    return 'Ninguno';
                  })()}
                </span>
              </div>
            </div>
          </div>

          {/* Grilla Mapa de Calor */}
          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-4 border-b border-gray-50">
              <div>
                <h3 className="font-serif text-lg font-extrabold text-gray-800 flex items-center gap-2">
                  <Flame className="w-5 h-5 text-[#C9922E]" />
                  Distribución Física de Semilla (Mapa de Calor)
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Visualización de la carga actual de stock en cada una de las naves y celdas del depósito de acopio.
                </p>
              </div>

              {/* Referencia de Intensidad */}
              <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold text-gray-500">
                <span>INTENSIDAD:</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-gray-100 border border-gray-200"></span>
                  <span>Vacío</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-[#00603C]/10 border border-[#00603C]/20"></span>
                  <span>Bajo</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-[#00603C]/30 border border-[#00603C]/40"></span>
                  <span>Medio</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-[#00603C]/70 border border-[#00603C]"></span>
                  <span>Máximo</span>
                </div>
              </div>
            </div>

            {/* Grid del Depósito */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-stretch">
              {/* Columna Cabeceras de Ala vacía (solo en pantallas md) */}
              <div className="hidden md:flex flex-col justify-around text-center py-4 text-xs font-black uppercase text-gray-400 font-sans tracking-widest bg-gray-50/50 rounded-2xl border border-gray-100/50 w-full min-h-[350px]">
                <div>Ala A</div>
                <div>Ala B</div>
                <div>Ala C</div>
                <div>Ala D</div>
              </div>

              {/* Los 3 Sectores */}
              <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Sector headers */}
                <div className="sm:col-span-3 grid grid-cols-3 text-center text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">
                  <div>Sector 1</div>
                  <div>Sector 2</div>
                  <div>Sector 3</div>
                </div>

                {/* Renderizar las celdas en orden de fila (A1, A2, A3, B1...) */}
                {cellsData.map((cell, idx) => (
                  <div key={idx} className="relative">
                    {/* Indicador de Ala para móviles */}
                    <div className="md:hidden block text-[10px] font-bold text-[#00603C] uppercase mb-1 px-1">
                      Ala {cell.ala}
                    </div>
                    
                    <div
                      onClick={() => {
                        if (selectedHeatmapCell && selectedHeatmapCell.ala === cell.ala && selectedHeatmapCell.sector === cell.sector) {
                          setSelectedHeatmapCell(null);
                        } else {
                          setSelectedHeatmapCell({ ala: cell.ala, sector: cell.sector });
                        }
                      }}
                      className={`p-4 rounded-xl border-2 transition duration-200 text-center flex flex-col justify-between h-36 relative select-none ${
                        selectedHeatmapCell && selectedHeatmapCell.ala === cell.ala && selectedHeatmapCell.sector === cell.sector
                          ? 'border-[#C9922E] ring-2 ring-[#C9922E]/20 shadow-md z-10 scale-[1.02]'
                          : 'border-transparent'
                      } ${
                        cell.totalKg === 0
                          ? 'bg-gray-100/60 text-gray-400 border-gray-200/50 hover:bg-gray-200/50'
                          : cell.totalKg / maxCellKg <= 0.25
                          ? 'bg-[#00603C]/5 text-[#00603C] border-[#00603C]/10 hover:bg-[#00603C]/10'
                          : cell.totalKg / maxCellKg <= 0.6
                          ? 'bg-[#00603C]/20 text-[#00603C] border-[#00603C]/30 hover:bg-[#00603C]/25'
                          : 'bg-[#00603C]/70 text-white border-[#00603C]/90 hover:bg-[#00603C]/80 shadow-xs'
                      } cursor-pointer hover:scale-[1.01]`}
                    >
                      {/* Label: ALA & SECTOR */}
                      <div className="flex justify-between items-center text-[9px] uppercase tracking-wider font-bold opacity-80">
                        <span>ALA {cell.ala}</span>
                        <span>SECTOR {cell.sector}</span>
                      </div>

                      {/* Big Number: Kg */}
                      <div className="my-2">
                        <div className="text-sm sm:text-base font-extrabold tracking-tight font-mono leading-none">
                          {formatKg(cell.totalKg)}
                        </div>
                        <div className="text-[10px] font-medium opacity-90 mt-1 leading-none">
                          {formatNumberArg(cell.totalBolsas)} bolsas · {cell.lotesCount} {cell.lotesCount === 1 ? 'lote' : 'lotes'}
                        </div>
                      </div>

                      {/* Especie Pill */}
                      <div className="mt-1 flex justify-center">
                        {cell.totalKg === 0 ? (
                          <span className="text-[9px] px-1.5 py-0.5 bg-gray-200 text-gray-500 rounded font-bold uppercase tracking-wider leading-none font-sans">Vacío</span>
                        ) : cell.species.length === 1 ? (
                          <span className={`text-[8px] sm:text-[9px] px-2 py-0.5 rounded font-extrabold uppercase tracking-wider leading-none truncate max-w-[120px] font-sans ${
                            cell.totalKg / maxCellKg > 0.6 ? 'bg-white text-[#00603C]' : 'bg-[#00603C] text-white'
                          }`}>
                            {cell.species[0] === 'Soja' ? '🌱 Soja' : cell.species[0] === 'Trigo' ? '🌾 Trigo' : cell.species[0] === 'Arveja' ? '🟢 Arveja' : `🌱 ${cell.species[0]}`}
                          </span>
                        ) : (
                          <span className={`text-[8px] sm:text-[9px] px-2 py-0.5 rounded font-extrabold uppercase tracking-wider leading-none font-sans ${
                            cell.totalKg / maxCellKg > 0.6 ? 'bg-[#C9922E] text-white border border-white' : 'bg-[#C9922E] text-white shadow-xs'
                          }`}>
                            ✨ MULTI ({cell.species.length})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 p-3.5 bg-[#E3EFE7]/30 border border-[#E3EFE7] rounded-xl flex items-start gap-2.5 text-xs text-emerald-950">
              <Info className="w-4 h-4 text-[#00603C] shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>Consejo de navegación:</strong> Haga clic sobre cualquier celda del mapa de calor para ver los lotes detallados y realizar gestiones de stock en esa ubicación específica.
              </p>
            </div>
          </div>

          {/* Sección de Detalle de Celda Seleccionada */}
          {selectedHeatmapCell ? (
            <div className="bg-white rounded-3xl border border-[#C9922E]/30 p-6 shadow-sm space-y-4 animate-in fade-in duration-200" id="selected-heatmap-detail">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-3 border-b border-gray-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-[#C9922E] text-white text-xs font-mono font-black rounded-lg shadow-sm">
                      UBICACIÓN SELECCIONADA: ALA {selectedHeatmapCell.ala} - SECTOR {selectedHeatmapCell.sector}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Lotes acopiados actualmente en este sector físico.
                  </p>
                </div>
                <button
                  onClick={() => setSelectedHeatmapCell(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-lg border border-gray-200 transition"
                >
                  Limpiar Selección / Mostrar Todos
                </button>
              </div>

              {/* Lista de lotes en la ubicación seleccionada */}
              {(() => {
                const activeCellLotes = lotes.filter(l => l.ala === selectedHeatmapCell.ala && l.sector === selectedHeatmapCell.sector);
                if (activeCellLotes.length === 0) {
                  return (
                    <div className="p-8 text-center text-gray-400">
                      <Warehouse className="w-8 h-8 mx-auto mb-2 opacity-40 text-gray-300" />
                      <p className="text-xs">Este sector se encuentra completamente vacío.</p>
                    </div>
                  );
                }
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activeCellLotes.map(l => (
                      <div
                        key={l.id}
                        className="bg-gray-50/60 rounded-2xl border border-gray-100 p-4 hover:border-[#00603C]/30 hover:bg-white transition flex flex-col justify-between gap-3 shadow-xs"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="px-2 py-0.5 bg-[#C9922E] text-white text-[10px] font-mono font-black rounded">
                              LOTE: {l.loteNro}
                            </span>
                            <h4 className="font-serif text-sm font-bold text-gray-800 mt-1.5 truncate max-w-[150px]">
                              {l.cliente}
                            </h4>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${getEstadoBadgeStyle(l.estado)}`}>
                            {l.estado}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[10px] py-1 border-t border-b border-gray-100">
                          <div>
                            <span className="text-gray-400 block uppercase font-bold text-[8px] tracking-wider">Variedad</span>
                            <span className="font-semibold text-gray-700 truncate block">{l.especie} {l.variedad}</span>
                          </div>
                          <div>
                            <span className="text-gray-400 block uppercase font-bold text-[8px] tracking-wider">Stock</span>
                            <span className="font-extrabold text-[#00603C] block">{formatKg(l.stockKg)}</span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center gap-1.5">
                          <span className="text-[10px] font-semibold text-gray-500 font-mono">
                            {formatNumberArg(l.stockBolsas)} bolsas
                          </span>
                          
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => onEditLote(l)}
                              className="p-1.5 text-gray-500 hover:text-[#00603C] rounded hover:bg-gray-100 transition"
                              title="Editar"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setSelectedQrLote(l)}
                              className="p-1.5 text-gray-500 hover:text-[#00603C] rounded hover:bg-gray-100 transition"
                              title="QR"
                            >
                              <QrCode className="w-3.5 h-3.5 text-[#C9922E]" />
                            </button>
                            <button
                              onClick={() => onSelectLote(l)}
                              className="px-2 py-1 bg-[#00603C] text-white rounded text-[10px] font-semibold hover:bg-[#1a442b] transition flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3 h-3 text-[#C9922E]" />
                              Ficha
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          ) : (
            /* Mostrar resumen de depósitos cuando no hay celda seleccionada */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 p-6 rounded-3xl border border-slate-100/50">
              <div>
                <h4 className="text-xs font-black uppercase text-gray-500 tracking-wider mb-3 font-sans">Información sobre Sectores de Acopio</h4>
                <div className="space-y-2.5 text-xs text-gray-600 leading-relaxed font-sans">
                  <p>
                    La planta clasificadora dispone de <strong>4 Alas (Naves Longitudinales: A, B, C, D)</strong> y <strong>3 Sectores (Celdas/Bahías de Almacenamiento: 1, 2, 3)</strong> por cada Ala.
                  </p>
                  <p>
                    El mapa de calor representa el nivel de carga física en Kilogramos en tiempo real de forma dinámica. La coloración se intensifica proporcionalmente en los sectores con mayor acumulación de mercadería.
                  </p>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-black uppercase text-gray-500 tracking-wider mb-3 font-sans">Especies Almacenadas actualmente</h4>
                <div className="flex flex-wrap gap-2">
                  {Array.from(new Set(lotes.map(l => l.especie).filter(Boolean))).map((esp, i) => (
                    <span key={i} className="px-3 py-1.5 bg-white text-gray-700 rounded-xl border border-gray-200 text-xs font-bold shadow-2xs flex items-center gap-1.5 font-sans">
                      {esp === 'Soja' ? '🌱' : esp === 'Trigo' ? '🌾' : esp === 'Arveja' ? '🟢' : '🌱'} {esp}
                      <span className="font-mono text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                        {lotes.filter(l => l.especie === esp).length} lotes
                      </span>
                    </span>
                  ))}
                  {lotes.length === 0 && (
                    <span className="text-xs text-gray-400 italic font-sans">No hay especies registradas en depósito.</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : filteredLotes.length === 0 ? (
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
                    onClick={() => onEditLote(l)}
                    className="p-2 text-gray-500 hover:text-[#00603C] rounded-lg hover:bg-[#E3EFE7] transition text-xs flex items-center gap-1"
                    title="Editar Lote"
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
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden space-y-0">
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

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#00603C] text-white font-sans text-xs uppercase tracking-wider">
                  <th className="py-3.5 px-4 font-semibold text-center w-10">
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
                      title="Seleccionar todos para eliminar"
                      aria-label="Seleccionar todos para eliminar"
                      className="rounded border-gray-300 text-white focus:ring-offset-0 focus:ring-0 h-4 w-4 cursor-pointer"
                    />
                  </th>
                  {visibleColumns.loteId && <th className="py-3.5 px-3.5 font-extrabold uppercase text-xs tracking-wider text-amber-300 whitespace-nowrap">N° de lote</th>}
                  {visibleColumns.cliente && <th className="py-3.5 px-3.5 font-bold uppercase text-xs tracking-wider text-white whitespace-nowrap">Cliente</th>}
                  {visibleColumns.variedad && <th className="py-3.5 px-3.5 font-bold uppercase text-xs tracking-wider text-white whitespace-nowrap">Variedad</th>}
                  {visibleColumns.tipo && (
                    <th className="py-3.5 px-3.5 font-extrabold uppercase text-xs tracking-wider text-amber-300 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-amber-300 stroke-[2.5]" />
                        <span>Tipo</span>
                        {filterTipos.length > 0 && (
                          <span className="px-1.5 py-0.2 bg-amber-400 text-slate-950 text-[9px] font-black rounded font-mono">
                            {filterTipos.length}
                          </span>
                        )}
                      </div>
                    </th>
                  )}
                  {visibleColumns.tratamiento && (
                    <th className="py-3.5 px-3.5 font-extrabold uppercase text-xs tracking-wider text-cyan-300 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <FlaskConical className="w-3.5 h-3.5 text-cyan-300 stroke-[2.5]" />
                        <span>Tratamiento</span>
                        {filterTratamientos.length > 0 && (
                          <span className="px-1.5 py-0.2 bg-cyan-400 text-slate-950 text-[9px] font-black rounded font-mono">
                            {filterTratamientos.length}
                          </span>
                        )}
                      </div>
                    </th>
                  )}
                  {visibleColumns.bolsas && <th className="py-3.5 px-3.5 font-bold uppercase text-xs tracking-wider text-white text-right whitespace-nowrap">Cantidad de bolsas</th>}
                  {visibleColumns.estado && <th className="py-3.5 px-3.5 font-bold uppercase text-xs tracking-wider text-white text-center whitespace-nowrap">Estado</th>}
                  <th className="py-3.5 px-3.5 font-bold uppercase text-xs tracking-wider text-white text-center whitespace-nowrap">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {paginatedLotes.map((l, index) => (
                  <tr
                    key={l.id}
                    className={index % 2 === 0 ? 'bg-white hover:bg-slate-50/80 transition-colors' : 'bg-[#E3EFE7]/30 hover:bg-[#E3EFE7]/60 transition-colors'}
                  >
                    <td className="py-3 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedLoteIds.includes(l.id)}
                        onChange={() => toggleSelectLote(l.id)}
                        title="Seleccionar lote para eliminar"
                        aria-label="Seleccionar lote para eliminar"
                        className="rounded border-gray-300 text-[#00603C] focus:ring-[#00603C] h-4 w-4 cursor-pointer"
                      />
                    </td>
                    {/* 1. N° de lote con botón individual Imprimir ID Bolsas */}
                    {visibleColumns.loteId && (
                      <td className="py-3 px-3.5">
                        <div className="flex flex-col gap-1.5 items-start">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Badge de Número de Lote Rectangular Gris Oscuro */}
                            <div className="inline-flex items-center justify-between gap-2.5 px-3 py-1.5 bg-slate-800 text-white rounded-lg border border-slate-700 ring-1 ring-amber-400/30 shadow-2xs min-w-[120px]">
                              <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest font-sans shrink-0">LOTE</span>
                              <span className="text-sm sm:text-base font-black font-mono text-amber-300 tracking-wider">
                                {l.loteNro || 'S/N'}
                              </span>
                            </div>

                            {/* Botón Individual FICHA (Ficha Técnica Oficial A4 del Lote) */}
                            <button
                              type="button"
                              id={`btn-ficha-table-${l.id}`}
                              onClick={() => setSelectedFichaLote(l)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[#00603C] hover:bg-[#004D30] text-white font-black text-[10.5px] rounded-lg shadow-xs hover:shadow transition cursor-pointer tracking-wider uppercase font-sans active:scale-95 border border-emerald-600"
                              title={`Abrir e imprimir Ficha Técnica Oficial del Lote ${l.loteNro || l.id} (A4)`}
                            >
                              <FileText className="w-3.5 h-3.5 text-amber-300 stroke-[2.5]" />
                              <span>FICHA</span>
                            </button>

                            {/* Botón Individual ID BOLSAS (Generador de Etiquetas · 7 por hoja A4) */}
                            <button
                              type="button"
                              id={`btn-id-bolsas-table-${l.id}`}
                              onClick={() => setSelectedIdBolsasLote(l)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[10.5px] rounded-lg shadow-xs hover:shadow transition cursor-pointer tracking-wider uppercase font-sans active:scale-95 border border-amber-500"
                              title={`Generar e imprimir etiquetas ID Bolsas del Lote ${l.loteNro || l.id} (7 por hoja A4)`}
                            >
                              <Tag className="w-3.5 h-3.5 text-slate-950 stroke-[2.5]" />
                              <span>ID BOLSAS</span>
                            </button>
                          </div>

                          {/* Badge de Estado de Registro, ID y TIPO */}
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            {l.estadoRegistro === 'PRE-CARGA' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-[9px] rounded-md shadow-2xs" title="Pre-Carga: Lote planificado. NO descuenta stock de silos.">
                                <Clock className="w-3 h-3 text-amber-600" />
                                PRE-CARGA
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 font-extrabold text-[9px] rounded-md shadow-2xs" title="Realizado: Producción ejecutada.">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                REALIZADO
                              </span>
                            )}
                            <span className="font-mono text-[9px] text-slate-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              ID: {l.id}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border shadow-2xs ${getTipoBadgeStyle(l.tipo)}`}
                              title={`Tipo de lote: ${l.tipo || 'Sin tipo'}`}
                            >
                              <Tag className="w-2.5 h-2.5 shrink-0" />
                              <span>TIPO: {l.tipo || 'Sin tipo'}</span>
                            </span>
                          </div>
                        </div>
                      </td>
                    )}

                    {/* 2. Cliente */}
                    {visibleColumns.cliente && (
                      <td className="py-3 px-3.5 font-bold text-slate-800 text-xs sm:text-sm whitespace-nowrap">
                        {l.cliente || '—'}
                      </td>
                    )}

                    {/* 3. Variedad */}
                    {visibleColumns.variedad && (
                      <td className="py-3 px-3.5">
                        <div className="font-extrabold text-slate-900 text-xs sm:text-sm whitespace-nowrap">
                          {l.variedad || '—'}
                        </div>
                        {l.especie && (
                          <div className="text-[11px] font-semibold text-slate-500">
                            {l.especie}
                          </div>
                        )}
                      </td>
                    )}

                    {/* 4. Tipo de Lote (Dato Visible de la información del lote) */}
                    {visibleColumns.tipo && (
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider border shadow-2xs ${getTipoBadgeStyle(l.tipo)}`}
                          >
                            <Tag className="w-3.5 h-3.5 shrink-0" />
                            <span>{l.tipo || 'Final'}</span>
                          </span>
                          {!filterTipos.includes(l.tipo) && l.tipo && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setFilterTipos([l.tipo]);
                              }}
                              className="text-[9.5px] font-bold text-slate-400 hover:text-[#00603C] hover:underline cursor-pointer flex items-center gap-0.5 transition"
                              title={`Filtrar exclusivamente lotes tipo "${l.tipo}"`}
                            >
                              <Filter className="w-2.5 h-2.5" />
                              <span>Filtrar sólo {l.tipo}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    )}

                    {/* Tratamiento */}
                    {visibleColumns.tratamiento && (
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="flex flex-col gap-1 items-start">
                          {(() => {
                            const trats = Array.isArray(l.tratamiento) ? l.tratamiento : [l.tratamiento];
                            const isTratado = trats.some(t => String(t).toLowerCase() === 'tratado' || (t && t !== 'Sin Tratar' && t !== 'Sin Tratamiento')) ||
                                              (l.tipoMovimiento || '').toLowerCase().includes('tratado') ||
                                              Boolean(l.productoAplicado && l.productoAplicado.trim() !== '') ||
                                              Boolean(l.producto && !['Ninguno', 'Sin Tratamiento', 'FINAL', 'INTERMEDIO', ''].includes(l.producto));
                            return (
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider border shadow-2xs ${
                                  isTratado
                                    ? 'bg-cyan-100 text-cyan-950 border-cyan-400/80 ring-1 ring-cyan-400/30'
                                    : 'bg-slate-100 text-slate-800 border-slate-300'
                                }`}
                              >
                                <FlaskConical className={`w-3.5 h-3.5 shrink-0 ${isTratado ? 'text-cyan-700' : 'text-slate-500'}`} />
                                <span>{isTratado ? 'Tratado' : 'Sin Tratar'}</span>
                              </span>
                            );
                          })()}
                          {l.productoAplicado && (
                            <span className="text-[10px] font-semibold text-slate-500 truncate max-w-[140px]" title={l.productoAplicado}>
                              {l.productoAplicado}
                            </span>
                          )}
                        </div>
                      </td>
                    )}

                    {/* 5. Cantidad de bolsas */}
                    {visibleColumns.bolsas && (
                      <td className="py-3 px-3.5 text-right">
                        <div className="font-black text-slate-900 font-mono text-xs sm:text-sm whitespace-nowrap">
                          {formatNumberArg(l.stockBolsas, 0)} u.
                        </div>
                        {l.stockKg > 0 && (
                          <div className="text-[10px] font-mono text-[#00603C] font-semibold">
                            {formatNumberArg(l.stockKg, 0)} kg
                          </div>
                        )}
                      </td>
                    )}

                    {/* 6. Estado */}
                    {visibleColumns.estado && (
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider rounded-full border ${getEstadoBadgeStyle(l.estado)}`}>
                          {l.estado}
                        </span>
                      </td>
                    )}

                    {/* 7. Acción */}
                    <td className="py-3 px-3.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1 sm:gap-1.5">
                        {l.estadoRegistro === 'PRE-CARGA' && (
                          (l.esMovimiento || l.tipoMovimiento || l.loteOrigen || (l.loteNro && l.loteNro.toUpperCase().includes('MOV'))) ? (
                            <button
                              type="button"
                              onClick={() => setLoteToMovRealizado(l)}
                              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-black flex items-center gap-1 shadow-xs transition cursor-pointer border border-blue-500 uppercase tracking-wider"
                              title="MOV REALIZADO: Fijar manualmente el día en el que se realizó efectivamente el movimiento"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-white stroke-[2.5]" />
                              <span>MOV REALIZADO</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setLoteToProcess(l)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-xs transition cursor-pointer"
                              title="Pasar a Realizado (Ingresar silos, bolsones y sectores de origen)"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                              <span>Pasar a Realizado</span>
                            </button>
                          )
                        )}
                        {!l.tratamiento.includes('Tratado') && l.stockBolsas > 0 && (
                          <button
                            onClick={() => setLoteToTratar(l)}
                            className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-[10px] font-extrabold flex items-center gap-1 shadow-xs transition cursor-pointer"
                            title="Curar / Tratar Semilla (Generar Lote T)"
                          >
                            <FlaskConical className="w-3.5 h-3.5" />
                            <span>Curar</span>
                          </button>
                        )}
                        <button
                          onClick={() => onSelectLote(l)}
                          className="p-1.5 text-slate-600 hover:text-[#00603C] hover:bg-slate-100 rounded-lg transition"
                          title="Ver Ficha Detalle"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onEditLote(l)}
                          className="p-1.5 text-slate-600 hover:text-[#C9922E] hover:bg-slate-100 rounded-lg transition"
                          title="Editar Lote"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setSelectedQrLote(l)}
                          className="p-1.5 text-slate-600 hover:text-[#00603C] hover:bg-slate-100 rounded-lg transition"
                          title="Generar QR"
                        >
                          <QrCode className="w-4 h-4 text-[#C9922E]" />
                        </button>
                        {l.stockBolsas > 0 && (
                          <button
                            onClick={() => onRegistrarSalidaLote(l)}
                            className="p-1.5 text-slate-600 hover:text-green-700 hover:bg-slate-100 rounded-lg transition"
                            title="Registrar Salida / Despacho"
                          >
                            <ArrowDownRight className="w-4 h-4 text-emerald-600" />
                          </button>
                        )}
                        <button
                          onClick={() => setLoteToDelete(l)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Eliminar Lote"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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

      {/* Modal Tratar / Curar Semilla */}
      {loteToTratar && (
        <TratarLoteModal
          isOpen={Boolean(loteToTratar)}
          lote={loteToTratar}
          allLotes={lotes}
          ordenesProceso={ordenesProceso}
          onClose={() => setLoteToTratar(null)}
          onConfirmTratamiento={(params) => {
            setLoteToTratar(null);
            handleConfirmTratamiento(params);
          }}
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
    </div>
  );
};
