import React, { useState } from 'react';
import { PlantaConfig, Lote, MovimientoSilo, SiloId, Chofer } from '../types';
import { PlantaConfigView } from './PlantaConfigView';
import { ParkingAutorizadosDBView } from './ParkingAutorizadosDBView';
import { Database, Clock, Building2, UserCheck } from 'lucide-react';

interface DataBasesViewProps {
  plantaConfig: PlantaConfig;
  choferes?: Chofer[];
  bolsones?: any;
  lotes?: Lote[];
  siloStocks?: Record<SiloId, { kg: number; especie: string; cliente: string; variedad?: string }>;
  movimientosSilo?: MovimientoSilo[];
  initialSubTab?: 'planta' | 'parking-autorizados';
  onSavePlantaConfig: (newConfig: PlantaConfig) => void;
  onSaveChofer?: (chofer: Chofer) => void;
  onImportChoferes?: (choferes: Chofer[]) => void;
  showNotification?: (msg: string) => void;
}

export const DataBasesView: React.FC<DataBasesViewProps> = ({
  plantaConfig,
  lotes = [],
  siloStocks,
  movimientosSilo = [],
  initialSubTab = 'planta',
  onSavePlantaConfig,
  showNotification
}) => {
  const [activeTab, setActiveTab] = useState<'planta' | 'parking-autorizados'>(initialSubTab);

  return (
    <div className="space-y-6">
      {/* SELECTOR DE PESTAÑAS PRINCIPALES DE DATA BASES */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200 max-w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('planta')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
            activeTab === 'planta'
              ? 'bg-[#00603C] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Database className={`w-4 h-4 ${activeTab === 'planta' ? 'text-amber-300' : 'text-slate-500'}`} />
          <span>Catálogos de Planta & Granos</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('parking-autorizados')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
            activeTab === 'parking-autorizados'
              ? 'bg-[#00603C] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Clock className={`w-4 h-4 ${activeTab === 'parking-autorizados' ? 'text-amber-300' : 'text-[#00603C]'}`} />
          <span>Parking: Clientes y Despachantes</span>
        </button>
      </div>

      {/* CONTENIDO DE LA PESTAÑA ACTIVA */}
      {activeTab === 'planta' ? (
        <PlantaConfigView
          plantaConfig={plantaConfig}
          lotes={lotes}
          siloStocks={siloStocks}
          movimientosSilo={movimientosSilo}
          onSavePlantaConfig={onSavePlantaConfig}
        />
      ) : (
        <ParkingAutorizadosDBView
          showNotification={showNotification}
        />
      )}
    </div>
  );
};


