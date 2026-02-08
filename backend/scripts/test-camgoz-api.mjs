/**
 * Camgöz API Test Script
 * camgoz.net /search-product endpoint'ini test eder
 * 
 * Kullanım: node scripts/test-camgoz-api.mjs [arama_terimi]
 * Örnek:    node scripts/test-camgoz-api.mjs pirinç
 */

import * as cheerio from 'cheerio';

const BASE_URL = 'https://camgoz.net';

/**
 * Türkçe fiyat formatını parse et
 * "39,5" → 39.5 | "249.90" → 249.90 | "1.249,90" → 1249.90 | "29995" → 299.95
 */
function parseTurkishPrice(text) {
  if (!text) return null;
  const cleaned = text.trim();
  
  // Format: "1.249,90" (Türk binlik nokta + ondalık virgül)
  if (cleaned.includes(',') && cleaned.includes('.')) {
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
  }
  // Format: "39,5" veya "249,90" (Türk ondalık virgül, binlik yok)
  if (cleaned.includes(',')) {
    return parseFloat(cleaned.replace(',', '.'));
  }
  // Format: "249.90" (standart ondalık nokta)
  // "249.90" → 249.90 (ondalık nokta)
  // Ama "29995" → 299.95? Hayır, doğrudan parse et
  return parseFloat(cleaned);
}

/**
 * Camgöz'den ürün ara - HTML parse
 */
async function searchCamgoz(searchTerm) {
  const url = `${BASE_URL}/search-product?value=${encodeURIComponent(searchTerm)}`;
  
  console.log(`\n🔍 Aranıyor: "${searchTerm}"`);
  console.log(`   URL: ${url}\n`);
  
  const startTime = Date.now();
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; CateringPro/1.0)',
      'Accept': 'text/html',
    },
  });
  
  const elapsed = Date.now() - startTime;
  
  if (!response.ok) {
    console.error(`❌ HTTP ${response.status}: ${response.statusText}`);
    return null;
  }
  
  const html = await response.text();
  console.log(`✅ Yanıt alındı: ${html.length} karakter, ${elapsed}ms\n`);
  
  // HTML parse
  const $ = cheerio.load(html);
  const products = [];
  
  // Her ürün satırını parse et
  $('tr.table-light').each((i, row) => {
    const $row = $(row);
    const urunAdi = $row.find('td[data-label="Ürün"]').text().trim();
    const barkod = $row.find('td[data-label="Barkod"] a').text().trim();
    const marka = $row.find('td[data-label="Marka"]').text().trim();
    const kategori = $row.find('td[data-label="Kategori"]').text().trim();
    const fiyatText = $row.find('td[data-label="Fiyat"]').text().trim();
    const gorselUrl = $row.find('td[data-label="Görsel"] img').attr('src') || '';
    
    // Fiyatı parse et (₺39,5 → 39.5 | ₺1.249,90 → 1249.90)
    const fiyatMatch = fiyatText.match(/[\d.,]+/);
    const fiyat = fiyatMatch ? parseTurkishPrice(fiyatMatch[0]) : null;
    
    // Sonraki tr.price-details'den market fiyatlarını al
    const $priceRow = $row.next('tr.price-details');
    const marketFiyatlari = [];
    
    $priceRow.find('.border.p-2.rounded').each((j, priceBox) => {
      const $box = $(priceBox);
      const marketAdi = $box.find('.fw-semibold').text().trim();
      const marketFiyatText = $box.find('.fw-bold').text().trim();
      const marketFiyatMatch = marketFiyatText.match(/[\d.,]+/);
      const marketFiyat = marketFiyatMatch ? parseTurkishPrice(marketFiyatMatch[0]) : null;
      const sonGuncelleme = $box.find('.time-ago').attr('data-time') || '';
      const siteLink = $box.find('a[target="_blank"]').attr('href') || '';
      
      if (marketAdi && marketFiyat) {
        marketFiyatlari.push({
          market: marketAdi,
          fiyat: marketFiyat,
          sonGuncelleme,
          link: siteLink,
        });
      }
    });
    
    if (urunAdi) {
      products.push({
        urunAdi,
        barkod,
        marka,
        kategori,
        enDusukFiyat: fiyat,
        gorselUrl,
        marketFiyatlari,
        marketSayisi: marketFiyatlari.length,
      });
    }
  });
  
  return {
    arama: searchTerm,
    toplamUrun: products.length,
    sure: `${elapsed}ms`,
    urunler: products,
  };
}

/**
 * Birim fiyat hesapla (market-scraper.js ile uyumlu)
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
      if (isNaN(amount) || amount <= 0) continue;
      const normalizedAmount = divideBy === 1000 ? amount / 1000 : amount;
      const unitPrice = Math.round((price / normalizedAmount) * 100) / 100;
      return { unitPrice, perUnit: unit };
    }
  }
  
  return { unitPrice: price, perUnit: 'adet' };
}

/**
 * searchMarketPrices uyumlu çıktı üret
 */
