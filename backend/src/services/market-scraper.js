/**
 * Market Fiyat Servisi - Camgöz API
 * camgoz.net üzerinden 45+ Türkiye marketi fiyat karşılaştırma
 * Puppeteer gerektirmez - hafif HTTP + HTML parse
 */

import * as cheerio from 'cheerio';

// ─── CAMGÖZ API ──────────────────────────────────────────

/**
 * Türkçe fiyat formatını parse et
 * "39,5" → 39.5 | "249.90" → 249.90 | "1.249,90" → 1249.90
 */
function parseTurkishPrice(text) {
  if (!text) return null;
  const cleaned = text.trim();
  // "1.249,90" → 1249.90
  if (cleaned.includes(',') && cleaned.includes('.')) {
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
  }
  // "39,5" → 39.5
  if (cleaned.includes(',')) {
    return parseFloat(cleaned.replace(',', '.'));
  }
  // "249.90" → 249.90
  return parseFloat(cleaned);
}

/**
 * Camgöz API'den fiyat çek (45+ market)
 * camgoz.net /search-product endpoint'i - HTML parse
 */
async function fetchCamgozPrices(searchTerm) {
  const results = [];

  try {
    const url = `https://camgoz.net/search-product?value=${encodeURIComponent(searchTerm)}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CateringPro/1.0)',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(15000), // 15s timeout
    });

    if (!response.ok) return results;

    const html = await response.text();
    const $ = cheerio.load(html);

    $('tr.table-light').each((_i, row) => {
      const $row = $(row);
      const urunAdi = $row.find('td[data-label="Ürün"]').text().trim();
      if (!urunAdi) return;

      const barkod = $row.find('td[data-label="Barkod"] a').text().trim();

      // Sonraki tr.price-details'den market fiyatlarını al
      const $priceRow = $row.next('tr.price-details');

      $priceRow.find('.border.p-2.rounded').each((_j, priceBox) => {
        const $box = $(priceBox);
        const marketAdi = $box.find('.fw-semibold').text().trim();
        const marketFiyatText = $box.find('.fw-bold').text().trim();
        const fiyatMatch = marketFiyatText.match(/[\d.,]+/);
        const fiyat = fiyatMatch ? parseTurkishPrice(fiyatMatch[0]) : null;

        if (marketAdi && fiyat && fiyat >= 1 && fiyat <= 50000) {
          results.push({
            market: marketAdi,
            urun: urunAdi,
            fiyat,
            birim: 'adet',
            barkod: barkod || undefined,
          });
        }
      });
    });
  } catch (_error) {
    // Camgöz erişilemezse sessizce boş dön
  }

  return results;
}

// ─── FİLTRELEME ──────────────────────────────────────────

/**
 * Alakasız ürünleri filtrele (GIDA DIŞI)
 */
function isRelevantProduct(searchTerm, productName) {
  const search = searchTerm.toLowerCase();
  const product = productName.toLowerCase();

  // GIDA DIŞI kategoriler
  const nonFoodCategories = [
    // Temizlik
    'deterjan', 'temizlik', 'matik', 'çamaşır', 'bulaşık', 'yumuşatıcı',
    'çamaşır suyu', 'toz deterjan', 'sıvı deterjan',
    // Kişisel bakım
    'şampuan', 'losyon', 'parfüm', 'deodorant', 'kolonya', 'duş jeli',
    'saç kremi', 'cilt bakım',
    // Bebek (gıda dışı)
    'bebek bezi', 'ıslak havlu', 'bebek havlusu', 'ıslak mendil',
    // Kağıt/Ambalaj
    'tuvalet kağıdı', 'peçete', 'mendil', 'çöp torbası', 'poşet',
    'folyo', 'streç', 'buzdolabı poşet', 'kese kağıdı',
    // Mutfak araç/gereç
    'silikon', 'demlik', 'süzgeç', 'bardak', 'tabak', 'çatal', 'kaşık',
    'bıçak', 'tencere', 'tava', 'kevgir', 'rende', 'doğrama tahtası',
    'spatula', 'servis', 'tepsi', 'kavanoz', 'saklama kabı',
    // Hayvan maması
    'köpek maması', 'kedi maması', 'pet food',
    // Diğer
    'oyuncak', 'kitap', 'dergi', 'kırtasiye', 'elektronik', 'mum',
    'dekoratif', 'figür', 'süs', 'aksesuar', 'marker', 'kalem',
  ];

  for (const cat of nonFoodCategories) {
    if (product.includes(cat) && !search.includes(cat)) {
      return false;
    }
  }

  // Özel durumlar
  if (product.includes('havlu') && !search.includes('havlu')) return false;
  if (product.includes('kokulu') && !search.includes('kokulu')) return false;

  // Gıda takviyesi / vitamin
  const supplementKeywords = ['omega', 'vitamin', 'balance oil', 'takviye', 'kapsül', 'tablet'];
  for (const kw of supplementKeywords) {
    if (product.includes(kw) && !search.includes(kw)) return false;
  }

  // "Kür" ürünleri
  if (product.includes('kür') && !search.includes('kür')) return false;

  // Bileşik isimler (limon tuzu, limon suyu vs.)
  const searchMainWord = search.split(/\s+/)[0];
  const otherFoods = ['tuzu', 'suyu', 'sosu', 'aroması', 'özü', 'yağı'];

  if (searchMainWord.length >= 3) {
    for (const food of otherFoods) {
      if (product.includes(searchMainWord) && product.includes(food) && !search.includes(food.replace('u', ''))) {
        return false;
      }
    }
  }

  // Arama kelimelerinden en az %40'ı eşleşmeli
  const searchWords = search
    .replace(/\d+\s*(kg|gr|g|lt|l|ml|adet)/gi, '')
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  const matchedWords = searchWords.filter((word) => product.includes(word));
  if (matchedWords.length < searchWords.length * 0.4) return false;

  return true;
}

// ─── BİRİM FİYAT ────────────────────────────────────────

/**
 * Birim fiyat hesapla (kg/L standardizasyonu)
 */
function calculateUnitPrice(price, productName) {
  const lowerName = (productName || '').toLowerCase();

  const patterns = [
    { pattern: /(\d+[.,]?\d*)\s*(kg|kilo)\b/i, unit: 'kg', divideBy: 1 },
    { pattern: /(\d+[.,]?\d*)\s*(gr|g)\b/i, unit: 'kg', divideBy: 1000 },
    { pattern: /(\d+[.,]?\d*)\s*(lt|l|litre)\b/i, unit: 'L', divideBy: 1 },
    { pattern: /(\d+[.,]?\d*)\s*(ml)\b/i, unit: 'L', divideBy: 1000 },
    { pattern: /x\s*(\d+)\b/i, unit: 'adet', divideBy: 1 },
    { pattern: /(\d+)\s*['']?\s*(li|lu|lı|lü)\b/i, unit: 'adet', divideBy: 1 },
    { pattern: /(\d+)\s*(adet)/i, unit: 'adet', divideBy: 1 },
  ];

  for (const { pattern, unit, divideBy } of patterns) {
    const match = lowerName.match(pattern);
    if (match) {
      const amount = parseFloat(match[1].replace(',', '.'));
      if (Number.isNaN(amount) || amount <= 0) continue;

      const normalizedAmount = divideBy === 1000 ? amount / 1000 : amount;
      const unitPrice = Math.round((price / normalizedAmount) * 100) / 100;
      return { unitPrice, perUnit: unit };
    }
  }

  return { unitPrice: price, perUnit: 'adet' };
}

// ─── ANA FONKSİYONLAR ───────────────────────────────────

/**
 * Ana arama fonksiyonu - Camgöz API
 */
export async function searchMarketPrices(searchTerm) {
  const allResults = await fetchCamgozPrices(searchTerm);

  // Alakasız ürünleri filtrele
  const filteredResults = allResults.filter((r) => isRelevantProduct(searchTerm, r.urun));

  if (filteredResults.length === 0) {
    return {
      success: false,
      urun: searchTerm,
      error: `"${searchTerm}" için fiyat bulunamadı`,
      fiyatlar: [],
    };
  }

  // Birim fiyatları hesapla
  const fiyatlar = filteredResults.map((r) => {
    const { unitPrice, perUnit } = calculateUnitPrice(r.fiyat, r.urun);
    return {
      market: r.market,
      urun: r.urun,
      fiyat: r.fiyat,
      birimFiyat: unitPrice,
      birimTipi: perUnit,
      barkod: r.barkod,
    };
  });

  // Birim fiyata göre sırala
  fiyatlar.sort((a, b) => a.birimFiyat - b.birimFiyat);

  // Tekrar edenleri kaldır
  const uniqueFiyatlar = [];
  const seen = new Set();
  for (const f of fiyatlar) {
    const key = `${f.market}-${f.fiyat}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueFiyatlar.push(f);
    }
  }

  // En yaygın birim tipini bul (kg > L > diğer > adet)
  const unitCounts = {};
  uniqueFiyatlar.forEach((f) => {
    unitCounts[f.birimTipi] = (unitCounts[f.birimTipi] || 0) + 1;
  });

  let dominantUnit = 'adet';
  if (unitCounts['kg'] >= 3) dominantUnit = 'kg';
  else if (unitCounts['L'] >= 3) dominantUnit = 'L';
  else {
    const nonAdetUnits = Object.entries(unitCounts).filter(([k]) => k !== 'adet');
    if (nonAdetUnits.length > 0) {
      dominantUnit = nonAdetUnits.sort((a, b) => b[1] - a[1])[0][0];
    }
  }

  // İstatistikler
  const sameUnitFiyatlar = uniqueFiyatlar.filter((f) => f.birimTipi === dominantUnit);
  const statsBase = sameUnitFiyatlar.length >= 3 ? sameUnitFiyatlar : uniqueFiyatlar;
  const sortedPrices = statsBase.map((f) => f.birimFiyat).sort((a, b) => a - b);

  // Ekonomik ortalama (en ucuz 5)
  const ekonomikFiyatlar = sortedPrices.slice(0, Math.min(5, sortedPrices.length));
  const ekonomikOrtalama = ekonomikFiyatlar.reduce((a, b) => a + b, 0) / ekonomikFiyatlar.length;

  // Medyan
  const medyan = sortedPrices[Math.floor(sortedPrices.length / 2)];

  return {
    success: true,
    urun: searchTerm,
    birim: dominantUnit,
    fiyatlar: uniqueFiyatlar.slice(0, 25),
    min: sortedPrices[0],
    max: sortedPrices[sortedPrices.length - 1],
    ortalama: Math.round(ekonomikOrtalama * 100) / 100,
    medyan,
    kaynak: 'camgoz',
    toplam_sonuc: uniqueFiyatlar.length,
  };
}

/**
 * Hızlı arama (alias)
 */
export async function quickSearch(productName) {
  return searchMarketPrices(productName);
}

/**
 * Browser kapat - artık gerekli değil ama geriye uyumluluk için bırakıldı
 */
export async function closeBrowser() {
  // Puppeteer kaldırıldı, bu fonksiyon artık no-op
}

/**
 * Mevcut market listesi
 */
export function getAvailableMarkets() {
  return [
    { key: 'camgoz', name: 'Camgöz API', active: true, type: 'api',
      note: '45+ market: A101, Migros, CarrefourSA, ŞOK, Bizim Toptan, Macro Center, Mopaş, Hakmar, Gürmar ve daha fazlası' },
  ];
}

export default { searchMarketPrices, quickSearch, getAvailableMarkets, closeBrowser };
