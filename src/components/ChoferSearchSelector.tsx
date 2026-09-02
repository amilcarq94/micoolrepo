import React, { useState, useRef, useEffect } from 'react';
import { Search, UserCheck, Truck, CreditCard, ChevronDown, Plus, Check, X } from 'lucide-react';
import { Chofer } from '../types';
import { normalizeStr } from '../utils/choferes';

interface ChoferSearchSelectorProps {
  choferes: Chofer[];
  selectedChoferNombre: string;
  onSelectChofer: (chofer: Chofer) => void;
  onManualChange?: (nombre: string) => void;
  onSaveNewChofer?: (choferData: Partial<Chofer>) => void;
  label?: string;
  placeholder?: string;
  className?: string;
}

export const ChoferSearchSelector: React.FC<ChoferSearchSelectorProps> = ({
  choferes = [],
  selectedChoferNombre,
  onSelectChofer,
  onManualChange,
  onSaveNewChofer,
  label = "Chofer / Conductor",
  placeholder = "Buscar por nombre, DNI, transporte o patente...",
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(selectedChoferNombre || '');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearchTerm(selectedChoferNombre || '');
  }, [selectedChoferNombre]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredChoferes = choferes.filter((c) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    return (
      (c.nombre && c.nombre.toLowerCase().includes(term)) ||
      (c.cuit && c.cuit.toLowerCase().includes(term)) ||
      (c.transporte && c.transporte.toLowerCase().includes(term)) ||
      (c.patentes && c.patentes.toLowerCase().includes(term)) ||
      (c.licencia && c.licencia.toLowerCase().includes(term))
    );
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    if (onManualChange) {
      onManualChange(val);
    }
    setIsOpen(true);
  };

  const handleSelect = (chofer: Chofer) => {
    setSearchTerm(chofer.nombre);
    onSelectChofer(chofer);
    setIsOpen(false);
  };

  const exactMatch = choferes.some(
    (c) => normalizeStr(c.nombre) === normalizeStr(searchTerm)
  );

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center justify-between h-[20px]">
          <span className="flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            {label}
          </span>
          {choferes.length > 0 && (
            <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              {choferes.length} reg.
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
          className="w-full pl-9 pr-9 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none shadow-2xs h-[38px]"
        />
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />

        {searchTerm ? (
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              if (onManualChange) onManualChange('');
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
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

      {/* Desplegable de sugerencias */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 max-h-60 overflow-y-auto divide-y divide-slate-100 animate-in fade-in duration-150">
          {filteredChoferes.length > 0 ? (
            filteredChoferes.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelect(c)}
                className="w-full text-left p-2.5 hover:bg-emerald-50/80 transition flex items-center justify-between group cursor-pointer"
              >
                <div>
                  <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <span>{c.nombre}</span>
                    {c.cuit && (
                      <span className="text-[10px] font-mono font-normal text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                        DNI/CUIT: {c.cuit}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                    {c.transporte && (
                      <span className="flex items-center gap-1">
                        <Truck className="w-3 h-3 text-emerald-600" />
                        {c.transporte}
                      </span>
                    )}
                    {c.patentes && (
                      <span className="font-mono bg-amber-50 text-amber-800 px-1.5 py-0.2 rounded border border-amber-200">
                        {c.patentes}
                      </span>
                    )}
                  </div>
                </div>
                <Check className="w-4 h-4 text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))
          ) : (
            <div className="p-3 text-center text-xs text-slate-500 italic">
              No se encontraron choferes registrados para "{searchTerm}".
            </div>
          )}

          {/* Opción rápida: Guardar nuevo chofer en la base de datos */}
          {searchTerm.trim().length > 2 && !exactMatch && onSaveNewChofer && (
            <div className="p-2 bg-slate-50 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  onSaveNewChofer({ nombre: searchTerm.trim() });
                  setIsOpen(false);
                }}
                className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Plus className="w-4 h-4" />
                <span>Guardar "{searchTerm.trim()}" en Base de Datos</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
