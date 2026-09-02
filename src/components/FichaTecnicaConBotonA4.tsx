/**
 * Componente unificado para gestión e impresión A4 de Ficha Técnica.
 * Incluye:
 * 1. El botón "FICHA A4" listo para renderizar en la tabla de lotes.
 * 2. El modal preview con edición rápida de campos.
 * 3. Reglas CSS nativas para forzar la salida a 1 sola hoja A4.
 */

import React, { useState, useEffect } from 'react';
import { Lote, OrdenProceso } from '../types';
import { exportWithHtml2Pdf } from '../utils/exportPdf';
import { printWithActiveClass } from '../utils/printHelper';
import { FichaTecnicaOficialCard } from './FichaTecnicaOficialCard';
import {
  Download,
  Edit2,
  CheckCircle,
  RotateCcw,
  X,
  FileText,
} from 'lucide-react';

interface FichaTecnicaConBotonA4Props {
  lote: Lote;
  ordenesProceso?: OrdenProceso[];
  onSaveLote?: (updatedLote) => void;
  className?: string;
}

export const FichaTecnicaConBotonA4: React.FC<FichaTecnicaConBotonA4Props> = ({
  lote,
  ordenesProceso,
  onSaveLote,
  className = '',
}) => {
  // Estado del modal y del borrador
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [draftLote, setDraftLote] = useState<Lote>({ ...lote });
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isModified, setIsModified] = useState<boolean>(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  // Sincronizar datos si cambia el lote seleccionado
  useEffect(() => {
    setDraftLote({ ...lote });
    setIsModified(false);
  }, [lote]);

  const cardDomId = `ficha-tecnica-print-${draftLote.id || 'current'}`;

  // Actualización local de campos
  const handleUpdateField = (field: keyof Lote | string, value: any) => {
    setDraftLote((prev) => ({
      ...prev,
      [field]: value,
    }));
    setIsModified(true);
  };

  const handleResetToOriginal = () => {
    setDraftLote({ ...lote });
    setIsModified(false);
  };

  const handleSaveDraft = () => {
    if (onSaveLote) {
      onSaveLote(draftLote);
    }
  };

  // Disparo de impresión A4 nativa
  const handlePrint = async () => {
    await printWithActiveClass(cardDomId);
  };

  // Descarga en formato PDF
  const handleDownloadPdf = async () => {
    try {
      setIsDownloadingPdf(true);
      const safeLoteName = (draftLote.loteNro || draftLote.id || 'Lote').replace(/\s+/g, '_');
      const fileName = `Ficha_Tecnica_${safeLoteName}.pdf`;
      const success = await exportWithHtml2Pdf(cardDomId, fileName, {
        scale: 2.0,
        quality: 0.98,
        margin: [6, 8, 6, 8],
      });
      if (success) {
        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Error al exportar PDF:', err);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <>
      {/* 1. BOTÓN "FICHA A4" PARA RENDERIZAR EN LA TABLA */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#006837] hover:bg-[#254731] text-white text-xs font-black uppercase tracking-wider rounded-lg shadow-xs transition cursor-pointer border border-emerald-400/40 ${className}`}
        title="Abrir y Descargar Ficha Técnica Oficial en hoja A4 (PDF)"
      >
        <FileText className="w-3.5 h-3.5 text-[#C9922E]" />
        <span>FICHA A4</span>
      </button>

      {/* 2. MODAL Y VISTA PREVIA IMPRIMIBLE */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-start overflow-y-auto p-2 sm:p-4 md:p-6 animate-in fade-in duration-200 print:p-0 print:bg-white print:static print:inset-auto print:z-auto print:overflow-visible">
          
          {/* ESTILOS CSS EXCLUSIVOS PARA GARANTIZAR IMPRESIÓN EN 1 HOJA A4 */}
          <style>{`
            @media print {
              @page {
                size: A4 portrait;
                margin: 0mm !important;
              }
              html, body {
                width: 210mm !important;
                height: 297mm !important;
                margin: 0 !important;
                padding: 0 !important;
                background: white !important;
                color: black !important;
                overflow: hidden !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .print\\:hidden, header, nav, aside, footer, button, input, textarea {
                display: none !important;
              }
              #${cardDomId} {
                width: 210mm !important;
                height: 297mm !important;
                max-height: 297mm !important;
                padding: 10mm !important;
                box-sizing: border-box !important;
                box-shadow: none !important;
                margin: 0 auto !important;
                page-break-after: avoid !important;
                page-break-before: avoid !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                overflow: hidden !important;
                display: block !important;
              }
            }
          `}</style>

          {/* BARRA SUPERIOR DE ACCIONES */}
          <div className="w-full max-w-4xl bg-slate-900 text-white px-4 sm:px-6 py-3.5 rounded-2xl shadow-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4 sticky top-2 z-50 print:hidden">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#006837] rounded-xl text-white shadow-xs">
                <FileText className="w-5 h-5 text-[#C9922E]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-serif font-black text-sm uppercase tracking-wider text-white">
                    Ficha Técnica de Lote (A4)
                  </h3>
                  {isModified && (
                    <span className="bg-amber-500/20 text-amber-300 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold border border-amber-400/30">
                      Modificada
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300">
                  Lote: <strong className="text-emerald-300 font-mono">{draftLote.loteNro}</strong> · {draftLote.cliente}
                </p>
              </div>
            </div>

            {/* BOTONES DE IMPRESIÓN Y ACCIONES */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer border ${
                  isEditing
                    ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-xs'
                    : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                }`}
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>{isEditing ? 'Ocultar Edición' : 'Editar Ficha'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isDownloadingPdf}
                className="flex items-center gap-2 px-4 py-1.5 bg-[#006837] hover:bg-[#254731] text-white font-black text-xs uppercase tracking-wider rounded-lg shadow-md transition cursor-pointer border border-emerald-400/40 disabled:opacity-50"
                title="Descargar Ficha Técnica en Formato Oficial A4 (PDF)"
              >
                <Download className="w-3.5 h-3.5 text-amber-300" />
                <span>{isDownloadingPdf ? 'Generando PDF...' : 'Descargar PDF (A4)'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition cursor-pointer ml-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* PANEL DE EDICIÓN OPCIONAL */}
          {isEditing && (
            <div className="w-full max-w-4xl bg-white text-slate-900 p-5 rounded-2xl shadow-xl border border-gray-200 mb-4 animate-in fade-in slide-in-from-top-2 duration-200 print:hidden">
              <div className="flex items-center justify-between border-b border-gray-200 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-[#006837]" />
                  <h4 className="font-bold text-sm text-gray-900 uppercase tracking-wide">
                    Modificar Campos Técnicos para la Ficha
                  </h4>
                </div>

                <div className="flex items-center gap-2">
                  {isModified && (
                    <button
                      type="button"
                      onClick={handleResetToOriginal}
                      className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 transition cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Restablecer</span>
                    </button>
                  )}

                  {onSaveLote && isModified && (
                    <button
                      type="button"
                      onClick={handleSaveDraft}
                      className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-800 font-bold px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 transition cursor-pointer"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Guardar en Base de Datos</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">N° de Lote</label>
                  <input
                    type="text"
                    value={draftLote.loteNro || ''}
                    onChange={(e) => handleUpdateField('loteNro', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg font-bold text-gray-900 focus:bg-white focus:border-[#006837] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Cliente</label>
                  <input
                    type="text"
                    value={draftLote.cliente || ''}
                    onChange={(e) => handleUpdateField('cliente', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg font-bold text-gray-900 focus:bg-white focus:border-[#006837] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Especie</label>
                  <input
                    type="text"
                    value={draftLote.especie || ''}
                    onChange={(e) => handleUpdateField('especie', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg font-semibold text-gray-800 focus:bg-white focus:border-[#006837] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Variedad</label>
                  <input
                    type="text"
                    value={draftLote.variedad || ''}
                    onChange={(e) => handleUpdateField('variedad', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg font-semibold text-gray-800 focus:bg-white focus:border-[#006837] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Cantidad Bolsas</label>
                  <input
                    type="number"
                    min="0"
                    value={draftLote.stockBolsas || 0}
                    onChange={(e) => handleUpdateField('stockBolsas', Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg font-bold text-gray-900 font-mono focus:bg-white focus:border-[#006837] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Kg por Bolsa</label>
                  <input
                    type="number"
                    min="1"
                    value={draftLote.kgPorBolsa || 800}
                    onChange={(e) => handleUpdateField('kgPorBolsa', Math.max(1, parseInt(e.target.value, 10) || 0))}
                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg font-bold text-gray-900 font-mono focus:bg-white focus:border-[#006837] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Fecha Ingreso</label>
                  <input
                    type="date"
                    value={draftLote.fechaIngreso || ''}
                    onChange={(e) => handleUpdateField('fechaIngreso', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg font-semibold text-gray-800 focus:bg-white focus:border-[#006837] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Stock Total (Kg)</label>
                  <input
                    type="number"
                    value={draftLote.stockKg !== undefined ? draftLote.stockKg : (draftLote.stockBolsas || 0) * (draftLote.kgPorBolsa || 800)}
                    onChange={(e) => handleUpdateField('stockKg', parseInt(e.target.value, 10) || 0)}
                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg font-bold text-gray-900 font-mono focus:bg-white focus:border-[#006837] focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2 md:col-span-4">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold uppercase text-[#006837]">
                      Observaciones / Notas Especiales
                    </label>
                    <span className={`text-[9px] font-mono font-bold ${(draftLote.observaciones || '').length > 180 ? 'text-amber-600' : 'text-gray-400'}`}>
                      {(draftLote.observaciones || '').length}/200 caracteres
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    maxLength={200}
                    value={draftLote.observaciones || ''}
                    onChange={(e) => handleUpdateField('observaciones', e.target.value.slice(0, 200))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-semibold text-gray-800 text-xs focus:bg-white focus:border-[#006837] focus:outline-none resize-none"
                    placeholder="Ingrese observaciones técnicas..."
                  />
                </div>
              </div>
            </div>
          )}

          {downloadSuccess && (
            <div className="w-full max-w-4xl bg-emerald-600 text-white px-4 py-2 rounded-xl mb-3 text-xs font-bold flex items-center justify-between animate-in fade-in duration-150 print:hidden">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                <span>Ficha Técnica exportada exitosamente como archivo PDF.</span>
              </div>
            </div>
          )}

          {/* VISTA PREVIA DE HOJA OFICIAL A4 */}
          <div className="w-full flex justify-center print:w-full print:block">
            <div id={cardDomId} className="w-full max-w-[780px] print:max-w-full">
              <FichaTecnicaOficialCard
                lote={draftLote}
                showWatermark={false}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
