import { NextRequest, NextResponse } from 'next/server';

function parsePrice(val: unknown): number {
  if (val === undefined || val === null) return 0;
  const clean = String(val).replace(/,/g, '');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

function isValidWorldIndexSymbol(symbol: string): boolean {
  // Expected format: dot-prefixed market index code (e.g. ".DJI", ".IXIC")
  return /^\.[A-Z0-9]{1,15}$/.test(symbol);
}

async function fetchKoreanIndex(symbol: string) {
  try {
    const rtUrl = `https://polling.finance.naver.com/api/realtime?query=SERVICE_INDEX:${symbol}`;
    const rtRes = await fetch(rtUrl);
    let price = 0;
    let change = 0;
    let high = 0;
    let low = 0;
    let marketStatus: 'OPEN' | 'CLOSE' = 'CLOSE';

    if (rtRes.ok) {
      const rtData = await rtRes.json();
      const item = rtData?.result?.areas?.[0]?.datas?.[0];
      if (item) {
        price = parsePrice(item.nv) / 100;
        change = parseFloat(String(item.cr || 0));
        high = parsePrice(item.hv) / 100 || price;
        low = parsePrice(item.lv) / 100 || price;
        marketStatus = item.ms === 'OPEN' ? 'OPEN' : 'CLOSE';
      }
    }

    const histUrl = `https://m.stock.naver.com/api/index/${symbol}/price?pageSize=30&page=1`;
    const histRes = await fetch(histUrl);
    let history: number[] = [];
    if (histRes.ok) {
      const arr = await histRes.json();
      if (Array.isArray(arr) && arr.length > 0) {
        history = arr.map((x: { closePrice?: unknown }) => parsePrice(x.closePrice)).reverse();
        if (price === 0) {
          const item = arr[0];
          price = parsePrice(item.closePrice);
          const rawRatio = parseFloat(String(item.fluctuationsRatio || 0));
          const isFalling = item.compareToPreviousPrice?.name === 'FALLING';
          change = isFalling && rawRatio > 0 ? -rawRatio : rawRatio;
          high = parsePrice(item.highPrice) || price;
          low = parsePrice(item.lowPrice) || price;
        }
      }
    }

    if (history.length === 0) {
      history = [price - 50, price - 20, price + 10, price + 40, price];
    }

    return { price, change, high, low, history, marketStatus };
  } catch (err) {
    console.error(`Failed to fetch Korean index ${symbol}:`, err);
    return null;
  }
}

async function fetchWorldIndex(symbol: string) {
  try {
    if (!isValidWorldIndexSymbol(symbol)) return null;
    const safeSymbol = encodeURIComponent(symbol);

    const url = `https://api.stock.naver.com/index/${safeSymbol}/basic`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    if (!data) return null;

    const price = parsePrice(data.closePrice);
    const change = parseFloat(String(data.fluctuationsRatio || 0));
    const marketStatus: 'OPEN' | 'CLOSE' = data.marketStatus === 'OPEN' ? 'OPEN' : 'CLOSE';
    
    let high = price;
    let low = price;
    if (Array.isArray(data.stockItemTotalInfos)) {
      const highInfo = data.stockItemTotalInfos.find((x: { code: string }) => x.code === 'highPrice');
      const lowInfo = data.stockItemTotalInfos.find((x: { code: string }) => x.code === 'lowPrice');
      if (highInfo) high = parsePrice(highInfo.value);
      if (lowInfo) low = parsePrice(lowInfo.value);
    }

    let history: number[] = [];
    try {
      const histUrl = `https://api.stock.naver.com/index/${safeSymbol}/price?pageSize=30&page=1`;
      const histRes = await fetch(histUrl);
      if (histRes.ok) {
        const arr = await histRes.json();
        if (Array.isArray(arr)) {
          history = arr.map((x: { closePrice?: unknown }) => parsePrice(x.closePrice)).reverse();
        }
      }
    } catch (histErr) {
      console.error(`Failed to fetch history for world index ${symbol}:`, histErr);
    }

    if (history.length === 0) {
      history = [price - 50, price - 20, price + 10, price + 40, price];
    }

    return { price, change, high, low, history, marketStatus };
  } catch (err) {
    console.error(`Failed to fetch world index ${symbol}:`, err);
    return null;
  }
}

async function fetchExchangeRate(symbol: string) {
  try {
    const url = `https://api.stock.naver.com/marketindex/exchange/FX_USDKRW/prices?page=1&pageSize=30`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const arr = await response.json();
    if (!Array.isArray(arr) || arr.length === 0) return null;

    const item = arr[0];
    const price = parsePrice(item.closePrice);
    const change = parseFloat(String(item.fluctuationsRatio || 0));
    
    const now = new Date();
    const kstOffset = 9 * 60;
    const localOffset = now.getTimezoneOffset();
    const kstTime = new Date(now.getTime() + (kstOffset + localOffset) * 60 * 1000);
    const day = kstTime.getDay();
    const hour = kstTime.getHours();
    const minute = kstTime.getMinutes();
    
    let marketStatus: 'OPEN' | 'CLOSE' = 'CLOSE';
    if (day >= 1 && day <= 5) {
      const minutesSinceMidnight = hour * 60 + minute;
      if (minutesSinceMidnight >= 9 * 60 && minutesSinceMidnight <= 16 * 60) {
        marketStatus = 'OPEN';
      }
    }

    const history = arr.map((x: { closePrice?: unknown }) => parsePrice(x.closePrice)).reverse();

    return {
      price,
      change,
      high: price,
      low: price,
      history,
      marketStatus
    };
  } catch (err) {
    console.error(`Failed to fetch exchange rate ${symbol}:`, err);
    return null;
  }
}

async function fetchBitcoin() {
  try {
    const rtUrl = `https://api.upbit.com/v1/ticker?markets=KRW-BTC`;
    const rtRes = await fetch(rtUrl);
    if (!rtRes.ok) return null;
    const rtArr = await rtRes.json();
    if (!Array.isArray(rtArr) || rtArr.length === 0) return null;
    const item = rtArr[0];

    const price = parsePrice(item.trade_price);
    const change = parseFloat(String(item.signed_change_rate || 0)) * 100;
    const high = parsePrice(item.high_price);
    const low = parsePrice(item.low_price);
    const marketStatus: 'OPEN' | 'CLOSE' = 'OPEN';

    const histUrl = `https://api.upbit.com/v1/candles/days?market=KRW-BTC&count=30`;
    const histRes = await fetch(histUrl);
    let history: number[] = [];
    if (histRes.ok) {
      const histArr = await histRes.json();
      if (Array.isArray(histArr)) {
        history = histArr.map((x: { trade_price?: unknown }) => parsePrice(x.trade_price)).reverse();
      }
    }

    if (history.length === 0) {
      history = [price - 100000, price - 50000, price + 20000, price + 80000, price];
    }

    return { price, change, high, low, history, marketStatus };
  } catch (err) {
    console.error(`Failed to fetch Bitcoin price:`, err);
    return null;
  }
}

async function fetchDomesticStock(symbol: string) {
  try {
    const rtUrl = `https://polling.finance.naver.com/api/realtime?query=SERVICE_ITEM:${symbol}`;
    const rtRes = await fetch(rtUrl);
    if (!rtRes.ok) return null;
    const rtData = await rtRes.json();
    const item = rtData?.result?.areas?.[0]?.datas?.[0];
    if (!item) return null;

    const price = parsePrice(item.nv);
    const change = parseFloat(String(item.cr || 0));
    const high = parsePrice(item.hv) || price;
    const low = parsePrice(item.lv) || price;
    const marketStatus: 'OPEN' | 'CLOSE' = item.ms === 'OPEN' ? 'OPEN' : 'CLOSE';

    let history: number[] = [];
    try {
      const historyUrl = `https://fchart.stock.naver.com/sise.nhn?symbol=${symbol}&timeframe=day&count=6000&requestType=0`;
      const histRes = await fetch(historyUrl);
      if (histRes.ok) {
        const xml = await histRes.text();
        const matches = xml.matchAll(/<item data="([^"]+)"/g);
        for (const match of matches) {
          const parts = match[1].split('|');
          const close = parseFloat(parts[4]);
          if (!isNaN(close)) {
            history.push(close);
          }
        }
      }
    } catch (histErr) {
      console.error(`Failed to fetch history for domestic stock ${symbol}:`, histErr);
    }

    if (history.length === 0) {
      history = [price - 1000, price - 500, price + 200, price + 800, price];
    }

    return { price, change, high, low, history, marketStatus };
  } catch (err) {
    console.error(`Failed to fetch domestic stock ${symbol}:`, err);
    return null;
  }
}

