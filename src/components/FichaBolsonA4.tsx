/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { BolsonCampo, MovimientoSilo } from '../types';
import { exportWithHtml2Pdf } from '../utils/exportPdf';
import { FichaLoteJSON, FichaTecnicaLoteCard } from './FichaTecnicaLotePrintManager';
import {
  Printer,
  Download,
  X,
  FileText,
  Layers,
} from 'lucide-react';

export interface FichaBolsonA4Props {
  bolson: BolsonCampo;
  movimientosSilo?: MovimientoSilo[];
  isOpen?: boolean;
  onClose?: () => void;
}

export function bolsonToFichaLoteJSON(b: BolsonCampo, movimientosSilo: MovimientoSilo[] = []): FichaLoteJSON {
  const normNro = (b.numeroBolson || '').trim().toLowerCase();
  const movsAsociados = (movimientosSilo || []).filter(m =>
    m.tipo === 'INGRESO' && (
      (m.bolsonOrigenId && m.bolsonOrigenId === b.id) ||
      (m.bolsonOrigenNro && m.bolsonOrigenNro.trim().toLowerCase() === normNro)
    )
  );
  const salidasKg = Math.max(
    b.salidasKg || 0,
    movsAsociados.reduce((acc, m) => acc + (m.kg || 0), 0)
  );
  const existenciasKg = Math.max(0, (b.entradasKg || 0) - salidasKg);

  const nombreLote = b.numeroBolson
    ? (b.numeroBolson.toUpperCase().includes('BOLSA') || b.numeroBolson.toUpperCase().includes('LOTE')
        ? b.numeroBolson.toUpperCase()
        : `BOLSA ${b.numeroBolson.toUpperCase()}`)
    : (b.campo ? `LOTE ${b.campo.toUpperCase()}` : 'LOTE EN CAMPO');

  return {
    nombre_lote: nombreLote,
    cliente: (b.cliente || 'AGROPECUARIA SANTA ROSA S.A.').toUpperCase(),
    variedad: (b.variedad
      ? (b.cultivo ? `${b.cultivo} ${b.variedad}` : b.variedad)
      : (b.cultivo ? `${b.cultivo} ESTÁNDAR` : 'DON MARIO 46E21')
    ).toUpperCase(),
    categoria: (b.categoria || 'SEMILLA CERTIFICADA').toUpperCase(),
    tratamiento: (b.tratamiento || 'INOCULADO + FUNGICIDA').toUpperCase(),
    tipo_lote: (b.ordenSiembra || b.cicloCultivo || (b.cultivo ? `${b.cultivo} DE PRIMERA` : 'SOJA DE PRIMERA')).toUpperCase(),
    deposito_origen: b.deposito || b.campo || 'Lote 20',
    bolsa_origen: b.numeroBolson || 'S29,2',
    ciclo_cultivo: b.cicloCultivo || b.ordenSiembra || 'Soja Primera',
    fecha_cosecha: b.fechaCosecha || b.fechaIngreso || '15/04/2026',
    ingresos_kg: b.entradasKg || 0,
    extraidos_kg: salidasKg,
    existencias_kg: b.stockKg !== undefined ? b.stockKg : existenciasKg,
    humedad: b.humedad ? `${b.humedad} %` : '12,5 %',
    calidad: (b.calidad || 'GRADO 1').toUpperCase(),
    observaciones: b.observaciones || 'Monitoreado periódicamente sin desviaciones. Confección con hermeticidad certificada.',
  };
}

export const FichaBolsonA4: React.FC<FichaBolsonA4Props> = ({
  bolson,
  movimientosSilo = [],
  isOpen = true,
  onClose,
}) => {
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const fichaRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !bolson) return null;

  const containerId = `ficha-bolson-a4-${bolson.id}`;
  const safeName = (bolson.numeroBolson || bolson.id).replace(/\s+/g, '_');
  const fichaData = bolsonToFichaLoteJSON(bolson, movimientosSilo);

  const handlePrint = async () => {
    try {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
      window.print();
    } catch {
      window.print();
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setIsExportingPdf(true);
      const fileName = `Ficha_Tecnica_Lote_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`;
      await exportWithHtml2Pdf(containerId, fileName, {
        scale: 2.0,
        quality: 0.98,
        margin: [10, 12, 10, 12],
      });
    } catch (err) {
      console.error('Error al exportar ficha en PDF:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-start p-3 sm:p-6 print:p-0 print:bg-transparent print:static print:inset-auto print:z-auto">
      {/* 1. BARRA DE ACCIONES SUPERIOR */}
      <div className="w-full max-w-4xl bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 sticky top-2 z-50 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#005A36] rounded-xl text-white shadow-xs border border-emerald-500/30">
            <FileText className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <h3 className="font-bold text-sm tracking-wide uppercase text-white">
              Ficha Técnica de Lote — Hoja A4
            </h3>
            <p className="text-xs text-slate-300">
              Formato oficial A4 (210mm x 297mm) con tablas a borde completo y control de stock.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-[#005A36] hover:bg-[#004227] text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md transition cursor-pointer border border-emerald-500/30 active:scale-95"
          >
            <Printer className="w-4 h-4 text-amber-300" />
            <span>Imprimir A4</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isExportingPdf}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-800 to-red-700 hover:from-red-700 hover:to-red-600 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl border border-red-500/40 shadow-sm transition cursor-pointer disabled:opacity-50 active:scale-95"
          >
            <Download className="w-4 h-4 text-amber-300" />
            <span>{isExportingPdf ? 'Generando PDF...' : 'Descargar PDF (A4)'}</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2. LIENZO A4 ESTRUCTURADO (210mm x 297mm) */}
      <div id="seccion-impresion" ref={fichaRef} className="w-full flex justify-center print:block seccion-impresion">
        <FichaTecnicaLoteCard data={fichaData} id={containerId} />
      </div>
    </div>
  );
};
