/**
 * normalizeAnalysis.ts
 *
 * AI analiz verisini UI'da render etmeden önce temizler, normalize eder ve doğrular.
 * Bu katman, AI pipeline'ından gelen değişken/güvenilmez verileri savunmacı şekilde işler.
 *
 * Kullanım: OzetTabPanel.tsx içinde useMemo ile sarılır.
 */

import type {
  AnalysisData,
  BirimFiyat,
  GramajGrubu,
  GramajMalzeme,
  OgunBilgisi,
  PersonelDetay,
  ServisSaatleri,
} from '../types';

// ─── İçerik Tipi Tespiti ────────────────────────────────────────

export type ContentType = 'list' | 'table' | 'text';

/**
 * Bir string değerin içerik tipini tespit eder.
 * - Virgül/satır sonu/noktalı virgül ile ayrılmış -> 'list'
 * - Tablo yapısı (başlık + tab/pipe ayrımlı satırlar) -> 'table'
 * - Kısa düz metin -> 'text'
 */
export function detectContentType(value: string): ContentType {
  if (!value || typeof value !== 'string') return 'text';
  const trimmed = value.trim();

  // Kısa değerler her zaman text
  if (trimmed.length < 50) return 'text';

  // Tablo tespiti: tab veya pipe ile ayrılmış satırlar
  const lines = trimmed.split(/\n/).filter((l) => l.trim());
  if (lines.length >= 3) {
    const tabLines = lines.filter((l) => l.includes('\t') || l.includes('|'));
    if (tabLines.length >= lines.length * 0.5) return 'table';
  }

  // Liste tespiti: virgül, noktalı virgül veya satır sonu ile ayrılmış öğeler
  const commaCount = (trimmed.match(/,/g) || []).length;
  const semicolonCount = (trimmed.match(/;/g) || []).length;
  const newlineCount = (trimmed.match(/\n/g) || []).length;
  const dashListCount = (trimmed.match(/^\s*[-•●]\s/gm) || []).length;
  const numberedListCount = (trimmed.match(/^\s*\d+[.)]\s/gm) || []).length;

  // Madde işaretli veya numaralı liste
  if (dashListCount >= 3 || numberedListCount >= 3) return 'list';

  // Çok sayıda virgül veya noktalı virgül -> liste
  if (commaCount >= 4 || semicolonCount >= 3) return 'list';

  // Çok satırlı metin -> liste
  if (newlineCount >= 3) return 'list';

  return 'text';
}

/**
 * İçerik tipine göre string'i liste öğelerine ayırır.
 */
export function splitContentToItems(value: string): string[] {
  if (!value || typeof value !== 'string') return [];
  const trimmed = value.trim();

  // Madde işaretli listeler
  if (/^\s*[-•●]\s/m.test(trimmed)) {
    return trimmed
      .split(/\n/)
      .map((l) => l.replace(/^\s*[-•●]\s*/, '').trim())
      .filter((l) => l.length > 0);
  }

  // Numaralı listeler
  if (/^\s*\d+[.)]\s/m.test(trimmed)) {
    return trimmed
      .split(/\n/)
      .map((l) => l.replace(/^\s*\d+[.)]\s*/, '').trim())
      .filter((l) => l.length > 0);
  }

  // Satır bazlı ayırma (çok satırlı)
  const lines = trimmed.split(/\n/).filter((l) => l.trim());
  if (lines.length >= 3) return lines.map((l) => l.trim());

  // Noktalı virgül ile ayırma
  if (trimmed.includes(';')) {
    const items = trimmed.split(/;\s*/).filter((s) => s.trim());
    if (items.length >= 3) return items.map((s) => s.trim());
  }

  // Virgül ile ayırma
  if (trimmed.includes(',')) {
    const items = trimmed.split(/,\s*/).filter((s) => s.trim());
    if (items.length >= 3) return items.map((s) => s.trim());
  }

  return [trimmed];
}

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
    const cleaned = val.replace(/[^\d.,-]/g, '').replace(',', '.');
    const parsed = Number.parseFloat(cleaned);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

