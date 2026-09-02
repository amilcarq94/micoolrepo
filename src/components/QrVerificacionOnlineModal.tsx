/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Lote, AuditLogEntry, EstadoRegistroLote } from '../types';
import { formatKg } from '../utils/formatters';
import { recordGlobalAuditLog } from '../utils/auditLogger';
import { CheckCircle2, AlertTriangle, QrCode, Clock, User, Sparkles, MapPin, Printer, ArrowRight, ShieldCheck, RefreshCw, X, FileText } from 'lucide-react';

interface QrVerificacionOnlineModalProps {
  loteIdScanned: string;
  lotes: Lote[];
  currentUser: { nombre: string; rol: string };
  onClose: () => void;
  onSelectLoteDetail: (lote: Lote) => void;
  onUpdateLoteEstado?: (lote: Lote, nuevoEstadoRegistro: EstadoRegistroLote) => void;
  onRegistrarSalida?: (lote: Lote) => void;
  onScanAnother?: () => void;
}

export const QrVerificacionOnlineModal: React.FC<QrVerificacionOnlineModalProps> = ({
  loteIdScanned,
  lotes,
  currentUser,
  onClose,
  onSelectLoteDetail,
  onUpdateLoteEstado,
  onRegistrarSalida,
  onScanAnother
}) => {
  const [scanTimestamp] = useState(() => new Date().toISOString());
  const [hasLogged, setHasLogged] = useState(false);

  // Buscar lote en tiempo real en la lista de lotes activos
  const lote = lotes.find(
    l => l.id.toLowerCase().trim() === loteIdScanned.toLowerCase().trim() ||
         l.loteNro.toLowerCase().trim() === loteIdScanned.toLowerCase().trim()
  );

  // Registrar auditoría de verificación online
  useEffect(() => {
    if (lote && !hasLogged) {
      setHasLogged(true);
      const auditLog: AuditLogEntry = {
        id: `AUD-QR-${Date.now()}`,
        fechaHora: scanTimestamp,
        tipo: 'Escaneo QR',
        usuario: currentUser.nombre,
        rol: currentUser.rol,
        modulo: 'LOTES',
        entidadId: lote.id,
        descripcion: `Código QR verificado online en planta por ${currentUser.nombre} (${currentUser.rol}).`,
        detalles: `Estado detectado: ${lote.estadoRegistro || 'REALIZADO'} | Stock remanente: ${lote.stockKg.toLocaleString('es-AR')} kg (${lote.stockBolsas} b.) | Variedad: ${lote.variedad}.`
      };

      recordGlobalAuditLog(auditLog);

      // Si el lote tiene array de auditoría, agregarlo
      if (lote.auditoria) {
        lote.auditoria = [auditLog, ...lote.auditoria];
      }
    }
  }, [lote, hasLogged, currentUser, scanTimestamp]);

  const esTratado = lote?.tratamiento?.some(t => t !== 'Sin Tratar') || false;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Cabecera */}
        <div className="bg-[#00603C] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl">
              <QrCode className="w-6 h-6 text-[#C9922E]" />
            </div>
            <div>
              <span className="text-[10px] font-mono tracking-widest uppercase text-[#C9922E] block">
                Verificación Online en Planta
              </span>
              <h3 className="font-serif text-lg font-bold">
                {lote ? `Lote ${lote.id}` : `Código: ${loteIdScanned}`}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido Principal */}
        <div className="p-6 space-y-6">
          {!lote ? (
            <div className="text-center py-8 space-y-3">
              <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-gray-900 text-base">Lote No Encontrado</h4>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                El código escaneado <strong className="font-mono text-gray-800">"{loteIdScanned}"</strong> no coincide con ningún lote registrado en la base de datos central.
              </p>
              {onScanAnother && (
                <button
                  onClick={onScanAnother}
                  className="mt-4 px-4 py-2 bg-[#00603C] hover:bg-[#254731] text-white text-xs font-bold rounded-lg transition inline-flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Escanear Otro Código
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Badge de Estado en Tiempo Real */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">
                    Estado Actual en Vivo
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                      lote.estadoRegistro === 'PRE-CARGA'
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    }`}>
                      <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                      {lote.estadoRegistro || 'REALIZADO'}
                    </span>

                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      esTratado
                        ? 'bg-purple-100 text-purple-800 border border-purple-300'
                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}>
                      {esTratado ? 'TRATADO' : 'SIN TRATAR'}
                    </span>

                    <span className="px-2.5 py-1 bg-gray-200 text-gray-700 text-xs font-semibold rounded-full">
                      {lote.estado}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">
                    Stock Disponible
                  </span>
                  <span className="text-base font-mono font-black text-[#00603C] block mt-0.5">
                    {lote.stockKg.toLocaleString('es-AR')} kg
                  </span>
                  <span className="text-[11px] text-gray-500">
                    {lote.stockBolsas} bolsas ({lote.kgPorBolsa} kg/b)
                  </span>
                </div>
              </div>

              {/* Grid de Ficha Técnica */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-white rounded-lg border border-gray-100 shadow-sm">
                  <span className="text-[9px] font-bold text-[#C9922E] uppercase block">Cliente</span>
                  <span className="font-bold text-gray-900 truncate block mt-0.5">{lote.cliente}</span>
                </div>

                <div className="p-3 bg-white rounded-lg border border-gray-100 shadow-sm">
                  <span className="text-[9px] font-bold text-[#C9922E] uppercase block">Especie / Grano</span>
                  <span className="font-bold text-gray-900 block mt-0.5">{lote.especie}</span>
                </div>

                <div className="p-3 bg-white rounded-lg border border-gray-100 shadow-sm">
                  <span className="text-[9px] font-bold text-[#C9922E] uppercase block">Variedad</span>
                  <span className="font-bold text-gray-900 block mt-0.5">{lote.variedad}</span>
                </div>

                <div className="p-3 bg-white rounded-lg border border-gray-100 shadow-sm">
                  <span className="text-[9px] font-bold text-[#C9922E] uppercase block">Categoría</span>
                  <span className="font-bold text-gray-900 block mt-0.5">{lote.categoria}</span>
                </div>

                <div className="p-3 bg-white rounded-lg border border-gray-100 shadow-sm">
                  <span className="text-[9px] font-bold text-[#C9922E] uppercase block">Ubicación Acopio</span>
                  <span className="font-bold text-gray-900 block mt-0.5">
                    {lote.ala ? `Ala ${lote.ala} - Sec. ${lote.sector}` : lote.ubicacionAcopio || 'S/D'}
                  </span>
                </div>

                <div className="p-3 bg-white rounded-lg border border-gray-100 shadow-sm">
                  <span className="text-[9px] font-bold text-[#C9922E] uppercase block">Humedad Relevada</span>
                  <span className="font-bold text-gray-900 block mt-0.5">
                    {lote.humedad ? `${lote.humedad}%` : 'S/D'}
                  </span>
                </div>
              </div>

              {/* Registro de Auditoría de Escaneo */}
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 flex items-start gap-2.5 text-xs text-blue-900">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-semibold flex items-center gap-2">
                    <span>Verificado por {currentUser.nombre} ({currentUser.rol})</span>
                    <span className="text-[10px] text-blue-600 font-mono">
                      {new Date(scanTimestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[11px] text-blue-700">
                    Evento registrado automáticamente en el log de trazabilidad y auditoría.
                  </p>
                </div>
              </div>

              {/* Acciones Rápidas */}
              <div className="space-y-2 pt-2 border-t border-gray-100">
                {lote.estadoRegistro === 'PRE-CARGA' && onUpdateLoteEstado && (
                  <button
                    onClick={() => {
                      onUpdateLoteEstado(lote, 'REALIZADO');
                      onClose();
                    }}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Marcar Lote como REALIZADO (Producido)
                  </button>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      onSelectLoteDetail(lote);
                      onClose();
                    }}
                    className="py-2.5 px-4 bg-[#00603C] hover:bg-[#254731] text-white rounded-xl text-xs font-bold shadow transition flex items-center justify-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Ver Ficha Técnica Completa
                  </button>

                  {onRegistrarSalida && lote.stockBolsas > 0 && (
                    <button
                      onClick={() => {
                        onRegistrarSalida(lote);
                        onClose();
                      }}
                      className="py-2.5 px-4 bg-[#C9922E] hover:bg-[#A37420] text-white rounded-xl text-xs font-bold shadow transition flex items-center justify-center gap-2"
                    >
                      <ArrowRight className="w-4 h-4" />
                      Registrar Despacho / Salida
                    </button>
                  )}
                </div>

                {onScanAnother && (
                  <button
                    onClick={onScanAnother}
                    className="w-full py-2 text-center text-xs text-gray-500 hover:text-gray-800 font-semibold transition"
                  >
                    Escanear otro código QR
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
