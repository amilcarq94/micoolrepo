/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Lote, OrdenCarga } from '../types';
import { getCampaniaIdFromDate } from '../utils/campanias';
import { LogoSiloLoose } from './Logo';
import { ClienteSelect } from './ClienteSelect';
import { formatNumberArg, formatDateStr } from '../utils/formatters';
import {
  FileText,
  ClipboardList,
  UserCheck,
  Lock,
  UploadCloud,
  Check,
  AlertTriangle,
  Eye,
  Printer,
  Search,
  Calendar,
  User,
  Trash2,
  UserPlus,
  X,
  ShieldCheck
} from 'lucide-react';
import {
  getListaDespachantes,
  addDespachanteAutorizado,
  verifyAutorizadorPassword
} from '../utils/despachantes';

interface DespachosSectionProps {
  lotes: Lote[];
  ordenes: OrdenCarga[];
  onSaveOrden: (nuevaOrden: OrdenCarga) => void;
  onUpdateOrdenStatus: (
    ordenId: string,
    nuevoEstado: 'Disponible' | 'Aceptada' | 'Despachada',
    fotoRemito?: string,
    firmaChofer?: string
  ) => void;
  onDespacharStock: (
    loteId: string,
    bolsas: number,
    kg: number,
    ordenId: string
  ) => boolean;
  onDeleteOrden?: (ordenId: string) => void;
  initialSubView?: 'generar' | 'mis-ordenes' | 'listado';
  onlyMisOrdenes?: boolean;
}

const LISTA_CLIENTES = ["San Diego Semilla", "Eco Rural", "Pampa", "Stine", "Elementa Foods"];
const LISTA_CATEGORIAS = ["Fundadora", "Preba", "Original", "Primu"];
const LISTA_TIPOS = ["Intermedio", "Final"];
const LISTA_TRATAMIENTOS = ["Tratado", "Sin Tratar"];

