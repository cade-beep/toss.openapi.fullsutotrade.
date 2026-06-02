'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Position } from '@/types/trading';

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

interface WorkstationContextType {
  selectedSymbol: string;
  setSelectedSymbol: (symbol: string) => void;
  tickers: WorkstationTicker[];
  cashBalance: number;
  positions: Position[];
  ordersLog: OrderLog[];
  aiSignals: AISignalLog[];
  strategies: {
    ma: { active: boolean; fast: number; slow: number };
    rsi: { active: boolean; overbought: number; oversold: number };
  };
  setStrategies: React.Dispatch<React.SetStateAction<{
    ma: { active: boolean; fast: number; slow: number };
    rsi: { active: boolean; overbought: number; oversold: number };
  }>>;
  activeTicker: WorkstationTicker;
  executeMockTrade: (symbol: string, side: 'BUY' | 'SELL', qty: number, price: number, isAISignal?: boolean) => void;
  handlePanicSellAll: () => void;
  handleAddTicker: (symbol: string, name: string) => void;
  handleRemoveTicker: (symbol: string) => void;
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  isHydrated: boolean;
}

const WorkstationContext = createContext<WorkstationContextType | undefined>(undefined);

export function WorkstationProvider({ children }: { children: React.ReactNode }) {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('005930');
  
  // Market Tickers
  const [tickers, setTickers] = useState<WorkstationTicker[]>([
    { symbol: '005930', name: '삼성전자', price: 70200, change: 1.25, high: 71000, low: 69500, history: [69500, 69800, 70100, 69900, 70200, 70500, 70200] },
    { symbol: '000660', name: 'SK하이닉스', price: 151200, change: -0.45, high: 153000, low: 149500, history: [152000, 153000, 151000, 150500, 152000, 151200, 151200] },
    { symbol: '035420', name: 'NAVER', price: 181500, change: 2.10, high: 183000, low: 178000, history: [178000, 179000, 180500, 180000, 182000, 181000, 181500] },
    { symbol: '005380', name: '현대차', price: 235500, change: 0.00, high: 237000, low: 234000, history: [236000, 235000, 234500, 235000, 236000, 235500, 235500] },
    { symbol: '068270', name: '셀트리온', price: 178400, change: -1.85, high: 182000, low: 177000, history: [181000, 182000, 180000, 179000, 178500, 178000, 178400] },
  ]);

  // Account balances
  const [cashBalance, setCashBalance] = useState<number>(10000000); // 10,000,000 KRW
  const [positions, setPositions] = useState<Position[]>([
    { id: 'mock-pos-1', symbol: '005930', qty: 50, avgBuyPrice: 68900, currentPrice: 70200 },
    { id: 'mock-pos-2', symbol: '035420', qty: 15, avgBuyPrice: 179500, currentPrice: 181500 },
  ]);

  // Orders and AI Logs
  const [ordersLog, setOrdersLog] = useState<OrderLog[]>([
    { id: 'ORD-9832', symbol: '005930', side: 'BUY', type: 'MARKET', qty: 50, price: 68900, status: 'FILLED', time: '10:15:30' },
    { id: 'ORD-9811', symbol: '035420', side: 'BUY', type: 'LIMIT', qty: 15, price: 179500, status: 'FILLED', time: '09:42:15' },
  ]);

  const [aiSignals, setAISignals] = useState<AISignalLog[]>([
    { id: 'SIG-2101', symbol: '005930', action: 'BUY', confidence: 0.88, reasoning: '5-MA crossed above 20-MA. RSI index shows oversold momentum recovery at 35.4.', time: '10:15:02' },
  ]);

  // AI Strategies Active State
  const [strategies, setStrategies] = useState({
    ma: { active: false, fast: 5, slow: 20 },
    rsi: { active: false, overbought: 70, oversold: 30 },
  });

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  const activeTicker = tickers.find((t) => t.symbol === selectedSymbol) || tickers[0];

  // Toast show helper
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
  }, []);

  // Toast auto-clear
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // --- LOCAL STORAGE PERSISTENCE ---
  useEffect(() => {
    const savedCash = localStorage.getItem('toss_trading_cash');
    const savedPositions = localStorage.getItem('toss_trading_positions');
    const savedTickers = localStorage.getItem('toss_trading_tickers');
    const savedStrategies = localStorage.getItem('toss_trading_strategies');

    if (savedCash) setCashBalance(Number(savedCash));
    if (savedPositions) setPositions(JSON.parse(savedPositions));
    if (savedTickers) setTickers(JSON.parse(savedTickers));
    if (savedStrategies) setStrategies(JSON.parse(savedStrategies));
    
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem('toss_trading_cash', cashBalance.toString());
    }
  }, [cashBalance, isHydrated]);

  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem('toss_trading_positions', JSON.stringify(positions));
    }
  }, [positions, isHydrated]);

  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem('toss_trading_tickers', JSON.stringify(tickers));
    }
  }, [tickers, isHydrated]);

  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem('toss_trading_strategies', JSON.stringify(strategies));
    }
  }, [strategies, isHydrated]);

  // --- MOCK REAL-TIME DATA TICKER ---
  useEffect(() => {
    const interval = setInterval(() => {
      setTickers((prevTickers) =>
        prevTickers.map((ticker) => {
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
        })
      );
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  // --- EXECUTE TRADE METHOD ---
  const executeMockTrade = useCallback((
    symbol: string,
    side: 'BUY' | 'SELL',
    qty: number,
    price: number,
    isAISignal: boolean = false
  ) => {
    setTickers((currTickers) => {
      const ticker = currTickers.find((t) => t.symbol === symbol);
      if (!ticker) return currTickers;

      const totalCost = qty * price;

      if (side === 'BUY') {
        setCashBalance((prevCash) => {
          if (prevCash < totalCost) {
            if (!isAISignal) showToast('주문 실패: 예수금이 부족합니다.', 'error');
            return prevCash;
          }

          setPositions((prevPos) => {
            const existing = prevPos.find((p) => p.symbol === symbol);
            if (existing) {
              const totalQty = existing.qty + qty;
              const avgPrice = Math.round((existing.qty * existing.avgBuyPrice + totalCost) / totalQty);
              return prevPos.map((p) => (p.symbol === symbol ? { ...p, qty: totalQty, avgBuyPrice: avgPrice } : p));
            } else {
              return [...prevPos, { id: `pos-${Math.random().toString(36).substring(2, 9)}`, symbol, qty, avgBuyPrice: price, currentPrice: price }];
            }
          });

          showToast(`${ticker.name} ${qty}주 매수 주문 체결 완료 (${isAISignal ? 'AI 자동' : '수동'})`, 'success');
          return prevCash - totalCost;
        });
      } else {
        // SELL
        setPositions((prevPos) => {
          const existing = prevPos.find((p) => p.symbol === symbol);
          if (!existing || existing.qty < qty) {
            if (!isAISignal) showToast('주문 실패: 매도할 보유 수량이 부족합니다.', 'error');
            return prevPos;
          }

          setCashBalance((prevCash) => prevCash + totalCost);
          showToast(`${ticker.name} ${qty}주 매도 주문 체결 완료 (${isAISignal ? 'AI 자동' : '수동'})`, 'success');

          return prevPos
            .map((p) => (p.symbol === symbol ? { ...p, qty: p.qty - qty } : p))
            .filter((p) => p.qty > 0);
        });
      }

      // Add to order log
      setOrdersLog((prevOrders) => [
        {
          id: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
          symbol,
          side,
          type: 'MARKET',
          qty,
          price,
          status: 'FILLED',
          time: new Date().toTimeString().split(' ')[0],
        },
        ...prevOrders
      ]);

      return currTickers;
    });
  }, [showToast]);

  // --- PANIC SELL ALL ---
  const handlePanicSellAll = useCallback(() => {
    setPositions((prevPos) => {
      if (prevPos.length === 0) {
        showToast('매도할 보유 포지션이 없습니다.', 'info');
        return prevPos;
      }

      setTickers((currTickers) => {
        let proceeds = 0;
        const closedOrders: OrderLog[] = [];

        prevPos.forEach((pos) => {
          const ticker = currTickers.find((t) => t.symbol === pos.symbol);
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

        setCashBalance((prevCash) => prevCash + proceeds);
        setOrdersLog((prevOrders) => [...closedOrders, ...prevOrders]);
        showToast('긴급 조치: 모든 보유 포지션 전량 청산 완료', 'success');

        return currTickers;
      });

      return [];
    });
  }, [showToast]);

  // --- ADD TICKER ---
  const handleAddTicker = useCallback((symbol: string, name: string) => {
    setTickers((prev) => {
      if (prev.some((t) => t.symbol === symbol)) {
        showToast('이미 등록된 종목입니다.', 'error');
        return prev;
      }

      const price = Math.round(50000 + Math.random() * 200000);
      const newTicker: WorkstationTicker = {
        symbol,
        name,
        price,
        change: 0.0,
        high: price,
        low: price,
        history: Array(7).fill(price),
      };

      showToast(`관심종목 ${name} 추가됨`, 'success');
      return [...prev, newTicker];
    });
  }, [showToast]);

  // --- REMOVE TICKER ---
  const handleRemoveTicker = useCallback((symbol: string) => {
    setTickers((prev) => {
      if (prev.length <= 1) {
        showToast('최소 한 개의 관심종목이 유지되어야 합니다.', 'error');
        return prev;
      }

      showToast('관심종목 삭제 완료', 'info');
      
      const filtered = prev.filter((t) => t.symbol !== symbol);
      setSelectedSymbol((curr) => {
        if (curr === symbol) {
          return filtered[0].symbol;
        }
        return curr;
      });

      return filtered;
    });
  }, [showToast]);

  // --- AI STRATEGY SIMULATOR ---
  useEffect(() => {
    const interval = setInterval(() => {
      if (!strategies.ma.active && !strategies.rsi.active) return;

      setTickers((currTickers) => {
        const randomTicker = currTickers[Math.floor(Math.random() * currTickers.length)];
        const probability = Math.random();

        if (probability > 0.65) {
          const action: 'BUY' | 'SELL' | 'HOLD' = Math.random() > 0.5 ? 'BUY' : 'SELL';
          const confidence = Number((0.6 + Math.random() * 0.38).toFixed(2));
          
          let reason = '';
          if (strategies.ma.active && Math.random() > 0.5) {
            reason = `[MA Crossover] 5-period average crossed ${action === 'BUY' ? 'above' : 'below'} 20-period average on ${randomTicker.name}. Volume expansion is 1.4x.`;
          } else if (strategies.rsi.active) {
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

          setAISignals((prev) => [newSignal, ...prev.slice(0, 49)]);
          executeMockTrade(randomTicker.symbol, action, 10, randomTicker.price, true);
        }

        return currTickers;
      });
    }, 9000);

    return () => clearInterval(interval);
  }, [strategies, executeMockTrade]);

  return (
    <WorkstationContext.Provider
      value={{
        selectedSymbol,
        setSelectedSymbol,
        tickers,
        cashBalance,
        positions,
        ordersLog,
        aiSignals,
        strategies,
        setStrategies,
        activeTicker,
        executeMockTrade,
        handlePanicSellAll,
        handleAddTicker,
        handleRemoveTicker,
        toast,
        showToast,
        isHydrated,
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
