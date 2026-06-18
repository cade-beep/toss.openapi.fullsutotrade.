'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { backtester } from '@/services/ai/backtester';
import { BacktestTrade } from '@/services/ai/metrics-calculator';
import { parseCSV } from '@/lib/utils/csv-parser';
import { useI18n } from '@/lib/i18n/i18n-context';

export default function BacktestDashboardPage() {
  notFound();

  const { t, formatCurrency } = useI18n();
  const [strategyName, setStrategyName] = useState<'Moving Average Crossover' | 'RSI Mean Reversion'>('Moving Average Crossover');
  const [symbol, setSymbol] = useState<string>('005930');
  const [startDate, setStartDate] = useState<string>('2026-01-01');
  const [endDate, setEndDate] = useState<string>('2026-06-10');
  const [initialCapital, setInitialCapital] = useState<number>(10000000);
  
  // Params
  const [fastPeriod, setFastPeriod] = useState<number>(5);
  const [slowPeriod, setSlowPeriod] = useState<number>(20);
  const [rsiPeriod, setRsiPeriod] = useState<number>(14);
  const [overbought, setOverbought] = useState<number>(70);
  const [oversold, setOversold] = useState<number>(30);
  const [orderSize, setOrderSize] = useState<number>(10);
  
  // CSV File state
  const [csvFileContent, setCsvFileContent] = useState<string>('');
  const [csvFileName, setCsvFileName] = useState<string>('');

  // Results State
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [results, setResults] = useState<{
    success: boolean;
    metrics: {
      totalReturn: number;
      cagr: number;
      winRate: number;
      profitFactor: number;
      maxDrawdown: number;
      sharpeRatio: number;
      totalTrades: number;
      finalValue: number;
    };
    trades: BacktestTrade[];
    equityCurve: { date: string; value: number }[];
  } | null>(null);

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvFileContent(content);
    };
    reader.readAsText(file);
  };

  const handleRunBacktest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setResults(null);

    try {
      const params: Record<string, number> = { orderSize };
      if (strategyName === 'Moving Average Crossover') {
        params.fastPeriod = fastPeriod;
        params.slowPeriod = slowPeriod;
      } else {
        params.rsiPeriod = rsiPeriod;
        params.overbought = overbought;
        params.oversold = oversold;
      }

      // Check CSV upload logic
      let csvData: string | undefined = undefined;
      if (csvFileContent) {
        try {
          parseCSV(csvFileContent); // check validation first
          csvData = csvFileContent;
        } catch (csvErr) {
          const msg = csvErr instanceof Error ? csvErr.message : String(csvErr);
          setErrorMsg(msg);
          setLoading(false);
          return;
        }
      }

      const res = await backtester.runBacktest({
        strategyName,
        symbol,
        startDate,
        endDate,
        initialCapital,
        params,
        csvContent: csvData
      });

      if (res.success && res.metrics && res.trades && res.equityCurve) {
        setResults({
          success: true,
          metrics: {
            totalReturn: res.metrics.totalReturn ?? 0,
            cagr: res.metrics.cagr,
            winRate: res.metrics.winRate,
            profitFactor: res.metrics.profitFactor ?? 0,
            maxDrawdown: res.metrics.maxDrawdown,
            sharpeRatio: res.metrics.sharpeRatio,
            totalTrades: res.metrics.totalTrades,
            finalValue: res.metrics.finalValue
          },
          trades: res.trades as BacktestTrade[],
          equityCurve: res.equityCurve
        });
      } else {
        setErrorMsg(res.error || t('backtest.backtestFailed', { defaultValue: '시뮬레이션 수행에 실패했습니다. 데이터를 확인해주세요.' }));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(t('backtest.backtestError', { error: msg, defaultValue: `에러가 발생했습니다: ${msg}` }));
    } finally {
      setLoading(false);
    }
  };

  // SVG Chart path calculators
  const renderSvgChart = useCallback(() => {
    const currentResults = results;
    if (!currentResults || currentResults.equityCurve.length === 0) return null;
    const curve = currentResults.equityCurve;

    const width = 640;
    const height = 220;
    const padding = 25;

    const values = curve.map(c => c.value);
    const maxVal = Math.max(...values, initialCapital);
    const minVal = Math.min(...values, initialCapital);
    const valRange = maxVal - minVal || 1;

    const points = curve.map((point, index) => {
      const x = padding + (index / (curve.length - 1)) * (width - padding * 2);
      const y = height - padding - ((point.value - minVal) / valRange) * (height - padding * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const pathD = `M ${points.join(' L ')}`;

    // Draw baseline
    const baselineY = height - padding - ((initialCapital - minVal) / valRange) * (height - padding * 2);

    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="select-none">
        <defs>
          <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00d287" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#00d287" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        
        {/* Baseline (Initial Capital) */}
        <line
          x1={padding}
          y1={baselineY}
          x2={width - padding}
          y2={baselineY}
          stroke="#3f3f46"
          strokeDasharray="4,4"
          strokeWidth="1"
        />
        
        {/* Equity Fill Area */}
        <path
          d={`${pathD} L ${width - padding},${height - padding} L ${padding},${height - padding} Z`}
          fill="url(#chart-fill)"
        />
        
        {/* Equity Curve Line */}
        <path
          d={pathD}
          fill="none"
          stroke="#00d287"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Labels */}
        <text x={padding} y={padding - 5} fill="#71717a" fontSize="8" className="font-mono">
          {t('backtest.maxLabel')} {formatCurrency(maxVal)}
        </text>
        <text x={padding} y={height - padding + 15} fill="#71717a" fontSize="8" className="font-mono">
          {t('backtest.minLabel')} {formatCurrency(minVal)}
        </text>
      </svg>
    );
  }, [results, initialCapital, formatCurrency, t]);

  return (
    <div className="min-h-screen w-screen bg-black text-zinc-300 font-mono text-xs p-6 select-none">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header Title */}
        <div className="flex justify-between items-center border-b border-zinc-900 pb-4">
          <div>
            <h1 className="text-sm font-bold text-white uppercase tracking-wider">{t('backtest.title')}</h1>
            <p className="text-[10px] text-zinc-500 font-sans mt-0.5">{t('backtest.subTitle')}</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/broker-settings"
              className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors font-bold cursor-pointer"
            >
              {t('common.brokerSettings')}
            </Link>
            <Link
              href="/"
              className="px-2.5 py-1 rounded bg-[#00d287] hover:bg-[#00be7a] border border-[#00d287] text-zinc-950 transition-colors font-bold cursor-pointer"
            >
              ← {t('common.dashboard')}
            </Link>
          </div>
        </div>

        {/* Backtest Configuration Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          {/* Inputs Form */}
          <div className="md:col-span-1 bg-zinc-950 border border-zinc-900 rounded p-4 space-y-4">
            <h2 className="text-[10px] uppercase font-bold text-white tracking-wide border-b border-zinc-900 pb-1.5">{t('backtest.paramsTitle')}</h2>
            
            <form onSubmit={handleRunBacktest} className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-zinc-500 font-sans text-[10px]">{t('backtest.strategyLabel')}</label>
                <select
                  value={strategyName}
                  onChange={(e) => setStrategyName(e.target.value as 'Moving Average Crossover' | 'RSI Mean Reversion')}
                  className="bg-zinc-900 border border-zinc-900 rounded px-2.5 py-1.5 text-white focus:outline-none text-[11px]"
                >
                  <option value="Moving Average Crossover">{t('aiStrategies.runCrossover')}</option>
                  <option value="RSI Mean Reversion">{t('aiStrategies.meanReversion')}</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-zinc-500 font-sans text-[10px]">{t('backtest.tickerLabel')}</label>
                <input
                  type="text"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  placeholder="e.g. 005930"
                  className="bg-zinc-900 border border-zinc-900 rounded px-2.5 py-1.5 text-white focus:outline-none text-[11px]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-zinc-500 font-sans text-[10px]">{t('backtest.startLabel')}</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-zinc-900 border border-zinc-900 rounded px-2 py-1 text-white focus:outline-none text-[10px]"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-zinc-500 font-sans text-[10px]">{t('backtest.endLabel')}</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-zinc-900 border border-zinc-900 rounded px-2 py-1 text-white focus:outline-none text-[10px]"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-zinc-500 font-sans text-[10px]">{t('backtest.initialCapitalLabel')}</label>
                <input
                  type="number"
                  value={initialCapital}
                  onChange={(e) => setInitialCapital(Number(e.target.value))}
                  className="bg-zinc-900 border border-zinc-900 rounded px-2.5 py-1.5 text-white focus:outline-none text-[11px]"
                  required
                />
              </div>

              {/* Dynamic Strategy Params */}
              {strategyName === 'Moving Average Crossover' ? (
                <div className="grid grid-cols-2 gap-2 border-t border-zinc-900 pt-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-zinc-500 font-sans text-[10px]">{t('backtest.fastPeriodLabel')}</label>
                    <input
                      type="number"
                      value={fastPeriod}
                      onChange={(e) => setFastPeriod(Number(e.target.value))}
                      className="bg-zinc-900 border border-zinc-900 rounded px-2.5 py-1.5 text-white focus:outline-none text-[11px]"
                      min="2"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-zinc-500 font-sans text-[10px]">{t('backtest.slowPeriodLabel')}</label>
                    <input
                      type="number"
                      value={slowPeriod}
                      onChange={(e) => setSlowPeriod(Number(e.target.value))}
                      className="bg-zinc-900 border border-zinc-900 rounded px-2.5 py-1.5 text-white focus:outline-none text-[11px]"
                      min="2"
                      required
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 border-t border-zinc-900 pt-2">
                  <div className="flex flex-col gap-1 col-span-1">
                    <label className="text-zinc-500 font-sans text-[10px]">{t('backtest.rsiPeriodLabel')}</label>
                    <input
                      type="number"
                      value={rsiPeriod}
                      onChange={(e) => setRsiPeriod(Number(e.target.value))}
                      className="bg-zinc-900 border border-zinc-900 rounded px-1.5 py-1.5 text-white focus:outline-none text-[11px]"
                      min="2"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1 col-span-1">
                    <label className="text-zinc-500 font-sans text-[10px]">{t('backtest.oversoldLabel')}</label>
                    <input
                      type="number"
                      value={oversold}
                      onChange={(e) => setOversold(Number(e.target.value))}
                      className="bg-zinc-900 border border-zinc-900 rounded px-1.5 py-1.5 text-white focus:outline-none text-[11px]"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1 col-span-1">
                    <label className="text-zinc-500 font-sans text-[10px]">{t('backtest.overboughtLabel')}</label>
                    <input
                      type="number"
                      value={overbought}
                      onChange={(e) => setOverbought(Number(e.target.value))}
                      className="bg-zinc-900 border border-zinc-900 rounded px-1.5 py-1.5 text-white focus:outline-none text-[11px]"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-zinc-550 font-sans text-[10px]">{t('backtest.orderSizeLabel')}</label>
                <input
                  type="number"
                  value={orderSize}
                  onChange={(e) => setOrderSize(Number(e.target.value))}
                  className="bg-zinc-900 border border-zinc-900 rounded px-2.5 py-1.5 text-white focus:outline-none text-[11px]"
                  min="1"
                  required
                />
              </div>

              {/* CSV Upload Area */}
              <div className="flex flex-col gap-1 border-t border-zinc-900 pt-2.5">
                <label className="text-zinc-550 font-sans text-[10px]">{t('backtest.csvLabel')}</label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCsvUpload}
                  className="text-[10px] text-zinc-550 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-mono file:bg-zinc-900 file:text-zinc-300 file:cursor-pointer hover:file:bg-zinc-800"
                />
                {csvFileName && (
                  <span className="text-[9px] text-[#00d287] mt-0.5 block truncate">{t('backtest.csvLoaded', { fileName: csvFileName })}</span>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-3 px-3 py-2 rounded bg-[#00d287] hover:bg-[#00be7a] text-zinc-950 font-bold tracking-wider uppercase transition-colors cursor-pointer disabled:opacity-40"
              >
                {loading ? t('backtest.runningSimulation') : t('backtest.runBacktestButton')}
              </button>
            </form>
          </div>

          {/* Graphical Equity Curve */}
          <div className="md:col-span-2 flex flex-col bg-zinc-950 border border-zinc-900 rounded p-4 select-none">
            <h2 className="text-[10px] uppercase font-bold text-white tracking-wide border-b border-zinc-900 pb-1.5 mb-3">{t('backtest.chartTitle')}</h2>
            
            {errorMsg && (
              <div className="p-3 rounded border border-rose-900/30 bg-rose-950/20 text-rose-400 text-[11px]">
                <span className="font-bold block mb-0.5">✗ {t('common.error')}</span>
                <span>{errorMsg}</span>
              </div>
            )}

            {!results && !errorMsg && (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-center text-zinc-550 font-sans">
                <svg className="w-10 h-10 mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <span>{t('backtest.noBacktestTitle')}</span>
                <span className="text-[10px] max-w-xs mt-1">{t('backtest.noBacktestDesc')}</span>
              </div>
            )}

            {results && !errorMsg && (
              <div className="flex-1 flex flex-col justify-between">
                <div className="w-full h-[220px] bg-zinc-950 border border-zinc-900/50 rounded flex items-center justify-center p-2 relative">
                  {renderSvgChart()}
                </div>
                
                {/* Visual stats mini summary */}
                <div className="grid grid-cols-2 gap-4 mt-4 border-t border-zinc-900 pt-3 text-[10px]">
                  <div>
                    <span className="text-zinc-550 block uppercase">{t('backtest.simulatedTicks')}:</span>
                    <span className="text-white font-bold">{t('backtest.tradingDays', { days: results?.equityCurve?.length || 0 })}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-zinc-550 block uppercase">{t('backtest.finalNetValue')}:</span>
                    <span className="text-[#00d287] font-bold">{formatCurrency(results?.metrics?.finalValue || 0)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Results Panel Indicator Cards */}
        {results && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 select-none">
            <div className="bg-zinc-950 border border-zinc-900 rounded p-3 text-center">
              <span className="text-zinc-550 uppercase text-[9px] block mb-1">{t('backtest.returnMetric')}</span>
              <span className={`text-sm font-bold block ${(results?.metrics?.totalReturn ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {(results?.metrics?.totalReturn ?? 0) >= 0 ? '+' : ''}
                {(results?.metrics?.totalReturn ?? 0).toFixed(2)}%
              </span>
            </div>
            
            <div className="bg-zinc-950 border border-zinc-900 rounded p-3 text-center">
              <span className="text-zinc-550 uppercase text-[9px] block mb-1">{t('backtest.cagrMetric')}</span>
              <span className={`text-sm font-bold block ${(results?.metrics?.cagr ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {(results?.metrics?.cagr ?? 0) >= 0 ? '+' : ''}
                {((results?.metrics?.cagr ?? 0) * 100).toFixed(2)}%
              </span>
            </div>

            <div className="bg-zinc-950 border border-zinc-900 rounded p-3 text-center">
              <span className="text-zinc-550 uppercase text-[9px] block mb-1">{t('backtest.winRateMetric')}</span>
              <span className="text-sm font-bold text-white block">
                {((results?.metrics?.winRate ?? 0) * 100).toFixed(1)}%
              </span>
            </div>

            <div className="bg-zinc-950 border border-zinc-900 rounded p-3 text-center">
              <span className="text-zinc-550 uppercase text-[9px] block mb-1">{t('backtest.profitFactorMetric')}</span>
              <span className="text-sm font-bold text-white block">
                {results?.metrics?.profitFactor === Infinity ? '∞' : (results?.metrics?.profitFactor ?? 0).toFixed(2)}
              </span>
            </div>

            <div className="bg-zinc-950 border border-zinc-900 rounded p-3 text-center">
              <span className="text-zinc-550 uppercase text-[9px] block mb-1">{t('backtest.mddMetric')}</span>
              <span className="text-sm font-bold text-rose-400 block">
                -{((results?.metrics?.maxDrawdown ?? 0) * 100).toFixed(2)}%
              </span>
            </div>

            <div className="bg-zinc-950 border border-zinc-900 rounded p-3 text-center">
              <span className="text-zinc-550 uppercase text-[9px] block mb-1">{t('backtest.sharpeMetric')}</span>
              <span className="text-sm font-bold text-white block">
                {(results?.metrics?.sharpeRatio ?? 0).toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* Historical Trades Log Table */}
        {results && (
          <div className="bg-zinc-950 border border-zinc-900 rounded p-4">
            <h2 className="text-[10px] uppercase font-bold text-white tracking-wide border-b border-zinc-900 pb-1.5 mb-3 flex justify-between items-center">
              <span>{t('backtest.tradesTitle')}</span>
              <span className="text-zinc-550 font-normal">{t('backtest.executionsCount', { count: results?.trades?.length || 0 })}</span>
            </h2>

            {(results?.trades?.length || 0) === 0 ? (
              <div className="py-12 text-center text-zinc-550 font-sans">
                {t('backtest.emptyTrades')}
              </div>
            ) : (
              <div className="overflow-x-auto select-none">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-900 text-zinc-500 text-[10px] uppercase">
                      <th className="py-2 pb-1.5 font-bold">{t('backtest.tradeTime')}</th>
                      <th className="py-2 pb-1.5 font-bold">{t('backtest.tradeSymbol')}</th>
                      <th className="py-2 pb-1.5 font-bold">{t('backtest.tradeSide')}</th>
                      <th className="py-2 pb-1.5 font-bold text-right">{t('backtest.tradeQty')}</th>
                      <th className="py-2 pb-1.5 font-bold text-right">{t('backtest.tradePrice')}</th>
                      <th className="py-2 pb-1.5 font-bold text-right">{t('backtest.tradeValue')}</th>
                      <th className="py-2 pb-1.5 font-bold text-right">{t('positions.pnl')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900/40 text-[11px]">
                    {results?.trades?.map((trade, i) => (
                      <tr key={i} className="hover:bg-zinc-900/10 transition-colors">
                        <td className="py-2 font-semibold text-zinc-400">{trade.date}</td>
                        <td className="py-2 font-bold text-white">{trade.symbol}</td>
                        <td className="py-2">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            trade.side === 'BUY'
                              ? 'bg-emerald-950/20 text-emerald-400 border border-emerald-900/30'
                              : 'bg-rose-950/20 text-rose-400 border border-rose-900/30'
                          }`}>
                            {trade.side === 'BUY' ? t('orderTicket.buy') : t('orderTicket.sell')}
                          </span>
                        </td>
                        <td className="py-2 text-right text-zinc-300">{trade.qty}</td>
                        <td className="py-2 text-right text-zinc-300">{formatCurrency(trade.price)}</td>
                        <td className="py-2 text-right text-zinc-300">{formatCurrency(trade.totalValue)}</td>
                        <td className="py-2 text-right font-bold">
                          {trade.pnl !== undefined ? (
                            <span className={trade.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                              {trade.pnl >= 0 ? '+' : ''}
                              {formatCurrency(trade.pnl)}
                            </span>
                          ) : (
                            <span className="text-zinc-550">--</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
