/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Dispara la impresión nativa del navegador (window.print()) aislando de forma
 * exclusiva el elemento especificado mediante la clase temporal 'print-active'.
 * 
 * En conjunto con las reglas `@media print` en `index.css`:
 * 1. Aplica la clase 'print-active' al contenedor objetivo y 'has-print-active' al <body>.
 * 2. Oculta selectivamente todo el resto del árbol DOM.
 * 3. Remueve automáticamente las clases temporales al finalizar o cancelar la impresión.
 *
 * @param targetElementOrSelector Elemento DOM o selector/ID del elemento a imprimir.
 */
export async function printWithActiveClass(
  targetElementOrSelector: HTMLElement | string
): Promise<void> {
  let target: HTMLElement | null = null;

  if (typeof targetElementOrSelector === 'string') {
    target =
      (document.querySelector(targetElementOrSelector) as HTMLElement) ||
      document.getElementById(targetElementOrSelector) ||
      document.getElementById(targetElementOrSelector.replace(/^#/, ''));
  } else {
    target = targetElementOrSelector;
  }

  if (!target) {
    console.warn(`[printWithActiveClass] No se encontró el elemento: ${targetElementOrSelector}`);
    window.print();
    return;
  }

  // 1. Añadir la clase temporal 'print-active' al elemento y 'has-print-active' al body
  target.classList.add('print-active');
  document.body.classList.add('has-print-active');

  // 2. Aguardar a que las fuentes y estilos estén completamente calculados
  try {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));
  } catch {
    // Si falla la sincronización de fuentes, continuar con la impresión
  }

  // 3. Función de limpieza
  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    target?.classList.remove('print-active');
    document.body.classList.remove('has-print-active');
    window.removeEventListener('afterprint', cleanup);
  };

  // 4. Registrar evento afterprint para limpiar inmediatamente tras cerrar el diálogo
  window.addEventListener('afterprint', cleanup);

  // 5. Invocar el cuadro de diálogo de impresión
  try {
    window.print();
  } finally {
    // Temporizador de respaldo para navegadores que no disparen afterprint
    setTimeout(cleanup, 1200);
  }
}
