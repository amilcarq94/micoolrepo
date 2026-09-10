/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { toPng, toJpeg } from 'html-to-image';
import html2canvas from 'html2canvas';

export interface ExportImageOptions {
  quality?: number;
  pixelRatio?: number;
  backgroundColor?: string;
}

/**
 * Exporta un elemento HTML como imagen .PNG en alta resolución (2x DPI).
 * Soporta espacios de color modernos (oklab, oklch) y estilos de Tailwind CSS 4.
 */
export const exportCardAsPng = async (
  elementIdOrElement: string | HTMLElement,
  fileName: string = 'Ficha_de_Lote'
): Promise<boolean> => {
  try {
    const targetElement =
      typeof elementIdOrElement === 'string'
        ? document.getElementById(elementIdOrElement)
        : elementIdOrElement;

    if (!targetElement) {
      console.error(`Elemento no encontrado para exportar a PNG: ${elementIdOrElement}`);
      return false;
    }

    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    const dataUrl = await toPng(targetElement, {
      quality: 0.98,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      cacheBust: true,
      fontEmbedCSS: '',
      filter: (node) => {
        if (
          node instanceof HTMLElement &&
          (node.classList.contains('no-export') || node.getAttribute('data-no-export') === 'true')
        ) {
          return false;
        }
        return true;
      },
    });

    const downloadLink = document.createElement('a');
    const safeName = fileName.replace(/[^a-zA-Z0-9_\-]/g, '_');
    downloadLink.download = safeName.endsWith('.png') ? safeName : `${safeName}.png`;
    downloadLink.href = dataUrl;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    return true;
  } catch (error) {
    console.error('Error al exportar ficha a PNG:', error);
    return false;
  }
};

/**
 * Exporta un elemento HTML como imagen .JPG en alta resolución (2x DPI).
 * Incluye fallback automático con html2canvas para máxima compatibilidad.
 */
export const exportElementAsJpg = async (
  elementIdOrElement: string | HTMLElement,
  fileName: string = 'dashboard',
  options?: ExportImageOptions
): Promise<boolean> => {
  try {
    const targetElement =
      typeof elementIdOrElement === 'string'
        ? document.getElementById(elementIdOrElement)
        : elementIdOrElement;

    if (!targetElement) {
      console.error(`Elemento no encontrado para exportar a JPG: ${elementIdOrElement}`);
      return false;
    }

    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    const pixelRatio = options?.pixelRatio ?? 2;
    const quality = options?.quality ?? 0.95;
    const backgroundColor = options?.backgroundColor ?? '#0b1320';

    let dataUrl: string = '';

    try {
      dataUrl = await toJpeg(targetElement, {
        quality,
        pixelRatio,
        backgroundColor,
        cacheBust: true,
        fontEmbedCSS: '',
        filter: (node) => {
          if (
            node instanceof HTMLElement &&
            (node.classList.contains('no-export') || node.getAttribute('data-no-export') === 'true')
          ) {
            return false;
          }
          return true;
        },
      });
    } catch (toJpegError) {
      console.warn('toJpeg falló, intentando html2canvas fallback:', toJpegError);
      const canvas = await html2canvas(targetElement, {
        scale: pixelRatio,
        backgroundColor,
        useCORS: true,
        logging: false,
        ignoreElements: (el) =>
          el.classList.contains('no-export') || el.getAttribute('data-no-export') === 'true',
      });
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }

    const downloadLink = document.createElement('a');
    const safeName = fileName.replace(/[^a-zA-Z0-9_\-]/g, '_');
    downloadLink.download =
      safeName.endsWith('.jpg') || safeName.endsWith('.jpeg') ? safeName : `${safeName}.jpg`;
    downloadLink.href = dataUrl;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    return true;
  } catch (error) {
    console.error('Error al exportar elemento a JPG:', error);
    return false;
  }
};

/** Alias para exportar en JPG */
export const exportCardAsJpg = exportElementAsJpg;

