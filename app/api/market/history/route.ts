import { NextRequest, NextResponse } from 'next/server';

interface Candle {
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Preset mapping for Korean stocks/ETFs to Yahoo Finance suffixes
const PRESET_MAPPING: Record<string, string> = {
  '005930': '005930.KS', // Samsung
  '000660': '000660.KS', // SK Hynix
  '035420': '035420.KS', // NAVER
  '035720': '035720.KS', // Kakao
  '005380': '005380.KS', // Hyundai
  '068270': '068270.KS', // Celltrion
  '373220': '373220.KS', // LG Energy Solution
  '005490': '005490.KS', // POSCO Holdings
  '247540': '247540.KQ', // EcoPro BM
  '252670': '252670.KS', // KODEX 200선물인버스2X
  '069500': '069500.KS', // KODEX 200
  '122630': '122630.KS', // KODEX Leverage
  '102110': '102110.KS', // TIGER 200
  '278530': '278530.KS', // KODEX 200TR
  '229200': '229200.KS', // KODEX Kosdaq 150
  '230480': '230480.KS', // TIGER Kosdaq 150
  '233740': '233740.KS', // KODEX Kosdaq 150 Leverage
  '233750': '233750.KS'  // TIGER Kosdaq 150 Leverage
};

// Map custom indices/exchange rates/cryptos
const SPECIAL_MAPPING: Record<string, string> = {
  'KOSPI': '^KS11',
  'KOSDAQ': '^KQ11',
  '.IXIC': '^IXIC',
  '.DJI': '^DJI',
  '.INX': '^GSPC',
  'FX_USDKRW': 'USDKRW=X',
  'KRW-BTC': 'BTC-KRW'
};

async function resolveYahooSymbol(symbol: string): Promise<string> {
  if (SPECIAL_MAPPING[symbol]) return SPECIAL_MAPPING[symbol];
  if (PRESET_MAPPING[symbol]) return PRESET_MAPPING[symbol];
  if (symbol.includes('.') || symbol.includes('=')) return symbol;

  if (/^\d{6}$/.test(symbol)) {
    // Search Yahoo Finance to resolve dynamically if it is a Korean stock code not preset
    try {
      const res = await fetch(`https://query2.finance.yahoo.com/v1/finance/search?q=${symbol}`);
      if (res.ok) {
        const data = await res.json();
        const match = data.quotes?.[0]?.symbol;
        if (match) return match;
      }
    } catch (err) {
      console.warn(`Failed to resolve Yahoo symbol for ${symbol}:`, err);
    }
    return `${symbol}.KS`; // Default KOSPI fallback
  }

  return symbol; // US Tickers (AAPL, TSLA, etc.)
}

// Fetch from Naver fchart (EUC-KR XML) for domestic assets
async function fetchNaverHistory(symbol: string, timeframe: string, count: number): Promise<Candle[]> {
  const tf = timeframe === 'month' ? 'month' : timeframe === 'week' ? 'week' : 'day';
  const url = `https://fchart.stock.naver.com/sise.nhn?symbol=${symbol}&timeframe=${tf}&count=${count}&requestType=0`;
  const res = await fetch(url);
  const candles: Candle[] = [];

  if (!res.ok) return candles;

  const xml = await res.text();
  const matches = xml.matchAll(/<item data="([^"]+)"/g);
  for (const match of matches) {
    const parts = match[1].split('|');
    if (parts.length >= 6) {
      const dateStr = parts[0]; // YYYYMMDD
      const open = parseFloat(parts[1]);
      const high = parseFloat(parts[2]);
      const low = parseFloat(parts[3]);
      const close = parseFloat(parts[4]);
      const volume = parseFloat(parts[5]);

      if (!isNaN(open) && !isNaN(high) && !isNaN(low) && !isNaN(close)) {
        const time = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
        candles.push({ time, open, high, low, close, volume });
      }
    }
  }

  return candles;
}

