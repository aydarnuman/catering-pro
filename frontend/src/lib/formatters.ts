/**
 * Merkezi Format Fonksiyonları
 * Tüm format işlemleri bu dosyadan yönetilir
 */

/**
 * Para birimi formatla (Türk Lirası)
 * @param value - Formatlanacak değer
 * @param options - Format seçenekleri
 * @returns Formatlanmış para birimi string'i (örn: "₺1.234,56")
 */
export function formatMoney(
  value: number | string | null | undefined,
  options?: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    showSymbol?: boolean;
  }
): string {
  if (value === null || value === undefined || value === '') {
    return '₺0,00';
  }

  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(numValue)) {
    return '₺0,00';
  }

  const {
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    showSymbol = true,
  } = options || {};

  const formatted = new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(numValue);

  return showSymbol ? formatted : formatted.replace('₺', '').trim();
}

/**
 * Tarih formatla
 * @param date - Formatlanacak tarih (Date, string, veya timestamp)
 * @param format - Format tipi ('short' | 'long' | 'datetime' | 'time')
 * @returns Formatlanmış tarih string'i
 */
export function formatDate(
  date: Date | string | number | null | undefined,
  format: 'short' | 'long' | 'datetime' | 'time' = 'short'
): string {
  if (!date) {
    return '-';
  }

  let dateObj: Date;

  if (date instanceof Date) {
    dateObj = date;
  } else if (typeof date === 'string') {
    dateObj = new Date(date);
  } else if (typeof date === 'number') {
    dateObj = new Date(date);
  } else {
    return '-';
  }

  if (isNaN(dateObj.getTime())) {
    return '-';
  }

  switch (format) {
    case 'short':
      return dateObj.toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });

    case 'long':
      return dateObj.toLocaleDateString('tr-TR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

    case 'datetime':
      return dateObj.toLocaleString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

    case 'time':
      return dateObj.toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
      });

    default:
      return dateObj.toLocaleDateString('tr-TR');
  }
}

/**
 * Sayı formatla
 * @param value - Formatlanacak değer
 * @param decimals - Ondalık basamak sayısı
 * @returns Formatlanmış sayı string'i (örn: "1.234,56")
 */
export function formatNumber(
  value: number | string | null | undefined,
  decimals: number = 2
): string {
  if (value === null || value === undefined || value === '') {
    return '0';
  }

  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(numValue)) {
    return '0';
  }

  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(numValue);
}

/**
 * Yüzde formatla
 * @param value - Formatlanacak değer (0-100 arası veya 0-1 arası)
 * @param asDecimal - Değer 0-1 arası mı? (default: false, yani 0-100)
 * @returns Formatlanmış yüzde string'i (örn: "%45,50")
 */
export function formatPercentage(
  value: number | string | null | undefined,
  asDecimal: boolean = false
): string {
  if (value === null || value === undefined || value === '') {
    return '%0,00';
  }

  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(numValue)) {
    return '%0,00';
  }

  const percentage = asDecimal ? numValue * 100 : numValue;

  return `%${formatNumber(percentage, 2)}`;
}

/**
 * Dosya boyutu formatla
 * @param bytes - Byte cinsinden dosya boyutu
 * @returns Formatlanmış dosya boyutu (örn: "1,5 MB")
 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes === 0) {
    return '0 B';
  }

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${formatNumber(bytes / Math.pow(k, i), 2)} ${sizes[i]}`;
}

/**
 * Telefon numarası formatla
 * @param phone - Formatlanacak telefon numarası
 * @returns Formatlanmış telefon numarası (örn: "0 (555) 123 45 67")
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) {
    return '-';
  }

  // Sadece rakamları al
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 10) {
    // 0 (555) 123 45 67 formatı
    return `${digits[0]} (${digits.slice(1, 4)}) ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9)}`;
  } else if (digits.length === 11) {
    // 0 (555) 123 45 67 formatı (11 haneli)
    return `${digits[0]} (${digits.slice(1, 4)}) ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9)}`;
  }

  return phone;
}

/**
 * Vergi numarası formatla
 * @param taxNo - Formatlanacak vergi numarası
 * @returns Formatlanmış vergi numarası (örn: "123 456 7890")
 */
export function formatTaxNumber(taxNo: string | null | undefined): string {
  if (!taxNo) {
    return '-';
  }

  const digits = taxNo.replace(/\D/g, '');

  if (digits.length === 10) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }

  return taxNo;
}
