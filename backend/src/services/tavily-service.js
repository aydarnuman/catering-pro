/**
 * Tavily API Servisi
 * Tüm Tavily özelliklerini merkezi olarak yönetir
 *
 * Endpoints:
 * - search: Web araması + AI özet cevap
 * - extract: Belirli URL'lerden içerik çekme
 *
 * Kredi kullanımı: basic search = 1, advanced search = 2, extract = 1/URL
 */

import {
  KREDI_AYARLARI,
  urunIcinSiteler,
} from '../config/piyasa-kaynak.js';
import {
  calculateRelevanceScore,
  calculateUnitPrice,
  parseProductName,
} from './market-scraper.js';

const TAVILY_API_KEY = () => process.env.TAVILY_API_KEY || '';
const TAVILY_BASE = 'https://api.tavily.com';
const DEFAULT_TIMEOUT = 15000;

// ─── KREDİ TAKİP ──────────────────────────────────────────
const _krediLog = {
  gunluk: 0,
  aylik: 0,
  sonSifirlama: new Date().toISOString().slice(0, 10),
  detay: [], // Son 100 işlem
};

function krediKullanımıLogla(islem, kredi) {
  const bugun = new Date().toISOString().slice(0, 10);
  // Günlük sıfırlama
  if (_krediLog.sonSifirlama !== bugun) {
    _krediLog.gunluk = 0;
    _krediLog.sonSifirlama = bugun;
  }
  // Aylık sıfırlama (ayın 1'i)
  const buAy = bugun.slice(0, 7); // YYYY-MM
  if (!_krediLog.ayBaslangic || _krediLog.ayBaslangic !== buAy) {
    _krediLog.aylik = 0;
    _krediLog.ayBaslangic = buAy;
  }
  _krediLog.gunluk += kredi;
  _krediLog.aylik += kredi;
  _krediLog.detay.push({
    islem,
    kredi,
    zaman: new Date().toISOString(),
  });
  if (_krediLog.detay.length > 100) _krediLog.detay.shift();
}

/**
 * Kredi kullanım istatistiklerini döndür
 */
export function getKrediKullanimi() {
  return { ..._krediLog, detaySayisi: _krediLog.detay.length };
}

// ─── SEARCH ─────────────────────────────────────────────
/**
 * Tavily Search - Web araması + AI özet
 * @param {string} query - Arama sorgusu
 * @param {Object} options
 * @param {'basic'|'advanced'} options.searchDepth - Arama derinliği (advanced = 2 kredi)
 * @param {number} options.maxResults - Maksimum sonuç (varsayılan: 5)
 * @param {boolean} options.includeAnswer - AI özet cevap (varsayılan: true)
 * @param {boolean} options.includeRawContent - Ham sayfa içeriği (varsayılan: false)
 * @param {string[]} options.includeDomains - Sadece bu domainlerde ara
 * @param {string[]} options.excludeDomains - Bu domainleri hariç tut
 * @param {'general'|'news'|'finance'} options.topic - Arama konusu
 * @param {number} options.days - Son N gün filtresi
 */
