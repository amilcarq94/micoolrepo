/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Lote, OrdenProceso } from '../types';
import { exportWithHtml2Pdf } from '../utils/exportPdf';
import { printWithActiveClass } from '../utils/printHelper';
import { useFichaLoteData } from '../hooks/useFichaLoteData';
import { FichaTecnicaOficialCard } from './FichaTecnicaOficialCard';
import {
  Printer,
  Download,
  Edit2,
  CheckCircle,
  RotateCcw,
  X,
  FileText,
} from 'lucide-react';

export interface ImprimirFichaTecnicaProps {
  lote: Lote;
  ordenesProceso?: OrdenProceso[];
  isOpen?: boolean;
  onClose?: () => void;
  onSaveLote?: (updatedLote: Lote) => void;
  initialEditMode?: boolean;
}

/**
 * Componente independiente para Imprimir Ficha Técnica de Lote.
 */
export const ImprimirFichaTecnica: React.FC<ImprimirFichaTecnicaProps> = ({
  lote,
  isOpen = true,
  onClose,
  onSaveLote,
  initialEditMode = false,
}) => {
  // Estado de edición para la Ficha Técnica
  const [draftLote, setDraftLote] = useState<Lote>({ ...lote });
  const [isEditing, setIsEditing] = useState<boolean>(initialEditMode);
  const [isModified, setIsModified] = useState<boolean>(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  // Sincronizar borrador si cambia el lote desde las props
  useEffect(() => {
    setDraftLote({ ...lote });
    setIsModified(false);
  }, [lote]);

  const cardRef = useRef<HTMLDivElement>(null);
  const cardDomId = `ficha-tecnica-print-${draftLote.id || 'current'}`;

  // Hook centralizado para datos y formateos de la Ficha
  const {
    stockKgNum,
    stockBolsasNum,
    tablaDatos,
  } = useFichaLoteData(draftLote);

  if (!isOpen) return null;

  // Actualizador genérico de campos
  const handleUpdateField = (field: keyof Lote | string, value: any) => {
    setDraftLote((prev) => ({
      ...prev,
      [field]: value,
    }));
    setIsModified(true);
  };

  // Restablecer valores a los originales del lote
  const handleResetToOriginal = () => {
    setDraftLote({ ...lote });
    setIsModified(false);
  };

  // Guardar cambios opcionalmente en el estado global
  const handleSaveDraft = () => {
    if (onSaveLote) {
      onSaveLote(draftLote);
    }
  };

  // Lanzar la impresión nativa aislando el contenedor con print-active helper
  const handlePrint = async () => {
    await printWithActiveClass(cardDomId);
  };

  // Descargar como documento PDF A4
  const handleDownloadPdf = async () => {
    try {
      setIsDownloadingPdf(true);
      const safeLoteName = (draftLote.loteNro || draftLote.id || 'Lote').replace(/\s+/g, '_');
      const fileName = `Ficha_Tecnica_${safeLoteName}.pdf`;
      const success = await exportWithHtml2Pdf(cardDomId, fileName, { scale: 2.0, quality: 0.98, margin: [6, 8, 6, 8] });
      if (success) {
        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Error al descargar Ficha Técnica en PDF:', err);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-start overflow-y-auto p-2 sm:p-4 md:p-6 animate-in fade-in duration-200 print:p-0 print:bg-white print:static print:inset-auto print:z-auto">
      {/* Estilos específicos de impresión A4 compatibles con printWithActiveClass */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0mm !important;
          }
          html, body {
            width: 210mm !important;
            height: 297mm !important;
            max-height: 297mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            overflow: hidden !important;
          }
          /* Oculta los controles de la interfaz en la impresión */
          .print\\:hidden, header, nav, aside, footer {
            display: none !important;
          }
          /* Estilos específicos cuando se está imprimiendo el contenedor de la Ficha */
          #${cardDomId} {
            width: 210mm !important;
            min-width: 210mm !important;
            max-width: 210mm !important;
            height: 296mm !important;
            min-height: 296mm !important;
            max-height: 296mm !important;
            padding: 8mm 10mm !important;
            box-sizing: border-box !important;
            box-shadow: none !important;
            border: none !important;
            margin: 0 auto !important;
            page-break-before: avoid !important;
            break-before: avoid !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            overflow: hidden !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
          }
        }
      `}</style>

      {/* 1. BARRA SUPERIOR DE ACCIONES */}
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

        {/* Grupo de botones principales */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer border ${
              isEditing
                ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-xs'
                : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
            }`}
            title="Editar campos técnicos y observaciones antes de imprimir"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>{isEditing ? 'Ocultar Edición' : 'Editar Ficha'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs uppercase tracking-wider rounded-lg border border-amber-500/30 transition cursor-pointer disabled:opacity-50"
            title="Descargar la Ficha Técnica completa como archivo PDF A4"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isDownloadingPdf ? 'Generando PDF...' : 'Descargar PDF'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[#006837] hover:bg-[#254731] text-white font-black text-xs uppercase tracking-wider rounded-lg shadow-md transition cursor-pointer border border-emerald-400/40"
            title="Imprimir Ficha Técnica de Lote Oficial en hoja A4"
          >
            <Printer className="w-3.5 h-3.5 text-[#C9922E]" />
            <span>Imprimir A4</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition cursor-pointer ml-1"
              title="Cerrar ventana de impresión"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2. PANEL DE EDICIÓN FLOTANTE */}
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
                  title="Restablecer datos a los originales"
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
                  title="Guardar estos cambios en la base de datos principal"
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
              <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Categoría</label>
              <input
                type="text"
                value={draftLote.categoria || ''}
                onChange={(e) => handleUpdateField('categoria', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg font-semibold text-gray-800 focus:bg-white focus:border-[#006837] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Tipo de Lote</label>
              <input
                type="text"
                value={draftLote.tipo || ''}
                onChange={(e) => handleUpdateField('tipo', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg font-semibold text-gray-800 focus:bg-white focus:border-[#006837] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Tratamiento / Curado</label>
              <input
                type="text"
                value={Array.isArray(draftLote.tratamiento) ? draftLote.tratamiento.join(', ') : (draftLote.tratamiento as any) || ''}
                onChange={(e) => handleUpdateField('tratamiento', e.target.value.split(',').map(s => s.trim()))}
                className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg font-semibold text-gray-800 focus:bg-white focus:border-[#006837] focus:outline-none"
                placeholder="Sin Tratar, Curado..."
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Producto Químico</label>
              <input
                type="text"
                value={draftLote.producto || ''}
                onChange={(e) => handleUpdateField('producto', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg font-semibold text-gray-800 focus:bg-white focus:border-[#006837] focus:outline-none"
                placeholder="Ninguno, Maxim XL..."
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">N° Orden Proceso/Mov.</label>
              <input
                type="text"
                value={draftLote.ordenProcesoId || (draftLote as any).numeroOrdenMovimiento || (draftLote as any).ordenProceso || ''}
                onChange={(e) => handleUpdateField('ordenProcesoId', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg font-semibold text-gray-800 font-mono focus:bg-white focus:border-[#006837] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">N° Bolsón de Origen</label>
              <input
                type="text"
                value={(draftLote as any).numeroBolsonOrigen || (draftLote as any).bolsonOrigenNro || ''}
                onChange={(e) => handleUpdateField('numeroBolsonOrigen', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg font-semibold text-gray-800 focus:bg-white focus:border-[#006837] focus:outline-none"
                placeholder="Ej: B-102, B-103"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Sector Bolsón Origen</label>
              <input
                type="text"
                value={(draftLote as any).sectorBolsonOrigen || ''}
                onChange={(e) => handleUpdateField('sectorBolsonOrigen', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg font-semibold text-gray-800 focus:bg-white focus:border-[#006837] focus:outline-none"
                placeholder="Ej: Sector 1"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Ubicación Acopio</label>
              <input
                type="text"
                value={(draftLote as any).ubicacionAcopio || ''}
                onChange={(e) => handleUpdateField('ubicacionAcopio', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg font-semibold text-gray-800 focus:bg-white focus:border-[#006837] focus:outline-none"
                placeholder="Ej: Ala A - Sector 1"
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
              <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Fecha de Realizado</label>
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
                  Observaciones / Notas Especiales de la Ficha Técnica
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
                placeholder="Ingrese observaciones técnicas, destino o especificaciones especiales de curado o acopio (máx. 200 caracteres)..."
              />
            </div>
          </div>
        </div>
      )}

      {/* Alerta de éxito al descargar PDF */}
      {downloadSuccess && (
        <div className="w-full max-w-4xl bg-emerald-600 text-white px-4 py-2 rounded-xl mb-3 text-xs font-bold flex items-center justify-between animate-in fade-in duration-150 print:hidden">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            <span>Ficha Técnica exportada exitosamente como archivo PDF en alta definición.</span>
          </div>
        </div>
      )}

      {/* 3. VISTA PREVIA / HOJA OFICIAL A4 IMPRIMIBLE */}
      <div className="w-full flex justify-center print:w-full print:block">
        <div ref={cardRef} className="w-full max-w-[780px] print:max-w-full print:w-full print:p-0 print:m-0">
          <FichaTecnicaOficialCard
            id={cardDomId}
            lote={draftLote}
            showWatermark={false}
            isExpandedA4={true}
          />
        </div>
      </div>
    </div>
  );
};
