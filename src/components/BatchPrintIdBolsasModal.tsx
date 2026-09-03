/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Lote } from '../types';
import { IdBolsaLabel } from './IdBolsaLabel';
import { printWithActiveClass } from '../utils/printHelper';
import { exportIdBolsasPagesAsPdf } from '../utils/exportPdf';
import {
  X,
  Download,
  Loader2,
  Tag,
  Layers,
  Sparkles,
  PackageCheck,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  Filter,
  Search,
  SlidersHorizontal,
  Printer,
  Eye,
  ZoomIn,
  ZoomOut,
  CheckCircle2,
  RotateCcw,
  Check,
} from 'lucide-react';

interface BatchPrintIdBolsasModalProps {
  isOpen: boolean;
  lotes: Lote[];
  onClose: () => void;
  autoLaunchPrint?: boolean;
}

interface TagItem {
  id: string;
  lote: Lote;
  bagIndex: number;
  totalBagsInLote: number;
}

export const BatchPrintIdBolsasModal: React.FC<BatchPrintIdBolsasModalProps> = ({
  isOpen,
  lotes,
  onClose,
  autoLaunchPrint = false,
}) => {
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | null>(null);
  const [activePreviewPage, setActivePreviewPage] = useState(1);

  // Estados interactivos para selector de lotes y etiquetas
  const [selectedLotesMap, setSelectedLotesMap] = useState<Record<string, boolean>>({});
  const [selectedTagsMap, setSelectedTagsMap] = useState<Record<string, boolean>>({});
  const [expandedLoteIds, setExpandedLoteIds] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [showSelectorSidebar, setShowSelectorSidebar] = useState(true);
  const [previewZoom, setPreviewZoom] = useState<number>(100);
  const [viewMode, setViewMode] = useState<'single' | 'all'>('single');

  // Rango manual temporal por lote
  const [rangeInputs, setRangeInputs] = useState<Record<string, { from: string; to: string }>>({});

  // Generar la lista plana de todas las etiquetas solicitadas
  const allTags = useMemo<TagItem[]>(() => {
    if (!lotes || lotes.length === 0) return [];

    const items: TagItem[] = [];
    lotes.forEach((lote) => {
      // Cálculo de cantidad según stockBolsas (o 1 como fallback)
      const rawCount = Number(lote.stockBolsas) || Number((lote as any).cantidadBolsas) || 1;
      const count = Math.max(1, Math.min(rawCount, 5000)); // Cap de seguridad

      for (let i = 1; i <= count; i++) {
        items.push({
          id: `tag-${lote.id}-${i}`,
          lote,
          bagIndex: i,
          totalBagsInLote: count,
        });
      }
    });

    return items;
  }, [lotes]);

  // Inicializar selección (todos activos por defecto al abrir o cambiar lotes)
  useEffect(() => {
    if (isOpen && lotes.length > 0) {
      const initialLotes: Record<string, boolean> = {};
      const initialExpanded: Record<string, boolean> = {};
      const initialRanges: Record<string, { from: string; to: string }> = {};

      lotes.forEach((l) => {
        initialLotes[l.id] = true;
        initialExpanded[l.id] = lotes.length <= 2;
        const count = Number(l.stockBolsas) || 1;
        initialRanges[l.id] = { from: '1', to: String(count) };
      });

      setSelectedLotesMap(initialLotes);
      setExpandedLoteIds(initialExpanded);
      setRangeInputs(initialRanges);

      const initialTags: Record<string, boolean> = {};
      allTags.forEach((t) => {
        initialTags[t.id] = true;
      });
      setSelectedTagsMap(initialTags);
      setActivePreviewPage(1);
    }
  }, [isOpen, lotes, allTags]);

  // Agrupación de etiquetas por lote
  const tagsByLote = useMemo(() => {
    const map: Record<string, TagItem[]> = {};
    allTags.forEach((t) => {
      if (!map[t.lote.id]) map[t.lote.id] = [];
      map[t.lote.id].push(t);
    });
    return map;
  }, [allTags]);

  // Filtrado de etiquetas activas según selección del usuario
  const activeTags = useMemo<TagItem[]>(() => {
    return allTags.filter((tag) => {
      const isLoteSelected = selectedLotesMap[tag.lote.id] !== false;
      const isTagSelected = selectedTagsMap[tag.id] !== false;
      return isLoteSelected && isTagSelected;
    });
  }, [allTags, selectedLotesMap, selectedTagsMap]);

  // Agrupar en páginas de exactamente 7 etiquetas por hoja A4
  const pages = useMemo<TagItem[][]>(() => {
    const LABELS_PER_PAGE = 7;
    const chunked: TagItem[][] = [];
    for (let i = 0; i < activeTags.length; i += LABELS_PER_PAGE) {
      chunked.push(activeTags.slice(i, i + LABELS_PER_PAGE));
    }
    return chunked;
  }, [activeTags]);

  const totalPages = pages.length;

  // Ajustar página activa si el total de páginas decrece
  useEffect(() => {
    if (totalPages > 0 && activePreviewPage > totalPages) {
      setActivePreviewPage(totalPages);
    }
  }, [activePreviewPage, totalPages]);

  // Manejadores de toggle de lote
  const toggleLote = (loteId: string) => {
    const currentState = selectedLotesMap[loteId] !== false;
    const nextState = !currentState;

    setSelectedLotesMap((prev) => ({ ...prev, [loteId]: nextState }));

    // Actualizar todas las etiquetas del lote
    setSelectedTagsMap((prev) => {
      const next = { ...prev };
      const loteTags = tagsByLote[loteId] || [];
      loteTags.forEach((t) => {
        next[t.id] = nextState;
      });
      return next;
    });
  };

  // Manejador de toggle de etiqueta individual
  const toggleTag = (tagId: string, loteId: string) => {
    const currentState = selectedTagsMap[tagId] !== false;
    const nextState = !currentState;

    setSelectedTagsMap((prev) => ({ ...prev, [tagId]: nextState }));

    // Si encendemos una etiqueta, nos aseguramos de que el lote padre esté activo
    if (nextState) {
      setSelectedLotesMap((prev) => ({ ...prev, [loteId]: true }));
    }
  };

  // Seleccionar todas las etiquetas y lotes
  const handleSelectAll = () => {
    const nextLotes: Record<string, boolean> = {};
    lotes.forEach((l) => {
      nextLotes[l.id] = true;
    });
    setSelectedLotesMap(nextLotes);

    const nextTags: Record<string, boolean> = {};
    allTags.forEach((t) => {
      nextTags[t.id] = true;
    });
    setSelectedTagsMap(nextTags);
  };

  // Deseleccionar todas las etiquetas y lotes
  const handleDeselectAll = () => {
    const nextLotes: Record<string, boolean> = {};
    lotes.forEach((l) => {
      nextLotes[l.id] = false;
    });
    setSelectedLotesMap(nextLotes);

    const nextTags: Record<string, boolean> = {};
    allTags.forEach((t) => {
      nextTags[t.id] = false;
    });
    setSelectedTagsMap(nextTags);
  };

  // Aplicar rango por lote
  const handleApplyRange = (loteId: string) => {
    const input = rangeInputs[loteId] || { from: '1', to: '1' };
    const fromVal = Math.max(1, parseInt(input.from, 10) || 1);
    const toVal = Math.max(fromVal, parseInt(input.to, 10) || fromVal);

    setSelectedLotesMap((prev) => ({ ...prev, [loteId]: true }));
    setSelectedTagsMap((prev) => {
      const next = { ...prev };
      const loteTags = tagsByLote[loteId] || [];
      loteTags.forEach((t) => {
        next[t.id] = t.bagIndex >= fromVal && t.bagIndex <= toVal;
      });
      return next;
    });
  };

  // Aplicar preset rápido por lote
  const handleApplyPreset = (
    loteId: string,
    preset: 'all' | 'none' | 'first10' | 'first25' | 'even' | 'odd'
  ) => {
    setSelectedLotesMap((prev) => ({ ...prev, [loteId]: preset !== 'none' }));
    setSelectedTagsMap((prev) => {
      const next = { ...prev };
      const loteTags = tagsByLote[loteId] || [];
      loteTags.forEach((t) => {
        if (preset === 'all') next[t.id] = true;
        else if (preset === 'none') next[t.id] = false;
        else if (preset === 'first10') next[t.id] = t.bagIndex <= 10;
        else if (preset === 'first25') next[t.id] = t.bagIndex <= 25;
        else if (preset === 'even') next[t.id] = t.bagIndex % 2 === 0;
        else if (preset === 'odd') next[t.id] = t.bagIndex % 2 !== 0;
      });
      return next;
    });
  };

  // Manejar impresión nativa aislada
  const handlePrint = async () => {
    if (activeTags.length === 0) return;
    await printWithActiveClass('printable-id-bolsas-container');
  };

  // Manejar exportación a PDF
  const handleDownloadPdf = async () => {
    if (activeTags.length === 0) return;
    try {
      setIsExportingPdf(true);
      setExportProgress({ current: 1, total: pages.length });

      const firstLote = lotes[0];
      const safeLoteName =
        lotes.length === 1
          ? (firstLote?.loteNro || firstLote?.id || 'Lote').replace(/\s+/g, '_')
          : `${lotes.length}_Lotes`;
      const fileName = `ID_Bolsas_${safeLoteName}_${activeTags.length}_etiquetas_${new Date().toISOString().slice(0, 10)}.pdf`;

      // Obtener todos los elementos de página de etiquetas activas
      const pageElements = pages
        .map((_, idx) => document.getElementById(`id-bolsas-page-sheet-${idx}`))
        .filter(Boolean) as HTMLElement[];

      if (pageElements.length === 0) {
        console.warn('No se encontraron páginas de etiquetas para exportar');
        return;
      }

      await exportIdBolsasPagesAsPdf(
        pageElements,
        fileName,
        {
          scale: 2.0,
          quality: 0.98,
        },
        (current, total) => {
          setExportProgress({ current, total });
        }
      );
    } catch (err) {
      console.error('Error al exportar PDF de ID Bolsas:', err);
    } finally {
      setIsExportingPdf(false);
      setExportProgress(null);
    }
  };

  // Filtrado de lotes para el buscador del panel izquierdo
  const filteredLotes = useMemo(() => {
    if (!searchTerm.trim()) return lotes;
    const term = searchTerm.toLowerCase();
    return lotes.filter((l) => {
      const loteStr = (l.loteNro || l.id || '').toLowerCase();
      const clienteStr = (l.cliente || '').toLowerCase();
      const variedadStr = (l.variedad || '').toLowerCase();
      const especieStr = (l.especie || '').toLowerCase();
      return (
        loteStr.includes(term) ||
        clienteStr.includes(term) ||
        variedadStr.includes(term) ||
        especieStr.includes(term)
      );
    });
  }, [lotes, searchTerm]);

  // Contar lotes que tienen al menos 1 etiqueta seleccionada
  const activeLotesCount = useMemo(() => {
    return lotes.filter((l) => {
      if (selectedLotesMap[l.id] === false) return false;
      const loteTags = tagsByLote[l.id] || [];
      return loteTags.some((t) => selectedTagsMap[t.id] !== false);
    }).length;
  }, [lotes, selectedLotesMap, selectedTagsMap, tagsByLote]);

  if (!isOpen || lotes.length === 0) return null;

  return (
    <div
      id="modal-id-bolsas-root"
      className="fixed inset-0 z-[120] overflow-y-auto bg-slate-950/90 backdrop-blur-xs flex flex-col items-center justify-start p-2 sm:p-4 print:p-0 print:bg-white print:static print:inset-auto print:z-auto"
    >
      {/* 1. BARRA DE ACCIONES SUPERIOR */}
      <div className="w-full max-w-7xl bg-slate-900 text-white px-4 sm:px-6 py-3.5 rounded-2xl shadow-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 mb-3 sticky top-2 z-50 print:hidden">
        {/* Lado izquierdo: Título y estadísticas en tiempo real */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="p-2.5 bg-amber-400 text-slate-950 rounded-xl shadow-xs font-black shrink-0">
            <Tag className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-sm tracking-wide uppercase text-white truncate">
                Vista Previa de Impresión y Descarga PDF
              </h3>
              <span className="bg-amber-400 text-slate-950 text-[10.5px] font-black font-mono px-2.5 py-0.5 rounded-full">
                {activeTags.length} de {allTags.length} Etiquetas
              </span>
              <span className="bg-emerald-600 text-white text-[10.5px] font-bold font-mono px-2.5 py-0.5 rounded-full">
                {totalPages} {totalPages === 1 ? 'Página A4' : 'Páginas A4'} (7/hoja)
              </span>
            </div>
            <p className="text-xs text-slate-300 truncate">
              {activeLotesCount} de {lotes.length} lotes activos para impresión · Previsualización exacta A4
            </p>
          </div>
        </div>

        {/* Lado derecho: Acciones de control y Confirmar Descarga */}
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
          {/* Botón para Mostrar/Ocultar Panel de Selección */}
          <button
            type="button"
            onClick={() => setShowSelectorSidebar((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition cursor-pointer border ${
              showSelectorSidebar
                ? 'bg-slate-800 text-amber-300 border-amber-400/40'
                : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:text-white'
            }`}
            title="Alternar panel lateral de selección de lotes y etiquetas"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {showSelectorSidebar ? 'Ocultar Filtros' : 'Seleccionar Lotes / Etiquetas'}
            </span>
          </button>

          {/* Botón de Impresión Nativa Rápida */}
          <button
            type="button"
            onClick={handlePrint}
            disabled={activeTags.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 transition cursor-pointer disabled:opacity-40"
            title="Imprimir directamente en impresora física"
          >
            <Printer className="w-3.5 h-3.5 text-slate-300" />
            <span className="hidden sm:inline">Imprimir</span>
          </button>

          {/* Botón Principal: Confirmar y Descargar PDF */}
          <button
            type="button"
            id="btn-download-pdf-id-bolsas"
            onClick={handleDownloadPdf}
            disabled={isExportingPdf || activeTags.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition cursor-pointer disabled:opacity-40 active:scale-95 border border-amber-300"
            title={
              activeTags.length === 0
                ? 'Debe seleccionar al menos una etiqueta para generar el PDF'
                : 'Confirmar descarga de documento PDF con las etiquetas seleccionadas'
            }
          >
            {isExportingPdf ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
            ) : (
              <Download className="w-4 h-4 text-slate-950 stroke-[2.5]" />
            )}
            <span>
              {isExportingPdf
                ? exportProgress
                  ? `Generando pág. ${exportProgress.current} de ${exportProgress.total}...`
                  : 'Generando PDF...'
                : `Confirmar y Descargar PDF (${activeTags.length})`}
            </span>
          </button>

          {/* Botón Cerrar */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
            title="Cerrar ventana de vista previa"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Indicador de progreso de exportación de PDF multi-página */}
      {isExportingPdf && exportProgress && (
        <div className="w-full max-w-7xl bg-amber-500/20 border border-amber-500/40 text-amber-200 px-5 py-3 rounded-xl mb-3 flex items-center justify-between gap-4 animate-pulse print:hidden">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-amber-400 shrink-0" />
            <div className="text-xs">
              <p className="font-bold text-amber-300">
                Generando documento PDF consolidado con {totalPages} páginas A4 ({activeTags.length} etiquetas)...
              </p>
              <p className="text-amber-200/80">
                Renderizando e insertando página {exportProgress.current} de {exportProgress.total} en alta definición
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-amber-300">
            <span>{Math.round((exportProgress.current / exportProgress.total) * 100)}%</span>
          </div>
        </div>
      )}

      {/* 2. CONTENEDOR PRINCIPAL: PANEL LATERAL DE SELECCIÓN + LIENZO DE VISTA PREVIA */}
      <div className="w-full max-w-7xl flex flex-col lg:flex-row gap-4 items-start justify-center print:block print:w-full print:max-w-none">
        {/* PANEL LATERAL DE SELECCIÓN DE LOTES Y ETIQUETAS (Colapsable) */}
        {showSelectorSidebar && (
          <div className="w-full lg:w-96 bg-slate-900 border border-slate-800 text-white rounded-2xl p-4 shadow-xl shrink-0 flex flex-col gap-3 max-h-[85vh] overflow-y-auto print:hidden">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-amber-400" />
                <h4 className="font-bold text-xs uppercase tracking-wider text-white">
                  Selector de Lotes y Etiquetas
                </h4>
              </div>
              <span className="text-[10px] font-mono font-bold bg-slate-800 text-amber-300 px-2 py-0.5 rounded-md">
                {activeTags.length}/{allTags.length}
              </span>
            </div>

            {/* Buscador de Lotes */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar por lote, cliente, variedad..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-400"
              />
            </div>

            {/* Acciones globales de selección */}
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={handleSelectAll}
                className="flex-1 py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg border border-slate-700 transition cursor-pointer text-center text-[11px]"
              >
                Seleccionar Todas
              </button>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="flex-1 py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg border border-slate-700 transition cursor-pointer text-center text-[11px]"
              >
                Deseleccionar Todas
              </button>
            </div>

            {/* Lista de Lotes con acordeón de etiquetas */}
            <div className="space-y-2 mt-1">
              {filteredLotes.map((lote) => {
                const loteTags = tagsByLote[lote.id] || [];
                const isLoteSelected = selectedLotesMap[lote.id] !== false;
                const isExpanded = expandedLoteIds[lote.id] ?? false;
                const selectedInLote = isLoteSelected
                  ? loteTags.filter((t) => selectedTagsMap[t.id] !== false).length
                  : 0;
                const rangeInput = rangeInputs[lote.id] || { from: '1', to: String(loteTags.length) };

                return (
                  <div
                    key={`sidebar-lote-${lote.id}`}
                    className={`rounded-xl border transition-all ${
                      isLoteSelected
                        ? 'bg-slate-950/60 border-slate-700'
                        : 'bg-slate-950/30 border-slate-800/80 opacity-70'
                    }`}
                  >
                    {/* Fila principal del lote */}
                    <div className="p-2.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Checkbox Maestro de Lote */}
                        <button
                          type="button"
                          onClick={() => toggleLote(lote.id)}
                          className="text-amber-400 hover:text-amber-300 transition cursor-pointer shrink-0"
                          title={isLoteSelected ? 'Deseleccionar lote completo' : 'Seleccionar lote completo'}
                        >
                          {isLoteSelected && selectedInLote === loteTags.length ? (
                            <CheckSquare className="w-4 h-4" />
                          ) : isLoteSelected && selectedInLote > 0 ? (
                            <div className="w-4 h-4 rounded border-2 border-amber-400 bg-amber-400/30 flex items-center justify-center">
                              <div className="w-2 h-0.5 bg-amber-400" />
                            </div>
                          ) : (
                            <Square className="w-4 h-4 text-slate-500" />
                          )}
                        </button>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-black text-xs text-white">
                              {lote.loteNro || lote.id}
                            </span>
                            <span
                              className={`text-[9.5px] font-mono font-bold px-1.5 py-0.2 rounded ${
                                selectedInLote > 0
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {selectedInLote}/{loteTags.length}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 truncate">
                            {lote.cliente || 'Sin cliente'} · {lote.variedad || lote.especie || 'Semilla'}
                          </p>
                        </div>
                      </div>

                      {/* Botón Desplegar / Colapsar etiquetas individuales */}
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedLoteIds((prev) => ({
                            ...prev,
                            [lote.id]: !prev[lote.id],
                          }))
                        }
                        className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                        title={isExpanded ? 'Ocultar etiquetas individuales' : 'Ver y seleccionar etiquetas individuales'}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {/* Acordeón de etiquetas individuales y selector por rango */}
                    {isExpanded && (
                      <div className="p-2.5 pt-0 border-t border-slate-800/80 space-y-2 mt-1">
                        {/* Selector de rango numérico rápido */}
                        <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800 text-[10.5px]">
                          <span className="text-slate-400 font-bold block mb-1">
                            Selección por Rango:
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500 font-mono">De:</span>
                            <input
                              type="number"
                              min={1}
                              max={loteTags.length}
                              value={rangeInput.from}
                              onChange={(e) =>
                                setRangeInputs((prev) => ({
                                  ...prev,
                                  [lote.id]: {
                                    ...rangeInput,
                                    from: e.target.value,
                                  },
                                }))
                              }
                              className="w-12 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 font-mono text-center text-white"
                            />
                            <span className="text-slate-500 font-mono">A:</span>
                            <input
                              type="number"
                              min={1}
                              max={loteTags.length}
                              value={rangeInput.to}
                              onChange={(e) =>
                                setRangeInputs((prev) => ({
                                  ...prev,
                                  [lote.id]: {
                                    ...rangeInput,
                                    to: e.target.value,
                                  },
                                }))
                              }
                              className="w-12 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 font-mono text-center text-white"
                            />
                            <button
                              type="button"
                              onClick={() => handleApplyRange(lote.id)}
                              className="px-2 py-0.5 bg-amber-400 text-slate-950 font-bold rounded hover:bg-amber-300 transition cursor-pointer text-[10px]"
                            >
                              Aplicar
                            </button>
                          </div>

                          {/* Presets rápidos */}
                          <div className="flex items-center gap-1 mt-1.5 flex-wrap text-[9.5px]">
                            <button
                              type="button"
                              onClick={() => handleApplyPreset(lote.id, 'all')}
                              className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300"
                            >
                              Todas
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApplyPreset(lote.id, 'first10')}
                              className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300"
                            >
                              1-10
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApplyPreset(lote.id, 'first25')}
                              className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300"
                            >
                              1-25
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApplyPreset(lote.id, 'even')}
                              className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300"
                            >
                              Pares
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApplyPreset(lote.id, 'odd')}
                              className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300"
                            >
                              Impares
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApplyPreset(lote.id, 'none')}
                              className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-rose-300"
                            >
                              Ninguna
                            </button>
                          </div>
                        </div>

                        {/* Grilla de checkboxes individuales para cada bolsa */}
                        <div className="grid grid-cols-4 sm:grid-cols-5 gap-1 max-h-36 overflow-y-auto p-1 bg-slate-950/80 rounded-lg border border-slate-800/80">
                          {loteTags.map((tag) => {
                            const isTagSelected =
                              isLoteSelected && selectedTagsMap[tag.id] !== false;
                            return (
                              <button
                                key={tag.id}
                                type="button"
                                onClick={() => toggleTag(tag.id, lote.id)}
                                className={`px-1 py-1 rounded text-[10px] font-mono font-bold transition flex items-center justify-center gap-1 border ${
                                  isTagSelected
                                    ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-2xs'
                                    : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
                                }`}
                                title={`Bolsa #${tag.bagIndex} de ${tag.totalBagsInLote}`}
                              >
                                <span>#{tag.bagIndex}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* LIENZO DE VISTA PREVIA WYSIWYG EXACTA DEL DOCUMENTO A4 */}
        <div className="flex-1 w-full flex flex-col items-center">
          {/* Barra de Controles de Vista Previa: Zoom, Paginación y Modos */}
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-xs text-slate-300 mb-3 print:hidden flex flex-wrap items-center justify-between gap-3 shadow-md">
            {/* Controles de Zoom */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 mr-1">Zoom:</span>
              <button
                type="button"
                onClick={() => setPreviewZoom(50)}
                className={`px-2 py-1 rounded-md text-[11px] font-bold ${
                  previewZoom === 50 ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 hover:bg-slate-700 text-white'
                }`}
              >
                50%
              </button>
              <button
                type="button"
                onClick={() => setPreviewZoom(75)}
                className={`px-2 py-1 rounded-md text-[11px] font-bold ${
                  previewZoom === 75 ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 hover:bg-slate-700 text-white'
                }`}
              >
                75%
              </button>
              <button
                type="button"
                onClick={() => setPreviewZoom(100)}
                className={`px-2 py-1 rounded-md text-[11px] font-bold ${
                  previewZoom === 100 ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 hover:bg-slate-700 text-white'
                }`}
              >
                100%
              </button>
            </div>

            {/* Selector de Modo de Vista Previa: Página por página o Continuo */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px]">
              <button
                type="button"
                onClick={() => setViewMode('single')}
                className={`px-2 py-0.5 rounded font-bold ${
                  viewMode === 'single' ? 'bg-slate-800 text-amber-300' : 'text-slate-400 hover:text-white'
                }`}
              >
                Por Página
              </button>
              <button
                type="button"
                onClick={() => setViewMode('all')}
                className={`px-2 py-0.5 rounded font-bold ${
                  viewMode === 'all' ? 'bg-slate-800 text-amber-300' : 'text-slate-400 hover:text-white'
                }`}
              >
                Ver Todas ({totalPages})
              </button>
            </div>

            {/* Navegación entre Páginas (en modo página individual) */}
            {viewMode === 'single' && totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActivePreviewPage((prev) => Math.max(1, prev - 1))}
                  disabled={activePreviewPage === 1}
                  className="p-1 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white transition cursor-pointer"
                  title="Página anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-mono text-xs text-white px-1">
                  Pág. <strong className="text-amber-300">{activePreviewPage}</strong> de {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setActivePreviewPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={activePreviewPage === totalPages}
                  className="p-1 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white transition cursor-pointer"
                  title="Página siguiente"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* MENSAJE CUANDO NO HAY ETIQUETAS SELECCIONADAS */}
          {activeTags.length === 0 && (
            <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-white my-8 shadow-2xl">
              <div className="w-14 h-14 mx-auto rounded-full bg-amber-400/20 text-amber-400 flex items-center justify-center mb-4">
                <Tag className="w-7 h-7" />
              </div>
              <h4 className="text-base font-bold text-white mb-1">
                Ninguna etiqueta seleccionada
              </h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                Utiliza el panel lateral para activar los lotes o etiquetas específicas que deseas incluir en el documento de impresión.
              </p>
              <button
                type="button"
                onClick={handleSelectAll}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl shadow transition"
              >
                Seleccionar Todas las Etiquetas
              </button>
            </div>
          )}

          {/* CONTENEDOR PRINCIPAL IMPRIMIBLE CON HOJAS A4 (7 ETIQUETAS POR HOJA) */}
          {activeTags.length > 0 && (
            <div
              id="printable-id-bolsas-container"
              className="w-full flex flex-col items-center gap-8 print:gap-0 print:m-0 print:p-0 print:w-full print:max-w-none transition-transform"
              style={{
                transform: previewZoom !== 100 ? `scale(${previewZoom / 100})` : undefined,
                transformOrigin: 'top center',
              }}
            >
              {pages.map((pageTags, pageIndex) => {
                const pageNumber = pageIndex + 1;
                const isCurrentScreenPage =
                  viewMode === 'all' || pageNumber === activePreviewPage || isExportingPdf;
                const isLastPage = pageIndex === pages.length - 1;
                const firstTag = pageTags[0];
                const lastTag = pageTags[pageTags.length - 1];
                const pageLoteNro = firstTag?.lote?.loteNro || firstTag?.lote?.id || 'LOTE';
                const sheetUid = `HOJA-${pageNumber.toString().padStart(2, '0')}-${pageLoteNro}-${activeTags.length}`;

                return (
                  <div
                    key={`id-bolsas-page-${pageIndex}`}
                    id={`id-bolsas-page-sheet-${pageIndex}`}
                    className={`pagina-etiquetas id-bolsas-a4-page bg-white text-black print:p-0 print:border-none print:shadow-none ${
                      isExportingPdf
                        ? 'border-0 shadow-none rounded-none'
                        : 'shadow-2xl border border-gray-300 rounded-sm'
                    } ${isCurrentScreenPage ? 'active-preview-page' : 'id-bolsas-screen-hidden'}`}
                    style={{
                      width: '210mm',
                      minWidth: '210mm',
                      maxWidth: '210mm',
                      height: '297mm',
                      minHeight: '297mm',
                      maxHeight: '297mm',
                      boxSizing: 'border-box',
                      padding: '6mm 8mm 6mm 8mm',
                      backgroundColor: '#FFFFFF',
                      pageBreakAfter: isLastPage ? 'auto' : 'always',
                      breakAfter: isLastPage ? 'auto' : 'page',
                      pageBreakInside: 'avoid',
                      breakInside: 'avoid',
                      overflow: 'hidden',
                      display: isCurrentScreenPage ? 'flex' : 'none',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      position: 'relative',
                    }}
                  >
                    {/* Renderizar exactamente 7 etiquetas dentro de la grilla A4 */}
                    <div
                      className="id-bolsas-page-grid w-full"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-start',
                        gap: '2mm',
                        width: '100%',
                        boxSizing: 'border-box',
                      }}
                    >
                      {pageTags.map((tag) => (
                        <IdBolsaLabel
                          key={tag.id}
                          lote={tag.lote}
                          bagNumber={tag.bagIndex}
                          totalBags={tag.totalBagsInLote}
                          className="w-full"
                        />
                      ))}

                      {/* Si la última página tiene menos de 7, rellenar con espacios invisibles para mantener escala exacta */}
                      {pageTags.length < 7 &&
                        Array.from({ length: 7 - pageTags.length }).map((_, emptyIdx) => (
                          <div
                            key={`empty-placeholder-${emptyIdx}`}
                            className="border border-dashed border-gray-200 opacity-20 print:opacity-0"
                            style={{
                              height: '37.5mm',
                              minHeight: '37.5mm',
                              maxHeight: '37.5mm',
                              boxSizing: 'border-box',
                            }}
                          />
                        ))}
                    </div>

                    {/* Barra de pie de página: Contador y Marca de Identificación Única por Hoja A4 */}
                    <div
                      className="id-bolsas-page-meta-bar shrink-0"
                      style={{
                        height: '5mm',
                        marginTop: 'auto',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderTop: '1px dashed #cbd5e1',
                        paddingTop: '1.2mm',
                        fontSize: '6.5pt',
                        color: '#475569',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        boxSizing: 'border-box',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold">
                          PLANTA CLASIFICADORA LA BARRANCOSA · AGRO ABACUS S.A.
                        </span>
                        <span>·</span>
                        <span className="font-mono font-bold">LOTE: {pageLoteNro}</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono">
                        <span>
                          ETIQ. {firstTag?.bagIndex || 1} - {lastTag?.bagIndex || pageTags.length} DE{' '}
                          {activeTags.length} SELECCIONADAS
                        </span>
                        <span>·</span>
                        <span className="font-black text-black">
                          HOJA {pageNumber} DE {totalPages}
                        </span>
                        <span>·</span>
                        <span className="text-[6pt] text-slate-400">{sheetUid}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