// ─── Yemek/Malzeme Anahtar Kelimeleri ───────────────────────────

const FOOD_KEYWORDS = [
  'kebap',
  'kebab',
  'kofte',
  'pilav',
  'corba',
  'salata',
  'makarna',
  'borek',
  'dolma',
  'sarma',
  'kizartma',
  'tatli',
  'komposto',
  'hosaf',
  'cacik',
  'ayran',
  'patates',
  'patlican',
  'domates',
  'biber',
  'sogan',
  'havuc',
  'fasulye',
  'mercimek',
  'bulgur',
  'pirinc',
  'tavuk',
  'kuzu',
  'dana',
  'yogurt',
  'peynir',
  'sut',
  'yumurta',
  'ekmek',
  'simit',
  'mantar',
  'kabak',
  'lahana',
  'ispanak',
  'bamya',
  'bezelye',
  'musakka',
  'karniyarik',
  'guvec',
  'sote',
  'haslama',
  'izgara',
  'firinda',
  'kiymali',
  'etli',
  'tavuklu',
  'sebzeli',
  'rosto',
  'bonfile',
  'sinitzel',
  'fajita',
  'manti',
  'kumpir',
];

function isFoodName(text: string): boolean {
  const norm = normalizeTr(text);
  if (norm.length < 3) return false;
  return FOOD_KEYWORDS.some((kw) => norm.includes(kw));
}

// ─── Servis Saatleri Normalizasyonu ─────────────────────────────

/**
 * Saat formatı kontrolü
 * Geçerli: "07:00", "07:00 - 09:00", "07.00-09.00", "7:00 - 9:00"
 * Geçersiz: "İdarece belirlenecek çizelgesi ile duyurulacaktır"
 */
function isValidTimeFormat(value: string): boolean {
  if (!value || typeof value !== 'string') return false;

  const trimmed = value.trim();

  // Çok uzun metinler saat olamaz (40+ karakter)
  if (trimmed.length > 40) return false;

  // Saat pattern'leri
  const timePatterns = [
    /^\d{1,2}[:.]\d{2}/, // "07:00" veya "07.00" ile başlıyor
    /\d{1,2}[:.]\d{2}\s*[-–]\s*\d{1,2}[:.]\d{2}/, // "07:00 - 09:00" formatı
    /^\d{1,2}\s*[-–]\s*\d{1,2}$/, // "7 - 9" basit format
  ];

  // Herhangi bir saat pattern'ine uyuyorsa geçerli
  if (timePatterns.some((p) => p.test(trimmed))) return true;

  // "İdarece", "belirlenecek", "duyurulacak" gibi kelimeler varsa geçersiz
  // normalizeTr zaten Türkçe karakterleri ASCII'ye çevirir, keyword'ler de normalize edilmiş olmalı
  const invalidKeywords = [
    'idarece',
    'belirlenecek',
    'duyurulacak',
    'bildirilecek',
    'cizelge',
    'program',
    'uygulanacak',
    'idare',
    'mudurluk',
    'mudurlugu',
  ];
  const lowerValue = normalizeTr(trimmed);
  if (invalidKeywords.some((kw) => lowerValue.includes(kw))) return false;

  // Kısa ve sayı içeriyorsa kabul et (örn: "Sabah 7-9")
  if (trimmed.length <= 25 && /\d/.test(trimmed)) return true;

  // Diğer durumlar - 20 karakterden kısa ise kabul et
  return trimmed.length <= 20;
}

