/**
 * Türkçe format validasyonu
 * TC kimlik, vergi no, telefon, IBAN, tarih vb. format kontrolleri
 */

export type ValidationResult = { valid: boolean; message?: string };

/** TC Kimlik No: 11 rakam, ilk hane 0 olamaz, son hane kontrol algoritması */
export function validateTcKimlik(value: string | null | undefined): ValidationResult {
  if (!value || typeof value !== 'string') {
    return { valid: false, message: 'TC kimlik numarası giriniz' };
  }
  const v = value.replace(/\s/g, '');
  if (!/^\d{11}$/.test(v)) {
    return { valid: false, message: 'TC kimlik 11 rakam olmalıdır' };
  }
  if (v[0] === '0') {
    return { valid: false, message: 'TC kimlik 0 ile başlayamaz' };
  }
  // Basit çift/tek hane kontrolü (tam algoritma istersen genişletilebilir)
  const odds = Number(v[0]) + Number(v[2]) + Number(v[4]) + Number(v[6]) + Number(v[8]);
  const evens = Number(v[1]) + Number(v[3]) + Number(v[5]) + Number(v[7]);
  const h10 = (odds * 7 - evens) % 10;
  if (h10 < 0 && h10 + 10 !== Number(v[9])) {
    return { valid: false, message: 'Geçersiz TC kimlik numarası' };
  }
  if (h10 >= 0 && h10 !== Number(v[9])) {
    return { valid: false, message: 'Geçersiz TC kimlik numarası' };
  }
  const first10 = v
    .slice(0, 10)
    .split('')
    .reduce((a, b) => a + Number(b), 0);
  const h11 = first10 % 10;
  if (h11 !== Number(v[10])) {
    return { valid: false, message: 'Geçersiz TC kimlik numarası' };
  }
  return { valid: true };
}

/** Vergi/TC VKN: 10 veya 11 rakam */
export function validateVergiNo(value: string | null | undefined): ValidationResult {
  if (!value || typeof value !== 'string') {
    return { valid: false, message: 'Vergi numarası giriniz' };
  }
  const v = value.replace(/\s/g, '');
  if (!/^\d{10}$|^\d{11}$/.test(v)) {
    return { valid: false, message: 'Vergi numarası 10 veya 11 rakam olmalıdır' };
  }
  return { valid: true };
}

/** Türkiye telefon: 05xx xxx xx xx veya +90 5xx xxx xx xx */
export function validateTelefon(value: string | null | undefined): ValidationResult {
  if (!value || typeof value !== 'string') {
    return { valid: true }; // opsiyonel alan
  }
  const v = value.replace(/\s/g, '').replace(/^\+90/, '0');
  if (!/^0?5\d{9}$/.test(v) && !/^0\d{10}$/.test(v)) {
    return { valid: false, message: 'Geçerli bir telefon numarası giriniz (örn: 05xx xxx xx xx)' };
  }
  return { valid: true };
}

/** E-posta */
export function validateEmail(value: string | null | undefined): ValidationResult {
  if (!value || typeof value !== 'string') {
    return { valid: true }; // opsiyonel
  }
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(value.trim())) {
    return { valid: false, message: 'Geçerli bir e-posta adresi giriniz' };
  }
  return { valid: true };
}

/** Türkiye IBAN: TR + 2 rakam + 5 hane + 1 + 16 hane = 26 karakter */
export function validateIban(value: string | null | undefined): ValidationResult {
  if (!value || typeof value !== 'string') {
    return { valid: true }; // opsiyonel
  }
  const v = value.replace(/\s/g, '').toUpperCase();
  if (!/^TR\d{24}$/.test(v)) {
    return { valid: false, message: 'IBAN TR ile başlamalı ve 26 karakter olmalıdır' };
  }
  return { valid: true };
}

/** Tarih: YYYY-MM-DD veya DD.MM.YYYY */
export function validateTarih(value: string | null | undefined): ValidationResult {
  if (!value || typeof value !== 'string') {
    return { valid: false, message: 'Tarih giriniz' };
  }
  const s = value.trim();
  let date: Date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    date = new Date(s);
  } else if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(s)) {
    const [d, m, y] = s.split('.').map(Number);
    date = new Date(y, m - 1, d);
  } else {
    return { valid: false, message: 'Geçerli tarih giriniz (GG.AA.YYYY veya YYYY-AA-GG)' };
  }
  if (Number.isNaN(date.getTime())) {
    return { valid: false, message: 'Geçersiz tarih' };
  }
  return { valid: true };
}

/** Zorunlu metin (boş / sadece boşluk) */
export function validateRequired(value: unknown, label = 'Bu alan'): ValidationResult {
  if (value === null || value === undefined) {
    return { valid: false, message: `${label} zorunludur` };
  }
  if (typeof value === 'string' && !value.trim()) {
    return { valid: false, message: `${label} zorunludur` };
  }
  return { valid: true };
}

/** Sayı aralığı */
export function validateNumberRange(
  value: number | string | null | undefined,
  min?: number,
  max?: number,
  label = 'Değer'
): ValidationResult {
  if (value === null || value === undefined || value === '') {
    return { valid: false, message: `${label} giriniz` };
  }
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(n)) {
    return { valid: false, message: `${label} sayı olmalıdır` };
  }
  if (min != null && n < min) {
    return { valid: false, message: `${label} en az ${min} olmalıdır` };
  }
  if (max != null && n > max) {
    return { valid: false, message: `${label} en fazla ${max} olmalıdır` };
  }
  return { valid: true };
}

/** Para (negatif olmamalı, isteğe bağlı) */
export function validatePara(value: number | string | null | undefined, required = false): ValidationResult {
  if (value === null || value === undefined || value === '') {
    return required ? { valid: false, message: 'Tutar giriniz' } : { valid: true };
  }
  const n = typeof value === 'string' ? parseFloat(String(value).replace(/\./g, '').replace(',', '.')) : Number(value);
  if (Number.isNaN(n)) {
    return { valid: false, message: 'Geçerli bir tutar giriniz' };
  }
  if (n < 0) {
    return { valid: false, message: 'Tutar negatif olamaz' };
  }
  return { valid: true };
}

/** Minimum uzunluk */
export function validateMinLength(value: string | null | undefined, min: number, label = 'Alan'): ValidationResult {
  if (!value || typeof value !== 'string') {
    return { valid: false, message: `${label} en az ${min} karakter olmalıdır` };
  }
  if (value.length < min) {
    return { valid: false, message: `${label} en az ${min} karakter olmalıdır` };
  }
  return { valid: true };
}

/** Birden çok kuralı sırayla uygula, ilk hatada dur */
export function validateAll(value: unknown, ...rules: Array<(v: unknown) => ValidationResult>): ValidationResult {
  for (const rule of rules) {
    const r = rule(value);
    if (!r.valid) return r;
  }
  return { valid: true };
}
