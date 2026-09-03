import React, { useState, useMemo } from 'react';
import { PlantaConfig, Lote, MovimientoSilo, SiloId, PLANTA_CONFIG_DEFAULT, VariedadItem, VARIEDADES_DB_DEFAULT } from '../types';
import { 
  Building2, 
  Sprout, 
  Dna, 
  Tag, 
  Award, 
  FlaskConical, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  Search, 
  RotateCcw, 
  Download, 
  Upload, 
  ArrowUpDown, 
  Layers, 
  Database,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Info,
  Filter,
  CheckSquare
} from 'lucide-react';

type CatalogKey = keyof PlantaConfig;

interface PlantaConfigViewProps {
  plantaConfig: PlantaConfig;
  lotes?: Lote[];
  siloStocks?: Record<SiloId, { kg: number; especie: string; cliente: string; variedad?: string }>;
  movimientosSilo?: MovimientoSilo[];
  onSavePlantaConfig: (newConfig: PlantaConfig) => void;
}

interface CatalogMeta {
  key: CatalogKey;
  label: string;
  singular: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  accentBadge: string;
  description: string;
  placeholder: string;
  examples: string[];
}

const CATALOG_DEFINITIONS: CatalogMeta[] = [
  {
    key: 'clientes',
    label: 'Clientes',
    singular: 'Cliente',
    icon: <Building2 className="w-5 h-5" />,
    color: 'text-sky-400',
    bgColor: 'bg-sky-500/10',
    borderColor: 'border-sky-500/30',
    accentBadge: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
    description: 'Empresas, productores y clientes asignables a lotes, ingresos a silos y despachos.',
    placeholder: 'Ej: San Diego Semillas, Eco Rural, Pampa...',
    examples: ['San Diego Semillas', 'Eco Rural', 'Pampa', 'Stine', 'Elementa Foods']
  },
  {
    key: 'especies',
    label: 'Especies',
    singular: 'Especie',
    icon: <Sprout className="w-5 h-5" />,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    accentBadge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    description: 'Granos y cultivos principales recepcionados y procesados en planta y silos.',
    placeholder: 'Ej: Soja, Trigo, Arveja, Maíz, Cebada...',
    examples: ['Soja', 'Trigo', 'Arveja', 'Cebada', 'Maíz', 'Girasol']
  },
  {
    key: 'variedades',
    label: 'Variedades',
    singular: 'Variedad',
    icon: <Dna className="w-5 h-5" />,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    accentBadge: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    description: 'Cultivares y variedades genéticas que alimentan los filtros de trazabilidad y calidad.',
    placeholder: 'Ej: CASUARINA, DM TIPA, BALLTRAP, ACA 360...',
    examples: ['CASUARINA', 'CATALPA', 'ARAUCARIA', 'PEHUEN', 'DM TIPA', 'BALLTRAP']
  },
  {
    key: 'tipos',
    label: 'Tipos de Lote',
    singular: 'Tipo',
    icon: <Tag className="w-5 h-5" />,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    accentBadge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    description: 'Clasificación de estados de proceso: Intermedio, Final, Semilla, Descarte, etc.',
    placeholder: 'Ej: Final, Intermedio, Procesado, Semilla...',
    examples: ['Final', 'Intermedio', 'Procesado', 'Semilla', 'Descarte']
  },
  {
    key: 'categorias',
    label: 'Categorías',
    singular: 'Categoría',
    icon: <Award className="w-5 h-5" />,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    accentBadge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    description: 'Categoría fiscal y de certificación de la semilla (Fundadora, PreBase, Original, Primu, etc.).',
    placeholder: 'Ej: Fundadora, PreBase, Original, Primu...',
    examples: ['Fundadora', 'PreBase', 'Original', 'Primera Multiplicación (PRIMU)']
  },
  {
    key: 'tratamientos',
    label: 'Tratamientos',
    singular: 'Tratamiento',
    icon: <FlaskConical className="w-5 h-5" />,
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/30',
    accentBadge: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    description: 'Tratamientos químicos, fungicidas, inoculantes o curados aplicados a los lotes.',
    placeholder: 'Ej: Sin Tratar, Tratado, Rizoderma, Signum 420...',
    examples: ['Sin Tratar', 'Tratado', 'Curado Completo', 'Fungicida', 'Inoculado']
  }
];

