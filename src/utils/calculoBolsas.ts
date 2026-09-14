/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SiloId, MovimientoSilo } from '../types';

export type CategoriaEnvaseKg = 25 | 40 | 50 | 800;

export interface CalculoBolsasInput {
  silosSeleccionados?: (SiloId | 'TODOS')[];
  siloStocks?: Record<SiloId, number>;
  kilosBrutosManuales?: number;
  porcentajeMerma: number; // 0 - 100
  pesoEnvaseKg: CategoriaEnvaseKg;
}

export interface LoteDesgloseItem {
  nroLote: number;
  bolsas: number;
  kgPorBolsa: CategoriaEnvaseKg;
  totalKg: number;
  esLoteCompleto: boolean;
  fraccionLoteDecimal: number;
}

export interface CalculoTransferConfig {
  cantidadLotes: number;
  cantidadLotes1Decimal?: number;
  permitirLotesConDecimal?: boolean;
  desgloseLotes?: LoteDesgloseItem[];
  stockBolsasPorLote: number;
  kgPorBolsa: CategoriaEnvaseKg;
  totalKgNetos: number;
  silosOrigenNombres?: string;
  cliente?: string;
  variedad?: string;
  especie?: string;
  esDeSilo?: boolean;
  siloOrigenId?: string;
  lotesEnteros?: number;
  bolsasPorLoteEntero?: number;
}

export interface CalculoBolsasResult {
  stockBrutoKg: number;
  porcentajeMerma: number;
  kilosMermaKg: number;
  kilosNetosKg: number;
  pesoEnvaseKg: CategoriaEnvaseKg;
  cantidadBolsasEnteras: number;
  cantidadBolsasDecimal: number;
  kilosRemanentes: number;
  cantidadLotesEnteros: number;
  cantidadLotes1Decimal: number; // Con 1 solo decimal (ej: 1.4, 2.3)
  cantidadLotesDecimal: number; // Con 2 decimales
  bolsasRemanentesLote: number;
  excedeLoteNatural: boolean; // True si hay remanente o excede el lote natural de 35 bolsas
  desgloseLotes: LoteDesgloseItem[];
}

export interface FiltrosIngresos {
  fechaDesde?: string; // YYYY-MM-DD
  fechaHasta?: string; // YYYY-MM-DD
  fechasSeleccionadas?: string[]; // Fechas puntuales
  modoFecha: 'rango' | 'multiples';
  especies: string[];
  clientes: string[];
  variedades: string[];
  silos: SiloId[];
  busquedaTexto?: string;
}

export interface ResumenConsolidadoIngresos {
  totalIngresosCount: number;
  totalKilosNetos: number;
  promedioHumedad: number;
  desglosePorEspecie: Record<string, number>;
  desglosePorCliente: Record<string, number>;
  desglosePorSilo: Record<string, number>;
}

/**
 * Realiza el cálculo matemático de bolsas y lotes según stock bruto, merma y envase.
 * Regla de negocio:
 * 1. Kilos Netos = Stock Bruto * (1 - (% Merma / 100))
 * 2. Cantidad de Bolsas = Kilos Netos / Peso Envase
 * 3. Cantidad de Lotes = Cantidad de Bolsas / 35
 */
