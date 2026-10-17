/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Lote, BolsaRegistro, EnvaseEspecificacion, CategoriaEspecificacion, TipoLoteEspecificacion } from '../types';
import { formatKg, formatNumberArg } from '../utils/formatters';
import {
  normalizarTratamiento,
  normalizarEnvase,
  normalizarCategoria,
  normalizarTipo,
  normalizarEstado,
  getKilajeEnvase,
  formatBolsaId,
  calcularResumenLoteDesdeBolsas,
} from '../utils/loteEspecUtils';
import {
  Package,
  ArrowRightLeft,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  CheckSquare,
  Square,
  FlaskConical,
  Sparkles,
  Tag,
  Scale,
  X,
  Layers,
  Info,
  Check
} from 'lucide-react';

interface VisorBolsasLoteProps {
  lote: Lote;
  bolsas: BolsaRegistro[];
  readOnly?: boolean;
  currentUser?: { nombre: string; rol: string };
  onUpdateBolsas: (nuevasBolsas: BolsaRegistro[], descripcionMovimiento: string) => Promise<void> | void;
  onVerQr: (bolsa: BolsaRegistro) => void;
}

export const VisorBolsasLote: React.FC<VisorBolsasLoteProps> = ({
  lote,
  bolsas,
  readOnly = false,
  currentUser,
  onUpdateBolsas,
  onVerQr,
}) => {
  // Selección múltiple de bolsas
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchBolsa, setSearchBolsa] = useState<string>('');
  const [filtroTratamiento, setFiltroTratamiento] = useState<string>('todos');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');

  // Modal de Movimiento de Bolsas
  const [showModalMovimiento, setShowModalMovimiento] = useState<boolean>(false);
  const [modalTab, setModalTab] = useState<'envase' | 'tipo' | 'curado' | 'categoria'>('envase');
  const [nuevoEnvase, setNuevoEnvase] = useState<EnvaseEspecificacion>('x 40 kg');
  const [nuevoTipo, setNuevoTipo] = useState<TipoLoteEspecificacion>('final');
  const [nuevoTratamiento, setNuevoTratamiento] = useState<'curado' | 'sin curar'>('curado');
  const [productoCurado, setProductoCurado] = useState<string>('Maxim XL');
  const [nuevaCategoria, setNuevaCategoria] = useState<CategoriaEspecificacion>('primu');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  // Resumen en vivo de lote calculado estrictamente desde sus bolsas
  const resumen = useMemo(() => {
    return calcularResumenLoteDesdeBolsas(bolsas, lote);
  }, [bolsas, lote]);

  // Bolsas filtradas para la tabla
  const bolsasFiltradas = useMemo(() => {
    return bolsas.filter((b) => {
      if (filtroTratamiento !== 'todos') {
        const trat = normalizarTratamiento(b.tratamiento);
        if (trat !== filtroTratamiento) return false;
      }
      if (filtroTipo !== 'todos') {
        const tip = normalizarTipo(b.tipo);
        if (tip !== filtroTipo) return false;
      }
      if (searchBolsa.trim()) {
        const q = searchBolsa.toLowerCase();
        const idStr = (b.id || '').toLowerCase();
        const numStr = String(b.numero);
        if (!idStr.includes(q) && !numStr.includes(q)) return false;
      }
      return true;
    });
  }, [bolsas, filtroTratamiento, filtroTipo, searchBolsa]);

  // Bolsas actualmente seleccionadas
  const bolsasSeleccionadas = useMemo(() => {
    return bolsas.filter((b) => selectedIds.has(b.id));
  }, [bolsas, selectedIds]);

  const totalKgSeleccionados = useMemo(() => {
    return bolsasSeleccionadas.reduce((acc, b) => acc + (Number(b.kg) || 0), 0);
  }, [bolsasSeleccionadas]);

  // Cantidad de bolsas resultantes por cambio de envase
  const kgNuevoEnvase = getKilajeEnvase(nuevoEnvase);
  const bolsasResultantesReenvasado = useMemo(() => {
    if (kgNuevoEnvase <= 0 || totalKgSeleccionados <= 0) return 0;
    return Math.floor(totalKgSeleccionados / kgNuevoEnvase);
  }, [totalKgSeleccionados, kgNuevoEnvase]);

  // Selección individual o masiva
  const handleToggleSelectAll = () => {
    if (selectedIds.size === bolsasFiltradas.length && bolsasFiltradas.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(bolsasFiltradas.map((b) => b.id)));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Abrir modal de movimiento para 1 bolsa específica
  const handleAbrirMovimientoIndividual = (b: BolsaRegistro) => {
    setSelectedIds(new Set([b.id]));
    setModalTab('envase');
    setShowModalMovimiento(true);
  };

  // Abrir modal de movimiento para la selección actual
  const handleAbrirMovimientoMasivo = (tabDefault: 'envase' | 'tipo' | 'curado' | 'categoria' = 'envase') => {
    if (selectedIds.size === 0) return;
    setModalTab(tabDefault);
    setShowModalMovimiento(true);
  };

  // Confirmar movimiento de bolsas
  const handleConfirmarMovimiento = async () => {
    if (selectedIds.size === 0) return;
    setIsProcessing(true);
    setFeedbackMsg(null);

    try {
      let nuevasBolsas: BolsaRegistro[] = [...bolsas];
      let descripcion = '';

      if (modalTab === 'envase') {
        // MOVIMIENTO 1: CAMBIAR ENVASE DEL ACTUAL A OTRO ENVASE (x 40 kg / x 25 kg o x 20 kg)
        // y calcular la cantidad de bolsas resultantes por la cantidad de kg.
        if (bolsasResultantesReenvasado <= 0) {
          throw new Error('La cantidad de bolsas resultantes debe ser mayor a 0.');
        }
        if (totalKgSeleccionados % kgNuevoEnvase !== 0) {
          const confirmarParcial = window.confirm(
            `Atención: ${totalKgSeleccionados} kg no es un múltiplo exacto de ${kgNuevoEnvase} kg. Se generarán ${bolsasResultantesReenvasado} bolsas de ${nuevoEnvase} (${bolsasResultantesReenvasado * kgNuevoEnvase} kg) y quedará un remanente no embolsable de ${totalKgSeleccionados % kgNuevoEnvase} kg. ¿Desea continuar?`
          );
          if (!confirmarParcial) {
            setIsProcessing(false);
            return;
          }
        }

        const codigoLote = (lote.codigo || lote.loteNro || lote.id || 'LOTE').trim();
        const baseAttrs = bolsasSeleccionadas[0] || {
          tipo: 'final',
          categoria: 'primu',
          tratamiento: 'sin curar',
          estado: 'clasificado',
          caratulaId: lote.caratulaId || `CARAT-${lote.id}`
        };

        // Quitar las bolsas originales seleccionadas
        nuevasBolsas = nuevasBolsas.filter((b) => !selectedIds.has(b.id));

        // Generar las nuevas bolsas resultantes
        const bolsasReenvasadas: BolsaRegistro[] = [];
        const startNumber = nuevasBolsas.length + 1;
        const nuevoTotalEstimado = nuevasBolsas.length + bolsasResultantesReenvasado;

        for (let i = 1; i <= bolsasResultantesReenvasado; i++) {
          const num = startNumber + i - 1;
          const newId = `${codigoLote}-R${String(num).padStart(2, '0')}/${String(nuevoTotalEstimado).padStart(2, '0')}`;
          bolsasReenvasadas.push({
            id: newId,
            loteId: lote.id,
            numero: num,
            totalBolsas: nuevoTotalEstimado,
            kg: kgNuevoEnvase,
            envase: nuevoEnvase,
            tipo: baseAttrs.tipo || 'final',
            categoria: baseAttrs.categoria || 'primu',
            tratamiento: baseAttrs.tratamiento || 'sin curar',
            productoCurado: (baseAttrs as any).productoCurado,
            estado: 'clasificado',
            despachada: false,
            bolsaOrigenId: Array.from(selectedIds).join(', '),
            caratulaId: lote.caratulaId || `CARAT-${lote.id}`
          });
        }

        nuevasBolsas = [...nuevasBolsas, ...bolsasReenvasadas];
        descripcion = `Cambio de envase sobre ${selectedIds.size} bolsas (${formatKg(totalKgSeleccionados)}): generadas ${bolsasResultantesReenvasado} bolsas nuevas en envase ${nuevoEnvase}.`;
      } else if (modalTab === 'tipo') {
        // MOVIMIENTO 2: DE TIPO INTERMEDIO A FINAL
        nuevasBolsas = nuevasBolsas.map((b) => {
          if (selectedIds.has(b.id)) {
            return { ...b, tipo: 'final' };
          }
          return b;
        });
        descripcion = `Movimiento de tipo: ${selectedIds.size} bolsas pasadas de intermedio a final.`;
      } else if (modalTab === 'curado') {
        // CURADO SOBRE BOLSAS
        nuevasBolsas = nuevasBolsas.map((b) => {
          if (selectedIds.has(b.id)) {
            return {
              ...b,
              tratamiento: nuevoTratamiento,
              productoCurado: nuevoTratamiento === 'curado' ? productoCurado.trim() : undefined,
            };
          }
          return b;
        });
        descripcion = `Tratamiento sobre bolsas: ${selectedIds.size} bolsas marcadas como ${nuevoTratamiento.toUpperCase()}${nuevoTratamiento === 'curado' ? ` con producto ${productoCurado.trim()}` : ''}.`;
      } else if (modalTab === 'categoria') {
        // CATEGORÍA SOBRE BOLSAS
        nuevasBolsas = nuevasBolsas.map((b) => {
          if (selectedIds.has(b.id)) {
            return {
              ...b,
              categoria: nuevaCategoria,
            };
          }
          return b;
        });
        descripcion = `Cambio de categoría: ${selectedIds.size} bolsas asignadas a categoría ${nuevaCategoria.toUpperCase()}.`;
      }

      await onUpdateBolsas(nuevasBolsas, descripcion);
      setFeedbackMsg({ tipo: 'success', texto: `¡Operación completada con éxito! ${descripcion}` });
      setSelectedIds(new Set());
      setShowModalMovimiento(false);
      setTimeout(() => setFeedbackMsg(null), 5000);
    } catch (err: any) {
      console.error('Error aplicando movimiento sobre bolsas:', err);
      setFeedbackMsg({ tipo: 'error', texto: err.message || 'Error al aplicar movimiento sobre bolsas.' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-5 sm:p-7 space-y-6 text-left">
      {/* 1. ENCABEZADO Y RESUMEN CALCULADO EN VIVO DESDE SUS BOLSAS */}
      <div className="border-b border-gray-200 pb-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-black uppercase tracking-widest text-[#00603C] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                Control Individual de Unidades · Modelo de Bolsas
              </span>
              <span className="text-xs font-mono font-bold text-gray-500">
                Lote #{lote.codigo || lote.loteNro}
              </span>
            </div>
            <h4 className="font-serif text-2xl font-black text-gray-900 mt-1">
              Visor de Bolsas ({bolsas.length} unidades físicas)
            </h4>
            <p className="text-xs text-gray-500 mt-0.5">
              Cada bolsa almacena sus atributos fijos. Los valores del lote reflejan en vivo el resumen de sus bolsas.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center">
            <span className="px-3.5 py-1.5 rounded-xl bg-emerald-100 text-emerald-950 text-xs font-mono font-black border border-emerald-300">
              {resumen.totalBolsas} Bolsas · {formatKg(resumen.kgTotales)}
            </span>
          </div>
        </div>

        {/* TARJETAS RESUMEN DE ATRIBUTOS DEL LOTE (CALCULADOS DESDE SUS BOLSAS) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
          {/* Stock */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-gray-400 block">Stock Disponible</span>
            <span className="font-mono font-black text-emerald-900 text-sm block mt-0.5">
              {formatKg(resumen.stockKg)}
            </span>
            <span className="text-[10px] text-gray-500 font-mono">
              {resumen.stockBolsas} b. no despachadas
            </span>
          </div>

          {/* Estado */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-gray-400 block">Estado</span>
            <span className="font-bold text-gray-900 text-xs capitalize block mt-0.5 truncate" title={resumen.estado}>
              {resumen.estado}
            </span>
          </div>

          {/* Categoría */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-gray-400 block">Categoría</span>
            <span className="font-bold text-purple-900 text-xs uppercase block mt-0.5 truncate" title={resumen.categoria}>
              {resumen.categoria}
            </span>
          </div>

          {/* Tipo */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-gray-400 block">Tipo</span>
            <span className="font-bold text-indigo-900 text-xs capitalize block mt-0.5 truncate" title={resumen.tipo}>
              {resumen.tipo}
            </span>
          </div>

          {/* Tratamiento / Curado */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 col-span-2">
            <span className="text-[10px] uppercase font-bold text-gray-400 block">Tratamiento (Curado)</span>
            <span className="font-bold text-emerald-950 text-xs capitalize block mt-0.5 truncate" title={resumen.tratamiento}>
              {resumen.tratamiento}
            </span>
            {lote.producto && lote.producto !== 'Ninguno' && lote.producto !== 'Sin Curar' && lote.producto !== 'Sin Tratar' && (
              <span className="text-[10px] text-purple-700 font-mono block">
                Producto: {lote.producto}
              </span>
            )}
          </div>
        </div>
      </div>

      {feedbackMsg && (
        <div className={`p-3.5 rounded-2xl text-xs flex items-center justify-between border ${
          feedbackMsg.tipo === 'success'
            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
            : 'bg-red-50 border-red-300 text-red-900'
        }`}>
          <div className="flex items-center gap-2">
            {feedbackMsg.tipo === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span className="font-bold">{feedbackMsg.texto}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. BARRA DE ACCIÓN SOBRE SELECCIÓN MÚLTIPLE */}
      <div className="bg-emerald-950 text-white p-3.5 sm:p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleToggleSelectAll}
            className="flex items-center gap-2 text-xs font-bold text-emerald-100 hover:text-white cursor-pointer"
          >
            {selectedIds.size === bolsasFiltradas.length && bolsasFiltradas.length > 0 ? (
              <CheckSquare className="w-4 h-4 text-amber-300" />
            ) : (
              <Square className="w-4 h-4 text-emerald-300" />
            )}
            <span>
              {selectedIds.size === bolsasFiltradas.length && bolsasFiltradas.length > 0
                ? 'Desmarcar todas'
                : 'Seleccionar todas las bolsas visibles'}
            </span>
          </button>

          {selectedIds.size > 0 && (
            <span className="px-2.5 py-1 bg-amber-400 text-slate-950 text-xs font-black rounded-lg">
              {selectedIds.size} seleccionadas · {formatKg(totalKgSeleccionados)}
            </span>
          )}
        </div>

        {/* Botones de acción masiva sobre bolsas seleccionadas */}
        <div className="flex items-center gap-2 flex-wrap">
          {!readOnly && (
            <button
              type="button"
              id="btn-movimiento-bolsas-seleccion"
              disabled={selectedIds.size === 0}
              onClick={() => handleAbrirMovimientoMasivo('envase')}
              className="px-3.5 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 disabled:opacity-40 text-slate-950 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 disabled:cursor-not-allowed"
              title="Registrar movimiento sobre bolsas seleccionadas: Cambio de envase o de Intermedio a Final"
            >
              <ArrowRightLeft className="w-4 h-4 text-slate-950 stroke-[2.5]" />
              <span>Movimiento ({selectedIds.size})</span>
            </button>
          )}

          {!readOnly && (
            <button
              type="button"
              disabled={selectedIds.size === 0}
              onClick={() => handleAbrirMovimientoMasivo('curado')}
              className="px-3 py-2 bg-purple-700 hover:bg-purple-800 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:cursor-not-allowed border border-purple-500"
              title="Marcar bolsas seleccionadas como curadas"
            >
              <FlaskConical className="w-3.5 h-3.5 text-purple-200" />
              <span>Curar</span>
            </button>
          )}

          {!readOnly && (
            <button
              type="button"
              disabled={selectedIds.size === 0}
              onClick={() => handleAbrirMovimientoMasivo('categoria')}
              className="px-3 py-2 bg-emerald-800 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:cursor-not-allowed border border-emerald-600"
              title="Cambiar categoría de bolsas seleccionadas"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
              <span>Categoría</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. BARRA DE FILTROS Y BÚSQUEDA DEL VISOR DE BOLSAS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Búsqueda */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por N° de bolsa o ID..."
              value={searchBolsa}
              onChange={(e) => setSearchBolsa(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs w-52 sm:w-64 focus:outline-none focus:ring-1 focus:ring-[#00603C]"
            />
          </div>

          {/* Filtro Curado */}
          <select
            value={filtroTratamiento}
            onChange={(e) => setFiltroTratamiento(e.target.value)}
            className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-700"
          >
            <option value="todos">Todos los tratamientos</option>
            <option value="curado">Curadas</option>
            <option value="sin curar">Sin curar</option>
          </select>

          {/* Filtro Tipo */}
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-700"
          >
            <option value="todos">Todos los tipos</option>
            <option value="intermedio">Intermedio</option>
            <option value="final">Final</option>
          </select>
        </div>

        <div className="text-gray-500 font-mono text-[11px] self-end sm:self-center">
          Mostrando {bolsasFiltradas.length} de {bolsas.length} bolsas
        </div>
      </div>

      {/* 4. TABLA DEL VISOR DE BOLSAS */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-2xs">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-200 text-gray-700 font-bold uppercase tracking-wider text-[10px]">
              <th className="py-3 px-3 w-8 text-center">
                <input
                  type="checkbox"
                  checked={selectedIds.size === bolsasFiltradas.length && bolsasFiltradas.length > 0}
                  onChange={handleToggleSelectAll}
                  className="rounded text-[#00603C] cursor-pointer"
                />
              </th>
              <th className="py-3 px-2 w-10 text-center font-mono">#</th>
              <th className="py-3 px-3 font-mono">N° de Bolsa</th>
              <th className="py-3 px-3 text-center">Envase</th>
              <th className="py-3 px-3 text-center">Tipo</th>
              <th className="py-3 px-3 text-center">Tratamiento</th>
              <th className="py-3 px-3 text-center">Categoría</th>
              <th className="py-3 px-3 text-center">Estado</th>
              <th className="py-3 px-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 font-mono">
            {bolsasFiltradas.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-gray-400 font-sans text-xs">
                  No se encontraron bolsas con los filtros aplicados.
                </td>
              </tr>
            ) : (
              bolsasFiltradas.map((b) => {
                const isSelected = selectedIds.has(b.id);
                const tratNorm = normalizarTratamiento(b.tratamiento);
                const tipoNorm = normalizarTipo(b.tipo);
                const catNorm = normalizarCategoria(b.categoria);
                const estNorm = normalizarEstado(b.estado as string);
                const envaseLabel = b.envase || `${b.kg} kg`;

                return (
                  <tr
                    key={b.id}
                    className={`transition hover:bg-slate-50 ${isSelected ? 'bg-emerald-50/70 font-semibold' : ''}`}
                  >
                    {/* Checkbox */}
                    <td className="py-2.5 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectOne(b.id)}
                        className="rounded text-[#00603C] cursor-pointer"
                      />
                    </td>

                    {/* # */}
                    <td className="py-2.5 px-2 text-center text-gray-500 font-bold">
                      {String(b.numero).padStart(2, '0')}
                    </td>

                    {/* N° de Bolsa */}
                    <td className="py-2.5 px-3 font-bold text-[#00603C] whitespace-nowrap">
                      {b.id}
                    </td>

                    {/* Envase */}
                    <td className="py-2.5 px-3 text-center font-bold text-gray-900 whitespace-nowrap font-sans">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[11px] font-mono">
                        {envaseLabel}
                      </span>
                    </td>

                    {/* Tipo: intermedio / final */}
                    <td className="py-2.5 px-3 text-center font-sans whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                          tipoNorm === 'final'
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            : 'bg-indigo-100 text-indigo-900 border border-indigo-300'
                        }`}
                      >
                        {tipoNorm}
                      </span>
                    </td>

                    {/* Tratamiento: curado / sin curar */}
                    <td className="py-2.5 px-3 text-center font-sans whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                          tratNorm === 'curado'
                            ? 'bg-purple-100 text-purple-900 border border-purple-300'
                            : 'bg-gray-100 text-gray-700 border border-gray-300'
                        }`}
                        title={b.productoCurado ? `Producto: ${b.productoCurado}` : tratNorm}
                      >
                        {tratNorm === 'curado' ? 'Curado' : 'Sin Curar'}
                      </span>
                    </td>

                    {/* Categoría: preba, original, primu */}
                    <td className="py-2.5 px-3 text-center font-sans whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-amber-100 text-amber-900 border border-amber-300">
                        {catNorm}
                      </span>
                    </td>

                    {/* Estado */}
                    <td className="py-2.5 px-3 text-center font-sans whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 capitalize">
                        {estNorm}
                      </span>
                    </td>

                    {/* Acciones: Botón Movimiento y Botón QR */}
                    <td className="py-2.5 px-3 text-center font-sans whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => handleAbrirMovimientoIndividual(b)}
                            className="px-2 py-1 bg-amber-400 hover:bg-amber-500 text-slate-950 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95"
                            title="Mover esta bolsa (cambiar envase o pasar a final)"
                          >
                            <ArrowRightLeft className="w-3 h-3 text-slate-950" />
                            <span>Movimiento</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onVerQr(b)}
                          className="px-2 py-1 bg-[#00603C] hover:bg-[#254731] text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95"
                          title="Ver e imprimir etiqueta de bolsa con código QR"
                        >
                          <QrCode className="w-3 h-3 text-amber-300" />
                          <span>QR</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 5. MODAL OFICIAL DE MOVIMIENTO DE BOLSAS */}
      {showModalMovimiento && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-5 border border-gray-100 text-left">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#00603C] font-bold block">
                  Operación sobre Unidades Físicas
                </span>
                <h3 className="font-serif text-xl font-bold text-gray-900 mt-0.5">
                  Movimiento de Bolsas ({selectedIds.size} seleccionadas)
                </h3>
                <span className="text-xs text-gray-500">
                  Total seleccionado: <strong className="text-gray-900">{formatKg(totalKgSeleccionados)}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowModalMovimiento(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Pestañas de Tipo de Movimiento */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-gray-100 p-1.5 rounded-2xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setModalTab('envase')}
                className={`py-2 px-2.5 rounded-xl transition text-center cursor-pointer ${
                  modalTab === 'envase'
                    ? 'bg-[#00603C] text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                1. Envase
              </button>
              <button
                type="button"
                onClick={() => setModalTab('tipo')}
                className={`py-2 px-2.5 rounded-xl transition text-center cursor-pointer ${
                  modalTab === 'tipo'
                    ? 'bg-[#00603C] text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                2. Int a Final
              </button>
              <button
                type="button"
                onClick={() => setModalTab('curado')}
                className={`py-2 px-2.5 rounded-xl transition text-center cursor-pointer ${
                  modalTab === 'curado'
                    ? 'bg-purple-700 text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Curado
              </button>
              <button
                type="button"
                onClick={() => setModalTab('categoria')}
                className={`py-2 px-2.5 rounded-xl transition text-center cursor-pointer ${
                  modalTab === 'categoria'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Categoría
              </button>
            </div>

            {/* CONTENIDO SEGÚN PESTAÑA */}
            {modalTab === 'envase' && (
              <div className="space-y-4">
                <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-950 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-amber-700" />
                    <span>Movimiento 1: Cambio de Envase con Recálculo de Bolsas</span>
                  </div>
                  <p className="text-[11px] text-amber-900">
                    Cambiar el envase actual a otro envase (x 40 kg / x 25 kg o x 20 kg). La cantidad de bolsas resultantes se calcula por la cantidad de kg.
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                      Nuevo Envase de Destino *
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(['x 40 kg', 'x 25 kg', 'x 20 kg', 'x 800 kg'] as EnvaseEspecificacion[]).map((env) => (
                        <button
                          key={env}
                          type="button"
                          onClick={() => setNuevoEnvase(env)}
                          className={`p-2.5 rounded-xl font-mono text-xs font-black transition border cursor-pointer ${
                            nuevoEnvase === env
                              ? 'bg-[#00603C] text-white border-[#00603C] ring-2 ring-emerald-300'
                              : 'bg-gray-50 text-gray-800 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {env}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Resumen del recálculo */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                    <div className="flex justify-between text-gray-600">
                      <span>Bolsas seleccionadas actuales:</span>
                      <strong className="font-mono text-gray-900">{selectedIds.size} bolsas</strong>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Kilaje total seleccionado:</span>
                      <strong className="font-mono text-gray-900">{formatKg(totalKgSeleccionados)}</strong>
                    </div>
                    <div className="flex justify-between text-gray-600 border-t border-slate-200 pt-2">
                      <span>Nuevo kilaje unitario:</span>
                      <strong className="font-mono text-gray-900">{kgNuevoEnvase} kg / bolsa</strong>
                    </div>
                    <div className="flex justify-between text-emerald-950 font-bold bg-emerald-100/80 p-2.5 rounded-xl border border-emerald-300">
                      <span>Bolsas Resultantes Calculadas:</span>
                      <span className="font-mono text-base font-black text-[#00603C]">
                        {bolsasResultantesReenvasado} bolsas ({formatKg(bolsasResultantesReenvasado * kgNuevoEnvase)})
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {modalTab === 'tipo' && (
              <div className="space-y-4">
                <div className="p-3.5 bg-indigo-50 rounded-2xl border border-indigo-200 text-xs text-indigo-950 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-indigo-700" />
                    <span>Movimiento 2: De Tipo Intermedio a Final</span>
                  </div>
                  <p className="text-[11px] text-indigo-900">
                    Pasa las bolsas seleccionadas de tipo "Intermedio" a "Final" sin alterar el kilaje ni la identidad del lote.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
                  <div className="flex justify-between">
                    <span>Bolsas a pasar a FINAL:</span>
                    <strong className="font-mono text-indigo-950">{selectedIds.size} bolsas</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Kilaje involucrado:</span>
                    <strong className="font-mono text-indigo-950">{formatKg(totalKgSeleccionados)}</strong>
                  </div>
                </div>
              </div>
            )}

            {modalTab === 'curado' && (
              <div className="space-y-4">
                <div className="p-3.5 bg-purple-50 rounded-2xl border border-purple-200 text-xs text-purple-950 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <FlaskConical className="w-4 h-4 text-purple-700" />
                    <span>Curado de Bolsas Seleccionadas</span>
                  </div>
                  <p className="text-[11px] text-purple-900">
                    Aplica tratamiento a las bolsas seleccionadas e indica el producto químico utilizado.
                  </p>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-bold text-gray-700 uppercase mb-1">
                      Tratamiento
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNuevoTratamiento('curado')}
                        className={`p-2.5 rounded-xl font-bold transition border cursor-pointer ${
                          nuevoTratamiento === 'curado'
                            ? 'bg-purple-700 text-white border-purple-800'
                            : 'bg-gray-50 text-gray-800 border-gray-200'
                        }`}
                      >
                        Curado
                      </button>
                      <button
                        type="button"
                        onClick={() => setNuevoTratamiento('sin curar')}
                        className={`p-2.5 rounded-xl font-bold transition border cursor-pointer ${
                          nuevoTratamiento === 'sin curar'
                            ? 'bg-gray-800 text-white border-gray-900'
                            : 'bg-gray-50 text-gray-800 border-gray-200'
                        }`}
                      >
                        Sin Curar
                      </button>
                    </div>
                  </div>

                  {nuevoTratamiento === 'curado' && (
                    <div>
                      <label className="block font-bold text-gray-700 uppercase mb-1">
                        Producto Curasemilla *
                      </label>
                      <input
                        type="text"
                        value={productoCurado}
                        onChange={(e) => setProductoCurado(e.target.value)}
                        placeholder="Ej: Maxim XL, Cruiser..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-gray-900"
                        required
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {modalTab === 'categoria' && (
              <div className="space-y-4">
                <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-950 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-700" />
                    <span>Cambio de Categoría de Bolsas</span>
                  </div>
                  <p className="text-[11px] text-emerald-900">
                    Asigna una nueva categoría oficial a las bolsas seleccionadas (preba, original, primu).
                  </p>
                </div>

                <div className="space-y-2 text-xs">
                  <label className="block font-bold text-gray-700 uppercase mb-1">
                    Categoría Oficial *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['preba', 'original', 'primu'] as CategoriaEspecificacion[]).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setNuevaCategoria(cat)}
                        className={`p-2.5 rounded-xl font-bold uppercase transition border cursor-pointer ${
                          nuevaCategoria === cat
                            ? 'bg-amber-400 text-slate-950 border-amber-500 ring-2 ring-amber-300'
                            : 'bg-gray-50 text-gray-800 border-gray-200'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* BOTONES DE CIERRE Y CONFIRMACIÓN */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowModalMovimiento(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarMovimiento}
                disabled={isProcessing}
                className="px-6 py-2 bg-[#00603C] hover:bg-[#254731] text-white text-xs font-black uppercase tracking-wider rounded-xl transition flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
              >
                <Check className="w-4 h-4 text-amber-300" />
                <span>{isProcessing ? 'Aplicando...' : 'Confirmar Movimiento'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
