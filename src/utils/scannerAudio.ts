/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Módulo de sonido y feedback táctil para lectores y escáneres QR.
 * Produce un pitido nítido de notificación de lectura de alta fidelidad (industrial scanner beep)
 * compatible con Web Audio API en navegadores móviles (iOS Safari, Android Chrome) y escritorio.
 */

let sharedAudioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  try {
    const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtxClass) return null;

    if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
      sharedAudioContext = new AudioCtxClass();
    }
    if (sharedAudioContext.state === 'suspended') {
      sharedAudioContext.resume().catch(() => {});
    }
    return sharedAudioContext;
  } catch {
    return null;
  }
};

/**
 * Desbloquea preventivamente el AudioContext en gestos del usuario (toque de botón)
 */
export const unlockScannerAudio = () => {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
};

/**
 * Emite el pitido de notificación de lectura exitosa del código QR.
 * Tono nítido de alta frecuencia (1760 Hz a 2349 Hz) con envolvente rápida tipo escáner profesional.
 */
export const playQrScanBeep = (options?: { doubleTone?: boolean; volume?: number }) => {
  try {
    // 1. Feedback háptico / vibración en dispositivos móviles soportados
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([70, 30, 70]);
    }

    // 2. Audio Web API
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const volume = options?.volume ?? 0.25;

    // Tono principal limpio de escaneo industrial
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    
    if (options?.doubleTone) {
      // Doble tono armónico ascendente
      osc.frequency.setValueAtTime(1500, now);
      osc.frequency.setValueAtTime(2200, now + 0.05);
    } else {
      // Tono nítido de lectura inmediata (1800 Hz)
      osc.frequency.setValueAtTime(1800, now);
    }

    // Envolvente de volumen (Attack rápido, Decay limpio sin chasquido)
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.13);
  } catch (err) {
    console.warn('No se pudo reproducir el pitido de escaneo:', err);
  }
};

/**
 * Pitido de advertencia o lectura no coincidente
 */
export const playQrErrorBeep = () => {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([120, 80, 120]);
    }

    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.setValueAtTime(220, now + 0.1);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.24);
  } catch {
    // Ignorar
  }
};
