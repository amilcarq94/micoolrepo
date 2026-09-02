/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type CicloGerminacionType = 'Grupo Corto' | 'Grupo Intermedio' | 'Grupo Largo';
export const CICLOS_GERMINACION: CicloGerminacionType[] = ['Grupo Corto', 'Grupo Intermedio', 'Grupo Largo'];

export type EspecieType = 'Soja' | 'Trigo' | 'Arveja' | 'Sin especificar';

export type TipoLoteType = 'Intermedio' | 'Final' | 'Procesado' | 'Semilla' | 'Descarte' | 'Bajo Consumo' | 'Mezcla' | 'Rechazo' | string;

export type TratamientoType = 'Tratado' | 'Sin Tratar' | 'Curado Completo' | 'Fungicida' | 'Insecticida' | 'Inoculado' | 'Polímero' | string;

export type CategoriaType = 'Fundadora' | 'PreBase' | 'Original' | 'Primera Multiplicación (PRIMU)' | string;

export const CATEGORIAS_OFICIALES = [
  'Fundadora',
  'PreBase',
  'Original',
  'Primera Multiplicación (PRIMU)'
] as const;

export interface VariedadItem {
  id: string;
  nombre: string;
  especie: string;
  cliente: string;
  idEspecie?: string;
  idCliente?: string;
}

export interface PlantaConfig {
  clientes: string[];
  especies: string[];
  variedades: string[];
  variedadesDb?: VariedadItem[];
  tipos: string[];
  categorias: string[];
  tratamientos: string[];
}

export const VARIEDADES_DB_DEFAULT: VariedadItem[] = [
  { id: 'var-soja-sd-casuarina', nombre: 'CASUARINA', especie: 'Soja', cliente: 'San Diego Semillas' },
  { id: 'var-soja-sd-catalpa', nombre: 'CATALPA', especie: 'Soja', cliente: 'San Diego Semillas' },
  { id: 'var-soja-sd-araucaria', nombre: 'ARAUCARIA', especie: 'Soja', cliente: 'San Diego Semillas' },
  { id: 'var-soja-sd-tipa', nombre: 'DM TIPA', especie: 'Soja', cliente: 'San Diego Semillas' },
  { id: 'var-soja-sd-dm46i20', nombre: 'DM 46i20', especie: 'Soja', cliente: 'San Diego Semillas' },
  { id: 'var-soja-sd-dm50i22', nombre: 'DON MARIO 50i22', especie: 'Soja', cliente: 'San Diego Semillas' },
  { id: 'var-soja-er-pehuen', nombre: 'PEHUEN', especie: 'Soja', cliente: 'Eco Rural' },
  { id: 'var-soja-pam-balltrap', nombre: 'BALLTRAP', especie: 'Soja', cliente: 'Pampa' },
  { id: 'var-soja-st-p46a03', nombre: 'P46A03', especie: 'Soja', cliente: 'Stine' },
  { id: 'var-trigo-sd-baguette620', nombre: 'BAGUETTE 620', especie: 'Trigo', cliente: 'San Diego Semillas' },
  { id: 'var-trigo-sd-sy120', nombre: 'SY 120', especie: 'Trigo', cliente: 'San Diego Semillas' },
  { id: 'var-trigo-er-bio45', nombre: 'BIO 4.5', especie: 'Trigo', cliente: 'Eco Rural' },
  { id: 'var-trigo-pam-aca360', nombre: 'ACA 360', especie: 'Trigo', cliente: 'Pampa' },
  { id: 'var-arveja-sd-sarina', nombre: 'SARINA', especie: 'Arveja', cliente: 'San Diego Semillas' },
  { id: 'var-arveja-ef-pulsar', nombre: 'PULSAR', especie: 'Arveja', cliente: 'Elementa Foods' },
];

/**
 * Consulta condicional de filtrado reactivo de variedades:
 * VariedadesVisibles = σ_(Especie = EspecieSeleccionada ∧ Cliente = ClienteSeleccionado)(Variedades_DB)
 */
