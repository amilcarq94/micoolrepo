import React, { useState, useMemo } from 'react';
import {
  Truck,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Scale,
  CreditCard,
  Building2,
  Info,
  Calendar,
  User,
  Wheat,
  Tag,
  MapPin,
  Package,
  Download,
  Ban
} from 'lucide-react';
import { Chofer, BolsonCampo, MovimientoSilo, SiloId, CATEGORIAS_OFICIALES, SECTORES_BOLSON_OPCIONES } from '../types';
import { ChoferSearchSelector } from './ChoferSearchSelector';
import { BolsonSearchSelector } from './BolsonSearchSelector';
import { ClienteSelect } from './ClienteSelect';
import { validateSiloIngresoMatch } from '../utils/siloValidation';

export type ModalidadTransporteType = 'TERCEROS_CHOFER' | 'TERCEROS_MONTANER' | 'PROPIO_AA';

export interface CamionItem {
  id: string;
  modalidadTransporte: ModalidadTransporteType;
  tipoTransporte: 'CHOFER' | 'FLETE';
  choferNombre: string;
  choferCuit: string;
  choferPatentes: string;
  choferTransporte: string;
  fleteOpcion: 'Flete Montaner' | 'Flete AA' | 'Flete Agro Abacus';
  brutoKg: number | '';
  taraKg: number | '';
  netoKg: number | '';
  humedad: number | '';
  observaciones: string;
}

export interface CargaMultipleCamionesFormProps {
  activeSilo: SiloId;
  currentSiloStock: number;
  capacidadMaxSilo: number;
  clientes: string[];
  especies: string[];
  choferes: Chofer[];
  bolsones: BolsonCampo[];
  movimientosSilo?: MovimientoSilo[];
  currentUser: { nombre: string; rol: string };
  onSaveChofer?: (chofer: Chofer) => void;
  onLimpiezaDescarte?: () => void;
  onSubmitCargaMultiple: (movimientos: MovimientoSilo[]) => void;
  onPrintFicha?: () => void;
  onDownloadPdf?: () => void;
  onDownloadPng?: () => void;
}

