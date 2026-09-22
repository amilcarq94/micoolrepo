/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { LogoSiloLoose, LogoSiloSquare, HeaderBrand, SiloIcon } from './components/Logo';
import { Login } from './components/Login';
import { LotesView } from './components/LotesView';
import { LoteDetail } from './components/LoteDetail';
import { LoteForm } from './components/LoteForm';
import { ImportarStock } from './components/ImportarStock';
import { RegistrarSalida } from './components/RegistrarSalida';
import { SalidasList, SalidaUnifiedRow } from './components/SalidasList';
import { DashboardProduccion } from './components/DashboardProduccion';
import { DashboardOperaciones } from './components/DashboardOperaciones';
import { Lote, SalidaRegistrada, MovimientoStock, EstadoLoteType, AuditLogEntry, OrdenCarga, OrdenProceso, EstadoOrdenProceso, MovimientoSilo, TipoMovimientoSilo, SiloId, CAPACIDAD_MAX_SILO, Chofer, BolsonCampo, EstadoSiloManual, SilosEstadoMap, SILOS_ESTADO_DEFAULT, PlantaConfig, PLANTA_CONFIG_DEFAULT } from './types';
import { getLoteAuditoria } from './utils/audit';
import { LOTES_INICIALES, SALIDAS_INICIALES, CLIENTES_PRECARGADOS, ESPECIES_PRECARGADAS, ORDENES_CARGA_INICIALES, ORDENES_PROCESO_INICIALES, MOVIMIENTOS_SILO_INICIALES, CHOFERES_INICIALES, BOLSONES_INICIALES } from './data/mockData';
import { Layers, ArrowDownRight, History, Upload, LogOut, LogIn, CheckCircle, QrCode, ClipboardCheck, Factory, ClipboardList, Warehouse, AlertTriangle, Truck, Database, PackagePlus, BarChart3, Smartphone, Menu, X, ChevronLeft, ChevronRight, Building2, Calculator, Flame, Activity } from 'lucide-react';
import { GenerarLoteView } from './components/GenerarLoteView';
import { CalculoBolsasDashboard } from './components/CalculoBolsasDashboard';
import { MapaCalorDashboard } from './components/MapaCalorDashboard';
import { CalculoTransferConfig } from './utils/calculoBolsas';
import { QrCodeScanner } from './components/QrCodeScanner';
import { DespachosSection } from './components/DespachosSection';
import { ChoferesView } from './components/ChoferesView';
import { DataBasesView } from './components/DataBasesView';
import { ModoPlantaMobileView } from './components/ModoPlantaMobileView';
import { IngresoSilosView } from './components/IngresoSilosView';
import { CampaniaSelector } from './components/CampaniaSelector';
import { getActiveCampaniaIdStored, setActiveCampaniaIdStored, getCampaniaIdFromDate } from './utils/campanias';
import { findExistingChofer, mergeChoferData } from './utils/choferes';
import { getLoteLimits } from './utils/loteLimits';
import { LoteLimitsConfig } from './types';
import { db, getLoteDocId, uploadBase64ToStorage, seedLotesIfEmpty, seedOrdenesProcesoIfEmpty, seedMovimientosSiloIfEmpty, seedChoferesIfEmpty, seedBolsonesIfEmpty, seedSilosEstadoIfEmpty, seedPlantaConfigIfEmpty, guardarPlantaConfigFirestore, guardarSiloEstadoFirestore, registrarMovimientoTransaccion, mapFirestoreToLote, mapLoteToFirestore, sanitizeForFirestore, mapMovimientoSiloToFirestore } from './lib/firebase';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, runTransaction, writeBatch, getDocs } from 'firebase/firestore';

