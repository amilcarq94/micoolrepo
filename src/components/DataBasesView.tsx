import React, { useState } from 'react';
import { Chofer, MovimientoSilo, PlantaConfig, Lote, SiloId } from '../types';
import { ChoferesView } from './ChoferesView';
import { PlantaConfigView } from './PlantaConfigView';
import { Truck, Database, Building2 } from 'lucide-react';

interface DataBasesViewProps {
  plantaConfig: PlantaConfig;
  choferes: Chofer[];
  lotes?: Lote[];
  siloStocks?: Record<SiloId, { kg: number; especie: string; cliente: string; variedad?: string }>;
  movimientosSilo?: MovimientoSilo[];
  initialSubTab?: 'planta' | 'choferes';
  onSavePlantaConfig: (newConfig: PlantaConfig) => void;
  onSaveChofer?: (chofer: Chofer) => void;
  onImportChoferes?: (choferes: Chofer[]) => void;
}

export const DataBasesView: React.FC<DataBasesViewProps> = ({
  plantaConfig,
  choferes = [],
  lotes = [],
  siloStocks,
  movimientosSilo = [],
  initialSubTab = 'planta',
  onSavePlantaConfig,
  onSaveChofer,
  onImportChoferes
}) => {
  const [subTab, setSubTab] = useState<'planta' | 'choferes'>(initialSubTab);

  // Calcular total de elementos de catálogo en Planta
  const totalItemsPlanta = 
    (plantaConfig.clientes?.length || 0) +
    (plantaConfig.especies?.length || 0) +
    (plantaConfig.variedades?.length || 0) +
    (plantaConfig.tipos?.length || 0) +
    (plantaConfig.categorias?.length || 0) +
    (plantaConfig.tratamientos?.length || 0);

  return (
    <div className="space-y-6">
      {/* Selector de Sub-Tab de Bases de Datos */}
      <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-lg border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 pl-2">
          <div className="p-2 bg-emerald-600/20 text-emerald-400 rounded-xl border border-emerald-500/30">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-slate-100 block">
              Base de Datos y Maestros del Sistema
            </span>
            <span className="text-[11px] text-slate-400">
              Selecciona la hoja de datos a consultar o editar
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-800/80 p-1.5 rounded-xl border border-slate-700/60 flex-wrap">
          {/* 1. Hoja Planta */}
          <button
            id="tab-db-planta"
            onClick={() => setSubTab('planta')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              subTab === 'planta'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Building2 className="w-4 h-4 text-emerald-300" />
            <span>Hoja Planta (Filtros & Catálogos)</span>
            <span className="ml-1 text-[10px] bg-black/30 px-1.5 py-0.5 rounded-full font-mono text-emerald-200">
              {totalItemsPlanta}
            </span>
          </button>

          {/* 2. Choferes */}
          <button
            id="tab-db-choferes"
            onClick={() => setSubTab('choferes')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              subTab === 'choferes'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Truck className="w-4 h-4 text-sky-300" />
            <span>Choferes y Transporte</span>
            <span className="ml-1 text-[10px] bg-black/30 px-1.5 py-0.5 rounded-full font-mono text-sky-200">
              {choferes.length}
            </span>
          </button>
        </div>
      </div>

      {/* Renderizado de la Hoja Seleccionada */}
      {subTab === 'planta' ? (
        <PlantaConfigView
          plantaConfig={plantaConfig}
          lotes={lotes}
          siloStocks={siloStocks}
          movimientosSilo={movimientosSilo}
          onSavePlantaConfig={onSavePlantaConfig}
        />
      ) : (
        <ChoferesView
          choferes={choferes}
          onSaveChofer={onSaveChofer}
          onImportChoferes={onImportChoferes}
        />
      )}
    </div>
  );
};
