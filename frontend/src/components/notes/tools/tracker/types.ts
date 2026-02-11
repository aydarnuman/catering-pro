/**
 * Takip Defteri - Type definitions
 */

export type ColumnType = 'text' | 'number' | 'date' | 'select';
export type AggFunc = 'sum' | 'avg' | 'min' | 'max';

export interface TrackerColumn {
  id: string;
  name: string;
  type: ColumnType;
  options?: string[];  // for select type
  aggFunc?: AggFunc;   // for number type
}

export interface TrackerRow {
  id: string;
  cells: Record<string, string | number>;
}

export interface TrackerSheet {
  id: string;
  name: string;
  color: string;
  columns: TrackerColumn[];
  rows: TrackerRow[];
  createdAt: string;
  updatedAt: string;
}

export const AGG_LABELS: Record<AggFunc, string> = {
  sum: 'Toplam',
  avg: 'Ortalama',
  min: 'Min',
  max: 'Max',
};

export const SHEET_COLORS = [
  'red', 'orange', 'yellow', 'teal', 'green', 'cyan', 'blue', 'violet', 'grape', 'pink', 'gray',
] as const;

/** Color mapping for select options: index -> mantine color */
export const SELECT_OPTION_COLORS: Record<number, string> = {
  0: 'green',
  1: 'orange',
  2: 'red',
  3: 'blue',
  4: 'violet',
  5: 'cyan',
  6: 'pink',
  7: 'grape',
  8: 'teal',
  9: 'yellow',
};
