/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Lote, EspecieType, TipoLoteType, TratamientoType, EstadoLoteType, EstadoRegistroLote, CategoriaType, OrdenProceso, SiloId, SiloExtraccion, MovimientoSilo, BolsonCampo, LoteLimitsConfig, MovimientoStock, CicloGerminacionType, CICLOS_GERMINACION, PlantaConfig } from '../types';
import { generateLoteId, formatKg } from '../utils/formatters';
import { getCampaniaIdFromDate } from '../utils/campanias';
import { validateLoteLimits, getLoteLimits } from '../utils/loteLimits';
import { validateSiloLoteMatch } from '../utils/siloValidation';
import { SilosSelector } from './SilosSelector';
import { ClienteSelect } from './ClienteSelect';
import { Save, RotateCcw, AlertTriangle, Plus, Check, Calendar, Factory, Truck, Clock, CheckCircle2, CalendarDays, Info, Trash2, Layers3, Download } from 'lucide-react';
import { ImprimirFichaTecnica } from './ImprimirFichaTecnica';

interface LoteFormProps {
  existingLotes: Lote[];
  ordenesProceso?: OrdenProceso[];
  movimientosSilo?: MovimientoSilo[];
  bolsones?: BolsonCampo[];
  clientes: string[];
  especies: string[];
  plantaConfig?: PlantaConfig;
  loteAEditar?: Lote | null;
  activeCampaniaId?: string;
  siloStocks?: Record<SiloId, number>;
  loteLimits?: LoteLimitsConfig;
  onSave: (lote: Lote) => void;
  onCancel: () => void;
  onCreateOrdenProcesoClick?: () => void;
}

const getTodayDateStr = () => {
  return new Date().toISOString().split('T')[0];
};

