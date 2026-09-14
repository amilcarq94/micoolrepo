/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, doc, writeBatch, getDocs, getDoc, setDoc, updateDoc, runTransaction, onSnapshot } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { Lote, MovimientoStock, SalidaRegistrada, OrdenCarga, MovimientoSilo, Chofer, BolsonCampo, SiloId, EstadoSiloManual, SilosEstadoMap, SILOS_ESTADO_DEFAULT, PlantaConfig, PLANTA_CONFIG_DEFAULT } from '../types';
import { getCampaniaIdFromDate } from '../utils/campanias';
import { compressDataUrl } from '../utils/imageCompression';

// Configuración de Firebase obtenida de firebase-applet-config.json
const firebaseConfig = {
  apiKey: "AIzaSyCt2aP7SXqvGvbJLGHwwlRxp8iHasDnEuc",
  authDomain: "gen-lang-client-0252455967.firebaseapp.com",
  projectId: "gen-lang-client-0252455967",
  storageBucket: "gen-lang-client-0252455967.firebasestorage.app",
  messagingSenderId: "1015042311245",
  appId: "1:1015042311245:web:414772be8eb99f1eff8804"
};

// Inicialización de la aplicación Firebase
const app = initializeApp(firebaseConfig);

// Inicializar Firestore con la base de datos específica configurada y forzar long polling
const databaseId = "ai-studio-plantaclasificad-095097e1-a258-405e-860b-e197efbcd6bc";
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  useFetchStreams: false,
} as any, databaseId);

// Inicializar Firebase Storage
export const storage = getStorage(app);
try {
  // Limitar el tiempo máximo de reintentos a 3.5 segundos para evitar demoras por storage/retry-limit-exceeded
  storage.maxUploadRetryTime = 3500;
  storage.maxOperationRetryTime = 3500;
} catch {
  // ignore
}

/**
 * Normaliza el ID de un lote a la combinación de cliente + "_" + numeroLote.
 * Se eliminan tildes, espacios y caracteres especiales, convirtiendo a minúsculas
 * (ej: "San Diego", "58FIN" -> "san-diego_58FIN")
 */
export function getLoteDocId(cliente: string, numeroLote: string): string {
  const cleanCliente = cliente
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar tildes
    .replace(/[^a-z0-9]+/g, "-") // reemplazar espacios y caracteres especiales por guiones
    .replace(/^-+|-+$/g, ""); // recortar guiones al inicio/fin
  
  const cleanLote = numeroLote.trim();
  return `${cleanCliente}_${cleanLote}`;
}

/**
 * Sube una cadena en formato Base64 (Data URL) a Firebase Storage.
 * Optimiza y comprime la imagen a < 250 KB de forma preventiva.
 * Si Storage no está disponible o supera el límite de reintentos, retorna
 * de forma segura la imagen comprimida para almacenamiento directo en Firestore sin exceder 1 MB.
 */
export async function uploadBase64ToStorage(path: string, dataUrl: string): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    return dataUrl; // Si no es base64, retornar como está
  }

  // 1. Optimizar imagen en cliente para garantizar que nunca supere ~250 KB
  let safeDataUrl = dataUrl;
  if (dataUrl.startsWith('data:image/')) {
    try {
      safeDataUrl = await compressDataUrl(dataUrl);
    } catch (compErr) {
      console.warn('Advertencia al comprimir imagen antes de subir:', compErr);
    }
  }

  // 2. Intentar subir a Firebase Storage con timeout de 3.5s
  try {
    const storageRef = ref(storage, path);
    const uploadTask = (async () => {
      await uploadString(storageRef, safeDataUrl, 'data_url');
      return await getDownloadURL(storageRef);
    })();

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Storage upload timeout')), 3500)
    );

    const downloadUrl = await Promise.race([uploadTask, timeoutPromise]);
    return downloadUrl;
  } catch (error) {
    console.warn(`Firebase Storage no disponible (${path}). Usando base64 optimizado (${Math.round(safeDataUrl.length / 1024)} KB):`, error);
    // Retornamos el dataUrl optimizado garantizado para Firestore
    return safeDataUrl;
  }
}

/**
 * Seed inicial: Carga los lotes de stock informados si la colección 'lotes' en Firestore está vacía.
 */
