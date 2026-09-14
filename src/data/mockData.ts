/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Lote, SalidaRegistrada, OrdenCarga, OrdenProceso, MovimientoSilo, Chofer, BolsonCampo } from '../types';
import { getCampaniaIdFromDate } from '../utils/campanias';

export const CLIENTES_PRECARGADOS = [
  "Pampa",
  "Eco Rural",
  "San Diego Semillas",
  "Stine",
  "Elementa Foods"
];

export const ESPECIES_PRECARGADAS = ["Soja", "Trigo", "Arveja"];

export const PRODUCTOS_TRATAMIENTO = ["Rizoderma", "Signum 420", "Signum Arveja", "Maxim", "Kit Verdesian", "Ninguno"];

const RAW_LOTS_STRING = `01FINSan DiegoCASUARINATrigoFinalPrimuSin Tratar0800Agotado02FINSan DiegoCASUARINATrigoFinalPrimuSin Tratar0800Agotado03FINSan DiegoCASUARINATrigoFinalPrimuSin Tratar0800Agotado09FINSan DiegoCASUARINATrigoFinalPrimuSin Tratar0800Agotado10FINSan DiegoCASUARINATrigoFinalPrimuSin Tratar0800Agotado12FINSan DiegoCASUARINATrigoFinalPrimuSin Tratar0800Agotado18FINSan DiegoCASUARINATrigoFinalPrimuSin Tratar0800Agotado20FINSan DiegoCATALPATrigoFinalPrimuSin Tratar0800Agotado21FINSan DiegoCATALPATrigoFinalPrimuSin Tratar0800Agotado22FINSan DiegoARAUCARIATrigoFinalPrimuSin Tratar0800Agotado23FINSan DiegoARAUCARIATrigoFinalPrimuSin Tratar0800Agotado28FINSan DiegoARAUCARIATrigoFinalPrimuSin Tratar0800Agotado31FINSan DiegoCATALPATrigoFinalPrimuSin Tratar0800Agotado33FINSan DiegoCATALPATrigoFinalPrimuSin Tratar0800Agotado34FINSan DiegoCATALPATrigoFinalPrimuSin Tratar0800Agotado38FINSan DiegoCATALPATrigoFinalPrimuSin Tratar0800Agotado39FINSan DiegoCATALPATrigoFinalPrimuSin Tratar0800Agotado42FINSan DiegoPEHUENTrigoFinalPrimuSin Tratar0800Agotado45FINSan DiegoDM TIPATrigoFinalPrimuSin Tratar0800Agotado46FINSan DiegoDM TIPATrigoFinalPrimuSin Tratar0800Agotado47FINSan DiegoDM TIPATrigoFinalPrimuSin Tratar0800Agotado48FINSan DiegoDM TIPATrigoFinalPrimuSin Tratar0800Agotado49FINSan DiegoDM TIPATrigoFinalPrimuSin Tratar0800Agotado53FINSan DiegoDM TIPATrigoFinalPrimuSin Tratar0800Agotado54FINSan DiegoDM TIPATrigoFinalPrimuSin Tratar1800Disponible55FINSan DiegoDM TIPATrigoFinalPrimuSin Tratar1800Disponible57FINSan DiegoDM TIPATrigoFinalPrimuSin Tratar0800Agotado58FINSan DiegoDM TIPATrigoFinalPrimuSin Tratar35800Disponible59FINSan DiegoDM TIPATrigoFinalPrimuSin Tratar35800Disponible60FINSan DiegoDM TIPATrigoFinalPrimuSin Tratar8800Disponible61FINSan DiegoDM TIPATrigoFinalPrimuSin Tratar35800Disponible62FINSan DiegoDM TIPATrigoFinalPrimuSin Tratar12800Disponible03INTSan DiegoCASUARINATrigoIntermedioPrimuSin Tratar0800Agotado08INTSan DiegoCASUARINATrigoIntermedioPrimuSin Tratar0800Agotado10INTSan DiegoCASUARINATrigoIntermedioPrimuSin Tratar0800Agotado11INTSan DiegoCASUARINATrigoIntermedioPrimuSin Tratar0800Agotado13INTSan DiegoCASUARINATrigoIntermedioPrimuSin Tratar0800Agotado14INTSan DiegoCASUARINATrigoIntermedioPrimuSin Tratar0800Agotado18INTSan DiegoCASUARINATrigoIntermedioPrimuSin Tratar0800Agotado25INTSan DiegoARAUCARIATrigoIntermedioPrimuSin Tratar0800Agotado26INTSan DiegoARAUCARIATrigoIntermedioPrimuSin Tratar0800Agotado27INTSan DiegoARAUCARIATrigoIntermedioPrimuSin Tratar0800Agotado28INTSan DiegoARAUCARIATrigoIntermedioPrimuSin Tratar0800Agotado29INTSan DiegoARAUCARIATrigoIntermedioPrimuSin Tratar0800Agotado30INTSan DiegoARAUCARIATrigoIntermedioPrimuSin Tratar0800Agotado32INTSan DiegoARAUCARIATrigoIntermedioPrimuSin Tratar5800Disponible43INTSan DiegoPEHUENTrigoIntermedioPrimuSin Tratar0800Agotado44INTSan DiegoPEHUENTrigoIntermedioPrimuSin Tratar0800Agotado50INTSan DiegoDM TIPATrigoIntermedioPrimuSin Tratar19800Disponible50ORISan DiegoDM TIPATrigoIntermedioPrimuSin Tratar0800Agotado51INTSan DiegoDM TIPATrigoIntermedioPrimuSin Tratar0800Agotado56INTSan DiegoDM TIPATrigoIntermedioPrimuSin Tratar0800Agotado62INTSan DiegoDM TIPATrigoIntermedioPrimuSin Tratar5800Disponible63INTSan DiegoDM TIPATrigoIntermedioPrimuSin Tratar340Disponible03TRASan DiegoCASUARINATrigoFinalPrimuTratado0800Agotado04TRASan DiegoCASUARINATrigoFinalPrimuTratado0800Agotado05TRASan DiegoCASUARINATrigoFinalPrimuTratado0800Agotado06TRASan DiegoCASUARINATrigoFinalPrimuTratado0800Agotado07TRASan DiegoCASUARINATrigoFinalPrimuTratado0800Agotado08TRASan DiegoCASUARINATrigoFinalPrimuTratado0800Agotado10TRAimidaSan DiegoCASUARINATrigoFinalPrimuTratado0800Agotado14TRASan DiegoCASUARINATrigoFinalPrimuTratado0800Agotado15TRASan DiegoCASUARINATrigoFinalPrimuTratado0800Agotado16TRASan DiegoCASUARINATrigoFinalPrimuTratado0800Agotado17TRASan DiegoCASUARINATrigoFinalPrimuTratado0800Agotado19TRASan DiegoCATALPATrigoFinalPrimuTratado0800Agotado20TRASan DiegoCATALPATrigoFinalPrimuTratado0800Agotado24TRASan DiegoARAUCARIATrigoFinalPrimuTratado0800Agotado25TRASan DiegoARAUCARIATrigoFinalPrimuTratado0800Agotado28TRASan DiegoARAUCARIATrigoFinalPrimuTratado0800Agotado35TRASan DiegoCATALPATrigoFinalPrimuTratado0800Agotado36TRASan DiegoCATALPATrigoFinalPrimuTratado0800Agotado37TRASan DiegoCATALPATrigoFinalPrimuTratado0800Agotado38TRASan DiegoCATALPATrigoFinalPrimuTratado0800Agotado39TRASan DiegoCATALPATrigoFinalPrimuTratado0800Agotado40TRASan DiegoCATALPATrigoFinalPrimuTratado0800Agotado41TRASan DiegoCATALPATrigoFinalPrimuTratado0800Agotado43TRASan DiegoPEHUENTrigoFinalPrimuTratado0800Agotado52TRASan DiegoDM TIPATrigoFinalPrimuTratado0800Agotado01FINEco RuralCASUARINATrigoFinalPrimuSin Tratar0800Agotado01TRAEco RuralCASUARINATrigoFinalPrimuTratado0800Agotado02TRAEco RuralCASUARINATrigoFinalPrimuTratado0800Agotado03FINEco RuralCASUARINATrigoFinalPrimuSin Tratar0800Agotado04FINEco RuralCASUARINATrigoFinalPrimuSin Tratar0800Agotado05FINEco RuralCASUARINATrigoFinalPrimuSin Tratar0800Agotado06FINEco RuralCASUARINATrigoFinalPrimuSin Tratar0800Agotado07FINEco RuralCASUARINATrigoFinalPrimuSin Tratar0800Agotado08FINEco RuralCASUARINATrigoFinalPrimuSin Tratar0800Agotado09FINEco RuralCATALPATrigoFinalPrimuSin Tratar0800Agotado10FINEco RuralCATALPATrigoFinalPrimuSin Tratar0800Agotado11FINEco RuralCATALPATrigoFinalPrimuSin Tratar0800Agotado12FINEco RuralCATALPATrigoFinalPrimuSin Tratar0800Agotado13FINEco RuralCATALPATrigoFinalPrimuSin Tratar0800Agotado14FINEco RuralCATALPATrigoFinalPrimuSin Tratar0800Agotado15FINEco RuralCATALPATrigoFinalPrimuSin Tratar0800Agotado16FINEco RuralCATALPATrigoFinalPrimuSin Tratar0800Agotado17FINEco RuralCATALPATrigoFinalPrimuSin Tratar0800Agotado18FINEco RuralCATALPATrigoFinalPrimuSin Tratar0800Agotado19FINEco RuralCATALPATrigoFinalPrimuSin Tratar0800Agotado20FINEco RuralCATALPATrigoFinalPrimuSin Tratar4800Disponible21FINEco RuralCATALPATrigoFinalPrimuSin Tratar0800Agotado22FINEco RuralCATALPATrigoFinalPrimuSin Tratar0800Agotado23FINEco RuralCATALPATrigoFinalPrimuSin Tratar0800Agotado24FINEco RuralCATALPATrigoFinalPrimuSin Tratar0800Agotado01FINElementa FoodsBALLTRAPArvejaFinalPrimuSin Tratar5800Disponible02FINElementa FoodsBALLTRAPArvejaFinalPrimuSin Tratar33800Disponible03FINElementa FoodsBALLTRAPArvejaFinalPrimuSin Tratar0800Agotado04FINElementa FoodsBALLTRAPArvejaFinalPrimuSin Tratar35800Disponible05FINElementa FoodsBALLTRAPArvejaFinalPrimuSin Tratar35800Disponible06FINElementa FoodsBALLTRAPArvejaFinalPrimuSin Tratar12800Disponible07FINElementa FoodsBALLTRAPArvejaFinalPrimuSin Tratar35800Disponible08FINElementa FoodsBALLTRAPArvejaFinalPrimuSin Tratar35800Disponible`;