export function calcularBolsasYLotes(input: CalculoBolsasInput): CalculoBolsasResult {
  const { silosSeleccionados, siloStocks, kilosBrutosManuales, porcentajeMerma, pesoEnvaseKg } = input;

  // 1. Determinar Kilos Brutos a Procesar
  let stockBruto = 0;
  if (typeof kilosBrutosManuales === 'number') {
    stockBruto = Math.max(0, kilosBrutosManuales);
  } else if (silosSeleccionados && siloStocks) {
    const isTodos = silosSeleccionados.includes('TODOS') || silosSeleccionados.length === 0;
    if (isTodos) {
      stockBruto = Object.values(siloStocks).reduce((acc, curr) => acc + (Number(curr) || 0), 0);
    } else {
      silosSeleccionados.forEach((silo) => {
        if (silo !== 'TODOS' && siloStocks[silo]) {
          stockBruto += Number(siloStocks[silo]) || 0;
        }
      });
    }
  }

  // 2. Descuento por Merma
  const mermaSafe = Math.max(0, Math.min(100, Number(porcentajeMerma) || 0));
  const kilosMerma = stockBruto * (mermaSafe / 100);
  const kilosNetos = Math.max(0, stockBruto * (1 - mermaSafe / 100));

  // 3. Cantidad de Bolsas
  const envaseSafe = pesoEnvaseKg > 0 ? pesoEnvaseKg : 800;
  const cantidadBolsasDecimal = kilosNetos / envaseSafe;
  const cantidadBolsasEnteras = Math.floor(cantidadBolsasDecimal);
  const kilosRemanentes = Math.round(kilosNetos - cantidadBolsasEnteras * envaseSafe);

  // 4. Cantidad de Lotes (1 Lote = 35 Bolsas)
  const cantidadLotesDecimalRaw = cantidadBolsasDecimal / 35;
  const cantidadLotesEnteros = Math.floor(cantidadBolsasEnteras / 35);
  const bolsasRemanentesLote = cantidadBolsasEnteras % 35;
  const cantidadLotes1Decimal = Number((cantidadBolsasEnteras / 35).toFixed(1));
  const excedeLoteNatural = bolsasRemanentesLote > 0 || (cantidadBolsasEnteras > 35 && bolsasRemanentesLote > 0);

  // Desglose detallado de lotes para carga fraccionaria/con decimal
  const desgloseLotes: LoteDesgloseItem[] = [];
  for (let i = 0; i < cantidadLotesEnteros; i++) {
    desgloseLotes.push({
      nroLote: i + 1,
      bolsas: 35,
      kgPorBolsa: envaseSafe,
      totalKg: 35 * envaseSafe,
      esLoteCompleto: true,
      fraccionLoteDecimal: 1.0,
    });
  }

  if (bolsasRemanentesLote > 0) {
    desgloseLotes.push({
      nroLote: cantidadLotesEnteros + 1,
      bolsas: bolsasRemanentesLote,
      kgPorBolsa: envaseSafe,
      totalKg: bolsasRemanentesLote * envaseSafe,
      esLoteCompleto: false,
      fraccionLoteDecimal: Number((bolsasRemanentesLote / 35).toFixed(1)),
    });
  }

  return {
    stockBrutoKg: Math.round(stockBruto),
    porcentajeMerma: mermaSafe,
    kilosMermaKg: Math.round(kilosMerma),
    kilosNetosKg: Math.round(kilosNetos),
    pesoEnvaseKg: envaseSafe,
    cantidadBolsasEnteras,
    cantidadBolsasDecimal: Number(cantidadBolsasDecimal.toFixed(2)),
    kilosRemanentes,
    cantidadLotesEnteros,
    cantidadLotes1Decimal,
    cantidadLotesDecimal: Number(cantidadLotesDecimalRaw.toFixed(2)),
    bolsasRemanentesLote,
    excedeLoteNatural,
    desgloseLotes,
  };
}

/**
 * Filtra los movimientos de silo de tipo INGRESO según criterios combinados.
 */
