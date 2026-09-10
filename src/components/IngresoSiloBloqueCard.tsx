/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { SiloId, Chofer, BolsonCampo, MovimientoSilo, CATEGORIAS_OFICIALES, SECTORES_BOLSON_OPCIONES, CAPACIDAD_MAX_SILO, PlantaConfig, getVariedadesVisibles, getVariedadesPorEspecie } from '../types';
import { SILOS_DISPONIBLES } from './SilosSelector';
import { ClienteSelect } from './ClienteSelect';
import { getSiloActiveData } from '../utils/siloValidation';
import {
  Warehouse,
  Plus,
  Trash2,
  Droplets,
  Scale,
  MapPin,
  AlertTriangle,
  Layers,
  ChevronDown
} from 'lucide-react';

export interface OrigenIngresoItem {
  id: string;
  bolsonOrigenNro: string;
  bolsonOrigenSector: string;
  depositoOrigen: string;
}

export interface IngresoBloqueItem {
  id: string;
  siloId: SiloId;
  fecha: string;
  hora: string;
  cliente: string;
  especie: string;
  variedad: string;
  categoria: string;
  campoOrigenSelect: string;
  campoOrigenManual: string;
  bolsonOrigenId: string;
  bolsonOrigenNro: string;
  bolsonOrigenSector: string;
  depositoOrigen: string;
  origenes?: OrigenIngresoItem[];
  totalKgIngresados: number | '';
  humedad: number | '';
  modalidadTransporte?: 'FLETE_TERCEROS' | 'FLETE_PROPIO';
  subTipoTerceros?: 'CHOFER' | 'FLETE_MONTANER';
  tipoTransporte?: 'CHOFER' | 'FLETE';
  fleteOpcion?: 'Flete Montaner' | 'Flete Agro Abacus';
  choferNombre?: string;
  choferCuit?: string;
  choferPatentes?: string;
  choferTransporte?: string;
  choferTara?: number | '';
  comprobanteCartaPorte?: string;
  observaciones?: string;
  error?: string;
  siloContaminado?: boolean;
}

export const createDefaultIngresoBloque = (
  siloId: SiloId = 'Silo 1',
  clienteDefault: string = 'San Diego Semilla',
  especieDefault: string = 'Soja'
): IngresoBloqueItem => {
  const now = new Date();
  const horaActual = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }) || now.toTimeString().slice(0, 5);

  return {
    id: `BLOQUE-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    siloId,
    fecha: now.toISOString().split('T')[0],
    hora: horaActual,
    cliente: clienteDefault,
    especie: especieDefault,
    variedad: 'P46A03',
    categoria: 'FUNDADORA',
    campoOrigenSelect: 'La Barrancosa',
    campoOrigenManual: '',
    bolsonOrigenId: '',
    bolsonOrigenNro: '',
    bolsonOrigenSector: '',
    depositoOrigen: 'Depósito Central',
    origenes: [
      {
        id: `orig-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        bolsonOrigenNro: '',
        bolsonOrigenSector: '',
        depositoOrigen: 'Depósito Central',
      },
    ],
    totalKgIngresados: '',
    humedad: 13.5,
    modalidadTransporte: 'FLETE_TERCEROS',
    subTipoTerceros: 'CHOFER',
    tipoTransporte: 'CHOFER',
    fleteOpcion: 'Flete Montaner',
    choferNombre: '',
    choferCuit: '',
    choferPatentes: '',
    choferTransporte: '',
    choferTara: '',
    comprobanteCartaPorte: '',
    observaciones: '',
  };
};

interface IngresoSiloBloqueCardProps {
  bloque: IngresoBloqueItem;
  index: number;
  totalBloques: number;
  clientes: string[];
  especies: string[];
  plantaConfig?: PlantaConfig;
  choferes?: Chofer[];
  bolsones?: BolsonCampo[];
  movimientosSilo?: MovimientoSilo[];
  currentStockPorSilo: Record<SiloId, number>;
  onUpdate: (updated: IngresoBloqueItem) => void;
  onRemove: () => void;
  onAddNext: () => void;
  onSaveChofer?: (chofer: Chofer) => void;
  onFileUploadChoferes?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLimpiezaDescarte?: (siloId: SiloId) => void;
}

