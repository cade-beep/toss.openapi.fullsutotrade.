'use client';

import React from 'react';
import { useWorkstation } from '@/lib/context/workstation-context';

export default function MarketChartPanel() {
  const { activeTicker } = useWorkstation();

  const changeColor = activeTicker.change > 0 ? 'text-emerald-400' : activeTicker.change < 0 ? 'text-rose-400' : 'text-zinc-500';

  return (
    <div className="flex flex-col flex-1 bg-zinc-950 border border-zinc-800 rounded p-3 overflow-hidden min-h-[300px] select-none">
      <div className="flex items-center justify-between border-b border-zinc-900 pb-2 shrink-0">
        <div className="flex items-baseline gap-2">
          <span className="text-base font-bold text-white">{activeTicker.name}</span>
          <span className="text-xs text-zinc-500 font-mono">{activeTicker.symbol}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400">KOSPI</span>
        </div>
        
        <div className="flex gap-4 font-mono text-xs">
          <div>
            <span className="text-zinc-500 text-[10px] mr-1">PRICE:</span>
            <span className="text-white font-bold">{activeTicker.price.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-zinc-500 text-[10px] mr-1">HIGH:</span>
            <span className="text-zinc-400">{activeTicker.high.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-zinc-500 text-[10px] mr-1">LOW:</span>
            <span className="text-zinc-400">{activeTicker.low.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-zinc-500 text-[10px] mr-1">CHANGE:</span>
            <span className={`font-bold ${changeColor}`}>
              {activeTicker.change > 0 ? '+' : ''}{activeTicker.change}%
            </span>
          </div>
        </div>
      </div>

      {/* Candlestick / Area SVG Chart */}
      <div className="flex-1 flex flex-col justify-end py-2 relative overflow-hidden bg-black/40 rounded border border-zinc-900/50 mt-2">
        
        {/* Grid Lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-10">
          <div className="w-full h-px bg-white" />
          <div className="w-full h-px bg-white" />
          <div className="w-full h-px bg-white" />
          <div className="w-full h-px bg-white" />
        </div>

        {/* Render dynamic SVG Line chart */}
        <svg className="w-full h-44 overflow-visible px-2" viewBox="0 0 500 200">
          <defs>
            <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.2"/>
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0"/>
            </linearGradient>
          </defs>

          {/* Draw line */}
          {(() => {
            const points = activeTicker.history;
            if (!points || points.length === 0) return null;

            const minVal = Math.min(...points) * 0.999;
            const maxVal = Math.max(...points) * 1.001;
            const range = maxVal - minVal;

            const mapX = (idx: number) => (idx / (points.length - 1)) * 480 + 10;
            const mapY = (val: number) => 180 - ((val - minVal) / range) * 160;

            const linePath = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${mapX(idx)} ${mapY(p)}`).join(' ');
            const areaPath = `${linePath} L ${mapX(points.length - 1)} 200 L ${mapX(0)} 200 Z`;

            return (
              <>
                {/* Area Fill */}
                <path d={areaPath} fill="url(#area-grad)" />
                {/* Line Path */}
                <path d={linePath} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                {/* Dot indicators */}
                {points.map((p, idx) => (
                  <circle
                    key={idx}
                    cx={mapX(idx)}
                    cy={mapY(p)}
                    r="3"
                    fill={idx === points.length - 1 ? '#10b981' : '#18181b'}
                    stroke="#10b981"
                    strokeWidth="1.5"
                  />
                ))}
              </>
            );
          })()}
        </svg>
      </div>
    </div>
  );
}
