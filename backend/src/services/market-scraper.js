/**
 * Market Fiyat Servisi - Playwright ile Gerçek Scraping
 * Migros, ŞOK, Trendyol - Gerçek Fiyatlar
 */

import { chromium } from 'playwright';

// Browser instance (singleton)
let browser = null;

/**
 * Browser başlat
 */
async function initBrowser() {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }
  return browser;
}

/**
 * Browser kapat
 */
export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

/**
 * Migros'tan fiyat çek
 */
async function scrapeMigros(searchTerm) {
  const results = [];
  let page = null;
  
  try {
    const b = await initBrowser();
    page = await b.newPage();
    
    await page.goto(`https://www.migros.com.tr/arama?q=${encodeURIComponent(searchTerm)}`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    const data = await page.evaluate(() => {
      const items = [];
      document.querySelectorAll('.mdc-card, .product-card, [class*="product"]').forEach(card => {
        const nameEl = card.querySelector('.product-name, h5, [class*="name"]');
        const priceEl = card.querySelector('.amount, [class*="price"]');
        
        if (nameEl && priceEl) {
          const priceText = priceEl.textContent || '';
          const match = priceText.match(/(\d+[.,]\d+)/);
          if (match) {
            items.push({
              name: nameEl.textContent?.trim() || '',
              price: parseFloat(match[1].replace(',', '.'))
            });
          }
        }
      });
      return items;
    });

    data.forEach(item => {
      if (item.price >= 5 && item.price <= 10000 && item.name) {
        results.push({
          market: 'Migros',
          urun: item.name,
          fiyat: item.price,
          birim: 'adet'
        });
      }
    });

    console.log(`  ✓ Migros: ${results.length} ürün`);
  } catch (error) {
    console.log(`  ✗ Migros: ${error.message}`);
  } finally {
    if (page) await page.close();
  }

  return results;
}

/**
 * ŞOK Market'ten fiyat çek
 */
async function scrapeSok(searchTerm) {
  const results = [];
  let page = null;
  
  try {
    const b = await initBrowser();
    page = await b.newPage();
    
    await page.goto(`https://www.sokmarket.com.tr/arama?q=${encodeURIComponent(searchTerm)}`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // ŞOK yapısı: CProductCard-module_productCardWrapper__*
    const data = await page.evaluate(() => {
      const items = [];
      
      // Ürün kartlarını bul
      document.querySelectorAll('[class*="CProductCard-module_productCardWrapper"]').forEach(card => {
        const text = card.innerText;
        const lines = text.split('\n').filter(l => l.trim());
        
        if (lines.length >= 2) {
          const name = lines[0];
          // Fiyat satırını bul (₺ içeren)
          const priceLine = lines.find(l => l.includes('₺'));
          if (priceLine) {
            const priceMatch = priceLine.match(/(\d+[.,]\d{2})/);
            if (priceMatch) {
              items.push({
                name: name,
                price: parseFloat(priceMatch[1].replace(',', '.'))
              });
            }
          }
        }
      });
      
      return items;
    });

    data.forEach(item => {
      if (item.price >= 5 && item.price <= 10000 && item.name) {
        results.push({
          market: 'ŞOK',
          urun: item.name,
          fiyat: item.price,
          birim: 'adet'
        });
      }
    });

    console.log(`  ✓ ŞOK: ${results.length} ürün`);
  } catch (error) {
    console.log(`  ✗ ŞOK: ${error.message}`);
  } finally {
    if (page) await page.close();
  }

  return results;
}

/**
 * Trendyol'dan fiyat çek
 */
async function scrapeTrendyol(searchTerm) {
  const results = [];
  let page = null;
  
  try {
    const b = await initBrowser();
    page = await b.newPage();
    
    // User-Agent ekle
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    await page.goto(`https://www.trendyol.com/sr?q=${encodeURIComponent(searchTerm)}`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    const data = await page.evaluate(() => {
      const items = [];
      
      // Trendyol ürün kartları
      document.querySelectorAll('.p-card-wrppr, [class*="product-card"]').forEach(card => {
        const nameEl = card.querySelector('.prdct-desc-cntnr-name, [class*="product-name"], span[class*="name"]');
        const priceEl = card.querySelector('.prc-box-dscntd, .prc-box-sllng, [class*="price"]');
        
        if (nameEl && priceEl) {
          const priceText = priceEl.textContent || '';
          // Virgül veya nokta formatını kabul et
          const match = priceText.match(/(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/);
          if (match) {
            // Türk formatını temizle: 601,79 veya 1.234,56
            let priceStr = match[1].replace(/\./g, '').replace(',', '.');
            items.push({
              name: nameEl.textContent?.trim() || '',
              price: parseFloat(priceStr)
            });
          }
        }
      });
      
      return items;
    });

    data.forEach(item => {
      if (item.price >= 5 && item.price <= 50000 && item.name) {
        results.push({
          market: 'Trendyol',
          urun: item.name,
          fiyat: item.price,
          birim: 'adet'
        });
      }
    });

    console.log(`  ✓ Trendyol: ${results.length} ürün`);
  } catch (error) {
    console.log(`  ✗ Trendyol: ${error.message}`);
  } finally {
    if (page) await page.close();
  }

  return results;
}

/**
 * Alakasız ürünleri filtrele
 */
function isRelevantProduct(searchTerm, productName) {
  const search = searchTerm.toLowerCase();
  const product = productName.toLowerCase();
  
  // Alakasız kategoriler - bunlar hiçbir zaman gıda aramasında çıkmamalı
  const irrelevantCategories = [
    'deterjan', 'temizlik', 'matik', 'çamaşır', 'bulaşık', 'yumuşatıcı',
    'şampuan', 'krem', 'losyon', 'parfüm', 'deodorant', 'sabun',
    'tuvalet', 'peçete', 'mendil', 'bebek bezi', 'hijyen',
    'çöp torbası', 'poşet', 'folyo', 'streç', 'koruyucu',
    'oyuncak', 'kitap', 'dergi', 'kırtasiye', 'elektronik'
  ];
  
  // Ürün alakasız kategoride mi?
  for (const cat of irrelevantCategories) {
    if (product.includes(cat) && !search.includes(cat)) {
      return false;
    }
  }
  
  // Arama teriminin ana kelimelerini çıkar (kg, g, lt gibi birimleri hariç tut)
  const searchWords = search
    .replace(/\d+\s*(kg|gr|g|lt|l|ml|adet)/gi, '')
    .split(/\s+/)
    .filter(w => w.length >= 2);
  
  // Arama kelimelerinden en az birinin üründe olması lazım
  const matchedWords = searchWords.filter(word => product.includes(word));
  
  // En az yarısı eşleşmeli
  if (matchedWords.length < searchWords.length * 0.4) {
    return false;
  }
  
  return true;
}

/**
 * Birim fiyat hesapla (kg/L standardizasyonu)
 */
function calculateUnitPrice(price, productName) {
  const lowerName = (productName || '').toLowerCase();
  
  // Miktar pattern'leri: "1 kg", "500 gr", "2.5 kg", "1000 g", "1 lt", "200 ml"
  const patterns = [
    /(\d+[.,]?\d*)\s*(kg)/i,
    /(\d+[.,]?\d*)\s*(gr|g)\b/i,
    /(\d+[.,]?\d*)\s*(lt|l)\b/i,
    /(\d+[.,]?\d*)\s*(ml)/i,
    /(\d+[.,]?\d*)\s*(adet)/i
  ];
  
  for (const pattern of patterns) {
    const match = lowerName.match(pattern);
    if (match) {
      let amount = parseFloat(match[1].replace(',', '.'));
      let unit = match[2].toLowerCase();
      
      if (unit === 'g' || unit === 'gr') {
        return { unitPrice: Math.round(price / (amount / 1000) * 100) / 100, perUnit: 'kg' };
      }
      if (unit === 'ml') {
        return { unitPrice: Math.round(price / (amount / 1000) * 100) / 100, perUnit: 'L' };
      }
      if (unit === 'kg') {
        return { unitPrice: Math.round(price / amount * 100) / 100, perUnit: 'kg' };
      }
      if (unit === 'lt' || unit === 'l') {
        return { unitPrice: Math.round(price / amount * 100) / 100, perUnit: 'L' };
      }
    }
  }
  
  return { unitPrice: price, perUnit: 'adet' };
}

/**
 * Ana arama fonksiyonu
 */
export async function searchMarketPrices(searchTerm) {
  console.log(`\n🔍 Piyasa araması: "${searchTerm}"`);
  
  const allResults = [];
  
  // Paralel scraping - tüm marketler
  const scrapers = [
    scrapeMigros(searchTerm),
    scrapeSok(searchTerm),
    scrapeTrendyol(searchTerm)
  ];
  
  const results = await Promise.allSettled(scrapers);
  
  results.forEach(result => {
    if (result.status === 'fulfilled' && result.value) {
      allResults.push(...result.value);
    }
  });

  // Alakasız ürünleri filtrele
  const filteredResults = allResults.filter(r => isRelevantProduct(searchTerm, r.urun));
  console.log(`  📋 Filtreleme: ${allResults.length} → ${filteredResults.length} ürün`);

  if (filteredResults.length === 0) {
    return {
      success: false,
      urun: searchTerm,
      error: `"${searchTerm}" için fiyat bulunamadı`,
      fiyatlar: []
    };
  }

  // Birim fiyatları hesapla
  const fiyatlar = filteredResults.map(r => {
    const { unitPrice, perUnit } = calculateUnitPrice(r.fiyat, r.urun);
    return {
      market: r.market,
      urun: r.urun,
      fiyat: r.fiyat,
      birimFiyat: unitPrice,
      birimTipi: perUnit
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

  // En yaygın birim tipini bul (kg veya L tercih et, adet son seçenek)
  const unitCounts = {};
  uniqueFiyatlar.forEach(f => {
    unitCounts[f.birimTipi] = (unitCounts[f.birimTipi] || 0) + 1;
  });
  
  // Öncelik: kg > L > diğer > adet
  let dominantUnit = 'adet';
  if (unitCounts['kg'] >= 3) dominantUnit = 'kg';
  else if (unitCounts['L'] >= 3) dominantUnit = 'L';
  else {
    const nonAdetUnits = Object.entries(unitCounts).filter(([k]) => k !== 'adet');
    if (nonAdetUnits.length > 0) {
      dominantUnit = nonAdetUnits.sort((a, b) => b[1] - a[1])[0][0];
    }
  }
  
  // Aynı birim tipindeki ürünleri filtrele
  const sameUnitFiyatlar = uniqueFiyatlar.filter(f => f.birimTipi === dominantUnit);
  const statsBase = sameUnitFiyatlar.length >= 3 ? sameUnitFiyatlar : uniqueFiyatlar;
  
  // Fiyatları sırala
  const sortedPrices = statsBase.map(f => f.birimFiyat).sort((a, b) => a - b);
  
  // En düşük 5 fiyatın ortalaması (ekonomik fiyat) 
  const ekonomikFiyatlar = sortedPrices.slice(0, Math.min(5, sortedPrices.length));
  const ekonomikOrtalama = ekonomikFiyatlar.reduce((a, b) => a + b, 0) / ekonomikFiyatlar.length;
  
  // Medyan (orta değer)
  const medyan = sortedPrices[Math.floor(sortedPrices.length / 2)];
  
  console.log(`✅ Toplam: ${uniqueFiyatlar.length} fiyat, Ekonomik ort: ${ekonomikOrtalama.toFixed(2)}, Medyan: ${medyan}\n`);

  return {
    success: true,
    urun: searchTerm,
    birim: dominantUnit,
    fiyatlar: uniqueFiyatlar.slice(0, 25),
    min: sortedPrices[0],
    max: sortedPrices[sortedPrices.length - 1],
    ortalama: Math.round(ekonomikOrtalama * 100) / 100, // Ekonomik ortalama göster
    medyan: medyan,
    kaynak: 'playwright_scraping',
    toplam_sonuc: uniqueFiyatlar.length
  };
}

/**
 * Hızlı arama (alias)
 */
export async function quickSearch(productName) {
  return searchMarketPrices(productName);
}

/**
 * Mevcut market listesi
 */
export function getAvailableMarkets() {
  return [
    { key: 'migros', name: 'Migros', active: true, type: 'market' },
    { key: 'sok', name: 'ŞOK', active: true, type: 'market' },
    { key: 'trendyol', name: 'Trendyol', active: true, type: 'marketplace' },
    { key: 'a101', name: 'A101', active: false, type: 'market', note: 'CloudFront koruması' },
    { key: 'getir', name: 'Getir', active: false, type: 'delivery', note: 'CloudFront koruması' },
    { key: 'carrefour', name: 'CarrefourSA', active: false, type: 'market', note: 'Cloudflare koruması' }
  ];
}

export default { searchMarketPrices, quickSearch, getAvailableMarkets, closeBrowser };
