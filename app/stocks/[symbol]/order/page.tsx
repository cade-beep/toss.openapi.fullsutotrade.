'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWorkstation } from '@/lib/context/workstation-context';
import { useI18n } from '@/lib/i18n/i18n-context';
import Header from '@/components/layout/header';
import Footer from '@/components/layout/footer';

export default function StockDetailPage() {
  const params = useParams();
  const router = useRouter();
  const symbol = (params?.symbol as string) || '005930';

  const {
    tickers,
    cashBalance,
    positions,
    executeTrade,
    showToast,
    isApiConnected,
    theme,
    isHydrated,
  } = useWorkstation();

  const { t, formatCurrency } = useI18n();

  // Find ticker details, mock if missing
  const ticker = useMemo(() => {
    const found = tickers.find((t) => t.symbol === symbol);
    if (found) return found;
    // Fallback Mock Ticker
    const mockBasePrice = 75000;
    return {
      symbol,
      name: symbol === '005930' ? '삼성전자' : symbol === '000660' ? 'SK하이닉스' : symbol === '035420' ? 'NAVER' : `주식 ${symbol}`,
      price: mockBasePrice,
      change: 2.45,
      high: mockBasePrice + 1200,
      low: mockBasePrice - 800,
      history: [mockBasePrice - 1000, mockBasePrice - 500, mockBasePrice + 200, mockBasePrice + 800, mockBasePrice + 1200, mockBasePrice + 500, mockBasePrice],
    };
  }, [tickers, symbol]);

  // Sync focused symbol to context
  const { setSelectedSymbol } = useWorkstation();
  useEffect(() => {
    if (symbol) {
      setSelectedSymbol(symbol);
    }
  }, [symbol, setSelectedSymbol]);

  // Page Sub-states
  const chartIntervals: Array<'10분' | '일' | '주' | '월' | '년'> = ['10분', '일', '주', '월', '년'];
  const [chartInterval, setChartInterval] = useState<'10분' | '일' | '주' | '월' | '년'>('일');
  
  const detailTabs: Array<'차트·호가' | '종목정보' | '뉴스·공시' | '거래현황' | '커뮤니티'> = ['차트·호가', '종목정보', '뉴스·공시', '거래현황', '커뮤니티'];
  const [detailTab, setDetailTab] = useState<'차트·호가' | '종목정보' | '뉴스·공시' | '거래현황' | '커뮤니티'>('차트·호가');
  
  // Order book tab states
  // const [bookTab, setBookTab] = useState<'호가' | '체결'>('호가');
  // const [investorTab, setInvestorTab] = useState<'개인·외국인·기관' | '공매도'>('개인·외국인·기관');

  // Trade Ticket states
  const [orderSide, setOrderSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<'LIMIT' | 'MARKET'>('LIMIT');
  const [orderPrice, setOrderPrice] = useState<number>(ticker.price);
  const [orderQty, setOrderQty] = useState<number>(10);

  // Sync order price during render when ticker symbol or market price changes
  const [prevSymbol, setPrevSymbol] = useState<string>(ticker.symbol);
  const [prevMarketPrice, setPrevMarketPrice] = useState<number>(ticker.price);
  
  if (ticker.symbol !== prevSymbol) {
    setOrderPrice(ticker.price);
    setPrevSymbol(ticker.symbol);
    setPrevMarketPrice(ticker.price);
  } else if (orderType === 'MARKET' && ticker.price !== prevMarketPrice) {
    setOrderPrice(ticker.price);
    setPrevMarketPrice(ticker.price);
  }

  // Find user's active holdings for this stock
  const currentPosition = useMemo(() => {
    return positions.find((p) => p.symbol === symbol) || null;
  }, [positions, symbol]);

  // Comments feed state (Mock Community)
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState<Array<{ id: number; author: string; content: string; time: string; upvotes: number }>>([
    { id: 1, author: '갓구글', content: '삼성전자 수익률 50% 가자!! 🚀🚀', time: '5분 전', upvotes: 12 },
    { id: 2, author: '개미는뚠뚠', content: '오늘 외국인 매수세 강하네요. 내일 갭상승 조심스레 기대해봅니다.', time: '12분 전', upvotes: 8 },
    { id: 3, author: '탑독', content: '반도체 사이클 돌아오는 거 보면 지금이 풀매수 타이밍임.', time: '23분 전', upvotes: 21 },
    { id: 4, author: '인피니티', content: '평단 68,000원 주주인데 배당 먹으면서 버팁니다.', time: '40분 전', upvotes: 15 },
  ]);

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    const comment = {
      id: Date.now(),
      author: '나(주주)',
      content: newComment,
      time: '방금 전',
      upvotes: 0,
    };
    setComments([comment, ...comments]);
    setNewComment('');
  };

  // Generate Ask/Bid Order Book Queues
  const orderBookLevels = useMemo(() => {
    const levels = 8;
    const tickSize = Math.round(ticker.price * 0.001) || 1;
    const askQueue: Array<{ price: number; volume: number }> = [];
    const bidQueue: Array<{ price: number; volume: number }> = [];

    for (let i = levels; i >= 1; i--) {
      askQueue.push({
        price: ticker.price + i * tickSize,
        volume: Math.round(500 + ((ticker.price * i) % 9500)),
      });
    }

    for (let i = 1; i <= levels; i++) {
      bidQueue.push({
        price: ticker.price - i * tickSize,
        volume: Math.round(500 + ((ticker.price * (i + 10)) % 9500)),
      });
    }

    return { askQueue, bidQueue };
  }, [ticker.price]);

  // Chart data scale mapping based on interval to show real history since listing
  const chartPoints = useMemo(() => {
    const base = ticker.history;
    if (!base || base.length === 0) return [ticker.price];

    switch (chartInterval) {
      case '10분':
        // Intraday: show the last 30 daily points
        return base.slice(-30);
      case '주':
        // Weekly downsampling: select every 5th point
        return base.filter((_, idx) => idx % 5 === 0);
      case '월':
        // Monthly downsampling: select every 20th point
        return base.filter((_, idx) => idx % 20 === 0);
      case '년':
        // Yearly downsampling: select every 250th point
        return base.filter((_, idx) => idx % 250 === 0);
      case '일':
      default:
        // Full history since listing
        return base;
    }
  }, [ticker.history, ticker.price, chartInterval]);

  const isUp = ticker.change >= 0;
  const changeColor = isUp ? 'text-success' : 'text-danger';
  // changeBg is unused
  const strokeColor = isUp ? '#00C853' : '#FF3B30';
  const gradId = `detail-area-grad-${ticker.symbol}`;

  // Handle quantity shortcut buttons
  const handleQtyShortcut = (percent: number) => {
    if (orderSide === 'BUY') {
      const targetFunds = cashBalance * percent;
      const qty = Math.floor(targetFunds / orderPrice);
      setOrderQty(Math.max(1, qty));
    } else {
      if (currentPosition) {
        const qty = Math.floor(currentPosition.qty * percent);
        setOrderQty(Math.max(1, qty));
      } else {
        setOrderQty(1);
      }
    }
  };

  const handleOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isApiConnected) {
      showToast(t('orderTicket.apiRequired'), 'error');
      return;
    }
    if (orderQty <= 0) {
      showToast(t('orderTicket.validationQty'), 'error');
      return;
    }
    if (orderSide === 'BUY' && orderQty * orderPrice > cashBalance) {
      showToast(t('orderTicket.validationFunds'), 'error');
      return;
    }
    if (orderSide === 'SELL' && (!currentPosition || currentPosition.qty < orderQty)) {
      showToast('주문 실패: 보유 주식이 부족합니다.', 'error');
      return;
    }
    
    executeTrade(symbol, orderSide, orderQty, orderPrice);
  };

  if (!isHydrated) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-black text-emerald-500 font-mono text-xs gap-2 select-none">
        <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span>{t('common.initializing')}</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-screen w-screen overflow-hidden ${theme === 'dark' ? 'bg-zinc-950' : 'bg-white'} text-zinc-300 select-none`}>
      <Header />

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden p-3 gap-3">
        
        {/* Left Section: Details & Chart (Width: 50%) */}
        <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-1">
          
          {/* Stock Info Title Bar */}
          <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-zinc-900/40 border-zinc-900' : 'bg-slate-50/50 border-zinc-200/60'}`}>
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-sm ${isUp ? 'bg-success' : 'bg-danger'}`}>
                  {ticker.name.substring(0, 2)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>{ticker.name}</h1>
                    <span className="font-mono text-xs text-zinc-400">{ticker.symbol}</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-200/60 text-zinc-500 font-medium font-sans">국내</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 font-sans mt-0.5">코스피 IT가전 · 100위 밖</div>
                </div>
              </div>
              <button 
                onClick={() => router.push('/')}
                className={`px-3 py-1 rounded text-xs font-semibold border transition-all ${
                  theme === 'dark' 
                    ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white' 
                    : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                ← {t('common.dashboard')}
              </button>
            </div>

            {/* Price section */}
            <div className="mt-3 flex items-baseline gap-2.5">
              <span className={`text-2xl font-extrabold ${theme === 'dark' ? 'text-white' : 'text-zinc-950'}`}>
                {formatCurrency(ticker.price)}
              </span>
              <span className={`text-sm font-bold ${changeColor}`}>
                {isUp ? '▲' : '▼'}{Math.abs(ticker.change).toFixed(2)}%
              </span>
            </div>
            
            {/* Stats row */}
            <div className="mt-3 grid grid-cols-4 gap-2 pt-2 border-t border-dashed border-zinc-200/50 text-[10px] text-zinc-500 font-mono">
              <div>
                <span className="block text-zinc-400 font-sans">1일 최저</span>
                <span>{formatCurrency(ticker.low)}</span>
              </div>
              <div>
                <span className="block text-zinc-400 font-sans">1일 최고</span>
                <span>{formatCurrency(ticker.high)}</span>
              </div>
              <div>
                <span className="block text-zinc-400 font-sans">거래대금</span>
                <span>389억원</span>
              </div>
              <div>
                <span className="block text-zinc-400 font-sans">외국인소유</span>
                <span>9.21%</span>
              </div>
            </div>
          </div>

          {/* Subnavigation Tabs */}
          <div className="flex border-b border-zinc-200/60 text-xs font-semibold shrink-0">
            {detailTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setDetailTab(tab)}
                className={`px-4 py-2 border-b-2 transition-all cursor-pointer ${
                  detailTab === tab
                    ? 'border-primary text-primary font-bold'
                    : 'border-transparent text-zinc-400 hover:text-zinc-600'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Chart Content Area */}
          {detailTab === '차트·호가' ? (
            <div className={`flex flex-col flex-1 p-4 rounded-xl border min-h-[300px] ${
              theme === 'dark' ? 'bg-zinc-900/20 border-zinc-900' : 'bg-slate-50/20 border-zinc-200/60'
            }`}>
              {/* Interval Switcher */}
              <div className="flex gap-2 mb-3">
                {chartIntervals.map((interval) => (
                  <button
                    key={interval}
                    onClick={() => setChartInterval(interval)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                      chartInterval === interval
                        ? 'bg-zinc-800 text-white'
                        : 'text-zinc-400 hover:text-zinc-600'
                    }`}
                  >
                    {interval}
                  </button>
                ))}
              </div>

              {/* Graphic Chart SVG */}
              <div className="flex-1 flex flex-col justify-end py-2 relative overflow-hidden bg-black/5 rounded-lg border border-zinc-200/10">
                <svg className="w-full h-full overflow-visible px-2 py-4" viewBox="0 0 500 220">
                  <defs>
                    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={strokeColor} stopOpacity="0.12"/>
                      <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0"/>
                    </linearGradient>
                  </defs>

                  {(() => {
                    const points = chartPoints;
                    const minVal = Math.min(...points) * 0.999;
                    const maxVal = Math.max(...points) * 1.001;
                    const range = maxVal - minVal || 1;

                    const mapX = (idx: number) => points.length <= 1 ? 250 : (idx / (points.length - 1)) * 480 + 10;
                    const mapY = (val: number) => 180 - ((val - minVal) / range) * 140;

                    const linePath = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${mapX(idx)} ${mapY(p)}`).join(' ');
                    const areaPath = `${linePath} L ${mapX(points.length - 1)} 220 L ${mapX(0)} 220 Z`;

                    return (
                      <>
                        <path d={areaPath} fill={`url(#${gradId})`} />
                        <path d={linePath} fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        {points.map((p, idx) => {
                          const isLast = idx === points.length - 1;
                          if (points.length > 30 && !isLast) return null;
                          return (
                            <circle
                              key={idx}
                              cx={mapX(idx)}
                              cy={mapY(p)}
                              r="2.5"
                              fill={isLast ? strokeColor : theme === 'dark' ? '#18181b' : '#ffffff'}
                              stroke={strokeColor}
                              strokeWidth="1.2"
                            />
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>
              </div>

              {/* Why did it rise section */}
              <div className="mt-4 p-3 bg-primary/5 rounded-xl border border-primary/10">
                <h3 className="text-xs font-bold text-primary flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  왜 올랐을까?
                </h3>
                <p className="text-[11px] text-zinc-500 leading-relaxed mt-1 font-sans">
                  실리콘 커패시터 대형 수주 및 AI 부품 사업 확대로 {ticker.name} 가격이 강한 거래 동력을 받았습니다.
                  투자자의 심리 회복과 실적 기대감이 복합적으로 작용해 주가를 크게 견인한 상태입니다.
                </p>
              </div>
            </div>
          ) : detailTab === '커뮤니티' ? (
            <div className={`flex flex-col flex-1 p-4 rounded-xl border ${
              theme === 'dark' ? 'bg-zinc-900/20 border-zinc-900' : 'bg-slate-50/20 border-zinc-200/60'
            }`}>
              {/* Write opinion */}
              <form onSubmit={handleAddComment} className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="주주들과 의견을 공유해 보세요..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className={`flex-1 px-3 py-1.5 border rounded-xl text-xs focus:outline-none focus:border-primary ${
                    theme === 'dark' ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-zinc-200 text-zinc-900'
                  }`}
                />
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-colors cursor-pointer"
                >
                  등록
                </button>
              </form>

              {/* Opinions log list */}
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[300px]">
                {comments.map((comment) => (
                  <div key={comment.id} className={`p-3 rounded-xl border text-xs leading-relaxed ${
                    theme === 'dark' ? 'bg-zinc-900/40 border-zinc-900' : 'bg-white border-zinc-100'
                  }`}>
                    <div className="flex justify-between items-center text-[10px] text-zinc-500 font-bold mb-1">
                      <span>{comment.author}</span>
                      <span>{comment.time}</span>
                    </div>
                    <p className="text-zinc-700 font-sans">{comment.content}</p>
                    <div className="mt-2 text-[10px] text-zinc-500 flex items-center gap-1 font-mono">
                      <span>👍 {comment.upvotes}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-12 text-center text-zinc-400 font-sans text-xs">
              상세 정보 탭 준비 중...
            </div>
          )}
        </div>

        {/* Center Section: Order Book / Market Depth (Width: 22%) */}
        <div className="w-56 flex flex-col bg-zinc-950 border border-zinc-900 rounded-xl overflow-hidden shrink-0 select-none font-mono">
          <div className="px-3 py-1.5 bg-black/40 border-b border-zinc-900/60 text-[9px] uppercase tracking-wider text-zinc-500 shrink-0 font-bold flex justify-between">
            <span>호가창</span>
            <span className="text-zinc-650">A005930</span>
          </div>

          {/* Ask Bid columns */}
          <div className="flex-1 flex flex-col justify-between overflow-y-auto text-[10.5px]">
            
            {/* Ask levels (Upper - Reddish) */}
            <div className="flex-1 flex flex-col justify-end divide-y divide-zinc-900/20 bg-danger/5">
              {orderBookLevels.askQueue.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => setOrderPrice(item.price)}
                  className="flex justify-between items-center py-1.5 px-2.5 hover:bg-danger/10 transition-colors cursor-pointer relative"
                >
                  {/* volume bar */}
                  <div className="absolute right-0 top-0 bottom-0 bg-danger/5" style={{ width: `${(item.volume / 10000) * 100}%` }} />
                  <span className="text-danger font-bold z-10">{item.price.toLocaleString()}</span>
                  <span className="text-zinc-550 text-[9px] z-10">{item.volume.toLocaleString()}</span>
                </div>
              ))}
            </div>

            {/* Current Price display */}
            <div className="py-2.5 px-3 bg-zinc-900/80 border-y border-zinc-800 flex justify-between items-center shrink-0">
              <span className="text-[10px] text-zinc-500 font-sans font-bold">현재가</span>
              <span className={`text-sm font-extrabold ${changeColor}`}>
                {ticker.price.toLocaleString()}
              </span>
            </div>

            {/* Bid levels (Lower - Bluish) */}
            <div className="flex-1 flex flex-col divide-y divide-zinc-900/20 bg-success/5">
              {orderBookLevels.bidQueue.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => setOrderPrice(item.price)}
                >
                  {/* volume bar */}
                  <div className="absolute right-0 top-0 bottom-0 bg-blue-500/5" style={{ width: `${(item.volume / 10000) * 100}%` }} />
                  <span className="text-blue-400 font-bold z-10">{item.price.toLocaleString()}</span>
                  <span className="text-zinc-500 text-[9px] z-10">{item.volume.toLocaleString()}</span>
                </div>
              ))}
            </div>

          </div>

          <div className="p-1 border-t border-zinc-900/60 bg-black/20 flex divide-x divide-zinc-900 text-[9px] text-center font-sans text-zinc-500 shrink-0">
            <button className="flex-1 py-1 font-semibold hover:text-zinc-300 transition-colors">주체별 매매</button>
            <button className="flex-1 py-1 font-semibold hover:text-zinc-300 transition-colors">실시간 매도</button>
          </div>
        </div>

        {/* Right Section: Trade Form & Holdings (Width: 28%) */}
        <div className="w-80 flex flex-col gap-3 shrink-0 overflow-y-auto">
          
          {/* Main Trade Ticket Form Box */}
          <div className={`p-4 rounded-xl border flex flex-col ${
            theme === 'dark' ? 'bg-zinc-900/40 border-zinc-900' : 'bg-slate-50/50 border-zinc-200/60'
          }`}>
            <h2 className="text-xs uppercase font-bold tracking-wider text-zinc-500 mb-3 border-b border-zinc-200/20 pb-1.5 flex justify-between items-center">
              <span>{orderSide === 'BUY' ? '주식 구매' : '주식 판매'}</span>
              <span className="text-[10px] font-mono text-zinc-400">{ticker.symbol}</span>
            </h2>

            {/* Buy / Sell Tabs */}
            <div className="grid grid-cols-2 gap-1 p-0.5 bg-zinc-900/20 rounded-xl border border-zinc-200/10">
              <button
                type="button"
                onClick={() => setOrderSide('BUY')}
                className={`py-1 text-center font-bold text-[10px] uppercase rounded-xl transition-colors cursor-pointer ${
                  orderSide === 'BUY'
                    ? 'bg-success text-white'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                구매
              </button>
              <button
                type="button"
                onClick={() => setOrderSide('SELL')}
                className={`py-1 text-center font-bold text-[10px] uppercase rounded-xl transition-colors cursor-pointer ${
                  orderSide === 'SELL'
                    ? 'bg-danger text-white'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                판매
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleOrderSubmit} className="space-y-3 mt-4 text-[11px]">
              
              {/* Type selector */}
              <div className="flex justify-between items-center">
                <span className="text-zinc-500 font-sans">{t('orderTicket.limit')} / {t('orderTicket.market')}:</span>
                <div className="flex gap-3 font-mono text-[10px]">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="detailOrderType"
                      checked={orderType === 'LIMIT'}
                      onChange={() => setOrderType('LIMIT')}
                      className="accent-primary"
                    />
                    <span className={orderType === 'LIMIT' ? 'text-zinc-200 font-semibold' : 'text-zinc-500'}>{t('orderTicket.limit')}</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="detailOrderType"
                      checked={orderType === 'MARKET'}
                      onChange={() => setOrderType('MARKET')}
                      className="accent-primary"
                    />
                    <span className={orderType === 'MARKET' ? 'text-zinc-200 font-semibold' : 'text-zinc-500'}>{t('orderTicket.market')}</span>
                  </label>
                </div>
              </div>

              {/* Price input */}
              <div className="flex justify-between items-center">
                <span className="text-zinc-500 font-sans">구매 단가:</span>
                <div className="relative">
                  <input
                    type="number"
                    disabled={orderType === 'MARKET'}
                    value={orderType === 'MARKET' ? ticker.price : orderPrice}
                    onChange={(e) => setOrderPrice(Number(e.target.value))}
                    className={`w-32 bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 py-1 text-right font-mono text-zinc-250 focus:outline-none text-[11px] ${
                      orderType === 'MARKET' ? 'opacity-40 bg-zinc-950/40 text-zinc-500' : ''
                    }`}
                  />
                  <span className="absolute right-3 top-1 text-[9px] text-zinc-500">원</span>
                </div>
              </div>

              {/* Quantity input */}
              <div className="flex justify-between items-center">
                <span className="text-zinc-500 font-sans">수량:</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setOrderQty(Math.max(1, orderQty - 1))}
                    className="w-5 h-5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center hover:bg-zinc-850 font-bold cursor-pointer text-zinc-400"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={orderQty}
                    onChange={(e) => setOrderQty(Math.max(1, Number(e.target.value)))}
                    className="w-16 bg-zinc-900 border border-zinc-800 rounded-xl py-0.5 text-center font-mono text-zinc-200 focus:outline-none text-[11px]"
                  />
                  <button
                    type="button"
                    onClick={() => setOrderQty(orderQty + 1)}
                    className="w-5 h-5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center hover:bg-zinc-850 font-bold cursor-pointer text-zinc-400"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Percentage shortcuts */}
              <div className="grid grid-cols-4 gap-1 text-[9px] text-center font-mono select-none">
                {[0.1, 0.25, 0.5, 1.0].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleQtyShortcut(p)}
                    className="py-0.5 rounded-xl bg-zinc-900/60 border border-zinc-850 hover:border-zinc-800 hover:text-zinc-300 text-zinc-500 transition-colors cursor-pointer"
                  >
                    {p === 1.0 ? '최대' : `${p * 100}%`}
                  </button>
                ))}
              </div>

              {/* Balances details */}
              <div className="border-t border-zinc-200/10 pt-2.5 font-mono text-[10px] text-zinc-500 space-y-1">
                <div className="flex justify-between">
                  <span className="font-sans text-[10px] text-zinc-450">총 주문 금액:</span>
                  <span className={`text-white font-extrabold text-[11.5px] ${orderSide === 'BUY' ? 'text-success' : 'text-danger'}`}>
                    {formatCurrency(orderQty * orderPrice)}
                  </span>
                </div>
                <div className="flex justify-between text-[9px] text-zinc-650">
                  <span className="font-sans text-zinc-500">주문가능 예수금:</span>
                  <span>{formatCurrency(cashBalance)}</span>
                </div>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                className={`w-full py-2 font-bold rounded-xl tracking-wider text-xs transition-colors cursor-pointer uppercase ${
                  orderSide === 'BUY'
                    ? 'bg-success hover:bg-success/90 text-white shadow-lg shadow-success/10'
                    : 'bg-danger hover:bg-danger/90 text-white shadow-lg shadow-danger/10'
                }`}
              >
                {orderSide === 'BUY' ? '구매하기' : '판매하기'}
              </button>
            </form>
          </div>

          {/* User Active Holdings summary (Samsung Electro-Mechanics/Samsung Electronics positions info) */}
          <div className={`p-4 rounded-xl border flex flex-col ${
            theme === 'dark' ? 'bg-zinc-900/40 border-zinc-900' : 'bg-slate-50/50 border-zinc-200/60'
          }`}>
            <h2 className="text-xs font-bold text-zinc-400 mb-2 border-b border-zinc-200/10 pb-1.5 flex justify-between items-center">
              <span>보유 주식</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-900 text-zinc-500 font-mono">
                {currentPosition ? `${currentPosition.qty}주` : '0주'}
              </span>
            </h2>

            {currentPosition ? (
              <div className="space-y-1.5 font-mono text-[10.5px]">
                <div className="flex justify-between">
                  <span className="text-zinc-500 font-sans">평가 손익:</span>
                  {(() => {
                    const totalCost = currentPosition.qty * currentPosition.avgBuyPrice;
                    const currentValue = currentPosition.qty * ticker.price;
                    const pnl = currentValue - totalCost;
                    const pnlPct = Number(((pnl / totalCost) * 100).toFixed(2));
                    return (
                      <span className={`font-bold ${pnl >= 0 ? 'text-success' : 'text-danger'}`}>
                        {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)} ({pnlPct}%)
                      </span>
                    );
                  })()}
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500 font-sans">매입 평단가:</span>
                  <span className="text-zinc-300">{formatCurrency(currentPosition.avgBuyPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500 font-sans">평가 금액:</span>
                  <span className="text-zinc-300">{formatCurrency(currentPosition.qty * ticker.price)}</span>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center text-[10.5px] text-zinc-500 font-sans">
                보유 중인 주식이 없습니다.
              </div>
            )}
          </div>

        </div>

      </div>

      <Footer />
    </div>
  );
}
