import React, { useState, useMemo } from 'react';
import { Package, Scale, Hash, Copy, Check, ChevronDown, ChevronUp, Layers, Filter } from 'lucide-react';
import { Lote } from '../types';

interface LotesTopSummaryCardsProps {
  filteredLotes: Lote[];
  totalLotesCount: number;
  hasActiveFilters: boolean;
  activeFiltersCount?: number;
  onLoteClick?: (lote: Lote) => void;
}

export const LotesTopSummaryCards: React.FC<LotesTopSummaryCardsProps> = ({
  filteredLotes,
  totalLotesCount,
  hasActiveFilters,
  activeFiltersCount = 0,
  onLoteClick,
}) => {
  const [copied, setCopied] = useState(false);
  const [isIdsExpanded, setIsIdsExpanded] = useState(false);
  const [searchIdQuery, setSearchIdQuery] = useState('');

  // Cálculos dinámicos agregados según los filtros activos
  const { totalBolsas, totalKg, lotesList } = useMemo(() => {
    let bolsas = 0;
    let kg = 0;

    const list = filteredLotes.map((lote) => {
      const b = Number(lote.stockBolsas) || 0;
      const k = lote.stockKg !== undefined ? Number(lote.stockKg) : b * (Number(lote.kgPorBolsa) || 0);

      bolsas += b;
      kg += k;

      return {
        id: lote.id,
        loteNro: lote.loteNro || lote.id,
        cliente: lote.cliente || 'Sin cliente',
        especie: lote.especie || 'Sin especie',
        variedad: lote.variedad || '',
        stockBolsas: b,
        stockKg: k,
        rawLote: lote,
      };
    });

    return {
      totalBolsas: bolsas,
      totalKg: kg,
      lotesList: list,
    };
  }, [filteredLotes]);

  const totalTn = totalKg / 1000;
  const promedioKgPorBolsa = totalBolsas > 0 ? (totalKg / totalBolsas).toFixed(1) : '0';
  const promedioBolsasPorLote = lotesList.length > 0 ? (totalBolsas / lotesList.length).toFixed(0) : '0';

  // Filtrado interno opcional en el listado de IDs si el usuario busca un lote específico
  const visibleLotesList = useMemo(() => {
    if (!searchIdQuery.trim()) return lotesList;
    const q = searchIdQuery.toLowerCase().trim();
    return lotesList.filter(
      (item) =>
        item.loteNro.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        item.cliente.toLowerCase().includes(q)
    );
  }, [lotesList, searchIdQuery]);

  const handleCopyIds = async () => {
    if (lotesList.length === 0) return;
    const idsString = lotesList.map((item) => item.loteNro).join(', ');
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(idsString);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = idsString;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  // Límite de chips visibles en modo colapsado
  const MAX_COLLAPSED_CHIPS = 10;
  const displayedChips = isIdsExpanded ? visibleLotesList : visibleLotesList.slice(0, MAX_COLLAPSED_CHIPS);
  const remainingCount = Math.max(0, visibleLotesList.length - MAX_COLLAPSED_CHIPS);

  return (
    <div
      id="lotes-top-summary-cards-panel"
      className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4 font-sans"
    >
      {/* Encabezado del panel de resumen */}
      <div className="flex flex-wrap justify-between items-center gap-2 border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-[#E3EFE7] text-[#00603C] rounded-lg">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#00603C] flex items-center gap-2">
              <span>Resumen General de Lotes</span>
              {hasActiveFilters ? (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full normal-case flex items-center gap-1">
                  <Filter className="w-3 h-3 text-amber-600" />
                  Filtrado ({activeFiltersCount} activo{activeFiltersCount === 1 ? '' : 's'})
                </span>
              ) : (
                <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full normal-case">
                  Total Acumulado en Planta
                </span>
              )}
            </h3>
          </div>
        </div>

        <div className="text-xs text-gray-500 font-medium flex items-center gap-2">
          <span>Lotes visibles:</span>
          <span className="font-mono font-bold text-[#00603C] bg-[#E3EFE7] px-2.5 py-0.5 rounded-md">
            {lotesList.length} de {totalLotesCount}
          </span>
        </div>
      </div>

      {/* Grid de 3 Tarjetas Principales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* TARJETA 1: BOLSAS PRODUCIDAS */}
        <div
          id="card-resumen-bolsas-producidas"
          className="bg-gradient-to-br from-[#E3EFE7]/40 via-white to-emerald-50/20 p-4 rounded-xl border border-[#00603C]/20 flex flex-col justify-between shadow-2xs hover:border-[#00603C]/40 transition"
        >
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#00603C] flex items-center gap-1.5">
              <Package className="w-4 h-4 text-[#00603C]" />
              Bolsas Producidas
            </span>
            <span className="text-[10px] font-mono font-bold text-[#00603C] bg-[#E3EFE7] px-2 py-0.5 rounded-md">
              {lotesList.length} {lotesList.length === 1 ? 'lote' : 'lotes'}
            </span>
          </div>

          <div className="my-1">
            <div className="text-3xl font-black font-mono text-gray-900 tracking-tight flex items-baseline gap-1.5">
              <span>{totalBolsas.toLocaleString('es-AR')}</span>
              <span className="text-sm font-bold text-gray-500 font-sans">bolsas</span>
            </div>
          </div>

          <div className="pt-2 border-t border-emerald-900/10 flex justify-between items-center text-xs text-gray-500 font-medium">
            <span>Promedio por lote:</span>
            <span className="font-mono font-bold text-gray-800">~{promedioBolsasPorLote} bolsas</span>
          </div>
        </div>

        {/* TARJETA 2: KILOS TOTALES */}
        <div
          id="card-resumen-kilos-totales"
          className="bg-gradient-to-br from-amber-50/40 via-white to-orange-50/20 p-4 rounded-xl border border-amber-200/70 flex flex-col justify-between shadow-2xs hover:border-amber-400 transition"
        >
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-amber-700" />
              Kilos Totales
            </span>
            <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded-md">
              {totalTn.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Tn
            </span>
          </div>

          <div className="my-1">
            <div className="text-3xl font-black font-mono text-gray-900 tracking-tight flex items-baseline gap-1.5">
              <span>{totalKg.toLocaleString('es-AR')}</span>
              <span className="text-sm font-bold text-gray-500 font-sans">kg</span>
            </div>
          </div>

          <div className="pt-2 border-t border-amber-900/10 flex justify-between items-center text-xs text-gray-500 font-medium">
            <span>Peso prom. por bolsa:</span>
            <span className="font-mono font-bold text-gray-800">{promedioKgPorBolsa} kg</span>
          </div>
        </div>

        {/* TARJETA 3: LISTADO DE IDS DE LOTES VISIBLES */}
        <div
          id="card-resumen-ids-lotes"
          className="bg-gradient-to-br from-slate-50 via-white to-gray-50/50 p-4 rounded-xl border border-gray-200 flex flex-col justify-between shadow-2xs hover:border-[#00603C]/30 transition"
        >
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
              <Hash className="w-4 h-4 text-[#00603C]" />
              IDs Lotes Visibles ({lotesList.length})
            </span>

            {lotesList.length > 0 && (
              <button
                id="btn-copiar-ids-lotes-resumen"
                type="button"
                onClick={handleCopyIds}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-[#00603C] hover:text-white bg-[#E3EFE7] hover:bg-[#00603C] rounded-md transition cursor-pointer"
                title="Copiar lista completa de números de lote al portapapeles"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span>¡Copiados!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copiar IDs</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Área de Chips de IDs */}
          <div className="my-1">
            {lotesList.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-2">
                No hay lotes que coincidan con los filtros aplicados.
              </p>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                  {displayedChips.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onLoteClick && onLoteClick(item.rawLote)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono font-bold bg-white text-gray-800 border border-gray-200 hover:border-[#00603C] hover:bg-[#E3EFE7]/50 rounded-md transition text-left cursor-pointer shadow-2xs group"
                      title={`Lote: ${item.loteNro}\nCliente: ${item.cliente}\nEspecie: ${item.especie} ${item.variedad}\nStock: ${item.stockBolsas} bolsas (${item.stockKg.toLocaleString('es-AR')} kg)`}
                    >
                      <span className="text-[#00603C] text-[10px] font-sans font-bold">#</span>
                      <span className="group-hover:text-[#00603C]">{item.loteNro}</span>
                    </button>
                  ))}

                  {!isIdsExpanded && remainingCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsIdsExpanded(true)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold text-[#00603C] bg-[#E3EFE7] hover:bg-[#C2E0CC] rounded-md transition cursor-pointer"
                      title="Ver todos los IDs de lotes visibles"
                    >
                      <span>+{remainingCount} más...</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500 font-medium">
            <span>Total en vista:</span>
            {lotesList.length > MAX_COLLAPSED_CHIPS && (
              <button
                type="button"
                onClick={() => setIsIdsExpanded(!isIdsExpanded)}
                className="text-[11px] font-bold text-[#00603C] hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <span>{isIdsExpanded ? 'Ver menos' : `Ver todos (${lotesList.length})`}</span>
                {isIdsExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
            {lotesList.length <= MAX_COLLAPSED_CHIPS && (
              <span className="font-mono font-bold text-gray-800">{lotesList.length} IDs</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
