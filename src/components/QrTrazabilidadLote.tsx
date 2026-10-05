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
 * Soporta de manera opcional el número de bolsa (correlativo 01 en adelante)
 * y el total de bolsas que integran el lote.
 */
export const getPublicLoteTraceUrl = (
  loteId: string,
  bolsaNumber?: number | string,
  totalBags?: number | string
): string => {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://agroabacus.com';
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';

  const params = new URLSearchParams();
  params.set('lote', loteId);

  if (bolsaNumber !== undefined && bolsaNumber !== null && bolsaNumber !== '') {
    const safeBolsa = typeof bolsaNumber === 'number'
      ? String(bolsaNumber).padStart(2, '0')
      : String(bolsaNumber).trim().padStart(2, '0');
    params.set('bolsa', safeBolsa);

    if (totalBags !== undefined && totalBags !== null && totalBags !== '') {
      const safeTotal = typeof totalBags === 'number'
        ? String(totalBags).padStart(2, '0')
        : String(totalBags).trim().padStart(2, '0');
      params.set('total', safeTotal);
    }
  }

  return `${origin}${pathname}?${params.toString()}`;
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
