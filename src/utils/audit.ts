import { Lote, AuditLogEntry } from '../types';

/**
 * Obtiene o inicializa la lista completa de eventos de auditoría para un lote.
 * Si el lote ya tiene eventos de auditoría registrados, los devuelve.
 * Si no los tiene, reconstruye el historial a partir de la creación y los movimientos históricos.
 */
export const getLoteAuditoria = (lote: Lote): AuditLogEntry[] => {
  if (lote.auditoria && lote.auditoria.length > 0) {
    return lote.auditoria;
  }

  const entries: AuditLogEntry[] = [
    {
      id: `AUD-CRE-${lote.id}`,
      // Usar la fecha de ingreso simulando un horario de mañana
      fechaHora: `${lote.fechaIngreso}T08:00:00.000Z`,
      tipo: 'Creación',
      usuario: 'Sistema (Carga Inicial)',
      descripcion: `Lote ${lote.id} registrado inicialmente para ${lote.cliente}.`,
      detalles: `Especie: ${lote.especie}, Variedad: ${lote.variedad}, Tipo: ${lote.tipo}, Peso por bolsa: ${lote.kgPorBolsa} kg.`
    }
  ];

  // Reconstruir entradas del historial de movimientos si existen
  if (lote.historial) {
    lote.historial.forEach((mov) => {
      // Evitamos registrar un log de stock redundante si es exactamente la "Carga de stock inicial" que ya cubrimos en el de Creación
      const esInicial = mov.detalle.toLowerCase().includes('carga de stock inicial') || 
                        mov.detalle.toLowerCase().includes('cosecha inicial') ||
                        mov.id === `AUD-CRE-${lote.id}`;
      
      if (!esInicial) {
        entries.push({
          id: `AUD-MOV-${mov.id}`,
          // Simulamos una hora un poco posterior para que se ordenen bien en la timeline
          fechaHora: `${mov.fecha}T10:00:00.000Z`,
          tipo: 'Stock',
          usuario: 'Operario de Planta',
          descripcion: `${mov.tipo}: ${mov.cantidadBolsas} b. (${mov.cantidadKg} kg).`,
          detalles: mov.detalle
        });
      }
    });
  }

  // Ordenar de más nuevo a más viejo por fecha y hora
  return entries.sort((a, b) => b.fechaHora.localeCompare(a.fechaHora));
};
