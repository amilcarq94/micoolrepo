/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Lote, MovimientoStock, EstadoLoteType, AuditLogEntry, OrdenProceso, MovimientoSilo } from '../types';
import { getLoteAuditoria } from '../utils/audit';
import { formatNumberArg, formatKg, formatBolsas, formatDateStr } from '../utils/formatters';
import { LogoSiloLoose } from './Logo';
import { ArrowLeft, ArrowUpRight, ArrowDownRight, Printer, Plus, AlertCircle, Trash2, ShieldCheck, Download, QrCode, Barcode, Clock, User, Edit2, X, Warehouse, FileText, FileSpreadsheet, Package, Loader2, RotateCcw, Check, CheckCircle, SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react';
import { QrCodeModal } from './QrCodeModal';
import { BarcodeLabelModal } from './BarcodeLabelModal';
import { FichaTecnicaOficialCard } from './FichaTecnicaOficialCard';
import { ImprimirFichaTecnica } from './ImprimirFichaTecnica';
import { QrTrazabilidadLote } from './QrTrazabilidadLote';
import { exportWithHtml2Pdf } from '../utils/exportPdf';
import { printWithActiveClass } from '../utils/printHelper';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

const CustomLineTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[#1A1A1A] text-white p-3 rounded-xl border border-gray-800 text-xs shadow-xl font-sans text-left">
        <p className="font-bold text-[#C9922E] uppercase tracking-wider mb-1.5">{formatDateStr(data.date)}</p>
        <p className="flex justify-between gap-6 my-0.5">
          <span className="text-gray-400 font-medium">Stock en Bolsas:</span>
          <span className="font-mono font-bold text-white">{formatNumberArg(data.bolsas, 0)} b.</span>
        </p>
        <p className="flex justify-between gap-6">
          <span className="text-gray-400 font-medium">Equivalente Kg:</span>
          <span className="font-mono font-bold text-white">{formatNumberArg(data.kg, 0)} kg</span>
        </p>
        {data.detalle && (
          <p className="text-[10px] text-gray-400 italic border-t border-gray-800 mt-1.5 pt-1 max-w-[200px] truncate">
            {data.detalle}
          </p>
        )}
      </div>
    );
  }
  return null;
};

interface LoteDetailProps {
  lote: Lote;
  ordenesProceso?: OrdenProceso[];
  movimientosSilo?: MovimientoSilo[];
  readOnly?: boolean;
  onBack: () => void;
  onUpdateLoteStock: (loteId: string, nuevosMovimientos: MovimientoStock[], nuevoStockBolsas: number, nuevoStockKg: number, nuevoEstado: EstadoLoteType) => void;
  onRegistrarSalida?: (loteId: string) => void;
  onUpdateLoteLocation?: (loteId: string, ala: string, sector: string) => Promise<void>;
  onNavigateToOrdenesProceso?: (ordenId?: string) => void;
  onNavigateToSilos?: (siloId?: string) => void;
}