export async function tavilySearch(query, options = {}) {
  const apiKey = TAVILY_API_KEY();
  if (!apiKey) {
    return { success: false, error: 'TAVILY_API_KEY ayarlanmamış' };
  }

  try {
    const body = {
      api_key: apiKey,
      query,
      search_depth: options.searchDepth || 'basic',
      max_results: options.maxResults || 5,
      include_answer: options.includeAnswer !== false,
      include_raw_content: options.includeRawContent || false,
    };

    if (options.includeDomains?.length) body.include_domains = options.includeDomains;
    if (options.excludeDomains?.length) body.exclude_domains = options.excludeDomains;
    if (options.topic) body.topic = options.topic;
    if (options.days) body.days = options.days;

    const res = await fetch(`${TAVILY_BASE}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(options.timeout || DEFAULT_TIMEOUT),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { success: false, error: `Tavily Search ${res.status}: ${errText}` };
    }

    const data = await res.json();
    const kredi = (options.searchDepth || 'basic') === 'advanced' ? 2 : 1;
    krediKullanımıLogla(`search:${query.substring(0, 50)}`, kredi);
    return {
      success: true,
      answer: data.answer || null,
      results: (data.results || []).map((r) => ({
        title: r.title,
        url: r.url,
        content: r.content,
        rawContent: r.raw_content || null,
        score: r.score,
        publishedDate: r.published_date,
      })),
      totalResults: data.results?.length || 0,
      query,
    };
  } catch (err) {
    return { success: false, error: `Tavily Search hatası: ${err.message}` };
  }
}

// ─── EXTRACT ────────────────────────────────────────────
/**
 * Tavily Extract - URL'lerden içerik çekme
 * @param {string[]} urls - İçerik çekilecek URL'ler (max 5)
 * @returns {Object} Her URL için çekilen içerik
 */
export async function tavilyExtract(urls) {
  const apiKey = TAVILY_API_KEY();
  if (!apiKey) {
    return { success: false, error: 'TAVILY_API_KEY ayarlanmamış' };
  }

  if (!urls?.length) {
    return { success: false, error: 'URL listesi boş' };
  }

  // Max 5 URL (API limiti)
  const urlList = urls.slice(0, 5);

  try {
    const res = await fetch(`${TAVILY_BASE}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        urls: urlList,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { success: false, error: `Tavily Extract ${res.status}: ${errText}` };
    }

    const data = await res.json();
    const successCount = (data.results || []).length;
    if (successCount > 0) {
      krediKullanımıLogla(`extract:${urlList.length}url`, successCount);
    }
    return {
      success: true,
      results: (data.results || []).map((r) => ({
        url: r.url,
        rawContent: r.raw_content,
        contentLength: r.raw_content?.length || 0,
      })),
      failedUrls: data.failed_results?.map((f) => f.url) || [],
    };
  } catch (err) {
    return { success: false, error: `Tavily Extract hatası: ${err.message}` };
  }
}

// ─── DEEP RESEARCH ──────────────────────────────────────
/**
 * Derin araştırma - Birden fazla arama + kaynak birleştirme
 * Tavily Search'ün advanced modunu kullanarak kapsamlı analiz yapar
 *
 * @param {string} topic - Araştırma konusu
 * @param {Object} options
 * @param {string[]} options.subQueries - Alt sorgu listesi (otomatik üretilmezse)
 * @param {number} options.maxSources - Maksimum kaynak sayısı (varsayılan: 10)
 * @param {string[]} options.focusDomains - Odaklanılacak domainler
 */
export async function tavilyResearch(topic, options = {}) {
  const apiKey = TAVILY_API_KEY();
  if (!apiKey) {
    return { success: false, error: 'TAVILY_API_KEY ayarlanmamış' };
  }

  try {
    // Ana arama (advanced depth = daha detaylı)
    const mainSearch = await tavilySearch(topic, {
      searchDepth: 'advanced',
      maxResults: options.maxSources || 10,
      includeAnswer: true,
      includeRawContent: false,
      includeDomains: options.focusDomains,
      topic: options.topic,
      days: options.days,
    });

    if (!mainSearch.success) return mainSearch;

    // Alt sorgular varsa onları da paralel çalıştır
    const subQueries = options.subQueries || [];
    const allResults = [...mainSearch.results];
    const allAnswers = [mainSearch.answer].filter(Boolean);

    if (subQueries.length > 0) {
      const subResults = await Promise.allSettled(
        subQueries.slice(0, 3).map((sq) =>
          tavilySearch(sq, {
            searchDepth: 'basic',
            maxResults: 5,
            includeAnswer: true,
            includeDomains: options.focusDomains,
          })
        )
      );

      for (const r of subResults) {
        if (r.status === 'fulfilled' && r.value.success) {
          allResults.push(...r.value.results);
          if (r.value.answer) allAnswers.push(r.value.answer);
        }
      }
    }

    // Duplicate URL'leri kaldır
    const seenUrls = new Set();
    const uniqueResults = allResults.filter((r) => {
      if (seenUrls.has(r.url)) return false;
      seenUrls.add(r.url);
      return true;
    });

    return {
      success: true,
      topic,
      summary: allAnswers.join('\n\n---\n\n'),
      sources: uniqueResults.map((r) => ({
        title: r.title,
        url: r.url,
        excerpt: r.content?.substring(0, 300),
        score: r.score,
      })),
      totalSources: uniqueResults.length,
      subQueriesUsed: subQueries.slice(0, 3),
    };
  } catch (err) {
    return { success: false, error: `Tavily Research hatası: ${err.message}` };
  }
}

// ─── FİYAT ÇIKARMA (Ortak Yardımcılar) ─────────────────

// Türkçe + İngilizce fiyat regex: "155 TL", "159,90 TL", "105.000,00 TL", "1.050,00 TL"
const PRICE_REGEX = /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)\s*(TL|₺|lira)/gi;

