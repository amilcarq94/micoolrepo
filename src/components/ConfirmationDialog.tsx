/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, ShieldAlert, AlertCircle, CheckCircle2, Info, X, Loader2 } from 'lucide-react';

export type ConfirmationDialogVariant = 'danger' | 'warning' | 'info' | 'success';

export interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmationDialogVariant;
  icon?: React.ReactNode;
  requireConfirmationText?: string;
  confirmationPlaceholder?: string;
  isLoading?: boolean;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  children,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger',
  icon,
  requireConfirmationText,
  confirmationPlaceholder,
  isLoading = false,
}) => {
  const [typedConfirmation, setTypedConfirmation] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTypedConfirmation('');
      setIsProcessing(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape' && !isLoading && !isProcessing) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, isProcessing, onClose]);

  if (!isOpen) return null;

  const isConfirmationSatisfied = requireConfirmationText
    ? typedConfirmation.trim() === requireConfirmationText.trim()
    : true;

  const handleConfirm = async () => {
    if (!isConfirmationSatisfied || isLoading || isProcessing) return;
    try {
      setIsProcessing(true);
      await onConfirm();
    } catch (err) {
      console.error('Error al confirmar acción:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          headerBg: 'bg-rose-50 border-rose-100 text-rose-900',
          iconColor: 'text-rose-600',
          defaultIcon: <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0" />,
          btnBg: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20',
          focusRing: 'focus:ring-rose-500',
          badgeBg: 'bg-rose-100 text-rose-800 border-rose-200',
        };
      case 'warning':
        return {
          headerBg: 'bg-amber-50 border-amber-100 text-amber-900',
          iconColor: 'text-amber-600',
          defaultIcon: <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />,
          btnBg: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20',
          focusRing: 'focus:ring-amber-500',
          badgeBg: 'bg-amber-100 text-amber-800 border-amber-200',
        };
      case 'success':
        return {
          headerBg: 'bg-emerald-50 border-emerald-100 text-emerald-900',
          iconColor: 'text-emerald-600',
          defaultIcon: <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />,
          btnBg: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20',
          focusRing: 'focus:ring-emerald-500',
          badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        };
      case 'info':
      default:
        return {
          headerBg: 'bg-slate-50 border-slate-200 text-slate-900',
          iconColor: 'text-slate-700',
          defaultIcon: <Info className="w-6 h-6 text-slate-700 shrink-0" />,
          btnBg: 'bg-slate-800 hover:bg-slate-900 text-white shadow-slate-800/20',
          focusRing: 'focus:ring-slate-500',
          badgeBg: 'bg-slate-100 text-slate-800 border-slate-200',
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmation-dialog-title"
    >
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden text-left flex flex-col scale-100 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-6 py-4 flex items-center justify-between border-b ${styles.headerBg}`}>
          <div className="flex items-center gap-3">
            {icon || styles.defaultIcon}
            <h3
              id="confirmation-dialog-title"
              className="text-base sm:text-lg font-black tracking-tight font-sans"
            >
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading || isProcessing}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-black/5 transition cursor-pointer disabled:opacity-50"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-sm text-slate-600 font-sans">
          {description && (
            <div className="text-slate-700 leading-relaxed font-normal text-sm">
              {description}
            </div>
          )}

          {children && <div>{children}</div>}

          {/* Si se requiere confirmación por frase escrita */}
          {requireConfirmationText && (
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Para confirmar, escriba exactamente{' '}
                <span className="font-mono bg-slate-100 text-rose-700 px-1.5 py-0.5 rounded border border-slate-200 select-all font-bold">
                  {requireConfirmationText}
                </span>:
              </label>
              <input
                type="text"
                value={typedConfirmation}
                onChange={(e) => setTypedConfirmation(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && isConfirmationSatisfied) {
                    handleConfirm();
                  }
                }}
                placeholder={confirmationPlaceholder || `Escriba "${requireConfirmationText}"`}
                className={`w-full px-3.5 py-2 text-sm font-mono border rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 ${styles.focusRing} border-slate-300 transition-colors`}
                autoFocus
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200/80 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading || isProcessing}
            className="px-4 py-2 text-xs font-bold font-sans uppercase tracking-wider text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition cursor-pointer disabled:opacity-50"
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isConfirmationSatisfied || isLoading || isProcessing}
            className={`inline-flex items-center gap-2 px-5 py-2 text-xs font-black font-sans uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none ${styles.btnBg}`}
          >
            {(isLoading || isProcessing) ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Procesando...</span>
              </>
            ) : (
              <>
                {variant === 'danger' && <Trash2 className="w-4 h-4 stroke-[2.5]" />}
                <span>{confirmText}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
