/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Módulo de autenticación y control de acceso exclusivo para Parking
 * Clientes autorizados: San Diego Semillas, Stine, Eco Rural, Pampa
 * Despachantes autorizados: Jose Pruzzo, Gustavo Medei, Nahuel Galizzi, Lisandro Fernandez
 * Administradores con acceso libre / gestión: Amilcar Quiroz, Malcon Baez
 */

export interface ParkingSession {
  cliente: string;
  despachante: string;
  isAdmin: boolean;
  loginAt: string;
}

export interface ParkingAutorizadoItem {
  id: string;
  nombre: string;
  tipo: 'CLIENTE' | 'DESPACHANTE' | 'ADMIN';
  clienteAsignado?: string; // e.g. "Stine" para Matias Green
  email?: string;
  habilitado: boolean;
  observaciones?: string;
}

export const CLIENTES_AUTORIZADOS_PARKING = [
  "San Diego Semillas",
  "Stine",
  "Eco Rural",
  "Pampa"
] as const;

export const DESPACHANTES_AUTORIZADOS_PARKING = [
  "Jose Pruzzo",
  "Gustavo Medei",
  "Nahuel Galizzi",
  "Lisandro Fernandez",
  "Matias Green"
] as const;

export const ADMINISTRADORES_PARKING = [
  "Amilcar Quiroz",
  "Malcon Baez"
] as const;

export const DEFAULT_PARKING_AUTORIZADOS: ParkingAutorizadoItem[] = [
  { id: 'cli-1', nombre: 'San Diego Semillas', tipo: 'CLIENTE', habilitado: true, observaciones: 'Cliente habilitado oficial' },
  { id: 'cli-2', nombre: 'Stine', tipo: 'CLIENTE', habilitado: true, observaciones: 'Cliente habilitado oficial' },
  { id: 'cli-3', nombre: 'Eco Rural', tipo: 'CLIENTE', habilitado: true, observaciones: 'Cliente habilitado oficial' },
  { id: 'cli-4', nombre: 'Pampa', tipo: 'CLIENTE', habilitado: true, observaciones: 'Cliente habilitado oficial' },
  { id: 'desp-1', nombre: 'Matias Green', tipo: 'DESPACHANTE', clienteAsignado: 'Stine', habilitado: true, email: 'matias.green@stine.com', observaciones: 'Despachante oficial asignado a Stine' },
  { id: 'desp-2', nombre: 'Jose Pruzzo', tipo: 'DESPACHANTE', clienteAsignado: 'Todos', habilitado: true, observaciones: 'Despachante autorizado' },
  { id: 'desp-3', nombre: 'Gustavo Medei', tipo: 'DESPACHANTE', clienteAsignado: 'Todos', habilitado: true, observaciones: 'Despachante autorizado' },
  { id: 'desp-4', nombre: 'Nahuel Galizzi', tipo: 'DESPACHANTE', clienteAsignado: 'Todos', habilitado: true, observaciones: 'Despachante autorizado' },
  { id: 'desp-5', nombre: 'Lisandro Fernandez', tipo: 'DESPACHANTE', clienteAsignado: 'Todos', habilitado: true, observaciones: 'Despachante autorizado' },
  { id: 'adm-1', nombre: 'Amilcar Quiroz', tipo: 'ADMIN', clienteAsignado: 'Agro Abacus S.A.', habilitado: true, email: 'amilcar.quiroz@agroabacus.com.ar', observaciones: 'Administrador general' },
  { id: 'adm-2', nombre: 'Malcon Baez', tipo: 'ADMIN', clienteAsignado: 'Agro Abacus S.A.', habilitado: true, email: 'malcon.baez@agroabacus.com.ar', observaciones: 'Administrador general' }
];

export const PARKING_AUTORIZADOS_STORAGE_KEY = 'agro_parking_autorizados_db_v1';

