/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ColorFondoCaratula } from './CaratulaCard';

export interface BolsaCaratulaData {
  id: string;
  bolsaNro: number;
  totalBolsas: number;
  loteNro: string;
  cliente: string;
  subtitulo: string;
  tipo: string;
  categoria: string;
  presentacion: string;
  especie: string;
  color: ColorFondoCaratula;
}

interface IdBolsaCaratulaCardProps {
  bolsa: BolsaCaratulaData;
  className?: string;
  onEdit?: () => void;
  isPrintView?: boolean;
}

/**
 * Componente oficial de Etiqueta ID Bolsa sincronizada con la Carátula de Lote.
 * Reestructura oficial conforme a solicitud:
 * - Filas con fondo negro (o rojo) ocupan TODO EL ANCHO de la hoja (width: 100%).
 * - Cuadrado de QR y código QR situados POR DEBAJO de las filas con fondo negro.
 *
 * +-----------------------------------------------------------------------------------------------+
 * |                   PLANTA CLASIFICADORA LA BARRANCOSA — AGRO ABACUS S.A.                       | (100% Ancho)
 * +-----------------------------------------------------------------------------------------------+
 * | IDENTIFICACIÓN:                 BOLSA N° XX DE YY                          [PRESENTACIÓN]     | (100% Ancho)
 * +---------------------------------------------------------------+-------------------------------+
 * | CLIENTE: [Título 1]             | CATEGORIA: [Categoría]      |                               |
 * +---------------------------------+-----------------------------+        QR TRAZABILIDAD        |
 * | N° LOTE: [Lote N°]              | ESPECIE: [Especie]          |   (Por debajo de las filas    |
 * +---------------------------------+-----------------------------+     con fondo negro/rojo)     |
 * | SUBTÍTULO / TIPO: [Subtítulo]   | PRESENTACIÓN: [Presentación]|                               |
 * +---------------------------------+-----------------------------+-------------------------------+
 */
