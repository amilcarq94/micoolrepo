/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  SiloId,
  MovimientoSilo,
  EspecieType,
  CategoriaType,
  CAPACIDAD_MAX_SILO,
  SILOS_PHYSICAL_ORDER,
  EstadoSiloManual,
  SilosEstadoMap,
  SILOS_ESTADO_DEFAULT,
  PlantaConfig,
  VARIEDADES_DATASET_OFICIAL,
  Lote,
  Chofer,
  BolsonCampo,
  MotivoSalidaManual
} from '../types';
import { SILOS_DISPONIBLES } from './SilosSelector';
import { getSiloDetailedInfo } from '../utils/siloValidation';
import { formatKg } from '../utils/formatters';
import { SiloIcon, LogoSiloLoose } from './Logo';
import {
  Warehouse,
  Plus,
  RotateCcw,
  History,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  User,
  CheckCircle2,
  Search,
  Filter,
  Droplets,
  Eye,
  Download,
  X,
  FileSpreadsheet,
  Lock,
  KeyRound,
  Trash2,
  Building2,
  Scale,
  Layers,
  Sparkles,
  ChevronDown,
  RefreshCw,
  FileText,
  Check,
  Loader2
} from 'lucide-react';
import { exportElementAsJpg } from '../utils/exportImage';
import { FichaTecnicaSiloModal } from './FichaTecnicaSiloModal';
import { GrillaSeisSilosModal } from './GrillaSeisSilosModal';
import { ReportePlanillaExcelSilosModal } from './ReportePlanillaExcelSilosModal';
import { CircularSiloCard } from './CircularSiloCard';
import { SiloVinculadoDashboard } from './SiloVinculadoDashboard';
import { verifyAutorizadorPassword } from '../utils/despachantes';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine
} from 'recharts';

interface IngresoSilosViewProps {
  movimientosSilo: MovimientoSilo[];
  siloStocks?: Record<string, number>;
  clientes: string[];
  especies: string[];
  plantaConfig?: PlantaConfig;
  currentUser: { nombre: string; rol: string };
  choferes?: Chofer[];
  bolsones?: BolsonCampo[];
  silosEstadoManual?: SilosEstadoMap;
  onUpdateSiloEstadoManual?: (siloId: SiloId, estado: EstadoSiloManual) => void;
  onRegistrarIngreso?: (movimiento: MovimientoSilo) => void;
  onRegistrarIngresoSilo?: (movimiento: MovimientoSilo) => void;
  onRegistrarIngresosMultiple?: (movimientos: MovimientoSilo[]) => void;
  onRegistrarIngresosMultipleSilo?: (movimientos: MovimientoSilo[]) => void;
  onRegistrarSalidaManual?: (movimiento: MovimientoSilo) => void;
  onRegistrarSalidaManualSilo?: (movimiento: MovimientoSilo) => void;
  onSaveChofer?: (chofer: Chofer) => void;
  onImportChoferes?: (choferes: Chofer[]) => void;
  onPonerEnCero?: (siloId: SiloId, fecha: string, usuario: string, motivo: string, kgAnterior: number) => void;
  onPonerSiloEnCero?: (siloId: SiloId, fecha: string, usuario: string, motivo: string, kgAnterior: number) => void;
  onEditarMovimientoSilo?: (movimiento: MovimientoSilo) => void;
  onEliminarMovimientoSilo?: (movimientoId: string, siloId: SiloId) => void;
  onReordenarMovimientosSilo?: (movimientos: MovimientoSilo[]) => void;
  onNavigateToPlanta?: () => void;
  lotes?: Lote[];
}

