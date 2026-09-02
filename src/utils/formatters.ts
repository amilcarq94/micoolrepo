/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Formatea un número decimal con punto para miles y coma para decimales.
 * Ej: 4510.8 -> "4.510,8"
 */
export const formatNumberArg = (value: number, decimals: number = 1): string => {
  if (value === undefined || value === null || isNaN(value)) {
    return "0";
  }
  
  // Usamos el locale de Argentina o España para obtener separador de miles '.' y decimal ','
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
};

/**
 * Formatea peso en kg (con 1 decimal si tiene decimales, o entero si es redondo)
 */
export const formatKg = (kg: number): string => {
  // Si no tiene parte decimal significativa, mostrar sin decimales
  const decimals = kg % 1 === 0 ? 0 : 1;
  return `${formatNumberArg(kg, decimals)} kg`;
};

/**
 * Formatea bolsas (entero siempre)
 */
export const formatBolsas = (bolsas: number): string => {
  return `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(bolsas)} bolsas`;
};

/**
 * Convierte una fecha YYYY-MM-DD a DD/MM/AAAA
 */
export const formatDateStr = (dateStr: string): string => {
  if (!dateStr) return "-";
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr; // Devolver original si está mal
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
};

/**
 * Genera un ID de lote autoincremental basado en los lotes existentes
 */
export const generateLoteId = (existingIds: string[]): string => {
  const currentYear = new Date().getFullYear();
  const prefix = `LB-${currentYear}-`;
  
  // Filtrar los de este año
  const thisYearNumbers = existingIds
    .filter(id => id.startsWith(prefix))
    .map(id => {
      const parts = id.split('-');
      const numStr = parts[parts.length - 1];
      return parseInt(numStr, 10);
    })
    .filter(num => !isNaN(num));

  const nextNum = thisYearNumbers.length > 0 ? Math.max(...thisYearNumbers) + 1 : 1;
  return `${prefix}${String(nextNum).padStart(4, '0')}`;
};

/**
 * Genera un ID de remito autoincremental
 */
export const generateRemitoId = (existingIds: string[]): string => {
  const currentYear = new Date().getFullYear();
  const prefix = `REM-${currentYear}-`;
  
  const numbers = existingIds
    .filter(id => id.startsWith(prefix))
    .map(id => {
      const parts = id.split('-');
      const numStr = parts[parts.length - 1];
      return parseInt(numStr, 10);
    })
    .filter(num => !isNaN(num));

  const nextNum = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
  return `${prefix}${String(nextNum).padStart(4, '0')}`;
};
