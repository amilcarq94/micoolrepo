/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Download,
  Printer,
  FileText,
  X,
  Warehouse,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Calendar,
  Building2,
  User,
  Scale,
  TrendingUp,
  Droplets,
  Layers,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { SiloId, MovimientoSilo, CAPACIDAD_MAX_SILO, SilosEstadoMap } from '../types';
import { SILOS_DISPONIBLES } from './SilosSelector';
import { formatNumberArg } from '../utils/formatters';
import { printWithActiveClass } from '../utils/printHelper';
import { exportElementAsPdf } from '../utils/exportPdf';
import { LogoSiloLoose } from './Logo';

export interface SiloItemReporte {
  siloId: SiloId;
  stockKg: number;
  stockTn: number;
  capacidadKg: number;
  capacidadTn: number;
  pctOcupacion: number;
  disponibleKg: number;
  disponibleTn: number;
  estadoManual: 'OCUPADO' | 'VACIO_LIMPIO' | 'VACIO_SUCIO';
  especie: string;
  variedad: string;
  categoria: string;
  cliente: string;
  humedad: string;
  totalKgIngresados: number;
  totalKgEgresados: number;
  ultimoMovimiento: string;
  ingresosActivos: MovimientoSilo[];
}

interface ReportePlanillaExcelSilosModalProps {
  movimientosSilo: MovimientoSilo[];
  silosEstadoManual?: SilosEstadoMap;
  currentUser?: { nombre: string; rol: string };
  onClose: () => void;
}

