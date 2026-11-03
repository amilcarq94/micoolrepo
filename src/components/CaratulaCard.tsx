/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

export type ColorFondoCaratula = 'verde' | 'rojo';

export interface CaratulaData {
  id: string;
  loteNro: string;
  titulo1: string;
  subtitulo: string;
  color: ColorFondoCaratula;
  tipo: string;
  categoria: string;
  presentacion: string;
  especie: string;
  cantidadBolsas: number;
}

/**
 * Logotipo oficial de Agro Abacus S.A.
 * Utiliza la imagen adjunta con fondo transparente (/public/assets/aistudio/Dise_o_sin_t_tulo_b4c334ee.png).
 */
export const AbacusLogo: React.FC<{ className?: string; invertWhite?: boolean }> = ({
  className = 'w-12 h-12',
  invertWhite = false,
}) => (
  <img
    src="/assets/aistudio/Dise_o_sin_t_tulo_b4c334ee.png"
    alt="Agro Abacus S.A."
    className={`${className} object-contain ${invertWhite ? 'filter brightness-0 invert drop-shadow-xs' : ''}`}
  />
);

interface CaratulaCardProps {
  data: CaratulaData;
  className?: string;
  isPrintView?: boolean;
}

/**
 * Componente que reproduce exactamente la Carátula de Lote de Agro Abacus S.A.
 * Conforme al modelo adjunto (/public/assets/aistudio/caratula_lote_2a7c9289.jpg):
 * - Contenedor principal con fondo Verde (#00603C) o Rojo Oscuro (#7f1d1d).
 * - Logotipo en CUADRADO BLANCO junto a "Agro Abacus S.A." y "Planta Clasificadora | La Barrancosa".
 * - Rótulo "L O T E   N . º".
 * - Número de lote ULTRA GIGANTE, verticalmente condensado y prominente (ocupa el máximo espacio disponible).
 * - Sección inferior: Barra de acento, Título 1, Subtítulo y Espacio para QR.
 */