export function getVariedadesVisibles(
  variedadesDb: VariedadItem[] | undefined,
  especie: string,
  cliente: string
): VariedadItem[] {
  if (!especie || !cliente) return [];
  const espNorm = especie.trim().toLowerCase();
  const cliNorm = cliente.trim().toLowerCase();

  const list = Array.isArray(variedadesDb)
    ? variedadesDb
    : VARIEDADES_DB_DEFAULT;

  return list.filter((v) => {
    const vEsp = (v.especie || '').trim().toLowerCase();
    const vCli = (v.cliente || '').trim().toLowerCase();
    return vEsp === espNorm && vCli === cliNorm;
  });
}

/**
 * Obtiene las variedades de la base de datos filtradas por especie:
 */
export function getVariedadesPorEspecie(
  variedadesDb: VariedadItem[] | undefined,
  especie: string
): VariedadItem[] {
  if (!especie) return [];
  const espNorm = especie.trim().toLowerCase();
  const list = Array.isArray(variedadesDb)
    ? variedadesDb
    : VARIEDADES_DB_DEFAULT;

  return list.filter((v) => {
    const vEsp = (v.especie || '').trim().toLowerCase();
    return vEsp === espNorm;
  });
}

export const PLANTA_CONFIG_DEFAULT: PlantaConfig = {
  clientes: [
    'San Diego Semillas',
    'Eco Rural',
    'Pampa',
    'Stine',
    'Elementa Foods'
  ],
  especies: [
    'Soja',
    'Trigo',
    'Arveja',
    'Cebada',
    'Maíz',
    'Girasol',
    'Centeno',
    'Avena'
  ],
  variedades: [
    'CASUARINA',
    'CATALPA',
    'ARAUCARIA',
    'PEHUEN',
    'DM TIPA',
    'BALLTRAP',
    'DM 46i20',
    'P46A03',
    'SY 120',
    'BIO 4.5',
    'ACA 360',
    'BAGUETTE 620',
    'DON MARIO 50i22',
    'SARINA',
    'PULSAR'
  ],
  variedadesDb: VARIEDADES_DB_DEFAULT,
  tipos: [
    'Final',
    'Intermedio',
    'Procesado',
    'Semilla',
    'Descarte',
    'Bajo Consumo',
    'Mezcla',
    'Rechazo'
  ],
  categorias: [
    'Fundadora',
    'PreBase',
    'Original',
    'Primera Multiplicación (PRIMU)',
    'Segunda Multiplicación',
    'Certificada',
    'Identificada',
    'Comercial'
  ],
  tratamientos: [
    'Sin Tratar',
    'Tratado',
    'Curado Completo',
    'Fungicida',
    'Insecticida',
    'Inoculado',
    'Polímero',
    'Rizoderma',
    'Signum 420',
    'Signum Arveja',
    'Maxim',
    'Kit Verdesian'
  ]
};

export const SECTORES_BOLSON_OPCIONES = [
  'Sector A',
  'Sector B',
  'Sector C',
  'Sector D',
  'Sector E',
  'Sector F',
  'Sector G',
  'Sector H',
  'Sector I',
  'Todos'
] as const;

export const CAPACIDAD_MAX_SILO = 180000; // 180.000 kg por silo
export const UMBRAL_ALERTA_SILO = 150000; // Alerta desde 150.000 kg (83.3%)

export type EstadoLoteType = 'Disponible' | 'Reservado' | 'Agotado' | 'A Consumo';

export type EstadoRegistroLote = 'PRE-CARGA' | 'REALIZADO' | 'EN_CURSO';

export interface AuditLogEntry {
  id: string;
  fechaHora: string; // Formato ISO 8601
  tipo: 'Stock' | 'Edición' | 'Creación' | 'Descarte' | 'Limpieza' | 'Ajuste a Cero' | 'Escaneo QR' | 'Eliminación' | 'Arqueo Físico' | string;
  usuario: string; // ej: "Malcon Baez"
  rol?: string; // ej: "Jefe de Planta", "Operario"
  modulo?: 'LOTES' | 'SILOS' | 'BOLSONES' | 'DESPACHOS' | 'ORDENES_PROCESO' | 'SISTEMA' | string;
  entidadId?: string; // ej: Lote ID o Silo ID
  descripcion: string;
  campoModificado?: string; // ej: "stockKg", "variedad", "humedad"
  valorAnterior?: string | number;
  valorNuevo?: string | number;
  detalles?: string; // detalla los cambios o justificación
}

