/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Lote, TratamientoType, TipoLoteType, CategoriaType } from '../types';
import { formatNumberArg } from '../utils/formatters';
import {
  SlidersHorizontal,
  Trash2,
  Download,
  Layers,
  Inbox,
  CheckCircle,
  XCircle,
  HelpCircle,
  TrendingUp,
  BarChart3,
  Search,
  Filter
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell
} from 'recharts';

interface DashboardAnaliticoProps {
  lotes: Lote[];
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[#1A1A1A] text-white p-3.5 rounded-xl border border-gray-800 text-xs shadow-xl font-sans text-left">
        <p className="font-bold text-[#C9922E] uppercase tracking-wider mb-2">{data.name}</p>
        <p className="flex justify-between gap-6 my-0.5">
          <span className="text-gray-400 font-medium font-sans">Stock Total:</span>
          <span className="font-mono font-bold text-white">{formatNumberArg(data.value, 0)} kg</span>
        </p>
        <p className="flex justify-between gap-6">
          <span className="text-gray-400 font-medium font-sans">En Bolsas:</span>
          <span className="font-mono font-bold text-[#E3EFE7]">{formatNumberArg(data.bolsas, 0)} b.</span>
        </p>
      </div>
    );
  }
  return null;
};

export const DashboardAnalitico: React.FC<DashboardAnaliticoProps> = ({ lotes }) => {
  // 1. Estados para los 6 Filtros
  const [filterCliente, setFilterCliente] = useState<string>('Todos');
  const [filterEspecie, setFilterEspecie] = useState<string>('Todos');
  const [filterVariedad, setFilterVariedad] = useState<string>('Todos');
  const [filterTipo, setFilterTipo] = useState<string>('Todos');
  const [filterCategoria, setFilterCategoria] = useState<string>('Todos');
  const [filterTratamiento, setFilterTratamiento] = useState<string>('Todos');

  // 2. Extraer opciones dinámicas para los selectores a partir de los datos reales de Lotes
  const clientesOptions = useMemo(() => {
    const set = new Set(lotes.map(l => {
      const c = l.cliente?.trim() || '';
      const upper = c.toUpperCase();
      if (upper === 'SAN DIEGO' || upper === 'SAN DIEGO SEMILLAS') return 'San Diego Semilla';
      return c;
    }));
    return Array.from(set).filter(Boolean).filter(c => c !== 'San Diego' && c !== 'San Diego Semillas').sort();
  }, [lotes]);

  const especiesOptions = useMemo(() => {
    const set = new Set(lotes.map(l => l.especie));
    return Array.from(set).filter(Boolean).sort();
  }, [lotes]);

  // Variedad dinámica según la especie elegida
  const variedadesOptions = useMemo(() => {
    const baseLotes = filterEspecie === 'Todos'
      ? lotes
      : lotes.filter(l => l.especie === filterEspecie);
    const set = new Set(baseLotes.map(l => l.variedad?.trim()));
    return Array.from(set).filter(Boolean).sort();
  }, [lotes, filterEspecie]);

  const tiposOptions = useMemo(() => {
    const set = new Set(lotes.map(l => l.tipo));
    return Array.from(set).filter(Boolean).sort();
  }, [lotes]);

  const categoriasOptions = useMemo(() => {
    const set = new Set(lotes.map(l => l.categoria));
    return Array.from(set).filter(Boolean).sort();
  }, [lotes]);

  const tratamientosOptions = ['Tratado', 'Sin Tratar'];

  // Resetear Variedad a Todos si la seleccionada ya no existe en la especie elegida
  React.useEffect(() => {
    if (filterVariedad !== 'Todos' && !variedadesOptions.includes(filterVariedad)) {
      setFilterVariedad('Todos');
    }
  }, [filterEspecie, variedadesOptions, filterVariedad]);

  // 3. Función para Limpiar Filtros
  const handleClearFilters = () => {
    setFilterCliente('Todos');
    setFilterEspecie('Todos');
    setFilterVariedad('Todos');
    setFilterTipo('Todos');
    setFilterCategoria('Todos');
    setFilterTratamiento('Todos');
  };

  // 4. Aplicar Filtros Combinables en Tiempo Real (6 Filtros)
  const filteredResult = useMemo(() => {
    return lotes.filter(l => {
      const rawC = l.cliente?.trim() || '';
      const upperC = rawC.toUpperCase();
      const mappedC = (upperC === 'SAN DIEGO' || upperC === 'SAN DIEGO SEMILLAS') ? 'San Diego Semilla' : rawC;
      const matchCliente = filterCliente === 'Todos' || mappedC === filterCliente;
      const matchEspecie = filterEspecie === 'Todos' || l.especie === filterEspecie;
      const matchVariedad = filterVariedad === 'Todos' || l.variedad === filterVariedad;
      const matchTipo = filterTipo === 'Todos' || l.tipo === filterTipo;
      const matchCategoria = filterCategoria === 'Todos' || l.categoria === filterCategoria;
      
      // El tratamiento en Lote es un array (tratamiento: TratamientoType[])
      const matchTratamiento = filterTratamiento === 'Todos' || 
        (l.tratamiento && l.tratamiento.includes(filterTratamiento as TratamientoType));

      return matchCliente && matchEspecie && matchVariedad && matchTipo && matchCategoria && matchTratamiento;
    });
  }, [lotes, filterCliente, filterEspecie, filterVariedad, filterTipo, filterCategoria, filterTratamiento]);

  // 5. Cálculos de KPIs Dinámicos
  const kpis = useMemo(() => {
    const totalKg = filteredResult.reduce((acc, l) => acc + l.stockKg, 0);
    const totalBolsas = filteredResult.reduce((acc, l) => acc + l.stockBolsas, 0);
    const totalLotes = filteredResult.length;
    const disponibles = filteredResult.filter(l => l.estado === 'Disponible').length;
    const agotados = filteredResult.filter(l => l.estado === 'Agotado').length;

    return {
      totalKg,
      totalBolsas,
      totalLotes,
      disponibles,
      agotados
    };
  }, [filteredResult]);

  // 6. Agrupación Dinámica para el Gráfico de Barras según Filtros Activos
  const chartData = useMemo(() => {
    if (filteredResult.length === 0) return [];

    let grouped: Record<string, { kg: number; bolsas: number }> = {};
    let groupingKey: 'cliente' | 'especie' | 'variedad' | 'lote' = 'cliente';

    // Lógica de agrupación dinámica según los filtros:
    if (filterCliente === 'Todos') {
      groupingKey = 'cliente';
      filteredResult.forEach(l => {
        const rawKey = l.cliente || 'Sin Especificar';
        const upper = rawKey.toUpperCase().trim();
        const key = (upper === 'SAN DIEGO' || upper === 'SAN DIEGO SEMILLAS') ? 'San Diego Semilla' : rawKey;
        grouped[key] = grouped[key] || { kg: 0, bolsas: 0 };
        grouped[key].kg += l.stockKg;
        grouped[key].bolsas += l.stockBolsas;
      });
    } else if (filterEspecie === 'Todos') {
      groupingKey = 'especie';
      filteredResult.forEach(l => {
        const key = l.especie || 'Sin Especificar';
        grouped[key] = grouped[key] || { kg: 0, bolsas: 0 };
        grouped[key].kg += l.stockKg;
        grouped[key].bolsas += l.stockBolsas;
      });
    } else if (filterVariedad === 'Todos') {
      groupingKey = 'variedad';
      filteredResult.forEach(l => {
        const key = l.variedad || 'Sin Especificar';
        grouped[key] = grouped[key] || { kg: 0, bolsas: 0 };
        grouped[key].kg += l.stockKg;
        grouped[key].bolsas += l.stockBolsas;
      });
    } else {
      groupingKey = 'lote';
      filteredResult.forEach(l => {
        const key = `Lote ${l.loteNro}`;
        grouped[key] = grouped[key] || { kg: 0, bolsas: 0 };
        grouped[key].kg += l.stockKg;
        grouped[key].bolsas += l.stockBolsas;
      });
    }

    // Convertir a array para recharts
    const rawData = Object.entries(grouped).map(([name, val]) => ({
      name,
      value: val.kg,
      bolsas: val.bolsas
    }));

    // Ordenar de mayor a menor stock y tomar un máximo de 12 elementos
    rawData.sort((a, b) => b.value - a.value);
    return rawData.slice(0, 12);
  }, [filteredResult, filterCliente, filterEspecie, filterVariedad]);

  // Colores alternados institucionales: Verde (#00603C), Dorado (#C9922E), Terracota (#A0522D)
  const barColors = ['#00603C', '#C9922E', '#A0522D'];

  // 7. Exportación a Excel (.xlsx) nativo
  const handleExportExcel = () => {
    if (filteredResult.length === 0) return;

    const dataToExport = filteredResult.map(l => ({
      'N° LOTE': l.loteNro || l.id,
      'CLIENTE': l.cliente,
      'ESPECIE': l.especie,
      'VARIEDAD': l.variedad,
      'TIPO DE LOTE': l.tipo,
      'CATEGORÍA': l.categoria,
      'TRATAMIENTO': l.tratamiento && l.tratamiento.length > 0 ? l.tratamiento.join(' + ') : 'Sin Tratar',
      'PRODUCTO TRATAMIENTO': l.producto || 'Ninguno',
      'ALA ACOPIO': l.ala ? `ALA ${l.ala}` : 'Sin Asignar',
      'SECTOR ACOPIO': l.sector ? `SECTOR ${l.sector}` : 'Sin Asignar',
      'UBICACIÓN COMPLETA': (l.ala && l.sector) ? `ALA ${l.ala} · SECTOR ${l.sector}` : 'Sin Asignar',
      'STOCK BOLSAS': l.stockBolsas,
      'STOCK KG': l.stockKg,
      'ESTADO': l.estado
    }));

    // Hoja Resumen Consolidada por Especie y Variedad
    interface ResumenGroup {
      especie: string;
      variedad: string;
      cantidadLotes: number;
      totalBolsas: number;
      totalKg: number;
    }

    const summaryMap = new Map<string, ResumenGroup>();
    let grandTotalBolsas = 0;
    let grandTotalKg = 0;

    filteredResult.forEach(l => {
      const esp = l.especie || 'Sin especificar';
      const varN = l.variedad || 'Sin variedad';
      const key = `${esp}___${varN}`;

      const bolsas = Number(l.stockBolsas) || 0;
      const kg = Number(l.stockKg) || 0;

      grandTotalBolsas += bolsas;
      grandTotalKg += kg;

      const existing = summaryMap.get(key);
      if (existing) {
        existing.cantidadLotes += 1;
        existing.totalBolsas += bolsas;
        existing.totalKg += kg;
      } else {
        summaryMap.set(key, {
          especie: esp,
          variedad: varN,
          cantidadLotes: 1,
          totalBolsas: bolsas,
          totalKg: kg
        });
      }
    });

    const summarySorted = Array.from(summaryMap.values()).sort((a, b) => {
      const cmpEsp = a.especie.localeCompare(b.especie);
      if (cmpEsp !== 0) return cmpEsp;
      return a.variedad.localeCompare(b.variedad);
    });

    const summaryRows = summarySorted.map(g => ({
      'Especie': g.especie,
      'Variedad': g.variedad,
      'Cantidad de Lotes': g.cantidadLotes,
      'Total Bolsas': g.totalBolsas,
      'Total Kilogramos (Kg)': g.totalKg,
      'Total Toneladas (Tn)': Number((g.totalKg / 1000).toFixed(2)),
      'Participación (% Kg)': grandTotalKg > 0 ? `${((g.totalKg / grandTotalKg) * 100).toFixed(1)}%` : '0.0%'
    }));

    summaryRows.push({
      'Especie': 'TOTAL GENERAL',
      'Variedad': '—',
      'Cantidad de Lotes': filteredResult.length,
      'Total Bolsas': grandTotalBolsas,
      'Total Kilogramos (Kg)': grandTotalKg,
      'Total Toneladas (Tn)': Number((grandTotalKg / 1000).toFixed(2)),
      'Participación (% Kg)': '100.0%'
    });

    const summaryWorksheet = XLSX.utils.json_to_sheet(summaryRows);
    const summaryKeys = Object.keys(summaryRows[0] || {});
    summaryWorksheet['!cols'] = summaryKeys.map(key => {
      const maxLen = Math.max(
        key.length,
        ...summaryRows.map(row => String((row as any)[key] ?? '').length)
      );
      return { wch: Math.min(Math.max(maxLen + 4, 15), 35) };
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
    XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Resumen Cierre');
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Lotes Analítico');

    XLSX.writeFile(workbook, `Reporte_Analitico_Lotes_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Exportación a CSV (separador ;)
  const handleExportCSV = () => {
    if (filteredResult.length === 0) return;

    const headers = [
      'Nro de Lote',
      'Cliente',
      'Especie',
      'Variedad',
      'Tipo de Lote',
      'Categoria',
      'Tratamiento',
      'Producto Tratamiento',
      'Ala Acopio',
      'Sector Acopio',
      'Ubicacion Completa',
      'Stock en Bolsas',
      'Stock en Kg',
      'Estado'
    ];

    const rows = filteredResult.map(l => [
      l.loteNro || l.id,
      l.cliente,
      l.especie,
      l.variedad,
      l.tipo,
      l.categoria,
      l.tratamiento && l.tratamiento.length > 0 ? l.tratamiento.join(' + ') : 'Sin Tratar',
      l.producto || 'Ninguno',
      l.ala ? `ALA ${l.ala}` : 'Sin Asignar',
      l.sector ? `SECTOR ${l.sector}` : 'Sin Asignar',
      (l.ala && l.sector) ? `ALA ${l.ala} · SECTOR ${l.sector}` : 'Sin Asignar',
      l.stockBolsas,
      l.stockKg,
      l.estado
    ]);

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
    link.setAttribute('download', `reporte_analitico_lotes_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isFiltered = filterCliente !== 'Todos' || filterEspecie !== 'Todos' || filterVariedad !== 'Todos' || filterTipo !== 'Todos' || filterCategoria !== 'Todos' || filterTratamiento !== 'Todos';

  return (
    <div className="space-y-6" id="analytical-dashboard-container">
      {/* 1. SECCIÓN DE FILTROS */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-50 pb-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-[#00603C]" />
            <h3 className="font-serif text-lg font-bold text-[#1A1A1A]">
              Filtros Multivariables de Control
            </h3>
          </div>
          {isFiltered && (
            <button
              onClick={handleClearFilters}
              className="flex items-center gap-1.5 text-xs font-sans font-bold text-[#A0522D] hover:bg-[#F5E5DC] px-3 py-1.5 rounded-lg border border-[#A0522D]/20 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpiar Filtros</span>
            </button>
          )}
        </div>

        {/* Rejilla de Selectores (6 Filtros) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Filtro: Cliente */}
          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-sans font-bold tracking-wider text-[#C9922E] uppercase block">
              Comitente / Cliente
            </label>
            <select
              value={filterCliente}
              onChange={(e) => setFilterCliente(e.target.value)}
              className="w-full bg-gray-50/50 hover:bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00603C] transition"
            >
              <option value="Todos">🌾 Todos los Clientes</option>
              {clientesOptions.map(cliente => (
                <option key={cliente} value={cliente}>{cliente}</option>
              ))}
            </select>
          </div>

          {/* Filtro: Especie */}
          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-sans font-bold tracking-wider text-[#C9922E] uppercase block">
              Especie / Grano
            </label>
            <select
              value={filterEspecie}
              onChange={(e) => setFilterEspecie(e.target.value)}
              className="w-full bg-gray-50/50 hover:bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00603C] transition"
            >
              <option value="Todos">🌱 Todas las Especies</option>
              {especiesOptions.map(especie => (
                <option key={especie} value={especie}>{especie}</option>
              ))}
            </select>
          </div>

          {/* Filtro: Variedad */}
          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-sans font-bold tracking-wider text-[#C9922E] uppercase block">
              Variedad
            </label>
            <select
              value={filterVariedad}
              onChange={(e) => setFilterVariedad(e.target.value)}
              className="w-full bg-gray-50/50 hover:bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00603C] transition"
            >
              <option value="Todos">🧬 Todas las Variedades</option>
              {variedadesOptions.map(varOpt => (
                <option key={varOpt} value={varOpt}>{varOpt}</option>
              ))}
            </select>
          </div>

          {/* Filtro: Tipo de Lote */}
          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-sans font-bold tracking-wider text-[#C9922E] uppercase block">
              Tipo de Lote
            </label>
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
              className="w-full bg-gray-50/50 hover:bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00603C] transition"
            >
              <option value="Todos">📦 Todos los Tipos</option>
              {tiposOptions.map(tipo => (
                <option key={tipo} value={tipo}>{tipo}</option>
              ))}
            </select>
          </div>

          {/* Filtro: Categoría */}
          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-sans font-bold tracking-wider text-[#C9922E] uppercase block">
              Categoría
            </label>
            <select
              value={filterCategoria}
              onChange={(e) => setFilterCategoria(e.target.value)}
              className="w-full bg-gray-50/50 hover:bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00603C] transition"
            >
              <option value="Todos">🏷️ Todas las Categorías</option>
              {categoriasOptions.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Filtro: Tratamiento */}
          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-sans font-bold tracking-wider text-[#C9922E] uppercase block">
              Tratamiento Químico
            </label>
            <select
              value={filterTratamiento}
              onChange={(e) => setFilterTratamiento(e.target.value)}
              className="w-full bg-gray-50/50 hover:bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00603C] transition"
            >
              <option value="Todos">🧪 Todos los Tratamientos</option>
              {tratamientosOptions.map(tr => (
                <option key={tr} value={tr}>{tr === 'Tratado' ? 'Tratado (Curado)' : 'Sin Tratar (Original)'}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 2. TARJETAS KPI EN VIVO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Volumen Acumulado */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 text-left">
          <div className="p-3 bg-[#E3EFE7]/60 rounded-xl text-[#00603C] shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-sans font-bold tracking-wider text-[#00603C] uppercase block leading-none">
              Stock Filtrado
            </span>
            <span className="font-serif text-xl font-bold text-[#1A1A1A] block mt-1.5 leading-none">
              {formatNumberArg(kpis.totalKg, 0)} <span className="text-xs font-sans font-normal text-gray-400">kg</span>
            </span>
            <span className="text-[10px] font-sans font-semibold text-[#C9922E] block mt-1 leading-none">
              {formatNumberArg(kpis.totalBolsas, 0)} bolsas totales
            </span>
          </div>
        </div>

        {/* KPI 2: Cantidad de Lotes */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 text-left">
          <div className="p-3 bg-[#F6EFDC]/60 rounded-xl text-[#C9922E] shrink-0">
            <Inbox className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-sans font-bold tracking-wider text-[#C9922E] uppercase block leading-none">
              Lotes Coincidentes
            </span>
            <span className="font-serif text-xl font-bold text-[#1A1A1A] block mt-1.5 leading-none">
              {kpis.totalLotes} <span className="text-xs font-sans font-normal text-gray-400">registrados</span>
            </span>
            <span className="text-[10px] font-sans font-semibold text-gray-400 block mt-1 leading-none">
              Representación de acopio
            </span>
          </div>
        </div>

        {/* KPI 3: Lotes Disponibles */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 text-left">
          <div className="p-3 bg-[#E3EFE7]/60 rounded-xl text-[#00603C] shrink-0">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-sans font-bold tracking-wider text-[#00603C] uppercase block leading-none">
              Lotes Disponibles
            </span>
            <span className="font-serif text-xl font-bold text-[#00603C] block mt-1.5 leading-none">
              {kpis.disponibles} <span className="text-xs font-sans font-normal text-gray-400">lotes</span>
            </span>
            <span className="text-[10px] font-sans font-semibold text-emerald-700 block mt-1 leading-none">
              Listos para despacho
            </span>
          </div>
        </div>

        {/* KPI 4: Lotes Agotados */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 text-left">
          <div className="p-3 bg-[#F5E5DC]/70 rounded-xl text-[#A0522D] shrink-0">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-sans font-bold tracking-wider text-[#A0522D] uppercase block leading-none">
              Lotes Agotados
            </span>
            <span className="font-serif text-xl font-bold text-[#A0522D] block mt-1.5 leading-none">
              {kpis.agotados} <span className="text-xs font-sans font-normal text-gray-400">lotes</span>
            </span>
            <span className="text-[10px] font-sans font-semibold text-[#A0522D]/80 block mt-1 leading-none">
              Sin stock disponible
            </span>
          </div>
        </div>
      </div>

      {/* 3. GRÁFICO DE BARRAS AGRUPADO DINÁMICAMENTE / ESTADO VACÍO */}
      {filteredResult.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
          <div className="p-4 bg-[#F5E5DC] rounded-full text-[#A0522D] mb-4 border border-[#A0522D]/10 animate-pulse">
            <HelpCircle className="w-8 h-8" />
          </div>
          <h3 className="font-serif text-2xl font-bold text-[#1A1A1A]">
            No se encontraron lotes con esos filtros
          </h3>
          <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto leading-relaxed">
            La combinación de filtros elegida (Cliente, Especie, Variedad, Tipo, Categoría y Tratamiento) no coincide con ningún lote registrado en planta actualmente. Pruebe seleccionando <strong className="text-gray-800">"Todos"</strong> en algunos campos.
          </p>
          <button
            onClick={handleClearFilters}
            className="mt-6 px-5 py-2.5 bg-[#E3EFE7] hover:bg-emerald-100 text-[#00603C] rounded-xl font-bold text-xs uppercase tracking-wider transition shadow-sm"
          >
            Limpiar Todos los Filtros
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Contenedor del Gráfico Dinámico (2 tercios en pantallas grandes) */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col h-[400px] lg:col-span-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 text-left">
              <div>
                <span className="text-[10px] font-sans font-semibold tracking-wider text-[#00603C] uppercase">
                  Distribución Volumétrica
                </span>
                <h3 className="font-serif text-lg font-bold text-[#1A1A1A] mt-0.5">
                  Stock Agrupado por{' '}
                  {filterCliente === 'Todos'
                    ? 'Cliente'
                    : filterEspecie === 'Todos'
                    ? 'Especie'
                    : filterVariedad === 'Todos'
                    ? 'Variedad'
                    : 'N° de Lote'}
                </h3>
              </div>
              <span className="text-[10px] bg-[#E3EFE7] text-[#00603C] font-semibold px-2.5 py-1 rounded-full shrink-0">
                Límite: Top 12 Lotes de mayor acopio
              </span>
            </div>

            <div className="flex-grow flex items-center justify-center min-h-0">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 15, right: 10, left: -5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#6B7280', fontSize: 10, fontWeight: 500 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#6B7280', fontSize: 10, fontWeight: 500 }}
                      tickFormatter={(val) => `${formatNumberArg(val, 0)} kg`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={45}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={barColors[index % barColors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-xs text-gray-400 font-sans">Sin existencias para graficar.</p>
              )}
            </div>
          </div>

          {/* Información Explicativa de la Agrupación (1 tercio) */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between h-[400px] text-left">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-5 h-5 text-[#C9922E]" />
                <h4 className="font-serif text-base font-bold text-[#1A1A1A]">
                  Lógica de Agrupación Dinámica
                </h4>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed space-y-2">
                El gráfico de la izquierda cambia de estructura automáticamente según el filtro de búsqueda que tenga seleccionado:
              </p>
              <div className="mt-4 space-y-3.5 text-xs">
                <div className={`p-2.5 rounded-xl border transition ${filterCliente === 'Todos' ? 'bg-[#E3EFE7]/40 border-[#00603C]/20 font-semibold' : 'bg-gray-50/50 border-gray-100'}`}>
                  <span className="block font-sans text-[10px] text-[#00603C] uppercase tracking-wider">Paso 1 (Cliente = "Todos")</span>
                  <span className="block text-gray-700 mt-0.5">Agrupa las barras por <strong className="text-gray-950">Cliente</strong> para comparar el volumen total asignado de cada comitente.</span>
                </div>
                <div className={`p-2.5 rounded-xl border transition ${filterCliente !== 'Todos' && filterEspecie === 'Todos' ? 'bg-[#F6EFDC]/60 border-[#C9922E]/20 font-semibold' : 'bg-gray-50/50 border-gray-100'}`}>
                  <span className="block font-sans text-[10px] text-[#C9922E] uppercase tracking-wider">Paso 2 (Cliente Filtrado, Especie = "Todos")</span>
                  <span className="block text-gray-700 mt-0.5">Agrupa por <strong className="text-gray-950">Especie</strong>, mostrando la distribución de granos del cliente en planta.</span>
                </div>
                <div className={`p-2.5 rounded-xl border transition ${filterCliente !== 'Todos' && filterEspecie !== 'Todos' && filterVariedad === 'Todos' ? 'bg-[#F5E5DC]/80 border-[#A0522D]/20 font-semibold' : 'bg-gray-50/50 border-gray-100'}`}>
                  <span className="block font-sans text-[10px] text-[#A0522D] uppercase tracking-wider">Paso 3 (Cliente y Especie Filtrados, Variedad = "Todos")</span>
                  <span className="block text-gray-700 mt-0.5">Agrupa por <strong className="text-gray-950">Variedad</strong>, ideal para analizar rendimientos genéticos en planta de ese comitente.</span>
                </div>
                <div className={`p-2.5 rounded-xl border transition ${filterCliente !== 'Todos' && filterEspecie !== 'Todos' && filterVariedad !== 'Todos' ? 'bg-emerald-50 border-emerald-200 font-semibold text-emerald-950' : 'bg-gray-50/50 border-gray-100'}`}>
                  <span className="block font-sans text-[10px] text-[#00603C] uppercase tracking-wider">Paso 4 (Cliente, Especie y Variedad Filtrados)</span>
                  <span className="block text-gray-700 mt-0.5">Agrupa por <strong className="text-gray-950">N° de Lote</strong>, ofreciendo la visualización más detallada de stock por partida física.</span>
                </div>
              </div>
            </div>
            <p className="text-[10.5px] italic text-gray-400 mt-3 border-t border-gray-50 pt-2.5">
              💡 Presione sobre las barras del gráfico para consultar valores volumétricos y equivalentes en bolsas.
            </p>
          </div>
        </div>
      )}

      {/* 4. TABLA DE RESULTADOS CON BOTÓN EXPORTAR CSV */}
      {filteredResult.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          {/* Header de la Tabla */}
          <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 text-left">
            <div>
              <span className="text-[10px] font-sans font-semibold tracking-wider text-[#00603C] uppercase">
                Listado Detallado de Lotes
              </span>
              <h3 className="font-serif text-lg font-bold text-[#1A1A1A] mt-0.5">
                Tabla de Lotes Filtrados ({filteredResult.length} ítems)
              </h3>
            </div>
            
            <div className="flex items-center gap-1.5 bg-[#E3EFE7]/40 p-1 rounded-xl border border-[#00603C]/20 shrink-0">
              <button
                onClick={handleExportExcel}
                className="flex items-center justify-center gap-1.5 text-xs font-sans font-bold bg-[#00603C] text-white hover:bg-[#254731] px-3.5 py-2 rounded-lg transition shadow-2xs cursor-pointer"
                title="Descargar exactamente los registros visibles en formato de Excel (.xlsx) con celdas separadas"
              >
                <Download className="w-4 h-4 text-[#C9922E]" />
                <span>Exportar a Excel (.xlsx)</span>
              </button>
              <button
                onClick={handleExportCSV}
                className="flex items-center justify-center gap-1 text-xs font-sans font-semibold text-[#00603C] hover:bg-[#00603C]/10 px-2.5 py-2 rounded-lg transition cursor-pointer"
                title="Descargar archivo CSV"
              >
                <span>CSV</span>
              </button>
            </div>
          </div>

          {/* Contenedor Responsivo de Tabla */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#00603C] text-white uppercase tracking-wider text-[10px] font-bold">
                  <th className="px-4 py-3 border-b border-[#254731]">N° Lote</th>
                  <th className="px-4 py-3 border-b border-[#254731]">Cliente</th>
                  <th className="px-4 py-3 border-b border-[#254731]">Especie</th>
                  <th className="px-4 py-3 border-b border-[#254731]">Variedad</th>
                  <th className="px-4 py-3 border-b border-[#254731]">Tipo</th>
                  <th className="px-4 py-3 border-b border-[#254731]">Categoría</th>
                  <th className="px-4 py-3 border-b border-[#254731]">Tratamiento</th>
                  <th className="px-4 py-3 border-b border-[#254731] text-right">Bolsas</th>
                  <th className="px-4 py-3 border-b border-[#254731] text-right">Kg Totales</th>
                  <th className="px-4 py-3 border-b border-[#254731] text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-sans">
                {filteredResult.map((l, index) => {
                  const isEven = index % 2 === 1;
                  return (
                    <tr
                      key={l.id}
                      className={`hover:bg-[#E3EFE7]/20 transition-colors ${
                        isEven ? 'bg-[#E3EFE7]/10' : 'bg-white'
                      }`}
                    >
                      <td className="px-4 py-3.5 font-mono font-bold text-gray-950">{l.loteNro}</td>
                      <td className="px-4 py-3.5 font-semibold text-gray-800">{l.cliente}</td>
                      <td className="px-4 py-3.5 font-medium text-[#00603C]">{l.especie}</td>
                      <td className="px-4 py-3.5 text-gray-600 font-medium">{l.variedad}</td>
                      <td className="px-4 py-3.5">
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-gray-100 text-gray-600 rounded">
                          {l.tipo}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-gray-600 font-medium">{l.categoria}</td>
                      <td className="px-4 py-3.5">
                        <span className="text-[10px] font-semibold text-gray-700 bg-amber-50 border border-amber-200/50 px-2 py-0.5 rounded">
                          {l.tratamiento && l.tratamiento.length > 0
                            ? l.tratamiento.join(' + ')
                            : 'Sin Tratar'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold text-gray-900">
                        {formatNumberArg(l.stockBolsas, 0)} b.
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-[#00603C]">
                        {formatNumberArg(l.stockKg, 0)}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            l.estado === 'Agotado'
                              ? 'bg-red-100 text-red-700'
                              : l.estado === 'Reservado'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {l.estado}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
