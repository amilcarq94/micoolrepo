/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LoteLimitsConfig, DEFAULT_LOTE_LIMITS } from '../types';

export const LOTE_LIMITS_STORAGE_KEY = 'agro_lote_limits';

export function getLoteLimits(): LoteLimitsConfig {
  const saved = localStorage.getItem(LOTE_LIMITS_STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return {
        maxKgPorLote: Number(parsed.maxKgPorLote) || DEFAULT_LOTE_LIMITS.maxKgPorLote,
        maxBolsasPorLote: Number(parsed.maxBolsasPorLote) || DEFAULT_LOTE_LIMITS.maxBolsasPorLote,
        kgPorBolsaDefault: Number(parsed.kgPorBolsaDefault) || DEFAULT_LOTE_LIMITS.kgPorBolsaDefault,
      };
    } catch (e) {
      console.error('Error loading lote limits:', e);
    }
  }
  return { ...DEFAULT_LOTE_LIMITS };
}

export function saveLoteLimits(limits: LoteLimitsConfig): void {
  localStorage.setItem(LOTE_LIMITS_STORAGE_KEY, JSON.stringify(limits));
}

export interface ValidationResult {
  allowed: boolean;
  errorMessage?: string;
  excedenteKg: number;
  excedenteBolsas: number;
  margenDisponibleKg: number;
  margenDisponibleBolsas: number;
  maxKg: number;
  maxBolsas: number;
}

/**
 * Valida de forma estricta e inquebrantable los límites máximos permitidos por lote.
 * 
 * @param currentKg Kilos actuales en el lote (0 si es nuevo)
 * @param currentBolsas Bolsas actuales en el lote (0 si es nuevo)
 * @param additionalKg Kilos a ingresar/acumular
 * @param additionalBolsas Bolsas a ingresar/acumular
 * @param limits Configuración de límites activa
 */
export function validateLoteLimits(
  currentKg: number,
  currentBolsas: number,
  additionalKg: number,
  additionalBolsas: number,
  limits: LoteLimitsConfig = getLoteLimits()
): ValidationResult {
  const maxKg = limits.maxKgPorLote;
  const maxBolsas = limits.maxBolsasPorLote;

  const targetKg = currentKg + additionalKg;
  const targetBolsas = currentBolsas + additionalBolsas;

  const margenDisponibleKg = Math.max(0, maxKg - currentKg);
  const margenDisponibleBolsas = Math.max(0, maxBolsas - currentBolsas);

  const excedenteKg = targetKg > maxKg ? targetKg - maxKg : 0;
  const excedenteBolsas = targetBolsas > maxBolsas ? targetBolsas - maxBolsas : 0;

  if (targetKg > maxKg || targetBolsas > maxBolsas) {
    const errorParts: string[] = [];
    errorParts.push(`Operación bloqueada: Se sobrepasa el límite máximo permitido por lote (${maxKg.toLocaleString('es-AR')} kg / ${maxBolsas} bolsas).`);
    errorParts.push(`Estado previo/actual del lote: ${currentBolsas} bolsas (${currentKg.toLocaleString('es-AR')} kg).`);
    errorParts.push(`Margen disponible antes del límite: ${margenDisponibleBolsas} bolsas (${margenDisponibleKg.toLocaleString('es-AR')} kg).`);
    
    let excedenteText = '';
    if (excedenteKg > 0 && excedenteBolsas > 0) {
      excedenteText = `Excedente intentado: ${additionalBolsas} bolsas (${additionalKg.toLocaleString('es-AR')} kg) -> Supera el límite por ${excedenteBolsas} bolsas (${excedenteKg.toLocaleString('es-AR')} kg).`;
    } else if (excedenteKg > 0) {
      excedenteText = `Excedente intentado: ${additionalKg.toLocaleString('es-AR')} kg -> Supera el límite de peso por ${excedenteKg.toLocaleString('es-AR')} kg.`;
    } else {
      excedenteText = `Excedente intentado: ${additionalBolsas} bolsas -> Supera el límite de bolsas por ${excedenteBolsas} bolsas.`;
    }
    errorParts.push(excedenteText);

    return {
      allowed: false,
      errorMessage: errorParts.join('\n'),
      excedenteKg,
      excedenteBolsas,
      margenDisponibleKg,
      margenDisponibleBolsas,
      maxKg,
      maxBolsas,
    };
  }

  return {
    allowed: true,
    excedenteKg: 0,
    excedenteBolsas: 0,
    margenDisponibleKg,
    margenDisponibleBolsas,
    maxKg,
    maxBolsas,
  };
}
