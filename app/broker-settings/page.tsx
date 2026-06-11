'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useWorkstation } from '@/lib/context/workstation-context';
import { supabase } from '@/lib/supabase/client';

export default function BrokerSettingsPage() {
  const { isHydrated, showToast, reloadUserData } = useWorkstation();
  const [loading, setLoading] = useState(true);
  const [exists, setExists] = useState(false);
  const [currentAccountId, setCurrentAccountId] = useState('');
  
  // Form values
  const [apiKey, setApiKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [accountId, setAccountId] = useState('');
  
  // Test connection state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const loadCredentialStatus = useCallback(async () => {
    try {
      setLoading(true);
      if (!supabase) return;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const res = await fetch('/api/credentials', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();

      if (res.ok && data.exists) {
        setExists(true);
        setCurrentAccountId(data.accountId);
        setAccountId(data.accountId);
        setApiKey('••••••••••••••••••••••••••••••••');
        setSecretKey('••••••••••••••••••••••••••••••••');
      } else {
        setExists(false);
        setCurrentAccountId('');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('Failed to load credentials status:', err);
      showToast(`설정 상태를 불러오지 못했습니다: ${errorMsg}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (isHydrated) {
      const timer = setTimeout(() => {
        loadCredentialStatus();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isHydrated, loadCredentialStatus]);

  async function handleTestConnection() {
    if (!apiKey || !secretKey || !accountId) {
      showToast('모든 입력 값을 채워주세요.', 'error');
      return;
    }
    
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/credentials/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          apiKey: apiKey.includes('•') ? '' : apiKey, // If unchanged, don't pass dummy mask
          secretKey: secretKey.includes('•') ? '' : secretKey,
          accountId
        })
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        setTestResult({ success: true, message: data.message || 'Connection Verified successfully!' });
        showToast('API 연결 테스트 성공!', 'success');
      } else {
        setTestResult({ success: false, message: data.error || 'Connection verification failed.' });
        showToast('API 연결 테스트 실패', 'error');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setTestResult({ success: false, message: errorMsg });
      showToast('연결 테스트 에러', 'error');
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    if (!apiKey || !secretKey || !accountId) {
      showToast('모든 입력 값을 채워주세요.', 'error');
      return;
    }

    setSaving(true);
    try {
      if (!supabase) return;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const res = await fetch('/api/credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          apiKey: apiKey.includes('•') ? '' : apiKey, // If masked, don't change
          secretKey: secretKey.includes('•') ? '' : secretKey,
          accountId
        })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast('연결 설정을 성공적으로 저장했습니다.', 'success');
        await reloadUserData();
        await loadCredentialStatus();
      } else {
        showToast(`저장 실패: ${data.error || '알 수 없는 오류'}`, 'error');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showToast(`저장 중 오류가 발생했습니다: ${errorMsg}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('정말로 연결 설정을 삭제하시겠습니까? 자동매매 인프라가 비활성화됩니다.')) {
      return;
    }

    setSaving(true);
    try {
      if (!supabase) return;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const res = await fetch('/api/credentials', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast('연결 설정을 삭제했습니다.', 'success');
        setApiKey('');
        setSecretKey('');
        setAccountId('');
        setTestResult(null);
        await reloadUserData();
        await loadCredentialStatus();
      } else {
        showToast(`삭제 실패: ${data.error || '알 수 없는 오류'}`, 'error');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showToast(`삭제 중 오류가 발생했습니다: ${errorMsg}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-black text-emerald-500 font-mono text-xs gap-2 select-none">
        <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span>LOADING BROKER SETTINGS SESSION...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-screen bg-black text-zinc-300 font-mono text-xs p-6 flex items-center justify-center select-none">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-900 rounded p-6 shadow-2xl space-y-5">
        
        {/* Header Title */}
        <div className="flex justify-between items-center border-b border-zinc-900 pb-3">
          <div>
            <h1 className="text-sm font-bold text-white uppercase tracking-wider">Broker Settings</h1>
            <p className="text-[10px] text-zinc-500 font-sans mt-0.5">Configure Toss Open API client credentials</p>
          </div>
          <Link
            href="/"
            className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors font-bold cursor-pointer"
          >
            ← Return
          </Link>
        </div>

        {/* Status Indicator Banner */}
        <div className={`p-3 rounded border text-[11px] leading-normal ${
          exists
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
        }`}>
          <div className="flex items-center gap-2 font-bold">
            <span className={`w-2 h-2 rounded-full ${exists ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`} />
            <span>{exists ? 'STATUS: BROKER API CONNECTED' : 'STATUS: DISCONNECTED'}</span>
          </div>
          <p className="text-zinc-500 text-[10px] font-sans mt-1">
            {exists 
              ? `Authorized Account Identifier: ${currentAccountId}. Workstation functionality unlocked.`
              : 'Workstation widgets are fail-closed and locked. Provide credential keys to unlock.'}
          </p>
        </div>

        {/* Form Fields */}
        <div className="space-y-3 pt-1">
          <div className="flex flex-col gap-1.5">
            <label className="text-zinc-500 font-sans">API Key (X-TOSS-API-KEY)</label>
            <input
              type="password"
              placeholder="Enter Toss API Key"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setTestResult(null);
              }}
              className="bg-zinc-900 border border-zinc-900 focus:border-zinc-800 rounded px-3 py-1.5 text-white focus:outline-none text-[11px]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-zinc-500 font-sans">Secret Key (HMAC SHA-256 Signing Secret)</label>
            <input
              type="password"
              placeholder="Enter Signing Secret Key"
              value={secretKey}
              onChange={(e) => {
                setSecretKey(e.target.value);
                setTestResult(null);
              }}
              className="bg-zinc-900 border border-zinc-900 focus:border-zinc-800 rounded px-3 py-1.5 text-white focus:outline-none text-[11px]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-zinc-500 font-sans">Account ID</label>
            <input
              type="text"
              placeholder="Enter Account ID"
              value={accountId}
              onChange={(e) => {
                setAccountId(e.target.value);
                setTestResult(null);
              }}
              className="bg-zinc-900 border border-zinc-900 focus:border-zinc-800 rounded px-3 py-1.5 text-white focus:outline-none text-[11px]"
            />
          </div>
        </div>

        {/* Test Result Display */}
        {testResult && (
          <div className={`p-2.5 rounded border text-[10.5px] leading-relaxed font-sans ${
            testResult.success
              ? 'bg-emerald-950/20 border-emerald-900/30 text-emerald-400'
              : 'bg-rose-950/20 border-rose-900/30 text-rose-400'
          }`}>
            <span className="font-mono font-bold block mb-0.5">
              {testResult.success ? '✓ SUCCESS' : '✗ ERROR'}
            </span>
            <span>{testResult.message}</span>
          </div>
        )}

        {/* Actions Button Row */}
        <div className="flex gap-2 justify-between border-t border-zinc-900 pt-4 select-none">
          {exists && (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="px-3 py-1.5 rounded bg-rose-950/30 hover:bg-rose-950/60 border border-rose-900/40 hover:border-rose-900 text-rose-400 transition-colors font-bold cursor-pointer disabled:opacity-40"
            >
              Disconnect
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={handleTestConnection}
              disabled={testing || !apiKey || !secretKey || !accountId}
              className="px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-850 hover:border-zinc-700 text-zinc-300 font-bold transition-colors cursor-pointer disabled:opacity-40"
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !apiKey || !secretKey || !accountId}
              className="px-3 py-1.5 rounded bg-[#00d287] hover:bg-[#00be7a] text-zinc-950 font-bold transition-colors cursor-pointer disabled:opacity-40"
            >
              {saving ? 'Saving...' : 'Save Credentials'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
