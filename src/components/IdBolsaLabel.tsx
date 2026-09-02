/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Lote } from '../types';
import { QRCodeSVG } from 'qrcode.react';
import { getPublicLoteTraceUrl } from './QrTrazabilidadLote';

interface IdBolsaLabelProps {
  lote: Lote;
  bagNumber?: number;
  totalBags?: number;
  className?: string;
}

/**
 * Componente de Etiqueta ID Bolsas / Rótulo de Lotes de Alta Densidad para Planta Clasificadora.
 * Estructura de tabla estricta conforme a especificación con NÚMERO DE BOLSA EN FUENTE GRANDE Y A LO LARGO:
 * +-----------------------------------------------------------------------------------+-------------------+
 * |                        PLANTA CLASIFICADORA LA BARRANCOSA - AGRO ABACUS SA       |                   |
 * +-----------------------------------------------------------------------------------+  QR TRAZABILIDAD  |
 * | ★ BOLSA N° 01 DE 35 ★  (FUENTE GRANDE A LO LARGO)                                 |   (Batch Trace    |
 * +--------------------------------------------------+--------------------------------+     QR Code)      |
 * | CLIENTE: [batch.cliente]                         | CATEGORIA: [batch.categoria]   |                   |
 * +--------------------------------------------------+--------------------------------+                   |
 * | N° LOTE: [batch.numero_lote]                     | ESPECIE: [batch.especie]       |                   |
 * +--------------------------------------------------+--------------------------------+                   |
 * | VARIEDAD: [batch.variedad]                       | ENVASE: [batch.kg_por_bolsa]   |   [Label text]    |
 * +-----------------------------------------------------------------------------------+-------------------+
 */
