/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, X, AlertCircle, RefreshCw, Sparkles, Upload, Search, ShieldAlert, Zap, ZapOff, CheckCircle2 } from 'lucide-react';
import { playQrScanBeep, unlockScannerAudio } from '../utils/scannerAudio';

interface QrCodeScannerProps {
  onScanSuccess: (loteId: string) => void;
  onClose: () => void;
}

export const QrCodeScanner: React.FC<QrCodeScannerProps> = ({ onScanSuccess, onClose }) => {
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

  // Modo alternativo: Ingreso manual / Subir archivo
  const [manualLoteInput, setManualLoteInput] = useState('');
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [manualError, setManualError] = useState('');

  // Controladores de flujo
  const animationFrameIdRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isDetectedRef = useRef<boolean>(false);

  // Extraer ID de lote desde el texto escaneado
  const extractLoteId = (rawText: string): string => {
    if (!rawText) return '';
    try {
      if (rawText.includes('lote=')) {
        const url = new URL(rawText);
        return url.searchParams.get('lote') || '';
      } else if (rawText.includes('?lote=')) {
        const queryPart = rawText.substring(rawText.indexOf('?'));
        const params = new URLSearchParams(queryPart);
        return params.get('lote') || '';
      }
    } catch {
      // No es URL estándar
    }
    return rawText.trim();
  };

  const handleSuccessfulDetection = (rawText: string) => {
    if (isDetectedRef.current) return;
    const detectedLoteId = extractLoteId(rawText);
    if (!detectedLoteId) return;

    isDetectedRef.current = true;
    setDetectedSuccessId(detectedLoteId);

    // 1. Pitido de notificación de lectura instantáneo
    playQrScanBeep({ doubleTone: true, volume: 0.3 });

    // 2. Breve delay visual (250ms) para que el operario vea el recuadro verde de éxito antes de cerrar
    setTimeout(() => {
      stopCamera();
      onScanSuccess(detectedLoteId);
    }, 280);
  };

  // Alternar linterna si está disponible
  const handleToggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
      const nextState = !torchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextState }]
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
      setError('Su navegador o dispositivo no admite acceso directo a la cámara por video en este entorno. Puede subir una imagen con el QR o ingresar el ID manualmente.');
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
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
        videoRef.current.setAttribute('playsinline', 'true'); // Requerido para iOS Safari
        await videoRef.current.play();
      }

      setHasPermission(true);
      setIsLoading(false);

      // Enumerar cámaras disponibles para ver si hay múltiples
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
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
        setError('El permiso para acceder a la cámara fue denegado o cancelado. Puede volver a solicitar el permiso haciendo clic en Reintentar, subir una foto con el QR o buscar el lote directamente por su código.');
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
      streamRef.current.getTracks().forEach(track => {
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

    // Continuar el bucle
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
            setManualError('No se detectó ningún código QR legible en la imagen. Intente con otra foto más nítida o ingrese el ID manualmente.');
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

  return (
    <div className="fixed inset-0 bg-[#1A1A1A]/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-3 sm:p-4 select-none overflow-y-auto">
      {/* Cabecera */}
      <div className="w-full max-w-md flex items-center justify-between mb-3 text-white">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-[#00603C] rounded-xl text-amber-300 shadow-sm border border-emerald-500/40">
            <Camera className="w-5 h-5 text-[#C9922E]" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-base leading-tight">Escáner de Código QR</h3>
            <p className="text-[11px] text-gray-300 font-sans">Lectura instantánea con confirmación sonora</p>
          </div>
        </div>
        <button
          onClick={() => {
            stopCamera();
            onClose();
          }}
          className="p-2.5 bg-white/10 text-gray-300 hover:text-white hover:bg-white/20 rounded-xl transition cursor-pointer active:scale-95"
          title="Cerrar escáner"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Ventana de la cámara / Error */}
      <div className="w-full max-w-md aspect-square bg-black rounded-2xl border-2 border-white/15 relative overflow-hidden shadow-2xl flex items-center justify-center">
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
          <div className="absolute inset-0 bg-emerald-950/80 backdrop-blur-xs flex flex-col items-center justify-center text-center gap-2 z-40 animate-in fade-in zoom-in-95 duration-150 p-4">
            <CheckCircle2 className="w-14 h-14 text-emerald-400 animate-bounce" />
            <span className="text-sm font-black text-white uppercase tracking-wider">¡Código QR Detectado!</span>
            <span className="text-xs font-mono font-bold text-amber-300 bg-black/50 px-3 py-1 rounded-lg border border-amber-400/40">
              {detectedSuccessId}
            </span>
          </div>
        )}

        {/* Guías visuales de escaneo */}
        {!isLoading && !error && !detectedSuccessId && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-20">
            {/* Máscara oscura periférica */}
            <div className="absolute inset-0 bg-black/40" />

            {/* Cuadro de escaneo (Clear cut) */}
            <div className="w-4/5 h-4/5 border-2 border-[#C9922E] rounded-3xl relative flex items-center justify-center shadow-[0_0_50px_rgba(201,146,46,0.3)] bg-transparent z-10 overflow-hidden">
              {/* Esquinas */}
              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-[#C9922E] rounded-tl-md" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-[#C9922E] rounded-tr-md" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-[#C9922E] rounded-bl-md" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-[#C9922E] rounded-br-md" />

              {/* Láser de escaneo animado */}
              <div className="w-full h-[3px] bg-gradient-to-r from-transparent via-[#C9922E] to-transparent absolute top-0 left-0 animate-[scan_2s_ease-in-out_infinite] shadow-[0_0_15px_#C9922E]" />
            </div>

            {/* Texto de ayuda en pantalla */}
            <span className="absolute bottom-6 text-[10px] text-white bg-black/70 px-3.5 py-1.5 rounded-full font-mono font-bold tracking-widest uppercase z-20 border border-white/10 flex items-center gap-1.5 shadow-md">
              <Sparkles className="w-3 h-3 text-[#C9922E] animate-pulse" />
              Enfoque el Código QR dentro del recuadro
            </span>
          </div>
        )}
      </div>

      {/* Controles alternativos y de entrada manual */}
      <div className="w-full max-w-md mt-3 space-y-2.5">
        {/* Barra de opciones rápidas con linterna y cambio de cámara */}
        <div className="flex items-center justify-between gap-2 text-xs">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessingImage}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-white/10 hover:bg-white/20 text-gray-200 hover:text-white rounded-xl transition font-bold text-xs cursor-pointer active:scale-95 border border-white/10"
          >
            <Upload className="w-4 h-4 text-[#C9922E]" />
            <span>{isProcessingImage ? 'Leyendo...' : 'Subir Imagen QR'}</span>
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
              {torchOn ? <Zap className="w-4 h-4 text-slate-950 fill-current" /> : <ZapOff className="w-4 h-4 text-amber-300" />}
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
              <span>Girar Cámara</span>
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

      {/* Animación personalizada de escaneo */}
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
