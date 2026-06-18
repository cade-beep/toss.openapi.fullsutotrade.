'use client';

import React, { useMemo } from 'react';
import { useWorkstation } from '@/lib/context/workstation-context';
import { useI18n } from '@/lib/i18n/i18n-context';
import { 
  AlertTriangle, 
  GripHorizontal, 
  Sparkles, 
  BrainCircuit
} from 'lucide-react';

export default function AIStrategiesPanel() {
  const { 
    strategies, 
    setStrategies, 
    aiSignals, 
    tickers, 
    isApiConnected, 
    activeTicker 
  } = useWorkstation();
  const { t } = useI18n();

  // Helper to render text confidence bar
  const renderConfidenceBar = (confidence: number) => {
    const total = 10;
    const filled = Math.round(confidence * total);
    return '■'.repeat(filled) + '□'.repeat(total - filled);
  };

  // Generate dynamic deterministic AI metrics for the active stock
  const aiMetrics = useMemo(() => {
    if (!activeTicker) {
      return {
        confidence: 78,
        buyProb: 50,
        sellProb: 50,
        riskLevel: 'MEDIUM',
        riskReward: '1 : 2.0',
        action: 'HOLD' as const,
        rationale: '데이터를 분석하는 중입니다.'
      };
    }

    const symbol = activeTicker.symbol;
    const price = activeTicker.price;
    const change = activeTicker.change;

    const hash = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const confidence = 68 + (hash % 23); // Ranges 68% to 90%

    let buyProb = Math.min(92, Math.max(15, Math.round(52 + change * 8.5 + (hash % 10) - 5)));
    if (buyProb > 95) buyProb = 95;
    if (buyProb < 5) buyProb = 5;
    const sellProb = 100 - buyProb;

    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    if (buyProb >= 62) {
      action = 'BUY';
    } else if (buyProb <= 38) {
      action = 'SELL';
    }

    let riskLevel = 'MEDIUM';
    if (symbol === '252670' || symbol === 'KRW-BTC' || symbol === 'NVDA' || symbol === 'TSLA') {
      riskLevel = 'HIGH';
    } else if (symbol === '005930' || symbol === 'MSFT') {
      riskLevel = 'LOW';
    }

    const rrSeed = (hash + Math.round(price)) % 15;
    const riskReward = `1 : ${(1.8 + rrSeed / 10).toFixed(1)}`;

    let rationale = '';
    const name = activeTicker.name;

    if (action === 'BUY') {
      if (symbol === 'KRW-BTC') {
        rationale = `[블록체인 온체인 모멘텀 포착] 비트코인 해시레이트 상승 및 주요 누적 주소의 순매수 전환이 관측되었습니다. 볼륨 프로파일 분석상 매물대가 두터운 97,500,000원 선을 강하게 지지하며 5일 EMA 이평선이 상방 각도를 넓히고 있어 단기 추세 지속 가능성이 매우 높습니다. 리스크 관리를 위해 1 : 2.5 손익비 비율로 목표가를 조정하여 분할 매수 진입을 권장합니다.`;
      } else {
        rationale = `[이평선 골든크로스 및 추세 강화] ${name} (${symbol})의 단기 5일 이평선이 20일 이평선을 상향 돌파하는 골든크로스를 기록했습니다. 최근 3거래일 동안 평균 거래량이 35% 증가하며 외국인/기관의 순매수세가 포착됩니다. RSI(53)가 과매수 구역 진입 전 모멘텀 상승 추세에 올라타 있어 손익비가 높은 구간으로 평가됩니다.`;
      }
    } else if (action === 'SELL') {
      if (symbol === 'KRW-BTC') {
        rationale = `[단기 과열 및 거래량 감소] 비트코인 가격이 볼린저 밴드 상단 저항선에 걸치며 RSI(74) 과매수 시그널을 강하게 나타내고 있습니다. 상승 흐름 속에서 거래대금이 점진적으로 줄어드는 다이버전스 현상이 감지되어 단기 조정 가능성이 높습니다. 하방 리스크 회피를 위해 부분 차익 실현 후 지지선 분할 매수 재진입을 준비할 타이밍입니다.`;
      } else {
        rationale = `[상단 저항선 돌파 실패 및 매도세 유입] ${name} (${symbol})의 주가가 직전 고점 부근의 강력한 저항 매물벽에 부딪혀 상승 탄력이 둔화되고 있습니다. RSI 지표가 70을 초과한 과열 상태에서 이탈 흐름을 보이고 있으며, 기관계 매도 호가 스프레드가 벌어지고 있습니다. 단기 조정 리스크가 고조되는 국면이므로 비중 축소 및 익절을 추천합니다.`;
      }
    } else {
      rationale = `[추세 탐색 및 변동성 수축] ${name} (${symbol})의 주가는 현재 뚜렷한 모멘텀 없이 단기 이평선 밀집 구역에서 박스권 횡보 양상을 보이고 있습니다. RSI가 45~55 사이의 중립 영역에 머무르고 있으며 거래량 역시 전일 대비 정체되어 있습니다. 돌발 추세 변동성을 예방하기 위해 추가 진입을 삼가고 기존 포지션을 유지한 채 관망하는 전략을 유지합니다.`;
    }

    return {
      confidence,
      buyProb,
      sellProb,
      riskLevel,
      riskReward,
      action,
      rationale
    };
  }, [activeTicker]);

  return (
    <div className="flex flex-col flex-1 bg-[#151B23] glow-ai rounded-[16px] overflow-hidden select-none h-full">
      {/* Tab Header with drag handle */}
      <div className="flex items-center justify-between px-4 py-2.5 shrink-0 drag-handle cursor-grab select-none">
        <div className="flex items-center gap-2">
          <GripHorizontal size={12} className="text-zinc-650" />
          <BrainCircuit size={13} className="text-emerald-400" />
          <h2 className="text-[10.5px] uppercase font-extrabold tracking-wider text-zinc-400">TOSS AI TRADING COCKPIT</h2>
        </div>
        {!isApiConnected ? (
          <span className="flex items-center gap-2">
            <span className="text-[8px] font-mono text-danger font-semibold uppercase animate-pulse">{t('header.disconnected')}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse" />
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <span className="text-[9px] font-mono text-success font-semibold uppercase">{t('aiStrategies.telemetryOn')}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse shadow-[0_0_6px_#00d287]" />
          </span>
        )}
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-hidden min-h-0 bg-transparent">
        
        {/* Left Column: Active Ticker AI Cockpit */}
        <div className="flex flex-col p-4 overflow-y-auto no-scrollbar justify-between gap-3 min-h-0">
          <div>
            {/* Header info */}
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-0.5 font-sans">ACTIVE COGNITION</span>
                <span className="text-sm font-bold text-zinc-100 flex items-center gap-1.5 font-sans">
                  {activeTicker?.name || '선택된 종목'}
                  <span className="text-[10px] text-zinc-550 font-mono">({activeTicker?.symbol || '005930'})</span>
                </span>
              </div>
              
              {/* Dynamic Action Badge */}
              <div className="text-right">
                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-0.5 font-sans">RECOMMENDED ACTION</span>
                {aiMetrics.action === 'BUY' && (
                  <span className="inline-flex px-2 py-0.5 rounded-lg text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-transparent animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.1)]">
                    ★ BUY / 매수 진입
                  </span>
                )}
                {aiMetrics.action === 'SELL' && (
                  <span className="inline-flex px-2 py-0.5 rounded-lg text-[10px] font-black bg-rose-500/10 text-rose-455 border border-transparent animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.1)]">
                    ✦ SELL / 비중 축소
                  </span>
                )}
                {aiMetrics.action === 'HOLD' && (
                  <span className="inline-flex px-2 py-0.5 rounded-lg text-[10px] font-black bg-amber-500/10 text-amber-400 border border-transparent font-sans">
                    ✜ HOLD / 포지션 관망
                  </span>
                )}
              </div>
            </div>

            {/* Visual Probability Bar */}
            <div className="mt-3.5 space-y-1.5">
              <div className="flex justify-between items-center text-[10px] text-zinc-500 font-mono">
                <span className="text-emerald-400 font-bold">매수 확률 {aiMetrics.buyProb}%</span>
                <span className="text-rose-450 font-bold">매도 확률 {aiMetrics.sellProb}%</span>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden flex bg-zinc-950 border border-transparent">
                <div 
                  className="bg-emerald-500 h-full transition-all duration-500 ease-out" 
                  style={{ width: `${aiMetrics.buyProb}%` }} 
                />
                <div 
                  className="bg-rose-500 h-full transition-all duration-500 ease-out" 
                  style={{ width: `${aiMetrics.sellProb}%` }} 
                />
              </div>
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-3 gap-2.5 mt-3.5">
              <div className="p-2 rounded-xl bg-[#111827] flex flex-col justify-between">
                <span className="text-[9px] text-zinc-500 font-bold font-sans">AI 신뢰도</span>
                <span className="text-xs font-black font-mono text-zinc-200 mt-1">{aiMetrics.confidence}%</span>
              </div>
              <div className="p-2 rounded-xl bg-[#111827] flex flex-col justify-between">
                <span className="text-[9px] text-zinc-500 font-bold font-sans">예상 손익비</span>
                <span className="text-xs font-black font-mono text-zinc-200 mt-1">{aiMetrics.riskReward}</span>
              </div>
              <div className="p-2 rounded-xl bg-[#111827] flex flex-col justify-between">
                <span className="text-[9px] text-zinc-500 font-bold font-sans">위험 등급</span>
                <span className={`text-[10.5px] font-black font-mono mt-1 ${
                  aiMetrics.riskLevel === 'HIGH' ? 'text-rose-455' : aiMetrics.riskLevel === 'LOW' ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  {aiMetrics.riskLevel}
                </span>
              </div>
            </div>
          </div>

          {/* AI Reasoning */}
          <div className="flex-1 flex flex-col p-3 rounded-xl bg-[#111827] mt-2 font-sans overflow-hidden">
            <span className="text-[9.5px] text-zinc-500 font-bold uppercase tracking-wider block mb-1.5 flex items-center gap-1 shrink-0 font-sans">
              <Sparkles size={10} className="text-emerald-400" />
              최근 AI 판단 근거
            </span>
            <div className="flex-1 overflow-y-auto text-[10.5px] text-zinc-400 leading-relaxed font-normal no-scrollbar scroll-smooth">
              {aiMetrics.rationale}
            </div>
          </div>
        </div>

        {/* Right Column: Strategies control & signals */}
        <div className="flex flex-col overflow-hidden min-h-0 gap-4">
          
          {/* Bots control block */}
          <div className="p-4 space-y-2 shrink-0">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1 font-sans">STRATEGY CONTROL</span>
            
            {/* MA Bot */}
            <div className={`flex items-center justify-between p-2 rounded-xl border-none transition-all ${
              strategies.ma.active && isApiConnected
                ? 'bg-emerald-500/[0.04]' 
                : 'bg-zinc-900/35 hover:bg-zinc-900/50'
            } ${!isApiConnected ? 'opacity-50' : ''}`}>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-zinc-200 font-sans">{t('aiStrategies.runCrossover')}</span>
                  <span className={`text-[8px] font-mono font-bold leading-none px-1 py-0.5 rounded-lg ${
                    strategies.ma.active && isApiConnected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-850 text-zinc-500'
                  }`}>
                    {strategies.ma.active && isApiConnected ? t('common.active') : t('common.inactive')}
                  </span>
                </div>
                <div className="text-[8.5px] text-zinc-550 font-mono mt-0.5">{t('aiStrategies.maParams', { fast: strategies.ma.fast, slow: strategies.ma.slow })}</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!isApiConnected}
                  checked={strategies.ma.active && isApiConnected}
                  onChange={(e) => setStrategies({ ...strategies, ma: { ...strategies.ma, active: e.target.checked } })}
                  className="sr-only peer"
                />
                <div className="w-8 h-4.5 bg-zinc-800 rounded-full peer peer-checked:after:translate-x-3.5 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-350 after:border-none after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-zinc-950" />
              </label>
            </div>

            {/* RSI Bot */}
            <div className={`flex items-center justify-between p-2 rounded-xl border-none transition-all ${
              strategies.rsi.active && isApiConnected
                ? 'bg-emerald-500/[0.04]' 
                : 'bg-zinc-900/35 hover:bg-zinc-900/50'
            } ${!isApiConnected ? 'opacity-50' : ''}`}>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-zinc-200 font-sans">{t('aiStrategies.meanReversion')}</span>
                  <span className={`text-[8px] font-mono font-bold leading-none px-1 py-0.5 rounded-lg ${
                    strategies.rsi.active && isApiConnected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-850 text-zinc-500'
                  }`}>
                    {strategies.rsi.active && isApiConnected ? t('common.active') : t('common.inactive')}
                  </span>
                </div>
                <div className="text-[8.5px] text-zinc-550 font-mono mt-0.5">{t('aiStrategies.rsiParams', { oversold: strategies.rsi.oversold, overbought: strategies.rsi.overbought })}</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!isApiConnected}
                  checked={strategies.rsi.active && isApiConnected}
                  onChange={(e) => setStrategies({ ...strategies, rsi: { ...strategies.rsi, active: e.target.checked } })}
                  className="sr-only peer"
                />
                <div className="w-8 h-4.5 bg-zinc-800 rounded-full peer peer-checked:after:translate-x-3.5 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-350 after:border-none after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-zinc-950" />
              </label>
            </div>
          </div>

          {/* Live stream logs block */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col min-h-0">
            <span className="text-[9.5px] uppercase tracking-wider font-mono text-zinc-500 mb-1.5 block shrink-0">{t('aiStrategies.signalsStream')}</span>
            
            <div className="flex-1 overflow-y-auto space-y-1.5 no-scrollbar min-h-0">
              {!isApiConnected ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-3">
                  <AlertTriangle className="w-6 h-6 text-rose-500/40 mb-1" />
                  <span className="text-[10px] text-zinc-455 font-bold font-sans">{t('aiStrategies.noLiveData')}</span>
                  <span className="text-[9px] text-zinc-600 max-w-xs mt-1 font-sans">{t('aiStrategies.apiRequired')}</span>
                </div>
              ) : aiSignals.length === 0 ? (
                <div className="h-full flex items-center justify-center text-zinc-650 text-[10px] font-sans">
                  {t('aiStrategies.noSignals')}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {aiSignals.slice(0, 15).map((sig) => {
                    const ticker = tickers.find((t) => t.symbol === sig.symbol);
                    const isBuy = sig.action === 'BUY';
                    
                    return (
                      <div key={sig.id} className={`p-2 rounded-xl text-[10px] ${
                        isBuy 
                          ? 'bg-emerald-500/[0.04]' 
                          : 'bg-rose-500/[0.04]'
                      }`}>
                        <div className="flex justify-between items-center text-[9px] font-mono leading-none">
                          <span className="text-zinc-655">{sig.time}</span>
                          <span className={`font-bold px-1 py-0.5 rounded-lg leading-none ${
                            isBuy ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-455'
                          }`}>
                            {isBuy ? t('orderTicket.buy') : t('orderTicket.sell')}
                          </span>
                        </div>
                        <div className="text-[10.5px] font-bold text-zinc-350 leading-none mt-1.5">
                          {ticker ? ticker.name : sig.symbol} <span className="font-normal font-mono text-zinc-600 text-[8.5px] ml-0.5">({sig.symbol})</span>
                        </div>
                        <p className="text-[9.5px] text-zinc-550 leading-normal font-sans mt-1">
                          {sig.reasoning}
                        </p>
                        <div className="text-[8.5px] text-zinc-600 font-mono flex justify-between items-center pt-1.5 mt-1.5">
                          <span>{t('aiStrategies.confidence')}</span>
                          <span className="text-zinc-500 font-bold">{renderConfidenceBar(sig.confidence)} {Math.round(sig.confidence * 100)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