export const IngresoSiloBloqueCard: React.FC<IngresoSiloBloqueCardProps> = ({
  bloque,
  index,
  totalBloques,
  clientes,
  especies,
  plantaConfig,
  choferes,
  bolsones,
  movimientosSilo = [],
  currentStockPorSilo,
  onUpdate,
  onRemove,
  onAddNext,
  onSaveChofer,
  onFileUploadChoferes,
  onLimpiezaDescarte,
}) => {
  const stockSiloActual = currentStockPorSilo[bloque.siloId] || 0;
  const espacioDisponible = Math.max(0, CAPACIDAD_MAX_SILO - stockSiloActual);
  const porcentajeOcupado = Math.min(100, (stockSiloActual / CAPACIDAD_MAX_SILO) * 100);

  // Cambio de silo de destino con autocompletado inteligente de cereal asignado al silo (ej. Silo 2 con Stine Soja 50EE59)
  const handleSiloChange = (newSiloId: SiloId) => {
    const siloData = getSiloActiveData(newSiloId, movimientosSilo);
    const isOcupado = !siloData.isEmpty && siloData.stockKg > 0;
    onUpdate({
      ...bloque,
      siloId: newSiloId,
      cliente: isOcupado && siloData.cliente && siloData.cliente !== '-' ? siloData.cliente : bloque.cliente,
      especie: isOcupado && siloData.especie && siloData.especie !== '-' ? siloData.especie : bloque.especie,
      variedad: isOcupado && siloData.variedad && siloData.variedad !== '-' ? siloData.variedad : bloque.variedad,
      categoria: isOcupado && siloData.categoria && siloData.categoria !== '-' ? siloData.categoria : bloque.categoria,
      error: undefined,
      siloContaminado: undefined,
    });
  };

  // Lista de variedades filtradas estrictamente desde la Base de Datos para este cliente y especie
  const variedadesDisponibles = useMemo(() => {
    const dbList = plantaConfig?.variedadesDb;
    // 1. Filtrar por Especie y Cliente seleccionados
    const visibles = getVariedadesVisibles(dbList, bloque.especie, bloque.cliente);
    if (visibles.length > 0) {
      return Array.from(new Set(visibles.map((v) => v.nombre.trim())));
    }
    // 2. Filtrar por Especie
    const porEspecie = getVariedadesPorEspecie(dbList, bloque.especie);
    if (porEspecie.length > 0) {
      return Array.from(new Set(porEspecie.map((v) => v.nombre.trim())));
    }
    // 3. Fallback a variedades de la planta
    if (plantaConfig?.variedades && plantaConfig.variedades.length > 0) {
      return plantaConfig.variedades;
    }
    return ['P46A03', 'CASUARINA', 'DM 46R18', 'DM 40R16', 'BIO 4.50', 'STINE 4000', 'BAGUETTE 601'];
  }, [plantaConfig, bloque.especie, bloque.cliente]);

  const handleChange = <K extends keyof IngresoBloqueItem>(key: K, value: IngresoBloqueItem[K]) => {
    onUpdate({
      ...bloque,
      [key]: value,
      // Limpiar error específico al editar
      error: undefined,
      siloContaminado: undefined,
    });
  };

  // Gestión dinámica de múltiples Orígenes (Bolsa de Origen, Sector de Origen, Depósito / Ubicación Origen)
  const origenesList: OrigenIngresoItem[] = useMemo(() => {
    if (bloque.origenes && bloque.origenes.length > 0) {
      return bloque.origenes;
    }
    return [
      {
        id: 'orig-default-1',
        bolsonOrigenNro: bloque.bolsonOrigenNro || '',
        bolsonOrigenSector: bloque.bolsonOrigenSector || '',
        depositoOrigen: bloque.depositoOrigen || 'Depósito Central',
      },
    ];
  }, [bloque.origenes, bloque.bolsonOrigenNro, bloque.bolsonOrigenSector, bloque.depositoOrigen]);

  const handleUpdateOrigen = (idx: number, field: keyof OrigenIngresoItem, val: string) => {
    const updated = origenesList.map((orig, i) => (i === idx ? { ...orig, [field]: val } : orig));
    const combinedBolsa = updated.map((o) => o.bolsonOrigenNro.trim()).filter(Boolean).join(', ');
    const combinedSector = updated.map((o) => o.bolsonOrigenSector.trim()).filter(Boolean).join(', ');
    const combinedDeposito = updated.map((o) => o.depositoOrigen.trim()).filter(Boolean).join(', ');

    onUpdate({
      ...bloque,
      origenes: updated,
      bolsonOrigenNro: combinedBolsa || updated[0]?.bolsonOrigenNro || '',
      bolsonOrigenSector: combinedSector || updated[0]?.bolsonOrigenSector || '',
      depositoOrigen: combinedDeposito || updated[0]?.depositoOrigen || '',
    });
  };

  const handleAddOrigen = () => {
    const defaultDep = origenesList[origenesList.length - 1]?.depositoOrigen || 'Depósito Central';
    const updated: OrigenIngresoItem[] = [
      ...origenesList,
      {
        id: `orig-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        bolsonOrigenNro: '',
        bolsonOrigenSector: '',
        depositoOrigen: defaultDep,
      },
    ];
    onUpdate({
      ...bloque,
      origenes: updated,
    });
  };

  const handleRemoveOrigen = (idx: number) => {
    if (origenesList.length <= 1) return;
    const updated = origenesList.filter((_, i) => i !== idx);
    const combinedBolsa = updated.map((o) => o.bolsonOrigenNro.trim()).filter(Boolean).join(', ');
    const combinedSector = updated.map((o) => o.bolsonOrigenSector.trim()).filter(Boolean).join(', ');
    const combinedDeposito = updated.map((o) => o.depositoOrigen.trim()).filter(Boolean).join(', ');

    onUpdate({
      ...bloque,
      origenes: updated,
      bolsonOrigenNro: combinedBolsa || updated[0]?.bolsonOrigenNro || '',
      bolsonOrigenSector: combinedSector || updated[0]?.bolsonOrigenSector || '',
      depositoOrigen: combinedDeposito || updated[0]?.depositoOrigen || '',
    });
  };

  return (
    <div
      id={`bloque-ingreso-${bloque.id}`}
      className="bg-white border-2 border-slate-200 hover:border-slate-300 rounded-2xl p-4 sm:p-5 shadow-xs space-y-5 transition duration-150 relative"
    >
      {/* Encabezado del Bloque */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-800 text-white font-mono font-bold text-xs shadow-xs">
            {index + 1}
          </span>
          <div>
            <h4 className="text-sm font-extrabold text-slate-900 font-serif tracking-tight flex items-center gap-2">
              <span>Ingreso a Silo #{index + 1}</span>
              <span className="text-xs px-2.5 py-0.5 rounded-md font-sans font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                {bloque.siloId}
              </span>
            </h4>
            <span className="text-[11px] text-slate-500 font-medium">
              Stock actual: <strong className="font-mono text-slate-700">{stockSiloActual.toLocaleString('es-AR')} kg</strong> ({porcentajeOcupado.toFixed(1)}% ocupado)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {totalBloques > 1 && (
            <button
              type="button"
              onClick={onRemove}
              className="px-3 py-1.5 text-xs font-bold text-red-700 hover:text-red-900 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Eliminar este bloque de ingreso"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-600" />
              <span>Eliminar ingreso</span>
            </button>
          )}
        </div>
      </div>

      {/* Alerta de error específico del bloque si existiera */}
      {bloque.error && (
        <div className="p-3.5 bg-red-50 border border-red-300 text-red-900 rounded-xl text-xs font-medium flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="whitespace-pre-line leading-relaxed">{bloque.error}</div>
          </div>
          {bloque.siloContaminado && onLimpiezaDescarte && (
            <button
              type="button"
              onClick={() => onLimpiezaDescarte(bloque.siloId)}
              className="px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white font-bold text-[11px] uppercase tracking-wider rounded-lg shrink-0 cursor-pointer shadow-xs"
            >
              Limpieza / Descarte
            </button>
          )}
        </div>
      )}

      {/* SECCIÓN 1: DESTINO Y CLIENTE */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-1.5 text-slate-700 text-xs font-bold uppercase tracking-wider">
          <Warehouse className="w-4 h-4 text-emerald-700" />
          <span>1. Destino y Titular</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
          {/* Silo de destino */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">
              Silo de Destino *
            </label>
            <div className="relative">
              <select
                value={bloque.siloId}
                onChange={(e) => handleSiloChange(e.target.value as SiloId)}
                className="w-full px-3 py-2 bg-slate-50 hover:bg-white border-2 border-emerald-600/60 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-700 outline-none transition shadow-2xs"
                required
              >
                {SILOS_DISPONIBLES.map((siloId) => {
                  const sStock = currentStockPorSilo[siloId] || 0;
                  const sLibre = Math.max(0, CAPACIDAD_MAX_SILO - sStock);
                  return (
                    <option key={siloId} value={siloId}>
                      {siloId} (Stock: {(sStock / 1000).toFixed(1)} Tn / Libre: {(sLibre / 1000).toFixed(1)} Tn)
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Fecha de Ingreso */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">
              Fecha de Ingreso *
            </label>
            <input
              type="date"
              value={bloque.fecha}
              onChange={(e) => handleChange('fecha', e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none shadow-2xs"
              required
            />
          </div>

          {/* Hora de Ingreso */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">
              Hora de Ingreso *
            </label>
            <input
              type="time"
              value={bloque.hora || ''}
              onChange={(e) => handleChange('hora', e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none shadow-2xs"
              required
            />
          </div>

          {/* Cliente / Titular */}
          <div className="sm:col-span-2">
            <ClienteSelect
              value={bloque.cliente}
              onChange={(val) => handleChange('cliente', val)}
              label="Cliente / Titular *"
              selectClassName="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 text-xs shadow-2xs"
              inputClassName="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-medium text-slate-900 text-xs mt-1 shadow-2xs"
            />
          </div>

          {/* Especie */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">
              Especie *
            </label>
            <select
              value={bloque.especie}
              onChange={(e) => handleChange('especie', e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none shadow-2xs"
              required
            >
              {especies.map((esp) => (
                <option key={esp} value={esp}>
                  {esp}
                </option>
              ))}
            </select>
          </div>

          {/* Variedad / Híbrido */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[10px] font-bold uppercase text-slate-700">
                Variedad / Híbrido (BD) *
              </label>
              {variedadesDisponibles.length > 0 && (
                <span className="text-[9px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded">
                  {variedadesDisponibles.length} en BD
                </span>
              )}
            </div>
            {variedadesDisponibles.length > 0 ? (
              <select
                value={bloque.variedad}
                onChange={(e) => handleChange('variedad', e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none shadow-2xs text-xs"
                required
              >
                <option value="">-- Seleccionar Variedad Existente --</option>
                {variedadesDisponibles.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder="ej: P46A03, CASUARINA..."
                value={bloque.variedad}
                onChange={(e) => handleChange('variedad', e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-900 uppercase focus:ring-2 focus:ring-emerald-500 outline-none shadow-2xs text-xs"
                required
              />
            )}
          </div>

          {/* Categoría */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">
              Categoría *
            </label>
            <select
              value={bloque.categoria}
              onChange={(e) => handleChange('categoria', e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none shadow-2xs"
            >
              {CATEGORIAS_OFICIALES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Campo Origen */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-emerald-700" /> Campo Origen
            </label>
            <select
              value={bloque.campoOrigenSelect}
              onChange={(e) => handleChange('campoOrigenSelect', e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none shadow-2xs"
            >
              <option value="La Barrancosa">La Barrancosa</option>
              <option value="Otro">Otro campo...</option>
            </select>
            {bloque.campoOrigenSelect === 'Otro' && (
              <input
                type="text"
                placeholder="Nombre del campo..."
                value={bloque.campoOrigenManual}
                onChange={(e) => handleChange('campoOrigenManual', e.target.value)}
                className="mt-1.5 w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl font-medium text-slate-900 text-xs shadow-2xs"
                required
              />
            )}
          </div>
        </div>

        {/* Ubicaciones de Origen Dinámicas: Bolsa, Sector, Depósito con botón [+] */}
        <div className="pt-2 border-t border-slate-100 space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5 text-slate-700 text-xs font-bold uppercase tracking-wider">
              <Layers className="w-3.5 h-3.5 text-emerald-700" />
              <span>Bolsa de Origen, Sector y Depósito</span>
              {origenesList.length > 1 && (
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[10px] font-bold">
                  {origenesList.length} orígenes
                </span>
              )}
            </div>

            {/* BOTÓN "+" PARA AGREGAR BOLSA DE ORIGEN, SECTOR DE ORIGEN, DEPÓSITO / UBICACIÓN ORIGEN */}
            <button
              type="button"
              id={`btn-add-origen-${bloque.id}`}
              onClick={handleAddOrigen}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 hover:text-emerald-900 border border-emerald-300 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer shadow-2xs"
              title="Agregar otra Bolsa de Origen, Sector de Origen y Depósito"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-700" />
              <span>+ Agregar Bolsa / Sector / Depósito</span>
            </button>
          </div>

          <div className="space-y-2">
            {origenesList.map((orig, oIdx) => (
              <div
                key={orig.id || oIdx}
                className="p-3 bg-slate-50/90 rounded-xl border border-slate-200/90 hover:border-emerald-300 transition"
              >
                {origenesList.length > 1 && (
                  <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-200">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1">
                      <span className="w-4 h-4 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[9px]">
                        {oIdx + 1}
                      </span>
                      <span>Origen #{oIdx + 1}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveOrigen(oIdx)}
                      className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50 transition cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                      title="Quitar este origen"
                    >
                      <Trash2 className="w-3 h-3 text-red-500" />
                      <span>Quitar</span>
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1 flex items-center gap-1">
                      <Layers className="w-3 h-3 text-emerald-700" /> Bolsa de Origen
                    </label>
                    <input
                      type="text"
                      placeholder="ej: Bolsa 124, S29.2, B-101..."
                      value={orig.bolsonOrigenNro}
                      onChange={(e) => handleUpdateOrigen(oIdx, 'bolsonOrigenNro', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-medium text-slate-900 shadow-2xs text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1 flex items-center gap-1">
                      <span>Sector de Origen</span>
                    </label>
                    <input
                      type="text"
                      placeholder="ej: Sector Norte, Lote 4, A..."
                      value={orig.bolsonOrigenSector}
                      onChange={(e) => handleUpdateOrigen(oIdx, 'bolsonOrigenSector', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-medium text-slate-900 shadow-2xs text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">
                      Depósito / Ubicación Origen
                    </label>
                    <input
                      type="text"
                      placeholder="ej: Depósito Central, Acopio 1..."
                      value={orig.depositoOrigen}
                      onChange={(e) => handleUpdateOrigen(oIdx, 'depositoOrigen', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-medium text-slate-900 shadow-2xs text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SECCIÓN 2: CALIDAD Y PESAJE */}
      <div className="space-y-2.5 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-1.5 text-slate-700 text-xs font-bold uppercase tracking-wider">
          <Scale className="w-4 h-4 text-emerald-700" />
          <span>2. Calidad y Pesaje</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
          {/* Kilos Netos (kg) */}
          <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-200">
            <label className="block text-[10px] font-bold uppercase text-emerald-900 mb-1 flex items-center justify-between">
              <span>Kilos Netos (kg) *</span>
              <span className="text-[10px] font-normal text-emerald-700">Impacta en stock</span>
            </label>
            <div className="relative">
              <input
                type="number"
                min={1}
                step="1"
                placeholder="0"
                value={bloque.totalKgIngresados}
                onChange={(e) => handleChange('totalKgIngresados', e.target.value !== '' ? parseFloat(e.target.value) : '')}
                className="w-full px-3 py-2 bg-white border-2 border-emerald-500 rounded-xl font-mono font-black text-slate-950 text-base focus:ring-2 focus:ring-emerald-500 outline-none shadow-2xs pr-10"
                required
              />
              <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-500 font-mono">kg</span>
            </div>
            <span className="block text-[10px] text-emerald-800 font-medium mt-1">
              {typeof bloque.totalKgIngresados === 'number' && bloque.totalKgIngresados > 0
                ? `= ${(bloque.totalKgIngresados / 1000).toFixed(2)} Toneladas métricas`
                : 'Ingrese el peso neto del camión'}
            </span>
          </div>

          {/* Porcentaje de Humedad (%) */}
          <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-200">
            <label className="block text-[10px] font-bold uppercase text-blue-900 mb-1 flex items-center gap-1">
              <Droplets className="w-3.5 h-3.5 text-blue-600" />
              <span>Porcentaje de Humedad (%) *</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                min="0"
                max="35"
                placeholder="ej: 13.5"
                value={bloque.humedad}
                onChange={(e) => handleChange('humedad', e.target.value !== '' ? parseFloat(e.target.value) : '')}
                className="w-full px-3 py-2 bg-white border border-blue-400 rounded-xl font-mono font-bold text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-2xs pr-8"
                required
              />
              <span className="absolute right-3 top-2.5 text-xs font-bold text-blue-600 font-mono">%</span>
            </div>
            <span className="block text-[9.5px] text-blue-800 font-medium mt-1">
              Registro para ficha técnica y calidad de acopio.
            </span>
          </div>
        </div>
      </div>

      {/* BOTÓN SECUNDARIO VISIBLE: [+] AGREGAR OTRO INGRESO A SILOS */}
      <div className="pt-3 border-t border-slate-100 flex justify-end">
        <button
          type="button"
          onClick={onAddNext}
          className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-emerald-50 text-emerald-800 hover:text-emerald-900 border-2 border-dashed border-emerald-400 hover:border-emerald-600 rounded-xl font-extrabold text-xs transition duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-2xs active:scale-98"
          title="Desplegar un nuevo bloque completo de Ingreso a Silo debajo"
          id={`btn-add-next-ingreso-${index}`}
        >
          <Plus className="w-4 h-4 text-emerald-700" />
          <span>[+] Agregar otro ingreso a silos</span>
        </button>
      </div>
    </div>
  );
};
