/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Lote } from '../types';
import { IdBolsaLabel } from './IdBolsaLabel';
import { printWithActiveClass } from '../utils/printHelper';
import { exportWithHtml2Pdf } from '../utils/exportPdf';
import {
  Printer,
  X,
  Download,
  Loader2,
  Tag,
  Layers,
  Sparkles,
  PackageCheck,
  ChevronLeft,
  ChevronRight,
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
  const [activePreviewPage, setActivePreviewPage] = useState(1);

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

  // Agrupar en páginas de exactamente 7 etiquetas por hoja A4
  const pages = useMemo<TagItem[][]>(() => {
    const LABELS_PER_PAGE = 7;
    const chunked: TagItem[][] = [];
    for (let i = 0; i < allTags.length; i += LABELS_PER_PAGE) {
      chunked.push(allTags.slice(i, i + LABELS_PER_PAGE));
    }
    return chunked;
  }, [allTags]);

  const totalPages = pages.length;

  // Manejar impresión nativa aislada
  const handlePrint = async () => {
    await printWithActiveClass('printable-id-bolsas-container');
  };

  // Manejar exportación a PDF
  const handleDownloadPdf = async () => {
    try {
      setIsExportingPdf(true);
      const container = document.getElementById('printable-id-bolsas-container');
      if (!container) {
        window.print();
        return;
      }

      const firstLote = lotes[0];
      const safeLoteName = lotes.length === 1
        ? (firstLote?.loteNro || firstLote?.id || 'Lote').replace(/\s+/g, '_')
        : `${lotes.length}_Lotes`;
      const fileName = `ID_Bolsas_${safeLoteName}_${allTags.length}_etiquetas_${new Date().toISOString().slice(0, 10)}.pdf`;

      await exportWithHtml2Pdf(container, fileName, {
        scale: 2.0,
        quality: 0.98,
        margin: [4, 6, 4, 6],
      });
    } catch (err) {
      console.error('Error al exportar PDF de ID Bolsas:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  if (!isOpen || lotes.length === 0) return null;

  return (
    <div
      id="modal-id-bolsas-root"
      className="fixed inset-0 z-[120] overflow-y-auto bg-slate-950/90 backdrop-blur-xs flex flex-col items-center justify-start p-2 sm:p-4 print:p-0 print:bg-white print:static print:inset-auto print:z-auto"
    >
      {/* 1. BARRA DE ACCIONES SUPERIOR (Oculta al imprimir) */}
      <div className="w-full max-w-5xl bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 mb-4 sticky top-2 z-50 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-400 text-slate-950 rounded-xl shadow-xs font-black">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm tracking-wide uppercase text-white">
                Generador de Etiquetas · ID Bolsas
              </h3>
              <span className="bg-amber-400 text-slate-950 text-[10px] font-black font-mono px-2 py-0.5 rounded-full">
                {allTags.length} {allTags.length === 1 ? 'Etiqueta' : 'Etiquetas'}
              </span>
              <span className="bg-emerald-600 text-white text-[10px] font-bold font-mono px-2 py-0.5 rounded-full">
                {totalPages} {totalPages === 1 ? 'Página A4' : 'Páginas A4'} (7/hoja)
              </span>
            </div>
            <p className="text-xs text-slate-300">
              {lotes.length === 1
                ? `Lote ${lotes[0].loteNro || lotes[0].id} · ${lotes[0].cliente} (${lotes[0].variedad})`
                : `${lotes.length} lotes seleccionados para impresión continua`}
            </p>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            id="btn-print-id-bolsas-now"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition cursor-pointer active:scale-95"
            title="Imprimir todas las etiquetas en formato A4 (7 etiquetas por hoja)"
          >
            <Printer className="w-4 h-4 text-slate-950" />
            <span>Imprimir ({allTags.length})</span>
          </button>

          <button
            type="button"
            id="btn-download-pdf-id-bolsas"
            onClick={handleDownloadPdf}
            disabled={isExportingPdf}
            className="flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider rounded-xl border border-white/20 shadow-md transition cursor-pointer disabled:opacity-50 active:scale-95"
            title="Descargar etiquetas en documento PDF de alta calidad"
          >
            {isExportingPdf ? (
              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
            ) : (
              <Download className="w-4 h-4 text-amber-400" />
            )}
            <span>{isExportingPdf ? 'Generando...' : 'Descargar PDF'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 2. CONTROLES DE PAGINACIÓN DE VISTA PREVIA EN PANTALLA */}
      {totalPages > 1 && (
        <div className="w-full max-w-5xl flex items-center justify-between bg-slate-900/80 px-4 py-2 rounded-xl text-xs text-slate-300 mb-4 print:hidden border border-slate-800">
          <div className="flex items-center gap-2">
            <span>Página de vista previa:</span>
            <strong className="text-white font-mono">{activePreviewPage}</strong> de <strong className="text-white font-mono">{totalPages}</strong>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActivePreviewPage((prev) => Math.max(1, prev - 1))}
              disabled={activePreviewPage === 1}
              className="p-1 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono font-bold text-amber-300">
              Etiquetas {(activePreviewPage - 1) * 7 + 1} a {Math.min(activePreviewPage * 7, allTags.length)}
            </span>
            <button
              type="button"
              onClick={() => setActivePreviewPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={activePreviewPage === totalPages}
              className="p-1 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 3. CONTENEDOR PRINCIPAL IMPRIMIBLE CON HOJAS A4 (EXACTAMENTE 7 ETIQUETAS POR HOJA) */}
      <div
        id="printable-id-bolsas-container"
        className="w-full max-w-4xl mx-auto flex flex-col items-center gap-8 print:gap-0 print:m-0 print:p-0 print:w-full print:max-w-none"
      >
        {pages.map((pageTags, pageIndex) => {
          const pageNumber = pageIndex + 1;
          const isCurrentScreenPage = pageNumber === activePreviewPage;
          const isLastPage = pageIndex === pages.length - 1;
          const firstTag = pageTags[0];
          const lastTag = pageTags[pageTags.length - 1];
          const pageLoteNro = firstTag?.lote?.loteNro || firstTag?.lote?.id || 'LOTE';
          const sheetUid = `HOJA-${pageNumber.toString().padStart(2, '0')}-${pageLoteNro}-${allTags.length}`;

          return (
            <div
              key={`id-bolsas-page-${pageIndex}`}
              id={`id-bolsas-page-sheet-${pageIndex}`}
              className={`pagina-etiquetas id-bolsas-a4-page bg-white text-black shadow-2xl border border-gray-300 rounded-sm p-3.5 print:p-0 print:border-none print:shadow-none ${
                isCurrentScreenPage ? 'active-preview-page' : 'id-bolsas-screen-hidden'
              }`}
              style={{
                width: '210mm',
                minWidth: '210mm',
                maxWidth: '210mm',
                height: '296mm',
                minHeight: '296mm',
                maxHeight: '296mm',
                boxSizing: 'border-box',
                padding: '3.5mm 5mm 3mm 5mm',
                backgroundColor: '#FFFFFF',
                pageBreakAfter: isLastPage ? 'auto' : 'always',
                breakAfter: isLastPage ? 'auto' : 'page',
                pageBreakInside: 'avoid',
                breakInside: 'avoid',
                overflow: 'hidden',
              }}
            >
              {/* Renderizar exactamente 7 etiquetas dentro de la grilla A4 */}
              <div
                className="id-bolsas-page-grid w-full flex flex-col justify-between"
                style={{
                  height: 'calc(297mm - 12mm)',
                  maxHeight: 'calc(297mm - 12mm)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '1mm',
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
                        height: '38.5mm',
                        minHeight: '38.5mm',
                        maxHeight: '38.5mm',
                        boxSizing: 'border-box',
                      }}
                    />
                  ))}
              </div>

              {/* Barra de pie de página: Contador y Marca de Identificación Única por Hoja A4 */}
              <div className="id-bolsas-page-meta-bar">
                <div className="flex items-center gap-2">
                  <span>PLANTA CLASIFICADORA LA BARRANCOSA · AGRO ABACUS S.A.</span>
                  <span>·</span>
                  <span className="font-mono">LOTE: {pageLoteNro}</span>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <span>ETIQ. {firstTag?.bagIndex || 1} - {lastTag?.bagIndex || pageTags.length} DE {allTags.length}</span>
                  <span>·</span>
                  <span className="font-black text-black">HOJA {pageNumber} DE {totalPages}</span>
                  <span>·</span>
                  <span className="text-[6pt] text-slate-400">{sheetUid}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