export function filtrarMovimientosIngreso(
  movimientos: MovimientoSilo[],
  filtros: FiltrosIngresos
): MovimientoSilo[] {
  return movimientos.filter((mov) => {
    // Solo movimientos de INGRESO
    if (mov.tipo !== 'INGRESO') return false;

    // Filtro de Fechas
    const movFecha = mov.fecha || '';
    if (filtros.modoFecha === 'rango') {
      if (filtros.fechaDesde && movFecha < filtros.fechaDesde) return false;
      if (filtros.fechaHasta && movFecha > filtros.fechaHasta) return false;
    } else if (filtros.modoFecha === 'multiples') {
      if (filtros.fechasSeleccionadas && filtros.fechasSeleccionadas.length > 0) {
        if (!filtros.fechasSeleccionadas.includes(movFecha)) return false;
      }
    }

    // Filtro Especie (Multi-selección)
    if (filtros.especies && filtros.especies.length > 0) {
      if (!mov.especie || !filtros.especies.includes(mov.especie)) return false;
    }

    // Filtro Cliente (Multi-selección)
    if (filtros.clientes && filtros.clientes.length > 0) {
      if (!mov.cliente || !filtros.clientes.includes(mov.cliente)) return false;
    }

    // Filtro Variedad (Multi-selección)
    if (filtros.variedades && filtros.variedades.length > 0) {
      if (!mov.variedad || !filtros.variedades.includes(mov.variedad)) return false;
    }

    // Filtro Silo (Multi-selección)
    if (filtros.silos && filtros.silos.length > 0) {
      if (!mov.siloId || !filtros.silos.includes(mov.siloId)) return false;
    }

    // Búsqueda de texto libre
    if (filtros.busquedaTexto && filtros.busquedaTexto.trim() !== '') {
      const q = filtros.busquedaTexto.toLowerCase().trim();
      const matchId = (mov.id || '').toLowerCase().includes(q);
      const matchDoc = (mov.comprobanteCartaPorte || mov.cartaPorte || mov.remito || '').toLowerCase().includes(q);
      const matchChofer = (mov.chofer || '').toLowerCase().includes(q);
      const matchPatente = (mov.patentes || '').toLowerCase().includes(q);
      const matchCliente = (mov.cliente || '').toLowerCase().includes(q);
      const matchVariedad = (mov.variedad || '').toLowerCase().includes(q);
      if (!matchId && !matchDoc && !matchChofer && !matchPatente && !matchCliente && !matchVariedad) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Calcula el resumen consolidado de los ingresos filtrados.
 */
export function consolidarIngresos(ingresos: MovimientoSilo[]): ResumenConsolidadoIngresos {
  let totalKilosNetos = 0;
  let sumaHumedad = 0;
  let cantidadHumedades = 0;

  const desglosePorEspecie: Record<string, number> = {};
  const desglosePorCliente: Record<string, number> = {};
  const desglosePorSilo: Record<string, number> = {};

  ingresos.forEach((ing) => {
    const kg = Number(ing.kg) || 0;
    totalKilosNetos += kg;

    if (ing.humedad !== undefined && ing.humedad !== null && !isNaN(ing.humedad)) {
      sumaHumedad += Number(ing.humedad);
      cantidadHumedades++;
    }

    // Especie
    const esp = ing.especie || 'Sin Especie';
    desglosePorEspecie[esp] = (desglosePorEspecie[esp] || 0) + kg;

    // Cliente
    const cli = ing.cliente || 'Sin Cliente';
    desglosePorCliente[cli] = (desglosePorCliente[cli] || 0) + kg;

    // Silo
    const sil = ing.siloId || 'Sin Silo';
    desglosePorSilo[sil] = (desglosePorSilo[sil] || 0) + kg;
  });

  return {
    totalIngresosCount: ingresos.length,
    totalKilosNetos: Math.round(totalKilosNetos),
    promedioHumedad: cantidadHumedades > 0 ? Number((sumaHumedad / cantidadHumedades).toFixed(1)) : 0,
    desglosePorEspecie,
    desglosePorCliente,
    desglosePorSilo,
  };
}

/**
 * Referencia de Consultas Backend / SQL Equivalentes para arquitecturas relacionales:
 *
 * 1. QUERY SQL PARA STOCK POR SILO:
 * ```sql
 * SELECT
 *   silo_id,
 *   SUM(CASE WHEN tipo = 'INGRESO' THEN kg WHEN tipo LIKE 'EGRESO%' THEN -kg ELSE 0 END) AS stock_disponible_kg
 * FROM movimientos_silo
 * GROUP BY silo_id;
 * ```
 *
 * 2. QUERY SQL PARA FILTRADO CONSOLIDADO DE INGRESOS (Opción 2):
 * ```sql
 * SELECT
 *   id,
 *   fecha,
 *   silo_id,
 *   especie,
 *   variedad,
 *   cliente,
 *   kg AS kilos_netos,
 *   humedad,
 *   comprobante_carta_porte,
 *   chofer,
 *   patentes
 * FROM movimientos_silo
 * WHERE tipo = 'INGRESO'
 *   AND (:fechaDesde IS NULL OR fecha >= :fechaDesde)
 *   AND (:fechaHasta IS NULL OR fecha <= :fechaHasta)
 *   AND (:especies IS NULL OR especie IN (:especies))
 *   AND (:clientes IS NULL OR cliente IN (:clientes))
 *   AND (:variedades IS NULL OR variedad IN (:variedades))
 *   AND (:silos IS NULL OR silo_id IN (:silos))
 * ORDER BY fecha DESC, hora DESC;
 * ```
 */