export interface DiscrepanciaStock {
  id: string;
  fechaHora: string;
  siloId?: SiloId | string;
  loteId?: string;
  bolsonId?: string;
  tipoEntidad: 'SILO' | 'LOTE' | 'BOLSON';
  nombreEntidad: string;
  stockTeoricoKg: number;
  stockFisicoKg: number;
  diferenciaKg: number; // teorico - fisico
  porcentajeMerma: number; // (diferencia / teorico) * 100
  estado: 'EXACTO' | 'TOLERABLE' | 'CRITICO';
  observaciones?: string;
  relevador: string;
  rolRelevador?: string;
  ajustadoEnSistema?: boolean;
}

export interface SiloAlertConfig {
  porcentajeAlerta: number; // Ej: 85 (%)
  notificarEmail: boolean;
  emailDestino: string;
}

export interface OfflinePendingIngreso {
  id: string;
  timestamp: number;
  movimiento: MovimientoSilo;
  estado: 'PENDIENTE' | 'SINCRONIZANDO' | 'ERROR';
  errorMsg?: string;
}

export interface MovimientoStock {
  id: string;
  fecha: string; // Formato YYYY-MM-DD
  tipo: 'Entrada' | 'Salida' | 'Entrada por Excel' | 'Entrada manual' | 'Ajuste';
  cantidadBolsas: number;
  kgPorBolsa: number;
  cantidadKg: number;
  detalle: string;
}

export interface OrigenBolsonItem {
  bolsonId?: string;
  bolsonNro?: string;
  sector?: string;
}

export interface Lote {
  id: string; // ID único interno, ej: `${cliente}_${loteNro}`
  loteNro: string; // N° de Lote real editado por el usuario (ej: 58FIN, 32INT)
  cliente: 'San Diego Semilla' | 'Eco Rural' | 'Pampa' | 'Stine' | 'Elementa Foods' | string;
  especie: EspecieType;
  variedad: string;
  tipo: TipoLoteType;
  categoria: CategoriaType;
  tratamiento: TratamientoType[]; // Múltiple o unitario de ['Tratado', 'Sin Tratar']
  producto: string;
  stockBolsas: number;
  kgPorBolsa: number; // Por defecto suele ser 40 o 50 kg
  stockKg: number;
  fechaIngreso: string; // YYYY-MM-DD
  campaniaId?: string; // ID de campaña ej: '2026-2027'
  estado: EstadoLoteType;
  estadoRegistro?: EstadoRegistroLote; // 'PRE-CARGA' | 'REALIZADO'
  fechaHoraProduccion?: string; // Formato YYYY-MM-DDTHH:mm o similar
  observaciones?: string; // Cuadro de observaciones opcional
  historial: MovimientoStock[];
  auditoria?: AuditLogEntry[];
  ala?: string; // ej: 'A' | 'B' | 'C' | 'D'
  sector?: string; // ej: '1' | '2' | '3'
  ordenProcesoId?: string; // ID de la Orden de Proceso vinculada
  numeroOrdenMovimiento?: string; // N° de Orden de Movimiento vinculada si aplica
  fechaTratamiento?: string; // YYYY-MM-DD
  fechaVencimientoTratamiento?: string; // YYYY-MM-DD
  silosOrigen?: SiloExtraccion[]; // Silos de origen y kg extraídos de cada uno
  siloOrigen?: SiloId | string; // Silo de origen principal
  bolsonOrigenId?: string; // ID único del bolsón de origen
  numeroBolsonOrigen?: string; // N° de Bolsón de origen
  bolsonOrigenNro?: string; // Aliased for consistency
  sectorBolsonOrigen?: string; // Sector de bolsón de origen ('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'Todos')
  origenesBolson?: OrigenBolsonItem[]; // Detalle dinámico de orígenes de bolsón con su sector
  ubicacionAcopio?: string; // Ubicación acopio (e.g., 'Ala A - Sector 1' o texto personalizado)
  humedad?: number; // Porcentaje de humedad del lote (% ej: 13.5). Dato informativo, no modifica los kg.
  cicloGerminacion?: CicloGerminacionType | string; // 'Grupo Corto' | 'Grupo Intermedio' | 'Grupo Largo'
}

