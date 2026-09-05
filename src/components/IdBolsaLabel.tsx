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
  identificacionColor?: 'black' | 'red';
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
  identificacionColor = 'black',
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
      className={`id-bolsa-label-card border-2 border-black bg-white text-black font-sans box-border select-none ${className}`}
      style={{
        width: '100%',
        height: '37.5mm',
        maxHeight: '37.5mm',
        minHeight: '37.5mm',
        boxSizing: 'border-box',
        backgroundColor: '#FFFFFF',
        color: '#000000',
        border: '2px solid #000000',
        pageBreakInside: 'avoid',
        breakInside: 'avoid',
        display: 'flex',
        flexDirection: 'row',
        overflow: 'hidden',
      }}
    >
      {/* Columna Izquierda: Información de Lote y Bolsa */}
      <div
        style={{
          flex: '1 1 0%',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* Fila 0: Encabezado Institucional (Fuente blanca, opción fondo Negro / Rojo #b82222) */}
        <div
          style={{
            height: '4.2mm',
            minHeight: '4.2mm',
            maxHeight: '4.2mm',
            backgroundColor: identificacionColor === 'red' ? '#b82222' : '#000000',
            borderBottom: '1.5px solid #000000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 6px',
            boxSizing: 'border-box',
          }}
        >
          <div
            className="font-black text-[7pt] uppercase tracking-wider text-white truncate leading-none font-sans text-center"
            style={{ color: '#FFFFFF' }}
          >
            PLANTA CLASIFICADORA LA BARRANCOSA — AGRO ABACUS S.A.
          </div>
        </div>

        {/* Fila 1: NÚMERO DE BOLSA A LO LARGO (Fondo Negro o Rojo #b82222, fuente blanca) */}
        <div
          style={{
            height: '7.5mm',
            minHeight: '7.5mm',
            maxHeight: '7.5mm',
            backgroundColor: identificacionColor === 'red' ? '#b82222' : '#000000',
            color: '#FFFFFF',
            borderBottom: '2px solid #000000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 8px',
            boxSizing: 'border-box',
          }}
        >
          <span
            className="font-sans font-black text-[6.5pt] uppercase tracking-widest leading-none text-white"
            style={{ color: '#FFFFFF' }}
          >
            IDENTIFICACIÓN:
          </span>
          <div className="flex items-baseline justify-center gap-1.5 font-mono">
            <span
              className="font-black text-[13.5pt] tracking-widest leading-none text-white"
              style={{ color: '#FFFFFF' }}
            >
              BOLSA N° {bolsaNumStr}
            </span>
            <span
              className="font-bold text-[9.5pt] leading-none text-white"
              style={{ color: '#FFFFFF' }}
            >
              DE {bolsaTotalStr}
            </span>
          </div>
          <span
            className="font-mono font-black text-[8.5pt] uppercase tracking-tight px-1.5 py-0.5 rounded border leading-none text-white"
            style={{
              backgroundColor: identificacionColor === 'red' ? '#7f1d1d' : '#1e293b',
              borderColor: identificacionColor === 'red' ? '#dc2626' : '#475569',
              color: '#FFFFFF'
            }}
          >
            {envaseStr}
          </span>
        </div>

        {/* Fila 2: CLIENTE y CATEGORIA */}
        <div
          style={{
            flex: '1 1 0%',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'row',
            borderBottom: '2px solid #000000',
            boxSizing: 'border-box',
          }}
        >
          {/* CLIENTE */}
          <div
            style={{
              flex: '1.2 1 0%',
              minWidth: 0,
              borderRight: '2px solid #000000',
              padding: '1px 6px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              boxSizing: 'border-box',
            }}
          >
            <span className="text-[6pt] font-bold text-gray-600 uppercase tracking-wider leading-none">
              CLIENTE:
            </span>
            <span className="text-[10pt] font-black text-black uppercase tracking-tight truncate leading-tight mt-0.5">
              {clienteStr}
            </span>
          </div>
          {/* CATEGORIA */}
          <div
            style={{
              flex: '0.8 1 0%',
              minWidth: 0,
              padding: '1px 6px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              boxSizing: 'border-box',
            }}
          >
            <span className="text-[6pt] font-bold text-gray-600 uppercase tracking-wider leading-none">
              CATEGORIA:
            </span>
            <span className="text-[9.5pt] font-black text-black uppercase tracking-tight truncate leading-tight mt-0.5">
              {categoriaStr}
            </span>
          </div>
        </div>

        {/* Fila 3: N° LOTE y ESPECIE */}
        <div
          style={{
            flex: '1 1 0%',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'row',
            borderBottom: '2px solid #000000',
            boxSizing: 'border-box',
          }}
        >
          {/* N° LOTE */}
          <div
            style={{
              flex: '1.2 1 0%',
              minWidth: 0,
              borderRight: '2px solid #000000',
              padding: '1px 6px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              boxSizing: 'border-box',
            }}
          >
            <span className="text-[6pt] font-bold text-gray-600 uppercase tracking-wider leading-none">
              N° LOTE:
            </span>
            <span className="text-[11pt] font-mono font-black text-black uppercase tracking-tight truncate leading-tight mt-0.5">
              {loteNroStr}
            </span>
          </div>
          {/* ESPECIE */}
          <div
            style={{
              flex: '0.8 1 0%',
              minWidth: 0,
              padding: '1px 6px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              boxSizing: 'border-box',
            }}
          >
            <span className="text-[6pt] font-bold text-gray-600 uppercase tracking-wider leading-none">
              ESPECIE:
            </span>
            <span className="text-[10pt] font-black text-black uppercase tracking-tight truncate leading-tight mt-0.5">
              {especieStr}
            </span>
          </div>
        </div>

        {/* Fila 4: VARIEDAD y PRESENTACIÓN */}
        <div
          style={{
            flex: '1 1 0%',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'row',
            boxSizing: 'border-box',
          }}
        >
          {/* VARIEDAD */}
          <div
            style={{
              flex: '1.2 1 0%',
              minWidth: 0,
              borderRight: '2px solid #000000',
              padding: '1px 6px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              boxSizing: 'border-box',
            }}
          >
            <span className="text-[6pt] font-bold text-gray-600 uppercase tracking-wider leading-none">
              VARIEDAD:
            </span>
            <span className="text-[10pt] font-black text-black uppercase tracking-tight truncate leading-tight mt-0.5">
              {variedadStr}
            </span>
          </div>
          {/* PRESENTACIÓN */}
          <div
            style={{
              flex: '0.8 1 0%',
              minWidth: 0,
              padding: '1px 6px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              boxSizing: 'border-box',
            }}
          >
            <span className="text-[6pt] font-bold text-gray-600 uppercase tracking-wider leading-none">
              PRESENTACIÓN:
            </span>
            <span className="text-[9.5pt] font-black text-black uppercase tracking-tight truncate leading-tight mt-0.5">
              {envaseStr}
            </span>
          </div>
        </div>
      </div>

      {/* Columna Derecha: Bloque QR Vertical de Trazabilidad */}
      <div
        style={{
          width: '38mm',
          minWidth: '38mm',
          maxWidth: '38mm',
          borderLeft: '2px solid #000000',
          backgroundColor: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2px 4px',
          boxSizing: 'border-box',
          height: '100%',
        }}
      >
        <div
          className="flex items-center justify-center bg-white p-0.5"
          style={{ width: '21mm', height: '21mm', maxHeight: '21mm', maxWidth: '21mm' }}
        >
          <QRCodeSVG
            value={qrUrl}
            size={76}
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
    </div>
  );
};
