/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Printer, Download, X, Check, Grid3X3, FileText, Loader2 } from 'lucide-react';
import { FichaTecnicaSiloCard, SiloFichaInfo } from './FichaTecnicaSiloCard';
import { exportElementAsPdf } from '../utils/exportPdf';
import { printWithActiveClass } from '../utils/printHelper';

interface GrillaSeisSilosModalProps {
  fichas: SiloFichaInfo[];
  onClose: () => void;
}

export const GrillaSeisSilosModal: React.FC<GrillaSeisSilosModalProps> = ({
  fichas,
  onClose,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);

  const handlePrint = async () => {
    await printWithActiveClass('grilla-seis-silos-printable');
  };

  const handleDownloadPdf = async () => {
    const el = document.getElementById('grilla-seis-silos-printable');
    if (!el) return;
    try {
      setIsDownloading(true);
      const fileName = `Grilla_6_Silos_AgroAbacus_${new Date().toISOString().split('T')[0]}.pdf`;
      await exportElementAsPdf(el, fileName, { scale: 2.5, quality: 0.98 });
    } catch (err) {
      console.error('Error al descargar PDF de Grilla 6 Silos:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/85 backdrop-blur-xs p-4 overflow-y-auto print:p-0 print:bg-white">
      {/* Estilos CSS para Impresión de 6 Fichas en 1 Sola Hoja A4 */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm 6mm 6mm 6mm;
          }
          html, body, #root, main {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            overflow: visible !important;
          }
          header, nav, aside, footer, button, .print\\:hidden, #nav-tab-dashboard, #nav-tab-lotes, #nav-tab-despachos, #nav-tab-historial-salidas, #nav-tab-importar {
            display: none !important;
          }
          .grilla-silos-modal-root {
            position: static !important;
            width: 100% !important;
            margin: 0 auto !important;
            padding: 0 !important;
            background: #ffffff !important;
            display: block !important;
            overflow: visible !important;
          }
          #grilla-seis-silos-printable {
            width: 198mm !important;
            max-width: 198mm !important;
            height: 284mm !important;
            max-height: 284mm !important;
            margin: 0 auto !important;
            padding: 2mm !important;
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            grid-template-rows: repeat(3, 1fr) !important;
            gap: 3mm !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      <div className="grilla-silos-modal-root flex flex-col items-center gap-4 max-h-[98vh] my-auto">
        {/* Barra Superior de Acciones */}
        <div className="flex items-center justify-between w-full max-w-[850px] bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-xl border border-slate-800 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-emerald-500/20 rounded-lg text-emerald-400">
              <Grid3X3 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-black text-white uppercase tracking-wider block">
                6 Fichas Técnicas de Silo · 1 Hoja A4
              </span>
              <span className="text-[11px] text-slate-400">
                Grilla de 2 columnas × 3 filas optimizada para impresión
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-[#005E38] hover:bg-[#004D2E] text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
              title="Imprimir las 6 fichas en 1 hoja A4"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Hoja A4 (6 Silos)</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              className="px-3.5 py-2 bg-gradient-to-r from-red-800 to-red-700 hover:from-red-700 hover:to-red-600 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 border border-red-500/40 disabled:opacity-50"
              title="Descargar la grilla completa en formato PDF"
            >
              {isDownloading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-amber-300" />
              )}
              <span>{isDownloading ? 'Generando...' : 'Descargar PDF'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition cursor-pointer"
              title="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Contenedor Grilla de 6 Mini-Fichas (2 columnas x 3 filas) */}
        <div className="overflow-y-auto max-h-[75vh] w-full max-w-[850px] p-2 bg-slate-200/60 rounded-2xl border border-slate-300 shadow-inner flex items-center justify-center">
          <div
            id="grilla-seis-silos-printable"
            className="w-full bg-white p-3 sm:p-4 rounded-xl shadow-md grid grid-cols-1 sm:grid-cols-2 gap-3"
            style={{
              maxWidth: '820px',
            }}
          >
            {fichas.map((f, idx) => (
              <div key={f.siloId || idx} className="h-full">
                <FichaTecnicaSiloCard
                  ficha={f}
                  isMini={true}
                  elementId={`mini-ficha-${f.siloId.replace(/\s+/g, '-')}`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Barra Inferior de Acciones */}
        <div className="flex items-center justify-end gap-2.5 w-full max-w-[850px] bg-slate-100 p-3 rounded-2xl border border-slate-300 print:hidden shadow-md">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isDownloading}
            className="px-4 py-2 bg-gradient-to-r from-red-800 to-red-700 hover:from-red-700 hover:to-red-600 text-white font-bold text-xs rounded-xl border border-red-600/50 transition flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
          >
            {isDownloading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
            ) : (
              <FileText className="w-3.5 h-3.5 text-amber-300" />
            )}
            <span>Descargar PDF</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-2 bg-[#005E38] hover:bg-[#004D2E] text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir 6 Silos (A4)</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
          >
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>Aceptar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
