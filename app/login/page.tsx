'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useWorkstation } from '@/lib/context/workstation-context';
import { supabase } from '@/lib/supabase/client';
import AntigravityBackground from '@/components/dashboard/antigravity-background';

export default function LoginPage() {
  const router = useRouter();
  const { handleSignIn, showToast, user } = useWorkstation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Seed Admin Account into local storage on mount
  useEffect(() => {
    try {
      const savedUsers = localStorage.getItem('toss_local_users');
      const usersList = savedUsers ? JSON.parse(savedUsers) : [];
      interface LocalUser {
        id: string;
        email: string;
        password?: string;
      }
      const adminExists = usersList.some(
        (u: LocalUser) => u.email.toLowerCase() === '0128rbgh' || u.email.toLowerCase() === '0128rbgh@toss.im'
      );
      if (!adminExists) {
        usersList.push({
          id: 'admin-0128',
          email: '0128rbgh',
          password: '9508rbgh',
        });
        usersList.push({
          id: 'admin-0128-email',
          email: '0128rbgh@toss.im',
          password: '9508rbgh',
        });
        localStorage.setItem('toss_local_users', JSON.stringify(usersList));
      }
    } catch (err) {
      console.error('Error seeding admin credentials:', err);
    }
  }, []);

  // If already logged in, redirect to home
  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      showToast('이메일과 비밀번호를 입력해주세요.', 'error');
      return;
    }

    setLoading(true);

    try {
      const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === 'true';

      if (authEnabled && supabase) {
        // Actual Supabase Sign In
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          showToast(`로그인 실패: ${error.message}`, 'error');
        } else if (data?.user) {
          showToast('로그인 성공!', 'success');
          handleSignIn(data.user.id, data.user.email || email);
          router.push('/');
        }
      } else {
        // Local Storage-based Real Authentication
        const savedUsers = localStorage.getItem('toss_local_users');
        const usersList = savedUsers ? JSON.parse(savedUsers) : [];
        
        const foundUser = usersList.find(
          (u: { email: string; password?: string }) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
        );

        if (foundUser) {
          showToast('로그인 성공!', 'success');
          // Save active user session
          const userSession = { id: foundUser.id, email: foundUser.email };
          localStorage.setItem('toss_trading_user', JSON.stringify(userSession));
          
          handleSignIn(foundUser.id, foundUser.email);
          router.push('/');
        } else {
          showToast('이메일 또는 비밀번호가 올바르지 않습니다.', 'error');
        }
      }
    } catch (err) {
      console.error('Login submit error:', err);
      showToast('로그인 처리 중 오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[#07070a] text-zinc-100 flex items-center justify-center p-4 overflow-hidden relative select-none">
      
      {/* Interactive Neural Particle Field */}
      <AntigravityBackground />

      {/* Background soft glow lights */}
      <div className="absolute top-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />

      {/* Main glass card */}
      <div className="w-full max-w-sm rounded-xl border border-zinc-900/60 bg-zinc-950/45 p-8 backdrop-blur-2xl z-10 hover:border-primary/10 transition-colors duration-500 hover:shadow-[0_0_50px_rgba(0,100,255,0.05)]">
        
        {/* Title */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-ping absolute opacity-60" />
            <span className="w-2.5 h-2.5 rounded-full bg-primary relative z-10" />
            <span className="text-[10px] font-extrabold tracking-wider uppercase text-zinc-500 font-mono">
              TOSS Auto Trading Workstation
            </span>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight leading-none bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">계정에 로그인하세요</h2>
          <p className="text-[11px] text-zinc-500 mt-2 font-sans font-medium">
            AI 자동 주식 매매 시스템 입장을 위한 계정 인증
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
          
          {/* Email input */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wide">
              이메일 또는 아이디
            </label>
            <input
              type="text"
              required
              placeholder="이메일 또는 아이디 입력"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-900/40 border border-zinc-900 focus:border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none transition-all placeholder-zinc-700 font-medium"
            />
          </div>

          {/* Password input */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wide">
              비밀번호
            </label>
            <input
              type="password"
              required
              placeholder="비밀번호 입력"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-900/40 border border-zinc-900 focus:border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none transition-all placeholder-zinc-700 font-medium"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-extrabold text-xs shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 overflow-hidden relative group"
          >
            <div className="absolute inset-0 w-full h-full bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border border-white border-t-transparent rounded-full animate-spin" />
                로그인 중...
              </>
            ) : (
              '로그인하기'
            )}
          </button>

        </form>

        {/* Footer options */}
        <div className="mt-8 pt-4 border-t border-zinc-900/60 text-center text-[10.5px] text-zinc-500 font-sans font-medium">
          아직 계정이 없으신가요?{' '}
          <Link href="/register" className="font-bold text-primary hover:text-primary/90 hover:underline transition-colors ml-1">
            회원가입하기
          </Link>
        </div>

      </div>

    </div>
  );
}
