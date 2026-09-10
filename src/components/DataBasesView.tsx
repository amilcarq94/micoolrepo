import React from 'react';
import { PlantaConfig, Lote, MovimientoSilo, SiloId, Chofer } from '../types';
import { PlantaConfigView } from './PlantaConfigView';

interface DataBasesViewProps {
  plantaConfig: PlantaConfig;
  choferes?: Chofer[];
  bolsones?: any;
  lotes?: Lote[];
  siloStocks?: Record<SiloId, { kg: number; especie: string; cliente: string; variedad?: string }>;
  movimientosSilo?: MovimientoSilo[];
  initialSubTab?: 'planta';
  onSavePlantaConfig: (newConfig: PlantaConfig) => void;
  onSaveChofer?: (chofer: Chofer) => void;
  onImportChoferes?: (choferes: Chofer[]) => void;
}

export const DataBasesView: React.FC<DataBasesViewProps> = ({
  plantaConfig,
  lotes = [],
  siloStocks,
  movimientosSilo = [],
  onSavePlantaConfig,
}) => {
  return (
    <div className="space-y-6">
      <PlantaConfigView
        plantaConfig={plantaConfig}
        lotes={lotes}
        siloStocks={siloStocks}
        movimientosSilo={movimientosSilo}
        onSavePlantaConfig={onSavePlantaConfig}
      />
    </div>
  );
};