function parseInitialLots(): Lote[] {
  const clients = ["San Diego Semilla", "San Diego", "Eco Rural", "Elementa Foods"];
  const varieties = ["CASUARINA", "CATALPA", "ARAUCARIA", "PEHUEN", "DM TIPA", "BALLTRAP"];
  const types = ["Final", "Intermedio"];
  const states = ["Disponible", "Agotado", "Reservado"];
  const speciesList = ["Trigo", "Arveja", "Soja"];

  const lots: Lote[] = [];
  let workingStr = RAW_LOTS_STRING;

  while (workingStr.length > 0) {
    let earliestClient = "";
    let earliestIndex = Infinity;

    for (const c of clients) {
      const idx = workingStr.indexOf(c);
      if (idx !== -1 && idx < earliestIndex) {
        earliestIndex = idx;
        earliestClient = c;
      }
    }

    if (earliestIndex === Infinity) {
      break;
    }

    const loteNro = workingStr.substring(0, earliestIndex).trim();
    let rest = workingStr.substring(earliestIndex + earliestClient.length);

    const variety = varieties.find(v => rest.startsWith(v)) || "";
    rest = rest.substring(variety.length);

    // Parse Especie de forma explícita
    const especie = speciesList.find(s => rest.startsWith(s)) || "Trigo";
    rest = rest.substring(especie.length);

    const tipo = types.find(t => rest.startsWith(t)) || "Final";
    rest = rest.substring(tipo.length);

    // Categoria: Primu
    let categoria = "Primu";
    if (rest.startsWith("Primu")) {
      rest = rest.substring(5);
    }

    const tratamiento = ["Sin Tratar", "Tratado"].find(tr => rest.startsWith(tr)) || "Sin Tratar";
    rest = rest.substring(tratamiento.length);

    let state = "";
    let stateIndex = -1;
    for (const est of states) {
      const idx = rest.indexOf(est);
      if (idx !== -1 && (stateIndex === -1 || idx < stateIndex)) {
        stateIndex = idx;
        state = est;
      }
    }

    if (stateIndex === -1) {
      break;
    }

    const numbersPart = rest.substring(0, stateIndex);
    const nextWorkingStr = rest.substring(stateIndex + state.length);

    let stockBolsas = 0;
    let kgPorBolsa = 800;

    if (numbersPart.endsWith("800")) {
      kgPorBolsa = 800;
      stockBolsas = parseInt(numbersPart.substring(0, numbersPart.length - 3), 10) || 0;
    } else if (numbersPart.endsWith("40")) {
      kgPorBolsa = 40;
      stockBolsas = parseInt(numbersPart.substring(0, numbersPart.length - 2), 10) || 0;
    } else {
      stockBolsas = parseInt(numbersPart, 10) || 0;
    }

    const id = `${earliestClient.replace(/\s+/g, '_')}_${loteNro}`;
    const mappedCliente = (earliestClient === "San Diego" || earliestClient === "San Diego Semillas") ? "San Diego Semilla" : earliestClient;

    const fechaIng = "2026-07-13";

    // Asignar datos de vencimiento de tratamiento a lotes Tratados
    let fechaTrat: string | undefined;
    let fechaVencTrat: string | undefined;
    let prodTrat = "Ninguno";

    if (tratamiento === "Tratado") {
      prodTrat = "Rizoderma + Fungicida";
      // Asignar fechas variadas para demostración
      if (loteNro.includes("03TRA") || loteNro.includes("04TRA") || loteNro.includes("01TRA")) {
        fechaTrat = "2026-06-10";
        fechaVencTrat = "2026-08-01"; // Próximo vencimiento (en ~9 días)
      } else if (loteNro.includes("05TRA") || loteNro.includes("06TRA") || loteNro.includes("02TRA")) {
        fechaTrat = "2026-05-20";
        fechaVencTrat = "2026-07-20"; // Vencido hace 3 días
      } else {
        fechaTrat = "2026-07-01";
        fechaVencTrat = "2026-08-20"; // En fecha (en 28 días)
      }
    }

    lots.push({
      id,
      loteNro,
      cliente: mappedCliente,
      especie: especie as any,
      variedad: variety,
      tipo: tipo as any,
      categoria: categoria as any,
      tratamiento: [tratamiento as any],
      producto: prodTrat,
      stockBolsas,
      kgPorBolsa,
      stockKg: stockBolsas * kgPorBolsa,
      fechaIngreso: fechaIng,
      fechaTratamiento: fechaTrat,
      fechaVencimientoTratamiento: fechaVencTrat,
      campaniaId: getCampaniaIdFromDate(fechaIng),
      estado: (stockBolsas > 0 ? "Disponible" : "Agotado") as any,
      estadoRegistro: (lots.length % 5 === 0 ? "PRE-CARGA" : "REALIZADO"),
      fechaHoraProduccion: (lots.length % 5 === 0 ? undefined : `2026-07-13T${(8 + (lots.length % 10)).toString().padStart(2, '0')}:30`),
      historial: [
        {
          id: `MOV-${id}-001`,
          fecha: fechaIng,
          tipo: "Entrada",
          cantidadBolsas: stockBolsas,
          kgPorBolsa,
          cantidadKg: stockBolsas * kgPorBolsa,
          detalle: "Stock inicial precargado"
        }
      ]
    });

    workingStr = nextWorkingStr;
  }

  // Agregar un lote vacío de "Pampa" y "Stine" para tener representación inicial
  lots.push({
    id: "Pampa_10FIN",
    loteNro: "10FIN",
    cliente: "Pampa",
    especie: "Trigo",
    variedad: "PEHUEN",
    tipo: "Final",
    categoria: "Fundadora",
    tratamiento: ["Sin Tratar"],
    producto: "Ninguno",
    stockBolsas: 100,
    kgPorBolsa: 40,
    stockKg: 4000,
    fechaIngreso: "2026-07-13",
    campaniaId: getCampaniaIdFromDate("2026-07-13"),
    estado: "Disponible",
    historial: [
      {
        id: "MOV-Pampa_10FIN-001",
        fecha: "2026-07-13",
        tipo: "Entrada",
        cantidadBolsas: 100,
        kgPorBolsa: 40,
        cantidadKg: 4000,
        detalle: "Stock inicial precargado"
      }
    ]
  });

  lots.push({
    id: "Stine_12FIN",
    loteNro: "12FIN",
    cliente: "Stine",
    especie: "Trigo",
    variedad: "CATALPA",
    tipo: "Final",
    categoria: "Primu",
    tratamiento: ["Tratado"],
    producto: "Rizoderma",
    stockBolsas: 200,
    kgPorBolsa: 40,
    stockKg: 8000,
    fechaIngreso: "2026-07-13",
    fechaTratamiento: "2026-06-25",
    fechaVencimientoTratamiento: "2026-08-10",
    campaniaId: getCampaniaIdFromDate("2026-07-13"),
    estado: "Disponible",
    historial: [
      {
        id: "MOV-Stine_12FIN-001",
        fecha: "2026-07-13",
        tipo: "Entrada",
        cantidadBolsas: 200,
        kgPorBolsa: 40,
        cantidadKg: 8000,
        detalle: "Stock inicial precargado"
      }
    ]
  });

  return lots;
}