export const LoteForm: React.FC<LoteFormProps> = ({
  existingLotes,
  ordenesProceso = [],
  movimientosSilo = [],
  bolsones = [],
  clientes,
  especies,
  plantaConfig,
  loteAEditar,
  siloStocks,
  loteLimits,
  onSave,
  onCancel,
  onCreateOrdenProcesoClick,
}) => {
  const isEditing = !!loteAEditar;
  const activeLimits = loteLimits || getLoteLimits();

  const especiesList = useMemo(() => {
    return plantaConfig?.especies && plantaConfig.especies.length > 0
      ? plantaConfig.especies
      : (especies && especies.length > 0 ? especies : ['Soja', 'Trigo', 'Arveja', 'Cebada', 'Maíz', 'Girasol']);
  }, [plantaConfig, especies]);

  const variedadesList = useMemo(() => {
    return plantaConfig?.variedades && plantaConfig.variedades.length > 0
      ? plantaConfig.variedades
      : [];
  }, [plantaConfig]);

  const tiposList = useMemo(() => {
    return plantaConfig?.tipos && plantaConfig.tipos.length > 0
      ? plantaConfig.tipos
      : ['Intermedio', 'Final', 'Procesado', 'Semilla', 'Descarte'];
  }, [plantaConfig]);

  const categoriasList = useMemo(() => {
    return plantaConfig?.categorias && plantaConfig.categorias.length > 0
      ? plantaConfig.categorias
      : ['Fundadora', 'PreBase', 'Original', 'Primera Multiplicación (PRIMU)'];
  }, [plantaConfig]);

  const tratamientosList = useMemo(() => {
    return plantaConfig?.tratamientos && plantaConfig.tratamientos.length > 0
      ? plantaConfig.tratamientos
      : ['Sin Tratar', 'Tratado'];
  }, [plantaConfig]);

  // Estados del Formulario
  const [id, setId] = useState('');
  const [loteNro, setLoteNro] = useState('');
  const [cliente, setCliente] = useState('San Diego Semilla');
  const [especie, setEspecie] = useState<EspecieType>('Soja');

  const [variedad, setVariedad] = useState('');
  const [tipo, setTipo] = useState<TipoLoteType>('Final');
  const [categoria, setCategoria] = useState<CategoriaType>('Original');
  const [tratamientos, setTratamientos] = useState<TratamientoType[]>(['Sin Tratar']);
  const [producto, setProducto] = useState('Ninguno');
  const [stockBolsas, setStockBolsas] = useState<number>(20);
  const [kgPorBolsa, setKgPorBolsa] = useState<number>(activeLimits.kgPorBolsaDefault || 800);
  const [stockKg, setStockKg] = useState<number>(16000);
  const [fechaIngreso, setFechaIngreso] = useState(() => new Date().toISOString().split('T')[0]);
  const [estado, setEstado] = useState<EstadoLoteType>('Disponible');
  const [estadoRegistro, setEstadoRegistro] = useState<EstadoRegistroLote>('REALIZADO');
  const [fechaHoraProduccion, setFechaHoraProduccion] = useState<string>(() => getTodayDateStr());
  const [observaciones, setObservaciones] = useState('');
  const [ala, setAla] = useState('');
  const [sector, setSector] = useState('');
  const [humedad, setHumedad] = useState<number | ''>(13.5);
  const [cicloGerminacion, setCicloGerminacion] = useState<CicloGerminacionType | undefined>(loteAEditar?.cicloGerminacion || 'Sin asignar');
  const [fechaTratamiento, setFechaTratamiento] = useState<string>(() => loteAEditar?.fechaTratamiento || getTodayDateStr());

  // Estados de Orden de Proceso vinculada
  const [ordenProcesoId, setOrdenProcesoId] = useState('');
  const [numeroOrdenMovimiento, setNumeroOrdenMovimiento] = useState('');
  const [silosOrigen, setSilosOrigen] = useState<SiloExtraccion[]>([]);

  const [error, setError] = useState('');
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printingLoteObj, setPrintingLoteObj] = useState<Lote | null>(null);

  const handlePrintCurrentLote = () => {
    const currentLote: Lote = {
      id: id || loteAEditar?.id || `LOTE-${Date.now()}`,
      loteNro: loteNro || 'S/N',
      cliente,
      especie,
      variedad: variedad || '—',
      tipo,
      categoria,
      tratamiento: tratamientos,
      producto,
      stockBolsas,
      kgPorBolsa,
      stockKg,
      fechaIngreso,
      estado,
      estadoRegistro,
      fechaHoraProduccion,
      observaciones,
      ala,
      sector,
      ubicacionAcopio: ala && sector ? `Ala ${ala} - Sector ${sector}` : '',
      humedad: humedad !== '' ? Number(humedad) : undefined,
      cicloGerminacion: cicloGerminacion || 'Sin asignar',
      ordenProcesoId,
      numeroOrdenMovimiento,
      silosOrigen,
      historial: loteAEditar?.historial || [],
      auditoria: loteAEditar?.auditoria || [],
    };
    setPrintingLoteObj(currentLote);
    setShowPrintModal(true);
  };

  // Filtrar órdenes de proceso para listar únicamente las que están "EN CURSO" (o la ya vinculada si se edita un lote)
  const ordenesEnCurso = useMemo(() => {
    return ordenesProceso.filter(op => op.estado === 'EN CURSO' || (loteAEditar && op.id === loteAEditar.ordenProcesoId));
  }, [ordenesProceso, loteAEditar]);

  // Inicializar o cargar lote a editar
  useEffect(() => {
    if (loteAEditar) {
      setId(loteAEditar.id);
      setLoteNro(loteAEditar.loteNro || loteAEditar.id);
      setCliente(loteAEditar.cliente);
      setEspecie(loteAEditar.especie);
      setVariedad(loteAEditar.variedad);
      setTipo(loteAEditar.tipo);
      setCategoria(loteAEditar.categoria || 'Original');
      setTratamientos(loteAEditar.tratamiento || ['Sin Tratar']);
      if (!loteAEditar.tratamiento || loteAEditar.tratamiento.includes('Sin Tratar')) {
        setProducto('Ninguno');
      } else {
        setProducto(loteAEditar.producto || 'Ninguno');
      }
      setStockBolsas(loteAEditar.stockBolsas);
      setKgPorBolsa(loteAEditar.kgPorBolsa || 40);
      setStockKg(loteAEditar.stockKg);
      setFechaIngreso(loteAEditar.fechaIngreso);
      setEstado(loteAEditar.estado);
      setEstadoRegistro(loteAEditar.estadoRegistro || 'REALIZADO');
      setFechaHoraProduccion(loteAEditar.fechaHoraProduccion ? loteAEditar.fechaHoraProduccion.split('T')[0] : getTodayDateStr());
      setObservaciones(loteAEditar.observaciones || '');
      setAla(loteAEditar.ala || '');
      setSector(loteAEditar.sector || '');
      setHumedad(loteAEditar.humedad !== undefined ? loteAEditar.humedad : 13.5);
      setCicloGerminacion(loteAEditar.cicloGerminacion || 'Sin asignar');
      setOrdenProcesoId(loteAEditar.ordenProcesoId || '');
      setNumeroOrdenMovimiento(loteAEditar.numeroOrdenMovimiento || '');
      setSilosOrigen(loteAEditar.silosOrigen || []);
    } else {
      // Generar nuevo loteNro sugerido
      const allLoteNros = existingLotes.map(l => l.loteNro || l.id);
      const suggestedNro = generateLoteId(allLoteNros);
      setLoteNro(suggestedNro);
      setEstadoRegistro('REALIZADO');
      setFechaHoraProduccion(getTodayDateStr());
      // ID es cliente + _ + loteNro, lo calcularemos al guardar o dinámicamente
      setId(`${cliente.replace(/\s+/g, '_')}_${suggestedNro}`);
      setObservaciones('');
      setAla('');
      setSector('');
      if (ordenesEnCurso.length > 0) {
        const firstOp = ordenesEnCurso[0];
        setOrdenProcesoId(firstOp.id);
        if (firstOp.silosOrigen && firstOp.silosOrigen.length > 0) {
          setSilosOrigen(firstOp.silosOrigen);
        }
        if (firstOp.tipoOrden === 'MOVIMIENTO') {
          setNumeroOrdenMovimiento(firstOp.numeroOrdenMovimiento || '');
        }
      } else {
        setOrdenProcesoId('');
      }
    }
  }, [loteAEditar, existingLotes, ordenesEnCurso]);

  // Sync orden de proceso selection with order fields (variedad, producto, categoria, etc.)
  const handleOrdenProcesoChange = (opId: string) => {
    setOrdenProcesoId(opId);
    const selectedOp = ordenesProceso.find(o => o.id === opId);
    if (selectedOp) {
      if (selectedOp.variedad) setVariedad(selectedOp.variedad);
      if (selectedOp.categoria) setCategoria(selectedOp.categoria as CategoriaType);
      
      if (tratamientos.includes('Sin Tratar') || (selectedOp.tratamiento && (selectedOp.tratamiento.toLowerCase().includes('sin') || selectedOp.tratamiento.toLowerCase().includes('sin tratar')))) {
        setProducto('Ninguno');
      } else if (selectedOp.producto) {
        setProducto(selectedOp.producto);
      }

      if (selectedOp.silosOrigen && selectedOp.silosOrigen.length > 0) {
        setSilosOrigen(selectedOp.silosOrigen);
      }
      if (selectedOp.tipoOrden === 'MOVIMIENTO') {
        setNumeroOrdenMovimiento(selectedOp.numeroOrdenMovimiento || '');
      } else {
        setNumeroOrdenMovimiento('');
      }
    }
  };


  // Recalcular ID único dinámicamente si cambia el cliente o loteNro (si no está en modo edición)
  useEffect(() => {
    if (!isEditing && cliente && loteNro) {
      setId(`${cliente.replace(/\s+/g, '_')}_${loteNro.trim()}`);
    }
  }, [cliente, loteNro, isEditing]);

  // Recalcular Kilogramos automáticamente al cambiar bolsas o peso de bolsa
  useEffect(() => {
    const bolsas = Number(stockBolsas) || 0;
    const peso = Number(kgPorBolsa) || 0;
    setStockKg(bolsas * peso);

    // Auto-definir estado si el stock es cero
    if (bolsas === 0) {
      setEstado('Agotado');
    } else if (estado === 'Agotado') {
      setEstado('Disponible');
    }
  }, [stockBolsas, kgPorBolsa]);

  // Manejo de tratamientos seleccionables múltiples
  const toggleTratamiento = (trat: TratamientoType) => {
    if (trat === 'Sin Tratar') {
      setTratamientos(['Sin Tratar']);
      setProducto('Ninguno');
    } else {
      let actualizado = [...tratamientos].filter(t => t !== 'Sin Tratar');
      if (actualizado.includes(trat)) {
        actualizado = actualizado.filter(t => t !== trat);
      } else {
        actualizado.push(trat);
      }
      
      if (actualizado.length === 0) {
        actualizado.push('Sin Tratar');
        setProducto('Ninguno');
      }
      setTratamientos(actualizado);
    }
  };

  // Detectar si el N° de Lote ingresado ya existe en la base para acumulación automática
  const existingLoteRepetido = useMemo(() => {
    if (isEditing || !loteNro.trim()) return null;
    const match = existingLotes.find(
      l => l.loteNro?.trim().toLowerCase() === loteNro.trim().toLowerCase() ||
           l.id.toLowerCase() === `${cliente.replace(/\s+/g, '_')}_${loteNro.trim()}`.toLowerCase()
    );
    return match || null;
  }, [isEditing, loteNro, cliente, existingLotes]);

  const handleGuardar = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validaciones
    if (cliente.trim() === '') {
      setError('El campo Cliente es obligatorio.');
      return;
    }
    if (loteNro.trim() === '') {
      setError('El campo N° de Lote es obligatorio.');
      return;
    }
    if (variedad.trim() === '') {
      setError('El campo Variedad es obligatorio.');
      return;
    }
    if (!ala) {
      setError('Debe seleccionar un Ala de acopio obligatoriamente.');
      return;
    }
    if (!sector) {
      setError('Debe seleccionar un Sector de acopio obligatoriamente.');
      return;
    }
    if (!ordenProcesoId) {
      setError('Debe seleccionar una Orden de Proceso obligatoriamente para la vinculación y trazabilidad.');
      return;
    }

    const selectedOp = ordenesProceso.find(o => o.id === ordenProcesoId);
    if (selectedOp && selectedOp.tipoOrden === 'MOVIMIENTO' && !numeroOrdenMovimiento.trim()) {
      setError('La Orden de Proceso seleccionada es de MOVIMIENTO. Debe indicar el N° de Orden de Movimiento.');
      return;
    }

    if (stockBolsas < 0) {
      setError('La cantidad de bolsas no puede ser negativa.');
      return;
    }
    if (kgPorBolsa <= 0) {
      setError('El peso por bolsa debe ser mayor a cero.');
      return;
    }

    if (estadoRegistro === 'REALIZADO' && !fechaHoraProduccion.trim()) {
      setError('Debe ingresar manualmente la Fecha y Hora de Producción para guardar en modo REALIZADO.');
      return;
    }

    // Validar coincidencia de datos (Cliente, Especie, Variedad) al vincular Silos de Origen
    if (silosOrigen && silosOrigen.length > 0 && estadoRegistro === 'REALIZADO') {
      for (const s of silosOrigen) {
        if (s.siloId) {
          const matchCheck = validateSiloLoteMatch(
            s.siloId as SiloId,
            { cliente, especie, variedad },
            movimientosSilo
          );
          if (!matchCheck.valid) {
            setError(matchCheck.errorMessage || `No se puede vincular el ${s.siloId} por diferencia en los orígenes vinculantes.`);
            return;
          }
        }
      }
    }

    // Validar que la suma de kilos/bolsas del lote no supere el stock disponible del/los silo(s) de origen seleccionado(s)
    if (silosOrigen && silosOrigen.length > 0 && siloStocks) {
      let stockSilosDisponible = 0;
      silosOrigen.forEach(s => {
        stockSilosDisponible += (siloStocks[s.siloId as SiloId] || 0);
      });

      if (isEditing && loteAEditar && loteAEditar.stockKg) {
        stockSilosDisponible += loteAEditar.stockKg;
      }

      if (stockKg > stockSilosDisponible) {
        setError(`La cantidad total del lote (${formatKg(stockKg)}) supera el stock disponible acumulado en los silos de origen seleccionados (${formatKg(stockSilosDisponible)}).`);
        return;
      }
    }

    const ubicacionStr = ala && sector ? `Ala ${ala} - Sector ${sector}` : (ala || sector || 'Sin asignar');

    // Manejo de lote repetido (acumulación en modo Reporte Diario) o alta/edición
    if (!isEditing && existingLoteRepetido) {
      const currentKg = existingLoteRepetido.stockKg || 0;
      const currentBolsas = existingLoteRepetido.stockBolsas || 0;
      const addKg = stockKg;
      const addBolsas = Number(stockBolsas);

      // Validar límites máximos (Puntos 5, 6 y 7)
      const valResult = validateLoteLimits(currentKg, currentBolsas, addKg, addBolsas, activeLimits);
      if (!valResult.allowed) {
        setError(valResult.errorMessage || 'Operación bloqueada por sobrepasar los límites de lote.');
        return;
      }

      const totalBolsasAcumuladas = currentBolsas + addBolsas;
      const totalKgAcumulados = currentKg + addKg;
      const estadoAcumulado = totalBolsasAcumuladas > 0 && existingLoteRepetido.estado === 'Agotado' ? 'Disponible' : existingLoteRepetido.estado;

      const nuevoMov: MovimientoStock = {
        id: `MOV-${Date.now()}`,
        fecha: fechaIngreso,
        tipo: 'Entrada manual',
        cantidadBolsas: addBolsas,
        kgPorBolsa: Number(kgPorBolsa),
        cantidadKg: addKg,
        detalle: `Reporte Diario de Producción (${fechaHoraProduccion || fechaIngreso}) - OP #${ordenProcesoId || 'S/N'}`
      };

      const loteAcumulado: Lote = {
        ...existingLoteRepetido,
        stockBolsas: totalBolsasAcumuladas,
        stockKg: totalKgAcumulados,
        estado: estadoAcumulado,
        // Mantener campos existentes salvo que se editen explícitamente en el formulario diario
        especie,
        variedad: variedad.trim() || existingLoteRepetido.variedad,
        tipo,
        categoria,
        tratamiento: tratamientos,
        producto: tratamientos.includes('Sin Tratar') ? 'Ninguno' : (producto.trim() || 'Ninguno'),
        fechaIngreso,
        fechaHoraProduccion: estadoRegistro === 'REALIZADO' ? (fechaHoraProduccion.trim() || undefined) : existingLoteRepetido.fechaHoraProduccion,
        observaciones: observaciones.trim() || existingLoteRepetido.observaciones,
        ala: ala || existingLoteRepetido.ala,
        sector: sector || existingLoteRepetido.sector,
        ubicacionAcopio: ubicacionStr || existingLoteRepetido.ubicacionAcopio,
        humedad: humedad !== '' ? Number(humedad) : existingLoteRepetido.humedad,
        ordenProcesoId: ordenProcesoId || existingLoteRepetido.ordenProcesoId,
        numeroOrdenMovimiento: (selectedOp?.tipoOrden === 'MOVIMIENTO' ? numeroOrdenMovimiento.trim() : undefined) || existingLoteRepetido.numeroOrdenMovimiento,
        silosOrigen: silosOrigen.length > 0 ? silosOrigen : existingLoteRepetido.silosOrigen,
        historial: [nuevoMov, ...(existingLoteRepetido.historial || [])]
      };

      onSave(loteAcumulado);
      return;
    }

    // Alta nueva o Edición directa desde el listado
    const valResult = validateLoteLimits(0, 0, stockKg, Number(stockBolsas), activeLimits);
    if (!valResult.allowed) {
      setError(valResult.errorMessage || 'Operación bloqueada por sobrepasar los límites de lote.');
      return;
    }

    const uniqueId = isEditing ? id : `${cliente.replace(/\s+/g, '_')}_${loteNro.trim()}`;
    const calculatedCampania = getCampaniaIdFromDate(fechaIngreso);

    const loteGuardar: Lote = {
      id: uniqueId,
      loteNro: loteNro.trim(),
      cliente: cliente.trim(),
      especie,
      variedad: variedad.trim(),
      tipo,
      categoria,
      tratamiento: tratamientos,
      producto: tratamientos.includes('Sin Tratar') ? 'Ninguno' : (producto.trim() || 'Ninguno'),
      stockBolsas: Number(stockBolsas),
      kgPorBolsa: Number(kgPorBolsa),
      stockKg,
      fechaIngreso,
      campaniaId: calculatedCampania,
      estado: estado,
      estadoRegistro: estadoRegistro,
      fechaHoraProduccion: estadoRegistro === 'REALIZADO' ? (fechaHoraProduccion.trim() || undefined) : undefined,
      observaciones: observaciones.trim(),
      ala: ala,
      sector: sector,
      ubicacionAcopio: ubicacionStr,
      humedad: humedad !== '' ? Number(humedad) : undefined,
      fechaTratamiento: tratamientos.includes('Tratado') ? (fechaTratamiento || getTodayDateStr()) : undefined,
      ordenProcesoId: ordenProcesoId,
      numeroOrdenMovimiento: selectedOp?.tipoOrden === 'MOVIMIENTO' ? numeroOrdenMovimiento.trim() : undefined,
      silosOrigen: silosOrigen,
      historial: loteAEditar ? loteAEditar.historial : [
        {
          id: `MOV-${Date.now()}`,
          fecha: fechaIngreso,
          tipo: 'Entrada',
          cantidadBolsas: Number(stockBolsas),
          kgPorBolsa: Number(kgPorBolsa),
          cantidadKg: stockKg,
          detalle: 'Carga inicial de lote - Reporte de Producción'
        }
      ]
    };

    onSave(loteGuardar);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8" id="lote-form-container">
      <div className="border-b border-gray-100 pb-4 mb-6">
        <span className="text-xs font-sans font-semibold tracking-widest text-[#C9922E] uppercase">
          {isEditing ? 'EDICIÓN DE REGISTRO DE LOTE' : 'ALTA DE LOTE'}
        </span>
        <h3 className="font-serif text-2xl font-bold text-[#1A1A1A] mt-1">
          {isEditing ? `Editar Lote: ${id}` : 'Formulario de Alta de Lote'}
        </h3>
      </div>

      {error && (
        <div className="bg-[#F5E5DC] text-[#A0522D] p-4 rounded-xl flex items-start gap-3 text-xs border border-red-200 mb-6">
          <AlertTriangle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleGuardar} className="space-y-6">

        {/* SECCIÓN MODO DE REGISTRO (PRE-CARGA / REALIZADO) CON FECHA Y HORA DE PRODUCCIÓN */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white p-5 rounded-2xl border border-slate-700/80 shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/80 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 block">
                  Estado de Registro del Lote *
                </span>
                <span className="text-[11px] text-slate-300">
                  Defina si es una planificación (Pre-Carga) o una producción efectivamente realizada
                </span>
              </div>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Vínculo a Dashboard de Producción
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
            {/* Botones de Opciones Cerradas */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                Seleccionar Modo *
              </label>
              <div className="inline-flex p-1 bg-slate-950 rounded-xl border border-slate-700 w-full shadow-inner">
                <button
                  type="button"
                  onClick={() => setEstadoRegistro('PRE-CARGA')}
                  className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                    estadoRegistro === 'PRE-CARGA'
                      ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  PRE-CARGA
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEstadoRegistro('REALIZADO');
                    if (!fechaHoraProduccion) {
                      setFechaHoraProduccion(getTodayDateStr());
                    }
                  }}
                  className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                    estadoRegistro === 'REALIZADO'
                      ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  REALIZADO
                </button>
              </div>
            </div>

            {/* Fecha de Realización (Activa con REALIZADO) */}
            {estadoRegistro === 'REALIZADO' ? (
              <div className="bg-slate-800/90 p-3.5 rounded-xl border border-emerald-500/50 space-y-1 animate-in fade-in duration-200">
                <label className="block text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4 text-emerald-400" />
                  Fecha de Realización *
                </label>
                <input
                  type="date"
                  value={fechaHoraProduccion}
                  onChange={(e) => setFechaHoraProduccion(e.target.value)}
                  required={estadoRegistro === 'REALIZADO'}
                  className="w-full px-3 py-2 bg-slate-950 text-white font-mono text-xs font-bold rounded-lg border border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
                <span className="text-[10px] text-slate-400 block">
                  Esta fecha alimentará los análisis de rendimiento y volumen procesado en el Reporte de Producción.
                </span>
              </div>
            ) : (
              <div className="bg-slate-800/80 p-3.5 rounded-xl border border-amber-500/40 text-xs text-slate-300 flex items-start gap-2.5 shadow-sm">
                <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-amber-300 block">Lote en Pre-Carga (Sin afectación de silos)</span>
                  <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                    Con la opción <strong className="text-amber-400">PRE-CARGA</strong> activa <strong>NO se descuenta ni afecta el stock/salida de silos</strong>. La Salida de Silo se activará únicamente cuando presione el botón <strong className="text-emerald-400">REALIZADO</strong>.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sección de Orden de Proceso Vinculada */}
        <div className="bg-gradient-to-r from-emerald-50 to-slate-50 border border-emerald-200/80 p-5 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-2">
              <Factory className="w-4 h-4 text-emerald-700" />
              Orden de Proceso Vinculada *
            </label>

            {onCreateOrdenProcesoClick && (
              <button
                type="button"
                onClick={onCreateOrdenProcesoClick}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 hover:underline flex items-center gap-1"
              >
                + Crear nueva Orden de Proceso
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Selector de Orden de Proceso */}
            <div className="md:col-span-2">
              <select
                value={ordenProcesoId}
                onChange={(e) => handleOrdenProcesoChange(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 shadow-2xs"
              >
                <option value="">
                  {ordenesEnCurso.length === 0 ? '-- No hay órdenes de proceso "En Curso" --' : '-- Seleccionar Orden de Proceso (En Curso) * --'}
                </option>
                {ordenesEnCurso.map(op => (
                  <option key={op.id} value={op.id}>
                    N° {op.numeroOrden} - {op.variedad} ({op.producto}) [{op.tipoOrden}] {op.tipoMovimiento ? `- ${op.tipoMovimiento}` : ''}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-emerald-800/80 mt-1">
                Se muestran únicamente las Órdenes de Proceso con estado "En Curso".
              </p>
            </div>

            {/* Campo N° de Orden de Movimiento (Solo visible/requerido si Tipo de Orden = MOVIMIENTO) */}
            {(() => {
              const selectedOp = ordenesProceso.find(o => o.id === ordenProcesoId);
              if (selectedOp && selectedOp.tipoOrden === 'MOVIMIENTO') {
                return (
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-blue-900 mb-1 flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-blue-600" />
                      N° Orden de Movimiento *
                    </label>
                    <input
                      type="text"
                      value={numeroOrdenMovimiento}
                      onChange={(e) => setNumeroOrdenMovimiento(e.target.value)}
                      placeholder="Ej. OM-402"
                      required
                      className="w-full px-4 py-2 bg-white text-slate-800 font-mono text-sm font-bold rounded-xl border border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* N° de Lote (Editable) */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
              N° de Lote * <span className="text-gray-400 font-normal">(Ej: 58FIN, 32INT)</span>
            </label>
            <input
              type="text"
              value={loteNro}
              onChange={(e) => setLoteNro(e.target.value)}
              className="w-full px-4 py-2.5 bg-white text-gray-800 font-mono text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C]"
              placeholder="Ej: 58FIN"
              required
            />

            {existingLoteRepetido && (
              <div className="mt-2 bg-amber-50 border border-amber-300 p-3 rounded-xl text-xs text-amber-900 space-y-1.5 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 font-bold text-amber-950">
                  <Layers3 className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>⚡ Acumulación de Stock: Lote Repetido Detectado ({existingLoteRepetido.loteNro})</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  El lote ya existe en el sistema con <strong>{existingLoteRepetido.stockBolsas} bolsas</strong> ({formatKg(existingLoteRepetido.stockKg)}).
                  La nueva carga ({stockBolsas} bolsas / {formatKg(stockKg)}) se <strong>acumulará</strong> al stock existente.
                </p>
                <div className="pt-1 border-t border-amber-200/80 flex flex-wrap items-center justify-between text-[11px] text-amber-900 font-semibold">
                  <span>Resultado acumulado: <strong>{existingLoteRepetido.stockBolsas + Number(stockBolsas || 0)} bolsas</strong> ({formatKg(existingLoteRepetido.stockKg + stockKg)})</span>
                  <span className="text-amber-700">Margen disponible: {Math.max(0, activeLimits.maxBolsasPorLote - existingLoteRepetido.stockBolsas)} bolsas ({formatKg(Math.max(0, activeLimits.maxKgPorLote - existingLoteRepetido.stockKg))})</span>
                </div>
              </div>
            )}
          </div>

          {/* ID de Lote Único Interno (Lectura únicamente) */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
              ID Único Interno (Cliente + Lote)
            </label>
            <input
              type="text"
              value={id}
              disabled
              className="w-full px-4 py-2.5 bg-gray-50 text-gray-400 font-mono text-sm rounded-lg border border-gray-100 focus:outline-none cursor-not-allowed"
            />
          </div>

          {/* Cliente / Productor */}
          <ClienteSelect
            value={cliente}
            onChange={setCliente}
            label="Cliente / Productor *"
            selectClassName="w-full px-4 py-2.5 bg-white text-gray-800 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C] font-semibold"
            inputClassName="w-full px-4 py-2.5 bg-gray-50 text-gray-800 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C] font-semibold mt-1"
          />

          {/* Especie de Grano (Alimentada por Base de Datos de Planta) */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
              Especie de Grano *
            </label>
            <select
              value={especie}
              onChange={(e) => setEspecie(e.target.value as EspecieType)}
              className="w-full px-4 py-2.5 bg-white text-gray-800 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C]"
              required
            >
              {especiesList.map((esp) => (
                <option key={esp} value={esp}>
                  {esp}
                </option>
              ))}
            </select>
          </div>

          {/* Variedad (Alimentada por Base de Datos de Planta con sugerencias) */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
              Variedad *
            </label>
            <input
              type="text"
              list="variedades-sugeridas-list"
              value={variedad}
              onChange={(e) => setVariedad(e.target.value)}
              className="w-full px-4 py-2.5 bg-white text-gray-800 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C]"
              placeholder="Ej: DM 46R18, Baguette 620, P46A03..."
              required
            />
            {variedadesList.length > 0 && (
              <datalist id="variedades-sugeridas-list">
                {variedadesList.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            )}
          </div>

          {/* Tipo de Lote */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
              Tipo de Lote *
            </label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoLoteType)}
              className="w-full px-4 py-2.5 bg-white text-gray-800 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C]"
            >
              {tiposList.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Categoría */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
              Categoría *
            </label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as CategoriaType)}
              className="w-full px-4 py-2.5 bg-white text-gray-800 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C]"
            >
              {categoriasList.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Fecha de Ingreso */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                Fecha de Ingreso *
              </label>
              <span className="inline-flex items-center gap-1 text-[10px] bg-[#E3EFE7] text-[#00603C] px-2 py-0.5 rounded font-bold">
                <Calendar className="w-2.5 h-2.5" />
                Campaña: {getCampaniaIdFromDate(fechaIngreso)}
              </span>
            </div>
            <input
              type="date"
              value={fechaIngreso}
              onChange={(e) => setFechaIngreso(e.target.value)}
              className="w-full px-4 py-2.5 bg-white text-gray-800 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C]"
              required
            />
          </div>

          {/* Sector de Acopio */}
          <div className="md:col-span-2 grid grid-cols-2 gap-4 bg-gray-50/60 p-4 rounded-xl border border-gray-100 shadow-inner">
            <div className="col-span-2 flex items-center gap-1.5 border-b border-gray-200/60 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#00603C]">
                Sector de Acopio / Ubicación
              </span>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                Ala *
              </label>
              <select
                value={ala}
                onChange={(e) => setAla(e.target.value)}
                className="w-full px-3 py-2 bg-white text-gray-800 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C]"
                required
              >
                <option value="">-- Seleccionar Ala --</option>
                <option value="A">ALA: A</option>
                <option value="B">ALA: B</option>
                <option value="C">ALA: C</option>
                <option value="D">ALA: D</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                Sector *
              </label>
              <select
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className="w-full px-3 py-2 bg-white text-gray-800 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C]"
                required
              >
                <option value="">-- Seleccionar Sector --</option>
                <option value="1">SECTOR: 1</option>
                <option value="2">SECTOR: 2</option>
                <option value="3">SECTOR: 3</option>
              </select>
            </div>
          </div>

          {/* Tratamientos (Multiselector en Checkboxes) */}
          <div className="md:col-span-2 bg-[#E3EFE7] bg-opacity-30 p-4 rounded-xl border border-[#E3EFE7]">
            <span className="block text-xs font-semibold uppercase tracking-wider text-[#00603C] mb-3">
              Tratamiento de Semilla (Selección Múltiple)
            </span>
            <div className="flex flex-wrap gap-4">
              {(tratamientosList as TratamientoType[]).map((trat) => {
                const checked = tratamientos.includes(trat);
                return (
                  <button
                    key={trat}
                    type="button"
                    onClick={() => toggleTratamiento(trat)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition border ${
                      checked
                        ? 'bg-[#00603C] text-white border-[#00603C] shadow-sm'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${checked ? 'border-white bg-white text-[#00603C]' : 'border-gray-300 bg-white'}`}>
                      {checked && <Check className="w-2.5 h-2.5 stroke-[4px]" />}
                    </div>
                    {trat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Producto de tratamiento */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2 flex items-center justify-between">
              <span>Producto Aplicado</span>
              {tratamientos.includes('Sin Tratar') && (
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded border border-emerald-300">
                  Por defecto: "Ninguno"
                </span>
              )}
            </label>
            <input
              type="text"
              value={tratamientos.includes('Sin Tratar') ? 'Ninguno' : producto}
              onChange={(e) => setProducto(e.target.value)}
              disabled={tratamientos.includes('Sin Tratar')}
              className="w-full px-4 py-2.5 bg-white text-gray-800 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C] disabled:bg-slate-100 disabled:text-slate-600 disabled:font-bold"
              placeholder={tratamientos.includes('Sin Tratar') ? 'Ninguno' : 'Ej: Cruiser, Vitavax, Rizobio...'}
            />
          </div>

          {/* Fecha de Tratamiento (Si está Tratado) */}
          {tratamientos.includes('Tratado') && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2 flex items-center justify-between">
                <span>Fecha de Tratamiento</span>
                <span className="text-[10px] font-bold text-[#00603C] bg-[#E3EFE7] px-2 py-0.5 rounded">
                  Requerido
                </span>
              </label>
              <input
                type="date"
                value={fechaTratamiento}
                onChange={(e) => setFechaTratamiento(e.target.value)}
                className="w-full px-4 py-2.5 bg-white text-gray-800 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C]"
              />
            </div>
          )}

          {/* Estado de Lote */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
              Estado Inicial
            </label>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value as EstadoLoteType)}
              disabled={stockBolsas === 0}
              className="w-full px-4 py-2.5 bg-white text-gray-800 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C] disabled:bg-gray-50"
            >
              <option value="Disponible">Disponible (Verde)</option>
              <option value="Reservado">Reservado (Dorado)</option>
              <option value="A Consumo">A Consumo (Púrpura)</option>
              <option value="Agotado">Agotado (Terracota)</option>
            </select>
          </div>

          {/* % Humedad del Lote (Informativo) */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2 flex items-center justify-between">
              <span>% Humedad del Lote</span>
              <span className="text-[10px] text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Informativo
              </span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={humedad}
                onChange={(e) => setHumedad(e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="Ej: 13.5"
                className="w-full px-4 py-2.5 bg-white text-gray-800 text-sm font-semibold rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C]"
              />
              <span className="absolute right-3 top-2.5 text-xs text-gray-400 font-bold">%</span>
            </div>
            <p className="text-[10px] text-gray-500 mt-1">
              * Dato informativo. El % de humedad no modifica el peso total ni los kg del lote.
            </p>
          </div>

          {/* Ciclo de Germinación */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2 flex items-center justify-between">
              <span>Ciclo de Germinación</span>
              <span className="text-[10px] text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Calidad
              </span>
            </label>
            <select
              value={cicloGerminacion || 'Sin asignar'}
              onChange={(e) => setCicloGerminacion(e.target.value as CicloGerminacionType)}
              className="w-full px-4 py-2.5 bg-white text-gray-800 text-sm font-semibold rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C]"
            >
              {CICLOS_GERMINACION.map((ciclo) => (
                <option key={ciclo} value={ciclo}>
                  {ciclo}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-gray-500 mt-1">
              * Período de germinación del análisis de calidad de semilla.
            </p>
          </div>

          {/* Parámetros de Stock (Cálculo Dinámico) */}
          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4 bg-[#F6EFDC] bg-opacity-40 p-4 rounded-xl border border-[#F6EFDC] border-opacity-50">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#C9922E] mb-2">
                Cantidad de Bolsas *
              </label>
              <input
                type="number"
                value={stockBolsas}
                onChange={(e) => setStockBolsas(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full px-4 py-2 bg-white text-gray-800 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C9922E]"
                min="0"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#C9922E] mb-2">
                Kilogramos por Bolsa *
              </label>
              <input
                type="number"
                value={kgPorBolsa}
                onChange={(e) => setKgPorBolsa(Math.max(1, parseInt(e.target.value, 10) || 0))}
                className="w-full px-4 py-2 bg-white text-gray-800 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C9922E]"
                min="1"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#C9922E] mb-2">
                Equivalente Stock (Kg)
              </label>
              <input
                type="text"
                value={`${new Intl.NumberFormat('es-AR').format(stockKg)} kg`}
                disabled
                className="w-full px-4 py-2 bg-gray-50 text-[#C9922E] font-semibold text-sm rounded-lg border border-gray-200 font-mono"
              />
            </div>
          </div>

          {/* Silos de Origen */}
          <div className="md:col-span-2">
            <SilosSelector
              silosSeleccionados={silosOrigen}
              siloStocks={siloStocks}
              movimientosSilo={movimientosSilo}
              loteCliente={cliente}
              loteEspecie={especie}
              loteVariedad={variedad}
              targetKg={stockKg}
              onChange={setSilosOrigen}
            />
          </div>

          {/* Observaciones (Texto libre largo) */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
              Observaciones / Notas del Lote
            </label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="w-full px-4 py-3 bg-white text-gray-800 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C]"
              placeholder="Escriba aquí cualquier detalle técnico, observaciones de calidad o notas del acopio de este lote..."
              rows={3}
            />
          </div>

        </div>

        {/* Acciones */}
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-100 pt-5">
          <button
            type="button"
            onClick={handlePrintCurrentLote}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold font-sans uppercase tracking-wider bg-slate-800 hover:bg-slate-900 text-white rounded-lg shadow-sm transition cursor-pointer"
            title="Ver y descargar la Ficha Técnica en PDF de este lote"
          >
            <Download className="w-4 h-4 text-[#C9922E]" />
            <span>Descargar PDF Ficha</span>
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 text-xs font-semibold font-sans uppercase tracking-wider text-gray-500 rounded-lg hover:bg-gray-100 transition cursor-pointer"
          >
            Cancelar
          </button>
          
          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold font-sans uppercase tracking-wider bg-[#00603C] hover:bg-[#254731] text-white rounded-lg shadow-md transition cursor-pointer"
          >
            <Save className="w-4 h-4 text-[#C9922E]" />
            Guardar Lote
          </button>
        </div>
      </form>

      {/* Modal de Impresión de Ficha Técnica (A4) */}
      {showPrintModal && printingLoteObj && (
        <ImprimirFichaTecnica
          isOpen={showPrintModal}
          lote={printingLoteObj}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </div>
  );
};
