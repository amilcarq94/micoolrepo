/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { PlantaConfig, SiloId } from '../types';
import { 
  Building2, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  Layers, 
  CheckCircle2, 
  Sparkles, 
  Info,
  Warehouse,
  RotateCcw
} from 'lucide-react';

interface SilosDBViewProps {
  plantaConfig: PlantaConfig;
  siloStocks?: Record<string, number>;
  onSavePlantaConfig: (newConfig: PlantaConfig) => void;
  showNotification?: (msg: string) => void;
}

export const SILOS_BASE_DEFAULT = [
  'Silo 1',
  'Silo 2',
  'Silo 3',
  'Silo 4',
  'Silo 5',
  'Silo 6'
];

export const SilosDBView: React.FC<SilosDBViewProps> = ({
  plantaConfig,
  siloStocks = {},
  onSavePlantaConfig,
  showNotification
}) => {
  const silos: string[] = (plantaConfig.silos && plantaConfig.silos.length > 0)
    ? plantaConfig.silos
    : SILOS_BASE_DEFAULT;

  const [nuevoSiloNombre, setNuevoSiloNombre] = useState<string>('');
  const [showAddInput, setShowAddInput] = useState<boolean>(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');

  const calcularProximoNombreSilo = (): string => {
    let maxNum = 0;
    silos.forEach((s) => {
      const match = s.match(/\d+/);
      if (match) {
        const val = parseInt(match[0], 10);
        if (val > maxNum) maxNum = val;
      }
    });
    return `Silo ${maxNum + 1}`;
  };

  const handleAgregarSilo = (nombreManual?: string) => {
    const targetNombre = (nombreManual || nuevoSiloNombre).trim();
    if (!targetNombre) return;

    if (silos.some((s) => s.toLowerCase() === targetNombre.toLowerCase())) {
      if (showNotification) showNotification(`El silo "${targetNombre}" ya está registrado.`);
      return;
    }

    const updated = [...silos, targetNombre];
    onSavePlantaConfig({
      ...plantaConfig,
      silos: updated
    });

    setNuevoSiloNombre('');
    setShowAddInput(false);
    if (showNotification) showNotification(`✓ ${targetNombre} agregado exitosamente a la base de datos.`);
  };

  const handleQuickAddNext = () => {
    const nextName = calcularProximoNombreSilo();
    handleAgregarSilo(nextName);
  };

  const handleStartEditing = (idx: number, currentName: string) => {
    setEditingIndex(idx);
    setEditingValue(currentName);
  };

  const handleConfirmEdit = (idx: number) => {
    const trimmed = editingValue.trim();
    if (!trimmed) return;

    if (silos.some((s, i) => i !== idx && s.toLowerCase() === trimmed.toLowerCase())) {
      if (showNotification) showNotification(`Ya existe otro silo con el nombre "${trimmed}".`);
      return;
    }

    const updated = [...silos];
    updated[idx] = trimmed;
    onSavePlantaConfig({
      ...plantaConfig,
      silos: updated
    });

    setEditingIndex(null);
    setEditingValue('');
    if (showNotification) showNotification(`Silo actualizado a "${trimmed}".`);
  };

  const handleEliminarSilo = (idx: number, nombre: string) => {
    if (silos.length <= 1) {
      if (showNotification) showNotification('Debe mantenerse al menos un silo en la base de datos.');
      return;
    }

    const updated = silos.filter((_, i) => i !== idx);
    onSavePlantaConfig({
      ...plantaConfig,
      silos: updated
    });

    if (showNotification) showNotification(`Silo "${nombre}" eliminado del catálogo.`);
  };

  const handleRestaurarPredeterminados = () => {
    onSavePlantaConfig({
      ...plantaConfig,
      silos: SILOS_BASE_DEFAULT
    });
    if (showNotification) showNotification('Silos restaurados a los 6 silos predeterminados.');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-[#00603C] to-slate-900 text-white rounded-3xl p-6 shadow-md border border-emerald-800/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0 shadow-inner">
            <Warehouse className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold tracking-widest text-amber-300 uppercase bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20">
                Catálogo Maestro
              </span>
              <span className="text-[10px] font-bold text-emerald-200 bg-emerald-800/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                {silos.length} Silos Registrados
              </span>
            </div>
            <h2 className="font-serif text-2xl font-bold mt-1 tracking-tight">
              Silos de Planta
            </h2>
            <p className="text-xs text-emerald-100 max-w-xl mt-1 leading-relaxed">
              Catálogo oficial de silos físicos de acopio. Alimenta las opciones de origen en generación de lotes, carátulas y trazabilidad de planta.
            </p>
          </div>
        </div>

        {/* Acciones Rápidas del Header */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            id="btn-agregar-silo-rapido"
            onClick={handleQuickAddNext}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider transition shadow-sm cursor-pointer active:scale-95"
            title={`Agregar correlativo: ${calcularProximoNombreSilo()}`}
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Agregar {calcularProximoNombreSilo()}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddInput((prev) => !prev)}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition border border-white/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Personalizado</span>
          </button>

          <button
            type="button"
            onClick={handleRestaurarPredeterminados}
            className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition border border-white/20 cursor-pointer"
            title="Restaurar a Silo 1 a Silo 6"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Formulario Inline para agregar con nombre personalizado */}
      {showAddInput && (
        <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 animate-in fade-in slide-in-from-top-2 duration-200 shadow-xs">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1">
              <label className="block text-[11px] font-bold text-emerald-950 uppercase tracking-wider mb-1">
                Nombre del Nuevo Silo:
              </label>
              <input
                type="text"
                value={nuevoSiloNombre}
                onChange={(e) => setNuevoSiloNombre(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAgregarSilo()}
                placeholder={`Ej: ${calcularProximoNombreSilo()}, Silo Pulmón, Silo Norte...`}
                className="w-full px-3.5 py-2.5 bg-white border border-emerald-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00603C]"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-2 self-end sm:self-end pt-1 sm:pt-0">
              <button
                type="button"
                onClick={() => handleAgregarSilo()}
                disabled={!nuevoSiloNombre.trim()}
                className="px-4 py-2.5 bg-[#00603C] hover:bg-[#254731] disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar Silo</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddInput(false);
                  setNuevoSiloNombre('');
                }}
                className="px-3 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grilla de Silos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
        {silos.map((siloNombre, idx) => {
          const isEditing = editingIndex === idx;
          const currentKg = siloStocks[siloNombre as SiloId] || 0;
          const hasStock = currentKg > 0;

          return (
            <div
              key={`${siloNombre}-${idx}`}
              className="bg-white border border-slate-200 hover:border-emerald-500 rounded-2xl p-4 transition shadow-xs hover:shadow-md flex flex-col justify-between gap-3 group relative"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#00603C] shrink-0 font-mono font-black text-sm">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleConfirmEdit(idx)}
                          className="px-2 py-1 bg-white border border-emerald-500 rounded-lg text-xs font-black text-slate-900 focus:outline-none w-32"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleConfirmEdit(idx)}
                          className="p-1 text-emerald-700 hover:bg-emerald-100 rounded cursor-pointer"
                          title="Guardar nombre"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingIndex(null)}
                          className="p-1 text-slate-400 hover:bg-slate-100 rounded cursor-pointer"
                          title="Cancelar"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <h4 className="font-serif font-black text-slate-900 text-base tracking-tight truncate">
                          {siloNombre}
                        </h4>
                        <span className="text-[10px] font-mono text-slate-400 block font-semibold">
                          Capacidad: 180.000 kg
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Acciones de edición / eliminación */}
                {!isEditing && (
                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                    <button
                      type="button"
                      onClick={() => handleStartEditing(idx, siloNombre)}
                      className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                      title="Editar nombre"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEliminarSilo(idx, siloNombre)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                      title="Eliminar silo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Estado de stock del silo */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-500 text-[11px] font-sans">Stock actual:</span>
                <span className={`font-black ${hasStock ? 'text-emerald-700' : 'text-slate-400'}`}>
                  {currentKg.toLocaleString('es-AR')} kg
                </span>
              </div>
            </div>
          );
        })}

        {/* Tarjeta Botón "+" para agregar nuevo silo */}
        <button
          type="button"
          id="card-btn-agregar-silo"
          onClick={handleQuickAddNext}
          className="min-h-[110px] bg-emerald-50/50 hover:bg-emerald-100/60 border-2 border-dashed border-emerald-300 hover:border-emerald-500 rounded-2xl p-4 transition flex flex-col items-center justify-center gap-2 text-emerald-800 cursor-pointer active:scale-98 group shadow-2xs"
        >
          <div className="w-10 h-10 rounded-full bg-white border border-emerald-300 flex items-center justify-center group-hover:scale-110 group-hover:bg-[#00603C] group-hover:text-white transition-all shadow-xs">
            <Plus className="w-5 h-5 stroke-[2.5]" />
          </div>
          <span className="text-xs font-black uppercase tracking-wider text-emerald-950 font-sans">
            + Agregar {calcularProximoNombreSilo()}
          </span>
          <span className="text-[10px] text-emerald-700/80 font-mono">
            Click para alta inmediata correlativa
          </span>
        </button>
      </div>

      {/* Nota de ayuda inferior */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-start gap-3 text-xs text-slate-600">
        <Info className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-slate-800">
            Sincronización con "Generar Lote" y Carátulas:
          </p>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Todos los silos registrados aquí (Silo 1, Silo 2, Silo 3, Silo 4, Silo 5, Silo 6 y los nuevos que agregue con el botón "+") aparecen automáticamente en la columna <strong>"Origen"</strong> de la tabla sheet de <strong>Generar Lote</strong>.
          </p>
        </div>
      </div>
    </div>
  );
};
