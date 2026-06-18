'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useWorkstation } from '@/lib/context/workstation-context';
import { useI18n } from '@/lib/i18n/i18n-context';
import ConfirmationDialog from '@/components/ui/dialog';
import { Moon, Sun, AlertTriangle } from 'lucide-react';

export default function Header() {
  const { handlePanicSellAll, isApiConnected, kospi, kosdaq, theme, toggleTheme, user, handleSignOut, setSelectedSymbol, strategies } = useWorkstation();
  const { locale, setLocale, t } = useI18n();
  const router = useRouter();
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
      <header className="flex items-center justify-between px-4 py-2 bg-[#111827] shadow-[inset_0_-1px_0_rgba(255,255,255,0.04)] text-xs shrink-0 select-none">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isApiConnected ? 'bg-success' : 'bg-danger'} animate-pulse`} />
            <Link href="/" className="font-bold uppercase tracking-wider text-zinc-100 text-[11px] hover:text-zinc-200">
              {t('header.logoName')}
            </Link>
            <span className={`ml-1 px-1.5 py-0.5 rounded text-[8.5px] font-black font-mono tracking-wider transition-all leading-none select-none ${
              (strategies?.ma?.active || strategies?.rsi?.active) && isApiConnected
                ? 'bg-emerald-500/10 text-emerald-400 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.15)]'
                : 'bg-zinc-900 text-zinc-550'
            }`}>
              AI AUTO: {(strategies?.ma?.active || strategies?.rsi?.active) && isApiConnected ? 'ON' : 'OFF'}
            </span>
          </div>
          <div className="h-4 w-px bg-zinc-800/35" />
          <div className="flex items-center gap-2 font-mono text-zinc-550 text-[10px]">
            <span>{t('header.apiStatus')}:</span>
            <span className={`${isApiConnected ? 'text-success' : 'text-danger'} font-semibold`}>
              {isApiConnected ? t('header.connected') : t('header.disconnected')}
            </span>
            {isApiConnected && <span className="text-[9px] text-zinc-700">2500ms</span>}
          </div>
          <div className="h-4 w-px bg-zinc-800/35" />
          <div className="flex items-center gap-2 font-mono">
            <span className="text-zinc-550 text-[10px]">{t('header.mode')}:</span>
            {isApiConnected ? (
              <span className="px-1.5 py-0.5 rounded-xl bg-success/10 text-success font-semibold uppercase tracking-wider leading-none">{t('common.live')}</span>
            ) : (
              <Link 
                href="/broker-settings"
                className="px-1.5 py-0.5 rounded-xl bg-danger/10 text-danger font-semibold uppercase tracking-wider leading-none hover:bg-danger/20 transition-all cursor-pointer"
              >
                {t('common.simulation')}
              </Link>
            )}
          </div>
          <div className="h-4 w-px bg-zinc-900" />
          <div className="flex items-center gap-3 font-mono text-[10px]">
            {/* KOSPI */}
            <div 
              onClick={() => {
                setSelectedSymbol('KOSPI');
                router.push('/stocks/KOSPI/order');
              }}
              className="flex items-center gap-1.5 cursor-pointer hover:brightness-125 transition-all"
            >
              <span className="text-zinc-550 font-semibold hover:text-white transition-colors">KOSPI</span>
              {kospi && kospi.marketStatus && (
                <span className={`text-[8px] px-1 rounded-xl font-sans leading-none font-bold ${
                  kospi.marketStatus === 'OPEN'
                    ? 'bg-success/10 text-success'
                    : 'bg-zinc-500/10 text-zinc-500'
                }`}>
                  {kospi.marketStatus === 'OPEN' ? '장중' : '장마감'}
                </span>
              )}
              {kospi ? (
                <>
                  <span className="text-zinc-200 font-medium">{kospi.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <span className={`font-semibold ${kospi.change >= 0 ? 'text-success' : 'text-danger'}`}>
                    {kospi.change >= 0 ? '▲' : '▼'}{Math.abs(kospi.change).toFixed(2)}%
                  </span>
                </>
              ) : (
                <span className="text-zinc-600 animate-pulse">{t('common.loading')}</span>
              )}
            </div>
            <div className="w-px h-2.5 bg-zinc-800" />
            {/* KOSDAQ */}
            <div 
              onClick={() => {
                setSelectedSymbol('KOSDAQ');
                router.push('/stocks/KOSDAQ/order');
              }}
              className="flex items-center gap-1.5 cursor-pointer hover:brightness-125 transition-all"
            >
              <span className="text-zinc-550 font-semibold hover:text-white transition-colors">KOSDAQ</span>
              {kosdaq && kosdaq.marketStatus && (
                <span className={`text-[8px] px-1 rounded-xl font-sans leading-none font-bold ${
                  kosdaq.marketStatus === 'OPEN'
                    ? 'bg-success/10 text-success'
                    : 'bg-zinc-500/10 text-zinc-500'
                }`}>
                  {kosdaq.marketStatus === 'OPEN' ? '장중' : '장마감'}
                </span>
              )}
              {kosdaq ? (
                <>
                  <span className="text-zinc-200 font-medium">{kosdaq.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <span className={`font-semibold ${kosdaq.change >= 0 ? 'text-success' : 'text-danger'}`}>
                    {kosdaq.change >= 0 ? '▲' : '▼'}{Math.abs(kosdaq.change).toFixed(2)}%
                  </span>
                </>
              ) : (
                <span className="text-zinc-600 animate-pulse">{t('common.loading')}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono text-[10px]">
            <span className="text-zinc-600">{t('header.sysTime')}:</span>
            <span className="text-zinc-400 font-medium">{sysTime}</span>
          </div>
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center w-6 h-6 rounded-xl bg-zinc-900/50 hover:bg-zinc-900/80 text-zinc-350 hover:text-zinc-250 transition-all cursor-pointer"
            aria-label="Toggle Theme"
          >
            {theme === 'light' ? (
              <Moon className="w-3.5 h-3.5 text-indigo-400" />
            ) : (
              <Sun className="w-3.5 h-3.5 text-amber-500" />
            )}
          </button>
          <button
            onClick={() => setLocale(locale === 'ko' ? 'en' : 'ko')}
            className="px-2 py-0.5 rounded-xl bg-zinc-900/50 hover:bg-zinc-900/80 text-zinc-350 hover:text-zinc-250 text-[10px] font-bold transition-all cursor-pointer"
          >
            {locale === 'ko' ? 'EN' : 'KO'}
          </button>
          <Link
            href="/broker-settings"
            className="flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-xl bg-zinc-900/50 hover:bg-zinc-900/80 text-zinc-350 hover:text-zinc-250 transition-colors cursor-pointer"
          >
            {t('common.brokerSettings')}
          </Link>
          {isApiConnected && (
            <button
              onClick={() => setIsDialogOpen(true)}
              className="flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-xl bg-danger/15 hover:bg-danger/25 text-danger transition-colors cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {t('positions.sellAll')}
            </button>
          )}
          {user && (
            <div className="flex items-center gap-2 pl-2 ml-1">
              <span className="text-zinc-550 font-mono text-[9px] max-w-[80px] truncate" title={user.email}>
                {user.email}
              </span>
              <button
                onClick={handleSignOut}
                className="px-2 py-0.5 rounded-xl bg-zinc-900/50 hover:bg-zinc-900/80 text-zinc-450 hover:text-danger text-[10px] font-bold transition-all cursor-pointer"
              >
                {t('header.logout')}
              </button>
            </div>
          )}
        </div>
      </header>

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

