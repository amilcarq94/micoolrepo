/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Lote, TipoLoteType, CategoriaType, TratamientoType, LoteLimitsConfig, MovimientoStock, SiloId, MovimientoSilo, PlantaConfig, EspecieType, getVariedadesVisibles, getVariedadesPorEspecie, VARIEDADES_DB_DEFAULT } from '../types';
import { formatKg } from '../utils/formatters';
import { validateLoteLimits, getLoteLimits } from '../utils/loteLimits';
import { getCampaniaIdFromDate } from '../utils/campanias';
import { generarLoteId } from '../utils/loteId';
import { CalculoBolsasDashboard } from './CalculoBolsasDashboard';
import { CategoriaEnvaseKg, LoteDesgloseItem, CalculoTransferConfig } from '../utils/calculoBolsas';
import {
  getClientePrefijo,
  formatLoteNro,
  extractLoteNumber,
  getCorrelatividadCliente,
  CorrelatividadClienteInfo
} from '../utils/loteCorrelativo';
import { VisorCorrelatividadLote } from './VisorCorrelatividadLote';
import { generarCaratulaParaLote, generarBolsasParaLote } from '../utils/loteEspecUtils';
import { guardarCaratulaYBolsasFirestore } from '../lib/firebase';
import { generarBolsasParaCaratula, CaratulaItemFull } from './CaratulasView';
import { ColorFondoCaratula } from './CaratulaCard';
import {
  PackagePlus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  MapPin,
  ArrowLeft,
  Sparkles,
  Check,
  Plus,
  Trash2,
  Layers,
  FlaskConical,
  X,
  Calculator,
  FileText,
  Warehouse
} from 'lucide-react';

const TIPOS_LOTE: TipoLoteType[] = ['Intermedio', 'Final'];
const CATEGORIAS: CategoriaType[] = ['Preba', 'Original', 'Primu'];

export function extractKgFromEnvase(envaseStr: string, fallback = 800): number {
  if (!envaseStr) return fallback;
  const match = envaseStr.match(/(\d+)\s*kg/i);
  if (match) {
    const val = parseInt(match[1], 10);
    if (!isNaN(val) && val > 0) return val;
  }
  return fallback;
}

export interface LoteDraftItem {
  id: string;
  fecha: string;
  loteNro: string;
  tipo: string;
  origen: string;
  categoria: string;
  stockBolsas: number;
  envase: string;
  kgPorBolsa: number;
  tratamiento: string;
  estado: string;
}

interface GenerarLoteViewProps {
  lotes: Lote[];
  clientes?: string[];
  especies?: string[];
  plantaConfig?: PlantaConfig;
  loteLimits?: LoteLimitsConfig;
  siloStocks?: Record<SiloId, number>;
  movimientosSilo?: MovimientoSilo[];
  onSaveLote: (lote: Lote) => Promise<void> | void;
  onNavigateToLotes: () => void;
  onNavigateToCaratulas?: () => void;
  initialCalculoConfig?: CalculoTransferConfig | null;
  onClearInitialConfig?: () => void;
}