export const IdBolsaLabel: React.FC<IdBolsaLabelProps> = ({
  lote,
  bagNumber,
  totalBags,
  className = '',
}) => {
  const qrUrl = getPublicLoteTraceUrl(lote.id || lote.loteNro || 'LOTE');

  // Formato de N° Lote limpio
  const loteNroStr = lote.loteNro
    ? lote.loteNro.toUpperCase().startsWith('LOTE')
      ? lote.loteNro.toUpperCase()
      : `LOTE ${lote.loteNro}`
    : lote.id || 'S/D';

  // Cliente
  const clienteStr = (lote.cliente || 'AGRO ABACUS S.A.').toUpperCase();

  // Categoría
  const categoriaStr = (lote.categoria || 'ORIGINAL').toUpperCase();

  // Especie
  const especieStr = (lote.especie || 'SOJA').toUpperCase();

  // Variedad
  const variedadStr = (lote.variedad || 'ESTÁNDAR').toUpperCase();

  // Envase (kg por bolsa)
  const envaseStr = lote.kgPorBolsa
    ? `${lote.kgPorBolsa} KG`
    : lote.pesoPorBolsa
    ? `${lote.pesoPorBolsa} KG`
    : '800 KG';

  // Total de bolsas seguro
  const totalBolsasSeguro = totalBags || Number(lote.stockBolsas) || Number((lote as any).cantidadBolsas) || 0;

  // Texto formateado del número de bolsa
  const bolsaNumStr = bagNumber !== undefined
    ? String(bagNumber).padStart(2, '0')
    : '___';

  const bolsaTotalStr = totalBolsasSeguro > 0
    ? String(totalBolsasSeguro).padStart(2, '0')
    : '—';

  return (
    <div
      className={`id-bolsa-label-card border-2 border-black bg-white text-black font-sans box-border overflow-hidden select-none ${className}`}
      style={{
        width: '100%',
        height: '38.2mm',
        maxHeight: '38.2mm',
        minHeight: '38.2mm',
        boxSizing: 'border-box',
        backgroundColor: '#FFFFFF',
        color: '#000000',
        pageBreakInside: 'avoid',
        breakInside: 'avoid',
      }}
    >
      <table
        className="w-full h-full border-collapse text-left m-0 p-0"
        style={{
          tableLayout: 'fixed',
          borderCollapse: 'collapse',
          width: '100%',
          height: '100%',
        }}
      >
        <colgroup>
          <col style={{ width: '42%' }} />
          <col style={{ width: '38%' }} />
          <col style={{ width: '20%' }} />
        </colgroup>
        <tbody>
          {/* Fila 0: Encabezado Institucional */}
          <tr style={{ height: '4.2mm' }}>
            <td
              colSpan={2}
              className="border-b border-r-2 border-black bg-slate-100 text-center align-middle px-2 py-0"
              style={{
                borderBottom: '1.5px solid #000000',
                borderRight: '2px solid #000000',
                backgroundColor: '#F1F5F9',
                height: '4.2mm',
              }}
            >
              <div className="font-black text-[7pt] uppercase tracking-wider text-black truncate leading-tight font-sans">
                PLANTA CLASIFICADORA LA BARRANCOSA — AGRO ABACUS S.A.
              </div>
            </td>
            {/* Columna Derecha: Bloque QR Vertical que abarca todas las 5 filas */}
            <td
              rowSpan={5}
              className="text-center align-middle p-0.5 bg-white border-l-0"
              style={{
                borderLeft: '2px solid #000000',
                height: '38.2mm',
                verticalAlign: 'middle',
                padding: '2px 2px',
              }}
            >
              <div className="flex flex-col items-center justify-center h-full w-full gap-0.5">
                <div
                  className="flex items-center justify-center bg-white p-0.5"
                  style={{ width: '22mm', height: '22mm', maxHeight: '22mm', maxWidth: '22mm' }}
                >
                  <QRCodeSVG
                    value={qrUrl}
                    size={80}
                    bgColor="#FFFFFF"
                    fgColor="#000000"
                    level="M"
                    includeMargin={false}
                    className="w-full h-full aspect-square block"
                  />
                </div>
                <div
                  className="font-black text-[5.5pt] uppercase tracking-wider text-black text-center whitespace-nowrap leading-none mt-0.5"
                  style={{ letterSpacing: '0.04em' }}
                >
                  QR TRAZABILIDAD
                </div>
                <div className="text-[6pt] font-mono font-black text-black leading-none mt-0.5 bg-gray-100 px-1 py-0.5 rounded border border-gray-300">
                  Bolsa {bagNumber || '—'}{totalBolsasSeguro ? `/${totalBolsasSeguro}` : ''}
                </div>
              </div>
            </td>
          </tr>

          {/* Fila 1: NÚMERO DE BOLSA A LO LARGO (FUENTE GRANDE, ARMONIZADA) */}
          <tr style={{ height: '7.8mm' }}>
            <td
              colSpan={2}
              className="border-b-2 border-r-2 border-black bg-black text-white px-2 py-0 text-center align-middle overflow-hidden"
              style={{
                borderBottom: '2px solid #000000',
                borderRight: '2px solid #000000',
                backgroundColor: '#000000',
                color: '#FFFFFF',
                height: '7.8mm',
              }}
            >
              <div className="flex items-center justify-between w-full h-full px-1">
                <span className="font-sans font-black text-[6.5pt] text-gray-300 uppercase tracking-widest leading-none">
                  IDENTIFICACIÓN:
                </span>
                <div className="flex items-baseline justify-center gap-1.5 font-mono">
                  <span className="font-black text-[13.5pt] tracking-widest text-white leading-none">
                    BOLSA N° {bolsaNumStr}
                  </span>
                  <span className="font-bold text-[9.5pt] text-amber-300 leading-none">
                    DE {bolsaTotalStr}
                  </span>
                </div>
                <span className="font-mono font-black text-[8.5pt] text-gray-100 uppercase tracking-tight bg-slate-800 px-1.5 py-0.5 rounded border border-slate-600 leading-none">
                  {envaseStr}
                </span>
              </div>
            </td>
          </tr>

          {/* Fila 2: CLIENTE y CATEGORIA */}
          <tr style={{ height: '8.4mm' }}>
            {/* CLIENTE */}
            <td
              className="border-b-2 border-r-2 border-black px-2 py-0.5 align-middle overflow-hidden"
              style={{
                borderBottom: '2px solid #000000',
                borderRight: '2px solid #000000',
                height: '8.4mm',
              }}
            >
              <div className="flex flex-col justify-center h-full leading-tight">
                <span className="text-[6pt] font-bold text-gray-600 uppercase tracking-wider leading-none">
                  CLIENTE:
                </span>
                <span className="text-[10pt] font-black text-black uppercase tracking-tight truncate leading-tight mt-0.5">
                  {clienteStr}
                </span>
              </div>
            </td>
            {/* CATEGORIA */}
            <td
              className="border-b-2 border-black px-2 py-0.5 align-middle overflow-hidden"
              style={{
                borderBottom: '2px solid #000000',
                height: '8.4mm',
              }}
            >
              <div className="flex flex-col justify-center h-full leading-tight">
                <span className="text-[6pt] font-bold text-gray-600 uppercase tracking-wider leading-none">
                  CATEGORIA:
                </span>
                <span className="text-[9.5pt] font-black text-black uppercase tracking-tight truncate leading-tight mt-0.5">
                  {categoriaStr}
                </span>
              </div>
            </td>
          </tr>

          {/* Fila 3: N° LOTE y ESPECIE */}
          <tr style={{ height: '8.8mm' }}>
            {/* N° LOTE */}
            <td
              className="border-b-2 border-r-2 border-black px-2 py-0.5 align-middle overflow-hidden"
              style={{
                borderBottom: '2px solid #000000',
                borderRight: '2px solid #000000',
                height: '8.8mm',
              }}
            >
              <div className="flex flex-col justify-center h-full leading-tight">
                <span className="text-[6pt] font-bold text-gray-600 uppercase tracking-wider leading-none">
                  N° LOTE:
                </span>
                <span className="text-[11.5pt] font-mono font-black text-black uppercase tracking-tight truncate leading-tight mt-0.5">
                  {loteNroStr}
                </span>
              </div>
            </td>
            {/* ESPECIE */}
            <td
              className="border-b-2 border-black px-2 py-0.5 align-middle overflow-hidden"
              style={{
                borderBottom: '2px solid #000000',
                height: '8.8mm',
              }}
            >
              <div className="flex flex-col justify-center h-full leading-tight">
                <span className="text-[6pt] font-bold text-gray-600 uppercase tracking-wider leading-none">
                  ESPECIE:
                </span>
                <span className="text-[10pt] font-black text-black uppercase tracking-tight truncate leading-tight mt-0.5">
                  {especieStr}
                </span>
              </div>
            </td>
          </tr>

          {/* Fila 4: VARIEDAD y PRESENTACIÓN */}
          <tr style={{ height: '8.8mm' }}>
            {/* VARIEDAD */}
            <td
              className="border-r-2 border-black px-2 py-0.5 align-middle overflow-hidden"
              style={{
                borderRight: '2px solid #000000',
                height: '8.8mm',
              }}
            >
              <div className="flex flex-col justify-center h-full leading-tight">
                <span className="text-[6pt] font-bold text-gray-600 uppercase tracking-wider leading-none">
                  VARIEDAD:
                </span>
                <span className="text-[10.5pt] font-black text-black uppercase tracking-tight truncate leading-tight mt-0.5">
                  {variedadStr}
                </span>
              </div>
            </td>
            {/* PRESENTACIÓN */}
            <td className="px-2 py-0.5 align-middle overflow-hidden" style={{ height: '8.8mm' }}>
              <div className="flex flex-col justify-center h-full leading-tight">
                <span className="text-[6pt] font-bold text-gray-600 uppercase tracking-wider leading-none">
                  PRESENTACIÓN:
                </span>
                <span className="text-[9.5pt] font-black text-black uppercase tracking-tight truncate leading-tight mt-0.5">
                  {envaseStr}
                </span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};
