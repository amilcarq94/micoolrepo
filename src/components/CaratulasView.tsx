/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PlantaConfig } from '../types';
import {
  CaratulaCard,
  CaratulaData,
  ColorFondoCaratula,
  AbacusLogo,
} from './CaratulaCard';
import {
  IdBolsaCaratulaCard,
  BolsaCaratulaData,
} from './IdBolsaCaratulaCard';
import { printWithActiveClass } from '../utils/printHelper';
import {
  exportElementAsPdf,
  exportIdBolsasPagesAsPdf,
  exportCaratulaAndBolsasCombinedPdf,
} from '../utils/exportPdf';
import {
  Printer,
  Download,
  Plus,
  Trash2,
  Copy,
  Layers,
  Sliders,
  Check,
  CheckCircle2,
  Sparkles,
  QrCode,
  Tag,
  Palette,
  Package,
  Wand2,
  ArrowRight,
  RefreshCw,
  Search,
  Eye,
  FileText,
  SlidersHorizontal,
  LayoutGrid,
  SquareCheck,
  ExternalLink,
  ChevronRight,
  Hash,
  Loader2,
  FileDown,
  AlertTriangle,
  X,
} from 'lucide-react';
import {
  eliminarCaratulaYBolsasFirestore,
  guardarCaratulaYBolsasFirestore,
} from '../lib/firebase';

export interface CaratulaItemFull extends CaratulaData {
  bolsas: BolsaCaratulaData[];
  createdAt: string;
}

interface CaratulasViewProps {
  plantaConfig?: PlantaConfig;
}

/**
 * Incrementa correlativamente un número de lote respetando ceros y prefijos alfanuméricos.
 * Ejemplos:
 * "0000" -> "0001", "0002"
 * "ER-042" -> "ER-043"
 * "SD-1" -> "SD-2"
 * "LOTE 09" -> "LOTE 10"
 */
export function incrementarLoteCorrelativo(loteBase: string, incremento: number): string {
  if (incremento === 0) return loteBase;
  const match = loteBase.match(/^(.*?)(\d+)$/);
  if (match) {
    const prefix = match[1];
    const digits = match[2];
    const nextVal = parseInt(digits, 10) + incremento;
    const padded = String(nextVal).padStart(digits.length, '0');
    return `${prefix}${padded}`;
  }
  return `${loteBase}-${incremento + 1}`;
}

/**
 * Genera el arreglo de bolsas correlativas para una carátula dada
 */
export function generarBolsasParaCaratula(
  caratulaId: string,
  loteNro: string,
  cantidad: number,
  cliente: string,
  subtitulo: string,
  tipo: string,
  categoria: string,
  presentacion: string,
  especie: string,
  color: ColorFondoCaratula
): BolsaCaratulaData[] {
  const bolsas: BolsaCaratulaData[] = [];
  const total = Math.max(1, cantidad);
  for (let i = 1; i <= total; i++) {
    bolsas.push({
      id: `${caratulaId}-b-${i}`,
      bolsaNro: i,
      totalBolsas: total,
      loteNro,
      cliente,
      subtitulo,
      tipo,
      categoria,
      presentacion,
      especie,
      color,
    });
  }
  return bolsas;
}

/**
 * Divide un arreglo en sub-arreglos de tamaño fijo (por ejemplo 7 bolsas por página A4)
 */
function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

const STORAGE_KEY = 'agro_abacus_caratulas_data_v2';

const TIPOS_PREDEFINIDOS = ['Final', 'Intermedio', 'Procesado', 'Semilla', 'Descarte', 'Bajo Consumo', 'Mezcla', 'Rechazo'];
const CATEGORIAS_PREDEFINIDAS = ['Fundadora', 'PreBase', 'Original', 'PRIMU', 'Segunda Multiplicación', 'Certificada', 'Identificada', 'Comercial'];
const PRESENTACIONES_PREDEFINIDAS = [
  'Big Bag x 800 kg',
  'Big Bag x 1000 kg',
  'Bolsa x 40 kg',
  'Bolsa x 25 kg',
  'Bolsa x 20 kg',
  'Bolsa x 50 kg',
];
const ESPECIES_PREDEFINIDAS = ['Soja', 'Trigo', 'Arveja'];

