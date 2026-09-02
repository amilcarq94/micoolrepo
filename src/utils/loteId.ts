/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Genera de forma unívoca y canónica el ID de un lote para Firestore y trazabilidad.
 * Formato estándar: `${clienteSanitizado}_${loteNroNormalizado}`
 * 
 * Garantiza coincidencia exacta entre el ID persistido en Firestore
 * y el ID codificado en el código QR de trazabilidad impreso.
 */
export const generarLoteId = (cliente: string, loteNro: string): string => {
  const safeCliente = (cliente || 'Sin_Cliente').trim().replace(/\s+/g, '_');
  const safeLoteNro = (loteNro || 'S/N').trim();
  return `${safeCliente}_${safeLoteNro}`;
};
