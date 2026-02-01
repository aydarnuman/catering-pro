/**
 * Piyasa Fiyat Araştırma Tools
 * Playwright ile gerçek market fiyatları + AI Öneri Sistemi
 */

import { query } from '../../database.js';
import claudeAI from '../claude-ai.js';
import { searchMarketPrices } from '../market-scraper.js';

// Genel kategoriler ve alt ürünleri
const PRODUCT_CATEGORIES = {
  makarna: {
    kategori: 'Makarna',
    oneriler: [
      'spagetti makarna 500g',
      'burgu makarna 500g',
      'penne makarna 500g',
      'erişte 500g',
      'lazanya makarna 500g',
    ],
    mesaj: 'Makarna türünü ve gramajını belirtin',
  },
  pirinç: {
    kategori: 'Pirinç',
    oneriler: [
      'baldo pirinç 1kg',
      'osmancık pirinç 1kg',
      'basmati pirinç 1kg',
      'kırık pirinç 1kg',
      'jasmine pirinç 1kg',
    ],
    mesaj: 'Pirinç çeşidini ve miktarını belirtin',
  },
  yağ: {
    kategori: 'Yağ',
    oneriler: ['ayçiçek yağı 5lt', 'zeytinyağı 1lt', 'mısır yağı 5lt', 'tereyağı 500g', 'margarin 250g'],
    mesaj: 'Yağ türünü ve miktarını belirtin',
  },
  et: {
    kategori: 'Et',
    oneriler: ['dana kıyma 1kg', 'kuzu pirzola 1kg', 'dana but 1kg', 'kuzu kuşbaşı 1kg', 'dana antrikot 1kg'],
    mesaj: 'Et türünü belirtin',
  },
  tavuk: {
    kategori: 'Tavuk',
    oneriler: ['tavuk but 1kg', 'tavuk göğüs 1kg', 'bütün tavuk 1kg', 'tavuk kanat 1kg', 'tavuk pirzola 1kg'],
    mesaj: 'Tavuk parçasını belirtin',
  },
  süt: {
    kategori: 'Süt Ürünleri',
    oneriler: ['günlük süt 1lt', 'uht süt 1lt', 'yoğurt 1kg', 'beyaz peynir 1kg', 'kaşar peynir 500g'],
    mesaj: 'Süt ürünü türünü belirtin',
  },
  sebze: {
    kategori: 'Sebze',
    oneriler: ['domates 1kg', 'biber 1kg', 'soğan 1kg', 'patates 1kg', 'salatalık 1kg'],
    mesaj: 'Sebze türünü belirtin',
  },
  meyve: {
    kategori: 'Meyve',
    oneriler: ['elma 1kg', 'portakal 1kg', 'muz 1kg', 'üzüm 1kg', 'karpuz 1kg'],
    mesaj: 'Meyve türünü belirtin',
  },
  un: {
    kategori: 'Un',
    oneriler: ['buğday unu 5kg', 'tam buğday unu 2kg', 'ekmeklik un 5kg', 'mısır unu 1kg'],
    mesaj: 'Un türünü ve miktarını belirtin',
  },
  şeker: {
    kategori: 'Şeker',
    oneriler: ['toz şeker 5kg', 'küp şeker 1kg', 'esmer şeker 1kg', 'pudra şekeri 500g'],
    mesaj: 'Şeker türünü ve miktarını belirtin',
  },
  // Bakliyat
  fasulye: {
    kategori: 'Bakliyat',
    oneriler: ['kuru fasulye dermason 1kg', 'kuru fasulye şeker 1kg', 'barbunya 1kg', 'börülce 1kg'],
    mesaj: 'Fasulye çeşidini ve miktarını belirtin',
  },
  'kuru fasulye': {
    kategori: 'Bakliyat',
    oneriler: [
      'kuru fasulye dermason 1kg',
      'kuru fasulye şeker 1kg',
      'kuru fasulye ispir 1kg',
      'kuru fasulye çalı 1kg',
    ],
    mesaj: 'Fasulye çeşidini belirtin (dermason, şeker, ispir)',
  },
  fasul: {
    kategori: 'Bakliyat',
    oneriler: ['kuru fasulye dermason 1kg', 'kuru fasulye şeker 1kg', 'barbunya 1kg'],
    mesaj: 'Fasulye çeşidini belirtin',
  },
  nohut: {
    kategori: 'Bakliyat',
    oneriler: ['nohut 1kg', 'nohut koçbaşı 1kg', 'nohut yerli 1kg', 'leblebi 500g'],
    mesaj: 'Nohut çeşidini ve miktarını belirtin',
  },
  mercimek: {
    kategori: 'Bakliyat',
    oneriler: ['kırmızı mercimek 1kg', 'yeşil mercimek 1kg', 'sarı mercimek 1kg'],
    mesaj: 'Mercimek rengini belirtin',
  },
  bulgur: {
    kategori: 'Bakliyat',
    oneriler: ['bulgur pilavlık 1kg', 'bulgur köftelik 1kg', 'bulgur ince 1kg'],
    mesaj: 'Bulgur türünü belirtin',
  },
  // Diğer gıdalar
  peynir: {
    kategori: 'Süt Ürünleri',
    oneriler: ['beyaz peynir 1kg', 'kaşar peynir 500g', 'tulum peyniri 500g', 'lor peyniri 500g', 'hellim 250g'],
    mesaj: 'Peynir türünü belirtin',
  },
  yoğurt: {
    kategori: 'Süt Ürünleri',
    oneriler: ['yoğurt 1kg', 'süzme yoğurt 1kg', 'mevsim yoğurt 500g'],
    mesaj: 'Yoğurt türünü belirtin',
  },
  salça: {
    kategori: 'Konserve',
    oneriler: ['domates salçası 700g', 'biber salçası 700g', 'karışık salça 700g'],
    mesaj: 'Salça türünü belirtin',
  },
  zeytinyağı: {
    kategori: 'Yağ',
    oneriler: ['sızma zeytinyağı 1lt', 'riviera zeytinyağı 1lt', 'natürel zeytinyağı 2lt'],
    mesaj: 'Zeytinyağı türünü belirtin',
  },
  tereyağı: {
    kategori: 'Yağ',
    oneriler: ['tereyağı 500g', 'tereyağı 250g', 'tuzsuz tereyağı 500g'],
    mesaj: 'Tereyağı miktarını belirtin',
  },
  kıyma: {
    kategori: 'Et',
    oneriler: ['dana kıyma 1kg', 'kuzu kıyma 1kg', 'karışık kıyma 1kg', 'yağsız dana kıyma 1kg'],
    mesaj: 'Kıyma türünü belirtin',
  },
  balık: {
    kategori: 'Balık',
    oneriler: ['levrek 1kg', 'çipura 1kg', 'hamsi 1kg', 'somon 1kg', 'palamut 1kg'],
    mesaj: 'Balık türünü belirtin',
  },
  tuz: {
    kategori: 'Baharat',
    oneriler: ['sofra tuzu 1kg', 'deniz tuzu 500g', 'himalaya tuzu 500g', 'iyotlu tuz 750g'],
    mesaj: 'Tuz türünü belirtin',
  },
};

