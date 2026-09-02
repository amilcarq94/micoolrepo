/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Lote } from '../types';
import { IdBolsaLabel } from './IdBolsaLabel';

interface IdBolsaPdfPrintProps {
  lote: Lote;
  totalBolsas?: number;
}

export const IdBolsaPdfPrint: React.FC<IdBolsaPdfPrintProps> = ({ lote, totalBolsas }) => {
  const total = totalBolsas || Number(lote.stockBolsas) || Number((lote as any).cantidadBolsas) || 35;
  const LABELS_PER_PAGE = 7;

  // Generar array de bolsas [1, 2, ..., total]
  const bags = Array.from({ length: total }, (_, i) => i + 1);

  // Agrupar en páginas de exactamente 7 etiquetas
  const pages: number[][] = [];
  for (let i = 0; i < bags.length; i += LABELS_PER_PAGE) {
    pages.push(bags.slice(i, i + LABELS_PER_PAGE));
  }

  return (
    <div id="pdf-container" className="pdf-export-wrapper">
      {pages.map((pageBags, pageIndex) => (
        <div 
          key={`page-${pageIndex}`} 
          className="pdf-page-a4"
          style={{
            width: '210mm',
            height: '297mm',
            padding: '8mm 10mm',
            boxSizing: 'border-box',
            backgroundColor: '#ffffff',
            pageBreakAfter: pageIndex === pages.length - 1 ? 'auto' : 'always',
            breakAfter: pageIndex === pages.length - 1 ? 'auto' : 'page',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            gap: '1.5mm',
          }}
        >
          {pageBags.map((bagNum) => (
            <IdBolsaLabel
              key={`bag-${bagNum}`}
              lote={lote}
              bagNumber={bagNum}
              totalBags={total}
            />
          ))}
        </div>
      ))}
    </div>
  );
};
