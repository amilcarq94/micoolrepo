/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Lote, MovimientoStock, PlantaConfig } from '../types';
import { formatKg, formatDateStr } from '../utils/formatters';
import {
  X,
  ArrowRightLeft,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Package,
  Tag,
  FlaskConical,
  Building2,
  Layers,
  Sparkles,
  Info,
  Scale,
  ArrowRight,
  Warehouse,
  MapPin,
  Box,
  Scissors,
  RefreshCw,
  Check,
  ShieldAlert
} from 'lucide-react';

export type TipoMovimientoId =
  | 'intermedio_a_final'
  | 'intermedio_a_final_tratado'
  | 'final_a_final_tratado'
  | 'cambio_envase';

export interface MovimientoLoteResult {
  loteOrigenActualizado: Lote;
  nuevoLoteGenerado?: Lote;
  esTransformacionCompleta: boolean;
  tipoMovimientoLabel: string;
}

export interface OpcionEnvase {
  id: string;
  label: string;
  kgPorBolsa: number;
}

export const OPCIONES_ENVASE_PREDEFINIDAS: OpcionEnvase[] = [
  { id: 'bolsa_20', label: 'Bolsa x 20 kg', kgPorBolsa: 20 },
  { id: 'bolsa_25', label: 'Bolsa x 25 kg', kgPorBolsa: 25 },
  { id: 'bolsa_30', label: 'Bolsa x 30 kg', kgPorBolsa: 30 },
  { id: 'bolsa_40', label: 'Bolsa x 40 kg', kgPorBolsa: 40 },
  { id: 'bolsa_50', label: 'Bolsa x 50 kg', kgPorBolsa: 50 },
  { id: 'big_bag_800', label: 'Big Bag x 800 kg', kgPorBolsa: 800 },
  { id: 'big_bag_1000', label: 'Big Bag x 1000 kg', kgPorBolsa: 1000 },
];

/**
 * Obtiene el formato y peso del envase original del lote
 */
export function getEnvaseOrigenLote(lote: Lote): { label: string; kgPorBolsa: number } {
  const kg = Number(lote.kgPorBolsa) || 800;
  if (lote.tipoEnvase && lote.tipoEnvase.trim()) {
    return { label: lote.tipoEnvase.trim(), kgPorBolsa: kg };
  }
  if (lote.envase && lote.envase.trim()) {
    return { label: lote.envase.trim(), kgPorBolsa: kg };
  }
  if (kg === 800) return { label: 'Big Bag x 800 kg', kgPorBolsa: 800 };
  if (kg === 1000) return { label: 'Big Bag x 1000 kg', kgPorBolsa: 1000 };
  if (kg === 40) return { label: 'Bolsa x 40 kg', kgPorBolsa: 40 };
  if (kg === 25) return { label: 'Bolsa x 25 kg', kgPorBolsa: 25 };
  if (kg === 20) return { label: 'Bolsa x 20 kg', kgPorBolsa: 20 };
  if (kg === 50) return { label: 'Bolsa x 50 kg', kgPorBolsa: 50 };
  if (kg === 30) return { label: 'Bolsa x 30 kg', kgPorBolsa: 30 };
  return { label: `Envase x ${kg} kg`, kgPorBolsa: kg };
}

/**
 * Calcula la sugerencia de nombre del nuevo lote en caso de desdoblarlo (manteniendo mismo origen)
 */
export function suggestMovementLoteName(
  originalName: string,
  movType: TipoMovimientoId
): string {
  const name = (originalName || '').trim();
  if (!name) return 'LOTE-1';

  if (movType === 'intermedio_a_final') {
    if (name.toUpperCase().includes('-INT')) return name.replace(/-INT/gi, '-FIN');
    if (name.toUpperCase().includes('_INT')) return name.replace(/_INT/gi, '_FIN');
    if (/INT$/i.test(name)) return name.replace(/INT$/i, 'FIN');
    return `${name}-FIN`;
  }

  if (movType === 'intermedio_a_final_tratado' || movType === 'final_a_final_tratado') {
    if (name.toUpperCase().includes('-INT')) return name.replace(/-INT/gi, '-TRA');
    if (name.toUpperCase().includes('_INT')) return name.replace(/_INT/gi, '_TRA');
    if (name.toUpperCase().includes('-FIN')) return name.replace(/-FIN/gi, '-TRA');
    if (/FIN$/i.test(name)) return name.replace(/FIN$/i, 'TRA');
    return `${name}-TRA`;
  }

  if (movType === 'cambio_envase') {
    return `${name}-ENV`;
  }

  return `${name}-1`;
}

interface MovimientoLoteModalProps {
  isOpen: boolean;
  lote: Lote | null;
  allLotes: Lote[];
  plantaConfig?: PlantaConfig;
  currentUser: { nombre: string; rol: string };
  onClose: () => void;
  onConfirmMovimiento: (result: MovimientoLoteResult) => Promise<void> | void;
}