export interface LoteLimitsConfig {
  maxKgPorLote: number; // Por defecto: 28000 kg
  maxBolsasPorLote: number; // Por defecto: 35 bolsas
  kgPorBolsaDefault: number; // Por defecto: 800 kg
}

export const DEFAULT_LOTE_LIMITS: LoteLimitsConfig = {
  maxKgPorLote: 28000,
  maxBolsasPorLote: 35,
  kgPorBolsaDefault: 800,
};

export interface BolsonCampo {
  id: string; // ID único del bolsón
  campania: string; // ej: "2024/2025", "2025/2026"
  cliente: string; // ej: "San Diego Semilla"
  numeroBolson: string; // N° de Bolsón / Bolsa de Origen (Nº) (ej: "S29,2", "S48,4", "Bolsón 01", "B-101")
  zona?: string; // Zona
  campo?: string; // Campo / Lote
  cultivo: string; // Cultivo / Especie (ej: "Soja", "Trigo", "Arveja")
  ordenSiembra?: string; // Orden de Siembra (ej: "Vacío", "Soja de Primera", "Soja de Segunda")
  cicloCultivo?: string; // Ciclo del Cultivo (ej: "Soja Primera", "Soja Segunda", "Trigo Ciclo Largo")
  cicloGerminacion?: CicloGerminacionType | string; // 'Grupo Corto' | 'Grupo Intermedio' | 'Grupo Largo'
  variedad: string; // Variedad (ej: "DM 46i20", "P46A03")
  categoria: CategoriaType | string; // Categoría ("Fundadora", "Preba", "Original", "Prima", "Primu", etc.)
  deposito?: string; // Depósito Origen / Depósito (ej: "Lote 20", "Lote 10AB", "Depósito Central")
  entradasKg: number; // Ingresos de Kilos / Entradas (kg)
  salidasKg: number; // Kilos Extraídos / Salida (kg)
  stockKg: number; // Existencias kg (Silo Bolsa) / Stock (kg) -> entradasKg - salidasKg
  tipoBolsa?: 'Silobolsa 9 Pies (60m)' | 'Silobolsa 10 Pies (75m)' | 'Big Bag 1000kg' | 'Silobolsa Tricapa Estándar' | string;
  tratamiento?: string; // Tratamiento químico / curado si aplica
  calidad?: string; // Grado / calidad comercial (ej: "GRADO 1", "ESTÁNDAR")
  fechaCosecha?: string; // Fecha de cosecha (ej: "15/04/2026")
  fechaIngreso?: string; // Fecha de ingreso / confección
  capacidadTn?: number; // Capacidad estimada en Toneladas (ej: 200 Tn)
  humedad?: number; // Humedad en % (ej: 13.5)
  rendimiento?: number; // Rendimiento estimado en kg/Ha (ej: 3400)
  superficieHa?: number; // Superficie del lote en Ha (ej: 75)
  coordenadasGis?: string; // Coordenadas GPS / GIS
  estadoBolsa?: 'Con Stock' | 'Stock Bajo' | 'Agotado' | 'En Confección' | string;
  material?: 'Polietileno Tricapa 235µ' | 'Polietileno Pentacapa 240µ' | 'Polipropileno Tejido' | string;
  fechaConfeccion?: string; // YYYY-MM-DD
  observaciones?: string;
}

export interface Chofer {
  id: string;
  nombre: string;
  cuit: string;
  transporte: string;
  patenteChasis?: string;
  patenteAcoplado?: string;
  patenteCamion?: string;
  patentes?: string;
  tara?: number; // Peso de la tara del camión en kg
}

export type SiloId = 'Silo 1' | 'Silo 2' | 'Silo 3' | 'Silo 4' | 'Silo 5' | 'Silo 6';