export default function App() {
  // 1. Estado de Sesión
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = sessionStorage.getItem('agro_abacus_user');
    return saved ? JSON.parse(saved) : { nombre: 'Malcon Baez', rol: 'Jefe de Planta' };
  });

  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return sessionStorage.getItem('agro_abacus_logged') === 'true';
  });

  // Estado para controlar si el usuario ingresó a Planta Móvil desde la Carátula
  const [enteredPlantaMovil, setEnteredPlantaMovil] = useState(false);

  // Estado de Conexión en Tiempo Real a Firebase
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(true);

  // Estado del Escáner de QR
  const [showQrScanner, setShowQrScanner] = useState(false);

  // Estado del Panel Lateral de Navegación (Colapso / Minimizar y Mobile Drawer)
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('agro_abacus_sidebar_collapsed') === 'true';
    }
    return false;
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('agro_abacus_sidebar_collapsed', String(next));
      }
      return next;
    });
  };

  // 2. Estados Principales del Sistema (Durable Local Storage)
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [salidas, setSalidas] = useState<SalidaRegistrada[]>([]);
  const [ordenesCarga, setOrdenesCarga] = useState<OrdenCarga[]>([]);
  const [ordenesProceso, setOrdenesProceso] = useState<OrdenProceso[]>([]);
  const [movimientosSilo, setMovimientosSilo] = useState<MovimientoSilo[]>(() => {
    try {
      const saved = localStorage.getItem('agro_movimientos_silo_v2');
      if (saved) {
        const parsed = JSON.parse(saved) as MovimientoSilo[];
        // Garantizar que Silo 2 tenga como base el stock inicial (15.480 kg, Stine, Soja 50EE59) respetando ingresos y salidas manuales
        const hasSilo2 = parsed.some((m) => m.siloId === 'Silo 2');
        if (!hasSilo2) {
          const silo2Base: MovimientoSilo = {
            id: 'ING-SILO-102',
            siloId: 'Silo 2',
            fecha: '2026-07-05',
            tipo: 'INGRESO',
            kg: 15480,
            cliente: 'Stine',
            especie: 'Soja',
            variedad: '50EE59',
            categoria: 'Original',
            campoOrigen: 'La Barrancosa',
            bolsonOrigenNro: 'Bolsón 44C',
            bolsonOrigenSector: 'Sector B2',
            depositoOrigen: 'Depósito Norte',
            humedad: 12.8,
          };
          return [...parsed, silo2Base];
        }
        // Si existe ING-SILO-102 pero con datos desactualizados (Eco Rural / 18500), corregir solo ese movimiento sin alterar salidas u otros ingresos manuales
        return parsed.map((m) => {
          if (m.id === 'ING-SILO-102' && (m.cliente === 'Eco Rural' || m.kg === 18500)) {
            return {
              ...m,
              siloId: 'Silo 2',
              kg: 15480,
              cliente: 'Stine',
              especie: 'Soja',
              variedad: '50EE59',
              categoria: 'Original',
            };
          }
          return m;
        });
      }
    } catch (e) {
      console.error(e);
    }
    return MOVIMIENTOS_SILO_INICIALES;
  });
  const [choferes, setChoferes] = useState<Chofer[]>([]);
  const [bolsones, setBolsones] = useState<BolsonCampo[]>([]);
  const [silosEstadoManual, setSilosEstadoManual] = useState<SilosEstadoMap>(() => {
    try {
      const saved = localStorage.getItem('agro_abacus_silos_estado_manual');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return SILOS_ESTADO_DEFAULT;
  });
  const [loteLimits, setLoteLimits] = useState<LoteLimitsConfig>(() => getLoteLimits());
  const [plantaConfig, setPlantaConfig] = useState<PlantaConfig>(() => {
    try {
      const saved = localStorage.getItem('agroabacus_planta_config_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.categorias)) {
          parsed.categorias = parsed.categorias.filter((c: string) => typeof c === 'string' && !c.toLowerCase().includes('primera multiplicaci'));
        }
        return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return PLANTA_CONFIG_DEFAULT;
  });
  const [clientes, setClientes] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('agroabacus_planta_config_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.clientes)) return parsed.clientes;
      }
    } catch (e) {
      console.error(e);
    }
    return PLANTA_CONFIG_DEFAULT.clientes;
  });
  const [especies, setEspecies] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('agroabacus_planta_config_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.especies)) return parsed.especies;
      }
    } catch (e) {
      console.error(e);
    }
    return PLANTA_CONFIG_DEFAULT.especies;
  });
  const [stockThresholds, setStockThresholds] = useState<Record<string, number>>({});
  const [alertEmail, setAlertEmail] = useState('amilcarQ94@gmail.com');

  // 2.b Estado de Campaña Fijada / Activa
  const [activeCampaniaId, setActiveCampaniaId] = useState<string>(() => getActiveCampaniaIdStored());
  const [isExplicitlyPinned, setIsExplicitlyPinned] = useState<boolean>(() => {
    return !!localStorage.getItem('agro_abacus_active_campania');
  });

  const handleSelectCampania = (campaniaId: string) => {
    setActiveCampaniaId(campaniaId);
    setActiveCampaniaIdStored(campaniaId);
    setIsExplicitlyPinned(true);
  };

  const handlePinCampania = (campaniaId: string) => {
    setActiveCampaniaIdStored(campaniaId);
    setIsExplicitlyPinned(true);
  };

  // Recalculo en tiempo real de "hechos" para Órdenes de Proceso en función de los lotes vinculados o edición manual
  const ordenesProcesoConHechos = useMemo(() => {
    return ordenesProceso.map(ord => {
      const linkedLotes = lotes.filter(l => l.ordenProcesoId === ord.id);
      let sumHechos = ord.hechos;
      if ((ord.hechos === undefined || ord.hechos === 0) && linkedLotes.length > 0) {
        sumHechos = linkedLotes.reduce((acc, l) => acc + (l.stockBolsas || 0), 0);
      }

      return {
        ...ord,
        hechos: sumHechos ?? 0,
        // El estado únicamente se modifica manualmente; el objetivo es solo aproximado y no vinculante
        estado: ord.estado
      };
    });
  }, [ordenesProceso, lotes]);

  // Campañas disponibles acumuladas de todas las entidades
  const availableCampaniasIds = useMemo(() => {
    const set = new Set<string>();
    lotes.forEach(l => {
      const cId = l.campaniaId || getCampaniaIdFromDate(l.fechaIngreso);
      if (cId) set.add(cId);
    });
    salidas.forEach(s => {
      const cId = s.campaniaId || getCampaniaIdFromDate(s.fecha);
      if (cId) set.add(cId);
    });
    ordenesCarga.forEach(o => {
      const cId = o.campaniaId || getCampaniaIdFromDate(o.fecha);
      if (cId) set.add(cId);
    });
    ordenesProceso.forEach(op => {
      const cId = op.campaniaId || getCampaniaIdFromDate(op.fechaCreacion);
      if (cId) set.add(cId);
    });
    return Array.from(set);
  }, [lotes, salidas, ordenesCarga, ordenesProceso]);

  // Colecciones filtradas según la campaña activa/fijada
  const filteredLotesByCampania = useMemo(() => {
    if (activeCampaniaId === 'TODAS') return lotes;
    return lotes.filter(l => (l.campaniaId || getCampaniaIdFromDate(l.fechaIngreso)) === activeCampaniaId);
  }, [lotes, activeCampaniaId]);

  const filteredSalidasByCampania = useMemo(() => {
    if (activeCampaniaId === 'TODAS') return salidas;
    return salidas.filter(s => (s.campaniaId || getCampaniaIdFromDate(s.fecha)) === activeCampaniaId);
  }, [salidas, activeCampaniaId]);

  const filteredOrdenesByCampania = useMemo(() => {
    if (activeCampaniaId === 'TODAS') return ordenesCarga;
    return ordenesCarga.filter(o => (o.campaniaId || getCampaniaIdFromDate(o.fecha)) === activeCampaniaId);
  }, [ordenesCarga, activeCampaniaId]);

  const filteredOrdenesProcesoByCampania = useMemo(() => {
    if (activeCampaniaId === 'TODAS') return ordenesProcesoConHechos;
    return ordenesProcesoConHechos.filter(o => (o.campaniaId || getCampaniaIdFromDate(o.fechaCreacion)) === activeCampaniaId);
  }, [ordenesProcesoConHechos, activeCampaniaId]);

  // Cálculo en tiempo real de stock por Silo (Silo 1 a Silo 6)
  const siloStocks = useMemo(() => {
    const stocks: Record<SiloId, number> = {
      'Silo 1': 0,
      'Silo 2': 0,
      'Silo 3': 0,
      'Silo 4': 0,
      'Silo 5': 0,
      'Silo 6': 0,
    };

    (['Silo 1', 'Silo 2', 'Silo 3', 'Silo 4', 'Silo 5', 'Silo 6'] as SiloId[]).forEach((siloId) => {
      const movsAsc = (movimientosSilo || [])
        .filter((m) => m.siloId === siloId)
        .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '') || (a.id || '').localeCompare(b.id || ''));

      let lastZeroIndex = -1;
      for (let i = movsAsc.length - 1; i >= 0; i--) {
        if (movsAsc[i].tipo === 'AJUSTE_ZERO') {
          lastZeroIndex = i;
          break;
        }
      }

      const movsDesdeZero = lastZeroIndex >= 0 ? movsAsc.slice(lastZeroIndex + 1) : movsAsc;

      let stock = 0;
      movsDesdeZero.forEach((m) => {
        if (m.tipo === 'INGRESO') {
          stock += m.kg;
        } else if (m.tipo === 'EGRESO_OP' || (m.tipo as string).startsWith('EGRESO')) {
          stock = Math.max(0, stock - m.kg);
        }
      });

      stocks[siloId] = stock;
    });

    return stocks;
  }, [movimientosSilo]);

  // Silos que alcanzan o superan el 95% de su capacidad máxima (>= 171.000 kg)
  const silosConAlerta95 = useMemo(() => {
    const umbral95 = CAPACIDAD_MAX_SILO * 0.95; // 171.000 kg
    return Object.entries(siloStocks)
      .filter(([_, stock]) => (stock as number) >= umbral95)
      .map(([siloId]) => siloId);
  }, [siloStocks]);

  const tieneAlertaSilo95 = silosConAlerta95.length > 0;

  // Peso total acumulado almacenado en todos los silos (para tooltips y métricas rápidas)
  const totalSilosKgStored = useMemo(() => {
    return Object.values(siloStocks).reduce((acc: number, val) => acc + (Number(val) || 0), 0);
  }, [siloStocks]);

  // 3. Control de Vistas
  // 'modo-planta' | 'silos' | 'mapa-calor' | 'dashboard-operaciones' | 'generar-lote' | 'calculo-bolsas' | 'lotes' | 'produccion' | 'alta-lote' | 'importar' | 'registrar-salida' | 'salidas-registradas' | 'despachos' | 'choferes'
  const [activeView, setActiveView] = useState<'modo-planta' | 'silos' | 'mapa-calor' | 'dashboard-operaciones' | 'generar-lote' | 'calculo-bolsas' | 'lotes' | 'produccion' | 'alta-lote' | 'importar' | 'registrar-salida' | 'salidas-registradas' | 'despachos' | 'choferes'>('modo-planta');
  const [loteSeleccionado, setLoteSeleccionado] = useState<Lote | null>(null);
  const [loteDetailSourceView, setLoteDetailSourceView] = useState<'lotes' | 'produccion' | 'mapa-calor'>('lotes');
  const [loteAEditar, setLoteAEditar] = useState<Lote | null>(null);
  const [preselectedLoteId, setPreselectedLoteId] = useState<string | undefined>(undefined);
  const [publicLote, setPublicLote] = useState<Lote | null>(null);
  const [precargaConfigFromCalculo, setPrecargaConfigFromCalculo] = useState<CalculoTransferConfig | null>(null);
  const [despachosInitialSubView, setDespachosInitialSubView] = useState<'generar' | 'mis-ordenes' | 'listado'>('generar');

  // Notificaciones temporales de éxito
  const [notificacion, setNotificacion] = useState('');
  const [isLotesSpinning, setIsLotesSpinning] = useState(false);
  const [lotesRipples, setLotesRipples] = useState<{ x: number; y: number; id: number }[]>([]);

  const handleLotesClick = (event?: React.MouseEvent<HTMLButtonElement>) => {
    navigateTo('lotes');
    setIsLotesSpinning(true);
    setTimeout(() => setIsLotesSpinning(false), 800);

    if (event && event.currentTarget) {
      const button = event.currentTarget;
      const rect = button.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const id = Date.now();
      setLotesRipples((prev) => [...prev, { x, y, id }]);
      setTimeout(() => {
        setLotesRipples((prev) => prev.filter((ripple) => ripple.id !== id));
      }, 600);
    }
  };

  // Calcular cantidad de lotes críticos (con stock por debajo del umbral de alerta)
  const criticalLotesCount = lotes.filter((l) => {
    const threshold = stockThresholds[l.especie] !== undefined ? stockThresholds[l.especie] : 5000;
    return l.stockKg > 0 && l.stockKg <= threshold;
  }).length;

  // 4. Efecto de Inicialización de Firebase (Firestore + Storage)
  useEffect(() => {
    // 1. Ejecutar seeding inicial de 112 lotes si está vacío en Firestore
    seedLotesIfEmpty(LOTES_INICIALES);

    // 2. Suscribirse en tiempo real a 'lotes'
    const unsubLotes = onSnapshot(collection(db, 'lotes'), (snapshot) => {
      setIsFirebaseConnected(true);
      const loadedLotes = snapshot.docs.map(doc => mapFirestoreToLote(doc.id, doc.data()));
      setLotes(loadedLotes);

      // Sincronizar loteSeleccionado si está abierto para mantenerlo actualizado
      setLoteSeleccionado(prev => {
        if (!prev) return null;
        const updated = loadedLotes.find(l => l.id === prev.id);
        if (updated) {
          return {
            ...updated,
            historial: prev.historial // Preservar historial cargado perezosamente (lazy load)
          };
        }
        return prev;
      });

      // Sincronizar catálogo local de clientes y especies en base a lo que hay en BD
      const clientSet = new Set<string>();
      const especieSet = new Set<string>();
      loadedLotes.forEach(l => {
        if (l.cliente) clientSet.add(l.cliente);
        if (l.especie) especieSet.add(l.especie);
      });
      // Asegurar que los precargados sigan estando
      CLIENTES_PRECARGADOS.forEach(c => clientSet.add(c));
      ESPECIES_PRECARGADAS.forEach(e => especieSet.add(e));

      setClientes(Array.from(clientSet));
      setEspecies(Array.from(especieSet));
    }, (error) => {
      console.error("Error subscribing to 'lotes':", error);
      setIsFirebaseConnected(false);
    });

    // 3. Suscribirse en tiempo real a 'salidas'
    const unsubSalidas = onSnapshot(collection(db, 'salidas'), (snapshot) => {
      setIsFirebaseConnected(true);
      const loadedSalidas = snapshot.docs.map(doc => doc.data() as SalidaRegistrada);
      setSalidas(loadedSalidas);
    }, (error) => {
      console.error("Error subscribing to 'salidas':", error);
      setIsFirebaseConnected(false);
    });

    // 4. Suscribirse en tiempo real a 'ordenesCarga'
    const unsubOrdenes = onSnapshot(collection(db, 'ordenesCarga'), (snapshot) => {
      setIsFirebaseConnected(true);
      const loadedOrdenes = snapshot.docs.map(doc => doc.data() as OrdenCarga);
      setOrdenesCarga(loadedOrdenes);
    }, (error) => {
      console.error("Error subscribing to 'ordenesCarga':", error);
      setIsFirebaseConnected(false);
    });

    // 5. Suscribirse en tiempo real a 'ordenes_proceso'
    seedOrdenesProcesoIfEmpty(ORDENES_PROCESO_INICIALES);
    const unsubOrdenesProceso = onSnapshot(collection(db, 'ordenes_proceso'), (snapshot) => {
      setIsFirebaseConnected(true);
      const loadedOrdenesProceso = snapshot.docs.map(doc => doc.data() as OrdenProceso);
      setOrdenesProceso(loadedOrdenesProceso);
    }, (error) => {
      console.error("Error subscribing to 'ordenes_proceso':", error);
      setIsFirebaseConnected(false);
    });

    // 6. Suscribirse en tiempo real a 'movimientos_silo'
    seedMovimientosSiloIfEmpty(MOVIMIENTOS_SILO_INICIALES);
    const unsubMovimientosSilo = onSnapshot(collection(db, 'movimientos_silo'), (snapshot) => {
      setIsFirebaseConnected(true);
      let loadedMovs = snapshot.docs.map(doc => doc.data() as MovimientoSilo);

      // Sincronización y calibración para Silo 2: asegurar base inicial (15.480 kg, Stine, Soja 50EE59) permitiendo todos los ingresos y salidas manuales
      const movsSilo2 = loadedMovs.filter(m => m.siloId === 'Silo 2');
      if (movsSilo2.length === 0) {
        const nuevoMovSilo2: MovimientoSilo = {
          id: 'ING-SILO-102',
          siloId: 'Silo 2',
          fecha: '2026-07-05',
          tipo: 'INGRESO',
          kg: 15480,
          cliente: 'Stine',
          especie: 'Soja',
          variedad: '50EE59',
          categoria: 'Original',
          campoOrigen: 'La Barrancosa',
          bolsonOrigenNro: 'Bolsón 44C',
          bolsonOrigenSector: 'Sector B2',
          depositoOrigen: 'Depósito Norte',
          humedad: 12.8
        };
        const docRef = doc(db, 'movimientos_silo', nuevoMovSilo2.id);
        setDoc(docRef, sanitizeForFirestore(nuevoMovSilo2), { merge: true }).catch(err => console.warn('Error seed Silo 2 Firestore:', err));
        loadedMovs = [...loadedMovs, nuevoMovSilo2];
      } else {
        // Si existe ING-SILO-102 con datos desactualizados de mock (Eco Rural / 18500), corregir solo ese documento base sin tocar otros ingresos o salidas
        const targetMov = loadedMovs.find(m => m.id === 'ING-SILO-102');
        if (targetMov && (targetMov.cliente === 'Eco Rural' || targetMov.kg === 18500)) {
          const updatedMov: MovimientoSilo = {
            ...targetMov,
            siloId: 'Silo 2',
            kg: 15480,
            cliente: 'Stine',
            especie: 'Soja',
            variedad: '50EE59',
            categoria: 'Original',
          };
          const docRef = doc(db, 'movimientos_silo', updatedMov.id);
          setDoc(docRef, sanitizeForFirestore(updatedMov), { merge: true }).catch(err => console.warn('Error sync Silo 2 Firestore:', err));
          loadedMovs = loadedMovs.map(m => m.id === updatedMov.id ? updatedMov : m);
        }
      }

      setMovimientosSilo(loadedMovs);
    }, (error) => {
      console.error("Error subscribing to 'movimientos_silo':", error);
      setIsFirebaseConnected(false);
    });

    // 7. Suscribirse en tiempo real a 'choferes'
    seedChoferesIfEmpty(CHOFERES_INICIALES);
    const unsubChoferes = onSnapshot(collection(db, 'choferes'), (snapshot) => {
      setIsFirebaseConnected(true);
      const loadedChoferes = snapshot.docs.map(doc => doc.data() as Chofer);
      setChoferes(loadedChoferes);
    }, (error) => {
      console.error("Error subscribing to 'choferes':", error);
      setIsFirebaseConnected(false);
    });

    // 8. Suscribirse en tiempo real a 'bolsones_campo'
    seedBolsonesIfEmpty(BOLSONES_INICIALES);
    const unsubBolsones = onSnapshot(collection(db, 'bolsones_campo'), (snapshot) => {
      setIsFirebaseConnected(true);
      const loadedBolsones = snapshot.docs.map(doc => doc.data() as BolsonCampo);
      setBolsones(loadedBolsones);
    }, (error) => {
      console.error("Error subscribing to 'bolsones_campo':", error);
      setIsFirebaseConnected(false);
    });

    // 9. Suscribirse en tiempo real a 'silos_estado' (Estados manuales: Ocupado, Vacío Sucio, Vacío Limpio)
    seedSilosEstadoIfEmpty(SILOS_ESTADO_DEFAULT);
    const unsubSilosEstado = onSnapshot(doc(db, 'silos_estado', 'estados'), (snapshot) => {
      setIsFirebaseConnected(true);
      if (snapshot.exists()) {
        const data = snapshot.data();
        const map = (data.estados || {}) as SilosEstadoMap;
        setSilosEstadoManual(prev => {
          const updated = { ...prev, ...map };
          try {
            localStorage.setItem('agro_abacus_silos_estado_manual', JSON.stringify(updated));
          } catch (e) {
            console.error(e);
          }
          return updated;
        });
      }
    }, (error) => {
      console.error("Error subscribing to 'silos_estado':", error);
    });

    // 10. Suscribirse en tiempo real a 'configuracion_planta/catalogos' (Base de Datos de Planta)
    seedPlantaConfigIfEmpty(PLANTA_CONFIG_DEFAULT);
    const unsubPlantaConfig = onSnapshot(doc(db, 'configuracion_planta', 'catalogos'), (snapshot) => {
      setIsFirebaseConnected(true);
      if (snapshot.exists()) {
        const data = snapshot.data();
        const rawCategorias = Array.isArray(data.categorias) ? data.categorias : PLANTA_CONFIG_DEFAULT.categorias;
        const cleanCategorias = rawCategorias.filter((c: string) => typeof c === 'string' && !c.toLowerCase().includes('primera multiplicaci'));
        const loadedConfig: PlantaConfig = {
          clientes: Array.isArray(data.clientes) ? data.clientes : PLANTA_CONFIG_DEFAULT.clientes,
          especies: Array.isArray(data.especies) ? data.especies : PLANTA_CONFIG_DEFAULT.especies,
          variedades: Array.isArray(data.variedades) ? data.variedades : PLANTA_CONFIG_DEFAULT.variedades,
          tipos: Array.isArray(data.tipos) ? data.tipos : PLANTA_CONFIG_DEFAULT.tipos,
          categorias: cleanCategorias,
          tratamientos: Array.isArray(data.tratamientos) ? data.tratamientos : PLANTA_CONFIG_DEFAULT.tratamientos,
        };
        setPlantaConfig(loadedConfig);
        setClientes(loadedConfig.clientes);
        setEspecies(loadedConfig.especies);
        try {
          localStorage.setItem('agroabacus_planta_config_v1', JSON.stringify(loadedConfig));
        } catch (e) {
          console.error(e);
        }
      }
    }, (error) => {
      console.error("Error subscribing to 'configuracion_planta':", error);
    });

    // Listeners para el estado de internet del navegador
    const handleOnline = () => {
      setIsOnline(true);
      setIsFirebaseConnected(true);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setIsFirebaseConnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 5. Cargar umbrales de stock desde localStorage (configuraciones locales del usuario)
    const localThresholds = localStorage.getItem('agro_thresholds');
    if (localThresholds) {
      setStockThresholds(JSON.parse(localThresholds));
    } else {
      const defaultThresholds: Record<string, number> = {
        "Soja": 10000,
        "Trigo": 8000,
        "Arveja": 5000,
      };
      setStockThresholds(defaultThresholds);
      localStorage.setItem('agro_thresholds', JSON.stringify(defaultThresholds));
    }

    const localEmail = localStorage.getItem('agro_alert_email');
    if (localEmail) {
      setAlertEmail(localEmail);
    } else {
      setAlertEmail('amilcar.quiroz@agroabacus.com.ar');
      localStorage.setItem('agro_alert_email', 'amilcar.quiroz@agroabacus.com.ar');
    }

    return () => {
      unsubLotes();
      unsubSalidas();
      unsubOrdenes();
      unsubOrdenesProceso();
      unsubMovimientosSilo();
      unsubChoferes();
      unsubBolsones();
      unsubSilosEstado();
      unsubPlantaConfig();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Efecto para cargar en tiempo real el historial de movimientos de un lote seleccionado (Lazy Loading)
  useEffect(() => {
    if (!loteSeleccionado) return;

    const unsubMovs = onSnapshot(collection(db, 'lotes', loteSeleccionado.id, 'movimientos'), (snapshot) => {
      const movs = snapshot.docs.map(doc => doc.data() as MovimientoStock);
      // Ordenar por fecha decreciente (los más nuevos primero)
      const sortedMovs = movs.sort((a, b) => b.fecha.localeCompare(a.fecha));

      setLoteSeleccionado(prev => {
        if (prev && prev.id === loteSeleccionado.id) {
          return {
            ...prev,
            historial: sortedMovs
          };
        }
        return prev;
      });
    });

    return () => unsubMovs();
  }, [loteSeleccionado?.id]);

  // Mantener en sincronía loteSeleccionado si cambian los datos maestros del lote
  useEffect(() => {
    if (loteSeleccionado) {
      const found = lotes.find(l => l.id === loteSeleccionado.id);
      if (found) {
        setLoteSeleccionado(prev => {
          if (!prev) return null;
          return {
            ...found,
            historial: prev.historial || found.historial || []
          };
        });
      }
    }
  }, [lotes]);

  // 4.5. Deep-linking / Consulta de Lotes por QR
  useEffect(() => {
    if (lotes.length > 0) {
      const urlParams = new URLSearchParams(window.location.search);
      const loteId = urlParams.get('lote');
      if (loteId) {
        const found = lotes.find(l => l.id.toLowerCase() === loteId.toLowerCase());
        if (found) {
          if (isLoggedIn) {
            setLoteSeleccionado(found);
            setActiveView('lotes');
            // Limpiar parámetro de URL para navegación fluida
            window.history.replaceState({}, '', window.location.pathname);
          } else {
            setPublicLote(found);
          }
        }
      }
    }
  }, [lotes, isLoggedIn]);

  // 4.6. Atajos de Teclado Globales (Ctrl+N, Ctrl+S, Ctrl+I)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isLoggedIn) return;

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      if (!isCtrlOrCmd) return;

      const key = e.key.toLowerCase();

      if (key === 'n') {
        e.preventDefault();
        navigateTo('alta-lote');
        showNotification('Acceso rápido: Alta de Nuevo Lote (Ctrl+N)');
      } else if (key === 's') {
        e.preventDefault();
        navigateTo('registrar-salida');
        showNotification('Acceso rápido: Registrar Salida (Ctrl+S)');
      } else if (key === 'i') {
        e.preventDefault();
        navigateTo('importar');
        showNotification('Acceso rápido: Importar Stock (Ctrl+I)');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isLoggedIn]);

  // Guardar en LocalStorage cada vez que cambie el estado (Mantenido solo para compatibilidad de firma o caches, pero la base de verdad es Firestore)
  const saveLotesToStorage = (newLotes: Lote[]) => {
    setLotes(newLotes);
    localStorage.setItem('agro_lotes', JSON.stringify(newLotes));
  };

  const saveSalidasToStorage = (newSalidas: SalidaRegistrada[]) => {
    setSalidas(newSalidas);
    localStorage.setItem('agro_salidas', JSON.stringify(newSalidas));
  };

  const saveOrdenesToStorage = (newOrdenes: OrdenCarga[]) => {
    setOrdenesCarga(newOrdenes);
    localStorage.setItem('agro_ordenes_carga', JSON.stringify(newOrdenes));
  };

  const handleSaveOrden = async (nuevaOrden: OrdenCarga) => {
    try {
      const docRef = doc(db, 'ordenesCarga', nuevaOrden.id);
      await setDoc(docRef, sanitizeForFirestore(nuevaOrden), { merge: true });
      setOrdenesCarga(prev => {
        const exists = prev.some(o => o.id === nuevaOrden.id);
        const next = exists ? prev.map(o => o.id === nuevaOrden.id ? nuevaOrden : o) : [nuevaOrden, ...prev];
        try {
          localStorage.setItem('agro_ordenes_carga', JSON.stringify(next));
        } catch {
          // ignore storage quota errors
        }
        return next;
      });
      showNotification(`Orden creada: ${nuevaOrden.id}`);
    } catch (e) {
      console.error('Error al guardar orden en Firestore:', e);
      showNotification('Error crítico al persistir la orden de carga.');
    }
  };

  const handleUpdateOrdenStatus = async (
    ordenId: string,
    nuevoEstado: 'Disponible' | 'Aceptada' | 'Despachada',
    fotoRemito?: string,
    firmaChofer?: string
  ) => {
    try {
      // 1. Subir a Firebase Storage si son base64 (con compresión y fallback seguro a base64 ligero < 250 KB)
      let fotoUrl = fotoRemito;
      if (fotoRemito && fotoRemito.startsWith('data:')) {
        fotoUrl = await uploadBase64ToStorage(`ordenes/${ordenId}/foto_remito.png`, fotoRemito);
      }

      let firmaUrl = firmaChofer;
      if (firmaChofer && firmaChofer.startsWith('data:')) {
        firmaUrl = await uploadBase64ToStorage(`ordenes/${ordenId}/firma_chofer.png`, firmaChofer);
      }

      // 2. Actualizar estado local inmediatamente para que la UI responda al instante
      setOrdenesCarga(prev => {
        const next = prev.map(o => o.id === ordenId ? {
          ...o,
          estado: nuevoEstado,
          ...(fotoUrl !== undefined && { fotoRemito: fotoUrl }),
          ...(firmaUrl !== undefined && { firmaChofer: firmaUrl })
        } : o);
        try {
          localStorage.setItem('agro_ordenes_carga', JSON.stringify(next));
        } catch (err) {
          console.warn('Error guardando en localStorage:', err);
        }
        return next;
      });

      const docRef = doc(db, 'ordenesCarga', ordenId);
      await setDoc(docRef, {
        estado: nuevoEstado,
        ...(fotoUrl !== undefined && { fotoRemito: fotoUrl }),
        ...(firmaUrl !== undefined && { firmaChofer: firmaUrl })
      }, { merge: true });

      showNotification(`Orden ${ordenId} marcada como ${nuevoEstado}.`);
    } catch (e) {
      console.error('Error al actualizar orden en Firestore:', e);
      showNotification('Error al actualizar el estado de la orden.');
    }
  };

  const handleDespacharStock = async (
    loteId: string,
    bolsas: number,
    kg: number,
    ordenId: string
  ): Promise<boolean> => {
    // 1. Verificar si la orden tiene múltiples lotes de origen configurados
    const orden = ordenesCarga.find(o => o.id === ordenId);
    
    if (orden && orden.lotesOrigen && orden.lotesOrigen.length > 0) {
      // Flujo de múltiples lotes de origen
      // Validar stock de todos los lotes involucrados primero
      for (const item of orden.lotesOrigen) {
        const targetLote = lotes.find(l => l.id === item.loteId || l.loteNro === item.loteNro || l.id === item.loteNro);
        if (!targetLote) {
          console.error(`Lote con ID ${item.loteId} (N° ${item.loteNro}) no encontrado en el estado actual.`);
          return false;
        }
        if (item.cantidadBolsas > targetLote.stockBolsas) {
          console.error(`Stock insuficiente para el lote ${targetLote.loteNro}. Disponible: ${targetLote.stockBolsas}, Solicitado: ${item.cantidadBolsas}`);
          return false;
        }
      }

      try {
        const batch = writeBatch(db);
        const fechaHoy = new Date().toISOString().split('T')[0];
        const creadasSalidas: SalidaRegistrada[] = [];

        for (const item of orden.lotesOrigen) {
          const targetLote = lotes.find(l => l.id === item.loteId || l.loteNro === item.loteNro || l.id === item.loteNro)!;
          const nuevoMov: MovimientoStock = {
            id: `MOV-OC-${Date.now()}-${item.loteId}`,
            fecha: fechaHoy,
            tipo: 'Salida por despacho',
            cantidadBolsas: item.cantidadBolsas,
            kgPorBolsa: targetLote.kgPorBolsa,
            cantidadKg: item.kgTotales,
            detalle: `Despacho bajo Orden N° ${ordenId} (${item.cantidadBolsas} b. / ${item.kgTotales} kg)${orden.destino ? ` - Destino: ${orden.destino}` : ''}`,
            remitoCliente: orden.remitoCliente || '-',
            destino: orden.destino || '-',
            chofer: orden.chofer || '-',
            tipoSalida: 'despacho',
            ordenId: orden.id
          };

          // Registrar el movimiento en la subcolección del lote
          const movRef = doc(collection(db, 'lotes', targetLote.id, 'movimientos'), nuevoMov.id);
          batch.set(movRef, nuevoMov);

          // Calcular nuevos stocks del lote padre
          const nuevoStockBolsas = Math.max(0, targetLote.stockBolsas - item.cantidadBolsas);
          const nuevoStockKgTotal = nuevoStockBolsas * targetLote.kgPorBolsa;
          const nuevoEstado = nuevoStockBolsas === 0 ? 'Agotado' : targetLote.estado;

          // Registrar evento de auditoría para el lote
          const auditEvent: AuditLogEntry = {
            id: `AUD-MOV-OC-${Date.now()}-${targetLote.id}`,
            fechaHora: new Date().toISOString(),
            tipo: 'Stock',
            usuario: currentUser?.nombre || 'Despachante de Planta',
            descripcion: `Despacho de stock registrado por Orden de Carga N° ${ordenId}: -${item.cantidadBolsas} b. (${item.kgTotales} kg).`,
            detalles: `Lote de origen: ${targetLote.loteNro} - Especie: ${targetLote.especie} - Variedad: ${targetLote.variedad}.`
          };

          const loteRef = doc(db, 'lotes', targetLote.id);
          batch.update(loteRef, {
            stockBolsas: nuevoStockBolsas,
            stockKgTotal: nuevoStockKgTotal,
            estado: nuevoEstado,
            auditoria: [auditEvent, ...(targetLote.auditoria || [])]
          });

          // CREAR DOCUMENTO EN SALIDAS VINCULANDO DATOS DEL LOTE DE ORIGEN (ESPECIE Y VARIEDAD)
          const choferMatch = choferes.find(c => c.nombre && orden?.chofer && c.nombre.trim().toLowerCase() === orden.chofer.trim().toLowerCase());
          const tratamientoStr = Array.isArray(targetLote.tratamiento) && targetLote.tratamiento.length > 0
            ? targetLote.tratamiento.join(', ')
            : (orden?.tratamiento || (typeof targetLote.tratamiento === 'string' ? targetLote.tratamiento : 'Sin tratamiento'));
          const envaseStr = targetLote.envase || `Bolsa ${targetLote.kgPorBolsa} kg`;
          const nuevaSalidaId = `SAL-${ordenId ? ordenId : Date.now()}-${targetLote.loteNro || targetLote.id}`.replace(/\s+/g, '_');

          const salidaEspecie = targetLote.especie || item.especie || orden?.especie || '—';
          const salidaVariedad = targetLote.variedad || item.variedad || orden?.variedad || '—';

          const salidaDoc: SalidaRegistrada = {
            id: nuevaSalidaId,
            fecha: fechaHoy,
            campaniaId: targetLote.campaniaId || orden?.campaniaId || currentCampaniaId,
            choferNombre: orden?.chofer || orden?.despachante || 'Chofer no especificado',
            choferDni: choferMatch?.cuit || '-',
            patenteCamion: choferMatch?.patentes || '-',
            cliente: targetLote.cliente || orden?.cliente || '—',
            especie: salidaEspecie,
            variedad: salidaVariedad,
            loteId: targetLote.loteNro || targetLote.id,
            tipoLote: (targetLote.tipo || orden?.tipo || 'Original') as TipoLoteType,
            producto: tratamientoStr !== 'Sin tratamiento' ? tratamientoStr : (salidaEspecie !== '—' ? salidaEspecie : 'Semilla'),
            categoria: (targetLote.categoria || orden?.categoria || '1ra') as CategoriaType,
            tratamiento: tratamientoStr,
            cantidadBolsas: item.cantidadBolsas,
            envase: envaseStr,
            kgPorBolsa: targetLote.kgPorBolsa,
            tamanoBolsa: `${targetLote.kgPorBolsa} kg`,
            totalKg: item.kgTotales,
            taraCamion: choferMatch?.tara || 0,
            brutoCamion: (choferMatch?.tara || 0) + item.kgTotales,
            remitoCliente: orden?.remitoCliente || '-',
            destino: orden?.destino || '-',
            ordenId: orden?.id || ordenId,
            remitoClienteAdjunto: orden?.fotoRemito ? { nombre: `Remito-${orden.remitoCliente || orden.id}.jpg`, data: orden.fotoRemito, type: 'image/jpeg' } : undefined,
            choferFirma: orden?.firmaChofer || undefined
          };

          const salidaRef = doc(db, 'salidas', nuevaSalidaId);
          batch.set(salidaRef, sanitizeForFirestore(salidaDoc));
          creadasSalidas.push(salidaDoc);
        }

        // Marcar la orden como con stock descontado y estado Despachada
        if (ordenId) {
          const ocRef = doc(db, 'ordenesCarga', ordenId);
          batch.update(ocRef, {
            stockDescontado: true,
            fechaBajaStock: new Date().toISOString(),
            estado: 'Despachada'
          });
        }

        await batch.commit();

        if (creadasSalidas.length > 0) {
          setSalidas(prev => [...creadasSalidas, ...prev.filter(s => !creadasSalidas.some(cs => cs.id === s.id))]);
        }

        if (ordenId) {
          setOrdenesCarga(prev => prev.map(o => o.id === ordenId ? { ...o, stockDescontado: true, fechaBajaStock: new Date().toISOString(), estado: 'Despachada' } : o));
        }

        return true;
      } catch (error) {
        console.error('Error al registrar despacho de múltiples lotes en lote batch:', error);
        return false;
      }
    }

    // Flujo legacy para un único lote de origen
    const lote = lotes.find(l => l.id === loteId || l.loteNro === loteId);
    if (!lote) return false;

    if (bolsas > lote.stockBolsas) {
      return false; // stock insuficiente
    }

    const fechaHoy = new Date().toISOString().split('T')[0];
    const nuevoMov: MovimientoStock = {
      id: `MOV-OC-${Date.now()}`,
      fecha: fechaHoy,
      tipo: 'Salida por despacho',
      cantidadBolsas: bolsas,
      kgPorBolsa: lote.kgPorBolsa,
      cantidadKg: kg,
      detalle: `Despacho bajo Orden N° ${ordenId} (${bolsas} b. / ${kg} kg)${orden?.destino ? ` - Destino: ${orden.destino}` : ''}`,
      remitoCliente: orden?.remitoCliente || '-',
      destino: orden?.destino || '-',
      chofer: orden?.chofer || '-',
      tipoSalida: 'despacho',
      ordenId: orden?.id
    };

    try {
      await registrarMovimientoTransaccion(lote.id, nuevoMov);

      // CREAR DOCUMENTO EN SALIDAS VINCULANDO DATOS DEL LOTE DE ORIGEN (ESPECIE Y VARIEDAD)
      const choferMatch = choferes.find(c => c.nombre && orden?.chofer && c.nombre.trim().toLowerCase() === orden.chofer.trim().toLowerCase());
      const tratamientoStr = Array.isArray(lote.tratamiento) && lote.tratamiento.length > 0
        ? lote.tratamiento.join(', ')
        : (orden?.tratamiento || (typeof lote.tratamiento === 'string' ? lote.tratamiento : 'Sin tratamiento'));
      const envaseStr = lote.envase || `Bolsa ${lote.kgPorBolsa} kg`;
      const nuevaSalidaId = `SAL-${ordenId ? ordenId : Date.now()}-${lote.loteNro || lote.id}`.replace(/\s+/g, '_');

      const salidaEspecie = lote.especie || orden?.especie || '—';
      const salidaVariedad = lote.variedad || orden?.variedad || '—';

      const salidaDoc: SalidaRegistrada = {
        id: nuevaSalidaId,
        fecha: fechaHoy,
        campaniaId: lote.campaniaId || orden?.campaniaId || currentCampaniaId,
        choferNombre: orden?.chofer || orden?.despachante || 'Chofer no especificado',
        choferDni: choferMatch?.cuit || '-',
        patenteCamion: choferMatch?.patentes || '-',
        cliente: lote.cliente || orden?.cliente || '—',
        especie: salidaEspecie,
        variedad: salidaVariedad,
        loteId: lote.loteNro || lote.id,
        tipoLote: (lote.tipo || orden?.tipo || 'Original') as TipoLoteType,
        producto: tratamientoStr !== 'Sin tratamiento' ? tratamientoStr : (salidaEspecie !== '—' ? salidaEspecie : 'Semilla'),
        categoria: (lote.categoria || orden?.categoria || '1ra') as CategoriaType,
        tratamiento: tratamientoStr,
        cantidadBolsas: bolsas,
        envase: envaseStr,
        kgPorBolsa: lote.kgPorBolsa,
        tamanoBolsa: `${lote.kgPorBolsa} kg`,
        totalKg: kg,
        taraCamion: choferMatch?.tara || 0,
        brutoCamion: (choferMatch?.tara || 0) + kg,
        remitoCliente: orden?.remitoCliente || '-',
        destino: orden?.destino || '-',
        ordenId: orden?.id || ordenId,
        remitoClienteAdjunto: orden?.fotoRemito ? { nombre: `Remito-${orden.remitoCliente || orden.id}.jpg`, data: orden.fotoRemito, type: 'image/jpeg' } : undefined,
        choferFirma: orden?.firmaChofer || undefined
      };

      try {
        await setDoc(doc(db, 'salidas', nuevaSalidaId), sanitizeForFirestore(salidaDoc));
      } catch (eSal) {
        console.warn('Error guardando doc de salida en Firestore:', eSal);
      }
      setSalidas(prev => [salidaDoc, ...prev.filter(s => s.id !== nuevaSalidaId)]);

      if (ordenId) {
        try {
          const ocRef = doc(db, 'ordenesCarga', ordenId);
          await updateDoc(ocRef, {
            stockDescontado: true,
            fechaBajaStock: new Date().toISOString(),
            estado: 'Despachada'
          });
        } catch (eOc) {
          console.warn('Error al actualizar orden como stockDescontado:', eOc);
        }
        setOrdenesCarga(prev => prev.map(o => o.id === ordenId ? { ...o, stockDescontado: true, fechaBajaStock: new Date().toISOString(), estado: 'Despachada' } : o));
      }
      return true;
    } catch (e) {
      console.error('Error al registrar despacho en transacción:', e);
      return false;
    }
  };

  const handleDeleteOrden = async (ordenId: string) => {
    try {
      const orden = ordenesCarga.find(o => o.id === ordenId);
      // Si la orden tenía stock descontado, reintegrar stock a los lotes
      if (orden && orden.stockDescontado) {
        // Eliminar salidas registradas asociadas a esta orden
        const salidasAEliminar = salidas.filter(s => s.ordenId === ordenId || s.id.startsWith(`SAL-${ordenId}`));
        for (const sal of salidasAEliminar) {
          try {
            await deleteDoc(doc(db, 'salidas', sal.id));
          } catch (eDelSal) {
            console.warn('Error eliminando doc de salida asociado:', eDelSal);
          }
        }
        if (salidasAEliminar.length > 0) {
          setSalidas(prev => prev.filter(s => s.ordenId !== ordenId && !s.id.startsWith(`SAL-${ordenId}`)));
        }

        if (orden.lotesOrigen && orden.lotesOrigen.length > 0) {
          for (const item of orden.lotesOrigen) {
            const targetLote = lotes.find(l => l.id === item.loteId);
            if (targetLote) {
              const nuevoStockBolsas = targetLote.stockBolsas + item.cantidadBolsas;
              const nuevoStockKg = nuevoStockBolsas * targetLote.kgPorBolsa;
              const nuevoEstado = nuevoStockBolsas > 0 && targetLote.estado === 'Agotado' ? 'Disponible' : targetLote.estado;
              const auditEvent: AuditLogEntry = {
                id: `AUD-DEL-OC-${Date.now()}-${item.loteId}`,
                fechaHora: new Date().toISOString(),
                tipo: 'Stock',
                usuario: currentUser?.nombre || 'Administración de Planta',
                descripcion: `Reintegro de stock por eliminación de Orden ${ordenId}: +${item.cantidadBolsas} b. (${item.kgTotales} kg).`,
                detalles: `Lote: ${targetLote.loteNro}. Destino: ${orden.destino || '-'}.`
              };
              const loteRef = doc(db, 'lotes', item.loteId);
              await updateDoc(loteRef, {
                stockBolsas: nuevoStockBolsas,
                stockKgTotal: nuevoStockKg,
                estado: nuevoEstado,
                auditoria: [auditEvent, ...(targetLote.auditoria || [])]
              });
            }
          }
        } else if (orden.loteId) {
          const targetLote = lotes.find(l => l.id === orden.loteId);
          if (targetLote) {
            const nuevoStockBolsas = targetLote.stockBolsas + orden.cantidadBolsas;
            const nuevoStockKg = nuevoStockBolsas * targetLote.kgPorBolsa;
            const nuevoEstado = nuevoStockBolsas > 0 && targetLote.estado === 'Agotado' ? 'Disponible' : targetLote.estado;
            const auditEvent: AuditLogEntry = {
              id: `AUD-DEL-OC-${Date.now()}`,
              fechaHora: new Date().toISOString(),
              tipo: 'Stock',
              usuario: currentUser?.nombre || 'Administración de Planta',
              descripcion: `Reintegro de stock por eliminación de Orden ${ordenId}: +${orden.cantidadBolsas} b. (${orden.kgTotales} kg).`,
              detalles: `Lote: ${targetLote.loteNro}. Destino: ${orden.destino || '-'}.`
            };
            const loteRef = doc(db, 'lotes', orden.loteId);
            await updateDoc(loteRef, {
              stockBolsas: nuevoStockBolsas,
              stockKgTotal: nuevoStockKg,
              estado: nuevoEstado,
              auditoria: [auditEvent, ...(targetLote.auditoria || [])]
            });
          }
        }
      }

      const docRef = doc(db, 'ordenesCarga', ordenId);
      await deleteDoc(docRef);
      setOrdenesCarga(prev => prev.filter(o => o.id !== ordenId));
      showNotification(`Orden ${ordenId} eliminada correctamente.`);
    } catch (e) {
      console.error('Error al eliminar orden:', e);
      showNotification('Error al eliminar la orden de carga.');
    }
  };

  const handleDeleteMultipleOrdenes = async (ordenIds: string[]) => {
    try {
      if (!ordenIds || ordenIds.length === 0) return;
      for (const id of ordenIds) {
        await handleDeleteOrden(id);
      }
      if (ordenIds.length > 1) {
        showNotification(`Se eliminaron ${ordenIds.length} despachos correctamente.`);
      }
    } catch (e) {
      console.error('Error al eliminar órdenes múltiples:', e);
      showNotification('Error al eliminar los despachos seleccionados.');
    }
  };

  const executeDeleteSingleDespacho = async (row: SalidaUnifiedRow) => {
    let loteReintegrado = false;

    // 1. Si proviene de la colección 'salidas' o estado local de salidas
    if (row.rawSalida || salidas.some(s => s.id === row.id)) {
      const salidaId = row.rawSalida ? row.rawSalida.id : row.id;
      try {
        await deleteDoc(doc(db, 'salidas', salidaId));
      } catch (eDel) {
        console.warn('Error al borrar doc en Firestore salidas (posible mock):', eDel);
      }
      setSalidas(prev => prev.filter(s => s.id !== salidaId));

      // Reintegrar stock al lote
      if (row.loteId && row.cantidadBolsas > 0) {
        const targetLote = lotes.find(l => l.id === row.loteId);
        if (targetLote) {
          const nuevoStockBolsas = targetLote.stockBolsas + row.cantidadBolsas;
          const nuevoStockKg = nuevoStockBolsas * targetLote.kgPorBolsa;
          const nuevoEstado = nuevoStockBolsas > 0 && targetLote.estado === 'Agotado' ? 'Disponible' : targetLote.estado;
          const auditEvent: AuditLogEntry = {
            id: `AUD-DEL-SAL-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            fechaHora: new Date().toISOString(),
            tipo: 'Stock',
            usuario: currentUser?.nombre || 'Administración de Planta',
            descripcion: `Eliminación de Despacho (Remito ${row.remitoCliente || row.id}). Stock reintegrado: +${row.cantidadBolsas} b. (${row.totalKg} kg).`,
            detalles: `Reintegro por eliminación de comprobante de salida. Cliente: ${row.cliente}.`
          };

          const loteRef = doc(db, 'lotes', row.loteId);
          await updateDoc(loteRef, {
            stockBolsas: nuevoStockBolsas,
            stockKgTotal: nuevoStockKg,
            estado: nuevoEstado,
            auditoria: [auditEvent, ...(targetLote.auditoria || [])]
          });
          loteReintegrado = true;
        }
      }
    }

    // 2. Si proviene de 'ordenesCarga'
    if (row.rawOrden || ordenesCarga.some(o => o.id === row.id)) {
      const ordenId = row.rawOrden ? row.rawOrden.id : row.id;
      await handleDeleteOrden(ordenId);
      loteReintegrado = true;
    }

    // 3. Si proviene de movimiento de lote
    if (row.rawMovimiento && row.loteId) {
      try {
        const movRef = doc(db, 'lotes', row.loteId, 'movimientos', row.rawMovimiento.id);
        await deleteDoc(movRef);
      } catch (eMov) {
        console.warn('Error eliminando subcoleccion movimiento:', eMov);
      }
      if (!loteReintegrado && row.cantidadBolsas > 0) {
        const targetLote = lotes.find(l => l.id === row.loteId);
        if (targetLote) {
          const nuevoStockBolsas = targetLote.stockBolsas + row.cantidadBolsas;
          const nuevoStockKg = nuevoStockBolsas * targetLote.kgPorBolsa;
          const nuevoEstado = nuevoStockBolsas > 0 && targetLote.estado === 'Agotado' ? 'Disponible' : targetLote.estado;
          const auditEvent: AuditLogEntry = {
            id: `AUD-DEL-MOV-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            fechaHora: new Date().toISOString(),
            tipo: 'Stock',
            usuario: currentUser?.nombre || 'Administración de Planta',
            descripcion: `Eliminación de Despacho por movimiento ${row.rawMovimiento.id}. Stock reintegrado: +${row.cantidadBolsas} b. (${row.totalKg} kg).`,
            detalles: `Reintegro por baja de movimiento. Cliente: ${row.cliente}.`
          };

          const loteRef = doc(db, 'lotes', row.loteId);
          await updateDoc(loteRef, {
            stockBolsas: nuevoStockBolsas,
            stockKgTotal: nuevoStockKg,
            estado: nuevoEstado,
            auditoria: [auditEvent, ...(targetLote.auditoria || [])]
          });
        }
      }
    }
  };

  const handleDeleteDespacho = async (row: SalidaUnifiedRow) => {
    try {
      await executeDeleteSingleDespacho(row);
      showNotification(`Despacho ${row.remitoCliente ? `Remito ${row.remitoCliente}` : `N° ${row.id}`} eliminado correctamente.`);
    } catch (e) {
      console.error('Error al eliminar despacho:', e);
      showNotification('Error al eliminar el despacho.');
      throw e;
    }
  };

  const handleDeleteMultipleDespachos = async (rows: SalidaUnifiedRow[]) => {
    try {
      if (!rows || rows.length === 0) return;
      let totalBolsasReintegradas = 0;
      for (const row of rows) {
        await executeDeleteSingleDespacho(row);
        totalBolsasReintegradas += (row.cantidadBolsas || 0);
      }
      if (rows.length === 1) {
        const r = rows[0];
        showNotification(`Despacho ${r.remitoCliente ? `Remito ${r.remitoCliente}` : `N° ${r.id}`} eliminado correctamente.`);
      } else {
        showNotification(`Se eliminaron ${rows.length} despachos correctamente (${totalBolsasReintegradas.toLocaleString('es-AR')} bolsas reintegradas a sus lotes).`);
      }
    } catch (e) {
      console.error('Error al eliminar despachos múltiples:', e);
      showNotification('Error al eliminar los despachos seleccionados.');
      throw e;
    }
  };

  const handleSaveOrdenProceso = async (orden: OrdenProceso) => {
    try {
      const batch = writeBatch(db);
      const docRef = doc(db, 'ordenes_proceso', orden.id);
      batch.set(docRef, JSON.parse(JSON.stringify(orden)), { merge: true });

      // Actualizar estado local de ordenes
      setOrdenesProceso(prev => {
        const exists = prev.some(o => o.id === orden.id);
        return exists ? prev.map(o => o.id === orden.id ? orden : o) : [orden, ...prev];
      });

      // Si es una actualización, eliminar egresos anteriores de esta OP para re-calcular limpiamente
      const movsAnteriores = movimientosSilo.filter(m => m.ordenProcesoId === orden.id);
      movsAnteriores.forEach(mAnt => {
        batch.delete(doc(db, 'movimientos_silo', mAnt.id));
      });

      const nuevosEg: MovimientoSilo[] = [];
      const lotesActualizados: Lote[] = [];
      const todayStr = new Date().toISOString().split('T')[0];

      // Si la orden de proceso tiene silosOrigen especificados, registrar EGRESO_OP en movimientos_silo
      if (orden.silosOrigen && orden.silosOrigen.length > 0) {
        let idx = 0;
        for (const item of orden.silosOrigen) {
          const kgCant = Number(item.kgExtraidos || item.kg || 0);
          if (kgCant > 0) {
            idx++;
            const movId = `EGRESO-OP-${orden.numeroOrden}-${item.siloId.replace(/\s+/g, '')}-${Date.now()}-${idx}`;
            const movEgreso: MovimientoSilo = {
              id: movId,
              siloId: item.siloId,
              fecha: todayStr,
              tipo: 'EGRESO_OP',
              kg: kgCant,
              ordenProcesoId: orden.id,
              numeroOrdenProceso: orden.numeroOrden,
              cliente: orden.cliente,
              especie: orden.especie,
              variedad: orden.variedad,
              categoria: orden.categoria
            };
            const movDocRef = doc(db, 'movimientos_silo', movId);
            batch.set(movDocRef, mapMovimientoSiloToFirestore(movEgreso));
            nuevosEg.push(movEgreso);
          }
        }
      }

      // Si es una Orden de Movimiento y posee lotesOrigen, descontar stock de los lotes de origen
      if (orden.tipoOrden === 'MOVIMIENTO' && orden.lotesOrigen && orden.lotesOrigen.length > 0) {
        for (const item of orden.lotesOrigen) {
          const kgExtraidos = Number(item.kgExtraidos || item.kgTotales || 0);
          if (kgExtraidos > 0) {
            const origLote = lotes.find(l => l.id === item.loteId);
            if (origLote) {
              const nuevoStockKg = Math.max(0, origLote.stockKg - kgExtraidos);
              const kgPorBolsa = origLote.kgPorBolsa || 40;
              const nuevoStockBolsas = Math.max(0, Math.ceil(nuevoStockKg / kgPorBolsa));
              const nuevoEstado = nuevoStockKg <= 0 ? 'Agotado' : origLote.estado;

              const movLote: MovimientoStock = {
                id: `MOV-OM-${orden.numeroOrdenMovimiento || orden.numeroOrden}-${Date.now()}-${origLote.id}`,
                fecha: todayStr,
                tipo: 'Salida',
                cantidadBolsas: item.cantidadBolsas || Math.ceil(kgExtraidos / kgPorBolsa),
                kgPorBolsa: kgPorBolsa,
                cantidadKg: kgExtraidos,
                detalle: `Extracción por Orden de Movimiento N° ${orden.numeroOrdenMovimiento || orden.numeroOrden} (${orden.tipoMovimiento || 'Movimiento'})`
              };

              const updatedLoteObj: Lote = {
                ...origLote,
                stockKg: nuevoStockKg,
                stockBolsas: nuevoStockBolsas,
                estado: nuevoEstado,
                historial: [movLote, ...(origLote.historial || [])],
              };

              const loteDocRef = doc(db, 'lotes', origLote.id);
              batch.set(loteDocRef, JSON.parse(JSON.stringify(updatedLoteObj)), { merge: true });
              lotesActualizados.push(updatedLoteObj);
            }
          }
        }
      }

      await batch.commit();

      // Actualizar movimientos_silo en memoria local
      setMovimientosSilo(prev => [
        ...nuevosEg,
        ...prev.filter(m => m.ordenProcesoId !== orden.id)
      ]);

      // Actualizar lotes en memoria local si se modificaron lotes de origen
      if (lotesActualizados.length > 0) {
        setLotes(prevLotes =>
          prevLotes.map(l => {
            const match = lotesActualizados.find(u => u.id === l.id);
            return match || l;
          })
        );
      }

      showNotification(`Orden de Proceso N° ${orden.numeroOrden} guardada correctamente.`);
    } catch (err) {
      console.error("Error al guardar orden de proceso:", err);
      showNotification("Error al guardar Orden de Proceso");
    }
  };

  const handleDeleteOrdenProceso = async (id: string) => {
    try {
      setOrdenesProceso(prev => prev.filter(o => o.id !== id));
      await deleteDoc(doc(db, 'ordenes_proceso', id));

      const movsAEliminar = movimientosSilo.filter(m => m.ordenProcesoId === id);
      if (movsAEliminar.length > 0) {
        const batch = writeBatch(db);
        movsAEliminar.forEach(m => {
          batch.delete(doc(db, 'movimientos_silo', m.id));
        });
        await batch.commit();
        setMovimientosSilo(prev => prev.filter(m => m.ordenProcesoId !== id));
      }

      showNotification("Orden de Proceso eliminada.");
    } catch (err) {
      console.error("Error al eliminar orden de proceso:", err);
    }
  };

  const handleUpdateEstadoOrdenProceso = async (id: string, nuevoEstado: EstadoOrdenProceso) => {
    try {
      setOrdenesProceso(prev => prev.map(o => o.id === id ? { ...o, estado: nuevoEstado } : o));
      await updateDoc(doc(db, 'ordenes_proceso', id), { estado: nuevoEstado });
      showNotification(`Estado de Orden actualizado a ${nuevoEstado}`);
    } catch (err) {
      console.error("Error al actualizar estado de orden:", err);
    }
  };

  const handleSaveThresholds = (newThresholds: Record<string, number>, email: string) => {
    setStockThresholds(newThresholds);
    localStorage.setItem('agro_thresholds', JSON.stringify(newThresholds));
    setAlertEmail(email);
    localStorage.setItem('agro_alert_email', email);
    showNotification('Configuración de alertas y correo de contacto guardados.');
  };

  const checkAndTriggerEmailAlert = (lote: Lote, previousStockKg: number, currentStockKg: number) => {
    const threshold = stockThresholds[lote.especie] !== undefined ? stockThresholds[lote.especie] : 5000;
    
    // Si cruzó la barrera del umbral hacia abajo
    if (previousStockKg > threshold && currentStockKg <= threshold && currentStockKg > 0) {
      const nuevoEvento: AuditLogEntry = {
        id: `AUD-EMAIL-${Date.now()}`,
        fechaHora: new Date().toISOString(),
        tipo: 'Stock',
        usuario: 'Sistema de Alertas (Automático)',
        descripcion: `📧 Alerta automática por email enviada a ${alertEmail}`,
        detalles: `Asunto: ALERTA DE STOCK CRÍTICO - Lote ${lote.id} (${lote.especie})\n\nCuerpo del mensaje:\n--------------------------------------------------\nEstimado Operador,\n\nSe ha disparado una alerta automática para el lote ${lote.id}.\n\n- Producto: ${lote.especie} (${lote.variedad})\n- Cliente: ${lote.cliente}\n- Stock Actual: ${currentStockKg.toLocaleString('es-AR')} kg (${lote.stockBolsas} bolsas)\n- Umbral Mínimo: ${threshold.toLocaleString('es-AR')} kg\n\nEl stock de este lote se encuentra por debajo del umbral mínimo de seguridad configurado.\n--------------------------------------------------`
      };
      
      lote.auditoria = [nuevoEvento, ...getLoteAuditoria(lote)];
      
      // Mostrar notificación exitosa
      showNotification(`📧 Alerta de email enviada a ${alertEmail} por stock crítico del Lote ${lote.id}.`);
    }
  };

  // 5. Manejo del Login
  const handleLoginSuccess = (nombre: string, rol: string) => {
    setIsLoggedIn(true);
    setEnteredPlantaMovil(false);
    const user = { nombre, rol };
    setCurrentUser(user);
    sessionStorage.setItem('agro_abacus_logged', 'true');
    sessionStorage.setItem('agro_abacus_user', JSON.stringify(user));
    showNotification(`Bienvenido ${nombre} (${rol}). Sesión iniciada.`);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setEnteredPlantaMovil(false);
    sessionStorage.removeItem('agro_abacus_logged');
    sessionStorage.removeItem('agro_abacus_user');
    setCurrentUser({ nombre: '', rol: '' });
    setActiveView('modo-planta');
    showNotification('Sesión cerrada.');
  };

  // Función auxiliar para notificaciones
  const showNotification = (msg: string) => {
    setNotificacion(msg);
    setTimeout(() => {
      setNotificacion('');
    }, 4000);
  };

  // 6. Operaciones de Lotes (CRUD + updates)
  const handleSaveLote = async (loteGuardar: Lote) => {
    try {
      const isEdit = lotes.some(l => l.id.toLowerCase() === loteGuardar.id.toLowerCase());
      let docId = loteGuardar.id;
      
      if (!isEdit) {
        docId = getLoteDocId(loteGuardar.cliente, loteGuardar.loteNro);
        loteGuardar.id = docId;
        loteGuardar.auditoria = [
          {
            id: `AUD-CRE-${Date.now()}`,
            fechaHora: new Date().toISOString(),
            tipo: 'Creación',
            usuario: currentUser.nombre,
            descripcion: `Lote ${docId} registrado con éxito.`,
            detalles: `Carga inicial: ${loteGuardar.stockBolsas} bolsas de ${loteGuardar.especie} (${loteGuardar.variedad}).`
          }
        ];
      } else {
        // Comparar campos para auditar cambios en datos maestros
        const loteAnterior = lotes.find(l => l.id === loteGuardar.id);
        if (loteAnterior) {
          const currentAuditoria = [...getLoteAuditoria(loteAnterior)];
          const cambios: string[] = [];
          if (loteAnterior.cliente !== loteGuardar.cliente) cambios.push(`Cliente de "${loteAnterior.cliente}" a "${loteGuardar.cliente}"`);
          if (loteAnterior.especie !== loteGuardar.especie) cambios.push(`Especie de "${loteAnterior.especie}" a "${loteGuardar.especie}"`);
          if (loteAnterior.variedad !== loteGuardar.variedad) cambios.push(`Variedad de "${loteAnterior.variedad}" a "${loteGuardar.variedad}"`);
          if (loteAnterior.tipo !== loteGuardar.tipo) cambios.push(`Tipo de lote de "${loteAnterior.tipo}" a "${loteGuardar.tipo}"`);
          if (loteAnterior.producto !== loteGuardar.producto) cambios.push(`Producto químico de "${loteAnterior.producto}" a "${loteGuardar.producto}"`);
          if (loteAnterior.fechaIngreso !== loteGuardar.fechaIngreso) cambios.push(`Fecha de ingreso de "${loteAnterior.fechaIngreso}" a "${loteGuardar.fechaIngreso}"`);
          if (loteAnterior.kgPorBolsa !== loteGuardar.kgPorBolsa) cambios.push(`Peso por bolsa de ${loteAnterior.kgPorBolsa} kg a ${loteGuardar.kgPorBolsa} kg`);
          const tAnt = [...loteAnterior.tratamiento].sort().join(', ');
          const tNue = [...loteGuardar.tratamiento].sort().join(', ');
          if (tAnt !== tNue) cambios.push(`Tratamientos de [${tAnt}] a [${tNue}]`);

          if (cambios.length > 0) {
            const nuevoEvento: AuditLogEntry = {
              id: `AUD-EDIT-${Date.now()}`,
              fechaHora: new Date().toISOString(),
              tipo: 'Edición',
              usuario: currentUser.nombre,
              descripcion: `Modificación de datos maestros: ${cambios.join(', ')}.`
            };
            loteGuardar.auditoria = [nuevoEvento, ...currentAuditoria];
          } else {
            loteGuardar.auditoria = currentAuditoria;
          }
        }
      }

      // Persistir en Firestore
      const batch = writeBatch(db);
      const docRef = doc(db, 'lotes', docId);
      batch.set(docRef, mapLoteToFirestore(loteGuardar));

      // Persistir movimientos en subcolección para sincronización en tiempo real
      if (loteGuardar.historial && loteGuardar.historial.length > 0) {
        for (const mov of loteGuardar.historial) {
          const movRef = doc(collection(db, 'lotes', docId, 'movimientos'), mov.id);
          batch.set(movRef, mov);
        }
      }

      // Eliminar movimientos de silo anteriores generados por este lote (si existían)
      const movsAnterioresLote = movimientosSilo.filter(m => m.loteResultanteId === docId);
      for (const mAnt of movsAnterioresLote) {
        const delRef = doc(db, 'movimientos_silo', mAnt.id);
        batch.delete(delRef);
      }

      // Con opción ACTIVA "PRE-CARGA" no afectar salida de silo.
      // Activar salida de silo únicamente con botón "REALIZADO" activo.
      const esRealizado = loteGuardar.estadoRegistro !== 'PRE-CARGA';
      const nuevosMovsSiloLote: MovimientoSilo[] = [];

      if (esRealizado && loteGuardar.silosOrigen && loteGuardar.silosOrigen.length > 0) {
        const fechaIng = loteGuardar.fechaIngreso || new Date().toISOString().split('T')[0];
        let idx = 0;
        for (const item of loteGuardar.silosOrigen) {
          const kgCant = Number(item.kgExtraidos || item.kg || 0);
          if (kgCant > 0) {
            idx++;
            const movId = `EGRESO-LOTE-${docId}-${item.siloId.replace(/\s+/g, '')}-${Date.now()}-${idx}`;
            const movEgreso: MovimientoSilo = {
              id: movId,
              siloId: item.siloId,
              fecha: fechaIng,
              tipo: 'EGRESO_OP',
              kg: kgCant,
              loteResultanteId: docId,
              loteNro: loteGuardar.loteNro,
              cliente: loteGuardar.cliente,
              especie: loteGuardar.especie,
              variedad: loteGuardar.variedad,
              categoria: loteGuardar.categoria
            };
            const movDocRef = doc(db, 'movimientos_silo', movId);
            batch.set(movDocRef, mapMovimientoSiloToFirestore(movEgreso));
            nuevosMovsSiloLote.push(movEgreso);
          }
        }
      }

      await batch.commit();

      // Actualizar estado local
      setLotes(prev => {
        const exists = prev.some(l => l.id === docId);
        return exists ? prev.map(l => l.id === docId ? loteGuardar : l) : [loteGuardar, ...prev];
      });

      setLoteSeleccionado(prev => prev && prev.id === docId ? loteGuardar : prev);

      setMovimientosSilo(prev => {
        const sinAnteriores = prev.filter(m => m.loteResultanteId !== docId);
        return [...sinAnteriores, ...nuevosMovsSiloLote];
      });

      showNotification(`Lote ${docId} guardado correctamente.`);
      setLoteAEditar(null);
      if (!loteSeleccionado) {
        if (activeView === 'alta-lote' || activeView === 'generar-lote') {
          setActiveView('lotes');
        }
      }
    } catch (e) {
      console.error('Error al guardar lote en Firestore:', e);
      showNotification('Error al registrar el lote.');
    }
  };

  const handleBatchUpdateLotes = async (updatedLotes: Lote[]) => {
    try {
      const batch = writeBatch(db);
      const nuevosMovsSiloBatch: MovimientoSilo[] = [];
      const idsLotesProcesados: string[] = [];

      for (const loteGuardar of updatedLotes) {
        const docRef = doc(db, 'lotes', loteGuardar.id);
        batch.set(docRef, mapLoteToFirestore(loteGuardar));
        idsLotesProcesados.push(loteGuardar.id);

        if (loteGuardar.historial && loteGuardar.historial.length > 0) {
          for (const mov of loteGuardar.historial) {
            const movRef = doc(collection(db, 'lotes', loteGuardar.id, 'movimientos'), mov.id);
            batch.set(movRef, mov);
          }
        }

        const esRealizado = loteGuardar.estadoRegistro !== 'PRE-CARGA';

        // Eliminar movimientos de silo anteriores para este lote
        const movsAnterioresLote = movimientosSilo.filter(m => m.loteResultanteId === loteGuardar.id);
        for (const mAnt of movsAnterioresLote) {
          const delRef = doc(db, 'movimientos_silo', mAnt.id);
          batch.delete(delRef);
        }

        // Si es REALIZADO y especifica silosOrigen, generar EGRESO_OP para descontar stock del Silo
        if (esRealizado && loteGuardar.silosOrigen && loteGuardar.silosOrigen.length > 0) {
          const fechaIng = loteGuardar.fechaIngreso || new Date().toISOString().split('T')[0];
          let idx = 0;
          for (const item of loteGuardar.silosOrigen) {
            const kgCant = Number(item.kgExtraidos || item.kg || 0);
            if (kgCant > 0) {
              idx++;
              const movId = `EGRESO-LOTE-${loteGuardar.id}-${item.siloId.replace(/\s+/g, '')}-${Date.now()}-${idx}`;
              const movEgreso: MovimientoSilo = {
                id: movId,
                siloId: item.siloId,
                fecha: fechaIng,
                tipo: 'EGRESO_OP',
                kg: kgCant,
                loteResultanteId: loteGuardar.id,
                loteNro: loteGuardar.loteNro,
                cliente: loteGuardar.cliente,
                especie: loteGuardar.especie,
                variedad: loteGuardar.variedad,
                categoria: loteGuardar.categoria
              };
              const movDocRef = doc(db, 'movimientos_silo', movId);
              batch.set(movDocRef, mapMovimientoSiloToFirestore(movEgreso));
              nuevosMovsSiloBatch.push(movEgreso);
            }
          }
        }
      }

      await batch.commit();

      // Actualizar estado local
      setLotes(prev => prev.map(l => {
        const match = updatedLotes.find(u => u.id === l.id);
        return match ? match : l;
      }));

      setMovimientosSilo(prev => {
        const sinAnteriores = prev.filter(m => !idsLotesProcesados.includes(m.loteResultanteId || ''));
        return [...sinAnteriores, ...nuevosMovsSiloBatch];
      });

      showNotification(`¡${updatedLotes.length} lotes actualizados a REALIZADO con éxito!`);
    } catch (e) {
      console.error('Error al realizar edición masiva de lotes:', e);
      showNotification('Error al aplicar cambios masivos.');
    }
  };

  const handleUpdateLoteStock = async (
    loteId: string,
    nuevosMovimientos: MovimientoStock[],
    nuevoStockBolsas: number,
    nuevoStockKg: number,
    nuevoEstado: EstadoLoteType
  ) => {
    try {
      const ultimoMov = nuevosMovimientos[0];
      const loteAnterior = lotes.find(l => l.id === loteId);
      const previousStockKg = loteAnterior ? loteAnterior.stockKg : 0;
      
      const loteRef = doc(db, 'lotes', loteId);
      const movRef = doc(collection(db, 'lotes', loteId, 'movimientos'), ultimoMov.id);
      
      await runTransaction(db, async (transaction) => {
        const loteDoc = await transaction.get(loteRef);
        if (!loteDoc.exists()) throw new Error(`El lote ${loteId} no existe.`);
        
        const data = loteDoc.data();
        const currentAuditoria = data.auditoria || [];
        
        const nuevoEvento: AuditLogEntry = {
          id: `AUD-MOV-${Date.now()}`,
          fechaHora: new Date().toISOString(),
          tipo: 'Stock',
          usuario: currentUser.nombre,
          descripcion: `Ajuste manual de stock (${ultimoMov.tipo}): ${ultimoMov.cantidadBolsas} b. (${ultimoMov.cantidadKg} kg).`,
          detalles: ultimoMov.detalle
        };
        
        transaction.set(movRef, ultimoMov);
        const updateData: Record<string, any> = {
          stockBolsas: nuevoStockBolsas,
          stockKg: nuevoStockKg,
          stockKgTotal: nuevoStockKg,
          estado: nuevoEstado,
          historial: nuevosMovimientos,
          auditoria: [nuevoEvento, ...currentAuditoria]
        };
        if (data.estadoRegistro === 'PRE-CARGA' || ultimoMov.tipo === 'Alta') {
          updateData.estadoRegistro = 'REALIZADO';
        }
        transaction.update(loteRef, updateData);
      });

      // Actualizar estado local inmediatamente para refrescar la UI al instante
      setLotes((prev) =>
        prev.map((l) =>
          l.id === loteId
            ? {
                ...l,
                stockBolsas: nuevoStockBolsas,
                stockKg: nuevoStockKg,
                estado: nuevoEstado,
                historial: nuevosMovimientos,
              }
            : l
        )
      );

      setLoteSeleccionado((prev) =>
        prev && prev.id === loteId
          ? {
              ...prev,
              stockBolsas: nuevoStockBolsas,
              stockKg: nuevoStockKg,
              estado: nuevoEstado,
              historial: nuevosMovimientos,
            }
          : prev
      );

      // Email notification trigger if needed
      const updatedLoteObj = lotes.find(l => l.id === loteId);
      if (updatedLoteObj) {
        checkAndTriggerEmailAlert({ ...updatedLoteObj, stockKg: nuevoStockKg }, previousStockKg, nuevoStockKg);
      }

      showNotification('Stock recalculado y registrado en auditoría.');
    } catch (e) {
      console.error('Error al actualizar stock del lote:', e);
      showNotification('Error al actualizar el stock.');
    }
  };

  const handleDeleteLote = async (id: string) => {
    try {
      const docRef = doc(db, 'lotes', id);
      await deleteDoc(docRef);
      showNotification(`Lote ${id} eliminado del registro.`);
    } catch (e) {
      console.error(e);
      showNotification('Error al eliminar el lote.');
    }
  };

  const handleUpdateLoteLocation = async (loteId: string, ala: string, sector: string, ubicacionAcopio?: string) => {
    try {
      const loteRef = doc(db, 'lotes', loteId);
      const loteAnterior = lotes.find(l => l.id === loteId);
      const currentAuditoria = loteAnterior?.auditoria || [];

      const ubiFinal = ubicacionAcopio !== undefined
        ? ubicacionAcopio
        : (ala && sector ? `Ala ${ala} - Sector ${sector}` : (ala ? `Ala ${ala}` : ''));

      const auditEntry: AuditLogEntry = {
        id: `AUD-LOC-${Date.now()}`,
        fechaHora: new Date().toISOString(),
        tipo: 'Edición',
        usuario: currentUser?.nombre || 'Jefe de Planta',
        descripcion: `Ubicación actualizada: ${ubiFinal || `ALA ${ala} / SECTOR ${sector}`}.`,
        detalles: loteAnterior?.ubicacionAcopio || (loteAnterior?.ala ? `ALA ${loteAnterior.ala} / SECTOR ${loteAnterior.sector}` : '')
          ? `Ubicación anterior: ${loteAnterior?.ubicacionAcopio || `ALA ${loteAnterior?.ala} / SECTOR ${loteAnterior?.sector}`}.`
          : 'Ubicación asignada por primera vez.'
      };

      await updateDoc(loteRef, {
        ala: ala || '',
        sector: sector || '',
        ubicacionAcopio: ubiFinal,
        auditoria: [auditEntry, ...currentAuditoria]
      });

      setLoteSeleccionado(prev => {
        if (prev && prev.id === loteId) {
          return {
            ...prev,
            ala: ala || '',
            sector: sector || '',
            ubicacionAcopio: ubiFinal,
            auditoria: [auditEntry, ...currentAuditoria]
          };
        }
        return prev;
      });

      showNotification(`Ubicación de Lote ${loteId} registrada: ${ubiFinal || `ALA ${ala} / SECTOR ${sector}`}.`);
    } catch (e) {
      console.error('Error al actualizar ubicación del lote:', e);
      showNotification('Error al actualizar la ubicación en el servidor.');
    }
  };

  const handleUpdateLoteInase = async (loteId: string, inaseInicio: string, inaseFinal: string) => {
    try {
      const loteRef = doc(db, 'lotes', loteId);
      const loteAnterior = lotes.find(l => l.id === loteId);
      const currentAuditoria = loteAnterior?.auditoria || [];

      const auditEntry: AuditLogEntry = {
        id: `AUD-INASE-${Date.now()}`,
        fechaHora: new Date().toISOString(),
        tipo: 'Edición',
        usuario: currentUser?.nombre || 'Jefe de Planta',
        descripcion: `Código INASE actualizado: Inicio [${inaseInicio || '—'}] / Final [${inaseFinal || '—'}].`,
        detalles: `Modificación manual de numeración INASE.`
      };

      await updateDoc(loteRef, {
        inaseInicio: inaseInicio,
        inaseFinal: inaseFinal,
        auditoria: [auditEntry, ...currentAuditoria]
      });

      setLotes(prev => prev.map(l => l.id === loteId ? { ...l, inaseInicio, inaseFinal } : l));
      if (loteSeleccionado?.id === loteId) {
        setLoteSeleccionado(prev => prev ? { ...prev, inaseInicio, inaseFinal } : null);
      }

      showNotification(`Código INASE guardado para el lote.`);
    } catch (e) {
      console.error('Error al guardar Código INASE:', e);
      // Actualización optimista local
      setLotes(prev => prev.map(l => l.id === loteId ? { ...l, inaseInicio, inaseFinal } : l));
      if (loteSeleccionado?.id === loteId) {
        setLoteSeleccionado(prev => prev ? { ...prev, inaseInicio, inaseFinal } : null);
      }
      showNotification('Código INASE guardado localmente.');
    }
  };

  const handleUpdateLotePesoDeMil = async (loteId: string, nuevoPeso: number | undefined) => {
    try {
      const loteRef = doc(db, 'lotes', loteId);
      const loteAnterior = lotes.find(l => l.id === loteId);
      const currentAuditoria = loteAnterior?.auditoria || [];

      const auditEntry: AuditLogEntry = {
        id: `AUD-PMS-${Date.now()}`,
        fechaHora: new Date().toISOString(),
        tipo: 'Edición',
        usuario: currentUser?.nombre || 'Jefe de Planta',
        descripcion: `Peso de 1000 (PMS) actualizado a ${nuevoPeso !== undefined ? `${nuevoPeso} g` : 'sin especificar'}.`,
        detalles: `Modificación manual de peso de mil semillas.`
      };

      await updateDoc(loteRef, {
        pesoDeMil: nuevoPeso !== undefined ? nuevoPeso : null,
        auditoria: [auditEntry, ...currentAuditoria]
      });

      setLotes(prev => prev.map(l => l.id === loteId ? { ...l, pesoDeMil: nuevoPeso, auditoria: [auditEntry, ...currentAuditoria] } : l));
      if (loteSeleccionado?.id === loteId) {
        setLoteSeleccionado(prev => prev ? { ...prev, pesoDeMil: nuevoPeso, auditoria: [auditEntry, ...currentAuditoria] } : null);
      }

      showNotification(`Peso de mil (PMS) actualizado a ${nuevoPeso !== undefined ? `${nuevoPeso} g` : '—'}.`);
    } catch (e) {
      console.error('Error al guardar Peso de 1000:', e);
      // Actualización optimista local
      setLotes(prev => prev.map(l => l.id === loteId ? { ...l, pesoDeMil: nuevoPeso } : l));
      if (loteSeleccionado?.id === loteId) {
        setLoteSeleccionado(prev => prev ? { ...prev, pesoDeMil: nuevoPeso } : null);
      }
      showNotification('Peso de mil guardado localmente.');
    }
  };

  const handleDeleteMultipleLotes = async (ids: string[]) => {
    try {
      const batch = writeBatch(db);
      for (const id of ids) {
        const docRef = doc(db, 'lotes', id);
        batch.delete(docRef);
      }
      await batch.commit();
      showNotification(`${ids.length} lotes eliminados correctamente.`);
    } catch (e) {
      console.error('Error al eliminar múltiples lotes:', e);
      showNotification('Error al eliminar los lotes seleccionados.');
    }
  };

  const handleWipeStocks = async () => {
    try {
      const batch = writeBatch(db);

      for (const lote of lotes) {
        const docRef = doc(db, 'lotes', lote.id);
        batch.delete(docRef);
      }

      await batch.commit();
      showNotification('Todos los lotes y sus existencias de stock se han borrado con éxito del sistema.');
    } catch (e) {
      console.error('Error al vaciar y borrar los lotes:', e);
      showNotification('Error al borrar toda la información de los lotes.');
      throw e;
    }
  };

  // 6.b Operaciones de Ingreso a Silos y Cero
  const handleRegistrarIngresoSilo = async (movimiento: MovimientoSilo) => {
    try {
      const docRef = doc(db, 'movimientos_silo', movimiento.id);
      await setDoc(docRef, mapMovimientoSiloToFirestore(movimiento));

      // Si viene vinculado a uno o varios bolsones de campo, descontar el stock en Firestore
      if (movimiento.origenes && movimiento.origenes.length > 0) {
        const kgPorOrigen = Math.round(movimiento.kg / movimiento.origenes.length);
        for (const orig of movimiento.origenes) {
          if (!orig.bolsonOrigenNro) continue;
          const target = bolsones.find(
            b => b.numeroBolson.toLowerCase().trim() === orig.bolsonOrigenNro.toLowerCase().trim()
          );
          if (target) {
            const nuevasSalidas = (target.salidasKg || 0) + kgPorOrigen;
            const nuevoStock = Math.max(0, (target.entradasKg || 0) - nuevasSalidas);
            const bolsonRef = doc(db, 'bolsones_campo', target.id);
            await updateDoc(bolsonRef, {
              salidasKg: nuevasSalidas,
              stockKg: nuevoStock
            });
          }
        }
      } else {
        const targetBolson = (movimiento.bolsonOrigenId ? bolsones.find(b => b.id === movimiento.bolsonOrigenId) : null)
          || (movimiento.bolsonOrigenNro ? bolsones.find(b => b.numeroBolson.toLowerCase().trim() === movimiento.bolsonOrigenNro.toLowerCase().trim()) : null);

        if (targetBolson) {
          const nuevasSalidas = (targetBolson.salidasKg || 0) + movimiento.kg;
          const nuevoStock = Math.max(0, (targetBolson.entradasKg || 0) - nuevasSalidas);
          const bolsonRef = doc(db, 'bolsones_campo', targetBolson.id);
          await updateDoc(bolsonRef, {
            salidasKg: nuevasSalidas,
            stockKg: nuevoStock
          });
        }
      }

      showNotification(`Ingreso de ${movimiento.kg.toLocaleString('es-AR')} kg a ${movimiento.siloId} registrado correctamente.`);
    } catch (e) {
      console.error('Error al registrar ingreso a silo:', e);
      showNotification('Error al registrar el ingreso a silo.');
    }
  };

  const handleRegistrarIngresosMultipleSilo = async (movimientos: MovimientoSilo[]) => {
    try {
      const batch = writeBatch(db);
      let totalKg = 0;
      const siloTarget = movimientos[0]?.siloId || 'Silo';

      for (const mov of movimientos) {
        const docRef = doc(db, 'movimientos_silo', mov.id);
        batch.set(docRef, mapMovimientoSiloToFirestore(mov));
        totalKg += mov.kg;

        const targetBolson = (mov.bolsonOrigenId ? bolsones.find(b => b.id === mov.bolsonOrigenId) : null)
          || (mov.bolsonOrigenNro ? bolsones.find(b => b.numeroBolson.toLowerCase().trim() === mov.bolsonOrigenNro.toLowerCase().trim()) : null);

        if (targetBolson) {
          const nuevasSalidas = (targetBolson.salidasKg || 0) + mov.kg;
          const nuevoStock = Math.max(0, (targetBolson.entradasKg || 0) - nuevasSalidas);
          const bolsonRef = doc(db, 'bolsones_campo', targetBolson.id);
          batch.update(bolsonRef, {
            salidasKg: nuevasSalidas,
            stockKg: nuevoStock
          });
        }
      }

      await batch.commit();
      showNotification(`Carga múltiple exitosa: ${movimientos.length} camiones (${totalKg.toLocaleString('es-AR')} kg) ingresados a ${siloTarget}.`);
    } catch (e) {
      console.error('Error al registrar carga múltiple en silos:', e);
      showNotification('Error al registrar carga múltiple de camiones en silo.');
    }
  };

  const handleRegistrarSalidaManualSilo = async (movimiento: MovimientoSilo) => {
    try {
      const docRef = doc(db, 'movimientos_silo', movimiento.id);
      await setDoc(docRef, mapMovimientoSiloToFirestore(movimiento));
      showNotification(`Salida manual de ${movimiento.kg.toLocaleString('es-AR')} kg de ${movimiento.siloId} registrada correctamente.`);
    } catch (e) {
      console.error('Error al registrar salida manual de silo:', e);
      showNotification('Error al registrar la salida manual.');
    }
  };

  const handleSaveChofer = async (chofer: Chofer) => {
    try {
      const existing = findExistingChofer(chofer, choferes);
      const mergedChofer = mergeChoferData(existing, chofer);
      const docRef = doc(db, 'choferes', mergedChofer.id);
      await setDoc(docRef, sanitizeForFirestore(mergedChofer), { merge: true });
      showNotification(`Chofer ${mergedChofer.nombre} guardado correctamente.`);
    } catch (e) {
      console.error('Error al guardar chofer:', e);
      showNotification('Error al guardar chofer.');
    }
  };

  const handleImportChoferes = async (nuevosChoferes: Chofer[]) => {
    try {
      const batch = writeBatch(db);
      let count = 0;
      for (const ch of nuevosChoferes) {
        if (!ch.nombre || !ch.nombre.trim()) continue;
        const existing = findExistingChofer(ch, choferes);
        const mergedChofer = mergeChoferData(existing, ch);
        const docRef = doc(db, 'choferes', mergedChofer.id);
        batch.set(docRef, sanitizeForFirestore(mergedChofer), { merge: true });
        count++;
      }
      await batch.commit();
      showNotification(`${count} choferes procesados en la base de datos.`);
    } catch (e) {
      console.error('Error al importar choferes:', e);
      showNotification('Error al importar choferes.');
    }
  };

  const handleSavePlantaConfig = async (newConfig: PlantaConfig) => {
    setPlantaConfig(newConfig);
    if (newConfig.clientes) setClientes(newConfig.clientes);
    if (newConfig.especies) setEspecies(newConfig.especies);
    try {
      localStorage.setItem('agroabacus_planta_config_v1', JSON.stringify(newConfig));
    } catch (e) {
      console.error(e);
    }
    try {
      await guardarPlantaConfigFirestore(newConfig, currentUser.nombre);
      showNotification('Base de datos de Planta actualizada con éxito.');
    } catch (e) {
      console.error('Error al guardar configuración de planta en Firestore:', e);
      showNotification('Guardado localmente. Se sincronizará con la nube al reconectar.');
    }
  };

  const handlePonerSiloEnCero = async (siloId: SiloId, fecha: string, usuario: string, motivo: string, kgAnterior: number, hora?: string) => {
    try {
      const timestamp = new Date().toISOString();
      const now = new Date();
      const horaEfectiva = hora || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      // Si el motivo es "Limpieza Varietal" o "Descontaminación Varietal", usamos EGRESO_MANUAL con flag descontaminacionVarietal
      const esLimpiezaVarietal = motivo === 'Limpieza Varietal' || motivo === 'Descontaminación Varietal' || motivo === 'Descontaminación varietal';
      const tipoMovimiento: TipoMovimientoSilo = esLimpiezaVarietal ? 'EGRESO_MANUAL' : 'AJUSTE_ZERO';
      const id = `${esLimpiezaVarietal ? 'CLEAN' : 'ZERO'}-${siloId.replace(/\s+/g, '')}-${Date.now()}`;

      const movZero: MovimientoSilo = {
        id,
        siloId,
        fecha,
        hora: horaEfectiva,
        tipo: tipoMovimiento,
        kg: kgAnterior,
        usuario: usuario,
        timestamp,
        // Campos específicos según el tipo
        ...(esLimpiezaVarietal ? {
          motivoManual: 'Descontaminación varietal',
          descontaminacionVarietal: true,
          observaciones: motivo
        } : {
          motivoZero: motivo,
          motivoAjuste: motivo,
          usuarioZero: usuario,
          kgAntesAjuste: kgAnterior
        })
      };

      // 1. Registrar el movimiento en Firestore
      const docRef = doc(db, 'movimientos_silo', id);
      await setDoc(docRef, mapMovimientoSiloToFirestore(movZero));

      // 2. Si es Limpieza Varietal, actualizar el estado manual del silo a "VACIO_LIMPIO"
      if (esLimpiezaVarietal) {
        await handleUpdateSiloEstadoManual(siloId, 'VACIO_LIMPIO');
      }

      showNotification(`${siloId} puesto en 0 kg correctamente (${esLimpiezaVarietal ? 'Descontaminación Varietal' : 'Ajuste a Cero'}).`);
    } catch (e) {
      console.error('Error al poner silo en cero:', e);
      showNotification('Error al poner el silo en cero.');
    }
  };

  const handleEditarMovimientoSilo = async (movimiento: MovimientoSilo) => {
    try {
      const docRef = doc(db, 'movimientos_silo', movimiento.id);
      await setDoc(docRef, mapMovimientoSiloToFirestore(movimiento), { merge: true });
      setMovimientosSilo((prev) => {
        const next = prev.map((m) => m.id === movimiento.id ? movimiento : m);
        try {
          localStorage.setItem('agro_movimientos_silo_v2', JSON.stringify(next));
        } catch (err) {
          console.error('Error al persistir movimientos de silos en local:', err);
        }
        return next;
      });
      showNotification(`Movimiento de ${movimiento.siloId} (${movimiento.fecha}) actualizado correctamente.`);
    } catch (e) {
      console.error('Error al editar movimiento de silo:', e);
      setMovimientosSilo((prev) => {
        const next = prev.map((m) => m.id === movimiento.id ? movimiento : m);
        try {
          localStorage.setItem('agro_movimientos_silo_v2', JSON.stringify(next));
        } catch (err) {
          console.error('Error al persistir movimientos de silos en local:', err);
        }
        return next;
      });
      showNotification(`Movimiento de ${movimiento.siloId} actualizado.`);
    }
  };

  const handleEliminarMovimientoSilo = async (movimientoId: string, siloId: SiloId) => {
    try {
      const docRef = doc(db, 'movimientos_silo', movimientoId);
      await deleteDoc(docRef);
      setMovimientosSilo((prev) => prev.filter((m) => m.id !== movimientoId));
      showNotification(`Movimiento de ${siloId} eliminado correctamente.`);
    } catch (e) {
      console.error('Error al eliminar movimiento de silo:', e);
      setMovimientosSilo((prev) => prev.filter((m) => m.id !== movimientoId));
      showNotification(`Movimiento de ${siloId} eliminado.`);
    }
  };

  const handleReordenarMovimientosSilo = (nuevosMovimientos: MovimientoSilo[]) => {
    setMovimientosSilo(nuevosMovimientos);
    try {
      localStorage.setItem('agro_movimientos_silo_v2', JSON.stringify(nuevosMovimientos));
    } catch (e) {
      console.error('Error guardando reordenamiento de movimientos de silos', e);
    }
  };

  const handleUpdateSiloEstadoManual = async (siloId: SiloId, nuevoEstado: EstadoSiloManual) => {
    setSilosEstadoManual((prev) => {
      const next = { ...prev, [siloId]: nuevoEstado };
      try {
        localStorage.setItem('agro_abacus_silos_estado_manual', JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });

    try {
      await guardarSiloEstadoFirestore(siloId, nuevoEstado, currentUser?.nombre);
      const nombresEstados = {
        'OCUPADO': 'Ocupado (Amarillo)',
        'VACIO_SUCIO': 'Vacío Sucio (Rojo)',
        'VACIO_LIMPIO': 'Vacío Limpio (Verde)'
      };
      showNotification(`${siloId}: estado manual guardado en Firestore (${nombresEstados[nuevoEstado] || nuevoEstado})`);
    } catch (err) {
      console.error('Error al guardar estado de silo en Firestore:', err);
    }
  };

  // 7. Operación de Despacho (Salidas)
  const handleSaveSalida = async (
    nuevaSalida: SalidaRegistrada,
    loteId: string,
    nuevosMovimientos: MovimientoStock[],
    nuevoStockBolsas: number,
    nuevoStockKg: number,
    nuevoEstado: EstadoLoteType
  ) => {
    try {
      // 1. Subir firma del chofer a Storage si es base64
      if (nuevaSalida.choferFirma && nuevaSalida.choferFirma.startsWith('data:')) {
        nuevaSalida.choferFirma = await uploadBase64ToStorage(`salidas/${nuevaSalida.id}/firma_chofer.png`, nuevaSalida.choferFirma);
      }

      // 2. Subir remito adjunto si existe y es base64
      if (nuevaSalida.remitoClienteAdjunto && nuevaSalida.remitoClienteAdjunto.data.startsWith('data:')) {
        const fileUrl = await uploadBase64ToStorage(
          `salidas/${nuevaSalida.id}/adjunto_${nuevaSalida.remitoClienteAdjunto.nombre}`,
          nuevaSalida.remitoClienteAdjunto.data
        );
        nuevaSalida.remitoClienteAdjunto = {
          ...nuevaSalida.remitoClienteAdjunto,
          data: fileUrl
        };
      }

      // 3. Escribir salida en Firestore
      await setDoc(doc(db, 'salidas', nuevaSalida.id), sanitizeForFirestore(nuevaSalida));

      const loteAnterior = lotes.find(l => l.id === loteId);
      const previousStockKg = loteAnterior ? loteAnterior.stockKg : 0;

      // 4. Atomically record stock movement and update parent lote stock & auditoria
      const ultimoMov = nuevosMovimientos[0];
      const loteRef = doc(db, 'lotes', loteId);
      const movRef = doc(collection(db, 'lotes', loteId, 'movimientos'), ultimoMov.id);

      await runTransaction(db, async (transaction) => {
        const loteDoc = await transaction.get(loteRef);
        if (!loteDoc.exists()) throw new Error(`El lote ${loteId} no existe.`);
        
        const data = loteDoc.data();
        const currentAuditoria = data.auditoria || [];

        const nuevoEvento: AuditLogEntry = {
          id: `AUD-SAL-${Date.now()}`,
          fechaHora: new Date().toISOString(),
          tipo: 'Stock',
          usuario: currentUser.nombre,
          descripcion: `Despacho de stock registrado: -${ultimoMov.cantidadBolsas} b. (${ultimoMov.cantidadKg} kg).`,
          detalles: `Remito ${nuevaSalida.id}. Chofer: ${nuevaSalida.choferNombre} (DNI ${nuevaSalida.choferDni}), Patente: ${nuevaSalida.patenteCamion || 'N/A'}.`
        };

        transaction.set(movRef, ultimoMov);
        transaction.update(loteRef, {
          stockBolsas: nuevoStockBolsas,
          stockKgTotal: nuevoStockKg,
          estado: nuevoEstado,
          auditoria: [nuevoEvento, ...currentAuditoria]
        });
      });

      // Email alert if needed
      const updatedLoteObj = lotes.find(l => l.id === loteId);
      if (updatedLoteObj) {
        checkAndTriggerEmailAlert({ ...updatedLoteObj, stockKg: nuevoStockKg }, previousStockKg, nuevoStockKg);
      }

      showNotification(`Despacho REM-${nuevaSalida.id} aprobado y descontado.`);
    } catch (e) {
      console.error('Error al registrar despacho de salida:', e);
      showNotification('Error al registrar la salida de mercadería.');
    }
  };

  // 8. Operación de Importación Masiva por Excel
  const handleImportConfirm = async (nuevosLotes: Lote[], lotesActualizados: Lote[]) => {
    try {
      const batch = writeBatch(db);
      
      // Procesar nuevos lotes
      for (const lote of nuevosLotes) {
        const docId = getLoteDocId(lote.cliente, lote.loteNro);
        const docRef = doc(db, 'lotes', docId);

        const auditEntry: AuditLogEntry = {
          id: `AUD-CRE-${Date.now()}`,
          fechaHora: new Date().toISOString(),
          tipo: 'Creación',
          usuario: currentUser.nombre,
          descripcion: `Lote ${docId} registrado por importación Excel.`,
          detalles: `Stock inicial importado: ${lote.stockBolsas} bolsas.`
        };
        
        const loteToSave = {
          ...lote,
          id: docId,
          auditoria: [auditEntry]
        };

        batch.set(docRef, mapLoteToFirestore(loteToSave));

        if (lote.historial && lote.historial.length > 0) {
          for (const mov of lote.historial) {
            const movRef = doc(collection(db, 'lotes', docId, 'movimientos'), mov.id);
            batch.set(movRef, mov);
          }
        }
      }

      // Procesar actualizaciones
      for (const lote of lotesActualizados) {
        const docId = lote.id;
        const docRef = doc(db, 'lotes', docId);

        const auditEntry: AuditLogEntry = {
          id: `AUD-MOV-${Date.now()}`,
          fechaHora: new Date().toISOString(),
          tipo: 'Stock',
          usuario: currentUser.nombre,
          descripcion: `Stock actualizado por importación Excel. Nuevo stock: ${lote.stockBolsas} bolsas.`
        };

        const loteToSave = {
          ...lote,
          auditoria: [auditEntry, ...(lote.auditoria || [])]
        };

        batch.set(docRef, mapLoteToFirestore(loteToSave));

        if (lote.historial && lote.historial.length > 0) {
          for (const mov of lote.historial) {
            const movRef = doc(collection(db, 'lotes', docId, 'movimientos'), mov.id);
            batch.set(movRef, mov);
          }
        }
      }

      await batch.commit();
      setActiveView('lotes');
      showNotification(`Importación confirmada: ${nuevosLotes.length} nuevos creados y ${lotesActualizados.length} actualizados.`);
    } catch (e) {
      console.error('Error al confirmar importación masiva en Firestore:', e);
      showNotification('Error crítico al confirmar la importación.');
    }
  };

  // Router de Vistas
  const navigateTo = (view: typeof activeView) => {
    if (!isLoggedIn && view !== 'modo-planta') {
      setEnteredPlantaMovil(false);
      showNotification('Acceso restringido. Inicie sesión para acceder a este módulo.');
      return;
    }
    setActiveView(view);
    setLoteSeleccionado(null);
    setLoteAEditar(null);
    setPreselectedLoteId(undefined);
  };

  const handleScanSuccess = (loteId: string) => {
    setShowQrScanner(false);
    const found = lotes.find(l => l.id.toLowerCase() === loteId.toLowerCase());
    if (found) {
      setLoteSeleccionado(found);
      if (isLoggedIn) {
        setActiveView('lotes');
      } else {
        setActiveView('modo-planta');
      }
      showNotification(`Lote ${found.id} detectado y cargado.`);
    } else {
      showNotification(`No se encontró el lote: ${loteId}`);
    }
  };

  // Si hay un lote público consultado por QR y no está logueado, mostramos una ficha pública elegante
  if (!isLoggedIn && publicLote) {
    return (
      <div className="min-h-screen bg-white flex flex-col relative overflow-x-hidden">
        <header className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-100 px-4 md:px-8 flex items-center justify-end z-40 shadow-xs">
          <button
            onClick={() => {
              window.history.replaceState({}, '', window.location.pathname);
              setPublicLote(null);
            }}
            className="text-xs font-bold text-[#00603C] hover:underline hover:text-[#254731] transition"
          >
            Ir al Portal de Operaciones
          </button>
        </header>
        <main className="flex-grow pt-20 pb-16 px-4 md:px-8 w-full max-w-2xl mx-auto relative z-10">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden p-6 md:p-8 relative">
            {/* Sello marca de agua */}
            <div className="absolute right-5 top-5 opacity-10 pointer-events-none">
              <LogoSiloLoose size={120} color="#00603C" />
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5 mb-6">
              <div>
                <span className="text-[10px] font-sans font-bold tracking-widest text-[#C9922E] uppercase">
                  CONSULTA DE TRAZABILIDAD
                </span>
                <h2 className="font-serif text-2xl font-bold text-[#1A1A1A] mt-1">
                  Ficha Técnica Digital
                </h2>
              </div>
              <div className="text-xs font-mono font-bold bg-[#E3EFE7] px-3.5 py-1.5 rounded-lg text-[#00603C] self-start sm:self-center">
                LOTE: {publicLote.id}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8 bg-[#E3EFE7] bg-opacity-20 p-5 rounded-2xl border border-gray-100 text-xs">
              <div className="space-y-3">
                <div>
                  <span className="text-[9px] font-bold text-[#C9922E] uppercase block tracking-wider">Cliente Comitente</span>
                  <span className="text-sm font-bold text-[#1A1A1A]">{publicLote.cliente}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-[#C9922E] uppercase block tracking-wider">Grano / Especie</span>
                  <span className="text-sm font-bold text-[#00603C]">{publicLote.especie}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-[#C9922E] uppercase block tracking-wider">Variedad Sembrada</span>
                  <span className="text-sm font-bold text-gray-800">{publicLote.variedad}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <span className="text-[9px] font-bold text-[#C9922E] uppercase block tracking-wider">Tratamiento Aplicado</span>
                  <span className="text-sm font-semibold text-gray-800">{publicLote.tratamiento.join(' + ')}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-[#C9922E] uppercase block tracking-wider">Químicos / Producto</span>
                  <span className="text-sm font-semibold text-gray-800">{publicLote.producto}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-[#C9922E] uppercase block tracking-wider">Fecha de Clasificación</span>
                  <span className="text-sm font-medium text-gray-800">
                    {new Date(publicLote.fechaIngreso).toLocaleDateString('es-AR')}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8 text-center border-y border-gray-100 py-6">
              <div className="border-r border-gray-100">
                <span className="text-[10px] uppercase text-gray-400 font-bold tracking-wider block">Existencias</span>
                <span className="font-serif text-2xl font-bold text-[#00603C] mt-1 block">
                  {publicLote.stockBolsas} <span className="text-xs font-sans font-medium text-gray-500">b.</span>
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-gray-400 font-bold tracking-wider block">Peso Estimado</span>
                <span className="font-serif text-2xl font-bold text-[#C9922E] mt-1 block">
                  {publicLote.stockKg.toLocaleString('es-AR')} <span className="text-xs font-sans font-medium text-gray-500">kg</span>
                </span>
              </div>
            </div>

            <div className="text-center">
              <p className="text-[10px] text-gray-400 italic">
                Información certificada para control interno y logística. Agro Abacus S.A.
              </p>
            </div>
          </div>
        </main>
        <footer className="h-12 bg-gray-50 border-t border-gray-100 flex items-center justify-center text-center text-xs text-gray-400 font-sans tracking-widest uppercase mt-auto">
          AGRO ABACUS S.A. · ESTANCIA LA BARRANCOSA
        </footer>
      </div>
    );
  }

  // Función para refrescar y resincronizar información desde Firestore
  const handleRefreshData = async () => {
    try {
      const [snapshotLotes, snapshotOrdenes] = await Promise.all([
        getDocs(collection(db, 'lotes')),
        getDocs(collection(db, 'ordenesCarga'))
      ]);
      const loadedLotes = snapshotLotes.docs.map(doc => mapFirestoreToLote(doc.id, doc.data()));
      if (loadedLotes.length > 0) {
        setLotes(loadedLotes);
      }
      const loadedOrdenes = snapshotOrdenes.docs.map(doc => ({ id: doc.id, ...doc.data() } as OrdenCarga));
      if (loadedOrdenes.length > 0) {
        setOrdenesCarga(loadedOrdenes);
      }
      showNotification('Datos de lotes y órdenes actualizados correctamente.');
    } catch (e) {
      console.warn('Refresh local fallback:', e);
      showNotification('Datos actualizados.');
    }
  };

  // Si no está logueado y no ingresó explícitamente a planta-movil ni está viendo un lote público, mostrar la Carátula de Inicio / Login obligatoria
  if (!isLoggedIn && !enteredPlantaMovil && !publicLote) {
    return (
      <Login 
        onLoginSuccess={handleLoginSuccess} 
        onAccederPlantaMovil={() => {
          setEnteredPlantaMovil(true);
          navigateTo('modo-planta');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col relative overflow-x-hidden">
      {/* Botón Flotante para Menú Móvil */}
      <button
        id="sidebar-toggle-btn"
        type="button"
        onClick={() => setMobileNavOpen((prev) => !prev)}
        className="fixed top-3 left-3 z-40 p-2.5 rounded-xl bg-[#00603C] text-white hover:bg-[#254731] active:bg-[#1b3424] transition cursor-pointer flex items-center justify-center shadow-md border border-emerald-600/40 md:hidden print:hidden"
        title="Abrir menú de navegación"
        aria-label="Abrir menú de navegación"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* 2. PANEL DE NAVEGACIÓN VERTICAL (SIDEBAR) - DESKTOP */}
      <aside
        id="main-sidebar"
        className={`fixed top-0 bottom-0 left-0 z-30 bg-[#00603C] text-white flex flex-col border-r border-[#254731] print:hidden hidden md:flex shadow-lg transition-all duration-300 ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Cabecera del Sidebar: Botón Minimizar/Expandir sin leyenda */}
        <div className={`py-3 border-b border-[#254731] flex items-center bg-black/10 transition-all ${
          sidebarCollapsed ? 'px-2 justify-center' : 'px-4 justify-between'
        }`}>
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2 text-emerald-200 truncate">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider truncate">
                Navegación
              </span>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-400/30">
                Planta
              </span>
            </div>
          )}

          {/* Botón único de minimizar / expandir (Solo botón, sin leyenda) */}
          <button
            id="sidebar-minimize-btn"
            type="button"
            onClick={toggleSidebar}
            className="p-2 rounded-xl text-emerald-200 hover:text-white hover:bg-white/10 active:bg-white/20 transition cursor-pointer flex items-center justify-center border border-emerald-400/20 shadow-xs"
            title={sidebarCollapsed ? "Expandir panel de navegación" : "Minimizar panel de navegación"}
            aria-label={sidebarCollapsed ? "Expandir panel" : "Minimizar panel"}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <ChevronLeft className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Lista de Navegación Vertical */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-2.5 space-y-1.5 scrollbar-thin scrollbar-thumb-emerald-700/60">
          
          {/* Tab 1: Planta Móvil */}
          <button
            id="nav-tab-planta-movil"
            onClick={() => navigateTo('modo-planta')}
            className={`w-full group relative flex items-center rounded-xl text-xs font-bold font-sans uppercase tracking-wider transition-all duration-200 cursor-pointer ${
              sidebarCollapsed ? 'justify-center p-3' : 'justify-between px-3 py-2.5'
            } ${
              activeView === 'modo-planta'
                ? 'bg-emerald-400 text-slate-950 font-black shadow-[0_0_16px_rgba(52,211,153,0.8)] ring-2 ring-emerald-300'
                : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-400/40'
            }`}
            title="Planta Móvil: Acceso público a Silos y Operaciones"
          >
            <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-2.5 truncate'}`}>
              <Smartphone className="w-5 h-5 shrink-0 text-emerald-300" />
              {!sidebarCollapsed && <span className="truncate">Planta Móvil</span>}
            </div>
            {!sidebarCollapsed && (
              <span className="text-[9px] px-1.5 py-0.5 bg-emerald-400/30 text-emerald-100 rounded font-mono font-bold">
                Libre
              </span>
            )}
          </button>

          {/* Separador de Sección */}
          <div className={`pt-2 pb-1 text-[9px] font-mono font-bold uppercase tracking-wider text-emerald-300/70 border-t border-[#254731]/60 ${
            sidebarCollapsed ? 'text-center' : 'px-2'
          }`}>
            {!sidebarCollapsed ? 'Operaciones & Planta' : '•••'}
          </div>

          {/* Tab 2: Silos (Carga Manual de Kilos, Humedad, Variedad y Descontaminación) */}
          <button
            id="nav-tab-silos"
            onClick={() => navigateTo('silos')}
            className={`w-full group relative flex items-center rounded-xl text-xs font-semibold font-sans uppercase tracking-wider transition-all duration-200 cursor-pointer ${
              sidebarCollapsed ? 'justify-center p-3' : 'justify-between px-3 py-2.5'
            } ${
              activeView === 'silos'
                ? 'bg-[#F6EFDC] text-[#00603C] font-bold shadow-md ring-1.5 ring-[#C9922E]/80'
                : 'text-white hover:bg-white/10'
            }`}
            title="Silos Clasificadora: Carga Manual de Kilos, Humedad de Silos, Variedad y Descontaminación"
          >
            <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-2.5 truncate'}`}>
              <Warehouse className={`w-5 h-5 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                activeView === 'silos' ? 'text-[#00603C]' : 'text-[#C9922E]'
              }`} />
              {!sidebarCollapsed && <span className="truncate">Silos Clasificadora</span>}
            </div>
            {!sidebarCollapsed && (
              <span className="text-[8.5px] px-1.5 py-0.5 bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 rounded font-mono font-bold">
                6 Silos
              </span>
            )}
          </button>

          {/* Tab 3.b: Mapa de Calor (Distribución de Lotes en Galpones Clasificadora) */}
          <button
            id="nav-tab-mapa-calor"
            onClick={() => navigateTo('mapa-calor')}
            className={`w-full group relative flex items-center rounded-xl text-xs font-semibold font-sans uppercase tracking-wider transition-all duration-200 cursor-pointer ${
              sidebarCollapsed ? 'justify-center p-3' : 'justify-between px-3 py-2.5'
            } ${
              activeView === 'mapa-calor'
                ? 'bg-[#F6EFDC] text-[#00603C] font-bold shadow-md ring-1.5 ring-[#C9922E]/80'
                : 'text-white hover:bg-white/10'
            }`}
            title="Mapa de Calor: Distribución de Lotes en Sectores de Galpones (Alas A-D, Sectores 1-3)"
          >
            <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-2.5 truncate'}`}>
              <Flame className={`w-5 h-5 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                activeView === 'mapa-calor' ? 'text-[#00603C]' : 'text-amber-300'
              }`} />
              {!sidebarCollapsed && <span className="truncate">Mapa de Calor</span>}
            </div>
            {!sidebarCollapsed && (
              <span className="text-[8.5px] px-1.5 py-0.5 bg-amber-400/20 text-amber-200 border border-amber-400/30 rounded font-mono font-bold">
                Alas A-D
              </span>
            )}
          </button>

          {/* Tab 3.c: Dashboard de Operaciones (Historial Global Unificado de Eventos) */}
          <button
            id="nav-tab-dashboard-operaciones"
            onClick={() => navigateTo('dashboard-operaciones')}
            className={`w-full group relative flex items-center rounded-xl text-xs font-semibold font-sans uppercase tracking-wider transition-all duration-200 cursor-pointer ${
              sidebarCollapsed ? 'justify-center p-3' : 'justify-between px-3 py-2.5'
            } ${
              activeView === 'dashboard-operaciones'
                ? 'bg-[#F6EFDC] text-[#00603C] font-bold shadow-md ring-1.5 ring-[#C9922E]/80'
                : 'text-white hover:bg-white/10'
            }`}
            title="Dashboard de Operaciones: Historial Global de Eventos de Planta (Silos, Salidas y Auditoría de Lotes)"
          >
            <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-2.5 truncate'}`}>
              <Activity className={`w-5 h-5 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                activeView === 'dashboard-operaciones' ? 'text-[#00603C]' : 'text-emerald-300'
              }`} />
              {!sidebarCollapsed && <span className="truncate">Dashboard Operaciones</span>}
            </div>
            {!sidebarCollapsed && (
              <span className="text-[8.5px] px-1.5 py-0.5 bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 rounded font-mono font-bold">
                Historial
              </span>
            )}
          </button>

          {/* Separador de Sección: Inventario & Lotes */}
          <div className={`pt-2 pb-1 text-[9px] font-mono font-bold uppercase tracking-wider text-emerald-300/70 border-t border-[#254731]/60 ${
            sidebarCollapsed ? 'text-center' : 'px-2'
          }`}>
            {!sidebarCollapsed ? 'Inventario & Lotes' : '•••'}
          </div>

          {/* Tab 6: Lotes */}
          <button
            id="nav-tab-lotes"
            role="tab"
            aria-selected={activeView === 'lotes' || Boolean(loteSeleccionado)}
            aria-label={`Pestaña Lotes. Gestión de inventario de semillas`}
            onClick={handleLotesClick}
            className={`w-full group relative flex items-center rounded-xl text-xs font-semibold font-sans uppercase tracking-wider transition-all duration-200 cursor-pointer ${
              sidebarCollapsed ? 'justify-center p-3' : 'justify-between px-3 py-2.5'
            } ${
              activeView === 'lotes' || loteSeleccionado
                ? 'bg-[#F6EFDC] text-[#00603C] shadow-sm font-bold ring-1.5 ring-[#C9922E]/60'
                : 'text-white hover:bg-white/10'
            }`}
            title="Inventario de Lotes y Clasificación"
          >
            {/* Inline keyframe style for custom ripple animation */}
            <style>{`
              @keyframes custom-ripple-effect {
                0% {
                  transform: translate(-50%, -50%) scale(0);
                  opacity: 0.5;
                }
                100% {
                  transform: translate(-50%, -50%) scale(4);
                  opacity: 0;
                }
              }
              .animate-custom-ripple {
                animation: custom-ripple-effect 600ms cubic-bezier(0, 0, 0.2, 1) forwards;
              }
            `}</style>
            
            {/* Ripple Container */}
            <span className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
              {lotesRipples.map((ripple) => (
                <span
                  key={ripple.id}
                  className="absolute bg-current opacity-30 rounded-full animate-custom-ripple pointer-events-none"
                  style={{
                    left: ripple.x,
                    top: ripple.y,
                    width: '30px',
                    height: '30px',
                  }}
                />
              ))}
            </span>

            <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-2.5 truncate'}`}>
              <Layers className={`w-5 h-5 shrink-0 transition-transform duration-300 ${isLotesSpinning ? 'animate-spin' : ''}`} />
              {!sidebarCollapsed && <span className="truncate">Lotes</span>}
            </div>
            
            {!sidebarCollapsed && criticalLotesCount > 0 && (
              <span 
                className="flex h-4 min-w-4 px-1 items-center justify-center rounded-full text-[9px] font-bold text-white shadow-xs shrink-0"
                style={{ backgroundColor: '#A0522D' }}
                title={`${criticalLotesCount} lotes con stock crítico`}
              >
                {criticalLotesCount}
              </span>
            )}
          </button>

          {/* Tab 7: Generar Lote */}
          <button
            id="nav-tab-generar-lote"
            onClick={() => navigateTo('generar-lote')}
            className={`w-full group relative flex items-center rounded-xl text-xs font-extrabold font-sans uppercase tracking-wider transition-all duration-200 cursor-pointer ${
              sidebarCollapsed ? 'justify-center p-3' : 'gap-2.5 px-3 py-2.5'
            } ${
              activeView === 'generar-lote'
                ? 'bg-amber-400 text-slate-950 font-black shadow-[0_0_16px_rgba(251,191,36,0.8)] ring-2 ring-amber-300'
                : 'bg-amber-500/20 text-amber-300 hover:bg-amber-400 hover:text-slate-950 border border-amber-400/40'
            }`}
            title="Alta rápida individual o múltiple de lotes en Precarga"
          >
            <PackagePlus className="w-5 h-5 shrink-0" />
            {!sidebarCollapsed && <span className="truncate">Generar Lote</span>}
          </button>
          
          {/* Tab 8: Despachos */}
          <button
            id="nav-tab-despachos"
            onClick={() => {
              navigateTo('despachos');
            }}
            className={`w-full group relative flex items-center rounded-xl text-xs font-semibold font-sans uppercase tracking-wider transition-all duration-200 cursor-pointer ${
              sidebarCollapsed ? 'justify-center p-3' : 'gap-2.5 px-3 py-2.5'
            } ${
              activeView === 'despachos' || activeView === 'salidas-registradas'
                ? 'bg-[#F6EFDC] text-[#00603C] shadow-sm font-bold ring-1.5 ring-[#C9922E]/60'
                : 'text-white hover:bg-white/10'
            }`}
            title="Despachos"
          >
            <ClipboardCheck className="w-5 h-5 shrink-0" />
            {!sidebarCollapsed && <span className="truncate">Despachos</span>}
          </button>

          {/* Separador de Sección: Datos & Sistema */}
          <div className={`pt-3 pb-1 text-[9px] font-mono font-bold uppercase tracking-wider text-emerald-300/70 border-t border-[#254731]/60 ${
            sidebarCollapsed ? 'text-center' : 'px-2'
          }`}>
            {!sidebarCollapsed ? 'Datos & Sistema' : '•••'}
          </div>

          {/* Tab 10: Data Bases (Choferes y Bolsones) */}
          <button
            id="nav-tab-choferes"
            onClick={() => navigateTo('choferes')}
            className={`w-full group relative flex items-center rounded-xl text-xs font-semibold font-sans uppercase tracking-wider transition-all duration-200 cursor-pointer ${
              sidebarCollapsed ? 'justify-center p-3' : 'gap-2.5 px-3 py-2.5'
            } ${
              activeView === 'choferes'
                ? 'bg-[#F6EFDC] text-[#00603C] shadow-sm font-bold ring-1.5 ring-[#C9922E]/60'
                : 'text-white hover:bg-white/10'
            }`}
            title="Bases de Datos: Catálogos y Maestros de Planta"
          >
            <Database className="w-5 h-5 shrink-0 text-[#C9922E]" />
            {!sidebarCollapsed && <span className="truncate">Data Bases</span>}
          </button>

          {/* Tab 11: Importar */}
          <button
            id="nav-tab-importar"
            onClick={() => navigateTo('importar')}
            className={`w-full group relative flex items-center rounded-xl text-xs font-semibold font-sans uppercase tracking-wider transition-all duration-200 cursor-pointer ${
              sidebarCollapsed ? 'justify-center p-3' : 'gap-2.5 px-3 py-2.5'
            } ${
              activeView === 'importar'
                ? 'bg-[#F6EFDC] text-[#00603C] shadow-sm font-bold ring-1.5 ring-[#C9922E]/60'
                : 'text-white hover:bg-white/10'
            }`}
            title="Importar Stock desde Planilla Excel (Ctrl+I)"
          >
            <Upload className="w-5 h-5 shrink-0" />
            {!sidebarCollapsed && <span className="truncate">Importar Stock</span>}
          </button>

          {/* Punto Integrado 1: Campaña Activa */}
          {!sidebarCollapsed ? (
            <div className="pt-2 pb-1 border-t border-[#254731]/60">
              <div className="text-[9px] font-mono font-bold uppercase tracking-wider text-emerald-300/70 px-2 mb-1.5 flex items-center justify-between">
                <span>Campaña Activa</span>
                {isExplicitlyPinned ? (
                  <span className="text-[8px] bg-[#C9922E] text-white px-1.5 py-0.2 rounded font-mono font-bold">Fijada</span>
                ) : (
                  <span className="text-[8px] bg-emerald-700/60 text-emerald-200 px-1.5 py-0.2 rounded font-mono">Sugerida</span>
                )}
              </div>
              <div className="px-1">
                <CampaniaSelector
                  activeCampaniaId={activeCampaniaId}
                  onSelectCampania={handleSelectCampania}
                  isExplicitlyPinned={isExplicitlyPinned}
                  onPinCampania={handlePinCampania}
                  availableCampaniasIds={availableCampaniasIds}
                />
              </div>
            </div>
          ) : (
            <div className="pt-2 pb-1 border-t border-[#254731]/60 flex justify-center" title={`Campaña Activa: ${activeCampaniaId}`}>
              <div className="px-2 py-1 rounded bg-black/30 border border-emerald-500/30 text-[9px] font-mono font-bold text-emerald-300">
                {activeCampaniaId.replace('20', '')}
              </div>
            </div>
          )}

          {/* Punto Integrado 2: Nombre del Usuario */}
          {!sidebarCollapsed ? (
            <div className="pt-2">
              <div className="text-[9px] font-mono font-bold uppercase tracking-wider text-emerald-300/70 px-2 mb-1.5">
                Usuario Conectado
              </div>
              <div className="px-2 py-2 rounded-xl bg-black/25 border border-emerald-500/20 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-emerald-700 border border-[#C9922E] flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-xs">
                  {currentUser?.nombre ? currentUser.nombre.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-white truncate" title={currentUser?.nombre || 'Operario'}>
                    {currentUser?.nombre || 'Operario de Planta'}
                  </div>
                  <div className="text-[10px] text-emerald-200/70 truncate">
                    {isLoggedIn ? (currentUser?.rol || 'Jefe de Planta') : 'Planta Móvil · Acceso'}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="pt-2 flex justify-center" title={`${currentUser?.nombre || 'Operario'} (${currentUser?.rol || 'Planta'})`}>
              <div className="w-8 h-8 rounded-full bg-emerald-700 border border-[#C9922E] flex items-center justify-center text-white font-bold text-xs shadow-xs">
                {currentUser?.nombre ? currentUser.nombre.charAt(0).toUpperCase() : 'U'}
              </div>
            </div>
          )}

          {/* Punto Integrado 3: Salida */}
          <div className="pt-2 pb-1">
            {isLoggedIn ? (
              <button
                id="sidebar-btn-salida"
                type="button"
                onClick={handleLogout}
                className={`w-full flex items-center rounded-xl text-xs font-bold font-sans uppercase tracking-wider text-rose-200 hover:text-white bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 transition-all cursor-pointer shadow-xs ${
                  sidebarCollapsed ? 'justify-center p-3' : 'gap-2.5 px-3 py-2.5'
                }`}
                title="Salida del sistema"
              >
                <LogOut className="w-5 h-5 shrink-0 text-rose-400" />
                {!sidebarCollapsed && <span className="truncate">Salida</span>}
              </button>
            ) : (
              <button
                id="sidebar-btn-salida"
                type="button"
                onClick={() => setEnteredPlantaMovil(false)}
                className={`w-full flex items-center rounded-xl text-xs font-bold font-sans uppercase tracking-wider text-amber-200 hover:text-white bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/40 transition-all cursor-pointer shadow-xs ${
                  sidebarCollapsed ? 'justify-center p-3' : 'gap-2.5 px-3 py-2.5'
                }`}
                title="Salida al Acceso Principal"
              >
                <LogOut className="w-5 h-5 shrink-0 text-amber-400" />
                {!sidebarCollapsed && <span className="truncate">Salida</span>}
              </button>
            )}
          </div>

        </div>

        {/* Pie del Sidebar */}
        {!sidebarCollapsed && (
          <div className="p-3 border-t border-[#254731] bg-black/10 text-center">
            <div className="text-[10px] text-emerald-200/80 font-sans tracking-wide">
              Agro Abacus · La Barrancosa
            </div>
          </div>
        )}
      </aside>

      {/* 2.b MENÚ DESPLEGABLE PARA MÓVILES (MOBILE DRAWER) */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop oscuro */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setMobileNavOpen(false)}
          />

          {/* Panel Lateral Deslizable */}
          <div className="relative w-72 max-w-[85vw] bg-[#00603C] text-white h-full flex flex-col z-10 shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="p-4 border-b border-[#254731] flex items-center justify-between bg-black/10">
              <div className="flex items-center gap-2">
                <LogoSiloLoose size={26} color="#C9922E" />
                <span className="font-serif font-black tracking-wider text-sm">AGRO ABACUS</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white cursor-pointer"
                aria-label="Cerrar menú"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 px-3 space-y-1.5">
              {/* Tab 1: Planta Móvil */}
              <button
                onClick={() => {
                  navigateTo('modo-planta');
                  setMobileNavOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-bold font-sans uppercase tracking-wider transition ${
                  activeView === 'modo-planta'
                    ? 'bg-emerald-400 text-slate-950 font-black shadow-md ring-2 ring-emerald-300'
                    : 'bg-emerald-500/20 text-emerald-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Smartphone className="w-4 h-4 text-emerald-300" />
                  <span>Planta Móvil</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 bg-emerald-400/30 text-emerald-100 rounded font-mono font-bold">
                  Libre
                </span>
              </button>

              <div className="pt-3 pb-1 px-1 text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-300/70 border-t border-[#254731]/60">
                Operaciones
              </div>

              <button
                id="nav-tab-mobile-silos"
                onClick={() => {
                  navigateTo('silos');
                  setMobileNavOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition ${
                  activeView === 'silos'
                    ? 'bg-[#F6EFDC] text-[#00603C] font-bold shadow-xs'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Warehouse className={`w-4 h-4 ${activeView === 'silos' ? 'text-[#00603C]' : 'text-[#C9922E]'}`} />
                  <span>Silos Clasificadora</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 bg-[#C9922E]/20 text-[#F6EFDC] rounded font-mono font-bold">
                  6 Silos
                </span>
              </button>

              <button
                id="nav-tab-mobile-mapa-calor"
                onClick={() => {
                  navigateTo('mapa-calor');
                  setMobileNavOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition ${
                  activeView === 'mapa-calor'
                    ? 'bg-[#F6EFDC] text-[#00603C] font-bold shadow-xs'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Flame className={`w-4 h-4 ${activeView === 'mapa-calor' ? 'text-[#00603C]' : 'text-amber-300'}`} />
                  <span>Mapa de Calor</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 bg-amber-400/20 text-amber-200 rounded font-mono font-bold">
                  12 Sectores
                </span>
              </button>

              <button
                id="nav-tab-mobile-dashboard-operaciones"
                onClick={() => {
                  navigateTo('dashboard-operaciones');
                  setMobileNavOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition ${
                  activeView === 'dashboard-operaciones'
                    ? 'bg-[#F6EFDC] text-[#00603C] font-bold shadow-xs'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Activity className={`w-4 h-4 ${activeView === 'dashboard-operaciones' ? 'text-[#00603C]' : 'text-emerald-300'}`} />
                  <span>Dashboard Operaciones</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 bg-emerald-400/20 text-emerald-200 rounded font-mono font-bold">
                  Historial
                </span>
              </button>

              <div className="pt-3 pb-1 px-1 text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-300/70 border-t border-[#254731]/60">
                Inventario
              </div>

              <button
                onClick={() => {
                  handleLotesClick();
                  setMobileNavOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition ${
                  activeView === 'lotes' || loteSeleccionado
                    ? 'bg-[#F6EFDC] text-[#00603C] font-bold'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Layers className="w-4 h-4" />
                  <span>Lotes</span>
                </div>
                {criticalLotesCount > 0 && (
                  <span className="bg-[#A0522D] text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                    {criticalLotesCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  navigateTo('generar-lote');
                  setMobileNavOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition ${
                  activeView === 'generar-lote'
                    ? 'bg-amber-400 text-slate-950 font-black'
                    : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                <PackagePlus className="w-4 h-4" />
                <span>Generar Lote</span>
              </button>

              {/* Despachos */}
              <button
                onClick={() => {
                  navigateTo('despachos');
                  setMobileNavOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition ${
                  activeView === 'despachos' || activeView === 'salidas-registradas'
                    ? 'bg-[#F6EFDC] text-[#00603C] font-bold'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                <ClipboardCheck className="w-4 h-4" />
                <span>Despachos</span>
              </button>

              {/* Separador de Sección: Datos & Sistema */}
              <div className="pt-3 pb-1 px-1 text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-300/70 border-t border-[#254731]/60">
                Datos & Sistema
              </div>

              <button
                onClick={() => {
                  navigateTo('choferes');
                  setMobileNavOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition ${
                  activeView === 'choferes'
                    ? 'bg-[#F6EFDC] text-[#00603C] font-bold'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                <Database className="w-4 h-4 text-[#C9922E]" />
                <span>Data Bases</span>
              </button>

              <button
                onClick={() => {
                  navigateTo('importar');
                  setMobileNavOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition ${
                  activeView === 'importar'
                    ? 'bg-[#F6EFDC] text-[#00603C] font-bold'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>Importar Stock</span>
              </button>

              {/* Mobile: Campaña Activa */}
              <div className="pt-2 pb-1 border-t border-[#254731]/60">
                <div className="text-[9px] font-mono font-bold uppercase tracking-wider text-emerald-300/70 px-1 mb-1.5 flex items-center justify-between">
                  <span>Campaña Activa</span>
                  {isExplicitlyPinned ? (
                    <span className="text-[8px] bg-[#C9922E] text-white px-1.5 py-0.2 rounded font-mono font-bold">Fijada</span>
                  ) : (
                    <span className="text-[8px] bg-emerald-700/60 text-emerald-200 px-1.5 py-0.2 rounded font-mono">Sugerida</span>
                  )}
                </div>
                <div>
                  <CampaniaSelector
                    activeCampaniaId={activeCampaniaId}
                    onSelectCampania={(id) => {
                      handleSelectCampania(id);
                      setMobileNavOpen(false);
                    }}
                    isExplicitlyPinned={isExplicitlyPinned}
                    onPinCampania={handlePinCampania}
                    availableCampaniasIds={availableCampaniasIds}
                  />
                </div>
              </div>

              {/* Mobile: Nombre del Usuario */}
              <div className="pt-2">
                <div className="text-[9px] font-mono font-bold uppercase tracking-wider text-emerald-300/70 px-1 mb-1.5">
                  Usuario Conectado
                </div>
                <div className="px-3 py-2 rounded-xl bg-black/25 border border-emerald-500/20 flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-emerald-700 border border-[#C9922E] flex items-center justify-center text-white font-bold text-xs shrink-0">
                    {currentUser?.nombre ? currentUser.nombre.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-white truncate">
                      {currentUser?.nombre || 'Operario de Planta'}
                    </div>
                    <div className="text-[10px] text-emerald-200/70 truncate">
                      {isLoggedIn ? (currentUser?.rol || 'Jefe de Planta') : 'Planta Móvil · Acceso'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Mobile: Salida */}
              <div className="pt-2 pb-2">
                {isLoggedIn ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileNavOpen(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-rose-200 hover:text-white bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 transition-all cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-rose-400" />
                    <span>Salida</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileNavOpen(false);
                      setEnteredPlantaMovil(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-amber-200 hover:text-white bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/40 transition-all cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-amber-400" />
                    <span>Salida</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. ÁREA DE CONTENIDO PRINCIPAL */}
      <main className={`flex-grow pt-14 md:pt-6 pb-16 px-3 sm:px-4 md:px-6 w-full relative z-10 print:pt-2 print:pb-2 print:px-0 transition-all duration-300 ${
        sidebarCollapsed ? 'md:pl-24' : 'md:pl-68'
      }`}>
        <div className={(activeView === 'despachos' || activeView === 'lotes' || activeView === 'produccion' || activeView === 'dashboard-operaciones') ? 'w-full max-w-[1850px] mx-auto' : 'max-w-7xl mx-auto'}>
        
        {/* RUTA DE COMPONENTES SEGÚN VISTA ACTIVA */}
        {loteSeleccionado ? (
          <LoteDetail
            lote={loteSeleccionado}
            readOnly={!isLoggedIn}
            movimientosSilo={movimientosSilo}
            ordenesCarga={ordenesCarga}
            salidas={salidas}
            onBack={() => {
              setLoteSeleccionado(null);
              navigateTo(loteDetailSourceView);
            }}
            onSaveLote={handleSaveLote}
            onUpdateLoteStock={handleUpdateLoteStock}
            onRegistrarSalida={isLoggedIn ? (id) => {
              setPreselectedLoteId(id);
              setLoteSeleccionado(null);
              setActiveView('registrar-salida');
            } : undefined}
            onUpdateLoteLocation={isLoggedIn ? handleUpdateLoteLocation : undefined}
            onUpdateLoteInase={isLoggedIn ? handleUpdateLoteInase : undefined}
            onUpdateLotePesoDeMil={handleUpdateLotePesoDeMil}
          />
        ) : (
          <>
            {/* VISTAS PERSISTENTES: LOTES Y PRODUCCIÓN (PRESERVAN ESTADO, SELECCIÓN Y EVITAN RECARGAS) */}
            <div
              id="view-container-lotes"
              className={activeView === 'lotes' ? 'block' : 'hidden'}
            >
              <LotesView
                lotes={filteredLotesByCampania}
                movimientosSilo={movimientosSilo}
                siloStocks={siloStocks}
                bolsones={bolsones}
                clientes={clientes}
                especies={especies}
                plantaConfig={plantaConfig}
                loteLimits={loteLimits}
                onUpdateLoteLimits={(newLimits) => setLoteLimits(newLimits)}
                onSelectLote={(l) => {
                  setLoteSeleccionado(l);
                  setLoteDetailSourceView('lotes');
                }}
                onEditLote={(l) => {
                  // Editado en la misma vista de tabla (LotesView maneja edición directa de Nombre, Bolsas, Estado y Tipo)
                }}
                onAddLote={() => navigateTo('generar-lote')}
                onRegistrarSalidaLote={(l) => {
                  setPreselectedLoteId(l.id);
                  setActiveView('registrar-salida');
                }}
                onDeleteLote={handleDeleteLote}
                onDeleteMultipleLotes={handleDeleteMultipleLotes}
                currentUser={currentUser}
                onWipeStocks={handleWipeStocks}
                onSaveLote={handleSaveLote}
                onBatchUpdateLotes={handleBatchUpdateLotes}
                onRefresh={handleRefreshData}
              />
            </div>

            <div
              id="view-container-produccion"
              className={activeView === 'produccion' ? 'block' : 'hidden'}
            >
              <DashboardProduccion
                lotes={filteredLotesByCampania}
                salidas={filteredSalidasByCampania}
                ordenesCarga={filteredOrdenesByCampania}
                movimientosSilo={movimientosSilo}
                siloStocks={siloStocks}
                plantaConfig={plantaConfig}
                clientes={clientes}
                especies={especies}
                onSelectLote={(l) => {
                  setLoteSeleccionado(l);
                  setLoteDetailSourceView('produccion');
                }}
                onNavigateToLotes={() => navigateTo('lotes')}
                onNavigateToSilos={() => navigateTo('silos')}
              />
            </div>

            {activeView === 'dashboard-operaciones' ? (
              <div className="space-y-6 animate-in fade-in duration-300">
                <DashboardOperaciones
                  lotes={filteredLotesByCampania}
                  movimientosSilo={movimientosSilo}
                  salidas={filteredSalidasByCampania}
                  siloStocks={siloStocks}
                  clientes={clientes}
                  especies={especies}
                  choferes={choferes}
                  currentUser={currentUser?.nombre}
                  onSelectLote={(l) => {
                    setLoteSeleccionado(l);
                    setLoteDetailSourceView('lotes');
                  }}
                  onNavigateToView={(view) => navigateTo(view as any)}
                />
              </div>
            ) : activeView === 'mapa-calor' ? (
              <div className="space-y-6 animate-in fade-in duration-300">
                <MapaCalorDashboard
                  lotes={lotes}
                  clientes={clientes}
                  especies={especies}
                  onSaveLote={handleSaveLote}
                  onSelectLote={(l) => {
                    setLoteSeleccionado(l);
                    setLoteDetailSourceView('mapa-calor');
                  }}
                  onNavigateToLotes={() => navigateTo('lotes')}
                />
              </div>
            ) : activeView === 'calculo-bolsas' ? (
              <div className="space-y-6 animate-in fade-in duration-300">
                <CalculoBolsasDashboard
                  siloStocks={siloStocks}
                  movimientosSilo={movimientosSilo}
                  clientes={clientes}
                  especies={especies}
                  onAplicarAPrecarga={(config) => {
                    setPrecargaConfigFromCalculo(config);
                    navigateTo('generar-lote');
                    const detalleSilo = config.esDeSilo && config.cliente
                      ? ` con datos de ${config.silosOrigenNombres || 'Silo'} (Cliente: "${config.cliente}", Variedad: "${config.variedad || 'N/A'}")`
                      : '';
                    showNotification(`Se generaron ${config.desgloseLotes?.length || config.cantidadLotes} lote(s) en Precarga${detalleSilo}.`);
                  }}
                  onCerrar={() => navigateTo('lotes')}
                />
              </div>
            ) : activeView === 'generar-lote' ? (
              <GenerarLoteView
                lotes={lotes}
                clientes={clientes}
                especies={especies}
                plantaConfig={plantaConfig}
                loteLimits={loteLimits}
                siloStocks={siloStocks}
                movimientosSilo={movimientosSilo}
                onSaveLote={handleSaveLote}
                onNavigateToLotes={() => navigateTo('lotes')}
                initialCalculoConfig={precargaConfigFromCalculo}
                onClearInitialConfig={() => setPrecargaConfigFromCalculo(null)}
              />
            ) : activeView === 'alta-lote' ? (
          <LoteForm
            existingLotes={lotes}
            movimientosSilo={movimientosSilo}
            bolsones={bolsones}
            clientes={clientes}
            especies={especies}
            plantaConfig={plantaConfig}
            loteAEditar={null}
            loteLimits={loteLimits}
            activeCampaniaId={activeCampaniaId}
            siloStocks={siloStocks}
            onSave={handleSaveLote}
            onCancel={() => navigateTo('lotes')}
          />
        ) : activeView === 'importar' ? (
          <ImportarStock
            existingLotes={lotes}
            loteLimits={loteLimits}
            onImportConfirm={handleImportConfirm}
            onCancel={() => navigateTo('lotes')}
          />
        ) : activeView === 'registrar-salida' ? (
          <RegistrarSalida
            lotes={lotes}
            clientes={clientes}
            choferes={choferes}
            preselectedLoteId={preselectedLoteId}
            onSaveSalida={handleSaveSalida}
            onCancel={() => navigateTo('lotes')}
          />
        ) : activeView === 'choferes' ? (
          <DataBasesView
            choferes={choferes}
            bolsones={bolsones}
            movimientosSilo={movimientosSilo}
            lotes={lotes}
            siloStocks={siloStocks}
            clientes={clientes}
            especies={especies}
            plantaConfig={plantaConfig}
            onSavePlantaConfig={handleSavePlantaConfig}
            onSaveChofer={handleSaveChofer}
            onImportChoferes={handleImportChoferes}
          />
        ) : activeView === 'despachos' || activeView === 'salidas-registradas' ? (
          <DespachosSection
            lotes={filteredLotesByCampania}
            ordenes={filteredOrdenesByCampania}
            salidas={filteredSalidasByCampania}
            choferes={choferes}
            plantaConfig={plantaConfig}
            initialSubView={activeView === 'salidas-registradas' ? 'listado' : despachosInitialSubView}
            onSaveOrden={handleSaveOrden}
            onUpdateOrdenStatus={handleUpdateOrdenStatus}
            onDespacharStock={handleDespacharStock}
            onDeleteOrden={handleDeleteOrden}
            onDeleteMultipleOrdenes={handleDeleteMultipleOrdenes}
            onDeleteDespacho={handleDeleteDespacho}
            onDeleteMultipleDespachos={handleDeleteMultipleDespachos}
            onRefresh={handleRefreshData}
          />
        ) : activeView === 'modo-planta' ? (
          <ModoPlantaMobileView
            lotes={filteredLotesByCampania}
            siloStocks={siloStocks}
            movimientosSilo={movimientosSilo}
            choferes={choferes}
            bolsones={bolsones}
            clientes={clientes}
            especies={especies}
            currentUser={currentUser}
            ordenesCarga={filteredOrdenesByCampania}
            silosEstadoManual={silosEstadoManual}
            onUpdateSiloEstadoManual={handleUpdateSiloEstadoManual}
            onRegistrarIngresoSilo={handleRegistrarIngresoSilo}
            onUpdateLoteEstado={(lote, nuevoEstado) => {
              const updatedLote = { ...lote, estadoRegistro: nuevoEstado };
              handleBatchUpdateLotes([updatedLote]);
            }}
            onOpenQrScanner={() => setShowQrScanner(true)}
            onSelectLote={(l) => setLoteSeleccionado(l)}
            onSaveOrdenCarga={handleSaveOrden}
            onUpdateOrdenStatus={handleUpdateOrdenStatus}
            onDespacharStock={handleDespacharStock}
            onDeleteOrdenCarga={handleDeleteOrden}
          />
        ) : activeView === 'silos' ? (
          <IngresoSilosView
            movimientosSilo={movimientosSilo}
            siloStocks={siloStocks}
            clientes={clientes}
            especies={especies}
            plantaConfig={plantaConfig}
            currentUser={currentUser}
            choferes={choferes}
            bolsones={bolsones}
            silosEstadoManual={silosEstadoManual}
            onRegistrarIngresoSilo={handleRegistrarIngresoSilo}
            onRegistrarIngresosMultipleSilo={handleRegistrarIngresosMultipleSilo}
            onRegistrarSalidaManualSilo={handleRegistrarSalidaManualSilo}
            onPonerSiloEnCero={handlePonerSiloEnCero}
            onEditarMovimientoSilo={handleEditarMovimientoSilo}
            onEliminarMovimientoSilo={handleEliminarMovimientoSilo}
            onReordenarMovimientosSilo={handleReordenarMovimientosSilo}
            onUpdateSiloEstadoManual={handleUpdateSiloEstadoManual}
            onNavigateToPlanta={() => navigateTo('modo-planta')}
          />
        ) : null}
          </>
        )}

        </div>
      </main>

      {/* 5. FOOTER CON IDENTIDAD EXACTA */}
      <footer className={`h-12 bg-gray-50 border-t border-gray-100 flex items-center justify-center text-center text-xs text-gray-400 font-sans tracking-widest uppercase mt-auto transition-all duration-300 print:hidden ${
        sidebarCollapsed ? 'md:pl-20' : 'md:pl-64'
      }`}>
        AGRO ABACUS S.A. · ESTANCIA LA BARRANCOSA
      </footer>

      {/* 6. MODAL ESCÁNER DE QR */}
      {showQrScanner && (
        <QrCodeScanner
          onScanSuccess={handleScanSuccess}
          onClose={() => setShowQrScanner(false)}
        />
      )}

    </div>
  );
}
