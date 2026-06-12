'use client';

import React, { useState, useEffect } from 'react';
import { useWorkstation } from '@/lib/context/workstation-context';
import { useI18n } from '@/lib/i18n/i18n-context';

export default function OrderTicketPanel() {
  const { activeTicker, selectedSymbol, executeTrade, showToast, isApiConnected } = useWorkstation();
  const { t, formatCurrency } = useI18n();

  // Order Ticket Input
  const [orderSide, setOrderSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [orderQty, setOrderQty] = useState<number>(10);
  const [orderPrice, setOrderPrice] = useState<number>(70200);

  // Sync price with selected symbol ticks if in MARKET mode
  useEffect(() => {
    if (activeTicker) {
      const timer = setTimeout(() => {
        setOrderPrice(activeTicker.price);
      }, 0);
      return () => clearTimeout(timer);
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

  if (!isApiConnected) {
    return (
      <div className="flex flex-col bg-zinc-950 border border-zinc-900 rounded p-2.5 shrink-0 select-none">
        <h2 className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-1.5 border-b border-zinc-900/60 pb-1 flex justify-between items-center">
          <span>{t('orderTicket.title')}</span>
          <span className="text-[8px] px-1.5 py-0.5 rounded bg-rose-950/40 text-rose-400 border border-rose-900/35 leading-none font-bold uppercase font-sans animate-pulse">
            {t('header.disconnected')}
          </span>
        </h2>
        <div className="flex flex-col items-center justify-center py-12 text-center p-4">
          <svg className="w-8 h-8 text-rose-500/40 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          <span className="text-xs text-zinc-400 font-semibold font-sans">Trading Deactivated</span>
          <span className="text-[10px] text-zinc-550 max-w-xs mt-1 font-sans">{t('orderTicket.apiRequired')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-zinc-950 border border-zinc-900 rounded p-2.5 shrink-0 select-none">
      <h2 className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-1.5 border-b border-zinc-900/60 pb-1">{t('orderTicket.title')}</h2>
      
      <form onSubmit={handleManualOrderSubmit} className="space-y-2.5 text-[11px]">
        
        {/* Selected Ticker Info */}
        <div className="flex justify-between items-center px-2 py-1 bg-zinc-900/40 border border-zinc-900 rounded text-[10px]">
          <span className="text-zinc-500 font-sans">{t('orderTicket.symbol')}:</span>
          <span className="text-zinc-200 font-bold">{activeTicker?.name || selectedSymbol} <span className="font-mono text-zinc-500">({selectedSymbol})</span></span>
        </div>

        {/* Side Selector (BUY/SELL Tabs) */}
        <div className="grid grid-cols-2 gap-1 p-0.5 bg-zinc-900/60 rounded border border-zinc-900/80">
          <button
            type="button"
            onClick={() => setOrderSide('BUY')}
            className={`py-1 text-center font-bold text-[10px] uppercase rounded transition-colors cursor-pointer ${
              orderSide === 'BUY' 
                ? 'bg-[#00d287]/15 border border-[#00d287]/30 text-[#00d287]' 
                : 'border border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t('orderTicket.buy')}
          </button>
          <button
            type="button"
            onClick={() => setOrderSide('SELL')}
            className={`py-1 text-center font-bold text-[10px] uppercase rounded transition-colors cursor-pointer ${
              orderSide === 'SELL' 
                ? 'bg-[#f43f5e]/15 border border-[#f43f5e]/30 text-[#f43f5e]' 
                : 'border border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t('orderTicket.sell')}
          </button>
        </div>

        {/* Type Selector (MARKET/LIMIT) */}
        <div className="flex justify-between items-center py-0.5">
          <span className="text-zinc-500 font-sans">구분:</span>
          <div className="flex gap-3 font-mono text-[10px]">
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="orderType"
                checked={orderType === 'MARKET'}
                onChange={() => setOrderType('MARKET')}
                className="accent-[#00d287]"
              />
              <span className={orderType === 'MARKET' ? 'text-zinc-200 font-semibold' : 'text-zinc-500'}>{t('orderTicket.market')}</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="orderType"
                checked={orderType === 'LIMIT'}
                onChange={() => setOrderType('LIMIT')}
                className="accent-[#00d287]"
              />
              <span className={orderType === 'LIMIT' ? 'text-zinc-200 font-semibold' : 'text-zinc-500'}>{t('orderTicket.limit')}</span>
            </label>
          </div>
        </div>

        {/* Price input */}
        <div className="flex justify-between items-center">
          <span className="text-zinc-500 font-sans">{t('orderTicket.price')}:</span>
          <input
            type="number"
            disabled={orderType === 'MARKET'}
            value={orderType === 'MARKET' ? (activeTicker?.price || 0) : orderPrice}
            onChange={(e) => setOrderPrice(Number(e.target.value))}
            className={`w-32 bg-zinc-900 border rounded px-2 py-0.5 text-right font-mono text-zinc-200 focus:outline-none text-[11px] ${
              orderType === 'MARKET' ? 'border-zinc-900 text-zinc-500 opacity-50 bg-zinc-950/40' : 'border-zinc-900 focus:border-zinc-800'
            }`}
          />
        </div>

        {/* Quantity Input */}
        <div className="flex justify-between items-center">
          <span className="text-zinc-500 font-sans">{t('orderTicket.quantity')}:</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setOrderQty(Math.max(1, orderQty - 1))}
              className="w-5 h-5 rounded bg-zinc-900 border border-zinc-855 flex items-center justify-center hover:bg-zinc-800 font-bold cursor-pointer text-zinc-400"
            >
              -
            </button>
            <input
              type="number"
              value={orderQty}
              onChange={(e) => setOrderQty(Math.max(1, Number(e.target.value)))}
              className="w-16 bg-zinc-900 border border-zinc-900 rounded py-0.5 text-center font-mono text-zinc-200 focus:outline-none text-[11px]"
            />
            <button
              type="button"
              onClick={() => setOrderQty(orderQty + 1)}
              className="w-5 h-5 rounded bg-zinc-900 border border-zinc-855 flex items-center justify-center hover:bg-zinc-800 font-bold cursor-pointer text-zinc-400"
            >
              +
            </button>
          </div>
        </div>

        {/* Quantity shortcuts */}
        <div className="grid grid-cols-4 gap-1 text-[9px] text-center font-mono shrink-0">
          {[10, 50, 100, 500].map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setOrderQty(q)}
              className="py-0.5 rounded bg-zinc-900/60 border border-zinc-900 hover:border-zinc-800 hover:text-zinc-300 text-zinc-500 transition-colors cursor-pointer"
            >
              {q}주
            </button>
          ))}
        </div>

        {/* Order total estimation */}
        <div className="border-t border-zinc-900/60 pt-2 font-mono text-[10px] text-zinc-500 space-y-1">
          <div className="flex justify-between">
            <span className="font-sans text-[10px] text-zinc-500">{t('orderTicket.orderValue')}:</span>
            <span className="text-zinc-200 font-bold">
              {formatCurrency(orderQty * (orderType === 'MARKET' ? (activeTicker?.price || 0) : orderPrice))}
            </span>
          </div>
          <div className="flex justify-between text-[9px] text-zinc-650">
            <span className="font-sans text-zinc-600">수수료(Commission):</span>
            <span>0원 (Toss Web-Proxy)</span>
          </div>
        </div>

        {/* Place Order Button */}
        <button
          type="submit"
          className={`w-full py-1.5 font-bold rounded tracking-wide text-xs transition-colors cursor-pointer ${
            orderSide === 'BUY' 
              ? 'bg-[#00d287] hover:bg-[#00be7a] text-zinc-950' 
              : 'bg-[#f43f5e] hover:bg-[#e12d4c] text-white'
          }`}
        >
          {orderSide === 'BUY' ? t('orderTicket.buttonBuy') : t('orderTicket.buttonSell')}
        </button>
      </form>
    </div>
  );
}

