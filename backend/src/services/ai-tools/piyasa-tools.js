/**
 * Piyasa Fiyat Araştırma Tools v2
 * Akıllı çoklu arama + DB varyant sistemi entegrasyonu
 */

import { query } from '../../database.js';
import logger from '../../utils/logger.js';
import claudeAI from '../claude-ai.js';
import { searchHalPrices } from '../hal-scraper.js';
import { parseProductName, searchMarketPrices } from '../market-scraper.js';
import { savePiyasaFiyatlar } from '../piyasa-fiyat-writer.js';
import { isTavilyConfigured, tavilyPiyasaAra } from '../tavily-service.js';

// ─── ÜRÜN KATEGORİLERİ (SADECE ÖNERİ İÇİN) ────────────

const PRODUCT_CATEGORIES = {
  makarna: {
    kategori: 'Makarna',
    oneriler: ['spagetti makarna 500g', 'burgu makarna 500g', 'penne makarna 500g', 'erişte 500g'],
    mesaj: 'Makarna türünü ve gramajını belirtin',
  },
  pirinç: {
    kategori: 'Pirinç',
    oneriler: ['baldo pirinç 1kg', 'osmancık pirinç 1kg', 'basmati pirinç 1kg'],
    mesaj: 'Pirinç çeşidini ve miktarını belirtin',
  },
  yağ: {
    kategori: 'Yağ',
    oneriler: ['ayçiçek yağı 5lt', 'zeytinyağı 1lt', 'mısır yağı 5lt', 'tereyağı 500g'],
    mesaj: 'Yağ türünü ve miktarını belirtin',
  },
  et: {
    kategori: 'Et',
    oneriler: ['dana kıyma 1kg', 'kuzu pirzola 1kg', 'dana but 1kg', 'kuzu kuşbaşı 1kg'],
    mesaj: 'Et türünü belirtin',
  },
  tavuk: {
    kategori: 'Tavuk',
    oneriler: ['tavuk but 1kg', 'tavuk göğüs 1kg', 'bütün tavuk 1kg'],
    mesaj: 'Tavuk parçasını belirtin',
  },
  süt: {
    kategori: 'Süt Ürünleri',
    oneriler: ['günlük süt 1lt', 'uht süt 1lt', 'yoğurt 1kg', 'beyaz peynir 1kg'],
    mesaj: 'Süt ürünü türünü belirtin',
  },
  sebze: {
    kategori: 'Sebze',
    oneriler: ['domates 1kg', 'biber 1kg', 'soğan 1kg', 'patates 1kg'],
    mesaj: 'Sebze türünü belirtin',
  },
  meyve: {
    kategori: 'Meyve',
    oneriler: ['elma 1kg', 'portakal 1kg', 'muz 1kg', 'üzüm 1kg'],
    mesaj: 'Meyve türünü belirtin',
  },
  un: {
    kategori: 'Un',
    oneriler: ['buğday unu 5kg', 'tam buğday unu 2kg', 'ekmeklik un 5kg'],
    mesaj: 'Un türünü belirtin',
  },
  şeker: {
    kategori: 'Şeker',
    oneriler: ['toz şeker 5kg', 'küp şeker 1kg', 'esmer şeker 1kg'],
    mesaj: 'Şeker türünü belirtin',
  },
  fasulye: { kategori: 'Bakliyat', oneriler: ['kuru fasulye 1kg', 'barbunya 1kg'], mesaj: 'Fasulye çeşidini belirtin' },
  'kuru fasulye': {
    kategori: 'Bakliyat',
    oneriler: ['kuru fasulye dermason 1kg', 'kuru fasulye şeker 1kg'],
    mesaj: 'Fasulye çeşidini belirtin',
  },
  nohut: { kategori: 'Bakliyat', oneriler: ['nohut 1kg', 'nohut koçbaşı 1kg'], mesaj: 'Nohut çeşidini belirtin' },
  mercimek: {
    kategori: 'Bakliyat',
    oneriler: ['kırmızı mercimek 1kg', 'yeşil mercimek 1kg'],
    mesaj: 'Mercimek rengini belirtin',
  },
  bulgur: {
    kategori: 'Bakliyat',
    oneriler: ['pilavlık bulgur 1kg', 'köftelik bulgur 1kg'],
    mesaj: 'Bulgur türünü belirtin',
  },
  peynir: {
    kategori: 'Süt Ürünleri',
    oneriler: ['beyaz peynir 1kg', 'kaşar peynir 500g'],
    mesaj: 'Peynir türünü belirtin',
  },
  yoğurt: { kategori: 'Süt Ürünleri', oneriler: ['yoğurt 1kg', 'süzme yoğurt 1kg'], mesaj: 'Yoğurt türünü belirtin' },
  salça: {
    kategori: 'Konserve',
    oneriler: ['domates salçası 700g', 'biber salçası 700g'],
    mesaj: 'Salça türünü belirtin',
  },
  zeytinyağı: {
    kategori: 'Yağ',
    oneriler: ['sızma zeytinyağı 1lt', 'riviera zeytinyağı 1lt'],
    mesaj: 'Zeytinyağı türünü belirtin',
  },
  tereyağı: { kategori: 'Yağ', oneriler: ['tereyağı 500g', 'tereyağı 250g'], mesaj: 'Tereyağı miktarını belirtin' },
  kıyma: { kategori: 'Et', oneriler: ['dana kıyma 1kg', 'kuzu kıyma 1kg'], mesaj: 'Kıyma türünü belirtin' },
  balık: { kategori: 'Balık', oneriler: ['levrek 1kg', 'çipura 1kg', 'somon 1kg'], mesaj: 'Balık türünü belirtin' },
  tuz: { kategori: 'Baharat', oneriler: ['sofra tuzu 1kg', 'deniz tuzu 500g'], mesaj: 'Tuz türünü belirtin' },
};