export const LOTES_INICIALES: Lote[] = parseInitialLots();

export const SALIDAS_INICIALES: SalidaRegistrada[] = [
  {
    id: "REM-2026-0001",
    fecha: "2026-07-09",
    campaniaId: getCampaniaIdFromDate("2026-07-09"),
    choferNombre: "Juan Carlos Gómez",
    choferDni: "28.431.902",
    patenteCamion: "AE 312 OP",
    cliente: "San Diego Semilla",
    loteId: "San_Diego_58FIN",
    tipoLote: "Final",
    producto: "Ninguno",
    categoria: "Fundadora",
    cantidadBolsas: 5,
    envase: "Big Bag",
    kgPorBolsa: 800,
    totalKg: 4000
  },
  {
    id: "REM-2026-0002",
    fecha: "2026-07-11",
    campaniaId: getCampaniaIdFromDate("2026-07-11"),
    choferNombre: "Rogelio Benítez",
    choferDni: "24.912.003",
    patenteCamion: "AD 890 JK",
    cliente: "Eco Rural",
    loteId: "Eco_Rural_20FIN",
    tipoLote: "Final",
    producto: "Ninguno",
    categoria: "Primu",
    cantidadBolsas: 2,
    envase: "Big Bag",
    kgPorBolsa: 800,
    totalKg: 1600
  }
];

