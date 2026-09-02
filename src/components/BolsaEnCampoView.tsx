/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { BolsonCampo, MovimientoSilo } from '../types';
import { ClienteSelect } from './ClienteSelect';
import { FichaBolsonA4, bolsonToFichaLoteJSON } from './FichaBolsonA4';
import { FichaTecnicaLoteViewerModal, FichaLoteJSON } from './FichaTecnicaLotePrintManager';
import { playQrScanBeep, unlockScannerAudio } from '../utils/scannerAudio';
import {
  Package,
  Search,
  Plus,
  FileSpreadsheet,
  Download,
  Upload,
  Edit2,
  Trash2,
  CheckCircle,
  AlertCircle,
  X,
  Building2,
  Sprout,
  MapPin,
  Warehouse,
  Check,
  History,
  Clock,
  ArrowUpRight,
  FileText,
  Calendar,
  Truck,
  Info,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Printer,
  CheckSquare,
  Square,
  Droplets,
  TrendingUp,
  SlidersHorizontal,
  ChevronDown,
  Eye
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { db, sanitizeForFirestore } from '../lib/firebase';
import { doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';

interface BolsaEnCampoViewProps {
  bolsones: BolsonCampo[];
  movimientosSilo?: MovimientoSilo[];
  clientes?: string[];
  especies?: string[];
}

export const CATEGORIAS_BOLSON = ['Fundadora', 'Preba', 'Original', 'Prima', 'Primu'];

export const MATERIALES_OPCIONES = [
  'Polietileno Tricapa 235µ',
  'Polietileno Pentacapa 240µ',
  'Polipropileno Tejido',
  'Polietileno Virgen con Filtro UV'
];

type SortField =
  | 'campania'
  | 'cliente'
  | 'numeroBolson'
  | 'campo'
  | 'cultivo'
  | 'ordenSiembra'
  | 'cicloCultivo'
  | 'categoria'
  | 'deposito'
  | 'entradasKg'
  | 'salidasKg'
  | 'stockKg'
  | 'humedad';

export const BolsaEnCampoView: React.FC<BolsaEnCampoViewProps> = ({
  bolsones = [],
  movimientosSilo = [],
  clientes = ['San Diego Semillas', 'Eco Rural', 'Pampa', 'Stine', 'Elementa Foods'],
  especies = ['Soja', 'Trigo', 'Arveja']
}) => {
  // Búsqueda y Filtros Avanzados
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClienteFilter, setSelectedClienteFilter] = useState<string>('');
  const [selectedDepositoFilter, setSelectedDepositoFilter] = useState<string>('');
  const [selectedEstadoFilter, setSelectedEstadoFilter] = useState<string>('');
  const [selectedCapacidadFilter, setSelectedCapacidadFilter] = useState<string>('');
  const [selectedCultivoFilter, setSelectedCultivoFilter] = useState<string>('');
  const [selectedCampoFilter, setSelectedCampoFilter] = useState<string>('');
  const [selectedOrdenSiembraFilter, setSelectedOrdenSiembraFilter] = useState<string>('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Ordenamiento Bidireccional
  const [sortField, setSortField] = useState<SortField>('numeroBolson');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Selección Múltiple
  const [selectedBolsonIds, setSelectedBolsonIds] = useState<Set<string>>(new Set());

  // Modales
  const [showModalAddEdit, setShowModalAddEdit] = useState(false);
  const [showModalImport, setShowModalImport] = useState(false);
  const [bolsonAEditar, setBolsonAEditar] = useState<BolsonCampo | null>(null);
  const [bolsonHistorial, setBolsonHistorial] = useState<BolsonCampo | null>(null);
  const [bolsonFichaA4, setBolsonFichaA4] = useState<BolsonCampo | null>(null);
  const [showFichasViewerModal, setShowFichasViewerModal] = useState(false);
  const [bolsonAEliminar, setBolsonAEliminar] = useState<BolsonCampo | null>(null);

  // Form State
  const [formCampania, setFormCampania] = useState('2025/2026');
  const [formCliente, setFormCliente] = useState('San Diego Semilla');
  const [formNumeroBolson, setFormNumeroBolson] = useState('');
  const [formZona, setFormZona] = useState('');
  const [formCampo, setFormCampo] = useState('');
  const [formCultivo, setFormCultivo] = useState('Soja');
  const [formOrdenSiembra, setFormOrdenSiembra] = useState('OS-01');
  const [formVariedad, setFormVariedad] = useState('');
  const [formCategoria, setFormCategoria] = useState('Fundadora');
  const [formDeposito, setFormDeposito] = useState('Lote 20');
  const [formMaterial, setFormMaterial] = useState('Polietileno Tricapa 235µ');
  const [formCapacidadTn, setFormCapacidadTn] = useState<number>(200);
  const [formHumedad, setFormHumedad] = useState<number>(13.2);
  const [formRendimiento, setFormRendimiento] = useState<number>(3400);
  const [formSuperficieHa, setFormSuperficieHa] = useState<number>(80);
  const [formCoordenadasGis, setFormCoordenadasGis] = useState('33°07\'42"S 64°21\'15"W');
  const [formEntradasKg, setFormEntradasKg] = useState<number>(0);
  const [formSalidasKg, setFormSalidasKg] = useState<number>(0);
  const [formObservaciones, setFormObservaciones] = useState('');
  const [formError, setFormError] = useState('');

  // Import State
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<Partial<BolsonCampo>[]>([]);
  const [importNotice, setImportNotice] = useState('');
  const [importError, setImportError] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // General Notification
  const [notificacion, setNotificacion] = useState('');

  // Listados dinámicos para filtros
  const clientesDisponiblesBolsas = useMemo(() => {
    const base = ['Pampa', 'Eco Rural', 'San Diego Semillas', 'Stine', 'Elementa Foods'];
    const fromBolsas = bolsones.map(b => b.cliente).filter(Boolean) as string[];
    return Array.from(new Set([...base, ...fromBolsas])).sort();
  }, [bolsones]);

  const depositosDisponibles = useMemo(() => {
    const fromBolsas = bolsones.map(b => b.deposito).filter(Boolean) as string[];
    return Array.from(new Set(fromBolsas)).sort();
  }, [bolsones]);

  const cultivosDisponibles = useMemo(() => {
    const fromBolsas = bolsones.map(b => b.cultivo).filter(Boolean) as string[];
    return Array.from(new Set([...especies, ...fromBolsas])).sort();
  }, [bolsones, especies]);

  const camposDisponibles = useMemo(() => {
    const fromBolsas = bolsones.map(b => b.campo).filter(Boolean) as string[];
    return Array.from(new Set(fromBolsas)).sort();
  }, [bolsones]);

  const ordenesSiembraDisponibles = useMemo(() => {
    const base = ['OS-01 (Soja Primera)', 'OS-02 (Soja Segunda)', 'OS-03 (Trigo Ciclo Largo)', 'OS-04 (Trigo Ciclo Corto)', 'OS-05 (Soja Primera)', 'OS-06 (Arveja Verde)'];
    const fromBolsas = bolsones.map(b => b.ordenSiembra || b.cicloCultivo).filter(Boolean) as string[];
    return Array.from(new Set([...base, ...fromBolsas])).sort();
  }, [bolsones]);

  // Manejo de ordenamiento
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filtrado y Ordenamiento Combinado
  const filteredAndSortedBolsones = useMemo(() => {
    // 1. Filtrado
    const result = bolsones.filter((b) => {
      // Cliente
      if (selectedClienteFilter && b.cliente !== selectedClienteFilter) return false;

      // Depósito de Origen
      if (selectedDepositoFilter && (b.deposito || '') !== selectedDepositoFilter) return false;

      // Cultivo
      if (selectedCultivoFilter && b.cultivo !== selectedCultivoFilter) return false;

      // Orden de Siembra (o Ciclo Cultivo)
      if (selectedOrdenSiembraFilter && (b.ordenSiembra || b.cicloCultivo || '') !== selectedOrdenSiembraFilter) return false;

      // Campo
      if (selectedCampoFilter && (!b.campo || !b.campo.toLowerCase().includes(selectedCampoFilter.toLowerCase()))) {
        return false;
      }

      // Stock calculado
      const normNro = (b.numeroBolson || '').trim().toLowerCase();
      const movsBolson = (movimientosSilo || []).filter(m =>
        m.tipo === 'INGRESO' && (
          (m.bolsonOrigenId && m.bolsonOrigenId === b.id) ||
          (m.bolsonOrigenNro && m.bolsonOrigenNro.trim().toLowerCase() === normNro)
        )
      );
      const salidasCalculadas = movsBolson.reduce((acc, m) => acc + (m.kg || 0), 0);
      const salidasKg = Math.max(b.salidasKg || 0, salidasCalculadas);
      const stock = Math.max(0, (b.entradasKg || 0) - salidasKg);

      // Estado
      if (selectedEstadoFilter === 'con-stock' && stock <= 0) return false;
      if (selectedEstadoFilter === 'stock-bajo' && (stock <= 0 || stock > 20000)) return false;
      if (selectedEstadoFilter === 'agotado' && stock > 0) return false;

      // Capacidad
      const capTn = b.capacidadTn || ((b.entradasKg || 0) / 1000) || 100;
      if (selectedCapacidadFilter === '<30' && capTn >= 30) return false;
      if (selectedCapacidadFilter === '30-60' && (capTn < 30 || capTn > 60)) return false;
      if (selectedCapacidadFilter === '>60' && capTn <= 60) return false;

      // Búsqueda de texto libre
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const match =
          (b.numeroBolson && b.numeroBolson.toLowerCase().includes(term)) ||
          (b.cliente && b.cliente.toLowerCase().includes(term)) ||
          (b.cultivo && b.cultivo.toLowerCase().includes(term)) ||
          (b.ordenSiembra && b.ordenSiembra.toLowerCase().includes(term)) ||
          (b.cicloCultivo && b.cicloCultivo.toLowerCase().includes(term)) ||
          (b.variedad && b.variedad.toLowerCase().includes(term)) ||
          (b.campo && b.campo.toLowerCase().includes(term)) ||
          (b.zona && b.zona.toLowerCase().includes(term)) ||
          (b.categoria && b.categoria.toLowerCase().includes(term)) ||
          (b.deposito && b.deposito.toLowerCase().includes(term));
        if (!match) return false;
      }

      return true;
    });

    // 2. Ordenamiento Bidireccional
    result.sort((a, b) => {
      let valA: any = sortField === 'ordenSiembra' ? (a.ordenSiembra || a.cicloCultivo) : a[sortField];
      let valB: any = sortField === 'ordenSiembra' ? (b.ordenSiembra || b.cicloCultivo) : b[sortField];

      // Campos calculados
      if (sortField === 'stockKg') {
        const stockA = Math.max(0, (a.entradasKg || 0) - (a.salidasKg || 0));
        const stockB = Math.max(0, (b.entradasKg || 0) - (b.salidasKg || 0));
        valA = stockA;
        valB = stockB;
      } else if (sortField === 'humedad') {
        valA = a.humedad || 13.2;
        valB = b.humedad || 13.2;
      }

      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();

      if (strA < strB) return sortDirection === 'asc' ? -1 : 1;
      if (strA > strB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [
    bolsones,
    movimientosSilo,
    selectedClienteFilter,
    selectedDepositoFilter,
    selectedEstadoFilter,
    selectedCapacidadFilter,
    selectedCultivoFilter,
    selectedOrdenSiembraFilter,
    selectedCampoFilter,
    searchTerm,
    sortField,
    sortDirection,
  ]);

  // Selección Múltiple Helpers
  const isAllSelected =
    filteredAndSortedBolsones.length > 0 &&
    filteredAndSortedBolsones.every((b) => selectedBolsonIds.has(b.id));

  const handleToggleSelectAll = () => {
    unlockScannerAudio();
    if (isAllSelected) {
      setSelectedBolsonIds(new Set());
    } else {
      const allIds = new Set(filteredAndSortedBolsones.map((b) => b.id));
      setSelectedBolsonIds(allIds);
      playQrScanBeep({ doubleTone: true, volume: 0.2 });
    }
  };

  const handleToggleSelectOne = (id: string) => {
    unlockScannerAudio();
    setSelectedBolsonIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectedBolsonesList = useMemo(() => {
    return bolsones.filter((b) => selectedBolsonIds.has(b.id));
  }, [bolsones, selectedBolsonIds]);

  // Totales
  const totalStockKg = filteredAndSortedBolsones.reduce(
    (acc, b) =>
      acc + (b.stockKg !== undefined ? b.stockKg : (b.entradasKg || 0) - (b.salidasKg || 0)),
    0
  );
  const totalEntradasKg = filteredAndSortedBolsones.reduce(
    (acc, b) => acc + (b.entradasKg || 0),
    0
  );
  const totalSalidasKg = filteredAndSortedBolsones.reduce(
    (acc, b) => acc + (b.salidasKg || 0),
    0
  );

  // Reset y Abrir Modal (Creación)
  const handleOpenAddModal = () => {
    setBolsonAEditar(null);
    setFormCampania('2025/2026');
    setFormCliente(clientes[0] || 'San Diego Semilla');
    setFormNumeroBolson('');
    setFormZona('Norte');
    setFormCampo('La Barrancosa');
    setFormCultivo('Soja');
    setFormOrdenSiembra('OS-01');
    setFormVariedad('');
    setFormCategoria('Fundadora');
    setFormDeposito('Lote 20');
    setFormMaterial('Polietileno Tricapa 235µ');
    setFormCapacidadTn(200);
    setFormHumedad(13.2);
    setFormRendimiento(3400);
    setFormSuperficieHa(80);
    setFormCoordenadasGis('33°07\'42"S 64°21\'15"W');
    setFormEntradasKg(0);
    setFormSalidasKg(0);
    setFormObservaciones('');
    setFormError('');
    setShowModalAddEdit(true);
  };

  // Abrir Modal de Edición
  const handleOpenEditModal = (b: BolsonCampo) => {
    setBolsonAEditar(b);
    setFormCampania(b.campania || '2025/2026');
    setFormCliente(b.cliente || '');
    setFormNumeroBolson(b.numeroBolson || '');
    setFormZona(b.zona || 'Norte');
    setFormCampo(b.campo || 'La Barrancosa');
    setFormCultivo(b.cultivo || 'Soja');
    setFormOrdenSiembra(b.ordenSiembra || b.cicloCultivo || (b.cultivo ? `${b.cultivo} ${b.variedad || ''}`.trim() : 'OS-01'));
    setFormVariedad(b.variedad || '');
    setFormCategoria(b.categoria || 'Fundadora');
    setFormDeposito(b.deposito || 'Lote 20');
    setFormMaterial(b.material || 'Polietileno Tricapa 235µ');
    setFormCapacidadTn(b.capacidadTn || 200);
    setFormHumedad(b.humedad || 13.2);
    setFormRendimiento(b.rendimiento || 3400);
    setFormSuperficieHa(b.superficieHa || 80);
    setFormCoordenadasGis(b.coordenadasGis || '33°07\'42"S 64°21\'15"W');
    setFormEntradasKg(b.entradasKg || 0);
    setFormSalidasKg(b.salidasKg || 0);
    setFormObservaciones(b.observaciones || '');
    setFormError('');
    setShowModalAddEdit(true);
  };

  // Guardar Bolsón (Crear / Editar)
  const handleSaveBolson = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formNumeroBolson.trim()) {
      setFormError('El N° de Bolsón / Bolsa de Origen es obligatorio.');
      return;
    }

    if (!formCliente.trim()) {
      setFormError('El cliente es obligatorio.');
      return;
    }

    if (!formCultivo.trim()) {
      setFormError('El cultivo / especie es obligatorio.');
      return;
    }

    const entradas = Number(formEntradasKg) || 0;
    const salidas = Number(formSalidasKg) || 0;
    const stock = entradas - salidas;

    const id = bolsonAEditar ? bolsonAEditar.id : `BOLSON-${Date.now()}`;

    const newBolson: BolsonCampo = {
      id,
      campania: formCampania.trim() || '2025/2026',
      cliente: formCliente.trim(),
      numeroBolson: formNumeroBolson.trim(),
      zona: formZona.trim() || undefined,
      campo: formCampo.trim() || undefined,
      cultivo: formCultivo.trim(),
      ordenSiembra: formOrdenSiembra.trim() || undefined,
      cicloCultivo: formOrdenSiembra.trim() || undefined,
      variedad: formVariedad.trim(),
      categoria: formCategoria.trim() || 'Fundadora',
      deposito: formDeposito.trim() || undefined,
      entradasKg: entradas,
      salidasKg: salidas,
      stockKg: stock,
      material: formMaterial,
      capacidadTn: Number(formCapacidadTn) || 200,
      humedad: Number(formHumedad) || 13.2,
      rendimiento: Number(formRendimiento) || 3400,
      superficieHa: Number(formSuperficieHa) || 80,
      coordenadasGis: formCoordenadasGis.trim() || undefined,
      observaciones: formObservaciones.trim() || undefined,
    };

    try {
      await setDoc(doc(db, 'bolsones_campo', newBolson.id), sanitizeForFirestore(newBolson), { merge: true });
      setShowModalAddEdit(false);
      playQrScanBeep({ doubleTone: true, volume: 0.25 });
      setNotificacion(
        bolsonAEditar
          ? `Bolsón ${newBolson.numeroBolson} actualizado correctamente.`
          : `Nuevo Bolsón ${newBolson.numeroBolson} guardado en la base de datos.`
      );
      setTimeout(() => setNotificacion(''), 4000);
    } catch (err: any) {
      console.error('Error al guardar bolsón en Firestore:', err);
      setFormError('Error al guardar en la base de datos: ' + (err.message || err));
    }
  };

  // Confirmar Eliminación
  const handleConfirmDelete = async () => {
    if (!bolsonAEliminar) return;
    try {
      await deleteDoc(doc(db, 'bolsones_campo', bolsonAEliminar.id));
      playQrScanBeep({ doubleTone: false, volume: 0.2 });
      setNotificacion(`Se eliminó el Bolsón ${bolsonAEliminar.numeroBolson} de la base de datos.`);
      setBolsonAEliminar(null);
      setTimeout(() => setNotificacion(''), 4000);
    } catch (err: any) {
      console.error('Error al eliminar bolsón:', err);
      alert('Error al eliminar: ' + (err.message || err));
    }
  };

  // Exportar Excel
  const handleExportCurrentDatabase = () => {
    if (filteredAndSortedBolsones.length === 0) {
      alert('No hay bolsones para exportar.');
      return;
    }

    const dataToExport = filteredAndSortedBolsones.map((b) => ({
      'Bolsa de Origen (Nº)': b.numeroBolson,
      'Depósito Origen': b.deposito || b.campo || '',
      'Orden de Siembra': b.ordenSiembra || b.cicloCultivo || '',
      'Ciclo del Cultivo': b.cicloCultivo || b.ordenSiembra || '',
      'Ingresos de Kilos': b.entradasKg || 0,
      'Kilos Extraídos': b.salidasKg || 0,
      'Existencias kg (Silo Bolsa)': b.stockKg !== undefined ? b.stockKg : (b.entradasKg || 0) - (b.salidasKg || 0),
      Campaña: b.campania || '2025/2026',
      Cliente: b.cliente,
      Cultivo: b.cultivo,
      Variedad: b.variedad || '',
      Categoría: b.categoria || '',
      Campo: b.campo || '',
      Zona: b.zona || '',
      'Humedad (%)': b.humedad || 13.2,
      'Rendimiento (kg/ha)': b.rendimiento || 3400,
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bolsones_Campo');
    XLSX.writeFile(wb, `Bolsones_En_Campo_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Descargar Plantilla Modelo
  const handleExportModelTemplate = () => {
    const templateData = [
      {
        'Bolsa de Origen (Nº)': 'S29,2',
        'Depósito Origen': 'Lote 20',
        'Orden de Siembra': 'OS-01 (Soja Primera)',
        'Ingresos de Kilos': 48500,
        'Kilos Extraídos': 14200,
        'Existencias kg (Silo Bolsa)': 34300,
        Campaña: '2025/2026',
        Cliente: 'San Diego Semillas',
        Variedad: 'DM 46i20',
        Categoría: 'Fundadora',
        'Humedad (%)': 13.0,
      },
      {
        'Bolsa de Origen (Nº)': 'S48,4',
        'Depósito Origen': 'Lote 10AB',
        'Orden de Siembra': 'OS-02 (Soja Segunda)',
        'Ingresos de Kilos': 52000,
        'Kilos Extraídos': 20000,
        'Existencias kg (Silo Bolsa)': 32000,
        Campaña: '2025/2026',
        Cliente: 'San Diego Semillas',
        Variedad: 'DM 40R16',
        Categoría: 'Fundadora',
        'Humedad (%)': 13.2,
      }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla_Bolsones');
    XLSX.writeFile(wb, 'Plantilla_Carga_Bolsones_Campo.xlsx');
  };

  // Helper para parsear números y formatos de kg
  const parseNumericKg = (val: any): number => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    const str = String(val).trim().replace(/\./g, '').replace(/,/g, '.');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  };

  // Importar Excel Handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setImportError('');
    setImportNotice('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws);

        if (!rawJson || rawJson.length === 0) {
          setImportError('El archivo Excel está vacío o no contiene registros válidos.');
          setImportPreview([]);
          return;
        }

        const parsed: Partial<BolsonCampo>[] = rawJson.map((row, idx) => {
          const numeroBolson = String(
            row['Bolsa de Origen (Nº)'] ||
            row['Bolsa de Origen (N°)'] ||
            row['Bolsa de Origen'] ||
            row['Bolsa Origen'] ||
            row['N° Bolsón'] ||
            row['N° Bolson'] ||
            row['Numero Bolson'] ||
            row['Silo Bolsa'] ||
            row['Bolson'] ||
            `B-${idx + 1}`
          ).trim();

          const deposito = String(
            row['Depósito Origen'] ||
            row['Deposito Origen'] ||
            row['Depósito'] ||
            row['Deposito'] ||
            row['Lote Origen'] ||
            row['Lote'] ||
            ''
          ).trim();

          const ordenSiembra = String(
            row['Orden de Siembra'] ||
            row['Orden Siembra'] ||
            row['Orden de siembra'] ||
            row['Orden siembra'] ||
            row['OS'] ||
            row['Ciclo del Cultivo'] ||
            row['Ciclo de Cultivo'] ||
            row['Ciclo Cultivo'] ||
            row['Ciclo'] ||
            ''
          ).trim();

          const rawCultivo = String(row['Cultivo'] || row['Especie'] || '').trim();
          let cultivo = rawCultivo;
          if (!cultivo) {
            const lc = ordenSiembra.toLowerCase();
            if (lc.includes('soja')) cultivo = 'Soja';
            else if (lc.includes('trigo')) cultivo = 'Trigo';
            else if (lc.includes('maiz') || lc.includes('maíz')) cultivo = 'Maíz';
            else if (lc.includes('arveja')) cultivo = 'Arveja';
            else cultivo = 'Soja';
          }

          const variedad = String(row['Variedad'] || row['Variedad / Híbrido'] || '').trim();
          const campania = String(row['Campaña'] || row['Campania'] || '2025/2026').trim();
          const cliente = String(row['Cliente'] || 'San Diego Semilla').trim();
          const campo = String(row['Campo'] || row['Establecimiento'] || (deposito.startsWith('Lote') ? deposito : '') || '').trim();
          const zona = String(row['Zona'] || '').trim();
          const categoria = String(row['Categoría'] || row['Categoria'] || 'Fundadora').trim();

          const entradasKg = parseNumericKg(
            row['Ingresos de Kilos'] ||
            row['Ingreso de Kilos'] ||
            row['Ingresos (kg)'] ||
            row['Ingresos'] ||
            row['Entradas (kg)'] ||
            row['Entradas'] ||
            row['Kg'] ||
            row['Kilos'] ||
            0
          );

          const salidasKg = parseNumericKg(
            row['Kilos Extraídos'] ||
            row['Kilos Extraidos'] ||
            row['Kilos Extraidos (kg)'] ||
            row['Kilos Extraídos (kg)'] ||
            row['Extraídos'] ||
            row['Extraidos'] ||
            row['Salidas (kg)'] ||
            row['Salidas'] ||
            0
          );

          const rawStock = row['Existencias kg (Silo Bolsa)'] ||
            row['Existencias (kg)'] ||
            row['Existencias kg'] ||
            row['Existencias'] ||
            row['Stock (kg)'] ||
            row['Stock'] ||
            row['Saldo'];

          const stockKg = rawStock !== undefined && rawStock !== ''
            ? parseNumericKg(rawStock)
            : Math.max(0, entradasKg - salidasKg);

          return {
            id: `BOLSON-IMP-${Date.now()}-${idx}`,
            campania,
            cliente,
            numeroBolson,
            campo,
            zona,
            cultivo,
            ordenSiembra: ordenSiembra || undefined,
            cicloCultivo: ordenSiembra || undefined,
            variedad,
            categoria,
            deposito: deposito || undefined,
            entradasKg,
            salidasKg,
            stockKg,
            tipoBolsa: String(row['Tipo de Bolsa'] || row['Tipo Bolsa'] || 'Silobolsa 9 Pies (60m)'),
            humedad: parseNumericKg(row['Humedad (%)'] || row['Humedad'] || 13.2),
            rendimiento: parseNumericKg(row['Rendimiento (kg/ha)'] || row['Rendimiento'] || 3400),
          };
        });

        setImportPreview(parsed);
        setImportNotice(`Se leyeron ${parsed.length} registros listos para importar.`);
      } catch (err: any) {
        console.error('Error al parsear Excel:', err);
        setImportError('Error al procesar el archivo Excel. Verifique las columnas.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmImport = async () => {
    if (importPreview.length === 0) return;
    setIsImporting(true);
    setImportError('');

    try {
      const batch = writeBatch(db);
      importPreview.forEach((item) => {
        if (!item.numeroBolson) return;
        const ref = doc(db, 'bolsones_campo', item.id || `BOLSON-${Date.now()}-${Math.random()}`);
        batch.set(ref, sanitizeForFirestore(item), { merge: true });
      });

      await batch.commit();
      playQrScanBeep({ doubleTone: true, volume: 0.3 });
      setIsImporting(false);
      setShowModalImport(false);
      setImportFile(null);
      setImportPreview([]);
      setNotificacion(`Se importaron ${importPreview.length} bolsones exitosamente a la base de datos.`);
      setTimeout(() => setNotificacion(''), 5000);
    } catch (err: any) {
      console.error('Error al importar en Firestore:', err);
      setIsImporting(false);
      setImportError('Error al guardar registros: ' + (err.message || err));
    }
  };

  // Helper de Renderizado de Iconos de Ordenamiento
  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 group-hover:opacity-100 transition" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-emerald-700 font-black animate-in fade-in" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-emerald-700 font-black animate-in fade-in" />
    );
  };

  return (
    <div className="space-y-6">
      {/* Banner de Notificaciones */}
      {notificacion && (
        <div className="bg-emerald-50 border-l-4 border-emerald-600 p-4 rounded-r-xl shadow-md flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>{notificacion}</span>
          </div>
          <button onClick={() => setNotificacion('')} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Principal y Acciones Globales */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-[#00603C] flex items-center justify-center font-bold shadow-2xs">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <span>Gestión Agrícola y Almacenamiento en Campo</span>
                <span className="bg-[#E3EFE7] text-[#00603C] text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold border border-emerald-300">
                  Silobolsas & Lotes
                </span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Control agronómico, trazabilidad de silos y existencias en campo.
              </p>
            </div>
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportModelTemplate}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer border border-slate-300"
            title="Descargar plantilla de Excel para carga masiva"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Plantilla</span>
          </button>

          <button
            onClick={() => setShowModalImport(true)}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer border border-slate-300"
            title="Importar bolsones desde archivo Excel"
          >
            <Upload className="w-4 h-4 text-emerald-700" />
            <span>Importar</span>
          </button>

          <button
            onClick={() => setShowFichasViewerModal(true)}
            className="px-3 py-2 bg-emerald-100 hover:bg-emerald-200 text-[#00603C] font-extrabold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer border border-emerald-300 shadow-2xs"
            title="Vista previa e impresión A4 de Fichas Técnicas de Lotes"
          >
            <Printer className="w-4 h-4 text-[#00603C]" />
            <span>Fichas A4</span>
          </button>

          <button
            onClick={handleExportCurrentDatabase}
            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-[#00603C] font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer border border-emerald-200"
            title="Exportar base actual a Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>Excel</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 bg-[#00603C] hover:bg-[#004d30] text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nuevo Bolsón</span>
          </button>
        </div>
      </div>

      {/* Panel de Filtros y Resumen de Totales */}
      <div className="space-y-4">
        {/* Tarjetas de Resumen Numérico */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Total Bolsones
              </span>
              <span className="text-2xl font-black font-mono text-slate-900">
                {filteredAndSortedBolsones.length}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold block">
                de {bolsones.length} registrados
              </span>
            </div>
            <div className="p-3 bg-slate-100 rounded-xl">
              <Package className="w-6 h-6 text-slate-600" />
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                Stock Disponible
              </span>
              <span className="text-2xl font-black font-mono text-emerald-950">
                {totalStockKg.toLocaleString('es-AR')} kg
              </span>
              <span className="text-[10px] text-emerald-700 font-semibold block">
                {(totalStockKg / 1000).toFixed(1)} Tn en campo
              </span>
            </div>
            <div className="p-3 bg-emerald-100 rounded-xl">
              <Warehouse className="w-6 h-6 text-[#00603C]" />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 block">
                Entradas Totales
              </span>
              <span className="text-2xl font-black font-mono text-blue-950">
                {totalEntradasKg.toLocaleString('es-AR')} kg
              </span>
              <span className="text-[10px] text-blue-700 font-semibold block">
                {(totalEntradasKg / 1000).toFixed(1)} Tn ingresadas
              </span>
            </div>
            <div className="p-3 bg-blue-100 rounded-xl">
              <Sprout className="w-6 h-6 text-blue-700" />
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                Salidas / Descuentos
              </span>
              <span className="text-2xl font-black font-mono text-amber-950">
                {totalSalidasKg.toLocaleString('es-AR')} kg
              </span>
              <span className="text-[10px] text-amber-700 font-semibold block">
                {(totalSalidasKg / 1000).toFixed(1)} Tn remitidas
              </span>
            </div>
            <div className="p-3 bg-amber-100 rounded-xl">
              <Truck className="w-6 h-6 text-amber-700" />
            </div>
          </div>
        </div>

        {/* Barra de Filtros Avanzados y Búsqueda */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Buscador de Texto */}
            <div className="relative flex-1">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por N° bolsón, cliente, cultivo, variedad, campo, depósito, zona..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Botón para desplegar filtros adicionales */}
            <button
              type="button"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border ${
                showAdvancedFilters || selectedDepositoFilter || selectedEstadoFilter || selectedCapacidadFilter
                  ? 'bg-emerald-50 text-[#00603C] border-emerald-300 font-black'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4 text-emerald-700" />
              <span>Filtros Avanzados</span>
              {(selectedDepositoFilter || selectedEstadoFilter || selectedCapacidadFilter) && (
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
              )}
            </button>
          </div>

          {/* Selectores Rápidos y Filtros Avanzados */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3 pt-2 border-t border-slate-100">
            {/* Filtro Cliente */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Cliente
              </label>
              <select
                value={selectedClienteFilter}
                onChange={(e) => setSelectedClienteFilter(e.target.value)}
                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="">Todos ({clientesDisponiblesBolsas.length})</option>
                {clientesDisponiblesBolsas.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro Orden de Siembra */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Orden de Siembra
              </label>
              <select
                value={selectedOrdenSiembraFilter}
                onChange={(e) => setSelectedOrdenSiembraFilter(e.target.value)}
                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="">Todas ({ordenesSiembraDisponibles.length})</option>
                {ordenesSiembraDisponibles.map((os) => (
                  <option key={os} value={os}>
                    {os}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro Depósito de Origen */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Depósito Origen
              </label>
              <select
                value={selectedDepositoFilter}
                onChange={(e) => setSelectedDepositoFilter(e.target.value)}
                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="">Todos ({depositosDisponibles.length})</option>
                {depositosDisponibles.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro Estado */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Estado Stock
              </label>
              <select
                value={selectedEstadoFilter}
                onChange={(e) => setSelectedEstadoFilter(e.target.value)}
                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="">Todos los estados</option>
                <option value="con-stock">Con Stock (&gt; 0 kg)</option>
                <option value="stock-bajo">Stock Bajo (&lt; 20 Tn)</option>
                <option value="agotado">Agotado / Vacío (0 kg)</option>
              </select>
            </div>

            {/* Filtro Capacidad */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Capacidad
              </label>
              <select
                value={selectedCapacidadFilter}
                onChange={(e) => setSelectedCapacidadFilter(e.target.value)}
                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="">Todas las capacidades</option>
                <option value="<30">&lt; 30 Tn (Menor)</option>
                <option value="30-60">30 a 60 Tn (Estándar)</option>
                <option value=">60">&gt; 60 Tn (Mayor)</option>
              </select>
            </div>

            {/* Filtro Cultivo */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Cultivo
              </label>
              <select
                value={selectedCultivoFilter}
                onChange={(e) => setSelectedCultivoFilter(e.target.value)}
                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="">Todos los cultivos</option>
                {cultivosDisponibles.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro Campo / Parcela */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Campo / Parcela
              </label>
              <select
                value={selectedCampoFilter}
                onChange={(e) => setSelectedCampoFilter(e.target.value)}
                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="">Todos los campos</option>
                {camposDisponibles.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Reset Filtros si hay alguno activo */}
          {(selectedClienteFilter ||
            selectedOrdenSiembraFilter ||
            selectedDepositoFilter ||
            selectedEstadoFilter ||
            selectedCapacidadFilter ||
            selectedCultivoFilter ||
            selectedCampoFilter ||
            searchTerm) && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-500">
                Filtros activos aplicados. Mostrando <strong>{filteredAndSortedBolsones.length}</strong> de {bolsones.length} registros.
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedClienteFilter('');
                  setSelectedOrdenSiembraFilter('');
                  setSelectedDepositoFilter('');
                  setSelectedEstadoFilter('');
                  setSelectedCapacidadFilter('');
                  setSelectedCultivoFilter('');
                  setSelectedCampoFilter('');
                  setSearchTerm('');
                }}
                className="text-xs font-bold text-red-600 hover:text-red-800 underline cursor-pointer"
              >
                Limpiar todos los filtros
              </button>
            </div>
          )}
        </div>

          {/* TABLA PRINCIPAL DE BOLSONES CON ORDENAMIENTO BIDIRECCIONAL */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50/80 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* Checkbox Global Seleccionar Todo */}
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="p-1 text-slate-600 hover:text-emerald-700 transition cursor-pointer flex items-center gap-2"
                  title={isAllSelected ? 'Deseleccionar todos' : 'Seleccionar todos los visibles'}
                >
                  {isAllSelected ? (
                    <CheckSquare className="w-5 h-5 text-[#00603C]" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-400" />
                  )}
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Listado de Bolsones en Campo
                  </span>
                </button>
                <span className="text-xs text-slate-400 font-mono">
                  ({filteredAndSortedBolsones.length} registros)
                </span>
              </div>

              {selectedBolsonIds.size > 0 && (
                <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 animate-in fade-in">
                  {selectedBolsonIds.size} seleccionados
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/90 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-600 select-none">
                    <th className="py-3 px-3 w-10 text-center">
                      <button
                        type="button"
                        onClick={handleToggleSelectAll}
                        className="cursor-pointer text-slate-600 hover:text-emerald-700"
                      >
                        {isAllSelected ? (
                          <CheckSquare className="w-4 h-4 text-[#00603C]" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                      </button>
                    </th>

                    <th
                      onClick={() => handleSort('campania')}
                      className="py-3 px-3 cursor-pointer hover:bg-slate-200/60 transition group"
                    >
                      <div className="flex items-center gap-1">
                        <span>Campaña</span>
                        {renderSortIndicator('campania')}
                      </div>
                    </th>

                    <th
                      onClick={() => handleSort('cliente')}
                      className="py-3 px-3 cursor-pointer hover:bg-slate-200/60 transition group"
                    >
                      <div className="flex items-center gap-1">
                        <span>Cliente</span>
                        {renderSortIndicator('cliente')}
                      </div>
                    </th>

                    <th
                      onClick={() => handleSort('numeroBolson')}
                      className="py-3 px-3 cursor-pointer hover:bg-slate-200/60 transition group"
                    >
                      <div className="flex items-center gap-1">
                        <span>Bolsa de Origen (Nº)</span>
                        {renderSortIndicator('numeroBolson')}
                      </div>
                    </th>

                    <th
                      onClick={() => handleSort('deposito')}
                      className="py-3 px-3 cursor-pointer hover:bg-slate-200/60 transition group"
                    >
                      <div className="flex items-center gap-1">
                        <span>Depósito Origen</span>
                        {renderSortIndicator('deposito')}
                      </div>
                    </th>

                    <th
                      onClick={() => handleSort('ordenSiembra')}
                      className="py-3 px-3 cursor-pointer hover:bg-slate-200/60 transition group"
                    >
                      <div className="flex items-center gap-1">
                        <span>Orden de Siembra</span>
                        {renderSortIndicator('ordenSiembra')}
                      </div>
                    </th>

                    <th
                      onClick={() => handleSort('cultivo')}
                      className="py-3 px-3 cursor-pointer hover:bg-slate-200/60 transition group"
                    >
                      <div className="flex items-center gap-1">
                        <span>Cultivo / Variedad</span>
                        {renderSortIndicator('cultivo')}
                      </div>
                    </th>

                    <th
                      onClick={() => handleSort('categoria')}
                      className="py-3 px-3 cursor-pointer hover:bg-slate-200/60 transition group"
                    >
                      <div className="flex items-center gap-1">
                        <span>Categoría</span>
                        {renderSortIndicator('categoria')}
                      </div>
                    </th>

                    <th
                      onClick={() => handleSort('entradasKg')}
                      className="py-3 px-3 text-right cursor-pointer hover:bg-slate-200/60 transition group"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Ingresos (kg)</span>
                        {renderSortIndicator('entradasKg')}
                      </div>
                    </th>

                    <th
                      onClick={() => handleSort('salidasKg')}
                      className="py-3 px-3 text-right cursor-pointer hover:bg-slate-200/60 transition group"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Kilos Extraídos</span>
                        {renderSortIndicator('salidasKg')}
                      </div>
                    </th>

                    <th
                      onClick={() => handleSort('stockKg')}
                      className="py-3 px-3 text-right cursor-pointer hover:bg-slate-200/60 transition group"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Existencias kg (Silo Bolsa)</span>
                        {renderSortIndicator('stockKg')}
                      </div>
                    </th>

                    <th
                      onClick={() => handleSort('humedad')}
                      className="py-3 px-3 text-right cursor-pointer hover:bg-slate-200/60 transition group"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Humedad</span>
                        {renderSortIndicator('humedad')}
                      </div>
                    </th>

                    <th className="py-3 px-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredAndSortedBolsones.length > 0 ? (
                    filteredAndSortedBolsones.map((b) => {
                      const isSelected = selectedBolsonIds.has(b.id);
                      const normNro = (b.numeroBolson || '').trim().toLowerCase();
                      const movsBolson = (movimientosSilo || []).filter(
                        (m) =>
                          m.tipo === 'INGRESO' &&
                          ((m.bolsonOrigenId && m.bolsonOrigenId === b.id) ||
                            (m.bolsonOrigenNro &&
                              m.bolsonOrigenNro.trim().toLowerCase() === normNro))
                      );
                      const salidasCalculadas = movsBolson.reduce(
                        (acc, m) => acc + (m.kg || 0),
                        0
                      );
                      const salidasKg = Math.max(b.salidasKg || 0, salidasCalculadas);
                      const stock = Math.max(0, (b.entradasKg || 0) - salidasKg);
                      const humedad = b.humedad || 13.2;

                      return (
                        <tr
                          key={b.id}
                          className={`transition ${
                            isSelected
                              ? 'bg-emerald-50/70 hover:bg-emerald-50'
                              : 'hover:bg-slate-50/80'
                          }`}
                        >
                          {/* Checkbox individual */}
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleSelectOne(b.id)}
                              className="cursor-pointer text-slate-600 hover:text-emerald-700"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-[#00603C]" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-400" />
                              )}
                            </button>
                          </td>

                          <td className="py-3 px-3 font-mono font-semibold text-slate-600">
                            {b.campania || '2025/2026'}
                          </td>

                          <td className="py-3 px-3 font-bold text-slate-900">
                            {b.cliente}
                          </td>

                          <td className="py-3 px-3 font-mono font-black text-emerald-800">
                            <span className="bg-emerald-50 text-emerald-900 px-2 py-0.5 rounded border border-emerald-200 shadow-xs">
                              {b.numeroBolson}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-slate-700">
                            <div>
                              <span className="font-bold text-slate-900">{b.deposito || b.campo || '—'}</span>
                              {b.zona && (
                                <span className="text-[10px] text-slate-400 block">
                                  Zona: {b.zona}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <span className="bg-emerald-100/70 text-emerald-900 font-bold px-2 py-0.5 rounded border border-emerald-300 text-[11px]">
                              {b.ordenSiembra || b.cicloCultivo || '—'}
                            </span>
                          </td>

                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900">{b.cultivo}</div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {b.variedad || 'Sin especificar'}
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <span className="bg-amber-50 text-amber-900 font-bold px-2 py-0.5 rounded border border-amber-200 text-[10px]">
                              {b.categoria || 'Fundadora'}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-right font-mono font-semibold text-slate-700">
                            {(b.entradasKg || 0).toLocaleString('es-AR')}
                          </td>

                          <td className="py-3 px-3 text-right font-mono font-semibold text-amber-700">
                            <button
                              onClick={() => setBolsonHistorial(b)}
                              className="bg-amber-50 hover:bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-200 transition cursor-pointer"
                              title="Ver historial de ingresos a silos que descontaron stock"
                            >
                              {salidasKg.toLocaleString('es-AR')} kg
                            </button>
                          </td>

                          <td className="py-3 px-3 text-right font-mono font-black text-emerald-800">
                            <span
                              className={`px-2 py-0.5 rounded border ${
                                stock > 0
                                    ? 'bg-emerald-100 border-emerald-300 text-emerald-900'
                                  : 'bg-slate-100 border-slate-200 text-slate-400'
                              }`}
                            >
                              {stock.toLocaleString('es-AR')} kg
                            </span>
                          </td>

                          <td className="py-3 px-3 text-right font-mono font-bold">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] ${
                                humedad <= 13.5
                                  ? 'bg-emerald-50 text-emerald-800'
                                  : 'bg-amber-50 text-amber-800'
                              }`}
                            >
                              {humedad}%
                            </span>
                          </td>

                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {/* Botón Ficha A4 */}
                              <button
                                type="button"
                                onClick={() => setBolsonFichaA4(b)}
                                className="px-2 py-1 text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition cursor-pointer flex items-center gap-1 font-bold text-[11px]"
                                title="Ver Ficha Técnica Oficial A4 / Descargar PDF"
                              >
                                <FileText className="w-3.5 h-3.5 text-[#00603C]" />
                                <span>Ficha A4</span>
                              </button>

                              {/* Historial */}
                              <button
                                onClick={() => setBolsonHistorial(b)}
                                className="p-1.5 text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition cursor-pointer"
                                title="Ver Historial de Movimientos por Bolsón"
                              >
                                <History className="w-4 h-4" />
                              </button>

                              {/* Editar */}
                              <button
                                onClick={() => handleOpenEditModal(b)}
                                className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                                title="Editar Bolsón"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              {/* Eliminar */}
                              <button
                                onClick={() => setBolsonAEliminar(b)}
                                className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                title="Eliminar Bolsón"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={12} className="py-12 text-center text-slate-500 italic">
                        {searchTerm ? (
                          <div>No se encontraron bolsones que coincidan con los filtros aplicados.</div>
                        ) : (
                          <div>
                            No hay bolsones registrados en la base de datos. Haga clic en "+ Nuevo Bolsón" o "Importar".
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      {/* BARRA FLOTANTE DE ACCIONES MASIVAS (CUANDO HAY SELECCIÓN MÚLTIPLE) */}
      {selectedBolsonIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2 font-bold text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-mono text-amber-300 font-black text-sm">
              {selectedBolsonIds.size}
            </span>
            <span>{selectedBolsonIds.size === 1 ? 'bolsón seleccionado' : 'bolsones seleccionados'}</span>
          </div>

          <div className="h-5 w-px bg-slate-700" />

          <button
            type="button"
            onClick={() => setSelectedBolsonIds(new Set())}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition cursor-pointer"
          >
            Deseleccionar
          </button>
        </div>
      )}

      {/* MODAL FICHA TÉCNICA OFICIAL A4 INDIVIDUAL */}
      {bolsonFichaA4 && (
        <FichaBolsonA4
          bolson={bolsonFichaA4}
          movimientosSilo={movimientosSilo}
          isOpen={Boolean(bolsonFichaA4)}
          onClose={() => setBolsonFichaA4(null)}
        />
      )}

      {/* MODAL VISUALIZADOR GENERAL DE FICHAS TÉCNICAS A4 Y JSON */}
      {showFichasViewerModal && (
        <FichaTecnicaLoteViewerModal
          isOpen={showFichasViewerModal}
          onClose={() => setShowFichasViewerModal(false)}
          fichasData={
            filteredAndSortedBolsones.length > 0
              ? filteredAndSortedBolsones.map((b) => bolsonToFichaLoteJSON(b, movimientosSilo))
              : undefined
          }
        />
      )}

      {/* MODAL NUEVO / EDITAR BOLSÓN */}
      {showModalAddEdit && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 bg-[#00603C] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Package className="w-5 h-5 text-emerald-300" />
                <span>{bolsonAEditar ? 'Editar Bolsón en Campo' : 'Nuevo Bolsón en Campo'}</span>
              </div>
              <button
                onClick={() => setShowModalAddEdit(false)}
                className="text-white/80 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBolson} className="p-6 space-y-4 overflow-y-auto">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl flex items-center gap-2 font-semibold">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">
                    Campaña
                  </label>
                  <input
                    type="text"
                    value={formCampania}
                    onChange={(e) => setFormCampania(e.target.value)}
                    placeholder="ej: 2025/2026"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none text-xs"
                  />
                </div>

                <ClienteSelect
                  value={formCliente}
                  onChange={setFormCliente}
                  label="Cliente *"
                  selectClassName="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none text-xs"
                  inputClassName="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none text-xs mt-1"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">
                    Bolsa de Origen (Nº) *
                  </label>
                  <input
                    type="text"
                    value={formNumeroBolson}
                    onChange={(e) => setFormNumeroBolson(e.target.value)}
                    placeholder="ej: S29,2 o Bolsón 01"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">
                    Depósito Origen
                  </label>
                  <input
                    type="text"
                    value={formDeposito}
                    onChange={(e) => setFormDeposito(e.target.value)}
                    placeholder="ej: Lote 20, Lote 10AB"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">
                    Orden de Siembra
                  </label>
                  <input
                    type="text"
                    value={formOrdenSiembra}
                    onChange={(e) => setFormOrdenSiembra(e.target.value)}
                    placeholder="ej: OS-01 (Soja Primera), OS-02..."
                    list="ordenesSiembraList"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none text-xs"
                  />
                  <datalist id="ordenesSiembraList">
                    {ordenesSiembraDisponibles.map((os) => (
                      <option key={os} value={os} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">
                    Campo / Establecimiento
                  </label>
                  <input
                    type="text"
                    value={formCampo}
                    onChange={(e) => setFormCampo(e.target.value)}
                    placeholder="ej: La Barrancosa"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">
                    Zona / Cuartel
                  </label>
                  <input
                    type="text"
                    value={formZona}
                    onChange={(e) => setFormZona(e.target.value)}
                    placeholder="ej: Norte, Cuartel A"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">
                    Cultivo / Especie *
                  </label>
                  <select
                    value={formCultivo}
                    onChange={(e) => setFormCultivo(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none text-xs"
                  >
                    {especies.map((esp) => (
                      <option key={esp} value={esp}>
                        {esp}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">
                    Variedad / Híbrido
                  </label>
                  <input
                    type="text"
                    value={formVariedad}
                    onChange={(e) => setFormVariedad(e.target.value)}
                    placeholder="ej: DM 46i20, CASUARINA"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">
                    Categoría
                  </label>
                  <select
                    value={formCategoria}
                    onChange={(e) => setFormCategoria(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none text-xs"
                  >
                    {CATEGORIAS_BOLSON.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Especificaciones Técnicas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">
                    Humedad en Grano (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formHumedad}
                    onChange={(e) => setFormHumedad(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-900 text-xs outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">
                    Rendimiento (kg/ha)
                  </label>
                  <input
                    type="number"
                    value={formRendimiento}
                    onChange={(e) => setFormRendimiento(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-900 text-xs outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">
                    Entradas Iniciales (kg)
                  </label>
                  <input
                    type="number"
                    value={formEntradasKg}
                    onChange={(e) => setFormEntradasKg(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">
                    Salidas (kg)
                  </label>
                  <input
                    type="number"
                    value={formSalidasKg}
                    onChange={(e) => setFormSalidasKg(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">
                    Stock Remanente (kg)
                  </label>
                  <div className="w-full px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl font-mono font-black text-emerald-900 text-xs flex items-center">
                    {(Number(formEntradasKg || 0) - Number(formSalidasKg || 0)).toLocaleString('es-AR')} kg
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">
                  Observaciones Técnicas / GIS
                </label>
                <textarea
                  rows={2}
                  value={formObservaciones}
                  onChange={(e) => setFormObservaciones(e.target.value)}
                  placeholder="Hermeticidad, monitoreo térmico, labores realizadas..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs outline-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowModalAddEdit(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#00603C] hover:bg-[#004d30] text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-md"
                >
                  {bolsonAEditar ? 'Guardar Cambios' : 'Crear Bolsón'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL HISTORIAL DE MOVIMIENTOS DEL BOLSÓN */}
      {bolsonHistorial && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 bg-[#00603C] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 font-bold text-sm">
                <History className="w-5 h-5 text-amber-300" />
                <span>Historial de Movimientos — {bolsonHistorial.numeroBolson}</span>
              </div>
              <button
                onClick={() => setBolsonHistorial(null)}
                className="text-white/80 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl grid grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Cliente</span>
                  <span className="font-bold text-slate-800">{bolsonHistorial.cliente}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Cultivo / Variedad</span>
                  <span className="font-bold text-slate-800">{bolsonHistorial.cultivo} {bolsonHistorial.variedad}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Stock Actual</span>
                  <span className="font-mono font-black text-emerald-800">
                    {(bolsonHistorial.stockKg || 0).toLocaleString('es-AR')} kg
                  </span>
                </div>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-[10px] font-black uppercase text-slate-600 border-b border-slate-200">
                      <th className="py-2.5 px-3">Fecha</th>
                      <th className="py-2.5 px-3">Tipo</th>
                      <th className="py-2.5 px-3">Destino Silo</th>
                      <th className="py-2.5 px-3">Comprobante</th>
                      <th className="py-2.5 px-3 text-right">Kilos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {movimientosSilo
                      .filter(
                        (m) =>
                          m.tipo === 'INGRESO' &&
                          ((m.bolsonOrigenId && m.bolsonOrigenId === bolsonHistorial.id) ||
                            (m.bolsonOrigenNro &&
                              m.bolsonOrigenNro.trim().toLowerCase() ===
                                (bolsonHistorial.numeroBolson || '').trim().toLowerCase()))
                      )
                      .map((m, idx) => (
                        <tr key={m.id || idx} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 text-slate-700">{m.fecha || '—'}</td>
                          <td className="py-2.5 px-3 font-bold text-emerald-800">{m.tipo}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">{m.siloId}</td>
                          <td className="py-2.5 px-3 text-slate-600">{m.comprobanteCartaPorte || m.remito || '—'}</td>
                          <td className="py-2.5 px-3 text-right font-black text-amber-700">
                            {(m.kg || 0).toLocaleString('es-AR')} kg
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setBolsonHistorial(null)}
                className="px-4 py-2 bg-slate-800 text-white font-bold text-xs rounded-xl hover:bg-slate-700"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMACIÓN DE ELIMINACIÓN */}
      {bolsonAEliminar && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-3 bg-red-50 rounded-2xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-base text-slate-900">
                  ¿Eliminar Bolsón en Campo?
                </h3>
                <p className="text-xs text-slate-500 font-sans">
                  Esta acción es irreversible y removerá el registro de la base de datos.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 font-mono text-xs space-y-1">
              <div>
                <strong>N° Bolsón:</strong> {bolsonAEliminar.numeroBolson}
              </div>
              <div>
                <strong>Cliente:</strong> {bolsonAEliminar.cliente}
              </div>
              <div>
                <strong>Stock:</strong> {(bolsonAEliminar.stockKg || 0).toLocaleString('es-AR')} kg
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBolsonAEliminar(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl cursor-pointer shadow-md"
              >
                Eliminar Permanentemente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL IMPORTAR EXCEL */}
      {showModalImport && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 font-serif font-bold text-base text-slate-900">
                <Upload className="w-5 h-5 text-emerald-700" />
                <span>Importar Bolsones desde Excel</span>
              </div>
              <button
                onClick={() => setShowModalImport(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {importError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl font-semibold">
                {importError}
              </div>
            )}

            {importNotice && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-semibold">
                {importNotice}
              </div>
            )}

            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:border-emerald-500 transition cursor-pointer">
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#00603C] file:text-white hover:file:bg-[#004d30] cursor-pointer"
              />
              <p className="text-[11px] text-slate-400 mt-2">
                Formatos compatibles: Microsoft Excel (.xlsx, .xls)
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowModalImport(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={importPreview.length === 0 || isImporting}
                onClick={handleConfirmImport}
                className="px-5 py-2 bg-[#00603C] hover:bg-[#004d30] text-white font-bold text-xs rounded-xl disabled:opacity-50 shadow-md"
              >
                {isImporting ? 'Importando...' : `Confirmar Importación (${importPreview.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
