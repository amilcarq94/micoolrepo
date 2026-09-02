/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Lote, MovimientoStock, TipoLoteType, TratamientoType, EstadoLoteType, LoteLimitsConfig } from '../types';
import { getCampaniaIdFromDate } from '../utils/campanias';
import { validateLoteLimits, getLoteLimits } from '../utils/loteLimits';
import { formatKg, formatNumberArg } from '../utils/formatters';
import { Upload, Download, CheckCircle, AlertTriangle, Play, HelpCircle, FileText, Layers3 } from 'lucide-react';

interface ImportarStockProps {
  existingLotes: Lote[];
  loteLimits?: LoteLimitsConfig;
  onImportConfirm: (lotesNuevos: Lote[], lotesActualizados: Lote[]) => void;
  onCancel: () => void;
}

interface FilaPrevia {
  numeroFila: number;
  loteId: string;
  cliente: string;
  especie: string;
  variedad: string;
  ordenProcesoId: string;
  numeroOrdenMovimiento: string;
  siloOrigen: string;
  numeroBolsonOrigen: string;
  sectorBolsonOrigen: string;
  tipo: string;
  categoria: string;
  tratamiento: string;
  producto: string;
  ubicacionAcopio: string;
  estado: string;
  cantidadBolsas: number;
  kgPorBolsa: number;
  fechaIngreso: string;
  errores: string[];
  valida: boolean;
  existe: boolean;
  acumuladoPrevioBolsas?: number;
  acumuladoPrevioKg?: number;
}

interface ColumnMapping {
  loteId: string;
  cliente: string;
  especie: string;
  variedad: string;
  ordenProcesoId: string;
  numeroOrdenMovimiento: string;
  siloOrigen: string;
  numeroBolsonOrigen: string;
  sectorBolsonOrigen: string;
  tipo: string;
  categoria: string;
  tratamiento: string;
  producto: string;
  ubicacionAcopio: string;
  estado: string;
  cantidadBolsas: string;
  kgPorBolsa: string;
  fechaIngreso: string;
}

