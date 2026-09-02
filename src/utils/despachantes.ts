/**
 * Utility for managing despachantes and authorization
 */

export const INITIAL_DESPACHANTES = [
  "Anibal Grandolio",
  "Cristian Grandolio",
  "Jose Ballarini",
  "Manuel Gomez Riquel",
  "Amilcar Quiroz",
  "Malcon Baez"
];

const LOCAL_STORAGE_KEY = 'agro_custom_despachantes';

export function getListaDespachantes(): string[] {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const custom: string[] = JSON.parse(saved);
      const combined = [...INITIAL_DESPACHANTES];
      custom.forEach(item => {
        if (item && typeof item === 'string' && !combined.includes(item.trim())) {
          combined.push(item.trim());
        }
      });
      return combined;
    }
  } catch (e) {
    console.error('Error al leer despachantes personalizados:', e);
  }
  return [...INITIAL_DESPACHANTES];
}

export function addDespachanteAutorizado(nuevoNombre: string): string[] {
  const nameTrimmed = nuevoNombre.trim();
  if (!nameTrimmed) return getListaDespachantes();

  try {
    const currentCustomStr = localStorage.getItem(LOCAL_STORAGE_KEY);
    const custom: string[] = currentCustomStr ? JSON.parse(currentCustomStr) : [];
    
    // Evitar duplicados case-insensitive
    const existsInInitial = INITIAL_DESPACHANTES.some(d => d.toLowerCase() === nameTrimmed.toLowerCase());
    const existsInCustom = custom.some(d => d.toLowerCase() === nameTrimmed.toLowerCase());

    if (!existsInInitial && !existsInCustom) {
      custom.push(nameTrimmed);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(custom));
    }
  } catch (e) {
    console.error('Error al guardar despachante personalizado:', e);
  }

  return getListaDespachantes();
}

export function verifyAutorizadorPassword(autor: string, clave: string): boolean {
  const cleanPass = clave.trim().toLowerCase();
  const cleanAutor = autor.toLowerCase().trim();

  if (cleanAutor.includes('malcon')) {
    return ['malcon', 'malcon2026', 'abacus2026', '1234', 'malcon123', 'baez'].includes(cleanPass);
  } else if (cleanAutor.includes('amilcar')) {
    return ['amilcar', 'amilcar2026', 'abacus2026', '1234', 'amilcar123', 'quiroz'].includes(cleanPass);
  }
  return false;
}