export const LoteDetail: React.FC<LoteDetailProps> = ({
  lote,
  ordenesProceso,
  movimientosSilo,
  readOnly = false,
  onBack,
  onUpdateLoteStock,
  onRegistrarSalida,
  onUpdateLoteLocation,
  onNavigateToOrdenesProceso,
  onNavigateToSilos,
}) => {
  const [showAddMovModal, setShowAddMovModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [selectedAla, setSelectedAla] = useState(lote.ala || '');
  const [selectedSector, setSelectedSector] = useState(lote.sector || '');
  const [fecha, setFecha] = useState(() => new Date().toISOString().split('T')[0]);
  const [tipoMov, setTipoMov] = useState<'Entrada manual' | 'Salida' | 'Ajuste'>('Entrada manual');
  const [bolsas, setBolsas] = useState<number>(50);
  const [kgBolsa, setKgBolsa] = useState<number>(lote.kgPorBolsa || 40);
  const [detalle, setDetalle] = useState('');
  const [error, setError] = useState('');
  const [isPrintingMode, setIsPrintingMode] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // Estado borrador para la Ficha Técnica (permite previsualización y edición antes de imprimir o descargar)
  const [draftFichaLote, setDraftFichaLote] = useState<Lote>(lote);
  const [showEditFichaDrawer, setShowEditFichaDrawer] = useState(false);
  const [showEditFichaModal, setShowEditFichaModal] = useState(false);
  const [showImprimirFichaModal, setShowImprimirFichaModal] = useState(false);
  const [initialFichaEditMode, setInitialFichaEditMode] = useState(false);
  const [fichaModificada, setFichaModificada] = useState(false);

  // Sincronizar draft si cambia el lote original de props
  useEffect(() => {
    setDraftFichaLote(lote);
    setFichaModificada(false);
  }, [lote]);

  const handleUpdateDraftField = (field: string, value: any) => {
    setDraftFichaLote((prev: any) => {
      const updated = { ...prev, [field]: value };
      if (field === 'stockBolsas' || field === 'kgPorBolsa') {
        const b = field === 'stockBolsas' ? Number(value) || 0 : prev.stockBolsas || 0;
        const k = field === 'kgPorBolsa' ? Number(value) || 0 : prev.kgPorBolsa || 40;
        updated.stockKg = b * k;
      }
      return updated;
    });
    setFichaModificada(true);
  };

  const handleResetDraft = () => {
    setDraftFichaLote(lote);
    setFichaModificada(false);
  };

  const handleConfirmarYPrevisualizar = () => {
    setShowEditFichaModal(false);
    setShowEditFichaDrawer(false);
    setIsPrintingMode(true);
  };

  // Resolver vincular Orden de Proceso, Silo de Origen y Bolsón de Origen
  const linkedOp = ordenesProceso?.find(
    (o) => o.id === lote.ordenProcesoId || o.numeroOrden === lote.ordenProcesoId
  );

  const ordenProcesoMovimientoDisplay = linkedOp
    ? linkedOp.tipoOrden === 'MOVIMIENTO'
      ? linkedOp.numeroOrdenMovimiento || `OM-${linkedOp.numeroOrden}`
      : `OP-${linkedOp.numeroOrden}`
    : lote.numeroOrdenMovimiento
    ? lote.numeroOrdenMovimiento
    : lote.ordenProcesoId
    ? `OP-${lote.ordenProcesoId}`
    : 'Sin dato';

  // Buscar registro previo en movimientosSilo si la OP proviene de silos de ingreso
  const targetSilos = new Set<string>();
  if (lote.silosOrigen) lote.silosOrigen.forEach((s) => targetSilos.add(s.siloId));
  if (linkedOp?.silosOrigen) linkedOp.silosOrigen.forEach((s) => targetSilos.add(s.siloId));

  const ingresoPrevioSilo = movimientosSilo
    ?.filter((m) => m.tipo === 'INGRESO' && targetSilos.has(m.siloId) && m.bolsonOrigenNro)
    .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))[0];

  const bolsonOrigenDisplay =
    lote.numeroBolsonOrigen ||
    lote.bolsonOrigenNro ||
    (linkedOp as any)?.numeroBolsonOrigen ||
    (linkedOp as any)?.bolsonOrigenNro ||
    ingresoPrevioSilo?.bolsonOrigenNro ||
    'Sin dato';

  const [activeTab, setActiveTab] = useState<'stock' | 'audit'>('stock');

  // Calcular evolución del stock a lo largo del tiempo
  const sortedMovs = [...lote.historial].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const timeline: { date: string; bolsas: number; kg: number; detalle: string }[] = [];

  if (sortedMovs.length > 0) {
    try {
      const firstMovDate = new Date(sortedMovs[0].fecha);
      const prevDate = new Date(firstMovDate);
      prevDate.setDate(prevDate.getDate() - 1);
      const prevDateStr = prevDate.toISOString().split('T')[0];
      timeline.push({
        date: prevDateStr,
        bolsas: 0,
        kg: 0,
        detalle: 'Lote inicializado'
      });
    } catch (e) {
      // Fallback
    }
  }

  let runningBolsas = 0;
  let runningKg = 0;

  sortedMovs.forEach((mov) => {
    const isAddition = mov.tipo.includes('Entrada') || mov.tipo === 'Reingreso';
    const bolsasChange = isAddition ? mov.cantidadBolsas : -mov.cantidadBolsas;
    const kgChange = isAddition ? mov.cantidadKg : -mov.cantidadKg;
    
    runningBolsas += bolsasChange;
    runningKg += kgChange;
    
    timeline.push({
      date: mov.fecha,
      bolsas: runningBolsas,
      kg: runningKg,
      detalle: mov.detalle || mov.tipo
    });
  });

  const getEstadoBadgeStyle = (estado: EstadoLoteType) => {
    switch (estado) {
      case 'Disponible':
        return 'bg-[#E3EFE7] text-[#00603C] border-[#00603C]';
      case 'Reservado':
        return 'bg-[#F6EFDC] text-[#C9922E] border-[#C9922E]';
      case 'A Consumo':
        return 'bg-purple-100 text-purple-900 border-purple-400';
      case 'Agotado':
        return 'bg-[#A0522D]/10 text-[#A0522D] border-[#A0522D]';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const handleAgregarMovimiento = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cantBolsas = Number(bolsas);
    const pesoBolsa = Number(kgBolsa);
    if (cantBolsas <= 0 || pesoBolsa <= 0) {
      setError('Las bolsas y el peso por bolsa deben ser valores positivos.');
      return;
    }

    if (tipoMov === 'Salida' && cantBolsas > lote.stockBolsas) {
      setError(`No hay suficiente stock. Intenta extraer ${cantBolsas} b. de un lote con sólo ${lote.stockBolsas} b. disponibles.`);
      return;
    }

    const totalKgMov = cantBolsas * pesoBolsa;
    
    // Calcular nuevos valores de stock
    let nuevoStockBolsas = lote.stockBolsas;
    let nuevoStockKg = lote.stockKg;

    if (tipoMov === 'Entrada manual') {
      nuevoStockBolsas += cantBolsas;
      nuevoStockKg += totalKgMov;
    } else if (tipoMov === 'Salida' || tipoMov === 'Pasado a Consumo') {
      nuevoStockBolsas -= cantBolsas;
      nuevoStockKg -= totalKgMov;
    } else { // Ajuste
      // Si es ajuste, resta stock
      nuevoStockBolsas -= cantBolsas;
      nuevoStockKg -= totalKgMov;
    }

    // Determinar nuevo estado del lote
    let nuevoEstado: EstadoLoteType = lote.estado;
    if (nuevoStockBolsas === 0) {
      nuevoEstado = 'Agotado';
    } else if (lote.estado === 'Agotado' && nuevoStockBolsas > 0) {
      nuevoEstado = 'Disponible';
    }

    // Agregar movimiento al historial
    const nuevoMovimiento: MovimientoStock = {
      id: `MOV-${Date.now()}`,
      fecha,
      tipo: tipoMov,
      cantidadBolsas: cantBolsas,
      kgPorBolsa: pesoBolsa,
      cantidadKg: totalKgMov,
      detalle: detalle.trim() || `${tipoMov} - Ajuste de inventario manual`
    };

    const nuevoHistorial = [nuevoMovimiento, ...lote.historial];

    onUpdateLoteStock(lote.id, nuevoHistorial, nuevoStockBolsas, nuevoStockKg, nuevoEstado);
    
    // Resetear formulario
    setShowAddMovModal(false);
    setBolsas(50);
    setDetalle('');
  };

  // Descargar PDF de alta calidad utilizando html2pdf.js sobre el contenedor .ficha-a4
  const handleDownloadPdf = async () => {
    try {
      setIsDownloadingPdf(true);
      const safeLoteName = (draftFichaLote.loteNro || draftFichaLote.id || 'Lote').replace(/\s+/g, '_');
      const fileName = `Ficha_Lote_${safeLoteName}.pdf`;

      // Seleccionar el contenedor con la clase .ficha-a4 o el ID de la ficha oficial
      const targetElement =
        (document.querySelector('.ficha-a4') as HTMLElement) ||
        document.getElementById(`ficha-detail-card-${lote.id}`) ||
        document.getElementById(`ficha-print-direct-${lote.id}`);

      if (targetElement) {
        await exportWithHtml2Pdf(targetElement, fileName, {
          scale: 2.0,
          quality: 0.98,
          margin: [6, 8, 6, 8],
        });
      } else {
        setShowImprimirFichaModal(true);
      }
    } catch (err) {
      console.error('Error al exportar a PDF con html2pdf.js:', err);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Función para abrir vista de impresión
  const handlePrintFicha = (openEditor = false) => {
    setIsPrintingMode(true);
    setShowEditFichaDrawer(openEditor);
    if (!openEditor) {
      setTimeout(() => {
        printWithActiveClass(`ficha-detail-card-${lote.id}`);
      }, 400);
    }
  };

  if (isPrintingMode) {
    // Vista limpia para imprimir (Ficha de Lote - Plantilla A4 Fija) con panel de edición pre-impresión
    return (
      <div className="min-h-screen bg-gray-50 py-6 px-4 print:p-0 print:bg-white print:min-h-0">
        {/* Barra de Acciones de Impresión - Visible en pantalla, Oculta al imprimir */}
        <div className="actions-bar max-w-4xl mx-auto mb-4 flex flex-col gap-3 bg-white border border-gray-200 p-4 rounded-xl shadow-xs print:hidden" id="ficha-actions-bar-printing">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#E3EFE7] rounded-lg">
                <Printer className="w-5 h-5 text-[#00603C]" />
              </div>
              <div className="text-left">
                <h3 className="font-serif text-sm font-bold text-gray-800 uppercase tracking-wide flex items-center gap-2">
                  <span>Vista de Impresión (A4)</span>
                  {fichaModificada && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 text-[10px] rounded-full font-bold normal-case">
                      Ficha personalizada
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-gray-500 font-medium">
                  Lote: <strong className="font-mono text-[#00603C]">{draftFichaLote.loteNro || draftFichaLote.id}</strong> · {draftFichaLote.cliente || 'Agro Abacus'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => setShowEditFichaDrawer(!showEditFichaDrawer)}
                className={`px-3.5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition border flex items-center gap-1.5 cursor-pointer ${
                  showEditFichaDrawer
                    ? 'bg-[#00603C] text-white border-[#00603C]'
                    : 'bg-emerald-50 text-[#00603C] border-emerald-300 hover:bg-emerald-100'
                }`}
                title="Editar los datos que aparecerán en la Ficha Técnica antes de imprimir o descargar"
              >
                <Edit2 className="w-3.5 h-3.5 text-[#C9922E]" />
                <span>{showEditFichaDrawer ? 'Ocultar Editor' : 'Editar Ficha'}</span>
                {showEditFichaDrawer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              <button
                type="button"
                onClick={() => setIsPrintingMode(false)}
                className="px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-gray-600 hover:text-gray-800 hover:bg-gray-100 border border-gray-200 rounded-lg transition cursor-pointer"
              >
                Volver
              </button>

              {/* Botón Descargar PDF con html2pdf.js */}
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isDownloadingPdf}
                className="px-4 py-2 text-xs font-semibold uppercase tracking-wider bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Exportar el contenedor .ficha-a4 a un PDF de alta calidad con html2pdf.js"
                id="btn-descargar-pdf-printing"
              >
                {isDownloadingPdf ? (
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                ) : (
                  <Download className="w-4 h-4 text-amber-400" />
                )}
                <span>{isDownloadingPdf ? 'Generando PDF...' : 'Descargar PDF'}</span>
              </button>

              {/* Botón Imprimir con window.print() y clase temporal print-active */}
              <button
                type="button"
                onClick={() => printWithActiveClass(`ficha-detail-card-${lote.id}`)}
                className="px-5 py-2 text-xs font-semibold uppercase tracking-wider bg-[#00603C] hover:bg-[#004D30] text-white rounded-lg transition shadow-sm flex items-center gap-1.5 cursor-pointer"
                id="btn-imprimir-ficha-printing"
              >
                <Printer className="w-4 h-4 text-[#C9922E]" />
                <span>Imprimir</span>
              </button>
            </div>
          </div>

          {/* Panel Desplegable: Editar Ficha Técnica Antes de Imprimir */}
          {showEditFichaDrawer && (
            <div className="border-t border-gray-200 pt-4 mt-2 animate-in fade-in slide-in-from-top-2 duration-200 text-left">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-[#00603C]" />
                  <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                    Editar Datos de la Ficha Técnica (Edición previa a Impresión)
                  </h4>
                </div>
                <div className="flex items-center gap-2">
                  {fichaModificada && (
                    <button
                      type="button"
                      onClick={handleResetDraft}
                      className="text-xs text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Restablecer originales
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-xs bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">N° de Lote</label>
                  <input
                    type="text"
                    value={draftFichaLote.loteNro || ''}
                    onChange={(e) => handleUpdateDraftField('loteNro', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg font-bold text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Cliente</label>
                  <input
                    type="text"
                    value={draftFichaLote.cliente || ''}
                    onChange={(e) => handleUpdateDraftField('cliente', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg font-bold text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Especie</label>
                  <input
                    type="text"
                    value={draftFichaLote.especie || ''}
                    onChange={(e) => handleUpdateDraftField('especie', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg font-semibold text-gray-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Variedad</label>
                  <input
                    type="text"
                    value={draftFichaLote.variedad || ''}
                    onChange={(e) => handleUpdateDraftField('variedad', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg font-semibold text-gray-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Categoría</label>
                  <input
                    type="text"
                    value={draftFichaLote.categoria || ''}
                    onChange={(e) => handleUpdateDraftField('categoria', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg font-semibold text-gray-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Tipo de Lote</label>
                  <input
                    type="text"
                    value={draftFichaLote.tipo || ''}
                    onChange={(e) => handleUpdateDraftField('tipo', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg font-semibold text-gray-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Tratamiento / Curado</label>
                  <input
                    type="text"
                    value={Array.isArray(draftFichaLote.tratamiento) ? draftFichaLote.tratamiento.join(', ') : (draftFichaLote.tratamiento as any) || ''}
                    onChange={(e) => handleUpdateDraftField('tratamiento', e.target.value.split(',').map(s => s.trim()))}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg font-semibold text-gray-800"
                    placeholder="Sin Tratar, Curado..."
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Producto Químico</label>
                  <input
                    type="text"
                    value={draftFichaLote.producto || ''}
                    onChange={(e) => handleUpdateDraftField('producto', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg font-semibold text-gray-800"
                    placeholder="Ninguno, Maxim XL..."
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">N° Orden Proceso/Mov.</label>
                  <input
                    type="text"
                    value={draftFichaLote.ordenProcesoId || (draftFichaLote as any).numeroOrdenMovimiento || (draftFichaLote as any).ordenProceso || ''}
                    onChange={(e) => handleUpdateDraftField('ordenProcesoId', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg font-semibold text-gray-800 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">N° Bolsón Origen</label>
                  <input
                    type="text"
                    value={(draftFichaLote as any).numeroBolsonOrigen || (draftFichaLote as any).bolsonOrigenNro || ''}
                    onChange={(e) => handleUpdateDraftField('numeroBolsonOrigen', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg font-semibold text-gray-800 font-mono"
                    placeholder="B-12, B-34..."
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Sector Bolsón Origen</label>
                  <input
                    type="text"
                    value={(draftFichaLote as any).sectorBolsonOrigen || ''}
                    onChange={(e) => handleUpdateDraftField('sectorBolsonOrigen', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg font-semibold text-gray-800"
                    placeholder="Ala A - Sector 1"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Ubicación de Acopio</label>
                  <input
                    type="text"
                    value={(draftFichaLote as any).ubicacionAcopio || (draftFichaLote.ala && draftFichaLote.sector ? `Ala ${draftFichaLote.ala} - Sector ${draftFichaLote.sector}` : '')}
                    onChange={(e) => handleUpdateDraftField('ubicacionAcopio', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg font-semibold text-gray-800"
                    placeholder="Ala A - Sector 1"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Cantidad de Bolsas</label>
                  <input
                    type="number"
                    min="1"
                    value={draftFichaLote.stockBolsas || 0}
                    onChange={(e) => handleUpdateDraftField('stockBolsas', Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg font-bold text-gray-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Kg por Bolsa</label>
                  <input
                    type="number"
                    min="1"
                    value={draftFichaLote.kgPorBolsa || 40}
                    onChange={(e) => handleUpdateDraftField('kgPorBolsa', Math.max(1, parseInt(e.target.value, 10) || 0))}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg font-bold text-gray-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Fecha Realizado / Ingreso</label>
                  <input
                    type="date"
                    value={draftFichaLote.fechaIngreso || ''}
                    onChange={(e) => handleUpdateDraftField('fechaIngreso', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg font-semibold text-gray-800"
                  />
                </div>

                <div className="sm:col-span-2 md:col-span-3 lg:col-span-4">
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Observaciones / Notas de la Ficha</label>
                  <textarea
                    rows={2}
                    value={draftFichaLote.observaciones || ''}
                    onChange={(e) => handleUpdateDraftField('observaciones', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg font-semibold text-gray-800 text-xs resize-none"
                    placeholder="Notas técnicas adicionales, destino especial, especificaciones de curado o acopio..."
                  />
                </div>
              </div>

              {/* Botón Confirmar y Previsualizar Impresión */}
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={handleConfirmarYPrevisualizar}
                  className="px-4 py-2 bg-[#00603C] hover:bg-[#254731] text-white text-xs font-bold uppercase tracking-wider rounded-lg transition shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4 text-[#C9922E]" />
                  <span>Confirmar y Previsualizar Impresión</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Estilos CSS Específicos para Impresión A4 de Hoja Única */}
        <style>{`
          @media print {
            body, html {
              background: #ffffff !important;
              margin: 0 !important;
              padding: 0 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            @page {
              size: A4 portrait;
              margin: 8mm 10mm 8mm 10mm;
            }
            header, nav, footer, button, .print\\:hidden, #nav-tab-dashboard, #nav-tab-lotes, #nav-tab-despachos, #nav-tab-historial-salidas, #nav-tab-importar, #lotes-stats-summary-bar {
              display: none !important;
            }
            .batch-print-page-break {
              page-break-after: always !important;
              break-after: page !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              max-height: 275mm !important;
              overflow: hidden !important;
              box-sizing: border-box !important;
            }
            .batch-print-page-break:last-child {
              page-break-after: auto !important;
              break-after: auto !important;
            }
          }
        `}</style>

        {/* Contenedor del Reporte Oficial Definitivo */}
        <div className="ficha-tecnica-a4-container max-w-4xl mx-auto print:max-w-none print:w-full">
          <FichaTecnicaOficialCard id={`ficha-detail-card-${lote.id}`} lote={draftFichaLote} />
        </div>
      </div>
    );
  }

  const handleDirectPrint = async () => {
    await printWithActiveClass('printable-ficha-lote-detail');
  };

  return (
    <div className="space-y-6" id="lote-detail-container">
      {/* 1. Vista interactiva en pantalla (oculta automáticamente durante @media print) */}
      <div id="lote-detail-interactive-view" className="space-y-6 print:hidden">
        {/* Botón de Retorno y Títulos */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-xs font-bold text-[#00603C] hover:text-[#254731] uppercase tracking-wider self-start cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver al Listado</span>
            </button>
            <span className="text-gray-300 hidden sm:inline">|</span>
            <h1 className="text-sm sm:text-base font-serif font-black text-slate-800 tracking-wide uppercase">
              FICHA TECNICA DE LOTE
            </h1>
          </div>

          {/* Barra de Acciones Superior: VER FICHA TECNICA */}
          <div className="flex flex-wrap items-center gap-2.5" id="lote-detail-actions-bar">
            {/* Botón VER FICHA TECNICA */}
            <button
              id="btn-ver-ficha-lotedetail"
              onClick={() => {
                setInitialFichaEditMode(false);
                setShowImprimirFichaModal(true);
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#00603C] text-white border border-[#00603C] hover:bg-[#004D30] rounded-xl transition text-xs font-black uppercase tracking-wider shadow-xs cursor-pointer active:scale-95"
              title="Previsualizar Ficha Técnica Oficial del Lote en pantalla e imprimir"
            >
              <FileText className="w-4 h-4 text-[#C9922E]" />
              <span>VER FICHA TECNICA</span>
            </button>
          </div>
        </div>

      {/* Grid de Contenido de Ficha */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Panel Izquierdo: Ficha Técnica */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden relative">
          
          {/* Marca de agua sutil en la tarjeta técnica */}
          <div className="absolute right-3 bottom-3 opacity-[0.04] pointer-events-none">
            <LogoSiloLoose size={120} color="#00603C" />
          </div>

          <div className="bg-[#00603C] p-5 text-white">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-mono font-bold text-emerald-200 tracking-wider">
                ID: {lote.id}
              </span>
              <span className={`px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full border bg-white text-[#00603C] border-white shadow-sm`}>
                {lote.estado}
              </span>
            </div>
            {/* N° DE LOTE GRANDE */}
            <div className="mt-4 mb-3">
              <span className="text-[10px] font-sans font-bold tracking-widest text-[#C9922E] uppercase block mb-0.5">NÚMERO DE LOTE</span>
              <h2 className="font-mono text-5xl sm:text-6xl font-black text-white tracking-tighter leading-none bg-black bg-opacity-20 px-3 py-2 rounded-xl inline-block border border-white border-opacity-10">
                {lote.loteNro}
              </h2>
            </div>
            <h3 className="font-serif text-xl font-bold flex items-center gap-2 flex-wrap">
              <span>{lote.especie} · <span className="font-sans font-normal text-sm text-gray-200">{lote.variedad}</span></span>
              {lote.categoria && (
                <span className="px-2 py-0.5 bg-[#C9922E] text-white text-[10px] font-sans font-extrabold uppercase rounded border border-amber-300/40">
                  Cat: {lote.categoria}
                </span>
              )}
            </h3>
            <p className="text-xs text-gray-300 mt-1">{lote.cliente}</p>
          </div>

          <div className="p-5 space-y-4 text-xs">
            <div>
              <span className="text-[9px] uppercase tracking-wider text-gray-400 block font-bold">Categoría</span>
              <span className="font-extrabold text-[#00603C] text-sm block mt-0.5 uppercase">{lote.categoria || 'Sin especificar'}</span>
            </div>

            <div>
              <span className="text-[9px] uppercase tracking-wider text-gray-400 block font-bold">Tipo de Lote</span>
              <span className="font-semibold text-gray-800 text-sm block mt-0.5">{lote.tipo}</span>
            </div>

            <div className="border-t border-gray-50 pt-3">
              <span className="text-[9px] uppercase tracking-wider text-gray-400 block font-bold">Tratamiento del Lote</span>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {lote.tratamiento.map((t, idx) => (
                  <span key={idx} className="bg-[#E3EFE7] text-[#00603C] px-2 py-0.5 rounded text-[10px] font-semibold">
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-50 pt-3">
              <span className="text-[9px] uppercase tracking-wider text-gray-400 block font-bold">Producto Químico Aplicado</span>
              <span className="font-medium text-gray-700 text-sm block mt-0.5">{lote.producto}</span>
            </div>

            <div className="border-t border-gray-50 pt-3">
              <span className="text-[9px] uppercase tracking-wider text-gray-400 block font-bold">Fecha de Ingreso</span>
              <span className="font-medium text-gray-700 block mt-0.5">{formatDateStr(lote.fechaIngreso)}</span>
            </div>

            <div className="border-t border-gray-50 pt-3">
              <span className="text-[9px] uppercase tracking-wider text-gray-400 block font-bold">Sector de Acopio / Ubicación</span>
              <span className="font-semibold text-[#00603C] text-sm block mt-0.5 flex items-center gap-1.5">
                <Warehouse className="w-3.5 h-3.5 text-[#C9922E]" />
                {lote.ala && lote.sector ? `ALA: ${lote.ala} / SECTOR: ${lote.sector}` : 'No asignado'}
              </span>
            </div>

            <div className="border-t border-gray-50 pt-3">
              <span className="text-[9px] uppercase tracking-wider text-gray-400 block font-bold">Peso Promedio Bolsa</span>
              <span className="font-medium text-gray-700 block mt-0.5">{lote.kgPorBolsa || 40} kg por bolsa</span>
            </div>

            <div className="border-t border-gray-50 pt-3">
              <span className="text-[9px] uppercase tracking-wider text-gray-400 block font-bold">% Humedad del Lote</span>
              <span className="font-semibold text-gray-800 text-sm block mt-0.5">
                {lote.humedad !== undefined ? `${lote.humedad}%` : '13.5%'}
                <span className="text-[10px] text-gray-400 font-normal ml-1.5">(Dato Informativo)</span>
              </span>
            </div>

            {/* Sección: Vinculación y Origen de Proceso / Silo / Bolsón */}
            <div className="border-t border-gray-100 pt-3 mt-3 bg-[#E3EFE7]/40 p-3.5 rounded-xl border border-[#00603C]/15">
              <span className="text-[9.5px] uppercase tracking-wider text-[#00603C] block font-bold mb-2 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#C9922E]" />
                Trazabilidad y Origen de Carga
              </span>

              <div className="space-y-2 text-xs">
                {/* N° Orden de Proceso / Movimiento */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-gray-500 font-medium shrink-0">N° Orden / Mov:</span>
                  {onNavigateToOrdenesProceso && ordenProcesoMovimientoDisplay !== 'Sin dato' ? (
                    <button
                      type="button"
                      onClick={() => onNavigateToOrdenesProceso(lote.ordenProcesoId || linkedOp?.id)}
                      className="font-bold text-[#00603C] hover:underline bg-white px-2 py-0.5 rounded border border-[#00603C]/20 flex items-center gap-1 cursor-pointer truncate max-w-[170px]"
                      title="Navegar al detalle de la Orden de Proceso / Movimiento"
                    >
                      <span className="truncate">{ordenProcesoMovimientoDisplay}</span>
                      <ArrowUpRight className="w-3 h-3 text-[#C9922E] shrink-0" />
                    </button>
                  ) : (
                    <span className="font-semibold text-gray-800 font-mono text-[11px] truncate max-w-[170px]">
                      {ordenProcesoMovimientoDisplay}
                    </span>
                  )}
                </div>

                {/* N° de Bolsón de origen */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-gray-500 font-medium shrink-0">N° Bolsón Origen:</span>
                  <span className="font-mono font-bold text-gray-800 bg-white px-2 py-0.5 rounded border border-gray-200 text-[11px] truncate max-w-[170px]">
                    {bolsonOrigenDisplay}
                  </span>
                </div>
              </div>
            </div>

            {/* Cuadro de Observaciones del Lote */}
            {lote.observaciones && (
              <div className="border-t border-gray-50 pt-3">
                <span className="text-[9px] uppercase tracking-wider text-gray-400 block font-bold">Observaciones / Notas</span>
                <div className="mt-1.5 p-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 font-sans leading-relaxed text-xs italic whitespace-pre-wrap">
                  {lote.observaciones}
                </div>
              </div>
            )}

            {/* Código QR de Trazabilidad Oficial (Full Size 300x300 con etiqueta y enlace público) */}
            <div className="border-t border-gray-100 pt-4 mt-4 flex flex-col items-center">
              <div className="w-full flex items-center justify-between mb-2">
                <span className="text-[9.5px] uppercase tracking-wider text-gray-400 font-bold block">
                  Código QR de Trazabilidad
                </span>
                <span className="text-[9px] font-mono font-bold text-[#00603C] bg-[#E3EFE7] px-2 py-0.5 rounded">
                  Oficial
                </span>
              </div>
              <div className="w-full flex justify-center cursor-pointer" onClick={() => setShowQrModal(true)}>
                <QrTrazabilidadLote
                  loteId={lote.id}
                  size={300}
                  className="w-full max-w-[280px]"
                />
              </div>
            </div>

            {/* Botón QR Ficha Técnica Pública */}
            <div className="pt-3">
              <button
                onClick={() => setShowQrModal(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-[#E3EFE7] hover:bg-[#cbe3d3] text-[#00603C] border border-[#00603C]/30 rounded-xl transition font-bold text-xs cursor-pointer shadow-2xs group"
                title="Generar código QR con la URL pública de la ficha técnica del lote para escaneo desde móviles"
              >
                <QrCode className="w-4 h-4 text-[#C9922E] group-hover:scale-110 transition-transform" />
                <span>Generar QR Ficha Técnica Pública</span>
              </button>
            </div>

            {/* Cuadro de Seguridad de Lote */}
            <div className="bg-[#F6EFDC] p-3.5 rounded-xl border border-[#C9922E] border-opacity-20 flex gap-2.5 mt-6">
              <ShieldCheck className="w-5 h-5 text-[#C9922E] shrink-0" />
              <div>
                <span className="font-bold text-[#C9922E] block uppercase tracking-wider text-[9px]">Garantía La Barrancosa</span>
                <span className="text-[10px] text-gray-600 block mt-0.5">Semilla clasificada con estándares de pureza y calidad Agro Abacus S.A.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Panel Derecho: Saldos y Tabla Historial */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Tarjetas de Saldo de Stock */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#E3EFE7] p-5 rounded-2xl border border-[#00603C] border-opacity-10 shadow-sm text-center">
              <span className="text-[10px] font-bold text-[#00603C] uppercase tracking-wider block">Existencias (Bolsas)</span>
              <span className="font-serif text-2xl font-bold text-[#00603C] mt-1.5 block">
                {formatNumberArg(lote.stockBolsas, 0)} b.
              </span>
            </div>
            <div className="bg-[#F6EFDC] p-5 rounded-2xl border border-[#C9922E] border-opacity-10 shadow-sm text-center">
              <span className="text-[10px] font-bold text-[#C9922E] uppercase tracking-wider block">Existencias (Kilogramos)</span>
              <span className="font-serif text-2xl font-bold text-[#C9922E] mt-1.5 block">
                {formatNumberArg(lote.stockKg, 0)} kg
              </span>
            </div>
          </div>

          {/* Historial de Movimientos y Auditoría de Eventos */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-3">
              <h4 className="font-serif text-base font-bold text-[#1A1A1A] uppercase tracking-wide">
                Auditoría y Trazabilidad de Lote
              </h4>
              
              {/* Selector de Pestañas */}
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg text-xs font-semibold self-start sm:self-center">
                <button
                  type="button"
                  onClick={() => setActiveTab('stock')}
                  className={`px-3 py-1.5 rounded-md transition duration-200 ${
                    activeTab === 'stock'
                      ? 'bg-[#00603C] text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Existencias y Stock
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('audit')}
                  className={`px-3 py-1.5 rounded-md transition duration-200 flex items-center gap-1.5 ${
                    activeTab === 'audit'
                      ? 'bg-[#00603C] text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Bitácora Completa
                  <span className={`inline-flex items-center justify-center px-1.5 py-0.25 text-[9px] font-bold rounded-full ${
                    activeTab === 'audit' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {getLoteAuditoria(lote).length}
                  </span>
                </button>
              </div>
            </div>

            {activeTab === 'stock' ? (
              <div className="space-y-6">
                {/* Gráfico de Evolución del Stock */}
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-4">
                    <div>
                      <span className="text-[10px] font-sans font-semibold tracking-wider text-[#00603C] uppercase block">
                        CURVA DE EXISTENCIAS
                      </span>
                      <h5 className="font-serif text-sm font-bold text-[#1A1A1A] mt-0.5">
                        Evolución Temporal de Stock (Bolsas)
                      </h5>
                    </div>
                    <div className="text-[10px] text-gray-500 font-sans bg-[#F6EFDC]/60 px-2.5 py-1 rounded-md border border-[#C9922E]/10 self-start">
                      Factor: <span className="font-mono font-bold">{lote.kgPorBolsa || 40} kg</span> por bolsa
                    </div>
                  </div>

                  <div className="h-[220px] w-full">
                    {timeline.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={timeline} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                          <XAxis 
                            dataKey="date" 
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(val) => formatDateStr(val)}
                            tick={{ fill: '#6B7280', fontSize: 9, fontWeight: 500 }}
                          />
                          <YAxis 
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: '#6B7280', fontSize: 9, fontWeight: 500 }}
                            tickFormatter={(val) => `${formatNumberArg(val, 0)} b.`}
                          />
                          <Tooltip content={<CustomLineTooltip />} />
                          <Line 
                            type="monotone" 
                            dataKey="bolsas" 
                            stroke="#00603C" 
                            strokeWidth={2.5}
                            activeDot={{ r: 6 }}
                            dot={{ r: 4, strokeWidth: 1.5, fill: '#white', stroke: '#00603C' }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-gray-400 text-xs">
                        Sin movimientos históricos suficientes para graficar.
                      </div>
                    )}
                  </div>
                </div>

                {/* Tabla de Movimientos */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider">
                        <th className="py-2">Fecha</th>
                        <th className="py-2">Operación</th>
                        <th className="py-2 text-right">Bolsas</th>
                        <th className="py-2 text-right">Kilogramos</th>
                        <th className="py-2 pl-4">Detalle / Justificación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {lote.historial.map((mov) => {
                        const isEntrada = mov.tipo.includes('Entrada');
                        return (
                          <tr key={mov.id} className="hover:bg-gray-50">
                            <td className="py-3 font-medium text-gray-600">{formatDateStr(mov.fecha)}</td>
                            <td className="py-3">
                              <span className={`inline-flex items-center gap-1 font-bold ${isEntrada ? 'text-[#00603C]' : 'text-[#A0522D]'}`}>
                                {isEntrada ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                                {mov.tipo}
                              </span>
                            </td>
                            <td className="py-3 text-right font-bold text-gray-700">
                              {isEntrada ? '+' : '-'}{mov.cantidadBolsas}
                            </td>
                            <td className="py-3 text-right font-mono font-semibold text-gray-800">
                              {formatNumberArg(mov.cantidadKg, 0)} kg
                            </td>
                            <td className="py-3 pl-4 text-gray-500 italic max-w-xs truncate" title={mov.detalle}>
                              {mov.detalle}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="flow-root max-h-[400px] overflow-y-auto pr-2">
                <ul className="-mb-8">
                  {getLoteAuditoria(lote).map((event, eventIdx, arr) => {
                    let iconBg = 'bg-gray-100';
                    let iconColor = 'text-gray-600';
                    
                    if (event.tipo === 'Creación') {
                      iconBg = 'bg-[#E3EFE7]';
                      iconColor = 'text-[#00603C]';
                    } else if (event.tipo === 'Edición') {
                      iconBg = 'bg-[#F6EFDC]';
                      iconColor = 'text-[#C9922E]';
                    } else if (event.tipo === 'Stock') {
                      iconBg = 'bg-[#F5E5DC]';
                      iconColor = 'text-[#A0522D]';
                    }

                    // Formatear fecha y hora
                    let displayTime = '';
                    let displayDate = '';
                    try {
                      const dt = new Date(event.fechaHora);
                      if (!isNaN(dt.getTime())) {
                        displayDate = dt.toLocaleDateString('es-AR');
                        displayTime = dt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) + ' hs';
                      } else {
                        displayDate = event.fechaHora;
                      }
                    } catch (e) {
                      displayDate = event.fechaHora;
                    }

                    return (
                      <li key={event.id}>
                        <div className="relative pb-8">
                          {eventIdx !== arr.length - 1 ? (
                            <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-100" aria-hidden="true" />
                          ) : null}
                          <div className="relative flex space-x-3">
                            <div>
                              <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-4 ring-white ${iconBg} ${iconColor}`}>
                                {event.tipo === 'Creación' && <ShieldCheck className="w-4 h-4" />}
                                {event.tipo === 'Edición' && <Edit2 className="w-4 h-4" />}
                                {event.tipo === 'Stock' && <Clock className="w-4 h-4" />}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0 pt-1.5">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                                <div className="text-xs font-semibold text-gray-900">
                                  {event.descripcion}
                                </div>
                                <div className="text-[10px] text-gray-500 font-mono flex items-center gap-1.5">
                                  <span>{displayDate}</span>
                                  <span className="text-gray-300">|</span>
                                  <span>{displayTime}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`inline-flex items-center px-1.5 py-0.25 text-[9px] font-bold rounded-md border uppercase tracking-wider ${
                                  event.tipo === 'Creación'
                                    ? 'bg-[#E3EFE7] text-[#00603C] border-[#00603C]/10'
                                    : event.tipo === 'Edición'
                                    ? 'bg-[#F6EFDC] text-[#C9922E] border-[#C9922E]/10'
                                    : 'bg-[#F5E5DC] text-[#A0522D] border-[#A0522D]/10'
                                }`}>
                                  {event.tipo}
                                </span>
                                <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
                                  <User className="w-3 h-3 text-gray-400" />
                                  {event.usuario}
                                </span>
                              </div>
                              {event.detalles && (
                                <p className="mt-2 text-[11px] text-gray-600 bg-gray-50 p-2.5 rounded-lg border border-gray-100 font-sans leading-relaxed whitespace-pre-wrap">
                                  {event.detalles}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Modal / Panel de Agregar Movimiento Manual */}
      {showAddMovModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-gray-100 animate-in fade-in zoom-in duration-200">
            <div className="border-b border-gray-100 pb-3 mb-4 flex justify-between items-center">
              <h5 className="font-serif text-lg font-bold text-[#1A1A1A]">
                Ajustar Inventario Lote: {lote.id}
              </h5>
              <button
                onClick={() => setShowAddMovModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            {error && (
              <div className="bg-[#F5E5DC] text-[#A0522D] p-3 rounded-lg flex items-start gap-2 text-xs border border-red-100 mb-4">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleAgregarMovimiento} className="space-y-4 text-xs text-left">
              <div>
                <label className="block text-gray-700 font-bold mb-1 uppercase tracking-wide">Fecha de Registro</label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 rounded-lg border border-gray-200"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1 uppercase tracking-wide">Tipo de Operación</label>
                <select
                  value={tipoMov}
                  onChange={(e) => setTipoMov(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-gray-200"
                >
                  <option value="Entrada manual">Entrada manual (+ suma stock)</option>
                  <option value="Salida">Salida manual (- resta stock)</option>
                  <option value="Pasado a Consumo">Pasado a Consumo (- resta stock)</option>
                  <option value="Ajuste">Ajuste de Auditoría (- resta stock)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-bold mb-1 uppercase tracking-wide">Bolsas</label>
                  <input
                    type="number"
                    value={bolsas}
                    onChange={(e) => setBolsas(Math.max(1, parseInt(e.target.value, 10) || 0))}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-gray-200"
                    min="1"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-bold mb-1 uppercase tracking-wide">Kg por Bolsa</label>
                  <input
                    type="number"
                    value={kgBolsa}
                    onChange={(e) => setKgBolsa(Math.max(1, parseInt(e.target.value, 10) || 0))}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-gray-200"
                    min="1"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1 uppercase tracking-wide">Concepto / Detalle *</label>
                <input
                  type="text"
                  value={detalle}
                  onChange={(e) => setDetalle(e.target.value)}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-gray-200"
                  placeholder="Ej: Ajuste por rotura, ingreso manual adicional..."
                  required
                />
              </div>

              <div className="pt-4 border-t border-gray-50 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddMovModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 font-semibold uppercase tracking-wider text-[10px]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#00603C] hover:bg-[#254731] text-white rounded-lg font-semibold uppercase tracking-wider text-[10px]"
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal QR Code */}
      {showQrModal && (
        <QrCodeModal
          lote={lote}
          onClose={() => setShowQrModal(false)}
        />
      )}

      {/* Modal Barcode Label */}
      {showBarcodeModal && (
        <BarcodeLabelModal
          lote={lote}
          onClose={() => setShowBarcodeModal(false)}
        />
      )}

      {/* Modal Asignar Ubicación */}
      {showLocationModal && (
        <div className="fixed inset-0 bg-[#1A1A1A]/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" id="assign-location-modal">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-2xl max-w-md w-full overflow-hidden text-left animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#00603C] to-[#254731] text-white p-5 flex justify-between items-center border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <Warehouse className="w-5 h-5 text-[#C9922E]" />
                <h3 className="font-serif text-base font-extrabold tracking-wide uppercase">
                  Asignar Ubicación de Acopio
                </h3>
              </div>
              <button
                onClick={() => setShowLocationModal(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido */}
            <div className="p-6 space-y-6">
              <div className="text-xs text-gray-500 font-medium leading-relaxed font-sans">
                Asigne el sector de depósito físico en la planta para el lote <strong className="font-mono text-gray-800">LOTE: {lote.loteNro}</strong>. Esto actualizará el mapa de calor y la ficha técnica oficial.
              </div>

              {/* Grid de Ala */}
              <div className="space-y-2.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                  Seleccionar Ala (Sector Lateral)
                </label>
                <div className="grid grid-cols-4 gap-2.5">
                  {['A', 'B', 'C', 'D'].map((alaLetter) => {
                    const isSelected = selectedAla === alaLetter;
                    return (
                      <button
                        key={alaLetter}
                        type="button"
                        onClick={() => setSelectedAla(alaLetter)}
                        className={`py-3.5 px-2 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1 cursor-pointer select-none ${
                          isSelected
                            ? 'bg-[#E3EFE7] border-[#00603C] text-[#00603C] font-extrabold shadow-xs ring-1 ring-[#00603C]'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 font-bold'
                        }`}
                      >
                        <span className="text-[9px] text-gray-400 font-semibold tracking-wider block">ALA</span>
                        <span className="text-xl font-mono leading-none">{alaLetter}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Grid de Sector */}
              <div className="space-y-2.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                  Seleccionar Sector (Número de Celda)
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {['1', '2', '3'].map((sectorNum) => {
                    const isSelected = selectedSector === sectorNum;
                    return (
                      <button
                        key={sectorNum}
                        type="button"
                        onClick={() => setSelectedSector(sectorNum)}
                        className={`py-3.5 px-2 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1 cursor-pointer select-none ${
                          isSelected
                            ? 'bg-[#F6EFDC] border-[#C9922E] text-[#C9922E] font-extrabold shadow-xs ring-1 ring-[#C9922E]'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 font-bold'
                        }`}
                      >
                        <span className="text-[9px] text-gray-400 font-semibold tracking-wider block">SECTOR</span>
                        <span className="text-xl font-mono leading-none">{sectorNum}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Vista previa de ubicación */}
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Ubicación Resultante:</span>
                <span className="font-mono font-bold text-[#00603C] text-sm">
                  {selectedAla && selectedSector ? `ALA ${selectedAla} · SECTOR ${selectedSector}` : 'No seleccionada'}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 p-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowLocationModal(false)}
                className="px-4 py-2 text-xs font-semibold font-sans uppercase tracking-wider text-gray-500 hover:bg-gray-100 rounded-lg transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!selectedAla || !selectedSector}
                onClick={async () => {
                  if (onUpdateLoteLocation) {
                    await onUpdateLoteLocation(lote.id, selectedAla, selectedSector);
                  }
                  setShowLocationModal(false);
                }}
                className="px-5 py-2 text-xs font-semibold font-sans uppercase tracking-wider bg-[#00603C] text-white hover:bg-[#254731] rounded-lg transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
              >
                <Warehouse className="w-4 h-4 text-[#C9922E]" />
                <span>Asignar Ubicación</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Modo Edición de Ficha Técnica antes de Imprimir o Descargar */}
      {showEditFichaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto print:hidden animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden border border-gray-100 my-8">
            {/* Header */}
            <div className="bg-[#00603C] p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl">
                  <Edit2 className="w-5 h-5 text-[#C9922E]" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base uppercase tracking-wider">
                    Modo Edición: Ficha Técnica
                  </h3>
                  <p className="text-xs text-emerald-100/90 font-medium">
                    Edite temporalmente los campos para la ficha técnica, impresión y descarga en PDF
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditFichaModal(false)}
                className="p-1.5 rounded-lg text-emerald-100 hover:bg-white/10 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido del Formulario de Edición */}
            <div className="p-6 max-h-[70vh] overflow-y-auto space-y-5">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-start justify-between gap-3">
                <div>
                  <strong>Modo Edición Temporal:</strong> Los cambios que realice se reflejarán inmediatamente en la previsualización oficial, la impresión A4 y la descarga en PDF.
                </div>
                {fichaModificada && (
                  <button
                    type="button"
                    onClick={handleResetDraft}
                    className="text-xs text-red-600 hover:text-red-700 font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restablecer
                  </button>
                )}
              </div>

              {/* Sección 1: Datos Principales */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 border-b border-gray-100 pb-1">
                  1. Identificación y Clasificación
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">N° de Lote</label>
                    <input
                      type="text"
                      value={draftFichaLote.loteNro || ''}
                      onChange={(e) => handleUpdateDraftField('loteNro', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-bold text-gray-900 focus:bg-white focus:border-[#00603C] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Cliente</label>
                    <input
                      type="text"
                      value={draftFichaLote.cliente || ''}
                      onChange={(e) => handleUpdateDraftField('cliente', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-bold text-gray-900 focus:bg-white focus:border-[#00603C] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Especie</label>
                    <input
                      type="text"
                      value={draftFichaLote.especie || ''}
                      onChange={(e) => handleUpdateDraftField('especie', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-semibold text-gray-800 focus:bg-white focus:border-[#00603C] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Variedad</label>
                    <input
                      type="text"
                      value={draftFichaLote.variedad || ''}
                      onChange={(e) => handleUpdateDraftField('variedad', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-semibold text-gray-800 focus:bg-white focus:border-[#00603C] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Categoría</label>
                    <input
                      type="text"
                      value={draftFichaLote.categoria || ''}
                      onChange={(e) => handleUpdateDraftField('categoria', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-semibold text-gray-800 focus:bg-white focus:border-[#00603C] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Tipo de Lote</label>
                    <input
                      type="text"
                      value={draftFichaLote.tipo || ''}
                      onChange={(e) => handleUpdateDraftField('tipo', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-semibold text-gray-800 focus:bg-white focus:border-[#00603C] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 2: Tratamiento y Origen */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 border-b border-gray-100 pb-1">
                  2. Trazabilidad, Curado y Origen
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Tratamiento / Curado</label>
                    <input
                      type="text"
                      value={Array.isArray(draftFichaLote.tratamiento) ? draftFichaLote.tratamiento.join(', ') : (draftFichaLote.tratamiento as any) || ''}
                      onChange={(e) => handleUpdateDraftField('tratamiento', e.target.value.split(',').map(s => s.trim()))}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-semibold text-gray-800 focus:bg-white focus:border-[#00603C] focus:outline-none"
                      placeholder="Sin Tratar, Curado..."
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Producto Químico</label>
                    <input
                      type="text"
                      value={draftFichaLote.producto || ''}
                      onChange={(e) => handleUpdateDraftField('producto', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-semibold text-gray-800 focus:bg-white focus:border-[#00603C] focus:outline-none"
                      placeholder="Ninguno, Maxim XL..."
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">N° Orden Proceso / Mov.</label>
                    <input
                      type="text"
                      value={draftFichaLote.ordenProcesoId || (draftFichaLote as any).numeroOrdenMovimiento || (draftFichaLote as any).ordenProceso || ''}
                      onChange={(e) => handleUpdateDraftField('ordenProcesoId', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-semibold text-gray-800 font-mono focus:bg-white focus:border-[#00603C] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">N° Bolsón de Origen</label>
                    <input
                      type="text"
                      value={(draftFichaLote as any).numeroBolsonOrigen || (draftFichaLote as any).bolsonOrigenNro || ''}
                      onChange={(e) => handleUpdateDraftField('numeroBolsonOrigen', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-semibold text-gray-800 font-mono focus:bg-white focus:border-[#00603C] focus:outline-none"
                      placeholder="Ej: B-12"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Sector Bolsón Origen</label>
                    <input
                      type="text"
                      value={(draftFichaLote as any).sectorBolsonOrigen || ''}
                      onChange={(e) => handleUpdateDraftField('sectorBolsonOrigen', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-semibold text-gray-800 focus:bg-white focus:border-[#00603C] focus:outline-none"
                      placeholder="Ej: Ala A - Sector 1"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Ubicación de Acopio</label>
                    <input
                      type="text"
                      value={(draftFichaLote as any).ubicacionAcopio || (draftFichaLote.ala && draftFichaLote.sector ? `Ala ${draftFichaLote.ala} - Sector ${draftFichaLote.sector}` : '')}
                      onChange={(e) => handleUpdateDraftField('ubicacionAcopio', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-semibold text-gray-800 focus:bg-white focus:border-[#00603C] focus:outline-none"
                      placeholder="Ej: Ala A - Sector 1"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 3: Cantidades y Observaciones */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 border-b border-gray-100 pb-1">
                  3. Stock, Pesos y Observaciones
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs mb-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Cantidad de Bolsas</label>
                    <input
                      type="number"
                      min="1"
                      value={draftFichaLote.stockBolsas || 0}
                      onChange={(e) => handleUpdateDraftField('stockBolsas', Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-bold text-gray-900 font-mono focus:bg-white focus:border-[#00603C] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Kg por Bolsa</label>
                    <input
                      type="number"
                      min="1"
                      value={draftFichaLote.kgPorBolsa || 40}
                      onChange={(e) => handleUpdateDraftField('kgPorBolsa', Math.max(1, parseInt(e.target.value, 10) || 0))}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-bold text-gray-900 font-mono focus:bg-white focus:border-[#00603C] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Fecha Realizado / Ingreso</label>
                    <input
                      type="date"
                      value={draftFichaLote.fechaIngreso || ''}
                      onChange={(e) => handleUpdateDraftField('fechaIngreso', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-semibold text-gray-800 focus:bg-white focus:border-[#00603C] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Observaciones / Notas de la Ficha Técnica</label>
                  <textarea
                    rows={3}
                    value={draftFichaLote.observaciones || ''}
                    onChange={(e) => handleUpdateDraftField('observaciones', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-semibold text-gray-800 text-xs focus:bg-white focus:border-[#00603C] focus:outline-none resize-none"
                    placeholder="Escriba aquí observaciones especiales para la ficha técnica..."
                  />
                </div>
              </div>
            </div>

            {/* Footer de Acciones del Modal */}
            <div className="bg-gray-50 p-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowEditFichaModal(false)}
                className="w-full sm:w-auto px-4 py-2 text-xs font-semibold font-sans uppercase tracking-wider text-gray-600 hover:bg-gray-100 rounded-lg transition cursor-pointer"
              >
                Cerrar
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleConfirmarYPrevisualizar}
                  className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold font-sans uppercase tracking-wider bg-[#00603C] hover:bg-[#254731] text-white rounded-lg transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4 text-[#C9922E]" />
                  <span>Confirmar y Previsualizar Impresión</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Componente Independiente de Impresión y Edición de Ficha Técnica (A4 / JPG) */}
      <ImprimirFichaTecnica
        lote={draftFichaLote}
        ordenesProceso={ordenesProceso}
        isOpen={showImprimirFichaModal}
        onClose={() => setShowImprimirFichaModal(false)}
        initialEditMode={initialFichaEditMode}
        onSaveLote={(updated) => {
          setDraftFichaLote(updated);
          setFichaModificada(true);
        }}
      />

      {/* Contenedor off-screen de la Ficha Técnica para exportación directa a JPG */}
      <div
        aria-hidden="true"
        className="fixed -left-[9999px] -top-[9999px] w-[800px] pointer-events-none opacity-100 z-[-1] bg-white p-4 print:hidden"
      >
        <FichaTecnicaOficialCard id={`ficha-detail-card-${lote.id}`} lote={draftFichaLote} />
      </div>
      </div>

      {/* 2. Contenedor Exclusivo de Impresión (@media print) para generar la Ficha Oficial A4 / PDF */}
      <div
        id="seccion-impresion"
        className="ficha-tecnica-a4-container seccion-impresion hidden print:block w-full max-w-[210mm] mx-auto bg-white"
      >
        <FichaTecnicaOficialCard
          id={`ficha-print-direct-${lote.id}`}
          lote={draftFichaLote}
          showWatermark={false}
        />
      </div>
    </div>
  );
};
