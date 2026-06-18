import { Briefcase, Clock, Settings, Star } from 'lucide-react';
import type { SidebarTab } from '@/components/dashboard/workstation-dashboard-types';

type SidebarTabRailProps = {
  readonly activeTab: SidebarTab;
  readonly isDark: boolean;
  readonly isOpen: boolean;
  readonly onTabClick: (tab: SidebarTab) => void;
};

const SIDEBAR_TABS = [
  { tab: 'HOLDINGS', title: '보유주식', label: '보유', icon: Briefcase },
  { tab: 'FAVORITES', title: '선호종목', label: '선호', icon: Star },
  { tab: 'RECENT', title: '최근본', label: '최근', icon: Clock },
  { tab: 'SETTINGS', title: '설정', label: '설정', icon: Settings },
] as const satisfies readonly {
  readonly tab: SidebarTab;
  readonly title: string;
  readonly label: string;
  readonly icon: typeof Briefcase;
}[];

export function SidebarTabRail({ activeTab, isDark, isOpen, onTabClick }: SidebarTabRailProps) {
  return (
    <nav className={`w-12 h-full flex flex-col items-center py-6 gap-6 shrink-0 z-20 ${
      isDark ? 'bg-zinc-950' : 'bg-slate-50'
    }`}>
      {SIDEBAR_TABS.map(({ tab, title, label, icon: Icon }) => {
        const isActive = isOpen && activeTab === tab;

        return (
          <button
            key={tab}
            type="button"
            onClick={() => onTabClick(tab)}
            className={`w-9 h-9 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
              isActive
                ? 'bg-primary/10 text-primary shadow-sm'
                : 'bg-transparent text-zinc-550 hover:text-zinc-350'
            }`}
            title={title}
          >
            <Icon size={14} />
            <span className="text-[8px] font-bold leading-none font-sans">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
