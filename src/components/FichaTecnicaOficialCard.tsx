/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Lote } from '../types';
import { LogoSiloLoose } from './Logo';
import { useFichaLoteData } from '../hooks/useFichaLoteData';
import { getPublicLoteTraceUrl } from './QrTrazabilidadLote';
import { QRCodeSVG } from 'qrcode.react';
import { FileText, MapPin, Calendar, CheckCircle2, ShieldCheck, Tag, Box, Info } from 'lucide-react';

interface FichaTecnicaOficialCardProps {
  lote: Lote;
  index?: number;
  id?: string;
  showWatermark?: boolean;
  isExpandedA4?: boolean;
  nombreLoteColor?: 'black' | 'red' | 'negro' | 'rojo' | 'default';
}

/**
 * Ficha Oficial de Lote y Trazabilidad Agro Abacus S.A.
 * 
 * Reorganizada y Armonizada:
 * 1. Encabezado institucional sobrio y limpio.
 * 2. Banner Superior Verde Bosque (#005A36) con Caja Negra de N° de Lote, Cliente y Especie / Variedad en gran jerarquía visual.
 * 3. Datos Técnicos Reagrupados y Armonizados (sin métricas de stock físico residual para uso puramente técnico/trazabilidad).
 * 4. Módulo de Especificaciones + Trazabilidad y Origen + Escáner QR dinámico oficial.
 * 5. Adaptabilidad A4 óptima para impresión y PDF.
 */
