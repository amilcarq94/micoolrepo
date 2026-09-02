/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MovimientoSilo, OfflinePendingIngreso } from '../types';

const OFFLINE_QUEUE_KEY = 'agro_abacus_offline_ingresos_queue';

/**
 * Obtiene la lista de ingresos pendientes de sincronizar.
 */
export function getOfflinePendingIngresos(): OfflinePendingIngreso[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('Error al leer cola offline:', e);
    return [];
  }
}

/**
 * Guarda un ingreso en la cola local de pendientes.
 */
export function savePendingOfflineIngreso(movimiento: MovimientoSilo): OfflinePendingIngreso {
  const item: OfflinePendingIngreso = {
    id: movimiento.id || `OFFLINE-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: Date.now(),
    movimiento: { ...movimiento, id: movimiento.id || `OFFLINE-${Date.now()}` },
    estado: 'PENDIENTE'
  };

  const queue = getOfflinePendingIngresos();
  // Evitar duplicados por ID
  const filtered = queue.filter(q => q.id !== item.id);
  const updated = [item, ...filtered];
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updated));

  return item;
}

/**
 * Elimina ingresos ya sincronizados de la cola local.
 */
export function removeOfflinePendingIngresos(ids: string[]) {
  try {
    const queue = getOfflinePendingIngresos();
    const updated = queue.filter(q => !ids.includes(q.id));
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Error al limpiar cola offline:', e);
  }
}

/**
 * Procesa la sincronización de la cola offline.
 */
export async function syncOfflineQueue(
  syncHandler: (movimiento: MovimientoSilo) => Promise<boolean>
): Promise<{ successCount: number; failedCount: number }> {
  const queue = getOfflinePendingIngresos();
  if (queue.length === 0) return { successCount: 0, failedCount: 0 };

  let successCount = 0;
  let failedCount = 0;
  const syncedIds: string[] = [];

  for (const item of queue) {
    try {
      const ok = await syncHandler(item.movimiento);
      if (ok) {
        successCount++;
        syncedIds.push(item.id);
      } else {
        failedCount++;
      }
    } catch (e) {
      console.error(`Error al sincronizar item offline ${item.id}:`, e);
      failedCount++;
    }
  }

  if (syncedIds.length > 0) {
    removeOfflinePendingIngresos(syncedIds);
  }

  return { successCount, failedCount };
}
