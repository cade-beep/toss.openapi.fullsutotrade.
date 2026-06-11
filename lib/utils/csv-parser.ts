import { HistoricalBar } from '@/services/market/historical-provider';

export function parseCSV(content: string): HistoricalBar[] {
  const list: HistoricalBar[] = [];
  if (!content) return list;

  const lines = content.split(/\r?\n/);
  if (lines.length < 2) return list;

  // Header indexing
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const dateIdx = headers.indexOf('date');
  const openIdx = headers.indexOf('open');
  const highIdx = headers.indexOf('high');
  const lowIdx = headers.indexOf('low');
  const closeIdx = headers.indexOf('close');
  const volumeIdx = headers.indexOf('volume');

  if (dateIdx === -1 || openIdx === -1 || highIdx === -1 || lowIdx === -1 || closeIdx === -1) {
    throw new Error('CSV Format Error: Required columns (date, open, high, low, close) are missing.');
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
      continue; // skip malformed row
    }

    list.push({ date, open, high, low, close, volume });
  }

  if (list.length === 0) {
    throw new Error('CSV Format Error: No valid data rows could be parsed.');
  }

  return list.sort((a, b) => a.date.localeCompare(b.date));
}
