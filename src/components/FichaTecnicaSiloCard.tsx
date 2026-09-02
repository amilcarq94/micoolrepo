/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { LogoSiloLoose } from './Logo';
import { QRCodeCanvas } from 'qrcode.react';
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
 * Ficha Oficial de Silo y Trazabilidad (Ficha Técnica)
 * Diseño idéntico a la Ficha Técnica de Lotes:
 * - Encabezado con logo institucional Agro Abacus S.A.
 * - Tarjeta con borde verde institucional #005E38 redondeado (rounded-2xl)
 * - Bloque destacado gris claro con Silo ID, Cliente y Código QR de Trazabilidad
 * - Tabla de datos con filas alternadas y líneas finas
 * - Solo el campo Cliente posee color distintivo (#005E38), manteniendo todos los campos el mismo tamaño de fuente
 * - Barra de stock inferior en verde institucional
 * - Pie de página institucional en cursiva
 */
export const FichaTecnicaSiloCard: React.FC<FichaTecnicaSiloCardProps> = ({
  ficha,
  isMini = false,
  elementId,
  className = '',
}) => {
  const clienteDisplay =
    ficha.cliente && ficha.cliente !== 'Sin asignación' && ficha.cliente !== 'Sin Asignar'
      ? ficha.cliente
      : 'Disponible / Sin Asignar';

  const especieDisplay =
    ficha.especie && ficha.especie !== 'Sin Cereal / Vacío' ? ficha.especie : '-';

  const variedadDisplay = ficha.variedad && ficha.variedad !== '-' ? ficha.variedad : '-';

  const stockKgDisplay = `${formatNumberArg(ficha.stockKg || 0, 0)} kg`;

  const humedadDisplay =
    ficha.humedad !== undefined && ficha.humedad !== null && String(ficha.humedad) !== '0.0'
      ? `${ficha.humedad}%`
      : '13.5%';

  // Código QR de Trazabilidad Oficial de Silo
  const qrPayload = JSON.stringify({
    empresa: 'AGRO ABACUS S.A. - PLANTA CLASIFICADORA LA BARRANCOSA',
    siloId: ficha.siloId || 'S/N',
    cliente: clienteDisplay,
    especie: especieDisplay,
    variedad: variedadDisplay,
    stockKg: ficha.stockKg || 0,
    humedad: humedadDisplay,
    tipo: 'FICHA OFICIAL DE SILO Y CONTROL DE STOCK',
  });

  const tablaDatos = [
    {
      label: 'Cliente',
      valor: clienteDisplay,
      isCliente: true,
      isVariedad: false,
    },
    {
      label: 'Especie',
      valor: especieDisplay,
      isCliente: false,
      isVariedad: false,
    },
    {
      label: 'Variedad',
      valor: variedadDisplay,
      isCliente: false,
      isVariedad: true,
    },
    {
      label: 'Kilos en stock',
      valor: stockKgDisplay,
      isCliente: false,
      isVariedad: false,
    },
    {
      label: 'Humedad (promedio)',
      valor: humedadDisplay,
      isCliente: false,
      isVariedad: false,
    },
  ];

  if (isMini) {
    // Versión Mini para Grilla de 6 Fichas en 1 Hoja A4
    return (
      <div
        id={elementId}
        className={`bg-white rounded-xl border-[1.5px] border-[#005E38] shadow-xs relative text-[#1A1A1A] font-sans flex flex-col justify-between overflow-hidden ${className}`}
        style={{
          boxSizing: 'border-box',
          width: '100%',
          padding: '10px 12px',
          height: '100%',
          maxHeight: '86mm',
        }}
      >
        {/* 1. Encabezado con Logo y Silo ID */}
        <div className="flex items-center justify-between pb-1.5 mb-1 border-b-[1.2px] border-[#005E38]">
          <div className="flex items-center gap-2">
            <div className="shrink-0 flex items-center justify-center">
              <LogoSiloLoose size={22} color="#005E38" />
            </div>
            <div className="text-left">
              <h1
                className="font-serif font-black text-[#005E38] tracking-wider uppercase m-0 leading-tight"
                style={{ fontSize: '11px' }}
              >
                AGRO ABACUS S.A.
              </h1>
              <p className="text-slate-600 font-semibold m-0" style={{ fontSize: '8px' }}>
                Planta de Clasificación de Semillas
              </p>
            </div>
          </div>
          {/* Silo ID Badge */}
          <span
            className="px-2 py-0.5 bg-[#E3EFE7] border border-[#005E38]/40 text-[#005E38] font-mono font-black uppercase rounded-md shadow-2xs"
            style={{ fontSize: '9.5px' }}
          >
            {ficha.siloId}
          </span>
        </div>

        {/* 2. Título de ficha mini */}
        <div className="text-center my-0.5">
          <h2
            className="font-serif font-extrabold uppercase tracking-wider text-[#005E38] m-0"
            style={{ fontSize: '9px' }}
          >
            FICHA OFICIAL DE SILO Y CONTROL DE STOCK
          </h2>
        </div>

        {/* 3. Bloque destacado Mini con Silo, Cliente y Mini QR */}
        <div
          className="bg-slate-100 rounded-lg p-1.5 my-1 border border-slate-200/80 flex items-center justify-between gap-2"
          style={{ backgroundColor: '#F1F5F9' }}
        >
          <div className="flex-1 min-w-0 text-left">
            <span className="block text-[7.5px] font-bold text-slate-500 uppercase tracking-wider leading-none mb-0.5">
              CLIENTE
            </span>
            <div
              className="font-sans font-black text-[#005E38] uppercase tracking-tight truncate leading-tight"
              style={{ fontSize: '12px' }}
              title={clienteDisplay}
            >
              {clienteDisplay}
            </div>
          </div>
          <div className="shrink-0 bg-white p-1 rounded-md border border-slate-300 flex items-center justify-center">
            <QRCodeCanvas
              value={qrPayload}
              size={36}
              bgColor="#ffffff"
              fgColor="#005E38"
              level="L"
            />
          </div>
        </div>

        {/* 4. Tabla de datos (Variedad con tipografía destacada y tamaño aumentado para lectura rápida) */}
        <div className="w-full rounded-md overflow-hidden border border-slate-200 my-0.5">
          <table className="w-full border-collapse text-left" style={{ fontSize: '9.5px' }}>
            <tbody>
              {tablaDatos.map((fila, idx) => (
                <tr
                  key={fila.label}
                  className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}
                  style={{
                    backgroundColor: idx % 2 === 0 ? '#ffffff' : '#F8FAFC',
                    borderBottom: idx === tablaDatos.length - 1 ? 'none' : '1px solid #E2E8F0',
                    height: fila.isVariedad ? '22px' : '18px',
                  }}
                >
                  <td
                    className="py-0.5 px-2 font-semibold text-slate-600 align-middle border-r border-slate-200/60"
                    style={{ width: '40%', whiteSpace: 'nowrap' }}
                  >
                    {fila.label}
                  </td>
                  <td
                    className="py-0.5 px-2 align-middle truncate max-w-[150px]"
                    style={{
                      width: '60%',
                      color: fila.isCliente ? '#005E38' : fila.isVariedad ? '#0F172A' : '#0F172A',
                      fontWeight: fila.isVariedad ? 900 : 700,
                      fontSize: fila.isVariedad ? '11px' : '9.5px',
                    }}
                    title={fila.valor}
                  >
                    {fila.isVariedad && fila.valor !== '-' ? (
                      <span className="inline-block px-1.5 py-0.2 bg-amber-100 text-amber-950 font-black rounded border border-amber-200 uppercase">
                        {fila.valor}
                      </span>
                    ) : (
                      fila.valor
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 5. Barra de Stock Mini */}
        <div
          className="w-full bg-[#005E38] text-white text-center rounded font-bold uppercase tracking-wider py-1 px-2 my-0.5 shadow-2xs"
          style={{
            backgroundColor: '#005E38',
            color: '#ffffff',
            fontSize: '9px',
          }}
        >
          STOCK EN SILO: {stockKgDisplay}
        </div>

        {/* 6. Pie de página discreto */}
        <div className="text-center pt-0.5">
          <p className="text-slate-400 italic font-medium m-0" style={{ fontSize: '7.5px' }}>
            Agro Abacus S.A. — Planta de Clasificación de Semillas
          </p>
        </div>
      </div>
    );
  }

  // Versión Individual Completa (Estilo Ficha de Lote A4 / Card)
  return (
    <div
      id={elementId}
      className={`bg-white rounded-2xl border-[1.5px] border-[#005E38] shadow-sm relative text-[#1A1A1A] font-sans flex flex-col justify-between ${className}`}
      style={{
        boxSizing: 'border-box',
        width: '100%',
        padding: '20px 24px',
        margin: '0 auto',
      }}
    >
      {/* 1. Encabezado institucional idéntico con Logo */}
      <div className="flex items-center justify-start gap-3.5 pb-2.5 mb-3 border-b-[1.5px] border-[#005E38]">
        <div className="shrink-0 flex items-center justify-center">
          <LogoSiloLoose size={40} color="#005E38" />
        </div>
        <div className="text-left">
          <h1
            className="font-serif font-black text-[#005E38] tracking-wider uppercase m-0 leading-tight"
            style={{ fontSize: '18px' }}
          >
            AGRO ABACUS S.A.
          </h1>
          <p
            className="text-slate-600 font-semibold m-0 tracking-normal"
            style={{ fontSize: '11px' }}
          >
            Planta de Clasificación de Semillas
          </p>
        </div>
      </div>

      {/* 2. Título de ficha */}
      <div className="text-center my-2.5">
        <h2
          className="font-serif font-extrabold uppercase tracking-wider text-[#005E38] m-0"
          style={{ fontSize: '14px' }}
        >
          FICHA OFICIAL DE SILO Y TRAZABILIDAD
        </h2>
      </div>

      {/* 3. Bloque destacado (fondo gris claro #F1F5F9) con N° DE SILO, CLIENTE y Código QR */}
      <div
        className="bg-slate-100 rounded-xl p-3.5 mb-3.5 border border-slate-200/80 flex items-center justify-between gap-4"
        style={{ backgroundColor: '#F1F5F9' }}
      >
        {/* Izquierda: N° DE SILO y CLIENTE apilados y verticalmente centrados */}
        <div className="flex-1 min-w-0 text-left space-y-1.5">
          {/* N° DE SILO */}
          <div className="min-w-0">
            <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider leading-none mb-0.5">
              N° DE SILO
            </span>
            <div
              className="font-mono font-black text-[#005E38] tracking-tight truncate leading-none"
              style={{ fontSize: '38pt', lineHeight: 1 }}
              title={ficha.siloId || 'SILO'}
            >
              {ficha.siloId || 'SILO'}
            </div>
          </div>

          {/* CLIENTE */}
          <div className="min-w-0 pt-0.5">
            <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider leading-none mb-0.5">
              CLIENTE
            </span>
            <div
              className="font-sans font-black text-[#005E38] uppercase tracking-tight truncate leading-none"
              style={{ fontSize: '22pt', lineHeight: 1.05 }}
              title={clienteDisplay}
            >
              {clienteDisplay}
            </div>
          </div>
        </div>

        {/* Derecha: Código QR grande verticalmente centrado */}
        <div className="shrink-0 bg-white p-2 rounded-xl border border-slate-300 shadow-2xs flex items-center justify-center">
          <QRCodeCanvas
            value={qrPayload}
            size={120}
            bgColor="#ffffff"
            fgColor="#005E38"
            level="M"
          />
        </div>
      </div>

      {/* 4. Tabla de datos (con Variedad destacada en tamaño de fuente aumentado y negrita) */}
      <div className="w-full rounded-lg overflow-hidden border border-slate-200 mb-3.5">
        <table className="w-full border-collapse text-left text-xs" style={{ fontSize: '11px' }}>
          <tbody>
            {tablaDatos.map((fila, idx) => (
              <tr
                key={fila.label}
                className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}
                style={{
                  backgroundColor: idx % 2 === 0 ? '#ffffff' : '#F8FAFC',
                  borderBottom: idx === tablaDatos.length - 1 ? 'none' : '1px solid #E2E8F0',
                  height: fila.isVariedad ? '32px' : '24px',
                }}
              >
                <td
                  className="py-1 px-3 font-semibold text-slate-600 w-5/12 align-middle border-r border-slate-200/60"
                  style={{ width: '40%', whiteSpace: 'nowrap' }}
                >
                  {fila.label}
                </td>
                <td
                  className="py-1 px-3 align-middle truncate max-w-[280px]"
                  style={{
                    width: '60%',
                    color: fila.isCliente ? '#005E38' : fila.isVariedad ? '#0F172A' : '#0F172A',
                    fontWeight: fila.isVariedad ? 900 : 700,
                    fontSize: fila.isVariedad ? '15px' : '11px',
                  }}
                  title={fila.valor}
                >
                  {fila.isVariedad && fila.valor !== '-' ? (
                    <span className="inline-block px-2.5 py-0.5 bg-amber-100/90 text-amber-950 font-black rounded-lg border border-amber-300 text-sm tracking-wide uppercase">
                      {fila.valor}
                    </span>
                  ) : (
                    fila.valor
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 5. Barra de stock destacado (3.5rem bold) */}
      <div
        className="w-full bg-[#005E38] text-white text-center rounded-xl font-bold uppercase tracking-wider py-3 px-4 mb-3 shadow-md flex flex-col items-center justify-center"
        style={{
          backgroundColor: '#005E38',
          color: '#ffffff',
        }}
      >
        <span className="text-[11px] uppercase tracking-widest text-emerald-200 font-bold mb-1">
          Stock Actual en Silo
        </span>
        <div
          className="font-mono font-bold leading-none text-white tracking-tight"
          style={{ fontSize: '3.5rem', lineHeight: 1 }}
        >
          {stockKgDisplay}
        </div>
      </div>

      {/* 6. Pie de página institucional en cursiva */}
      <div className="text-center pt-1">
        <p
          className="text-slate-400 italic font-medium m-0"
          style={{ fontSize: '9px' }}
        >
          Agro Abacus S.A. — Planta de Clasificación de Semillas
        </p>
      </div>
    </div>
  );
};
