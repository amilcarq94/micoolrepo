/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { exportWithHtml2Pdf } from '../utils/exportPdf';

export interface LaborAplicacion {
  fecha: string;
  tipo: string;
  productoDosis: string;
  responsable: string;
}

export interface FichaLoteData {
  id?: string;
  loteNro: string;
  estado?: string;
  establecimiento: string;
  ubicacion: string;
  superficieHa: number | string;
  cultivo: string;
  variedad: string;
  fechaSiembra: string;
  labores: LaborAplicacion[];
  coordenadasGis?: string;
  mapaUrl?: string;
  observacionesTecnicas: string;
  responsableTecnico?: string;
  fechaEmision?: string;
}

export interface FichaLoteA4Props {
  data?: Partial<FichaLoteData>;
  onClose?: () => void;
  isOpen?: boolean;
}

const defaultData: FichaLoteData = {
  loteNro: 'LT-2026-084',
  estado: 'EN PRODUCCIÓN',
  establecimiento: 'La Barrancosa - Sector Norte',
  ubicacion: 'Ruta Pcial. 4, Km 18 - Dpto. Río Cuarto',
  superficieHa: '145.5 Ha',
  cultivo: 'Maní Alto Oleico',
  variedad: 'Granoleico / Runner Plus',
  fechaSiembra: '14/11/2025',
  labores: [
    { fecha: '14/11/2025', tipo: 'Siembra Directa', productoDosis: 'Semilla Fiscalizada (18 sem/m) + Inoculante Bradyrhizobium', responsable: 'Ing. M. Gómez' },
    { fecha: '02/12/2025', tipo: 'Herbicida Post-emergente', productoDosis: 'Imazetapir 1.0 L/ha + Coadyuvante siliconado 150 cc/ha', responsable: 'J. Benítez' },
    { fecha: '15/01/2026', tipo: 'Fungicida Preventivo (Viruela)', productoDosis: 'Azoxistrobina 300 cc/ha + Ciproconazole 150 cc/ha', responsable: 'Ing. M. Gómez' },
    { fecha: '10/02/2026', tipo: 'Monitoreo de Nutrición', productoDosis: 'Boro Foliar 1.5 L/ha + Corrector de pH de agua', responsable: 'M. Peralta' },
  ],
  coordenadasGis: '-33.1245° S, -64.3512° W',
  observacionesTecnicas: 'Excelente stand de plantas con nodulación activa en corona. Condiciones hídricas óptimas. Se recomienda mantener monitoreo semanal preventivo para detección temprana de viruela del maní y orugas defoliadoras.',
  responsableTecnico: 'Ing. Agr. Martín Gómez (Mat. Prof. 8492)',
  fechaEmision: new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
};

