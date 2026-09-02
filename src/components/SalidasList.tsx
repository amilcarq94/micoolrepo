/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { SalidaRegistrada, Lote, Chofer } from '../types';
import { formatNumberArg, formatDateStr } from '../utils/formatters';
import { LogoSiloLoose } from './Logo';
import { Search, Calendar, User, FileText, Printer, ArrowLeft, Paperclip, Download } from 'lucide-react';

interface SalidasListProps {
  salidas: SalidaRegistrada[];
  lotes: Lote[];
  choferes?: Chofer[];
}

export const SalidasList: React.FC<SalidasListProps> = ({ salidas, lotes, choferes = [] }) => {
  // Estados para Filtros
  const [filterFecha, setFilterFecha] = useState('');
  const [filterCliente, setFilterCliente] = useState('');
  const [filterChofer, setFilterChofer] = useState('');

  // Estado para visualizar un remito histórico seleccionado
  const [remitoSeleccionado, setRemitoSeleccionado] = useState<SalidaRegistrada | null>(null);

  // Filtrado lógico
  const filteredSalidas = salidas.filter(s => {
    const matchFecha = filterFecha === '' || s.fecha === filterFecha;
    const matchCliente = filterCliente === '' || s.cliente.toLowerCase().includes(filterCliente.toLowerCase());
    const matchChofer = filterChofer === '' || s.choferNombre.toLowerCase().includes(filterChofer.toLowerCase());
    
    return matchFecha && matchCliente && matchChofer;
  });

  const handlePrintRemito = () => {
    window.print();
  };

  // Exportar salidas a Excel (.xlsx) nativo
  const handleExportExcel = () => {
    if (filteredSalidas.length === 0) return;

    const dataToExport = filteredSalidas.map(s => {
      const matchingLote = lotes.find(l => l.id === s.loteId);
      const alaStr = matchingLote?.ala ? `ALA ${matchingLote.ala}` : '—';
      const sectorStr = matchingLote?.sector ? `SECTOR ${matchingLote.sector}` : '—';
      const ubicacionStr = (matchingLote?.ala && matchingLote?.sector) 
        ? `ALA ${matchingLote.ala} · SECTOR ${matchingLote.sector}` 
        : '—';

      const choferObj = choferes.find(
        (c) => (c.nombre && s.choferNombre && c.nombre.trim().toLowerCase() === s.choferNombre.trim().toLowerCase()) ||
               (c.cuit && s.choferDni && c.cuit.trim() === s.choferDni.trim())
      );

      const taraVal = s.taraCamion !== undefined ? s.taraCamion : (choferObj?.tara !== undefined ? choferObj.tara : 0);
      const totalKgVal = s.totalKg || 0;
      const brutoVal = s.brutoCamion !== undefined ? s.brutoCamion : (taraVal + totalKgVal);

      return {
        'N° REMITO': s.id,
        'FECHA': formatDateStr(s.fecha),
        'CLIENTE / COMITENTE': s.cliente,
        'LOTE ID': s.loteId,
        'TIPO DE LOTE': s.tipoLote || '—',
        'CATEGORÍA': s.categoria || '—',
        'PRODUCTO TRATAMIENTO': s.producto || '—',
        'ALA ORIGEN': alaStr,
        'SECTOR ORIGEN': sectorStr,
        'UBICACIÓN ACOPIO': ubicacionStr,
        'CHOFER / CONDUCTOR': s.choferNombre,
        'DNI CHOFER': s.choferDni || '—',
        'PATENTE CAMIÓN': s.patenteCamion || '—',
        'BOLSAS DESPACHADAS': s.cantidadBolsas,
        'BRUTO': brutoVal,
        'TARA': taraVal,
        'TOTAL DE KILOS INGRESADOS': totalKgVal
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);

    const keys = Object.keys(dataToExport[0] || {});
    const colWidths = keys.map(key => {
      const maxLen = Math.max(
        key.length,
        ...dataToExport.map(row => String((row as any)[key] ?? '').length)
      );
      return { wch: Math.min(Math.max(maxLen + 3, 12), 40) };
    });
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Salidas Despachadas');

    XLSX.writeFile(workbook, `Reporte_Salidas_Despachos_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Exportar salidas a CSV (delimitado por ;)
  const handleExportCSV = () => {
    if (filteredSalidas.length === 0) return;

    const headers = [
      'N° REMITO',
      'FECHA',
      'CLIENTE / COMITENTE',
      'LOTE ID',
      'TIPO DE LOTE',
      'CATEGORIA',
      'PRODUCTO TRATAMIENTO',
      'ALA ORIGEN',
      'SECTOR ORIGEN',
      'UBICACION ACOPIO',
      'CHOFER / CONDUCTOR',
      'DNI CHOFER',
      'PATENTE CAMION',
      'BOLSAS DESPACHADAS',
      'BRUTO',
      'TARA',
      'TOTAL DE KILOS INGRESADOS'
    ];

    const rows = filteredSalidas.map(s => {
      const matchingLote = lotes.find(l => l.id === s.loteId);
      const alaStr = matchingLote?.ala ? `ALA ${matchingLote.ala}` : '—';
      const sectorStr = matchingLote?.sector ? `SECTOR ${matchingLote.sector}` : '—';
      const ubicacionStr = (matchingLote?.ala && matchingLote?.sector) 
        ? `ALA ${matchingLote.ala} · SECTOR ${matchingLote.sector}` 
        : '—';

      const choferObj = choferes.find(
        (c) => (c.nombre && s.choferNombre && c.nombre.trim().toLowerCase() === s.choferNombre.trim().toLowerCase()) ||
               (c.cuit && s.choferDni && c.cuit.trim() === s.choferDni.trim())
      );

      const taraVal = s.taraCamion !== undefined ? s.taraCamion : (choferObj?.tara !== undefined ? choferObj.tara : 0);
      const totalKgVal = s.totalKg || 0;
      const brutoVal = s.brutoCamion !== undefined ? s.brutoCamion : (taraVal + totalKgVal);

      return [
        s.id,
        formatDateStr(s.fecha),
        s.cliente,
        s.loteId,
        s.tipoLote || '—',
        s.categoria || '—',
        s.producto || '—',
        alaStr,
        sectorStr,
        ubicacionStr,
        s.choferNombre,
        s.choferDni || '—',
        s.patenteCamion || '—',
        s.cantidadBolsas,
        brutoVal,
        taraVal,
        totalKgVal
      ];
    });

    const csvContent = [
      'sep=;',
      headers.join(';'),
      ...rows.map(row =>
        row
          .map(val => {
            const stringVal = String(val !== undefined && val !== null ? val : '').replace(/"/g, '""');
            return stringVal.includes(';') || stringVal.includes('\n') || stringVal.includes('\r') || stringVal.includes('"')
              ? `"${stringVal}"`
              : stringVal;
          })
          .join(';')
      )
    ].join('\r\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Reporte_Salidas_Despachos_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Renderizado del remito seleccionado para visualizar/reimprimir
  if (remitoSeleccionado) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto" id="salida-remito-view">
        <button
          onClick={() => setRemitoSeleccionado(null)}
          className="flex items-center gap-1.5 text-xs font-bold text-[#00603C] hover:text-[#254731] uppercase tracking-wider self-start print:hidden"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al Historial de Salidas
        </button>

        {/* Remito Imprimible Oficial */}
        <div className="bg-white p-8 rounded-2xl border-2 border-[#00603C] shadow-md relative text-[#1A1A1A] font-sans">
          
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.06] pointer-events-none">
            <LogoSiloLoose size={350} color="#00603C" />
          </div>

          <div className="flex justify-between items-start border-b-2 border-[#00603C] pb-6 mb-6">
            <div className="flex gap-3 items-center">
              <LogoSiloLoose size={48} color="#00603C" />
              <div>
                <h3 className="font-serif text-xl font-bold text-[#00603C] uppercase tracking-wide leading-none">
                  AGRO ABACUS S.A.
                </h3>
                <p className="text-[10px] font-sans font-bold tracking-widest text-[#C9922E] uppercase mt-1">
                  PLANTA CLASIFICADORA — ESTANCIA LA BARRANCOSA
                </p>
                <p className="text-[9px] text-gray-500 mt-0.5">Ruta Provincial 14, Km 151.5 — Maria Teresa, Santa Fe</p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[9px] uppercase tracking-widest font-bold text-gray-400 block">DOCUMENTO NO VÁLIDO COMO FACTURA</span>
              <div className="bg-[#00603C] text-[#F6EFDC] font-mono font-bold text-xs px-3 py-1.5 rounded-md mt-1.5 inline-block">
                REMITO N° {remitoSeleccionado.id}
              </div>
              <div className="text-[10px] text-gray-600 mt-1 font-semibold">
                Fecha: {formatDateStr(remitoSeleccionado.fecha)}
              </div>
            </div>
          </div>

          <div className="text-center mb-6">
            <h4 className="font-serif text-lg font-bold text-[#00603C] border-b border-[#C9922E] pb-1.5 inline-block uppercase tracking-wider">
              Orden de Salida y Despacho de Semillas (Copia)
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#F6EFDC] bg-opacity-35 p-4 rounded-xl border border-[#C9922E] border-opacity-20 mb-6 text-xs text-left">
            <div>
              <span className="text-[9px] font-bold text-[#C9922E] uppercase tracking-wider block mb-1">CONDUCTOR Y CAMIÓN</span>
              <p className="font-bold text-gray-800 text-sm">{remitoSeleccionado.choferNombre}</p>
              <p className="text-gray-600 mt-0.5">Documento: <span className="font-semibold">{remitoSeleccionado.choferDni}</span></p>
              <p className="text-gray-600">Patente del Camión: <span className="font-semibold font-mono text-gray-800 uppercase">{remitoSeleccionado.patenteCamion}</span></p>
            </div>
            <div>
              <span className="text-[9px] font-bold text-[#C9922E] uppercase tracking-wider block mb-1">CLIENTE DESTINATARIO</span>
              <p className="font-bold text-gray-800 text-sm">{remitoSeleccionado.cliente}</p>
              <p className="text-gray-500 mt-0.5">Retira de Planta Clasificadora - La Barrancosa</p>
            </div>
            {remitoSeleccionado.remitoClienteAdjunto && (
              <div className="md:col-span-2 border-t border-[#C9922E]/20 pt-3 mt-1 flex flex-wrap items-center justify-between gap-2 print:hidden">
                <div className="flex items-center gap-2 text-xs">
                  <Paperclip className="w-4 h-4 text-[#A0522D]" />
                  <span className="text-gray-700">
                    Remito de Cliente Adjunto: <strong>{remitoSeleccionado.remitoClienteAdjunto.nombre}</strong>
                  </span>
                </div>
                <a
                  href={remitoSeleccionado.remitoClienteAdjunto.data}
                  download={remitoSeleccionado.remitoClienteAdjunto.nombre}
                  className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#00603C] hover:underline cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar Adjunto
                </a>
              </div>
            )}
          </div>

          <div className="border border-gray-200 rounded-xl overflow-hidden mb-8 text-xs text-left">
            <table className="w-full">
              <thead>
                <tr className="bg-[#00603C] text-white uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-4">Lote ID</th>
                  <th className="py-2.5 px-4">Producto / Especie</th>
                  <th className="py-2.5 px-4">Tipo / Tratamiento</th>
                  <th className="py-2.5 px-4 text-center">Envase</th>
                  <th className="py-2.5 px-4 text-right">Bolsas</th>
                  <th className="py-2.5 px-4 text-right">Peso (Kg)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="py-3 px-4 font-mono font-bold text-[#C9922E]">{remitoSeleccionado.loteId}</td>
                  <td className="py-3 px-4">
                    <span className="font-bold text-gray-900 block">{remitoSeleccionado.tipoLote}</span>
                    <span className="text-[10px] text-gray-500 block">Tratado con: {remitoSeleccionado.producto}</span>
                    {(() => {
                      const matchingLote = lotes.find(l => l.id === remitoSeleccionado.loteId);
                      if (matchingLote && matchingLote.ala && matchingLote.sector) {
                        return (
                          <div className="text-[10px] text-[#00603C] font-semibold mt-1 flex items-center gap-1 bg-[#E3EFE7] px-1.5 py-0.5 rounded w-max">
                            Ubicación de Origen: ALA {matchingLote.ala} · SECTOR {matchingLote.sector}
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-gray-700 font-semibold">{remitoSeleccionado.categoria}</span>
                  </td>
                  <td className="py-3 px-4 text-center text-gray-600">{remitoSeleccionado.envase}</td>
                  <td className="py-3 px-4 text-right font-bold text-gray-900">{remitoSeleccionado.cantidadBolsas} b.</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-[#00603C]">
                    {formatNumberArg(remitoSeleccionado.totalKg, 0)} kg
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 gap-8 mt-16 text-center text-xs">
            <div>
              <div className="border-t border-gray-300 w-4/5 mx-auto pt-2">
                <p className="font-semibold text-gray-700">Autorización Despacho de Planta</p>
                <p className="text-gray-400 text-[10px]">Agro Abacus S.A.</p>
              </div>
            </div>
            <div>
              <div className="border-t border-gray-300 w-4/5 mx-auto pt-2">
                <p className="font-semibold text-gray-700">Firma Chofer Conductor</p>
                <p className="text-gray-400 text-[10px]">Recibí Conforme</p>
              </div>
            </div>
          </div>

          <p className="text-center text-[9px] text-gray-400 mt-12 italic">
            Remito de Control Interno emitido en planta. Conserve esta copia para tránsito.
          </p>
        </div>

        {/* Acciones de comprobante */}
        <div className="flex items-center justify-end gap-3 print:hidden">
          <button
            onClick={() => setRemitoSeleccionado(null)}
            className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-500 rounded-lg hover:bg-gray-100 transition"
          >
            Cerrar Copia
          </button>
          
          <button
            onClick={handlePrintRemito}
            className="flex items-center gap-2 px-6 py-2.5 text-xs font-semibold uppercase tracking-wider bg-[#00603C] text-white rounded-lg hover:bg-[#254731] transition shadow-md"
          >
            <Printer className="w-4.5 h-4.5 text-[#C9922E]" />
            Reimprimir Remito
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="salidas-list-container">
      {/* Cabecera */}
      <div className="border-b border-gray-100 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-sans font-semibold tracking-widest text-[#00603C] uppercase">
            MÓDULO DE LOGÍSTICA
          </span>
          <h2 className="font-serif text-3xl font-bold text-[#1A1A1A] mt-1">
            Historial de Salidas Registradas
          </h2>
        </div>

        {salidas.length > 0 && (
          <div className="flex items-center gap-1.5 bg-[#E3EFE7]/40 p-1 rounded-xl border border-[#00603C]/20 shrink-0">
            <button
              onClick={handleExportExcel}
              className="flex items-center justify-center gap-1.5 text-xs font-sans font-bold bg-[#00603C] text-white hover:bg-[#254731] px-3.5 py-2 rounded-lg transition shadow-2xs cursor-pointer"
              title="Exportar todas las salidas despachadas a Excel (.xlsx) con celdas separadas"
            >
              <Download className="w-4 h-4 text-[#C9922E]" />
              <span>Exportar Excel (.xlsx)</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center justify-center gap-1 text-xs font-sans font-semibold text-[#00603C] hover:bg-[#00603C]/10 px-2.5 py-2 rounded-lg transition cursor-pointer"
              title="Exportar archivo CSV"
            >
              <span>CSV</span>
            </button>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        
        {/* Filtrar Fecha */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
            <Calendar className="w-4 h-4" />
          </span>
          <input
            type="date"
            value={filterFecha}
            onChange={(e) => setFilterFecha(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C] h-10"
            placeholder="Filtrar por fecha"
          />
        </div>

        {/* Filtrar Cliente */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={filterCliente}
            onChange={(e) => setFilterCliente(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C] h-10"
            placeholder="Buscar por cliente/comitente..."
          />
        </div>

        {/* Filtrar Conductor */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
            <User className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={filterChofer}
            onChange={(e) => setFilterChofer(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C] h-10"
            placeholder="Buscar por conductor/chofer..."
          />
        </div>

      </div>

      {/* Resultados */}
      {filteredSalidas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-50 text-[#C9922E]" />
          <h4 className="font-serif text-lg font-bold text-gray-700 mb-1">Sin Despachos</h4>
          <p className="text-xs">No se registraron salidas que coincidan con las fechas o términos buscados.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#00603C] text-white font-sans uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">N° Remito</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Cliente / Comitente</th>
                  <th className="py-3 px-4">Lote ID</th>
                  <th className="py-3 px-4">Chofer Conductor</th>
                  <th className="py-3 px-4">Patente</th>
                  <th className="py-3 px-4 text-right">Bolsas</th>
                  <th className="py-3 px-4 text-right">Peso Total</th>
                  <th className="py-3 px-4 text-center">Adjunto</th>
                  <th className="py-3 px-4 text-center">Remito</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSalidas.map((s, idx) => (
                  <tr
                    key={s.id}
                    className={idx % 2 === 0 ? 'bg-white' : 'bg-[#E3EFE7] bg-opacity-30'}
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-[#A0522D]">{s.id}</td>
                    <td className="py-3.5 px-4 font-semibold text-gray-600">{formatDateStr(s.fecha)}</td>
                    <td className="py-3.5 px-4 font-bold text-gray-800">{s.cliente}</td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-gray-700">
                      <div>{s.loteId}</div>
                      {(() => {
                        const matchingLote = lotes.find(l => l.id === s.loteId);
                        if (matchingLote && matchingLote.ala && matchingLote.sector) {
                          return (
                            <span className="inline-flex items-center gap-0.5 font-sans font-bold text-[#00603C] bg-[#E3EFE7] px-1 py-0.5 rounded text-[9px] mt-0.5">
                              ALA {matchingLote.ala} · SEC {matchingLote.sector}
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-gray-900">{s.choferNombre}</td>
                    <td className="py-3.5 px-4 font-mono uppercase text-gray-600">{s.patenteCamion || '—'}</td>
                    <td className="py-3.5 px-4 text-right font-bold text-gray-800">{s.cantidadBolsas} b.</td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-[#00603C]">
                      {formatNumberArg(s.totalKg, 0)} kg
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {s.remitoClienteAdjunto ? (
                        <a
                          href={s.remitoClienteAdjunto.data}
                          download={s.remitoClienteAdjunto.nombre}
                          className="inline-flex p-1.5 text-[#00603C] hover:bg-[#E3EFE7] rounded-md transition"
                          title={`Descargar remito de cliente: ${s.remitoClienteAdjunto.nombre}`}
                        >
                          <Paperclip className="w-4 h-4 text-[#C9922E]" />
                        </a>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => setRemitoSeleccionado(s)}
                        className="p-1.5 text-[#00603C] hover:bg-[#E3EFE7] hover:text-[#254731] rounded-md transition"
                        title="Ver Remito Impreso"
                      >
                        <Printer className="w-4.5 h-4.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