function normalizeServisSaatleri(saatler?: ServisSaatleri): ServisSaatleri | undefined {
  if (!saatler || typeof saatler !== 'object') return undefined;

  const result: ServisSaatleri = {};
  let hasValidEntry = false;

  for (const [key, value] of Object.entries(saatler)) {
    if (typeof value === 'string' && value.trim() && isValidTimeFormat(value)) {
      result[key] = value.trim();
      hasValidEntry = true;
    }
  }

  return hasValidEntry ? result : undefined;
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

// ─── Gramaj Tablosu Tespiti ─────────────────────────────────────

/** Gramaj tablosu anahtar kelimeleri */
const GRAMAJ_KEYWORDS = ['gramaj', 'malzeme', 'gr', 'gram', 'miktar', 'porsiyon', 'besin'];

/** Öğün tablosu anahtar kelimeleri */
const OGUN_TABLE_KEYWORDS = [
  'öğün',
  'ogun',
  'kahvaltı',
  'kahvalti',
  'öğle',
  'ogle',
  'akşam',
  'aksam',
  'kişi',
  'kisi',
  'adet',
  'tarih',
  'gün',
  'gun',
];

/**
 * Bir tablonun gramaj tablosu olup olmadığını tespit et
 * Başlıklara ve içeriğe bakarak karar verir
 */
function isGramajTable(headers: string[], rows: unknown[][]): boolean {
  const allHeaders = headers.join(' ').toLowerCase();
  const normalizedHeaders = normalizeTr(allHeaders);

  // Gramaj keyword'leri kontrol et
  const hasGramajKeyword = GRAMAJ_KEYWORDS.some((kw) => normalizedHeaders.includes(kw));

  // Öğün keyword'leri kontrol et (bunlar varsa gramaj değil)
  const hasOgunKeyword = OGUN_TABLE_KEYWORDS.some((kw) => normalizedHeaders.includes(kw));

  // Eğer açıkça öğün tablosuysa, gramaj değil
  if (hasOgunKeyword && !hasGramajKeyword) return false;

  // Eğer gramaj keyword'ü varsa, gramaj tablosudur
  if (hasGramajKeyword) return true;

  // Header'da "gr" veya "g" sütunu varsa gramaj olabilir
  if (headers.some((h) => /^(gr|g|gram)$/i.test(h.trim()))) return true;

  // İçeriğe bak - yemek/malzeme isimleri ve sayısal gramaj değerleri var mı?
  let foodItemCount = 0;
  let numericValueCount = 0;

  for (const row of rows.slice(0, 10)) {
    // İlk 10 satıra bak
    if (!Array.isArray(row) || row.length < 2) continue;

    const firstCol = String(row[0] || '').trim();
    const secondCol = String(row[1] || '').trim();

    // İlk sütun yemek/malzeme ismi mi?
    if (isFoodName(firstCol) || firstCol.length > 3) {
      foodItemCount++;
    }

    // İkinci sütun sayısal değer mi (gramaj)?
    if (/^\d+([.,]\d+)?$/.test(secondCol.replace(/\s/g, ''))) {
      numericValueCount++;
    }
  }

  // Çoğu satırda yemek ismi + sayısal değer varsa gramaj tablosudur
  const totalRows = Math.min(rows.length, 10);
  if (totalRows > 0 && foodItemCount >= totalRows * 0.5 && numericValueCount >= totalRows * 0.5) {
    return true;
  }

  return false;
}

/**
 * Gramaj tablosunu GramajGrubu formatına dönüştür
 */
function convertToGramajGrubu(tablo: OgunBilgisi): GramajGrubu | null {
  const headers = tablo.headers || [];
  const rows = tablo.rows || [];

  if (rows.length === 0) return null;

  const malzemeler: GramajMalzeme[] = [];
  let toplamGramaj: number | null = null;
  let yemekAdi = 'Bilinmeyen Yemek';

  // Header'dan yemek adını bulmaya çalış
  for (const h of headers) {
    const hStr = String(h || '').trim();
    // "Yemek Adı: X" formatı
    if (hStr.includes(':')) {
      const parts = hStr.split(':');
      if (parts.length > 1 && parts[1].trim()) {
        yemekAdi = parts[1].trim();
        break;
      }
    }
  }

  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 2) continue;

    const itemName = String(row[0] || '').trim();
    const weightStr = String(row[1] || '').trim();

    // Başlık satırları atla
    if (/^(malzeme|item|ürün|urun)$/i.test(itemName)) continue;

    // Toplam satırı
    if (/^toplam$/i.test(itemName)) {
      toplamGramaj = toNumber(weightStr);
      continue;
    }

    if (!itemName || itemName.length < 2) continue;

    const weight = toNumber(weightStr);
    const unit = row[2] ? String(row[2]).trim() : 'g';

    malzemeler.push({
      item: itemName,
      weight: weight > 0 ? weight : null,
      unit: unit || 'g',
    });
  }

  if (malzemeler.length === 0) return null;

  return {
    yemek_adi: yemekAdi,
    malzemeler,
    toplam_gramaj: toplamGramaj,
  };
}

