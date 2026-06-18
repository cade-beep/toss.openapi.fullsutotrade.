import { TrendingDown, TrendingUp } from 'lucide-react';
import type { GlobalIndex } from '@/components/dashboard/workstation-dashboard-types';

type IndicesBannerProps = {
  readonly indices: readonly GlobalIndex[];
  readonly isDark: boolean;
  readonly onSelectIndex?: (symbol: string) => void;
};

function buildSparklinePath(history: readonly number[]): string {
  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = max - min || 1;

  return history
    .map((price, index) => `${(index / (history.length - 1)) * 48 + 1},${18 - ((price - min) / range) * 16}`)
    .join(' L ');
}

export function IndicesBanner({ indices, isDark, onSelectIndex }: IndicesBannerProps) {
  return (
    <div className={`flex items-center gap-4 py-2 px-6 overflow-x-auto shrink-0 no-scrollbar ${
      isDark ? 'bg-[#111827] shadow-[inset_0_-1px_0_rgba(255,255,255,0.035)]' : 'bg-white shadow-[0_4px_12px_rgba(0,0,0,0.02)]'
    }`}>
      {indices.map((index) => {
        const trendColor = index.isUp ? 'text-success' : 'text-danger';
        const trendBackground = index.isUp
          ? 'hover:bg-success/[0.03]'
          : 'hover:bg-danger/[0.03]';

        return (
          <div
            key={index.name}
            onClick={() => onSelectIndex?.(index.symbol)}
            className={`flex items-center gap-4 py-2 px-4 rounded-xl font-mono text-xs shrink-0 transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99] select-none ${
              isDark ? 'bg-[#151B23] hover:bg-[#1C2430]' : 'bg-slate-50 hover:bg-slate-100 shadow-sm'
            } ${trendBackground}`}
          >
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">{index.name}</span>
                {index.marketStatus && (
                  <span className={`text-[8px] px-1 py-0.25 rounded-xl font-sans font-bold ${
                    index.marketStatus === 'OPEN'
                      ? 'bg-success/10 text-success'
                      : 'bg-zinc-500/10 text-zinc-400'
                  }`}>
                    {index.marketStatus === 'OPEN' ? '장중' : '장마감'}
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className={`font-black text-sm ${isDark ? 'text-white' : 'text-zinc-950'}`}>{index.price}</span>
                <span className={`text-[10px] font-bold flex items-center gap-0.5 ${trendColor}`}>
                  {index.isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                  {index.changePct}
                </span>
              </div>
            </div>
            {index.history.length > 0 && (
              <svg className="w-12 h-7 overflow-visible opacity-80" viewBox="0 0 50 20">
                <path
                  d={`M ${buildSparklinePath(index.history)}`}
                  fill="none"
                  stroke={index.isUp ? '#00C853' : '#FF3B30'}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </div>
        );
      })}
    </div>
  );
}
