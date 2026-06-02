'use client';

import React from 'react';
import { useWorkstation } from '@/lib/context/workstation-context';

export default function PortfolioPanel() {
  const { cashBalance, positions, tickers } = useWorkstation();

  // Calculations
  const portfolioAssetsValue = positions.reduce((total, pos) => {
    const ticker = tickers.find((t) => t.symbol === pos.symbol);
    const currentPrice = ticker ? ticker.price : pos.avgBuyPrice;
    return total + pos.qty * currentPrice;
  }, 0);

  const portfolioTotalValue = cashBalance + portfolioAssetsValue;
  const portfolioInitial = 10000000; // 10M KRW initial capital
  const portfolioPnL = portfolioTotalValue - portfolioInitial;
  const portfolioPnLPct = Number(((portfolioPnL / portfolioInitial) * 100).toFixed(2));

  return (
    <div className="flex flex-col bg-zinc-950 border border-zinc-800 rounded p-3 shrink-0 select-none">
      <h2 className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-2 border-b border-zinc-900 pb-1">Account & Portfolio</h2>
      
      <div className="space-y-2 font-mono">
        <div className="flex justify-between items-baseline">
          <span className="text-zinc-500 text-[11px]">Total Equity:</span>
          <span className="text-white text-base font-bold">
            {portfolioTotalValue.toLocaleString()} <span className="text-[10px] text-zinc-500 font-sans">KRW</span>
          </span>
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-xs border-t border-zinc-900 pt-2">
          <div>
            <div className="text-[10px] text-zinc-500 font-sans">Cash Balance</div>
            <div className="text-zinc-300 font-semibold">{cashBalance.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 font-sans">Assets Value</div>
            <div className="text-zinc-300 font-semibold">{portfolioAssetsValue.toLocaleString()}</div>
          </div>
        </div>

        <div className="flex justify-between items-center text-xs border-t border-zinc-900 pt-2">
          <span className="text-[10px] text-zinc-500 font-sans">Total Unrealized PnL:</span>
          <span className={`font-semibold ${portfolioPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {portfolioPnL >= 0 ? '+' : ''}{portfolioPnL.toLocaleString()} ({portfolioPnLPct}%)
          </span>
        </div>
      </div>
    </div>
  );
}
