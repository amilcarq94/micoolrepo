import { SiloId, MovimientoSilo, CAPACIDAD_MAX_SILO } from '../types';

export interface SiloActiveData {
  siloId: SiloId;
  stockKg: number;
  cliente: string;
  especie: string;
  variedad: string;
  categoria: string;
  isEmpty: boolean;
}

export interface SiloFullInfo {
  siloId: SiloId;
  stockKg: number;
  stockTn: string;
  pctOcupacion: string;
  capacidadKg: number;
  capacidadTn: string;
  disponibleKg: number;
  disponibleTn: string;
  cliente: string;
  especie: string;
  variedad: string;
  categoria: string;
  humedad: string;
  isEmpty: boolean;
  totalIngresos: number;
  totalKgIngresados: number;
  totalKgEgresados: number;
  movimientos: MovimientoSilo[];
  ingresosActivos: MovimientoSilo[];
}

/**
 * Obtiene el resumen completo y detallado de un silo (stock, cliente, especie, variedad, humedad ponderada y movimientos).
 */
export function getSiloDetailedInfo(siloId: SiloId, movimientosSilo: MovimientoSilo[] = []): SiloFullInfo {
  const movsAsc = (movimientosSilo || [])
    .filter((m) => m.siloId === siloId)
    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime() || (a.id || '').localeCompare(b.id || ''));

  let currentBalance = 0;
  let lastZeroIndex = -1;
  movsAsc.forEach((m, idx) => {
    if (m.tipo === 'INGRESO') {
      currentBalance += m.kg;
    } else if (m.tipo === 'EGRESO_OP' || (m.tipo as string).startsWith('EGRESO')) {
      currentBalance = Math.max(0, currentBalance - m.kg);
    } else if (m.tipo === 'AJUSTE_ZERO') {
      currentBalance = 0;
    }

    // Punto de corte: AJUSTE_ZERO o EGRESO_MANUAL por descontaminación varietal
    if (m.tipo === 'AJUSTE_ZERO' || (m.tipo === 'EGRESO_MANUAL' && m.descontaminacionVarietal)) {
      lastZeroIndex = idx;
    }
  });

  const movsBatchActual = movsAsc.slice(lastZeroIndex + 1);
  const ingresosBatchActual = movsBatchActual.filter((m) => m.tipo === 'INGRESO');
  const egresosBatchActual = movsBatchActual.filter((m) => m.tipo === 'EGRESO_OP' || (m.tipo as string).startsWith('EGRESO'));

  const capacidadKg = CAPACIDAD_MAX_SILO;
  const capacidadTn = (capacidadKg / 1000).toFixed(1);
  const stockTn = (currentBalance / 1000).toFixed(1);
  const pctOcupacion = ((currentBalance / capacidadKg) * 100).toFixed(1);
  const disponibleKg = Math.max(0, capacidadKg - currentBalance);
  const disponibleTn = (disponibleKg / 1000).toFixed(1);

  if (currentBalance <= 0 || ingresosBatchActual.length === 0) {
    return {
      siloId,
      stockKg: 0,
      stockTn: '0.0',
      pctOcupacion: '0.0',
      capacidadKg,
      capacidadTn,
      disponibleKg: capacidadKg,
      disponibleTn: capacidadTn,
      cliente: 'Sin asignación',
      especie: 'Sin Cereal / Vacío',
      variedad: '-',
      categoria: '-',
      humedad: '0.0',
      isEmpty: true,
      totalIngresos: 0,
      totalKgIngresados: 0,
      totalKgEgresados: 0,
      movimientos: [...movsAsc].reverse(),
      ingresosActivos: [],
    };
  }

  const especiesSet = Array.from(new Set(ingresosBatchActual.map((i) => i.especie).filter(Boolean)));
  const clientesSet = Array.from(new Set(ingresosBatchActual.map((i) => i.cliente).filter(Boolean)));
  const variedadesSet = Array.from(new Set(ingresosBatchActual.map((i) => i.variedad).filter(Boolean)));
  const categoriasSet = Array.from(new Set(ingresosBatchActual.map((i) => i.categoria).filter(Boolean)));

  const totalKgIngresados = ingresosBatchActual.reduce((acc, m) => acc + m.kg, 0);
  const totalKgEgresados = egresosBatchActual.reduce((acc, m) => acc + m.kg, 0);

  let totalKgConHumedad = 0;
  let sumaHumedadPonderada = 0;
  ingresosBatchActual.forEach((ing) => {
    if (ing.humedad !== undefined && ing.humedad > 0) {
      totalKgConHumedad += ing.kg;
      sumaHumedadPonderada += ing.kg * ing.humedad;
    }
  });

  const ultIngresoBatch = ingresosBatchActual[ingresosBatchActual.length - 1];
  const humedadPromedio =
    totalKgConHumedad > 0
      ? (sumaHumedadPonderada / totalKgConHumedad).toFixed(1)
      : ultIngresoBatch?.humedad !== undefined
      ? ultIngresoBatch.humedad.toFixed(1)
      : '13.5';

  return {
    siloId,
    stockKg: currentBalance,
    stockTn,
    pctOcupacion,
    capacidadKg,
    capacidadTn,
    disponibleKg,
    disponibleTn,
    cliente: clientesSet.length > 0 ? clientesSet.join(', ') : 'Sin asignación',
    especie: especiesSet.length > 0 ? especiesSet.join(', ') : 'Sin Cereal / Vacío',
    variedad: variedadesSet.length > 0 ? variedadesSet.join(', ') : '-',
    categoria: categoriasSet.length > 0 ? categoriasSet.join(', ') : '-',
    humedad: humedadPromedio,
    isEmpty: false,
    totalIngresos: ingresosBatchActual.length,
    totalKgIngresados,
    totalKgEgresados,
    movimientos: [...movsAsc].reverse(),
    ingresosActivos: [...ingresosBatchActual].reverse(),
  };
}

