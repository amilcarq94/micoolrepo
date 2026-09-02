/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { SiloId, MovimientoSilo, DiscrepanciaStock, CAPACIDAD_MAX_SILO, AuditLogEntry } from '../types';
import { getSiloActiveData } from '../utils/siloValidation';
import { canManageDiscrepancias } from '../utils/permissions';
import { recordGlobalAuditLog } from '../utils/auditLogger';
import { formatKg } from '../utils/formatters';
import {
  Scale,
  Warehouse,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Printer,
  History,
  Plus,
  Save,
  ShieldCheck,
  RefreshCw,
  Search,
  Filter,
  Layers,
  HelpCircle
} from 'lucide-react';

interface DiscrepanciasViewProps {
  movimientosSilo: MovimientoSilo[];
  siloStocks: Record<SiloId, number>;
  currentUser: { nombre: string; rol: string };
  onAjustarStockSilo?: (siloId: SiloId, nuevoKg: number, motivo: string) => void;
}

const STORAGE_DISCREPANCIAS_KEY = 'agro_abacus_discrepancias_history';

export const DiscrepanciasView: React.FC<DiscrepanciasViewProps> = ({
  movimientosSilo,
  siloStocks,
  currentUser,
  onAjustarStockSilo
}) => {
  const isAuthorized = canManageDiscrepancias(currentUser.rol);

  // Historial de arqueos y discrepancias guardados
  const [historialDiscrepancias, setHistorialDiscrepancias] = useState<DiscrepanciaStock[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_DISCREPANCIAS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Estados del relevamiento actual en edición para los 6 silos
  const [relevamientoFisico, setRelevamientoFisico] = useState<Record<SiloId, number | ''>>({
    'Silo 1': '',
    'Silo 2': '',
    'Silo 3': '',
    'Silo 4': '',
    'Silo 5': '',
    'Silo 6': ''
  });

  const [observacionesSilo, setObservacionesSilo] = useState<Record<SiloId, string>>({
    'Silo 1': '',
    'Silo 2': '',
    'Silo 3': '',
    'Silo 4': '',
    'Silo 5': '',
    'Silo 6': ''
  });

  const [filtroEstado, setFiltroEstado] = useState<'TODOS' | 'CRITICO' | 'TOLERABLE' | 'EXACTO'>('TODOS');
  const [mensajeExito, setMensajeExito] = useState('');

  // Comparativa calculada para cada silo
  const comparativaSilos = useMemo(() => {
    const silos: SiloId[] = ['Silo 1', 'Silo 2', 'Silo 3', 'Silo 4', 'Silo 5', 'Silo 6'];

    return silos.map((siloId) => {
      const activeData = getSiloActiveData(siloId, movimientosSilo);
      const stockTeorico = siloStocks[siloId] || 0;
      const stockFisicoRaw = relevamientoFisico[siloId];
      const hasFisico = stockFisicoRaw !== '' && stockFisicoRaw !== undefined && !isNaN(Number(stockFisicoRaw));
      const stockFisico = hasFisico ? Number(stockFisicoRaw) : stockTeorico;

      const diferenciaKg = stockTeorico - stockFisico;
      const porcentajeMerma = stockTeorico > 0 ? (diferenciaKg / stockTeorico) * 100 : 0;

      let estado: 'EXACTO' | 'TOLERABLE' | 'CRITICO' = 'EXACTO';
      if (!hasFisico || Math.abs(diferenciaKg) < 1) {
        estado = 'EXACTO';
      } else if (Math.abs(porcentajeMerma) <= 1.0) {
        estado = 'TOLERABLE';
      } else {
        estado = 'CRITICO';
      }

      return {
        siloId,
        activeData,
        stockTeorico,
        stockFisico,
        hasFisico,
        diferenciaKg,
        porcentajeMerma,
        estado,
        observaciones: observacionesSilo[siloId] || ''
      };
    });
  }, [siloStocks, movimientosSilo, relevamientoFisico, observacionesSilo]);

  // Guardar arqueo físico en el historial y registrar en auditoría
  const handleGuardarArqueo = () => {
    const now = new Date().toISOString();
    const nuevosRegistros: DiscrepanciaStock[] = [];

    comparativaSilos.forEach((item) => {
      if (item.hasFisico && item.stockTeorico > 0) {
        const disc: DiscrepanciaStock = {
          id: `DISC-${item.siloId.replace(/\s+/g, '')}-${Date.now()}`,
          fechaHora: now,
          siloId: item.siloId,
          tipoEntidad: 'SILO',
          nombreEntidad: item.siloId,
          stockTeoricoKg: item.stockTeorico,
          stockFisicoKg: item.stockFisico,
          diferenciaKg: item.diferenciaKg,
          porcentajeMerma: parseFloat(item.porcentajeMerma.toFixed(2)),
          estado: item.estado,
          observaciones: item.observaciones,
          relevador: currentUser.nombre,
          rolRelevador: currentUser.rol
        };
        nuevosRegistros.push(disc);

        // Registrar en Auditoría General
        recordGlobalAuditLog({
          tipo: 'Arqueo Físico',
          usuario: currentUser.nombre,
          rol: currentUser.rol,
          modulo: 'SILOS',
          entidadId: item.siloId,
          descripcion: `Relevamiento físico de ${item.siloId}: Teórico ${item.stockTeorico.toLocaleString('es-AR')} kg vs Físico ${item.stockFisico.toLocaleString('es-AR')} kg (Merma: ${item.diferenciaKg.toLocaleString('es-AR')} kg / ${item.porcentajeMerma.toFixed(2)}%).`,
          detalles: item.observaciones || `Estado: ${item.estado}`
        });
      }
    });

    if (nuevosRegistros.length === 0) {
      alert('Por favor ingrese al menos un valor de stock físico para registrar el arqueo.');
      return;
    }

    const updated = [...nuevosRegistros, ...historialDiscrepancias];
    setHistorialDiscrepancias(updated);
    localStorage.setItem(STORAGE_DISCREPANCIAS_KEY, JSON.stringify(updated));

    setMensajeExito(`Arqueo registrado exitosamente (${nuevosRegistros.length} silos auditados).`);
    setTimeout(() => setMensajeExito(''), 5000);
  };

  const handlePrintReporte = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm print:shadow-none print:border-none">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono tracking-widest text-[#C9922E] uppercase font-bold">
            <Scale className="w-4 h-4" />
            Control de Mermas y Auditoría de Stock
          </div>
          <h2 className="font-serif text-2xl font-bold text-gray-900 mt-1">
            Reporte de Discrepancias: Teórico vs. Físico
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Compara el balance teórico registrado en sistema (Ingresos − Egresos) con los relevamientos físicos de silos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button
            onClick={handlePrintReporte}
            className="px-4 py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 transition flex items-center gap-2"
          >
            <Printer className="w-4 h-4 text-gray-500" />
            Imprimir Informe
          </button>

          {isAuthorized && (
            <button
              onClick={handleGuardarArqueo}
              className="px-4 py-2.5 bg-[#00603C] hover:bg-[#254731] text-white rounded-xl text-xs font-bold shadow transition flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Guardar Relevamiento Físico
            </button>
          )}
        </div>
      </div>

      {mensajeExito && (
        <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          {mensajeExito}
        </div>
      )}

      {/* Tabla Comparativa de Silos */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 bg-gray-50/70 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Warehouse className="w-5 h-5 text-[#00603C]" />
            <h3 className="font-serif text-base font-bold text-gray-900">
              Estado de Silos en Batería (Silo 1 a Silo 6)
            </h3>
          </div>
          <span className="text-[11px] text-gray-500 font-mono">
            Tolerancia admisible: ≤ 1.00%
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider font-semibold border-b border-gray-100">
              <tr>
                <th className="px-4 py-3">Silo</th>
                <th className="px-4 py-3">Contenido Actual</th>
                <th className="px-4 py-3 text-right">Stock Teórico (kg)</th>
                <th className="px-4 py-3 text-right">Relevado Físico (kg)</th>
                <th className="px-4 py-3 text-right">Diferencia / Merma</th>
                <th className="px-4 py-3 text-center">% Merma</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3">Observaciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-sans">
              {comparativaSilos.map((item) => {
                const stockTeorico = item.stockTeorico;
                return (
                  <tr key={item.siloId} className="hover:bg-gray-50/50 transition">
                    <td className="px-4 py-3 font-bold text-gray-900 whitespace-nowrap">
                      {item.siloId}
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-800">
                        {item.activeData.especie} ({item.activeData.variedad})
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {item.activeData.cliente}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">
                      {stockTeorico.toLocaleString('es-AR')} kg
                      <span className="block text-[10px] font-normal text-gray-400">
                        {(stockTeorico / 1000).toFixed(2)} Tn
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right">
                      {isAuthorized ? (
                        <input
                          type="number"
                          placeholder={stockTeorico > 0 ? stockTeorico.toString() : '0'}
                          value={relevamientoFisico[item.siloId]}
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : Number(e.target.value);
                            setRelevamientoFisico((prev) => ({
                              ...prev,
                              [item.siloId]: val
                            }));
                          }}
                          className="w-28 px-2 py-1 text-right font-mono text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-[#00603C]"
                        />
                      ) : (
                        <span className="font-mono text-gray-700">
                          {item.hasFisico ? `${item.stockFisico.toLocaleString('es-AR')} kg` : '—'}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right font-mono font-bold">
                      {item.hasFisico ? (
                        <span className={item.diferenciaKg > 0 ? 'text-amber-600' : item.diferenciaKg < 0 ? 'text-blue-600' : 'text-gray-600'}>
                          {item.diferenciaKg > 0 ? `-${item.diferenciaKg.toLocaleString('es-AR')}` : item.diferenciaKg < 0 ? `+${Math.abs(item.diferenciaKg).toLocaleString('es-AR')}` : '0'} kg
                        </span>
                      ) : (
                        <span className="text-gray-300 font-normal">0 kg</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-center font-mono font-bold">
                      {item.hasFisico && stockTeorico > 0 ? (
                        <span className={item.estado === 'CRITICO' ? 'text-red-600' : item.estado === 'TOLERABLE' ? 'text-amber-600' : 'text-emerald-600'}>
                          {item.porcentajeMerma.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-gray-300">0.00%</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        item.estado === 'CRITICO'
                          ? 'bg-red-100 text-red-800 border border-red-200'
                          : item.estado === 'TOLERABLE'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {item.estado === 'CRITICO' && <AlertTriangle className="w-3 h-3" />}
                        {item.estado === 'EXACTO' && <CheckCircle2 className="w-3 h-3" />}
                        {item.estado}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      {isAuthorized ? (
                        <input
                          type="text"
                          placeholder="Nota o motivo..."
                          value={observacionesSilo[item.siloId]}
                          onChange={(e) => {
                            const val = e.target.value;
                            setObservacionesSilo((prev) => ({
                              ...prev,
                              [item.siloId]: val
                            }));
                          }}
                          className="w-full min-w-[130px] px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-[#00603C]"
                        />
                      ) : (
                        <span className="text-gray-500 text-[11px] truncate block max-w-[150px]">
                          {item.observaciones || '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Historial de Arqueos Registrados */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-[#C9922E]" />
            <h3 className="font-serif text-base font-bold text-gray-900">
              Historial de Arqueos y Mermas Registradas
            </h3>
          </div>
          <span className="text-xs text-gray-400 font-mono">
            {historialDiscrepancias.length} registros guardados
          </span>
        </div>

        {historialDiscrepancias.length === 0 ? (
          <p className="text-xs text-gray-400 italic py-4 text-center">
            Aún no se han asentado arqueos manuales de stock en el historial.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider font-semibold border-b border-gray-100">
                <tr>
                  <th className="px-3 py-2.5">Fecha y Hora</th>
                  <th className="px-3 py-2.5">Silo / Entidad</th>
                  <th className="px-3 py-2.5 text-right">Teórico</th>
                  <th className="px-3 py-2.5 text-right">Físico</th>
                  <th className="px-3 py-2.5 text-right">Diferencia</th>
                  <th className="px-3 py-2.5 text-center">% Merma</th>
                  <th className="px-3 py-2.5 text-center">Estado</th>
                  <th className="px-3 py-2.5">Auditor / Relevador</th>
                  <th className="px-3 py-2.5">Observaciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {historialDiscrepancias.slice(0, 20).map((disc) => (
                  <tr key={disc.id} className="hover:bg-gray-50/50">
                    <td className="px-3 py-2 font-mono text-gray-600">
                      {new Date(disc.fechaHora).toLocaleString('es-AR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="px-3 py-2 font-bold text-gray-900">{disc.nombreEntidad}</td>
                    <td className="px-3 py-2 text-right font-mono">{disc.stockTeoricoKg.toLocaleString('es-AR')} kg</td>
                    <td className="px-3 py-2 text-right font-mono">{disc.stockFisicoKg.toLocaleString('es-AR')} kg</td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-amber-700">
                      {disc.diferenciaKg.toLocaleString('es-AR')} kg
                    </td>
                    <td className="px-3 py-2 text-center font-mono font-bold">{disc.porcentajeMerma}%</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        disc.estado === 'CRITICO'
                          ? 'bg-red-100 text-red-800'
                          : disc.estado === 'TOLERABLE'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {disc.estado}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {disc.relevador} <span className="text-[10px] text-gray-400">({disc.rolRelevador || 'Auditor'})</span>
                    </td>
                    <td className="px-3 py-2 text-gray-500 italic max-w-xs truncate">
                      {disc.observaciones || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
