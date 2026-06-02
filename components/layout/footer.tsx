'use client';

import React from 'react';
import { useWorkstation } from '@/lib/context/workstation-context';

export default function Footer() {
  const { ordersLog, positions, cashBalance, tickers, strategies } = useWorkstation();

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
    <footer className="h-28 bg-zinc-950 border-t border-zinc-800 grid grid-cols-2 divide-x divide-zinc-900 text-xs font-mono overflow-hidden shrink-0 select-none">
      
      {/* Order Executions Ledger */}
      <div className="flex flex-col h-full overflow-hidden">
        <div className="px-3 py-1 bg-zinc-900 text-[9px] uppercase tracking-wider text-zinc-500 shrink-0">
          Order Executions Ledger
        </div>
        <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
          {ordersLog.length === 0 ? (
            <div className="text-zinc-600 text-[10px] text-center py-4">No order history logged.</div>
          ) : (
            ordersLog.map((log) => {
              const ticker = tickers.find((t) => t.symbol === log.symbol);
              const isBuy = log.side === 'BUY';
              
              return (
                <div key={log.id} className="flex justify-between items-center text-[10px] py-0.5 border-b border-zinc-900/50">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500">{log.time}</span>
                    <span className="text-zinc-400 font-semibold">{log.id}</span>
                    <span className={isBuy ? 'text-emerald-400' : 'text-rose-400'}>{log.side}</span>
                    <span className="text-white font-medium">{ticker ? ticker.name : log.symbol}</span>
                  </div>
                  <div className="flex gap-4">
                    <span>{log.qty}주</span>
                    <span>@{log.price.toLocaleString()} KRW</span>
                    <span className="text-emerald-500 font-bold">{log.status}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* System Activity & Safety Logs */}
      <div className="flex flex-col h-full overflow-hidden">
        <div className="px-3 py-1 bg-zinc-900 text-[9px] uppercase tracking-wider text-zinc-500 shrink-0">
          System Activity & Safety Logs
        </div>
        <div className="flex-1 overflow-y-auto p-1.5 space-y-1 text-zinc-500 text-[10px] leading-relaxed">
          <div className="flex gap-2">
            <span className="text-zinc-600">[09:00:00]</span>
            <span className="text-zinc-400">시스템 부팅 완료. 모의 투자 데이터베이스 캐싱 초기화.</span>
          </div>
          <div className="flex gap-2">
            <span className="text-zinc-600">[09:00:05]</span>
            <span className="text-zinc-400">MockTossService 가격 피드 브로드캐스터 시작.</span>
          </div>
          <div className="flex gap-2">
            <span className="text-zinc-600">[09:05:12]</span>
            <span className="text-zinc-400">세이프티 가드레일 활성화 (Max Drawdown: -10% 포트폴리오 감시).</span>
          </div>
          {strategies.ma.active && (
            <div className="flex gap-2 text-emerald-600/90">
              <span className="text-zinc-600">[{new Date().toTimeString().split(' ')[0]}]</span>
              <span>MA Crossover 자동매매 인스턴스가 활성화되었습니다. 시장 감시 루프 실행 중.</span>
            </div>
          )}
          {strategies.rsi.active && (
            <div className="flex gap-2 text-emerald-600/90">
              <span className="text-zinc-600">[{new Date().toTimeString().split(' ')[0]}]</span>
              <span>RSI Mean Reversion 자동매매 인스턴스가 활성화되었습니다. 시장 감시 루프 실행 중.</span>
            </div>
          )}
          {positions.length > 0 && (
            <div className="flex gap-2 text-zinc-400">
              <span className="text-zinc-600">[{new Date().toTimeString().split(' ')[0]}]</span>
              <span>보유 자산 실시간 위험도(Risk Exposure): {exposurePct}%</span>
            </div>
          )}
        </div>
      </div>

    </footer>
  );
}