// ─── BİRİM TESPİT TABLOSU ──────────────────────────────

const UNIT_MAP = {
  // Litre
  süt: 'lt',
  ayran: 'lt',
  su: 'lt',
  içecek: 'lt',
  'meyve suyu': 'lt',
  kola: 'lt',
  gazoz: 'lt',
  soda: 'lt',
  şalgam: 'lt',
  limonata: 'lt',
  zeytinyağı: 'lt',
  'sızma zeytinyağı': 'lt',
  'ayçiçek yağı': 'lt',
  'mısır yağı': 'lt',
  'fındık yağı': 'lt',
  'sıvı yağ': 'lt',
  // Adet
  yumurta: 'adet',
  ekmek: 'adet',
  pide: 'adet',
  simit: 'adet',
  // Kg (default çoğu gıda)
  et: 'kg',
  kıyma: 'kg',
  tavuk: 'kg',
  balık: 'kg',
  dana: 'kg',
  kuzu: 'kg',
  pirinç: 'kg',
  bulgur: 'kg',
  makarna: 'kg',
  un: 'kg',
  şeker: 'kg',
  tuz: 'kg',
  nohut: 'kg',
  mercimek: 'kg',
  fasulye: 'kg',
  barbunya: 'kg',
  yoğurt: 'kg',
  peynir: 'kg',
  tereyağı: 'kg',
  margarin: 'kg',
  domates: 'kg',
  biber: 'kg',
  soğan: 'kg',
  patates: 'kg',
  havuç: 'kg',
  salatalık: 'kg',
  patlıcan: 'kg',
  kabak: 'kg',
  ıspanak: 'kg',
  maydanoz: 'kg',
  salça: 'kg',
  bal: 'kg',
  reçel: 'kg',
  zeytin: 'kg',
  ceviz: 'kg',
  fındık: 'kg',
  badem: 'kg',
  'antep fıstığı': 'kg',
};

// ─── AKILLI ÜRÜN NORMALİZASYONU (v2) ───────────────────

/**
 * Akıllı ürün adı normalize etme
 * DB'den stok kartı bilgisi kullanarak doğru arama terimi oluşturur
 *
 * @param {string} urunAdi - Ham ürün adı
 * @param {object} stokBilgi - {birim, kategori, ana_urun_adi, ambalaj_miktari}
 * @returns {object} - {searchTerms[], defaultUnit, normalizedName}
 */
const normalizeProductName = (urunAdi, stokBilgi = {}) => {
  const lower = urunAdi.toLowerCase().trim();
  const { birim = null, ana_urun_adi = null } = stokBilgi;

  // 1. Zaten gramaj/miktar içeriyor mu?
  const hasQty = /\d+\s*(kg|gr|g|lt|l|ml|litre|adet)/i.test(lower);

  // 2. Birimi belirle
  let defaultUnit = 'kg';
  if (birim) {
    const birimLower = birim.toLowerCase();
    if (['ml', 'lt', 'l', 'litre'].includes(birimLower)) defaultUnit = 'lt';
    else if (['gr', 'g', 'kg', 'kgm'].includes(birimLower)) defaultUnit = 'kg';
    else if (birimLower === 'adet' || birimLower === 'c62') defaultUnit = 'adet';
  } else {
    // UNIT_MAP'ten belirle
    if (UNIT_MAP[lower]) {
      defaultUnit = UNIT_MAP[lower];
    } else {
      for (const [keyword, unit] of Object.entries(UNIT_MAP)) {
        if (lower.includes(keyword)) {
          defaultUnit = unit;
          break;
        }
      }
    }
  }

  // 3. Çoklu arama terimleri oluştur
  const searchTerms = [];

  if (hasQty) {
    // Gramaj varsa doğrudan kullan
    searchTerms.push(urunAdi);

    // Gramajsız versiyonunu da ekle (daha fazla sonuç için)
    const withoutQty = lower.replace(/\d+[.,]?\d*\s*(kg|gr|g|lt|l|ml|litre|adet)\b/gi, '').trim();
    if (withoutQty.length >= 2 && withoutQty !== lower) {
      searchTerms.push(withoutQty);
    }
  } else {
    // Gramaj yoksa: ürün adı + birim ekle
    const quantity = defaultUnit === 'adet' ? '' : ` 1${defaultUnit}`;

    // Orijinal ürün adı ile ara
    searchTerms.push(`${urunAdi}${quantity}`);

    // Kısa ürün adı ile de ara (marka çıkarılmış)
    const parsed = parseProductName(urunAdi);
    if (parsed.marka && parsed.urunAdi !== urunAdi) {
      searchTerms.push(`${parsed.urunAdi}${quantity}`);
    }

    // Ana ürün adı varsa (varyant sistemi) onu da ekle
    if (ana_urun_adi && ana_urun_adi.toLowerCase() !== lower) {
      searchTerms.push(`${ana_urun_adi}${quantity}`);
    }

    // Sadece sade ürün adı ile de ara (gramajsız)
    if (searchTerms.length === 1) {
      searchTerms.push(urunAdi);
    }
  }

  // Tekrarları kaldır
  const uniqueTerms = [...new Set(searchTerms.map((t) => t.trim()).filter((t) => t.length >= 2))];

  return {
    normalizedName: urunAdi,
    searchTerms: uniqueTerms,
    searchTerm: uniqueTerms[0], // Geriye uyumluluk
    defaultUnit,
  };
};

