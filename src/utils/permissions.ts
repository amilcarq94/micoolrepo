/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole =
  | 'Operario'
  | 'Operario de Planta'
  | 'Despachante'
  | 'Administración'
  | 'Logística'
  | 'Gerencia'
  | 'Jefe de Planta'
  | 'Visitante'
  | string;

/**
 * Normaliza y clasifica los roles de usuario en 3 niveles de acceso principales:
 * - 'GERENCIA': Máximo nivel (Jefe de Planta, Gerencia, Dirección)
 * - 'ADMINISTRACION': Nivel medio (Logística, Administración, Control de Calidad)
 * - 'OPERARIO': Nivel operativo (Despachante, Operario de Planta, Balanza)
 */
export function getStandardRoleLevel(role?: string): 'GERENCIA' | 'ADMINISTRACION' | 'OPERARIO' {
  if (!role) return 'OPERARIO';
  const r = role.toLowerCase().trim();

  if (r.includes('jefe') || r.includes('geren') || r.includes('director') || r.includes('admin master')) {
    return 'GERENCIA';
  }

  if (r.includes('log') || r.includes('admin') || r.includes('supervis') || r.includes('calidad')) {
    return 'ADMINISTRACION';
  }

  return 'OPERARIO';
}

/**
 * Solo Administración y Gerencia pueden editar ingresos/egresos ya cargados.
 */
export function canEditIngresoEgreso(role?: string): boolean {
  const level = getStandardRoleLevel(role);
  return level === 'GERENCIA' || level === 'ADMINISTRACION';
}

/**
 * Solo Administración y Gerencia pueden ejecutar "Descarte" o "Rechazo".
 */
export function canExecuteDescarte(role?: string): boolean {
  const level = getStandardRoleLevel(role);
  return level === 'GERENCIA' || level === 'ADMINISTRACION';
}

/**
 * Solo Administración y Gerencia pueden ejecutar "Limpieza Varietal" o "Descontaminación".
 */
export function canExecuteLimpiezaVarietal(role?: string): boolean {
  const level = getStandardRoleLevel(role);
  return level === 'GERENCIA' || level === 'ADMINISTRACION';
}

/**
 * Solo Administración y Gerencia pueden poner un Silo en 0 (Ajuste a Cero).
 */
export function canAjustarCeroSilo(role?: string): boolean {
  const level = getStandardRoleLevel(role);
  return level === 'GERENCIA' || level === 'ADMINISTRACION';
}

/**
 * Solo Gerencia puede realizar vaciado completo de la base de datos o borrados masivos críticos.
 */
export function canWipeData(role?: string): boolean {
  const level = getStandardRoleLevel(role);
  return level === 'GERENCIA';
}

/**
 * Permisos para configurar límites globales de lote y alertas de silo.
 */
export function canConfigureLimits(role?: string): boolean {
  const level = getStandardRoleLevel(role);
  return level === 'GERENCIA' || level === 'ADMINISTRACION';
}

/**
 * Permisos para registrar arqueos y discrepancias de stock físico vs teórico.
 */
export function canManageDiscrepancias(role?: string): boolean {
  const level = getStandardRoleLevel(role);
  return level === 'GERENCIA' || level === 'ADMINISTRACION';
}

/**
 * Retorna las clases de estilo para el badge visual del rol.
 */
export function getRoleBadgeStyle(role?: string): { bg: string; text: string; label: string } {
  const level = getStandardRoleLevel(role);
  switch (level) {
    case 'GERENCIA':
      return {
        bg: 'bg-[#C9922E]/15 border-[#C9922E]/30',
        text: 'text-[#C9922E]',
        label: role || 'Gerencia'
      };
    case 'ADMINISTRACION':
      return {
        bg: 'bg-[#00603C]/15 border-[#00603C]/30',
        text: 'text-[#00603C]',
        label: role || 'Administración'
      };
    default:
      return {
        bg: 'bg-blue-50 border-blue-200',
        text: 'text-blue-700',
        label: role || 'Operario'
      };
  }
}
