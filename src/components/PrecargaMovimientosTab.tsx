/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Lote,
  OrdenProceso,
  TipoLoteType,
  TratamientoType,
  CategoriaType,
  MovimientoStock,
  AuditLogEntry
} from '../types';
import { formatKg, formatNumberArg } from '../utils/formatters';
import { getCampaniaIdFromDate } from '../utils/campanias';
import { generarLoteId } from '../utils/loteId';
import {
  ArrowRightLeft,
  Filter,
  Search,
  CheckCircle2,
  AlertCircle,
  FlaskConical,
  Package,
  Layers,
  ArrowRight,
  Sparkles,
  RotateCcw,
  Building2,
  Calendar,
  Save,
  Check,
  ChevronRight
} from 'lucide-react';

export type TipoMovimientoElegido =
  | 'intermedio-a-final'
  | 'intermedio-a-final-tratado'
  | 'final-a-final-tratado';

interface MovimientoItemConfig {
  loteId: string;
  bolsasAMover: number;
  tipoMovimiento: TipoMovimientoElegido;
  productoAplicado: string;
}

interface PrecargaMovimientosTabProps {
  lotes: Lote[];
  ordenesProceso: OrdenProceso[];
  clientes?: string[];
  especies?: string[];
  onSaveLote: (lote: Lote) => Promise<void> | void;
  onNavigateToLotes: () => void;
}