export const CaratulaCard: React.FC<CaratulaCardProps> = ({
  data,
  className = '',
  isPrintView = false,
}) => {
  const isRed = data.color === 'rojo';
  const bgColor = isRed ? '#7f1d1d' : '#00603C';
  const accentColor = isRed ? '#991b1b' : '#00603C';
  const titleColor = isRed ? '#7f1d1d' : '#00603C';

  // Código QR: trazabilidad pública o identificador oficial del lote
  const qrValue =
    typeof window !== 'undefined'
      ? `${window.location.origin}/?lote=${encodeURIComponent(data.loteNro)}`
      : `LOTE-${data.loteNro}`;

  // Formato del número de lote: asegura visualización prominente
  const loteDisplay = data.loteNro.trim() || '0000';

  // Cálculo de tamaño dinámico para maximizar el tamaño del número de lote según su longitud
  const getLoteFontSize = (lote: string, isPrint: boolean) => {
    const len = lote.length;
    if (len <= 4) {
      return isPrint ? 'clamp(140pt, 34vw, 230pt)' : 'clamp(100px, 28vw, 220px)';
    }
    if (len <= 6) {
      return isPrint ? 'clamp(110pt, 26vw, 175pt)' : 'clamp(78px, 22vw, 165px)';
    }
    if (len <= 8) {
      return isPrint ? 'clamp(85pt, 21vw, 138pt)' : 'clamp(62px, 17vw, 130px)';
    }
    return isPrint ? 'clamp(68pt, 17vw, 110pt)' : 'clamp(48px, 13vw, 100px)';
  };

  return (
    <div
      id={isPrintView ? 'caratula-sheet-print' : 'caratula-preview-card-element'}
      className={`caratula-a4-sheet bg-white text-slate-900 box-border flex flex-col justify-between ${
        isPrintView
          ? 'w-[210mm] min-h-[297mm] p-[16mm] mx-auto'
          : 'w-full max-w-[620px] p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-200'
      } ${className}`}
      style={{
        backgroundColor: '#FFFFFF',
        pageBreakInside: 'avoid',
        breakInside: 'avoid',
      }}
    >
      {/* CUADRADO / RECTÁNGULO PRINCIPAL DE COLOR (VERDE O ROJO OSCURO) */}
      <div
        className="relative w-full rounded-[28px] sm:rounded-[34px] px-6 pt-5 pb-6 sm:px-9 sm:pt-7 sm:pb-8 text-white flex flex-col justify-between overflow-hidden shadow-sm"
        style={{
          backgroundColor: bgColor,
          aspectRatio: '1 / 1.06',
          minHeight: isPrintView ? '202mm' : '400px',
        }}
      >
        {/* ENCABEZADO INSTITUCIONAL: LOGO EN CUADRADO BLANCO + AGRO ABACUS S.A. */}
        <div className="flex items-center gap-3.5 sm:gap-4.5 z-10">
          <div className="w-12 h-12 sm:w-15 sm:h-15 md:w-16 md:h-16 bg-white rounded-xl sm:rounded-2xl p-2 sm:p-2.5 flex items-center justify-center shadow-md shrink-0">
            <AbacusLogo className="w-full h-full" invertWhite={false} />
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight font-sans">
              Agro Abacus S.A.
            </h1>
            <p className="text-xs sm:text-sm md:text-base font-light text-white/90 tracking-wide font-sans mt-0.5">
              Planta Clasificadora | La Barrancosa
            </p>
          </div>
        </div>

        {/* ETIQUETA "L O T E   N . º" */}
        <div className="mt-3 sm:mt-5 z-10">
          <span className="text-white/95 text-xs sm:text-sm md:text-base font-extrabold tracking-[0.38em] uppercase font-sans">
            L O T E &nbsp; N . º
          </span>
        </div>

        {/* NÚMERO DE LOTE GIGANTE CONDENSADO VERTICAL */}
        <div className="flex-1 flex items-center justify-center my-1 sm:my-2 z-10 overflow-hidden">
          <div
            className="w-full text-center font-black text-white select-all font-sans leading-[0.85]"
            style={{
              fontSize: getLoteFontSize(loteDisplay, isPrintView),
              letterSpacing: '-0.04em',
              transform: 'scaleY(1.42)',
              transformOrigin: 'center center',
              fontStretch: 'condensed',
              textShadow: '0 3px 14px rgba(0,0,0,0.22)',
            }}
          >
            {loteDisplay}
          </div>
        </div>

        {/* Sombra suave interna sutil en la parte inferior */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />
      </div>

      {/* SECCIÓN INFERIOR: TÍTULO 1, SUBTÍTULO Y ESPACIO PARA QR */}
      <div className="mt-6 sm:mt-8 pt-2 flex items-end justify-between gap-4">
        {/* BLOQUE IZQUIERDO: BARRA DECORATIVA, TÍTULO 1 Y SUBTÍTULO */}
        <div className="flex-1 min-w-0 pr-3">
          {/* Pequeña barra horizontal gruesa con el color de tema */}
          <div
            className="w-14 sm:w-18 h-1.5 sm:h-2 rounded-full mb-3 sm:mb-4"
            style={{ backgroundColor: accentColor }}
          />

          {/* TÍTULO 1 */}
          <h2
            className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight truncate font-sans"
            style={{ color: titleColor }}
            title={data.titulo1 || 'Título 1'}
          >
            {data.titulo1.trim() || 'Título 1'}
          </h2>

          {/* SUBTÍTULO */}
          <p
            className="text-base sm:text-xl md:text-2xl font-medium text-slate-600 mt-1 sm:mt-1.5 truncate font-sans"
            title={data.subtitulo || 'Subtítulo'}
          >
            {data.subtitulo.trim() || 'Subtítulo'}
          </p>

          {/* METADATOS TÉCNICOS SUTILES PARA LA PLANTA (TIPO, CATEGORÍA, ENVASE) */}
          <div className="flex flex-wrap items-center gap-1.5 mt-3 text-[10px] sm:text-xs font-mono font-bold text-slate-500">
            <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 uppercase">
              {data.especie || 'Soja'}
            </span>
            <span>·</span>
            <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 uppercase">
              {data.tipo || 'Intermedio'}
            </span>
            <span>·</span>
            <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 uppercase">
              {data.categoria || 'PRIMU'}
            </span>
            <span>·</span>
            <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700">
              {data.presentacion || '800 kg'}
            </span>
            <span>·</span>
            <span className="text-[#00603C] font-black">
              {data.cantidadBolsas} Bolsas
            </span>
          </div>
        </div>

        {/* BLOQUE DERECHO: ESPACIO PARA QR CON RECUADRO DILUIDO / LÍNEA DE PUNTOS */}
        <div className="shrink-0 flex flex-col items-center justify-center">
          <div
            className="w-28 h-28 sm:w-34 sm:h-34 p-2 sm:p-2.5 rounded-2xl sm:rounded-3xl border-2 border-dashed border-slate-400/80 bg-white flex flex-col items-center justify-center shadow-2xs"
            style={{
              borderColor: '#94a3b8',
              borderStyle: 'dashed',
            }}
          >
            <div className="w-full h-full flex items-center justify-center p-0.5 bg-white">
              <QRCodeSVG
                value={qrValue}
                size={94}
                bgColor="#FFFFFF"
                fgColor="#000000"
                level="M"
                includeMargin={false}
                className="w-full h-full aspect-square block"
              />
            </div>
          </div>
          <span className="text-[8px] sm:text-[9.5px] font-bold tracking-[0.25em] text-slate-500 uppercase mt-1.5 text-center font-mono">
            ESPACIO PARA QR
          </span>
        </div>
      </div>
    </div>
  );
};