export const IngresoSilosView: React.FC<IngresoSilosViewProps> = ({
  movimientosSilo = [],
  clientes = [],
  especies = ['Soja', 'Trigo', 'Maíz', 'Arveja', 'Cebada', 'Girasol'],
  plantaConfig,
  currentUser,
  silosEstadoManual = SILOS_ESTADO_DEFAULT,
  onUpdateSiloEstadoManual,
  onRegistrarIngreso,
  onRegistrarIngresoSilo,
  onRegistrarSalidaManual,
  onRegistrarSalidaManualSilo,
  onPonerEnCero,
  onPonerSiloEnCero,
  onEliminarMovimientoSilo,
  onNavigateToPlanta,
  lotes = []
}) => {
  // Silo seleccionado actualmente
  const [activeSilo, setActiveSilo] = useState<SiloId>('Silo 1');

  // Tema visual de tarjetas de silos (Negro vs Rojo)
  const [silosVisualColor, setSilosVisualColor] = useState<'NEGRO' | 'ROJO'>('NEGRO');
  const [showChart, setShowChart] = useState<boolean>(false);

  // Modales
  const [showPlanillaExcelModal, setShowPlanillaExcelModal] = useState(false);
  const [showGrillaSeisSilos, setShowGrillaSeisSilos] = useState(false);
  const [fichaModalSilo, setFichaModalSilo] = useState<SiloId | null>(null);
  const [showModalDescontaminacion, setShowModalDescontaminacion] = useState(false);
  const [showModalSalidaManual, setShowModalSalidaManual] = useState(false);
  const [movimientoAEliminar, setMovimientoAEliminar] = useState<MovimientoSilo | null>(null);
  const [fraseConfirmacionEliminar, setFraseConfirmacionEliminar] = useState('');
  const [errorFraseEliminar, setErrorFraseEliminar] = useState('');

  // Salida manual de kilos
  const [kgSalidaManual, setKgSalidaManual] = useState<number | ''>('');
  const [motivoSalidaManual, setMotivoSalidaManual] = useState<MotivoSalidaManual>('Consumo a granel');
  const [observacionesSalidaManual, setObservacionesSalidaManual] = useState('');

  // Notificaciones de usuario
  const [formSuccess, setFormSuccess] = useState<string>('');
  const [formError, setFormError] = useState<string>('');

  // Filtro del histórico de movimientos
  const [historicoFiltroSilo, setHistoricoFiltroSilo] = useState<SiloId | 'TODOS'>('TODOS');
  const [historicoBusqueda, setHistoricoBusqueda] = useState<string>('');

  // =========================================================================
  // ESTADO DE CARGA MANUAL A SILO
  // =========================================================================
  const [kilosManual, setKilosManual] = useState<string>('28000');
  const [humedadManual, setHumedadManual] = useState<string>('12.5');
  const [clienteManual, setClienteManual] = useState<string>(clientes[0] || 'San Diego Semilla');
  const [variedadManual, setVariedadManual] = useState<string>('');
  const [especieManual, setEspecieManual] = useState<string>('Soja');
  const [fechaManual, setFechaManual] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [observacionesManual, setObservacionesManual] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Función unificada para registrar ingreso
  const handleRegistrar = onRegistrarIngresoSilo || onRegistrarIngreso;
  const handleRegistrarSalida = onRegistrarSalidaManualSilo || onRegistrarSalidaManual;
  const handlePonerEnCeroUnified = onPonerSiloEnCero || onPonerEnCero;

  // Stocks calculados por Silo
  const silosStocksMap = useMemo<Record<SiloId, number>>(() => {
    const map: Record<SiloId, number> = {
      'Silo 1': 0,
      'Silo 2': 0,
      'Silo 3': 0,
      'Silo 4': 0,
      'Silo 5': 0,
      'Silo 6': 0,
    };
    (SILOS_PHYSICAL_ORDER as SiloId[]).forEach((sId) => {
      const info = getSiloDetailedInfo(sId, movimientosSilo);
      map[sId] = info.stockKg;
    });
    return map;
  }, [movimientosSilo]);

  // Stock total de la planta
  const totalKgPlanta = useMemo(() => {
    return Object.values(silosStocksMap).reduce((acc: number, curr: any) => acc + (Number(curr) || 0), 0);
  }, [silosStocksMap]);

  // Información detallada del silo activo
  const activeSiloInfo = useMemo(() => {
    return getSiloDetailedInfo(activeSilo, movimientosSilo);
  }, [activeSilo, movimientosSilo]);

  // =========================================================================
  // VARIEDADES VINCULADAS CON EL CLIENTE SELECCIONADO (DINÁMICO)
  // =========================================================================
  const variedadesVinculadas = useMemo(() => {
    if (!clienteManual) return [];

    const setVars = new Set<string>();
    const clienteNorm = clienteManual.trim().toLowerCase();

    // 1. Dataset oficial
    VARIEDADES_DATASET_OFICIAL.forEach((item) => {
      const c = (item.CLIENTE || '').toLowerCase();
      const s = (item.SEMILLERO || '').toLowerCase();
      if (c.includes(clienteNorm) || clienteNorm.includes(c) || s.includes(clienteNorm) || clienteNorm.includes(s)) {
        if (item.VARIEDAD) setVars.add(item.VARIEDAD);
      }
    });

    // 2. Lotes existentes del cliente
    (lotes || []).forEach((l) => {
      if (l.cliente && l.cliente.trim().toLowerCase() === clienteNorm && l.variedad) {
        setVars.add(l.variedad);
      }
    });

    // 3. Movimientos previos de silos del cliente
    (movimientosSilo || []).forEach((m) => {
      if (m.cliente && m.cliente.trim().toLowerCase() === clienteNorm && m.variedad) {
        setVars.add(m.variedad);
      }
    });

    // 4. Base de variedades de plantaConfig
    if (plantaConfig?.variedadesDb) {
      plantaConfig.variedadesDb.forEach((v) => {
        if (v.cliente && v.cliente.trim().toLowerCase() === clienteNorm && v.variedad) {
          setVars.add(v.variedad);
        }
      });
    }

    return Array.from(setVars).filter(Boolean).sort();
  }, [clienteManual, lotes, movimientosSilo, plantaConfig]);

  // Todas las variedades disponibles como opción extendida
  const todasLasVariedades = useMemo(() => {
    const setVars = new Set<string>();
    if (plantaConfig?.variedades) {
      plantaConfig.variedades.forEach((v) => setVars.add(v));
    }
    VARIEDADES_DATASET_OFICIAL.forEach((item) => {
      if (item.VARIEDAD) setVars.add(item.VARIEDAD);
    });
    return Array.from(setVars).filter(Boolean).sort();
  }, [plantaConfig]);

  // Al cambiar cliente, auto-seleccionar primera variedad vinculada si existe
  React.useEffect(() => {
    if (variedadesVinculadas.length > 0) {
      if (!variedadesVinculadas.includes(variedadManual)) {
        setVariedadManual(variedadesVinculadas[0]);
      }
    } else if (todasLasVariedades.length > 0 && !variedadManual) {
      setVariedadManual(todasLasVariedades[0]);
    }
  }, [clienteManual, variedadesVinculadas, todasLasVariedades]);

  // Detectar especie a partir de la variedad seleccionada si está en el dataset oficial
  React.useEffect(() => {
    if (variedadManual) {
      const match = VARIEDADES_DATASET_OFICIAL.find(
        (v) => v.VARIEDAD.toLowerCase() === variedadManual.toLowerCase()
      );
      if (match && match.ESPECIE) {
        setEspecieManual(match.ESPECIE);
      }
    }
  }, [variedadManual]);

  // =========================================================================
  // EJECUCIÓN DE CARGA MANUAL A SILO
  // =========================================================================
  const handleSubmitCargaManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    const kgNum = Number(kilosManual);
    if (isNaN(kgNum) || kgNum <= 0) {
      setFormError('Por favor ingrese una cantidad válida de kilos mayor a 0.');
      return;
    }

    if (!clienteManual) {
      setFormError('Debe seleccionar un cliente.');
      return;
    }

    if (!variedadManual) {
      setFormError('Debe indicar o seleccionar una variedad.');
      return;
    }

    const humNum = humedadManual ? Number(humedadManual) : undefined;
    if (humNum !== undefined && (isNaN(humNum) || humNum < 0 || humNum > 35)) {
      setFormError('La humedad debe ser un valor porcentual entre 0% y 35%.');
      return;
    }

    setIsSubmitting(true);
    try {
      const nuevoMov: MovimientoSilo = {
        id: `MANUAL-${activeSilo.replace(/\s+/g, '')}-${Date.now()}`,
        siloId: activeSilo,
        fecha: fechaManual || new Date().toISOString().split('T')[0],
        hora: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
        tipo: 'INGRESO',
        kg: kgNum,
        cliente: clienteManual,
        variedad: variedadManual,
        especie: especieManual || 'Soja',
        humedad: humNum,
        usuario: currentUser.nombre || 'Operador',
        observaciones: observacionesManual.trim() || 'Carga manual de kilos',
        tipoTransporte: 'CHOFER'
      };

      if (handleRegistrar) {
        await handleRegistrar(nuevoMov);
      }

      // Marcar el estado manual del silo como OCUPADO
      if (onUpdateSiloEstadoManual) {
        await onUpdateSiloEstadoManual(activeSilo, 'OCUPADO');
      }

      setFormSuccess(
        `Carga manual de ${formatKg(kgNum)} kg registrada con éxito en ${activeSilo} (${clienteManual} · ${variedadManual} · ${humNum ? `${humNum}% Hum` : 'Sin humedad'}).`
      );
      setKilosManual('');
      setObservacionesManual('');
    } catch (err) {
      console.error('Error al registrar carga manual a silo:', err);
      setFormError('Ocurrió un error al registrar la carga manual en la base de datos.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================================
  // BOTÓN "DESCONTAMINACIÓN VARIETAL"
  // =========================================================================
  const handleConfirmarDescontaminacion = async () => {
    const stockActual = silosStocksMap[activeSilo] || 0;
    const fechaHoy = new Date().toISOString().split('T')[0];
    const usuario = currentUser.nombre || 'Operador';

    try {
      if (handlePonerEnCeroUnified) {
        await handlePonerEnCeroUnified(
          activeSilo,
          fechaHoy,
          usuario,
          'Descontaminación Varietal',
          stockActual
        );
      }

      if (onUpdateSiloEstadoManual) {
        await onUpdateSiloEstadoManual(activeSilo, 'VACIO_LIMPIO');
      }

      // Resetear campos del formulario para nueva carga inmediata
      setKilosManual('');
      setHumedadManual('');
      setObservacionesManual('');
      setShowModalDescontaminacion(false);

      setFormSuccess(
        `Descontaminación varietal completada en ${activeSilo}. Silo en 0 kg (Vacío Limpio) y listo para una nueva carga.`
      );
    } catch (err) {
      console.error('Error en descontaminación varietal:', err);
      setFormError('Ocurrió un error al procesar la descontaminación varietal.');
    }
  };

  // =========================================================================
  // SALIDA MANUAL DE KILOS
  // =========================================================================
  const handleRegistrarSalidaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const kgSalida = Number(kgSalidaManual);
    const stockSilo = silosStocksMap[activeSilo] || 0;

    if (isNaN(kgSalida) || kgSalida <= 0) {
      alert('Ingrese una cantidad válida de kilos a descontar.');
      return;
    }

    if (kgSalida > stockSilo) {
      alert(`No puede descontar más de los ${formatKg(stockSilo)} kg disponibles en ${activeSilo}.`);
      return;
    }

    const movSalida: MovimientoSilo = {
      id: `SALIDA-MANUAL-${activeSilo.replace(/\s+/g, '')}-${Date.now()}`,
      siloId: activeSilo,
      fecha: new Date().toISOString().split('T')[0],
      hora: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      tipo: 'EGRESO_MANUAL',
      kg: kgSalida,
      motivoManual: motivoSalidaManual,
      usuario: currentUser.nombre || 'Operador',
      observaciones: observacionesSalidaManual || `Salida manual: ${motivoSalidaManual}`
    };

    if (handleRegistrarSalida) {
      await handleRegistrarSalida(movSalida);
    }

    setShowModalSalidaManual(false);
    setKgSalidaManual('');
    setObservacionesSalidaManual('');
    setFormSuccess(`Salida manual de ${formatKg(kgSalida)} kg registrada correctamente en ${activeSilo}.`);
  };

  // =========================================================================
  // ELIMINAR CARGA MANUAL DE SILO CON CONFIRMACIÓN DE FRASE
  // =========================================================================
  const handleConfirmarEliminarMovimiento = () => {
    if (!movimientoAEliminar) return;

    const fraseNormalizada = fraseConfirmacionEliminar.trim().toUpperCase();
    if (fraseNormalizada !== 'ELIMINAR INGRESO') {
      setErrorFraseEliminar('Debe escribir exactamente la frase "ELIMINAR INGRESO" para confirmar.');
      return;
    }

    if (onEliminarMovimientoSilo) {
      onEliminarMovimientoSilo(movimientoAEliminar.id, movimientoAEliminar.siloId);
      setFormSuccess(
        `Carga de ${formatKg(movimientoAEliminar.kg)} kg en ${movimientoAEliminar.siloId} eliminada correctamente.`
      );
    }

    setMovimientoAEliminar(null);
    setFraseConfirmacionEliminar('');
    setErrorFraseEliminar('');
  };

  // =========================================================================
  // MOVIMIENTOS HISTÓRICOS CON SALDO EN CADENA
  // =========================================================================
  const movimientosHistoricosFiltrados = useMemo(() => {
    // 1. Filtrar por silo si no es TODOS
    const movs = (movimientosSilo || []).filter((m) => {
      if (historicoFiltroSilo !== 'TODOS' && m.siloId !== historicoFiltroSilo) {
        return false;
      }
      return true;
    });

    // 2. Filtrar por texto de búsqueda
    const query = historicoBusqueda.trim().toLowerCase();
    const movsQuery = !query
      ? movs
      : movs.filter((m) => {
          const matchCliente = (m.cliente || '').toLowerCase().includes(query);
          const matchVariedad = (m.variedad || '').toLowerCase().includes(query);
          const matchEspecie = (m.especie || '').toLowerCase().includes(query);
          const matchUsuario = (m.usuario || '').toLowerCase().includes(query);
          const matchObs = (m.observaciones || '').toLowerCase().includes(query);
          const matchSilo = (m.siloId || '').toLowerCase().includes(query);
          const matchFecha = (m.fecha || '').includes(query);
          return matchCliente || matchVariedad || matchEspecie || matchUsuario || matchObs || matchSilo || matchFecha;
        });

    // 3. Ordenar cronológicamente descendente (más recientes arriba)
    return movsQuery.sort((a, b) => {
      const fA = `${a.fecha} ${a.hora || '00:00'}`;
      const fB = `${b.fecha} ${b.hora || '00:00'}`;
      return fB.localeCompare(fA) || (b.id || '').localeCompare(a.id || '');
    });
  }, [movimientosSilo, historicoFiltroSilo, historicoBusqueda]);

  // Exportar histórico a Excel
  const handleExportarExcelHistorico = () => {
    const dataToExport = movimientosHistoricosFiltrados.map((m) => ({
      Fecha: m.fecha,
      Hora: m.hora || '',
      Silo: m.siloId,
      Tipo: m.tipo === 'INGRESO' ? 'Carga Manual / Ingreso' : m.tipo === 'AJUSTE_ZERO' ? 'Ajuste a Cero' : m.tipo,
      Kilos: m.kg,
      Humedad: m.humedad !== undefined ? `${m.humedad}%` : '',
      Cliente: m.cliente || '',
      Variedad: m.variedad || '',
      Especie: m.especie || '',
      Usuario: m.usuario || '',
      Observaciones: m.observaciones || m.motivoManual || m.motivoZero || ''
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Historico_Silos');
    XLSX.writeFile(wb, `Historico_Silos_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Preparar fichas de los 6 silos para modal PDF
  const fichasSeisSilos = useMemo(() => {
    return (SILOS_PHYSICAL_ORDER as SiloId[]).map((sId) => {
      const info = getSiloDetailedInfo(sId, movimientosSilo);
      return {
        siloId: sId,
        denominacion: sId,
        capacidadKg: CAPACIDAD_MAX_SILO,
        capacidadBolsas: Math.floor(CAPACIDAD_MAX_SILO / 800),
        kgPorBolsa: 800,
        cliente: info.cliente || 'Sin asignar',
        especie: info.especie || 'Soja',
        variedad: info.variedad || 'Sin variedad',
        categoria: info.categoria || 'Original',
        humedad: info.humedad || '—',
        stockKg: info.stockKg,
        stockTn: info.stockTn,
        pctOcupacion: info.pctOcupacion,
        estadoLuz: silosEstadoManual[sId] || 'VACIO_LIMPIO',
        movimientos: info.movimientos
      };
    });
  }, [movimientosSilo, silosEstadoManual]);

  // Estado y Handler para Descarga en formato JPG del Dashboard de Silos Clasificadora
  const [isExportingJpg, setIsExportingJpg] = useState(false);

  const handleDescargarJpgSilos = async () => {
    setIsExportingJpg(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const fileName = `Dashboard_Silos_Clasificadora_${today}.jpg`;
      await exportElementAsJpg('dashboard-silos-clasificadora-capture', fileName, {
        backgroundColor: '#f8fafc',
        quality: 0.95,
        pixelRatio: 2,
      });
    } catch (err) {
      console.error('Error al exportar dashboard de Silos Clasificadora a JPG:', err);
    } finally {
      setIsExportingJpg(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12" id="vista-ingreso-silos">
      {/* ===================================================================== */}
      {/* CONTENEDOR MAESTRO DEL DASHBOARD DE SILOS CLASIFICADORA PARA JPG     */}
      {/* ===================================================================== */}
      <div id="dashboard-silos-clasificadora-capture" className="space-y-6">
        {/* ===================================================================== */}
        {/* 1. HEADER PRINCIPAL CON ESTÉTICA ORIGINAL DE PLANTA DE SILOS          */}
        {/* ===================================================================== */}
        <div className="bg-gradient-to-r from-emerald-950 via-[#00603C] to-[#254731] text-white rounded-3xl p-6 shadow-xl border border-emerald-800/40 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-3.5 bg-white/10 rounded-2xl border border-white/20 shadow-inner">
                <Warehouse className="w-8 h-8 text-amber-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-black uppercase tracking-widest text-amber-300 bg-amber-400/10 px-2.5 py-0.5 rounded-md border border-amber-400/30">
                    Silos Clasificadora
                  </span>
                  <span className="text-[10px] font-bold text-emerald-200 bg-emerald-900/80 px-2 py-0.5 rounded-md border border-emerald-700/50">
                    6 Silos Físicos
                  </span>
                </div>
                <h1 className="font-serif text-2xl sm:text-3xl font-bold mt-1 text-white tracking-tight">
                  Silos Clasificadora
                </h1>
                <p className="text-xs text-emerald-100/90 mt-0.5 max-w-xl">
                  Carga manual directa de kilos, humedad, cliente y variedad con gestión de descontaminación varietal e histórico de movimientos.
                </p>
              </div>
            </div>

            {/* Estadísticas de Stock Global & Acciones Rápidas */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="bg-emerald-900/60 border border-emerald-700/50 rounded-2xl px-4 py-2.5 text-right">
                <span className="text-[10px] font-mono uppercase text-emerald-300 font-bold block">
                  Stock Total en Planta
                </span>
                <span className="font-mono text-xl font-black text-amber-300">
                  {formatKg(totalKgPlanta)} <span className="text-xs font-normal text-emerald-200">kg</span>
                </span>
                <span className="text-[10px] text-emerald-200 block font-mono">
                  ({(totalKgPlanta / 1000).toFixed(1)} Tn)
                </span>
              </div>

              {/* Selector de Color de Tarjeta Silos (Negro vs Rojo) */}
              <div className="no-export flex items-center bg-black/30 border border-white/15 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => setSilosVisualColor('NEGRO')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    silosVisualColor === 'NEGRO'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-emerald-200 hover:text-white'
                  }`}
                  title="Tarjetas oscuras premium"
                >
                  Negro
                </button>
                <button
                  type="button"
                  onClick={() => setSilosVisualColor('ROJO')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    silosVisualColor === 'ROJO'
                      ? 'bg-red-800 text-white shadow-xs'
                      : 'text-emerald-200 hover:text-white'
                  }`}
                  title="Tarjetas tono burdeos / rojo institucional"
                >
                  Rojo
                </button>
              </div>

              {/* Botón Descargar JPG Silos Clasificadora */}
              <button
                type="button"
                id="btn-descargar-jpg-silos-clasificadora"
                onClick={handleDescargarJpgSilos}
                disabled={isExportingJpg}
                className="no-export flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-400 via-amber-300 to-[#C9922E] hover:from-amber-300 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs transition shadow-md border border-amber-300 disabled:opacity-50 cursor-pointer"
                title="Descargar este dashboard de Silos Clasificadora en formato imagen JPG de alta resolución"
              >
                {isExportingJpg ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                    <span>Generando JPG...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 text-slate-950" />
                    <span>Descargar JPG</span>
                  </>
                )}
              </button>

              {/* Botón Reporte Excel de Silos */}
              <button
                type="button"
                id="btn-abrir-planilla-excel-silos"
                onClick={() => setShowPlanillaExcelModal(true)}
                className="no-export flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-xs border border-emerald-400/40 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-amber-200" />
                <span>Planilla Silos</span>
              </button>

              {/* Botón PDF 6 Silos */}
              <button
                type="button"
                id="btn-grilla-seis-silos"
                onClick={() => setShowGrillaSeisSilos(true)}
                className="no-export flex items-center gap-1.5 px-3.5 py-2 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-bold transition border border-white/20 cursor-pointer"
              >
                <FileText className="w-4 h-4 text-emerald-300" />
                <span>PDF 6 Silos</span>
              </button>
            </div>
          </div>
        </div>

        {/* Banner de Mensajes de Éxito o Error */}
        {formSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-950 rounded-2xl flex items-center justify-between shadow-xs animate-in fade-in">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <p className="text-xs sm:text-sm font-semibold">{formSuccess}</p>
            </div>
            <button
              type="button"
              onClick={() => setFormSuccess('')}
              className="text-emerald-700 hover:text-emerald-950 text-xs font-bold px-2 py-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {formError && (
          <div className="p-4 bg-red-50 border border-red-300 text-red-950 rounded-2xl flex items-center justify-between shadow-xs animate-in fade-in">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
              <p className="text-xs sm:text-sm font-semibold">{formError}</p>
            </div>
            <button
              type="button"
              onClick={() => setFormError('')}
              className="text-red-700 hover:text-red-950 text-xs font-bold px-2 py-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* ===================================================================== */}
        {/* 2. GRILLA DE SILOS (ESTÉTICA CIRCULAR Y DISPOSICIÓN EXACTA DE IMAGEN) */}
        {/* ===================================================================== */}
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2 px-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 font-mono">
                <Layers className="w-4 h-4 text-[#00603C]" />
                Disposición Física de Silos (Haga clic en un silo para ver su información vinculada)
              </h2>
            </div>
            <span className="text-[11px] font-mono text-slate-500 font-bold">
              Capacidad por silo: {formatKg(CAPACIDAD_MAX_SILO)} kg ({CAPACIDAD_MAX_SILO / 1000} Tn)
            </span>
          </div>

          {/* Grilla 2 Columnas idéntica a la imagen de modelo (Col 1: Silo 4, 5, 6 | Col 2: Silo 3, 2, 1) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 max-w-5xl mx-auto justify-items-center py-4">
            {(['Silo 4', 'Silo 3', 'Silo 5', 'Silo 2', 'Silo 6', 'Silo 1'] as SiloId[]).map((sId) => {
              const info = getSiloDetailedInfo(sId, movimientosSilo);
              const isSelected = activeSilo === sId;
              const estadoLuz = silosEstadoManual[sId] || (info.stockKg > 0 ? 'OCUPADO' : 'VACIO_LIMPIO');

              return (
                <CircularSiloCard
                  key={sId}
                  siloId={sId}
                  isSelected={isSelected}
                  stockKg={info.stockKg}
                  stockTn={info.stockTn}
                  variedad={info.variedad}
                  cliente={info.cliente}
                  humedad={info.humedad}
                  estadoManual={estadoLuz}
                  onSelect={() => setActiveSilo(sId)}
                  onUpdateEstado={(nuevoEstado) => onUpdateSiloEstadoManual?.(sId, nuevoEstado)}
                  onVerHistorial={() => {
                    setHistoricoFiltroSilo(sId);
                    const el = document.getElementById('seccion-historico-silos');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  onVerFicha={() => setFichaModalSilo(sId)}
                />
              );
            })}
          </div>
        </div>

        {/* ===================================================================== */}
        {/* 3. VISOR O DASHBOARD CON INFORMACIÓN DEL SILO VINCULADO               */}
        {/* ===================================================================== */}
        <div id="visor-dashboard-silo-vinculado" className="space-y-4">
          <SiloVinculadoDashboard
            siloId={activeSilo}
            movimientosSilo={movimientosSilo}
            estadoManual={silosEstadoManual[activeSilo]}
            onUpdateEstado={(nuevo) => onUpdateSiloEstadoManual?.(activeSilo, nuevo)}
            onDescontaminarVarietal={() => setShowModalDescontaminacion(true)}
            onVerFichaCompleta={() => setFichaModalSilo(activeSilo)}
            onEliminarMovimiento={(mov) => {
              setMovimientoAEliminar(mov);
              setFraseConfirmacionEliminar('');
              setErrorFraseEliminar('');
            }}
          />
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 3. BARRA DE CONTROL DEL SILO SELECCIONADO                             */}
      {/* ===================================================================== */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 text-[#00603C] rounded-2xl border border-emerald-100">
              <Warehouse className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500">
                  Panel de Operaciones
                </span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded font-serif font-black text-xs">
                  {activeSilo}
                </span>
              </div>
              <h2 className="font-serif text-xl font-bold text-slate-900 mt-0.5">
                Gestión de {activeSilo}
              </h2>
            </div>
          </div>

          {/* Botones de Acción Inmediata: Descontaminación Varietal & Luces */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Luces de Estado Manual */}
            {onUpdateSiloEstadoManual && (
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => onUpdateSiloEstadoManual(activeSilo, 'OCUPADO')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                    silosEstadoManual[activeSilo] === 'OCUPADO'
                      ? 'bg-amber-400 text-slate-950 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Marcar Silo como Ocupado (Luz Amarilla)"
                >
                  Ocupado
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateSiloEstadoManual(activeSilo, 'VACIO_SUCIO')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                    silosEstadoManual[activeSilo] === 'VACIO_SUCIO'
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Marcar Silo como Vacío Sucio (Luz Roja)"
                >
                  Vacío Sucio
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateSiloEstadoManual(activeSilo, 'VACIO_LIMPIO')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                    silosEstadoManual[activeSilo] === 'VACIO_LIMPIO'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Marcar Silo como Vacío Limpio (Luz Verde)"
                >
                  Vacío Limpio
                </button>
              </div>
            )}

            {/* BOTÓN PROMINENTE: DESCONTAMINACIÓN VARIETAL */}
            <button
              type="button"
              id="btn-descontaminacion-varietal"
              onClick={() => setShowModalDescontaminacion(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-bold text-xs rounded-xl shadow-xs transition active:scale-95 cursor-pointer border border-amber-500/50"
              title="Borra la información cargada en el silo en este momento para permitir una nueva carga inmediata"
            >
              <RotateCcw className="w-4 h-4 text-amber-200" />
              <span>Descontaminación Varietal</span>
            </button>

            {/* Salida Manual de Kilos */}
            <button
              type="button"
              id="btn-salida-manual-silo"
              onClick={() => setShowModalSalidaManual(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition border border-slate-300 cursor-pointer"
            >
              <ArrowDownRight className="w-4 h-4 text-slate-600" />
              <span>Salida Manual</span>
            </button>
          </div>
        </div>

        {/* Resumen del Silo Activo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/70 text-xs">
          <div>
            <span className="text-slate-500 block font-mono text-[10px] uppercase">Stock en Silo</span>
            <strong className="font-mono text-base text-slate-900 font-black">
              {formatKg(activeSiloInfo.stockKg)} kg
            </strong>
          </div>
          <div>
            <span className="text-slate-500 block font-mono text-[10px] uppercase">Cliente Asignado</span>
            <strong className="text-slate-900 font-bold truncate block">
              {activeSiloInfo.cliente || 'Sin asignar'}
            </strong>
          </div>
          <div>
            <span className="text-slate-500 block font-mono text-[10px] uppercase">Variedad / Grano</span>
            <strong className="text-emerald-900 font-bold truncate block">
              {activeSiloInfo.variedad ? `${activeSiloInfo.variedad} (${activeSiloInfo.especie || 'Soja'})` : 'Limpio / Libre'}
            </strong>
          </div>
          <div>
            <span className="text-slate-500 block font-mono text-[10px] uppercase">Humedad Registrada</span>
            <strong className="text-blue-900 font-bold font-mono">
              {activeSiloInfo.humedad ? `${activeSiloInfo.humedad}%` : '—'}
            </strong>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 4. FORMULARIO DE CARGA MANUAL A SILO (KILOS, HUMEDAD, CLIENTE, VARIEDAD) */}
      {/* ===================================================================== */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-md space-y-6">
        <div className="border-b border-slate-200/80 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Ingreso de Granos
              </span>
              <span className="text-[10px] font-mono font-bold text-slate-600">
                Destino: <strong className="text-slate-900">{activeSilo}</strong>
              </span>
            </div>
            <h3 className="font-serif text-xl font-bold text-slate-900 mt-1">
              Carga Manual a {activeSilo}
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Ingrese manualmente los kilos, humedad, seleccione el cliente y la variedad vinculada.
            </p>
            {movimientosSilo.some((m) => m.siloId === activeSilo && (m.tipo === 'INGRESO' || m.tipo === 'INGRESO_MANUAL')) && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => {
                    const ingresos = movimientosSilo
                      .filter((m) => m.siloId === activeSilo && (m.tipo === 'INGRESO' || m.tipo === 'INGRESO_MANUAL'))
                      .slice()
                      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
                    if (ingresos[0]) {
                      setMovimientoAEliminar(ingresos[0]);
                      setFraseConfirmacionEliminar('');
                      setErrorFraseEliminar('');
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold transition cursor-pointer"
                  title="Eliminar último ingreso registrado a este silo"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-600" />
                  <span>Eliminar última carga manual de {activeSilo}</span>
                </button>
              </div>
            )}
          </div>

          {/* Selector Rápido de Silo Destino (Orden 1, 2, 3, 4, 5, 6) */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 overflow-x-auto">
            <span className="text-[10px] font-mono font-bold uppercase text-slate-500 px-1 shrink-0">
              Silo:
            </span>
            {(['Silo 1', 'Silo 2', 'Silo 3', 'Silo 4', 'Silo 5', 'Silo 6'] as SiloId[]).map((sId) => (
              <button
                key={sId}
                type="button"
                id={`btn-selector-silo-ingreso-${sId.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={() => setActiveSilo(sId)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition whitespace-nowrap cursor-pointer ${
                  activeSilo === sId
                    ? 'bg-[#00603C] text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 border border-slate-200/80'
                }`}
              >
                {sId}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmitCargaManual} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* 1. KILOS MANUALES */}
            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-800">
                Carga Manual de Kilos (kg) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="ej: 28000"
                  value={kilosManual}
                  onChange={(e) => setKilosManual(e.target.value)}
                  className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl font-mono text-base font-bold text-slate-900 focus:border-[#00603C] focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
                  required
                />
                <span className="absolute right-3.5 top-3.5 text-xs font-mono font-bold text-slate-500 pointer-events-none">
                  kg
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 px-1">
                <span>Toneladas:</span>
                <strong className="text-emerald-800 font-bold">
                  {kilosManual && !isNaN(Number(kilosManual)) ? (Number(kilosManual) / 1000).toFixed(2) : '0.00'} Tn
                </strong>
              </div>
            </div>

            {/* 2. HUMEDAD DE SILOS */}
            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Droplets className="w-3.5 h-3.5 text-blue-600" />
                Humedad de Silos (%) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="35"
                  step="0.1"
                  placeholder="ej: 12.5"
                  value={humedadManual}
                  onChange={(e) => setHumedadManual(e.target.value)}
                  className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl font-mono text-base font-bold text-slate-900 focus:border-[#00603C] focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
                  required
                />
                <span className="absolute right-3.5 top-3.5 text-xs font-mono font-bold text-slate-500 pointer-events-none">
                  %
                </span>
              </div>
              <p className="text-[10px] text-slate-500 px-1">
                Parámetro de recepción y conservación.
              </p>
            </div>

            {/* 3. CLIENTE (DESPLEGABLE) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-600" />
                Cliente (Desplegable) *
              </label>
              <select
                value={clienteManual}
                onChange={(e) => {
                  setClienteManual(e.target.value);
                  setVariedadManual('');
                }}
                className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl font-sans text-sm font-bold text-slate-900 focus:border-[#00603C] focus:ring-2 focus:ring-emerald-500/20 outline-none transition cursor-pointer"
                required
              >
                <option value="" disabled>Seleccione un Cliente...</option>
                {clientes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500 px-1">
                Filtra automáticamente las variedades disponibles.
              </p>
            </div>

            {/* 4. VARIEDAD (DESPLEGADA, VINCULADA CON CLIENTE SELECCIONADO) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Variedad (Vinculada al Cliente) *
              </label>
              <select
                value={variedadManual}
                onChange={(e) => setVariedadManual(e.target.value)}
                className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl font-sans text-sm font-bold text-slate-900 focus:border-[#00603C] focus:ring-2 focus:ring-emerald-500/20 outline-none transition cursor-pointer"
                required
              >
                <option value="" disabled>Seleccione Variedad...</option>
                {variedadesVinculadas.length > 0 && (
                  <optgroup label={`Variedades de ${clienteManual}`}>
                    {variedadesVinculadas.map((v) => (
                      <option key={`vinc-${v}`} value={v}>
                        {v}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Todas las Variedades de la Planta">
                  {todasLasVariedades
                    .filter((v) => !variedadesVinculadas.includes(v))
                    .map((v) => (
                      <option key={`all-${v}`} value={v}>
                        {v}
                      </option>
                    ))}
                </optgroup>
              </select>
              <div className="flex items-center justify-between text-[10px] text-slate-500 px-1">
                <span>Especie: <strong className="text-slate-800">{especieManual}</strong></span>
                <span className="text-amber-700 font-semibold font-mono">
                  {variedadesVinculadas.length} vinculada(s)
                </span>
              </div>
            </div>
          </div>

          {/* Fila Secundaria: Especie, Fecha y Observaciones */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-[11px] font-mono font-bold uppercase text-slate-600 mb-1">
                Especie
              </label>
              <select
                value={especieManual}
                onChange={(e) => setEspecieManual(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none"
              >
                {especies.map((esp) => (
                  <option key={esp} value={esp}>
                    {esp}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-mono font-bold uppercase text-slate-600 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Fecha de Carga
              </label>
              <input
                type="date"
                value={fechaManual}
                onChange={(e) => setFechaManual(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono font-bold uppercase text-slate-600 mb-1">
                Observaciones / Comprobante (Opcional)
              </label>
              <input
                type="text"
                placeholder="ej: Carta de porte, lote origen o notas..."
                value={observacionesManual}
                onChange={(e) => setObservacionesManual(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-sans text-slate-800 outline-none"
              />
            </div>
          </div>

          {/* Botones de Envío y Descontaminación */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-200">
            <div className="text-xs text-slate-500 font-mono">
              Destino actual: <strong className="text-slate-900 font-bold">{activeSilo}</strong> · Stock resultante estimado:{' '}
              <strong className="text-emerald-800 font-bold">
                {formatKg(activeSiloInfo.stockKg + (Number(kilosManual) || 0))} kg
              </strong>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowModalDescontaminacion(true)}
                className="px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                <span>Descontaminar Silo</span>
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-3 bg-[#00603C] hover:bg-emerald-800 text-white rounded-xl font-bold text-sm transition shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <Plus className="w-4 h-4 text-emerald-200" />
                <span>{isSubmitting ? 'Registrando...' : `Cargar Kilos a ${activeSilo}`}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* ===================================================================== */}
      {/* 5. TABLA CON MOVIMIENTOS HISTÓRICOS DEL SILO                          */}
      {/* ===================================================================== */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-md space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold text-slate-900">
                Tabla de Movimientos Históricos del Silo
              </h3>
              <p className="text-xs text-slate-500">
                Registro cronológico completo de cargas manuales, descontaminaciones y salidas.
              </p>
            </div>
          </div>

          {/* Filtros de la Tabla & Exportación a Excel */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Buscador de Movimientos */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar por cliente, variedad..."
                value={historicoBusqueda}
                onChange={(e) => setHistoricoBusqueda(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-[#00603C] font-sans w-52"
              />
            </div>

            {/* Selector de Silo para Filtrar */}
            <select
              value={historicoFiltroSilo}
              onChange={(e) => setHistoricoFiltroSilo(e.target.value as SiloId | 'TODOS')}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-none font-bold text-slate-800 cursor-pointer"
            >
              <option value="TODOS">Todos los Silos</option>
              {(['Silo 1', 'Silo 2', 'Silo 3', 'Silo 4', 'Silo 5', 'Silo 6'] as SiloId[]).map((sId) => (
                <option key={`flt-${sId}`} value={sId}>
                  {sId}
                </option>
              ))}
            </select>

            {/* Botón Exportar a Excel */}
            <button
              type="button"
              onClick={handleExportarExcelHistorico}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              <span>Exportar Excel</span>
            </button>
          </div>
        </div>

        {/* Tabla de Movimientos */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 uppercase font-mono text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-3.5">Fecha & Hora</th>
                <th className="py-3 px-3.5">Silo</th>
                <th className="py-3 px-3.5">Tipo de Movimiento</th>
                <th className="py-3 px-3.5 text-right">Kilos</th>
                <th className="py-3 px-3.5 text-center">Humedad</th>
                <th className="py-3 px-3.5">Cliente</th>
                <th className="py-3 px-3.5">Variedad / Grano</th>
                <th className="py-3 px-3.5">Responsable</th>
                <th className="py-3 px-3.5">Observaciones</th>
                <th className="py-3 px-3.5 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {movimientosHistoricosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400 italic">
                    No se encontraron movimientos registrados para el filtro aplicado.
                  </td>
                </tr>
              ) : (
                movimientosHistoricosFiltrados.map((m) => {
                  const esIngreso = m.tipo === 'INGRESO';
                  const esDescontaminacion =
                    m.tipo === 'AJUSTE_ZERO' ||
                    (m.tipo === 'EGRESO_MANUAL' && m.descontaminacionVarietal) ||
                    m.motivoManual === 'Descontaminación varietal' ||
                    (m.observaciones || '').toLowerCase().includes('descontaminaci');

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition">
                      {/* Fecha y Hora */}
                      <td className="py-3 px-3.5 font-mono text-slate-700 whitespace-nowrap">
                        <span className="font-bold">{m.fecha}</span>
                        {m.hora && <span className="block text-[10px] text-slate-500 font-normal">{m.hora} hs</span>}
                      </td>

                      {/* Silo */}
                      <td className="py-3 px-3.5 font-serif font-black text-slate-900 whitespace-nowrap">
                        <span className="px-2 py-0.5 bg-slate-100 rounded-md border border-slate-300">
                          {m.siloId}
                        </span>
                      </td>

                      {/* Tipo de Movimiento con Badge */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {esDescontaminacion ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-100 text-amber-950 font-black text-[10px] rounded-full border border-amber-300">
                            <RotateCcw className="w-3 h-3 text-amber-700" />
                            Descontaminación Varietal
                          </span>
                        ) : esIngreso ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-100 text-emerald-950 font-black text-[10px] rounded-full border border-emerald-300">
                            <ArrowUpRight className="w-3 h-3 text-emerald-700" />
                            Carga Manual
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-slate-100 text-slate-800 font-bold text-[10px] rounded-full border border-slate-300">
                            <ArrowDownRight className="w-3 h-3 text-slate-600" />
                            {m.tipo === 'EGRESO_OP' ? 'Egreso OP' : 'Salida Manual'}
                          </span>
                        )}
                      </td>

                      {/* Kilos (+ verde / - rojo) */}
                      <td className="py-3 px-3.5 text-right font-mono font-bold whitespace-nowrap">
                        <span className={esIngreso ? 'text-emerald-700' : 'text-amber-700'}>
                          {esIngreso ? `+${formatKg(m.kg)}` : `-${formatKg(m.kg)}`} kg
                        </span>
                        <span className="block text-[10px] text-slate-500 font-normal">
                          {(m.kg / 1000).toFixed(1)} Tn
                        </span>
                      </td>

                      {/* Humedad */}
                      <td className="py-3 px-3.5 text-center font-mono whitespace-nowrap">
                        {m.humedad !== undefined ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-900 border border-blue-200 rounded font-bold text-[10px]">
                            <Droplets className="w-2.5 h-2.5 text-blue-600" />
                            {m.humedad}%
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Cliente */}
                      <td className="py-3 px-3.5 font-bold text-slate-900">
                        {m.cliente || <span className="text-slate-400 font-normal italic">—</span>}
                      </td>

                      {/* Variedad / Grano */}
                      <td className="py-3 px-3.5 font-medium text-slate-800">
                        {m.variedad ? (
                          <span>
                            <strong className="text-emerald-950 font-bold">{m.variedad}</strong>{' '}
                            <span className="text-[10px] text-slate-500">({m.especie || 'Soja'})</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">—</span>
                        )}
                      </td>

                      {/* Responsable */}
                      <td className="py-3 px-3.5 text-slate-600 font-sans whitespace-nowrap">
                        {m.usuario || 'Operador'}
                      </td>

                      {/* Observaciones */}
                      <td className="py-3 px-3.5 text-slate-500 max-w-xs truncate text-[11px]">
                        {m.observaciones || m.motivoManual || m.motivoZero || '—'}
                      </td>

                      {/* Acciones */}
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        {onEliminarMovimientoSilo && (
                          <button
                            type="button"
                            onClick={() => {
                              setMovimientoAEliminar(m);
                              setFraseConfirmacionEliminar('');
                              setErrorFraseEliminar('');
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition cursor-pointer"
                            title="Eliminar carga de silo (requiere confirmación de frase)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODAL: CONFIRMAR DESCONTAMINACIÓN VARIETAL                             */}
      {/* ===================================================================== */}
      {showModalDescontaminacion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            {/* Header Modal */}
            <div className="bg-gradient-to-r from-amber-600 to-amber-800 text-white px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/15 rounded-xl text-amber-200">
                  <RotateCcw className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold">
                    Descontaminación Varietal: {activeSilo}
                  </h3>
                  <p className="text-xs text-amber-100">
                    Limpieza del silo para habilitar una nueva carga
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModalDescontaminacion(false)}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cuerpo del Modal */}
            <div className="p-6 space-y-4 text-xs text-slate-700">
              <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>¿Confirmar Descontaminación Varietal de {activeSilo}?</span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Esta acción dejará el stock del silo en <strong className="text-slate-900">0 kg</strong>,
                  borrará los datos de cliente, variedad y humedad asignados en este momento, y registrará
                  la descontaminación en el historial para que pueda cargarse un nuevo dato inmediatamente.
                </p>
              </div>

              {/* Datos Actuales del Silo */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Stock actual que se vacía:</span>
                  <strong className="text-slate-900">{formatKg(activeSiloInfo.stockKg)} kg ({activeSiloInfo.stockTn} Tn)</strong>
                </div>
                <div className="flex justify-between font-sans">
                  <span className="text-slate-500">Cliente actual:</span>
                  <strong className="text-slate-900">{activeSiloInfo.cliente || 'Sin cliente'}</strong>
                </div>
                <div className="flex justify-between font-sans">
                  <span className="text-slate-500">Variedad actual:</span>
                  <strong className="text-slate-900">{activeSiloInfo.variedad || 'Sin variedad'}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Nuevo estado físico del silo:</span>
                  <span className="text-emerald-700 font-bold">VACÍO LIMPIO (Luz Verde)</span>
                </div>
              </div>

              {/* Botones de Confirmación */}
              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModalDescontaminacion(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmarDescontaminacion}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition shadow-sm flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirmar y Dejar Libre</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: SALIDA MANUAL DE KILOS                                         */}
      {/* ===================================================================== */}
      {showModalSalidaManual && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ArrowDownRight className="w-5 h-5 text-amber-300" />
                <h3 className="font-serif font-bold text-base">
                  Salida Manual de Kilos: {activeSilo}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModalSalidaManual(false)}
                className="p-1.5 text-white/80 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegistrarSalidaSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Cantidad de Kilos a Descontar (kg) *
                </label>
                <input
                  type="number"
                  min="1"
                  max={activeSiloInfo.stockKg}
                  placeholder={`Máximo: ${activeSiloInfo.stockKg} kg`}
                  value={kgSalidaManual}
                  onChange={(e) => setKgSalidaManual(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-sm font-bold text-slate-900 outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Motivo de Salida *
                </label>
                <select
                  value={motivoSalidaManual}
                  onChange={(e) => setMotivoSalidaManual(e.target.value as MotivoSalidaManual)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none"
                  required
                >
                  <option value="Consumo a granel">Consumo a granel</option>
                  <option value="Manipulación">Manipulación</option>
                  <option value="Traslado a silo">Traslado a silo</option>
                  <option value="Descarte">Descarte</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Observaciones
                </label>
                <input
                  type="text"
                  placeholder="Detalles del destino..."
                  value={observacionesSalidaManual}
                  onChange={(e) => setObservacionesSalidaManual(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModalSalidaManual(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Registrar Salida
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: CONFIRMACIÓN DE FRASE PARA ELIMINAR CARGA MANUAL DE SILO       */}
      {/* ===================================================================== */}
      {movimientoAEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-red-700 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-200" />
                <h3 className="font-serif font-bold text-base">Eliminar Carga de Silo</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMovimientoAEliminar(null);
                  setFraseConfirmacionEliminar('');
                  setErrorFraseEliminar('');
                }}
                className="p-1.5 text-white/80 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="bg-red-50 border border-red-200 rounded-2xl p-3.5 text-red-900 space-y-1">
                <div className="flex items-center gap-2 font-bold text-red-800">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>Advertencia de Eliminación</span>
                </div>
                <p className="text-[11px] text-red-700 leading-relaxed">
                  Esta acción eliminará de forma irreversible el ingreso registrado y recalculará automáticamente el saldo de stock del silo.
                </p>
              </div>

              {/* Ficha de datos del ingreso a eliminar */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Silo Destino:</span>
                  <span className="font-bold text-slate-900 px-2 py-0.5 bg-white border border-slate-200 rounded font-mono">
                    {movimientoAEliminar.siloId}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Kilos Cargados:</span>
                  <span className="font-black text-red-700 text-sm font-mono">
                    +{formatKg(movimientoAEliminar.kg)} kg ({(movimientoAEliminar.kg / 1000).toFixed(1)} Tn)
                  </span>
                </div>
                {movimientoAEliminar.variedad && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">Variedad:</span>
                    <span className="font-bold text-slate-900">
                      {movimientoAEliminar.variedad} {movimientoAEliminar.especie ? `(${movimientoAEliminar.especie})` : ''}
                    </span>
                  </div>
                )}
                {movimientoAEliminar.cliente && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">Cliente:</span>
                    <span className="font-bold text-slate-900 truncate max-w-[200px]">
                      {movimientoAEliminar.cliente}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500 font-medium">Fecha:</span>
                  <span className="text-slate-700 font-mono">
                    {movimientoAEliminar.fecha} {movimientoAEliminar.hora || ''}
                  </span>
                </div>
                {movimientoAEliminar.observaciones && (
                  <div className="pt-1 border-t border-slate-200/80 text-[11px] text-slate-600">
                    <span className="font-medium text-slate-500">Obs: </span>
                    {movimientoAEliminar.observaciones}
                  </div>
                )}
              </div>

              {/* Confirmación por frase */}
              <div className="space-y-2 pt-1">
                <label className="block text-slate-700 font-bold text-xs">
                  Para confirmar la eliminación del ingreso, escriba la frase a continuación:
                </label>
                <div className="text-center py-1">
                  <span className="inline-block px-3 py-1 bg-red-100 border border-red-300 rounded-lg font-mono font-black text-xs text-red-900 tracking-wider select-all">
                    ELIMINAR INGRESO
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="Escriba aquí: ELIMINAR INGRESO"
                  value={fraseConfirmacionEliminar}
                  onChange={(e) => {
                    setFraseConfirmacionEliminar(e.target.value);
                    setErrorFraseEliminar('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && fraseConfirmacionEliminar.trim().toUpperCase() === 'ELIMINAR INGRESO') {
                      e.preventDefault();
                      handleConfirmarEliminarMovimiento();
                    }
                  }}
                  className="w-full px-3 py-2.5 border-2 border-slate-300 rounded-xl text-xs font-mono font-bold uppercase outline-none focus:border-red-600 tracking-wider placeholder:normal-case placeholder:font-normal placeholder:tracking-normal"
                  autoFocus
                />
                {errorFraseEliminar && (
                  <p className="text-red-600 font-bold text-[11px] flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{errorFraseEliminar}</span>
                  </p>
                )}
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setMovimientoAEliminar(null);
                    setFraseConfirmacionEliminar('');
                    setErrorFraseEliminar('');
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmarEliminarMovimiento}
                  disabled={fraseConfirmacionEliminar.trim().toUpperCase() !== 'ELIMINAR INGRESO'}
                  className="px-5 py-2 bg-red-700 hover:bg-red-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-xs cursor-pointer transition flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar Ingreso</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODALES EXTERNOS: FICHA TÉCNICA, GRILLA 6 SILOS Y PLANILLA EXCEL      */}
      {/* ===================================================================== */}
      {fichaModalSilo && (
        <FichaTecnicaSiloModal
          siloId={fichaModalSilo}
          fichas={fichasSeisSilos}
          onClose={() => setFichaModalSilo(null)}
        />
      )}

      {showGrillaSeisSilos && (
        <GrillaSeisSilosModal
          fichas={fichasSeisSilos}
          onClose={() => setShowGrillaSeisSilos(false)}
        />
      )}

      {showPlanillaExcelModal && (
        <ReportePlanillaExcelSilosModal
          movimientosSilo={movimientosSilo}
          silosEstadoManual={silosEstadoManual}
          currentUser={currentUser}
          onClose={() => setShowPlanillaExcelModal(false)}
        />
      )}
    </div>
  );
};
