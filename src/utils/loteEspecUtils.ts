/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Lote,
  BolsaRegistro,
  CaratulaRegistro,
  EnvaseEspecificacion,
  CategoriaEspecificacion,
  TipoLoteEspecificacion,
  EstadoRegistroLoteEspec,
  TratamientoEspecificacion,
} from '../types';

/**
 * Retorna el peso numérico de un envase en kg:
 * - 'x 20 kg' => 20
 * - 'x 25 kg' => 25
 * - 'x 40 kg' => 40
 * - 'x 800 kg' => 800
 */
export function getKilajeEnvase(envase?: string | EnvaseEspecificacion | number): number {
  if (envase === undefined || envase === null) return 800;
  if (typeof envase === 'number') return envase;
  const s = String(envase).toLowerCase();
  if (s.includes('20')) return 20;
  if (s.includes('25')) return 25;
  if (s.includes('40')) return 40;
  if (s.includes('800')) return 800;
  return 800;
}

/**
 * Normaliza el string de envase al tipo estricto de la especificación:
 * "x 20 kg" | "x 25 kg" | "x 40 kg" | "x 800 kg"
 */
export function normalizarEnvase(envase?: string | number): EnvaseEspecificacion {
  const s = String(envase || '').toLowerCase();
  if (s.includes('20')) return 'x 20 kg';
  if (s.includes('25')) return 'x 25 kg';
  if (s.includes('40')) return 'x 40 kg';
  return 'x 800 kg';
}

/**
 * Normaliza la categoría al tipo estricto:
 * "preba" | "original" | "primu"
 */
export function normalizarCategoria(cat?: string): CategoriaEspecificacion {
  const s = String(cat || '').toLowerCase().trim();
  if (s.includes('preba') || s.includes('prebase') || s.includes('pre básica') || s.includes('pre basica') || s.includes('fundadora')) {
    return 'preba';
  }
  if (s.includes('orig')) return 'original';
  return 'primu';
}

/**
 * Normaliza el tipo de lote:
 * "intermedio" | "final"
 */
export function normalizarTipo(tipo?: string): TipoLoteEspecificacion {
  const s = String(tipo || '').toLowerCase().trim();
  if (s.includes('inter')) return 'intermedio';
  return 'final';
}

/**
 * Normaliza el tratamiento:
 * "sin curar" | "curado"
 * (Soporta compatibilidad con "crudo" y "sin tratar")
 */
export function normalizarTratamiento(trat?: any): TratamientoEspecificacion {
  if (!trat) return 'sin curar';
  let s = '';
  if (Array.isArray(trat)) {
    s = trat.map(t => String(t).toLowerCase()).join(' ');
  } else {
    s = String(trat).toLowerCase();
  }
  if (s.includes('curado') || (s.includes('tratado') && !s.includes('sin tratar') && !s.includes('sin curar'))) {
    return 'curado';
  }
  return 'sin curar';
}

/**
 * Normaliza el estado según especificación oficial:
 * "sin clasificar" | "clasificado" | "bloqueado" | "descartado"
 */
export function normalizarEstado(estado?: string, estadoRegistro?: string): EstadoRegistroLoteEspec {
  const s = String(estado || '').toLowerCase().trim();
  const reg = String(estadoRegistro || '').toLowerCase().trim();

  if (s === 'bloqueado' || reg === 'bloqueado') return 'bloqueado';
  if (s === 'descartado' || reg === 'descartado' || s === 'descarte') return 'descartado';
  if (s === 'clasificado' || reg === 'clasificado' || s === 'terminado' || reg === 'terminado') return 'clasificado';
  if (s === 'desdoblado' || reg === 'desdoblado') return 'desdoblado';
  if (s === 'agotado' || reg === 'agotado') return 'agotado';
  if (s === 'precarga' || reg === 'precarga' || reg === 'pre-carga') return 'precarga';
  if (s === 'en proceso' || reg === 'en proceso') return 'en proceso';
  return 'sin clasificar';
}

/**
 * Genera el ID oficial de una bolsa:
 * {codigoLote}-{nn}/{total}, ej: 0153-07/35
 */
export function formatBolsaId(codigoLote: string, numero: number, totalBolsas: number): string {
  const cleanCode = (codigoLote || 'LOTE').trim().toUpperCase().replace(/^LOTE\s*[:-]?\s*/i, '');
  const numPad = String(numero).padStart(2, '0');
  const totalPad = String(totalBolsas).padStart(2, '0');
  return `${cleanCode}-${numPad}/${totalPad}`;
}

/**
 * Genera el listado completo de registros de bolsas para un lote dado,
 * asegurando que cada bolsa posea todos sus atributos fijos.
 */
