'use client';

import React, { useState, useEffect } from 'react';
import { useWorkstation } from '@/lib/context/workstation-context';
import { useI18n } from '@/lib/i18n/i18n-context';
import { AlertTriangle, GripHorizontal } from 'lucide-react';

const getTickSize = (price: number, symbol: string): number => {
  if (symbol.match(/[A-Z]/)) {
    return 0.01;
  }
  if (price < 2000) return 1;
  if (price < 5000) return 5;
  if (price < 20000) return 10;
  if (price < 50000) return 50;
  if (price < 200000) return 100;
  if (price < 500000) return 500;
  return 1000;
};

export default function OrderTicketPanel() {
  const { activeTicker, selectedSymbol, executeTrade, showToast, isApiConnected } = useWorkstation();
  const { t, formatCurrency } = useI18n();

  // Order Ticket Input
  const [orderSide, setOrderSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [orderQty, setOrderQty] = useState<number>(10);
  const [orderPrice, setOrderPrice] = useState<number>(74200);

  // Sync price with selected symbol ticks if in MARKET mode
  useEffect(() => {
    if (activeTicker) {
      setOrderPrice(activeTicker.price);
    }
  }, [selectedSymbol, activeTicker]);

  const handleManualOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isApiConnected) {
      showToast(t('orderTicket.apiRequired'), 'error');
      return;
    }
    if (orderQty <= 0) {
      showToast(t('orderTicket.validationQty'), 'error');
      return;
    }
    executeTrade(selectedSymbol, orderSide, orderQty, orderPrice);
  };

  const tickSize = activeTicker ? getTickSize(activeTicker.price, activeTicker.symbol) : 100;
  const currentPrice = activeTicker?.price || 74200;

  // Qty generator based on symbol + price + offset
  const getQty = (price: number, offset: number) => {
    const charSum = selectedSymbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const seed = (charSum + Math.round(price) + offset * 117) % 850;
    return Math.max(15, seed);
  };

  const asks = [
    { price: currentPrice + tickSize, qty: getQty(currentPrice, 1) },
    { price: currentPrice + tickSize * 2, qty: getQty(currentPrice, 2) },
    { price: currentPrice + tickSize * 3, qty: getQty(currentPrice, 3) },
  ].reverse();

  const bids = [
    { price: currentPrice - tickSize, qty: getQty(currentPrice, -1) },
    { price: currentPrice - tickSize * 2, qty: getQty(currentPrice, -2) },
    { price: currentPrice - tickSize * 3, qty: getQty(currentPrice, -3) },
  ];

  const maxQty = Math.max(...asks.map(a => a.qty), ...bids.map(b => b.qty)) || 1;

  const handlePriceClick = (price: number) => {
    setOrderType('LIMIT');
    setOrderPrice(price);
  };

  if (!isApiConnected) {
    return (
      <div className="flex flex-col bg-[#151B23] glow-order rounded-[16px] p-4 h-full select-none justify-between">
        <h2 className="text-[10px] uppercase font-bold tracking-wider text-zinc-550 mb-2 pb-2 flex justify-between items-center drag-handle cursor-grab select-none">
          <span className="flex items-center gap-1.5"><GripHorizontal size={12} className="text-zinc-655" />{t('orderTicket.title')}</span>
          <span className="text-[8px] px-2 py-1 rounded-xl bg-danger/10 text-danger leading-none font-bold uppercase font-sans animate-pulse">
            {t('header.disconnected')}
          </span>
        </h2>
        <div className="flex-1 flex flex-col items-center justify-center py-12 text-center p-4">
          <AlertTriangle className="w-8 h-8 text-danger/40 mb-2" />
          <span className="text-xs text-zinc-400 font-semibold font-sans">{t('orderTicket.tradingDeactivated')}</span>
          <span className="text-[10px] text-zinc-550 max-w-xs mt-2 font-sans">{t('orderTicket.apiRequired')}</span>
        </div>
      </div>
    );
  }

  const isUS = selectedSymbol.match(/[A-Z]/);

  return (
    <div className="flex flex-col bg-[#151B23] glow-order rounded-[16px] p-4 h-full select-none font-sans text-xs">
      {/* Header with drag handle */}
      <h2 className="text-[10px] uppercase font-bold tracking-wider text-zinc-550 mb-2 pb-1 flex justify-between items-center drag-handle cursor-grab select-none shrink-0">
        <span className="flex items-center gap-1.5">
          <GripHorizontal size={12} className="text-zinc-655" />
          {t('orderTicket.title')}
        </span>
        <span className="text-[9.5px] text-zinc-400 font-bold font-mono leading-none truncate max-w-[120px]">
          {activeTicker?.name || selectedSymbol}
        </span>
      </h2>

      {/* MTS-style Order Book */}
      <div className="flex flex-col rounded-xl overflow-hidden mb-3 font-mono text-[11px] shrink-0 bg-[#111827]">
        {/* Asks */}
        {asks.map((ask, idx) => (
          <div
            key={`ask-${idx}`}
            onClick={() => handlePriceClick(ask.price)}
            className="relative flex justify-between items-center px-3 py-1 hover:bg-rose-500/[0.04] cursor-pointer transition-colors"
          >
            <div className="absolute right-0 top-0 bottom-0 bg-rose-500/[0.04] transition-all duration-300" style={{ width: `${(ask.qty / maxQty) * 100}%` }} />
            <span className="text-rose-450 font-bold z-10">{isUS ? `$${ask.price.toFixed(2)}` : ask.price.toLocaleString()}</span>
            <span className="text-zinc-500 z-10 text-[10px]">{ask.qty}</span>
          </div>
        ))}

        {/* Spread row */}
        <div className="flex justify-between items-center px-3 py-1 bg-[#0B0F14] text-[10px] text-zinc-550 font-semibold">
          <span>SPREAD</span>
          <span>{isUS ? `$${(asks[asks.length - 1].price - bids[0].price).toFixed(2)}` : `${(asks[asks.length - 1].price - bids[0].price).toLocaleString()}원`}</span>
        </div>

        {/* Bids */}
        {bids.map((bid, idx) => (
          <div
            key={`bid-${idx}`}
            onClick={() => handlePriceClick(bid.price)}
            className="relative flex justify-between items-center px-3 py-1 hover:bg-blue-500/[0.04] cursor-pointer transition-colors"
          >
            <div className="absolute right-0 top-0 bottom-0 bg-blue-500/[0.04] transition-all duration-300" style={{ width: `${(bid.qty / maxQty) * 100}%` }} />
            <span className="text-blue-400 font-bold z-10">{isUS ? `$${bid.price.toFixed(2)}` : bid.price.toLocaleString()}</span>
            <span className="text-zinc-500 z-10 text-[10px]">{bid.qty}</span>
          </div>
        ))}
      </div>

      {/* Forms */}
      <form onSubmit={handleManualOrderSubmit} className="flex-1 flex flex-col justify-between text-[11px] gap-2 min-h-0">
        <div className="space-y-2">
          {/* Side Selector (BUY/SELL Tabs) */}
          <div className="grid grid-cols-2 gap-1 p-0.5 bg-[#111827] rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => setOrderSide('BUY')}
              className={`py-1 text-center font-bold text-[10.5px] uppercase rounded-lg transition-all cursor-pointer ${
                orderSide === 'BUY' 
                  ? 'bg-rose-500 text-zinc-950 font-extrabold shadow-sm' 
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t('orderTicket.buy')}
            </button>
            <button
              type="button"
              onClick={() => setOrderSide('SELL')}
              className={`py-1 text-center font-bold text-[10.5px] uppercase rounded-lg transition-all cursor-pointer ${
                orderSide === 'SELL' 
                  ? 'bg-blue-600 text-white font-extrabold shadow-sm' 
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t('orderTicket.sell')}
            </button>
          </div>

          {/* Type Selector (MARKET/LIMIT) */}
          <div className="flex justify-between items-center py-0.5">
            <span className="text-zinc-500 font-sans">{t('orderTicket.typeLabel')}:</span>
            <div className="flex gap-3 font-sans text-[10.5px] font-bold">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="radio"
                  name="orderType"
                  checked={orderType === 'MARKET'}
                  onChange={() => setOrderType('MARKET')}
                  className="accent-primary w-3 h-3"
                />
                <span className={orderType === 'MARKET' ? 'text-zinc-200 font-bold' : 'text-zinc-550'}>{t('orderTicket.market')}</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="radio"
                  name="orderType"
                  checked={orderType === 'LIMIT'}
                  onChange={() => setOrderType('LIMIT')}
                  className="accent-primary w-3 h-3"
                />
                <span className={orderType === 'LIMIT' ? 'text-zinc-200 font-bold' : 'text-zinc-550'}>{t('orderTicket.limit')}</span>
              </label>
            </div>
          </div>

          {/* Price input */}
          <div className="flex justify-between items-center">
            <span className="text-zinc-500 font-sans">{t('orderTicket.price')}:</span>
            <div className="relative">
              <input
                type="number"
                disabled={orderType === 'MARKET'}
                value={orderType === 'MARKET' ? (activeTicker?.price || 0) : orderPrice}
                onChange={(e) => setOrderPrice(Number(e.target.value))}
                className={`w-32 bg-[#111827] rounded-xl px-3 py-1 text-right font-mono text-zinc-200 focus:outline-none focus:ring-1 focus:ring-white/10 text-xs h-7.5 ${
                  orderType === 'MARKET' ? 'text-zinc-550 opacity-40 bg-zinc-950/10' : 'focus:bg-zinc-950/60'
                }`}
              />
              <span className="absolute left-2.5 top-1.5 text-[9px] text-zinc-600 font-bold">{isUS ? 'USD' : 'KRW'}</span>
            </div>
          </div>

          {/* Quantity Input */}
          <div className="flex justify-between items-center">
            <span className="text-zinc-500 font-sans">{t('orderTicket.quantity')}:</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setOrderQty(Math.max(1, orderQty - 1))}
                className="w-7 h-7.5 rounded-xl bg-[#111827] flex items-center justify-center hover:bg-[#1C2430] font-bold cursor-pointer text-zinc-400 text-xs"
              >
                -
              </button>
              <input
                type="number"
                value={orderQty}
                onChange={(e) => setOrderQty(Math.max(1, Number(e.target.value)))}
                className="w-14 bg-[#111827] rounded-xl text-center font-mono text-zinc-200 focus:outline-none text-[11px] h-7.5"
              />
              <button
                type="button"
                onClick={() => setOrderQty(orderQty + 1)}
                className="w-7 h-7.5 rounded-xl bg-[#111827] flex items-center justify-center hover:bg-[#1C2430] font-bold cursor-pointer text-zinc-400 text-xs"
              >
                +
              </button>
            </div>
          </div>

          {/* Quantity shortcuts */}
          <div className="grid grid-cols-4 gap-1 text-[9.5px] text-center font-mono shrink-0">
            {[10, 50, 100, 500].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setOrderQty(q)}
                className="py-1 rounded-lg bg-[#111827] hover:bg-[#1C2430] hover:text-zinc-300 text-zinc-555 transition-colors cursor-pointer font-bold"
              >
                {q}주
              </button>
            ))}
          </div>
        </div>

        {/* Order total estimation */}
        <div className="space-y-1.5 pt-2 shrink-0">
          <div className="flex justify-between font-mono text-[10px] text-zinc-500">
            <span className="font-sans text-[10px] text-zinc-500">{t('orderTicket.orderValue')}:</span>
            <span className={`font-black text-xs ${orderSide === 'BUY' ? 'text-rose-500' : 'text-blue-500'}`}>
              {formatCurrency(orderQty * (orderType === 'MARKET' ? (activeTicker?.price || 0) : orderPrice))}
            </span>
          </div>

          {/* Place Order Button */}
          <button
            type="submit"
            className={`w-full h-9 font-extrabold rounded-xl tracking-wide text-xs transition-all cursor-pointer flex items-center justify-center shadow-lg active:scale-[0.99] ${
              orderSide === 'BUY' 
                ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-950/20' 
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-950/20'
            }`}
          >
            {orderSide === 'BUY' ? t('orderTicket.buttonBuy') : t('orderTicket.buttonSell')}
          </button>
        </div>
      </form>
    </div>
  );
}