export const CaratulasView: React.FC<CaratulasViewProps> = ({ plantaConfig }) => {
  // Tomar datos de Data Bases (plantaConfig) para Tipo, Categoría, Especie y Presentación
  const tiposDisponibles = useMemo(() => {
    if (plantaConfig?.tipos && plantaConfig.tipos.length > 0) {
      return Array.from(new Set([...plantaConfig.tipos, ...TIPOS_PREDEFINIDOS]));
    }
    return TIPOS_PREDEFINIDOS;
  }, [plantaConfig?.tipos]);

  const categoriasDisponibles = useMemo(() => {
    if (plantaConfig?.categorias && plantaConfig.categorias.length > 0) {
      return Array.from(new Set([...plantaConfig.categorias, ...CATEGORIAS_PREDEFINIDAS]));
    }
    return CATEGORIAS_PREDEFINIDAS;
  }, [plantaConfig?.categorias]);

  const especiesDisponibles = useMemo(() => {
    if (plantaConfig?.especies && plantaConfig.especies.length > 0) {
      return Array.from(new Set([...plantaConfig.especies, ...ESPECIES_PREDEFINIDAS]));
    }
    return ESPECIES_PREDEFINIDAS;
  }, [plantaConfig?.especies]);

  const presentacionesDisponibles = PRESENTACIONES_PREDEFINIDAS;

  // 1. Estado de Carátulas guardadas
  const [caratulas, setCaratulas] = useState<CaratulaItemFull[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Error al cargar carátulas guardadas:', e);
    }
    // Carátula inicial por defecto según el modelo oficial adjunto
    const initialId = 'caratula-default-1';
    const initLote = '0000';
    const initBolsas = generarBolsasParaCaratula(
      initialId,
      initLote,
      35,
      'Título 1',
      'Subtítulo',
      'Intermedio',
      'PRIMU',
      'Big Bag x 800 kg',
      'Soja',
      'verde'
    );
    return [
      {
        id: initialId,
        loteNro: initLote,
        titulo1: 'Título 1',
        subtitulo: 'Subtítulo',
        color: 'verde',
        tipo: 'Intermedio',
        categoria: 'PRIMU',
        presentacion: 'Big Bag x 800 kg',
        especie: 'Soja',
        cantidadBolsas: 35,
        bolsas: initBolsas,
        createdAt: new Date().toISOString(),
      },
    ];
  });

  // Carátula actualmente seleccionada: por defecto siempre la ÚLTIMA carátula creada
  const [selectedCaratulaId, setSelectedCaratulaId] = useState<string>(() => {
    return caratulas[caratulas.length - 1]?.id || 'caratula-default-1';
  });

  // Al ingresar a la hoja Carátulas, asegurar que esté seleccionada la última carátula creada
  useEffect(() => {
    if (caratulas.length > 0) {
      setSelectedCaratulaId(caratulas[caratulas.length - 1].id);
    }
  }, []);

  // Pestaña visual activa: 'caratula' | 'bolsas' | 'dividida'
  const [activeTab, setActiveTab] = useState<'caratula' | 'bolsas' | 'dividida'>('dividida');

  // Modal para Generación Automática Múltiple
  const [showAutoModal, setShowAutoModal] = useState<boolean>(false);
  const [autoCantidadCaratulas, setAutoCantidadCaratulas] = useState<number>(3);
  const [autoLoteInicial, setAutoLoteInicial] = useState<string>('0001');
  const [autoBolsasPorCaratula, setAutoBolsasPorCaratula] = useState<number>(35);
  const [autoColor, setAutoColor] = useState<ColorFondoCaratula>('verde');
  const [autoTitulo1, setAutoTitulo1] = useState<string>('Título 1');
  const [autoSubtitulo, setAutoSubtitulo] = useState<string>('Subtítulo');
  const [autoTipo, setAutoTipo] = useState<string>('Intermedio');
  const [autoCategoria, setAutoCategoria] = useState<string>('PRIMU');
  const [autoPresentacion, setAutoPresentacion] = useState<string>('Big Bag x 800 kg');
  const [autoEspecie, setAutoEspecie] = useState<string>('Soja');

  // Modal para Edición Individual de Bolsa
  const [bolsaAEditar, setBolsaAEditar] = useState<BolsaCaratulaData | null>(null);

  // Modal para Confirmación de Eliminación de Carátula
  const [caratulaAEliminar, setCaratulaAEliminar] = useState<CaratulaItemFull | null>(null);
  const [isDeletingCaratula, setIsDeletingCaratula] = useState<boolean>(false);

  // Filtro de búsqueda en la grilla de bolsas
  const [searchBolsa, setSearchBolsa] = useState<string>('');

  // Notificación temporal
  const [notificacion, setNotificacion] = useState<string>('');
  const mostrarMensaje = (msg: string) => {
    setNotificacion(msg);
    setTimeout(() => setNotificacion(''), 3000);
  };

  // Estados de Descarga de PDF
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [pdfProgress, setPdfProgress] = useState<{ current: number; total: number } | null>(null);

  // Guardar en localStorage ante cambios
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(caratulas));
    } catch (e) {
      console.error('Error al guardar carátulas en localStorage:', e);
    }
  }, [caratulas]);

  // Carátula activa actual
  const caratulaActiva = useMemo(() => {
    return caratulas.find((c) => c.id === selectedCaratulaId) || caratulas[0];
  }, [caratulas, selectedCaratulaId]);

  // Si cambia el ID y no existe, apuntar a la primera
  useEffect(() => {
    if (!caratulaActiva && caratulas.length > 0) {
      setSelectedCaratulaId(caratulas[0].id);
    }
  }, [caratulaActiva, caratulas]);

  // Páginas de bolsas agrupadas en 7 por hoja A4 (formato estricto oficial Agro Abacus)
  const paginasDeBolsas = useMemo(() => {
    if (!caratulaActiva) return [];
    return chunkArray(caratulaActiva.bolsas, 7);
  }, [caratulaActiva?.bolsas]);

  // Carátulas ordenadas en orden numérico descendente para el selector desplegable
  const caratulasOrdenadasDesc = useMemo(() => {
    return [...caratulas].sort((a, b) => {
      const matchA = a.loteNro.match(/\d+/g);
      const matchB = b.loteNro.match(/\d+/g);
      const numA = matchA ? parseInt(matchA.join(''), 10) : 0;
      const numB = matchB ? parseInt(matchB.join(''), 10) : 0;
      if (numB !== numA) return numB - numA;
      return b.loteNro.localeCompare(a.loteNro, undefined, { numeric: true });
    });
  }, [caratulas]);

  // =========================================================================
  // MANEJADORES DE EDICIÓN DE CARÁTULA
  // =========================================================================

  const handleUpdateCaratulaField = (
    field: keyof CaratulaData,
    value: any,
    sincronizarBolsas = true
  ) => {
    if (!caratulaActiva) return;

    setCaratulas((prev) =>
      prev.map((c) => {
        if (c.id !== caratulaActiva.id) return c;

        const updated: CaratulaItemFull = {
          ...c,
          [field]: value,
        };

        if (sincronizarBolsas) {
          updated.bolsas = updated.bolsas.map((b) => ({
            ...b,
            loteNro: field === 'loteNro' ? String(value) : b.loteNro,
            cliente: field === 'titulo1' ? String(value) : b.cliente,
            subtitulo: field === 'subtitulo' ? String(value) : b.subtitulo,
            color: field === 'color' ? (value as ColorFondoCaratula) : b.color,
          }));
        }

        return updated;
      })
    );
  };

  const handleChangeCantidadBolsas = (nuevaCantidad: number) => {
    if (!caratulaActiva) return;
    const cant = Math.max(1, Math.min(500, nuevaCantidad || 1));

    setCaratulas((prev) =>
      prev.map((c) => {
        if (c.id !== caratulaActiva.id) return c;
        const nuevasBolsas = generarBolsasParaCaratula(
          c.id,
          c.loteNro,
          cant,
          c.titulo1,
          c.subtitulo,
          c.tipo,
          c.categoria,
          c.presentacion,
          c.especie,
          c.color
        );
        return {
          ...c,
          cantidadBolsas: cant,
          bolsas: nuevasBolsas,
        };
      })
    );
    mostrarMensaje(`Cantidad ajustada a ${cant} bolsas correlativas.`);
  };

  // =========================================================================
  // REPLICAR EN TODAS LAS BOLSAS
  // Botones: Tipo, Categoria, Presentacion, Especie
  // =========================================================================

  const handleReplicarEnTodasLasBolsas = (valoresParciales?: {
    tipo?: string;
    categoria?: string;
    presentacion?: string;
    especie?: string;
  }) => {
    if (!caratulaActiva) return;

    const tipoFinal = valoresParciales?.tipo || caratulaActiva.tipo;
    const categoriaFinal = valoresParciales?.categoria || caratulaActiva.categoria;
    const presentacionFinal = valoresParciales?.presentacion || caratulaActiva.presentacion;
    const especieFinal = valoresParciales?.especie || caratulaActiva.especie;

    setCaratulas((prev) =>
      prev.map((c) => {
        if (c.id !== caratulaActiva.id) return c;
        return {
          ...c,
          tipo: tipoFinal,
          categoria: categoriaFinal,
          presentacion: presentacionFinal,
          especie: especieFinal,
          bolsas: c.bolsas.map((b) => ({
            ...b,
            tipo: tipoFinal,
            categoria: categoriaFinal,
            presentacion: presentacionFinal,
            especie: especieFinal,
            cliente: c.titulo1,
            subtitulo: c.subtitulo,
            loteNro: c.loteNro,
            color: c.color,
          })),
        };
      })
    );

    mostrarMensaje('✓ Valores replicados con éxito en todas las bolsas de esta carátula.');
  };

  const handleGuardarBolsaIndividual = (bolsaActualizada: BolsaCaratulaData) => {
    if (!caratulaActiva) return;

    setCaratulas((prev) =>
      prev.map((c) => {
        if (c.id !== caratulaActiva.id) return c;
        return {
          ...c,
          bolsas: c.bolsas.map((b) => (b.id === bolsaActualizada.id ? bolsaActualizada : b)),
        };
      })
    );

    setBolsaAEditar(null);
    mostrarMensaje(`✓ Bolsa N° ${String(bolsaActualizada.bolsaNro).padStart(2, '0')} actualizada.`);
  };

  // =========================================================================
  // GENERADOR AUTOMÁTICO DE CARÁTULAS CORRELATIVAS
  // =========================================================================

  const handleEjecutarGeneradorAutomatico = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Math.max(1, Math.min(100, autoCantidadCaratulas || 1));
    const bolsasQty = Math.max(1, Math.min(500, autoBolsasPorCaratula || 35));
    const baseLote = autoLoteInicial.trim() || '0001';

    const nuevasCaratulas: CaratulaItemFull[] = [];

    for (let i = 0; i < qty; i++) {
      const loteCorr = incrementarLoteCorrelativo(baseLote, i);
      const id = `caratula-${Date.now()}-${i + 1}`;
      const bolsas = generarBolsasParaCaratula(
        id,
        loteCorr,
        bolsasQty,
        autoTitulo1,
        autoSubtitulo,
        autoTipo,
        autoCategoria,
        autoPresentacion,
        autoEspecie,
        autoColor
      );

      nuevasCaratulas.push({
        id,
        loteNro: loteCorr,
        titulo1: autoTitulo1,
        subtitulo: autoSubtitulo,
        color: autoColor,
        tipo: autoTipo,
        categoria: autoCategoria,
        presentacion: autoPresentacion,
        especie: autoEspecie,
        cantidadBolsas: bolsasQty,
        bolsas,
        createdAt: new Date().toISOString(),
      });
    }

    setCaratulas((prev) => [...prev, ...nuevasCaratulas]);
    if (nuevasCaratulas.length > 0) {
      setSelectedCaratulaId(nuevasCaratulas[nuevasCaratulas.length - 1].id);
      // Respaldar en Firestore en segundo plano
      for (const nc of nuevasCaratulas) {
        guardarCaratulaYBolsasFirestore(nc, nc.bolsas).catch((err) =>
          console.warn('Aviso guardando carátula en Firestore:', err)
        );
      }
    }
    setShowAutoModal(false);
    mostrarMensaje(`✓ Se generaron ${qty} carátulas correlativas con ${bolsasQty} bolsas cada una.`);
  };

  const handleCrearNuevaCaratula = () => {
    const ultimoLote = caratulas[caratulas.length - 1]?.loteNro || '0000';
    const nextLote = incrementarLoteCorrelativo(ultimoLote, 1);
    const newId = `caratula-${Date.now()}`;
    const newBolsas = generarBolsasParaCaratula(
      newId,
      nextLote,
      35,
      caratulaActiva?.titulo1 || 'Título 1',
      caratulaActiva?.subtitulo || 'Subtítulo',
      caratulaActiva?.tipo || 'Intermedio',
      caratulaActiva?.categoria || 'PRIMU',
      caratulaActiva?.presentacion || 'Big Bag x 800 kg',
      caratulaActiva?.especie || 'Soja',
      caratulaActiva?.color || 'verde'
    );

    const nueva: CaratulaItemFull = {
      id: newId,
      loteNro: nextLote,
      titulo1: caratulaActiva?.titulo1 || 'Título 1',
      subtitulo: caratulaActiva?.subtitulo || 'Subtítulo',
      color: caratulaActiva?.color || 'verde',
      tipo: caratulaActiva?.tipo || 'Intermedio',
      categoria: caratulaActiva?.categoria || 'PRIMU',
      presentacion: caratulaActiva?.presentacion || 'Big Bag x 800 kg',
      especie: caratulaActiva?.especie || 'Soja',
      cantidadBolsas: 35,
      bolsas: newBolsas,
      createdAt: new Date().toISOString(),
    };

    setCaratulas((prev) => [...prev, nueva]);
    setSelectedCaratulaId(newId);
    // Respaldar en Firestore en segundo plano
    guardarCaratulaYBolsasFirestore(nueva, newBolsas).catch((err) =>
      console.warn('Aviso guardando nueva carátula en Firestore:', err)
    );
    mostrarMensaje(`✓ Nueva Carátula Lote ${nextLote} creada.`);
  };

  const handleDuplicarCaratula = () => {
    if (!caratulaActiva) return;
    const nextLote = incrementarLoteCorrelativo(caratulaActiva.loteNro, 1);
    const newId = `caratula-dup-${Date.now()}`;
    const dupBolsas = generarBolsasParaCaratula(
      newId,
      nextLote,
      caratulaActiva.cantidadBolsas,
      caratulaActiva.titulo1,
      caratulaActiva.subtitulo,
      caratulaActiva.tipo,
      caratulaActiva.categoria,
      caratulaActiva.presentacion,
      caratulaActiva.especie,
      caratulaActiva.color
    );

    const duplicada: CaratulaItemFull = {
      ...caratulaActiva,
      id: newId,
      loteNro: nextLote,
      bolsas: dupBolsas,
      createdAt: new Date().toISOString(),
    };

    setCaratulas((prev) => [...prev, duplicada]);
    setSelectedCaratulaId(newId);
    // Respaldar en Firestore en segundo plano
    guardarCaratulaYBolsasFirestore(duplicada, dupBolsas).catch((err) =>
      console.warn('Aviso guardando carátula duplicada en Firestore:', err)
    );
    mostrarMensaje(`✓ Carátula duplicada como Lote ${nextLote}.`);
  };

  const handleSolicitarEliminarCaratula = (caratula: CaratulaItemFull) => {
    setCaratulaAEliminar(caratula);
  };

  const handleConfirmarEliminarCaratula = async () => {
    if (!caratulaAEliminar) return;
    const idAEliminar = caratulaAEliminar.id;
    const loteNroEliminado = caratulaAEliminar.loteNro;
    const bolsasIds = caratulaAEliminar.bolsas?.map((b) => b.id) || [];

    setIsDeletingCaratula(true);

    try {
      // 1. Eliminar permanentemente de la base de datos Firestore (carátula e IDs de bolsas)
      await eliminarCaratulaYBolsasFirestore(idAEliminar, bolsasIds);

      // 2. Eliminar del estado de la aplicación y localStorage
      if (caratulas.length <= 1) {
        // Si era la única existente, reiniciar a plantilla limpia por defecto
        const resetId = `caratula-default-${Date.now()}`;
        const defaultBolsas = generarBolsasParaCaratula(
          resetId,
          '0000',
          35,
          'Título 1',
          'Subtítulo',
          'Intermedio',
          'PRIMU',
          'Big Bag x 800 kg',
          'Soja',
          'verde'
        );
        const resetCaratula: CaratulaItemFull = {
          id: resetId,
          loteNro: '0000',
          titulo1: 'Título 1',
          subtitulo: 'Subtítulo',
          color: 'verde',
          tipo: 'Intermedio',
          categoria: 'PRIMU',
          presentacion: 'Big Bag x 800 kg',
          especie: 'Soja',
          cantidadBolsas: 35,
          bolsas: defaultBolsas,
          createdAt: new Date().toISOString(),
        };
        setCaratulas([resetCaratula]);
        setSelectedCaratulaId(resetId);
        guardarCaratulaYBolsasFirestore(resetCaratula, defaultBolsas).catch((e) => console.warn(e));
        mostrarMensaje(`✓ Carátula Lote ${loteNroEliminado} e ID de bolsas eliminados de la app y base de datos.`);
      } else {
        const restantes = caratulas.filter((c) => c.id !== idAEliminar);
        setCaratulas(restantes);
        if (selectedCaratulaId === idAEliminar) {
          setSelectedCaratulaId(restantes[restantes.length - 1].id);
        }
        mostrarMensaje(`✓ Carátula Lote ${loteNroEliminado} e ID de bolsas eliminados de la app y base de datos.`);
      }

      setCaratulaAEliminar(null);
    } catch (err) {
      console.error('Error al eliminar carátula de base de datos:', err);
      // Mantener la app funcional ante problemas de red
      const restantes = caratulas.filter((c) => c.id !== idAEliminar);
      if (restantes.length > 0) {
        setCaratulas(restantes);
        if (selectedCaratulaId === idAEliminar) {
          setSelectedCaratulaId(restantes[restantes.length - 1].id);
        }
      }
      setCaratulaAEliminar(null);
      mostrarMensaje(`✓ Carátula Lote ${loteNroEliminado} eliminada en app (error sincronizando con base de datos).`);
    } finally {
      setIsDeletingCaratula(false);
    }
  };

  // =========================================================================
  // DESCARGA EN FORMATO PDF
  // Aplica los mismos principios de alta fidelidad que Ficha de Lote e ID de Lote
  // 1. Descargar Carátula (PDF) con exportWithHtml2Pdf
  // 2. Descargar ID Bolsas (PDF) con exportIdBolsasPagesAsPdf
  // 3. Descargar Todo (PDF) con exportCaratulaAndBolsasCombinedPdf
  // =========================================================================

  const handleDescargarCaratulaPdf = async () => {
    if (!caratulaActiva) return;
    try {
      setIsExportingPdf(true);
      setPdfProgress({ current: 1, total: 1 });
      const safeLote = (caratulaActiva.loteNro || '0000').replace(/[\s/\\:*?"<>|]/g, '_');
      const fileName = `Caratula_Lote_${safeLote}_${new Date().toISOString().slice(0, 10)}.pdf`;

      // Seleccionar el contenedor oficial de la carátula activa (mismo principio que Ficha de Lote)
      const targetElement =
        document.getElementById('caratula-preview-card-element') ||
        (document.querySelector('.caratula-a4-sheet') as HTMLElement) ||
        document.getElementById('caratula-pdf-export-sheet');

      if (!targetElement) {
        throw new Error('Elemento de Carátula para PDF no encontrado');
      }

      const ok = await exportElementAsPdf(targetElement, fileName, {
        scale: 2.0,
        quality: 0.98,
        margin: [6, 8, 6, 8],
      });

      if (ok) {
        mostrarMensaje(`✓ Carátula descargada en PDF (${fileName})`);
      } else {
        mostrarMensaje('No se pudo generar el archivo PDF de la carátula.');
      }
    } catch (err) {
      console.error('Error al descargar Carátula en PDF:', err);
      mostrarMensaje('Error al generar PDF de la carátula.');
    } finally {
      setIsExportingPdf(false);
      setPdfProgress(null);
    }
  };

  const handleDescargarIdBolsasPdf = async () => {
    if (!caratulaActiva) return;
    try {
      setIsExportingPdf(true);
      const totalPages = paginasDeBolsas.length;
      setPdfProgress({ current: 1, total: totalPages });
      const safeLote = (caratulaActiva.loteNro || '0000').replace(/[\s/\\:*?"<>|]/g, '_');
      const fileName = `ID_Bolsas_Lote_${safeLote}_${caratulaActiva.bolsas.length}_etiquetas_${new Date().toISOString().slice(0, 10)}.pdf`;

      // Breve pausa para asegurar renderizado completo en el DOM offscreen y de fuentes tipográficas
      await new Promise((r) => setTimeout(r, 120));

      const sheetElements = paginasDeBolsas
        .map((_, idx) => document.getElementById(`caratula-bolsas-sheet-${idx}`))
        .filter(Boolean) as HTMLElement[];

      if (sheetElements.length === 0) {
        throw new Error('No se encontraron páginas de ID bolsas para exportar');
      }

      const ok = await exportIdBolsasPagesAsPdf(
        sheetElements,
        fileName,
        { scale: 2.0, quality: 0.98 },
        (current, total) => setPdfProgress({ current, total })
      );

      if (ok) {
        mostrarMensaje(`✓ ID de Bolsas descargadas en PDF (${fileName})`);
      } else {
        mostrarMensaje('No se pudo generar el PDF de ID Bolsas.');
      }
    } catch (err) {
      console.error('Error al descargar ID Bolsas en PDF:', err);
      mostrarMensaje('Error al generar PDF de ID Bolsas.');
    } finally {
      setIsExportingPdf(false);
      setPdfProgress(null);
    }
  };

  const handleDescargarTodoPdf = async () => {
    if (!caratulaActiva) return;
    try {
      setIsExportingPdf(true);
      const totalSheets = 1 + paginasDeBolsas.length;
      setPdfProgress({ current: 1, total: totalSheets });

      const safeLote = (caratulaActiva.loteNro || '0000').replace(/[\s/\\:*?"<>|]/g, '_');
      const fileName = `Caratula_e_ID_Bolsas_Lote_${safeLote}_${new Date().toISOString().slice(0, 10)}.pdf`;

      await new Promise((r) => setTimeout(r, 120));

      const caratulaEl =
        document.getElementById('caratula-preview-card-element') ||
        (document.querySelector('.caratula-a4-sheet') as HTMLElement) ||
        document.getElementById('caratula-pdf-export-sheet');

      const sheetElements = paginasDeBolsas
        .map((_, idx) => document.getElementById(`caratula-bolsas-sheet-${idx}`))
        .filter(Boolean) as HTMLElement[];

      if (!caratulaEl) {
        throw new Error('Elemento de Carátula no encontrado');
      }

      const ok = await exportCaratulaAndBolsasCombinedPdf(
        caratulaEl,
        sheetElements,
        fileName,
        (current, total) => setPdfProgress({ current, total })
      );

      if (ok) {
        mostrarMensaje(`✓ Documento completo descargado en PDF (${fileName})`);
      } else {
        mostrarMensaje('No se pudo generar el PDF combinado.');
      }
    } catch (err) {
      console.error('Error al descargar Todo en PDF:', err);
      mostrarMensaje('Error al exportar PDF combinado.');
    } finally {
      setIsExportingPdf(false);
      setPdfProgress(null);
    }
  };

  // =========================================================================
  // IMPRESIÓN DIRECTA (@media print)
  // =========================================================================

  const [printMode, setPrintMode] = useState<'caratula' | 'bolsas' | 'todo'>('caratula');
  const printContainerRef = useRef<HTMLDivElement>(null);

  const handleImprimir = async (mode: 'caratula' | 'bolsas' | 'todo') => {
    setPrintMode(mode);
    setTimeout(async () => {
      await printWithActiveClass('seccion-impresion-caratulas');
    }, 150);
  };

  // Bolsas filtradas para visualización en pantalla
  const bolsasFiltradas = useMemo(() => {
    if (!caratulaActiva) return [];
    if (!searchBolsa.trim()) return caratulaActiva.bolsas;
    const query = searchBolsa.toLowerCase().trim();
    return caratulaActiva.bolsas.filter(
      (b) =>
        String(b.bolsaNro).includes(query) ||
        b.loteNro.toLowerCase().includes(query) ||
        b.cliente.toLowerCase().includes(query) ||
        b.categoria.toLowerCase().includes(query) ||
        b.tipo.toLowerCase().includes(query) ||
        b.especie.toLowerCase().includes(query)
      );
  }, [caratulaActiva, searchBolsa]);

  if (!caratulaActiva) {
    return (
      <div className="p-8 text-center text-slate-500">
        Cargando módulo de carátulas...
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300">
      {/* NOTIFICACIÓN FLOTANTE */}
      {notificacion && (
        <div className="fixed top-5 right-5 z-50 bg-[#00603C] text-white px-5 py-3 rounded-2xl shadow-2xl font-bold text-xs flex items-center gap-2 border border-emerald-400/50 animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-300" />
          <span>{notificacion}</span>
        </div>
      )}

      {/* OVERLAY DE PROGRESO DE EXPORTACIÓN PDF */}
      {isExportingPdf && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 text-[#00603C] flex items-center justify-center shadow-inner">
              <Loader2 className="w-7 h-7 animate-spin" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                Generando documento PDF...
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                {pdfProgress
                  ? `Procesando hoja ${pdfProgress.current} de ${pdfProgress.total} en alta resolución...`
                  : 'Preparando páginas A4 de alta fidelidad...'}
              </p>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-[#00603C] h-2 transition-all duration-300 rounded-full"
                style={{
                  width: pdfProgress
                    ? `${Math.max(10, Math.round((pdfProgress.current / pdfProgress.total) * 100))}%`
                    : '40%',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ENCABEZADO PRINCIPAL DE LA HOJA "CARÁTULAS" */}
      <div className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#00603C] p-2 flex items-center justify-center shadow-sm shrink-0">
              <img
                src="/assets/aistudio/Dise_o_sin_t_tulo_b4c334ee.png"
                alt="Agro Abacus S.A."
                className="w-full h-full object-contain filter brightness-0 invert"
              />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 font-sans tracking-tight flex items-center gap-2">
                <span>Carátulas e ID de Bolsas</span>
                <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-[#00603C] border border-emerald-300 uppercase">
                  Agro Abacus S.A.
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5 font-medium">
                Generación oficial de carátulas de lote e identificación de bolsas con QR trazable e integración a Data Bases.
              </p>
            </div>
          </div>
        </div>

        {/* ACCIONES SUPERIORES: BOTONES DE DESCARGA PDF, GENERAR EN LOTE, IMPRIMIR */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* BOTÓN GENERAR EN LOTE */}
          <button
            type="button"
            id="btn-generar-automatico"
            onClick={() => {
              setAutoLoteInicial(incrementarLoteCorrelativo(caratulaActiva.loteNro, 1));
              setAutoTitulo1(caratulaActiva.titulo1);
              setAutoSubtitulo(caratulaActiva.subtitulo);
              setAutoColor(caratulaActiva.color);
              setAutoTipo(caratulaActiva.tipo);
              setAutoCategoria(caratulaActiva.categoria);
              setAutoPresentacion(caratulaActiva.presentacion);
              setAutoEspecie(caratulaActiva.especie);
              setShowAutoModal(true);
            }}
            className="px-3.5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer active:scale-95"
            title="Generar carátulas automáticamente con cantidad deseada y número correlativo de lote"
          >
            <Wand2 className="w-4 h-4 text-slate-950" />
            <span>Generar en Lote</span>
          </button>

          {/* BOTÓN NUEVA CARÁTULA */}
          <button
            type="button"
            id="btn-nueva-caratula"
            onClick={handleCrearNuevaCaratula}
            className="px-3 py-2.5 bg-[#00603C] hover:bg-[#004d30] text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
            title="Agregar una nueva carátula individual"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Carátula</span>
          </button>

          {/* =========================================================================
              BOTONES REQUERIDOS: DESCARGAR CARÁTULA E ID DE BOLSAS EN FORMATO PDF
              ========================================================================= */}
          <div className="flex items-center gap-1 bg-emerald-50/80 p-1 rounded-xl border border-emerald-200">
            <button
              type="button"
              id="btn-descargar-caratula-pdf"
              onClick={handleDescargarCaratulaPdf}
              disabled={isExportingPdf}
              className="px-3 py-2 bg-white hover:bg-emerald-50 text-emerald-950 text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow-2xs cursor-pointer border border-emerald-200/60"
              title="Descargar carátula de este lote en formato PDF A4 listo para imprimir"
            >
              <Download className="w-3.5 h-3.5 text-[#00603C]" />
              <span>Descargar Carátula (PDF)</span>
            </button>

            <button
              type="button"
              id="btn-descargar-bolsas-pdf"
              onClick={handleDescargarIdBolsasPdf}
              disabled={isExportingPdf}
              className="px-3 py-2 bg-white hover:bg-emerald-50 text-emerald-950 text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow-2xs cursor-pointer border border-emerald-200/60"
              title="Descargar etiquetas ID de bolsas de este lote en formato PDF A4 (7 por página)"
            >
              <Download className="w-3.5 h-3.5 text-amber-700" />
              <span>Descargar ID Bolsas (PDF)</span>
            </button>

            <button
              type="button"
              id="btn-descargar-todo-pdf"
              onClick={handleDescargarTodoPdf}
              disabled={isExportingPdf}
              className="px-3 py-2 bg-[#00603C] hover:bg-[#004d30] text-white text-xs font-black rounded-lg transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="Descargar Carátula + todas las ID de bolsas en un solo archivo PDF multipágina"
            >
              <FileDown className="w-3.5 h-3.5 text-emerald-200" />
              <span>Descargar Todo (PDF)</span>
            </button>
          </div>

          {/* Botones de Impresión Directa */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              id="btn-imprimir-caratula"
              onClick={() => handleImprimir('caratula')}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold rounded-lg transition flex items-center gap-1 shadow-2xs cursor-pointer"
              title="Imprimir carátula oficial en hoja A4 completa"
            >
              <Printer className="w-3.5 h-3.5 text-[#00603C]" />
              <span>Imprimir</span>
            </button>
            <button
              type="button"
              id="btn-imprimir-todo"
              onClick={() => handleImprimir('todo')}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg transition flex items-center gap-1 shadow-2xs cursor-pointer"
              title="Imprimir Carátula + ID de todas las bolsas juntas"
            >
              <Printer className="w-3.5 h-3.5 text-slate-300" />
              <span>Todo</span>
            </button>
          </div>
        </div>
      </div>

      {/* SELECTOR / LISTA HORIZONTAL DE CARÁTULAS DISPONIBLES */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs flex items-center gap-2 overflow-x-auto">
        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 whitespace-nowrap px-2 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-[#00603C]" />
          <span>Carátulas ({caratulas.length}):</span>
        </span>

        {/* BOTÓN TIPO LISTA DESPLEGABLE CON TODAS LAS CARÁTULAS EN ORDEN NUMÉRICO DESCENDENTE */}
        <div className="relative shrink-0">
          <select
            id="select-caratulas-orden-descendente"
            value={selectedCaratulaId}
            onChange={(e) => setSelectedCaratulaId(e.target.value)}
            className="bg-emerald-50 hover:bg-emerald-100/80 text-[#00603C] font-bold text-xs py-1.5 pl-3 pr-8 rounded-xl border border-emerald-300 focus:outline-none focus:ring-2 focus:ring-[#00603C] cursor-pointer transition shadow-2xs font-mono"
            title="Lista desplegable de carátulas (orden numérico descendente)"
          >
            {caratulasOrdenadasDesc.map((c) => (
              <option key={c.id} value={c.id}>
                Lote {c.loteNro} — {c.titulo1 || 'Sin título'} ({c.cantidadBolsas} b. {c.color === 'rojo' ? '· Rojo' : '· Verde'})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 flex-1">
          {caratulas.map((c) => {
            const isSelected = c.id === caratulaActiva.id;
            const isRed = c.color === 'rojo';
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCaratulaId(c.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shrink-0 border ${
                  isSelected
                    ? isRed
                      ? 'bg-rose-50 border-rose-600 text-rose-950 ring-2 ring-rose-500/20 shadow-xs'
                      : 'bg-emerald-50 border-[#00603C] text-[#00603C] ring-2 ring-[#00603C]/20 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: isRed ? '#7f1d1d' : '#00603C' }}
                />
                <span className="font-mono font-black">{c.loteNro}</span>
                <span className="text-[10px] opacity-75 font-normal truncate max-w-[100px]">
                  {c.titulo1}
                </span>
                <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-white/80 font-mono font-bold text-slate-600 border border-slate-200">
                  {c.cantidadBolsas} b.
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* PANEL DE CONTROL DE EDICIÓN:
          1. N° de lote (números y letras)
          2. Título 1
          3. Subtítulo
          4. Color de fondo (Verde / Rojo Oscuro)
          5. Cantidad de bolsas para esta carátula
      */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-[#00603C]" />
            <h2 className="text-base font-extrabold text-slate-900 uppercase tracking-wide">
              Edición de Carátula: Lote {caratulaActiva.loteNro}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDuplicarCaratula}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              title="Duplicar carátula con siguiente correlativo"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Duplicar</span>
            </button>
            <button
              type="button"
              id="btn-eliminar-caratula-activa"
              onClick={() => handleSolicitarEliminarCaratula(caratulaActiva)}
              className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-900 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer border border-rose-200 shadow-2xs active:scale-95"
              title="Eliminar esta carátula e ID de bolsas con confirmación"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Eliminar Carátula</span>
            </button>
          </div>
        </div>

        {/* GRILLA DE EDICIÓN DE CARÁTULA PRINCIPAL */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. NÚMERO DE LOTE (LETRAS Y NÚMEROS) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-[#00603C]" />
              <span>1. Número de Lote (Letras y Números)</span>
            </label>
            <input
              type="text"
              id="input-caratula-lote-nro"
              value={caratulaActiva.loteNro}
              onChange={(e) => handleUpdateCaratulaField('loteNro', e.target.value)}
              placeholder="Ej: 0000, 0001, ER-042..."
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-mono font-black text-slate-900 text-base focus:ring-2 focus:ring-[#00603C] uppercase"
            />
            <p className="text-[10px] text-slate-500 font-sans">
              Se actualiza en tiempo real en la carátula, en el QR y en las bolsas.
            </p>
          </div>

          {/* 2. TÍTULO 1 */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#00603C]" />
              <span>2. Título 1 (Cliente / Lote)</span>
            </label>
            <input
              type="text"
              id="input-caratula-titulo1"
              value={caratulaActiva.titulo1}
              onChange={(e) => handleUpdateCaratulaField('titulo1', e.target.value)}
              placeholder="Ej: Título 1, San Diego, Eco Rural..."
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-sans font-bold text-slate-900 text-sm focus:ring-2 focus:ring-[#00603C]"
            />
            <p className="text-[10px] text-slate-500 font-sans">
              Encabezado principal visible abajo a la izquierda de la carátula.
            </p>
          </div>

          {/* 3. SUBTÍTULO */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-[#00603C]" />
              <span>3. Subtítulo (Variedad / Observación)</span>
            </label>
            <input
              type="text"
              id="input-caratula-subtitulo"
              value={caratulaActiva.subtitulo}
              onChange={(e) => handleUpdateCaratulaField('subtitulo', e.target.value)}
              placeholder="Ej: Subtítulo, Soja DM40E25..."
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-sans font-medium text-slate-900 text-sm focus:ring-2 focus:ring-[#00603C]"
            />
            <p className="text-[10px] text-slate-500 font-sans">
              Texto secundario visible bajo el Título 1.
            </p>
          </div>

          {/* 4. COLOR DE FONDO DEL CUADRADO: VERDE O ROJO OSCURO */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-[#00603C]" />
              <span>4. Color de Fondo del Cuadrado</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                id="btn-color-verde"
                onClick={() => handleUpdateCaratulaField('color', 'verde')}
                className={`p-2 rounded-xl border flex items-center justify-center gap-2 cursor-pointer transition font-bold text-xs ${
                  caratulaActiva.color === 'verde'
                    ? 'border-[#00603C] bg-emerald-50 text-[#00603C] ring-2 ring-[#00603C]/30 shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-[#00603C] shrink-0 border border-emerald-700" />
                <span>Verde</span>
                {caratulaActiva.color === 'verde' && <Check className="w-3.5 h-3.5" />}
              </button>

              <button
                type="button"
                id="btn-color-rojo"
                onClick={() => handleUpdateCaratulaField('color', 'rojo')}
                className={`p-2 rounded-xl border flex items-center justify-center gap-2 cursor-pointer transition font-bold text-xs ${
                  caratulaActiva.color === 'rojo'
                    ? 'border-rose-600 bg-rose-50 text-rose-950 ring-2 ring-rose-500/30 shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-[#7f1d1d] shrink-0 border border-rose-900" />
                <span>Rojo Oscuro</span>
                {caratulaActiva.color === 'rojo' && <Check className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-500 font-sans">
              Aplica al fondo de la carátula y cabezal de ID bolsas.
            </p>
          </div>
        </div>

        {/* SECCIÓN DE ATRIBUTOS PARA ID BOLSAS & REPLICACIÓN */}
        <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-[#00603C]" />
                <span>Atributos para ID de Bolsa (Ingreso Manual & Replicar en Todas las Bolsas)</span>
              </span>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Configura los 4 datos clave tomados de base de Data Bases y replícalos a todas las bolsas con un clic.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* CANTIDAD DE BOLSAS PARA ESTA CARÁTULA EN PARTICULAR (POR DEFECTO 35) */}
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-black uppercase text-slate-700">
                  Cantidad Bolsas:
                </label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={caratulaActiva.cantidadBolsas}
                  onChange={(e) => handleChangeCantidadBolsas(parseInt(e.target.value, 10))}
                  className="w-20 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-black text-slate-900 text-sm text-center focus:ring-2 focus:ring-[#00603C]"
                />
                <span className="text-[10px] font-bold text-slate-500">
                  (Por defecto: 35)
                </span>
              </div>

              <button
                type="button"
                id="btn-replicar-en-todas"
                onClick={() => handleReplicarEnTodasLasBolsas()}
                className="px-4 py-2 bg-[#00603C] hover:bg-[#004d30] text-white rounded-xl text-xs font-extrabold uppercase tracking-wider shadow-sm transition flex items-center gap-2 cursor-pointer active:scale-95"
                title="Aplica Tipo, Categoria, Presentacion y Especie a todas las bolsas de este lote"
              >
                <RefreshCw className="w-3.5 h-3.5 text-emerald-200" />
                <span>Replicar en Todas las Bolsas</span>
              </button>
            </div>
          </div>

          {/* =========================================================================
              LOS 4 BOTONES DE ID BOLSA REQUERIDOS:
              - "Tipo" (antes "Botón 1 · Tipo:")
              - "Categoria" (antes "Botón 2 · Categoría:")
              - "Presentacion" (antes "Botón 3 · Presentación: Actual: Big Bag x 800 kg")
              - "Especie" (antes "Botón 4 · Especie:")
              Con datos tomados de la base de Data Bases (plantaConfig)
              ========================================================================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* BOTÓN: TIPO */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center justify-between">
                <span>Tipo</span>
                <span className="text-[9px] font-mono font-bold text-[#00603C]">
                  {caratulaActiva.tipo}
                </span>
              </label>
              <select
                id="select-boton-tipo"
                value={caratulaActiva.tipo}
                onChange={(e) => {
                  const val = e.target.value;
                  handleUpdateCaratulaField('tipo', val, false);
                  handleReplicarEnTodasLasBolsas({ tipo: val });
                }}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-xs text-slate-900 focus:ring-2 focus:ring-[#00603C] cursor-pointer"
              >
                {tiposDisponibles.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* BOTÓN: CATEGORIA */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center justify-between">
                <span>Categoria</span>
                <span className="text-[9px] font-mono font-bold text-[#00603C]">
                  {caratulaActiva.categoria}
                </span>
              </label>
              <select
                id="select-boton-categoria"
                value={caratulaActiva.categoria}
                onChange={(e) => {
                  const val = e.target.value;
                  handleUpdateCaratulaField('categoria', val, false);
                  handleReplicarEnTodasLasBolsas({ categoria: val });
                }}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-xs text-slate-900 focus:ring-2 focus:ring-[#00603C] cursor-pointer"
              >
                {categoriasDisponibles.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* BOTÓN: PRESENTACION */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center justify-between">
                <span>Presentacion</span>
                <span className="text-[9px] font-mono font-bold text-[#00603C]">
                  {caratulaActiva.presentacion}
                </span>
              </label>
              <select
                id="select-boton-presentacion"
                value={caratulaActiva.presentacion}
                onChange={(e) => {
                  const val = e.target.value;
                  handleUpdateCaratulaField('presentacion', val, false);
                  handleReplicarEnTodasLasBolsas({ presentacion: val });
                }}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-xs text-slate-900 focus:ring-2 focus:ring-[#00603C] cursor-pointer"
              >
                {presentacionesDisponibles.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {/* BOTÓN: ESPECIE */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center justify-between">
                <span>Especie</span>
                <span className="text-[9px] font-mono font-bold text-[#00603C]">
                  {caratulaActiva.especie}
                </span>
              </label>
              <select
                id="select-boton-especie"
                value={caratulaActiva.especie}
                onChange={(e) => {
                  const val = e.target.value;
                  handleUpdateCaratulaField('especie', val, false);
                  handleReplicarEnTodasLasBolsas({ especie: val });
                }}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-xs text-slate-900 focus:ring-2 focus:ring-[#00603C] cursor-pointer"
              >
                {especiesDisponibles.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* SELECTOR DE PESTAÑAS DE VISTA PREVIA (CARÁTULA, ID BOLSAS, DIVIDIDA) */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200">
          <button
            type="button"
            id="tab-vista-dividida"
            onClick={() => setActiveTab('dividida')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'dividida'
                ? 'bg-white text-slate-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5 text-[#00603C]" />
            <span>Vista Dividida</span>
          </button>
          <button
            type="button"
            id="tab-vista-caratula"
            onClick={() => setActiveTab('caratula')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'caratula'
                ? 'bg-white text-slate-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-[#00603C]" />
            <span>Solo Carátula</span>
          </button>
          <button
            type="button"
            id="tab-vista-bolsas"
            onClick={() => setActiveTab('bolsas')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'bolsas'
                ? 'bg-white text-slate-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Tag className="w-3.5 h-3.5 text-amber-700" />
            <span>Solo ID Bolsas ({caratulaActiva.bolsas.length})</span>
          </button>
        </div>

        {/* Buscador de bolsas */}
        {(activeTab === 'bolsas' || activeTab === 'dividida') && (
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar bolsa N°, lote..."
              value={searchBolsa}
              onChange={(e) => setSearchBolsa(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#00603C]"
            />
          </div>
        )}
      </div>

      {/* ÁREA DE CONTENIDO PRINCIPAL: CARÁTULA Y/O GRILLA DE BOLSAS */}
      <div className="space-y-6">
        {/* VISTA DIVIDIDA O SOLO CARÁTULA */}
        {(activeTab === 'dividida' || activeTab === 'caratula') && (
          <div className={activeTab === 'dividida' ? 'grid grid-cols-1 xl:grid-cols-12 gap-6 items-start' : 'max-w-2xl mx-auto'}>
            {/* CARÁTULA PREVIEW */}
            <div className={activeTab === 'dividida' ? 'xl:col-span-5 flex justify-center' : 'flex justify-center'}>
              <div className="w-full flex flex-col items-center">
                <div className="w-full flex items-center justify-between mb-2 px-1">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                    Vista Previa de Carátula:
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Modelo oficial Agro Abacus S.A.
                  </span>
                </div>
                <CaratulaCard data={caratulaActiva} />
              </div>
            </div>

            {/* GRILLA DE ID BOLSAS CUANDO ESTÁ EN VISTA DIVIDIDA */}
            {activeTab === 'dividida' && (
              <div className="xl:col-span-7 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Tag className="w-4 h-4 text-amber-700" />
                    <span>ID de Bolsas ({bolsasFiltradas.length} de {caratulaActiva.bolsas.length})</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    Clic en cualquier etiqueta para editar datos individuales
                  </span>
                </div>

                <div className="max-h-[720px] overflow-y-auto pr-1 space-y-3 p-1">
                  {bolsasFiltradas.map((bolsa) => (
                    <IdBolsaCaratulaCard
                      key={bolsa.id}
                      bolsa={bolsa}
                      onEdit={() => setBolsaAEditar(bolsa)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SOLO BOLSAS */}
        {activeTab === 'bolsas' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-amber-700" />
                <span>Listado Completo de ID de Bolsas: {caratulaActiva.bolsas.length} bolsas</span>
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                Lote {caratulaActiva.loteNro} · {caratulaActiva.presentacion} · {caratulaActiva.especie}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {bolsasFiltradas.map((bolsa) => (
                <IdBolsaCaratulaCard
                  key={bolsa.id}
                  bolsa={bolsa}
                  onEdit={() => setBolsaAEditar(bolsa)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          CONTENEDOR EXCLUSIVO PARA EXPORTACIÓN A PDF Y PARA IMPRESIÓN (@media print)
          Agrupa exactamente 7 bolsas por hoja A4 para coincidir con la plantilla oficial
          ========================================================================= */}
      <div
        id="seccion-impresion-caratulas"
        ref={printContainerRef}
        className={`seccion-impresion bg-white ${
          isExportingPdf
            ? 'fixed left-0 top-0 opacity-0 pointer-events-none z-[-100] block'
            : 'hidden print:block'
        }`}
        style={{ backgroundColor: '#FFFFFF' }}
      >
        {/* CASO 1: CARÁTULA OFICIAL A4 */}
        <div
          id="caratula-pdf-export-sheet"
          className="caratula-a4-sheet-container w-[210mm] min-h-[297mm] p-[16mm] mx-auto box-border flex flex-col justify-between"
          style={{
            pageBreakAfter: 'always',
            breakAfter: 'page',
            backgroundColor: '#FFFFFF',
            boxSizing: 'border-box',
          }}
        >
          <CaratulaCard data={caratulaActiva} isPrintView={true} />
        </div>

        {/* CASO 2: HOJAS DE ID DE BOLSAS AGRUPADAS EN 7 POR HOJA A4 */}
        {paginasDeBolsas.map((chunk, pageIndex) => (
          <div
            key={`pdf-page-${pageIndex}`}
            id={`caratula-bolsas-sheet-${pageIndex}`}
            className="caratula-a4-bolsas-sheet w-[210mm] min-h-[297mm] p-[8mm] mx-auto box-border flex flex-col justify-start"
            style={{
              pageBreakAfter: pageIndex < paginasDeBolsas.length - 1 ? 'always' : 'auto',
              breakAfter: pageIndex < paginasDeBolsas.length - 1 ? 'page' : 'auto',
              backgroundColor: '#FFFFFF',
              boxSizing: 'border-box',
            }}
          >
            <div className="flex flex-col gap-[2.5mm] w-full">
              {chunk.map((bolsa) => (
                <IdBolsaCaratulaCard
                  key={`print-sheet-${bolsa.id}`}
                  bolsa={bolsa}
                  isPrintView={true}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* =========================================================================
          MODAL: GENERADOR AUTOMÁTICO DE CARÁTULAS CORRELATIVAS
          ========================================================================= */}
      {showAutoModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                  <Wand2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 font-sans tracking-tight">
                    Generador Automático de Carátulas
                  </h3>
                  <p className="text-xs text-slate-500">
                    Crea múltiples carátulas con numeración correlativa y 35 bolsas por defecto.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAutoModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEjecutarGeneradorAutomatico} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* CANTIDAD DE CARÁTULAS */}
                <div className="space-y-1">
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                    Cantidad de Carátulas a Generar *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    required
                    value={autoCantidadCaratulas}
                    onChange={(e) => setAutoCantidadCaratulas(parseInt(e.target.value, 10))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-mono font-black text-slate-900 text-base focus:ring-2 focus:ring-[#00603C]"
                  />
                  <span className="text-[10px] text-slate-500">Ej: 3, 5, 10 carátulas</span>
                </div>

                {/* NÚMERO DE LOTE INICIAL (LETRAS Y NÚMEROS) */}
                <div className="space-y-1">
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                    N° Lote Inicial *
                  </label>
                  <input
                    type="text"
                    required
                    value={autoLoteInicial}
                    onChange={(e) => setAutoLoteInicial(e.target.value)}
                    placeholder="Ej: 0001, ER-01..."
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-mono font-black text-slate-900 text-base uppercase focus:ring-2 focus:ring-[#00603C]"
                  />
                  <span className="text-[10px] text-slate-500">
                    Generará: {autoLoteInicial}, {incrementarLoteCorrelativo(autoLoteInicial, 1)}, ...
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* BOLSAS POR CARÁTULA (POR DEFECTO 35) */}
                <div className="space-y-1">
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                    ID Bolsas por Carátula *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    required
                    value={autoBolsasPorCaratula}
                    onChange={(e) => setAutoBolsasPorCaratula(parseInt(e.target.value, 10))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-mono font-black text-slate-900 text-base focus:ring-2 focus:ring-[#00603C]"
                  />
                  <span className="text-[10px] text-[#00603C] font-bold">
                    Por defecto: 35 bolsas por carátula
                  </span>
                </div>

                {/* COLOR DE FONDO */}
                <div className="space-y-1">
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                    Color de Fondo del Cuadrado
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAutoColor('verde')}
                      className={`p-2 rounded-xl border flex items-center justify-center gap-1.5 font-bold text-xs cursor-pointer ${
                        autoColor === 'verde'
                          ? 'border-[#00603C] bg-emerald-50 text-[#00603C] ring-2 ring-[#00603C]/30'
                          : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      <span className="w-3.5 h-3.5 rounded-full bg-[#00603C]" />
                      <span>Verde</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAutoColor('rojo')}
                      className={`p-2 rounded-xl border flex items-center justify-center gap-1.5 font-bold text-xs cursor-pointer ${
                        autoColor === 'rojo'
                          ? 'border-rose-600 bg-rose-50 text-rose-950 ring-2 ring-rose-500/30'
                          : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      <span className="w-3.5 h-3.5 rounded-full bg-[#7f1d1d]" />
                      <span>Rojo Oscuro</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* TÍTULO 1 Y SUBTÍTULO */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                    Título 1 (Cliente / Lote)
                  </label>
                  <input
                    type="text"
                    value={autoTitulo1}
                    onChange={(e) => setAutoTitulo1(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                    Subtítulo (Variedad / Observación)
                  </label>
                  <input
                    type="text"
                    value={autoSubtitulo}
                    onChange={(e) => setAutoSubtitulo(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium"
                  />
                </div>
              </div>

              {/* ATRIBUTOS INICIALES TOMADOS DE DATA BASES */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
                <div>
                  <label className="text-[9px] font-bold uppercase text-slate-500">Tipo</label>
                  <select
                    value={autoTipo}
                    onChange={(e) => setAutoTipo(e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold"
                  >
                    {tiposDisponibles.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-bold uppercase text-slate-500">Categoria</label>
                  <select
                    value={autoCategoria}
                    onChange={(e) => setAutoCategoria(e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold"
                  >
                    {categoriasDisponibles.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-bold uppercase text-slate-500">Presentacion</label>
                  <select
                    value={autoPresentacion}
                    onChange={(e) => setAutoPresentacion(e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold"
                  >
                    {presentacionesDisponibles.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-bold uppercase text-slate-500">Especie</label>
                  <select
                    value={autoEspecie}
                    onChange={(e) => setAutoEspecie(e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold"
                  >
                    {especiesDisponibles.map((sp) => (
                      <option key={sp} value={sp}>
                        {sp}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAutoModal(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#00603C] hover:bg-[#004d30] text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition cursor-pointer flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  <span>Generar {autoCantidadCaratulas} Carátulas</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: EDICIÓN MANUAL DE UNA BOLSA INDIVIDUAL
          ========================================================================= */}
      {bolsaAEditar && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Editar Bolsa N° {String(bolsaAEditar.bolsaNro).padStart(2, '0')} de {bolsaAEditar.totalBolsas}
                  </h3>
                  <p className="text-xs text-slate-500">Lote {bolsaAEditar.loteNro}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBolsaAEditar(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-700 block mb-1">
                    Tipo
                  </label>
                  <select
                    value={bolsaAEditar.tipo}
                    onChange={(e) => setBolsaAEditar({ ...bolsaAEditar, tipo: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold"
                  >
                    {tiposDisponibles.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-700 block mb-1">
                    Categoria
                  </label>
                  <select
                    value={bolsaAEditar.categoria}
                    onChange={(e) => setBolsaAEditar({ ...bolsaAEditar, categoria: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold"
                  >
                    {categoriasDisponibles.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-700 block mb-1">
                    Presentacion
                  </label>
                  <select
                    value={bolsaAEditar.presentacion}
                    onChange={(e) => setBolsaAEditar({ ...bolsaAEditar, presentacion: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold"
                  >
                    {presentacionesDisponibles.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-700 block mb-1">
                    Especie
                  </label>
                  <select
                    value={bolsaAEditar.especie}
                    onChange={(e) => setBolsaAEditar({ ...bolsaAEditar, especie: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold"
                  >
                    {especiesDisponibles.map((sp) => (
                      <option key={sp} value={sp}>
                        {sp}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-700 block mb-1">
                  Cliente / Título
                </label>
                <input
                  type="text"
                  value={bolsaAEditar.cliente}
                  onChange={(e) => setBolsaAEditar({ ...bolsaAEditar, cliente: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-700 block mb-1">
                  Subtítulo / Observación
                </label>
                <input
                  type="text"
                  value={bolsaAEditar.subtitulo}
                  onChange={(e) => setBolsaAEditar({ ...bolsaAEditar, subtitulo: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setBolsaAEditar(null)}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleGuardarBolsaIndividual(bolsaAEditar)}
                className="px-5 py-2.5 bg-[#00603C] hover:bg-[#004d30] text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition cursor-pointer"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL DE CONFIRMACIÓN PARA ELIMINAR CARÁTULA
          ========================================================================= */}
      {caratulaAEliminar && (
        <div
          id="modal-confirmar-eliminar-caratula"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center shrink-0 text-rose-600 shadow-xs">
                <AlertTriangle className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-black uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                    Confirmación de Eliminación
                  </span>
                  <button
                    type="button"
                    onClick={() => !isDeletingCaratula && setCaratulaAEliminar(null)}
                    disabled={isDeletingCaratula}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer"
                    title="Cerrar ventana"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight mt-1 font-sans">
                  ¿Eliminar Carátula Lote {caratulaAEliminar.loteNro}?
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Esta acción eliminará permanentemente la carátula y sus{' '}
                  <strong className="text-slate-900 font-bold">{caratulaAEliminar.cantidadBolsas} etiquetas ID de bolsas</strong> de la aplicación y de la base de datos.
                </p>
              </div>
            </div>

            {/* Ficha Resumen de la Carátula a Eliminar */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/90 text-xs space-y-1.5 font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-sans">N° de Lote:</span>
                <span className="font-black text-slate-900 text-sm">
                  {caratulaAEliminar.loteNro}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-sans">Título / Cliente:</span>
                <span className="font-bold text-slate-800 truncate max-w-[200px]">
                  {caratulaAEliminar.titulo1 || 'Sin título'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-sans">Etiquetas ID:</span>
                <span className="font-bold text-emerald-800">
                  {caratulaAEliminar.cantidadBolsas} bolsas ({caratulaAEliminar.presentacion})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-sans">Color de fondo:</span>
                <span className="font-bold flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{ backgroundColor: caratulaAEliminar.color === 'rojo' ? '#7f1d1d' : '#00603C' }}
                  />
                  <span className="capitalize">{caratulaAEliminar.color}</span>
                </span>
              </div>
            </div>

            {/* Botones de Confirmación */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                id="btn-cancelar-eliminar-caratula"
                onClick={() => setCaratulaAEliminar(null)}
                disabled={isDeletingCaratula}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-confirmar-eliminar-caratula"
                onClick={handleConfirmarEliminarCaratula}
                disabled={isDeletingCaratula}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-md flex items-center gap-2 cursor-pointer active:scale-95"
              >
                {isDeletingCaratula ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>Eliminando de base de datos...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 shrink-0" />
                    <span>Sí, Eliminar Carátula</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