export const ORDENES_CARGA_INICIALES: OrdenCarga[] = [
  {
    id: "OC-2026-1001",
    fecha: "2026-07-10",
    campaniaId: getCampaniaIdFromDate("2026-07-10"),
    cliente: "Eco Rural",
    loteId: "Eco_Rural_20FIN",
    cantidadBolsas: 2,
    kgTotales: 1600,
    tipo: "Final",
    categoria: "Fundadora",
    tratamiento: "Sin Tratar",
    despachante: "Amilcar Quiroz",
    autor: "Amilcar Quiroz",
    estado: "Despachada",
    fotoRemito: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='60'><rect width='120' height='60' fill='%23E3EFE7' stroke='%2300603C' stroke-width='2'/><text x='10' y='35' fill='%2300603C' font-family='sans-serif' font-weight='bold' font-size='10'>REMITO OC-1001</text></svg>",
    firmaChofer: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='60'><rect width='120' height='60' fill='white'/><path d='M15 45 C35 15, 65 15, 105 35' stroke='%2300603C' stroke-width='2' fill='none'/></svg>"
  },
  {
    id: "OC-2026-1002",
    fecha: "2026-07-12",
    campaniaId: getCampaniaIdFromDate("2026-07-12"),
    cliente: "San Diego Semilla",
    loteId: "San_Diego_58FIN",
    cantidadBolsas: 5,
    kgTotales: 4000,
    tipo: "Final",
    categoria: "Preba",
    tratamiento: "Sin Tratar",
    despachante: "Malcon Baez",
    autor: "Malcon Baez",
    estado: "Disponible"
  },
  {
    id: "OC-2026-1003",
    fecha: "2026-07-13",
    campaniaId: getCampaniaIdFromDate("2026-07-13"),
    cliente: "Elementa Foods",
    loteId: "Elementa_Foods_01FIN",
    cantidadBolsas: 1,
    kgTotales: 800,
    tipo: "Final",
    categoria: "Primu",
    tratamiento: "Sin Tratar",
    despachante: "Amilcar Quiroz",
    autor: "Amilcar Quiroz",
    estado: "Aceptada"
  }
];

