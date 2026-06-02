'use client';

import React from 'react';
import { useWorkstation } from '@/lib/context/workstation-context';

export default function PositionsPanel() {
  const { positions, tickers, executeMockTrade } = useWorkstation();

  return (
    <div className="flex flex-col h-56 bg-zinc-950 border border-zinc-800 rounded overflow-hidden shrink-0 select-none">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-900 shrink-0">
        <h2 className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">Active Positions</h2>
        <span className="text-[9px] px-1 bg-zinc-900 rounded font-mono text-zinc-400">{positions.length} holdings</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[9px] uppercase tracking-wider text-zinc-600 border-b border-zinc-900 font-mono">
              <th className="py-1 px-3">Symbol</th>
              <th className="py-1 px-2 text-right">Quantity</th>
              <th className="py-1 px-2 text-right">Avg Buy Price</th>
              <th className="py-1 px-2 text-right">Current Price</th>
              <th className="py-1 px-2 text-right">Unrealized PnL</th>
              <th className="py-1 px-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900 text-xs font-mono">
            {positions.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-zinc-600 font-sans text-xs">
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
                  <tr key={pos.symbol} className="hover:bg-zinc-900/40">
                    <td className="py-2 px-3 font-sans">
                      <span className="font-semibold text-zinc-200">
                        {ticker ? ticker.name : pos.symbol}
                      </span>
                      <span className="text-[9px] text-zinc-500 ml-1.5">{pos.symbol}</span>
                    </td>
                    <td className="py-2 px-2 text-right text-white font-semibold">{pos.qty}</td>
                    <td className="py-2 px-2 text-right">{pos.avgBuyPrice.toLocaleString()}</td>
                    <td className="py-2 px-2 text-right text-zinc-400">{currentPrice.toLocaleString()}</td>
                    <td className={`py-2 px-2 text-right font-semibold ${changeColor}`}>
                      {pnl >= 0 ? '+' : ''}{pnl.toLocaleString()} ({pnlPct}%)
                    </td>
                    <td className="py-2 px-3 text-center font-sans">
                      <button
                        onClick={() => executeMockTrade(pos.symbol, 'SELL', pos.qty, currentPrice)}
                        className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 transition-colors cursor-pointer"
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
