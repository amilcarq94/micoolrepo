/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { LogoSiloLoose, LogoSiloSquare } from './Logo';
import { KeyRound, User, AlertTriangle, Smartphone, ArrowRight, ShieldCheck, ChevronDown, Lock, Check } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (nombre: string, rol: string) => void;
  onAccederPlantaMovil?: () => void;
}

const USUARIOS_AUTORIZADOS = [
  { nombre: 'Amilcar Quiroz', rol: 'Logística', key: 'quiroz', avatar: 'AQ' },
  { nombre: 'Malcón Báez', rol: 'Jefe de Planta', key: 'baez', avatar: 'MB' }
];

const STORAGE_KEYS = {
  RECORDARME: 'agro_abacus_recordarme',
  LAST_USER: 'agro_abacus_last_user',
  PASS_PREFIX: 'agro_abacus_pass_'
};

export const Login: React.FC<LoginProps> = ({ onLoginSuccess, onAccederPlantaMovil }) => {
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<string>('Amilcar Quiroz');
  const [password, setPassword] = useState<string>('');
  const [recordarme, setRecordarme] = useState<boolean>(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mostrarPanelLogin, setMostrarPanelLogin] = useState(true);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Cargar credenciales guardadas en caché al iniciar
  useEffect(() => {
    try {
      const isRecordarmeSaved = localStorage.getItem(STORAGE_KEYS.RECORDARME);
      const shouldRemember = isRecordarmeSaved === null ? true : isRecordarmeSaved === 'true';
      setRecordarme(shouldRemember);

      const lastUser = localStorage.getItem(STORAGE_KEYS.LAST_USER) || 'Amilcar Quiroz';
      const targetUser = USUARIOS_AUTORIZADOS.find(u => u.nombre === lastUser) || USUARIOS_AUTORIZADOS[0];
      
      setUsuarioSeleccionado(targetUser.nombre);

      if (shouldRemember) {
        const savedPass = localStorage.getItem(`${STORAGE_KEYS.PASS_PREFIX}${targetUser.key}`);
        if (savedPass) {
          setPassword(savedPass);
        }
      }
    } catch (e) {
      console.warn('No se pudo acceder al almacenamiento local:', e);
    }
  }, []);

  // Manejar cambio de usuario y cargar clave en caché si existe
  const handleSelectUser = (userName: string) => {
    setUsuarioSeleccionado(userName);
    setError('');
    const userObj = USUARIOS_AUTORIZADOS.find(u => u.nombre === userName);
    if (userObj) {
      try {
        const savedPass = localStorage.getItem(`${STORAGE_KEYS.PASS_PREFIX}${userObj.key}`);
        if (savedPass && recordarme) {
          setPassword(savedPass);
        } else {
          setPassword('');
          setTimeout(() => {
            passwordInputRef.current?.focus();
          }, 100);
        }
      } catch {
        setPassword('');
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const userObj = USUARIOS_AUTORIZADOS.find(u => u.nombre === usuarioSeleccionado);
    if (!userObj) {
      setError('Usuario no autorizado.');
      setLoading(false);
      return;
    }

    const cleanPass = password.trim().toLowerCase();

    // Verificación estricta de credenciales
    let isValid = false;
    if (userObj.key === 'baez') {
      isValid = cleanPass === 'baez2026' || cleanPass === 'baez';
    } else if (userObj.key === 'quiroz') {
      isValid = cleanPass === 'quiroz2026' || cleanPass === 'quiroz';
    }

    if (!isValid) {
      setError('Usuario o contraseña incorrectos.');
      setLoading(false);
      passwordInputRef.current?.focus();
      return;
    }

    // Guardar o limpiar información en caché según el checkbox 'Recordarme'
    try {
      localStorage.setItem(STORAGE_KEYS.RECORDARME, recordarme ? 'true' : 'false');
      localStorage.setItem(STORAGE_KEYS.LAST_USER, userObj.nombre);

      if (recordarme) {
        localStorage.setItem(`${STORAGE_KEYS.PASS_PREFIX}${userObj.key}`, password);
      } else {
        localStorage.removeItem(`${STORAGE_KEYS.PASS_PREFIX}${userObj.key}`);
      }
    } catch (err) {
      console.warn('Error al guardar credenciales en el almacenamiento local:', err);
    }

    setTimeout(() => {
      onLoginSuccess(userObj.nombre, userObj.rol);
      setLoading(false);
    }, 250);
  };

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-x-hidden select-none font-sans"
      style={{
        background: 'radial-gradient(ellipse at center, #005e38 0%, #013824 50%, #012418 100%)',
        color: '#ffffff'
      }}
    >
      {/* Marca de agua de fondo con el isotipo de la empresa */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none flex items-center justify-center overflow-hidden">
        <LogoSiloLoose size={800} color="#ffffff" />
      </div>

      {/* Contenedor principal de la Carátula de Inicio */}
      <div className="w-full max-w-lg bg-[#012418]/90 backdrop-blur-md rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] border border-[#005e38]/60 overflow-hidden relative z-10 transition-all duration-300">
        
        {/* Panel Superior: Logo blanco en panel verde institucional */}
        <div className="bg-[#005e38] p-8 text-center relative border-b border-[#007a4a]/40 shadow-inner">
          <div className="inline-flex items-center justify-center p-4 bg-white/10 rounded-2xl border border-white/20 shadow-md mb-4 backdrop-blur-xs">
            <LogoSiloSquare size={54} color="#ffffff" />
          </div>
          
          <h1 className="font-serif text-2xl sm:text-3xl font-black text-white tracking-wider uppercase leading-tight">
            AGRO ABACUS S.A.
          </h1>
          
          <p className="text-xs font-mono font-bold tracking-widest text-[#C9922E] uppercase mt-2">
            ESTANCIA LA BARRANCOSA
          </p>
          
          <p className="text-[11px] font-sans font-medium tracking-wide text-emerald-100/80 uppercase mt-1">
            Planta de Clasificación de Semillas
          </p>
        </div>

        {/* Cuerpo Principal de la Carátula */}
        <div className="p-6 sm:p-8 space-y-6">
          
          {/* Opción 1: BOTÓN PLANTA MÓVIL (Acceso Libre sin Login) */}
          {onAccederPlantaMovil && (
            <div className="bg-gradient-to-r from-emerald-900/60 to-emerald-950/80 border-2 border-emerald-500/60 hover:border-emerald-400 rounded-2xl p-4 sm:p-5 transition-all duration-200 hover:shadow-[0_0_24px_rgba(16,185,129,0.25)] group">
              <div className="flex items-center justify-between gap-3 mb-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 bg-emerald-500/20 text-emerald-300 rounded-xl border border-emerald-400/30">
                    <Smartphone className="w-5 h-5 text-emerald-300 group-hover:scale-110 transition-transform" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-400 block">
                      Acceso Libre
                    </span>
                    <h2 className="text-lg font-bold text-white leading-tight">
                      Planta Móvil
                    </h2>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Sin Login
                </span>
              </div>

              <p className="text-xs text-emerald-200/80 mb-4 leading-relaxed font-sans">
                Consulta en vivo del estado de los 6 Silos, escáner de códigos QR de trazabilidad y Playa de espera.
              </p>

              <button
                type="button"
                onClick={onAccederPlantaMovil}
                className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-sans text-sm font-extrabold rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
              >
                <span>Ingresar a Planta Móvil</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Opción 2: INICIAR SESIÓN (Acceso Administrativo) */}
          <div className="border border-slate-700/60 rounded-2xl bg-slate-900/50 overflow-hidden">
            
            {/* Cabecera de Iniciar Sesión */}
            <button
              type="button"
              onClick={() => setMostrarPanelLogin(!mostrarPanelLogin)}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-800/50 transition cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-800 text-amber-300 rounded-xl border border-slate-700">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white leading-tight">
                    Iniciar Sesión
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Acceso para administración y gestión operativa
                  </p>
                </div>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${mostrarPanelLogin ? 'rotate-180 text-emerald-400' : ''}`} />
            </button>

            {/* Formulario de Login */}
            {mostrarPanelLogin && (
              <form onSubmit={handleSubmit} className="p-4 sm:p-6 pt-2 border-t border-slate-800 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                
                {/* 1. DOS BOTONES CON PRECARGA DE USUARIOS: AMILCAR Y MALCÓN */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300">
                    Seleccione Usuario
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {USUARIOS_AUTORIZADOS.map((u) => {
                      const isSelected = usuarioSeleccionado === u.nombre;
                      return (
                        <button
                          key={u.nombre}
                          type="button"
                          onClick={() => handleSelectUser(u.nombre)}
                          className={`p-3 rounded-2xl border text-left transition-all duration-200 flex items-center gap-2.5 cursor-pointer relative ${
                            isSelected
                              ? 'bg-[#005e38]/70 border-emerald-400 text-white ring-2 ring-emerald-400/50 shadow-md shadow-emerald-950/40'
                              : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                          }`}
                        >
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                              isSelected
                                ? 'bg-emerald-400 text-slate-950 shadow-inner'
                                : 'bg-slate-700 text-slate-300 border border-slate-600'
                            }`}
                          >
                            {u.avatar}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold truncate leading-snug">
                              {u.nombre}
                            </div>
                            <div className={`text-[10px] font-medium truncate ${isSelected ? 'text-emerald-300' : 'text-slate-400'}`}>
                              {u.rol}
                            </div>
                          </div>
                          {isSelected && (
                            <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {error && (
                  <div className="bg-red-950/80 text-red-200 p-3 rounded-xl flex items-start gap-2.5 text-xs border border-red-500/50 animate-in fade-in">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                    <span className="leading-snug">{error}</span>
                  </div>
                )}

                {/* 2. Campo Contraseña */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300">
                      Contraseña
                    </label>
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <KeyRound className="w-4 h-4 text-emerald-400" />
                    </span>
                    <input
                      ref={passwordInputRef}
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError('');
                      }}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-800 text-white text-sm font-mono rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
                      required
                    />
                  </div>
                </div>

                {/* 3. Check de Recordarme para guardar info en caché del dispositivo */}
                <div className="pt-1">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                    <input
                      type="checkbox"
                      checked={recordarme}
                      onChange={(e) => setRecordarme(e.target.checked)}
                      className="w-4 h-4 rounded text-[#00603C] bg-slate-800 border-slate-600 focus:ring-emerald-400 focus:ring-offset-slate-900 cursor-pointer"
                    />
                    <span className="text-xs text-slate-300 group-hover:text-white transition font-medium">
                      Recordarme en este dispositivo
                    </span>
                  </label>
                </div>

                {/* 4. Botón Ingresar */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#005e38] hover:bg-[#007a4a] text-white font-sans text-sm font-bold py-3 px-4 rounded-xl shadow-lg border border-emerald-500/40 transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                >
                  {loading ? (
                    <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 text-[#C9922E]" />
                      <span>Ingresar al Sistema</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Pie de página institucional */}
        <div className="bg-[#011a11] px-6 py-3.5 border-t border-slate-800 text-center">
          <p className="text-[10px] font-mono text-emerald-300/60 uppercase tracking-widest">
            AGRO ABACUS S.A. · ESTANCIA LA BARRANCOSA
          </p>
        </div>
      </div>
    </div>
  );
};
