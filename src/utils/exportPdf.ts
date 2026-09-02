/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { toJpeg } from 'html-to-image';
import jsPDF from 'jspdf';

export interface ExportPdfOptions {
  quality?: number;
  scale?: number;
  margin?: number | [number, number] | [number, number, number, number];
  orientation?: 'portrait' | 'landscape';
}

/**
 * Convierte un elemento DOM en una imagen dataURL (JPEG) de alta resolución (DPI optimizado),
 * utilizando el motor nativo del navegador vía html-to-image para garantizar soporte completo
 * de Tailwind CSS, espacios de color modernos (oklch, oklab, color-mix) y fuentes personalizadas.
 */
async function renderElementToImageDataUrl(
  element: HTMLElement,
  options?: ExportPdfOptions
): Promise<string> {
  const scale = options?.scale ?? 2.0;
  const quality = options?.quality ?? 0.98;

  return await toJpeg(element, {
    quality,
    pixelRatio: scale,
    backgroundColor: '#FFFFFF',
    cacheBust: true,
    fontEmbedCSS: '',
  });
}

/**
 * Exporta el contenedor (.ficha-a4 o nodo HTML) aplicando la configuración A4 de alta fidelidad.
 */
export async function exportWithHtml2Pdf(
  elementOrSelector: string | HTMLElement,
  fileName: string = 'Ficha_Lote.pdf',
  options?: ExportPdfOptions
): Promise<boolean> {
  return await exportElementAsPdf(elementOrSelector, fileName, options);
}

/**
 * Exporta un elemento HTML o nodo de ficha a un archivo PDF A4 estricto (210 x 297 mm)
 * con resolución optimizada para impresión profesional (usando jsPDF + html-to-image).
 * Mantiene la relación de aspecto original del elemento centrado en la página o en hoja completa.
 */
export async function exportElementAsPdf(
  elementOrId: string | HTMLElement,
  fileName: string = 'Ficha.pdf',
  options?: ExportPdfOptions
): Promise<boolean> {
  try {
    const el = typeof elementOrId === 'string'
      ? ((document.querySelector(elementOrId) as HTMLElement) || document.getElementById(elementOrId))
      : elementOrId;
    if (!el) {
      console.error(`Element not found for PDF export:`, elementOrId);
      return false;
    }

    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    const imgData = await renderElementToImageDataUrl(el, options);

    const pdf = new jsPDF({
      orientation: options?.orientation ?? 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pdfWidth = 210;
    const pdfHeight = 297;

    const elemRect = el.getBoundingClientRect();
    const elemWidth = elemRect.width || el.offsetWidth || 1;
    const elemHeight = elemRect.height || el.offsetHeight || 1;
    const elemAspect = elemWidth / elemHeight;
    const pageAspect = pdfWidth / pdfHeight;

    let renderWidth = pdfWidth;
    let renderHeight = pdfHeight;
    let offsetX = 0;
    let offsetY = 0;

    // Si la relación de aspecto es muy cercana a A4 (~0.707), llenar la página completa
    if (Math.abs(elemAspect - pageAspect) < 0.06) {
      renderWidth = pdfWidth;
      renderHeight = pdfHeight;
    } else if (elemAspect > pageAspect) {
      // Elemento más ancho: ajustar ancho de página y centrar verticalmente
      renderWidth = pdfWidth;
      renderHeight = pdfWidth / elemAspect;
      offsetY = Math.max(0, (pdfHeight - renderHeight) / 2);
    } else {
      // Elemento más alto o angosto: ajustar alto de página y centrar horizontalmente
      renderHeight = pdfHeight;
      renderWidth = pdfHeight * elemAspect;
      offsetX = Math.max(0, (pdfWidth - renderWidth) / 2);
    }

    pdf.addImage(imgData, 'JPEG', offsetX, offsetY, renderWidth, renderHeight, undefined, 'FAST');

    const cleanFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
    pdf.save(cleanFileName);
    return true;
  } catch (error) {
    console.error('Error generating PDF:', error);
    return false;
  }
}

/**
 * Exporta múltiples elementos HTML o IDs como un único documento PDF A4 multipágina
 * donde cada elemento ocupa exactamente 1 página A4 sin saltos indebidos ni recortes.
 */
export async function exportMultipleElementsAsPdf(
  elementsOrIds: (string | HTMLElement)[],
  fileName: string = 'Fichas_Lotes_A4.pdf',
  options?: ExportPdfOptions,
  onProgress?: (current: number, total: number) => void
): Promise<boolean> {
  try {
    if (!elementsOrIds || elementsOrIds.length === 0) return false;

    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    const pdf = new jsPDF({
      orientation: options?.orientation ?? 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pdfWidth = 210;
    const pdfHeight = 297;

    let processedCount = 0;
    for (let i = 0; i < elementsOrIds.length; i++) {
      const item = elementsOrIds[i];
      const el = typeof item === 'string'
        ? ((document.querySelector(item) as HTMLElement) || document.getElementById(item))
        : item;

      if (!el) continue;

      if (onProgress) {
        onProgress(i + 1, elementsOrIds.length);
      }

      const imgData = await renderElementToImageDataUrl(el, options);

      if (processedCount > 0) {
        pdf.addPage('a4', options?.orientation ?? 'portrait');
      }

      const elemRect = el.getBoundingClientRect();
      const elemWidth = elemRect.width || el.offsetWidth || 1;
      const elemHeight = elemRect.height || el.offsetHeight || 1;
      const elemAspect = elemWidth / elemHeight;
      const pageAspect = pdfWidth / pdfHeight;

      let renderWidth = pdfWidth;
      let renderHeight = pdfHeight;
      let offsetX = 0;
      let offsetY = 0;

      if (Math.abs(elemAspect - pageAspect) < 0.06) {
        renderWidth = pdfWidth;
        renderHeight = pdfHeight;
      } else if (elemAspect > pageAspect) {
        renderWidth = pdfWidth;
        renderHeight = pdfWidth / elemAspect;
        offsetY = Math.max(0, (pdfHeight - renderHeight) / 2);
      } else {
        renderHeight = pdfHeight;
        renderWidth = pdfHeight * elemAspect;
        offsetX = Math.max(0, (pdfWidth - renderWidth) / 2);
      }

      pdf.addImage(imgData, 'JPEG', offsetX, offsetY, renderWidth, renderHeight, undefined, 'FAST');
      processedCount++;
    }

    if (processedCount === 0) {
      return false;
    }

    const cleanFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
    pdf.save(cleanFileName);
    return true;
  } catch (error) {
    console.error('Error generating multi-page PDF:', error);
    return false;
  }
}

/**
 * Exporta múltiples fichas como archivos PDF individuales secuenciales
 */
export async function exportMultipleElementsAsSeparatePdfs(
  items: Array<{ elementOrId: string | HTMLElement; fileName: string }>,
  options?: ExportPdfOptions,
  onProgress?: (current: number, total: number) => void
): Promise<boolean> {
  try {
    if (!items || items.length === 0) return false;

    for (let i = 0; i < items.length; i++) {
      if (onProgress) {
        onProgress(i + 1, items.length);
      }
      await exportElementAsPdf(items[i].elementOrId, items[i].fileName, options);
      // Breve pausa para que el navegador descargue sin bloquearse
      await new Promise((r) => setTimeout(r, 250));
    }
    return true;
  } catch (error) {
    console.error('Error exporting individual PDFs:', error);
    return false;
  }
}