export const FichaTecnicaOficialCard: React.FC<FichaTecnicaOficialCardProps> = ({
  lote,
  index,
  id,
  isExpandedA4 = false,
  nombreLoteColor = 'default',
}) => {
  const [selectedBgColor, setSelectedBgColor] = useState<'black' | 'red'>(() => {
    return nombreLoteColor === 'red' || nombreLoteColor === 'rojo' ? 'red' : 'black';
  });

  useEffect(() => {
    if (nombreLoteColor === 'red' || nombreLoteColor === 'rojo') {
      setSelectedBgColor('red');
    } else if (nombreLoteColor === 'black' || nombreLoteColor === 'negro' || nombreLoteColor === 'default') {
      setSelectedBgColor('black');
    }
  }, [nombreLoteColor]);

  const isRed = selectedBgColor === 'red';
  const {
    kgPorBolsaNum,
    fechaRealizadoDisplay,
    especieDisplay,
    variedadDisplay,
    bolsonOrigenDisplay,
    sectorBolsonOrigenDisplay,
    ubicacionAcopioDisplay,
  } = useFichaLoteData(lote);

  const cardDomId = id || `ficha-card-${lote.id || index || '0'}`;
  const qrUrl = getPublicLoteTraceUrl(lote.id || lote.loteNro || 'LOTE');

  // Formato de Identificación para el recuadro negro/rojo (sin prefijo forzado LOTE)
  const rawLoteVal = lote.loteNro || lote.id || '—';
  const displayLoteNro = rawLoteVal.replace(/^LOTE\s*[:-]?\s*/i, '').trim() || rawLoteVal;

  // Cliente en mayúsculas sin comillas
  const displayCliente = (lote.cliente || 'AGRO ABACUS S.A.').toUpperCase();

  // Variedad y Especie
  const cleanEspecie = especieDisplay && especieDisplay !== '—' ? especieDisplay.toUpperCase() : 'SEMILLA';
  const cleanVariedad = variedadDisplay && variedadDisplay !== '—' && variedadDisplay !== 'Sin variedad'
    ? variedadDisplay.toUpperCase()
    : 'ESTÁNDAR';

  // Lógica de Tratamiento
  const isTratado = (() => {
    if (Array.isArray(lote.tratamiento)) {
      return lote.tratamiento.some((t) => t.toLowerCase().includes('tratado') || t.toLowerCase().includes('curado'));
    }
    if (typeof lote.tratamiento === 'string') {
      return lote.tratamiento.toLowerCase().includes('tratado') || lote.tratamiento.toLowerCase().includes('curado');
    }
    return false;
  })();

  // Lógica de Tipo de Lote
  const isFinal = (lote.tipo || '').toLowerCase().includes('final');

  // Categoría normalizada única
  const categoriaNormalizada = (lote.categoria || 'Original').trim().toUpperCase();

  // Formato de envase / presentación
  const presentacionEnvase = lote.kgPorBolsa
    ? `BOLSA ${lote.kgPorBolsa} KG`
    : kgPorBolsaNum
    ? `BOLSA ${kgPorBolsaNum} KG`
    : 'A GRANEL / BOLSA';

  return (
    <div
      id={cardDomId}
      className={`bg-white rounded-3xl border border-slate-200 shadow-sm relative text-[#0F172A] font-sans ficha-tecnica-container ficha-tecnica-a4-container ficha-a4 seccion-impresion mx-auto overflow-hidden ${
        isExpandedA4 ? 'w-full max-w-full' : 'w-full max-w-4xl'
      }`}
      style={{
        boxSizing: 'border-box',
        backgroundColor: '#FFFFFF',
      }}
    >
      {/* 0. MINI BRAND HEADER INSTITUCIONAL CON SELECTOR DE FONDO */}
      <div className="flex flex-wrap items-center justify-between pb-3 mb-4 border-b border-gray-100 gap-2">
        <div className="flex items-center gap-2.5">
          <LogoSiloLoose size={28} color="#005A36" />
          <div className="text-left leading-tight">
            <span className="font-serif font-black text-[#005A36] text-xs tracking-wider uppercase block">
              AGRO ABACUS S.A.
            </span>
            <span className="text-[10px] text-gray-500 font-medium block">
              Planta Clasificadora · Estancia La Barrancosa
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-right flex-wrap">
          {/* Selector de color de fondo interactivo (Negro / Rojo #b82222) */}
          <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-lg border border-slate-700 print:hidden">
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider mr-1">Fondo Identificación:</span>
            <button
              type="button"
              onClick={() => setSelectedBgColor('black')}
              className={`px-2 py-0.5 rounded text-[10.5px] font-bold transition cursor-pointer ${
                !isRed
                  ? 'bg-black text-white shadow-xs ring-1 ring-slate-400'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Fondo negro (#000000) con texto blanco"
            >
              Negro
            </button>
            <button
              type="button"
              onClick={() => setSelectedBgColor('red')}
              className={`px-2 py-0.5 rounded text-[10.5px] font-bold transition flex items-center gap-1 cursor-pointer ${
                isRed
                  ? 'bg-[#b82222] text-white shadow-xs ring-1 ring-red-400'
                  : 'text-red-400 hover:text-red-300'
              }`}
              title="Fondo rojo oscuro (#b82222) con texto blanco"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#b82222] inline-block border border-white" />
              Rojo
            </button>
          </div>

          {fechaRealizadoDisplay && (
            <div className="text-[11px] font-mono font-bold text-gray-600 flex items-center gap-1 bg-gray-50 px-2.5 py-1 rounded-md border border-gray-200">
              <Calendar className="w-3 h-3 text-[#005A36]" />
              <span>Fecha: {fechaRealizadoDisplay}</span>
            </div>
          )}
          {ubicacionAcopioDisplay && ubicacionAcopioDisplay !== 'Ala A - Sector 1' && (
            <div className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-[#005A36]" />
              <span>{ubicacionAcopioDisplay}</span>
            </div>
          )}
        </div>
      </div>

      {/* 1. BANNER PRINCIPAL (VERDE BOSQUE CON CAJA NEGRA/ROJA Y TEXTOS GIGANTES) */}
      <div
        className="w-full rounded-3xl p-6 sm:p-7 text-center relative shadow-sm overflow-hidden mb-5"
        style={{
          backgroundColor: '#005A36', // Verde Bosque Institucional
          color: '#FFFFFF',
        }}
      >
        {/* Etiqueta Superior: IDENTIFICACIÓN OFICIAL */}
        <div className="text-center mb-2.5">
          <span
            className="font-sans font-black uppercase tracking-widest text-[#E5A823] text-xs sm:text-sm inline-block"
            style={{ letterSpacing: '0.14em' }}
          >
            IDENTIFICACIÓN OFICIAL
          </span>
        </div>

        {/* Caja de Identificación Central con el Número de Lote (Fondo Negro o Rojo #b82222, fuente blanca) */}
        <div className="flex justify-center items-center my-2.5">
          <div
            className="px-8 sm:px-14 py-3 sm:py-4 rounded-2xl border-2 shadow-md inline-flex items-center justify-center max-w-full transition-colors"
            style={{
              backgroundColor: isRed ? '#b82222' : '#000000',
              borderColor: isRed ? '#dc2626' : 'rgba(0,0,0,0.8)',
            }}
          >
            <span
              className="font-mono font-black tracking-tight uppercase leading-none truncate transition-colors"
              style={{
                letterSpacing: '-0.02em',
                color: '#FFFFFF', // Fuente blanca siempre
                fontSize: 'clamp(32px, 5.5vw, 70px)',
                lineHeight: 'clamp(36px, 5.5vw, 70px)',
              }}
            >
              {displayLoteNro}
            </span>
          </div>
        </div>

        {/* Textos Inferiores: Nombre de CLIENTE y Nombre de VARIEDAD en TAMAÑO GIGANTE */}
        <div className="mt-4 space-y-1.5">
          {/* CLIENTE GIGANTE */}
          <div
            className="font-sans font-black text-white tracking-tight uppercase leading-tight break-words"
            title={displayCliente}
            style={{
              textShadow: '0 2px 4px rgba(0,0,0,0.25)',
              fontSize: 'clamp(28px, 4.5vw, 60px)',
              lineHeight: 'clamp(32px, 4.5vw, 60.5px)',
            }}
          >
            {displayCliente}
          </div>

          {/* ESPECIE Y VARIEDAD */}
          <div
            className="font-sans font-extrabold text-[#FDF0CD] tracking-tight uppercase leading-tight break-words"
            title={`${cleanEspecie} - ${cleanVariedad}`}
            style={{
              textShadow: '0 2px 4px rgba(0,0,0,0.2)',
              fontSize: 'clamp(22px, 3.5vw, 60px)',
              lineHeight: 'clamp(26px, 3.5vw, 60px)',
            }}
          >
            {cleanEspecie} · {cleanVariedad}
          </div>
        </div>
      </div>

      {/* 2. GRILLA PRINCIPAL DE DATOS REAGRUPADOS Y ARMONIZADOS + CÓDIGO QR */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch mb-5">
        {/* Columna Izquierda: Bloque de Clasificación y Especificaciones Técnicas (7 cols) */}
        <div className="md:col-span-7 flex flex-col gap-3.5">
          {/* Tarjeta 1: Especificaciones del Lote */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left shadow-2xs">
            <div className="flex items-center gap-2 mb-3 pb-1.5 border-b border-slate-200">
              <Tag className="w-4 h-4 text-[#005A36]" />
              <span className="font-sans font-black text-[#005A36] text-xs uppercase tracking-wider">
                Clasificación y Atributos
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="bg-white p-2.5 rounded-xl border border-gray-200">
                <span className="text-[10px] font-bold text-gray-500 uppercase block">Categoría</span>
                <span className="font-black text-[#92400E] text-xs sm:text-sm uppercase block mt-0.5">
                  {categoriaNormalizada || 'ORIGINAL'}
                </span>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-gray-200">
                <span className="text-[10px] font-bold text-gray-500 uppercase block">Tipo de Lote</span>
                <span className={`font-black text-xs sm:text-sm uppercase block mt-0.5 ${isFinal ? 'text-emerald-700' : 'text-blue-700'}`}>
                  {isFinal ? 'FINAL' : 'INTERMEDIO'}
                </span>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-gray-200">
                <span className="text-[10px] font-bold text-gray-500 uppercase block">Envase / Presentación</span>
                <span className="font-bold text-slate-800 text-xs uppercase block mt-0.5">
                  {presentacionEnvase}
                </span>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-gray-200">
                <span className="text-[10px] font-bold text-gray-500 uppercase block">Tratamiento / Sanidad</span>
                <span className={`font-black text-xs sm:text-sm uppercase block mt-0.5 ${isTratado ? 'text-rose-700' : 'text-emerald-700'}`}>
                  {isTratado ? 'TRATADO' : 'SIN TRATAR'}
                </span>
              </div>
            </div>

            {isTratado && lote.producto && lote.producto !== 'Ninguno' && (
              <div className="mt-2.5 px-3 py-1.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs">
                <span className="text-[10px] font-bold text-rose-800 uppercase">Producto Aplicado:</span>
                <span className="font-mono font-bold text-rose-900">{lote.producto}</span>
              </div>
            )}
          </div>

          {/* Tarjeta 2: Trazabilidad y Origen */}
          <div className="bg-[#EAF5EC] border border-[#C5E5CC] rounded-2xl p-4 text-left shadow-2xs">
            <div className="flex items-center gap-2 mb-3 pb-1.5 border-b border-[#C5E5CC]">
              <FileText className="w-4 h-4 text-[#005A36]" />
              <span className="font-sans font-black text-[#005A36] text-xs uppercase tracking-wider">
                Trazabilidad y Origen de Planta
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between bg-white/80 p-2 rounded-lg border border-[#C5E5CC]/60">
                <span className="text-gray-600 font-bold uppercase text-[10px]">
                  N° Bolsón / Silo Origen:
                </span>
                <span className="font-mono font-black text-gray-900 text-xs sm:text-sm">
                  {bolsonOrigenDisplay || 'Sin dato'}
                </span>
              </div>

              {sectorBolsonOrigenDisplay && sectorBolsonOrigenDisplay !== 'Ala A - Sector 1' && (
                <div className="flex items-center justify-between bg-white/80 p-2 rounded-lg border border-[#C5E5CC]/60">
                  <span className="text-gray-500 font-semibold uppercase text-[10px]">
                    Sector Origen:
                  </span>
                  <span className="font-semibold text-gray-800 text-xs">
                    {sectorBolsonOrigenDisplay}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Columna Derecha: Marco QR Dinámico de Trazabilidad (5 cols) */}
        <div className="md:col-span-5 flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-gray-200 shadow-2xs text-center">
          <div className="relative p-3 flex flex-col items-center justify-center">
            {/* Esquinas de lectura de escáner */}
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#005A36] rounded-tl-md pointer-events-none" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#005A36] rounded-tr-md pointer-events-none" />
            <div className="absolute bottom-6 left-0 w-4 h-4 border-b-2 border-l-2 border-[#005A36] rounded-bl-md pointer-events-none" />
            <div className="absolute bottom-6 right-0 w-4 h-4 border-b-2 border-r-2 border-[#005A36] rounded-br-md pointer-events-none" />

            {/* Código QR */}
            <div className="w-[145px] h-[145px] sm:w-[160px] sm:h-[160px] flex items-center justify-center bg-white p-1">
              <QRCodeSVG
                value={qrUrl}
                size={150}
                bgColor="#FFFFFF"
                fgColor="#005A36"
                level="H"
                includeMargin={false}
                className="w-full h-full aspect-square block"
              />
            </div>

            {/* Etiqueta Inferior */}
            <div className="mt-2.5 text-center">
              <span className="text-[10px] font-black text-[#005A36] uppercase tracking-wider block">
                QR OFICIAL DE TRAZABILIDAD
              </span>
              <span className="text-[9px] text-gray-400 font-mono block mt-0.5">
                Escaneo directo a ficha técnica digital
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. OBSERVACIONES TÉCNICAS SI EXISTEN */}
      {lote.observaciones && lote.observaciones.trim() && (
        <div className="mb-4 p-3.5 bg-amber-50/70 rounded-2xl border border-amber-200 text-left text-xs text-amber-950 shadow-2xs">
          <div className="flex items-center gap-1.5 mb-1 text-[#005A36] font-bold uppercase text-[10px] tracking-wider">
            <Info className="w-3.5 h-3.5" />
            <span>Observaciones y Especificaciones Técnicas:</span>
          </div>
          <p className="m-0 leading-relaxed font-sans font-medium text-slate-800">
            {lote.observaciones.trim()}
          </p>
        </div>
      )}

      {/* 4. PIE DE PÁGINA INSTITUCIONAL */}
      <div className="text-center pt-3 mt-1 border-t border-gray-100">
        <p className="text-[#94A3B8] text-[9px] font-medium m-0">
          Agro Abacus S.A. — Planta de Clasificación de Semillas · Estancia La Barrancosa
        </p>
      </div>
    </div>
  );
};
