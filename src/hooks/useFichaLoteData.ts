/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';
import { Lote } from '../types';
import { formatNumberArg, formatDateStr } from '../utils/formatters';

export interface FichaDatoItem {
  label: string;
  valor: string;
}

export interface FichaLoteDataResult {
  fechaRealizadoDisplay: string;
  especieDisplay: string;
  variedadDisplay: string;
  categoriaDisplay: string;
  tipoLoteDisplay: string;
  tratamientoDisplay: string;
  ordenProcesoMovimientoDisplay: string;
  bolsonOrigenDisplay: string;
  sectorBolsonOrigenDisplay: string;
  cantidadBolsasDisplay: string;
  kgPorBolsaDisplay: string;
  ubicacionAcopioDisplay: string;
  stockKgNum: number;
  stockBolsasNum: number;
  kgPorBolsaNum: number;
  tablaDatos: FichaDatoItem[];
}

/**
 * Hook y función utilitaria para centralizar el cálculo y formateo de la
 * Ficha de Lote y Trazabilidad Oficial de Agro Abacus S.A.
 * 
 * Garantiza consistencia visual y de datos idéntica entre:
 * - FichaTecnicaOficialCard.tsx (vista de precarga / batch print)
 * - ImprimirFichaTecnica.tsx (modal individual con edición)
 * - LoteDetail.tsx / cualquier visor de ficha
 */