// Yazım hataları sözlüğü (fallback - AI çalışmazsa)
const SPELLING_CORRECTIONS = {
  pirnc: 'pirinç',
  pirinc: 'pirinç',
  princ: 'pirinç',
  prınc: 'pirinç',
  sut: 'süt',
  süd: 'süt',
  yogurt: 'yoğurt',
  yoğurd: 'yoğurt',
  yogurd: 'yoğurt',
  peynr: 'peynir',
  penir: 'peynir',
  peynır: 'peynir',
  tereyag: 'tereyağı',
  tereyagı: 'tereyağı',
  'tere yağ': 'tereyağı',
  zeytnyag: 'zeytinyağı',
  zeytınyag: 'zeytinyağı',
  'zeytin yağ': 'zeytinyağı',
  makrna: 'makarna',
  maakrna: 'makarna',
  makrana: 'makarna',
  spageti: 'spagetti',
  sapgetti: 'spagetti',
  tavk: 'tavuk',
  tavuuk: 'tavuk',
  kiyma: 'kıyma',
  kıma: 'kıyma',
  dmates: 'domates',
  domtes: 'domates',
  pataes: 'patates',
  patats: 'patates',
  sogan: 'soğan',
  soğn: 'soğan',
  biber: 'biber',
  bibr: 'biber',
  ayçiçek: 'ayçiçek',
  aycicek: 'ayçiçek',
  bakliyat: 'bakliyat',
  baklyat: 'bakliyat',
  // Şeker varyasyonları
  seker: 'şeker',
  şekr: 'şeker',
  sekr: 'şeker',
  şerk: 'şeker',
  serk: 'şeker',
  sekker: 'şeker',
  // Kesme şeker
  'kesme seker': 'kesme şeker',
  'kesme sekr': 'kesme şeker',
  'kesme şerk': 'kesme şeker',
  'kesme serk': 'kesme şeker',
};

/**
 * AI ile yazım düzeltme ve öneri (Claude)
 */
const getAICorrection = async (term) => {
  try {
    const prompt = `Türkçe gıda ürün araması: "${term}"

Görev: Bu arama terimini analiz et ve JSON formatında yanıt ver.

Kurallar:
1. Yazım hatası varsa düzelt (örn: "şerk" → "şeker", "pirnc" → "pirinç", "piras" → "pirinç")
2. Gramaj/miktar yoksa (kg, g, lt, ml, adet) 3-5 spesifik öneri ver
3. Gramaj varsa direkt arama yapılabilir

SADECE JSON formatında yanıt ver, başka hiçbir şey yazma:
{
  "duzeltilmis": "düzeltilmiş terim veya null",
  "oneriler": ["öneri1 1kg", "öneri2 500g", ...],
  "arama_yapilabilir": true/false,
  "mesaj": "kullanıcıya mesaj"
}`;

    const result = await claudeAI.askQuestion(prompt, 'STOK', 'default');

    if (!result.success) {
      return null;
    }

    // JSON çıkar
    const jsonMatch = result.response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch (_error) {
    return null;
  }
};

// Tool tanımları
export const piyasaToolDefinitions = [
  {
    name: 'piyasa_urun_oneri',
    description:
      'Kullanıcının girdiği terimi analiz eder, yazım hatası varsa düzeltir, genel bir terimse spesifik öneriler verir.',
    input_schema: {
      type: 'object',
      properties: {
        arama_terimi: {
          type: 'string',
          description: 'Kullanıcının girdiği arama terimi',
        },
      },
      required: ['arama_terimi'],
    },
  },
  {
    name: 'piyasa_urun_ara',
    description: 'Kullanıcının girdiği ürün adını stok kartlarında arar.',
    input_schema: {
      type: 'object',
      properties: {
        urun_adi: {
          type: 'string',
          description: 'Aranan ürün adı',
        },
      },
      required: ['urun_adi'],
    },
  },
  {
    name: 'piyasa_fiyat_arastir',
    description: 'Belirtilen ürün için market sitelerinden güncel fiyatları çeker.',
    input_schema: {
      type: 'object',
      properties: {
        urun_adi: {
          type: 'string',
          description: 'Fiyatı araştırılacak ürün adı',
        },
        stok_kart_id: {
          type: 'integer',
          description: 'Varsa stok kartı ID',
        },
      },
      required: ['urun_adi'],
    },
  },
  {
    name: 'piyasa_listeye_ekle',
    description: 'Araştırılan ürünü takip listesine ekler.',
    input_schema: {
      type: 'object',
      properties: {
        stok_kart_id: { type: 'integer' },
        urun_adi: { type: 'string' },
        sistem_fiyat: { type: 'number' },
        piyasa_fiyat: { type: 'number' },
      },
      required: ['urun_adi', 'piyasa_fiyat'],
    },
  },
  {
    name: 'piyasa_takip_listesi',
    description: 'Takip edilen ürünlerin listesini getirir.',
    input_schema: {
      type: 'object',
      properties: {
        sadece_aktif: { type: 'boolean', default: true },
      },
    },
  },
];

/**
 * Yazım düzeltme
 */
const correctSpelling = (term) => {
  const lower = term.toLowerCase().trim();
  return SPELLING_CORRECTIONS[lower] || term;
};

/**
 * Gramaj/miktar içeriyor mu kontrol et
 */
const hasQuantity = (term) => {
  // 1kg, 500g, 1lt, 2L, 250ml, 5 kg, 1 litre gibi kalıpları ara
  const quantityPattern = /\d+\s*(kg|gr|g|lt|l|ml|litre|adet|ad|paket|pk)\b/i;
  return quantityPattern.test(term);
};

/**
 * Levenshtein mesafesi (benzerlik hesabı)
 */
const levenshtein = (a, b) => {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] =
        b[i - 1] === a[j - 1]
          ? matrix[i - 1][j - 1]
          : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[b.length][a.length];
};

