'use client';

import React from 'react';
import { useWorkstation } from '@/lib/context/workstation-context';

export default function PositionsPanel() {
  const { positions, tickers, executeTrade, isApiConnected } = useWorkstation();

  if (!isApiConnected) {
    return (
      <div className="flex flex-col flex-1 bg-zinc-950 border border-zinc-900 rounded overflow-hidden select-none">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-900/60 shrink-0">
          <h2 className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">Active Positions</h2>
          <span className="text-[9px] px-1.5 py-0.5 bg-rose-950/40 border border-rose-900/35 text-rose-400 rounded leading-none font-bold uppercase">
            API Not Connected
          </span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <svg className="w-8 h-8 text-zinc-700 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-xs text-zinc-400 font-semibold font-sans">Toss API Not Connected</span>
          <span className="text-[10px] text-zinc-550 max-w-xs mt-1 font-sans">Please configure your API credentials to load live positions and enable trade execution.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 bg-zinc-950 border border-zinc-900 rounded overflow-hidden select-none">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-900/60 shrink-0">
        <h2 className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">Active Positions</h2>
        <span className="text-[9px] px-1 bg-zinc-900 rounded font-mono text-zinc-400">{positions.length} holdings</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[9px] uppercase tracking-wider text-zinc-500 border-b border-zinc-900/60 font-mono">
              <th className="py-1.5 px-3">Symbol</th>
              <th className="py-1.5 px-2 text-right">Quantity</th>
              <th className="py-1.5 px-2 text-right">Avg Buy Price</th>
              <th className="py-1.5 px-2 text-right">Current Price</th>
              <th className="py-1.5 px-2 text-right">Unrealized PnL</th>
              <th className="py-1.5 px-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900/40 text-[11px] font-mono">
            {positions.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-zinc-600 font-sans text-xs">
                  보유 중인 주식 포지션이 없습니다.
                </td>
              </tr>
            ) : (
              positions.map((pos) => {
                const ticker = tickers.find((t) => t.symbol === pos.symbol);
                const currentPrice = ticker ? ticker.price : pos.avgBuyPrice;
                const totalCost = pos.qty * pos.avgBuyPrice;
                const currentValue = pos.qty * currentPrice;
                const pnl = currentValue - totalCost;
                const pnlPct = Number(((pnl / totalCost) * 100).toFixed(2));
                const changeColor = pnl >= 0 ? 'text-emerald-400' : 'text-rose-400';

                return (
                  <tr key={pos.symbol} className="hover:bg-zinc-900/20 transition-colors">
                    <td className="py-1.5 px-3 font-sans">
                      <span className="font-semibold text-zinc-200">
                        {ticker ? ticker.name : pos.symbol}
                      </span>
                      <span className="text-[9px] text-zinc-500 ml-1.5 font-mono">{pos.symbol}</span>
                    </td>
                    <td className="py-1.5 px-2 text-right text-zinc-100 font-semibold">{pos.qty}</td>
                    <td className="py-1.5 px-2 text-right text-zinc-400">{pos.avgBuyPrice.toLocaleString()}</td>
                    <td className="py-1.5 px-2 text-right text-zinc-400">{currentPrice.toLocaleString()}</td>
                    <td className={`py-1.5 px-2 text-right font-semibold ${changeColor}`}>
                      {pnl >= 0 ? '+' : ''}{pnl.toLocaleString()} ({pnlPct}%)
                    </td>
                    <td className="py-1.5 px-3 text-center font-sans">
                      <button
                        onClick={() => executeTrade(pos.symbol, 'SELL', pos.qty, currentPrice)}
                        className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-950/30 hover:bg-rose-950/60 border border-rose-900/40 hover:border-rose-900 text-rose-400 transition-colors cursor-pointer"
                      >
                        시장가 청산
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