const createNewCamionItem = (defaultHumedad: number | '' = 13.5): CamionItem => ({
  id: `camion-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  modalidadTransporte: 'TERCEROS_CHOFER',
  tipoTransporte: 'CHOFER',
  choferNombre: '',
  choferCuit: '',
  choferPatentes: '',
  choferTransporte: '',
  fleteOpcion: 'Flete Montaner',
  brutoKg: '',
  taraKg: '',
  netoKg: '',
  humedad: typeof defaultHumedad === 'number' ? defaultHumedad : 13.5,
  observaciones: '',
});

export const CargaMultipleCamionesForm: React.FC<CargaMultipleCamionesFormProps> = ({
  activeSilo,
  currentSiloStock,
  capacidadMaxSilo,
  clientes,
  especies,
  choferes,
  bolsones,
  movimientosSilo = [],
  currentUser,
  onSaveChofer,
  onLimpiezaDescarte,
  onSubmitCargaMultiple,
  onPrintFicha,
  onDownloadPdf,
  onDownloadPng,
}) => {
  // Parámetros comunes de la partida / lote
  const [fecha, setFecha] = useState(() => new Date().toISOString().split('T')[0]);
  const [cliente, setCliente] = useState(clientes[0] || 'San Diego Semilla');
  const [especie, setEspecie] = useState<string>('Soja');
  const [variedad, setVariedad] = useState('P46A03');
  const [categoria, setCategoria] = useState<string>('Fundadora');

  const [campoOrigenSelect, setCampoOrigenSelect] = useState('La Barrancosa');
  const [campoOrigenManual, setCampoOrigenManual] = useState('');

  const [bolsonOrigenId, setBolsonOrigenId] = useState('');
  const [bolsonOrigenNro, setBolsonOrigenNro] = useState('');
  const [bolsonOrigenSector, setBolsonOrigenSector] = useState<string>('Sector A');
  const [depositoOrigen, setDepositoOrigen] = useState('Depósito Central');
  const [humedadDefault, setHumedadDefault] = useState<number | ''>(13.5);

  // Validación de Contaminación de Silo (Silo Match Result)
  const siloContaminadoError = useMemo(() => {
    if (!activeSilo || !cliente || !especie || !variedad || !categoria) return null;

    // Se crea un objeto con los datos del ingreso múltiple a validar
    const datosIngreso = { cliente, especie, variedad, categoria };

    // Se valida contra la función centralizada
    const validation = validateSiloIngresoMatch(activeSilo, datosIngreso, movimientosSilo);

    if (!validation.valid) {
      return validation.errorMessage || '¡ALERTA DE CONTAMINACIÓN! El silo destino ya contiene un producto diferente.';
    }
    return null;
  }, [activeSilo, cliente, especie, variedad, categoria, movimientosSilo]);

  // Lista de camiones
  const [camiones, setCamiones] = useState<CamionItem[]>(() => [
    createNewCamionItem(13.5),
    createNewCamionItem(13.5),
  ]);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Total de kilos a ingresar calculados
  const totalKgCalculado = useMemo(() => {
    return camiones.reduce((sum, c) => {
      let k = typeof c.netoKg === 'number' ? c.netoKg : 0;
      if (k <= 0 && typeof c.brutoKg === 'number' && typeof c.taraKg === 'number' && c.brutoKg > c.taraKg) {
        k = c.brutoKg - c.taraKg;
      }
      return sum + k;
    }, 0);
  }, [camiones]);

  const espacioDisponible = Math.max(0, capacidadMaxSilo - currentSiloStock);
  const stockResultante = currentSiloStock + totalKgCalculado;
  const pctResultante = Math.min(100, (stockResultante / capacidadMaxSilo) * 100);
  const superaCapacidad = totalKgCalculado > espacioDisponible;

  // Manejo de filas de camión
  const handleAddRow = (count = 1) => {
    const newItems: CamionItem[] = [];
    for (let i = 0; i < count; i++) {
      newItems.push(createNewCamionItem(humedadDefault));
    }
    setCamiones(prev => [...prev, ...newItems]);
  };

  const handleRemoveRow = (id: string) => {
    if (camiones.length <= 1) {
      setErrorMsg('Debe conservar al menos un camión en la lista.');
      return;
    }
    setCamiones(prev => prev.filter(c => c.id !== id));
  };

  const handleUpdateCamion = (id: string, updates: Partial<CamionItem>) => {
    setCamiones(prev =>
      prev.map(c => {
        if (c.id !== id) return c;
        const updated = { ...c, ...updates };

        // Si se actualiza Neto o Tara: el Bruto se carga automáticamente con la Tara registrada + el Neto manual
        if ('netoKg' in updates || 'taraKg' in updates) {
          const t = typeof updated.taraKg === 'number' ? updated.taraKg : 0;
          const n = typeof updated.netoKg === 'number' ? updated.netoKg : 0;
          if (n > 0 || t > 0) {
            updated.brutoKg = t + n;
          }
        } else if ('brutoKg' in updates) {
          const b = typeof updated.brutoKg === 'number' ? updated.brutoKg : 0;
          const t = typeof updated.taraKg === 'number' ? updated.taraKg : 0;
          if (b > 0 && t > 0 && b >= t) {
            updated.netoKg = b - t;
          }
        }
        return updated;
      })
    );
  };

  // Submit de la carga masiva
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!cliente.trim()) {
      setErrorMsg('Debe indicar el Cliente o Productor.');
      return;
    }
    if (!especie.trim() || !variedad.trim()) {
      setErrorMsg('Debe indicar Especie y Variedad.');
      return;
    }

    // Validación Final de Contaminación antes de procesar (bloqueante)
    if (siloContaminadoError) {
      setErrorMsg(siloContaminadoError);
      return;
    }

    if (camiones.length === 0) {
      setErrorMsg('Debe ingresar al menos un camión.');
      return;
    }

    // Validar cada camión
    const parsedRows: { item: CamionItem; neto: number }[] = [];
    for (let i = 0; i < camiones.length; i++) {
      const c = camiones[i];
      let neto = typeof c.netoKg === 'number' ? c.netoKg : 0;
      if (neto <= 0 && typeof c.brutoKg === 'number' && typeof c.taraKg === 'number' && c.brutoKg > c.taraKg) {
        neto = c.brutoKg - c.taraKg;
      }
      if (neto <= 0) {
        setErrorMsg(`El Camión #${i + 1} no tiene un peso neto válido (kilos ingresados mayor a 0).`);
        return;
      }
      parsedRows.push({ item: c, neto });
    }

    if (superaCapacidad) {
      setErrorMsg(
        `El total a ingresar (${totalKgCalculado.toLocaleString('es-AR')} kg) supera el espacio disponible en ${activeSilo} (${espacioDisponible.toLocaleString('es-AR')} kg).`
      );
      return;
    }

    const campoOrigenFinal = campoOrigenSelect === 'OTRO_CAMPO' ? campoOrigenManual.trim() || 'Otro Campo' : campoOrigenSelect;

    // Generar array de movimientos
    const nuevosMovimientos: MovimientoSilo[] = parsedRows.map((r, idx) => {
      const { item, neto } = r;
      const movId = `ING-SILO-${activeSilo.replace(/\s+/g, '')}-${Date.now()}-${idx + 1}`;

      const choferVal = item.tipoTransporte === 'CHOFER' ? (item.choferNombre.trim() || '—') : item.fleteOpcion;
      const cuitVal = item.tipoTransporte === 'CHOFER' ? (item.choferCuit.trim() || '—') : '—';
      const patentesVal = item.tipoTransporte === 'CHOFER' ? (item.choferPatentes.trim() || '—') : '—';
      const transporteVal = item.tipoTransporte === 'CHOFER' ? (item.choferTransporte.trim() || '—') : item.fleteOpcion;

      // Guardar chofer en base de datos si es nuevo
      if (item.tipoTransporte === 'CHOFER' && item.choferNombre.trim() && onSaveChofer) {
        const candidate = {
          id: `CHOFER-${Date.now()}-${idx}`,
          nombre: item.choferNombre.trim(),
          cuit: item.choferCuit.trim() || '—',
          patentes: item.choferPatentes.trim() || '—',
          transporte: item.choferTransporte.trim() || 'Sin Transporte',
          tara: typeof item.taraKg === 'number' ? item.taraKg : undefined,
        };
        onSaveChofer(candidate);
      }

      return {
        id: movId,
        siloId: activeSilo,
        fecha,
        tipo: 'INGRESO',
        kg: neto,
        usuario: currentUser.nombre,
        cliente,
        especie,
        variedad,
        categoria,
        campoOrigen: campoOrigenFinal,
        bolsonOrigenId: bolsonOrigenId || undefined,
        bolsonOrigenNro: bolsonOrigenNro.trim(),
        bolsonOrigenSector: bolsonOrigenSector.trim(),
        depositoOrigen: depositoOrigen.trim(),
        humedad: typeof item.humedad === 'number' ? item.humedad : (typeof humedadDefault === 'number' ? humedadDefault : 13.5),
        tipoTransporte: item.tipoTransporte,
        chofer: choferVal,
        cuit: cuitVal,
        patentes: patentesVal,
        transporte: transporteVal,
        tara: typeof item.taraKg === 'number' ? item.taraKg : undefined,
        bruto: typeof item.brutoKg === 'number' ? item.brutoKg : (typeof item.taraKg === 'number' ? item.taraKg + neto : undefined),
        observaciones: item.observaciones.trim() || undefined
      };
    });

    onSubmitCargaMultiple(nuevosMovimientos);
    setSuccessMsg(`¡Carga múltiple exitosa! Se registraron ${nuevosMovimientos.length} camiones con un total de ${totalKgCalculado.toLocaleString('es-AR')} kg en ${activeSilo}.`);

    // Resetear formulario a 2 camiones limpios
    setCamiones([createNewCamionItem(humedadDefault), createNewCamionItem(humedadDefault)]);
    setTimeout(() => setSuccessMsg(''), 6000);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Alertas */}
      {siloContaminadoError && (
        <div className="p-4 bg-red-50 border-2 border-red-500 text-red-900 rounded-2xl shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-red-600 text-white rounded-xl shrink-0 mt-0.5 shadow-sm">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-red-900 flex items-center gap-1.5 uppercase tracking-wide">
                <span>⚠️ Silo Contaminado</span>
              </h4>
              <p className="text-xs text-red-800 mt-1 whitespace-pre-line leading-relaxed font-medium">
                {siloContaminadoError}
              </p>
            </div>
          </div>
          {onLimpiezaDescarte && (
            <button
              type="button"
              onClick={onLimpiezaDescarte}
              className="px-4 py-2.5 bg-red-700 hover:bg-red-800 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition flex items-center gap-2 shrink-0 cursor-pointer active:scale-95 border border-red-900"
              title="Vaciar silo a 0 kg y borrar datos de partida vinculada"
            >
              <Trash2 className="w-4 h-4 text-amber-300" />
              <span>Limpieza / Descarte</span>
            </button>
          )}
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 1. CABECERA COMÚN DE LA PARTIDA */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-emerald-700" />
            1. Datos Generales de la Partida (Común a todos los camiones)
          </span>
          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
            Destino: <strong className="text-emerald-800 font-serif">{activeSilo}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Fecha */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              Fecha de Ingreso *
            </label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          {/* Cliente */}
          <ClienteSelect
            value={cliente}
            onChange={setCliente}
            label="Cliente / Productor *"
            selectClassName="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 text-xs"
            inputClassName="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium text-slate-900 text-xs mt-1"
          />

          {/* Especie */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1 flex items-center gap-1">
              <Wheat className="w-3.5 h-3.5 text-emerald-600" />
              Especie / Cultivo *
            </label>
            <select
              value={especie}
              onChange={(e) => setEspecie(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500"
            >
              {especies.map((esp) => (
                <option key={esp} value={esp}>{esp}</option>
              ))}
            </select>
          </div>

          {/* Variedad */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-emerald-600" />
              Variedad *
            </label>
            <input
              type="text"
              placeholder="ej: P46A03, CASUARINA..."
              value={variedad}
              onChange={(e) => setVariedad(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium text-slate-900 uppercase"
              required
            />
          </div>

          {/* Categoría */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
              Categoría *
            </label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500"
            >
              {CATEGORIAS_OFICIALES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Campo de Origen */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              Campo de Origen
            </label>
            <select
              value={campoOrigenSelect}
              onChange={(e) => setCampoOrigenSelect(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500"
            >
              <option value="La Barrancosa">La Barrancosa</option>
              <option value="La Barrancosa - Lote 1">La Barrancosa - Lote 1</option>
              <option value="La Barrancosa - Lote 2">La Barrancosa - Lote 2</option>
              <option value="La Barrancosa - Lote 3">La Barrancosa - Lote 3</option>
              <option value="La Barrancosa - Lote 4">La Barrancosa - Lote 4</option>
              <option value="OTRO_CAMPO">+ Otro Campo...</option>
            </select>
            {campoOrigenSelect === 'OTRO_CAMPO' && (
              <input
                type="text"
                placeholder="Nombre del campo o establecimiento"
                value={campoOrigenManual}
                onChange={(e) => setCampoOrigenManual(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium text-slate-900 mt-1"
                required
              />
            )}
          </div>

          {/* Bolsón Origen (Informativo) */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1 flex items-center gap-1">
              <Package className="w-3.5 h-3.5 text-emerald-600" />
              Bolsón Origen <span className="text-gray-400 font-normal lowercase">(opcional)</span>
            </label>
            <BolsonSearchSelector
              bolsones={bolsones}
              selectedBolsonId={bolsonOrigenId}
              selectedBolsonNro={bolsonOrigenNro}
              onSelectBolson={(b) => {
                if (b) {
                  setBolsonOrigenId(b.id);
                  setBolsonOrigenNro(b.numeroBolson);
                  if (b.zona && b.zona !== '-') setBolsonOrigenSector(b.zona);
                } else {
                  setBolsonOrigenId('');
                  setBolsonOrigenNro('');
                }
              }}
              label=""
              placeholder="Buscar bolsón..."
            />
          </div>

          {/* Sector del Bolsón de Origen */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              Sector del Bolsón de Origen *
            </label>
            <select
              value={bolsonOrigenSector}
              onChange={(e) => setBolsonOrigenSector(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500"
            >
              {SECTORES_BOLSON_OPCIONES.map((sec) => (
                <option key={sec} value={sec}>{sec}</option>
              ))}
            </select>
          </div>

          {/* % Humedad por Defecto */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
              % Humedad Inicial (Informativa)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                placeholder="ej: 13.5"
                value={humedadDefault}
                onChange={(e) => {
                  const val = e.target.value !== '' ? Number(e.target.value) : '';
                  setHumedadDefault(val);
                }}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900 pr-8"
              />
              <span className="absolute right-3 top-2 text-slate-400 font-bold">%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. LISTA DINÁMICA DE CAMIONES A INGRESAR */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-emerald-700" />
              2. Camiones a Ingresar ({camiones.length} {camiones.length === 1 ? 'camión' : 'camiones'})
            </span>
            <span className="text-[11px] text-slate-500 block">
              Ingrese los datos de transporte y pesaje de cada camión. Si ingresa Bruto y Tara, los Kilos Netos se calculan automáticamente.
            </span>
          </div>

          {/* Botones de acción rápida */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleAddRow(1)}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-700" />
              <span>+ 1 Camión</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddRow(3)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-slate-600" />
              <span>+ 3 Camiones</span>
            </button>
          </div>
        </div>

        {/* Filas de camiones (Responsive cards / compact inputs) */}
        <div className="space-y-3">
          {camiones.map((camion, idx) => {
            const netoVal =
              typeof camion.netoKg === 'number' && camion.netoKg > 0
                ? camion.netoKg
                : typeof camion.brutoKg === 'number' && typeof camion.taraKg === 'number' && camion.brutoKg > camion.taraKg
                ? camion.brutoKg - camion.taraKg
                : 0;

            return (
              <div
                key={camion.id}
                className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 hover:border-slate-300 transition space-y-3 relative"
              >
                {/* Header de fila */}
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-700 text-white font-mono font-bold text-xs flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <span className="font-bold text-xs text-slate-800">
                      Camión {idx + 1}
                    </span>

                    {/* Selector Desplegable de Flete / Transporte */}
                    <div className="flex items-center gap-1.5 ml-2">
                      <select
                        value={camion.modalidadTransporte || (camion.tipoTransporte === 'FLETE' ? (camion.fleteOpcion === 'Flete Montaner' ? 'TERCEROS_MONTANER' : 'PROPIO_AA') : 'TERCEROS_CHOFER')}
                        onChange={(e) => {
                          const mod = e.target.value as ModalidadTransporteType;
                          if (mod === 'TERCEROS_CHOFER') {
                            handleUpdateCamion(camion.id, {
                              modalidadTransporte: 'TERCEROS_CHOFER',
                              tipoTransporte: 'CHOFER',
                              choferNombre: '',
                              choferTransporte: '',
                              choferCuit: '',
                              choferPatentes: ''
                            });
                          } else if (mod === 'TERCEROS_MONTANER') {
                            handleUpdateCamion(camion.id, {
                              modalidadTransporte: 'TERCEROS_MONTANER',
                              tipoTransporte: 'FLETE',
                              fleteOpcion: 'Flete Montaner',
                              choferNombre: 'Flete Montaner',
                              choferTransporte: 'Flete Montaner',
                              choferCuit: '—',
                              choferPatentes: '—'
                            });
                          } else {
                            handleUpdateCamion(camion.id, {
                              modalidadTransporte: 'PROPIO_AA',
                              tipoTransporte: 'FLETE',
                              fleteOpcion: 'Flete AA',
                              choferNombre: 'Flete AA',
                              choferTransporte: 'Flete AA (Agro Abacus)',
                              choferCuit: '—',
                              choferPatentes: '—'
                            });
                          }
                        }}
                        className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                      >
                        <optgroup label="Flete Interno Terceros">
                          <option value="TERCEROS_CHOFER">Flete Terceros: Chofer Precargado</option>
                          <option value="TERCEROS_MONTANER">Flete Terceros: Flete Montaner</option>
                        </optgroup>
                        <optgroup label="Flete Interno Propio">
                          <option value="PROPIO_AA">Flete Propio: Flete AA</option>
                        </optgroup>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {netoVal > 0 && (
                      <span className="text-xs font-mono font-black text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                        {netoVal.toLocaleString('es-AR')} kg
                      </span>
                    )}

                    {camiones.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(camion.id)}
                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                        title="Eliminar este camión"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Campos de Transporte y Chofer */}
                {camion.tipoTransporte === 'CHOFER' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                    {/* Chofer Search Selector */}
                    <div>
                      <ChoferSearchSelector
                        choferes={choferes}
                        selectedChoferNombre={camion.choferNombre}
                        onSelectChofer={(ch) => {
                          handleUpdateCamion(camion.id, {
                            choferNombre: ch.nombre,
                            choferCuit: ch.cuit || '',
                            choferPatentes: ch.patentes || '',
                            choferTransporte: ch.transporte || '',
                            taraKg: ch.tara !== undefined ? ch.tara : camion.taraKg,
                          });
                        }}
                        onManualChange={(val) => handleUpdateCamion(camion.id, { choferNombre: val })}
                        onSaveNewChofer={(data) => {
                          if (data.nombre && onSaveChofer) {
                            onSaveChofer({
                              id: `CHOFER-${Date.now()}`,
                              nombre: data.nombre,
                              cuit: camion.choferCuit.trim() || '—',
                              patentes: camion.choferPatentes.trim() || '—',
                              transporte: camion.choferTransporte.trim() || 'Sin Transporte',
                              tara: typeof camion.taraKg === 'number' ? camion.taraKg : undefined
                            });
                          }
                        }}
                        label="Chofer / Conductor"
                      />
                    </div>

                    {/* CUIT */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1 flex items-center gap-1">
                        <CreditCard className="w-3 h-3 text-emerald-600" />
                        CUIT / DNI Chofer
                      </label>
                      <input
                        type="text"
                        placeholder="ej: 20-34567890-9"
                        value={camion.choferCuit}
                        onChange={(e) => handleUpdateCamion(camion.id, { choferCuit: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:ring-2 focus:ring-emerald-500 h-[34px]"
                      />
                    </div>

                    {/* Patente */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1 flex items-center gap-1">
                        <Truck className="w-3 h-3 text-emerald-600" />
                        Patente Camión / Acoplado
                      </label>
                      <input
                        type="text"
                        placeholder="ej: AE 123 CD"
                        value={camion.choferPatentes}
                        onChange={(e) => handleUpdateCamion(camion.id, { choferPatentes: e.target.value.toUpperCase() })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono uppercase text-slate-900 focus:ring-2 focus:ring-emerald-500 h-[34px]"
                      />
                    </div>

                    {/* Empresa Transporte */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1 flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-emerald-600" />
                        Empresa Transporte
                      </label>
                      <input
                        type="text"
                        placeholder="ej: Transportes Don Pedro"
                        value={camion.choferTransporte}
                        onChange={(e) => handleUpdateCamion(camion.id, { choferTransporte: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 h-[34px]"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-emerald-50/60 p-3 rounded-lg border border-emerald-200">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-emerald-950 mb-1">
                        Modalidad de Flete Activa
                      </label>
                      <div className="font-bold text-sm text-emerald-900 flex items-center gap-2">
                        <Truck className="w-4 h-4 text-emerald-700" />
                        <span>
                          {camion.modalidadTransporte === 'PROPIO_AA' ? 'Flete Interno Propio (Flete AA)' : 'Flete Interno Terceros (Flete Montaner)'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center text-[11px] text-emerald-800">
                      <span>Los kilos ingresados sumarán al stock del {activeSilo} sin alterar el peso por humedad agregada.</span>
                    </div>
                  </div>
                )}

                {/* Pesaje y Humedad */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2.5 text-xs pt-1 border-t border-slate-200/50">
                  {/* Tara (kg) */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-600 mb-0.5">
                      Tara (kg)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="ej: 14500"
                        value={camion.taraKg}
                        onChange={(e) =>
                          handleUpdateCamion(camion.id, {
                            taraKg: e.target.value !== '' ? Number(e.target.value) : '',
                          })
                        }
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-slate-900 pr-6 h-[34px]"
                      />
                      <span className="absolute right-2 top-2 text-[9px] font-bold text-slate-400">kg</span>
                    </div>
                  </div>

                  {/* Kilos Netos * */}
                  <div>
                    <label className="block text-[10px] font-black uppercase text-emerald-800 mb-0.5">
                      Kilos Netos * (Manual)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="ej: 30000"
                        value={camion.netoKg}
                        onChange={(e) =>
                          handleUpdateCamion(camion.id, {
                            netoKg: e.target.value !== '' ? Number(e.target.value) : '',
                          })
                        }
                        className="w-full px-2.5 py-1.5 bg-emerald-50/50 border border-emerald-400 rounded-lg font-mono font-black text-emerald-950 pr-6 h-[34px]"
                        required
                      />
                      <span className="absolute right-2 top-2 text-[9px] font-black text-emerald-700">kg</span>
                    </div>
                  </div>

                  {/* Bruto (kg) - Auto: Tara + Neto */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-600 mb-0.5">
                      Bruto (kg) <span className="text-emerald-700 text-[9px] lowercase font-normal">(auto)</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="ej: 44500"
                        value={camion.brutoKg}
                        onChange={(e) =>
                          handleUpdateCamion(camion.id, {
                            brutoKg: e.target.value !== '' ? Number(e.target.value) : '',
                          })
                        }
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono font-semibold text-slate-900 pr-6 h-[34px]"
                      />
                      <span className="absolute right-2 top-2 text-[9px] font-bold text-slate-400">kg</span>
                    </div>
                  </div>

                  {/* % Humedad */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-600 mb-0.5">
                      % Humedad
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        placeholder="13.5"
                        value={camion.humedad}
                        onChange={(e) =>
                          handleUpdateCamion(camion.id, {
                            humedad: e.target.value !== '' ? Number(e.target.value) : '',
                          })
                        }
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-semibold text-slate-900 pr-6 h-[34px]"
                      />
                      <span className="absolute right-2 top-2 text-[9px] font-bold text-slate-400">%</span>
                    </div>
                  </div>

                  {/* Observaciones / Carta de Porte */}
                  <div className="col-span-2 sm:col-span-4 lg:col-span-1">
                    <label className="block text-[10px] font-bold uppercase text-slate-600 mb-0.5">
                      Observaciones / C.P.
                    </label>
                    <input
                      type="text"
                      placeholder="Carta de porte, etc."
                      value={camion.observaciones}
                      onChange={(e) => handleUpdateCamion(camion.id, { observaciones: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 h-[34px]"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. RESUMEN DE CAPACIDAD Y BOTÓN DE CONFIRMACIÓN */}
      <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-lg space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-emerald-400" />
              Resumen de Carga Masiva para {activeSilo}
            </span>
            <div className="flex items-center gap-4 text-xs font-mono">
              <span>Camiones: <strong>{camiones.length}</strong></span>
              <span>Total a Ingresar: <strong className="text-emerald-300 text-sm">{totalKgCalculado.toLocaleString('es-AR')} kg</strong> ({(totalKgCalculado / 1000).toFixed(1)} Tn)</span>
            </div>
          </div>

          <div className="text-right space-y-0.5">
            <div className="text-xs text-slate-400">
              Espacio disponible: <strong className="text-slate-200">{espacioDisponible.toLocaleString('es-AR')} kg</strong>
            </div>
            <div className="text-xs">
              Stock proyectado: <strong className={superaCapacidad ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
                {stockResultante.toLocaleString('es-AR')} kg ({pctResultante.toFixed(1)}%)
              </strong>
            </div>
          </div>
        </div>

        {superaCapacidad && (
          <div className="p-2.5 bg-red-900/60 border border-red-500 text-red-200 rounded-xl text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>
              <strong>¡CAPACIDAD EXCEDIDA!</strong> La carga total supera el límite máximo de 180.000 kg por {(stockResultante - capacidadMaxSilo).toLocaleString('es-AR')} kg.
            </span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          <span className="text-[11px] text-slate-400">
            * Se registrará un movimiento individual de ingreso con su respectiva trazabilidad para cada camión en {activeSilo}.
          </span>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {(onDownloadPdf || onDownloadPng) && (
              <button
                type="button"
                onClick={onDownloadPdf || onDownloadPng}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs rounded-xl transition flex items-center gap-2 shadow-sm border border-slate-700 cursor-pointer active:scale-95"
                title="Descargar Ficha Técnica en PDF (A4)"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Descargar Ficha (PDF)</span>
              </button>
            )}

            <button
              type="submit"
              disabled={superaCapacidad || totalKgCalculado <= 0 || !!siloContaminadoError}
              className={`px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition flex items-center gap-2 shadow-md cursor-pointer ${
                superaCapacidad || totalKgCalculado <= 0 || !!siloContaminadoError
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-60'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95'
              }`}
            >
              {siloContaminadoError ? (
                <>
                  <Ban className="w-4 h-4 text-red-400" />
                  <span>Silo Contaminado - Carga Bloqueada</span>
                </>
              ) : (
                <>
                  <Truck className="w-4 h-4" />
                  <span>Registrar {camiones.length} {camiones.length === 1 ? 'Camión' : 'Camiones'} en {activeSilo}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};
