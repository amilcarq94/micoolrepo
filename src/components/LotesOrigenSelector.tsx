/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Lote, LoteOrigenItem } from '../types';
import { Plus, Trash2, AlertTriangle, CheckCircle2, Layers, Filter } from 'lucide-react';

interface LotesOrigenSelectorProps {
  lotes: Lote[];
  lotesSeleccionados: LoteOrigenItem[];
  targetKg?: number;
  cliente?: string;
  especie?: string;
  variedad?: string;
  categoria?: string;
  onChange: (items: LoteOrigenItem[]) => void;
}

export const LotesOrigenSelector: React.FC<LotesOrigenSelectorProps> = ({
  lotes,
  lotesSeleccionados = [],
  targetKg = 0,
  cliente,
  especie,
  variedad,
  categoria,
  onChange,
}) => {
  // Filtrar los lotes disponibles que coincidan con cliente, especie, variedad, categoria y "Sin Tratar"
  const lotesCoincidentes = useMemo(() => {
    return lotes.filter((l) => {
      // Stock mayor a 0
      if ((l.stockKg || 0) <= 0) return false;

      // Debe ser "Sin Tratar"
      const esSinTratar =
        !l.tratamiento ||
        l.tratamiento.length === 0 ||
        l.tratamiento.includes('Sin Tratar');
      if (!esSinTratar) return false;

      // Coincidir Cliente si está cargado
      if (cliente && l.cliente && l.cliente.trim().toLowerCase() !== cliente.trim().toLowerCase()) {
        return false;
      }

      // Coincidir Especie
      if (especie && l.especie && l.especie.trim().toLowerCase() !== especie.trim().toLowerCase()) {
        return false;
      }

      // Coincidir Variedad
      if (variedad && l.variedad && l.variedad.trim().toLowerCase() !== variedad.trim().toLowerCase()) {
        return false;
      }

      // Coincidir Categoria
      if (categoria && l.categoria && l.categoria.trim().toLowerCase() !== categoria.trim().toLowerCase()) {
        return false;
      }

      return true;
    });
  }, [lotes, cliente, especie, variedad, categoria]);

  // Si el filtro estricto por categoría no devuelve ninguno, permitir una coincidencia flexible por cliente y especie
  const lotesDisponibles = useMemo(() => {
    if (lotesCoincidentes.length > 0) return lotesCoincidentes;

    return lotes.filter((l) => {
      if ((l.stockKg || 0) <= 0) return false;
      const esSinTratar = !l.tratamiento || l.tratamiento.length === 0 || l.tratamiento.includes('Sin Tratar');
      if (!esSinTratar) return false;

      if (cliente && l.cliente && l.cliente.trim().toLowerCase() !== cliente.trim().toLowerCase()) return false;
      if (especie && l.especie && l.especie.trim().toLowerCase() !== especie.trim().toLowerCase()) return false;
      if (variedad && l.variedad && l.variedad.trim().toLowerCase() !== variedad.trim().toLowerCase()) return false;
      return true;
    });
  }, [lotes, lotesCoincidentes, cliente, especie, variedad]);

  const totalKgExtraidos = lotesSeleccionados.reduce(
    (acc, item) => acc + (Number(item.kgExtraidos) || 0),
    0
  );

  const diferenciaKg = targetKg - totalKgExtraidos;
  const esCubierto = targetKg > 0 && totalKgExtraidos >= targetKg;
  const porcentajeCubierto = targetKg > 0 ? Math.min(100, Math.round((totalKgExtraidos / targetKg) * 100)) : 0;

  // IDs de lotes ya seleccionados en la orden (no permitir seleccionar el mismo lote dos veces)
  const lotesUsadosIds = lotesSeleccionados.map((item) => item.loteId);

  const handleAddLote = () => {
    if (lotesSeleccionados.length >= 5) return;

    // Buscar primer lote disponible no seleccionado
    const disponible = lotesDisponibles.find((l) => !lotesUsadosIds.includes(l.id));

    if (!disponible) return;

    // Sugerir kg faltantes
    const kgSugeridos = diferenciaKg > 0 ? Math.min(diferenciaKg, disponible.stockKg) : disponible.stockKg;
    const kgPorBolsa = disponible.kgPorBolsa || 40;
    const bolsasSugeridas = Math.ceil(kgSugeridos / kgPorBolsa);

    const nuevoItem: LoteOrigenItem = {
      loteId: disponible.id,
      loteNro: disponible.loteNro || disponible.id,
      kgExtraidos: kgSugeridos,
      cantidadBolsas: bolsasSugeridas,
      kgTotales: kgSugeridos,
      stockOriginalKg: disponible.stockKg,
    };

    onChange([...lotesSeleccionados, nuevoItem]);
  };

  const handleRemoveLote = (index: number) => {
    const copia = [...lotesSeleccionados];
    copia.splice(index, 1);
    onChange(copia);
  };

  const handleLoteChange = (index: number, newLoteId: string) => {
    const nuevoLoteObj = lotesDisponibles.find((l) => l.id === newLoteId);
    if (!nuevoLoteObj) return;

    const copia = [...lotesSeleccionados];
    const kgSugeridos = diferenciaKg > 0 ? Math.min(diferenciaKg, nuevoLoteObj.stockKg) : nuevoLoteObj.stockKg;
    const kgPorBolsa = nuevoLoteObj.kgPorBolsa || 40;

    copia[index] = {
      loteId: nuevoLoteObj.id,
      loteNro: nuevoLoteObj.loteNro || nuevoLoteObj.id,
      kgExtraidos: kgSugeridos,
      cantidadBolsas: Math.ceil(kgSugeridos / kgPorBolsa),
      kgTotales: kgSugeridos,
      stockOriginalKg: nuevoLoteObj.stockKg,
    };
    onChange(copia);
  };

  const handleKgChange = (index: number, newKg: number) => {
    const val = Math.max(0, newKg);
    const copia = [...lotesSeleccionados];
    const loteActual = lotes.find((l) => l.id === copia[index].loteId);
    const kgPorBolsa = loteActual?.kgPorBolsa || 40;

    copia[index] = {
      ...copia[index],
      kgExtraidos: val,
      kgTotales: val,
      cantidadBolsas: Math.ceil(val / kgPorBolsa),
    };
    onChange(copia);
  };

  return (
    <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-200 pb-3">
        <div>
          <h4 className="text-xs font-black uppercase tracking-wider text-blue-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            Lotes de Origen (Orden de Movimiento)
          </h4>
          <p className="text-[11px] text-blue-700 mt-0.5">
            Seleccione hasta 5 lotes originarios "Sin Tratar" de {cliente || 'Cliente'} - {especie || 'Especie'} {variedad ? `(${variedad})` : ''}.
          </p>
        </div>

        <button
          type="button"
          onClick={handleAddLote}
          disabled={lotesSeleccionados.length >= 5 || lotesDisponibles.filter((l) => !lotesUsadosIds.includes(l.id)).length === 0}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl transition shadow-xs shrink-0 ${
            lotesSeleccionados.length >= 5 || lotesDisponibles.filter((l) => !lotesUsadosIds.includes(l.id)).length === 0
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>Agregar Lote de Origen ({lotesSeleccionados.length}/5)</span>
        </button>
      </div>

      {/* Indicador de Filtro y Coincidencias */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] bg-white p-2.5 rounded-xl border border-blue-100">
        <div className="flex items-center gap-1.5 text-blue-800">
          <Filter className="w-3.5 h-3.5 text-blue-500" />
          <span>Filtro de Lotes:</span>
          <span className="font-bold bg-blue-100 text-blue-900 px-2 py-0.5 rounded">Sin Tratar</span>
          {cliente && <span className="font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{cliente}</span>}
          {especie && <span className="font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{especie}</span>}
          {variedad && <span className="font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{variedad}</span>}
        </div>
        <div className="text-slate-500 font-semibold">
          Lotes Coincidentes con Stock: <strong className="text-blue-900 font-mono font-bold">{lotesDisponibles.length}</strong>
        </div>
      </div>

      {/* Tarjeta Resumen de Necesidad de Kilos Aproximados */}
      {targetKg > 0 && (
        <div className="p-3 bg-white rounded-xl border border-blue-200 shadow-2xs space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Necesidad de Kilos Aproximados</span>
              <span className="font-mono font-black text-slate-900 text-base">
                {targetKg.toLocaleString('es-AR')} kg
              </span>
            </div>

            <div className="text-xs">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Extracción de Lotes</span>
              <span className="font-mono font-black text-blue-900 text-base">
                {totalKgExtraidos.toLocaleString('es-AR')} kg
              </span>
            </div>

            <div>
              {esCubierto ? (
                <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1 rounded-lg text-xs font-black">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  DEMANDA CUBIERTA ({porcentajeCubierto}%)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-900 border border-amber-300 px-3 py-1 rounded-lg text-xs font-black">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  {diferenciaKg > 0 ? `FALTAN ${diferenciaKg.toLocaleString('es-AR')} KG` : 'SE REQUIERE ASIGNAR STOCK'}
                </span>
              )}
            </div>
          </div>

          {/* Barra de Progreso */}
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
            <div
              className={`h-full transition-all duration-300 ${
                esCubierto ? 'bg-emerald-500' : totalKgExtraidos > 0 ? 'bg-blue-500' : 'bg-slate-300'
              }`}
              style={{ width: `${porcentajeCubierto}%` }}
            />
          </div>
        </div>
      )}

      {/* Listado de Lotes Seleccionados */}
      {lotesSeleccionados.length === 0 ? (
        <div className="py-5 text-center text-xs text-blue-500 italic bg-white/80 rounded-xl border border-dashed border-blue-200">
          No ha seleccionado lotes de origen aún. Presione "Agregar Lote de Origen" para tomar hasta 5 lotes distintos "Sin Tratar".
        </div>
      ) : (
        <div className="space-y-3">
          {lotesSeleccionados.map((item, index) => {
            const loteObj = lotes.find((l) => l.id === item.loteId);
            const stockActual = loteObj ? loteObj.stockKg : item.stockOriginalKg || 0;
            const excedeStock = (item.kgExtraidos || 0) > stockActual;

            return (
              <div
                key={index}
                className={`p-3.5 rounded-xl border transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                  excedeStock ? 'bg-red-50 border-red-300' : 'bg-white border-blue-100 shadow-2xs'
                }`}
              >
                {/* Selector de Lote */}
                <div className="w-full sm:w-64">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-blue-900 mb-1">
                    Lote Origen #{index + 1}
                  </label>
                  <select
                    value={item.loteId}
                    onChange={(e) => handleLoteChange(index, e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-blue-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
                  >
                    {lotesDisponibles.map((loteOpt) => {
                      const yaSeleccionadoEnOtro =
                        lotesUsadosIds.includes(loteOpt.id) && loteOpt.id !== item.loteId;
                      return (
                        <option
                          key={loteOpt.id}
                          value={loteOpt.id}
                          disabled={yaSeleccionadoEnOtro}
                        >
                          Lote {loteOpt.loteNro || loteOpt.id} — Stock: {loteOpt.stockKg.toLocaleString('es-AR')} kg ({loteOpt.categoria || 'S/C'}) {yaSeleccionadoEnOtro ? '(Ya seleccionado)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Stock Disponible y Remanente */}
                <div className="text-xs">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Stock Disponible</span>
                  <span className="font-mono font-bold text-slate-800">
                    {stockActual.toLocaleString('es-AR')} kg
                  </span>
                  {item.kgExtraidos > 0 && (
                    <div className="text-[10px] font-mono mt-0.5">
                      <span className="text-slate-400">Restante: </span>
                      <strong className={stockActual - item.kgExtraidos < 0 ? 'text-red-600 font-bold' : 'text-blue-800 font-bold'}>
                        {Math.max(0, stockActual - item.kgExtraidos).toLocaleString('es-AR')} kg
                      </strong>
                    </div>
                  )}
                </div>

                {/* Cantidad de Kg Extraídos */}
                <div className="w-full sm:w-44">
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Kg a Extraer
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={stockActual}
                      value={item.kgExtraidos || ''}
                      onChange={(e) => handleKgChange(index, parseFloat(e.target.value) || 0)}
                      className={`w-full px-3 py-1.5 bg-white border rounded-lg text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 ${
                        excedeStock ? 'border-red-500 text-red-900' : 'border-blue-200'
                      }`}
                      placeholder="0"
                    />
                    <span className="absolute right-3 top-1.5 text-xs text-slate-400 font-bold">kg</span>
                  </div>
                  {item.cantidadBolsas ? (
                    <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                      (~ {item.cantidadBolsas} bolsas)
                    </span>
                  ) : null}
                </div>

                {/* Botón Eliminar */}
                <button
                  type="button"
                  onClick={() => handleRemoveLote(index)}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition self-end sm:self-center"
                  title="Eliminar este lote de la orden"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
