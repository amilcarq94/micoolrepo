/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  TurnoParking,
  ParkingConfig,
  PrecargaDespacho,
  OrdenCarga,
  FranjaTurno,
  Lote
} from '../types';
import { EMAILS_NOTIFICACION_PARKING } from './parkingAuth';
import { formatDateStr } from './formatters';

export const DEFAULT_HORARIOS_MANANA = ["07:00 hs", "08:30 hs", "10:30 hs"];
export const DEFAULT_HORARIOS_TARDE = ["13:30 hs", "15:30 hs", "17:30 hs"];

const LOCAL_STORAGE_TURNOS_KEY = 'agro_parking_turnos_list';
const LOCAL_STORAGE_CONFIG_KEY = 'agro_parking_config_data';

export const DEFAULT_PARKING_CONFIG: ParkingConfig = {
  horariosManana: [...DEFAULT_HORARIOS_MANANA],
  horariosTarde: [...DEFAULT_HORARIOS_TARDE],
  turnosBloqueadosGlobal: {},
  updatedAt: new Date().toISOString(),
  updatedBy: 'Sistema'
};

/**
 * Obtiene la configuración actual de horarios y bloqueos de Parking
 */
export function getSavedParkingConfig(): ParkingConfig {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        horariosManana: Array.isArray(parsed.horariosManana) && parsed.horariosManana.length > 0
          ? parsed.horariosManana
          : [...DEFAULT_HORARIOS_MANANA],
        horariosTarde: Array.isArray(parsed.horariosTarde) && parsed.horariosTarde.length > 0
          ? parsed.horariosTarde
          : [...DEFAULT_HORARIOS_TARDE],
        turnosBloqueadosGlobal: parsed.turnosBloqueadosGlobal || {},
        updatedAt: parsed.updatedAt,
        updatedBy: parsed.updatedBy
      };
    }
  } catch (e) {
    console.error('Error al leer configuración de parking:', e);
  }
  return { ...DEFAULT_PARKING_CONFIG };
}

/**
 * Guarda la configuración de horarios y bloqueos en LocalStorage
 */
export function saveLocalParkingConfig(config: ParkingConfig): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Error al guardar configuración de parking:', e);
  }
}

/**
 * Obtiene la lista local de turnos guardados
 */
export function getLocalTurnos(): TurnoParking[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_TURNOS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error al leer turnos locales:', e);
  }
  return [];
}

/**
 * Guarda la lista de turnos en LocalStorage
 */
export function saveLocalTurnos(turnos: TurnoParking[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_TURNOS_KEY, JSON.stringify(turnos));
  } catch (e) {
    console.error('Error al guardar turnos locales:', e);
  }
}

/**
 * Evalúa si una fecha y franja están operativamente habilitadas.
 * - Lunes a Viernes: Mañana y Tarde.
 * - Sábados: Solo Mañana.
 * - Domingos: Cerrado.
 */
export function isDayAllowedForFranja(
  dateStr: string,
  franja: FranjaTurno
): { allowed: boolean; reason?: string } {
  if (!dateStr) return { allowed: false, reason: 'Fecha inválida' };

  // Crear fecha en zona horaria local segura evitando desfase UTC
  const [year, month, day] = dateStr.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  const dayOfWeek = dateObj.getDay(); // 0 = Domingo, 6 = Sábado

  if (dayOfWeek === 0) {
    return {
      allowed: false,
      reason: 'Domingos cerrado: No se realizan despachos en planta.'
    };
  }

  if (dayOfWeek === 6 && franja === 'TARDE') {
    return {
      allowed: false,
      reason: 'Sábados solo turno mañana: Franja de la tarde cerrada.'
    };
  }

  return { allowed: true };
}

export interface SlotTurnoView {
  idSlot: string; // ej: `${fecha}_${horario}`
  horario: string;
  franja: FranjaTurno;
  isOperativoDia: boolean;
  motivoNoOperativo?: string;
  isBloqueadoAdmin: boolean;
  motivoBloqueoAdmin?: string;
  bloqueadoPorAdmin?: string;
  turnoReservado?: TurnoParking;
  isDisponible: boolean;
}

/**
 * Genera la matriz de turnos para una fecha específica evaluando reglas operativas,
 * configuración de administradores y reservas existentes.
 */
