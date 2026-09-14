/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Lote } from '../types';

/**
 * Obtiene el prefijo oficial de iniciales para un cliente.
 * Reglas solicitadas:
 * - Eco Rural => ER
 * - SAN DIEGO (o San Diego Semillas) => SD
 * - STINE => S
 * - PAMPA => P
 * - Elementa Foods => EF
 * - Regla general: Iniciales de las 2 palabras principales, o inicial de la primera palabra si es única.
 */
export const getClientePrefijo = (clienteNombre?: string | null): string => {
  if (!clienteNombre || !clienteNombre.trim()) return 'LT';

  const clean = clienteNombre.trim();
  const upper = clean.toUpperCase();

  // 1. Mapeos explícitos prioritarios solicitados por el usuario
  if (upper.includes('ECO RURAL')) return 'ER';
  if (upper.includes('SAN DIEGO')) return 'SD';
  if (upper.includes('STINE')) return 'S';
  if (upper.includes('PAMPA')) return 'P';
  if (upper.includes('ELEMENTA')) return 'EF';

  // 2. Descartar palabras genéricas / societarias si hay términos descriptivos
  const palabrasDescartables = new Set([
    'S.A.', 'SA', 'S.R.L.', 'SRL', 'SEMILLAS', 'SEMILLA', 'AGRO', 'AGROPECUARIA', 'ARGENTINA', 'LTDA', 'LIMITADA'
  ]);

  const words = clean
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0);

  if (words.length === 0) return 'LT';

  const palabrasPrincipales = words.filter((w) => !palabrasDescartables.has(w.toUpperCase()));
  const listaAUsar = palabrasPrincipales.length > 0 ? palabrasPrincipales : words;

  if (listaAUsar.length >= 2) {
    return (listaAUsar[0][0] + listaAUsar[1][0]).toUpperCase();
  }
  return listaAUsar[0][0].toUpperCase();
};

/**
 * Formatea un número de lote con su prefijo en formato mínimo de 2 dígitos.
 * Ej: ER + 1 => ER01, ER + 2 => ER02, SD + 1 => SD01, S + 1 => S01, P + 1 => P01
 */
export const formatLoteNro = (prefijo: string, numero: number): string => {
  const cleanPrefijo = (prefijo || 'LT').toUpperCase().trim();
  const safeNum = Math.max(1, Math.floor(numero));
  const numStr = safeNum < 10 ? `0${safeNum}` : `${safeNum}`;
  return `${cleanPrefijo}${numStr}`;
};

/**
 * Extrae el valor numérico secuencial de un número o identificador de lote.
 * Da prioridad a secuencias numéricas asociadas al prefijo y descarta años tipo 2024-2030 si existen números de lote menores.
 */
export const extractLoteNumber = (loteNroStr?: string | null, prefijo?: string): number | null => {
  if (!loteNroStr || typeof loteNroStr !== 'string') return null;
  const clean = loteNroStr.trim();
  if (!clean) return null;

  // 1. Coincidencia directa con el prefijo esperado (ej: ER01, ER-02, ER 03)
  if (prefijo) {
    const regexPref = new RegExp(`^${prefijo}[-_\\s]?(\\d+)`, 'i');
    const match = clean.match(regexPref);
    if (match && match[1]) {
      const n = parseInt(match[1], 10);
      if (!isNaN(n)) return n;
    }
  }

  // 2. Coincidencia con cualquier prefijo de letras seguido de dígitos (ej: SD01, S01, P01, ER02)
  const matchLetterNum = clean.match(/^[a-zA-Z]{1,4}[-_\\s]?(\d+)/);
  if (matchLetterNum && matchLetterNum[1]) {
    const n = parseInt(matchLetterNum[1], 10);
    if (!isNaN(n)) return n;
  }

  // 3. Buscar cualquier bloque de dígitos en la cadena (ej: 10FIN, 03TRA, L-1002)
  const allMatches = clean.match(/\d+/g);
  if (!allMatches || allMatches.length === 0) return null;

  const nums = allMatches.map((m) => parseInt(m, 10)).filter((n) => !isNaN(n));
  if (nums.length === 0) return null;

  // Si hay años como 2020-2035 y otros números menores, descartar años
  const nonYearNums = nums.filter((n) => n < 2000 || n > 2099);
  if (nonYearNums.length > 0) {
    return Math.max(...nonYearNums);
  }

  return Math.max(...nums);
};

export interface CorrelatividadClienteInfo {
  cliente: string;
  prefijo: string;
  totalLotesCliente: number;
  loteMasAlto: Lote | null;
  loteMasAltoNro: string | null;
  numeroMasAlto: number;
  proximoNumero: number;
  proximoLoteNro: string;
  lotesDelCliente: Lote[];
}

/**
 * Calcula la correlatividad de lotes para un cliente dado según el historial de lotes existentes:
 * - Encuentra el lote con el número más alto asignado al cliente (NO por fecha).
 * - Calcula el próximo número correlativo (+1) con las iniciales del cliente.
 */
export const getCorrelatividadCliente = (
  clienteNombre: string,
  lotes: Lote[]
): CorrelatividadClienteInfo => {
  const cleanCliente = (clienteNombre || '').trim();
  const prefijo = getClientePrefijo(cleanCliente);

  if (!cleanCliente) {
    return {
      cliente: '',
      prefijo,
      totalLotesCliente: 0,
      loteMasAlto: null,
      loteMasAltoNro: null,
      numeroMasAlto: 0,
      proximoNumero: 1,
      proximoLoteNro: formatLoteNro(prefijo, 1),
      lotesDelCliente: [],
    };
  }

  // Filtrar los lotes del cliente de forma insensible a mayúsculas
  const lotesDelCliente = (lotes || []).filter((l) => {
    if (!l.cliente) return false;
    const cl = l.cliente.trim().toLowerCase();
    const target = cleanCliente.toLowerCase();
    return cl === target || cl.includes(target) || target.includes(cl);
  });

  let numeroMasAlto = 0;
  let loteMasAlto: Lote | null = null;

  lotesDelCliente.forEach((l) => {
    const num = extractLoteNumber(l.loteNro, prefijo);
    if (num !== null && num > numeroMasAlto) {
      numeroMasAlto = num;
      loteMasAlto = l;
    }
  });

  const proximoNumero = numeroMasAlto + 1;
  const proximoLoteNro = formatLoteNro(prefijo, proximoNumero);

  return {
    cliente: cleanCliente,
    prefijo,
    totalLotesCliente: lotesDelCliente.length,
    loteMasAlto,
    loteMasAltoNro: loteMasAlto ? loteMasAlto.loteNro : null,
    numeroMasAlto,
    proximoNumero,
    proximoLoteNro,
    lotesDelCliente,
  };
};
