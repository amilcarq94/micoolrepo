/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Lote, SalidaRegistrada, EnvaseType, TipoLoteType, MovimientoStock, EstadoLoteType, Chofer } from '../types';
import { getCampaniaIdFromDate } from '../utils/campanias';
import { generateRemitoId, formatNumberArg, formatDateStr } from '../utils/formatters';
import { LogoSiloLoose, LogoSiloSquare } from './Logo';
import { ChoferSearchSelector } from './ChoferSearchSelector';
import { ClienteSelect } from './ClienteSelect';
import { FileText, ArrowRight, Printer, AlertTriangle, UserCheck, Check, Trash2, Plus, Paperclip, Upload, X, Download } from 'lucide-react';

interface RegistrarSalidaProps {
  lotes: Lote[];
  clientes: string[];
  choferes?: Chofer[];
  preselectedLoteId?: string; // Si viene derivado de la ficha
  onSaveSalida: (salida: SalidaRegistrada, loteId: string, nuevosMovimientos: MovimientoStock[], nuevoStockBolsas: number, nuevoStockKg: number, nuevoEstado: EstadoLoteType) => void;
  onCancel: () => void;
}

export const RegistrarSalida: React.FC<RegistrarSalidaProps> = ({
  lotes,
  clientes,
  choferes = [],
  preselectedLoteId,
  onSaveSalida,
  onCancel,
}) => {
  // Lotes que tienen existencias disponibles
  const lotesDisponibles = lotes.filter(l => l.stockBolsas > 0);

  // Estados del Formulario
  const [remitoId, setRemitoId] = useState('');
  const [fecha, setFecha] = useState(() => new Date().toISOString().split('T')[0]);
  const [choferNombre, setChoferNombre] = useState('');
  const [choferDni, setChoferDni] = useState('');
  const [patenteCamion, setPatenteCamion] = useState('');
  const [cliente, setCliente] = useState('');
  const [loteId, setLoteId] = useState('');
  const [tipoLote, setTipoLote] = useState('');
  const [producto, setProducto] = useState('');
  const [categoria, setCategoria] = useState<TipoLoteType>('Semilla Fiscalizada');
  const [cantidadBolsas, setCantidadBolsas] = useState<number>(20);
  const [envase, setEnvase] = useState<string>('Bolsa 25kg');
  
  // Custom envase state
  const [showCustomEnvase, setShowCustomEnvase] = useState(false);
  const [customEnvaseText, setCustomEnvaseText] = useState('');
  const [listaEnvases, setListaEnvases] = useState<string[]>(['Bolsa 25kg', 'Bolsa 30kg', 'Big Bag', 'A granel']);

  const [loteSeleccionado, setLoteSeleccionado] = useState<Lote | null>(null);
  
  // Mensajes de Alerta/Error
  const [errorStock, setErrorStock] = useState('');
  const [errorValidacion, setErrorValidacion] = useState('');

  // Remito generado para mostrar recibo descargable
  const [remitoCreado, setRemitoCreado] = useState<SalidaRegistrada | null>(null);

  // Remito de cliente adjunto
  const [remitoClienteAdjunto, setRemitoClienteAdjunto] = useState<{ nombre: string; data: string; type: string } | null>(null);
  const remitoFileInputRef = useRef<HTMLInputElement>(null);

  // Signature canvas states and ref
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // drawing functions
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#00603C'; // Verde AgroAbacus corporativo
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (e.cancelable) {
      e.preventDefault();
    }

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setRemitoClienteAdjunto({
          nombre: file.name,
          data: event.target.result as string,
          type: file.type
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveFile = () => {
    setRemitoClienteAdjunto(null);
    if (remitoFileInputRef.current) {
      remitoFileInputRef.current.value = '';
    }
  };

  // Inicializar ID remito
  useEffect(() => {
    // Generamos un REM-YYYY-XXXX aleatorio/incrementable para el preview
    const rand = String(Math.floor(Math.random() * 9000) + 1000);
    const year = new Date().getFullYear();
    setRemitoId(`REM-${year}-${rand}`);

    if (preselectedLoteId) {
      setLoteId(preselectedLoteId);
    } else if (lotesDisponibles.length > 0) {
      setLoteId(lotesDisponibles[0].id);
    }
  }, [preselectedLoteId]);

  // Sincronizar datos cuando el lote seleccionado cambia
  useEffect(() => {
    const lote = lotes.find(l => l.id === loteId);
    if (lote) {
      setLoteSeleccionado(lote);
      
      const shortName = ["San Diego Semilla", "Eco Rural", "Pampa", "Stine", "Elementa Foods"].find(c => 
        lote.cliente.toLowerCase().includes(c.toLowerCase()) || 
        c.toLowerCase().includes(lote.cliente.toLowerCase())
      ) || lote.cliente;
      setCliente(shortName);

      const matchedTipo = lote.estado === 'Final' || lote.estado === 'Intermedio' ? lote.estado : 'Intermedio';
      setTipoLote(matchedTipo);

      const matchedProd = ["Preba", "Original", "Primu"].find(p => 
        lote.producto.toLowerCase().includes(p.toLowerCase()) || 
        lote.tipo.toLowerCase().includes(p.toLowerCase())
      ) || "Original";
      setProducto(matchedProd);

      setCategoria(matchedTipo as TipoLoteType);
      
      // Ajustar sugerencia de envase de acuerdo al peso del lote
      if (lote.kgPorBolsa) {
        setEnvase(`Bolsa ${lote.kgPorBolsa}kg`);
      }
    } else {
      setLoteSeleccionado(null);
    }
  }, [loteId, lotes]);

  // Validar cantidad de bolsas contra stock disponible en tiempo real
  useEffect(() => {
    if (loteSeleccionado) {
      if (cantidadBolsas > loteSeleccionado.stockBolsas) {
        setErrorStock(`Advertencia crítica: La cantidad solicitada (${cantidadBolsas} bolsas) supera el stock actual disponible de este lote (${loteSeleccionado.stockBolsas} bolsas).`);
      } else {
        setErrorStock('');
      }
    }
  }, [cantidadBolsas, loteSeleccionado]);

  const handleAgregarEnvase = () => {
    const nuevo = customEnvaseText.trim();
    if (nuevo !== '') {
      if (!listaEnvases.includes(nuevo)) {
        setListaEnvases(prev => [...prev, nuevo]);
      }
      setEnvase(nuevo);
      setCustomEnvaseText('');
      setShowCustomEnvase(false);
    }
  };

  const handleGuardarSalida = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorValidacion('');

    if (!loteSeleccionado) {
      setErrorValidacion('Debe seleccionar un lote con existencias disponibles.');
      return;
    }
    if (choferNombre.trim() === '' || choferDni.trim() === '') {
      setErrorValidacion('Por favor, complete los datos obligatorios del chofer conductor.');
      return;
    }
    if (patenteCamion.trim() === '') {
      setErrorValidacion('Por favor, complete la patente del camión.');
      return;
    }
    if (cantidadBolsas <= 0) {
      setErrorValidacion('La cantidad de bolsas a despachar debe ser un valor mayor a cero.');
      return;
    }
    if (cantidadBolsas > loteSeleccionado.stockBolsas) {
      setErrorValidacion('No se puede registrar el despacho: supera el stock disponible en bolsas.');
      return;
    }

    const kgBolsaIndex = loteSeleccionado.kgPorBolsa || 40;
    const totalKgDespachados = cantidadBolsas * kgBolsaIndex;

    // Obtener firma digital en formato base64
    let firmaBase64 = '';
    const canvas = canvasRef.current;
    if (canvas) {
      firmaBase64 = canvas.toDataURL('image/png');
    }

    // Crear remito oficial
    const nuevoRemito: SalidaRegistrada = {
      id: remitoId,
      fecha,
      campaniaId: getCampaniaIdFromDate(fecha),
      choferNombre: choferNombre.trim(),
      choferDni: choferDni.trim(),
      patenteCamion: patenteCamion.trim(),
      cliente: cliente,
      loteId: loteId,
      tipoLote: tipoLote,
      producto: producto,
      categoria: categoria,
      cantidadBolsas,
      envase,
      kgPorBolsa: kgBolsaIndex,
      totalKg: totalKgDespachados,
      choferFirma: firmaBase64,
      remitoClienteAdjunto: remitoClienteAdjunto || undefined
    };

    // Calcular decrementos de stock del lote
    const nuevoStockBolsas = loteSeleccionado.stockBolsas - cantidadBolsas;
    const nuevoStockKg = loteSeleccionado.stockKg - totalKgDespachados;
    const nuevoEstado = nuevoStockBolsas === 0 ? 'Agotado' : loteSeleccionado.estado;

    // Crear movimiento correspondiente en el historial del lote
    const movimientoSalida: MovimientoStock = {
      id: `MOV-SAL-${Date.now()}`,
      fecha,
      tipo: 'Salida',
      cantidadBolsas,
      kgPorBolsa: kgBolsaIndex,
      cantidadKg: totalKgDespachados,
      detalle: `Despacho de salida - Remito ${remitoId}. Chofer: ${choferNombre.trim()}`
    };

    const nuevosMovimientos = [movimientoSalida, ...loteSeleccionado.historial];

    // Persistir
    onSaveSalida(nuevoRemito, loteId, nuevosMovimientos, nuevoStockBolsas, nuevoStockKg, nuevoEstado);

    // Guardar en remito creado para renderizar el recibo final listo para imprimir
    setRemitoCreado(nuevoRemito);
  };

  const handlePrintRemito = () => {
    window.print();
  };

  // Si el remito ya fue creado con éxito, mostramos la pantalla de comprobante para entregar al chofer
  if (remitoCreado) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto" id="remito-print-view">
        {/* Banner de Operación Exitosa */}
        <div className="bg-[#E3EFE7] border border-[#00603C] p-5 rounded-2xl flex items-center gap-3 shadow-sm print:hidden">
          <div className="p-2 bg-[#00603C] rounded-full text-white">
            <Check className="w-5 h-5 stroke-[3px]" />
          </div>
          <div>
            <h4 className="font-serif text-lg font-bold text-[#00603C]">Despacho Registrado con Éxito</h4>
            <p className="text-xs text-gray-600">Se han descontado las bolsas del stock del lote e insertado la salida en auditoría.</p>
          </div>
        </div>

        {/* Remito Imprimible Oficial (Estructura de Comprobante de Semillero) */}
        <div className="bg-white p-8 rounded-2xl border-2 border-[#00603C] shadow-md relative text-[#1A1A1A] font-sans">
          
          {/* Sello de agua sutil */}
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.06] pointer-events-none">
            <LogoSiloLoose size={350} color="#00603C" />
          </div>

          {/* Cabecera del Comprobante */}
          <div className="flex justify-between items-start border-b-2 border-[#00603C] pb-6 mb-6">
            <div className="flex gap-3 items-center">
              <LogoSiloSquare size={48} color="#00603C" />
              <div>
                <h3 className="font-serif text-xl font-bold text-[#00603C] uppercase tracking-wide leading-none">
                  AGRO ABACUS S.A.
                </h3>
                <p className="text-[10px] font-sans font-bold tracking-widest text-[#C9922E] uppercase mt-1">
                  PLANTA CLASIFICADORA — ESTANCIA LA BARRANCOSA
                </p>
                <p className="text-[9px] text-gray-500 mt-0.5">Ruta Provincial 14, Km 151.5 — Maria Teresa, Santa Fe</p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[9px] uppercase tracking-widest font-bold text-gray-400 block">DOCUMENTO NO VÁLIDO COMO FACTURA</span>
              <div className="bg-[#00603C] text-[#F6EFDC] font-mono font-bold text-xs px-3 py-1.5 rounded-md mt-1.5 inline-block">
                REMITO N° {remitoCreado.id}
              </div>
              <div className="text-[10px] text-gray-600 mt-1 font-semibold">
                Fecha: {formatDateStr(remitoCreado.fecha)}
              </div>
            </div>
          </div>

          {/* Título */}
          <div className="text-center mb-6">
            <h4 className="font-serif text-lg font-bold text-[#00603C] border-b border-[#C9922E] pb-1.5 inline-block uppercase tracking-wider">
              Orden de Salida y Despacho de Semillas
            </h4>
          </div>

          {/* Datos del Transporte / Chofer */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#F6EFDC] bg-opacity-35 p-4 rounded-xl border border-[#C9922E] border-opacity-20 mb-6 text-xs text-left">
            <div>
              <span className="text-[9px] font-bold text-[#C9922E] uppercase tracking-wider block mb-1">CONDUCTOR Y CAMIÓN</span>
              <p className="font-bold text-gray-800 text-sm">{remitoCreado.choferNombre}</p>
              <p className="text-gray-600 mt-0.5">Documento: <span className="font-semibold">{remitoCreado.choferDni}</span></p>
              <p className="text-gray-600">Patente del Camión: <span className="font-semibold font-mono text-gray-800 uppercase">{remitoCreado.patenteCamion}</span></p>
            </div>
            <div>
              <span className="text-[9px] font-bold text-[#C9922E] uppercase tracking-wider block mb-1">CLIENTE DESTINATARIO</span>
              <p className="font-bold text-gray-800 text-sm">{remitoCreado.cliente}</p>
              <p className="text-gray-500 mt-0.5">Retira de Planta Clasificadora - La Barrancosa</p>
            </div>
            {remitoCreado.remitoClienteAdjunto && (
              <div className="md:col-span-2 border-t border-[#C9922E]/20 pt-3 mt-1 flex flex-wrap items-center justify-between gap-2 print:hidden">
                <div className="flex items-center gap-2 text-xs">
                  <Paperclip className="w-4 h-4 text-[#A0522D]" />
                  <span className="text-gray-700">
                    Remito de Cliente Adjunto: <strong>{remitoCreado.remitoClienteAdjunto.nombre}</strong>
                  </span>
                </div>
                <a
                  href={remitoCreado.remitoClienteAdjunto.data}
                  download={remitoCreado.remitoClienteAdjunto.nombre}
                  className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#00603C] hover:underline cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar Adjunto
                </a>
              </div>
            )}
          </div>

          {/* Tabla de Detalle de Semilla Despachada */}
          <div className="border border-gray-200 rounded-xl overflow-hidden mb-8 text-xs text-left">
            <table className="w-full">
              <thead>
                <tr className="bg-[#00603C] text-white uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-4">Lote ID</th>
                  <th className="py-2.5 px-4">Producto / Especie</th>
                  <th className="py-2.5 px-4">Tipo / Tratamiento</th>
                  <th className="py-2.5 px-4 text-center">Envase</th>
                  <th className="py-2.5 px-4 text-right">Bolsas</th>
                  <th className="py-2.5 px-4 text-right">Peso (Kg)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="py-3 px-4 font-mono font-bold text-[#C9922E]">{remitoCreado.loteId}</td>
                  <td className="py-3 px-4">
                    <span className="font-bold text-gray-900 block">{remitoCreado.tipoLote}</span>
                    <span className="text-[10px] text-gray-500 block">Tratado con: {remitoCreado.producto}</span>
                    {(() => {
                      const matchingLote = lotes.find(l => l.id === remitoCreado.loteId);
                      if (matchingLote && matchingLote.ala && matchingLote.sector) {
                        return (
                          <div className="text-[10px] text-[#00603C] font-semibold mt-1 flex items-center gap-1 bg-[#E3EFE7] px-1.5 py-0.5 rounded w-max">
                            Ubicación de Origen: ALA {matchingLote.ala} · SECTOR {matchingLote.sector}
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-gray-700 font-semibold">{remitoCreado.categoria}</span>
                  </td>
                  <td className="py-3 px-4 text-center text-gray-600">{remitoCreado.envase}</td>
                  <td className="py-3 px-4 text-right font-bold text-gray-900">{remitoCreado.cantidadBolsas} b.</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-[#00603C]">
                    {formatNumberArg(remitoCreado.totalKg, 0)} kg
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Firmas y Conformidad */}
          <div className="grid grid-cols-2 gap-8 mt-16 text-center text-xs">
            <div>
              <div className="border-t border-gray-300 w-4/5 mx-auto pt-2">
                <p className="font-semibold text-gray-700">Autorización Despacho de Planta</p>
                <p className="text-gray-400 text-[10px]">Agro Abacus S.A.</p>
              </div>
            </div>
            <div>
              <div className="flex flex-col items-center justify-end h-20 mb-1">
                {remitoCreado.choferFirma ? (
                  <img src={remitoCreado.choferFirma} alt="Firma Chofer" className="h-16 object-contain max-w-[200px]" referrerPolicy="no-referrer" />
                ) : (
                  <div className="h-16" />
                )}
              </div>
              <div className="border-t border-gray-300 w-4/5 mx-auto pt-2">
                <p className="font-semibold text-gray-700">Firma Chofer Conductor</p>
                <p className="text-gray-400 text-[10px]">Recibí Conforme</p>
              </div>
            </div>
          </div>

          <p className="text-center text-[9px] text-gray-400 mt-12 italic">
            Remito de Control Interno emitido en planta. Conserve esta copia para tránsito.
          </p>
        </div>

        {/* Acciones de comprobante */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-5 print:hidden">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-500 rounded-lg hover:bg-gray-100 transition"
          >
            Terminar y Salir
          </button>
          
          <button
            onClick={handlePrintRemito}
            className="flex items-center gap-2 px-6 py-2.5 text-xs font-semibold uppercase tracking-wider bg-[#00603C] text-white rounded-lg hover:bg-[#254731] transition shadow-md"
          >
            <Printer className="w-4.5 h-4.5 text-[#C9922E]" />
            Imprimir Remito Oficial
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8" id="registrar-salida-container">
      <div className="border-b border-gray-100 pb-4 mb-6">
        <span className="text-xs font-sans font-semibold tracking-widest text-[#A0522D] uppercase">
          DESPACHO Y LOGÍSTICA
        </span>
        <h3 className="font-serif text-2xl font-bold text-[#1A1A1A] mt-1">
          Registrar Salida de Semilla / Grano
        </h3>
      </div>

      {errorValidacion && (
        <div className="bg-[#F5E5DC] text-[#A0522D] p-4 rounded-xl flex items-start gap-3 text-xs border border-red-200 mb-6">
          <AlertTriangle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
          <span>{errorValidacion}</span>
        </div>
      )}

      {lotesDisponibles.length === 0 ? (
        <div className="bg-[#F5E5DC] p-8 text-center rounded-xl border border-red-100">
          <AlertTriangle className="w-12 h-12 text-[#A0522D] mx-auto mb-3" />
          <h4 className="font-serif text-lg font-bold text-gray-700 mb-1">Sin Stock Disponible</h4>
          <p className="text-xs text-gray-500">No hay lotes con bolsas disponibles en el sistema actualmente para realizar despachos.</p>
          <button
            onClick={onCancel}
            className="mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold"
          >
            Volver
          </button>
        </div>
      ) : (
        <form onSubmit={handleGuardarSalida} className="space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            
            {/* 1. Selección de Lote para Despachar */}
            <div className="md:col-span-2 bg-[#E3EFE7] bg-opacity-35 p-5 rounded-xl border border-[#00603C] border-opacity-10">
              <span className="block text-xs font-semibold uppercase tracking-wider text-[#00603C] mb-3">
                Selección de Lote de Origen
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ClienteSelect
                  value={cliente}
                  onChange={(selectedVal) => {
                    setCliente(selectedVal);
                    const matchingLotes = lotesDisponibles.filter(l => {
                      if (!selectedVal) return true;
                      return l.cliente.toLowerCase().includes(selectedVal.toLowerCase()) || 
                             selectedVal.toLowerCase().includes(l.cliente.toLowerCase());
                    });
                    if (matchingLotes.length > 0) {
                      const matchesCurrent = matchingLotes.find(l => l.id === loteId);
                      if (!matchesCurrent) {
                        setLoteId(matchingLotes[0].id);
                      }
                    } else {
                      setLoteId('');
                    }
                  }}
                  label="Comitente (Cliente) *"
                  selectClassName="w-full px-4 py-2.5 bg-white text-xs font-semibold rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C]"
                  inputClassName="w-full px-4 py-2.5 bg-white text-xs font-semibold rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C] mt-1"
                />

                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1.5">Lote ID con Stock *</label>
                  <select
                    id="select-lote-salida"
                    value={loteId}
                    onChange={(e) => setLoteId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white text-xs font-mono font-bold rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C]"
                  >
                    <option value="">Seleccione un Lote...</option>
                    {lotesDisponibles
                      .filter(l => {
                        if (!cliente) return true;
                        return l.cliente.toLowerCase().includes(cliente.toLowerCase()) || 
                               cliente.toLowerCase().includes(l.cliente.toLowerCase());
                      })
                      .map(l => (
                        <option key={l.id} value={l.id}>
                          {l.id} — {l.especie} ({l.variedad}) [{l.stockBolsas} b. disponibles]
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Indicador de Stock Disponible en Lote */}
              {loteSeleccionado && (
                <div className="mt-4 flex flex-wrap gap-4 items-center justify-between bg-white px-4 py-2.5 rounded-lg border border-gray-100">
                  <span className="text-[10px] uppercase font-bold text-gray-400">Existencias Actuales:</span>
                  <div className="flex flex-wrap gap-x-6 gap-y-2">
                    <span className="font-semibold text-gray-700">
                      Bolsas: <span className="font-bold text-[#00603C]">{loteSeleccionado.stockBolsas} bolsas</span>
                    </span>
                    <span className="font-semibold text-gray-700">
                      Equivalente: <span className="font-bold text-[#C9922E]">{formatNumberArg(loteSeleccionado.stockKg, 0)} kg</span>
                    </span>
                    <span className="font-semibold text-gray-700">
                      Grano: <span className="font-bold text-gray-800">{loteSeleccionado.especie} ({loteSeleccionado.variedad})</span>
                    </span>
                    <span className="font-semibold text-gray-700 flex items-center gap-1">
                      Sector de Acopio: 
                      {loteSeleccionado.ala && loteSeleccionado.sector ? (
                        <span className="font-bold text-[#00603C] bg-[#E3EFE7] px-1.5 py-0.5 rounded text-[10px] inline-flex items-center gap-1">
                          ALA {loteSeleccionado.ala} · SECTOR {loteSeleccionado.sector}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic text-[11px]">No asignado</span>
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Datos del Chofer / Camión */}
            <div className="md:col-span-2 bg-[#F6EFDC] bg-opacity-35 p-5 rounded-xl border border-[#C9922E] border-opacity-10 space-y-4">
              <span className="block text-xs font-semibold uppercase tracking-wider text-[#C9922E]">
                Datos del Chofer y Camión Transportista
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
                <div>
                  <ChoferSearchSelector
                    choferes={choferes}
                    selectedChoferNombre={choferNombre}
                    onSelectChofer={(ch) => {
                      setChoferNombre(ch.nombre);
                      setChoferDni(ch.cuit || '');
                      if (ch.patentes) setPatenteCamion(ch.patentes);
                    }}
                    onManualChange={(val) => setChoferNombre(val)}
                    label="Nombre y Apellido Conductor *"
                    placeholder="Buscar o ingresar chofer..."
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1 h-[20px] flex items-center gap-1">
                    <span>DNI / Documento Conductor *</span>
                  </label>
                  <input
                    type="text"
                    id="input-chofer-dni"
                    value={choferDni}
                    onChange={(e) => setChoferDni(e.target.value)}
                    className="w-full px-3 py-2 bg-white rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C9922E] text-xs font-mono h-[38px]"
                    placeholder="Ej: 28.432.190"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1 h-[20px] flex items-center gap-1">
                    <span>Patente Camión / Acoplado *</span>
                  </label>
                  <input
                    type="text"
                    id="input-camion-patente"
                    value={patenteCamion}
                    onChange={(e) => setPatenteCamion(e.target.value)}
                    className="w-full px-3 py-2 bg-white rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C9922E] uppercase font-mono text-xs h-[38px]"
                    placeholder="Ej: AE 321 OP"
                    required
                  />
                </div>
              </div>
            </div>

            {/* 3. Parámetros del Despacho */}
            <div>
              <label className="block text-gray-700 font-bold mb-1.5 uppercase tracking-wide">Fecha de Despacho *</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full px-4 py-2.5 bg-white rounded-lg border border-gray-200"
                required
              />
            </div>

            {/* Tipo de Lote: heredado, cerrado Intermedio / Final */}
            <div>
              <label className="block text-gray-700 font-bold mb-1.5 uppercase tracking-wide">Tipo de Lote *</label>
              <select
                value={tipoLote}
                onChange={(e) => setTipoLote(e.target.value)}
                className="w-full px-4 py-2.5 bg-white rounded-lg border border-gray-200"
              >
                <option value="Intermedio">Intermedio</option>
                <option value="Final">Final</option>
              </select>
            </div>

            {/* Producto: heredado, cerrado Preba / Original / Primu */}
            <div>
              <label className="block text-gray-700 font-bold mb-1.5 uppercase tracking-wide">Producto *</label>
              <select
                value={producto}
                onChange={(e) => setProducto(e.target.value)}
                className="w-full px-4 py-2.5 bg-white rounded-lg border border-gray-200"
              >
                <option value="Preba">Preba</option>
                <option value="Original">Original</option>
                <option value="Primu">Primu</option>
              </select>
            </div>

            {/* Categoría: cerrado Intermedio / Final */}
            <div>
              <label className="block text-gray-700 font-bold mb-1.5 uppercase tracking-wide">Categoría *</label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value as TipoLoteType)}
                className="w-full px-4 py-2.5 bg-white rounded-lg border border-gray-200"
              >
                <option value="Intermedio">Intermedio</option>
                <option value="Final">Final</option>
              </select>
            </div>

            {/* Envase (Selector + Agregar Custom) */}
            <div>
              <label className="block text-gray-700 font-bold mb-1.5 uppercase tracking-wide">Tipo de Envase *</label>
              {!showCustomEnvase ? (
                <select
                  value={envase}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      setShowCustomEnvase(true);
                    } else {
                      setEnvase(e.target.value);
                    }
                  }}
                  className="w-full px-4 py-2.5 bg-white rounded-lg border border-gray-200"
                >
                  {listaEnvases.map((env, i) => (
                    <option key={i} value={env}>{env}</option>
                  ))}
                  <option value="__custom__" className="text-[#C9922E] font-semibold">+ Agregar Otro Envase...</option>
                </select>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customEnvaseText}
                    onChange={(e) => setCustomEnvaseText(e.target.value)}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-gray-200"
                    placeholder="Ej: Big Bag 1000kg..."
                  />
                  <button
                    type="button"
                    onClick={handleAgregarEnvase}
                    className="px-3 bg-[#00603C] text-white rounded-lg font-semibold"
                  >
                    OK
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCustomEnvase(false)}
                    className="px-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-[10px]"
                  >
                    Volver
                  </button>
                </div>
              )}
            </div>

            {/* Cantidad de Bolsas */}
            <div className="md:col-span-2">
              <label className="block text-gray-700 font-bold mb-1.5 uppercase tracking-wide">Bolsas a Despachar *</label>
              <input
                type="number"
                id="input-bolsas-salida"
                value={cantidadBolsas}
                onChange={(e) => setCantidadBolsas(Math.max(1, parseInt(e.target.value, 10) || 0))}
                className="w-full px-4 py-2.5 bg-white rounded-lg border border-gray-200 text-sm font-bold text-[#00603C]"
                min="1"
                required
              />
            </div>

            {/* Firma Digital del Chofer */}
            <div className="md:col-span-2 bg-[#E3EFE7] bg-opacity-20 p-5 rounded-xl border border-gray-100 space-y-3">
              <span className="block text-xs font-semibold uppercase tracking-wider text-[#00603C]">
                Firma Digital del Chofer Conductor *
              </span>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Solicite al conductor que firme digitalmente con el dedo en pantallas táctiles o con el cursor en el siguiente recuadro para validar la conformidad del remito de salida:
              </p>

              <div className="relative">
                <canvas
                  ref={canvasRef}
                  width={450}
                  height={150}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full max-w-lg h-36 bg-white border-2 border-dashed border-gray-200 rounded-xl cursor-crosshair shadow-inner"
                  id="canvas-firma-chofer"
                />
                
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="absolute bottom-3 right-3 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-white hover:bg-gray-100 text-gray-600 rounded-lg border border-gray-200 shadow-sm transition cursor-pointer"
                >
                  Limpiar Firma
                </button>
              </div>
            </div>

            {/* Adjuntar Remito del Cliente */}
            <div className="md:col-span-2 bg-[#F6EFDC] bg-opacity-20 p-5 rounded-xl border border-dashed border-[#C9922E]/30 space-y-3">
              <span className="block text-xs font-semibold uppercase tracking-wider text-[#A0522D] flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-[#C9922E]" />
                Adjuntar Remito de Cliente (Opcional)
              </span>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Si el cliente o transportista provee un remito de papel pre-impreso, puede adjuntar una foto o archivo PDF escaneado del mismo para mantenerlo vinculado al despacho actual:
              </p>

              <div className="flex items-center gap-3">
                <input
                  type="file"
                  ref={remitoFileInputRef}
                  onChange={handleFileChange}
                  accept="image/*,application/pdf"
                  className="hidden"
                  id="file-remito-cliente"
                />
                
                {!remitoClienteAdjunto ? (
                  <button
                    type="button"
                    onClick={() => remitoFileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-[#E3EFE7]/40 text-[#00603C] border border-[#00603C] rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm transition cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-[#C9922E]" />
                    <span>Seleccionar o Tomar Foto</span>
                  </button>
                ) : (
                  <div className="flex flex-wrap items-center justify-between w-full p-3 bg-white rounded-xl border border-gray-100 shadow-sm gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 bg-[#E3EFE7] rounded-lg text-[#00603C]">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="text-left min-w-0">
                        <p className="text-xs font-bold text-gray-800 truncate">
                          {remitoClienteAdjunto.nombre}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          Archivo listo para vincular
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {remitoClienteAdjunto.type.startsWith('image/') && (
                        <div className="relative group">
                          <img 
                            src={remitoClienteAdjunto.data} 
                            alt="Vista previa" 
                            className="h-10 w-10 object-cover rounded-lg border border-gray-200"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}
                      
                      <button
                        type="button"
                        onClick={handleRemoveFile}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer"
                        title="Quitar archivo adjunto"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Advertencia de stock bajo/excedido */}
          {errorStock && (
            <div className="bg-[#F5E5DC] text-[#A0522D] p-3 rounded-lg flex items-start gap-2.5 border border-red-100 text-xs text-left">
              <AlertTriangle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
              <span>{errorStock}</span>
            </div>
          )}

          {/* Botones de Acción */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-5">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-500 rounded-lg hover:bg-gray-100 transition"
            >
              Cancelar
            </button>
            
            <button
              type="submit"
              disabled={!!errorStock}
              className="flex items-center gap-2 px-6 py-2.5 text-xs font-semibold uppercase tracking-wider bg-[#00603C] text-white rounded-lg hover:bg-[#254731] transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              <FileText className="w-4 h-4 text-[#C9922E]" />
              Confirmar Despacho y Emitir Remito
            </button>
          </div>

        </form>
      )}
    </div>
  );
};