export function buildSlotsForDate(
  dateStr: string,
  turnosExistentes: TurnoParking[],
  config: ParkingConfig
): { manana: SlotTurnoView[]; tarde: SlotTurnoView[] } {
  const checkManana = isDayAllowedForFranja(dateStr, 'MANANA');
  const checkTarde = isDayAllowedForFranja(dateStr, 'TARDE');

  // Filtrar turnos activos para esta fecha
  const turnosDelDia = turnosExistentes.filter(
    (t) => t.fecha === dateStr && t.estado !== 'CANCELADO'
  );

  const buildSlot = (horario: string, franja: FranjaTurno, dayCheck: { allowed: boolean; reason?: string }): SlotTurnoView => {
    const slotKey = `${dateStr}_${horario}`;
    const motivoBloqueoGlobal = config.turnosBloqueadosGlobal[slotKey];
    const turnoReservado = turnosDelDia.find(
      (t) => t.horario === horario && t.franja === franja && (t.estado === 'RESERVADO' || t.estado === 'COMPLETADO')
    );
    const turnoBloqueadoDoc = turnosDelDia.find(
      (t) => t.horario === horario && t.franja === franja && t.estado === 'BLOQUEADO'
    );

    const isBloqueadoAdmin = Boolean(motivoBloqueoGlobal || turnoBloqueadoDoc);
    const motivoBloqueoAdmin = motivoBloqueoGlobal || turnoBloqueadoDoc?.motivoBloqueo || 'Bloqueado por Administración de Planta';
    const bloqueadoPorAdmin = turnoBloqueadoDoc?.bloqueadoPor || config.updatedBy || 'Administración';

    const isDisponible =
      dayCheck.allowed &&
      !isBloqueadoAdmin &&
      !turnoReservado;

    return {
      idSlot: slotKey,
      horario,
      franja,
      isOperativoDia: dayCheck.allowed,
      motivoNoOperativo: dayCheck.reason,
      isBloqueadoAdmin,
      motivoBloqueoAdmin,
      bloqueadoPorAdmin,
      turnoReservado,
      isDisponible
    };
  };

  const slotsManana = config.horariosManana.map((h) => buildSlot(h, 'MANANA', checkManana));
  const slotsTarde = config.horariosTarde.map((h) => buildSlot(h, 'TARDE', checkTarde));

  return { manana: slotsManana, tarde: slotsTarde };
}

/**
 * Genera el cuerpo y asunto del correo de notificación para los 4 administradores designados:
 * amilcar.quiroz@agroabacus.com.ar; malcon.baez@agroabacus.com.ar; franco.fal@agroabacus.com.ar; monica.bermudez@agroabacus.com.ar
 */
export function buildNotificationEmailData(
  turno: TurnoParking,
  ordenCargaId: string
): { to: string; subject: string; body: string; mailtoUrl: string } {
  const p = turno.precarga || {
    especie: '—',
    variedad: '—',
    tratamiento: '—',
    cantidadBolsas: 0,
    tipoEnvase: 'Big Bag',
    categoriaLote: '—',
    tipoLote: '—',
    numeroLote: '—',
    kgEstimados: 0,
    choferSugerido: '',
    patenteSugerida: '',
    observaciones: ''
  };

  const to = EMAILS_NOTIFICACION_PARKING.join(';');
  const subject = `[PARKING AGRO ABACUS] Turno Solicitado: ${turno.cliente} · ${formatDateStr(turno.fecha)} ${turno.horario}`;

  const detalleLotesTexto = p.lotesMultiples && p.lotesMultiples.length > 1
    ? `\nLOTES DE ORIGEN CARGADOS (${p.lotesMultiples.length} LOTES):\n` +
      p.lotesMultiples.map((item, idx) => `  ${idx + 1}. Lote N° ${item.numeroLote}: ${item.cantidadBolsas} bolsas | ${item.especie} (${item.variedad}) | ${item.tipoLote} · ${item.tratamiento} · Cat: ${item.categoriaLote}`).join('\n') + '\n'
    : `• Lote N°: ${p.numeroLote}\n• Especie: ${p.especie}\n• Variedad: ${p.variedad}\n• Tratamiento: ${p.tratamiento}\n• Categoría de Lote: ${p.categoriaLote}\n• Tipo de Lote: ${p.tipoLote}\n`;

  const body = `SOLICITUD DE TURNO DE DESPACHO - PARKING PLANTA LA BARRANCOSA
================================================================
DÍA: ${formatDateStr(turno.fecha)} (${turno.fecha})
TURNO: ${turno.horario} (Franja ${turno.franja === 'MANANA' ? 'Mañana' : 'Tarde'})
CLIENTE COMITENTE: ${turno.cliente}
DESPACHANTE SOLICITANTE: ${turno.despachante}

DATOS DE PRECARGA (ORDEN DE CARGA ASOCIADA: ${ordenCargaId})
----------------------------------------------------------------
${detalleLotesTexto}
• Cantidad Total de Bolsas: ${p.cantidadBolsas} bolsas
• Tipo de Envase: ${p.tipoEnvase}
• Kilos Totales Estimados: ${p.kgEstimados ? `${p.kgEstimados.toLocaleString('es-AR')} kg` : 'A definir por balanza'}
• Transporte / Chofer: ${p.choferSugerido || 'A designar en playa de carga'}
• Patente: ${p.patenteSugerida || 'A registrar'}
• Observaciones: ${p.observaciones || 'Sin observaciones'}

TURNO ID: ${turno.id}
FECHA REGISTRO: ${new Date().toLocaleString('es-AR')}
================================================================
Sistema de Parking y Despachos Agro Abacus S.A.`;

  const mailtoUrl = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return { to, subject, body, mailtoUrl };
}

