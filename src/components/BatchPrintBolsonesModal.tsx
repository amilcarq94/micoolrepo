/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BolsonCampo, MovimientoSilo } from '../types';
import { exportMultipleElementsAsPdf } from '../utils/exportPdf';
import { bolsonToFichaLoteJSON } from './FichaBolsonA4';
import { FichaTecnicaLoteCard } from './FichaTecnicaLotePrintManager';
import { printWithActiveClass } from '../utils/printHelper';
import {
  Download,
  X,
  Layers,
  Sparkles
} from 'lucide-react';

interface BatchPrintBolsonesModalProps {
  bolsones: BolsonCampo[];
  movimientosSilo?: MovimientoSilo[];
  isOpen: boolean;
  onClose: () => void;
}

export const BatchPrintBolsonesModal: React.FC<BatchPrintBolsonesModalProps> = ({
  bolsones,
  movimientosSilo = [],
  isOpen,
  onClose,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  if (!isOpen || !bolsones || bolsones.length === 0) return null;

  const handlePrintAll = async () => {
    await printWithActiveClass('printable-batch-bolsones-container');
  };

  const handleExportBatchPdf = async () => {
    try {
      setIsExporting(true);
      setProgress({ current: 0, total: bolsones.length });

      const elementIds = bolsones.map(b => `ficha-bolson-a4-${b.id}`);
      const fileName = `Fichas_Tecnicas_Lotes_${bolsones.length}_Hojas_${new Date().toISOString().slice(0, 10)}.pdf`;

      await exportMultipleElementsAsPdf(
        elementIds,
        fileName,
        { scale: 2.0, quality: 0.98, margin: [10, 12, 10, 12] },
        (current, total) => {
          setProgress({ current, total });
        }
      );
    } catch (err) {
      console.error('Error al exportar lote de fichas en PDF:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/90 backdrop-blur-xs flex flex-col items-center justify-start p-3 sm:p-6 print:p-0 print:bg-transparent print:static print:inset-auto print:z-auto">
      {/* 1. BARRA SUPERIOR DE ACCIONES */}
      <div className="w-full max-w-5xl bg-slate-900 text-white px-5 py-4 rounded-2xl shadow-2xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 sticky top-2 z-50 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#00603C] rounded-xl text-white shadow-xs border border-emerald-500/30">
            <Layers className="w-6 h-6 text-amber-300" />
          </div>
          <div>
            <h3 className="font-bold text-sm tracking-wide uppercase text-white flex items-center gap-2">
              <span>Impresión Múltiple de Fichas Técnicas de Lotes (A4)</span>
              <span className="bg-amber-400 text-slate-950 text-[10px] font-black font-mono px-2 py-0.5 rounded-full">
                {bolsones.length} {bolsones.length === 1 ? 'Lote' : 'Lotes'}
              </span>
            </h3>
            <p className="text-xs text-slate-300">
              Generación de 1 hoja A4 completa por ficha de lote con distribución simétrica y colores institucionales.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportBatchPdf}
            disabled={isExporting}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#00603C] hover:bg-[#004227] text-white font-extrabold text-xs uppercase tracking-wider rounded-xl border border-emerald-500/40 shadow-md transition cursor-pointer disabled:opacity-50 active:scale-95"
          >
            <Download className="w-4 h-4 text-amber-300" />
            <span>{isExporting ? `Exportando (${progress.current}/${progress.total})...` : `Descargar PDF (${bolsones.length} lotes)`}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Barra de Progreso de Exportación */}
      {isExporting && (
        <div className="w-full max-w-5xl bg-white p-4 rounded-2xl shadow-xl border border-slate-200 mb-6 print:hidden animate-in fade-in">
          <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-2">
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 animate-spin" />
              Generando páginas A4 de alta fidelidad...
            </span>
            <span className="font-mono text-emerald-800">
              {progress.current} de {progress.total} completados
            </span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-600 to-teal-500 transition-all duration-300"
              style={{ width: `${(progress.current / Math.max(1, progress.total)) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* 2. RENDERIZADO DE TODAS LAS FICHAS A4 */}
      <div id="printable-batch-bolsones-container" className="w-full flex flex-col items-center gap-8 print:gap-0 print:block">
        {bolsones.map((b, index) => {
          const data = bolsonToFichaLoteJSON(b, movimientosSilo);
          return (
            <div key={b.id || index} className="print:break-after-page print:page-break-after-always">
              <FichaTecnicaLoteCard
                data={data}
                index={index}
                id={`ficha-bolson-a4-${b.id}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