function parseTurkishPriceTavily(matchStr) {
  const numStr = matchStr.replace(/\s*(TL|₺|lira)\s*/gi, '').trim();
  if (numStr.includes('.') && numStr.includes(',')) {
    return parseFloat(numStr.replace(/\./g, '').replace(',', '.'));
  }
  if (numStr.includes(',')) {
    return parseFloat(numStr.replace(',', '.'));
  }
  if (numStr.includes('.')) {
    const parts = numStr.split('.');
    if (parts[parts.length - 1].length === 3) {
      return parseFloat(numStr.replace(/\./g, ''));
    }
    return parseFloat(numStr);
  }
  return parseFloat(numStr);
}

/**
 * Arama sonuçlarından TL fiyatlarını çıkarır
 * Hem AI özetinden hem snippet'lardan ayrıştırır
 */
function extractPricesFromSearchResult(searchResult) {
  const fiyatlar = [];

  // Answer'dan fiyat parse et
  if (searchResult.answer) {
    const matches = [...searchResult.answer.matchAll(PRICE_REGEX)];
    for (const m of matches) {
      const price = parseTurkishPriceTavily(m[0]);
      if (price > 0 && price < 50000) {
        fiyatlar.push({ fiyat: price, kaynak: 'ai_ozet' });
      }
    }
  }

  // Snippet'lardan fiyat parse et
  for (const r of searchResult.results || []) {
    const text = `${r.title || ''} ${r.content || ''}`;
    const matches = [...text.matchAll(PRICE_REGEX)];
    for (const m of matches) {
      const price = parseTurkishPriceTavily(m[0]);
      if (price > 0 && price < 50000) {
        fiyatlar.push({ fiyat: price, kaynak: r.url, baslik: r.title });
      }
    }
  }

  return fiyatlar;
}

/**
 * Tavily extract sonuçlarından ürün satırlarını çıkarır
 * Referans site içeriklerinden fiyat+ürün ayrıştırma
 */
function parseExtractedContent(rawContent, aramaTermi, targetUnit = null) {
  const results = [];
  if (!rawContent) return results;

  // Satır satır tara, fiyat içeren satırları bul
  const lines = rawContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length < 5 || trimmed.length > 500) continue;

    // Fiyat içeren satır mı?
    const priceMatches = [...trimmed.matchAll(PRICE_REGEX)];
    if (priceMatches.length === 0) continue;

    for (const pm of priceMatches) {
      const fiyat = parseTurkishPriceTavily(pm[0]);
      if (!fiyat || fiyat <= 0 || fiyat >= 50000) continue;

      // Ürün adı olarak satırın fiyat öncesi kısmını al
      const priceIdx = trimmed.indexOf(pm[0]);
      let urunMetni = trimmed.substring(0, priceIdx).trim();
      if (urunMetni.length < 3) urunMetni = trimmed;

      // Alaka kontrolü (market-scraper'ın isRelevantProduct'ı)
      const skor = calculateRelevanceScore(aramaTermi, urunMetni);
      if (skor < 30) continue;

      // Ürün adı parse (marka, ambalaj bilgisi çıkar)
      const parsed = parseProductName(urunMetni);

      // Birim fiyat hesapla
      const { unitPrice, perUnit, ambalajMiktar } = calculateUnitPrice(fiyat, urunMetni, targetUnit);

      results.push({
        market: 'Web',
        urun: urunMetni.substring(0, 200),
        fiyat,
        birimFiyat: unitPrice,
        birimTipi: perUnit,
        marka: parsed.marka || null,
        urunAdiTemiz: parsed.urunAdi,
        ambalajMiktar: ambalajMiktar || parsed.ambalajMiktar,
        aramaTermi,
        alakaSkor: skor,
      });
    }
  }

  return results;
}

