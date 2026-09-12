/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Lote, MovimientoStock, EstadoLoteType, AuditLogEntry, MovimientoSilo, OrdenCarga, SalidaRegistrada } from '../types';
import { getLoteAuditoria } from '../utils/audit';
import { formatNumberArg, formatKg, formatBolsas, formatDateStr } from '../utils/formatters';
import { LogoSiloLoose } from './Logo';
import { ArrowLeft, ArrowUpRight, ArrowDownRight, Plus, AlertCircle, Trash2, ShieldCheck, Download, QrCode, Barcode, Clock, Calendar, User, Edit2, Edit3, KeyRound, X, Warehouse, FileText, FileSpreadsheet, Package, Loader2, RotateCcw, Check, CheckCircle, CheckCircle2, SlidersHorizontal, ChevronDown, ChevronUp, Tag, Truck, ArrowRight, Search, Layers, FileDown, Printer, Settings, MapPin } from 'lucide-react';
import { db, mapLoteToFirestore, sanitizeForFirestore } from '../lib/firebase';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { QrCodeModal } from './QrCodeModal';
import { BarcodeLabelModal } from './BarcodeLabelModal';
import { FichaTecnicaOficialCard } from './FichaTecnicaOficialCard';
import { ImprimirFichaTecnica } from './ImprimirFichaTecnica';
import { BatchPrintIdBolsasModal } from './BatchPrintIdBolsasModal';
import { QrTrazabilidadLote } from './QrTrazabilidadLote';
import { exportWithHtml2Pdf } from '../utils/exportPdf';
import { printWithActiveClass } from '../utils/printHelper';
import { BitacoraMovimientosTable } from './BitacoraMovimientosTable';

interface LoteDetailProps {
  lote: Lote;
  movimientosSilo?: MovimientoSilo[];
  ordenesCarga?: OrdenCarga[];
  salidas?: SalidaRegistrada[];
  readOnly?: boolean;
  onBack: () => void;
  onSaveLote?: (lote: Lote) => Promise<void> | void;
  onUpdateLoteStock: (loteId: string, nuevosMovimientos: MovimientoStock[], nuevoStockBolsas: number, nuevoStockKg: number, nuevoEstado: EstadoLoteType) => void;
  onRegistrarSalida?: (loteId: string) => void;
  onUpdateLoteLocation?: (loteId: string, ala: string, sector: string, ubicacionAcopio?: string) => Promise<void>;
  onUpdateLoteInase?: (loteId: string, inaseInicio: string, inaseFinal: string) => Promise<void> | void;
  onNavigateToSilos?: (siloId?: string) => void;
}

