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
      <header className="flex items-center justify-between px-3 py-1.5 bg-zinc-950 border-b border-zinc-900 text-xs shrink-0 select-none">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#00d287] animate-pulse" />
            <h1 className="font-bold uppercase tracking-wider text-zinc-100 text-[11px]">Toss Auto Workstation v2</h1>
          </div>
          <div className="h-4 w-px bg-zinc-900" />
          <div className="flex items-center gap-2 font-mono text-zinc-500 text-[10px]">
            <span>FEED:</span>
            <span className="text-[#00d287] font-semibold">ACTIVE</span>
            <span className="text-[9px] text-zinc-700">2500ms</span>
          </div>
          <div className="h-4 w-px bg-zinc-900" />
          <div className="flex items-center gap-2 font-mono">
            <span className="text-zinc-500 text-[10px]">MODE:</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-500/10 border border-amber-500/20 text-amber-400 font-semibold uppercase tracking-wider leading-none">Simulation</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono text-[10px]">
            <span className="text-zinc-600">SYS TIME:</span>
            <span className="text-zinc-400 font-medium">{sysTime}</span>
          </div>
          <button
            onClick={() => setIsDialogOpen(true)}
            className="flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded bg-rose-950/40 hover:bg-rose-950/80 border border-rose-900/40 hover:border-rose-900 text-rose-400 transition-colors cursor-pointer"
          >
            <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
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