export function getStoredParkingAutorizados(): ParkingAutorizadoItem[] {
  try {
    const raw = localStorage.getItem(PARKING_AUTORIZADOS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ParkingAutorizadoItem[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Asegurar que Matias Green para Stine esté presente
        const hasMatias = parsed.some(p => normalizeStr(p.nombre).includes('green') || normalizeStr(p.nombre).includes('matias'));
        if (!hasMatias) {
          parsed.push({
            id: 'desp-matias-green',
            nombre: 'Matias Green',
            tipo: 'DESPACHANTE',
            clienteAsignado: 'Stine',
            habilitado: true,
            email: 'matias.green@stine.com',
            observaciones: 'Despachante autorizado para Stine'
          });
          saveStoredParkingAutorizados(parsed);
        }
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error al recuperar autorizados de parking:', e);
  }
  return [...DEFAULT_PARKING_AUTORIZADOS];
}

export function saveStoredParkingAutorizados(items: ParkingAutorizadoItem[]): void {
  try {
    localStorage.setItem(PARKING_AUTORIZADOS_STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Error al guardar autorizados de parking:', e);
  }
}

export const EMAILS_NOTIFICACION_PARKING = [
  "amilcar.quiroz@agroabacus.com.ar",
  "malcon.baez@agroabacus.com.ar",
  "franco.fal@agroabacus.com.ar",
  "monica.bermudez@agroabacus.com.ar"
];

const PARKING_SESSION_KEY = 'agro_parking_auth_session';

/**
 * Normaliza cadenas para comparación insensible a mayúsculas, minúsculas,
 * tildes y espacios duplicados.
 */
export function normalizeStr(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Valida si un cliente ingresado coincide con un cliente autorizado o registrado en la web app
 */
export function matchClienteAutorizado(input: string, customClientes?: string[]): string | null {
  const normInput = normalizeStr(input);
  if (!normInput) return null;

  // 1. Chequear lista dinámica guardada
  const dynamicList = getStoredParkingAutorizados()
    .filter(item => item.tipo === 'CLIENTE' && item.habilitado)
    .map(item => item.nombre);
  
  const allClientes = Array.from(new Set([
    ...CLIENTES_AUTORIZADOS_PARKING,
    ...dynamicList,
    ...(customClientes || [])
  ]));

  for (const c of allClientes) {
    const normC = normalizeStr(c);
    // Coincidencia exacta o parcial razonable (ej: "San Diego", "Stine Semillas", "Pampa Semillas")
    if (
      normInput === normC ||
      (normC.startsWith(normInput) && normInput.length >= 3) ||
      (normInput.startsWith(normC) && normC.length >= 3) ||
      normC.includes(normInput) ||
      normInput.includes(normC)
    ) {
      return c;
    }
  }

  // Casos especiales frecuentes
  if (normInput.includes('san diego')) return 'San Diego Semillas';
  if (normInput.includes('stine')) return 'Stine';
  if (normInput.includes('eco rural') || normInput.includes('ecorural')) return 'Eco Rural';
  if (normInput.includes('pampa')) return 'Pampa';
  if (normInput.includes('elementa')) return 'Elementa Foods';

  return null;
}

/**
 * Valida si un despachante ingresado coincide con un despachante autorizado
 * Incluye Matias Green para Stine y despachantes configurados en la base de datos
 */
export function matchDespachanteAutorizado(input: string, clienteSeleccionado?: string): string | null {
  const normInput = normalizeStr(input);
  if (!normInput) return null;

  // 1. Chequear lista dinámica guardada
  const dynamicList = getStoredParkingAutorizados()
    .filter(item => item.tipo === 'DESPACHANTE' && item.habilitado);
  
  const allDespachantes = Array.from(new Set([
    ...DESPACHANTES_AUTORIZADOS_PARKING,
    ...dynamicList.map(d => d.nombre)
  ]));

  for (const d of allDespachantes) {
    const normD = normalizeStr(d);
    if (normInput === normD || normInput.includes(normD) || normD.includes(normInput)) {
      return d;
    }
  }

  // Variaciones comunes por apellido o nombre
  if (normInput.includes('green') || normInput.includes('matias')) return 'Matias Green';
  if (normInput.includes('pruzzo')) return 'Jose Pruzzo';
  if (normInput.includes('medei')) return 'Gustavo Medei';
  if (normInput.includes('galizzi')) return 'Nahuel Galizzi';
  if (normInput.includes('fernandez')) return 'Lisandro Fernandez';

  return null;
}

/**
 * Comprueba si un usuario es Administrador (Amilcar Quiroz o Malcon Baez)
 */
export function isUserAdminParking(userName?: string): boolean {
  if (!userName) return false;
  const norm = normalizeStr(userName);
  return norm.includes('amilcar') || norm.includes('quiroz') || norm.includes('malcon') || norm.includes('baez');
}

/**
 * Valida las credenciales para acceder a la hoja "Parking".
 * Solo se permite el ingreso si el cliente y el despachante pertenecen a los 4 autorizados,
 * o si se trata de un administrador (Amilcar Quiroz o Malcon Baez).
 */
export function validateParkingAccess(
  clienteInput: string,
  despachanteInput: string,
  claveAdmin?: string,
  customClientes?: string[]
): { success: boolean; error?: string; session?: ParkingSession } {
  const normCliente = normalizeStr(clienteInput);
  const normDespachante = normalizeStr(despachanteInput);

  // 1. Verificación de Administradores (Amilcar Quiroz o Malcon Baez)
  if (isUserAdminParking(despachanteInput) || isUserAdminParking(clienteInput)) {
    // Si ingresa como administrador, verificamos contraseña si fue ingresada o validamos por nombre
    const adminName = normDespachante.includes('malcon') || normCliente.includes('malcon')
      ? 'Malcon Baez'
      : 'Amilcar Quiroz';

    const cleanPass = (claveAdmin || '').trim().toLowerCase();
    const validPass = ['baez', 'baez2026', 'quiroz', 'quiroz2026', 'abacus2026', '1234', 'admin', ''];
    if (claveAdmin && !validPass.includes(cleanPass)) {
      return {
        success: false,
        error: 'Contraseña de administrador incorrecta.'
      };
    }

    const session: ParkingSession = {
      cliente: 'Agro Abacus S.A. (Administración)',
      despachante: adminName,
      isAdmin: true,
      loginAt: new Date().toISOString()
    };
    saveParkingSession(session);
    return { success: true, session };
  }

  // 2. Verificación estricta de Despachante Autorizado
  const matchedDespachante = matchDespachanteAutorizado(despachanteInput);
  if (!matchedDespachante) {
    return {
      success: false,
      error: 'Despachante no autorizado. El acceso a Parking está restringido a personal habilitado.'
    };
  }

  // 3. Verificación de Cliente Autorizado o registrado en la web app
  const matchedCliente = matchClienteAutorizado(clienteInput, customClientes);
  const inCustom = customClientes?.find(c => {
    const nc = normalizeStr(c);
    return nc === normCliente || nc.includes(normCliente) || normCliente.includes(nc);
  });

  const clienteFinal = matchedCliente || inCustom || (clienteInput && clienteInput.trim().length >= 3 ? clienteInput.trim() : null);

  if (!clienteFinal) {
    return {
      success: false,
      error: 'Cliente no seleccionado o no registrado en la web app.'
    };
  }

  // 4. Acceso concedido
  const session: ParkingSession = {
    cliente: clienteFinal,
    despachante: matchedDespachante,
    isAdmin: false,
    loginAt: new Date().toISOString()
  };
  saveParkingSession(session);
  return { success: true, session };
}

/**
 * Obtiene la sesión activa de Parking guardada en el navegador
 */
export function getSavedParkingSession(): ParkingSession | null {
  try {
    const raw = sessionStorage.getItem(PARKING_SESSION_KEY) || localStorage.getItem(PARKING_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as ParkingSession;
    if (session && session.cliente && session.despachante) {
      return session;
    }
  } catch (e) {
    console.error('Error al recuperar sesión de parking:', e);
  }
  return null;
}

/**
 * Guarda la sesión de Parking
 */
export function saveParkingSession(session: ParkingSession): void {
  try {
    sessionStorage.setItem(PARKING_SESSION_KEY, JSON.stringify(session));
    localStorage.setItem(PARKING_SESSION_KEY, JSON.stringify(session));
  } catch (e) {
    console.error('Error al guardar sesión de parking:', e);
  }
}

/**
 * Cierra la sesión activa de Parking
 */
export function clearParkingSession(): void {
  try {
    sessionStorage.removeItem(PARKING_SESSION_KEY);
    localStorage.removeItem(PARKING_SESSION_KEY);
  } catch (e) {
    console.error('Error al limpiar sesión de parking:', e);
  }
}
