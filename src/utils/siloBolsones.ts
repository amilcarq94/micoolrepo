import { SiloExtraccion, MovimientoSilo, BolsonCampo, Lote } from '../types';

export function getBolsonesFiltradosPorSilo(
  silosOrigen: SiloExtraccion[],
  movimientosSilo: MovimientoSilo[] = [],
  bolsones: BolsonCampo[] = [],
  editingLote?: Lote | null,
  clienteActual?: string
): BolsonCampo[] {
  const selectedSiloIds = (silosOrigen || []).map(s => s.siloId).filter(Boolean);
  
  if (selectedSiloIds.length === 0) {
    return [];
  }

  const bolsonNrosValidos = new Set<string>();
  const bolsonIdsValidos = new Set<string>();
  const bolsonMapExtra = new Map<string, BolsonCampo>();

  selectedSiloIds.forEach(siloId => {
    const movsSilo = (movimientosSilo || [])
      .filter(m => m.siloId === siloId)
      .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '') || (a.id || '').localeCompare(b.id || ''));

    let currentBal = 0;
    let lastZeroIdx = -1;
    movsSilo.forEach((m, idx) => {
      if (m.tipo === 'INGRESO') {
        currentBal += m.kg;
      } else if (m.tipo === 'EGRESO_OP' || (m.tipo as string).startsWith('EGRESO')) {
        currentBal = Math.max(0, currentBal - m.kg);
      } else if (m.tipo === 'AJUSTE_ZERO') {
        currentBal = 0;
      }
      if (currentBal === 0) {
        lastZeroIdx = idx;
      }
    });

    if (currentBal <= 0) {
      return;
    }

    const activeBatchMovs = lastZeroIdx >= 0 ? movsSilo.slice(lastZeroIdx + 1) : movsSilo;

    activeBatchMovs.forEach(m => {
      if (m.tipo === 'INGRESO') {
        if (m.bolsonOrigenId) {
          bolsonIdsValidos.add(m.bolsonOrigenId);
        }
        if (m.bolsonOrigenNro && m.bolsonOrigenNro.trim()) {
          const normNro = m.bolsonOrigenNro.trim().toLowerCase();
          bolsonNrosValidos.add(normNro);

          if (!bolsonMapExtra.has(normNro)) {
            bolsonMapExtra.set(normNro, {
              id: m.bolsonOrigenId || `MOV-BOLSON-${m.bolsonOrigenNro}`,
              campania: '2025/2026',
              numeroBolson: m.bolsonOrigenNro,
              cliente: m.cliente || clienteActual || 'San Diego Semillas',
              cultivo: m.especie || 'Soja',
              variedad: m.variedad || '-',
              categoria: m.categoria || 'Original',
              campo: m.campoOrigen || '-',
              zona: m.bolsonOrigenSector || '-',
              entradasKg: m.kg || 0,
              salidasKg: 0,
              stockKg: m.kg || 0
            });
          }
        }
      }
    });
  });

  const matchedFromProp = bolsones.filter(b => {
    const normNro = (b.numeroBolson || '').trim().toLowerCase();
    const isMatchBySilo = (b.id && bolsonIdsValidos.has(b.id)) || (normNro && bolsonNrosValidos.has(normNro));
    if (!isMatchBySilo) return false;

    const currentStock = b.stockKg !== undefined ? b.stockKg : ((b.entradasKg || 0) - (b.salidasKg || 0));
    
    const isCurrentlySelectedInEditing = editingLote && (
      (b.id && b.id === editingLote.bolsonOrigenId) ||
      (b.numeroBolson && editingLote.numeroBolsonOrigen && b.numeroBolson.toLowerCase() === editingLote.numeroBolsonOrigen.toLowerCase())
    );

    return currentStock > 0 || isCurrentlySelectedInEditing;
  });

  const matchedNros = new Set(matchedFromProp.map(b => b.numeroBolson.trim().toLowerCase()));
  const extraList: BolsonCampo[] = [];
  bolsonMapExtra.forEach((item, normNro) => {
    if (!matchedNros.has(normNro)) {
      const itemStock = item.stockKg !== undefined ? item.stockKg : ((item.entradasKg || 0) - (item.salidasKg || 0));
      const isCurrentlySelectedInEditing = editingLote && (
        (item.id && item.id === editingLote.bolsonOrigenId) ||
        (item.numeroBolson && editingLote.numeroBolsonOrigen && item.numeroBolson.toLowerCase() === editingLote.numeroBolsonOrigen.toLowerCase())
      );
      if (itemStock > 0 || isCurrentlySelectedInEditing) {
        extraList.push(item);
      }
    }
  });

  return [...matchedFromProp, ...extraList];
}