export const computeFichaLoteData = (lote: Lote): FichaLoteDataResult => {
  // 1. Fecha de realizado
  const fechaRealizadoDisplay =
    formatDateStr(
      lote.fechaIngreso ||
      (lote.fechaHoraProduccion ? lote.fechaHoraProduccion.split('T')[0] : '')
    ) || '14/08/2026';

  // 2. Especie
  const especieDisplay = lote.especie || 'Soja';

  // 3. Variedad
  const variedadDisplay =
    lote.variedad && lote.variedad !== 'Genérica' && lote.variedad !== 'Sin variedad'
      ? lote.variedad
      : '—';

  // 4. Categoría
  const categoriaDisplay = lote.categoria || 'Pre básica';

  // 5. Tipo de lote
  const tipoLoteDisplay = lote.tipo || 'Intermedio';

  // 6. Tratamiento
  const tratamientoDisplay = (() => {
    let t = 'Sin Tratar';
    if (Array.isArray(lote.tratamiento) && lote.tratamiento.length > 0) {
      t = lote.tratamiento.join(', ');
    } else if (typeof lote.tratamiento === 'string' && lote.tratamiento) {
      t = lote.tratamiento;
    }
    if (lote.producto && lote.producto !== 'Ninguno' && lote.producto !== 'Sin Tratar') {
      t += ` (${lote.producto})`;
    }
    return t;
  })();

  // 7. N° Orden de Proceso/Movimiento
  const ordenProcesoMovimientoDisplay =
    lote.ordenProcesoId ||
    (lote as any).ordenProceso ||
    (lote as any).numeroOrden ||
    lote.numeroOrdenMovimiento ||
    (lote as any).ordenProcesoMovimiento ||
    'Sin N°';

  // 8. N° Bolsón de origen (trazabilidad)
  const bolsonOrigenDisplay =
    (lote as any).numeroBolsonOrigen ||
    (lote as any).bolsonOrigenNro ||
    (lote.origenesBolson && lote.origenesBolson.length > 0
      ? lote.origenesBolson.map((b) => b.bolsonNro || b.bolsonId).filter(Boolean).join(', ')
      : '') ||
    'Sin dato';

  // 9. Sector de bolsón de origen
  const sectorBolsonOrigenDisplay =
    (lote as any).sectorBolsonOrigen ||
    (lote.origenesBolson && lote.origenesBolson[0]?.sector
      ? `Sector ${lote.origenesBolson[0].sector}`
      : lote.ala && lote.sector
      ? `Ala ${lote.ala} - Sector ${lote.sector}`
      : lote.sector
      ? `Sector ${lote.sector}`
      : 'Ala A - Sector 1');

  // 10. Cantidad de bolsas
  const stockBolsasNum = lote.stockBolsas !== undefined && lote.stockBolsas !== null ? Number(lote.stockBolsas) : 35;
  const cantidadBolsasDisplay = `${formatNumberArg(stockBolsasNum, 0)} bolsas`;

  // 11. Kg por bolsa
  const kgPorBolsaNum =
    Number(lote.kgPorBolsa) ||
    (stockBolsasNum > 0 && lote.stockKg ? Math.round(Number(lote.stockKg) / stockBolsasNum) : 800);
  const kgPorBolsaDisplay = `${formatNumberArg(kgPorBolsaNum, 0)} kg`;

  // 12. Ubicación de acopio
  const ubicacionAcopioDisplay =
    lote.ubicacionAcopio ||
    (lote.ala && lote.sector
      ? `Ala ${lote.ala} - Sector ${lote.sector}`
      : lote.sector
      ? `Sector ${lote.sector}`
      : 'Ala A - Sector 1');

  // Stock Total en Kg
  const stockKgNum =
    lote.stockKg !== undefined && lote.stockKg !== null
      ? Number(lote.stockKg)
      : stockBolsasNum * kgPorBolsaNum;

  // Datos estructurados de la tabla técnica
  const tablaDatos: FichaDatoItem[] = [
    { label: 'Fecha de realizado', valor: fechaRealizadoDisplay },
    { label: 'Especie', valor: especieDisplay },
    { label: 'Variedad', valor: variedadDisplay },
    { label: 'Categoría', valor: categoriaDisplay },
    { label: 'Tipo de lote', valor: tipoLoteDisplay },
    { label: 'Tratamiento', valor: tratamientoDisplay },
    { label: 'N° Orden de Proceso/Movimiento', valor: String(ordenProcesoMovimientoDisplay) },
    { label: 'N° Bolsón de origen (trazabilidad)', valor: String(bolsonOrigenDisplay) },
    { label: 'Sector de bolsón de origen', valor: String(sectorBolsonOrigenDisplay) },
    { label: 'Cantidad de bolsas', valor: cantidadBolsasDisplay },
    { label: 'Kg por bolsa', valor: kgPorBolsaDisplay },
    { label: 'Ubicación de acopio', valor: String(ubicacionAcopioDisplay) },
  ];

  // Observaciones si existen
  if (lote.observaciones && lote.observaciones.trim()) {
    tablaDatos.push({
      label: 'Observaciones',
      valor: lote.observaciones.trim(),
    });
  }

  return {
    fechaRealizadoDisplay,
    especieDisplay,
    variedadDisplay,
    categoriaDisplay,
    tipoLoteDisplay,
    tratamientoDisplay,
    ordenProcesoMovimientoDisplay,
    bolsonOrigenDisplay,
    sectorBolsonOrigenDisplay,
    cantidadBolsasDisplay,
    kgPorBolsaDisplay,
    ubicacionAcopioDisplay,
    stockKgNum,
    stockBolsasNum,
    kgPorBolsaNum,
    tablaDatos,
  };
};

/**
 * Hook React para memoizar los cálculos de datos de ficha
 */
export const useFichaLoteData = (lote: Lote): FichaLoteDataResult => {
  return useMemo(() => computeFichaLoteData(lote), [
    lote.id,
    lote.loteNro,
    lote.cliente,
    lote.especie,
    lote.variedad,
    lote.categoria,
    lote.tipo,
    lote.tratamiento,
    lote.producto,
    lote.ordenProcesoId,
    (lote as any).numeroOrdenMovimiento,
    lote.stockBolsas,
    lote.kgPorBolsa,
    lote.stockKg,
    lote.ala,
    lote.sector,
    lote.ubicacionAcopio,
    lote.observaciones,
    (lote as any).numeroBolsonOrigen,
    (lote as any).sectorBolsonOrigen,
    lote.origenesBolson,
    lote.fechaIngreso,
    lote.fechaHoraProduccion,
  ]);
};
