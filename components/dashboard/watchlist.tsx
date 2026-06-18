'use client';

import React, { useState } from 'react';
import { useWorkstation } from '@/lib/context/workstation-context';
import { useI18n } from '@/lib/i18n/i18n-context';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

export default function WatchlistPanel() {
  const { tickers, selectedSymbol, setSelectedSymbol, handleAddTicker, handleRemoveTicker, isApiConnected } = useWorkstation();
  const { t, formatCurrency } = useI18n();
  const router = useRouter();
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
    <div className="flex flex-col flex-1 bg-zinc-950 border border-zinc-900 rounded-xl overflow-hidden select-none">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-900/60 shrink-0">
        <h2 className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">{t('watchlist.title')}</h2>
        {!isApiConnected ? (
          <span className="text-[8px] px-1.5 py-0.5 rounded-xl bg-danger/10 text-danger border border-danger/20 leading-none font-bold uppercase font-sans animate-pulse">
            {t('header.disconnected')}
          </span>
        ) : (
          <span className="text-[9px] px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded-xl font-mono text-zinc-400">{t('watchlist.symbolsCount', { count: tickers.length })}</span>
        )}
      </div>

      {/* Watchlist Add Input Form */}
      <form onSubmit={onSubmit} className="p-2 border-b border-zinc-900/60 flex gap-1 shrink-0 bg-black/10">
        <input
          type="text"
          maxLength={6}
          placeholder={t('watchlist.colSymbol')}
          value={searchSymbol}
          onChange={(e) => setSearchSymbol(e.target.value.replace(/[^0-9]/g, ''))}
          className="w-16 bg-zinc-900/80 border border-zinc-800/80 rounded-xl px-2 py-1 text-[11px] text-white focus:outline-none focus:border-zinc-700 font-mono"
        />
        <input
          type="text"
          placeholder={t('watchlist.colName')}
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          className="flex-1 bg-zinc-900/80 border border-zinc-800/80 rounded-xl px-2 py-1 text-[11px] text-white focus:outline-none focus:border-zinc-700"
        />
        <button
          type="submit"
          className="px-2 py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-[11px] font-bold transition-colors cursor-pointer font-sans"
        >
          +
        </button>
      </form>

      {/* Watchlist Items Scrollable */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[9px] uppercase tracking-wider text-zinc-500 border-b border-zinc-900/60 font-mono">
              <th className="py-2 px-3">{t('watchlist.colSymbol')}</th>
              {!isApiConnected ? (
                <th className="py-2 px-2 text-right" colSpan={2}>{t('watchlist.marketDataFeed')}</th>
              ) : (
                <>
                  <th className="py-2 px-2 text-right">{t('watchlist.colPrice')}</th>
                  <th className="py-2 px-2 text-right">{t('watchlist.colChange')}</th>
                </>
              )}
              <th className="py-2 px-3 text-center">{t('positions.action')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900/40 text-[11px]">
            {tickers.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-12 text-zinc-650 font-sans text-xs">
                  {t('watchlist.emptyWatchlist')}
                </td>
              </tr>
            ) : (
              tickers.map((ticker) => {
                const isSelected = selectedSymbol === ticker.symbol;
                const changeColor = ticker.change > 0 ? 'text-success' : ticker.change < 0 ? 'text-danger' : 'text-zinc-500';
                
                return (
                  <tr
                    key={ticker.symbol}
                    onClick={() => {
                      setSelectedSymbol(ticker.symbol);
                      router.push(`/stocks/${ticker.symbol}/order`);
                    }}
                    className={`hover:bg-zinc-900/30 transition-colors cursor-pointer ${
                      isSelected ? 'bg-zinc-900/80 border-l-[3px] border-primary' : 'border-l-[3px] border-transparent'
                    }`}
                  >
                    <td className="py-1 px-3">
                      <div className="font-semibold text-zinc-200">{ticker.name}</div>
                      <div className="text-[9px] text-zinc-550 font-mono">{ticker.symbol}</div>
                    </td>
                    {!isApiConnected ? (
                      <td className="py-1 px-2 text-right font-mono font-semibold text-danger/80 text-[10px]" colSpan={2}>
                        {t('watchlist.apiRequired')}
                      </td>
                    ) : (
                      <>
                        <td className="py-1 px-2 text-right font-mono font-medium text-zinc-100">
                          {formatCurrency(ticker.price)}
                        </td>
                        <td className={`py-1 px-2 text-right font-mono font-semibold ${changeColor}`}>
                          {ticker.change > 0 ? '+' : ''}{ticker.change}%
                        </td>
                      </>
                    )}
                    <td className="py-1 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleRemoveTicker(ticker.symbol)}
                        className="p-1 hover:text-danger text-zinc-700 transition-colors cursor-pointer"
                        title={t('watchlist.removeSymbol')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