export const GenerarLoteView: React.FC<GenerarLoteViewProps> = ({
  lotes = [],
  clientes = ['San Diego Semillas', 'Eco Rural', 'Pampa', 'Stine', 'Elementa Foods'],
  especies = ['Soja'],
  plantaConfig,
  loteLimits,
  siloStocks = {
    'Silo 1': 0,
    'Silo 2': 0,
    'Silo 3': 0,
    'Silo 4': 0,
    'Silo 5': 0,
    'Silo 6': 0,
  },
  movimientosSilo = [],
  onSaveLote,
  onNavigateToLotes,
  onNavigateToCaratulas,
  initialCalculoConfig,
  onClearInitialConfig,
}) => {
  const activeLimits = loteLimits || getLoteLimits();

  // Submódulo activo: 'precarga-produccion' (reemplaza a Precarga de Lotes) | 'calculo-bolsas'
  const [activeSubModule, setActiveSubModule] = useState<'precarga-produccion' | 'calculo-bolsas'>('precarga-produccion');

  // General configuration state (shared across the batch)
  const [cliente, setCliente] = useState('San Diego Semillas');
  const [especie, setEspecie] = useState('Soja');
  const [variedad, setVariedad] = useState('');
  const [ala, setAla] = useState('A');
  const [sector, setSector] = useState('1');
  const [observaciones, setObservaciones] = useState('');
  const [siloOrigenDetectado, setSiloOrigenDetectado] = useState<string | null>(null);

  // Visor y correlatividad del cliente actual basada en el número más alto asignado (no por fecha)
  const correlatividadInfo = useMemo(() => {
    return getCorrelatividadCliente(cliente, lotes);
  }, [cliente, lotes]);

  // Helper para buscar el mayor número correlativo del cliente
  const getNextLoteNumber = (offset = 0, currentList: LoteDraftItem[] = [], targetCliente: string = cliente) => {
    const info = getCorrelatividadCliente(targetCliente, lotes);
    const prefijo = info.prefijo;

    // Buscar el número más alto entre los lotes ya guardados del cliente
    let highest = info.numeroMasAlto;

    // Y también buscar el número más alto entre los borradores actuales de la tanda
    currentList.forEach(d => {
      const num = extractLoteNumber(d.loteNro, prefijo);
      if (num !== null && num > highest) {
        highest = num;
      }
    });

    const nextVal = highest + 1 + offset;
    return formatLoteNro(prefijo, nextVal);
  };

  // Lista de opciones de clientes incluyendo el cliente asignado
  const clientesOpciones = useMemo(() => {
    const list = [...clientes];
    if (cliente && cliente.trim() !== '' && !list.some(c => c.toLowerCase() === cliente.trim().toLowerCase())) {
      list.push(cliente.trim());
    }
    return list;
  }, [clientes, cliente]);

  // Lista de opciones de especies estrictamente desde la Base de Datos
  const especiesOpciones = useMemo(() => {
    const dbEspecies = (plantaConfig?.especies && plantaConfig.especies.length > 0)
      ? plantaConfig.especies
      : (especies && especies.length > 0 ? especies : ['Soja']);
    return [...dbEspecies];
  }, [plantaConfig, especies]);

  // Lista de variedades estrictamente disponibles desde la Base de Datos o asignadas desde Silo
  const variedadesDisponibles = useMemo(() => {
    const dbList = plantaConfig?.variedadesDb;
    let list: string[] = [];
    // 1. Filtrar por Especie y Cliente seleccionados
    const visibles = getVariedadesVisibles(dbList, especie, cliente);
    if (visibles.length > 0) {
      list = Array.from(new Set(visibles.map(v => v.nombre.trim())));
    } else {
      // 2. Filtrar por Especie seleccionada
      const porEspecie = getVariedadesPorEspecie(dbList, especie);
      if (porEspecie.length > 0) {
        list = Array.from(new Set(porEspecie.map(v => v.nombre.trim())));
      } else if (plantaConfig?.variedades && plantaConfig.variedades.length > 0) {
        list = [...plantaConfig.variedades];
      } else {
        list = Array.from(new Set(VARIEDADES_DB_DEFAULT.map(v => v.nombre.trim())));
      }
    }
    // Si la variedad actual proviene de un silo o selección directa y está registrada en Data Bases, incluirla
    if (variedad && variedad.trim() !== '' && !list.some(v => v.toLowerCase() === variedad.trim().toLowerCase())) {
      list = [variedad.trim(), ...list];
    }
    return list;
  }, [plantaConfig, especie, cliente, variedad]);

  // Sincronizar automáticamente la variedad si está vacía
  useEffect(() => {
    if (variedadesDisponibles.length > 0) {
      if (!variedad) {
        setVariedad(variedadesDisponibles[0]);
      } else if (!variedadesDisponibles.some(v => v.toLowerCase() === variedad.toLowerCase())) {
        setVariedad(variedadesDisponibles[0]);
      }
    }
  }, [variedadesDisponibles, variedad]);

  // Opciones tomadas de Data Bases (plantaConfig)
  const tiposOpciones = useMemo(() => {
    if (plantaConfig?.tipos && plantaConfig.tipos.length > 0) {
      return plantaConfig.tipos;
    }
    return ['Intermedio', 'Final', 'Procesado', 'Semilla', 'Descarte', 'Bajo Consumo', 'Mezcla', 'Rechazo'];
  }, [plantaConfig?.tipos]);

  const origenesOpciones = useMemo(() => {
    if (plantaConfig?.silos && plantaConfig.silos.length > 0) {
      return plantaConfig.silos;
    }
    return ['Silo 1', 'Silo 2', 'Silo 3', 'Silo 4', 'Silo 5', 'Silo 6'];
  }, [plantaConfig?.silos]);

  const categoriasOpciones = useMemo(() => {
    if (plantaConfig?.categorias && Array.isArray(plantaConfig.categorias) && plantaConfig.categorias.length > 0) {
      return plantaConfig.categorias.filter((c) => !c.toLowerCase().includes('primera multiplicaci'));
    }
    return ['Fundadora', 'PreBase', 'Original', 'Primu', 'Segunda Multiplicación', 'Certificada', 'Identificada', 'Comercial'];
  }, [plantaConfig?.categorias]);

  const envasesOpciones = useMemo(() => {
    if (plantaConfig?.envases && plantaConfig.envases.length > 0) {
      return plantaConfig.envases;
    }
    return [
      'Big Bag x 800 kg',
      'Big Bag x 1000 kg',
      'Bolsa x 40 kg',
      'Bolsa x 25 kg',
      'Bolsa x 20 kg'
    ];
  }, [plantaConfig?.envases]);

  const tratamientosOpciones = useMemo(() => {
    if (plantaConfig?.tratamientos && plantaConfig.tratamientos.length > 0) {
      return plantaConfig.tratamientos;
    }
    return ['Sin Tratar', 'Tratado', 'Curado Completo', 'Fungicida', 'Insecticida', 'Inoculado'];
  }, [plantaConfig?.tratamientos]);

  const estadosOpciones = useMemo(() => {
    if (plantaConfig?.estados && plantaConfig.estados.length > 0) {
      return plantaConfig.estados;
    }
    return ['Sin Clasificar', 'Clasificado', 'Consumo', 'Descarte', 'Bloqueado'];
  }, [plantaConfig?.estados]);

  // Draft lotes list state con las 9 columnas: fecha/lote/tipo/origen/categoria/bolsas ingreso/envase/tratamiento/estado
  const [draftLotes, setDraftLotes] = useState<LoteDraftItem[]>(() => {
    const info = getCorrelatividadCliente('San Diego Semillas', lotes);
    const todayStr = new Date().toISOString().split('T')[0];
    const defaultTipo = plantaConfig?.tipos?.[0] || 'Intermedio';
    const defaultOrigen = plantaConfig?.silos?.[0] || 'Silo 1';
    const defaultCat = (plantaConfig?.categorias && plantaConfig.categorias.length > 0)
      ? plantaConfig.categorias.find((c) => c.toLowerCase() === 'primu') || plantaConfig.categorias[0]
      : 'Primu';
    const defaultEnv = plantaConfig?.envases?.[0] || 'Big Bag x 800 kg';
    const defaultTrat = 'Sin Tratar';
    const defaultEst = 'Sin Clasificar';

    return [
      {
        id: `draft-1-${Date.now()}`,
        fecha: todayStr,
        loteNro: formatLoteNro(info.prefijo, info.proximoNumero),
        tipo: defaultTipo,
        origen: defaultOrigen,
        categoria: defaultCat,
        stockBolsas: 35, // PRECARGADO EN 35 UNIDADES
        envase: defaultEnv,
        kgPorBolsa: extractKgFromEnvase(defaultEnv, 800),
        tratamiento: defaultTrat,
        estado: defaultEst,
      }
    ];
  });

  // Bandera para saber si el usuario editó manualmente algún número de lote
  const [haEditadoNroManualmente, setHaEditadoNroManualmente] = useState(false);

  // Sincronizar todos los borradores con la correlatividad del cliente especificado
  const handleSincronizarCorrelatividad = (targetCliente: string = cliente) => {
    const info = getCorrelatividadCliente(targetCliente, lotes);
    const prefijo = info.prefijo;
    const baseNum = info.proximoNumero;

    setDraftLotes((prev) =>
      prev.map((item, idx) => ({
        ...item,
        loteNro: formatLoteNro(prefijo, baseNum + idx),
      }))
    );
    setHaEditadoNroManualmente(false);
  };

  // Cambio de cliente: actualiza cliente y renombra los lotes con sus iniciales y correlativo correspondiente
  const handleClienteChange = (nuevoCliente: string) => {
    setCliente(nuevoCliente);
    handleSincronizarCorrelatividad(nuevoCliente);
  };

  const [cantidadMasiva, setCantidadMasiva] = useState<number>(3);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Totales acumulados del lote múltiple
  const totalKgBatch = useMemo(() => {
    return draftLotes.reduce((acc, curr) => acc + (curr.stockBolsas * curr.kgPorBolsa), 0);
  }, [draftLotes]);

  const totalBolsasBatch = useMemo(() => {
    return draftLotes.reduce((acc, curr) => acc + curr.stockBolsas, 0);
  }, [draftLotes]);

  // Handlers para agregar / quitar ítems de la lista
  const handleAddDraftLote = () => {
    const nextNro = getNextLoteNumber(0, draftLotes);
    const lastDraft = draftLotes[draftLotes.length - 1];
    const todayStr = new Date().toISOString().split('T')[0];

    const defaultTipo = lastDraft?.tipo || tiposOpciones[0] || 'Intermedio';
    const defaultOrigen = lastDraft?.origen || origenesOpciones[0] || 'Silo 1';
    const defaultCat = lastDraft?.categoria || categoriasOpciones[0] || 'Primu';
    const defaultEnv = lastDraft?.envase || envasesOpciones[0] || 'Big Bag x 800 kg';
    const defaultTrat = lastDraft?.tratamiento || 'Sin Tratar';
    const defaultEst = lastDraft?.estado || 'Sin Clasificar';

    setDraftLotes((prev) => [
      ...prev,
      {
        id: `draft-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        fecha: lastDraft?.fecha || todayStr,
        loteNro: nextNro,
        tipo: defaultTipo,
        origen: defaultOrigen,
        categoria: defaultCat,
        stockBolsas: lastDraft?.stockBolsas || 35,
        envase: defaultEnv,
        kgPorBolsa: extractKgFromEnvase(defaultEnv, 800),
        tratamiento: defaultTrat,
        estado: defaultEst,
      }
    ]);
  };

  const handleAddMasivos = () => {
    const count = Math.max(1, Math.min(20, cantidadMasiva || 1));
    const lastDraft = draftLotes[draftLotes.length - 1];
    const todayStr = new Date().toISOString().split('T')[0];

    const defaultTipo = lastDraft?.tipo || tiposOpciones[0] || 'Intermedio';
    const defaultOrigen = lastDraft?.origen || origenesOpciones[0] || 'Silo 1';
    const defaultCat = lastDraft?.categoria || categoriasOpciones[0] || 'Primu';
    const defaultEnv = lastDraft?.envase || envasesOpciones[0] || 'Big Bag x 800 kg';
    const defaultTrat = lastDraft?.tratamiento || 'Sin Tratar';
    const defaultEst = lastDraft?.estado || 'Sin Clasificar';

    const newItems: LoteDraftItem[] = [];
    for (let i = 0; i < count; i++) {
      newItems.push({
        id: `draft-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
        fecha: lastDraft?.fecha || todayStr,
        loteNro: getNextLoteNumber(i, draftLotes),
        tipo: defaultTipo,
        origen: defaultOrigen,
        categoria: defaultCat,
        stockBolsas: lastDraft?.stockBolsas || 35,
        envase: defaultEnv,
        kgPorBolsa: extractKgFromEnvase(defaultEnv, 800),
        tratamiento: defaultTrat,
        estado: defaultEst,
      });
    }
    setDraftLotes((prev) => [...prev, ...newItems]);
  };

  const handleRemoveDraftLote = (id: string) => {
    setDraftLotes((prev) => {
      if (prev.length <= 1) return prev; // Mantener al menos 1
      return prev.filter((item) => item.id !== id);
    });
  };

  const handleUpdateDraftLote = (id: string, field: keyof LoteDraftItem, value: any) => {
    setDraftLotes((prev) => {
      const isFirst = prev.length > 0 && prev[0].id === id;

      return prev.map((item, idx) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          if (field === 'envase') {
            updated.kgPorBolsa = extractKgFromEnvase(String(value), 800);
          }
          return updated;
        }
        // Si se actualiza en el Lote 1, propagar opciones de datos maestros si hay más filas
        if (
          isFirst &&
          (field === 'tipo' ||
            field === 'origen' ||
            field === 'categoria' ||
            field === 'envase' ||
            field === 'tratamiento' ||
            field === 'estado') &&
          idx > 0
        ) {
          const updated = { ...item, [field]: value };
          if (field === 'envase') {
            updated.kgPorBolsa = extractKgFromEnvase(String(value), 800);
          }
          return updated;
        }
        return item;
      });
    });
  };

  const handleUpdateDraftLoteMultiple = (id: string, updates: Partial<LoteDraftItem>) => {
    setDraftLotes((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  // Submit guardar todos los lotes
  const handleSubmit = async (e?: React.FormEvent, confirmarASinClasificar = true) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!cliente.trim()) {
      setErrorMsg('El campo Cliente es obligatorio.');
      return;
    }
    if (!variedad.trim()) {
      setErrorMsg('El campo Variedad es obligatorio.');
      return;
    }

    if (draftLotes.length === 0) {
      setErrorMsg('Debe ingresar al menos un lote para dar de alta.');
      return;
    }

    // Validar números de lote
    for (let i = 0; i < draftLotes.length; i++) {
      const item = draftLotes[i];
      if (!item.loteNro.trim()) {
        setErrorMsg(`El Lote #${i + 1} no tiene un N° de Lote asignado.`);
        return;
      }
      if (item.stockBolsas <= 0) {
        setErrorMsg(`El Lote ${item.loteNro} debe tener al menos 1 bolsa de stock.`);
        return;
      }
      if (item.kgPorBolsa <= 0) {
        setErrorMsg(`El Lote ${item.loteNro} debe tener un peso por bolsa mayor a cero.`);
        return;
      }
    }

    setIsSaving(true);

    try {
      const STORAGE_KEY = 'agro_abacus_caratulas_data_v2';
      let caratulasExistentes: CaratulaItemFull[] = [];
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) caratulasExistentes = parsed;
        }
      } catch (err) {
        console.error('Error al leer carátulas existentes:', err);
      }

      const nuevasCaratulasCreadas: CaratulaItemFull[] = [];

      for (let idx = 0; idx < draftLotes.length; idx++) {
        const draft = draftLotes[idx];
        const caratulaId = `caratula-${Date.now()}-${idx + 1}`;
        const loteNroStr = draft.loteNro.trim() || `000${idx + 1}`;
        const cantBolsas = Math.max(1, draft.stockBolsas || 35);
        const presentacionStr =
          draft.kgPorBolsa === 800
            ? 'Big Bag x 800 kg'
            : draft.kgPorBolsa === 25
            ? 'Bolsa x 25 kg'
            : draft.kgPorBolsa === 20
            ? 'Bolsa x 20 kg'
            : `Bolsa x ${draft.kgPorBolsa} kg`;
        const colorFinal: ColorFondoCaratula = draft.tipo === 'Final' ? 'rojo' : 'verde';
        const subtituloStr = variedad && variedad.trim() !== '' ? variedad.trim() : (observaciones || 'Subtítulo');

        const bolsasGeneradas = generarBolsasParaCaratula(
          caratulaId,
          loteNroStr,
          cantBolsas,
          cliente || 'Título 1',
          subtituloStr,
          draft.tipo,
          draft.categoria,
          presentacionStr,
          especie || 'Soja',
          colorFinal
        );

        const nuevaCaratulaItem: CaratulaItemFull = {
          id: caratulaId,
          loteNro: loteNroStr,
          titulo1: cliente || 'Título 1',
          subtitulo: subtituloStr,
          color: colorFinal,
          tipo: draft.tipo,
          categoria: draft.categoria,
          presentacion: presentacionStr,
          especie: especie || 'Soja',
          cantidadBolsas: cantBolsas,
          bolsas: bolsasGeneradas,
          createdAt: new Date().toISOString(),
        };

        nuevasCaratulasCreadas.push(nuevaCaratulaItem);

        // Opcional: respaldar en Firestore si está disponible
        try {
          await guardarCaratulaYBolsasFirestore(
            {
              id: caratulaId,
              loteId: loteNroStr,
              loteNro: loteNroStr,
              cliente: cliente || 'Título 1',
              especie: especie || 'Soja',
              variedad: subtituloStr,
              tipo: draft.tipo,
              categoria: draft.categoria,
              tratamiento: ['Sin Tratar'],
              color: colorFinal,
              titulo1: cliente || 'Título 1',
              subtitulo: subtituloStr,
              totalBolsas: cantBolsas,
              kgPorBolsa: draft.kgPorBolsa,
              fechaGeneracion: new Date().toISOString(),
              qrCodeUrl: typeof window !== 'undefined' ? `${window.location.origin}/?lote=${encodeURIComponent(loteNroStr)}` : '',
              activo: true,
            },
            bolsasGeneradas.map((b) => ({
              id: b.id,
              caratulaId,
              loteId: loteNroStr,
              bolsaNumero: b.bolsaNro,
              totalBolsas: b.totalBolsas,
              cliente: b.cliente,
              especie: b.especie,
              variedad: b.subtitulo,
              tipo: b.tipo,
              categoria: b.categoria,
              presentacion: b.presentacion,
              kg: draft.kgPorBolsa,
              estado: 'sin clasificar',
              activo: true,
              fecha: new Date().toISOString(),
            }))
          );
        } catch (e) {
          // ignore offline firestore errors
        }
      }

      // Guardar en localStorage para que la hoja Carátulas las lea de inmediato
      const actualizado = [...caratulasExistentes, ...nuevasCaratulasCreadas];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(actualizado));
      } catch (err) {
        console.error('Error al guardar carátulas en localStorage:', err);
      }

      setSuccessMsg(`✓ ¡${nuevasCaratulasCreadas.length} Carátula(s) generadas con éxito!`);

      // Redirigir de inmediato a la hoja "caratulas"
      setTimeout(() => {
        if (onNavigateToCaratulas) {
          onNavigateToCaratulas();
        } else {
          onNavigateToLotes();
        }
      }, 400);

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || 'Error al generar las carátulas.');
    } finally {
      setIsSaving(false);
    }
  };

  // Callback para aplicar el resultado del Dashboard de Cálculo de Bolsas a los lotes en borrador
  const handleAplicarDesdeCalculoBolsas = (config: CalculoTransferConfig) => {
    const targetCliente = (config.cliente && config.cliente.trim() !== '')
      ? config.cliente.trim()
      : cliente;

    // 1. Datos Generales de la Tanda: Copiar datos de cliente, variedad y especie si provienen del silo o cálculo
    if (config.cliente && config.cliente.trim() !== '') {
      setCliente(config.cliente.trim());
    }
    if (config.variedad && config.variedad.trim() !== '') {
      setVariedad(config.variedad.trim());
    }
    if (config.especie && config.especie.trim() !== '') {
      setEspecie(config.especie.trim());
    }
    if (config.silosOrigenNombres) {
      setSiloOrigenDetectado(config.silosOrigenNombres);
    } else if (config.siloOrigenId) {
      setSiloOrigenDetectado(config.siloOrigenId);
    }

    // 2. Lotes a Generar: Pregenerar con la correlatividad del cliente y la cantidad de lotes/bolsas del cálculo
    const infoCliente = getCorrelatividadCliente(targetCliente, lotes);
    const prefijo = infoCliente.prefijo;
    const baseNum = infoCliente.proximoNumero;

    const newDrafts: LoteDraftItem[] = [];

    if (config.desgloseLotes && config.desgloseLotes.length > 0) {
      config.desgloseLotes.forEach((item, i) => {
        newDrafts.push({
          id: `draft-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
          loteNro: formatLoteNro(prefijo, baseNum + i),
          tipo: 'Intermedio',
          categoria: 'Pre básica',
          stockBolsas: item.bolsas,
          kgPorBolsa: item.kgPorBolsa || config.kgPorBolsa || 800,
        });
      });
    } else {
      const count = Math.max(1, Math.min(50, Math.floor(config.cantidadLotes) || 1));
      for (let i = 0; i < count; i++) {
        newDrafts.push({
          id: `draft-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
          loteNro: formatLoteNro(prefijo, baseNum + i),
          tipo: 'Intermedio',
          categoria: 'Pre básica',
          stockBolsas: config.stockBolsasPorLote || 35,
          kgPorBolsa: config.kgPorBolsa || 800,
        });
      }
    }

    setDraftLotes(newDrafts);
    setHaEditadoNroManualmente(false);
    if (config.silosOrigenNombres) {
      setObservaciones((prev) => {
        const extra = `Estimado desde ${config.silosOrigenNombres} (${formatKg(config.totalKgNetos)} netos)`;
        return prev && !prev.includes(config.silosOrigenNombres!) ? `${prev} | ${extra}` : extra;
      });
    }
    setActiveSubModule('precarga-produccion');

    const origenDetalle = config.esDeSilo && config.cliente
      ? ` con datos de ${config.silosOrigenNombres || 'Silo'} (Cliente: "${config.cliente}", Variedad: "${config.variedad || 'N/A'}")`
      : '';
    setSuccessMsg(
      `¡Lotes generados listos para guardar! Se pregeneraron ${newDrafts.length} lote(s) (${newDrafts.reduce((a, c) => a + c.stockBolsas, 0)} bolsas en total)${origenDetalle}.`
    );
  };

  // Efecto para sincronizar configuración proveniente de la vista independiente "calculo-bolsas"
  useEffect(() => {
    if (initialCalculoConfig) {
      handleAplicarDesdeCalculoBolsas(initialCalculoConfig);
      if (onClearInitialConfig) {
        onClearInitialConfig();
      }
    }
  }, [initialCalculoConfig]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="space-y-6 print:hidden">
      {/* Header Banner - High Visibility Access */}
      <div className="bg-gradient-to-r from-emerald-950 via-[#00603C] to-slate-900 text-white rounded-2xl p-6 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-amber-500/20 rounded-2xl border border-amber-400/40 text-amber-300 shrink-0">
            {activeSubModule === 'calculo-bolsas' ? (
              <Calculator className="w-8 h-8" />
            ) : (
              <PackagePlus className="w-8 h-8" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold tracking-widest text-amber-300 uppercase bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20">
                {activeSubModule === 'calculo-bolsas'
                  ? 'Módulo de Ingeniería'
                  : 'Sección: Generar Lote (Sin Clasificar)'}
              </span>
              <span className="text-[10px] font-bold text-emerald-200 bg-emerald-800/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                AgroAbacus Suite
              </span>
            </div>
            <h2 className="font-serif text-2xl md:text-3xl font-bold mt-1">
              {activeSubModule === 'precarga-produccion'
                ? 'Generar Lote'
                : 'Dashboard: Cálculo de Bolsas'}
            </h2>
            <p className="text-xs text-emerald-100 max-w-2xl mt-1">
              {activeSubModule === 'precarga-produccion'
                ? 'Alta directa de lotes de producción para ingreso a existencia con identificación individual.'
                : 'Estimación matemática según stock en silos con kilos cargados manualmente, % merma y envases (25, 40, 800 kg).'}
            </p>
          </div>
        </div>

        {/* Action buttons: Sub-navigation & Volver */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveSubModule(activeSubModule === 'precarga-produccion' ? 'calculo-bolsas' : 'precarga-produccion')}
            className={`w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition cursor-pointer shadow-sm ${
              activeSubModule === 'calculo-bolsas'
                ? 'bg-white text-emerald-950 hover:bg-slate-100'
                : 'bg-amber-400 text-slate-950 hover:bg-amber-300'
            }`}
          >
            {activeSubModule === 'precarga-produccion' ? (
              <>
                <Calculator className="w-4 h-4 text-slate-950" />
                <span>Abrir Cálculo de Bolsas</span>
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 text-emerald-950" />
                <span>Ir a Generar Lote (Sin Clasificar)</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onNavigateToLotes}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition border border-white/20 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a Lotes</span>
          </button>
        </div>
      </div>

      {/* RENDERIZADO SEGÚN SUBMÓDULO ACTIVO */}
      {activeSubModule === 'calculo-bolsas' ? (
        <CalculoBolsasDashboard
          siloStocks={siloStocks}
          movimientosSilo={movimientosSilo}
          clientes={clientes}
          especies={especies}
          onAplicarAPrecarga={handleAplicarDesdeCalculoBolsas}
          onCerrar={() => setActiveSubModule('precarga-produccion')}
        />
      ) : (
        <>
          {/* Indicadores fijos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 flex items-center gap-3 shadow-2xs">
              <div className="p-2.5 bg-emerald-100 rounded-xl text-emerald-800 shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-700" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold text-emerald-900 uppercase tracking-wider block">
                  Estado de Registro
                </span>
                <span className="text-xs font-bold text-emerald-950">
                  ALTA DIRECTA DE LOTE EN EXISTENCIA
                </span>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-4 flex items-center gap-3 shadow-2xs">
              <div className="p-2.5 bg-emerald-100 rounded-xl text-emerald-800 shrink-0">
                <Layers className="w-5 h-5 text-emerald-700" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold text-emerald-900 uppercase tracking-wider block">
                  Valores a Dar de Alta
                </span>
                <span className="text-xs font-bold text-emerald-950">
                  {draftLotes[0]?.stockBolsas || 35} bolsas x {draftLotes[0]?.kgPorBolsa || 800} kg = {formatKg((draftLotes[0]?.stockBolsas || 35) * (draftLotes[0]?.kgPorBolsa || 800))}
                </span>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center gap-3 shadow-2xs">
              <div className="p-2.5 bg-slate-200 rounded-xl text-slate-800 shrink-0">
                <FlaskConical className="w-5 h-5 text-slate-700" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block">
                  Tratamiento Químico Fijo
                </span>
                <span className="text-xs font-bold text-slate-900">
                  Sin Tratar (Por defecto)
                </span>
              </div>
            </div>
          </div>

      {/* Alertas */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-4 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-4 rounded-xl flex items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-bold">{successMsg}</span>
          </div>
        </div>
      )}

      {/* Formulario Principal */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8 space-y-6">

        {/* Sección 1: Datos Generales (Compartidos por la tanda) */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between border-b border-gray-100 pb-2 gap-2">
            <h3 className="font-serif font-bold text-lg text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#00603C]" />
              1. Datos Generales de la Tanda
            </h3>
            {siloOrigenDetectado && (
              <span className="text-[11px] font-mono font-bold text-emerald-900 bg-emerald-100 px-3 py-1 rounded-xl border border-emerald-300 flex items-center gap-1.5 shadow-2xs animate-in fade-in">
                <Warehouse className="w-3.5 h-3.5 text-emerald-700" />
                Silo de Origen: {siloOrigenDetectado}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Cliente */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Cliente *
              </label>
              <select
                value={cliente}
                onChange={(e) => handleClienteChange(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#00603C]"
              >
                {clientesOpciones.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Especie */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Especie *
              </label>
              <select
                value={especie}
                onChange={(e) => setEspecie(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#00603C]"
              >
                {especiesOpciones.map(esp => (
                  <option key={esp} value={esp}>{esp}</option>
                ))}
              </select>
            </div>

            {/* Variedad */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Variedad (Base de Datos) *
                </label>
                {variedadesDisponibles.length > 0 && (
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md">
                    {variedadesDisponibles.length} en BD
                  </span>
                )}
              </div>
              {variedadesDisponibles.length > 0 ? (
                <select
                  value={variedad}
                  onChange={(e) => setVariedad(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#00603C]"
                  required
                >
                  <option value="">-- Seleccionar Variedad Existente * --</option>
                  {variedadesDisponibles.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={variedad}
                  onChange={(e) => setVariedad(e.target.value)}
                  placeholder="Ingrese variedad existente..."
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#00603C]"
                  required
                />
              )}
            </div>
          </div>

          {/* Ubicación Galpón */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Ala de Acopio *
              </label>
              <select
                value={ala}
                onChange={(e) => setAla(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
              >
                <option value="A">Ala A</option>
                <option value="B">Ala B</option>
                <option value="C">Ala C</option>
                <option value="D">Ala D</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Sector de Acopio *
              </label>
              <select
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
              >
                <option value="1">Sector 1</option>
                <option value="2">Sector 2</option>
                <option value="3">Sector 3</option>
              </select>
            </div>
          </div>

          {/* Visor de Correlatividad de Lotes por Cliente */}
          <VisorCorrelatividadLote
            info={correlatividadInfo}
            cantidadLotesEnTanda={draftLotes.length}
            onSincronizarDrafts={() => handleSincronizarCorrelatividad(cliente)}
            className="mt-2"
          />
        </div>

        {/* Sección 2: Alta Múltiple de Lotes (Generación rápida) */}
        <div className="space-y-4 pt-4 border-t border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-serif font-bold text-lg text-slate-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-[#00603C]" />
                  2. Lotes a Generar ({draftLotes.length} lote{draftLotes.length !== 1 ? 's' : ''})
                </h3>
                <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-300 flex items-center gap-1">
                  Correlativo Cliente: <span className="text-emerald-950 font-black">{correlatividadInfo.proximoLoteNro}</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Numeración automática correlativa con iniciales para {cliente}. Cada lote viene precargado con **35 bolsas x 800 kg** (28.000 kg total).
              </p>
            </div>

            {/* Herramienta de alta en ráfaga */}
            <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200 shrink-0">
              <span className="text-[11px] font-bold text-slate-700 pl-1">Añadir ráfaga:</span>
              <input
                type="number"
                min="1"
                max="10"
                value={cantidadMasiva}
                onChange={(e) => setCantidadMasiva(Number(e.target.value))}
                className="w-12 px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-center"
              />
              <button
                type="button"
                onClick={handleAddMasivos}
                className="px-2.5 py-1 bg-[#00603C] hover:bg-[#254731] text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar</span>
              </button>
            </div>
          </div>

          {/* Lista de tarjetas de lotes a precargar */}
          <div className="space-y-4">
            {draftLotes.map((item, idx) => {
              const itemKgTotal = item.stockBolsas * item.kgPorBolsa;
              return (
                <div
                  key={item.id}
                  className="bg-slate-50/80 border border-slate-200 hover:border-emerald-500/50 rounded-2xl p-4 transition shadow-2xs space-y-3 relative group"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-[#00603C] text-white text-xs font-extrabold flex items-center justify-center font-mono">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                        Lote #{idx + 1}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      {item.stockBolsas === 35 ? (
                        <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-300">
                          1 Lote Natural (35 bolsas)
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300">
                          Lote Fraccionario ({item.stockBolsas} b. = {(item.stockBolsas / 35).toFixed(1)} lote)
                        </span>
                      )}

                      <span className="text-xs font-mono font-bold text-slate-800 bg-slate-200/80 px-2.5 py-0.5 rounded-full border border-slate-300">
                        {item.stockBolsas} bolsas x {item.kgPorBolsa} kg = {formatKg(itemKgTotal)}
                      </span>

                      {draftLotes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveDraftLote(item.id)}
                          className="text-slate-400 hover:text-red-600 p-1 rounded-lg transition cursor-pointer"
                          title="Eliminar este lote de la lista"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
                    {/* N° de Lote */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[10px] font-extrabold text-slate-700 uppercase">
                          N° de Lote *
                        </label>
                        <span className="text-[9px] font-mono font-bold text-emerald-800 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                          {correlatividadInfo.prefijo}
                        </span>
                      </div>
                      <input
                        type="text"
                        value={item.loteNro}
                        onChange={(e) => {
                          setHaEditadoNroManualmente(true);
                          handleUpdateDraftLote(item.id, 'loteNro', e.target.value);
                        }}
                        placeholder={`Ej. ${formatLoteNro(correlatividadInfo.prefijo, correlatividadInfo.proximoNumero + idx)}`}
                        className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-[#00603C]"
                        required
                      />
                    </div>

                    {/* Tipo de Lote */}
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-700 uppercase mb-1">
                        Tipo de Lote *
                      </label>
                      <select
                        value={item.tipo}
                        onChange={(e) => handleUpdateDraftLote(item.id, 'tipo', e.target.value as TipoLoteType)}
                        className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                      >
                        {TIPOS_LOTE.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    {/* Categoría */}
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-700 uppercase mb-1">
                        Categoría *
                      </label>
                      <select
                        id={`select-categoria-draft-${item.id}`}
                        value={item.categoria}
                        onChange={(e) => handleUpdateDraftLote(item.id, 'categoria', e.target.value as CategoriaType)}
                        className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#00603C]"
                      >
                        {categoriasOpciones.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    {/* Stock Bolsas */}
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-700 uppercase mb-1">
                        Stock Bolsas *
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={item.stockBolsas}
                        onChange={(e) => handleUpdateDraftLote(item.id, 'stockBolsas', Number(e.target.value))}
                        className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-[#00603C]"
                        required
                      />
                    </div>

                    {/* Envase */}
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-700 uppercase mb-1">
                        Envase *
                      </label>
                      <select
                        value={item.kgPorBolsa}
                        onChange={(e) => handleUpdateDraftLote(item.id, 'kgPorBolsa', Number(e.target.value))}
                        className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-[#00603C]"
                      >
                        <option value={800}>x 800 kg (Big Bag)</option>
                        <option value={25}>x 25 kg (Bolsa)</option>
                        <option value={20}>x 20 kg (Bolsa)</option>
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleAddDraftLote}
            className="w-full py-3 bg-emerald-50 hover:bg-emerald-100/80 text-[#00603C] font-extrabold text-xs uppercase tracking-wider rounded-xl border border-dashed border-[#00603C]/40 transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
          >
            <Plus className="w-4 h-4 text-[#C9922E]" />
            <span>+ Agregar otro lote a la tanda</span>
          </button>
        </div>

        {/* Sección 3: Observaciones de Tanda */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-bold text-slate-700 uppercase">
              Observaciones de Tanda (Opcional)
            </label>
            <span className={`text-[10px] font-mono font-bold ${observaciones.length > 180 ? 'text-amber-600' : 'text-slate-400'}`}>
              {observaciones.length}/200 caracteres
            </span>
          </div>
          <textarea
            rows={2}
            maxLength={200}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value.slice(0, 200))}
            placeholder="Observaciones generales para los lotes cargados (máx. 200 caracteres)..."
            className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#00603C]"
          />
        </div>

        {/* Resumen total de la tanda */}
        <div className="bg-gradient-to-r from-emerald-900 to-slate-900 text-white p-4 rounded-xl flex items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-amber-300 block">
              Resumen Total a Generar
            </span>
            <span className="text-sm font-bold text-white">
              {draftLotes.length} Lote{draftLotes.length !== 1 ? 's' : ''} — {totalBolsasBatch} Bolsas en total
            </span>
          </div>
          <div className="text-right">
            <span className="text-xs font-mono font-extrabold text-emerald-300 text-lg">
              {formatKg(totalKgBatch)}
            </span>
          </div>
        </div>

        {/* Botones de acción finales */}
        <div className="pt-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <button
            type="button"
            onClick={onNavigateToLotes}
            className="w-full sm:w-auto px-6 py-3 text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
          >
            <X className="w-4 h-4" />
            <span>Volver sin guardar</span>
          </button>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              id="btn-generar-lote-confirmar"
              disabled={isSaving}
              onClick={() => handleSubmit()}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg transition disabled:opacity-50 cursor-pointer border border-emerald-400 active:scale-95"
              title="Generar carátulas: genera las carátulas e ID de bolsas y pasa a la hoja Carátulas"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-200" />
              <span>
                {isSaving
                  ? 'Generando carátulas...'
                  : draftLotes.length === 1
                    ? 'Generar Carátula'
                    : `Generar Carátulas (${draftLotes.length})`}
              </span>
            </button>
          </div>
        </div>

      </form>
      </>
      )}
      </div>
    </div>
  );
};
