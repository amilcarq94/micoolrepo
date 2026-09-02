/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { SiloId, MovimientoSilo, EspecieType, CategoriaType, CAPACIDAD_MAX_SILO, UMBRAL_ALERTA_SILO, Chofer, MotivoSalidaManual, BolsonCampo, SILOS_PHYSICAL_ORDER, EstadoSiloManual, SilosEstadoMap, SILOS_ESTADO_DEFAULT, CATEGORIAS_OFICIALES, SECTORES_BOLSON_OPCIONES, PlantaConfig } from '../types';
import { SILOS_DISPONIBLES } from './SilosSelector';
import { ChoferSearchSelector } from './ChoferSearchSelector';
import { findExistingChofer, mergeChoferData } from '../utils/choferes';
import { getSiloDetailedInfo, getSiloActiveData, validateSiloIngresoMatch } from '../utils/siloValidation';
import { formatKg } from '../utils/formatters';
import { SiloIcon, LogoSiloLoose } from './Logo';
import { Warehouse, Plus, RotateCcw, History, FileText, Calendar, ArrowUpRight, ArrowDownRight, AlertTriangle, User, CheckCircle2, Search, Filter, ShieldAlert, MapPin, Droplets, Eye, Download, X, FileSpreadsheet, Lock, KeyRound, ShieldCheck, BarChart3, Trash2, QrCode, Truck, Upload, Edit, CreditCard, Building2, Scale, Layers, Grid3X3, Ban } from 'lucide-react';
import { ClienteSelect } from './ClienteSelect';
import { IngresoSiloBloqueCard, IngresoBloqueItem, createDefaultIngresoBloque } from './IngresoSiloBloqueCard';
import { FichaTecnicaSiloModal } from './FichaTecnicaSiloModal';
import { GrillaSeisSilosModal } from './GrillaSeisSilosModal';
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
  ReferenceLine,
  LabelList
} from 'recharts';