// ─── Öğün ve Gramaj Ayırma ──────────────────────────────────────

interface NormalizedOgunResult {
  ogunler: OgunBilgisi[];
  gramajGruplari: GramajGrubu[];
}

function normalizeOgunlerAndExtractGramaj(ogunler?: OgunBilgisi[]): NormalizedOgunResult {
  if (!ogunler || !Array.isArray(ogunler)) {
    return { ogunler: [], gramajGruplari: [] };
  }

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
      if (miktar > existingMiktar) {
        ogunMap.set(turNorm, { ...ogun, miktar });
      }
    } else {
      ogunMap.set(turNorm, { ...ogun, miktar });
    }
  }

  // Tablo öğünlerini ayır: gramaj vs öğün
  const normalOgunTablolari: OgunBilgisi[] = [];
  const gramajGruplari: GramajGrubu[] = [];

  for (const tablo of tabloOgunler) {
    const headers = tablo.headers || [];
    const rows = tablo.rows || [];

    if (isGramajTable(headers, rows)) {
      // Gramaj tablosu - dönüştür
      const gramajGrubu = convertToGramajGrubu(tablo);
      if (gramajGrubu) {
        gramajGruplari.push(gramajGrubu);
      }
    } else {
      // Normal öğün tablosu
      normalOgunTablolari.push(tablo);
    }
  }

  return {
    ogunler: [...ogunMap.values(), ...normalOgunTablolari],
    gramajGruplari,
  };
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

// ─── Önemli Notlar Deduplication ────────────────────────────────

type OnemliNotInput = { not: string; tur?: 'bilgi' | 'uyari' | 'gereklilik' } | string;
type OnemliNotOutput = { not: string; tur: 'bilgi' | 'uyari' | 'gereklilik' } | string;

/**
 * Önemli notları deduplicate eder.
 * - Tamamen aynı notları birleştirir
 * - Prefix eşleşmesi ile benzer notları birleştirir (ilk 60 karakter aynıysa)
 * - Çok kısa notları (< 10 karakter) atar
 * - Sonuç olarak ~30-40 civarına düşürmeyi hedefler
 */