export function generarBolsasParaLote(
  lote: {
    id: string;
    codigo?: string;
    loteNro?: string;
    cantidadBolsas?: number;
    stockBolsas?: number;
    envase?: string | EnvaseEspecificacion;
    kgPorBolsa?: number;
    categoria?: string;
    tipo?: string;
    tratamiento?: any;
    producto?: string;
    estado?: string;
    estadoEspec?: string;
    estadoRegistro?: string;
    caratulaId?: string;
  },
  caratulaId: string,
  bolsasOrigenIds?: string[]
): BolsaRegistro[] {
  const total = Number(lote.cantidadBolsas) || Number(lote.stockBolsas) || 0;
  const kgEnvase = getKilajeEnvase(lote.envase || lote.kgPorBolsa);
  const envaseNorm = normalizarEnvase(lote.envase || lote.kgPorBolsa);
  const tipoNorm = normalizarTipo(lote.tipo);
  const catNorm = normalizarCategoria(lote.categoria);
  const tratNorm = normalizarTratamiento(lote.tratamiento);
  const estNorm = normalizarEstado(lote.estadoEspec || lote.estado, lote.estadoRegistro);
  const codigo = (lote.codigo || lote.loteNro || lote.id || 'LOTE').trim();

  const result: BolsaRegistro[] = [];
  for (let i = 1; i <= total; i++) {
    const id = formatBolsaId(codigo, i, total);
    result.push({
      id,
      loteId: lote.id,
      numero: i,
      totalBolsas: total,
      kg: kgEnvase,
      envase: envaseNorm,
      tipo: tipoNorm,
      categoria: catNorm,
      tratamiento: tratNorm,
      productoCurado: tratNorm === 'curado' ? (lote.producto || 'Curado general') : undefined,
      estado: estNorm,
      despachada: false,
      bolsaOrigenId: bolsasOrigenIds && bolsasOrigenIds[i - 1] ? bolsasOrigenIds[i - 1] : null,
      caratulaId
    });
  }
  return result;
}

/**
 * Obtiene o inicializa las bolsas asociadas al lote.
 * Si el lote ya tiene bolsas, las devuelve; sino las deriva a partir de los datos base del lote.
 */
export function getBolsasDeLote(lote: Lote): BolsaRegistro[] {
  if (lote.bolsas && Array.isArray(lote.bolsas) && lote.bolsas.length > 0) {
    return lote.bolsas;
  }
  return generarBolsasParaLote(lote, lote.caratulaId || `CARAT-${lote.id}`);
}

export interface ResumenLoteCalculado {
  totalBolsas: number;
  kgTotales: number;
  stockBolsas: number;
  stockKg: number;
  estado: string;
  categoria: string;
  tipo: string;
  tratamiento: string;
  esHomogeneo: boolean;
  desglose: {
    estados: Record<string, number>;
    categorias: Record<string, number>;
    tipos: Record<string, number>;
    tratamientos: Record<string, number>;
  };
}

/**
 * CAMBIO DE MODELO DE DATOS: atributos en la bolsa, no en el lote.
 * Todo lo que muestra el lote se calcula a partir de sus bolsas:
 * - Kg totales y cantidad de bolsas: suma y conteo de bolsas.
 * - Stock: suma de kg y cantidad de bolsas no despachadas.
 * - Estado, categoría, tipo y tratamiento: si todas las bolsas coinciden, se muestra ese valor.
 *   Si difieren, se muestra el desglose (ej: “Categoría: 20 bolsas primu / 15 bolsas original”,
 *   “Curado: 12 de 35 bolsas (300 kg)”, “Tipo: 10 intermedio / 25 final”).
 */
