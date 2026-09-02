/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { BolsonCampo } from '../types';
import {
  Flame,
  Droplets,
  Sprout,
  Package,
  Layers,
  MapPin,
  TrendingUp,
  Info,
  Maximize2,
  Minimize2,
  Filter,
  Warehouse,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

export type HeatmapVariable = 'stock' | 'humedad' | 'rendimiento' | 'entradas';

interface HeatmapCampoProps {
  bolsones: BolsonCampo[];
  onSelectBolson?: (bolson: BolsonCampo) => void;
  selectedBolsonId?: string | null;
  onFilterByCampo?: (campoName: string) => void;
  selectedCampoFilter?: string;
}

interface FieldZone {
  id: string;
  name: string;
  zona: string;
  superficieHa: number;
  coordenadas: string;
  colorBase: string;
  bolsones: BolsonCampo[];
  totalStockKg: number;
  totalEntradasKg: number;
  promedioHumedad: number;
  promedioRendimiento: number;
  densidadBolsas: number;
}

export const HeatmapCampo: React.FC<HeatmapCampoProps> = ({
  bolsones,
  onSelectBolson,
  selectedBolsonId,
  onFilterByCampo,
  selectedCampoFilter,
}) => {
  const [activeMetric, setActiveMetric] = useState<HeatmapVariable>('stock');
  const [hoveredZone, setHoveredZone] = useState<FieldZone | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Zonas predefinidas de campos agrícolas
  const fieldZones = useMemo<FieldZone[]>(() => {
    // Definición base de lotes/campos de la estancia
    const defaultFields = [
      { id: 'campo-1', name: 'La Barrancosa - Norte', zona: 'Norte', superficieHa: 185, coordenadas: '33°07\'S 64°21\'W', colorBase: '#10B981' },
      { id: 'campo-2', name: 'La Barrancosa - Sur', zona: 'Sur', superficieHa: 140, coordenadas: '33°09\'S 64°20\'W', colorBase: '#059669' },
      { id: 'campo-3', name: 'El Potrero - Cuartel A', zona: 'Este', superficieHa: 210, coordenadas: '33°06\'S 64°18\'W', colorBase: '#3B82F6' },
      { id: 'campo-4', name: 'El Potrero - Cuartel B', zona: 'Este', superficieHa: 175, coordenadas: '33°08\'S 64°17\'W', colorBase: '#2563EB' },
      { id: 'campo-5', name: 'Bajo Verde - Lote 12', zona: 'Oeste', superficieHa: 120, coordenadas: '33°11\'S 64°25\'W', colorBase: '#F59E0B' },
      { id: 'campo-6', name: 'Los Pinos - Parcela 08', zona: 'Centro', superficieHa: 160, coordenadas: '33°10\'S 64°22\'W', colorBase: '#8B5CF6' },
    ];

    // Agrupar bolsones por campo
    return defaultFields.map((f) => {
      const matchedBolsones = bolsones.filter((b) => {
        if (!b.campo) return false;
        const normCampo = b.campo.toLowerCase().trim();
        const normName = f.name.toLowerCase().trim();
        return normName.includes(normCampo) || normCampo.includes(normName.split(' - ')[0].toLowerCase());
      });

      // Si no hay mapeo estricto, distribuir bolsones sin campo asignado según zona
      const fallbackBolsones = bolsones.filter((b) => {
        if (b.campo) return false;
        return (b.zona || '').toLowerCase().includes(f.zona.toLowerCase());
      });

      const allMatching = [...matchedBolsones, ...fallbackBolsones];

      const totalStockKg = allMatching.reduce((acc, b) => {
        const stock = b.stockKg !== undefined ? b.stockKg : ((b.entradasKg || 0) - (b.salidasKg || 0));
        return acc + Math.max(0, stock);
      }, 0);

      const totalEntradasKg = allMatching.reduce((acc, b) => acc + (b.entradasKg || 0), 0);

      // Humedad calculada o estimada estándar (12.5 - 14.5%)
      const humedades = allMatching.map(b => b.humedad || 13.2);
      const promedioHumedad = humedades.length > 0 
        ? humedades.reduce((a, c) => a + c, 0) / humedades.length 
        : 13.0;

      // Rendimiento calculado o estimado estándar (3200 kg/Ha)
      const rendimientos = allMatching.map(b => b.rendimiento || (b.entradasKg && f.superficieHa ? Math.round(b.entradasKg / (f.superficieHa * 0.4)) : 3450));
      const promedioRendimiento = rendimientos.length > 0
        ? rendimientos.reduce((a, c) => a + c, 0) / rendimientos.length
        : 3200;

      return {
        ...f,
        bolsones: allMatching,
        totalStockKg,
        totalEntradasKg,
        promedioHumedad: Number(promedioHumedad.toFixed(1)),
        promedioRendimiento: Math.round(promedioRendimiento),
        densidadBolsas: allMatching.length,
      };
    });
  }, [bolsones]);

  // Cálculos de máximos para normalizar el mapa de calor
  const maxStock = useMemo(() => Math.max(...fieldZones.map(z => z.totalStockKg), 50000), [fieldZones]);
  const maxEntradas = useMemo(() => Math.max(...fieldZones.map(z => z.totalEntradasKg), 80000), [fieldZones]);
  const maxRendimiento = useMemo(() => Math.max(...fieldZones.map(z => z.promedioRendimiento), 4500), [fieldZones]);

  // Función generadora de color cromático según valor relativo y variable
  const getZoneColorStyle = (zone: FieldZone) => {
    if (activeMetric === 'stock') {
      const ratio = maxStock > 0 ? zone.totalStockKg / maxStock : 0;
      if (zone.totalStockKg === 0) return { bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-500', bar: 'bg-slate-300', hex: '#E2E8F0' };
      if (ratio > 0.6) return { bg: 'bg-emerald-50', border: 'border-emerald-500', text: 'text-emerald-900', bar: 'bg-emerald-500', hex: '#10B981' };
      if (ratio > 0.25) return { bg: 'bg-amber-50', border: 'border-amber-500', text: 'text-amber-900', bar: 'bg-amber-500', hex: '#F59E0B' };
      return { bg: 'bg-rose-50', border: 'border-rose-500', text: 'text-rose-900', bar: 'bg-rose-500', hex: '#EF4444' };
    }

    if (activeMetric === 'humedad') {
      const hum = zone.promedioHumedad;
      if (hum <= 13.5 && hum >= 11.5) {
        return { bg: 'bg-emerald-50', border: 'border-emerald-500', text: 'text-emerald-900', bar: 'bg-emerald-500', hex: '#10B981' };
      }
      if ((hum > 13.5 && hum <= 15.0) || (hum < 11.5 && hum >= 10.0)) {
        return { bg: 'bg-amber-50', border: 'border-amber-500', text: 'text-amber-900', bar: 'bg-amber-500', hex: '#F59E0B' };
      }
      return { bg: 'bg-rose-50', border: 'border-rose-500', text: 'text-rose-900', bar: 'bg-rose-500', hex: '#EF4444' };
    }

    if (activeMetric === 'rendimiento') {
      const ratio = maxRendimiento > 0 ? zone.promedioRendimiento / maxRendimiento : 0;
      if (ratio > 0.7) return { bg: 'bg-emerald-50', border: 'border-emerald-500', text: 'text-emerald-900', bar: 'bg-emerald-500', hex: '#10B981' };
      if (ratio > 0.4) return { bg: 'bg-amber-50', border: 'border-amber-500', text: 'text-amber-900', bar: 'bg-amber-500', hex: '#F59E0B' };
      return { bg: 'bg-rose-50', border: 'border-rose-500', text: 'text-rose-900', bar: 'bg-rose-500', hex: '#EF4444' };
    }

    // Por defecto 'entradas'
    const ratioEntrada = maxEntradas > 0 ? zone.totalEntradasKg / maxEntradas : 0;
    if (ratioEntrada > 0.6) return { bg: 'bg-blue-50', border: 'border-blue-500', text: 'text-blue-900', bar: 'bg-blue-500', hex: '#3B82F6' };
    if (ratioEntrada > 0.25) return { bg: 'bg-amber-50', border: 'border-amber-500', text: 'text-amber-900', bar: 'bg-amber-500', hex: '#F59E0B' };
    return { bg: 'bg-slate-50', border: 'border-slate-400', text: 'text-slate-800', bar: 'bg-slate-400', hex: '#94A3B8' };
  };

  const getMetricValueLabel = (zone: FieldZone) => {
    switch (activeMetric) {
      case 'stock':
        return `${(zone.totalStockKg / 1000).toFixed(1)} Tn (${zone.totalStockKg.toLocaleString('es-AR')} kg)`;
      case 'humedad':
        return `${zone.promedioHumedad}% H°`;
      case 'rendimiento':
        return `${zone.promedioRendimiento.toLocaleString('es-AR')} kg/Ha`;
      case 'entradas':
        return `${(zone.totalEntradasKg / 1000).toFixed(1)} Tn ingresadas`;
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-6 animate-in fade-in duration-200">
      {/* 1. Cabecera y Selector de Variable de Mapa de Calor */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-[#00603C] flex items-center justify-center font-bold shadow-2xs">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <span>Mapa de Calor (Heatmap) de Lotes en Campo</span>
                <span className="bg-emerald-50 text-[#00603C] text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold border border-emerald-200">
                  GIS Dinámico
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Monitoreo espacial de parcelas, densidad de silobolsas y variables agronómicas en tiempo real.
              </p>
            </div>
          </div>
        </div>

        {/* Selector de Variables */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Variable:
          </span>

          <button
            type="button"
            onClick={() => setActiveMetric('stock')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
              activeMetric === 'stock'
                ? 'bg-[#00603C] text-white border-[#00603C] shadow-sm'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Warehouse className="w-3.5 h-3.5 text-amber-300" />
            <span>Stock en Campo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMetric('humedad')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
              activeMetric === 'humedad'
                ? 'bg-blue-700 text-white border-blue-700 shadow-sm'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Droplets className="w-3.5 h-3.5 text-cyan-300" />
            <span>Humedad (%)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMetric('rendimiento')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
              activeMetric === 'rendimiento'
                ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-amber-200" />
            <span>Rendimiento</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMetric('entradas')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
              activeMetric === 'entradas'
                ? 'bg-purple-700 text-white border-purple-700 shadow-sm'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Sprout className="w-3.5 h-3.5 text-purple-200" />
            <span>Entradas (kg)</span>
          </button>
        </div>
      </div>

      {/* 2. Leyenda Cromática Dinámica */}
      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 font-bold text-slate-700 text-[11px] uppercase tracking-wider">
          <Layers className="w-4 h-4 text-emerald-700" />
          <span>Leyenda Cromática:</span>
        </div>

        {activeMetric === 'humedad' ? (
          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-2xs" />
              <span className="text-slate-700">11.5% - 13.5% (Óptima)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-500 shadow-2xs" />
              <span className="text-slate-700">13.6% - 15.0% (Precaución)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500 shadow-2xs" />
              <span className="text-slate-700">&gt;15.0% / &lt;10.0% (Crítica)</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-2xs" />
              <span className="text-slate-700">Nivel Alto / Óptimo</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-500 shadow-2xs" />
              <span className="text-slate-700">Nivel Intermedio</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500 shadow-2xs" />
              <span className="text-slate-700">Nivel Bajo / Sin Stock</span>
            </div>
          </div>
        )}

        {selectedCampoFilter && onFilterByCampo && (
          <button
            onClick={() => onFilterByCampo('')}
            className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
          >
            Mostrar todos los campos
          </button>
        )}
      </div>

      {/* 3. Cuadrícula Interactiva GIS / Polígonos de Parcelas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {fieldZones.map((zone) => {
          const style = getZoneColorStyle(zone);
          const isSelected = selectedCampoFilter && zone.name.toLowerCase().includes(selectedCampoFilter.toLowerCase());

          return (
            <div
              key={zone.id}
              onClick={() => onFilterByCampo && onFilterByCampo(zone.name.split(' - ')[0])}
              onMouseEnter={() => setHoveredZone(zone)}
              onMouseLeave={() => setHoveredZone(null)}
              className={`rounded-2xl border-2 p-5 transition-all duration-200 flex flex-col justify-between gap-4 cursor-pointer relative overflow-hidden ${
                style.bg
              } ${style.border} ${
                isSelected ? 'ring-4 ring-emerald-600/30 shadow-lg scale-[1.02]' : 'hover:shadow-md hover:scale-[1.01]'
              }`}
            >
              {/* Barra de calor superior */}
              <div className={`h-1.5 w-full absolute top-0 left-0 ${style.bar}`} />

              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-emerald-700" />
                      ZONA {zone.zona} · {zone.superficieHa} Ha
                    </span>
                    <h4 className="font-serif text-sm font-bold text-slate-900 mt-1">
                      {zone.name}
                    </h4>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border font-mono ${
                    zone.totalStockKg > 0 ? 'bg-white text-slate-900 border-slate-300' : 'bg-slate-200 text-slate-600 border-slate-300'
                  }`}>
                    {zone.densidadBolsas} {zone.densidadBolsas === 1 ? 'bolsón' : 'bolsones'}
                  </span>
                </div>

                <div className="mt-3 p-3 bg-white/80 rounded-xl border border-slate-200/80 space-y-1.5">
                  <div className="flex justify-between items-baseline text-xs">
                    <span className="text-slate-500 font-semibold uppercase text-[9px] tracking-wider">
                      {activeMetric === 'stock' ? 'Stock Remanente:' : activeMetric === 'humedad' ? 'Humedad Promedio:' : activeMetric === 'rendimiento' ? 'Rendimiento Medio:' : 'Entradas Totales:'}
                    </span>
                    <span className={`font-black font-mono text-sm ${style.text}`}>
                      {getMetricValueLabel(zone)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] pt-1.5 border-t border-slate-100">
                    <div>
                      <span className="text-slate-400 block font-semibold">Humedad:</span>
                      <span className="font-mono font-bold text-slate-700">{zone.promedioHumedad}%</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-semibold">Rendimiento:</span>
                      <span className="font-mono font-bold text-slate-700">{zone.promedioRendimiento.toLocaleString('es-AR')} kg/ha</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lista compacta de bolsones en este campo */}
              {zone.bolsones.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                    Bolsones Acopiados:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {zone.bolsones.slice(0, 4).map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSelectBolson) onSelectBolson(b);
                        }}
                        className={`text-[9px] font-mono px-2 py-0.5 rounded-md font-bold transition ${
                          selectedBolsonId === b.id
                            ? 'bg-[#00603C] text-white ring-2 ring-amber-400'
                            : 'bg-white text-slate-800 border border-slate-300 hover:border-emerald-600'
                        }`}
                        title={`${b.cultivo} ${b.variedad || ''} - ${(b.stockKg || 0).toLocaleString('es-AR')} kg`}
                      >
                        {b.numeroBolson}
                      </button>
                    ))}
                    {zone.bolsones.length > 4 && (
                      <span className="text-[9px] font-mono text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                        +{zone.bolsones.length - 4} más
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1">
                <span>GPS: {zone.coordenadas}</span>
                <span className="font-bold text-emerald-800">Filtrar Lote →</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Resumen Informativo y Sugerencias de Monitoreo */}
      <div className="p-4 bg-[#E3EFE7]/40 border border-[#E3EFE7] rounded-2xl flex items-start gap-3 text-xs text-emerald-950">
        <Info className="w-5 h-5 text-[#00603C] shrink-0 mt-0.5" />
        <div className="space-y-1 leading-relaxed">
          <p className="font-bold">
            Interacción con la Tabla y Filtros:
          </p>
          <p className="text-slate-600">
            Haga clic en cualquiera de las parcelas para sincronizar y filtrar automáticamente la lista de bolsones. Al aplicar filtros avanzados en la tabla (por tipo de bolsa, cliente o cultivo), las métricas y la coloración del mapa de calor se recalculan dinámicamente en tiempo real.
          </p>
        </div>
      </div>
    </div>
  );
};
