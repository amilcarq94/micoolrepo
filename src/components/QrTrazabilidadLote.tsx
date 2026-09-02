/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface QrTrazabilidadLoteProps {
  loteId: string;
  className?: string;
  size?: number; // Default 300px
  showLabel?: boolean;
}

/**
 * Retorna la URL oficial de trazabilidad pública para un lote.
 * Es la misma URL y formato que utiliza "Generar QR Ficha Técnica Pública".
 */
export const getPublicLoteTraceUrl = (loteId: string): string => {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${window.location.pathname}?lote=${encodeURIComponent(loteId)}`;
  }
  return `https://agroabacus.com/?lote=${encodeURIComponent(loteId)}`;
};

/**
 * Componente oficial para renderizar el código QR de trazabilidad de lote
 * con las especificaciones exactas:
 * - Color de módulos: #006837 (verde corporativo)
 * - Fondo: #FFFFFF (blanco puro)
 * - Tamaño: 300 x 300 px
 * - Error correction level: High (30% - 'H')
 * - Etiqueta inferior: "QR TRAZABILIDAD"
 * - Codificación: URL pública de trazabilidad basada en el ID del lote
 */
export const QrTrazabilidadLote: React.FC<QrTrazabilidadLoteProps> = ({
  loteId,
  className = '',
  size = 300,
  showLabel = true,
}) => {
  const qrUrl = getPublicLoteTraceUrl(loteId);

  return (
    <div
      className={`bg-white p-3 rounded-2xl border border-[#E2E8F0] shadow-xs flex flex-col items-center justify-center ${className}`}
      style={{ boxSizing: 'border-box' }}
    >
      {/* Código QR Vectorial Nítido con Margen / Quiet Zone */}
      <div
        className="flex items-center justify-center overflow-hidden"
        style={{ width: `${size}px`, height: `${size}px`, maxWidth: '100%' }}
      >
        <QRCodeSVG
          value={qrUrl}
          size={size}
          bgColor="#FFFFFF"
          fgColor="#006837"
          level="H"
          includeMargin={true}
          className="w-full h-full aspect-square block"
        />
      </div>

      {/* Etiqueta inferior en mayúsculas: QR TRAZABILIDAD */}
      {showLabel && (
        <span
          className="font-sans font-bold text-[#475569] uppercase tracking-wider mt-1.5 text-center block whitespace-nowrap"
          style={{ fontSize: '10px', lineHeight: 1.2, letterSpacing: '0.08em' }}
        >
          QR TRAZABILIDAD
        </span>
      )}
    </div>
  );
};