export function normalizeOnemliNotlar(notlar?: OnemliNotInput[]): OnemliNotOutput[] {
  if (!notlar || !Array.isArray(notlar) || notlar.length === 0) return [];

  // Normalize helper
  const getNotText = (n: OnemliNotInput): string => (typeof n === 'string' ? n : n.not || '');
  const getNotTur = (n: OnemliNotInput): 'bilgi' | 'uyari' | 'gereklilik' =>
    typeof n === 'object' && n.tur ? n.tur : 'bilgi';

  // Çıktıyı OnemliNotOutput'a dönüştür (tur kesinlikle tanımlı)
  const toOutput = (n: OnemliNotInput): OnemliNotOutput => {
    if (typeof n === 'string') return n;
    return { not: n.not, tur: n.tur || 'bilgi' };
  };

  // 1. Boş ve çok kısa notları at
  const validNotes = notlar.filter((n) => {
    const text = getNotText(n).trim();
    return text.length >= 10;
  });

  // 2. Exact duplicate temizle (normalize edilmiş metne göre)
  const seen = new Map<string, OnemliNotInput>();
  for (const note of validNotes) {
    const text = normalizeTr(getNotText(note));
    if (!seen.has(text)) {
      seen.set(text, note);
    } else {
      // Daha yüksek öncelikli türü tut (uyari > gereklilik > bilgi)
      const existing = seen.get(text);
      if (existing) {
        const existingTur = getNotTur(existing);
        const newTur = getNotTur(note);
        const priority = { uyari: 3, gereklilik: 2, bilgi: 1 };
        if ((priority[newTur] || 0) > (priority[existingTur] || 0)) {
          seen.set(text, note);
        }
      }
    }
  }

  // 3. Prefix eşleşmesi ile benzer notları birleştir
  const uniqueNotes = [...seen.values()];
  const merged: OnemliNotOutput[] = [];
  const usedIndices = new Set<number>();

  for (let i = 0; i < uniqueNotes.length; i++) {
    if (usedIndices.has(i)) continue;

    const textI = getNotText(uniqueNotes[i]).trim();
    const prefixI = normalizeTr(textI).substring(0, 60);
    let longestNote = uniqueNotes[i];
    let longestLen = textI.length;

    for (let j = i + 1; j < uniqueNotes.length; j++) {
      if (usedIndices.has(j)) continue;

      const textJ = getNotText(uniqueNotes[j]).trim();
      const prefixJ = normalizeTr(textJ).substring(0, 60);

      // Prefix eşleşmesi (en az 60 karakter uzunlukta ortak prefix)
      if (prefixI.length >= 50 && prefixJ.length >= 50 && prefixI === prefixJ) {
        usedIndices.add(j);
        // En uzun versiyonu tut
        if (textJ.length > longestLen) {
          longestNote = uniqueNotes[j];
          longestLen = textJ.length;
        }
      }
    }

    usedIndices.add(i);
    merged.push(toOutput(longestNote));
  }

  return merged;
}

// ─── Ana Normalize Fonksiyonu ───────────────────────────────────

/**
 * AI analiz verisini render öncesi normalize eder.
 * Orijinal veriyi değiştirmez, yeni bir kopya döner.
 *
 * Önemli: Öğün bilgilerindeki gramaj tablolarını tespit edip gramaj_gruplari'na taşır.
 */
export function normalizeAnalysisData(raw?: AnalysisData): AnalysisData | undefined {
  if (!raw) return undefined;

  // Sayısal alanları normalize et
  const result = normalizeNumericFields({ ...raw });

  // Yapısal alanları normalize et
  result.personel_detaylari = normalizePersonel(result.personel_detaylari);
  result.is_yerleri = normalizeIsYerleri(result.is_yerleri);
  result.birim_fiyatlar = normalizeBirimFiyatlar(result.birim_fiyatlar);
  result.servis_saatleri = normalizeServisSaatleri(result.servis_saatleri);
  result.onemli_notlar = normalizeOnemliNotlar(result.onemli_notlar);

  // Öğün bilgilerini normalize et VE gramaj tablolarını ayır
  const { ogunler, gramajGruplari } = normalizeOgunlerAndExtractGramaj(result.ogun_bilgileri);
  result.ogun_bilgileri = ogunler;

  // Gramaj gruplarını birleştir (mevcut + yeni tespit edilenler)
  const existingGramaj = result.gramaj_gruplari || [];
  const allGramaj = [...existingGramaj, ...gramajGruplari];

  // Duplicate'leri temizle (yemek adına göre)
  const gramajMap = new Map<string, GramajGrubu>();
  for (const g of allGramaj) {
    const key = normalizeTr(g.yemek_adi);
    if (!gramajMap.has(key) || (g.malzemeler?.length || 0) > (gramajMap.get(key)?.malzemeler?.length || 0)) {
      gramajMap.set(key, g);
    }
  }
  result.gramaj_gruplari = [...gramajMap.values()];

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
