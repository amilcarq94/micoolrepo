/**
 * Utilidades para compresión y optimización de imágenes en cliente.
 * Garantiza que las fotografías capturadas desde cámaras móviles o seleccionadas
 * desde el disco no excedan los límites de tamaño de Firestore (1 MB por documento)
 * ni saturen el ancho de banda al interactuar con Firebase Storage.
 */

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeBytes?: number; // Límite deseado en bytes del resultado base64 (ej. 250 KB)
}

const DEFAULT_OPTIONS: Required<CompressOptions> = {
  maxWidth: 1280,
  maxHeight: 1280,
  quality: 0.7,
  maxSizeBytes: 260 * 1024 // ~260 KB (muy por debajo del límite de 1 MB de Firestore)
};

/**
 * Comprime un archivo File o Blob de imagen a una cadena Base64 optimizada (Data URL JPEG).
 */
export async function compressImageFile(
  file: File | Blob,
  options?: CompressOptions
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Si no es imagen (ej. PDF), leerlo directamente como data URL
  if (file.type && !file.type.startsWith('image/')) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result;
      if (typeof dataUrl !== 'string') {
        return reject(new Error('No se pudo leer el archivo'));
      }
      try {
        const compressed = await compressDataUrl(dataUrl, opts);
        resolve(compressed);
      } catch (err) {
        console.warn('Error durante compresión de imagen, usando versión original:', err);
        resolve(dataUrl);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Comprime una cadena Data URL de imagen redimensionando y ajustando la calidad JPEG
 * asegurando que el tamaño en memoria sea apto para almacenamiento (< 260 KB).
 */
export async function compressDataUrl(
  dataUrl: string,
  options?: CompressOptions
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (!dataUrl || !dataUrl.startsWith('data:image/')) {
    return dataUrl;
  }

  // Si la imagen ya es pequeña (ej. firma SVG/PNG de menos de 100 KB), retornar directo
  if (dataUrl.length < 120 * 1024) {
    return dataUrl;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (!width || !height) {
          return resolve(dataUrl);
        }

        // Calcular escalado proporcional respetando maxWidth y maxHeight
        let targetWidth = width;
        let targetHeight = height;

        if (targetWidth > opts.maxWidth || targetHeight > opts.maxHeight) {
          const ratio = Math.min(opts.maxWidth / targetWidth, opts.maxHeight / targetHeight);
          targetWidth = Math.round(targetWidth * ratio);
          targetHeight = Math.round(targetHeight * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          return resolve(dataUrl);
        }

        // Fondo blanco para imágenes con transparencia antes de convertir a JPEG
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetWidth, targetHeight);

        // Dibujar imagen escalada
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        // Primer intento con calidad estándar
        let currentQuality = opts.quality;
        let outputDataUrl = canvas.toDataURL('image/jpeg', currentQuality);

        // Si todavía supera el límite deseado (ej. fotos complejas de documentos), reducir calidad
        if (outputDataUrl.length > opts.maxSizeBytes) {
          currentQuality = 0.52;
          outputDataUrl = canvas.toDataURL('image/jpeg', currentQuality);
        }

        // Si aún sigue por encima, escalar a 850px max y calidad 0.45
        if (outputDataUrl.length > opts.maxSizeBytes && (targetWidth > 850 || targetHeight > 850)) {
          const secondaryCanvas = document.createElement('canvas');
          const secondaryRatio = Math.min(850 / targetWidth, 850 / targetHeight);
          secondaryCanvas.width = Math.round(targetWidth * secondaryRatio);
          secondaryCanvas.height = Math.round(targetHeight * secondaryRatio);
          const sCtx = secondaryCanvas.getContext('2d');
          if (sCtx) {
            sCtx.fillStyle = '#FFFFFF';
            sCtx.fillRect(0, 0, secondaryCanvas.width, secondaryCanvas.height);
            sCtx.drawImage(canvas, 0, 0, secondaryCanvas.width, secondaryCanvas.height);
            outputDataUrl = secondaryCanvas.toDataURL('image/jpeg', 0.45);
          }
        }

        resolve(outputDataUrl);
      } catch (e) {
        console.warn('Fallo al renderizar canvas para compresión:', e);
        resolve(dataUrl);
      }
    };

    img.onerror = () => {
      console.warn('Error al cargar imagen en memoria para compresión.');
      resolve(dataUrl);
    };

    img.src = dataUrl;
  });
}
