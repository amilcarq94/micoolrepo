/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Lote } from '../types';
import {
  Printer,
  X,
  CheckCircle2,
  Download,
  Loader2,
  FileText,
  Maximize2,
  Minimize2,
  Layers,
} from 'lucide-react';
import { FichaTecnicaOficialCard } from './FichaTecnicaOficialCard';
import {
  exportElementAsPdf,
  exportMultipleElementsAsPdf,
  exportMultipleElementsAsSeparatePdfs,
} from '../utils/exportPdf';
import { printWithActiveClass } from '../utils/printHelper';

interface BatchPrintLotesModalProps {
  isOpen: boolean;
  lotes: Lote[];
  onClose: () => void;
  autoLaunchPrint?: boolean;
}

export const BatchPrintLotesModal: React.FC<BatchPrintLotesModalProps> = ({
  isOpen,
  lotes,
  onClose,
  autoLaunchPrint = false,
}) => {
  const [downloadingPdfIndex, setDownloadingPdfIndex] = useState<number | null>(null);
  const [isDownloadingAllPdf, setIsDownloadingAllPdf] = useState(false);
  const [pdfProgressText, setPdfProgressText] = useState<string>('');
  const [isExpandedA4View, setIsExpandedA4View] = useState<boolean>(true);
  const [downloadSuccessToast, setDownloadSuccessToast] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (isOpen && lotes.length > 0 && autoLaunchPrint) {
      const timer = setTimeout(async () => {
        if (isMounted) {
          await printWithActiveClass('printable-batch-lotes-container');
        }
      }, 300);
      return () => {
        isMounted = false;
        clearTimeout(timer);
      };
    }
  }, [isOpen, lotes, autoLaunchPrint]);

  if (!isOpen || lotes.length === 0) return null;

  const showToast = (message: string) => {
    setDownloadSuccessToast(message);
    setTimeout(() => {
      setDownloadSuccessToast(null);
    }, 3500);
  };

  // Lanzar la impresión nativa garantizando formato A4 (1 ficha por hoja) aislando con print-active
  const handlePrint = async () => {
    await printWithActiveClass('printable-batch-lotes-container');
  };

  // Descargar una ficha individual en PDF (A4 completo)
  const handleDownloadSinglePdf = async (lote: Lote, index: number) => {
    const cardId = `ficha-batch-card-${lote.id || index}`;
    const safeLoteName = (lote.loteNro || lote.id || `Lote_${index + 1}`).replace(/\s+/g, '_');
    const fileName = `Ficha_Tecnica_${safeLoteName}.pdf`;
    setDownloadingPdfIndex(index);
    try {
      const ok = await exportElementAsPdf(cardId, fileName, { scale: 2.0, quality: 0.98 });
      if (ok) {
        showToast(`Ficha ${lote.loteNro || lote.id} descargada en PDF`);
      }
    } catch (e) {
      console.error('Error al descargar PDF:', e);
    } finally {
      setDownloadingPdfIndex(null);
    }
  };

  // Descargar todas las fichas en un único PDF consolidado A4 (1 ficha por página)
  const handleDownloadAllPdfCombined = async () => {
    setIsDownloadingAllPdf(true);
    setPdfProgressText('Preparando páginas A4...');
    try {
      const cardIds = lotes.map((l, i) => `ficha-batch-card-${l.id || i}`);
      const fileName = `Fichas_Lotes_A4_${lotes.length}_lotes_${new Date().toISOString().split('T')[0]}.pdf`;
      const ok = await exportMultipleElementsAsPdf(
        cardIds,
        fileName,
        { scale: 2.0, quality: 0.98 },
        (current, total) => {
          setPdfProgressText(`Generando página ${current} de ${total}...`);
        }
      );
      if (ok) {
        showToast(`¡Documento PDF de ${lotes.length} fichas generado exitosamente!`);
      }
    } catch (e) {
      console.error('Error al descargar PDF combinado:', e);
    } finally {
      setIsDownloadingAllPdf(false);
      setPdfProgressText('');
    }
  };

  // Descargar todas las fichas como PDFs individuales
  const handleDownloadAllPdfSeparate = async () => {
    setIsDownloadingAllPdf(true);
    setPdfProgressText('Preparando descargas...');
    try {
      const items = lotes.map((l, i) => {
        const safeLoteName = (l.loteNro || l.id || `Lote_${i + 1}`).replace(/\s+/g, '_');
        return {
          elementOrId: `ficha-batch-card-${l.id || i}`,
          fileName: `Ficha_Tecnica_${safeLoteName}.pdf`,
        };
      });
      await exportMultipleElementsAsSeparatePdfs(items, { scale: 2.0, quality: 0.98 }, (current, total) => {
        setPdfProgressText(`Descargando PDF ${current} de ${total}...`);
      });
      showToast(`¡${lotes.length} archivos PDF descargados!`);
    } catch (e) {
      console.error('Error al descargar PDFs separados:', e);
    } finally {
      setIsDownloadingAllPdf(false);
      setPdfProgressText('');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/85 backdrop-blur-xs flex flex-col items-center justify-start overflow-y-auto p-2 sm:p-6 animate-in fade-in duration-200 print:p-0 print:bg-white print:static print:inset-auto print:z-auto batch-print-modal-container">
      {/* Toast de confirmación flotante */}
      {downloadSuccessToast && (
        <div className="fixed top-6 right-6 z-[120] bg-emerald-700 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4 duration-200 border border-emerald-500 font-sans print:hidden">
          <CheckCircle2 className="w-5 h-5 text-amber-300 shrink-0" />
          <span className="text-xs font-bold">{downloadSuccessToast}</span>
        </div>
      )}

      {/* Barra Superior de Acciones (Oculta al Imprimir) */}
      <div className="w-full max-w-5xl bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 sticky top-2 z-50 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#00603C] rounded-xl text-white shadow-xs">
            <Printer className="w-5 h-5 text-[#C9922E]" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-sm tracking-wide uppercase text-white flex items-center gap-2">
              <span>Fichas Técnicas de Lote — Hoja Completa A4</span>
              <span className="bg-emerald-800 text-emerald-200 text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold">
                {lotes.length} {lotes.length === 1 ? 'lote seleccionado' : 'lotes seleccionados'}
              </span>
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Impresión exacta a 1 ficha por hoja A4 o descarga digital en PDF.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end shrink-0">
          {/* Botón Toggle Vista Expandida A4 */}
          <button
            type="button"
            onClick={() => setIsExpandedA4View(!isExpandedA4View)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition cursor-pointer ${
              isExpandedA4View
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/50'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
            }`}
            title="Alternar entre vista A4 completa y compacta"
          >
            {isExpandedA4View ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            <span>{isExpandedA4View ? 'Vista A4 Expandida' : 'Vista Compacta'}</span>
          </button>

          {/* Botón Descargar PDF (Consolidado A4) */}
          <button
            type="button"
            onClick={handleDownloadAllPdfCombined}
            disabled={isDownloadingAllPdf}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-red-800 to-red-700 hover:from-red-700 hover:to-red-600 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl border border-red-500/40 shadow-sm transition cursor-pointer disabled:opacity-50"
            title="Descargar documento PDF con todas las fichas (1 ficha por hoja A4)"
          >
            {isDownloadingAllPdf ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <FileText className="w-4 h-4 text-amber-300" />
            )}
            <span>
              {isDownloadingAllPdf
                ? pdfProgressText || 'Generando PDF...'
                : lotes.length === 1
                ? 'Descargar PDF (A4)'
                : `Descargar PDF (${lotes.length} lotes)`}
            </span>
          </button>

          {/* Botón Aceptar e Imprimir */}
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-[#00603C] hover:bg-[#254731] text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md transition cursor-pointer border border-emerald-500/30"
            title="Enviar a impresora física o guardar como PDF del navegador"
          >
            <CheckCircle2 className="w-4 h-4 text-amber-300" />
            <Printer className="w-4 h-4 text-[#C9922E]" />
            <span>Imprimir ({lotes.length})</span>
          </button>

          {/* Botón Cerrar */}
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs uppercase tracking-wider rounded-xl border border-slate-700 transition cursor-pointer"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Estilos CSS Específicos para Impresión A4 de Hoja Única Estricta */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm 6mm 6mm 6mm;
          }
          body, html {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            overflow: visible !important;
          }
          /* Ocultar elementos generales de la app y contenido de fondo al imprimir */
          header, nav, aside, footer, button, .print\:hidden, .print-hidden, .no-print,
          #nav-tab-dashboard, #nav-tab-lotes, #nav-tab-despachos, #nav-tab-historial-salidas, #nav-tab-importar, #lotes-stats-summary-bar,
          #lotes-view-container, #lotes-view-content, #lote-detail-container, #lote-detail-interactive-view {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
          }
          /* Contenedor del modal visible en flujo natural */
          .batch-print-modal-container {
            position: static !important;
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            display: block !important;
            overflow: visible !important;
            inset: auto !important;
            transform: none !important;
            z-index: auto !important;
          }
          /* Regla estricta: 1 ficha por hoja completa A4 */
          .batch-print-page-break {
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            width: 100% !important;
            min-height: 278mm !important;
            max-height: 284mm !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 12px 16px !important;
            border: 1.5px solid #005A36 !important;
            background: #ffffff !important;
          }
          .batch-print-page-break:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
        }
      `}</style>

      {/* Contenedor Imprimible */}
      <div
        id="printable-batch-lotes-container"
        className={`w-full transition-all duration-200 print:space-y-0 print:w-full print:max-w-none ${
          isExpandedA4View ? 'max-w-4xl space-y-10' : 'max-w-3xl space-y-6'
        }`}
      >
        {lotes.map((lote, index) => {
          const cardDomId = `ficha-batch-card-${lote.id || index}`;
          const isDownloadingThisPdf = downloadingPdfIndex === index;

          return (
            <div
              key={lote.id || `lote-print-${index}`}
              className="relative group bg-slate-950/40 p-3 sm:p-5 rounded-3xl border border-slate-700/60 shadow-xl print:p-0 print:bg-white print:border-none print:shadow-none"
            >
              {/* Barra de Acciones Individual de la Ficha (sólo en pantalla) */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3 px-2 print:hidden">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-amber-300 font-mono font-bold text-xs border border-slate-700">
                    Ficha {index + 1} de {lotes.length}
                  </span>
                  <span className="text-xs font-bold text-slate-300 truncate">
                    {lote.loteNro || lote.id} · {lote.cliente}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Descargar PDF Individual */}
                  <button
                    type="button"
                    onClick={() => handleDownloadSinglePdf(lote, index)}
                    disabled={isDownloadingThisPdf}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-red-900/80 hover:bg-red-800 text-white rounded-lg shadow-sm border border-red-700 text-xs font-bold transition cursor-pointer disabled:opacity-50"
                    title="Descargar esta ficha técnica en formato PDF A4"
                  >
                    {isDownloadingThisPdf ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    ) : (
                      <FileText className="w-3.5 h-3.5 text-amber-300" />
                    )}
                    <span>Descargar PDF</span>
                  </button>
                </div>
              </div>

              {/* Componente Ficha Técnica Oficial (1 por Hoja) */}
              <div className="ficha-tecnica-a4-container batch-print-page-break">
                <FichaTecnicaOficialCard
                  id={cardDomId}
                  lote={lote}
                  index={index}
                  isExpandedA4={isExpandedA4View}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Barra Inferior de Acciones (Oculta al Imprimir) */}
      <div className="w-full max-w-5xl bg-slate-900 text-white p-4 rounded-2xl shadow-xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 sticky bottom-2 z-50 print:hidden">
        <div className="text-xs text-slate-300 flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-400" />
          <span>
            Total de fichas vinculadas para impresión A4:{' '}
            <strong className="text-amber-400 font-mono font-bold text-sm">{lotes.length}</strong>{' '}
            (1 ficha por página).
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs uppercase tracking-wider rounded-xl border border-slate-700 transition cursor-pointer"
          >
            <X className="w-4 h-4 text-slate-400" />
            <span>Cerrar</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadAllPdfCombined}
            disabled={isDownloadingAllPdf}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-red-800 to-red-700 hover:from-red-700 hover:to-red-600 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl border border-red-500/40 shadow-sm transition cursor-pointer disabled:opacity-50"
          >
            {isDownloadingAllPdf ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <FileText className="w-4 h-4 text-amber-300" />
            )}
            <span>
              {isDownloadingAllPdf
                ? pdfProgressText || 'Generando PDF...'
                : `Descargar ${lotes.length} en 1 PDF`}
            </span>
          </button>

          <button
            type="button"
            onClick={handleDownloadAllPdfSeparate}
            disabled={isDownloadingAllPdf}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs uppercase tracking-wider rounded-xl border border-slate-700 transition cursor-pointer disabled:opacity-50"
            title="Descargar cada ficha como un archivo PDF separado"
          >
            <Download className="w-4 h-4 text-slate-400" />
            <span>PDFs Individuales</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2 bg-[#00603C] hover:bg-[#254731] text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md transition cursor-pointer border border-emerald-500/30"
          >
            <CheckCircle2 className="w-4 h-4 text-amber-300" />
            <Printer className="w-4 h-4 text-[#C9922E]" />
            <span>Aceptar e Imprimir ({lotes.length})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
