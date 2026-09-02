/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Campania {
  id: string; // ej: "2026-2027"
  nombre: string; // ej: "Campaña 2026-2027"
  fechaInicio: string; // YYYY-MM-DD "2026-07-01"
  fechaFin: string; // YYYY-MM-DD "2027-06-30"
}

// Lista oficial de campañas precargadas
export const CAMPAANIAS_PRECARGADAS: Campania[] = [
  { id: '2025-2026', nombre: 'Campaña 2025-2026', fechaInicio: '2025-07-01', fechaFin: '2026-06-30' },
  { id: '2026-2027', nombre: 'Campaña 2026-2027', fechaInicio: '2026-07-01', fechaFin: '2027-06-30' },
  { id: '2027-2028', nombre: 'Campaña 2027-2028', fechaInicio: '2027-07-01', fechaFin: '2028-06-30' },
  { id: '2028-2029', nombre: 'Campaña 2028-2029', fechaInicio: '2028-07-01', fechaFin: '2029-06-30' },
  { id: '2029-2030', nombre: 'Campaña 2029-2030', fechaInicio: '2029-07-01', fechaFin: '2030-06-30' },
  { id: '2030-2031', nombre: 'Campaña 2030-2031', fechaInicio: '2030-07-01', fechaFin: '2031-06-30' },
];

const LOCAL_STORAGE_KEY = 'agro_abacus_active_campania';

/**
 * Calcula el ID de campaña (ej: "2026-2027") para cualquier fecha dada.
 * Regla oficial: Cada campaña cubre el período 01/07/AÑO al 30/06/AÑO+1.
 * @param dateStr String ISO/YYYY-MM-DD o Date objeto
 */
export function getCampaniaIdFromDate(dateStr?: string | Date): string {
  if (!dateStr) {
    return getCampaniaIdFromDate(new Date());
  }

  let dateObj: Date;
  if (typeof dateStr === 'string') {
    const cleanDate = dateStr.slice(0, 10);
    const [year, month, day] = cleanDate.split('-').map(Number);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      dateObj = new Date(year, month - 1, day);
    } else {
      dateObj = new Date(dateStr);
    }
  } else {
    dateObj = dateStr;
  }

  if (isNaN(dateObj.getTime())) {
    dateObj = new Date();
  }

  const y = dateObj.getFullYear();
  const m = dateObj.getMonth() + 1; // 1..12

  // Del 1 de Julio (mes 7) al 31 de Diciembre (mes 12)
  if (m >= 7) {
    return `${y}-${y + 1}`;
  } else {
    return `${y - 1}-${y}`;
  }
}

/**
 * Retorna el nombre formateado de la campaña dada (ej: "2026-2027" -> "Campaña 2026-2027")
 */
export function getNombreCampania(campaniaId: string): string {
  if (!campaniaId) return 'Sin Campaña';
  if (campaniaId === 'TODAS') return 'Todas las Campañas';
  return `Campaña ${campaniaId}`;
}

/**
 * Obtiene la campaña activa desde localStorage o calcula la vigente por fecha actual.
 */
export function getActiveCampaniaIdStored(): string {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved && saved.trim()) {
      return saved.trim();
    }
  } catch (e) {
    console.warn('No se pudo acceder a localStorage para la campaña activa', e);
  }
  // Sugerir la campaña vigente automáticamente según la fecha actual
  return getCampaniaIdFromDate(new Date());
}

/**
 * Guarda la campaña activa fijada en localStorage.
 */
export function setActiveCampaniaIdStored(campaniaId: string): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, campaniaId);
  } catch (e) {
    console.warn('No se pudo guardar la campaña activa en localStorage', e);
  }
}

/**
 * Retorna una lista unificada de campañas disponibles, combinando las precargadas
 * y cualquier otra encontrada en los datos cargados.
 */
export function getCampaniasDisponibles(existingCampaniasIds: string[] = []): Campania[] {
  const map = new Map<string, Campania>();

  // Cargar precargadas
  CAMPAANIAS_PRECARGADAS.forEach((c) => map.set(c.id, c));

  // Cargar cualquier otra id existente no precargada
  existingCampaniasIds.forEach((id) => {
    if (id && id !== 'TODAS' && !map.has(id)) {
      const parts = id.split('-');
      if (parts.length === 2) {
        const startY = parseInt(parts[0], 10);
        const endY = parseInt(parts[1], 10);
        if (!isNaN(startY) && !isNaN(endY)) {
          map.set(id, {
            id,
            nombre: `Campaña ${id}`,
            fechaInicio: `${startY}-07-01`,
            fechaFin: `${endY}-06-30`
          });
        }
      } else {
        map.set(id, {
          id,
          nombre: `Campaña ${id}`,
          fechaInicio: '',
          fechaFin: ''
        });
      }
    }
  });

  return Array.from(map.values()).sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Dada una campaña (ej: "2026-2027"), retorna el ID de la campaña inmediatamente anterior (ej: "2025-2026").
 */
export function getPreviousCampaniaId(campaniaId: string): string {
  if (!campaniaId || campaniaId === 'TODAS') return '';
  const parts = campaniaId.split('-');
  if (parts.length === 2) {
    const startY = parseInt(parts[0], 10);
    const endY = parseInt(parts[1], 10);
    if (!isNaN(startY) && !isNaN(endY)) {
      return `${startY - 1}-${endY - 1}`;
    }
  }
  return '';
}

