/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Minus,
  X,
  RotateCcw,
  Sparkles,
  ChevronDown,
  Layers
} from 'lucide-react';

export interface ModalVentanaOperacionProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: string;
  icon?: React.ElementType;
  badge?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string; // default 'max-w-5xl'
  defaultMaximized?: boolean;
  initialZoom?: number;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  headerRightExtra?: React.ReactNode;
  hideHeader?: boolean;
}

const ZOOM_PRESETS = [75, 90, 100, 110, 125, 150];

export const ModalVentanaOperacion: React.FC<ModalVentanaOperacionProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon: Icon,
  badge,
  children,
  footer,
  maxWidth = 'max-w-5xl',
  defaultMaximized = false,
  initialZoom = 100,
  className = '',
  headerClassName = '',
  contentClassName = '',
  headerRightExtra,
  hideHeader = false,
}) => {
  const [isMaximized, setIsMaximized] = useState<boolean>(defaultMaximized);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(initialZoom);
  const [showZoomDropdown, setShowZoomDropdown] = useState<boolean>(false);

  // Reset states when opening
  useEffect(() => {
    if (isOpen) {
      setIsMinimized(false);
      setShowZoomDropdown(false);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isMinimized) {
        if (showZoomDropdown) {
          setShowZoomDropdown(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isMinimized, showZoomDropdown, onClose]);

  if (!isOpen) return null;

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(150, prev + 10));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(70, prev - 10));
  };

  const handleResetZoom = () => {
    setZoomLevel(100);
    setShowZoomDropdown(false);
  };

  // State 1: MINIMIZADA (Floating Dock pill at bottom-right)
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-[9999] bg-slate-900 text-white rounded-2xl shadow-2xl p-3.5 border-2 border-emerald-500/60 flex items-center gap-3.5 animate-in slide-in-from-bottom duration-200">
        <div className="flex items-center gap-2.5">
          {Icon ? (
            <div className="p-2 bg-emerald-700/60 rounded-xl text-emerald-200">
              <Icon className="w-4 h-4" />
            </div>
          ) : (
            <div className="p-2 bg-emerald-700/60 rounded-xl text-emerald-200">
              <Layers className="w-4 h-4" />
            </div>
          )}
          <div className="max-w-[200px] truncate">
            <div className="text-xs font-bold font-serif text-white truncate">
              {title}
            </div>
            <div className="text-[10px] text-emerald-300 font-mono">
              Ventana minimizada
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 pl-2 border-l border-slate-700">
          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            className="p-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg transition text-xs font-bold flex items-center gap-1 cursor-pointer"
            title="Restaurar ventana"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="text-[10px] uppercase font-mono">Restaurar</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // State 2: NORMAL OR MAXIMIZED OVERLAY
  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center transition-all duration-200 ${
        isMaximized
          ? 'p-0 bg-black/80'
          : 'p-2 sm:p-4 md:p-6 bg-black/60 backdrop-blur-md'
      }`}
      style={{
        backdropFilter: isMaximized ? 'blur(8px)' : 'blur(12px)',
        WebkitBackdropFilter: isMaximized ? 'blur(8px)' : 'blur(12px)',
      }}
    >
      {/* Contenedor Principal de la Ventana */}
      <div
        className={`bg-white text-slate-900 flex flex-col shadow-2xl border transition-all duration-200 overflow-hidden ${
          isMaximized
            ? 'w-full h-full rounded-none border-none max-w-none max-h-none'
            : `w-full ${maxWidth} max-h-[94vh] rounded-2xl sm:rounded-3xl border-slate-200/80`
        } ${className}`}
      >
        {/* Cabecera de la Ventana con Título y Controles de Ventana (Zoom, Min, Max, Close) */}
        {!hideHeader && (
          <header
            className={`px-4 sm:px-6 py-3.5 bg-gradient-to-r from-[#00603C] to-emerald-950 text-white border-b border-[#254731] flex items-center justify-between gap-3 shrink-0 select-none ${headerClassName}`}
          >
            {/* Lado Izquierdo: Ícono, Título, Subtítulo y Badge */}
            <div className="flex items-center gap-3 min-w-0">
              {Icon && (
                <div className="p-2 bg-white/10 rounded-xl text-amber-300 shrink-0 border border-white/10">
                  <Icon className="w-5 h-5" />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-serif font-bold text-sm sm:text-base text-white tracking-wide truncate">
                    {title}
                  </h3>
                  {badge && <div className="shrink-0">{badge}</div>}
                </div>
                {subtitle && (
                  <p className="text-[11px] text-emerald-100/80 truncate mt-0.5">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            {/* Lado Derecho: Acciones extra + Controles de Ventana Estándar */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {headerRightExtra && (
                <div className="flex items-center gap-1.5 mr-1">
                  {headerRightExtra}
                </div>
              )}

              {/* 1. Control de Zoom con Menú Desplegable */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowZoomDropdown(prev => !prev)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-mono font-bold transition border cursor-pointer ${
                    zoomLevel !== 100
                      ? 'bg-amber-400 text-slate-950 border-amber-300'
                      : 'bg-white/10 hover:bg-white/20 text-emerald-100 border-white/15'
                  }`}
                  title="Ajustar zoom de la ventana"
                  aria-label="Ajustar zoom"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                  <span className="text-[11px]">{zoomLevel}%</span>
                  <ChevronDown className="w-3 h-3 opacity-70" />
                </button>

                {/* Menú flotante de Zoom */}
                {showZoomDropdown && (
                  <div className="absolute right-0 top-full mt-1.5 w-44 bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider px-2 py-1 border-b border-slate-800 flex justify-between items-center">
                      <span>Nivel de Zoom</span>
                      <button
                        type="button"
                        onClick={handleResetZoom}
                        className="text-amber-400 hover:underline flex items-center gap-0.5 lowercase text-[10px]"
                        title="Restablecer al 100%"
                      >
                        <RotateCcw className="w-2.5 h-2.5" /> 100%
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-1 py-2">
                      {ZOOM_PRESETS.map(preset => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            setZoomLevel(preset);
                            setShowZoomDropdown(false);
                          }}
                          className={`px-1.5 py-1 text-center text-xs font-mono font-bold rounded-md transition ${
                            zoomLevel === preset
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                          }`}
                        >
                          {preset}%
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800 gap-1">
                      <button
                        type="button"
                        onClick={handleZoomOut}
                        disabled={zoomLevel <= 70}
                        className="flex-1 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-md text-xs font-bold flex items-center justify-center gap-1"
                        title="Alejar (-10%)"
                      >
                        <ZoomOut className="w-3 h-3" /> -10%
                      </button>
                      <button
                        type="button"
                        onClick={handleZoomIn}
                        disabled={zoomLevel >= 150}
                        className="flex-1 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-md text-xs font-bold flex items-center justify-center gap-1"
                        title="Acercar (+10%)"
                      >
                        <ZoomIn className="w-3 h-3" /> +10%
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Botón Minimizar */}
              <button
                type="button"
                onClick={() => setIsMinimized(true)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-emerald-100 hover:text-white transition border border-white/15 cursor-pointer"
                title="Minimizar ventana"
                aria-label="Minimizar ventana"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>

              {/* 3. Botón Maximizar / Restaurar */}
              <button
                type="button"
                onClick={() => setIsMaximized(prev => !prev)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-emerald-100 hover:text-white transition border border-white/15 cursor-pointer"
                title={isMaximized ? "Restaurar tamaño normal" : "Maximizar a pantalla completa"}
                aria-label={isMaximized ? "Restaurar tamaño" : "Maximizar pantalla completa"}
              >
                {isMaximized ? (
                  <Minimize2 className="w-3.5 h-3.5 text-amber-300" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </button>

              {/* 4. Botón Cerrar */}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-red-600 text-white transition border border-white/15 cursor-pointer ml-0.5"
                title="Cerrar ventana (Esc)"
                aria-label="Cerrar ventana"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </header>
        )}

        {/* Cuerpo de la Ventana con Zoom Escala */}
        <div
          className={`flex-1 overflow-y-auto overflow-x-hidden ${contentClassName}`}
          style={{
            zoom: zoomLevel !== 100 ? `${zoomLevel}%` : undefined,
          }}
        >
          {children}
        </div>

        {/* Pie de la Ventana (Opcional) */}
        {footer && (
          <footer className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200/80 shrink-0">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
};
