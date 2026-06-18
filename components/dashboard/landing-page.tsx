'use client';
/* eslint-disable @next/next/no-img-element */

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkstation } from '@/lib/context/workstation-context';
import AntigravityBackground from './antigravity-background';
import { Cpu, TrendingUp, Activity } from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();
  const { user } = useWorkstation();

  // Redirect if logged in
  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  return (
    <div className="min-h-screen w-screen bg-[#07070c] text-zinc-100 font-sans flex flex-col justify-between overflow-x-hidden relative select-none">
      
      {/* Antigravity Neural Particle Field */}
      <AntigravityBackground />

      {/* Grid line background pattern for tech aesthetic */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none z-0" />

      {/* Background soft glow lights */}
      <div className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-rose-500/[0.03] blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-blue-500/[0.03] blur-[140px] pointer-events-none" />

      {/* 1. Header Navigation */}
      <header className="w-full px-8 py-5 flex items-center justify-between border-b border-zinc-900/60 backdrop-blur-2xl bg-zinc-950/20 z-50 sticky top-0">
        <div className="flex items-center gap-3 group cursor-pointer" onClick={() => router.push('/')}>
          <div className="relative">
            <div className="w-3.5 h-3.5 rounded-full bg-rose-500 animate-ping absolute opacity-60" />
            <div className="w-3.5 h-3.5 rounded-full bg-rose-500 relative z-10 transition-transform group-hover:scale-110" />
          </div>
          <span className="font-extrabold tracking-wider text-[13px] uppercase text-white font-mono bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            TOSS AUTO WORKSTATION v2
          </span>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            id="btn-login-header"
            onClick={() => router.push('/login')}
            className="px-4 py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-800 hover:border-zinc-700 hover:text-white transition-all cursor-pointer"
          >
            로그인
          </button>
          <button 
            id="btn-register-header"
            onClick={() => router.push('/register')}
            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-purple-600 text-white text-xs font-bold hover:from-rose-600 hover:to-purple-700 shadow-lg shadow-rose-950/10 hover:shadow-purple-500/10 transition-all cursor-pointer hover:scale-[1.02]"
          >
            워크스테이션 시작하기
          </button>
        </div>
      </header>

      {/* 2. Hero Section (Apple iPhone style layout) */}
      <section className="relative z-10 w-full max-w-6xl mx-auto px-6 pt-24 pb-12 text-center flex flex-col items-center">
        
        {/* Glow badge */}
        <div className="px-3.5 py-1 rounded-full bg-gradient-to-r from-rose-500/10 to-purple-500/10 border border-rose-500/20 text-rose-400 font-bold text-[10.5px] uppercase tracking-wider mb-6 cursor-default animate-[pulse_3s_infinite]">
          ✨ 실거래 자동화 및 모의투자 완벽 지원
        </div>

        {/* Dynamic Title */}
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tight leading-[1.15] text-white">
          트레이딩의 미래,<br />
          <span className="bg-gradient-to-r from-rose-400 via-purple-400 to-blue-500 bg-clip-text text-transparent bg-[size:200%_auto] animate-[gradient-shift_6s_ease_infinite]">
            토스 자동매매 워크스테이션
          </span>
        </h1>
        
        <p className="mt-8 text-sm sm:text-base md:text-lg text-zinc-400 font-medium leading-relaxed max-w-3xl">
          인공지능 분석과 초고속 호가 매칭 엔진이 결합된 최고의 자동 주식 매매 시스템.
          이제 복잡한 코딩이나 모니터링 없이도 나만의 AI 트레이딩 시나리오를 설계하고 실시간으로 구동하세요.
        </p>

        {/* Buttons CTA */}
        <div className="mt-10 flex flex-col sm:flex-row gap-4 items-center justify-center w-full">
          <button 
            id="hero-register-btn"
            onClick={() => router.push('/register')}
            className="w-56 py-4 rounded-2xl bg-gradient-to-r from-rose-500 via-purple-500 to-blue-500 text-white font-extrabold text-sm shadow-xl shadow-rose-950/20 hover:scale-[1.04] active:scale-[0.98] transition-all cursor-pointer relative overflow-hidden group"
          >
            <div className="absolute inset-0 w-full h-full bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            무료로 시작하기
          </button>
          <button 
            id="hero-login-btn"
            onClick={() => router.push('/login')}
            className="w-56 py-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 text-zinc-300 font-bold text-sm hover:bg-zinc-850 hover:text-white hover:border-zinc-700 hover:scale-[1.04] active:scale-[0.98] transition-all cursor-pointer backdrop-blur-sm"
          >
            이미 계정이 있습니다
          </button>
        </div>

        {/* Huge Workstation Showcase Mockup */}
        <div className="mt-20 w-full rounded-3xl border border-zinc-900 bg-zinc-950/45 p-3.5 shadow-2xl relative z-10 hover:border-rose-500/10 transition-colors duration-700 hover:shadow-[0_0_80px_rgba(244,63,94,0.04)] animate-fade-in group">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-rose-500/20 to-transparent" />
          <div className="relative overflow-hidden rounded-2xl bg-[#09090e]">
            {/* Embedded generated mockup image */}
            <img 
              src="/workstation_dashboard_screenshot.png" 
              alt="Toss Auto Trading Workstation Interface Mockup"
              className="w-full h-auto object-cover opacity-90 transition-transform duration-1000 group-hover:scale-[1.01]"
              loading="eager"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#07070c] via-transparent to-transparent opacity-40 pointer-events-none" />
          </div>
        </div>

      </section>

      {/* 3. Detailed Specialized Features (Alternating Layout) */}
      <section className="relative z-10 w-full max-w-5xl mx-auto px-6 py-24 space-y-36">

        {/* Feature 1: AI Auto-Trading Engine */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-center">
          <div className="md:col-span-6 flex flex-col justify-center text-left">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center font-bold text-xl mb-6 shadow-[0_0_15px_rgba(244,63,94,0.15)]">
              <Cpu size={20} />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight tracking-tight">
              지능형 AI 알고리즘의<br />
              <span className="bg-gradient-to-r from-rose-400 via-purple-400 to-blue-500 bg-clip-text text-transparent bg-[size:200%_auto]">
                백그라운드 감시 시스템
              </span>
            </h2>
            <p className="mt-5 text-sm text-zinc-400 font-medium leading-relaxed font-sans">
              MA 크로스(단기 5일선 / 장기 20일선 EMA) 및 RSI 평균회귀(과매도 30 / 과매수 70) 보조지표 매매 봇이 탑재되어 있습니다.
              실시간으로 가격을 수집하고 분석하여 매수/매도 기회가 찾아올 때 지체 없이 체결 주문을 자동 처리합니다.
            </p>
          </div>
          <div className="md:col-span-6 rounded-3xl border border-zinc-900 bg-zinc-950/45 p-2 shadow-xl hover:border-rose-500/10 transition-colors duration-500 group">
            <img 
              src="/backtest_page_screenshot.png" 
              alt="AI Engine Neural Network Graph Visual"
              className="w-full h-auto rounded-2xl object-cover opacity-85 group-hover:scale-[1.01] transition-transform duration-700"
              loading="lazy"
            />
          </div>
        </div>

        {/* Feature 2: Full Historical Chart Parsing */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-center">
          <div className="md:col-span-6 md:order-2 flex flex-col justify-center text-left">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-xl mb-6 shadow-[0_0_15px_rgba(168,85,247,0.15)]">
              <TrendingUp size={20} />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight tracking-tight">
              상장일 이후 전체 역사 시세의<br />
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-rose-400 bg-clip-text text-transparent bg-[size:200%_auto]">
                초고화질 일봉 차트 출력
              </span>
            </h2>
            <p className="mt-5 text-sm text-zinc-400 font-medium leading-relaxed font-sans">
              네이버 증권 시세 API의 정밀 파싱을 통하여 종목의 상장 첫날부터 현재까지 최대 6,000일(~24년 분량) 이상의 모든 일별 시세 변동을 조회할 수 있습니다.
              과거 대세 상승기와 위기 국면을 한눈에 살펴보며 장기 패턴 트렌드를 즉각 파악하십시오.
            </p>
          </div>
          <div className="md:col-span-6 md:order-1 rounded-3xl border border-zinc-900 bg-zinc-950/45 p-5 shadow-xl hover:border-purple-500/10 transition-colors duration-500 flex flex-col justify-center h-full min-h-[260px] relative overflow-hidden select-none">
            {/* Visual illustration of chart timeline history */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.03)_0%,transparent_60%)] pointer-events-none" />
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3 mb-4">
              <span className="text-[10px] text-zinc-650 font-bold uppercase tracking-wider font-mono">Dynamic History Engine</span>
              <span className="text-[10.5px] font-bold text-rose-500">6,000 Days +</span>
            </div>
            <div className="flex-1 flex items-end justify-between gap-1 h-36">
              {[25, 40, 15, 30, 48, 55, 35, 68, 72, 50, 42, 60, 85, 92, 78, 64, 80, 100].map((h, idx) => (
                <div key={idx} className="flex-1 bg-gradient-to-t from-purple-600/30 to-purple-400/90 rounded-t" style={{ height: `${h}%` }} />
              ))}
            </div>
            <div className="mt-3 flex justify-between text-[9px] text-zinc-600 font-mono">
              <span>상장일 (~2000년 이전)</span>
              <span>최근 거래일 (2026년)</span>
            </div>
          </div>
        </div>

        {/* Feature 3: High Density Order Book */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-center">
          <div className="md:col-span-6 flex flex-col justify-center text-left">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center font-bold text-xl mb-6 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
              <Activity size={20} />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight tracking-tight">
              0.1초 수준의 초정밀 호가와<br />
              <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent bg-[size:200%_auto]">
                실시간 매수 매도 매칭
              </span>
            </h2>
            <p className="mt-5 text-sm text-zinc-400 font-medium leading-relaxed font-sans">
              현재가 기준의 매수 및 매도 대기 호가 물량과 거래대금 추이를 직관적이고 빠르게 시각화해 줍니다.
              호가 창에서 원하는 단가를 직접 터치하여 즉시 주문을 접수하고, 자산과 체결 내역을 고주파로 즉각 정산할 수 있습니다.
            </p>
          </div>
          <div className="md:col-span-6 rounded-3xl border border-zinc-900 bg-zinc-950/45 p-2 shadow-xl hover:border-blue-500/10 transition-colors duration-500 group">
            <img 
              src="/order_page_screenshot.png" 
              alt="High Density Order Book Interface Visual"
              className="w-full h-auto rounded-2xl object-cover opacity-85 group-hover:scale-[1.01] transition-transform duration-700"
              loading="lazy"
            />
          </div>
        </div>

      </section>

      {/* 4. Bottom Enrollment CTA */}
      <section className="relative z-10 w-full max-w-4xl mx-auto px-6 py-28 text-center border-t border-zinc-900/60 flex flex-col items-center">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
          지금, 지능적인 트레이딩을<br />
          설계해 보세요.
        </h2>
        <p className="mt-5 text-xs sm:text-sm text-zinc-400 max-w-xl font-medium leading-relaxed font-sans">
          토스 스타일의 직관적인 디자인 위에서 실시간 시세와 자동매매 봇을 무료로 경험할 수 있습니다.
          몇 초 만에 가입하고 바로 입장을 위한 대시보드를 확인하세요.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3.5 w-full justify-center">
          <button 
            id="footer-register-btn"
            onClick={() => router.push('/register')}
            className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-rose-500 via-purple-500 to-blue-500 text-white font-extrabold text-xs shadow-xl shadow-rose-950/20 hover:scale-[1.03] active:scale-[0.98] transition-all cursor-pointer"
          >
            시작하기 (무료 회원가입)
          </button>
          <button 
            id="footer-login-btn"
            onClick={() => router.push('/login')}
            className="px-8 py-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 text-zinc-300 font-bold text-xs hover:bg-zinc-800 hover:text-white transition-all cursor-pointer"
          >
            이미 회원입니다 (로그인)
          </button>
        </div>
      </section>

      {/* 5. Footer */}
      <footer className="w-full py-7 text-center border-t border-zinc-900/60 bg-zinc-950/20 backdrop-blur-md text-[10px] text-zinc-650 font-mono z-10">
        © 2026 TOSS AUTO WORKSTATION v2. All rights reserved. Created under Antigravity aesthetic parameters.
      </footer>

      {/* Style overrides for animations */}
      <style jsx global>{`
        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

    </div>
  );
}
