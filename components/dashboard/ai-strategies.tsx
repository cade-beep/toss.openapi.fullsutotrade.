'use client';

import React from 'react';
import { useWorkstation } from '@/lib/context/workstation-context';
import { useI18n } from '@/lib/i18n/i18n-context';

export default function AIStrategiesPanel() {
  const { strategies, setStrategies, aiSignals, tickers, isApiConnected } = useWorkstation();
  const { t } = useI18n();

  // Helper to render text confidence bar
  const renderConfidenceBar = (confidence: number) => {
    const total = 10;
    const filled = Math.round(confidence * total);
    return '■'.repeat(filled) + '□'.repeat(total - filled);
  };

  return (
    <div className="flex flex-col flex-1 bg-zinc-950 border border-zinc-900 rounded overflow-hidden select-none">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-900/60 shrink-0">
        <h2 className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">{t('aiStrategies.title')}</h2>
        {!isApiConnected ? (
          <span className="flex items-center gap-1">
            <span className="text-[8px] font-mono text-rose-500 font-semibold uppercase animate-pulse">{t('header.disconnected')}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <span className="text-[9px] font-mono text-emerald-400 font-semibold uppercase">TELEMETRY ON</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </span>
        )}
      </div>

      {/* Bots Toggles */}
      <div className="p-2.5 border-b border-zinc-900/60 space-y-2 shrink-0 bg-black/10">
        
        {/* MA Bot */}
        <div className={`flex items-center justify-between p-2 rounded border transition-all ${
          strategies.ma.active && isApiConnected
            ? 'bg-[#00d287]/5 border-[#00d287]/25' 
            : 'bg-zinc-900/40 border-zinc-900/50'
        } ${!isApiConnected ? 'opacity-55' : ''}`}>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-zinc-200">{t('aiStrategies.runCrossover')}</span>
              <span className={`text-[8px] font-mono font-bold leading-none px-1 py-0.2 rounded ${
                strategies.ma.active && isApiConnected ? 'bg-emerald-950 text-emerald-400' : 'bg-zinc-800 text-zinc-500'
              }`}>
                {strategies.ma.active && isApiConnected ? t('common.active') : t('common.inactive')}
              </span>
            </div>
            <div className="text-[9px] text-zinc-500 font-mono mt-0.5">Fast {strategies.ma.fast} / Slow {strategies.ma.slow} EMA</div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              disabled={!isApiConnected}
              checked={strategies.ma.active && isApiConnected}
              onChange={(e) => setStrategies({ ...strategies, ma: { ...strategies.ma, active: e.target.checked } })}
              className="sr-only peer"
            />
            <div className="w-8 h-4.5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-3.5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-[#00d287] peer-checked:after:bg-[#022316]" />
          </label>
        </div>

        {/* RSI Bot */}
        <div className={`flex items-center justify-between p-2 rounded border transition-all ${
          strategies.rsi.active && isApiConnected
            ? 'bg-[#00d287]/5 border-[#00d287]/25' 
            : 'bg-zinc-900/40 border-zinc-900/50'
        } ${!isApiConnected ? 'opacity-55' : ''}`}>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-zinc-200">{t('aiStrategies.meanReversion')}</span>
              <span className={`text-[8px] font-mono font-bold leading-none px-1 py-0.2 rounded ${
                strategies.rsi.active && isApiConnected ? 'bg-emerald-950 text-emerald-400' : 'bg-zinc-800 text-zinc-500'
              }`}>
                {strategies.rsi.active && isApiConnected ? t('common.active') : t('common.inactive')}
              </span>
            </div>
            <div className="text-[9px] text-zinc-500 font-mono mt-0.5">Oversold {strategies.rsi.oversold} / Overbought {strategies.rsi.overbought}</div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              disabled={!isApiConnected}
              checked={strategies.rsi.active && isApiConnected}
              onChange={(e) => setStrategies({ ...strategies, rsi: { ...strategies.rsi, active: e.target.checked } })}
              className="sr-only peer"
            />
            <div className="w-8 h-4.5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-3.5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-[#00d287] peer-checked:after:bg-[#022316]" />
          </label>
        </div>

      </div>

      {/* AI Signals Log (Reasoning Display) */}
      <div className="flex-1 overflow-y-auto p-2 bg-black/10 flex flex-col">
        <div className="text-[9px] uppercase tracking-wider font-mono text-zinc-500 mb-1.5">AI Signals Stream</div>
        
        {!isApiConnected ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <svg className="w-7 h-7 text-rose-500/40 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-xs text-zinc-400 font-semibold font-sans">No Live Strategy Data Available</span>
            <span className="text-[10px] text-zinc-550 max-w-xs mt-1 font-sans">{t('aiStrategies.apiRequired')}</span>
          </div>
        ) : aiSignals.length === 0 ? (
          <div className="text-center py-12 text-zinc-700 text-[11px] font-sans">
            No trade signals captured. Activate bot engines to begin telemetry log.
          </div>
        ) : (
          <div className="space-y-1.5">
            {aiSignals.map((sig) => {
              const ticker = tickers.find((t) => t.symbol === sig.symbol);
              const isBuy = sig.action === 'BUY';
              
              return (
                <div key={sig.id} className={`p-2 rounded border space-y-1 ${
                  isBuy 
                    ? 'bg-emerald-950/20 border-emerald-900/30' 
                    : 'bg-rose-950/20 border-rose-900/30'
                }`}>
                  <div className="flex justify-between items-center text-[9px] font-mono leading-none">
                    <span className="text-zinc-500">{sig.time}</span>
                    <span className={`font-bold px-1.5 py-0.2 rounded ${
                      isBuy ? 'bg-[#00d287]/15 text-[#00d287]' : 'bg-[#f43f5e]/15 text-[#f43f5e]'
                    }`}>
                      {isBuy ? t('orderTicket.buy') : t('orderTicket.sell')}
                    </span>
                  </div>
                  <div className="text-[11px] font-bold text-zinc-200 leading-none">
                    {ticker ? ticker.name : sig.symbol} <span className="font-normal font-mono text-zinc-500 text-[9px] ml-0.5">({sig.symbol})</span>
                  </div>
                  <p className="text-[10px] text-zinc-400 leading-normal font-sans">
                    {sig.reasoning}
                  </p>
                  <div className="text-[9px] text-zinc-500 font-mono flex justify-between items-center border-t border-zinc-900/40 pt-1 mt-1">
                    <span>CONFIDENCE:</span>
                    <span className="text-zinc-400 font-semibold">{renderConfidenceBar(sig.confidence)} {Math.round(sig.confidence * 100)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

