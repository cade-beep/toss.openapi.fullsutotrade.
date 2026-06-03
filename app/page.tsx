'use client';

import { WorkstationProvider } from '@/lib/context/workstation-context';
import WorkstationDashboard from '@/components/dashboard/workstation-dashboard';
import ErrorBoundary from '@/components/ui/error-boundary';

export default function Home() {
  return (
    <ErrorBoundary>
      <WorkstationProvider>
        <WorkstationDashboard />
      </WorkstationProvider>
    </ErrorBoundary>
  );
}