function formatAsMarketPrices(camgozResult) {
  if (!camgozResult || camgozResult.toplamUrun === 0) {
    return {
      success: false,
      urun: camgozResult?.arama || '',
      error: `"${camgozResult?.arama}" için Camgöz'de fiyat bulunamadı`,
      fiyatlar: [],
      kaynak: 'camgoz',
    };
  }
  
  const allPrices = [];
  
  for (const urun of camgozResult.urunler) {
    for (const mf of urun.marketFiyatlari) {
      const { unitPrice, perUnit } = calculateUnitPrice(mf.fiyat, urun.urunAdi);
      allPrices.push({
        market: `${mf.market} (Camgöz)`,
        urun: urun.urunAdi,
        fiyat: mf.fiyat,
        birimFiyat: unitPrice,
        birimTipi: perUnit,
        barkod: urun.barkod,
        sonGuncelleme: mf.sonGuncelleme,
      });
    }
  }
  
  // Sırala
  allPrices.sort((a, b) => a.birimFiyat - b.birimFiyat);
  
  if (allPrices.length === 0) {
    return {
      success: false,
      urun: camgozResult.arama,
      error: 'Market fiyatı bulunamadı',
      fiyatlar: [],
      kaynak: 'camgoz',
    };
  }
  
  const prices = allPrices.map(p => p.birimFiyat);
  const ekonomikFiyatlar = prices.slice(0, Math.min(5, prices.length));
  const ekonomikOrtalama = ekonomikFiyatlar.reduce((a, b) => a + b, 0) / ekonomikFiyatlar.length;
  
  return {
    success: true,
    urun: camgozResult.arama,
    birim: allPrices[0]?.birimTipi || 'adet',
    fiyatlar: allPrices.slice(0, 25),
    min: prices[0],
    max: prices[prices.length - 1],
    ortalama: Math.round(ekonomikOrtalama * 100) / 100,
    medyan: prices[Math.floor(prices.length / 2)],
    kaynak: 'camgoz',
    toplam_sonuc: allPrices.length,
  };
}

// ─── ANA ÇALIŞMA ───

const searchTerm = process.argv[2] || 'pirinç';

console.log('═══════════════════════════════════════════════');
console.log('  CAMGÖZ API TEST');
console.log('═══════════════════════════════════════════════');

// Test 1: Ham sonuçlar
const result = await searchCamgoz(searchTerm);

if (result) {
  console.log(`📦 ${result.toplamUrun} ürün bulundu (${result.sure})\n`);
  
  // İlk 5 ürünü göster
  console.log('── İLK 5 ÜRÜN ──────────────────────────────');
  result.urunler.slice(0, 5).forEach((u, i) => {
    console.log(`\n${i + 1}. ${u.urunAdi}`);
    console.log(`   Barkod: ${u.barkod || '-'}`);
    console.log(`   En Düşük Fiyat: ₺${u.enDusukFiyat}`);
    console.log(`   Market Sayısı: ${u.marketSayisi}`);
    if (u.marketFiyatlari.length > 0) {
      console.log('   Market Fiyatları:');
      u.marketFiyatlari.slice(0, 4).forEach(mf => {
        console.log(`     - ${mf.market}: ₺${mf.fiyat}`);
      });
      if (u.marketFiyatlari.length > 4) {
        console.log(`     ... ve ${u.marketFiyatlari.length - 4} market daha`);
      }
    }
  });
  
  // Test 2: searchMarketPrices formatında
  console.log('\n\n── MARKET SCRAPER UYUMLU FORMAT ──────────────');
  const formatted = formatAsMarketPrices(result);
  console.log(JSON.stringify(formatted, null, 2));
}

// Test 3: Birkaç ürün daha deneyelim
console.log('\n\n═══════════════════════════════════════════════');
console.log('  EK TESTLER (özet)');
console.log('═══════════════════════════════════════════════');

const testTerms = ['domates', 'tereyağı', 'un 5 kg'];

for (const term of testTerms) {
  const r = await searchCamgoz(term);
  if (r) {
    const f = formatAsMarketPrices(r);
    console.log(`\n"${term}" → ${r.toplamUrun} ürün, ${r.sure}`);
    if (f.success) {
      console.log(`  Min: ₺${f.min}/${f.birim} | Ort: ₺${f.ortalama}/${f.birim} | Max: ₺${f.max}/${f.birim} | ${f.toplam_sonuc} fiyat`);
    } else {
      console.log(`  ❌ ${f.error}`);
    }
  }
  // Rate limiting - 500ms bekle
  await new Promise(r => setTimeout(r, 500));
}

console.log('\n✅ Test tamamlandı!');