export const ORDENES_PROCESO_INICIALES: OrdenProceso[] = [
  {
    id: "OP-2026-1001",
    numeroOrden: "1001",
    tipoOrden: "PRODUCCION",
    cliente: "San Diego Semilla",
    especie: "Soja",
    envaseDestino: "Big Bag x 800 Kg",
    tratamiento: "Curasemilla Fungicida + Inoculante",
    variedad: "P46A03",
    producto: "FINAL",
    categoria: "PRIMU",
    bbPedidos: 50,
    hechos: 35,
    estado: "EN CURSO",
    observaciones: "Procesamiento de semilla con curado estándar Rizoderma.",
    fechaCreacion: "2026-07-15",
    campaniaId: getCampaniaIdFromDate("2026-07-15"),
    operarios: 3,
    horasTrabajadas: 6.0,
    horasHombre: 18.0
  },
  {
    id: "OP-2026-1002",
    numeroOrden: "1002",
    tipoOrden: "MOVIMIENTO",
    cliente: "Eco Rural",
    especie: "Trigo",
    tipoMovimiento: "Intermedio a Final",
    numeroOrdenMovimiento: "OM-402",
    envaseDestino: "Big Bag x 800 Kg",
    tratamiento: "Sin Tratamiento",
    variedad: "DM TIPA",
    producto: "INTERMEDIO",
    categoria: "Preba",
    bbPedidos: 30,
    hechos: 30,
    estado: "TERMINADO",
    observaciones: "Movimiento de bolsa de intermedio a final en depósito.",
    fechaCreacion: "2026-07-18",
    campaniaId: getCampaniaIdFromDate("2026-07-18"),
    operarios: 2,
    horasTrabajadas: 5.0,
    horasHombre: 10.0
  },
  {
    id: "OP-2026-1003",
    numeroOrden: "1003",
    tipoOrden: "MOVIMIENTO",
    cliente: "Pampa",
    especie: "Arveja",
    tipoMovimiento: "Final a Final Tratado",
    numeroOrdenMovimiento: "OM-403",
    envaseDestino: "Bolsa x 25 Kg",
    tratamiento: "Maxim Quattro + Plenus",
    variedad: "BALLTRAP",
    producto: "FINAL",
    categoria: "Original",
    bbPedidos: 40,
    hechos: 0,
    estado: "SIN INICIAR",
    observaciones: "Envasado y tratamiento químico listo para ejecución.",
    fechaCreacion: "2026-07-20",
    campaniaId: getCampaniaIdFromDate("2026-07-20")
  },
  {
    id: "OP-2026-0095",
    numeroOrden: "0095",
    tipoOrden: "PRODUCCION",
    cliente: "San Diego Semilla",
    especie: "Soja",
    envaseDestino: "Big Bag x 800 Kg",
    tratamiento: "Acelerador + Inoculante",
    variedad: "P46A03",
    producto: "FINAL",
    categoria: "Fundadora",
    bbPedidos: 60,
    hechos: 60,
    estado: "TERMINADO",
    observaciones: "Clasificación y empaque en Big Bags finalizado con alta eficiencia.",
    fechaCreacion: "2026-07-10",
    campaniaId: getCampaniaIdFromDate("2026-07-10"),
    operarios: 3,
    horasTrabajadas: 6.5,
    horasHombre: 19.5
  },
  {
    id: "OP-2026-0096",
    numeroOrden: "0096",
    tipoOrden: "PRODUCCION",
    cliente: "Stine",
    especie: "Trigo",
    envaseDestino: "Bolsa x 40 Kg",
    tratamiento: "Curasemilla Fungicida",
    variedad: "CATALPA",
    producto: "FINAL",
    categoria: "Primu",
    bbPedidos: 1000,
    hechos: 1000,
    estado: "TERMINADO",
    observaciones: "Proceso completo de embolsado y curado.",
    fechaCreacion: "2026-07-12",
    campaniaId: getCampaniaIdFromDate("2026-07-12"),
    operarios: 2,
    horasTrabajadas: 8.0,
    horasHombre: 16.0
  },
  {
    id: "OP-2026-0097",
    numeroOrden: "0097",
    tipoOrden: "PRODUCCION",
    cliente: "Elementa Foods",
    especie: "Arveja",
    envaseDestino: "Big Bag x 800 Kg",
    tratamiento: "Sin Tratamiento",
    variedad: "GREENFIELD",
    producto: "FINAL",
    categoria: "Original",
    bbPedidos: 40,
    hechos: 40,
    estado: "TERMINADO",
    observaciones: "Limpieza y calibrado de grano de arveja.",
    fechaCreacion: "2026-07-14",
    campaniaId: getCampaniaIdFromDate("2026-07-14"),
    operarios: 3,
    horasTrabajadas: 4.5,
    horasHombre: 13.5
  }
];

