/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Lote,
  PlantaConfig,
  VariedadItem,
  SalidaRegistrada,
  OrdenCarga,
  VARIEDADES_DB_DEFAULT
} from '../types';
import { CLIENTES_PRECARGADOS } from '../data/mockData';
import { formatNumberArg, formatDateStr } from '../utils/formatters';
import { isLoteOriginadoPorMovimiento } from '../utils/loteOriginHelper';
import {
  Factory,
  Database,
  Filter,
  RotateCcw,
  Download,
  Search,
  Eye,
  Layers,
  Sparkles,
  CheckCircle2,
  Calendar,
  X,
  FileSpreadsheet,
  ShieldCheck,
  Scale,
  FlaskConical,
  ExternalLink,
  MapPin,
  Truck,
  ArrowRight,
  TrendingUp,
  Boxes
} from 'lucide-react';

export interface ReporteProduccionViewProps {
  lotes: Lote[];
  salidas?: SalidaRegistrada[];
  ordenesCarga?: OrdenCarga[];
  plantaConfig?: PlantaConfig;
  clientes?: string[];
  onSelectLote?: (lote: Lote) => void;
  onNavigateToLotes?: () => void;
  onRefresh?: () => Promise<void> | void;
}

export interface LoteProductionSummary {
  lote: Lote;
  kgProducidos: number;
  kgTratados: number;
  isTratado: boolean;
  kgDespachados: number;
  kgMovimientos: number;
  stockActualKg: number;
  stockActualBolsas: number;
}

export interface VariedadProductionRow {
  id: string; // `${cliente}-${especie}-${variedad}`
  cliente: string;
  especie: string;
  variedad: string;
  kgProducidos: number;
  kgTratados: number;
  kgSinTratar: number;
  porcentajeTratado: number;
  lotes: LoteProductionSummary[];
  cantidadLotes: number;
}

