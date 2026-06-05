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

// Ticker interface for client-side state
export interface WorkstationTicker {
  symbol: string;
  name: string;
  price: number;
  change: number;
  high: number;
  low: number;
  history: number[];
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
}

type WorkstationAction =
  | { type: 'HYDRATE'; payload: Partial<WorkstationState> }
  | { type: 'SET_HYDRATED' }
  | { type: 'SELECT_SYMBOL'; payload: string }
  | { type: 'TICK' }
  | { type: 'ADD_TICKER'; payload: { symbol: string; name: string; price: number } }
  | { type: 'REMOVE_TICKER'; payload: string }
  | { type: 'EXECUTE_TRADE'; payload: { symbol: string; side: 'BUY' | 'SELL'; qty: number; price: number; isAISignal?: boolean } }
  | { type: 'PANIC_SELL_ALL' }
  | { type: 'SET_STRATEGIES'; payload: any }
  | { type: 'SHOW_TOAST'; payload: { message: string; type: 'success' | 'error' | 'info' } }
  | { type: 'CLEAR_TOAST' }
  | { type: 'SIGN_IN'; payload: { id: string; email: string } }
  | { type: 'SIGN_OUT' }
  | { type: 'SESSION_EXPIRE' }
  | { type: 'ADD_AI_SIGNAL'; payload: AISignalLog }
  | { type: 'ADD_ORDER_LOG'; payload: any };

interface WorkstationContextType extends WorkstationState {
  setSelectedSymbol: (symbol: string) => void;
  setStrategies: React.Dispatch<React.SetStateAction<{
    ma: { active: boolean; fast: number; slow: number };
    rsi: { active: boolean; overbought: number; oversold: number };
  }>>;
  activeTicker: WorkstationTicker;
  executeMockTrade: (symbol: string, side: 'BUY' | 'SELL', qty: number, price: number, isAISignal?: boolean) => void;
  handlePanicSellAll: () => void;
  handleAddTicker: (symbol: string, name: string) => void;
  handleRemoveTicker: (symbol: string) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  handleSignIn: (id: string, email: string) => void;
  handleSignOut: () => void;
  handleSessionExpire: () => void;
}

const WorkstationContext = createContext<WorkstationContextType | undefined>(undefined);

const defaultState: WorkstationState = {
  selectedSymbol: '005930',
  tickers: [
    { symbol: '005930', name: '삼성전자', price: 70200, change: 1.25, high: 71000, low: 69500, history: [69500, 69800, 70100, 69900, 70200, 70500, 70200] },
    { symbol: '000660', name: 'SK하이닉스', price: 151200, change: -0.45, high: 153000, low: 149500, history: [152000, 153000, 151000, 150500, 152000, 151200, 151200] },
    { symbol: '035420', name: 'NAVER', price: 181500, change: 2.10, high: 183000, low: 178000, history: [178000, 179000, 180500, 180000, 182000, 181000, 181500] },
    { symbol: '005380', name: '현대차', price: 235500, change: 0.00, high: 237000, low: 234000, history: [236000, 235000, 234500, 235000, 236000, 235500, 235500] },
    { symbol: '068270', name: '셀트리온', price: 178400, change: -1.85, high: 182000, low: 177000, history: [181000, 182000, 180000, 179000, 178500, 178000, 178400] },
  ],
  cashBalance: 10000000, // 10,000,000 KRW
  positions: [
    { id: 'mock-pos-1', symbol: '005930', qty: 50, avgBuyPrice: 68900, currentPrice: 70200 },
    { id: 'mock-pos-2', symbol: '035420', qty: 15, avgBuyPrice: 179500, currentPrice: 181500 },
  ],
  ordersLog: [
    { id: 'ORD-9832', symbol: '005930', side: 'BUY', type: 'MARKET', qty: 50, price: 68900, status: 'FILLED', time: '10:15:30' },
    { id: 'ORD-9811', symbol: '035420', side: 'BUY', type: 'LIMIT', qty: 15, price: 179500, status: 'FILLED', time: '09:42:15' },
  ],
  aiSignals: [
    { id: 'SIG-2101', symbol: '005930', action: 'BUY', confidence: 0.88, reasoning: '5-MA crossed above 20-MA. RSI index shows oversold momentum recovery at 35.4.', time: '10:15:02' },
  ],
  strategies: {
    ma: { active: false, fast: 5, slow: 20 },
    rsi: { active: false, overbought: 70, oversold: 30 },
  },
  toast: null,
  isHydrated: false,
  user: process.env.NEXT_PUBLIC_AUTH_ENABLED === 'true' ? null : { id: 'mock-user-123', email: 'trader@toss.im' }, // Configurable developer mock user
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
    const validated = parsed.filter((pos: any) => {
      return (
        pos &&
        typeof pos.id === 'string' &&
        typeof pos.symbol === 'string' &&
        typeof pos.qty === 'number' && pos.qty >= 0 &&
        typeof pos.avgBuyPrice === 'number' && pos.avgBuyPrice >= 0 &&
        typeof pos.currentPrice === 'number' && pos.currentPrice >= 0
      );
    });
    return validated.length === parsed.length ? validated : null;
  } catch {
    return null;
  }
}