export const MOVIMIENTOS_SILO_INICIALES: MovimientoSilo[] = [
  {
    id: "ING-SILO-101",
    siloId: "Silo 1",
    fecha: "2026-07-01",
    tipo: "INGRESO",
    kg: 25000,
    cliente: "San Diego Semilla",
    especie: "Soja",
    variedad: "P46A03",
    categoria: "Fundadora",
    campoOrigen: "La Barrancosa",
    bolsonOrigenNro: "Bolsón 12B",
    bolsonOrigenSector: "Sector A1",
    depositoOrigen: "Depósito Central",
    humedad: 13.5
  },
  {
    id: "ING-SILO-102",
    siloId: "Silo 2",
    fecha: "2026-07-05",
    tipo: "INGRESO",
    kg: 15480,
    cliente: "Stine",
    especie: "Soja",
    variedad: "50EE59",
    categoria: "Original",
    campoOrigen: "La Barrancosa",
    bolsonOrigenNro: "Bolsón 44C",
    bolsonOrigenSector: "Sector B2",
    depositoOrigen: "Depósito Norte",
    humedad: 12.8
  },
  {
    id: "ING-SILO-103",
    siloId: "Silo 3",
    fecha: "2026-07-08",
    tipo: "INGRESO",
    kg: 30000,
    cliente: "Elementa Foods",
    especie: "Arveja",
    variedad: "BALLTRAP",
    categoria: "Primu",
    campoOrigen: "La Barrancosa",
    bolsonOrigenNro: "Bolsón 08A",
    bolsonOrigenSector: "Sector C1",
    depositoOrigen: "Depósito Central",
    humedad: 14.0
  },
  {
    id: "ING-SILO-104",
    siloId: "Silo 4",
    fecha: "2026-07-10",
    tipo: "INGRESO",
    kg: 15000,
    cliente: "Pampa",
    especie: "Soja",
    variedad: "DM TIPA",
    categoria: "Preba",
    campoOrigen: "La Barrancosa",
    bolsonOrigenNro: "Bolsón 02D",
    bolsonOrigenSector: "Sector A2",
    depositoOrigen: "Depósito Sur",
    humedad: 13.2
  },
  {
    id: "ING-SILO-105",
    siloId: "Silo 5",
    fecha: "2026-07-12",
    tipo: "INGRESO",
    kg: 22000,
    cliente: "Stine",
    especie: "Trigo",
    variedad: "CATALPA",
    categoria: "Fundadora",
    campoOrigen: "La Barrancosa",
    bolsonOrigenNro: "Bolsón 19A",
    bolsonOrigenSector: "Sector B1",
    depositoOrigen: "Depósito Central",
    humedad: 12.5
  },
  {
    id: "ING-SILO-106",
    siloId: "Silo 6",
    fecha: "2026-07-14",
    tipo: "INGRESO",
    kg: 12000,
    cliente: "Eco Rural",
    especie: "Soja",
    variedad: "PEHUEN",
    categoria: "Original",
    campoOrigen: "La Barrancosa",
    bolsonOrigenNro: "Bolsón 05F",
    bolsonOrigenSector: "Sector D1",
    depositoOrigen: "Depósito Este",
    humedad: 13.8
  }
];