export const ReporteProduccionView: React.FC<ReporteProduccionViewProps> = ({
  lotes,
  salidas = [],
  plantaConfig,
  clientes: clientesProp = [],
  onSelectLote,
  onNavigateToLotes,
  onRefresh
}) => {
  // 1. Estados de Filtros
  const [filterCliente, setFilterCliente] = useState<string>('');
  const [filterVariedad, setFilterVariedad] = useState<string>('');
  const [filterTratamiento, setFilterTratamiento] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // 1.1 Estado de Actualización / Sincronización de Datos
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [refreshToast, setRefreshToast] = useState<string | null>(null);

  const handleActualizarDatos = async () => {
    setIsRefreshing(true);
    setRefreshToast(null);
    try {
      if (onRefresh) {
        await onRefresh();
      }
      setRefreshToast('¡Datos actualizados! Se sincronizaron las últimas modificaciones registradas en los lotes.');
    } catch (err) {
      console.error('Error al actualizar datos del reporte:', err);
      setRefreshToast('Error al actualizar datos. Por favor intente nuevamente.');
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setRefreshToast(null), 4000);
    }
  };

  // 2. Estado para el modal de inspección/revisión de lotes
  const [variedadDetalleSeleccionada, setVariedadDetalleSeleccionada] = useState<VariedadProductionRow | null>(null);

  // 3. Catálogos oficiales desde las Bases de Datos de la aplicación
  const clientesDatabase = useMemo(() => {
    const list = plantaConfig?.clientes && plantaConfig.clientes.length > 0
      ? plantaConfig.clientes
      : (clientesProp.length > 0 ? clientesProp : CLIENTES_PRECARGADOS);
    return Array.from(new Set(list.filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [plantaConfig, clientesProp]);

  const variedadesDatabase = useMemo(() => {
    const list = (plantaConfig?.variedadesDb && plantaConfig.variedadesDb.length > 0)
      ? plantaConfig.variedadesDb
      : VARIEDADES_DB_DEFAULT;

    // Si se seleccionó un cliente específico en el filtro, filtrar reactivamente las variedades de ese cliente en BD
    if (filterCliente && filterCliente.trim()) {
      const cliNorm = filterCliente.trim().toLowerCase();
      const filteredByClient = list.filter(v => (v.cliente || '').trim().toLowerCase() === cliNorm);
      if (filteredByClient.length > 0) {
        return filteredByClient;
      }
    }
    return list;
  }, [plantaConfig, filterCliente]);

  const variedadesNombresUnicos = useMemo(() => {
    const setVar = new Set<string>();
    variedadesDatabase.forEach(v => {
      if (v.nombre && v.nombre.trim()) setVar.add(v.nombre.trim());
    });
    // También incluir cualquier variedad registrada en los lotes existentes
    lotes.forEach(l => {
      if (l.variedad && l.variedad.trim() && l.variedad !== 'Sin Variedad') {
        setVar.add(l.variedad.trim());
      }
    });
    return Array.from(setVar).sort((a, b) => a.localeCompare(b));
  }, [variedadesDatabase, lotes]);

  // Lista de tratamientos disponibles
  const tratamientosDisponibles = useMemo(() => {
    const setTrat = new Set<string>(['Tratado', 'Sin Tratar']);
    if (plantaConfig?.tratamientos) {
      plantaConfig.tratamientos.forEach(t => {
        if (t && t.trim()) setTrat.add(t.trim());
      });
    }
    lotes.forEach(l => {
      if (Array.isArray(l.tratamiento)) {
        l.tratamiento.forEach(t => { if (t && t.trim()) setTrat.add(t.trim()); });
      } else if (l.tratamiento) {
        setTrat.add(String(l.tratamiento).trim());
      }
    });
    return Array.from(setTrat);
  }, [plantaConfig, lotes]);

// Helper para determinar si un lote está marcado como tratado
const isLoteTratadoHelper = (l: Lote): boolean => {
  if (!l) return false;
  const t = (l as any).tratamiento;
  if (Array.isArray(t)) {
    const hasTrat = t.some(item => {
      const s = String(item).toLowerCase().trim();
      return s !== 'sin tratar' && s !== 'ninguno' && s !== '' && !s.includes('sin');
    });
    if (hasTrat) return true;
  } else if (typeof t === 'string') {
    const s = String(t).toLowerCase().trim();
    if (s !== 'sin tratar' && s !== 'ninguno' && s !== '' && !s.includes('sin')) return true;
  }
  if (l.producto && l.producto.toLowerCase().trim() !== 'ninguno' && l.producto.trim() !== '') return true;
  if (l.productoAplicado && l.productoAplicado.toLowerCase().trim() !== 'ninguno' && l.productoAplicado.trim() !== '') return true;
  if (l.tipo && l.tipo.toLowerCase().includes('tratado')) return true;
  if (l.tipoMovimiento && l.tipoMovimiento.toLowerCase().includes('tratado')) return true;
  if (l.estado && String(l.estado).toLowerCase().includes('tratado')) return true;
  return false;
};

  // 4. Lotes que aplican al Reporte de Producción:
  // Regla de Negocio:
  // "para kilos producidos tomar todos los kilos dados de alta de los lotes, no contar los kilos 'tratados' para cantidad de kilos producidos"
  // "no contar aquellos kg en lotes generados por movimientos"
  const lotesAptosProduccion = useMemo(() => {
    return lotes.filter((lote) => {
      // a) Se toman todos los lotes dados de alta en planta (independientemente del estado de registro)
      // b) Lotes originados por movimiento:
      // Si el lote proviene de un movimiento (int a final, int a final tratado, final a final tratado):
      // NO suma a Kilos Producidos. Solo se incluye si fue pasado a tratado para computar en "kilos tratado".
      const esMovimiento = isLoteOriginadoPorMovimiento(lote);
      if (esMovimiento) {
        const isTratado = isLoteTratadoHelper(lote);
        // Si no es tratado, un lote de movimiento no aporta a producción ni a tratado, se excluye
        if (!isTratado) return false;
      }

      return true;
    });
  }, [lotes]);

  // Cálculo de Kilos Producidos y Tratados por Lote (NO disminuyen por despachos o movimientos)
  const lotesCalculados = useMemo<LoteProductionSummary[]>(() => {
    return lotesAptosProduccion.map(lote => {
      const esMovimiento = isLoteOriginadoPorMovimiento(lote);

      // a) Egresos por salidas/despachos registrados
      const salidasLote = salidas.filter(s => s.loteId === lote.id || s.loteId === lote.loteNro);
      const kgSalidasRegistradas = salidasLote.reduce((acc, s) => acc + (Number(s.totalKg) || 0), 0);

      const salidasHistorial = (lote.historial || []).filter(m => {
        const t = (m.tipo || '').toLowerCase();
        return t.includes('salida') || t.includes('despacho') || t.includes('consumo');
      });
      const kgSalidasHistorial = salidasHistorial.reduce((acc, m) => acc + (Number(m.cantidadKg) || 0), 0);
      const kgDespachados = Math.max(kgSalidasRegistradas, kgSalidasHistorial);

      // b) Egresos por movimientos internos a otros envases o lotes
      const movsSalida = (lote.historial || []).filter(m => {
        const t = (m.tipo || '').toLowerCase();
        return t.includes('movimiento') && !t.includes('entrada');
      });
      const kgMovimientos = movsSalida.reduce((acc, m) => acc + (Number(m.cantidadKg) || 0), 0);

      // c) Entradas iniciales registradas en historial
      const entradas = (lote.historial || []).filter(m => {
        const t = (m.tipo || '').toLowerCase();
        return t.includes('entrada') || t === 'alta' || t.includes('ingreso') || t.includes('excel');
      });
      const kgEntradas = entradas.reduce((acc, m) => {
        const kgDirecto = Number(m.cantidadKg) || 0;
        if (kgDirecto > 0) return acc + kgDirecto;
        const b = Number(m.cantidadBolsas) || 0;
        const pb = Number(m.kgPorBolsa) || Number(lote.kgPorBolsa) || 40;
        return acc + (b * pb);
      }, 0);

      // d) Stock actual en el sistema
      const stockActualKg = Number(lote.stockKg) || ((Number(lote.stockBolsas) || 0) * (Number(lote.kgPorBolsa) || 40));
      const stockActualBolsas = Number(lote.stockBolsas) || 0;

      // e) Detección de Tratamiento:
      const isTratado = isLoteTratadoHelper(lote);

      // f) Obtención de Kilos dados de alta de este lote:
      let kgAlta = 0;
      if (!esMovimiento) {
        // 1. Buscar movimiento inicial de alta en planta en el historial
        const movsAlta = entradas.filter(m => {
          const t = (m.tipo || '').toLowerCase();
          const d = (m.detalle || '').toLowerCase();
          return (
            t === 'alta' ||
            m.id.startsWith('MOV-ALTA') ||
            m.id.startsWith('alta-') ||
            d.includes('alta') ||
            d.includes('ingreso') ||
            d.includes('stock inicial') ||
            d.includes('precarga') ||
            (t.includes('entrada') && !t.includes('movimiento') && !d.includes('movimiento'))
          );
        });
        const kgAltaHistorial = movsAlta.reduce((acc, m) => {
          const kgDir = Number(m.cantidadKg) || 0;
          if (kgDir > 0) return acc + kgDir;
          const b = Number(m.cantidadBolsas) || 0;
          const pb = Number(m.kgPorBolsa) || Number(lote.kgPorBolsa) || 40;
          return acc + (b * pb);
        }, 0);

        // 2. Reconstitución a partir del stock actual más salidas y movimientos para evitar pérdidas si se despachó
        const kgReconstituidos = stockActualKg + kgDespachados + kgMovimientos;

        // 3. Tomar el valor consolidado más representativo del alta del lote
        kgAlta = Math.max(kgAltaHistorial, kgEntradas, kgReconstituidos, stockActualKg);
        if (kgAlta === 0 && stockActualBolsas > 0) {
          kgAlta = stockActualBolsas * (Number(lote.kgPorBolsa) || 40);
        }
      }

      // g) KILOS PRODUCIDOS:
      // Regla de Negocio solicitada:
      // "para kilos producidos tomar todos los kilos dados de alta de los lotes, no contar los kilos 'tratados' para cantidad de kilos producidos"
      let kgProducidos = 0;
      if (!esMovimiento && !isTratado) {
        kgProducidos = kgAlta;
      }

      // h) KILOS TRATADOS:
      // "aquellos kilos dados de alta marcados como 'tratados' son los que alimentaran 'Cantidad Kilos Tratados' en el reporte"
      let kgTratados = 0;
      if (isTratado) {
        if (esMovimiento) {
          // Kilos que se hayan pasado a tratado mediante movimiento
          kgTratados = Math.max(kgEntradas, stockActualKg + kgDespachados, stockActualKg);
          if (kgTratados === 0 && stockActualBolsas > 0) {
            kgTratados = stockActualBolsas * (Number(lote.kgPorBolsa) || 40);
          }
        } else {
          // Lote dado de alta en planta marcado como tratado:
          // Alimenta directamente la columna de Kilos Tratados (y no suma a Kilos Producidos)
          kgTratados = kgAlta;
        }
      }

      return {
        lote,
        kgProducidos,
        kgTratados,
        isTratado,
        kgDespachados,
        kgMovimientos,
        stockActualKg,
        stockActualBolsas
      };
    });
  }, [lotesAptosProduccion, salidas]);

  // 5. Agrupación por Cliente, Especie y Variedad con aplicación de filtros
  const filasReporte = useMemo<VariedadProductionRow[]>(() => {
    // Filtrar lotes según los criterios seleccionados
    const lotesFiltrados = lotesCalculados.filter(item => {
      const l = item.lote;

      // Filtro de Cliente (desde BD)
      if (filterCliente) {
        if ((l.cliente || '').trim().toLowerCase() !== filterCliente.trim().toLowerCase()) {
          return false;
        }
      }

      // Filtro de Variedad (desde BD)
      if (filterVariedad) {
        if ((l.variedad || '').trim().toLowerCase() !== filterVariedad.trim().toLowerCase()) {
          return false;
        }
      }

      // Filtro de Tratamiento
      if (filterTratamiento === 'tratado') {
        if (!item.isTratado) return false;
      } else if (filterTratamiento === 'sin_tratar') {
        if (item.isTratado) return false;
      } else if (filterTratamiento !== 'todos' && filterTratamiento) {
        const trats = Array.isArray(l.tratamiento) ? l.tratamiento : [l.tratamiento || ''];
        const matchTrat = trats.some(t => t.trim().toLowerCase() === filterTratamiento.trim().toLowerCase()) ||
          (l.producto && l.producto.trim().toLowerCase().includes(filterTratamiento.trim().toLowerCase()));
        if (!matchTrat) return false;
      }

      // Filtro de Búsqueda de texto
      if (searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        const matchLoteNro = (l.loteNro || '').toLowerCase().includes(term);
        const matchCli = (l.cliente || '').toLowerCase().includes(term);
        const matchEsp = (l.especie || '').toLowerCase().includes(term);
        const matchVar = (l.variedad || '').toLowerCase().includes(term);
        if (!matchLoteNro && !matchCli && !matchEsp && !matchVar) return false;
      }

      return true;
    });

    // Agrupar por clave única: `${cliente}-${especie}-${variedad}`
    const mapaGrupos = new Map<string, VariedadProductionRow>();

    lotesFiltrados.forEach(item => {
      const l = item.lote;
      const cliente = l.cliente || 'Sin Cliente';
      const especie = l.especie || 'Sin Especie';
      const variedad = l.variedad || 'Sin Variedad';
      const key = `${cliente}__${especie}__${variedad}`;

      let grupo = mapaGrupos.get(key);
      if (!grupo) {
        grupo = {
          id: key,
          cliente,
          especie,
          variedad,
          kgProducidos: 0,
          kgTratados: 0,
          kgSinTratar: 0,
          porcentajeTratado: 0,
          lotes: [],
          cantidadLotes: 0
        };
        mapaGrupos.set(key, grupo);
      }

      grupo.kgProducidos += item.kgProducidos;
      grupo.kgTratados += item.kgTratados;
      grupo.lotes.push(item);
      grupo.cantidadLotes = grupo.lotes.length;
      grupo.kgSinTratar = grupo.kgProducidos;
      const totalVolumenGrupo = grupo.kgProducidos + grupo.kgTratados;
      grupo.porcentajeTratado = totalVolumenGrupo > 0
        ? Math.round((grupo.kgTratados / totalVolumenGrupo) * 100)
        : 0;
    });

    // Ordenar alfabéticamente por Cliente y luego Variedad
    return Array.from(mapaGrupos.values()).sort((a, b) => {
      const cmpCli = a.cliente.localeCompare(b.cliente);
      if (cmpCli !== 0) return cmpCli;
      return a.variedad.localeCompare(b.variedad);
    });
  }, [lotesCalculados, filterCliente, filterVariedad, filterTratamiento, searchTerm]);

  // 6. Totales Generales para la cabecera y el pie de la tabla
  const totalesGenerales = useMemo(() => {
    let totalKgProducidos = 0;
    let totalKgTratados = 0;
    let totalLotes = 0;

    filasReporte.forEach(r => {
      totalKgProducidos += r.kgProducidos;
      totalKgTratados += r.kgTratados;
      totalLotes += r.cantidadLotes;
    });

    const totalVolumenGlobal = totalKgProducidos + totalKgTratados;
    const porcentajeTratadoGlobal = totalVolumenGlobal > 0
      ? Math.round((totalKgTratados / totalVolumenGlobal) * 100)
      : 0;

    return {
      totalKgProducidos,
      totalKgTratados,
      totalKgSinTratar: totalKgProducidos,
      porcentajeTratadoGlobal,
      totalVariedades: filasReporte.length,
      totalLotes
    };
  }, [filasReporte]);

  // 7. Limpiar Filtros
  const handleResetFilters = () => {
    setFilterCliente('');
    setFilterVariedad('');
    setFilterTratamiento('todos');
    setSearchTerm('');
  };

  // 8. Exportación a Excel (.xlsx)
  const handleExportarExcel = () => {
    try {
      // Hoja 1: Resumen por Variedad
      const dataResumen = filasReporte.map(r => ({
        'Cliente': r.cliente,
        'Especie': r.especie,
        'Variedad': r.variedad,
        'Kg Producidos': r.kgProducidos,
        'Kg Tratados': r.kgTratados,
        'Kg Sin Tratar': r.kgSinTratar,
        '% Tratado': `${r.porcentajeTratado}%`,
        'Cantidad Lotes': r.cantidadLotes
      }));

      // Hoja 2: Detalle de Lotes Involucrados
      const dataLotes = filasReporte.flatMap(r =>
        r.lotes.map(item => ({
          'Cliente': r.cliente,
          'Especie': r.especie,
          'Variedad': r.variedad,
          'N° Lote': item.lote.loteNro,
          'ID Lote': item.lote.id,
          'Tipo': item.lote.tipo,
          'Categoría': item.lote.categoria,
          'Tratamiento': Array.isArray(item.lote.tratamiento) ? item.lote.tratamiento.join(', ') : item.lote.tratamiento,
          'Producto Curasemilla': item.lote.producto || '-',
          'Kg Producidos': item.kgProducidos,
          'Kg Tratados': item.kgTratados,
          'Stock Actual Kg': item.stockActualKg,
          'Stock Actual Bolsas': item.stockActualBolsas,
          'Kg Despachados': item.kgDespachados,
          'Ubicación en Planta': item.lote.ubicacionAcopio || (item.lote.ala ? `Ala ${item.lote.ala} - Sector ${item.lote.sector || 1}` : 'Planta'),
          'Estado': item.lote.estado,
          'Fecha Ingreso': item.lote.fechaIngreso || '-'
        }))
      );

      const wb = XLSX.utils.book_new();
      const wsResumen = XLSX.utils.json_to_sheet(dataResumen);
      const wsLotes = XLSX.utils.json_to_sheet(dataLotes);

      XLSX.utils.book_append_sheet(wb, wsResumen, 'Producción por Variedad');
      XLSX.utils.book_append_sheet(wb, wsLotes, 'Detalle de Lotes');

      const fechaHoy = new Date().toISOString().split('T')[0];
      const filename = `Reporte_Produccion_Variedades_${fechaHoy}.xlsx`;
      XLSX.writeFile(wb, filename);
    } catch (err) {
      console.error('Error al exportar reporte a Excel:', err);
      alert('Error al generar la planilla Excel. Intente nuevamente.');
    }
  };

  return (
    <div className="space-y-6 text-left">
      {/* 1. ENCABEZADO PRINCIPAL DE LA HOJA */}
      <div className="bg-gradient-to-r from-[#00603C] via-[#004d30] to-[#254731] text-white p-6 sm:p-7 rounded-3xl shadow-lg border border-emerald-900/30 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-[10px] font-sans font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-amber-400 text-emerald-950 shadow-2xs">
              Módulo Oficial de Planta
            </span>
            <span className="text-[10px] font-mono text-emerald-200">
              Agro Abacus · La Barrancosa
            </span>
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl font-black tracking-tight text-[#F6EFDC] flex items-center gap-3">
            <Factory className="w-8 h-8 text-[#C9922E]" />
            <span>Reporte de Producción</span>
          </h2>
          <p className="text-xs sm:text-sm text-emerald-100/90 max-w-2xl leading-relaxed">
            Consolidado histórico de producción por variedad. Los kilogramos reflejan estrictamente el total elaborado en planta y <strong>no disminuyen por salidas, despachos o movimientos</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            type="button"
            id="btn-actualizar-datos-reporte"
            onClick={handleActualizarDatos}
            disabled={isRefreshing}
            className="px-4 py-2.5 bg-emerald-800/90 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow-md flex items-center gap-2 cursor-pointer border border-emerald-500/40 active:scale-95 disabled:opacity-50"
            title="Actualizar datos del reporte tras modificaciones realizadas en lotes"
          >
            <RotateCcw className={`w-4 h-4 text-emerald-200 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Actualizando...' : 'Actualizar Datos'}</span>
          </button>

          <button
            type="button"
            id="btn-exportar-excel-reporte"
            onClick={handleExportarExcel}
            className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-emerald-950 font-bold text-xs uppercase tracking-wider rounded-xl transition shadow-md flex items-center gap-2 cursor-pointer"
            title="Descargar reporte completo en formato Excel (.xlsx)"
          >
            <Download className="w-4 h-4 text-emerald-950" />
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* NOTIFICACIÓN TOAST DE ACTUALIZACIÓN DE DATOS */}
      {refreshToast && (
        <div className="p-3.5 bg-emerald-900 border border-emerald-400 text-emerald-100 rounded-2xl text-xs flex items-center justify-between shadow-lg animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
            <span className="font-semibold">{refreshToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setRefreshToast(null)}
            className="text-emerald-300 hover:text-white p-1 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* BANNER REGLA OFICIAL DE PRODUCCIÓN */}
      <div className="bg-emerald-50/90 border border-emerald-300/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-2xs">
        <div className="flex items-center gap-2.5 text-emerald-950">
          <ShieldCheck className="w-5 h-5 text-[#00603C] shrink-0" />
          <span>
            <strong>Regla Oficial de Producción:</strong> Para cantidad de kilos producidos se toman todos los kilos dados de alta de los lotes, <strong>sin contar los kilos tratados</strong>. Los kilos dados de alta marcados como tratados alimentan la columna de Kilos Tratados. No se cuentan lotes originados por movimientos para kilos producidos.
          </span>
        </div>
        <span className="font-mono font-bold text-[11px] text-[#00603C] bg-white px-3 py-1 rounded-xl border border-emerald-200 shrink-0 shadow-2xs">
          {lotesAptosProduccion.length} lotes de producción contabilizados
        </span>
      </div>

      {/* 2. TARJETAS KPI DE RESUMEN EJECUTIVO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Kilos Producidos */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden group hover:border-[#00603C] transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              Total Kilos Producidos
            </span>
            <div className="p-2 bg-emerald-50 text-[#00603C] rounded-xl border border-emerald-200">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono text-2xl font-black text-gray-900 tracking-tight">
            {formatNumberArg(totalesGenerales.totalKgProducidos, 0)} <span className="text-sm font-sans font-bold text-gray-500">kg</span>
          </div>
          <div className="text-[11px] text-gray-500 mt-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#00603C]" />
            <span>Producción total consolidada</span>
          </div>
        </div>

        {/* KPI 2: Total Kilos Tratados */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden group hover:border-[#C9922E] transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              Kilos Tratados (Curados)
            </span>
            <div className="p-2 bg-amber-50 text-[#C9922E] rounded-xl border border-amber-200">
              <FlaskConical className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono text-2xl font-black text-[#00603C] tracking-tight">
            {formatNumberArg(totalesGenerales.totalKgTratados, 0)} <span className="text-sm font-sans font-bold text-gray-500">kg</span>
          </div>
          <div className="text-[11px] text-gray-500 mt-1 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#C9922E]" />
            <span>Semilla con curasemilla aplicado</span>
          </div>
        </div>

        {/* KPI 3: Porcentaje Tratado */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden group hover:border-[#00603C] transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              % Tratado vs Sin Tratar
            </span>
            <div className="p-2 bg-emerald-50 text-[#00603C] rounded-xl border border-emerald-200">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-2xl font-black text-gray-900">
              {totalesGenerales.porcentajeTratadoGlobal}%
            </span>
            <span className="text-xs text-gray-400 font-medium">del volumen</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 mt-2 overflow-hidden">
            <div
              className="bg-[#00603C] h-2 rounded-full transition-all duration-500"
              style={{ width: `${totalesGenerales.porcentajeTratadoGlobal}%` }}
            />
          </div>
        </div>

        {/* KPI 4: Variedades y Lotes */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden group hover:border-[#00603C] transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              Variedades / Lotes
            </span>
            <div className="p-2 bg-slate-50 text-slate-700 rounded-xl border border-slate-200">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono text-2xl font-black text-gray-900 tracking-tight">
            {totalesGenerales.totalVariedades}{' '}
            <span className="text-sm font-sans font-bold text-gray-500">
              var. ({totalesGenerales.totalLotes} lotes)
            </span>
          </div>
          <div className="text-[11px] text-gray-500 mt-1 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-[#00603C]" />
            <span>Datos cruzados con catálogo BD</span>
          </div>
        </div>
      </div>

      {/* 3. SECCIÓN DE FILTROS (CLIENTE BD, VARIEDAD BD, TRATAMIENTO) */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#00603C]" />
            <span className="text-xs font-bold font-sans uppercase tracking-wider text-gray-700">
              Filtros del Reporte
            </span>
            <span className="text-[10px] font-mono text-[#00603C] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-bold">
              Bases de Datos Oficiales
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-3 py-1.5 text-xs text-gray-600 hover:text-red-700 hover:bg-red-50 rounded-lg border border-gray-200 transition cursor-pointer flex items-center gap-1.5 font-bold"
              title="Restablecer todos los filtros"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpiar Filtros</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 text-xs">
          {/* 1. Filtro Cliente (Datos desde Catálogo de Clientes de BD) */}
          <div>
            <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Database className="w-3 h-3 text-[#00603C]" />
              <span>Cliente (Base de Datos)</span>
            </label>
            <select
              value={filterCliente}
              onChange={(e) => setFilterCliente(e.target.value)}
              className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00603C] font-semibold text-gray-800 text-xs"
            >
              <option value="">Todos los Clientes ({clientesDatabase.length} en BD)</option>
              {clientesDatabase.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* 2. Filtro Variedad (Datos desde Catálogo de Variedades de BD) */}
          <div>
            <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Database className="w-3 h-3 text-[#C9922E]" />
              <span>Variedad (Base de Datos)</span>
            </label>
            <select
              value={filterVariedad}
              onChange={(e) => setFilterVariedad(e.target.value)}
              className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00603C] font-semibold text-gray-800 text-xs"
            >
              <option value="">Todas las Variedades ({variedadesNombresUnicos.length} disp.)</option>
              {variedadesNombresUnicos.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>

          {/* 3. Filtro Tratamiento */}
          <div>
            <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1 flex items-center gap-1">
              <FlaskConical className="w-3 h-3 text-[#00603C]" />
              <span>Tratamiento</span>
            </label>
            <select
              value={filterTratamiento}
              onChange={(e) => setFilterTratamiento(e.target.value)}
              className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00603C] font-semibold text-gray-800 text-xs"
            >
              <option value="todos">Todos los Tratamientos</option>
              <option value="tratado">🟢 Solo Tratados (Curados)</option>
              <option value="sin_tratar">⚪ Solo Sin Tratar (Original)</option>
              {tratamientosDisponibles
                .filter(t => t !== 'Tratado' && t !== 'Sin Tratar')
                .map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
            </select>
          </div>

          {/* 4. Buscador Rápido de Texto */}
          <div>
            <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Search className="w-3 h-3 text-gray-400" />
              <span>Buscar en Resultados</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Lote, cliente o variedad..."
                className="w-full h-10 pl-8 pr-7 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00603C] text-xs font-medium"
              />
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-3" />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-2.5 text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. DASHBOARD EN FORMATO DE TABLA CONSOLIDADA */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden text-xs">
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-900/5 via-white to-amber-50/25 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#00603C] text-white flex items-center justify-center shadow-xs shrink-0">
              <FileSpreadsheet className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <h3 className="font-serif text-base sm:text-lg font-bold text-[#1A1A1A]">
                Producción Consolidada por Variedad
              </h3>
              <p className="text-[11px] text-gray-500">
                Mostrando <strong>{filasReporte.length}</strong> variedades con producción acumulada
              </p>
            </div>
          </div>

          <div className="text-[11px] text-gray-500 font-medium">
            Haga clic en <strong>"Revisar Lotes"</strong> en cualquier fila para inspeccionar los lotes que integran los kg producidos.
          </div>
        </div>

        {filasReporte.length === 0 ? (
          <div className="p-12 text-center text-gray-400 space-y-3">
            <Search className="w-10 h-10 mx-auto text-gray-300" />
            <p className="text-sm font-semibold text-gray-600">
              No se encontraron registros de producción para los filtros aplicados.
            </p>
            <p className="text-xs text-gray-400 max-w-md mx-auto">
              Intente seleccionando "Todos los Clientes", "Todas las Variedades" o limpiando el campo de búsqueda.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-2 px-4 py-2 bg-emerald-50 text-[#00603C] border border-emerald-200 rounded-xl font-bold text-xs hover:bg-emerald-100 transition cursor-pointer"
            >
              Restablecer Filtros
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#00603C] text-white font-sans uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4 font-bold">Cliente</th>
                  <th className="py-3.5 px-4 font-bold">Especie</th>
                  <th className="py-3.5 px-4 font-bold">Variedad</th>
                  <th className="py-3.5 px-4 font-bold text-right">Cantidad Kilos Producidos</th>
                  <th className="py-3.5 px-4 font-bold text-right">Cantidad Kilos Tratados</th>
                  <th className="py-3.5 px-4 font-bold text-center">% Tratado</th>
                  <th className="py-3.5 px-4 font-bold text-center">Lotes</th>
                  <th className="py-3.5 px-4 font-bold text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filasReporte.map((fila, idx) => (
                  <tr
                    key={fila.id}
                    className={`transition-colors hover:bg-emerald-50/50 ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                    }`}
                  >
                    {/* 1. Cliente */}
                    <td className="py-3.5 px-4 font-bold text-gray-900 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#00603C]" />
                        <span>{fila.cliente}</span>
                      </div>
                    </td>

                    {/* 2. Especie */}
                    <td className="py-3.5 px-4 text-gray-700 whitespace-nowrap font-medium">
                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-[#00603C] px-2 py-0.5 rounded-md border border-emerald-200 font-semibold text-[11px]">
                        {fila.especie === 'Soja' && '🌿'}
                        {fila.especie === 'Trigo' && '🌾'}
                        {fila.especie === 'Arveja' && '🟢'}
                        <span>{fila.especie}</span>
                      </span>
                    </td>

                    {/* 3. Variedades */}
                    <td className="py-3.5 px-4 font-black text-gray-900 whitespace-nowrap">
                      <span className="font-mono text-sm bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-gray-900">
                        {fila.variedad}
                      </span>
                    </td>

                    {/* 4. Cantidad de Kilos Producidos por Variedad */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="font-mono font-black text-sm text-gray-900">
                        {formatNumberArg(fila.kgProducidos, 0)}{' '}
                        <span className="text-[10px] font-sans font-bold text-gray-400">kg</span>
                      </div>
                    </td>

                    {/* 5. Cantidad de Kilos Tratados por Variedad */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className={`font-mono font-bold text-sm ${fila.kgTratados > 0 ? 'text-[#00603C]' : 'text-gray-400'}`}>
                        {formatNumberArg(fila.kgTratados, 0)}{' '}
                        <span className="text-[10px] font-sans font-bold text-gray-400">kg</span>
                      </div>
                    </td>

                    {/* 6. % Tratado */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <div className="inline-flex flex-col items-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                          fila.porcentajeTratado === 100
                            ? 'bg-emerald-100 text-[#00603C] border border-emerald-300'
                            : fila.porcentajeTratado > 0
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-gray-100 text-gray-600 border border-gray-200'
                        }`}>
                          {fila.porcentajeTratado}%
                        </span>
                        <div className="w-16 bg-gray-100 rounded-full h-1.5 mt-1 overflow-hidden">
                          <div
                            className="bg-[#00603C] h-1.5 rounded-full"
                            style={{ width: `${fila.porcentajeTratado}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* 7. Cantidad de Lotes */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <span className="font-mono font-bold text-xs bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 text-slate-800">
                        {fila.cantidadLotes} {fila.cantidadLotes === 1 ? 'lote' : 'lotes'}
                      </span>
                    </td>

                    {/* 8. Botón Revisar Lotes */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setVariedadDetalleSeleccionada(fila)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#00603C] hover:bg-[#254731] text-white rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer"
                        title={`Revisar los ${fila.cantidadLotes} lotes de ${fila.variedad}`}
                      >
                        <Eye className="w-3.5 h-3.5 text-amber-300" />
                        <span>Revisar Lotes</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* PIE DE TABLA CON TOTALES CONSOLIDADOS */}
              <tfoot>
                <tr className="bg-slate-100/90 border-t-2 border-emerald-900/20 font-bold text-gray-900">
                  <td colSpan={3} className="py-3.5 px-4 uppercase tracking-wider text-xs font-black text-gray-800">
                    Totales Consolidados ({filasReporte.length} variedades)
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-black text-base text-[#00603C]">
                    {formatNumberArg(totalesGenerales.totalKgProducidos, 0)}{' '}
                    <span className="text-[10px] font-sans font-bold text-gray-500">kg</span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-black text-base text-[#00603C]">
                    {formatNumberArg(totalesGenerales.totalKgTratados, 0)}{' '}
                    <span className="text-[10px] font-sans font-bold text-gray-500">kg</span>
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono font-bold text-xs">
                    {totalesGenerales.porcentajeTratadoGlobal}%
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono font-bold text-xs text-gray-700">
                    {totalesGenerales.totalLotes} lotes
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wide">
                      Consolidado
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* 5. MODAL "REVISAR LOTES QUE INTEGRAN LOS KILOS PRODUCIDOS" */}
      {variedadDetalleSeleccionada && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white w-full max-w-5xl max-h-[92vh] rounded-3xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150 text-left">
            {/* Cabecera del Modal */}
            <div className="p-5 sm:p-6 bg-gradient-to-r from-[#00603C] to-[#254731] text-white flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-400 text-emerald-950 px-2 py-0.5 rounded">
                    Revisión de Lotes Producidos
                  </span>
                  <span className="text-xs text-emerald-200">
                    {variedadDetalleSeleccionada.cliente} · {variedadDetalleSeleccionada.especie}
                  </span>
                </div>
                <h3 className="font-serif text-xl sm:text-2xl font-black text-[#F6EFDC] flex items-center gap-2">
                  <span>Variedad: {variedadDetalleSeleccionada.variedad}</span>
                </h3>
                <p className="text-xs text-emerald-100/90 mt-1">
                  {variedadDetalleSeleccionada.cantidadLotes} {variedadDetalleSeleccionada.cantidadLotes === 1 ? 'lote integra' : 'lotes integran'} la producción acumulada de <strong>{formatNumberArg(variedadDetalleSeleccionada.kgProducidos, 0)} kg</strong>.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setVariedadDetalleSeleccionada(null)}
                className="text-white/80 hover:text-white p-1 rounded-xl hover:bg-white/10 transition cursor-pointer"
                title="Cerrar modal"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Aviso informativo de consistencia de kilos */}
            <div className="bg-emerald-50/90 px-5 py-3 border-b border-emerald-200/80 text-emerald-950 text-xs flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#00603C] shrink-0" />
              <span>
                <strong>Regla de Producción:</strong> Se listan los lotes dados de alta que integran esta variedad. Para cantidad de kilos producidos se toman todos los kilos dados de alta de los lotes, <strong>sin contar los kilos tratados</strong>. Los kilos dados de alta marcados como tratados alimentan la columna de Kilos Tratados. No se cuentan lotes originados por movimientos para kilos producidos.
              </span>
            </div>

            {/* Contenido scrolleable del Modal */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
              {/* Tarjetas resumen de la variedad */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                  <span className="text-[10px] text-gray-500 font-bold uppercase block">Kilos Producidos</span>
                  <span className="font-mono text-base font-black text-gray-900">
                    {formatNumberArg(variedadDetalleSeleccionada.kgProducidos, 0)} kg
                  </span>
                </div>
                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                  <span className="text-[10px] text-[#00603C] font-bold uppercase block">Kilos Tratados</span>
                  <span className="font-mono text-base font-black text-[#00603C]">
                    {formatNumberArg(variedadDetalleSeleccionada.kgTratados, 0)} kg
                  </span>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                  <span className="text-[10px] text-gray-500 font-bold uppercase block">Sin Tratar</span>
                  <span className="font-mono text-base font-bold text-gray-700">
                    {formatNumberArg(variedadDetalleSeleccionada.kgSinTratar, 0)} kg
                  </span>
                </div>
                <div className="bg-amber-50 p-3 rounded-xl border border-amber-200">
                  <span className="text-[10px] text-[#C9922E] font-bold uppercase block">% Tratado</span>
                  <span className="font-mono text-base font-black text-[#C9922E]">
                    {variedadDetalleSeleccionada.porcentajeTratado}%
                  </span>
                </div>
              </div>

              {/* Tabla de Lotes */}
              <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#00603C] text-white uppercase text-[10px] font-sans tracking-wider">
                      <th className="py-2.5 px-3">Lote N°</th>
                      <th className="py-2.5 px-3">Tipo / Cat.</th>
                      <th className="py-2.5 px-3">Tratamiento</th>
                      <th className="py-2.5 px-3 text-right">Kg Producidos</th>
                      <th className="py-2.5 px-3 text-right">Kg Tratados</th>
                      <th className="py-2.5 px-3 text-right">Stock Actual</th>
                      <th className="py-2.5 px-3 text-right">Despachos</th>
                      <th className="py-2.5 px-3">Ubicación</th>
                      <th className="py-2.5 px-3 text-center">Ficha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {variedadDetalleSeleccionada.lotes.map((item, lIdx) => {
                      const l = item.lote;
                      const tratsStr = Array.isArray(l.tratamiento) ? l.tratamiento.join(', ') : (l.tratamiento || 'Sin Tratar');
                      const ubi = l.ubicacionAcopio || (l.ala ? `Ala ${l.ala} · Sec ${l.sector || 1}` : 'Planta');

                      return (
                        <tr key={l.id || lIdx} className="hover:bg-emerald-50/40 transition">
                          {/* N° Lote */}
                          <td className="py-2.5 px-3 font-mono font-black text-sm text-gray-900 whitespace-nowrap">
                            <span className="bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              L-{l.loteNro}
                            </span>
                          </td>

                          {/* Tipo / Categoría */}
                          <td className="py-2.5 px-3 text-gray-700 whitespace-nowrap">
                            <div>{l.tipo}</div>
                            <div className="text-[10px] text-gray-400 font-semibold">{l.categoria}</div>
                          </td>

                          {/* Tratamiento */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {item.isTratado ? (
                              <span className="inline-flex items-center gap-1 bg-emerald-100 text-[#00603C] px-2 py-0.5 rounded text-[11px] font-bold border border-emerald-300">
                                <Sparkles className="w-3 h-3 text-[#00603C]" />
                                {tratsStr}
                              </span>
                            ) : (
                              <span className="text-gray-500 text-[11px] font-medium bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                                Sin Tratar
                              </span>
                            )}
                          </td>

                          {/* Kg Producidos */}
                          <td className="py-2.5 px-3 text-right font-mono font-black text-sm text-gray-900 whitespace-nowrap">
                            <div>{formatNumberArg(item.kgProducidos, 0)} kg</div>
                            {item.kgProducidos === 0 && item.isTratado && (
                              <span className="text-[9px] font-sans font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300">
                                Tratado
                              </span>
                            )}
                            {item.kgProducidos === 0 && !item.isTratado && (
                              <span className="text-[9px] font-sans font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                                Movimiento
                              </span>
                            )}
                          </td>

                          {/* Kg Tratados */}
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-xs text-[#00603C] whitespace-nowrap">
                            {item.kgTratados > 0 ? `${formatNumberArg(item.kgTratados, 0)} kg` : '—'}
                          </td>

                          {/* Stock Actual */}
                          <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap">
                            <div className="text-gray-900 font-bold">{formatNumberArg(item.stockActualKg, 0)} kg</div>
                            <div className="text-[10px] text-gray-400">{item.stockActualBolsas} b.</div>
                          </td>

                          {/* Despachos */}
                          <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap">
                            {item.kgDespachados > 0 ? (
                              <span className="text-rose-700 font-bold text-xs bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                -{formatNumberArg(item.kgDespachados, 0)} kg
                              </span>
                            ) : (
                              <span className="text-gray-400 text-[11px]">—</span>
                            )}
                          </td>

                          {/* Ubicación */}
                          <td className="py-2.5 px-3 text-gray-700 whitespace-nowrap text-[11px]">
                            <span className="inline-flex items-center gap-1 text-[#00603C] font-semibold">
                              <MapPin className="w-3 h-3" />
                              {ubi}
                            </span>
                          </td>

                          {/* Acción Ficha */}
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            {onSelectLote && (
                              <button
                                type="button"
                                onClick={() => {
                                  setVariedadDetalleSeleccionada(null);
                                  onSelectLote(l);
                                }}
                                className="px-2 py-1 bg-white hover:bg-emerald-50 text-[#00603C] border border-emerald-300 rounded-lg text-[10px] font-bold transition flex items-center gap-1 mx-auto cursor-pointer shadow-2xs"
                                title="Ver Ficha Técnica completa del lote"
                              >
                                <span>Ver</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pie del Modal */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="text-gray-500 font-medium">
                Total de lotes listados: <strong>{variedadDetalleSeleccionada.cantidadLotes}</strong>
              </span>

              <button
                type="button"
                onClick={() => setVariedadDetalleSeleccionada(null)}
                className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-xl transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
