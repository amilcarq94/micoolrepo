/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Lote,
  PlantaConfig,
  VariedadItem,
  getVariedadesVisibles,
  SalidaRegistrada,
  MovimientoSilo,
  SiloId
} from '../types';
import { formatNumberArg } from '../utils/formatters';
import {
  Factory,
  Layers,
  Filter,
  Pin,
  PinOff,
  RotateCcw,
  FileSpreadsheet,
  Download,
  Scale,
  Package,
  PackageCheck,
  FlaskConical,
  Check,
  CheckCircle2,
  Calendar,
  TrendingUp,
  BarChart2,
  PieChart as PieChartIcon,
  Boxes,
  Search,
  X,
  ExternalLink,
  ShieldCheck,
  Building2,
  Sprout,
  Tag,
  Dna,
  Warehouse,
  ChevronDown,
  Info,
  CheckCheck,
  ListChecks,
  Truck,
  Loader2
} from 'lucide-react';
import { exportElementAsJpg } from '../utils/exportImage';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  PieChart as RechartsPieChart,
  Pie,
  Legend
} from 'recharts';

export interface DashboardProduccionProps {
  lotes: Lote[];
  salidas?: SalidaRegistrada[];
  movimientosSilo?: MovimientoSilo[];
  siloStocks?: Record<string, any>;
  plantaConfig?: PlantaConfig;
  clientes?: string[];
  especies?: string[];
  onSelectLote?: (lote: Lote) => void;
  onNavigateToLotes?: () => void;
  onNavigateToSilos?: () => void;
}

export interface ProductionItemRecord {
  id: string;
  loteNro: string;
  fechaProduccion: string; // YYYY-MM-DD
  fechaHoraProduccion?: string;
  estadoRegistro: 'PRE-CARGA' | 'REALIZADO' | 'EN_CURSO';
  cliente: string;
  especie: string;
  variedad: string;
  categoria: string;
  tipo: string;
  tratamientos: string[];
  tratamientoStr: string;
  isTratado: boolean;
  kgPorBolsa: number;
  bolsasProducidas: number;
  kgProducidos: number;
  bolsasStock: number;
  kgStock: number;
  bolsasDespachadas: number;
  kgDespachados: number;
  kgPasadosConsumo: number;
  bolsasPasadasConsumo: number;
  bolsasMovimientos?: number;
  kgMovimientos?: number;
  estadoLote: string; // 'Disponible' | 'Reservado' | 'Agotado' | 'A Consumo'
  ubicacion: string;
  loteOriginal: Lote;
}

const STORAGE_PRODUCCION_PINNED_FILTERS = 'agro_abacus_produccion_pinned_filters_v2';

const COLOR_PALETTE = [
  '#00603C', // Verde institucional
  '#C9922E', // Dorado / Ámbar
  '#2E8B57', // Verde Selva
  '#4682B4', // Azul Acero
  '#7C3AED', // Púrpura Tratamiento
  '#A0522D', // Terracota
  '#D97706', // Ámbar fuerte
  '#2563EB', // Azul
];

