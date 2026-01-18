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
 * Alakasız ürünleri filtrele (GIDA DIŞI)
 */
function isRelevantProduct(searchTerm, productName) {
  const search = searchTerm.toLowerCase();
  const product = productName.toLowerCase();
  
  // GIDA DIŞI kategoriler - bunlar kesinlikle filtrelenmeli
  const nonFoodCategories = [
    // Temizlik
    'deterjan', 'temizlik', 'matik', 'çamaşır', 'bulaşık', 'yumuşatıcı',
    'çamaşır suyu', 'toz deterjan', 'sıvı deterjan',
    // Kişisel bakım
    'şampuan', 'krem', 'losyon', 'parfüm', 'deodorant', 'sabun',
    'kolonya', 'duş jeli', 'saç kremi', 'cilt bakım',
    // Bebek (gıda dışı)
    'bebek bezi', 'ıslak havlu', 'bebek havlusu', 'ıslak mendil',
    // Kağıt/Ambalaj
    'tuvalet kağıdı', 'peçete', 'mendil', 'çöp torbası', 'poşet',
    'folyo', 'streç', 'buzdolabı poşet', 'kese kağıdı',
    // Mutfak araç/gereç (gıda değil)
    'silikon', 'demlik', 'süzgeç', 'bardak', 'tabak', 'çatal', 'kaşık',
    'bıçak', 'tencere', 'tava', 'kevgir', 'rende', 'doğrama tahtası',
    'spatula', 'servis', 'tepsi', 'kavanoz', 'saklama kabı',
    // Diğer
    'oyuncak', 'kitap', 'dergi', 'kırtasiye', 'elektronik',
    'mum', 'dekoratif', 'figür', 'süs', 'aksesuar'
  ];
  
  // Ürün gıda dışı kategoride mi?
  for (const cat of nonFoodCategories) {
    if (product.includes(cat) && !search.includes(cat)) {
      return false;
    }
  }
  
  // Özel durumlar: "havlu" kelimesi geçiyorsa ve gıda araması değilse
  if (product.includes('havlu') && !search.includes('havlu')) {
    return false;
  }
  
  // "kokulu" ile biten ürünler genelde gıda değil (limon kokulu vs.)
  if (product.includes('kokulu') && !search.includes('kokulu')) {
    return false;
  }
  
  // Gıda takviyesi / vitamin ürünleri
  const supplementKeywords = ['omega', 'vitamin', 'balance oil', 'takviye', 'kapsül', 'tablet'];
  for (const kw of supplementKeywords) {
    if (product.includes(kw) && !search.includes(kw)) {
      return false;
    }
  }
  
  // "Kür" ürünleri (sarımsak kürü, limon kürü vs.) - bunlar genelde sağlık ürünü
  if (product.includes('kür') && !search.includes('kür')) {
    return false;
  }
  
  // Ürün adında arama terimi + farklı bir gıda varsa (limon tuzu, limon suyu vs.)
  // Sadece ana ürünü istiyorsak bunları da filtrelemeliyiz
  const searchMainWord = search.split(/\s+/)[0]; // ilk kelime (örn: "limon")
  const otherFoods = ['tuzu', 'suyu', 'sosu', 'aroması', 'özü', 'yağı'];
  
  // Eğer arama sadece ana ürün ise (örn: "limon" veya "limon kg")
  // ve üründe "limon tuzu", "limon suyu" gibi bileşik isim varsa
  if (searchMainWord.length >= 3) {
    for (const food of otherFoods) {
      // Arama: "limon" veya "limon kg" gibi basit bir şey
      // Ürün: "limon tuzu", "limon suyu" gibi bileşik
      if (product.includes(searchMainWord) && product.includes(food) && !search.includes(food.replace('u', ''))) {
        return false;
      }
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
  
  // Miktar pattern'leri (öncelik sırasına göre)
  const patterns = [
    // "25 kg", "5 kilo", "1.5 kg"
    { pattern: /(\d+[.,]?\d*)\s*(kg|kilo)\b/i, unit: 'kg', divideBy: 1 },
    // "500 gr", "1000 g"
    { pattern: /(\d+[.,]?\d*)\s*(gr|g)\b/i, unit: 'kg', divideBy: 1000 },
    // "1 lt", "2 litre", "5 L"
    { pattern: /(\d+[.,]?\d*)\s*(lt|l|litre)\b/i, unit: 'L', divideBy: 1 },
    // "200 ml"
    { pattern: /(\d+[.,]?\d*)\s*(ml)\b/i, unit: 'L', divideBy: 1000 },
    // "x5", "x 10", "5'li", "10lu", "5 adet"
    { pattern: /x\s*(\d+)\b/i, unit: 'adet', divideBy: 1 },
    { pattern: /(\d+)\s*['']?\s*(li|lu|lı|lü)\b/i, unit: 'adet', divideBy: 1 },
    { pattern: /(\d+)\s*(adet)/i, unit: 'adet', divideBy: 1 }
  ];
  
  for (const { pattern, unit, divideBy } of patterns) {
    const match = lowerName.match(pattern);
    if (match) {
      // x5 formatında amount farklı index'te
      let amountStr = match[1];
      let amount = parseFloat(amountStr.replace(',', '.'));
      
      if (isNaN(amount) || amount <= 0) continue;
      
      // Gram/ml için 1000'e böl, diğerleri için doğrudan böl
      const normalizedAmount = divideBy === 1000 ? amount / 1000 : amount;
      const unitPrice = Math.round(price / normalizedAmount * 100) / 100;
      
      return { unitPrice, perUnit: unit };
    }
  }
  
  // Varsayılan: tek birim (1 kg veya 1 adet varsay)
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
