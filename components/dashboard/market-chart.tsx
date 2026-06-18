'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useWorkstation } from '@/lib/context/workstation-context';
import { useI18n } from '@/lib/i18n/i18n-context';
import { AlertTriangle, Settings, Eye, EyeOff, GripHorizontal } from 'lucide-react';
import { createChart, IChartApi, ISeriesApi, ITimeScaleApi, Time, MouseEventParams, CandlestickSeries, LineSeries, HistogramSeries } from 'lightweight-charts';

interface Candle {
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Indicator Calculation Helpers
function calculateSMA(data: Candle[], period: number) {
  const sma: { time: string | number; value: number }[] = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    sma.push({ time: data[i].time, value: sum / period });
  }
  return sma;
}

function calculateEMA(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [values[0] || 0];
  for (let i = 1; i < values.length; i++) {
    ema.push(values[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function calculateBollingerBands(data: Candle[], period = 20, multiplier = 2) {
  const upper: { time: string | number; value: number }[] = [];
  const middle: { time: string | number; value: number }[] = [];
  const lower: { time: string | number; value: number }[] = [];

  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    const ma = sum / period;
    let variance = 0;
    for (let j = 0; j < period; j++) {
      variance += Math.pow(data[i - j].close - ma, 2);
    }
    const sd = Math.sqrt(variance / period);

    middle.push({ time: data[i].time, value: ma });
    upper.push({ time: data[i].time, value: ma + multiplier * sd });
    lower.push({ time: data[i].time, value: ma - multiplier * sd });
  }

  return { upper, middle, lower };
}

function calculateRSI(data: Candle[], period = 14) {
  const rsi: { time: string | number; value: number }[] = [];
  if (data.length < period + 1) return rsi;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = data[i].close - data[i - 1].close;
    if (diff > 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  rsi.push({ time: data[period].time, value: avgLoss === 0 ? 100 : 100 - 100 / (1 + rs) });

  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;

    rsi.push({ time: data[i].time, value: avgLoss === 0 ? 100 : 100 - 100 / (1 + rs) });
  }

  return rsi;
}

function calculateMACD(data: Candle[], fast = 12, slow = 26, signal = 9) {
  const macdLine: { time: string | number; value: number }[] = [];
  const signalLine: { time: string | number; value: number }[] = [];
  const histogram: { time: string | number; value: number }[] = [];

  if (data.length < slow) return { macdLine, signalLine, histogram };

  const closes = data.map((d) => d.close);
  const emaFast = calculateEMA(closes, fast);
  const emaSlow = calculateEMA(closes, slow);

  const macdValues: number[] = [];
  const times: (string | number)[] = [];

  for (let i = slow - 1; i < data.length; i++) {
    const val = emaFast[i] - emaSlow[i];
    macdLine.push({ time: data[i].time, value: val });
    macdValues.push(val);
    times.push(data[i].time);
  }

  const signalValues = calculateEMA(macdValues, signal);

  for (let i = 0; i < macdValues.length; i++) {
    const sigVal = signalValues[i];
    const histVal = macdValues[i] - sigVal;

    signalLine.push({ time: times[i], value: sigVal });
    histogram.push({ time: times[i], value: histVal });
  }

  return { macdLine, signalLine, histogram };
}

export default function MarketChartPanel() {
  const { activeTicker, isApiConnected, theme } = useWorkstation();
  const { t, formatCurrency } = useI18n();
  const isDark = theme === 'dark';

  // Selected range and timeframe states
  const [range, setRange] = useState<'1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y' | 'ALL'>('1M');
  const [timeframe, setTimeframe] = useState<'day' | 'week' | 'month'>('day');

  // Technical Indicators active state toggles
  const [showMA, setShowMA] = useState<boolean>(true);
  const [showBB, setShowBB] = useState<boolean>(false);
  const [showRSI, setShowRSI] = useState<boolean>(false);
  const [showMACD, setShowMACD] = useState<boolean>(false);

  // DOM Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const mainChartContainerRef = useRef<HTMLDivElement>(null);
  const rsiChartContainerRef = useRef<HTMLDivElement>(null);
  const macdChartContainerRef = useRef<HTMLDivElement>(null);

  // Store chart instances
  const mainChartApiRef = useRef<IChartApi | null>(null);
  const rsiChartApiRef = useRef<IChartApi | null>(null);
  const macdChartApiRef = useRef<IChartApi | null>(null);

  // Store series instances for updates
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  // Candles data state
  const [candles, setCandles] = useState<Candle[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Legend values under cursor state
  const [legendData, setLegendData] = useState<{
    time: string | null;
    open: number | null;
    high: number | null;
    low: number | null;
    close: number | null;
    volume: number | null;
    ma5: number | null;
    ma20: number | null;
    ma60: number | null;
    ma120: number | null;
    bbUpper: number | null;
    bbLower: number | null;
    rsi: number | null;
    macd: number | null;
    macdSig: number | null;
    macdHist: number | null;
  } | null>(null);

  // Auto set timeframe based on range
  useEffect(() => {
    if (range === '1D' || range === '1W') {
      setTimeframe('day'); // Intraday minute bars are queried via day timeframe query
    }
  }, [range]);

  // Fetch historical data
  useEffect(() => {
    if (!isApiConnected || !activeTicker?.symbol) return;

    let active = true;
    const fetchHistory = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/market/history?symbol=${activeTicker.symbol}&timeframe=${timeframe}&range=${range}`);
        if (res.ok && active) {
          const data = await res.json();
          if (data.success && Array.isArray(data.candles)) {
            setCandles(data.candles);
          }
        }
      } catch (err) {
        console.error('Failed to load chart history:', err);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    fetchHistory();
    return () => {
      active = false;
    };
  }, [activeTicker?.symbol, timeframe, range, isApiConnected]);

  // Initialize and update Lightweight Charts
  useEffect(() => {
    if (candles.length === 0) return;

    // Check containers
    const mainContainer = mainChartContainerRef.current;
    if (!mainContainer) return;

    // Destroy existing charts to redraw cleanly
    const cleanupCharts = () => {
      if (mainChartApiRef.current) {
        mainChartApiRef.current.remove();
        mainChartApiRef.current = null;
      }
      if (rsiChartApiRef.current) {
        rsiChartApiRef.current.remove();
        rsiChartApiRef.current = null;
      }
      if (macdChartApiRef.current) {
        macdChartApiRef.current.remove();
        macdChartApiRef.current = null;
      }
    };

    cleanupCharts();

    const chartTheme = {
      background: isDark ? '#111827' : '#ffffff',
      text: isDark ? '#5A6478' : '#4e5968',
      grid: isDark ? 'rgba(255, 255, 255, 0.03)' : '#f2f4f6',
      border: isDark ? 'rgba(255, 255, 255, 0.04)' : '#f2f4f6',
    };

    const isIntraday = range === '1D' || range === '1W';

    // 1. CREATE MAIN CHART (Price + Volume Overlay + SMA + BB)
    const mainChart = createChart(mainContainer, {
      width: mainContainer.clientWidth,
      height: mainContainer.clientHeight,
      layout: {
        background: { color: chartTheme.background },
        textColor: chartTheme.text,
        fontFamily: 'Inter, sans-serif',
      },
      grid: {
        vertLines: { color: chartTheme.grid },
        horzLines: { color: chartTheme.grid },
      },
      timeScale: {
        borderColor: chartTheme.border,
        timeVisible: isIntraday,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: chartTheme.border,
      },
      crosshair: {
        vertLine: {
          color: '#3f3f46',
          labelBackgroundColor: '#27272a',
        },
        horzLine: {
          color: '#3f3f46',
          labelBackgroundColor: '#27272a',
        },
      },
    });
    mainChartApiRef.current = mainChart;

    // Add Candlestick series
    const candlestickSeries = mainChart.addSeries(CandlestickSeries, {
      upColor: '#00C853',
      downColor: '#FF3B30',
      borderUpColor: '#00C853',
      borderDownColor: '#FF3B30',
      wickUpColor: '#00C853',
      wickDownColor: '#FF3B30',
    });
    candlestickSeriesRef.current = candlestickSeries;
    candlestickSeries.setData(candles.map(c => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close
    })));

    // Add Volume series (Overlaid, using left scale to prevent squashing price)
    const volumeSeries = mainChart.addSeries(HistogramSeries, {
      color: '#27272a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume',
    });
    volumeSeriesRef.current = volumeSeries;

    mainChart.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.75, // Volume sits at bottom 25% of chart
        bottom: 0,
      },
    });

    volumeSeries.setData(candles.map(c => {
      const isUp = c.close >= c.open;
      return {
        time: c.time as Time,
        value: c.volume,
        color: isUp ? 'rgba(0, 200, 83, 0.2)' : 'rgba(255, 59, 48, 0.2)',
      };
    }));

    // Add Indicators Series
    let ma5Data: { time: string | number; value: number }[] = [];
    let ma20Data: { time: string | number; value: number }[] = [];
    let ma60Data: { time: string | number; value: number }[] = [];
    let ma120Data: { time: string | number; value: number }[] = [];
    let bbUpperData: { time: string | number; value: number }[] = [];
    let bbMiddleData: { time: string | number; value: number }[] = [];
    let bbLowerData: { time: string | number; value: number }[] = [];

    if (showMA) {
      if (candles.length >= 5) {
        const ma5 = mainChart.addSeries(LineSeries, { color: '#ffea00', lineWidth: 1, title: 'MA5' });
        ma5Data = calculateSMA(candles, 5);
        ma5.setData(ma5Data.map(d => ({ time: d.time as Time, value: d.value })));
      }
      if (candles.length >= 20) {
        const ma20 = mainChart.addSeries(LineSeries, { color: '#ff007f', lineWidth: 1, title: 'MA20' });
        ma20Data = calculateSMA(candles, 20);
        ma20.setData(ma20Data.map(d => ({ time: d.time as Time, value: d.value })));
      }
      if (candles.length >= 60) {
        const ma60 = mainChart.addSeries(LineSeries, { color: '#00e5ff', lineWidth: 1, title: 'MA60' });
        ma60Data = calculateSMA(candles, 60);
        ma60.setData(ma60Data.map(d => ({ time: d.time as Time, value: d.value })));
      }
      if (candles.length >= 120) {
        const ma120 = mainChart.addSeries(LineSeries, { color: '#7c4dff', lineWidth: 2, title: 'MA120' });
        ma120Data = calculateSMA(candles, 120);
        ma120.setData(ma120Data.map(d => ({ time: d.time as Time, value: d.value })));
      }
    }

    if (showBB && candles.length >= 20) {
      const bb = calculateBollingerBands(candles, 20, 2);
      bbUpperData = bb.upper;
      bbLowerData = bb.lower;
      bbMiddleData = bb.middle;

      const upperSeries = mainChart.addSeries(LineSeries, { color: '#3f51b5', lineWidth: 1, lineStyle: 2 });
      const middleSeries = mainChart.addSeries(LineSeries, { color: 'rgba(63, 81, 181, 0.5)', lineWidth: 1 });
      const lowerSeries = mainChart.addSeries(LineSeries, { color: '#3f51b5', lineWidth: 1, lineStyle: 2 });

      upperSeries.setData(bbUpperData.map(d => ({ time: d.time as Time, value: d.value })));
      middleSeries.setData(bbMiddleData.map(d => ({ time: d.time as Time, value: d.value })));
      lowerSeries.setData(bbLowerData.map(d => ({ time: d.time as Time, value: d.value })));
    }

    // 2. RSI CHART
    let rsiData: { time: string | number; value: number }[] = [];
    let activeRsiSeries: ISeriesApi<any> | null = null;
    if (showRSI && rsiChartContainerRef.current) {
      const rsiChart = createChart(rsiChartContainerRef.current, {
        width: rsiChartContainerRef.current.clientWidth,
        height: rsiChartContainerRef.current.clientHeight,
        layout: {
          background: { color: chartTheme.background },
          textColor: chartTheme.text,
        },
        grid: {
          vertLines: { color: chartTheme.grid },
          horzLines: { color: chartTheme.grid },
        },
        timeScale: {
          visible: !showMACD, // Hide timescale if MACD is shown below
          borderColor: chartTheme.border,
        },
        rightPriceScale: {
          borderColor: chartTheme.border,
        },
        crosshair: {
          vertLine: { color: '#3f3f46' },
          horzLine: { color: '#3f3f46' },
        },
      });
      rsiChartApiRef.current = rsiChart;

      const rsiSeries = rsiChart.addSeries(LineSeries, {
        color: '#b388ff',
        lineWidth: 2,
      });
      activeRsiSeries = rsiSeries;

      rsiData = calculateRSI(candles, 14);
      rsiSeries.setData(rsiData.map(d => ({ time: d.time as Time, value: d.value })));

      // Add support lines at 30 and 70
      const limit30 = rsiChart.addSeries(LineSeries, { color: 'rgba(255,255,255,0.15)', lineWidth: 1, lineStyle: 3 });
      const limit70 = rsiChart.addSeries(LineSeries, { color: 'rgba(255,255,255,0.15)', lineWidth: 1, lineStyle: 3 });
      limit30.setData(candles.map(c => ({ time: c.time as Time, value: 30 })));
      limit70.setData(candles.map(c => ({ time: c.time as Time, value: 70 })));
    }

    // 3. MACD CHART
    let macdLineData: { time: string | number; value: number }[] = [];
    let signalLineData: { time: string | number; value: number }[] = [];
    let histData: { time: string | number; value: number }[] = [];
    let activeMACDSeries: ISeriesApi<any> | null = null;

    if (showMACD && macdChartContainerRef.current) {
      const macdChart = createChart(macdChartContainerRef.current, {
        width: macdChartContainerRef.current.clientWidth,
        height: macdChartContainerRef.current.clientHeight,
        layout: {
          background: { color: chartTheme.background },
          textColor: chartTheme.text,
        },
        grid: {
          vertLines: { color: chartTheme.grid },
          horzLines: { color: chartTheme.grid },
        },
        timeScale: {
          borderColor: chartTheme.border,
        },
        rightPriceScale: {
          borderColor: chartTheme.border,
        },
        crosshair: {
          vertLine: { color: '#3f3f46' },
          horzLine: { color: '#3f3f46' },
        },
      });
      macdChartApiRef.current = macdChart;

      const macdSeries = macdChart.addSeries(LineSeries, { color: '#29b6f6', lineWidth: 2 });
      activeMACDSeries = macdSeries;
      const signalSeries = macdChart.addSeries(LineSeries, { color: '#ff7043', lineWidth: 2 });
      const histSeries = macdChart.addSeries(HistogramSeries, { color: '#26a69a' });

      const macdRes = calculateMACD(candles, 12, 26, 9);
      macdLineData = macdRes.macdLine;
      signalLineData = macdRes.signalLine;
      histData = macdRes.histogram;

      macdSeries.setData(macdLineData.map(d => ({ time: d.time as Time, value: d.value })));
      signalSeries.setData(signalLineData.map(d => ({ time: d.time as Time, value: d.value })));
      histSeries.setData(histData.map(h => ({
        time: h.time as Time,
        value: h.value,
        color: h.value >= 0 ? 'rgba(0, 200, 83, 0.4)' : 'rgba(255, 59, 48, 0.4)',
      })));
    }

    // 4. SYNCHRONIZE SCROLLING & ZOOMING
    const syncTimeScales = () => {
      const mainTimeScale = mainChart.timeScale();
      const rsiTimeScale = rsiChartApiRef.current?.timeScale();
      const macdTimeScale = macdChartApiRef.current?.timeScale();

      let isSyncing = false;

      const syncHandler = (sourceScale: ITimeScaleApi<Time>, destScales: (ITimeScaleApi<Time> | undefined)[]) => {
        if (isSyncing) return;
        const logicalRange = sourceScale.getVisibleLogicalRange();
        if (!logicalRange) return;

        isSyncing = true;
        destScales.forEach(scale => {
          if (scale) scale.setVisibleLogicalRange(logicalRange);
        });
        isSyncing = false;
      };

      mainTimeScale.subscribeVisibleLogicalRangeChange(() => {
        syncHandler(mainTimeScale, [rsiTimeScale, macdTimeScale]);
      });

      if (rsiTimeScale) {
        rsiTimeScale.subscribeVisibleLogicalRangeChange(() => {
          syncHandler(rsiTimeScale, [mainTimeScale, macdTimeScale]);
        });
      }

      if (macdTimeScale) {
        macdTimeScale.subscribeVisibleLogicalRangeChange(() => {
          syncHandler(macdTimeScale, [mainTimeScale, rsiTimeScale]);
        });
      }
    };
    syncTimeScales();

    // 5. CROSSHAIR SYNC & LEGEND UPDATER
    const updateLegend = (param: MouseEventParams<Time> | null) => {
      if (!param || !param.time) {
        // Fallback to last candle values
        const lastCandle = candles[candles.length - 1];
        if (!lastCandle) return;

        const findVal = (arr: any[], t: any) => arr.find(x => x.time === t)?.value || null;

        setLegendData({
          time: String(lastCandle.time),
          open: lastCandle.open,
          high: lastCandle.high,
          low: lastCandle.low,
          close: lastCandle.close,
          volume: lastCandle.volume,
          ma5: findVal(ma5Data, lastCandle.time),
          ma20: findVal(ma20Data, lastCandle.time),
          ma60: findVal(ma60Data, lastCandle.time),
          ma120: findVal(ma120Data, lastCandle.time),
          bbUpper: findVal(bbUpperData, lastCandle.time),
          bbLower: findVal(bbLowerData, lastCandle.time),
          rsi: findVal(rsiData, lastCandle.time),
          macd: findVal(macdLineData, lastCandle.time),
          macdSig: findVal(signalLineData, lastCandle.time),
          macdHist: findVal(histData, lastCandle.time),
        });
        return;
      }

      const timeVal = param.time;
      const data = param.seriesData.get(candlestickSeries) as any;
      const volData = param.seriesData.get(volumeSeries) as any;

      if (!data) return;

      const findVal = (arr: any[], t: any) => arr.find(x => x.time === t)?.value || null;

      setLegendData({
        time: String(timeVal),
        open: data.open ?? null,
        high: data.high ?? null,
        low: data.low ?? null,
        close: data.close ?? null,
        volume: volData?.value ?? null,
        ma5: findVal(ma5Data, timeVal),
        ma20: findVal(ma20Data, timeVal),
        ma60: findVal(ma60Data, timeVal),
        ma120: findVal(ma120Data, timeVal),
        bbUpper: findVal(bbUpperData, timeVal),
        bbLower: findVal(bbLowerData, timeVal),
        rsi: findVal(rsiData, timeVal),
        macd: findVal(macdLineData, timeVal),
        macdSig: findVal(signalLineData, timeVal),
        macdHist: findVal(histData, timeVal),
      });
    };

    mainChart.subscribeCrosshairMove(updateLegend);
    updateLegend(null); // Initial load with last values

    // Synchronize crosshair position across charts
    const syncCrosshairs = (
      sourceChart: IChartApi,
      destinations: { chart: IChartApi | null; series: ISeriesApi<any> | null }[]
    ) => {
      sourceChart.subscribeCrosshairMove((param) => {
        destinations.forEach(({ chart: destChart, series: destSeries }) => {
          if (!destChart || !destSeries) return;
          if (!param.point || !param.time) {
            destChart.clearCrosshairPosition();
            return;
          }
          const data = param.seriesData.get(destSeries);
          const price = data ? ('close' in data ? (data as any).close : ('value' in data ? (data as any).value : 0)) : 0;
          destChart.setCrosshairPosition(price, param.time, destSeries);
        });
      });
    };

    // Setup multi-directional crosshair sync
    const mainDests = [];
    if (rsiChartApiRef.current && activeRsiSeries) {
      mainDests.push({ chart: rsiChartApiRef.current, series: activeRsiSeries });
    }
    if (macdChartApiRef.current && activeMACDSeries) {
      mainDests.push({ chart: macdChartApiRef.current, series: activeMACDSeries });
    }
    if (mainDests.length > 0) {
      syncCrosshairs(mainChart, mainDests);
    }

    if (rsiChartApiRef.current && activeRsiSeries) {
      const rsiDests = [{ chart: mainChart, series: candlestickSeries }];
      if (macdChartApiRef.current && activeMACDSeries) {
        rsiDests.push({ chart: macdChartApiRef.current, series: activeMACDSeries });
      }
      syncCrosshairs(rsiChartApiRef.current, rsiDests);
    }

    if (macdChartApiRef.current && activeMACDSeries) {
      const macdDests = [{ chart: mainChart, series: candlestickSeries }];
      if (rsiChartApiRef.current && activeRsiSeries) {
        macdDests.push({ chart: mainChart, series: activeRsiSeries });
      }
      syncCrosshairs(macdChartApiRef.current, macdDests);
    }

    // Handle ResizeObserver
    const handleResize = () => {
      if (mainChartApiRef.current && mainContainer) {
        mainChartApiRef.current.resize(mainContainer.clientWidth, mainContainer.clientHeight);
      }
      if (rsiChartApiRef.current && rsiChartContainerRef.current) {
        rsiChartApiRef.current.resize(rsiChartContainerRef.current.clientWidth, rsiChartContainerRef.current.clientHeight);
      }
      if (macdChartApiRef.current && macdChartContainerRef.current) {
        macdChartApiRef.current.resize(macdChartContainerRef.current.clientWidth, macdChartContainerRef.current.clientHeight);
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(mainContainer);

    return () => {
      cleanupCharts();
      resizeObserver.disconnect();
    };
  }, [candles, showMA, showBB, showRSI, showMACD, range, isDark]);

  // Real-Time Price Update Handler: Update the last candle as activeTicker prices tick
  useEffect(() => {
    if (!candlestickSeriesRef.current || !volumeSeriesRef.current || candles.length === 0) return;

    const lastCandle = candles[candles.length - 1];
    if (!lastCandle) return;

    // Use activeTicker live price to construct updated candle
    const livePrice = activeTicker.price;
    if (livePrice <= 0) return;

    const updatedCandle = {
      time: lastCandle.time as Time,
      open: lastCandle.open,
      high: Math.max(lastCandle.high, livePrice),
      low: Math.min(lastCandle.low, livePrice),
      close: livePrice,
    };

    candlestickSeriesRef.current.update(updatedCandle);

    // Update volume series too
    volumeSeriesRef.current.update({
      time: lastCandle.time as Time,
      value: lastCandle.volume,
      color: livePrice >= lastCandle.open ? 'rgba(0, 200, 83, 0.2)' : 'rgba(255, 59, 48, 0.2)',
    });
  }, [activeTicker?.price, candles]);

  const changePctStr = activeTicker.change >= 0 ? `+${activeTicker.change.toFixed(2)}%` : `${activeTicker.change.toFixed(2)}%`;
  const isUp = activeTicker.change >= 0;

  return (
    <div className="flex flex-col bg-[#151B23] rounded-[16px] p-5 w-full h-full select-none transition-all duration-200" ref={containerRef}>
      
      {/* 1. Header Information Row */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-4 shrink-0 select-none">
        <div className="flex items-baseline gap-4">
          <div className="flex items-center gap-2 drag-handle cursor-grab select-none">
            <GripHorizontal size={12} className="text-zinc-655 shrink-0" />
            <div className="flex flex-col">
              <span className="text-2xl font-black tracking-tight text-white">{activeTicker?.name || '---'}</span>
              <span className="text-[10px] text-zinc-550 font-mono tracking-wider uppercase">{activeTicker?.symbol || '---'}</span>
            </div>
          </div>
          
          {/* Live Pricing info */}
          {activeTicker && (
            <div className="flex items-baseline gap-2.5 font-mono">
              <span className="text-2xl font-extrabold tracking-tight text-zinc-200">
                {activeTicker.symbol.match(/[A-Z]/) ? `$${activeTicker.price.toFixed(2)}` : `${activeTicker.price.toLocaleString()}원`}
              </span>
              <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${
                isUp 
                  ? 'bg-success/10 text-success' 
                  : 'bg-danger/10 text-danger'
              }`}>
                {changePctStr}
              </span>
            </div>
          )}
        </div>

        {/* 2. Control Panels: Range, Timeframe, Indicators */}
        <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold">
          
          {/* Timeframe Selector */}
          <div className="flex bg-[#0B0F14]/70 p-0.5 rounded-xl">
            {[
              { id: 'day', label: '일봉' },
              { id: 'week', label: '주봉' },
              { id: 'month', label: '월봉' },
            ].map(tf => (
              <button
                key={tf.id}
                onClick={() => setTimeframe(tf.id as any)}
                disabled={range === '1D' || range === '1W'}
                className={`px-3 py-1 rounded-xl transition-all cursor-pointer ${
                  timeframe === tf.id && range !== '1D' && range !== '1W'
                    ? 'bg-zinc-800/60 text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-350 disabled:opacity-30 disabled:cursor-not-allowed'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* Range Selector */}
          <div className="flex bg-[#0B0F14]/70 p-0.5 rounded-xl">
            {(['1D', '1W', '1M', '3M', '6M', '1Y', '3Y', '5Y', 'ALL'] as const).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-2 py-1 rounded-xl transition-all cursor-pointer ${
                  range === r
                    ? 'bg-zinc-800/60 text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-350'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Technical Indicators */}
          <div className="flex bg-[#0B0F14]/70 p-0.5 rounded-xl gap-1.5 px-2 py-1">
            <span className="text-zinc-600 self-center mr-1">지표:</span>
            
            <label className="flex items-center gap-1 cursor-pointer select-none text-zinc-400 hover:text-white">
              <input
                type="checkbox"
                checked={showMA}
                onChange={e => setShowMA(e.target.checked)}
                className="rounded border-transparent bg-zinc-900 text-primary focus:ring-0 w-3 h-3 cursor-pointer"
              />
              <span>이평선</span>
            </label>

            <label className="flex items-center gap-1 cursor-pointer select-none text-zinc-400 hover:text-white">
              <input
                type="checkbox"
                checked={showBB}
                onChange={e => setShowBB(e.target.checked)}
                className="rounded border-transparent bg-zinc-900 text-primary focus:ring-0 w-3 h-3 cursor-pointer"
              />
              <span>볼린저</span>
            </label>

            <label className="flex items-center gap-1 cursor-pointer select-none text-zinc-400 hover:text-white">
              <input
                type="checkbox"
                checked={showRSI}
                onChange={e => setShowRSI(e.target.checked)}
                className="rounded border-transparent bg-zinc-900 text-primary focus:ring-0 w-3 h-3 cursor-pointer"
              />
              <span>RSI</span>
            </label>

            <label className="flex items-center gap-1 cursor-pointer select-none text-zinc-400 hover:text-white">
              <input
                type="checkbox"
                checked={showMACD}
                onChange={e => setShowMACD(e.target.checked)}
                className="rounded border-transparent bg-zinc-900 text-primary focus:ring-0 w-3 h-3 cursor-pointer"
              />
              <span>MACD</span>
            </label>
          </div>

        </div>
      </div>

      {/* 3. Interactive OHLCV Legend Row */}
      {legendData && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-zinc-500 font-mono p-2 bg-zinc-950/20 rounded-xl px-3 shrink-0">
          <div>날짜: <span className="text-zinc-300 font-bold">{legendData.time || '---'}</span></div>
          <div>시: <span className="text-zinc-300 font-bold">{legendData.open?.toLocaleString() || '---'}</span></div>
          <div>고: <span className="text-success font-bold">{legendData.high?.toLocaleString() || '---'}</span></div>
          <div>저: <span className="text-danger font-bold">{legendData.low?.toLocaleString() || '---'}</span></div>
          <div>종: <span className={legendData.close && legendData.open && legendData.close >= legendData.open ? 'text-success font-bold' : 'text-danger font-bold'}>{legendData.close?.toLocaleString() || '---'}</span></div>
          <div>거래량: <span className="text-zinc-300 font-bold">{legendData.volume?.toLocaleString() || '---'}</span></div>
          
          {showMA && (
            <div className="flex gap-2 pl-3">
              <span className="text-[#ffea00]">MA5: {legendData.ma5?.toLocaleString(undefined, { maximumFractionDigits: 1 }) || '---'}</span>
              <span className="text-[#ff007f]">MA20: {legendData.ma20?.toLocaleString(undefined, { maximumFractionDigits: 1 }) || '---'}</span>
              <span className="text-[#00e5ff]">MA60: {legendData.ma60?.toLocaleString(undefined, { maximumFractionDigits: 1 }) || '---'}</span>
              <span className="text-[#7c4dff]">MA120: {legendData.ma120?.toLocaleString(undefined, { maximumFractionDigits: 1 }) || '---'}</span>
            </div>
          )}

          {showBB && legendData.bbUpper && (
            <div className="flex gap-2 pl-3 text-[#3f51b5]">
              <span>BB(U): {legendData.bbUpper?.toLocaleString(undefined, { maximumFractionDigits: 1 }) || '---'}</span>
              <span>BB(L): {legendData.bbLower?.toLocaleString(undefined, { maximumFractionDigits: 1 }) || '---'}</span>
            </div>
          )}

          {showRSI && legendData.rsi && (
            <div className="flex gap-1 pl-3 text-[#b388ff]">
              <span>RSI(14): {legendData.rsi?.toFixed(2) || '---'}</span>
            </div>
          )}

          {showMACD && legendData.macd && (
            <div className="flex gap-2 pl-3 text-[#29b6f6]">
              <span>MACD: {legendData.macd?.toFixed(2) || '---'}</span>
              <span className="text-[#ff7043]">Sig: {legendData.macdSig?.toFixed(2) || '---'}</span>
              <span className={legendData.macdHist && legendData.macdHist >= 0 ? 'text-success' : 'text-danger'}>Osc: {legendData.macdHist?.toFixed(2) || '---'}</span>
            </div>
          )}
        </div>
      )}

      {/* 4. Chart Render Panes */}
      <div className="flex-1 flex flex-col min-h-0 relative mt-3 gap-2 bg-transparent overflow-hidden">
        
        {/* Main Candlestick Chart Pane */}
        <div className="flex-1 min-h-0 relative" ref={mainChartContainerRef} />
        
        {/* Sub RSI Chart Pane */}
        {showRSI && (
          <div className="h-20 shrink-0 relative" ref={rsiChartContainerRef}>
            <div className="absolute top-1 left-2 text-[9px] text-[#b388ff] font-bold font-sans z-10 pointer-events-none uppercase tracking-wider">Relative Strength Index (14)</div>
          </div>
        )}

        {/* Sub MACD Chart Pane */}
        {showMACD && (
          <div className="h-24 shrink-0 relative" ref={macdChartContainerRef}>
            <div className="absolute top-1 left-2 text-[9px] text-[#29b6f6] font-bold font-sans z-10 pointer-events-none uppercase tracking-wider">MACD (12, 26, 9)</div>
          </div>
        )}

        {/* Loading Spinner Overlays */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-40 text-xs font-mono font-bold tracking-widest text-primary">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
            <span>LOADING STOCK CANDLES...</span>
          </div>
        )}

        {/* Locked state if API is disconnected */}
        {!isApiConnected && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/90 text-center p-6 z-40">
            <AlertTriangle className="w-8 h-8 text-danger/40 mb-3 animate-bounce" />
            <span className="text-xs text-zinc-400 font-bold font-sans uppercase tracking-wider">주가 차트 데이터 로드 대기 중</span>
            <span className="text-[10px] text-zinc-550 max-w-xs mt-2 font-sans leading-relaxed">
              모의투자 실시간 시세 및 거래를 시작하려면 헤더 패널에서 실거래 계좌 연동을 활성화해 주시기 바랍니다.
            </span>
          </div>
        )}
      </div>

    </div>
  );
}
