/**
 * Piyasa Fiyat Kaynakları - Merkezi Konfigürasyon
 *
 * Catering sektörüne özel referans siteleri ve kategori eşleştirmeleri.
 * Tavily API'de includeDomains parametresiyle kullanılır.
 *
 * Tier yapısı:
 *   Tier 1 (Aggregatör)  – Fiyat karşılaştırma siteleri (1 arama = çok kaynak)
 *   Tier 2 (Toptan/HoReCa) – Catering/toptan odaklı siteler
 *   Tier 3 (Market)       – Perakende zincir referans fiyatları
 *   Tier 4 (Tarım)        – Taze ürün / tarımsal veriler
 */

// ─── REFERANS SİTELERİ (Tier bazlı) ─────────────────────

export const REFERANS_SITELERI = {
  karsilastirma: ['akakce.com', 'cimri.com'],
  toptan: ['bizimtoptan.com.tr', 'metro.com.tr', 'toptangida.com'],
  market: ['migros.com.tr', 'a101.com.tr', 'carrefoursa.com', 'sokmarket.com.tr', 'getir.com'],
  tarim: ['tarimziraat.com', 'tarimorman.gov.tr'],
};

// Tüm siteler (flat liste, tekrarsız)
export const TUM_SITELER = [
  ...new Set([
    ...REFERANS_SITELERI.karsilastirma,
    ...REFERANS_SITELERI.toptan,
    ...REFERANS_SITELERI.market,
    ...REFERANS_SITELERI.tarim,
  ]),
];

// ─── KATEGORİ → SİTE EŞLEŞTİRMESİ ──────────────────────

export const KATEGORI_SITELERI = {
  // Paketli gıda: makarna, bakliyat, konserve, yağ, şeker, un, baharat, sos...
  paketli: [
    ...REFERANS_SITELERI.karsilastirma,
    ...REFERANS_SITELERI.toptan,
    ...REFERANS_SITELERI.market,
  ],
  // Taze meyve-sebze
  taze: [
    ...REFERANS_SITELERI.tarim,
    ...REFERANS_SITELERI.karsilastirma,
  ],
  // Et, süt, peynir, yoğurt, tereyağı
  et_sut: [
    ...REFERANS_SITELERI.karsilastirma,
    ...REFERANS_SITELERI.toptan,
    ...REFERANS_SITELERI.market,
  ],
  // Toptan / büyük ambalaj
  toptan_buyuk: [
    ...REFERANS_SITELERI.toptan,
    ...REFERANS_SITELERI.karsilastirma,
  ],
  // Temizlik, sarf malzemesi
  temizlik: [
    ...REFERANS_SITELERI.karsilastirma,
    ...REFERANS_SITELERI.market,
  ],
};

// ─── ÜRÜN KATEGORİSİ TESPİT ────────────────────────────

// Anahtar kelime → kategori eşleştirmesi
const KATEGORI_ANAHTAR_KELIMELER = {
  taze: [
    'domates', 'biber', 'soğan', 'patates', 'salatalık', 'patlıcan', 'kabak',
    'havuç', 'marul', 'ıspanak', 'lahana', 'turp', 'enginar', 'kereviz',
    'mantar', 'brokoli', 'karnabahar', 'fasulye', 'bezelye', 'bamya',
    'elma', 'portakal', 'muz', 'üzüm', 'limon', 'kayısı', 'erik', 'kiraz',
    'çilek', 'karpuz', 'kavun', 'armut', 'şeftali', 'nar', 'incir',
    'maydanoz', 'dereotu', 'nane', 'roka', 'semizotu', 'tere',
  ],
  et_sut: [
    'dana', 'kuzu', 'tavuk', 'kıyma', 'antrikot', 'bonfile', 'pirzola',
    'but', 'kanat', 'baget', 'göğüs', 'ciğer', 'kemik', 'kuşbaşı',
    'sucuk', 'salam', 'sosis', 'pastırma', 'kavurma',
    'süt', 'yoğurt', 'peynir', 'tereyağı', 'kaymak', 'ayran', 'kefir',
    'lor', 'tulum', 'kaşar', 'beyaz peynir', 'krema', 'labne',
    'yumurta',
  ],
  temizlik: [
    'deterjan', 'temizlik', 'çamaşır', 'bulaşık', 'yumuşatıcı',
    'çöp torbası', 'poşet', 'streç', 'folyo', 'alüminyum',
    'peçete', 'havlu', 'tuvalet kağıdı', 'kağıt havlu',
    'eldiven', 'bone', 'önlük',
  ],
  toptan_buyuk: [
    'teneke', 'bidon', 'çuval', 'koli', 'kasa',
    '25 kg', '25kg', '50 kg', '50kg', '10 kg', '10kg',
    '5 lt', '5lt', '10 lt', '10lt', '18 lt', '18lt',
  ],
  // paketli: default kategori (yukarıdakilerle eşleşmeyen her şey)
};