export const ReportePlanillaExcelSilosModal: React.FC<ReportePlanillaExcelSilosModalProps> = ({
  movimientosSilo,
  silosEstadoManual = {},
  currentUser,
  onClose,
}) => {
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // Fecha y hora actual formateadas
  const fechaHoyStr = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }, []);

  const horaActualStr = useMemo(() => {
    const d = new Date();
    return d.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  // 1. Cálculo consolidado de cada uno de los 6 silos
  const silosData: SiloItemReporte[] = useMemo(() => {
    return SILOS_DISPONIBLES.map((siloId) => {
      const movsAsc = (movimientosSilo || [])
        .filter((m) => m.siloId === siloId)
        .sort(
          (a, b) =>
            new Date(a.fecha).getTime() - new Date(b.fecha).getTime() ||
            (a.id || '').localeCompare(b.id || '')
        );

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
      const egresosBatchActual = movsBatchActual.filter(
        (m) => m.tipo === 'EGRESO_OP' || (m.tipo as string).startsWith('EGRESO')
      );

      const capacidadKg = CAPACIDAD_MAX_SILO;
      const capacidadTn = capacidadKg / 1000;
      const stockKg = currentBalance;
      const stockTn = stockKg / 1000;
      const pctOcupacion = (stockKg / capacidadKg) * 100;
      const disponibleKg = Math.max(0, capacidadKg - stockKg);
      const disponibleTn = disponibleKg / 1000;

      const estadoManual =
        silosEstadoManual[siloId] || (stockKg > 0 ? 'OCUPADO' : 'VACIO_LIMPIO');

      if (stockKg === 0 || ingresosBatchActual.length === 0) {
        return {
          siloId,
          stockKg: 0,
          stockTn: 0,
          capacidadKg,
          capacidadTn,
          pctOcupacion: 0,
          disponibleKg,
          disponibleTn,
          estadoManual,
          especie: 'Sin Cereal / Vacío',
          variedad: '-',
          categoria: '-',
          cliente: 'Sin asignación',
          humedad: '0.0',
          totalKgIngresados: 0,
          totalKgEgresados: 0,
          ultimoMovimiento: movsAsc[movsAsc.length - 1]?.fecha || 'Sin registros',
          ingresosActivos: [],
        };
      }

      const totalKgIngresados = ingresosBatchActual.reduce((acc, m) => acc + m.kg, 0);
      const totalKgEgresados = egresosBatchActual.reduce((acc, m) => acc + m.kg, 0);

      const especiesSet = Array.from(
        new Set(ingresosBatchActual.map((i) => i.especie).filter(Boolean))
      );
      const clientesSet = Array.from(
        new Set(ingresosBatchActual.map((i) => i.cliente).filter(Boolean))
      );
      const variedadesSet = Array.from(
        new Set(ingresosBatchActual.map((i) => i.variedad).filter(Boolean))
      );
      const categoriasSet = Array.from(
        new Set(ingresosBatchActual.map((i) => i.categoria).filter(Boolean))
      );

      const especie = especiesSet.length > 0 ? especiesSet.join(', ') : 'Sin Cereal';
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
      const humedadPromedio =
        totalKgConHumedad > 0
          ? (sumaHumedadPonderada / totalKgConHumedad).toFixed(1)
          : ultIngresoBatch?.humedad !== undefined
          ? ultIngresoBatch.humedad.toFixed(1)
          : '13.5';

      return {
        siloId,
        stockKg,
        stockTn,
        capacidadKg,
        capacidadTn,
        pctOcupacion,
        disponibleKg,
        disponibleTn,
        estadoManual,
        especie,
        variedad,
        categoria,
        cliente,
        humedad: humedadPromedio,
        totalKgIngresados,
        totalKgEgresados,
        ultimoMovimiento: movsAsc[movsAsc.length - 1]?.fecha || 'Sin registros',
        ingresosActivos: [...ingresosBatchActual].reverse(),
      };
    });
  }, [movimientosSilo, silosEstadoManual]);

  // 2. Totales Generales de la Planta
  const totales = useMemo(() => {
    const totalStockKg = silosData.reduce((acc, s) => acc + s.stockKg, 0);
    const totalCapacidadKg = silosData.reduce((acc, s) => acc + s.capacidadKg, 0);
    const totalStockTn = totalStockKg / 1000;
    const totalCapacidadTn = totalCapacidadKg / 1000;
    const totalDisponibleKg = Math.max(0, totalCapacidadKg - totalStockKg);
    const totalDisponibleTn = totalDisponibleKg / 1000;
    const pctOcupacionGlobal = (totalStockKg / totalCapacidadKg) * 100;
    const totalIngresadosBatch = silosData.reduce((acc, s) => acc + s.totalKgIngresados, 0);
    const totalEgresadosBatch = silosData.reduce((acc, s) => acc + s.totalKgEgresados, 0);

    const silosOcupados = silosData.filter((s) => s.stockKg > 0).length;
    const silosVaciosLimpios = silosData.filter(
      (s) => s.stockKg === 0 && s.estadoManual === 'VACIO_LIMPIO'
    ).length;
    const silosVaciosSucios = silosData.filter(
      (s) => s.stockKg === 0 && s.estadoManual === 'VACIO_SUCIO'
    ).length;

    return {
      totalStockKg,
      totalStockTn,
      totalCapacidadKg,
      totalCapacidadTn,
      totalDisponibleKg,
      totalDisponibleTn,
      pctOcupacionGlobal,
      totalIngresadosBatch,
      totalEgresadosBatch,
      silosOcupados,
      silosVaciosLimpios,
      silosVaciosSucios,
    };
  }, [silosData]);

  // 3. Resumen agrupado por Especie
  const resumenPorEspecie = useMemo(() => {
    const map: Record<
      string,
      { especie: string; totalKg: number; totalTn: number; silos: string[] }
    > = {};

    silosData.forEach((s) => {
      if (s.stockKg > 0 && s.especie !== 'Sin Cereal / Vacío') {
        if (!map[s.especie]) {
          map[s.especie] = { especie: s.especie, totalKg: 0, totalTn: 0, silos: [] };
        }
        map[s.especie].totalKg += s.stockKg;
        map[s.especie].totalTn += s.stockTn;
        map[s.especie].silos.push(s.siloId);
      }
    });

    return Object.values(map).sort((a, b) => b.totalKg - a.totalKg);
  }, [silosData]);

  // 4. Resumen agrupado por Cliente
  const resumenPorCliente = useMemo(() => {
    const map: Record<
      string,
      { cliente: string; totalKg: number; totalTn: number; especies: Set<string>; silos: string[] }
    > = {};

    silosData.forEach((s) => {
      if (s.stockKg > 0 && s.cliente !== 'Sin asignación' && s.cliente !== 'Sin Asignar') {
        if (!map[s.cliente]) {
          map[s.cliente] = {
            cliente: s.cliente,
            totalKg: 0,
            totalTn: 0,
            especies: new Set(),
            silos: [],
          };
        }
        map[s.cliente].totalKg += s.stockKg;
        map[s.cliente].totalTn += s.stockTn;
        if (s.especie && s.especie !== 'Sin Cereal / Vacío') {
          map[s.cliente].especies.add(s.especie);
        }
        map[s.cliente].silos.push(s.siloId);
      }
    });

    return Object.values(map).map((c) => ({
      ...c,
      especiesList: Array.from(c.especies).join(', ') || '-',
    }));
  }, [silosData]);

  // 5. Función para Generar y Descargar Archivo Excel (.xlsx) Nativo
  const handleDownloadExcel = () => {
    try {
      setIsExportingExcel(true);

      const fechaIso = new Date().toISOString().split('T')[0];

      // Hoja 1: Resumen General de Silos en formato estructurado
      const wsData: any[][] = [
        ['AGRO ABACUS S.A. - PLANTA CLASIFICADORA LA BARRANCOSA'],
        ['PLANILLA RESUMEN DE CONTROL Y STOCK ACTUAL EN SILOS'],
        [
          `Fecha de Emisión: ${fechaHoyStr} ${horaActualStr}`,
          '',
          `Operador / Emisor: ${currentUser?.nombre || 'Administración de Planta'}`,
          '',
          `Capacidad Total Planta: ${totales.totalCapacidadTn.toLocaleString('es-AR')} Tn (${totales.totalCapacidadKg.toLocaleString('es-AR')} kg)`,
        ],
        [],
        // Encabezados de Columnas
        [
          'N° SILO',
          'ESTADO OPERATIVO',
          'ESPECIE / GRANO',
          'VARIEDAD',
          'CATEGORÍA',
          'CLIENTE / PROPIETARIO',
          'HUMEDAD (%)',
          'STOCK ACTUAL (KG)',
          'STOCK ACTUAL (TN)',
          'CAPACIDAD MÁX. (TN)',
          '% OCUPACIÓN',
          'DISPONIBLE (TN)',
          'TOTAL INGRESADO BATCH (KG)',
          'TOTAL EGRESADO BATCH (KG)',
          'ÚLTIMO MOVIMIENTO',
        ],
      ];

      // Filas de Datos por Silo
      silosData.forEach((s) => {
        const estadoTexto =
          s.estadoManual === 'OCUPADO'
            ? 'Ocupado'
            : s.estadoManual === 'VACIO_LIMPIO'
            ? 'Vacío Limpio'
            : 'Vacío Sucio';

        wsData.push([
          s.siloId,
          estadoTexto,
          s.especie,
          s.variedad,
          s.categoria,
          s.cliente,
          Number(s.humedad) || 0,
          s.stockKg,
          Number(s.stockTn.toFixed(2)),
          s.capacidadTn,
          Number(s.pctOcupacion.toFixed(1)),
          Number(s.disponibleTn.toFixed(2)),
          s.totalKgIngresados,
          s.totalKgEgresados,
          s.ultimoMovimiento,
        ]);
      });

      // Fila de TOTALES
      wsData.push([
        'TOTALES GENERALES',
        `${totales.silosOcupados} Ocupados / 6`,
        `${resumenPorEspecie.length} Especies`,
        '-',
        '-',
        `${resumenPorCliente.length} Clientes`,
        '-',
        totales.totalStockKg,
        Number(totales.totalStockTn.toFixed(2)),
        totales.totalCapacidadTn,
        Number(totales.pctOcupacionGlobal.toFixed(1)),
        Number(totales.totalDisponibleTn.toFixed(2)),
        totales.totalIngresadosBatch,
        totales.totalEgresadosBatch,
        fechaHoyStr,
      ]);

      wsData.push([]);
      wsData.push([]);

      // Bloque de Resumen por Especie
      wsData.push(['CONSOLIDADO POR ESPECIE / CEREAL']);
      wsData.push(['ESPECIE', 'TOTAL KG', 'TOTAL TN', '% DEL STOCK TOTAL', 'SILOS ASIGNADOS']);
      if (resumenPorEspecie.length === 0) {
        wsData.push(['Sin cereales acopiados', 0, 0, '0%', '-']);
      } else {
        resumenPorEspecie.forEach((e) => {
          const pct = totales.totalStockKg > 0 ? ((e.totalKg / totales.totalStockKg) * 100).toFixed(1) : '0.0';
          wsData.push([e.especie, e.totalKg, Number(e.totalTn.toFixed(2)), `${pct}%`, e.silos.join(', ')]);
        });
      }

      wsData.push([]);
      wsData.push([]);

      // Bloque de Resumen por Cliente
      wsData.push(['DISTRIBUCIÓN DE ACOPIO POR CLIENTE']);
      wsData.push(['CLIENTE / TITULAR', 'ESPECIES', 'TOTAL KG', 'TOTAL TN', '% DEL STOCK TOTAL', 'SILOS OCUPADOS']);
      if (resumenPorCliente.length === 0) {
        wsData.push(['Sin clientes con stock', '-', 0, 0, '0%', '-']);
      } else {
        resumenPorCliente.forEach((c) => {
          const pct = totales.totalStockKg > 0 ? ((c.totalKg / totales.totalStockKg) * 100).toFixed(1) : '0.0';
          wsData.push([c.cliente, c.especiesList, c.totalKg, Number(c.totalTn.toFixed(2)), `${pct}%`, c.silos.join(', ')]);
        });
      }

      const wsResumen = XLSX.utils.aoa_to_sheet(wsData);

      // Anchos de Columna Optimizados
      wsResumen['!cols'] = [
        { wch: 14 }, // N° Silo
        { wch: 18 }, // Estado Operativo
        { wch: 22 }, // Especie
        { wch: 20 }, // Variedad
        { wch: 16 }, // Categoría
        { wch: 30 }, // Cliente
        { wch: 14 }, // Humedad
        { wch: 18 }, // Stock Kg
        { wch: 16 }, // Stock Tn
        { wch: 20 }, // Capacidad Tn
        { wch: 15 }, // % Ocupación
        { wch: 16 }, // Disponible Tn
        { wch: 24 }, // Total Ingresado Batch
        { wch: 24 }, // Total Egresado Batch
        { wch: 22 }, // Último Movimiento
      ];

      // Hoja 2: Detalle de Ingresos Activos que Componen el Stock
      const detalleRows: any[][] = [
        ['DETALLE DE INGRESOS ACTIVOS EN SILOS (STOCK PRESENTE EN PLANTA)'],
        [
          'ID SILO',
          'FECHA',
          'HORA',
          'KILOS',
          'ESPECIE',
          'VARIEDAD',
          'CATEGORÍA',
          'CLIENTE',
          'HUMEDAD (%)',
          'BOLSÓN ORIGEN',
          'ORIGEN / CAMPO',
          'SECTOR',
          'CHOFER',
          'PATENTE',
          'OBSERVACIONES',
        ],
      ];

      let countDetalle = 0;
      silosData.forEach((s) => {
        s.ingresosActivos.forEach((ing) => {
          countDetalle++;
          detalleRows.push([
            s.siloId,
            ing.fecha || '-',
            ing.hora || '-',
            ing.kg || 0,
            ing.especie || '-',
            ing.variedad || '-',
            ing.categoria || '-',
            ing.cliente || '-',
            ing.humedad !== undefined ? `${ing.humedad}%` : '-',
            ing.bolsonOrigenNro || '-',
            ing.campoOrigen || ing.depositoOrigen || '-',
            ing.bolsonOrigenSector || '-',
            ing.chofer || '-',
            ing.patentes || '-',
            ing.observaciones || '-',
          ]);
        });
      });

      if (countDetalle === 0) {
        detalleRows.push(['No hay ingresos activos en este momento', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
      }

      const wsDetalle = XLSX.utils.aoa_to_sheet(detalleRows);
      wsDetalle['!cols'] = [
        { wch: 12 },
        { wch: 14 },
        { wch: 10 },
        { wch: 14 },
        { wch: 18 },
        { wch: 18 },
        { wch: 14 },
        { wch: 26 },
        { wch: 14 },
        { wch: 16 },
        { wch: 22 },
        { wch: 14 },
        { wch: 24 },
        { wch: 14 },
        { wch: 30 },
      ];

      // Crear Libro y Descargar
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen_Stock_Silos');
      XLSX.utils.book_append_sheet(wb, wsDetalle, 'Detalle_Ingresos_Activos');

      const fileName = `Planilla_Stock_Silos_AgroAbacus_${fechaIso}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (err) {
      console.error('Error al exportar archivo Excel de silos:', err);
    } finally {
      setIsExportingExcel(false);
    }
  };

  // 6. Impresión directa aprovechando las utilidades de src/index.css
  const handlePrint = async () => {
    try {
      setIsPrinting(true);
      await printWithActiveClass('reporte-silos-planilla-printable');
    } catch (err) {
      console.error('Error al imprimir planilla:', err);
    } finally {
      setIsPrinting(false);
    }
  };

  // 7. Descargar PDF con relación de aspecto apaisada (Landscape)
  const handleDownloadPdf = async () => {
    const el = document.getElementById('reporte-silos-planilla-printable');
    if (!el) return;
    try {
      setIsDownloadingPdf(true);
      const fileName = `Planilla_Stock_Silos_AgroAbacus_${new Date().toISOString().split('T')[0]}.pdf`;
      await exportElementAsPdf(el, fileName, { orientation: 'landscape', scale: 2.2, quality: 0.98 });
    } catch (err) {
      console.error('Error al descargar PDF:', err);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white"
    >
      {/* Reglas de Impresión Apaisada (@page landscape) */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 6mm 8mm 6mm 8mm;
          }
          html, body, #root, main {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            overflow: visible !important;
          }
          .reporte-silos-modal-root {
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            display: block !important;
            overflow: visible !important;
          }
          #reporte-silos-planilla-printable {
            width: 100% !important;
            max-width: 282mm !important;
            margin: 0 auto !important;
            padding: 4mm !important;
            box-shadow: none !important;
            border: 1px solid #cbd5e1 !important;
            background-color: #ffffff !important;
            display: block !important;
          }
        }
      `}</style>

      <div className="reporte-silos-modal-root flex flex-col items-center gap-3 w-full max-w-7xl max-h-[96vh] my-auto">
        {/* Barra Superior de Controles y Acciones (no-print) */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 w-full bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-xl border border-slate-800 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-400 border border-emerald-500/30">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-white uppercase tracking-wider">
                  Planilla Excel · Resumen de Stock Actual en Silos
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 text-[10px] font-mono font-bold border border-emerald-700/60">
                  Formato .XLSX / A4 Landscape
                </span>
              </div>
              <span className="text-[11.5px] text-slate-400">
                Auditoría en tiempo real de capacidad, cereales, humedades y clientes (Planta La Barrancosa)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
            {/* Botón Descargar Archivo Excel (.xlsx) Nativo */}
            <button
              type="button"
              id="btn-descargar-excel-silos"
              onClick={handleDownloadExcel}
              disabled={isExportingExcel}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 shadow-md cursor-pointer active:scale-95 border border-emerald-400/40 disabled:opacity-50"
              title="Descargar archivo Excel (.xlsx) con 2 hojas: Resumen General y Detalle de Ingresos"
            >
              {isExportingExcel ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
              )}
              <span>{isExportingExcel ? 'Generando Excel...' : 'Descargar Excel (.xlsx)'}</span>
            </button>

            {/* Botón Imprimir Planilla (Usa utilidades existentes en index.css) */}
            <button
              type="button"
              id="btn-imprimir-planilla-silos"
              onClick={handlePrint}
              disabled={isPrinting}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs rounded-xl transition flex items-center gap-1.5 border border-slate-700 cursor-pointer active:scale-95 disabled:opacity-50"
              title="Imprimir la planilla en hoja A4 horizontal utilizando el motor de index.css"
            >
              {isPrinting ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-200" />
              ) : (
                <Printer className="w-4 h-4 text-slate-300" />
              )}
              <span>Imprimir</span>
            </button>

            {/* Botón Descargar PDF */}
            <button
              type="button"
              id="btn-descargar-pdf-planilla-silos"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs rounded-xl transition flex items-center gap-1.5 border border-slate-700 cursor-pointer active:scale-95 disabled:opacity-50"
              title="Descargar versión PDF apaisada de alta calidad"
            >
              {isDownloadingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-200" />
              ) : (
                <FileText className="w-4 h-4 text-amber-300" />
              )}
              <span>PDF</span>
            </button>

            {/* Botón Cerrar */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition cursor-pointer"
              title="Cerrar ventana"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* CONTENEDOR DE LA PLANILLA ESTILO EXCEL (IMPRIMIBLE) */}
        <div className="overflow-y-auto max-h-[82vh] w-full p-2 sm:p-4 bg-slate-200/70 rounded-2xl border border-slate-300 shadow-inner flex justify-center">
          <div
            id="reporte-silos-planilla-printable"
            className="w-full max-w-[1180px] bg-white p-5 sm:p-6 rounded-xl shadow-lg border border-slate-300 font-sans text-slate-900"
          >
            {/* ENCABEZADO INSTITUCIONAL DE LA PLANILLA */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b-2 border-[#005A36] pb-3 mb-4 gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#005A36] text-white flex items-center justify-center font-serif font-black text-xl shadow-xs shrink-0">
                  AA
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-serif font-black text-lg sm:text-xl text-[#005A36] tracking-tight uppercase">
                      AGRO ABACUS S.A.
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-[#005A36] text-[10px] font-bold uppercase tracking-wider">
                      Planta La Barrancosa
                    </span>
                  </div>
                  <h2 className="text-xs sm:text-sm font-bold text-slate-700 tracking-wide">
                    PLANILLA RESUMEN DE CONTROL Y STOCK ACTUAL EN SILOS
                  </h2>
                </div>
              </div>

              {/* Metadatos de Emisión */}
              <div className="text-right text-[11px] text-slate-600 space-y-0.5 self-end sm:self-auto font-mono">
                <div className="flex items-center sm:justify-end gap-1.5 text-slate-800">
                  <Calendar className="w-3.5 h-3.5 text-[#005A36]" />
                  <span>Emisión: <strong>{fechaHoyStr} · {horaActualStr}</strong></span>
                </div>
                <div>
                  Operador: <strong>{currentUser?.nombre || 'Administración de Planta'}</strong> ({currentUser?.rol || 'Acopio'})
                </div>
                <div className="text-[10px] text-slate-500">
                  Capacidad Total: <strong>1.080 Tn</strong>
                </div>
              </div>
            </div>

            {/* TARJETAS DE INDICADORES RÁPIDOS (KPIS RESUMEN) */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-4 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                  Stock Total Acopiado
                </span>
                <span className="font-mono font-black text-[#005A36] text-base block">
                  {totales.totalStockTn.toFixed(1)} Tn
                </span>
                <span className="text-[10.5px] text-slate-600 font-mono">
                  {formatNumberArg(totales.totalStockKg, 0)} kg
                </span>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                  Capacidad Total
                </span>
                <span className="font-mono font-black text-slate-800 text-base block">
                  {totales.totalCapacidadTn} Tn
                </span>
                <span className="text-[10.5px] text-slate-600 font-mono">
                  6 Silos
                </span>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                  % Ocupación Global
                </span>
                <span className={`font-mono font-black text-base block ${
                  totales.pctOcupacionGlobal >= 90
                    ? 'text-red-600'
                    : totales.pctOcupacionGlobal >= 75
                    ? 'text-amber-600'
                    : 'text-[#005A36]'
                }`}>
                  {totales.pctOcupacionGlobal.toFixed(1)}%
                </span>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1">
                  <div
                    className={`h-full ${
                      totales.pctOcupacionGlobal >= 90
                        ? 'bg-red-500'
                        : totales.pctOcupacionGlobal >= 75
                        ? 'bg-amber-500'
                        : 'bg-[#005A36]'
                    }`}
                    style={{ width: `${Math.min(100, totales.pctOcupacionGlobal)}%` }}
                  />
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                  Espacio Disponible
                </span>
                <span className="font-mono font-black text-blue-700 text-base block">
                  {totales.totalDisponibleTn.toFixed(1)} Tn
                </span>
                <span className="text-[10.5px] text-slate-600 font-mono">
                  {formatNumberArg(totales.totalDisponibleKg, 0)} kg libres
                </span>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 shadow-2xs col-span-2 sm:col-span-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                  Estado de Silos
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 rounded font-mono font-bold text-[10.5px]">
                    {totales.silosOcupados} Ocup.
                  </span>
                  <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-900 rounded font-mono font-bold text-[10.5px]">
                    {totales.silosVaciosLimpios} Limp.
                  </span>
                  {totales.silosVaciosSucios > 0 && (
                    <span className="px-1.5 py-0.5 bg-red-100 text-red-900 rounded font-mono font-bold text-[10.5px]">
                      {totales.silosVaciosSucios} Suc.
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-500 block mt-1">
                  Total 6 silos acopio
                </span>
              </div>
            </div>

            {/* TABLA PRINCIPAL DE LA PLANILLA (ESTILO EXCEL) */}
            <div className="overflow-x-auto border border-slate-300 rounded-xl shadow-2xs mb-4">
              <table className="ficha-table w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#005A36] text-white font-bold text-[10.5px] uppercase tracking-wider">
                    <th className="p-2 border border-emerald-900 text-center w-14">Silo</th>
                    <th className="p-2 border border-emerald-900">Estado</th>
                    <th className="p-2 border border-emerald-900">Especie / Cereal</th>
                    <th className="p-2 border border-emerald-900">Variedad</th>
                    <th className="p-2 border border-emerald-900">Categoría</th>
                    <th className="p-2 border border-emerald-900">Cliente / Propietario</th>
                    <th className="p-2 border border-emerald-900 text-right">Humedad</th>
                    <th className="p-2 border border-emerald-900 text-right">Stock (Kg)</th>
                    <th className="p-2 border border-emerald-900 text-right">Stock (Tn)</th>
                    <th className="p-2 border border-emerald-900 text-right">Capac. (Tn)</th>
                    <th className="p-2 border border-emerald-900 text-right">% Ocup.</th>
                    <th className="p-2 border border-emerald-900 text-right">Libre (Tn)</th>
                    <th className="p-2 border border-emerald-900 text-center">Últ. Movimiento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {silosData.map((s, idx) => {
                    const isOcupado = s.stockKg > 0;
                    const rowBg = isOcupado
                      ? idx % 2 === 0
                        ? 'bg-white'
                        : 'bg-emerald-50/20'
                      : 'bg-slate-50/70 text-slate-500';

                    return (
                      <tr key={s.siloId} className={`hover:bg-amber-50/40 transition-colors ${rowBg}`}>
                        {/* Silo */}
                        <td className="p-2 border border-slate-300 font-serif font-black text-center text-[#005A36]">
                          {s.siloId}
                        </td>

                        {/* Estado Físico */}
                        <td className="p-2 border border-slate-300 whitespace-nowrap">
                          {s.estadoManual === 'OCUPADO' ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              Ocupado
                            </span>
                          ) : s.estadoManual === 'VACIO_LIMPIO' ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              Vacío Limpio
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-900 border border-red-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                              Vacío Sucio
                            </span>
                          )}
                        </td>

                        {/* Especie */}
                        <td className="p-2 border border-slate-300 font-semibold text-slate-800">
                          {s.especie}
                        </td>

                        {/* Variedad */}
                        <td className="p-2 border border-slate-300 text-slate-700">
                          {s.variedad}
                        </td>

                        {/* Categoría */}
                        <td className="p-2 border border-slate-300 text-slate-700">
                          {s.categoria}
                        </td>

                        {/* Cliente */}
                        <td className="p-2 border border-slate-300 font-bold text-[#005A36]">
                          {s.cliente}
                        </td>

                        {/* Humedad */}
                        <td className="p-2 border border-slate-300 text-right font-mono text-slate-700">
                          {s.humedad !== '0.0' ? `${s.humedad}%` : '-'}
                        </td>

                        {/* Stock Kg */}
                        <td className="p-2 border border-slate-300 text-right font-mono font-bold text-slate-900">
                          {formatNumberArg(s.stockKg, 0)} kg
                        </td>

                        {/* Stock Tn */}
                        <td className="p-2 border border-slate-300 text-right font-mono font-bold text-[#005A36]">
                          {s.stockTn.toFixed(1)} Tn
                        </td>

                        {/* Capacidad Tn */}
                        <td className="p-2 border border-slate-300 text-right font-mono text-slate-600">
                          {s.capacidadTn} Tn
                        </td>

                        {/* % Ocupación */}
                        <td className="p-2 border border-slate-300 text-right font-mono">
                          <span
                            className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                              s.pctOcupacion >= 95
                                ? 'bg-red-100 text-red-800'
                                : s.pctOcupacion >= 80
                                ? 'bg-amber-100 text-amber-800'
                                : s.pctOcupacion > 0
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'text-slate-400'
                            }`}
                          >
                            {s.pctOcupacion.toFixed(1)}%
                          </span>
                        </td>

                        {/* Disponible Tn */}
                        <td className="p-2 border border-slate-300 text-right font-mono text-blue-700 font-semibold">
                          {s.disponibleTn.toFixed(1)} Tn
                        </td>

                        {/* Último Movimiento */}
                        <td className="p-2 border border-slate-300 text-center font-mono text-[10.5px] text-slate-600">
                          {s.ultimoMovimiento}
                        </td>
                      </tr>
                    );
                  })}

                  {/* FILA DE TOTALES GENERALES (ESTILO EXCEL) */}
                  <tr className="bg-emerald-100/70 text-slate-950 font-bold text-[11px] border-t-2 border-b-2 border-[#005A36]">
                    <td className="p-2.5 border border-slate-300 font-serif uppercase tracking-wider text-center" colSpan={2}>
                      TOTALES GENERALES
                    </td>
                    <td className="p-2.5 border border-slate-300 font-bold text-[#005A36]">
                      {resumenPorEspecie.length} Especies
                    </td>
                    <td className="p-2.5 border border-slate-300 text-slate-600" colSpan={2}>
                      -
                    </td>
                    <td className="p-2.5 border border-slate-300 font-bold text-[#005A36]">
                      {resumenPorCliente.length} Clientes
                    </td>
                    <td className="p-2.5 border border-slate-300 text-right font-mono">
                      -
                    </td>
                    <td className="p-2.5 border border-slate-300 text-right font-mono font-black text-slate-950">
                      {formatNumberArg(totales.totalStockKg, 0)} kg
                    </td>
                    <td className="p-2.5 border border-slate-300 text-right font-mono font-black text-[#005A36] text-xs">
                      {totales.totalStockTn.toFixed(1)} Tn
                    </td>
                    <td className="p-2.5 border border-slate-300 text-right font-mono font-black text-slate-800">
                      {totales.totalCapacidadTn} Tn
                    </td>
                    <td className="p-2.5 border border-slate-300 text-right font-mono font-black text-[#005A36]">
                      {totales.pctOcupacionGlobal.toFixed(1)}%
                    </td>
                    <td className="p-2.5 border border-slate-300 text-right font-mono font-black text-blue-800">
                      {totales.totalDisponibleTn.toFixed(1)} Tn
                    </td>
                    <td className="p-2.5 border border-slate-300 text-center font-mono text-[10px] text-slate-600">
                      Planta La Barrancosa
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* SECCIÓN INFERIOR: RESUMEN POR ESPECIE Y POR CLIENTE */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-xs">
              {/* Tabla Resumen por Especie */}
              <div className="border border-slate-300 rounded-xl overflow-hidden shadow-2xs">
                <div className="bg-slate-100 px-3 py-2 border-b border-slate-300 font-bold text-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#005A36]" />
                    <span>Consolidado por Especie / Grano</span>
                  </div>
                  <span className="text-[10.5px] font-mono text-slate-500">
                    {resumenPorEspecie.length} en stock
                  </span>
                </div>
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <th className="p-2">Especie</th>
                      <th className="p-2 text-right">Kilos</th>
                      <th className="p-2 text-right">Toneladas</th>
                      <th className="p-2 text-right">% Stock</th>
                      <th className="p-2 text-center">Silos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {resumenPorEspecie.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-3 text-center text-slate-400 italic">
                          No hay granos acopiados en silos actualmente.
                        </td>
                      </tr>
                    ) : (
                      resumenPorEspecie.map((e) => {
                        const pct =
                          totales.totalStockKg > 0
                            ? ((e.totalKg / totales.totalStockKg) * 100).toFixed(1)
                            : '0.0';
                        return (
                          <tr key={e.especie} className="hover:bg-slate-50">
                            <td className="p-2 font-bold text-slate-800">{e.especie}</td>
                            <td className="p-2 text-right font-mono text-slate-700">
                              {formatNumberArg(e.totalKg, 0)} kg
                            </td>
                            <td className="p-2 text-right font-mono font-bold text-[#005A36]">
                              {e.totalTn.toFixed(1)} Tn
                            </td>
                            <td className="p-2 text-right font-mono text-slate-600">{pct}%</td>
                            <td className="p-2 text-center font-mono text-[10px] text-slate-600">
                              {e.silos.join(', ')}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Tabla Distribución por Cliente */}
              <div className="border border-slate-300 rounded-xl overflow-hidden shadow-2xs">
                <div className="bg-slate-100 px-3 py-2 border-b border-slate-300 font-bold text-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-[#005A36]" />
                    <span>Distribución de Acopio por Cliente</span>
                  </div>
                  <span className="text-[10.5px] font-mono text-slate-500">
                    {resumenPorCliente.length} clientes
                  </span>
                </div>
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <th className="p-2">Cliente / Titular</th>
                      <th className="p-2">Especie(s)</th>
                      <th className="p-2 text-right">Toneladas</th>
                      <th className="p-2 text-right">% Total</th>
                      <th className="p-2 text-center">Silos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {resumenPorCliente.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-3 text-center text-slate-400 italic">
                          No hay clientes asignados a stock actualmente.
                        </td>
                      </tr>
                    ) : (
                      resumenPorCliente.map((c) => {
                        const pct =
                          totales.totalStockKg > 0
                            ? ((c.totalKg / totales.totalStockKg) * 100).toFixed(1)
                            : '0.0';
                        return (
                          <tr key={c.cliente} className="hover:bg-slate-50">
                            <td className="p-2 font-bold text-[#005A36]">{c.cliente}</td>
                            <td className="p-2 text-slate-700">{c.especiesList}</td>
                            <td className="p-2 text-right font-mono font-bold text-slate-900">
                              {c.totalTn.toFixed(1)} Tn
                            </td>
                            <td className="p-2 text-right font-mono text-slate-600">{pct}%</td>
                            <td className="p-2 text-center font-mono text-[10px] text-slate-600">
                              {c.silos.join(', ')}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SECCIÓN DE CONFORMIDAD, FIRMAS Y AUDITORÍA DE PLANTA */}
            <div className="border-t border-slate-300 pt-4 mt-2 flex flex-col sm:flex-row items-center justify-between gap-6 text-[11px] text-slate-600">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#005A36]" />
                <span>
                  Documento Oficial de Auditoría Interna Agro Abacus S.A. · Sistema de Trazabilidad y Control de Acopio.
                </span>
              </div>

              <div className="flex items-center gap-12 text-center">
                <div className="border-t border-slate-400 pt-1 w-36">
                  <span className="block font-bold text-slate-800">Responsable Balanza</span>
                  <span className="text-[10px] text-slate-500">Recepción / Control</span>
                </div>
                <div className="border-t border-slate-400 pt-1 w-36">
                  <span className="block font-bold text-slate-800">Supervisor de Planta</span>
                  <span className="text-[10px] text-slate-500">Conformidad de Acopio</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Barra Inferior de Acciones Rápidas (no-print) */}
        <div className="flex items-center justify-between w-full max-w-7xl bg-slate-100 px-5 py-3 rounded-2xl border border-slate-300 shadow-md print:hidden">
          <div className="text-xs text-slate-600 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>
              Mostrando estado consolidado de los <strong>6 Silos</strong> · Capacidad instalada: <strong>1.080 Tn</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition cursor-pointer"
            >
              Cerrar
            </button>

            <button
              type="button"
              onClick={handleDownloadExcel}
              disabled={isExportingExcel}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
            >
              {isExportingExcel ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-300" />
              )}
              <span>Descargar Excel (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className="px-4 py-2 bg-[#005A36] hover:bg-[#004227] text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
            >
              {isPrinting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <Printer className="w-3.5 h-3.5 text-emerald-300" />
              )}
              <span>Imprimir Planilla</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
