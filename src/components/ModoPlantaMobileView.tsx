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
  ScanLine
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
  const [siloSeleccionado, setSiloSeleccionado] = useState<SiloId>('Silo 1');
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));

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
      {/* 1. BARRA SUPERIOR DE ESTADO Y BOTÓN DESTACADO DE ESCÁNER QR */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                Acceso Público
              </span>
            </div>
            <span className="text-xs text-gray-500 font-mono block mt-0.5">
              {currentUser.nombre || 'Operador Invitado'} · Consulta de Silos, Acopio y QR
            </span>
          </div>
        </div>

        {/* Botón Dedicado de Escáner QR */}
        <button
          id="btn-escanear-qr-planta-movil"
          type="button"
          onClick={() => {
            unlockScannerAudio();
            onOpenQrScanner();
          }}
          className="w-full sm:w-auto px-4 py-3 bg-[#00603C] hover:bg-[#254731] text-white rounded-xl shadow-md transition-all duration-200 flex items-center justify-center gap-2.5 text-xs font-black uppercase tracking-wider cursor-pointer active:scale-98 ring-2 ring-[#C9922E]/40"
          title="Abrir Cámara para Escanear Código QR de Trazabilidad"
        >
          <Camera className="w-4 h-4 text-[#C9922E]" />
          <span>Escanear Código QR</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-white/20 rounded text-emerald-100">Cámara</span>
        </button>
      </div>

      {/* 2. SELECTOR DE PESTAÑAS PRINCIPALES: SILOS, MAPA DE CALOR, MIS ÓRDENES */}
      <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/60 shadow-2xs">
        {/* Botón 1: Silos */}
        <button
          id="btn-subtab-silos"
          type="button"
          onClick={() => setSubTab('SILOS')}
          className={`py-3 px-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer ${
            subTab === 'SILOS'
              ? 'bg-[#00603C] text-white shadow-md'
              : 'text-slate-600 hover:text-slate-950 hover:bg-white/60'
          }`}
        >
          <SiloIcon size={24} color={subTab === 'SILOS' ? '#ffffff' : '#00603C'} className="silo-icon-institucional shrink-0" />
          <span className="truncate">Silos</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold shrink-0 ${
              subTab === 'SILOS' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}
          >
            6
          </span>
        </button>

        {/* Botón 2: Mapa de Calor de Acopio */}
        <button
          id="btn-subtab-mapa-calor"
          type="button"
          onClick={() => setSubTab('MAPA_CALOR')}
          className={`py-3 px-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer ${
            subTab === 'MAPA_CALOR'
              ? 'bg-[#00603C] text-white shadow-md'
              : 'text-slate-600 hover:text-slate-950 hover:bg-white/60'
          }`}
        >
          <Flame className={`w-4 h-4 shrink-0 ${subTab === 'MAPA_CALOR' ? 'text-[#C9922E]' : 'text-slate-500'}`} />
          <span className="truncate">Mapa de Calor</span>
        </button>

        {/* Botón 3: Mis Órdenes (Playa) */}
        <button
          id="btn-subtab-despachos"
          type="button"
          onClick={() => setSubTab('DESPACHOS_PLAYA')}
          className={`py-3 px-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer ${
            subTab === 'DESPACHOS_PLAYA'
              ? 'bg-[#00603C] text-white shadow-md'
              : 'text-slate-600 hover:text-slate-950 hover:bg-white/60'
          }`}
        >
          <ClipboardList className={`w-4 h-4 shrink-0 ${subTab === 'DESPACHOS_PLAYA' ? 'text-[#C9922E]' : 'text-slate-500'}`} />
          <span className="truncate">Playa</span>
          {ordenesCarga.length > 0 && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold shrink-0 ${
                subTab === 'DESPACHOS_PLAYA' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {ordenesCarga.length}
            </span>
          )}
        </button>
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

          {/* DISPOSICIÓN EN PLANTA MÓVIL: FILA ÚNICA ORDENADA DESCENDENTE (SILO 6 A SILO 1) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <SiloIcon size={24} color="#00603C" className="silo-icon-institucional shrink-0" />
                <span>Sector Silos (Silo 6 al Silo 1 - Fila Única)</span>
              </div>
              <span className="text-[10px] text-slate-500 font-medium">
                Deslice horizontalmente · Toque para ver detalle
              </span>
            </div>

            {/* Fila única de silos ordenados en forma descendente desde Silo 6 hasta Silo 1 */}
            <div className="flex flex-row overflow-x-auto gap-4 py-2 px-1 pb-4 snap-x custom-scrollbar">
              {SILOS_MOBILE_ORDER.map((siloId) => {
                const info = silosInfoMap[siloId];
                const isSelected = siloSeleccionado === siloId;
                const stock = info.stockKg;
                const pct = Math.min(100, (stock / CAPACIDAD_MAX_SILO) * 100);
                const estadoManual = silosEstadoManual[siloId] || 'VACIO_LIMPIO';

                // Configuración de la Luz según el Check Manual
                // 1. Silo Ocupado: Luz Amarilla
                // 2. Silo Vacío Sucio: Luz Roja
                // 3. Silo Vacío Limpio: Luz Verde
                const luzConfig = estadoManual === 'OCUPADO'
                  ? {
                      color: 'bg-amber-400',
                      glow: 'shadow-[0_0_16px_rgba(251,191,36,0.9)] ring-2 ring-amber-300',
                      border: 'border-amber-500',
                      texto: 'Silo Ocupado',
                      pillClass: 'bg-amber-100 text-amber-900 border-amber-300'
                    }
                  : estadoManual === 'VACIO_SUCIO'
                  ? {
                      color: 'bg-red-500',
                      glow: 'shadow-[0_0_16px_rgba(239,68,68,0.9)] ring-2 ring-red-400 animate-pulse',
                      border: 'border-red-600',
                      texto: 'Silo Vacío Sucio',
                      pillClass: 'bg-red-100 text-red-900 border-red-300'
                    }
                  : {
                      color: 'bg-emerald-500',
                      glow: 'shadow-[0_0_16px_rgba(16,185,129,0.9)] ring-2 ring-emerald-300',
                      border: 'border-emerald-600',
                      texto: 'Silo Vacío Limpio',
                      pillClass: 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    };

                return (
                  <div
                    key={siloId}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSiloSeleccionado(siloId)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setSiloSeleccionado(siloId);
                      }
                    }}
                    className={`min-w-[260px] max-w-[280px] sm:min-w-[290px] aspect-square rounded-full border-4 text-center transition-all duration-300 relative overflow-hidden flex flex-col items-center justify-between p-4 sm:p-5 cursor-pointer shrink-0 snap-center ${
                      isSelected
                        ? 'bg-slate-900 border-[#00603C] text-white shadow-2xl ring-4 ring-emerald-400/50 scale-[1.02]'
                        : 'bg-white border-slate-300 hover:border-[#00603C] text-slate-900 shadow-md hover:shadow-xl'
                    }`}
                  >
                    {/* 1. LUZ DE ESTADO Y ETIQUETA EN LA PARTE SUPERIOR */}
                    <div className="flex flex-col items-center gap-1 mt-1 z-10">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-4 h-4 rounded-full border-2 border-white ${luzConfig.color} ${luzConfig.glow} transition-all duration-300`}
                          title={`${siloId}: ${luzConfig.texto}`}
                        />
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                          isSelected
                            ? 'bg-slate-800 text-slate-200 border-slate-700'
                            : luzConfig.pillClass
                        }`}>
                          {luzConfig.texto}
                        </span>
                      </div>
                    </div>

                    {/* 2. CENTRO: ÍCONO DEL SILO + NOMBRE + STOCK */}
                    <div className="flex flex-col items-center justify-center my-auto z-10">
                      <div className="p-1.5 rounded-full bg-emerald-500/10 mb-1 flex items-center justify-center">
                        <SiloIcon
                          size={24}
                          color="#00603C"
                          className="silo-icon-institucional shrink-0"
                        />
                      </div>
                      
                      <h3 className={`text-xl sm:text-2xl font-black font-serif tracking-tight ${
                        isSelected ? 'text-emerald-400' : 'text-slate-900'
                      }`}>
                        {siloId}
                      </h3>

                      <div className={`text-base sm:text-lg font-black font-mono tracking-tight mt-0.5 ${
                        isSelected ? 'text-white' : 'text-slate-900'
                      }`}>
                        {stock.toLocaleString('es-AR')} <span className="text-xs font-normal opacity-80">kg</span>
                      </div>

                      <div className="flex items-center gap-2 text-[10px] sm:text-xs font-semibold mt-0.5">
                        <span className={isSelected ? 'text-slate-300' : 'text-slate-500'}>
                          {(stock / 1000).toFixed(1)} / 180 Tn
                        </span>
                        <span className={`font-mono font-bold ${
                          isSelected ? 'text-emerald-300' : 'text-emerald-700'
                        }`}>
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    {/* 3. PARTE INFERIOR: SELECTOR DE CHECK MANUAL (3 OPCIONES) */}
                    <div className="flex flex-col items-center gap-1.5 w-full mb-1 z-10">
                      <div
                        className={`flex items-center justify-center gap-1 p-1 rounded-full border shadow-inner ${
                          isSelected ? 'bg-slate-800/90 border-slate-700' : 'bg-slate-100 border-slate-200'
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Opción 1: Silo Ocupado (Amarillo) */}
                        <button
                          type="button"
                          title="Activar Silo Ocupado (Luz Amarilla)"
                          onClick={() => handleSetEstadoManual(siloId, 'OCUPADO')}
                          className={`px-2 py-1 rounded-full text-[9px] font-bold flex items-center gap-1 transition cursor-pointer ${
                            estadoManual === 'OCUPADO'
                              ? 'bg-amber-400 text-amber-950 font-black shadow-xs ring-1 ring-amber-500'
                              : isSelected
                              ? 'text-slate-300 hover:text-white hover:bg-slate-700'
                              : 'text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          <span className="w-2 h-2 rounded-full bg-amber-500 border border-amber-600 inline-block"></span>
                          <span>Ocupado</span>
                        </button>

                        {/* Opción 2: Silo Vacío Sucio (Rojo) */}
                        <button
                          type="button"
                          title="Activar Silo Vacío Sucio (Luz Roja)"
                          onClick={() => handleSetEstadoManual(siloId, 'VACIO_SUCIO')}
                          className={`px-2 py-1 rounded-full text-[9px] font-bold flex items-center gap-1 transition cursor-pointer ${
                            estadoManual === 'VACIO_SUCIO'
                              ? 'bg-red-500 text-white font-black shadow-xs ring-1 ring-red-600'
                              : isSelected
                              ? 'text-slate-300 hover:text-white hover:bg-slate-700'
                              : 'text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          <span className="w-2 h-2 rounded-full bg-red-600 border border-white inline-block"></span>
                          <span>V. Sucio</span>
                        </button>

                        {/* Opción 3: Silo Vacío Limpio (Verde) */}
                        <button
                          type="button"
                          title="Activar Silo Vacío Limpio (Luz Verde)"
                          onClick={() => handleSetEstadoManual(siloId, 'VACIO_LIMPIO')}
                          className={`px-2 py-1 rounded-full text-[9px] font-bold flex items-center gap-1 transition cursor-pointer ${
                            estadoManual === 'VACIO_LIMPIO'
                              ? 'bg-emerald-500 text-white font-black shadow-xs ring-1 ring-emerald-600'
                              : isSelected
                              ? 'text-slate-300 hover:text-white hover:bg-slate-700'
                              : 'text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          <span className="w-2 h-2 rounded-full bg-emerald-400 border border-white inline-block"></span>
                          <span>V. Limpio</span>
                        </button>
                      </div>

                      {/* Acciones Rápidas (Ficha) */}
                      <div className="flex items-center justify-center gap-3 text-[9px] font-bold">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFichaModalSilo(siloId);
                          }}
                          className={`hover:underline flex items-center gap-0.5 ${
                            isSelected ? 'text-emerald-300' : 'text-emerald-700'
                          }`}
                        >
                          <Eye className="w-2.5 h-2.5" /> Ficha Técnica
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* DETALLE COMPLETO DEL SILO SELECCIONADO (SOLO VISUALIZACIÓN) */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            {/* Header del Detalle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0 shadow-xs">
                  <SiloIcon size={24} color="#00603C" className="silo-icon-institucional shrink-0" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-serif text-lg font-black text-slate-900 leading-tight">
                      Detalle {siloActivo.siloId}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        siloActivo.stockKg > 0
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-slate-100 text-slate-600 border-slate-300'
                      }`}
                    >
                      {siloActivo.stockKg > 0 ? 'Con Stock' : 'Silo Vacío'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Planta de Clasificación de Semillas · La Barrancosa
                  </p>
                </div>
              </div>

              {/* Botón para abrir la Ficha Técnica Oficial */}
              <button
                type="button"
                onClick={() => setFichaModalSilo(siloActivo.siloId)}
                className="px-3.5 py-2 bg-[#00603C] hover:bg-[#254731] text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
              >
                <FileText className="w-3.5 h-3.5 text-[#C9922E]" />
                <span>Ver Ficha Técnica Oficial</span>
              </button>
            </div>

            {/* Ficha Resumen de 5 Campos de Datos */}
            <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/70 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Cliente destacado */}
                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                    Cliente Comitente
                  </span>
                  <div className="font-sans font-black text-[#00603C] text-sm truncate" title={siloActivo.cliente}>
                    {siloActivo.cliente}
                  </div>
                </div>

                {/* Especie y Variedad */}
                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                    Especie / Variedad
                  </span>
                  <div className="font-bold text-slate-800 text-sm">
                    {siloActivo.especie} · <span className="font-medium text-slate-600">{siloActivo.variedad}</span>
                  </div>
                </div>

                {/* Stock Actual y Capacidad */}
                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                    Stock Actual en Silo
                  </span>
                  <div className="font-mono font-black text-slate-900 text-sm">
                    {formatNumberArg(siloActivo.stockKg, 0)} kg ({siloActivo.stockTn} Tn)
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                    Espacio disponible: {formatNumberArg(siloActivo.disponibleKg, 0)} kg ({siloActivo.disponibleTn} Tn)
                  </span>
                </div>

                {/* Humedad Promedio */}
                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                    Humedad Promedio Ponderada
                  </span>
                  <div className="font-mono font-black text-slate-800 text-sm flex items-center gap-1.5">
                    <Droplets className="w-4 h-4 text-blue-500" />
                    <span>{siloActivo.stockKg > 0 ? `${siloActivo.humedad}%` : '0.0%'}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                    Base de recibo estándar: 13.5%
                  </span>
                </div>
              </div>

              {/* Barra de progreso de llenado */}
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-[11px] font-bold">
                  <span className="text-slate-600">Nivel de llenado: {siloActivo.pctOcupacion}%</span>
                  <span className="text-slate-500 font-mono">Máx: 180.000 kg</span>
                </div>
                <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      Number(siloActivo.pctOcupacion) >= 95
                        ? 'bg-red-500'
                        : Number(siloActivo.pctOcupacion) >= 80
                        ? 'bg-amber-500'
                        : 'bg-[#00603C]'
                    }`}
                    style={{ width: `${Math.min(100, Number(siloActivo.pctOcupacion))}%` }}
                  />
                </div>
              </div>
            </div>

            {/* HISTORIAL Y OPERACIONES DEL SILO (SOLO LECTURA) */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#00603C]" />
                  <h4 className="font-serif font-bold text-sm text-slate-900">
                    Registro de Operaciones de {siloActivo.siloId}
                  </h4>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">
                  {siloActivo.movimientos.length} movimiento(s)
                </span>
              </div>

              {siloActivo.movimientos.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-200 text-slate-400 space-y-1">
                  <Warehouse className="w-7 h-7 mx-auto text-slate-300" />
                  <p className="text-xs font-bold text-slate-600">Sin movimientos registrados</p>
                  <p className="text-[11px]">No hay ingresos ni egresos cargados para este silo.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {siloActivo.movimientos.map((mov) => {
                    const isIngreso = mov.tipo === 'INGRESO';
                    const isEgreso = mov.tipo === 'EGRESO_OP' || (mov.tipo as string).startsWith('EGRESO');

                    return (
                      <div
                        key={mov.id}
                        className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/80 transition flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
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
                              <ArrowDownRight className="w-4 h-4" />
                            ) : isEgreso ? (
                              <ArrowUpRight className="w-4 h-4" />
                            ) : (
                              <Warehouse className="w-4 h-4" />
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

              {/* Mensaje informativo de solo lectura */}
              <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-blue-900 text-[11px] flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Modo Solo Lectura:</strong> Para registrar ingresos de camiones, calibraciones o egresos de silos, acceda con usuario autorizado al módulo principal de Gestión de Silos.
                </span>
              </div>
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
