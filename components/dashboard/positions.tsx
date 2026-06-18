'use client';

import React from 'react';
import { useWorkstation } from '@/lib/context/workstation-context';
import { useI18n } from '@/lib/i18n/i18n-context';
import { AlertTriangle, GripHorizontal } from 'lucide-react';

type PositionsPanelProps = {
  readonly onSelectTicker?: (symbol: string) => void;
  readonly recentlyViewed?: string[];
};

export default function PositionsPanel({ onSelectTicker, recentlyViewed }: PositionsPanelProps) {
  const { positions, tickers, executeTrade, isApiConnected } = useWorkstation();
  const { t, formatCurrency } = useI18n();

  if (!isApiConnected) {
    return (
      <div className="flex flex-col w-full h-full bg-[#151B23] rounded-[16px] overflow-hidden select-none">
        <div className="flex items-center justify-between px-5 py-4 shrink-0 drag-handle cursor-grab">
          <div className="flex items-center gap-1.5">
            <GripHorizontal size={12} className="text-zinc-655" />
            <h2 className="text-xs uppercase font-bold tracking-wider text-zinc-500">{t('positions.title')}</h2>
          </div>
          <span className="text-[9px] px-2 py-1 bg-danger/10 text-danger rounded-xl leading-none font-bold uppercase font-sans">
            {t('header.disconnected')}
          </span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <AlertTriangle className="w-8 h-8 text-zinc-505 mb-2" />
          <span className="text-xs text-zinc-400 font-semibold font-sans">{t('positions.apiNotConnected')}</span>
          <span className="text-[10px] text-zinc-500 max-w-xs mt-2 font-sans">{t('positions.apiRequired')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full bg-[#151B23] rounded-[16px] overflow-hidden select-none">
      <div className="flex items-center justify-between px-5 py-4 shrink-0 drag-handle cursor-grab">
        <div className="flex items-center gap-1.5">
          <GripHorizontal size={12} className="text-zinc-655" />
          <h2 className="text-xs uppercase font-bold tracking-wider text-zinc-550">{t('positions.title')}</h2>
        </div>
        <span className="text-[9px] px-2 bg-zinc-950/30 rounded-xl font-mono text-zinc-450">{t('positions.holdingsCount', { count: positions.length })}</span>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {positions.length === 0 ? (
          <div className="p-5 flex flex-col gap-4 font-sans">
            <div className="text-center py-2 text-zinc-550 text-xs font-semibold">
              {t('positions.emptyPositions')}
            </div>
            
            {/* AI Recommendations */}
            <div className="space-y-2">
              <span className="text-[9.5px] text-zinc-555 font-bold uppercase tracking-wider block">AI 추천 종목</span>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                {[
                  { symbol: '005930', name: '삼성전자', prob: '84%', action: 'BUY' },
                  { symbol: 'NVDA', name: 'NVIDIA', prob: '79%', action: 'BUY' },
                ].map(rec => (
                  <div
                    key={rec.symbol}
                    onClick={() => onSelectTicker?.(rec.symbol)}
                    className="p-2.5 rounded-xl bg-[#111827] hover:bg-[#1C2430] cursor-pointer transition-all flex flex-col justify-between"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-zinc-300 truncate">{rec.name}</span>
                      <span className="text-[8px] text-zinc-555 font-mono">{rec.symbol}</span>
                    </div>
                    <div className="flex justify-between items-center mt-2.5">
                      <span className="text-success font-bold text-[9px]">{rec.action}</span>
                      <span className="text-zinc-500">확률 {rec.prob}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recently Viewed */}
            {recentlyViewed && recentlyViewed.length > 0 && (
              <div className="space-y-2 pt-3">
                <span className="text-[9.5px] text-zinc-555 font-bold uppercase tracking-wider block">최근 조회 종목</span>
                <div className="flex flex-wrap gap-1.5">
                  {recentlyViewed.slice(0, 3).map(sym => {
                    const tickerName = tickers.find(t => t.symbol === sym)?.name || sym;
                    return (
                      <button
                        key={sym}
                        onClick={() => onSelectTicker?.(sym)}
                        className="px-2.5 py-1 rounded-xl bg-[#111827] hover:bg-[#1C2430] text-[10px] text-zinc-400 font-bold transition-all cursor-pointer"
                      >
                        {tickerName}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] uppercase font-bold text-zinc-500 font-sans">
                <th className="py-2 px-4">{t('positions.symbol')}</th>
                <th className="py-2 px-2 text-right">{t('positions.qty')}</th>
                <th className="py-2 px-2 text-right">{t('positions.avgPrice')}</th>
                <th className="py-2 px-2 text-right">{t('positions.currentPrice')}</th>
                <th className="py-2 px-2 text-right">{t('positions.pnl')}</th>
                <th className="py-2 px-4 text-center">{t('positions.action')}</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {positions.map((pos) => {
                const ticker = tickers.find((t) => t.symbol === pos.symbol);
                const currentPrice = ticker ? ticker.price : pos.avgBuyPrice;
                const totalCost = pos.qty * pos.avgBuyPrice;
                const currentValue = pos.qty * currentPrice;
                const pnl = currentValue - totalCost;
                const pnlPct = Number(((pnl / totalCost) * 100).toFixed(2));
                const changeColor = pnl >= 0 ? 'text-success' : 'text-danger';

                return (
                  <tr key={pos.symbol} className="hover:bg-[#1C2430] transition-colors">
                    <td className="py-3 px-4 font-sans">
                      <span className="font-bold text-zinc-200">
                        {ticker ? ticker.name : pos.symbol}
                      </span>
                      <span className="text-[9px] text-zinc-555 ml-2 font-mono">{pos.symbol}</span>
                    </td>
                    <td className="py-3 px-2 text-right text-zinc-200 font-semibold font-mono">{pos.qty}</td>
                    <td className="py-3 px-2 text-right text-zinc-400 font-mono">{formatCurrency(pos.avgBuyPrice)}</td>
                    <td className="py-3 px-2 text-right text-zinc-400 font-mono">{formatCurrency(currentPrice)}</td>
                    <td className={`py-3 px-2 text-right font-black font-mono ${changeColor}`}>
                      {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)} ({pnlPct}%)
                    </td>
                    <td className="py-3 px-4 text-center font-sans">
                      <button
                        onClick={() => executeTrade(pos.symbol, 'SELL', pos.qty, currentPrice)}
                        className="px-2 py-1 rounded-xl text-[10px] font-semibold bg-danger/10 hover:bg-danger/20 text-danger transition-colors cursor-pointer"
                      >
                        {t('positions.sellAll')}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

