import React, { useState, useMemo, useEffect } from 'react';
import { 
  Flame, 
  Warehouse, 
  Layers, 
  Search, 
  Filter, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  ArrowRightLeft, 
  Check, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  X, 
  Edit2, 
  Eye, 
  QrCode, 
  SlidersHorizontal, 
  RotateCcw, 
  Package, 
  Building2, 
  Calendar, 
  User, 
  Sprout, 
  Wheat, 
  HelpCircle,
  Save
} from 'lucide-react';
import { Lote, EspecieType, AuditLogEntry } from '../types';

export interface SectorCapacidad {
  bolsas: number;
  kg?: number;
}

export type SectoresCapacidadesMap = Record<string, SectorCapacidad>;

export interface MapaCalorDashboardProps {
  lotes: Lote[];
  clientes: string[];
  especies: string[];
  onSaveLote: (loteActualizado: Lote) => Promise<void> | void;
  onSelectLote: (lote: Lote) => void;
  onNavigateToLotes?: () => void;
}

const ALAS = ['A', 'B', 'C', 'D'] as const;
const SECTORES = ['1', '2', '3'] as const;

// Clave en LocalStorage para guardar capacidades manuales asignadas a cada sector
const STORAGE_KEY_CAPACIDADES = 'agroabacus_sectores_capacidad_v1';

// Capacidad por defecto si no se ha asignado manualmente (500 bolsas / 400.000 kg aprox)
const DEFAULT_CAPACIDAD_BOLSAS = 500;
const DEFAULT_CAPACIDAD_KG = 400000;

function getDefaultCapacidades(): SectoresCapacidadesMap {
  const result: SectoresCapacidadesMap = {};
  for (const ala of ALAS) {
    for (const sec of SECTORES) {
      result[`${ala}-${sec}`] = {
        bolsas: DEFAULT_CAPACIDAD_BOLSAS,
        kg: DEFAULT_CAPACIDAD_KG
      };
    }
  }
  return result;
}