export async function seedLotesIfEmpty(initialLotes: Lote[]): Promise<void> {
  try {
    const lotesRef = collection(db, 'lotes');
    const snapshot = await getDocs(lotesRef);
    
    if (snapshot.empty) {
      console.log('Seeding inicial de 112 lotes en Firestore...');
      
      // Firestore writeBatch soporta hasta 500 operaciones. Tenemos 112, por lo que una tanda es suficiente.
      const batch = writeBatch(db);
      const todayStr = new Date().toISOString().split('T')[0];
      
      for (const lote of initialLotes) {
        // Generar ID del documento
        const docId = getLoteDocId(lote.cliente, lote.loteNro);
        const docRef = doc(db, 'lotes', docId);
        
        // Recalcular campos requeridos por el usuario en base de datos real
        const stockKgTotal = lote.stockBolsas * lote.kgPorBolsa;
        const estado = (lote.stockBolsas > 0 ? "Disponible" : "Agotado");
        
        const fechaIng = lote.fechaIngreso || todayStr;
        const campaniaId = lote.campaniaId || getCampaniaIdFromDate(fechaIng);

        // Estructurar el documento para la colección 'lotes'
        const firestoreLote = {
          id: docId,
          especie: lote.especie,
          variedad: lote.variedad,
          numeroLote: lote.loteNro, // Campo requerido por el usuario como numeroLote
          cliente: lote.cliente,
          tipoLote: lote.tipo, // Campo requerido por el usuario como tipoLote
          categoria: lote.categoria,
          tratamiento: lote.tratamiento[0] || 'Sin Tratar', // Como string, ej: 'Tratado' o 'Sin Tratar'
          stockBolsas: lote.stockBolsas,
          kgPorBolsa: lote.kgPorBolsa,
          stockKgTotal: stockKgTotal,
          estado: estado,
          fechaIngreso: fechaIng,
          campaniaId: campaniaId,
          producto: lote.producto || 'Ninguno',
          ala: lote.ala || '',
          sector: lote.sector || ''
        };
        
        batch.set(docRef, firestoreLote);
        
        // Guardar su historial inicial en la subcolección 'movimientos'
        if (lote.historial && lote.historial.length > 0) {
          for (const mov of lote.historial) {
            const movRef = doc(collection(db, 'lotes', docId, 'movimientos'), mov.id);
            batch.set(movRef, {
              id: mov.id,
              fecha: mov.fecha || todayStr,
              tipo: mov.tipo,
              cantidadBolsas: mov.cantidadBolsas,
              kgPorBolsa: mov.kgPorBolsa,
              cantidadKg: mov.cantidadKg,
              detalle: mov.detalle || 'Stock inicial precargado'
            });
          }
        }
      }
      
      await batch.commit();
      console.log('Seeding completado con éxito!');
    } else {
      console.log('Colección "lotes" ya contiene datos, omitiendo seeding.');
    }
  } catch (error) {
    console.error('Error al realizar el seeding inicial en Firestore:', error);
  }
}

/**
 * Registra un movimiento y actualiza el stock del lote padre usando una transacción atómica.
 */
export async function registrarMovimientoTransaccion(
  loteId: string,
  movimiento: MovimientoStock
): Promise<void> {
  const loteRef = doc(db, 'lotes', loteId);
  const movRef = doc(collection(db, 'lotes', loteId, 'movimientos'), movimiento.id);
  
  await runTransaction(db, async (transaction) => {
    const loteDoc = await transaction.get(loteRef);
    if (!loteDoc.exists()) {
      throw new Error(`El lote ${loteId} no existe.`);
    }
    
    const data = loteDoc.data();
    const currentBolsas = data.stockBolsas || 0;
    const kgPorBolsa = data.kgPorBolsa || 800;
    
    // Determinar dirección del stock
    const isAddition = !movimiento.tipo.toLowerCase().includes('salida');
    const bolsasChange = isAddition ? movimiento.cantidadBolsas : -movimiento.cantidadBolsas;
    
    const nuevoStockBolsas = Math.max(0, currentBolsas + bolsasChange);
    const nuevoStockKgTotal = nuevoStockBolsas * kgPorBolsa;
    
    // Si se agotó, el estado pasa a "Agotado" automáticamente, de lo contrario si tiene stock y estaba Agotado, pasa a Disponible
    let nuevoEstado = data.estado;
    if (nuevoStockBolsas === 0) {
      nuevoEstado = 'Agotado';
    } else if (data.estado === 'Agotado') {
      nuevoEstado = 'Disponible';
    }
    
    // 1. Escribir el nuevo movimiento
    transaction.set(movRef, movimiento);
    
    // 2. Actualizar el lote padre
    transaction.update(loteRef, {
      stockBolsas: nuevoStockBolsas,
      stockKgTotal: nuevoStockKgTotal,
      estado: nuevoEstado
    });
  });
}

