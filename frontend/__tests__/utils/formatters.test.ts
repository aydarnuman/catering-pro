/**
 * Formatter Utility Tests
 */

import { describe, it, expect } from 'vitest';
import { formatMoney, formatDate, formatNumber } from '@/lib/formatters';

describe('formatMoney', () => {
  it('should format positive numbers correctly', () => {
    expect(formatMoney(1234.56)).toBe('₺1.234,56');
  });

  it('should format zero correctly', () => {
    expect(formatMoney(0)).toBe('₺0,00');
  });

  it('should handle undefined/null gracefully', () => {
    expect(formatMoney(undefined as any)).toBe('₺0,00');
    expect(formatMoney(null as any)).toBe('₺0,00');
  });

  it('should format large numbers with thousands separator', () => {
    expect(formatMoney(1234567.89)).toBe('₺1.234.567,89');
  });

  it('should round to 2 decimal places', () => {
    expect(formatMoney(123.456)).toBe('₺123,46');
  });
});

describe('formatDate', () => {
  it('should format date string correctly', () => {
    const result = formatDate('2024-03-15');
    expect(result).toContain('2024');
  });

  it('should handle invalid dates gracefully', () => {
    const result = formatDate('invalid-date');
    expect(result).toBe('-');
  });

  it('should handle null/undefined', () => {
    expect(formatDate(null as any)).toBe('-');
    expect(formatDate(undefined as any)).toBe('-');
  });
});

describe('formatNumber', () => {
  it('should format numbers with Turkish locale', () => {
    expect(formatNumber(1234.5)).toBe('1.234,50');
  });

  it('should handle integers with default 2 decimals', () => {
    expect(formatNumber(1000)).toBe('1.000,00');
  });

  it('should handle zero', () => {
    expect(formatNumber(0)).toBe('0,00');
  });

  it('should respect custom decimal places', () => {
    expect(formatNumber(1234.5678, 0)).toBe('1.235');
    expect(formatNumber(1234.5678, 3)).toBe('1.234,568');
  });
});
