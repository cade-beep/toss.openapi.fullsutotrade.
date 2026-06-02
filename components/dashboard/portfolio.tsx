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
    <div className="flex flex-col bg-zinc-950 border border-zinc-900 rounded p-2.5 shrink-0 select-none">
      <h2 className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-1.5 border-b border-zinc-900/60 pb-1">Account & Portfolio</h2>
      
      <div className="space-y-1.5 font-mono text-[11px]">
        <div className="flex justify-between items-baseline">
          <span className="text-zinc-500 font-sans">Total Equity:</span>
          <span className="text-white text-sm font-bold">
            {portfolioTotalValue.toLocaleString()} <span className="text-[9px] text-zinc-500 font-sans">KRW</span>
          </span>
        </div>
        
        <div className="grid grid-cols-2 gap-2 border-t border-zinc-900/50 pt-1.5">
          <div>
            <div className="text-[9px] text-zinc-500 font-sans">Cash Balance</div>
            <div className="text-zinc-300 font-semibold">{cashBalance.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[9px] text-zinc-500 font-sans">Assets Value</div>
            <div className="text-zinc-300 font-semibold">{portfolioAssetsValue.toLocaleString()}</div>
          </div>
        </div>

        <div className="flex justify-between items-center border-t border-zinc-900/50 pt-1.5">
          <span className="text-[9px] text-zinc-500 font-sans">Total Unrealized PnL:</span>
          <span className={`font-semibold ${portfolioPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {portfolioPnL >= 0 ? '+' : ''}{portfolioPnL.toLocaleString()} ({portfolioPnLPct}%)
          </span>
        </div>
      </div>
    </div>
  );
}