/**
 * Convierte un documento de Firestore a un objeto Lote de la aplicación.
 */
export function mapFirestoreToLote(id: string, data: any): Lote {
  const fechaIngreso = data.fechaIngreso || new Date().toISOString().split('T')[0];
  const campaniaId = data.campaniaId || getCampaniaIdFromDate(fechaIngreso);

  return {
    id: id,
    loteNro: data.numeroLote || '',
    cliente: data.cliente || '',
    especie: data.especie || 'Sin especificar',
    variedad: data.variedad || '',
    tipo: data.tipoLote || 'Final',
    categoria: data.categoria || 'Primu',
    tratamiento: Array.isArray(data.tratamiento) ? data.tratamiento : [data.tratamiento || 'Sin Tratar'],
    producto: data.producto || 'Ninguno',
    stockBolsas: data.stockBolsas || 0,
    kgPorBolsa: data.kgPorBolsa || 800,
    stockKg: data.stockKgTotal !== undefined ? data.stockKgTotal : (data.stockBolsas || 0) * (data.kgPorBolsa || 800),
    fechaIngreso: fechaIngreso,
    campaniaId: campaniaId,
    estado: data.estado || 'Disponible',
    estadoRegistro: data.estadoRegistro || 'PRE-CARGA',
    fechaHoraProduccion: data.fechaHoraProduccion || undefined,
    historial: data.historial || [],
    auditoria: data.auditoria || [],
    observaciones: data.observaciones || '',
    ala: data.ala || '',
    sector: data.sector || '',
    ubicacionAcopio: data.ubicacionAcopio || (data.ala && data.sector ? `Ala ${data.ala} - Sector ${data.sector}` : ''),
    silosOrigen: data.silosOrigen || [],
    siloOrigen: data.siloOrigen || '',
    origenesBolson: data.origenesBolson || [],
    numeroBolsonOrigen: data.numeroBolsonOrigen || data.bolsonOrigenNro || '',
    bolsonOrigenNro: data.bolsonOrigenNro || data.numeroBolsonOrigen || '',
    sectorBolsonOrigen: data.sectorBolsonOrigen || '',
    humedad: data.humedad !== undefined ? Number(data.humedad) : undefined,
    inaseInicio: data.inaseInicio || '',
    inaseFinal: data.inaseFinal || ''
  };
}

/**
 * Limpia recursivamente un objeto o arreglo para asegurar compatibilidad total con Firestore,
 * eliminando todas las claves que tengan valor `undefined` (ya que Firestore rechaza valores undefined).
 */
export function sanitizeForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as any;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as any;
  }
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeForFirestore(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}

/**
 * Convierte un objeto Lote de la aplicación a un documento para Firestore.
 */
export function mapLoteToFirestore(lote: Lote): any {
  const fechaIngreso = lote.fechaIngreso || new Date().toISOString().split('T')[0];
  const campaniaId = lote.campaniaId || getCampaniaIdFromDate(fechaIngreso);

  const raw = {
    id: lote.id,
    especie: lote.especie,
    variedad: lote.variedad,
    numeroLote: lote.loteNro,
    cliente: lote.cliente,
    tipoLote: lote.tipo,
    categoria: lote.categoria,
    tratamiento: lote.tratamiento,
    stockBolsas: lote.stockBolsas,
    kgPorBolsa: lote.kgPorBolsa,
    stockKg: lote.stockKg !== undefined ? lote.stockKg : (lote.stockBolsas * (lote.kgPorBolsa || 40)),
    stockKgTotal: lote.stockKg !== undefined ? lote.stockKg : (lote.stockBolsas * (lote.kgPorBolsa || 40)),
    remitoCliente: (lote as any).remitoCliente || '',
    estado: lote.stockBolsas === 0 ? 'Agotado' : lote.estado,
    estadoRegistro: lote.estadoRegistro || 'PRE-CARGA',
    fechaHoraProduccion: lote.fechaHoraProduccion || null,
    fechaIngreso: fechaIngreso,
    campaniaId: campaniaId,
    producto: lote.producto,
    historial: lote.historial || [],
    auditoria: lote.auditoria || [],
    observaciones: lote.observaciones || '',
    ala: lote.ala || '',
    sector: lote.sector || '',
    ubicacionAcopio: lote.ubicacionAcopio || '',
    humedad: lote.humedad !== undefined && lote.humedad !== null ? Number(lote.humedad) : null,
    inaseInicio: lote.inaseInicio || '',
    inaseFinal: lote.inaseFinal || '',
    silosOrigen: lote.silosOrigen || [],
    siloOrigen: lote.siloOrigen || '',
    origenesBolson: lote.origenesBolson || [],
    numeroBolsonOrigen: lote.numeroBolsonOrigen || lote.bolsonOrigenNro || '',
    bolsonOrigenNro: lote.bolsonOrigenNro || lote.numeroBolsonOrigen || '',
    sectorBolsonOrigen: lote.sectorBolsonOrigen || ''
  };

  return sanitizeForFirestore(raw);
}

