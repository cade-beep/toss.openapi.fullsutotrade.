import { Search, Star, X, GripHorizontal } from 'lucide-react';
import type { WorkstationTicker } from '@/lib/context/workstation-context';
import type { FilterPill, MarketTab } from '@/components/dashboard/workstation-dashboard-types';

type MarketRankingsProps = {
  readonly activeTab: MarketTab;
  readonly filter: FilterPill;
  readonly isDark: boolean;
  readonly search: string;
  readonly selectedSymbol: string;
  readonly tickers: readonly WorkstationTicker[];
  readonly isStarred: (symbol: string) => boolean;
  readonly onFilterChange: (filter: FilterPill) => void;
  readonly onSearchChange: (search: string) => void;
  readonly onSelectTicker: (symbol: string) => void;
  readonly onStarToggle: (symbol: string, name: string) => void;
  readonly onTabChange: (tab: MarketTab) => void;
};

const renderMiniSparkline = (history: number[], isUp: boolean) => {
  if (!history || history.length < 2) return null;
  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = max - min || 1;
  const points = history.map((val, idx) => {
    const x = (idx / (history.length - 1)) * 36;
    const y = 14 - ((val - min) / range) * 12;
    return `${x},${y}`;
  }).join(' ');
  
  return (
    <svg className="w-9 h-3.5 overflow-visible" viewBox="0 0 36 14">
      <polyline
        fill="none"
        stroke={isUp ? '#00C853' : '#FF3B30'}
        strokeWidth="1.2"
        points={points}
      />
    </svg>
  );
};

const MARKET_TABS = ['관심종목', '실시간 인기', '거래대금 상위', '급상승 종목'] as const satisfies readonly MarketTab[];
const FILTERS = ['전체', '국내', '해외'] as const satisfies readonly FilterPill[];

export function MarketRankings({
  activeTab,
  filter,
  isDark,
  search,
  selectedSymbol,
  tickers,
  isStarred,
  onFilterChange,
  onSearchChange,
  onSelectTicker,
  onStarToggle,
  onTabChange,
}: MarketRankingsProps) {
  return (
    <div className="p-5 rounded-[16px] flex flex-col h-full overflow-hidden bg-[#151B23] transition-all duration-200">
      <div className="space-y-3 shrink-0">
        <div className="flex items-center justify-between drag-handle cursor-grab select-none pb-1">
          <div className="flex items-center gap-1.5">
            <GripHorizontal size={12} className="text-zinc-650" />
            <span className="text-[10px] uppercase font-extrabold tracking-wider text-zinc-500">시장 분석 & 종목 탐색</span>
          </div>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-4 top-3 text-zinc-500" />
          <input
            type="text"
            placeholder="종목명 또는 심볼 검색..."
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="w-full pl-10 pr-8 py-2 text-xs rounded-xl bg-zinc-900/40 hover:bg-zinc-900/60 text-zinc-200 placeholder-zinc-500 font-medium focus:outline-none focus:ring-1 focus:ring-zinc-800 transition-all"
          />
          {search && (
            <button onClick={() => onSearchChange('')} className="absolute right-4 top-3 text-zinc-500 hover:text-zinc-300">
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-2 text-xs select-none font-bold">
            {MARKET_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => onTabChange(tab)}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer font-bold ${
                  activeTab === tab
                    ? 'bg-zinc-900/60 text-primary shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-350 text-[11px]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="flex gap-1 bg-zinc-950/20 p-0.5 rounded-xl">
            {FILTERS.map((filterOption) => (
              <button
                key={filterOption}
                onClick={() => onFilterChange(filterOption)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  filter === filterOption
                    ? 'bg-zinc-900/60 text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-350'
                }`}
              >
                {filterOption}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 mt-4 no-scrollbar space-y-2">
        {tickers.length === 0 ? (
          <div className="text-center py-12 text-zinc-550 font-sans text-xs">
            {activeTab === '관심종목' ? '관심종목이 없습니다. 별표를 클릭해 추가해 보세요.' : '검색 결과가 없습니다.'}
          </div>
        ) : (
          tickers.map((ticker, index) => {
            const isSelected = selectedSymbol === ticker.symbol;
            const isTickerUp = ticker.change >= 0;

            // Dynamic mock indicators
            const charSum = ticker.symbol.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
            const aiScore = Math.min(99, Math.max(40, Math.round(75 + (ticker.change * 2) + (charSum % 15))));
            const volChange = Math.round((charSum % 70) + (ticker.change * 4));
            const volatility = ((charSum % 5) * 0.8 + 0.8).toFixed(1);

            return (
              <div
                key={ticker.symbol}
                onClick={() => onSelectTicker(ticker.symbol)}
                className={`flex items-center justify-between p-2.5 rounded-xl transition-all cursor-pointer ${
                  isSelected 
                    ? 'bg-[#1C2430] shadow-sm ring-1 ring-white/[0.04]' 
                    : 'hover:bg-[#1C2430]/50'
                }`}
              >
                {/* Left section: Name, Symbol, AI Score, Volume/Volatility */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {/* Star Toggle */}
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onStarToggle(ticker.symbol, ticker.name);
                    }}
                    className="text-xs transition-colors cursor-pointer select-none shrink-0"
                  >
                    <Star
                      size={12}
                      className={isStarred(ticker.symbol) ? 'fill-amber-400 text-amber-400' : 'text-zinc-650 hover:text-amber-400'}
                    />
                  </button>

                  <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-zinc-200 text-xs truncate leading-none">{ticker.name}</span>
                      <span className={`text-[8.5px] px-1 rounded font-bold leading-normal shrink-0 ${
                        aiScore >= 80 ? 'bg-primary/10 text-primary' : 'bg-zinc-850 text-zinc-550'
                      }`}>
                        AI {aiScore}
                      </span>
                    </div>
                    
                    <div className="flex items-center text-[9px] text-zinc-500 font-mono tracking-tight gap-1.5 truncate">
                      <span>{ticker.symbol}</span>
                      <span className="opacity-50">|</span>
                      <span className="scale-90 origin-left">거래 {volChange >= 0 ? `+${volChange}` : volChange}%</span>
                      <span className="opacity-50">|</span>
                      <span className="scale-90 origin-left">변동 {volatility}%</span>
                    </div>
                  </div>
                </div>

                {/* Center section: Sparkline */}
                <div className="mx-2 shrink-0">
                  {renderMiniSparkline(ticker.history, isTickerUp)}
                </div>

                {/* Right section: Price & Change badge */}
                <div className="text-right shrink-0 flex flex-col items-end gap-1 font-mono">
                  <span className="text-zinc-200 font-bold text-xs leading-none">
                    {ticker.symbol.match(/[A-Z]/) ? `$${ticker.price.toFixed(2)}` : `${ticker.price.toLocaleString()}`}
                  </span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-black leading-none ${
                    isTickerUp 
                      ? 'bg-success/10 text-success' 
                      : 'bg-danger/10 text-danger'
                  }`}>
                    {isTickerUp ? '+' : ''}{ticker.change}%
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