export const IdBolsaCaratulaCard: React.FC<IdBolsaCaratulaCardProps> = ({
  bolsa,
  className = '',
  onEdit,
  isPrintView = false,
}) => {
  const isRed = bolsa.color === 'rojo';
  const headerBg = isRed ? '#8B0000' : '#000000';
  const headerBadgeBg = isRed ? '#7f1d1d' : '#1e293b';
  const headerBadgeBorder = isRed ? '#dc2626' : '#475569';

  const bolsaNumStr = String(bolsa.bolsaNro).padStart(2, '0');
  const totalBolsasStr = String(bolsa.totalBolsas).padStart(2, '0');

  // Lote N° formateado
  const loteNroStr = bolsa.loteNro
    ? bolsa.loteNro.toUpperCase().startsWith('LOTE')
      ? bolsa.loteNro.toUpperCase()
      : `LOTE ${bolsa.loteNro.toUpperCase()}`
    : 'LOTE 0000';

  // Código QR idéntico al de la carátula sincronizado con la identificación de bolsa
  const qrUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/?lote=${encodeURIComponent(bolsa.loteNro)}&bolsa=${bolsaNumStr}&total=${totalBolsasStr}`
      : `LOTE:${bolsa.loteNro}-B${bolsaNumStr}/${totalBolsasStr}`;

  return (
    <div
      onClick={onEdit}
      className={`id-bolsa-label-card border-2 border-black bg-white text-black font-sans box-border select-none relative group ${
        onEdit ? 'cursor-pointer hover:border-[#00603C] hover:shadow-md transition-all' : ''
      } ${className}`}
      style={{
        width: '100%',
        height: isPrintView ? '38mm' : 'auto',
        minHeight: isPrintView ? '38mm' : '136px',
        maxHeight: isPrintView ? '38mm' : 'none',
        boxSizing: 'border-box',
        backgroundColor: '#FFFFFF',
        color: '#000000',
        border: '2px solid #000000',
        pageBreakInside: 'avoid',
        breakInside: 'avoid',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
      title={onEdit ? 'Clic para editar los datos de esta bolsa individual' : undefined}
    >
      {/* =========================================================================
          SECCIÓN SUPERIOR (100% ANCHO): FILAS CON FONDO NEGRO (O ROJO)
          Ocupan todo el ancho de la etiqueta / hoja
          ========================================================================= */}

      {/* Fila 0 (100% Ancho): Encabezado Institucional */}
      <div
        style={{
          width: '100%',
          height: isPrintView ? '4.8mm' : '22px',
          minHeight: isPrintView ? '4.8mm' : '22px',
          maxHeight: isPrintView ? '4.8mm' : '22px',
          backgroundColor: headerBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 8px',
          boxSizing: 'border-box',
        }}
      >
        <div
          className="font-black text-[7pt] sm:text-[7.5pt] uppercase tracking-wider text-white truncate leading-none font-sans text-center"
          style={{ color: '#FFFFFF' }}
        >
          PLANTA CLASIFICADORA LA BARRANCOSA — AGRO ABACUS S.A.
        </div>
      </div>

      {/* Fila 1 (100% Ancho): NÚMERO DE BOLSA A LO LARGO */}
      <div
        style={{
          width: '100%',
          height: isPrintView ? '8.2mm' : '32px',
          minHeight: isPrintView ? '8.2mm' : '32px',
          maxHeight: isPrintView ? '8.2mm' : '32px',
          backgroundColor: headerBg,
          color: '#FFFFFF',
          borderTop: '1px solid rgba(255,255,255,0.2)',
          borderBottom: '2px solid #000000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 10px',
          boxSizing: 'border-box',
        }}
      >
        <span
          className="font-sans font-black text-[6.5pt] sm:text-[7pt] uppercase tracking-widest leading-none text-white"
          style={{ color: '#FFFFFF' }}
        >
          IDENTIFICACIÓN:
        </span>
        <div className="flex items-baseline justify-center gap-1.5 font-mono">
          <span
            className="font-black text-[13pt] sm:text-[14pt] tracking-widest leading-none text-white"
            style={{ color: '#FFFFFF' }}
          >
            BOLSA N° {bolsaNumStr}
          </span>
          <span
            className="font-bold text-[9pt] sm:text-[9.5pt] leading-none text-white/90"
            style={{ color: '#FFFFFF' }}
          >
            DE {totalBolsasStr}
          </span>
        </div>
        <span
          className="font-mono font-black text-[8pt] sm:text-[8.5pt] uppercase tracking-tight px-2 py-0.5 rounded leading-none text-white"
          style={{
            backgroundColor: headerBadgeBg,
            border: `1px solid ${headerBadgeBorder}`,
            color: '#FFFFFF',
          }}
        >
          {bolsa.presentacion.toUpperCase()}
        </span>
      </div>

      {/* =========================================================================
          SECCIÓN INFERIOR: POR DEBAJO DE LAS FILAS CON FONDO NEGRO
          Contenedor de Datos (Izquierda) + Cuadrado de QR (Derecha)
          ========================================================================= */}
      <div
        style={{
          width: '100%',
          flex: '1 1 0%',
          display: 'flex',
          flexDirection: 'row',
          boxSizing: 'border-box',
          minHeight: 0,
        }}
      >
        {/* BLOQUE DE DATOS (Izquierda) */}
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
          {/* Fila 2: CLIENTE (TÍTULO 1) y CATEGORÍA */}
          <div
            style={{
              flex: '1 1 0%',
              minHeight: isPrintView ? 0 : '26px',
              display: 'flex',
              flexDirection: 'row',
              borderBottom: '1.5px solid #000000',
              boxSizing: 'border-box',
            }}
          >
            {/* CLIENTE */}
            <div
              style={{
                flex: '1.2 1 0%',
                minWidth: 0,
                borderRight: '1.5px solid #000000',
                padding: '2px 8px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                boxSizing: 'border-box',
              }}
            >
              <span className="text-[6pt] font-bold text-gray-500 uppercase tracking-wider leading-none">
                CLIENTE / TITULO:
              </span>
              <span className="text-[9.5pt] sm:text-[10pt] font-black text-black uppercase tracking-tight truncate leading-tight mt-0.5">
                {bolsa.cliente || 'AGRO ABACUS S.A.'}
              </span>
            </div>
            {/* CATEGORIA */}
            <div
              style={{
                flex: '0.8 1 0%',
                minWidth: 0,
                padding: '2px 8px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                boxSizing: 'border-box',
              }}
            >
              <span className="text-[6pt] font-bold text-gray-500 uppercase tracking-wider leading-none">
                CATEGORIA:
              </span>
              <span className="text-[9pt] sm:text-[9.5pt] font-black text-black uppercase tracking-tight truncate leading-tight mt-0.5">
                {bolsa.categoria || 'PRIMU'}
              </span>
            </div>
          </div>

          {/* Fila 3: N° LOTE y ESPECIE */}
          <div
            style={{
              flex: '1 1 0%',
              minHeight: isPrintView ? 0 : '26px',
              display: 'flex',
              flexDirection: 'row',
              borderBottom: '1.5px solid #000000',
              boxSizing: 'border-box',
            }}
          >
            {/* N° LOTE */}
            <div
              style={{
                flex: '1.2 1 0%',
                minWidth: 0,
                borderRight: '1.5px solid #000000',
                padding: '2px 8px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                boxSizing: 'border-box',
              }}
            >
              <span className="text-[6pt] font-bold text-gray-500 uppercase tracking-wider leading-none">
                N° LOTE:
              </span>
              <span className="text-[10.5pt] sm:text-[11pt] font-mono font-black text-black uppercase tracking-tight truncate leading-tight mt-0.5">
                {loteNroStr}
              </span>
            </div>
            {/* ESPECIE */}
            <div
              style={{
                flex: '0.8 1 0%',
                minWidth: 0,
                padding: '2px 8px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                boxSizing: 'border-box',
              }}
            >
              <span className="text-[6pt] font-bold text-gray-500 uppercase tracking-wider leading-none">
                ESPECIE:
              </span>
              <span className="text-[9.5pt] sm:text-[10pt] font-black text-black uppercase tracking-tight truncate leading-tight mt-0.5">
                {bolsa.especie || 'SOJA'}
              </span>
            </div>
          </div>

          {/* Fila 4: VARIEDAD / SUBTÍTULO y PRESENTACIÓN (TIPO) */}
          <div
            style={{
              flex: '1 1 0%',
              minHeight: isPrintView ? 0 : '26px',
              display: 'flex',
              flexDirection: 'row',
              boxSizing: 'border-box',
            }}
          >
            {/* VARIEDAD / SUBTÍTULO */}
            <div
              style={{
                flex: '1.2 1 0%',
                minWidth: 0,
                borderRight: '1.5px solid #000000',
                padding: '2px 8px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                boxSizing: 'border-box',
              }}
            >
              <span className="text-[6pt] font-bold text-gray-500 uppercase tracking-wider leading-none">
                SUBTÍTULO / TIPO:
              </span>
              <span className="text-[9.5pt] sm:text-[10pt] font-black text-black uppercase tracking-tight truncate leading-tight mt-0.5">
                {bolsa.subtitulo || bolsa.tipo || 'FINAL'}
              </span>
            </div>
            {/* PRESENTACIÓN */}
            <div
              style={{
                flex: '0.8 1 0%',
                minWidth: 0,
                padding: '2px 8px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                boxSizing: 'border-box',
              }}
            >
              <span className="text-[6pt] font-bold text-gray-500 uppercase tracking-wider leading-none">
                PRESENTACIÓN:
              </span>
              <span className="text-[9pt] sm:text-[9.5pt] font-black text-black uppercase tracking-tight truncate leading-tight mt-0.5">
                {bolsa.presentacion || '800 KG'}
              </span>
            </div>
          </div>
        </div>

        {/* =========================================================================
            CUADRADO DE QR Y QR SITUADO POR DEBAJO DE LAS FILAS CON FONDO NEGRO
            ========================================================================= */}
        <div
          style={{
            width: isPrintView ? '28mm' : '92px',
            minWidth: isPrintView ? '28mm' : '92px',
            maxWidth: isPrintView ? '28mm' : '92px',
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
            style={{
              width: isPrintView ? '17.5mm' : '56px',
              height: isPrintView ? '17.5mm' : '56px',
              maxHeight: isPrintView ? '17.5mm' : '56px',
              maxWidth: isPrintView ? '17.5mm' : '56px',
            }}
          >
            <QRCodeSVG
              value={qrUrl}
              size={64}
              bgColor="#FFFFFF"
              fgColor="#000000"
              level="M"
              includeMargin={false}
              className="w-full h-full aspect-square block"
            />
          </div>
          <div
            className="font-black text-[5pt] sm:text-[5.5pt] uppercase tracking-wider text-black text-center whitespace-nowrap leading-none mt-0.5"
            style={{ letterSpacing: '0.04em' }}
          >
            QR TRAZABILIDAD
          </div>
          <div
            className="font-mono text-[4.5pt] sm:text-[5pt] font-bold text-gray-600 text-center leading-none mt-0.5 truncate max-w-full"
          >
            {bolsa.loteNro}
          </div>
        </div>
      </div>
    </div>
  );
};
