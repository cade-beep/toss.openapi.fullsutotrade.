'use client';

import React from 'react';
import { useWorkstation } from '@/lib/context/workstation-context';
import { useI18n } from '@/lib/i18n/i18n-context';

export default function PortfolioPanel() {
  const { cashBalance, positions, tickers, isApiConnected } = useWorkstation();
  const { t, formatCurrency } = useI18n();

  // Calculations
  const portfolioAssetsValue = positions.reduce((total, pos) => {
    const ticker = tickers.find((t) => t.symbol === pos.symbol);
    const currentPrice = ticker ? ticker.price : pos.avgBuyPrice;
    return total + pos.qty * currentPrice;
  }, 0);

  const portfolioTotalValue = cashBalance + portfolioAssetsValue;
  const portfolioAssetsCost = positions.reduce((total, pos) => {
    return total + pos.qty * pos.avgBuyPrice;
  }, 0);
  const portfolioPnL = portfolioAssetsValue - portfolioAssetsCost;
  const portfolioPnLPct = portfolioAssetsCost > 0
    ? Number(((portfolioPnL / portfolioAssetsCost) * 100).toFixed(2))
    : 0.0;

  if (!isApiConnected) {
    return (
      <div className="flex flex-col bg-zinc-950 border border-zinc-900 rounded p-2.5 shrink-0 select-none">
        <h2 className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-1.5 border-b border-zinc-900/60 pb-1 flex justify-between items-center">
          <span>{t('portfolio.title')}</span>
          <span className="text-[8px] px-1.5 py-0.5 rounded bg-rose-950/40 text-rose-400 border border-rose-900/35 leading-none font-bold uppercase font-sans">
            {t('header.disconnected')}
          </span>
        </h2>
        <div className="py-8 flex flex-col items-center justify-center text-center">
          <svg className="w-8 h-8 text-zinc-700 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span className="text-xs text-zinc-400 font-semibold font-sans">Portfolio Locked</span>
          <span className="text-[10px] text-zinc-550 max-w-xs mt-1 font-sans">{t('portfolio.apiRequired')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-zinc-950 border border-zinc-900 rounded p-2.5 shrink-0 select-none">
      <h2 className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-1.5 border-b border-zinc-900/60 pb-1 flex justify-between items-center">
        <span>{t('portfolio.title')}</span>
      </h2>
      
      <div className="space-y-1.5 font-mono text-[11px]">
        <div className="flex justify-between items-baseline">
          <span className="text-zinc-500 font-sans">{t('portfolio.totalAsset')}:</span>
          <span className="text-white text-sm font-bold">
            {formatCurrency(portfolioTotalValue)}
          </span>
        </div>
        
        <div className="grid grid-cols-2 gap-2 border-t border-zinc-900/50 pt-1.5">
          <div>
            <div className="text-[9px] text-zinc-500 font-sans">{t('portfolio.cashBalance')}</div>
            <div className="text-zinc-300 font-semibold">
              {formatCurrency(cashBalance)}
            </div>
          </div>
          <div>
            <div className="text-[9px] text-zinc-500 font-sans">{t('positions.currentVal')}</div>
            <div className="text-zinc-300 font-semibold">
              {formatCurrency(portfolioAssetsValue)}
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center border-t border-zinc-900/50 pt-1.5">
          <span className="text-[9px] text-zinc-500 font-sans">{t('portfolio.unrealizedPnL')}:</span>
          <span className={`font-semibold ${portfolioPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {portfolioPnL >= 0 ? '+' : ''}{formatCurrency(portfolioPnL)} ({portfolioPnLPct}%)
          </span>
        </div>
      </div>
    </div>
  );
}

