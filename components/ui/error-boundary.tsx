'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo });
    console.error('Workstation Crash Captured by Boundary:', error, errorInfo);
  }

  private handleReset = () => {
    try {
      localStorage.clear();
      window.location.reload();
    } catch (e) {
      console.error('Failed to clear localStorage:', e);
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen w-screen bg-black p-4 text-xs font-mono select-none">
          <div className="w-full max-w-md rounded-xl border border-danger/20 bg-zinc-950 p-6 shadow-2xl text-zinc-300">
            {/* Header Icon */}
            <div className="flex items-center gap-2 text-danger mb-4 font-bold uppercase tracking-wider text-[11px]">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>CRITICAL SYSTEM CRASH</span>
            </div>

            {/* Error Message */}
            <p className="text-zinc-400 mb-4 leading-normal font-sans text-left">
              워크스테이션 로딩 중 예기치 않은 오류가 발생했습니다. 클라이언트 데이터 캐시가 만료되었거나 손상되었을 수 있습니다.
            </p>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-4 max-h-32 overflow-auto text-danger select-text leading-relaxed">
              {this.state.error && this.state.error.toString()}
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => window.location.reload()}
                className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors font-bold cursor-pointer"
              >
                새로고침 (Reload)
              </button>
              <button
                onClick={this.handleReset}
                className="px-3 py-1.5 rounded-xl bg-danger/15 hover:bg-danger/25 border border-danger/30 hover:border-danger/55 text-danger transition-colors font-bold cursor-pointer"
              >
                데이터 초기화 후 재시작
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
