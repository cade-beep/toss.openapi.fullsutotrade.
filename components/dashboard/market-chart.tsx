'use client';

import React from 'react';
import { useWorkstation } from '@/lib/context/workstation-context';

export default function MarketChartPanel() {
  const { activeTicker, isApiConnected } = useWorkstation();

  if (!isApiConnected) {
    return (
      <div className="flex flex-col h-[220px] shrink-0 bg-zinc-950 border border-zinc-900 rounded p-2.5 overflow-hidden select-none">
        <div className="flex items-center justify-between border-b border-zinc-900/60 pb-1.5 shrink-0">
          <span className="text-sm font-bold text-zinc-550 font-sans">Market Chart</span>
          <span className="text-[8px] px-1.5 py-0.5 bg-rose-950/40 border border-rose-900/35 text-rose-400 rounded leading-none font-bold uppercase font-sans animate-pulse">
            API Not Connected
          </span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
          <svg className="w-7 h-7 text-rose-500/40 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
          </svg>
          <span className="text-xs text-zinc-400 font-semibold font-sans">Live Market Data Required</span>
          <span className="text-[10px] text-zinc-550 max-w-xs mt-1 font-sans">A successful broker API connection is required before live market charts and ticker data can be initialized.</span>
        </div>
      </div>
    );
  }

  const isUp = activeTicker.change >= 0;
  const strokeColor = isUp ? '#00d287' : '#f43f5e'; // premium emerald-green or rose-red
  const changeColor = activeTicker.change > 0 ? 'text-emerald-400' : activeTicker.change < 0 ? 'text-rose-400' : 'text-zinc-500';
  const gradId = `area-grad-${activeTicker.symbol}`;

  return (
    <div className="flex flex-col h-[220px] shrink-0 bg-zinc-950 border border-zinc-900 rounded p-2.5 overflow-hidden select-none">
      <div className="flex items-center justify-between border-b border-zinc-900/60 pb-1.5 shrink-0">
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-bold text-white leading-none">{activeTicker.name}</span>
          <span className="text-[10px] text-zinc-500 font-mono leading-none">{activeTicker.symbol}</span>
          <span className="text-[9px] px-1 py-0.2 rounded bg-zinc-900 text-zinc-500 font-medium font-sans">KOSPI</span>
        </div>
        
        <div className="flex gap-3 font-mono text-[11px] leading-none">
          <div>
            <span className="text-zinc-600 text-[9px] mr-0.5">PRICE:</span>
            <span className="text-white font-bold">{activeTicker.price.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-zinc-600 text-[9px] mr-0.5">HIGH:</span>
            <span className="text-zinc-400">{activeTicker.high.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-zinc-600 text-[9px] mr-0.5">LOW:</span>
            <span className="text-zinc-400">{activeTicker.low.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-zinc-600 text-[9px] mr-0.5">CHANGE:</span>
            <span className={`font-bold ${changeColor}`}>
              {activeTicker.change > 0 ? '+' : ''}{activeTicker.change}%
            </span>
          </div>
        </div>
      </div>

      {/* Candlestick / Area SVG Chart */}
      <div className="flex-1 flex flex-col justify-end py-1 relative overflow-hidden bg-black/30 rounded border border-zinc-900/40 mt-1.5">
        
        {/* Grid Lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-5">
          <div className="w-full h-px bg-white" />
          <div className="w-full h-px bg-white" />
          <div className="w-full h-px bg-white" />
          <div className="w-full h-px bg-white" />
        </div>

        {/* Render dynamic SVG Line chart */}
        <svg className="w-full h-28 overflow-visible px-2" viewBox="0 0 500 200">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.15"/>
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0"/>
            </linearGradient>
          </defs>

          {/* Draw line */}
          {(() => {
            const points = activeTicker.history;
            if (!points || points.length === 0) return null;

            const minVal = Math.min(...points) * 0.9995;
            const maxVal = Math.max(...points) * 1.0005;
            const range = maxVal - minVal || 1;

            const mapX = (idx: number) => (idx / (points.length - 1)) * 480 + 10;
            const mapY = (val: number) => 180 - ((val - minVal) / range) * 160;

            const linePath = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${mapX(idx)} ${mapY(p)}`).join(' ');
            const areaPath = `${linePath} L ${mapX(points.length - 1)} 200 L ${mapX(0)} 200 Z`;

            return (
              <>
                {/* Area Fill */}
                <path d={areaPath} fill={`url(#${gradId})`} />
                {/* Line Path */}
                <path d={linePath} fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                {/* Dot indicators */}
                {points.map((p, idx) => (
                  <circle
                    key={idx}
                    cx={mapX(idx)}
                    cy={mapY(p)}
                    r="2.5"
                    fill={idx === points.length - 1 ? strokeColor : '#18181b'}
                    stroke={strokeColor}
                    strokeWidth="1.2"
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