export function calcularResumenLoteDesdeBolsas(bolsas: BolsaRegistro[], loteBase?: Partial<Lote>): ResumenLoteCalculado {
  if (!bolsas || bolsas.length === 0) {
    const estadoDef = loteBase ? normalizarEstado(loteBase.estadoEspec || loteBase.estado, loteBase.estadoRegistro) : 'sin clasificar';
    const catDef = loteBase?.categoria ? normalizarCategoria(loteBase.categoria) : 'primu';
    const tipoDef = loteBase?.tipo ? normalizarTipo(loteBase.tipo) : 'final';
    const tratDef = loteBase?.tratamiento ? normalizarTratamiento(loteBase.tratamiento) : 'sin curar';
    const totalBolsas = Number(loteBase?.cantidadBolsas) || Number(loteBase?.stockBolsas) || 0;
    const kgEnvase = getKilajeEnvase(loteBase?.envase || loteBase?.kgPorBolsa);
    const kg = Number(loteBase?.kg) || Number(loteBase?.stockKg) || (totalBolsas * kgEnvase);

    return {
      totalBolsas,
      kgTotales: kg,
      stockBolsas: totalBolsas,
      stockKg: kg,
      estado: estadoDef,
      categoria: catDef,
      tipo: tipoDef,
      tratamiento: tratDef,
      esHomogeneo: true,
      desglose: {
        estados: { [estadoDef]: totalBolsas },
        categorias: { [catDef]: totalBolsas },
        tipos: { [tipoDef]: totalBolsas },
        tratamientos: { [tratDef]: totalBolsas },
      }
    };
  }

  const totalBolsas = bolsas.length;
  const kgTotales = bolsas.reduce((acc, b) => acc + (Number(b.kg) || 0), 0);

  const bolsasNoDespachadas = bolsas.filter(b => !b.despachada && b.estado !== 'despachada' && b.estado !== 'agotado');
  const stockBolsas = bolsasNoDespachadas.length;
  const stockKg = bolsasNoDespachadas.reduce((acc, b) => acc + (Number(b.kg) || 0), 0);

  // Desgloses
  const estadosCount: Record<string, number> = {};
  const categoriasCount: Record<string, number> = {};
  const tiposCount: Record<string, number> = {};
  let curadasCount = 0;
  let kgCuradas = 0;

  for (const b of bolsas) {
    const est = normalizarEstado(b.estado as string);
    estadosCount[est] = (estadosCount[est] || 0) + 1;

    const cat = normalizarCategoria(b.categoria);
    categoriasCount[cat] = (categoriasCount[cat] || 0) + 1;

    const tip = normalizarTipo(b.tipo);
    tiposCount[tip] = (tiposCount[tip] || 0) + 1;

    const trat = normalizarTratamiento(b.tratamiento);
    if (trat === 'curado') {
      curadasCount += 1;
      kgCuradas += Number(b.kg) || 0;
    }
  }

  // Resumen Estado
  const estadosKeys = Object.keys(estadosCount);
  let estado = estadosKeys[0] || 'sin clasificar';
  if (estadosKeys.length > 1) {
    estado = Object.entries(estadosCount)
      .map(([k, v]) => `${v} ${k}`)
      .join(' / ');
  }

  // Resumen Categoría
  const catKeys = Object.keys(categoriasCount);
  let categoria = catKeys[0] || 'primu';
  if (catKeys.length > 1) {
    categoria = Object.entries(categoriasCount)
      .map(([k, v]) => `${v} bolsas ${k}`)
      .join(' / ');
  }

  // Resumen Tipo
  const tiposKeys = Object.keys(tiposCount);
  let tipo = tiposKeys[0] || 'final';
  if (tiposKeys.length > 1) {
    tipo = Object.entries(tiposCount)
      .map(([k, v]) => `${v} ${k}`)
      .join(' / ');
  }

  // Resumen Tratamiento
  let tratamiento = 'sin curar';
  if (curadasCount === totalBolsas && totalBolsas > 0) {
    tratamiento = 'curado';
  } else if (curadasCount > 0) {
    tratamiento = `Curado: ${curadasCount} de ${totalBolsas} bolsas (${kgCuradas} kg)`;
  }

  const esHomogeneo =
    estadosKeys.length <= 1 &&
    catKeys.length <= 1 &&
    tiposKeys.length <= 1 &&
    (curadasCount === 0 || curadasCount === totalBolsas);

  return {
    totalBolsas,
    kgTotales,
    stockBolsas,
    stockKg,
    estado,
    categoria,
    tipo,
    tratamiento,
    esHomogeneo,
    desglose: {
      estados: estadosCount,
      categorias: categoriasCount,
      tipos: tiposCount,
      tratamientos: {
        curado: curadasCount,
        'sin curar': totalBolsas - curadasCount,
      }
    }
  };
}

/**
 * Genera el documento de CaratulaRegistro para un lote
 */
export function generarCaratulaParaLote(
  lote: Lote,
  fechaEmision?: string
): CaratulaRegistro {
  const caratulaId = `CARAT-${lote.id}-${Date.now()}`;
  const kgIniciales = Number(lote.kgIniciales) || Number(lote.kg) || Number(lote.stockKg) || ((Number(lote.cantidadBolsas) || Number(lote.stockBolsas) || 0) * getKilajeEnvase(lote.envase || lote.kgPorBolsa));

  return {
    id: caratulaId,
    loteId: lote.id,
    fechaEmision: fechaEmision || new Date().toISOString(),
    numeroLote: lote.codigo || lote.loteNro,
    cliente: lote.cliente,
    variedad: lote.variedad,
    especie: lote.especie,
    categoria: normalizarCategoria(lote.categoria),
    kgIniciales
  };
}

/**
 * Verifica si un lote está operativo (no bloqueado, no desdoblado, no agotado)
 */
export function puedeOperarLote(lote: Lote): { permitido: boolean; motivo?: string } {
  const est = normalizarEstado(lote.estadoEspec || lote.estado, lote.estadoRegistro);
  if (est === 'bloqueado') {
    return { permitido: false, motivo: 'El lote está BLOQUEADO. Debe desbloquearlo antes de realizar operaciones.' };
  }
  if (est === 'desdoblado') {
    return { permitido: false, motivo: 'El lote está DESDOBLADO (el stock fue transferido a lotes hijos).' };
  }
  if (est === 'agotado') {
    return { permitido: false, motivo: 'El lote está AGOTADO (stock en 0).' };
  }
  if (lote.stockBolsas <= 0 && (!lote.kg || lote.kg <= 0)) {
    return { permitido: false, motivo: 'El lote no cuenta con stock disponible.' };
  }
  return { permitido: true };
}
