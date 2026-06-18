'use client';

import React, { useState } from 'react';
import { useWorkstation } from '@/lib/context/workstation-context';
import { useI18n } from '@/lib/i18n/i18n-context';
import { Activity } from 'lucide-react';

export default function Footer() {
  const { ordersLog, positions, cashBalance, tickers, strategies, isApiConnected } = useWorkstation();
  const { t, formatCurrency } = useI18n();
  const [isExpanded, setIsExpanded] = useState(false);

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
    <div className={`bg-[#111827] flex flex-col transition-all duration-300 select-none shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${
      isExpanded ? 'h-52' : 'h-11'
    }`}>
      {/* Footer Header / Minimized Bar */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="h-11 px-5 flex items-center justify-between cursor-pointer hover:bg-zinc-900/10 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Activity size={12} className={isApiConnected ? 'text-success animate-pulse' : 'text-zinc-650'} />
          <span className="text-[11px] font-bold text-zinc-450 uppercase tracking-wider">실시간 체결 내역 & 시스템 보안 로그</span>
          <span className="text-[9px] text-zinc-800 font-mono">|</span>
          <span className="text-[10px] text-zinc-500 font-mono">
            {isApiConnected 
              ? `연동 상태: ACTIVE (포지션: ${positions.length}개, 노출도: ${exposurePct}%)` 
              : '연동 상태: DISCONNECTED'
            }
          </span>
        </div>

        <button 
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="text-[10px] font-bold font-mono text-zinc-500 hover:text-zinc-350 flex items-center gap-1 cursor-pointer bg-zinc-900/50 hover:bg-zinc-900/80 px-2.5 py-0.5 rounded-xl transition-all"
        >
          {isExpanded ? '로그 접기 ▲' : '로그 펼치기 ▼'}
        </button>
      </div>

      {/* Log Panels (Only render when expanded) */}
      {isExpanded && (
        <footer className="flex-1 grid grid-cols-2 gap-4 px-4 text-xs font-mono overflow-hidden">
          
          {/* Order Executions Ledger */}
          <div className="flex flex-col h-full overflow-hidden">
            <div className="px-5 py-1.5 bg-[#0B0F14] text-[8.5px] uppercase tracking-wider text-zinc-500 shrink-0 font-bold">
              {t('positions.ledgerTitle')}
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-0.5 no-scrollbar">
              {!isApiConnected ? (
                <div className="text-danger/80 text-[10px] text-center py-4 flex flex-col items-center justify-center gap-1 font-semibold uppercase tracking-wider">
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
                    <div key={log.id} className="flex justify-between items-center text-[9.5px] py-1">
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-650">{log.time}</span>
                        <span className="text-zinc-550">{log.id}</span>
                        <span className={isBuy ? 'text-success font-semibold' : 'text-danger font-semibold'}>
                          {isBuy ? t('orderTicket.buy') : t('orderTicket.sell')}
                        </span>
                        <span className="text-zinc-300 font-medium font-sans">{ticker ? ticker.name : log.symbol}</span>
                      </div>
                      <div className="flex gap-4 text-zinc-400">
                        <span>{log.qty}{t('positions.sharesUnit', { defaultValue: '주' })}</span>
                        <span>@{formatCurrency(log.price)}</span>
                        <span className="text-success font-bold text-[9px]">EXEC</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* System Activity & Safety Logs */}
          <div className="flex flex-col h-full overflow-hidden">
            <div className="px-5 py-1.5 bg-[#0B0F14] text-[8.5px] uppercase tracking-wider text-zinc-550 shrink-0 font-bold">
              {t('footer.safetyLogs')}
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-0.5 text-zinc-550 text-[9.5px] leading-normal no-scrollbar">
              {!isApiConnected ? (
                <>
                  <div className="flex gap-2 text-zinc-600">
                    <span>[09:00:00]</span>
                    <span>{t('footer.logInit')}</span>
                  </div>
                  <div className="flex gap-2 text-danger font-semibold animate-pulse">
                    <span>[09:00:05]</span>
                    <span>{t('footer.logWarning')}</span>
                  </div>
                  <div className="flex gap-2 text-danger/80">
                    <span>[09:00:10]</span>
                    <span>{t('footer.logCritical')}</span>
                  </div>
                  <div className="flex gap-2 text-zinc-600">
                    <span>[09:00:15]</span>
                    <span>{t('footer.logInstructions')}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex gap-2">
                    <span className="text-zinc-700">[09:00:00]</span>
                    <span className="text-zinc-550">시스템 부팅 완료. API 연결 검증 통과.</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-zinc-700">[09:00:05]</span>
                    <span className="text-zinc-550">Toss API 실시간 가격 피드 브로드캐스터 시작.</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-zinc-700">[09:05:12]</span>
                    <span className="text-danger/80">세이프티 가드레일 활성화 (Max Drawdown: -10% 포트폴리오 감시).</span>
                  </div>
                  {strategies.ma.active && (
                    <div className="flex gap-2 text-success/90">
                      <span className="text-zinc-700">[{new Date().toTimeString().split(' ')[0]}]</span>
                      <span>MA Crossover 자동매매 인스턴스가 활성화되었습니다. 시장 감시 루프 실행 중.</span>
                    </div>
                  )}
                  {strategies.rsi.active && (
                    <div className="flex gap-2 text-success/90">
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
      )}
    </div>
  );
}
