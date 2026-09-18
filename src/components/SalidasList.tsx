/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  SalidaRegistrada,
  Lote,
  Chofer,
  OrdenCarga,
  PlantaConfig,
  getVariedadesVisibles,
  getVariedadesPorEspecie,
  VARIEDADES_DB_DEFAULT,
} from '../types';
import { formatNumberArg, formatDateStr } from '../utils/formatters';
import { LogoSiloLoose } from './Logo';
import {
  Search,
  Calendar,
  User,
  FileText,
  ArrowLeft,
  Paperclip,
  Download,
  Loader2,
  Pin,
  PinOff,
  RotateCcw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Wheat,
  Tag,
  Package,
  Layers,
  FlaskConical,
  Truck,
  Filter,
  X,
  ArrowRight,
  ArrowDownRight,
  Camera,
  Eye,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { exportWithHtml2Pdf } from '../utils/exportPdf';
import { ConfirmationDialog } from './ConfirmationDialog';

export interface SalidasListProps {
  salidas: SalidaRegistrada[];
  lotes: Lote[];
  choferes?: Chofer[];
  ordenes?: OrdenCarga[];
  plantaConfig?: PlantaConfig;
  onDeleteDespacho?: (row: SalidaUnifiedRow) => Promise<boolean | void> | boolean | void;
  onDeleteMultipleDespachos?: (rows: SalidaUnifiedRow[]) => Promise<boolean | void> | boolean | void;
}

export type SortFieldSalidas =
  | 'remitoCliente'
  | 'id'
  | 'tipoOperacion'
  | 'fecha'
  | 'cliente'
  | 'especie'
  | 'variedad'
  | 'loteId'
  | 'tipo'
  | 'categoria'
  | 'tratamiento'
  | 'tamanoBolsa'
  | 'chofer'
  | 'bolsas'
  | 'totalKg';

export type SortDirection = 'asc' | 'desc';

export interface SalidaUnifiedRow {
  id: string;
  remitoCliente: string;
  fecha: string;
  cliente: string;
  especie: string;
  variedad: string;
  loteId: string;
  alaStr: string;
  sectorStr: string;
  tipo: string;
  categoria: string;
  tratamiento: string;
  tamanoBolsa: string;
  kgPorBolsa: number;
  choferNombre: string;
  choferDni: string;
  patenteCamion: string;
  cantidadBolsas: number;
  totalKg: number;
  taraVal: number;
  brutoVal: number;
  tipoOperacion: 'Despacho' | 'Salida por movimiento' | 'Salida manual' | string;
  adjunto?: { nombre: string; data: string; type: string };
  rawSalida?: SalidaRegistrada;
  rawOrden?: OrdenCarga;
  rawMovimiento?: any;
}

const STORAGE_PINNED_FILTERS_KEY = 'agro_salidas_pinned_filters';

export const SalidasList: React.FC<SalidasListProps> = ({
  salidas,
  lotes,
  choferes = [],
  ordenes = [],
  plantaConfig,
  onDeleteDespacho,
  onDeleteMultipleDespachos,
}) => {
  // Estados para Filtros
  const [filterRemitoCliente, setFilterRemitoCliente] = useState<string>('');
  const [filterCliente, setFilterCliente] = useState<string>('');
  const [filterEspecie, setFilterEspecie] = useState<string>('');
  const [filterVariedad, setFilterVariedad] = useState<string>('');
  const [filterFechaDesde, setFilterFechaDesde] = useState<string>('');
  const [filterFechaHasta, setFilterFechaHasta] = useState<string>('');
  const [filterTipo, setFilterTipo] = useState<string>('');
  const [filterCategoria, setFilterCategoria] = useState<string>('');
  const [filterTratamiento, setFilterTratamiento] = useState<string>('');
  const [filterTamanoBolsa, setFilterTamanoBolsa] = useState<string>('');
  const [filterOperacion, setFilterOperacion] = useState<string>('');

  // Estado para Fijar Filtros
  const [isFilterPinned, setIsFilterPinned] = useState<boolean>(false);

  // Estados de Ordenamiento
  const [sortField, setSortField] = useState<SortFieldSalidas>('fecha');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Estado para visualizar un remito histórico seleccionado
  const [remitoSeleccionado, setRemitoSeleccionado] = useState<SalidaRegistrada | null>(null);
  const [isExportingRemitoPdf, setIsExportingRemitoPdf] = useState(false);
  const [previewFoto, setPreviewFoto] = useState<{
    url: string;
    titulo: string;
    cliente?: string;
    fecha?: string;
    remito?: string;
  } | null>(null);

  // Estados para Selección y Eliminación de Despacho
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [despachosAEliminar, setDespachosAEliminar] = useState<SalidaUnifiedRow[] | null>(null);
  const [isDeletingDespacho, setIsDeletingDespacho] = useState(false);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  const toggleSelectRow = (id: string) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedRowIds(new Set());
  };

  const handleConfirmarEliminarDespachos = async () => {
    if (!despachosAEliminar || despachosAEliminar.length === 0) return;
    try {
      setIsDeletingDespacho(true);
      const targetIds = new Set<string>();
      for (const d of despachosAEliminar) {
        targetIds.add(d.id);
        if (d.rawOrden?.id) targetIds.add(d.rawOrden.id);
        if (d.rawSalida?.id) targetIds.add(d.rawSalida.id);
      }

      setDeletedIds((prev) => {
        const next = new Set(prev);
        targetIds.forEach((id) => next.add(id));
        return next;
      });

      if (onDeleteMultipleDespachos) {
        await onDeleteMultipleDespachos(despachosAEliminar);
      } else if (onDeleteDespacho) {
        for (const d of despachosAEliminar) {
          await onDeleteDespacho(d);
        }
      }

      // Quitar los eliminados de la selección
      setSelectedRowIds((prev) => {
        const next = new Set(prev);
        targetIds.forEach((id) => next.delete(id));
        return next;
      });

      setDespachosAEliminar(null);
      setRemitoSeleccionado(null);
    } catch (err) {
      console.error('Error al confirmar eliminación de despachos:', err);
    } finally {
      setIsDeletingDespacho(false);
    }
  };

  // 1. Cargar filtros fijados desde localStorage al montar
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PINNED_FILTERS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.isFilterPinned) {
          setIsFilterPinned(true);
          if (parsed.filterRemitoCliente !== undefined) setFilterRemitoCliente(parsed.filterRemitoCliente);
          if (parsed.filterCliente !== undefined) setFilterCliente(parsed.filterCliente);
          if (parsed.filterEspecie !== undefined) setFilterEspecie(parsed.filterEspecie);
          if (parsed.filterVariedad !== undefined) setFilterVariedad(parsed.filterVariedad);
          if (parsed.filterFechaDesde !== undefined) setFilterFechaDesde(parsed.filterFechaDesde);
          if (parsed.filterFechaHasta !== undefined) setFilterFechaHasta(parsed.filterFechaHasta);
          if (parsed.filterTipo !== undefined) setFilterTipo(parsed.filterTipo);
          if (parsed.filterCategoria !== undefined) setFilterCategoria(parsed.filterCategoria);
          if (parsed.filterTratamiento !== undefined) setFilterTratamiento(parsed.filterTratamiento);
          if (parsed.filterTamanoBolsa !== undefined) setFilterTamanoBolsa(parsed.filterTamanoBolsa);
          if (parsed.filterOperacion !== undefined) setFilterOperacion(parsed.filterOperacion);
          if (parsed.sortField !== undefined) setSortField(parsed.sortField);
          if (parsed.sortDirection !== undefined) setSortDirection(parsed.sortDirection);
        }
      }
    } catch (err) {
      console.error('Error al recuperar filtros fijados de salidas:', err);
    }
  }, []);

  // 2. Guardar o limpiar filtros fijados en localStorage cuando cambian
  useEffect(() => {
    if (isFilterPinned) {
      try {
        localStorage.setItem(
          STORAGE_PINNED_FILTERS_KEY,
          JSON.stringify({
            isFilterPinned: true,
            filterRemitoCliente,
            filterCliente,
            filterEspecie,
            filterVariedad,
            filterFechaDesde,
            filterFechaHasta,
            filterTipo,
            filterCategoria,
            filterTratamiento,
            filterTamanoBolsa,
            filterOperacion,
            sortField,
            sortDirection,
          })
        );
      } catch (err) {
        console.error('Error al guardar filtros fijados en localStorage:', err);
      }
    } else {
      localStorage.removeItem(STORAGE_PINNED_FILTERS_KEY);
    }
  }, [
    isFilterPinned,
    filterRemitoCliente,
    filterCliente,
    filterEspecie,
    filterVariedad,
    filterFechaDesde,
    filterFechaHasta,
    filterTipo,
    filterCategoria,
    filterTratamiento,
    filterTamanoBolsa,
    filterOperacion,
    sortField,
    sortDirection,
  ]);

  // Restablecer / Limpiar Filtros
  const handleClearFilters = () => {
    setFilterRemitoCliente('');
    setFilterCliente('');
    setFilterEspecie('');
    setFilterVariedad('');
    setFilterFechaDesde('');
    setFilterFechaHasta('');
    setFilterTipo('');
    setFilterCategoria('');
    setFilterTratamiento('');
    setFilterTamanoBolsa('');
    setFilterOperacion('');
    setIsFilterPinned(false);
    localStorage.removeItem(STORAGE_PINNED_FILTERS_KEY);
  };

  // Alternar fijación de filtros
  const togglePinFilters = () => {
    setIsFilterPinned((prev) => !prev);
  };

  // 3. Obtener listas dinámicas para filtros
  const clientesOptions = useMemo(() => {
    const set = new Set<string>();
    salidas.forEach((s) => s.cliente && set.add(s.cliente.trim()));
    ordenes.forEach((o) => o.cliente && set.add(o.cliente.trim()));
    lotes.forEach((l) => l.cliente && set.add(l.cliente.trim()));
    if (plantaConfig?.clientes) {
      plantaConfig.clientes.forEach((c) => c && set.add(c.trim()));
    }
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [salidas, ordenes, lotes, plantaConfig]);

  const especiesOptions = useMemo(() => {
    const set = new Set<string>();
    lotes.forEach((l) => l.especie && set.add(l.especie.trim()));
    VARIEDADES_DB_DEFAULT.forEach((v) => v.especie && set.add(v.especie.trim()));
    if (plantaConfig?.especies) {
      plantaConfig.especies.forEach((e) => e && set.add(e.trim()));
    }
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [lotes, plantaConfig]);

  // Variedades disponibles para cliente y especie de forma reactiva
  const variedadesOptions = useMemo(() => {
    const dbList = plantaConfig?.variedadesDb || VARIEDADES_DB_DEFAULT;

    // Caso 1: Cliente y Especie seleccionados
    if (filterCliente && filterEspecie) {
      const dbVisibles = getVariedadesVisibles(dbList, filterEspecie, filterCliente);
      const set = new Set<string>(dbVisibles.map((v) => (v.nombre || '').trim()));
      // Añadir además variedades de lotes reales existentes para ese cliente y especie
      lotes
        .filter(
          (l) =>
            l.especie?.toLowerCase().trim() === filterEspecie.toLowerCase().trim() &&
            l.cliente?.toLowerCase().trim() === filterCliente.toLowerCase().trim()
        )
        .forEach((l) => l.variedad && set.add(l.variedad.trim()));
      return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b));
    }

    // Caso 2: Solo Especie seleccionada
    if (filterEspecie) {
      const dbVisibles = getVariedadesPorEspecie(dbList, filterEspecie);
      const set = new Set<string>(dbVisibles.map((v) => (v.nombre || '').trim()));
      lotes
        .filter((l) => l.especie?.toLowerCase().trim() === filterEspecie.toLowerCase().trim())
        .forEach((l) => l.variedad && set.add(l.variedad.trim()));
      return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b));
    }

    // Caso 3: Solo Cliente seleccionado
    if (filterCliente) {
      const cliNorm = filterCliente.toLowerCase().trim();
      const set = new Set<string>();
      dbList
        .filter((v) => {
          const vCli = (v.cliente || '').toLowerCase().trim();
          return vCli === cliNorm || (cliNorm.startsWith('san diego') && vCli.startsWith('san diego'));
        })
        .forEach((v) => v.nombre && set.add(v.nombre.trim()));
      lotes
        .filter((l) => l.cliente?.toLowerCase().trim() === cliNorm)
        .forEach((l) => l.variedad && set.add(l.variedad.trim()));
      return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b));
    }

    // Caso 4: Ninguno seleccionado (todas las variedades del sistema)
    const set = new Set<string>();
    dbList.forEach((v) => v.nombre && set.add(v.nombre.trim()));
    lotes.forEach((l) => l.variedad && set.add(l.variedad.trim()));
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [filterCliente, filterEspecie, plantaConfig, lotes]);

  // Si la variedad seleccionada ya no es válida para el nuevo cliente/especie, limpiarla
  useEffect(() => {
    if (filterVariedad && variedadesOptions.length > 0 && !variedadesOptions.includes(filterVariedad)) {
      setFilterVariedad('');
    }
  }, [variedadesOptions, filterVariedad]);

  const tiposOptions = useMemo(() => {
    const set = new Set<string>(['Intermedio', 'Final']);
    salidas.forEach((s) => s.tipoLote && set.add(s.tipoLote.trim()));
    lotes.forEach((l) => l.tipo && set.add(l.tipo.trim()));
    return Array.from(set).filter(Boolean).sort();
  }, [salidas, lotes]);

  const categoriasOptions = useMemo(() => {
    const set = new Set<string>(['Original', 'Preba', 'Primu', 'Fundadora']);
    salidas.forEach((s) => s.categoria && set.add(s.categoria.trim()));
    lotes.forEach((l) => l.categoria && set.add(l.categoria.trim()));
    return Array.from(set).filter(Boolean).sort();
  }, [salidas, lotes]);

  const tratamientosOptions = useMemo(() => {
    const set = new Set<string>(['Tratado', 'Sin Tratar']);
    lotes.forEach((l) => {
      if (Array.isArray(l.tratamiento)) {
        l.tratamiento.forEach((t) => t && set.add(t.trim()));
      }
    });
    return Array.from(set).filter(Boolean).sort();
  }, [lotes]);

  const tamanoBolsaOptions = useMemo(() => {
    const set = new Set<string>();
    salidas.forEach((s) => {
      if (s.kgPorBolsa) set.add(`${s.kgPorBolsa} kg`);
      if (s.envase) set.add(s.envase.trim());
    });
    lotes.forEach((l) => {
      if (l.kgPorBolsa) set.add(`${l.kgPorBolsa} kg`);
    });
    return Array.from(set).filter(Boolean).sort();
  }, [salidas, lotes]);

  // 4. Mapear y consolidar filas de datos unificadas
  const unifiedRows = useMemo(() => {
    const rows: SalidaUnifiedRow[] = [];
    const registeredIds = new Set<string>();

    // A) Mapear salidas registradas directas
    salidas.forEach((s) => {
      registeredIds.add(s.id);
      const matchingLote = lotes.find((l) => l.id === s.loteId);
      const matchingOrden = ordenes.find((o) => o.id === s.id || o.loteId === s.loteId);
      const matchingMov = matchingLote?.historial?.find(
        (m) => m.ordenId === s.id || m.id === s.id || (m.remitoCliente && m.tipo.toLowerCase().includes('salida'))
      );

      // Obtener N° de remito de cliente con máxima exhaustividad
      const remitoClienteVal =
        (s.remitoCliente && s.remitoCliente.trim() !== '-' ? s.remitoCliente.trim() : '') ||
        (matchingOrden?.remitoCliente && matchingOrden.remitoCliente.trim() !== '-' ? matchingOrden.remitoCliente.trim() : '') ||
        (matchingMov?.remitoCliente && matchingMov.remitoCliente.trim() !== '-' ? matchingMov.remitoCliente.trim() : '') ||
        (s.remitoClienteAdjunto?.nombre ? s.remitoClienteAdjunto.nombre : '');

      const choferObj = choferes.find(
        (c) =>
          (c.nombre && s.choferNombre && c.nombre.trim().toLowerCase() === s.choferNombre.trim().toLowerCase()) ||
          (c.cuit && s.choferDni && c.cuit.trim() === s.choferDni.trim())
      );

      const taraVal = s.taraCamion !== undefined ? s.taraCamion : choferObj?.tara !== undefined ? choferObj.tara : 0;
      const totalKgVal = s.totalKg || (s.cantidadBolsas || 0) * (s.kgPorBolsa || matchingLote?.kgPorBolsa || 40);
      const brutoVal = s.brutoCamion !== undefined ? s.brutoCamion : taraVal + totalKgVal;

      const tratamientoVal =
        matchingLote?.tratamiento && Array.isArray(matchingLote.tratamiento) && matchingLote.tratamiento.length > 0
          ? matchingLote.tratamiento.join(', ')
          : s.producto || '—';

      const tamanoBolsaVal = s.kgPorBolsa
        ? `${s.kgPorBolsa} kg`
        : s.envase
        ? s.envase
        : matchingLote?.kgPorBolsa
        ? `${matchingLote.kgPorBolsa} kg`
        : '—';

      let tipoOp = 'Salida manual';
      if (matchingOrden || s.id.startsWith('ORD-') || (matchingMov && matchingMov.tipo.toLowerCase().includes('despacho'))) {
        tipoOp = 'Despacho';
      } else if (matchingMov && matchingMov.tipo.toLowerCase().includes('movimiento')) {
        tipoOp = 'Salida por movimiento';
      }

      rows.push({
        id: s.id,
        remitoCliente: remitoClienteVal,
        fecha: s.fecha || '',
        cliente: s.cliente || matchingLote?.cliente || '—',
        especie: matchingLote?.especie || '—',
        variedad: matchingLote?.variedad || '—',
        loteId: s.loteId || matchingLote?.loteNro || '—',
        alaStr: matchingLote?.ala ? `ALA ${matchingLote.ala}` : '—',
        sectorStr: matchingLote?.sector ? `SEC ${matchingLote.sector}` : '—',
        tipo: s.tipoLote || matchingLote?.tipo || '—',
        categoria: s.categoria || matchingLote?.categoria || '—',
        tratamiento: tratamientoVal,
        tamanoBolsa: tamanoBolsaVal,
        kgPorBolsa: s.kgPorBolsa || matchingLote?.kgPorBolsa || 40,
        choferNombre: s.choferNombre || '—',
        choferDni: s.choferDni || '—',
        patenteCamion: s.patenteCamion || choferObj?.patentes || '—',
        cantidadBolsas: s.cantidadBolsas || 0,
        totalKg: totalKgVal,
        taraVal,
        brutoVal,
        tipoOperacion: tipoOp,
        adjunto: s.remitoClienteAdjunto,
        rawSalida: s,
      });
    });

    // B) Incorporar órdenes de carga despachadas (exclusivamente con stock descontado vía botón 'Despachado') que aún no tengan documento en salidas
    ordenes
      .filter((o) => o.stockDescontado === true)
      .forEach((o) => {
        if (registeredIds.has(o.id) || salidas.some(s => s.ordenId === o.id || s.id.startsWith(`SAL-${o.id}`))) return; // Evitar duplicar si ya fue registrada con mismo ID o en salidas

        const matchingLote = lotes.find((l) => l.id === o.loteId);
        const remitoClienteVal =
          (o.remitoCliente && o.remitoCliente.trim() !== '-' ? o.remitoCliente.trim() : '') ||
          (o.fotoRemito ? 'Remito Digital' : '');

        const choferObj = choferes.find(
          (c) => c.nombre && o.chofer && c.nombre.trim().toLowerCase() === o.chofer.trim().toLowerCase()
        );

        const kgBolsa = matchingLote?.kgPorBolsa || 40;
        const totalKgVal = o.kgTotales || o.cantidadBolsas * kgBolsa;
        const taraVal = choferObj?.tara || 0;
        const brutoVal = taraVal + totalKgVal;

        const tratamientoVal =
          o.tratamiento ||
          (matchingLote?.tratamiento && Array.isArray(matchingLote.tratamiento) && matchingLote.tratamiento.length > 0
            ? matchingLote.tratamiento.join(', ')
            : '—');

        rows.push({
          id: o.id,
          remitoCliente: remitoClienteVal,
          fecha: o.fecha || '',
          cliente: o.cliente || matchingLote?.cliente || '—',
          especie: matchingLote?.especie || '—',
          variedad: matchingLote?.variedad || '—',
          loteId: o.loteId || matchingLote?.loteNro || '—',
          alaStr: matchingLote?.ala ? `ALA ${matchingLote.ala}` : '—',
          sectorStr: matchingLote?.sector ? `SEC ${matchingLote.sector}` : '—',
          tipo: o.tipo || matchingLote?.tipo || '—',
          categoria: o.categoria || matchingLote?.categoria || '—',
          tratamiento: tratamientoVal,
          tamanoBolsa: `${kgBolsa} kg`,
          kgPorBolsa: kgBolsa,
          choferNombre: o.chofer || o.despachante || '—',
          choferDni: choferObj?.cuit || '—',
          patenteCamion: choferObj?.patentes || '—',
          cantidadBolsas: o.cantidadBolsas || 0,
          totalKg: totalKgVal,
          taraVal,
          brutoVal,
          tipoOperacion: 'Despacho',
          adjunto: o.fotoRemito ? { nombre: `Foto-Remito-${o.remitoCliente || o.id}.jpg`, data: o.fotoRemito, type: 'image/jpeg' } : undefined,
          rawOrden: o,
        });
      });

    // C) Incorporar todos los egresos de bolsas registrados en el historial de lotes (despachos, movimientos realizados, salidas manuales)
    lotes.forEach((l) => {
      if (!l.historial || !Array.isArray(l.historial)) return;

      l.historial.forEach((m) => {
        const isEgreso =
          m.tipo === 'Salida manual' ||
          m.tipo === 'Salida por movimiento' ||
          m.tipo === 'Salida por movimientos' ||
          m.tipo === 'Salida por despacho' ||
          m.tipo === 'Despacho' ||
          m.tipo === 'Salida' ||
          m.tipoSalida === 'manual' ||
          m.tipoSalida === 'movimiento' ||
          m.tipoSalida === 'despacho' ||
          (m.tipo && m.tipo.toLowerCase().includes('salida')) ||
          (m.tipo && m.tipo.toLowerCase().includes('despacho')) ||
          (m.cantidadBolsas !== undefined && m.cantidadBolsas < 0);

        if (!isEgreso) return;

        // Si ya fue incluido por id o por ordenId, saltar
        if (registeredIds.has(m.id)) return;
        if (m.ordenId && registeredIds.has(m.ordenId)) return;

        const mRemito = m.remitoCliente?.trim();
        // Evitar duplicados si coincide lote y remito no vacío
        if (
          mRemito &&
          mRemito !== '-' &&
          rows.some((r) => (r.loteId === l.loteNro || r.loteId === l.id) && r.remitoCliente === mRemito)
        ) {
          return;
        }

        registeredIds.add(m.id);

        let tipoOp = 'Salida manual';
        if (
          m.tipo === 'Despacho' ||
          m.tipo === 'Salida por despacho' ||
          m.tipoSalida === 'despacho' ||
          m.ordenId?.startsWith('ORD-')
        ) {
          tipoOp = 'Despacho';
        } else if (
          m.tipo === 'Salida por movimiento' ||
          m.tipo === 'Salida por movimientos' ||
          m.tipoSalida === 'movimiento'
        ) {
          tipoOp = 'Salida por movimiento';
        }

        const kgBolsa = m.kgPorBolsa || l.kgPorBolsa || 40;
        const cantBolsas = Math.abs(m.cantidadBolsas);
        const totalKgVal = Math.abs(m.cantidadKg) || cantBolsas * kgBolsa;

        const choferObj = choferes.find(
          (c) => c.nombre && m.chofer && c.nombre.trim().toLowerCase() === m.chofer.trim().toLowerCase()
        );

        const tratamientoVal =
          l.tratamiento && Array.isArray(l.tratamiento) && l.tratamiento.length > 0
            ? l.tratamiento.join(', ')
            : l.producto || '—';

        rows.push({
          id: m.id,
          remitoCliente: mRemito && mRemito !== '-' ? mRemito : '',
          fecha: m.fecha || l.fechaIngreso || '',
          cliente: l.cliente || '—',
          especie: l.especie || '—',
          variedad: l.variedad || '—',
          loteId: l.loteNro || l.id,
          alaStr: l.ala ? `ALA ${l.ala}` : '—',
          sectorStr: l.sector ? `SEC ${l.sector}` : '—',
          tipo: l.tipo || '—',
          categoria: l.categoria || '—',
          tratamiento: tratamientoVal,
          tamanoBolsa: `${kgBolsa} kg`,
          kgPorBolsa: kgBolsa,
          choferNombre: m.chofer || choferObj?.nombre || '—',
          choferDni: choferObj?.cuit || '—',
          patenteCamion: choferObj?.patentes || '—',
          cantidadBolsas: cantBolsas,
          totalKg: totalKgVal,
          taraVal: choferObj?.tara || 0,
          brutoVal: (choferObj?.tara || 0) + totalKgVal,
          tipoOperacion: tipoOp,
          rawMovimiento: m,
        });
      });
    });

    return rows;
  }, [salidas, ordenes, lotes, choferes]);

  // 5. Filtrar las filas según los criterios seleccionados
  const filteredRows = useMemo(() => {
    const searchRemitoClean = filterRemitoCliente.trim().toLowerCase();
    const searchRemitoAlphanum = searchRemitoClean.replace(/[^a-z0-9]/g, '');

    return unifiedRows.filter((r) => {
      // Filtro Buscador por N° Remito de Cliente
      let matchRemitoCliente = true;
      if (searchRemitoClean) {
        const remitoVal = (r.remitoCliente || '').toLowerCase();
        const adjuntoVal = (r.adjunto?.nombre || '').toLowerCase();
        const remitoAlphanum = remitoVal.replace(/[^a-z0-9]/g, '');

        matchRemitoCliente =
          remitoVal.includes(searchRemitoClean) ||
          adjuntoVal.includes(searchRemitoClean) ||
          (searchRemitoAlphanum.length > 0 && remitoAlphanum.includes(searchRemitoAlphanum));
      }

      // Filtro Cliente
      const matchCliente = !filterCliente || r.cliente.toLowerCase().includes(filterCliente.toLowerCase().trim());

      // Filtro Especie
      const matchEspecie = !filterEspecie || r.especie.toLowerCase() === filterEspecie.toLowerCase().trim();

      // Filtro Variedad
      const matchVariedad =
        !filterVariedad || r.variedad.toLowerCase().includes(filterVariedad.toLowerCase().trim());

      // Filtro Fecha Desde
      const matchFechaDesde = !filterFechaDesde || (r.fecha && r.fecha >= filterFechaDesde);

      // Filtro Fecha Hasta
      const matchFechaHasta = !filterFechaHasta || (r.fecha && r.fecha <= filterFechaHasta);

      // Filtro Tipo
      const matchTipo = !filterTipo || r.tipo.toLowerCase().includes(filterTipo.toLowerCase().trim());

      // Filtro Categoría
      const matchCategoria =
        !filterCategoria || r.categoria.toLowerCase().includes(filterCategoria.toLowerCase().trim());

      // Filtro Tratamiento
      const matchTratamiento =
        !filterTratamiento || r.tratamiento.toLowerCase().includes(filterTratamiento.toLowerCase().trim());

      // Filtro Tamaño de Bolsa
      const matchTamanoBolsa =
        !filterTamanoBolsa || r.tamanoBolsa.toLowerCase().includes(filterTamanoBolsa.toLowerCase().trim());

      // Filtro Operación (Despacho / Salida por movimiento / Salida manual)
      const matchOperacion = !filterOperacion || r.tipoOperacion === filterOperacion;

      // Excluir registros eliminados localmente
      if (
        deletedIds.has(r.id) ||
        (r.rawOrden && deletedIds.has(r.rawOrden.id)) ||
        (r.rawSalida && deletedIds.has(r.rawSalida.id))
      ) {
        return false;
      }

      return (
        matchRemitoCliente &&
        matchCliente &&
        matchEspecie &&
        matchVariedad &&
        matchFechaDesde &&
        matchFechaHasta &&
        matchTipo &&
        matchCategoria &&
        matchTratamiento &&
        matchTamanoBolsa &&
        matchOperacion
      );
    });
  }, [
    unifiedRows,
    deletedIds,
    filterRemitoCliente,
    filterCliente,
    filterEspecie,
    filterVariedad,
    filterFechaDesde,
    filterFechaHasta,
    filterTipo,
    filterCategoria,
    filterTratamiento,
    filterTamanoBolsa,
    filterOperacion,
  ]);

  // 6. Ordenamiento interactivo ascendente o descendente por filtro/columna
  const sortedRows = useMemo(() => {
    const list = [...filteredRows];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'remitoCliente':
          cmp = (a.remitoCliente || '').localeCompare(b.remitoCliente || '', undefined, { numeric: true });
          break;
        case 'id':
          cmp = (a.id || '').localeCompare(b.id || '', undefined, { numeric: true });
          break;
        case 'tipoOperacion':
          cmp = (a.tipoOperacion || '').localeCompare(b.tipoOperacion || '');
          break;
        case 'fecha':
          cmp = (a.fecha || '').localeCompare(b.fecha || '');
          break;
        case 'cliente':
          cmp = (a.cliente || '').localeCompare(b.cliente || '');
          break;
        case 'especie':
          cmp = (a.especie || '').localeCompare(b.especie || '');
          break;
        case 'variedad':
          cmp = (a.variedad || '').localeCompare(b.variedad || '');
          break;
        case 'loteId':
          cmp = (a.loteId || '').localeCompare(b.loteId || '', undefined, { numeric: true });
          break;
        case 'tipo':
          cmp = (a.tipo || '').localeCompare(b.tipo || '');
          break;
        case 'categoria':
          cmp = (a.categoria || '').localeCompare(b.categoria || '');
          break;
        case 'tratamiento':
          cmp = (a.tratamiento || '').localeCompare(b.tratamiento || '');
          break;
        case 'tamanoBolsa':
          cmp = (a.tamanoBolsa || '').localeCompare(b.tamanoBolsa || '', undefined, { numeric: true });
          break;
        case 'chofer':
          cmp = (a.choferNombre || '').localeCompare(b.choferNombre || '');
          break;
        case 'bolsas':
          cmp = a.cantidadBolsas - b.cantidadBolsas;
          break;
        case 'totalKg':
          cmp = a.totalKg - b.totalKg;
          break;
        default:
          cmp = 0;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [filteredRows, sortField, sortDirection]);

  // Manejador de cambio de orden en encabezados
  const handleSort = (field: SortFieldSalidas) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // 7. Descarga individual de remito en PDF
  const handleDownloadRemitoPdf = async () => {
    if (!remitoSeleccionado) return;
    try {
      setIsExportingRemitoPdf(true);
      const fileName = `Remito_Oficial_${remitoSeleccionado.id}_${new Date().toISOString().slice(0, 10)}.pdf`;
      await exportWithHtml2Pdf('remito-historico-card-container', fileName, {
        scale: 2.0,
        quality: 0.98,
        margin: [6, 6, 6, 6],
      });
    } catch (err) {
      console.error('Error al exportar remito a PDF:', err);
    } finally {
      setIsExportingRemitoPdf(false);
    }
  };

  // 8. Exportar a Excel con "N° REMITO DE CLIENTE" en la primera columna
  const handleExportExcel = () => {
    if (sortedRows.length === 0) return;

    const dataToExport = sortedRows.map((r) => ({
      'N° REMITO CLIENTE': r.remitoCliente || 'Sin Asignar',
      'N° REMITO OFICIAL': r.id,
      'FECHA': formatDateStr(r.fecha),
      'CLIENTE / COMITENTE': r.cliente,
      'ESPECIE': r.especie,
      'VARIEDAD': r.variedad,
      'LOTE ID': r.loteId,
      'ALA ORIGEN': r.alaStr,
      'SECTOR ORIGEN': r.sectorStr,
      'TIPO DE LOTE': r.tipo,
      'CATEGORÍA': r.categoria,
      'TRATAMIENTO': r.tratamiento,
      'TAMAÑO BOLSA': r.tamanoBolsa,
      'CHOFER / CONDUCTOR': r.choferNombre,
      'DNI CHOFER': r.choferDni,
      'PATENTE CAMIÓN': r.patenteCamion,
      'BOLSAS DESPACHADAS': r.cantidadBolsas,
      'TOTAL KG DESPACHADOS': r.totalKg,
      'TARA (KG)': r.taraVal,
      'BRUTO (KG)': r.brutoVal,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const keys = Object.keys(dataToExport[0] || {});
    const colWidths = keys.map((key) => {
      const maxLen = Math.max(key.length, ...dataToExport.map((row) => String((row as any)[key] ?? '').length));
      return { wch: Math.min(Math.max(maxLen + 3, 14), 42) };
    });
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Salidas Despachadas');
    XLSX.writeFile(workbook, `Reporte_Salidas_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // 9. Exportar a CSV con "N° REMITO DE CLIENTE" en la primera columna
  const handleExportCSV = () => {
    if (sortedRows.length === 0) return;

    const headers = [
      'N° REMITO CLIENTE',
      'N° REMITO OFICIAL',
      'FECHA',
      'CLIENTE / COMITENTE',
      'ESPECIE',
      'VARIEDAD',
      'LOTE ID',
      'ALA ORIGEN',
      'SECTOR ORIGEN',
      'TIPO DE LOTE',
      'CATEGORÍA',
      'TRATAMIENTO',
      'TAMAÑO BOLSA',
      'CHOFER / CONDUCTOR',
      'DNI CHOFER',
      'PATENTE CAMIÓN',
      'BOLSAS DESPACHADAS',
      'TOTAL KG DESPACHADOS',
      'TARA',
      'BRUTO',
    ];

    const rows = sortedRows.map((r) => [
      r.remitoCliente || 'Sin Asignar',
      r.id,
      formatDateStr(r.fecha),
      r.cliente,
      r.especie,
      r.variedad,
      r.loteId,
      r.alaStr,
      r.sectorStr,
      r.tipo,
      r.categoria,
      r.tratamiento,
      r.tamanoBolsa,
      r.choferNombre,
      r.choferDni,
      r.patenteCamion,
      r.cantidadBolsas,
      r.totalKg,
      r.taraVal,
      r.brutoVal,
    ]);

    const csvContent = [
      'sep=;',
      headers.join(';'),
      ...rows.map((row) =>
        row
          .map((val) => {
            const stringVal = String(val !== undefined && val !== null ? val : '').replace(/"/g, '""');
            return stringVal.includes(';') || stringVal.includes('\n') || stringVal.includes('\r') || stringVal.includes('"')
              ? `"${stringVal}"`
              : stringVal;
          })
          .join(';')
      ),
    ].join('\r\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Reporte_Salidas_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Conteo de filtros activos
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterRemitoCliente.trim()) count++;
    if (filterCliente) count++;
    if (filterEspecie) count++;
    if (filterVariedad) count++;
    if (filterFechaDesde) count++;
    if (filterFechaHasta) count++;
    if (filterTipo) count++;
    if (filterCategoria) count++;
    if (filterTratamiento) count++;
    if (filterTamanoBolsa) count++;
    if (filterOperacion) count++;
    return count;
  }, [
    filterRemitoCliente,
    filterCliente,
    filterEspecie,
    filterVariedad,
    filterFechaDesde,
    filterFechaHasta,
    filterTipo,
    filterCategoria,
    filterTratamiento,
    filterTamanoBolsa,
    filterOperacion,
  ]);

  // Totales calculados en tiempo real
  const summaryTotals = useMemo(() => {
    const totalBolsas = sortedRows.reduce((acc, curr) => acc + (curr.cantidadBolsas || 0), 0);
    const totalKg = sortedRows.reduce((acc, curr) => acc + (curr.totalKg || 0), 0);
    return { totalBolsas, totalKg, count: sortedRows.length };
  }, [sortedRows]);

  // Despachos seleccionados mediante checkboxes
  const selectedRows = useMemo(() => {
    return sortedRows.filter((r) => selectedRowIds.has(r.id) && !deletedIds.has(r.id));
  }, [sortedRows, selectedRowIds, deletedIds]);

  const isAllVisibleSelected =
    sortedRows.length > 0 && sortedRows.every((r) => selectedRowIds.has(r.id));
  const isSomeVisibleSelected =
    sortedRows.some((r) => selectedRowIds.has(r.id)) && !isAllVisibleSelected;

  const toggleSelectAllVisible = () => {
    if (isAllVisibleSelected) {
      setSelectedRowIds((prev) => {
        const next = new Set(prev);
        sortedRows.forEach((r) => next.delete(r.id));
        return next;
      });
    } else {
      setSelectedRowIds((prev) => {
        const next = new Set(prev);
        sortedRows.forEach((r) => next.add(r.id));
        return next;
      });
    }
  };

  // Modal de confirmación para eliminar Despacho (individual o múltiple)
  const renderModalEliminarDespacho = () => {
    if (!despachosAEliminar || despachosAEliminar.length === 0) return null;
    const isMultiple = despachosAEliminar.length > 1;
    const single = despachosAEliminar[0];
    const totalBolsas = despachosAEliminar.reduce((acc, curr) => acc + (curr.cantidadBolsas || 0), 0);
    const totalKg = despachosAEliminar.reduce((acc, curr) => acc + (curr.totalKg || 0), 0);
    const lotesAfectados = Array.from(new Set(despachosAEliminar.map((d) => d.loteId))).filter(Boolean);

    return (
      <ConfirmationDialog
        isOpen={!!despachosAEliminar && despachosAEliminar.length > 0}
        title={
          !isMultiple
            ? `Eliminar Despacho ${single?.remitoCliente ? `Remito ${single.remitoCliente}` : `N° ${single?.id}`}`
            : `Eliminar ${despachosAEliminar.length} Despachos Seleccionados`
        }
        variant="danger"
        confirmText={
          !isMultiple ? 'Eliminar Despacho' : `Eliminar ${despachosAEliminar.length} Despachos`
        }
        cancelText="Cancelar"
        requireConfirmationText="eliminar despacho"
        confirmationPlaceholder='Escriba "eliminar despacho"'
        isLoading={isDeletingDespacho}
        onClose={() => {
          if (!isDeletingDespacho) setDespachosAEliminar(null);
        }}
        onConfirm={handleConfirmarEliminarDespachos}
      >
        <div className="space-y-3.5">
          {!isMultiple ? (
            <div className="bg-rose-50/70 rounded-xl border border-rose-100 p-3.5 space-y-2 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-slate-700">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Identificador</span>
                  <span className="font-mono font-bold text-slate-900">{single.id}</span>
                </div>
                {single.remitoCliente && (
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Remito Cliente</span>
                    <span className="font-mono font-bold text-[#00603C]">{single.remitoCliente}</span>
                  </div>
                )}
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Fecha</span>
                  <span className="font-semibold text-slate-800">{formatDateStr(single.fecha)}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Cliente</span>
                  <span className="font-bold text-slate-900 truncate block">{single.cliente}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Lote Origen</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {single.loteId}
                    {single.alaStr !== '—' && ` (${single.alaStr} · ${single.sectorStr})`}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Especie / Variedad</span>
                  <span className="font-semibold text-slate-800 truncate block">
                    {single.especie} {single.variedad}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Bolsas Despachadas</span>
                  <span className="font-bold text-rose-700 font-mono text-sm">
                    {formatNumberArg(single.cantidadBolsas, 0)} b.
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Kilos Totales</span>
                  <span className="font-bold text-slate-900 font-mono">
                    {formatNumberArg(single.totalKg, 0)} kg
                  </span>
                </div>
                {single.choferNombre !== '—' && (
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Chofer</span>
                    <span className="font-medium text-slate-800 truncate block">{single.choferNombre}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-rose-50/80 rounded-xl border border-rose-200/80 p-3.5 space-y-2 text-xs">
                <div className="grid grid-cols-3 gap-2 text-slate-700">
                  <div className="bg-white/80 p-2 rounded-lg border border-rose-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Despachos a eliminar</span>
                    <span className="font-mono font-bold text-base text-rose-700">{despachosAEliminar.length}</span>
                  </div>
                  <div className="bg-white/80 p-2 rounded-lg border border-rose-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Bolsas a reintegrar</span>
                    <span className="font-mono font-bold text-base text-slate-900">{formatNumberArg(totalBolsas, 0)} b.</span>
                  </div>
                  <div className="bg-white/80 p-2 rounded-lg border border-rose-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Kilos a reintegrar</span>
                    <span className="font-mono font-bold text-base text-slate-900">{formatNumberArg(totalKg, 0)} kg</span>
                  </div>
                </div>

                <div className="pt-1">
                  <span className="text-[11px] font-bold text-slate-700 block mb-1">
                    Lotes que recibirán reintegro de stock:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {lotesAfectados.map((loteId) => (
                      <span
                        key={loteId}
                        className="px-2 py-0.5 rounded bg-white font-mono font-bold text-[11px] text-[#00603C] border border-emerald-200"
                      >
                        Lote {loteId}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Lista compacta de despachos a eliminar */}
              <div className="border border-slate-200 rounded-xl p-2.5 max-h-40 overflow-y-auto divide-y divide-slate-100 bg-slate-50/50 text-[11px]">
                {despachosAEliminar.map((d, i) => (
                  <div key={d.id || i} className="py-1.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono font-bold text-[#00603C] shrink-0">
                        {d.remitoCliente ? `Remito ${d.remitoCliente}` : d.id}
                      </span>
                      <span className="text-slate-700 truncate font-medium">{d.cliente}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
                      <span className="text-slate-500 font-semibold">{d.loteId}</span>
                      <span className="font-bold text-rose-700">+{formatNumberArg(d.cantidadBolsas, 0)} b.</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-amber-950">Acción irreversible con reintegro de stock</p>
              <p className="text-amber-800 leading-relaxed">
                {!isMultiple ? (
                  <>
                    Al confirmar la eliminación de este despacho, el comprobante se dará de baja definitivamente y se reintegrará el stock de{' '}
                    <strong className="font-bold text-amber-950">
                      {formatNumberArg(single.cantidadBolsas, 0)} bolsas ({formatNumberArg(single.totalKg, 0)} kg)
                    </strong>{' '}
                    al Lote <strong className="font-bold text-amber-950">{single.loteId}</strong>.
                  </>
                ) : (
                  <>
                    Al confirmar la eliminación masiva, se cancelarán los{' '}
                    <strong className="font-bold text-amber-950">{despachosAEliminar.length} despachos</strong> seleccionados y se reintegrará automáticamente un total de{' '}
                    <strong className="font-bold text-amber-950">
                      {formatNumberArg(totalBolsas, 0)} bolsas ({formatNumberArg(totalKg, 0)} kg)
                    </strong>{' '}
                    distribuidos en sus lotes correspondientes.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </ConfirmationDialog>
    );
  };

  // Renderizado del remito seleccionado para visualizar/reimprimir
  if (remitoSeleccionado) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto" id="salida-remito-view">
        <button
          onClick={() => setRemitoSeleccionado(null)}
          className="flex items-center gap-1.5 text-xs font-bold text-[#00603C] hover:text-[#254731] uppercase tracking-wider self-start print:hidden cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a Salidas
        </button>

        {/* Remito Imprimible Oficial */}
        <div
          id="remito-historico-card-container"
          className="bg-white p-8 rounded-2xl border-2 border-[#00603C] shadow-md relative text-[#1A1A1A] font-sans"
        >
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.06] pointer-events-none">
            <LogoSiloLoose size={350} color="#00603C" />
          </div>

          <div className="flex justify-between items-start border-b-2 border-[#00603C] pb-6 mb-6">
            <div className="flex gap-3 items-center">
              <LogoSiloLoose size={48} color="#00603C" />
              <div>
                <h3 className="font-serif text-xl font-bold text-[#00603C] uppercase tracking-wide leading-none">
                  AGRO ABACUS S.A.
                </h3>
                <p className="text-[10px] font-sans font-bold tracking-widest text-[#C9922E] uppercase mt-1">
                  PLANTA CLASIFICADORA — ESTANCIA LA BARRANCOSA
                </p>
                <p className="text-[9px] text-gray-500 mt-0.5">Ruta Provincial 14, Km 151.5 — Maria Teresa, Santa Fe</p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[9px] uppercase tracking-widest font-bold text-gray-400 block">
                DOCUMENTO NO VÁLIDO COMO FACTURA
              </span>
              <div className="bg-[#00603C] text-[#F6EFDC] font-mono font-bold text-xs px-3 py-1.5 rounded-md mt-1.5 inline-block">
                REMITO N° {remitoSeleccionado.id}
              </div>
              <div className="text-[10px] text-gray-600 mt-1 font-semibold">
                Fecha: {formatDateStr(remitoSeleccionado.fecha)}
              </div>
              {remitoSeleccionado.remitoCliente && (
                <div className="text-[11px] text-[#00603C] font-mono font-bold mt-1">
                  RTO CLIENTE: {remitoSeleccionado.remitoCliente}
                </div>
              )}
            </div>
          </div>

          <div className="text-center mb-6">
            <h4 className="font-serif text-lg font-bold text-[#00603C] border-b border-[#C9922E] pb-1.5 inline-block uppercase tracking-wider">
              Orden de Salida y Despacho de Semillas (Copia)
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#F6EFDC] bg-opacity-35 p-4 rounded-xl border border-[#C9922E] border-opacity-20 mb-6 text-xs text-left">
            <div>
              <span className="text-[9px] font-bold text-[#C9922E] uppercase tracking-wider block mb-1">
                CONDUCTOR Y CAMIÓN
              </span>
              <p className="font-bold text-gray-800 text-sm">{remitoSeleccionado.choferNombre}</p>
              <p className="text-gray-600 mt-0.5">
                Documento: <span className="font-semibold">{remitoSeleccionado.choferDni}</span>
              </p>
              <p className="text-gray-600">
                Patente del Camión:{' '}
                <span className="font-semibold font-mono text-gray-800 uppercase">
                  {remitoSeleccionado.patenteCamion || '—'}
                </span>
              </p>
            </div>
            <div>
              <span className="text-[9px] font-bold text-[#C9922E] uppercase tracking-wider block mb-1">
                CLIENTE DESTINATARIO
              </span>
              <p className="font-bold text-gray-800 text-sm">{remitoSeleccionado.cliente}</p>
              <p className="text-gray-500 mt-0.5">Retira de Planta Clasificadora - La Barrancosa</p>
              {remitoSeleccionado.remitoCliente && (
                <p className="text-xs text-[#00603C] font-mono font-bold mt-1.5">
                  N° Remito de Cliente: {remitoSeleccionado.remitoCliente}
                </p>
              )}
            </div>
            {remitoSeleccionado.remitoClienteAdjunto && (
              <div className="md:col-span-2 border-t border-[#C9922E]/20 pt-3 mt-1 flex flex-wrap items-center justify-between gap-2 print:hidden">
                <div className="flex items-center gap-2 text-xs">
                  <Paperclip className="w-4 h-4 text-[#A0522D]" />
                  <span className="text-gray-700">
                    Remito de Cliente Adjunto: <strong>{remitoSeleccionado.remitoClienteAdjunto.nombre}</strong>
                  </span>
                </div>
                <a
                  href={remitoSeleccionado.remitoClienteAdjunto.data}
                  download={remitoSeleccionado.remitoClienteAdjunto.nombre}
                  className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#00603C] hover:underline cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar Adjunto
                </a>
              </div>
            )}
          </div>

          <div className="border border-gray-200 rounded-xl overflow-hidden mb-8 text-xs text-left">
            <table className="w-full">
              <thead>
                <tr className="bg-[#00603C] text-white uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-4">Lote ID</th>
                  <th className="py-2.5 px-4">Producto / Especie</th>
                  <th className="py-2.5 px-4">Tipo / Tratamiento</th>
                  <th className="py-2.5 px-4 text-center">Envase</th>
                  <th className="py-2.5 px-4 text-right">Bolsas</th>
                  <th className="py-2.5 px-4 text-right">Peso (Kg)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="py-3 px-4 font-mono font-bold text-[#C9922E]">{remitoSeleccionado.loteId}</td>
                  <td className="py-3 px-4">
                    <span className="font-bold text-gray-900 block">{remitoSeleccionado.tipoLote}</span>
                    <span className="text-[10px] text-gray-500 block">Tratado con: {remitoSeleccionado.producto}</span>
                    {(() => {
                      const matchingLote = lotes.find((l) => l.id === remitoSeleccionado.loteId);
                      if (matchingLote && matchingLote.ala && matchingLote.sector) {
                        return (
                          <div className="text-[10px] text-[#00603C] font-semibold mt-1 flex items-center gap-1 bg-[#E3EFE7] px-1.5 py-0.5 rounded w-max">
                            Ubicación de Origen: ALA {matchingLote.ala} · SECTOR {matchingLote.sector}
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-gray-700 font-semibold">{remitoSeleccionado.categoria}</span>
                  </td>
                  <td className="py-3 px-4 text-center text-gray-600">{remitoSeleccionado.envase}</td>
                  <td className="py-3 px-4 text-right font-bold text-gray-900">{remitoSeleccionado.cantidadBolsas} b.</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-[#00603C]">
                    {formatNumberArg(remitoSeleccionado.totalKg, 0)} kg
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 gap-8 mt-16 text-center text-xs">
            <div>
              <div className="border-t border-gray-300 w-4/5 mx-auto pt-2">
                <p className="font-semibold text-gray-700">Autorización Despacho de Planta</p>
                <p className="text-gray-400 text-[10px]">Agro Abacus S.A.</p>
              </div>
            </div>
            <div>
              <div className="border-t border-gray-300 w-4/5 mx-auto pt-2">
                <p className="font-semibold text-gray-700">Firma Chofer Conductor</p>
                <p className="text-gray-400 text-[10px]">Recibí Conforme</p>
              </div>
            </div>
          </div>

          <p className="text-center text-[9px] text-gray-400 mt-12 italic">
            Remito de Control Interno emitido en planta. Conserve esta copia para tránsito.
          </p>
        </div>

        {/* Acciones de comprobante */}
        <div className="flex items-center justify-between gap-3 print:hidden">
          <div>
            {(onDeleteDespacho || onDeleteMultipleDespachos) && (
              <button
                type="button"
                onClick={() => {
                  const match = sortedRows.find(
                    (r) => r.id === remitoSeleccionado.id || (r.rawSalida && r.rawSalida.id === remitoSeleccionado.id)
                  );
                  if (match) {
                    setDespachosAEliminar([match]);
                  } else {
                    setDespachosAEliminar([{
                      id: remitoSeleccionado.id,
                      remitoCliente: remitoSeleccionado.remitoCliente || '',
                      fecha: remitoSeleccionado.fecha || '',
                      cliente: remitoSeleccionado.cliente || '',
                      especie: '',
                      variedad: '',
                      loteId: remitoSeleccionado.loteId || '',
                      alaStr: '—',
                      sectorStr: '—',
                      tipo: remitoSeleccionado.tipoLote || '',
                      categoria: remitoSeleccionado.categoria || '',
                      tratamiento: '',
                      tamanoBolsa: '',
                      kgPorBolsa: remitoSeleccionado.kgPorBolsa || 40,
                      choferNombre: remitoSeleccionado.choferNombre || '',
                      choferDni: remitoSeleccionado.choferDni || '',
                      patenteCamion: remitoSeleccionado.patenteCamion || '',
                      cantidadBolsas: remitoSeleccionado.cantidadBolsas || 0,
                      totalKg: remitoSeleccionado.totalKg || 0,
                      taraVal: 0,
                      brutoVal: 0,
                      tipoOperacion: 'Despacho',
                      rawSalida: remitoSeleccionado,
                    }]);
                  }
                }}
                className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-100 transition cursor-pointer"
                title="Eliminar este despacho"
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Eliminar Despacho</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setRemitoSeleccionado(null)}
              className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-500 rounded-lg hover:bg-gray-100 transition cursor-pointer"
            >
              Cerrar Copia
            </button>

            <button
              type="button"
              onClick={handleDownloadRemitoPdf}
              disabled={isExportingRemitoPdf}
              className="flex items-center gap-2 px-6 py-2.5 text-xs font-semibold uppercase tracking-wider bg-[#00603C] text-white rounded-lg hover:bg-[#254731] transition shadow-md cursor-pointer disabled:opacity-50"
              title="Descargar Remito Oficial en PDF"
            >
              {isExportingRemitoPdf ? (
                <Loader2 className="w-4.5 h-4.5 animate-spin text-[#C9922E]" />
              ) : (
                <Download className="w-4.5 h-4.5 text-[#C9922E]" />
              )}
              <span>{isExportingRemitoPdf ? 'Generando PDF...' : 'Descargar PDF Remito'}</span>
            </button>
          </div>
        </div>

        {renderModalEliminarDespacho()}
      </div>
    );
  }

  // Renderizado del listado con filtros y tabla
  return (
    <div className="space-y-6" id="salidas-list-container">
      {/* Cabecera Principal */}
      <div className="border-b border-gray-100 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-sans font-semibold tracking-widest text-[#00603C] uppercase">
            MÓDULO DE LOGÍSTICA
          </span>
          <h2 className="font-serif text-3xl font-bold text-[#1A1A1A] mt-1">Salidas</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Registro, trazabilidad y control de remitos y salidas despachadas de planta
          </p>
        </div>

        {unifiedRows.length > 0 && (
          <div className="flex items-center gap-2 bg-[#E3EFE7]/50 p-1.5 rounded-xl border border-[#00603C]/20 shrink-0">
            <button
              onClick={handleExportExcel}
              className="flex items-center justify-center gap-1.5 text-xs font-sans font-bold bg-[#00603C] text-white hover:bg-[#254731] px-3.5 py-2 rounded-lg transition shadow-2xs cursor-pointer"
              title="Exportar todas las salidas visibles a Excel (.xlsx) con N° de Remito Cliente en primer columna"
            >
              <Download className="w-4 h-4 text-[#C9922E]" />
              <span>Exportar Excel</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center justify-center gap-1 text-xs font-sans font-semibold text-[#00603C] hover:bg-[#00603C]/10 px-2.5 py-2 rounded-lg transition cursor-pointer"
              title="Exportar archivo CSV delimitado por punto y coma"
            >
              <span>CSV</span>
            </button>
          </div>
        )}
      </div>

      {/* PANEL DE FILTROS DE BÚSQUEDA */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#00603C]" />
            <span className="text-xs font-sans font-bold text-gray-700 uppercase tracking-wider">
              Filtros para Buscar
            </span>
            {activeFiltersCount > 0 && (
              <span className="bg-emerald-100 text-[#00603C] text-[10px] font-bold px-2 py-0.5 rounded-full">
                {activeFiltersCount} activo{activeFiltersCount > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* BOTÓN PARA FIJAR FILTROS */}
            <button
              type="button"
              id="btn-fijar-filtros-salidas"
              onClick={togglePinFilters}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                isFilterPinned
                  ? 'bg-[#00603C] text-white shadow-xs ring-1 ring-emerald-400'
                  : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
              }`}
              title={
                isFilterPinned
                  ? 'Filtros fijados en memoria (se conservan al navegar)'
                  : 'Fijar filtros para que se conserven al recargar o cambiar de vista'
              }
            >
              {isFilterPinned ? (
                <Pin className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
              ) : (
                <PinOff className="w-3.5 h-3.5 text-gray-400" />
              )}
              <span>{isFilterPinned ? 'Filtros Fijados' : 'Fijar Filtros'}</span>
            </button>

            {/* BOTÓN LIMPIAR FILTROS */}
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-2.5 py-1.5 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg border border-gray-200 transition flex items-center gap-1 cursor-pointer"
                title="Restablecer todos los filtros"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Limpiar</span>
              </button>
            )}
          </div>
        </div>

        {/* BUSCADOR DIRECTO DE N° DE REMITO DE CLIENTE */}
        <div className="bg-[#E3EFE7]/40 border border-[#00603C]/20 rounded-xl p-3.5 flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 rounded-lg bg-[#00603C] text-white flex items-center justify-center shadow-xs">
              <Search className="w-4.5 h-4.5 text-[#C9922E]" />
            </div>
            <div>
              <label
                htmlFor="input-buscador-remito-cliente"
                className="block text-xs font-bold font-sans uppercase tracking-wider text-[#00603C] cursor-pointer"
              >
                Buscador por N° de Remito de Cliente
              </label>
              <span className="block text-[11px] text-gray-500 font-medium">
                Localice despachos directamente por el número o comprobante emitido por el cliente
              </span>
            </div>
          </div>

          <div className="flex-1 relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 pointer-events-none">
              <FileText className="w-4 h-4 text-[#00603C]" />
            </span>
            <input
              id="input-buscador-remito-cliente"
              type="text"
              value={filterRemitoCliente}
              onChange={(e) => setFilterRemitoCliente(e.target.value)}
              placeholder="Buscar por N° de Remito de Cliente (ej: R-0012, 1024, etc.)..."
              className="w-full pl-9 pr-9 py-2 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#00603C] focus:border-[#00603C] text-xs font-mono font-bold text-gray-800 placeholder:font-sans placeholder:font-normal placeholder:text-gray-400 shadow-2xs h-10 transition"
            />
            {filterRemitoCliente && (
              <button
                type="button"
                onClick={() => setFilterRemitoCliente('')}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition cursor-pointer"
                title="Borrar búsqueda de remito de cliente"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {filterRemitoCliente.trim() && (
            <div className="flex items-center justify-between sm:justify-start gap-2 bg-white px-3 py-1.5 rounded-lg border border-emerald-200 text-xs shrink-0 shadow-2xs">
              <span className="text-[11px] text-gray-500 font-semibold">Resultados:</span>
              <span className="font-mono font-bold text-[#00603C] bg-emerald-50 px-2 py-0.5 rounded">
                {sortedRows.length} {sortedRows.length === 1 ? 'salida' : 'salidas'}
              </span>
            </div>
          )}
        </div>

        {/* GRILLA DE FILTROS: Cliente, Especie, Variedad, Fechas, Tipo, Categorías, Tratamiento, Tamaño de Bolsa */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
          {/* 1. Cliente */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Cliente
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-gray-400 pointer-events-none">
                <Search className="w-3.5 h-3.5" />
              </span>
              <select
                id="filter-salidas-cliente"
                value={filterCliente}
                onChange={(e) => setFilterCliente(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C] text-xs h-9"
              >
                <option value="">Todos los Clientes</option>
                {clientesOptions.map((cli) => (
                  <option key={cli} value={cli}>
                    {cli}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. Especie */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Especie
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-gray-400 pointer-events-none">
                <Wheat className="w-3.5 h-3.5" />
              </span>
              <select
                id="filter-salidas-especie"
                value={filterEspecie}
                onChange={(e) => setFilterEspecie(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C] text-xs h-9"
              >
                <option value="">Todas las Especies</option>
                {especiesOptions.map((esp) => (
                  <option key={esp} value={esp}>
                    {esp}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. Variedad (reactiva a Cliente y Especie) */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Variedad</span>
              {(filterCliente || filterEspecie) && (
                <span className="text-[9px] text-[#00603C] font-semibold lowercase">
                  ({variedadesOptions.length} disp.)
                </span>
              )}
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-gray-400 pointer-events-none">
                <Tag className="w-3.5 h-3.5" />
              </span>
              <select
                id="filter-salidas-variedad"
                value={filterVariedad}
                onChange={(e) => setFilterVariedad(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C] text-xs h-9"
              >
                <option value="">
                  {filterCliente || filterEspecie
                    ? 'Todas las Variedades disponibles'
                    : 'Todas las Variedades'}
                </option>
                {variedadesOptions.map((vr) => (
                  <option key={vr} value={vr}>
                    {vr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 4. Rango de Fechas (Desde / Hasta) */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                Fecha Desde
              </label>
              <input
                type="date"
                id="filter-salidas-fecha-desde"
                value={filterFechaDesde}
                onChange={(e) => setFilterFechaDesde(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C] text-xs h-9 font-sans"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                Fecha Hasta
              </label>
              <input
                type="date"
                id="filter-salidas-fecha-hasta"
                value={filterFechaHasta}
                onChange={(e) => setFilterFechaHasta(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C] text-xs h-9 font-sans"
              />
            </div>
          </div>

          {/* 5. Tipo */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Tipo
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-gray-400 pointer-events-none">
                <Layers className="w-3.5 h-3.5" />
              </span>
              <select
                id="filter-salidas-tipo"
                value={filterTipo}
                onChange={(e) => setFilterTipo(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C] text-xs h-9"
              >
                <option value="">Todos los Tipos</option>
                {tiposOptions.map((tp) => (
                  <option key={tp} value={tp}>
                    {tp}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 6. Categorías */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Categorías
            </label>
            <select
              id="filter-salidas-categoria"
              value={filterCategoria}
              onChange={(e) => setFilterCategoria(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C] text-xs h-9"
            >
              <option value="">Todas las Categorías</option>
              {categoriasOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* 7. Tratamiento */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Tratamiento
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-gray-400 pointer-events-none">
                <FlaskConical className="w-3.5 h-3.5" />
              </span>
              <select
                id="filter-salidas-tratamiento"
                value={filterTratamiento}
                onChange={(e) => setFilterTratamiento(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C] text-xs h-9"
              >
                <option value="">Todos los Tratamientos</option>
                {tratamientosOptions.map((tr) => (
                  <option key={tr} value={tr}>
                    {tr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 8. Tamaño de Bolsa */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Tamaño de Bolsa
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-gray-400 pointer-events-none">
                <Package className="w-3.5 h-3.5" />
              </span>
              <select
                id="filter-salidas-tamano-bolsa"
                value={filterTamanoBolsa}
                onChange={(e) => setFilterTamanoBolsa(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C] text-xs h-9"
              >
                <option value="">Todos los Tamaños</option>
                {tamanoBolsaOptions.map((tb) => (
                  <option key={tb} value={tb}>
                    {tb}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 9. Tipo de Operación / Egreso */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Tipo de Egreso
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-gray-400 pointer-events-none">
                <Truck className="w-3.5 h-3.5" />
              </span>
              <select
                id="filter-salidas-operacion"
                value={filterOperacion}
                onChange={(e) => setFilterOperacion(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C] text-xs h-9 font-semibold"
              >
                <option value="">Todos los Egresos</option>
                <option value="Despacho">Despachos</option>
                <option value="Salida por movimiento">Salidas por movimiento</option>
                <option value="Salida manual">Salidas manuales</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* BARRA DE RESUMEN Y CONTROLES DE ORDENAMIENTO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-gray-600 font-medium">
          <span className="bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-2xs">
            Mostrando <strong className="text-gray-900">{summaryTotals.count}</strong> registros
          </span>
          {selectedRows.length > 0 && (
            <span className="bg-emerald-100 text-[#00603C] px-3 py-1.5 rounded-lg border border-emerald-300 font-bold flex items-center gap-1.5 shadow-2xs animate-in fade-in duration-150">
              <span className="w-2 h-2 rounded-full bg-[#00603C] animate-pulse" />
              {selectedRows.length} seleccionado{selectedRows.length > 1 ? 's' : ''}
            </span>
          )}
          <span className="bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-2xs">
            Bolsas:{' '}
            <strong className="text-gray-900 font-mono">{formatNumberArg(summaryTotals.totalBolsas, 0)}</strong>
          </span>
          <span className="bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-2xs">
            Total Kg:{' '}
            <strong className="text-[#00603C] font-mono">{formatNumberArg(summaryTotals.totalKg, 0)} kg</strong>
          </span>
        </div>

        {/* SELECTOR RÁPIDO DE ORDENAMIENTO */}
        <div className="flex items-center gap-2">
          <span className="text-gray-500 font-bold uppercase tracking-wider text-[10px]">Ordenar por:</span>
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as SortFieldSalidas)}
            className="bg-white px-3 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C] font-sans font-semibold text-xs h-8 shadow-2xs"
          >
            <option value="remitoCliente">N° Remito Cliente (1° Columna)</option>
            <option value="fecha">Fecha</option>
            <option value="cliente">Cliente</option>
            <option value="especie">Especie</option>
            <option value="variedad">Variedad</option>
            <option value="loteId">Lote ID</option>
            <option value="tipo">Tipo</option>
            <option value="categoria">Categoría</option>
            <option value="tratamiento">Tratamiento</option>
            <option value="tamanoBolsa">Tamaño de Bolsa</option>
            <option value="chofer">Chofer</option>
            <option value="bolsas">Cantidad de Bolsas</option>
            <option value="totalKg">Kilos Totales</option>
            <option value="id">N° Remito Interno</option>
          </select>

          <button
            type="button"
            onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
            className="px-2.5 py-1.5 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-bold flex items-center gap-1 shadow-2xs cursor-pointer h-8"
            title={`Alternar a orden ${sortDirection === 'asc' ? 'Descendente' : 'Ascendente'}`}
          >
            {sortDirection === 'asc' ? (
              <>
                <ArrowUp className="w-3.5 h-3.5 text-[#00603C]" />
                <span>Asc</span>
              </>
            ) : (
              <>
                <ArrowDown className="w-3.5 h-3.5 text-[#00603C]" />
                <span>Desc</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* BARRA DE ACCIÓN PARA DESPACHOS SELECCIONADOS */}
      {selectedRows.length > 0 && (
        <div className="bg-[#00603C] text-white p-3.5 sm:px-5 sm:py-3 rounded-2xl shadow-md flex flex-col sm:flex-row items-center justify-between gap-3 border border-emerald-700/60 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center gap-3.5 w-full sm:w-auto">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center font-bold text-[#C9922E] text-base shrink-0 border border-white/20 shadow-inner">
              {selectedRows.length}
            </div>
            <div>
              <div className="font-bold text-sm flex items-center gap-2">
                <span>
                  {selectedRows.length === 1
                    ? '1 despacho seleccionado'
                    : `${selectedRows.length} despachos seleccionados`}
                </span>
              </div>
              <div className="text-xs text-emerald-100 flex items-center gap-2.5 mt-0.5 font-medium">
                <span>
                  Bolsas:{' '}
                  <strong className="text-white font-mono font-bold">
                    {formatNumberArg(selectedRows.reduce((a, c) => a + (c.cantidadBolsas || 0), 0), 0)}
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Kilos:{' '}
                  <strong className="text-white font-mono font-bold">
                    {formatNumberArg(selectedRows.reduce((a, c) => a + (c.totalKg || 0), 0), 0)} kg
                  </strong>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleClearSelection}
              className="px-3.5 py-2 text-xs text-emerald-100 hover:text-white hover:bg-white/10 rounded-xl transition font-semibold cursor-pointer"
            >
              Deseleccionar
            </button>
            {(onDeleteDespacho || onDeleteMultipleDespachos) && (
              <button
                type="button"
                onClick={() => setDespachosAEliminar(selectedRows)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-sm cursor-pointer"
                title={`Eliminar ${selectedRows.length} despachos seleccionados (requiere confirmación por texto)`}
              >
                <Trash2 className="w-4 h-4 text-rose-200" />
                <span>
                  Eliminar {selectedRows.length === 1 ? 'Despacho' : `Despachos (${selectedRows.length})`}
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* VISTA DE TABLA CON PRIMERA COLUMNA "N° DE REMITO DE CLIENTE" */}
      {sortedRows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-50 text-[#C9922E]" />
          <h4 className="font-serif text-lg font-bold text-gray-700 mb-1">Sin Salidas Encontradas</h4>
          <p className="text-xs">
            No se encontraron despachos que coincidan con los filtros y criterios especificados.
          </p>
          {activeFiltersCount > 0 && (
            <button
              onClick={handleClearFilters}
              className="mt-3 text-xs text-[#00603C] hover:underline font-bold cursor-pointer inline-flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restablecer filtros de búsqueda
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#00603C] text-white font-sans uppercase tracking-wider text-[10px]">
                  {/* COLUMNA CHECKBOX SELECCIÓN */}
                  <th className="py-3 px-3 text-center w-10">
                    <input
                      type="checkbox"
                      aria-label="Seleccionar o deseleccionar todos los despachos visibles"
                      title="Seleccionar todos los despachos visibles"
                      checked={isAllVisibleSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isSomeVisibleSelected;
                      }}
                      onChange={toggleSelectAllVisible}
                      className="w-4 h-4 rounded text-[#00603C] focus:ring-[#00603C] border-gray-300 cursor-pointer accent-[#C9922E]"
                    />
                  </th>

                  {/* PRIMER COLUMNA: NRO DE REMITO DE CLIENTE */}
                  <th
                    className="py-3 px-3.5 cursor-pointer hover:bg-emerald-800 transition select-none"
                    onClick={() => handleSort('remitoCliente')}
                    title="Ordenar por N° de Remito de Cliente (Ascendente / Descendente)"
                  >
                    <div className="flex items-center gap-1">
                      <span>N° Remito Cliente</span>
                      {sortField === 'remitoCliente' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-amber-300" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-amber-300" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-emerald-200/50" />
                      )}
                    </div>
                  </th>

                  {/* N° Remito Interno / ID */}
                  <th
                    className="py-3 px-3 cursor-pointer hover:bg-emerald-800 transition select-none"
                    onClick={() => handleSort('id')}
                    title="Ordenar por N° Remito Interno"
                  >
                    <div className="flex items-center gap-1">
                      <span>N° Remito</span>
                      {sortField === 'id' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-amber-300" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-amber-300" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-emerald-200/50" />
                      )}
                    </div>
                  </th>

                  {/* Operación / Tipo de Egreso */}
                  <th
                    className="py-3 px-3 cursor-pointer hover:bg-emerald-800 transition select-none"
                    onClick={() => handleSort('tipoOperacion')}
                    title="Ordenar por Tipo de Operación"
                  >
                    <div className="flex items-center gap-1">
                      <span>Operación</span>
                      {sortField === 'tipoOperacion' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-amber-300" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-amber-300" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-emerald-200/50" />
                      )}
                    </div>
                  </th>

                  {/* Fecha */}
                  <th
                    className="py-3 px-3 cursor-pointer hover:bg-emerald-800 transition select-none"
                    onClick={() => handleSort('fecha')}
                    title="Ordenar por Fecha"
                  >
                    <div className="flex items-center gap-1">
                      <span>Fecha</span>
                      {sortField === 'fecha' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-amber-300" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-amber-300" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-emerald-200/50" />
                      )}
                    </div>
                  </th>

                  {/* Cliente */}
                  <th
                    className="py-3 px-3 cursor-pointer hover:bg-emerald-800 transition select-none"
                    onClick={() => handleSort('cliente')}
                    title="Ordenar por Cliente"
                  >
                    <div className="flex items-center gap-1">
                      <span>Cliente / Comitente</span>
                      {sortField === 'cliente' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-amber-300" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-amber-300" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-emerald-200/50" />
                      )}
                    </div>
                  </th>

                  {/* Especie */}
                  <th
                    className="py-3 px-3 cursor-pointer hover:bg-emerald-800 transition select-none"
                    onClick={() => handleSort('especie')}
                    title="Ordenar por Especie"
                  >
                    <div className="flex items-center gap-1">
                      <span>Especie</span>
                      {sortField === 'especie' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-amber-300" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-amber-300" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-emerald-200/50" />
                      )}
                    </div>
                  </th>

                  {/* Variedad */}
                  <th
                    className="py-3 px-3 cursor-pointer hover:bg-emerald-800 transition select-none"
                    onClick={() => handleSort('variedad')}
                    title="Ordenar por Variedad"
                  >
                    <div className="flex items-center gap-1">
                      <span>Variedad</span>
                      {sortField === 'variedad' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-amber-300" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-amber-300" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-emerald-200/50" />
                      )}
                    </div>
                  </th>

                  {/* Lote ID */}
                  <th
                    className="py-3 px-3 cursor-pointer hover:bg-emerald-800 transition select-none"
                    onClick={() => handleSort('loteId')}
                    title="Ordenar por Lote ID"
                  >
                    <div className="flex items-center gap-1">
                      <span>Lote ID</span>
                      {sortField === 'loteId' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-amber-300" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-amber-300" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-emerald-200/50" />
                      )}
                    </div>
                  </th>

                  {/* Tipo */}
                  <th
                    className="py-3 px-3 cursor-pointer hover:bg-emerald-800 transition select-none"
                    onClick={() => handleSort('tipo')}
                    title="Ordenar por Tipo de Lote"
                  >
                    <div className="flex items-center gap-1">
                      <span>Tipo</span>
                      {sortField === 'tipo' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-amber-300" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-amber-300" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-emerald-200/50" />
                      )}
                    </div>
                  </th>

                  {/* Categoría */}
                  <th
                    className="py-3 px-3 cursor-pointer hover:bg-emerald-800 transition select-none"
                    onClick={() => handleSort('categoria')}
                    title="Ordenar por Categoría"
                  >
                    <div className="flex items-center gap-1">
                      <span>Categoría</span>
                      {sortField === 'categoria' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-amber-300" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-amber-300" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-emerald-200/50" />
                      )}
                    </div>
                  </th>

                  {/* Tratamiento */}
                  <th
                    className="py-3 px-3 cursor-pointer hover:bg-emerald-800 transition select-none"
                    onClick={() => handleSort('tratamiento')}
                    title="Ordenar por Tratamiento"
                  >
                    <div className="flex items-center gap-1">
                      <span>Tratamiento</span>
                      {sortField === 'tratamiento' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-amber-300" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-amber-300" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-emerald-200/50" />
                      )}
                    </div>
                  </th>

                  {/* Tamaño Bolsa */}
                  <th
                    className="py-3 px-3 cursor-pointer hover:bg-emerald-800 transition select-none"
                    onClick={() => handleSort('tamanoBolsa')}
                    title="Ordenar por Tamaño de Bolsa"
                  >
                    <div className="flex items-center gap-1">
                      <span>Bolsa / Envase</span>
                      {sortField === 'tamanoBolsa' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-amber-300" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-amber-300" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-emerald-200/50" />
                      )}
                    </div>
                  </th>

                  {/* Chofer Conductor */}
                  <th
                    className="py-3 px-3 cursor-pointer hover:bg-emerald-800 transition select-none"
                    onClick={() => handleSort('chofer')}
                    title="Ordenar por Chofer"
                  >
                    <div className="flex items-center gap-1">
                      <span>Chofer / Camión</span>
                      {sortField === 'chofer' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-amber-300" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-amber-300" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-emerald-200/50" />
                      )}
                    </div>
                  </th>

                  {/* Bolsas */}
                  <th
                    className="py-3 px-3 text-right cursor-pointer hover:bg-emerald-800 transition select-none"
                    onClick={() => handleSort('bolsas')}
                    title="Ordenar por Bolsas"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Bolsas</span>
                      {sortField === 'bolsas' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-amber-300" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-amber-300" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-emerald-200/50" />
                      )}
                    </div>
                  </th>

                  {/* Total Kg */}
                  <th
                    className="py-3 px-3 text-right cursor-pointer hover:bg-emerald-800 transition select-none"
                    onClick={() => handleSort('totalKg')}
                    title="Ordenar por Total Kg"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Total Kg</span>
                      {sortField === 'totalKg' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-amber-300" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-amber-300" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-emerald-200/50" />
                      )}
                    </div>
                  </th>

                  {/* Adjunto */}
                  <th className="py-3 px-2 text-center">Adj.</th>

                  {/* Acciones */}
                  <th className="py-3 px-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedRows.map((r, idx) => (
                  <tr
                    key={`${r.id}-${idx}`}
                    className={`transition-colors ${
                      selectedRowIds.has(r.id)
                        ? 'bg-emerald-50/90 hover:bg-emerald-100/70'
                        : idx % 2 === 0
                        ? 'bg-white hover:bg-emerald-50/40'
                        : 'bg-[#E3EFE7]/25 hover:bg-emerald-50/40'
                    }`}
                  >
                    {/* COLUMNA CHECKBOX SELECCIÓN */}
                    <td className="py-3 px-3 text-center w-10">
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar despacho ${r.remitoCliente || r.id}`}
                        checked={selectedRowIds.has(r.id)}
                        onChange={() => toggleSelectRow(r.id)}
                        className="w-4 h-4 rounded text-[#00603C] focus:ring-[#00603C] border-gray-300 cursor-pointer accent-[#00603C]"
                      />
                    </td>

                    {/* PRIMERA COLUMNA: N° DE REMITO DE CLIENTE */}
                    <td className="py-3 px-3.5 font-mono">
                      {r.remitoCliente ? (
                        <span
                          className={`font-bold px-2 py-0.5 rounded border text-xs inline-block transition ${
                            filterRemitoCliente.trim() &&
                            r.remitoCliente.toLowerCase().includes(filterRemitoCliente.trim().toLowerCase())
                              ? 'bg-amber-100 text-amber-950 border-amber-400 ring-2 ring-amber-400/60 shadow-xs'
                              : 'text-[#00603C] bg-emerald-50 border-emerald-200'
                          }`}
                        >
                          {r.remitoCliente}
                        </span>
                      ) : (
                        <span className="text-gray-300 italic text-[11px]">—</span>
                      )}
                    </td>

                    {/* N° Remito Interno / ID */}
                    <td className="py-3 px-3 font-mono font-bold text-[#A0522D]">{r.id}</td>

                    {/* Operación / Tipo de Egreso */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {r.tipoOperacion === 'Despacho' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                          <Truck className="w-3 h-3 text-blue-600" />
                          Despacho
                        </span>
                      ) : r.tipoOperacion === 'Salida por movimiento' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <ArrowRight className="w-3 h-3 text-[#00603C]" />
                          Salida x Mov.
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                          <ArrowDownRight className="w-3 h-3 text-[#A0522D]" />
                          Salida Manual
                        </span>
                      )}
                    </td>

                    {/* Fecha */}
                    <td className="py-3 px-3 font-semibold text-gray-600 whitespace-nowrap">
                      {formatDateStr(r.fecha)}
                    </td>

                    {/* Cliente */}
                    <td className="py-3 px-3 font-bold text-gray-900 whitespace-nowrap">{r.cliente}</td>

                    {/* Especie */}
                    <td className="py-3 px-3 text-gray-700 font-medium whitespace-nowrap">{r.especie}</td>

                    {/* Variedad */}
                    <td className="py-3 px-3 font-semibold text-[#00603C] whitespace-nowrap">{r.variedad}</td>

                    {/* Lote ID */}
                    <td className="py-3 px-3 font-mono font-semibold text-gray-800 whitespace-nowrap">
                      <div>{r.loteId}</div>
                      {r.alaStr !== '—' && (
                        <span className="inline-flex items-center gap-0.5 font-sans font-bold text-[#00603C] bg-[#E3EFE7] px-1 py-0.5 rounded text-[9px] mt-0.5">
                          {r.alaStr} · {r.sectorStr}
                        </span>
                      )}
                    </td>

                    {/* Tipo */}
                    <td className="py-3 px-3 text-gray-600 whitespace-nowrap">{r.tipo}</td>

                    {/* Categoría */}
                    <td className="py-3 px-3 text-gray-700 font-medium whitespace-nowrap">{r.categoria}</td>

                    {/* Tratamiento */}
                    <td className="py-3 px-3 text-gray-600 max-w-[140px] truncate" title={r.tratamiento}>
                      {r.tratamiento}
                    </td>

                    {/* Tamaño de Bolsa */}
                    <td className="py-3 px-3 text-gray-600 whitespace-nowrap">{r.tamanoBolsa}</td>

                    {/* Chofer y Patente */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="font-semibold text-gray-900">{r.choferNombre}</div>
                      {r.patenteCamion !== '—' && (
                        <div className="text-[10px] font-mono uppercase text-gray-500">{r.patenteCamion}</div>
                      )}
                    </td>

                    {/* Cantidad de Bolsas */}
                    <td className="py-3 px-3 text-right font-bold text-gray-800 whitespace-nowrap font-mono">
                      {formatNumberArg(r.cantidadBolsas, 0)} b.
                    </td>

                    {/* Total Kilos */}
                    <td className="py-3 px-3 text-right font-mono font-bold text-[#00603C] whitespace-nowrap">
                      {formatNumberArg(r.totalKg, 0)} kg
                    </td>

                    {/* Adjunto */}
                    <td className="py-3 px-2 text-center">
                      {r.adjunto ? (
                        <div className="inline-flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setPreviewFoto({
                              url: r.adjunto!.data,
                              titulo: `Foto de Remito / Despacho - ${r.remitoCliente || r.id}`,
                              cliente: r.cliente,
                              fecha: r.fecha,
                              remito: r.remitoCliente
                            })}
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-[#00603C] rounded-md transition cursor-pointer border border-emerald-200"
                            title="Ver foto adjunta por el despachante en alta resolución"
                          >
                            <Camera className="w-3.5 h-3.5 text-[#00603C]" />
                          </button>
                          <a
                            href={r.adjunto.data}
                            download={r.adjunto.nombre}
                            className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-md transition cursor-pointer"
                            title={`Descargar adjunto: ${r.adjunto.nombre}`}
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>

                    {/* Acciones: Documento / Ver Remito y Eliminar Despacho */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <div className="inline-flex items-center justify-center gap-1.5">
                        {r.rawSalida ? (
                          <button
                            type="button"
                            onClick={() => setRemitoSeleccionado(r.rawSalida!)}
                            className="p-1.5 text-[#00603C] hover:bg-[#E3EFE7] hover:text-[#254731] rounded-md transition cursor-pointer"
                            title="Ver y descargar PDF de remito oficial"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-gray-400 text-[10px] font-mono px-1">OC</span>
                        )}

                        {(onDeleteDespacho || onDeleteMultipleDespachos) && (
                          <button
                            type="button"
                            onClick={() => setDespachosAEliminar([r])}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition cursor-pointer border border-transparent hover:border-rose-200"
                            title={`Eliminar Despacho ${r.remitoCliente ? `Remito ${r.remitoCliente}` : `N° ${r.id}`}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL VISUALIZADOR DE FOTO DE SALIDA / DESPACHO */}
      {previewFoto && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewFoto(null)}
        >
          <div
            className="bg-white w-full max-w-3xl rounded-2xl p-5 shadow-2xl border border-gray-200 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 text-[#00603C] rounded-xl">
                  <Camera className="w-5 h-5 text-[#00603C]" />
                </div>
                <div>
                  <h4 className="font-serif text-base font-bold text-[#00603C]">
                    {previewFoto.titulo}
                  </h4>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-gray-500 font-medium">
                    {previewFoto.cliente && (
                      <span className="bg-emerald-50 px-2 py-0.5 rounded text-[#00603C] font-semibold border border-emerald-200">
                        {previewFoto.cliente}
                      </span>
                    )}
                    {previewFoto.remito && (
                      <span className="bg-amber-50 px-2 py-0.5 rounded text-amber-800 font-semibold border border-amber-200">
                        Remito: {previewFoto.remito}
                      </span>
                    )}
                    {previewFoto.fecha && (
                      <span className="text-gray-400">
                        {formatDateStr(previewFoto.fecha)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewFoto(null)}
                className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition cursor-pointer"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto bg-gray-900 rounded-xl p-2 flex items-center justify-center min-h-[350px]">
              <img
                src={previewFoto.url}
                alt="Foto adjunta"
                className="max-h-[65vh] w-auto max-w-full object-contain rounded shadow-lg"
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-3 text-xs">
              <span className="text-gray-400 text-[11px]">
                Documento / Fotografía de salida adjuntada por el despachante.
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={previewFoto.url}
                  download={`Foto-Salida-${previewFoto.remito || 'adjunto'}.jpg`}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer text-xs"
                >
                  <Download className="w-3.5 h-3.5 text-gray-600" />
                  <span>Descargar</span>
                </a>
                <a
                  href={previewFoto.url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-[#00603C] hover:bg-[#254731] text-white rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer text-xs"
                >
                  <Eye className="w-3.5 h-3.5 text-[#C9922E]" />
                  <span>Abrir en Pestaña</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewFoto(null)}
                  className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-bold transition cursor-pointer text-xs"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {renderModalEliminarDespacho()}
    </div>
  );
};
