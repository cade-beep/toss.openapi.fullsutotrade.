'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useWorkstation } from '@/lib/context/workstation-context';
import { supabase } from '@/lib/supabase/client';
import AntigravityBackground from '@/components/dashboard/antigravity-background';

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function RegisterPage() {
  const router = useRouter();
  const { handleSignIn, showToast, user } = useWorkstation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

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

    if (password.length < 6) {
      showToast('비밀번호는 최소 6자리 이상이어야 합니다.', 'error');
      return;
    }

    if (password !== confirmPassword) {
      showToast('비밀번호가 일치하지 않습니다.', 'error');
      return;
    }

    setLoading(true);

    try {
      const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === 'true';

      if (authEnabled && supabase) {
        // Actual Supabase Sign Up
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          showToast(`회원가입 실패: ${error.message}`, 'error');
        } else if (data?.user) {
          showToast('회원가입 완료! 로그인 상태로 워크스테이션에 입장합니다.', 'success');
          handleSignIn(data.user.id, data.user.email || email);
          router.push('/');
        }
      } else {
        // Local Storage-based Real Authentication
        const savedUsers = localStorage.getItem('toss_local_users');
        const usersList = savedUsers ? JSON.parse(savedUsers) : [];

        const userExists = usersList.some(
          (u: { email: string }) => u.email.toLowerCase() === email.toLowerCase()
        );

        if (userExists) {
          showToast('이미 존재하는 계정입니다. 다른 이메일을 사용해주세요.', 'error');
        } else {
          // Hash the password before saving
          const hashedPassword = await hashPassword(password);
          
          // Create new user record with hashed password
          const newUser = {
            id: `usr-${Date.now()}`,
            email: email.trim(),
            password: hashedPassword,
          };
          
          usersList.push(newUser);
          localStorage.setItem('toss_local_users', JSON.stringify(usersList));
          
          // Log in automatically
          const userSession = { id: newUser.id, email: newUser.email };
          localStorage.setItem('toss_trading_user', JSON.stringify(userSession));
          
          showToast('회원가입 성공! 워크스테이션에 자동 로그인합니다.', 'success');
          handleSignIn(newUser.id, newUser.email);
          router.push('/');
        }
      }
    } catch (err) {
      console.error('Register submit error:', err);
      showToast('회원가입 처리 중 오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[#07070a] text-zinc-100 flex items-center justify-center p-4 overflow-hidden relative select-none">
      
      {/* Interactive Neural Particle Field */}
      <AntigravityBackground />

      {/* Background soft glow lights */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />

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
          <h2 className="text-2xl font-black text-white tracking-tight leading-none bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">회원가입</h2>
          <p className="text-[11px] text-zinc-500 mt-2 font-sans font-medium">
            실거래 및 AI 자동 매매 워크스테이션의 새 계정 생성
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
              비밀번호 (최소 6자)
            </label>
            <input
              type="password"
              required
              placeholder="비밀번호 설정"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-900/40 border border-zinc-900 focus:border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none transition-all placeholder-zinc-700 font-medium"
            />
          </div>

          {/* Confirm Password input */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wide">
              비밀번호 확인
            </label>
            <input
              type="password"
              required
              placeholder="비밀번호 다시 입력"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
                가입 중...
              </>
            ) : (
              '회원가입하기'
            )}
          </button>

        </form>

        {/* Footer options */}
        <div className="mt-8 pt-4 border-t border-zinc-900/60 text-center text-[10.5px] text-zinc-500 font-sans font-medium">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="font-bold text-primary hover:text-primary/90 hover:underline transition-colors ml-1">
            로그인하기
          </Link>
        </div>

      </div>

    </div>
  );
}
