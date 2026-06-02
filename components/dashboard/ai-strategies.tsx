'use client';

import React from 'react';
import { useWorkstation } from '@/lib/context/workstation-context';

export default function AIStrategiesPanel() {
  const { strategies, setStrategies, aiSignals, tickers } = useWorkstation();

  return (
    <div className="flex flex-col flex-1 bg-zinc-950 border border-zinc-800 rounded overflow-hidden select-none">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-900 shrink-0">
        <h2 className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">AI Strategies (MOCK BOTS)</h2>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      </div>

      {/* Bots Toggles */}
      <div className="p-3 border-b border-zinc-900 space-y-2 shrink-0">
        
        {/* MA Bot */}
        <div className="flex items-center justify-between p-2 bg-zinc-900 border border-zinc-800 rounded">
          <div>
            <div className="text-xs font-bold text-white">MA Crossover Bot</div>
            <div className="text-[10px] text-zinc-500 font-mono font-sans">Periods: {strategies.ma.fast} / {strategies.ma.slow}</div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={strategies.ma.active}
              onChange={(e) => setStrategies({ ...strategies, ma: { ...strategies.ma, active: e.target.checked } })}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600 peer-checked:after:bg-white" />
          </label>
        </div>

        {/* RSI Bot */}
        <div className="flex items-center justify-between p-2 bg-zinc-900 border border-zinc-800 rounded">
          <div>
            <div className="text-xs font-bold text-white">RSI Mean Reversion Bot</div>
            <div className="text-[10px] text-zinc-500 font-mono font-sans">Limits: {strategies.rsi.oversold} / {strategies.rsi.overbought}</div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={strategies.rsi.active}
              onChange={(e) => setStrategies({ ...strategies, rsi: { ...strategies.rsi, active: e.target.checked } })}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600 peer-checked:after:bg-white" />
          </label>
        </div>

      </div>

      {/* AI Signals Log (Reasoning Display) */}
      <div className="flex-1 overflow-y-auto p-2 bg-black/20">
        <div className="text-[9px] uppercase tracking-wider font-mono text-zinc-500 mb-1">AI Signals Log</div>
        
        <div className="space-y-2">
          {aiSignals.length === 0 ? (
            <div className="text-center py-8 text-zinc-700 text-xs font-sans">
              봇 활성화 시 신호 로그가 표시됩니다.
            </div>
          ) : (
            aiSignals.map((sig) => {
              const ticker = tickers.find((t) => t.symbol === sig.symbol);
              const isBuy = sig.action === 'BUY';
              
              return (
                <div key={sig.id} className="p-2 bg-zinc-950 border border-zinc-900 rounded space-y-1">
                  <div className="flex justify-between items-center text-[10px] font-mono">
                    <span className="text-zinc-500">{sig.time}</span>
                    <span className={`font-bold px-1.5 py-0.2 rounded ${isBuy ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'}`}>
                      {sig.action}
                    </span>
                  </div>
                  <div className="text-[11px] font-bold text-white">
                    {ticker ? ticker.name : sig.symbol} <span className="font-normal font-mono text-zinc-500 text-[10px]">({sig.symbol})</span>
                  </div>
                  <p className="text-[10px] text-zinc-400 leading-normal font-sans">
                    {sig.reasoning}
                  </p>
                  <div className="text-[9px] text-zinc-600 font-mono flex justify-between">
                    <span>Confidence:</span>
                    <span>{Math.round(sig.confidence * 100)}%</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