/**
 * Sanitiza y prepara un MovimientoSilo para su persistencia segura en Firestore sin campos undefined.
 */
export function mapMovimientoSiloToFirestore(mov: MovimientoSilo): any {
  return sanitizeForFirestore(mov);
}

/**
 * Seed de Órdenes de Proceso en Firestore si está vacía.
 */
export async function seedOrdenesProcesoIfEmpty(initialOrdenes: any[]): Promise<void> {
  try {
    const ordenesRef = collection(db, 'ordenes_proceso');
    const snapshot = await getDocs(ordenesRef);
    if (snapshot.empty) {
      console.log('Seeding inicial de órdenes de proceso en Firestore...');
      const batch = writeBatch(db);
      for (const ord of initialOrdenes) {
        const docRef = doc(db, 'ordenes_proceso', ord.id);
        batch.set(docRef, sanitizeForFirestore(ord));
      }
      await batch.commit();
      console.log('Seeding de órdenes de proceso completado con éxito.');
    }
  } catch (error) {
    console.warn('Error en seeding de órdenes de proceso:', error);
  }
}

/**
 * Seed de Movimientos de Silos en Firestore si está vacía.
 */
export async function seedMovimientosSiloIfEmpty(initialMovs: MovimientoSilo[]): Promise<void> {
  try {
    const movsRef = collection(db, 'movimientos_silo');
    const snapshot = await getDocs(movsRef);
    if (snapshot.empty) {
      console.log('Seeding inicial de movimientos de silos en Firestore...');
      const batch = writeBatch(db);
      for (const mov of initialMovs) {
        const docRef = doc(db, 'movimientos_silo', mov.id);
        batch.set(docRef, sanitizeForFirestore(mov));
      }
      await batch.commit();
      console.log('Seeding de movimientos de silos completado con éxito.');
    }
  } catch (error) {
    console.warn('Error en seeding de movimientos de silos:', error);
  }
}

/**
 * Seed de Choferes en Firestore si está vacía.
 */
export async function seedChoferesIfEmpty(initialChoferes: Chofer[]): Promise<void> {
  try {
    const choferesRef = collection(db, 'choferes');
    const snapshot = await getDocs(choferesRef);
    if (snapshot.empty) {
      console.log('Seeding inicial de choferes en Firestore...');
      const batch = writeBatch(db);
      for (const ch of initialChoferes) {
        const docRef = doc(db, 'choferes', ch.id);
        batch.set(docRef, sanitizeForFirestore(ch));
      }
      await batch.commit();
      console.log('Seeding de choferes completado con éxito.');
    }
  } catch (error) {
    console.warn('Error en seeding de choferes:', error);
  }
}

/**
 * Seed de Bolsones en Campo en Firestore si está vacía.
 */
export async function seedBolsonesIfEmpty(initialBolsones: BolsonCampo[]): Promise<void> {
  try {
    const bolsonesRef = collection(db, 'bolsones_campo');
    const snapshot = await getDocs(bolsonesRef);
    if (snapshot.empty) {
      console.log('Seeding inicial de bolsones en campo en Firestore...');
      const batch = writeBatch(db);
      for (const b of initialBolsones) {
        const docRef = doc(db, 'bolsones_campo', b.id);
        batch.set(docRef, sanitizeForFirestore(b));
      }
      await batch.commit();
      console.log('Seeding de bolsones completado con éxito.');
    }
  } catch (error) {
    console.warn('Error en seeding de bolsones:', error);
  }
}

/**
 * Seed o inicialización de Estados de Silos en Firestore si no existe.
 */