/**
 * Ürün adından kategori tespit et
 * @param {string} urunAdi - Ürün adı
 * @param {object} [stokBilgi] - Stok kartı bilgisi (opsiyonel)
 * @returns {string} Kategori: 'paketli' | 'taze' | 'et_sut' | 'temizlik' | 'toptan_buyuk'
 */
export function urunKategorisiTespit(urunAdi, stokBilgi = null) {
  if (!urunAdi) return 'paketli';
  const lower = urunAdi.toLowerCase();

  // Stok bilgisinden kategori ipucu (varsa)
  if (stokBilgi?.kategori) {
    const katLower = stokBilgi.kategori.toLowerCase();
    if (katLower.includes('meyve') || katLower.includes('sebze') || katLower.includes('taze')) return 'taze';
    if (katLower.includes('et') || katLower.includes('süt') || katLower.includes('tavuk')) return 'et_sut';
    if (katLower.includes('temizlik') || katLower.includes('sarf')) return 'temizlik';
  }

  // Toptan/büyük ambalaj önce kontrol (ürün adındaki ambalaj bilgisi)
  for (const keyword of KATEGORI_ANAHTAR_KELIMELER.toptan_buyuk) {
    if (lower.includes(keyword)) return 'toptan_buyuk';
  }

  // Diğer kategoriler
  for (const [kategori, keywords] of Object.entries(KATEGORI_ANAHTAR_KELIMELER)) {
    if (kategori === 'toptan_buyuk') continue; // Zaten kontrol edildi
    for (const keyword of keywords) {
      if (lower.includes(keyword)) return kategori;
    }
  }

  return 'paketli'; // Varsayılan
}

/**
 * Kategori için referans site listesini döndür
 * @param {string} kategori - Ürün kategorisi
 * @returns {string[]} includeDomains için site listesi
 */
export function kategoriSiteleriniGetir(kategori) {
  return KATEGORI_SITELERI[kategori] || KATEGORI_SITELERI.paketli;
}

/**
 * Ürün adından doğrudan site listesi al (kestirme)
 * @param {string} urunAdi - Ürün adı
 * @param {object} [stokBilgi] - Stok bilgisi (opsiyonel)
 * @returns {{ kategori: string, siteler: string[] }}
 */
export function urunIcinSiteler(urunAdi, stokBilgi = null) {
  const kategori = urunKategorisiTespit(urunAdi, stokBilgi);
  return {
    kategori,
    siteler: kategoriSiteleriniGetir(kategori),
  };
}

// ─── KREDİ YÖNETİMİ AYARLARI ───────────────────────────

export const KREDI_AYARLARI = {
  // Ürün başına max kredi harcaması
  maxKrediPerUrun: 5,

  // Search: basic (1 kredi) veya advanced (2 kredi)
  varsayilanSearchDepth: 'basic',

  // Extract: sonuç yetersizse kaç URL çekilir (1 kredi/URL)
  maxExtractUrl: 3,

  // Extract çalıştırma eşiği: search'ten gelen sonuç sayısı bundan azsa extract yap
  extractEsik: 3,

  // Cache TTL: aynı ürün bu süre içinde tekrar aranmaz (saat)
  cacheTtlSaat: 12,
};