export const FichaLoteA4: React.FC<FichaLoteA4Props> = ({
  data,
  onClose,
  isOpen = true,
}) => {
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const fichaRef = useRef<HTMLDivElement>(null);
  const loteNumber = data?.loteNro || 'standard';
  const containerId = `ficha-lote-a4-${loteNumber}`;

  const currentData: FichaLoteData = {
    ...defaultData,
    ...(data || {}),
    labores: data?.labores || defaultData.labores,
  };

  if (!isOpen) return null;

  const handlePrint = async () => {
    try {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
      window.print();
    } catch {
      window.print();
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setIsExportingPdf(true);
      const safeName = (currentData.loteNro || 'Lote').replace(/\s+/g, '_');
      const filename = `Ficha_Lote_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`;
      await exportWithHtml2Pdf(containerId, filename, { scale: 2.0, quality: 0.98, margin: [6, 8, 6, 8] });
    } catch (err) {
      console.error('Error al generar PDF:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-start p-4 md:p-6 print:p-0 print:bg-transparent print:static print:inset-auto print:z-auto">
      {/* 1. BARRA DE ACCIONES SUPERIOR */}
      <div className="actions-bar w-full print:hidden" id="ficha-actions-bar">
        <button
          type="button"
          onClick={handlePrint}
          className="btn btn-secondary"
          id="btn-imprimir-ficha"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Imprimir / Vista Previa
        </button>

        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={isExportingPdf}
          className="btn btn-primary disabled:opacity-50"
          id="btn-descargar-pdf"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {isExportingPdf ? 'Generando PDF...' : 'Descargar PDF'}
        </button>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="btn bg-gray-200 text-gray-800 hover:bg-gray-300"
            id="btn-cerrar-ficha"
          >
            Cerrar
          </button>
        )}
      </div>

      {/* 2. LIENZO A4 FORMAL (210mm x 297mm) */}
      <div
        id="seccion-impresion"
        data-container-id={containerId}
        ref={fichaRef}
        className="ficha-a4 seccion-impresion"
      >
        <div>
          {/* ENCABEZADO */}
          <header className="ficha-header">
            <div className="brand flex items-center gap-3">
              <div className="w-10 h-10 bg-[#2e7d32] rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm">
                🌱
              </div>
              <div>
                <h1 className="font-serif">PLANTA LA BARRANCOSA</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="badge">{currentData.estado}</span>
                  <span className="text-xs text-gray-500 font-mono font-semibold">
                    REG. OFICIAL #{currentData.loteNro}
                  </span>
                </div>
              </div>
            </div>
            <div className="meta-header">
              <p className="font-bold text-gray-800">FICHA TÉCNICA DE LOTE</p>
              <p>Fecha Emisión: {currentData.fechaEmision}</p>
              <p>Sistema: Agro Abacus v2.6</p>
            </div>
          </header>

          {/* SECCIÓN 1: DATOS GENERALES */}
          <section className="ficha-section">
            <div className="section-title">1. Datos Generales del Lote</div>
            <div className="grid-3">
              <div className="data-group">
                <label>Establecimiento</label>
                <p>{currentData.establecimiento}</p>
              </div>
              <div className="data-group">
                <label>Ubicación / Cuartel</label>
                <p>{currentData.ubicacion}</p>
              </div>
              <div className="data-group">
                <label>Superficie Total</label>
                <p className="text-emerald-800 font-bold">{currentData.superficieHa}</p>
              </div>
              <div className="data-group">
                <label>Cultivo Principal</label>
                <p>{currentData.cultivo}</p>
              </div>
              <div className="data-group">
                <label>Variedad / Híbrido</label>
                <p>{currentData.variedad}</p>
              </div>
              <div className="data-group">
                <label>Fecha de Siembra</label>
                <p>{currentData.fechaSiembra}</p>
              </div>
            </div>
          </section>

          {/* SECCIÓN 2: REGISTRO DE LABORES Y APLICACIONES */}
          <section className="ficha-section">
            <div className="section-title">2. Registro de Labores y Aplicaciones</div>
            <table className="ficha-table">
              <thead>
                <tr>
                  <th style={{ width: '15%' }}>Fecha</th>
                  <th style={{ width: '25%' }}>Labor / Manejo</th>
                  <th style={{ width: '42%' }}>Producto / Dosis por Ha</th>
                  <th style={{ width: '18%' }}>Responsable</th>
                </tr>
              </thead>
              <tbody>
                {currentData.labores.map((labor, idx) => (
                  <tr key={idx}>
                    <td className="font-mono text-gray-700">{labor.fecha}</td>
                    <td className="font-semibold text-gray-800">{labor.tipo}</td>
                    <td className="text-gray-700">{labor.productoDosis}</td>
                    <td className="text-gray-600">{labor.responsable}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* SECCIÓN 3: MAPA / CROQUIS GIS Y OBSERVACIONES */}
          <section className="ficha-section">
            <div className="grid-2">
              <div>
                <div className="section-title">3. Croquis / Ubicación GIS</div>
                <div className="map-placeholder">
                  <div className="text-center p-3">
                    <svg className="w-8 h-8 mx-auto text-gray-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    <p className="font-semibold text-gray-700">Georreferenciación Polígono</p>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">{currentData.coordenadasGis}</p>
                  </div>
                </div>
              </div>

              <div>
                <div className="section-title">4. Observaciones Técnicas</div>
                <div className="notes-body h-[150px] overflow-hidden flex flex-col justify-between">
                  <p className="text-gray-800 text-justify">{currentData.observacionesTecnicas}</p>
                  <p className="text-[7.5pt] text-gray-500 italic mt-2">
                    * Registro técnico auditado conforme a Buenas Prácticas Agrícolas (BPA).
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* PIE DE PÁGINA */}
        <footer className="ficha-footer">
          <div>
            <span>Responsable Técnico: </span>
            <strong className="text-gray-700">{currentData.responsableTecnico}</strong>
          </div>
          <div>
            <span>Hoja 1 de 1 &bull; Documento Generado Automáticamente por Agro Abacus</span>
          </div>
        </footer>
      </div>
    </div>
  );
};
