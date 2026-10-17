/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Lote, ReporteDiario, BolsaRegistro, CategoriaType, TipoLoteType } from '../types';
import { formatKg, formatNumberArg } from '../utils/formatters';
import { normalizarTratamiento, puedeOperarLote, normalizarEstado, getKilajeEnvase, getBolsasDeLote } from '../utils/loteEspecUtils';
import {
  Calendar,
  Factory,
  FlaskConical,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Search,
  User,
  Plus,
  Package,
  Filter,
  CheckSquare,
  Square,
  Boxes,
  CheckCheck,
  RotateCcw,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp,
  PackagePlus,
  Check,
  X
} from 'lucide-react';

interface CargaReporteDiarioProps {
  lotes: Lote[];
  currentUser: { nombre: string; rol: string };
  onGuardarReporte: (
    reporte: Omit<ReporteDiario, 'id'>,
    extras?: {
      sigueEnProceso?: boolean;
      cambiarAClasificado?: boolean;
      productoCurado?: string;
      bolsasCuradas?: number;
      bolsasSeleccionadasIds?: string[];
      nuevasBolsasACargar?: BolsaRegistro[];
    }
  ) => Promise<void> | void;
}

export const CargaReporteDiario: React.FC<CargaReporteDiarioProps> = ({
  lotes,
  currentUser,
  onGuardarReporte,
}) => {
  const [tipo, setTipo] = useState<'produccion' | 'curado'>('produccion');
  const [fecha, setFecha] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedLoteId, setSelectedLoteId] = useState<string>('');
  const [bolsasProducidas, setBolsasProducidas] = useState<number>(0);
  const [kg, setKg] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Estados específicos para carga diaria de PRODUCCIÓN
  const [marcarComoClasificado, setMarcarComoClasificado] = useState<boolean>(true);
  const [confirmarAlertaExceso, setConfirmarAlertaExceso] = useState<boolean>(false);

  // 2. Estados específicos para carga diaria de CURADO
  const [filtroClienteCurado, setFiltroClienteCurado] = useState<string>('todos');
  const [filtroVariedadCurado, setFiltroVariedadCurado] = useState<string>('todos');
  const [productoTratamiento, setProductoTratamiento] = useState<string>('');

  // 3. Estados para gestión interactiva de BOLSAS POR LOTE
  const [bolsasLocales, setBolsasLocales] = useState<BolsaRegistro[]>([]);
  const [selectedBolsasIds, setSelectedBolsasIds] = useState<Set<string>>(new Set());
  const [nuevasBolsasCreadas, setNuevasBolsasCreadas] = useState<BolsaRegistro[]>([]);
  const [filtroBolsasVista, setFiltroBolsasVista] = useState<'todas' | 'seleccionadas' | 'sin_curar' | 'curadas' | 'pendientes'>('todas');
  const [searchBolsaTerm, setSearchBolsaTerm] = useState<string>('');

  // 4. Modal / Drawer para Cargar Nuevas Bolsas al lote
  const [showAgregarBolsas, setShowAgregarBolsas] = useState(false);
  const [nuevasCount, setNuevasCount] = useState<number>(5);
  const [nuevasKg, setNuevasKg] = useState<number>(800);
  const [nuevasEnvase, setNuevasEnvase] = useState<string>('x 800 kg');
  const [nuevasTipo, setNuevasTipo] = useState<TipoLoteType>('Final');
  const [nuevasCategoria, setNuevasCategoria] = useState<CategoriaType>('Original');

  // Sugerencias de productos habituales de curado
  const PRODUCTOS_CURADO_SUGERIDOS = [
    'Maxim XL',
    'Cruiser 350 FS',
    'Fortenza Duo',
    'Vibrance Integral',
    'Rizoderma',
    'Signum 420',
    'Vitavax Plus',
    'Inoculante Líquido',
    'Polímero Colorante'
  ];

  // Listados únicos de clientes y variedades para los filtros de curado
  const clientesDisponibles = useMemo(() => {
    return Array.from(new Set(lotes.map(l => l.cliente).filter(Boolean))).sort();
  }, [lotes]);

  const variedadesDisponibles = useMemo(() => {
    const list = lotes
      .filter(l => filtroClienteCurado === 'todos' || l.cliente === filtroClienteCurado)
      .map(l => l.variedad)
      .filter(Boolean);
    return Array.from(new Set(list)).sort();
  }, [lotes, filtroClienteCurado]);

  // Lotes disponibles para reporte según el tipo seleccionado
  const lotesDisponibles = useMemo(() => {
    return lotes.filter(l => {
      const op = puedeOperarLote(l);
      if (!op.permitido) return false;
      const estadoNorm = normalizarEstado(l.estadoEspec || l.estado, l.estadoRegistro);
      const tratNorm = normalizarTratamiento(l.tratamiento);

      if (tipo === 'produccion') {
        // En producción: lotes en estado "sin clasificar"
        return estadoNorm === 'sin clasificar';
      }

      if (tipo === 'curado') {
        // En curado: todos aquellos lotes que figuren en tratamiento "sin curar" (o "crudo")
        const esSinCurar = tratNorm === 'sin curar' || tratNorm === 'crudo';
        if (!esSinCurar) return false;

        // Filtro de cliente
        if (filtroClienteCurado !== 'todos' && l.cliente !== filtroClienteCurado) {
          return false;
        }

        // Filtro de variedad
        if (filtroVariedadCurado !== 'todos' && l.variedad !== filtroVariedadCurado) {
          return false;
        }

        return true;
      }

      return true;
    });
  }, [lotes, tipo, filtroClienteCurado, filtroVariedadCurado]);

  // Filtrado por buscador de texto
  const lotesFiltrados = useMemo(() => {
    if (!searchTerm.trim()) return lotesDisponibles;
    const q = searchTerm.toLowerCase();
    return lotesDisponibles.filter(l =>
      (l.codigo || l.loteNro || '').toLowerCase().includes(q) ||
      (l.cliente || '').toLowerCase().includes(q) ||
      (l.variedad || '').toLowerCase().includes(q)
    );
  }, [lotesDisponibles, searchTerm]);

  // Lote actualmente seleccionado
  const loteSeleccionado = useMemo(() => {
    return lotes.find(l => l.id === selectedLoteId);
  }, [lotes, selectedLoteId]);

  // Kilaje de envase del lote seleccionado (20, 25, 40 u 800 kg)
  const kgEnvase = useMemo(() => {
    if (!loteSeleccionado) return 800;
    return getKilajeEnvase(loteSeleccionado.envase || loteSeleccionado.kgPorBolsa);
  }, [loteSeleccionado]);

  // Sincronizar bolsas al seleccionar un lote o cambiar tipo
  useEffect(() => {
    if (loteSeleccionado) {
      const bolsas = getBolsasDeLote(loteSeleccionado);
      setBolsasLocales(bolsas);
      setNuevasBolsasCreadas([]);
      setNuevasKg(loteSeleccionado.kgPorBolsa || kgEnvase || 800);
      setNuevasEnvase(loteSeleccionado.envase || `x ${loteSeleccionado.kgPorBolsa || 800} kg`);
      setNuevasTipo((loteSeleccionado.tipo as TipoLoteType) || 'Final');
      setNuevasCategoria((loteSeleccionado.categoria as CategoriaType) || 'Original');

      if (tipo === 'curado') {
        const sinCurarBolsas = bolsas.filter(b => normalizarTratamiento(b.tratamiento) !== 'curado');
        const initialSet = new Set(sinCurarBolsas.map(b => b.id));
        setSelectedBolsasIds(initialSet);
        setBolsasProducidas(initialSet.size);
        const sumKg = sinCurarBolsas.reduce((acc, b) => acc + (b.kg || kgEnvase), 0);
        setKg(sumKg);
      } else {
        // En producción: preferir bolsas en 'sin clasificar'
        const pendientes = bolsas.filter(b => b.estado !== 'clasificado');
        const listToSelect = pendientes.length > 0 ? pendientes : bolsas;
        const initialSet = new Set(listToSelect.map(b => b.id));
        setSelectedBolsasIds(initialSet);
        setBolsasProducidas(initialSet.size);
        const sumKg = listToSelect.reduce((acc, b) => acc + (b.kg || kgEnvase), 0);
        setKg(sumKg);
      }
    } else {
      setBolsasLocales([]);
      setSelectedBolsasIds(new Set());
      setNuevasBolsasCreadas([]);
      setBolsasProducidas(0);
      setKg(0);
    }
  }, [selectedLoteId, tipo]);

  // Bolsas sin curar del lote seleccionado
  const bolsasSinCurarLote = useMemo(() => {
    return bolsasLocales.filter(b => normalizarTratamiento(b.tratamiento) !== 'curado').length;
  }, [bolsasLocales]);

  // Toggle individual de una bolsa
  const toggleBolsaSelection = (bolsaId: string) => {
    setSelectedBolsasIds(prev => {
      const next = new Set(prev);
      if (next.has(bolsaId)) {
        next.delete(bolsaId);
      } else {
        next.add(bolsaId);
      }
      const selBolsas = bolsasLocales.filter(b => next.has(b.id));
      setBolsasProducidas(selBolsas.length);
      const totalKilos = selBolsas.reduce((acc, b) => acc + (b.kg || kgEnvase), 0);
      setKg(totalKilos);
      return next;
    });
  };

  // Seleccionar todas las bolsas elegibles
  const handleSelectAllBolsas = () => {
    const elegibles = tipo === 'curado'
      ? bolsasLocales.filter(b => normalizarTratamiento(b.tratamiento) !== 'curado')
      : bolsasLocales;
    const next = new Set(elegibles.map(b => b.id));
    setSelectedBolsasIds(next);
    setBolsasProducidas(next.size);
    const totalKilos = elegibles.reduce((acc, b) => acc + (b.kg || kgEnvase), 0);
    setKg(totalKilos);
  };

  // Deseleccionar todas
  const handleDeselectAllBolsas = () => {
    setSelectedBolsasIds(new Set());
    setBolsasProducidas(0);
    setKg(0);
  };

  // Seleccionar primeras N bolsas
  const handleSelectPrimerasNBolsas = (n: number) => {
    const count = Math.max(0, n);
    const elegibles = tipo === 'curado'
      ? bolsasLocales.filter(b => normalizarTratamiento(b.tratamiento) !== 'curado')
      : bolsasLocales;
    const toSelect = new Set(elegibles.slice(0, count).map(b => b.id));
    setSelectedBolsasIds(toSelect);
    setBolsasProducidas(toSelect.size);
    const totalKilos = elegibles.slice(0, count).reduce((acc, b) => acc + (b.kg || kgEnvase), 0);
    setKg(totalKilos);
  };

  // Manejo de cambio manual en input de bolsas
  const handleBolsasChange = (val: number) => {
    const b = Math.max(0, val);
    setBolsasProducidas(b);
    if (loteSeleccionado && bolsasLocales.length > 0) {
      const elegibles = tipo === 'curado'
        ? bolsasLocales.filter(x => normalizarTratamiento(x.tratamiento) !== 'curado')
        : bolsasLocales;
      const toSelect = new Set(elegibles.slice(0, b).map(x => x.id));
      setSelectedBolsasIds(toSelect);
      const sumKg = elegibles.slice(0, b).reduce((acc, x) => acc + (x.kg || kgEnvase), 0);
      setKg(sumKg || (b * kgEnvase));
    } else {
      setKg(b * kgEnvase);
    }
  };

  // Manejo de cambio manual en input de kg
  const handleKgChange = (val: number) => {
    const k = Math.max(0, val);
    setKg(k);
    if (kgEnvase > 0) {
      const cant = Math.floor(k / kgEnvase);
      setBolsasProducidas(cant);
      if (loteSeleccionado && bolsasLocales.length > 0) {
        const elegibles = tipo === 'curado'
          ? bolsasLocales.filter(x => normalizarTratamiento(x.tratamiento) !== 'curado')
          : bolsasLocales;
        const toSelect = new Set(elegibles.slice(0, cant).map(x => x.id));
        setSelectedBolsasIds(toSelect);
      }
    }
  };

  // Agregar nuevas bolsas al lote seleccionado
  const handleConfirmarNuevasBolsas = () => {
    if (nuevasCount <= 0 || !loteSeleccionado) return;
    const codigo = (loteSeleccionado.codigo || loteSeleccionado.loteNro || loteSeleccionado.id).trim();
    const startNum = bolsasLocales.length + 1;
    const totalEstimado = bolsasLocales.length + nuevasCount;
    const nuevas: BolsaRegistro[] = [];

    for (let i = 0; i < nuevasCount; i++) {
      const num = startNum + i;
      const newId = `${codigo}-${String(num).padStart(2, '0')}/${String(totalEstimado).padStart(2, '0')}`;
      nuevas.push({
        id: newId,
        loteId: loteSeleccionado.id,
        numero: num,
        totalBolsas: totalEstimado,
        kg: nuevasKg,
        envase: nuevasEnvase,
        tipo: (nuevasTipo.toLowerCase() as any) || 'final',
        categoria: (nuevasCategoria.toLowerCase() as any) || 'original',
        tratamiento: 'sin curar',
        estado: tipo === 'produccion' ? (marcarComoClasificado ? 'clasificado' : 'sin clasificar') : 'sin clasificar',
        despachada: false,
        caratulaId: loteSeleccionado.caratulaId || `CARAT-${loteSeleccionado.id}`
      });
    }

    const updatedBolsas = [...bolsasLocales, ...nuevas];
    setBolsasLocales(updatedBolsas);
    setNuevasBolsasCreadas(prev => [...prev, ...nuevas]);

    // Seleccionar automáticamente las nuevas bolsas añadidas
    setSelectedBolsasIds(prev => {
      const next = new Set(prev);
      nuevas.forEach(b => next.add(b.id));
      const selList = updatedBolsas.filter(b => next.has(b.id));
      setBolsasProducidas(selList.length);
      setKg(selList.reduce((acc, b) => acc + (b.kg || kgEnvase), 0));
      return next;
    });

    setShowAgregarBolsas(false);
  };

  // Alerta de exceso: supera 28.000 kg o 35 bolsas
  const superaLimiteClasificadas = useMemo(() => {
    if (tipo !== 'produccion') return false;
    return kg > 28000 || bolsasProducidas > 35;
  }, [tipo, kg, bolsasProducidas]);

  // Bolsas filtradas para mostrar en el visor de bolsas
  const bolsasParaMostrar = useMemo(() => {
    return bolsasLocales.filter(b => {
      // Filtro por texto
      if (searchBolsaTerm.trim()) {
        const q = searchBolsaTerm.toLowerCase();
        const numStr = String(b.numero);
        if (!b.id.toLowerCase().includes(q) && !numStr.includes(q)) {
          return false;
        }
      }

      // Filtro por estado / vista
      if (filtroBolsasVista === 'seleccionadas') {
        return selectedBolsasIds.has(b.id);
      }
      if (filtroBolsasVista === 'sin_curar') {
        return normalizarTratamiento(b.tratamiento) !== 'curado';
      }
      if (filtroBolsasVista === 'curadas') {
        return normalizarTratamiento(b.tratamiento) === 'curado';
      }
      if (filtroBolsasVista === 'pendientes') {
        return b.estado !== 'clasificado';
      }
      return true;
    });
  }, [bolsasLocales, searchBolsaTerm, filtroBolsasVista, selectedBolsasIds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!selectedLoteId) {
      setErrorMsg('Debe seleccionar un lote específico.');
      return;
    }
    if (!loteSeleccionado) {
      setErrorMsg('El lote seleccionado no es válido.');
      return;
    }
    if (kg <= 0 && bolsasProducidas <= 0) {
      setErrorMsg('Debe seleccionar o ingresar una cantidad de bolsas o kilogramos válida mayor a cero.');
      return;
    }

    // Validación de Curado
    if (tipo === 'curado') {
      if (!productoTratamiento.trim()) {
        setErrorMsg('Debe especificar el producto curasemilla utilizado para el tratamiento.');
        return;
      }
      if (bolsasProducidas <= 0) {
        setErrorMsg('En el curado diario debe seleccionar o ingresar la cantidad exacta de bolsas curadas.');
        return;
      }
      if (bolsasProducidas > bolsasSinCurarLote && bolsasSinCurarLote > 0 && selectedBolsasIds.size === 0) {
        setErrorMsg(
          `Validación: La cantidad de bolsas a curar (${bolsasProducidas}) supera las bolsas sin curar disponibles en el lote (${bolsasSinCurarLote} bolsas).`
        );
        return;
      }
    }

    // Alerta de Producción > 28.000 kg o > 35 bolsas
    if (superaLimiteClasificadas && !confirmarAlertaExceso) {
      const confirmOk = window.confirm(
        `⚠️ ALERTA DE PRODUCCIÓN:\nLa cantidad de bolsas a dar de alta como clasificadas (${bolsasProducidas} bolsas / ${formatKg(kg)}) supera el límite estándar de 28.000 kg o 35 bolsas.\n\n¿Desea confirmar y proceder con el alta de este volumen?`
      );
      if (!confirmOk) {
        setErrorMsg('Operación cancelada por el usuario tras la alerta de volumen excedente.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const finalBolsas = bolsasProducidas > 0 ? bolsasProducidas : (kgEnvase > 0 ? Math.floor(kg / kgEnvase) : 0);
      const listaIdsSeleccionadas = Array.from(selectedBolsasIds);

      await onGuardarReporte(
        {
          fecha,
          tipo,
          kg: Number(kg),
          bolsas: Number(finalBolsas),
          loteId: loteSeleccionado.id,
          usuario: currentUser?.nombre || 'Operador',
          codigoLote: loteSeleccionado.codigo || loteSeleccionado.loteNro,
          cliente: loteSeleccionado.cliente,
          variedad: loteSeleccionado.variedad,
          especie: loteSeleccionado.especie,
          producto: tipo === 'curado' ? productoTratamiento.trim() : undefined,
        },
        {
          sigueEnProceso: !marcarComoClasificado,
          cambiarAClasificado: tipo === 'produccion' ? marcarComoClasificado : false,
          productoCurado: tipo === 'curado' ? productoTratamiento.trim() : undefined,
          bolsasCuradas: finalBolsas,
          bolsasSeleccionadasIds: listaIdsSeleccionadas,
          nuevasBolsasACargar: nuevasBolsasCreadas.length > 0 ? nuevasBolsasCreadas : undefined,
        }
      );

      const msg =
        tipo === 'produccion'
          ? `¡Reporte diario de PRODUCCIÓN guardado con éxito! Lote #${loteSeleccionado.codigo || loteSeleccionado.loteNro}: ${finalBolsas} bolsa(s) (${formatKg(kg)}) cargadas el día ${fecha}. ${marcarComoClasificado ? 'Lote y bolsas pasaron a CLASIFICADO.' : 'Lote continúa en estado SIN CLASIFICAR.'}`
          : `¡Reporte diario de CURADO guardado con éxito! Lote #${loteSeleccionado.codigo || loteSeleccionado.loteNro}: ${finalBolsas} bolsa(s) (${formatKg(kg)}) curadas con ${productoTratamiento.trim()} el día ${fecha}.`;

      setSuccessMsg(msg);
      setKg(0);
      setBolsasProducidas(0);
      setSelectedBolsasIds(new Set());
      setNuevasBolsasCreadas([]);
      setProductoTratamiento('');
      setConfirmarAlertaExceso(false);
      setTimeout(() => setSuccessMsg(''), 7000);
    } catch (err: any) {
      console.error('Error guardando reporte diario:', err);
      setErrorMsg(err.message || 'Error al guardar reporte diario.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-6 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#00603C]">
            Carga Diaria de Operaciones
          </span>
          <h3 className="font-serif text-xl font-bold text-gray-900 mt-0.5 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#00603C]" />
            <span>Carga de Reporte Diario (Producción y Curado)</span>
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Se cargan por día y contra un lote específico. Carga y selección bolsa por bolsa con sincronización en tiempo real.
          </p>
        </div>

        {/* Selector de Tipo */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-center">
          <button
            type="button"
            onClick={() => {
              setTipo('produccion');
              setSelectedLoteId('');
              setKg(0);
              setBolsasProducidas(0);
              setSelectedBolsasIds(new Set());
              setNuevasBolsasCreadas([]);
              setErrorMsg('');
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              tipo === 'produccion'
                ? 'bg-[#00603C] text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Factory className="w-3.5 h-3.5" />
            <span>Producción</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTipo('curado');
              setSelectedLoteId('');
              setKg(0);
              setBolsasProducidas(0);
              setSelectedBolsasIds(new Set());
              setNuevasBolsasCreadas([]);
              setErrorMsg('');
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              tipo === 'curado'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span>Curado</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* FILTROS ESPECÍFICOS DE CURADO */}
        {tipo === 'curado' && (
          <div className="bg-purple-50/70 border border-purple-200 p-3.5 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-purple-900 text-xs font-bold">
              <Filter className="w-4 h-4 text-purple-700" />
              <span>Filtros de Búsqueda para Curado (Lotes Sin Curar)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-purple-800 mb-1">
                  Cliente
                </label>
                <select
                  value={filtroClienteCurado}
                  onChange={(e) => {
                    setFiltroClienteCurado(e.target.value);
                    setFiltroVariedadCurado('todos');
                    setSelectedLoteId('');
                  }}
                  className="w-full px-3 py-2 bg-white border border-purple-200 rounded-xl font-bold text-gray-800 focus:outline-none focus:ring-1 focus:ring-purple-600"
                >
                  <option value="todos">Todos los Clientes ({clientesDisponibles.length})</option>
                  {clientesDisponibles.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-purple-800 mb-1">
                  Variedad
                </label>
                <select
                  value={filtroVariedadCurado}
                  onChange={(e) => {
                    setFiltroVariedadCurado(e.target.value);
                    setSelectedLoteId('');
                  }}
                  className="w-full px-3 py-2 bg-white border border-purple-200 rounded-xl font-bold text-gray-800 focus:outline-none focus:ring-1 focus:ring-purple-600"
                >
                  <option value="todos">Todas las Variedades ({variedadesDisponibles.length})</option>
                  {variedadesDisponibles.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-purple-800 mb-1">
                  Producto Curasemilla Utilizado *
                </label>
                <input
                  type="text"
                  list="sugerencias-curado"
                  value={productoTratamiento}
                  onChange={(e) => setProductoTratamiento(e.target.value)}
                  placeholder="Ej: Maxim XL, Cruiser..."
                  className="w-full px-3 py-2 bg-white border border-purple-300 rounded-xl font-bold text-purple-950 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required={tipo === 'curado'}
                />
                <datalist id="sugerencias-curado">
                  {PRODUCTOS_CURADO_SUGERIDOS.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>
            </div>
          </div>
        )}

        {/* SELECTOR DE LOTE ESPECÍFICO */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-gray-700 uppercase">
              {tipo === 'produccion'
                ? '1. Seleccionar Lote en "Sin Clasificar" *'
                : '1. Seleccionar Lote en "Sin Curar" *'}
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar lote..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg w-44 focus:bg-white"
              />
            </div>
          </div>

          {lotesFiltrados.length === 0 ? (
            <div className="p-5 text-center bg-gray-50 border border-gray-200 rounded-2xl text-xs text-gray-500">
              {tipo === 'produccion'
                ? 'No se encontraron lotes en estado "sin clasificar" que coincidan con la búsqueda.'
                : 'No se encontraron lotes con tratamiento "sin curar" que coincidan con los filtros seleccionados.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-52 overflow-y-auto pr-1">
              {lotesFiltrados.map((l) => {
                const isSelected = selectedLoteId === l.id;
                const trat = normalizarTratamiento(l.tratamiento);
                const kgLote = Number(l.kg) || Number(l.stockKg) || 0;
                const estNorm = normalizarEstado(l.estadoEspec || l.estado, l.estadoRegistro);

                return (
                  <div
                    key={l.id}
                    onClick={() => setSelectedLoteId(l.id)}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition flex flex-col justify-between ${
                      isSelected
                        ? tipo === 'produccion'
                          ? 'bg-emerald-50 border-[#00603C] text-emerald-950 ring-2 ring-emerald-400 shadow-sm'
                          : 'bg-purple-50 border-purple-700 text-purple-950 ring-2 ring-purple-400 shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-gray-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-gray-900">
                        #{l.codigo || l.loteNro}
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded capitalize ${
                        estNorm === 'clasificado'
                          ? 'bg-emerald-100 text-emerald-900'
                          : estNorm === 'bloqueado'
                          ? 'bg-red-100 text-red-900'
                          : estNorm === 'descartado'
                          ? 'bg-slate-200 text-slate-800'
                          : 'bg-amber-100 text-amber-900'
                      }`}>
                        {estNorm}
                      </span>
                    </div>

                    <div className="mt-1 text-[11px] text-gray-600 truncate">
                      {l.cliente} · {l.variedad}
                    </div>

                    <div className="mt-2 pt-1 border-t border-gray-200/60 flex items-center justify-between text-[10px] font-mono">
                      <span className="text-gray-500">
                        {tipo === 'curado' ? 'Tratamiento:' : 'Stock Lote:'}
                      </span>
                      <span className="font-bold text-gray-900">
                        {tipo === 'curado' ? trat : formatKg(kgLote)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* DETALLE DEL LOTE SELECCIONADO Y CARGA DE BOLSAS */}
        {loteSeleccionado && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Header del lote seleccionado */}
            <div className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 text-xs ${
              tipo === 'produccion'
                ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                : 'bg-purple-50/60 border-purple-200 text-purple-950'
            }`}>
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-500 block">Lote Activo para Carga</span>
                <span className="font-bold text-sm text-gray-900">
                  #{loteSeleccionado.codigo || loteSeleccionado.loteNro} — {loteSeleccionado.cliente} ({loteSeleccionado.especie} {loteSeleccionado.variedad})
                </span>
                <span className="text-[11px] text-gray-600 block mt-0.5">
                  Envase: <strong>{loteSeleccionado.envase || `${kgEnvase} kg`}</strong> · Total bolsas en lote: <strong>{bolsasLocales.length}</strong>
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-gray-500 block">
                  {tipo === 'curado' ? 'Bolsas Sin Curar Disponibles' : 'Bolsas Pendientes'}
                </span>
                <span className="font-mono font-black text-sm text-gray-900">
                  {tipo === 'curado'
                    ? `${bolsasSinCurarLote} bolsas (${formatKg(bolsasSinCurarLote * kgEnvase)})`
                    : `${bolsasLocales.filter(b => b.estado !== 'clasificado').length} bolsas`}
                </span>
              </div>
            </div>

            {/* SECCIÓN INTERACTIVA: CARGAR BOLSAS POR LOTE */}
            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl text-white ${
                    tipo === 'produccion' ? 'bg-[#00603C]' : 'bg-purple-700'
                  }`}>
                    <Boxes className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                      <span>Cargar Bolsas por Lote</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-200 text-slate-800">
                        {selectedBolsasIds.size} de {bolsasLocales.length} seleccionadas
                      </span>
                    </h4>
                    <p className="text-[11px] text-gray-500">
                      Haga clic en cada bolsa para seleccionarla o deseleccionarla para este reporte.
                    </p>
                  </div>
                </div>

                {/* Acciones Rápidas de Selección */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllBolsas}
                    className="px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    title="Seleccionar todas las bolsas"
                  >
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Todas</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAllBolsas}
                    className="px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    title="Deseleccionar todas"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                    <span>Ninguna</span>
                  </button>

                  {/* Botón para abrir modal de agregar nuevas bolsas al lote (Producción) */}
                  {tipo === 'produccion' && (
                    <button
                      type="button"
                      onClick={() => setShowAgregarBolsas(prev => !prev)}
                      className="px-3 py-1.5 bg-[#00603C] hover:bg-[#254731] text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5 text-amber-300" />
                      <span>Cargar Nuevas Bolsas</span>
                      {showAgregarBolsas ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  )}
                </div>
              </div>

              {/* Subformulario inline: Cargar nuevas bolsas al lote */}
              {showAgregarBolsas && tipo === 'produccion' && (
                <div className="bg-white border-2 border-emerald-500/50 rounded-2xl p-4 space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-900 uppercase flex items-center gap-1.5">
                      <PackagePlus className="w-4 h-4 text-emerald-600" />
                      <span>Cargar y Generar Nuevas Bolsas para #{loteSeleccionado.codigo || loteSeleccionado.loteNro}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAgregarBolsas(false)}
                      className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      Cerrar
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-700 uppercase mb-1">
                        Cantidad Bolsas *
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={nuevasCount}
                        onChange={(e) => setNuevasCount(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-700 uppercase mb-1">
                        Kg por Bolsa *
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={nuevasKg}
                        onChange={(e) => setNuevasKg(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-700 uppercase mb-1">
                        Tipo
                      </label>
                      <select
                        value={nuevasTipo}
                        onChange={(e) => setNuevasTipo(e.target.value as TipoLoteType)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold"
                      >
                        <option value="Final">Final</option>
                        <option value="Intermedio">Intermedio</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-700 uppercase mb-1">
                        Categoría
                      </label>
                      <select
                        value={nuevasCategoria}
                        onChange={(e) => setNuevasCategoria(e.target.value as CategoriaType)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold"
                      >
                        <option value="Original">Original</option>
                        <option value="Primu">Primu</option>
                        <option value="Preba">Preba</option>
                        <option value="Comercial">Comercial</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] font-mono text-emerald-800">
                      Total a incorporar: <strong>{nuevasCount} bolsas</strong> ({formatKg(nuevasCount * nuevasKg)})
                    </span>
                    <button
                      type="button"
                      onClick={handleConfirmarNuevasBolsas}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Confirmar Carga de Bolsas al Lote</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Filtros de visualización y buscador de bolsas */}
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setFiltroBolsasVista('todas')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                      filtroBolsasVista === 'todas'
                        ? 'bg-slate-800 text-white shadow-2xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Todas ({bolsasLocales.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroBolsasVista('seleccionadas')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                      filtroBolsasVista === 'seleccionadas'
                        ? tipo === 'produccion' ? 'bg-[#00603C] text-white shadow-2xs' : 'bg-purple-700 text-white shadow-2xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Seleccionadas ({selectedBolsasIds.size})
                  </button>
                  {tipo === 'curado' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setFiltroBolsasVista('sin_curar')}
                        className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                          filtroBolsasVista === 'sin_curar'
                            ? 'bg-amber-600 text-white shadow-2xs'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        Sin Curar ({bolsasSinCurarLote})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFiltroBolsasVista('curadas')}
                        className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                          filtroBolsasVista === 'curadas'
                            ? 'bg-emerald-700 text-white shadow-2xs'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        Ya Curadas ({bolsasLocales.length - bolsasSinCurarLote})
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setFiltroBolsasVista('pendientes')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                        filtroBolsasVista === 'pendientes'
                          ? 'bg-amber-600 text-white shadow-2xs'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      Pendientes ({bolsasLocales.filter(b => b.estado !== 'clasificado').length})
                    </button>
                  )}
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filtrar bolsas (ej: 01, 15)..."
                    value={searchBolsaTerm}
                    onChange={(e) => setSearchBolsaTerm(e.target.value)}
                    className="pl-8 pr-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg w-48 focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              {/* GRID INTERACTIVO DE BOLSAS */}
              {bolsasParaMostrar.length === 0 ? (
                <div className="p-6 text-center bg-white border border-dashed border-slate-300 rounded-2xl text-xs text-slate-500">
                  No hay bolsas que coincidan con el filtro actual.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-64 overflow-y-auto pr-1">
                  {bolsasParaMostrar.map((b) => {
                    const isSelected = selectedBolsasIds.has(b.id);
                    const trat = normalizarTratamiento(b.tratamiento);
                    const esCurada = trat === 'curado';
                    const estadoNorm = normalizarEstado(b.estado);

                    return (
                      <div
                        key={b.id}
                        onClick={() => toggleBolsaSelection(b.id)}
                        className={`p-2.5 rounded-xl border text-xs cursor-pointer transition select-none flex flex-col justify-between ${
                          isSelected
                            ? tipo === 'produccion'
                              ? 'bg-emerald-50 border-emerald-500 text-emerald-950 ring-2 ring-emerald-400 shadow-2xs'
                              : 'bg-purple-50 border-purple-500 text-purple-950 ring-2 ring-purple-400 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}} // controlado por onClick del contenedor
                              className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                            <span className="font-mono font-bold text-slate-900 text-[11px]">
                              #{String(b.numero).padStart(2, '0')}
                            </span>
                          </div>
                          <span className="font-mono text-[10px] text-slate-500 font-bold">
                            {b.kg || kgEnvase} kg
                          </span>
                        </div>

                        <div className="text-[10px] font-mono text-slate-500 truncate" title={b.id}>
                          {b.id}
                        </div>

                        <div className="mt-2 pt-1 border-t border-slate-100 flex items-center justify-between gap-1 text-[9.5px]">
                          {tipo === 'curado' ? (
                            <span className={`px-1.5 py-0.2 rounded font-bold ${
                              esCurada
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              {esCurada ? 'Curada' : 'Sin Curar'}
                            </span>
                          ) : (
                            <span className={`px-1.5 py-0.2 rounded font-bold capitalize ${
                              estadoNorm === 'clasificado'
                                ? 'bg-emerald-100 text-emerald-800'
                                : estadoNorm === 'bloqueado'
                                ? 'bg-red-100 text-red-800'
                                : estadoNorm === 'descartado'
                                ? 'bg-slate-200 text-slate-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {estadoNorm}
                            </span>
                          )}

                          <span className="text-slate-400 uppercase font-semibold truncate">
                            {b.categoria || 'Original'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* INPUTS DE FECHA, BOLSAS, KG Y OPERADOR */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Fecha */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Fecha *
            </label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl text-gray-900 focus:bg-white"
              required
            />
          </div>

          {/* Bolsas */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              {tipo === 'produccion' ? 'Bolsas Producidas *' : 'Bolsas Curadas *'}
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                value={bolsasProducidas || ''}
                onChange={(e) => handleBolsasChange(Number(e.target.value))}
                placeholder={loteSeleccionado ? `ej: 10 (${kgEnvase} kg/b)` : 'ej: 10'}
                className="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl text-gray-900 focus:bg-white"
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-gray-400">
                BLS
              </span>
            </div>
            {loteSeleccionado && (
              <span className="text-[10px] text-gray-500 font-mono mt-0.5 block">
                Envase: {loteSeleccionado.envase || `${kgEnvase} kg`}
                {tipo === 'curado' && ` · Sin Curar: ${bolsasSinCurarLote} b.`}
              </span>
            )}
          </div>

          {/* Kilogramos */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              {tipo === 'produccion' ? 'Kg Producidos (Total) *' : 'Kg Curados (Total) *'}
            </label>
            <input
              type="number"
              min="1"
              value={kg || ''}
              onChange={(e) => handleKgChange(Number(e.target.value))}
              placeholder="ej: 8000"
              className="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl text-gray-900 focus:bg-white"
              required
            />
            {bolsasProducidas > 0 && kgEnvase > 0 && (
              <span className="text-[10px] text-emerald-700 font-mono mt-0.5 block">
                {bolsasProducidas} bolsas × {kgEnvase} kg = {formatKg(bolsasProducidas * kgEnvase)}
              </span>
            )}
          </div>

          {/* Usuario */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Usuario Operador
            </label>
            <div className="flex items-center gap-2 px-3 py-2 text-xs font-bold bg-slate-100 border border-slate-200 rounded-xl text-gray-700">
              <User className="w-3.5 h-3.5 text-gray-500" />
              <span>{currentUser?.nombre || 'Operador'}</span>
            </div>
          </div>
        </div>

        {/* ALERTA DE EXCESO DE 28.000 KG O 35 BOLSAS */}
        {superaLimiteClasificadas && (
          <div className="p-3.5 bg-amber-50 border-2 border-amber-400 text-amber-900 rounded-2xl text-xs space-y-1.5 shadow-sm">
            <div className="flex items-center gap-2 font-black text-amber-800">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <span>ALERTA DE CONTROL: Límite estándar superado (28.000 kg o 35 bolsas)</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              La cantidad a dar de alta como clasificada (<strong>{bolsasProducidas} bolsas</strong> / <strong>{formatKg(kg)}</strong>) supera el tope estándar recomendado para un lote unitario. Verifique si se trata de una jornada con múltiples baches o si debe desdoblar el ingreso.
            </p>
          </div>
        )}

        {/* BOTÓN "CLASIFICADO" (CAMBIA ESTADO A CLASIFICADO) */}
        {tipo === 'produccion' && (
          <div className="p-3.5 bg-emerald-50/60 rounded-2xl border border-emerald-200 flex items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                <span>Estado del lote al registrar la carga</span>
              </div>
              <p className="text-[11px] text-emerald-800">
                {marcarComoClasificado
                  ? 'Al guardar, el lote y sus bolsas pasarán a estado "clasificado".'
                  : 'El lote permanecerá en estado "sin clasificar".'}
              </p>
            </div>
            <button
              type="button"
              id="btn-cambiar-a-clasificado"
              onClick={() => setMarcarComoClasificado(prev => !prev)}
              className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 cursor-pointer transition border text-xs shrink-0 ${
                marcarComoClasificado
                  ? 'bg-emerald-700 hover:bg-emerald-800 text-white border-emerald-800 shadow-xs'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
              }`}
              title="Clasificado: cambia estado a clasificado"
            >
              {marcarComoClasificado ? (
                <>
                  <CheckSquare className="w-4 h-4 text-emerald-200" />
                  <span className="font-black uppercase tracking-wide">Clasificado</span>
                  <span className="text-[10px] font-normal text-emerald-100 hidden sm:inline">(cambia estado a clasificado)</span>
                </>
              ) : (
                <>
                  <Square className="w-4 h-4 text-slate-400" />
                  <span className="font-bold text-slate-700">Sin clasificar</span>
                  <span className="text-[10px] font-normal text-slate-400 hidden sm:inline">(clic para marcar Clasificado)</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* BOTÓN FINAL DE GUARDAR */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={!selectedLoteId || (kg <= 0 && bolsasProducidas <= 0) || isSubmitting}
            className={`px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-white shadow-md transition disabled:opacity-50 cursor-pointer flex items-center gap-2 ${
              tipo === 'produccion' ? 'bg-[#00603C] hover:bg-[#254731]' : 'bg-purple-700 hover:bg-purple-800'
            }`}
          >
            <Plus className="w-4 h-4 text-amber-300" />
            <span>{isSubmitting ? 'Registrando...' : `Cargar Reporte de ${tipo.toUpperCase()} (${bolsasProducidas} bolsas)`}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
