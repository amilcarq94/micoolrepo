/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Download,
  X,
  Check,
  FileCheck,
  FileText,
  Loader2,
  Settings,
  Monitor
} from 'lucide-react';
import { FichaTecnicaSiloCard } from './FichaTecnicaSiloCard';
import { exportElementAsPdf } from '../utils/exportPdf';

/**
 * Interface estricta de información técnica de Silos
 */
export interface SiloFichaInfo {
  siloId: string;
  denominacion?: string;
  capacidadKg?: number;
  capacidadBolsas?: number;
  kgPorBolsa?: number;
  cliente?: string;
  especie?: string;
  variedad?: string;
  categoria?: string;
  loteNro?: string;
  tratamiento?: string | string[];
  humedad?: number;
  temperatura?: number;
  observaciones?: string;
  fechaMuestreo?: string;
  ubicacion?: string;
}

/**
 * Interface para las opciones y configuraciones de impresión
 */
export interface PrintOptions {
  printerName?: string;
  mode: 'system_dialog' | 'direct' | 'pdf';
  copies: number;
  silentPrint?: boolean;
}

interface FichaTecnicaSiloModalProps {
  ficha: SiloFichaInfo | null;
  onClose: () => void;
  availablePrinters?: string[];
  onDirectPrint?: (ficha: SiloFichaInfo, options: PrintOptions) => Promise<boolean>;
}

export const FichaTecnicaSiloModal: React.FC<FichaTecnicaSiloModalProps> = ({
  ficha,
  onClose,
  availablePrinters = [],
  onDirectPrint,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);

  if (!ficha) return null;

  const handleDownloadPdf = async () => {
    const el = document.getElementById('ficha-silo-printable-card');
    if (!el) return;
    try {
      setIsDownloading(true);
      const safeSiloName = ficha.siloId.replace(/\s+/g, '_');
      const fileName = `Ficha_Tecnica_${safeSiloName}_${new Date().toISOString().split('T')[0]}.pdf`;
      await exportElementAsPdf(el, fileName, { scale: 2.5, quality: 0.98 });
    } catch (err) {
      console.error('Error al descargar PDF de Ficha Silo:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  return createPortal(
    <div className="print-portal-root fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-4 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto print:z-auto print:items-start">
      {/* Estilos CSS dedicados para impresión de Ficha Individual de Silo en Hoja A4 */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 15mm 15mm 15mm 15mm;
          }
          html, body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          /* Ocultar solo elementos específicos de la UI, no todo el body */
          header, nav, aside, footer, button, .print\\:hidden, 
          #nav-tab-dashboard, #nav-tab-lotes, #nav-tab-despachos, #nav-tab-historial-salidas, #nav-tab-importar {
            display: none !important;
          }
          /* Asegurar que el contenedor del modal sea visible y se comporte como un bloque normal */
          .ficha-silo-modal-root {
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
          .ficha-silo-print-wrapper {
            width: 100% !important;
            max-width: 180mm !important;
            margin: 0 auto !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>

      <div className="ficha-silo-modal-root flex flex-col items-center gap-4 max-h-[95vh] my-auto">
        {/* Barra de Acciones Superior */}
        <div className="flex items-center justify-between w-full max-w-[520px] bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-xl border border-slate-800 print:hidden">
          <div className="flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-black text-white uppercase tracking-wider">
              Ficha Técnica · {ficha.siloId}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              className="px-4 py-1.5 bg-[#005E38] hover:bg-[#004D2E] text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-md cursor-pointer active:scale-95 border border-emerald-400/40 disabled:opacity-50"
              title="Descargar Ficha en formato PDF"
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
              className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition cursor-pointer"
              title="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tarjeta Visual de Ficha */}
        <div className="ficha-silo-print-wrapper w-full max-w-[520px]">
          <FichaTecnicaSiloCard
            elementId="ficha-silo-printable-card"
            ficha={ficha}
          />
        </div>

        {/* Barra de Botones Inferior */}
        <div className="flex items-center justify-end gap-2.5 w-full max-w-[520px] bg-slate-100 p-3 rounded-2xl border border-slate-300 print:hidden shadow-md">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition cursor-pointer"
          >
            Cerrar
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isDownloading}
            className="px-5 py-2 bg-[#005E38] hover:bg-[#004D2E] text-white font-bold text-xs rounded-xl border border-emerald-500/40 transition flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
          >
            {isDownloading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
            ) : (
              <FileText className="w-3.5 h-3.5 text-amber-300" />
            )}
            <span>Descargar PDF</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