export const PlantaConfigView: React.FC<PlantaConfigViewProps> = ({
  plantaConfig,
  lotes = [],
  siloStocks,
  movimientosSilo = [],
  onSavePlantaConfig
}) => {
  const [activeCatalog, setActiveCatalog] = useState<CatalogKey>('clientes');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [newItemValue, setNewItemValue] = useState<string>('');
  
  // Estado para edición en línea
  const [editingItemOriginal, setEditingItemOriginal] = useState<string | null>(null);
  const [editingItemText, setEditingItemText] = useState<string>('');

  // Estado para carga masiva
  const [showBulkAdd, setShowBulkAdd] = useState<boolean>(false);
  const [bulkText, setBulkText] = useState<string>('');

  // Notificación local de éxito o advertencia
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showFeedback = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => {
      setFeedback(null);
    }, 4000);
  };

  // Estado para gestión relacional de Variedades (Especie + Cliente obligatorios + Semillero opcional)
  const [nuevaVariedadNombre, setNuevaVariedadNombre] = useState<string>('');
  const [nuevaVariedadSemillero, setNuevaVariedadSemillero] = useState<string>('');
  const [nuevaVariedadEspecie, setNuevaVariedadEspecie] = useState<string>(() => plantaConfig.especies?.[0] || '');
  const [nuevaVariedadCliente, setNuevaVariedadCliente] = useState<string>(() => plantaConfig.clientes?.[0] || '');
  
  // Selección múltiple para gestión y borrado de variedades
  const [selectedVariedadesIds, setSelectedVariedadesIds] = useState<string[]>([]);
  const [showBulkAddVariedades, setShowBulkAddVariedades] = useState<boolean>(false);
  const [bulkTextVariedades, setBulkTextVariedades] = useState<string>('');
  const [bulkVariedadSemillero, setBulkVariedadSemillero] = useState<string>('');

  // Filtros en cascada para la vista de Variedades
  const [filtroVariedadEspecie, setFiltroVariedadEspecie] = useState<string>('TODAS');
  const [filtroVariedadCliente, setFiltroVariedadCliente] = useState<string>('TODOS');
  const [filtroVariedadSemillero, setFiltroVariedadSemillero] = useState<string>('TODOS');

  // Estado para edición en línea de variedad relacional
  const [editingVariedadId, setEditingVariedadId] = useState<string | null>(null);
  const [editingVariedadNombre, setEditingVariedadNombre] = useState<string>('');
  const [editingVariedadSemillero, setEditingVariedadSemillero] = useState<string>('');
  const [editingVariedadEspecie, setEditingVariedadEspecie] = useState<string>('');
  const [editingVariedadCliente, setEditingVariedadCliente] = useState<string>('');

  // Lista normalizada de variedades relacionales en base de datos
  const variedadesDbList = useMemo<VariedadItem[]>(() => {
    if (Array.isArray(plantaConfig.variedadesDb) && plantaConfig.variedadesDb.length > 0) {
      // Si aún contiene variedades antiguas residuales como CASUARINA, dar prioridad al catálogo oficial depurado
      const hasOldCatalog = plantaConfig.variedadesDb.some(v => v.nombre === 'CASUARINA' || v.nombre === 'CATALPA');
      if (hasOldCatalog) {
        return VARIEDADES_DB_DEFAULT;
      }
      return plantaConfig.variedadesDb;
    }
    // Fallback: si aún no tiene variedadesDb, inicializar con las predeterminadas oficiales (24 variedades)
    return VARIEDADES_DB_DEFAULT;
  }, [plantaConfig.variedadesDb]);

  // Lista única de semilleros existentes para el filtro
  const semillerosDisponibles = useMemo(() => {
    const set = new Set<string>();
    variedadesDbList.forEach(v => {
      if (v.semillero && v.semillero.trim()) {
        set.add(v.semillero.trim());
      }
    });
    return Array.from(set).sort();
  }, [variedadesDbList]);

  // Lista de variedades filtrada por cascada (Especie + Cliente + Semillero + SearchTerm)
  const filteredVariedadesDbList = useMemo(() => {
    let result = [...variedadesDbList];
    if (filtroVariedadEspecie !== 'TODAS') {
      result = result.filter(v => (v.especie || '').trim().toLowerCase() === filtroVariedadEspecie.trim().toLowerCase());
    }
    if (filtroVariedadCliente !== 'TODOS') {
      result = result.filter(v => (v.cliente || '').trim().toLowerCase() === filtroVariedadCliente.trim().toLowerCase());
    }
    if (filtroVariedadSemillero !== 'TODOS') {
      result = result.filter(v => (v.semillero || '').trim().toLowerCase() === filtroVariedadSemillero.trim().toLowerCase());
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(v => 
        (v.nombre || '').toLowerCase().includes(term) ||
        (v.especie || '').toLowerCase().includes(term) ||
        (v.cliente || '').toLowerCase().includes(term) ||
        (v.semillero || '').toLowerCase().includes(term)
      );
    }
    return result;
  }, [variedadesDbList, filtroVariedadEspecie, filtroVariedadCliente, filtroVariedadSemillero, searchTerm]);

  // Manejo de Selección Múltiple de Variedades
  const handleToggleSelectVariedad = (id: string) => {
    setSelectedVariedadesIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllFilteredVariedades = () => {
    const allFilteredIds = filteredVariedadesDbList.map(v => v.id);
    setSelectedVariedadesIds(allFilteredIds);
    showFeedback(`Seleccionadas ${allFilteredIds.length} variedades visibles.`);
  };

  const handleDeselectAllVariedades = () => {
    setSelectedVariedadesIds([]);
  };

  // Borrado Masivo de Variedades Seleccionadas
  const handleDeleteSelectedVariedades = () => {
    if (selectedVariedadesIds.length === 0) {
      showFeedback('No hay variedades seleccionadas para eliminar.', 'error');
      return;
    }

    const itemsToDelete = variedadesDbList.filter(v => selectedVariedadesIds.includes(v.id));
    const count = itemsToDelete.length;

    // Calcular uso total acumulado en lotes y silos
    let totalLotesAfectados = 0;
    let totalSilosAfectados = 0;
    itemsToDelete.forEach(item => {
      const usage = calculateItemUsage('variedades', item.nombre);
      totalLotesAfectados += usage.totalLotes;
      totalSilosAfectados += usage.totalSilos;
    });

    let confirmMsg = `¿Confirmas la eliminación de las ${count} variedades seleccionadas?`;
    if (count <= 5) {
      confirmMsg += `\n\nVariedades a eliminar:\n• ${itemsToDelete.map(v => `${v.nombre} (${v.especie} - ${v.cliente})`).join('\n• ')}`;
    }
    if (totalLotesAfectados > 0 || totalSilosAfectados > 0) {
      confirmMsg += `\n\n⚠️ ADVERTENCIA: Estas variedades tienen ${totalLotesAfectados} lote(s) y ${totalSilosAfectados} silo(s) asociados en el sistema.`;
    }

    if (window.confirm(confirmMsg)) {
      const remainingVariedadesDb = variedadesDbList.filter(v => !selectedVariedadesIds.includes(v.id));
      const uniqueNames = Array.from(new Set(remainingVariedadesDb.map(v => v.nombre)));

      const newConfig: PlantaConfig = {
        ...plantaConfig,
        variedades: uniqueNames,
        variedadesDb: remainingVariedadesDb,
      };

      onSavePlantaConfig(newConfig);
      setSelectedVariedadesIds([]);
      showFeedback(`Se eliminaron exitosamente ${count} variedades de la base de datos.`, 'info');
    }
  };

  // Carga Masiva de Variedades para Especie y Cliente específicos
  const handleBulkAddVariedades = () => {
    const cleanEspecie = nuevaVariedadEspecie.trim();
    const cleanCliente = nuevaVariedadCliente.trim();
    const cleanSemillero = bulkVariedadSemillero.trim();

    if (!cleanEspecie || !cleanCliente) {
      showFeedback('Selecciona una Especie y un Cliente antes de agregar variedades.', 'error');
      return;
    }

    if (!bulkTextVariedades.trim()) {
      showFeedback('Ingresa al menos una variedad para procesar.', 'error');
      return;
    }

    const rawItems = bulkTextVariedades.split(/[\n,;]+/).map(i => i.trim().toUpperCase()).filter(Boolean);
    if (rawItems.length === 0) {
      showFeedback('No se encontraron nombres válidos de variedad.', 'error');
      return;
    }

    const existingCombinations = new Set(
      variedadesDbList.map(v => `${v.nombre.trim().toUpperCase()}|${v.especie.trim().toLowerCase()}|${v.cliente.trim().toLowerCase()}`)
    );

    const newItems: VariedadItem[] = [];
    const duplicates: string[] = [];

    rawItems.forEach(nombre => {
      const key = `${nombre}|${cleanEspecie.toLowerCase()}|${cleanCliente.toLowerCase()}`;
      if (existingCombinations.has(key)) {
        duplicates.push(nombre);
      } else {
        existingCombinations.add(key);
        newItems.push({
          id: `var-${cleanEspecie.toLowerCase().replace(/\s+/g, '')}-${cleanCliente.toLowerCase().replace(/\s+/g, '')}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          nombre,
          especie: cleanEspecie,
          cliente: cleanCliente,
          semillero: cleanSemillero || undefined,
        });
      }
    });

    if (newItems.length === 0) {
      showFeedback('Todas las variedades ingresadas ya existen para esta combinación de Especie y Cliente.', 'error');
      return;
    }

    const updatedVariedadesDb = [...variedadesDbList, ...newItems];
    const uniqueNames = Array.from(new Set([...plantaConfig.variedades, ...newItems.map(i => i.nombre)]));

    const newConfig: PlantaConfig = {
      ...plantaConfig,
      variedades: uniqueNames,
      variedadesDb: updatedVariedadesDb,
    };

    onSavePlantaConfig(newConfig);
    setBulkTextVariedades('');
    setBulkVariedadSemillero('');
    setShowBulkAddVariedades(false);
    showFeedback(`Se registraron ${newItems.length} nuevas variedades para ${cleanEspecie} (${cleanCliente}).${duplicates.length > 0 ? ` (${duplicates.length} duplicadas omitidas)` : ''}`);
  };

  // Restablecer catálogo a las 24 variedades oficiales depuradas
  const handleResetToOficialVariedades = () => {
    if (window.confirm('¿Confirmas borrar todas las variedades actuales de esta base de datos y restablecer exclusivamente las 24 variedades oficiales depuradas (Soja - Don Mario, Stine, Pioneer)?')) {
      const newConfig: PlantaConfig = {
        ...plantaConfig,
        variedades: Array.from(new Set(VARIEDADES_DB_DEFAULT.map(v => v.nombre))),
        variedadesDb: VARIEDADES_DB_DEFAULT,
      };
      onSavePlantaConfig(newConfig);
      setSelectedVariedadesIds([]);
      showFeedback('Se han cargado exitosamente las 24 variedades oficiales depuradas.');
    }
  };

  // Guardar nueva Variedad Relacional con Carga Manual de Semillero
  const handleAddVariedadRelacional = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNombre = nuevaVariedadNombre.trim();
    const cleanEspecie = nuevaVariedadEspecie.trim();
    const cleanCliente = nuevaVariedadCliente.trim();
    const cleanSemillero = nuevaVariedadSemillero.trim();

    if (!cleanNombre) {
      showFeedback('Ingresa el nombre de la variedad a registrar.', 'error');
      return;
    }

    // Validación estricta: La especie debe existir en Especies_DB
    const especieExiste = plantaConfig.especies.some(
      (esp) => esp.trim().toLowerCase() === cleanEspecie.toLowerCase()
    );
    if (!especieExiste) {
      showFeedback(`La especie "${cleanEspecie}" no existe en la base de datos de Especies. Debe crearla primero.`, 'error');
      return;
    }

    // Validación estricta: El cliente debe existir en Clientes_DB
    const clienteExiste = plantaConfig.clientes.some(
      (cli) => cli.trim().toLowerCase() === cleanCliente.toLowerCase()
    );
    if (!clienteExiste) {
      showFeedback(`El cliente "${cleanCliente}" no existe en la base de datos de Clientes. Debe crearlo primero.`, 'error');
      return;
    }

    // Validar si ya existe exactamente esta combinación en Variedades_DB
    const duplicate = variedadesDbList.some(
      (v) =>
        v.nombre.trim().toLowerCase() === cleanNombre.toLowerCase() &&
        v.especie.trim().toLowerCase() === cleanEspecie.toLowerCase() &&
        v.cliente.trim().toLowerCase() === cleanCliente.toLowerCase()
    );
    if (duplicate) {
      showFeedback(`La variedad "${cleanNombre}" ya está registrada para ${cleanEspecie} y ${cleanCliente}.`, 'error');
      return;
    }

    const newId = `var-${cleanEspecie.toLowerCase().replace(/\s+/g, '')}-${cleanCliente.toLowerCase().replace(/\s+/g, '')}-${Date.now()}`;
    const newVariedadItem: VariedadItem = {
      id: newId,
      nombre: cleanNombre.toUpperCase(),
      especie: cleanEspecie,
      cliente: cleanCliente,
      semillero: cleanSemillero || undefined,
    };

    const updatedVariedadesDb = [...variedadesDbList, newVariedadItem];
    // Mantener sincronizado el array plano de nombres únicos de variedades
    const uniqueNames = Array.from(new Set([...plantaConfig.variedades, cleanNombre.toUpperCase()]));

    const newConfig: PlantaConfig = {
      ...plantaConfig,
      variedades: uniqueNames,
      variedadesDb: updatedVariedadesDb,
    };

    onSavePlantaConfig(newConfig);
    setNuevaVariedadNombre('');
    setNuevaVariedadSemillero('');
    showFeedback(`Variedad "${newVariedadItem.nombre}" vinculada a ${cleanEspecie} (${cleanCliente}) guardada con éxito.`);
  };

  // Guardar edición de variedad relacional
  const handleSaveEditVariedad = (id: string) => {
    const cleanNombre = editingVariedadNombre.trim().toUpperCase();
    const cleanEspecie = editingVariedadEspecie.trim();
    const cleanCliente = editingVariedadCliente.trim();
    const cleanSemillero = editingVariedadSemillero.trim();

    if (!cleanNombre) {
      showFeedback('El nombre de la variedad no puede estar vacío.', 'error');
      return;
    }

    const updatedVariedadesDb = variedadesDbList.map((v) => {
      if (v.id === id) {
        return {
          ...v,
          nombre: cleanNombre,
          especie: cleanEspecie,
          cliente: cleanCliente,
          semillero: cleanSemillero || undefined,
        };
      }
      return v;
    });

    const uniqueNames = Array.from(new Set(updatedVariedadesDb.map((v) => v.nombre)));

    const newConfig: PlantaConfig = {
      ...plantaConfig,
      variedades: uniqueNames,
      variedadesDb: updatedVariedadesDb,
    };

    onSavePlantaConfig(newConfig);
    setEditingVariedadId(null);
    setEditingVariedadSemillero('');
    showFeedback(`Variedad "${cleanNombre}" actualizada correctamente.`);
  };

  // Eliminar variedad relacional
  const handleDeleteVariedadRelacional = (itemToDelete: VariedadItem) => {
    const usage = calculateItemUsage('variedades', itemToDelete.nombre);
    let confirmMsg = `¿Eliminar la variedad "${itemToDelete.nombre}" asociada a ${itemToDelete.especie} (${itemToDelete.cliente})?`;
    if (usage.totalLotes > 0 || usage.totalSilos > 0) {
      confirmMsg += `\n\n⚠️ Atención: Esta variedad se encuentra registrada en ${usage.totalLotes} lote(s) y ${usage.totalSilos} movimiento(s) de silo.`;
    }

    if (window.confirm(confirmMsg)) {
      const updatedVariedadesDb = variedadesDbList.filter((v) => v.id !== itemToDelete.id);
      const uniqueNames = Array.from(new Set(updatedVariedadesDb.map((v) => v.nombre)));

      const newConfig: PlantaConfig = {
        ...plantaConfig,
        variedades: uniqueNames,
        variedadesDb: updatedVariedadesDb,
      };

      onSavePlantaConfig(newConfig);
      if (editingVariedadId === itemToDelete.id) {
        setEditingVariedadId(null);
      }
      showFeedback(`Variedad "${itemToDelete.nombre}" eliminada de la base de datos.`, 'info');
    }
  };

  const currentMeta = useMemo(() => {
    return CATALOG_DEFINITIONS.find(c => c.key === activeCatalog) || CATALOG_DEFINITIONS[0];
  }, [activeCatalog]);

  const currentList = useMemo(() => {
    return plantaConfig[activeCatalog] || [];
  }, [plantaConfig, activeCatalog]);

  // Filtrar lista por término de búsqueda
  const filteredList = useMemo(() => {
    if (!searchTerm.trim()) return currentList;
    const term = searchTerm.toLowerCase().trim();
    return currentList.filter(item => item.toLowerCase().includes(term));
  }, [currentList, searchTerm]);

  // Calcular uso del ítem en Lotes y Silos
  const calculateItemUsage = (key: CatalogKey, itemName: string): { totalLotes: number; totalSilos: number } => {
    const itemNorm = itemName.trim().toLowerCase();
    
    // Contar en Lotes
    let lotesCount = 0;
    if (key === 'clientes') {
      lotesCount = lotes.filter(l => (l.cliente || '').trim().toLowerCase() === itemNorm).length;
    } else if (key === 'especies') {
      lotesCount = lotes.filter(l => (l.especie || '').trim().toLowerCase() === itemNorm).length;
    } else if (key === 'variedades') {
      lotesCount = lotes.filter(l => (l.variedad || '').trim().toLowerCase() === itemNorm).length;
    } else if (key === 'tipos') {
      lotesCount = lotes.filter(l => (l.tipo || '').trim().toLowerCase() === itemNorm).length;
    } else if (key === 'categorias') {
      lotesCount = lotes.filter(l => (l.categoria || '').trim().toLowerCase() === itemNorm).length;
    } else if (key === 'tratamientos') {
      lotesCount = lotes.filter(l => {
        if (Array.isArray(l.tratamiento)) {
          return l.tratamiento.some(t => (t || '').trim().toLowerCase() === itemNorm);
        }
        return (l.tratamiento as any || '').trim().toLowerCase() === itemNorm;
      }).length;
    }

    // Contar en Movimientos / Silos
    let silosCount = 0;
    if (movimientosSilo && movimientosSilo.length > 0) {
      silosCount = movimientosSilo.filter(m => {
        if (key === 'clientes') return (m.cliente || '').trim().toLowerCase() === itemNorm;
        if (key === 'especies') return (m.especie || '').trim().toLowerCase() === itemNorm;
        if (key === 'variedades') return (m.variedad || '').trim().toLowerCase() === itemNorm;
        if (key === 'categorias') return (m.categoria || '').trim().toLowerCase() === itemNorm;
        return false;
      }).length;
    }

    return { totalLotes: lotesCount, totalSilos: silosCount };
  };

  // Agregar nuevo ítem individual
  const handleAddItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = newItemValue.trim();
    if (!clean) {
      showFeedback(`Ingresa un nombre para agregar ${currentMeta.singular.toLowerCase()}.`, 'error');
      return;
    }

    // Chequear si ya existe (case insensitive)
    const exists = currentList.some(i => i.trim().toLowerCase() === clean.toLowerCase());
    if (exists) {
      showFeedback(`"${clean}" ya existe en el catálogo de ${currentMeta.label}.`, 'error');
      return;
    }

    const updatedList = [...currentList, clean];
    const newConfig: PlantaConfig = {
      ...plantaConfig,
      [activeCatalog]: updatedList
    };

    onSavePlantaConfig(newConfig);
    setNewItemValue('');
    showFeedback(`"${clean}" agregado correctamente a ${currentMeta.label}.`);
  };

  // Guardar edición de ítem
  const handleSaveEdit = (originalItem: string) => {
    const clean = editingItemText.trim();
    if (!clean) {
      showFeedback('El nombre no puede estar vacío.', 'error');
      return;
    }

    if (clean.toLowerCase() !== originalItem.toLowerCase()) {
      const exists = currentList.some(i => i.trim().toLowerCase() === clean.toLowerCase());
      if (exists) {
        showFeedback(`Ya existe otro ítem con el nombre "${clean}".`, 'error');
        return;
      }
    }

    const updatedList = currentList.map(item => item === originalItem ? clean : item);
    const newConfig: PlantaConfig = {
      ...plantaConfig,
      [activeCatalog]: updatedList
    };

    onSavePlantaConfig(newConfig);
    setEditingItemOriginal(null);
    setEditingItemText('');
    showFeedback(`Ítem actualizado a "${clean}".`);
  };

  // Eliminar ítem
  const handleDeleteItem = (itemToDelete: string) => {
    const usage = calculateItemUsage(activeCatalog, itemToDelete);
    let confirmMsg = `¿Seguro que deseas eliminar "${itemToDelete}" del catálogo de ${currentMeta.label}?`;
    if (usage.totalLotes > 0 || usage.totalSilos > 0) {
      confirmMsg += `\n\n⚠️ Atención: Este ítem está en uso actualmente en ${usage.totalLotes} lote(s) y ${usage.totalSilos} silo(s). Los registros existentes mantendrán su dato histórico, pero ya no aparecerá como opción estándar en los filtros.`;
    }

    if (window.confirm(confirmMsg)) {
      const updatedList = currentList.filter(item => item !== itemToDelete);
      const newConfig: PlantaConfig = {
        ...plantaConfig,
        [activeCatalog]: updatedList
      };

      onSavePlantaConfig(newConfig);
      if (editingItemOriginal === itemToDelete) {
        setEditingItemOriginal(null);
      }
      showFeedback(`"${itemToDelete}" eliminado de ${currentMeta.label}.`, 'info');
    }
  };

  // Ordenar lista alfabéticamente
  const handleSortAlphabetically = () => {
    const sorted = [...currentList].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    const newConfig: PlantaConfig = {
      ...plantaConfig,
      [activeCatalog]: sorted
    };
    onSavePlantaConfig(newConfig);
    showFeedback(`Catálogo de ${currentMeta.label} ordenado alfabéticamente.`);
  };

  // Carga Masiva
  const handleBulkAdd = () => {
    if (!bulkText.trim()) {
      showFeedback('Pega o escribe una lista de elementos para procesar.', 'error');
      return;
    }

    // Separar por saltos de línea, comas o puntos y coma
    const rawTokens = bulkText.split(/[\n,;]+/);
    const validItems: string[] = [];
    const duplicates: string[] = [];

    const currentLower = new Set(currentList.map(i => i.trim().toLowerCase()));

    rawTokens.forEach(t => {
      const clean = t.trim();
      if (clean) {
        const lower = clean.toLowerCase();
        if (currentLower.has(lower) || validItems.some(v => v.toLowerCase() === lower)) {
          duplicates.push(clean);
        } else {
          validItems.push(clean);
          currentLower.add(lower);
        }
      }
    });

    if (validItems.length === 0) {
      showFeedback('No se encontraron elementos nuevos para agregar (todos estaban duplicados o vacíos).', 'error');
      return;
    }

    const updatedList = [...currentList, ...validItems];
    const newConfig: PlantaConfig = {
      ...plantaConfig,
      [activeCatalog]: updatedList
    };

    onSavePlantaConfig(newConfig);
    setBulkText('');
    setShowBulkAdd(false);
    showFeedback(`Se agregaron ${validItems.length} nuevos elementos a ${currentMeta.label}.${duplicates.length > 0 ? ` (${duplicates.length} duplicados omitidos)` : ''}`);
  };

  // Restablecer valores predeterminados para este catálogo
  const handleResetCatalog = () => {
    const defaults = PLANTA_CONFIG_DEFAULT[activeCatalog] || [];
    if (window.confirm(`¿Deseas restablecer el catálogo de ${currentMeta.label} a sus valores predeterminados (${defaults.length} elementos)?`)) {
      const newConfig: PlantaConfig = {
        ...plantaConfig,
        [activeCatalog]: [...defaults]
      };
      onSavePlantaConfig(newConfig);
      showFeedback(`Catálogo de ${currentMeta.label} restablecido a los valores predeterminados.`);
    }
  };

  // Exportar a CSV
  const handleExportCSV = () => {
    const rows = [
      ['Categoría de Planta', 'Nombre / Valor', 'Lotes Asociados', 'Silos Asociados'],
      ...currentList.map(item => {
        const usage = calculateItemUsage(activeCatalog, item);
        return [currentMeta.label, `"${item.replace(/"/g, '""')}"`, usage.totalLotes, usage.totalSilos];
      })
    ];

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `catalogo_planta_${activeCatalog}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showFeedback(`Exportado catálogo de ${currentMeta.label} a CSV.`);
  };

  return (
    <div className="space-y-6">
      {/* Cabecera Principal de Planta */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-emerald-600/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                  <span>Base de Datos · Planta & Catálogos Maestros</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Fuente de Datos Activa
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Configuración manual y centralizada de listas maestras que alimentan los filtros de <strong className="text-slate-200">Lotes</strong> y <strong className="text-slate-200">Silos</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* Acciones Globales */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold border border-slate-700 transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Descargar este catálogo en formato CSV"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Exportar CSV</span>
            </button>
            <button
              onClick={handleResetCatalog}
              className="px-3.5 py-2 bg-slate-800/80 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 rounded-xl text-xs font-bold border border-slate-700/60 hover:border-rose-700/40 transition flex items-center gap-1.5 cursor-pointer"
              title="Restablecer este catálogo a sus valores originales del sistema"
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
              <span>Restablecer</span>
            </button>
          </div>
        </div>

        {/* Notificación Feedback */}
        {feedback && (
          <div className={`mt-4 p-3 rounded-xl border flex items-center gap-2.5 text-xs font-semibold animate-in fade-in duration-200 ${
            feedback.type === 'success' ? 'bg-emerald-950/80 border-emerald-600/50 text-emerald-200' :
            feedback.type === 'error' ? 'bg-rose-950/80 border-rose-600/50 text-rose-200' :
            'bg-sky-950/80 border-sky-600/50 text-sky-200'
          }`}>
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> :
             feedback.type === 'error' ? <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" /> :
             <Info className="w-4 h-4 text-sky-400 shrink-0" />}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Tarjetas de Selección Rápida de los 6 Catálogos */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6">
          {CATALOG_DEFINITIONS.map(cat => {
            const count = (plantaConfig[cat.key] || []).length;
            const isSelected = activeCatalog === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => {
                  setActiveCatalog(cat.key);
                  setSearchTerm('');
                  setEditingItemOriginal(null);
                }}
                className={`p-3.5 rounded-xl text-left transition-all relative border cursor-pointer ${
                  isSelected
                    ? `${cat.bgColor} ${cat.borderColor} ring-2 ring-emerald-500/40 shadow-lg scale-[1.02]`
                    : 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800 hover:border-slate-600 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={cat.color}>{cat.icon}</span>
                  <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                    isSelected ? cat.accentBadge : 'bg-slate-900 text-slate-400'
                  }`}>
                    {count}
                  </span>
                </div>
                <div className="text-xs font-bold text-white truncate">{cat.label}</div>
                <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                  {count} {count === 1 ? cat.singular.toLowerCase() : cat.label.toLowerCase()}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Panel Central del Catálogo Activo */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Barra Superior del Catálogo */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-xl border ${currentMeta.bgColor} ${currentMeta.borderColor} ${currentMeta.color}`}>
              {currentMeta.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Catálogo de {currentMeta.label}
                </h3>
                <span className="text-xs font-bold text-slate-600 bg-slate-200/80 px-2.5 py-0.5 rounded-full">
                  {currentList.length} total
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {currentMeta.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSortAlphabetically}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              title="Ordenar lista A-Z"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
              <span>Ordenar A-Z</span>
            </button>
            <button
              onClick={() => setShowBulkAdd(!showBulkAdd)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition flex items-center gap-1.5 cursor-pointer ${
                showBulkAdd
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-sm'
              }`}
            >
              <Upload className="w-3.5 h-3.5 text-emerald-600" />
              <span>{showBulkAdd ? 'Ocultar Carga Masiva' : 'Carga Masiva'}</span>
            </button>
          </div>
        </div>

        {/* Sección de Carga Masiva Expandible */}
        {showBulkAdd && (
          <div className="p-5 bg-emerald-50/50 border-b border-emerald-100 animate-in slide-in-from-top-2 duration-200">
            <div className="max-w-3xl">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-950 flex items-center gap-1.5 mb-1">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Agregar Múltiples {currentMeta.label} a la vez</span>
              </h4>
              <p className="text-xs text-slate-600 mb-3">
                Pega aquí una lista separada por saltos de línea, comas o puntos y coma. Los duplicados existentes se omitirán automáticamente.
              </p>
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={3}
                placeholder={`Ejemplo:\n${currentMeta.examples.join('\n')}`}
                className="w-full p-3 text-xs bg-white border border-emerald-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 placeholder-slate-400 font-mono"
              />
              <div className="flex items-center justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setBulkText('');
                    setShowBulkAdd(false);
                  }}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleBulkAdd}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3px]" />
                  <span>Procesar e Incorporar</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VISTA ESPECIALIZADA: GESTOR RELACIONAL DE VARIEDADES (ESPECIE + CLIENTE OBLIGATORIOS) */}
        {activeCatalog === 'variedades' ? (
          <div>
            {/* Formulario Especializado de Alta Relacional & Filtros en Cascada */}
            <div className="p-5 border-b border-slate-100 bg-purple-50/20 space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-purple-950 flex items-center gap-1.5">
                    <Dna className="w-4 h-4 text-purple-600" />
                    <span>Base de Datos de Variedades (Especies_DB × Clientes_DB)</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Catálogo oficial de variedades disponibles para la <strong className="text-slate-700">Precarga de Lotes</strong> e <strong className="text-slate-700">Ingreso a Silos</strong>.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-[11px] font-mono font-bold text-purple-800 bg-purple-100/80 px-2.5 py-1 rounded-lg border border-purple-200">
                    {variedadesDbList.length} variedades en BD
                  </div>
                  <button
                    type="button"
                    onClick={handleResetToOficialVariedades}
                    className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Restablece la base de datos a las 24 variedades oficiales (Soja - Don Mario, Stine, Pioneer)"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-800" />
                    <span>Restablecer 24 Oficiales</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBulkAddVariedades(!showBulkAddVariedades)}
                    className="px-3 py-1 bg-purple-100 hover:bg-purple-200 text-purple-900 border border-purple-300 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{showBulkAddVariedades ? 'Cerrar Carga Masiva' : 'Carga Masiva'}</span>
                  </button>
                </div>
              </div>

              {/* Panel de Carga Masiva de Variedades */}
              {showBulkAddVariedades && (
                <div className="p-4 bg-purple-100/60 border border-purple-300 rounded-xl space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-black text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-purple-700" />
                      <span>Carga Masiva de Variedades para Especie y Cliente</span>
                    </h5>
                    <span className="text-[10px] text-purple-800 font-semibold">
                      Separar con comas, punto y coma o saltos de línea
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Especie Destino *
                      </label>
                      <select
                        value={nuevaVariedadEspecie}
                        onChange={(e) => setNuevaVariedadEspecie(e.target.value)}
                        className="w-full px-3 py-2 bg-white text-xs font-semibold text-slate-800 rounded-lg border border-purple-300"
                      >
                        {plantaConfig.especies.map((esp) => (
                          <option key={`bulk-esp-${esp}`} value={esp}>
                            {esp}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Cliente Destino *
                      </label>
                      <select
                        value={nuevaVariedadCliente}
                        onChange={(e) => setNuevaVariedadCliente(e.target.value)}
                        className="w-full px-3 py-2 bg-white text-xs font-semibold text-slate-800 rounded-lg border border-purple-300"
                      >
                        {plantaConfig.clientes.map((cli) => (
                          <option key={`bulk-cli-${cli}`} value={cli}>
                            {cli}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Semillero (Carga Manual)
                      </label>
                      <input
                        type="text"
                        value={bulkVariedadSemillero}
                        onChange={(e) => setBulkVariedadSemillero(e.target.value)}
                        placeholder="Ej: Don Mario, Stine, Pioneer..."
                        className="w-full px-3 py-2 bg-white text-xs font-semibold text-slate-800 rounded-lg border border-purple-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Pegar lista de variedades *
                    </label>
                    <textarea
                      rows={3}
                      value={bulkTextVariedades}
                      onChange={(e) => setBulkTextVariedades(e.target.value)}
                      placeholder="Ej: DM40E25, 43EE53, P42A84SE, DM38E26..."
                      className="w-full p-2.5 bg-white text-xs font-mono font-bold text-slate-800 border border-purple-300 rounded-lg uppercase"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowBulkAddVariedades(false)}
                      className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleBulkAddVariedades}
                      className="px-4 py-1.5 text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-lg shadow-sm flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Procesar e Incorporar a BD</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Formulario de Alta Individual con Selectores de Especie, Cliente y Carga Manual de Semillero */}
              {plantaConfig.especies.length === 0 || plantaConfig.clientes.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                  <div>
                    <p className="font-bold">Se requieren Especies y Clientes registrados previamente.</p>
                    <p className="text-amber-700 mt-0.5">
                      Para dar de alta una variedad, primero debes cargar al menos una Especie en el catálogo de Especies y un Cliente en el catálogo de Clientes.
                    </p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleAddVariedadRelacional} className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-4 bg-white rounded-xl border border-purple-200/80 shadow-xs">
                  {/* 1. Nombre de la Variedad */}
                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Nombre de Variedad *
                    </label>
                    <input
                      type="text"
                      value={nuevaVariedadNombre}
                      onChange={(e) => setNuevaVariedadNombre(e.target.value)}
                      placeholder="Ej: DM40E25, 43EE53..."
                      className="w-full px-3 py-2 bg-slate-50 focus:bg-white text-xs font-bold text-slate-800 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 uppercase"
                      required
                    />
                  </div>

                  {/* 2. Selector de Especie (Especies_DB) */}
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Especie *
                    </label>
                    <select
                      value={nuevaVariedadEspecie}
                      onChange={(e) => setNuevaVariedadEspecie(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 focus:bg-white text-xs font-semibold text-slate-800 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      required
                    >
                      {plantaConfig.especies.map((esp) => (
                        <option key={esp} value={esp}>
                          {esp}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 3. Selector de Cliente (Clientes_DB) */}
                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Cliente *
                    </label>
                    <select
                      value={nuevaVariedadCliente}
                      onChange={(e) => setNuevaVariedadCliente(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 focus:bg-white text-xs font-semibold text-slate-800 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      required
                    >
                      {plantaConfig.clientes.map((cli) => (
                        <option key={cli} value={cli}>
                          {cli}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 4. Semillero (Carga Manual) */}
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Semillero (Manual)
                    </label>
                    <input
                      type="text"
                      value={nuevaVariedadSemillero}
                      onChange={(e) => setNuevaVariedadSemillero(e.target.value)}
                      placeholder="Ej: Don Mario, Stine..."
                      className="w-full px-3 py-2 bg-slate-50 focus:bg-white text-xs font-semibold text-slate-800 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  {/* 5. Botón de Agregar */}
                  <div className="sm:col-span-2 flex items-end">
                    <button
                      type="submit"
                      className="w-full py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-lg shadow-sm hover:shadow transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4 stroke-[3px]" />
                      <span>Registrar</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Filtros en Cascada Reactivos para la Tabla de Variedades */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0 font-bold uppercase">
                  <Filter className="w-3.5 h-3.5 text-purple-600" />
                  <span>Filtrar:</span>
                </div>

                {/* Filtro por Especie */}
                <div className="flex-1 sm:max-w-xs">
                  <select
                    value={filtroVariedadEspecie}
                    onChange={(e) => setFiltroVariedadEspecie(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white text-xs font-medium text-slate-700 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-xs"
                  >
                    <option value="TODAS">Especie: Todas ({plantaConfig.especies.length})</option>
                    {plantaConfig.especies.map((esp) => (
                      <option key={`filter-esp-${esp}`} value={esp}>
                        {esp}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filtro por Cliente */}
                <div className="flex-1 sm:max-w-xs">
                  <select
                    value={filtroVariedadCliente}
                    onChange={(e) => setFiltroVariedadCliente(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white text-xs font-medium text-slate-700 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-xs"
                  >
                    <option value="TODOS">Cliente: Todos ({plantaConfig.clientes.length})</option>
                    {plantaConfig.clientes.map((cli) => (
                      <option key={`filter-cli-${cli}`} value={cli}>
                        {cli}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filtro por Semillero */}
                <div className="flex-1 sm:max-w-xs">
                  <select
                    value={filtroVariedadSemillero}
                    onChange={(e) => setFiltroVariedadSemillero(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white text-xs font-medium text-slate-700 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-xs"
                  >
                    <option value="TODOS">Semillero: Todos ({semillerosDisponibles.length})</option>
                    {semillerosDisponibles.map((sem) => (
                      <option key={`filter-sem-${sem}`} value={sem}>
                        {sem}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Buscador de Texto */}
                <div className="flex-1 relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar variedad..."
                    className="w-full pl-8 pr-7 py-1.5 bg-white text-xs text-slate-800 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-xs"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* BARRA DE SELECCIÓN MÚLTIPLE Y ACCIONES MASIVAS */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-purple-100">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleSelectAllFilteredVariedades}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-purple-600" />
                    <span>Seleccionar Visibles ({filteredVariedadesDbList.length})</span>
                  </button>

                  {selectedVariedadesIds.length > 0 && (
                    <button
                      type="button"
                      onClick={handleDeselectAllVariedades}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-600 rounded-lg text-xs font-medium transition cursor-pointer"
                    >
                      Deseleccionar
                    </button>
                  )}

                  <span className="text-xs font-mono text-slate-500">
                    Mostrando <strong>{filteredVariedadesDbList.length}</strong> de <strong>{variedadesDbList.length}</strong> variedades
                  </span>
                </div>

                {selectedVariedadesIds.length > 0 && (
                  <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 p-1.5 rounded-xl animate-in fade-in">
                    <span className="text-xs font-bold text-rose-900 px-2">
                      {selectedVariedadesIds.length} seleccionada(s)
                    </span>
                    <button
                      type="button"
                      onClick={handleDeleteSelectedVariedades}
                      className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer active:scale-95"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Borrar Seleccionadas ({selectedVariedadesIds.length})</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Listado de Variedades Relacionales con Checkboxes */}
            <div className="p-5">
              {filteredVariedadesDbList.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-400 flex items-center justify-center mx-auto mb-3">
                    <Search className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-slate-700">
                    No se encontraron variedades para la combinación seleccionada.
                  </p>
                  <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                    {filtroVariedadEspecie !== 'TODAS' || filtroVariedadCliente !== 'TODOS' || searchTerm
                      ? 'Prueba ajustando los filtros de Especie, Cliente o el término de búsqueda, o utiliza el formulario superior para registrar una nueva variedad para esta combinación.'
                      : 'Utiliza el formulario superior para registrar la primera variedad asociada a una especie y cliente.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredVariedadesDbList.map((item) => {
                    const usage = calculateItemUsage('variedades', item.nombre);
                    const isEditing = editingVariedadId === item.id;
                    const isSelected = selectedVariedadesIds.includes(item.id);

                    return (
                      <div
                        key={item.id}
                        className={`p-4 rounded-xl border transition-all ${
                          isEditing
                            ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-400/40 shadow-md'
                            : isSelected
                            ? 'bg-purple-50/90 border-purple-400 ring-2 ring-purple-300 shadow-sm'
                            : 'bg-white hover:bg-slate-50/80 border-slate-200 shadow-xs'
                        }`}
                      >
                        {isEditing ? (
                          <div className="space-y-2.5">
                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                                Nombre
                              </label>
                              <input
                                type="text"
                                value={editingVariedadNombre}
                                onChange={(e) => setEditingVariedadNombre(e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-white text-xs font-bold text-slate-800 border border-amber-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 uppercase"
                              />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                                  Especie
                                </label>
                                <select
                                  value={editingVariedadEspecie}
                                  onChange={(e) => setEditingVariedadEspecie(e.target.value)}
                                  className="w-full px-2 py-1 bg-white text-xs font-semibold text-slate-800 border border-amber-400 rounded-lg focus:outline-none"
                                >
                                  {plantaConfig.especies.map((esp) => (
                                    <option key={esp} value={esp}>
                                      {esp}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                                  Cliente
                                </label>
                                <select
                                  value={editingVariedadCliente}
                                  onChange={(e) => setEditingVariedadCliente(e.target.value)}
                                  className="w-full px-2 py-1 bg-white text-xs font-semibold text-slate-800 border border-amber-400 rounded-lg focus:outline-none"
                                >
                                  {plantaConfig.clientes.map((cli) => (
                                    <option key={cli} value={cli}>
                                      {cli}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                                  Semillero (Manual)
                                </label>
                                <input
                                  type="text"
                                  value={editingVariedadSemillero}
                                  onChange={(e) => setEditingVariedadSemillero(e.target.value)}
                                  placeholder="Ej: Don Mario, Stine..."
                                  className="w-full px-2 py-1 bg-white text-xs font-semibold text-slate-800 border border-amber-400 rounded-lg focus:outline-none"
                                />
                              </div>
                            </div>
                            <div className="flex items-center justify-end gap-1.5 pt-1">
                              <button
                                type="button"
                                onClick={() => setEditingVariedadId(null)}
                                className="px-2.5 py-1 text-xs font-bold text-slate-600 bg-slate-200 hover:bg-slate-300 rounded-lg"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEditVariedad(item.id)}
                                className="px-3 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-1 shadow-xs"
                              >
                                <Check className="w-3.5 h-3.5 stroke-[3px]" />
                                <span>Guardar</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-start gap-2.5">
                                {/* Checkbox de Selección Múltiple */}
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleSelectVariedad(item.id)}
                                  className="mt-1 w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300 cursor-pointer"
                                />
                                <div>
                                  <h5 className="text-sm font-black text-slate-900 tracking-tight">
                                    {item.nombre}
                                  </h5>
                                  <div className="text-[10px] font-mono text-slate-400 truncate mt-0.5">
                                    ID: {item.id}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingVariedadId(item.id);
                                    setEditingVariedadNombre(item.nombre);
                                    setEditingVariedadEspecie(item.especie);
                                    setEditingVariedadCliente(item.cliente);
                                    setEditingVariedadSemillero(item.semillero || '');
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                                  title={`Editar variedad ${item.nombre}`}
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteVariedadRelacional(item)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                  title={`Eliminar variedad ${item.nombre}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Relaciones Explícitas en Badges de Alta Legibilidad */}
                            <div className="flex items-center gap-2 flex-wrap mb-2.5 ml-6">
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-md border border-emerald-300">
                                <Sprout className="w-3 h-3 text-emerald-700" />
                                <span>{item.especie}</span>
                              </span>
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-800 bg-sky-100/90 px-2 py-0.5 rounded-md border border-sky-300">
                                <Building2 className="w-3 h-3 text-sky-700" />
                                <span>{item.cliente}</span>
                              </span>
                              {item.semillero && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-800 bg-indigo-100/90 px-2 py-0.5 rounded-md border border-indigo-300">
                                  <Award className="w-3 h-3 text-indigo-700" />
                                  <span>Semillero: {item.semillero}</span>
                                </span>
                              )}
                            </div>

                            {/* Indicador de Uso en Planta */}
                            <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-slate-100 ml-6">
                              <span>Uso en Lotes / Silos:</span>
                              <span className="font-bold text-slate-700 font-mono">
                                {usage.totalLotes} lote(s) · {usage.totalSilos} silo(s)
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            {/* Formulario de Entrada Rápida Individual & Barra de Búsqueda para Otros Catálogos */}
            <div className="p-5 border-b border-slate-100 bg-white">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                {/* Input para Agregar Nuevo Manualmente */}
                <form onSubmit={handleAddItem} className="md:col-span-7 flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={newItemValue}
                      onChange={(e) => setNewItemValue(e.target.value)}
                      placeholder={currentMeta.placeholder}
                      className="w-full pl-3.5 pr-4 py-2.5 bg-slate-50 hover:bg-white focus:bg-white text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition shadow-inner"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-[#00603C] hover:bg-[#004d30] text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Plus className="w-4 h-4 stroke-[3px]" />
                    <span>Agregar {currentMeta.singular}</span>
                  </button>
                </form>

                {/* Input de Búsqueda dentro del Catálogo */}
                <div className="md:col-span-5 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={`Buscar en ${currentList.length} ${currentMeta.label.toLowerCase()}...`}
                    className="w-full pl-9 pr-8 py-2.5 bg-white text-xs text-slate-800 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Lista de Elementos en Tarjetas Interactivas */}
            <div className="p-5">
              {filteredList.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                    <Search className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-slate-700">
                    {searchTerm ? `No se encontraron coincidencias para "${searchTerm}"` : `No hay ${currentMeta.label.toLowerCase()} registradas.`}
                  </p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    {searchTerm ? 'Prueba con otro término de búsqueda o agrega un nuevo ítem.' : `Utiliza el campo superior para agregar la primera opción de ${currentMeta.singular.toLowerCase()}.`}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredList.map((item, idx) => {
                    const usage = calculateItemUsage(activeCatalog, item);
                    const isEditing = editingItemOriginal === item;

                    return (
                      <div
                        key={`${activeCatalog}-${item}-${idx}`}
                        className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                          isEditing
                            ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-400/40 shadow-md'
                            : 'bg-white hover:bg-slate-50/80 border-slate-200/80 hover:border-slate-300 shadow-xs'
                        }`}
                      >
                        {isEditing ? (
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="text"
                              value={editingItemText}
                              onChange={(e) => setEditingItemText(e.target.value)}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEdit(item);
                                if (e.key === 'Escape') setEditingItemOriginal(null);
                              }}
                              className="flex-1 px-2.5 py-1.5 bg-white text-xs font-bold text-slate-800 border border-amber-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(item)}
                              className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition cursor-pointer shadow-xs"
                              title="Guardar cambios"
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3px]" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingItemOriginal(null)}
                              className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition cursor-pointer"
                              title="Cancelar edición"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-800 truncate" title={item}>
                                  {item}
                                </span>
                              </div>

                              {/* Indicadores de uso real en Lotes y Silos */}
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {usage.totalLotes > 0 ? (
                                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60" title={`Asignado en ${usage.totalLotes} lote(s)`}>
                                    {usage.totalLotes} {usage.totalLotes === 1 ? 'lote' : 'lotes'}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                    0 lotes
                                  </span>
                                )}

                                {(activeCatalog === 'clientes' || activeCatalog === 'especies' || activeCatalog === 'variedades') && usage.totalSilos > 0 && (
                                  <span className="text-[10px] font-semibold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200/60" title={`Presente en ${usage.totalSilos} silo(s)`}>
                                    {usage.totalSilos} {usage.totalSilos === 1 ? 'silo' : 'silos'}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Botones de Acción (Editar / Eliminar) */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingItemOriginal(item);
                                  setEditingItemText(item);
                                }}
                                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                                title={`Editar "${item}"`}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(item)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                title={`Eliminar "${item}"`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pie Informativo de Integración */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Todos los cambios en esta hoja se sincronizan en tiempo real con los filtros de <strong className="text-slate-700">Lotes</strong> y <strong className="text-slate-700">Silos</strong>.
            </span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            {currentList.length} registros cargados
          </div>
        </div>
      </div>
    </div>
  );
};