export const CHOFERES_INICIALES: Chofer[] = [
  {
    id: 'CHOFER-001',
    nombre: 'Carlos Gómez',
    cuit: '20284910394',
    patentes: 'AA123BB / CC456DD',
    transporte: 'Transporte Expreso Pampa',
    patenteChasis: 'AA123BB',
    patenteAcoplado: 'CC456DD',
    tara: 14500
  },
  {
    id: 'CHOFER-002',
    nombre: 'Juan Manuel Pérez',
    cuit: '20318492018',
    patentes: 'AB987CD / EF321GH',
    transporte: 'TransAgro SRL',
    patenteChasis: 'AB987CD',
    patenteAcoplado: 'EF321GH',
    tara: 15200
  },
  {
    id: 'CHOFER-003',
    nombre: 'Roberto Fernández',
    cuit: '20259483023',
    patentes: 'AC456EF',
    transporte: 'Logística del Campo',
    patenteChasis: 'AC456EF',
    tara: 13800
  },
  {
    id: 'CHOFER-004',
    nombre: 'Marcelo Rodríguez',
    cuit: '20349281045',
    patentes: 'AD789GH / JK123LM',
    transporte: 'Transporte El Sur',
    patenteChasis: 'AD789GH',
    patenteAcoplado: 'JK123LM',
    tara: 14800
  }
];

