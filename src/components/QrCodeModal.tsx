/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { QrCode, Copy, Check, Download, Printer, X, Loader2 } from 'lucide-react';
import { Lote } from '../types';
import { QrTrazabilidadLote, getPublicLoteTraceUrl } from './QrTrazabilidadLote';
import { exportCardAsPng } from '../utils/exportImage';

interface QrCodeModalProps {
  lote: Lote;
  onClose: () => void;
}

export const QrCodeModal: React.FC<QrCodeModalProps> = ({ lote, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Generar la URL pública de trazabilidad y ficha técnica del lote
  const qrUrl = getPublicLoteTraceUrl(lote.id);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(qrUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('No se pudo copiar el enlace', err);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    const safeName = `QR_Trazabilidad_${(lote.loteNro || lote.id).replace(/\s+/g, '_')}`;
    await exportCardAsPng('modal-qr-container-box', safeName);
    setDownloading(false);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5 border border-gray-100 flex flex-col items-center relative text-center my-auto max-h-[95vh] overflow-y-auto">
        {/* Botón de cerrar */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
          title="Cerrar Ventana"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icono Cabecera */}
        <div className="p-2 bg-[#E3EFE7] text-[#00603C] rounded-full mb-2">
          <QrCode className="w-6 h-6" />
        </div>

        {/* Título */}
        <h3 className="font-serif text-lg font-bold text-[#1A1A1A]">
          Código QR de Trazabilidad
        </h3>
        <p className="text-[10px] font-mono font-bold text-[#C9922E] tracking-wider uppercase mt-0.5 mb-2">
          Lote: {lote.id}
        </p>
        
        <p className="text-[10px] text-gray-500 max-w-xs mb-3 leading-relaxed">
          Escanee este código para consultar la ficha técnica, disponibilidad y trazabilidad de este lote de manera instantánea.
        </p>

        {/* Contenedor QR */}
        <div id="modal-qr-container-box" className="mb-3 flex flex-col justify-center items-center">
          <QrTrazabilidadLote
            loteId={lote.id}
            size={300}
            className="w-[220px] h-[220px]"
          />
        </div>

        {/* Mostrar Enlace */}
        <div className="w-full bg-gray-50 p-2 rounded-lg border border-gray-100 flex items-center justify-between text-left text-[11px] text-gray-600 mb-3 font-mono overflow-hidden">
          <span className="truncate pr-3 select-all">{qrUrl}</span>
          <button
            onClick={handleCopyLink}
            className="shrink-0 p-1 bg-white text-gray-500 hover:text-[#00603C] hover:bg-gray-100 border border-gray-200 rounded-md transition flex items-center gap-1 font-sans font-bold cursor-pointer"
            title="Copiar Link"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-600" />
                <span className="text-[9px] text-emerald-600">Copiado</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span className="text-[9px]">Copiar</span>
              </>
            )}
          </button>
        </div>

        {/* Botones de acción y de cerrar */}
        <div className="flex flex-col gap-2 w-full">
          <div className="grid grid-cols-2 gap-2 w-full">
            <button
              onClick={handleDownload}
              className="flex items-center justify-center gap-1.5 py-2 px-3 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 hover:text-[#00603C] transition text-xs font-bold cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Descargar
            </button>
            
            <button
              onClick={handlePrint}
              className="flex items-center justify-center gap-1.5 py-2 px-3 bg-[#00603C] text-white rounded-xl hover:bg-[#254731] transition text-xs font-bold shadow-sm cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-[#C9922E]" />
              Imprimir
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 rounded-xl text-xs font-bold font-sans tracking-wider uppercase transition cursor-pointer flex items-center justify-center gap-1.5 mt-1 border border-gray-200/50"
            title="Cerrar Ventana"
          >
            <X className="w-3.5 h-3.5" />
            <span>Cerrar Ventana</span>
          </button>
        </div>
      </div>
    </div>
  );
};
