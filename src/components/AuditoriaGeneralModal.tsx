/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { AuditLogEntry } from '../types';
import { getGlobalAuditLogs } from '../utils/auditLogger';
import { PaginationControls } from './PaginationControls';
import {
  ShieldCheck,
  Search,
  Filter,
  Calendar,
  X,
  FileSpreadsheet,
  Printer,
  User,
  ArrowRight,
  Clock,
  Layers,
  Sparkles
} from 'lucide-react';

interface AuditoriaGeneralModalProps {
  onClose: () => void;
  additionalLogs?: AuditLogEntry[];
}

export const AuditoriaGeneralModal: React.FC<AuditoriaGeneralModalProps> = ({
  onClose,
  additionalLogs = []
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [moduloFiltro, setModuloFiltro] = useState<string>('TODOS');
  const [tipoFiltro, setTipoFiltro] = useState<string>('TODOS');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  // Combinar logs de storage global con logs adicionales pasados por props
  const allLogs = useMemo(() => {
    const local = getGlobalAuditLogs();
    const map = new Map<string, AuditLogEntry>();
    [...additionalLogs, ...local].forEach((entry) => {
      if (entry && entry.id) {
        map.set(entry.id, entry);
      }
    });
    return Array.from(map.values()).sort((a, b) => (b.fechaHora || '').localeCompare(a.fechaHora || ''));
  }, [additionalLogs]);

  // Filtrado
  const filteredLogs = useMemo(() => {
    return allLogs.filter((log) => {
      const matchSearch =
        !searchTerm.trim() ||
        log.usuario.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.entidadId && log.entidadId.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (log.detalles && log.detalles.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchModulo =
        moduloFiltro === 'TODOS' || (log.modulo || '').toUpperCase() === moduloFiltro;

      const matchTipo =
        tipoFiltro === 'TODOS' || (log.tipo || '').toUpperCase() === tipoFiltro;

      return matchSearch && matchModulo && matchTipo;
    });
  }, [allLogs, searchTerm, moduloFiltro, tipoFiltro]);

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const pagedLogs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(start, start + itemsPerPage);
  }, [filteredLogs, currentPage, itemsPerPage]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Cabecera */}
        <div className="bg-[#00603C] text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl">
              <ShieldCheck className="w-6 h-6 text-[#C9922E]" />
            </div>
            <div>
              <span className="text-[10px] font-mono tracking-widest uppercase text-[#C9922E] block">
                Trazabilidad y Control de Cambios
              </span>
              <h3 className="font-serif text-lg font-bold">
                Registro General de Auditoría del Sistema
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
              title="Imprimir Registro de Auditoría"
            >
              <Printer className="w-4 h-4 text-white" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Barra de Filtros y Búsqueda */}
        <div className="p-4 bg-gray-50 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por usuario, lote, silo, motivo o valor..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00603C] bg-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={moduloFiltro}
              onChange={(e) => {
                setModuloFiltro(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#00603C]"
            >
              <option value="TODOS">Todos los Módulos</option>
              <option value="LOTES">Lotes</option>
              <option value="SILOS">Silos</option>
              <option value="BOLSONES">Bolsones</option>
              <option value="DESPACHOS">Despachos</option>
              <option value="ORDENES_PROCESO">Órdenes de Proceso</option>
            </select>

            <select
              value={tipoFiltro}
              onChange={(e) => {
                setTipoFiltro(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#00603C]"
            >
              <option value="TODOS">Todas las Acciones</option>
              <option value="EDICIÓN">Ediciones Manuales</option>
              <option value="CREACIÓN">Creaciones</option>
              <option value="STOCK">Ajustes de Stock</option>
              <option value="DESCARTE">Descartes / Rechazos</option>
              <option value="AJUSTE A CERO">Puesta a Cero</option>
              <option value="ESCANEO QR">Escaneos QR</option>
              <option value="ARQUEO FÍSICO">Arqueos Físicos</option>
            </select>
          </div>
        </div>

        {/* Tabla de Eventos */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-gray-400 space-y-2">
              <ShieldCheck className="w-10 h-10 mx-auto text-gray-300" />
              <p className="text-sm font-semibold">No se encontraron eventos de auditoría</p>
              <p className="text-xs">Pruebe ajustando los términos de búsqueda o filtros.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pagedLogs.map((log) => (
                <div
                  key={log.id}
                  className="bg-white border border-gray-100 hover:border-gray-200 rounded-xl p-4 shadow-sm transition space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-50 pb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        log.tipo === 'Edición' || log.tipo === 'EDICIÓN'
                          ? 'bg-amber-100 text-amber-800'
                          : log.tipo === 'Descarte' || log.tipo === 'DESCARTE'
                          ? 'bg-red-100 text-red-800'
                          : log.tipo === 'Ajuste a Cero'
                          ? 'bg-purple-100 text-purple-800'
                          : log.tipo === 'Escaneo QR'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {log.tipo}
                      </span>

                      {log.modulo && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-mono font-semibold rounded">
                          {log.modulo}
                        </span>
                      )}

                      {log.entidadId && (
                        <span className="font-mono text-xs font-bold text-gray-900">
                          {log.entidadId}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      <span>
                        {new Date(log.fechaHora).toLocaleString('es-AR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-gray-800 font-semibold leading-relaxed">
                    {log.descripcion}
                  </div>

                  {/* Detalle de valor anterior vs nuevo */}
                  {(log.valorAnterior !== undefined || log.valorNuevo !== undefined) && (
                    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg text-xs font-mono">
                      <span className="text-gray-400">Cambio:</span>
                      <span className="line-through text-red-600 font-semibold">
                        {String(log.valorAnterior ?? '—')}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-emerald-700 font-bold">
                        {String(log.valorNuevo ?? '—')}
                      </span>
                    </div>
                  )}

                  {log.detalles && (
                    <pre className="text-[11px] text-gray-600 bg-gray-50/70 p-2 rounded-lg font-sans whitespace-pre-wrap">
                      {log.detalles}
                    </pre>
                  )}

                  <div className="text-[11px] text-gray-400 flex items-center gap-1.5 pt-1">
                    <User className="w-3 h-3 text-gray-400" />
                    <span>Responsable: <strong className="text-gray-700">{log.usuario}</strong></span>
                    {log.rol && <span>({log.rol})</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Paginación */}
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredLogs.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(newSize) => {
            setItemsPerPage(newSize);
            setCurrentPage(1);
          }}
          pageSizeOptions={[10, 15, 25, 50]}
        />
      </div>
    </div>
  );
};
