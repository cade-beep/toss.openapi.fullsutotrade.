'use client';

import React, { createContext, useContext, useEffect, useCallback, useReducer } from 'react';
import { Position } from '@/types/trading';
import { supabase } from '@/lib/supabase/client';

export interface OrderLog {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  qty: number;
  price: number;
  status: 'PENDING' | 'FILLED' | 'REJECTED' | 'CANCELLED';
  time: string;
}

export interface AISignalLog {
  id: string;
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string;
  time: string;
}

export interface WorkstationTicker {
  symbol: string;
  name: string;
  price: number;
  change: number;
  high: number;
  low: number;
  history: number[];
  marketStatus?: 'OPEN' | 'CLOSE';
  isIndex?: boolean;
}

export interface WorkstationIndex {
  price: number;
  change: number;
  high?: number;
  low?: number;
  history?: number[];
  marketStatus?: 'OPEN' | 'CLOSE';
}

interface WorkstationState {
  selectedSymbol: string;
  tickers: WorkstationTicker[];
  cashBalance: number;
  positions: Position[];
  ordersLog: OrderLog[];
  aiSignals: AISignalLog[];
  strategies: {
    ma: { active: boolean; fast: number; slow: number };
    rsi: { active: boolean; overbought: number; oversold: number };
  };
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  isHydrated: boolean;
  user: { id: string; email: string } | null;
  isApiConnected: boolean;
  kospi: WorkstationIndex | null;
  kosdaq: WorkstationIndex | null;
  nasdaq: WorkstationIndex | null;
  dji: WorkstationIndex | null;
  sp500: WorkstationIndex | null;
  usdKrw: WorkstationIndex | null;
  btc: WorkstationIndex | null;
  theme: 'light' | 'dark';
}

type WorkstationAction =
  | { type: 'HYDRATE'; payload: Partial<WorkstationState> }
  | { type: 'SET_HYDRATED' }
  | { type: 'SELECT_SYMBOL'; payload: string }
  | { type: 'TICK' }
  | { type: 'UPDATE_TICKER_PRICES'; payload: Record<string, { price: number; change: number; high: number; low: number; history?: number[]; marketStatus?: 'OPEN' | 'CLOSE' }> }
  | { type: 'ADD_TICKER'; payload: { symbol: string; name: string; price: number } }
  | { type: 'REMOVE_TICKER'; payload: string }

  | { type: 'SET_STRATEGIES'; payload: WorkstationState['strategies'] | ((prev: WorkstationState['strategies']) => WorkstationState['strategies']) }
  | { type: 'SHOW_TOAST'; payload: { message: string; type: 'success' | 'error' | 'info' } }
  | { type: 'CLEAR_TOAST' }
  | { type: 'SIGN_IN'; payload: { id: string; email: string } }
  | { type: 'SIGN_OUT' }
  | { type: 'SESSION_EXPIRE' }
  | { type: 'ADD_AI_SIGNAL'; payload: AISignalLog }
  | { type: 'ADD_ORDER_LOG'; payload: { id: string; symbol: string; side: 'BUY' | 'SELL'; qty: number; price: number; time: string } }
  | { type: 'TOGGLE_THEME' };

interface WorkstationContextType extends WorkstationState {
  setSelectedSymbol: (symbol: string) => void;
  setStrategies: React.Dispatch<React.SetStateAction<{
    ma: { active: boolean; fast: number; slow: number };
    rsi: { active: boolean; overbought: number; oversold: number };
  }>>;
  activeTicker: WorkstationTicker;
  executeTrade: (symbol: string, side: 'BUY' | 'SELL', qty: number, price: number, isAISignal?: boolean) => void;
  handlePanicSellAll: () => void;
  handleAddTicker: (symbol: string, name: string) => void;
  handleRemoveTicker: (symbol: string) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  handleSignIn: (id: string, email: string) => void;
  handleSignOut: () => void;
  handleSessionExpire: () => void;
  reloadUserData: () => Promise<void>;
  toggleTheme: () => void;
}

const WorkstationContext = createContext<WorkstationContextType | undefined>(undefined);

const defaultState: WorkstationState = {
  selectedSymbol: '',
  tickers: [],
  cashBalance: 0,
  positions: [],
  ordersLog: [],
  aiSignals: [],
  strategies: {
    ma: { active: false, fast: 5, slow: 20 },
    rsi: { active: false, overbought: 70, oversold: 30 },
  },
  toast: null,
  isHydrated: false,
  user: null,
  isApiConnected: false,
  kospi: null,
  kosdaq: null,
  nasdaq: null,
  dji: null,
  sp500: null,
  usdKrw: null,
  btc: null,
  theme: 'dark',
};

// --- DATA SCHEMA VALIDATION HELPERS ---
function validateCash(value: string): number | null {
  const num = Number(value);
  return !isNaN(num) && num >= 0 ? num : null;
}

