/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Lote, OrdenCarga, LoteOrigenItem, SalidaRegistrada, Chofer, PlantaConfig } from '../types';
import { SalidasList, SalidaUnifiedRow } from './SalidasList';
import { getCampaniaIdFromDate } from '../utils/campanias';
import { LogoSiloLoose } from './Logo';
import { ClienteSelect } from './ClienteSelect';
import { formatNumberArg, formatDateStr } from '../utils/formatters';
import {
  FileText,
  ClipboardList,
  UserCheck,
  Lock,
  UploadCloud,
  Check,
  AlertTriangle,
  Eye,
  Download,
  Loader2,
  Search,
  Calendar,
  User,
  Trash2,
  UserPlus,
  X,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Pin,
  PinOff,
  Pencil,
  Menu,
  RefreshCw,
  Plus,
  RotateCcw,
  CheckCircle,
  PackageCheck,
  Camera,
  ZoomIn,
  MapPin,
  History
} from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { exportWithHtml2Pdf } from '../utils/exportPdf';
import { compressImageFile, compressDataUrl } from '../utils/imageCompression';
import {
  getListaDespachantes,
  addDespachanteAutorizado,
  verifyAutorizadorPassword
} from '../utils/despachantes';
import { ConfirmationDialog } from './ConfirmationDialog';

interface DespachosSectionProps {
  lotes: Lote[];
  ordenes: OrdenCarga[];
  salidas?: SalidaRegistrada[];
  choferes?: Chofer[];
  plantaConfig?: PlantaConfig;
  onSaveOrden: (nuevaOrden: OrdenCarga) => void;
  onUpdateOrdenStatus: (
    ordenId: string,
    nuevoEstado: 'Disponible' | 'Aceptada' | 'Despachada',
    fotoRemito?: string,
    firmaChofer?: string
  ) => void;
  onDespacharStock: (
    loteId: string,
    bolsas: number,
    kg: number,
    ordenId: string
  ) => boolean | Promise<boolean>;
  onDeleteOrden?: (ordenId: string) => void;
  onDeleteMultipleOrdenes?: (ordenIds: string[]) => Promise<void> | void;
  onDeleteDespacho?: (row: SalidaUnifiedRow) => Promise<boolean | void> | boolean | void;
  onDeleteMultipleDespachos?: (rows: SalidaUnifiedRow[]) => Promise<boolean | void> | boolean | void;
  onRefresh?: () => Promise<void> | void;
  initialSubView?: 'generar' | 'mis-ordenes' | 'listado';
  onlyMisOrdenes?: boolean;
}

const LISTA_CLIENTES = ["San Diego Semilla", "Eco Rural", "Pampa", "Stine", "Elementa Foods"];
const LISTA_CATEGORIAS = ["Fundadora", "Preba", "Original", "Primu"];
const LISTA_TIPOS = ["Intermedio", "Final"];
const LISTA_TRATAMIENTOS = ["Tratado", "Sin Tratar"];

export interface LoteCargaSlotItem {
  id: string;
  loteId: string;
  bolsas: number;
  searchTerm: string;
}

export const getLoteUbicacion = (loteObj?: Lote | null, fallbackUbicacion?: string): string => {
  if (fallbackUbicacion && fallbackUbicacion.trim()) return fallbackUbicacion.trim();
  if (!loteObj) return 'Planta General';
  if (loteObj.ubicacionAcopio && loteObj.ubicacionAcopio.trim()) {
    return loteObj.ubicacionAcopio.trim();
  }
  if (loteObj.ala && loteObj.sector) {
    return `Ala ${loteObj.ala} — Sector ${loteObj.sector}`;
  }
  if (loteObj.ala) {
    return `Ala ${loteObj.ala}`;
  }
  return 'Planta General (Acopio Central)';
};

