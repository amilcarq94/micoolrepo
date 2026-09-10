/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Lote, MovimientoSilo, SiloId, Chofer, BolsonCampo, OrdenCarga, SilosEstadoMap } from '../types';
import { formatNumberArg, formatKg } from '../utils/formatters';
import { DespachosSection } from './DespachosSection';
import { QrCodeModal } from './QrCodeModal';
import { LoteFichaQuickModal } from './LoteFichaQuickModal';
import { VisorSilosPlantaMovil } from './VisorSilosPlantaMovil';
import { unlockScannerAudio } from '../utils/scannerAudio';
import {
  Warehouse,
  QrCode,
  Wifi,
  WifiOff,
  ClipboardList,
  Flame,
  Droplets,
  Info,
  Clock,
  Eye,
  Camera,
  Filter,
  ScanLine,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Scale,
  Building2,
  Tag,
  Sprout,
  Search,
  MapPin,
  X,
  FileText,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Layers,
  RotateCcw
} from 'lucide-react';

interface ModoPlantaMobileViewProps {
  lotes: Lote[];
  siloStocks?: Record<SiloId, number>;
  movimientosSilo?: MovimientoSilo[];
  choferes: Chofer[];
  bolsones: BolsonCampo[];
  clientes?: string[];
  especies?: string[];
  currentUser: { nombre: string; rol: string };
  ordenesCarga: OrdenCarga[];
  silosEstadoManual?: SilosEstadoMap;
  onUpdateSiloEstadoManual?: (siloId: SiloId, estado: any) => void;
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
  siloStocks = {},
  movimientosSilo = [],
  choferes: _choferes,
  bolsones: _bolsones,
  clientes = [],
  especies = [],
  currentUser,
  ordenesCarga,
  silosEstadoManual: silosEstadoManualProp,
  onUpdateSiloEstadoManual: _onUpdateSiloEstadoManual,
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
  // Pestañas principales de Planta Móvil: Visor de Silos (Centro de Información), Mapa de Calor, Despachos (Playa)
  const [subTab, setSubTab] = useState<'VISOR_SILOS' | 'MAPA_CALOR' | 'DESPACHOS_PLAYA'>('VISOR_SILOS');
  const [isNavDropdownOpen, setIsNavDropdownOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));

  // Estados para Mapa de Calor de Acopio
  const [selectedAlaFilter, setSelectedAlaFilter] = useState<string>('TODAS');
  const [selectedHeatmapCell, setSelectedHeatmapCell] = useState<{ ala: string; sector: string } | null>(null);
  const [qrModalLote, setQrModalLote] = useState<Lote | null>(null);

  // Estados para Buscador y Filtros de Lote (Cliente, Especie, Variedad, Tratamiento)
  const [searchLoteQuery, setSearchLoteQuery] = useState('');
  const [filtroCliente, setFiltroCliente] = useState('TODOS');
  const [filtroEspecie, setFiltroEspecie] = useState('TODOS');
  const [filtroVariedad, setFiltroVariedad] = useState('TODOS');
  const [filtroTratamiento, setFiltroTratamiento] = useState('TODOS');
  const [highlightedCell, setHighlightedCell] = useState<{ ala: string; sector: string } | null>(null);
  const [fichaModalLote, setFichaModalLote] = useState<Lote | null>(null);

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

  // Helper para normalizar tratamientos de un lote
  const getTratamientosDeLote = (lote: Lote): string[] => {
    if (!lote.tratamiento) return ['Sin Tratar'];
    if (Array.isArray(lote.tratamiento)) return lote.tratamiento.filter(Boolean);
    if (typeof lote.tratamiento === 'string') return [lote.tratamiento];
    return ['Sin Tratar'];
  };

  // Clientes disponibles para filtros
  const availableClientes = useMemo(() => {
    const list = new Set<string>();
    (clientes || []).forEach((c) => c && list.add(c));
    lotes.forEach((l) => l.cliente && list.add(l.cliente));
    return Array.from(list).sort();
  }, [clientes, lotes]);

  // Especies disponibles para filtros
  const availableEspecies = useMemo(() => {
    const list = new Set<string>();
    (especies || []).forEach((e) => e && list.add(e));
    lotes.forEach((l) => l.especie && list.add(l.especie));
    return Array.from(list).sort();
  }, [especies, lotes]);

  // Variedades disponibles (reactivas a la especie seleccionada)
  const availableVariedades = useMemo(() => {
    const list = new Set<string>();
    lotes.forEach((l) => {
      if (filtroEspecie === 'TODOS' || l.especie === filtroEspecie) {
        if (l.variedad && l.variedad !== 'Genérica' && l.variedad !== 'Sin variedad') {
          list.add(l.variedad);
        }
      }
    });
    return Array.from(list).sort();
  }, [lotes, filtroEspecie]);

  // Tratamientos disponibles para filtros
  const availableTratamientos = useMemo(() => {
    const list = new Set<string>();
    list.add('Tratado');
    list.add('Sin Tratar');
    lotes.forEach((l) => {
      getTratamientosDeLote(l).forEach((t) => {
        if (t) list.add(t);
      });
    });
    return Array.from(list).sort();
  }, [lotes]);

  // Indicador de si hay algún filtro o búsqueda activa
  const isSearchOrFilterActive = useMemo(() => {
    return (
      searchLoteQuery.trim().length > 0 ||
      filtroCliente !== 'TODOS' ||
      filtroEspecie !== 'TODOS' ||
      filtroVariedad !== 'TODOS' ||
      filtroTratamiento !== 'TODOS'
    );
  }, [searchLoteQuery, filtroCliente, filtroEspecie, filtroVariedad, filtroTratamiento]);

  // Resetear filtros del buscador
  const handleLimpiarFiltrosBuscador = () => {
    setSearchLoteQuery('');
    setFiltroCliente('TODOS');
    setFiltroEspecie('TODOS');
    setFiltroVariedad('TODOS');
    setFiltroTratamiento('TODOS');
    setHighlightedCell(null);
  };

  // Filtrar lotes según el buscador y los 4 filtros clave (Cliente, Especie, Variedad, Tratamiento)
  const filteredSearchLotes = useMemo(() => {
    return lotes.filter((lote) => {
      // 1. Filtro texto (N° Lote, ID, cliente, variedad, observaciones, ala, sector)
      if (searchLoteQuery.trim()) {
        const q = searchLoteQuery.toLowerCase().trim();
        const matchNro = (lote.loteNro || '').toLowerCase().includes(q);
        const matchId = (lote.id || '').toLowerCase().includes(q);
        const matchCli = (lote.cliente || '').toLowerCase().includes(q);
        const matchVar = (lote.variedad || '').toLowerCase().includes(q);
        const matchEsp = (lote.especie || '').toLowerCase().includes(q);
        const matchObs = (lote.observaciones || '').toLowerCase().includes(q);
        const matchUbic = (lote.ubicacionAcopio || '').toLowerCase().includes(q);
        const matchAla = lote.ala ? `ala ${lote.ala}`.toLowerCase().includes(q) : false;
        const matchSec = lote.sector ? `sector ${lote.sector}`.toLowerCase().includes(q) : false;

        if (!matchNro && !matchId && !matchCli && !matchVar && !matchEsp && !matchObs && !matchUbic && !matchAla && !matchSec) {
          return false;
        }
      }

      // 2. Filtro Cliente
      if (filtroCliente !== 'TODOS' && lote.cliente !== filtroCliente) {
        return false;
      }

      // 3. Filtro Especie
      if (filtroEspecie !== 'TODOS' && lote.especie !== filtroEspecie) {
        return false;
      }

      // 4. Filtro Variedad
      if (filtroVariedad !== 'TODOS' && lote.variedad !== filtroVariedad) {
        return false;
      }

      // 5. Filtro Tratamiento
      if (filtroTratamiento !== 'TODOS') {
        const trats = getTratamientosDeLote(lote);
        const filtNorm = filtroTratamiento.toLowerCase();

        if (filtNorm === 'tratado') {
          const esTratado = trats.some((t) =>
            t.toLowerCase().includes('tratado') ||
            t.toLowerCase().includes('curado') ||
            t.toLowerCase().includes('curasemilla') ||
            t.toLowerCase().includes('inocula')
          );
          if (!esTratado) return false;
        } else if (filtNorm === 'sin tratar') {
          const esSinTratar = trats.some((t) =>
            t.toLowerCase().includes('sin tratar') ||
            t.toLowerCase().includes('sin tratamiento')
          );
          if (!esSinTratar) return false;
        } else {
          const matchDirect = trats.some((t) => t.toLowerCase() === filtNorm);
          if (!matchDirect) return false;
        }
      }

      return true;
    });
  }, [lotes, searchLoteQuery, filtroCliente, filtroEspecie, filtroVariedad, filtroTratamiento]);

  // Localizar lote en el mapa de calor y enfocar celda
  const handleLocalizarEnMapa = (lote: Lote) => {
    if (lote.ala && lote.sector) {
      setSelectedAlaFilter(lote.ala);
      setSelectedHeatmapCell({ ala: lote.ala, sector: lote.sector });
      setHighlightedCell({ ala: lote.ala, sector: lote.sector });

      // Scroll suave hacia la cuadrícula del mapa de calor
      setTimeout(() => {
        const el = document.getElementById('cuadricula-mapa-calor');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  };

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
      matchingSearchCount: number;
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

        // Coincidencias con el buscador
        const matchingSearchCount = isSearchOrFilterActive
          ? cellLotes.filter((cl) => filteredSearchLotes.some((fl) => fl.id === cl.id)).length
          : 0;

        cells.push({
          ala: a,
          sector: s,
          totalKg,
          totalBolsas,
          lotesCount: cellLotes.length,
          matchingSearchCount,
          species,
          lotes: cellLotes
        });
      }
    }
    return cells;
  }, [lotes, selectedAlaFilter, isSearchOrFilterActive, filteredSearchLotes]);

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
              {currentUser.nombre || 'Operador Invitado'} · Consulta de Acopio, Playa y QR
            </span>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 font-mono">
          <span className="font-bold text-[#00603C]">La Barrancosa</span>
          <span>·</span>
          <span>Agro Abacus S.A.</span>
        </div>
      </div>

      {/* 2. BOTÓN HERO DESTACADO: ESCANEAR CÓDIGO QR */}
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
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-[#C9922E]/15 rounded-full blur-2xl pointer-events-none" />

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

        <div className="flex items-center gap-2.5 z-10 shrink-0 bg-white/20 group-hover:bg-white/30 border border-white/30 px-4 sm:px-5 py-3 sm:py-3.5 rounded-2xl text-xs sm:text-sm font-black uppercase tracking-wider text-white shadow-lg transition-all group-hover:scale-105">
          <ScanLine className="w-5 h-5 text-[#C9922E]" />
          <span className="hidden xs:inline">Escanear</span>
        </div>
      </button>

      {/* 3. BARRA DE ACCESO RÁPIDO - CENTRO DE INFORMACIÓN Y SECTORES DE PLANTA */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 p-1 sm:p-1.5 bg-white rounded-2xl border-2 border-[#00603C]/30 shadow-sm" id="barra-acceso-rapido-planta-movil">
        <button
          type="button"
          id="btn-quick-visor-silos"
          onClick={() => setSubTab('VISOR_SILOS')}
          className={`py-2.5 px-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer ${
            subTab === 'VISOR_SILOS'
              ? 'bg-[#00603C] text-white shadow-md ring-2 ring-[#C9922E]'
              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
          }`}
          title="Centro de Información: Stock, Kilos de Ingreso, Variedad y Cliente"
        >
          <Warehouse className={`w-4 h-4 shrink-0 ${subTab === 'VISOR_SILOS' ? 'text-[#C9922E]' : 'text-slate-500'}`} />
          <span className="truncate">Visor Silos</span>
        </button>

        <button
          type="button"
          id="btn-quick-mapa-calor"
          onClick={() => setSubTab('MAPA_CALOR')}
          className={`py-2.5 px-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer ${
            subTab === 'MAPA_CALOR'
              ? 'bg-[#00603C] text-white shadow-md ring-2 ring-[#C9922E]'
              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
          }`}
          title="Monitoreo Térmico y Buscador de Sectores de Acopio"
        >
          <Flame className={`w-4 h-4 shrink-0 ${subTab === 'MAPA_CALOR' ? 'text-amber-300' : 'text-amber-600'}`} />
          <span className="truncate">Acopio</span>
        </button>

        <button
          type="button"
          id="btn-quick-despachos"
          onClick={() => setSubTab('DESPACHOS_PLAYA')}
          className={`py-2.5 px-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer ${
            subTab === 'DESPACHOS_PLAYA'
              ? 'bg-[#00603C] text-white shadow-md ring-2 ring-[#C9922E]'
              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
          }`}
          title="Playa: Carga de Camiones y Despacho de Órdenes"
        >
          <ClipboardList className={`w-4 h-4 shrink-0 ${subTab === 'DESPACHOS_PLAYA' ? 'text-[#C9922E]' : 'text-sky-700'}`} />
          <span className="truncate">Playa</span>
        </button>
      </div>

      {/* 4. BOTÓN DESPLEGABLE VERTICAL: DETALLE Y VISTAS */}
      <div className="w-full">
        {!isNavDropdownOpen ? (
          <button
            type="button"
            id="btn-nav-dropdown-toggle"
            onClick={() => setIsNavDropdownOpen(true)}
            className="w-full bg-white hover:bg-slate-50/90 text-slate-900 p-3 sm:p-3.5 rounded-2xl border border-slate-200 hover:border-[#00603C] shadow-xs hover:shadow-sm transition-all duration-150 cursor-pointer flex items-center justify-between gap-3 text-left group active:scale-[0.99]"
            title="Tocar para cambiar vista de Planta Móvil"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#00603C]/10 border border-[#00603C]/20 flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                {subTab === 'VISOR_SILOS' && (
                  <Warehouse className="w-5 h-5 text-[#00603C] shrink-0" />
                )}
                {subTab === 'MAPA_CALOR' && (
                  <Flame className="w-5 h-5 text-amber-600 shrink-0" />
                )}
                {subTab === 'DESPACHOS_PLAYA' && (
                  <ClipboardList className="w-5 h-5 text-sky-700 shrink-0" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                    VISTA ACTIVA:
                  </span>
                  <span className="text-sm font-black text-slate-950 uppercase tracking-wide">
                    {subTab === 'VISOR_SILOS' && 'Visor de Silos (Centro de Información)'}
                    {subTab === 'MAPA_CALOR' && 'Mapa de Calor (Acopio)'}
                    {subTab === 'DESPACHOS_PLAYA' && 'Playa (Despachos)'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 truncate mt-0.5">
                  {subTab === 'VISOR_SILOS' && 'Stock de cada silo, kilos de ingreso, variedad y cliente en vivo'}
                  {subTab === 'MAPA_CALOR' && 'Distribución térmica de bolsas y buscador de lotes por sectores'}
                  {subTab === 'DESPACHOS_PLAYA' && (() => {
                    const pendientes = ordenesCarga.filter(o => o.estado !== 'Despachada').length;
                    return `${pendientes} ${pendientes === 1 ? 'orden pendiente' : 'órdenes pendientes'} para carga y camiones`;
                  })()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E3EFE7] text-[#00603C] font-black text-xs rounded-xl border border-[#00603C]/30 shrink-0 group-hover:bg-[#00603C] group-hover:text-white transition-colors">
              <span className="hidden xs:inline">Cambiar</span>
              <ChevronDown className="w-4 h-4" />
            </div>
          </button>
        ) : (
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

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                id="btn-dropdown-option-visor-silos"
                onClick={() => {
                  setSubTab('VISOR_SILOS');
                  setIsNavDropdownOpen(false);
                }}
                className={`w-full p-3 rounded-xl transition-all flex items-center justify-between gap-3 text-left cursor-pointer border ${
                  subTab === 'VISOR_SILOS'
                    ? 'bg-[#00603C] text-white border-[#00603C] shadow-md'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      subTab === 'VISOR_SILOS' ? 'bg-white/20' : 'bg-emerald-500/10'
                    }`}
                  >
                    <Warehouse
                      className={`w-5 h-5 shrink-0 ${
                        subTab === 'VISOR_SILOS' ? 'text-amber-300' : 'text-[#00603C]'
                      }`}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm uppercase tracking-wide">Visor de Silos</span>
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                          subTab === 'VISOR_SILOS'
                            ? 'bg-white/20 text-white'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        Centro Info · 6 Silos
                      </span>
                    </div>
                    <p
                      className={`text-xs mt-0.5 truncate ${
                        subTab === 'VISOR_SILOS' ? 'text-emerald-100' : 'text-slate-500'
                      }`}
                    >
                      Stock en kg, kilos de ingreso, variedad y cliente en cada silo
                    </p>
                  </div>
                </div>

                {subTab === 'VISOR_SILOS' ? (
                  <CheckCircle2 className="w-5 h-5 text-amber-300 shrink-0" />
                ) : (
                  <span className="text-xs font-bold text-slate-400">Elegir</span>
                )}
              </button>

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
                      Monitoreo térmico, buscador y localización de lotes en sectores de acopio
                    </p>
                  </div>
                </div>

                {subTab === 'MAPA_CALOR' ? (
                  <CheckCircle2 className="w-5 h-5 text-amber-300 shrink-0" />
                ) : (
                  <span className="text-xs font-bold text-slate-400">Elegir</span>
                )}
              </button>

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
                      {(() => {
                        const pendientesCount = ordenesCarga.filter(o => o.estado !== 'Despachada').length;
                        if (pendientesCount === 0) return null;
                        return (
                          <span
                            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                              subTab === 'DESPACHOS_PLAYA'
                                ? 'bg-white/20 text-white'
                                : 'bg-amber-100 text-amber-900 border border-amber-300'
                            }`}
                          >
                            {pendientesCount} pendientes
                          </span>
                        );
                      })()}
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
      {/* 4. SECCIÓN MAPA DE CALOR DE ACOPIO + BUSCADOR DE LOTES                   */}
      {/* ========================================================================= */}
      {subTab === 'MAPA_CALOR' && (
        <div className="space-y-4" id="seccion-mapa-calor-acopio">

          {/* ===================================================================== */}
          {/* BUSCADOR DE LOTES CON FILTROS (CLIENTE, ESPECIE, VARIEDAD, TRATAMIENTO)*/}
          {/* ===================================================================== */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm space-y-3.5" id="panel-buscador-lote-acopio">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#00603C]/10 text-[#00603C] rounded-xl border border-[#00603C]/20 shrink-0">
                  <Search className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                    <span>Buscador y Localizador de Lotes</span>
                    <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-300">
                      Ubicación + Ficha
                    </span>
                  </h3>
                  <p className="text-xs text-gray-500">
                    Encuentre en qué Ala y Sector físico está guardado cualquier lote y acceda a su ficha técnica.
                  </p>
                </div>
              </div>

              {isSearchOrFilterActive && (
                <button
                  type="button"
                  onClick={handleLimpiarFiltrosBuscador}
                  className="self-start sm:self-center px-2.5 py-1 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition cursor-pointer flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Limpiar Filtros</span>
                </button>
              )}
            </div>

            {/* Input Principal de Búsqueda por Texto */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchLoteQuery}
                onChange={(e) => setSearchLoteQuery(e.target.value)}
                placeholder="Buscar por N° de Lote (ej: 58FIN), Cliente, Especie, Variedad..."
                className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#00603C] focus:ring-2 focus:ring-[#00603C]/20 rounded-xl pl-10 pr-9 py-2.5 text-xs sm:text-sm font-medium text-slate-900 transition"
              />
              {searchLoteQuery && (
                <button
                  type="button"
                  onClick={() => setSearchLoteQuery('')}
                  className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-slate-600 rounded-md transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filtros de Selección: Cliente, Especie, Variedad, Tratamiento */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              {/* 1. Cliente */}
              <div>
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block mb-1 flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-[#00603C]" />
                  <span>Cliente</span>
                </label>
                <select
                  value={filtroCliente}
                  onChange={(e) => setFiltroCliente(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-hidden focus:border-[#00603C] cursor-pointer"
                >
                  <option value="TODOS">Todos los Clientes</option>
                  {availableClientes.map((cli) => (
                    <option key={cli} value={cli}>
                      {cli}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Especie */}
              <div>
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block mb-1 flex items-center gap-1">
                  <Sprout className="w-3 h-3 text-[#00603C]" />
                  <span>Especie</span>
                </label>
                <select
                  value={filtroEspecie}
                  onChange={(e) => {
                    setFiltroEspecie(e.target.value);
                    setFiltroVariedad('TODOS');
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-hidden focus:border-[#00603C] cursor-pointer"
                >
                  <option value="TODOS">Todas las Especies</option>
                  {availableEspecies.map((esp) => (
                    <option key={esp} value={esp}>
                      {esp}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Variedad */}
              <div>
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block mb-1 flex items-center gap-1">
                  <Tag className="w-3 h-3 text-[#00603C]" />
                  <span>Variedad</span>
                </label>
                <select
                  value={filtroVariedad}
                  onChange={(e) => setFiltroVariedad(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-hidden focus:border-[#00603C] cursor-pointer"
                >
                  <option value="TODOS">Todas las Variedades</option>
                  {availableVariedades.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. Tratamiento */}
              <div>
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block mb-1 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-[#00603C]" />
                  <span>Tratamiento</span>
                </label>
                <select
                  value={filtroTratamiento}
                  onChange={(e) => setFiltroTratamiento(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-hidden focus:border-[#00603C] cursor-pointer"
                >
                  <option value="TODOS">Todos los Tratamientos</option>
                  {availableTratamientos.map((tr) => (
                    <option key={tr} value={tr}>
                      {tr}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Banner de Estado de Coincidencias */}
            {isSearchOrFilterActive && (
              <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-700">
                    Se encontraron <span className="text-[#00603C] font-mono font-black">{filteredSearchLotes.length}</span> lote(s)
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-500 text-[11px]">
                    Toque <span className="font-bold text-[#00603C]">Localizar en Mapa</span> para iluminar su celda
                  </span>
                </div>

                {filteredSearchLotes.length > 0 && (
                  <span className="text-[11px] font-mono text-slate-500">
                    Total: {formatKg(filteredSearchLotes.reduce((acc, l) => acc + (l.stockKg || 0), 0))}
                  </span>
                )}
              </div>
            )}

            {/* Resultados Destacados del Buscador si hay búsqueda o filtros activos */}
            {isSearchOrFilterActive && (
              <div className="pt-2 space-y-2.5 animate-in fade-in duration-200">
                {filteredSearchLotes.length === 0 ? (
                  <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <Search className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                    <p className="text-xs font-bold text-slate-700">
                      No se encontraron lotes con los filtros seleccionados
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Pruebe ajustando los parámetros de cliente, especie, variedad o tratamiento.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-96 overflow-y-auto pr-1">
                    {filteredSearchLotes.map((lote) => {
                      const tieneUbicacion = Boolean(lote.ala && lote.sector);
                      const tratamientos = getTratamientosDeLote(lote);
                      const esTratado = tratamientos.some((t) =>
                        t.toLowerCase().includes('tratado') ||
                        t.toLowerCase().includes('curado') ||
                        t.toLowerCase().includes('curasemilla')
                      );

                      return (
                        <div
                          key={lote.id}
                          className="bg-white hover:bg-slate-50/80 border-2 border-emerald-600/30 hover:border-emerald-600 rounded-2xl p-3.5 flex flex-col justify-between gap-2.5 shadow-xs transition-all"
                        >
                          {/* Cabecera de Lote */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="px-2 py-0.5 bg-[#00603C] text-white text-[10px] font-mono font-black rounded">
                                LOTE: {lote.loteNro}
                              </span>
                              <h5 className="font-serif text-sm font-bold text-slate-900 mt-1 truncate" title={lote.cliente}>
                                {lote.cliente}
                              </h5>
                            </div>
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shrink-0 bg-emerald-100 text-emerald-800 border border-emerald-300">
                              {lote.estado}
                            </span>
                          </div>

                          {/* Especificaciones: Especie, Variedad y Tratamiento */}
                          <div className="space-y-1 bg-slate-50/80 p-2 rounded-xl text-xs">
                            <div className="flex justify-between text-[11px]">
                              <span className="text-slate-500">Especie/Var:</span>
                              <span className="font-bold text-slate-800 truncate max-w-[150px]">
                                {lote.especie} · {lote.variedad || '—'}
                              </span>
                            </div>

                            <div className="flex justify-between items-center text-[11px]">
                              <span className="text-slate-500">Tratamiento:</span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                  esTratado ? 'bg-sky-100 text-sky-800' : 'bg-slate-200 text-slate-700'
                                }`}
                              >
                                {tratamientos[0] || 'Sin Tratar'}
                              </span>
                            </div>

                            <div className="flex justify-between text-[11px]">
                              <span className="text-slate-500">Stock:</span>
                              <span className="font-mono font-bold text-[#00603C]">
                                {formatKg(lote.stockKg)} ({formatNumberArg(lote.stockBolsas)} b.)
                              </span>
                            </div>
                          </div>

                          {/* SECCIÓN CLAVE: UBICACIÓN FÍSICA DESTACADA */}
                          <div
                            className={`p-2 rounded-xl flex items-center justify-between gap-2 text-xs font-mono font-bold ${
                              tieneUbicacion
                                ? 'bg-[#00603C]/10 text-[#00603C] border border-[#00603C]/30'
                                : 'bg-amber-100 text-amber-900 border border-amber-300'
                            }`}
                          >
                            <span className="flex items-center gap-1.5">
                              <MapPin className="w-4 h-4 text-[#C9922E] shrink-0" />
                              <span>
                                {tieneUbicacion ? `ALA ${lote.ala} · SECTOR ${lote.sector}` : 'Sin Ubicar'}
                              </span>
                            </span>

                            {tieneUbicacion && (
                              <button
                                type="button"
                                onClick={() => handleLocalizarEnMapa(lote)}
                                className="px-2 py-0.5 bg-[#00603C] hover:bg-[#254731] text-white rounded text-[10px] font-sans font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                                title="Localizar e iluminar en el mapa de calor"
                              >
                                <Warehouse className="w-3 h-3 text-amber-300" />
                                <span>Localizar</span>
                              </button>
                            )}
                          </div>

                          {/* Acciones: Ver Ficha y Código QR */}
                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => setQrModalLote(lote)}
                              className="p-1.5 text-slate-500 hover:text-[#00603C] hover:bg-slate-100 rounded-lg transition cursor-pointer"
                              title="Ver Código QR"
                            >
                              <QrCode className="w-4 h-4 text-[#C9922E]" />
                            </button>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setFichaModalLote(lote)}
                                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                                title="Ver Ficha Técnica Rápida"
                              >
                                <FileText className="w-3.5 h-3.5 text-[#00603C]" />
                                <span>Ver Ficha</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => onSelectLote(lote)}
                                className="px-2.5 py-1 bg-[#00603C] hover:bg-[#254731] text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                                title="Abrir Ficha Técnica Oficial Completa"
                              >
                                <Eye className="w-3.5 h-3.5 text-amber-300" />
                                <span>Ficha Oficial</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

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
                    className="bg-transparent font-bold text-[#00603C] text-xs focus:outline-hidden cursor-pointer"
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
          <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm space-y-4" id="cuadricula-mapa-calor">
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
                  const isHighlighted =
                    highlightedCell?.ala === cell.ala && highlightedCell?.sector === cell.sector;
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
                          isHighlighted
                            ? 'border-amber-500 ring-4 ring-amber-400 ring-offset-2 animate-pulse shadow-xl z-20 scale-[1.03] bg-white'
                            : isSelected
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
                        {/* Header de celda con badge de búsqueda si hay coincidencia */}
                        <div className="flex justify-between items-center text-[9px] uppercase tracking-wider font-extrabold opacity-90">
                          <span>ALA {cell.ala}</span>
                          {cell.matchingSearchCount > 0 && isSearchOrFilterActive && (
                            <span className="bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded-md font-mono font-black shadow-xs">
                              ⭐ {cell.matchingSearchCount}
                            </span>
                          )}
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

          {/* LISTA DE LOTES QUE INTEGRAN EL ACOPIO O CELDA SELECCIONADA */}
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
                  {displayLotes.map((lote) => {
                    const tratamientos = getTratamientosDeLote(lote);
                    const esTratado = tratamientos.some((t) =>
                      t.toLowerCase().includes('tratado') ||
                      t.toLowerCase().includes('curado') ||
                      t.toLowerCase().includes('curasemilla')
                    );

                    return (
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

                        {/* Datos de Variedad, Tratamiento y Stock */}
                        <div className="space-y-1 py-1.5 border-t border-b border-slate-200/80 bg-white/60 px-2 rounded-lg text-xs">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-400 font-bold text-[8.5px] uppercase">
                              Especie / Variedad
                            </span>
                            <span className="font-bold text-slate-800 truncate block text-[11px]">
                              {lote.especie} · {lote.variedad || '—'}
                            </span>
                          </div>

                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-400 font-bold text-[8.5px] uppercase">
                              Tratamiento
                            </span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                esTratado ? 'bg-sky-100 text-sky-800' : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {tratamientos[0] || 'Sin Tratar'}
                            </span>
                          </div>

                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-400 font-bold text-[8.5px] uppercase">
                              Stock Acopiado
                            </span>
                            <span className="font-mono font-extrabold text-[#00603C] block text-[11px]">
                              {formatKg(lote.stockKg)} ({formatNumberArg(lote.stockBolsas)} b.)
                            </span>
                          </div>
                        </div>

                        {/* Ubicación y Acciones: Ficha Rápida, Ficha Oficial y QR */}
                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <span className="text-[10px] font-mono text-slate-600 font-bold flex items-center gap-1">
                            <Warehouse className="w-3.5 h-3.5 text-[#C9922E]" />
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

                            {/* Botón Ficha Rápida Modal */}
                            <button
                              type="button"
                              onClick={() => setFichaModalLote(lote)}
                              className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-[10.5px] font-bold transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                              title="Ver Ficha Técnica"
                            >
                              <FileText className="w-3.5 h-3.5 text-[#00603C]" />
                              <span>Ficha</span>
                            </button>

                            {/* Botón Ficha Oficial Completa */}
                            <button
                              type="button"
                              onClick={() => onSelectLote(lote)}
                              className="px-2 py-1 bg-[#00603C] hover:bg-[#254731] text-white rounded-lg text-[10.5px] font-bold transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                              title="Abrir Ficha Técnica Oficial del Lote en el sistema"
                            >
                              <Eye className="w-3.5 h-3.5 text-amber-300" />
                              <span className="hidden sm:inline">Oficial</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. DESPACHOS (MIS ÓRDENES - PLAYA)                                        */}
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

      {/* ========================================================================= */}
      {/* 6. VISOR DE SILOS (CENTRO DE INFORMACIÓN, STOCK, INGRESOS Y VARIEDAD)     */}
      {/* ========================================================================= */}
      {subTab === 'VISOR_SILOS' && (
        <div className="space-y-4" id="seccion-visor-silos-planta-movil">
          <VisorSilosPlantaMovil
            siloStocks={siloStocks}
            movimientosSilo={movimientosSilo}
            silosEstadoManual={silosEstadoManualProp}
            onUpdateSiloEstadoManual={_onUpdateSiloEstadoManual}
          />
        </div>
      )}

      {/* Modal de Código QR para Lote */}
      {qrModalLote && <QrCodeModal lote={qrModalLote} onClose={() => setQrModalLote(null)} />}

      {/* Modal de Ficha Rápida con Ubicación Física */}
      {fichaModalLote && (
        <LoteFichaQuickModal
          lote={fichaModalLote}
          onClose={() => setFichaModalLote(null)}
          onLocalizarEnMapa={handleLocalizarEnMapa}
          onOpenQrModal={(lote) => setQrModalLote(lote)}
          onSelectFullFicha={(lote) => onSelectLote(lote)}
        />
      )}
    </div>
  );
};