function validatePositions(value: string): Position[] | null {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;
    const validated = parsed.filter((item: unknown) => {
      const pos = item as Record<string, unknown>;
      return (
        pos &&
        typeof pos === 'object' &&
        typeof pos.id === 'string' &&
        typeof pos.symbol === 'string' &&
        typeof pos.qty === 'number' && pos.qty >= 0 &&
        typeof pos.avgBuyPrice === 'number' && pos.avgBuyPrice >= 0 &&
        typeof pos.currentPrice === 'number' && pos.currentPrice >= 0
      );
    });
    return validated.length === parsed.length ? (validated as Position[]) : null;
  } catch {
    return null;
  }
}

function validateTickers(value: string): WorkstationTicker[] | null {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;
    const validated = parsed.filter((item: unknown) => {
      const ticker = item as Record<string, unknown>;
      return (
        ticker &&
        typeof ticker === 'object' &&
        typeof ticker.symbol === 'string' &&
        typeof ticker.name === 'string' &&
        typeof ticker.price === 'number' &&
        typeof ticker.change === 'number' &&
        typeof ticker.high === 'number' &&
        typeof ticker.low === 'number' &&
        Array.isArray(ticker.history) &&
        (ticker.history as unknown[]).every((h: unknown) => typeof h === 'number')
      );
    });
    return validated.length === parsed.length ? (validated as WorkstationTicker[]) : null;
  } catch {
    return null;
  }
}