export const DespachosSection: React.FC<DespachosSectionProps> = ({
  lotes,
  ordenes,
  onSaveOrden,
  onUpdateOrdenStatus,
  onDespacharStock,
  onDeleteOrden,
  initialSubView = 'generar',
  onlyMisOrdenes = false,
}) => {
  // 1. Navegación de Sub-vistas
  const [subView, setSubView] = useState<'generar' | 'mis-ordenes' | 'listado'>(
    onlyMisOrdenes ? 'mis-ordenes' : initialSubView
  );

  // 2. Estados para "Generar orden de carga"
  // Filtros obligatorios y combinables para buscar lotes candidatos
  const [genCliente, setGenCliente] = useState('San Diego Semilla');
  const [genCategoria, setGenCategoria] = useState<'Preba' | 'Original' | 'Primu'>('Primu');
  const [genTipo, setGenTipo] = useState<'Intermedio' | 'Final'>('Final');
  const [genTratamiento, setGenTratamiento] = useState<'Tratado' | 'Sin Tratar'>('Sin Tratar');
  const [genEspecie, setGenEspecie] = useState<string>('Todos');
  const [genVariedad, setGenVariedad] = useState<string>('Todos');

  const [lotesCarga, setLotesCarga] = useState<Array<{ loteId: string; bolsas: number }>>([
    { loteId: '', bolsas: 100 },
    { loteId: '', bolsas: 0 },
    { loteId: '', bolsas: 0 },
    { loteId: '', bolsas: 0 }
  ]);
  const genLoteId = lotesCarga[0].loteId;
  const genBolsas = lotesCarga[0].bolsas;

  const [loteSearchTerms, setLoteSearchTerms] = useState<string[]>(['', '', '', '']);

  const getFilteredLotesForSlot = (index: number) => {
    const term = loteSearchTerms[index].toLowerCase().trim();
    if (!term) return candidateLotes;
    return candidateLotes.filter(l => 
      l.loteNro.toLowerCase().includes(term) || 
      (l.variedad && l.variedad.toLowerCase().includes(term)) ||
      l.id.toLowerCase().includes(term)
    );
  };

  const setGenLoteId = (val: string) => {
    setLotesCarga(prev => {
      const next = [...prev];
      next[0].loteId = val;
      return next;
    });
  };

  const setGenBolsas = (val: number) => {
    setLotesCarga(prev => {
      const next = [...prev];
      next[0].bolsas = val;
      return next;
    });
  };

  const handleUpdateSlot = (index: number, field: 'loteId' | 'bolsas', value: any) => {
    setLotesCarga(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const totalBolsasSeleccionadas = lotesCarga.reduce((sum, item) => sum + (item.loteId ? item.bolsas : 0), 0);
  
  const totalKgSeleccionados = lotesCarga.reduce((sum, item) => {
    if (!item.loteId) return sum;
    const l = lotes.find(lote => lote.id === item.loteId);
    return sum + (l ? item.bolsas * l.kgPorBolsa : 0);
  }, 0);

  // Lista dinámica de Despachantes
  const [despachantesList, setDespachantesList] = useState<string[]>(() => getListaDespachantes());

  // Estado Modal "Agregar Despachante Autorizado"
  const [showAddDespModal, setShowAddDespModal] = useState(false);
  const [addDespNombre, setAddDespNombre] = useState('');
  const [addDespAutor, setAddDespAutor] = useState<'Malcon Baez' | 'Amilcar Quiroz'>('Malcon Baez');
  const [addDespClave, setAddDespClave] = useState('');
  const [addDespError, setAddDespError] = useState('');
  const [addDespSuccess, setAddDespSuccess] = useState('');

  const handleAgregarDespachante = (e: React.FormEvent) => {
    e.preventDefault();
    setAddDespError('');
    setAddDespSuccess('');

    if (!addDespNombre.trim()) {
      setAddDespError('Por favor, ingrese el nombre completo del despachante.');
      return;
    }

    if (!addDespClave.trim()) {
      setAddDespError(`Por favor, ingrese la clave de autorización de ${addDespAutor}.`);
      return;
    }

    const esValido = verifyAutorizadorPassword(addDespAutor, addDespClave);
    if (!esValido) {
      setAddDespError(`Clave de autorización incorrecta para el usuario ${addDespAutor}.`);
      return;
    }

    const nuevoNombre = addDespNombre.trim();
    const updatedList = addDespachanteAutorizado(nuevoNombre);
    setDespachantesList(updatedList);
    setGenDespachante(nuevoNombre);
    setLoginDespachante(nuevoNombre);
    
    setAddDespSuccess(`¡Despachante "${nuevoNombre}" autorizado por ${addDespAutor} y agregado con éxito!`);
    setAddDespNombre('');
    setAddDespClave('');

    setTimeout(() => {
      setShowAddDespModal(false);
      setAddDespSuccess('');
    }, 1200);
  };

  const [genDespachante, setGenDespachante] = useState<string>('Anibal Grandolio');
  const [genAutor, setGenAutor] = useState<'Malcon Baez' | 'Amilcar Quiroz'>('Malcon Baez');
  const [genClave, setGenClave] = useState('');
  const [genError, setGenError] = useState('');
  const [genSuccess, setGenSuccess] = useState('');

  // 3. Estados para "Mis órdenes" (Despachante Asignado - Libre Acceso)
  const [despIdentificado, setDespIdentificado] = useState<string | null>(null);
  const [loginDespachante, setLoginDespachante] = useState<string>('Anibal Grandolio');

  // Estados temporales de archivos cargados en sesión
  const [tempFotos, setTempFotos] = useState<Record<string, string>>({});
  const [tempFirmas, setTempFirmas] = useState<Record<string, string>>({});
  const [despachanteError, setDespachanteError] = useState<Record<string, string>>({});

  // Canvas Drawing
  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignedMap, setHasSignedMap] = useState<Record<string, boolean>>({});

  // 4. Estados para "Listado general de Despachos" (Filtros)
  const [filterCliente, setFilterCliente] = useState('');
  const [filterAutor, setFilterAutor] = useState('');
  const [filterDespachante, setFilterDespachante] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterFecha, setFilterFecha] = useState('');

  // Ver comprobante
  const [comprobanteSeleccionado, setComprobanteSeleccionado] = useState<OrdenCarga | null>(null);

  // Opciones de especies y variedades para la generación de ordenes
  const genEspeciesOptions = useMemo(() => {
    const set = new Set(lotes.map(l => l.especie));
    return Array.from(set).filter(Boolean).sort();
  }, [lotes]);

  const genVariedadesOptions = useMemo(() => {
    const baseLotes = genEspecie === 'Todos'
      ? lotes
      : lotes.filter(l => l.especie === genEspecie);
    const set = new Set(baseLotes.map(l => l.variedad?.trim()));
    return Array.from(set).filter(Boolean).sort();
  }, [lotes, genEspecie]);

  // Resetear Variedad a Todos si la seleccionada ya no existe en la especie elegida
  useEffect(() => {
    if (genVariedad !== 'Todos' && !genVariedadesOptions.includes(genVariedad)) {
      setGenVariedad('Todos');
    }
  }, [genEspecie, genVariedadesOptions, genVariedad]);

  // Computar lotes que cumplen con los criterios (incluye Especie y Variedad)
  const candidateLotes = lotes.filter(l => {
    const matchCliente = l.cliente === genCliente;
    const matchCategoria = l.categoria === genCategoria;
    const matchTipo = l.tipo === genTipo;
    const matchTratamiento = l.tratamiento.includes(genTratamiento as any);
    const matchEspecie = genEspecie === 'Todos' || l.especie === genEspecie;
    const matchVariedad = genVariedad === 'Todos' || l.variedad?.trim() === genVariedad;
    const hasStock = l.stockBolsas > 0;
    const isDisponible = l.estado === 'Disponible';

    return matchCliente && matchCategoria && matchTipo && matchTratamiento && matchEspecie && matchVariedad && hasStock && isDisponible;
  });

  // Auto-seleccionar el lote candidato cuando cambian los filtros
  useEffect(() => {
    if (candidateLotes.length > 0) {
      if (!candidateLotes.some(cl => cl.id === lotesCarga[0].loteId)) {
        setGenLoteId(candidateLotes[0].id);
      }
    } else {
      setGenLoteId('');
    }
  }, [genCliente, genCategoria, genTipo, genTratamiento, genEspecie, genVariedad, lotes]);

  const loteSeleccionado = lotes.find(l => l.id === genLoteId);
  const kgPorBolsa = loteSeleccionado ? loteSeleccionado.kgPorBolsa : 40;
  const kgCalculados = genBolsas * kgPorBolsa;

  // Advertencia de stock en tiempo real si supera el disponible del lote elegido
  const stockInsuficienteAlerta = loteSeleccionado && genBolsas > loteSeleccionado.stockBolsas;

  // Generar Orden de Carga
  const handleGenerarOrden = (e: React.FormEvent) => {
    e.preventDefault();
    setGenError('');
    setGenSuccess('');

    const validSlots = lotesCarga.filter(slot => slot.loteId && slot.bolsas > 0);
    if (validSlots.length === 0) {
      setGenError('Por favor, configure al menos un lote de origen con cantidad de bolsas mayor a cero.');
      return;
    }

    // Validar stock para cada lote seleccionado
    for (let i = 0; i < lotesCarga.length; i++) {
      const slot = lotesCarga[i];
      if (!slot.loteId) continue;
      
      const targetLote = lotes.find(l => l.id === slot.loteId);
      if (!targetLote) continue;

      if (slot.bolsas <= 0) {
        setGenError(`La cantidad de bolsas para el lote ${targetLote.loteNro} debe ser superior a cero.`);
        return;
      }

      if (slot.bolsas > targetLote.stockBolsas) {
        setGenError(`La cantidad solicitada para el Lote ${targetLote.loteNro} supera el stock disponible de ${targetLote.stockBolsas} bolsas.`);
        return;
      }
    }

    // Validar Clave de Autorización
    if (!verifyAutorizadorPassword(genAutor, genClave)) {
      setGenError('La Clave del Autor ingresada es incorrecta.');
      return;
    }

    // Mapear el desglose de lotes de origen
    const lotesOrigen = validSlots.map(slot => {
      const targetLote = lotes.find(l => l.id === slot.loteId)!;
      return {
        loteId: slot.loteId,
        loteNro: targetLote.loteNro,
        cantidadBolsas: slot.bolsas,
        kgTotales: slot.bolsas * targetLote.kgPorBolsa
      };
    });

    const fechaOrden = new Date().toISOString().split('T')[0];
    // Crear la Orden
    const nuevaOrden: OrdenCarga = {
      id: `OC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      fecha: fechaOrden,
      campaniaId: getCampaniaIdFromDate(fechaOrden),
      cliente: genCliente,
      loteId: lotesOrigen[0].loteNro, // Usar el número de lote principal para compatibilidad visual
      cantidadBolsas: totalBolsasSeleccionadas,
      kgTotales: totalKgSeleccionados,
      tipo: genTipo,
      categoria: genCategoria,
      tratamiento: genTratamiento,
      despachante: genDespachante,
      autor: genAutor,
      estado: 'Disponible',
      lotesOrigen: lotesOrigen
    };

    onSaveOrden(nuevaOrden);
    setGenSuccess(`Orden ${nuevaOrden.id} generada con éxito y asignada a ${genDespachante}.`);
    setGenClave('');
    // Resetear las listas de carga
    setLotesCarga([
      { loteId: '', bolsas: 100 },
      { loteId: '', bolsas: 0 },
      { loteId: '', bolsas: 0 },
      { loteId: '', bolsas: 0 }
    ]);
    setLoteSearchTerms(['', '', '', '']);
  };

  // Upload de Remito (Foto)
  const handleFotoUpload = (ordenId: string, file: File) => {
    setDespachanteError(prev => ({ ...prev, [ordenId]: '' }));

    if (file.size > 8 * 1024 * 1024) {
      setDespachanteError(prev => ({ ...prev, [ordenId]: 'La imagen es demasiado grande. El límite es de 8 MB.' }));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === 'string') {
        setTempFotos(prev => ({ ...prev, [ordenId]: result }));
      }
    };
    reader.readAsDataURL(file);
  };

  // Firma Digital - Inicializar contexto
  const getCanvasCoordinates = (ordenId: string, e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRefs.current[ordenId];
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (ordenId: string, e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRefs.current[ordenId];
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCanvasCoordinates(ordenId, e);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#00603C';
    setIsDrawing(true);
  };

  const draw = (ordenId: string, e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRefs.current[ordenId];
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCanvasCoordinates(ordenId, e);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();

    if (!hasSignedMap[ordenId]) {
      setHasSignedMap(prev => ({ ...prev, [ordenId]: true }));
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = (ordenId: string) => {
    const canvas = canvasRefs.current[ordenId];
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    setHasSignedMap(prev => ({ ...prev, [ordenId]: false }));
    setTempFirmas(prev => {
      const next = { ...prev };
      delete next[ordenId];
      return next;
    });
  };

  const saveSignature = (ordenId: string) => {
    const canvas = canvasRefs.current[ordenId];
    if (canvas && hasSignedMap[ordenId]) {
      const dataUrl = canvas.toDataURL('image/png');
      setTempFirmas(prev => ({ ...prev, [ordenId]: dataUrl }));
    }
  };

  // Confirmación final del despacho
  const handleConfirmarDespacho = (orden: OrdenCarga) => {
    setDespachanteError(prev => ({ ...prev, [orden.id]: '' }));
    
    const foto = tempFotos[orden.id] || orden.fotoRemito;
    const firma = tempFirmas[orden.id] || orden.firmaChofer;

    if (!foto) {
      setDespachanteError(prev => ({ ...prev, [orden.id]: 'Por favor, adjunte la fotografía del remito firmado.' }));
      return;
    }

    if (!firma) {
      setDespachanteError(prev => ({ ...prev, [orden.id]: 'Por favor, registre la firma digital de conformidad del chofer.' }));
      return;
    }

    // Descontar Stock
    const exitoDespacho = onDespacharStock(orden.loteId, orden.cantidadBolsas, orden.kgTotales, orden.id);
    if (exitoDespacho) {
      onUpdateOrdenStatus(orden.id, 'Despachada', foto, firma);
    } else {
      setDespachanteError(prev => ({ ...prev, [orden.id]: '⚠️ Error crítico: El stock del lote original ya no posee saldo suficiente.' }));
    }
  };

  // Filtrado de listado general de despachos
  const filteredOrdenes = ordenes.filter(o => {
    const matchCliente = filterCliente === '' || o.cliente.toLowerCase().includes(filterCliente.toLowerCase());
    const matchAutor = filterAutor === '' || o.autor.toLowerCase().includes(filterAutor.toLowerCase());
    const matchDespachante = filterDespachante === '' || o.despachante === filterDespachante;
    const matchEstado = filterEstado === '' || o.estado === filterEstado;
    const matchFecha = filterFecha === '' || o.fecha === filterFecha;

    return matchCliente && matchAutor && matchDespachante && matchEstado && matchFecha;
  });

  return (
    <div className="space-y-6 relative" id="modulo-despachos-root">
      
      {/* Marca de agua muy sutil */}
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.04] pointer-events-none z-0 overflow-hidden">
        <LogoSiloLoose size={450} color="#00603C" />
      </div>

      {/* CABECERA */}
      {!onlyMisOrdenes ? (
        <div className="border-b border-gray-100 pb-5 flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <span className="text-xs font-sans font-semibold tracking-widest text-[#00603C] uppercase">
              SISTEMA DE DESPACHOS Y EXPEDICIÓN
            </span>
            <h2 className="font-serif text-3xl font-bold text-[#1A1A1A] mt-1">
              Playa de Carga — Agro Abacus S.A.
            </h2>
          </div>

          {/* NAVEGACIÓN INTERNA EN SUB-VISTAS */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-[#E3EFE7] bg-opacity-40 p-1 rounded-xl border border-gray-200 self-start text-xs font-sans font-bold">
              <button
                onClick={() => setSubView('generar')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg uppercase tracking-wider transition ${
                  subView === 'generar' ? 'bg-[#00603C] text-white shadow-md' : 'text-gray-600 hover:text-[#00603C]'
                }`}
              >
                <ClipboardList className="w-4 h-4" />
                1. Crear Orden
              </button>
              <button
                onClick={() => setSubView('mis-ordenes')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg uppercase tracking-wider transition ${
                  subView === 'mis-ordenes' ? 'bg-[#00603C] text-white shadow-md' : 'text-gray-600 hover:text-[#00603C]'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                2. Mis Órdenes (Playa)
              </button>
              <button
                onClick={() => setSubView('listado')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg uppercase tracking-wider transition ${
                  subView === 'listado' ? 'bg-[#00603C] text-white shadow-md' : 'text-gray-600 hover:text-[#00603C]'
                }`}
              >
                <FileText className="w-4 h-4" />
                3. Registro General
              </button>
            </div>

            <button
              onClick={() => {
                setAddDespError('');
                setAddDespSuccess('');
                setShowAddDespModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-[#00603C] hover:bg-[#254731] text-white text-xs font-sans font-bold uppercase tracking-wider rounded-xl shadow-sm transition"
              title="Agregar despachante autorizado con usuario y clave de Malcon Baez o Amilcar Quiroz"
            >
              <UserPlus className="w-4 h-4 text-[#F6EFDC]" />
              <span>+ Agregar Despachante</span>
            </button>
          </div>
        </div>
      ) : null}

      {/* CONTENIDO DE LAS SUBVISTAS */}
      <div className="relative z-10">
        
        {/* A) GENERAR ORDEN DE CARGA */}
        {subView === 'generar' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Formulario de Alta */}
            <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-2xl border border-gray-100 shadow-sm space-y-6">
              <div className="border-b border-gray-100 pb-3">
                <span className="text-[10px] font-sans font-bold tracking-widest text-[#C9922E] uppercase">
                  OFICINA DE PLANTA / ADMINISTRATIVO
                </span>
                <h3 className="font-serif text-xl font-bold text-[#1A1A1A] mt-0.5">
                  Generación de Orden de Carga
                </h3>
              </div>

              {genError && (
                <div className="p-4 bg-[#F5E5DC] border-l-4 border-[#A0522D] rounded-r-xl text-xs text-[#A0522D] flex items-start gap-2 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Error:</span> {genError}
                  </div>
                </div>
              )}

              {genSuccess && (
                <div className="p-4 bg-[#E3EFE7] border-l-4 border-[#00603C] rounded-r-xl text-xs text-[#00603C] flex items-start gap-2 animate-in fade-in">
                  <Check className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Éxito:</span> {genSuccess}
                  </div>
                </div>
              )}

              <form onSubmit={handleGenerarOrden} className="space-y-6">
                
                {/* 1. SECCIÓN FILTROS (6 FILTROS COMBINABLES) */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
                  <span className="text-[9px] font-sans font-bold tracking-widest text-[#00603C] uppercase block mb-1">
                    Criterios del Lote a Cargar
                  </span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                    {/* Cliente */}
                    <ClienteSelect
                      value={genCliente}
                      onChange={setGenCliente}
                      label="Cliente Comitente *"
                      selectClassName="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00603C] text-xs font-semibold"
                      inputClassName="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00603C] text-xs font-medium mt-1"
                    />

                    {/* Especie */}
                    <div>
                      <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Especie
                      </label>
                      <select
                        value={genEspecie}
                        onChange={(e) => setGenEspecie(e.target.value)}
                        className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00603C]"
                        required
                      >
                        <option value="Todos">🌱 Todas las Especies</option>
                        {genEspeciesOptions.map(esp => (
                          <option key={esp} value={esp}>{esp}</option>
                        ))}
                      </select>
                    </div>

                    {/* Variedad */}
                    <div>
                      <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Variedad
                      </label>
                      <select
                        value={genVariedad}
                        onChange={(e) => setGenVariedad(e.target.value)}
                        className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00603C]"
                        required
                      >
                        <option value="Todos">🧬 Todas las Variedades</option>
                        {genVariedadesOptions.map(varOpt => (
                          <option key={varOpt} value={varOpt}>{varOpt}</option>
                        ))}
                      </select>
                    </div>

                    {/* Categoría */}
                    <div>
                      <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Categoría del Lote *
                      </label>
                      <select
                        value={genCategoria}
                        onChange={(e) => setGenCategoria(e.target.value as any)}
                        className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00603C]"
                        required
                      >
                        {LISTA_CATEGORIAS.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    {/* Tipo */}
                    <div>
                      <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Tipo de Lote *
                      </label>
                      <select
                        value={genTipo}
                        onChange={(e) => setGenTipo(e.target.value as any)}
                        className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00603C]"
                        required
                      >
                        {LISTA_TIPOS.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    {/* Tratamiento */}
                    <div>
                      <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Tratamiento *
                      </label>
                      <select
                        value={genTratamiento}
                        onChange={(e) => setGenTratamiento(e.target.value as any)}
                        className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00603C]"
                        required
                      >
                        {LISTA_TRATAMIENTOS.map(tr => (
                          <option key={tr} value={tr}>{tr}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 2. SECCIÓN RESULTADO (SELECCIÓN DE LOTES DE ORIGEN ENCONTRADOS - MÁXIMO 4) */}
                <div className="space-y-4">
                  <div className="border-b border-gray-100 pb-2">
                    <h5 className="font-serif text-xs font-bold text-[#00603C] uppercase tracking-wider">
                      Lotes de Origen Encontrados & Bolsas a Cargar (Hasta 4 Lotes)
                    </h5>
                    <p className="text-[10px] text-gray-400">
                      Seleccione los lotes de origen que conformarán esta orden de carga y asigne la cantidad de bolsas para cada uno.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {lotesCarga.map((slot, index) => {
                      const selectedLote = lotes.find(l => l.id === slot.loteId);
                      const isSlotStockInsuficiente = selectedLote && slot.bolsas > selectedLote.stockBolsas;

                      return (
                        <div key={index} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                          <div>
                            <label className="block text-[9px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                              {index === 0 ? "Lote de Origen Principal *" : `Lote de Origen ${index + 1} (Opcional)`}
                            </label>

                            {/* Buscador Instantáneo */}
                            {candidateLotes.length > 0 && (
                              <div className="relative mb-1.5">
                                <input
                                  type="text"
                                  value={loteSearchTerms[index]}
                                  onChange={(e) => {
                                    const next = [...loteSearchTerms];
                                    next[index] = e.target.value;
                                    setLoteSearchTerms(next);
                                  }}
                                  placeholder="Buscar lote..."
                                  className="w-full h-8 pl-7 pr-6 bg-white border border-gray-200 rounded-lg text-[10px] focus:outline-none focus:ring-1 focus:ring-[#00603C] placeholder-gray-400 font-medium font-sans"
                                />
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                                {loteSearchTerms[index] && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = [...loteSearchTerms];
                                      next[index] = '';
                                      setLoteSearchTerms(next);
                                    }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                  >
                                    <span className="text-[12px] font-bold">×</span>
                                  </button>
                                )}
                              </div>
                            )}

                            <select
                              value={slot.loteId}
                              onChange={(e) => {
                                const val = e.target.value;
                                handleUpdateSlot(index, 'loteId', val);
                                if (index > 0 && val && slot.bolsas === 0) {
                                  handleUpdateSlot(index, 'bolsas', 50);
                                }
                              }}
                              className="w-full h-10 px-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00603C] font-semibold text-xs"
                              required={index === 0}
                              disabled={candidateLotes.length === 0}
                            >
                              {index > 0 && <option value="">— Ninguno —</option>}
                              {getFilteredLotesForSlot(index).length > 0 ? (
                                getFilteredLotesForSlot(index).map(l => (
                                  <option key={l.id} value={l.id}>
                                    L {l.loteNro} - {l.variedad} ({l.stockBolsas} b.)
                                  </option>
                                ))
                              ) : (
                                <option value="">No hay coincidencias</option>
                              )}
                            </select>
                            {index === 0 && candidateLotes.length === 0 && (
                              <span className="text-[9px] text-[#A0522D] font-bold mt-1 block">
                                ⚠️ No hay lotes "Disponibles".
                              </span>
                            )}
                          </div>

                          {/* Cantidad de Bolsas */}
                          <div>
                            <label className="block text-[9px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                              Bolsas a Cargar {index === 0 ? "*" : "(Opcional)"}
                            </label>
                            <input
                              type="number"
                              value={slot.bolsas === 0 && index > 0 ? "" : slot.bolsas}
                              placeholder={index > 0 ? "Bolsas..." : "Cantidad"}
                              onChange={(e) => handleUpdateSlot(index, 'bolsas', parseInt(e.target.value) || 0)}
                              className={`w-full h-10 px-2 bg-white border rounded-lg focus:outline-none focus:ring-2 text-xs font-mono font-bold ${
                                isSlotStockInsuficiente
                                  ? 'border-[#A0522D] focus:ring-[#A0522D]'
                                  : 'border-gray-200 focus:ring-[#00603C]'
                              }`}
                              min={index === 0 ? "1" : "0"}
                              required={index === 0 && !!slot.loteId}
                              disabled={!slot.loteId}
                            />
                            
                            {/* Advertencia en Terracota */}
                            {isSlotStockInsuficiente && (
                              <div className="mt-1 p-1 bg-[#F5E5DC] text-[#A0522D] rounded font-bold text-[9px] animate-in fade-in duration-200">
                                Solo {selectedLote.stockBolsas} b. disp.
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Ficha técnica informativa de Solo Lectura */}
                {loteSeleccionado && (
                  <div className="bg-[#F6EFDC] bg-opacity-40 p-4 rounded-xl border border-[#C9922E] border-opacity-25 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs text-left">
                      <div>
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Especie</span>
                        <span className="font-bold text-gray-800">{loteSeleccionado.especie}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Variedad Principal</span>
                        <span className="font-bold text-gray-800">{loteSeleccionado.variedad}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Lotes Seleccionados</span>
                        <span className="font-bold text-[#00603C] font-mono">
                          {lotesCarga.filter(s => s.loteId && s.bolsas > 0).length} Lotes
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Carga Estimada Total</span>
                        <span className="font-mono font-bold text-[#00603C] text-sm block">
                          {formatNumberArg(totalKgSeleccionados, 0)} kg
                        </span>
                        <span className="text-[10px] text-gray-400 block font-semibold">
                          ({totalBolsasSeleccionadas} bolsas totales)
                        </span>
                      </div>
                    </div>

                    {/* Resumen de Desglose */}
                    {lotesCarga.filter(s => s.loteId && s.bolsas > 0).length > 1 && (
                      <div className="border-t border-gray-200/50 pt-2.5 text-xs">
                        <span className="text-[9px] font-bold text-gray-400 uppercase block tracking-wider mb-1.5">Desglose de Lotes para la Carga</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {lotesCarga.filter(s => s.loteId && s.bolsas > 0).map((s, i) => {
                            const l = lotes.find(lo => lo.id === s.loteId);
                            if (!l) return null;
                            return (
                              <div key={i} className="flex justify-between items-center bg-white px-3 py-1.5 rounded-lg border border-gray-100 font-medium">
                                <span className="font-mono font-bold text-gray-700">Lote: {l.loteNro}</span>
                                <span className="text-[#00603C] font-semibold">{s.bolsas} bolsas ({formatNumberArg(s.bolsas * l.kgPorBolsa, 0)} kg)</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. SECCIÓN ASIGNACIÓN Y FIRMA DE AUTOR */}
                <div className="border-t border-gray-100 pt-5 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  {/* Despachante Asignado */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider">
                        Despachante Asignado *
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setAddDespError('');
                          setAddDespSuccess('');
                          setShowAddDespModal(true);
                        }}
                        className="text-[10px] font-bold text-[#00603C] hover:text-[#254731] flex items-center gap-1 underline transition"
                      >
                        <UserPlus className="w-3 h-3" /> + Agregar Autorizado
                      </button>
                    </div>
                    <select
                      value={genDespachante}
                      onChange={(e) => setGenDespachante(e.target.value)}
                      className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00603C]"
                      required
                    >
                      {despachantesList.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  {/* Autor */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Autor Carga *
                    </label>
                    <select
                      value={genAutor}
                      onChange={(e) => setGenAutor(e.target.value as any)}
                      className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00603C]"
                      required
                    >
                      <option value="Malcon Baez">Malcon Baez</option>
                      <option value="Amilcar Quiroz">Amilcar Quiroz</option>
                    </select>
                  </div>

                  {/* Clave */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Clave del Autor *
                    </label>
                    <input
                      type="password"
                      value={genClave}
                      onChange={(e) => setGenClave(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-10 px-3 bg-[#F5E5DC] bg-opacity-40 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#A0522D]"
                      required
                    />
                  </div>
                </div>

                {/* Botón generar */}
                <div className="pt-2 text-right">
                  <button
                    type="submit"
                    disabled={!genLoteId || stockInsuficienteAlerta}
                    className="px-6 py-2.5 bg-[#00603C] text-white rounded-xl font-sans font-bold hover:bg-[#254731] transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Generar Orden Autorizada
                  </button>
                </div>

              </form>
            </div>

            {/* Panel Informativo Lateral */}
            <div className="bg-[#F6EFDC] p-6 rounded-2xl border border-amber-100 shadow-sm space-y-4 text-xs text-left self-start relative overflow-hidden">
              <div className="absolute right-[-10px] top-[-10px] opacity-[0.07] pointer-events-none">
                <LogoSiloLoose size={120} color="#C9922E" />
              </div>
              
              <h4 className="font-serif text-base font-bold text-[#1A1A1A] border-b border-amber-200 pb-2 uppercase tracking-wider">
                Control de Carga Seguro
              </h4>
              
              <ol className="space-y-3 pl-4 list-decimal text-gray-700">
                <li>
                  <strong className="text-[#00603C]">Filtros obligatorios:</strong> Se seleccionan los 4 atributos exactos para evitar cargar granos de categorías erróneas.
                </li>
                <li>
                  <strong className="text-[#00603C]">Control de Stock:</strong> No se pueden autorizar cargas por encima de la capacidad remanente del lote.
                </li>
                <li>
                  <strong className="text-[#00603C]">Firma Digital:</strong> Una vez generada, el despachante en playa podrá acceder sin clave, cargar la foto del remito en físico y capturar la conformidad del chofer.
                </li>
              </ol>
            </div>

          </div>
        )}

        {/* B) MIS ÓRDENES (DESPACHANTE EN PLAYA DE CARGA) */}
        {subView === 'mis-ordenes' && (
          <div className="space-y-6">
            
            {/* Login Libre sin Clave */}
            {!despIdentificado ? (
              <div className="max-w-md mx-auto bg-white p-6 md:p-8 rounded-2xl border border-gray-100 shadow-xl text-xs space-y-5 text-left">
                <div className="text-center pb-3 border-b border-gray-100">
                  <LogoSiloLoose size={56} color="#00603C" className="mx-auto mb-3" />
                  <span className="text-[10px] font-sans font-bold tracking-widest text-[#C9922E] uppercase">
                    ACCESO LIBRE A PLAYA DE CARGA
                  </span>
                  <h3 className="font-serif text-lg font-bold text-[#1A1A1A] mt-1">
                    Identificación del Despachante
                  </h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider">
                        ¿Quién sos? *
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setAddDespError('');
                          setAddDespSuccess('');
                          setShowAddDespModal(true);
                        }}
                        className="text-[10px] font-bold text-[#00603C] hover:text-[#254731] flex items-center gap-1 underline transition"
                      >
                        <UserPlus className="w-3 h-3" /> + Nuevo Despachante
                      </button>
                    </div>
                    <select
                      value={loginDespachante}
                      onChange={(e) => setLoginDespachante(e.target.value)}
                      className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00603C] text-sm font-semibold text-gray-800"
                    >
                      {despachantesList.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() => setDespIdentificado(loginDespachante)}
                    className="w-full h-11 bg-[#00603C] text-[#F6EFDC] font-bold uppercase tracking-wider rounded-xl hover:bg-[#254731] transition"
                  >
                    Ingresar a mis órdenes
                  </button>
                </div>
              </div>
            ) : (
              
              // Panel del Despachante Identificado
              <div className="space-y-6 text-left">
                
                <div className="bg-[#E3EFE7] p-4 rounded-2xl border border-gray-200 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-[#00603C] text-[#F6EFDC] rounded-xl">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-[#00603C] font-bold block">Despachante Asignado</span>
                      <h4 className="text-sm font-bold text-gray-800">{despIdentificado}</h4>
                    </div>
                  </div>
                  <button
                    onClick={() => setDespIdentificado(null)}
                    className="px-3 py-1.5 border border-[#A0522D] text-[#A0522D] rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-[#F5E5DC] transition"
                  >
                    Salir / Cambiar Despachante
                  </button>
                </div>

                {/* Listado de órdenes asignadas */}
                {ordenes.filter(o => o.despachante === despIdentificado).length === 0 ? (
                  <div className="bg-white p-12 text-center rounded-2xl border border-gray-100 text-gray-400">
                    <ClipboardList className="w-12 h-12 text-[#C9922E] mx-auto mb-3 opacity-40" />
                    <h4 className="font-serif text-lg font-bold text-gray-700">Sin Órdenes de Carga</h4>
                    <p className="text-xs">No tiene órdenes asignadas en este momento.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {ordenes
                      .filter(o => o.despachante === despIdentificado)
                      .map(o => {
                        const fotoUrl = tempFotos[o.id] || o.fotoRemito;
                        const firmaUrl = tempFirmas[o.id] || o.firmaChofer;
                        const errorMsg = despachanteError[o.id];
                        const lote = lotes.find(l => l.id === o.loteId);

                        return (
                          <div
                            key={o.id}
                            className={`bg-white rounded-2xl border p-5 shadow-sm space-y-4 flex flex-col justify-between transition-all ${
                              o.estado === 'Despachada'
                                ? 'border-gray-100 bg-gray-50 bg-opacity-60'
                                : o.estado === 'Aceptada'
                                ? 'border-[#00603C] ring-1 ring-[#00603C] ring-opacity-20'
                                : 'border-amber-200 bg-amber-50 bg-opacity-20'
                            }`}
                          >
                            <div className="space-y-3">
                              <div className="flex justify-between items-start border-b border-gray-100 pb-2.5">
                                <div>
                                  <span className="text-[10px] uppercase font-mono font-bold text-[#C9922E]">
                                    ORDEN N° {o.id}
                                  </span>
                                  <h4 className="font-serif text-sm font-bold text-gray-900 mt-0.5">{o.cliente}</h4>
                                </div>
                                <span
                                  className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                                    o.estado === 'Despachada'
                                      ? 'bg-[#00603C] text-white'
                                      : o.estado === 'Aceptada'
                                      ? 'bg-[#E3EFE7] text-[#00603C]'
                                      : 'bg-[#F6EFDC] text-[#C9922E] border border-amber-200'
                                  }`}
                                >
                                  {o.estado}
                                </span>
                              </div>

                              {errorMsg && (
                                <div className="p-2.5 bg-[#F5E5DC] text-[#A0522D] font-bold rounded-lg text-[10px] animate-in shake duration-150">
                                  {errorMsg}
                                </div>
                              )}

                              {/* 10 Campos de Información de la Orden Requeridos */}
                              <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50 p-3 rounded-xl border border-gray-100">
                                <div className="col-span-2 border-b border-gray-200 pb-1 bg-white p-2 rounded-lg border border-gray-100">
                                  <span className="text-[8px] text-gray-400 font-bold uppercase block tracking-wider">Cliente Comitente</span>
                                  <span className="font-bold text-[#00603C] text-xs uppercase">{o.cliente}</span>
                                </div>

                                {o.lotesOrigen && o.lotesOrigen.length > 0 ? (
                                  <div className="col-span-2 bg-[#E3EFE7] bg-opacity-30 p-2 rounded-lg border border-[#00603C]/10 space-y-1 my-1">
                                    <span className="text-[8px] font-bold text-[#00603C] uppercase tracking-wider block">Lotes de Origen Encontrados ({o.lotesOrigen.length})</span>
                                    <div className="space-y-1 text-[11px]">
                                      {o.lotesOrigen.map((lo, idx) => (
                                        <div key={idx} className="flex justify-between border-b border-dashed border-gray-200 pb-0.5 last:border-0 last:pb-0">
                                          <span className="font-mono font-bold text-gray-700">Lote: {lo.loteNro}</span>
                                          <span className="font-semibold text-gray-800">{lo.cantidadBolsas} b. / {formatNumberArg(lo.kgTotales, 0)} kg</span>
                                        </div>
                                      ))}
                                    </div>
                                    <div className="flex justify-between items-center pt-1 border-t border-[#00603C]/10 text-[9px] font-bold text-[#00603C]">
                                      <span>TOTAL CARGA</span>
                                      <span>{o.cantidadBolsas} b. / {formatNumberArg(o.kgTotales, 0)} kg</span>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div>
                                      <span className="text-[8px] text-gray-400 font-bold uppercase block tracking-wider">N° de Lote</span>
                                      <span className="font-mono font-bold text-[#00603C]">{o.loteId}</span>
                                    </div>
                                    <div>
                                      <span className="text-[8px] text-gray-400 font-bold uppercase block tracking-wider">Especie</span>
                                      <span className="font-semibold text-gray-800">{lote?.especie || '—'}</span>
                                    </div>
                                    <div>
                                      <span className="text-[8px] text-gray-400 font-bold uppercase block tracking-wider">Variedad</span>
                                      <span className="font-semibold text-gray-800">{lote?.variedad || '—'}</span>
                                    </div>
                                    <div>
                                      <span className="text-[8px] text-gray-400 font-bold uppercase block tracking-wider">Cantidad de Bolsas</span>
                                      <span className="font-bold text-gray-800">{o.cantidadBolsas} b.</span>
                                    </div>
                                    <div>
                                      <span className="text-[8px] text-gray-400 font-bold uppercase block tracking-wider">Kg Totales</span>
                                      <span className="font-mono font-bold text-[#00603C]">{formatNumberArg(o.kgTotales, 0)} kg</span>
                                    </div>
                                  </>
                                )}

                                <div>
                                  <span className="text-[8px] text-gray-400 font-bold uppercase block tracking-wider">Tipo de Lote</span>
                                  <span className="font-semibold text-gray-800">{o.tipo}</span>
                                </div>
                                <div>
                                  <span className="text-[8px] text-gray-400 font-bold uppercase block tracking-wider">Categoría</span>
                                  <span className="font-semibold text-gray-800">{o.categoria}</span>
                                </div>
                                <div className="col-span-2">
                                  <span className="text-[8px] text-gray-400 font-bold uppercase block tracking-wider">Tratamiento</span>
                                  <span className="font-semibold text-gray-800">{o.tratamiento}</span>
                                </div>
                                <div className="col-span-2 border-t border-gray-100 pt-1.5 mt-1">
                                  <span className="text-[8px] text-gray-400 font-bold uppercase block tracking-wider">Autorizador por Oficina</span>
                                  <span className="font-bold text-gray-700">{o.autor}</span>
                                </div>
                              </div>

                              {/* Sección de carga de firma y remito (Solo si está Aceptada) */}
                              {o.estado === 'Aceptada' && (
                                <div className="border-t border-gray-100 pt-3 space-y-4 text-xs">
                                  
                                  {/* 1. Fotografía del Remito */}
                                  <div className="space-y-1.5">
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-gray-700 block">
                                      1. Adjuntar Foto de Remito de Salida *
                                    </span>

                                    {fotoUrl ? (
                                      <div className="relative border border-gray-200 rounded-xl p-2 bg-gray-50 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                          <img
                                            src={fotoUrl}
                                            alt="Foto Remito"
                                            className="w-12 h-12 object-cover rounded-md border border-gray-300"
                                            referrerPolicy="no-referrer"
                                          />
                                          <div>
                                            <span className="font-bold text-gray-800 text-[10px] block">Remito_Salida.jpg</span>
                                            <span className="text-[8px] text-gray-400">Capturado correctamente</span>
                                          </div>
                                        </div>
                                        <button
                                          onClick={() => {
                                            const updated = { ...tempFotos };
                                            delete updated[o.id];
                                            setTempFotos(updated);
                                          }}
                                          className="text-[10px] text-[#A0522D] hover:underline uppercase font-bold"
                                        >
                                          Quitar
                                        </button>
                                      </div>
                                    ) : (
                                      <div
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={(e) => {
                                          e.preventDefault();
                                          if (e.dataTransfer.files?.[0]) {
                                            handleFotoUpload(o.id, e.dataTransfer.files[0]);
                                          }
                                        }}
                                        onClick={() => {
                                          const input = document.createElement('input');
                                          input.type = 'file';
                                          input.accept = 'image/*';
                                          input.onchange = (e) => {
                                            const file = (e.target as HTMLInputElement).files?.[0];
                                            if (file) handleFotoUpload(o.id, file);
                                          };
                                          input.click();
                                        }}
                                        className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:border-[#00603C] transition bg-gray-50 cursor-pointer"
                                      >
                                        <UploadCloud className="w-6 h-6 text-[#C9922E] mx-auto mb-1.5" />
                                        <span className="font-bold text-gray-700 block text-[10px]">Arrastre o Seleccione Foto</span>
                                        <span className="text-[8px] text-gray-400">JPG, PNG hasta 8 MB</span>
                                      </div>
                                    )}
                                  </div>

                                  {/* 2. Firma del Chofer */}
                                  <div className="space-y-1.5">
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-gray-700 block">
                                      2. Firma Digital del Chofer Conductor *
                                    </span>

                                    {firmaUrl ? (
                                      <div className="relative border border-gray-200 rounded-xl p-2 bg-gray-50 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                          <img
                                            src={firmaUrl}
                                            alt="Firma"
                                            className="w-20 h-10 object-contain rounded bg-white border border-gray-300"
                                            referrerPolicy="no-referrer"
                                          />
                                          <div>
                                            <span className="font-bold text-gray-800 text-[10px] block">Firma_Guardada.png</span>
                                            <span className="text-[8px] text-gray-400">Trazado conforme</span>
                                          </div>
                                        </div>
                                        <button
                                          onClick={() => {
                                            const updated = { ...tempFirmas };
                                            delete updated[o.id];
                                            setTempFirmas(updated);
                                            const updatedHasSigned = { ...hasSignedMap };
                                            updatedHasSigned[o.id] = false;
                                            setHasSignedMap(updatedHasSigned);
                                          }}
                                          className="text-[10px] text-[#A0522D] hover:underline uppercase font-bold"
                                        >
                                          Quitar
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="border border-gray-200 rounded-xl p-3 bg-gray-50 space-y-2">
                                        <div className="flex justify-between items-center mb-1">
                                          <span className="text-[9px] font-bold text-gray-500">DIBUJE SU FIRMA AQUÍ:</span>
                                          <button
                                            type="button"
                                            onClick={() => clearSignature(o.id)}
                                            className="text-[9px] uppercase font-bold text-[#A0522D] hover:underline"
                                          >
                                            Limpiar
                                          </button>
                                        </div>
                                        <canvas
                                          ref={(el) => { canvasRefs.current[o.id] = el; }}
                                          width={280}
                                          height={100}
                                          onMouseDown={(e) => startDrawing(o.id, e)}
                                          onMouseMove={(e) => draw(o.id, e)}
                                          onMouseUp={stopDrawing}
                                          onMouseLeave={stopDrawing}
                                          onTouchStart={(e) => startDrawing(o.id, e)}
                                          onTouchMove={(e) => draw(o.id, e)}
                                          onTouchEnd={stopDrawing}
                                          className="w-full bg-white rounded-lg border border-gray-200 cursor-crosshair touch-none h-[100px]"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => saveSignature(o.id)}
                                          disabled={!hasSignedMap[o.id]}
                                          className="w-full py-1.5 bg-[#00603C] text-white font-bold uppercase tracking-wider text-[10px] rounded-lg hover:bg-[#254731] transition disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                          Confirmar Trazado de Firma
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                </div>
                              )}

                              {o.estado === 'Despachada' && (
                                <div className="pt-2">
                                  <button
                                    onClick={() => setComprobanteSeleccionado(o)}
                                    className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-bold uppercase tracking-wider rounded-lg transition flex items-center justify-center gap-1.5"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    Ver Comprobante de Despacho
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Botón de acción principal según el estado */}
                            <div className="pt-3 border-t border-gray-100">
                              {o.estado === 'Disponible' && (
                                <button
                                  onClick={() => onUpdateOrdenStatus(o.id, 'Aceptada')}
                                  className="w-full py-2 bg-[#C9922E] hover:bg-opacity-90 text-white font-sans font-bold uppercase tracking-wider rounded-lg transition"
                                >
                                  Aceptar orden de carga
                                </button>
                              )}

                              {o.estado === 'Aceptada' && (
                                <button
                                  onClick={() => handleConfirmarDespacho(o)}
                                  disabled={!fotoUrl || !firmaUrl}
                                  className="w-full py-2.5 bg-[#00603C] hover:bg-[#254731] text-[#F6EFDC] font-sans font-bold uppercase tracking-wider rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  Confirmar Despacho Físico de Granos
                                </button>
                              )}

                              {o.estado === 'Despachada' && (
                                <div className="text-center text-[10px] font-bold text-[#00603C] uppercase tracking-wider flex items-center justify-center gap-1 bg-[#E3EFE7] py-2 rounded-lg">
                                  <Check className="w-4 h-4 text-[#00603C]" />
                                  Despacho Completado con Éxito
                                </div>
                              )}
                            </div>

                          </div>
                        );
                      })}
                  </div>
                )}

              </div>
            )}

          </div>
        )}

        {/* C) LISTADO GENERAL DE DESPACHOS */}
        {subView === 'listado' && (
          <div className="space-y-6 text-left">
            
            {/* Filtros de la Tabla */}
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm grid grid-cols-1 sm:grid-cols-5 gap-4 text-xs">
              
              {/* Cliente */}
              <div>
                <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Cliente Comitente
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={filterCliente}
                    onChange={(e) => setFilterCliente(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C] h-10"
                    placeholder="Buscar cliente..."
                  />
                </div>
              </div>

              {/* Autor */}
              <div>
                <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Autorizado por
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={filterAutor}
                    onChange={(e) => setFilterAutor(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C] h-10"
                    placeholder="Buscar autor..."
                  />
                </div>
              </div>

              {/* Despachante */}
              <div>
                <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Despachante Asignado
                </label>
                <select
                  value={filterDespachante}
                  onChange={(e) => setFilterDespachante(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C] h-10"
                >
                  <option value="">Todos los despachantes</option>
                  {despachantesList.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Estado */}
              <div>
                <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Estado
                </label>
                <select
                  value={filterEstado}
                  onChange={(e) => setFilterEstado(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C] h-10"
                >
                  <option value="">Todos los estados</option>
                  <option value="Disponible">Disponible (Pendiente)</option>
                  <option value="Aceptada">Aceptada (Cargando)</option>
                  <option value="Despachada">Despachada (Entregada)</option>
                </select>
              </div>

              {/* Fecha */}
              <div>
                <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Fecha
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                    <Calendar className="w-4 h-4" />
                  </span>
                  <input
                    type="date"
                    value={filterFecha}
                    onChange={(e) => setFilterFecha(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00603C] h-10"
                  />
                </div>
              </div>

            </div>

            {/* Tabla */}
            {filteredOrdenes.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl border border-gray-100 text-center text-gray-400">
                <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-40 text-[#C9922E]" />
                <h4 className="font-serif text-lg font-bold text-gray-700 mb-1">Sin Órdenes Registradas</h4>
                <p className="text-xs">No se encontraron órdenes de carga generadas con los filtros vigentes.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#00603C] text-white font-sans uppercase tracking-wider text-[9px]">
                        <th className="py-3 px-4">N° Orden</th>
                        <th className="py-3 px-4">Fecha</th>
                        <th className="py-3 px-4">Cliente Comitente</th>
                        <th className="py-3 px-4">Lote ID</th>
                        <th className="py-3 px-4">Autorizado por</th>
                        <th className="py-3 px-4">Despachante</th>
                        <th className="py-3 px-4 text-right">Bolsas</th>
                        <th className="py-3 px-4 text-right">Total Kg</th>
                        <th className="py-3 px-4 text-center">Remito/Foto</th>
                        <th className="py-3 px-4 text-center">Firma Chofer</th>
                        <th className="py-3 px-4 text-center">Estado</th>
                        <th className="py-3 px-4 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredOrdenes.map((o, idx) => {
                        const hasFoto = !!(tempFotos[o.id] || o.fotoRemito);
                        const hasFirma = !!(tempFirmas[o.id] || o.firmaChofer);

                        return (
                          <tr
                            key={o.id}
                            className={idx % 2 === 0 ? 'bg-white' : 'bg-[#E3EFE7] bg-opacity-20'}
                          >
                            <td className="py-3.5 px-4 font-mono font-bold text-[#A0522D]">{o.id}</td>
                            <td className="py-3.5 px-4 font-semibold text-gray-600">{formatDateStr(o.fecha)}</td>
                            <td className="py-3.5 px-4 font-bold text-gray-800">{o.cliente}</td>
                            <td className="py-3.5 px-4 font-mono font-semibold text-gray-700">
                              {o.lotesOrigen && o.lotesOrigen.length > 0 ? (
                                <div className="flex flex-wrap gap-1 max-w-[150px]">
                                  {o.lotesOrigen.map((lo, lIdx) => (
                                    <span key={lIdx} className="bg-[#E3EFE7] text-[#00603C] px-1 py-0.5 rounded-[4px] text-[10px] font-bold">
                                      L-{lo.loteNro}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span>L-{o.loteId}</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-gray-700">{o.autor}</td>
                            <td className="py-3.5 px-4 font-semibold text-gray-900">{o.despachante}</td>
                            <td className="py-3.5 px-4 text-right font-bold text-gray-800">{o.cantidadBolsas} b.</td>
                            <td className="py-3.5 px-4 text-right font-mono font-bold text-[#00603C]">
                              {formatNumberArg(o.kgTotales, 0)} kg
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              {hasFoto ? (
                                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-[#E3EFE7] text-[#00603C] text-[9px] font-bold">
                                  CON FOTO
                                </span>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              {hasFirma ? (
                                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-[#C9922E] text-[9px] font-bold">
                                  FIRMADO
                                </span>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span
                                className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                  o.estado === 'Despachada'
                                    ? 'bg-[#00603C] text-white'
                                    : o.estado === 'Aceptada'
                                    ? 'bg-[#E3EFE7] text-[#00603C]'
                                    : 'bg-[#F6EFDC] text-[#C9922E]'
                                }`}
                              >
                                {o.estado}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {o.estado === 'Despachada' ? (
                                  <button
                                    onClick={() => setComprobanteSeleccionado(o)}
                                    className="p-1.5 bg-[#E3EFE7] text-[#00603C] rounded-lg hover:bg-[#00603C] hover:text-white transition"
                                    title="Ver Comprobante de Despacho"
                                  >
                                    <Printer className="w-4 h-4" />
                                  </button>
                                ) : (
                                  <span className="text-gray-400 text-[10px]">—</span>
                                )}

                                {onDeleteOrden && (
                                  <button
                                    onClick={() => {
                                      if (confirm(`¿Está seguro de eliminar la orden ${o.id}?`)) {
                                        onDeleteOrden(o.id);
                                      }
                                    }}
                                    className="p-1.5 text-[#A0522D] hover:bg-red-50 rounded-lg transition"
                                    title="Eliminar orden"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        )}

      </div>

      {/* COMPROBANTE DE DESPACHO PRINTABLE MODAL */}
      {comprobanteSeleccionado && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:static">
          
          <div className="bg-white w-full max-w-3xl rounded-3xl border-2 border-[#00603C] p-6 md:p-8 space-y-6 relative text-left shadow-2xl print:shadow-none print:border-none print:p-0 print:my-0">
            
            {/* Botón Cerrar */}
            <button
              onClick={() => setComprobanteSeleccionado(null)}
              className="absolute top-4 right-4 p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-full transition print:hidden"
            >
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Isotipo Sello en el Fondo del Comprobante */}
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.06] pointer-events-none">
              <LogoSiloLoose size={280} color="#00603C" />
            </div>

            {/* Header del Recibo */}
            <div className="flex justify-between items-start border-b-2 border-[#00603C] pb-5 mb-4">
              <div className="flex gap-3 items-center">
                <LogoSiloLoose size={48} color="#00603C" />
                <div>
                  <h3 className="font-serif text-xl font-bold text-[#00603C] uppercase tracking-wide leading-none">
                    AGRO ABACUS S.A.
                  </h3>
                  <p className="text-[10px] font-sans font-bold tracking-widest text-[#C9922E] uppercase mt-1">
                    PLANTA CLASIFICADORA · LA BARRANCOSA
                  </p>
                  <p className="text-[9px] text-gray-500 mt-0.5">Estancia La Barrancosa — Buenos Aires, Argentina</p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[8px] uppercase tracking-widest font-bold text-gray-400 block">
                  CONSTANCIA DE DESPACHO PLAYA
                </span>
                <div className="bg-[#00603C] text-[#F6EFDC] font-mono font-bold text-xs px-3 py-1.5 rounded-md mt-1.5 inline-block">
                  ORDEN N° {comprobanteSeleccionado.id}
                </div>
                <div className="text-[10px] text-gray-600 mt-1 font-semibold">
                  Fecha: {formatDateStr(comprobanteSeleccionado.fecha)}
                </div>
              </div>
            </div>

            <div className="text-center mb-2">
              <h4 className="font-serif text-base font-bold text-[#00603C] border-b border-[#C9922E] pb-1 inline-block uppercase tracking-wider">
                Certificado de Expedición de Granos Clasificados
              </h4>
            </div>

            {/* Datos Técnicos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#F6EFDC] bg-opacity-40 p-4 rounded-xl border border-[#C9922E] border-opacity-20 text-xs">
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-[#C9922E] uppercase tracking-wider block">
                  CLIENTE COMITENTE / DESTINATARIO
                </span>
                <p className="font-bold text-gray-800 text-sm">{comprobanteSeleccionado.cliente}</p>
                <p className="text-gray-500 text-[11px]">Planta Clasificadora — Estancia La Barrancosa</p>
                <p className="text-gray-500 text-[11px]">Despachante: <span className="font-semibold text-gray-800">{comprobanteSeleccionado.despachante}</span></p>
              </div>

              <div className="space-y-1">
                <span className="text-[9px] font-bold text-[#C9922E] uppercase tracking-wider block">
                  DATOS MAESTROS DEL GRANO
                </span>
                <p className="text-gray-700">
                  Lote de Origen:{" "}
                  <span className="font-mono font-bold text-[#A0522D]">
                    {comprobanteSeleccionado.lotesOrigen && comprobanteSeleccionado.lotesOrigen.length > 0
                      ? comprobanteSeleccionado.lotesOrigen.map(lo => lo.loteNro).join(", ")
                      : comprobanteSeleccionado.loteId}
                  </span>
                </p>
                <p className="text-gray-700">Tipo de Lote: <span className="font-semibold text-gray-800">{comprobanteSeleccionado.tipo}</span></p>
                <p className="text-gray-700">Categoría Carga: <span className="font-semibold text-gray-800">{comprobanteSeleccionado.categoria}</span></p>
                <p className="text-gray-700">Tratamiento de Semilla: <span className="font-semibold text-gray-800">{comprobanteSeleccionado.tratamiento}</span></p>
              </div>
            </div>

            {/* Tabla con bolsas y pesos */}
            <div className="border border-gray-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#00603C] text-white uppercase text-[9px] tracking-wider">
                    <th className="py-2.5 px-4 text-left">Descripción de Expedición</th>
                    <th className="py-2.5 px-4 text-center">Unidad de Envase</th>
                    <th className="py-2.5 px-4 text-right">Cantidad de Bolsas</th>
                    <th className="py-2.5 px-4 text-right">Peso Neto Totales (Kg)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {comprobanteSeleccionado.lotesOrigen && comprobanteSeleccionado.lotesOrigen.length > 0 ? (
                    comprobanteSeleccionado.lotesOrigen.map((lo, idx) => (
                      <tr key={idx}>
                        <td className="py-3 px-4 text-gray-900">
                          <span className="font-bold block">Expedición de Semillas Clasificadas</span>
                          <span className="text-[10px] text-gray-400">Origen Lote: <span className="font-bold font-mono">{lo.loteNro}</span></span>
                        </td>
                        <td className="py-3 px-4 text-center text-gray-600">Bolsa Standard</td>
                        <td className="py-3 px-4 text-right font-bold text-gray-900">{lo.cantidadBolsas} bolsas</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[#00603C] text-sm">
                          {formatNumberArg(lo.kgTotales, 0)} kg
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="py-3 px-4 text-gray-900">
                        <span className="font-bold block">Expedición de Semillas Clasificadas</span>
                        <span className="text-[10px] text-gray-400">Origen Lote {comprobanteSeleccionado.loteId}</span>
                      </td>
                      <td className="py-3 px-4 text-center text-gray-600">Bolsa Standard</td>
                      <td className="py-3 px-4 text-right font-bold text-gray-900">{comprobanteSeleccionado.cantidadBolsas} bolsas</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-[#00603C] text-sm">
                        {formatNumberArg(comprobanteSeleccionado.kgTotales, 0)} kg
                      </td>
                    </tr>
                  )}
                </tbody>
                {comprobanteSeleccionado.lotesOrigen && comprobanteSeleccionado.lotesOrigen.length > 0 && (
                  <tfoot>
                    <tr className="bg-gray-50 border-t border-gray-200 font-bold">
                      <td colSpan={2} className="py-3 px-4 text-[#00603C] text-[10px] uppercase tracking-wider">
                        Total General Despacho
                      </td>
                      <td className="py-3 px-4 text-right text-gray-900">
                        {comprobanteSeleccionado.cantidadBolsas} bolsas
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-[#00603C] text-sm">
                        {formatNumberArg(comprobanteSeleccionado.kgTotales, 0)} kg
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Adjuntos: Foto remito y Firma */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-3 border-t border-gray-100">
              
              <div className="space-y-1.5 text-center">
                <span className="text-[9px] font-bold text-[#C9922E] uppercase tracking-wider block text-left">
                  Copia de Remito de Salida Firmado
                </span>
                {comprobanteSeleccionado.fotoRemito || tempFotos[comprobanteSeleccionado.id] ? (
                  <div className="border border-gray-200 p-2 rounded-xl bg-gray-50 flex items-center justify-center">
                    <img
                      src={comprobanteSeleccionado.fotoRemito || tempFotos[comprobanteSeleccionado.id]}
                      alt="Remito Físico"
                      className="max-h-28 object-contain rounded border border-gray-200 shadow-sm"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div className="border border-dashed border-gray-200 p-6 text-center text-gray-400 rounded-xl">
                    No se adjuntó remito
                  </div>
                )}
              </div>

              <div className="space-y-1.5 flex flex-col justify-between">
                <div>
                  <span className="text-[9px] font-bold text-[#C9922E] uppercase tracking-wider block">
                    Conformidad del Conductor / Transportista
                  </span>
                  {comprobanteSeleccionado.firmaChofer || tempFirmas[comprobanteSeleccionado.id] ? (
                    <div className="border border-gray-200 p-1.5 rounded-xl bg-gray-50 flex items-center justify-center mt-1">
                      <img
                        src={comprobanteSeleccionado.firmaChofer || tempFirmas[comprobanteSeleccionado.id]}
                        alt="Firma Chofer"
                        className="h-16 object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : (
                    <div className="border border-dashed border-gray-200 p-4 text-center text-gray-400 rounded-xl mt-1">
                      Falta firmar conforme
                    </div>
                  )}
                </div>

                <div className="text-center text-[9px] text-gray-400 border-t border-gray-200 pt-1">
                  <p className="font-bold text-gray-600">Chofer Conductor / Recibí Conforme</p>
                  <p>Autorizado en playa por {comprobanteSeleccionado.despachante}</p>
                </div>
              </div>

            </div>

            {/* Footer de Comprobante */}
            <div className="border-t border-gray-100 pt-4 flex justify-between items-center text-[10px] text-gray-400 italic">
              <span>Agro Abacus S.A. · Control de Expedición Playa</span>
              <span>Constancia de Operaciones Digitales</span>
            </div>

            {/* Acciones del Comprobante */}
            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 print:hidden">
              <button
                onClick={() => setComprobanteSeleccionado(null)}
                className="px-5 py-2 text-xs font-bold uppercase tracking-wider text-gray-500 hover:bg-gray-100 rounded-xl transition"
              >
                Cerrar Vista
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-6 py-2 bg-[#00603C] hover:bg-[#254731] text-white font-bold uppercase tracking-wider text-xs rounded-xl transition shadow-md"
              >
                <Printer className="w-4 h-4 text-[#C9922E]" />
                Imprimir Comprobante
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL PARA AGREGAR DESPACHANTE AUTORIZADO */}
      {showAddDespModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-left">
            
            {/* Header del Modal */}
            <div className="bg-[#00603C] text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl">
                  <UserPlus className="w-5 h-5 text-[#F6EFDC]" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base tracking-wide">Agregar Despachante Autorizado</h3>
                  <p className="text-[11px] text-emerald-100 font-sans">
                    Requiere clave de Malcon Baez o Amilcar Quiroz
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddDespModal(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleAgregarDespachante} className="p-6 space-y-4 text-xs">
              {addDespError && (
                <div className="bg-[#F5E5DC] text-[#A0522D] p-3 rounded-xl flex items-center gap-2 text-xs border border-red-200">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{addDespError}</span>
                </div>
              )}

              {addDespSuccess && (
                <div className="bg-[#E3EFE7] text-[#00603C] p-3 rounded-xl flex items-center gap-2 text-xs border border-emerald-200 font-bold">
                  <Check className="w-4 h-4 shrink-0 text-[#00603C]" />
                  <span>{addDespSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Nombre Completo del Despachante *
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={addDespNombre}
                    onChange={(e) => setAddDespNombre(e.target.value)}
                    placeholder="ej: Manuel Gomez Riquel"
                    className="w-full pl-9 pr-3 h-10 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00603C] text-xs font-semibold text-gray-800"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Usuario Autorizador *
                </label>
                <select
                  value={addDespAutor}
                  onChange={(e) => setAddDespAutor(e.target.value as any)}
                  className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00603C] text-xs font-semibold"
                >
                  <option value="Malcon Baez">Malcon Baez (Jefe de Planta)</option>
                  <option value="Amilcar Quiroz">Amilcar Quiroz (Logística)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Clave de Autorización de {addDespAutor} *
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={addDespClave}
                    onChange={(e) => setAddDespClave(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-10 pl-3 pr-8 bg-[#F5E5DC] bg-opacity-40 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#A0522D] text-xs font-medium"
                    required
                  />
                  <Lock className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-3 pointer-events-none" />
                </div>
                <p className="text-[10px] text-gray-500 mt-1.5 leading-relaxed">
                  Para dar de alta nuevos despachantes autorizados en la planta se requiere validar la clave del usuario {addDespAutor}.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddDespModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#00603C] hover:bg-[#254731] text-white font-bold rounded-lg shadow-sm transition flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4 text-[#C9922E]" />
                  <span>Autorizar y Registrar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
