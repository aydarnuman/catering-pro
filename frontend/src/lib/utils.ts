/**
 * Utility functions for Catering Pro
 */

/**
 * Format money for display
 * @param amount - The amount to format
 * @param compact - If true, uses compact notation (e.g., 1.5M, 250K)
 */
export function formatMoney(amount: number | null | undefined, compact = false): string {
  if (amount === null || amount === undefined) return '₺0';
  
  const absAmount = Math.abs(amount);
  
  if (compact && absAmount >= 1000000) {
    // Millions
    const millions = amount / 1000000;
    return `₺${millions.toFixed(1).replace('.0', '')}M`;
  }
  
  if (compact && absAmount >= 10000) {
    // Thousands (only show K for values 10K+)
    const thousands = amount / 1000;
    return `₺${thousands.toFixed(0)}K`;
  }
  
  // Standard formatting
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format number with compact notation for mobile
 * @param value - The number to format
 */
export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined) return '0';
  
  const absValue = Math.abs(value);
  
  if (absValue >= 1000000000) {
    return `${(value / 1000000000).toFixed(1).replace('.0', '')}B`;
  }
  
  if (absValue >= 1000000) {
    return `${(value / 1000000).toFixed(1).replace('.0', '')}M`;
  }
  
  if (absValue >= 1000) {
    return `${(value / 1000).toFixed(0)}K`;
  }
  
  return value.toLocaleString('tr-TR');
}

/**
 * Format date in Turkish locale
 * @param date - Date string or Date object
 * @param format - 'short' | 'medium' | 'long'
 */
export function formatDate(date: string | Date | null | undefined, format: 'short' | 'medium' | 'long' = 'medium'): string {
  if (!date) return '-';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  
  const options: Intl.DateTimeFormatOptions = {
    short: { day: '2-digit', month: '2-digit' },
    medium: { day: '2-digit', month: '2-digit', year: 'numeric' },
    long: { day: 'numeric', month: 'long', year: 'numeric' },
  }[format];
  
  return d.toLocaleDateString('tr-TR', options);
}

/**
 * Truncate text with ellipsis
 * @param text - The text to truncate
 * @param maxLength - Maximum length before truncation
 */
export function truncateText(text: string | null | undefined, maxLength: number = 30): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
}

/**
 * Get initials from a name
 * @param name - Full name
 */
export function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