function validateStrategies(value: string) {
  try {
    const parsed = JSON.parse(value);
    if (
      parsed &&
      parsed.ma && typeof parsed.ma.active === 'boolean' &&
      typeof parsed.ma.fast === 'number' && typeof parsed.ma.slow === 'number' &&
      parsed.rsi && typeof parsed.rsi.active === 'boolean' &&
      typeof parsed.rsi.overbought === 'number' && typeof parsed.rsi.oversold === 'number'
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function validateOrdersLog(value: string): OrderLog[] | null {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;
    const validated = parsed.filter((item: unknown) => {
      const order = item as Record<string, unknown>;
      return (
        order &&
        typeof order === 'object' &&
        typeof order.id === 'string' &&
        typeof order.symbol === 'string' &&
        (order.side === 'BUY' || order.side === 'SELL') &&
        (order.type === 'MARKET' || order.type === 'LIMIT') &&
        typeof order.qty === 'number' && order.qty >= 0 &&
        typeof order.price === 'number' && order.price >= 0 &&
        (order.status === 'PENDING' || order.status === 'FILLED' || order.status === 'REJECTED' || order.status === 'CANCELLED') &&
        typeof order.time === 'string'
      );
    });
    return validated.length === parsed.length ? (validated as OrderLog[]) : null;
  } catch {
    return null;
  }
}

// --- ATOMIC STATE REDUCER ---
function workstationReducer(state: WorkstationState, action: WorkstationAction): WorkstationState {
  switch (action.type) {
    case 'HYDRATE': {
      const nextState = {
        ...state,
        ...action.payload,
        isHydrated: true,
      };
      if (action.payload.ordersLog) {
        const merged = [...action.payload.ordersLog];
        const dbIds = new Set(merged.map((o) => o.id));
        state.ordersLog.forEach((o) => {
          if (!dbIds.has(o.id)) {
            merged.push(o);
          }
        });
        nextState.ordersLog = merged;
      }
      return nextState;
    }

    case 'SET_HYDRATED':
      return {
        ...state,
        isHydrated: true,
      };

    case 'SELECT_SYMBOL':
      return {
        ...state,
        selectedSymbol: action.payload,
      };

    case 'TICK': {
      const nextTickers = state.tickers.map((ticker) => {
        const isInverse2X = ticker.symbol === '252670';
        const drift = isInverse2X ? (Math.random() - 0.5) * 0.04 : (Math.random() - 0.5) * 0.006;
        const currentPrice = ticker.price || (isInverse2X ? 72 : 50000);
        const newPrice = isInverse2X 
          ? Math.max(50, Math.min(150, Math.round(currentPrice * (1 + drift))))
          : Math.round(currentPrice * (1 + drift));
        const basePrice = ticker.history[0] || newPrice;
        const newChange = Number(((newPrice - basePrice) / basePrice * 100).toFixed(2));
        const newHigh = Math.max(ticker.high || newPrice, newPrice);
        const newLow = Math.min(ticker.low || newPrice, newPrice);
        const newHistory = ticker.history.length > 0 ? [...ticker.history.slice(1), newPrice] : Array(7).fill(newPrice);

        return {
          ...ticker,
          price: newPrice,
          change: newChange,
          high: newHigh,
          low: newLow,
          history: newHistory,
        };
      });

      return {
        ...state,
        tickers: nextTickers,
      };
    }

    case 'UPDATE_TICKER_PRICES': {
      const pricesMap = action.payload;
      const nextTickers = state.tickers.map((ticker) => {
        const live = pricesMap[ticker.symbol];
        if (!live) return ticker;

        const newHistory = ticker.history.length > 0
          ? [...ticker.history.slice(1), live.price]
          : Array(7).fill(live.price);

        return {
          ...ticker,
          price: live.price,
          change: live.change,
          high: live.high,
          low: live.low,
          history: newHistory,
          marketStatus: live.marketStatus,
        };
      });

      const kospi = pricesMap['KOSPI'] ? { 
        price: pricesMap['KOSPI'].price, 
        change: pricesMap['KOSPI'].change,
        high: pricesMap['KOSPI'].high,
        low: pricesMap['KOSPI'].low,
        history: pricesMap['KOSPI'].history,
        marketStatus: pricesMap['KOSPI'].marketStatus
      } : state.kospi;
      
      const kosdaq = pricesMap['KOSDAQ'] ? { 
        price: pricesMap['KOSDAQ'].price, 
        change: pricesMap['KOSDAQ'].change,
        high: pricesMap['KOSDAQ'].high,
        low: pricesMap['KOSDAQ'].low,
        history: pricesMap['KOSDAQ'].history,
        marketStatus: pricesMap['KOSDAQ'].marketStatus
      } : state.kosdaq;

      const nasdaq = pricesMap['.IXIC'] ? { 
        price: pricesMap['.IXIC'].price, 
        change: pricesMap['.IXIC'].change,
        high: pricesMap['.IXIC'].high,
        low: pricesMap['.IXIC'].low,
        history: pricesMap['.IXIC'].history,
        marketStatus: pricesMap['.IXIC'].marketStatus
      } : state.nasdaq;

      const dji = pricesMap['.DJI'] ? { 
        price: pricesMap['.DJI'].price, 
        change: pricesMap['.DJI'].change,
        high: pricesMap['.DJI'].high,
        low: pricesMap['.DJI'].low,
        history: pricesMap['.DJI'].history,
        marketStatus: pricesMap['.DJI'].marketStatus
      } : state.dji;

      const sp500 = pricesMap['.INX'] ? { 
        price: pricesMap['.INX'].price, 
        change: pricesMap['.INX'].change,
        high: pricesMap['.INX'].high,
        low: pricesMap['.INX'].low,
        history: pricesMap['.INX'].history,
        marketStatus: pricesMap['.INX'].marketStatus
      } : state.sp500;

      const usdKrw = pricesMap['FX_USDKRW'] ? { 
        price: pricesMap['FX_USDKRW'].price, 
        change: pricesMap['FX_USDKRW'].change,
        high: pricesMap['FX_USDKRW'].high,
        low: pricesMap['FX_USDKRW'].low,
        history: pricesMap['FX_USDKRW'].history,
        marketStatus: pricesMap['FX_USDKRW'].marketStatus
      } : state.usdKrw;

      const btc = pricesMap['KRW-BTC'] ? { 
        price: pricesMap['KRW-BTC'].price, 
        change: pricesMap['KRW-BTC'].change,
        high: pricesMap['KRW-BTC'].high,
        low: pricesMap['KRW-BTC'].low,
        history: pricesMap['KRW-BTC'].history,
        marketStatus: pricesMap['KRW-BTC'].marketStatus
      } : state.btc;

      return {
        ...state,
        tickers: nextTickers,
        kospi,
        kosdaq,
        nasdaq,
        dji,
        sp500,
        usdKrw,
        btc
      };
    }

    case 'ADD_TICKER': {
      const { symbol, name, price } = action.payload;
      if (state.tickers.some((t) => t.symbol === symbol)) {
        return {
          ...state,
          toast: { message: '이미 등록된 종목입니다.', type: 'error' },
        };
      }

      const newTicker: WorkstationTicker = {
        symbol,
        name,
        price,
        change: 0.0,
        high: price,
        low: price,
        history: Array(7).fill(price),
      };

      return {
        ...state,
        tickers: [...state.tickers, newTicker],
        toast: { message: `관심종목 ${name} 추가됨`, type: 'success' },
      };
    }

    case 'REMOVE_TICKER': {
      const symbol = action.payload;
      if (state.tickers.length <= 1) {
        return {
          ...state,
          toast: { message: '최소 한 개의 관심종목이 유지되어야 합니다.', type: 'error' },
        };
      }

      const filtered = state.tickers.filter((t) => t.symbol !== symbol);
      const nextSelectedSymbol = state.selectedSymbol === symbol ? filtered[0].symbol : state.selectedSymbol;

      return {
        ...state,
        tickers: filtered,
        selectedSymbol: nextSelectedSymbol,
        toast: { message: '관심종목 삭제 완료', type: 'info' },
      };
    }



    case 'SET_STRATEGIES': {
      const nextStrategies = typeof action.payload === 'function' ? action.payload(state.strategies) : action.payload;
      return {
        ...state,
        strategies: nextStrategies,
      };
    }

    case 'SHOW_TOAST':
      return {
        ...state,
        toast: action.payload,
      };

    case 'CLEAR_TOAST':
      return {
        ...state,
        toast: null,
      };

    case 'SIGN_IN':
      return {
        ...state,
        user: action.payload,
        toast: { message: '로그인 세션이 활성화되었습니다.', type: 'success' },
      };

    case 'SIGN_OUT':
    case 'SESSION_EXPIRE':
      return {
        ...state,
        user: null,
        // Immediately turn off all strategies to kill processing intervals
        strategies: {
          ma: { ...state.strategies.ma, active: false },
          rsi: { ...state.strategies.rsi, active: false },
        },
        toast: {
          message: action.type === 'SESSION_EXPIRE' ? '세션이 만료되어 자동 매매가 강제 중지되었습니다.' : '로그아웃 되었습니다.',
          type: 'info',
        },
      };

    case 'ADD_AI_SIGNAL':
      return {
        ...state,
        aiSignals: [action.payload, ...state.aiSignals.slice(0, 49)],
      };

    case 'ADD_ORDER_LOG': {
      const { id, symbol, side, qty, price, time } = action.payload;
      if (state.ordersLog.some((order) => order.id === id)) {
        return state;
      }
      const newOrder: OrderLog = {
        id,
        symbol,
        side,
        type: 'MARKET',
        qty,
        price,
        status: 'FILLED',
        time,
      };
      return {
        ...state,
        ordersLog: [newOrder, ...state.ordersLog],
      };
    }

    case 'TOGGLE_THEME':
      return {
        ...state,
        theme: state.theme === 'light' ? 'dark' : 'light',
      };

    default:
      return state;
  }
}

export function WorkstationProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(workstationReducer, defaultState);

  const tickersRef = React.useRef(state.tickers);
  useEffect(() => {
    tickersRef.current = state.tickers;
  }, [state.tickers]);

  const activeTicker = state.tickers.find((t) => t.symbol === state.selectedSymbol) || state.tickers[0] || {
    symbol: '',
    name: '선택된 종목 없음',
    price: 0,
    change: 0,
    high: 0,
    low: 0,
    history: []
  };

  const setSelectedSymbol = useCallback((symbol: string) => {
    dispatch({ type: 'SELECT_SYMBOL', payload: symbol });
  }, []);

  const setStrategies = useCallback((payload: React.SetStateAction<WorkstationState['strategies']>) => {
    dispatch({ type: 'SET_STRATEGIES', payload });
  }, []);

  const handleAddTicker = useCallback(async (symbol: string, name: string) => {
    if (process.env.NEXT_PUBLIC_AUTH_ENABLED === 'true' && supabase && state.user) {
      if (state.tickers.some((t) => t.symbol === symbol)) {
        dispatch({ type: 'SHOW_TOAST', payload: { message: '이미 등록된 종목입니다.', type: 'error' } });
        return;
      }
      try {
        const { error } = await supabase
          .from('watchlist')
          .insert({ user_id: state.user.id, symbol, name });

        if (error) {
          console.error('Database insert watchlist error:', error);
          if (error.code === '23505') {
            dispatch({ type: 'SHOW_TOAST', payload: { message: '이미 등록된 종목입니다.', type: 'error' } });
          } else {
            dispatch({ type: 'SHOW_TOAST', payload: { message: `관심종목 추가 실패: ${error.message}`, type: 'error' } });
          }
        } else {
          const price = Math.round(50000 + Math.random() * 200000);
          dispatch({ type: 'ADD_TICKER', payload: { symbol, name, price } });
        }
      } catch (err) {
        console.error('Failed to add ticker to database:', err);
      }
    } else {
      const price = Math.round(50000 + Math.random() * 200000);
      dispatch({ type: 'ADD_TICKER', payload: { symbol, name, price } });
    }
  }, [state.user, state.tickers]);

  const handleRemoveTicker = useCallback(async (symbol: string) => {
    if (state.tickers.length <= 1) {
      dispatch({ type: 'SHOW_TOAST', payload: { message: '최소 한 개의 관심종목이 유지되어야 합니다.', type: 'error' } });
      return;
    }

    if (process.env.NEXT_PUBLIC_AUTH_ENABLED === 'true' && supabase && state.user) {
      try {
        const { error } = await supabase
          .from('watchlist')
          .delete()
          .eq('user_id', state.user.id)
          .eq('symbol', symbol);

        if (error) {
          console.error('Database delete watchlist error:', error);
          dispatch({ type: 'SHOW_TOAST', payload: { message: `관심종목 삭제 실패: ${error.message}`, type: 'error' } });
        } else {
          dispatch({ type: 'REMOVE_TICKER', payload: symbol });
        }
      } catch (err) {
        console.error('Failed to remove ticker from database:', err);
      }
    } else {
      dispatch({ type: 'REMOVE_TICKER', payload: symbol });
    }
  }, [state.user, state.tickers]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    dispatch({ type: 'SHOW_TOAST', payload: { message, type } });
  }, []);

  const handleSignIn = useCallback((id: string, email: string) => {
    dispatch({ type: 'SIGN_IN', payload: { id, email } });
  }, []);

  const handleSessionExpire = useCallback(() => {
    dispatch({ type: 'SESSION_EXPIRE' });
  }, []);

  // --- DATABASE HYDRATION FUNCTION ---
  const loadUserData = useCallback(async () => {
    const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === 'true';
    if (authEnabled && (!supabase || !state.user)) {
      return;
    }
    try {
      const userId = state.user?.id || 'dev-user-123';
      let hasCreds = false;

      if (!authEnabled || !supabase) {
        try {
          const res = await fetch('/api/credentials');
          const data = await res.json();
          hasCreds = !!(res.ok && data.exists);
        } catch (err) {
          console.error('Failed to load local credentials status:', err);
        }
      } else {
        // 0. Check API Credentials configuration
        const { data: creds, error: credsErr } = await supabase
          .from('api_credentials')
          .select('user_id')
          .eq('user_id', userId)
          .maybeSingle();

        hasCreds = !!creds && !credsErr;
      }

      // 1. Fetch or Initialize Portfolio
      let cash = 0;
      let positionsList: Position[] = [];

      if (hasCreds) {
        if (!authEnabled || !supabase) {
          // Local development fallback: fetch actual broker account balance and holdings via proxy
          try {
            const response = await fetch('/api/toss-proxy', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer dev-token-123'
              },
              body: JSON.stringify({ method: 'GET', path: '/api/v1/buying-power?currency=KRW' })
            });
            const data = await response.json();
            if (response.ok && data && !data.error) {
              cash = Number(data.result?.cashBuyingPower) || 0;
            }
          } catch (fetchErr) {
            console.error('Failed to fetch actual broker account balance for initialization:', fetchErr);
          }

          try {
            const response = await fetch('/api/toss-proxy', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer dev-token-123'
              },
              body: JSON.stringify({ method: 'GET', path: '/api/v1/holdings' })
            });
            const data = await response.json();
            if (response.ok && data && !data.error) {
              const items = data.result?.items || [];
              positionsList = items.map((p: { symbol: string; quantity: string | number; averagePurchasePrice: string | number }, idx: number) => ({
                id: `pos-${idx}-${p.symbol}`,
                symbol: p.symbol,
                qty: Number(p.quantity) || 0,
                avgBuyPrice: Number(p.averagePurchasePrice) || 0,
                currentPrice: Number(p.averagePurchasePrice) || 0
              }));
            }
          } catch (fetchErr) {
            console.error('Failed to fetch actual holdings:', fetchErr);
          }
        } else {
          const { data: portfolioData, error: portfolioErr } = await supabase
            .from('portfolio')
            .select('cash_balance')
            .eq('user_id', userId)
            .maybeSingle();

          if (portfolioErr) {
            console.error('Error fetching user portfolio from database:', portfolioErr);
          } else if (!portfolioData) {
            let initialBalance = 0;
            try {
              const token = 'dev-token-123';
              const { data: { session } } = await supabase.auth.getSession();
              const bearer = session?.access_token || token;
              
              const response = await fetch('/api/toss-proxy', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${bearer}`
                },
                body: JSON.stringify({ method: 'GET', path: '/api/v1/buying-power?currency=KRW' })
              });
              const data = await response.json();
              if (response.ok && data && !data.error) {
                initialBalance = Number(data.result?.cashBuyingPower) || 0;
              }
            } catch (fetchErr) {
              console.error('Failed to fetch actual broker account balance for initialization:', fetchErr);
            }

            const { error: insertErr } = await supabase
              .from('portfolio')
              .insert({ user_id: userId, cash_balance: initialBalance });
            if (insertErr) console.error('Error initializing user portfolio:', insertErr);
            cash = initialBalance;
          } else {
            cash = Number(portfolioData.cash_balance);
          }

          // Fetch Active positions via Supabase
          const { data: positionsData, error: positionsErr } = await supabase
            .from('positions')
            .select('id, symbol, qty, avg_buy_price')
            .eq('user_id', userId);

          if (positionsErr) {
            console.error('Error fetching user positions from database:', positionsErr);
          } else if (positionsData) {
            positionsList = positionsData.map((p) => ({
              id: p.id,
              symbol: p.symbol,
              qty: p.qty,
              avgBuyPrice: p.avg_buy_price,
              currentPrice: p.avg_buy_price,
            }));
          }
        }
      }

      // 3. Fetch or Initialize Watchlist
      let watchlistData: Array<{ symbol: string; name: string }> = [];
      let watchlistErr: { message: string } | null = null;

      if (authEnabled && supabase) {
        const { data, error } = await supabase
          .from('watchlist')
          .select('symbol, name')
          .eq('user_id', userId);
        watchlistData = data || [];
        watchlistErr = error;
      } else {
        const savedWatchlist = localStorage.getItem('toss_trading_watchlist');
        if (savedWatchlist) {
          try {
            watchlistData = JSON.parse(savedWatchlist);
          } catch {
            watchlistData = [];
          }
        }
        if (!watchlistData || watchlistData.length === 0) {
          watchlistData = [
            { symbol: '005930', name: '삼성전자' },
            { symbol: '000660', name: 'SK하이닉스' },
            { symbol: '252670', name: 'KODEX 200선물인버스2X' },
            { symbol: '035420', name: 'NAVER' }
          ];
        }
      }

      let nextTickers: WorkstationTicker[] = [];
      if (watchlistErr) {
        console.error('Error fetching user watchlist from database:', watchlistErr);
        nextTickers = tickersRef.current;
      } else {
        nextTickers = watchlistData.map((w) => {
          const existing = tickersRef.current.find((t) => t.symbol === w.symbol);
          if (existing) {
            if (!hasCreds) {
              return { ...existing, price: 0, change: 0, high: 0, low: 0, history: [] };
            }
            return existing;
          }
          const isInverse2X = w.symbol === '252670';
          const price = isInverse2X ? 72 : (hasCreds ? Math.round(50000 + Math.random() * 200000) : 0);
          const change = isInverse2X ? -2.70 : 0.0;
          return {
            symbol: w.symbol,
            name: w.name,
            price,
            change,
            high: isInverse2X ? 74 : price,
            low: isInverse2X ? 70 : price,
            history: price > 0 ? (isInverse2X ? [74, 73, 75, 74, 73, 72, 72] : Array(7).fill(price)) : [],
          };
        });
      }

      // 4. Fetch recent orders log
      let ordersList: OrderLog[] = [];
      if (hasCreds) {
        if (authEnabled && supabase) {
          const { data: ordersData, error: ordersErr } = await supabase
            .from('orders_log')
            .select('id, symbol, side, type, qty, price, status, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(100);

          if (ordersErr) {
            console.error('Error fetching user orders from database:', ordersErr);
          } else if (ordersData) {
            ordersList = ordersData.map((o) => {
              const time = o.created_at
                ? new Date(o.created_at).toTimeString().split(' ')[0]
                : new Date().toTimeString().split(' ')[0];
              return {
                id: o.id,
                symbol: o.symbol,
                side: o.side as 'BUY' | 'SELL',
                type: o.type as 'MARKET' | 'LIMIT',
                qty: o.qty,
                price: o.price,
                status: o.status as 'PENDING' | 'FILLED' | 'REJECTED' | 'CANCELLED',
                time,
              };
            });
          }
        } else {
          const savedOrders = localStorage.getItem('toss_trading_orders');
          if (savedOrders) {
            try {
              ordersList = JSON.parse(savedOrders);
            } catch {
              ordersList = [];
            }
          }
        }
      }

      dispatch({
        type: 'HYDRATE',
        payload: {
          cashBalance: cash,
          positions: positionsList,
          tickers: nextTickers,
          ordersLog: ordersList,
          isApiConnected: hasCreds,
        },
      });
    } catch (err) {
      console.error('Failed to execute database hydration load:', err);
      dispatch({
        type: 'HYDRATE',
        payload: {
          isApiConnected: false,
          cashBalance: 0,
          positions: [],
          ordersLog: [],
        },
      });
    }
  }, [state.user]);

  // Trigger Supabase hydration when user login status changes
  useEffect(() => {
    loadUserData();
  }, [state.user, loadUserData]);

  // --- ATOMIC TRANSACTION EXECUTION METHOD ---
  const executeTrade = useCallback(async (
    symbol: string,
    side: 'BUY' | 'SELL',
    qty: number,
    price: number,
    isAISignal: boolean = false
  ) => {
    if (!state.isApiConnected) {
      if (!isAISignal) {
        showToast('주문 실패: API가 연결되지 않았습니다.', 'error');
      }
      return;
    }

    try {
      let token = 'dev-token-123';
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          token = session.access_token;
        }
      }

      const response = await fetch('/api/orders/place', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ symbol, side, type: 'LIMIT', qty, price })
      });

      const resData = await response.json();

      if (!response.ok || resData.error) {
        const errMsg = resData.error || '주문 요청 실패';
        console.error('API order placement error:', errMsg);
        if (!isAISignal) {
          showToast(`주문 실패: ${errMsg}`, 'error');
        }
      } else {
        const ticker = state.tickers.find((t) => t.symbol === symbol);
        const name = ticker ? ticker.name : symbol;
        
        const statusText = resData.order?.status === 'PENDING' ? '접수 완료 (대기)' : '체결 완료';
        showToast(`${name} ${qty}주 ${side === 'BUY' ? '매수' : '매도'} 주문 ${statusText} (${isAISignal ? 'AI 자동' : '수동'})`, 'success');
        
        // Trigger dynamic state re-fetch to sync ledger balance and positions
        await loadUserData();
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('Order placement fetch failed:', err);
      if (!isAISignal) {
        showToast(`주문 실패: ${errorMsg || '네트워크 오류'}`, 'error');
      }
    }
  }, [state.tickers, state.isApiConnected, loadUserData, showToast]);

  const handlePanicSellAll = useCallback(async () => {
    if (state.positions.length === 0) {
      showToast('매도할 보유 포지션이 없습니다.', 'info');
      return;
    }

    let successCount = 0;
    let token = 'dev-token-123';
    if (supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        token = session.access_token;
      }
    }

    // Sell holdings sequentially to avoid parallel lock contentions on the portfolio row
    for (const pos of state.positions) {
      const ticker = state.tickers.find((t) => t.symbol === pos.symbol);
      const currentPrice = ticker ? ticker.price : pos.avgBuyPrice;

      try {
        const response = await fetch('/api/orders/place', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            symbol: pos.symbol,
            side: 'SELL',
            type: 'LIMIT',
            qty: pos.qty,
            price: currentPrice
          })
        });

        const resData = await response.json();

        if (!response.ok || resData.error) {
          console.error(`Panic sell failed for ${pos.symbol}:`, resData.error);
        } else {
          successCount++;
        }
      } catch (err) {
        console.error(`Panic sell network error for ${pos.symbol}:`, err);
      }
    }

    if (successCount > 0) {
      await loadUserData();
      showToast(`전체 포지션 일괄 매도 요청 완료 (${successCount}개 포지션)`, 'success');
    } else {
      showToast('긴급 청산 실패: 데이터베이스 오류 또는 네트워크 장애가 발생했습니다.', 'error');
    }
  }, [state.positions, state.tickers, loadUserData, showToast]);

  const handleSignOut = useCallback(async () => {
    if (process.env.NEXT_PUBLIC_AUTH_ENABLED === 'true' && supabase) {
      try {
        await supabase!.auth.signOut();
      } catch (err) {
        console.error('Error signing out via Supabase:', err);
        dispatch({ type: 'SIGN_OUT' });
      }
    } else {
      dispatch({ type: 'SIGN_OUT' });
    }
  }, []);

  const toggleTheme = useCallback(() => {
    dispatch({ type: 'TOGGLE_THEME' });
  }, []);

  // --- SUPABASE AUTH STATE SYNCHRONIZATION ---
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_AUTH_ENABLED !== 'true' || !supabase) {
      return;
    }

    // 1. Get initial session
    supabase!.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        dispatch({
          type: 'SIGN_IN',
          payload: { id: session.user.id, email: session.user.email || '' },
        });
      } else {
        dispatch({ type: 'SIGN_OUT' });
      }
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase!.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        dispatch({
          type: 'SIGN_IN',
          payload: { id: session.user.id, email: session.user.email || '' },
        });
      } else {
        if (event === 'SIGNED_OUT') {
          dispatch({ type: 'SIGN_OUT' });
        } else {
          dispatch({ type: 'SESSION_EXPIRE' });
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Toast auto-clear logic
  useEffect(() => {
    if (state.toast) {
      const timer = setTimeout(() => dispatch({ type: 'CLEAR_TOAST' }), 3000);
      return () => clearTimeout(timer);
    }
  }, [state.toast]);

  // --- LOCAL STORAGE HYDRATION WITH SAFE SCHEMA VALIDATION ---
  useEffect(() => {
    try {
      const savedCash = localStorage.getItem('toss_trading_cash');
      const savedPositions = localStorage.getItem('toss_trading_positions');
      const savedTickers = localStorage.getItem('toss_trading_tickers');
      const savedStrategies = localStorage.getItem('toss_trading_strategies');
      const savedOrders = localStorage.getItem('toss_trading_orders');
      const savedTheme = localStorage.getItem('toss_trading_theme');
      const savedUser = localStorage.getItem('toss_trading_user');

      const hydratePayload: Partial<WorkstationState> = {};

      if (savedCash !== null) {
        const cash = validateCash(savedCash);
        if (cash !== null) hydratePayload.cashBalance = cash;
      }
      if (savedPositions !== null) {
        const positions = validatePositions(savedPositions);
        if (positions !== null) hydratePayload.positions = positions;
      }
      if (savedTickers !== null) {
        const tickers = validateTickers(savedTickers);
        if (tickers !== null) hydratePayload.tickers = tickers;
      }
      if (savedStrategies !== null) {
        const strategies = validateStrategies(savedStrategies);
        if (strategies !== null) hydratePayload.strategies = strategies;
      }
      if (savedOrders !== null) {
        const orders = validateOrdersLog(savedOrders);
        if (orders !== null) hydratePayload.ordersLog = orders;
      }
      if (savedTheme === 'light' || savedTheme === 'dark') {
        hydratePayload.theme = savedTheme;
      }
      if (savedUser !== null) {
        try {
          hydratePayload.user = JSON.parse(savedUser);
        } catch {}
      }

      dispatch({ type: 'HYDRATE', payload: hydratePayload });
    } catch (err) {
      console.error('Error hydrating localStorage state:', err);
      dispatch({ type: 'SET_HYDRATED' });
    }
  }, []);

  // --- SYNC THEME WITH DOCUMENT CLASS & LOCALSTORAGE ---
  useEffect(() => {
    if (state.theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    if (state.isHydrated) {
      try {
        localStorage.setItem('toss_trading_theme', state.theme);
      } catch (err) {
        console.error('Error saving theme to localStorage:', err);
      }
    }
  }, [state.theme, state.isHydrated]);

  // --- SAVE STATE BACK TO LOCAL STORAGE ON MUTATIONS ---
  useEffect(() => {
    if (state.isHydrated) {
      try {
        localStorage.setItem('toss_trading_cash', state.cashBalance.toString());
        localStorage.setItem('toss_trading_positions', JSON.stringify(state.positions));
        localStorage.setItem('toss_trading_tickers', JSON.stringify(state.tickers));
        localStorage.setItem('toss_trading_strategies', JSON.stringify(state.strategies));
        localStorage.setItem('toss_trading_orders', JSON.stringify(state.ordersLog));
        if (state.user) {
          localStorage.setItem('toss_trading_user', JSON.stringify(state.user));
        } else {
          localStorage.removeItem('toss_trading_user');
        }
      } catch (err) {
        console.error('Error saving state changes to localStorage:', err);
      }
    }
  }, [state.cashBalance, state.positions, state.tickers, state.strategies, state.ordersLog, state.user, state.isHydrated]);

  // --- REAL-TIME MARKET PRICE POLLING & DRIFT ---
  // Poll KOSPI and KOSDAQ indices regardless of API connection status
  useEffect(() => {
    let active = true;
    const fetchIndices = async () => {
      try {
        const res = await fetch('/api/market/prices?symbols=KOSPI,KOSDAQ,.IXIC,.DJI,.INX,FX_USDKRW,KRW-BTC');
        if (!res.ok) {
          console.warn(`[Index Polling] Failed with HTTP status ${res.status}`);
          return;
        }
        const data = await res.json();
        if (active && data && data.prices) {
          dispatch({ type: 'UPDATE_TICKER_PRICES', payload: data.prices });
        }
      } catch (err: unknown) {
        if (active) {
          console.warn('[Index Polling] Network or connection error:', (err as Error).message || err);
        }
      }
    };

    fetchIndices();
    const interval = setInterval(fetchIndices, 1000); // Poll indices every 1 second
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Poll watchlist tickers if connected, drift if not
  const watchlistSymbolsStr = state.tickers.map((t) => t.symbol).join(',');
  useEffect(() => {
    if (state.isApiConnected) {
      let active = true;
      const fetchPrices = async () => {
        try {
          if (!watchlistSymbolsStr) return;
          const res = await fetch(`/api/market/prices?symbols=${watchlistSymbolsStr}`);
          if (!res.ok) {
            console.warn(`[Price Polling] Failed with HTTP status ${res.status}`);
            return;
          }
          const data = await res.json();
          if (active && data && data.prices) {
            dispatch({ type: 'UPDATE_TICKER_PRICES', payload: data.prices });
          }
        } catch (err: unknown) {
          if (active) {
            console.warn('[Price Polling] Network or connection error:', (err as Error).message || err);
          }
        }
      };

      fetchPrices();
      const interval = setInterval(fetchPrices, 1000); // Poll watchlist tickers every 1 second
      return () => {
        active = false;
        clearInterval(interval);
      };
    } else {
      const interval = setInterval(() => {
        dispatch({ type: 'TICK' });
      }, 1000); // Drift every 1 second
      return () => clearInterval(interval);
    }
  }, [state.isApiConnected, watchlistSymbolsStr]);



  return (
    <WorkstationContext.Provider
      value={{
        ...state,
        setSelectedSymbol,
        setStrategies,
        activeTicker,
        executeTrade: executeTrade,
        handlePanicSellAll,
        handleAddTicker,
        handleRemoveTicker,
        showToast,
        handleSignIn,
        handleSignOut,
        handleSessionExpire,
        reloadUserData: loadUserData,
        toggleTheme,
      }}
    >
      {children}
    </WorkstationContext.Provider>
  );
}

export function useWorkstation() {
  const context = useContext(WorkstationContext);
  if (!context) {
    throw new Error('useWorkstation must be used within a WorkstationProvider');
  }
  return context;
}
