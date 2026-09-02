/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { toPng } from 'html-to-image';

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

/** Alias retrocompatible para exportar en PNG */
export const exportCardAsJpg = exportCardAsPng;