export const SILOS_DISPONIBLES: SiloId[] = ['Silo 1', 'Silo 2', 'Silo 3', 'Silo 4', 'Silo 5', 'Silo 6'];
export const SILOS_PHYSICAL_ORDER: SiloId[] = ['Silo 4', 'Silo 3', 'Silo 5', 'Silo 2', 'Silo 6', 'Silo 1'];
export const SILOS_MOBILE_ORDER: SiloId[] = ['Silo 1', 'Silo 2', 'Silo 3', 'Silo 4', 'Silo 5', 'Silo 6'];

export type EstadoSiloManual = 'OCUPADO' | 'VACIO_SUCIO' | 'VACIO_LIMPIO';
export type SilosEstadoMap = Record<SiloId, EstadoSiloManual>;

export const SILOS_ESTADO_DEFAULT: SilosEstadoMap = {
  'Silo 1': 'VACIO_LIMPIO',
  'Silo 2': 'VACIO_LIMPIO',
  'Silo 3': 'VACIO_LIMPIO',
  'Silo 4': 'VACIO_LIMPIO',
  'Silo 5': 'VACIO_LIMPIO',
  'Silo 6': 'VACIO_LIMPIO',
};

export interface SiloExtraccion {
  siloId: SiloId;
  kgExtraidos: number;
  kg?: number;
}

export type MotivoSalidaManual = 'Consumo a granel' | 'Manipulación' | 'Traslado a silo' | 'Descarte' | 'Descontaminación varietal';

export type TipoMovimientoSilo = 'INGRESO' | 'EGRESO_OP' | 'EGRESO_MANUAL' | 'EGRESO_LOTE' | 'EGRESO' | 'AJUSTE_ZERO';

export interface MovimientoSilo {
  id: string;
  siloId: SiloId;
  fecha: string; // Formato YYYY-MM-DD
  hora?: string; // Formato HH:MM
  tipo: TipoMovimientoSilo;
  kg: number; // Positivo para INGRESO, o cantidad descontada para EGRESO / AJUSTE

  // Campos para INGRESO:
  cliente?: string;
  especie?: string;
  variedad?: string;
  categoria?: string;
  campoOrigen?: string;
  bolsonOrigenId?: string;
  bolsonOrigenNro?: string;
  bolsonOrigenSector?: string;
  depositoOrigen?: string;
  humedad?: number; // Porcentaje de humedad manual (% ej: 13.5)
  comprobanteCartaPorte?: string; // N° de comprobante / Carta de Porte / Remito
  remito?: string;
  cartaPorte?: string;

  // Campos de movimiento y transporte (Chofer, Patente, CUIT, Transporte):
  tipoTransporte?: 'CHOFER' | 'FLETE';
  chofer?: string;
  cuit?: string;
  patentes?: string;
  transporte?: string;
  tara?: number; // Peso de la tara del camión (kg)
  bruto?: number; // Peso bruto del camión (Tara + Kilos, kg)

  // Campos para EGRESO_MANUAL:
  motivoManual?: MotivoSalidaManual | string;
  descontaminacionVarietal?: boolean;
  observaciones?: string;

  // Campos para EGRESO_OP / EGRESO_LOTE:
  ordenProcesoId?: string;
  numeroOrdenProceso?: string;
  loteId?: string;
  loteResultanteId?: string;
  loteNro?: string;

  // Campos para AJUSTE_ZERO (legacy / compatibilidad):
  usuario?: string;
  usuarioZero?: string;
  motivoAjuste?: string;
  motivoZero?: string;
  kgAntesAjuste?: number;
  timestamp?: string;
}

export type EnvaseType = 'Bolsa 25 kg' | 'Bolsa 30 kg' | 'Big Bag' | 'A granel' | string;

export interface SalidaRegistrada {
  id: string; // Autogenerado REM-XXXX
  fecha: string; // YYYY-MM-DD
  campaniaId?: string; // ID de campaña ej: '2026-2027'
  choferNombre: string;
  choferDni: string;
  patenteCamion?: string; // Campo opcional detallado en sugerencias
  cliente: string;
  loteId: string;
  tipoLote: TipoLoteType; // Heredado, solo lectura
  producto: string; // Heredado, solo lectura
  categoria: CategoriaType; // Heredado, solo lectura
  cantidadBolsas: number;
  envase: EnvaseType;
  kgPorBolsa: number; // Calculado de acuerdo al envase/lote
  totalKg: number;
  taraCamion?: number; // Peso de la tara del camión (kg)
  brutoCamion?: number; // Peso bruto del camión (Tara + Kilos, kg)
  choferFirma?: string; // Firma digital en formato base64 png
  remitoClienteAdjunto?: { nombre: string; data: string; type: string }; // Remito adjunto por el cliente
}

