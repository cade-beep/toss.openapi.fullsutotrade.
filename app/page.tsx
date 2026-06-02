'use client';

import { WorkstationProvider } from '@/lib/context/workstation-context';
import WorkstationDashboard from '@/components/dashboard/workstation-dashboard';

export default function Home() {
  return (
    <WorkstationProvider>
      <WorkstationDashboard />
    </WorkstationProvider>
  );
}
