/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { MovimientoSilo, SiloId, TipoMovimientoSilo, BolsonCampo, PlantaConfig } from '../types';
import { formatKg } from '../utils/formatters';
import {
  X,
  Pencil,
  Calendar,
  Clock,
  Building2,
  Tag,
  Sprout,
  Scale,
  Droplets,
  Warehouse,
  Layers,
  AlertCircle,
  Check,
  RotateCcw,
  FileText,
  ArrowDownRight,
  ArrowUpRight,
} from 'lucide-react';

interface EditarMovimientoSiloModalProps {
  isOpen: boolean;
  movimiento: MovimientoSilo | null;
  onClose: () => void;
  onSave: (movimiento: MovimientoSilo) => Promise<void> | void;
  clientes?: string[];
  especies?: string[];
  bolsones?: BolsonCampo[];
  plantaConfig?: PlantaConfig;
}

const SILOS_DISPONIBLES: SiloId[] = ['Silo 1', 'Silo 2', 'Silo 3', 'Silo 4', 'Silo 5', 'Silo 6'];

export const EditarMovimientoSiloModal: React.FC<EditarMovimientoSiloModalProps> = ({
  isOpen,
  movimiento,
  onClose,
  onSave,
  clientes = [],
  especies = ['Soja', 'Trigo', 'Maíz', 'Arveja', 'Cebada', 'Girasol'],
  bolsones = [],
  plantaConfig,
}) => {
  if (!isOpen || !movimiento) return null;

  // Estado del formulario
  const [fecha, setFecha] = useState<string>('');
  const [hora, setHora] = useState<string>('');
  const [siloId, setSiloId] = useState<SiloId>('Silo 1');
  const [tipo, setTipo] = useState<TipoMovimientoSilo>('INGRESO');
  const [cliente, setCliente] = useState<string>('');
  const [especie, setEspecie] = useState<string>('Soja');
  const [variedad, setVariedad] = useState<string>('');
  const [bolsonOrigenNro, setBolsonOrigenNro] = useState<string>('');
  const [depositoOrigen, setDepositoOrigen] = useState<string>('');
  const [kg, setKg] = useState<number>(0);
  const [humedad, setHumedad] = useState<string>('');
  const [observaciones, setObservaciones] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Inicializar estado cuando se abre el modal o cambia el movimiento
  useEffect(() => {
    if (movimiento) {
      setFecha(movimiento.fecha || new Date().toISOString().split('T')[0]);
      setHora(movimiento.hora || '12:00');
      setSiloId(movimiento.siloId || 'Silo 1');
      setTipo(movimiento.tipo || 'INGRESO');
      setCliente(movimiento.cliente || '');
      setEspecie(movimiento.especie || 'Soja');
      setVariedad(movimiento.variedad || '');
      setBolsonOrigenNro(
        movimiento.bolsonOrigenNro ||
        (movimiento.origenes && movimiento.origenes[0]?.bolsonOrigenNro) ||
        ''
      );
      setDepositoOrigen(
        movimiento.depositoOrigen ||
        (movimiento.origenes && movimiento.origenes[0]?.depositoOrigen) ||
        ''
      );
      setKg(Number(movimiento.kg) || 0);
      setHumedad(movimiento.humedad !== undefined && movimiento.humedad !== null ? String(movimiento.humedad) : '');
      setObservaciones(movimiento.observaciones || movimiento.motivoManual || '');
      setErrorMsg(null);
    }
  }, [movimiento]);

  // Lista de variedades derivadas de plantaConfig o bolsones
  const listaVariedades = useMemo(() => {
    const setVar = new Set<string>();
    if (plantaConfig?.variedadesDb) {
      plantaConfig.variedadesDb.forEach((v) => {
        if (typeof v === 'string') setVar.add(v);
        else if (v && typeof v === 'object') {
          if ('nombre' in v && v.nombre) setVar.add(v.nombre);
          else if ('variedad' in v && (v as any).variedad) setVar.add((v as any).variedad);
        }
      });
    }
    bolsones.forEach((b) => {
      if (b.variedad) setVar.add(b.variedad);
    });
    if (variedad) setVar.add(variedad);
    return Array.from(setVar).filter(Boolean).sort();
  }, [plantaConfig, bolsones, variedad]);

  // Lista de bolsones disponibles para sugerir
  const listaBolsonesSugeridos = useMemo(() => {
    const list: Array<{ nro: string; cliente?: string; cultivo?: string; variedad?: string }> = [];
    bolsones.forEach((b) => {
      if (b.numeroBolson) {
        list.push({
          nro: b.numeroBolson,
          cliente: b.cliente,
          cultivo: b.cultivo,
          variedad: b.variedad,
        });
      }
    });
    return list;
  }, [bolsones]);

  // Manejador al seleccionar un bolsón sugerido
  const handleSelectBolsonSugerido = (nroSeleccionado: string) => {
    setBolsonOrigenNro(nroSeleccionado);
    const encontrado = bolsones.find((b) => b.numeroBolson.toLowerCase() === nroSeleccionado.toLowerCase());
    if (encontrado) {
      if (encontrado.cliente && !cliente) setCliente(encontrado.cliente);
      if (encontrado.cultivo) setEspecie(encontrado.cultivo);
      if (encontrado.variedad && !variedad) setVariedad(encontrado.variedad);
      if (encontrado.zona && !depositoOrigen) setDepositoOrigen(encontrado.zona);
    }
  };

  // Guardar cambios
  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fecha || !fecha.trim()) {
      setErrorMsg('La fecha es obligatoria.');
      return;
    }

    if (kg < 0 || isNaN(kg)) {
      setErrorMsg('La cantidad de kilos debe ser mayor o igual a 0.');
      return;
    }

    setIsSaving(true);
    try {
      const parsedHumedad = humedad.trim() !== '' ? Number(humedad) : undefined;

      // Actualizar origen si existía estructura origenes
      let updatedOrigenes = movimiento.origenes;
      if (bolsonOrigenNro || depositoOrigen) {
        if (updatedOrigenes && updatedOrigenes.length > 0) {
          updatedOrigenes = [
            {
              ...updatedOrigenes[0],
              bolsonOrigenNro: bolsonOrigenNro.trim(),
              depositoOrigen: depositoOrigen.trim(),
            },
            ...updatedOrigenes.slice(1),
          ];
        } else if (bolsonOrigenNro) {
          updatedOrigenes = [
            {
              id: 'orig-edit-1',
              bolsonOrigenNro: bolsonOrigenNro.trim(),
              depositoOrigen: depositoOrigen.trim(),
            },
          ];
        }
      }

      const updatedMov: MovimientoSilo = {
        ...movimiento,
        fecha: fecha.trim(),
        hora: hora.trim() || undefined,
        siloId,
        tipo,
        cliente: cliente.trim() || undefined,
        especie: especie.trim() || undefined,
        variedad: variedad.trim() || undefined,
        bolsonOrigenNro: bolsonOrigenNro.trim() || undefined,
        depositoOrigen: depositoOrigen.trim() || undefined,
        origenes: updatedOrigenes,
        kg: Number(kg),
        humedad: parsedHumedad,
        observaciones: observaciones.trim() || undefined,
        motivoManual: tipo === 'EGRESO_MANUAL' ? (observaciones.trim() || movimiento.motivoManual) : movimiento.motivoManual,
        descontaminacionVarietal: tipo === 'AJUSTE_ZERO' ? true : movimiento.descontaminacionVarietal,
      };

      await onSave(updatedMov);
      onClose();
    } catch (err: any) {
      console.error('Error al guardar movimiento de silo:', err);
      setErrorMsg(err?.message || 'Error al guardar los cambios en el movimiento.');
    } finally {
      setIsSaving(false);
    }
  };

  const isIngreso = tipo === 'INGRESO';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Cabecera del Modal */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-[#00603C] text-white p-4 sm:p-5 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl border border-white/20 text-amber-300 shrink-0">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-white font-sans">
                  Editar Movimiento de Silo
                </h2>
                <span className="px-2 py-0.5 bg-amber-400 text-slate-950 text-[11px] font-black rounded-md font-mono">
                  {siloId}
                </span>
                <span className="text-[11px] font-mono text-slate-300">
                  #{movimiento.id.slice(-8)}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Modifique la fecha, hora, cliente, variedad, bolsa de origen, tipo de movimiento y cantidades.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer shrink-0"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensaje de Error */}
        {errorMsg && (
          <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Cuerpo del Formulario con scroll */}
        <form onSubmit={handleGuardar} className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
          {/* SECCIÓN 1: Fecha, Hora y Silo */}
          <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
              <Calendar className="w-3.5 h-3.5 text-[#00603C]" />
              <span>1. Momento y Silo de Destino</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Fecha */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Fecha <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-[#00603C] focus:border-transparent outline-hidden"
                  />
                </div>
              </div>

              {/* Hora */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Hora (HH:MM)
                </label>
                <div className="relative">
                  <input
                    type="time"
                    value={hora}
                    onChange={(e) => setHora(e.target.value)}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-[#00603C] focus:border-transparent outline-hidden"
                  />
                </div>
              </div>

              {/* Silo */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Silo
                </label>
                <select
                  value={siloId}
                  onChange={(e) => setSiloId(e.target.value as SiloId)}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 font-bold text-slate-800 text-xs focus:ring-2 focus:ring-[#00603C] focus:border-transparent outline-hidden cursor-pointer"
                >
                  {SILOS_DISPONIBLES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: Tipo de Movimiento */}
          <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                {isIngreso ? (
                  <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <ArrowUpRight className="w-3.5 h-3.5 text-amber-600" />
                )}
                <span>2. Tipo de Movimiento</span>
              </div>
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  isIngreso ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
                }`}
              >
                {isIngreso ? '+ SUMA STOCK EN SILO' : '- RESTA O AJUSTA STOCK'}
              </span>
            </div>

            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoMovimientoSilo)}
              className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 font-bold text-slate-800 text-xs focus:ring-2 focus:ring-[#00603C] focus:border-transparent outline-hidden cursor-pointer"
            >
              <option value="INGRESO">🟢 Ingreso / Carga al Silo (Suma Stock)</option>
              <option value="EGRESO_MANUAL">🟠 Egreso / Salida Manual (Resta Stock)</option>
              <option value="EGRESO_OP">🔵 Egreso por Orden de Proceso (OP)</option>
              <option value="AJUSTE_ZERO">🟣 Descontaminación Varietal / Puesta a Cero</option>
              <option value="EGRESO_LOTE">🟡 Egreso por Lote Resultante</option>
              <option value="EGRESO">🔴 Egreso General</option>
            </select>
          </div>

          {/* SECCIÓN 3: Cliente, Especie y Variedad */}
          <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
              <Building2 className="w-3.5 h-3.5 text-[#00603C]" />
              <span>3. Cliente y Variedad del Grano</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Cliente */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Cliente
                </label>
                <input
                  type="text"
                  list="silo-edit-clientes"
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                  placeholder="Nombre de cliente o productor"
                  className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 font-medium text-slate-800 text-xs focus:ring-2 focus:ring-[#00603C] focus:border-transparent outline-hidden"
                />
                <datalist id="silo-edit-clientes">
                  {clientes.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              {/* Especie */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Especie
                </label>
                <select
                  value={especie}
                  onChange={(e) => setEspecie(e.target.value)}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 font-medium text-slate-800 text-xs focus:ring-2 focus:ring-[#00603C] focus:border-transparent outline-hidden cursor-pointer"
                >
                  {especies.map((esp) => (
                    <option key={esp} value={esp}>
                      {esp}
                    </option>
                  ))}
                </select>
              </div>

              {/* Variedad */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Variedad
                </label>
                <input
                  type="text"
                  list="silo-edit-variedades"
                  value={variedad}
                  onChange={(e) => setVariedad(e.target.value)}
                  placeholder="Ej: DM 46R18, DM 40R21..."
                  className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 font-medium text-slate-800 text-xs focus:ring-2 focus:ring-[#00603C] focus:border-transparent outline-hidden"
                />
                <datalist id="silo-edit-variedades">
                  {listaVariedades.map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
              </div>
            </div>
          </div>

          {/* SECCIÓN 4: Bolsa de Origen y Depósito */}
          <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                <Layers className="w-3.5 h-3.5 text-[#00603C]" />
                <span>4. Bolsa / Bolsón de Origen y Depósito</span>
              </div>
              {bolsonOrigenNro && (
                <span className="text-[10px] font-mono font-bold text-[#00603C] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                  Bolsa: {bolsonOrigenNro}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Bolsa / Bolsón de Origen */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Bolsa de Origen (N° Bolsón / Silobolsa)
                </label>
                <input
                  type="text"
                  list="silo-edit-bolsones"
                  value={bolsonOrigenNro}
                  onChange={(e) => handleSelectBolsonSugerido(e.target.value)}
                  placeholder="Ej: B-102, SB-04, 2026-B..."
                  className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 font-mono font-bold text-emerald-950 text-xs focus:ring-2 focus:ring-[#00603C] focus:border-transparent outline-hidden"
                />
                <datalist id="silo-edit-bolsones">
                  {listaBolsonesSugeridos.map((b, i) => (
                    <option
                      key={`${b.nro}-${i}`}
                      value={b.nro}
                      label={`${b.cultivo || ''} ${b.variedad || ''} (${b.cliente || ''})`}
                    />
                  ))}
                </datalist>
                <p className="text-[10px] text-slate-500 mt-1">
                  Identificador de la silobolsa o lote de campo del que proviene el grano cargado.
                </p>
              </div>

              {/* Depósito / Sector de Origen */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Depósito / Sector de Origen
                </label>
                <input
                  type="text"
                  value={depositoOrigen}
                  onChange={(e) => setDepositoOrigen(e.target.value)}
                  placeholder="Ej: Lote Campo Norte, Depósito 1..."
                  className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 font-medium text-slate-800 text-xs focus:ring-2 focus:ring-[#00603C] focus:border-transparent outline-hidden"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Ubicación física o sector del establecimiento de origen.
                </p>
              </div>
            </div>
          </div>

          {/* SECCIÓN 5: Kilos y Humedad */}
          <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
              <Scale className="w-3.5 h-3.5 text-[#00603C]" />
              <span>5. Cantidad de Kilos y Humedad</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Kilos */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Kilos (kg) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={kg}
                    onChange={(e) => setKg(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 font-mono font-bold text-slate-900 text-xs focus:ring-2 focus:ring-[#00603C] focus:border-transparent outline-hidden"
                  />
                  <div className="absolute right-3 top-2 text-[11px] text-slate-400 font-mono">
                    {(kg / 1000).toFixed(2)} Tn
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Cantidad: <strong className="text-slate-800">{formatKg(kg)} kg</strong>
                </p>
              </div>

              {/* Humedad */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Humedad (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={humedad}
                    onChange={(e) => setHumedad(e.target.value)}
                    placeholder="Ej: 13.5"
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 font-mono text-slate-800 text-xs focus:ring-2 focus:ring-[#00603C] focus:border-transparent outline-hidden"
                  />
                  <div className="absolute right-3 top-2 text-[11px] text-slate-400 font-mono">
                    %
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECCIÓN 6: Observaciones y Motivo */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Observaciones / Motivo de Salida o Ajuste
            </label>
            <textarea
              rows={2}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Detalles adicionales sobre este movimiento de silo..."
              className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 text-slate-800 text-xs focus:ring-2 focus:ring-[#00603C] focus:border-transparent outline-hidden resize-none"
            />
          </div>

          {/* Botones de Acción */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#00603C] hover:bg-[#004f32] active:scale-95 rounded-xl shadow-md transition cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Guardar Cambios</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