/**
 * Obtiene el resumen de datos activos (último lote de stock cargado) de un silo.
 */
export function getSiloActiveData(siloId: SiloId, movimientosSilo: MovimientoSilo[] = []): SiloActiveData {
  const movsAsc = (movimientosSilo || [])
    .filter((m) => m.siloId === siloId)
    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

  let currentBalance = 0;
  let lastZeroIndex = -1;
  movsAsc.forEach((m, idx) => {
    if (m.tipo === 'INGRESO') {
      currentBalance += m.kg;
    } else if (m.tipo === 'EGRESO_OP' || (m.tipo as string).startsWith('EGRESO')) {
      currentBalance = Math.max(0, currentBalance - m.kg);
    } else if (m.tipo === 'AJUSTE_ZERO') {
      currentBalance = 0;
    }

    // Punto de corte: AJUSTE_ZERO o EGRESO_MANUAL por descontaminación varietal
    if (m.tipo === 'AJUSTE_ZERO' || (m.tipo === 'EGRESO_MANUAL' && m.descontaminacionVarietal)) {
      lastZeroIndex = idx;
    }
  });

  const movsBatchActual = movsAsc.slice(lastZeroIndex + 1);
  const ingresosBatchActual = movsBatchActual.filter((m) => m.tipo === 'INGRESO');

  if (currentBalance <= 0 || ingresosBatchActual.length === 0) {
    return {
      siloId,
      stockKg: 0,
      cliente: 'Sin asignación',
      especie: 'Sin Cereal / Vacío',
      variedad: '-',
      categoria: '-',
      isEmpty: true,
    };
  }

  const especiesSet = Array.from(new Set(ingresosBatchActual.map((i) => i.especie).filter(Boolean)));
  const clientesSet = Array.from(new Set(ingresosBatchActual.map((i) => i.cliente).filter(Boolean)));
  const variedadesSet = Array.from(new Set(ingresosBatchActual.map((i) => i.variedad).filter(Boolean)));
  const categoriasSet = Array.from(new Set(ingresosBatchActual.map((i) => i.categoria).filter(Boolean)));

  return {
    siloId,
    stockKg: currentBalance,
    cliente: clientesSet.length > 0 ? clientesSet.join(', ') : 'Sin asignación',
    especie: especiesSet.length > 0 ? especiesSet.join(', ') : 'Sin Cereal / Vacío',
    variedad: variedadesSet.length > 0 ? variedadesSet.join(', ') : '-',
    categoria: categoriasSet.length > 0 ? categoriasSet.join(', ') : '-',
    isEmpty: false,
  };
}

export interface SiloMatchResult {
  valid: boolean;
  errorMessage?: string;
  siloData?: SiloActiveData;
}

/**
 * Valida que el Cliente, Especie y Variedad del lote coincidan exactamente con los del Silo de Origen.
 */
