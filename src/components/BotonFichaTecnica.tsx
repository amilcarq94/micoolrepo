/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Lote, OrdenProceso } from '../types';
import { ImprimirFichaTecnica } from './ImprimirFichaTecnica';
import { FileText } from 'lucide-react';

interface BotonFichaTecnicaProps {
  lote: Lote;
  ordenesProceso?: OrdenProceso[];
  className?: string;
  variant?: 'button' | 'icon' | 'menu-item';
  onSaveLote?: (updatedLote: Lote) => void;
}

export const BotonFichaTecnica: React.FC<BotonFichaTecnicaProps> = ({
  lote,
  ordenesProceso,
  className = '',
  variant = 'button',
  onSaveLote,
}) => {
  const [showModal, setShowModal] = useState<boolean>(false);

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowModal(true);
  };

  const handleClose = () => {
    setShowModal(false);
  };

  return (
    <>
      {/* Opción 1: Botón Estándar "Ficha" */}
      {variant === 'button' && (
        <button
          type="button"
          onClick={handleOpen}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#006837] hover:bg-[#254731] text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-sm transition-all cursor-pointer border border-emerald-500/30 ${className}`}
          title="Ver e Imprimir Ficha Técnica A4 del Lote"
        >
          <FileText className="w-4 h-4 text-[#C9922E]" />
          <span>Ficha</span>
        </button>
      )}

      {/* Opción 2: Solo Ícono */}
      {variant === 'icon' && (
        <button
          type="button"
          onClick={handleOpen}
          className={`p-1.5 text-emerald-800 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors cursor-pointer ${className}`}
          title="Ficha Técnica A4"
        >
          <FileText className="w-4 h-4 text-[#006837]" />
        </button>
      )}

      {/* Opción 3: Ítem dentro de un menú desplegable */}
      {variant === 'menu-item' && (
        <button
          type="button"
          onClick={handleOpen}
          className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-[#006837] transition-colors ${className}`}
        >
          <FileText className="w-4 h-4 text-[#006837]" />
          <span>Ficha Técnica A4</span>
        </button>
      )}

      {/* Modal con el componente oficial de Ficha Técnica de 1 hoja A4 */}
      {showModal && (
        <ImprimirFichaTecnica
          lote={lote}
          ordenesProceso={ordenesProceso}
          isOpen={showModal}
          onClose={handleClose}
          onSaveLote={onSaveLote}
          initialEditMode={false}
        />
      )}
    </>
  );
};