/**
 * Construye una OrdenCarga lista para anexar al módulo de Despachos a partir del turno de Parking
 */
export function buildOrdenCargaFromTurno(
  turno: TurnoParking,
  lotesExistentes: Lote[] = []
): OrdenCarga {
  const p = turno.precarga || {
    especie: 'Soja',
    variedad: 'Sin Variedad',
    tratamiento: 'Sin Tratar',
    cantidadBolsas: 10,
    tipoEnvase: 'Big Bag 800 kg',
    categoriaLote: 'Original',
    tipoLote: 'Semilla',
    numeroLote: 'LOTE-PARKING',
    kgEstimados: 8000
  };

  // Buscar si el número de lote coincide con uno existente en la planta para vincular ID y ubicación
  const matchedLote = lotesExistentes.find(
    (l) =>
      (l.loteNro && l.loteNro.trim().toLowerCase() === p.numeroLote.trim().toLowerCase()) ||
      (l.id && l.id.trim().toLowerCase() === p.numeroLote.trim().toLowerCase())
  );

  const cleanLoteId = matchedLote ? matchedLote.id : `LOTE-${p.numeroLote.trim() || 'PARKING'}`;
  const kgCalculados = p.kgEstimados && p.kgEstimados > 0
    ? p.kgEstimados
    : p.cantidadBolsas * (matchedLote?.kgPorBolsa || (p.tipoEnvase.includes('40') ? 40 : 800));

  const year = new Date().getFullYear();
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const ordenId = `OC-${year}-${randomSuffix}`;

  // Si hay más de un lote de origen en la precarga, construir lotesOrigen
  const lotesOrigen = p.lotesMultiples && p.lotesMultiples.length > 1
    ? p.lotesMultiples.map((item) => {
        const matchItem = lotesExistentes.find(
          (l) =>
            (l.loteNro && l.loteNro.trim().toLowerCase() === item.numeroLote.trim().toLowerCase()) ||
            (l.id && l.id.trim().toLowerCase() === item.numeroLote.trim().toLowerCase())
        );
        const kgItem = item.kgEstimados && item.kgEstimados > 0
          ? item.kgEstimados
          : item.cantidadBolsas * (matchItem?.kgPorBolsa || (p.tipoEnvase.includes('40') ? 40 : 800));
        return {
          loteId: matchItem ? matchItem.id : item.numeroLote,
          loteNro: item.numeroLote,
          especie: item.especie,
          variedad: item.variedad,
          cantidadBolsas: Number(item.cantidadBolsas) || 0,
          kgTotales: kgItem,
          ubicacion: matchItem ? (matchItem.ubicacionAcopio || `Ala ${matchItem.ala || '—'} · Sector ${matchItem.sector || '—'}`) : 'Planta'
        };
      })
    : undefined;

  const nuevaOrden: OrdenCarga = {
    id: ordenId,
    fecha: turno.fecha,
    fechaCarga: turno.fecha,
    cliente: turno.cliente || 'San Diego Semillas',
    loteId: cleanLoteId,
    especie: p.especie,
    variedad: p.variedad,
    cantidadBolsas: Number(p.cantidadBolsas) || 0,
    kgTotales: kgCalculados,
    tipo: (p.tipoLote as any) || 'Semilla',
    categoria: (p.categoriaLote as any) || 'Original',
    tratamiento: (p.tratamiento as any) || 'Sin Tratar',
    despachante: turno.despachante || 'Despachante Parking',
    autor: 'Parking System',
    estado: 'Disponible',
    lotesOrigen: lotesOrigen,
    ubicacionLote: matchedLote ? (matchedLote.ubicacionAcopio || `Ala ${matchedLote.ala || '—'} · Sector ${matchedLote.sector || '—'}`) : 'Playa de Espera Parking',
    chofer: p.choferSugerido || '',
    remitoCliente: '',
    destino: '',
    stockDescontado: false,
    // Campos anexados específicos de Parking
    turnoParkingId: turno.id,
    turnoFecha: turno.fecha,
    turnoHorario: turno.horario,
    tipoEnvase: p.tipoEnvase,
    numeroLoteManual: p.numeroLote,
    precargaCompletada: true,
    choferSugerido: p.choferSugerido,
    patenteSugerida: p.patenteSugerida,
    observacionesParking: p.observaciones
  };

  return nuevaOrden;
}
