/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface OrdenProcesoGaugeProps {
  hechos: number;
  bbPedidos: number;
  size?: number; // size in pixels (default: 110)
  strokeWidth?: number; // default: 10
}

export const OrdenProcesoGauge: React.FC<OrdenProcesoGaugeProps> = ({
  hechos,
  bbPedidos,
  size = 110,
  strokeWidth = 10,
}) => {
  const safePedidos = Math.max(0, bbPedidos);
  const safeHechos = Math.max(0, hechos);
  const percentage = safePedidos > 0 ? Math.round((safeHechos / safePedidos) * 100) : 0;

  // Geometry for SVG arc (270 degree gauge or full 360 ring)
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Cap visual ring fill at 100% for arc length, but text shows true percentage
  const fillRatio = Math.min(1, safePedidos > 0 ? safeHechos / safePedidos : 0);
  const strokeDashoffset = circumference * (1 - fillRatio);

  // Dynamic colors
  let colorClass = 'text-slate-400';
  let strokeColor = '#94a3b8'; // slate-400
  let badgeBg = 'bg-slate-100 text-slate-700';

  if (percentage >= 100) {
    colorClass = 'text-emerald-600';
    strokeColor = '#10b981'; // emerald-500
    badgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (percentage > 0) {
    colorClass = 'text-amber-500';
    strokeColor = '#f59e0b'; // amber-500
    badgeBg = 'bg-amber-50 text-amber-700 border-amber-200';
  } else {
    colorClass = 'text-rose-500';
    strokeColor = '#f43f5e'; // rose-500
    badgeBg = 'bg-rose-50 text-rose-700 border-rose-200';
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            className="text-slate-100"
            strokeWidth={strokeWidth}
            stroke="currentColor"
            fill="transparent"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-700 ease-out"
          />
        </svg>

        {/* Center label */}
        <div className="absolute flex flex-col items-center justify-center text-center p-1">
          <span className={`text-xl font-bold tracking-tight ${colorClass}`}>
            {percentage}%
          </span>
        </div>
      </div>

      {/* Subtitle BB counter badge */}
      <div className={`mt-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeBg} shadow-xs`}>
        {safeHechos} / {safePedidos} BB
      </div>
    </div>
  );
};
