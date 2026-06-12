'use client';

import React from 'react';
import { useWorkstation } from '@/lib/context/workstation-context';
import { useI18n } from '@/lib/i18n/i18n-context';

export default function Footer() {
  const { ordersLog, positions, cashBalance, tickers, strategies, isApiConnected } = useWorkstation();
  const { t, formatCurrency } = useI18n();

  // Compute portfolio risk exposure
  const portfolioAssetsValue = positions.reduce((total, pos) => {
    const ticker = tickers.find((t) => t.symbol === pos.symbol);
    const currentPrice = ticker ? ticker.price : pos.avgBuyPrice;
    return total + pos.qty * currentPrice;
  }, 0);

  const portfolioTotalValue = cashBalance + portfolioAssetsValue;
  const exposurePct = portfolioTotalValue > 0 
    ? ((portfolioAssetsValue / portfolioTotalValue) * 100).toFixed(1) 
    : '0.0';

  return (
    <footer className="h-28 bg-zinc-950 border-t border-zinc-900 grid grid-cols-2 divide-x divide-zinc-900 text-xs font-mono overflow-hidden shrink-0 select-none">
      
      {/* Order Executions Ledger */}
      <div className="flex flex-col h-full overflow-hidden">
        <div className="px-3 py-1 bg-black/40 border-b border-zinc-900/60 text-[8.5px] uppercase tracking-wider text-zinc-500 shrink-0 font-bold">
          {t('positions.ledgerTitle')}
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {!isApiConnected ? (
            <div className="text-rose-500/80 text-[10px] text-center py-4 flex flex-col items-center justify-center gap-1 font-semibold uppercase tracking-wider">
              <span>{t('header.disconnected')}</span>
              <span className="text-zinc-700 text-[9px] font-normal lowercase font-sans">{t('positions.apiRequired')}</span>
            </div>
          ) : ordersLog.length === 0 ? (
            <div className="text-zinc-700 text-[10px] text-center py-4">{t('backtest.emptyTrades')}</div>
          ) : (
            ordersLog.map((log) => {
              const ticker = tickers.find((t) => t.symbol === log.symbol);
              const isBuy = log.side === 'BUY';
              
              return (
                <div key={log.id} className="flex justify-between items-center text-[9.5px] py-0.5 border-b border-zinc-900/20">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-600">{log.time}</span>
                    <span className="text-zinc-500">{log.id}</span>
                    <span className={isBuy ? 'text-[#00d287] font-semibold' : 'text-[#f43f5e] font-semibold'}>
                      {isBuy ? t('orderTicket.buy') : t('orderTicket.sell')}
                    </span>
                    <span className="text-zinc-300 font-medium font-sans">{ticker ? ticker.name : log.symbol}</span>
                  </div>
                  <div className="flex gap-4 text-zinc-400">
                    <span>{log.qty}주</span>
                    <span>@{formatCurrency(log.price)}</span>
                    <span className="text-[#00d287] font-bold text-[9px]">EXEC</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* System Activity & Safety Logs */}
      <div className="flex flex-col h-full overflow-hidden">
        <div className="px-3 py-1 bg-black/40 border-b border-zinc-900/60 text-[8.5px] uppercase tracking-wider text-zinc-500 shrink-0 font-bold">
          System Activity & Safety Logs
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5 text-zinc-500 text-[9.5px] leading-normal">
          {!isApiConnected ? (
            <>
              <div className="flex gap-2 text-zinc-600">
                <span>[09:00:00]</span>
                <span>SYSTEM: Workstation initializing...</span>
              </div>
              <div className="flex gap-2 text-rose-500 font-semibold animate-pulse">
                <span>[09:00:05]</span>
                <span>WARNING: Broker API credentials not configured. Workstation locked.</span>
              </div>
              <div className="flex gap-2 text-rose-500/80">
                <span>[09:00:10]</span>
                <span>CRITICAL: Live trading and order execution disabled. Fail-closed mode active.</span>
              </div>
              <div className="flex gap-2 text-zinc-600">
                <span>[09:00:15]</span>
                <span>Please configure Toss API credentials in settings to authorize trading.</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex gap-2">
                <span className="text-zinc-700">[09:00:00]</span>
                <span className="text-zinc-500">시스템 부팅 완료. API 연결 검증 통과.</span>
              </div>
              <div className="flex gap-2">
                <span className="text-zinc-700">[09:00:05]</span>
                <span className="text-zinc-500">Toss API 실시간 가격 피드 브로드캐스터 시작.</span>
              </div>
              <div className="flex gap-2">
                <span className="text-zinc-700">[09:05:12]</span>
                <span className="text-[#f43f5e]/80">세이프티 가드레일 활성화 (Max Drawdown: -10% 포트폴리오 감시).</span>
              </div>
              {strategies.ma.active && (
                <div className="flex gap-2 text-[#00d287]/90">
                  <span className="text-zinc-700">[{new Date().toTimeString().split(' ')[0]}]</span>
                  <span>MA Crossover 자동매매 인스턴스가 활성화되었습니다. 시장 감시 루프 실행 중.</span>
                </div>
              )}
              {strategies.rsi.active && (
                <div className="flex gap-2 text-[#00d287]/90">
                  <span className="text-zinc-700">[{new Date().toTimeString().split(' ')[0]}]</span>
                  <span>RSI Mean Reversion 자동매매 인스턴스가 활성화되었습니다. 시장 감시 루프 실행 중.</span>
                </div>
              )}
              {positions.length > 0 && (
                <div className="flex gap-2 text-zinc-400">
                  <span className="text-zinc-700">[{new Date().toTimeString().split(' ')[0]}]</span>
                  <span>보유 자산 실시간 위험도(Risk Exposure): {exposurePct}%</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

    </footer>
  );
}