export const ImportarStock: React.FC<ImportarStockProps> = ({
  existingLotes,
  loteLimits,
  onImportConfirm,
  onCancel,
}) => {
  const activeLimits = loteLimits || getLoteLimits();
  const [dragActive, setDragActive] = useState(false);
  const [filasPrevias, setFilasPrevias] = useState<FilaPrevia[]>([]);
  const [archivoNombre, setArchivoNombre] = useState('');
  const [infoMensaje, setInfoMensaje] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States for interactive manual column mapping
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [excelRows, setExcelRows] = useState<any[][]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    loteId: '',
    cliente: '',
    especie: '',
    variedad: '',
    ordenProcesoId: '',
    numeroOrdenMovimiento: '',
    siloOrigen: '',
    numeroBolsonOrigen: '',
    sectorBolsonOrigen: '',
    tipo: '',
    categoria: '',
    tratamiento: '',
    producto: '',
    ubicacionAcopio: '',
    estado: '',
    cantidadBolsas: '',
    kgPorBolsa: '',
    fechaIngreso: '',
  });
  const [showMapping, setShowMapping] = useState(false);

  // Generar y descargar la plantilla Excel ideal con las 16 columnas oficiales
  const handleDescargarPlantilla = () => {
    const headers = [
      [
        "Fecha de realizado",
        "Especie",
        "Variedad",
        "Número de lote",
        "N° Orden de Proceso / Movimiento",
        "Silo de origen",
        "N° de Bolsón de origen",
        "Sector de Bolsón de origen",
        "Stock bolsas",
        "Kg por bolsa",
        "Stock total",
        "Tipo de lote",
        "Categoría",
        "Tratamiento",
        "Ubicación acopio",
        "Estado",
        "Cliente"
      ]
    ];
    const rows = [
      [
        "2026-07-09",
        "Soja",
        "DM 46R18 GTS",
        "LB-2026-0010",
        "OP-104",
        "Silo 01",
        "Bolsón 04",
        "A",
        20,
        800,
        16000,
        "Final",
        "Original",
        "Sin Tratar",
        "Ala A - Sector 1",
        "Disponible",
        "San Diego Semilla"
      ],
      [
        "2026-07-08",
        "Trigo",
        "Baguette 620",
        "LB-2026-0011",
        "OP-105",
        "Silo 02",
        "Bolsón 02",
        "B",
        15,
        800,
        12000,
        "Intermedio",
        "Fundadora",
        "Tratado",
        "Ala B - Sector 2",
        "Disponible",
        "San Diego Semilla"
      ]
    ];

    const data = [...headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(data);
    
    // Ajustar anchos de columna para lectura clara
    ws['!cols'] = [
      { wch: 15 }, // Fecha
      { wch: 12 }, // Especie
      { wch: 16 }, // Variedad
      { wch: 16 }, // N° Lote
      { wch: 22 }, // Orden Proceso
      { wch: 14 }, // Silo
      { wch: 18 }, // Bolsón
      { wch: 12 }, // Sector
      { wch: 14 }, // Bolsas
      { wch: 12 }, // Kg/bolsa
      { wch: 14 }, // Total
      { wch: 12 }, // Tipo
      { wch: 14 }, // Categoria
      { wch: 14 }, // Tratamiento
      { wch: 18 }, // Ubicación
      { wch: 12 }, // Estado
      { wch: 20 }  // Cliente
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla Carga Lotes");
    XLSX.writeFile(wb, "plantilla_carga_masiva_lotes.xlsx");
  };

  // Manejo de carga de archivos por click o arrastre
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      procesarArchivo(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      procesarArchivo(e.target.files[0]);
    }
  };

  // Helper to auto-match column names based on synonyms
  const autoMatchColumn = (headers: string[], matches: string[]): string => {
    const foundIdx = headers.findIndex(h => matches.some(match => h.toLowerCase() === match.toLowerCase() || h.toLowerCase().includes(match.toLowerCase())));
    return foundIdx !== -1 ? headers[foundIdx] : '';
  };

  // Parsear el archivo Excel en el cliente
  const procesarArchivo = (file: File) => {
    setArchivoNombre(file.name);
    setInfoMensaje('');
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        
        // Tomamos la primera hoja de cálculo
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convertir a JSON crudo
        const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (rows.length < 2) {
          setInfoMensaje('El archivo de Excel parece estar vacío o no contiene filas de datos.');
          return;
        }

        // El encabezado está en la primera fila
        const rawHeaders = rows[0].map((h: any) => h ? String(h).trim() : '');
        setExcelHeaders(rawHeaders);
        setExcelRows(rows.slice(1));

        // Auto-build the mapping
        const newMapping: ColumnMapping = {
          loteId: autoMatchColumn(rawHeaders, ["número de lote", "numero de lote", "lote", "id lote", "id", "número lote"]),
          cliente: autoMatchColumn(rawHeaders, ["cliente", "productor", "comitente"]),
          especie: autoMatchColumn(rawHeaders, ["especie", "grano", "cultivo"]),
          variedad: autoMatchColumn(rawHeaders, ["variedad", "semilla"]),
          ordenProcesoId: autoMatchColumn(rawHeaders, ["orden de proceso / movimiento", "orden de proceso", "orden proceso", "op", "n° orden"]),
          numeroOrdenMovimiento: autoMatchColumn(rawHeaders, ["n° orden movimiento", "orden movimiento", "om"]),
          siloOrigen: autoMatchColumn(rawHeaders, ["silo de origen", "silo origen", "silo"]),
          numeroBolsonOrigen: autoMatchColumn(rawHeaders, ["n° de bolsón de origen", "bolsón de origen", "bolson de origen", "bolsón", "bolson"]),
          sectorBolsonOrigen: autoMatchColumn(rawHeaders, ["sector de bolsón de origen", "sector de bolsón", "sector bolsón", "sector bolson", "sector"]),
          tipo: autoMatchColumn(rawHeaders, ["tipo de lote", "tipo"]),
          categoria: autoMatchColumn(rawHeaders, ["categoría", "categoria", "clasificación"]),
          tratamiento: autoMatchColumn(rawHeaders, ["tratamiento", "curas", "procesos"]),
          producto: autoMatchColumn(rawHeaders, ["producto", "quimico", "terápico", "terapico"]),
          ubicacionAcopio: autoMatchColumn(rawHeaders, ["ubicación acopio", "ubicacion acopio", "ubicación", "ubicacion", "ala"]),
          estado: autoMatchColumn(rawHeaders, ["estado", "condición", "condicion"]),
          cantidadBolsas: autoMatchColumn(rawHeaders, ["stock bolsas", "cantidad de bolsas", "bolsas", "cantidad bolsas", "cantidad"]),
          kgPorBolsa: autoMatchColumn(rawHeaders, ["kg por bolsa", "kg/bolsa", "kilogramos por bolsa", "peso bolsa", "peso"]),
          fechaIngreso: autoMatchColumn(rawHeaders, ["fecha de realizado", "fecha de ingreso", "fecha ingreso", "fecha", "ingreso"]),
        };

        setColumnMapping(newMapping);
        setShowMapping(true);
      } catch (err: any) {
        console.error(err);
        setInfoMensaje(`Error crítico al parsear el archivo Excel: ${err.message || err}`);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmMapping = () => {
    // Validar columnas requeridas mínimas
    if (!columnMapping.loteId || !columnMapping.cliente || !columnMapping.especie) {
      setInfoMensaje('Por favor mapee las columnas obligatorias: Número de Lote, Cliente y Especie.');
      return;
    }
    setInfoMensaje('');

    const idxLote = excelHeaders.indexOf(columnMapping.loteId);
    const idxCliente = excelHeaders.indexOf(columnMapping.cliente);
    const idxEspecie = excelHeaders.indexOf(columnMapping.especie);
    const idxVariedad = columnMapping.variedad ? excelHeaders.indexOf(columnMapping.variedad) : -1;
    const idxOp = columnMapping.ordenProcesoId ? excelHeaders.indexOf(columnMapping.ordenProcesoId) : -1;
    const idxOm = columnMapping.numeroOrdenMovimiento ? excelHeaders.indexOf(columnMapping.numeroOrdenMovimiento) : -1;
    const idxSilo = columnMapping.siloOrigen ? excelHeaders.indexOf(columnMapping.siloOrigen) : -1;
    const idxBolson = columnMapping.numeroBolsonOrigen ? excelHeaders.indexOf(columnMapping.numeroBolsonOrigen) : -1;
    const idxSectorBolson = columnMapping.sectorBolsonOrigen ? excelHeaders.indexOf(columnMapping.sectorBolsonOrigen) : -1;
    const idxTipo = columnMapping.tipo ? excelHeaders.indexOf(columnMapping.tipo) : -1;
    const idxCategoria = columnMapping.categoria ? excelHeaders.indexOf(columnMapping.categoria) : -1;
    const idxTratamiento = columnMapping.tratamiento ? excelHeaders.indexOf(columnMapping.tratamiento) : -1;
    const idxProducto = columnMapping.producto ? excelHeaders.indexOf(columnMapping.producto) : -1;
    const idxUbicacion = columnMapping.ubicacionAcopio ? excelHeaders.indexOf(columnMapping.ubicacionAcopio) : -1;
    const idxEstado = columnMapping.estado ? excelHeaders.indexOf(columnMapping.estado) : -1;
    const idxBolsas = columnMapping.cantidadBolsas ? excelHeaders.indexOf(columnMapping.cantidadBolsas) : -1;
    const idxKgBolsa = columnMapping.kgPorBolsa ? excelHeaders.indexOf(columnMapping.kgPorBolsa) : -1;
    const idxFecha = columnMapping.fechaIngreso ? excelHeaders.indexOf(columnMapping.fechaIngreso) : -1;

    // Mapa de acumulación progresiva por Lote durante la validación del Excel
    const runningTallyMap = new Map<string, { bolsas: number; kg: number }>();
    existingLotes.forEach(l => {
      const key = (l.loteNro || l.id).trim().toLowerCase();
      runningTallyMap.set(key, { bolsas: l.stockBolsas || 0, kg: l.stockKg || 0 });
    });

    const filasProcesadas: FilaPrevia[] = [];

    for (let i = 0; i < excelRows.length; i++) {
      const row = excelRows[i];
      if (!row || row.length === 0 || row.every((cell: any) => cell === null || cell === undefined || cell === '')) {
        continue; // Saltar vacías
      }

      const rawLoteId = idxLote !== -1 && row[idxLote] ? String(row[idxLote]).trim() : '';
      const rawCliente = idxCliente !== -1 && row[idxCliente] ? String(row[idxCliente]).trim() : 'San Diego Semilla';
      const rawEspecie = idxEspecie !== -1 && row[idxEspecie] ? String(row[idxEspecie]).trim() : '';
      const rawVariedad = idxVariedad !== -1 && row[idxVariedad] ? String(row[idxVariedad]).trim() : 'Sin variedad';
      const rawOp = idxOp !== -1 && row[idxOp] ? String(row[idxOp]).trim() : '';
      const rawOm = idxOm !== -1 && row[idxOm] ? String(row[idxOm]).trim() : '';
      const rawSilo = idxSilo !== -1 && row[idxSilo] ? String(row[idxSilo]).trim() : '';
      const rawBolson = idxBolson !== -1 && row[idxBolson] ? String(row[idxBolson]).trim() : '';
      const rawSectorBolson = idxSectorBolson !== -1 && row[idxSectorBolson] ? String(row[idxSectorBolson]).trim() : '';
      const rawTipo = idxTipo !== -1 && row[idxTipo] ? String(row[idxTipo]).trim() : 'Final';
      const rawCategoria = idxCategoria !== -1 && row[idxCategoria] ? String(row[idxCategoria]).trim() : 'Original';
      const rawTratamiento = idxTratamiento !== -1 && row[idxTratamiento] ? String(row[idxTratamiento]).trim() : 'Sin Tratar';
      let rawProducto = idxProducto !== -1 && row[idxProducto] ? String(row[idxProducto]).trim() : 'Ninguno';
      if (!rawTratamiento || rawTratamiento.toLowerCase().includes('sin')) {
        rawProducto = 'Ninguno';
      }
      const rawUbicacion = idxUbicacion !== -1 && row[idxUbicacion] ? String(row[idxUbicacion]).trim() : 'Ala A - Sector 1';
      const rawEstado = idxEstado !== -1 && row[idxEstado] ? String(row[idxEstado]).trim() : 'Disponible';
      
      const rawBolsas = idxBolsas !== -1 ? parseInt(row[idxBolsas], 10) : NaN;
      const rawKgBolsa = idxKgBolsa !== -1 ? parseInt(row[idxKgBolsa], 10) : activeLimits.kgPorBolsaDefault;
      
      let rawFecha = '';
      if (idxFecha !== -1 && row[idxFecha]) {
        if (row[idxFecha] instanceof Date) {
          rawFecha = row[idxFecha].toISOString().split('T')[0];
        } else {
          rawFecha = String(row[idxFecha]).trim();
          if (rawFecha.includes('/')) {
            const p = rawFecha.split('/');
            if (p.length === 3) {
              rawFecha = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
            }
          }
        }
      } else {
        rawFecha = new Date().toISOString().split('T')[0];
      }

      const errores: string[] = [];
      if (!rawLoteId) errores.push('Falta Número de Lote.');
      if (!rawCliente) errores.push('Falta especificar el Cliente.');
      if (!rawEspecie) errores.push('Falta especificar la Especie de grano.');
      
      if (isNaN(rawBolsas) || rawBolsas < 0) {
        errores.push('Cantidad de bolsas inválida o negativa.');
      }
      if (isNaN(rawKgBolsa) || rawKgBolsa <= 0) {
        errores.push('Kg por bolsa inválido.');
      }

      const loteKey = rawLoteId.toLowerCase();
      const accum = runningTallyMap.get(loteKey) || { bolsas: 0, kg: 0 };
      const rowBolsas = isNaN(rawBolsas) ? 0 : rawBolsas;
      const rowKgBolsaVal = isNaN(rawKgBolsa) ? activeLimits.kgPorBolsaDefault : rawKgBolsa;
      const rowKg = rowBolsas * rowKgBolsaVal;

      // Validar Límites Máximos por Lote (Punto 5 y 6)
      if (rawLoteId && !isNaN(rowBolsas) && !isNaN(rowKgBolsaVal)) {
        const valResult = validateLoteLimits(accum.kg, accum.bolsas, rowKg, rowBolsas, activeLimits);
        if (!valResult.allowed) {
          errores.push(valResult.errorMessage || 'Excede el límite máximo por lote.');
        }
      }

      const existeLote = existingLotes.some(
        l => (l.loteNro || l.id).toLowerCase() === rawLoteId.toLowerCase() ||
             l.id.toLowerCase() === `${rawCliente.replace(/\s+/g, '_')}_${rawLoteId}`.toLowerCase()
      );

      const isValidRow = errores.length === 0;

      if (isValidRow && rawLoteId) {
        runningTallyMap.set(loteKey, {
          bolsas: accum.bolsas + rowBolsas,
          kg: accum.kg + rowKg,
        });
      }

      filasProcesadas.push({
        numeroFila: i + 2, // Fila en excel (+1 por cabecera, +1 por índice 0)
        loteId: rawLoteId,
        cliente: rawCliente,
        especie: rawEspecie,
        variedad: rawVariedad,
        ordenProcesoId: rawOp,
        numeroOrdenMovimiento: rawOm,
        siloOrigen: rawSilo,
        numeroBolsonOrigen: rawBolson,
        sectorBolsonOrigen: rawSectorBolson,
        tipo: rawTipo,
        categoria: rawCategoria,
        tratamiento: rawTratamiento,
        producto: rawProducto,
        ubicacionAcopio: rawUbicacion,
        estado: rawEstado,
        cantidadBolsas: isNaN(rawBolsas) ? 0 : rawBolsas,
        kgPorBolsa: isNaN(rawKgBolsa) ? activeLimits.kgPorBolsaDefault : rawKgBolsa,
        fechaIngreso: rawFecha || new Date().toISOString().split('T')[0],
        errores,
        valida: isValidRow,
        existe: existeLote,
        acumuladoPrevioBolsas: accum.bolsas,
        acumuladoPrevioKg: accum.kg,
      });
    }

    setFilasPrevias(filasProcesadas);
    setShowMapping(false);
  };

  const handleConfirmarImportacion = () => {
    const validas = filasPrevias.filter(f => f.valida);
    if (validas.length === 0) {
      setInfoMensaje('No hay ninguna fila válida que cumpla los criterios mínimos para importar.');
      return;
    }

    const nuevosLotesMap = new Map<string, Lote>();
    const actualizadosLotesMap = new Map<string, Lote>();

    validas.forEach(f => {
      const tratamientosArray: TratamientoType[] = f.tratamiento
        .split(',')
        .map(t => {
          const trimT = t.trim().toLowerCase();
          if (trimT.includes('sin tratar')) return 'Sin Tratar';
          return 'Tratado';
        });

      const uniqueId = `${f.cliente.replace(/\s+/g, '_')}_${f.loteId}`;
      const loteKey = f.loteId.toLowerCase();

      // Buscar si el lote ya existe en la base o si fue creado/actualizado previamente en esta misma importación
      let loteExistente = actualizadosLotesMap.get(loteKey) || 
                          nuevosLotesMap.get(loteKey) || 
                          existingLotes.find(l => (l.loteNro || l.id).toLowerCase() === loteKey || l.id.toLowerCase() === uniqueId.toLowerCase());

      const rowBolsas = f.cantidadBolsas;
      const rowKgBolsa = f.kgPorBolsa || activeLimits.kgPorBolsaDefault;
      const rowKg = rowBolsas * rowKgBolsa;

      if (loteExistente) {
        // Lote existente: sumamos stock (acumulación Punto 5)
        const nuevasBolsas = loteExistente.stockBolsas + rowBolsas;
        const nuevosKg = loteExistente.stockKg + rowKg;
        
        let nuevoEstado: EstadoLoteType = loteExistente.estado;
        if (nuevasBolsas > 0 && loteExistente.estado === 'Agotado') {
          nuevoEstado = 'Disponible';
        }

        const movimiento: MovimientoStock = {
          id: `MOV-EXCEL-${Date.now()}-${Math.random()}`,
          fecha: f.fechaIngreso,
          tipo: 'Entrada por Excel',
          cantidadBolsas: rowBolsas,
          kgPorBolsa: rowKgBolsa,
          cantidadKg: rowKg,
          detalle: `Importado de Excel (${archivoNombre})`
        };

        const loteActualizado: Lote = {
          ...loteExistente,
          stockBolsas: nuevasBolsas,
          stockKg: nuevosKg,
          estado: nuevoEstado,
          historial: [movimiento, ...(loteExistente.historial || [])]
        };
        
        if (existingLotes.some(l => (l.loteNro || l.id).toLowerCase() === loteKey || l.id.toLowerCase() === uniqueId.toLowerCase())) {
          actualizadosLotesMap.set(loteKey, loteActualizado);
        } else {
          nuevosLotesMap.set(loteKey, loteActualizado);
        }
      } else {
        // Lote nuevo: lo creamos
        const estadoInicial: EstadoLoteType = (f.estado as EstadoLoteType) || (rowBolsas > 0 ? 'Disponible' : 'Agotado');

        const movimientoInicial: MovimientoStock = {
          id: `MOV-EXCEL-${Date.now()}-${Math.random()}`,
          fecha: f.fechaIngreso,
          tipo: 'Entrada',
          cantidadBolsas: rowBolsas,
          kgPorBolsa: rowKgBolsa,
          cantidadKg: rowKg,
          detalle: `Ingreso lote nuevo por importación Excel (${archivoNombre})`
        };

        const nuevoLote: Lote = {
          id: uniqueId,
          loteNro: f.loteId,
          cliente: f.cliente,
          especie: f.especie,
          variedad: f.variedad,
          tipo: f.tipo as TipoLoteType,
          categoria: (f.categoria as any) || 'Original',
          tratamiento: tratamientosArray,
          producto: f.producto || 'Ninguno',
          stockBolsas: rowBolsas,
          kgPorBolsa: rowKgBolsa,
          stockKg: rowKg,
          fechaIngreso: f.fechaIngreso,
          campaniaId: getCampaniaIdFromDate(f.fechaIngreso),
          estado: estadoInicial,
          ordenProcesoId: f.ordenProcesoId || undefined,
          numeroOrdenMovimiento: f.numeroOrdenMovimiento || undefined,
          siloOrigen: f.siloOrigen || undefined,
          numeroBolsonOrigen: f.numeroBolsonOrigen || undefined,
          bolsonOrigenNro: f.numeroBolsonOrigen || undefined,
          sectorBolsonOrigen: f.sectorBolsonOrigen || undefined,
          ubicacionAcopio: f.ubicacionAcopio || undefined,
          historial: [movimientoInicial]
        };

        nuevosLotesMap.set(loteKey, nuevoLote);
      }
    });

    onImportConfirm(Array.from(nuevosLotesMap.values()), Array.from(actualizadosLotesMap.values()));
  };

  const fileInputClick = () => {
    fileInputRef.current?.click();
  };

  const cantValidas = filasPrevias.filter(f => f.valida).length;
  const cantInvalidas = filasPrevias.filter(f => !f.valida).length;

  if (showMapping) {
    const fieldsToMap: { key: keyof ColumnMapping; label: string; desc: string; mandatory: boolean }[] = [
      { key: 'loteId', label: 'Número de Lote', desc: 'Identificador único del lote (e.g. LB-2026-0001)', mandatory: true },
      { key: 'cliente', label: 'Cliente', desc: 'Productor / Comitente dueño de la semilla', mandatory: true },
      { key: 'especie', label: 'Especie', desc: 'Tipo de grano (e.g. Soja, Trigo, Arveja)', mandatory: true },
      { key: 'variedad', label: 'Variedad', desc: 'Variedad específica de la semilla', mandatory: false },
      { key: 'tipo', label: 'Tipo de Lote', desc: 'Final, Intermedio, etc.', mandatory: false },
      { key: 'tratamiento', label: 'Tratamiento', desc: 'Procesos aplicados (Tratado , Sin Tratar, etc.)', mandatory: false },
      { key: 'producto', label: 'Producto Químico', desc: 'Terápicos o activos químicos aplicados', mandatory: false },
      { key: 'cantidadBolsas', label: 'Cantidad de Bolsas', desc: 'Bolsas físicas ingresadas', mandatory: false },
      { key: 'kgPorBolsa', label: 'Kg por Bolsa', desc: 'Peso individual de cada bolsa (e.g. 25 o 40 kg)', mandatory: false },
      { key: 'fechaIngreso', label: 'Fecha de Ingreso', desc: 'Fecha de ingreso en la planta', mandatory: false },
    ];

    const unmappedExcelHeaders = excelHeaders.filter(h => 
      !Object.values(columnMapping).includes(h)
    );

    return (
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6 max-w-4xl mx-auto" id="column-mapping-container">
        <div className="border-b border-gray-100 pb-4">
          <span className="text-[10px] font-sans font-bold tracking-widest text-[#00603C] uppercase">
            SISTEMA INTELIGENTE DE TRAZABILIDAD
          </span>
          <h3 className="font-serif text-2xl font-bold text-gray-900 mt-1">
            Mapeo Manual de Columnas
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Detectamos las columnas de su archivo <strong>{archivoNombre}</strong>. Por favor confirme el mapeo con los campos requeridos por AgroAbacus.
          </p>
        </div>

        {unmappedExcelHeaders.length > 0 && (
          <div className="bg-[#F6EFDC] text-gray-700 p-3.5 rounded-xl border border-[#C9922E]/20 text-xs flex gap-2">
            <HelpCircle className="w-5 h-5 text-[#C9922E] shrink-0" />
            <div>
              <span className="font-bold text-[#A0522D] block uppercase text-[10px] tracking-wider mb-0.5">Columnas extras o con otro nombre detectadas:</span>
              <span>El archivo contiene las siguientes columnas extras que no están mapeadas: <strong>{unmappedExcelHeaders.join(', ')}</strong>. Se ignorarán o puedes mapearlas a continuación.</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fieldsToMap.map((f) => {
            const hasMatched = !!columnMapping[f.key];
            return (
              <div 
                key={f.key} 
                className={`p-4 rounded-xl border transition flex flex-col justify-between ${
                  hasMatched 
                    ? 'bg-white border-gray-100 hover:border-gray-300' 
                    : f.mandatory 
                    ? 'bg-red-50/50 border-red-200' 
                    : 'bg-gray-50/50 border-gray-100'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-800 flex items-center gap-1">
                      {f.label}
                      {f.mandatory && <span className="text-red-500 font-bold">*</span>}
                    </span>
                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      f.mandatory 
                        ? 'bg-red-100 text-red-700 font-semibold' 
                        : 'bg-gray-200 text-gray-600'
                    }`}>
                      {f.mandatory ? 'Obligatorio' : 'Opcional'}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                    {f.desc}
                  </p>
                </div>

                <div className="mt-3">
                  <select
                    value={columnMapping[f.key]}
                    onChange={(e) => setColumnMapping(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className={`w-full bg-white border rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#00603C] ${
                      columnMapping[f.key] ? 'border-gray-300 text-gray-800 font-sans' : 'border-dashed border-gray-300 text-gray-400 font-sans'
                    }`}
                  >
                    <option value="">-- No mapear (Ignorar) --</option>
                    {excelHeaders.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>

        {infoMensaje && (
          <div className="bg-[#F5E5DC] text-[#A0522D] p-3 rounded-xl border border-red-200 text-xs flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{infoMensaje}</span>
          </div>
        )}

        <div className="flex justify-between items-center border-t border-gray-100 pt-4">
          <button
            onClick={() => {
              setShowMapping(false);
              setArchivoNombre('');
              setExcelHeaders([]);
              setExcelRows([]);
            }}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-semibold uppercase tracking-wider cursor-pointer"
          >
            Atrás
          </button>
          
          <button
            onClick={handleConfirmMapping}
            className="flex items-center gap-1.5 px-6 py-2.5 bg-[#00603C] hover:bg-[#254731] text-white rounded-lg text-xs font-semibold uppercase tracking-wider shadow cursor-pointer"
          >
            <Play className="w-4 h-4 text-[#C9922E]" />
            <span>Procesar Columnas y Ver Vista Previa</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="importar-stock-container">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
        <div>
          <span className="text-xs font-sans font-semibold tracking-widest text-[#00603C] uppercase">
            IMPORTACIÓN MASIVA
          </span>
          <h2 className="font-serif text-3xl font-bold text-[#1A1A1A] mt-1">
            Importar Acopio desde Excel
          </h2>
        </div>

        <button
          onClick={handleDescargarPlantilla}
          className="flex items-center gap-2 px-4 py-2 bg-[#F6EFDC] text-[#C9922E] border border-[#C9922E] border-opacity-30 rounded-lg hover:bg-amber-50 transition text-xs font-semibold"
        >
          <Download className="w-4 h-4" />
          Descargar Plantilla Modelo (.xlsx)
        </button>
      </div>

      {/* Zona Drag & Drop */}
      {filasPrevias.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center max-w-3xl mx-auto">
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={fileInputClick}
            className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer transition ${
              dragActive ? 'border-[#00603C] bg-[#E3EFE7] bg-opacity-20' : 'border-gray-200 hover:border-[#00603C] hover:bg-[#E3EFE7] hover:bg-opacity-5'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx, .xls"
              className="hidden"
            />
            <Upload className="w-12 h-12 text-[#00603C] mb-4 opacity-80" />
            <h4 className="font-serif text-xl font-bold text-gray-800 mb-1">
              Arrastre su archivo de Excel aquí
            </h4>
            <p className="text-xs text-gray-500 mb-2">
              o haga click para buscar en su equipo (.xlsx, .xls)
            </p>
            <div className="bg-[#F6EFDC] px-4 py-1.5 rounded-full text-[10px] text-gray-600 font-sans font-medium flex items-center gap-1.5 mt-2 border border-amber-100">
              <HelpCircle className="w-3.5 h-3.5 text-[#C9922E]" />
              Asegúrese de usar las columnas exactas de nuestra planilla de ejemplo
            </div>
          </div>
        </div>
      ) : (
        /* Panel de Vista Previa */
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#E3EFE7] rounded-xl text-[#00603C]">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-[#1A1A1A]">{archivoNombre}</h4>
                <p className="text-xs text-gray-500">
                  {filasPrevias.length} filas leídas —{' '}
                  <span className="font-bold text-[#00603C]">{cantValidas} listas para importar</span>
                  {cantInvalidas > 0 && (
                    <span>
                      , <span className="font-bold text-[#A0522D]">{cantInvalidas} con observaciones (se omitirán)</span>
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setFilasPrevias([]);
                  setArchivoNombre('');
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-semibold uppercase tracking-wider"
              >
                Cargar Otro
              </button>
              <button
                onClick={handleConfirmarImportacion}
                disabled={cantValidas === 0}
                className="flex items-center gap-1.5 px-5 py-2 bg-[#00603C] hover:bg-[#254731] text-white rounded-lg text-xs font-semibold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed shadow"
              >
                <CheckCircle className="w-4 h-4 text-[#C9922E]" />
                Confirmar Importación ({cantValidas} filas)
              </button>
            </div>
          </div>

          {/* Tabla de Preview con las filas */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#00603C] text-white text-[10px] uppercase tracking-wider">
                    <th className="py-3 px-4 text-center">Fila</th>
                    <th className="py-3 px-4">Lote ID</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Especie / Variedad</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4 text-right">Bolsas</th>
                    <th className="py-3 px-4 text-right">Kg/B.</th>
                    <th className="py-3 px-4 text-center">Trazabilidad</th>
                    <th className="py-3 px-4">Estado / Observación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {filasPrevias.map((f, index) => {
                    const rowBg = !f.valida
                      ? 'bg-[#F5E5DC]' // Error, terracota
                      : f.existe
                      ? 'bg-[#F6EFDC] bg-opacity-60' // Existe, dorado
                      : index % 2 === 0
                      ? 'bg-white'
                      : 'bg-[#E3EFE7] bg-opacity-25';

                    return (
                      <tr key={f.numeroFila} className={`${rowBg} transition`}>
                        <td className="py-3 px-4 text-center font-mono text-gray-400">{f.numeroFila}</td>
                        <td className="py-3 px-4 font-mono font-bold text-gray-800">{f.loteId || 'N/A'}</td>
                        <td className="py-3 px-4 font-semibold">{f.cliente || 'N/A'}</td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-gray-900 block">{f.especie || 'N/A'}</span>
                          <span className="text-[10px] text-gray-500 block">{f.variedad}</span>
                        </td>
                        <td className="py-3 px-4 text-gray-600">{f.tipo}</td>
                        <td className="py-3 px-4 text-right font-bold text-gray-800">
                          {f.valida ? formatNumberArg(f.cantidadBolsas, 0) : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-gray-600">
                          {f.valida ? `${f.kgPorBolsa} kg` : '—'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {f.existe ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#C9922E] bg-opacity-20 text-[#A0522D] border border-[#C9922E] border-opacity-30">
                              Suma a Lote
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#00603C] bg-opacity-15 text-[#00603C] border border-[#E3EFE7]">
                              Lote Nuevo
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {f.valida ? (
                            <span className="text-[#00603C] font-semibold flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5" /> Correcto
                            </span>
                          ) : (
                            <div className="text-[#A0522D] space-y-0.5 text-[10px]">
                              {f.errores.map((err, errIdx) => (
                                <div key={errIdx} className="flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 shrink-0" />
                                  <span>{err}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Alertas Generales */}
      {infoMensaje && (
        <div className="bg-[#F5E5DC] text-[#A0522D] p-4 rounded-xl border border-red-200 text-xs flex gap-3 max-w-3xl mx-auto">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{infoMensaje}</span>
        </div>
      )}

      {/* Cancelar / Volver */}
      <div className="flex justify-end pt-4">
        <button
          onClick={onCancel}
          className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-500 rounded-lg hover:bg-gray-100 transition"
        >
          Volver al Menú
        </button>
      </div>
    </div>
  );
};
