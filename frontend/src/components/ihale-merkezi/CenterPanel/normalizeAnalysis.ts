/**
 * normalizeAnalysis.ts
 *
 * AI analiz verisini UI'da render etmeden önce temizler, normalize eder ve doğrular.
 * Bu katman, AI pipeline'ından gelen değişken/güvenilmez verileri savunmacı şekilde işler.
 *
 * Kullanım: OzetTabPanel.tsx içinde useMemo ile sarılır.
 */

import type { AnalysisData, BirimFiyat, OgunBilgisi, PersonelDetay } from '../types';

// ─── Yardımcı Fonksiyonlar ──────────────────────────────────────

/** Türkçe normalize - karşılaştırma için */
function normalizeTr(text: string): string {
  return (text || '')
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Değeri güvenli şekilde number'a çevir */
function toNumber(val: unknown): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[^\d.,\-]/g, '').replace(',', '.');
    const parsed = Number.parseFloat(cleaned);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

// ─── Yemek/Malzeme Anahtar Kelimeleri ───────────────────────────

const FOOD_KEYWORDS = [
  'kebap', 'kebab', 'kofte', 'pilav', 'corba', 'salata', 'makarna', 'borek',
  'dolma', 'sarma', 'kizartma', 'tatli', 'komposto', 'hosaf', 'cacik', 'ayran',
  'patates', 'patlican', 'domates', 'biber', 'sogan', 'havuc', 'fasulye',
  'mercimek', 'bulgur', 'pirinc', 'tavuk', 'kuzu', 'dana',
  'yogurt', 'peynir', 'sut', 'yumurta', 'ekmek', 'simit',
  'mantar', 'kabak', 'lahana', 'ispanak', 'bamya', 'bezelye',
  'musakka', 'karniyarik', 'guvec', 'sote', 'haslama', 'izgara',
  'firinda', 'kiymali', 'etli', 'tavuklu', 'sebzeli',
  'rosto', 'bonfile', 'sinitzel', 'fajita', 'manti', 'kumpir',
];

function isFoodName(text: string): boolean {
  const norm = normalizeTr(text);
  if (norm.length < 3) return false;
  return FOOD_KEYWORDS.some((kw) => norm.includes(kw));
}

// ─── Personel Normalizasyonu ────────────────────────────────────

function normalizePersonel(personel?: PersonelDetay[]): PersonelDetay[] {
  if (!personel || !Array.isArray(personel)) return [];

  return personel
    .filter((p) => {
      const poz = (p.pozisyon || '').trim();
      if (!poz) return false;
      // Sadece sayı olan pozisyonları at (AI satır numarası çıkarmış)
      if (/^\d+$/.test(poz)) return false;
      // 2 karakter veya daha kısa
      if (poz.length <= 2) return false;
      // TOPLAM satırı
      if (normalizeTr(poz) === 'toplam') return false;
      return true;
    })
    .map((p) => ({
      ...p,
      adet: typeof p.adet === 'number' ? p.adet : toNumber(p.adet),
    }));
}

// ─── İş Yerleri Normalizasyonu ──────────────────────────────────

function normalizeIsYerleri(yerler?: string[]): string[] {
  if (!yerler || !Array.isArray(yerler)) return [];

  return yerler.filter((yer) => {
    const yerStr = typeof yer === 'string' ? yer : '';
    if (yerStr.trim().length < 3) return false;
    if (/^\d+$/.test(yerStr.trim())) return false;
    if (isFoodName(yerStr)) return false;
    return true;
  });
}

// ─── Öğün Bilgileri Normalizasyonu ──────────────────────────────

function normalizeOgunler(ogunler?: OgunBilgisi[]): OgunBilgisi[] {
  if (!ogunler || !Array.isArray(ogunler)) return [];

  const flatOgunler = ogunler.filter((o) => o.tur && !o.rows);
  const tabloOgunler = ogunler.filter((o) => o.rows && o.headers);

  // Flat öğünleri tür bazında deduplicate et
  const ogunMap = new Map<string, OgunBilgisi>();
  for (const ogun of flatOgunler) {
    const turNorm = normalizeTr(ogun.tur || '');
    const miktar = toNumber(ogun.miktar);

    if (ogunMap.has(turNorm)) {
      const existing = ogunMap.get(turNorm);
      const existingMiktar = toNumber(existing?.miktar);
      // Daha büyük miktarı tercih et
      if (miktar > existingMiktar) {
        ogunMap.set(turNorm, { ...ogun, miktar });
      }
    } else {
      ogunMap.set(turNorm, { ...ogun, miktar });
    }
  }

  return [...ogunMap.values(), ...tabloOgunler];
}

// ─── Birim Fiyatlar Normalizasyonu ──────────────────────────────

function normalizeBirimFiyatlar(fiyatlar?: BirimFiyat[]): BirimFiyat[] {
  if (!fiyatlar || !Array.isArray(fiyatlar)) return [];

  return fiyatlar.map((bf) => ({
    ...bf,
    miktar: bf.miktar != null ? toNumber(bf.miktar) : undefined,
    fiyat: bf.fiyat != null ? toNumber(bf.fiyat) : undefined,
    tutar: bf.tutar != null ? toNumber(bf.tutar) : undefined,
  }));
}

// ─── Sayısal Alanların Normalizasyonu ───────────────────────────

function normalizeNumericFields(data: AnalysisData): AnalysisData {
  const numericFields = [
    'kahvalti_kisi_sayisi',
    'ogle_kisi_sayisi',
    'aksam_kisi_sayisi',
    'diyet_kisi_sayisi',
    'hizmet_gun_sayisi',
    'gunluk_ogun_sayisi',
    'kisi_sayisi',
    'toplam_ogun_sayisi',
    'toplam_personel',
    'personel_sayisi',
  ] as const;

  const result = { ...data };
  for (const field of numericFields) {
    const val = result[field];
    if (val != null && val !== '' && val !== 'Belirtilmemiş') {
      (result as Record<string, unknown>)[field] = toNumber(val);
    }
  }
  return result;
}

// ─── Ana Normalize Fonksiyonu ───────────────────────────────────

/**
 * AI analiz verisini render öncesi normalize eder.
 * Orijinal veriyi değiştirmez, yeni bir kopya döner.
 */
export function normalizeAnalysisData(raw?: AnalysisData): AnalysisData | undefined {
  if (!raw) return undefined;

  // Sayısal alanları normalize et
  const result = normalizeNumericFields({ ...raw });

  // Yapısal alanları normalize et
  result.personel_detaylari = normalizePersonel(result.personel_detaylari);
  result.is_yerleri = normalizeIsYerleri(result.is_yerleri);
  result.ogun_bilgileri = normalizeOgunler(result.ogun_bilgileri);
  result.birim_fiyatlar = normalizeBirimFiyatlar(result.birim_fiyatlar);

  // toplam_ogun_sayisi hesapla (yoksa flat öğünlerden)
  if (!result.toplam_ogun_sayisi && result.ogun_bilgileri) {
    const flatOgunler = result.ogun_bilgileri.filter((o) => o.tur && !o.rows);
    const gercekOgunler = flatOgunler.filter((o) => toNumber(o.miktar) > 100);
    if (gercekOgunler.length > 0) {
      result.toplam_ogun_sayisi = gercekOgunler.reduce((sum, o) => sum + toNumber(o.miktar), 0);
    }
  }

  return result;
}
