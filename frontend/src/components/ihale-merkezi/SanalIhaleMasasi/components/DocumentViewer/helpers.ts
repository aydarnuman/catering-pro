/**
 * DocumentViewer — Defensive data helpers & shared styles
 */

// ─── Defensive Helpers ───────────────────────────────────────

export function getTeknikSartText(item: unknown): string {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    const obj = item as Record<string, unknown>;
    return String(obj.text || obj.madde || obj.aciklama || '');
  }
  return String(item);
}

export function getCezaText(item: unknown): string {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    const obj = item as Record<string, unknown>;
    if (obj.aciklama) return String(obj.aciklama);
    if (obj.text) return String(obj.text);
    const parts: string[] = [];
    if (obj.tur) parts.push(String(obj.tur));
    if (obj.oran) parts.push(String(obj.oran));
    return parts.join(': ') || '';
  }
  return String(item);
}

export function getBelgeInfo(item: unknown): { text: string; zorunlu: boolean } {
  if (typeof item === 'string') return { text: item, zorunlu: true };
  if (item && typeof item === 'object') {
    const obj = item as Record<string, unknown>;
    return {
      text: String(obj.belge || obj.text || obj.name || ''),
      zorunlu: obj.zorunlu !== false,
    };
  }
  return { text: String(item), zorunlu: true };
}

export function getNotText(item: unknown): { text: string; tur?: string } {
  if (typeof item === 'string') return { text: item };
  if (item && typeof item === 'object') {
    const obj = item as Record<string, unknown>;
    return {
      text: String(obj.not || obj.metin || obj.text || ''),
      tur: obj.tur ? String(obj.tur) : undefined,
    };
  }
  return { text: String(item) };
}

export function isOgunTable(item: unknown): item is { rows: string[][]; headers: string[] } {
  if (item && typeof item === 'object') {
    const obj = item as Record<string, unknown>;
    return Array.isArray(obj.rows) && Array.isArray(obj.headers);
  }
  return false;
}

export function isMaliKriterValid(val: unknown): val is string {
  return typeof val === 'string' && val.length > 0 && val.toLowerCase() !== 'belirtilmemiş' && val !== '-';
}

// ─── Shared Table Styles ────────────────────────────────────

export const DARK_TABLE_STYLES = {
  table: { borderColor: 'rgba(255,255,255,0.06)' },
  th: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    padding: '6px 10px',
    background: 'rgba(255,255,255,0.02)',
  },
  td: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    padding: '5px 10px',
  },
} as const;