// Ürün kategorisine göre varsayılan birim mapping
const CATEGORY_DEFAULT_UNITS = {
  // Litre ile satılanlar
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

  // Adet ile satılanlar
  yumurta: 'adet',
  ekmek: 'adet',
  pide: 'adet',
  simit: 'adet',
  poğaça: 'adet',
  börek: 'adet',
  limon: 'adet',
  portakal: 'adet',
  muz: 'adet',
  elma: 'adet',
  armut: 'adet',
  karpuz: 'adet',
  kavun: 'adet',
  ananas: 'adet',
  lahana: 'adet',
  marul: 'adet',

  // Kg ile satılanlar (default)
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

// Ürün adı → Market arama terimi dönüşümü
const PRODUCT_SEARCH_TERMS = {
  su: 'içme suyu',
  tuz: 'sofra tuzu',
  un: 'buğday unu',
  şeker: 'toz şeker',
  pirinç: 'baldo pirinç',
  bulgur: 'pilavlık bulgur',
  makarna: 'spagetti makarna',
  yağ: 'ayçiçek yağı',
  süt: 'günlük süt',
  yoğurt: 'kaymaksız yoğurt',
  peynir: 'beyaz peynir',
  et: 'dana kıyma',
  tavuk: 'tavuk göğüs',
  mercimek: 'kırmızı mercimek',
  fasulye: 'kuru fasulye',
  nohut: 'nohut',
  salça: 'domates salçası',
  tereyağı: 'tereyağı',
  margarin: 'margarin',
  zeytinyağı: 'sızma zeytinyağı',
};

/**
 * Akıllı ürün adı normalize etme
 * @param {string} urunAdi - Ham ürün adı
 * @param {string} birim - Malzeme birimi (gr, kg, ml, lt, adet)
 * @returns {object} - {normalizedName, searchTerm, defaultUnit}
 */
const normalizeProductName = (urunAdi, birim = null) => {
  const lower = urunAdi.toLowerCase().trim();

  // Zaten gramaj/miktar içeriyor mu?
  const hasQty = /\d+\s*(kg|gr|g|lt|l|ml|litre|adet)/i.test(lower);

  if (hasQty) {
    // Gramaj varsa direkt kullan
    return {
      normalizedName: urunAdi,
      searchTerm: urunAdi,
      defaultUnit: null,
    };
  }

  // Ürün adı için arama terimi bul
  const searchTerm = PRODUCT_SEARCH_TERMS[lower] || urunAdi;

  // Varsayılan birim belirle
  let defaultUnit = 'kg'; // Fallback

  // Önce tam eşleşme ara
  if (CATEGORY_DEFAULT_UNITS[lower]) {
    defaultUnit = CATEGORY_DEFAULT_UNITS[lower];
  } else {
    // Kısmi eşleşme ara (örn: "kaymaksız yoğurt" → "yoğurt" kategorisi)
    for (const [keyword, unit] of Object.entries(CATEGORY_DEFAULT_UNITS)) {
      if (lower.includes(keyword)) {
        defaultUnit = unit;
        break;
      }
    }
  }

  // Birim parametresi varsa ona göre düzelt
  if (birim) {
    const birimLower = birim.toLowerCase();
    if (['ml', 'lt', 'l', 'litre'].includes(birimLower)) {
      defaultUnit = 'lt';
    } else if (['gr', 'g', 'kg'].includes(birimLower)) {
      defaultUnit = 'kg';
    } else if (birimLower === 'adet') {
      defaultUnit = 'adet';
    }
  }

  // Arama terimi oluştur
  const quantity = defaultUnit === 'adet' ? '1 adet' : `1${defaultUnit}`;
  const finalSearchTerm = `${searchTerm} ${quantity}`;

  return {
    normalizedName: urunAdi,
    searchTerm: finalSearchTerm,
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

      // Ürün kartlarından benzer ürünleri ara - YENİ: urun_kartlari
      let stokOneriler = [];
      try {
        const stokResult = await query(
          `
          SELECT DISTINCT ad FROM urun_kartlari 
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

      // YENİ: urun_kartlari + aktif_fiyat
      const result = await query(
        `
        SELECT uk.id, uk.kod, uk.ad, 
               COALESCE(uk.aktif_fiyat, uk.son_alis_fiyati) as son_alis_fiyat,
               uk.aktif_fiyat_tipi,
               (SELECT SUM(miktar) FROM urun_depo_durumlari WHERE urun_kart_id = uk.id) as toplam_stok,
               k.ad as kategori, b.kisa_ad as birim
        FROM urun_kartlari uk
        LEFT JOIN urun_kategorileri k ON k.id = uk.kategori_id
        LEFT JOIN birimler b ON b.id = uk.ana_birim_id
        WHERE uk.aktif = true AND (uk.ad ILIKE $1 OR uk.kod ILIKE $1)
        ORDER BY uk.ad LIMIT 10
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

      // Ürün kartından bilgi al - YENİ: aktif_fiyat
      let stokBirim = null;
      if (stok_kart_id) {
        const result = await query(
          `
          SELECT uk.id, uk.ad, 
                 COALESCE(uk.aktif_fiyat, uk.son_alis_fiyati) as son_alis_fiyat,
                 uk.aktif_fiyat_tipi,
                 k.ad as kategori, b.kisa_ad as birim
          FROM urun_kartlari uk
          LEFT JOIN urun_kategorileri k ON k.id = uk.kategori_id
          LEFT JOIN birimler b ON b.id = uk.ana_birim_id
          WHERE uk.id = $1
        `,
          [stok_kart_id]
        );

        if (result.rows.length > 0) {
          urunBilgi = result.rows[0];
          sistemFiyat = urunBilgi.son_alis_fiyat;
          stokBirim = urunBilgi.birim;
        }
      }

      // Ürün adını normalize et (akıllı birim belirleme)
      const normalized = normalizeProductName(urun_adi, stokBirim);
      const aramaTermi = normalized.searchTerm;

      // ScrapingBee ile piyasa fiyatlarını araştır
      const piyasaData = await searchMarketPrices(aramaTermi);

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

      // Geçmişe kaydet
      await query(
        `
        INSERT INTO piyasa_fiyat_gecmisi 
        (stok_kart_id, urun_adi, sistem_fiyat, piyasa_fiyat_min, piyasa_fiyat_max, piyasa_fiyat_ort, kaynaklar, ai_oneri)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
        [
          stok_kart_id,
          urun_adi,
          sistemFiyat,
          piyasaData.min,
          piyasaData.max,
          piyasaData.ortalama,
          JSON.stringify(piyasaData.fiyatlar),
          oneri,
        ]
      ).catch(() => {});

      return {
        success: true,
        urun: urun_adi,
        stok_kart_id,
        sistem_fiyat: sistemFiyat,
        birim: urunBilgi?.birim || piyasaData.birim,
        piyasa: {
          min: piyasaData.min,
          max: piyasaData.max,
          ortalama: piyasaData.ortalama,
          kaynaklar: piyasaData.fiyatlar,
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
      // YENİ: urun_kartlari kullan
      const result = await query(`
        SELECT ptl.*, uk.kod as stok_kod,
               (SELECT SUM(miktar) FROM urun_depo_durumlari WHERE urun_kart_id = uk.id) as toplam_stok,
               k.ad as kategori, b.kisa_ad as birim
        FROM piyasa_takip_listesi ptl
        LEFT JOIN urun_kartlari uk ON uk.id = ptl.stok_kart_id
        LEFT JOIN urun_kategorileri k ON k.id = uk.kategori_id
        LEFT JOIN birimler b ON b.id = uk.ana_birim_id
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