// Fetch from Yahoo Finance (JSON) for US/global assets
async function fetchYahooHistory(symbol: string, range: string, interval: string): Promise<Candle[]> {
  const yahooSymbol = await resolveYahooSymbol(symbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=${range}&interval=${interval}`;
  const res = await fetch(url);
  const candles: Candle[] = [];

  if (!res.ok) return candles;

  const data = await res.json();
  const result = data.chart?.result?.[0];
  if (!result) return candles;

  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0];
  if (!quote) return candles;

  const opens = quote.open || [];
  const highs = quote.high || [];
  const lows = quote.low || [];
  const closes = quote.close || [];
  const volumes = quote.volume || [];

  const isIntraday = interval.endsWith('m') || interval.endsWith('h');

  for (let i = 0; i < timestamps.length; i++) {
    const timeVal = timestamps[i];
    const open = opens[i];
    const high = highs[i];
    const low = lows[i];
    const close = closes[i];
    const volume = volumes[i] || 0;

    if (open !== null && high !== null && low !== null && close !== null) {
      if (isIntraday) {
        // Intraday expects Unix timestamp in seconds
        candles.push({ time: timeVal, open, high, low, close, volume });
      } else {
        // Daily/weekly/monthly expects YYYY-MM-DD string
        const date = new Date(timeVal * 1000);
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        candles.push({ time: `${yyyy}-${mm}-${dd}`, open, high, low, close, volume });
      }
    }
  }

  return candles;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const timeframe = searchParams.get('timeframe') || 'day'; // day, week, month
    const range = searchParams.get('range') || '1M'; // 1D, 1W, 1M, 3M, 6M, 1Y, 3Y, 5Y, ALL

    if (!symbol) {
      return NextResponse.json({ success: false, error: 'Missing symbol parameter' }, { status: 400 });
    }

    const isKoreanAsset = /^\d{6}$/.test(symbol) || symbol === 'KOSPI' || symbol === 'KOSDAQ';
    const isIntraday = range === '1D' || range === '1W';

    let candles: Candle[] = [];

    if (isKoreanAsset && !isIntraday) {
      // Use Naver fchart for daily/weekly/monthly Korean stocks/indices
      // Map range to count
      let count = 30;
      if (range === '1M') count = 30;
      else if (range === '3M') count = 90;
      else if (range === '6M') count = 180;
      else if (range === '1Y') count = 365;
      else if (range === '3Y') count = 365 * 3;
      else if (range === '5Y') count = 365 * 5;
      else if (range === 'ALL') count = 5000;

      // Adjust counts for weekly/monthly
      if (timeframe === 'week') {
        count = Math.max(15, Math.ceil(count / 5));
      } else if (timeframe === 'month') {
        count = Math.max(10, Math.ceil(count / 20));
      }

      candles = await fetchNaverHistory(symbol, timeframe, count);
    } else {
      // Use Yahoo Finance for US stocks, indices, currency, crypto, or ANY intraday requests
      let yahooRange = '1mo';
      let yahooInterval = '1d';

      if (range === '1D') {
        yahooRange = '1d';
        yahooInterval = '5m';
      } else if (range === '1W') {
        yahooRange = '5d';
        yahooInterval = '15m';
      } else {
        // Standard range mappings
        if (range === '1M') yahooRange = '1mo';
        else if (range === '3M') yahooRange = '3mo';
        else if (range === '6M') yahooRange = '6mo';
        else if (range === '1Y') yahooRange = '1y';
        else if (range === '3Y') yahooRange = '5y';
        else if (range === '5Y') yahooRange = '5y';
        else if (range === 'ALL') yahooRange = 'max';

        // Timeframe to interval
        if (timeframe === 'week') yahooInterval = '1wk';
        else if (timeframe === 'month') yahooInterval = '1mo';
      }

      candles = await fetchYahooHistory(symbol, yahooRange, yahooInterval);

      // Filter last 3 years on server if 3Y was requested
      if (range === '3Y' && candles.length > 0) {
        const cutoff = new Date();
        cutoff.setFullYear(cutoff.getFullYear() - 3);
        candles = candles.filter(c => {
          const cDate = typeof c.time === 'string' ? new Date(c.time) : new Date((c.time as number) * 1000);
          return cDate >= cutoff;
        });
      }
    }

    return NextResponse.json({ success: true, candles }, { status: 200 });
  } catch (err: any) {
    console.error('Error fetching market history:', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