export const MovimientoLoteModal: React.FC<MovimientoLoteModalProps> = ({
  isOpen,
  lote,
  allLotes,
  plantaConfig,
  currentUser,
  onClose,
  onConfirmMovimiento,
}) => {
  if (!isOpen || !lote) return null;

  // Envase detectado de origen
  const envaseOrigen = useMemo(() => getEnvaseOrigenLote(lote), [lote]);

  // Tipo de movimiento inicial según tipo de lote origen
  const defaultMovType: TipoMovimientoId = useMemo(() => {
    if (lote.tipo === 'Intermedio') {
      return 'intermedio_a_final';
    }
    return 'final_a_final_tratado';
  }, [lote.tipo]);

  const [tipoMovimiento, setTipoMovimiento] = useState<TipoMovimientoId>(defaultMovType);
  const [fechaMovimiento, setFechaMovimiento] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Cantidad de bolsas a mover (por defecto la totalidad del lote para permitir transformación cualitativa completa)
  const [cantidadBolsas, setCantidadBolsas] = useState<number>(() => {
    return lote.stockBolsas > 0 ? lote.stockBolsas : 1;
  });

  // Selección de Envase Deseado
  const [envaseDeseadoId, setEnvaseDeseadoId] = useState<string>('origen');
  const [customKgPorBolsa, setCustomKgPorBolsa] = useState<number>(envaseOrigen.kgPorBolsa);

  // Nombre para el Lote Desdoblado (utilizado únicamente cuando no se mueve la totalidad)
  const [nombreNuevoLote, setNombreNuevoLote] = useState<string>(() => {
    return suggestMovementLoteName(lote.loteNro, defaultMovType);
  });

  // Producto químico para curado
  const [productoTratamiento, setProductoTratamiento] = useState<string>(() => {
    return lote.producto && lote.producto !== 'Sin Tratamiento' && lote.producto !== 'Ninguno'
      ? lote.producto
      : 'Maxim Quattro + Inoculante';
  });

  const [observaciones, setObservaciones] = useState<string>('');

  // Ubicación / Sector de Acopio
  const [alaNuevoLote, setAlaNuevoLote] = useState<string>(() => lote.ala || 'A');
  const [sectorNuevoLote, setSectorNuevoLote] = useState<string>(() => lote.sector || '1');
  const [ubicacionAcopioNuevoLote, setUbicacionAcopioNuevoLote] = useState<string>(() => {
    if (lote.ubicacionAcopio && lote.ubicacionAcopio.trim()) return lote.ubicacionAcopio.trim();
    if (lote.ala && lote.sector) return `Ala ${lote.ala} · Sector ${lote.sector}`;
    return lote.ala ? `Ala ${lote.ala}` : 'Ala A · Sector 1';
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Restablecer valores cuando cambia el lote
  useEffect(() => {
    if (lote) {
      const initType = lote.tipo === 'Intermedio' ? 'intermedio_a_final' : 'final_a_final_tratado';
      setTipoMovimiento(initType);
      setCantidadBolsas(lote.stockBolsas > 0 ? lote.stockBolsas : 1);
      setEnvaseDeseadoId('origen');
      setCustomKgPorBolsa(lote.kgPorBolsa || 800);
      setNombreNuevoLote(suggestMovementLoteName(lote.loteNro, initType));
      setFechaMovimiento(new Date().toISOString().split('T')[0]);
      setAlaNuevoLote(lote.ala || 'A');
      setSectorNuevoLote(lote.sector || '1');
      setUbicacionAcopioNuevoLote(
        lote.ubicacionAcopio && lote.ubicacionAcopio.trim()
          ? lote.ubicacionAcopio.trim()
          : lote.ala && lote.sector
          ? `Ala ${lote.ala} · Sector ${lote.sector}`
          : lote.ala
          ? `Ala ${lote.ala}`
          : 'Ala A · Sector 1'
      );
      setObservaciones('');
      setErrorMsg('');
    }
  }, [lote]);

  // Lista de productos químicos sugeridos
  const productosSugeridos = useMemo(() => {
    const list = new Set<string>();
    if (plantaConfig?.tratamientos && Array.isArray(plantaConfig.tratamientos)) {
      plantaConfig.tratamientos
        .filter((t) => !['Sin Tratar', 'Tratado', 'Sin Tratamiento', 'Ninguno'].includes(t))
        .forEach((p) => list.add(p));
    }
    list.add('Maxim Quattro + Inoculante');
    list.add('Maxim XL');
    list.add('Cruiser Maxx Semillero');
    list.add('Derosal Plus');
    list.add('Tiramsam');
    list.add('Standak Top');
    list.add('Inoculante Líquido');
    list.add('Rizoderma');
    allLotes.forEach((l) => {
      if (l.producto && l.producto !== 'Sin Tratamiento' && l.producto !== 'Ninguno' && l.producto.trim() !== '') {
        list.add(l.producto);
      }
      if (l.productoAplicado && l.productoAplicado.trim() !== '') {
        list.add(l.productoAplicado);
      }
    });
    return Array.from(list);
  }, [plantaConfig, allLotes]);

  // Cálculos de envase y pesos
  const kgOrigenPorBolsa = Number(lote.kgPorBolsa) || 800;
  const bolsasOrigenDisponibles = Number(lote.stockBolsas) || 0;
  const bolsasEgresadasOrigen = Math.max(0, cantidadBolsas || 0);
  const bolsasRemanentesOrigen = Math.max(0, bolsasOrigenDisponibles - bolsasEgresadasOrigen);

  // Kilos que se están moviendo
  const kgTotalesAMover = bolsasEgresadasOrigen * kgOrigenPorBolsa;
  const kgRemanentesOrigen = bolsasRemanentesOrigen * kgOrigenPorBolsa;

  // Envase deseado calculado
  const { nuevoKgPorBolsa, nuevoEnvaseLabel, cambiaEnvase } = useMemo(() => {
    if (envaseDeseadoId === 'origen') {
      return {
        nuevoKgPorBolsa: kgOrigenPorBolsa,
        nuevoEnvaseLabel: envaseOrigen.label,
        cambiaEnvase: false,
      };
    }
    if (envaseDeseadoId === 'custom') {
      const kg = Math.max(1, customKgPorBolsa || kgOrigenPorBolsa);
      return {
        nuevoKgPorBolsa: kg,
        nuevoEnvaseLabel: `Envase x ${kg} kg`,
        cambiaEnvase: kg !== kgOrigenPorBolsa,
      };
    }
    const match = OPCIONES_ENVASE_PREDEFINIDAS.find((o) => o.id === envaseDeseadoId);
    if (match) {
      return {
        nuevoKgPorBolsa: match.kgPorBolsa,
        nuevoEnvaseLabel: match.label,
        cambiaEnvase: match.kgPorBolsa !== kgOrigenPorBolsa,
      };
    }
    return {
      nuevoKgPorBolsa: kgOrigenPorBolsa,
      nuevoEnvaseLabel: envaseOrigen.label,
      cambiaEnvase: false,
    };
  }, [envaseDeseadoId, customKgPorBolsa, kgOrigenPorBolsa, envaseOrigen.label]);

  // Cantidad de bolsas resultantes en el nuevo envase (recalculadas conservando los kg totales de semilla)
  const bolsasResultantesMovidas = useMemo(() => {
    if (nuevoKgPorBolsa <= 0) return bolsasEgresadasOrigen;
    return Math.round(kgTotalesAMover / nuevoKgPorBolsa);
  }, [kgTotalesAMover, nuevoKgPorBolsa, bolsasEgresadasOrigen]);

  // ¿Se mueve la totalidad del lote?
  const esTotalidad = bolsasEgresadasOrigen === bolsasOrigenDisponibles;

  // ¿Requiere tratamiento curasemilla químico?
  const requiereTratamiento =
    tipoMovimiento === 'intermedio_a_final_tratado' || tipoMovimiento === 'final_a_final_tratado';

  // Manejador de selección de tipo de movimiento
  const handleSelectTipoMovimiento = (newType: TipoMovimientoId) => {
    setTipoMovimiento(newType);
    setNombreNuevoLote(suggestMovementLoteName(lote.loteNro, newType));
    setErrorMsg('');
  };

  const handleSelectAla = (newAla: string) => {
    setAlaNuevoLote(newAla);
    const sec = sectorNuevoLote || '1';
    setUbicacionAcopioNuevoLote(`Ala ${newAla} · Sector ${sec}`);
  };

  const handleSelectSector = (newSector: string) => {
    setSectorNuevoLote(newSector);
    const al = alaNuevoLote || 'A';
    setUbicacionAcopioNuevoLote(`Ala ${al} · Sector ${newSector}`);
  };

  const handleCopyUbicacionOrigen = () => {
    const origUbi =
      lote.ubicacionAcopio ||
      (lote.ala && lote.sector ? `Ala ${lote.ala} · Sector ${lote.sector}` : lote.ala ? `Ala ${lote.ala}` : '');
    setAlaNuevoLote(lote.ala || '');
    setSectorNuevoLote(lote.sector || '');
    setUbicacionAcopioNuevoLote(origUbi);
  };

  // Enviar formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!fechaMovimiento) {
      setErrorMsg('Debe seleccionar la Fecha del Movimiento.');
      return;
    }

    if (isNaN(cantidadBolsas) || cantidadBolsas <= 0) {
      setErrorMsg('La cantidad de bolsas a mover debe ser mayor a 0.');
      return;
    }

    if (cantidadBolsas > bolsasOrigenDisponibles) {
      setErrorMsg(
        `La cantidad seleccionada (${cantidadBolsas} bolsas) supera el stock disponible del lote origen (${bolsasOrigenDisponibles} bolsas).`
      );
      return;
    }

    if (requiereTratamiento && !productoTratamiento.trim()) {
      setErrorMsg('Debe especificar el producto curasemilla químico de tratamiento.');
      return;
    }

    // Si NO es la totalidad, se va a desdoblar y separar lote -> validar nombre del lote desdoblado
    if (!esTotalidad) {
      if (!nombreNuevoLote.trim()) {
        setErrorMsg('Debe ingresar la identificación para el lote desdoblado que mantendrá el origen.');
        return;
      }

      const nombreNormalizado = nombreNuevoLote.trim().toUpperCase();
      const clienteLote = lote.cliente;
      const nuevoLoteDocId = `${clienteLote.replace(/\s+/g, '_')}_${nombreNuevoLote.trim()}`;
      const colision = allLotes.some(
        (l) =>
          (l.id.toUpperCase() === nuevoLoteDocId.toUpperCase() || l.loteNro.toUpperCase() === nombreNormalizado) &&
          l.id !== lote.id
      );

      if (colision) {
        const confirmar = window.confirm(
          `Ya existe un lote con la numeración "${nombreNuevoLote.trim()}". ¿Desea continuar asignando este nombre?`
        );
        if (!confirmar) return;
      }
    }

    try {
      setIsSubmitting(true);

      const tipoMovimientoLabel =
        tipoMovimiento === 'intermedio_a_final'
          ? 'Intermedio a Final'
          : tipoMovimiento === 'intermedio_a_final_tratado'
          ? 'Intermedio a Final Curado'
          : tipoMovimiento === 'final_a_final_tratado'
          ? 'Final a Final Curado'
          : 'Movimiento de Envase';

      const horaActual = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
      const productoFinal = requiereTratamiento
        ? productoTratamiento.trim()
        : tipoMovimiento === 'intermedio_a_final'
        ? 'Sin Tratamiento'
        : lote.producto;

      const tratamientoFinal = requiereTratamiento
        ? ['Tratado']
        : tipoMovimiento === 'intermedio_a_final'
        ? ['Sin Tratar']
        : lote.tratamiento;

      const nuevoTipo =
        tipoMovimiento === 'intermedio_a_final' || tipoMovimiento === 'intermedio_a_final_tratado'
          ? 'Final'
          : lote.tipo;

      // =========================================================================
      // CASO 1: TOTALIDAD DEL LOTE -> CAMBIAR CUALITATIVAMENTE EL LOTE
      // NO generar un nuevo lote. Conservar identidad y actualizar en su ficha.
      // =========================================================================
      if (esTotalidad) {
        const detalleMovCualitativo = [
          `Movimiento cualitativo de la totalidad del lote: ${tipoMovimientoLabel}`,
          cambiaEnvase ? `Re-embolsado: de ${envaseOrigen.label} a ${nuevoEnvaseLabel} (${bolsasResultantesMovidas} bolsas)` : null,
          requiereTratamiento ? `Curado con ${productoFinal}` : null,
          `Kilos totales conservados: ${formatKg(kgTotalesAMover)} kg`
        ]
          .filter(Boolean)
          .join(' · ');

        const movCualitativo: MovimientoStock = {
          id: `MOV-CUALI-${Date.now()}`,
          fecha: fechaMovimiento,
          hora: horaActual,
          tipo: 'Ajuste',
          cantidadBolsas: bolsasResultantesMovidas,
          kgPorBolsa: nuevoKgPorBolsa,
          cantidadKg: kgTotalesAMover,
          detalle: detalleMovCualitativo,
        };

        const auditCualitativo = {
          id: `AUD-CUALI-${Date.now()}`,
          fechaHora: new Date().toISOString(),
          tipo: 'Edición',
          usuario: currentUser.nombre,
          descripcion: `Transformación cualitativa del lote ${lote.loteNro} (${tipoMovimientoLabel}). ${cambiaEnvase ? `Envase actualizado a ${nuevoEnvaseLabel} (${bolsasResultantesMovidas} bolsas).` : ''}`,
          detalles: `${detalleMovCualitativo}. Fecha del movimiento: ${fechaMovimiento}.`,
        };

        const loteOrigenActualizado: Lote = {
          ...lote,
          tipo: nuevoTipo,
          tratamiento: tratamientoFinal,
          producto: productoFinal,
          productoAplicado: requiereTratamiento ? productoFinal : lote.productoAplicado,
          fechaTratamiento: requiereTratamiento ? fechaMovimiento : lote.fechaTratamiento,
          stockBolsas: bolsasResultantesMovidas,
          kgPorBolsa: nuevoKgPorBolsa,
          stockKg: kgTotalesAMover,
          tipoEnvase: nuevoEnvaseLabel,
          envase: nuevoEnvaseLabel,
          esMovimiento: true,
          tipoMovimiento: tipoMovimientoLabel,
          fechaMovimiento: fechaMovimiento,
          fechaRealizacionMovimiento: fechaMovimiento,
          observaciones: observaciones.trim()
            ? `${lote.observaciones ? `${lote.observaciones} | ` : ''}${observaciones.trim()}`
            : lote.observaciones,
          historial: [movCualitativo, ...(lote.historial || [])],
          auditoria: [auditCualitativo, ...(lote.auditoria || [])],
        };

        await onConfirmMovimiento({
          loteOrigenActualizado,
          esTransformacionCompleta: true,
          tipoMovimientoLabel,
        });

        onClose();
        return;
      }

      // =========================================================================
      // CASO 2: MOVIMIENTO PARCIAL -> DESDOBLAR Y SEPARAR LOTE MANTENIENDO MISMO ORIGEN
      // =========================================================================
      const nombreLoteDesdoblado = nombreNuevoLote.trim();
      const nuevoLoteDocId = `${lote.cliente.replace(/\s+/g, '_')}_${nombreLoteDesdoblado}`;

      // 1. Egreso por desdoblamiento en el lote origen
      const movEgresoDesdoble: MovimientoStock = {
        id: `MOV-DESD-EGR-${Date.now()}`,
        fecha: fechaMovimiento,
        hora: horaActual,
        tipo: 'Salida por movimiento',
        tipoSalida: 'movimiento',
        cantidadBolsas: bolsasEgresadasOrigen,
        kgPorBolsa: kgOrigenPorBolsa,
        cantidadKg: kgTotalesAMover,
        detalle: `Desdoblamiento de ${bolsasEgresadasOrigen} bolsas (${formatKg(kgTotalesAMover)} kg) hacia lote separado ${nombreLoteDesdoblado} (${tipoMovimientoLabel})`,
        destino: nombreLoteDesdoblado,
      };

      const auditEgresoDesdoble = {
        id: `AUD-DESD-EGR-${Date.now()}`,
        fechaHora: new Date().toISOString(),
        tipo: 'Edición',
        usuario: currentUser.nombre,
        descripcion: `Desdoblamiento parcial de ${bolsasEgresadasOrigen} bolsas (${formatKg(kgTotalesAMover)} kg) hacia lote ${nombreLoteDesdoblado} manteniendo el mismo origen.`,
        detalles: `Stock remanente en lote origen: ${bolsasRemanentesOrigen} bolsas (${formatKg(kgRemanentesOrigen)} kg).`,
      };

      const loteOrigenActualizado: Lote = {
        ...lote,
        stockBolsas: bolsasRemanentesOrigen,
        stockKg: kgRemanentesOrigen,
        estado: bolsasRemanentesOrigen <= 0 ? 'Agotado' : lote.estado,
        historial: [movEgresoDesdoble, ...(lote.historial || [])],
        auditoria: [auditEgresoDesdoble, ...(lote.auditoria || [])],
      };

      // 2. Ingreso por desdoblamiento en el lote separado (MANTENIENDO UN MISMO ORIGEN)
      const movIngresoDesdoble: MovimientoStock = {
        id: `MOV-DESD-ING-${Date.now()}`,
        fecha: fechaMovimiento,
        hora: horaActual,
        tipo: 'Entrada por movimiento',
        cantidadBolsas: bolsasResultantesMovidas,
        kgPorBolsa: nuevoKgPorBolsa,
        cantidadKg: kgTotalesAMover,
        detalle: `Alta por desdoblamiento de lote desde origen ${lote.loteNro} (${tipoMovimientoLabel})${cambiaEnvase ? ` | Re-embolsado de ${envaseOrigen.label} a ${nuevoEnvaseLabel}` : ''}`,
      };

      const ubiFinalNuevoLote =
        ubicacionAcopioNuevoLote.trim() ||
        (alaNuevoLote && sectorNuevoLote
          ? `Ala ${alaNuevoLote} · Sector ${sectorNuevoLote}`
          : alaNuevoLote
          ? `Ala ${alaNuevoLote}`
          : lote.ubicacionAcopio || '');

      const auditNuevoLote = {
        id: `AUD-DESD-ALTA-${Date.now()}`,
        fechaHora: new Date().toISOString(),
        tipo: 'Creación',
        usuario: currentUser.nombre,
        descripcion: `Lote ${nombreLoteDesdoblado} generado por desdoblamiento desde ${lote.loteNro}, manteniendo mismo origen. Ubicación: ${ubiFinalNuevoLote || 'Sin asignar'}.`,
        detalles: `Alta: ${bolsasResultantesMovidas} bolsas (${formatKg(kgTotalesAMover)} kg) en envase ${nuevoEnvaseLabel}. Tipo: ${nuevoTipo}. Tratamiento: ${requiereTratamiento ? `Tratado (${productoFinal})` : 'Sin Tratar'}.`,
      };

      const nuevoLoteGenerado: Lote = {
        id: nuevoLoteDocId,
        loteNro: nombreLoteDesdoblado,
        // Hereda rigurosamente el mismo origen y datos de trazabilidad
        cliente: lote.cliente,
        especie: lote.especie,
        variedad: lote.variedad,
        categoria: lote.categoria || 'PRIMU',
        campaniaId: lote.campaniaId,
        silosOrigen: lote.silosOrigen,
        siloOrigen: lote.siloOrigen,
        bolsonOrigenId: lote.bolsonOrigenId,
        bolsonOrigenNro: lote.bolsonOrigenNro,
        sectorBolsonOrigen: lote.sectorBolsonOrigen,
        origenesBolson: lote.origenesBolson,
        humedad: lote.humedad,
        pesoDeMil: lote.pesoDeMil,
        loteOrigen: lote.loteNro || lote.id, // Mantiene mismo origen explícito
        // Nuevas cualidades aplicadas
        tipo: nuevoTipo,
        tratamiento: tratamientoFinal,
        producto: productoFinal,
        productoAplicado: requiereTratamiento ? productoFinal : '',
        fechaTratamiento: requiereTratamiento ? fechaMovimiento : undefined,
        stockBolsas: bolsasResultantesMovidas,
        kgPorBolsa: nuevoKgPorBolsa,
        stockKg: kgTotalesAMover,
        tipoEnvase: nuevoEnvaseLabel,
        envase: nuevoEnvaseLabel,
        fechaIngreso: fechaMovimiento,
        fechaMovimiento: fechaMovimiento,
        fechaRealizacionMovimiento: fechaMovimiento,
        fechaHoraProduccion: `${fechaMovimiento}T${horaActual}`,
        estado: 'Disponible',
        estadoRegistro: 'REALIZADO',
        estadoMovimiento: 'REALIZADO',
        esMovimiento: true,
        tipoMovimiento: `Desdoble: ${tipoMovimientoLabel}`,
        ala: alaNuevoLote || lote.ala || '',
        sector: sectorNuevoLote || lote.sector || '',
        ubicacionAcopio: ubiFinalNuevoLote,
        observaciones:
          observaciones.trim() ||
          `Lote desdoblado por movimiento (${tipoMovimientoLabel}) a partir de origen ${lote.loteNro}.`,
        historial: [movIngresoDesdoble],
        auditoria: [auditNuevoLote],
      };

      await onConfirmMovimiento({
        loteOrigenActualizado,
        nuevoLoteGenerado,
        esTransformacionCompleta: false,
        tipoMovimientoLabel,
      });

      onClose();
    } catch (err: any) {
      console.error('Error al procesar movimiento de lote:', err);
      setErrorMsg(err?.message || 'Ocurrió un error inesperado al registrar el movimiento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150 overflow-y-auto"
      id="modal-movimiento-lote"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full my-6 overflow-hidden text-left flex flex-col max-h-[92vh]">
        {/* Encabezado */}
        <div className="bg-[#00603C] text-white p-4 sm:p-5 flex justify-between items-center border-b border-emerald-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-amber-300 shadow-inner">
              <ArrowRightLeft className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-lg font-bold tracking-wide">
                  Movimiento de Lote
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950">
                  Operación Cualitativa
                </span>
              </div>
              <p className="text-xs text-emerald-100/90 mt-0.5">
                Lote Origen: <strong className="text-white font-mono">{lote.loteNro}</strong> · {lote.cliente} ({lote.especie} - {lote.variedad})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-emerald-100 hover:text-white hover:bg-emerald-800/80 rounded-xl transition cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info bar del Lote Origen */}
        <div className="bg-[#E3EFE7]/50 border-b border-[#00603C]/20 px-4 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-500 font-medium">Tipo actual:</span>
            <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded-md border border-slate-200">
              {lote.tipo}
            </span>
            <span className="text-slate-500 font-medium ml-1">Tratamiento:</span>
            <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded-md border border-slate-200">
              {Array.isArray(lote.tratamiento) ? lote.tratamiento.join(', ') : lote.tratamiento || 'Sin Tratar'}
            </span>
            <span className="text-slate-500 font-medium ml-1">Envase origen:</span>
            <span className="font-bold text-emerald-900 bg-emerald-100/70 px-2 py-0.5 rounded-md border border-emerald-300">
              {envaseOrigen.label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-600 font-medium">Stock disponible:</span>
            <span className="font-mono font-black text-[#00603C] text-sm bg-white px-2.5 py-0.5 rounded-md border border-[#00603C]/30 shadow-2xs">
              {bolsasOrigenDisponibles} bolsas ({formatKg(lote.stockKg)} kg)
            </span>
          </div>
        </div>

        {/* Formulario con Scroll */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-start gap-2.5 animate-in shake duration-150">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="text-xs font-semibold leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {/* 1. SELECCIÓN DE TIPO DE MOVIMIENTO CUALITATIVO */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-2">
              1. Seleccione el Tipo de Movimiento Cualitativo
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {/* Opción 1: Intermedio a Final */}
              <button
                type="button"
                id="btn-mov-intermedio-a-final"
                onClick={() => handleSelectTipoMovimiento('intermedio_a_final')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  tipoMovimiento === 'intermedio_a_final'
                    ? 'border-[#00603C] bg-[#E3EFE7] ring-2 ring-[#00603C]/20 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 text-xs">
                      1. Intermedio a Final
                    </span>
                    {tipoMovimiento === 'intermedio_a_final' && (
                      <CheckCircle2 className="w-4 h-4 text-[#00603C]" />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded">
                      Tipo: Final
                    </span>
                    <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded">
                      Sin Curar
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    Pasa a producto terminado final sin aplicación de curasemilla químico.
                  </p>
                </div>
              </button>

              {/* Opción 2: Intermedio a Final Curado */}
              <button
                type="button"
                id="btn-mov-intermedio-a-final-tratado"
                onClick={() => handleSelectTipoMovimiento('intermedio_a_final_tratado')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  tipoMovimiento === 'intermedio_a_final_tratado'
                    ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 text-xs">
                      2. Intermedio a Final Curado
                    </span>
                    {tipoMovimiento === 'intermedio_a_final_tratado' && (
                      <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded">
                      Tipo: Final
                    </span>
                    <span className="px-1.5 py-0.5 bg-purple-100 text-purple-800 text-[10px] font-bold rounded">
                      Curado Químico
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    Pasa a Final aplicando tratamiento curasemilla / inoculante.
                  </p>
                </div>
              </button>

              {/* Opción 3: Final a Final Curado */}
              <button
                type="button"
                id="btn-mov-final-a-final-tratado"
                onClick={() => handleSelectTipoMovimiento('final_a_final_tratado')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  tipoMovimiento === 'final_a_final_tratado'
                    ? 'border-purple-600 bg-purple-50/70 ring-2 ring-purple-500/20 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 text-xs">
                      3. Final a Final Curado
                    </span>
                    {tipoMovimiento === 'final_a_final_tratado' && (
                      <CheckCircle2 className="w-4 h-4 text-purple-600" />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">
                      Mantiene Final
                    </span>
                    <span className="px-1.5 py-0.5 bg-purple-100 text-purple-800 text-[10px] font-bold rounded">
                      Curado Químico
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    Aplica curasemilla químico a bolsas que ya eran producto Final sin tratar.
                  </p>
                </div>
              </button>

              {/* Opción 4: Movimiento de Envase (Re-embolsado) */}
              <button
                type="button"
                id="btn-mov-cambio-envase"
                onClick={() => handleSelectTipoMovimiento('cambio_envase')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  tipoMovimiento === 'cambio_envase'
                    ? 'border-amber-600 bg-amber-50/70 ring-2 ring-amber-500/20 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 text-xs">
                      4. Movimiento de Envase
                    </span>
                    {tipoMovimiento === 'cambio_envase' && (
                      <CheckCircle2 className="w-4 h-4 text-amber-600" />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-bold rounded">
                      Re-embolsado
                    </span>
                    <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded">
                      Cambio de kg
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    Transforma el fraccionamiento de envase (ej: Big Bag a bolsas x 20, 25, 40 kg).
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* 2. CANTIDAD DE BOLSAS A MOVER (SELECTOR DINÁMICO) */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Scissors className="w-3.5 h-3.5 text-[#00603C]" />
                <span>Cantidad de Bolsas a Mover</span>
                <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-slate-500">Atajos:</span>
                {[1, 5, 10, 20].map(
                  (num) =>
                    num < bolsasOrigenDisponibles && (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setCantidadBolsas(num)}
                        className="px-2 py-0.5 bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 rounded text-[10px] font-bold transition cursor-pointer"
                      >
                        {num} b.
                      </button>
                    )
                )}
                {bolsasOrigenDisponibles > 1 && (
                  <button
                    type="button"
                    onClick={() => setCantidadBolsas(Math.ceil(bolsasOrigenDisponibles / 2))}
                    className="px-2 py-0.5 bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 rounded text-[10px] font-bold transition cursor-pointer"
                  >
                    50% ({Math.ceil(bolsasOrigenDisponibles / 2)} b.)
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setCantidadBolsas(bolsasOrigenDisponibles)}
                  className={`px-2.5 py-0.5 rounded text-[10px] font-black transition cursor-pointer border ${
                    esTotalidad
                      ? 'bg-[#00603C] text-white border-[#00603C] shadow-xs'
                      : 'bg-emerald-100 hover:bg-emerald-200 text-[#00603C] border-emerald-300'
                  }`}
                >
                  Todo el lote ({bolsasOrigenDisponibles} b.)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div>
                <div className="relative">
                  <input
                    type="number"
                    id="input-cantidad-bolsas-movimiento"
                    required
                    min={1}
                    max={bolsasOrigenDisponibles}
                    value={cantidadBolsas || ''}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setCantidadBolsas(isNaN(val) ? 0 : val);
                    }}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono font-black text-lg focus:ring-2 focus:ring-[#00603C] focus:border-[#00603C] transition shadow-2xs"
                  />
                  <span className="absolute right-3.5 top-3 text-slate-400 font-bold text-xs pointer-events-none">
                    bolsas ({kgOrigenPorBolsa} kg/bolsa)
                  </span>
                </div>
              </div>

              {/* Indicador en tiempo real */}
              <div className="text-[11px] text-slate-700 bg-white p-3 rounded-xl border border-slate-200 space-y-1 shadow-2xs">
                <div className="flex justify-between">
                  <span>Bolsas seleccionadas:</span>
                  <strong className="text-emerald-700 font-mono font-bold">
                    {bolsasEgresadasOrigen} bolsas ({formatKg(kgTotalesAMover)} kg)
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Remanente en lote origen:</span>
                  <strong className="text-slate-800 font-mono">
                    {bolsasRemanentesOrigen} bolsas ({formatKg(kgRemanentesOrigen)} kg)
                  </strong>
                </div>
              </div>
            </div>

            {/* Banner Dinámico: TOTALIDAD (Cambio Cualitativo) vs PARCIAL (Desdoblamiento) */}
            {esTotalidad ? (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-950 flex items-start gap-2.5 animate-in fade-in">
                <Sparkles className="w-4 h-4 text-[#00603C] shrink-0 mt-0.5" />
                <div className="leading-snug">
                  <strong className="font-bold text-[#00603C] block text-xs">
                    Transformación Cualitativa en el Mismo Lote ({lote.loteNro})
                  </strong>
                  <p className="text-[11px] text-emerald-900 mt-0.5">
                    Al mover la <strong>totalidad de las {bolsasOrigenDisponibles} bolsas</strong>, no se genera un nuevo lote. Se modifican directamente los atributos cualitativos del lote actual en su propia ficha técnica.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-950 flex items-start gap-2.5 animate-in fade-in">
                <Scissors className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="leading-snug">
                  <strong className="font-bold text-amber-900 block text-xs">
                    Desdoblamiento y Separación de Lote (Mismo Origen)
                  </strong>
                  <p className="text-[11px] text-amber-900 mt-0.5">
                    Al no mover la totalidad, el lote se desdoblará: <strong>{bolsasRemanentesOrigen} bolsas</strong> permanecerán en el lote origen <strong>{lote.loteNro}</strong>, y las <strong>{bolsasEgresadasOrigen} bolsas</strong> se separarán en un lote desdoblado <strong>manteniendo exactamente el mismo origen de planta</strong>.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 3. MOVIMIENTO DE ENVASE: DESDE ENVASE DE ORIGEN AL ENVASE DESEADO */}
          <div className="p-4 bg-sky-50/70 border border-sky-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black uppercase tracking-wider text-sky-950 flex items-center gap-1.5">
                <Box className="w-3.5 h-3.5 text-sky-700" />
                <span>Movimiento de Envase (Fraccionamiento & Peso por Bolsa)</span>
              </label>
              <span className="text-[10px] font-mono text-sky-800 bg-sky-100 px-2 py-0.5 rounded border border-sky-300">
                Origen: {envaseOrigen.label}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div>
                <span className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                  Envase Deseado:
                </span>
                <select
                  value={envaseDeseadoId}
                  onChange={(e) => setEnvaseDeseadoId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-sky-300 rounded-xl text-slate-900 font-bold text-xs focus:ring-2 focus:ring-sky-600 focus:outline-none transition shadow-2xs cursor-pointer"
                >
                  <option value="origen">
                    Mantener envase de origen ({envaseOrigen.label})
                  </option>
                  <optgroup label="Fraccionamiento en Bolsas Menores">
                    <option value="bolsa_20">Bolsa x 20 kg</option>
                    <option value="bolsa_25">Bolsa x 25 kg</option>
                    <option value="bolsa_30">Bolsa x 30 kg</option>
                    <option value="bolsa_40">Bolsa x 40 kg</option>
                    <option value="bolsa_50">Bolsa x 50 kg</option>
                  </optgroup>
                  <optgroup label="Fraccionamiento en Big Bag">
                    <option value="big_bag_800">Big Bag x 800 kg</option>
                    <option value="big_bag_1000">Big Bag x 1000 kg</option>
                  </optgroup>
                  <option value="custom">Otro (personalizar kg por bolsa)...</option>
                </select>
              </div>

              {envaseDeseadoId === 'custom' && (
                <div>
                  <span className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                    Kilos por Bolsa Personalizados:
                  </span>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      max={5000}
                      value={customKgPorBolsa || ''}
                      onChange={(e) => setCustomKgPorBolsa(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      placeholder="Ej: 35, 45, 600..."
                      className="w-full px-3 py-2 bg-white border border-sky-300 rounded-xl text-slate-900 font-mono font-bold text-xs focus:ring-2 focus:ring-sky-600"
                    />
                    <span className="absolute right-3 top-2 text-slate-400 font-bold text-xs pointer-events-none">
                      kg / bolsa
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Recálculo ilustrativo de conversión de envase */}
            <div className="p-3 bg-white border border-sky-200 rounded-xl flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-sky-700 shrink-0" />
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">
                    Cálculo de Re-embolsado:
                  </span>
                  <div className="font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                    <span>{bolsasEgresadasOrigen} bolsas x {kgOrigenPorBolsa} kg ({formatKg(kgTotalesAMover)} kg)</span>
                    <ArrowRight className="w-3.5 h-3.5 text-sky-600" />
                    <span className="text-[#00603C] font-black text-sm">
                      {bolsasResultantesMovidas} bolsas de {nuevoKgPorBolsa} kg ({formatKg(kgTotalesAMover)} kg)
                    </span>
                  </div>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cambiaEnvase ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-slate-100 text-slate-600'}`}>
                {cambiaEnvase ? 'Cambio de Envase Activo' : 'Mismo Envase'}
              </span>
            </div>
          </div>

          {/* 4. DATOS DE IDENTIFICACIÓN & NOMBRE EN CASO DE DESDOBLAMIENTO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1.5">
                Fecha del Movimiento <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="input-fecha-movimiento"
                required
                value={fechaMovimiento}
                onChange={(e) => setFechaMovimiento(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 font-mono font-medium focus:ring-2 focus:ring-[#00603C] focus:border-[#00603C] transition shadow-2xs"
              />
            </div>

            {/* Nombre del Lote Desdoblado (Solo si no es la totalidad) */}
            {!esTotalidad ? (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-black uppercase tracking-wider text-amber-900">
                    Nombre del Lote Desdoblado <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setNombreNuevoLote(suggestMovementLoteName(lote.loteNro, tipoMovimiento))}
                    className="text-[10px] text-[#00603C] hover:underline font-bold cursor-pointer"
                    title="Restablecer sugerencia"
                  >
                    Sugerir
                  </button>
                </div>
                <input
                  type="text"
                  id="input-nombre-nuevo-lote"
                  required={!esTotalidad}
                  value={nombreNuevoLote}
                  onChange={(e) => setNombreNuevoLote(e.target.value)}
                  placeholder="Ej: Lote-1, ER01-FIN..."
                  className="w-full px-3 py-2 bg-white border border-amber-400 rounded-xl text-slate-900 font-mono font-black text-sm tracking-wide uppercase focus:ring-2 focus:ring-[#00603C] transition shadow-2xs"
                />
                <span className="text-[10px] text-amber-800 mt-1 block">
                  Hereda y mantiene exactamente el mismo origen de <strong>{lote.loteNro}</strong>.
                </span>
              </div>
            ) : (
              <div className="flex flex-col justify-center p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-emerald-900">
                  Lote a Actualizar:
                </span>
                <span className="font-mono font-black text-sm text-[#00603C]">
                  {lote.loteNro} (Mismo Lote)
                </span>
                <span className="text-[10px] text-emerald-800 mt-0.5">
                  Se mantiene el código identificador original.
                </span>
              </div>
            )}
          </div>

          {/* 5. PRODUCTO DE TRATAMIENTO (CONDICIONAL: CURADO) */}
          {requiereTratamiento && (
            <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-xl animate-in fade-in-50">
              <label className="block text-[11px] font-black uppercase tracking-wider text-purple-950 mb-1.5 flex items-center gap-1.5">
                <FlaskConical className="w-3.5 h-3.5 text-purple-700" />
                <span>Producto Químico de Curado / Inoculación</span>
                <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="input-producto-tratamiento"
                  list="lista-productos-tratamiento"
                  required={requiereTratamiento}
                  value={productoTratamiento}
                  onChange={(e) => setProductoTratamiento(e.target.value)}
                  placeholder="Ej: Maxim Quattro + Inoculante, Cruiser Maxx..."
                  className="w-full px-3 py-2 bg-white border border-purple-300 rounded-xl text-slate-900 font-semibold text-xs focus:ring-2 focus:ring-purple-600 focus:border-purple-600 transition shadow-2xs"
                />
                <datalist id="lista-productos-tratamiento">
                  {productosSugeridos.map((prod) => (
                    <option key={prod} value={prod} />
                  ))}
                </datalist>
              </div>
              <span className="text-[10px] text-purple-800 mt-1 block">
                Este tratamiento curasemilla quedará asentado en la trazabilidad oficial y Ficha Técnica del lote.
              </span>
            </div>
          )}

          {/* 6. UBICACIÓN / SECTOR DE ACOPIO */}
          <div className="p-3.5 bg-emerald-50/70 border border-emerald-300/80 rounded-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-[11px] font-black uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                <Warehouse className="w-4 h-4 text-[#00603C]" />
                <span>Sector de Acopio / Ubicación</span>
              </label>
              <div className="flex items-center gap-1.5">
                {lote.ubicacionAcopio || lote.ala ? (
                  <button
                    type="button"
                    onClick={handleCopyUbicacionOrigen}
                    className="px-2 py-0.5 bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded text-[10px] font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs"
                    title="Asignar la misma ubicación del lote origen"
                  >
                    <ArrowRight className="w-3 h-3 text-[#00603C]" />
                    Copiar de Origen ({lote.ubicacionAcopio || (lote.ala && lote.sector ? `Ala ${lote.ala} · Sec. ${lote.sector}` : `Ala ${lote.ala}`)})
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setAlaNuevoLote('');
                    setSectorNuevoLote('');
                    setUbicacionAcopioNuevoLote('');
                  }}
                  className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded text-[10px] font-medium transition cursor-pointer"
                >
                  Limpiar
                </button>
              </div>
            </div>

            <div>
              <input
                type="text"
                id="input-ubicacion-nuevo-lote"
                value={ubicacionAcopioNuevoLote}
                onChange={(e) => setUbicacionAcopioNuevoLote(e.target.value)}
                placeholder="Ej: Ala A · Sector 1, Acopio Central, Galpón 2..."
                className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-slate-900 font-bold text-xs focus:ring-2 focus:ring-[#00603C] focus:border-[#00603C] transition shadow-2xs"
              />
            </div>

            {/* Botones de Selección Rápida: Ala y Sector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 block mb-1">
                  Seleccionar Ala:
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {['A', 'B', 'C', 'D'].map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => handleSelectAla(a)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-black transition cursor-pointer border ${
                        alaNuevoLote === a
                          ? 'bg-[#00603C] text-white border-[#00603C] shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50 hover:border-emerald-300'
                      }`}
                    >
                      Ala {a}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 block mb-1">
                  Seleccionar Sector:
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {['1', '2', '3'].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleSelectSector(s)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-black transition cursor-pointer border ${
                        sectorNuevoLote === s
                          ? 'bg-[#00603C] text-white border-[#00603C] shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50 hover:border-emerald-300'
                      }`}
                    >
                      Sector {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 7. OBSERVACIONES */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1.5">
              Observaciones del Movimiento (opcional)
            </label>
            <textarea
              rows={2}
              id="textarea-observaciones-movimiento"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Notas sobre el movimiento, operario responsable, condiciones del re-embolsado..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 text-xs focus:ring-2 focus:ring-[#00603C] focus:border-[#00603C] transition shadow-2xs resize-none"
            />
          </div>

          {/* RESUMEN FINAL DE LA OPERACIÓN */}
          <div className="bg-slate-900 text-white p-4 rounded-xl text-xs space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-black text-[11px] uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {esTotalidad
                  ? 'Resumen: Transformación Cualitativa en Mismo Lote'
                  : 'Resumen: Desdoblamiento de Lote (Mismo Origen)'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-800 text-[11px]">
              <div>
                <div className="text-slate-400">
                  {esTotalidad ? `Lote Actual (${lote.loteNro}):` : `Lote Origen Restante (${lote.loteNro}):`}
                </div>
                <div className="font-semibold text-slate-200">
                  {esTotalidad ? (
                    <span>
                      Se actualiza cualitativamente · {bolsasResultantesMovidas} bolsas de {nuevoKgPorBolsa} kg ({formatKg(kgTotalesAMover)} kg)
                    </span>
                  ) : (
                    <span>
                      Remanente: {bolsasRemanentesOrigen} bolsas de {kgOrigenPorBolsa} kg ({formatKg(kgRemanentesOrigen)} kg)
                    </span>
                  )}
                </div>
              </div>

              <div>
                <div className="text-slate-400">
                  {esTotalidad ? 'Cualidades Finales Aplicadas:' : `Lote Desdoblado Separado (${nombreNuevoLote}):`}
                </div>
                <div className="font-semibold text-emerald-400">
                  {bolsasResultantesMovidas} bolsas ({formatKg(kgTotalesAMover)} kg) · {nuevoEnvaseLabel} · {requiereTratamiento ? `Curado (${productoTratamiento})` : 'Sin Tratar'}
                </div>
                {!esTotalidad && (
                  <div className="text-[10px] text-amber-300 mt-0.5">
                    Mantiene origen: <strong>{lote.loteNro}</strong>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* BOTONES DE ACCIÓN */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl border border-slate-300 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              id="btn-confirmar-movimiento-lote"
              disabled={isSubmitting}
              className="px-5 py-2 bg-[#00603C] hover:bg-[#004d30] text-white font-black rounded-xl shadow-md transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-300 stroke-[2.5]" />
              <span>
                {isSubmitting
                  ? 'Procesando...'
                  : esTotalidad
                  ? 'Confirmar Transformación de Lote'
                  : 'Confirmar y Desdoblar Lote'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
