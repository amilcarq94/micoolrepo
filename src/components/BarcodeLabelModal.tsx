/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { QRCodeCanvas } from 'qrcode.react';
import { Barcode, X, Download, Columns, Grid, Layout, Loader2 } from 'lucide-react';
import { Lote } from '../types';
import { exportWithHtml2Pdf } from '../utils/exportPdf';

interface BarcodeLabelModalProps {
  lote: Lote;
  onClose: () => void;
}

type LabelTemplateType = 'silo' | 'bag' | 'thermal';

export const BarcodeLabelModal: React.FC<BarcodeLabelModalProps> = ({ lote, onClose }) => {
  const [template, setTemplate] = useState<LabelTemplateType>('thermal');
  const [copies, setCopies] = useState<number>(1);
  const barcodeSvgRef = useRef<SVGSVGElement>(null);
  const printQrCanvasRef = useRef<HTMLCanvasElement>(null);

  // Generar la URL de trazabilidad
  const qrUrl = `${window.location.origin}${window.location.pathname}?lote=${lote.id}`;

  useEffect(() => {
    if (barcodeSvgRef.current) {
      try {
        JsBarcode(barcodeSvgRef.current, lote.id, {
          format: 'CODE128',
          lineColor: '#000000',
          width: 2.2,
          height: 70,
          displayValue: true,
          fontSize: 14,
          font: 'monospace',
          fontOptions: 'bold',
          textMargin: 6,
          margin: 10,
        });
      } catch (err) {
        console.error('Error generando código de barras:', err);
      }
    }
  }, [lote.id, template]);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Obtener los datos SVG del código de barras
    const barcodeSvgElement = barcodeSvgRef.current;
    if (!barcodeSvgElement) return;
    const serializer = new XMLSerializer();
    const barcodeSvgString = serializer.serializeToString(barcodeSvgElement);

    // Obtener datos QR para el caso de etiqueta de bolsa o térmica que lo incluye
    let qrImgSrc = '';
    if (printQrCanvasRef.current) {
      qrImgSrc = printQrCanvasRef.current.toDataURL('image/png');
    }

    // Configurar HTML de impresión con estilos @media print de alta precisión
    let labelHtml = '';

    if (template === 'silo') {
      // Plantilla de Silo (Tamaño grande, alta visibilidad)
      labelHtml = `
        <div class="label-card silo-layout">
          <div class="header">
            <div class="brand">AGRO ABACUS S.A.</div>
            <div class="sub-brand">Estancia La Barrancosa</div>
          </div>
          
          <div class="title">RÓTULO DE SILO / DEPÓSITO</div>
          
          <div class="main-id">LOTE: ${lote.id}</div>
          
          <div class="grid-2">
            <div class="info-group">
              <span class="label">ESPECIE / GRANO</span>
              <span class="val">${lote.especie}</span>
            </div>
            <div class="info-group">
              <span class="label">VARIEDAD / CAT.</span>
              <span class="val">${lote.variedad} (${lote.categoria || 'S/C'})</span>
            </div>
          </div>

          <div class="grid-2">
            <div class="info-group">
              <span class="label">CLIENTE COMITENTE</span>
              <span class="val">${lote.cliente}</span>
            </div>
            <div class="info-group">
              <span class="label">TRATAMIENTO</span>
              <span class="val">${lote.tratamiento.join(' + ') || 'Ninguno'}</span>
            </div>
          </div>

          <div class="barcode-container">
            ${barcodeSvgString}
          </div>

          <div class="footer">
            Control de Calidad · Planta Clasificadora de Semillas
          </div>
        </div>
      `;
    } else if (template === 'bag') {
      // Plantilla de Bolsa / Bolsón (Completa con QR y Barcode)
      labelHtml = `
        <div class="label-card bag-layout">
          <div class="header">
            <div class="brand">AGRO ABACUS S.A.</div>
            <div class="sub-brand">Semillas de Primera Selección</div>
          </div>
          
          <div class="bolsa-full-banner">
            <span class="bolsa-banner-title">IDENTIFICACIÓN:</span>
            <span class="bolsa-banner-main">BOLSA N° ___ DE ${lote.stockBolsas || 1}</span>
            <span class="bolsa-banner-tag">${lote.kgPorBolsa ? `${lote.kgPorBolsa} KG` : '800 KG'}</span>
          </div>

          <div class="cols-main">
            <div class="left-col">
              <div class="field-item">
                <span class="label">LOTE</span>
                <span class="val-lote">${lote.id}</span>
              </div>
              <div class="field-item">
                <span class="label">ESPECIE</span>
                <span class="val">${lote.especie}</span>
              </div>
              <div class="field-item">
                <span class="label">VARIEDAD</span>
                <span class="val">${lote.variedad}</span>
              </div>
              <div class="field-item">
                <span class="label">FECHA CLASIFICACIÓN</span>
                <span class="val">${new Date(lote.fechaIngreso).toLocaleDateString('es-AR')}</span>
              </div>
            </div>
            
            <div class="right-col text-center">
              <div class="qr-label">ESCANEAR PARA TRAZABILIDAD</div>
              <img class="qr-img" src="${qrImgSrc}" />
            </div>
          </div>

          <div class="grid-2">
            <div class="field-item">
              <span class="label">TRATAMIENTO</span>
              <span class="val-sm">${lote.tratamiento.join(' + ')} (${lote.producto})</span>
            </div>
            <div class="field-item">
              <span class="label">PRODUCTOR / COMITENTE</span>
              <span class="val-sm">${lote.cliente}</span>
            </div>
          </div>

          <div class="barcode-container-compact">
            ${barcodeSvgString}
          </div>
        </div>
      `;
    } else {
      // Plantilla Térmica (Ideal para etiquetas de 100x50 mm)
      labelHtml = `
        <div class="label-card thermal-layout">
          <div class="thermal-header">
            <span>AGRO ABACUS (L-BARRANCOSA)</span>
            <strong>LOTE: ${lote.id}</strong>
          </div>

          <div class="thermal-bolsa-banner">
            BOLSA N° ___ DE ${lote.stockBolsas || 1} · ${lote.kgPorBolsa ? `${lote.kgPorBolsa} KG` : '800 KG'}
          </div>
          
          <div class="thermal-body">
            <div class="thermal-info">
              <div><strong>ESP:</strong> ${lote.especie}</div>
              <div><strong>VAR/CAT:</strong> ${lote.variedad} (${lote.categoria || 'S/C'})</div>
              <div><strong>TRAT:</strong> ${lote.producto}</div>
              <div><strong>TOTAL:</strong> ${lote.stockBolsas} b.</div>
            </div>
            <div class="thermal-qr">
              <img src="${qrImgSrc}" width="55" height="55" />
            </div>
          </div>
          
          <div class="thermal-barcode">
            ${barcodeSvgString}
          </div>
        </div>
      `;
    }

    // Repetir la etiqueta según la cantidad de copias deseadas
    let finalLabelsContent = '';
    for (let i = 0; i < copies; i++) {
      finalLabelsContent += labelHtml;
      if (i < copies - 1) {
        finalLabelsContent += '<div class="page-break"></div>';
      }
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Etiquetas Lote ${lote.id}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
            
            body {
              font-family: 'Inter', -apple-system, sans-serif;
              margin: 0;
              padding: 0;
              background: #fff;
              color: #000;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            .page-break {
              page-break-after: always;
              break-after: page;
            }

            /* --- ESTILOS GENERALES --- */
            .label-card {
              box-sizing: border-box;
              margin: 10px auto;
              background: #fff;
              border: 2px solid #000;
              color: #000;
              overflow: hidden;
            }

            /* --- ESTILO 1: SILO (Grande) --- */
            .silo-layout {
              width: 150mm;
              height: 100mm;
              padding: 6mm;
              border-radius: 4px;
              border: 3px solid #000;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
            }
            .silo-layout .header {
              border-bottom: 2px solid #000;
              padding-bottom: 2mm;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .silo-layout .brand {
              font-size: 16px;
              font-weight: 800;
              letter-spacing: 1px;
            }
            .silo-layout .sub-brand {
              font-size: 11px;
              font-weight: 600;
              color: #555;
            }
            .silo-layout .title {
              font-size: 11px;
              font-weight: 800;
              background: #000;
              color: #fff;
              padding: 1mm 3mm;
              text-align: center;
              letter-spacing: 2px;
              margin-top: 2mm;
            }
            .silo-layout .main-id {
              font-size: 32px;
              font-weight: 800;
              text-align: center;
              margin: 2mm 0;
              letter-spacing: 1px;
            }
            .silo-layout .grid-2 {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 3mm;
              margin-bottom: 2mm;
            }
            .silo-layout .info-group {
              border: 1px solid #000;
              padding: 1.5mm 2.5mm;
            }
            .silo-layout .label {
              font-size: 8px;
              font-weight: 700;
              color: #666;
              display: block;
              margin-bottom: 0.5mm;
            }
            .silo-layout .val {
              font-size: 12px;
              font-weight: 700;
            }
            .silo-layout .barcode-container {
              display: flex;
              justify-content: center;
              align-items: center;
              margin-top: 1mm;
            }
            .silo-layout .barcode-container svg {
              width: 100% !important;
              max-height: 22mm;
            }
            .silo-layout .footer {
              font-size: 8px;
              text-align: center;
              font-weight: 600;
              border-top: 1px solid #ccc;
              padding-top: 1mm;
              color: #555;
            }

            /* --- ESTILO 2: BOLSA (Completa con QR) --- */
            .bag-layout {
              width: 120mm;
              height: 80mm;
              padding: 4mm;
              border: 2px solid #000;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
            }
            .bag-layout .header {
              border-bottom: 1.5px solid #000;
              padding-bottom: 1mm;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .bag-layout .brand {
              font-size: 12px;
              font-weight: 800;
            }
            .bag-layout .sub-brand {
              font-size: 9px;
              font-weight: 600;
            }
            .bag-layout .bolsa-full-banner {
              background: #000;
              color: #fff;
              padding: 1.5mm 3mm;
              margin: 1.5mm 0;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-family: monospace;
            }
            .bag-layout .bolsa-banner-title {
              font-size: 8px;
              color: #ccc;
              font-weight: 700;
            }
            .bag-layout .bolsa-banner-main {
              font-size: 14px;
              font-weight: 900;
              letter-spacing: 1px;
            }
            .bag-layout .bolsa-banner-tag {
              font-size: 9px;
              background: #333;
              padding: 1px 4px;
              border-radius: 2px;
            }
            .bag-layout .cols-main {
              display: grid;
              grid-template-columns: 1.5fr 1fr;
              gap: 3mm;
              margin-top: 1mm;
            }
            .bag-layout .left-col {
              display: flex;
              flex-direction: column;
              gap: 1.5mm;
            }
            .bag-layout .field-item {
              border-bottom: 1px dashed #aaa;
              padding-bottom: 1px;
            }
            .bag-layout .label {
              font-size: 8px;
              font-weight: 700;
              color: #666;
              display: block;
            }
            .bag-layout .val-lote {
              font-size: 18px;
              font-weight: 800;
            }
            .bag-layout .val {
              font-size: 11px;
              font-weight: 700;
            }
            .bag-layout .val-sm {
              font-size: 10px;
              font-weight: 700;
            }
            .bag-layout .right-col {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              border-left: 1px dashed #ccc;
              padding-left: 2mm;
            }
            .bag-layout .qr-label {
              font-size: 7px;
              font-weight: 700;
              text-align: center;
              margin-bottom: 1mm;
            }
            .bag-layout .qr-img {
              width: 25mm;
              height: 25mm;
            }
            .bag-layout .grid-2 {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 2mm;
              margin-top: 1.5mm;
            }
            .bag-layout .barcode-container-compact {
              display: flex;
              justify-content: center;
              align-items: center;
              margin-top: 2mm;
            }
            .bag-layout .barcode-container-compact svg {
              width: 100% !important;
              max-height: 15mm;
            }

            /* --- ESTILO 3: TÉRMICA (100mm x 50mm) --- */
            .thermal-layout {
              width: 100mm;
              height: 50mm;
              padding: 2.5mm;
              border: 1.5px solid #000;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              box-sizing: border-box;
            }
            .thermal-layout .thermal-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 9px;
              border-bottom: 1px solid #000;
              padding-bottom: 1mm;
            }
            .thermal-layout .thermal-header strong {
              font-size: 13px;
              font-weight: 800;
            }
            .thermal-layout .thermal-bolsa-banner {
              background: #000;
              color: #fff;
              font-family: monospace;
              font-size: 11px;
              font-weight: 900;
              text-align: center;
              padding: 1mm 2mm;
              letter-spacing: 0.5px;
              margin: 1mm 0;
            }
            .thermal-layout .thermal-body {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin: 1.5mm 0;
            }
            .thermal-layout .thermal-info {
              font-size: 9px;
              line-height: 1.3;
            }
            .thermal-layout .thermal-barcode {
              display: flex;
              justify-content: center;
              align-items: center;
            }
            .thermal-layout .thermal-barcode svg {
              width: 100% !important;
              max-height: 14mm !important;
              margin: 0 !important;
              padding: 0 !important;
            }

            /* Configuración para la impresión directa */
            @media print {
              html, body {
                background: #fff;
              }
              .label-card {
                margin: 0;
                border: 2px solid #000 !important;
                page-break-inside: avoid;
              }
              
              /* Ajustes de página automáticos según el tamaño de la plantilla elegida */
              @page {
                margin: 0;
                size: auto;
              }
            }
          </style>
        </head>
        <body>
          <div style="padding: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 95vh;">
            ${finalLabelsContent}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const [isExporting, setIsExporting] = useState(false);

  const handleDownloadPdf = async () => {
    try {
      setIsExporting(true);
      const fileName = `Rotulo_${template.toUpperCase()}_Lote_${lote.loteNro || lote.id}.pdf`;
      await exportWithHtml2Pdf('barcode-label-preview-card', fileName, {
        scale: 2.0,
        quality: 0.98,
        margin: [4, 4, 4, 4],
      });
    } catch (err) {
      console.error('Error al exportar rótulo:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-gray-100 relative">
        
        {/* Botón Cerrar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition"
          title="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Cabecera modal */}
        <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-5">
          <div className="p-2.5 bg-[#E3EFE7] text-[#00603C] rounded-lg">
            <Barcode className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-serif text-lg font-bold text-[#1A1A1A]">
              Impresión de Etiquetas de Código de Barras
            </h3>
            <p className="text-xs text-gray-500">
              Genere rótulos físicos para silos, bolsones o bolsas individuales del lote.
            </p>
          </div>
        </div>

        {/* Selección de diseño / plantilla */}
        <div className="mb-5">
          <label className="text-[10px] font-sans font-bold text-[#C9922E] uppercase tracking-wider block mb-2">
            Diseño de la Etiqueta
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            <button
              onClick={() => setTemplate('thermal')}
              className={`p-3 rounded-xl border text-left transition ${
                template === 'thermal'
                  ? 'border-[#00603C] bg-[#E3EFE7] bg-opacity-30 text-[#00603C]'
                  : 'border-gray-200 hover:bg-gray-50 text-gray-600'
              }`}
            >
              <Layout className="w-4 h-4 mb-1.5" />
              <div className="text-xs font-bold">Adhesiva Térmica</div>
              <div className="text-[9px] text-gray-400 mt-0.5">100 x 50 mm</div>
            </button>

            <button
              onClick={() => setTemplate('bag')}
              className={`p-3 rounded-xl border text-left transition ${
                template === 'bag'
                  ? 'border-[#00603C] bg-[#E3EFE7] bg-opacity-30 text-[#00603C]'
                  : 'border-gray-200 hover:bg-gray-50 text-gray-600'
              }`}
            >
              <Columns className="w-4 h-4 mb-1.5" />
              <div className="text-xs font-bold">Bolsa / Bolsón</div>
              <div className="text-[9px] text-gray-400 mt-0.5">Con Código QR</div>
            </button>

            <button
              onClick={() => setTemplate('silo')}
              className={`p-3 rounded-xl border text-left transition ${
                template === 'silo'
                  ? 'border-[#00603C] bg-[#E3EFE7] bg-opacity-30 text-[#00603C]'
                  : 'border-gray-200 hover:bg-gray-50 text-gray-600'
              }`}
            >
              <Grid className="w-4 h-4 mb-1.5" />
              <div className="text-xs font-bold">Rótulo de Silo</div>
              <div className="text-[9px] text-gray-400 mt-0.5">Grande y Visible</div>
            </button>
          </div>
        </div>

        {/* Vista previa en tiempo real */}
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col items-center justify-center mb-5 min-h-[160px]">
          <span className="text-[9px] font-sans font-bold text-gray-400 uppercase tracking-widest mb-3">
            Vista Previa de Impresión
          </span>

          <div id="barcode-label-preview-card" className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm w-full max-w-sm flex flex-col items-center">
            {/* Título de ayuda interna */}
            <div className="w-full text-left text-[9px] text-gray-400 border-b border-gray-100 pb-1.5 mb-2.5 flex justify-between items-center">
              <span>AGRO ABACUS S.A.</span>
              <span className="font-mono font-bold text-[#00603C]">LOTE {lote.id}</span>
            </div>

            {/* Código de barras interactivo generado por JsBarcode */}
            <div className="flex justify-center w-full my-1 overflow-hidden">
              <svg ref={barcodeSvgRef} className="max-w-full h-auto" />
            </div>

            {/* Generador auxiliar para el código QR si la plantilla lo requiere */}
            {(template === 'bag' || template === 'thermal') && (
              <div className="mt-2.5 pt-2.5 border-t border-gray-100 w-full flex items-center justify-between gap-4">
                <div className="text-left">
                  <div className="text-[10px] font-bold text-gray-700">{lote.especie}</div>
                  <div className="text-[9px] text-gray-500">{lote.variedad}</div>
                </div>
                <div className="shrink-0 p-1 bg-white border border-gray-200 rounded">
                  <QRCodeCanvas
                    ref={printQrCanvasRef}
                    value={qrUrl}
                    size={150}
                    style={{ width: '48px', height: '48px' }}
                    bgColor="#ffffff"
                    fgColor="#000000"
                    level="M"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Parámetros de impresión (Copias) */}
        <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-100 mb-6">
          <div className="text-left">
            <span className="text-xs font-bold text-gray-800">Cantidad de etiquetas</span>
            <p className="text-[10px] text-gray-400">Imprimir varias copias en lote</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCopies(Math.max(1, copies - 1))}
              className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition font-bold"
            >
              -
            </button>
            <span className="w-8 text-center font-mono font-bold text-sm text-gray-800">{copies}</span>
            <button
              onClick={() => setCopies(copies + 1)}
              className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition font-bold"
            >
              +
            </button>
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 text-xs font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isExporting}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#00603C] text-white rounded-xl hover:bg-[#254731] transition text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
            title="Descargar Rótulo en Formato PDF"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#C9922E]" />
            ) : (
              <Download className="w-4 h-4 text-[#C9922E]" />
            )}
            <span>{isExporting ? 'Generando PDF...' : 'Descargar PDF Rótulo'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
