import { SupabaseClient } from '@supabase/supabase-js';

export interface HistoricalBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface HistoricalDataProvider {
  getHistoricalData(symbol: string, startDate: string, endDate: string): Promise<HistoricalBar[]>;
}

export class DatabaseHistoricalDataProvider implements HistoricalDataProvider {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async getHistoricalData(symbol: string, startDate: string, endDate: string): Promise<HistoricalBar[]> {
    const { data, error } = await this.supabase
      .from('historical_candles')
      .select('candle_date, open, high, low, close, volume')
      .eq('symbol', symbol)
      .gte('candle_date', startDate)
      .lte('candle_date', endDate)
      .order('candle_date', { ascending: true });

    if (error) {
      console.error(`[DatabaseHistoricalDataProvider] Failed to load candles: ${error.message}`);
      return [];
    }

    if (!data) return [];

    return data.map((d: Record<string, unknown>) => ({
      date: d.candle_date as string,
      open: Number(d.open),
      high: Number(d.high),
      low: Number(d.low),
      close: Number(d.close),
      volume: Number(d.volume)
    }));
  }
}

export class CSVHistoricalDataProvider implements HistoricalDataProvider {
  private bars: HistoricalBar[];

  constructor(csvContent: string) {
    this.bars = this.parseCSV(csvContent);
  }

  async getHistoricalData(symbol: string, startDate: string, endDate: string): Promise<HistoricalBar[]> {
    // CSV dataset is target-scoped; filter chronologically
    return this.bars
      .filter(bar => bar.date >= startDate && bar.date <= endDate)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private parseCSV(content: string): HistoricalBar[] {
    const list: HistoricalBar[] = [];
    if (!content) return list;

    const lines = content.split(/\r?\n/);
    if (lines.length < 2) return list;

    // Header validation and indexing
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const dateIdx = headers.indexOf('date');
    const openIdx = headers.indexOf('open');
    const highIdx = headers.indexOf('high');
    const lowIdx = headers.indexOf('low');
    const closeIdx = headers.indexOf('close');
    const volumeIdx = headers.indexOf('volume');

    if (dateIdx === -1 || openIdx === -1 || highIdx === -1 || lowIdx === -1 || closeIdx === -1) {
      console.warn('[CSVHistoricalDataProvider] Required columns missing from header line.');
      return list;
    }

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = line.split(',');
      if (cols.length < 5) continue;

      const date = cols[dateIdx]?.trim();
      const open = Number(cols[openIdx]);
      const high = Number(cols[highIdx]);
      const low = Number(cols[lowIdx]);
      const close = Number(cols[closeIdx]);
      const volume = volumeIdx !== -1 ? Number(cols[volumeIdx]) : 0;

      if (!date || isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close)) {
        continue; // skip corrupt rows
      }

      list.push({ date, open, high, low, close, volume });
    }

    return list.sort((a, b) => a.date.localeCompare(b.date));
  }
}