export const PrecargaMovimientosTab: React.FC<PrecargaMovimientosTabProps> = ({
  lotes = [],
  ordenesProceso = [],
  clientes = [],
  especies = [],
  onSaveLote,
  onNavigateToLotes,
}) => {
  // 1. Filtros de lotes en stock
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCliente, setFilterCliente] = useState('TODOS');
  const [filterEspecie, setFilterEspecie] = useState('TODOS');
  const [filterVariedad, setFilterVariedad] = useState('TODOS');
  const [filterCategoria, setFilterCategoria] = useState('TODOS');
  const [filterTipo, setFilterTipo] = useState('TODOS');
  const [filterTratamiento, setFilterTratamiento] = useState('TODOS');
  const [onlyWithStock, setOnlyWithStock] = useState(true);

  // 2. Orden de Movimiento seleccionada
  const [selectedOrdenMovId, setSelectedOrdenMovId] = useState<string>('');

  // 3. Selección y configuración de movimientos por lote
  const [selectedLoteIds, setSelectedLoteIds] = useState<string[]>([]);
  const [movConfigMap, setMovConfigMap] = useState<Record<string, MovimientoItemConfig>>({});

  // 4. Estados de feedback y guardado
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Lista de Órdenes de Movimiento
  const ordenesMovimiento = useMemo(() => {
    return ordenesProceso.filter((o) => o.tipoOrden === 'MOVIMIENTO');
  }, [ordenesProceso]);

  // Órdenes de movimiento en curso o disponibles
  const ordenesMovimientoEnCurso = useMemo(() => {
    const enCurso = ordenesMovimiento.filter((o) => {
      const est = (o.estado || '').toUpperCase();
      return est === 'EN CURSO' || est === 'SIN INICIAR';
    });
    return enCurso.length > 0 ? enCurso : ordenesMovimiento;
  }, [ordenesMovimiento]);

  // Auto-seleccionar primera orden de movimiento si hay alguna y ninguna seleccionada
  React.useEffect(() => {
    if (!selectedOrdenMovId && ordenesMovimientoEnCurso.length > 0) {
      setSelectedOrdenMovId(ordenesMovimientoEnCurso[0].id);
    }
  }, [ordenesMovimientoEnCurso, selectedOrdenMovId]);

  const selectedOrdenMov = useMemo(() => {
    return ordenesProceso.find((o) => o.id === selectedOrdenMovId) || null;
  }, [ordenesProceso, selectedOrdenMovId]);

  // Lotes filtrados en stock
  const filteredStockLotes = useMemo(() => {
    return lotes.filter((l) => {
      // Excluir lotes ya eliminados o archivados
      if (onlyWithStock && (Number(l.stockBolsas) || 0) <= 0) return false;

      // Búsqueda libre
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchNro = (l.loteNro || '').toLowerCase().includes(q);
        const matchVar = (l.variedad || '').toLowerCase().includes(q);
        const matchCli = (l.cliente || '').toLowerCase().includes(q);
        const matchEsp = (l.especie || '').toLowerCase().includes(q);
        if (!matchNro && !matchVar && !matchCli && !matchEsp) return false;
      }

      // Filtro Cliente
      if (filterCliente !== 'TODOS' && l.cliente !== filterCliente) {
        return false;
      }

      // Filtro Especie
      if (filterEspecie !== 'TODOS' && l.especie !== filterEspecie) {
        return false;
      }

      // Filtro Variedad
      if (filterVariedad !== 'TODOS' && l.variedad !== filterVariedad) {
        return false;
      }

      // Filtro Categoría
      if (filterCategoria !== 'TODOS' && l.categoria !== filterCategoria) {
        return false;
      }

      // Filtro Tipo
      if (filterTipo !== 'TODOS' && l.tipo !== filterTipo) {
        return false;
      }

      // Filtro Tratamiento
      if (filterTratamiento !== 'TODOS') {
        const esTratado = (l.tratamiento || []).includes('Tratado');
        if (filterTratamiento === 'Tratado' && !esTratado) return false;
        if (filterTratamiento === 'Sin Tratar' && esTratado) return false;
      }

      return true;
    });
  }, [lotes, onlyWithStock, searchTerm, filterCliente, filterEspecie, filterVariedad, filterCategoria, filterTipo, filterTratamiento]);

  // Manejador de selección de lote
  const handleToggleSelectLote = (lote: Lote) => {
    const isSelected = selectedLoteIds.includes(lote.id);
    if (isSelected) {
      setSelectedLoteIds(selectedLoteIds.filter((id) => id !== lote.id));
      const nextMap = { ...movConfigMap };
      delete nextMap[lote.id];
      setMovConfigMap(nextMap);
    } else {
      setSelectedLoteIds([...selectedLoteIds, lote.id]);
      // Determinar movimiento por defecto según el tipo actual del lote
      let defaultTipoMov: TipoMovimientoElegido = 'intermedio-a-final';
      if (lote.tipo === 'Final') {
        defaultTipoMov = 'final-a-final-tratado';
      }

      setMovConfigMap({
        ...movConfigMap,
        [lote.id]: {
          loteId: lote.id,
          bolsasAMover: Math.max(1, Number(lote.stockBolsas) || 1),
          tipoMovimiento: defaultTipoMov,
          productoAplicado:
            lote.producto && lote.producto !== 'Ninguno' ? lote.producto : 'Maxim XL 100cc / 100kg',
        },
      });
    }
  };

  // Actualizar configuración individual de un lote
  const handleUpdateConfig = (
    loteId: string,
    field: keyof MovimientoItemConfig,
    value: any
  ) => {
    setMovConfigMap((prev) => ({
      ...prev,
      [loteId]: {
        ...prev[loteId],
        [field]: value,
      },
    }));
  };

  // Lista de lotes seleccionados con su config
  const selectedLotesWithConfig = useMemo(() => {
    return selectedLoteIds
      .map((id) => {
        const lote = lotes.find((l) => l.id === id);
        const config = movConfigMap[id];
        if (!lote || !config) return null;
        return { lote, config };
      })
      .filter(Boolean) as { lote: Lote; config: MovimientoItemConfig }[];
  }, [selectedLoteIds, lotes, movConfigMap]);

  // Validación y confirmación del guardado
  const handleGuardarPrecargaMovimientos = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (selectedLotesWithConfig.length === 0) {
      setErrorMsg('Debe seleccionar al menos un lote de la lista para registrar el movimiento.');
      return;
    }

    if (!selectedOrdenMovId) {
      setErrorMsg('Debe seleccionar una Orden de Movimiento en curso.');
      return;
    }

    // Validar bolsas ingresadas
    for (const { lote, config } of selectedLotesWithConfig) {
      if (config.bolsasAMover <= 0) {
        setErrorMsg(`La cantidad de bolsas para el lote ${lote.loteNro} debe ser mayor a 0.`);
        return;
      }
      if (config.bolsasAMover > lote.stockBolsas) {
        setErrorMsg(
          `El lote ${lote.loteNro} solo tiene ${lote.stockBolsas} bolsas disponibles. No puede mover ${config.bolsasAMover}.`
        );
        return;
      }
      if (
        (config.tipoMovimiento === 'intermedio-a-final-tratado' ||
          config.tipoMovimiento === 'final-a-final-tratado') &&
        !config.productoAplicado.trim()
      ) {
        setErrorMsg(
          `Debe ingresar el "Producto Aplicado / Principio Activo" para el lote ${lote.loteNro}.`
        );
        return;
      }
    }

    setIsSaving(true);
    try {
      const fechaActual = new Date().toISOString().split('T')[0];
      const campania = getCampaniaIdFromDate(fechaActual);
      const ordenId = selectedOrdenMov?.numeroOrden || selectedOrdenMov?.numeroOrdenMovimiento || selectedOrdenMovId;

      for (const { lote, config } of selectedLotesWithConfig) {
        const bolsasMovidas = Number(config.bolsasAMover);
        const bolsasRestantes = Math.max(0, Number(lote.stockBolsas) - bolsasMovidas);
        const kgPorBolsa = Number(lote.kgPorBolsa) || 800;

        // 1. Determinar datos del nuevo lote "... MOV"
        let nuevoTipo: TipoLoteType = 'Final';
        let nuevoTratamiento: TratamientoType[] = ['Tratado'];
        let nuevoProducto = config.productoAplicado.trim() || 'Tratamiento estándar';
        let labelTipoMov = 'Intermedio a Final';

        if (config.tipoMovimiento === 'intermedio-a-final') {
          nuevoTipo = 'Final';
          nuevoTratamiento = lote.tratamiento || ['Sin Tratar'];
          nuevoProducto = lote.producto || 'Ninguno';
          labelTipoMov = 'Intermedio a Final';
        } else if (config.tipoMovimiento === 'intermedio-a-final-tratado') {
          nuevoTipo = 'Final';
          nuevoTratamiento = ['Tratado'];
          nuevoProducto = config.productoAplicado.trim();
          labelTipoMov = 'Intermedio a Final Tratado';
        } else if (config.tipoMovimiento === 'final-a-final-tratado') {
          nuevoTipo = 'Final';
          nuevoTratamiento = ['Tratado'];
          nuevoProducto = config.productoAplicado.trim();
          labelTipoMov = 'Final a Final Tratado';
        }

        const nombreNuevoLote = `${lote.loteNro} MOV`;
        const nuevoDocId = generarLoteId(lote.cliente, nombreNuevoLote);

        const movHistorialNuevo: MovimientoStock = {
          id: `MOV-INIT-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          fecha: fechaActual,
          tipo: 'Entrada manual',
          cantidadBolsas: bolsasMovidas,
          kgPorBolsa: kgPorBolsa,
          cantidadKg: bolsasMovidas * kgPorBolsa,
          detalle: `Creado por Precarga de Movimiento (${labelTipoMov}) desde lote origen ${lote.loteNro} · OM #${ordenId}`,
        };

        const nuevoLoteMov: Lote = {
          id: nuevoDocId,
          loteNro: nombreNuevoLote,
          cliente: lote.cliente,
          especie: lote.especie,
          variedad: lote.variedad,
          tipo: nuevoTipo,
          categoria: lote.categoria,
          tratamiento: nuevoTratamiento,
          producto: nuevoProducto,
          stockBolsas: bolsasMovidas,
          kgPorBolsa: kgPorBolsa,
          stockKg: bolsasMovidas * kgPorBolsa,
          fechaIngreso: fechaActual,
          campaniaId: campania,
          estado: 'Disponible',
          estadoRegistro: 'PRE-CARGA',
          estadoMovimiento: 'PRE-MOVIMIENTO',
          esMovimiento: true,
          tipoMovimiento: labelTipoMov,
          loteOrigen: lote.loteNro,
          productoAplicado: nuevoProducto,
          ordenProcesoId: selectedOrdenMov?.id,
          numeroOrdenMovimiento: ordenId,
          fechaMovimiento: fechaActual,
          ala: lote.ala,
          sector: lote.sector,
          ubicacionAcopio: lote.ubicacionAcopio,
          observaciones: `Precarga de Movimiento desde ${lote.loteNro}. ${lote.observaciones || ''}`.trim(),
          historial: [movHistorialNuevo],
        };

        // 2. Actualizar el lote original (descontando bolsas y dejando registro en bitácora de lote)
        const detalleSalida = `Salidas por movimientos: baja de stock (${bolsasMovidas} bolsas / ${(bolsasMovidas * kgPorBolsa).toLocaleString('es-AR')} kg) por pasar a tratado hacia ${nombreNuevoLote} · OM #${ordenId}`;
        const movHistorialOrigen: MovimientoStock = {
          id: `MOV-DESC-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          fecha: fechaActual,
          tipo: 'Salida por movimientos' as any,
          cantidadBolsas: -bolsasMovidas,
          kgPorBolsa: kgPorBolsa,
          cantidadKg: -(bolsasMovidas * kgPorBolsa),
          detalle: detalleSalida,
        };

        const auditLogSalida: AuditLogEntry = {
          id: `AUDIT-MOV-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          fechaHora: new Date().toISOString(),
          tipo: 'Salida por movimientos',
          usuario: 'Sistema de Planta',
          rol: 'Operario',
          modulo: 'LOTES',
          entidadId: lote.id,
          descripcion: detalleSalida,
          campoModificado: 'stockKg',
          valorAnterior: lote.stockKg,
          valorNuevo: bolsasRestantes * kgPorBolsa,
          detalles: `Baja de stock por pase a tratado (${labelTipoMov}). Lote resultante generado: ${nombreNuevoLote}`,
        };

        const loteOrigenActualizado: Lote = {
          ...lote,
          stockBolsas: bolsasRestantes,
          stockKg: bolsasRestantes * kgPorBolsa,
          estado: bolsasRestantes <= 0 ? 'Agotado' : lote.estado,
          historial: [...(lote.historial || []), movHistorialOrigen],
          auditoria: [...(lote.auditoria || []), auditLogSalida],
        };

        // Guardar ambos lotes
        await onSaveLote(loteOrigenActualizado);
        await onSaveLote(nuevoLoteMov);
      }

      setSuccessMsg(
        `¡Precarga de Movimiento registrada con éxito! Se descontaron las bolsas del stock inicial y se generaron ${selectedLotesWithConfig.length} nuevo(s) lote(s) con sufijo "MOV" en estado PRE-CARGA.`
      );

      setTimeout(() => {
        onNavigateToLotes();
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al guardar la precarga de movimientos.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6" id="precarga-movimientos-container">
      {/* Header explicativo */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 rounded-3xl shadow-xl border border-blue-400/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-300">
            <ArrowRightLeft className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-blue-300 font-black">
                Módulo de Transformación de Stock
              </span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-400/20 text-blue-200 border border-blue-400/30">
                Precarga de Movimientos
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black font-serif tracking-tight mt-0.5">
              Precarga de Movimientos de Lotes
            </h2>
            <p className="text-xs text-blue-100/80 max-w-2xl mt-1">
              Seleccione lotes en stock, aplique cambio de tipo o tratamiento, especifique bolsas a transferir y vincule la Orden de Movimiento. Se generará un nuevo lote <strong>MOV</strong> manteniendo separado el stock inicial.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onNavigateToLotes}
          className="px-4 py-2 text-xs font-bold text-blue-200 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl transition border border-white/20 cursor-pointer self-stretch sm:self-auto text-center"
        >
          Volver a Lotes
        </button>
      </div>

      {/* MENSAJES DE ERROR / ÉXITO */}
      {errorMsg && (
        <div className="p-4 bg-red-50 border-2 border-red-200 text-red-800 rounded-2xl flex items-center gap-3 text-xs font-semibold animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border-2 border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-3 text-xs font-semibold animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* PASO 1: SELECCIONAR ORDEN DE MOVIMIENTO EN CURSO */}
      <div className="bg-white rounded-3xl border border-blue-100 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-mono font-bold text-xs flex items-center justify-center">
              1
            </span>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 uppercase tracking-wider">
              Seleccionar Orden de Movimiento en Curso
            </h3>
          </div>
          <span className="text-[11px] font-semibold text-gray-500">
            {ordenesMovimientoEnCurso.length} órdenes de movimiento disponibles
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Orden de Movimiento Vinculada (Botón Desplegable):
            </label>
            <div className="relative">
              <select
                id="select-orden-movimiento-en-curso"
                value={selectedOrdenMovId}
                onChange={(e) => setSelectedOrdenMovId(e.target.value)}
                className="w-full px-4 py-3 bg-blue-50/60 border-2 border-blue-200 rounded-xl font-bold text-sm text-slate-900 focus:bg-white focus:border-blue-600 outline-none transition cursor-pointer"
              >
                {ordenesMovimientoEnCurso.length === 0 ? (
                  <option value="">No hay órdenes de movimiento registradas</option>
                ) : (
                  ordenesMovimientoEnCurso.map((op) => (
                    <option key={op.id} value={op.id}>
                      OP #{op.numeroOrden} {op.numeroOrdenMovimiento ? `· OM #${op.numeroOrdenMovimiento}` : ''} | {op.cliente || 'Sin cliente'} | {op.especie} {op.variedad} ({op.estado || 'SIN INICIAR'})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Tarjeta resumen de la Orden seleccionada */}
          {selectedOrdenMov && (
            <div className="bg-gradient-to-br from-slate-900 to-blue-950 text-white p-3.5 rounded-2xl border border-blue-400/30 text-xs space-y-1">
              <div className="flex justify-between items-center text-[10px] text-blue-300 font-bold uppercase tracking-wider">
                <span>OM #{selectedOrdenMov.numeroOrdenMovimiento || selectedOrdenMov.numeroOrden}</span>
                <span className="px-2 py-0.5 bg-blue-500/30 rounded-full text-blue-200">
                  {selectedOrdenMov.estado}
                </span>
              </div>
              <div className="font-bold text-sm text-white truncate">
                {selectedOrdenMov.cliente}
              </div>
              <div className="text-slate-300 text-[11px] truncate">
                {selectedOrdenMov.especie} · {selectedOrdenMov.variedad}
              </div>
              <div className="text-[10px] text-blue-300 pt-1 flex justify-between">
                <span>Progreso:</span>
                <span className="font-mono font-bold">
                  {selectedOrdenMov.hechos || 0} / {selectedOrdenMov.bbPedidos || 0} BB
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PASO 2: HERRAMIENTA DE FILTROS DE LOTES EN STOCK */}
      <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-mono font-bold text-xs flex items-center justify-center">
              2
            </span>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 uppercase tracking-wider">
              Herramienta de Filtros de Lotes en Stock
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500">
              {filteredStockLotes.length} lotes encontrados
            </span>
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setFilterCliente('TODOS');
                setFilterEspecie('TODOS');
                setFilterVariedad('TODOS');
                setFilterCategoria('TODOS');
                setFilterTipo('TODOS');
                setFilterTratamiento('TODOS');
                setOnlyWithStock(true);
              }}
              className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restablecer</span>
            </button>
          </div>
        </div>

        {/* Barra de Filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Búsqueda por texto */}
          <div className="sm:col-span-2 lg:col-span-2 relative">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
              Buscar (Lote, Variedad, Cliente)
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Ej: L-1001, DM 46R18, San Diego..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-blue-600 outline-none transition"
              />
            </div>
          </div>

          {/* Filtro Cliente */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
              Cliente
            </label>
            <select
              value={filterCliente}
              onChange={(e) => setFilterCliente(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-blue-600 outline-none transition"
            >
              <option value="TODOS">Todos los clientes</option>
              {Array.from(new Set(lotes.map((l) => l.cliente).filter(Boolean))).map((cl) => (
                <option key={cl} value={cl}>
                  {cl}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Especie */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
              Especie
            </label>
            <select
              value={filterEspecie}
              onChange={(e) => setFilterEspecie(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-blue-600 outline-none transition"
            >
              <option value="TODOS">Todas las especies</option>
              {Array.from(new Set(lotes.map((l) => l.especie).filter(Boolean))).map((esp) => (
                <option key={esp} value={esp}>
                  {esp}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Variedad */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
              Variedad
            </label>
            <select
              value={filterVariedad}
              onChange={(e) => setFilterVariedad(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-blue-600 outline-none transition"
            >
              <option value="TODOS">Todas las variedades</option>
              {Array.from(new Set(lotes.map((l) => l.variedad).filter(Boolean))).map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Categoría */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
              Categoría
            </label>
            <select
              value={filterCategoria}
              onChange={(e) => setFilterCategoria(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-blue-600 outline-none transition"
            >
              <option value="TODOS">Todas las categorías</option>
              {Array.from(new Set(lotes.map((l) => l.categoria).filter(Boolean))).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Tipo */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
              Tipo de Lote
            </label>
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-blue-600 outline-none transition"
            >
              <option value="TODOS">Todos los tipos</option>
              <option value="Intermedio">Intermedio</option>
              <option value="Final">Final</option>
            </select>
          </div>
        </div>

        {/* Checkbox solo con stock */}
        <div className="flex items-center gap-2 pt-1 text-xs">
          <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-700 select-none">
            <input
              type="checkbox"
              checked={onlyWithStock}
              onChange={(e) => setOnlyWithStock(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
            />
            <span>Mostrar únicamente lotes con stock disponible (&gt; 0 bolsas)</span>
          </label>
        </div>
      </div>

      {/* PASO 3: TABLA DE LOTES PARA SELECCIÓN */}
      <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-mono font-bold text-xs flex items-center justify-center">
              3
            </span>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 uppercase tracking-wider">
              Seleccionar Lotes a Mover ({selectedLoteIds.length} seleccionados)
            </h3>
          </div>
          <span className="text-xs text-gray-500">
            Haga clic sobre cada casilla para activar y configurar su movimiento
          </span>
        </div>

        {filteredStockLotes.length === 0 ? (
          <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-2xl">
            <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-semibold">No se encontraron lotes con los filtros especificados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-gray-200">
                  <th className="p-3 w-12 text-center">Sel.</th>
                  <th className="p-3">N° de Lote</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Especie / Variedad</th>
                  <th className="p-3">Tipo Actual</th>
                  <th className="p-3">Tratamiento</th>
                  <th className="p-3 text-right">Stock Bolsas</th>
                  <th className="p-3 text-right">Kg / Bolsa</th>
                  <th className="p-3 text-right">Stock Total Kg</th>
                  <th className="p-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-sans">
                {filteredStockLotes.map((lote) => {
                  const isSelected = selectedLoteIds.includes(lote.id);
                  const isTratado = (lote.tratamiento || []).includes('Tratado');

                  return (
                    <tr
                      key={lote.id}
                      onClick={() => handleToggleSelectLote(lote)}
                      className={`cursor-pointer transition ${
                        isSelected
                          ? 'bg-blue-50/80 font-semibold text-slate-950 border-l-4 border-l-blue-600'
                          : 'hover:bg-gray-50/80 text-slate-700'
                      }`}
                    >
                      <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectLote(lote)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                        />
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-900">
                        {lote.loteNro}
                      </td>
                      <td className="p-3 font-semibold">{lote.cliente}</td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-900">{lote.variedad}</div>
                        <div className="text-[10px] text-gray-500">{lote.especie}</div>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                            lote.tipo === 'Intermedio'
                              ? 'bg-amber-100 text-amber-900 border border-amber-200'
                              : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                          }`}
                        >
                          {lote.tipo}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                            isTratado
                              ? 'bg-purple-100 text-purple-900 border border-purple-200'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {isTratado ? 'Tratado' : 'Sin Tratar'}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        {formatNumberArg(lote.stockBolsas)}
                      </td>
                      <td className="p-3 text-right font-mono text-gray-600">
                        {lote.kgPorBolsa} kg
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-[#00603C]">
                        {formatKg(lote.stockKg)}
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                          {lote.estadoRegistro || 'REALIZADO'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PASO 4: CONFIGURACIÓN DE MOVIMIENTOS EN LOTES SELECCIONADOS */}
      {selectedLotesWithConfig.length > 0 && (
        <div className="bg-white rounded-3xl border-2 border-blue-300 p-6 shadow-md space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-mono font-bold text-xs flex items-center justify-center">
                4
              </span>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 uppercase tracking-wider">
                Configurar Tipo de Movimiento y Cantidad de Bolsas a Mover
              </h3>
            </div>
            <span className="px-3 py-1 bg-blue-100 text-blue-900 rounded-full font-mono text-xs font-bold">
              {selectedLotesWithConfig.length} lote(s) en proceso de transformación
            </span>
          </div>

          <div className="space-y-6">
            {selectedLotesWithConfig.map(({ lote, config }, idx) => {
              const bolsasDisponibles = Number(lote.stockBolsas) || 0;
              const bolsasAMover = Number(config.bolsasAMover) || 0;
              const bolsasRestantes = Math.max(0, bolsasDisponibles - bolsasAMover);
              const kgPorBolsa = Number(lote.kgPorBolsa) || 800;

              const requiresProducto =
                config.tipoMovimiento === 'intermedio-a-final-tratado' ||
                config.tipoMovimiento === 'final-a-final-tratado';

              return (
                <div
                  key={lote.id}
                  className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs"
                >
                  {/* Encabezado del lote */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 bg-slate-900 text-white font-mono font-black text-xs rounded-lg">
                        LOTE {lote.loteNro}
                      </span>
                      <span className="text-xs font-bold text-slate-700">
                        {lote.cliente} · {lote.especie} ({lote.variedad})
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-slate-500">
                      Stock actual:{' '}
                      <span className="font-mono font-bold text-slate-900">
                        {bolsasDisponibles} bolsas
                      </span>{' '}
                      ({formatKg(lote.stockKg)})
                    </div>
                  </div>

                  {/* Controles de Configuración del Movimiento */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* 1. Movimiento Elegido */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Movimiento Elegido (3 Opciones):
                      </label>
                      <select
                        value={config.tipoMovimiento}
                        onChange={(e) =>
                          handleUpdateConfig(
                            lote.id,
                            'tipoMovimiento',
                            e.target.value as TipoMovimientoElegido
                          )
                        }
                        className="w-full px-3 py-2 bg-white border border-blue-300 rounded-xl text-xs font-bold text-slate-900 focus:border-blue-600 outline-none transition cursor-pointer"
                      >
                        <option value="intermedio-a-final">
                          1 - Intermedio a Final (Cambiar tipo a Final)
                        </option>
                        <option value="intermedio-a-final-tratado">
                          2 - Intermedio a Final Tratado (Tipo a Final + Tratado)
                        </option>
                        <option value="final-a-final-tratado">
                          3 - Final a Final Tratado (Mantener Final + Tratado)
                        </option>
                      </select>
                    </div>

                    {/* 2. Cantidad de bolsas a mano */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Cantidad de Bolsas a Mover (a mano):
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          max={bolsasDisponibles}
                          value={config.bolsasAMover}
                          onChange={(e) =>
                            handleUpdateConfig(
                              lote.id,
                              'bolsasAMover',
                              Math.max(1, Math.min(bolsasDisponibles, parseInt(e.target.value, 10) || 1))
                            )
                          }
                          className="w-full px-3 py-2 bg-white border border-blue-300 rounded-xl font-mono font-bold text-sm text-slate-900 focus:border-blue-600 outline-none transition"
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateConfig(lote.id, 'bolsasAMover', bolsasDisponibles)}
                          className="px-2.5 py-2 bg-blue-100 hover:bg-blue-200 text-blue-900 font-bold text-xs rounded-xl transition cursor-pointer shrink-0"
                          title="Mover todas las bolsas disponibles"
                        >
                          Todas ({bolsasDisponibles})
                        </button>
                      </div>
                      <span className="text-[10px] text-gray-500 mt-1 block">
                        Equivale a {formatKg(bolsasAMover * kgPorBolsa)} a transferir
                      </span>
                    </div>

                    {/* 3. Producto Aplicado / Principio Activo (Condicional opciones 2 y 3) */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Producto Aplicado / Principio Activo:
                        {requiresProducto && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          disabled={!requiresProducto}
                          placeholder={
                            requiresProducto
                              ? 'Ej: Maxim XL 100cc / 100kg'
                              : 'No aplica (Sin tratamiento químico)'
                          }
                          value={requiresProducto ? config.productoAplicado : ''}
                          onChange={(e) =>
                            handleUpdateConfig(lote.id, 'productoAplicado', e.target.value)
                          }
                          className={`w-full px-3 py-2 rounded-xl text-xs font-semibold outline-none transition ${
                            requiresProducto
                              ? 'bg-white border border-purple-300 text-slate-900 focus:border-purple-600'
                              : 'bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed'
                          }`}
                        />
                      </div>
                      {requiresProducto && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {['Maxim XL', 'Cruiser Extra', 'Inoculante Líquido', 'Trichoderma'].map(
                            (sug) => (
                              <button
                                key={sug}
                                type="button"
                                onClick={() => handleUpdateConfig(lote.id, 'productoAplicado', sug)}
                                className="text-[9px] bg-purple-50 text-purple-700 hover:bg-purple-100 px-1.5 py-0.5 rounded border border-purple-200 cursor-pointer"
                              >
                                + {sug}
                              </button>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* VISTA PREVIA DE SEPARACIÓN EN DOS LOTES DIFERENTES */}
                  <div className="pt-3 border-t border-slate-200">
                    <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-blue-600" />
                      <span>Separación Visible de Lotes Resultantes:</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Lote Origen Remanente */}
                      <div className="bg-white border-2 border-slate-300 rounded-xl p-3.5 space-y-1 shadow-2xs">
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          <span>LOTE ORIGEN (STOCK REMANENTE)</span>
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-mono">
                            Stock Restante
                          </span>
                        </div>
                        <div className="text-base font-black font-mono text-slate-900">
                          {lote.loteNro}
                        </div>
                        <div className="text-xs font-semibold text-slate-600">
                          {bolsasRestantes} bolsas disponibles ({formatKg(bolsasRestantes * kgPorBolsa)})
                        </div>
                        <div className="text-[10px] text-slate-500 pt-1 flex items-center gap-2">
                          <span>Tipo: {lote.tipo}</span>
                          <span>·</span>
                          <span>Tratamiento: {(lote.tratamiento || []).join(', ')}</span>
                        </div>
                      </div>

                      {/* Nuevo Lote "MOV" */}
                      <div className="bg-blue-50/70 border-2 border-blue-400 rounded-xl p-3.5 space-y-1 shadow-2xs">
                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-blue-700">
                          <span>NUEVO LOTE CREADO (MOVIMIENTO)</span>
                          <span className="px-2 py-0.5 bg-blue-600 text-white rounded-md font-mono">
                            NUEVO MOV
                          </span>
                        </div>
                        <div className="text-base font-black font-mono text-blue-950 flex items-center gap-1.5">
                          <span>{lote.loteNro} MOV</span>
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        </div>
                        <div className="text-xs font-bold text-blue-900">
                          {bolsasAMover} bolsas asignadas ({formatKg(bolsasAMover * kgPorBolsa)})
                        </div>
                        <div className="text-[10px] text-blue-800 pt-1 flex items-center gap-2 flex-wrap">
                          <span className="font-bold">Nuevo Tipo: Final</span>
                          <span>·</span>
                          <span className="font-bold">
                            Tratamiento:{' '}
                            {config.tipoMovimiento === 'intermedio-a-final'
                              ? (lote.tratamiento || []).join(', ')
                              : `Tratado (${config.productoAplicado || 'Estándar'})`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* BOTÓN FINAL DE CONFIRMACIÓN */}
          <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-gray-500">
              Al guardar, se descontarán las bolsas indicadas de cada lote inicial y se darán de alta los lotes con sufijo <strong>MOV</strong> en estado <strong>PRE-CARGA</strong>.
            </div>

            <button
              type="button"
              id="btn-confirmar-precarga-movimientos"
              disabled={isSaving}
              onClick={handleGuardarPrecargaMovimientos}
              className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <span>Guardando Precarga...</span>
              ) : (
                <>
                  <Save className="w-4 h-4 text-blue-200" />
                  <span>Guardar Precarga de Movimientos ({selectedLotesWithConfig.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