async function fetchUSStock(symbol: string) {
  try {
    let url = `https://api.stock.naver.com/stock/${symbol}.O/basic`;
    let response = await fetch(url);
    if (!response.ok) {
      url = `https://api.stock.naver.com/stock/${symbol}.N/basic`;
      response = await fetch(url);
    }

    if (!response.ok) return null;
    const data = await response.json();
    if (!data) return null;

    const price = parsePrice(data.closePrice);
    const change = parseFloat(String(data.fluctuationsRatio || 0));
    const marketStatus: 'OPEN' | 'CLOSE' = data.marketStatus === 'OPEN' ? 'OPEN' : 'CLOSE';

    let high = price;
    let low = price;
    if (Array.isArray(data.stockItemTotalInfos)) {
      const highInfo = data.stockItemTotalInfos.find((x: { code: string }) => x.code === 'highPrice');
      const lowInfo = data.stockItemTotalInfos.find((x: { code: string }) => x.code === 'lowPrice');
      if (highInfo) high = parsePrice(highInfo.value);
      if (lowInfo) low = parsePrice(lowInfo.value);
    }

    const history: number[] = [price - 5, price - 2, price + 1, price + 3, price];

    return { price, change, high, low, history, marketStatus };
  } catch (err) {
    console.error(`Failed to fetch US stock ${symbol}:`, err);
    return null;
  }
}

async function fetchNaverStock(symbol: string) {
  if (symbol === 'KOSPI' || symbol === 'KOSDAQ') {
    return fetchKoreanIndex(symbol);
  }
  if (symbol.startsWith('.')) {
    return fetchWorldIndex(symbol);
  }
  if (symbol === 'FX_USDKRW') {
    return fetchExchangeRate(symbol);
  }
  if (symbol === 'KRW-BTC') {
    return fetchBitcoin();
  }
  if (/^\d{6}$/.test(symbol)) {
    return fetchDomesticStock(symbol);
  }
  if (/^[A-Za-z]+$/.test(symbol)) {
    return fetchUSStock(symbol);
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get('symbols');

    if (!symbolsParam) {
      return NextResponse.json({ error: 'Missing symbols parameter.' }, { status: 400 });
    }

    const symbols = symbolsParam.split(',').map(s => s.trim()).filter(Boolean);
    const results: Record<string, { price: number; change: number; high: number; low: number; history: number[]; marketStatus?: string }> = {};

    await Promise.all(
      symbols.map(async (symbol) => {
        const quote = await fetchNaverStock(symbol);
        if (quote) {
          results[symbol] = quote;
        }
      })
    );

    return NextResponse.json({ prices: results }, { status: 200 });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message || 'Internal Server Error' }, { status: 500 });
  }
}
