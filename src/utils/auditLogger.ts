/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuditLogEntry } from '../types';

const AUDIT_STORAGE_KEY = 'agro_abacus_global_audit_logs';

/**
 * Recupera el registro global de auditoría guardado localmente.
 */
export function getGlobalAuditLogs(): AuditLogEntry[] {
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('Error al leer logs de auditoría:', e);
    return [];
  }
}

/**
 * Guarda una nueva entrada en el log global de auditoría.
 */
export function recordGlobalAuditLog(entry: Omit<AuditLogEntry, 'id' | 'fechaHora'> & { id?: string; fechaHora?: string }): AuditLogEntry {
  const fullEntry: AuditLogEntry = {
    id: entry.id || `AUD-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    fechaHora: entry.fechaHora || new Date().toISOString(),
    tipo: entry.tipo,
    usuario: entry.usuario,
    rol: entry.rol || 'Personal Planta',
    modulo: entry.modulo || 'SISTEMA',
    entidadId: entry.entidadId,
    descripcion: entry.descripcion,
    campoModificado: entry.campoModificado,
    valorAnterior: entry.valorAnterior,
    valorNuevo: entry.valorNuevo,
    detalles: entry.detalles
  };

  try {
    const current = getGlobalAuditLogs();
    const updated = [fullEntry, ...current].slice(0, 1000); // Mantener hasta 1000 registros
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('No se pudo persistir la auditoría global:', e);
  }

  return fullEntry;
}

/**
 * Helper para generar el detalle formateado de cambios manuales:
 * "campo: valor_anterior -> valor_nuevo"
 */
export function createEditAuditDetails(cambios: { campo: string; antes: any; despues: any }[]): string {
  if (cambios.length === 0) return 'Sin cambios detectados en campos clave.';
  return cambios
    .map(c => `• ${c.campo}: "${c.antes ?? '—'}" ➔ "${c.despues ?? '—'}"`)
    .join('\n');
}