export const DespachosSection: React.FC<DespachosSectionProps> = ({
  lotes,
  ordenes,
  salidas = [],
  choferes = [],
  plantaConfig,
  onSaveOrden,
  onUpdateOrdenStatus,
  onDespacharStock,
  onDeleteOrden,
  onDeleteMultipleOrdenes,
  onDeleteDespacho,
  onDeleteMultipleDespachos,
  onRefresh,
  initialSubView = 'generar',
  onlyMisOrdenes = false,
}) => {
  // 1. Navegación de Sub-vistas y Cortina vertical
  const [subView, setSubView] = useState<'generar' | 'mis-ordenes' | 'listado'>(
    onlyMisOrdenes ? 'mis-ordenes' : initialSubView
  );
  const [listadoTab, setListadoTab] = useState<'ordenes' | 'salidas-historial'>('ordenes');
  const [isNavCortinaOpen, setIsNavCortinaOpen] = useState(false);

  useEffect(() => {
    if (initialSubView) {
      setSubView(initialSubView);
    }
  }, [initialSubView]);

  // Selección múltiple y eliminación de despachos en subview 'listado'
  const [selectedOrdenIds, setSelectedOrdenIds] = useState<Set<string>>(new Set());
  const [ordenesAEliminar, setOrdenesAEliminar] = useState<OrdenCarga[] | null>(null);
  const [isDeletingOrdenes, setIsDeletingOrdenes] = useState(false);

  const toggleSelectOrden = (id: string) => {
    setSelectedOrdenIds(prev => {
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
    setSelectedOrdenIds(new Set());
  };

  // Clave para fijar filtros en Despachos (persistencia hasta ser eliminados manualmente)
  const PIN_STORAGE_KEY_DESPACHOS = 'agroabacus_pinned_despachos_filters_v1';
  const [isFilterPinned, setIsFilterPinned] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('agroabacus_pinned_despachos_filters_v1');
      return saved ? JSON.parse(saved).isPinned === true : false;
    } catch {
      return false;
    }
  });

  // 2. Estados para "Generar orden de carga"
  // Filtros vinculados principales
  const [genCliente, setGenCliente] = useState<string>('San Diego Semilla');
  const [genEspecie, setGenEspecie] = useState<string>('Todos');
  const [genVariedad, setGenVariedad] = useState<string>('Todos');
  const [genCategoria, setGenCategoria] = useState<'Preba' | 'Original' | 'Primu'>('Primu');
  const [genTipo, setGenTipo] = useState<'Intermedio' | 'Final'>('Final');
  const [genTratamiento, setGenTratamiento] = useState<'Tratado' | 'Sin Tratar'>('Sin Tratar');
  const [genTamanoEnvase, setGenTamanoEnvase] = useState<string>('Todos');

  // Estado para refresco manual de lotes desde el dashboard
  const [isUpdatingLotes, setIsUpdatingLotes] = useState(false);
  const [lastUpdatedLotesMsg, setLastUpdatedLotesMsg] = useState<string>('');

  // Lotes agregados al dashboard de "Lote de Origen & Bolsas a Cargar"
  // Precarga por defecto de 35 bolsas (28.000 kg) por lote
  const [lotesCarga, setLotesCarga] = useState<LoteCargaSlotItem[]>([
    { id: 'slot-1', loteId: '', bolsas: 35, searchTerm: '' }
  ]);

  // Lista dinámica de Despachantes
  const [despachantesList, setDespachantesList] = useState<string[]>(() => getListaDespachantes());

  // Estado para visualización de foto adjunta por el despachante en alta resolución
  const [fotoVisualizar, setFotoVisualizar] = useState<{
    url: string;
    titulo: string;
    fecha?: string;
    despachante?: string;
    cliente?: string;
    loteId?: string;
    remitoCliente?: string;
  } | null>(null);

  // Estado Modal "Agregar Despachante Autorizado"
  const [showAddDespModal, setShowAddDespModal] = useState(false);
  const [addDespNombre, setAddDespNombre] = useState('');
  const [addDespAutor, setAddDespAutor] = useState<'Malcon Baez' | 'Amilcar Quiroz'>('Malcon Baez');
  const [addDespClave, setAddDespClave] = useState('');
  const [addDespError, setAddDespError] = useState('');
  const [addDespSuccess, setAddDespSuccess] = useState('');

  const handleAgregarDespachante = (e: React.FormEvent) => {
    e.preventDefault();
    setAddDespError('');
    setAddDespSuccess('');

    if (!addDespNombre.trim()) {
      setAddDespError('Por favor, ingrese el nombre completo del despachante.');
      return;
    }

    if (!addDespClave.trim()) {
      setAddDespError(`Por favor, ingrese la clave de autorización de ${addDespAutor}.`);
      return;
    }

    const esValido = verifyAutorizadorPassword(addDespAutor, addDespClave);
    if (!esValido) {
      setAddDespError(`Clave de autorización incorrecta para el usuario ${addDespAutor}.`);
      return;
    }

    const nuevoNombre = addDespNombre.trim();
    const updatedList = addDespachanteAutorizado(nuevoNombre);
    setDespachantesList(updatedList);
    setGenDespachante(nuevoNombre);
    setLoginDespachante(nuevoNombre);
    
    setAddDespSuccess(`¡Despachante "${nuevoNombre}" autorizado por ${addDespAutor} y agregado con éxito!`);
    setAddDespNombre('');
    setAddDespClave('');

    setTimeout(() => {
      setShowAddDespModal(false);
      setAddDespSuccess('');
    }, 1200);
  };

  const [genDespachante, setGenDespachante] = useState<string>('Anibal Grandolio');
  const [genError, setGenError] = useState('');
  const [genSuccess, setGenSuccess] = useState('');
  const [ultimaOrdenCreada, setUltimaOrdenCreada] = useState<OrdenCarga | null>(null);

  // Panel Generación de Orden de Carga: minimizado por defecto, maximizar para cargar datos
  const [isGenerarOrdenOpen, setIsGenerarOrdenOpen] = useState<boolean>(false);

  // Estados de datos de carga manual (Despacho: Remito, Destino, Chofer)
  const [genRemitoCliente, setGenRemitoCliente] = useState('');
  const [genDestino, setGenDestino] = useState('');
  const [genChofer, setGenChofer] = useState('');

  // Estados para modal de edición de datos de despacho
  const [ordenEditandoDespacho, setOrdenEditandoDespacho] = useState<OrdenCarga | null>(null);
  const [editRemitoCliente, setEditRemitoCliente] = useState('');
  const [editDestino, setEditDestino] = useState('');
  const [editChofer, setEditChofer] = useState('');
  const [editSuccessMsg, setEditSuccessMsg] = useState('');

  // 3. Estados para "Mis órdenes" (Despachante Asignado - Libre Acceso)
  const [despIdentificado, setDespIdentificado] = useState<string | null>(null);
  const [loginDespachante, setLoginDespachante] = useState<string>('Anibal Grandolio');

  // Estados temporales de archivos cargados en sesión
  const [tempFotos, setTempFotos] = useState<Record<string, string>>({});
  const [tempFirmas, setTempFirmas] = useState<Record<string, string>>({});
  const [despachanteError, setDespachanteError] = useState<Record<string, string>>({});

  // Canvas Drawing
  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignedMap, setHasSignedMap] = useState<Record<string, boolean>>({});

  // 4. Estados para "Listado general de Despachos" (Filtros)
  const [filterCliente, setFilterCliente] = useState('');
  const [filterAutor, setFilterAutor] = useState('');
  const [filterDespachante, setFilterDespachante] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterEstadoDespacho, setFilterEstadoDespacho] = useState<'todos' | 'despachado' | 'sindespachar'>('todos');
  const [filterFecha, setFilterFecha] = useState('');
  const [filterRemitoCliente, setFilterRemitoCliente] = useState('');

  // Cargar filtros fijados desde localStorage al montar el componente
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PIN_STORAGE_KEY_DESPACHOS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.isPinned) {
          if (parsed.filterCliente !== undefined) setFilterCliente(parsed.filterCliente);
          if (parsed.filterAutor !== undefined) setFilterAutor(parsed.filterAutor);
          if (parsed.filterDespachante !== undefined) setFilterDespachante(parsed.filterDespachante);
          if (parsed.filterEstado !== undefined) setFilterEstado(parsed.filterEstado);
          if (parsed.filterFecha !== undefined) setFilterFecha(parsed.filterFecha);
          if (parsed.filterRemitoCliente !== undefined) setFilterRemitoCliente(parsed.filterRemitoCliente);
          
          if (parsed.genCliente !== undefined) setGenCliente(parsed.genCliente);
          if (parsed.genEspecie !== undefined) setGenEspecie(parsed.genEspecie);
          if (parsed.genVariedad !== undefined) setGenVariedad(parsed.genVariedad);
          if (parsed.genCategoria !== undefined) setGenCategoria(parsed.genCategoria);
          if (parsed.genTipo !== undefined) setGenTipo(parsed.genTipo);
          if (parsed.genTratamiento !== undefined) setGenTratamiento(parsed.genTratamiento);
          if (parsed.genTamanoEnvase !== undefined) setGenTamanoEnvase(parsed.genTamanoEnvase);

          if (parsed.criteriosCarga && Array.isArray(parsed.criteriosCarga) && parsed.criteriosCarga.length > 0) {
            const b = parsed.criteriosCarga[0];
            if (b.cliente) setGenCliente(b.cliente);
            if (b.categoria) setGenCategoria(b.categoria);
            if (b.tipo) setGenTipo(b.tipo);
            if (b.tratamiento) setGenTratamiento(b.tratamiento);
            if (b.especie) setGenEspecie(b.especie);
            if (b.variedad) setGenVariedad(b.variedad);
            if (b.tamanoEnvase) setGenTamanoEnvase(b.tamanoEnvase);
          }
        }
      }
    } catch (e) {
      console.error('Error restaurando filtros fijados en Despachos:', e);
    }
  }, []);

  // Guardar en localStorage cuando se fija o cuando cambian los filtros estando fijados
  useEffect(() => {
    if (isFilterPinned) {
      const toSave = {
        isPinned: true,
        filterCliente,
        filterAutor,
        filterDespachante,
        filterEstado,
        filterFecha,
        filterRemitoCliente,
        genCliente,
        genCategoria,
        genTipo,
        genTratamiento,
        genEspecie,
        genVariedad,
        genTamanoEnvase,
        criteriosCarga: [{
          cliente: genCliente,
          categoria: genCategoria,
          tipo: genTipo,
          tratamiento: genTratamiento,
          especie: genEspecie,
          variedad: genVariedad,
          tamanoEnvase: genTamanoEnvase
        }]
      };
      localStorage.setItem(PIN_STORAGE_KEY_DESPACHOS, JSON.stringify(toSave));
    } else {
      localStorage.removeItem(PIN_STORAGE_KEY_DESPACHOS);
    }
  }, [
    isFilterPinned,
    filterCliente,
    filterAutor,
    filterDespachante,
    filterEstado,
    filterFecha,
    filterRemitoCliente,
    genCliente,
    genCategoria,
    genTipo,
    genTratamiento,
    genEspecie,
    genVariedad,
    genTamanoEnvase
  ]);

  const handleClearDespachosFilters = () => {
    setFilterCliente('');
    setFilterAutor('');
    setFilterDespachante('');
    setFilterEstado('');
    setFilterEstadoDespacho('todos');
    setFilterFecha('');
    setFilterRemitoCliente('');
  };

  const handleResetAllFilters = () => {
    // 1. Restablecer filtros vinculados de generación de orden
    const defaultCliente = clientesDisponibles.includes('San Diego Semillas')
      ? 'San Diego Semillas'
      : (clientesDisponibles.includes('San Diego Semilla') ? 'San Diego Semilla' : (clientesDisponibles[0] || 'San Diego Semilla'));
    setGenCliente(defaultCliente);
    setGenEspecie('Todos');
    setGenVariedad('Todos');
    setGenCategoria('Primu');
    setGenTipo('Final');
    setGenTratamiento('Sin Tratar');
    setGenTamanoEnvase('Todos');

    // 2. Restablecer lotes slots y datos manuales de carga (precarga por defecto de 35 bolsas / 28.000 kg)
    setLotesCarga([
      { id: `slot-${Date.now()}-1`, loteId: '', bolsas: 35, searchTerm: '' }
    ]);
    setGenRemitoCliente('');
    setGenDestino('');
    setGenChofer('');

    // 3. Restablecer todos los filtros de la tabla de despachos
    setFilterCliente('');
    setFilterAutor('');
    setFilterDespachante('');
    setFilterEstado('');
    setFilterEstadoDespacho('todos');
    setFilterFecha('');
    setFilterRemitoCliente('');

    // 4. Liberar filtros fijados y almacenamiento
    setIsFilterPinned(false);
    try {
      localStorage.removeItem(PIN_STORAGE_KEY_DESPACHOS);
    } catch {
      // ignore
    }
  };

  // Ver comprobante
  const [comprobanteSeleccionado, setComprobanteSeleccionado] = useState<OrdenCarga | null>(null);
  const [isExportingComprobantePdf, setIsExportingComprobantePdf] = useState(false);

  const handleDownloadComprobantePdf = async () => {
    if (!comprobanteSeleccionado) return;
    try {
      setIsExportingComprobantePdf(true);
      const fileName = `Comprobante_Despacho_${comprobanteSeleccionado.id}_${new Date().toISOString().slice(0, 10)}.pdf`;
      await exportWithHtml2Pdf('comprobante-despacho-printable', fileName, {
        scale: 2.0,
        quality: 0.98,
        margin: [8, 8, 8, 8],
      });
    } catch (err) {
      console.error('Error al exportar comprobante de despacho a PDF:', err);
    } finally {
      setIsExportingComprobantePdf(false);
    }
  };

  // Helper para comparar clientes de manera flexible (ej: "San Diego", "San Diego Semilla", "San Diego Semillas")
  const matchClienteHelper = (loteCliente: string, targetCliente: string): boolean => {
    if (!targetCliente || targetCliente === 'Todos') return true;
    const lc = (loteCliente || '').trim().toLowerCase();
    const tc = targetCliente.trim().toLowerCase();
    if (lc === tc) return true;
    if (lc.includes('san diego') && tc.includes('san diego')) return true;
    return lc.includes(tc) || tc.includes(lc);
  };

  // Clientes disponibles con stock o registrados en el sistema
  const clientesDisponibles = useMemo(() => {
    const set = new Set<string>();
    lotes.forEach(l => {
      if (l.cliente && l.cliente.trim()) {
        const norm = (l.cliente === 'San Diego Semilla' || l.cliente === 'San Diego') ? 'San Diego Semillas' : l.cliente.trim();
        set.add(norm);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [lotes]);

  // Especies vinculadas al cliente
  const getEspeciesForCliente = (cliente: string) => {
    const baseLotes = lotes.filter(l => matchClienteHelper(l.cliente, cliente));
    const set = new Set(baseLotes.map(l => l.especie));
    return Array.from(set).filter(Boolean).sort();
  };

  // Variedades vinculadas al cliente y especie
  const getVariedadesForClienteYEspecie = (cliente: string, especie: string) => {
    const baseLotes = lotes.filter(l => {
      const matchCli = matchClienteHelper(l.cliente, cliente);
      const matchEsp = especie === 'Todos' || l.especie === especie;
      return matchCli && matchEsp;
    });
    const set = new Set(baseLotes.map(l => l.variedad?.trim()));
    return Array.from(set).filter(Boolean).sort();
  };

  // Especies vinculadas al cliente seleccionado
  const especiesDisponiblesFiltro = useMemo(() => {
    return getEspeciesForCliente(genCliente);
  }, [genCliente, lotes]);

  // Variedades vinculadas al cliente y especie seleccionados
  const variedadesDisponiblesFiltro = useMemo(() => {
    return getVariedadesForClienteYEspecie(genCliente, genEspecie);
  }, [genCliente, genEspecie, lotes]);

  // Tamaños de envase disponibles vinculados al cliente y especie seleccionados
  const tamanosEnvaseDisponiblesFiltro = useMemo(() => {
    const set = new Set<string>();
    lotes.forEach(l => {
      const matchCli = matchClienteHelper(l.cliente, genCliente);
      const matchEsp = genEspecie === 'Todos' || l.especie === genEspecie;
      if (matchCli && matchEsp && l.kgPorBolsa) {
        set.add(String(l.kgPorBolsa));
      }
    });
    if (set.size === 0) {
      lotes.forEach(l => {
        const matchCli = matchClienteHelper(l.cliente, genCliente);
        if (matchCli && l.kgPorBolsa) set.add(String(l.kgPorBolsa));
      });
    }
    if (set.size === 0) {
      lotes.forEach(l => {
        if (l.kgPorBolsa) set.add(String(l.kgPorBolsa));
      });
    }
    if (set.size === 0) {
      set.add('40');
    }
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [genCliente, genEspecie, lotes]);

  // Lotes que responden exactamente a los filtros vinculados
  const candidateLotes = useMemo(() => {
    return lotes.filter(l => {
      const matchCliente = matchClienteHelper(l.cliente, genCliente);
      const matchCategoria = l.categoria === genCategoria;
      const matchTipo = l.tipo === genTipo;
      const matchTratamiento = l.tratamiento.includes(genTratamiento as any);
      const matchEspecie = genEspecie === 'Todos' || l.especie === genEspecie;
      const matchVariedad = genVariedad === 'Todos' || l.variedad?.trim() === genVariedad;
      const matchTamanoEnvase = genTamanoEnvase === 'Todos' || String(l.kgPorBolsa || 40) === genTamanoEnvase;
      const hasStock = l.stockBolsas > 0;
      const isDisponible = l.estado === 'Disponible';

      return matchCliente && matchCategoria && matchTipo && matchTratamiento && matchEspecie && matchVariedad && matchTamanoEnvase && hasStock && isDisponible;
    });
  }, [lotes, genCliente, genEspecie, genVariedad, genCategoria, genTipo, genTratamiento, genTamanoEnvase]);

  // Función para refrescar y actualizar datos de lotes del sistema según filtros aplicados
  const handleActualizarLotesSistema = async () => {
    setIsUpdatingLotes(true);
    setLastUpdatedLotesMsg('');
    try {
      if (onRefresh) {
        await onRefresh();
      }
      setLastUpdatedLotesMsg('Datos de lotes actualizados con éxito');
      setTimeout(() => {
        setLastUpdatedLotesMsg('');
      }, 3500);
    } catch (err) {
      console.error('Error actualizando lotes del sistema:', err);
    } finally {
      setIsUpdatingLotes(false);
    }
  };

  // Auto-seleccionar primer lote disponible para slot 0 si no tiene lote o el que tiene ya no es candidato
  useEffect(() => {
    if (candidateLotes.length > 0) {
      setLotesCarga(prev => {
        const slot0 = prev[0];
        const isSlot0Valid = candidateLotes.some(c => c.id === slot0?.loteId);
        if (!isSlot0Valid) {
          const next = [...prev];
          next[0] = {
            ...slot0,
            loteId: candidateLotes[0].id,
            bolsas: slot0?.bolsas > 0 ? slot0.bolsas : Math.min(35, candidateLotes[0].stockBolsas)
          };
          return next;
        }
        return prev;
      });
    } else {
      setLotesCarga(prev => {
        if (prev[0]?.loteId) {
          const next = [...prev];
          next[0] = { ...next[0], loteId: '' };
          return next;
        }
        return prev;
      });
    }
  }, [candidateLotes]);

  const handleClienteChange = (newCliente: string) => {
    setGenCliente(newCliente);
    const especies = getEspeciesForCliente(newCliente);
    const nextEspecie = (especies as string[]).includes(genEspecie) ? genEspecie : 'Todos';
    setGenEspecie(nextEspecie);
    const variedades = getVariedadesForClienteYEspecie(newCliente, nextEspecie);
    const nextVariedad = variedades.includes(genVariedad) ? genVariedad : 'Todos';
    setGenVariedad(nextVariedad);
  };

  const handleEspecieChange = (newEspecie: string) => {
    setGenEspecie(newEspecie);
    const variedades = getVariedadesForClienteYEspecie(genCliente, newEspecie);
    if (!variedades.includes(genVariedad)) {
      setGenVariedad('Todos');
    }
  };

  const handleAddLoteSlot = () => {
    const newId = `slot-${Date.now()}-${lotesCarga.length + 1}`;
    const unselected = candidateLotes.find(c => !lotesCarga.some(s => s.loteId === c.id));
    const chosen = unselected || candidateLotes[0];
    setLotesCarga(prev => [
      ...prev,
      {
        id: newId,
        loteId: chosen?.id || '',
        bolsas: chosen ? Math.min(35, chosen.stockBolsas) : 35,
        searchTerm: ''
      }
    ]);
  };

  const handleRemoveLoteSlot = (slotIndex: number) => {
    if (lotesCarga.length <= 1) return;
    setLotesCarga(prev => prev.filter((_, idx) => idx !== slotIndex));
  };

  const handleUpdateLoteSlot = (
    slotIndex: number,
    field: 'loteId' | 'bolsas' | 'searchTerm',
    value: any
  ) => {
    setLotesCarga(prev => prev.map((slot, idx) => {
      if (idx !== slotIndex) return slot;
      if (field === 'loteId') {
        const targetLote = candidateLotes.find(c => c.id === value) || lotes.find(l => l.id === value);
        const defBolsas = slot.bolsas > 0 ? slot.bolsas : (targetLote ? Math.min(35, targetLote.stockBolsas) : 35);
        return { ...slot, loteId: value, bolsas: defBolsas };
      }
      return { ...slot, [field]: value };
    }));
  };

  const handleResetForm = () => {
    handleResetAllFilters();
    setGenError('');
    setGenSuccess('');
  };

  // Cálculo consolidado de todos los lotes seleccionados con bolsas > 0
  const allSelectedSlots = useMemo(() => {
    const list: Array<{
      slotId: string;
      lote: Lote;
      bolsas: number;
      kg: number;
    }> = [];

    lotesCarga.forEach(slot => {
      if (slot.loteId && slot.bolsas > 0) {
        const l = lotes.find(item => item.id === slot.loteId);
        if (l) {
          list.push({
            slotId: slot.id,
            lote: l,
            bolsas: slot.bolsas,
            kg: slot.bolsas * l.kgPorBolsa
          });
        }
      }
    });

    return list;
  }, [lotesCarga, lotes]);

  const totalBolsasSeleccionadas = useMemo(() => {
    return allSelectedSlots.reduce((sum, item) => sum + item.bolsas, 0);
  }, [allSelectedSlots]);

  const totalKgSeleccionados = useMemo(() => {
    return allSelectedSlots.reduce((sum, item) => sum + item.kg, 0);
  }, [allSelectedSlots]);

  const stockInsuficienteAlerta = useMemo(() => {
    return allSelectedSlots.some(item => item.bolsas > item.lote.stockBolsas);
  }, [allSelectedSlots]);

  // Generar Orden de Carga
  const handleGenerarOrden = (e: React.FormEvent) => {
    e.preventDefault();
    setGenError('');
    setGenSuccess('');

    if (allSelectedSlots.length === 0) {
      setGenError('Por favor, configure al menos un lote de origen con cantidad de bolsas mayor a cero.');
      return;
    }

    // Validar stock para cada lote seleccionado
    for (const item of allSelectedSlots) {
      if (item.bolsas > item.lote.stockBolsas) {
        setGenError(`La cantidad solicitada para el Lote ${item.lote.loteNro} (${item.bolsas} bolsas) supera el stock disponible de ${item.lote.stockBolsas} bolsas.`);
        return;
      }
    }

    // Mapear el desglose de lotes de origen incluyendo su ubicación en planta
    const lotesOrigen: LoteOrigenItem[] = allSelectedSlots.map(item => ({
      loteId: item.lote.id,
      loteNro: item.lote.loteNro,
      variedad: item.lote.variedad,
      cantidadBolsas: item.bolsas,
      kgTotales: item.kg,
      ubicacion: getLoteUbicacion(item.lote)
    }));

    const uniqueClientes = Array.from(new Set(allSelectedSlots.map(item => item.lote.cliente)));
    const clienteConsolidado = uniqueClientes.join(' / ');
    const primerLote = allSelectedSlots[0].lote;
    const ubicacionConsolidada = lotesOrigen.map(lo => `${lo.loteNro}: ${lo.ubicacion}`).join(' | ');

    const fechaOrden = new Date().toISOString().split('T')[0];
    // Crear la Orden
    const nuevaOrden: OrdenCarga = {
      id: `OC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      fecha: fechaOrden,
      campaniaId: getCampaniaIdFromDate(fechaOrden),
      cliente: clienteConsolidado,
      loteId: lotesOrigen.map(lo => lo.loteNro).join(', '),
      cantidadBolsas: totalBolsasSeleccionadas,
      kgTotales: totalKgSeleccionados,
      tipo: primerLote.tipo,
      categoria: primerLote.categoria,
      tratamiento: primerLote.tratamiento[0] || 'Sin Tratar',
      despachante: genDespachante,
      estado: 'Disponible',
      lotesOrigen: lotesOrigen,
      ubicacionLote: ubicacionConsolidada,
      remitoCliente: genRemitoCliente.trim() || undefined,
      destino: genDestino.trim() || undefined,
      chofer: genChofer.trim() || undefined
    };

    onSaveOrden(nuevaOrden);
    setGenSuccess('orden creada correctamente');
    setUltimaOrdenCreada(nuevaOrden);

    // Reestablecer los datos del dashboard para crear nueva orden
    handleResetAllFilters();

    // Minimizar panel tras generar la orden
    setIsGenerarOrdenOpen(false);

    // Scroll suave hacia la leyenda para visibilidad inmediata
    setTimeout(() => {
      const banner = document.getElementById('banner-orden-creada-correctamente');
      if (banner) {
        banner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 80);
  };

  // Apertura y guardado de edición de datos de despacho
  const handleOpenEditDespacho = (orden: OrdenCarga) => {
    setOrdenEditandoDespacho(orden);
    setEditRemitoCliente(orden.remitoCliente || '');
    setEditDestino(orden.destino || '');
    setEditChofer(orden.chofer || '');
    setEditSuccessMsg('');
  };

  const handleGuardarEditDespacho = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ordenEditandoDespacho) return;

    const ordenActualizada: OrdenCarga = {
      ...ordenEditandoDespacho,
      remitoCliente: editRemitoCliente.trim() || undefined,
      destino: editDestino.trim() || undefined,
      chofer: editChofer.trim() || undefined,
    };

    onSaveOrden(ordenActualizada);
    setEditSuccessMsg('Datos de despacho actualizados con éxito.');
    setTimeout(() => {
      setOrdenEditandoDespacho(null);
      setEditSuccessMsg('');
    }, 900);
  };

  // Upload de Remito (Foto)
  const handleFotoUpload = async (ordenId: string, file: File) => {
    setDespachanteError(prev => ({ ...prev, [ordenId]: '' }));

    if (file.size > 25 * 1024 * 1024) {
      setDespachanteError(prev => ({ ...prev, [ordenId]: 'La imagen es demasiado pesada. El límite es de 25 MB.' }));
      return;
    }

    try {
      // Comprimir de inmediato la imagen a tamaño óptimo (< 250 KB)
      const compressedDataUrl = await compressImageFile(file);
      setTempFotos(prev => ({ ...prev, [ordenId]: compressedDataUrl }));
    } catch (err) {
      console.error('Error al procesar foto del remito:', err);
      // Fallback a lectura convencional si la compresión tuviera algún problema
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === 'string') {
          setTempFotos(prev => ({ ...prev, [ordenId]: result }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Firma Digital - Inicializar contexto
  const getCanvasCoordinates = (ordenId: string, e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRefs.current[ordenId];
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (ordenId: string, e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRefs.current[ordenId];
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCanvasCoordinates(ordenId, e);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#00603C';
    setIsDrawing(true);
  };

  const draw = (ordenId: string, e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRefs.current[ordenId];
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCanvasCoordinates(ordenId, e);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();

    if (!hasSignedMap[ordenId]) {
      setHasSignedMap(prev => ({ ...prev, [ordenId]: true }));
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = (ordenId: string) => {
    const canvas = canvasRefs.current[ordenId];
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    setHasSignedMap(prev => ({ ...prev, [ordenId]: false }));
    setTempFirmas(prev => {
      const next = { ...prev };
      delete next[ordenId];
      return next;
    });
  };

  const saveSignature = (ordenId: string) => {
    const canvas = canvasRefs.current[ordenId];
    if (canvas && hasSignedMap[ordenId]) {
      const dataUrl = canvas.toDataURL('image/png');
      setTempFirmas(prev => ({ ...prev, [ordenId]: dataUrl }));
    }
  };

  // Estado para controlar en Mis Órdenes (Playa) si se activa el check para descontar stock
  const [descontarStockChecked, setDescontarStockChecked] = useState<Record<string, boolean>>({});
  const [bajaStockLoading, setBajaStockLoading] = useState<Record<string, boolean>>({});
  const [bajaStockFeedback, setBajaStockFeedback] = useState<{ ordenId: string; msg: string; type: 'success' | 'error' } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isConfirmingMap, setIsConfirmingMap] = useState<Record<string, boolean>>({});
  const [confirmedLocally, setConfirmedLocally] = useState<Record<string, boolean>>({});
  const [despachoExitoMsg, setDespachoExitoMsg] = useState<string | null>(null);

  // Manejador del botón Actualizar
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (onRefresh) {
        await onRefresh();
      }
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  // Manejador del Botón "Despachado" (al activarse marca salida con la cantidad de bolsas utilizadas del stock del lote)
  const handleToggleBajaStock = async (orden: OrdenCarga) => {
    if (orden.stockDescontado) {
      alert(`La orden ${orden.id} ya fue despachada y se descontaron sus ${orden.cantidadBolsas} bolsas (${formatNumberArg(orden.kgTotales, 0)} kg) del Lote ${orden.loteId}.`);
      return;
    }

    const confirmar = window.confirm(
      `¿Confirmar salida por despacho de stock?\n\n` +
      `• N° Orden: ${orden.id}\n` +
      `• Lote de Origen: ${orden.loteId}\n` +
      `• Cantidad de Bolsas a descontar: ${orden.cantidadBolsas} bolsas (${formatNumberArg(orden.kgTotales, 0)} kg)\n\n` +
      `Al presionar Aceptar, se marcará la salida y se descontará del stock del lote utilizado.`
    );

    if (!confirmar) return;

    setBajaStockLoading(prev => ({ ...prev, [orden.id]: true }));
    try {
      const exito = await onDespacharStock(orden.loteId, orden.cantidadBolsas, orden.kgTotales, orden.id);
      if (exito) {
        try {
          await updateDoc(doc(db, 'ordenesCarga', orden.id), {
            stockDescontado: true,
            fechaBajaStock: new Date().toISOString(),
            ...(orden.estado !== 'Despachada' ? { estado: 'Despachada' } : {})
          });
        } catch (eDoc) {
          console.warn('Error al actualizar Firestore ordenesCarga:', eDoc);
        }
        orden.stockDescontado = true;
        orden.fechaBajaStock = new Date().toISOString();
        if (orden.estado !== 'Despachada') {
          orden.estado = 'Despachada';
          if (onUpdateOrdenStatus) {
            onUpdateOrdenStatus(orden.id, 'Despachada');
          }
        }
        setBajaStockFeedback({
          ordenId: orden.id,
          msg: `¡Despacho registrado con éxito! Se marcó la salida de ${orden.cantidadBolsas} bolsas (${formatNumberArg(orden.kgTotales, 0)} kg) del stock del Lote ${orden.loteId}.`,
          type: 'success'
        });
        setTimeout(() => setBajaStockFeedback(null), 5000);
      } else {
        setBajaStockFeedback({
          ordenId: orden.id,
          msg: `No se pudo marcar la salida: saldo insuficiente en el lote o lote no disponible.`,
          type: 'error'
        });
        setTimeout(() => setBajaStockFeedback(null), 6000);
      }
    } catch (err) {
      console.error('Error al dar de baja stock:', err);
      setBajaStockFeedback({
        ordenId: orden.id,
        msg: 'Error al procesar la salida en el servidor.',
        type: 'error'
      });
      setTimeout(() => setBajaStockFeedback(null), 5000);
    } finally {
      setBajaStockLoading(prev => ({ ...prev, [orden.id]: false }));
    }
  };

  // Confirmación final del despacho (Mis Órdenes - Playa)
  const handleConfirmarDespacho = async (orden: OrdenCarga) => {
    setDespachanteError(prev => ({ ...prev, [orden.id]: '' }));
    
    const rawFoto = tempFotos[orden.id] || orden.fotoRemito;

    if (!rawFoto) {
      setDespachanteError(prev => ({ ...prev, [orden.id]: 'Por favor, adjunte la fotografía del remito de salida para habilitar la confirmación.' }));
      return;
    }

    // Bloquear y retirar de inmediato la orden del panel de pendientes de playa
    setIsConfirmingMap(prev => ({ ...prev, [orden.id]: true }));
    setConfirmedLocally(prev => ({ ...prev, [orden.id]: true }));

    try {
      // Garantizar que la foto esté optimizada y no exceda límites de tamaño
      const safeFoto = await compressDataUrl(rawFoto);

      // Al confirmar despacho en este punto: NO afectar el stock del lote cargado
      await onUpdateOrdenStatus(orden.id, 'Despachada', safeFoto);
      setDespachoExitoMsg(`¡Despacho de la orden ${orden.id} confirmado con éxito! La orden quedó registrada y archivada.`);
      setTimeout(() => {
        setDespachoExitoMsg(null);
      }, 6000);
    } catch (err) {
      console.error('Error al confirmar despacho:', err);
      setDespachanteError(prev => ({ ...prev, [orden.id]: 'Ocurrió un error al procesar el despacho. Por favor, reintente.' }));
      // Restaurar visibilidad local en caso de error
      setConfirmedLocally(prev => {
        const next = { ...prev };
        delete next[orden.id];
        return next;
      });
    } finally {
      setIsConfirmingMap(prev => ({ ...prev, [orden.id]: false }));
    }
  };

  // Filtrado de listado general de despachos
  const filteredOrdenes = ordenes.filter(o => {
    const searchRemito = filterRemitoCliente.trim().toLowerCase();
    const remitoVal = (o.remitoCliente || '').toLowerCase();
    const matchRemito = searchRemito === '' || remitoVal.includes(searchRemito);

    const matchCliente = filterCliente === '' || o.cliente.toLowerCase().includes(filterCliente.toLowerCase());
    const matchAutor = filterAutor === '' || o.autor.toLowerCase().includes(filterAutor.toLowerCase());
    const matchDespachante = filterDespachante === '' || o.despachante === filterDespachante;
    const matchEstado = filterEstado === '' || o.estado === filterEstado;
    const matchEstadoDespacho =
      filterEstadoDespacho === 'todos' ||
      (filterEstadoDespacho === 'despachado' ? Boolean(o.stockDescontado) : !o.stockDescontado);
    const matchFecha = filterFecha === '' || o.fecha === filterFecha;

    return matchRemito && matchCliente && matchAutor && matchDespachante && matchEstado && matchEstadoDespacho && matchFecha;
  });

  // Selección múltiple y totales calculados para la vista de Salidas (Listado de Despachos)
  const selectedOrdenes = useMemo(() => {
    return filteredOrdenes.filter(o => selectedOrdenIds.has(o.id));
  }, [filteredOrdenes, selectedOrdenIds]);

  const isAllVisibleSelected =
    filteredOrdenes.length > 0 && filteredOrdenes.every(o => selectedOrdenIds.has(o.id));
  const isSomeVisibleSelected =
    filteredOrdenes.some(o => selectedOrdenIds.has(o.id)) && !isAllVisibleSelected;

  const toggleSelectAllVisible = () => {
    if (isAllVisibleSelected) {
      setSelectedOrdenIds(prev => {
        const next = new Set(prev);
        filteredOrdenes.forEach(o => next.delete(o.id));
        return next;
      });
    } else {
      setSelectedOrdenIds(prev => {
        const next = new Set(prev);
        filteredOrdenes.forEach(o => next.add(o.id));
        return next;
      });
    }
  };

  const summaryTotals = useMemo(() => {
    const totalBolsas = filteredOrdenes.reduce((acc, curr) => acc + (curr.cantidadBolsas || 0), 0);
    const totalKg = filteredOrdenes.reduce((acc, curr) => acc + (curr.kgTotales || 0), 0);
    const despachadosCount = filteredOrdenes.filter(o => o.stockDescontado).length;
    const pendientesCount = filteredOrdenes.length - despachadosCount;
    return {
      totalBolsas,
      totalKg,
      count: filteredOrdenes.length,
      despachadosCount,
      pendientesCount
    };
  }, [filteredOrdenes]);

  const handleConfirmarEliminarOrdenes = async () => {
    if (!ordenesAEliminar || ordenesAEliminar.length === 0) return;
    try {
      setIsDeletingOrdenes(true);
      const idsToDelete = ordenesAEliminar.map(o => o.id);

      if (onDeleteMultipleOrdenes) {
        await onDeleteMultipleOrdenes(idsToDelete);
      } else if (onDeleteOrden) {
        for (const id of idsToDelete) {
          await onDeleteOrden(id);
        }
      }

      // Cerrar comprobante modal si fue eliminado
      if (comprobanteSeleccionado && idsToDelete.includes(comprobanteSeleccionado.id)) {
        setComprobanteSeleccionado(null);
      }

      // Quitar de los seleccionados
      setSelectedOrdenIds(prev => {
        const next = new Set(prev);
        idsToDelete.forEach(id => next.delete(id));
        return next;
      });

      setOrdenesAEliminar(null);
    } catch (err) {
      console.error('Error al confirmar eliminación de despachos/órdenes:', err);
    } finally {
      setIsDeletingOrdenes(false);
    }
  };

  const renderModalEliminarDespachos = () => {
    if (!ordenesAEliminar || ordenesAEliminar.length === 0) return null;
    const isMultiple = ordenesAEliminar.length > 1;
    const single = ordenesAEliminar[0];
    const totalBolsas = ordenesAEliminar.reduce((acc, curr) => acc + (curr.cantidadBolsas || 0), 0);
    const totalKg = ordenesAEliminar.reduce((acc, curr) => acc + (curr.kgTotales || 0), 0);

    // Obtener lotes afectados (soportando tanto loteId como lotesOrigen)
    const lotesAfectadosSet = new Set<string>();
    ordenesAEliminar.forEach(o => {
      if (o.lotesOrigen && o.lotesOrigen.length > 0) {
        o.lotesOrigen.forEach(lo => {
          if (lo.loteNro) lotesAfectadosSet.add(`L-${lo.loteNro}`);
          else if (lo.loteId) lotesAfectadosSet.add(`L-${lo.loteId}`);
        });
      } else if (o.loteId) {
        lotesAfectadosSet.add(`L-${o.loteId}`);
      }
    });
    const lotesAfectados = Array.from(lotesAfectadosSet).filter(Boolean);

    return (
      <ConfirmationDialog
        isOpen={!!ordenesAEliminar && ordenesAEliminar.length > 0}
        title={
          !isMultiple
            ? `Eliminar Despacho ${single.remitoCliente ? `Remito ${single.remitoCliente}` : `Orden N° ${single.id}`}`
            : `Eliminar ${ordenesAEliminar.length} Despachos Seleccionados`
        }
        variant="danger"
        confirmText={
          !isMultiple ? 'Eliminar Despacho' : `Eliminar ${ordenesAEliminar.length} Despachos`
        }
        cancelText="Cancelar"
        requireConfirmationText="eliminar despacho"
        confirmationPlaceholder='Escriba "eliminar despacho"'
        isLoading={isDeletingOrdenes}
        onClose={() => {
          if (!isDeletingOrdenes) setOrdenesAEliminar(null);
        }}
        onConfirm={handleConfirmarEliminarOrdenes}
      >
        <div className="space-y-3.5">
          {!isMultiple ? (
            <div className="bg-rose-50/70 rounded-xl border border-rose-100 p-3.5 space-y-2 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-slate-700">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">N° Orden</span>
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
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Cliente Comitente</span>
                  <span className="font-bold text-slate-900 truncate block">{single.cliente}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Lote Origen</span>
                  <span className="font-mono font-bold text-slate-800">
                    {single.lotesOrigen && single.lotesOrigen.length > 0
                      ? single.lotesOrigen.map(l => (l.loteNro ? `L-${l.loteNro}` : `L-${l.loteId}`)).join(', ')
                      : `L-${single.loteId}`}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Estado Despacho</span>
                  <span className="font-bold text-xs">
                    {single.stockDescontado ? (
                      <span className="text-emerald-700">Despachado</span>
                    ) : (
                      <span className="text-rose-700">Sin despachar</span>
                    )}
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
                    {formatNumberArg(single.kgTotales, 0)} kg
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Despachante / Chofer</span>
                  <span className="font-medium text-slate-800 truncate block">
                    {single.despachante || single.chofer || '—'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-rose-50/80 rounded-xl border border-rose-200/80 p-3.5 space-y-2 text-xs">
                <div className="grid grid-cols-3 gap-2 text-slate-700">
                  <div className="bg-white/80 p-2 rounded-lg border border-rose-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Despachos a eliminar</span>
                    <span className="font-mono font-bold text-base text-rose-700">{ordenesAEliminar.length}</span>
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
                    {lotesAfectados.map((loteStr) => (
                      <span
                        key={loteStr}
                        className="px-2 py-0.5 rounded bg-white font-mono font-bold text-[11px] text-[#00603C] border border-emerald-200"
                      >
                        {loteStr}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Lista compacta de despachos a eliminar */}
              <div className="border border-slate-200 rounded-xl p-2.5 max-h-40 overflow-y-auto divide-y divide-slate-100 bg-slate-50/50 text-[11px]">
                {ordenesAEliminar.map((o, i) => (
                  <div key={o.id || i} className="py-1.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono font-bold text-[#00603C] shrink-0">
                        {o.remitoCliente ? `Remito ${o.remitoCliente}` : o.id}
                      </span>
                      <span className="text-slate-700 truncate font-medium">{o.cliente}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
                      <span className="text-slate-500 font-semibold">
                        {o.lotesOrigen && o.lotesOrigen.length > 0
                          ? o.lotesOrigen.map(l => (l.loteNro ? `L-${l.loteNro}` : `L-${l.loteId}`)).join(', ')
                          : `L-${o.loteId}`}
                      </span>
                      <span className="font-bold text-rose-700">+{formatNumberArg(o.cantidadBolsas, 0)} b.</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-950">Acción irreversible con reintegro de stock</p>
              <p className="text-amber-800 leading-relaxed">
                {!isMultiple ? (
                  <>
                    Al confirmar la eliminación de este despacho, el comprobante se dará de baja definitivamente
                    {single.stockDescontado ? (
                      <>
                        {' '}y se reintegrará el stock de{' '}
                        <strong className="font-bold text-amber-950">
                          {formatNumberArg(single.cantidadBolsas, 0)} bolsas ({formatNumberArg(single.kgTotales, 0)} kg)
                        </strong>{' '}
                        al lote correspondiente.
                      </>
                    ) : (
                      ' (sin stock descontado a reintegrar).'
                    )}
                  </>
                ) : (
                  <>
                    Al confirmar la eliminación masiva, se cancelarán los{' '}
                    <strong className="font-bold text-amber-950">{ordenesAEliminar.length} despachos</strong> seleccionados y se reintegrará automáticamente el stock de{' '}
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

  return (
    <div className="space-y-6 relative" id="modulo-despachos-root">
      
      {/* Marca de agua muy sutil */}
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.04] pointer-events-none z-0 overflow-hidden">
        <LogoSiloLoose size={450} color="#00603C" />
      </div>

      {/* CABECERA: TÍTULO CENTRADO CON TAMAÑO ENGRANDECIDO Y BOTONES POR DEBAJO CON CORTINA VERTICAL */}
      {!onlyMisOrdenes ? (
        <div className="border-b border-gray-200 pb-6 flex flex-col items-center justify-center text-center gap-4 relative z-10">
          {/* TÍTULO CENTRADO Y AGRANDADO */}
          <div className="max-w-3xl mx-auto text-center space-y-1">
            <span className="text-xs sm:text-sm font-sans font-black tracking-widest text-[#00603C] uppercase block">
              SISTEMA DE DESPACHOS Y EXPEDICIÓN
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-black text-[#1A1A1A] tracking-tight leading-tight">
              Playa de Carga — Agro Abacus S.A.
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              Control logístico, generación de órdenes de retiro y monitoreo en tiempo real
            </p>
          </div>

          {/* BOTONES UBICADOS POR DEBAJO DEL TÍTULO: SOLO MENÚ CORTINA PARA 1, 2 Y 3 */}
          <div className="w-full flex flex-col items-center gap-3">
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              {/* Botón de Menú en Cortina exclusivo para opciones 1, 2 y 3 */}
              <button
                type="button"
                id="btn-menu-cortina-despachos"
                onClick={() => setIsNavCortinaOpen(prev => !prev)}
                className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl border text-xs font-sans font-bold uppercase tracking-wider transition shadow-xs cursor-pointer ${
                  isNavCortinaOpen
                    ? 'bg-[#00603C] text-white border-[#00603C] ring-2 ring-emerald-300'
                    : 'bg-white hover:bg-emerald-50/70 border-emerald-300 text-[#00603C]'
                }`}
                title="Desplegar menú en cortina para seleccionar 1. Crear Orden, 2. Mis Órdenes o Despachos"
              >
                <Menu className="w-4 h-4 text-[#C9922E]" />
                <span>
                  {subView === 'generar' && '1. Crear Orden'}
                  {subView === 'mis-ordenes' && '2. Mis Órdenes (Playa)'}
                  {subView === 'listado' && 'Despachos'}
                </span>
                {isNavCortinaOpen ? (
                  <ChevronUp className="w-4 h-4 text-[#C9922E]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                )}
              </button>

              <button
                onClick={() => {
                  setAddDespError('');
                  setAddDespSuccess('');
                  setShowAddDespModal(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-[#00603C] hover:bg-[#254731] text-white text-xs font-sans font-bold uppercase tracking-wider rounded-xl shadow-xs transition cursor-pointer"
                title="Agregar despachante autorizado con usuario y clave de Malcon Baez o Amilcar Quiroz"
              >
                <UserPlus className="w-4 h-4 text-[#F6EFDC]" />
                <span>+ Agregar Despachante</span>
              </button>
            </div>

            {/* CORTINA VERTICAL DESPLEGABLE */}
            {isNavCortinaOpen && (
              <div className="w-full max-w-xl bg-white rounded-2xl border border-emerald-200 p-3 shadow-lg transition-all animate-in slide-in-from-top duration-200 space-y-2 text-left">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100 px-2">
                  <span className="text-[11px] font-black text-emerald-900 uppercase tracking-wider">
                    Menú Cortina — Seleccionar Vista
                  </span>
                  <span className="text-[10px] text-gray-400 font-medium">Haga clic en una opción</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSubView('generar');
                      setIsNavCortinaOpen(false);
                    }}
                    className={`p-3 rounded-xl border transition flex items-center justify-between cursor-pointer ${
                      subView === 'generar'
                        ? 'bg-[#00603C] text-white border-[#00603C] shadow-md font-bold'
                        : 'bg-slate-50 hover:bg-emerald-50/60 border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <ClipboardList className={`w-5 h-5 ${subView === 'generar' ? 'text-amber-300' : 'text-emerald-700'}`} />
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wide">1. Crear Orden</div>
                        <div className={`text-[11px] ${subView === 'generar' ? 'text-emerald-100' : 'text-slate-500'}`}>
                          Generar nueva orden de carga para camiones y transportistas
                        </div>
                      </div>
                    </div>
                    {subView === 'generar' && <Check className="w-4 h-4 text-amber-300" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSubView('mis-ordenes');
                      setIsNavCortinaOpen(false);
                    }}
                    className={`p-3 rounded-xl border transition flex items-center justify-between cursor-pointer ${
                      subView === 'mis-ordenes'
                        ? 'bg-[#00603C] text-white border-[#00603C] shadow-md font-bold'
                        : 'bg-slate-50 hover:bg-emerald-50/60 border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <UserCheck className={`w-5 h-5 ${subView === 'mis-ordenes' ? 'text-amber-300' : 'text-emerald-700'}`} />
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wide">2. Mis Órdenes (Playa)</div>
                        <div className={`text-[11px] ${subView === 'mis-ordenes' ? 'text-emerald-100' : 'text-slate-500'}`}>
                          Órdenes activas para recepción, foto de remito y despacho en playa
                        </div>
                      </div>
                    </div>
                    {subView === 'mis-ordenes' && <Check className="w-4 h-4 text-amber-300" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSubView('listado');
                      setIsNavCortinaOpen(false);
                    }}
                    className={`p-3 rounded-xl border transition flex items-center justify-between cursor-pointer ${
                      subView === 'listado'
                        ? 'bg-[#00603C] text-white border-[#00603C] shadow-md font-bold'
                        : 'bg-slate-50 hover:bg-emerald-50/60 border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <FileText className={`w-5 h-5 ${subView === 'listado' ? 'text-amber-300' : 'text-emerald-700'}`} />
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wide">Despachos</div>
                        <div className={`text-[11px] ${subView === 'listado' ? 'text-emerald-100' : 'text-slate-500'}`}>
                          Historial unificado de salidas, remitos y control de carga en planta
                        </div>
                      </div>
                    </div>
                    {subView === 'listado' && <Check className="w-4 h-4 text-amber-300" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* CONTENIDO DE LAS SUBVISTAS */}
      <div className="relative z-10">
        
        {/* A) GENERAR ORDEN DE CARGA */}
        {subView === 'generar' && (
          <div className="space-y-6">
            
            {/* Banner de Confirmación de Orden Creada (visible aún con panel minimizado) */}
            {genSuccess && (
              <div
                id="banner-orden-creada-correctamente"
                className="p-4 sm:p-5 bg-[#bef264]/40 backdrop-blur-md border-2 border-[#84cc16] rounded-2xl text-[#14532d] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300"
              >
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="w-11 h-11 rounded-full bg-[#65a30d] text-white flex items-center justify-center shrink-0 shadow-sm ring-4 ring-[#bef264]/60">
                    <Check className="w-6 h-6 stroke-[3]" />
                  </div>
                  <div>
                    <div className="text-base sm:text-lg font-black tracking-wide uppercase text-[#14532d] flex items-center gap-2">
                      <span>orden creada correctamente</span>
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#65a30d] animate-ping" />
                    </div>
                    <div className="text-xs text-[#166534] font-medium mt-1">
                      {ultimaOrdenCreada ? (
                        <>
                          Se registró la orden <strong className="font-mono text-[#14532d] font-bold">{ultimaOrdenCreada.id}</strong> para <strong>{ultimaOrdenCreada.cliente}</strong> ({ultimaOrdenCreada.cantidadBolsas} bolsas · {formatNumberArg(ultimaOrdenCreada.kgTotales, 0)} kg). El panel ha sido minimizado para continuar con la operativa de planta.
                        </>
                      ) : (
                        'La orden fue creada exitosamente. El panel ha sido minimizado.'
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => {
                      setGenSuccess('');
                      setUltimaOrdenCreada(null);
                    }}
                    className="px-3.5 py-1.5 bg-white/90 hover:bg-white text-[#14532d] text-xs font-bold uppercase tracking-wider rounded-xl border border-[#84cc16] shadow-2xs transition cursor-pointer"
                  >
                    Aceptar
                  </button>
                </div>
              </div>
            )}

            {/* Panel Principal: Generación de Orden de Carga (Minimizado por defecto) */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-200">
              
              {/* Encabezado con Botón Desplegable */}
              <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-900/5 via-white to-amber-50/25 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#00603C] text-white flex items-center justify-center shadow-xs shrink-0">
                    <ClipboardList className="w-5 h-5 text-amber-300" />
                  </div>
                  <div>
                    <span className="text-[10px] font-sans font-bold tracking-widest text-[#C9922E] uppercase block">
                      OFICINA DE PLANTA / ADMINISTRATIVO
                    </span>
                    <h3 className="font-serif text-lg sm:text-xl font-bold text-[#1A1A1A] flex items-center gap-2">
                      <span>Generación de Orden de Carga</span>
                      {!isGenerarOrdenOpen && (
                        <span className="text-[10px] font-sans font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-wider hidden sm:inline-block">
                          Minimizado
                        </span>
                      )}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isGenerarOrdenOpen && (
                    <button
                      type="button"
                      onClick={handleResetForm}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 shadow-2xs"
                      title="Limpiar formulario y restablecer valores por defecto"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-gray-500" />
                      <span>Limpiar Formulario</span>
                    </button>
                  )}

                  {/* Botón Desplegable para Maximizar / Minimizar */}
                  <button
                    type="button"
                    onClick={() => setIsGenerarOrdenOpen(prev => !prev)}
                    className={`px-4 py-2 text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-2 cursor-pointer ${
                      isGenerarOrdenOpen
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                        : 'bg-[#00603C] hover:bg-[#004D30] text-white border border-[#00603C]'
                    }`}
                    title={isGenerarOrdenOpen ? "Minimizar panel de carga de datos" : "Desplegar para cargar datos de la orden"}
                  >
                    {isGenerarOrdenOpen ? (
                      <>
                        <ChevronUp className="w-4 h-4 text-slate-600" />
                        <span>Minimizar Panel</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4 text-amber-300 stroke-[2.5]" />
                        <span>Cargar Datos / Desplegar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Vista Minimizada (Por Defecto) */}
              {!isGenerarOrdenOpen && (
                <div className="p-5 md:p-6 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-800 flex items-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-full bg-[#C9922E]" />
                      Panel minimizado por defecto
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Haga clic en <strong>"Cargar Datos / Desplegar"</strong> cuando necesite generar una nueva orden de carga para camiones. Una vez generada la orden, el panel volverá a minimizarse automáticamente.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsGenerarOrdenOpen(true)}
                    className="self-start sm:self-center px-4 py-2 bg-white hover:bg-emerald-50 text-[#00603C] border border-[#00603C]/40 rounded-xl font-bold shadow-2xs transition flex items-center gap-2 cursor-pointer text-xs shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#00603C]" />
                    <span>Cargar Datos de Orden</span>
                  </button>
                </div>
              )}

              {/* Vista Maximizada (Formulario) */}
              {isGenerarOrdenOpen && (
                <div className="p-6 md:p-8 space-y-6">
                  {genError && (
                    <div className="p-4 bg-[#F5E5DC] border-l-4 border-[#A0522D] rounded-r-xl text-xs text-[#A0522D] flex items-start gap-2 animate-in fade-in">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Error:</span> {genError}
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleGenerarOrden} className="space-y-6">
                    
                    {/* FILTROS PRINCIPALES Y VINCULADOS: CLIENTE PRINCIPAL ARRIBA Y ATRIBUTOS AGRUPADOS POR DEBAJO */}
                    <div className="bg-[#FAFBF9] p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-200">
                        <div>
                          <span className="text-[10px] font-sans font-bold tracking-widest text-[#00603C] uppercase block">
                            Filtros Vinculados de Selección
                          </span>
                          <p className="text-[11px] text-gray-500">
                            Filtro principal por Cliente, con los filtros vinculados (especie, variedad, categoría, tipo y tratamiento) agrupados por debajo.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIsFilterPinned(prev => !prev)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                              isFilterPinned
                                ? 'bg-[#00603C] text-white shadow-xs ring-1 ring-emerald-400'
                                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                            }`}
                            title={isFilterPinned ? "Filtros fijados (solo se quitan manualmente)" : "Fijar filtros para que se conserven al recargar o generar"}
                          >
                            {isFilterPinned ? <Pin className="w-3.5 h-3.5 text-amber-300 fill-amber-300" /> : <PinOff className="w-3.5 h-3.5 text-gray-400" />}
                            <span>{isFilterPinned ? 'Filtros Fijados' : 'Fijar Filtros'}</span>
                          </button>
                        </div>
                      </div>

                      {/* 1. FILTRO PRINCIPAL: CLIENTE (ARRIBA) */}
                      <div className="bg-white p-4 rounded-xl border border-emerald-900/15 shadow-2xs space-y-1.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                          <label className="block text-[11px] font-black text-[#00603C] uppercase tracking-wide flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-[#C9922E]" />
                            <span>Filtro Principal: Cliente *</span>
                          </label>
                          <span className="text-[10px] text-gray-400">
                            Determina las especies, variedades y lotes con stock disponibles
                          </span>
                        </div>
                        <select
                          value={genCliente}
                          onChange={(e) => handleClienteChange(e.target.value)}
                          className="w-full h-10 px-3.5 bg-[#FAFBF9] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00603C] font-bold text-slate-900 text-xs shadow-2xs"
                        >
                          {clientesDisponibles.map(cli => (
                            <option key={cli} value={cli}>{cli}</option>
                          ))}
                        </select>
                      </div>

                      {/* 2. FILTROS VINCULADOS AGRUPADOS POR DEBAJO DEL CLIENTE: Especie, Variedad, Categoría, Tipo, Tratamiento y Tamaño de Envase */}
                      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs space-y-3">
                        <div className="flex items-center justify-between pb-1.5 border-b border-gray-100">
                          <span className="text-[10px] font-black uppercase tracking-wider text-[#00603C]">
                            Filtros agrupados por debajo de Cliente ({genCliente})
                          </span>
                          <span className="text-[10px] text-gray-400">
                            6 atributos de clasificación vinculados
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                          {/* Especie */}
                          <div>
                            <label className="block text-[10px] font-bold text-gray-700 uppercase mb-1">
                              Especie
                            </label>
                            <select
                              value={genEspecie}
                              onChange={(e) => handleEspecieChange(e.target.value)}
                              className="w-full h-9 px-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00603C] text-xs font-medium"
                            >
                              <option value="Todos">Todas las especies</option>
                              {especiesDisponiblesFiltro.map(esp => (
                                <option key={esp} value={esp}>{esp}</option>
                              ))}
                            </select>
                            <span className="text-[10px] text-gray-400 mt-0.5 block truncate">
                              {especiesDisponiblesFiltro.length} vinc.
                            </span>
                          </div>

                          {/* Variedad */}
                          <div>
                            <label className="block text-[10px] font-bold text-gray-700 uppercase mb-1">
                              Variedad
                            </label>
                            <select
                              value={genVariedad}
                              onChange={(e) => setGenVariedad(e.target.value)}
                              className="w-full h-9 px-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00603C] text-xs font-medium"
                            >
                              <option value="Todos">Todas las variedades</option>
                              {variedadesDisponiblesFiltro.map(v => (
                                <option key={v} value={v}>{v}</option>
                              ))}
                            </select>
                            <span className="text-[10px] text-gray-400 mt-0.5 block truncate">
                              {variedadesDisponiblesFiltro.length} disponibles
                            </span>
                          </div>

                          {/* Categoría */}
                          <div>
                            <label className="block text-[10px] font-bold text-gray-700 uppercase mb-1">
                              Categoría *
                            </label>
                            <select
                              value={genCategoria}
                              onChange={(e) => setGenCategoria(e.target.value as any)}
                              className="w-full h-9 px-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00603C] text-xs font-medium"
                            >
                              {LISTA_CATEGORIAS.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          </div>

                          {/* Tipo */}
                          <div>
                            <label className="block text-[10px] font-bold text-gray-700 uppercase mb-1">
                              Tipo *
                            </label>
                            <select
                              value={genTipo}
                              onChange={(e) => setGenTipo(e.target.value as any)}
                              className="w-full h-9 px-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00603C] text-xs font-medium"
                            >
                              {LISTA_TIPOS.map(t => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                          </div>

                          {/* Tratamiento */}
                          <div>
                            <label className="block text-[10px] font-bold text-gray-700 uppercase mb-1">
                              Tratamiento *
                            </label>
                            <select
                              value={genTratamiento}
                              onChange={(e) => setGenTratamiento(e.target.value as any)}
                              className="w-full h-9 px-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00603C] text-xs font-medium"
                            >
                              {LISTA_TRATAMIENTOS.map(tr => (
                                <option key={tr} value={tr}>{tr}</option>
                              ))}
                            </select>
                          </div>

                          {/* Tamaño de Envase */}
                          <div>
                            <label className="block text-[10px] font-bold text-gray-700 uppercase mb-1">
                              Tamaño Envase
                            </label>
                            <select
                              value={genTamanoEnvase}
                              onChange={(e) => setGenTamanoEnvase(e.target.value)}
                              className="w-full h-9 px-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00603C] text-xs font-medium"
                            >
                              <option value="Todos">Todos los envases</option>
                              {tamanosEnvaseDisponiblesFiltro.map(tam => (
                                <option key={tam} value={tam}>{tam} kg</option>
                              ))}
                            </select>
                            <span className="text-[10px] text-gray-400 mt-0.5 block truncate">
                              {tamanosEnvaseDisponiblesFiltro.length} dispon.
                            </span>
                          </div>
                        </div>
                      </div>

                  {/* Barra de estado de compatibilidad */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-200/70 text-xs">
                    <div className="flex items-center gap-2 flex-wrap text-gray-600">
                      <span className="font-semibold text-gray-800">Lotes coincidentes:</span>
                      <span className={`px-2 py-0.5 rounded-full font-mono font-bold text-xs ${
                        candidateLotes.length > 0 
                          ? 'bg-emerald-100 text-[#00603C] border border-emerald-300' 
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}>
                        {candidateLotes.length} lote{candidateLotes.length === 1 ? '' : 's'} disponible{candidateLotes.length === 1 ? '' : 's'} con stock
                      </span>
                      {candidateLotes.length > 0 && (
                        <span className="text-[11px] text-gray-500">
                          (Stock total disponible: {candidateLotes.reduce((sum, l) => sum + l.stockBolsas, 0)} bolsas)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* DASHBOARD EXPANDIDO A TODO LO ANCHO: LOTE DE ORIGEN & BOLSAS A CARGAR */}
                <div className="bg-white p-5 rounded-2xl border-2 border-emerald-600/30 shadow-xs space-y-4">
                  {/* Cabecera del Dashboard */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="bg-[#00603C] text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md tracking-wider">
                          DASHBOARD
                        </span>
                        <h4 className="font-serif text-base font-bold text-[#1A1A1A]">
                          Lote de Origen &amp; Bolsas a Cargar
                        </h4>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Seleccione los lotes específicos de los que se descontará la carga y asigne la cantidad de bolsas.
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                      {lastUpdatedLotesMsg && (
                        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5 text-[#00603C]" />
                          {lastUpdatedLotesMsg}
                        </span>
                      )}

                      {/* Botón para actualizar datos de lotes del sistema */}
                      <button
                        type="button"
                        onClick={handleActualizarLotesSistema}
                        disabled={isUpdatingLotes}
                        className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-300 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 shadow-2xs"
                        title="Actualizar datos de lotes del sistema para refrescar los resultados de los filtros aplicados"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 text-[#00603C] ${isUpdatingLotes ? 'animate-spin' : ''}`} />
                        <span>{isUpdatingLotes ? 'Actualizando...' : 'Actualizar datos'}</span>
                      </button>

                      {/* Botón '+' para agregar más lotes */}
                      <button
                        type="button"
                        onClick={handleAddLoteSlot}
                        disabled={candidateLotes.length === 0}
                        className="px-4 py-2 bg-emerald-50 hover:bg-[#00603C] text-[#00603C] hover:text-white border border-emerald-300 hover:border-[#00603C] rounded-xl font-bold text-xs flex items-center gap-2 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
                        title="Agregar otro lote de origen a esta misma orden"
                      >
                        <Plus className="w-4 h-4" />
                        <span>+ Agregar Lote de Origen</span>
                      </button>
                    </div>
                  </div>

                  {/* Estado si no hay lotes candidatos */}
                  {candidateLotes.length === 0 ? (
                    <div className="p-6 bg-amber-50/70 border border-amber-200 rounded-xl text-center space-y-2">
                      <AlertTriangle className="w-6 h-6 text-amber-600 mx-auto" />
                      <p className="text-xs font-bold text-amber-900">
                        No hay lotes disponibles que coincidan con la combinación de filtros actual.
                      </p>
                      <p className="text-[11px] text-amber-700">
                        Pruebe cambiando el cliente ("{genCliente}"), especie ("{genEspecie}"), variedad ("{genVariedad}") o categoría para visualizar lotes con stock disponible.
                      </p>
                    </div>
                  ) : (
                    /* Lista de Slots de Lotes a Cargar */
                    <div className="space-y-3.5">
                      {lotesCarga.map((slot, slotIdx) => {
                        const selectedLote = lotes.find(l => l.id === slot.loteId);
                        const isOverStock = selectedLote && slot.bolsas > selectedLote.stockBolsas;
                        const kgCalculados = selectedLote ? slot.bolsas * selectedLote.kgPorBolsa : 0;

                        return (
                          <div
                            key={slot.id}
                            className={`p-4 rounded-xl border transition ${
                              isOverStock
                                ? 'bg-red-50/50 border-red-300'
                                : selectedLote
                                ? 'bg-gray-50/80 border-gray-200 hover:border-emerald-300'
                                : 'bg-white border-dashed border-gray-300'
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-gray-200/70">
                              <div className="flex items-center gap-2">
                                <span className="bg-[#00603C] text-white text-[10px] font-bold px-2 py-0.5 rounded">
                                  Lote #{slotIdx + 1}
                                </span>
                                {selectedLote && (
                                  <span className="text-xs font-semibold text-gray-700">
                                    Lote <strong className="text-[#00603C]">{selectedLote.loteNro}</strong> ({selectedLote.variedad || selectedLote.especie})
                                  </span>
                                )}
                              </div>

                              {/* Botón quitar slot si hay más de 1 */}
                              {lotesCarga.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveLoteSlot(slotIdx)}
                                  className="px-2 py-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg text-xs font-semibold transition flex items-center gap-1 cursor-pointer border border-transparent hover:border-red-200"
                                  title="Quitar este lote"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Quitar</span>
                                </button>
                              )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs items-end">
                              {/* Selector de Lote entre los Candidatos */}
                              <div className="md:col-span-7">
                                <label className="block text-[10px] font-bold text-gray-700 uppercase mb-1">
                                  Lote de Origen * (responde a filtros vinculados)
                                </label>
                                <select
                                  value={slot.loteId}
                                  onChange={(e) => handleUpdateLoteSlot(slotIdx, 'loteId', e.target.value)}
                                  className="w-full h-10 px-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00603C] font-semibold text-xs"
                                  required
                                >
                                  <option value="" disabled>-- Seleccionar Lote Disponible --</option>
                                  {candidateLotes.map(lote => (
                                    <option key={lote.id} value={lote.id}>
                                      Lote {lote.loteNro} — {lote.especie} {lote.variedad ? `(${lote.variedad})` : ''} | Ubic: {getLoteUbicacion(lote)} | Stock: {lote.stockBolsas} b. ({lote.kgPorBolsa} kg/b)
                                    </option>
                                  ))}
                                </select>
                                {selectedLote && (
                                  <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-600 mt-1.5">
                                    <span className="inline-flex items-center gap-1 font-bold text-[#00603C] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                      <MapPin className="w-3 h-3 text-[#00603C]" />
                                      Ubicación en Planta: <strong className="font-sans font-black text-xs text-[#00603C]">{getLoteUbicacion(selectedLote)}</strong>
                                    </span>
                                    <span>•</span>
                                    <span>Stock remanente disponible: <strong className="text-gray-800 font-mono">{selectedLote.stockBolsas} b.</strong></span>
                                    <span>•</span>
                                    <span>Envase: <strong className="text-gray-800 font-mono">{selectedLote.kgPorBolsa} kg/bolsa</strong></span>
                                    <span>•</span>
                                    <span>Tratamiento: <strong className="text-gray-800">{selectedLote.tratamiento.join(', ')}</strong></span>
                                  </div>
                                )}
                              </div>

                              {/* Cantidad de Bolsas */}
                              <div className="md:col-span-3">
                                <div className="flex items-center justify-between mb-1">
                                  <label className="block text-[10px] font-bold text-gray-700 uppercase">
                                    Bolsas a Cargar *
                                  </label>
                                  <span className="text-[9px] font-bold text-[#00603C] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                    Defecto: 35 b. (28.000 kg)
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    min="1"
                                    max={selectedLote ? selectedLote.stockBolsas : undefined}
                                    value={slot.bolsas || ''}
                                    onChange={(e) => handleUpdateLoteSlot(slotIdx, 'bolsas', parseInt(e.target.value, 10) || 0)}
                                    className={`w-full h-10 px-3 bg-white border rounded-lg focus:outline-none focus:ring-2 font-mono font-bold text-sm ${
                                      isOverStock
                                        ? 'border-red-400 focus:ring-red-400 text-red-700 bg-red-50'
                                        : 'border-gray-300 focus:ring-[#00603C] text-gray-900'
                                    }`}
                                    placeholder="35"
                                    required
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateLoteSlot(slotIdx, 'bolsas', 35)}
                                    className="px-2 h-10 bg-emerald-50 hover:bg-emerald-100 text-[#00603C] text-[10px] font-bold rounded-lg border border-emerald-200 transition cursor-pointer shrink-0"
                                    title="Precargar valor por defecto: 35 bolsas (28.000 kg)"
                                  >
                                    35 b.
                                  </button>
                                  {selectedLote && (
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateLoteSlot(slotIdx, 'bolsas', selectedLote.stockBolsas)}
                                      className="px-2 h-10 bg-gray-100 hover:bg-emerald-100 text-gray-700 hover:text-[#00603C] text-[10px] font-bold rounded-lg border border-gray-200 transition cursor-pointer shrink-0"
                                      title="Cargar stock completo disponible"
                                    >
                                      Máx
                                    </button>
                                  )}
                                </div>
                                <span className="text-[10px] text-gray-400 mt-1 block">
                                  Saldo tras carga: {selectedLote ? Math.max(0, selectedLote.stockBolsas - (slot.bolsas || 0)) : 0} b.
                                </span>
                              </div>

                              {/* Cálculo de Kg */}
                              <div className="md:col-span-2 text-right bg-white p-2.5 rounded-lg border border-gray-200">
                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">
                                  Peso Estimado
                                </span>
                                <span className="font-mono font-bold text-[#00603C] text-sm block">
                                  {formatNumberArg(kgCalculados, 0)} kg
                                </span>
                                <span className="text-[9px] text-gray-400 block font-mono">
                                  {slot.bolsas || 0} b. × {selectedLote?.kgPorBolsa || 0} kg
                                </span>
                              </div>
                            </div>

                            {/* Alerta de Stock insuficiente para el slot */}
                            {isOverStock && selectedLote && (
                              <div className="mt-2.5 p-2 bg-[#F5E5DC] text-[#A0522D] rounded-lg font-bold text-xs flex items-center gap-1.5 border border-[#A0522D]/20">
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                <span>La cantidad requerida ({slot.bolsas} b.) supera el stock disponible en este lote ({selectedLote.stockBolsas} b.).</span>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Botón '+' ancho al final de la lista de lotes */}
                      <button
                        type="button"
                        onClick={handleAddLoteSlot}
                        disabled={candidateLotes.length === 0}
                        className="w-full py-2.5 px-4 rounded-xl border-2 border-dashed border-emerald-300 hover:border-[#00603C] bg-emerald-50/40 hover:bg-emerald-50 text-[#00603C] font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                      >
                        <Plus className="w-4 h-4" />
                        <span>+ Agregar otro Lote de Origen (que responda a los filtros vinculados)</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* RESUMEN GLOBAL DE LA CARGA A DESPACHAR (SI HAY LOTES CONFIGURADOS) */}
                {allSelectedSlots.length > 0 && (
                  <div className="bg-[#F6EFDC]/60 p-4 rounded-xl border border-[#C9922E]/30 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#C9922E]/20 pb-2">
                      <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">
                        Resumen Consolidado de la Orden
                      </span>
                      <span className="text-xs font-bold text-[#00603C] bg-white px-2 py-0.5 rounded-md border border-emerald-200">
                        {allSelectedSlots.length} Lote{allSelectedSlots.length === 1 ? '' : 's'} a Cargar
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">Clientes</span>
                        <span className="font-bold text-gray-800 truncate block" title={Array.from(new Set(allSelectedSlots.map(s => s.lote.cliente))).join(', ')}>
                          {Array.from(new Set(allSelectedSlots.map(s => s.lote.cliente))).join(' / ')}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">Total Bolsas</span>
                        <span className="font-mono font-bold text-gray-900 text-sm block">
                          {totalBolsasSeleccionadas} b.
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">Carga Total Estimada</span>
                        <span className="font-mono font-bold text-[#00603C] text-sm block">
                          {formatNumberArg(totalKgSeleccionados, 0)} kg
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">Lotes Configurados</span>
                        <span className="font-bold text-gray-800 block">
                          {lotesCarga.length} lote{lotesCarga.length === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>

                    {/* Desglose individual de cada lote */}
                    <div className="pt-2 border-t border-amber-200/50">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
                        Desglose de Lotes
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {allSelectedSlots.map((item, i) => (
                          <div
                            key={i}
                            className="bg-white p-2 rounded-lg border border-gray-100 flex items-center justify-between text-xs"
                          >
                            <div className="truncate pr-2">
                              <span className="font-mono font-bold text-gray-800 block">Lote {item.lote.loteNro}</span>
                              <span className="text-[10px] text-gray-500 truncate block">
                                {item.lote.cliente} • {item.lote.variedad || item.lote.especie}
                              </span>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-bold text-[#00603C] block">{item.bolsas} b.</span>
                              <span className="text-[10px] text-gray-400 font-mono block">
                                {formatNumberArg(item.kg, 0)} kg
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. SECCIÓN ASIGNACIÓN & DATOS MANUALES DE DESPACHO (ORGANIZADOS) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
                  {/* Despachante Asignado */}
                  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-[#00603C]" />
                        <span>Despachante Asignado *</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setAddDespError('');
                          setAddDespSuccess('');
                          setShowAddDespModal(true);
                        }}
                        className="text-[10px] font-bold text-[#00603C] hover:text-[#254731] flex items-center gap-1 underline transition cursor-pointer"
                      >
                        <UserPlus className="w-3 h-3" /> + Agregar Autorizado
                      </button>
                    </div>

                    <select
                      value={genDespachante}
                      onChange={(e) => setGenDespachante(e.target.value)}
                      className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00603C] font-semibold text-xs"
                      required
                    >
                      {despachantesList.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    <span className="text-[10px] text-gray-400 block">
                      Responsable autorizado para emitir la orden en planta.
                    </span>
                  </div>

                  {/* Datos de Carga Manual (Despacho: Nro de remito cliente, Destino, Chofer) */}
                  <div className="bg-[#FAF8F5] p-4 rounded-xl border border-amber-200/60 shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-[#C9922E]" />
                        <span className="text-[10px] font-bold text-[#00603C] uppercase tracking-wider">
                          Datos de Carga (Opcionales)
                        </span>
                      </div>
                      <span className="text-[9px] text-gray-400">
                        Completar ahora o al despachar
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <div>
                        <label className="block text-[9px] font-bold text-gray-600 uppercase mb-0.5">
                          Remito Cliente
                        </label>
                        <input
                          type="text"
                          value={genRemitoCliente}
                          onChange={(e) => setGenRemitoCliente(e.target.value)}
                          placeholder="R-0001-0004523"
                          className="w-full h-8 px-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#00603C] font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-gray-600 uppercase mb-0.5">
                          Destino
                        </label>
                        <input
                          type="text"
                          value={genDestino}
                          onChange={(e) => setGenDestino(e.target.value)}
                          placeholder="Ej: Quequén"
                          className="w-full h-8 px-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#00603C] text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-gray-600 uppercase mb-0.5">
                          Chofer
                        </label>
                        <input
                          type="text"
                          value={genChofer}
                          onChange={(e) => setGenChofer(e.target.value)}
                          placeholder="Nombre chofer"
                          className="w-full h-8 px-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#00603C] text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* BOTONERA DE ACCIONES */}
                <div className="border-t border-gray-200 pt-4 flex flex-col sm:flex-row items-center justify-end gap-3">
                  <div className="flex flex-wrap items-center justify-end gap-3 w-full sm:w-auto">
                    {stockInsuficienteAlerta && (
                      <span className="text-xs font-bold text-[#A0522D] bg-[#F5E5DC] px-3 py-1.5 rounded-lg flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Supera stock disponible</span>
                      </span>
                    )}

                    {allSelectedSlots.length === 0 && !stockInsuficienteAlerta && (
                      <span className="text-[11px] text-gray-400 font-medium">
                        Seleccione al menos 1 lote con bolsas &gt; 0
                      </span>
                    )}

                    <button
                      type="submit"
                      disabled={allSelectedSlots.length === 0 || stockInsuficienteAlerta}
                      className="w-full sm:w-auto px-6 py-2.5 bg-[#00603C] text-white rounded-xl font-sans font-bold hover:bg-[#254731] transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      <span>
                        Generar Orden de Carga
                        {totalBolsasSeleccionadas > 0 && ` (${totalBolsasSeleccionadas} b. • ${formatNumberArg(totalKgSeleccionados, 0)} kg)`}
                      </span>
                    </button>
                  </div>
                </div>

              </form>
            </div>
          )}
        </div>
      </div>
    )}

        {/* B) MIS ÓRDENES (DESPACHANTE EN PLAYA DE CARGA) */}
        {subView === 'mis-ordenes' && (
          <div className="space-y-6">
            
            {/* Login Libre sin Clave */}
            {!despIdentificado ? (
              <div className="max-w-md mx-auto bg-white p-6 md:p-8 rounded-2xl border border-gray-100 shadow-xl text-xs space-y-5 text-left">
                <div className="text-center pb-3 border-b border-gray-100">
                  <LogoSiloLoose size={56} color="#00603C" className="mx-auto mb-3" />
                  <span className="text-[10px] font-sans font-bold tracking-widest text-[#C9922E] uppercase">
                    ACCESO LIBRE A PLAYA DE CARGA
                  </span>
                  <h3 className="font-serif text-lg font-bold text-[#1A1A1A] mt-1">
                    Identificación del Despachante
                  </h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider">
                        ¿Quién sos? *
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setAddDespError('');
                          setAddDespSuccess('');
                          setShowAddDespModal(true);
                        }}
                        className="text-[10px] font-bold text-[#00603C] hover:text-[#254731] flex items-center gap-1 underline transition"
                      >
                        <UserPlus className="w-3 h-3" /> + Nuevo Despachante
                      </button>
                    </div>
                    <select
                      value={loginDespachante}
                      onChange={(e) => setLoginDespachante(e.target.value)}
                      className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00603C] text-sm font-semibold text-gray-800"
                    >
                      {despachantesList.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() => setDespIdentificado(loginDespachante)}
                    className="w-full h-11 bg-[#00603C] text-[#F6EFDC] font-bold uppercase tracking-wider rounded-xl hover:bg-[#254731] transition"
                  >
                    Ingresar a mis órdenes
                  </button>
                </div>
              </div>
            ) : (
              
              // Panel del Despachante Identificado
              <div className="space-y-6 text-left">
                
                <div className="bg-[#E3EFE7] p-4 rounded-2xl border border-gray-200 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-[#00603C] text-[#F6EFDC] rounded-xl">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-[#00603C] font-bold block">Despachante Asignado</span>
                      <h4 className="text-sm font-bold text-gray-800">{despIdentificado}</h4>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer bg-white text-[#00603C] border border-emerald-300 hover:bg-emerald-50 disabled:opacity-50"
                      title="Actualizar órdenes de carga y stock"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                      <span>Actualizar</span>
                    </button>
                    <button
                      onClick={() => setDespIdentificado(null)}
                      className="px-3 py-1.5 border border-[#A0522D] text-[#A0522D] rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-[#F5E5DC] transition cursor-pointer"
                    >
                      Salir / Cambiar Despachante
                    </button>
                  </div>
                </div>

                {/* Listado de órdenes asignadas pendientes de confirmación */}
                {(() => {
                  const ordenesPendientes = ordenes.filter(o => {
                    const matchDespachante = (o.despachante || '').trim().toLowerCase() === (despIdentificado || '').trim().toLowerCase();
                    const isPendiente = (o.estado === 'Disponible' || o.estado === 'Aceptada') && o.estado !== 'Despachada' && !confirmedLocally[o.id];
                    return matchDespachante && isPendiente;
                  });
                  const ordenesTotalesDespachante = ordenes.filter(o => {
                    return (o.despachante || '').trim().toLowerCase() === (despIdentificado || '').trim().toLowerCase();
                  });

                  return (
                    <div className="space-y-4">
                      {/* Mensaje de feedback de confirmación exitosa */}
                      {despachoExitoMsg && (
                        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-[#00603C] text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in slide-in-from-top-2">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 shrink-0 text-[#00603C]" />
                            <span>{despachoExitoMsg}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setDespachoExitoMsg(null)}
                            className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {/* Notificación informativa: solo se muestran órdenes pendientes */}
                      <div className="flex items-center justify-between gap-3 p-3 bg-white rounded-xl border border-gray-200 text-xs shadow-2xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                          <span className="font-semibold text-gray-700">
                            Órdenes pendientes de despacho:
                          </span>
                          <span className="font-mono font-bold text-[#00603C] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            {ordenesPendientes.length} pendientes
                          </span>
                        </div>
                        <span className="text-[11px] text-gray-500 hidden sm:inline">
                          Las órdenes confirmadas se retiran de este panel y se archivan en el historial general.
                        </span>
                      </div>

                      {ordenesPendientes.length === 0 ? (
                        <div className="bg-white p-12 text-center rounded-2xl border border-gray-100 text-gray-400 space-y-3">
                          {ordenesTotalesDespachante.length > 0 ? (
                            <>
                              <div className="w-14 h-14 bg-emerald-100 text-[#00603C] rounded-full flex items-center justify-center mx-auto shadow-xs">
                                <CheckCircle className="w-8 h-8" />
                              </div>
                              <h4 className="font-serif text-lg font-bold text-gray-800">
                                Sin Órdenes Pendientes
                              </h4>
                              <p className="text-xs text-gray-500 max-w-md mx-auto">
                                No tiene órdenes de carga pendientes en este momento. Todas las órdenes asignadas han sido confirmadas y archivadas.
                              </p>
                              {!onlyMisOrdenes && (
                                <div className="pt-2">
                                  <button
                                    type="button"
                                    onClick={() => setSubView('listado')}
                                    className="px-4 py-2 bg-[#00603C] hover:bg-[#254731] text-white rounded-xl text-xs font-bold transition cursor-pointer"
                                  >
                                    Ver Listado General de Despachos
                                  </button>
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              <ClipboardList className="w-12 h-12 text-[#C9922E] mx-auto opacity-40 mb-2" />
                              <h4 className="font-serif text-lg font-bold text-gray-700">Sin Órdenes de Carga</h4>
                              <p className="text-xs">No tiene órdenes asignadas en este momento.</p>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {ordenesPendientes.map(o => {
                            const fotoUrl = tempFotos[o.id] || o.fotoRemito;
                            const errorMsg = despachanteError[o.id];
                            const lote = lotes.find(l => l.id === o.loteId);
                            const isBloqueada = !!isConfirmingMap[o.id];

                            return (
                              <div
                                key={o.id}
                                className={`bg-white rounded-2xl border p-5 shadow-sm space-y-4 flex flex-col justify-between transition-all relative overflow-hidden ${
                                  isBloqueada
                                    ? 'border-emerald-600 ring-2 ring-emerald-500/30'
                                    : o.estado === 'Aceptada'
                                    ? 'border-[#00603C] ring-1 ring-[#00603C] ring-opacity-20'
                                    : 'border-amber-200 bg-amber-50 bg-opacity-20'
                                }`}
                              >
                                {/* Overlay de Bloqueo al confirmar */}
                                {isBloqueada && (
                                  <div className="absolute inset-0 z-30 bg-white/90 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center">
                                    <Lock className="w-9 h-9 text-[#00603C] animate-bounce mb-2" />
                                    <span className="font-bold text-sm text-[#00603C]">
                                      Bloqueando y confirmando despacho...
                                    </span>
                                    <span className="text-[11px] text-gray-500 mt-1">
                                      Dando de baja el stock y archivando orden en el sistema
                                    </span>
                                  </div>
                                )}

                                <div className="space-y-3">
                                  <div className="flex justify-between items-start border-b border-gray-100 pb-2.5">
                                    <div>
                                      <span className="text-[10px] uppercase font-mono font-bold text-[#C9922E]">
                                        ORDEN N° {o.id}
                                      </span>
                                      <h4 className="font-serif text-sm font-bold text-gray-900 mt-0.5">{o.cliente}</h4>
                                    </div>
                                    <span
                                      className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                                        o.estado === 'Aceptada'
                                          ? 'bg-[#E3EFE7] text-[#00603C]'
                                          : 'bg-[#F6EFDC] text-[#C9922E] border border-amber-200'
                                      }`}
                                    >
                                      {o.estado}
                                    </span>
                                  </div>

                                  {errorMsg && (
                                    <div className="p-2.5 bg-[#F5E5DC] text-[#A0522D] font-bold rounded-lg text-[10px] animate-in shake duration-150">
                                      {errorMsg}
                                    </div>
                                  )}

                                  {/* Campos de Información de la Orden */}
                                  <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50 p-3 rounded-xl border border-gray-100">
                                    <div className="col-span-2 border-b border-gray-200 pb-1 bg-white p-2 rounded-lg border border-gray-100">
                                      <span className="text-[8px] text-gray-400 font-bold uppercase block tracking-wider">Cliente</span>
                                      <span className="font-bold text-[#00603C] text-xs uppercase">{o.cliente}</span>
                                    </div>

                                    {/* UBICACIÓN DE LOTES EN PLANTA - FUENTE GRANDE Y LLAMATIVA */}
                                    <div className="col-span-2 bg-gradient-to-r from-emerald-50 via-emerald-100/60 to-emerald-50 border-2 border-[#00603C] p-3 sm:p-3.5 rounded-xl shadow-xs">
                                      <div className="flex items-center justify-between gap-1 mb-1.5">
                                        <div className="flex items-center gap-1.5">
                                          <MapPin className="w-4 h-4 text-[#00603C] shrink-0" />
                                          <span className="text-[10px] sm:text-xs font-black text-[#00603C] uppercase tracking-wider">
                                            UBICACIÓN DE LOTE{o.lotesOrigen && o.lotesOrigen.length > 1 ? 'S' : ''} EN PLANTA
                                          </span>
                                        </div>
                                        <span className="text-[9px] font-black text-[#00603C] bg-white px-2 py-0.5 rounded-full border border-emerald-300 uppercase shadow-2xs">
                                          Acopio / Carga
                                        </span>
                                      </div>

                                      {o.lotesOrigen && o.lotesOrigen.length > 0 ? (
                                        <div className="space-y-1.5">
                                          {o.lotesOrigen.map((lo, loIdx) => {
                                            const loteMatch = lotes.find(l => l.id === lo.loteId || l.loteNro === lo.loteNro);
                                            const ubicacionTexto = getLoteUbicacion(loteMatch, lo.ubicacion);
                                            return (
                                              <div key={loIdx} className="bg-white p-2 sm:p-2.5 rounded-lg border border-emerald-200 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                                                <span className="font-mono font-black text-xs sm:text-sm text-gray-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                                                  L-{lo.loteNro}
                                                </span>
                                                <div className="flex items-center gap-1.5">
                                                  <span className="text-[9px] text-gray-500 font-bold uppercase">Ubicación:</span>
                                                  <span className="font-sans font-black text-sm sm:text-base text-[#00603C] tracking-wide bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                                    📍 {ubicacionTexto}
                                                  </span>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <div className="bg-white p-2 sm:p-2.5 rounded-lg border border-emerald-200 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                                          <span className="font-mono font-black text-xs sm:text-sm text-gray-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                                            L-{o.loteId}
                                          </span>
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-[9px] text-gray-500 font-bold uppercase">Ubicación:</span>
                                            <span className="font-sans font-black text-base sm:text-lg text-[#00603C] tracking-wide bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                                              📍 {getLoteUbicacion(lote, o.ubicacionLote)}
                                            </span>
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    {o.lotesOrigen && o.lotesOrigen.length > 0 ? (
                                      <div className="col-span-2 bg-[#E3EFE7] bg-opacity-30 p-2.5 rounded-lg border border-[#00603C]/10 space-y-1.5 my-1">
                                        <span className="text-[9px] font-bold text-[#00603C] uppercase tracking-wider block">Desglose de Carga ({o.lotesOrigen.length} lotes)</span>
                                        <div className="space-y-1.5">
                                          {o.lotesOrigen.map((lo, idx) => {
                                            const loteMatch = lotes.find(l => l.id === lo.loteId || l.loteNro === lo.loteNro);
                                            const ubi = getLoteUbicacion(loteMatch, lo.ubicacion);
                                            return (
                                              <div key={idx} className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-dashed border-gray-200 pb-1 last:border-0 last:pb-0 gap-1">
                                                <div className="flex items-center gap-1.5">
                                                  <span className="font-mono font-black text-sm text-gray-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-300">
                                                    L-{lo.loteNro}
                                                  </span>
                                                  <span className="text-[11px] font-black text-[#00603C]">
                                                    📍 {ubi}
                                                  </span>
                                                </div>
                                                <span className="font-bold text-gray-800 text-xs">{lo.cantidadBolsas} b. / {formatNumberArg(lo.kgTotales, 0)} kg</span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                        <div className="flex justify-between items-center pt-1.5 border-t border-[#00603C]/10 text-[10px] font-bold text-[#00603C]">
                                          <span>TOTAL CARGA</span>
                                          <span>{o.cantidadBolsas} b. / {formatNumberArg(o.kgTotales, 0)} kg</span>
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        <div className="col-span-2 bg-amber-50/60 p-2.5 rounded-lg border border-amber-200 flex items-center justify-between">
                                          <div>
                                            <span className="text-[8px] text-gray-500 font-bold uppercase block tracking-wider">ID Lote</span>
                                            <span className="font-mono text-base sm:text-lg font-black text-gray-900 tracking-wide block">
                                              L-{o.loteId}
                                            </span>
                                          </div>
                                          {o.remitoCliente && (
                                            <div className="text-right">
                                              <span className="text-[8px] text-gray-500 font-bold uppercase block tracking-wider">N° Remito Cliente</span>
                                              <span className="font-mono text-xs font-bold text-[#00603C] bg-white px-2 py-0.5 rounded border border-emerald-200">
                                                {o.remitoCliente}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                        <div>
                                          <span className="text-[8px] text-gray-400 font-bold uppercase block tracking-wider">Ubicación</span>
                                          <span className="font-sans font-black text-sm text-[#00603C] block">📍 {getLoteUbicacion(lote, o.ubicacionLote)}</span>
                                        </div>
                                        <div>
                                          <span className="text-[8px] text-gray-400 font-bold uppercase block tracking-wider">Especie</span>
                                          <span className="font-semibold text-gray-800">{lote?.especie || '—'}</span>
                                        </div>
                                        <div>
                                          <span className="text-[8px] text-gray-400 font-bold uppercase block tracking-wider">Variedad</span>
                                          <span className="font-semibold text-gray-800">{lote?.variedad || '—'}</span>
                                        </div>
                                        <div>
                                          <span className="text-[8px] text-gray-400 font-bold uppercase block tracking-wider">Cantidad de Bolsas</span>
                                          <span className="font-bold text-gray-800">{o.cantidadBolsas} b.</span>
                                        </div>
                                        <div>
                                          <span className="text-[8px] text-gray-400 font-bold uppercase block tracking-wider">Kg Totales</span>
                                          <span className="font-mono font-bold text-[#00603C]">{formatNumberArg(o.kgTotales, 0)} kg</span>
                                        </div>
                                      </>
                                    )}

                                    <div>
                                      <span className="text-[8px] text-gray-400 font-bold uppercase block tracking-wider">Tipo de Lote</span>
                                      <span className="font-semibold text-gray-800">{o.tipo}</span>
                                    </div>
                                    <div>
                                      <span className="text-[8px] text-gray-400 font-bold uppercase block tracking-wider">Categoría</span>
                                      <span className="font-semibold text-gray-800">{o.categoria}</span>
                                    </div>
                                    <div className="col-span-2">
                                      <span className="text-[8px] text-gray-400 font-bold uppercase block tracking-wider">Tratamiento</span>
                                      <span className="font-semibold text-gray-800">{o.tratamiento}</span>
                                    </div>
                                    <div className="col-span-2 border-t border-gray-100 pt-1.5 mt-1">
                                      <span className="text-[8px] text-gray-400 font-bold uppercase block tracking-wider">Autorizador por Oficina</span>
                                      <span className="font-bold text-gray-700">{o.autor}</span>
                                    </div>

                                    {/* Datos de Carga Manual / Despacho */}
                                    <div className="col-span-2 bg-amber-50/50 p-2.5 rounded-xl border border-amber-200/60 space-y-1.5 mt-1">
                                      <div className="flex justify-between items-center">
                                        <span className="text-[8px] font-bold text-[#C9922E] uppercase tracking-wider flex items-center gap-1">
                                          <FileText className="w-3 h-3" /> Datos de Despacho
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handleOpenEditDespacho(o)}
                                          className="text-[9px] font-bold text-[#00603C] hover:text-[#254731] hover:underline flex items-center gap-1 px-1.5 py-0.5 rounded bg-white border border-gray-200 shadow-2xs cursor-pointer"
                                        >
                                          <Pencil className="w-2.5 h-2.5 text-[#00603C]" />
                                          Editar Despacho
                                        </button>
                                      </div>
                                      <div className="grid grid-cols-3 gap-2 text-[10px]">
                                        <div>
                                          <span className="text-[8px] text-gray-400 font-bold uppercase block">Nro Remito (Cliente)</span>
                                          <span className="font-mono font-bold text-gray-800 truncate block">
                                            {o.remitoCliente || <span className="text-gray-400 italic font-normal">Sin asignar</span>}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-[8px] text-gray-400 font-bold uppercase block">Destino</span>
                                          <span className="font-semibold text-gray-800 truncate block">
                                            {o.destino || <span className="text-gray-400 italic font-normal">Sin asignar</span>}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-[8px] text-gray-400 font-bold uppercase block">Chofer</span>
                                          <span className="font-semibold text-gray-800 truncate block">
                                            {o.chofer || <span className="text-gray-400 italic font-normal">Sin asignar</span>}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Sección de carga de foto de remito (Solo si está Aceptada) */}
                                  {o.estado === 'Aceptada' && (
                                    <div className="border-t border-gray-100 pt-3 space-y-3 text-xs">
                                      <div className="space-y-1.5">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-700 flex items-center justify-between">
                                          <span>Fotografía de Remito de Salida *</span>
                                          {fotoUrl && (
                                            <span className="text-emerald-700 font-bold text-[9px] bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                                              <Check className="w-3 h-3" /> Foto Adjuntada
                                            </span>
                                          )}
                                        </span>

                                        {fotoUrl ? (
                                          <div className="relative border border-emerald-300 rounded-xl p-2 bg-emerald-50/40 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                              <img
                                                src={fotoUrl}
                                                alt="Foto Remito"
                                                className="w-14 h-14 object-cover rounded-lg border border-gray-300 shadow-2xs"
                                                referrerPolicy="no-referrer"
                                              />
                                              <div>
                                                <span className="font-bold text-gray-800 text-[10px] block">Remito_Salida.jpg</span>
                                                <span className="text-[8px] text-emerald-700 font-semibold">Listo para confirmar despacho</span>
                                              </div>
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const updated = { ...tempFotos };
                                                delete updated[o.id];
                                                setTempFotos(updated);
                                              }}
                                              className="text-[10px] text-[#A0522D] hover:underline uppercase font-bold px-2 py-1 bg-white rounded-lg border border-gray-200 shadow-2xs cursor-pointer"
                                            >
                                              Cambiar Foto
                                            </button>
                                          </div>
                                        ) : (
                                          <div
                                            onDragOver={(e) => e.preventDefault()}
                                            onDrop={(e) => {
                                              e.preventDefault();
                                              if (e.dataTransfer.files?.[0]) {
                                                handleFotoUpload(o.id, e.dataTransfer.files[0]);
                                              }
                                            }}
                                            onClick={() => {
                                              const input = document.createElement('input');
                                              input.type = 'file';
                                              input.accept = 'image/*';
                                              input.onchange = (e) => {
                                                const file = (e.target as HTMLInputElement).files?.[0];
                                                if (file) handleFotoUpload(o.id, file);
                                              };
                                              input.click();
                                            }}
                                            className="border-2 border-dashed border-emerald-300 hover:border-[#00603C] rounded-xl p-4 text-center transition bg-emerald-50/20 hover:bg-emerald-50/50 cursor-pointer"
                                          >
                                            <UploadCloud className="w-7 h-7 text-[#00603C] mx-auto mb-1.5" />
                                            <span className="font-bold text-gray-800 block text-xs">Adjuntar Foto del Remito</span>
                                            <span className="text-[9px] text-gray-500">Haga clic o arrastre la imagen aquí para habilitar la confirmación</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Botón de acción principal según el estado */}
                                <div className="pt-3 border-t border-gray-100">
                                  {o.estado === 'Disponible' && (
                                    <button
                                      type="button"
                                      onClick={() => onUpdateOrdenStatus(o.id, 'Aceptada')}
                                      className="w-full py-2.5 bg-[#C9922E] hover:bg-[#A8751F] text-white font-sans font-bold uppercase tracking-wider rounded-xl transition cursor-pointer shadow-xs"
                                    >
                                      Aceptar orden de carga
                                    </button>
                                  )}

                                  {o.estado === 'Aceptada' && (
                                    <div className="space-y-2.5">
                                      <button
                                        type="button"
                                        onClick={() => handleConfirmarDespacho(o)}
                                        disabled={!fotoUrl || isBloqueada}
                                        className="w-full py-2.5 bg-[#00603C] hover:bg-[#254731] text-[#F6EFDC] font-sans font-bold uppercase tracking-wider rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                                      >
                                        {isBloqueada ? (
                                          <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            <span>Bloqueando y confirmando despacho...</span>
                                          </>
                                        ) : (
                                          <>
                                            <Check className="w-4 h-4" />
                                            <span>Confirmar despacho</span>
                                          </>
                                        )}
                                      </button>

                                      {!fotoUrl && (
                                        <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[10px] text-center font-semibold flex items-center justify-center gap-1.5">
                                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-[#C9922E]" />
                                          <span>Al adjuntar foto se habilitará el botón "Confirmar despacho"</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>

                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

          </div>
        )}

        {/* C) LISTADO GENERAL DE DESPACHOS Y SALIDAS */}
        {subView === 'listado' && (
          <div className="space-y-6 text-left">
            {/* Barra de Unificación de Despachos */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-gray-200 shadow-2xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="tab-ordenes-despacho"
                  onClick={() => setListadoTab('ordenes')}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold font-sans uppercase tracking-wider flex items-center gap-2 transition cursor-pointer ${
                    listadoTab === 'ordenes'
                      ? 'bg-[#00603C] text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <ClipboardList className="w-4 h-4" />
                  <span>Órdenes y Salida de Stock</span>
                </button>
                <button
                  type="button"
                  id="tab-historial-salidas-unificado"
                  onClick={() => setListadoTab('salidas-historial')}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold font-sans uppercase tracking-wider flex items-center gap-2 transition cursor-pointer ${
                    listadoTab === 'salidas-historial'
                      ? 'bg-[#00603C] text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <History className="w-4 h-4" />
                  <span>Historial de Salidas & Remitos</span>
                </button>
              </div>
              <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider pr-2">
                {listadoTab === 'ordenes' ? 'Gestión Operativa de Despacho' : 'Comprobantes Oficiales y Planillas'}
              </div>
            </div>

            {listadoTab === 'salidas-historial' ? (
              <SalidasList
                salidas={salidas}
                lotes={lotes}
                choferes={choferes}
                ordenes={ordenes}
                plantaConfig={plantaConfig}
                onDeleteDespacho={onDeleteDespacho}
                onDeleteMultipleDespachos={onDeleteMultipleDespachos}
              />
            ) : (
              <>
                {/* Filtros de la Tabla con Fijar Filtros */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-gray-100">
                <span className="text-[10px] font-sans font-bold tracking-wider text-gray-500 uppercase">
                  Filtrar Órdenes de Carga Registradas
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer bg-emerald-50 text-[#00603C] border border-emerald-300 hover:bg-emerald-100 disabled:opacity-50"
                    title="Actualizar listado de órdenes y stock de lotes"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span>Actualizar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsFilterPinned(prev => !prev)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                      isFilterPinned
                        ? 'bg-[#00603C] text-white shadow-xs ring-1 ring-emerald-400'
                        : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                    }`}
                    title={isFilterPinned ? "Filtros fijados (solo se quitan manualmente)" : "Fijar filtros para que se conserven"}
                  >
                    {isFilterPinned ? <Pin className="w-3.5 h-3.5 text-amber-300 fill-amber-300" /> : <PinOff className="w-3.5 h-3.5 text-gray-400" />}
                    <span>{isFilterPinned ? 'Filtros Fijados' : 'Fijar Filtros'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleClearDespachosFilters}
                    className="px-2.5 py-1.5 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg border border-gray-200 transition cursor-pointer"
                    title="Restablecer todos los filtros manualmente"
                  >
                    Limpiar
                  </button>
                </div>
              </div>

              {bajaStockFeedback && (
                <div className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in duration-200 ${
                  bajaStockFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-900 border border-emerald-300' : 'bg-red-50 text-red-800 border border-red-300'
                }`}>
                  <span>{bajaStockFeedback.msg}</span>
                  <button type="button" onClick={() => setBajaStockFeedback(null)} className="text-gray-400 hover:text-gray-700">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3.5 text-xs">
                {/* N° Remito Cliente */}
                <div>
                  <label className="block text-[9px] font-bold text-[#00603C] uppercase tracking-wider mb-1">
                    N° Remito Cliente
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                      <FileText className="w-4 h-4 text-[#00603C]" />
                    </span>
                    <input
                      type="text"
                      value={filterRemitoCliente}
                      onChange={(e) => setFilterRemitoCliente(e.target.value)}
                      className="w-full pl-9 pr-7 py-2 bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C] h-10 font-mono font-bold text-xs text-gray-800 placeholder:font-sans placeholder:font-normal"
                      placeholder="N° remito..."
                    />
                    {filterRemitoCliente && (
                      <button
                        type="button"
                        onClick={() => setFilterRemitoCliente('')}
                        className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400 hover:text-gray-600"
                        title="Borrar filtro"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Cliente */}
                <div>
                  <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Cliente Comitente
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                      <Search className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      value={filterCliente}
                      onChange={(e) => setFilterCliente(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C] h-10"
                      placeholder="Buscar cliente..."
                    />
                  </div>
                </div>

                {/* Autor */}
                <div>
                  <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Autorizado por
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      value={filterAutor}
                      onChange={(e) => setFilterAutor(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C] h-10"
                      placeholder="Buscar autor..."
                    />
                  </div>
                </div>

                {/* Despachante */}
                <div>
                  <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Despachante Asignado
                  </label>
                  <select
                    value={filterDespachante}
                    onChange={(e) => setFilterDespachante(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C] h-10"
                  >
                    <option value="">Todos los despachantes</option>
                    {despachantesList.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                {/* Estado Despacho (Nuevo Filtro) */}
                <div>
                  <label className="block text-[9px] font-bold text-[#00603C] uppercase tracking-wider mb-1">
                    Estado Despacho
                  </label>
                  <select
                    value={filterEstadoDespacho}
                    onChange={(e) => setFilterEstadoDespacho(e.target.value as any)}
                    className="w-full px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C] h-10 font-bold"
                  >
                    <option value="todos">Todos los despachos</option>
                    <option value="despachado">🟢 Despachado</option>
                    <option value="sindespachar">🔴 Sin despachar</option>
                  </select>
                </div>

                {/* Estado */}
                <div>
                  <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Estado Orden
                  </label>
                  <select
                    value={filterEstado}
                    onChange={(e) => setFilterEstado(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C] h-10"
                  >
                    <option value="">Todos los estados</option>
                    <option value="Disponible">Disponible (Pendiente)</option>
                    <option value="Aceptada">Aceptada (Cargando)</option>
                    <option value="Despachada">Despachada (Entregada)</option>
                  </select>
                </div>

                {/* Fecha */}
                <div>
                  <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Fecha
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                      <Calendar className="w-4 h-4" />
                    </span>
                    <input
                      type="date"
                      value={filterFecha}
                      onChange={(e) => setFilterFecha(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C] h-10"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* BARRA DE RESUMEN Y CONTROLES DE DESPACHOS */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-gray-600 font-medium">
                <span className="bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-2xs">
                  Mostrando <strong className="text-gray-900">{summaryTotals.count}</strong> despachos
                </span>
                {selectedOrdenes.length > 0 && (
                  <span className="bg-emerald-100 text-[#00603C] px-3 py-1.5 rounded-lg border border-emerald-300 font-bold flex items-center gap-1.5 shadow-2xs animate-in fade-in duration-150">
                    <span className="w-2 h-2 rounded-full bg-[#00603C] animate-pulse" />
                    {selectedOrdenes.length} seleccionado{selectedOrdenes.length > 1 ? 's' : ''}
                  </span>
                )}
                <span className="bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-2xs">
                  Bolsas:{' '}
                  <strong className="text-gray-900 font-mono">{formatNumberArg(summaryTotals.totalBolsas, 0)}</strong>
                </span>
                <span className="bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-2xs">
                  Total Kilos:{' '}
                  <strong className="text-[#00603C] font-mono font-bold">
                    {formatNumberArg(summaryTotals.totalKg, 0)} kg
                  </strong>
                </span>
                <span className="bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-2xs text-[11px]">
                  Despachados:{' '}
                  <strong className="text-emerald-700 font-bold">{summaryTotals.despachadosCount}</strong>
                  {' · '}
                  Pendientes:{' '}
                  <strong className="text-rose-700 font-bold">{summaryTotals.pendientesCount}</strong>
                </span>
              </div>
            </div>

            {/* BARRA DE ACCIÓN PARA DESPACHOS SELECCIONADOS */}
            {selectedOrdenes.length > 0 && (
              <div className="bg-[#00603C] text-white p-3.5 sm:px-5 sm:py-3 rounded-2xl shadow-md flex flex-col sm:flex-row items-center justify-between gap-3 border border-emerald-700/60 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center gap-3.5 w-full sm:w-auto">
                  <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center font-bold text-[#C9922E] text-base shrink-0 border border-white/20 shadow-inner">
                    {selectedOrdenes.length}
                  </div>
                  <div>
                    <div className="font-bold text-sm flex items-center gap-2">
                      <span>
                        {selectedOrdenes.length === 1
                          ? '1 despacho seleccionado'
                          : `${selectedOrdenes.length} despachos seleccionados`}
                      </span>
                    </div>
                    <div className="text-xs text-emerald-100 flex items-center gap-2.5 mt-0.5 font-medium">
                      <span>
                        Bolsas:{' '}
                        <strong className="text-white font-mono font-bold">
                          {formatNumberArg(selectedOrdenes.reduce((a, c) => a + (c.cantidadBolsas || 0), 0), 0)}
                        </strong>
                      </span>
                      <span>•</span>
                      <span>
                        Kilos:{' '}
                        <strong className="text-white font-mono font-bold">
                          {formatNumberArg(selectedOrdenes.reduce((a, c) => a + (c.kgTotales || 0), 0), 0)} kg
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
                  {(onDeleteOrden || onDeleteMultipleOrdenes) && (
                    <button
                      type="button"
                      onClick={() => setOrdenesAEliminar(selectedOrdenes)}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-sm cursor-pointer"
                      title={`Eliminar ${selectedOrdenes.length} despachos seleccionados (requiere confirmación por texto)`}
                    >
                      <Trash2 className="w-4 h-4 text-rose-200" />
                      <span>
                        Eliminar {selectedOrdenes.length === 1 ? 'Despacho' : `Despachos (${selectedOrdenes.length})`}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Tabla */}
            {filteredOrdenes.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl border border-gray-100 text-center text-gray-400">
                <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-40 text-[#C9922E]" />
                <h4 className="font-serif text-lg font-bold text-gray-700 mb-1">Sin Órdenes Registradas</h4>
                <p className="text-xs">No se encontraron órdenes de carga generadas con los filtros vigentes.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#00603C] text-white font-sans uppercase tracking-wider text-[9px]">
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
                        {/* 1. Boton Despachado al inicio de las columnas */}
                        <th className="py-3 px-3 text-center" title="Botón Despachado: al activarse marca la salida con la cantidad de bolsas utilizadas del stock del lote utilizado">
                          Despacho
                        </th>
                        {/* 2. Columna Estado Despacho (despachado=verde / sin despachar=rojo) */}
                        <th className="py-3 px-3 text-center" title="Estado Despacho: Verde = Despachado / Rojo = Sin despachar">
                          Estado Despacho
                        </th>
                        <th className="py-3 px-4">N° Orden</th>
                        <th className="py-3 px-4 text-center">N° Remito Cliente</th>
                        <th className="py-3 px-4">Fecha</th>
                        <th className="py-3 px-4">Cliente Comitente</th>
                        <th className="py-3 px-4">ID Lote</th>
                        <th className="py-3 px-4">Especie</th>
                        <th className="py-3 px-4">Variedad</th>
                        <th className="py-3 px-4">Tipo Lote</th>
                        <th className="py-3 px-4">Tratamiento</th>
                        <th className="py-3 px-4 text-center">Bolsa / Envase</th>
                        <th className="py-3 px-4 text-right">Bolsas Despachadas</th>
                        <th className="py-3 px-4 text-right">Total Kg</th>
                        <th className="py-3 px-4">Autorizado por</th>
                        <th className="py-3 px-4">Despachante</th>
                        <th className="py-3 px-4">Destino / Chofer</th>
                        <th className="py-3 px-4 text-center">Remito / Foto</th>
                        <th className="py-3 px-4 text-center">Firma Chofer</th>
                        <th className="py-3 px-4 text-center">Estado Orden</th>
                        <th className="py-3 px-4 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredOrdenes.map((o, idx) => {
                        const hasFoto = !!(tempFotos[o.id] || o.fotoRemito);
                        const hasFirma = !!(tempFirmas[o.id] || o.firmaChofer);
                        const isSelected = selectedOrdenIds.has(o.id);

                        const singleLoteMatch = lotes.find(l => l.id === o.loteId || l.loteNro === o.loteId);

                        const rowEspecie = o.lotesOrigen && o.lotesOrigen.length > 0
                          ? Array.from(new Set(o.lotesOrigen.map(lo => {
                              const lm = lotes.find(l => l.id === lo.loteId || l.loteNro === lo.loteNro);
                              return lm?.especie;
                            }).filter(Boolean))).join(', ') || singleLoteMatch?.especie || '—'
                          : singleLoteMatch?.especie || '—';

                        const rowVariedad = o.lotesOrigen && o.lotesOrigen.length > 0
                          ? Array.from(new Set(o.lotesOrigen.map(lo => {
                              const lm = lotes.find(l => l.id === lo.loteId || l.loteNro === lo.loteNro);
                              return lo.variedad || lm?.variedad;
                            }).filter(Boolean))).join(', ') || singleLoteMatch?.variedad || '—'
                          : singleLoteMatch?.variedad || '—';

                        const rowTipoLote = singleLoteMatch?.tipo || o.tipo || 'Original';

                        const rowTratamiento = Array.isArray(singleLoteMatch?.tratamiento) && singleLoteMatch.tratamiento.length > 0
                          ? singleLoteMatch.tratamiento.join(', ')
                          : (o.tratamiento || (typeof singleLoteMatch?.tratamiento === 'string' ? singleLoteMatch.tratamiento : 'Sin tratamiento'));

                        const rowEnvase = singleLoteMatch?.envase || (singleLoteMatch?.kgPorBolsa ? `Bolsa ${singleLoteMatch.kgPorBolsa} kg` : (o.tamanoEnvase ? `Bolsa ${o.tamanoEnvase} kg` : 'Bolsa'));

                        return (
                          <tr
                            key={o.id}
                            className={`transition-colors ${
                              isSelected
                                ? 'bg-emerald-50/90 hover:bg-emerald-100/70'
                                : idx % 2 === 0
                                ? 'bg-white hover:bg-emerald-50/40'
                                : 'bg-[#E3EFE7]/25 hover:bg-emerald-50/40'
                            }`}
                          >
                            {/* COLUMNA CHECKBOX SELECCIÓN */}
                            <td className="py-3.5 px-3 text-center w-10">
                              <input
                                type="checkbox"
                                aria-label={`Seleccionar despacho ${o.remitoCliente || o.id}`}
                                checked={isSelected}
                                onChange={() => toggleSelectOrden(o.id)}
                                className="w-4 h-4 rounded text-[#00603C] focus:ring-[#00603C] border-gray-300 cursor-pointer accent-[#00603C]"
                              />
                            </td>
                            {/* 1 - Botón Despachado: ubicado al inicio de las columnas de órdenes de carga registradas, color verde clarito */}
                            <td className="py-3.5 px-3 text-center">
                              {o.stockDescontado ? (
                                <div className="inline-flex flex-col items-center justify-center">
                                  <button
                                    type="button"
                                    disabled
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-[#00603C] rounded-lg font-bold text-[11px] border border-emerald-300 shadow-2xs opacity-95 cursor-default select-none"
                                    title={`Despachado: Se marcaron como salida ${o.cantidadBolsas} b. (${formatNumberArg(o.kgTotales, 0)} kg) del Lote ${o.loteId}${o.fechaBajaStock ? ' el ' + new Date(o.fechaBajaStock).toLocaleDateString() : ''}`}
                                  >
                                    <Check className="w-3.5 h-3.5 text-[#00603C] stroke-[3]" />
                                    <span>Despachado</span>
                                  </button>
                                  <span className="text-[8px] text-emerald-800 font-semibold mt-0.5">
                                    Salida registrada
                                  </span>
                                </div>
                              ) : (
                                <div className="inline-flex flex-col items-center justify-center">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleBajaStock(o)}
                                    disabled={bajaStockLoading[o.id]}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 active:bg-emerald-300 text-[#00603C] rounded-lg font-bold text-[11px] border border-emerald-300 hover:border-emerald-400 transition cursor-pointer shadow-xs hover:shadow-sm"
                                    title={`Click para marcar salida con ${o.cantidadBolsas} bolsas (${formatNumberArg(o.kgTotales, 0)} kg) del stock del Lote ${o.loteId}`}
                                  >
                                    {bajaStockLoading[o.id] ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00603C]" />
                                    ) : (
                                      <PackageCheck className="w-3.5 h-3.5 text-[#00603C]" />
                                    )}
                                    <span>Despachado</span>
                                  </button>
                                  <span className="text-[8px] text-gray-500 font-semibold mt-0.5">
                                    {o.cantidadBolsas} b. pendientes
                                  </span>
                                </div>
                              )}
                            </td>

                            {/* 2 - Columna Estado Despacho: (despachado / sin despachar) despachado = verde / sin despachar = rojo */}
                            <td className="py-3.5 px-3 text-center">
                              {o.stockDescontado ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs whitespace-nowrap">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                  Despachado
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs whitespace-nowrap">
                                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                                  Sin despachar
                                </span>
                              )}
                            </td>

                            {/* 3 - N° Orden */}
                            <td className="py-3.5 px-4 font-mono font-bold text-[#A0522D] whitespace-nowrap">{o.id}</td>

                            {/* 4 - N° de Remito de Cliente */}
                            <td className="py-3.5 px-4 text-center font-mono font-bold text-[#00603C] whitespace-nowrap">
                              {o.remitoCliente ? (
                                <span className="bg-emerald-50 px-2 py-1 rounded border border-emerald-200 text-xs inline-block">
                                  {o.remitoCliente}
                                </span>
                              ) : (
                                <span className="text-gray-300 font-normal italic">—</span>
                              )}
                            </td>

                            {/* 5 - Fecha */}
                            <td className="py-3.5 px-4 font-semibold text-gray-600 whitespace-nowrap">{formatDateStr(o.fecha)}</td>

                            {/* 6 - Cliente */}
                            <td className="py-3.5 px-4 font-bold text-gray-800">{o.cliente}</td>

                            {/* 7 - ID Lote con tamaño aumentado y Ubicación en Planta */}
                            <td className="py-3.5 px-4">
                              {o.lotesOrigen && o.lotesOrigen.length > 0 ? (
                                <div className="space-y-1 min-w-[140px]">
                                  {o.lotesOrigen.map((lo, lIdx) => {
                                    const loteMatch = lotes.find(l => l.id === lo.loteId || l.loteNro === lo.loteNro);
                                    return (
                                      <div key={lIdx} className="flex flex-wrap items-center gap-1.5">
                                        <span className="font-mono font-black text-sm text-gray-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-300 shadow-2xs">
                                          L-{lo.loteNro}
                                        </span>
                                        <span className="text-[10px] font-black text-[#00603C] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                          📍 {getLoteUbicacion(loteMatch, lo.ubicacion)}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <span className="font-mono font-black text-base text-gray-900 bg-amber-50 px-2.5 py-1 rounded border border-amber-300 shadow-2xs inline-block">
                                    L-{o.loteId}
                                  </span>
                                  <div className="text-[10px] font-black text-[#00603C] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 inline-flex items-center gap-1">
                                    📍 {getLoteUbicacion(lotes.find(l => l.id === o.loteId), o.ubicacionLote)}
                                  </div>
                                </div>
                              )}
                            </td>

                            {/* Especie */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded bg-emerald-50 text-[#00603C] border border-emerald-200 text-xs font-bold">
                                {rowEspecie}
                              </span>
                            </td>

                            {/* Variedad */}
                            <td className="py-3.5 px-4 font-bold text-gray-900 whitespace-nowrap">
                              {rowVariedad}
                            </td>

                            {/* Tipo Lote */}
                            <td className="py-3.5 px-4 text-xs font-semibold text-gray-700 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                {rowTipoLote}
                              </span>
                            </td>

                            {/* Tratamiento */}
                            <td className="py-3.5 px-4 text-xs text-gray-700 max-w-[150px] truncate" title={rowTratamiento}>
                              {rowTratamiento}
                            </td>

                            {/* Bolsa / Envase */}
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 text-xs font-bold font-mono">
                                {rowEnvase}
                              </span>
                            </td>

                            {/* Bolsas Despachadas */}
                            <td className="py-3.5 px-4 text-right font-bold text-gray-900 whitespace-nowrap">
                              {o.cantidadBolsas} b.
                            </td>

                            {/* Total Kg */}
                            <td className="py-3.5 px-4 text-right font-mono font-bold text-[#00603C] whitespace-nowrap">
                              {formatNumberArg(o.kgTotales, 0)} kg
                            </td>

                            {/* Autorizado por */}
                            <td className="py-3.5 px-4 font-semibold text-gray-700">{o.autor || '—'}</td>

                            {/* Despachante */}
                            <td className="py-3.5 px-4 font-semibold text-gray-900">{o.despachante}</td>

                            {/* 11 - Destino / Chofer */}
                            <td className="py-3.5 px-4 text-left">
                              <div className="space-y-0.5 min-w-[130px]">
                                {o.destino ? (
                                  <div className="text-[10px] text-gray-700 font-medium truncate max-w-[140px]" title={o.destino}>
                                    📍 {o.destino}
                                  </div>
                                ) : (
                                  <span className="text-gray-300 text-[10px] italic">Sin destino</span>
                                )}
                                {o.chofer && (
                                  <div className="text-[10px] text-gray-600 truncate max-w-[140px]" title={o.chofer}>
                                    👤 {o.chofer}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              {hasFoto ? (
                                <button
                                  type="button"
                                  onClick={() => setFotoVisualizar({
                                    url: (tempFotos[o.id] || o.fotoRemito)!,
                                    titulo: `Foto Adjunta por Despachante - Orden N° ${o.id}`,
                                    fecha: o.fecha,
                                    despachante: o.despachante,
                                    cliente: o.cliente,
                                    loteId: o.loteId,
                                    remitoCliente: o.remitoCliente
                                  })}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 active:bg-emerald-300 text-[#00603C] rounded-lg font-bold text-[10px] border border-emerald-300 hover:border-emerald-400 transition cursor-pointer shadow-xs"
                                  title="Ver la foto adjunta por el despachante en alta resolución"
                                >
                                  <Camera className="w-3.5 h-3.5 text-[#00603C]" />
                                  <span>Ver Foto</span>
                                </button>
                              ) : (
                                <span className="text-gray-300 text-xs">—</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              {hasFirma ? (
                                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-[#C9922E] text-[9px] font-bold">
                                  FIRMADO
                                </span>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span
                                className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                  o.estado === 'Despachada'
                                    ? 'bg-[#00603C] text-white'
                                    : o.estado === 'Aceptada'
                                    ? 'bg-[#E3EFE7] text-[#00603C]'
                                    : 'bg-[#F6EFDC] text-[#C9922E]'
                                }`}
                              >
                                {o.estado}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditDespacho(o)}
                                  className="p-1.5 text-[#00603C] hover:bg-[#E3EFE7] rounded-lg transition cursor-pointer"
                                  title="Editar datos de despacho (Remito, Destino, Chofer)"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>

                                {o.estado === 'Despachada' ? (
                                  <button
                                    onClick={() => setComprobanteSeleccionado(o)}
                                    className="p-1.5 bg-[#E3EFE7] text-[#00603C] rounded-lg hover:bg-[#00603C] hover:text-white transition cursor-pointer"
                                    title="Ver Comprobante de Despacho"
                                  >
                                    <FileText className="w-4 h-4" />
                                  </button>
                                ) : (
                                  <span className="text-gray-400 text-[10px]">—</span>
                                )}

                                {(onDeleteOrden || onDeleteMultipleOrdenes) && (
                                  <button
                                    type="button"
                                    onClick={() => setOrdenesAEliminar([o])}
                                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer border border-transparent hover:border-rose-200"
                                    title={`Eliminar Despacho ${o.remitoCliente ? `Remito ${o.remitoCliente}` : `N° ${o.id}`}`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
              </>
            )}

          </div>
        )}

      </div>

      {/* COMPROBANTE DE DESPACHO PRINTABLE MODAL */}
      {comprobanteSeleccionado && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:static">
          
          <div id="comprobante-despacho-printable" className="bg-white w-full max-w-3xl rounded-3xl border-2 border-[#00603C] p-6 md:p-8 space-y-6 relative text-left shadow-2xl print:shadow-none print:border-none print:p-0 print:my-0">
            
            {/* Botón Cerrar */}
            <button
              onClick={() => setComprobanteSeleccionado(null)}
              className="absolute top-4 right-4 p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-full transition print:hidden"
            >
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Isotipo Sello en el Fondo del Comprobante */}
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.06] pointer-events-none">
              <LogoSiloLoose size={280} color="#00603C" />
            </div>

            {/* Header del Recibo */}
            <div className="flex justify-between items-start border-b-2 border-[#00603C] pb-5 mb-4">
              <div className="flex gap-3 items-center">
                <LogoSiloLoose size={48} color="#00603C" />
                <div>
                  <h3 className="font-serif text-xl font-bold text-[#00603C] uppercase tracking-wide leading-none">
                    AGRO ABACUS S.A.
                  </h3>
                  <p className="text-[10px] font-sans font-bold tracking-widest text-[#C9922E] uppercase mt-1">
                    PLANTA CLASIFICADORA · LA BARRANCOSA
                  </p>
                  <p className="text-[9px] text-gray-500 mt-0.5">Estancia La Barrancosa — Buenos Aires, Argentina</p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[8px] uppercase tracking-widest font-bold text-gray-400 block">
                  CONSTANCIA DE DESPACHO PLAYA
                </span>
                <div className="bg-[#00603C] text-[#F6EFDC] font-mono font-bold text-xs px-3 py-1.5 rounded-md mt-1.5 inline-block">
                  ORDEN N° {comprobanteSeleccionado.id}
                </div>
                <div className="text-[10px] text-gray-600 mt-1 font-semibold">
                  Fecha: {formatDateStr(comprobanteSeleccionado.fecha)}
                </div>
              </div>
            </div>

            <div className="text-center mb-2">
              <h4 className="font-serif text-base font-bold text-[#00603C] border-b border-[#C9922E] pb-1 inline-block uppercase tracking-wider">
                Certificado de Expedición de Granos Clasificados
              </h4>
            </div>

            {/* Datos Técnicos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#F6EFDC] bg-opacity-40 p-4 rounded-xl border border-[#C9922E] border-opacity-20 text-xs">
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-[#C9922E] uppercase tracking-wider block">
                  CLIENTE COMITENTE / DESTINATARIO
                </span>
                <p className="font-bold text-gray-800 text-sm">{comprobanteSeleccionado.cliente}</p>
                <p className="text-gray-500 text-[11px]">Planta Clasificadora — Estancia La Barrancosa</p>
                <p className="text-gray-500 text-[11px]">Despachante: <span className="font-semibold text-gray-800">{comprobanteSeleccionado.despachante}</span></p>
                <div className="pt-1.5 border-t border-amber-200/50 space-y-0.5 mt-1">
                  <p className="text-gray-700">N° Remito (Cliente): <span className="font-mono font-bold text-gray-900">{comprobanteSeleccionado.remitoCliente || '—'}</span></p>
                  <p className="text-gray-700">Destino de Carga: <span className="font-semibold text-gray-800">{comprobanteSeleccionado.destino || '—'}</span></p>
                  <p className="text-gray-700">Chofer / Transportista: <span className="font-semibold text-gray-800">{comprobanteSeleccionado.chofer || '—'}</span></p>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[9px] font-bold text-[#C9922E] uppercase tracking-wider block">
                  DATOS MAESTROS DEL GRANO
                </span>
                <p className="text-gray-700">
                  Lote de Origen:{" "}
                  <span className="font-mono font-bold text-[#A0522D]">
                    {comprobanteSeleccionado.lotesOrigen && comprobanteSeleccionado.lotesOrigen.length > 0
                      ? comprobanteSeleccionado.lotesOrigen.map(lo => lo.loteNro).join(", ")
                      : comprobanteSeleccionado.loteId}
                  </span>
                </p>
                <p className="text-gray-700">
                  Ubicación en Planta:{" "}
                  <span className="font-sans font-black text-xs text-[#00603C]">
                    📍 {comprobanteSeleccionado.ubicacionLote || (comprobanteSeleccionado.lotesOrigen && comprobanteSeleccionado.lotesOrigen.length > 0
                      ? comprobanteSeleccionado.lotesOrigen.map(lo => `${lo.loteNro}: ${getLoteUbicacion(lotes.find(l => l.id === lo.loteId || l.loteNro === lo.loteNro), lo.ubicacion)}`).join(" | ")
                      : getLoteUbicacion(lotes.find(l => l.id === comprobanteSeleccionado.loteId || l.loteNro === comprobanteSeleccionado.loteId)))}
                  </span>
                </p>
                <p className="text-gray-700">Tipo de Lote: <span className="font-semibold text-gray-800">{comprobanteSeleccionado.tipo}</span></p>
                <p className="text-gray-700">Categoría Carga: <span className="font-semibold text-gray-800">{comprobanteSeleccionado.categoria}</span></p>
                <p className="text-gray-700">Tratamiento de Semilla: <span className="font-semibold text-gray-800">{comprobanteSeleccionado.tratamiento}</span></p>
              </div>
            </div>

            {/* Tabla con bolsas y pesos */}
            <div className="border border-gray-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#00603C] text-white uppercase text-[9px] tracking-wider">
                    <th className="py-2.5 px-4 text-left">Descripción de Expedición</th>
                    <th className="py-2.5 px-4 text-center">Unidad de Envase</th>
                    <th className="py-2.5 px-4 text-right">Cantidad de Bolsas</th>
                    <th className="py-2.5 px-4 text-right">Peso Neto Totales (Kg)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {comprobanteSeleccionado.lotesOrigen && comprobanteSeleccionado.lotesOrigen.length > 0 ? (
                    comprobanteSeleccionado.lotesOrigen.map((lo, idx) => (
                      <tr key={idx}>
                        <td className="py-3 px-4 text-gray-900">
                          <span className="font-bold block">Expedición de Semillas Clasificadas</span>
                          <span className="text-[10px] text-gray-400">Origen Lote: <span className="font-bold font-mono">{lo.loteNro}</span></span>
                        </td>
                        <td className="py-3 px-4 text-center text-gray-600">Bolsa Standard</td>
                        <td className="py-3 px-4 text-right font-bold text-gray-900">{lo.cantidadBolsas} bolsas</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[#00603C] text-sm">
                          {formatNumberArg(lo.kgTotales, 0)} kg
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="py-3 px-4 text-gray-900">
                        <span className="font-bold block">Expedición de Semillas Clasificadas</span>
                        <span className="text-[10px] text-gray-400">Origen Lote {comprobanteSeleccionado.loteId}</span>
                      </td>
                      <td className="py-3 px-4 text-center text-gray-600">Bolsa Standard</td>
                      <td className="py-3 px-4 text-right font-bold text-gray-900">{comprobanteSeleccionado.cantidadBolsas} bolsas</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-[#00603C] text-sm">
                        {formatNumberArg(comprobanteSeleccionado.kgTotales, 0)} kg
                      </td>
                    </tr>
                  )}
                </tbody>
                {comprobanteSeleccionado.lotesOrigen && comprobanteSeleccionado.lotesOrigen.length > 0 && (
                  <tfoot>
                    <tr className="bg-gray-50 border-t border-gray-200 font-bold">
                      <td colSpan={2} className="py-3 px-4 text-[#00603C] text-[10px] uppercase tracking-wider">
                        Total General Despacho
                      </td>
                      <td className="py-3 px-4 text-right text-gray-900">
                        {comprobanteSeleccionado.cantidadBolsas} bolsas
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-[#00603C] text-sm">
                        {formatNumberArg(comprobanteSeleccionado.kgTotales, 0)} kg
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Adjuntos: Foto remito y Firma */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-3 border-t border-gray-100">
              
              <div className="space-y-1.5 text-center">
                <span className="text-[9px] font-bold text-[#C9922E] uppercase tracking-wider block text-left">
                  Copia de Remito de Salida Firmado
                </span>
                {comprobanteSeleccionado.fotoRemito || tempFotos[comprobanteSeleccionado.id] ? (
                  <div className="border border-gray-200 p-2 rounded-xl bg-gray-50 flex items-center justify-center">
                    <img
                      src={comprobanteSeleccionado.fotoRemito || tempFotos[comprobanteSeleccionado.id]}
                      alt="Remito Físico"
                      className="max-h-28 object-contain rounded border border-gray-200 shadow-sm"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div className="border border-dashed border-gray-200 p-6 text-center text-gray-400 rounded-xl">
                    No se adjuntó remito
                  </div>
                )}
              </div>

              <div className="space-y-1.5 flex flex-col justify-between">
                <div>
                  <span className="text-[9px] font-bold text-[#C9922E] uppercase tracking-wider block">
                    Conformidad del Conductor / Transportista
                  </span>
                  {comprobanteSeleccionado.firmaChofer || tempFirmas[comprobanteSeleccionado.id] ? (
                    <div className="border border-gray-200 p-1.5 rounded-xl bg-gray-50 flex items-center justify-center mt-1">
                      <img
                        src={comprobanteSeleccionado.firmaChofer || tempFirmas[comprobanteSeleccionado.id]}
                        alt="Firma Chofer"
                        className="h-16 object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : (
                    <div className="border border-dashed border-gray-200 p-4 text-center text-gray-400 rounded-xl mt-1">
                      Falta firmar conforme
                    </div>
                  )}
                </div>

                <div className="text-center text-[9px] text-gray-400 border-t border-gray-200 pt-1">
                  <p className="font-bold text-gray-600">Chofer Conductor / Recibí Conforme</p>
                  <p>Autorizado en playa por {comprobanteSeleccionado.despachante}</p>
                </div>
              </div>

            </div>

            {/* Footer de Comprobante */}
            <div className="border-t border-gray-100 pt-4 flex justify-between items-center text-[10px] text-gray-400 italic">
              <span>Agro Abacus S.A. · Control de Expedición Playa</span>
              <span>Constancia de Operaciones Digitales</span>
            </div>

            {/* Acciones del Comprobante */}
            <div className="flex justify-between items-center gap-3 pt-3 border-t border-gray-100 print:hidden">
              <div>
                {(onDeleteOrden || onDeleteMultipleOrdenes) && (
                  <button
                    type="button"
                    onClick={() => {
                      setOrdenesAEliminar([comprobanteSeleccionado]);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 rounded-xl hover:bg-rose-100 transition cursor-pointer"
                    title="Eliminar este comprobante y despacho definitivamente"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Eliminar Despacho</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setComprobanteSeleccionado(null)}
                  className="px-5 py-2 text-xs font-bold uppercase tracking-wider text-gray-500 hover:bg-gray-100 rounded-xl transition cursor-pointer"
                >
                  Cerrar Vista
                </button>
                <button
                  type="button"
                  onClick={handleDownloadComprobantePdf}
                  disabled={isExportingComprobantePdf}
                  className="flex items-center gap-2 px-6 py-2.5 bg-[#00603C] hover:bg-[#254731] text-white font-bold uppercase tracking-wider text-xs rounded-xl transition shadow-md cursor-pointer disabled:opacity-50"
                  title="Descargar Comprobante Oficial en formato PDF"
                >
                  {isExportingComprobantePdf ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#C9922E]" />
                  ) : (
                    <Download className="w-4 h-4 text-[#C9922E]" />
                  )}
                  <span>{isExportingComprobantePdf ? 'Generando PDF...' : 'Descargar PDF'}</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL PARA AGREGAR DESPACHANTE AUTORIZADO */}
      {showAddDespModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-left">
            
            {/* Header del Modal */}
            <div className="bg-[#00603C] text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl">
                  <UserPlus className="w-5 h-5 text-[#F6EFDC]" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base tracking-wide">Agregar Despachante Autorizado</h3>
                  <p className="text-[11px] text-emerald-100 font-sans">
                    Requiere clave de Malcon Baez o Amilcar Quiroz
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddDespModal(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleAgregarDespachante} className="p-6 space-y-4 text-xs">
              {addDespError && (
                <div className="bg-[#F5E5DC] text-[#A0522D] p-3 rounded-xl flex items-center gap-2 text-xs border border-red-200">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{addDespError}</span>
                </div>
              )}

              {addDespSuccess && (
                <div className="bg-[#E3EFE7] text-[#00603C] p-3 rounded-xl flex items-center gap-2 text-xs border border-emerald-200 font-bold">
                  <Check className="w-4 h-4 shrink-0 text-[#00603C]" />
                  <span>{addDespSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Nombre Completo del Despachante *
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={addDespNombre}
                    onChange={(e) => setAddDespNombre(e.target.value)}
                    placeholder="ej: Manuel Gomez Riquel"
                    className="w-full pl-9 pr-3 h-10 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00603C] text-xs font-semibold text-gray-800"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Usuario Autorizador *
                </label>
                <select
                  value={addDespAutor}
                  onChange={(e) => setAddDespAutor(e.target.value as any)}
                  className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00603C] text-xs font-semibold"
                >
                  <option value="Malcon Baez">Malcon Baez (Jefe de Planta)</option>
                  <option value="Amilcar Quiroz">Amilcar Quiroz (Logística)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Clave de Autorización de {addDespAutor} *
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={addDespClave}
                    onChange={(e) => setAddDespClave(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-10 pl-3 pr-8 bg-[#F5E5DC] bg-opacity-40 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#A0522D] text-xs font-medium"
                    required
                  />
                  <Lock className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-3 pointer-events-none" />
                </div>
                <p className="text-[10px] text-gray-500 mt-1.5 leading-relaxed">
                  Para dar de alta nuevos despachantes autorizados en la planta se requiere validar la clave del usuario {addDespAutor}.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddDespModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#00603C] hover:bg-[#254731] text-white font-bold rounded-lg shadow-sm transition flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4 text-[#C9922E]" />
                  <span>Autorizar y Registrar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PARA EDITAR DATOS DE DESPACHO (REMITO CLIENTE, DESTINO, CHOFER) */}
      {ordenEditandoDespacho && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl border border-gray-200 animate-in fade-in zoom-in duration-150 text-left">
            <div className="flex justify-between items-start border-b border-gray-100 pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold text-[#C9922E] uppercase tracking-wider block">
                  ORDEN N° {ordenEditandoDespacho.id}
                </span>
                <h4 className="font-serif text-base font-bold text-[#00603C]">
                  Editar Datos de Despacho
                </h4>
                <p className="text-[11px] text-gray-500">
                  Modifique los datos manuales de remito, destino y chofer en cualquier momento.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOrdenEditandoDespacho(null)}
                className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editSuccessMsg && (
              <div className="p-2.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold">
                {editSuccessMsg}
              </div>
            )}

            <form onSubmit={handleGuardarEditDespacho} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Nro de Remito (Cliente)
                </label>
                <input
                  type="text"
                  value={editRemitoCliente}
                  onChange={(e) => setEditRemitoCliente(e.target.value)}
                  placeholder="Ej: R-0001-0004523"
                  className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00603C] font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Destino
                </label>
                <input
                  type="text"
                  value={editDestino}
                  onChange={(e) => setEditDestino(e.target.value)}
                  placeholder="Ej: Puerto Quequén / Acopio San Cayetano"
                  className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00603C] text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Chofer / Transportista
                </label>
                <input
                  type="text"
                  value={editChofer}
                  onChange={(e) => setEditChofer(e.target.value)}
                  placeholder="Ej: Juan Carlos Morales"
                  className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00603C] text-xs"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setOrdenEditandoDespacho(null)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#00603C] text-white font-bold rounded-lg hover:bg-[#254731] transition cursor-pointer"
                >
                  Guardar Datos de Despacho
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL VISUALIZADOR DE FOTO ADJUNTA POR EL DESPACHANTE */}
      {fotoVisualizar && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={() => setFotoVisualizar(null)}
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
                    {fotoVisualizar.titulo}
                  </h4>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-gray-500 font-medium">
                    {fotoVisualizar.despachante && (
                      <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 font-semibold">
                        Despachante: {fotoVisualizar.despachante}
                      </span>
                    )}
                    {fotoVisualizar.cliente && (
                      <span className="bg-emerald-50 px-2 py-0.5 rounded text-[#00603C] font-semibold border border-emerald-200">
                        {fotoVisualizar.cliente}
                      </span>
                    )}
                    {fotoVisualizar.remitoCliente && (
                      <span className="bg-amber-50 px-2 py-0.5 rounded text-amber-800 font-semibold border border-amber-200">
                        Remito: {fotoVisualizar.remitoCliente}
                      </span>
                    )}
                    {fotoVisualizar.fecha && (
                      <span className="text-gray-400">
                        {formatDateStr(fotoVisualizar.fecha)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFotoVisualizar(null)}
                className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition cursor-pointer"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto bg-gray-900 rounded-xl p-2 flex items-center justify-center min-h-[350px]">
              <img
                src={fotoVisualizar.url}
                alt="Foto adjunta de despacho"
                className="max-h-[65vh] w-auto max-w-full object-contain rounded shadow-lg"
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-3 text-xs">
              <span className="text-gray-400 text-[11px]">
                Fotografía capturada y adjuntada en el momento del despacho.
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={fotoVisualizar.url}
                  download={`Foto-Despacho-${fotoVisualizar.remitoCliente || 'adjunto'}.jpg`}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer text-xs"
                >
                  <Download className="w-3.5 h-3.5 text-gray-600" />
                  <span>Descargar Foto</span>
                </a>
                <a
                  href={fotoVisualizar.url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-[#00603C] hover:bg-[#254731] text-white rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer text-xs"
                >
                  <Eye className="w-3.5 h-3.5 text-[#C9922E]" />
                  <span>Abrir en Pestaña</span>
                </a>
                <button
                  type="button"
                  onClick={() => setFotoVisualizar(null)}
                  className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-bold transition cursor-pointer text-xs"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DIÁLOGO DE CONFIRMACIÓN CON TEXTO MANUAL PARA ELIMINAR DESPACHOS */}
      {renderModalEliminarDespachos()}

    </div>
  );
};
