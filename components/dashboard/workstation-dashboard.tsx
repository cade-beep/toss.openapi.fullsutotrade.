'use client';

import React, { useState, useMemo } from 'react';
import { useWorkstation } from '@/lib/context/workstation-context';
import { useI18n } from '@/lib/i18n/i18n-context';
import Header from '@/components/layout/header';
import Footer from '@/components/layout/footer';
import Link from 'next/link';
import { IndicesBanner } from '@/components/dashboard/indices-banner';
import { MarketRankings } from '@/components/dashboard/market-rankings';
import { SidebarTabRail } from '@/components/dashboard/sidebar-tab-rail';
import MarketChartPanel from '@/components/dashboard/market-chart';
import AIStrategiesPanel from '@/components/dashboard/ai-strategies';
import OrderTicketPanel from '@/components/dashboard/order-ticket';
import PositionsPanel from '@/components/dashboard/positions';
import { WidgetLayout } from '@/components/dashboard/widget-layout';
import { useDashboardLayout } from '@/components/dashboard/hooks/use-dashboard-layout';
import type {
  ChartTimeline,
  FilterPill,
  GlobalIndex,
  MarketTab,
  SidebarTab,
} from '@/components/dashboard/workstation-dashboard-types';
import {
  TrendingUp,
  TrendingDown,
  Search,
  Star,
  Zap,
  Activity,
  Briefcase,
  X,
  AlertTriangle,
  Sparkles,
  Info
} from 'lucide-react';

const POPULAR_PRESETS = [
  { symbol: '005930', name: '삼성전자' },
  { symbol: '000660', name: 'SK하이닉스' },
  { symbol: '035420', name: 'NAVER' },
  { symbol: '035720', name: '카카오' },
  { symbol: '005380', name: '현대차' },
  { symbol: '068270', name: '셀트리온' },
  { symbol: '373220', name: 'LG에너지솔루션' },
  { symbol: '005490', name: 'POSCO홀딩스' },
  { symbol: '247540', name: '에코프로비엠' },
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'TSLA', name: 'Tesla Inc.' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.' },
  { symbol: 'MSFT', name: 'Microsoft Corp.' },
];

