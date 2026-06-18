'use client';

import { useWorkstation } from '@/lib/context/workstation-context';
import WorkstationDashboard from '@/components/dashboard/workstation-dashboard';
import LandingPage from '@/components/dashboard/landing-page';

export default function Home() {
  const { user, isHydrated } = useWorkstation();

  if (!isHydrated) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-black text-primary font-mono text-xs gap-2 select-none">
        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span>초기화 중...</span>
      </div>
    );
  }

  return user ? <WorkstationDashboard /> : <LandingPage />;
}

