/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Lote, MovimientoSilo, SiloId, Chofer, BolsonCampo, OrdenCarga, SILOS_PHYSICAL_ORDER, SILOS_MOBILE_ORDER, CAPACIDAD_MAX_SILO, EstadoSiloManual, SilosEstadoMap, SILOS_ESTADO_DEFAULT } from '../types';
import { SILOS_DISPONIBLES } from './SilosSelector';
import { getSiloDetailedInfo, SiloFullInfo } from '../utils/siloValidation';
import { formatNumberArg, formatKg } from '../utils/formatters';
import { DespachosSection } from './DespachosSection';
import { FichaTecnicaSiloModal } from './FichaTecnicaSiloModal';
import { GrillaSeisSilosModal } from './GrillaSeisSilosModal';
import { QrCodeModal } from './QrCodeModal';
import { SiloIcon } from './Logo';
import { unlockScannerAudio, playQrScanBeep } from '../utils/scannerAudio';
import {
  Warehouse,
  QrCode,
  Wifi,
  WifiOff,
  ClipboardList,
  FileText,
  Grid3X3,
  Flame,
  Droplets,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  Clock,
  Eye,
  Camera,
  Filter,
  History,
  ScanLine,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  CheckCircle2,
} from 'lucide-react';

interface ModoPlantaMobileViewProps {
  lotes: Lote[];
  siloStocks: Record<SiloId, number>;
  movimientosSilo: MovimientoSilo[];
  choferes: Chofer[];
  bolsones: BolsonCampo[];
  clientes: string[];
  especies: string[];
  currentUser: { nombre: string; rol: string };
  ordenesCarga: OrdenCarga[];
  silosEstadoManual?: SilosEstadoMap;
  onUpdateSiloEstadoManual?: (siloId: SiloId, estado: EstadoSiloManual) => void;
  onOpenQrScanner: () => void;
  onSelectLote: (lote: Lote) => void;
  onSaveOrdenCarga: (orden: OrdenCarga) => void;
  onUpdateOrdenStatus: (
    ordenId: string,
    nuevoEstado: 'Disponible' | 'Aceptada' | 'Despachada',
    fotoRemito?: string,
    firmaChofer?: string
  ) => void;
  onDespacharStock: (loteId: string, bolsas: number, kg: number, ordenId: string) => boolean;
  onDeleteOrdenCarga?: (id: string) => void;
  onSolicitarLogin?: () => void;
  onUpdateLoteEstado?: (lote: Lote, nuevoEstado: any) => void;
  onRegistrarIngresoSilo?: (movimiento: MovimientoSilo) => void;
}

