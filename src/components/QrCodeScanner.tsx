/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from 'react';
import jsQR from 'jsqr';
import {
  Camera,
  X,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Upload,
  Search,
  ShieldAlert,
  Zap,
  ZapOff,
  CheckCircle2,
  Tag,
  FileText,
  MapPin,
  Sprout,
  ShieldCheck,
  Droplets,
  ExternalLink,
  Warehouse,
  Eye,
  RotateCcw
} from 'lucide-react';
import { playQrScanBeep, unlockScannerAudio } from '../utils/scannerAudio';
import { Lote } from '../types';
import { formatKg, formatNumberArg, formatDateStr } from '../utils/formatters';

export interface ScannedBolsaResult {
  loteId: string;
  lote?: Lote;
  bolsaNumber?: string;
  totalBags?: string;
  rawText: string;
  timestamp: Date;
}

interface QrCodeScannerProps {
  onScanSuccess: (loteId: string, bolsaNumber?: string, totalBags?: string) => void;
  onClose: () => void;
  lotes?: Lote[];
  mode?: 'planta-movil' | 'standard';
  onLocalizarEnMapa?: (lote: Lote) => void;
  onOpenFullFicha?: (lote: Lote, bolsaNumber?: string) => void;
}

export const QrCodeScanner: React.FC<QrCodeScannerProps> = ({
  onScanSuccess,
  onClose,
  lotes = [],
  mode = 'planta-movil',
  onLocalizarEnMapa,
  onOpenFullFicha,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'permission' | 'device' | 'other' | null>(null);
  const [activeCamera, setActiveCamera] = useState<'environment' | 'user'>('environment');
  const [camerasCount, setCamerasCount] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [detectedSuccessId, setDetectedSuccessId] = useState<string | null>(null);

  // Pestaña activa del Visor: 'scanner' (Cámara) o 'ficha' (Ficha Técnica de Bolsa)
  const [activeTab, setActiveTab] = useState<'scanner' | 'ficha'>('scanner');
  const [autoShowFicha, setAutoShowFicha] = useState<boolean>(true);
  const [scannedResult, setScannedResult] = useState<ScannedBolsaResult | null>(null);

  // Modo alternativo: Ingreso manual / Subir archivo
  const [manualLoteInput, setManualLoteInput] = useState('');
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [manualError, setManualError] = useState('');

  // Controladores de flujo
  const animationFrameIdRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isDetectedRef = useRef<boolean>(false);

  // Extraer ID de lote, número de bolsa y total desde el texto escaneado
  const extractScanData = (
    rawText: string
  ): { loteId: string; bolsaNumber?: string; totalBags?: string } => {
    if (!rawText) return { loteId: '' };
    try {
      const trimmed = rawText.trim();
      if (trimmed.includes('lote=')) {
        const url = new URL(trimmed.startsWith('http') ? trimmed : `https://agroabacus.com/${trimmed}`);
        return {
          loteId: url.searchParams.get('lote') || '',
          bolsaNumber: url.searchParams.get('bolsa') || undefined,
          totalBags: url.searchParams.get('total') || undefined,
        };
      } else if (trimmed.includes('?lote=')) {
        const queryPart = trimmed.substring(trimmed.indexOf('?'));
        const params = new URLSearchParams(queryPart);
        return {
          loteId: params.get('lote') || '',
          bolsaNumber: params.get('bolsa') || undefined,
          totalBags: params.get('total') || undefined,
        };
      }

      // Soporte para JSON estructurado si algún QR lo contiene
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.lote || parsed.id || parsed.loteId) {
            return {
              loteId: String(parsed.lote || parsed.id || parsed.loteId),
              bolsaNumber: parsed.bolsa || parsed.bolsaNumber ? String(parsed.bolsa || parsed.bolsaNumber) : undefined,
              totalBags: parsed.total || parsed.totalBags ? String(parsed.total || parsed.totalBags) : undefined,
            };
          }
        } catch {
          // ignore
        }
      }
    } catch {
      // No es URL estándar
    }
    return { loteId: rawText.trim() };
  };

  const handleSuccessfulDetection = (rawText: string) => {
    if (isDetectedRef.current) return;
    const { loteId, bolsaNumber, totalBags } = extractScanData(rawText);
    if (!loteId) return;

    isDetectedRef.current = true;

    // Buscar el lote en la base local
    const matchedLote = lotes.find(
      (l) =>
        l.id.toLowerCase() === loteId.toLowerCase() ||
        (l.loteNro && l.loteNro.toLowerCase() === loteId.toLowerCase())
    );

    // Determinar total de bolsas seguro
    const safeTotalBags =
      totalBags || (matchedLote ? String(matchedLote.stockBolsas) : undefined);

    const displayLabel = bolsaNumber
      ? `${loteId} · Bolsa #${bolsaNumber}${safeTotalBags ? `/${safeTotalBags}` : ''}`
      : loteId;

    setDetectedSuccessId(displayLabel);

    // 1. Pitido de lectura instantáneo
    playQrScanBeep({ doubleTone: true, volume: 0.3 });

    const result: ScannedBolsaResult = {
      loteId,
      lote: matchedLote,
      bolsaNumber,
      totalBags: safeTotalBags,
      rawText,
      timestamp: new Date(),
    };
    setScannedResult(result);

    // Si autoShowFicha está activo (por defecto en Planta Móvil):
    // Pausar la cámara y mostrar de inmediato la Ficha Técnica de la Bolsa en el visor
    if (autoShowFicha) {
      setTimeout(() => {
        stopCamera();
        setActiveTab('ficha');
      }, 250);
    } else {
      // Modo escaneo continuo rápido: delay visual y notificar al padre
      setTimeout(() => {
        stopCamera();
        onScanSuccess(loteId, bolsaNumber, safeTotalBags);
      }, 280);
    }
  };

  // Reanudar la cámara para escanear otra bolsa sin salir del visor
  const handleScanNextBag = () => {
    isDetectedRef.current = false;
    setDetectedSuccessId(null);
    setActiveTab('scanner');
    startCamera(activeCamera);
  };

  // Alternar linterna si está disponible
  const handleToggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
      const nextState = !torchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextState }],
      });
      setTorchOn(nextState);
    } catch (e) {
      console.warn('Error al activar linterna:', e);
    }
  };

  // Iniciar la cámara
  const startCamera = async (facingMode: 'environment' | 'user') => {
    setIsLoading(true);
    setError(null);
    setErrorType(null);
    setManualError('');
    setDetectedSuccessId(null);
    isDetectedRef.current = false;
    setTorchOn(false);

    // Desbloquear audio con el gesto
    unlockScannerAudio();

    // Cancelar cualquier stream anterior
    stopCamera();

    if (!navigator?.mediaDevices?.getUserMedia) {
      setIsLoading(false);
      setHasPermission(false);
      setErrorType('device');
      setError(
        'Su navegador o dispositivo no admite acceso directo a la cámara por video en este entorno. Puede subir una imagen con el QR o ingresar el ID manualmente.'
      );
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        try {
          const capabilities = (videoTrack as any).getCapabilities?.();
          if (capabilities && 'torch' in capabilities) {
            setHasTorch(true);
          } else {
            setHasTorch(false);
          }
        } catch {
          setHasTorch(false);
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
      }

      setHasPermission(true);
      setIsLoading(false);

      // Enumerar cámaras disponibles
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((device) => device.kind === 'videoinput');
        setCamerasCount(videoDevices.length);
      } catch (e) {
        console.warn('No se pudieron enumerar los dispositivos de video:', e);
      }

      // Empezar bucle de escaneo
      tick();
    } catch (err: any) {
      console.warn('Acceso a la cámara no disponible:', err?.name, err?.message);
      setHasPermission(false);
      setIsLoading(false);

      const errMsg = (err?.message || '').toLowerCase();
      const errName = err?.name || '';

      if (
        errName === 'NotAllowedError' ||
        errName === 'PermissionDeniedError' ||
        errMsg.includes('permission') ||
        errMsg.includes('dismissed') ||
        errMsg.includes('denied')
      ) {
        setErrorType('permission');
        setError(
          'El permiso para acceder a la cámara fue denegado o cancelado. Puede volver a solicitar el permiso haciendo clic en Reintentar, subir una foto con el QR o buscar el lote directamente por su código.'
        );
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        setErrorType('device');
        setError('No se detectó ninguna cámara disponible en el dispositivo.');
      } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
        setErrorType('other');
        setError('La cámara está en uso por otra aplicación o pestaña del navegador.');
      } else {
        setErrorType('other');
        setError('No se pudo iniciar la cámara en este momento. Puede subir una foto del código QR o ingresar el ID del lote.');
      }
    }
  };

  const stopCamera = () => {
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          if (torchOn) {
            (track as any).applyConstraints({ advanced: [{ torch: false }] }).catch(() => {});
          }
          track.stop();
        } catch {
          track.stop();
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Cambiar cámara frontal / trasera
  const handleToggleCamera = () => {
    const nextMode = activeCamera === 'environment' ? 'user' : 'environment';
    setActiveCamera(nextMode);
    startCamera(nextMode);
  };

  // Loop de procesamiento de frames
  const tick = () => {
    if (isDetectedRef.current) return;

    if (!videoRef.current || !canvasRef.current || !streamRef.current) {
      animationFrameIdRef.current = requestAnimationFrame(tick);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data) {
        handleSuccessfulDetection(code.data);
        return;
      }
    }

    animationFrameIdRef.current = requestAnimationFrame(tick);
  };

  // Escaneo desde archivo de imagen subido
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    unlockScannerAudio();
    setIsProcessingImage(true);
    setManualError('');

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth',
          });

          setIsProcessingImage(false);
          if (code && code.data) {
            handleSuccessfulDetection(code.data);
          } else {
            setManualError(
              'No se detectó ningún código QR legible en la imagen. Intente con otra foto más nítida o ingrese el ID manualmente.'
            );
          }
        } else {
          setIsProcessingImage(false);
          setManualError('No se pudo procesar la imagen seleccionada.');
        }
      };
      img.onerror = () => {
        setIsProcessingImage(false);
        setManualError('Error al leer el archivo de imagen.');
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Envío manual
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    unlockScannerAudio();
    const cleanId = manualLoteInput.trim();
    if (!cleanId) {
      setManualError('Por favor ingrese el número o ID de lote.');
      return;
    }
    handleSuccessfulDetection(cleanId);
  };

  useEffect(() => {
    unlockScannerAudio();
    startCamera(activeCamera);
    return () => {
      stopCamera();
    };
  }, []);

  // Helper para normalizar tratamientos del lote encontrado
  const getTratamientos = (lote?: Lote): string[] => {
    if (!lote || !lote.tratamiento) return ['Sin Tratar'];
    if (Array.isArray(lote.tratamiento)) return lote.tratamiento.filter(Boolean);
    if (typeof lote.tratamiento === 'string') return [lote.tratamiento];
    return ['Sin Tratar'];
  };

  return (
    <div
      className="fixed inset-0 bg-[#121815]/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-3 sm:p-4 select-none overflow-y-auto"
      id="modal-visor-qr-planta"
    >
      <div className="w-full max-w-md bg-slate-900/90 rounded-3xl border border-emerald-800/40 shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* 1. Cabecera Principal con Identidad Agro Abacus */}
        <div className="p-3.5 sm:p-4 bg-gradient-to-r from-emerald-950 via-[#00603C] to-[#1a3824] border-b border-emerald-800/50 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-black/30 rounded-xl text-amber-300 shadow-sm border border-emerald-500/30">
              <Camera className="w-5 h-5 text-[#C9922E]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-serif font-bold text-base leading-tight">Visor QR de Planta</h3>
                {mode === 'planta-movil' && (
                  <span className="text-[9px] font-mono font-black uppercase bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded tracking-wider">
                    Móvil
                  </span>
                )}
              </div>
              <p className="text-[11px] text-emerald-100 font-sans">
                Lectura técnica de bolsas y trazabilidad
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-2 text-gray-300 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl transition cursor-pointer active:scale-95"
            title="Cerrar escáner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Barra de Pestañas: [📷 Cámara] y [📋 Ficha Técnica de Bolsa] */}
        <div className="grid grid-cols-2 p-1.5 bg-slate-950/80 border-b border-white/10 text-xs font-bold uppercase tracking-wider">
          <button
            type="button"
            onClick={() => {
              setActiveTab('scanner');
              if (!streamRef.current) {
                startCamera(activeCamera);
              }
            }}
            className={`py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'scanner'
                ? 'bg-[#00603C] text-white shadow-sm ring-1 ring-[#C9922E]'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Camera className="w-4 h-4 text-[#C9922E]" />
            <span>Cámara Escáner</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (scannedResult) {
                stopCamera();
                setActiveTab('ficha');
              }
            }}
            disabled={!scannedResult}
            className={`py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'ficha'
                ? 'bg-amber-400 text-slate-950 shadow-md font-black'
                : scannedResult
                ? 'text-amber-300 bg-amber-400/15 hover:bg-amber-400/25'
                : 'text-gray-600 cursor-not-allowed opacity-60'
            }`}
            title={scannedResult ? 'Ver Ficha Técnica de la bolsa leída' : 'Escanee un código para habilitar la ficha técnica'}
          >
            <FileText className="w-4 h-4" />
            <span>
              Ficha Bolsa {scannedResult?.bolsaNumber ? `#${scannedResult.bolsaNumber}` : ''}
            </span>
          </button>
        </div>

        {/* 3. CONTENIDO: PESTAÑA CÁMARA ESCÁNER */}
        {activeTab === 'scanner' && (
          <div className="p-3 sm:p-4 overflow-y-auto space-y-3">
            {/* Ventana de la cámara / Error */}
            <div className="w-full aspect-square bg-black rounded-2xl border-2 border-emerald-700/30 relative overflow-hidden shadow-2xl flex items-center justify-center">
              {isLoading && (
                <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center text-center gap-3 z-30 p-4">
                  <RefreshCw className="w-8 h-8 text-[#C9922E] animate-spin" />
                  <p className="text-xs text-gray-300 font-sans">Solicitando acceso a la cámara...</p>
                </div>
              )}

              {error && (
                <div className="absolute inset-0 bg-slate-950/95 p-5 flex flex-col items-center justify-center text-center gap-2.5 z-30 overflow-y-auto">
                  {errorType === 'permission' ? (
                    <ShieldAlert className="w-9 h-9 text-amber-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-9 h-9 text-red-400 shrink-0" />
                  )}
                  <p className="text-sm font-bold text-white">
                    {errorType === 'permission' ? 'Permiso de Cámara Requerido' : 'Cámara No Disponible'}
                  </p>
                  <p className="text-xs text-gray-300 max-w-xs leading-relaxed">{error}</p>

                  <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => startCamera(activeCamera)}
                      className="px-4 py-2.5 bg-[#00603C] hover:bg-[#004D2E] text-white text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer active:scale-95 shadow-sm"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Reintentar Permiso</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2.5 bg-white/15 hover:bg-white/25 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer active:scale-95 border border-white/20"
                    >
                      <Upload className="w-4 h-4 text-[#C9922E]" />
                      <span>Subir Foto QR</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Video stream real */}
              <video
                ref={videoRef}
                className="w-full h-full object-cover scale-x-100"
                muted
                playsInline
              />

              {/* Canvas oculto para capturar frames de video */}
              <canvas ref={canvasRef} className="hidden" />

              {/* Input oculto para subir fotos de QR */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />

              {/* Overlay de Detección Exitosa */}
              {detectedSuccessId && (
                <div className="absolute inset-0 bg-emerald-950/85 backdrop-blur-xs flex flex-col items-center justify-center text-center gap-2 z-40 animate-in fade-in zoom-in-95 duration-150 p-4">
                  <CheckCircle2 className="w-14 h-14 text-emerald-400 animate-bounce" />
                  <span className="text-sm font-black text-white uppercase tracking-wider">
                    ¡Código QR Detectado!
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-300 bg-black/60 px-3 py-1.5 rounded-xl border border-amber-400/40">
                    {detectedSuccessId}
                  </span>
                  <span className="text-[11px] text-emerald-200 mt-1 animate-pulse">
                    Abriendo Ficha Técnica de Bolsa...
                  </span>
                </div>
              )}

              {/* Guías visuales de escaneo */}
              {!isLoading && !error && !detectedSuccessId && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-20">
                  <div className="absolute inset-0 bg-black/40" />

                  {/* Cuadro de escaneo */}
                  <div className="w-4/5 h-4/5 border-2 border-[#C9922E] rounded-3xl relative flex items-center justify-center shadow-[0_0_50px_rgba(201,146,46,0.3)] bg-transparent z-10 overflow-hidden">
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-[#C9922E] rounded-tl-md" />
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-[#C9922E] rounded-tr-md" />
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-[#C9922E] rounded-bl-md" />
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-[#C9922E] rounded-br-md" />

                    <div className="w-full h-[3px] bg-gradient-to-r from-transparent via-[#C9922E] to-transparent absolute top-0 left-0 animate-[scan_2s_ease-in-out_infinite] shadow-[0_0_15px_#C9922E]" />
                  </div>

                  <span className="absolute bottom-6 text-[10px] text-white bg-black/75 px-3.5 py-1.5 rounded-full font-mono font-bold tracking-widest uppercase z-20 border border-white/10 flex items-center gap-1.5 shadow-md">
                    <Sparkles className="w-3 h-3 text-[#C9922E] animate-pulse" />
                    Enfoque el Código QR de la Bolsa
                  </span>
                </div>
              )}
            </div>

            {/* Selector de modo: Ficha técnica inmediata */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex items-center justify-between text-xs text-gray-200">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoShowFicha}
                  onChange={(e) => setAutoShowFicha(e.target.checked)}
                  className="w-4 h-4 rounded text-[#00603C] focus:ring-[#C9922E] accent-[#00603C]"
                />
                <span className="font-medium text-xs">
                  Mostrar <strong>Ficha Técnica de Bolsa</strong> al escanear
                </span>
              </label>
              {scannedResult && (
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    setActiveTab('ficha');
                  }}
                  className="text-[11px] font-bold text-[#C9922E] hover:underline flex items-center gap-1"
                >
                  <span>Ver última</span>
                  <Eye className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Barra de opciones con linterna y cambio de cámara */}
            <div className="flex items-center justify-between gap-2 text-xs">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingImage}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-white/10 hover:bg-white/20 text-gray-200 hover:text-white rounded-xl transition font-bold text-xs cursor-pointer active:scale-95 border border-white/10"
              >
                <Upload className="w-4 h-4 text-[#C9922E]" />
                <span>{isProcessingImage ? 'Leyendo...' : 'Subir Foto QR'}</span>
              </button>

              {hasTorch && (
                <button
                  type="button"
                  onClick={handleToggleTorch}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-3.5 rounded-xl transition font-bold text-xs cursor-pointer active:scale-95 border ${
                    torchOn
                      ? 'bg-amber-400 text-slate-950 border-amber-300 font-extrabold shadow-md'
                      : 'bg-white/10 hover:bg-white/20 text-white border-white/10'
                  }`}
                  title={torchOn ? 'Apagar Linterna' : 'Encender Linterna'}
                >
                  {torchOn ? (
                    <Zap className="w-4 h-4 text-slate-950 fill-current" />
                  ) : (
                    <ZapOff className="w-4 h-4 text-amber-300" />
                  )}
                  <span>{torchOn ? 'Luz ON' : 'Linterna'}</span>
                </button>
              )}

              {camerasCount > 1 && !isLoading && !error && (
                <button
                  type="button"
                  onClick={handleToggleCamera}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition font-bold text-xs cursor-pointer active:scale-95 border border-white/10"
                >
                  <RefreshCw className="w-4 h-4 text-[#C9922E]" />
                  <span>Girar</span>
                </button>
              )}
            </div>

            {/* Formulario de búsqueda manual de lote */}
            <form
              onSubmit={handleManualSubmit}
              className="bg-white/5 border border-white/10 rounded-xl p-2 flex items-center gap-2"
            >
              <input
                type="text"
                value={manualLoteInput}
                onChange={(e) => {
                  setManualLoteInput(e.target.value);
                  setManualError('');
                }}
                placeholder="O ingrese ID / N° de lote manualmente..."
                className="flex-1 bg-black/50 border border-white/15 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-400 focus:outline-none focus:border-[#C9922E]"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-[#00603C] hover:bg-[#004D2E] text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-sm shrink-0"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Consultar</span>
              </button>
            </form>

            {manualError && (
              <p className="text-[11px] text-amber-300 bg-amber-950/40 border border-amber-500/30 rounded-lg p-2 text-center">
                {manualError}
              </p>
            )}
          </div>
        )}

        {/* 4. CONTENIDO: PESTAÑA FICHA TÉCNICA DE BOLSA */}
        {activeTab === 'ficha' && scannedResult && (
          <div className="p-4 sm:p-5 overflow-y-auto space-y-4 bg-slate-950/90 text-white flex-1 animate-in fade-in duration-200">
            {/* Cabecera de la Bolsa Identificada */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950 via-[#00603C] to-[#1a3824] border-2 border-[#C9922E]/50 shadow-lg space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[10px] font-mono font-black uppercase tracking-widest text-amber-300 bg-amber-400/20 px-2 py-0.5 rounded-md border border-amber-400/30">
                  Ficha Técnica de Bolsa
                </span>
                {scannedResult.lote?.estado && (
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      scannedResult.lote.estado === 'Disponible'
                        ? 'bg-emerald-400 text-emerald-950'
                        : scannedResult.lote.estado === 'Reservado'
                        ? 'bg-amber-300 text-amber-950'
                        : 'bg-slate-300 text-slate-900'
                    }`}
                  >
                    {scannedResult.lote.estado}
                  </span>
                )}
              </div>

              {/* Número de Bolsa del Lote */}
              <div className="flex items-center gap-3 pt-1">
                <div className="w-12 h-12 rounded-xl bg-amber-400 text-slate-950 flex flex-col items-center justify-center font-mono font-black text-sm shrink-0 shadow-md">
                  <span className="text-[9px] uppercase leading-none text-slate-800">Bolsa</span>
                  <span className="text-lg leading-tight font-extrabold">
                    {scannedResult.bolsaNumber ? `#${scannedResult.bolsaNumber}` : 'General'}
                  </span>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-serif font-bold text-white tracking-tight">
                    {scannedResult.bolsaNumber ? (
                      <span>
                        Bolsa N° {scannedResult.bolsaNumber}{' '}
                        {scannedResult.totalBags ? (
                          <span className="text-emerald-200 text-base font-normal">
                            de {scannedResult.totalBags}
                          </span>
                        ) : (
                          ''
                        )}
                      </span>
                    ) : (
                      <span>Lote General (Sin N° de bolsa individual)</span>
                    )}
                  </div>
                  <p className="text-xs text-emerald-200 font-mono">
                    LOTE: {scannedResult.lote?.loteNro || scannedResult.loteId}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-white/15 flex items-center justify-between text-xs text-emerald-100">
                <span>Cliente: <strong>{scannedResult.lote?.cliente || 'No especificado'}</strong></span>
                <span className="font-mono text-[11px] text-amber-300">
                  {scannedResult.lote?.kgPorBolsa || 800} kg / bolsa
                </span>
              </div>
            </div>

            {/* SECCIÓN 1: Ubicación Física en Acopio */}
            {scannedResult.lote && (
              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                  scannedResult.lote.ala && scannedResult.lote.sector
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                    : 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-black/40 rounded-xl text-amber-300">
                    <MapPin className="w-5 h-5 text-[#C9922E]" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase text-gray-400 block tracking-wider">
                      Ubicación en Acopio
                    </span>
                    <div className="font-serif font-bold text-sm text-white">
                      {scannedResult.lote.ala && scannedResult.lote.sector ? (
                        <span className="text-emerald-300">
                          ALA {scannedResult.lote.ala} · SECTOR {scannedResult.lote.sector}
                        </span>
                      ) : (
                        <span className="text-amber-300">Sin Ubicación Física Asignada</span>
                      )}
                    </div>
                    <span className="text-[11px] text-gray-300 block">
                      {scannedResult.lote.ubicacionAcopio || 'Depósito Central de Semillas'}
                    </span>
                  </div>
                </div>

                {scannedResult.lote.ala && scannedResult.lote.sector && onLocalizarEnMapa && (
                  <button
                    type="button"
                    onClick={() => {
                      stopCamera();
                      onLocalizarEnMapa(scannedResult.lote!);
                      onClose();
                    }}
                    className="px-3 py-2 bg-[#00603C] hover:bg-[#004D2E] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm shrink-0 cursor-pointer"
                  >
                    <Warehouse className="w-3.5 h-3.5 text-amber-300" />
                    <span>Ver Mapa</span>
                  </button>
                )}
              </div>
            )}

            {/* SECCIÓN 2: Especificaciones Técnicas y Agronómicas */}
            {scannedResult.lote ? (
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                  <span className="text-[10px] font-mono text-gray-400 uppercase block">Especie</span>
                  <span className="font-bold text-white text-sm mt-0.5 flex items-center gap-1.5">
                    <Sprout className="w-3.5 h-3.5 text-emerald-400" />
                    {scannedResult.lote.especie || 'No definida'}
                  </span>
                </div>

                <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                  <span className="text-[10px] font-mono text-gray-400 uppercase block">Variedad</span>
                  <span className="font-bold text-white text-sm mt-0.5 block">
                    {scannedResult.lote.variedad || 'Sin variedad'}
                  </span>
                </div>

                <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                  <span className="text-[10px] font-mono text-gray-400 uppercase block">Tratamiento</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {getTratamientos(scannedResult.lote).map((t, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-950 text-sky-200 border border-sky-700/50"
                      >
                        <ShieldCheck className="w-3 h-3 text-sky-400" />
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                  <span className="text-[10px] font-mono text-gray-400 uppercase block">Categoría / Tipo</span>
                  <span className="font-bold text-white text-xs mt-0.5 block">
                    {scannedResult.lote.categoria || 'Original'} · {scannedResult.lote.tipo || 'Semilla'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs">
                <p className="font-bold">Lote no sincronizado en catálogo local:</p>
                <p className="text-[11px] text-gray-300 mt-1">
                  ID: <span className="font-mono text-amber-300">{scannedResult.loteId}</span> · Bolsa: #{scannedResult.bolsaNumber || 'No especificada'}
                </p>
              </div>
            )}

            {/* SECCIÓN 3: Pesos y Existencias del Lote */}
            {scannedResult.lote && (
              <div className="bg-black/40 border border-white/10 p-3.5 rounded-2xl space-y-2.5">
                <span className="text-[10px] font-mono font-black uppercase text-amber-300 tracking-wider block">
                  Pesos y Balance de Acopio
                </span>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                    <span className="text-[10px] text-gray-400 block">Esta Bolsa</span>
                    <span className="font-mono font-bold text-sm text-amber-300">
                      {scannedResult.lote.kgPorBolsa || 800} kg
                    </span>
                  </div>
                  <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                    <span className="text-[10px] text-gray-400 block">Bolsas Totales</span>
                    <span className="font-mono font-bold text-sm text-white">
                      {formatNumberArg(scannedResult.lote.stockBolsas, 0)} b.
                    </span>
                  </div>
                  <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                    <span className="text-[10px] text-gray-400 block">Kilos Totales</span>
                    <span className="font-mono font-bold text-sm text-white">
                      {formatKg(scannedResult.lote.stockKg)}
                    </span>
                  </div>
                </div>

                {typeof scannedResult.lote.humedad === 'number' && (
                  <div className="flex items-center justify-between text-xs pt-1.5 border-t border-white/10 text-gray-300">
                    <span className="flex items-center gap-1.5">
                      <Droplets className="w-3.5 h-3.5 text-sky-400" />
                      Humedad de Granos:
                    </span>
                    <span className="font-mono font-bold text-white">{scannedResult.lote.humedad}%</span>
                  </div>
                )}
              </div>
            )}

            {/* SECCIÓN 4: Origen y Fechas */}
            {scannedResult.lote && (
              <div className="bg-white/5 p-3 rounded-xl border border-white/10 text-xs space-y-1">
                <div className="flex justify-between text-gray-300">
                  <span className="text-gray-400">Fecha de Clasificación:</span>
                  <span className="font-mono font-bold text-white">
                    {formatDateStr(scannedResult.lote.fechaIngreso)}
                  </span>
                </div>
                {scannedResult.lote.siloOrigen && (
                  <div className="flex justify-between text-gray-300">
                    <span className="text-gray-400">Silo de Origen:</span>
                    <span className="font-bold text-emerald-300">{scannedResult.lote.siloOrigen}</span>
                  </div>
                )}
                {scannedResult.lote.bolsonOrigenNro && (
                  <div className="flex justify-between text-gray-300">
                    <span className="text-gray-400">Bolsón de Origen:</span>
                    <span className="font-bold text-emerald-300">Bolsón #{scannedResult.lote.bolsonOrigenNro}</span>
                  </div>
                )}
              </div>
            )}

            {/* BOTONES DE ACCIÓN DE LA FICHA TÉCNICA DENTRO DEL VISOR */}
            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={handleScanNextBag}
                className="w-full py-3 px-4 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer shadow-md active:scale-98"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Escanear Siguiente Bolsa</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                {scannedResult.lote && (
                  <button
                    type="button"
                    onClick={() => {
                      stopCamera();
                      if (onOpenFullFicha) {
                        onOpenFullFicha(scannedResult.lote!, scannedResult.bolsaNumber);
                      } else {
                        onScanSuccess(
                          scannedResult.loteId,
                          scannedResult.bolsaNumber,
                          scannedResult.totalBags
                        );
                      }
                      onClose();
                    }}
                    className="py-2.5 px-3 bg-[#00603C] hover:bg-[#004D2E] text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                    title="Abrir la Ficha Técnica Oficial Completa"
                  >
                    <FileText className="w-3.5 h-3.5 text-amber-300" />
                    <span>Ficha Completa</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    onScanSuccess(
                      scannedResult.loteId,
                      scannedResult.bolsaNumber,
                      scannedResult.totalBags
                    );
                    onClose();
                  }}
                  className="py-2.5 px-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition cursor-pointer text-center"
                >
                  Listo / Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Animación de láser para la cámara */}
      <style>{`
        @keyframes scan {
          0%, 100% {
            top: 5%;
          }
          50% {
            top: 95%;
          }
        }
      `}</style>
    </div>
  );
};
