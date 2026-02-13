/**
 * Takip Defteri - Helper functions
 */

import type { AggFunc, ColumnType, TrackerColumn, TrackerRow, TrackerSheet } from './types';

// ─── Unique ID ───
let _uidCounter = 0;
export function uid(): string {
  _uidCounter += 1;
  return `${Date.now()}-${_uidCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Create a column with a fresh unique ID */
export function mkCol(name: string, type: ColumnType = 'text', options?: string[]): TrackerColumn {
  return {
    id: uid(),
    name,
    type,
    ...(options ? { options } : {}),
    ...(type === 'number' ? { aggFunc: 'sum' as AggFunc } : {}),
  };
}

/** Format number for display (Turkish locale) */
export function fmtNum(v: number, decimals = 2): string {
  return v.toLocaleString('tr-TR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// ─── Aggregation ───
export function computeAgg(rows: TrackerRow[], colId: string, func: AggFunc): number {
  const vals = rows.map((r) => r.cells[colId]).filter((v): v is number => typeof v === 'number');
  if (vals.length === 0) return 0;
  switch (func) {
    case 'sum':
      return vals.reduce((a, b) => a + b, 0);
    case 'avg':
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    case 'min':
      return Math.min(...vals);
    case 'max':
      return Math.max(...vals);
    default:
      return 0;
  }
}

/** Get max value in a number column (for bar chart scaling) */
export function getColumnMax(rows: TrackerRow[], colId: string): number {
  const vals = rows.map((r) => r.cells[colId]).filter((v): v is number => typeof v === 'number');
  return vals.length > 0 ? Math.max(...vals) : 0;
}

// ─── CSV Export ───
export function exportCSV(sheet: TrackerSheet) {
  const header = sheet.columns.map((c) => `"${c.name}"`).join(',');
  const rows = sheet.rows.map((r) =>
    sheet.columns
      .map((c) => {
        const v = r.cells[c.id] ?? '';
        return typeof v === 'number' ? v : `"${String(v).replace(/"/g, '""')}"`;
      })
      .join(',')
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sheet.name.replace(/[^a-zA-Z0-9_\u00C0-\u024F-]/g, '_')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── CSV Import ───
export interface CSVParseResult {
  columns: TrackerColumn[];
  rows: TrackerRow[];
}

/** Parse CSV string, auto-detect column types */
export function importCSV(csvText: string): CSVParseResult {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { columns: [], rows: [] };

  // Parse header
  const headerCells = parseCsvLine(lines[0]);
  const columns: TrackerColumn[] = headerCells.map((name) => mkCol(name.trim() || 'Kolon'));

  // Parse data rows
  const dataLines = lines.slice(1);
  const rawRows: string[][] = dataLines.map((line) => parseCsvLine(line));

  // Auto-detect column types based on data
  for (let colIdx = 0; colIdx < columns.length; colIdx++) {
    const values = rawRows.map((r) => r[colIdx] ?? '').filter((v) => v.trim());
    if (values.length === 0) continue;

    const allNumbers = values.every((v) => !Number.isNaN(Number(v.replace(',', '.'))));
    const allDates = values.every((v) => /^\d{4}[-/]\d{2}[-/]\d{2}/.test(v) || /^\d{2}[-/.]\d{2}[-/.]\d{4}/.test(v));

    if (allNumbers) {
      columns[colIdx].type = 'number';
      columns[colIdx].aggFunc = 'sum';
    } else if (allDates) {
      columns[colIdx].type = 'date';
    }
    // Check if it could be a select (few unique values)
    const unique = new Set(values);
    if (!allNumbers && !allDates && unique.size <= 6 && unique.size < values.length * 0.5) {
      columns[colIdx].type = 'select';
      columns[colIdx].options = Array.from(unique);
    }
  }

  // Build rows with correct types
  const rows: TrackerRow[] = rawRows.map((rawCells) => {
    const cells: Record<string, string | number> = {};
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      const raw = rawCells[i]?.trim() ?? '';
      if (col.type === 'number') {
        cells[col.id] = Number(raw.replace(',', '.')) || 0;
      } else {
        cells[col.id] = raw;
      }
    }
    return { id: uid(), cells };
  });

  return { columns, rows };
}

/** Simple CSV line parser (handles quoted fields) */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',' || ch === ';') {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}