export const ModoPlantaMobileView: React.FC<ModoPlantaMobileViewProps> = ({
  lotes,
  siloStocks: _siloStocks,
  movimientosSilo,
  choferes: _choferes,
  bolsones: _bolsones,
  clientes: _clientes,
  especies: _especies,
  currentUser,
  ordenesCarga,
  silosEstadoManual: silosEstadoManualProp,
  onUpdateSiloEstadoManual,
  onOpenQrScanner,
  onSelectLote,
  onSaveOrdenCarga,
  onUpdateOrdenStatus,
  onDespacharStock,
  onDeleteOrdenCarga,
  onSolicitarLogin: _onSolicitarLogin,
  onUpdateLoteEstado: _onUpdateLoteEstado,
  onRegistrarIngresoSilo: _onRegistrarIngresoSilo
}) => {
  // Pestañas principales de Planta Móvil: Silos, Mapa de Calor, Despachos (Playa)
  const [subTab, setSubTab] = useState<'SILOS' | 'MAPA_CALOR' | 'DESPACHOS_PLAYA'>('SILOS');
  const [isNavDropdownOpen, setIsNavDropdownOpen] = useState(false);
  const [siloSeleccionado, setSiloSeleccionado] = useState<SiloId>('Silo 1');
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));

  // Estado para acordeón de Silos desplegables verticalmente (Silo 1 al Silo 6)
  const [expandedSilos, setExpandedSilos] = useState<Record<SiloId, boolean>>({
    'Silo 1': true,
    'Silo 2': false,
    'Silo 3': false,
    'Silo 4': false,
    'Silo 5': false,
    'Silo 6': false,
  });

  const toggleSiloAccordion = (siloId: SiloId) => {
    setExpandedSilos((prev) => ({
      ...prev,
      [siloId]: !prev[siloId],
    }));
    setSiloSeleccionado(siloId);
  };

  const expandAllSilos = () => {
    setExpandedSilos({
      'Silo 1': true,
      'Silo 2': true,
      'Silo 3': true,
      'Silo 4': true,
      'Silo 5': true,
      'Silo 6': true,
    });
  };

  const collapseAllSilos = () => {
    setExpandedSilos({
      'Silo 1': false,
      'Silo 2': false,
      'Silo 3': false,
      'Silo 4': false,
      'Silo 5': false,
      'Silo 6': false,
    });
  };

  // Estados para Mapa de Calor de Acopio
  const [selectedAlaFilter, setSelectedAlaFilter] = useState<string>('TODAS');
  const [selectedHeatmapCell, setSelectedHeatmapCell] = useState<{ ala: string; sector: string } | null>(null);
  const [qrModalLote, setQrModalLote] = useState<Lote | null>(null);

  // Estado manual de Silos con 3 opciones: Ocupado (Amarillo), Vacío Sucio (Rojo), Vacío Limpio (Verde)
  const [localSilosEstadoManual, setLocalSilosEstadoManual] = useState<SilosEstadoMap>(() => {
    try {
      const saved = localStorage.getItem('agro_abacus_silos_estado_manual');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return SILOS_ESTADO_DEFAULT;
  });

  const silosEstadoManual = silosEstadoManualProp || localSilosEstadoManual;

  const handleSetEstadoManual = (siloId: SiloId, estado: EstadoSiloManual) => {
    if (onUpdateSiloEstadoManual) {
      onUpdateSiloEstadoManual(siloId, estado);
    }
    setLocalSilosEstadoManual((prev) => {
      const next = { ...prev, [siloId]: estado };
      try {
        localStorage.setItem('agro_abacus_silos_estado_manual', JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };

  // Modales de Ficha Técnica de Silos
  const [fichaModalSilo, setFichaModalSilo] = useState<SiloId | null>(null);
  const [showGrillaSeisSilos, setShowGrillaSeisSilos] = useState(false);

  // Escuchar estado de conexión online/offline
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Calcular la información detallada de los 6 silos
  const silosInfoMap = useMemo(() => {
    const map: Record<SiloId, SiloFullInfo> = {} as any;
    SILOS_DISPONIBLES.forEach((siloId) => {
      map[siloId] = getSiloDetailedInfo(siloId, movimientosSilo);
    });
    return map;
  }, [movimientosSilo]);

  const siloActivo = silosInfoMap[siloSeleccionado] || silosInfoMap['Silo 1'];

  // Totales de stock en silos
  const totalStockSilosKg = useMemo(() => {
    return (Object.values(silosInfoMap) as SiloFullInfo[]).reduce((acc, s) => acc + s.stockKg, 0);
  }, [silosInfoMap]);

  // CALCULAR DATOS DEL MAPA DE CALOR DE ACOPIO
  const alas = ['A', 'B', 'C', 'D'];
  const sectores = ['1', '2', '3'];

  // Filtrar lotes según el ala de acopio seleccionada
  const filteredLotesForHeatmap = useMemo(() => {
    if (selectedAlaFilter === 'TODAS') {
      return lotes;
    }
    return lotes.filter((l) => l.ala === selectedAlaFilter);
  }, [lotes, selectedAlaFilter]);

  const heatmapCellsData = useMemo(() => {
    const cells: Array<{
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
        const isIncludedInFilter = selectedAlaFilter === 'TODAS' || selectedAlaFilter === a;
        const cellLotes = isIncludedInFilter ? lotes.filter((l) => l.ala === a && l.sector === s) : [];
        const totalKg = cellLotes.reduce((sum, l) => sum + (l.stockKg || 0), 0);
        const totalBolsas = cellLotes.reduce((sum, l) => sum + (l.stockBolsas || 0), 0);
        const rawSpecies = cellLotes.map((l) => l.especie).filter((e): e is string => Boolean(e));
        const species: string[] = Array.from(new Set(rawSpecies));

        cells.push({
          ala: a,
          sector: s,
          totalKg,
          totalBolsas,
          lotesCount: cellLotes.length,
          species,
          lotes: cellLotes
        });
      }
    }
    return cells;
  }, [lotes, selectedAlaFilter]);

  const maxCellKg = useMemo(() => {
    return Math.max(...heatmapCellsData.map((c) => c.totalKg), 1);
  }, [heatmapCellsData]);

  const totalAcopioFiltradoKg = useMemo(() => {
    return filteredLotesForHeatmap.reduce((sum, l) => sum + (l.stockKg || 0), 0);
  }, [filteredLotesForHeatmap]);

  const totalAcopioFiltradoBolsas = useMemo(() => {
    return filteredLotesForHeatmap.reduce((sum, l) => sum + (l.stockBolsas || 0), 0);
  }, [filteredLotesForHeatmap]);

  const sectoresOcupadosCount = useMemo(() => {
    return heatmapCellsData.filter((c) => c.totalKg > 0).length;
  }, [heatmapCellsData]);

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-16">
      {/* 1. BARRA SUPERIOR DE ESTADO */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-gray-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-xl flex items-center justify-center ${
              isOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}
          >
            {isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5 animate-pulse" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500 animate-ping'}`} />
              <span className="font-bold text-sm text-gray-900">
                Planta Móvil · {isOnline ? 'En línea' : 'Sin señal'}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-[#00603C] text-[10px] font-extrabold border border-emerald-300">
                Operación en Planta
              </span>
            </div>
            <span className="text-xs text-gray-500 font-mono block mt-0.5">
              {currentUser.nombre || 'Operador Invitado'} · Consulta de Silos, Acopio y QR
            </span>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 font-mono">
          <span className="font-bold text-[#00603C]">La Barrancosa</span>
          <span>·</span>
          <span>Agro Abacus S.A.</span>
        </div>
      </div>

      {/* 2. BOTÓN HERO DESTACADO: ESCANEAR CÓDIGO QR (TAMAÑO MAXIMIZADO Y ESTÉTICA ELEVADA) */}
      <button
        id="btn-escanear-qr-planta-movil"
        type="button"
        onClick={() => {
          unlockScannerAudio();
          onOpenQrScanner();
        }}
        className="w-full relative overflow-hidden group bg-gradient-to-r from-[#003d24] via-[#00603C] to-[#004e2e] hover:from-[#004e2e] hover:to-[#00603C] text-white p-5 sm:p-7 rounded-3xl shadow-xl shadow-[#00603C]/35 border-2 border-[#C9922E] hover:border-[#f5ba42] transition-all duration-200 cursor-pointer active:scale-[0.985] flex items-center justify-between gap-4 sm:gap-6 ring-4 ring-[#C9922E]/25 min-h-[105px] sm:min-h-[120px]"
        title="Abrir Cámara para Escanear Código QR de Trazabilidad"
      >
        {/* Glow animado y destello dinámico de fondo */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-[#C9922E]/15 rounded-full blur-2xl pointer-events-none" />

        {/* Lado izquierdo: Ícono llamativo y texto maximizado */}
        <div className="flex items-center gap-4 sm:gap-5 z-10 min-w-0">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-slate-950/40 backdrop-blur-md border-2 border-[#C9922E] flex items-center justify-center shrink-0 shadow-xl group-hover:scale-105 group-hover:border-[#f5ba42] transition-transform">
            <div className="relative flex items-center justify-center">
              <QrCode className="w-9 h-9 sm:w-11 sm:h-11 text-[#C9922E] drop-shadow-md" />
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-80"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#C9922E] border-2 border-black"></span>
              </span>
            </div>
          </div>
          <div className="text-left min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-wider text-white font-sans drop-shadow-md leading-tight">
                Escanear Código QR
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-mono font-black bg-[#C9922E] text-slate-950 px-3 py-0.5 rounded-full uppercase shadow-md">
                <Camera className="w-3.5 h-3.5" /> Cámara Activa
              </span>
            </div>
            <p className="text-xs sm:text-sm text-emerald-100 font-medium leading-relaxed">
              Lectura de alta velocidad para Bolsas, Bolsones y Lotes
            </p>
          </div>
        </div>

        {/* Lado derecho: Botón táctil indicador prominente */}
        <div className="flex items-center gap-2.5 z-10 shrink-0 bg-white/20 group-hover:bg-white/30 border border-white/30 px-4 sm:px-5 py-3 sm:py-3.5 rounded-2xl text-xs sm:text-sm font-black uppercase tracking-wider text-white shadow-lg transition-all group-hover:scale-105">
          <ScanLine className="w-5 h-5 text-[#C9922E]" />
          <span className="hidden xs:inline">Escanear</span>
        </div>
      </button>

      {/* 2. BOTÓN DESPLEGABLE VERTICAL: SILOS, MAPA DE CALOR, PLAYA */}
      <div className="w-full">
        {!isNavDropdownOpen ? (
          /* Estado Colapsado: Solo es visible el botón seleccionado actual con indicador para desplegar */
          <button
            type="button"
            id="btn-nav-dropdown-toggle"
            onClick={() => setIsNavDropdownOpen(true)}
            className="w-full bg-white hover:bg-slate-50/90 text-slate-900 p-3 sm:p-3.5 rounded-2xl border-2 border-[#00603C]/30 hover:border-[#00603C] shadow-sm hover:shadow-md transition-all duration-150 cursor-pointer flex items-center justify-between gap-3 text-left group active:scale-[0.99]"
            title="Tocar para desplegar todas las opciones de Planta Móvil"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-[#00603C]/10 border border-[#00603C]/20 flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                {subTab === 'SILOS' && (
                  <SiloIcon size={24} color="#00603C" className="silo-icon-institucional shrink-0" />
                )}
                {subTab === 'MAPA_CALOR' && (
                  <Flame className="w-6 h-6 text-amber-600 shrink-0" />
                )}
                {subTab === 'DESPACHOS_PLAYA' && (
                  <ClipboardList className="w-6 h-6 text-sky-700 shrink-0" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                    VISTA ACTIVA:
                  </span>
                  <span className="text-sm font-black text-slate-950 uppercase tracking-wide">
                    {subTab === 'SILOS' && 'Silos'}
                    {subTab === 'MAPA_CALOR' && 'Mapa de Calor'}
                    {subTab === 'DESPACHOS_PLAYA' && 'Playa (Despachos)'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 truncate mt-0.5">
                  {subTab === 'SILOS' && 'Control de capacidad, semáforo y estado de los 6 silos'}
                  {subTab === 'MAPA_CALOR' && 'Distribución térmica de bolsas por sectores de acopio'}
                  {subTab === 'DESPACHOS_PLAYA' && `${ordenesCarga.length} órdenes registradas para carga y camiones`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E3EFE7] text-[#00603C] font-black text-xs rounded-xl border border-[#00603C]/30 shrink-0 group-hover:bg-[#00603C] group-hover:text-white transition-colors">
              <span className="hidden xs:inline">Cambiar</span>
              <ChevronDown className="w-4 h-4" />
            </div>
          </button>
        ) : (
          /* Estado Desplegado: Se muestran todas las opciones ordenadas de manera vertical */
          <div className="w-full bg-white rounded-2xl border-2 border-[#00603C] shadow-xl p-3 sm:p-4 space-y-2 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs">
              <span className="font-sans font-bold uppercase tracking-wider text-slate-500">
                Seleccionar Vista de Planta Móvil
              </span>
              <button
                type="button"
                onClick={() => setIsNavDropdownOpen(false)}
                className="flex items-center gap-1 text-slate-500 hover:text-slate-900 font-bold px-2 py-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <span>Cerrar</span>
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>

            {/* Lista ordenada verticalmente de opciones */}
            <div className="flex flex-col gap-2 pt-1">
              {/* Opción 1: Silos */}
              <button
                type="button"
                id="btn-dropdown-option-silos"
                onClick={() => {
                  setSubTab('SILOS');
                  setIsNavDropdownOpen(false);
                }}
                className={`w-full p-3 rounded-xl transition-all flex items-center justify-between gap-3 text-left cursor-pointer border ${
                  subTab === 'SILOS'
                    ? 'bg-[#00603C] text-white border-[#00603C] shadow-md'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      subTab === 'SILOS' ? 'bg-white/20' : 'bg-[#00603C]/10'
                    }`}
                  >
                    <SiloIcon
                      size={22}
                      color={subTab === 'SILOS' ? '#ffffff' : '#00603C'}
                      className="silo-icon-institucional shrink-0"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm uppercase tracking-wide">Silos</span>
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                          subTab === 'SILOS' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        6 Silos
                      </span>
                    </div>
                    <p
                      className={`text-xs mt-0.5 truncate ${
                        subTab === 'SILOS' ? 'text-emerald-100' : 'text-slate-500'
                      }`}
                    >
                      Control de capacidad, semáforo y fichas técnicas de los 6 silos
                    </p>
                  </div>
                </div>

                {subTab === 'SILOS' ? (
                  <CheckCircle2 className="w-5 h-5 text-amber-300 shrink-0" />
                ) : (
                  <span className="text-xs font-bold text-slate-400">Elegir</span>
                )}
              </button>

              {/* Opción 2: Mapa de Calor */}
              <button
                type="button"
                id="btn-dropdown-option-mapa-calor"
                onClick={() => {
                  setSubTab('MAPA_CALOR');
                  setIsNavDropdownOpen(false);
                }}
                className={`w-full p-3 rounded-xl transition-all flex items-center justify-between gap-3 text-left cursor-pointer border ${
                  subTab === 'MAPA_CALOR'
                    ? 'bg-[#00603C] text-white border-[#00603C] shadow-md'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      subTab === 'MAPA_CALOR' ? 'bg-white/20' : 'bg-amber-500/10'
                    }`}
                  >
                    <Flame
                      className={`w-5 h-5 shrink-0 ${
                        subTab === 'MAPA_CALOR' ? 'text-amber-300' : 'text-amber-600'
                      }`}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm uppercase tracking-wide">Mapa de Calor</span>
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                          subTab === 'MAPA_CALOR' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        Acopio
                      </span>
                    </div>
                    <p
                      className={`text-xs mt-0.5 truncate ${
                        subTab === 'MAPA_CALOR' ? 'text-emerald-100' : 'text-slate-500'
                      }`}
                    >
                      Monitoreo térmico y distribución de bolsas por sectores de acopio
                    </p>
                  </div>
                </div>

                {subTab === 'MAPA_CALOR' ? (
                  <CheckCircle2 className="w-5 h-5 text-amber-300 shrink-0" />
                ) : (
                  <span className="text-xs font-bold text-slate-400">Elegir</span>
                )}
              </button>

              {/* Opción 3: Playa */}
              <button
                type="button"
                id="btn-dropdown-option-despachos"
                onClick={() => {
                  setSubTab('DESPACHOS_PLAYA');
                  setIsNavDropdownOpen(false);
                }}
                className={`w-full p-3 rounded-xl transition-all flex items-center justify-between gap-3 text-left cursor-pointer border ${
                  subTab === 'DESPACHOS_PLAYA'
                    ? 'bg-[#00603C] text-white border-[#00603C] shadow-md'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      subTab === 'DESPACHOS_PLAYA' ? 'bg-white/20' : 'bg-sky-500/10'
                    }`}
                  >
                    <ClipboardList
                      className={`w-5 h-5 shrink-0 ${
                        subTab === 'DESPACHOS_PLAYA' ? 'text-amber-300' : 'text-sky-700'
                      }`}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm uppercase tracking-wide">Playa</span>
                      {ordenesCarga.length > 0 && (
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                            subTab === 'DESPACHOS_PLAYA'
                              ? 'bg-white/20 text-white'
                              : 'bg-sky-100 text-sky-800'
                          }`}
                        >
                          {ordenesCarga.length} órdenes
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-xs mt-0.5 truncate ${
                        subTab === 'DESPACHOS_PLAYA' ? 'text-emerald-100' : 'text-slate-500'
                      }`}
                    >
                      Gestión de órdenes de carga, camiones y despachos en planta
                    </p>
                  </div>
                </div>

                {subTab === 'DESPACHOS_PLAYA' ? (
                  <CheckCircle2 className="w-5 h-5 text-amber-300 shrink-0" />
                ) : (
                  <span className="text-xs font-bold text-slate-400">Elegir</span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 1. SECCIÓN DE SILOS: SELECTOR Y VISOR DE SOLO VISUALIZACIÓN (6 SILOS)     */}
      {/* ========================================================================= */}
      {subTab === 'SILOS' && (
        <div className="space-y-4">
          {/* Header de la sección Silos con acciones de Ficha Técnica */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-sans font-bold tracking-widest text-[#00603C] uppercase">
                    VISOR DE CONTROL DE SILOS
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[9.5px] font-bold border border-slate-200">
                    Solo Visualización
                  </span>
                </div>
                <h3 className="font-serif text-lg font-bold text-gray-900 mt-0.5">
                  Estado de Capacidad y Operaciones
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowGrillaSeisSilos(true)}
                  className="px-3 py-1.5 bg-[#E3EFE7] hover:bg-[#C2E0CC] text-[#00603C] font-bold text-xs rounded-xl transition flex items-center gap-1.5 border border-[#00603C]/30 shadow-2xs cursor-pointer"
                  title="Ver y Descargar Grilla de los 6 Silos en PDF A4"
                >
                  <Grid3X3 className="w-3.5 h-3.5" />
                  <span>Grilla 6 Silos (A4)</span>
                </button>
              </div>
            </div>

            {/* Resumen Global Rápido */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                  Stock Total en Silos
                </span>
                <span className="font-mono font-black text-[#00603C] text-sm">
                  {formatNumberArg(totalStockSilosKg, 0)} kg
                </span>
                <span className="text-[10px] text-slate-500 font-mono block">
                  {(totalStockSilosKg / 1000).toFixed(1)} Tn
                </span>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                  Capacidad Total
                </span>
                <span className="font-mono font-black text-slate-800 text-sm">
                  1.080.000 kg
                </span>
                <span className="text-[10px] text-slate-500 font-mono block">
                  1.080 Tn (6 Silos x 180 Tn)
                </span>
              </div>

              <div className="col-span-2 sm:col-span-1 p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                  Ocupación General
                </span>
                <span className="font-mono font-black text-[#C9922E] text-sm">
                  {((totalStockSilosKg / 1080000) * 100).toFixed(1)}%
                </span>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1">
                  <div
                    className="bg-[#00603C] h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (totalStockSilosKg / 1080000) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SILOS DESPLEGABLES VERTICALES (ORDENADOS DESCENDENTE SILO 1 AL SILO 6)     */}
          {/* ========================================================================= */}
          <div className="space-y-3">
            {/* Barra de control y acciones rápidas */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2">
                <SiloIcon size={24} color="#00603C" className="silo-icon-institucional shrink-0" />
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                    Silos de Planta (Silo 1 al Silo 6)
                  </h4>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Toque cualquier silo para desplegar su estado, datos técnicos y operaciones
                  </p>
                </div>
              </div>

              {/* Botones de acción: Expandir / Colapsar todos */}
              <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={expandAllSilos}
                  className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold rounded-lg border border-slate-200 shadow-2xs transition cursor-pointer flex items-center gap-1"
                  title="Desplegar todos los silos"
                >
                  <ChevronDown className="w-3 h-3 text-[#00603C]" />
                  <span>Expandir todos</span>
                </button>
                <button
                  type="button"
                  onClick={collapseAllSilos}
                  className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold rounded-lg border border-slate-200 shadow-2xs transition cursor-pointer flex items-center gap-1"
                  title="Plegar todos los silos"
                >
                  <ChevronUp className="w-3 h-3 text-slate-500" />
                  <span>Colapsar todos</span>
                </button>
              </div>
            </div>

            {/* Lista vertical de silos desplegables */}
            <div className="space-y-3" id="lista-silos-desplegables-vertical">
              {SILOS_MOBILE_ORDER.map((siloId) => {
                const info = silosInfoMap[siloId];
                const isExpanded = Boolean(expandedSilos[siloId]);
                const stock = info.stockKg;
                const pct = Math.min(100, (stock / CAPACIDAD_MAX_SILO) * 100);
                const estadoManual = silosEstadoManual[siloId] || 'VACIO_LIMPIO';

                // Configuración de Luz según Check Manual
                // 1. Silo Ocupado: Luz Amarilla
                // 2. Silo Vacío Sucio: Luz Roja
                // 3. Silo Vacío Limpio: Luz Verde
                const luzConfig = estadoManual === 'OCUPADO'
                  ? {
                      color: 'bg-amber-400',
                      glow: 'shadow-[0_0_12px_rgba(251,191,36,0.9)] ring-2 ring-amber-300',
                      texto: 'Ocupado',
                      pillClass: 'bg-amber-50 text-amber-900 border-amber-300',
                      descripcion: 'Silo con grano almacenado · Luz Amarilla activa'
                    }
                  : estadoManual === 'VACIO_SUCIO'
                  ? {
                      color: 'bg-red-500',
                      glow: 'shadow-[0_0_12px_rgba(239,68,68,0.9)] ring-2 ring-red-300',
                      texto: 'Vacío Sucio',
                      pillClass: 'bg-red-50 text-red-900 border-red-300',
                      descripcion: 'Silo vacío pendiente de limpieza o aspirado · Luz Roja activa'
                    }
                  : {
                      color: 'bg-emerald-500',
                      glow: 'shadow-[0_0_12px_rgba(16,185,129,0.9)] ring-2 ring-emerald-300',
                      texto: 'Vacío Limpio',
                      pillClass: 'bg-emerald-50 text-emerald-900 border-emerald-300',
                      descripcion: 'Silo higienizado y listo para recibir nuevo cereal · Luz Verde activa'
                    };

                return (
                  <div
                    key={siloId}
                    id={`card-silo-desplegable-${siloId.replace(' ', '-').toLowerCase()}`}
                    className={`rounded-2xl border transition-all duration-200 overflow-hidden bg-white ${
                      isExpanded
                        ? 'border-[#00603C] shadow-md ring-2 ring-[#00603C]/20'
                        : 'border-slate-200 hover:border-slate-300 shadow-xs'
                    }`}
                  >
                    {/* Encabezado Desplegable (Siempre visible, táctil) */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleSiloAccordion(siloId)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          toggleSiloAccordion(siloId);
                        }
                      }}
                      className="p-3.5 sm:p-4 cursor-pointer select-none transition-colors hover:bg-slate-50/70 active:bg-slate-100 flex items-center justify-between gap-3"
                    >
                      {/* Lado izquierdo: Ícono Silo + Nombre + Semáforo de Luz */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 border ${
                            isExpanded ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-100 border-slate-200'
                          }`}
                        >
                          <SiloIcon size={24} color="#00603C" className="silo-icon-institucional shrink-0" />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-base sm:text-lg font-serif font-black text-slate-900 tracking-tight leading-tight">
                              {siloId}
                            </span>
                            {/* Luz indicadora con resplandor */}
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`w-3 h-3 rounded-full border border-white ${luzConfig.color} ${luzConfig.glow} shrink-0`}
                                title={`${siloId}: ${luzConfig.texto}`}
                              />
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${luzConfig.pillClass}`}
                              >
                                {luzConfig.texto}
                              </span>
                            </div>
                          </div>

                          {/* Cliente y Especie resumidos */}
                          <div className="text-xs text-slate-600 font-medium truncate mt-0.5">
                            {info.cliente ? (
                              <span>
                                <strong className="text-slate-900">{info.cliente}</strong> · {info.especie}{' '}
                                {info.variedad ? `(${info.variedad})` : ''}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Sin lote asignado (Disponible)</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Lado derecho: Métricas de Stock y Flecha Desplegable */}
                      <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
                        <div className="text-right">
                          <div className="font-mono font-black text-sm sm:text-base text-slate-900 leading-tight">
                            {formatNumberArg(stock, 0)} <span className="text-[11px] font-normal text-slate-500">kg</span>
                          </div>
                          <div className="flex items-center justify-end gap-1.5 text-[11px] font-mono text-slate-500 mt-0.5">
                            <span>{(stock / 1000).toFixed(1)} Tn</span>
                            <span
                              className={`font-bold ${
                                pct >= 90 ? 'text-red-600' : pct >= 75 ? 'text-amber-600' : 'text-emerald-700'
                              }`}
                            >
                              ({pct.toFixed(0)}%)
                            </span>
                          </div>
                        </div>

                        {/* Botón visual de expandir / colapsar */}
                        <div
                          className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all duration-200 ${
                            isExpanded
                              ? 'bg-[#00603C] text-white border-[#00603C]'
                              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          <ChevronDown
                            className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? 'rotate-180' : 'rotate-0'}`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Barra de progreso rápida visible cuando está colapsado */}
                    {!isExpanded && (
                      <div className="px-4 pb-3 pt-0">
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              pct >= 95 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-[#00603C]'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* CUERPO DESPLEGABLE VERTICAL */}
                    {isExpanded && (
                      <div className="overflow-hidden border-t border-slate-200 transition-all duration-200">
                          <div className="p-4 sm:p-5 space-y-4 bg-slate-50/70">
                            {/* 1. SELECTOR DEL CHECK MANUAL DE ESTADO (SEMÁFORO DE 3 LUCES) */}
                            <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
                              <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-1">
                                <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-[#00603C]" />
                                  Luz de Estado en Planta ({siloId})
                                </span>
                                <span className="text-[10px] text-slate-500 font-medium">
                                  Seleccione para actualizar el semáforo operativo
                                </span>
                              </div>

                              <div className="grid grid-cols-3 gap-2">
                                {/* Opción 1: Ocupado (Luz Amarilla) */}
                                <button
                                  type="button"
                                  onClick={() => handleSetEstadoManual(siloId, 'OCUPADO')}
                                  className={`py-2.5 px-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition cursor-pointer border ${
                                    estadoManual === 'OCUPADO'
                                      ? 'bg-amber-400 text-amber-950 border-amber-500 shadow-xs ring-2 ring-amber-300 font-black'
                                      : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50 hover:border-amber-300'
                                  }`}
                                >
                                  <span className="w-3.5 h-3.5 rounded-full bg-amber-400 border-2 border-white shadow-xs" />
                                  <span className="text-[11px] leading-tight">Ocupado</span>
                                </button>

                                {/* Opción 2: Vacío Sucio (Luz Roja) */}
                                <button
                                  type="button"
                                  onClick={() => handleSetEstadoManual(siloId, 'VACIO_SUCIO')}
                                  className={`py-2.5 px-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition cursor-pointer border ${
                                    estadoManual === 'VACIO_SUCIO'
                                      ? 'bg-red-500 text-white border-red-600 shadow-xs ring-2 ring-red-300 font-black'
                                      : 'bg-white text-slate-700 border-slate-200 hover:bg-red-50 hover:border-red-300'
                                  }`}
                                >
                                  <span className="w-3.5 h-3.5 rounded-full bg-red-500 border-2 border-white shadow-xs" />
                                  <span className="text-[11px] leading-tight">Vacío Sucio</span>
                                </button>

                                {/* Opción 3: Vacío Limpio (Luz Verde) */}
                                <button
                                  type="button"
                                  onClick={() => handleSetEstadoManual(siloId, 'VACIO_LIMPIO')}
                                  className={`py-2.5 px-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition cursor-pointer border ${
                                    estadoManual === 'VACIO_LIMPIO'
                                      ? 'bg-emerald-500 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-300 font-black'
                                      : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50 hover:border-emerald-300'
                                  }`}
                                >
                                  <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white shadow-xs" />
                                  <span className="text-[11px] leading-tight">Vacío Limpio</span>
                                </button>
                              </div>

                              <p className="text-[11px] text-slate-500 italic">
                                {luzConfig.descripcion}
                              </p>
                            </div>

                            {/* 2. FICHA DE DATOS OPERATIVOS (4 BLOQUES) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                              {/* Cliente */}
                              <div className="p-3 bg-white rounded-xl border border-slate-200">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                                  Cliente Comitente
                                </span>
                                <div className="font-black text-[#00603C] text-sm truncate">
                                  {info.cliente || '—'}
                                </div>
                              </div>

                              {/* Especie / Variedad */}
                              <div className="p-3 bg-white rounded-xl border border-slate-200">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                                  Especie / Variedad
                                </span>
                                <div className="font-bold text-slate-800 text-sm truncate">
                                  {info.especie || '—'} · <span className="font-medium text-slate-600">{info.variedad || '—'}</span>
                                </div>
                              </div>

                              {/* Stock Actual y Capacidad Disponible */}
                              <div className="p-3 bg-white rounded-xl border border-slate-200">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                                  Stock Actual en Silo
                                </span>
                                <div className="font-mono font-black text-slate-900 text-sm">
                                  {formatNumberArg(info.stockKg, 0)} kg ({info.stockTn} Tn)
                                </div>
                                <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                                  Espacio disponible: {formatNumberArg(info.disponibleKg, 0)} kg ({info.disponibleTn} Tn)
                                </span>
                              </div>

                              {/* Humedad Promedio */}
                              <div className="p-3 bg-white rounded-xl border border-slate-200">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                                  Humedad Promedio Ponderada
                                </span>
                                <div className="font-mono font-black text-slate-800 text-sm flex items-center gap-1.5">
                                  <Droplets className="w-4 h-4 text-blue-500" />
                                  <span>{info.stockKg > 0 ? `${info.humedad}%` : '0.0%'}</span>
                                </div>
                                <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                                  Base de recibo estándar: 13.5%
                                </span>
                              </div>
                            </div>

                            {/* 3. BARRA DE CAPACIDAD Y NIVEL DE LLENADO */}
                            <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5">
                              <div className="flex justify-between text-[11px] font-bold">
                                <span className="text-slate-700">Nivel de llenado: {info.pctOcupacion}%</span>
                                <span className="text-slate-500 font-mono">Capacidad Máx: 180.000 kg (180 Tn)</span>
                              </div>
                              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    pct >= 95 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-[#00603C]'
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>

                            {/* 4. ACCIÓN DIRECTA: FICHA TÉCNICA OFICIAL */}
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => setFichaModalSilo(siloId)}
                                className="w-full sm:w-auto px-4 py-2.5 bg-[#00603C] hover:bg-[#254731] text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-98"
                              >
                                <FileText className="w-4 h-4 text-[#C9922E]" />
                                <span>Ver Ficha Técnica Oficial ({siloId})</span>
                              </button>
                            </div>

                            {/* 5. HISTORIAL DE OPERACIONES DEL SILO */}
                            <div className="space-y-2 pt-2 border-t border-slate-200">
                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                  <Clock className="w-3.5 h-3.5 text-[#00603C]" />
                                  <span>Operaciones Recientes ({siloId})</span>
                                </div>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  {info.movimientos.length} movimiento(s)
                                </span>
                              </div>

                              {info.movimientos.length === 0 ? (
                                <div className="text-center py-5 bg-white rounded-xl border border-slate-200 text-slate-400 space-y-1">
                                  <Warehouse className="w-6 h-6 mx-auto text-slate-300" />
                                  <p className="text-xs font-bold text-slate-600">Sin movimientos registrados</p>
                                  <p className="text-[11px]">No hay ingresos ni egresos cargados para este silo.</p>
                                </div>
                              ) : (
                                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                                  {info.movimientos.map((mov) => {
                                    const isIngreso = mov.tipo === 'INGRESO';
                                    const isEgreso = mov.tipo === 'EGRESO_OP' || (mov.tipo as string).startsWith('EGRESO');

                                    return (
                                      <div
                                        key={mov.id}
                                        className="p-2.5 bg-white hover:bg-slate-100/70 rounded-xl border border-slate-200/80 transition flex items-center justify-between gap-3 text-xs"
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          <div
                                            className={`p-1.5 rounded-lg shrink-0 ${
                                              isIngreso
                                                ? 'bg-emerald-100 text-emerald-800'
                                                : isEgreso
                                                ? 'bg-amber-100 text-amber-800'
                                                : 'bg-slate-200 text-slate-700'
                                            }`}
                                          >
                                            {isIngreso ? (
                                              <ArrowDownRight className="w-3.5 h-3.5" />
                                            ) : isEgreso ? (
                                              <ArrowUpRight className="w-3.5 h-3.5" />
                                            ) : (
                                              <Warehouse className="w-3.5 h-3.5" />
                                            )}
                                          </div>

                                          <div className="min-w-0">
                                            <div className="flex items-center gap-1.5">
                                              <span className="font-bold text-slate-900 truncate">
                                                {isIngreso ? 'Ingreso Camión' : isEgreso ? 'Egreso a Proceso' : 'Puesta en Cero'}
                                              </span>
                                              <span className="text-[10px] text-slate-400 font-mono">· {mov.fecha}</span>
                                            </div>
                                            <div className="text-[11px] text-slate-500 truncate">
                                              {mov.cliente ? `${mov.cliente} · ` : ''}
                                              {mov.chofer ? `Chofer: ${mov.chofer}` : mov.usuario ? `Por: ${mov.usuario}` : ''}
                                              {mov.patentes && mov.patentes !== '—' ? ` (${mov.patentes})` : ''}
                                            </div>
                                          </div>
                                        </div>

                                        <div className="text-right shrink-0">
                                          <span
                                            className={`font-mono font-bold block ${
                                              isIngreso ? 'text-emerald-700' : isEgreso ? 'text-amber-700' : 'text-slate-600'
                                            }`}
                                          >
                                            {isIngreso ? '+' : isEgreso ? '-' : ''}
                                            {formatNumberArg(mov.kg, 0)} kg
                                          </span>
                                          {mov.humedad !== undefined && (
                                            <span className="text-[10px] font-mono text-slate-400 block">
                                              Hum: {mov.humedad}%
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                  </div>
                );
              })}
            </div>

            {/* Mensaje informativo de solo lectura */}
            <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-blue-900 text-[11px] flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                <strong>Modo Solo Lectura:</strong> Para registrar ingresos de camiones, calibraciones o egresos de silos, acceda con usuario autorizado al módulo principal de Gestión de Silos.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SECCIÓN MAPA DE CALOR DE ACOPIO (SOLO LECTURA, SELECTOR DE ACOPIO)     */}
      {/* ========================================================================= */}
      {subTab === 'MAPA_CALOR' && (
        <div className="space-y-4" id="seccion-mapa-calor-acopio">
          {/* Header y Selector de Acopio / Ala */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-sans font-bold tracking-widest text-[#00603C] uppercase">
                    DEPÓSITO FÍSICO DE SEMILLAS
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[9.5px] font-bold border border-amber-200">
                    Solo Lectura
                  </span>
                </div>
                <h3 className="font-serif text-lg font-bold text-gray-900 mt-0.5 flex items-center gap-2">
                  <Flame className="w-5 h-5 text-[#C9922E]" />
                  Mapa de Calor de Acopio
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Distribución espacial de lotes acopiados por Ala y Sector en la planta.
                </p>
              </div>

              {/* Selector de Acopio / Ala */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
                  <Filter className="w-3.5 h-3.5 text-[#00603C]" />
                  <span className="font-bold text-slate-700 uppercase text-[10px]">Acopio:</span>
                  <select
                    value={selectedAlaFilter}
                    onChange={(e) => {
                      setSelectedAlaFilter(e.target.value);
                      setSelectedHeatmapCell(null);
                    }}
                    className="bg-transparent font-bold text-[#00603C] text-xs focus:outline-none cursor-pointer"
                  >
                    <option value="TODAS">Todo el Acopio (Alas A, B, C, D)</option>
                    <option value="A">Ala A (Sectores 1, 2, 3)</option>
                    <option value="B">Ala B (Sectores 1, 2, 3)</option>
                    <option value="C">Ala C (Sectores 1, 2, 3)</option>
                    <option value="D">Ala D (Sectores 1, 2, 3)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Tarjetas de Insights del Acopio Seleccionado */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                  Ocupación
                </span>
                <span className="font-mono font-black text-[#00603C] text-sm">
                  {sectoresOcupadosCount} / 12 <span className="text-[10px] font-normal text-slate-500">Sectores</span>
                </span>
                <span className="text-[10px] text-slate-500 font-medium block">
                  {((sectoresOcupadosCount / 12) * 100).toFixed(0)}% de celdas con stock
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                  Total Kg Acopiados
                </span>
                <span className="font-mono font-black text-slate-900 text-sm">
                  {formatKg(totalAcopioFiltradoKg)}
                </span>
                <span className="text-[10px] text-slate-500 font-medium block">
                  {(totalAcopioFiltradoKg / 1000).toFixed(1)} Tn en acopio
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                  Total Bolsas
                </span>
                <span className="font-mono font-black text-slate-900 text-sm">
                  {formatNumberArg(totalAcopioFiltradoBolsas, 0)}{' '}
                  <span className="text-[10px] font-normal text-slate-500">und</span>
                </span>
                <span className="text-[10px] text-slate-500 font-medium block">
                  {filteredLotesForHeatmap.length} lotes totales
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                  Mayor Concentración
                </span>
                <span className="font-bold text-[#00603C] text-xs truncate block">
                  {(() => {
                    const sortedCells = [...heatmapCellsData].sort((a, b) => b.totalKg - a.totalKg);
                    if (sortedCells[0] && sortedCells[0].totalKg > 0) {
                      return `ALA ${sortedCells[0].ala} - SEC ${sortedCells[0].sector}`;
                    }
                    return 'Vacío';
                  })()}
                </span>
                <span className="text-[10px] font-mono text-slate-500 block">
                  {(() => {
                    const sortedCells = [...heatmapCellsData].sort((a, b) => b.totalKg - a.totalKg);
                    if (sortedCells[0] && sortedCells[0].totalKg > 0) {
                      return formatKg(sortedCells[0].totalKg);
                    }
                    return '0 kg';
                  })()}
                </span>
              </div>
            </div>
          </div>

          {/* Grilla Visual del Mapa de Calor */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-gray-100">
              <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                Cuadrícula de Acopio ({selectedAlaFilter === 'TODAS' ? 'Todas las Alas' : `Ala ${selectedAlaFilter}`})
              </span>

              {/* Referencia de Intensidad */}
              <div className="flex items-center gap-2.5 text-[10px] font-bold text-slate-500">
                <span>INTENSIDAD:</span>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-slate-100 border border-slate-200"></span>
                  <span>Vacío</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-[#00603C]/10 border border-[#00603C]/20"></span>
                  <span>Bajo</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-[#00603C]/35 border border-[#00603C]/50"></span>
                  <span>Medio</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-[#00603C]/80 border border-[#00603C]"></span>
                  <span>Máximo</span>
                </div>
              </div>
            </div>

            {/* Grid 4x3 del Depósito */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-stretch">
              {/* Cabeceras de Ala en pantallas md */}
              <div className="hidden md:flex flex-col justify-around text-center py-4 text-xs font-black uppercase text-slate-400 font-sans tracking-widest bg-slate-50/70 rounded-2xl border border-slate-200/60 w-full min-h-[320px]">
                {alas.map((a) => (
                  <div
                    key={a}
                    className={
                      selectedAlaFilter !== 'TODAS' && selectedAlaFilter !== a
                        ? 'opacity-30'
                        : 'text-slate-700 font-extrabold'
                    }
                  >
                    Ala {a}
                  </div>
                ))}
              </div>

              {/* Sectores 1, 2 y 3 */}
              <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Sector headers */}
                <div className="sm:col-span-3 grid grid-cols-3 text-center text-[10px] font-black uppercase tracking-wider text-slate-400 mb-0.5">
                  <div>Sector 1</div>
                  <div>Sector 2</div>
                  <div>Sector 3</div>
                </div>

                {/* Renderizar las celdas */}
                {heatmapCellsData.map((cell, idx) => {
                  const isSelected =
                    selectedHeatmapCell?.ala === cell.ala && selectedHeatmapCell?.sector === cell.sector;
                  const isDimmed = selectedAlaFilter !== 'TODAS' && selectedAlaFilter !== cell.ala;

                  return (
                    <div key={idx} className="relative">
                      {/* Indicador de Ala para móviles */}
                      <div className="md:hidden block text-[10px] font-bold text-[#00603C] uppercase mb-1 px-1">
                        Ala {cell.ala} - Sector {cell.sector}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedHeatmapCell(null);
                          } else {
                            setSelectedHeatmapCell({ ala: cell.ala, sector: cell.sector });
                          }
                        }}
                        className={`w-full p-3.5 rounded-2xl border-2 transition duration-200 text-center flex flex-col justify-between h-32 relative select-none cursor-pointer ${
                          isSelected
                            ? 'border-[#C9922E] ring-2 ring-[#C9922E]/30 shadow-md z-10 scale-[1.02] bg-white'
                            : 'border-transparent'
                        } ${
                          isDimmed
                            ? 'opacity-25 pointer-events-none'
                            : cell.totalKg === 0
                            ? 'bg-slate-50 text-slate-400 border-slate-200/60 hover:bg-slate-100'
                            : cell.totalKg / maxCellKg <= 0.25
                            ? 'bg-[#00603C]/5 text-[#00603C] border-[#00603C]/15 hover:bg-[#00603C]/10'
                            : cell.totalKg / maxCellKg <= 0.6
                            ? 'bg-[#00603C]/25 text-[#00603C] border-[#00603C]/35 hover:bg-[#00603C]/30'
                            : 'bg-[#00603C]/80 text-white border-[#00603C] hover:bg-[#00603C]/90 shadow-xs'
                        }`}
                      >
                        {/* Header de celda */}
                        <div className="flex justify-between items-center text-[9px] uppercase tracking-wider font-extrabold opacity-90">
                          <span>ALA {cell.ala}</span>
                          <span>SEC {cell.sector}</span>
                        </div>

                        {/* Stock Kg */}
                        <div className="my-1">
                          <div className="text-sm sm:text-base font-extrabold font-mono leading-none">
                            {formatKg(cell.totalKg)}
                          </div>
                          <div className="text-[10px] font-medium opacity-90 mt-1 leading-none">
                            {formatNumberArg(cell.totalBolsas)} b. · {cell.lotesCount}{' '}
                            {cell.lotesCount === 1 ? 'lote' : 'lotes'}
                          </div>
                        </div>

                        {/* Especie Pill */}
                        <div className="flex justify-center">
                          {cell.totalKg === 0 ? (
                            <span className="text-[8.5px] px-1.5 py-0.5 bg-slate-200/70 text-slate-500 rounded font-bold uppercase font-sans">
                              Vacío
                            </span>
                          ) : cell.species.length === 1 ? (
                            <span
                              className={`text-[8.5px] px-2 py-0.5 rounded font-extrabold uppercase truncate max-w-[120px] font-sans ${
                                cell.totalKg / maxCellKg > 0.6 ? 'bg-white text-[#00603C]' : 'bg-[#00603C] text-white'
                              }`}
                            >
                              {cell.species[0]}
                            </span>
                          ) : (
                            <span
                              className={`text-[8.5px] px-2 py-0.5 rounded font-extrabold uppercase font-sans ${
                                cell.totalKg / maxCellKg > 0.6 ? 'bg-[#C9922E] text-white' : 'bg-[#C9922E] text-white'
                              }`}
                            >
                              MULTI ({cell.species.length})
                            </span>
                          )}
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-3 bg-emerald-50/60 border border-emerald-200/60 rounded-xl flex items-start gap-2 text-xs text-emerald-950">
              <Info className="w-4 h-4 text-[#00603C] shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>Toque cualquier celda</strong> para ver el detalle de los lotes almacenados en esa ubicación física. Todos los lotes se muestran en <strong>modo solo lectura</strong> con acceso directo a su Ficha Técnica y Código QR.
              </p>
            </div>
          </div>

          {/* LISTA DE LOTES QUE INTEGRAN EL ACOPIO O CELDA SELECCIONADA (SOLO LECTURA) */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-gray-100">
              <div>
                <span className="text-[10px] font-mono font-black uppercase text-[#C9922E] tracking-wider block">
                  {selectedHeatmapCell
                    ? `LOTES EN ALA ${selectedHeatmapCell.ala} - SECTOR ${selectedHeatmapCell.sector}`
                    : `LOTES EN ${selectedAlaFilter === 'TODAS' ? 'EL ACOPIO GENERAL' : `ALA ${selectedAlaFilter}`}`}
                </span>
                <h4 className="font-serif text-base font-bold text-slate-900">
                  Lotes que integran este Acopio
                </h4>
              </div>

              {selectedHeatmapCell && (
                <button
                  type="button"
                  onClick={() => setSelectedHeatmapCell(null)}
                  className="px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition cursor-pointer"
                >
                  Ver todos los lotes del acopio
                </button>
              )}
            </div>

            {/* Renderizar lotes */}
            {(() => {
              const displayLotes = selectedHeatmapCell
                ? lotes.filter(
                    (l) => l.ala === selectedHeatmapCell.ala && l.sector === selectedHeatmapCell.sector
                  )
                : filteredLotesForHeatmap;

              if (displayLotes.length === 0) {
                return (
                  <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <Warehouse className="w-8 h-8 mx-auto text-slate-300 mb-1" />
                    <p className="text-xs font-bold text-slate-700">
                      Sin lotes almacenados en esta ubicación
                    </p>
                    <p className="text-[11px] text-slate-500">
                      No hay existencias de semillas asignadas a este sector físico.
                    </p>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {displayLotes.map((lote) => (
                    <div
                      key={lote.id}
                      className="bg-slate-50/70 hover:bg-white hover:border-[#00603C]/40 transition-all rounded-2xl border border-slate-200 p-3.5 flex flex-col justify-between gap-2.5 shadow-2xs"
                    >
                      {/* Cabecera del Lote */}
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <span className="px-2 py-0.5 bg-[#00603C] text-white text-[10px] font-mono font-black rounded">
                            LOTE: {lote.loteNro}
                          </span>
                          <h5
                            className="font-serif text-sm font-bold text-slate-900 mt-1 truncate"
                            title={lote.cliente}
                          >
                            {lote.cliente}
                          </h5>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shrink-0 bg-emerald-100 text-emerald-800 border border-emerald-300">
                          {lote.estado}
                        </span>
                      </div>

                      {/* Datos de Variedad y Stock */}
                      <div className="grid grid-cols-2 gap-2 text-xs py-1.5 border-t border-b border-slate-200/80 bg-white/60 px-2 rounded-lg">
                        <div>
                          <span className="text-slate-400 block uppercase font-bold text-[8.5px]">
                            Especie / Variedad
                          </span>
                          <span className="font-bold text-slate-800 truncate block text-[11px]">
                            {lote.especie} · {lote.variedad}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block uppercase font-bold text-[8.5px]">
                            Stock Acopiado
                          </span>
                          <span className="font-mono font-extrabold text-[#00603C] block text-[11px]">
                            {formatKg(lote.stockKg)} ({formatNumberArg(lote.stockBolsas)} b.)
                          </span>
                        </div>
                      </div>

                      {/* Ubicación y Acciones (SOLO LECTURA: Ver Ficha y QR, SIN botón de edición) */}
                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <span className="text-[10px] font-mono text-slate-500 font-bold flex items-center gap-1">
                          <Warehouse className="w-3 h-3 text-[#C9922E]" />
                          {lote.ala && lote.sector ? `Ala ${lote.ala} - Sec ${lote.sector}` : 'Sin ubicar'}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {/* Botón QR */}
                          <button
                            type="button"
                            onClick={() => setQrModalLote(lote)}
                            className="p-1.5 text-slate-600 hover:text-[#00603C] hover:bg-slate-200 rounded-lg transition cursor-pointer"
                            title="Ver Código QR"
                          >
                            <QrCode className="w-4 h-4 text-[#C9922E]" />
                          </button>

                          {/* Botón Ficha Técnica */}
                          <button
                            type="button"
                            onClick={() => onSelectLote(lote)}
                            className="px-2.5 py-1 bg-[#00603C] hover:bg-[#254731] text-white rounded-lg text-[10.5px] font-bold transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                            title="Abrir Ficha Técnica Oficial del Lote"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#C9922E]" />
                            <span>Ficha</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. DESPACHOS (MIS ÓRDENES - PLAYA)                                        */}
      {/* ========================================================================= */}
      {subTab === 'DESPACHOS_PLAYA' && (
        <div className="space-y-4">
          <div className="bg-[#00603C] text-white p-4 rounded-2xl shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ClipboardList className="w-5 h-5 text-[#C9922E]" />
              <div>
                <span className="text-[10px] font-mono tracking-widest text-[#C9922E] uppercase block">
                  Playa de Carga y Despachos
                </span>
                <h3 className="font-serif text-base font-bold">Mis Órdenes (Playa)</h3>
              </div>
            </div>
          </div>

          <DespachosSection
            lotes={lotes}
            ordenes={ordenesCarga}
            onSaveOrden={onSaveOrdenCarga}
            onUpdateOrdenStatus={onUpdateOrdenStatus}
            onDespacharStock={onDespacharStock}
            onDeleteOrden={onDeleteOrdenCarga}
            onlyMisOrdenes={true}
          />
        </div>
      )}

      {/* Modal Ficha Técnica Oficial de Silo (Individual) */}
      {fichaModalSilo && (
        <FichaTecnicaSiloModal
          ficha={
            silosInfoMap[fichaModalSilo]
              ? {
                  siloId: fichaModalSilo,
                  stockKg: silosInfoMap[fichaModalSilo].stockKg,
                  stockTn: silosInfoMap[fichaModalSilo].stockTn,
                  pctOcupacion: silosInfoMap[fichaModalSilo].pctOcupacion,
                  cliente: silosInfoMap[fichaModalSilo].cliente,
                  especie: silosInfoMap[fichaModalSilo].especie,
                  variedad: silosInfoMap[fichaModalSilo].variedad,
                  categoria: silosInfoMap[fichaModalSilo].categoria,
                  humedad: silosInfoMap[fichaModalSilo].humedad,
                  ingresosActivos: silosInfoMap[fichaModalSilo].ingresosActivos,
                  totalIngresos: silosInfoMap[fichaModalSilo].totalIngresos,
                  totalKgIngresados: silosInfoMap[fichaModalSilo].totalKgIngresados,
                  totalKgEgresados: silosInfoMap[fichaModalSilo].totalKgEgresados,
                  ultimoMovimiento: silosInfoMap[fichaModalSilo].movimientos[0]?.fecha || 'Sin registros'
                }
              : null
          }
          onClose={() => setFichaModalSilo(null)}
        />
      )}

      {/* Modal Grilla de 6 Fichas Técnicas en 1 Hoja A4 */}
      {showGrillaSeisSilos && (
        <GrillaSeisSilosModal
          fichas={SILOS_DISPONIBLES.map((s) => {
            const info = silosInfoMap[s];
            return {
              siloId: s,
              stockKg: info.stockKg,
              stockTn: info.stockTn,
              pctOcupacion: info.pctOcupacion,
              cliente: info.cliente,
              especie: info.especie,
              variedad: info.variedad,
              categoria: info.categoria,
              humedad: info.humedad,
              ingresosActivos: info.ingresosActivos,
              totalIngresos: info.totalIngresos,
              totalKgIngresados: info.totalKgIngresados,
              totalKgEgresados: info.totalKgEgresados,
              ultimoMovimiento: info.movimientos[0]?.fecha || 'Sin registros'
            };
          })}
          onClose={() => setShowGrillaSeisSilos(false)}
        />
      )}

      {/* Modal de Código QR para Lote del Mapa de Calor */}
      {qrModalLote && <QrCodeModal lote={qrModalLote} onClose={() => setQrModalLote(null)} />}
    </div>
  );
};
