import React, { useState } from 'react';
import { Chofer } from '../types';
import {
  Truck,
  Search,
  UserPlus,
  FileSpreadsheet,
  Download,
  Upload,
  Edit2,
  Trash2,
  CheckCircle,
  AlertCircle,
  Info,
  X,
  CreditCard,
  Phone,
  FileText,
  Building2,
  UserCheck,
  RefreshCw,
  Copy,
  Plus
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { db, sanitizeForFirestore } from '../lib/firebase';
import { doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { findExistingChofer, mergeChoferData } from '../utils/choferes';

interface ChoferesViewProps {
  choferes: Chofer[];
  onUpdateChoferes?: (choferes: Chofer[]) => void;
}

export const ChoferesView: React.FC<ChoferesViewProps> = ({ choferes = [], onUpdateChoferes }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModalAddEdit, setShowModalAddEdit] = useState(false);
  const [showModalImport, setShowModalImport] = useState(false);
  const [choferAEditar, setChoferAEditar] = useState<Chofer | null>(null);

  // Form State
  const [formNombre, setFormNombre] = useState('');
  const [formCuit, setFormCuit] = useState('');
  const [formTransporte, setFormTransporte] = useState('');
  const [formPatenteChasis, setFormPatenteChasis] = useState('');
  const [formPatenteAcoplado, setFormPatenteAcoplado] = useState('');
  const [formTara, setFormTara] = useState<number | ''>('');
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    nombre?: string;
    cuit?: string;
    transporte?: string;
    patenteChasis?: string;
    patenteAcoplado?: string;
    tara?: string;
  }>({});

  // Import State
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<Partial<Chofer>[]>([]);
  const [importNotice, setImportNotice] = useState('');
  const [importError, setImportError] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // General Notification
  const [notificacion, setNotificacion] = useState('');

  // Modal para confirmación de eliminación
  const [choferAEliminar, setChoferAEliminar] = useState<Chofer | null>(null);

  // Detección de CUIT duplicado en tiempo real
  const cleanCuitActual = formCuit.trim();
  const choferExistentePorCuit = cleanCuitActual.length === 11
    ? choferes.find((c) => c.cuit && c.cuit.trim() === cleanCuitActual && c.id !== choferAEditar?.id)
    : undefined;

  // Reset y Abrir Modal de Chofer (Creación)
  const handleOpenAddModal = () => {
    setChoferAEditar(null);
    setFormNombre('');
    setFormCuit('');
    setFormTransporte('');
    setFormPatenteChasis('');
    setFormPatenteAcoplado('');
    setFormTara('');
    setFormError('');
    setFieldErrors({});
    setShowModalAddEdit(true);
  };

  // Abrir Modal de Edición
  const handleOpenEditModal = (ch: Chofer) => {
    setChoferAEditar(ch);
    setFormNombre(ch.nombre || '');
    setFormCuit(ch.cuit || '');
    setFormTransporte(ch.transporte || '');
    setFormPatenteChasis(ch.patenteChasis || ch.patenteCamion || '');
    setFormPatenteAcoplado(ch.patenteAcoplado || '');
    setFormTara(ch.tara !== undefined ? ch.tara : '');
    
    setFormError('');
    setFieldErrors({});
    setShowModalAddEdit(true);
  };

  // Guardar Chofer (Crear / Editar)
  const handleSaveChofer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFieldErrors({});

    const errors: {
      nombre?: string;
      cuit?: string;
      transporte?: string;
      patenteChasis?: string;
      patenteAcoplado?: string;
    } = {};

    // 1. Nombre: texto libre
    if (!formNombre.trim()) {
      errors.nombre = 'El campo Nombre es obligatorio.';
    }

    // 2. CUIT: solo números, sin guiones (11 dígitos), validar que no acepte letras ni guiones y no esté duplicado
    const cleanCuit = formCuit.trim();
    if (!cleanCuit) {
      errors.cuit = 'El campo CUIT es obligatorio.';
    } else if (!/^\d{11}$/.test(cleanCuit)) {
      errors.cuit = 'El CUIT debe contener exactamente 11 dígitos numéricos (sin guiones ni letras).';
    } else if (choferExistentePorCuit) {
      errors.cuit = `El CUIT ${cleanCuit} ya está registrado para "${choferExistentePorCuit.nombre}".`;
    }

    // 3. Transporte: solo letras (sin números ni caracteres especiales)
    const cleanTransporte = formTransporte.trim();
    if (!cleanTransporte) {
      errors.transporte = 'El campo Transporte es obligatorio.';
    } else if (!/^[a-zA-ZáéióúÁÉÍÓÚñÑ\s]+$/.test(cleanTransporte)) {
      errors.transporte = 'El Transporte solo debe contener letras (sin números ni caracteres especiales).';
    }

    // 4. Patente chasis: 6 o 7 caracteres alfanuméricos
    const cleanChasis = formPatenteChasis.trim().toUpperCase();
    if (!cleanChasis) {
      errors.patenteChasis = 'La Patente del chasis es obligatoria.';
    } else if (!/^[A-Z0-9]{6,7}$/.test(cleanChasis)) {
      errors.patenteChasis = 'La Patente del chasis debe contener entre 6 y 7 caracteres alfanuméricos.';
    }

    // 5. Patente acoplado: 6 o 7 caracteres alfanuméricos
    const cleanAcoplado = formPatenteAcoplado.trim().toUpperCase();
    if (!cleanAcoplado) {
      errors.patenteAcoplado = 'La Patente del acoplado es obligatoria.';
    } else if (!/^[A-Z0-9]{6,7}$/.test(cleanAcoplado)) {
      errors.patenteAcoplado = 'La Patente del acoplado debe contener entre 6 y 7 caracteres alfanuméricos.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError('Por favor complete y corrija los campos marcados antes de enviar.');
      return;
    }

    const candidateData: Chofer = {
      id: choferAEditar ? choferAEditar.id : `CHOFER-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      nombre: formNombre.trim(),
      cuit: cleanCuit,
      transporte: cleanTransporte,
      patenteChasis: cleanChasis,
      patenteAcoplado: cleanAcoplado,
      patenteCamion: cleanChasis,
      patentes: `${cleanChasis} / ${cleanAcoplado}`,
      tara: formTara !== '' && !isNaN(Number(formTara)) ? Number(formTara) : undefined,
    };

    try {
      // Guardar en Firestore
      await setDoc(doc(db, 'choferes', candidateData.id), sanitizeForFirestore(candidateData), { merge: false });
      setShowModalAddEdit(false);
      setNotificacion(choferAEditar ? 'Chofer actualizado con éxito.' : 'Nuevo chofer registrado en la base de datos.');
      setTimeout(() => setNotificacion(''), 4000);
    } catch (err: any) {
      console.error('Error al guardar chofer en Firestore:', err);
      setFormError('Error al guardar en la base de datos: ' + (err.message || err));
    }
  };

  // Confirmar Eliminación
  const handleConfirmDelete = async () => {
    if (!choferAEliminar) return;
    try {
      await deleteDoc(doc(db, 'choferes', choferAEliminar.id));
      setNotificacion(`Se eliminó a ${choferAEliminar.nombre} de la base de datos.`);
      setChoferAEliminar(null);
      setTimeout(() => setNotificacion(''), 4000);
    } catch (err: any) {
      console.error('Error al eliminar chofer:', err);
      alert('Error al eliminar: ' + (err.message || err));
    }
  };

  // Exportar Modelo / Plantilla de Excel
  const handleExportModelTemplate = () => {
    const templateData = [
      {
        'Nombre': 'Carlos Eduardo Gómez',
        'CUIT': '20284910394',
        'Transporte': 'Transporte Expreso Pampa',
        'Patente chasis': 'AA123BB',
        'Patente acoplado': 'CC456DD',
        'Tara (kg)': 14500
      },
      {
        'Nombre': 'Juan Manuel Pérez',
        'CUIT': '20318492018',
        'Transporte': 'TransAgro',
        'Patente chasis': 'AB987CD',
        'Patente acoplado': 'EF321GH',
        'Tara (kg)': 15200
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [
      { wch: 30 }, // Nombre
      { wch: 18 }, // CUIT
      { wch: 32 }, // Transporte
      { wch: 18 }, // Patente chasis
      { wch: 18 }, // Patente acoplado
      { wch: 15 }  // Tara (kg)
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla_Choferes');
    XLSX.writeFile(wb, 'Modelo_Base_de_Datos_Choferes.xlsx');
  };

  // Exportar Base de Datos Actual a Excel
  const handleExportCurrentDatabase = () => {
    if (choferes.length === 0) {
      alert('No hay choferes registrados para exportar.');
      return;
    }

    const exportData = choferes.map((c, idx) => ({
      'N°': idx + 1,
      'Nombre': c.nombre,
      'CUIT': c.cuit || '—',
      'Transporte': c.transporte || '—',
      'Patente chasis': c.patenteChasis || c.patenteCamion || '—',
      'Patente acoplado': c.patenteAcoplado || '—',
      'Tara (kg)': c.tara !== undefined ? c.tara : '—'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 30 },
      { wch: 18 },
      { wch: 32 },
      { wch: 18 },
      { wch: 18 },
      { wch: 15 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Base_Choferes');
    XLSX.writeFile(wb, `Base_de_Datos_Choferes_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Procesar archivo Excel para importar
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError('');
    setImportNotice('');
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const data = XLSX.utils.sheet_to_json<any>(ws);

        if (!data || data.length === 0) {
          setImportError('El archivo Excel no contiene filas de datos.');
          setImportPreview([]);
          return;
        }

        const parsedChoferes: Partial<Chofer>[] = [];

        data.forEach((row, idx) => {
          // Búsqueda inteligente de columnas
          const getVal = (keys: string[]) => {
            for (const key of Object.keys(row)) {
              const cleanKey = key.toLowerCase().trim();
              if (keys.some((k) => cleanKey.includes(k))) {
                return String(row[key]).trim();
              }
            }
            return '';
          };

          const nombre = getVal(['nombre', 'chofer', 'driver', 'conductor', 'apellido']);
          const cuit = getVal(['cuit', 'dni', 'documento', 'identificacion']);
          const transporte = getVal(['transporte', 'empresa', 'razon social', 'flete']);
          const patenteChasis = getVal(['chasis', 'camion', 'camión', 'tractor']);
          const patenteAcoplado = getVal(['acoplado', 'remolque']);
          const rawTara = getVal(['tara', 'peso tara']);
          const parsedTara = rawTara ? parseFloat(rawTara.replace(/[^\d.]/g, '')) : undefined;

          if (nombre || cuit || transporte) {
            parsedChoferes.push({
              nombre: nombre || `Chofer ${idx + 1}`,
              cuit: cuit.replace(/\D/g, '').slice(0, 11),
              transporte: transporte.replace(/[^a-zA-ZáéióúÁÉÍÓÚñÑ\s]/g, ''),
              patenteChasis: patenteChasis.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7),
              patenteAcoplado: patenteAcoplado.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7),
              patenteCamion: patenteChasis.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7),
              patentes: patenteAcoplado ? `${patenteChasis} / ${patenteAcoplado}` : patenteChasis,
              tara: parsedTara && !isNaN(parsedTara) ? parsedTara : undefined,
            });
          }
        });

        if (parsedChoferes.length === 0) {
          setImportError('No se pudieron reconocer columnas válidas (Nombre, CUIT, Transporte) en el archivo Excel.');
          setImportPreview([]);
        } else {
          setImportPreview(parsedChoferes);
        }
      } catch (err: any) {
        console.error('Error al leer Excel:', err);
        setImportError('Error al leer el archivo Excel: ' + (err.message || err));
      }
    };

    reader.readAsBinaryString(file);
  };

  // Confirmar Importación e Insertar en Firestore
  const handleConfirmImport = async () => {
    if (importPreview.length === 0) return;
    setIsImporting(true);
    setImportError('');

    try {
      const batch = writeBatch(db);
      let importedCount = 0;

      for (const item of importPreview) {
        if (!item.nombre) continue;

        const candidateData = {
          nombre: item.nombre.trim(),
          cuit: (item.cuit || '').trim(),
          transporte: (item.transporte || '').trim(),
          patenteChasis: (item.patenteChasis || '').trim().toUpperCase(),
          patenteAcoplado: (item.patenteAcoplado || '').trim().toUpperCase(),
          patenteCamion: (item.patenteChasis || '').trim().toUpperCase(),
          patentes: item.patenteAcoplado ? `${item.patenteChasis} / ${item.patenteAcoplado}` : (item.patenteChasis || ''),
          tara: item.tara
        };

        const existing = findExistingChofer(candidateData, choferes);
        const fullChofer = mergeChoferData(existing, candidateData);

        const docRef = doc(db, 'choferes', fullChofer.id);
        batch.set(docRef, sanitizeForFirestore(fullChofer), { merge: true });
        importedCount++;
      }

      await batch.commit();
      setIsImporting(false);
      setShowModalImport(false);
      setImportPreview([]);
      setImportFile(null);
      setNotificacion(`¡Se procesaron ${importedCount} choferes exitosamente en la base de datos!`);
      setTimeout(() => setNotificacion(''), 5000);
    } catch (err: any) {
      console.error('Error al guardar lote en Firestore:', err);
      setIsImporting(false);
      setImportError('Error en importación batch: ' + (err.message || err));
    }
  };

  // Filtrado de la lista
  const filteredChoferes = choferes.filter((c) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    return (
      (c.nombre && c.nombre.toLowerCase().includes(term)) ||
      (c.cuit && c.cuit.toLowerCase().includes(term)) ||
      (c.transporte && c.transporte.toLowerCase().includes(term)) ||
      (c.patentes && c.patentes.toLowerCase().includes(term)) ||
      (c.licencia && c.licencia.toLowerCase().includes(term)) ||
      (c.telefono && c.telefono.toLowerCase().includes(term))
    );
  });

  // Estadísticas únicas
  const totalTransportes = new Set(choferes.map((c) => c.transporte).filter(Boolean)).size;
  const totalConCuit = choferes.filter((c) => c.cuit && c.cuit !== '—').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Notificación Global de Éxito */}
      {notificacion && (
        <div className="p-4 bg-emerald-50 border-l-4 border-emerald-600 text-emerald-900 rounded-r-xl shadow-md flex items-center justify-between text-xs font-bold animate-in slide-in-from-top">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <span>{notificacion}</span>
          </div>
          <button onClick={() => setNotificacion('')} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* BANNER HEADER SUPERIOR DE TITULO Y ACCIONES */}
      <div className="bg-gradient-to-r from-[#00603C] via-[#004d30] to-[#1e3e2b] text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-[#00603C]/30">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-xs text-[#C9922E]">
            <Truck className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black font-serif tracking-tight text-white">
                Base de Datos de Choferes y Transporte
              </h1>
              <span className="bg-[#C9922E] text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                Maestro Data
              </span>
            </div>
            <p className="text-xs text-emerald-100/90 font-medium mt-1">
              Registro centralizado de conductores, licencias, empresas de flete y patentes habilitadas
            </p>
          </div>
        </div>

        {/* Grupo de Botones de Acción */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={handleExportModelTemplate}
            className="flex-1 md:flex-none px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl border border-white/20 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
            title="Descargar Plantilla Excel estructurada para completar datos"
          >
            <Download className="w-4 h-4 text-[#C9922E]" />
            <span>Descargar Modelo</span>
          </button>

          <button
            onClick={() => {
              setImportFile(null);
              setImportPreview([]);
              setImportError('');
              setImportNotice('');
              setShowModalImport(true);
            }}
            className="flex-1 md:flex-none px-3.5 py-2 bg-[#C9922E] hover:bg-[#b07d24] text-slate-950 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md active:scale-95"
          >
            <FileSpreadsheet className="w-4 h-4 text-slate-950" />
            <span>Importar Ficha (Excel)</span>
          </button>

          <button
            onClick={handleExportCurrentDatabase}
            className="flex-1 md:flex-none px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl border border-white/20 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
            title="Exportar base de datos actual a Excel"
          >
            <Download className="w-4 h-4 text-emerald-300" />
            <span>Exportar Lista</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="flex-1 md:flex-none px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-lg active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Nuevo Chofer</span>
          </button>
        </div>
      </div>

      {/* METRICAS KPI CLAVE */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Choferes Registrados
            </span>
            <span className="text-2xl font-black font-serif text-[#00603C] mt-0.5 block">
              {choferes.length}
            </span>
          </div>
          <div className="p-3 bg-emerald-50 text-[#00603C] rounded-xl">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Empresas de Transporte
            </span>
            <span className="text-2xl font-black font-serif text-[#C9922E] mt-0.5 block">
              {totalTransportes}
            </span>
          </div>
          <div className="p-3 bg-amber-50 text-[#C9922E] rounded-xl">
            <Building2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              CUIT / DNI Verificados
            </span>
            <span className="text-2xl font-black font-serif text-blue-700 mt-0.5 block">
              {totalConCuit}
            </span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-700 rounded-xl">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* BARRA DE BUSQUEDA Y TABLA */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        
        {/* Header de Búsqueda */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-96">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por Nombre, CUIT/DNI, Transporte, Patente o Teléfono..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none shadow-2xs"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Mostrando <strong className="text-slate-800">{filteredChoferes.length}</strong> de <strong className="text-slate-800">{choferes.length}</strong> registros
          </div>
        </div>

        {/* Tabla de Choferes */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                <th className="py-3 px-4">Nombre</th>
                <th className="py-3 px-4">CUIT</th>
                <th className="py-3 px-4">Transporte</th>
                <th className="py-3 px-4">Patente chasis</th>
                <th className="py-3 px-4">Patente acoplado</th>
                <th className="py-3 px-4">Tara (kg)</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredChoferes.length > 0 ? (
                filteredChoferes.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-emerald-100 text-[#00603C] flex items-center justify-center font-bold text-xs shrink-0">
                          {c.nombre.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm">{c.nombre}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                      {c.cuit && c.cuit !== '—' ? (
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-800 border border-slate-200">
                          {c.cuit}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">—</span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-medium text-slate-800">
                      <div className="flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{c.transporte || '—'}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-800">
                      {c.patenteChasis || c.patenteCamion ? (
                        <span className="bg-amber-50 text-amber-900 px-2 py-0.5 rounded border border-amber-200/80 font-bold uppercase">
                          {c.patenteChasis || c.patenteCamion}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">—</span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-800">
                      {c.patenteAcoplado ? (
                        <span className="bg-amber-50 text-amber-900 px-2 py-0.5 rounded border border-amber-200/80 font-bold uppercase">
                          {c.patenteAcoplado}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">—</span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-800 font-semibold">
                      {c.tara !== undefined && c.tara !== null ? (
                        <span className="bg-emerald-50 text-emerald-900 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                          {c.tara.toLocaleString('es-AR')} kg
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">—</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEditModal(c)}
                          className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                          title="Editar Chofer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setChoferAEliminar(c)}
                          className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                          title="Eliminar Chofer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 italic">
                    {searchTerm ? (
                      <div>No se encontraron choferes que coincidan con "{searchTerm}".</div>
                    ) : (
                      <div>No hay choferes registrados en la base de datos. Haga clic en "+ Nuevo Chofer" para agregar uno.</div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL NUEVO / EDITAR CHOFER */}
      {showModalAddEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
            
            {/* Header Modal */}
            <div className="bg-gradient-to-r from-[#00603C] to-[#004d30] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/10 rounded-xl text-emerald-200">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white font-serif">
                    {choferAEditar ? 'Editar Chofer' : 'Registrar Nuevo Chofer'}
                  </h3>
                  <p className="text-[11px] text-emerald-100">
                    Formulario oficial de registro de choferes (5 campos)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModalAddEdit(false)}
                className="p-1 text-emerald-200 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveChofer} className="p-6 space-y-4 text-xs" noValidate>
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* 1. Nombre */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1 flex items-center justify-between">
                  <span>Nombre *</span>
                  {formNombre.trim().length >= 3 && (
                    <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 normal-case">
                      <CheckCircle className="w-3 h-3" /> Válido
                    </span>
                  )}
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    placeholder="ej: Carlos Eduardo Gómez"
                    value={formNombre}
                    onChange={(e) => {
                      setFormNombre(e.target.value);
                      if (fieldErrors.nombre) setFieldErrors((prev) => ({ ...prev, nombre: undefined }));
                    }}
                    className={`w-full px-3 py-2 pr-9 bg-slate-50 border rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition ${
                      fieldErrors.nombre
                        ? 'border-red-500 bg-red-50/50'
                        : formNombre.trim().length >= 3
                        ? 'border-emerald-500 bg-emerald-50/20'
                        : 'border-slate-300'
                    }`}
                  />
                  <div className="absolute right-3 pointer-events-none">
                    {fieldErrors.nombre ? (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    ) : formNombre.trim().length >= 3 ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                    ) : null}
                  </div>
                </div>
                {fieldErrors.nombre ? (
                  <p className="text-red-600 font-semibold text-[11px] mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {fieldErrors.nombre}
                  </p>
                ) : formNombre.trim().length >= 3 ? (
                  <p className="text-emerald-700 font-medium text-[11px] mt-1 flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    Nombre verificado correctamente.
                  </p>
                ) : null}
              </div>

              {/* 2. CUIT */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1 flex items-center justify-between">
                  <span>CUIT *</span>
                  <span className={`text-[10px] font-bold flex items-center gap-1 normal-case ${
                    choferExistentePorCuit
                      ? 'text-red-600'
                      : formCuit.length === 11
                      ? 'text-emerald-600'
                      : formCuit.length > 0
                      ? 'text-amber-600'
                      : 'text-slate-400'
                  }`}>
                    {choferExistentePorCuit ? (
                      <><AlertCircle className="w-3 h-3 text-red-500" /> ¡CUIT Ya Registrado!</>
                    ) : formCuit.length === 11 ? (
                      <><CheckCircle className="w-3 h-3" /> CUIT Válido (11/11)</>
                    ) : (
                      <>{formCuit.length}/11 dígitos</>
                    )}
                  </span>
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    maxLength={11}
                    placeholder="ej: 20284910394"
                    value={formCuit}
                    onChange={(e) => {
                      const onlyNums = e.target.value.replace(/\D/g, '').slice(0, 11);
                      setFormCuit(onlyNums);
                      if (fieldErrors.cuit) setFieldErrors((prev) => ({ ...prev, cuit: undefined }));
                    }}
                    className={`w-full px-3 py-2 pr-9 bg-slate-50 border rounded-xl font-mono text-slate-900 focus:ring-2 outline-none transition ${
                      fieldErrors.cuit || choferExistentePorCuit
                        ? 'border-red-500 bg-red-50/50 focus:ring-red-500'
                        : formCuit.length === 11
                        ? 'border-emerald-500 bg-emerald-50/20 focus:ring-emerald-500'
                        : formCuit.length > 0
                        ? 'border-amber-400 bg-amber-50/20 focus:ring-amber-400'
                        : 'border-slate-300 focus:ring-emerald-500'
                    }`}
                  />
                  <div className="absolute right-3 pointer-events-none">
                    {fieldErrors.cuit || choferExistentePorCuit ? (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    ) : formCuit.length === 11 ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                    ) : formCuit.length > 0 ? (
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                    ) : null}
                  </div>
                </div>

                {/* Banner de advertencia de CUIT Duplicado en tiempo real */}
                {choferExistentePorCuit && (
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-900 text-xs font-medium flex items-start gap-2.5 shadow-xs">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div className="space-y-1 w-full">
                      <p className="font-bold text-red-950 flex items-center justify-between">
                        <span>⚠️ Este CUIT ya existe en la base de datos</span>
                      </p>
                      <p className="text-red-800 text-[11px] leading-relaxed">
                        El CUIT <strong className="font-mono text-red-950 font-bold">{cleanCuitActual}</strong> pertenece al siguiente chofer registrado:
                      </p>
                      <div className="mt-1 p-2 bg-white/90 border border-red-200 rounded-lg text-[11px] text-slate-800 space-y-0.5">
                        <p><strong>Chofer:</strong> {choferExistentePorCuit.nombre}</p>
                        <p><strong>Empresa:</strong> {choferExistentePorCuit.transporte || '—'}</p>
                        <p><strong>Patentes:</strong> {choferExistentePorCuit.patenteChasis || choferExistentePorCuit.patenteCamion || '—'} {choferExistentePorCuit.patenteAcoplado ? `/ ${choferExistentePorCuit.patenteAcoplado}` : ''}</p>
                      </div>
                      <p className="text-red-700 text-[10px] font-semibold mt-1">
                        Para evitar registros duplicados, verifique el CUIT o edite la ficha del chofer existente.
                      </p>
                    </div>
                  </div>
                )}

                {fieldErrors.cuit ? (
                  <p className="text-red-600 font-semibold text-[11px] mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {fieldErrors.cuit}
                  </p>
                ) : !choferExistentePorCuit && formCuit.length === 11 ? (
                  <p className="text-emerald-700 font-semibold text-[11px] mt-1 flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    CUIT único y verificado (11 dígitos numéricos válidos).
                  </p>
                ) : !choferExistentePorCuit && formCuit.length > 0 ? (
                  <p className="text-amber-700 font-medium text-[11px] mt-1 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    CUIT incompleto ({formCuit.length}/11 dígitos — faltan {11 - formCuit.length} dígitos).
                  </p>
                ) : !choferExistentePorCuit ? (
                  <p className="text-slate-500 text-[11px] mt-1 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    Ingrese exactamente 11 números sin guiones ni puntos.
                  </p>
                ) : null}
              </div>

              {/* 3. Transporte */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1 flex items-center justify-between">
                  <span>Transporte *</span>
                  {formTransporte.trim().length >= 2 && (
                    <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 normal-case">
                      <CheckCircle className="w-3 h-3" /> Válido
                    </span>
                  )}
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    placeholder="ej: Transporte Don Pedro"
                    value={formTransporte}
                    onChange={(e) => {
                      const onlyLetters = e.target.value.replace(/[^a-zA-ZáéióúÁÉÍÓÚñÑ\s]/g, '');
                      setFormTransporte(onlyLetters);
                      if (fieldErrors.transporte) setFieldErrors((prev) => ({ ...prev, transporte: undefined }));
                    }}
                    className={`w-full px-3 py-2 pr-9 bg-slate-50 border rounded-xl font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition ${
                      fieldErrors.transporte
                        ? 'border-red-500 bg-red-50/50'
                        : formTransporte.trim().length >= 2
                        ? 'border-emerald-500 bg-emerald-50/20'
                        : 'border-slate-300'
                    }`}
                  />
                  <div className="absolute right-3 pointer-events-none">
                    {fieldErrors.transporte ? (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    ) : formTransporte.trim().length >= 2 ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                    ) : null}
                  </div>
                </div>
                {fieldErrors.transporte ? (
                  <p className="text-red-600 font-semibold text-[11px] mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {fieldErrors.transporte}
                  </p>
                ) : formTransporte.trim().length >= 2 ? (
                  <p className="text-emerald-700 font-medium text-[11px] mt-1 flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    Empresa de transporte válida (solo letras).
                  </p>
                ) : (
                  <p className="text-slate-500 text-[11px] mt-1 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    Solo debe contener letras (sin números ni caracteres especiales).
                  </p>
                )}
              </div>

              {/* 4. Patente chasis */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1 flex items-center justify-between">
                  <span>Patente chasis *</span>
                  <span className={`text-[10px] font-bold flex items-center gap-1 normal-case ${
                    formPatenteChasis.length === 6 || formPatenteChasis.length === 7
                      ? 'text-emerald-600'
                      : formPatenteChasis.length > 0
                      ? 'text-amber-600'
                      : 'text-slate-400'
                  }`}>
                    {formPatenteChasis.length === 6 || formPatenteChasis.length === 7 ? (
                      <><CheckCircle className="w-3 h-3" /> Formato correcto ({formPatenteChasis.length} car.)</>
                    ) : (
                      <>{formPatenteChasis.length}/6-7 car.</>
                    )}
                  </span>
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    maxLength={7}
                    placeholder="ej: AB123CD"
                    value={formPatenteChasis}
                    onChange={(e) => {
                      const clean = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
                      setFormPatenteChasis(clean);
                      if (fieldErrors.patenteChasis) setFieldErrors((prev) => ({ ...prev, patenteChasis: undefined }));
                    }}
                    className={`w-full px-3 py-2 pr-9 bg-slate-50 border rounded-xl font-mono uppercase text-slate-900 focus:ring-2 outline-none transition ${
                      fieldErrors.patenteChasis
                        ? 'border-red-500 bg-red-50/50 focus:ring-red-500'
                        : formPatenteChasis.length === 6 || formPatenteChasis.length === 7
                        ? 'border-emerald-500 bg-emerald-50/20 focus:ring-emerald-500'
                        : formPatenteChasis.length > 0
                        ? 'border-amber-400 bg-amber-50/20 focus:ring-amber-400'
                        : 'border-slate-300 focus:ring-emerald-500'
                    }`}
                  />
                  <div className="absolute right-3 pointer-events-none">
                    {fieldErrors.patenteChasis ? (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    ) : formPatenteChasis.length === 6 || formPatenteChasis.length === 7 ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                    ) : formPatenteChasis.length > 0 ? (
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                    ) : null}
                  </div>
                </div>
                {fieldErrors.patenteChasis ? (
                  <p className="text-red-600 font-semibold text-[11px] mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {fieldErrors.patenteChasis}
                  </p>
                ) : formPatenteChasis.length === 6 || formPatenteChasis.length === 7 ? (
                  <p className="text-emerald-700 font-semibold text-[11px] mt-1 flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    Patente de chasis válida ({formPatenteChasis.length} caracteres alfanuméricos).
                  </p>
                ) : formPatenteChasis.length > 0 ? (
                  <p className="text-amber-700 font-medium text-[11px] mt-1 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    Patente incompleta ({formPatenteChasis.length} caracteres). Se requieren 6 o 7 caracteres.
                  </p>
                ) : (
                  <p className="text-slate-500 text-[11px] mt-1 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    6 o 7 caracteres alfanuméricos (ej: AB123CD o AA123BB).
                  </p>
                )}
              </div>

              {/* 5. Patente acoplado */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1 flex items-center justify-between">
                  <span>Patente acoplado *</span>
                  <span className={`text-[10px] font-bold flex items-center gap-1 normal-case ${
                    formPatenteAcoplado.length === 6 || formPatenteAcoplado.length === 7
                      ? 'text-emerald-600'
                      : formPatenteAcoplado.length > 0
                      ? 'text-amber-600'
                      : 'text-slate-400'
                  }`}>
                    {formPatenteAcoplado.length === 6 || formPatenteAcoplado.length === 7 ? (
                      <><CheckCircle className="w-3 h-3" /> Formato correcto ({formPatenteAcoplado.length} car.)</>
                    ) : (
                      <>{formPatenteAcoplado.length}/6-7 car.</>
                    )}
                  </span>
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    maxLength={7}
                    placeholder="ej: CC456DD"
                    value={formPatenteAcoplado}
                    onChange={(e) => {
                      const clean = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
                      setFormPatenteAcoplado(clean);
                      if (fieldErrors.patenteAcoplado) setFieldErrors((prev) => ({ ...prev, patenteAcoplado: undefined }));
                    }}
                    className={`w-full px-3 py-2 pr-9 bg-slate-50 border rounded-xl font-mono uppercase text-slate-900 focus:ring-2 outline-none transition ${
                      fieldErrors.patenteAcoplado
                        ? 'border-red-500 bg-red-50/50 focus:ring-red-500'
                        : formPatenteAcoplado.length === 6 || formPatenteAcoplado.length === 7
                        ? 'border-emerald-500 bg-emerald-50/20 focus:ring-emerald-500'
                        : formPatenteAcoplado.length > 0
                        ? 'border-amber-400 bg-amber-50/20 focus:ring-amber-400'
                        : 'border-slate-300 focus:ring-emerald-500'
                    }`}
                  />
                  <div className="absolute right-3 pointer-events-none">
                    {fieldErrors.patenteAcoplado ? (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    ) : formPatenteAcoplado.length === 6 || formPatenteAcoplado.length === 7 ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                    ) : formPatenteAcoplado.length > 0 ? (
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                    ) : null}
                  </div>
                </div>
                {fieldErrors.patenteAcoplado ? (
                  <p className="text-red-600 font-semibold text-[11px] mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {fieldErrors.patenteAcoplado}
                  </p>
                ) : formPatenteAcoplado.length === 6 || formPatenteAcoplado.length === 7 ? (
                  <p className="text-emerald-700 font-semibold text-[11px] mt-1 flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    Patente de acoplado válida ({formPatenteAcoplado.length} caracteres alfanuméricos).
                  </p>
                ) : formPatenteAcoplado.length > 0 ? (
                  <p className="text-amber-700 font-medium text-[11px] mt-1 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    Patente incompleta ({formPatenteAcoplado.length} caracteres). Se requieren 6 o 7 caracteres.
                  </p>
                ) : (
                  <p className="text-slate-500 text-[11px] mt-1 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    6 o 7 caracteres alfanuméricos (ej: CC456DD o AA123BB).
                  </p>
                )}
              </div>

              {/* 6. Tara del camión (kg) */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1 flex items-center justify-between">
                  <span>Tara del Camión (kg)</span>
                  <span className="text-[10px] text-slate-400 normal-case font-medium">Peso en vacío</span>
                </label>
                <div className="relative flex items-center">
                  <input
                    type="number"
                    min="0"
                    placeholder="ej: 14500"
                    value={formTara}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormTara(val === '' ? '' : Math.max(0, Number(val)));
                      if (fieldErrors.tara) setFieldErrors((prev) => ({ ...prev, tara: undefined }));
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition font-semibold"
                  />
                  <span className="absolute right-3 text-xs font-bold text-slate-400 pointer-events-none">kg</span>
                </div>
                <p className="text-slate-500 text-[11px] mt-1 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  Peso del vehículo en vacío. Se utilizará para calcular el Bruto en los reportes de Silos.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModalAddEdit(false)}
                  className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#00603C] hover:bg-[#004d30] text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-md"
                >
                  {choferAEditar ? 'Guardar Cambios' : 'Registrar Chofer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL IMPORTAR DESDE EXCEL */}
      {showModalImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
            
            <div className="bg-gradient-to-r from-[#C9922E] to-[#9b6f1e] text-slate-950 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-slate-950/10 rounded-xl text-slate-950">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base font-serif text-slate-950">
                    Importar Ficha de Choferes desde Excel
                  </h3>
                  <p className="text-[11px] text-slate-900 font-medium">
                    Sube una lista en Excel o CSV para cargar choferes masivamente
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModalImport(false)}
                className="p-1 text-slate-900 hover:text-slate-950 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              
              {/* Instrucción y Botón de Descarga de Plantilla */}
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start justify-between gap-3 text-amber-900">
                <div className="text-[11px] leading-relaxed">
                  <strong>Recomendación:</strong> Para garantizar un reconocimiento perfecto de las columnas, descarga nuestro modelo de tabla precargado y completa con tus datos.
                </div>
                <button
                  onClick={handleExportModelTemplate}
                  className="shrink-0 px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white font-bold text-[10px] rounded-lg transition flex items-center gap-1 shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Modelo Excel</span>
                </button>
              </div>

              {importError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {/* Selector de Archivo Dropzone */}
              <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:border-amber-500 bg-slate-50 transition cursor-pointer relative">
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                <span className="font-bold text-slate-800 block text-sm">
                  {importFile ? importFile.name : 'Haz clic o arrastra aquí tu archivo Excel/CSV'}
                </span>
                <span className="text-[10px] text-slate-500 block mt-1">
                  Formatos soportados: .xlsx, .xls, .csv
                </span>
              </div>

              {/* Vista Previa de Filas Mapeadas */}
              {importPreview.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs">
                      Vista previa de {importPreview.length} choferes reconocidos:
                    </span>
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Formato válido
                    </span>
                  </div>

                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl text-[11px] divide-y divide-slate-100">
                    {importPreview.map((item, idx) => (
                      <div key={idx} className="p-2.5 bg-white flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-900">{item.nombre}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            DNI: {item.cuit} · {item.transporte}
                          </div>
                        </div>
                        <div className="text-[10px] font-mono bg-slate-100 px-2 py-1 rounded text-slate-700">
                          {item.patentes}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModalImport(false)}
                  className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={importPreview.length === 0 || isImporting}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-slate-950 font-extrabold text-xs rounded-xl transition cursor-pointer shadow-md flex items-center gap-1.5"
                >
                  {isImporting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                      <span>Importando a Base de Datos...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 text-slate-950" />
                      <span>Confirmar e Importar ({importPreview.length})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ELIMINAR CHOFER */}
      {choferAEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-red-600 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-200" />
                <h3 className="font-bold text-base text-white font-serif">Eliminar Chofer</h3>
              </div>
              <button onClick={() => setChoferAEliminar(null)} className="text-red-100 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3 text-xs">
              <p className="text-slate-700 font-medium">
                ¿Está seguro de eliminar a <strong className="text-slate-900 font-bold">{choferAEliminar.nombre}</strong> ({choferAEliminar.cuit}) de la base de datos de choferes?
              </p>
              <p className="text-[11px] text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-200">
                Esta acción eliminará el registro de la base de datos. Los registros de salidas o ingresos anteriores mantendrán sus datos impresos en los comprobantes.
              </p>
            </div>

            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setChoferAEliminar(null)}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs"
              >
                Eliminar Registro
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