/**
 * En yakın eşleşmeyi bul
 */
const findClosestMatch = (term, candidates, threshold = 3) => {
  let closest = null;
  let minDistance = Infinity;

  for (const candidate of candidates) {
    const distance = levenshtein(term.toLowerCase(), candidate.toLowerCase());
    if (distance < minDistance && distance <= threshold) {
      minDistance = distance;
      closest = candidate;
    }
  }

  return closest;
};

// Tool implementasyonları
export const piyasaToolImplementations = {
  /**
   * AI Destekli Ürün Öneri Sistemi (Claude AI ile)
   */
  piyasa_urun_oneri: async ({ arama_terimi }) => {
    try {
      const originalTerm = arama_terimi.trim();
      const lowerTerm = originalTerm.toLowerCase();

      // 1. Önce basit sözlük kontrolü (hızlı)
      let correctedTerm = correctSpelling(originalTerm);

      // Kelimeleri ayrı ayrı da kontrol et
      const words = lowerTerm.split(' ');
      const correctedWords = words.map((w) => SPELLING_CORRECTIONS[w] || w);
      const wordCorrected = correctedWords.join(' ');
      if (wordCorrected !== lowerTerm) {
        correctedTerm = wordCorrected;
      }

      const hasBasicSpellingError = correctedTerm.toLowerCase() !== lowerTerm;
      const termHasQuantity = hasQuantity(originalTerm);

      // 2. AI düzeltme (sözlükte bulunamadıysa veya gramaj yoksa)
      let aiResult = null;
      if (!hasBasicSpellingError || !termHasQuantity) {
        aiResult = await getAICorrection(originalTerm);
      }

      // 3. AI sonucu varsa kullan
      if (aiResult) {
        return {
          success: true,
          girilen: originalTerm,
          duzeltilmis: aiResult.duzeltilmis,
          genel_terim: !aiResult.arama_yapilabilir,
          kategori: null,
          oneriler: aiResult.oneriler || [],
          mesaj: aiResult.mesaj || '',
          arama_yapilabilir: aiResult.arama_yapilabilir || false,
          ai_powered: true,
        };
      }

      // 4. Fallback: Eski sistem
      const searchTerm = hasBasicSpellingError ? correctedTerm.toLowerCase() : lowerTerm;

      // Kategori kontrolü
      const categoryKey = Object.keys(PRODUCT_CATEGORIES).find((key) => {
        const keyLower = key.toLowerCase();
        return (
          searchTerm === keyLower ||
          searchTerm.includes(keyLower) ||
          keyLower.includes(searchTerm) ||
          searchTerm.split(' ').some((word) => word === keyLower || keyLower.includes(word))
        );
      });

      // Stok kartlarından benzer ürünleri ara
      let stokOneriler = [];
      try {
        const stokResult = await query(
          `
          SELECT DISTINCT ad FROM stok_kartlari 
          WHERE aktif = true AND ad ILIKE $1
          ORDER BY ad LIMIT 5
        `,
          [`%${searchTerm}%`]
        );
        stokOneriler = stokResult.rows.map((r) => r.ad);
      } catch (_e) {
        /* ignore */
      }

      // Kategorideki ürünlerden öneri
      let kategoriOneriler = [];
      let kategoriMesaj = '';
      if (categoryKey && PRODUCT_CATEGORIES[categoryKey]) {
        kategoriOneriler = PRODUCT_CATEGORIES[categoryKey].oneriler;
        kategoriMesaj = PRODUCT_CATEGORIES[categoryKey].mesaj;
      }

      // Yazım hatasına en yakın kategoriyi bul
      let yakinKategori = null;
      if (!categoryKey && !hasBasicSpellingError) {
        yakinKategori = findClosestMatch(lowerTerm, Object.keys(PRODUCT_CATEGORIES));
      }

      // Sonuç oluştur
      const result = {
        success: true,
        girilen: originalTerm,
        duzeltilmis: hasBasicSpellingError ? correctedTerm : null,
        genel_terim: false,
        kategori: categoryKey ? PRODUCT_CATEGORIES[categoryKey].kategori : null,
        oneriler: [],
        mesaj: '',
        arama_yapilabilir: false,
        ai_powered: false,
      };

      // Yazım hatası varsa
      if (hasBasicSpellingError) {
        result.mesaj = `"${originalTerm}" → "${correctedTerm}" olarak düzeltildi.`;
        result.oneriler = kategoriOneriler.length > 0 ? kategoriOneriler : [correctedTerm];
        result.genel_terim = true;
      }
      // Kategori eşleşti ama gramaj yok
      else if (categoryKey && !termHasQuantity) {
        result.mesaj = `"${originalTerm}" için miktar belirtin. ${kategoriMesaj}`;
        result.oneriler = [...new Set([...kategoriOneriler, ...stokOneriler])].slice(0, 8);
        result.genel_terim = true;
      }
      // Yakın kategori bulundu
      else if (yakinKategori && !termHasQuantity) {
        result.mesaj = `"${originalTerm}" bulunamadı. "${yakinKategori}" mi demek istediniz?`;
        result.oneriler = PRODUCT_CATEGORIES[yakinKategori].oneriler;
        result.duzeltilmis = yakinKategori;
        result.genel_terim = true;
      }
      // Gramaj var - arama yapılabilir
      else if (termHasQuantity) {
        result.mesaj = `"${originalTerm}" için fiyat araması yapılacak.`;
        result.arama_yapilabilir = true;
        result.oneriler = stokOneriler.length > 0 ? stokOneriler : [originalTerm];
      }
      // Gramaj yok, kategori yok
      else {
        if (lowerTerm.split(' ').length <= 2) {
          result.mesaj = `"${originalTerm}" için miktar belirtin (örn: 1kg, 500g, 1lt)`;
          result.oneriler =
            stokOneriler.length > 0
              ? stokOneriler
              : [`${originalTerm} 1kg`, `${originalTerm} 500g`, `${originalTerm} 1lt`];
          result.genel_terim = true;
        } else {
          result.mesaj = `"${originalTerm}" için fiyat araması yapılacak.`;
          result.arama_yapilabilir = true;
          result.oneriler = [originalTerm];
        }
      }

      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  piyasa_urun_ara: async ({ urun_adi }) => {
    try {
      if (!urun_adi) {
        return { success: false, error: 'Ürün adı gerekli' };
      }

      const corrected = correctSpelling(urun_adi);

      const result = await query(
        `
        SELECT sk.id, sk.kod, sk.ad, sk.son_alis_fiyat, sk.toplam_stok,
               k.ad as kategori, b.kisa_ad as birim
        FROM stok_kartlari sk
        LEFT JOIN stok_kategoriler k ON k.id = sk.kategori_id
        LEFT JOIN birimler b ON b.id = sk.ana_birim_id
        WHERE sk.aktif = true AND (sk.ad ILIKE $1 OR sk.kod ILIKE $1)
        ORDER BY sk.ad LIMIT 10
      `,
        [`%${corrected}%`]
      );

      if (result.rows.length === 0) {
        return {
          success: true,
          bulunan: false,
          duzeltme: corrected !== urun_adi ? corrected : null,
          mesaj: `"${corrected}" stokta bulunamadı. Piyasa fiyatı araştırabilirim.`,
        };
      }

      return {
        success: true,
        bulunan: true,
        duzeltme: corrected !== urun_adi ? corrected : null,
        sonuclar: result.rows.map((p) => ({
          id: p.id,
          kod: p.kod,
          ad: p.ad,
          kategori: p.kategori,
          birim: p.birim,
          sistem_fiyat: p.son_alis_fiyat,
          stok: p.toplam_stok,
        })),
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  piyasa_fiyat_arastir: async ({ urun_adi, stok_kart_id }) => {
    try {
      let sistemFiyat = null;
      let urunBilgi = null;
      let stokBilgi = {};

      // Frontend urun_kartlari.id'yi stok_kart_id olarak gönderiyor
      // Gerçek stok_kart_id'yi urun_kartlari üzerinden bulalım
      const inputId = stok_kart_id;
      let urunKartId = null;
      let realStokKartId = null;

      let cachedSearchTerm = null;

      if (inputId) {
        // Önce urun_kartlari'da ara (frontend genellikle urun_kartlari.id gönderir)
        const urunKartResult = await query(
          `SELECT uk.id, uk.ad, uk.stok_kart_id, uk.birim, uk.son_alis_fiyati, uk.piyasa_arama_terimi
           FROM urun_kartlari uk WHERE uk.id = $1`,
          [inputId]
        ).catch(() => ({ rows: [] }));

        if (urunKartResult.rows.length > 0) {
          urunKartId = urunKartResult.rows[0].id;
          realStokKartId = urunKartResult.rows[0].stok_kart_id || null;
          stokBilgi.birim = urunKartResult.rows[0].birim;
          if (urunKartResult.rows[0].son_alis_fiyati) {
            sistemFiyat = urunKartResult.rows[0].son_alis_fiyati;
          }
          // urun_kartlari.piyasa_arama_terimi varsa kullan
          if (urunKartResult.rows[0].piyasa_arama_terimi) {
            cachedSearchTerm = urunKartResult.rows[0].piyasa_arama_terimi;
          }
        }
      }
      // Stok kartından detaylı bilgi al (sadece gerçek stok_kart_id varsa)
      // NOT: realStokKartId olmadan inputId ile stok_kartlari aramak
      // yanlış ürün eşleşmesine neden olabilir (farklı ID namespace'ler)
      if (realStokKartId) {
        const result = await query(
          `
          SELECT sk.id, sk.ad, sk.son_alis_fiyat, sk.ambalaj_miktari,
                 sk.ana_urun_id, sk.piyasa_arama_terimi,
                 ana.ad as ana_urun_adi,
                 k.ad as kategori, b.kisa_ad as birim_kisa
          FROM stok_kartlari sk
          LEFT JOIN stok_kartlari ana ON ana.id = sk.ana_urun_id
          LEFT JOIN stok_kategoriler k ON k.id = sk.kategori_id
          LEFT JOIN birimler b ON b.id = sk.ana_birim_id
          WHERE sk.id = $1
        `,
          [realStokKartId]
        ).catch(() => ({ rows: [] }));

        if (result.rows.length > 0) {
          urunBilgi = result.rows[0];
          if (urunBilgi.son_alis_fiyat) sistemFiyat = urunBilgi.son_alis_fiyat;
          // stok_kartlari.piyasa_arama_terimi sadece urun_kartlari'nda yoksa kullan
          if (!cachedSearchTerm && urunBilgi.piyasa_arama_terimi) {
            cachedSearchTerm = urunBilgi.piyasa_arama_terimi;
          }
          stokBilgi = {
            birim: urunBilgi.birim_kisa || stokBilgi.birim,
            ana_urun_adi: urunBilgi.ana_urun_adi,
            ambalaj_miktari: urunBilgi.ambalaj_miktari,
          };
        }
      }

      // Ürün adını normalize et (akıllı çoklu arama terimleri oluştur)
      const normalized = normalizeProductName(urun_adi, stokBilgi);

      // Cache'lenmiş arama terimi varsa, onu da terimlerin başına ekle
      if (cachedSearchTerm) {
        normalized.searchTerms.unshift(cachedSearchTerm);
        normalized.searchTerms = [...new Set(normalized.searchTerms)];
      }

      // Hedef birim: stok kartından veya normalizasyondan
      const targetUnit = normalized.defaultUnit === 'lt' ? 'L' : normalized.defaultUnit === 'kg' ? 'kg' : null;

      // ─── 3 KATMANLI FİYAT ARAMA ─────────────────────────
      // Katman 1: CAMGÖZ (birincil - yapısal, güvenilir, doğrudan fiyat karşılaştırma)
      // Katman 2: Tavily AI Answer (tamamlayıcı - Camgöz yoksa veya zenginleştirme)
      // Katman 3: hal.gov.tr (taze ürün fallback)

      let piyasaData = { success: false, fiyatlar: [] };
      let kaynakTip = 'market';

      // ── Katman 1: CAMGÖZ (BİRİNCİL — yapısal veri, güvenilir) ──
      try {
        const camgozResult = await searchMarketPrices(normalized.searchTerms, { targetUnit });
        if (camgozResult.success && camgozResult.fiyatlar?.length > 0) {
          piyasaData = camgozResult;
          kaynakTip = 'market';
          logger.info(`[Piyasa] Camgöz birincil: ${camgozResult.fiyatlar.length} fiyat bulundu (${urun_adi})`);
        }
      } catch (camgozErr) {
        logger.warn(`[Piyasa] Camgöz arama hatası: ${camgozErr.message}`);
      }

      // ── Katman 2: Tavily AI Answer (TAMAMLAYICI) ──
      // Camgöz sonucu varsa → sadece AI answer al (snippet parsing yok, ucuz)
      // Camgöz sonucu yoksa → full arama yap (snippet + extract dahil)
      if (isTavilyConfigured()) {
        const camgozVar = piyasaData.success && piyasaData.fiyatlar?.length > 0;
        const tavilyMode = camgozVar ? 'ai_only' : 'full';

        try {
          const searchName = cachedSearchTerm || urun_adi;
          const tavilyResult = await tavilyPiyasaAra(searchName, {
            targetUnit,
            stokBilgi,
            mode: tavilyMode,
          });

          if (tavilyResult.success && tavilyResult.fiyatlar?.length > 0) {
            if (camgozVar) {
              // Camgöz zaten var → Tavily AI fiyatlarını UYUM FİLTRESİ ile ekle
              // Camgöz ortalamasından %60'tan fazla sapan AI fiyatlarını ekleme
              const camgozPrices = piyasaData.fiyatlar.map((f) => f.birimFiyat || f.fiyat).filter((p) => p > 0);
              const camgozOrt =
                camgozPrices.length > 0 ? camgozPrices.reduce((s, p) => s + p, 0) / camgozPrices.length : 0;

              const existingKeys = new Set(piyasaData.fiyatlar.map((f) => `${f.market}-${Math.round(f.fiyat)}`));
              const newItems = tavilyResult.fiyatlar.filter((f) => {
                if (existingKeys.has(`${f.market}-${Math.round(f.fiyat)}`)) return false;
                // Uyum filtresi: Camgöz ortalamasından %60'tan fazla sapıyorsa ekleme
                if (camgozOrt > 0) {
                  const aiFiyat = f.birimFiyat || f.fiyat;
                  const sapmaOrani = Math.abs(aiFiyat - camgozOrt) / camgozOrt;
                  if (sapmaOrani > 0.6) {
                    logger.info(
                      `[Piyasa] Tavily AI fiyat elendi (sapma %${Math.round(sapmaOrani * 100)}): ${aiFiyat} vs Camgöz ort ${camgozOrt.toFixed(0)}`
                    );
                    return false;
                  }
                }
                return true;
              });
              if (newItems.length > 0) {
                piyasaData.fiyatlar = [...piyasaData.fiyatlar, ...newItems];
                piyasaData.toplam_sonuc = piyasaData.fiyatlar.length;
                kaynakTip = 'market+tavily_ai';
                logger.info(`[Piyasa] Tavily AI tamamlayıcı: +${newItems.length} fiyat eklendi (uyum filtresi geçti)`);
              }
              // Tavily AI answer'ı da sakla (rapor/gösterim için)
              if (tavilyResult.aiAnswer) {
                piyasaData.aiAnswer = tavilyResult.aiAnswer;
              }
            } else {
              // Camgöz boştu → Tavily full sonuçları birincil ol
              piyasaData = tavilyResult;
              kaynakTip = 'tavily_referans';
              logger.info(`[Piyasa] Camgöz boş, Tavily full: ${tavilyResult.fiyatlar.length} fiyat (${urun_adi})`);
            }
          }
        } catch (tavilyErr) {
          logger.warn(`[Piyasa] Tavily arama hatası: ${tavilyErr.message}`);
        }
      }

      // ── Katman 3: Hala bulunamadıysa hal.gov.tr'de ara (taze ürün fallback) ──
      if (!piyasaData.success || (piyasaData.fiyatlar && piyasaData.fiyatlar.length === 0)) {
        try {
          const halResult = await searchHalPrices(urun_adi);
          if (halResult.success && halResult.fiyatlar && halResult.fiyatlar.length > 0) {
            piyasaData = {
              success: true,
              urun: urun_adi,
              aramaTermleri: [urun_adi],
              birim: halResult.birim === 'Adet' ? 'adet' : 'kg',
              fiyatlar: halResult.fiyatlar,
              min: halResult.min,
              max: halResult.max,
              ortalama: halResult.ortalama,
              medyan: halResult.ortalama,
              kaynak: 'hal.gov.tr',
              toplam_sonuc: halResult.toplam_sonuc,
              markalar: halResult.sonuclar?.map((s) => s.urunCinsi).filter((v, i, a) => a.indexOf(v) === i) || [],
              marka_gruplari: {},
            };
            kaynakTip = 'toptanci_hal';
          }
        } catch (halErr) {
          logger.warn(`[Piyasa] Hal fallback hatası: ${halErr.message}`);
        }
      }

      // Hala bulunamadıysa hata dön
      if (!piyasaData.success) {
        return piyasaData;
      }

      // Fark hesapla
      let farkYuzde = null;
      let durum = 'bilinmiyor';

      if (sistemFiyat && piyasaData.ortalama) {
        farkYuzde = (((piyasaData.ortalama - sistemFiyat) / sistemFiyat) * 100).toFixed(1);
        durum = parseFloat(farkYuzde) < -5 ? 'ucuz' : parseFloat(farkYuzde) > 5 ? 'pahali' : 'normal';
      }

      // Öneri
      let oneri = '';
      if (durum === 'ucuz') {
        oneri = `Piyasada %${Math.abs(farkYuzde)} daha ucuz. Tedarikçinizden indirim talep edin.`;
      } else if (durum === 'pahali') {
        oneri = `Mevcut fiyatınız piyasanın %${Math.abs(farkYuzde)} altında. İyi fiyat!`;
      } else {
        oneri = 'Fiyatınız piyasa ortalamasında.';
      }

      // ── Merkezi yazım servisi ile kaydet ──
      // Outlier'ları filtrele, birim düzelt, özet hesapla, varyant cascade
      const cleanMin = piyasaData.min || 0;
      const cleanMax = piyasaData.max || Infinity;
      const cleanFiyatlar = piyasaData.fiyatlar.filter(
        (f) => f.birimFiyat >= cleanMin * 0.8 && f.birimFiyat <= cleanMax * 1.2
      );

      const dominantBirim = stokBilgi.birim === 'lt' ? 'L' : stokBilgi.birim === 'kg' ? 'kg' : piyasaData.birim || null;

      const { savedCount } = await savePiyasaFiyatlar({
        urunKartId: urunKartId || null,
        stokKartId: realStokKartId || null,
        urunAdi: urun_adi,
        fiyatlar: cleanFiyatlar,
        kaynakTip,
        dominantBirim,
        aiOneri: oneri,
        eskiKayitlariTemizle: true,
      });

      // Başarılı araştırmayı cache'le (gelecek aramalarda kullanılsın)
      if (realStokKartId && !cachedSearchTerm && piyasaData.toplam_sonuc >= 3) {
        // En iyi sonuç veren arama terimini bul
        const bestTerm = normalized.searchTerms[0];
        await query(`UPDATE stok_kartlari SET piyasa_arama_terimi = $1 WHERE id = $2`, [
          bestTerm,
          realStokKartId,
        ]).catch(() => {});
      }

      return {
        success: true,
        urun: urun_adi,
        stok_kart_id: realStokKartId,
        urun_kart_id: urunKartId,
        kaydedilen: savedCount,
        sistem_fiyat: sistemFiyat,
        birim: stokBilgi.birim || piyasaData.birim,
        arama_terimleri: normalized.searchTerms,
        kaynak_tip: kaynakTip, // 'market' | 'toptanci_hal' | 'web_arama'
        piyasa: {
          min: piyasaData.min,
          max: piyasaData.max,
          ortalama: piyasaData.ortalama,
          medyan: piyasaData.medyan,
          kaynaklar: piyasaData.fiyatlar,
          markalar: piyasaData.markalar || [],
        },
        karsilastirma: {
          fark_yuzde: farkYuzde,
          durum,
          emoji: durum === 'ucuz' ? '📉' : durum === 'pahali' ? '📈' : '➡️',
        },
        oneri,
        arastirma_tarihi: new Date().toISOString(),
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  piyasa_listeye_ekle: async ({ stok_kart_id, urun_adi, sistem_fiyat, piyasa_fiyat }) => {
    try {
      const farkYuzde = sistem_fiyat ? (((piyasa_fiyat - sistem_fiyat) / sistem_fiyat) * 100).toFixed(2) : null;

      const durum = !farkYuzde
        ? 'bilinmiyor'
        : parseFloat(farkYuzde) < -5
          ? 'ucuz'
          : parseFloat(farkYuzde) > 5
            ? 'pahali'
            : 'normal';

      const existing = await query(
        `
        SELECT id FROM piyasa_takip_listesi 
        WHERE (stok_kart_id = $1 OR urun_adi = $2) AND aktif = true
      `,
        [stok_kart_id, urun_adi]
      ).catch(() => ({ rows: [] }));

      if (existing.rows.length > 0) {
        await query(
          `
          UPDATE piyasa_takip_listesi 
          SET son_sistem_fiyat = $1, son_piyasa_fiyat = $2, fark_yuzde = $3, durum = $4
          WHERE id = $5
        `,
          [sistem_fiyat, piyasa_fiyat, farkYuzde, durum, existing.rows[0].id]
        );

        return { success: true, islem: 'guncellendi', mesaj: `"${urun_adi}" güncellendi.` };
      }

      await query(
        `
        INSERT INTO piyasa_takip_listesi 
        (stok_kart_id, urun_adi, son_sistem_fiyat, son_piyasa_fiyat, fark_yuzde, durum)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
        [stok_kart_id, urun_adi, sistem_fiyat, piyasa_fiyat, farkYuzde, durum]
      );

      return { success: true, islem: 'eklendi', mesaj: `"${urun_adi}" eklendi.` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  piyasa_takip_listesi: async ({ sadece_aktif = true }) => {
    try {
      const result = await query(`
        SELECT ptl.*, sk.kod as stok_kod, sk.toplam_stok,
               k.ad as kategori, b.kisa_ad as birim
        FROM piyasa_takip_listesi ptl
        LEFT JOIN stok_kartlari sk ON sk.id = ptl.stok_kart_id
        LEFT JOIN stok_kategoriler k ON k.id = sk.kategori_id
        LEFT JOIN birimler b ON b.id = sk.ana_birim_id
        ${sadece_aktif ? 'WHERE ptl.aktif = true' : ''}
        ORDER BY ptl.updated_at DESC
      `).catch(() => ({ rows: [] }));

      return {
        success: true,
        toplam: result.rows.length,
        ucuz_firsatlar: result.rows.filter((r) => r.durum === 'ucuz').length,
        pahali_uyarilar: result.rows.filter((r) => r.durum === 'pahali').length,
        liste: result.rows.map((r) => ({
          id: r.id,
          stok_kart_id: r.stok_kart_id,
          stok_kod: r.stok_kod,
          urun_adi: r.urun_adi,
          kategori: r.kategori,
          birim: r.birim,
          sistem_fiyat: r.son_sistem_fiyat,
          piyasa_fiyat: r.son_piyasa_fiyat,
          fark_yuzde: r.fark_yuzde,
          durum: r.durum,
          stok: r.toplam_stok,
        })),
      };
    } catch (error) {
      return { success: false, error: error.message, liste: [] };
    }
  },
};

export default { piyasaToolDefinitions, piyasaToolImplementations };
