export type MarketTab = '관심종목' | '실시간 인기' | '거래대금 상위' | '급상승 종목';
export type FilterPill = '전체' | '국내' | '해외';
export type ChartTimeline = '1D' | '1W' | '1M' | '1Y';
export type SidebarTab = 'HOLDINGS' | 'FAVORITES' | 'RECENT' | 'SETTINGS';

export type GlobalIndex = {
  readonly symbol: string;
  readonly name: string;
  readonly price: string;
  readonly change: string;
  readonly changePct: string;
  readonly isUp: boolean;
  readonly history: readonly number[];
  readonly marketStatus?: 'OPEN' | 'CLOSE';
};

export interface LayoutItem {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}