// ─── PİYASA FİYAT ARAMA (Referans Sitelerle) ────────────
/**
 * Catering sektörüne özel referans sitelerden piyasa fiyatı arama
 * Tavily Search + Extract + mevcut parse altyapısı
 *
 * Akış:
 *  1. Ürün kategorisi tespit → uygun referans siteleri seç
 *  2. tavilySearch (basic, 1 kredi) → snippet'lerden fiyat çıkar
 *  3. Yetersizse tavilyExtract (2-3 kredi) → ham içerikten fiyat parse et
 *  4. Mevcut altyapı: parseProductName + calculateUnitPrice + isRelevantProduct
 *
 * @param {string} urunAdi - Ürün adı
 * @param {object} [options]
 * @param {string} [options.targetUnit] - Hedef birim (kg/L/adet)
 * @param {string[]} [options.siteler] - Özel site listesi (opsiyonel, yoksa otomatik)
 * @param {string} [options.searchDepth] - Arama derinliği (basic/advanced)
 * @param {object} [options.stokBilgi] - Stok kartı bilgisi (kategori tespiti için)
 * @returns {Object} Camgöz uyumlu sonuç formatı
 */
export async function tavilyPiyasaAra(urunAdi, options = {}) {
  const apiKey = TAVILY_API_KEY();
  if (!apiKey) {
    return { success: false, error: 'TAVILY_API_KEY ayarlanmamış', fiyatlar: [] };
  }

  const {
    targetUnit = null,
    siteler = null,
    searchDepth = KREDI_AYARLARI.varsayilanSearchDepth,
    stokBilgi = null,
  } = options;

  try {
    // 1. Kategori tespit ve site seçimi
    const { kategori, siteler: otomatikSiteler } = urunIcinSiteler(urunAdi, stokBilgi);
    const includeDomains = siteler || otomatikSiteler;

    // 2. Tavily Search - referans sitelerde ara
    const searchQuery = `${urunAdi} fiyat TL`;
    const searchResult = await tavilySearch(searchQuery, {
      searchDepth,
      maxResults: 10,
      includeAnswer: true,
      includeDomains,
    });

    const krediSearch = searchDepth === 'advanced' ? 2 : 1;
    krediKullanımıLogla(`piyasa_search:${urunAdi}`, krediSearch);

    if (!searchResult.success) {
      return { success: false, error: searchResult.error, fiyatlar: [], kategori };
    }

    // 3. Snippet'lerden fiyat çıkar (mevcut extractPricesFromSearchResult)
    const snippetFiyatlar = extractPricesFromSearchResult(searchResult);

    // Snippet'lerdeki URL'lerden ürün bilgisi zenginleştir
    const allResults = [];

    // Snippet fiyatlarını işle
    for (const sf of snippetFiyatlar) {
      const parsed = parseProductName(sf.baslik || urunAdi);
      const { unitPrice, perUnit, ambalajMiktar } = calculateUnitPrice(sf.fiyat, sf.baslik || urunAdi, targetUnit);

      // Kaynak URL'den market adı çıkar
      let marketAdi = 'Web';
      if (sf.kaynak && sf.kaynak !== 'ai_ozet') {
        try {
          const urlObj = new URL(sf.kaynak);
          marketAdi = urlObj.hostname.replace('www.', '').split('.')[0];
          // İlk harfi büyük yap
          marketAdi = marketAdi.charAt(0).toUpperCase() + marketAdi.slice(1);
        } catch { /* URL parse hatası, varsayılan kullan */ }
      } else if (sf.kaynak === 'ai_ozet') {
        marketAdi = 'AI Özet';
      }

      allResults.push({
        market: marketAdi,
        urun: sf.baslik || `${urunAdi} (web)`,
        fiyat: sf.fiyat,
        birimFiyat: unitPrice,
        birimTipi: perUnit,
        marka: parsed.marka || null,
        urunAdiTemiz: parsed.urunAdi,
        ambalajMiktar: ambalajMiktar || parsed.ambalajMiktar,
        aramaTermi: urunAdi,
        alakaSkor: 70,
        kaynak: sf.kaynak,
      });
    }

    // 4. Yetersiz sonuç varsa Extract ile zenginleştir
    let krediExtract = 0;
    if (allResults.length < KREDI_AYARLARI.extractEsik && searchResult.results?.length > 0) {
      // En alakalı URL'leri seç (score'a göre)
      const topUrls = searchResult.results
        .filter((r) => r.url && r.score > 0.3)
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, KREDI_AYARLARI.maxExtractUrl)
        .map((r) => r.url);

      if (topUrls.length > 0) {
        const extractResult = await tavilyExtract(topUrls);
        krediExtract = topUrls.length;
        krediKullanımıLogla(`piyasa_extract:${urunAdi}`, krediExtract);

        if (extractResult.success) {
          for (const er of extractResult.results || []) {
            const parsedItems = parseExtractedContent(er.rawContent, urunAdi, targetUnit);
            // Kaynak URL'den market adı
            let extractMarket = 'Web';
            try {
              const urlObj = new URL(er.url);
              extractMarket = urlObj.hostname.replace('www.', '').split('.')[0];
              extractMarket = extractMarket.charAt(0).toUpperCase() + extractMarket.slice(1);
            } catch { /* ignore */ }

            for (const item of parsedItems) {
              item.market = extractMarket;
              item.kaynak = er.url;
              allResults.push(item);
            }
          }
        }
      }
    }

    // 5. Sonuç yok mu?
    if (allResults.length === 0) {
      return {
        success: false,
        error: `"${urunAdi}" referans sitelerde bulunamadı`,
        fiyatlar: [],
        kategori,
        krediKullanimi: krediSearch + krediExtract,
      };
    }

    // 6. Deduplikasyon (aynı fiyat + aynı market)
    const seen = new Set();
    const uniqueResults = allResults.filter((r) => {
      const key = `${r.market}-${r.fiyat}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // 7. Birim fiyata göre sırala
    uniqueResults.sort((a, b) => a.birimFiyat - b.birimFiyat);

    // 8. Outlier temizleme (medyan bazlı)
    const sortedPrices = uniqueResults.map((f) => f.birimFiyat).sort((a, b) => a - b);
    const median = sortedPrices[Math.floor(sortedPrices.length / 2)];
    const cleanResults = uniqueResults.filter(
      (f) => f.birimFiyat >= median * 0.2 && f.birimFiyat <= median * 3.0
    );

    const finalResults = cleanResults.length >= 2 ? cleanResults : uniqueResults;

    // 9. İstatistikler
    const prices = finalResults.map((f) => f.birimFiyat).sort((a, b) => a - b);
    const ekonomikOrtalama =
      prices.slice(0, Math.min(5, prices.length)).reduce((s, p) => s + p, 0) /
      Math.min(5, prices.length);

    // En yaygın birim tipini bul
    const unitCounts = {};
    finalResults.forEach((f) => {
      unitCounts[f.birimTipi] = (unitCounts[f.birimTipi] || 0) + 1;
    });
    let dominantUnit = targetUnit || 'adet';
    if (!targetUnit) {
      if (unitCounts.kg >= 2) dominantUnit = 'kg';
      else if (unitCounts.L >= 2) dominantUnit = 'L';
    }

    // Marka gruplama
    const markaGruplari = {};
    for (const f of finalResults) {
      const key = f.marka || 'Diğer';
      if (!markaGruplari[key]) markaGruplari[key] = [];
      markaGruplari[key].push(f);
    }

    return {
      success: true,
      urun: urunAdi,
      aramaTermleri: [urunAdi],
      birim: dominantUnit,
      fiyatlar: finalResults.slice(0, 30),
      min: prices[0],
      max: prices[prices.length - 1],
      ortalama: Math.round(ekonomikOrtalama * 100) / 100,
      medyan: prices[Math.floor(prices.length / 2)],
      kaynak: 'tavily_referans',
      toplam_sonuc: finalResults.length,
      markalar: Object.keys(markaGruplari).filter((m) => m !== 'Diğer'),
      marka_gruplari: markaGruplari,
      // Ek meta bilgi
      kategori,
      kullanılanSiteler: includeDomains,
      krediKullanimi: krediSearch + krediExtract,
    };
  } catch (err) {
    return { success: false, error: `Tavily piyasa arama hatası: ${err.message}`, fiyatlar: [] };
  }
}

// ─── ESKİ TOPTAN FİYAT ARAMA (geriye uyumluluk) ─────────
/** @deprecated tavilyPiyasaAra kullanın */
export async function toptanFiyatAra(urunAdi) {
  // Yeni sisteme yönlendir
  return tavilyPiyasaAra(urunAdi, { searchDepth: 'basic' });
}

// ─── CRAWL ───────────────────────────────────────────────
/**
 * Tavily Crawl - Bir web sitesini tarayıp tüm sayfalarının içeriğini çeker
 * Scraper'a alternatif: tek API çağrısı ile site yapısını keşfeder
 *
 * @param {string} url - Taranacak root URL
 * @param {Object} options
 * @param {number} options.maxDepth - Tarama derinliği (1-5, varsayılan: 1)
 * @param {number} options.maxBreadth - Her seviyede taranacak link sayısı (varsayılan: 20)
 * @param {number} options.limit - Toplam taranacak sayfa limiti (varsayılan: 50)
 * @param {string} options.instructions - Doğal dil talimatı (nereleri tarayacağını yönlendirir)
 * @param {string[]} options.selectPaths - Sadece bu path'leri tara (regex, ör: ["/ihaleler/.*"])
 * @param {string[]} options.selectDomains - Sadece bu domain'leri tara (regex)
 * @param {'basic'|'advanced'} options.extractDepth - İçerik çekme derinliği
 * @param {boolean} options.allowExternal - Harici domain linklerini dahil et (varsayılan: false)
 */
export async function tavilyCrawl(url, options = {}) {
  const apiKey = TAVILY_API_KEY();
  if (!apiKey) {
    return { success: false, error: 'TAVILY_API_KEY ayarlanmamış' };
  }

  if (!url) {
    return { success: false, error: 'URL gerekli' };
  }

  try {
    const body = {
      url,
      max_depth: options.maxDepth || 1,
      max_breadth: options.maxBreadth || 20,
      limit: options.limit || 50,
      extract_depth: options.extractDepth || 'basic',
      allow_external: options.allowExternal || false,
    };

    if (options.instructions) body.instructions = options.instructions;
    if (options.selectPaths?.length) body.select_paths = options.selectPaths;
    if (options.selectDomains?.length) body.select_domains = options.selectDomains;

    const res = await fetch(`${TAVILY_BASE}/crawl`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(options.timeout || 60000), // Crawl daha uzun sürer
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { success: false, error: `Tavily Crawl ${res.status}: ${errText}` };
    }

    const data = await res.json();
    return {
      success: true,
      baseUrl: data.base_url || url,
      results: (data.results || []).map((r) => ({
        url: r.url,
        rawContent: r.raw_content || '',
        contentLength: r.raw_content?.length || 0,
      })),
      totalPages: data.results?.length || 0,
    };
  } catch (err) {
    return { success: false, error: `Tavily Crawl hatası: ${err.message}` };
  }
}

// ─── MAP ─────────────────────────────────────────────────
/**
 * Tavily Map - Bir web sitesinin yapısını (URL haritasını) çıkarır
 * Crawl'dan daha hızlı ve ucuz, sadece URL listesi döner (içerik yok)
 *
 * @param {string} url - Haritası çıkarılacak root URL
 * @param {Object} options
 * @param {number} options.maxDepth - Tarama derinliği (1-5, varsayılan: 1)
 * @param {number} options.maxBreadth - Her seviyede takip edilecek link (varsayılan: 20)
 * @param {number} options.limit - Toplam keşfedilecek URL limiti (varsayılan: 50)
 * @param {string} options.instructions - Doğal dil talimatı (hangi sayfaları bulsun)
 * @param {string[]} options.selectPaths - Path filtresi (regex)
 * @param {string[]} options.selectDomains - Domain filtresi (regex)
 * @param {boolean} options.allowExternal - Harici linkleri dahil et (varsayılan: false)
 */
export async function tavilyMap(url, options = {}) {
  const apiKey = TAVILY_API_KEY();
  if (!apiKey) {
    return { success: false, error: 'TAVILY_API_KEY ayarlanmamış' };
  }

  if (!url) {
    return { success: false, error: 'URL gerekli' };
  }

  try {
    const body = {
      url,
      max_depth: options.maxDepth || 1,
      max_breadth: options.maxBreadth || 20,
      limit: options.limit || 50,
      allow_external: options.allowExternal || false,
    };

    if (options.instructions) body.instructions = options.instructions;
    if (options.selectPaths?.length) body.select_paths = options.selectPaths;
    if (options.selectDomains?.length) body.select_domains = options.selectDomains;

    const res = await fetch(`${TAVILY_BASE}/map`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(options.timeout || 30000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { success: false, error: `Tavily Map ${res.status}: ${errText}` };
    }

    const data = await res.json();
    return {
      success: true,
      baseUrl: data.base_url || url,
      urls: data.urls || [],
      totalUrls: data.urls?.length || 0,
    };
  } catch (err) {
    return { success: false, error: `Tavily Map hatası: ${err.message}` };
  }
}

// ─── API KEY CHECK ──────────────────────────────────────
export function isTavilyConfigured() {
  return !!TAVILY_API_KEY();
}

export default {
  tavilySearch,
  tavilyExtract,
  tavilyResearch,
  tavilyCrawl,
  tavilyMap,
  tavilyPiyasaAra,
  toptanFiyatAra,
  getKrediKullanimi,
  isTavilyConfigured,
};
