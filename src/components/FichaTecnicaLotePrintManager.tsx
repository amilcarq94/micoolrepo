/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import {
  Printer,
  Download,
  X,
  FileText,
  Copy,
  Check,
  Sparkles,
  Layers,
  Edit3,
  RefreshCw,
} from 'lucide-react';
import { exportElementAsPdf, exportMultipleElementsAsPdf } from '../utils/exportPdf';
import { printWithActiveClass } from '../utils/printHelper';

/**
 * Estructura de Datos de Entrada (JSON) para Fichas Técnicas de Lote
 */
export interface FichaLoteJSON {
  nombre_lote: string;
  cliente: string;
  variedad: string;
  categoria: string;
  tratamiento: string;
  tipo_lote: string;
  deposito_origen: string;
  bolsa_origen: string;
  ciclo_cultivo: string;
  fecha_cosecha: string;
  ingresos_kg: string | number;
  extraidos_kg: string | number;
  existencias_kg: string | number;
  humedad: string | number;
  calidad: string;
  observaciones: string;
}

export const SAMPLE_FICHAS_LOTES_JSON: FichaLoteJSON[] = [
  {
    nombre_lote: 'LOTE 20 - NORTE',
    cliente: 'AGROPECUARIA SANTA ROSA S.A.',
    variedad: 'DON MARIO 46E21',
    categoria: 'SEMILLA CERTIFICADA',
    tratamiento: 'INOCULADO + FUNGICIDA',
    tipo_lote: 'SOJA DE PRIMERA',
    deposito_origen: 'Lote 20',
    bolsa_origen: 'S29,2',
    ciclo_cultivo: 'Soja Primera',
    fecha_cosecha: '15/04/2026',
    ingresos_kg: '125.400 kg',
    extraidos_kg: '45.200 kg',
    existencias_kg: '80.200 kg',
    humedad: '12,5 %',
    calidad: 'GRADO 1',
    observaciones: 'Monitoreado periódicamente sin desviaciones. Acondicionamiento en silo bolsa hermético con óptima conservación.',
  },
  {
    nombre_lote: 'LOTE 10AB - SUR',
    cliente: 'SAN DIEGO SEMILLA S.A.',
    variedad: 'DM 46i20 IPRO',
    categoria: 'ORIGINAL / FISCALIZADA',
    tratamiento: 'CURADO PROFESIONAL (MAXIM XL)',
    tipo_lote: 'SOJA DE SEGUNDA',
    deposito_origen: 'Lote 10AB',
    bolsa_origen: 'S48,4',
    ciclo_cultivo: 'Soja Segunda',
    fecha_cosecha: '28/04/2026',
    ingresos_kg: '98.600 kg',
    extraidos_kg: '28.000 kg',
    existencias_kg: '70.600 kg',
    humedad: '13,1 %',
    calidad: 'GRADO 1 ESPECIAL',
    observaciones: 'Lote clasificado en zaranda 6.5mm. Poder germinativo certificado superior al 95%.',
  },
  {
    nombre_lote: 'LOTE 04 - ESTE',
    cliente: 'LOS PATOS AGRÍCOLA',
    variedad: 'CASUARINA - BIOINTA',
    categoria: 'FUNDADORA',
    tratamiento: 'SIN TRATAMIENTO QUÍMICO',
    tipo_lote: 'TRIGO CICLO LARGO',
    deposito_origen: 'Lote 04',
    bolsa_origen: 'T12,1',
    ciclo_cultivo: 'Trigo Ciclo Largo',
    fecha_cosecha: '10/12/2025',
    ingresos_kg: '142.000 kg',
    extraidos_kg: '62.000 kg',
    existencias_kg: '80.000 kg',
    humedad: '11,8 %',
    calidad: 'ESTÁNDAR EXPORTACIÓN',
    observaciones: 'Excelente peso hectolítrico (81.5 kg/hl). Destinado a siembra de multiplicación propia.',
  },
];

