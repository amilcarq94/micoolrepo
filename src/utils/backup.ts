/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Lote, MovimientoSilo, SalidaRegistrada, OrdenCarga, OrdenProceso, Chofer, BolsonCampo, AuditLogEntry } from '../types';
import { getGlobalAuditLogs } from './auditLogger';

export interface FullDatabaseBackup {
  version: string;
  exportDate: string;
  source: string;
  data: {
    lotes: Lote[];
    salidas: SalidaRegistrada[];
    movimientosSilo: MovimientoSilo[];
    ordenesCarga: OrdenCarga[];
    ordenesProceso: OrdenProceso[];
    choferes: Chofer[];
    bolsones: BolsonCampo[];
    auditoria: AuditLogEntry[];
  };
}

const LAST_AUTO_BACKUP_KEY = 'agro_abacus_last_auto_backup_date';
const AUTO_BACKUP_STORAGE_KEY = 'agro_abacus_auto_backup_data';

/**
 * Genera el objeto de respaldo completo del sistema.
 */
export function generateSystemBackup(data: {
  lotes: Lote[];
  salidas: SalidaRegistrada[];
  movimientosSilo: MovimientoSilo[];
  ordenesCarga: OrdenCarga[];
  ordenesProceso: OrdenProceso[];
  choferes: Chofer[];
  bolsones: BolsonCampo[];
  auditoria?: AuditLogEntry[];
}): FullDatabaseBackup {
  return {
    version: '2.0.0',
    exportDate: new Date().toISOString(),
    source: 'Planta Clasificadora - Agro Abacus S.A.',
    data: {
      lotes: data.lotes || [],
      salidas: data.salidas || [],
      movimientosSilo: data.movimientosSilo || [],
      ordenesCarga: data.ordenesCarga || [],
      ordenesProceso: data.ordenesProceso || [],
      choferes: data.choferes || [],
      bolsones: data.bolsones || [],
      auditoria: data.auditoria || getGlobalAuditLogs()
    }
  };
}

/**
 * Descarga el archivo JSON de respaldo directamente al navegador del usuario.
 */
export function downloadBackupFile(backup: FullDatabaseBackup) {
  const jsonStr = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `backup_agro_abacus_planta_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Ejecuta el backup diario automático en storage si aún no se realizó hoy.
 */
export function checkAndRunDailyAutoBackup(data: {
  lotes: Lote[];
  salidas: SalidaRegistrada[];
  movimientosSilo: MovimientoSilo[];
  ordenesCarga: OrdenCarga[];
  ordenesProceso: OrdenProceso[];
  choferes: Chofer[];
  bolsones: BolsonCampo[];
}): boolean {
  try {
    const today = new Date().toISOString().split('T')[0];
    const lastBackupDate = localStorage.getItem(LAST_AUTO_BACKUP_KEY);

    if (lastBackupDate === today) {
      return false; // Ya se hizo hoy
    }

    if (data.lotes.length === 0 && data.movimientosSilo.length === 0) {
      return false; // Sin datos aún
    }

    const backup = generateSystemBackup(data);
    localStorage.setItem(AUTO_BACKUP_STORAGE_KEY, JSON.stringify(backup));
    localStorage.setItem(LAST_AUTO_BACKUP_KEY, today);
    return true;
  } catch (e) {
    console.warn('No se pudo completar el backup automático diario:', e);
    return false;
  }
}

/**
 * Obtiene la fecha del último backup automático guardado.
 */
export function getLastAutoBackupInfo(): { date: string | null; exists: boolean } {
  const lastDate = localStorage.getItem(LAST_AUTO_BACKUP_KEY);
  const exists = !!localStorage.getItem(AUTO_BACKUP_STORAGE_KEY);
  return { date: lastDate, exists };
}
