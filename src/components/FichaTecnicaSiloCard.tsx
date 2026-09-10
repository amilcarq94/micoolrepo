/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { formatNumberArg } from '../utils/formatters';

export interface SiloFichaInfo {
  siloId: string;
  cliente: string;
  especie: string;
  variedad: string;
  stockKg: number;
  humedad: string | number;
  categoria?: string;
  ultimoMovimiento?: string;
}

interface FichaTecnicaSiloCardProps {
  ficha: SiloFichaInfo;
  isMini?: boolean;
  elementId?: string;
  className?: string;
}

/**
 * Ficha Oficial de Silo:
 * - Título central y visible: Nombre de Silo (ej. SILO 1)
 * - Sin código QR, sin logo ni nombre de empresa, sin subtítulo de planta de clasificación
 * - Sin duplicar datos en la ficha
 * - Tamaño grande para: Stock en Kilos, Cliente y Variedad
 * - Compatible con Ficha Individual A4 y Grilla de 6 Fichas en 1 Hoja A4
 */
export const FichaTecnicaSiloCard: React.FC<FichaTecnicaSiloCardProps> = ({
  ficha,
  isMini = false,
  elementId,
  className = '',
}) => {
  const siloName = ficha.siloId ? ficha.siloId.toUpperCase() : 'SILO';

  const clienteDisplay =
    ficha.cliente && ficha.cliente !== 'Sin asignación' && ficha.cliente !== 'Sin Asignar'
      ? ficha.cliente
      : 'Disponible / Sin Asignar';

  const especieDisplay =
    ficha.especie && ficha.especie !== 'Sin Cereal / Vacío' ? ficha.especie : '—';

  const variedadDisplay =
    ficha.variedad && ficha.variedad !== '-' && ficha.variedad !== 'Sin variedad'
      ? ficha.variedad
      : 'SIN VARIEDAD';

  const stockKgDisplay = `${formatNumberArg(ficha.stockKg || 0, 0)} kg`;
  const stockTnDisplay = ficha.stockKg ? `${formatNumberArg(ficha.stockKg / 1000, 1)} Tn` : '0 Tn';

  const humedadDisplay =
    ficha.humedad !== undefined && ficha.humedad !== null && String(ficha.humedad) !== '0.0' && String(ficha.humedad) !== '0'
      ? `${ficha.humedad}%`
      : '13.5%';

  if (isMini) {
    // Versión Mini para Grilla de 6 Fichas en 1 Sola Hoja A4 (2 columnas x 3 filas)
    // Se asegura encajar en altura de ~86mm sin desbordar ni duplicar datos
    return (
      <div
        id={elementId}
        className={`bg-white rounded-xl border-2 border-[#005E38] shadow-xs relative text-[#1A1A1A] font-sans flex flex-col justify-between overflow-hidden ${className}`}
        style={{
          boxSizing: 'border-box',
          width: '100%',
          padding: '8px 12px',
          height: '100%',
          maxHeight: '88mm',
        }}
      >
        {/* 1. Título Central y Visible: Nombre del Silo */}
        <div className="text-center pb-1 mb-1 border-b-[1.5px] border-[#005E38]">
          <h2
            className="font-mono font-black text-[#005E38] tracking-wider uppercase m-0 leading-tight"
            style={{ fontSize: '17px' }}
          >
            {siloName}
          </h2>
        </div>

        {/* 2. Stock en Kilos (Tamaño Grande) */}
        <div className="bg-[#005E38] text-white text-center rounded-lg py-1.5 px-2 my-0.5 shadow-2xs">
          <span
            className="block uppercase tracking-widest text-emerald-200 font-bold leading-none mb-0.5"
            style={{ fontSize: '7.5px' }}
          >
            STOCK EN KILOS
          </span>
          <div
            className="font-mono font-black tracking-tight leading-none text-white"
            style={{ fontSize: '20px' }}
          >
            {stockKgDisplay}
          </div>
          <span
            className="block text-emerald-100 font-mono font-semibold leading-none mt-0.5"
            style={{ fontSize: '8.5px' }}
          >
            ({stockTnDisplay})
          </span>
        </div>

        {/* 3. Cliente (Tamaño Grande) */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg py-1 px-2 my-0.5 text-center">
          <span
            className="block font-bold text-slate-500 uppercase tracking-wider leading-none mb-0.5"
            style={{ fontSize: '7.5px' }}
          >
            CLIENTE
          </span>
          <div
            className="font-sans font-black text-[#005E38] uppercase tracking-tight truncate leading-tight"
            style={{ fontSize: '13px' }}
            title={clienteDisplay}
          >
            {clienteDisplay}
          </div>
        </div>

        {/* 4. Variedad (Tamaño Grande) */}
        <div className="bg-amber-50 border border-amber-300 rounded-lg py-1 px-2 my-0.5 text-center">
          <span
            className="block font-bold text-amber-800 uppercase tracking-wider leading-none mb-0.5"
            style={{ fontSize: '7.5px' }}
          >
            VARIEDAD
          </span>
          <div
            className="font-sans font-black text-amber-950 uppercase tracking-tight truncate leading-tight"
            style={{ fontSize: '13px' }}
            title={variedadDisplay}
          >
            {variedadDisplay}
          </div>
        </div>

        {/* 5. Datos complementarios (Sin duplicar) */}
        <div className="grid grid-cols-2 gap-1.5 mt-0.5 pt-0.5 border-t border-slate-200">
          <div className="bg-slate-100/80 rounded py-0.5 px-1 text-center">
            <span className="block font-bold text-slate-500 uppercase leading-none" style={{ fontSize: '7px' }}>
              ESPECIE
            </span>
            <span className="font-bold text-slate-800 truncate block leading-tight mt-0.5" style={{ fontSize: '9px' }}>
              {especieDisplay}
            </span>
          </div>
          <div className="bg-slate-100/80 rounded py-0.5 px-1 text-center">
            <span className="block font-bold text-slate-500 uppercase leading-none" style={{ fontSize: '7px' }}>
              HUMEDAD
            </span>
            <span className="font-mono font-bold text-slate-800 truncate block leading-tight mt-0.5" style={{ fontSize: '9px' }}>
              {humedadDisplay}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Versión Individual Completa (Hoja A4 / Modal Individual)
  return (
    <div
      id={elementId}
      className={`bg-white rounded-2xl border-2 border-[#005E38] shadow-sm relative text-[#1A1A1A] font-sans flex flex-col justify-between ${className}`}
      style={{
        boxSizing: 'border-box',
        width: '100%',
        padding: '24px 28px',
        margin: '0 auto',
      }}
    >
      {/* 1. Título Central y Visible: Nombre del Silo */}
      <div className="text-center pb-4 mb-4 border-b-2 border-[#005E38]">
        <h1
          className="font-mono font-black text-[#005E38] tracking-wider uppercase m-0 leading-tight"
          style={{ fontSize: '38px', letterSpacing: '0.05em' }}
        >
          {siloName}
        </h1>
      </div>

      {/* 2. Stock en Kilos (Tamaño Grande) */}
      <div
        className="w-full bg-[#005E38] text-white text-center rounded-2xl p-5 mb-4 shadow-md flex flex-col items-center justify-center"
        style={{ backgroundColor: '#005E38', color: '#ffffff' }}
      >
        <span className="text-[11px] uppercase tracking-widest text-emerald-200 font-bold mb-1">
          STOCK EN KILOS
        </span>
        <div
          className="font-mono font-black leading-none text-white tracking-tight my-1"
          style={{ fontSize: '3.6rem', lineHeight: 1 }}
        >
          {stockKgDisplay}
        </div>
        <div className="text-sm font-mono font-bold text-emerald-100 mt-1">
          {stockTnDisplay} Netas
        </div>
      </div>

      {/* 3. Cliente (Tamaño Grande) */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 mb-4 text-center">
        <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1.5">
          CLIENTE
        </span>
        <div
          className="font-sans font-black text-[#005E38] uppercase tracking-tight leading-tight"
          style={{ fontSize: '26px' }}
        >
          {clienteDisplay}
        </div>
      </div>

      {/* 4. Variedad (Tamaño Grande) */}
      <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-4 sm:p-5 mb-4 text-center">
        <span className="block text-[10px] font-bold text-amber-800 uppercase tracking-widest leading-none mb-1.5">
          VARIEDAD
        </span>
        <div
          className="font-sans font-black text-amber-950 uppercase tracking-tight leading-tight"
          style={{ fontSize: '26px' }}
        >
          {variedadDisplay}
        </div>
      </div>

      {/* 5. Datos complementarios (Sin duplicar ninguno de los anteriores) */}
      <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-200">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
          <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
            ESPECIE
          </span>
          <span className="font-bold text-slate-800 text-base">
            {especieDisplay}
          </span>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
          <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
            HUMEDAD
          </span>
          <span className="font-mono font-bold text-slate-800 text-base">
            {humedadDisplay}
          </span>
        </div>
      </div>
    </div>
  );
};