export function validateSiloLoteMatch(
  siloId: SiloId,
  lote: { cliente?: string; especie?: string; variedad?: string },
  movimientosSilo: MovimientoSilo[] = []
): SiloMatchResult {
  const siloData = getSiloActiveData(siloId, movimientosSilo);

  if (siloData.isEmpty || siloData.stockKg <= 0) {
    return {
      valid: false,
      errorMessage: `El ${siloId} se encuentra vacío o sin stock disponible para vincular.`,
      siloData
    };
  }

  const norm = (str?: string) => (str || '').trim().toLowerCase();

  const loteCliente = (lote.cliente || '').trim();
  const loteEspecie = (lote.especie || '').trim();
  const loteVariedad = (lote.variedad || '').trim();

  const matchCliente = norm(siloData.cliente) === norm(loteCliente);
  const matchEspecie = norm(siloData.especie) === norm(loteEspecie);
  const matchVariedad = norm(siloData.variedad) === norm(loteVariedad);

  if (!matchCliente || !matchEspecie || !matchVariedad) {
    const diferencias: string[] = [];
    if (!matchCliente) diferencias.push(`Cliente: Silo "${siloData.cliente}" ≠ Lote "${loteCliente || 'Sin asignar'}"`);
    if (!matchEspecie) diferencias.push(`Especie: Silo "${siloData.especie}" ≠ Lote "${loteEspecie || 'Sin asignar'}"`);
    if (!matchVariedad) diferencias.push(`Variedad: Silo "${siloData.variedad}" ≠ Lote "${loteVariedad || 'Sin asignar'}"`);

    return {
      valid: false,
      errorMessage: `No se puede vincular el ${siloId} por diferencia en los orígenes vinculantes (Cliente / Especie / Variedad).\n${diferencias.join(' | ')}`,
      siloData
    };
  }

  return { valid: true, siloData };
}

/**
 * Valida que el Cliente, Especie y Variedad de un nuevo Ingreso coincidan exactamente con los del Silo de destino.
 */
export function validateSiloIngresoMatch(
  siloId: SiloId,
  ingreso: { cliente?: string; especie?: string; variedad?: string; categoria?: string },
  movimientosSilo: MovimientoSilo[] = []
): SiloMatchResult {
  const siloData = getSiloActiveData(siloId, movimientosSilo);

  // Si el silo está vacío, el ingreso es válido (se inicia un nuevo lote)
  if (siloData.isEmpty || siloData.stockKg <= 0) {
    return {
      valid: true,
      siloData
    };
  }

  const norm = (str?: string) => (str || '').trim().toLowerCase();

  const ingresoCliente = (ingreso.cliente || '').trim();
  const ingresoEspecie = (ingreso.especie || '').trim();
  const ingresoVariedad = (ingreso.variedad || '').trim();
  // La categoría también se valida si el silo ya tiene una asignada
  const ingresoCategoria = (ingreso.categoria || '').trim();

  const matchCliente = norm(siloData.cliente) === norm(ingresoCliente);
  const matchEspecie = norm(siloData.especie) === norm(ingresoEspecie);
  const matchVariedad = norm(siloData.variedad) === norm(ingresoVariedad);
  
  // Validación de Categoría (solo si el silo ya tiene una categoría definida distinta de '-')
  let matchCategoria = true;
  if (siloData.categoria && siloData.categoria !== '-') {
    matchCategoria = norm(siloData.categoria) === norm(ingresoCategoria);
  }

  if (!matchCliente || !matchEspecie || !matchVariedad || !matchCategoria) {
    const diferencias: string[] = [];
    if (!matchCliente) diferencias.push(`Cliente: Silo "${siloData.cliente}" ≠ Ingreso "${ingresoCliente || 'Sin asignar'}"`);
    if (!matchEspecie) diferencias.push(`Especie: Silo "${siloData.especie}" ≠ Ingreso "${ingresoEspecie || 'Sin asignar'}"`);
    if (!matchVariedad) diferencias.push(`Variedad: Silo "${siloData.variedad}" ≠ Ingreso "${ingresoVariedad || 'Sin asignar'}"`);
    if (!matchCategoria) diferencias.push(`Categoría: Silo "${siloData.categoria}" ≠ Ingreso "${ingresoCategoria || 'Sin asignar'}"`);

    return {
      valid: false,
      errorMessage: `¡ALERTA DE CONTAMINACIÓN! No se puede ingresar la mercadería al ${siloId} por diferencia en los datos de origen.\n${diferencias.join(' | ')}\n\nDebe realizar una "Limpieza de Descarte" para vaciar el silo antes de ingresar un nuevo producto.`,
      siloData
    };
  }

  return { valid: true, siloData };
}
