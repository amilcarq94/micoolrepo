import { Chofer } from '../types';

/**
 * Normaliza una cadena quitando tildes, espacios extra y convirtiendo a minúsculas
 */
export function normalizeStr(str?: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Normaliza CUIT o DNI dejando únicamente los dígitos
 */
export function normalizeCuit(cuit?: string): string {
  if (!cuit) return '';
  return cuit.replace(/\D/g, '');
}

/**
 * Busca si un chofer ya existe en la lista por ID, CUIT/DNI o Nombre
 */
export function findExistingChofer(
  candidate: { id?: string; nombre?: string; cuit?: string },
  choferes: Chofer[]
): Chofer | undefined {
  if (!choferes || choferes.length === 0) return undefined;

  // 1. Coincidencia por ID explícito
  if (candidate.id) {
    const byId = choferes.find((c) => c.id === candidate.id);
    if (byId) return byId;
  }

  // 2. Coincidencia por CUIT / DNI si es válido y no '—'
  const normCuitCandidate = normalizeCuit(candidate.cuit);
  if (normCuitCandidate && normCuitCandidate !== '0') {
    const byCuit = choferes.find((c) => {
      const normC = normalizeCuit(c.cuit);
      return normC && normC !== '0' && normC === normCuitCandidate;
    });
    if (byCuit) return byCuit;
  }

  // 3. Coincidencia por Nombre (normalizado)
  const normNombreCandidate = normalizeStr(candidate.nombre);
  if (normNombreCandidate) {
    const byNombre = choferes.find(
      (c) => normalizeStr(c.nombre) === normNombreCandidate
    );
    if (byNombre) return byNombre;
  }

  return undefined;
}

/**
 * Fusiona los datos de un chofer sin sobreescribir campos completos existentes con datos vacíos o por defecto.
 */
export function mergeChoferData(
  existing: Chofer | undefined,
  incoming: Partial<Chofer> & { nombre: string }
): Chofer {
  const id = existing?.id || incoming.id || `CHOFER-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const chasis = (incoming.patenteChasis || incoming.patenteCamion || existing?.patenteChasis || existing?.patenteCamion || '').trim().toUpperCase();
  const acoplado = (incoming.patenteAcoplado || existing?.patenteAcoplado || '').trim().toUpperCase();

  return {
    id,
    nombre: (incoming.nombre || existing?.nombre || '').trim(),
    cuit: (incoming.cuit || existing?.cuit || '').trim(),
    transporte: (incoming.transporte || existing?.transporte || '').trim(),
    patenteChasis: chasis,
    patenteAcoplado: acoplado,
    patenteCamion: chasis,
    patentes: acoplado ? `${chasis} / ${acoplado}` : chasis,
  };
}