export const LoteDetail: React.FC<LoteDetailProps> = ({
  lote,
  movimientosSilo,
  ordenesCarga = [],
  salidas = [],
  readOnly = false,
  onBack,
  onSaveLote,
  onUpdateLoteStock,
  onRegistrarSalida,
  onUpdateLoteLocation,
  onUpdateLoteInase,
  onNavigateToSilos,
}) => {
  const [showAddMovModal, setShowAddMovModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showInaseModal, setShowInaseModal] = useState(false);
  const [inaseInicioVal, setInaseInicioVal] = useState(lote.inaseInicio || '');
  const [inaseFinalVal, setInaseFinalVal] = useState(lote.inaseFinal || '');
  const [isSavingInase, setIsSavingInase] = useState(false);

  // Estados de Ubicación / Sector de Acopio
  const [selectedAla, setSelectedAla] = useState(lote.ala || '');
  const [selectedSector, setSelectedSector] = useState(lote.sector || '');
  const [ubicacionAcopioVal, setUbicacionAcopioVal] = useState(() => {
    if (lote.ubicacionAcopio && lote.ubicacionAcopio.trim()) return lote.ubicacionAcopio.trim();
    if (lote.ala && lote.sector) return `Ala ${lote.ala} · Sector ${lote.sector}`;
    return lote.ala ? `Ala ${lote.ala}` : '';
  });
  const [isEditingLocationInline, setIsEditingLocationInline] = useState(false);
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const [fecha, setFecha] = useState(() => new Date().toISOString().split('T')[0]);
  const [tipoMov, setTipoMov] = useState<'Pasado a Consumo' | 'Ajuste de Auditoría'>('Pasado a Consumo');
  const [bolsas, setBolsas] = useState<number>(() => Math.min(10, lote.stockBolsas || 1));
  const [kgBolsa, setKgBolsa] = useState<number>(lote.kgPorBolsa || 40);

  // Helper para obtener el número actual de Alta de bolsas registrado en el lote
  const getAltaBolsasActual = () => {
    const altaMov = (lote.historial || []).find(
      (m) =>
        m.tipo === 'Alta' ||
        (m.id && (m.id.toLowerCase().startsWith('alta-inicial') || m.id.toLowerCase().startsWith('mov-real') || m.id.toLowerCase().startsWith('alta-precarga'))) ||
        m.tipo === 'Entrada manual' ||
        (m.tipo === 'Entrada' && !(m.tipo || '').toLowerCase().includes('movimiento'))
    );
    if (altaMov && altaMov.cantidadBolsas > 0) {
      return altaMov.cantidadBolsas;
    }
    const salidasTot = (lote.historial || [])
      .filter((m) => {
        const t = (m.tipo || '').toLowerCase();
        return t.includes('salida') || t.includes('despacho') || t.includes('consumo') || m.tipoSalida !== undefined;
      })
      .reduce((acc, m) => acc + Math.abs(m.cantidadBolsas || 0), 0);
    return Math.max(lote.stockBolsas, lote.stockBolsas + salidasTot);
  };

  const [altaBolsasAudit, setAltaBolsasAudit] = useState<number>(() => getAltaBolsasActual());
  const [confirmPhraseAlta, setConfirmPhraseAlta] = useState('');
  const [isSavingAlta, setIsSavingAlta] = useState(false);
  const [detalle, setDetalle] = useState('');
  const [remitoClienteModal, setRemitoClienteModal] = useState('');
  const [destinoModal, setDestinoModal] = useState('');
  const [choferModal, setChoferModal] = useState('');
  const [error, setError] = useState('');
  const [isPrintingMode, setIsPrintingMode] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // Subpestaña dentro de Existencias y Stock: 'salidas' o 'todos'
  const [subTabStock, setSubTabStock] = useState<'salidas' | 'todos'>('salidas');
  const [filtroTipoSalida, setFiltroTipoSalida] = useState<'todos' | 'despacho' | 'movimiento' | 'cconsumo'>('todos');
  const [busquedaSalidas, setBusquedaSalidas] = useState('');

  // Modal para registrar Salida Manual de Stock
  const [showSalidaManualModal, setShowSalidaManualModal] = useState(false);
  const [fechaSalidaManual, setFechaSalidaManual] = useState(() => new Date().toISOString().split('T')[0]);
  const [horaSalidaManual, setHoraSalidaManual] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [bolsasSalidaManual, setBolsasSalidaManual] = useState<number>(1);
  const [kgBolsaSalidaManual, setKgBolsaSalidaManual] = useState<number>(lote.kgPorBolsa || 40);
  const [remitoClienteSalidaManual, setRemitoClienteSalidaManual] = useState('');
  const [destinoSalidaManual, setDestinoSalidaManual] = useState('');
  const [choferSalidaManual, setChoferSalidaManual] = useState('');
  const [motivoSalidaManual, setMotivoSalidaManual] = useState('');
  const [errorSalidaManual, setErrorSalidaManual] = useState('');

  // Estado borrador para la Ficha Técnica (permite previsualización y edición antes de imprimir o descargar)
  const [draftFichaLote, setDraftFichaLote] = useState<Lote>(lote);
  const [showEditFichaDrawer, setShowEditFichaDrawer] = useState(false);
  const [showEditFichaModal, setShowEditFichaModal] = useState(false);
  const [showImprimirFichaModal, setShowImprimirFichaModal] = useState(false);
  const [showBatchIdBolsasModal, setShowBatchIdBolsasModal] = useState(false);
  const [nombreLoteColor, setNombreLoteColor] = useState<'default' | 'red'>('default');
  const [initialFichaEditMode, setInitialFichaEditMode] = useState(false);
  const [fichaModificada, setFichaModificada] = useState(false);

  // Sincronizar draft, ubicación e INASE si cambia el lote original de props
  useEffect(() => {
    setDraftFichaLote(lote);
    setFichaModificada(false);
    setInaseInicioVal(lote.inaseInicio || '');
    setInaseFinalVal(lote.inaseFinal || '');
    setSelectedAla(lote.ala || '');
    setSelectedSector(lote.sector || '');
    setUbicacionAcopioVal(
      lote.ubicacionAcopio && lote.ubicacionAcopio.trim()
        ? lote.ubicacionAcopio.trim()
        : (lote.ala && lote.sector ? `Ala ${lote.ala} · Sector ${lote.sector}` : (lote.ala ? `Ala ${lote.ala}` : ''))
    );
  }, [lote]);

  // Guardar ubicación (tanto en Firestore como en estado local)
  const handleSaveLocation = async (newAla?: string, newSector?: string, customUbi?: string) => {
    setIsSavingLocation(true);
    try {
      const targetAla = newAla !== undefined ? newAla : selectedAla;
      const targetSector = newSector !== undefined ? newSector : selectedSector;
      const rawUbi = customUbi !== undefined ? customUbi : ubicacionAcopioVal;

      const ubiFinal =
        rawUbi.trim() ||
        (targetAla && targetSector
          ? `Ala ${targetAla} · Sector ${targetSector}`
          : (targetAla ? `Ala ${targetAla}` : ''));

      if (onUpdateLoteLocation) {
        await onUpdateLoteLocation(lote.id, targetAla, targetSector, ubiFinal);
      } else if (onSaveLote) {
        await onSaveLote({
          ...lote,
          ala: targetAla,
          sector: targetSector,
          ubicacionAcopio: ubiFinal,
        });
      }

      setSelectedAla(targetAla);
      setSelectedSector(targetSector);
      setUbicacionAcopioVal(ubiFinal);
      setDraftFichaLote((prev: any) => ({
        ...prev,
        ala: targetAla,
        sector: targetSector,
        ubicacionAcopio: ubiFinal,
      }));
      setIsEditingLocationInline(false);
      setShowLocationModal(false);
    } catch (err) {
      console.error('Error al guardar ubicación de lote:', err);
    } finally {
      setIsSavingLocation(false);
    }
  };

  const handleUpdateDraftField = (field: string, value: any) => {
    setDraftFichaLote((prev: any) => {
      const updated = { ...prev, [field]: value };
      if (field === 'stockBolsas' || field === 'kgPorBolsa') {
        const b = field === 'stockBolsas' ? Number(value) || 0 : prev.stockBolsas || 0;
        const k = field === 'kgPorBolsa' ? Number(value) || 0 : prev.kgPorBolsa || 40;
        updated.stockKg = b * k;
      }
      return updated;
    });
    setFichaModificada(true);
  };

  const handleResetDraft = () => {
    setDraftFichaLote(lote);
    setFichaModificada(false);
  };

  const handleConfirmarYPrevisualizar = () => {
    setShowEditFichaModal(false);
    setShowEditFichaDrawer(false);
    setIsPrintingMode(true);
  };

  // Buscar registro previo en movimientosSilo si proviene de silos de ingreso
  const targetSilos = new Set<string>();
  if (lote.silosOrigen) lote.silosOrigen.forEach((s) => targetSilos.add(s.siloId));

  const ingresoPrevioSilo = movimientosSilo
    ?.filter((m) => m.tipo === 'INGRESO' && targetSilos.has(m.siloId) && m.bolsonOrigenNro)
    .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))[0];

  const bolsonOrigenDisplay =
    lote.numeroBolsonOrigen ||
    lote.bolsonOrigenNro ||
    ingresoPrevioSilo?.bolsonOrigenNro ||
    'Sin dato';

  const [activeTab, setActiveTab] = useState<'stock' | 'audit'>('stock');

  const getEstadoBadgeStyle = (estado: EstadoLoteType) => {
    switch (estado) {
      case 'Disponible':
        return 'bg-[#E3EFE7] text-[#00603C] border-[#00603C]';
      case 'Reservado':
        return 'bg-[#F6EFDC] text-[#C9922E] border-[#C9922E]';
      case 'A Consumo':
        return 'bg-purple-100 text-purple-900 border-purple-400';
      case 'Agotado':
        return 'bg-[#A0522D]/10 text-[#A0522D] border-[#A0522D]';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const handleAgregarMovimiento = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const pesoBolsa = Number(kgBolsa) || lote.kgPorBolsa || 40;
    if (pesoBolsa <= 0) {
      setError('El peso por bolsa debe ser un valor positivo.');
      return;
    }

    if (tipoMov === 'Pasado a Consumo') {
      // Opción 1: Pasado a Consumo (dar por salidas a las bolsas seleccionadas y descontar al stock del lote)
      const cantBolsas = Number(bolsas);
      if (cantBolsas <= 0) {
        setError('La cantidad de bolsas a pasar a consumo debe ser mayor a 0.');
        return;
      }
      if (cantBolsas > lote.stockBolsas) {
        setError(`Stock insuficiente. Intenta restar ${cantBolsas} b. de un lote con sólo ${lote.stockBolsas} b. disponibles.`);
        return;
      }

      const totalKgMov = cantBolsas * pesoBolsa;
      const nuevoStockBolsas = Math.max(0, lote.stockBolsas - cantBolsas);
      const nuevoStockKg = Math.max(0, lote.stockKg - totalKgMov);
      const nuevoEstado: EstadoLoteType = nuevoStockBolsas === 0 ? 'A Consumo' : lote.estado;

      const nuevoMovimiento: MovimientoStock = {
        id: `MOV-CON-${Date.now()}`,
        fecha,
        tipo: 'Pasado a Consumo',
        cantidadBolsas: cantBolsas,
        kgPorBolsa: pesoBolsa,
        cantidadKg: totalKgMov,
        detalle: detalle.trim() || 'Pasado a consumo de bolsas',
        remitoCliente: remitoClienteModal.trim() || undefined,
        destino: destinoModal.trim() || 'Consumo',
        chofer: choferModal.trim() || undefined,
        tipoSalida: 'consumo',
      };

      const auditEntry: AuditLogEntry = {
        id: `AUD-CON-${Date.now()}`,
        fechaHora: new Date().toISOString(),
        tipo: 'Stock',
        usuario: 'Usuario',
        descripcion: `Pasado a Consumo: Egreso de ${cantBolsas} bolsas (${totalKgMov} kg) descontadas del stock.`,
        detalles: detalle.trim() || 'Ajuste general - Pasado a consumo'
      };

      const nuevoHistorial = [nuevoMovimiento, ...(lote.historial || [])];
      onUpdateLoteStock(lote.id, nuevoHistorial, nuevoStockBolsas, nuevoStockKg, nuevoEstado);

      if (onSaveLote) {
        try {
          await onSaveLote({
            ...lote,
            stockBolsas: nuevoStockBolsas,
            stockKg: nuevoStockKg,
            estado: nuevoEstado,
            historial: nuevoHistorial,
            auditoria: [auditEntry, ...(lote.auditoria || [])]
          });
        } catch (err) {
          console.warn('Error guardando auditoría de consumo:', err);
        }
      }

      setShowAddMovModal(false);
      setBolsas(Math.min(10, nuevoStockBolsas || 1));
      setDetalle('');
      setRemitoClienteModal('');
      setDestinoModal('');
      setChoferModal('');
    } else {
      // Opción 2: Ajuste por Auditoría (editar el número de alta de bolsas en el lote, este movimiento solo modificará el registro de "Total Ingresado (Alta)")
      if (confirmPhraseAlta.trim().toLowerCase() !== 'editar alta') {
        setError('Para autorizar la modificación del alta y guardar en la base de datos, debe escribir exactamente "editar alta".');
        return;
      }

      const nuevoAltaBolsas = Number(altaBolsasAudit);
      if (isNaN(nuevoAltaBolsas) || nuevoAltaBolsas < 0) {
        setError('El nuevo número de alta de bolsas debe ser un número mayor o igual a 0.');
        return;
      }

      const totalKgAlta = nuevoAltaBolsas * pesoBolsa;
      let foundAlta = false;

      const historialActualizado: MovimientoStock[] = (lote.historial || []).map((m) => {
        const tipoL = (m.tipo || '').toLowerCase();
        const idL = (m.id || '').toLowerCase();
        const detL = (m.detalle || '').toLowerCase();
        const isAlta =
          m.tipo === 'Alta' ||
          idL.startsWith('alta-inicial') ||
          idL.startsWith('alta-precarga') ||
          idL.startsWith('mov-real') ||
          m.tipo === 'Entrada manual' ||
          (m.tipo === 'Entrada' && !tipoL.includes('movimiento')) ||
          detL.includes('alta inicial') ||
          detL.includes('carga inicial') ||
          detL.includes('alta efectiva');

        if (isAlta && !foundAlta) {
          foundAlta = true;
          return {
            ...m,
            tipo: 'Alta',
            cantidadBolsas: nuevoAltaBolsas,
            kgPorBolsa: pesoBolsa,
            cantidadKg: totalKgAlta,
            detalle: m.detalle?.includes('ajustada')
              ? m.detalle
              : `${m.detalle || 'Alta de lote'} (Ajuste por auditoría: ${nuevoAltaBolsas} b.)`,
          };
        }
        return m;
      });

      if (!foundAlta) {
        historialActualizado.unshift({
          id: `alta-inicial-${lote.id}`,
          fecha: lote.fechaIngreso || lote.fechaMovimiento || fecha,
          tipo: 'Alta',
          cantidadBolsas: nuevoAltaBolsas,
          kgPorBolsa: pesoBolsa,
          cantidadKg: totalKgAlta,
          detalle: `Alta inicial del lote ajustada por auditoría a ${nuevoAltaBolsas} bolsas`,
        });
      }

      // Registrar movimiento de auditoría para trazabilidad
      const movAuditoria: MovimientoStock = {
        id: `MOV-AUD-ALTA-${Date.now()}`,
        fecha,
        tipo: 'Ajuste de Auditoría',
        cantidadBolsas: nuevoAltaBolsas,
        kgPorBolsa: pesoBolsa,
        cantidadKg: totalKgAlta,
        detalle: detalle.trim() || `Ajuste por Auditoría: Alta de bolsas modificada a ${nuevoAltaBolsas} b. (Total Ingresado Alta)`,
      };
      historialActualizado.unshift(movAuditoria);

      const auditEntry: AuditLogEntry = {
        id: `AUD-ALTA-${Date.now()}`,
        fechaHora: new Date().toISOString(),
        tipo: 'Edición',
        usuario: 'Auditoría',
        descripcion: `Ajuste por Auditoría: Total Ingresado (Alta) modificado a ${nuevoAltaBolsas} bolsas.`,
        detalles: `Modificación exclusiva del número de alta. Motivo: ${detalle.trim() || 'Ajuste por auditoría física'}`
      };

      setIsSavingAlta(true);
      try {
        // 1. Guardar de forma directa y atómica en Firestore para garantizar persistencia inmediata
        const batch = writeBatch(db);
        const loteRef = doc(db, 'lotes', lote.id);
        const movRef = doc(collection(db, 'lotes', lote.id, 'movimientos'), movAuditoria.id);
        const loteActualizado: Lote = {
          ...lote,
          historial: historialActualizado,
          auditoria: [auditEntry, ...(lote.auditoria || [])]
        };
        batch.set(loteRef, mapLoteToFirestore(loteActualizado));
        batch.set(movRef, sanitizeForFirestore(movAuditoria));
        await batch.commit();

        // 2. Actualizar estado en memoria y notificar al estado global
        onUpdateLoteStock(lote.id, historialActualizado, lote.stockBolsas, lote.stockKg, lote.estado);

        if (onSaveLote) {
          await onSaveLote(loteActualizado);
        }

        setShowAddMovModal(false);
        setConfirmPhraseAlta('');
        setDetalle('');
        setRemitoClienteModal('');
        setDestinoModal('');
        setChoferModal('');
      } catch (err) {
        console.error('Error al guardar alta de lote en base de datos:', err);
        // Respaldo de sincronización local y estado superior
        onUpdateLoteStock(lote.id, historialActualizado, lote.stockBolsas, lote.stockKg, lote.estado);
        if (onSaveLote) {
          try {
            await onSaveLote({
              ...lote,
              historial: historialActualizado,
              auditoria: [auditEntry, ...(lote.auditoria || [])]
            });
          } catch (saveErr) {
            console.warn('Error en fallback onSaveLote:', saveErr);
          }
        }
        setShowAddMovModal(false);
        setConfirmPhraseAlta('');
        setDetalle('');
      } finally {
        setIsSavingAlta(false);
      }
    }
  };

  // Registrar salida manual de stock con campos completos de trazabilidad
  const handleGuardarSalidaManual = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorSalidaManual('');

    if (bolsasSalidaManual <= 0) {
      setErrorSalidaManual('La cantidad de bolsas debe ser mayor a 0.');
      return;
    }

    if (bolsasSalidaManual > lote.stockBolsas) {
      setErrorSalidaManual(`Stock insuficiente. El lote solo dispone de ${lote.stockBolsas} bolsas.`);
      return;
    }

    const factorKg = kgBolsaSalidaManual || lote.kgPorBolsa || 40;
    const totalKg = bolsasSalidaManual * factorKg;
    const nuevoStockBolsas = Math.max(0, lote.stockBolsas - bolsasSalidaManual);
    const nuevoStockKg = Math.max(0, lote.stockKg - totalKg);
    const nuevoEstado: EstadoLoteType = nuevoStockBolsas === 0 ? 'Agotado' : lote.estado;

    const nuevoMovimientoSalida: MovimientoStock = {
      id: `MOV-SAL-${Date.now()}`,
      fecha: fechaSalidaManual,
      hora: horaSalidaManual || new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      tipo: 'Salida manual',
      cantidadBolsas: bolsasSalidaManual,
      kgPorBolsa: factorKg,
      cantidadKg: totalKg,
      detalle: motivoSalidaManual.trim() || `Salida manual registrada (${bolsasSalidaManual} bolsas)`,
      remitoCliente: remitoClienteSalidaManual.trim() || '-',
      destino: destinoSalidaManual.trim() || '-',
      chofer: choferSalidaManual.trim() || undefined,
      tipoSalida: 'manual'
    };

    const nuevoHistorial = [nuevoMovimientoSalida, ...(lote.historial || [])];
    onUpdateLoteStock(lote.id, nuevoHistorial, nuevoStockBolsas, nuevoStockKg, nuevoEstado);

    // Resetear y cerrar modal
    setShowSalidaManualModal(false);
    setBolsasSalidaManual(1);
    setRemitoClienteSalidaManual('');
    setDestinoSalidaManual('');
    setChoferSalidaManual('');
    setMotivoSalidaManual('');
  };

  // Pasar a Realizado directo: Dar de alta bolsas y sumar a los movimientos de Total Ingresado (Alta)
  const handlePasarARealizadoDirecto = async () => {
    const bolsas = lote.stockBolsas > 0 ? lote.stockBolsas : 1;
    const kgB = lote.kgPorBolsa || 40;
    const kgTot = lote.stockKg > 0 ? lote.stockKg : bolsas * kgB;
    const hoy = new Date().toISOString().split('T')[0];

    const movimientoAlta: MovimientoStock = {
      id: `MOV-REAL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      fecha: hoy,
      tipo: 'Alta',
      cantidadBolsas: bolsas,
      kgPorBolsa: kgB,
      cantidadKg: kgTot,
      detalle: `Alta efectiva de bolsas (Pasado a Realizado el ${hoy})`
    };

    const historialSinPrecarga = (lote.historial || []).filter(mov => {
      const idLower = (mov.id || '').toLowerCase();
      const detLower = (mov.detalle || '').toLowerCase();
      const tipoLower = (mov.tipo || '').toLowerCase();
      return !(
        idLower.startsWith('mov-pre') ||
        idLower.startsWith('alta-precarga') ||
        tipoLower.includes('precarga') ||
        detLower.includes('precarga') ||
        detLower.includes('pre-carga') ||
        detLower.includes('carga inicial')
      );
    });

    const nuevoHistorial = [movimientoAlta, ...historialSinPrecarga];

    const loteRealizado: Lote = {
      ...lote,
      estadoRegistro: 'REALIZADO',
      fechaIngreso: hoy,
      fechaHoraProduccion: `${hoy}T${new Date().toTimeString().slice(0, 5)}`,
      stockBolsas: bolsas,
      kgPorBolsa: kgB,
      stockKg: kgTot,
      estado: bolsas > 0 ? 'Disponible' : 'Agotado',
      historial: nuevoHistorial,
      auditoria: [
        {
          id: `AUD-REAL-${Date.now()}`,
          fechaHora: new Date().toISOString(),
          tipo: 'Edición',
          usuario: 'Operador Planta',
          descripcion: `Lote pasado a REALIZADO: Alta efectiva de ${bolsas} bolsas (${kgTot} kg).`,
        },
        ...(lote.auditoria || [])
      ]
    };

    if (onSaveLote) {
      await onSaveLote(loteRealizado);
    }
    onUpdateLoteStock(lote.id, nuevoHistorial, bolsas, kgTot, 'Disponible');
  };

  // Lista unificada de todas las salidas del lote (Despachos, Órdenes de Movimiento y Salidas por Consumo)
  const salidasList = useMemo(() => {
    const list: Array<{
      id: string;
      fecha: string;
      hora?: string;
      tipoSalidaCategoria: 'movimiento' | 'despacho' | 'consumo' | 'manual';
      tipoSalidaLabel: string;
      cantidadBolsas: number;
      cantidadKg: number;
      remitoCliente: string;
      destino: string;
      chofer?: string;
      detalle: string;
      ordenId?: string;
    }> = [];

    // 1. Desde el historial de movimientos del lote
    (lote.historial || []).forEach((mov) => {
      const tipoLower = (mov.tipo || '').toLowerCase();
      const detLower = (mov.detalle || '').toLowerCase();

      const isSalida =
        tipoLower.includes('salida') ||
        tipoLower.includes('consumo') ||
        tipoLower.includes('ajuste') ||
        mov.tipoSalida !== undefined ||
        tipoLower.includes('despacho') ||
        (mov.cantidadBolsas < 0 && !tipoLower.includes('alta') && !tipoLower.includes('entrada') && !tipoLower.includes('ingreso'));

      if (!isSalida) return;

      let cat: 'movimiento' | 'despacho' | 'consumo' | 'manual' = 'consumo';
      let label = 'Consumo';

      if (
        mov.tipoSalida === 'movimiento' ||
        tipoLower.includes('movimiento') ||
        detLower.includes('movimiento') ||
        detLower.includes('transferencia') ||
        detLower.includes('hacia nuevo lote') ||
        detLower.includes('desdoblamiento') ||
        detLower.includes('curado') ||
        detLower.includes('orden de movimiento') ||
        detLower.includes('precarga de movimiento')
      ) {
        cat = 'movimiento';
        label = 'Movimiento';
      } else if (
        mov.tipoSalida === 'despacho' ||
        tipoLower.includes('despacho') ||
        detLower.includes('despacho') ||
        detLower.includes('orden n°') ||
        detLower.includes('remito') ||
        mov.ordenId?.startsWith('OC-')
      ) {
        cat = 'despacho';
        label = 'Despacho';
      } else if (
        mov.tipoSalida === 'consumo' ||
        tipoLower.includes('consumo') ||
        detLower.includes('consumo')
      ) {
        cat = 'consumo';
        label = 'Consumo';
      } else {
        cat = 'consumo';
        label = 'Consumo';
      }

      let remito = mov.remitoCliente || '-';
      let dest = mov.destino || '-';
      let chof = mov.chofer;

      // Buscar si coincide con alguna Orden de Carga para enriquecer
      if (ordenesCarga && (remito === '-' || dest === '-')) {
        const oc = ordenesCarga.find(
          (o) =>
            (mov.ordenId && o.id === mov.ordenId) ||
            (mov.detalle && mov.detalle.includes(o.id)) ||
            o.loteId === lote.id ||
            o.loteId === lote.loteNro ||
            o.lotesOrigen?.some((lo) => lo.loteId === lote.id || lo.loteNro === lote.loteNro)
        );
        if (oc) {
          if (remito === '-' && oc.remitoCliente) remito = oc.remitoCliente;
          if (dest === '-' && oc.destino) dest = oc.destino;
          if (!chof && oc.chofer) chof = oc.chofer;
        }
      }

      // Buscar si coincide con alguna SalidaRegistrada legacy
      if (salidas && (remito === '-' || dest === '-')) {
        const sal = salidas.find((s) => s.loteId === lote.id && s.fecha === mov.fecha);
        if (sal) {
          if (remito === '-') remito = sal.id;
          if (dest === '-') dest = `Cliente ${sal.cliente}`;
          if (!chof) chof = sal.choferNombre;
        }
      }

      list.push({
        id: mov.id,
        fecha: mov.fecha,
        hora: mov.hora,
        tipoSalidaCategoria: cat,
        tipoSalidaLabel: label,
        cantidadBolsas: Math.abs(mov.cantidadBolsas),
        cantidadKg: Math.abs(mov.cantidadKg),
        remitoCliente: remito,
        destino: dest,
        chofer: chof,
        detalle: mov.detalle,
        ordenId: mov.ordenId,
      });
    });

    // 2. Incorporar Órdenes de Carga despachadas que apliquen a este lote
    if (ordenesCarga) {
      ordenesCarga
        .filter((o) => o.estado === 'Despachada' || o.stockDescontado === true)
        .forEach((o) => {
          const itemOrigen = o.lotesOrigen?.find(
            (lo) => lo.loteId === lote.id || lo.loteNro === lote.loteNro
          );
          const matchesSingle = o.loteId === lote.id || o.loteId === lote.loteNro;

          if (itemOrigen || matchesSingle) {
            const yaEnLista = list.some(
              (item) => item.ordenId === o.id || (item.detalle && item.detalle.includes(o.id))
            );
            if (!yaEnLista) {
              const b = itemOrigen ? itemOrigen.cantidadBolsas : o.cantidadBolsas;
              const k = itemOrigen ? itemOrigen.kgTotales : o.kgTotales;
              list.push({
                id: `OC-SAL-${o.id}`,
                fecha: o.fecha,
                tipoSalidaCategoria: 'despacho',
                tipoSalidaLabel: 'Despacho',
                cantidadBolsas: b,
                cantidadKg: k,
                remitoCliente: o.remitoCliente || '-',
                destino: o.destino || '-',
                chofer: o.chofer,
                detalle: `Despachado bajo Orden de Carga ${o.id}`,
                ordenId: o.id,
              });
            }
          }
        });
    }

    // 3. Incorporar salidas registradas directas si no están ya en la lista
    if (salidas) {
      salidas
        .filter((s) => s.loteId === lote.id || (s as any).loteNro === lote.loteNro)
        .forEach((s) => {
          const remitoVal = s.remitoCliente || (s as any).remito || s.id;
          const yaEnLista = list.some(
            (item) => item.ordenId === s.id || item.id === s.id || (item.remitoCliente && item.remitoCliente === remitoVal)
          );
          if (!yaEnLista) {
            const kgVal = s.totalKg || (s as any).cantidadKg || Math.abs(s.cantidadBolsas * (s.kgPorBolsa || lote.kgPorBolsa || 40));
            list.push({
              id: `SAL-${s.id}`,
              fecha: s.fecha,
              hora: (s as any).hora || '',
              tipoSalidaCategoria: 'despacho',
              tipoSalidaLabel: 'Despacho',
              cantidadBolsas: Math.abs(s.cantidadBolsas),
              cantidadKg: Math.abs(kgVal),
              remitoCliente: remitoVal,
              destino: s.cliente || s.destino || '-',
              chofer: s.choferNombre,
              detalle: `Despacho registrado a ${s.cliente || ''}`,
              ordenId: s.id,
            });
          }
        });
    }

    return list.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  }, [lote, ordenesCarga, salidas]);

  // Salidas filtradas por búsqueda y categoría
  const salidasFiltradas = useMemo(() => {
    return salidasList.filter((item) => {
      if (filtroTipoSalida === 'cconsumo') {
        if (item.tipoSalidaCategoria !== 'consumo' && item.tipoSalidaCategoria !== 'manual') {
          return false;
        }
      } else if (filtroTipoSalida !== 'todos' && item.tipoSalidaCategoria !== filtroTipoSalida) {
        return false;
      }
      if (busquedaSalidas.trim()) {
        const q = busquedaSalidas.toLowerCase();
        const matchesRemito = item.remitoCliente.toLowerCase().includes(q);
        const matchesDestino = item.destino.toLowerCase().includes(q);
        const matchesDetalle = item.detalle.toLowerCase().includes(q);
        const matchesChofer = item.chofer ? item.chofer.toLowerCase().includes(q) : false;
        const matchesLabel = item.tipoSalidaLabel.toLowerCase().includes(q);
        if (!matchesRemito && !matchesDestino && !matchesDetalle && !matchesChofer && !matchesLabel) {
          return false;
        }
      }
      return true;
    });
  }, [salidasList, filtroTipoSalida, busquedaSalidas]);

  // Descargar PDF de alta calidad utilizando html2pdf.js sobre el contenedor .ficha-a4
  const handleDownloadPdf = async () => {
    try {
      setIsDownloadingPdf(true);
      const safeLoteName = (draftFichaLote.loteNro || draftFichaLote.id || 'Lote').replace(/\s+/g, '_');
      const fileName = `Ficha_Lote_${safeLoteName}.pdf`;

      // Seleccionar el contenedor con la clase .ficha-a4 o el ID de la ficha oficial
      const targetElement =
        (document.querySelector('.ficha-a4') as HTMLElement) ||
        document.getElementById(`ficha-detail-card-${lote.id}`) ||
        document.getElementById(`ficha-print-direct-${lote.id}`);

      if (targetElement) {
        await exportWithHtml2Pdf(targetElement, fileName, {
          scale: 2.0,
          quality: 0.98,
          margin: [6, 8, 6, 8],
        });
      } else {
        setShowImprimirFichaModal(true);
      }
    } catch (err) {
      console.error('Error al exportar a PDF con html2pdf.js:', err);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Función para abrir vista de impresión
  const handlePrintFicha = (openEditor = false) => {
    setIsPrintingMode(true);
    setShowEditFichaDrawer(openEditor);
    if (!openEditor) {
      setTimeout(() => {
        printWithActiveClass(`ficha-detail-card-${lote.id}`);
      }, 400);
    }
  };

  if (isPrintingMode) {
    // Vista limpia para imprimir (Ficha de Lote - Plantilla A4 Fija) con panel de edición pre-impresión
    return (
      <div className="min-h-screen bg-gray-50 py-6 px-4 print:p-0 print:bg-white print:min-h-0">
        {/* Barra de Acciones de Impresión - Visible en pantalla, Oculta al imprimir */}
        <div className="actions-bar max-w-4xl mx-auto mb-4 flex flex-col gap-3 bg-white border border-gray-200 p-4 rounded-xl shadow-xs print:hidden" id="ficha-actions-bar-printing">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#E3EFE7] rounded-lg">
                <FileText className="w-5 h-5 text-[#00603C]" />
              </div>
              <div className="text-left">
                <h3 className="font-serif text-sm font-bold text-gray-800 uppercase tracking-wide flex items-center gap-2">
                  <span>Vista Previa / Descarga PDF (A4)</span>
                  {fichaModificada && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 text-[10px] rounded-full font-bold normal-case">
                      Ficha personalizada
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-gray-500 font-medium">
                  <strong className="font-mono text-[#00603C]">{draftFichaLote.loteNro || draftFichaLote.id}</strong> · {draftFichaLote.cliente || 'Agro Abacus'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => setShowEditFichaDrawer(!showEditFichaDrawer)}
                className={`px-3.5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition border flex items-center gap-1.5 cursor-pointer ${
                  showEditFichaDrawer
                    ? 'bg-[#00603C] text-white border-[#00603C]'
                    : 'bg-emerald-50 text-[#00603C] border-emerald-300 hover:bg-emerald-100'
                }`}
                title="Editar los datos que aparecerán en la Ficha Técnica antes de imprimir o descargar"
              >
                <Edit2 className="w-3.5 h-3.5 text-[#C9922E]" />
                <span>{showEditFichaDrawer ? 'Ocultar Editor' : 'Editar Ficha'}</span>
                {showEditFichaDrawer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {/* Selector Color Nombre Lote (Negro / Rojo) */}
              <div className="flex items-center gap-1 bg-gray-100 px-2.5 py-1 rounded-lg border border-gray-300 text-xs">
                <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mr-1">Nombre Lote:</span>
                <button
                  type="button"
                  id="btn-printing-nombre-lote-negro"
                  onClick={() => setNombreLoteColor('default')}
                  className={`px-2 py-0.5 rounded text-[10.5px] font-bold transition cursor-pointer ${
                    nombreLoteColor === 'default'
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                  title="Color de texto estándar para el nombre de lote"
                >
                  Negro
                </button>
                <button
                  type="button"
                  id="btn-printing-nombre-lote-rojo"
                  onClick={() => setNombreLoteColor('red')}
                  className={`px-2 py-0.5 rounded text-[10.5px] font-bold transition flex items-center gap-1 cursor-pointer ${
                    nombreLoteColor === 'red'
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'text-red-500 hover:text-red-700'
                  }`}
                  title="Color de texto rojo para el nombre de lote"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
                  Rojo
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsPrintingMode(false)}
                className="px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-gray-600 hover:text-gray-800 hover:bg-gray-100 border border-gray-200 rounded-lg transition cursor-pointer"
              >
                Volver
              </button>

              {/* Botón Descargar PDF */}
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isDownloadingPdf}
                className="px-5 py-2 text-xs font-black uppercase tracking-wider bg-[#00603C] hover:bg-[#004D30] text-white rounded-lg transition shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                title="Exportar Ficha Técnica a un PDF de alta calidad"
                id="btn-descargar-pdf-printing"
              >
                {isDownloadingPdf ? (
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                ) : (
                  <Download className="w-4 h-4 text-amber-400" />
                )}
                <span>{isDownloadingPdf ? 'Generando PDF...' : 'Descargar PDF'}</span>
              </button>
            </div>
          </div>

          {/* Panel Desplegable: Editar Ficha Técnica Antes de Imprimir */}
          {showEditFichaDrawer && (
            <div className="border-t border-gray-200 pt-4 mt-2 animate-in fade-in slide-in-from-top-2 duration-200 text-left">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-[#00603C]" />
                  <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                    Editar Datos de la Ficha Técnica (Edición previa a Impresión)
                  </h4>
                </div>
                <div className="flex items-center gap-2">
                  {fichaModificada && (
                    <button
                      type="button"
                      onClick={handleResetDraft}
                      className="text-xs text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Restablecer originales
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-xs bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">N° de Lote</label>
                  <input
                    type="text"
                    value={draftFichaLote.loteNro || ''}
                    onChange={(e) => handleUpdateDraftField('loteNro', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg font-bold text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Cliente</label>
                  <input
                    type="text"
                    value={draftFichaLote.cliente || ''}
                    onChange={(e) => handleUpdateDraftField('cliente', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg font-bold text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Especie</label>
                  <input
                    type="text"
                    value={draftFichaLote.especie || ''}
                    onChange={(e) => handleUpdateDraftField('especie', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg font-semibold text-gray-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Variedad</label>
                  <input
                    type="text"
                    value={draftFichaLote.variedad || ''}
                    onChange={(e) => handleUpdateDraftField('variedad', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg font-semibold text-gray-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Categoría</label>
                  <input
                    type="text"
                    value={draftFichaLote.categoria || ''}
                    onChange={(e) => handleUpdateDraftField('categoria', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg font-semibold text-gray-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Tipo de Lote</label>
                  <input
                    type="text"
                    value={draftFichaLote.tipo || ''}
                    onChange={(e) => handleUpdateDraftField('tipo', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg font-semibold text-gray-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Tratamiento / Curado</label>
                  <input
                    type="text"
                    value={Array.isArray(draftFichaLote.tratamiento) ? draftFichaLote.tratamiento.join(', ') : (draftFichaLote.tratamiento as any) || ''}
                    onChange={(e) => handleUpdateDraftField('tratamiento', e.target.value.split(',').map(s => s.trim()))}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg font-semibold text-gray-800"
                    placeholder="Sin Tratar, Curado..."
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Producto Químico</label>
                  <input
                    type="text"
                    value={draftFichaLote.producto || ''}
                    onChange={(e) => handleUpdateDraftField('producto', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg font-semibold text-gray-800"
                    placeholder="Ninguno, Maxim XL..."
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">N° Bolsón Origen</label>
                  <input
                    type="text"
                    value={(draftFichaLote as any).numeroBolsonOrigen || (draftFichaLote as any).bolsonOrigenNro || ''}
                    onChange={(e) => handleUpdateDraftField('numeroBolsonOrigen', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg font-semibold text-gray-800 font-mono"
                    placeholder="B-12, B-34..."
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Sector Bolsón Origen</label>
                  <input
                    type="text"
                    value={(draftFichaLote as any).sectorBolsonOrigen || ''}
                    onChange={(e) => handleUpdateDraftField('sectorBolsonOrigen', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg font-semibold text-gray-800"
                    placeholder="Ala A - Sector 1"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Ubicación de Acopio</label>
                  <input
                    type="text"
                    value={(draftFichaLote as any).ubicacionAcopio || (draftFichaLote.ala && draftFichaLote.sector ? `Ala ${draftFichaLote.ala} - Sector ${draftFichaLote.sector}` : '')}
                    onChange={(e) => handleUpdateDraftField('ubicacionAcopio', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg font-semibold text-gray-800"
                    placeholder="Ala A - Sector 1"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Cantidad de Bolsas</label>
                  <input
                    type="number"
                    min="1"
                    value={draftFichaLote.stockBolsas || 0}
                    onChange={(e) => handleUpdateDraftField('stockBolsas', Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg font-bold text-gray-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Kg por Bolsa</label>
                  <input
                    type="number"
                    min="1"
                    value={draftFichaLote.kgPorBolsa || 40}
                    onChange={(e) => handleUpdateDraftField('kgPorBolsa', Math.max(1, parseInt(e.target.value, 10) || 0))}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg font-bold text-gray-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Fecha Realizado / Ingreso</label>
                  <input
                    type="date"
                    value={draftFichaLote.fechaIngreso || ''}
                    onChange={(e) => handleUpdateDraftField('fechaIngreso', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg font-semibold text-gray-800"
                  />
                </div>

                <div className="sm:col-span-2 md:col-span-3 lg:col-span-4">
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Observaciones / Notas de la Ficha</label>
                  <textarea
                    rows={2}
                    value={draftFichaLote.observaciones || ''}
                    onChange={(e) => handleUpdateDraftField('observaciones', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg font-semibold text-gray-800 text-xs resize-none"
                    placeholder="Notas técnicas adicionales, destino especial, especificaciones de curado o acopio..."
                  />
                </div>
              </div>

              {/* Botón Confirmar y Previsualizar Impresión */}
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={handleConfirmarYPrevisualizar}
                  className="px-4 py-2 bg-[#00603C] hover:bg-[#254731] text-white text-xs font-bold uppercase tracking-wider rounded-lg transition shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4 text-[#C9922E]" />
                  <span>Confirmar y Previsualizar Impresión</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Estilos CSS Específicos para Impresión A4 de Hoja Única */}
        <style>{`
          @media print {
            body, html {
              background: #ffffff !important;
              margin: 0 !important;
              padding: 0 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            @page {
              size: A4 portrait;
              margin: 8mm 10mm 8mm 10mm;
            }
            header, nav, footer, button, .print\\:hidden, #nav-tab-dashboard, #nav-tab-lotes, #nav-tab-despachos, #nav-tab-historial-salidas, #nav-tab-importar, #lotes-stats-summary-bar {
              display: none !important;
            }
            .batch-print-page-break {
              page-break-after: always !important;
              break-after: page !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              max-height: 275mm !important;
              overflow: hidden !important;
              box-sizing: border-box !important;
            }
            .batch-print-page-break:last-child {
              page-break-after: auto !important;
              break-after: auto !important;
            }
          }
        `}</style>

        {/* Contenedor del Reporte Oficial Definitivo */}
        <div className="ficha-tecnica-a4-container max-w-4xl mx-auto print:max-w-none print:w-full">
          <FichaTecnicaOficialCard
            id={`ficha-detail-card-${lote.id}`}
            lote={draftFichaLote}
            nombreLoteColor={nombreLoteColor}
          />
        </div>
      </div>
    );
  }

  const handleDirectPrint = async () => {
    await printWithActiveClass('printable-ficha-lote-detail');
  };

  return (
    <div className="space-y-6" id="lote-detail-container">
      {/* 1. Vista interactiva en pantalla (oculta automáticamente durante @media print) */}
      <div id="lote-detail-interactive-view" className="space-y-6 print:hidden">
        {/* Botón de Retorno y Títulos */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-xs font-bold text-[#00603C] hover:text-[#254731] uppercase tracking-wider self-start cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver al Listado</span>
            </button>
            <span className="text-gray-300 hidden sm:inline">|</span>
            <h1 className="text-sm sm:text-base font-serif font-black text-slate-800 tracking-wide uppercase">
              FICHA TÉCNICA
            </h1>
          </div>

          {/* Barra de Acciones Superior: IMPRIMIR ETIQUETAS, CODIGO INASE y IMPRIMIR FICHA TECNICA */}
          <div className="flex flex-wrap items-center gap-2.5" id="lote-detail-actions-bar">
            {/* Botón Pasar a Realizado para lotes en PRE-CARGA */}
            {lote.estadoRegistro === 'PRE-CARGA' && !readOnly && (
              <button
                id="btn-pasar-realizado-lotedetail"
                onClick={handlePasarARealizadoDirecto}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition text-xs font-black uppercase tracking-wider shadow-sm cursor-pointer active:scale-95 border border-emerald-500"
                title="Pasar a Realizado: Dar de alta bolsas y sumar a los movimientos de Total Ingresado (Alta)"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-200 stroke-[2.5]" />
                <span>Pasar a Realizado (Alta Bolsas)</span>
              </button>
            )}

            {/* Botón EDITAR ALTA DE LOTE */}
            {!readOnly && (
              <button
                id="btn-editar-alta-lotedetail"
                onClick={() => {
                  setTipoMov('Ajuste de Auditoría');
                  setAltaBolsasAudit(getAltaBolsasActual());
                  setKgBolsa(lote.kgPorBolsa || 40);
                  setConfirmPhraseAlta('');
                  setError('');
                  setShowAddMovModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-900 rounded-xl transition text-xs font-black uppercase tracking-wider shadow-xs cursor-pointer active:scale-95 border border-blue-200"
                title="Editar datos de alta de lote y guardar en base de datos (requiere confirmación 'editar alta')"
              >
                <Edit3 className="w-4 h-4 text-blue-700 stroke-[2.5]" />
                <span>Editar Alta</span>
              </button>
            )}

            {/* Botón IMPRIMIR ETIQUETAS */}
            <button
              id="btn-imprimir-etiquetas-lotedetail"
              onClick={() => setShowBatchIdBolsasModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl transition text-xs font-black uppercase tracking-wider shadow-sm cursor-pointer active:scale-95 border border-amber-300"
              title="Abrir módulo de impresión de etiquetas (ID Bolsas / Rótulos) con selector de color para identificación"
            >
              <Tag className="w-4 h-4 text-slate-950 stroke-[2.5]" />
              <span>IMPRIMIR ETIQUETAS</span>
            </button>

            {/* Botón Codigo INASE (inicio/final) */}
            <button
              id="btn-codigo-inase-lotedetail"
              onClick={() => setShowInaseModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl transition text-xs font-black uppercase tracking-wider shadow-sm cursor-pointer active:scale-95 border border-emerald-700"
              title="Cargar o editar manualmente la numeración inicial y final del Código INASE para este lote"
            >
              <FileSpreadsheet className="w-4 h-4 text-amber-300 stroke-[2.5]" />
              <span>Codigo INASE (inicio/final)</span>
            </button>

            {/* Botón IMPRIMIR FICHA */}
            <button
              id="btn-imprimir-ficha-lotedetail"
              onClick={() => {
                setInitialFichaEditMode(false);
                setShowImprimirFichaModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#00603C] hover:bg-[#254731] text-white border border-[#00603C] rounded-xl transition text-xs font-black uppercase tracking-wider shadow-sm cursor-pointer active:scale-95"
              title="Abrir e imprimir Ficha Técnica Oficial optimizada para A4"
            >
              <Printer className="w-4 h-4 text-[#C9922E]" />
              <span>Imprimir Ficha</span>
            </button>
          </div>
        </div>

      {/* Grid de Contenido de Ficha */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Panel Izquierdo: Ficha Técnica */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden relative">
          
          {/* Marca de agua sutil en la tarjeta técnica */}
          <div className="absolute right-3 bottom-3 opacity-[0.04] pointer-events-none">
            <LogoSiloLoose size={120} color="#00603C" />
          </div>

          <div className="bg-[#00603C] p-5 text-white">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-mono font-bold text-emerald-200 tracking-wider">
                ID: {lote.id}
              </span>
              <span className={`px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full border bg-white text-[#00603C] border-white shadow-sm`}>
                {lote.estado}
              </span>
            </div>
            {/* N° DE LOTE GRANDE */}
            <div className="mt-4 mb-3">
              <span className="text-[10px] font-sans font-bold tracking-widest text-[#C9922E] uppercase block mb-0.5">NÚMERO DE LOTE</span>
              <h2 className="font-mono text-5xl sm:text-6xl font-black text-white tracking-tighter leading-none bg-black bg-opacity-20 px-3 py-2 rounded-xl inline-block border border-white border-opacity-10">
                {lote.loteNro}
              </h2>
            </div>
            <h3 className="font-serif text-xl font-bold flex items-center gap-2 flex-wrap">
              <span>{lote.especie} · <span className="font-sans font-normal text-sm text-gray-200">{lote.variedad}</span></span>
              {lote.categoria && (
                <span className="px-2 py-0.5 bg-[#C9922E] text-white text-[10px] font-sans font-extrabold uppercase rounded border border-amber-300/40">
                  Cat: {lote.categoria}
                </span>
              )}
            </h3>
            <p className="text-xs text-gray-300 mt-1">{lote.cliente}</p>
          </div>

          <div className="p-5 space-y-4 text-xs">
            <div>
              <span className="text-[9px] uppercase tracking-wider text-gray-400 block font-bold">Categoría</span>
              <span className="font-extrabold text-[#00603C] text-sm block mt-0.5 uppercase">{lote.categoria || 'Sin especificar'}</span>
            </div>

            <div>
              <span className="text-[9px] uppercase tracking-wider text-gray-400 block font-bold">Tipo de Lote</span>
              <span className="font-semibold text-gray-800 text-sm block mt-0.5">{lote.tipo}</span>
            </div>

            <div className="border-t border-gray-50 pt-3">
              <span className="text-[9px] uppercase tracking-wider text-gray-400 block font-bold">Tratamiento del Lote</span>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {lote.tratamiento.map((t, idx) => (
                  <span key={idx} className="bg-[#E3EFE7] text-[#00603C] px-2 py-0.5 rounded text-[10px] font-semibold">
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-50 pt-3">
              <span className="text-[9px] uppercase tracking-wider text-gray-400 block font-bold">Producto Químico Aplicado</span>
              <span className="font-medium text-gray-700 text-sm block mt-0.5">{lote.producto}</span>
            </div>

            <div className="border-t border-gray-50 pt-3">
              <span className="text-[9px] uppercase tracking-wider text-gray-400 block font-bold">Fecha de Ingreso</span>
              <span className="font-medium text-gray-700 block mt-0.5">{formatDateStr(lote.fechaIngreso)}</span>
            </div>

            {/* Sección: Sector de Acopio / Ubicación */}
            <div className="border-t border-gray-100 pt-3 mt-3 bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-200/70 text-left">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9.5px] uppercase tracking-wider text-[#00603C] font-bold flex items-center gap-1.5">
                  <Warehouse className="w-3.5 h-3.5 text-[#C9922E]" />
                  Sector de Acopio / Ubicación
                </span>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => setIsEditingLocationInline(!isEditingLocationInline)}
                    className="text-[10.5px] font-bold text-[#00603C] hover:text-[#004d30] underline cursor-pointer flex items-center gap-1"
                  >
                    <Edit2 className="w-3 h-3" />
                    {isEditingLocationInline ? 'Cancelar' : 'Editar'}
                  </button>
                )}
              </div>

              {!isEditingLocationInline ? (
                <div className="space-y-2">
                  <div className="bg-white p-2.5 rounded-lg border border-emerald-200/70 shadow-2xs flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[9px] uppercase font-bold text-gray-400 block">Ubicación Actual</span>
                      <span className="font-sans font-black text-sm text-[#00603C] flex items-center gap-1.5 mt-0.5 truncate">
                        <MapPin className="w-3.5 h-3.5 text-[#00603C] shrink-0" />
                        {lote.ubicacionAcopio || (lote.ala && lote.sector ? `ALA: ${lote.ala} / SECTOR: ${lote.sector}` : (lote.ala ? `ALA: ${lote.ala}` : 'No asignado'))}
                      </span>
                    </div>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => setShowLocationModal(true)}
                        className="px-2 py-1 bg-emerald-100/80 hover:bg-emerald-200 text-[#00603C] text-[10px] font-black rounded-md transition cursor-pointer shrink-0"
                        title="Abrir selector de celdas"
                      >
                        Selector Celdas
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3 bg-white p-3 rounded-lg border border-emerald-300 shadow-2xs">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1">
                      Texto de Ubicación / Acopio
                    </label>
                    <input
                      type="text"
                      id="input-inline-ubicacion-acopio"
                      value={ubicacionAcopioVal}
                      onChange={(e) => setUbicacionAcopioVal(e.target.value)}
                      placeholder="Ej: Ala A · Sector 1, Galpón 2..."
                      className="w-full px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#00603C] focus:border-[#00603C]"
                    />
                  </div>

                  {/* Selección rápida de Ala y Sector */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[9px] font-black uppercase text-slate-500 block mb-1">Ala:</span>
                      <div className="grid grid-cols-4 gap-1">
                        {['A', 'B', 'C', 'D'].map((a) => (
                          <button
                            key={a}
                            type="button"
                            onClick={() => {
                              setSelectedAla(a);
                              const s = selectedSector || '1';
                              setUbicacionAcopioVal(`Ala ${a} · Sector ${s}`);
                            }}
                            className={`py-1 text-[11px] font-black rounded border transition cursor-pointer ${
                              selectedAla === a
                                ? 'bg-[#00603C] text-white border-[#00603C]'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50'
                            }`}
                          >
                            {a}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="text-[9px] font-black uppercase text-slate-500 block mb-1">Sector:</span>
                      <div className="grid grid-cols-3 gap-1">
                        {['1', '2', '3'].map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => {
                              setSelectedSector(s);
                              const a = selectedAla || 'A';
                              setUbicacionAcopioVal(`Ala ${a} · Sector ${s}`);
                            }}
                            className={`py-1 text-[11px] font-black rounded border transition cursor-pointer ${
                              selectedSector === s
                                ? 'bg-[#00603C] text-white border-[#00603C]'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50'
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Presets rápidos */}
                  <div className="flex flex-wrap gap-1">
                    {[
                      { label: 'Ala A · Sector 1', a: 'A', s: '1' },
                      { label: 'Ala A · Sector 2', a: 'A', s: '2' },
                      { label: 'Ala B · Sector 1', a: 'B', s: '1' },
                      { label: 'Acopio General', a: '', s: '' },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setSelectedAla(preset.a);
                          setSelectedSector(preset.s);
                          setUbicacionAcopioVal(preset.label);
                        }}
                        className="px-1.5 py-0.5 bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-900 border border-slate-200 rounded text-[9.5px] font-medium transition cursor-pointer"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  {/* Botones Guardar / Cancelar */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowLocationModal(true)}
                      className="text-[10px] text-[#00603C] hover:underline font-bold cursor-pointer"
                    >
                      Selector Avanzado
                    </button>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsEditingLocationInline(false)}
                        disabled={isSavingLocation}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded transition cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveLocation()}
                        disabled={isSavingLocation}
                        className="px-3 py-1 bg-[#00603C] hover:bg-[#004d30] text-white text-[10px] font-black rounded shadow-xs transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        {isSavingLocation ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Check className="w-3 h-3" />
                        )}
                        <span>Guardar</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-gray-50 pt-3">
              <span className="text-[9px] uppercase tracking-wider text-gray-400 block font-bold">Peso Promedio Bolsa</span>
              <span className="font-medium text-gray-700 block mt-0.5">{lote.kgPorBolsa || 40} kg por bolsa</span>
            </div>

            <div className="border-t border-gray-50 pt-3">
              <span className="text-[9px] uppercase tracking-wider text-gray-400 block font-bold">% Humedad del Lote</span>
              <span className="font-semibold text-gray-800 text-sm block mt-0.5">
                {lote.humedad !== undefined ? `${lote.humedad}%` : '13.5%'}
                <span className="text-[10px] text-gray-400 font-normal ml-1.5">(Dato Informativo)</span>
              </span>
            </div>

            {/* Sección: Vinculación y Origen de Proceso / Silo / Bolsón */}
            <div className="border-t border-gray-100 pt-3 mt-3 bg-[#E3EFE7]/40 p-3.5 rounded-xl border border-[#00603C]/15">
              <span className="text-[9.5px] uppercase tracking-wider text-[#00603C] block font-bold mb-2 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#C9922E]" />
                Trazabilidad y Origen de Carga
              </span>

              <div className="space-y-2 text-xs">
                {/* N° de Bolsón de origen */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-gray-500 font-medium shrink-0">N° Bolsón Origen:</span>
                  <span className="font-mono font-bold text-gray-800 bg-white px-2 py-0.5 rounded border border-gray-200 text-[11px] truncate max-w-[170px]">
                    {bolsonOrigenDisplay}
                  </span>
                </div>
              </div>
            </div>

            {/* Sección: Código INASE (Inicio / Final) */}
            <div className="border-t border-gray-100 pt-3 mt-3 bg-amber-50/50 p-3.5 rounded-xl border border-amber-200/60">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9.5px] uppercase tracking-wider text-amber-900 block font-bold flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-amber-700" />
                  Código INASE (Inicio / Final)
                </span>
                <button
                  type="button"
                  onClick={() => setShowInaseModal(true)}
                  className="text-[10.5px] font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer"
                >
                  Editar
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white p-2 rounded-lg border border-amber-200/50 shadow-2xs">
                  <span className="text-[9px] uppercase font-bold text-gray-500 block">INASE Inicio</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {lote.inaseInicio || '—'}
                  </span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-amber-200/50 shadow-2xs">
                  <span className="text-[9px] uppercase font-bold text-gray-500 block">INASE Final</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {lote.inaseFinal || '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Cuadro de Observaciones del Lote */}
            {lote.observaciones && (
              <div className="border-t border-gray-50 pt-3">
                <span className="text-[9px] uppercase tracking-wider text-gray-400 block font-bold">Observaciones / Notas</span>
                <div className="mt-1.5 p-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 font-sans leading-relaxed text-xs italic whitespace-pre-wrap">
                  {lote.observaciones}
                </div>
              </div>
            )}

            {/* Código QR de Trazabilidad Oficial (Full Size 300x300 con etiqueta y enlace público) */}
            <div className="border-t border-gray-100 pt-4 mt-4 flex flex-col items-center">
              <div className="w-full flex items-center justify-between mb-2">
                <span className="text-[9.5px] uppercase tracking-wider text-gray-400 font-bold block">
                  Código QR de Trazabilidad
                </span>
                <span className="text-[9px] font-mono font-bold text-[#00603C] bg-[#E3EFE7] px-2 py-0.5 rounded">
                  Oficial
                </span>
              </div>
              <div className="w-full flex justify-center cursor-pointer" onClick={() => setShowQrModal(true)}>
                <QrTrazabilidadLote
                  loteId={lote.id}
                  size={300}
                  className="w-full max-w-[280px]"
                />
              </div>
            </div>

            {/* Botón QR Ficha Técnica Pública */}
            <div className="pt-3">
              <button
                onClick={() => setShowQrModal(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-[#E3EFE7] hover:bg-[#cbe3d3] text-[#00603C] border border-[#00603C]/30 rounded-xl transition font-bold text-xs cursor-pointer shadow-2xs group"
                title="Generar código QR con la URL pública de la ficha técnica del lote para escaneo desde móviles"
              >
                <QrCode className="w-4 h-4 text-[#C9922E] group-hover:scale-110 transition-transform" />
                <span>Generar QR Ficha Técnica Pública</span>
              </button>
            </div>

            {/* Botón Imprimir Ficha Técnica A4 */}
            <div className="pt-2">
              <button
                id="btn-imprimir-ficha-panel-izquierdo"
                onClick={() => {
                  setInitialFichaEditMode(false);
                  setShowImprimirFichaModal(true);
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-[#00603C] hover:bg-[#254731] text-white rounded-xl transition font-black text-xs uppercase tracking-wider cursor-pointer shadow-sm active:scale-95 border border-[#00603C]"
                title="Abrir e imprimir Ficha Técnica Oficial optimizada para formato A4"
              >
                <Printer className="w-4 h-4 text-[#C9922E]" />
                <span>Imprimir Ficha</span>
              </button>
            </div>

            {/* Cuadro de Seguridad de Lote */}
            <div className="bg-[#F6EFDC] p-3.5 rounded-xl border border-[#C9922E] border-opacity-20 flex gap-2.5 mt-6">
              <ShieldCheck className="w-5 h-5 text-[#C9922E] shrink-0" />
              <div>
                <span className="font-bold text-[#C9922E] block uppercase tracking-wider text-[9px]">Garantía La Barrancosa</span>
                <span className="text-[10px] text-gray-600 block mt-0.5">Semilla clasificada con estándares de pureza y calidad Agro Abacus S.A.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Panel Derecho: Saldos y Tabla Historial */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Tarjetas de Saldo de Stock */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#E3EFE7] p-5 rounded-2xl border border-[#00603C] border-opacity-10 shadow-sm text-center">
              <span className="text-[10px] font-bold text-[#00603C] uppercase tracking-wider block">Existencias (Bolsas)</span>
              <span className="font-serif text-2xl font-bold text-[#00603C] mt-1.5 block">
                {formatNumberArg(lote.stockBolsas, 0)} b.
              </span>
            </div>
            <div className="bg-[#F6EFDC] p-5 rounded-2xl border border-[#C9922E] border-opacity-10 shadow-sm text-center">
              <span className="text-[10px] font-bold text-[#C9922E] uppercase tracking-wider block">Existencias (Kilogramos)</span>
              <span className="font-serif text-2xl font-bold text-[#C9922E] mt-1.5 block">
                {formatNumberArg(lote.stockKg, 0)} kg
              </span>
            </div>
          </div>

          {/* Historial de Movimientos y Auditoría de Eventos */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-3">
              <h4 className="font-serif text-base font-bold text-[#1A1A1A] uppercase tracking-wide">
                Auditoría y Trazabilidad de Lote
              </h4>
              
              {/* Selector de Pestañas */}
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg text-xs font-semibold self-start sm:self-center">
                <button
                  type="button"
                  onClick={() => setActiveTab('stock')}
                  className={`px-3 py-1.5 rounded-md transition duration-200 ${
                    activeTab === 'stock'
                      ? 'bg-[#00603C] text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Existencias y Stock
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('audit')}
                  className={`px-3 py-1.5 rounded-md transition duration-200 flex items-center gap-1.5 ${
                    activeTab === 'audit'
                      ? 'bg-[#00603C] text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Bitácora Completa
                  <span className={`inline-flex items-center justify-center px-1.5 py-0.25 text-[9px] font-bold rounded-full ${
                    activeTab === 'audit' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {getLoteAuditoria(lote).length}
                  </span>
                </button>
              </div>
            </div>

            {activeTab === 'stock' ? (
              <div className="space-y-6">
                {/* Sub-navegador de Existencias y Stock: Salidas vs Todos los Movimientos */}
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                  <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-lg self-start">
                    <button
                      type="button"
                      onClick={() => setSubTabStock('salidas')}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                        subTabStock === 'salidas'
                          ? 'bg-[#00603C] text-white shadow-xs'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <ArrowDownRight className="w-3.5 h-3.5" />
                      <span>Salidas de Stock</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                        subTabStock === 'salidas' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
                      }`}>
                        {salidasList.length}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubTabStock('todos')}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                        subTabStock === 'todos'
                          ? 'bg-[#00603C] text-white shadow-xs'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Todos los Movimientos</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                        subTabStock === 'todos' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
                      }`}>
                        {(lote.historial || []).length}
                      </span>
                    </button>
                  </div>

                  {!readOnly && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setTipoMov('Ajuste de Auditoría');
                          setAltaBolsasAudit(getAltaBolsasActual());
                          setKgBolsa(lote.kgPorBolsa || 40);
                          setConfirmPhraseAlta('');
                          setError('');
                          setShowAddMovModal(true);
                        }}
                        className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 text-xs font-bold rounded-lg shadow-2xs flex items-center gap-1.5 transition cursor-pointer"
                        title="Editar datos de alta del lote y guardar en base de datos (requiere confirmación 'editar alta')"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-blue-700" />
                        <span>Editar Alta</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTipoMov('Pasado a Consumo');
                          setBolsas(Math.min(10, lote.stockBolsas || 1));
                          setAltaBolsasAudit(getAltaBolsasActual());
                          setConfirmPhraseAlta('');
                          setError('');
                          setShowAddMovModal(true);
                        }}
                        className="px-3.5 py-1.5 bg-[#00603C] hover:bg-[#254731] text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition cursor-pointer"
                        title="Ajuste general de inventario: Pasado a Consumo o Ajuste por Auditoría de Alta"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        <span>Ajuste General</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* VISTA: SALIDAS DE STOCK (POR MOVIMIENTO, DESPACHO O CONSUMO) */}
                {subTabStock === 'salidas' && (
                  <div className="space-y-4">
                    {/* Tarjetas de Resumen de Salidas */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                            Salidas Registradas
                          </span>
                          <p className="text-xl font-bold font-serif text-amber-950 mt-0.5">
                            {salidasList.length} <span className="text-xs font-sans font-normal text-amber-800">operaciones</span>
                          </p>
                        </div>
                        <div className="p-2 bg-amber-100 rounded-lg text-amber-800">
                          <ArrowDownRight className="w-5 h-5" />
                        </div>
                      </div>

                      <div className="bg-rose-50/70 border border-rose-200/80 rounded-xl p-3 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800">
                            Bolsas Egresadas
                          </span>
                          <p className="text-xl font-bold font-mono text-rose-950 mt-0.5">
                            -{salidasList.reduce((acc, s) => acc + s.cantidadBolsas, 0)} <span className="text-xs font-sans font-normal text-rose-800">bolsas</span>
                          </p>
                        </div>
                        <div className="p-2 bg-rose-100 rounded-lg text-rose-800">
                          <Package className="w-5 h-5" />
                        </div>
                      </div>

                      <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#00603C]">
                            Kg Totales Egresados
                          </span>
                          <p className="text-xl font-bold font-mono text-emerald-950 mt-0.5">
                            -{formatNumberArg(salidasList.reduce((acc, s) => acc + s.cantidadKg, 0), 0)} <span className="text-xs font-sans font-normal text-emerald-800">kg</span>
                          </p>
                        </div>
                        <div className="p-2 bg-emerald-100 rounded-lg text-[#00603C]">
                          <Truck className="w-5 h-5" />
                        </div>
                      </div>
                    </div>

                    {/* Barra de Filtros y Búsqueda de Salidas */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-gray-100 shadow-2xs">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="text-[10px] font-bold uppercase text-gray-500 mr-1">Filtrar por:</span>
                        <button
                          type="button"
                          onClick={() => setFiltroTipoSalida('todos')}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                            filtroTipoSalida === 'todos'
                              ? 'bg-gray-800 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          Todas ({salidasList.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setFiltroTipoSalida('despacho')}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                            filtroTipoSalida === 'despacho'
                              ? 'bg-blue-600 text-white'
                              : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                          }`}
                        >
                          🚚 Despachos ({salidasList.filter(s => s.tipoSalidaCategoria === 'despacho').length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setFiltroTipoSalida('movimiento')}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                            filtroTipoSalida === 'movimiento'
                              ? 'bg-emerald-700 text-white'
                              : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                          }`}
                        >
                          🔄 Movimientos ({salidasList.filter(s => s.tipoSalidaCategoria === 'movimiento').length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setFiltroTipoSalida('cconsumo')}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                            filtroTipoSalida === 'cconsumo'
                              ? 'bg-[#A0522D] text-white'
                              : 'bg-amber-50 text-amber-900 hover:bg-amber-100'
                          }`}
                        >
                          📦 cconsumo ({salidasList.filter(s => s.tipoSalidaCategoria === 'consumo' || s.tipoSalidaCategoria === 'manual').length})
                        </button>
                      </div>

                      <div className="relative w-full sm:w-64">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={busquedaSalidas}
                          onChange={(e) => setBusquedaSalidas(e.target.value)}
                          placeholder="Buscar por remito, destino, tipo..."
                          className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:border-[#00603C]"
                        />
                      </div>
                    </div>

                    {/* Tabla de Salidas */}
                    {salidasFiltradas.length === 0 ? (
                      <div className="bg-white p-8 rounded-xl border border-gray-100 text-center text-gray-500 space-y-2">
                        <ArrowDownRight className="w-8 h-8 mx-auto text-gray-300" />
                        <p className="font-semibold text-xs text-gray-700">No se encontraron salidas para este lote con el filtro seleccionado.</p>
                        <p className="text-[11px] text-gray-400 max-w-md mx-auto">
                          Las salidas se registran automáticamente por Despachos realizados (Órdenes de Carga), transferencias por Movimiento entre lotes o por Pasado a Consumo en Ajuste General.
                        </p>
                      </div>
                    ) : (
                      <div className="bg-white rounded-xl border border-gray-100 shadow-xs overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[10px]">
                                <th className="py-2.5 px-3 whitespace-nowrap">Fecha de salida</th>
                                <th className="py-2.5 px-3 whitespace-nowrap">Tipo de salida</th>
                                <th className="py-2.5 px-3 text-right whitespace-nowrap">Cantidad de bolsas salidas</th>
                                <th className="py-2.5 px-3 text-right whitespace-nowrap">Kilogramos</th>
                                <th className="py-2.5 px-3 whitespace-nowrap">Nro Remito de Cliente</th>
                                <th className="py-2.5 px-3 whitespace-nowrap">Destino</th>
                                <th className="py-2.5 px-3 whitespace-nowrap">Detalle / Chofer</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {salidasFiltradas.map((sal) => {
                                const isDespacho = sal.tipoSalidaCategoria === 'despacho';
                                const isMovimiento = sal.tipoSalidaCategoria === 'movimiento';

                                return (
                                  <tr key={sal.id} className="hover:bg-amber-50/40 transition">
                                    {/* Fecha de salida */}
                                    <td className="py-2.5 px-3 font-semibold text-gray-700 whitespace-nowrap">
                                      <span>{formatDateStr(sal.fecha)}</span>
                                      {sal.hora && (
                                        <span className="block text-[10px] text-gray-400 font-mono font-normal">
                                          {sal.hora} hs
                                        </span>
                                      )}
                                    </td>

                                    {/* Tipo de salida (despacho, consumo, movimiento) */}
                                    <td className="py-2.5 px-3 whitespace-nowrap">
                                      <div className="flex items-center gap-1.5">
                                        {isDespacho ? (
                                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200 shadow-2xs">
                                            <Truck className="w-3.5 h-3.5 text-blue-600" />
                                            Despacho
                                          </span>
                                        ) : isMovimiento ? (
                                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                                            <ArrowRight className="w-3.5 h-3.5 text-[#00603C]" />
                                            Movimiento
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200 shadow-2xs">
                                            <ArrowDownRight className="w-3.5 h-3.5 text-[#A0522D]" />
                                            Consumo
                                          </span>
                                        )}
                                      </div>
                                    </td>

                                    {/* Cantidad de bolsas salidas */}
                                    <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700 whitespace-nowrap">
                                      -{sal.cantidadBolsas} b.
                                    </td>

                                    {/* Kilogramos */}
                                    <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-800 whitespace-nowrap">
                                      -{formatNumberArg(sal.cantidadKg, 0)} kg
                                    </td>

                                    {/* Nro Remito de Cliente */}
                                    <td className="py-2.5 px-3 font-mono text-gray-900 whitespace-nowrap">
                                      {sal.remitoCliente || '-'}
                                    </td>

                                    {/* Destino */}
                                    <td className="py-2.5 px-3 font-medium text-gray-700 whitespace-nowrap">
                                      {sal.destino || '-'}
                                    </td>

                                    {/* Detalle / Chofer */}
                                    <td className="py-2.5 px-3 text-gray-500 max-w-xs">
                                      <p className="truncate text-xs text-gray-700 font-medium" title={sal.detalle}>
                                        {sal.detalle}
                                      </p>
                                      {sal.chofer && (
                                        <p className="text-[10px] text-gray-400 truncate mt-0.5">
                                          Chofer: {sal.chofer}
                                        </p>
                                      )}
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

                {/* VISTA: TODOS LOS MOVIMIENTOS (Entradas, Salidas, Ajustes) con Bitácora */}
                {subTabStock === 'todos' && (
                  <BitacoraMovimientosTable
                    lote={lote}
                    ordenesCarga={ordenesCarga}
                    onUpdateLoteStock={onUpdateLoteStock}
                    onSaveLote={onSaveLote}
                    readOnly={readOnly}
                  />
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {/* TABLA OFICIAL DE BITÁCORA COMPLETA */}
                <BitacoraMovimientosTable
                  lote={lote}
                  ordenesCarga={ordenesCarga}
                  onUpdateLoteStock={onUpdateLoteStock}
                  onSaveLote={onSaveLote}
                  readOnly={readOnly}
                />

                {/* AUDITORÍA DE SISTEMA Y EVENTOS DE USUARIO */}
                <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-200 mt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h5 className="font-serif text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-[#00603C]" />
                        Auditoría de Seguridad y Eventos de Usuario
                      </h5>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Registro cronológico de creación, ediciones y modificaciones de usuario en el sistema.
                      </p>
                    </div>
                    <span className="text-[10px] font-mono font-bold bg-white px-2 py-0.5 rounded border border-gray-200 text-gray-600">
                      {getLoteAuditoria(lote).length} registros
                    </span>
                  </div>

                  <div className="flow-root max-h-[320px] overflow-y-auto pr-2">
                    <ul className="-mb-8">
                      {getLoteAuditoria(lote).map((event, eventIdx, arr) => {
                        let iconBg = 'bg-gray-100';
                        let iconColor = 'text-gray-600';
                        
                        if (event.tipo === 'Creación') {
                          iconBg = 'bg-[#E3EFE7]';
                          iconColor = 'text-[#00603C]';
                        } else if (event.tipo === 'Edición') {
                          iconBg = 'bg-[#F6EFDC]';
                          iconColor = 'text-[#C9922E]';
                        } else if (event.tipo === 'Stock') {
                          iconBg = 'bg-[#F5E5DC]';
                          iconColor = 'text-[#A0522D]';
                        }

                        // Formatear fecha y hora
                        let displayTime = '';
                        let displayDate = '';
                        try {
                          const dt = new Date(event.fechaHora);
                          if (!isNaN(dt.getTime())) {
                            displayDate = dt.toLocaleDateString('es-AR');
                            displayTime = dt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) + ' hs';
                          } else {
                            displayDate = event.fechaHora;
                          }
                        } catch (e) {
                          displayDate = event.fechaHora;
                        }

                        return (
                          <li key={event.id}>
                            <div className="relative pb-8">
                              {eventIdx !== arr.length - 1 ? (
                                <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                              ) : null}
                              <div className="relative flex space-x-3">
                                <div>
                                  <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-4 ring-white ${iconBg} ${iconColor}`}>
                                    {event.tipo === 'Creación' && <ShieldCheck className="w-4 h-4" />}
                                    {event.tipo === 'Edición' && <Edit2 className="w-4 h-4" />}
                                    {event.tipo === 'Stock' && <Clock className="w-4 h-4" />}
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0 pt-1.5">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                                    <div className="text-xs font-semibold text-gray-900">
                                      {event.descripcion}
                                    </div>
                                    <div className="text-[10px] text-gray-500 font-mono flex items-center gap-1.5">
                                      <span>{displayDate}</span>
                                      <span className="text-gray-300">|</span>
                                      <span>{displayTime}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className={`inline-flex items-center px-1.5 py-0.25 text-[9px] font-bold rounded-md border uppercase tracking-wider ${
                                      event.tipo === 'Creación'
                                        ? 'bg-[#E3EFE7] text-[#00603C] border-[#00603C]/10'
                                        : event.tipo === 'Edición'
                                        ? 'bg-[#F6EFDC] text-[#C9922E] border-[#C9922E]/10'
                                        : 'bg-[#F5E5DC] text-[#A0522D] border-[#A0522D]/10'
                                    }`}>
                                      {event.tipo}
                                    </span>
                                    <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
                                      <User className="w-3 h-3 text-gray-400" />
                                      {event.usuario}
                                    </span>
                                  </div>
                                  {event.detalles && (
                                    <p className="mt-2 text-[11px] text-gray-600 bg-white p-2.5 rounded-lg border border-gray-200 font-sans leading-relaxed whitespace-pre-wrap">
                                      {event.detalles}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Modal / Panel de Agregar Movimiento Manual */}
      {showAddMovModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-gray-100 animate-in fade-in zoom-in duration-200">
            <div className="border-b border-gray-100 pb-3 mb-4 flex justify-between items-center">
              <div>
                <span className="text-[10px] font-bold text-[#00603C] uppercase tracking-wider block">
                  Ajuste General de Inventario
                </span>
                <h5 className="font-serif text-lg font-bold text-[#1A1A1A]">
                  Lote: {lote.loteNro || lote.id}
                </h5>
              </div>
              <button
                type="button"
                onClick={() => setShowAddMovModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold cursor-pointer"
              >
                ×
              </button>
            </div>

            {error && (
              <div className="bg-[#F5E5DC] text-[#A0522D] p-3 rounded-lg flex items-start gap-2 text-xs border border-red-100 mb-4">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleAgregarMovimiento} className="space-y-4 text-xs text-left">
              <div>
                <label className="block text-gray-700 font-bold mb-1 uppercase tracking-wide">Fecha de Registro</label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 rounded-lg border border-gray-200"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1 uppercase tracking-wide">
                  Tipo de Operación Disponible (Seleccione una)
                </label>
                <select
                  value={tipoMov}
                  onChange={(e) => {
                    const val = e.target.value as 'Pasado a Consumo' | 'Ajuste de Auditoría';
                    setTipoMov(val);
                    setConfirmPhraseAlta('');
                    setError('');
                    if (val === 'Ajuste de Auditoría') {
                      setAltaBolsasAudit(getAltaBolsasActual());
                      setKgBolsa(lote.kgPorBolsa || 40);
                    }
                  }}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-[#00603C]/30 font-bold text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#00603C]"
                >
                  <option value="Pasado a Consumo">
                    1. Pasado a Consumo (dar por salidas bolsas y descontar al stock)
                  </option>
                  <option value="Ajuste de Auditoría">
                    2. Ajuste por Auditoría (editar número de alta de bolsas en el lote)
                  </option>
                </select>
              </div>

              {/* OPCIÓN 1: PASADO A CONSUMO */}
              {tipoMov === 'Pasado a Consumo' && (
                <>
                  {(() => {
                    const cantBolsas = Number(bolsas) || 0;
                    const pesoBolsa = Number(kgBolsa) || lote.kgPorBolsa || 40;
                    const totalKg = cantBolsas * pesoBolsa;
                    const nuevoStockBolsas = Math.max(0, lote.stockBolsas - cantBolsas);
                    const nuevoStockKg = Math.max(0, lote.stockKg - totalKg);
                    const stockInsuficiente = cantBolsas > lote.stockBolsas;

                    return (
                      <div className={`p-3 rounded-xl border text-xs ${
                        stockInsuficiente ? 'bg-red-50 border-red-300 text-red-900' : 'bg-amber-50/70 border-amber-200 text-amber-900'
                      }`}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-semibold text-gray-600 uppercase text-[10px]">Impacto de Salida por Consumo:</span>
                          <span className="font-mono font-bold px-2 py-0.5 rounded text-[11px] bg-rose-100 text-rose-800">
                            -{formatNumberArg(cantBolsas)} b. (-{formatNumberArg(totalKg)} kg)
                          </span>
                        </div>
                        <div className="flex justify-between items-center font-mono text-[11px]">
                          <span>Stock actual: <strong>{formatNumberArg(lote.stockBolsas)} b.</strong> ({formatNumberArg(lote.stockKg)} kg)</span>
                          <span>➔</span>
                          <span className={stockInsuficiente ? 'text-red-700 font-extrabold' : 'text-[#00603C] font-extrabold'}>
                            Nuevo stock: {formatNumberArg(nuevoStockBolsas)} b. ({formatNumberArg(nuevoStockKg)} kg)
                          </span>
                        </div>
                        {stockInsuficiente && (
                          <p className="mt-1.5 text-[11px] font-bold text-red-700">
                            ⚠️ Cantidad superior al stock disponible ({lote.stockBolsas} bolsas).
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-gray-700 font-bold mb-1 uppercase tracking-wide">
                        Bolsas a pasar a consumo *
                      </label>
                      <input
                        type="number"
                        value={bolsas}
                        onChange={(e) => setBolsas(Math.max(1, parseInt(e.target.value, 10) || 0))}
                        className="w-full px-3 py-2 bg-white rounded-lg border border-gray-200 font-bold font-mono"
                        min="1"
                        max={lote.stockBolsas}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 font-bold mb-1 uppercase tracking-wide">
                        Kg por Bolsa
                      </label>
                      <input
                        type="number"
                        value={kgBolsa}
                        onChange={(e) => setKgBolsa(Math.max(1, parseInt(e.target.value, 10) || 0))}
                        className="w-full px-3 py-2 bg-white rounded-lg border border-gray-200 font-mono"
                        min="1"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200/80">
                    <div>
                      <label className="block text-gray-700 font-bold mb-1 uppercase tracking-wide text-[10px]">
                        N° Remito de Cliente
                      </label>
                      <input
                        type="text"
                        value={remitoClienteModal}
                        onChange={(e) => setRemitoClienteModal(e.target.value)}
                        placeholder="Ej: R-0001-00045"
                        className="w-full px-3 py-2 bg-white rounded-lg border border-gray-200 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 font-bold mb-1 uppercase tracking-wide text-[10px]">
                        Destino
                      </label>
                      <input
                        type="text"
                        value={destinoModal}
                        onChange={(e) => setDestinoModal(e.target.value)}
                        placeholder="Consumo interno"
                        className="w-full px-3 py-2 bg-white rounded-lg border border-gray-200 text-xs"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-gray-700 font-bold mb-1 uppercase tracking-wide text-[10px]">
                        Chofer (opcional)
                      </label>
                      <input
                        type="text"
                        value={choferModal}
                        onChange={(e) => setChoferModal(e.target.value)}
                        placeholder="Nombre de chofer o responsable"
                        className="w-full px-3 py-2 bg-white rounded-lg border border-gray-200 text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-700 font-bold mb-1 uppercase tracking-wide">
                      Motivo / Detalle de Pasado a Consumo *
                    </label>
                    <input
                      type="text"
                      value={detalle}
                      onChange={(e) => setDetalle(e.target.value)}
                      className="w-full px-3 py-2 bg-white rounded-lg border border-gray-200"
                      placeholder="Ej: Semilla deteriorada, descarte a consumo, prueba de calidad..."
                      required
                    />
                  </div>
                </>
              )}

              {/* OPCIÓN 2: AJUSTE POR AUDITORÍA / EDICIÓN DE ALTA */}
              {tipoMov === 'Ajuste de Auditoría' && (
                <>
                  {(() => {
                    const altaActual = getAltaBolsasActual();
                    const nuevoAlta = Number(altaBolsasAudit) || 0;
                    const diffAlta = nuevoAlta - altaActual;
                    const nuevoTotalKg = nuevoAlta * (Number(kgBolsa) || 40);

                    return (
                      <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/70 text-blue-950 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-blue-800 uppercase text-[10px]">
                            Modificación de "Total Ingresado (Alta)":
                          </span>
                          <span className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                            diffAlta >= 0 ? 'bg-emerald-100 text-[#00603C]' : 'bg-amber-100 text-amber-900'
                          }`}>
                            {diffAlta >= 0 ? `+${diffAlta} b. en Alta` : `${diffAlta} b. en Alta`}
                          </span>
                        </div>
                        <div className="flex justify-between items-center font-mono text-[11px] bg-white/80 p-2 rounded-lg border border-blue-100">
                          <div>
                            <span className="text-gray-500 block text-[9px] uppercase">Alta Registrada</span>
                            <strong>{altaActual} b.</strong>
                          </div>
                          <span>➔</span>
                          <div>
                            <span className="text-blue-600 block text-[9px] uppercase font-bold">Nuevo Total Alta</span>
                            <span className="text-blue-950 font-extrabold">{nuevoAlta} b. ({formatNumberArg(nuevoTotalKg, 0)} kg)</span>
                          </div>
                        </div>
                        <p className="text-[11px] text-blue-800/90 pt-1 border-t border-blue-200/60">
                          ℹ️ Este movimiento modificará el registro de <strong>"Total Ingresado (Alta)"</strong> en la bitácora, trazabilidad y base de datos. El stock físico actual de <strong>{lote.stockBolsas} b.</strong> no se alterará.
                        </p>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-gray-700 font-bold mb-1 uppercase tracking-wide">
                        Nuevo N° de Alta de Bolsas *
                      </label>
                      <input
                        type="number"
                        value={altaBolsasAudit}
                        onChange={(e) => setAltaBolsasAudit(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-full px-3 py-2 bg-white rounded-lg border border-blue-300 font-bold font-mono text-blue-950 focus:ring-1 focus:ring-blue-500"
                        min="0"
                        required
                      />
                      <span className="text-[10px] text-gray-500 mt-0.5 block">
                        Modifica el volumen de alta inicial del lote
                      </span>
                    </div>

                    <div>
                      <label className="block text-gray-700 font-bold mb-1 uppercase tracking-wide">
                        Kg / Bolsa (3 Opciones) *
                      </label>
                      <div className="flex gap-1.5 mb-1.5">
                        {[25, 40, 800].map((kgOption) => (
                          <button
                            key={kgOption}
                            type="button"
                            onClick={() => setKgBolsa(kgOption)}
                            className={`flex-1 py-1 px-1.5 text-[11px] font-bold rounded-md border transition cursor-pointer ${
                              kgBolsa === kgOption
                                ? 'bg-[#00603C] text-white border-[#00603C]'
                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            {kgOption} kg
                          </button>
                        ))}
                      </div>
                      <select
                        value={kgBolsa}
                        onChange={(e) => setKgBolsa(Number(e.target.value) || 40)}
                        className="w-full px-3 py-1.5 bg-white rounded-lg border border-gray-200 font-mono font-bold text-xs"
                      >
                        <option value={25}>25 kg / bolsa</option>
                        <option value={40}>40 kg / bolsa</option>
                        <option value={800}>800 kg / bolsón (Big Bag)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-700 font-bold mb-1 uppercase tracking-wide">
                      Motivo del Ajuste por Auditoría *
                    </label>
                    <input
                      type="text"
                      value={detalle}
                      onChange={(e) => setDetalle(e.target.value)}
                      className="w-full px-3 py-2 bg-white rounded-lg border border-gray-200"
                      placeholder="Ej: Corrección por auditoría física de remanente de alta..."
                      required
                    />
                  </div>

                  {/* CAMPO DE CONFIRMACIÓN OBLIGATORIA ESCRITA "editar alta" */}
                  <div className="bg-amber-50/80 border-2 border-amber-300/80 rounded-xl p-3.5 space-y-2.5 shadow-2xs">
                    <div className="flex items-start gap-2">
                      <div className="p-1.5 bg-amber-100 rounded-lg text-amber-800 shrink-0 mt-0.5">
                        <KeyRound className="w-4 h-4" />
                      </div>
                      <div>
                        <h6 className="text-[11px] font-black uppercase tracking-wider text-amber-950">
                          Confirmación Requerida para Guardar
                        </h6>
                        <p className="text-[11px] text-amber-900 leading-snug mt-0.5">
                          Para autorizar la modificación del alta y habilitar el guardado definitivo en la base de datos, escriba explícitamente{' '}
                          <span className="font-mono font-bold bg-amber-200/80 px-1.5 py-0.5 rounded text-amber-950 select-all">
                            editar alta
                          </span>{' '}
                          a continuación:
                        </p>
                      </div>
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        value={confirmPhraseAlta}
                        onChange={(e) => setConfirmPhraseAlta(e.target.value)}
                        placeholder='Escriba exactamente "editar alta"'
                        autoComplete="off"
                        className={`w-full px-3 py-2 bg-white rounded-lg border font-mono text-xs font-bold transition focus:outline-none ${
                          confirmPhraseAlta.trim().toLowerCase() === 'editar alta'
                            ? 'border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-950 bg-emerald-50/30'
                            : 'border-amber-300 focus:border-amber-500 text-slate-900'
                        }`}
                      />
                      {confirmPhraseAlta.trim().toLowerCase() === 'editar alta' && (
                        <span className="absolute right-2.5 top-2 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Check className="w-3 h-3 stroke-[3]" />
                          Confirmación Válida
                        </span>
                      )}
                    </div>
                  </div>
                </>
              )}

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddMovModal(false);
                    setConfirmPhraseAlta('');
                    setError('');
                  }}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 font-semibold uppercase tracking-wider text-[10px] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={
                    tipoMov === 'Ajuste de Auditoría'
                      ? confirmPhraseAlta.trim().toLowerCase() !== 'editar alta' || isSavingAlta
                      : false
                  }
                  className={`px-5 py-2.5 rounded-lg font-bold uppercase tracking-wider text-[10px] cursor-pointer shadow-xs transition flex items-center gap-1.5 ${
                    tipoMov === 'Ajuste de Auditoría'
                      ? confirmPhraseAlta.trim().toLowerCase() === 'editar alta' && !isSavingAlta
                        ? 'bg-[#00603C] hover:bg-[#004D30] text-white'
                        : 'bg-gray-200 text-gray-400 border border-gray-300 cursor-not-allowed shadow-none'
                      : 'bg-[#00603C] hover:bg-[#254731] text-white'
                  }`}
                >
                  {isSavingAlta ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Guardando en BD...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        {tipoMov === 'Ajuste de Auditoría' ? 'Guardar Alta en BD' : 'Confirmar Ajuste'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Dedicado: REGISTRAR SALIDA MANUAL DE STOCK */}
      {showSalidaManualModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-gray-100 animate-in fade-in zoom-in duration-200">
            <div className="border-b border-gray-100 pb-3 mb-4 flex justify-between items-center">
              <div>
                <span className="text-[10px] font-bold text-[#A0522D] uppercase tracking-wider block">
                  Existencias y Stock • Salidas
                </span>
                <h5 className="font-serif text-lg font-bold text-[#1A1A1A]">
                  Registrar Salida Manual: {lote.loteNro || lote.id}
                </h5>
              </div>
              <button
                onClick={() => setShowSalidaManualModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold p-1"
              >
                ×
              </button>
            </div>

            {/* Alerta de Stock Disponible */}
            <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-900 flex items-center justify-between gap-3 mb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">Stock Disponible en Lote</span>
                <span className="font-mono font-bold text-base">{lote.stockBolsas} bolsas</span>
                <span className="text-gray-500 font-sans ml-1.5">({formatNumberArg(lote.stockKg, 0)} kg)</span>
              </div>
              <div className="text-right text-[11px] text-gray-600">
                Factor: <span className="font-bold">{lote.kgPorBolsa || 40} kg/b</span>
              </div>
            </div>

            {errorSalidaManual && (
              <div className="bg-[#F5E5DC] text-[#A0522D] p-3 rounded-lg flex items-start gap-2 text-xs border border-red-100 mb-4">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorSalidaManual}</span>
              </div>
            )}

            <form onSubmit={handleGuardarSalidaManual} className="space-y-4 text-xs text-left">
              {/* Fecha y Hora */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-bold mb-1 uppercase tracking-wide text-[10px] flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-gray-400" />
                    Fecha de la Salida *
                  </label>
                  <input
                    type="date"
                    value={fechaSalidaManual}
                    onChange={(e) => setFechaSalidaManual(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-bold mb-1 uppercase tracking-wide text-[10px] flex items-center gap-1">
                    <Clock className="w-3 h-3 text-gray-400" />
                    Hora de la Salida *
                  </label>
                  <input
                    type="time"
                    value={horaSalidaManual}
                    onChange={(e) => setHoraSalidaManual(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 font-medium font-mono"
                    required
                  />
                </div>
              </div>

              {/* Cantidades */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-bold mb-1 uppercase tracking-wide text-[10px]">
                    Bolsas a dar de baja *
                  </label>
                  <input
                    type="number"
                    value={bolsasSalidaManual}
                    onChange={(e) => setBolsasSalidaManual(Math.max(1, parseInt(e.target.value, 10) || 0))}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-gray-200 font-bold text-gray-900"
                    min="1"
                    max={lote.stockBolsas}
                    required
                  />
                  <span className="text-[10px] text-gray-400 mt-0.5 block">Máximo: {lote.stockBolsas} b.</span>
                </div>
                <div>
                  <label className="block text-gray-700 font-bold mb-1 uppercase tracking-wide text-[10px]">
                    Kg por Bolsa
                  </label>
                  <input
                    type="number"
                    value={kgBolsaSalidaManual}
                    onChange={(e) => setKgBolsaSalidaManual(Math.max(1, parseInt(e.target.value, 10) || 0))}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-gray-200 font-medium"
                    min="1"
                    required
                  />
                  <span className="text-[10px] text-gray-500 font-mono mt-0.5 block">
                    Total: {formatNumberArg(bolsasSalidaManual * kgBolsaSalidaManual, 0)} kg
                  </span>
                </div>
              </div>

              {/* Columnas específicas requeridas por usuario: Nro remito cliente y destino */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                <div>
                  <label className="block text-gray-800 font-bold mb-1 uppercase tracking-wide text-[10px]">
                    Nro Remito de Cliente
                  </label>
                  <input
                    type="text"
                    value={remitoClienteSalidaManual}
                    onChange={(e) => setRemitoClienteSalidaManual(e.target.value)}
                    placeholder="Ej: R-0001-00045892"
                    className="w-full px-3 py-2 bg-white rounded-lg border border-gray-200 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-gray-800 font-bold mb-1 uppercase tracking-wide text-[10px]">
                    Destino
                  </label>
                  <input
                    type="text"
                    value={destinoSalidaManual}
                    onChange={(e) => setDestinoSalidaManual(e.target.value)}
                    placeholder="Ej: Acopio Pergamino / Molino"
                    className="w-full px-3 py-2 bg-white rounded-lg border border-gray-200 text-xs font-medium"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-gray-700 font-bold mb-1 uppercase tracking-wide text-[10px]">
                    Chofer / Transporte (Opcional)
                  </label>
                  <input
                    type="text"
                    value={choferSalidaManual}
                    onChange={(e) => setChoferSalidaManual(e.target.value)}
                    placeholder="Ej: Transporte Gómez / Chofer Carlos Silva"
                    className="w-full px-3 py-2 bg-white rounded-lg border border-gray-200 text-xs"
                  />
                </div>
              </div>

              {/* Motivo / Detalle */}
              <div>
                <label className="block text-gray-700 font-bold mb-1 uppercase tracking-wide text-[10px]">
                  Concepto / Detalle de la Salida *
                </label>
                <input
                  type="text"
                  value={motivoSalidaManual}
                  onChange={(e) => setMotivoSalidaManual(e.target.value)}
                  placeholder="Ej: Entrega directa a cliente, retiro comercial, consumo..."
                  className="w-full px-3 py-2 bg-white rounded-lg border border-gray-200"
                  required
                />
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSalidaManualModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 font-semibold uppercase tracking-wider text-[10px] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#A0522D] hover:bg-[#8C4625] text-white rounded-lg font-bold uppercase tracking-wider text-[10px] shadow-xs cursor-pointer"
                >
                  Confirmar Salida Manual
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal QR Code */}
      {showQrModal && (
        <QrCodeModal
          lote={lote}
          onClose={() => setShowQrModal(false)}
        />
      )}

      {/* Modal Barcode Label */}
      {showBarcodeModal && (
        <BarcodeLabelModal
          lote={lote}
          onClose={() => setShowBarcodeModal(false)}
        />
      )}

      {/* Modal Asignar Ubicación */}
      {showLocationModal && (
        <div className="fixed inset-0 bg-[#1A1A1A]/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" id="assign-location-modal">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-2xl max-w-md w-full overflow-hidden text-left animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#00603C] to-[#254731] text-white p-5 flex justify-between items-center border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <Warehouse className="w-5 h-5 text-[#C9922E]" />
                <h3 className="font-serif text-base font-extrabold tracking-wide uppercase">
                  Asignar Ubicación de Acopio
                </h3>
              </div>
              <button
                onClick={() => setShowLocationModal(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido */}
            <div className="p-6 space-y-5">
              <div className="text-xs text-gray-500 font-medium leading-relaxed font-sans">
                Asigne o modifique el sector de acopio y depósito físico para el lote <strong className="font-mono text-gray-800">LOTE: {lote.loteNro}</strong>. Esto actualizará el stock, los reportes y la ficha técnica oficial.
              </div>

              {/* Input libre: Sector de Acopio / Ubicación */}
              <div className="space-y-1.5 bg-emerald-50/60 p-3 rounded-xl border border-emerald-200">
                <label className="block text-xs font-black uppercase tracking-wider text-emerald-950">
                  Sector de Acopio / Ubicación
                </label>
                <input
                  type="text"
                  id="modal-input-ubicacion-acopio"
                  value={ubicacionAcopioVal}
                  onChange={(e) => setUbicacionAcopioVal(e.target.value)}
                  placeholder="Ej: Ala A · Sector 1, Galpón 2, Acopio Central..."
                  className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#00603C] focus:border-[#00603C] shadow-2xs"
                />
                <span className="text-[10.5px] text-emerald-800 block">
                  Puede escribir una descripción personalizada o utilizar las celdas y atajos inferiores.
                </span>
              </div>

              {/* Grid de Ala */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                  Seleccionar Ala (Sector Lateral)
                </label>
                <div className="grid grid-cols-4 gap-2.5">
                  {['A', 'B', 'C', 'D'].map((alaLetter) => {
                    const isSelected = selectedAla === alaLetter;
                    return (
                      <button
                        key={alaLetter}
                        type="button"
                        onClick={() => {
                          setSelectedAla(alaLetter);
                          const sec = selectedSector || '1';
                          setUbicacionAcopioVal(`Ala ${alaLetter} · Sector ${sec}`);
                        }}
                        className={`py-3 px-2 rounded-xl border text-center transition flex flex-col items-center justify-center gap-0.5 cursor-pointer select-none ${
                          isSelected
                            ? 'bg-[#E3EFE7] border-[#00603C] text-[#00603C] font-extrabold shadow-xs ring-1 ring-[#00603C]'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 font-bold'
                        }`}
                      >
                        <span className="text-[9px] text-gray-400 font-semibold tracking-wider block">ALA</span>
                        <span className="text-lg font-mono leading-none">{alaLetter}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Grid de Sector */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                  Seleccionar Sector (Número de Celda)
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {['1', '2', '3'].map((sectorNum) => {
                    const isSelected = selectedSector === sectorNum;
                    return (
                      <button
                        key={sectorNum}
                        type="button"
                        onClick={() => {
                          setSelectedSector(sectorNum);
                          const ala = selectedAla || 'A';
                          setUbicacionAcopioVal(`Ala ${ala} · Sector ${sectorNum}`);
                        }}
                        className={`py-3 px-2 rounded-xl border text-center transition flex flex-col items-center justify-center gap-0.5 cursor-pointer select-none ${
                          isSelected
                            ? 'bg-[#F6EFDC] border-[#C9922E] text-[#C9922E] font-extrabold shadow-xs ring-1 ring-[#C9922E]'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 font-bold'
                        }`}
                      >
                        <span className="text-[9px] text-gray-400 font-semibold tracking-wider block">SECTOR</span>
                        <span className="text-lg font-mono leading-none">{sectorNum}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Atajos Rápidos */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1.5">
                  Atajos rápidos:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'Ala A · Sector 1', a: 'A', s: '1' },
                    { label: 'Ala A · Sector 2', a: 'A', s: '2' },
                    { label: 'Ala B · Sector 1', a: 'B', s: '1' },
                    { label: 'Ala B · Sector 2', a: 'B', s: '2' },
                    { label: 'Acopio General', a: '', s: '' },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setSelectedAla(preset.a);
                        setSelectedSector(preset.s);
                        setUbicacionAcopioVal(preset.label);
                      }}
                      className="px-2 py-1 bg-gray-100 hover:bg-emerald-50 text-gray-700 hover:text-emerald-900 border border-gray-200 rounded-lg text-xs font-medium transition cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Vista previa de ubicación */}
              <div className="bg-emerald-50/40 rounded-xl p-3 border border-emerald-200/60 flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Ubicación Resultante:</span>
                <span className="font-sans font-black text-[#00603C] text-sm flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#00603C]" />
                  {ubicacionAcopioVal.trim() || (selectedAla && selectedSector ? `ALA ${selectedAla} · SECTOR ${selectedSector}` : 'No seleccionada')}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 p-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowLocationModal(false)}
                disabled={isSavingLocation}
                className="px-4 py-2 text-xs font-semibold font-sans uppercase tracking-wider text-gray-500 hover:bg-gray-100 rounded-lg transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSavingLocation || (!ubicacionAcopioVal.trim() && !selectedAla && !selectedSector)}
                onClick={() => handleSaveLocation(selectedAla, selectedSector, ubicacionAcopioVal)}
                className="px-5 py-2 text-xs font-semibold font-sans uppercase tracking-wider bg-[#00603C] text-white hover:bg-[#254731] rounded-lg transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
              >
                {isSavingLocation ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Warehouse className="w-4 h-4 text-[#C9922E]" />
                )}
                <span>Guardar Ubicación</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Modo Edición de Ficha Técnica antes de Imprimir o Descargar */}
      {showEditFichaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto print:hidden animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden border border-gray-100 my-8">
            {/* Header */}
            <div className="bg-[#00603C] p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl">
                  <Edit2 className="w-5 h-5 text-[#C9922E]" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base uppercase tracking-wider">
                    Modo Edición: Ficha Técnica
                  </h3>
                  <p className="text-xs text-emerald-100/90 font-medium">
                    Edite temporalmente los campos para la ficha técnica, impresión y descarga en PDF
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditFichaModal(false)}
                className="p-1.5 rounded-lg text-emerald-100 hover:bg-white/10 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido del Formulario de Edición */}
            <div className="p-6 max-h-[70vh] overflow-y-auto space-y-5">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-start justify-between gap-3">
                <div>
                  <strong>Modo Edición Temporal:</strong> Los cambios que realice se reflejarán inmediatamente en la previsualización oficial, la impresión A4 y la descarga en PDF.
                </div>
                {fichaModificada && (
                  <button
                    type="button"
                    onClick={handleResetDraft}
                    className="text-xs text-red-600 hover:text-red-700 font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restablecer
                  </button>
                )}
              </div>

              {/* Sección 1: Datos Principales */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 border-b border-gray-100 pb-1">
                  1. Identificación y Clasificación
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">N° de Lote</label>
                    <input
                      type="text"
                      value={draftFichaLote.loteNro || ''}
                      onChange={(e) => handleUpdateDraftField('loteNro', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-bold text-gray-900 focus:bg-white focus:border-[#00603C] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Cliente</label>
                    <input
                      type="text"
                      value={draftFichaLote.cliente || ''}
                      onChange={(e) => handleUpdateDraftField('cliente', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-bold text-gray-900 focus:bg-white focus:border-[#00603C] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Especie</label>
                    <input
                      type="text"
                      value={draftFichaLote.especie || ''}
                      onChange={(e) => handleUpdateDraftField('especie', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-semibold text-gray-800 focus:bg-white focus:border-[#00603C] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Variedad</label>
                    <input
                      type="text"
                      value={draftFichaLote.variedad || ''}
                      onChange={(e) => handleUpdateDraftField('variedad', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-semibold text-gray-800 focus:bg-white focus:border-[#00603C] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Categoría</label>
                    <input
                      type="text"
                      value={draftFichaLote.categoria || ''}
                      onChange={(e) => handleUpdateDraftField('categoria', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-semibold text-gray-800 focus:bg-white focus:border-[#00603C] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Tipo de Lote</label>
                    <input
                      type="text"
                      value={draftFichaLote.tipo || ''}
                      onChange={(e) => handleUpdateDraftField('tipo', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-semibold text-gray-800 focus:bg-white focus:border-[#00603C] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 2: Tratamiento y Origen */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 border-b border-gray-100 pb-1">
                  2. Trazabilidad, Curado y Origen
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Tratamiento / Curado</label>
                    <input
                      type="text"
                      value={Array.isArray(draftFichaLote.tratamiento) ? draftFichaLote.tratamiento.join(', ') : (draftFichaLote.tratamiento as any) || ''}
                      onChange={(e) => handleUpdateDraftField('tratamiento', e.target.value.split(',').map(s => s.trim()))}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-semibold text-gray-800 focus:bg-white focus:border-[#00603C] focus:outline-none"
                      placeholder="Sin Tratar, Curado..."
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Producto Químico</label>
                    <input
                      type="text"
                      value={draftFichaLote.producto || ''}
                      onChange={(e) => handleUpdateDraftField('producto', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-semibold text-gray-800 focus:bg-white focus:border-[#00603C] focus:outline-none"
                      placeholder="Ninguno, Maxim XL..."
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">N° Bolsón de Origen</label>
                    <input
                      type="text"
                      value={(draftFichaLote as any).numeroBolsonOrigen || (draftFichaLote as any).bolsonOrigenNro || ''}
                      onChange={(e) => handleUpdateDraftField('numeroBolsonOrigen', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-semibold text-gray-800 font-mono focus:bg-white focus:border-[#00603C] focus:outline-none"
                      placeholder="Ej: B-12"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Sector Bolsón Origen</label>
                    <input
                      type="text"
                      value={(draftFichaLote as any).sectorBolsonOrigen || ''}
                      onChange={(e) => handleUpdateDraftField('sectorBolsonOrigen', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-semibold text-gray-800 focus:bg-white focus:border-[#00603C] focus:outline-none"
                      placeholder="Ej: Ala A - Sector 1"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Ubicación de Acopio</label>
                    <input
                      type="text"
                      value={(draftFichaLote as any).ubicacionAcopio || (draftFichaLote.ala && draftFichaLote.sector ? `Ala ${draftFichaLote.ala} - Sector ${draftFichaLote.sector}` : '')}
                      onChange={(e) => handleUpdateDraftField('ubicacionAcopio', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-semibold text-gray-800 focus:bg-white focus:border-[#00603C] focus:outline-none"
                      placeholder="Ej: Ala A - Sector 1"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 3: Cantidades y Observaciones */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 border-b border-gray-100 pb-1">
                  3. Stock, Pesos y Observaciones
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs mb-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Cantidad de Bolsas</label>
                    <input
                      type="number"
                      min="1"
                      value={draftFichaLote.stockBolsas || 0}
                      onChange={(e) => handleUpdateDraftField('stockBolsas', Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-bold text-gray-900 font-mono focus:bg-white focus:border-[#00603C] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Kg por Bolsa</label>
                    <input
                      type="number"
                      min="1"
                      value={draftFichaLote.kgPorBolsa || 40}
                      onChange={(e) => handleUpdateDraftField('kgPorBolsa', Math.max(1, parseInt(e.target.value, 10) || 0))}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-bold text-gray-900 font-mono focus:bg-white focus:border-[#00603C] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Fecha Realizado / Ingreso</label>
                    <input
                      type="date"
                      value={draftFichaLote.fechaIngreso || ''}
                      onChange={(e) => handleUpdateDraftField('fechaIngreso', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-semibold text-gray-800 focus:bg-white focus:border-[#00603C] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Observaciones / Notas de la Ficha Técnica</label>
                  <textarea
                    rows={3}
                    value={draftFichaLote.observaciones || ''}
                    onChange={(e) => handleUpdateDraftField('observaciones', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-semibold text-gray-800 text-xs focus:bg-white focus:border-[#00603C] focus:outline-none resize-none"
                    placeholder="Escriba aquí observaciones especiales para la ficha técnica..."
                  />
                </div>
              </div>
            </div>

            {/* Footer de Acciones del Modal */}
            <div className="bg-gray-50 p-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowEditFichaModal(false)}
                className="w-full sm:w-auto px-4 py-2 text-xs font-semibold font-sans uppercase tracking-wider text-gray-600 hover:bg-gray-100 rounded-lg transition cursor-pointer"
              >
                Cerrar
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleConfirmarYPrevisualizar}
                  className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold font-sans uppercase tracking-wider bg-[#00603C] hover:bg-[#254731] text-white rounded-lg transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4 text-[#C9922E]" />
                  <span>Confirmar y Previsualizar Impresión</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Carga Manual de Código INASE (Inicio / Final) */}
      {showInaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto print:hidden animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-gray-100 my-8">
            <div className="bg-[#00603C] p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl">
                  <Tag className="w-5 h-5 text-[#C9922E]" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base uppercase tracking-wider">
                    Código INASE (Inicio / Final)
                  </h3>
                  <p className="text-xs text-emerald-100/90 font-mono">
                    Lote {lote.loteNro || lote.id} · {lote.cliente}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInaseModal(false)}
                className="p-1.5 rounded-lg text-emerald-100 hover:bg-white/10 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setIsSavingInase(true);
                try {
                  if (onUpdateLoteInase) {
                    await onUpdateLoteInase(lote.id, inaseInicioVal.trim(), inaseFinalVal.trim());
                  }
                  setShowInaseModal(false);
                } catch (err) {
                  console.error('Error guardando Código INASE:', err);
                } finally {
                  setIsSavingInase(false);
                }
              }}
              className="p-6 space-y-4"
            >
              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3 text-xs text-emerald-950 leading-relaxed">
                Ingrese la numeración manual de inicio y final correspondiente al <strong>Código INASE</strong>. Estos datos quedan registrados y se exportarán en las columnas correspondientes de Excel.
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1 tracking-wider">
                  INASE Inicio
                </label>
                <input
                  type="text"
                  value={inaseInicioVal}
                  onChange={(e) => setInaseInicioVal(e.target.value)}
                  placeholder="Ej: 0048101"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#00603C] focus:border-[#00603C] focus:outline-none text-sm transition"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1 tracking-wider">
                  INASE Final
                </label>
                <input
                  type="text"
                  value={inaseFinalVal}
                  onChange={(e) => setInaseFinalVal(e.target.value)}
                  placeholder="Ej: 0048350"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#00603C] focus:border-[#00603C] focus:outline-none text-sm transition"
                />
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
                <span className="text-slate-500 font-medium">Bolsas en Lote:</span>
                <span className="font-mono font-bold text-slate-800">
                  {lote.stockBolsas} bolsas ({lote.kgPorBolsa || 40} kg)
                </span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowInaseModal(false)}
                  className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingInase}
                  className="px-5 py-2.5 bg-[#00603C] hover:bg-[#004D30] text-white rounded-lg text-xs font-bold uppercase tracking-wider transition shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSavingInase ? (
                    <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                  ) : (
                    <Check className="w-4 h-4 text-amber-300 stroke-[3]" />
                  )}
                  <span>{isSavingInase ? 'Guardando...' : 'Guardar Códigos INASE'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Componente Independiente de Impresión y Edición de Ficha Técnica (A4 / JPG) */}
      <ImprimirFichaTecnica
        lote={draftFichaLote}
        isOpen={showImprimirFichaModal}
        onClose={() => setShowImprimirFichaModal(false)}
        initialEditMode={initialFichaEditMode}
        onSaveLote={(updated) => {
          setDraftFichaLote(updated);
          setFichaModificada(true);
        }}
      />

      {/* Modal de Impresión de Etiquetas ID Bolsas con Selector de Color Identificación */}
      <BatchPrintIdBolsasModal
        isOpen={showBatchIdBolsasModal}
        lotes={[draftFichaLote]}
        onClose={() => setShowBatchIdBolsasModal(false)}
      />

      {/* Contenedor off-screen de la Ficha Técnica para exportación directa a JPG */}
      <div
        aria-hidden="true"
        className="fixed -left-[9999px] -top-[9999px] w-[800px] pointer-events-none opacity-100 z-[-1] bg-white p-4 print:hidden"
      >
        <FichaTecnicaOficialCard id={`ficha-detail-card-${lote.id}`} lote={draftFichaLote} />
      </div>
      </div>

      {/* 2. Contenedor Exclusivo de Impresión (@media print) para generar la Ficha Oficial A4 / PDF */}
      <div
        id="seccion-impresion"
        className="ficha-tecnica-a4-container seccion-impresion hidden print:block w-full max-w-[210mm] mx-auto bg-white"
      >
        <FichaTecnicaOficialCard
          id={`ficha-print-direct-${lote.id}`}
          lote={draftFichaLote}
          showWatermark={false}
        />
      </div>
    </div>
  );
};