export const MapaCalorDashboard: React.FC<MapaCalorDashboardProps> = ({
  lotes,
  clientes,
  especies,
  onSaveLote,
  onSelectLote,
  onNavigateToLotes
}) => {
  // 1. Estado de Capacidades Manuales por Sector
  const [capacidades, setCapacidades] = useState<SectoresCapacidadesMap>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CAPACIDADES);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...getDefaultCapacidades(), ...parsed };
      }
    } catch {
      // Ignorar error de parsing
    }
    return getDefaultCapacidades();
  });

  // Guardar en LocalStorage cada vez que cambien las capacidades
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CAPACIDADES, JSON.stringify(capacidades));
    } catch {
      // Storage no disponible
    }
  }, [capacidades]);

  // 2. Estado de Sector Seleccionado (ej: 'A-1')
  const [selectedSectorKey, setSelectedSectorKey] = useState<string | null>(null);

  // 3. Filtros Globales de Visualización en el Mapa
  const [globalClienteFilter, setGlobalClienteFilter] = useState<string>('TODOS');
  const [globalEspecieFilter, setGlobalEspecieFilter] = useState<string>('TODAS');
  const [globalSearch, setGlobalSearch] = useState<string>('');

  // 4. Filtros y Configuración para la "Vista de Tabla" del Sector Seleccionado
  const [sectorClienteFilter, setSectorClienteFilter] = useState<string>('TODOS');
  const [sortField, setSortField] = useState<'loteNro' | 'stockBolsas' | 'stockKg' | 'fechaIngreso' | 'cliente' | 'variedad'>('stockBolsas');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [groupBy, setGroupBy] = useState<'none' | 'variedad' | 'fecha' | 'cliente'>('none');

  // 5. Estado para Mover Lotes
  const [movingLoteId, setMovingLoteId] = useState<string | null>(null);
  const [targetAla, setTargetAla] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [targetSector, setTargetSector] = useState<'1' | '2' | '3'>('1');
  const [isMoving, setIsMoving] = useState(false);

  // Selección múltiple para mover en bloque
  const [selectedLoteIdsToMove, setSelectedLoteIdsToMove] = useState<string[]>([]);
  const [batchTargetAla, setBatchTargetAla] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [batchTargetSector, setBatchTargetSector] = useState<'1' | '2' | '3'>('1');

  // 6. Estado para Modal de Asignación Manual de Capacidad
  const [isEditingCapacityModalOpen, setIsEditingCapacityModalOpen] = useState(false);
  const [editingSectorKey, setEditingSectorKey] = useState<string | null>(null);
  const [inputCapacidadBolsas, setInputCapacidadBolsas] = useState<number>(DEFAULT_CAPACIDAD_BOLSAS);
  const [inputCapacidadKg, setInputCapacidadKg] = useState<number>(DEFAULT_CAPACIDAD_KG);
  const [applyToAllInAla, setApplyToAllInAla] = useState(false);
  const [applyToAllPlant, setApplyToAllPlant] = useState(false);

  // 7. Notificaciones Toast
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'warning' } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'warning' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // 8. Lotes que coinciden con los filtros globales
  const lotesConFiltroGlobal = useMemo(() => {
    return lotes.filter((l) => {
      if (globalClienteFilter !== 'TODOS' && l.cliente !== globalClienteFilter) {
        return false;
      }
      if (globalEspecieFilter !== 'TODAS' && l.especie !== globalEspecieFilter) {
        return false;
      }
      if (globalSearch.trim()) {
        const query = globalSearch.toLowerCase().trim();
        const nro = (l.loteNro || '').toLowerCase();
        const cli = (l.cliente || '').toLowerCase();
        const esp = (l.especie || '').toLowerCase();
        const varName = (l.variedad || '').toLowerCase();
        if (!nro.includes(query) && !cli.includes(query) && !esp.includes(query) && !varName.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [lotes, globalClienteFilter, globalEspecieFilter, globalSearch]);

  // 9. Cálculo de métricas y datos por cada Sector (12 sectores)
  const sectoresData = useMemo(() => {
    const map: Record<string, {
      ala: string;
      sector: string;
      key: string;
      lotes: Lote[];
      totalBolsas: number;
      totalKg: number;
      capacidadBolsas: number;
      capacidadKg: number;
      porcentajeLlenado: number;
      especies: string[];
      variedades: string[];
      clientes: string[];
    }> = {};

    for (const ala of ALAS) {
      for (const sec of SECTORES) {
        const key = `${ala}-${sec}`;
        const sectorLotes = lotesConFiltroGlobal.filter(
          (l) => (l.ala || '').toUpperCase() === ala && (l.sector || '').toString() === sec
        );

        const totalBolsas = sectorLotes.reduce((sum, l) => sum + (Number(l.stockBolsas) || 0), 0);
        const totalKg = sectorLotes.reduce((sum, l) => sum + (Number(l.stockKg) || 0), 0);
        
        const cap = capacidades[key] || { bolsas: DEFAULT_CAPACIDAD_BOLSAS, kg: DEFAULT_CAPACIDAD_KG };
        const capBolsas = cap.bolsas > 0 ? cap.bolsas : DEFAULT_CAPACIDAD_BOLSAS;
        const capKg = (cap.kg && cap.kg > 0) ? cap.kg : DEFAULT_CAPACIDAD_KG;

        const porcentajeLlenado = Math.round((totalBolsas / capBolsas) * 100);

        const espSet = Array.from(new Set(sectorLotes.map((l) => l.especie).filter(Boolean))) as string[];
        const varSet = Array.from(new Set(sectorLotes.map((l) => l.variedad).filter(Boolean))) as string[];
        const cliSet = Array.from(new Set(sectorLotes.map((l) => l.cliente).filter(Boolean))) as string[];

        map[key] = {
          ala,
          sector: sec,
          key,
          lotes: sectorLotes,
          totalBolsas,
          totalKg,
          capacidadBolsas: capBolsas,
          capacidadKg: capKg,
          porcentajeLlenado,
          especies: espSet,
          variedades: varSet,
          clientes: cliSet
        };
      }
    }

    return map;
  }, [lotesConFiltroGlobal, capacidades]);

  // 10. Estadísticas globales del galpón
  const globalStats = useMemo(() => {
    let ocupadas = 0;
    let totalCap = 0;
    let kgTotal = 0;
    let sectoresConLotes = 0;
    let maxOcupacionSector: { key: string; porcentaje: number; bolsas: number } = { key: 'Ninguno', porcentaje: 0, bolsas: 0 };

    for (const key of Object.keys(sectoresData)) {
      const data = sectoresData[key];
      ocupadas += data.totalBolsas;
      totalCap += data.capacidadBolsas;
      kgTotal += data.totalKg;
      if (data.lotes.length > 0) {
        sectoresConLotes++;
      }
      if (data.porcentajeLlenado > maxOcupacionSector.porcentaje) {
        maxOcupacionSector = {
          key: `ALA ${data.ala} - SECTOR ${data.sector}`,
          porcentaje: data.porcentajeLlenado,
          bolsas: data.totalBolsas
        };
      }
    }

    const porcentajeGlobal = totalCap > 0 ? Math.round((ocupadas / totalCap) * 100) : 0;

    return {
      ocupadas,
      totalCap,
      kgTotal,
      sectoresConLotes,
      porcentajeGlobal,
      maxOcupacionSector
    };
  }, [sectoresData]);

  // 11. Datos del sector actualmente seleccionado
  const activeSectorData = selectedSectorKey ? sectoresData[selectedSectorKey] : null;

  // Lotes del sector seleccionado filtrados por cliente del sector y ordenados
  const filteredSortedSectorLotes = useMemo(() => {
    if (!activeSectorData) return [];

    let result = activeSectorData.lotes;

    // Filtro específico de cliente en el sector seleccionado
    if (sectorClienteFilter !== 'TODOS') {
      result = result.filter((l) => l.cliente === sectorClienteFilter);
    }

    // Ordenamiento
    return [...result].sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'stockBolsas' || sortField === 'stockKg') {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }

      valA = (valA || '').toString().toLowerCase();
      valB = (valB || '').toString().toLowerCase();

      return sortOrder === 'asc' 
        ? valA.localeCompare(valB) 
        : valB.localeCompare(valA);
    });
  }, [activeSectorData, sectorClienteFilter, sortField, sortOrder]);

  // Agrupamiento de lotes del sector
  const groupedSectorLotes = useMemo(() => {
    if (groupBy === 'none') {
      return null;
    }

    const groups: Record<string, Lote[]> = {};

    for (const lote of filteredSortedSectorLotes) {
      let groupKey = 'Sin Agrupar';
      if (groupBy === 'variedad') {
        groupKey = `${lote.especie || 'Semilla'} - ${lote.variedad || 'Sin Variedad'}`;
      } else if (groupBy === 'cliente') {
        groupKey = lote.cliente || 'Sin Cliente';
      } else if (groupBy === 'fecha') {
        groupKey = lote.fechaIngreso || 'Sin Fecha';
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(lote);
    }

    return groups;
  }, [filteredSortedSectorLotes, groupBy]);

  // Handler para mover lote individual
  const handleMoveSingleLote = async (lote: Lote, toAla: 'A' | 'B' | 'C' | 'D', toSector: '1' | '2' | '3') => {
    if (lote.ala === toAla && lote.sector === toSector) {
      showToast(`El lote ${lote.loteNro} ya se encuentra en Ala ${toAla} - Sector ${toSector}.`, 'info');
      setMovingLoteId(null);
      return;
    }

    try {
      setIsMoving(true);
      const auditEntry: AuditLogEntry = {
        id: `AUD-MOV-${Date.now()}`,
        fechaHora: new Date().toISOString(),
        tipo: 'Edición',
        usuario: 'Operador Galpón',
        descripcion: `Reubicación física: lote movido a Ala ${toAla} - Sector ${toSector}`,
        detalles: `Ubicación anterior: Ala ${lote.ala || 'S/A'} - Sector ${lote.sector || 'S/S'}. Nueva ubicación: Ala ${toAla} - Sector ${toSector}`
      };

      const updatedLote: Lote = {
        ...lote,
        ala: toAla,
        sector: toSector,
        ubicacionAcopio: `Ala ${toAla} - Sector ${toSector}`,
        auditoria: [...(lote.auditoria || []), auditEntry]
      };

      await onSaveLote(updatedLote);
      showToast(`Lote ${lote.loteNro} reubicado con éxito a ALA ${toAla} - SECTOR ${toSector}.`, 'success');
      setMovingLoteId(null);
    } catch (error) {
      console.error('Error al mover lote:', error);
      showToast('Ocurrió un error al intentar mover el lote. Reintente.', 'warning');
    } finally {
      setIsMoving(false);
    }
  };

  // Handler para mover selección múltiple de lotes
  const handleBatchMoveLotes = async () => {
    if (selectedLoteIdsToMove.length === 0) return;

    try {
      setIsMoving(true);
      const lotesToMove = lotes.filter((l) => selectedLoteIdsToMove.includes(l.id));

      for (const lote of lotesToMove) {
        const auditEntry: AuditLogEntry = {
          id: `AUD-MOV-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          fechaHora: new Date().toISOString(),
          tipo: 'Edición',
          usuario: 'Operador Galpón',
          descripcion: `Reubicación por lote masivo: movido a Ala ${batchTargetAla} - Sector ${batchTargetSector}`,
          detalles: `Ubicación anterior: Ala ${lote.ala || 'S/A'} - Sector ${lote.sector || 'S/S'}`
        };

        const updatedLote: Lote = {
          ...lote,
          ala: batchTargetAla,
          sector: batchTargetSector,
          ubicacionAcopio: `Ala ${batchTargetAla} - Sector ${batchTargetSector}`,
          auditoria: [...(lote.auditoria || []), auditEntry]
        };

        await onSaveLote(updatedLote);
      }

      showToast(`Se han reubicado ${lotesToMove.length} lotes a ALA ${batchTargetAla} - SECTOR ${batchTargetSector}.`, 'success');
      setSelectedLoteIdsToMove([]);
    } catch (error) {
      console.error('Error en reubicación masiva:', error);
      showToast('Error en la reubicación de algunos lotes.', 'warning');
    } finally {
      setIsMoving(false);
    }
  };

  // Handler para abrir modal de asignación manual de capacidad
  const handleOpenCapacityModal = (sectorKey?: string) => {
    const key = sectorKey || selectedSectorKey || 'A-1';
    setEditingSectorKey(key);
    const cap = capacidades[key] || { bolsas: DEFAULT_CAPACIDAD_BOLSAS, kg: DEFAULT_CAPACIDAD_KG };
    setInputCapacidadBolsas(cap.bolsas);
    setInputCapacidadKg(cap.kg || DEFAULT_CAPACIDAD_KG);
    setApplyToAllInAla(false);
    setApplyToAllPlant(false);
    setIsEditingCapacityModalOpen(true);
  };

  // Handler para guardar capacidad manual asignada
  const handleSaveCapacity = () => {
    if (!editingSectorKey) return;

    const nuevas = { ...capacidades };
    const [ala] = editingSectorKey.split('-');

    const capVal: SectorCapacidad = {
      bolsas: Math.max(1, Number(inputCapacidadBolsas) || DEFAULT_CAPACIDAD_BOLSAS),
      kg: Math.max(100, Number(inputCapacidadKg) || DEFAULT_CAPACIDAD_KG)
    };

    if (applyToAllPlant) {
      for (const a of ALAS) {
        for (const s of SECTORES) {
          nuevas[`${a}-${s}`] = { ...capVal };
        }
      }
      showToast(`Capacidad de ${capVal.bolsas} bolsas asignada a todos los 12 sectores de la clasificadora.`, 'success');
    } else if (applyToAllInAla) {
      for (const s of SECTORES) {
        nuevas[`${ala}-${s}`] = { ...capVal };
      }
      showToast(`Capacidad de ${capVal.bolsas} bolsas asignada a todos los sectores del ALA ${ala}.`, 'success');
    } else {
      nuevas[editingSectorKey] = capVal;
      showToast(`Capacidad manual de ALA ${editingSectorKey.replace('-', ' - SECTOR ')} actualizada a ${capVal.bolsas} bolsas.`, 'success');
    }

    setCapacidades(nuevas);
    setIsEditingCapacityModalOpen(false);
  };

  // Color del nivel de llenado según porcentaje
  const getLevelColor = (pct: number) => {
    if (pct === 0) return {
      bgBar: 'bg-gray-200',
      text: 'text-gray-500',
      badge: 'bg-gray-100 text-gray-600 border-gray-200',
      cardBorder: 'border-gray-200/80',
      glow: ''
    };
    if (pct <= 50) return {
      bgBar: 'bg-[#00603C]',
      text: 'text-[#00603C]',
      badge: 'bg-[#E3EFE7] text-[#00603C] border-emerald-200',
      cardBorder: 'border-emerald-200/70',
      glow: ''
    };
    if (pct <= 80) return {
      bgBar: 'bg-[#C9922E]',
      text: 'text-[#C9922E]',
      badge: 'bg-[#F6EFDC] text-[#C9922E] border-amber-300',
      cardBorder: 'border-amber-300/80',
      glow: ''
    };
    if (pct <= 100) return {
      bgBar: 'bg-orange-500',
      text: 'text-orange-600',
      badge: 'bg-orange-50 text-orange-700 border-orange-200',
      cardBorder: 'border-orange-300',
      glow: 'shadow-orange-100'
    };
    return {
      bgBar: 'bg-red-600',
      text: 'text-red-600',
      badge: 'bg-red-100 text-red-700 border-red-300 animate-pulse',
      cardBorder: 'border-red-400',
      glow: 'shadow-red-100'
    };
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200" id="mapa-calor-dashboard">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-6 right-6 z-[120] px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border text-sm font-sans font-semibold transition-all ${
          toastMessage.type === 'success'
            ? 'bg-[#00603C] text-white border-emerald-400'
            : toastMessage.type === 'warning'
            ? 'bg-amber-600 text-white border-amber-400'
            : 'bg-gray-900 text-white border-gray-700'
        }`}>
          <CheckCircle2 className="w-5 h-5 text-amber-300 shrink-0" />
          <span>{toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-white/70 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Encabezado Principal del Dashboard */}
      <div className="bg-white rounded-3xl border border-gray-200/80 p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#00603C]/10 text-[#00603C] rounded-2xl">
                <Flame className="w-7 h-7 text-[#C9922E]" />
              </div>
              <div>
                <h1 className="font-serif text-2xl font-black text-gray-900 tracking-tight">
                  Mapa de Calor: Distribución de Lotes en Galpones
                </h1>
                <p className="text-xs text-gray-500 font-sans mt-0.5">
                  Galpones de clasificadora: <strong>Alas A, B, C y D</strong> · <strong>Sectores 1, 2 y 3</strong> (12 sectores de acopio físico)
                </p>
              </div>
            </div>
          </div>

          {/* Botones de acción rápida */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => handleOpenCapacityModal(selectedSectorKey || 'A-1')}
              className="px-4 py-2.5 bg-[#F6EFDC] text-[#00603C] hover:bg-[#ebd9b5] border border-[#C9922E]/40 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-2xs"
              title="Asignar de modo manual la capacidad total de cada sector"
            >
              <SlidersHorizontal className="w-4 h-4 text-[#C9922E]" />
              Asignar Capacidad Manual
            </button>
            {onNavigateToLotes && (
              <button
                onClick={onNavigateToLotes}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Package className="w-4 h-4 text-gray-500" />
                Ir a Inventario de Lotes
              </button>
            )}
          </div>
        </div>

        {/* 4 KPIs de Resumen Global */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-100">
          <div className="bg-gray-50/70 rounded-2xl border border-gray-200/60 p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Ocupación Global</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-[#00603C] font-mono">
                  {globalStats.porcentajeGlobal}%
                </span>
                <span className="text-xs text-gray-500 font-mono">
                  {globalStats.ocupadas.toLocaleString('es-AR')} / {globalStats.totalCap.toLocaleString('es-AR')} bb
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2 overflow-hidden">
                <div 
                  className={`h-1.5 rounded-full transition-all duration-500 ${getLevelColor(globalStats.porcentajeGlobal).bgBar}`}
                  style={{ width: `${Math.min(100, globalStats.porcentajeGlobal)}%` }}
                />
              </div>
            </div>
            <div className="p-2.5 bg-[#E3EFE7] text-[#00603C] rounded-xl ml-2">
              <Warehouse className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-gray-50/70 rounded-2xl border border-gray-200/60 p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Kilos Totales Acopiados</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-black text-gray-800 font-mono">
                  {globalStats.kgTotal.toLocaleString('es-AR')}
                </span>
                <span className="text-xs font-bold text-gray-500 font-mono">kg</span>
              </div>
              <span className="text-[10px] text-gray-400 mt-1 block">En galpones de planta</span>
            </div>
            <div className="p-2.5 bg-[#F6EFDC] text-[#C9922E] rounded-xl ml-2">
              <Layers className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-gray-50/70 rounded-2xl border border-gray-200/60 p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Sectores Ocupados</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-gray-800 font-mono">
                  {globalStats.sectoresConLotes} <span className="text-sm font-semibold text-gray-400">/ 12</span>
                </span>
              </div>
              <span className="text-[10px] text-gray-400 mt-1 block">
                {12 - globalStats.sectoresConLotes} sectores libres
              </span>
            </div>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl ml-2">
              <Building2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-gray-50/70 rounded-2xl border border-gray-200/60 p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Sector con Mayor Carga</span>
              <span className="text-xs font-black text-[#00603C] block mt-1 truncate max-w-[150px]">
                {globalStats.maxOcupacionSector.key}
              </span>
              <span className="text-[10px] text-gray-500 font-mono mt-0.5 block">
                {globalStats.maxOcupacionSector.bolsas.toLocaleString('es-AR')} bb ({globalStats.maxOcupacionSector.porcentaje}%)
              </span>
            </div>
            <div className="p-2.5 bg-amber-50 text-[#C9922E] rounded-xl ml-2">
              <Flame className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Barra de Filtros Globales del Mapa */}
        <div className="mt-6 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
            {/* Buscador de Lote / Variedad */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Buscar por lote, cliente, variedad..."
                className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-[#00603C] focus:bg-white outline-hidden"
              />
              {globalSearch && (
                <button
                  onClick={() => setGlobalSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filtro Cliente Global */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Cliente:</span>
              <select
                value={globalClienteFilter}
                onChange={(e) => setGlobalClienteFilter(e.target.value)}
                aria-label="Filtro global de cliente para el mapa"
                className="py-1.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 focus:ring-2 focus:ring-[#00603C] outline-hidden"
              >
                <option value="TODOS">Todos los Clientes</option>
                {clientes.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Filtro Especie Global */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Especie:</span>
              <select
                value={globalEspecieFilter}
                onChange={(e) => setGlobalEspecieFilter(e.target.value)}
                aria-label="Filtro global de especie para el mapa"
                className="py-1.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 focus:ring-2 focus:ring-[#00603C] outline-hidden"
              >
                <option value="TODAS">Todas las Especies</option>
                {especies.map((esp) => (
                  <option key={esp} value={esp}>{esp}</option>
                ))}
              </select>
            </div>
          </div>

          {(globalClienteFilter !== 'TODOS' || globalEspecieFilter !== 'TODAS' || globalSearch) && (
            <button
              onClick={() => {
                setGlobalClienteFilter('TODOS');
                setGlobalEspecieFilter('TODAS');
                setGlobalSearch('');
              }}
              className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-xl border border-red-200 font-medium flex items-center gap-1 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Limpiar Filtros
            </button>
          )}
        </div>
      </div>

      {/* MATRIZ DE GALPONES (ALAS A, B, C, D · SECTORES 1, 2, 3) */}
      <div className="bg-white rounded-3xl border border-gray-200/80 p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <div>
            <h2 className="font-serif text-lg font-black text-gray-900 flex items-center gap-2">
              <Warehouse className="w-5 h-5 text-[#00603C]" />
              Distribución de Sectores en Galpones de Clasificadora
            </h2>
            <p className="text-xs text-gray-500 font-sans mt-0.5">
              Haga clic sobre cualquier sector para abrir su <strong>Vista de Tabla</strong>, mover lotes y auditar stock.
            </p>
          </div>

          {/* Guía de Referencia de Colores e Intensidad */}
          <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold text-gray-500 bg-gray-50 px-3 py-2 rounded-xl border border-gray-200/60">
            <span className="uppercase tracking-wider">Llenado:</span>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-gray-200 border border-gray-300"></span>
              <span>0% Vacío</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-[#00603C]"></span>
              <span>1-50% Normal</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-[#C9922E]"></span>
              <span>51-80% Medio</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-orange-500"></span>
              <span>81-100% Alto</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-red-600"></span>
              <span>&gt;100% Sobrecarga</span>
            </div>
          </div>
        </div>

        {/* Grilla de las 4 Alas (A, B, C, D) con 3 Sectores cada una */}
        <div className="space-y-6">
          {ALAS.map((ala) => (
            <div key={ala} className="bg-gray-50/50 rounded-2xl border border-gray-200/60 p-4">
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-[#00603C] text-white font-black text-xs font-mono rounded-lg tracking-wider">
                    ALA {ala}
                  </span>
                  <span className="text-xs text-gray-600 font-semibold">
                    Galpón Nave {ala}
                  </span>
                </div>
                <button
                  onClick={() => handleOpenCapacityModal(`${ala}-1`)}
                  className="text-[11px] font-bold text-[#00603C] hover:text-[#C9922E] flex items-center gap-1 cursor-pointer transition"
                  title={`Asignar capacidad a los sectores de Ala ${ala}`}
                >
                  <Edit2 className="w-3 h-3" />
                  Configurar Capacidad Ala {ala}
                </button>
              </div>

              {/* 3 Sectores del Ala */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {SECTORES.map((sec) => {
                  const sectorKey = `${ala}-${sec}`;
                  const data = sectoresData[sectorKey];
                  const isSelected = selectedSectorKey === sectorKey;
                  const colors = getLevelColor(data.porcentajeLlenado);

                  return (
                    <div
                      key={sectorKey}
                      id={`card-sector-${sectorKey}`}
                      onClick={() => {
                        setSelectedSectorKey(isSelected ? null : sectorKey);
                        setSectorClienteFilter('TODOS');
                      }}
                      className={`relative bg-white rounded-2xl p-5 border-2 transition-all duration-200 cursor-pointer select-none flex flex-col justify-between min-h-[220px] ${
                        isSelected 
                          ? 'border-[#C9922E] ring-4 ring-[#C9922E]/20 shadow-lg scale-[1.01] z-10' 
                          : 'border-gray-200/80 hover:border-[#00603C]/40 hover:shadow-md'
                      } ${colors.glow}`}
                    >
                      {/* Cabecera de la Tarjeta del Sector */}
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-gray-900 font-mono">
                              ALA {ala} · SECTOR {sec}
                            </span>
                            {isSelected && (
                              <span className="px-2 py-0.5 bg-[#C9922E] text-white text-[9px] font-bold rounded-full uppercase tracking-wider">
                                Seleccionado
                              </span>
                            )}
                          </div>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-black border ${colors.badge}`}>
                            {data.porcentajeLlenado}% LLENO
                          </span>
                        </div>

                        {/* INDICADOR DE NIVEL DE LLENADO */}
                        <div className="mt-3">
                          <div className="flex justify-between items-baseline mb-1">
                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                              Nivel de Llenado
                            </span>
                            <span className="text-xs font-mono font-bold text-gray-700">
                              {data.totalBolsas.toLocaleString('es-AR')} / {data.capacidadBolsas.toLocaleString('es-AR')} bolsas
                            </span>
                          </div>
                          {/* Barra de progreso de llenado */}
                          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden p-0.5 border border-gray-200/70">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${colors.bgBar}`}
                              style={{ width: `${Math.min(100, Math.max(0, data.porcentajeLlenado))}%` }}
                            />
                          </div>
                          {data.porcentajeLlenado > 100 && (
                            <div className="flex items-center gap-1 text-[10px] text-red-600 font-bold mt-1">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span>Sobrecarga: excede en {data.totalBolsas - data.capacidadBolsas} bolsas la capacidad.</span>
                            </div>
                          )}
                        </div>

                        {/* Kilogramos y Lotes almacenados */}
                        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-100 text-xs">
                          <div>
                            <span className="text-[9px] uppercase font-bold text-gray-400 tracking-wider block">Stock Total</span>
                            <span className="font-extrabold text-gray-800 font-mono">
                              {data.totalKg.toLocaleString('es-AR')} kg
                            </span>
                          </div>
                          <div>
                            <span className="text-[9px] uppercase font-bold text-gray-400 tracking-wider block">Lotes en Sector</span>
                            <span className="font-extrabold text-[#00603C] font-mono">
                              {data.lotes.length} {data.lotes.length === 1 ? 'lote' : 'lotes'}
                            </span>
                          </div>
                        </div>

                        {/* Especies y Variedades presentes */}
                        <div className="mt-3 flex flex-wrap gap-1">
                          {data.especies.length === 0 ? (
                            <span className="text-[10px] text-gray-400 italic">Sector vacío</span>
                          ) : (
                            data.especies.map((esp, i) => (
                              <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md text-[10px] font-bold flex items-center gap-1 font-sans">
                                {esp === 'Soja' ? '🌱' : esp === 'Trigo' ? '🌾' : esp === 'Arveja' ? '🟢' : '🌱'} {esp}
                              </span>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Pie de tarjeta: Botón para inspeccionar tabla o editar capacidad */}
                      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenCapacityModal(sectorKey);
                          }}
                          className="text-[11px] text-gray-500 hover:text-[#C9922E] flex items-center gap-1 cursor-pointer"
                          title="Ajustar capacidad manual de este sector"
                        >
                          <Edit2 className="w-3 h-3" />
                          Cap: {data.capacidadBolsas} bb
                        </button>
                        <span className={`text-[11px] font-bold ${isSelected ? 'text-[#C9922E]' : 'text-[#00603C]'}`}>
                          {isSelected ? 'Ocultar Lotes ▲' : 'Ver Lotes en Tabla ▼'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECCIÓN DETALLADA: VISTA DE TABLA DEL SECTOR SELECCIONADO */}
      {selectedSectorKey && activeSectorData && (
        <div 
          className="bg-white rounded-3xl border-2 border-[#C9922E]/40 p-6 shadow-md space-y-6 animate-in slide-in-from-top-4 duration-300"
          id="sector-tabla-detalle"
        >
          {/* Cabecera del Sector Seleccionado */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-gray-100">
            <div>
              <div className="flex items-center gap-3">
                <span className="px-3.5 py-1.5 bg-[#C9922E] text-white font-mono font-black text-sm rounded-xl shadow-xs">
                  ALA {activeSectorData.ala} · SECTOR {activeSectorData.sector}
                </span>
                <span className={`px-3 py-1 rounded-lg text-xs font-mono font-black border ${getLevelColor(activeSectorData.porcentajeLlenado).badge}`}>
                  {activeSectorData.porcentajeLlenado}% Ocupado
                </span>
                <span className="text-xs text-gray-500 font-mono">
                  {activeSectorData.totalBolsas.toLocaleString('es-AR')} / {activeSectorData.capacidadBolsas.toLocaleString('es-AR')} bolsas · {activeSectorData.totalKg.toLocaleString('es-AR')} kg
                </span>
              </div>
              <h3 className="font-serif text-lg font-bold text-gray-800 mt-2">
                Lotes acopiados actualmente en este sector físico.
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleOpenCapacityModal(selectedSectorKey)}
                className="px-3 py-1.5 bg-[#F6EFDC] text-[#00603C] hover:bg-[#ebdfc5] border border-[#C9922E]/30 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5 text-[#C9922E]" />
                Reasignar Capacidad ({activeSectorData.capacidadBolsas} bb)
              </button>
              <button
                onClick={() => setSelectedSectorKey(null)}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                Cerrar Tabla
              </button>
            </div>
          </div>

          {/* BARRA DE CONTROLES: FILTRO DE CLIENTE, ORDENAR Y AGRUPAR */}
          <div className="bg-gray-50/80 rounded-2xl border border-gray-200/70 p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 flex-1">
              {/* FILTRO DE CLIENTE PARA ESTE SECTOR */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-[#00603C]" />
                  Filtrar por Cliente:
                </span>
                <select
                  value={sectorClienteFilter}
                  onChange={(e) => setSectorClienteFilter(e.target.value)}
                  aria-label="Filtrar por cliente en este sector"
                  className="py-1.5 px-3 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:ring-2 focus:ring-[#00603C] outline-hidden shadow-2xs"
                >
                  <option value="TODOS">Todos los Clientes ({activeSectorData.lotes.length})</option>
                  {Array.from(new Set(activeSectorData.lotes.map((l) => l.cliente).filter(Boolean))).map((c) => (
                    <option key={c} value={c}>
                      {c} ({activeSectorData.lotes.filter((l) => l.cliente === c).length})
                    </option>
                  ))}
                </select>
              </div>

              {/* ORDENAR LOTES DE MANERA DESEADA */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1">
                  <ArrowUpDown className="w-3.5 h-3.5 text-[#C9922E]" />
                  Ordenar por:
                </span>
                <select
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value as any)}
                  aria-label="Campo de ordenamiento de lotes"
                  className="py-1.5 px-3 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:ring-2 focus:ring-[#00603C] outline-hidden shadow-2xs"
                >
                  <option value="stockBolsas">Bolsas (Stock)</option>
                  <option value="stockKg">Kilogramos</option>
                  <option value="loteNro">N° de Lote</option>
                  <option value="cliente">Cliente</option>
                  <option value="variedad">Variedad</option>
                  <option value="fechaIngreso">Fecha de Ingreso</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="p-1.5 bg-white border border-gray-200 hover:bg-gray-100 rounded-xl text-gray-700 transition shadow-2xs cursor-pointer"
                  title={sortOrder === 'asc' ? 'Orden Ascendente (clic para Descendente)' : 'Orden Descendente (clic para Ascendente)'}
                >
                  {sortOrder === 'asc' ? (
                    <ArrowUp className="w-4 h-4 text-[#00603C]" />
                  ) : (
                    <ArrowDown className="w-4 h-4 text-[#C9922E]" />
                  )}
                </button>
              </div>

              {/* AGRUPAR POR VARIEDAD, FECHA O CLIENTE */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  Agrupar por:
                </span>
                <select
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value as any)}
                  aria-label="Criterio de agrupación de lotes"
                  className="py-1.5 px-3 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:ring-2 focus:ring-[#00603C] outline-hidden shadow-2xs"
                >
                  <option value="none">Sin Agrupar (Lista Plana)</option>
                  <option value="variedad">Variedad de Semilla</option>
                  <option value="cliente">Cliente</option>
                  <option value="fecha">Fecha de Ingreso</option>
                </select>
              </div>
            </div>

            {/* Contador de Lotes en vista */}
            <span className="text-xs font-mono font-bold text-gray-500">
              Mostrando {filteredSortedSectorLotes.length} de {activeSectorData.lotes.length} lotes
            </span>
          </div>

          {/* BARRA DE ACCIÓN MASIVA PARA MOVER SELECCIÓN */}
          {selectedLoteIdsToMove.length > 0 && (
            <div className="bg-[#00603C] text-white rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 animate-in fade-in duration-200 shadow-md">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <ArrowRightLeft className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <span className="font-bold text-sm">
                    {selectedLoteIdsToMove.length} {selectedLoteIdsToMove.length === 1 ? 'lote seleccionado' : 'lotes seleccionados'}
                  </span>
                  <p className="text-xs text-emerald-100">
                    Mover en bloque a otro sector físico del galpón
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-xl text-xs">
                  <span>Destino:</span>
                  <select
                    value={batchTargetAla}
                    onChange={(e) => setBatchTargetAla(e.target.value as any)}
                    aria-label="Ala de destino masivo"
                    className="bg-[#004d30] text-white font-bold rounded px-2 py-1 border border-emerald-400 outline-hidden"
                  >
                    {ALAS.map((a) => (
                      <option key={a} value={a}>Ala {a}</option>
                    ))}
                  </select>
                  <select
                    value={batchTargetSector}
                    onChange={(e) => setBatchTargetSector(e.target.value as any)}
                    aria-label="Sector de destino masivo"
                    className="bg-[#004d30] text-white font-bold rounded px-2 py-1 border border-emerald-400 outline-hidden"
                  >
                    {SECTORES.map((s) => (
                      <option key={s} value={s}>Sector {s}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleBatchMoveLotes}
                  disabled={isMoving}
                  className="px-4 py-2 bg-[#C9922E] hover:bg-[#b07d25] text-white font-bold rounded-xl text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  {isMoving ? 'Moviendo...' : 'Confirmar Reubicación'}
                </button>

                <button
                  onClick={() => setSelectedLoteIdsToMove([])}
                  className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs transition"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* VISTA DE TABLA */}
          {filteredSortedSectorLotes.length === 0 ? (
            <div className="p-12 text-center text-gray-400 bg-gray-50/50 rounded-2xl border border-gray-100">
              <Warehouse className="w-10 h-10 mx-auto mb-3 opacity-40 text-gray-300" />
              <h4 className="font-serif text-base font-bold text-gray-700 mb-1">
                {activeSectorData.lotes.length === 0 ? 'Sector Vacío' : 'Sin coincidencias con el filtro de cliente'}
              </h4>
              <p className="text-xs">
                {activeSectorData.lotes.length === 0
                  ? `No hay lotes acopiados en ALA ${activeSectorData.ala} - SECTOR ${activeSectorData.sector}. Puede mover lotes hacia este sector desde otros sectores.`
                  : 'Pruebe seleccionando "Todos los Clientes" para ver los lotes de este sector.'}
              </p>
            </div>
          ) : groupBy === 'none' ? (
            /* TABLA PLANA */
            <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-2xs">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-[#00603C] text-white font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          selectedLoteIdsToMove.length === filteredSortedSectorLotes.length &&
                          filteredSortedSectorLotes.length > 0
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedLoteIdsToMove(filteredSortedSectorLotes.map((l) => l.id));
                          } else {
                            setSelectedLoteIdsToMove([]);
                          }
                        }}
                        aria-label="Seleccionar todos los lotes para mover"
                        className="rounded accent-[#C9922E] cursor-pointer"
                      />
                    </th>
                    <th className="p-3">N° Lote</th>
                    <th className="p-3">Cliente</th>
                    <th className="p-3">Especie & Variedad</th>
                    <th className="p-3">Categoría</th>
                    <th className="p-3 text-right">Bolsas</th>
                    <th className="p-3 text-right">Kilos</th>
                    <th className="p-3">Fecha Ingreso</th>
                    <th className="p-3 text-center">Mover a Sector</th>
                    <th className="p-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredSortedSectorLotes.map((lote) => {
                    const isSelectedForBatch = selectedLoteIdsToMove.includes(lote.id);
                    const isThisLoteMoving = movingLoteId === lote.id;

                    return (
                      <tr 
                        key={lote.id} 
                        className={`hover:bg-gray-50/80 transition ${
                          isSelectedForBatch ? 'bg-amber-50/50' : ''
                        }`}
                      >
                        {/* Checkbox para batch move */}
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelectedForBatch}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedLoteIdsToMove((prev) => [...prev, lote.id]);
                              } else {
                                setSelectedLoteIdsToMove((prev) => prev.filter((id) => id !== lote.id));
                              }
                            }}
                            aria-label={`Seleccionar lote ${lote.loteNro} para mover`}
                            className="rounded accent-[#C9922E] cursor-pointer"
                          />
                        </td>

                        {/* N° Lote */}
                        <td className="p-3 font-mono font-bold text-gray-900">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 bg-[#F6EFDC] text-[#00603C] rounded border border-[#C9922E]/30">
                              {lote.loteNro}
                            </span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-sans">
                              {lote.estado}
                            </span>
                          </div>
                        </td>

                        {/* Cliente */}
                        <td className="p-3 font-semibold text-gray-800">
                          {lote.cliente}
                        </td>

                        {/* Especie & Variedad */}
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">
                              {lote.especie === 'Soja' ? '🌱' : lote.especie === 'Trigo' ? '🌾' : '🟢'}
                            </span>
                            <div>
                              <span className="font-bold text-gray-800">{lote.especie}</span>
                              <span className="text-gray-500 ml-1">· {lote.variedad}</span>
                            </div>
                          </div>
                        </td>

                        {/* Categoría */}
                        <td className="p-3 text-gray-600 font-medium">
                          {lote.categoria}
                        </td>

                        {/* Bolsas */}
                        <td className="p-3 text-right font-mono font-bold text-gray-800">
                          {Number(lote.stockBolsas).toLocaleString('es-AR')} bb
                        </td>

                        {/* Kilos */}
                        <td className="p-3 text-right font-mono font-extrabold text-[#00603C]">
                          {Number(lote.stockKg).toLocaleString('es-AR')} kg
                        </td>

                        {/* Fecha Ingreso */}
                        <td className="p-3 text-gray-500 font-mono text-[11px]">
                          {lote.fechaIngreso || 'N/A'}
                        </td>

                        {/* Selector para MOVER LOTE A OTRO SECTOR */}
                        <td className="p-3 text-center">
                          {isThisLoteMoving ? (
                            <div className="flex items-center justify-center gap-1.5 bg-amber-50 p-1.5 rounded-xl border border-amber-200">
                              <select
                                value={targetAla}
                                onChange={(e) => setTargetAla(e.target.value as any)}
                                aria-label="Ala de destino"
                                className="py-1 px-1.5 bg-white border border-gray-300 rounded text-[11px] font-bold"
                              >
                                {ALAS.map((a) => (
                                  <option key={a} value={a}>Ala {a}</option>
                                ))}
                              </select>
                              <select
                                value={targetSector}
                                onChange={(e) => setTargetSector(e.target.value as any)}
                                aria-label="Sector de destino"
                                className="py-1 px-1.5 bg-white border border-gray-300 rounded text-[11px] font-bold"
                              >
                                {SECTORES.map((s) => (
                                  <option key={s} value={s}>Sec {s}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => handleMoveSingleLote(lote, targetAla, targetSector)}
                                disabled={isMoving}
                                className="px-2 py-1 bg-[#00603C] text-white rounded text-[10px] font-bold hover:bg-[#004d30] transition cursor-pointer"
                              >
                                Confirmar
                              </button>
                              <button
                                onClick={() => setMovingLoteId(null)}
                                className="p-1 text-gray-400 hover:text-gray-600"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setMovingLoteId(lote.id);
                                setTargetAla((lote.ala as any) || 'A');
                                setTargetSector((lote.sector as any) || '1');
                              }}
                              className="px-2.5 py-1 bg-gray-50 hover:bg-[#F6EFDC] text-gray-700 hover:text-[#00603C] border border-gray-200 hover:border-[#C9922E]/50 rounded-lg text-[11px] font-bold transition flex items-center gap-1 mx-auto cursor-pointer"
                              title="Reubicar este lote en otro sector físico"
                            >
                              <ArrowRightLeft className="w-3 h-3 text-[#C9922E]" />
                              Mover Sector
                            </button>
                          )}
                        </td>

                        {/* Acciones */}
                        <td className="p-3 text-center">
                          <button
                            onClick={() => onSelectLote(lote)}
                            className="px-2 py-1 bg-[#00603C] hover:bg-[#004d30] text-white rounded-lg text-[10px] font-semibold transition flex items-center gap-1 mx-auto cursor-pointer"
                            title="Ver ficha técnica completa del lote"
                          >
                            <Eye className="w-3 h-3 text-[#C9922E]" />
                            Ficha
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* TABLA AGRUPADA (POR VARIEDAD, FECHA O CLIENTE) */
            <div className="space-y-6">
              {groupedSectorLotes && Object.entries(groupedSectorLotes).map(([groupName, groupLotes]) => {
                const subBolsas = groupLotes.reduce((sum, l) => sum + (Number(l.stockBolsas) || 0), 0);
                const subKg = groupLotes.reduce((sum, l) => sum + (Number(l.stockKg) || 0), 0);

                return (
                  <div key={groupName} className="rounded-2xl border border-gray-200 overflow-hidden shadow-2xs">
                    {/* Encabezado del Grupo */}
                    <div className="bg-[#F6EFDC]/60 px-4 py-2.5 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-serif font-black text-sm text-[#00603C]">
                          {groupName}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 bg-white text-gray-600 font-mono font-bold rounded border border-gray-200">
                          {groupLotes.length} {groupLotes.length === 1 ? 'lote' : 'lotes'}
                        </span>
                      </div>
                      <div className="text-xs font-mono font-bold text-gray-700 flex items-center gap-3">
                        <span>{subBolsas.toLocaleString('es-AR')} bolsas</span>
                        <span className="text-gray-300">|</span>
                        <span className="text-[#00603C]">{subKg.toLocaleString('es-AR')} kg</span>
                      </div>
                    </div>

                    {/* Tabla del Grupo */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs font-sans">
                        <thead className="bg-gray-50 text-gray-600 font-bold uppercase text-[9px] tracking-wider border-b border-gray-200">
                          <tr>
                            <th className="p-2.5 w-10 text-center">
                              <input
                                type="checkbox"
                                checked={groupLotes.every((l) => selectedLoteIdsToMove.includes(l.id))}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedLoteIdsToMove((prev) => [
                                      ...prev,
                                      ...groupLotes.map((l) => l.id).filter((id) => !prev.includes(id))
                                    ]);
                                  } else {
                                    const groupIds = groupLotes.map((l) => l.id);
                                    setSelectedLoteIdsToMove((prev) => prev.filter((id) => !groupIds.includes(id)));
                                  }
                                }}
                                aria-label={`Seleccionar todos los lotes del grupo ${groupName}`}
                                className="rounded accent-[#C9922E] cursor-pointer"
                              />
                            </th>
                            <th className="p-2.5">N° Lote</th>
                            <th className="p-2.5">Cliente</th>
                            <th className="p-2.5">Variedad / Especie</th>
                            <th className="p-2.5 text-right">Bolsas</th>
                            <th className="p-2.5 text-right">Kilos</th>
                            <th className="p-2.5">Fecha</th>
                            <th className="p-2.5 text-center">Mover Sector</th>
                            <th className="p-2.5 text-center">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {groupLotes.map((lote) => {
                            const isSelectedForBatch = selectedLoteIdsToMove.includes(lote.id);
                            const isThisLoteMoving = movingLoteId === lote.id;

                            return (
                              <tr key={lote.id} className={`hover:bg-gray-50/70 transition ${isSelectedForBatch ? 'bg-amber-50/40' : ''}`}>
                                <td className="p-2.5 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isSelectedForBatch}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedLoteIdsToMove((prev) => [...prev, lote.id]);
                                      } else {
                                        setSelectedLoteIdsToMove((prev) => prev.filter((id) => id !== lote.id));
                                      }
                                    }}
                                    aria-label={`Seleccionar lote ${lote.loteNro} para mover`}
                                    className="rounded accent-[#C9922E] cursor-pointer"
                                  />
                                </td>
                                <td className="p-2.5 font-mono font-bold text-gray-900">
                                  <span className="px-2 py-0.5 bg-[#F6EFDC] text-[#00603C] rounded border border-[#C9922E]/30 text-xs">
                                    {lote.loteNro}
                                  </span>
                                </td>
                                <td className="p-2.5 font-semibold text-gray-800">{lote.cliente}</td>
                                <td className="p-2.5 text-gray-700">{lote.especie} {lote.variedad}</td>
                                <td className="p-2.5 text-right font-mono font-bold text-gray-800">
                                  {Number(lote.stockBolsas).toLocaleString('es-AR')} bb
                                </td>
                                <td className="p-2.5 text-right font-mono font-extrabold text-[#00603C]">
                                  {Number(lote.stockKg).toLocaleString('es-AR')} kg
                                </td>
                                <td className="p-2.5 text-gray-500 font-mono text-[11px]">{lote.fechaIngreso || 'N/A'}</td>
                                <td className="p-2.5 text-center">
                                  {isThisLoteMoving ? (
                                    <div className="flex items-center justify-center gap-1 bg-amber-50 p-1 rounded-lg border border-amber-200">
                                      <select
                                        value={targetAla}
                                        onChange={(e) => setTargetAla(e.target.value as any)}
                                        aria-label="Ala de destino"
                                        className="py-0.5 px-1 bg-white border border-gray-300 rounded text-[10px] font-bold"
                                      >
                                        {ALAS.map((a) => (
                                          <option key={a} value={a}>Ala {a}</option>
                                        ))}
                                      </select>
                                      <select
                                        value={targetSector}
                                        onChange={(e) => setTargetSector(e.target.value as any)}
                                        aria-label="Sector de destino"
                                        className="py-0.5 px-1 bg-white border border-gray-300 rounded text-[10px] font-bold"
                                      >
                                        {SECTORES.map((s) => (
                                          <option key={s} value={s}>Sec {s}</option>
                                        ))}
                                      </select>
                                      <button
                                        onClick={() => handleMoveSingleLote(lote, targetAla, targetSector)}
                                        disabled={isMoving}
                                        className="px-2 py-0.5 bg-[#00603C] text-white rounded text-[10px] font-bold cursor-pointer"
                                      >
                                        OK
                                      </button>
                                      <button
                                        onClick={() => setMovingLoteId(null)}
                                        className="text-gray-400 hover:text-gray-600"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setMovingLoteId(lote.id);
                                        setTargetAla((lote.ala as any) || 'A');
                                        setTargetSector((lote.sector as any) || '1');
                                      }}
                                      className="px-2 py-0.5 bg-gray-50 hover:bg-[#F6EFDC] text-gray-700 hover:text-[#00603C] border border-gray-200 rounded text-[10px] font-bold flex items-center gap-1 mx-auto cursor-pointer"
                                    >
                                      <ArrowRightLeft className="w-3 h-3 text-[#C9922E]" />
                                      Mover
                                    </button>
                                  )}
                                </td>
                                <td className="p-2.5 text-center">
                                  <button
                                    onClick={() => onSelectLote(lote)}
                                    className="px-2 py-0.5 bg-[#00603C] text-white rounded text-[10px] font-semibold hover:bg-[#004d30] flex items-center gap-1 mx-auto cursor-pointer"
                                  >
                                    <Eye className="w-3 h-3 text-[#C9922E]" />
                                    Ficha
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL PARA ASIGNAR DE MODO MANUAL LA CAPACIDAD TOTAL DE CADA SECTOR */}
      {isEditingCapacityModalOpen && (
        <div className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full border border-gray-200 shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#F6EFDC] text-[#00603C] rounded-xl">
                  <SlidersHorizontal className="w-5 h-5 text-[#C9922E]" />
                </div>
                <div>
                  <h3 className="font-serif text-base font-bold text-gray-900">
                    Asignar Capacidad Manual
                  </h3>
                  <p className="text-[11px] text-gray-500 font-sans">
                    Sector: <strong>ALA {editingSectorKey?.replace('-', ' - SECTOR ')}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditingCapacityModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Capacidad Máxima en Bolsas
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    step="10"
                    value={inputCapacidadBolsas}
                    onChange={(e) => setInputCapacidadBolsas(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-mono font-bold text-gray-900 focus:ring-2 focus:ring-[#00603C] focus:bg-white outline-hidden"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-gray-400">
                    bolsas
                  </span>
                </div>
                {/* Botones de presets rápidos */}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Presets:</span>
                  {[300, 500, 800, 1000, 1200].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setInputCapacidadBolsas(preset)}
                      className="px-2 py-0.5 bg-gray-100 hover:bg-[#F6EFDC] hover:text-[#00603C] text-gray-600 rounded text-[10px] font-mono font-bold transition"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Capacidad Estimada en Kilogramos (Opcional)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1000"
                    step="10000"
                    value={inputCapacidadKg}
                    onChange={(e) => setInputCapacidadKg(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-mono font-bold text-gray-900 focus:ring-2 focus:ring-[#00603C] focus:bg-white outline-hidden"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-gray-400">
                    kg
                  </span>
                </div>
              </div>

              {/* Opciones de replicación masiva */}
              <div className="pt-2 border-t border-gray-100 space-y-2 text-xs">
                <label className="flex items-center gap-2 text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyToAllInAla}
                    onChange={(e) => {
                      setApplyToAllInAla(e.target.checked);
                      if (e.target.checked) setApplyToAllPlant(false);
                    }}
                    className="rounded accent-[#00603C] cursor-pointer"
                  />
                  <span>Aplicar a todos los sectores de <strong>ALA {editingSectorKey?.split('-')[0]}</strong> (Sectores 1, 2 y 3)</span>
                </label>

                <label className="flex items-center gap-2 text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyToAllPlant}
                    onChange={(e) => {
                      setApplyToAllPlant(e.target.checked);
                      if (e.target.checked) setApplyToAllInAla(false);
                    }}
                    className="rounded accent-[#00603C] cursor-pointer"
                  />
                  <span>Aplicar a los <strong>12 sectores de toda la clasificadora</strong></span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsEditingCapacityModalOpen(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveCapacity}
                className="px-5 py-2 bg-[#00603C] hover:bg-[#004d30] text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4 text-[#C9922E]" />
                Guardar Capacidad
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