interface FichaTecnicaLoteCardProps {
  data: FichaLoteJSON;
  index?: number;
  id?: string;
}

/**
 * Componente individual de la Ficha Técnica de Lote para visualización e impresión A4
 * Implementado estrictamente con variables CSS:
 * - var(--app-primary)
 * - var(--app-secondary-bg)
 * - var(--app-text)
 * - var(--app-border)
 */
export const FichaTecnicaLoteCard: React.FC<FichaTecnicaLoteCardProps> = ({
  data,
  index = 0,
  id,
}) => {
  const domId = id || `ficha-lote-a4-${index}`;

  const formatKg = (val: string | number) => {
    if (typeof val === 'number') {
      return `${val.toLocaleString('es-AR')} kg`;
    }
    return String(val);
  };

  const formatHumedad = (val: string | number) => {
    if (typeof val === 'number') {
      return `${val.toFixed(1).replace('.', ',')} %`;
    }
    return String(val);
  };

  return (
    <div
      id={domId}
      className="ficha-lote-a4-sheet seccion-impresion"
      style={{
        boxSizing: 'border-box',
        width: '100%',
        maxWidth: '210mm',
        minHeight: '290mm',
        backgroundColor: '#ffffff',
        color: 'var(--app-text)',
        fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        padding: '12mm 14mm',
        margin: '0 auto 24px auto',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        pageBreakAfter: 'always',
        breakAfter: 'page',
        pageBreakInside: 'avoid',
        breakInside: 'avoid',
        border: '1px solid var(--app-border)',
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.08)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
        {/* =========================================================================
            1. ENCABEZADO CENTRALIZADO
            - Bloque con fondo principal var(--app-primary)
            - Título "FICHA TÉCNICA DE LOTE" en 11pt con letter-spacing: 2px
            - Nombre del Lote centralizado en negrita pesada (26pt)
            - Cliente y Variedad en la parte inferior con fuentes ampliadas (17pt en negrita)
           ========================================================================= */}
        <header
          style={{
            backgroundColor: 'var(--app-primary)',
            color: '#ffffff',
            borderRadius: '12px',
            padding: '20px 24px 18px 24px',
            textAlign: 'center',
            boxShadow: '0 2px 6px rgba(0, 90, 54, 0.25)',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          {/* Subtítulo institucional */}
          <div
            style={{
              fontSize: '11pt',
              fontWeight: 800,
              letterSpacing: '2px',
              textTransform: 'uppercase',
              color: '#fef08a', // Amarillo institucional / oro suave para máximo contraste
              marginBottom: '6px',
              opacity: 0.95,
            }}
          >
            FICHA TÉCNICA DE LOTE
          </div>

          {/* Nombre del Lote en 26pt negrita pesada */}
          <h1
            style={{
              margin: '6px 0 14px 0',
              fontSize: '26pt',
              fontWeight: 900,
              lineHeight: 1.1,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              color: '#ffffff',
            }}
          >
            {data.nombre_lote || 'LOTE SIN DENOMINACIÓN'}
          </h1>

          {/* Barra inferior de Cliente y Variedad en 17pt negrita */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid rgba(255, 255, 255, 0.3)',
              paddingTop: '12px',
              gap: '12px',
            }}
          >
            <div
              style={{
                fontSize: '17pt',
                fontWeight: 800,
                textAlign: 'left',
                color: '#ffffff',
                flex: '1 1 45%',
              }}
            >
              <span style={{ fontSize: '11pt', fontWeight: 600, opacity: 0.85, display: 'block', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Cliente
              </span>
              {data.cliente || '—'}
            </div>

            <div
              style={{
                fontSize: '17pt',
                fontWeight: 800,
                textAlign: 'right',
                color: '#ffffff',
                flex: '1 1 45%',
              }}
            >
              <span style={{ fontSize: '11pt', fontWeight: 600, opacity: 0.85, display: 'block', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Variedad / Híbrido
              </span>
              {data.variedad || '—'}
            </div>
          </div>
        </header>

        {/* =========================================================================
            2. CARDS DESTACADAS (3 COLUMNAS A TODO EL ANCHO)
            - Categoría, Tratamiento y Tipo de Lote / Ciclo del Cultivo
            - Valor en 13.5pt en negrita
           ========================================================================= */}
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            width: '100%',
          }}
        >
          {/* Card 1: Categoría */}
          <div
            style={{
              backgroundColor: 'var(--app-secondary-bg)',
              border: '1.5px solid var(--app-border)',
              borderRadius: '10px',
              padding: '12px 14px',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <span
              style={{
                fontSize: '9pt',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '1px',
                color: 'var(--app-text-muted)',
                marginBottom: '4px',
              }}
            >
              Categoría
            </span>
            <div
              style={{
                fontSize: '13.5pt',
                fontWeight: 800,
                color: 'var(--app-text)',
                lineHeight: 1.2,
              }}
            >
              {data.categoria || '—'}
            </div>
          </div>

          {/* Card 2: Tratamiento */}
          <div
            style={{
              backgroundColor: 'var(--app-secondary-bg)',
              border: '1.5px solid var(--app-border)',
              borderRadius: '10px',
              padding: '12px 14px',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <span
              style={{
                fontSize: '9pt',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '1px',
                color: 'var(--app-text-muted)',
                marginBottom: '4px',
              }}
            >
              Tratamiento
            </span>
            <div
              style={{
                fontSize: '13.5pt',
                fontWeight: 800,
                color: 'var(--app-text)',
                lineHeight: 1.2,
              }}
            >
              {data.tratamiento || 'Sin tratamiento'}
            </div>
          </div>

          {/* Card 3: Tipo de Lote / Ciclo del Cultivo */}
          <div
            style={{
              backgroundColor: 'var(--app-secondary-bg)',
              border: '1.5px solid var(--app-border)',
              borderRadius: '10px',
              padding: '12px 14px',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <span
              style={{
                fontSize: '9pt',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '1px',
                color: 'var(--app-text-muted)',
                marginBottom: '4px',
              }}
            >
              Tipo de Lote / Ciclo
            </span>
            <div
              style={{
                fontSize: '13.5pt',
                fontWeight: 800,
                color: 'var(--app-text)',
                lineHeight: 1.2,
              }}
            >
              {data.tipo_lote || data.ciclo_cultivo || '—'}
            </div>
          </div>
        </section>

        {/* =========================================================================
            3. TABLA: DATOS DE ORIGEN Y REGISTRO
            - Tablas a borde completo con var(--app-border)
           ========================================================================= */}
        <section style={{ width: '100%' }}>
          <div
            style={{
              fontSize: '10pt',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '1.2px',
              color: 'var(--app-primary)',
              marginBottom: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>DATOS DE ORIGEN Y REGISTRO</span>
          </div>

          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '1.5px solid var(--app-border)',
              fontSize: '10.5pt',
            }}
          >
            <tbody>
              <tr>
                <th
                  style={{
                    backgroundColor: 'var(--app-secondary-bg)',
                    border: '1px solid var(--app-border)',
                    padding: '9px 12px',
                    textAlign: 'left',
                    fontWeight: 700,
                    width: '25%',
                    color: 'var(--app-text)',
                  }}
                >
                  Depósito Origen
                </th>
                <td
                  style={{
                    border: '1px solid var(--app-border)',
                    padding: '9px 12px',
                    fontWeight: 600,
                    width: '25%',
                    color: 'var(--app-text)',
                  }}
                >
                  {data.deposito_origen || '—'}
                </td>
                <th
                  style={{
                    backgroundColor: 'var(--app-secondary-bg)',
                    border: '1px solid var(--app-border)',
                    padding: '9px 12px',
                    textAlign: 'left',
                    fontWeight: 700,
                    width: '25%',
                    color: 'var(--app-text)',
                  }}
                >
                  Bolsa Origen Nº
                </th>
                <td
                  style={{
                    border: '1px solid var(--app-border)',
                    padding: '9px 12px',
                    fontWeight: 800,
                    width: '25%',
                    color: 'var(--app-primary)',
                    fontFamily: 'monospace',
                    fontSize: '11.5pt',
                  }}
                >
                  {data.bolsa_origen || '—'}
                </td>
              </tr>
              <tr>
                <th
                  style={{
                    backgroundColor: 'var(--app-secondary-bg)',
                    border: '1px solid var(--app-border)',
                    padding: '9px 12px',
                    textAlign: 'left',
                    fontWeight: 700,
                    color: 'var(--app-text)',
                  }}
                >
                  Ciclo del Cultivo
                </th>
                <td
                  style={{
                    border: '1px solid var(--app-border)',
                    padding: '9px 12px',
                    fontWeight: 600,
                    color: 'var(--app-text)',
                  }}
                >
                  {data.ciclo_cultivo || '—'}
                </td>
                <th
                  style={{
                    backgroundColor: 'var(--app-secondary-bg)',
                    border: '1px solid var(--app-border)',
                    padding: '9px 12px',
                    textAlign: 'left',
                    fontWeight: 700,
                    color: 'var(--app-text)',
                  }}
                >
                  Fecha Cosecha
                </th>
                <td
                  style={{
                    border: '1px solid var(--app-border)',
                    padding: '9px 12px',
                    fontWeight: 700,
                    color: 'var(--app-text)',
                  }}
                >
                  {data.fecha_cosecha || '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* =========================================================================
            4. CONTROL DE STOCK (TARJETAS DE KILOS)
            - 3 tarjetas independientes a todo el ancho
            - Ingresos de Kilos, Kilos Extraídos, Existencias en Silo Bolsa
            - Valores numéricos destacados en fuente 16pt extra negrita
           ========================================================================= */}
        <section style={{ width: '100%' }}>
          <div
            style={{
              fontSize: '10pt',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '1.2px',
              color: 'var(--app-primary)',
              marginBottom: '6px',
            }}
          >
            CONTROL DE STOCK Y EXISTENCIAS
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px',
              width: '100%',
            }}
          >
            {/* Tarjeta 1: Ingresos de Kilos */}
            <div
              style={{
                backgroundColor: 'var(--app-secondary-bg)',
                border: '1.5px solid var(--app-border)',
                borderTop: '4px solid var(--app-primary)',
                borderRadius: '10px',
                padding: '14px 16px',
                boxSizing: 'border-box',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: '9pt',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.8px',
                  color: 'var(--app-text-muted)',
                  marginBottom: '6px',
                }}
              >
                Ingresos de Kilos
              </div>
              <div
                style={{
                  fontSize: '16pt',
                  fontWeight: 900,
                  fontFamily: 'monospace',
                  color: 'var(--app-text)',
                  letterSpacing: '-0.3px',
                }}
              >
                {formatKg(data.ingresos_kg)}
              </div>
              <div style={{ fontSize: '8pt', color: 'var(--app-text-muted)', marginTop: '4px', fontWeight: 500 }}>
                Dato de origen certificado
              </div>
            </div>

            {/* Tarjeta 2: Kilos Extraídos */}
            <div
              style={{
                backgroundColor: 'var(--app-secondary-bg)',
                border: '1.5px solid var(--app-border)',
                borderTop: '4px solid #b45309', // Ámbar intenso
                borderRadius: '10px',
                padding: '14px 16px',
                boxSizing: 'border-box',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: '9pt',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.8px',
                  color: 'var(--app-text-muted)',
                  marginBottom: '6px',
                }}
              >
                Kilos Extraídos
              </div>
              <div
                style={{
                  fontSize: '16pt',
                  fontWeight: 900,
                  fontFamily: 'monospace',
                  color: '#9a3412',
                  letterSpacing: '-0.3px',
                }}
              >
                {formatKg(data.extraidos_kg)}
              </div>
              <div style={{ fontSize: '8pt', color: 'var(--app-text-muted)', marginTop: '4px', fontWeight: 500 }}>
                Total despachado / procesado
              </div>
            </div>

            {/* Tarjeta 3: Existencias en Silo Bolsa */}
            <div
              style={{
                backgroundColor: 'var(--app-primary-light)',
                border: '1.5px solid var(--app-primary)',
                borderTop: '4px solid var(--app-primary)',
                borderRadius: '10px',
                padding: '14px 16px',
                boxSizing: 'border-box',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: '9pt',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.8px',
                  color: 'var(--app-primary)',
                  marginBottom: '6px',
                }}
              >
                Existencias en Silo Bolsa
              </div>
              <div
                style={{
                  fontSize: '16pt',
                  fontWeight: 900,
                  fontFamily: 'monospace',
                  color: 'var(--app-primary)',
                  letterSpacing: '-0.3px',
                }}
              >
                {formatKg(data.existencias_kg)}
              </div>
              <div style={{ fontSize: '8pt', color: 'var(--app-primary)', marginTop: '4px', fontWeight: 700 }}>
                Saldo actual en campo
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            5. TABLA: PARÁMETROS DE CALIDAD Y OBSERVACIONES
            - Tablas a borde completo
           ========================================================================= */}
        <section style={{ width: '100%' }}>
          <div
            style={{
              fontSize: '10pt',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '1.2px',
              color: 'var(--app-primary)',
              marginBottom: '6px',
            }}
          >
            PARÁMETROS DE CALIDAD Y OBSERVACIONES
          </div>

          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '1.5px solid var(--app-border)',
              fontSize: '10.5pt',
            }}
          >
            <tbody>
              <tr>
                <th
                  style={{
                    backgroundColor: 'var(--app-secondary-bg)',
                    border: '1px solid var(--app-border)',
                    padding: '9px 12px',
                    textAlign: 'left',
                    fontWeight: 700,
                    width: '25%',
                    color: 'var(--app-text)',
                  }}
                >
                  Humedad en Grano
                </th>
                <td
                  style={{
                    border: '1px solid var(--app-border)',
                    padding: '9px 12px',
                    fontWeight: 800,
                    width: '25%',
                    color: 'var(--app-text)',
                  }}
                >
                  {formatHumedad(data.humedad)}
                </td>
                <th
                  style={{
                    backgroundColor: 'var(--app-secondary-bg)',
                    border: '1px solid var(--app-border)',
                    padding: '9px 12px',
                    textAlign: 'left',
                    fontWeight: 700,
                    width: '25%',
                    color: 'var(--app-text)',
                  }}
                >
                  Calidad Comercial
                </th>
                <td
                  style={{
                    border: '1px solid var(--app-border)',
                    padding: '9px 12px',
                    fontWeight: 800,
                    width: '25%',
                    color: 'var(--app-primary)',
                  }}
                >
                  {data.calidad || 'GRADO 1'}
                </td>
              </tr>
              <tr>
                <th
                  style={{
                    backgroundColor: 'var(--app-secondary-bg)',
                    border: '1px solid var(--app-border)',
                    padding: '10px 12px',
                    textAlign: 'left',
                    fontWeight: 700,
                    verticalAlign: 'top',
                    color: 'var(--app-text)',
                  }}
                >
                  Observaciones Técnicas
                </th>
                <td
                  colSpan={3}
                  style={{
                    border: '1px solid var(--app-border)',
                    padding: '10px 12px',
                    fontWeight: 500,
                    fontSize: '10pt',
                    lineHeight: 1.45,
                    color: 'var(--app-text)',
                    fontStyle: 'italic',
                  }}
                >
                  {data.observaciones || 'Sin observaciones registradas al momento de la emisión.'}
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>

      {/* =========================================================================
          6. PIE DE PÁGINA INSTITUCIONAL / FIRMA Y FECHA
         ========================================================================= */}
      <footer
        style={{
          borderTop: '1px solid var(--app-border)',
          paddingTop: '10px',
          marginTop: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          fontSize: '8.5pt',
          color: 'var(--app-text-muted)',
          width: '100%',
        }}
      >
        <div>
          <span style={{ fontWeight: 700, color: 'var(--app-primary)' }}>SISTEMA DE GESTIÓN AGRÍCOLA</span> · Planta Clasificadora
          <br />
          Emisión Oficial de Ficha Técnica de Lote · Documento válido para auditoría interna y trazabilidad.
        </div>

        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
          <div style={{ width: '140px', borderTop: '1px solid var(--app-border)', marginBottom: '2px' }} />
          <span style={{ fontWeight: 600 }}>Firma y Sello Responsable Técnico</span>
          <span style={{ fontSize: '8pt', fontFamily: 'monospace' }}>
            Fecha de impresión: {new Date().toLocaleDateString('es-AR')}
          </span>
        </div>
      </footer>
    </div>
  );
};

interface FichaTecnicaLoteViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  fichasData?: FichaLoteJSON[];
  autoLaunchPrint?: boolean;
}

/**
 * Modal Completo de Vista Previa, Edición JSON e Impresión Múltiple A4
 */
export const FichaTecnicaLoteViewerModal: React.FC<FichaTecnicaLoteViewerModalProps> = ({
  isOpen,
  onClose,
  fichasData = SAMPLE_FICHAS_LOTES_JSON,
  autoLaunchPrint = false,
}) => {
  const [fichas, setFichas] = useState<FichaLoteJSON[]>(fichasData);
  const [jsonInputText, setJsonInputText] = useState<string>(
    JSON.stringify(fichasData, null, 2)
  );
  const [isEditJsonMode, setIsEditJsonMode] = useState(false);
  const [jsonParseError, setJsonParseError] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [copyJsonSuccess, setCopyJsonSuccess] = useState(false);

  React.useEffect(() => {
    if (fichasData && fichasData.length > 0) {
      setFichas(fichasData);
      setJsonInputText(JSON.stringify(fichasData, null, 2));
    }
  }, [fichasData]);

  React.useEffect(() => {
    let mounted = true;
    if (isOpen && fichas.length > 0 && autoLaunchPrint) {
      (async () => {
        if (mounted) {
          await printWithActiveClass('printable-fichas-manager-container');
        }
      })();
    }
    return () => {
      mounted = false;
    };
  }, [isOpen, fichas, autoLaunchPrint]);

  if (!isOpen) return null;

  const handlePrintAll = async () => {
    await printWithActiveClass('printable-fichas-manager-container');
  };

  const handleDownloadAllPdf = async () => {
    try {
      setIsExportingPdf(true);
      const elementIds = fichas.map((_, i) => `ficha-lote-a4-sheet-${i}`);
      const filename = `Fichas_Tecnicas_Lotes_${fichas.length}_Hojas_${new Date().toISOString().slice(0, 10)}.pdf`;

      await exportMultipleElementsAsPdf(
        elementIds,
        filename,
        { scale: 2.0, quality: 0.98, margin: [10, 12, 10, 12] }
      );
    } catch (err) {
      console.error('Error al exportar PDF consolidado:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleApplyJson = () => {
    try {
      setJsonParseError(null);
      const parsed = JSON.parse(jsonInputText);
      if (!Array.isArray(parsed)) {
        throw new Error('El JSON debe ser un arreglo [ ... ] de objetos de ficha.');
      }
      setFichas(parsed);
      setIsEditJsonMode(false);
    } catch (err: any) {
      setJsonParseError(err.message || 'Error de sintaxis JSON');
    }
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(jsonInputText);
    setCopyJsonSuccess(true);
    setTimeout(() => setCopyJsonSuccess(false), 2000);
  };

  const handleResetSampleData = () => {
    setFichas(SAMPLE_FICHAS_LOTES_JSON);
    setJsonInputText(JSON.stringify(SAMPLE_FICHAS_LOTES_JSON, null, 2));
    setJsonParseError(null);
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-start p-3 sm:p-6 print:p-0 print:bg-transparent print:static print:inset-auto print:z-auto">
      {/* 1. BARRA FLOTANTE DE CONTROL SUPERIOR (OCULTA AL IMPRIMIR) */}
      <div className="w-full max-w-5xl bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 mb-6 sticky top-2 z-50 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#005A36] rounded-xl text-white shadow-xs border border-emerald-500/30">
            <Layers className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <h3 className="font-bold text-sm tracking-wide uppercase text-white flex items-center gap-2">
              <span>Fichas Técnicas de Lotes — Vista Previa e Impresión A4</span>
              <span className="bg-emerald-500 text-slate-950 text-[10px] font-black font-mono px-2 py-0.5 rounded-full">
                {fichas.length} {fichas.length === 1 ? 'Lote' : 'Lotes'}
              </span>
            </h3>
            <p className="text-xs text-slate-300">
              Formato de 1 página A4 por ficha con variables CSS dinámicas y paginación continua.
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setIsEditJsonMode(!isEditJsonMode)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition cursor-pointer ${
              isEditJsonMode
                ? 'bg-amber-500 text-slate-950 border-amber-400'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{isEditJsonMode ? 'Ver Vista Previa' : 'Editar JSON'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrintAll}
            className="flex items-center gap-2 px-4 py-2 bg-[#005A36] hover:bg-[#004227] text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md transition cursor-pointer border border-emerald-500/40 active:scale-95"
          >
            <Printer className="w-4 h-4 text-amber-300" />
            <span>Imprimir ({fichas.length})</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadAllPdf}
            disabled={isExportingPdf}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-800 to-red-700 hover:from-red-700 hover:to-red-600 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl border border-red-500/40 shadow-sm transition cursor-pointer disabled:opacity-50 active:scale-95"
          >
            <Download className="w-4 h-4 text-amber-300" />
            <span>{isExportingPdf ? 'Generando PDF...' : 'Descargar PDF A4'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition cursor-pointer"
            title="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. PANEL DE EDICIÓN JSON (SI ESTÁ ACTIVO) */}
      {isEditJsonMode && (
        <div className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6 text-white print:hidden shadow-xl">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-sm text-emerald-400">Editor de Datos JSON de Entrada</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyJson}
                className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition"
              >
                {copyJsonSuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copyJsonSuccess ? 'Copiado' : 'Copiar JSON'}</span>
              </button>

              <button
                type="button"
                onClick={handleResetSampleData}
                className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition"
              >
                <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                <span>Restaurar Ejemplo</span>
              </button>
            </div>
          </div>

          <textarea
            rows={12}
            value={jsonInputText}
            onChange={(e) => setJsonInputText(e.target.value)}
            className="w-full p-3.5 font-mono text-xs bg-slate-950 text-emerald-300 border border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
            spellCheck={false}
          />

          {jsonParseError && (
            <div className="p-3 mt-3 bg-red-950/80 border border-red-800 text-red-200 text-xs rounded-xl font-mono">
              <strong>Error en JSON:</strong> {jsonParseError}
            </div>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditJsonMode(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleApplyJson}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-md"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Aplicar y Actualizar Fichas</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. CONTENEDOR DE FICHAS RENDERIZADAS */}
      <div id="printable-fichas-manager-container" className="w-full flex flex-col items-center gap-8 print:gap-0 print:block">
        {fichas.map((fichaData, idx) => (
          <div
            key={idx}
            className="print:break-after-page print:page-break-after-always"
          >
            <FichaTecnicaLoteCard
              data={fichaData}
              index={idx}
              id={`ficha-lote-a4-sheet-${idx}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
