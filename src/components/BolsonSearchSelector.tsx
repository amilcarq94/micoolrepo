import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X, Warehouse, Package } from 'lucide-react';
import { BolsonCampo } from '../types';

interface BolsonSearchSelectorProps {
  bolsones: BolsonCampo[];
  selectedBolsonId?: string;
  selectedBolsonNro?: string;
  onSelectBolson: (bolson: BolsonCampo | null) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

export const BolsonSearchSelector: React.FC<BolsonSearchSelectorProps> = ({
  bolsones = [],
  selectedBolsonId,
  selectedBolsonNro,
  onSelectBolson,
  label = "Bolsón de Origen",
  placeholder = "Buscar bolsón por N°, cliente, cultivo, variedad...",
  className = "",
  required = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync selected bolson display
  const selectedBolson = bolsones.find(
    b => (selectedBolsonId && b.id === selectedBolsonId) ||
         (selectedBolsonNro && b.numeroBolson.toLowerCase() === selectedBolsonNro.toLowerCase())
  );

  useEffect(() => {
    if (selectedBolson) {
      setSearchTerm(`${selectedBolson.numeroBolson} (${selectedBolson.cliente} - ${selectedBolson.cultivo} ${selectedBolson.variedad})`);
    } else if (selectedBolsonNro) {
      setSearchTerm(selectedBolsonNro);
    } else {
      setSearchTerm('');
    }
  }, [selectedBolson, selectedBolsonNro, selectedBolsonId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredBolsones = bolsones.filter((b) => {
    if (!searchTerm.trim() || (selectedBolson && searchTerm === `${selectedBolson.numeroBolson} (${selectedBolson.cliente} - ${selectedBolson.cultivo} ${selectedBolson.variedad})`)) {
      return true;
    }
    const term = searchTerm.toLowerCase().trim();
    return (
      (b.numeroBolson && b.numeroBolson.toLowerCase().includes(term)) ||
      (b.cliente && b.cliente.toLowerCase().includes(term)) ||
      (b.cultivo && b.cultivo.toLowerCase().includes(term)) ||
      (b.variedad && b.variedad.toLowerCase().includes(term)) ||
      (b.campo && b.campo.toLowerCase().includes(term)) ||
      (b.zona && b.zona.toLowerCase().includes(term)) ||
      (b.categoria && b.categoria.toLowerCase().includes(term)) ||
      (b.deposito && b.deposito.toLowerCase().includes(term))
    );
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    if (!val) {
      onSelectBolson(null);
    }
    setIsOpen(true);
  };

  const handleSelect = (bolson: BolsonCampo) => {
    setSearchTerm(`${bolson.numeroBolson} (${bolson.cliente} - ${bolson.cultivo} ${bolson.variedad})`);
    onSelectBolson(bolson);
    setIsOpen(false);
  };

  const handleClear = () => {
    setSearchTerm('');
    onSelectBolson(null);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Package className="w-3.5 h-3.5 text-emerald-600" />
            {label} {required && <span className="text-red-500">*</span>}
          </span>
          {bolsones.length > 0 && (
            <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              {bolsones.length} bolsones
            </span>
          )}
        </label>
      )}

      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full pl-9 pr-9 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none shadow-2xs"
        />
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />

        {searchTerm ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <ChevronDown
            className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
            onClick={() => setIsOpen(!isOpen)}
          />
        )}
      </div>

      {/* Sugerencias desplegables */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 max-h-60 overflow-y-auto divide-y divide-slate-100 animate-in fade-in duration-150">
          {filteredBolsones.length > 0 ? (
            filteredBolsones.map((b) => {
              const isSelected = selectedBolson?.id === b.id;
              const stockKg = b.stockKg !== undefined ? b.stockKg : ((b.entradasKg || 0) - (b.salidasKg || 0));
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => handleSelect(b)}
                  className={`w-full text-left p-2.5 hover:bg-emerald-50/80 transition flex items-center justify-between group cursor-pointer ${isSelected ? 'bg-emerald-50 border-l-4 border-emerald-600' : ''}`}
                >
                  <div className="space-y-0.5">
                    <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <span className="font-mono text-emerald-800 font-extrabold">{b.numeroBolson}</span>
                      <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded">
                        {b.cliente}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                      <span className="font-semibold text-emerald-700">{b.cultivo} {b.variedad}</span>
                      {b.categoria && (
                        <span className="bg-amber-50 text-amber-800 font-semibold px-1.5 py-0.2 rounded border border-amber-200">
                          {b.categoria}
                        </span>
                      )}
                      {b.campo && <span>• Campo: {b.campo}</span>}
                      {b.zona && <span>• Zona: {b.zona}</span>}
                    </div>
                  </div>

                  <div className="text-right shrink-0 ml-2">
                    <span className="text-[11px] font-mono font-bold block text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                      {stockKg.toLocaleString('es-AR')} kg
                    </span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">
                      Ent: {(b.entradasKg || 0).toLocaleString('es-AR')} kg
                    </span>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="p-3 text-center text-xs text-slate-500 italic">
              No se encontraron bolsones registrados para "{searchTerm}".
            </div>
          )}
        </div>
      )}
    </div>
  );
};
