/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Lote } from '../types';

/**
 * Determina de forma exhaustiva si un lote fue originado a partir de un movimiento
 * de un lote preexistente (por ejemplo: desdoblamiento, curado/tratamiento parcial o total,
 * reclasificación cualitativa de tipo Intermedio a Final, cambio de envase, etc.).
 *
 * REGLA DE NEGOCIO (Reporte de Producción y Stock en Planta):
 * "No tomar movimientos con el origen de un lote nuevo, ya que el concepto de movimiento
 * se refiere a modificar datos de un lote que ya tiene origen. El movimiento solo da origen
 * a nuevos datos como por ejemplo: kg tratados o bolsas tipo final pero no son bolsas nuevas
 * producidas que aumenten la producción total, sino que toma un lote ya producido y realiza
 * cambios cualitativos."
 */
export function isLoteOriginadoPorMovimiento(lote: Lote | null | undefined): boolean {
  if (!lote) return false;

  // 1. Indicadores explícitos en el modelo de datos
  if (lote.esMovimiento === true) return true;
  if (typeof lote.loteOrigen === 'string' && lote.loteOrigen.trim() !== '' && lote.loteOrigen.trim() !== '-') {
    return true;
  }
  if (typeof lote.tipoMovimiento === 'string' && lote.tipoMovimiento.trim() !== '') {
    return true;
  }
  if (typeof lote.fechaRealizacionMovimiento === 'string' && lote.fechaRealizacionMovimiento.trim() !== '') {
    return true;
  }
  if (typeof lote.estadoMovimiento === 'string' && lote.estadoMovimiento.trim() !== '') {
    return true;
  }

  // 2. Patrones canónicos en la numeración del lote (MOV, -FIN, -TRA)
  const loteNroUpper = (lote.loteNro || '').toUpperCase().trim();
  if (
    loteNroUpper.includes('MOV') ||
    loteNroUpper.includes('-FIN') ||
    loteNroUpper.includes('-TRA') ||
    loteNroUpper.includes('_MOV')
  ) {
    return true;
  }

  // 3. Comprobación en observaciones registradas
  const obsLower = (lote.observaciones || '').toLowerCase();
  if (
    obsLower.includes('generado por movimiento') ||
    obsLower.includes('a partir de lote') ||
    obsLower.includes('a partir de l-') ||
    obsLower.includes('desde lote de origen') ||
    obsLower.includes('origen: curado parcial') ||
    obsLower.includes('desdoblamiento por curado')
  ) {
    return true;
  }

  // 4. Comprobación en historial: si la entrada inicial es un ingreso desde otro lote o movimiento
  if (Array.isArray(lote.historial) && lote.historial.length > 0) {
    const tieneEntradaDeOtroLote = lote.historial.some((m) => {
      if (!m) return false;
      const tipoLower = (m.tipo || '').toLowerCase();
      const detLower = (m.detalle || '').toLowerCase();
      const esEntrada =
        tipoLower.startsWith('entrada') ||
        tipoLower.startsWith('alta') ||
        tipoLower.startsWith('ingreso') ||
        tipoLower.startsWith('reingreso');
      if (!esEntrada) return false;

      return (
        tipoLower.includes('movimiento') ||
        detLower.includes('desde lote') ||
        detLower.includes('origen:') ||
        detLower.includes('por movimiento') ||
        detLower.includes('curado parcial de') ||
        detLower.includes('desdoblamiento') ||
        detLower.includes('lote origen') ||
        detLower.includes('lote de origen')
      );
    });

    if (tieneEntradaDeOtroLote) return true;
  }

  // 5. Comprobación en auditoría: creación por movimiento o desdoblamiento
  if (Array.isArray(lote.auditoria) && lote.auditoria.length > 0) {
    const tieneAuditOrigen = lote.auditoria.some((a) => {
      if (!a) return false;
      const descLower = (a.descripcion || '').toLowerCase();
      return (
        descLower.includes('creación por curado parcial') ||
        descLower.includes('generado por movimiento') ||
        descLower.includes('desdoblamiento por curado')
      );
    });
    if (tieneAuditOrigen) return true;
  }

  return false;
}

/**
 * Obtiene el identificador o número del lote de origen a partir de los datos o historial del lote.
 */
export function getLoteOrigenId(lote: Lote | null | undefined): string {
  if (!lote) return '';
  if (lote.loteOrigen && lote.loteOrigen.trim() !== '' && lote.loteOrigen.trim() !== '-') {
    return lote.loteOrigen.trim();
  }

  // Buscar en historial
  if (Array.isArray(lote.historial)) {
    for (const m of lote.historial) {
      if (!m || !m.detalle) continue;
      const match = m.detalle.match(/(?:desde lote|origen:|curado parcial de|a partir de)\s+([A-Za-z0-9\-_]+)/i);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
  }

  // Buscar en observaciones
  if (lote.observaciones) {
    const match = lote.observaciones.match(/(?:a partir de|origen:|desde lote)\s+([A-Za-z0-9\-_]+)/i);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return '';
}