export const DashboardProduccion: React.FC<DashboardProduccionProps> = ({
  lotes = [],
  salidas = [],
  movimientosSilo = [],
  siloStocks: _siloStocks = {},
  plantaConfig,
  clientes: clientesProp = [],
  especies: especiesProp = [],
  onSelectLote,
  onNavigateToLotes,
  onNavigateToSilos
}) => {
  // -------------------------------------------------------------
  // 1. ESTADOS DE FILTROS CASCADA / VINCULANTES
  // -------------------------------------------------------------
  // Filtro Temporal: Fecha Desde y Hasta (Producción)
  const [filterFechaDesde, setFilterFechaDesde] = useState<string>('');
  const [filterFechaHasta, setFilterFechaHasta] = useState<string>('');

  // Filtro Principal: Cliente
  const [filterCliente, setFilterCliente] = useState<string>('');
  // Subfiltros:
  const [filterEspecie, setFilterEspecie] = useState<string>('');
  const [filterVariedad, setFilterVariedad] = useState<string>('');
  const [filterCategoria, setFilterCategoria] = useState<string>('');
  const [filterTipo, setFilterTipo] = useState<string>('');
  const [filterTratamiento, setFilterTratamiento] = useState<string>('');
  const [filterTamanoBolsa, setFilterTamanoBolsa] = useState<string>('');

  // Modo Principal: 1. Producción / 2. Stock
  const [activeMode, setActiveMode] = useState<'produccion' | 'stock'>('produccion');

  // Estado de Filtros Fijados
  const [isFilterPinned, setIsFilterPinned] = useState<boolean>(false);

  // Búsqueda rápida en tabla
  const [tableSearch, setTableSearch] = useState<string>('');
  const [copiedSummarySuccess, setCopiedSummarySuccess] = useState<boolean>(false);

  // Formateador y normalizador de fechas
  const normalizeToDateString = (val?: string): string => {
    if (!val) return '';
    const clean = val.trim();
    if (clean.includes('T')) return clean.split('T')[0];
    const dmyMatch = clean.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0');
      const month = dmyMatch[2].padStart(2, '0');
      const year = dmyMatch[3];
      return `${year}-${month}-${day}`;
    }
    const ymdMatch = clean.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
    if (ymdMatch) {
      const year = ymdMatch[1];
      const month = ymdMatch[2].padStart(2, '0');
      const day = ymdMatch[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return clean;
  };

  const formatDateArg = (isoStr: string) => {
    if (!isoStr) return '';
    const clean = isoStr.trim().split('T')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return clean;
  };

  const handleSetPresetDates = (preset: 'hoy' | '7dias' | 'esteMes' | 'mesAnterior' | 'todo') => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const formatYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === 'hoy') {
      const todayStr = formatYMD(now);
      setFilterFechaDesde(todayStr);
      setFilterFechaHasta(todayStr);
    } else if (preset === '7dias') {
      const dDesde = new Date(now);
      dDesde.setDate(dDesde.getDate() - 7);
      setFilterFechaDesde(formatYMD(dDesde));
      setFilterFechaHasta(formatYMD(now));
    } else if (preset === 'esteMes') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setFilterFechaDesde(formatYMD(firstDay));
      setFilterFechaHasta(formatYMD(now));
    } else if (preset === 'mesAnterior') {
      const firstDayPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayPrev = new Date(now.getFullYear(), now.getMonth(), 0);
      setFilterFechaDesde(formatYMD(firstDayPrev));
      setFilterFechaHasta(formatYMD(lastDayPrev));
    } else if (preset === 'todo') {
      setFilterFechaDesde('');
      setFilterFechaHasta('');
    }
  };

  // Cargar filtros fijados desde localStorage al montar
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PRODUCCION_PINNED_FILTERS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.isFilterPinned) {
          setIsFilterPinned(true);
          if (parsed.filterFechaDesde !== undefined) setFilterFechaDesde(parsed.filterFechaDesde);
          if (parsed.filterFechaHasta !== undefined) setFilterFechaHasta(parsed.filterFechaHasta);
          if (parsed.filterCliente !== undefined) setFilterCliente(parsed.filterCliente);
          if (parsed.filterEspecie !== undefined) setFilterEspecie(parsed.filterEspecie);
          if (parsed.filterVariedad !== undefined) setFilterVariedad(parsed.filterVariedad);
          if (parsed.filterCategoria !== undefined) setFilterCategoria(parsed.filterCategoria);
          if (parsed.filterTipo !== undefined) setFilterTipo(parsed.filterTipo);
          if (parsed.filterTratamiento !== undefined) setFilterTratamiento(parsed.filterTratamiento);
          if (parsed.filterTamanoBolsa !== undefined) setFilterTamanoBolsa(parsed.filterTamanoBolsa);
          if (parsed.activeMode !== undefined) setActiveMode(parsed.activeMode);
        }
      }
    } catch (e) {
      console.error('Error al cargar filtros fijados en Dashboard Producción:', e);
    }
  }, []);

  // Guardar o limpiar persistencia al cambiar estado de fijado
  useEffect(() => {
    try {
      if (isFilterPinned) {
        localStorage.setItem(
          STORAGE_PRODUCCION_PINNED_FILTERS,
          JSON.stringify({
            isFilterPinned: true,
            filterFechaDesde,
            filterFechaHasta,
            filterCliente,
            filterEspecie,
            filterVariedad,
            filterCategoria,
            filterTipo,
            filterTratamiento,
            filterTamanoBolsa,
            activeMode,
          })
        );
      } else {
        localStorage.removeItem(STORAGE_PRODUCCION_PINNED_FILTERS);
      }
    } catch (e) {
      console.error('Error al guardar filtros fijados en Dashboard Producción:', e);
    }
  }, [
    isFilterPinned,
    filterFechaDesde,
    filterFechaHasta,
    filterCliente,
    filterEspecie,
    filterVariedad,
    filterCategoria,
    filterTipo,
    filterTratamiento,
    filterTamanoBolsa,
    activeMode,
  ]);

  const handleTogglePin = () => {
    setIsFilterPinned((prev) => !prev);
  };

  const handleClearFilters = () => {
    setFilterFechaDesde('');
    setFilterFechaHasta('');
    setFilterCliente('');
    setFilterEspecie('');
    setFilterVariedad('');
    setFilterCategoria('');
    setFilterTipo('');
    setFilterTratamiento('');
    setFilterTamanoBolsa('');
    setTableSearch('');
    if (isFilterPinned) {
      setIsFilterPinned(false);
      localStorage.removeItem(STORAGE_PRODUCCION_PINNED_FILTERS);
    }
  };

  // -------------------------------------------------------------
  // 2. UNIFICACIÓN DE REGISTROS DE PRODUCCIÓN Y STOCK
  // -------------------------------------------------------------
  const allProductionRecords: ProductionItemRecord[] = useMemo(() => {
    return lotes.map((lote) => {
      const pesoBolsa = lote.kgPorBolsa || 40;

      // 1. Entradas registradas en el historial del lote
      const entradas =
        lote.historial?.filter((m) => {
          if (!m) return false;
          const tipoStr = (m.tipo || '').trim();
          return (
            tipoStr.startsWith('Entrada') ||
            tipoStr.startsWith('Alta') ||
            tipoStr.startsWith('Ingreso') ||
            tipoStr.startsWith('Reingreso')
          );
        }) || [];

      // 2. Clasificación estricta de salidas del historial del lote
      let bolsasDespachoHist = 0;
      let kgDespachoHist = 0;
      let bolsasMovimientosHist = 0;
      let kgMovimientosHist = 0;
      let bolsasConsumoHist = 0;
      let kgConsumoHist = 0;

      (lote.historial || []).forEach((m) => {
        if (!m) return;
        const tipoStr = (m.tipo || '').trim();
        const tipoLower = tipoStr.toLowerCase();
        const detLower = (m.detalle || '').toLowerCase();
        const tipoSalida = (m.tipoSalida || '').toLowerCase();

        // Omitir entradas
        const esEntrada =
          tipoStr.startsWith('Entrada') ||
          tipoStr.startsWith('Alta') ||
          tipoStr.startsWith('Ingreso') ||
          tipoStr.startsWith('Reingreso');
        if (esEntrada) return;

        const cantBolsas = Math.abs(m.cantidadBolsas || 0);
        const kgBolsa = m.kgPorBolsa || pesoBolsa;
        const cantKg = Math.abs(m.cantidadKg || 0) || cantBolsas * kgBolsa;

        // A. Movimientos internos entre lotes (transferencias, curado desdoblado, orden de movimiento)
        const esMovimiento =
          tipoSalida === 'movimiento' ||
          tipoStr === 'Salida por movimiento' ||
          tipoStr === 'Salida por movimientos' ||
          tipoLower.includes('movimiento') ||
          detLower.includes('movimiento') ||
          detLower.includes('transferencia') ||
          detLower.includes('hacia nuevo lote') ||
          detLower.includes('desdoblamiento') ||
          detLower.includes('curado') ||
          detLower.includes('orden de movimiento') ||
          detLower.includes('precarga de movimiento');

        if (esMovimiento) {
          bolsasMovimientosHist += cantBolsas;
          kgMovimientosHist += cantKg;
          return;
        }

        // B. Pasado a Consumo / Mermas / Ajuste a consumo
        const esConsumo =
          tipoSalida === 'consumo' ||
          tipoStr === 'Pasado a Consumo' ||
          tipoLower.includes('consumo') ||
          detLower.includes('consumo') ||
          detLower.includes('a consumo') ||
          detLower.includes('descarte') ||
          detLower.includes('merma');

        if (esConsumo) {
          bolsasConsumoHist += cantBolsas;
          kgConsumoHist += cantKg;
          return;
        }

        // C. Salida manual sin remito de despacho comercial
        if (tipoStr === 'Salida manual' || tipoSalida === 'manual') {
          const tieneRemito = Boolean(m.remitoCliente && m.remitoCliente.trim() !== '-' && m.remitoCliente.trim() !== '');
          const mencionaDespacho = detLower.includes('despacho') || detLower.includes('remito') || detLower.includes('orden de carga');
          if (!tieneRemito && !mencionaDespacho) {
            bolsasConsumoHist += cantBolsas;
            kgConsumoHist += cantKg;
            return;
          }
        }

        // D. Despacho comercial efectivo (con remito / orden de carga / chofer)
        const esDespacho =
          tipoSalida === 'despacho' ||
          tipoStr === 'Salida por despacho' ||
          tipoStr === 'Despacho' ||
          Boolean(m.ordenId && (m.ordenId.startsWith('OC-') || m.ordenId.startsWith('ORD-'))) ||
          Boolean(m.remitoCliente && m.remitoCliente.trim() !== '-' && m.remitoCliente.trim() !== '') ||
          detLower.includes('despacho') ||
          detLower.includes('remito') ||
          detLower.includes('orden de carga') ||
          detLower.includes('orden n°') ||
          (tipoStr === 'Salida' && (Boolean(m.chofer) || detLower.includes('remito') || detLower.includes('despacho')));

        if (esDespacho) {
          bolsasDespachoHist += cantBolsas;
          kgDespachoHist += cantKg;
        }
      });

      // 3. Salidas cruzadas desde la tabla de SalidasRegistradas vinculadas a este lote (despachos oficiales)
      const salidasExt = (salidas || []).filter(
        (s) => s.loteId === lote.id || s.loteId === lote.loteNro
      );
      const kgSalidasExt = salidasExt.reduce((acc, s) => acc + (s.totalKg || 0), 0);
      const bolsasSalidasExt = salidasExt.reduce((acc, s) => acc + (s.cantidadBolsas || 0), 0);

      // Deduplicación: no sumar dos veces el mismo despacho si ya está en salidasExt y en lote.historial
      let bolsasHistDespachoNoExt = 0;
      let kgHistDespachoNoExt = 0;

      (lote.historial || []).forEach((m) => {
        if (!m) return;
        const tipoStr = (m.tipo || '').trim();
        const tipoLower = tipoStr.toLowerCase();
        const detLower = (m.detalle || '').toLowerCase();
        const tipoSalida = (m.tipoSalida || '').toLowerCase();

        // Omitir si es movimiento o consumo
        const esMovimiento =
          tipoSalida === 'movimiento' ||
          tipoStr === 'Salida por movimiento' ||
          tipoStr === 'Salida por movimientos' ||
          tipoLower.includes('movimiento') ||
          detLower.includes('movimiento') ||
          detLower.includes('transferencia') ||
          detLower.includes('hacia nuevo lote') ||
          detLower.includes('desdoblamiento') ||
          detLower.includes('curado') ||
          detLower.includes('orden de movimiento') ||
          detLower.includes('precarga de movimiento');
        if (esMovimiento) return;

        const esConsumo =
          tipoSalida === 'consumo' ||
          tipoStr === 'Pasado a Consumo' ||
          tipoLower.includes('consumo') ||
          detLower.includes('consumo') ||
          detLower.includes('a consumo') ||
          detLower.includes('descarte') ||
          detLower.includes('merma');
        if (esConsumo) return;

        if (tipoStr === 'Salida manual' || tipoSalida === 'manual') {
          const tieneRemito = Boolean(m.remitoCliente && m.remitoCliente.trim() !== '-' && m.remitoCliente.trim() !== '');
          const mencionaDespacho = detLower.includes('despacho') || detLower.includes('remito') || detLower.includes('orden de carga');
          if (!tieneRemito && !mencionaDespacho) return;
        }

        const esDespacho =
          tipoSalida === 'despacho' ||
          tipoStr === 'Salida por despacho' ||
          tipoStr === 'Despacho' ||
          Boolean(m.ordenId && (m.ordenId.startsWith('OC-') || m.ordenId.startsWith('ORD-'))) ||
          Boolean(m.remitoCliente && m.remitoCliente.trim() !== '-' && m.remitoCliente.trim() !== '') ||
          detLower.includes('despacho') ||
          detLower.includes('remito') ||
          detLower.includes('orden de carga') ||
          detLower.includes('orden n°') ||
          (tipoStr === 'Salida' && (Boolean(m.chofer) || detLower.includes('remito') || detLower.includes('despacho')));

        if (!esDespacho) return;

        const mRemito = (m.remitoCliente || '').trim().toUpperCase();
        const detUpper = (m.detalle || '').toUpperCase();

        const alreadyInExt = salidasExt.some((s) => {
          const sId = (s.id || '').trim().toUpperCase();
          const sRemito = (s.remitoCliente || '').trim().toUpperCase();
          if (sId && (mRemito === sId || detUpper.includes(sId))) return true;
          if (sRemito && sRemito !== '-' && (mRemito === sRemito || detUpper.includes(sRemito))) return true;
          if (m.ordenId && s.id === m.ordenId) return true;
          return false;
        });

        if (!alreadyInExt) {
          const cantB = Math.abs(m.cantidadBolsas || 0);
          const kgB = m.kgPorBolsa || pesoBolsa;
          const cantKg = Math.abs(m.cantidadKg || 0) || cantB * kgB;
          bolsasHistDespachoNoExt += cantB;
          kgHistDespachoNoExt += cantKg;
        }
      });

      let bolsasDespachadas = bolsasSalidasExt + bolsasHistDespachoNoExt;
      let kgDespachados = kgSalidasExt + kgHistDespachoNoExt;

      // Consolidación de seguridad para datos de despacho
      bolsasDespachadas = Math.max(bolsasDespachadas, Math.max(bolsasSalidasExt, bolsasDespachoHist));
      kgDespachados = Math.max(kgDespachados, Math.max(kgSalidasExt, kgDespachoHist));

      const bolsasMovimientos = bolsasMovimientosHist;
      const kgMovimientos = kgMovimientosHist;

      // 4. Kilos Pasados a Consumo (Lotes pasados a consumo)
      const kgAjustesConsumo = kgConsumoHist;

      let kgLoteConsumoTotal = 0;
      if (lote.estado === 'A Consumo' || (lote.tipo && lote.tipo.toLowerCase().includes('consumo'))) {
        kgLoteConsumoTotal = Math.max(lote.stockKg || 0, (lote.stockKg || 0) + kgConsumoHist);
      }

      const kgSilosConsumo = (movimientosSilo || []).filter((m) => {
        const matchLote =
          (m.loteId && (m.loteId === lote.id || m.loteId === lote.loteNro)) ||
          (m.loteNro && (m.loteNro === lote.loteNro || m.loteNro === lote.id)) ||
          (m.loteResultanteId && m.loteResultanteId === lote.id);
        const esConsumo =
          m.motivoManual === 'Consumo a granel' ||
          (m.observaciones && m.observaciones.toLowerCase().includes('consumo')) ||
          (m.tipo && m.tipo.toLowerCase().includes('consumo'));
        return matchLote && esConsumo;
      }).reduce((acc, m) => acc + (m.kg || 0), 0);

      const kgPasadosConsumo = Math.max(kgLoteConsumoTotal, kgAjustesConsumo) + kgSilosConsumo;
      const bolsasPasadasConsumo = pesoBolsa > 0 ? Math.round(kgPasadosConsumo / pesoBolsa) : 0;

      // 5. Bolsas y Kg Producidos
      // La confección total integra el stock en nave + las salidas SOLO por despacho + salidas por movimiento + pasado a consumo
      const totalEgresosBolsas = bolsasDespachadas + bolsasMovimientos + bolsasPasadasConsumo;
      const totalEgresosKg = kgDespachados + kgMovimientos + kgPasadosConsumo;

      let bolsasProducidas = 0;
      let kgProducidos = 0;

      if (entradas.length > 0) {
        const bEnt = entradas.reduce((acc, m) => acc + (m.cantidadBolsas || 0), 0);
        const kgEnt = entradas.reduce((acc, m) => acc + (m.cantidadKg || 0), 0);
        bolsasProducidas = Math.max(bEnt, (lote.stockBolsas || 0) + totalEgresosBolsas);
        kgProducidos = Math.max(kgEnt, (lote.stockKg || 0) + totalEgresosKg);
      } else {
        bolsasProducidas = (lote.stockBolsas || 0) + totalEgresosBolsas;
        kgProducidos = (lote.stockKg || 0) + totalEgresosKg;
      }

      // Si aún da 0 y hay stock
      if (kgProducidos === 0 && (lote.stockKg || 0) > 0) {
        kgProducidos = lote.stockKg || 0;
        bolsasProducidas = lote.stockBolsas || 0;
      }

      // 6. Tratamientos y detección si es Tratado
      const trats = Array.isArray(lote.tratamiento)
        ? lote.tratamiento
        : [lote.tratamiento || 'Sin Tratar'];
      const tratamientoStr = trats.join(', ');

      const isTratado = trats.some((t) => {
        const tLower = String(t).trim().toLowerCase();
        return (
          tLower !== 'sin tratar' &&
          tLower !== '' &&
          (tLower.includes('tratad') ||
            tLower.includes('curad') ||
            tLower.includes('fungicida') ||
            tLower.includes('insecticida') ||
            tLower.includes('inoculad') ||
            tLower.includes('polímero') ||
            tLower.includes('rizoderma') ||
            tLower.includes('signum') ||
            tLower.includes('maxim') ||
            tLower.includes('verdesian'))
        );
      });

      // 7. Ubicación
      const ubicacion =
        lote.ubicacionAcopio ||
        (lote.ala && lote.sector ? `Ala ${lote.ala} - Sector ${lote.sector}` : 'Planta General');

      const rawFecha =
        (lote.fechaHoraProduccion ? lote.fechaHoraProduccion.split('T')[0] : '') ||
        lote.fechaIngreso ||
        entradas[0]?.fecha ||
        lote.fechaRealizacionMovimiento ||
        lote.fechaMovimiento ||
        '';
      const fechaProduccion = normalizeToDateString(rawFecha) || '2026-07-13';

      return {
        id: lote.id,
        loteNro: lote.loteNro || lote.id,
        fechaProduccion,
        fechaHoraProduccion: lote.fechaHoraProduccion,
        estadoRegistro: lote.estadoRegistro || 'REALIZADO',
        cliente: (lote.cliente || 'Sin Especificar').trim(),
        especie: (lote.especie || 'Sin Especificar').trim(),
        variedad: (lote.variedad || 'Desconocida').trim(),
        categoria: (lote.categoria || 'Original').trim(),
        tipo: (lote.tipo || 'Final').trim(),
        tratamientos: trats,
        tratamientoStr,
        isTratado,
        kgPorBolsa: lote.kgPorBolsa || 40,
        bolsasProducidas,
        kgProducidos,
        bolsasStock: lote.stockBolsas || 0,
        kgStock: lote.stockKg || 0,
        bolsasDespachadas,
        kgDespachados,
        kgPasadosConsumo,
        bolsasPasadasConsumo,
        bolsasMovimientos,
        kgMovimientos,
        estadoLote: lote.estado || 'Disponible',
        ubicacion,
        loteOriginal: lote,
      };
    });
  }, [lotes, salidas, movimientosSilo]);

  // -------------------------------------------------------------
  // 3. OPCIONES DINÁMICAS Y VINCULANTES DE FILTRO (CASCADA)
  // -------------------------------------------------------------
  // 1. Clientes disponibles (Filtro Principal)
  const opcionesClientes = useMemo(() => {
    const set = new Set<string>();
    (clientesProp || []).forEach((c) => c && set.add(c.trim()));
    (plantaConfig?.clientes || []).forEach((c) => c && set.add(c.trim()));
    allProductionRecords.forEach((r) => r.cliente && set.add(r.cliente));
    return Array.from(set).sort();
  }, [clientesProp, plantaConfig, allProductionRecords]);

  // 2. Especies disponibles (condicionadas a cliente si se seleccionó)
  const opcionesEspecies = useMemo(() => {
    const set = new Set<string>();
    const records = filterCliente
      ? allProductionRecords.filter((r) => r.cliente.toLowerCase() === filterCliente.toLowerCase())
      : allProductionRecords;

    records.forEach((r) => r.especie && set.add(r.especie));
    if (set.size === 0) {
      (especiesProp || []).forEach((e) => e && set.add(e.trim()));
      (plantaConfig?.especies || []).forEach((e) => e && set.add(e.trim()));
    }
    return Array.from(set).sort();
  }, [filterCliente, allProductionRecords, especiesProp, plantaConfig]);

  // 3. Variedades disponibles: VINCULANTE A CLIENTE Y ESPECIE FILTRADOS ANTERIORMENTE
  const opcionesVariedades = useMemo(() => {
    const set = new Set<string>();

    // a) Desde la base de variedades del sistema con función oficial
    if (filterEspecie && filterCliente) {
      const visibles = getVariedadesVisibles(plantaConfig?.variedadesDb, filterEspecie, filterCliente);
      visibles.forEach((v) => v.nombre && set.add(v.nombre.trim()));
    }

    // b) Desde los registros de producción existentes matching con cliente y/o especie
    allProductionRecords.forEach((r) => {
      const matchCli = !filterCliente || r.cliente.toLowerCase() === filterCliente.toLowerCase();
      const matchEsp = !filterEspecie || r.especie.toLowerCase() === filterEspecie.toLowerCase();
      if (matchCli && matchEsp && r.variedad) {
        set.add(r.variedad);
      }
    });

    return Array.from(set).sort();
  }, [filterCliente, filterEspecie, plantaConfig, allProductionRecords]);

  // Si la variedad actual ya no está en las opciones válidas al cambiar cliente/especie, limpiarla
  useEffect(() => {
    if (filterVariedad && opcionesVariedades.length > 0 && !opcionesVariedades.includes(filterVariedad)) {
      setFilterVariedad('');
    }
  }, [opcionesVariedades, filterVariedad]);

  // 4. Categorías disponibles: VINCULANTE A VARIEDAD FILTRADA ANTERIORMENTE
  const opcionesCategorias = useMemo(() => {
    const set = new Set<string>();
    allProductionRecords.forEach((r) => {
      const matchCli = !filterCliente || r.cliente.toLowerCase() === filterCliente.toLowerCase();
      const matchEsp = !filterEspecie || r.especie.toLowerCase() === filterEspecie.toLowerCase();
      const matchVar = !filterVariedad || r.variedad.toLowerCase() === filterVariedad.toLowerCase();
      if (matchCli && matchEsp && matchVar && r.categoria) {
        set.add(r.categoria);
      }
    });

    if (set.size === 0 && plantaConfig?.categorias) {
      plantaConfig.categorias.forEach((c) => set.add(c));
    }
    return Array.from(set).sort();
  }, [filterCliente, filterEspecie, filterVariedad, allProductionRecords, plantaConfig]);

  useEffect(() => {
    if (filterCategoria && opcionesCategorias.length > 0 && !opcionesCategorias.includes(filterCategoria)) {
      setFilterCategoria('');
    }
  }, [opcionesCategorias, filterCategoria]);

  // 5. Tipos disponibles: VINCULANTE A VARIEDAD FILTRADA ANTERIORMENTE
  const opcionesTipos = useMemo(() => {
    const set = new Set<string>();
    allProductionRecords.forEach((r) => {
      const matchCli = !filterCliente || r.cliente.toLowerCase() === filterCliente.toLowerCase();
      const matchEsp = !filterEspecie || r.especie.toLowerCase() === filterEspecie.toLowerCase();
      const matchVar = !filterVariedad || r.variedad.toLowerCase() === filterVariedad.toLowerCase();
      if (matchCli && matchEsp && matchVar && r.tipo) {
        set.add(r.tipo);
      }
    });

    if (set.size === 0 && plantaConfig?.tipos) {
      plantaConfig.tipos.forEach((t) => set.add(t));
    }
    return Array.from(set).sort();
  }, [filterCliente, filterEspecie, filterVariedad, allProductionRecords, plantaConfig]);

  useEffect(() => {
    if (filterTipo && opcionesTipos.length > 0 && !opcionesTipos.includes(filterTipo)) {
      setFilterTipo('');
    }
  }, [opcionesTipos, filterTipo]);

  // 6. Tratamientos disponibles: VINCULANTE A VARIEDAD FILTRADA ANTERIORMENTE
  const opcionesTratamientos = useMemo(() => {
    const set = new Set<string>();
    allProductionRecords.forEach((r) => {
      const matchCli = !filterCliente || r.cliente.toLowerCase() === filterCliente.toLowerCase();
      const matchEsp = !filterEspecie || r.especie.toLowerCase() === filterEspecie.toLowerCase();
      const matchVar = !filterVariedad || r.variedad.toLowerCase() === filterVariedad.toLowerCase();
      if (matchCli && matchEsp && matchVar) {
        r.tratamientos.forEach((t) => t && set.add(t.trim()));
      }
    });

    if (set.size === 0 && plantaConfig?.tratamientos) {
      plantaConfig.tratamientos.forEach((t) => set.add(t));
    }
    return Array.from(set).sort();
  }, [filterCliente, filterEspecie, filterVariedad, allProductionRecords, plantaConfig]);

  useEffect(() => {
    if (filterTratamiento && opcionesTratamientos.length > 0 && !opcionesTratamientos.includes(filterTratamiento)) {
      setFilterTratamiento('');
    }
  }, [opcionesTratamientos, filterTratamiento]);

  // 7. Tamaños de Bolsa disponibles (ej: 40 kg, 50 kg, 800 kg, 1000 kg)
  const opcionesTamanoBolsa = useMemo(() => {
    const set = new Set<number>();
    allProductionRecords.forEach((r) => {
      const matchCli = !filterCliente || r.cliente.toLowerCase() === filterCliente.toLowerCase();
      const matchEsp = !filterEspecie || r.especie.toLowerCase() === filterEspecie.toLowerCase();
      const matchVar = !filterVariedad || r.variedad.toLowerCase() === filterVariedad.toLowerCase();
      if (matchCli && matchEsp && matchVar && r.kgPorBolsa) {
        set.add(r.kgPorBolsa);
      }
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [filterCliente, filterEspecie, filterVariedad, allProductionRecords]);

  // -------------------------------------------------------------
  // 4. REGISTROS FILTRADOS FINALES
  // -------------------------------------------------------------
  const filteredRecords = useMemo(() => {
    return allProductionRecords.filter((r) => {
      // Filtro Temporal: Fecha Desde / Hasta de Producción
      if (filterFechaDesde) {
        if (!r.fechaProduccion || r.fechaProduccion < filterFechaDesde) return false;
      }
      if (filterFechaHasta) {
        if (!r.fechaProduccion || r.fechaProduccion > filterFechaHasta) return false;
      }

      if (filterCliente && r.cliente.toLowerCase() !== filterCliente.toLowerCase()) return false;
      if (filterEspecie && r.especie.toLowerCase() !== filterEspecie.toLowerCase()) return false;
      if (filterVariedad && r.variedad.toLowerCase() !== filterVariedad.toLowerCase()) return false;
      if (filterCategoria && r.categoria.toLowerCase() !== filterCategoria.toLowerCase()) return false;
      if (filterTipo && r.tipo.toLowerCase() !== filterTipo.toLowerCase()) return false;
      if (filterTratamiento) {
        const matchesTrat = r.tratamientos.some(
          (t) => t.toLowerCase() === filterTratamiento.toLowerCase()
        );
        if (!matchesTrat) return false;
      }
      if (filterTamanoBolsa && String(r.kgPorBolsa) !== filterTamanoBolsa) return false;

      return true;
    });
  }, [
    allProductionRecords,
    filterFechaDesde,
    filterFechaHasta,
    filterCliente,
    filterEspecie,
    filterVariedad,
    filterCategoria,
    filterTipo,
    filterTratamiento,
    filterTamanoBolsa,
  ]);

  // Cantidad de filtros activos
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterFechaDesde) count++;
    if (filterFechaHasta) count++;
    if (filterCliente) count++;
    if (filterEspecie) count++;
    if (filterVariedad) count++;
    if (filterCategoria) count++;
    if (filterTipo) count++;
    if (filterTratamiento) count++;
    if (filterTamanoBolsa) count++;
    return count;
  }, [
    filterFechaDesde,
    filterFechaHasta,
    filterCliente,
    filterEspecie,
    filterVariedad,
    filterCategoria,
    filterTipo,
    filterTratamiento,
    filterTamanoBolsa,
  ]);

  // -------------------------------------------------------------
  // 4.b SELECCIÓN DE LOTES (PERSISTENCIA Y OPTIMIZACIÓN DE NAVEGACIÓN)
  // -------------------------------------------------------------
  const DASHBOARD_SELECTED_KEY = 'agroabacus_dashboard_selected_lotes_v1';
  const [selectedLoteIds, setSelectedLoteIds] = useState<Set<string>>(() => {
    try {
      const saved = sessionStorage.getItem('agroabacus_dashboard_selected_lotes_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return new Set(parsed);
        }
      }
    } catch {}
    return new Set();
  });
  const [showOnlySelected, setShowOnlySelected] = useState<boolean>(false);
  const lastFilterKeyRef = useRef<string | null>(null);

  // Persistir en sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(DASHBOARD_SELECTED_KEY, JSON.stringify(Array.from(selectedLoteIds)));
    } catch {}
  }, [selectedLoteIds]);

  // Selección inteligente: si cambia el filtro principal, seleccionar los lotes del filtro
  // respetando si el usuario ya tenía lotes seleccionados válidos
  useEffect(() => {
    const filterKey = `${filterFechaDesde}|${filterFechaHasta}|${filterCliente}|${filterEspecie}|${filterVariedad}|${filterCategoria}|${filterTipo}|${filterTratamiento}|${filterTamanoBolsa}`;
    const allFilteredIds = filteredRecords.map((r) => r.id);

    if (lastFilterKeyRef.current !== filterKey) {
      lastFilterKeyRef.current = filterKey;
      setSelectedLoteIds((prev) => {
        const validPrev = new Set(Array.from(prev).filter((id) => allFilteredIds.includes(id)));
        if (validPrev.size > 0) {
          return validPrev;
        }
        return new Set(allFilteredIds);
      });
    } else {
      // Si la lista de lotes cambia internamente pero los filtros siguen iguales, asegurar que no queden IDs huérfanos
      setSelectedLoteIds((prev) => {
        if (prev.size === 0 && allFilteredIds.length > 0) {
          return new Set(allFilteredIds);
        }
        const validPrev = new Set(Array.from(prev).filter((id) => allFilteredIds.includes(id)));
        if (validPrev.size === 0 && allFilteredIds.length > 0) {
          return new Set(allFilteredIds);
        }
        return validPrev;
      });
    }
  }, [
    filterFechaDesde,
    filterFechaHasta,
    filterCliente,
    filterEspecie,
    filterVariedad,
    filterCategoria,
    filterTipo,
    filterTratamiento,
    filterTamanoBolsa,
    filteredRecords,
  ]);

  // Registros seleccionados activos para cálculos de stock
  const selectedRecords = useMemo(() => {
    return filteredRecords.filter((r) => selectedLoteIds.has(r.id));
  }, [filteredRecords, selectedLoteIds]);

  const isAllSelected = useMemo(() => {
    if (filteredRecords.length === 0) return false;
    return filteredRecords.every((r) => selectedLoteIds.has(r.id));
  }, [filteredRecords, selectedLoteIds]);

  const isAnySelected = useMemo(() => {
    return filteredRecords.some((r) => selectedLoteIds.has(r.id));
  }, [filteredRecords, selectedLoteIds]);

  const isIndeterminate = isAnySelected && !isAllSelected;

  const handleSelectAll = () => {
    setSelectedLoteIds(new Set(filteredRecords.map((r) => r.id)));
  };

  const handleDeselectAll = () => {
    setSelectedLoteIds(new Set());
  };

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      handleDeselectAll();
    } else {
      handleSelectAll();
    }
  };

  const handleToggleLote = (id: string) => {
    setSelectedLoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // -------------------------------------------------------------
  // 5. CÁLCULO DE TOTALES GLOBALES (CONTEXTO) Y VISORES (STOCK SELECCIONADO)
  // -------------------------------------------------------------
  // Totales Globales del Filtro (para referencia de contexto)
  const globalTotalKgStock = useMemo(
    () => filteredRecords.reduce((sum, r) => sum + r.kgStock, 0),
    [filteredRecords]
  );
  const globalTotalTnStock = globalTotalKgStock / 1000;
  const globalTotalBolsasStock = useMemo(
    () => filteredRecords.reduce((sum, r) => sum + r.bolsasStock, 0),
    [filteredRecords]
  );
  const globalTotalKgProducidos = useMemo(
    () => filteredRecords.reduce((sum, r) => sum + r.kgProducidos, 0),
    [filteredRecords]
  );
  const globalTotalTnProducidas = globalTotalKgProducidos / 1000;
  const globalTotalBolsasProducidas = useMemo(
    () => filteredRecords.reduce((sum, r) => sum + r.bolsasProducidas, 0),
    [filteredRecords]
  );

  // VISOR 1: KILOS (Basado estrictamente en los lotes seleccionados)
  const totalKgProducidos = useMemo(
    () => selectedRecords.reduce((sum, r) => sum + r.kgProducidos, 0),
    [selectedRecords]
  );
  const totalKgStock = useMemo(
    () => selectedRecords.reduce((sum, r) => sum + r.kgStock, 0),
    [selectedRecords]
  );
  // SOLO egresos efectivos por despacho comercial (excluye movimientos internos y pasado a consumo)
  const totalKgDespachados = useMemo(
    () => selectedRecords.reduce((sum, r) => sum + r.kgDespachados, 0),
    [selectedRecords]
  );
  const totalTnProducidas = totalKgProducidos / 1000;
  const totalTnStock = totalKgStock / 1000;
  const totalTnDespachadas = totalKgDespachados / 1000;
  const porcentajeKgEnStock =
    totalKgProducidos > 0 ? (totalKgStock / totalKgProducidos) * 100 : 0;
  const porcentajeKgDespachados =
    totalKgProducidos > 0 ? (totalKgDespachados / totalKgProducidos) * 100 : 0;

  // VISOR 2: BOLSAS (Basado estrictamente en los lotes seleccionados)
  const totalBolsasProducidas = useMemo(
    () => selectedRecords.reduce((sum, r) => sum + r.bolsasProducidas, 0),
    [selectedRecords]
  );
  const totalBolsasStock = useMemo(
    () => selectedRecords.reduce((sum, r) => sum + r.bolsasStock, 0),
    [selectedRecords]
  );
  // SOLO bolsas egresadas por despacho oficial (excluye movimientos y pasado a consumo)
  const totalBolsasDespachadas = useMemo(
    () => selectedRecords.reduce((sum, r) => sum + r.bolsasDespachadas, 0),
    [selectedRecords]
  );
  const porcentajeBolsasDespachadas =
    totalBolsasProducidas > 0 ? (totalBolsasDespachadas / totalBolsasProducidas) * 100 : 0;
  const totalLotesProducidos = selectedRecords.length;
  const totalLotesConStock = useMemo(
    () => selectedRecords.filter((r) => r.bolsasStock > 0).length,
    [selectedRecords]
  );
  const porcentajeBolsasEnStock =
    totalBolsasProducidas > 0 ? (totalBolsasStock / totalBolsasProducidas) * 100 : 0;

  // TOTALES DE SALIDAS POR MOVIMIENTOS INTERNOS ENTRE LOTES
  const totalKgMovimientos = useMemo(
    () => selectedRecords.reduce((sum, r) => sum + (r.kgMovimientos || 0), 0),
    [selectedRecords]
  );
  const totalBolsasMovimientos = useMemo(
    () => selectedRecords.reduce((sum, r) => sum + (r.bolsasMovimientos || 0), 0),
    [selectedRecords]
  );

  // VISOR 3: ANÁLISIS COMPARATIVO DE TRATAMIENTO (De los lotes seleccionados)
  const kgTratadosProducidos = useMemo(
    () => selectedRecords.filter((r) => r.isTratado).reduce((sum, r) => sum + r.kgProducidos, 0),
    [selectedRecords]
  );
  const kgSinTratarProducidos = useMemo(
    () => selectedRecords.filter((r) => !r.isTratado).reduce((sum, r) => sum + r.kgProducidos, 0),
    [selectedRecords]
  );
  const porcentajeTratado =
    totalKgProducidos > 0 ? (kgTratadosProducidos / totalKgProducidos) * 100 : 0;
  const porcentajeSinTratar =
    totalKgProducidos > 0 ? (kgSinTratarProducidos / totalKgProducidos) * 100 : 0;

  // Stock Tratado vs Sin Tratar (Lotes seleccionados)
  const kgTratadosStock = useMemo(
    () => selectedRecords.filter((r) => r.isTratado).reduce((sum, r) => sum + r.kgStock, 0),
    [selectedRecords]
  );
  const kgSinTratarStock = useMemo(
    () => selectedRecords.filter((r) => !r.isTratado).reduce((sum, r) => sum + r.kgStock, 0),
    [selectedRecords]
  );

  // Bolsas Tratadas y Sin Tratar (Lotes seleccionados)
  const bolsasTratadasProducidas = useMemo(
    () => selectedRecords.filter((r) => r.isTratado).reduce((sum, r) => sum + r.bolsasProducidas, 0),
    [selectedRecords]
  );
  const bolsasSinTratarProducidas = useMemo(
    () => selectedRecords.filter((r) => !r.isTratado).reduce((sum, r) => sum + r.bolsasProducidas, 0),
    [selectedRecords]
  );
  const porcentajeBolsasTratadas =
    totalBolsasProducidas > 0 ? (bolsasTratadasProducidas / totalBolsasProducidas) * 100 : 0;
  const porcentajeBolsasSinTratar =
    totalBolsasProducidas > 0 ? (bolsasSinTratarProducidas / totalBolsasProducidas) * 100 : 0;

  const bolsasTratadasStock = useMemo(
    () => selectedRecords.filter((r) => r.isTratado).reduce((sum, r) => sum + r.bolsasStock, 0),
    [selectedRecords]
  );
  const bolsasSinTratarStock = useMemo(
    () => selectedRecords.filter((r) => !r.isTratado).reduce((sum, r) => sum + r.bolsasStock, 0),
    [selectedRecords]
  );

  // TOTALES DE LOTES Y KILOS PASADOS A CONSUMO (Lotes seleccionados)
  const totalKgPasadosConsumo = useMemo(
    () => selectedRecords.reduce((sum, r) => sum + r.kgPasadosConsumo, 0),
    [selectedRecords]
  );
  const totalBolsasPasadasConsumo = useMemo(
    () => selectedRecords.reduce((sum, r) => sum + r.bolsasPasadasConsumo, 0),
    [selectedRecords]
  );
  const totalLotesPasadosConsumo = useMemo(
    () => selectedRecords.filter((r) => r.kgPasadosConsumo > 0 || r.estadoLote === 'A Consumo').length,
    [selectedRecords]
  );

  // Desglose de tratamientos específicos aplicados (Lotes seleccionados)
  const tratamientosBreakdown = useMemo(() => {
    const map = new Map<string, { nombre: string; kgProducidos: number; kgStock: number; lotes: number }>();
    selectedRecords.forEach((r) => {
      r.tratamientos.forEach((t) => {
        const nombreTrat = t.trim() || 'Sin Tratar';
        const existing = map.get(nombreTrat) || {
          nombre: nombreTrat,
          kgProducidos: 0,
          kgStock: 0,
          lotes: 0,
        };
        existing.kgProducidos += r.kgProducidos;
        existing.kgStock += r.kgStock;
        existing.lotes += 1;
        map.set(nombreTrat, existing);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.kgProducidos - a.kgProducidos);
  }, [selectedRecords]);

  // -------------------------------------------------------------
  // 6. DATOS PARA GRÁFICOS VISUALES (DE LOTES SELECCIONADOS)
  // -------------------------------------------------------------
  // Gráfico por Variedad (Top 8)
  const chartVariedadesData = useMemo(() => {
    const map = new Map<string, { variedad: string; kgProducidos: number; kgStock: number; bolsasProducidas: number; bolsasStock: number }>();
    selectedRecords.forEach((r) => {
      const existing = map.get(r.variedad) || {
        variedad: r.variedad,
        kgProducidos: 0,
        kgStock: 0,
        bolsasProducidas: 0,
        bolsasStock: 0,
      };
      existing.kgProducidos += r.kgProducidos;
      existing.kgStock += r.kgStock;
      existing.bolsasProducidas += r.bolsasProducidas;
      existing.bolsasStock += r.bolsasStock;
      map.set(r.variedad, existing);
    });
    return Array.from(map.values())
      .sort((a, b) => b.kgProducidos - a.kgProducidos)
      .slice(0, 8);
  }, [selectedRecords]);

  // Gráfico Tratamiento vs Sin Tratar (Pie)
  const chartTratamientoPie = useMemo(() => {
    return [
      { name: 'Tratado con Químicos', value: kgTratadosProducidos, color: '#7C3AED' },
      { name: 'Sin Tratar (Convencional)', value: kgSinTratarProducidos, color: '#00603C' },
    ].filter((item) => item.value > 0);
  }, [kgTratadosProducidos, kgSinTratarProducidos]);

  // -------------------------------------------------------------
  // 7. REGISTROS FILTRADOS POR TEXTO PARA LA TABLA SEGÚN MODO
  // -------------------------------------------------------------
  const tableRows = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    let rows = filteredRecords;

    if (showOnlySelected) {
      rows = rows.filter((r) => selectedLoteIds.has(r.id));
    }

    if (activeMode === 'stock') {
      // En modo stock, mostrar prioritariamente los lotes con stock > 0 (o todos los que coincidan)
      rows = rows.filter((r) => r.bolsasStock > 0 || r.kgStock > 0);
    }

    if (!q) return rows;

    return rows.filter((r) => {
      return (
        r.loteNro.toLowerCase().includes(q) ||
        r.cliente.toLowerCase().includes(q) ||
        r.especie.toLowerCase().includes(q) ||
        r.variedad.toLowerCase().includes(q) ||
        r.categoria.toLowerCase().includes(q) ||
        r.tipo.toLowerCase().includes(q) ||
        r.tratamientoStr.toLowerCase().includes(q) ||
        r.ubicacion.toLowerCase().includes(q) ||
        r.estadoLote.toLowerCase().includes(q)
      );
    });
  }, [filteredRecords, showOnlySelected, selectedLoteIds, activeMode, tableSearch]);

  // -------------------------------------------------------------
  // 8. EXPORTACIONES A EXCEL Y CSV CON HOJA DE RESUMEN EJECUTIVO
  // -------------------------------------------------------------
  const handleExportExcel = () => {
    const scopeStr = filterVariedad
      ? `Variedad ${filterVariedad} (${filterCliente || 'Todos los clientes'})`
      : filterCliente
      ? `Cliente: ${filterCliente}`
      : 'Planta Global (Todos los Clientes)';

    // 1. Hoja de Resumen de Visores (Total Producido, Total Stock, Tratamiento, Bolsas)
    const resumenData = [
      { 'MÉTRICA / INDICADOR': 'REPORTE EJECUTIVO - AGRO ABACUS S.A.', 'VALOR / CANTIDAD': '', 'UNIDAD': '', 'DETALLE / OBSERVACIÓN': '' },
      { 'MÉTRICA / INDICADOR': 'Fecha y Hora de Emisión', 'VALOR / CANTIDAD': new Date().toLocaleString('es-AR'), 'UNIDAD': '', 'DETALLE / OBSERVACIÓN': 'Generado desde Info Console · Producción & Stock' },
      { 'MÉTRICA / INDICADOR': 'Modo de Consulta', 'VALOR / CANTIDAD': activeMode === 'produccion' ? '1. Producción (Histórico Acumulado)' : '2. Stock en Planta (Físico Actual)', 'UNIDAD': '', 'DETALLE / OBSERVACIÓN': `${tableRows.length} lotes listados en tabla` },
      { 'MÉTRICA / INDICADOR': 'Lotes Seleccionados para Stock', 'VALOR / CANTIDAD': `${selectedRecords.length} de ${filteredRecords.length}`, 'UNIDAD': 'lotes', 'DETALLE / OBSERVACIÓN': selectedRecords.length === filteredRecords.length ? 'Todos los lotes incluidos por defecto' : `Selección activa de ${selectedRecords.length} lotes para cálculo de stock` },
      { 'MÉTRICA / INDICADOR': 'Alcance / Filtro Cliente', 'VALOR / CANTIDAD': filterCliente || 'Todos los clientes', 'UNIDAD': '', 'DETALLE / OBSERVACIÓN': scopeStr },
      { 'MÉTRICA / INDICADOR': 'Filtro Período Producción (Desde)', 'VALOR / CANTIDAD': filterFechaDesde ? formatDateArg(filterFechaDesde) : 'Sin límite inferior (histórico)', 'UNIDAD': '', 'DETALLE / OBSERVACIÓN': '' },
      { 'MÉTRICA / INDICADOR': 'Filtro Período Producción (Hasta)', 'VALOR / CANTIDAD': filterFechaHasta ? formatDateArg(filterFechaHasta) : 'Sin límite superior (al día)', 'UNIDAD': '', 'DETALLE / OBSERVACIÓN': '' },
      { 'MÉTRICA / INDICADOR': 'Filtro Especie', 'VALOR / CANTIDAD': filterEspecie || 'Todas las especies', 'UNIDAD': '', 'DETALLE / OBSERVACIÓN': '' },
      { 'MÉTRICA / INDICADOR': 'Filtro Variedad', 'VALOR / CANTIDAD': filterVariedad || 'Todas las variedades', 'UNIDAD': '', 'DETALLE / OBSERVACIÓN': '' },
      { 'MÉTRICA / INDICADOR': 'Filtro Categoría', 'VALOR / CANTIDAD': filterCategoria || 'Todas las categorías', 'UNIDAD': '', 'DETALLE / OBSERVACIÓN': '' },
      { 'MÉTRICA / INDICADOR': 'Filtro Tratamiento', 'VALOR / CANTIDAD': filterTratamiento || 'Todos los tratamientos', 'UNIDAD': '', 'DETALLE / OBSERVACIÓN': '' },
      { 'MÉTRICA / INDICADOR': 'Filtro Tamaño Envase', 'VALOR / CANTIDAD': filterTamanoBolsa ? `${filterTamanoBolsa} kg` : 'Todos los envases', 'UNIDAD': '', 'DETALLE / OBSERVACIÓN': '' },
      { 'MÉTRICA / INDICADOR': '', 'VALOR / CANTIDAD': '', 'UNIDAD': '', 'DETALLE / OBSERVACIÓN': '' },

      { 'MÉTRICA / INDICADOR': '=== 1. BALANCE DE KILOS (VISOR 1) ===', 'VALOR / CANTIDAD': '', 'UNIDAD': '', 'DETALLE / OBSERVACIÓN': '' },
      { 'MÉTRICA / INDICADOR': 'Total Kilos Producidos', 'VALOR / CANTIDAD': totalKgProducidos, 'UNIDAD': 'kg', 'DETALLE / OBSERVACIÓN': `${totalTnProducidas.toFixed(2)} Tn brutas elaboradas` },
      { 'MÉTRICA / INDICADOR': 'Total Toneladas Producidas', 'VALOR / CANTIDAD': Number(totalTnProducidas.toFixed(2)), 'UNIDAD': 'Tn', 'DETALLE / OBSERVACIÓN': 'Equivalente métrico en toneladas' },
      { 'MÉTRICA / INDICADOR': 'Total Kilos en Stock Físico', 'VALOR / CANTIDAD': totalKgStock, 'UNIDAD': 'kg', 'DETALLE / OBSERVACIÓN': `${porcentajeKgEnStock.toFixed(1)}% del volumen total en nave` },
      { 'MÉTRICA / INDICADOR': 'Total Toneladas en Stock Físico', 'VALOR / CANTIDAD': Number(totalTnStock.toFixed(2)), 'UNIDAD': 'Tn', 'DETALLE / OBSERVACIÓN': 'Existencias disponibles' },
      { 'MÉTRICA / INDICADOR': 'Total Kilos Despachados (Solo Despacho)', 'VALOR / CANTIDAD': totalKgDespachados, 'UNIDAD': 'kg', 'DETALLE / OBSERVACIÓN': `${porcentajeKgDespachados.toFixed(1)}% egresado estrictamente por despacho comercial` },
      { 'MÉTRICA / INDICADOR': 'Total Toneladas Despachadas (Solo Despacho)', 'VALOR / CANTIDAD': Number((totalKgDespachados / 1000).toFixed(2)), 'UNIDAD': 'Tn', 'DETALLE / OBSERVACIÓN': 'Volumen egresado con remito oficial' },
      { 'MÉTRICA / INDICADOR': 'Total Kilos Movimientos Internos', 'VALOR / CANTIDAD': totalKgMovimientos, 'UNIDAD': 'kg', 'DETALLE / OBSERVACIÓN': 'Salidas por transferencias o desdoblamiento entre lotes' },
      { 'MÉTRICA / INDICADOR': '', 'VALOR / CANTIDAD': '', 'UNIDAD': '', 'DETALLE / OBSERVACIÓN': '' },

      { 'MÉTRICA / INDICADOR': '=== 2. BALANCE DE BOLSAS Y LOTES (VISOR 1) ===', 'VALOR / CANTIDAD': '', 'UNIDAD': '', 'DETALLE / OBSERVACIÓN': '' },
      { 'MÉTRICA / INDICADOR': 'Total Bolsas Producidas', 'VALOR / CANTIDAD': totalBolsasProducidas, 'UNIDAD': 'bolsas', 'DETALLE / OBSERVACIÓN': 'Confección total acumulada' },
      { 'MÉTRICA / INDICADOR': 'Total Bolsas en Stock', 'VALOR / CANTIDAD': totalBolsasStock, 'UNIDAD': 'bolsas', 'DETALLE / OBSERVACIÓN': `${porcentajeBolsasEnStock.toFixed(1)}% de las bolsas disponibles` },
      { 'MÉTRICA / INDICADOR': 'Total Bolsas Despachadas (Solo Despacho)', 'VALOR / CANTIDAD': totalBolsasDespachadas, 'UNIDAD': 'bolsas', 'DETALLE / OBSERVACIÓN': `${porcentajeBolsasDespachadas.toFixed(1)}% entregadas con remito oficial` },
      { 'MÉTRICA / INDICADOR': 'Total Bolsas Movimientos Internos', 'VALOR / CANTIDAD': totalBolsasMovimientos, 'UNIDAD': 'bolsas', 'DETALLE / OBSERVACIÓN': 'Envases transferidos a otros lotes' },
      { 'MÉTRICA / INDICADOR': 'Total Lotes Producidos', 'VALOR / CANTIDAD': totalLotesProducidos, 'UNIDAD': 'lotes', 'DETALLE / OBSERVACIÓN': 'Partidas registradas' },
      { 'MÉTRICA / INDICADOR': 'Total Lotes con Stock Activo', 'VALOR / CANTIDAD': totalLotesConStock, 'UNIDAD': 'lotes', 'DETALLE / OBSERVACIÓN': `${totalLotesConStock} de ${totalLotesProducidos} lotes con stock > 0` },
      { 'MÉTRICA / INDICADOR': '', 'VALOR / CANTIDAD': '', 'UNIDAD': '', 'DETALLE / OBSERVACIÓN': '' },

      { 'MÉTRICA / INDICADOR': '=== 3. ANÁLISIS DE TRATAMIENTO (VISOR 2 / VISOR 3) ===', 'VALOR / CANTIDAD': '', 'UNIDAD': '', 'DETALLE / OBSERVACIÓN': '' },
      { 'MÉTRICA / INDICADOR': 'Total Kg Tratados Producidos', 'VALOR / CANTIDAD': kgTratadosProducidos, 'UNIDAD': 'kg', 'DETALLE / OBSERVACIÓN': `${porcentajeTratado.toFixed(1)}% del volumen total producido` },
      { 'MÉTRICA / INDICADOR': 'Total Kg Sin Tratar Producidos', 'VALOR / CANTIDAD': kgSinTratarProducidos, 'UNIDAD': 'kg', 'DETALLE / OBSERVACIÓN': `${porcentajeSinTratar.toFixed(1)}% convencional` },
      { 'MÉTRICA / INDICADOR': 'Total Bolsas Producidas Tratadas', 'VALOR / CANTIDAD': bolsasTratadasProducidas, 'UNIDAD': 'bolsas', 'DETALLE / OBSERVACIÓN': `${porcentajeBolsasTratadas.toFixed(1)}% de las bolsas producidas` },
      { 'MÉTRICA / INDICADOR': 'Total Bolsas Sin Tratar Producidas', 'VALOR / CANTIDAD': bolsasSinTratarProducidas, 'UNIDAD': 'bolsas', 'DETALLE / OBSERVACIÓN': `${porcentajeBolsasSinTratar.toFixed(1)}% bolsas convencionales` },
      { 'MÉTRICA / INDICADOR': 'Kg Tratados en Stock Físico', 'VALOR / CANTIDAD': kgTratadosStock, 'UNIDAD': 'kg', 'DETALLE / OBSERVACIÓN': 'Existencias tratadas en nave' },
      { 'MÉTRICA / INDICADOR': 'Bolsas Tratadas en Stock Físico', 'VALOR / CANTIDAD': bolsasTratadasStock, 'UNIDAD': 'bolsas', 'DETALLE / OBSERVACIÓN': 'Envases tratados disponibles' },
      { 'MÉTRICA / INDICADOR': 'Kg Sin Tratar en Stock Físico', 'VALOR / CANTIDAD': kgSinTratarStock, 'UNIDAD': 'kg', 'DETALLE / OBSERVACIÓN': 'Existencias convencionales en nave' },
      { 'MÉTRICA / INDICADOR': 'Bolsas Sin Tratar en Stock Físico', 'VALOR / CANTIDAD': bolsasSinTratarStock, 'UNIDAD': 'bolsas', 'DETALLE / OBSERVACIÓN': 'Envases convencionales disponibles' },
      { 'MÉTRICA / INDICADOR': '', 'VALOR / CANTIDAD': '', 'UNIDAD': '', 'DETALLE / OBSERVACIÓN': '' },

      { 'MÉTRICA / INDICADOR': '=== 4. LOTES Y KILOS PASADOS A CONSUMO ===', 'VALOR / CANTIDAD': '', 'UNIDAD': '', 'DETALLE / OBSERVACIÓN': '' },
      { 'MÉTRICA / INDICADOR': 'Total Kilos Pasados a Consumo', 'VALOR / CANTIDAD': totalKgPasadosConsumo, 'UNIDAD': 'kg', 'DETALLE / OBSERVACIÓN': `${(totalKgPasadosConsumo / 1000).toFixed(2)} Tn derivadas a consumo desde ajustes y silos` },
      { 'MÉTRICA / INDICADOR': 'Total Toneladas Pasadas a Consumo', 'VALOR / CANTIDAD': Number((totalKgPasadosConsumo / 1000).toFixed(2)), 'UNIDAD': 'Tn', 'DETALLE / OBSERVACIÓN': 'Equivalente métrico en toneladas' },
      { 'MÉTRICA / INDICADOR': 'Total Bolsas Pasadas a Consumo', 'VALOR / CANTIDAD': totalBolsasPasadasConsumo, 'UNIDAD': 'bolsas', 'DETALLE / OBSERVACIÓN': 'Equivalente en envases pasados a consumo' },
      { 'MÉTRICA / INDICADOR': 'Cantidad Lotes con Pase a Consumo', 'VALOR / CANTIDAD': totalLotesPasadosConsumo, 'UNIDAD': 'lotes', 'DETALLE / OBSERVACIÓN': 'Partidas con registros de pase a consumo' },
    ];

    const wsResumen = XLSX.utils.json_to_sheet(resumenData);
    wsResumen['!cols'] = [
      { wch: 42 }, // Métrica
      { wch: 20 }, // Valor
      { wch: 10 }, // Unidad
      { wch: 48 }, // Detalle
    ];

    // 2. Hoja de Detalle de Lotes
    const dataToExport = tableRows.map((r) => ({
      'Seleccionado Stock': selectedLoteIds.has(r.id) ? 'SÍ' : 'NO',
      'N° Lote': r.loteNro,
      'Cliente': r.cliente,
      'Especie': r.especie,
      'Variedad': r.variedad,
      'Categoría': r.categoria,
      'Tipo Lote': r.tipo,
      'Tratamiento': r.tratamientoStr,
      'Condición': r.isTratado ? 'Tratado' : 'Sin Tratar',
      'Tamaño Bolsa (kg)': r.kgPorBolsa,
      'Bolsas Producidas': r.bolsasProducidas,
      'Kg Producidos': r.kgProducidos,
      'Tn Producidas': Number((r.kgProducidos / 1000).toFixed(2)),
      'Kilos Pasados a Consumo (Lotes Pasados a Consumo)': r.kgPasadosConsumo,
      'Tn Pasadas a Consumo': Number((r.kgPasadosConsumo / 1000).toFixed(2)),
      'Bolsas Pasadas a Consumo': r.bolsasPasadasConsumo,
      'Bolsas en Stock': r.bolsasStock,
      'Kg en Stock': r.kgStock,
      'Tn en Stock': Number((r.kgStock / 1000).toFixed(2)),
      'Bolsas Despachadas': r.bolsasDespachadas,
      'Kg Despachados': r.kgDespachados,
      'Estado Stock': r.estadoLote,
      'Ubicación': r.ubicacion,
      'Fecha Producción': r.fechaProduccion,
    }));

    const wsDetalle = XLSX.utils.json_to_sheet(dataToExport);
    wsDetalle['!cols'] = [
      { wch: 18 }, // Seleccionado Stock
      { wch: 14 }, // N° Lote
      { wch: 22 }, // Cliente
      { wch: 14 }, // Especie
      { wch: 18 }, // Variedad
      { wch: 12 }, // Categoría
      { wch: 12 }, // Tipo Lote
      { wch: 24 }, // Tratamiento
      { wch: 12 }, // Condición
      { wch: 16 }, // Tamaño Bolsa
      { wch: 16 }, // Bolsas Producidas
      { wch: 16 }, // Kg Producidos
      { wch: 14 }, // Tn Producidas
      { wch: 38 }, // Kilos Pasados a Consumo (Lotes Pasados a Consumo)
      { wch: 18 }, // Tn Pasadas a Consumo
      { wch: 20 }, // Bolsas Pasadas a Consumo
      { wch: 16 }, // Bolsas en Stock
      { wch: 16 }, // Kg en Stock
      { wch: 14 }, // Tn en Stock
      { wch: 16 }, // Bolsas Despachadas
      { wch: 16 }, // Kg Despachados
      { wch: 14 }, // Estado Stock
      { wch: 16 }, // Ubicación
      { wch: 16 }, // Fecha Producción
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, wsResumen, 'Resumen General');
    XLSX.utils.book_append_sheet(
      workbook,
      wsDetalle,
      activeMode === 'produccion' ? 'Detalle Producción' : 'Detalle Stock'
    );

    const clientTag = filterCliente ? `_${filterCliente.replace(/\s+/g, '_')}` : '';
    const varTag = filterVariedad ? `_${filterVariedad.replace(/\s+/g, '_')}` : '';
    const filename = `Reporte_${activeMode.toUpperCase()}${clientTag}${varTag}_${new Date().toISOString().slice(0, 10)}.xlsx`;

    XLSX.writeFile(workbook, filename);
  };

  const handleCopySummary = () => {
    const scopeStr = filterVariedad
      ? `Variedad: ${filterVariedad} (${filterCliente || 'Todos'})`
      : filterCliente
      ? `Cliente: ${filterCliente}`
      : 'Producción Global de Planta';

    const periodoStr = filterFechaDesde && filterFechaHasta
      ? `Del ${formatDateArg(filterFechaDesde)} al ${formatDateArg(filterFechaHasta)}`
      : filterFechaDesde
      ? `Desde ${formatDateArg(filterFechaDesde)}`
      : filterFechaHasta
      ? `Hasta ${formatDateArg(filterFechaHasta)}`
      : 'Histórico Completo';

    const text = `📊 RESUMEN EJECUTIVO - AGRO ABACUS (${scopeStr})
--------------------------------------------------
📅 PERÍODO DE PRODUCCIÓN: ${periodoStr}
📌 ALCANCE & SELECCIÓN:
• Lotes seleccionados: ${selectedRecords.length} de ${filteredRecords.length} (${selectedRecords.length === filteredRecords.length ? 'Todos incluidos' : 'Selección activa para stock'})

⚖️ TOTAL KILOGRAMOS (VISOR 1):
• Producidos: ${formatNumberArg(totalKgProducidos, 0)} kg (${totalTnProducidas.toFixed(2)} Tn)
• En Stock: ${formatNumberArg(totalKgStock, 0)} kg (${totalTnStock.toFixed(2)} Tn - ${porcentajeKgEnStock.toFixed(1)}%)
• Despachados: ${formatNumberArg(totalKgDespachados, 0)} kg (${(totalKgDespachados / 1000).toFixed(2)} Tn - ${porcentajeKgDespachados.toFixed(1)}% SOLO por despacho)
${totalKgMovimientos > 0 ? `• Movimientos Internos: ${formatNumberArg(totalKgMovimientos, 0)} kg (${(totalKgMovimientos / 1000).toFixed(2)} Tn)\n` : ''}• Pasado a Consumo: ${formatNumberArg(totalKgPasadosConsumo, 0)} kg (${(totalKgPasadosConsumo / 1000).toFixed(2)} Tn en ${totalLotesPasadosConsumo} lotes)

📦 TOTAL BOLSAS & LOTES (VISOR 1):
• Producidas: ${formatNumberArg(totalBolsasProducidas, 0)} bolsas
• En Stock: ${formatNumberArg(totalBolsasStock, 0)} bolsas (${porcentajeBolsasEnStock.toFixed(1)}%)
• Despachadas: ${formatNumberArg(totalBolsasDespachadas, 0)} bolsas (${porcentajeBolsasDespachadas.toFixed(1)}% SOLO por despacho)
${totalBolsasMovimientos > 0 ? `• Movimientos Internos: ${formatNumberArg(totalBolsasMovimientos, 0)} bolsas\n` : ''}• Pasadas a Consumo: ${formatNumberArg(totalBolsasPasadasConsumo, 0)} bolsas
• Lotes: ${totalLotesProducidos} producidos / ${totalLotesConStock} con stock activo / ${totalLotesPasadosConsumo} con consumo

🧪 ANÁLISIS TRATAMIENTO (VISOR 2):
• Kg Tratados: ${formatNumberArg(kgTratadosProducidos, 0)} kg (${porcentajeTratado.toFixed(1)}%)
• Bolsas Tratadas: ${formatNumberArg(bolsasTratadasProducidas, 0)} bolsas (${porcentajeBolsasTratadas.toFixed(1)}%)
• Kg Sin Tratar: ${formatNumberArg(kgSinTratarProducidos, 0)} kg (${porcentajeSinTratar.toFixed(1)}%)
• Bolsas Sin Tratar: ${formatNumberArg(bolsasSinTratarProducidas, 0)} bolsas (${porcentajeBolsasSinTratar.toFixed(1)}%)
• Tratado en Stock: ${formatNumberArg(kgTratadosStock, 0)} kg (${formatNumberArg(bolsasTratadasStock, 0)} b.)
--------------------------------------------------
Generado el: ${new Date().toLocaleDateString('es-AR')}`;

    navigator.clipboard.writeText(text);
    setCopiedSummarySuccess(true);
    setTimeout(() => setCopiedSummarySuccess(false), 2500);
  };

  // Estado y Handler para Descarga en formato JPG del Dashboard Info Console · Producción & Stock
  const [isExportingJpg, setIsExportingJpg] = useState(false);

  const handleDescargarJpgDashboard = async () => {
    setIsExportingJpg(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const modeLabel = activeMode === 'produccion' ? 'Produccion' : 'Stock';
      const fileName = `Info_Console_Produccion_y_Stock_${modeLabel}_${today}.jpg`;
      await exportElementAsJpg('info-console-produccion', fileName, {
        backgroundColor: '#071510',
        quality: 0.95,
        pixelRatio: 2,
      });
    } catch (err) {
      console.error('Error al exportar dashboard de Producción & Stock a JPG:', err);
    } finally {
      setIsExportingJpg(false);
    }
  };

  // -------------------------------------------------------------
  // RENDER PRINCIPAL
  // -------------------------------------------------------------
  return (
    <div id="dashboard-produccion-root" className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* ========================================================= */}
      {/* 1. CONSOLA INFORMATIVA SUPERIOR (INFO CONSOLE STYLE) */}
      {/* ========================================================= */}
      <div
        id="info-console-produccion"
        className="bg-gradient-to-br from-slate-950 via-[#003d27] to-[#0c2416] text-white rounded-3xl p-6 sm:p-8 shadow-2xl border-2 border-[#C9922E]/40 space-y-6 relative overflow-hidden backdrop-blur-md"
      >
        {/* Glow de fondo decorativo */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#C9922E]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Encabezado Principal de la Consola */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#C9922E]/30 to-emerald-500/20 border-2 border-[#C9922E]/50 flex items-center justify-center text-[#F6EFDC] font-black shadow-lg shadow-black/40">
              <Factory className="w-6 h-6 text-[#C9922E]" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-sm font-black uppercase tracking-wider text-[#F6EFDC] font-sans">
                  Info Console · Producción & Stock
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  En Vivo
                </span>
                {(filterFechaDesde || filterFechaHasta) && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/25 text-amber-200 border border-amber-400/40 shadow-xs">
                    <Calendar className="w-3.5 h-3.5 text-amber-300" />
                    <span>
                      {filterFechaDesde && filterFechaHasta
                        ? `${formatDateArg(filterFechaDesde)} al ${formatDateArg(filterFechaHasta)}`
                        : filterFechaDesde
                        ? `Desde ${formatDateArg(filterFechaDesde)}`
                        : `Hasta ${formatDateArg(filterFechaHasta)}`}
                    </span>
                  </span>
                )}
                {isFilterPinned && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#C9922E]/30 text-[#F6EFDC] border border-[#C9922E]/60 shadow-xs">
                    <Pin className="w-3.5 h-3.5 text-[#C9922E]" />
                    Filtros Fijados
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-300 font-sans mt-0.5">
                Balance ejecutivo consolidado de masa (Kg/Tn), unidades confeccionadas (Bolsas/Lotes) y análisis comparativo de tratamiento
              </p>
            </div>
          </div>

          {/* Acciones Superiores de la Consola */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Selector de Modos: 1. Producción / 2. Stock */}
            <div className="bg-black/40 p-1.5 rounded-2xl border border-white/20 flex items-center gap-1.5 shadow-inner">
              <button
                type="button"
                id="btn-mode-produccion"
                onClick={() => setActiveMode('produccion')}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
                  activeMode === 'produccion'
                    ? 'bg-[#C9922E] text-slate-950 shadow-md font-black'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
                title="Muestra el balance histórico y métricas de lo producido"
              >
                <Factory className="w-4 h-4" />
                <span>1. Producción</span>
              </button>

              <button
                type="button"
                id="btn-mode-stock"
                onClick={() => setActiveMode('stock')}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
                  activeMode === 'stock'
                    ? 'bg-emerald-400 text-slate-950 shadow-md font-black'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
                title="Muestra el inventario disponible y lo que queda actualmente en planta"
              >
                <Warehouse className="w-4 h-4" />
                <span>2. Stock</span>
              </button>
            </div>

            {/* Botón Descargar JPG Dashboard */}
            <button
              type="button"
              id="btn-descargar-jpg-dashboard-produccion"
              onClick={handleDescargarJpgDashboard}
              disabled={isExportingJpg}
              className="no-export inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-black text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-[#C9922E] hover:from-amber-300 hover:to-amber-500 border-2 border-amber-300/80 rounded-xl transition cursor-pointer shadow-lg shadow-black/30 active:scale-95 disabled:opacity-50"
              title="Descargar este dashboard de Producción & Stock en formato imagen JPG de alta resolución"
            >
              {isExportingJpg ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Generando JPG...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 text-slate-950" />
                  <span>Descargar JPG</span>
                </>
              )}
            </button>

            {/* Botón Fijar Filtros */}
            <button
              type="button"
              id="btn-fijar-filtros-produccion"
              onClick={handleTogglePin}
              className={`no-export inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer border shadow-sm ${
                isFilterPinned
                  ? 'bg-[#C9922E] text-slate-950 border-[#C9922E]'
                  : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
              }`}
              title={isFilterPinned ? 'Desfijar filtros guardados' : 'Fijar filtros actuales en memoria para futuras sesiones'}
            >
              {isFilterPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4 text-[#C9922E]" />}
              <span>{isFilterPinned ? 'Fijado' : 'Fijar Filtros'}</span>
            </button>

            {/* Copiar Resumen */}
            <button
              type="button"
              id="btn-copiar-resumen-produccion"
              onClick={handleCopySummary}
              className="no-export inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition cursor-pointer shadow-sm"
              title="Copiar resumen ejecutivo al portapapeles"
            >
              {copiedSummarySuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span className="text-emerald-300 font-bold">¡Copiado!</span>
                </>
              ) : (
                <>
                  <BarChart2 className="w-4 h-4 text-slate-300" />
                  <span>Copiar Resumen</span>
                </>
              )}
            </button>

            {/* Restablecer Filtros */}
            {activeFiltersCount > 0 && (
              <button
                type="button"
                id="btn-restablecer-filtros-produccion"
                onClick={handleClearFilters}
                className="no-export inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
                title="Restablecer todos los filtros"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Restablecer</span>
              </button>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* VISORES DINÁMICOS UNIFICADOS DE ALTA LEGIBILIDAD (PLANTA) */}
        {/* ========================================================= */}
        <div className="space-y-6 relative z-10">
          {/* ------------------------------------------------------- */}
          {/* 1. VISOR UNIFICADO HERO: BOLSAS PRODUCIDAS & STOCK      */}
          {/* (Tarjetas de gran tamaño para máxima visibilidad en nave)*/}
          {/* ------------------------------------------------------- */}
          <div
            id="visor-unificado-bolsas-stock"
            className="bg-white/10 backdrop-blur-md p-6 sm:p-8 rounded-3xl border-2 border-white/20 hover:border-[#C9922E]/60 transition-all duration-300 shadow-2xl space-y-6 relative overflow-hidden group"
          >
            {/* Encabezado del Visor Unificado */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#C9922E]/30 to-emerald-500/30 border border-[#C9922E]/60 text-[#F6EFDC] flex items-center justify-center shadow-lg shrink-0">
                  <PackageCheck className="w-6 h-6 text-[#C9922E]" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="text-base sm:text-lg font-black uppercase tracking-wider text-[#F6EFDC] font-sans">
                      Reporte de producción y stock en planta
                    </h3>
                    <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-black bg-emerald-500/25 text-emerald-300 border border-emerald-500/40">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      Métrica Clave de Planta
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300 font-sans flex items-center gap-1.5 flex-wrap mt-0.5">
                    <span>Control unificado de unidades confeccionadas, existencia física en naves y balance de egresos</span>
                    {(filterFechaDesde || filterFechaHasta) && (
                      <span className="text-amber-300 font-bold font-mono">
                        • Período: {filterFechaDesde ? formatDateArg(filterFechaDesde) : 'Inicio'} al {filterFechaHasta ? formatDateArg(filterFechaHasta) : 'Hoy'}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Badges de Estado y Selección */}
              <div className="flex items-center gap-2 flex-wrap">
                {selectedRecords.length < filteredRecords.length && (
                  <span className="text-xs px-3 py-1.5 rounded-xl font-mono font-bold bg-amber-500/25 text-amber-200 border border-amber-400/40 shadow-xs flex items-center gap-1.5">
                    <ListChecks className="w-4 h-4" />
                    {selectedRecords.length}/{filteredRecords.length} Lotes Sel.
                  </span>
                )}
                <span className="text-xs px-3.5 py-1.5 rounded-xl font-mono font-bold bg-[#C9922E]/25 text-[#F6EFDC] border border-[#C9922E]/40 shadow-xs">
                  {totalTnProducidas.toFixed(1)} Tn Producidas
                </span>
                <span className="text-xs px-3.5 py-1.5 rounded-xl font-mono font-bold bg-emerald-500/25 text-emerald-200 border border-emerald-500/40 shadow-xs">
                  {totalTnStock.toFixed(1)} Tn en Stock
                </span>
              </div>
            </div>

            {/* TARJETAS DE MAYOR TAMAÑO: BOLSAS PRODUCIDAS VS BOLSAS STOCK VS DESPACHADAS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
              {/* TARJETA 1: BOLSAS PRODUCIDAS (CONFECCIÓN TOTAL) */}
              <div
                onClick={() => setActiveMode('produccion')}
                className={`p-6 rounded-2xl border-2 transition-all duration-200 shadow-xl flex flex-col justify-between space-y-4 cursor-pointer relative overflow-hidden group/card ${
                  activeMode === 'produccion'
                    ? 'bg-slate-900/95 border-[#C9922E] ring-2 ring-[#C9922E]/40 shadow-[#C9922E]/10'
                    : 'bg-black/40 border-white/15 hover:border-[#C9922E]/60 hover:bg-black/55'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5 font-sans">
                      <Factory className="w-4.5 h-4.5 text-[#C9922E]" />
                      Bolsas Producidas
                    </span>
                    <span className={`text-[10.5px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                      activeMode === 'produccion'
                        ? 'bg-[#C9922E] text-slate-950 font-black'
                        : 'bg-white/10 text-slate-300'
                    }`}>
                      {activeMode === 'produccion' ? 'Modo Activo' : '1. Producción'}
                    </span>
                  </div>

                  {/* Número Gigante de Gran Legibilidad */}
                  <div className="py-2">
                    <div className="flex items-baseline gap-2.5 flex-wrap">
                      <span className="text-5xl sm:text-6xl lg:text-7xl font-mono font-black text-white tracking-tight leading-none drop-shadow-md">
                        {formatNumberArg(totalBolsasProducidas, 0)}
                      </span>
                      <span className="text-sm sm:text-base font-bold text-amber-200 font-sans">bolsas</span>
                    </div>
                    <span className="text-xs text-slate-300 block mt-2 font-medium">
                      Confeccionadas en nave de embolse
                    </span>
                  </div>
                </div>

                {/* Métricas Operativas de Producción */}
                <div className="pt-3 border-t border-white/10 grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Lotes Elaborados</span>
                    <span className="text-base font-mono font-bold text-white">
                      {totalLotesProducidos} <span className="text-xs font-normal text-slate-300">partidas</span>
                    </span>
                  </div>
                  <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Masa Bruta</span>
                    <span className="text-base font-mono font-bold text-amber-200">
                      {totalTnProducidas.toFixed(2)} <span className="text-xs font-normal text-slate-300">Tn</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* TARJETA 2: BOLSAS EN STOCK (EXISTENCIA FÍSICA DISPONIBLE EN NAVE) */}
              <div
                onClick={() => setActiveMode('stock')}
                className={`p-6 rounded-2xl border-2 transition-all duration-200 shadow-xl flex flex-col justify-between space-y-4 cursor-pointer relative overflow-hidden group/card ${
                  activeMode === 'stock'
                    ? 'bg-emerald-950/80 border-emerald-400 ring-2 ring-emerald-400/40 shadow-emerald-500/10'
                    : 'bg-black/40 border-white/15 hover:border-emerald-400/60 hover:bg-black/55'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1.5 font-sans">
                      <Warehouse className="w-4.5 h-4.5 text-emerald-400" />
                      Bolsas en Stock
                    </span>
                    <span className={`text-[10.5px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                      activeMode === 'stock'
                        ? 'bg-emerald-400 text-slate-950 font-black'
                        : 'bg-emerald-500/20 text-emerald-200'
                    }`}>
                      {porcentajeBolsasEnStock.toFixed(1)}% Disponible
                    </span>
                  </div>

                  {/* Número Gigante de Gran Legibilidad */}
                  <div className="py-2">
                    <div className="flex items-baseline gap-2.5 flex-wrap">
                      <span className="text-5xl sm:text-6xl lg:text-7xl font-mono font-black text-emerald-300 tracking-tight leading-none drop-shadow-md">
                        {formatNumberArg(totalBolsasStock, 0)}
                      </span>
                      <span className="text-sm sm:text-base font-bold text-emerald-200 font-sans">bolsas en nave</span>
                    </div>
                    <span className="text-xs text-emerald-200/90 block mt-2 font-medium">
                      Existencia física lista para entrega o remito
                    </span>
                  </div>
                </div>

                {/* Métricas Operativas de Stock */}
                <div className="pt-3 border-t border-white/10 grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-emerald-900/30 p-2.5 rounded-xl border border-emerald-500/20">
                    <span className="block text-[10px] uppercase font-bold text-emerald-300">Lotes con Stock</span>
                    <span className="text-base font-mono font-bold text-white">
                      {totalLotesConStock} <span className="text-xs font-normal text-slate-300">/ {totalLotesProducidos}</span>
                    </span>
                  </div>
                  <div className="bg-emerald-900/30 p-2.5 rounded-xl border border-emerald-500/20">
                    <span className="block text-[10px] uppercase font-bold text-emerald-300">Toneladas Stock</span>
                    <span className="text-base font-mono font-bold text-emerald-300">
                      {totalTnStock.toFixed(2)} <span className="text-xs font-normal text-emerald-200">Tn</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* TARJETA 3: BOLSAS DESPACHADAS (SOLO EGRESOS POR DESPACHO) */}
              <div className="p-6 rounded-2xl border-2 border-white/15 bg-black/40 hover:border-amber-400/50 transition-all duration-200 shadow-xl flex flex-col justify-between space-y-4 relative overflow-hidden">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5 font-sans">
                      <Truck className="w-4.5 h-4.5 text-amber-400" />
                      Bolsas Despachadas
                    </span>
                    <span className="text-[10.5px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/25 text-amber-200 uppercase tracking-wider">
                      {porcentajeBolsasDespachadas.toFixed(1)}% Despachado
                    </span>
                  </div>

                  {/* Número Gigante de Gran Legibilidad */}
                  <div className="py-2">
                    <div className="flex items-baseline gap-2.5 flex-wrap">
                      <span className="text-4xl sm:text-5xl lg:text-6xl font-mono font-black text-amber-300 tracking-tight leading-none drop-shadow-md">
                        {formatNumberArg(totalBolsasDespachadas, 0)}
                      </span>
                      <span className="text-sm sm:text-base font-bold text-amber-200 font-sans">bolsas</span>
                    </div>
                    <span className="text-xs text-slate-300 block mt-2 font-medium">
                      Salidas efectivas registradas SOLO por despacho
                    </span>
                  </div>
                </div>

                {/* Métricas Operativas de Despacho */}
                <div className="pt-3 border-t border-white/10 grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Tn Despachadas</span>
                    <span className="text-base font-mono font-bold text-amber-200">
                      {(totalKgDespachados / 1000).toFixed(2)} <span className="text-xs font-normal text-slate-300">Tn</span>
                    </span>
                  </div>
                  <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Kilos Despachados</span>
                    <span className="text-base font-mono font-bold text-white">
                      {formatNumberArg(totalKgDespachados, 0)} <span className="text-xs font-normal text-slate-300">kg</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* BARRA INDUSTRIAL DE FLUJO DE BOLSAS: EN STOCK VS DESPACHADAS */}
            <div className="bg-black/35 p-4 sm:p-5 rounded-2xl border border-white/10 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm font-bold">
                <span className="flex items-center gap-2 text-emerald-300 font-sans">
                  <span className="w-3 h-3 rounded-full bg-emerald-400 shadow-xs"></span>
                  Bolsas en Stock Nave: <strong className="font-mono text-white text-sm sm:text-base">{formatNumberArg(totalBolsasStock, 0)} b.</strong> ({porcentajeBolsasEnStock.toFixed(1)}%)
                </span>
                <span className="flex items-center gap-2 text-amber-300 font-sans">
                  <span className="w-3 h-3 rounded-full bg-amber-400 shadow-xs"></span>
                  Bolsas Despachadas: <strong className="font-mono text-white text-sm sm:text-base">{formatNumberArg(totalBolsasDespachadas, 0)} b.</strong> ({porcentajeBolsasDespachadas.toFixed(1)}%)
                </span>
                {totalBolsasPasadasConsumo > 0 && (
                  <span className="flex items-center gap-2 text-purple-300 font-sans">
                    <span className="w-3 h-3 rounded-full bg-purple-400 shadow-xs"></span>
                    A Consumo: <strong className="font-mono text-white text-sm">{formatNumberArg(totalBolsasPasadasConsumo, 0)} b.</strong>
                  </span>
                )}
                {totalBolsasMovimientos > 0 && (
                  <span className="flex items-center gap-2 text-blue-300 font-sans">
                    <span className="w-3 h-3 rounded-full bg-blue-400 shadow-xs"></span>
                    Movimientos: <strong className="font-mono text-white text-sm">{formatNumberArg(totalBolsasMovimientos, 0)} b.</strong>
                  </span>
                )}
              </div>

              {/* Barra de progreso de alto impacto */}
              <div className="w-full h-5 sm:h-6 bg-black/60 rounded-full overflow-hidden p-0.5 border border-white/20 flex shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500 relative flex items-center justify-end pr-2 text-[10.5px] font-mono font-black text-slate-950 shadow-md"
                  style={{ width: `${Math.max(porcentajeBolsasEnStock > 0 ? 5 : 0, Math.min(100, porcentajeBolsasEnStock))}%` }}
                  title={`Stock: ${formatNumberArg(totalBolsasStock, 0)} bolsas (${porcentajeBolsasEnStock.toFixed(1)}%)`}
                >
                  {porcentajeBolsasEnStock >= 12 && `${porcentajeBolsasEnStock.toFixed(0)}%`}
                </div>
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-500 relative flex items-center justify-start pl-2 text-[10.5px] font-mono font-black text-slate-950 shadow-md"
                  style={{ width: `${Math.max(porcentajeBolsasDespachadas > 0 ? 5 : 0, Math.min(100, porcentajeBolsasDespachadas))}%` }}
                  title={`Despachadas: ${formatNumberArg(totalBolsasDespachadas, 0)} bolsas (${porcentajeBolsasDespachadas.toFixed(1)}%)`}
                >
                  {porcentajeBolsasDespachadas >= 12 && `${porcentajeBolsasDespachadas.toFixed(0)}%`}
                </div>
                {totalBolsasPasadasConsumo > 0 && (
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full transition-all duration-500 relative flex items-center justify-center text-[10.5px] font-mono font-black text-white shadow-md"
                    style={{ width: `${Math.max(2, Math.min(100, (totalBolsasPasadasConsumo / (totalBolsasProducidas || 1)) * 100))}%` }}
                    title={`A Consumo: ${formatNumberArg(totalBolsasPasadasConsumo, 0)} bolsas`}
                  />
                )}
                {totalBolsasMovimientos > 0 && (
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-500 relative flex items-center justify-center text-[10.5px] font-mono font-black text-white shadow-md"
                    style={{ width: `${Math.max(2, Math.min(100, (totalBolsasMovimientos / (totalBolsasProducidas || 1)) * 100))}%` }}
                    title={`Movimientos internos: ${formatNumberArg(totalBolsasMovimientos, 0)} bolsas`}
                  />
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300 pt-1 font-sans">
                <span>
                  Total confeccionado en línea: <strong className="text-white font-mono">{formatNumberArg(totalBolsasProducidas, 0)} bolsas</strong>
                </span>
                <span>
                  Partidas con stock activo: <strong className="text-emerald-200 font-mono">{totalLotesConStock} de {totalLotesProducidos} lotes</strong>
                </span>
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------- */}
          {/* 2. VISOR PANORÁMICO FULL-WIDTH: TONELADAS NETAS PROCESADAS */}
          {/* ------------------------------------------------------- */}
          <div
            id="visor-toneladas-netas-procesadas"
            className="w-full bg-white/10 backdrop-blur-md p-6 sm:p-8 rounded-3xl border border-white/20 hover:border-[#C9922E]/60 transition-all duration-300 shadow-2xl space-y-6 relative overflow-hidden group"
          >
            {/* Header Visor Toneladas Netas a lo ancho */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#C9922E]/30 to-emerald-500/20 border border-[#C9922E]/50 text-[#F6EFDC] flex items-center justify-center shadow-lg shrink-0">
                  <Scale className="w-6 h-6 text-[#C9922E]" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="text-base sm:text-lg font-black uppercase tracking-wider text-[#F6EFDC] font-sans">
                      Toneladas Netas procesadas
                    </h3>
                    <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-black bg-amber-400/20 text-amber-300 border border-amber-400/40 font-mono">
                      Balanza & Balance de Masa
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300 font-sans mt-0.5">
                    Masa volumétrica en toneladas (Tn) con equivalencia total en kilogramos (Kg) y trazabilidad de destino
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs px-3.5 py-1.5 rounded-xl font-mono font-bold bg-[#C9922E]/25 text-[#F6EFDC] border border-[#C9922E]/40 shadow-xs">
                  {totalTnProducidas.toFixed(2)} Tn ({formatNumberArg(totalKgProducidos, 0)} kg)
                </span>
                <span className="text-xs px-3.5 py-1.5 rounded-xl font-mono font-bold bg-emerald-500/25 text-emerald-200 border border-emerald-500/40 shadow-xs">
                  {totalTnStock.toFixed(2)} Tn Stock ({porcentajeKgEnStock.toFixed(1)}%)
                </span>
                <span className="text-xs px-3 py-1.5 rounded-xl font-mono font-bold bg-amber-500/20 text-amber-200 border border-amber-400/30 shadow-xs">
                  {(totalKgDespachados / 1000).toFixed(2)} Tn Despachado
                </span>
              </div>
            </div>

            {/* Malla de 4 Tarjetas de Masa Ejecutivas distribuidas armónicamente a lo ancho */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
              {/* 1. Toneladas Producidas */}
              <div className="bg-black/35 p-5 rounded-2xl border border-white/15 hover:border-[#C9922E]/50 transition-all duration-200 space-y-2.5 shadow-inner group/mcard flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5 font-sans">
                      <Scale className="w-4 h-4 text-[#C9922E]" />
                      Toneladas Producidas
                    </span>
                    <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-200 border border-amber-400/30">
                      Masa Total
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 py-2">
                    <span className="text-4xl sm:text-5xl font-mono font-black text-white tracking-tight leading-none drop-shadow-md">
                      {totalTnProducidas.toFixed(2)}
                    </span>
                    <span className="text-base sm:text-lg font-bold text-amber-200 font-sans">Tn</span>
                  </div>
                  <span className="text-xs font-mono text-slate-300 block font-medium">
                    ({formatNumberArg(totalKgProducidos, 0)} kg totales procesados)
                  </span>
                </div>
                <div className="pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400 font-sans">
                  <span>Partidas: <strong className="text-white font-mono">{totalLotesProducidos}</strong></span>
                  <span>Promedio: <strong className="text-amber-200 font-mono">{totalLotesProducidos > 0 ? (totalTnProducidas / totalLotesProducidos).toFixed(2) : '0.00'} Tn/lote</strong></span>
                </div>
              </div>

              {/* 2. Toneladas en Stock */}
              <div className="bg-emerald-950/40 p-5 rounded-2xl border border-emerald-500/30 hover:border-emerald-400/60 transition-all duration-200 space-y-2.5 shadow-inner group/mcard flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1.5 font-sans">
                      <Warehouse className="w-4 h-4 text-emerald-400" />
                      Toneladas en Stock
                    </span>
                    <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/25 text-emerald-200 border border-emerald-400/30 font-mono">
                      {porcentajeKgEnStock.toFixed(1)}% Disponible
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 py-2">
                    <span className="text-4xl sm:text-5xl font-mono font-black text-emerald-300 tracking-tight leading-none drop-shadow-md">
                      {totalTnStock.toFixed(2)}
                    </span>
                    <span className="text-base sm:text-lg font-bold text-emerald-200 font-sans">Tn</span>
                  </div>
                  <span className="text-xs font-mono text-emerald-200/90 block font-medium">
                    ({formatNumberArg(totalKgStock, 0)} kg existencia en nave)
                  </span>
                </div>
                <div className="pt-2.5 border-t border-emerald-500/20 flex items-center justify-between text-[11px] text-emerald-300/80 font-sans">
                  <span>Bolsas: <strong className="text-white font-mono">{formatNumberArg(totalBolsasStock, 0)} b.</strong></span>
                  <span>Lotes activos: <strong className="text-emerald-200 font-mono">{totalLotesConStock} de {totalLotesProducidos}</strong></span>
                </div>
              </div>

              {/* 3. Toneladas Despachadas (SOLO EGRESOS POR DESPACHO) */}
              <div className="bg-black/35 p-5 rounded-2xl border border-white/15 hover:border-amber-400/50 transition-all duration-200 space-y-2.5 shadow-inner group/mcard flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5 font-sans">
                      <Truck className="w-4 h-4 text-amber-400" />
                      Toneladas Despachadas
                    </span>
                    <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-200 border border-amber-400/30 font-mono">
                      {porcentajeKgDespachados.toFixed(1)}% Despachado
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 py-2">
                    <span className="text-4xl sm:text-5xl font-mono font-black text-amber-300 tracking-tight leading-none drop-shadow-md">
                      {(totalKgDespachados / 1000).toFixed(2)}
                    </span>
                    <span className="text-base sm:text-lg font-bold text-amber-200 font-sans">Tn</span>
                  </div>
                  <span className="text-xs font-mono text-slate-300 block font-medium">
                    ({formatNumberArg(totalKgDespachados, 0)} kg salidas efectivas SOLO por despacho)
                  </span>
                </div>
                <div className="pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400 font-sans">
                  <span>Bolsas despachadas: <strong className="text-amber-200 font-mono">{formatNumberArg(totalBolsasDespachadas, 0)}</strong></span>
                  <span>Solo con remito / despacho comercial</span>
                </div>
              </div>

              {/* 4. Pasado a Consumo / Merma */}
              <div className="bg-purple-950/30 p-5 rounded-2xl border border-purple-500/30 hover:border-purple-400/50 transition-all duration-200 space-y-2.5 shadow-inner group/mcard flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-purple-200 flex items-center gap-1.5 font-sans">
                      <Layers className="w-4 h-4 text-purple-300" />
                      Pasado a Consumo
                    </span>
                    <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-purple-500/25 text-purple-200 border border-purple-400/40 font-mono">
                      {totalKgProducidos > 0 ? ((totalKgPasadosConsumo / totalKgProducidos) * 100).toFixed(1) : '0.0'}%
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 py-2">
                    <span className="text-4xl sm:text-5xl font-mono font-black text-purple-200 tracking-tight leading-none drop-shadow-md">
                      {(totalKgPasadosConsumo / 1000).toFixed(2)}
                    </span>
                    <span className="text-base sm:text-lg font-bold text-purple-300 font-sans">Tn</span>
                  </div>
                  <span className="text-xs font-mono text-purple-300/90 block font-medium">
                    ({formatNumberArg(totalKgPasadosConsumo, 0)} kg baja/consumo)
                  </span>
                </div>
                <div className="pt-2.5 border-t border-purple-500/20 flex items-center justify-between text-[11px] text-purple-300/80 font-sans">
                  <span>Partidas: <strong className="text-white font-mono">{totalLotesPasadosConsumo}</strong></span>
                  <span>Bolsas: <strong className="text-purple-200 font-mono">{formatNumberArg(totalBolsasPasadasConsumo, 0)}</strong></span>
                </div>
              </div>
            </div>

            {/* Barra Panorámica de Flujo y Distribución de Masa Industrial */}
            <div className="bg-black/40 p-4 sm:p-5 rounded-2xl border border-white/10 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-bold">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="flex items-center gap-2 text-emerald-300 font-sans">
                    <span className="w-3 h-3 rounded-full bg-emerald-400 shadow-xs"></span>
                    Stock en Nave: <strong className="font-mono text-white text-sm">{totalTnStock.toFixed(2)} Tn</strong>{' '}
                    <span className="text-[11px] font-mono text-emerald-300/80">({formatNumberArg(totalKgStock, 0)} kg)</span> ({porcentajeKgEnStock.toFixed(1)}%)
                  </span>
                  <span className="flex items-center gap-2 text-amber-300 font-sans">
                    <span className="w-3 h-3 rounded-full bg-amber-400 shadow-xs"></span>
                    Despachado: <strong className="font-mono text-white text-sm">{(totalKgDespachados / 1000).toFixed(2)} Tn</strong>{' '}
                    <span className="text-[11px] font-mono text-amber-300/80">({formatNumberArg(totalKgDespachados, 0)} kg)</span> ({porcentajeKgDespachados.toFixed(1)}%)
                  </span>
                  {totalKgPasadosConsumo > 0 && (
                    <span className="flex items-center gap-2 text-purple-300 font-sans">
                      <span className="w-3 h-3 rounded-full bg-purple-400 shadow-xs"></span>
                      Pasado a Consumo: <strong className="font-mono text-white text-sm">{(totalKgPasadosConsumo / 1000).toFixed(2)} Tn</strong>{' '}
                      <span className="text-[11px] font-mono text-purple-200/80">({formatNumberArg(totalKgPasadosConsumo, 0)} kg)</span>
                    </span>
                  )}
                  {totalKgMovimientos > 0 && (
                    <span className="flex items-center gap-2 text-blue-300 font-sans">
                      <span className="w-3 h-3 rounded-full bg-blue-400 shadow-xs"></span>
                      Movimientos: <strong className="font-mono text-white text-sm">{(totalKgMovimientos / 1000).toFixed(2)} Tn</strong>{' '}
                      <span className="text-[11px] font-mono text-blue-200/80">({formatNumberArg(totalKgMovimientos, 0)} kg)</span>
                    </span>
                  )}
                </div>
                <span className="text-slate-400 font-sans text-xs">
                  Balance Total: <strong className="text-white font-mono">{totalTnProducidas.toFixed(2)} Tn</strong>
                </span>
              </div>

              {/* Barra de progreso de alto impacto a lo ancho */}
              <div className="w-full h-5 sm:h-6 bg-black/60 rounded-full overflow-hidden p-0.5 border border-white/20 flex shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500 relative flex items-center justify-end pr-2 text-[10.5px] font-mono font-black text-slate-950 shadow-md"
                  style={{ width: `${Math.max(porcentajeKgEnStock > 0 ? 5 : 0, Math.min(100, porcentajeKgEnStock))}%` }}
                  title={`Stock: ${totalTnStock.toFixed(2)} Tn (${porcentajeKgEnStock.toFixed(1)}%)`}
                >
                  {porcentajeKgEnStock >= 12 && `${porcentajeKgEnStock.toFixed(0)}% Stock`}
                </div>
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-500 relative flex items-center justify-start pl-2 text-[10.5px] font-mono font-black text-slate-950 shadow-md"
                  style={{ width: `${Math.max(porcentajeKgDespachados > 0 ? 5 : 0, Math.min(100, porcentajeKgDespachados))}%` }}
                  title={`Despachado: ${(totalKgDespachados / 1000).toFixed(2)} Tn (${porcentajeKgDespachados.toFixed(1)}%)`}
                >
                  {porcentajeKgDespachados >= 12 && `${porcentajeKgDespachados.toFixed(0)}% Desp.`}
                </div>
                {totalKgPasadosConsumo > 0 && (
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full transition-all duration-500 relative flex items-center justify-center text-[10.5px] font-mono font-black text-white shadow-md"
                    style={{ width: `${Math.max(2, Math.min(100, (totalKgPasadosConsumo / (totalKgProducidos || 1)) * 100))}%` }}
                    title={`A Consumo: ${(totalKgPasadosConsumo / 1000).toFixed(2)} Tn`}
                  />
                )}
                {totalKgMovimientos > 0 && (
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-500 relative flex items-center justify-center text-[10.5px] font-mono font-black text-white shadow-md"
                    style={{ width: `${Math.max(2, Math.min(100, (totalKgMovimientos / (totalKgProducidos || 1)) * 100))}%` }}
                    title={`Movimientos internos: ${(totalKgMovimientos / 1000).toFixed(2)} Tn`}
                  />
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300 pt-1 font-sans">
                <span>
                  Total confeccionado en línea: <strong className="text-white font-mono">{formatNumberArg(totalKgProducidos, 0)} kg</strong>{' '}
                  <span className="text-slate-400">({formatNumberArg(totalBolsasProducidas, 0)} bolsas)</span>
                </span>
                <span>
                  Existencia física en nave: <strong className="text-emerald-200 font-mono">{formatNumberArg(totalKgStock, 0)} kg</strong>{' '}
                  <span className="text-emerald-300/80">({formatNumberArg(totalBolsasStock, 0)} bolsas)</span>
                </span>
              </div>
            </div>

            {/* Franja de Resumen Operativo de Masa */}
            <div className="pt-3 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs text-slate-300 font-sans bg-black/25 p-3.5 rounded-2xl border border-white/5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#C9922E]"></span>
                <span>Partidas Evaluadas: <strong className="text-white font-mono">{selectedRecords.length}</strong> lotes</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Masa Activa en Depósito: <strong className="text-emerald-300 font-mono">{totalTnStock.toFixed(2)} Tn</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span>Peso Promedio: <strong className="text-amber-200 font-mono">{totalBolsasProducidas > 0 ? (totalKgProducidos / totalBolsasProducidas).toFixed(1) : '0.0'} kg/bolsa</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                <span>Ratio de Rotación: <strong className="text-purple-200 font-mono">{totalKgStock > 0 ? (totalKgDespachados / totalKgStock).toFixed(2) : '0.00'}x</strong></span>
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------- */}
          {/* 3. VISOR PANORÁMICO FULL-WIDTH: SEGUIMIENTO DE TRATAMIENTO */}
          {/* ------------------------------------------------------- */}
          <div
            id="visor-seguimiento-tratamiento"
            className="w-full bg-white/10 backdrop-blur-md p-6 sm:p-8 rounded-3xl border border-white/20 hover:border-purple-400/60 transition-all duration-300 shadow-2xl space-y-6 relative overflow-hidden group"
          >
            {/* Header Visor Seguimiento de Tratamiento */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/25 border border-purple-400/50 text-purple-300 flex items-center justify-center shadow-lg shrink-0">
                  <FlaskConical className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="text-base sm:text-lg font-black uppercase tracking-wider text-purple-200 font-sans">
                      Seguimiento de Tratamiento
                    </h3>
                    <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-black bg-purple-500/20 text-purple-300 border border-purple-400/30 font-mono">
                      Curasemilla / Inoculante
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-300 mt-0.5 flex-wrap">
                    <span className="text-purple-300 font-bold">Alcance:</span>
                    <span className="text-white font-semibold">
                      {filterVariedad
                        ? `Variedad ${filterVariedad} (${filterCliente || 'Todos'})`
                        : filterCliente
                        ? `Cliente: ${filterCliente}`
                        : 'Producción Global de Planta'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs px-3 py-1.5 rounded-xl font-mono font-bold bg-purple-500/25 text-purple-200 border border-purple-400/30 shadow-xs">
                  {porcentajeTratado.toFixed(1)}% Kg Tratados
                </span>
                <span className="text-xs px-3 py-1.5 rounded-xl font-mono font-bold bg-purple-400/20 text-purple-300 border border-purple-400/30 shadow-xs">
                  {porcentajeBolsasTratadas.toFixed(1)}% Bolsas
                </span>
              </div>
            </div>

            {/* Malla de 2 Columnas Balanceadas a lo ancho */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              {/* Cuadro 1: Kg Tratados */}
              <div
                id="cuadro-principal-kg-tratados"
                className="bg-gradient-to-br from-purple-950/90 via-purple-900/60 to-slate-900/90 p-5 rounded-2xl border-2 border-purple-400/50 shadow-xl space-y-3 relative overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FlaskConical className="w-4.5 h-4.5 text-purple-300" />
                      <span className="text-xs font-black uppercase tracking-wider text-purple-200 font-sans">
                        Kg Tratados
                      </span>
                    </div>
                    <span className="text-[10.5px] font-mono font-bold px-2 py-0.5 rounded-md bg-purple-400/25 text-purple-200 border border-purple-400/40">
                      {(kgTratadosProducidos / 1000).toFixed(2)} Tn
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 py-2">
                    <span className="text-4xl sm:text-5xl font-mono font-black text-white tracking-tight leading-none drop-shadow-md">
                      {formatNumberArg(kgTratadosProducidos, 0)}
                    </span>
                    <span className="text-sm sm:text-base font-bold text-purple-200 font-sans">kg</span>
                  </div>
                  <span className="text-xs font-mono text-purple-300 block">
                    {porcentajeTratado.toFixed(1)}% del volumen total producido
                  </span>
                </div>
                <div className="pt-2.5 border-t border-purple-400/30 flex items-center justify-between text-[11px] text-purple-300 font-mono">
                  <span>Stock en nave:</span>
                  <strong className="text-purple-100">{formatNumberArg(kgTratadosStock, 0)} kg [{(kgTratadosStock / 1000).toFixed(2)} Tn]</strong>
                </div>
              </div>

              {/* Cuadro 2: Bolsas Tratadas */}
              <div className="bg-black/35 p-5 rounded-2xl border border-purple-500/40 space-y-3 shadow-inner flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase font-bold text-purple-300 flex items-center gap-1.5">
                      <PackageCheck className="w-4 h-4 text-purple-300" />
                      Bolsas Tratadas Producidas
                    </span>
                    <span className="text-[10.5px] font-mono text-purple-300 font-bold px-2 py-0.5 rounded-md bg-purple-500/20 border border-purple-400/30">
                      {porcentajeBolsasTratadas.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 py-2">
                    <span className="text-4xl sm:text-5xl font-mono font-black text-purple-200 tracking-tight leading-none">
                      {formatNumberArg(bolsasTratadasProducidas, 0)}
                    </span>
                    <span className="text-sm sm:text-base font-bold text-purple-300 font-sans">bolsas</span>
                  </div>
                  <span className="text-xs font-mono text-purple-300/80 block">
                    Con tratamiento químico o biológico
                  </span>
                </div>
                <div className="pt-2.5 border-t border-purple-500/30 flex items-center justify-between text-[11px] text-purple-300/80 font-mono">
                  <span>Stock de bolsas tratadas:</span>
                  <strong className="text-purple-100">{formatNumberArg(bolsasTratadasStock, 0)} b.</strong>
                </div>
              </div>
            </div>

            {/* Pie de Visor de Seguimiento de Tratamiento */}
            <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300 font-sans bg-black/25 px-4 py-2.5 rounded-2xl border border-white/5">
              <span>
                Tratado en Stock:{' '}
                <strong className="text-purple-200 font-mono">
                  {formatNumberArg(kgTratadosStock, 0)} kg ({formatNumberArg(bolsasTratadasStock, 0)} b.)
                </strong>{' '}
                <span className="text-purple-300/80 font-mono text-[11px]">
                  [{(kgTratadosStock / 1000).toFixed(2)} Tn]
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Resumen de Alcance y Filtros Activos en Cascada */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-300 border-t border-white/10">
          <span className="font-bold text-[#C9922E] flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            Filtros Aplicados ({activeFiltersCount}):
          </span>

          {filterCliente ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#C9922E] text-slate-950 font-black">
              Cliente: {filterCliente}
            </span>
          ) : (
            <span className="text-slate-400 font-medium">Todos los clientes</span>
          )}

          {(filterFechaDesde || filterFechaHasta) && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-500/30 text-amber-200 font-bold border border-amber-400/40">
              <Calendar className="w-3 h-3 text-amber-300" />
              Período: {filterFechaDesde ? formatDateArg(filterFechaDesde) : 'Inicio'} al {filterFechaHasta ? formatDateArg(filterFechaHasta) : 'Hoy'}
            </span>
          )}

          {filterEspecie && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/15 text-white font-medium">
              Especie: {filterEspecie}
            </span>
          )}

          {filterVariedad && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/30 text-emerald-200 font-bold border border-emerald-400/30">
              Variedad: {filterVariedad}
            </span>
          )}

          {filterCategoria && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/15 text-white font-medium">
              Cat: {filterCategoria}
            </span>
          )}

          {filterTipo && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/15 text-white font-medium">
              Tipo: {filterTipo}
            </span>
          )}

          {filterTratamiento && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/30 text-purple-200 font-bold border border-purple-400/30">
              Trat: {filterTratamiento}
            </span>
          )}

          {filterTamanoBolsa && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/15 text-white font-medium">
              Envase: {filterTamanoBolsa} kg
            </span>
          )}

          <div className="ml-auto text-slate-400 text-[10.5px]">
            Modo activo: <strong className="text-white capitalize">{activeMode}</strong> ({tableRows.length} lotes listados)
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. PANEL DE FILTROS EN CASCADA / VINCULANTES */}
      {/* ========================================================= */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-4">
        {/* FILTROS PRINCIPALES: CLIENTE + TEMPORAL (FECHA DESDE / HASTA) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 1. FILTRO PRINCIPAL: CLIENTE */}
          <div className="bg-[#E3EFE7]/50 border-2 border-[#00603C]/30 rounded-xl p-4 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#00603C] text-white flex items-center justify-center shadow-xs shrink-0">
                    <Building2 className="w-4.5 h-4.5 text-[#C9922E]" />
                  </div>
                  <div>
                    <label
                      htmlFor="filtro-principal-cliente"
                      className="block text-xs font-black uppercase tracking-wider text-[#00603C] font-sans"
                    >
                      Filtro Principal: Cliente
                    </label>
                    <span className="block text-[11px] text-gray-500">
                      Condiciona especies, variedades y tratamientos vinculados
                    </span>
                  </div>
                </div>

                {filterCliente && (
                  <button
                    type="button"
                    onClick={() => setFilterCliente('')}
                    className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-bold self-start sm:self-center cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    Quitar Filtro
                  </button>
                )}
              </div>

              <div className="relative">
                <select
                  id="filtro-principal-cliente"
                  value={filterCliente}
                  onChange={(e) => setFilterCliente(e.target.value)}
                  className="w-full bg-white border-2 border-[#00603C]/40 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#00603C] focus:border-[#00603C] shadow-xs cursor-pointer"
                >
                  <option value="">-- Todos los Clientes (Producción Global) --</option>
                  {opcionesClientes.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="text-[11px] text-[#00603C] font-medium">
              {filterCliente ? (
                <span>Filtrando datos exclusivamente para <strong>{filterCliente}</strong></span>
              ) : (
                <span className="text-gray-500">Visualizando producción consolidada de todos los clientes</span>
              )}
            </div>
          </div>

          {/* 2. FILTRO TEMPORAL: PERÍODO DE PRODUCCIÓN (FECHA DESDE / HASTA) */}
          <div className="bg-amber-50/50 border-2 border-amber-600/30 rounded-xl p-4 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-700 text-white flex items-center justify-center shadow-xs shrink-0">
                    <Calendar className="w-4.5 h-4.5 text-amber-200" />
                  </div>
                  <div>
                    <span className="block text-xs font-black uppercase tracking-wider text-amber-950 font-sans">
                      Filtro Temporal: Período de Producción
                    </span>
                    <span className="block text-[11px] text-gray-500">
                      Filtrar lo producido por rango de fecha ("Fecha Desde / Hasta")
                    </span>
                  </div>
                </div>

                {(filterFechaDesde || filterFechaHasta) && (
                  <button
                    type="button"
                    id="btn-quitar-filtro-fechas"
                    onClick={() => {
                      setFilterFechaDesde('');
                      setFilterFechaHasta('');
                    }}
                    className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-bold self-start sm:self-center cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    Quitar Fechas
                  </button>
                )}
              </div>

              {/* Rango de Fechas: Desde y Hasta */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="filtro-fecha-desde" className="block text-[10.5px] font-bold text-amber-950 uppercase tracking-wider mb-1">
                    Fecha Desde
                  </label>
                  <input
                    type="date"
                    id="filtro-fecha-desde"
                    value={filterFechaDesde}
                    onChange={(e) => setFilterFechaDesde(e.target.value)}
                    className="w-full bg-white border-2 border-amber-600/30 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-amber-600 shadow-xs cursor-pointer font-mono"
                  />
                </div>

                <div>
                  <label htmlFor="filtro-fecha-hasta" className="block text-[10.5px] font-bold text-amber-950 uppercase tracking-wider mb-1">
                    Fecha Hasta
                  </label>
                  <input
                    type="date"
                    id="filtro-fecha-hasta"
                    value={filterFechaHasta}
                    onChange={(e) => setFilterFechaHasta(e.target.value)}
                    className="w-full bg-white border-2 border-amber-600/30 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-amber-600 shadow-xs cursor-pointer font-mono"
                  />
                </div>
              </div>

              {/* Presets Rápidos de Fecha */}
              <div className="flex items-center gap-1.5 flex-wrap pt-2.5">
                <span className="text-[10px] uppercase font-bold text-amber-900 mr-0.5">Accesos:</span>
                <button
                  type="button"
                  id="btn-preset-fecha-hoy"
                  onClick={() => handleSetPresetDates('hoy')}
                  className="px-2 py-1 rounded-md text-[11px] font-semibold bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 transition shadow-2xs cursor-pointer"
                >
                  Hoy
                </button>
                <button
                  type="button"
                  id="btn-preset-fecha-7dias"
                  onClick={() => handleSetPresetDates('7dias')}
                  className="px-2 py-1 rounded-md text-[11px] font-semibold bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 transition shadow-2xs cursor-pointer"
                >
                  Últimos 7 días
                </button>
                <button
                  type="button"
                  id="btn-preset-fecha-este-mes"
                  onClick={() => handleSetPresetDates('esteMes')}
                  className="px-2 py-1 rounded-md text-[11px] font-semibold bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 transition shadow-2xs cursor-pointer"
                >
                  Este Mes
                </button>
                <button
                  type="button"
                  id="btn-preset-fecha-mes-anterior"
                  onClick={() => handleSetPresetDates('mesAnterior')}
                  className="px-2 py-1 rounded-md text-[11px] font-semibold bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 transition shadow-2xs cursor-pointer"
                >
                  Mes Anterior
                </button>
                {(filterFechaDesde || filterFechaHasta) && (
                  <button
                    type="button"
                    id="btn-preset-fecha-todo"
                    onClick={() => handleSetPresetDates('todo')}
                    className="px-2 py-1 rounded-md text-[11px] font-semibold bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 transition shadow-2xs cursor-pointer"
                  >
                    Limpiar Fechas
                  </button>
                )}
              </div>
            </div>

            {/* Estado del Período */}
            <div className="text-[11px] text-amber-900 font-medium flex items-center justify-between pt-1">
              {filterFechaDesde || filterFechaHasta ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse"></span>
                  Período: <strong>{filterFechaDesde ? formatDateArg(filterFechaDesde) : 'Inicio'}</strong> al <strong>{filterFechaHasta ? formatDateArg(filterFechaHasta) : 'Hoy'}</strong>
                </span>
              ) : (
                <span className="text-gray-500">Histórico completo sin restricción temporal</span>
              )}
              <span className="font-mono font-bold text-amber-950">
                {filteredRecords.length} lotes
              </span>
            </div>
          </div>
        </div>

        {/* SUBFILTROS VINCULANTES (Especie, Variedad, Categoría, Tipo, Tratamiento, Tamaño de Bolsa) */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-black uppercase tracking-wider text-gray-700 font-sans flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-[#00603C]" />
              Subfiltros en Cascada (Vinculantes)
            </span>
            <span className="text-[11px] text-gray-500 italic">
              * Variedad vinculada a cliente/especie; categoría, tipo y tratamiento vinculados a variedad
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
            {/* 1. Especie */}
            <div>
              <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1">
                Especie
              </label>
              <select
                id="subfiltro-especie"
                value={filterEspecie}
                onChange={(e) => setFilterEspecie(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-2 text-xs font-medium text-gray-800 focus:ring-2 focus:ring-[#00603C] focus:outline-none cursor-pointer"
              >
                <option value="">Todas las Especies</option>
                {opcionesEspecies.map((esp) => (
                  <option key={esp} value={esp}>
                    {esp}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Variedad (VINCULANTE A CLIENTE Y ESPECIE) */}
            <div>
              <label className="block text-[10px] font-bold text-[#00603C] uppercase tracking-wider mb-1 flex items-center gap-1">
                <span>Variedad *</span>
                <span className="text-[9px] text-[#C9922E] font-black">(Vinculante)</span>
              </label>
              <select
                id="subfiltro-variedad"
                value={filterVariedad}
                onChange={(e) => setFilterVariedad(e.target.value)}
                className={`w-full border rounded-lg px-2.5 py-2 text-xs font-bold focus:ring-2 focus:ring-[#00603C] focus:outline-none cursor-pointer ${
                  filterVariedad
                    ? 'bg-emerald-50 border-[#00603C] text-[#00603C]'
                    : 'bg-gray-50 border-gray-300 text-gray-800'
                }`}
              >
                <option value="">Todas las Variedades</option>
                {opcionesVariedades.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Categoría (VINCULANTE A VARIEDAD) */}
            <div>
              <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1">
                Categoría *
              </label>
              <select
                id="subfiltro-categoria"
                value={filterCategoria}
                onChange={(e) => setFilterCategoria(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-2 text-xs font-medium text-gray-800 focus:ring-2 focus:ring-[#00603C] focus:outline-none cursor-pointer"
              >
                <option value="">Todas las Categorías</option>
                {opcionesCategorias.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Tipo de Lote (VINCULANTE A VARIEDAD) */}
            <div>
              <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1">
                Tipo Lote *
              </label>
              <select
                id="subfiltro-tipo"
                value={filterTipo}
                onChange={(e) => setFilterTipo(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-2 text-xs font-medium text-gray-800 focus:ring-2 focus:ring-[#00603C] focus:outline-none cursor-pointer"
              >
                <option value="">Todos los Tipos</option>
                {opcionesTipos.map((tip) => (
                  <option key={tip} value={tip}>
                    {tip}
                  </option>
                ))}
              </select>
            </div>

            {/* 5. Tratamiento (VINCULANTE A VARIEDAD) */}
            <div>
              <label className="block text-[10px] font-bold text-purple-700 uppercase tracking-wider mb-1">
                Tratamiento *
              </label>
              <select
                id="subfiltro-tratamiento"
                value={filterTratamiento}
                onChange={(e) => setFilterTratamiento(e.target.value)}
                className={`w-full border rounded-lg px-2.5 py-2 text-xs font-medium focus:ring-2 focus:ring-purple-600 focus:outline-none cursor-pointer ${
                  filterTratamiento
                    ? 'bg-purple-50 border-purple-600 text-purple-900 font-bold'
                    : 'bg-gray-50 border-gray-300 text-gray-800'
                }`}
              >
                <option value="">Todos los Tratamientos</option>
                {opcionesTratamientos.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* 6. Tamaño de Bolsa */}
            <div>
              <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1">
                Tamaño Bolsa
              </label>
              <select
                id="subfiltro-tamano-bolsa"
                value={filterTamanoBolsa}
                onChange={(e) => setFilterTamanoBolsa(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-2 text-xs font-medium text-gray-800 focus:ring-2 focus:ring-[#00603C] focus:outline-none cursor-pointer"
              >
                <option value="">Todos los Tamaños</option>
                {opcionesTamanoBolsa.map((kg) => (
                  <option key={kg} value={String(kg)}>
                    {kg} kg {kg >= 500 ? '(Big Bag)' : '(Bolsa estándar)'}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Barra Inferior de Filtros: Botón para fijar todos los filtros y limpiar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-fijar-todos-filtros"
              onClick={handleTogglePin}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                isFilterPinned
                  ? 'bg-[#C9922E] text-slate-950 font-black shadow-xs ring-2 ring-[#C9922E]/50'
                  : 'bg-emerald-50 text-[#00603C] border border-[#00603C]/30 hover:bg-emerald-100'
              }`}
            >
              {isFilterPinned ? (
                <>
                  <Pin className="w-3.5 h-3.5 text-slate-950 fill-current" />
                  <span>Todos los Filtros Fijados</span>
                </>
              ) : (
                <>
                  <Pin className="w-3.5 h-3.5 text-[#00603C]" />
                  <span>Fijar Todos los Filtros</span>
                </>
              )}
            </button>

            {activeFiltersCount > 0 && (
              <button
                type="button"
                id="btn-limpiar-filtros-panel"
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-gray-600 hover:text-red-700 hover:bg-red-50 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpiar Filtros</span>
              </button>
            )}
          </div>

          <div className="text-xs text-gray-500 font-medium">
            Mostrando <strong className="text-gray-900 font-bold">{filteredRecords.length}</strong> lotes producidos vinculados
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. VISTAS DETALLADAS SEGÚN LA OPCIÓN SELECCIONADA         */}
      {/* (Opción 1: Producción | Opción 2: Stock)                  */}
      {/* ========================================================= */}
      <div className="space-y-5">
        {/* Pestañas de Vista y Buscador en Tabla */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          {/* Segmented Control de Modos */}
          <div className="flex items-center gap-1 bg-gray-100 p-1.5 rounded-xl">
            <button
              type="button"
              id="tab-view-produccion"
              onClick={() => setActiveMode('produccion')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeMode === 'produccion'
                  ? 'bg-[#00603C] text-white shadow-sm font-black'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
              }`}
            >
              <Factory className="w-4 h-4" />
              <span>Opción 1: Producción</span>
              <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded bg-white/20 font-mono">
                {filteredRecords.length}
              </span>
            </button>

            <button
              type="button"
              id="tab-view-stock"
              onClick={() => setActiveMode('stock')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeMode === 'stock'
                  ? 'bg-[#00603C] text-white shadow-sm font-black'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
              }`}
            >
              <Warehouse className="w-4 h-4" />
              <span>Opción 2: Stock</span>
              <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded bg-white/20 font-mono">
                {totalLotesConStock}
              </span>
            </button>
          </div>

          {/* Buscador Rápido y Exportación */}
          <div className="flex items-center gap-2 flex-1 sm:justify-end">
            <div className="relative max-w-xs w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder={`Buscar en ${activeMode === 'produccion' ? 'producción' : 'stock'}...`}
                className="w-full pl-9 pr-8 py-2 text-xs bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C] text-gray-800"
              />
              {tableSearch && (
                <button
                  type="button"
                  onClick={() => setTableSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
              title="Descargar datos actuales en formato Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Exportar Excel</span>
            </button>

            {onNavigateToSilos && (
              <button
                type="button"
                id="btn-quick-nav-silos-bar"
                onClick={onNavigateToSilos}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
                title="Ir al módulo de recepción y balance de silos"
              >
                <Truck className="w-3.5 h-3.5 text-amber-300" />
                <span>Ingreso Silos</span>
              </button>
            )}
          </div>
        </div>

        {/* Gráficos de Producción / Stock */}
        {chartVariedadesData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Gráfico 1: Kilos por Variedad */}
            <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-[#00603C]" />
                  <span className="text-xs font-black uppercase tracking-wider text-gray-800 font-sans">
                    {activeMode === 'produccion'
                      ? 'Volumen Producido por Variedad (Top Variedades)'
                      : 'Stock Físico por Variedad (Top Variedades)'}
                  </span>
                </div>
                <span className="text-[11px] text-gray-500 font-medium">Valores en Kilogramos (kg)</span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartVariedadesData} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis
                      dataKey="variedad"
                      tick={{ fontSize: 11, fill: '#4B5563' }}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#4B5563' }}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(val: any) => [`${formatNumberArg(Number(val), 0)} kg`, 'Kilogramos']}
                      labelFormatter={(label) => `Variedad: ${label}`}
                    />
                    <Bar
                      dataKey={activeMode === 'produccion' ? 'kgProducidos' : 'kgStock'}
                      fill={activeMode === 'produccion' ? '#00603C' : '#10B981'}
                      radius={[6, 6, 0, 0]}
                    >
                      {chartVariedadesData.map((_, idx) => (
                        <Cell key={`cell-${idx}`} fill={COLOR_PALETTE[idx % COLOR_PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Gráfico 2: Desglose Tratamiento vs Sin Tratar */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-purple-700" />
                <span className="text-xs font-black uppercase tracking-wider text-gray-800 font-sans">
                  Distribución de Tratamiento
                </span>
              </div>

              <div className="h-64 w-full flex items-center justify-center">
                {chartTratamientoPie.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={chartTratamientoPie}
                        cx="50%"
                        cy="45%"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {chartTratamientoPie.map((entry, idx) => (
                          <Cell key={`pie-cell-${idx}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val: any) => [`${formatNumberArg(Number(val), 0)} kg`, 'Kg']} />
                      <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px' }} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-xs text-gray-400">Sin datos de tratamiento para los filtros</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 4. TABLA DE REGISTROS SEGÚN MODO SELECCIONADO              */}
        {/* ========================================================= */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Header de la Tabla */}
          <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-gray-800 font-sans">
                {activeMode === 'produccion'
                  ? 'Listado de Lotes Producidos'
                  : 'Inventario de Lotes en Stock Físico'}
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 font-mono font-bold">
                {tableRows.length} registros
              </span>
            </div>

            <span className="text-[11px] text-gray-500 font-medium">
              {activeMode === 'produccion'
                ? 'Haga clic en un lote para inspeccionar o gestionar movimientos'
                : 'Stock físico activo en planta disponible para despacho'}
            </span>
          </div>

          {/* BARRA DE SELECCIÓN DE PILOTES / LOTES PARA STOCK */}
          <div
            id="barra-seleccion-pilotes-stock"
            className="px-5 py-2.5 bg-emerald-50/70 border-b border-emerald-100 flex flex-wrap items-center justify-between gap-3 text-xs"
          >
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-1.5 font-bold text-emerald-950">
                <ListChecks className="w-4 h-4 text-emerald-700" />
                <span>Selección de Pilotes / Lotes para Stock:</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-200/90 text-emerald-900 font-mono font-bold text-[11px]">
                {selectedRecords.length} de {filteredRecords.length} lotes seleccionados
              </span>
              <span className="text-[11px] text-emerald-800 font-medium hidden md:inline">
                ({totalTnStock.toFixed(2)} Tn / {formatNumberArg(totalBolsasStock, 0)} bolsas en stock seleccionado)
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                id="btn-seleccionar-todos-lotes"
                onClick={handleSelectAll}
                disabled={isAllSelected}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-xs ${
                  isAllSelected
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer'
                }`}
                title="Seleccionar todos los lotes del filtro actual para cálculo de stock"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Seleccionar Todos</span>
              </button>

              <button
                type="button"
                id="btn-quitar-todos-lotes"
                onClick={handleDeselectAll}
                disabled={selectedLoteIds.size === 0}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition border shadow-xs ${
                  selectedLoteIds.size === 0
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                    : 'bg-white hover:bg-rose-50 text-rose-700 border-rose-300 cursor-pointer'
                }`}
                title="Quitar todos los lotes seleccionados"
              >
                <X className="w-3.5 h-3.5" />
                <span>Quitar Todos</span>
              </button>

              <button
                type="button"
                id="btn-toggle-ver-solo-seleccionados"
                onClick={() => setShowOnlySelected(!showOnlySelected)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition border cursor-pointer ${
                  showOnlySelected
                    ? 'bg-[#00603C] text-white border-[#00603C] shadow-xs'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border-gray-300'
                }`}
                title={showOnlySelected ? 'Mostrar todos los lotes del filtro' : 'Filtrar la tabla para mostrar únicamente los lotes seleccionados'}
              >
                <span>{showOnlySelected ? 'Mostrando solo seleccionados' : 'Filtrar solo seleccionados'}</span>
              </button>
            </div>
          </div>

          {/* Contenido de la Tabla */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-100/80 text-gray-600 font-bold border-b border-gray-200">
                  <th className="py-3 px-3 w-10 text-center">
                    <div className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        id="th-checkbox-select-all"
                        checked={isAllSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = isIndeterminate;
                        }}
                        onChange={handleToggleSelectAll}
                        className="w-4 h-4 text-emerald-600 bg-white border-gray-300 rounded focus:ring-emerald-500 focus:ring-2 cursor-pointer accent-emerald-600"
                        title={isAllSelected ? 'Deseleccionar todos los lotes' : 'Seleccionar todos los lotes filtrados'}
                      />
                    </div>
                  </th>
                  <th className="py-3 px-4">N° Lote</th>
                  <th className="py-3 px-3">Fecha Prod.</th>
                  <th className="py-3 px-3">Cliente</th>
                  <th className="py-3 px-3">Especie</th>
                  <th className="py-3 px-3">Variedad</th>
                  <th className="py-3 px-3">Categoría</th>
                  <th className="py-3 px-3">Tipo</th>
                  <th className="py-3 px-3">Tratamiento</th>
                  <th className="py-3 px-3 text-center">Envase</th>
                  {activeMode === 'produccion' ? (
                    <>
                      <th className="py-3 px-3 text-right">Bolsas Prod.</th>
                      <th className="py-3 px-4 text-right">Kg Producidos</th>
                      <th className="py-3 px-3 text-right">Tn Prod.</th>
                      <th className="py-3 px-3 text-right">A Consumo (kg)</th>
                      <th className="py-3 px-3 text-center">Estado Reg.</th>
                    </>
                  ) : (
                    <>
                      <th className="py-3 px-3 text-right">Bolsas Stock</th>
                      <th className="py-3 px-4 text-right">Kg Stock</th>
                      <th className="py-3 px-3 text-right">Tn Stock</th>
                      <th className="py-3 px-3">Ubicación</th>
                      <th className="py-3 px-3 text-center">Disponibilidad</th>
                    </>
                  )}
                  <th className="py-3 px-3 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-sans">
                {tableRows.length === 0 ? (
                  <tr>
                    <td colSpan={16} className="py-12 text-center text-gray-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Info className="w-8 h-8 text-gray-300" />
                        <p className="text-sm font-medium text-gray-600">
                          No se encontraron lotes que coincidan con los filtros seleccionados
                        </p>
                        <button
                          type="button"
                          onClick={handleClearFilters}
                          className="mt-2 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition"
                        >
                          Restablecer Filtros
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  tableRows.map((r) => (
                    <tr
                      key={r.id}
                      className={`transition group cursor-pointer ${
                        selectedLoteIds.has(r.id)
                          ? 'bg-emerald-50/30 hover:bg-emerald-50/70'
                          : 'opacity-75 bg-gray-50/30 hover:bg-gray-100/60'
                      }`}
                      onClick={() => onSelectLote?.(r.loteOriginal)}
                    >
                      {/* Checkbox Selección */}
                      <td
                        className="py-2.5 px-3 w-10 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center">
                          <input
                            type="checkbox"
                            id={`td-checkbox-lote-${r.id}`}
                            checked={selectedLoteIds.has(r.id)}
                            onChange={() => handleToggleLote(r.id)}
                            className="w-4 h-4 text-emerald-600 bg-white border-gray-300 rounded focus:ring-emerald-500 focus:ring-2 cursor-pointer accent-emerald-600"
                            title={
                              selectedLoteIds.has(r.id)
                                ? 'Quitar lote del cálculo de stock'
                                : 'Seleccionar lote para cálculo de stock'
                            }
                          />
                        </div>
                      </td>

                      {/* N° Lote */}
                      <td className="py-2.5 px-4 font-mono font-bold text-[#00603C]">
                        <div className="flex items-center gap-1.5">
                          <span>{r.loteNro}</span>
                          {selectedLoteIds.has(r.id) && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Seleccionado en stock" />
                          )}
                        </div>
                      </td>

                      {/* Fecha Producción */}
                      <td className="py-2.5 px-3 font-mono text-gray-700 whitespace-nowrap">
                        {formatDateArg(r.fechaProduccion)}
                      </td>

                      {/* Cliente */}
                      <td className="py-2.5 px-3 font-semibold text-gray-800">
                        {r.cliente}
                      </td>

                      {/* Especie */}
                      <td className="py-2.5 px-3 text-gray-700">
                        {r.especie}
                      </td>

                      {/* Variedad */}
                      <td className="py-2.5 px-3 font-bold text-gray-900">
                        {r.variedad}
                      </td>

                      {/* Categoría */}
                      <td className="py-2.5 px-3 text-gray-600">
                        {r.categoria}
                      </td>

                      {/* Tipo */}
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-medium text-[11px]">
                          {r.tipo}
                        </span>
                      </td>

                      {/* Tratamiento */}
                      <td className="py-2.5 px-3">
                        {r.isTratado ? (
                          <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200 font-semibold text-[11px]">
                            {r.tratamientoStr}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-[11px]">
                            Sin Tratar
                          </span>
                        )}
                      </td>

                      {/* Envase */}
                      <td className="py-2.5 px-3 text-center font-mono font-semibold text-gray-700">
                        {r.kgPorBolsa} kg
                      </td>

                      {/* Columnas Variables según Modo */}
                      {activeMode === 'produccion' ? (
                        <>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-800">
                            {formatNumberArg(r.bolsasProducidas, 0)} b.
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-[#00603C]">
                            {formatNumberArg(r.kgProducidos, 0)} kg
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-gray-600">
                            {(r.kgProducidos / 1000).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">
                            {r.kgPasadosConsumo > 0 ? (
                              <span
                                className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold text-[11px] border border-purple-200 inline-flex items-center gap-1 justify-end"
                                title={`${formatNumberArg(r.kgPasadosConsumo, 0)} kg (${r.bolsasPasadasConsumo} b.) derivados a consumo`}
                              >
                                <span>{formatNumberArg(r.kgPasadosConsumo, 0)} kg</span>
                              </span>
                            ) : (
                              <span className="text-gray-400 font-normal">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                r.estadoRegistro === 'REALIZADO'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {r.estadoRegistro}
                            </span>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                            {formatNumberArg(r.bolsasStock, 0)} b.
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-800">
                            {formatNumberArg(r.kgStock, 0)} kg
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-gray-600">
                            {(r.kgStock / 1000).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-gray-700">
                            {r.ubicacion}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                r.estadoLote === 'Disponible'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : r.estadoLote === 'Reservado'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {r.estadoLote}
                            </span>
                          </td>
                        </>
                      )}

                      {/* Acción */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectLote?.(r.loteOriginal);
                          }}
                          className="text-[#00603C] hover:text-emerald-700 p-1 rounded hover:bg-emerald-100/60 transition"
                          title="Ver detalle del lote"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