// Componente para Tooltip Personalizado del Gráfico Recharts de Silos
const CustomTooltipSilosChart = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 border border-slate-700 text-white text-xs p-3.5 rounded-xl shadow-xl space-y-2.5 min-w-[210px] z-50">
        <div className="flex items-center justify-between border-b border-slate-700 pb-2">
          <div className="flex items-center gap-1.5">
            <Warehouse className="w-4 h-4 text-emerald-400" />
            <span className="font-serif font-black text-white text-sm">{data.siloId}</span>
          </div>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-extrabold border ${
            data.porcentaje >= 100
              ? 'bg-red-950/80 text-red-300 border-red-700'
              : data.porcentaje >= 83.3
              ? 'bg-amber-950/80 text-amber-300 border-amber-700'
              : 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
          }`}>
            {data.porcentaje}% Lleno
          </span>
        </div>

        <div className="space-y-1 text-[11px]">
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Stock Acumulado:</span>
            <strong className="font-mono text-emerald-300 font-bold">
              {data.stockTn} Tn ({data.stockKg.toLocaleString('es-AR')} kg)
            </strong>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-slate-400">Capacidad Máxima:</span>
            <span className="font-mono text-slate-200 font-semibold">{data.capacidadTn} Tn</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-slate-400">Espacio Disponible:</span>
            <span className="font-mono text-blue-300 font-bold">{data.disponibleTn} Tn</span>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800 text-[11px] space-y-0.5">
          <div className="text-slate-400">
            Contenido: <strong className="text-slate-100">{data.especie}</strong> ({data.variedad})
          </div>
          {data.cliente && data.cliente !== 'Sin asignación' && (
            <div className="text-slate-400">
              Cliente: <strong className="text-slate-200">{data.cliente}</strong>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

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
  onRegistrarIngreso: (movimiento: MovimientoSilo) => void;
  onRegistrarIngresosMultiple?: (movimientos: MovimientoSilo[]) => void;
  onRegistrarSalidaManual?: (movimiento: MovimientoSilo) => void;
  onSaveChofer?: (chofer: Chofer) => void;
  onImportChoferes?: (choferes: Chofer[]) => void;
  onPonerEnCero?: (siloId: SiloId, fecha: string, usuario: string, motivo: string, kgAnterior: number) => void;
  onPonerSiloEnCero?: (siloId: SiloId, fecha: string, usuario: string, motivo: string, kgAnterior: number) => void;
  onEditarMovimientoSilo?: (movimiento: MovimientoSilo) => void;
  onEliminarMovimientoSilo?: (movimientoId: string, siloId: SiloId) => void;
}

export const IngresoSilosView: React.FC<IngresoSilosViewProps> = ({
  movimientosSilo,
  clientes,
  especies,
  plantaConfig,
  currentUser,
  choferes = [],
  bolsones = [],
  silosEstadoManual: silosEstadoManualProp,
  onUpdateSiloEstadoManual,
  onRegistrarIngreso,
  onRegistrarIngresosMultiple,
  onRegistrarSalidaManual,
  onSaveChofer,
  onImportChoferes,
  onPonerEnCero,
  onPonerSiloEnCero,
  onEditarMovimientoSilo,
  onEliminarMovimientoSilo,
}) => {
  // Silo activo seleccionado (Silo 1 a Silo 6)
  const [activeSilo, setActiveSilo] = useState<SiloId>('Silo 1');

  // Estado manual de Silos con 3 opciones: Ocupado (Amarillo), Vacío Sucio (Rojo), Vacío Limpio (Verde)
  const [localSilosEstadoManual, setLocalSilosEstadoManual] = useState<SilosEstadoMap>(() => {
    try {
      const saved = localStorage.getItem('agro_abacus_silos_estado_manual');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return SILOS_ESTADO_DEFAULT;
  });

  const silosEstadoManual = silosEstadoManualProp || localSilosEstadoManual;

  const handleSetEstadoManual = (siloId: SiloId, estado: EstadoSiloManual) => {
    if (onUpdateSiloEstadoManual) {
      onUpdateSiloEstadoManual(siloId, estado);
    }
    setLocalSilosEstadoManual((prev) => {
      const next = { ...prev, [siloId]: estado };
      try {
        localStorage.setItem('agro_abacus_silos_estado_manual', JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };

  // Obtener el último evento de "Stock en Cero" para un silo si existe
  const getUltimoAjusteCero = (siloId: SiloId): MovimientoSilo | null => {
    const movsAsc = (movimientosSilo || [])
      .filter((m) => m.siloId === siloId)
      .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '') || (a.id || '').localeCompare(b.id || ''));

    for (let i = movsAsc.length - 1; i >= 0; i--) {
      if (movsAsc[i].tipo === 'AJUSTE_ZERO') {
        return movsAsc[i];
      }
    }
    return null;
  };

  // Calcular Stock actual para cada silo (Neto: Ingresos − Egresos desde el último evento "Stock en Cero")
  const getStockSilo = (siloId: SiloId): number => {
    const movsAsc = (movimientosSilo || [])
      .filter((m) => m.siloId === siloId)
      .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '') || (a.id || '').localeCompare(b.id || ''));

    let lastZeroIndex = -1;
    for (let i = movsAsc.length - 1; i >= 0; i--) {
      if (movsAsc[i].tipo === 'AJUSTE_ZERO') {
        lastZeroIndex = i;
        break;
      }
    }

    const movsDesdeZero = lastZeroIndex >= 0 ? movsAsc.slice(lastZeroIndex + 1) : movsAsc;

    let stock = 0;
    movsDesdeZero.forEach((m) => {
      if (m.tipo === 'INGRESO') {
        stock += m.kg;
      } else if (m.tipo === 'EGRESO_OP' || (m.tipo as string).startsWith('EGRESO')) {
        stock = Math.max(0, stock - m.kg);
      }
    });

    return stock;
  };

  // Estado dinámico encadenado de Bloques de Ingreso a Silo
  const [bloques, setBloques] = useState<IngresoBloqueItem[]>(() => [
    createDefaultIngresoBloque('Silo 1', clientes[0] || 'San Diego Semilla', especies[0] || 'Soja')
  ]);

  // Mapa de stocks en tiempo real por cada uno de los 6 silos
  const silosStocksMap = React.useMemo<Record<SiloId, number>>(() => {
    const map: Record<SiloId, number> = {
      'Silo 1': 0,
      'Silo 2': 0,
      'Silo 3': 0,
      'Silo 4': 0,
      'Silo 5': 0,
      'Silo 6': 0,
    };
    (['Silo 1', 'Silo 2', 'Silo 3', 'Silo 4', 'Silo 5', 'Silo 6'] as SiloId[]).forEach((sId) => {
      map[sId] = getStockSilo(sId);
    });
    return map;
  }, [movimientosSilo]);

  const handleAddBloqueAfter = (index: number) => {
    const current = bloques[index];
    const newBloque: IngresoBloqueItem = {
      ...createDefaultIngresoBloque(current.siloId, current.cliente, current.especie),
      fecha: current.fecha,
      variedad: current.variedad,
      categoria: current.categoria,
      campoOrigenSelect: current.campoOrigenSelect,
      campoOrigenManual: current.campoOrigenManual,
      depositoOrigen: current.depositoOrigen,
      modalidadTransporte: current.modalidadTransporte,
      subTipoTerceros: current.subTipoTerceros,
      fleteOpcion: current.fleteOpcion,
    };
    const newBloques = [...bloques];
    newBloques.splice(index + 1, 0, newBloque);
    setBloques(newBloques);
    setFormError('');
  };

  const handleRemoveBloque = (index: number) => {
    if (bloques.length <= 1) return;
    const newBloques = bloques.filter((_, i) => i !== index);
    setBloques(newBloques);
    setFormError('');
  };

  const handleUpdateBloque = (index: number, updated: IngresoBloqueItem) => {
    const newBloques = [...bloques];
    newBloques[index] = updated;
    setBloques(newBloques);
  };

  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [siloContaminado, setSiloContaminado] = useState(false);
  const [exportNoticeMsg, setExportNoticeMsg] = useState('');

  // Estado para el Modal de Ficha Técnica de Silo y Grilla de 6 Silos
  const [fichaModalSilo, setFichaModalSilo] = useState<SiloId | null>(null);
  const [showGrillaSeisSilos, setShowGrillaSeisSilos] = useState(false);

  const openFichaModal = (siloId: SiloId) => {
    setFichaModalSilo(siloId);
  };

  // Estado para el Modal de Salidas Manuales de Silo
  const [showModalSalidaManual, setShowModalSalidaManual] = useState(false);
  const [siloSalidaManual, setSiloSalidaManual] = useState<SiloId>('Silo 1');
  const [fechaSalidaManual, setFechaSalidaManual] = useState(() => new Date().toISOString().split('T')[0]);
  const [horaSalidaManual, setHoraSalidaManual] = useState(() => new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }) || new Date().toTimeString().slice(0, 5));
  const [kgSalidaManual, setKgSalidaManual] = useState<number | ''>('');
  const [motivoSalidaManual, setMotivoSalidaManual] = useState<MotivoSalidaManual>('Consumo a granel');
  const [descontaminacionVarietal, setDescontaminacionVarietal] = useState(false);
  const [observacionesSalidaManual, setObservacionesSalidaManual] = useState('');
  const [errorSalidaManual, setErrorSalidaManual] = useState('');

  const openModalSalidaManual = (siloId?: SiloId, isDescontaminacion: boolean = false) => {
    const selectedSilo = siloId || activeSilo;
    setSiloSalidaManual(selectedSilo);
    setActiveSilo(selectedSilo);
    setFechaSalidaManual(new Date().toISOString().split('T')[0]);
    setHoraSalidaManual(new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }) || new Date().toTimeString().slice(0, 5));
    
    const stockActual = getStockSilo(selectedSilo);
    if (isDescontaminacion) {
      setMotivoSalidaManual('Descarte');
      setDescontaminacionVarietal(true);
      setKgSalidaManual(stockActual > 0 ? stockActual : '');
    } else {
      setMotivoSalidaManual('Consumo a granel');
      setDescontaminacionVarietal(false);
      setKgSalidaManual('');
    }
    setObservacionesSalidaManual('');
    setErrorSalidaManual('');
    setShowModalSalidaManual(true);
  };

  // Modal para importar Choferes desde Excel
  const [showModalImportChoferes, setShowModalImportChoferes] = useState(false);
  const [importNoticeChoferes, setImportNoticeChoferes] = useState('');

  // Exportar Excel Completo de Movimientos de Silo
  const handleExportMovimientosExcel = () => {
    const dataToExport = (movimientosSilo || []).map((m) => {
      const isFlete = m.tipoTransporte === 'FLETE' || m.chofer === 'Flete Montaner' || m.chofer === 'Flete Agro Abacus';
      const choferDisplay = isFlete ? (m.chofer || m.transporte || 'Flete Montaner') : (m.chofer || '-');
      const cuitDisplay = isFlete ? '-' : (m.cuit || '-');
      const patentesDisplay = isFlete ? '-' : (m.patentes || '-');
      const transporteDisplay = isFlete ? (m.transporte || m.chofer || 'Flete Montaner') : (m.transporte || '-');

      const choferObj = (choferes || []).find(
        (c) => (c.nombre && m.chofer && c.nombre.trim().toLowerCase() === m.chofer.trim().toLowerCase()) ||
               (c.cuit && m.cuit && c.cuit.trim() === m.cuit.trim())
      );

      const taraVal = m.tara !== undefined ? m.tara : (choferObj?.tara !== undefined ? choferObj.tara : 0);
      const kilosIngresados = m.kg || 0;
      const brutoVal = m.bruto !== undefined ? m.bruto : (taraVal + kilosIngresados);

      return {
        'Silo': m.siloId,
        'Fecha': m.fecha,
        'Cliente': m.cliente || '-',
        'Especie': m.especie || '-',
        'Variedad': m.variedad || '-',
        'Chofer': choferDisplay,
        'CUIT': cuitDisplay,
        'Patentes': patentesDisplay,
        'Transporte': transporteDisplay,
        'Bruto': brutoVal,
        'Tara': taraVal,
        'Total de Kilos Ingresados': kilosIngresados,
        'N° Bolsón Origen': m.bolsonOrigenNro || '-',
        'Origen': m.campoOrigen || m.depositoOrigen || '-',
        'Sector': m.bolsonOrigenSector || m.sector || '-',
        'Humedad': m.humedad !== undefined ? `${m.humedad}%` : '-',
        'Tipo Movimiento': m.tipo === 'INGRESO' ? 'Ingreso' : m.tipo === 'EGRESO_MANUAL' ? `Salida Manual (${m.motivoManual || 'Manual'})` : m.tipo === 'EGRESO_LOTE' ? `Salida por Lote (${m.loteNro || ''})` : 'Egreso',
        'Descarte / Limpieza': m.descontaminacionVarietal || m.motivoManual === 'Descarte' || m.motivoManual === 'Descontaminación varietal' ? 'Sí' : 'No',
        'Observaciones': m.observaciones || m.motivoZero || m.motivoAjuste || '-'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Ingresos_y_Egresos');
    XLSX.writeFile(workbook, `Ingresos_y_Egresos_Silos_${new Date().toISOString().split('T')[0]}.xlsx`);

    setExportNoticeMsg('¡Reporte completo de Ingresos y Egresos de Silos exportado a Excel!');
    setTimeout(() => setExportNoticeMsg(''), 4000);
  };

  // Estado para el Panel Lateral (Drawer) de Historial de Movimientos del Silo
  const [drawerSilo, setDrawerSilo] = useState<SiloId | null>(null);
  const [drawerFilterTipo, setDrawerFilterTipo] = useState<'TODOS' | 'INGRESO' | 'EGRESO_OP' | 'AJUSTE_ZERO'>('TODOS');
  const [drawerSearch, setDrawerSearch] = useState('');

  // Estado para el Modal de Eliminación de Movimientos (requiere Amilcar Quiroz)
  const [movimientoAEliminar, setMovimientoAEliminar] = useState<MovimientoSilo | null>(null);
  const [usuarioEliminar, setUsuarioEliminar] = useState('Amilcar Quiroz');
  const [claveEliminar, setClaveEliminar] = useState('');
  const [errorEliminar, setErrorEliminar] = useState('');

  // Estado para el Modal de Edición Manual de Movimientos de Silos
  const [movimientoAEditar, setMovimientoAEditar] = useState<MovimientoSilo | null>(null);
  const [editTipoCategoria, setEditTipoCategoria] = useState<'INGRESO' | 'EGRESO'>('INGRESO');
  const [editMotivoEgreso, setEditMotivoEgreso] = useState<'EGRESO_LOTE' | 'DESCARTE'>('EGRESO_LOTE');
  const [editSiloId, setEditSiloId] = useState<SiloId>('Silo 1');
  const [editFecha, setEditFecha] = useState('');
  const [editHora, setEditHora] = useState('');
  const [editKg, setEditKg] = useState<number | ''>('');
  const [editCliente, setEditCliente] = useState('');
  const [editEspecie, setEditEspecie] = useState('');
  const [editVariedad, setEditVariedad] = useState('');
  const [editCategoria, setEditCategoria] = useState('');
  const [editHumedad, setEditHumedad] = useState<number | ''>('');
  const [editCampoOrigen, setEditCampoOrigen] = useState('');
  const [editBolsonOrigenNro, setEditBolsonOrigenNro] = useState('');
  const [editBolsonOrigenSector, setEditBolsonOrigenSector] = useState('');
  const [editDepositoOrigen, setEditDepositoOrigen] = useState('');
  const [editChofer, setEditChofer] = useState('');
  const [editCuit, setEditCuit] = useState('');
  const [editPatentes, setEditPatentes] = useState('');
  const [editTransporte, setEditTransporte] = useState('');
  const [editMotivoManual, setEditMotivoManual] = useState('');
  const [editDescontaminacionVarietal, setEditDescontaminacionVarietal] = useState(false);
  const [editNumeroOrdenProceso, setEditNumeroOrdenProceso] = useState('');
  const [editLoteNro, setEditLoteNro] = useState('');
  const [editObservaciones, setEditObservaciones] = useState('');

  const handleAbrirEditarMovimiento = (mov: MovimientoSilo) => {
    setMovimientoAEditar(mov);
    setEditSiloId(mov.siloId);
    setEditFecha(mov.fecha);
    setEditHora(mov.hora || '12:00');

    const isIng = mov.tipo === 'INGRESO';
    setEditTipoCategoria(isIng ? 'INGRESO' : 'EGRESO');

    const isDescarte = mov.tipo === 'AJUSTE_ZERO' || mov.motivoManual === 'Descarte' || Boolean(mov.descontaminacionVarietal);
    setEditMotivoEgreso(isDescarte ? 'DESCARTE' : 'EGRESO_LOTE');

    setEditKg(mov.kg);
    setEditCliente(mov.cliente || '');
    setEditEspecie(mov.especie || '');
    setEditVariedad(mov.variedad || '');
    setEditCategoria(mov.categoria || '');
    setEditHumedad(mov.humedad !== undefined ? mov.humedad : '');
    setEditCampoOrigen(mov.campoOrigen || '');
    setEditBolsonOrigenNro(mov.bolsonOrigenNro || '');
    setEditBolsonOrigenSector(mov.bolsonOrigenSector || '');
    setEditDepositoOrigen(mov.depositoOrigen || '');
    setEditChofer(mov.chofer || '');
    setEditCuit(mov.cuit || '');
    setEditPatentes(mov.patentes || '');
    setEditTransporte(mov.transporte || '');
    setEditMotivoManual(mov.motivoManual || '');
    setEditDescontaminacionVarietal(Boolean(mov.descontaminacionVarietal));
    setEditNumeroOrdenProceso(mov.numeroOrdenProceso || mov.ordenProcesoId || '');
    setEditLoteNro(mov.loteNro || mov.loteId || '');
    setEditObservaciones(mov.observaciones || mov.motivoZero || mov.motivoAjuste || '');
  };

  const handleGuardarEdicionMovimiento = (e: React.FormEvent) => {
    e.preventDefault();
    if (!movimientoAEditar) return;

    if (editTipoCategoria === 'INGRESO') {
      if (!editKg || Number(editKg) <= 0) {
        alert('Los kilogramos del ingreso deben ser mayor a 0.');
        return;
      }

      const movEditado: MovimientoSilo = {
        ...movimientoAEditar,
        siloId: editSiloId,
        fecha: editFecha,
        hora: editHora.trim() || undefined,
        tipo: 'INGRESO',
        kg: Number(editKg),
        cliente: editCliente,
        especie: editEspecie,
        variedad: editVariedad,
        categoria: editCategoria,
        humedad: editHumedad !== '' ? Number(editHumedad) : undefined,
        campoOrigen: editCampoOrigen,
        bolsonOrigenNro: editBolsonOrigenNro,
        bolsonOrigenSector: editBolsonOrigenSector,
        depositoOrigen: editDepositoOrigen,
        chofer: editChofer,
        cuit: editCuit,
        patentes: editPatentes,
        transporte: editTransporte,
        numeroOrdenProceso: editNumeroOrdenProceso,
        ordenProcesoId: editNumeroOrdenProceso || movimientoAEditar.ordenProcesoId,
        observaciones: editObservaciones,
      };

      if (onEditarMovimientoSilo) {
        onEditarMovimientoSilo(movEditado);
      }
      setMovimientoAEditar(null);
      setFormSuccess(`Ingreso ${movEditado.id} actualizado correctamente.`);
      setTimeout(() => setFormSuccess(''), 4000);
    } else {
      // CASO EGRESO
      if (editMotivoEgreso === 'EGRESO_LOTE') {
        if (!editLoteNro.trim()) {
          alert('Debe ingresar el N° de Lote para la Salida por Lote.');
          return;
        }
        if (!editKg || Number(editKg) <= 0) {
          alert('Debe ingresar los kilos descontados por el lote (debe ser mayor a 0).');
          return;
        }

        const movEditado: MovimientoSilo = {
          ...movimientoAEditar,
          siloId: editSiloId,
          fecha: editFecha,
          hora: editHora.trim() || undefined,
          tipo: 'EGRESO_LOTE',
          kg: Number(editKg),
          loteNro: editLoteNro.trim(),
          loteId: editLoteNro.trim(),
          motivoManual: 'Egreso por lote',
          numeroOrdenProceso: editNumeroOrdenProceso,
          ordenProcesoId: editNumeroOrdenProceso || movimientoAEditar.ordenProcesoId,
          observaciones: editObservaciones,
        };

        if (onEditarMovimientoSilo) {
          onEditarMovimientoSilo(movEditado);
        }
        setMovimientoAEditar(null);
        setFormSuccess(`Egreso por Lote ${movEditado.id} actualizado correctamente.`);
        setTimeout(() => setFormSuccess(''), 4000);
      } else {
        // DESCARTE: Lleva el stock remanente de ese silo a cero
        const stockRemanente = getSiloActiveData(editSiloId, movimientosSilo).stockKg;
        const kgDescarte = editKg && Number(editKg) > 0 ? Number(editKg) : (stockRemanente > 0 ? stockRemanente : (movimientoAEditar.kg || 0));

        const movEditado: MovimientoSilo = {
          ...movimientoAEditar,
          siloId: editSiloId,
          fecha: editFecha,
          hora: editHora.trim() || undefined,
          tipo: 'AJUSTE_ZERO',
          kg: kgDescarte,
          motivoManual: 'Descarte',
          motivoZero: 'Descarte',
          descontaminacionVarietal: true,
          numeroOrdenProceso: editNumeroOrdenProceso,
          ordenProcesoId: editNumeroOrdenProceso || movimientoAEditar.ordenProcesoId,
          observaciones: editObservaciones,
        };

        if (onEditarMovimientoSilo) {
          onEditarMovimientoSilo(movEditado);
        }
        setMovimientoAEditar(null);
        setFormSuccess(`Descarte de ${editSiloId} guardado correctamente (Stock llevado a cero).`);
        setTimeout(() => setFormSuccess(''), 4000);
      }
    }
  };

  const handleConfirmEliminarMovimiento = () => {
    setErrorEliminar('');
    if (!claveEliminar.trim()) {
      setErrorEliminar('Debe ingresar la clave de autorización.');
      return;
    }
    const isAuth = verifyAutorizadorPassword(usuarioEliminar, claveEliminar);
    if (!isAuth) {
      setErrorEliminar('Clave incorrecta o usuario no autorizado para eliminar movimientos.');
      return;
    }
    if (movimientoAEliminar) {
      if (onEliminarMovimientoSilo) {
        onEliminarMovimientoSilo(movimientoAEliminar.id, movimientoAEliminar.siloId);
      }
      setFormSuccess(`Movimiento de ${movimientoAEliminar.siloId} (${movimientoAEliminar.tipo}) eliminado con éxito.`);
      setMovimientoAEliminar(null);
      setClaveEliminar('');
    }
  };

  // Estado para el Modal de Limpieza Varietal de Silo
  const [siloLimpiezaTarget, setSiloLimpiezaTarget] = useState<SiloId | null>(null);
  const [limpiezaFecha, setLimpiezaFecha] = useState(() => new Date().toISOString().split('T')[0]);
  const [limpiezaUsuario, setLimpiezaUsuario] = useState(currentUser?.nombre || 'Amilcar Quiroz');
  const [limpiezaMotivo, setLimpiezaMotivo] = useState('Limpieza Varietal - Descontaminación de Silo');
  const [limpiezaError, setLimpiezaError] = useState('');

  const openModalLimpiezaVarietal = (siloId: SiloId) => {
    setSiloLimpiezaTarget(siloId);
    setLimpiezaFecha(new Date().toISOString().split('T')[0]);
    setLimpiezaUsuario(currentUser?.nombre || 'Amilcar Quiroz');
    setLimpiezaMotivo('Limpieza Varietal - Descontaminación de Silo');
    setLimpiezaError('');
  };

  const handleConfirmLimpiezaVarietal = async () => {
    if (!siloLimpiezaTarget) return;
    setLimpiezaError('');

    const targetFicha = getSiloFichaData(siloLimpiezaTarget);
    const stockAnterior = targetFicha.stockKg;

    const callback = onPonerSiloEnCero || onPonerEnCero;
    if (callback) {
      await callback(
        siloLimpiezaTarget,
        limpiezaFecha || new Date().toISOString().split('T')[0],
        limpiezaUsuario || currentUser?.nombre || 'Amilcar Quiroz',
        limpiezaMotivo || 'Limpieza Varietal',
        stockAnterior
      );
    }

    setSiloContaminado(false);
    setFormError('');
    setFormSuccess(`¡Limpieza / Descarte ejecutada en ${siloLimpiezaTarget}! Silo vaciado (0 kg), desvinculada partida anterior y habilitado para nuevos ingresos.`);
    setTimeout(() => setFormSuccess(''), 5000);
    setSiloLimpiezaTarget(null);
  };

  // Estado para el tipo de métrica del Gráfico de Ocupación de Silos
  const [chartMetric, setChartMetric] = useState<'PORCENTAJE' | 'TONELADAS'>('PORCENTAJE');

  const openSiloDrawer = (siloId: SiloId) => {
    setActiveSilo(siloId);
    setDrawerSilo(siloId);
    setDrawerFilterTipo('TODOS');
    setDrawerSearch('');
  };

  // Calcular Resumen de Ficha para un Silo determinado (SOLO DATOS DEL STOCK ACTUAL, NO HISTÓRICO)
  const getSiloFichaData = (siloId: SiloId) => {
    const stockKg = getStockSilo(siloId);
    const stockTn = (stockKg / 1000).toFixed(1);
    const pctOcupacion = ((stockKg / CAPACIDAD_MAX_SILO) * 100).toFixed(1);

    const movsAsc = movimientosSilo
      .filter((m) => m.siloId === siloId)
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

    // Identificar movimientos correspondientes al LOTE DE STOCK ACTUAL (posterior al último punto de saldo cero)
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
      if (currentBalance === 0) {
        lastZeroIndex = idx;
      }
    });

    const movsBatchActual = movsAsc.slice(lastZeroIndex + 1);
    const ingresosBatchActual = movsBatchActual.filter((m) => m.tipo === 'INGRESO');

    if (stockKg === 0 || ingresosBatchActual.length === 0) {
      return {
        siloId,
        stockKg: 0,
        stockTn: '0.0',
        pctOcupacion: '0.0',
        especie: 'Sin Cereal / Vacío',
        cliente: 'Sin asignación',
        variedad: '-',
        categoria: '-',
        humedad: '0.0',
        ingresosActivos: [],
        totalIngresos: 0,
        totalKgIngresados: 0,
        totalKgEgresados: 0,
        ultimoMovimiento: movsAsc[movsAsc.length - 1]?.fecha || 'Sin registros',
      };
    }

    const egresosBatchActual = movsBatchActual.filter((m) => m.tipo === 'EGRESO_OP' || (m.tipo as string).startsWith('EGRESO'));
    const totalKgIngresados = ingresosBatchActual.reduce((acc, m) => acc + m.kg, 0);
    const totalKgEgresados = egresosBatchActual.reduce((acc, m) => acc + m.kg, 0);

    const especiesSet = Array.from(new Set(ingresosBatchActual.map((i) => i.especie).filter(Boolean)));
    const clientesSet = Array.from(new Set(ingresosBatchActual.map((i) => i.cliente).filter(Boolean)));
    const variedadesSet = Array.from(new Set(ingresosBatchActual.map((i) => i.variedad).filter(Boolean)));
    const categoriasSet = Array.from(new Set(ingresosBatchActual.map((i) => i.categoria).filter(Boolean)));

    const especie = especiesSet.length > 0 ? especiesSet.join(', ') : 'Sin Cereal / Vacío';
    const cliente = clientesSet.length > 0 ? clientesSet.join(', ') : 'Sin Asignar';
    const variedad = variedadesSet.length > 0 ? variedadesSet.join(', ') : '-';
    const categoria = categoriasSet.length > 0 ? categoriasSet.join(', ') : '-';

    let totalKgConHumedad = 0;
    let sumaHumedadPonderada = 0;
    ingresosBatchActual.forEach((ing) => {
      if (ing.humedad !== undefined && ing.humedad > 0) {
        totalKgConHumedad += ing.kg;
        sumaHumedadPonderada += ing.kg * ing.humedad;
      }
    });

    const ultIngresoBatch = ingresosBatchActual[ingresosBatchActual.length - 1];
    const humedadPromedio = totalKgConHumedad > 0 
      ? (sumaHumedadPonderada / totalKgConHumedad).toFixed(1)
      : ultIngresoBatch?.humedad !== undefined 
      ? ultIngresoBatch.humedad.toFixed(1) 
      : '13.5';

    const ingresosActivos = [...ingresosBatchActual].reverse();

    return {
      siloId,
      stockKg,
      stockTn,
      pctOcupacion,
      especie,
      cliente,
      variedad,
      categoria,
      humedad: humedadPromedio,
      ingresosActivos,
      totalIngresos: ingresosActivos.length,
      totalKgIngresados,
      totalKgEgresados,
      ultimoMovimiento: movsAsc[movsAsc.length - 1]?.fecha || 'Sin registros',
    };
  };

  // Función para exportar la Ficha Técnica de Silo a formato CSV
  const handleExportFichaCSV = (fichaData: ReturnType<typeof getSiloFichaData>) => {
    const lines = [
      `FICHA TÉCNICA DE CONTROL DE ACOPIO EN SILO - PLANTA CLASIFICADORA AGROABACUS`,
      `Fecha de Reporte:;${new Date().toLocaleDateString('es-AR')} ${new Date().toLocaleTimeString('es-AR')}`,
      `--------------------------------------------------------------------------------`,
      `Número de Silo:;${fichaData.siloId}`,
      `Especie:;${fichaData.especie}`,
      `Cliente:;${fichaData.cliente}`,
      `Variedad:;${fichaData.variedad}`,
      `Categoría:;${fichaData.categoria}`,
      `Kg Totales en Silo:;${fichaData.stockKg.toLocaleString('es-AR')} kg`,
      `Tn Totales en Silo:;${fichaData.stockTn} Tn`,
      `Capacidad Máxima Silo:;180.000 kg (180 Tn)`,
      `Porcentaje de Ocupación:;${fichaData.pctOcupacion}%`,
      `Porcentaje de Humedad (%):;${fichaData.humedad}%`,
      `Fecha Último Movimiento:;${fichaData.ultimoMovimiento}`,
      `--------------------------------------------------------------------------------`,
      `DETALLE DE INGRESOS REGISTRADOS EN ${fichaData.siloId}:`,
      `ID Movimiento;Fecha;Cliente;Especie;Variedad;Categoría;Campo Origen;Bolsón N°;Kg Ingresados;% Humedad`,
    ];

    fichaData.ingresosActivos.forEach((i) => {
      lines.push(
        `${i.id};${i.fecha};${i.cliente || '-'};${i.especie || '-'};${i.variedad || '-'};${i.categoria || '-'};${i.campoOrigen || '-'};${i.bolsonOrigenNro || '-'};${i.kg};${i.humedad !== undefined ? i.humedad + '%' : '-'}`
      );
    });

    const csvContent = lines.join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Ficha_${fichaData.siloId.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setExportNoticeMsg(`¡Ficha de ${fichaData.siloId} exportada exitosamente!`);
    setTimeout(() => setExportNoticeMsg(''), 4000);
  };

  // Datos procesados para el Gráfico de Barras Recharts de Ocupación por Silo
  const chartSilosData = SILOS_DISPONIBLES.map((siloId) => {
    const stock = getStockSilo(siloId);
    const stockTn = Number((stock / 1000).toFixed(1));
    const porcentaje = Number(((stock / CAPACIDAD_MAX_SILO) * 100).toFixed(1));
    const ficha = getSiloFichaData(siloId);
    const capacidadTn = CAPACIDAD_MAX_SILO / 1000;
    const disponibleTn = Number(((CAPACIDAD_MAX_SILO - stock) / 1000).toFixed(1));

    let color = '#10b981'; // emerald-500 (Operativo)
    if (stock >= CAPACIDAD_MAX_SILO) {
      color = '#ef4444'; // red-600 (Lleno)
    } else if (stock >= UMBRAL_ALERTA_SILO) {
      color = '#f59e0b'; // amber-500 (Alerta)
    } else if (stock === 0) {
      color = '#94a3b8'; // slate-400 (Vacío)
    }

    return {
      siloId,
      siloNombre: siloId,
      stockKg: stock,
      stockTn,
      porcentaje,
      capacidadTn,
      disponibleTn,
      especie: ficha.especie,
      variedad: ficha.variedad,
      cliente: ficha.cliente,
      color,
    };
  });

  const currentSiloStock = getStockSilo(activeSilo);
  const currentSiloPct = Math.min(100, (currentSiloStock / CAPACIDAD_MAX_SILO) * 100);

  // Filtrar movimientos del silo activo
  const movimientosDelSilo = movimientosSilo
    .filter((m) => m.siloId === activeSilo)
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  // Calcular saldos acumulados históricos para la tabla
  let runningStock = 0;
  const movimientosConSaldo = [...movimientosDelSilo]
    .reverse()
    .map((m) => {
      if (m.tipo === 'INGRESO') {
        runningStock += m.kg;
      } else if (m.tipo === 'EGRESO_OP' || (m.tipo as string).startsWith('EGRESO')) {
        runningStock = Math.max(0, runningStock - m.kg);
      } else if (m.tipo === 'AJUSTE_ZERO') {
        runningStock = 0;
      }
      return { ...m, saldoResultante: runningStock };
    })
    .reverse();

  // Envío del Formulario de Ingreso (soporta 1 o múltiples bloques encadenados)
  const handleSubmitIngresos = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setSiloContaminado(false);

    // 1. Validar cada bloque individualmente y calcular acumulados por silo
    let hasError = false;
    const updatedBloques = [...bloques];
    const pendingKgPorSilo: Record<SiloId, number> = {
      'Silo 1': 0,
      'Silo 2': 0,
      'Silo 3': 0,
      'Silo 4': 0,
      'Silo 5': 0,
      'Silo 6': 0,
    };

    for (let i = 0; i < updatedBloques.length; i++) {
      const b = updatedBloques[i];
      const clienteFinal = b.cliente ? b.cliente.trim() : '';

      if (!clienteFinal) {
        updatedBloques[i] = { ...b, error: `[Ingreso #${i + 1}] Debe ingresar el Cliente / Titular.` };
        hasError = true;
        continue;
      }

      if (!b.variedad.trim()) {
        updatedBloques[i] = { ...b, error: `[Ingreso #${i + 1}] Debe ingresar la Variedad / Híbrido.` };
        hasError = true;
        continue;
      }

      if (!b.totalKgIngresados || Number(b.totalKgIngresados) <= 0) {
        updatedBloques[i] = { ...b, error: `[Ingreso #${i + 1}] El Total de Kilos Netos debe ser mayor a 0.` };
        hasError = true;
        continue;
      }

      if (b.campoOrigenSelect === 'Otro' && !b.campoOrigenManual.trim()) {
        updatedBloques[i] = { ...b, error: `[Ingreso #${i + 1}] Debe especificar el Campo de Origen.` };
        hasError = true;
        continue;
      }

      // Validar contaminación varietal en el silo
      const validationResult = validateSiloIngresoMatch(b.siloId, {
        cliente: clienteFinal,
        especie: b.especie,
        variedad: b.variedad.trim(),
        categoria: b.categoria,
      }, movimientosSilo);

      if (!validationResult.valid && validationResult.errorMessage) {
        updatedBloques[i] = {
          ...b,
          error: `[Ingreso #${i + 1}] ${validationResult.errorMessage}`,
          siloContaminado: true,
        };
        hasError = true;
        continue;
      }

      const kgNuevos = Number(b.totalKgIngresados);
      const stockActualSilo = silosStocksMap[b.siloId] || 0;
      const kgAcumuladosEnEsteLote = pendingKgPorSilo[b.siloId] + kgNuevos;

      if (stockActualSilo + kgAcumuladosEnEsteLote > CAPACIDAD_MAX_SILO) {
        const espacioLibre = Math.max(0, CAPACIDAD_MAX_SILO - stockActualSilo - pendingKgPorSilo[b.siloId]);
        updatedBloques[i] = {
          ...b,
          error: `[Ingreso #${i + 1}] ¡Supera la capacidad máxima de 180.000 kg para ${b.siloId}! Stock actual: ${stockActualSilo.toLocaleString('es-AR')} kg. Espacio libre restante: ${espacioLibre.toLocaleString('es-AR')} kg.`,
        };
        hasError = true;
        continue;
      }

      pendingKgPorSilo[b.siloId] += kgNuevos;
      updatedBloques[i] = { ...b, error: undefined, siloContaminado: undefined };
    }

    if (hasError) {
      setBloques(updatedBloques);
      setFormError('Por favor verifique los datos señalados en los bloques de ingreso antes de continuar.');
      return;
    }

    // 2. Generar las transacciones independientes
    const timestampBase = Date.now();
    const nuevosMovimientos: MovimientoSilo[] = updatedBloques.map((b, idx) => {
      const isFleteInternoPropio = b.modalidadTransporte === 'FLETE_PROPIO';
      const isFleteMontaner = b.modalidadTransporte === 'FLETE_TERCEROS' && b.subTipoTerceros === 'FLETE_MONTANER';
      const isFlete = isFleteInternoPropio || isFleteMontaner || b.tipoTransporte === 'FLETE';

      const fleteNombreFinal = isFleteInternoPropio ? 'Flete AA' : (isFleteMontaner ? 'Flete Montaner' : b.fleteOpcion);
      const choferVal = isFlete ? fleteNombreFinal : b.choferNombre.trim();
      const cuitVal = isFlete ? '' : b.choferCuit.trim();
      const patentesVal = isFlete ? '' : b.choferPatentes.trim();
      const transporteVal = isFlete ? fleteNombreFinal : (b.choferTransporte.trim() || 'Sin Transporte');
      const kgVal = Number(b.totalKgIngresados);
      const taraVal = typeof b.choferTara === 'number' ? b.choferTara : undefined;
      const campoOrigenFinal = b.campoOrigenSelect === 'Otro' ? b.campoOrigenManual.trim() : b.campoOrigenSelect;

      // Guardar información del chofer si es un chofer nuevo/editado
      if (!isFlete && b.choferNombre.trim() && onSaveChofer) {
        const candidateData = {
          nombre: b.choferNombre.trim(),
          cuit: b.choferCuit.trim(),
          patentes: b.choferPatentes.trim(),
          transporte: b.choferTransporte.trim(),
          tara: taraVal,
        };
        const existing = findExistingChofer(candidateData, choferes);
        const choferToSave = mergeChoferData(existing, candidateData);
        onSaveChofer(choferToSave);
      }

      return {
        id: `ING-SILO-${timestampBase}-${idx + 1}`,
        siloId: b.siloId,
        fecha: b.fecha,
        hora: b.hora?.trim() || new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }) || new Date().toTimeString().slice(0, 5),
        tipo: 'INGRESO',
        kg: kgVal,
        cliente: b.cliente.trim(),
        especie: b.especie,
        variedad: b.variedad.trim(),
        categoria: b.categoria,
        campoOrigen: campoOrigenFinal,
        bolsonOrigenId: b.bolsonOrigenId || undefined,
        bolsonOrigenNro: b.bolsonOrigenNro.trim(),
        bolsonOrigenSector: b.bolsonOrigenSector.trim(),
        depositoOrigen: b.depositoOrigen.trim(),
        humedad: typeof b.humedad === 'number' ? b.humedad : 13.5,
        comprobanteCartaPorte: b.comprobanteCartaPorte.trim() || undefined,
        remito: b.comprobanteCartaPorte.trim() || undefined,
        cartaPorte: b.comprobanteCartaPorte.trim() || undefined,
        tipoTransporte: isFlete ? 'FLETE' : 'CHOFER',
        chofer: choferVal,
        cuit: cuitVal,
        patentes: patentesVal,
        transporte: transporteVal,
        tara: taraVal,
        bruto: taraVal !== undefined ? (taraVal + kgVal) : undefined,
        observaciones: b.observaciones?.trim() || undefined,
      };
    });

    // 3. Impacto en el stock e historial
    if (onRegistrarIngresosMultiple) {
      onRegistrarIngresosMultiple(nuevosMovimientos);
    } else {
      nuevosMovimientos.forEach((mov) => onRegistrarIngreso(mov));
    }

    // 4. Mensaje de confirmación
    const totalKgTodos = nuevosMovimientos.reduce((acc, m) => acc + m.kg, 0);
    const silosList = Array.from(new Set(nuevosMovimientos.map((m) => m.siloId))).join(', ');
    setFormSuccess(
      `¡${nuevosMovimientos.length} ingreso${nuevosMovimientos.length > 1 ? 's' : ''} registrado${nuevosMovimientos.length > 1 ? 's' : ''} con éxito! Total: ${totalKgTodos.toLocaleString('es-AR')} kg en [${silosList}].`
    );

    // 5. Restablecer el formulario a 1 bloque vacío
    setBloques([
      createDefaultIngresoBloque(activeSilo, clientes[0] || 'San Diego Semilla', especies[0] || 'Soja')
    ]);
    setTimeout(() => setFormSuccess(''), 5000);
  };

  // Manejador para Salidas Manuales de Silo
  const handleSubmitSalidaManual = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorSalidaManual('');

    if (!kgSalidaManual || Number(kgSalidaManual) <= 0) {
      setErrorSalidaManual('Debe ingresar una cantidad válida de kilos.');
      return;
    }

    const currentStock = getStockSilo(siloSalidaManual);
    if (Number(kgSalidaManual) > currentStock) {
      setErrorSalidaManual(`El monto a extraer (${Number(kgSalidaManual).toLocaleString('es-AR')} kg) supera el stock actual disponible en ${siloSalidaManual} (${currentStock.toLocaleString('es-AR')} kg).`);
      return;
    }

    const idMov = `SALIDA-MANUAL-${siloSalidaManual.replace(/\s+/g, '')}-${Date.now()}`;
    const fichaActual = getSiloFichaData(siloSalidaManual);
    const isDescontam = descontaminacionVarietal || motivoSalidaManual === 'Descarte' || motivoSalidaManual === 'Descontaminación varietal';

    const movSalida: MovimientoSilo = {
      id: idMov,
      siloId: siloSalidaManual,
      fecha: fechaSalidaManual,
      hora: horaSalidaManual?.trim() || new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }),
      tipo: 'EGRESO_MANUAL',
      kg: Number(kgSalidaManual),
      motivoManual: motivoSalidaManual,
      descontaminacionVarietal: isDescontam,
      cliente: fichaActual.cliente !== 'Sin asignación' && fichaActual.cliente !== 'Sin Asignar' ? fichaActual.cliente : undefined,
      especie: fichaActual.especie !== 'Sin Cereal / Vacío' ? fichaActual.especie : undefined,
      variedad: fichaActual.variedad !== '-' ? fichaActual.variedad : undefined,
      categoria: fichaActual.categoria !== '-' ? fichaActual.categoria : undefined,
      humedad: fichaActual.humedad !== '0.0' ? parseFloat(fichaActual.humedad) : undefined,
      observaciones: observacionesSalidaManual.trim(),
      usuario: currentUser.nombre,
    };

    if (onRegistrarSalidaManual) {
      onRegistrarSalidaManual(movSalida);
    } else {
      onRegistrarIngreso(movSalida);
    }

    setShowModalSalidaManual(false);
    setExportNoticeMsg(`Salida manual de ${Number(kgSalidaManual).toLocaleString('es-AR')} kg en ${siloSalidaManual} (${isDescontam ? 'Descarte' : motivoSalidaManual}) registrada correctamente.`);
    setTimeout(() => setExportNoticeMsg(''), 4000);
  };

  // Carga e Importación masiva de Choferes desde Excel
  const handleFileUploadChoferes = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<any>(ws);

        const choferesImportados: Chofer[] = data.map((row: any, idx: number) => {
          const nombre = row['Chofer'] || row['Nombre'] || row['CHOFER'] || row['NOMBRE'] || `Chofer ${idx + 1}`;
          const cuit = row['CUIT'] || row['Cuit'] || row['cuit'] || '';
          const patentes = row['Patentes'] || row['Patente'] || row['PATENTE'] || row['PATENTES'] || '';
          const transporte = row['Transporte'] || row['Empresa'] || row['TRANSPORTE'] || '';

          const candidateData = {
            nombre: String(nombre).trim(),
            cuit: String(cuit).trim(),
            patentes: String(patentes).trim(),
            transporte: String(transporte).trim(),
          };

          const existing = findExistingChofer(candidateData, choferes);
          return mergeChoferData(existing, candidateData);
        }).filter(ch => ch.nombre);

        if (choferesImportados.length > 0 && onImportChoferes) {
          onImportChoferes(choferesImportados);
          setImportNoticeChoferes(`¡Se importaron ${choferesImportados.length} choferes desde Excel correctamente!`);
          setTimeout(() => setImportNoticeChoferes(''), 4000);
        }
      } catch (err) {
        console.error('Error al procesar archivo de choferes:', err);
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Header General */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-900 text-[10px] font-black uppercase tracking-wider rounded-md border border-emerald-200 flex items-center gap-1.5">
              <SiloIcon size={24} color="#00603C" className="silo-icon-institucional shrink-0" /> Control de Acopio y Silos
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold font-serif text-slate-900 flex items-center gap-2">
            Ingreso a Silos y Gestión de Stock
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            Planta de Acopio: 6 Silos de 180.000 kg (Capacidad Total: 1.080.000 kg / 1.080 Tn).
          </p>
        </div>
      </div>

      {/* Selectores de Pestañas / Secciones por Silo (Disposición Física Real: Fila 1: Silo 4 | Silo 3, Fila 2: Silo 5 | Silo 2, Fila 3: Silo 6 | Silo 1) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <SiloIcon size={24} color="#00603C" className="silo-icon-institucional shrink-0" />
            <span className="text-sm">Disposición Física de Silos (Planta La Barrancosa)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowGrillaSeisSilos(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#005E38] hover:bg-[#004D2E] text-white text-xs font-bold rounded-xl shadow-2xs transition active:scale-95 cursor-pointer self-start sm:self-auto"
              title="Descargar las 6 Fichas Técnicas de Silo en una única hoja PDF A4 (Grilla 2x3)"
            >
              <Grid3X3 className="w-3.5 h-3.5" />
              <span>PDF 6 Silos (Hoja A4)</span>
            </button>
          </div>
        </div>

        {/* Grilla física 2x3 de silos con marcos circulares */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl mx-auto py-2">
          {SILOS_PHYSICAL_ORDER.map((siloId) => {
            const stock = getStockSilo(siloId);
            const isSelected = activeSilo === siloId;
            const pct = Math.min(100, (stock / CAPACIDAD_MAX_SILO) * 100);
            const estadoManual = silosEstadoManual[siloId] || 'VACIO_LIMPIO';
            const siloInfo = getSiloDetailedInfo(siloId, movimientosSilo);

            // Configuración de la Luz según el Check Manual
            // 1. Silo Ocupado: Luz Amarilla
            // 2. Silo Vacío Sucio: Luz Roja
            // 3. Silo Vacío Limpio: Luz Verde
            const luzConfig = estadoManual === 'OCUPADO'
              ? {
                  color: 'bg-amber-400',
                  glow: 'shadow-[0_0_16px_rgba(251,191,36,0.9)] ring-2 ring-amber-300',
                  border: 'border-amber-500',
                  texto: 'Silo Ocupado',
                  pillClass: 'bg-amber-100 text-amber-900 border-amber-300'
                }
              : estadoManual === 'VACIO_SUCIO'
              ? {
                  color: 'bg-red-500',
                  glow: 'shadow-[0_0_16px_rgba(239,68,68,0.9)] ring-2 ring-red-400 animate-pulse',
                  border: 'border-red-600',
                  texto: 'Silo Vacío Sucio',
                  pillClass: 'bg-red-100 text-red-900 border-red-300'
                }
              : {
                  color: 'bg-emerald-500',
                  glow: 'shadow-[0_0_16px_rgba(16,185,129,0.9)] ring-2 ring-emerald-300',
                  border: 'border-emerald-600',
                  texto: 'Silo Vacío Limpio',
                  pillClass: 'bg-emerald-100 text-emerald-900 border-emerald-300'
                };

            return (
              <div
                key={siloId}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setActiveSilo(siloId);
                  setFormError('');
                  setFormSuccess('');
                  setSiloContaminado(false);
                  const el = document.getElementById('detalle-operaciones-silos');
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setActiveSilo(siloId);
                    setFormError('');
                    setFormSuccess('');
                  }
                }}
                className={`w-full max-w-[330px] aspect-square rounded-full border-4 text-center transition-all duration-300 relative overflow-hidden flex flex-col items-center justify-between p-4 sm:p-5 cursor-pointer mx-auto ${
                  isSelected
                    ? 'bg-slate-900 border-[#00603C] text-white shadow-2xl ring-4 ring-emerald-400/50 scale-[1.02]'
                    : 'bg-white border-slate-300 hover:border-[#00603C] text-slate-900 shadow-md hover:shadow-xl'
                }`}
              >
                {/* 1. LUZ DE ESTADO Y ETIQUETA EN LA PARTE SUPERIOR */}
                <div className="flex flex-col items-center gap-1 mt-1 z-10">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-4 h-4 rounded-full border-2 border-white ${luzConfig.color} ${luzConfig.glow} transition-all duration-300`}
                      title={`${siloId}: ${luzConfig.texto}`}
                    />
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                      isSelected
                        ? 'bg-slate-800 text-slate-200 border-slate-700'
                        : luzConfig.pillClass
                    }`}>
                      {luzConfig.texto}
                    </span>
                  </div>
                </div>

                {/* 2. CENTRO: ÍCONO DEL SILO + NOMBRE + VARIEDAD DESTACADA + STOCK */}
                <div className="flex flex-col items-center justify-center my-auto z-10">
                  <div className="p-1.5 rounded-full bg-emerald-500/10 mb-1 flex items-center justify-center">
                    <SiloIcon
                      size={24}
                      color="#00603C"
                      className="silo-icon-institucional shrink-0"
                    />
                  </div>
                  
                  <h3 className={`text-xl sm:text-2xl font-black font-serif tracking-tight ${
                    isSelected ? 'text-emerald-400' : 'text-slate-900'
                  }`}>
                    {siloId}
                  </h3>

                  {/* Nombre de Variedad - Destacado y Aumentado de Tamaño */}
                  {siloInfo.variedad && siloInfo.variedad !== '-' && (
                    <div className="my-1 max-w-[220px] px-1">
                      <span className={`inline-block px-3 py-0.5 text-xs sm:text-sm font-black uppercase tracking-wider rounded-lg shadow-2xs border ${
                        isSelected
                          ? 'bg-amber-400 text-amber-950 border-amber-300'
                          : 'bg-amber-100 text-amber-950 border-amber-300'
                      }`}>
                        {siloInfo.variedad}
                      </span>
                    </div>
                  )}

                  <div className={`text-base sm:text-lg font-black font-mono tracking-tight mt-0.5 ${
                    isSelected ? 'text-white' : 'text-slate-900'
                  }`}>
                    {stock.toLocaleString('es-AR')} <span className="text-xs font-normal opacity-80">kg</span>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] sm:text-xs font-semibold mt-0.5">
                    <span className={isSelected ? 'text-slate-300' : 'text-slate-500'}>
                      {(stock / 1000).toFixed(1)} / 180 Tn
                    </span>
                    <span className={`font-mono font-bold ${
                      isSelected ? 'text-emerald-300' : 'text-emerald-700'
                    }`}>
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* 3. PARTE INFERIOR: SELECTOR DE CHECK MANUAL (3 OPCIONES) */}
                <div className="flex flex-col items-center gap-1.5 w-full mb-1 z-10">
                  <div
                    className={`flex items-center justify-center gap-1 p-1 rounded-full border shadow-inner ${
                      isSelected ? 'bg-slate-800/90 border-slate-700' : 'bg-slate-100 border-slate-200'
                    }`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Opción 1: Silo Ocupado (Amarillo) */}
                    <button
                      type="button"
                      title="Activar Silo Ocupado (Luz Amarilla)"
                      onClick={() => handleSetEstadoManual(siloId, 'OCUPADO')}
                      className={`px-2 py-1 rounded-full text-[9px] font-bold flex items-center gap-1 transition cursor-pointer ${
                        estadoManual === 'OCUPADO'
                          ? 'bg-amber-400 text-amber-950 font-black shadow-xs ring-1 ring-amber-500'
                          : isSelected
                          ? 'text-slate-300 hover:text-white hover:bg-slate-700'
                          : 'text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-amber-500 border border-amber-600 inline-block"></span>
                      <span>Ocupado</span>
                    </button>

                    {/* Opción 2: Silo Vacío Sucio (Rojo) */}
                    <button
                      type="button"
                      title="Activar Silo Vacío Sucio (Luz Roja)"
                      onClick={() => handleSetEstadoManual(siloId, 'VACIO_SUCIO')}
                      className={`px-2 py-1 rounded-full text-[9px] font-bold flex items-center gap-1 transition cursor-pointer ${
                        estadoManual === 'VACIO_SUCIO'
                          ? 'bg-red-500 text-white font-black shadow-xs ring-1 ring-red-600'
                          : isSelected
                          ? 'text-slate-300 hover:text-white hover:bg-slate-700'
                          : 'text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-red-600 border border-white inline-block"></span>
                      <span>V. Sucio</span>
                    </button>

                    {/* Opción 3: Silo Vacío Limpio (Verde) */}
                    <button
                      type="button"
                      title="Activar Silo Vacío Limpio (Luz Verde)"
                      onClick={() => handleSetEstadoManual(siloId, 'VACIO_LIMPIO')}
                      className={`px-2 py-1 rounded-full text-[9px] font-bold flex items-center gap-1 transition cursor-pointer ${
                        estadoManual === 'VACIO_LIMPIO'
                          ? 'bg-emerald-500 text-white font-black shadow-xs ring-1 ring-emerald-600'
                          : isSelected
                          ? 'text-slate-300 hover:text-white hover:bg-slate-700'
                          : 'text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-400 border border-white inline-block"></span>
                      <span>V. Limpio</span>
                    </button>
                  </div>

                  {/* Acciones Rápidas (Historial / Ficha) */}
                  <div className="flex items-center justify-center gap-3 text-[9px] font-bold">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openSiloDrawer(siloId);
                      }}
                      className={`hover:underline flex items-center gap-0.5 ${
                        isSelected ? 'text-amber-300' : 'text-amber-700'
                      }`}
                    >
                      <History className="w-2.5 h-2.5" /> Historial
                    </button>
                    <span className={isSelected ? 'text-slate-600' : 'text-slate-300'}>•</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openFichaModal(siloId);
                      }}
                      className={`hover:underline flex items-center gap-0.5 ${
                        isSelected ? 'text-emerald-300' : 'text-emerald-700'
                      }`}
                    >
                      <Eye className="w-2.5 h-2.5" /> Ficha
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Contenedor del Silo Activo */}
      <div id="detalle-operaciones-silos" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6 scroll-mt-6">
        
        {/* Encabezado del Silo Seleccionado */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 flex items-center justify-center shrink-0">
              <SiloIcon size={24} color="#00603C" className="silo-icon-institucional shrink-0" />
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-emerald-800">
                Detalle y Operaciones de silos
              </div>
              <h2 className="text-2xl sm:text-3xl font-black font-serif text-slate-900 flex items-center gap-3 flex-wrap mt-0.5">
                <span>{activeSilo}</span>
                {(() => {
                  const info = getSiloDetailedInfo(activeSilo, movimientosSilo);
                  if (info.variedad && info.variedad !== '-') {
                    return (
                      <span className="text-sm px-3 py-1 bg-amber-400 text-amber-950 rounded-xl font-sans font-black border border-amber-500 shadow-2xs uppercase tracking-wider">
                        Variedad: {info.variedad}
                      </span>
                    );
                  }
                  return null;
                })()}
                <span className={`text-xs px-3 py-1 rounded-full font-sans font-bold border ${
                  currentSiloStock >= CAPACIDAD_MAX_SILO
                    ? 'bg-red-100 text-red-900 border-red-300'
                    : currentSiloStock >= UMBRAL_ALERTA_SILO
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-emerald-100 text-emerald-900 border-emerald-200'
                }`}>
                  Ocupado: {currentSiloStock.toLocaleString('es-AR')} kg / 180.000 kg ({currentSiloPct.toFixed(1)}%)
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center justify-center sm:justify-end gap-2 flex-wrap">
            {/* Control Rápido de Estado Manual en la Cabecera de Operaciones */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => handleSetEstadoManual(activeSilo, 'OCUPADO')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  silosEstadoManual[activeSilo] === 'OCUPADO'
                    ? 'bg-amber-400 text-amber-950 font-black shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
                title="Silo Ocupado (Luz Amarilla)"
              >
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                <span>Ocupado</span>
              </button>
              <button
                type="button"
                onClick={() => handleSetEstadoManual(activeSilo, 'VACIO_SUCIO')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  silosEstadoManual[activeSilo] === 'VACIO_SUCIO'
                    ? 'bg-red-500 text-white font-black shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
                title="Silo Vacío Sucio (Luz Roja)"
              >
                <span className="w-2 h-2 rounded-full bg-red-600 inline-block"></span>
                <span>V. Sucio</span>
              </button>
              <button
                type="button"
                onClick={() => handleSetEstadoManual(activeSilo, 'VACIO_LIMPIO')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  silosEstadoManual[activeSilo] === 'VACIO_LIMPIO'
                    ? 'bg-emerald-500 text-white font-black shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
                title="Silo Vacío Limpio (Luz Verde)"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
                <span>V. Limpio</span>
              </button>
            </div>

            <button
              onClick={handleExportMovimientosExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 shrink-0"
              title="Exportar todos los Ingresos y Egresos de Silos a Excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
              <span>Exportar Excel</span>
            </button>

            <button
              onClick={() => openSiloDrawer(activeSilo)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 shrink-0"
              title="Abrir panel lateral con el historial detallado de ingresos y egresos de este silo"
            >
              <History className="w-4 h-4 text-amber-400" />
              <span>Historial</span>
            </button>

            <button
              onClick={() => openFichaModal(activeSilo)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 shrink-0 cursor-pointer"
              title="Ver Ficha Técnica Oficial del Silo"
            >
              <Eye className="w-4 h-4 text-emerald-300" />
              <span>Ver Ficha</span>
            </button>

            <button
              onClick={() => openModalSalidaManual(activeSilo)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 shrink-0 cursor-pointer"
              title="Registrar una Salida Manual en este silo"
            >
              <ArrowUpRight className="w-4 h-4 text-amber-200" />
              <span>Salida Manual</span>
            </button>

            <button
              onClick={() => openModalLimpiezaVarietal(activeSilo)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 shrink-0 cursor-pointer border border-amber-700"
              title="Ejecutar Limpieza de Descarte (Vaciar stock a 0 kg y desvincular Especie, Variedad, Cliente y Bolsón)"
            >
              <RotateCcw className="w-4 h-4 text-amber-300" />
              <span>Limpieza Descarte</span>
            </button>
          </div>
        </div>

        {/* Banner de Referencia de Calibración / Último Evento Stock en Cero */}
        {(() => {
          const ultimoZero = getUltimoAjusteCero(activeSilo);
          return (
            <div className="p-3.5 bg-amber-50/60 border border-amber-200/80 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-lg shrink-0">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900/70 block">
                    Referencia de Cálculo del Stock Actual (Σ Ingresos − Σ Egresos)
                  </span>
                  <div className="text-slate-800 font-medium mt-0.5">
                    {ultimoZero ? (
                      <span>
                        Punto de calibración <strong>"Stock en Cero"</strong>: <strong className="text-amber-900 font-mono">{ultimoZero.fecha}</strong> por <strong>{ultimoZero.usuarioZero || ultimoZero.usuario || 'Amilcar Quiroz'}</strong> {ultimoZero.motivoZero ? `(${ultimoZero.motivoZero})` : ''}
                      </span>
                    ) : (
                      <span className="text-slate-600">
                        Historial completo desde inicio (sin eventos de calibración previa a 0).
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => openModalSalidaManual(activeSilo)}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] rounded-lg shadow-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95"
              >
                <ArrowUpRight className="w-3.5 h-3.5 text-amber-200" />
                <span>Salida Manual</span>
              </button>
            </div>
          );
        })()}

        {exportNoticeMsg && (
          <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs font-bold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span>{exportNoticeMsg}</span>
            </div>
          </div>
        )}

        {/* Banners de Alerta por Capacidad cercana o límite */}
        {currentSiloStock >= CAPACIDAD_MAX_SILO ? (
          <div className="p-3.5 bg-red-50 border border-red-200 text-red-900 rounded-xl text-xs font-semibold flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
            <span>
              <strong>¡LÍMITE MÁXIMO ALCANZADO!</strong> {activeSilo} ha completado su capacidad total de 180.000 kg (180 Tn). No se pueden realizar nuevos ingresos a este silo sin antes realizar extracciones o un ajuste.
            </span>
          </div>
        ) : currentSiloStock >= UMBRAL_ALERTA_SILO ? (
          <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-semibold flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>
              <strong>¡ALERTA DE CAPACIDAD CERCANA!</strong> {activeSilo} está al {currentSiloPct.toFixed(1)}% de su capacidad. Quedan solo {(CAPACIDAD_MAX_SILO - currentSiloStock).toLocaleString('es-AR')} kg disponibles antes de alcanzar el límite de 180.000 kg.
            </span>
          </div>
        ) : null}

        {/* Formulario de Ingreso a este Silo */}
        {/* Formulario Dinámico Encadenado de Ingreso a Silo */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                  <Warehouse className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                    <span>Ingreso a Silo</span>
                    <span className="px-2 py-0.5 bg-emerald-700 text-white rounded-full text-[10px] font-black tracking-normal">
                      {bloques.length} {bloques.length === 1 ? 'Ingreso' : 'Ingresos encadenados'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Registre ingresos individuales o encadenados con impacto directo e independiente en el stock.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleAddBloqueAfter(bloques.length - 1)}
              className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-black text-xs rounded-xl shadow-2xs transition flex items-center gap-2 cursor-pointer active:scale-95 shrink-0"
            >
              <Plus className="w-4 h-4 text-emerald-700" />
              <span>[+] Agregar otro ingreso a silos</span>
            </button>
          </div>

          {formError && (
            <div className="p-4 bg-red-50 border-2 border-red-400 text-red-900 rounded-2xl text-xs font-semibold flex items-center gap-3 shadow-xs animate-in fade-in">
              <AlertTriangle className="w-5 h-5 shrink-0 text-red-600" />
              <span>{formError}</span>
            </div>
          )}

          {formSuccess && (
            <div className="p-4 bg-emerald-50 border-2 border-emerald-400 text-emerald-950 rounded-2xl text-xs font-bold flex items-center gap-3 shadow-xs animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" />
              <span>{formSuccess}</span>
            </div>
          )}

          <form onSubmit={handleSubmitIngresos} className="space-y-4">
            {bloques.map((bloque, index) => (
              <IngresoSiloBloqueCard
                key={bloque.id}
                bloque={bloque}
                index={index}
                totalBloques={bloques.length}
                clientes={clientes}
                especies={especies}
                plantaConfig={plantaConfig}
                choferes={choferes}
                bolsones={bolsones}
                movimientosSilo={movimientosSilo}
                currentStockPorSilo={silosStocksMap}
                onUpdate={(updated) => handleUpdateBloque(index, updated)}
                onRemove={() => handleRemoveBloque(index)}
                onAddNext={() => handleAddBloqueAfter(index)}
                onSaveChofer={onSaveChofer}
                onFileUploadChoferes={handleFileUploadChoferes}
                onLimpiezaDescarte={(sId) => openModalLimpiezaVarietal(sId)}
              />
            ))}

            {/* Barra de Resumen Consolidado y Envío */}
            <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-lg flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                    Resumen de Operación:
                  </span>
                  <span className="px-2.5 py-0.5 bg-emerald-900/80 border border-emerald-500/40 text-emerald-300 rounded-lg text-xs font-black">
                    {bloques.length} {bloques.length === 1 ? 'Camión / Ingreso' : 'Camiones / Ingresos'}
                  </span>
                  <span className="text-xs font-black text-amber-400 font-mono">
                    Total Kilos Netos: {bloques.reduce((acc, b) => acc + (Number(b.totalKgIngresados) || 0), 0).toLocaleString('es-AR')} kg
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 flex items-center gap-2 flex-wrap">
                  <span>Desglose por destino:</span>
                  {(['Silo 1', 'Silo 2', 'Silo 3', 'Silo 4', 'Silo 5', 'Silo 6'] as SiloId[]).map((sId) => {
                    const kgSilo = bloques
                      .filter((b) => b.siloId === sId)
                      .reduce((acc, b) => acc + (Number(b.totalKgIngresados) || 0), 0);
                    if (kgSilo === 0) return null;
                    return (
                      <span key={sId} className="bg-slate-800 px-2 py-0.5 rounded text-slate-300 font-medium">
                        <strong className="text-white">{sId}:</strong> {kgSilo.toLocaleString('es-AR')} kg
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => openFichaModal(activeSilo)}
                  className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 border border-slate-700 cursor-pointer active:scale-95"
                  title="Descargar Ficha Técnica en formato PDF"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>Descargar Ficha (PDF)</span>
                </button>

                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-md transition active:scale-95 flex items-center gap-2 cursor-pointer border border-emerald-400"
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    {bloques.length === 1
                      ? `Registrar Ingreso a ${bloques[0]?.siloId || activeSilo}`
                      : `Registrar ${bloques.length} Ingresos a Silos`}
                  </span>
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Histórico de Movimientos del Silo */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <History className="w-4 h-4 text-emerald-600" />
              Histórico de Movimientos de {activeSilo}
            </h3>
            <span className="text-[11px] text-slate-500 font-medium">
              {movimientosConSaldo.length} movimiento(s)
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="py-3 px-3.5">Fecha</th>
                  <th className="py-3 px-3.5">Tipo Movimiento</th>
                  <th className="py-3 px-3.5">Detalle / Origen / Orden</th>
                  <th className="py-3 px-3.5 text-right">Kg Movimiento</th>
                  <th className="py-3 px-3.5 text-right">Saldo Resultante</th>
                  <th className="py-3 px-3.5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {movimientosConSaldo.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                      No hay registros ni movimientos para {activeSilo}.
                    </td>
                  </tr>
                ) : (
                  movimientosConSaldo.map((m) => {
                    return (
                      <tr key={m.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-3.5 font-mono text-slate-700 whitespace-nowrap">
                          <span className="font-semibold">{m.fecha}</span>
                          {m.hora && (
                            <span className="block text-[10px] text-slate-500 font-normal">{m.hora} hs</span>
                          )}
                        </td>

                        <td className="py-3 px-3.5">
                          {m.tipo === 'INGRESO' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-900 font-extrabold text-[10px] rounded border border-emerald-300">
                              <ArrowUpRight className="w-3 h-3 text-emerald-600" />
                              Ingreso
                            </span>
                          )}
                          {m.tipo === 'EGRESO_OP' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-900 font-extrabold text-[10px] rounded border border-blue-300">
                              <ArrowDownRight className="w-3 h-3 text-blue-600" />
                              Egreso por OP
                            </span>
                          )}
                          {m.tipo === 'EGRESO_MANUAL' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-950 font-extrabold text-[10px] rounded border border-amber-300">
                              <ArrowDownRight className="w-3 h-3 text-amber-600" />
                              Salida Manual
                            </span>
                          )}
                          {m.tipo === 'AJUSTE_ZERO' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-950 font-extrabold text-[10px] rounded border border-amber-300">
                              <RotateCcw className="w-3 h-3 text-amber-600" />
                              Ajuste a Cero
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3.5 text-[11px] text-slate-800">
                          {m.tipo === 'INGRESO' && (
                            <div>
                              <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                                <span>{m.cliente} — {m.especie} ({m.variedad})</span>
                                {m.categoria && (
                                  <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 text-slate-700 text-[9px] font-bold rounded">
                                    {m.categoria}
                                  </span>
                                )}
                                {m.humedad !== undefined && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-900 text-[9px] font-extrabold rounded border border-blue-200">
                                    <Droplets className="w-2.5 h-2.5 text-blue-600" />
                                    {m.humedad}% Humedad
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                Campo: <strong className="text-slate-700 font-semibold">{m.campoOrigen || 'La Barrancosa'}</strong> · Bolsón N°: {m.bolsonOrigenNro || '-'} · Sector: {m.bolsonOrigenSector || '-'} · Depósito: {m.depositoOrigen || '-'}
                              </div>
                            </div>
                          )}

                          {m.tipo === 'EGRESO_MANUAL' && (
                            <div>
                              <div className="font-bold text-amber-950 flex items-center gap-1.5 flex-wrap">
                                <span>Salida Manual: {m.motivoManual || 'Manual'}</span>
                                {m.descontaminacionVarietal && (
                                  <span className="px-1.5 py-0.5 bg-purple-100 text-purple-900 border border-purple-300 text-[9px] font-extrabold rounded">
                                    Descarte
                                  </span>
                                )}
                              </div>
                              {(m.cliente || m.especie || m.variedad) && (
                                <div className="text-[10px] text-slate-700 font-medium mt-0.5">
                                  Cereal descontado: <strong className="text-slate-900">{m.cliente || 'Sin cliente'}</strong> — {m.especie || 'Sin especie'} ({m.variedad || '-'})
                                  {m.categoria && ` · Cat: ${m.categoria}`}
                                  {m.humedad !== undefined && ` · Hum: ${m.humedad}%`}
                                </div>
                              )}
                              {m.observaciones && (
                                <div className="text-[10px] text-slate-500 italic mt-0.5">
                                  Obs: {m.observaciones}
                                </div>
                              )}
                            </div>
                          )}

                          {m.tipo === 'EGRESO_OP' && (
                            <div>
                              <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                                <span>Salida por Lote:</span>
                                <span className="font-mono text-amber-900 font-extrabold">{m.loteNro || m.loteResultanteId || m.loteId || 'S/N'}</span>
                              </div>
                              {m.cliente && (
                                <div className="text-[10px] text-slate-500 mt-0.5">
                                  Cliente: <strong className="text-slate-700">{m.cliente}</strong> · Cereal: {m.especie || '-'} {m.variedad ? `(${m.variedad})` : ''}
                                </div>
                              )}
                            </div>
                          )}

                          {m.tipo === 'AJUSTE_ZERO' && (
                            <div>
                              <div className="font-bold text-amber-950">
                                Ajuste manual por diferencia de manipuleo
                              </div>
                              <div className="text-[10px] text-slate-600 italic">
                                Motivo: {m.motivoAjuste} (Usuario: {m.usuario || 'Sistema'})
                              </div>
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-3.5 text-right font-mono font-bold whitespace-nowrap">
                          {m.tipo === 'INGRESO' ? (
                            <span className="text-emerald-700">+ {m.kg.toLocaleString('es-AR')} kg</span>
                          ) : (
                            <span className="text-red-600">- {m.kg.toLocaleString('es-AR')} kg</span>
                          )}
                        </td>

                        <td className="py-3 px-3.5 text-right font-mono font-black text-slate-900 whitespace-nowrap">
                          {m.saldoResultante.toLocaleString('es-AR')} kg
                        </td>

                        <td className="py-3 px-3.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleAbrirEditarMovimiento(m)}
                              className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 hover:text-blue-900 rounded-lg border border-blue-200 transition cursor-pointer active:scale-95 inline-flex items-center gap-1 text-[11px] font-bold"
                              title="Editar este movimiento de silo"
                            >
                              <Edit className="w-3.5 h-3.5 text-blue-600" />
                              <span>Editar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setMovimientoAEliminar(m);
                                setClaveEliminar('');
                                setErrorEliminar('');
                              }}
                              className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 hover:text-red-900 rounded-lg border border-red-200 transition cursor-pointer active:scale-95 inline-flex items-center gap-1 text-[11px] font-bold"
                              title="Eliminar este movimiento de silo (Requiere usuario y clave de Amilcar Quiroz)"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-600" />
                              <span>Eliminar</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Modal Salida Manual de Silo */}
      {showModalSalidaManual && (() => {
        const stockActualSilo = getStockSilo(siloSalidaManual);
        const fichaSilo = getSiloFichaData(siloSalidaManual);
        const isDescontamActive = descontaminacionVarietal || motivoSalidaManual === 'Descarte' || motivoSalidaManual === 'Descontaminación varietal';

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
              
              {/* Header Modal */}
              <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 text-white px-6 py-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-white/10 rounded-xl text-amber-200">
                    <ArrowUpRight className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base font-serif flex items-center gap-2 text-white">
                      Generar Salida Manual de Silo
                    </h3>
                    <p className="text-[11px] text-amber-100 font-medium">
                      Descontar kilos del stock real ({siloSalidaManual})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModalSalidaManual(false)}
                  className="p-1.5 text-amber-100 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitSalidaManual} className="p-6 space-y-4 text-xs">
                {/* Banner e Info de Cereal Almacenado */}
                <div className="p-3.5 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 text-amber-950 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold border-b border-amber-200/80 pb-2">
                    <span className="flex items-center gap-1.5 text-amber-900">
                      <Warehouse className="w-4 h-4 text-amber-700" />
                      Silo Seleccionado: <strong className="text-amber-950 font-serif">{siloSalidaManual}</strong>
                    </span>
                    <span className="font-mono text-sm font-black text-amber-900 bg-white px-2.5 py-0.5 rounded-lg border border-amber-300 shadow-2xs">
                      {stockActualSilo.toLocaleString('es-AR')} kg
                    </span>
                  </div>

                  {/* Datos del Cereal y Cliente actual */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700 pt-0.5">
                    <div>
                      <span className="text-slate-500 block font-semibold text-[10px]">Cliente:</span>
                      <strong className="text-slate-900 font-bold">{fichaSilo.cliente}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block font-semibold text-[10px]">Especie / Variedad:</span>
                      <strong className="text-slate-900 font-bold">{fichaSilo.especie} {fichaSilo.variedad !== '-' ? `(${fichaSilo.variedad})` : ''}</strong>
                    </div>
                    {fichaSilo.categoria !== '-' && (
                      <div>
                        <span className="text-slate-500 block font-semibold text-[10px]">Categoría:</span>
                        <strong className="text-slate-800 font-bold">{fichaSilo.categoria}</strong>
                      </div>
                    )}
                    {fichaSilo.humedad !== '0.0' && (
                      <div>
                        <span className="text-slate-500 block font-semibold text-[10px]">Humedad Promedio:</span>
                        <strong className="text-blue-900 font-bold">{fichaSilo.humedad}%</strong>
                      </div>
                    )}
                  </div>
                </div>

                {errorSalidaManual && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{errorSalidaManual}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Selector Silo */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">
                      Silo de Origen *
                    </label>
                    <select
                      value={siloSalidaManual}
                      onChange={(e) => {
                        const newSilo = e.target.value as SiloId;
                        setSiloSalidaManual(newSilo);
                        const newStock = getStockSilo(newSilo);
                        if (descontaminacionVarietal || motivoSalidaManual === 'Descarte' || motivoSalidaManual === 'Descontaminación varietal') {
                          setKgSalidaManual(newStock > 0 ? newStock : '');
                        }
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                    >
                      {SILOS_DISPONIBLES.map((sId) => (
                        <option key={sId} value={sId}>{sId} ({getStockSilo(sId).toLocaleString('es-AR')} kg)</option>
                      ))}
                    </select>
                  </div>

                  {/* Fecha y Hora de Egreso */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">
                        Fecha de Egreso *
                      </label>
                      <input
                        type="date"
                        value={fechaSalidaManual}
                        onChange={(e) => setFechaSalidaManual(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">
                        Hora de Egreso *
                      </label>
                      <input
                        type="time"
                        value={horaSalidaManual}
                        onChange={(e) => setHoraSalidaManual(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Kilos a Descontar */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[10px] font-bold uppercase text-slate-700">
                        Cantidad a Descontar (kg) *
                      </label>
                      {stockActualSilo > 0 && (
                        <button
                          type="button"
                          onClick={() => setKgSalidaManual(stockActualSilo)}
                          className="text-[10px] font-extrabold text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200 transition cursor-pointer"
                          title="Cargar stock remanente total"
                        >
                          Remanente ({stockActualSilo.toLocaleString('es-AR')} kg)
                        </button>
                      )}
                    </div>
                    <input
                      type="number"
                      min={1}
                      max={stockActualSilo}
                      placeholder="ej: 5000"
                      value={kgSalidaManual}
                      onChange={(e) => setKgSalidaManual(e.target.value ? parseFloat(e.target.value) : '')}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                      required
                    />
                  </div>

                  {/* Motivo Obligatorio */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">
                      Motivo de Salida *
                    </label>
                    <select
                      value={motivoSalidaManual}
                      onChange={(e) => {
                        const newMotivo = e.target.value as MotivoSalidaManual;
                        setMotivoSalidaManual(newMotivo);
                        if (newMotivo === 'Descarte' || newMotivo === 'Descontaminación varietal') {
                          setDescontaminacionVarietal(true);
                          if (stockActualSilo > 0) setKgSalidaManual(stockActualSilo);
                        }
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                      required
                    >
                      <option value="Consumo a granel">Consumo a granel</option>
                      <option value="Manipulación">Manipulación</option>
                      <option value="Traslado a silo">Traslado a silo</option>
                      <option value="Descarte">Descarte</option>
                    </select>
                  </div>
                </div>

                {/* Checkbox Descarte / Limpieza de Silo */}
                <div className={`p-3.5 rounded-xl border transition ${
                  isDescontamActive
                    ? 'bg-purple-50/90 border-purple-300 shadow-2xs'
                    : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="descontaminacionVarietal"
                      checked={isDescontamActive}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setDescontaminacionVarietal(checked);
                        if (checked) {
                          setMotivoSalidaManual('Descarte');
                          if (stockActualSilo > 0) setKgSalidaManual(stockActualSilo);
                        } else {
                          if (motivoSalidaManual === 'Descarte' || motivoSalidaManual === 'Descontaminación varietal') {
                            setMotivoSalidaManual('Consumo a granel');
                          }
                        }
                      }}
                      className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer mt-0.5"
                    />
                    <label htmlFor="descontaminacionVarietal" className="text-xs font-bold text-slate-900 cursor-pointer select-none">
                      Descarte / Limpieza de Silo
                      <span className="block text-[11px] font-normal text-slate-600 mt-0.5">
                        Registra la salida por descarte del stock remanente ({stockActualSilo.toLocaleString('es-AR')} kg) asociado a <strong className="text-slate-900 font-semibold">{fichaSilo.cliente}</strong> — <strong className="text-slate-900 font-semibold">{fichaSilo.especie} ({fichaSilo.variedad})</strong>.
                      </span>
                    </label>
                  </div>
                </div>

                {/* Observaciones */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">
                    Observaciones / Comentarios Adicionales
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Detalles sobre el destino, operador, motivo..."
                    value={observacionesSalidaManual}
                    onChange={(e) => setObservacionesSalidaManual(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowModalSalidaManual(false)}
                    className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-100 transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <ArrowUpRight className="w-4 h-4 text-amber-200" />
                    <span>Registrar Salida Manual</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Modal Confirmación de Eliminación de Movimiento con Autorización */}
      {movimientoAEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="bg-gradient-to-r from-red-700 via-red-800 to-red-900 text-white px-6 py-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/10 rounded-xl text-red-200">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base font-serif text-white">
                    Eliminar Movimiento de Silo
                  </h3>
                  <p className="text-[11px] text-red-100 font-medium">
                    Operación restringida · Requiere clave de Amilcar Quiroz
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMovimientoAEliminar(null)}
                className="p-1.5 text-red-100 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* Resumen del movimiento */}
              <div className="p-3.5 bg-red-50 border border-red-200 text-slate-800 rounded-xl space-y-1">
                <div className="flex justify-between items-center font-bold text-slate-900">
                  <span>{movimientoAEliminar.siloId} · {movimientoAEliminar.tipo === 'INGRESO' ? 'Ingreso' : movimientoAEliminar.tipo === 'EGRESO_OP' ? 'Egreso OP' : 'Ajuste a Cero'}</span>
                  <span className="font-mono text-red-700 font-black">{movimientoAEliminar.kg.toLocaleString('es-AR')} kg</span>
                </div>
                <div className="text-[11px] text-slate-600 leading-tight">
                  Fecha: <strong>{movimientoAEliminar.fecha}</strong>
                  {movimientoAEliminar.cliente && ` · Cliente: ${movimientoAEliminar.cliente}`}
                  {movimientoAEliminar.especie && ` · Especie: ${movimientoAEliminar.especie}`}
                </div>
              </div>

              {errorEliminar && (
                <div className="p-3 bg-red-100 border border-red-300 text-red-900 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{errorEliminar}</span>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  Usuario Autorizador *
                </label>
                <input
                  type="text"
                  value={usuarioEliminar}
                  onChange={(e) => setUsuarioEliminar(e.target.value)}
                  placeholder="Amilcar Quiroz"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 text-xs focus:ring-2 focus:ring-red-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1 flex items-center gap-1">
                  <KeyRound className="w-3.5 h-3.5 text-red-600" />
                  Contraseña / Clave de Autorización *
                </label>
                <input
                  type="password"
                  placeholder="Ingrese clave del usuario Amilcar Quiroz..."
                  value={claveEliminar}
                  onChange={(e) => setClaveEliminar(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-slate-900 text-xs focus:ring-2 focus:ring-red-500 outline-none shadow-xs"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMovimientoAEliminar(null)}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmEliminarMovimiento}
                className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Trash2 className="w-4 h-4 text-red-200" />
                <span>Confirmar y Eliminar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Movimiento de Silo */}
      {movimientoAEditar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 text-white px-6 py-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/10 rounded-xl text-blue-200">
                  <Edit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base font-serif text-white">
                    Editar Movimiento de Silo
                  </h3>
                  <p className="text-[11px] text-blue-100 font-medium">
                    Modifique cualquier parámetro registrado para este movimiento
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMovimientoAEditar(null)}
                className="p-1.5 text-blue-100 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selector ON/OFF Ingreso vs Egreso */}
            <div className="px-6 pt-4 pb-1">
              <div className="bg-slate-100 p-1.5 rounded-xl border border-slate-200 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setEditTipoCategoria('INGRESO')}
                  className={`flex-1 py-2 px-3 text-xs font-black uppercase tracking-wider rounded-lg transition flex items-center justify-center gap-2 cursor-pointer ${
                    editTipoCategoria === 'INGRESO'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <ArrowDownRight className="w-4 h-4" />
                  <span>Ingreso</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditTipoCategoria('EGRESO');
                    if (editMotivoEgreso === 'DESCARTE') {
                      const rem = getSiloActiveData(editSiloId, movimientosSilo).stockKg;
                      if (rem > 0) setEditKg(rem);
                    }
                  }}
                  className={`flex-1 py-2 px-3 text-xs font-black uppercase tracking-wider rounded-lg transition flex items-center justify-center gap-2 cursor-pointer ${
                    editTipoCategoria === 'EGRESO'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>Egreso</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleGuardarEdicionMovimiento} className="p-6 pt-3 space-y-4 text-xs">
              {/* CASO INGRESO */}
              {editTipoCategoria === 'INGRESO' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {/* Silo */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">Silo *</label>
                    <select
                      value={editSiloId}
                      onChange={(e) => setEditSiloId(e.target.value as SiloId)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                      required
                    >
                      {SILOS_DISPONIBLES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  {/* Fecha y Hora de Ingreso */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">Fecha de Ingreso *</label>
                      <input
                        type="date"
                        value={editFecha}
                        onChange={(e) => setEditFecha(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">Hora de Ingreso *</label>
                      <input
                        type="time"
                        value={editHora}
                        onChange={(e) => setEditHora(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                        required
                      />
                    </div>
                  </div>

                  {/* Kilogramos */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">Kilogramos (kg) *</label>
                    <input
                      type="number"
                      step="any"
                      value={editKg}
                      onChange={(e) => setEditKg(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                      required
                    />
                  </div>

                  {/* Cliente */}
                  <div className="col-span-1 sm:col-span-2">
                    <ClienteSelect
                      value={editCliente}
                      onChange={setEditCliente}
                      label="Cliente *"
                    />
                  </div>

                  {/* Especie */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">Especie</label>
                    <input
                      type="text"
                      value={editEspecie}
                      onChange={(e) => setEditEspecie(e.target.value)}
                      placeholder="Soja, Trigo..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  {/* Variedad */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">Variedad</label>
                    <input
                      type="text"
                      value={editVariedad}
                      onChange={(e) => setEditVariedad(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  {/* Categoría */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">Categoría</label>
                    <select
                      value={editCategoria}
                      onChange={(e) => setEditCategoria(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      {CATEGORIAS_OFICIALES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* Humedad */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">% Humedad</label>
                    <input
                      type="number"
                      step="0.1"
                      value={editHumedad}
                      onChange={(e) => setEditHumedad(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  {/* Campo Origen */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">Campo Origen</label>
                    <input
                      type="text"
                      value={editCampoOrigen}
                      onChange={(e) => setEditCampoOrigen(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  {/* Bolsón N° */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">Bolsón N°</label>
                    <input
                      type="text"
                      value={editBolsonOrigenNro}
                      onChange={(e) => setEditBolsonOrigenNro(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  {/* Sector Bolsón */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">Sector Bolsón</label>
                    <select
                      value={editBolsonOrigenSector}
                      onChange={(e) => setEditBolsonOrigenSector(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="">Sin Sector...</option>
                      {SECTORES_BOLSON_OPCIONES.map((sec) => (
                        <option key={sec} value={sec}>{sec}</option>
                      ))}
                    </select>
                  </div>

                  {/* Depósito Origen */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">Depósito Origen</label>
                    <input
                      type="text"
                      value={editDepositoOrigen}
                      onChange={(e) => setEditDepositoOrigen(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  {/* Chofer */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">Chofer</label>
                    <input
                      type="text"
                      value={editChofer}
                      onChange={(e) => setEditChofer(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  {/* CUIT Chofer */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">CUIT Chofer</label>
                    <input
                      type="text"
                      value={editCuit}
                      onChange={(e) => setEditCuit(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  {/* Patente(s) */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">Patentes</label>
                    <input
                      type="text"
                      value={editPatentes}
                      onChange={(e) => setEditPatentes(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 text-xs focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                    />
                  </div>

                  {/* Transporte */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">Empresa Transporte</label>
                    <input
                      type="text"
                      value={editTransporte}
                      onChange={(e) => setEditTransporte(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  {/* Orden de Proceso - Dato Informativo */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">
                      N° Orden de Proceso <span className="text-slate-400 font-normal lowercase">(solo informativo)</span>
                    </label>
                    <input
                      type="text"
                      value={editNumeroOrdenProceso}
                      onChange={(e) => setEditNumeroOrdenProceso(e.target.value)}
                      placeholder="ej: OP-102"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-700 text-xs focus:ring-2 focus:ring-slate-400 outline-none"
                    />
                  </div>
                </div>
              ) : (
                /* CASO EGRESO */
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Silo */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">Silo *</label>
                      <select
                        value={editSiloId}
                        onChange={(e) => {
                          const newSilo = e.target.value as SiloId;
                          setEditSiloId(newSilo);
                          if (editMotivoEgreso === 'DESCARTE') {
                            const rem = getSiloActiveData(newSilo, movimientosSilo).stockKg;
                            if (rem > 0) setEditKg(rem);
                          }
                        }}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                        required
                      >
                        {SILOS_DISPONIBLES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                    {/* Fecha y Hora de Egreso */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">Fecha de Egreso *</label>
                        <input
                          type="date"
                          value={editFecha}
                          onChange={(e) => setEditFecha(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">Hora de Egreso *</label>
                        <input
                          type="time"
                          value={editHora}
                          onChange={(e) => setEditHora(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Selector de Motivo de Egreso: Únicamente Egreso por Lote o Descarte */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                    <label className="block text-[10px] font-bold uppercase text-slate-700 tracking-wider">
                      Motivo de Egreso *
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setEditMotivoEgreso('EGRESO_LOTE')}
                        className={`p-3 rounded-xl border text-left transition flex items-center gap-2.5 cursor-pointer ${
                          editMotivoEgreso === 'EGRESO_LOTE'
                            ? 'bg-amber-50 border-amber-400 text-amber-950 font-bold shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 font-medium'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          editMotivoEgreso === 'EGRESO_LOTE' ? 'border-amber-600 bg-amber-600' : 'border-slate-400'
                        }`}>
                          {editMotivoEgreso === 'EGRESO_LOTE' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <div>
                          <p className="text-xs font-bold">Egreso por lote</p>
                          <p className="text-[10px] text-slate-500 font-normal">Requiere N° de Lote y Kilos descontados</p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditMotivoEgreso('DESCARTE');
                          const rem = getSiloActiveData(editSiloId, movimientosSilo).stockKg;
                          if (rem > 0) setEditKg(rem);
                        }}
                        className={`p-3 rounded-xl border text-left transition flex items-center gap-2.5 cursor-pointer ${
                          editMotivoEgreso === 'DESCARTE'
                            ? 'bg-red-50 border-red-400 text-red-950 font-bold shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 font-medium'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          editMotivoEgreso === 'DESCARTE' ? 'border-red-600 bg-red-600' : 'border-slate-400'
                        }`}>
                          {editMotivoEgreso === 'DESCARTE' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-red-900">Descarte</p>
                          <p className="text-[10px] text-red-700/80 font-normal">Lleva el stock remanente del silo a cero</p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Campos según Motivo de Egreso */}
                  {editMotivoEgreso === 'DESCARTE' ? (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-1 text-red-900">
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                        <span>Descarte / Limpieza de Silo</span>
                      </div>
                      <p className="text-[11px] text-red-800 font-medium">
                        Lleva el stock remanente de {editSiloId} a cero ({formatKg(getSiloActiveData(editSiloId, movimientosSilo).stockKg)} kg).
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl">
                      {/* N° de lote */}
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-amber-900 mb-1">
                          N° de Lote *
                        </label>
                        <input
                          type="text"
                          value={editLoteNro}
                          onChange={(e) => setEditLoteNro(e.target.value)}
                          placeholder="ej: LOT-2026-001"
                          className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl font-bold font-mono text-slate-900 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                          required
                        />
                      </div>

                      {/* Kilos totales descontados del silo por ese lote realizado */}
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-amber-900 mb-1">
                          Kilos totales descontados del silo *
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={editKg}
                          onChange={(e) => setEditKg(e.target.value === '' ? '' : Number(e.target.value))}
                          placeholder="ej: 25000"
                          className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl font-bold font-mono text-slate-900 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                          required
                        />
                      </div>
                    </div>
                  )}

                  {/* Orden de Proceso - Dato solo Informativo */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">
                      N° Orden de Proceso <span className="text-slate-400 font-normal lowercase">(solo informativo)</span>
                    </label>
                    <input
                      type="text"
                      value={editNumeroOrdenProceso}
                      onChange={(e) => setEditNumeroOrdenProceso(e.target.value)}
                      placeholder="ej: OP-102"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-700 text-xs focus:ring-2 focus:ring-slate-400 outline-none"
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">Dato informativo: no modifica stocks del silo.</p>
                  </div>
                </div>
              )}

              {/* Observaciones */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">Observaciones</label>
                <textarea
                  value={editObservaciones}
                  onChange={(e) => setEditObservaciones(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="bg-slate-50 -mx-6 -mb-6 px-6 py-3.5 border-t border-slate-200 flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setMovimientoAEditar(null)}
                  className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>Guardar Cambios</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Ficha Técnica Oficial de Silo (Individual) */}
      {fichaModalSilo && (
        <FichaTecnicaSiloModal
          ficha={getSiloFichaData(fichaModalSilo)}
          onClose={() => setFichaModalSilo(null)}
        />
      )}

      {/* Modal Grilla de 6 Fichas Técnicas en 1 Hoja A4 */}
      {showGrillaSeisSilos && (
        <GrillaSeisSilosModal
          fichas={SILOS_DISPONIBLES.map((s) => getSiloFichaData(s))}
          onClose={() => setShowGrillaSeisSilos(false)}
        />
      )}

      {/* PANEL LATERAL (DRAWER) - HISTORIAL DETALLADO DE MOVIMIENTOS DEL SILO */}
      {drawerSilo && (() => {
        const siloStock = getStockSilo(drawerSilo);
        const siloFicha = getSiloFichaData(drawerSilo);
        
        // Todos los movimientos de este silo
        const todosMovimientos = movimientosSilo
          .filter((m) => m.siloId === drawerSilo)
          .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

        // Usar acumulados solo de la especie/variedad activa en stock (o 0 si está vacío)
        const totalKgIngresados = siloFicha.totalKgIngresados;
        const totalKgEgresados = siloFicha.totalKgEgresados;

        // Filtrar por tipo y búsqueda
        const movimientosFiltrados = todosMovimientos.filter((m) => {
          if (drawerFilterTipo !== 'TODOS' && m.tipo !== drawerFilterTipo) return false;
          if (drawerSearch.trim() !== '') {
            const query = drawerSearch.toLowerCase();
            const matchCliente = m.cliente?.toLowerCase().includes(query);
            const matchEspecie = m.especie?.toLowerCase().includes(query);
            const matchVariedad = m.variedad?.toLowerCase().includes(query);
            const matchLote = m.loteNro?.toLowerCase().includes(query) || m.loteResultanteId?.toLowerCase().includes(query) || m.loteId?.toLowerCase().includes(query);
            const matchOrigen = m.campoOrigen?.toLowerCase().includes(query) || m.depositoOrigen?.toLowerCase().includes(query) || m.bolsonOrigenNro?.toLowerCase().includes(query);
            const matchMotivo = m.motivoAjuste?.toLowerCase().includes(query) || m.motivoZero?.toLowerCase().includes(query);
            const matchFecha = m.fecha.includes(query);
            return Boolean(matchCliente || matchEspecie || matchVariedad || matchLote || matchOrigen || matchMotivo || matchFecha);
          }
          return true;
        });

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex justify-end animate-in fade-in duration-200">
            {/* Backdrop click to close */}
            <div 
              className="absolute inset-0 cursor-pointer" 
              onClick={() => setDrawerSilo(null)}
              title="Hacer clic para cerrar el panel lateral"
            />

            {/* Panel Lateral Drawer */}
            <div className="relative w-full max-w-xl bg-slate-50 h-full shadow-2xl flex flex-col z-10 border-l border-slate-200 overflow-hidden animate-in slide-in-from-right duration-300">
              
              {/* Encabezado del Panel Lateral */}
              <div className="bg-slate-900 text-white p-5 border-b border-slate-800 flex items-center justify-between shrink-0 shadow-md">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-950/80 border border-emerald-500/40 rounded-xl flex items-center justify-center">
                    <SiloIcon size={24} color="#00603C" className="silo-icon-institucional shrink-0" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-serif font-black text-white">{drawerSilo}</h2>
                      <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-800 text-emerald-200 border border-emerald-600">
                        Historial de Movimientos
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Trazabilidad completa e ingresos/egresos en tiempo real
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setDrawerSilo(null)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
                  title="Cerrar panel lateral"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tarjeta Resumen de Estado del Silo */}
              <div className="p-4 bg-white border-b border-slate-200 shrink-0 space-y-3">
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">Stock Actual</span>
                    <span className="text-lg font-black font-mono text-slate-900">
                      {siloStock.toLocaleString('es-AR')} <span className="text-xs text-slate-500 font-sans">kg</span>
                    </span>
                    <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">
                      {(siloStock / 1000).toFixed(1)} Tn ({((siloStock / CAPACIDAD_MAX_SILO) * 100).toFixed(1)}%)
                    </span>
                  </div>

                  <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/80 text-center">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-800 block">Total Ingresado</span>
                    <span className="text-lg font-black font-mono text-emerald-800">
                      +{totalKgIngresados.toLocaleString('es-AR')} <span className="text-xs text-emerald-700 font-sans">kg</span>
                    </span>
                    <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">
                      {(totalKgIngresados / 1000).toFixed(1)} Tn acumuladas
                    </span>
                  </div>

                  <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/80 text-center">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-amber-900 block">Total Egresado</span>
                    <span className="text-lg font-black font-mono text-amber-900">
                      -{totalKgEgresados.toLocaleString('es-AR')} <span className="text-xs text-amber-800 font-sans">kg</span>
                    </span>
                    <span className="text-[10px] text-amber-800 font-bold block mt-0.5">
                      {(totalKgEgresados / 1000).toFixed(1)} Tn extraídas
                    </span>
                  </div>
                </div>

                {/* Resumen Cereal Almacenado */}
                <div className="p-2.5 bg-slate-100 rounded-xl text-xs flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-700">Contenido:</span>
                    <span className="font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200">
                      {siloFicha.especie}
                    </span>
                    <span className="text-slate-600 font-medium">({siloFicha.variedad})</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <span>Cliente: <strong className="text-slate-800">{siloFicha.cliente}</strong></span>
                    <span>· Humedad: <strong className="text-blue-800">{siloFicha.humedad}%</strong></span>
                  </div>
                </div>
              </div>

              {/* Filtros de Tipo y Búsqueda */}
              <div className="p-4 bg-slate-100/80 border-b border-slate-200 space-y-3 shrink-0">
                {/* Selector de Tipo */}
                <div className="flex items-center gap-1.5 p-1 bg-slate-200/80 rounded-xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setDrawerFilterTipo('TODOS')}
                    className={`flex-1 py-1.5 px-2 rounded-lg transition cursor-pointer ${
                      drawerFilterTipo === 'TODOS'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    Todos ({todosMovimientos.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setDrawerFilterTipo('INGRESO')}
                    className={`flex-1 py-1.5 px-2 rounded-lg transition flex items-center justify-center gap-1 cursor-pointer ${
                      drawerFilterTipo === 'INGRESO'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    <ArrowDownRight className="w-3.5 h-3.5" />
                    Ingresos
                  </button>

                  <button
                    type="button"
                    onClick={() => setDrawerFilterTipo('EGRESO_OP')}
                    className={`flex-1 py-1.5 px-2 rounded-lg transition flex items-center justify-center gap-1 cursor-pointer ${
                      drawerFilterTipo === 'EGRESO_OP'
                        ? 'bg-amber-700 text-white shadow-xs'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    Egresos OP
                  </button>

                  <button
                    type="button"
                    onClick={() => setDrawerFilterTipo('AJUSTE_ZERO')}
                    className={`flex-1 py-1.5 px-2 rounded-lg transition flex items-center justify-center gap-1 cursor-pointer ${
                      drawerFilterTipo === 'AJUSTE_ZERO'
                        ? 'bg-red-700 text-white shadow-xs'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Ajustes
                  </button>
                </div>

                {/* Input Búsqueda */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={drawerSearch}
                    onChange={(e) => setDrawerSearch(e.target.value)}
                    placeholder="Buscar por cliente, OP, especie, variedad, origen o fecha..."
                    className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                  {drawerSearch && (
                    <button
                      type="button"
                      onClick={() => setDrawerSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Lista Scrollable de Movimientos */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {movimientosFiltrados.length === 0 ? (
                  <div className="text-center py-12 px-4 bg-white rounded-2xl border border-dashed border-slate-300">
                    <History className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <h3 className="text-sm font-bold text-slate-700">Sin movimientos registrados</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                      {drawerSearch || drawerFilterTipo !== 'TODOS'
                        ? 'No se encontraron registros coincidentes con los filtros aplicados.'
                        : `Aún no se han registrado ingresos ni egresos para ${drawerSilo}.`}
                    </p>
                  </div>
                ) : (
                  movimientosFiltrados.map((mov) => {
                    const isIngreso = mov.tipo === 'INGRESO';
                    const isEgresoOP = mov.tipo === 'EGRESO_OP';
                    const isEgresoManual = mov.tipo === 'EGRESO_MANUAL';
                    const isEgreso = isEgresoOP || isEgresoManual;
                    const isAjuste = mov.tipo === 'AJUSTE_ZERO';

                    return (
                      <div
                        key={mov.id}
                        className={`p-4 rounded-2xl border shadow-2xs transition hover:shadow-md ${
                          isIngreso
                            ? 'bg-white border-emerald-200/90 hover:border-emerald-300'
                            : isEgreso
                            ? 'bg-white border-amber-200/90 hover:border-amber-300'
                            : 'bg-white border-red-200/90 hover:border-red-300'
                        }`}
                      >
                        {/* Cabecera del Movimiento */}
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-2.5">
                          <div className="flex items-center gap-2">
                            {isIngreso && (
                              <span className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg flex items-center gap-1 text-xs font-black">
                                <ArrowDownRight className="w-4 h-4 text-emerald-600" />
                                INGRESO ACOPIO
                              </span>
                            )}
                            {isEgresoOP && (
                              <span className="p-1.5 bg-amber-100 text-amber-900 rounded-lg flex items-center gap-1 text-xs font-black">
                                <ArrowUpRight className="w-4 h-4 text-amber-700" />
                                EGRESO A OP
                              </span>
                            )}
                            {isEgresoManual && (
                              <span className="p-1.5 bg-amber-100 text-amber-900 rounded-lg flex items-center gap-1 text-xs font-black">
                                <ArrowUpRight className="w-4 h-4 text-amber-700" />
                                SALIDA MANUAL
                              </span>
                            )}
                            {isAjuste && (
                              <span className="p-1.5 bg-red-100 text-red-900 rounded-lg flex items-center gap-1 text-xs font-black">
                                <RotateCcw className="w-4 h-4 text-red-700" />
                                AJUSTE A CERO
                              </span>
                            )}

                            <span className="text-xs text-slate-500 font-mono font-medium flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              {mov.fecha}
                              {mov.hora && <span className="text-[10px] text-slate-400 font-normal">({mov.hora} hs)</span>}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className={`text-base font-black font-mono ${
                              isIngreso ? 'text-emerald-700' : isEgreso ? 'text-amber-800' : 'text-red-700'
                            }`}>
                              {isIngreso ? `+${mov.kg.toLocaleString('es-AR')}` : isEgreso ? `-${mov.kg.toLocaleString('es-AR')}` : `0`} kg
                            </span>
                            <button
                              type="button"
                              onClick={() => handleAbrirEditarMovimiento(mov)}
                              className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 hover:text-blue-900 rounded-lg border border-blue-200 transition cursor-pointer active:scale-95 ml-1"
                              title="Editar este movimiento de silo"
                            >
                              <Edit className="w-3.5 h-3.5 text-blue-600" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setMovimientoAEliminar(mov);
                                setClaveEliminar('');
                                setErrorEliminar('');
                              }}
                              className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 hover:text-red-900 rounded-lg border border-red-200 transition cursor-pointer active:scale-95"
                              title="Eliminar este movimiento de silo"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-600" />
                            </button>
                          </div>
                        </div>

                        {/* Detalles según el tipo */}
                        {isIngreso && (
                          <div className="space-y-1.5 text-xs">
                            <div className="flex items-center justify-between text-slate-800 font-bold">
                              <span>{mov.cliente || 'San Diego Semilla'}</span>
                              <span className="text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                                {mov.especie || 'Soja'} · {mov.variedad || 'P46A03'} ({mov.categoria || 'Fundadora'})
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-slate-600 text-[11px] pt-1">
                              <div>
                                <span className="font-semibold text-slate-500 block">Origen:</span>
                                <span>{mov.campoOrigen || 'La Barrancosa'} {mov.bolsonOrigenNro ? `· Bolsón ${mov.bolsonOrigenNro}` : ''}</span>
                              </div>
                              <div>
                                <span className="font-semibold text-slate-500 block">% Humedad:</span>
                                <span className="font-bold text-blue-800">{mov.humedad !== undefined ? `${mov.humedad}%` : '13.5%'}</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {isEgresoOP && (
                          <div className="space-y-1.5 text-xs">
                            <div className="flex items-center justify-between text-slate-800 font-bold">
                              <span>Salida por Lote: <strong className="font-mono text-amber-900">{mov.loteNro || mov.loteResultanteId || mov.loteId || 'S/N'}</strong></span>
                            </div>
                            <p className="text-[11px] text-slate-600">
                              Cliente: <strong>{mov.cliente || 'San Diego Semilla'}</strong> · Cereal: {mov.especie || 'Soja'} {mov.variedad ? `(${mov.variedad})` : ''}
                            </p>
                          </div>
                        )}

                        {isEgresoManual && (
                          <div className="space-y-1.5 text-xs">
                            <div className="flex items-center justify-between text-slate-800 font-bold">
                              <span>Motivo: <strong className="text-amber-900">{mov.motivoManual || 'Manual'}</strong></span>
                              {mov.descontaminacionVarietal && (
                                <span className="text-purple-900 bg-purple-100 px-2 py-0.5 rounded border border-purple-300 text-[10px] font-extrabold">
                                  Descarte
                                </span>
                              )}
                            </div>
                            {(mov.cliente || mov.especie || mov.variedad) && (
                              <p className="text-[11px] text-slate-700 font-medium">
                                Cliente: <strong className="text-slate-900">{mov.cliente || '-'}</strong> · Especie: <strong className="text-slate-900">{mov.especie || '-'}</strong> ({mov.variedad || '-'})
                              </p>
                            )}
                            {mov.observaciones && (
                              <p className="text-[10px] text-slate-500 italic">
                                Obs: {mov.observaciones}
                              </p>
                            )}
                          </div>
                        )}

                        {isAjuste && (
                          <div className="space-y-1 text-xs text-slate-700">
                            <p>
                              <strong>Motivo:</strong> {mov.motivoAjuste || mov.motivoZero || 'Ajuste manual de stock por limpieza / mermas.'}
                            </p>
                            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                              <span>Stock previo: <strong>{mov.kgAntesAjuste ? mov.kgAntesAjuste.toLocaleString('es-AR') : '0'} kg</strong></span>
                              <span>Usuario: <strong>{mov.usuario || mov.usuarioZero || 'Operario de Planta'}</strong></span>
                            </div>
                          </div>
                        )}

                      </div>
                    );
                  })
                )}
              </div>

              {/* Pie del Panel Lateral */}
              <div className="p-4 bg-white border-t border-slate-200 shrink-0 flex items-center justify-between gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    openFichaModal(drawerSilo);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
                >
                  <Eye className="w-4 h-4 text-emerald-300" />
                  <span>Ver Ficha</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (drawerSilo) openModalSalidaManual(drawerSilo);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
                  title="Generar Salida Manual de Silo"
                >
                  <ArrowUpRight className="w-3.5 h-3.5 text-amber-200" />
                  <span>Salida Manual</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExportFichaCSV(siloFicha)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
                >
                  <Download className="w-4 h-4 text-slate-600" />
                  <span>Exportar CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDrawerSilo(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer"
                >
                  Cerrar
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* MODAL DE CONFIRMACIÓN DE LIMPIEZA DE DESCARTE DE SILO */}
      {siloLimpiezaTarget && (() => {
        const targetFicha = getSiloFichaData(siloLimpiezaTarget);
        return (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-amber-900 font-black text-lg font-serif">
                  <RotateCcw className="w-5 h-5 text-amber-600" />
                  <span>Limpieza de Descarte — {siloLimpiezaTarget}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSiloLimpiezaTarget(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-950 space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Confirmar Vaciamiento y Descarte de Silo</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-900/90">
                  Esta acción ejecutará la <strong>Limpieza de Descarte</strong> en <strong className="font-bold">{siloLimpiezaTarget}</strong>:
                </p>
                <ul className="list-disc list-inside text-[11px] space-y-1 font-medium text-amber-900">
                  <li>Pondrá el stock remanente en <strong>0 kg</strong> (Actual: {targetFicha.stockKg.toLocaleString('es-AR')} kg).</li>
                  <li>Eliminará la asociación actual de <strong>Especie ({targetFicha.especie})</strong>, <strong>Variedad ({targetFicha.variedad})</strong>, <strong>Cliente ({targetFicha.cliente})</strong> y <strong>Bolsón de Origen</strong>.</li>
                  <li>Dejará el silo en estado <strong>Vacío / Disponible</strong> para una nueva carga.</li>
                </ul>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">
                    Fecha de Limpieza *
                  </label>
                  <input
                    type="date"
                    value={limpiezaFecha}
                    onChange={(e) => setLimpiezaFecha(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">
                    Usuario Responsable *
                  </label>
                  <input
                    type="text"
                    value={limpiezaUsuario}
                    onChange={(e) => setLimpiezaUsuario(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-sans text-slate-900 font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">
                    Motivo / Observaciones *
                  </label>
                  <input
                    type="text"
                    value={limpiezaMotivo}
                    onChange={(e) => setLimpiezaMotivo(e.target.value)}
                    placeholder="Ej: Limpieza de descarte - Cambio de variedad en silo"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-sans text-slate-900 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              {limpiezaError && (
                <p className="text-red-600 text-xs font-bold">{limpiezaError}</p>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSiloLimpiezaTarget(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmLimpiezaVarietal}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <RotateCcw className="w-4 h-4 text-amber-200" />
                  <span>Ejecutar Limpieza de Descarte</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};