function validateTickers(value: string): WorkstationTicker[] | null {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;
    const validated = parsed.filter((ticker: any) => {
      return (
        ticker &&
        typeof ticker.symbol === 'string' &&
        typeof ticker.name === 'string' &&
        typeof ticker.price === 'number' &&
        typeof ticker.change === 'number' &&
        typeof ticker.high === 'number' &&
        typeof ticker.low === 'number' &&
        Array.isArray(ticker.history) &&
        ticker.history.every((h: any) => typeof h === 'number')
      );
    });
    return validated.length === parsed.length ? validated : null;
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
    const validated = parsed.filter((order: any) => {
      return (
        order &&
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
    return validated.length === parsed.length ? validated : null;
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
        const drift = (Math.random() - 0.5) * 0.006;
        const newPrice = Math.round(ticker.price * (1 + drift));
        const basePrice = ticker.history[0];
        const newChange = Number(((newPrice - basePrice) / basePrice * 100).toFixed(2));
        const newHigh = Math.max(ticker.high, newPrice);
        const newLow = Math.min(ticker.low, newPrice);
        const newHistory = [...ticker.history.slice(1), newPrice];

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

    case 'EXECUTE_TRADE': {
      const { symbol, side, qty, price, isAISignal = false } = action.payload;
      
      // Safety Check: Prevent execution when no authenticated user session exists
      if (!state.user) {
        return {
          ...state,
          toast: isAISignal ? state.toast : { message: '주문 실패: 로그인이 필요합니다.', type: 'error' },
        };
      }

      const ticker = state.tickers.find((t) => t.symbol === symbol);
      if (!ticker) return state;

      const totalCost = qty * price;

      if (side === 'BUY') {
        if (state.cashBalance < totalCost) {
          return {
            ...state,
            toast: isAISignal ? state.toast : { message: '주문 실패: 예수금이 부족합니다.', type: 'error' },
          };
        }

        let nextPositions = [...state.positions];
        const existingIdx = nextPositions.findIndex((p) => p.symbol === symbol);
        if (existingIdx !== -1) {
          const existing = nextPositions[existingIdx];
          const totalQty = existing.qty + qty;
          const avgPrice = Math.round((existing.qty * existing.avgBuyPrice + totalCost) / totalQty);
          nextPositions[existingIdx] = {
            ...existing,
            qty: totalQty,
            avgBuyPrice: avgPrice,
          };
        } else {
          nextPositions.push({
            id: `pos-${Math.random().toString(36).substring(2, 9)}`,
            symbol,
            qty,
            avgBuyPrice: price,
            currentPrice: price,
          });
        }

        const newOrder: OrderLog = {
          id: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
          symbol,
          side,
          type: 'MARKET',
          qty,
          price,
          status: 'FILLED',
          time: new Date().toTimeString().split(' ')[0],
        };

        return {
          ...state,
          cashBalance: state.cashBalance - totalCost,
          positions: nextPositions,
          ordersLog: [newOrder, ...state.ordersLog],
          toast: {
            message: `${ticker.name} ${qty}주 매수 주문 체결 완료 (${isAISignal ? 'AI 자동' : '수동'})`,
            type: 'success',
          },
        };
      } else {
        // SELL
        const existingIdx = state.positions.findIndex((p) => p.symbol === symbol);
        if (existingIdx === -1 || state.positions[existingIdx].qty < qty) {
          return {
            ...state,
            toast: isAISignal ? state.toast : { message: '주문 실패: 매도할 보유 수량이 부족합니다.', type: 'error' },
          };
        }

        const existing = state.positions[existingIdx];
        const nextPositions = state.positions
          .map((p, idx) => (idx === existingIdx ? { ...p, qty: p.qty - qty } : p))
          .filter((p) => p.qty > 0);

        const newOrder: OrderLog = {
          id: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
          symbol,
          side,
          type: 'MARKET',
          qty,
          price,
          status: 'FILLED',
          time: new Date().toTimeString().split(' ')[0],
        };

        return {
          ...state,
          cashBalance: state.cashBalance + totalCost,
          positions: nextPositions,
          ordersLog: [newOrder, ...state.ordersLog],
          toast: {
            message: `${ticker.name} ${qty}주 매도 주문 체결 완료 (${isAISignal ? 'AI 자동' : '수동'})`,
            type: 'success',
          },
        };
      }
    }

    case 'PANIC_SELL_ALL': {
      // Safety Check: Prevent execution when no authenticated user session exists
      if (!state.user) {
        return {
          ...state,
          toast: { message: '긴급 주문 실패: 로그인이 필요합니다.', type: 'error' },
        };
      }

      if (state.positions.length === 0) {
        return {
          ...state,
          toast: { message: '매도할 보유 포지션이 없습니다.', type: 'info' },
        };
      }

      let proceeds = 0;
      const closedOrders: OrderLog[] = [];

      state.positions.forEach((pos) => {
        const ticker = state.tickers.find((t) => t.symbol === pos.symbol);
        const currentPrice = ticker ? ticker.price : pos.avgBuyPrice;
        proceeds += pos.qty * currentPrice;

        closedOrders.push({
          id: `PANIC-${Math.floor(1000 + Math.random() * 9000)}`,
          symbol: pos.symbol,
          side: 'SELL',
          type: 'MARKET',
          qty: pos.qty,
          price: currentPrice,
          status: 'FILLED',
          time: new Date().toTimeString().split(' ')[0],
        });
      });

      return {
        ...state,
        cashBalance: state.cashBalance + proceeds,
        positions: [],
        ordersLog: [...closedOrders, ...state.ordersLog],
        toast: { message: '긴급 조치: 모든 보유 포지션 전량 청산 완료', type: 'success' },
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

    default:
      return state;
  }
}

export function WorkstationProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(workstationReducer, defaultState);

  const tickersRef = React.useRef(state.tickers);
  tickersRef.current = state.tickers;

  const activeTicker = state.tickers.find((t) => t.symbol === state.selectedSymbol) || state.tickers[0];

  const setSelectedSymbol = useCallback((symbol: string) => {
    dispatch({ type: 'SELECT_SYMBOL', payload: symbol });
  }, []);

  const setStrategies = useCallback((payload: any) => {
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
    if (process.env.NEXT_PUBLIC_AUTH_ENABLED !== 'true' || !supabase || !state.user) {
      return;
    }
    try {
      const userId = state.user.id;
      
      // 1. Fetch or Initialize Portfolio
      let cash = 10000000;
      const { data: portfolioData, error: portfolioErr } = await supabase
        .from('portfolio')
        .select('cash_balance')
        .eq('user_id', userId)
        .maybeSingle();

      if (portfolioErr) {
        console.error('Error fetching user portfolio from database:', portfolioErr);
      } else if (!portfolioData) {
        const { error: insertErr } = await supabase
          .from('portfolio')
          .insert({ user_id: userId, cash_balance: 10000000 });
        if (insertErr) console.error('Error initializing user portfolio:', insertErr);
      } else {
        cash = Number(portfolioData.cash_balance);
      }

      // 2. Fetch Active positions
      const { data: positionsData, error: positionsErr } = await supabase
        .from('positions')
        .select('id, symbol, qty, avg_buy_price')
        .eq('user_id', userId);

      let positionsList: Position[] = [];
      if (positionsErr) {
        console.error('Error fetching user positions from database:', positionsErr);
      } else if (positionsData) {
        positionsList = positionsData.map((p) => {
          return {
            id: p.id,
            symbol: p.symbol,
            qty: p.qty,
            avgBuyPrice: p.avg_buy_price,
            currentPrice: p.avg_buy_price, // fallback, UI dynamically retrieves live current price
          };
        });
      }

      // 3. Fetch or Initialize Watchlist
      const { data: watchlistData, error: watchlistErr } = await supabase
        .from('watchlist')
        .select('symbol, name')
        .eq('user_id', userId);

      let nextTickers: WorkstationTicker[] = [];
      if (watchlistErr) {
        console.error('Error fetching user watchlist from database:', watchlistErr);
        nextTickers = tickersRef.current;
      } else if (!watchlistData || watchlistData.length === 0) {
        // Initialize user watchlist in database with default tickers
        const defaultWatchlist = defaultState.tickers.map((t) => ({
          user_id: userId,
          symbol: t.symbol,
          name: t.name,
        }));
        const { error: insertErr } = await supabase
          .from('watchlist')
          .insert(defaultWatchlist);
        if (insertErr) {
          console.error('Error initializing user watchlist in database:', insertErr);
          nextTickers = tickersRef.current;
        } else {
          nextTickers = defaultState.tickers;
        }
      } else {
        // Build new tickers list based on database watchlist
        nextTickers = watchlistData.map((w) => {
          const existing = tickersRef.current.find((t) => t.symbol === w.symbol);
          if (existing) {
            return existing;
          }
          // If not in current state, initialize with randomized price
          const price = Math.round(50000 + Math.random() * 200000);
          return {
            symbol: w.symbol,
            name: w.name,
            price,
            change: 0.0,
            high: price,
            low: price,
            history: Array(7).fill(price),
          };
        });
      }

      // 4. Fetch recent orders log from Supabase
      const { data: ordersData, error: ordersErr } = await supabase
        .from('orders_log')
        .select('id, symbol, side, type, qty, price, status, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);

      let ordersList: OrderLog[] = [];
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

      dispatch({
        type: 'HYDRATE',
        payload: {
          cashBalance: cash,
          positions: positionsList,
          tickers: nextTickers,
          ordersLog: ordersList,
        },
      });
    } catch (err) {
      console.error('Failed to execute Supabase database load:', err);
    }
  }, [state.user]);

  // Trigger Supabase hydration when user login status changes
  useEffect(() => {
    loadUserData();
  }, [state.user, loadUserData]);

  // --- ATOMIC TRANSACTION EXECUTION METHOD ---
  // --- ATOMIC TRANSACTION EXECUTION METHOD ---
  const executeMockTrade = useCallback(async (
    symbol: string,
    side: 'BUY' | 'SELL',
    qty: number,
    price: number,
    isAISignal: boolean = false
  ) => {
    if (process.env.NEXT_PUBLIC_AUTH_ENABLED === 'true' && supabase && state.user) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || '';

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
          
          // Log transaction locally to update executions ledger
          dispatch({
            type: 'ADD_ORDER_LOG',
            payload: {
              id: resData.order?.id || `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
              symbol,
              side,
              qty,
              price,
              time: new Date().toTimeString().split(' ')[0],
            },
          });

          // Trigger dynamic state re-fetch to sync ledger balance and positions
          await loadUserData();
        }
      } catch (err: any) {
        console.error('Order placement fetch failed:', err);
        if (!isAISignal) {
          showToast(`주문 실패: ${err.message || '네트워크 오류'}`, 'error');
        }
      }
    } else {
      // Local Sandbox mock execution
      dispatch({ type: 'EXECUTE_TRADE', payload: { symbol, side, qty, price, isAISignal } });
    }
  }, [state.user, state.tickers, loadUserData, showToast]);

  const handlePanicSellAll = useCallback(async () => {
    if (process.env.NEXT_PUBLIC_AUTH_ENABLED === 'true' && supabase && state.user) {
      if (state.positions.length === 0) {
        showToast('매도할 보유 포지션이 없습니다.', 'info');
        return;
      }

      let successCount = 0;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

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
            dispatch({
              type: 'ADD_ORDER_LOG',
              payload: {
                id: resData.order?.id || `PANIC-${Math.floor(1000 + Math.random() * 9000)}`,
                symbol: pos.symbol,
                side: 'SELL',
                qty: pos.qty,
                price: currentPrice,
                time: new Date().toTimeString().split(' ')[0],
              },
            });
          }
        } catch (err: any) {
          console.error(`Panic sell network error for ${pos.symbol}:`, err);
        }
      }

      if (successCount > 0) {
        await loadUserData();
        showToast(`전체 포지션 일괄 매도 요청 완료 (${successCount}개 포지션)`, 'success');
      } else {
        showToast('긴급 청산 실패: 데이터베이스 오류 또는 네트워크 장애가 발생했습니다.', 'error');
      }
    } else {
      dispatch({ type: 'PANIC_SELL_ALL' });
    }
  }, [state.positions, state.tickers, state.user, loadUserData, showToast]);

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

      dispatch({ type: 'HYDRATE', payload: hydratePayload });
    } catch (err) {
      console.error('Error hydrating localStorage state:', err);
      dispatch({ type: 'SET_HYDRATED' });
    }
  }, []);

  // --- SAVE STATE BACK TO LOCAL STORAGE ON MUTATIONS ---
  useEffect(() => {
    if (state.isHydrated) {
      try {
        localStorage.setItem('toss_trading_cash', state.cashBalance.toString());
        localStorage.setItem('toss_trading_positions', JSON.stringify(state.positions));
        localStorage.setItem('toss_trading_tickers', JSON.stringify(state.tickers));
        localStorage.setItem('toss_trading_strategies', JSON.stringify(state.strategies));
        localStorage.setItem('toss_trading_orders', JSON.stringify(state.ordersLog));
      } catch (err) {
        console.error('Error saving state changes to localStorage:', err);
      }
    }
  }, [state.cashBalance, state.positions, state.tickers, state.strategies, state.ordersLog, state.isHydrated]);

  // --- REAL-TIME TICKER DRIFT BROADCAST ---
  useEffect(() => {
    const interval = setInterval(() => {
      dispatch({ type: 'TICK' });
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  // --- AI STRATEGY ENGINE SIMULATOR ---
  useEffect(() => {
    const interval = setInterval(() => {
      if (!state.user) return;
      if (!state.strategies.ma.active && !state.strategies.rsi.active) return;

      const randomTicker = state.tickers[Math.floor(Math.random() * state.tickers.length)];
      const probability = Math.random();

      if (probability > 0.65) {
        const action: 'BUY' | 'SELL' = Math.random() > 0.5 ? 'BUY' : 'SELL';
        const qty = 10;
        const price = randomTicker.price;
        const totalCost = qty * price;

        // AI Safety Guardrails
        if (action === 'BUY') {
          if (state.cashBalance < totalCost) return;
          const existingPos = state.positions.find((p) => p.symbol === randomTicker.symbol);
          if (existingPos && existingPos.qty + qty > 500) return;
        } else {
          const existingPos = state.positions.find((p) => p.symbol === randomTicker.symbol);
          if (!existingPos || existingPos.qty < qty) return;
        }

        const confidence = Number((0.6 + Math.random() * 0.38).toFixed(2));
        
        let reason = '';
        if (state.strategies.ma.active && Math.random() > 0.5) {
          reason = `[MA Crossover] 5-period average crossed ${action === 'BUY' ? 'above' : 'below'} 20-period average on ${randomTicker.name}. Volume expansion is 1.4x.`;
        } else if (state.strategies.rsi.active) {
          reason = `[RSI Mean Reversion] RSI index crossed ${action === 'BUY' ? 'below 30 (Oversold)' : 'above 70 (Overbought)'} on ${randomTicker.name}. Counter-trend reversal expected.`;
        } else {
          reason = `[Combined Signal] Machine learning trend matching module predicts short-term ${action === 'BUY' ? 'bullish breakout' : 'bearish pullback'} on ${randomTicker.name}.`;
        }

        const newSignal: AISignalLog = {
          id: `SIG-${Math.floor(1000 + Math.random() * 9000)}`,
          symbol: randomTicker.symbol,
          action,
          confidence,
          reasoning: reason,
          time: new Date().toTimeString().split(' ')[0],
        };

        dispatch({ type: 'ADD_AI_SIGNAL', payload: newSignal });
        executeMockTrade(randomTicker.symbol, action, qty, price, true);
      }
    }, 9000);

    return () => clearInterval(interval);
  }, [state.user, state.strategies, state.tickers, state.positions, state.cashBalance, executeMockTrade]);

  return (
    <WorkstationContext.Provider
      value={{
        ...state,
        setSelectedSymbol,
        setStrategies,
        activeTicker,
        executeMockTrade,
        handlePanicSellAll,
        handleAddTicker,
        handleRemoveTicker,
        showToast,
        handleSignIn,
        handleSignOut,
        handleSessionExpire,
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
