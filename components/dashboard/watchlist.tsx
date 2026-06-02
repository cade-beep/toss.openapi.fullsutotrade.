'use client';

import React, { useState } from 'react';
import { useWorkstation } from '@/lib/context/workstation-context';

export default function WatchlistPanel() {
  const { tickers, selectedSymbol, setSelectedSymbol, handleAddTicker, handleRemoveTicker } = useWorkstation();
  const [searchSymbol, setSearchSymbol] = useState('');
  const [searchName, setSearchName] = useState('');

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchSymbol || !searchName) return;
    handleAddTicker(searchSymbol, searchName);
    setSearchSymbol('');
    setSearchName('');
  };

  return (
    <div className="flex flex-col flex-1 bg-zinc-950 border border-zinc-900 rounded overflow-hidden select-none">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-900/60 shrink-0">
        <h2 className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">Watchlist</h2>
        <span className="text-[9px] px-1 bg-zinc-900 rounded font-mono text-zinc-400">{tickers.length} Symbols</span>
      </div>

      {/* Watchlist Add Input Form */}
      <form onSubmit={onSubmit} className="p-1.5 border-b border-zinc-900/60 flex gap-1 shrink-0 bg-black/10">
        <input
          type="text"
          maxLength={6}
          placeholder="Code"
          value={searchSymbol}
          onChange={(e) => setSearchSymbol(e.target.value.replace(/[^0-9]/g, ''))}
          className="w-16 bg-zinc-900/80 border border-zinc-800/80 rounded px-1.5 py-0.5 text-[11px] text-white focus:outline-none focus:border-zinc-700 font-mono"
        />
        <input
          type="text"
          placeholder="Name"
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          className="flex-1 bg-zinc-900/80 border border-zinc-800/80 rounded px-1.5 py-0.5 text-[11px] text-white focus:outline-none focus:border-zinc-700"
        />
        <button
          type="submit"
          className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-white text-[11px] font-bold transition-colors cursor-pointer"
        >
          +
        </button>
      </form>

      {/* Watchlist Items Scrollable */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[9px] uppercase tracking-wider text-zinc-500 border-b border-zinc-900/60 font-mono">
              <th className="py-1 px-3">Symbol</th>
              <th className="py-1 px-2 text-right">Price</th>
              <th className="py-1 px-2 text-right">Chg%</th>
              <th className="py-1 px-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900/40 text-[11px]">
            {tickers.map((ticker) => {
              const isSelected = selectedSymbol === ticker.symbol;
              const changeColor = ticker.change > 0 ? 'text-emerald-400' : ticker.change < 0 ? 'text-rose-400' : 'text-zinc-500';
              
              return (
                <tr
                  key={ticker.symbol}
                  onClick={() => setSelectedSymbol(ticker.symbol)}
                  className={`hover:bg-zinc-900/30 transition-colors cursor-pointer ${
                    isSelected ? 'bg-zinc-900/80 border-l-[3px] border-[#00d287]' : 'border-l-[3px] border-transparent'
                  }`}
                >
                  <td className="py-1 px-3">
                    <div className="font-semibold text-zinc-200">{ticker.name}</div>
                    <div className="text-[9px] text-zinc-500 font-mono">{ticker.symbol}</div>
                  </td>
                  <td className="py-1 px-2 text-right font-mono font-medium text-zinc-100">
                    {ticker.price.toLocaleString()}
                  </td>
                  <td className={`py-1 px-2 text-right font-mono font-semibold ${changeColor}`}>
                    {ticker.change > 0 ? '+' : ''}{ticker.change}%
                  </td>
                  <td className="py-1 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleRemoveTicker(ticker.symbol)}
                      className="p-1 hover:text-rose-400 text-zinc-700 hover:text-zinc-500 transition-colors cursor-pointer"
                      title="삭제"
                    >
                      <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
