/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Lote, ReporteDiario, PlantaConfig } from '../types';
import { formatKg } from '../utils/formatters';
import { normalizarTratamiento, normalizarEnvase, normalizarCategoria, normalizarTipo, normalizarEstado } from '../utils/loteEspecUtils';
import {
  Factory,
  Layers,
  Calendar,
  Filter,
  Download,
  Search,
  Scale,
  FlaskConical,
  Package,
  TrendingUp,
  BarChart2,
  PieChart,
  CheckCircle2,
  Clock,
  Building2,
  Tag
} from 'lucide-react';
import { CargaReporteDiario } from './CargaReporteDiario';

interface ReportesEspecDashboardProps {
  lotes: Lote[];
  reportesDiarios: ReporteDiario[];
  currentUser: { nombre: string; rol: string };
  plantaConfig?: PlantaConfig;
  onGuardarReporte: (reporte: Omit<ReporteDiario, 'id'>, extras?: any) => Promise<void> | void;
  onSelectLote?: (lote: Lote) => void;
}

export const ReportesEspecDashboard: React.FC<ReportesEspecDashboardProps> = ({
  lotes,
  reportesDiarios,
  currentUser,
  plantaConfig,
  onGuardarReporte,
  onSelectLote,
}) => {
  // Pestaña principal: por defecto 'carga' como pantalla principal
  const [activeTab, setActiveTab] = useState<'produccion' | 'existencia' | 'carga'>('carga');

  // =========================================================================
  // SECCIÓN 1: REPORTE DE PRODUCCIÓN (DÍA, SEMANA, MES)
  // Calculado SOLO desde reportes_diarios (tipo produccion y curado).
  // No lee los kg de los lotes, ni movimientos, ni despachos.
  // =========================================================================
  const [temporalidad, setTemporalidad] = useState<'dia' | 'semana' | 'mes' | 'todos'>('todos');
  const [filtroTipoReporte, setFiltroTipoReporte] = useState<'todos' | 'produccion' | 'curado'>('todos');
  const [busquedaProduccion, setBusquedaProduccion] = useState('');

  // Fechas de corte para semana y mes actual
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const weekAgoStr = oneWeekAgo.toISOString().split('T')[0];

  const oneMonthAgo = new Date();
  oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
  const monthAgoStr = oneMonthAgo.toISOString().split('T')[0];

  const reportesFiltrados = useMemo(() => {
    return reportesDiarios.filter((rep) => {
      // Filtro tipo
      if (filtroTipoReporte !== 'todos' && rep.tipo !== filtroTipoReporte) return false;

      // Filtro temporal
      if (temporalidad === 'dia' && rep.fecha !== todayStr) return false;
      if (temporalidad === 'semana' && rep.fecha < weekAgoStr) return false;
      if (temporalidad === 'mes' && rep.fecha < monthAgoStr) return false;

      // Búsqueda
      if (busquedaProduccion.trim()) {
        const q = busquedaProduccion.toLowerCase();
        const codigo = (rep.codigoLote || '').toLowerCase();
        const cliente = (rep.cliente || '').toLowerCase();
        const variedad = (rep.variedad || '').toLowerCase();
        if (!codigo.includes(q) && !cliente.includes(q) && !variedad.includes(q)) return false;
      }

      return true;
    }).sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [reportesDiarios, temporalidad, filtroTipoReporte, busquedaProduccion, todayStr, weekAgoStr, monthAgoStr]);

  const totalKgProducidos = useMemo(() => {
    return reportesFiltrados
      .filter((r) => r.tipo === 'produccion')
      .reduce((acc, r) => acc + (Number(r.kg) || 0), 0);
  }, [reportesFiltrados]);

  const totalKgCurados = useMemo(() => {
    return reportesFiltrados
      .filter((r) => r.tipo === 'curado')
      .reduce((acc, r) => acc + (Number(r.kg) || 0), 0);
  }, [reportesFiltrados]);

  // =========================================================================
  // SECCIÓN 2: REPORTE DE EXISTENCIA
  // Calculado desde los lotes activos (hojas del árbol, excluyendo precarga,
  // desdoblado y agotado). Bloqueado cuenta en existencia pero no está disponible.
  // Filtros: estado, tratamiento, envase, categoría, tipo, cliente.
  // Saldo pendiente de curar.
  // =========================================================================
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [filtroTratamiento, setFiltroTratamiento] = useState<string>('todos');
  const [filtroEnvase, setFiltroEnvase] = useState<string>('todos');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todos');
  const [filtroTipoLote, setFiltroTipoLote] = useState<string>('todos');
  const [filtroCliente, setFiltroCliente] = useState<string>('todos');
  const [busquedaExistencia, setBusquedaExistencia] = useState('');

  // Obtener lotes hojas que integran el Reporte de Existencia
  const lotesExistencia = useMemo(() => {
    // 1. Identificar IDs de padres que tienen hijos en la lista (para asegurar hojas)
    const setPadresIds = new Set<string>();
    lotes.forEach((l) => {
      if (l.padreId) setPadresIds.add(l.padreId);
    });

    return lotes.filter((l) => {
      // Activo debe ser true (o no especificado false)
      if (l.activo === false) return false;

      const estado = normalizarEstado(l.estadoEspec || l.estado, l.estadoRegistro);
      // Excluir 'precarga', 'desdoblado' y 'agotado'
      if (estado === 'precarga' || estado === 'desdoblado' || estado === 'agotado') {
        return false;
      }

      // Si este lote tiene hijos registrados en el árbol, no es hoja
      if (setPadresIds.has(l.id)) {
        return false;
      }

      // Stock mayor a cero
      const stockKg = Number(l.kg) || Number(l.stockKg) || ((Number(l.cantidadBolsas) || Number(l.stockBolsas) || 0) * (l.kgPorBolsa || 800));
      if (stockKg <= 0) return false;

      return true;
    });
  }, [lotes]);

  // Aplicar filtros de existencia
  const lotesExistenciaFiltrados = useMemo(() => {
    return lotesExistencia.filter((l) => {
      const estado = normalizarEstado(l.estadoEspec || l.estado, l.estadoRegistro);
      const trat = normalizarTratamiento(l.tratamiento);
      const env = normalizarEnvase(l.envase || l.kgPorBolsa);
      const cat = normalizarCategoria(l.categoria);
      const tip = normalizarTipo(l.tipo);

      if (filtroEstado !== 'todos' && estado !== filtroEstado) return false;
      if (filtroTratamiento !== 'todos' && trat !== filtroTratamiento) return false;
      if (filtroEnvase !== 'todos' && env !== filtroEnvase) return false;
      if (filtroCategoria !== 'todos' && cat !== filtroCategoria) return false;
      if (filtroTipoLote !== 'todos' && tip !== filtroTipoLote) return false;
      if (filtroCliente !== 'todos' && l.cliente !== filtroCliente) return false;

      if (busquedaExistencia.trim()) {
        const q = busquedaExistencia.toLowerCase();
        const cod = (l.codigo || l.loteNro || '').toLowerCase();
        const cli = (l.cliente || '').toLowerCase();
        const varN = (l.variedad || '').toLowerCase();
        if (!cod.includes(q) && !cli.includes(q) && !varN.includes(q)) return false;
      }

      return true;
    });
  }, [lotesExistencia, filtroEstado, filtroTratamiento, filtroEnvase, filtroCategoria, filtroTipoLote, filtroCliente, busquedaExistencia]);

  // Métricas de existencia
  const totalExistenciaKg = useMemo(() => {
    return lotesExistenciaFiltrados.reduce((acc, l) => {
      const kg = Number(l.kg) || Number(l.stockKg) || ((Number(l.cantidadBolsas) || Number(l.stockBolsas) || 0) * (l.kgPorBolsa || 800));
      return acc + kg;
    }, 0);
  }, [lotesExistenciaFiltrados]);

  // Bloqueado cuenta en existencia pero NO está disponible
  const stockBloqueadoKg = useMemo(() => {
    return lotesExistenciaFiltrados
      .filter((l) => normalizarEstado(l.estadoEspec || l.estado, l.estadoRegistro) === 'bloqueado')
      .reduce((acc, l) => acc + (Number(l.kg) || Number(l.stockKg) || 0), 0);
  }, [lotesExistenciaFiltrados]);

  const stockDisponibleKg = Math.max(0, totalExistenciaKg - stockBloqueadoKg);

  // Saldo pendiente de curar: suma de lotes en existencia con tratamiento 'crudo'
  const saldoPendienteCurarKg = useMemo(() => {
    return lotesExistenciaFiltrados
      .filter((l) => normalizarTratamiento(l.tratamiento) === 'crudo')
      .reduce((acc, l) => {
        const kg = Number(l.kg) || Number(l.stockKg) || ((Number(l.cantidadBolsas) || Number(l.stockBolsas) || 0) * (l.kgPorBolsa || 800));
        return acc + kg;
      }, 0);
  }, [lotesExistenciaFiltrados]);

  // Lista única de clientes de lotes en existencia
  const clientesExistencia = useMemo(() => {
    return Array.from(new Set(lotesExistencia.map((l) => l.cliente).filter(Boolean))).sort();
  }, [lotesExistencia]);

  return (
    <div className="space-y-6 text-left animate-in fade-in duration-200">
      {/* Banner Superior con Tabs */}
      <div className="bg-gradient-to-r from-emerald-950 via-[#00603C] to-slate-900 text-white p-6 rounded-3xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-300">
            Módulo Oficial de Planta
          </span>
          <h2 className="font-serif text-2xl md:text-3xl font-bold mt-1 text-[#F6EFDC]">
            Reporte de produccion
          </h2>
        </div>

        {/* Pestañas de Cambio */}
        <div className="flex items-center gap-1.5 bg-black/30 p-1.5 rounded-2xl border border-white/10 self-start md:self-center">
          <button
            type="button"
            onClick={() => setActiveTab('produccion')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'produccion'
                ? 'bg-amber-400 text-slate-950 font-black shadow-md'
                : 'text-white hover:bg-white/10'
            }`}
          >
            <Factory className="w-4 h-4" />
            <span>Producción</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('existencia')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'existencia'
                ? 'bg-emerald-400 text-slate-950 font-black shadow-md'
                : 'text-white hover:bg-white/10'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>Existencia</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('carga')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'carga'
                ? 'bg-white text-emerald-950 font-black shadow-md'
                : 'text-white hover:bg-white/10'
            }`}
          >
            <Calendar className="w-4 h-4 text-amber-300" />
            <span>Carga Diaria</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* VISTA 1: REPORTE DE PRODUCCIÓN                                         */}
      {/* ===================================================================== */}
      {activeTab === 'produccion' && (
        <div className="space-y-6">
          {/* Tarjetas Métricas de Producción */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                Total Kg Producidos
              </span>
              <div className="font-serif text-2xl font-black text-[#00603C] mt-1">
                {formatKg(totalKgProducidos)}
              </div>
              <span className="text-[10px] text-gray-400 font-mono mt-1 block">
                Solo desde reportes diarios (producción)
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                Total Kg Curados
              </span>
              <div className="font-serif text-2xl font-black text-purple-700 mt-1">
                {formatKg(totalKgCurados)}
              </div>
              <span className="text-[10px] text-gray-400 font-mono mt-1 block">
                Reportes diarios (curado) · NO suma producción
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                Cargas Registradas
              </span>
              <div className="font-serif text-2xl font-black text-gray-900 mt-1">
                {reportesFiltrados.length}
              </div>
              <span className="text-[10px] text-gray-400 font-mono mt-1 block">
                Registros en período seleccionado
              </span>
            </div>

            <div className="bg-emerald-950 text-white p-5 rounded-2xl border border-emerald-800 shadow-2xs">
              <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider block">
                Regla de Invarianza
              </span>
              <p className="text-[11px] text-emerald-100 mt-1 leading-snug">
                El curado y los desdoblamientos <strong>NO generan producción</strong>: son kg que ya existían.
              </p>
            </div>
          </div>

          {/* Filtros de Producción (Día, Semana, Mes) */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-gray-500 uppercase text-[10px]">Período:</span>
              <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                {[
                  { id: 'dia', label: 'Hoy (Día)' },
                  { id: 'semana', label: 'Última Semana' },
                  { id: 'mes', label: 'Último Mes' },
                  { id: 'todos', label: 'Histórico' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTemporalidad(item.id as any)}
                    className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                      temporalidad === item.id
                        ? 'bg-[#00603C] text-white shadow-2xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Filtro tipo */}
              <div className="flex gap-1 bg-slate-100 p-1 rounded-xl ml-2">
                {[
                  { id: 'todos', label: 'Todos' },
                  { id: 'produccion', label: 'Producción' },
                  { id: 'curado', label: 'Curado' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setFiltroTipoReporte(item.id as any)}
                    className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                      filtroTipoReporte === item.id
                        ? 'bg-emerald-800 text-white shadow-2xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por lote, cliente..."
                value={busquedaProduccion}
                onChange={(e) => setBusquedaProduccion(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs w-48 focus:bg-white"
              />
            </div>
          </div>

          {/* Tabla de Reportes Diarios */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h4 className="font-serif text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <Factory className="w-4 h-4 text-[#00603C]" />
                <span>Registros de Reportes Diarios</span>
              </h4>
              <span className="text-xs text-gray-400 font-mono">
                {reportesFiltrados.length} entradas
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-gray-500 uppercase text-[10px] font-bold border-b border-gray-200">
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4">Lote Asociado</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Variedad</th>
                    <th className="py-3 px-4 text-right">Kg Reportados</th>
                    <th className="py-3 px-4">Usuario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reportesFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-gray-400 italic">
                        No hay reportes diarios para los filtros seleccionados. Puede registrar uno en la pestaña "Carga Diaria".
                      </td>
                    </tr>
                  ) : (
                    reportesFiltrados.map((rep) => (
                      <tr key={rep.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-mono font-bold text-gray-900">{rep.fecha}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              rep.tipo === 'produccion'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}
                          >
                            {rep.tipo}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-[#00603C]">
                          #{rep.codigoLote || rep.loteId}
                        </td>
                        <td className="py-3 px-4 text-gray-800">{rep.cliente || '—'}</td>
                        <td className="py-3 px-4 font-semibold text-gray-800">{rep.variedad || '—'}</td>
                        <td className="py-3 px-4 text-right font-mono font-black text-gray-900">
                          {formatKg(rep.kg)}
                        </td>
                        <td className="py-3 px-4 text-gray-500 text-[11px]">{rep.usuario}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* VISTA 2: REPORTE DE EXISTENCIA                                         */}
      {/* ===================================================================== */}
      {activeTab === 'existencia' && (
        <div className="space-y-6">
          {/* Tarjetas Métricas de Existencia */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                Total Existencia Física
              </span>
              <div className="font-serif text-2xl font-black text-[#00603C] mt-1">
                {formatKg(totalExistenciaKg)}
              </div>
              <span className="text-[10px] text-gray-400 font-mono mt-1 block">
                Lotes activos (hojas del árbol)
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                Stock Disponible
              </span>
              <div className="font-serif text-2xl font-black text-emerald-700 mt-1">
                {formatKg(stockDisponibleKg)}
              </div>
              <span className="text-[10px] text-gray-400 font-mono mt-1 block">
                Habilitado para despacho y curado
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                Stock Bloqueado (No disponible)
              </span>
              <div className="font-serif text-2xl font-black text-red-600 mt-1">
                {formatKg(stockBloqueadoKg)}
              </div>
              <span className="text-[10px] text-gray-400 font-mono mt-1 block">
                Cuenta en existencia pero retenido
              </span>
            </div>

            <div className="bg-purple-950 text-white p-5 rounded-2xl border border-purple-800 shadow-2xs">
              <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider block">
                Saldo Pendiente de Curar
              </span>
              <div className="font-serif text-2xl font-black text-white mt-1">
                {formatKg(saldoPendienteCurarKg)}
              </div>
              <span className="text-[10px] text-purple-200 font-mono mt-1 block">
                Existencias crudas pendientes
              </span>
            </div>
          </div>

          {/* Filtros de Existencia: estado, tratamiento, envase, categoría, tipo, cliente */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5 text-xs">
                <Filter className="w-3.5 h-3.5 text-[#00603C]" />
                <span>Filtros de Existencia Multicriterio</span>
              </span>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar lote..."
                  value={busquedaExistencia}
                  onChange={(e) => setBusquedaExistencia(e.target.value)}
                  className="pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs w-48 focus:bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {/* Estado */}
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">Estado</label>
                <select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-gray-800"
                >
                  <option value="todos">Todos los estados</option>
                  <option value="sin clasificar">Sin clasificar</option>
                  <option value="clasificado">Clasificado</option>
                  <option value="bloqueado">Bloqueado</option>
                  <option value="descartado">Descartado</option>
                </select>
              </div>

              {/* Tratamiento */}
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">Tratamiento</label>
                <select
                  value={filtroTratamiento}
                  onChange={(e) => setFiltroTratamiento(e.target.value)}
                  className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-gray-800"
                >
                  <option value="todos">Todos</option>
                  <option value="crudo">Sin Curar</option>
                  <option value="curado">Curado</option>
                </select>
              </div>

              {/* Envase */}
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">Envase</label>
                <select
                  value={filtroEnvase}
                  onChange={(e) => setFiltroEnvase(e.target.value)}
                  className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-gray-800"
                >
                  <option value="todos">Todos</option>
                  <option value="x 800 kg">x 800 kg</option>
                  <option value="x 25 kg">x 25 kg</option>
                  <option value="x 20 kg">x 20 kg</option>
                </select>
              </div>

              {/* Categoría */}
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">Categoría</label>
                <select
                  value={filtroCategoria}
                  onChange={(e) => setFiltroCategoria(e.target.value)}
                  className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-gray-800"
                >
                  <option value="todos">Todas</option>
                  <option value="preba">Preba</option>
                  <option value="original">Original</option>
                  <option value="primu">Primu</option>
                </select>
              </div>

              {/* Tipo */}
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">Tipo</label>
                <select
                  value={filtroTipoLote}
                  onChange={(e) => setFiltroTipoLote(e.target.value)}
                  className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-gray-800"
                >
                  <option value="todos">Todos</option>
                  <option value="intermedio">Intermedio</option>
                  <option value="final">Final</option>
                </select>
              </div>

              {/* Cliente */}
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">Cliente</label>
                <select
                  value={filtroCliente}
                  onChange={(e) => setFiltroCliente(e.target.value)}
                  className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-gray-800"
                >
                  <option value="todos">Todos</option>
                  {clientesExistencia.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Tabla de Existencias */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h4 className="font-serif text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <Scale className="w-4 h-4 text-[#00603C]" />
                <span>Lotes Activos en Existencia ({lotesExistenciaFiltrados.length})</span>
              </h4>
              <span className="text-xs font-mono font-bold text-[#00603C]">
                Total: {formatKg(totalExistenciaKg)}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-gray-500 uppercase text-[10px] font-bold border-b border-gray-200">
                    <th className="py-3 px-4">Lote / Código</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Especie · Variedad</th>
                    <th className="py-3 px-4">Tratamiento</th>
                    <th className="py-3 px-4">Envase</th>
                    <th className="py-3 px-4">Categoría</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4 text-right">Bolsas</th>
                    <th className="py-3 px-4 text-right">Existencia (kg)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lotesExistenciaFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-8 text-gray-400 italic">
                        No hay lotes que coincidan con los filtros de existencia.
                      </td>
                    </tr>
                  ) : (
                    lotesExistenciaFiltrados.map((l) => {
                      const est = normalizarEstado(l.estadoEspec || l.estado, l.estadoRegistro);
                      const trat = normalizarTratamiento(l.tratamiento);
                      const env = normalizarEnvase(l.envase || l.kgPorBolsa);
                      const cat = normalizarCategoria(l.categoria);
                      const tip = normalizarTipo(l.tipo);
                      const bolsas = Number(l.cantidadBolsas) || Number(l.stockBolsas) || 0;
                      const kgLote = Number(l.kg) || Number(l.stockKg) || (bolsas * (l.kgPorBolsa || 800));

                      return (
                        <tr
                          key={l.id}
                          onClick={() => onSelectLote && onSelectLote(l)}
                          className={`hover:bg-slate-50/80 transition cursor-pointer ${
                            est === 'bloqueado' ? 'bg-red-50/40' : ''
                          }`}
                        >
                          <td className="py-3 px-4 font-mono font-bold text-[#00603C]">
                            #{l.codigo || l.loteNro}
                          </td>
                          <td className="py-3 px-4 text-gray-800 font-semibold">{l.cliente}</td>
                          <td className="py-3 px-4 text-gray-700">
                            {l.especie} · <strong>{l.variedad}</strong>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                                trat === 'curado'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {trat}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-medium text-gray-700">{env}</td>
                          <td className="py-3 px-4 capitalize font-medium text-gray-700">{cat}</td>
                          <td className="py-3 px-4 capitalize font-medium text-gray-700">{tip}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-gray-800">
                            {bolsas}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-black text-gray-900">
                            {formatKg(kgLote)}
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
      )}

      {/* ===================================================================== */}
      {/* VISTA 3: CARGA DIARIA DE REPORTES                                      */}
      {/* ===================================================================== */}
      {activeTab === 'carga' && (
        <CargaReporteDiario
          lotes={lotes}
          currentUser={currentUser}
          onGuardarReporte={onGuardarReporte}
        />
      )}
    </div>
  );
};
