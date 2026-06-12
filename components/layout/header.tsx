'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useWorkstation } from '@/lib/context/workstation-context';
import { useI18n } from '@/lib/i18n/i18n-context';
import ConfirmationDialog from '@/components/ui/dialog';

export default function Header() {
  const { handlePanicSellAll, isApiConnected } = useWorkstation();
  const { locale, setLocale, t } = useI18n();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [sysTime, setSysTime] = useState(() => new Date().toTimeString().split(' ')[0]);

  // Clock ticks every second
  useEffect(() => {
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
            <div className={`w-2 h-2 rounded-full ${isApiConnected ? 'bg-[#00d287]' : 'bg-rose-500'} animate-pulse`} />
            <Link href="/" className="font-bold uppercase tracking-wider text-zinc-100 text-[11px] hover:text-zinc-200">
              {t('header.logoName')}
            </Link>
          </div>
          <div className="h-4 w-px bg-zinc-900" />
          <div className="flex items-center gap-2 font-mono text-zinc-500 text-[10px]">
            <span>{t('header.apiStatus')}:</span>
            <span className={`${isApiConnected ? 'text-[#00d287]' : 'text-rose-500'} font-semibold`}>
              {isApiConnected ? t('header.connected') : t('header.disconnected')}
            </span>
            {isApiConnected && <span className="text-[9px] text-zinc-700">2500ms</span>}
          </div>
          <div className="h-4 w-px bg-zinc-900" />
          <div className="flex items-center gap-2 font-mono">
            <span className="text-zinc-500 text-[10px]">{t('header.mode')}:</span>
            {isApiConnected ? (
              <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold uppercase tracking-wider leading-none">{t('common.live')}</span>
            ) : (
              <Link 
                href="/broker-settings"
                className="px-1.5 py-0.5 rounded text-[9px] bg-rose-500/10 border border-rose-500/20 text-rose-400 font-semibold uppercase tracking-wider leading-none hover:bg-rose-500/25 transition-all cursor-pointer"
              >
                {t('common.simulation')}
              </Link>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono text-[10px]">
            <span className="text-zinc-600">SYS TIME:</span>
            <span className="text-zinc-400 font-medium">{sysTime}</span>
          </div>
          <button
            onClick={() => setLocale(locale === 'ko' ? 'en' : 'ko')}
            className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-[10px] font-bold transition-all cursor-pointer"
          >
            {locale === 'ko' ? 'EN' : 'KO'}
          </button>
          <Link
            href="/backtest"
            className="flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 transition-colors cursor-pointer"
          >
            {t('common.backtest')}
          </Link>
          <Link
            href="/broker-settings"
            className="flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 transition-colors cursor-pointer"
          >
            {t('common.brokerSettings')}
          </Link>
          {isApiConnected && (
            <button
              onClick={() => setIsDialogOpen(true)}
              className="flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded bg-rose-950/40 hover:bg-rose-950/80 border border-rose-900/40 hover:border-rose-900 text-rose-400 transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              {t('positions.sellAll')}
            </button>
          )}
        </div>
      </header>

      {/* Warning Dialog */}
      <ConfirmationDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onConfirm={handlePanicSellAll}
        title={t('positions.panicSellAll')}
        description={t('positions.confirmPanic')}
      />
    </>
  );
}