export async function seedSilosEstadoIfEmpty(initialEstados?: SilosEstadoMap): Promise<void> {
  try {
    const estadoDocRef = doc(db, 'silos_estado', 'estados');
    const docSnap = await getDoc(estadoDocRef);
    if (!docSnap.exists()) {
      console.log('Inicializando estados de silos en Firestore...');
      const baseEstados = initialEstados || SILOS_ESTADO_DEFAULT;
      await setDoc(estadoDocRef, {
        estados: baseEstados,
        updatedAt: new Date().toISOString(),
        updatedBy: 'Sistema'
      });
      console.log('Inicialización de estados de silos completada con éxito.');
    }
  } catch (error) {
    console.warn('Error en inicialización de estados de silos:', error);
  }
}

/**
 * Guardar/Actualizar el estado manual de un silo específico en Firestore.
 */
export async function guardarSiloEstadoFirestore(
  siloId: SiloId,
  estado: EstadoSiloManual,
  usuarioNombre?: string
): Promise<void> {
  try {
    const estadoDocRef = doc(db, 'silos_estado', 'estados');
    await setDoc(
      estadoDocRef,
      {
        estados: {
          [siloId]: estado
        },
        [`estado_${siloId.replace(/\s+/g, '_')}`]: estado,
        updatedAt: new Date().toISOString(),
        updatedBy: usuarioNombre || 'Operador'
      },
      { merge: true }
    );
  } catch (error) {
    console.error('Error al persistir estado de silo en Firestore:', error);
    throw error;
  }
}

/**
 * Guardar/Actualizar el mapa completo de estados de silos en Firestore.
 */
export async function guardarSilosEstadoMapFirestore(
  estadosMap: SilosEstadoMap,
  usuarioNombre?: string
): Promise<void> {
  try {
    const estadoDocRef = doc(db, 'silos_estado', 'estados');
    await setDoc(
      estadoDocRef,
      {
        estados: estadosMap,
        updatedAt: new Date().toISOString(),
        updatedBy: usuarioNombre || 'Operador'
      },
      { merge: true }
    );
  } catch (error) {
    console.error('Error al persistir mapa de estados de silos en Firestore:', error);
    throw error;
  }
}

/**
 * Seed inicial de Catálogos de Planta (Clientes, Especies, Variedades, Tipos, Categorías, Tratamientos) en Firestore.
 */
export async function seedPlantaConfigIfEmpty(initialConfig?: PlantaConfig): Promise<void> {
  try {
    const configDocRef = doc(db, 'configuracion_planta', 'catalogos');
    const docSnap = await getDoc(configDocRef);
    if (!docSnap.exists()) {
      console.log('Inicializando catálogo de Planta en Firestore...');
      const baseConfig = initialConfig || PLANTA_CONFIG_DEFAULT;
      await setDoc(configDocRef, {
        clientes: baseConfig.clientes,
        especies: baseConfig.especies,
        variedades: baseConfig.variedades,
        variedadesDb: baseConfig.variedadesDb || [],
        tipos: baseConfig.tipos,
        categorias: baseConfig.categorias,
        tratamientos: baseConfig.tratamientos,
        updatedAt: new Date().toISOString(),
        updatedBy: 'Sistema'
      });
      console.log('Inicialización de catálogo de Planta completada con éxito.');
    } else {
      const data = docSnap.data();
      if (Array.isArray(data?.categorias) && data.categorias.some((c: string) => typeof c === 'string' && c.toLowerCase().includes('primera multiplicaci'))) {
        const cleaned = data.categorias.filter((c: string) => typeof c === 'string' && !c.toLowerCase().includes('primera multiplicaci'));
        await setDoc(configDocRef, { categorias: cleaned, updatedAt: new Date().toISOString() }, { merge: true });
        console.log('Categoría primera multiplicación removida de Firestore catalogos.');
      }
    }
  } catch (error) {
    console.warn('Error en inicialización de catálogo de Planta:', error);
  }
}

/**
 * Guardar o actualizar la configuración completa de catálogos de Planta en Firestore.
 */
export async function guardarPlantaConfigFirestore(
  config: PlantaConfig,
  usuarioNombre?: string
): Promise<void> {
  try {
    const configDocRef = doc(db, 'configuracion_planta', 'catalogos');
    await setDoc(
      configDocRef,
      {
        clientes: config.clientes || [],
        especies: config.especies || [],
        variedades: config.variedades || [],
        variedadesDb: config.variedadesDb || [],
        tipos: config.tipos || [],
        categorias: config.categorias || [],
        tratamientos: config.tratamientos || [],
        updatedAt: new Date().toISOString(),
        updatedBy: usuarioNombre || 'Operador de Planta'
      },
      { merge: true }
    );
  } catch (error) {
    console.error('Error al persistir catálogo de Planta en Firestore:', error);
    throw error;
  }
}