export interface LoteOrigenItem {
  loteId: string;
  loteNro: string;
  variedad?: string;
  cantidadBolsas: number;
  kgTotales: number;
  kgExtraidos?: number;
  stockOriginalKg?: number;
}

export interface OrdenCarga {
  id: string; // OC-2026-XXXX
  fecha: string; // YYYY-MM-DD
  campaniaId?: string; // ID de campaña ej: '2026-2027'
  cliente: 'San Diego Semilla' | 'Eco Rural' | 'Pampa' | 'Stine' | 'Elementa Foods' | string;
  loteId: string;
  cantidadBolsas: number;
  kgTotales: number;
  tipo: TipoLoteType; // Heredado del lote
  categoria: CategoriaType; // Heredado del lote
  tratamiento: TratamientoType; // Heredado del lote
  despachante: string;
  autor: 'Malcon Baez' | 'Amilcar Quiroz'; // Autor de la orden
  estado: 'Disponible' | 'Aceptada' | 'Despachada';
  fotoRemito?: string; // Data URL de la imagen cargada
  firmaChofer?: string; // Data URL de la firma del chofer
  lotesOrigen?: LoteOrigenItem[];
}

export type TipoOrdenProceso = 'PRODUCCION' | 'MOVIMIENTO';
export type EstadoOrdenProceso = 'SIN INICIAR' | 'EN CURSO' | 'TERMINADO';

export interface ProductoTratamiento {
  id?: string;
  principioActivo: string;
  tipos: string[]; // e.g. ['Fungicida', 'Inoculante', 'Insecticidas', 'Polvo Terminación', 'Polímero Líquido', 'Otro']
  tipoOtro?: string;
}

export interface OrdenProceso {
  id: string; // ej: "OP-2026-001"
  numeroOrden: string; // N° de Orden de Proceso (numérico/texto único, ej: "1001")
  tipoOrden: TipoOrdenProceso; // 'PRODUCCION' | 'MOVIMIENTO'
  cliente?: string; // ej: 'San Diego Semilla'
  especie?: EspecieType | string; // ej: 'Soja' | 'Trigo' | 'Arveja'
  tipoMovimiento?: string; // "Intermedio a Final" | "Final a Final Tratado" (solo si MOVIMIENTO)
  numeroOrdenMovimiento?: string; // N° de Orden de Movimiento (solo si MOVIMIENTO)
  envaseDestino?: string; // "Bolsa x 25 Kg" | "Bolsa x 40 Kg" | "Big Bag x 800 Kg"
  tratamiento: string; // ej. "Acelerador / Fungicida" o "Sin tratamiento"
  variedad: string; // ej. "P46A03"
  producto: string; // "INTERMEDIO" | "FINAL" (Etiquetado como "Tipo de Lote")
  productos?: ProductoTratamiento[]; // Lista de hasta 4 productos agregados
  categoria: CategoriaType | string; // ej. "PRIMU"
  bbPedidos: number; // BB / bultos / bins pedidos (objetivo)
  hechos: number; // BB / bultos cumplidos hasta el momento
  estado: EstadoOrdenProceso; // 'SIN INICIAR' | 'EN CURSO' | 'TERMINADO'
  observaciones?: string;
  fechaCreacion: string; // YYYY-MM-DD
  campaniaId?: string; // ej: '2026-2027'
  silosOrigen?: SiloExtraccion[]; // Silos de origen y kg extraídos de cada uno
  lotesOrigen?: LoteOrigenItem[]; // Lotes de origen seleccionados para Orden de Movimiento (hasta 5)
  operarios?: number; // Personal asignado al proceso (ej. 2 o 3 operarios)
  horasTrabajadas?: number; // Horas efectivas de operación en planta (ej. 6.5 hs)
  horasHombre?: number; // Total Horas-Hombre calculadas (operarios * horasTrabajadas)
}