export default function WorkstationDashboard() {
  const {
    isHydrated,
    toast,
    isApiConnected,
    tickers,
    selectedSymbol,
    setSelectedSymbol,
    cashBalance,
    positions,
    aiSignals,
    strategies,
    setStrategies,
    theme,
    executeTrade,
    handleAddTicker,
    handleRemoveTicker,
    toggleTheme,
    handlePanicSellAll,
  } = useWorkstation();

  const {
    layout,
    activeDrag,
    placeholder,
    startDrag,
    updateDrag,
    endDrag,
    resetLayout,
  } = useDashboardLayout();

  const { locale, setLocale, formatCurrency, t } = useI18n();
  const isDark = theme === 'dark';

  // Tabs / Filters state
  const [marketTab, setMarketTab] = useState<MarketTab>('실시간 인기');
  const [filterPill, setFilterPill] = useState<FilterPill>('전체');
  const [chartTimeline, setChartTimeline] = useState<ChartTimeline>('1D');

  // Trade Ticket states
  const [orderSide, setOrderSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderPrice, setOrderPrice] = useState<number>(0);
  const [orderQty, setOrderQty] = useState<number>(10);

  // Collapsible Sidebar States (Persistent sidebar context)
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('HOLDINGS');
  const [recentlyViewed, setRecentlyViewed] = useState<string[]>([]);
  const [favoriteSearch, setFavoriteSearch] = useState<string>('');
  const [listSearch, setListSearch] = useState<string>('');

  // Selected Ticker Details
  const activeTicker = useMemo(() => {
    return tickers.find((t) => t.symbol === selectedSymbol) || tickers[0] || {
      symbol: '005930',
      name: '삼성전자',
      price: 74200,
      change: 1.37,
      high: 74500,
      low: 73100,
      history: [73100, 73500, 73800, 74200]
    };
  }, [tickers, selectedSymbol]);

  // Track recently viewed symbols during render when activeTicker.symbol changes
  const [prevRecentSymbol, setPrevRecentSymbol] = useState<string>('');
  if (activeTicker.symbol && activeTicker.symbol !== 'KOSPI' && activeTicker.symbol !== 'KOSDAQ' && activeTicker.symbol !== prevRecentSymbol) {
    setRecentlyViewed((prev) => {
      const filtered = prev.filter((sym) => sym !== activeTicker.symbol);
      return [activeTicker.symbol, ...filtered].slice(0, 7);
    });
    setPrevRecentSymbol(activeTicker.symbol);
  }

  // Sync order price during render when the selected symbol changes
  const [prevSymbol, setPrevSymbol] = useState<string>(activeTicker.symbol);
  if (activeTicker.symbol !== prevSymbol) {
    setOrderPrice(activeTicker.price);
    setPrevSymbol(activeTicker.symbol);
  }

  // Compute portfolio values
  const portfolioAssetsValue = useMemo(() => {
    return positions.reduce((total, pos) => {
      const ticker = tickers.find((t) => t.symbol === pos.symbol);
      const currentPrice = ticker ? ticker.price : pos.avgBuyPrice;
      return total + pos.qty * currentPrice;
    }, 0);
  }, [positions, tickers]);

  const portfolioTotalValue = cashBalance + portfolioAssetsValue;
  const portfolioAssetsCost = useMemo(() => {
    return positions.reduce((total, pos) => {
      return total + pos.qty * pos.avgBuyPrice;
    }, 0);
  }, [positions]);

  const portfolioPnL = portfolioAssetsValue - portfolioAssetsCost;
  const portfolioPnLPct = portfolioAssetsCost > 0
    ? Number(((portfolioPnL / portfolioAssetsCost) * 100).toFixed(2))
    : 0.0;

  // Global Indices banner data combining live context data and mock indexes
  const indicesData = useMemo<GlobalIndex[]>(() => {
    const liveKospi = tickers.find(t => t.symbol === 'KOSPI') || { price: 2511.10, change: -0.37, history: [2530, 2525, 2518, 2524, 2515, 2511] };
    const liveKosdaq = tickers.find(t => t.symbol === 'KOSDAQ') || { price: 845.94, change: 1.97, history: [830, 835, 832, 840, 843, 845] };

    return [
      {
        symbol: 'KOSPI',
        name: '코스피',
        price: liveKospi.price.toLocaleString(undefined, { minimumFractionDigits: 2 }),
        change: liveKospi.change >= 0 ? `+${(liveKospi.price * 0.003).toFixed(2)}` : `-${(liveKospi.price * 0.003).toFixed(2)}`,
        changePct: `${liveKospi.change >= 0 ? '+' : ''}${liveKospi.change}%`,
        isUp: liveKospi.change >= 0,
        history: liveKospi.history
      },
      {
        symbol: 'KOSDAQ',
        name: '코스닥',
        price: liveKosdaq.price.toLocaleString(undefined, { minimumFractionDigits: 2 }),
        change: liveKosdaq.change >= 0 ? `+${(liveKosdaq.price * 0.019).toFixed(2)}` : `-${(liveKosdaq.price * 0.019).toFixed(2)}`,
        changePct: `${liveKosdaq.change >= 0 ? '+' : ''}${liveKosdaq.change}%`,
        isUp: liveKosdaq.change >= 0,
        history: liveKosdaq.history
      },
      { symbol: 'NDX', name: '나스닥 100', price: '18,894.00', change: '+276.00', changePct: '+1.48%', isUp: true, history: [18600, 18650, 18700, 18780, 18850, 18894] },
      { symbol: 'SPX', name: 'S&P 500', price: '5,431.46', change: '+37.16', changePct: '+0.69%', isUp: true, history: [5390, 5400, 5412, 5410, 5425, 5431] },
      { symbol: 'USDKRW', name: '원/달러 환율', price: '1,374.50', change: '+5.20', changePct: '+0.38%', isUp: true, history: [1365, 1368, 1372, 1370, 1369, 1374.5] },
      { symbol: 'BTC', name: '비트코인', price: '98,894,000', change: '-278,000', changePct: '-0.28%', isUp: false, history: [99300, 99100, 99200, 98900, 98894] },
    ];
  }, [tickers]);

  // Tabbed filter rankings lists
  const rankedTickersList = useMemo(() => {
    let list = tickers.filter((t) => t.symbol !== 'KOSPI' && t.symbol !== 'KOSDAQ');

    // Filter by search query in list
    const query = listSearch.toLowerCase().trim();
    if (query) {
      list = list.filter((t) => t.name.toLowerCase().includes(query) || t.symbol.includes(query));
    }

    // Filter by DOMESTIC vs GLOBAL pills
    if (filterPill === '국내') {
      list = list.filter((t) => !t.symbol.match(/[A-Z]/)); // Heuristic for Korean symbols
    } else if (filterPill === '해외') {
      list = list.filter((t) => t.symbol.match(/[A-Z]/));
    }

    if (marketTab === '실시간 인기') {
      return list;
    }
    if (marketTab === '거래대금 상위') {
      return [...list].sort((a, b) => (b.price * 500) - (a.price * 500));
    }
    if (marketTab === '급상승 종목') {
      return [...list].sort((a, b) => b.change - a.change);
    }
    return list;
  }, [tickers, marketTab, filterPill, listSearch]);

  // Favorites list manager search filtering presets
  const filteredPresets = useMemo(() => {
    const query = favoriteSearch.toLowerCase().trim();
    if (!query) return POPULAR_PRESETS;
    return POPULAR_PRESETS.filter((p) => p.name.toLowerCase().includes(query) || p.symbol.includes(query));
  }, [favoriteSearch]);

  // Order quantity shortcuts
  const handleQtyShortcut = (percent: number) => {
    if (orderSide === 'BUY') {
      const qty = Math.floor((cashBalance * percent) / orderPrice);
      setOrderQty(Math.max(1, qty));
    } else {
      const position = positions.find((p) => p.symbol === activeTicker.symbol);
      if (position) {
        setOrderQty(Math.max(1, Math.floor(position.qty * percent)));
      } else {
        setOrderQty(1);
      }
    }
  };

  const handleOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isApiConnected) {
      alert('주문 실패: 모의투자 API가 연결되지 않았습니다. 헤더에서 활성화해 주세요.');
      return;
    }
    if (orderQty <= 0) {
      alert('주문 수량을 입력해주세요.');
      return;
    }
    if (orderSide === 'BUY' && orderQty * orderPrice > cashBalance) {
      alert('예수금이 부족합니다.');
      return;
    }
    const position = positions.find((p) => p.symbol === activeTicker.symbol);
    if (orderSide === 'SELL' && (!position || position.qty < orderQty)) {
      alert('보유 수량이 부족합니다.');
      return;
    }

    executeTrade(activeTicker.symbol, orderSide, orderQty, orderPrice, false);
  };

  const toggleSidebarTab = (tab: SidebarTab) => {
    if (sidebarOpen && activeSidebarTab === tab) {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(true);
      setActiveSidebarTab(tab);
    }
  };

  // Check if a ticker is currently starred (in watchlist)
  const isStarred = (symbol: string) => {
    return tickers.some((t) => t.symbol === symbol && t.symbol !== 'KOSPI' && t.symbol !== 'KOSDAQ');
  };

  const handleStarToggle = (symbol: string, name: string) => {
    if (isStarred(symbol)) {
      handleRemoveTicker(symbol);
    } else {
      handleAddTicker(symbol, name);
    }
  };

  if (!isHydrated) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-[#0B0F14] text-[#00D67A] font-mono text-xs gap-3 select-none">
        <div className="w-5 h-5 border-2 border-[#00D67A] border-t-transparent rounded-full animate-spin" />
        <span className="tracking-widest uppercase opacity-80">{t('common.initializing')}</span>
      </div>
    );
  }

  // Draw chart paths
  const getChartPath = (history: number[]) => {
    if (!history || history.length < 2) return { line: '', area: '' };
    const min = Math.min(...history);
    const max = Math.max(...history);
    const range = max - min || 1;
    const points = history.map((val, idx) => {
      const x = (idx / (history.length - 1)) * 520 + 10;
      const y = 175 - ((val - min) / range) * 145 - 5;
      return { x, y };
    });
    const linePath = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaPath = `${linePath} L 530 190 L 10 190 Z`;
    return { line: linePath, area: areaPath, points };
  };

  return (
    <div className={`flex flex-col h-screen w-screen overflow-hidden ${isDark ? 'bg-[#0B0F14]' : 'bg-[#F7F9FC]'} text-zinc-400 select-none font-sans`}>

      {/* Toast alert popups */}
      {toast && (
        <div className="absolute top-16 right-4 z-50 flex items-center gap-3 p-4 text-xs font-semibold rounded-[16px] bg-[#1E2535] shadow-[0_12px_40px_rgba(0,0,0,0.6)] text-white animate-fade-in backdrop-blur-md border border-white/5">
          <span className={`w-2 h-2 rounded-full ${
            toast.type === 'success' ? 'bg-[#00D67A] animate-pulse shadow-[0_0_8px_#00D67A]' : toast.type === 'error' ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]' : 'bg-blue-500'
          }`} />
          {toast.message}
        </div>
      )}

      {/* Header navbar */}
      <Header />

      <IndicesBanner indices={indicesData} isDark={isDark} />

      {/* 2. Main content block with persistent collapsible sidebar */}
      <div className="flex-1 flex overflow-hidden">

        <div className="flex-1 overflow-y-auto p-6 no-scrollbar relative min-h-0 bg-[#0B0F14]">
          <WidgetLayout
            layout={layout}
            activeDrag={activeDrag}
            placeholder={placeholder}
            startDrag={startDrag}
            updateDrag={updateDrag}
            endDrag={endDrag}
            cols={10}
            rowHeight={70}
            gap={16}
          >
            <div key="rankings" className="w-full h-full">
              <MarketRankings
                activeTab={marketTab}
                filter={filterPill}
                isDark={isDark}
                search={listSearch}
                selectedSymbol={selectedSymbol}
                tickers={rankedTickersList}
                isStarred={isStarred}
                onFilterChange={setFilterPill}
                onSearchChange={setListSearch}
                onSelectTicker={setSelectedSymbol}
                onStarToggle={handleStarToggle}
                onTabChange={setMarketTab}
              />
            </div>

            <div key="chart" className="w-full h-full">
              <MarketChartPanel />
            </div>

            <div key="aiEngine" className="w-full h-full">
              <AIStrategiesPanel />
            </div>

            <div key="orderTicket" className="w-full h-full">
              <OrderTicketPanel />
            </div>

            <div key="positions" className="w-full h-full">
              <PositionsPanel onSelectTicker={setSelectedSymbol} recentlyViewed={recentlyViewed} />
            </div>
          </WidgetLayout>
        </div>

        {/* 3. Collapsible right sidebar panel (Width: 340px when open, 0px when closed) */}
        <div
          className={`h-full flex transition-all duration-300 overflow-hidden shrink-0 ${
            sidebarOpen ? 'w-[340px]' : 'w-0'
          } ${
            isDark ? 'bg-[#111827] shadow-[-16px_0_40px_rgba(0,0,0,0.45)] z-30 border-l border-white/[0.035]' : 'bg-white shadow-[-12px_0_32px_rgba(0,0,0,0.05)]'
          }`}
        >
          {sidebarOpen && (
            <div className="w-[340px] h-full flex flex-col p-5 overflow-y-auto no-scrollbar font-medium">
              <div className="flex justify-between items-center pb-3 mb-5">
                <h3 className="text-xs font-black tracking-wider uppercase text-rose-500">
                  {activeSidebarTab === 'HOLDINGS' && '내 보유주식 포지션'}
                  {activeSidebarTab === 'FAVORITES' && '선호주식 관심종목'}
                  {activeSidebarTab === 'RECENT' && '최근에 살펴본 종목'}
                  {activeSidebarTab === 'SETTINGS' && '워크스테이션 개인설정'}
                </h3>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="text-zinc-500 hover:text-white transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Tab Content 1: Holdings */}
              {activeSidebarTab === 'HOLDINGS' && (
                <div className="space-y-4">
                  {/* Valuation summary */}
                  <div className="p-4 rounded-[16px] bg-[#151B23]">
                    <span className="text-[10px] text-zinc-500 font-bold block mb-2 uppercase tracking-wider">모의투자 계좌 자산</span>
                    <div className="flex justify-between items-baseline font-mono">
                      <span className="text-zinc-500 text-[11px]">총 평가액:</span>
                      <span className="text-white font-black text-base">{formatCurrency(portfolioTotalValue)}</span>
                    </div>
                    <div className="flex justify-between items-baseline font-mono mt-1.5 text-xs text-zinc-400">
                      <span>예수금:</span>
                      <span>{formatCurrency(cashBalance)}</span>
                    </div>
                    <div className="flex justify-between items-baseline font-mono mt-3 pt-3 text-xs text-zinc-500">
                      <span>누적 손익:</span>
                      <span className={`font-bold ${portfolioPnL >= 0 ? 'text-rose-500' : 'text-blue-500'}`}>
                        {portfolioPnL >= 0 ? '+' : ''}{formatCurrency(portfolioPnL)} ({portfolioPnLPct}%)
                      </span>
                    </div>
                  </div>

                  {/* Positions list */}
                  <div className="space-y-2">
                    <span className="text-[10px] text-zinc-500 font-bold block mb-1">내 보유 주식 ({positions.length})</span>
                    {positions.length === 0 ? (
                      <div className="py-12 text-center text-zinc-650 text-[11px] font-sans">
                        보유 중인 주식 포지션이 없습니다.
                      </div>
                    ) : (
                      positions.map((pos) => {
                        const ticker = tickers.find((t) => t.symbol === pos.symbol);
                        const currentPrice = ticker ? ticker.price : pos.avgBuyPrice;
                        const cost = pos.qty * pos.avgBuyPrice;
                        const val = pos.qty * currentPrice;
                        const pnl = val - cost;
                        const pnlPct = Number(((pnl / cost) * 100).toFixed(2));

                        return (
                          <div
                            key={pos.symbol}
                            onClick={() => setSelectedSymbol(pos.symbol)}
                            className="flex justify-between items-center p-3 rounded-[16px] bg-[#151B23]/60 hover:bg-[#1C2430] cursor-pointer transition-all"
                          >
                            <div className="min-w-0 pr-2">
                              <span className="font-bold text-zinc-200 block text-xs truncate">{ticker ? ticker.name : pos.symbol}</span>
                              <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block truncate">
                                {pos.qty}주 (평단 {formatCurrency(pos.avgBuyPrice)})
                              </span>
                            </div>
                            <div className="text-right font-mono shrink-0">
                              <span className="text-zinc-200 font-bold block text-xs">{formatCurrency(val)}</span>
                              <span className={`text-[10px] font-bold ${pnl >= 0 ? 'text-rose-500' : 'text-blue-500'}`}>
                                {pnl >= 0 ? '+' : ''}{pnlPct}%
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Panic sell button */}
                  {isApiConnected && positions.length > 0 && (
                    <button
                      onClick={() => {
                        if (confirm('긴급 전량 매도: 정말로 보유 중인 모든 주식을 일괄 시장가로 청산하시겠습니까?')) {
                          handlePanicSellAll();
                        }
                      }}
                      className="w-full py-3.5 rounded-[16px] bg-danger/10 hover:bg-danger/20 text-danger text-xs font-black tracking-wider transition-all cursor-pointer text-center flex items-center justify-center gap-2 shadow-lg"
                    >
                      <AlertTriangle size={12} className="animate-bounce" />
                      보유 포지션 긴급 일괄 청산
                    </button>
                  )}
                </div>
              )}

              {/* Tab Content 2: Favorites */}
              {activeSidebarTab === 'FAVORITES' && (
                <div className="space-y-4">
                  {/* Inline Tickers Search & Add manager */}
                  <div className="relative">
                    <Search size={12} className="absolute left-3 top-2.5 text-zinc-650" />
                    <input
                      type="text"
                      placeholder="관심종목 추가 (종목명 입력)..."
                      value={favoriteSearch}
                      onChange={(e) => setFavoriteSearch(e.target.value)}
                      className="w-full pl-8 pr-8 py-2 rounded-xl bg-zinc-900/40 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-800 text-zinc-100 placeholder-zinc-650 font-medium"
                    />
                    {favoriteSearch && (
                      <button
                        onClick={() => setFavoriteSearch('')}
                        className="absolute right-3 top-2.5 text-zinc-550 hover:text-white"
                      >
                        <X size={10} />
                      </button>
                    )}
                  </div>

                  {/* Dropdown presets list based on query */}
                  {favoriteSearch.trim() && (
                    <div className="rounded-[16px] bg-zinc-950/95 p-3 max-h-40 overflow-y-auto space-y-1.5 text-xs shadow-2xl backdrop-blur-md">
                      <span className="text-[10px] text-zinc-500 block mb-2 font-bold uppercase tracking-wider">검색 결과</span>
                      {filteredPresets.map((preset) => {
                        const starred = isStarred(preset.symbol);
                        return (
                          <div
                            key={preset.symbol}
                            className="flex justify-between items-center p-1.5 hover:bg-zinc-900/40 rounded-lg cursor-default"
                          >
                            <div className="flex flex-col">
                              <span className="font-bold text-zinc-200">{preset.name}</span>
                              <span className="text-[9px] text-zinc-550 font-mono">{preset.symbol}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                handleStarToggle(preset.symbol, preset.name);
                                setFavoriteSearch('');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-[10px] text-danger font-bold hover:text-white transition-all cursor-pointer"
                            >
                              {starred ? '삭제' : '추가'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* List of favorites */}
                  <div className="space-y-2">
                    <span className="text-[10px] text-zinc-500 font-bold block mb-1">관심종목 리스트</span>
                    {tickers.filter(t => t.symbol !== 'KOSPI' && t.symbol !== 'KOSDAQ').map((ticker) => (
                      <div
                        key={ticker.symbol}
                        onClick={() => setSelectedSymbol(ticker.symbol)}
                        className="flex justify-between items-center p-3 rounded-[16px] bg-[#151B23]/60 hover:bg-[#1C2430] cursor-pointer transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveTicker(ticker.symbol);
                            }}
                            className="text-xs transition-colors cursor-pointer shrink-0"
                          >
                            <Star size={12} className="fill-amber-400 text-amber-400" />
                          </button>
                          <div className="min-w-0">
                            <span className="font-bold text-zinc-200 block text-xs truncate">{ticker.name}</span>
                            <span className="text-[9.5px] text-zinc-500 font-mono mt-0.5 block truncate">{ticker.symbol}</span>
                          </div>
                        </div>
                        <div className="text-right font-mono text-xs shrink-0">
                          <span className="text-zinc-350 font-bold block">
                            {ticker.symbol.match(/[A-Z]/) ? `$${ticker.price.toFixed(2)}` : `${ticker.price.toLocaleString()}원`}
                          </span>
                          <span className={`text-[10px] font-bold ${ticker.change >= 0 ? 'text-rose-500' : 'text-blue-500'}`}>
                            {ticker.change >= 0 ? '+' : ''}{ticker.change}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab Content 3: Recent */}
              {activeSidebarTab === 'RECENT' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-zinc-500 font-bold">최근에 확인한 종목</span>
                    {recentlyViewed.length > 0 && (
                      <button
                        onClick={() => setRecentlyViewed([])}
                        className="text-[10px] text-zinc-550 hover:text-zinc-400 font-sans font-bold"
                      >
                        전체 삭제
                      </button>
                    )}
                  </div>

                  {recentlyViewed.length === 0 ? (
                    <div className="py-16 text-center text-zinc-650 text-[11px] font-sans">
                      최근 조회한 종목 내역이 없습니다.
                    </div>
                  ) : (
                    recentlyViewed.map((sym) => {
                      const ticker = tickers.find((t) => t.symbol === sym);
                      if (!ticker) return null;
                      const isUp = ticker.change >= 0;

                      return (
                        <div
                          key={sym}
                          onClick={() => setSelectedSymbol(sym)}
                          className="flex justify-between items-center p-3 rounded-[16px] bg-[#151B23]/60 hover:bg-[#1C2430] cursor-pointer transition-all"
                        >
                          <div className="min-w-0 pr-2">
                            <span className="font-bold text-zinc-200 block text-xs truncate">{ticker.name}</span>
                            <span className="text-[9.5px] text-zinc-550 font-mono mt-0.5 block truncate">{sym}</span>
                          </div>
                          <div className="text-right font-mono text-xs shrink-0">
                            <span className="text-zinc-200 font-bold block">{ticker.price.toLocaleString()}</span>
                            <span className={`text-[10px] font-bold ${isUp ? 'text-rose-500' : 'text-blue-500'}`}>
                              {ticker.change >= 0 ? '+' : ''}{ticker.change}%
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Tab Content 4: Settings */}
              {activeSidebarTab === 'SETTINGS' && (
                <div className="space-y-5 text-xs text-zinc-400 font-sans font-medium">
                  {/* API connection status info */}
                  <div className="space-y-2 p-4 rounded-[16px] bg-[#151B23]">
                    <span className="text-[10px] text-zinc-500 font-bold block mb-1 uppercase tracking-wider">계좌 연동 정보</span>
                    <div className="flex justify-between items-center text-xs">
                      <span>연동 상태:</span>
                      <span className={`font-black ${isApiConnected ? 'text-emerald-400' : 'text-rose-500'}`}>
                        {isApiConnected ? '실거래 계좌 활성화' : '모의투자 모드'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-zinc-550 pt-1">
                      <span>브로커 API Key:</span>
                      <Link
                        href="/broker-settings"
                        className="text-rose-500 hover:text-rose-400 hover:underline font-bold"
                      >
                        연동 관리 →
                      </Link>
                    </div>
                  </div>

                  {/* Toggles settings options list */}
                  <div className="space-y-3 pt-3">
                    {/* Theme toggle option */}
                    <div className="flex justify-between items-center py-2">
                      <span>화면 테마:</span>
                      <button
                        onClick={toggleTheme}
                        className="px-3 py-1.5 rounded-xl bg-zinc-900/50 hover:bg-zinc-900/80 text-[10px] font-bold text-zinc-200 transition-all cursor-pointer"
                      >
                        {isDark ? '라이트 모드' : '다크 모드'}
                      </button>
                    </div>

                    {/* Language select option */}
                    <div className="flex justify-between items-center py-2">
                      <span>시스템 언어:</span>
                      <button
                        onClick={() => setLocale(locale === 'ko' ? 'en' : 'ko')}
                        className="px-3 py-1.5 rounded-xl bg-zinc-900/50 hover:bg-zinc-900/80 text-[10px] font-bold text-zinc-200 transition-all cursor-pointer"
                      >
                        {locale === 'ko' ? 'English (EN)' : '한국어 (KO)'}
                      </button>
                    </div>
                  </div>

                  {/* Panic sell trigger link */}
                  <div className="pt-2">
                    <button
                      onClick={() => {
                        if (confirm('긴급 포지션 청산: 정말로 전액 즉각 시장가로 매도하시겠습니까?')) {
                          handlePanicSellAll();
                        }
                      }}
                      className="w-full py-3.5 rounded-[16px] bg-danger/10 text-danger hover:bg-danger/20 text-xs font-black transition-all cursor-pointer"
                    >
                      🚨 긴급 전체 포지션 청산 실행
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

        <SidebarTabRail
          activeTab={activeSidebarTab}
          isDark={isDark}
          isOpen={sidebarOpen}
          onTabClick={toggleSidebarTab}
        />

      </div>

      {/* Footer layout */}
      <Footer />

    </div>
  );
}
