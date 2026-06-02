'use client';

import React, { useState, useEffect } from 'react';
import { useWorkstation } from '@/lib/context/workstation-context';

export default function OrderTicketPanel() {
  const { activeTicker, selectedSymbol, executeMockTrade, showToast } = useWorkstation();

  // Order Ticket Input
  const [orderSide, setOrderSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [orderQty, setOrderQty] = useState<number>(10);
  const [orderPrice, setOrderPrice] = useState<number>(70200);

  // Sync price with selected symbol ticks if in MARKET mode
  useEffect(() => {
    setOrderPrice(activeTicker.price);
  }, [selectedSymbol, activeTicker.price]);

  const handleManualOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (orderQty <= 0) {
      showToast('주문 수량은 1주 이상이어야 합니다.', 'error');
      return;
    }
    executeMockTrade(selectedSymbol, orderSide, orderQty, orderPrice);
  };

  return (
    <div className="flex flex-col bg-zinc-950 border border-zinc-800 rounded p-3 shrink-0 select-none">
      <h2 className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-2 border-b border-zinc-900 pb-1">Order Ticket</h2>
      
      <form onSubmit={handleManualOrderSubmit} className="space-y-3 text-xs">
        
        {/* Selected Symbol Quick View */}
        <div className="flex justify-between items-center p-1.5 bg-zinc-900 border border-zinc-800 rounded text-[11px]">
          <span className="text-zinc-500 font-sans">Selected Ticker:</span>
          <span className="text-white font-bold">{activeTicker.name} ({activeTicker.symbol})</span>
        </div>

        {/* Side Selector (BUY/SELL) */}
        <div className="grid grid-cols-2 gap-1.5 p-0.5 bg-zinc-900 rounded border border-zinc-800">
          <button
            type="button"
            onClick={() => setOrderSide('BUY')}
            className={`py-1 text-center font-bold rounded transition-colors cursor-pointer ${
              orderSide === 'BUY' ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            매수 (BUY)
          </button>
          <button
            type="button"
            onClick={() => setOrderSide('SELL')}
            className={`py-1 text-center font-bold rounded transition-colors cursor-pointer ${
              orderSide === 'SELL' ? 'bg-rose-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            매도 (SELL)
          </button>
        </div>

        {/* Type Selector (MARKET/LIMIT) */}
        <div className="flex justify-between items-center">
          <span className="text-zinc-500 font-sans">Order Type:</span>
          <div className="flex gap-2 font-mono">
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="orderType"
                checked={orderType === 'MARKET'}
                onChange={() => setOrderType('MARKET')}
                className="accent-emerald-500"
              />
              <span>Market</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="orderType"
                checked={orderType === 'LIMIT'}
                onChange={() => setOrderType('LIMIT')}
                className="accent-emerald-500"
              />
              <span>Limit</span>
            </label>
          </div>
        </div>

        {/* Price input (only enabled for LIMIT orders) */}
        <div className="flex justify-between items-center">
          <span className="text-zinc-500 font-sans">Price (KRW):</span>
          <input
            type="number"
            disabled={orderType === 'MARKET'}
            value={orderType === 'MARKET' ? activeTicker.price : orderPrice}
            onChange={(e) => setOrderPrice(Number(e.target.value))}
            className={`w-32 bg-zinc-900 border rounded px-1.5 py-0.5 text-right font-mono text-white focus:outline-none ${
              orderType === 'MARKET' ? 'border-zinc-800 text-zinc-500 opacity-60' : 'border-zinc-800 focus:border-zinc-700'
            }`}
          />
        </div>

        {/* Quantity Input */}
        <div className="flex justify-between items-center">
          <span className="text-zinc-500 font-sans">Quantity (Shares):</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setOrderQty(Math.max(1, orderQty - 1))}
              className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center hover:bg-zinc-700 font-bold"
            >
              -
            </button>
            <input
              type="number"
              value={orderQty}
              onChange={(e) => setOrderQty(Math.max(1, Number(e.target.value)))}
              className="w-16 bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5 text-center font-mono text-white focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setOrderQty(orderQty + 1)}
              className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center hover:bg-zinc-700 font-bold"
            >
              +
            </button>
          </div>
        </div>

        {/* Quantity quick shortcuts */}
        <div className="grid grid-cols-4 gap-1 text-[10px] text-center font-mono shrink-0">
          {[10, 50, 100, 500].map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setOrderQty(q)}
              className="py-1 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 cursor-pointer"
            >
              {q}주
            </button>
          ))}
        </div>

        {/* Order total estimation */}
        <div className="border-t border-zinc-900 pt-2 font-mono text-[11px] text-zinc-400 space-y-1">
          <div className="flex justify-between">
            <span className="font-sans text-[10px] text-zinc-500">Estimated Total:</span>
            <span className="text-white font-semibold">
              {(orderQty * (orderType === 'MARKET' ? activeTicker.price : orderPrice)).toLocaleString()} KRW
            </span>
          </div>
          <div className="flex justify-between text-[10px] text-zinc-500">
            <span className="font-sans text-[9px] text-zinc-600">Broker Commission:</span>
            <span>0 KRW (Simulation Free)</span>
          </div>
        </div>

        {/* Place Order Button */}
        <button
          type="submit"
          className={`w-full py-2 font-bold rounded tracking-wide text-white transition-colors cursor-pointer ${
            orderSide === 'BUY' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
          }`}
        >
          {orderSide === 'BUY' ? '매수 주문 전송' : '매도 주문 전송'}
        </button>
      </form>
    </div>
  );
}