export const BOLSONES_INICIALES: BolsonCampo[] = [
  {
    id: 'BOLSON-001',
    campania: '2025/2026',
    cliente: 'San Diego Semilla',
    numeroBolson: 'S29,2',
    zona: 'Norte',
    campo: 'La Barrancosa',
    cultivo: 'Soja',
    ordenSiembra: 'OS-01 (Soja Primera)',
    cicloCultivo: 'Soja Primera',
    variedad: 'P46A03',
    categoria: 'Fundadora',
    deposito: 'Lote 20',
    entradasKg: 48500,
    salidasKg: 14200,
    stockKg: 34300,
    humedad: 13.5,
    tipoBolsa: 'Silobolsa 9 Pies (60m)'
  },
  {
    id: 'BOLSON-002',
    campania: '2025/2026',
    cliente: 'San Diego Semilla',
    numeroBolson: 'S48,4',
    zona: 'Sur',
    campo: 'El Potrero',
    cultivo: 'Soja',
    ordenSiembra: 'OS-02 (Soja Segunda)',
    cicloCultivo: 'Soja Segunda',
    variedad: 'DM 46i20',
    categoria: 'Original',
    deposito: 'Lote 10AB',
    entradasKg: 52000,
    salidasKg: 20000,
    stockKg: 32000,
    humedad: 13.8,
    tipoBolsa: 'Silobolsa 9 Pies (60m)'
  },
  {
    id: 'BOLSON-003',
    campania: '2025/2026',
    cliente: 'San Diego Semilla',
    numeroBolson: 'Bolsón 12A',
    zona: 'Norte',
    campo: 'La Barrancosa',
    cultivo: 'Trigo',
    ordenSiembra: 'OS-03 (Trigo Ciclo Largo)',
    cicloCultivo: 'Trigo Ciclo Largo',
    variedad: 'CASUARINA',
    categoria: 'Fundadora',
    deposito: 'Depósito Central',
    entradasKg: 45000,
    salidasKg: 15000,
    stockKg: 30000,
    humedad: 13.2,
    tipoBolsa: 'Silobolsa 9 Pies (60m)'
  },
  {
    id: 'BOLSON-004',
    campania: '2025/2026',
    cliente: 'Stine',
    numeroBolson: 'Bolsón 19A',
    zona: 'Sur',
    campo: 'La Barrancosa',
    cultivo: 'Trigo',
    ordenSiembra: 'OS-04 (Trigo Ciclo Corto)',
    cicloCultivo: 'Trigo Ciclo Corto',
    variedad: 'CATALPA',
    categoria: 'Preba',
    deposito: 'Depósito Central',
    entradasKg: 60000,
    salidasKg: 22000,
    stockKg: 38000,
    humedad: 13.0,
    tipoBolsa: 'Silobolsa 10 Pies (75m)'
  },
  {
    id: 'BOLSON-005',
    campania: '2025/2026',
    cliente: 'Eco Rural',
    numeroBolson: 'Bolsón 05F',
    zona: 'Este',
    campo: 'El Potrero',
    cultivo: 'Soja',
    ordenSiembra: 'OS-05 (Soja Primera)',
    cicloCultivo: 'Soja Primera',
    variedad: 'PEHUEN',
    categoria: 'Original',
    deposito: 'Depósito Este',
    entradasKg: 50000,
    salidasKg: 12000,
    stockKg: 38000,
    humedad: 13.6,
    tipoBolsa: 'Silobolsa 9 Pies (60m)'
  },
  {
    id: 'BOLSON-006',
    campania: '2025/2026',
    cliente: 'Elementa Foods',
    numeroBolson: 'Bolsón 08C',
    zona: 'Oeste',
    campo: 'Don Pedro',
    cultivo: 'Arveja',
    ordenSiembra: 'OS-06 (Arveja Verde)',
    cicloCultivo: 'Arveja Verde',
    variedad: 'BALLTRAP',
    categoria: 'Prima',
    deposito: 'Depósito Oeste',
    entradasKg: 40000,
    salidasKg: 0,
    stockKg: 40000,
    humedad: 12.8,
    tipoBolsa: 'Silobolsa 9 Pies (60m)'
  }
];

