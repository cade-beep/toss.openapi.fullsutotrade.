'use client';

import React from 'react';
import { useWorkstation } from '@/lib/context/workstation-context';
import { useI18n } from '@/lib/i18n/i18n-context';
import Header from '@/components/layout/header';
import Footer from '@/components/layout/footer';
import PortfolioPanel from '@/components/dashboard/portfolio';
import WatchlistPanel from '@/components/dashboard/watchlist';
import MarketChartPanel from '@/components/dashboard/market-chart';
import PositionsPanel from '@/components/dashboard/positions';
import OrderTicketPanel from '@/components/dashboard/order-ticket';
import AIStrategiesPanel from '@/components/dashboard/ai-strategies';

export default function WorkstationDashboard() {
  const { isHydrated, toast, isApiConnected } = useWorkstation();
  const { t } = useI18n();

  // If loading local state cache, show loader screen
  if (!isHydrated) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-black text-emerald-500 font-mono text-xs gap-2 select-none">
        <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span>{t('common.initializing')}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-black text-zinc-300 select-none">
      
      {/* Floating Toast Alerts */}
      {toast && (
        <div className="absolute top-4 right-4 z-50 flex items-center gap-2 p-3 text-xs font-semibold rounded bg-zinc-900 border border-zinc-700 shadow-2xl text-white">
          <span className={`w-2 h-2 rounded-full ${
            toast.type === 'success' ? 'bg-emerald-500' : toast.type === 'error' ? 'bg-rose-500' : 'bg-blue-500'
          }`} />
          {toast.message}
        </div>
      )}

      {/* Header Layout */}
      <Header />

      {/* Connection Status Banner */}
      <div className={`flex items-center justify-center gap-4 py-1.5 text-[10px] font-bold uppercase tracking-wider shrink-0 ${
        isApiConnected 
          ? 'bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-400' 
          : 'bg-rose-500/10 border-b border-rose-500/20 text-rose-400'
      }`}>
        <div className="flex items-center">
          <span className={`w-1.5 h-1.5 rounded-full mr-2 ${isApiConnected ? 'bg-[#00d287]' : 'bg-rose-500 animate-pulse'}`} />
          {isApiConnected ? t('dashboard.brokerConnected') : t('dashboard.brokerDisconnected')}
        </div>
        {!isApiConnected && (
          <a
            href="/broker-settings"
            className="px-2 py-0.5 rounded bg-rose-950/60 border border-rose-900/40 text-rose-300 hover:bg-rose-900/60 hover:text-rose-100 transition-all cursor-pointer font-sans"
          >
            {t('dashboard.configureCredentials')}
          </a>
        )}
      </div>

      {/* Main Multi-Pane Workspace Grid */}
      <div className="flex flex-1 overflow-hidden p-1 gap-1">
        
        {/* Left Sidebar (Account & Watchlist) */}
        <div className="flex flex-col w-80 shrink-0 gap-1 overflow-hidden">
          <PortfolioPanel />
          <WatchlistPanel />
        </div>

        {/* Center Panel (Chart & Positions) */}
        <div className="flex flex-col flex-1 gap-1 overflow-hidden">
          <MarketChartPanel />
          <PositionsPanel />
        </div>

        {/* Right Sidebar (Order Entry & Bots) */}
        <div className="flex flex-col w-80 shrink-0 gap-1 overflow-hidden">
          <OrderTicketPanel />
          <AIStrategiesPanel />
        </div>

      </div>

      {/* Activity Logs Footer */}
      <Footer />

    </div>
  );
}
