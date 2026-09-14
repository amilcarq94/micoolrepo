/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Lote, TipoLoteType, CategoriaType, TratamientoType, LoteLimitsConfig, MovimientoStock, SiloId, MovimientoSilo, PlantaConfig, EspecieType, getVariedadesVisibles, getVariedadesPorEspecie } from '../types';
import { formatKg } from '../utils/formatters';
import { validateLoteLimits, getLoteLimits } from '../utils/loteLimits';
import { getCampaniaIdFromDate } from '../utils/campanias';
import { generarLoteId } from '../utils/loteId';
import { CalculoBolsasDashboard } from './CalculoBolsasDashboard';
import { CategoriaEnvaseKg, LoteDesgloseItem, CalculoTransferConfig } from '../utils/calculoBolsas';
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
const CATEGORIAS: CategoriaType[] = ['Pre básica', 'Original', 'Primu'];

export interface LoteDraftItem {
  id: string;
  loteNro: string;
  tipo: TipoLoteType;
  categoria: CategoriaType;
  stockBolsas: number;
  kgPorBolsa: number;
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
  initialCalculoConfig?: CalculoTransferConfig | null;
  onClearInitialConfig?: () => void;
}

export const GenerarLoteView: React.FC<GenerarLoteViewProps> = ({
  lotes = [],
  clientes = ['San Diego Semillas', 'Eco Rural', 'Pampa', 'Stine', 'Elementa Foods'],
  especies = ['Soja', 'Trigo', 'Maíz', 'Cebada', 'Girasol', 'Sorgo', 'Garbanzo', 'Arveja'],
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
  initialCalculoConfig,
  onClearInitialConfig,
}) => {
  const activeLimits = loteLimits || getLoteLimits();

  // Submódulo activo: 'precarga-produccion' (reemplaza a Precarga de Lotes) | 'calculo-bolsas'
  const [activeSubModule, setActiveSubModule] = useState<'precarga-produccion' | 'calculo-bolsas'>('precarga-produccion');

  // Helper para buscar el mayor número correlativo
  const getNextLoteNumber = (offset = 0, currentList: LoteDraftItem[] = []) => {
    const existingNumbers = lotes
      .map(l => parseInt(l.loteNro.replace(/\D/g, ''), 10))
      .filter(n => !isNaN(n));
    
    const draftNumbers = currentList
      .map(l => parseInt(l.loteNro.replace(/\D/g, ''), 10))
      .filter(n => !isNaN(n));

    const allNumbers = [...existingNumbers, ...draftNumbers];
    const maxNum = allNumbers.length > 0 ? Math.max(...allNumbers) : 1000;
    return `L-${maxNum + 1 + offset}`;
  };

  // General configuration state (shared across the batch)
  const [cliente, setCliente] = useState('San Diego Semillas');
  const [especie, setEspecie] = useState('Soja');
  const [variedad, setVariedad] = useState('');
  const [ala, setAla] = useState('A');
  const [sector, setSector] = useState('1');
  const [observaciones, setObservaciones] = useState('');
  const [siloOrigenDetectado, setSiloOrigenDetectado] = useState<string | null>(null);

  // Lista de opciones de clientes incluyendo el cliente asignado
  const clientesOpciones = useMemo(() => {
    const list = [...clientes];
    if (cliente && cliente.trim() !== '' && !list.some(c => c.toLowerCase() === cliente.trim().toLowerCase())) {
      list.push(cliente.trim());
    }
    return list;
  }, [clientes, cliente]);

  // Lista de opciones de especies incluyendo la especie asignada
  const especiesOpciones = useMemo(() => {
    const list = [...especies];
    if (especie && especie.trim() !== '' && !list.some(e => e.toLowerCase() === especie.trim().toLowerCase())) {
      list.push(especie.trim());
    }
    return list;
  }, [especies, especie]);

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
        list = ['DM 46R18', 'CASUARINA', 'P46A03', 'BIO 4.50', 'STINE 4000', 'BAGUETTE 601'];
      }
    }
    // Si la variedad actual proviene de un silo o selección directa y no está en la lista, incluirla
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

  // Lista de categorías disponibles para precarga (incluye Primu y configuración de planta)
  const categoriasOpciones = useMemo(() => {
    const list: string[] = [...CATEGORIAS];
    if (plantaConfig?.categorias && Array.isArray(plantaConfig.categorias)) {
      plantaConfig.categorias.forEach((cat) => {
        if (
          cat &&
          !list.some((c) => c.toLowerCase() === cat.toLowerCase()) &&
          !cat.toLowerCase().includes('primera multiplicaci')
        ) {
          list.push(cat);
        }
      });
    }
    return list.filter((c) => !c.toLowerCase().includes('primera multiplicaci'));
  }, [plantaConfig]);

  // Draft lotes list state (presets: 35 bolsas x 800 kg)
  const [draftLotes, setDraftLotes] = useState<LoteDraftItem[]>(() => [
    {
      id: `draft-1-${Date.now()}`,
      loteNro: getNextLoteNumber(0),
      tipo: 'Intermedio',
      categoria: 'Pre básica',
      stockBolsas: 35, // PRECARGADO EN 35 UNIDADES
      kgPorBolsa: 800,  // PRECARGADO EN 800 KG
    }
  ]);

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
    // Copiar automáticamente Tipo y Categoría del Lote 1 precargado si existe
    const firstDraft = draftLotes[0];
    const defaultTipo = firstDraft?.tipo || 'Intermedio';
    const defaultCat = firstDraft?.categoria || 'Pre básica';

    setDraftLotes(prev => [
      ...prev,
      {
        id: `draft-${Date.now()}-${Math.random()}`,
        loteNro: nextNro,
        tipo: defaultTipo,
        categoria: defaultCat,
        stockBolsas: 35,
        kgPorBolsa: 800,
      }
    ]);
  };

  const handleAddMasivos = () => {
    const count = Math.max(1, Math.min(10, cantidadMasiva));
    const firstDraft = draftLotes[0];
    const defaultTipo = firstDraft?.tipo || 'Intermedio';
    const defaultCat = firstDraft?.categoria || 'Pre básica';

    const newItems: LoteDraftItem[] = [];
    for (let i = 0; i < count; i++) {
      newItems.push({
        id: `draft-${Date.now()}-${i}`,
        loteNro: getNextLoteNumber(i, draftLotes),
        tipo: defaultTipo,
        categoria: defaultCat,
        stockBolsas: 35,
        kgPorBolsa: 800,
      });
    }
    setDraftLotes(prev => [...prev, ...newItems]);
  };

  const handleRemoveDraftLote = (id: string) => {
    setDraftLotes(prev => {
      if (prev.length <= 1) return prev; // Mantener al menos 1
      return prev.filter(item => item.id !== id);
    });
  };

  const handleUpdateDraftLote = (id: string, field: keyof LoteDraftItem, value: any) => {
    setDraftLotes(prev => {
      const isFirst = prev.length > 0 && prev[0].id === id;

      return prev.map((item, idx) => {
        if (item.id === id) {
          return { ...item, [field]: value };
        }
        // Si se actualiza Tipo o Categoría en el Lote 1, copiar automáticamente a los lotes siguientes (2 en adelante)
        if (isFirst && (field === 'tipo' || field === 'categoria') && idx > 0) {
          return { ...item, [field]: value };
        }
        return item;
      });
    });
  };

  // Submit guardar todos los lotes
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      const fechaActual = new Date().toISOString().split('T')[0];
      const ubicacionStr = ala && sector ? `Ala ${ala} - Sector ${sector}` : 'Sin asignar';

      for (const draft of draftLotes) {
        const stockKgCalculado = draft.stockBolsas * draft.kgPorBolsa;
        const normNro = draft.loteNro.trim();
        const calculatedId = generarLoteId(cliente, normNro);

        // Buscar si ya existe
        const existingLote = lotes.find(
          l => l.loteNro?.trim().toLowerCase() === normNro.toLowerCase() ||
               l.id.toLowerCase() === calculatedId.toLowerCase()
        );

        let loteToSave: Lote;

        if (existingLote) {
          // Acumulación de stock
          const currentKg = existingLote.stockKg || 0;
          const currentBolsas = existingLote.stockBolsas || 0;
          const addKg = stockKgCalculado;
          const addBolsas = Number(draft.stockBolsas);

          const totalBolsasAcumuladas = currentBolsas + addBolsas;
          const totalKgAcumulados = currentKg + addKg;

          const nuevoMov: MovimientoStock = {
            id: `MOV-PRE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            fecha: fechaActual,
            tipo: 'Entrada manual',
            cantidadBolsas: addBolsas,
            kgPorBolsa: Number(draft.kgPorBolsa),
            cantidadKg: addKg,
            detalle: `Precarga de stock`
          };

          loteToSave = {
            ...existingLote,
            stockBolsas: totalBolsasAcumuladas,
            stockKg: totalKgAcumulados,
            estado: 'Disponible',
            especie: especie as EspecieType,
            variedad: variedad.trim() || existingLote.variedad,
            tipo: draft.tipo,
            categoria: draft.categoria,
            tratamiento: ['Sin Tratar'], // TRATAMIENTO POR DEFECTO SIN TRATAR
            producto: 'Ninguno',
            ala: ala || existingLote.ala,
            sector: sector || existingLote.sector,
            ubicacionAcopio: ubicacionStr,
            observaciones: observaciones.trim() || existingLote.observaciones,
            historial: [nuevoMov, ...(existingLote.historial || [])]
          };
        } else {
          // Alta nuevo
          const uniqueDocId = calculatedId;
          const nuevoMov: MovimientoStock = {
            id: `MOV-PRE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            fecha: fechaActual,
            tipo: 'Entrada manual',
            cantidadBolsas: Number(draft.stockBolsas),
            kgPorBolsa: Number(draft.kgPorBolsa),
            cantidadKg: stockKgCalculado,
            detalle: `Alta inicial en Precarga`
          };

          loteToSave = {
            id: uniqueDocId,
            loteNro: normNro,
            cliente: cliente.trim(),
            especie: especie as EspecieType,
            variedad: variedad.trim(),
            tipo: draft.tipo,
            categoria: draft.categoria,
            tratamiento: ['Sin Tratar'], // TRATAMIENTO POR DEFECTO SIN TRATAR
            producto: 'Ninguno',
            stockBolsas: Number(draft.stockBolsas),
            kgPorBolsa: Number(draft.kgPorBolsa),
            stockKg: stockKgCalculado,
            estado: 'Disponible',
            estadoRegistro: 'PRE-CARGA',
            silosOrigen: siloOrigenDetectado
              ? [{ siloId: siloOrigenDetectado as SiloId, kgExtraidos: stockKgCalculado }]
              : [],
            origenesBolson: [],
            numeroBolsonOrigen: '',
            bolsonOrigenNro: '',
            sectorBolsonOrigen: '',
            fechaIngreso: fechaActual,
            campaniaId: getCampaniaIdFromDate(fechaActual),
            ala,
            sector,
            ubicacionAcopio: ubicacionStr,
            observaciones: observaciones.trim(),
            historial: [nuevoMov]
          };
        }

        await onSaveLote(loteToSave);
      }

      setSuccessMsg(`¡${draftLotes.length} Lote(s) guardado(s) exitosamente en PRE-CARGA!`);

      // Redirigir de regreso a la lista de lotes después de guardar
      setTimeout(() => {
        onNavigateToLotes();
      }, 900);

    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al guardar los lotes en Precarga.');
    } finally {
      setIsSaving(false);
    }
  };

  // Callback para aplicar el resultado del Dashboard de Cálculo de Bolsas a los lotes en borrador
  const handleAplicarDesdeCalculoBolsas = (config: CalculoTransferConfig) => {
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

    // 2. Lotes a Generar: Pregenerar con la cantidad de lotes y bolsas determinadas en el cálculo
    const existingNumbers = lotes
      .map(l => parseInt(l.loteNro.replace(/\D/g, ''), 10))
      .filter(n => !isNaN(n));
    const baseMax = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 1000;

    const newDrafts: LoteDraftItem[] = [];

    if (config.desgloseLotes && config.desgloseLotes.length > 0) {
      config.desgloseLotes.forEach((item, i) => {
        newDrafts.push({
          id: `draft-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
          loteNro: `L-${baseMax + 1 + i}`,
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
          loteNro: `L-${baseMax + 1 + i}`,
          tipo: 'Intermedio',
          categoria: 'Pre básica',
          stockBolsas: config.stockBolsasPorLote || 35,
          kgPorBolsa: config.kgPorBolsa || 800,
        });
      }
    }

    setDraftLotes(newDrafts);
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
      `¡Lotes generados en precarga! Se pregeneraron ${newDrafts.length} lote(s) (${newDrafts.reduce((a, c) => a + c.stockBolsas, 0)} bolsas en total)${origenDetalle}.`
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
                  : 'Sección: Precarga de Producción'}
              </span>
              <span className="text-[10px] font-bold text-emerald-200 bg-emerald-800/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                AgroAbacus Suite
              </span>
            </div>
            <h2 className="font-serif text-2xl md:text-3xl font-bold mt-1">
              {activeSubModule === 'precarga-produccion'
                ? 'Precarga de Producción'
                : 'Dashboard: Cálculo de Bolsas'}
            </h2>
            <p className="text-xs text-emerald-100 max-w-2xl mt-1">
              {activeSubModule === 'precarga-produccion'
                ? 'Alta rápida individual o múltiple de lotes de producción (reemplaza a precarga de lotes). Precargado con 35 bolsas x 800 kg y tratamiento Sin tratar por defecto.'
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
                <span>Ir a Precarga de Producción</span>
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
            <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 flex items-center gap-3 shadow-2xs">
              <div className="p-2.5 bg-amber-100 rounded-xl text-amber-800 shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold text-amber-900 uppercase tracking-wider block">
                  Estado de Registro
                </span>
                <span className="text-xs font-bold text-amber-950">
                  PRE-CARGA (Mantiene libre de silos/bolsones)
                </span>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-4 flex items-center gap-3 shadow-2xs">
              <div className="p-2.5 bg-emerald-100 rounded-xl text-emerald-800 shrink-0">
                <Layers className="w-5 h-5 text-emerald-700" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold text-emerald-900 uppercase tracking-wider block">
                  Valores Precargados
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
                onChange={(e) => setCliente(e.target.value)}
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
        </div>

        {/* Sección 2: Alta Múltiple de Lotes (Generación rápida) */}
        <div className="space-y-4 pt-4 border-t border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
            <div>
              <h3 className="font-serif font-bold text-lg text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#00603C]" />
                2. Lotes a Generar ({draftLotes.length} lote{draftLotes.length !== 1 ? 's' : ''})
              </h3>
              <p className="text-xs text-slate-500">
                Puede dar de alta más de un lote a la vez. Cada lote viene precargado con **35 bolsas x 800 kg** (28.000 kg total).
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
                      <label className="block text-[10px] font-extrabold text-slate-700 uppercase mb-1">
                        N° de Lote *
                      </label>
                      <input
                        type="text"
                        value={item.loteNro}
                        onChange={(e) => handleUpdateDraftLote(item.id, 'loteNro', e.target.value)}
                        placeholder="Ej. L-1001"
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

                    {/* Kg por Bolsa */}
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-700 uppercase mb-1">
                        Kg / Bolsa *
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={item.kgPorBolsa}
                        onChange={(e) => handleUpdateDraftLote(item.id, 'kgPorBolsa', Number(e.target.value))}
                        className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-[#00603C]"
                        required
                      />
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
              Resumen Total a Precargar
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

          <button
            type="submit"
            disabled={isSaving}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 bg-[#00603C] hover:bg-[#254731] text-white rounded-xl text-xs font-extrabold uppercase tracking-wider shadow-lg transition disabled:opacity-50 cursor-pointer"
          >
            <Check className="w-4 h-4 text-amber-300" />
            <span>
              {isSaving
                ? 'Guardando lotes...'
                : draftLotes.length === 1
                  ? 'Guardar Lote en PRE-CARGA'
                  : `Guardar ${draftLotes.length} Lotes en PRE-CARGA`}
            </span>
          </button>
        </div>

      </form>
      </>
      )}
      </div>
    </div>
  );
};
