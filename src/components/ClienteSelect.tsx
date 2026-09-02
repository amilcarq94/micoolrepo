/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';

export const FIXED_CLIENTES = [
  'Pampa',
  'Eco Rural',
  'San Diego Semillas',
  'Stine',
  'Elementa Foods',
] as const;

export type FixedClienteType = typeof FIXED_CLIENTES[number];

interface ClienteSelectProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  className?: string;
  selectClassName?: string;
  inputClassName?: string;
  disabled?: boolean;
}

export const ClienteSelect: React.FC<ClienteSelectProps> = ({
  value,
  onChange,
  label = 'Cliente *',
  required = true,
  className = '',
  selectClassName = '',
  inputClassName = '',
  disabled = false,
}) => {
  // Normalización para legacy "San Diego Semilla" -> "San Diego Semillas"
  const normalizedValue = (value === 'San Diego Semilla' || value === 'San Diego') ? 'San Diego Semillas' : value;

  const isFixed = (FIXED_CLIENTES as readonly string[]).includes(normalizedValue);

  const [selectedOption, setSelectedOption] = useState<string>(
    isFixed ? normalizedValue : normalizedValue ? 'Otro Cliente' : 'Pampa'
  );
  const [customName, setCustomName] = useState<string>(isFixed ? '' : normalizedValue);

  useEffect(() => {
    const norm = (value === 'San Diego Semilla' || value === 'San Diego') ? 'San Diego Semillas' : value;
    const isValFixed = (FIXED_CLIENTES as readonly string[]).includes(norm);
    if (isValFixed) {
      setSelectedOption(norm);
      setCustomName('');
    } else {
      setSelectedOption('Otro Cliente');
      setCustomName(norm);
    }
  }, [value]);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const opt = e.target.value;
    setSelectedOption(opt);
    if (opt === 'Otro Cliente') {
      onChange(customName);
    } else {
      onChange(opt);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const txt = e.target.value;
    setCustomName(txt);
    onChange(txt);
  };

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700">
          {label}
        </label>
      )}
      <select
        value={selectedOption}
        onChange={handleSelectChange}
        disabled={disabled}
        required={required && selectedOption !== 'Otro Cliente'}
        className={selectClassName || "w-full px-3 py-2 bg-white text-slate-900 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"}
      >
        {FIXED_CLIENTES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
        <option value="Otro Cliente">Otro Cliente...</option>
      </select>

      {selectedOption === 'Otro Cliente' && (
        <input
          type="text"
          value={customName}
          onChange={handleInputChange}
          placeholder="Escriba nombre del cliente..."
          disabled={disabled}
          required={required}
          className={inputClassName || "w-full px-3 py-2 bg-slate-50 text-slate-900 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold mt-1 animate-in fade-in duration-150"}
        />
      )}
    </div>
  );
};
