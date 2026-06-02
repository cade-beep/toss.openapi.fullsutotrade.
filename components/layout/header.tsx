'use client';

import React, { useState, useEffect } from 'react';
import { useWorkstation } from '@/lib/context/workstation-context';
import ConfirmationDialog from '@/components/ui/dialog';

export default function Header() {
  const { handlePanicSellAll } = useWorkstation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [sysTime, setSysTime] = useState('');

  // Clock ticks every second
  useEffect(() => {
    setSysTime(new Date().toTimeString().split(' ')[0]);
    const timer = setInterval(() => {
      setSysTime(new Date().toTimeString().split(' ')[0]);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <header className="flex items-center justify-between px-3 py-2 bg-zinc-950 border-b border-zinc-800 text-xs shrink-0 select-none">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="font-bold uppercase tracking-wider text-white">Toss Automatic Trading Workstation v2</h1>
          </div>
          <div className="h-4 w-px bg-zinc-800" />
          <div className="flex items-center gap-2 font-mono text-zinc-400">
            <span>MOCK FEED:</span>
            <span className="text-emerald-400 font-semibold">ACTIVE</span>
            <span className="text-[10px] text-zinc-600">2500ms TICK</span>
          </div>
          <div className="h-4 w-px bg-zinc-800" />
          <div className="flex items-center gap-2 font-mono text-zinc-400">
            <span>MODE:</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-950/50 border border-amber-900 text-amber-400 font-bold">SIMULATION</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 font-mono">
            <span className="text-zinc-500">SYS TIME:</span>
            <span className="text-zinc-300 font-medium">{sysTime}</span>
          </div>
          <button
            onClick={() => setIsDialogOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1 font-semibold rounded bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            PANIC SELL ALL
          </button>
        </div>
      </header>

      {/* Warning Dialog */}
      <ConfirmationDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onConfirm={handlePanicSellAll}
        title="긴급 포지션 전량 청산"
        description="정말로 보유하고 있는 모든 주식 포지션을 즉시 시장가로 청산하시겠습니까? 이 작업은 되돌릴 수 없습니다."
      />
    </>
  );
}
