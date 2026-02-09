/**
 * Tavily API Servisi
 * Tüm Tavily özelliklerini merkezi olarak yönetir
 *
 * Endpoints:
 * - search: Web araması + AI özet cevap
 * - extract: Belirli URL'lerden içerik çekme
 *
 * Ücretsiz plan: 1000 kredi/ay
 * Kredi kullanımı: basic search = 1, advanced search = 2, extract = 1/URL
 */

const TAVILY_API_KEY = () => process.env.TAVILY_API_KEY || '';
const TAVILY_BASE = 'https://api.tavily.com';
const DEFAULT_TIMEOUT = 15000;

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

// ─── TOPTAN FİYAT ARAMA ────────────────────────────────
/**
 * Toptan gıda sitelerinden fiyat arama
 * Tavily Search'ü belirli toptan sitelerde kullanır
 *
 * @param {string} urunAdi - Ürün adı
 * @returns {Object} Bulunan fiyatlar
 */
const TOPTAN_DOMAINS = [
  'toptangida.com',
  'bizimtoptan.com.tr',
  'trendyol.com',
  'hepsiburada.com',
  'migros.com.tr',
  'a101.com.tr',
  'carrefoursa.com',
];

/**
 * Arama sonuçlarından TL fiyatlarını çıkarır
 * Hem AI özetinden hem snippet'lardan ayrıştırır
 * Türkçe format desteği: 105.000,00 TL → 105000
 */
function extractPricesFromSearchResult(searchResult) {
  const fiyatlar = [];

  // Türkçe + İngilizce fiyat regex: "155 TL", "159,90 TL", "105.000,00 TL", "1.050,00 TL"
  const priceRegex = /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)\s*(TL|₺|lira)/gi;

  function parseTurkishPrice(matchStr) {
    // Sadece TL/₺/lira ve rakam/nokta/virgül bırak
    const numStr = matchStr.replace(/\s*(TL|₺|lira)\s*/gi, '').trim();

    // Türkçe format tespiti: noktayı binlik ayracı, virgülü ondalık olarak kullan
    // Eğer hem nokta hem virgül varsa: 105.000,00 → 105000.00
    if (numStr.includes('.') && numStr.includes(',')) {
      return parseFloat(numStr.replace(/\./g, '').replace(',', '.'));
    }
    // Sadece virgül varsa: 159,90 → 159.90
    if (numStr.includes(',')) {
      return parseFloat(numStr.replace(',', '.'));
    }
    // Sadece nokta varsa: kontrol et binlik mi ondalık mı
    // 1.050 → binlik (4+ rakam sonrası), 15.99 → ondalık
    if (numStr.includes('.')) {
      const parts = numStr.split('.');
      if (parts[parts.length - 1].length === 3) {
        // Binlik ayracı: 1.050 → 1050
        return parseFloat(numStr.replace(/\./g, ''));
      }
      // Ondalık: 15.99
      return parseFloat(numStr);
    }
    return parseFloat(numStr);
  }

  // Answer'dan fiyat parse et
  if (searchResult.answer) {
    const matches = [...searchResult.answer.matchAll(priceRegex)];
    for (const m of matches) {
      const price = parseTurkishPrice(m[0]);
      if (price > 0 && price < 50000) {
        fiyatlar.push({ fiyat: price, kaynak: 'ai_ozet' });
      }
    }
  }

  // Snippet'lardan fiyat parse et
  for (const r of searchResult.results || []) {
    const text = `${r.title || ''} ${r.content || ''}`;
    const matches = [...text.matchAll(priceRegex)];
    for (const m of matches) {
      const price = parseTurkishPrice(m[0]);
      if (price > 0 && price < 50000) {
        fiyatlar.push({ fiyat: price, kaynak: r.url, baslik: r.title });
      }
    }
  }

  return fiyatlar;
}

export async function toptanFiyatAra(urunAdi) {
  const apiKey = TAVILY_API_KEY();
  if (!apiKey) {
    return { success: false, error: 'TAVILY_API_KEY ayarlanmamış' };
  }

  try {
    // Aşama 1: Toptan sitelerde ara
    const toptanResult = await tavilySearch(`${urunAdi} fiyat kg toptan`, {
      searchDepth: 'advanced',
      maxResults: 8,
      includeAnswer: true,
      includeDomains: TOPTAN_DOMAINS,
    });

    let fiyatlar = [];
    if (toptanResult.success) {
      fiyatlar = extractPricesFromSearchResult(toptanResult);
    }

    // Aşama 2: Toptan aramada fiyat bulanamadıysa genel ara
    if (fiyatlar.length === 0) {
      const genelResult = await tavilySearch(`${urunAdi} toptan fiyat TL kg 2026`, {
        searchDepth: 'basic',
        maxResults: 8,
        includeAnswer: true,
      });
      if (genelResult.success) {
        fiyatlar = extractPricesFromSearchResult(genelResult);
      }
    }

    if (fiyatlar.length === 0) {
      return { success: false, error: `"${urunAdi}" toptan sitelerde bulunamadı` };
    }

    // Outlier temizleme: medyandan çok uzak fiyatları at
    const sortedPrices = fiyatlar.map((f) => f.fiyat).sort((a, b) => a - b);
    const median = sortedPrices[Math.floor(sortedPrices.length / 2)];
    const filtered = fiyatlar.filter((f) => f.fiyat >= median * 0.3 && f.fiyat <= median * 3);

    const prices = filtered.map((f) => f.fiyat);
    const avg = Math.round((prices.reduce((s, p) => s + p, 0) / prices.length) * 100) / 100;

    return {
      success: true,
      urun: urunAdi,
      fiyatlar: filtered,
      min: Math.min(...prices),
      max: Math.max(...prices),
      ortalama: avg,
      kaynakSayisi: filtered.length,
      kaynakTip: 'toptan_site',
    };
  } catch (err) {
    return { success: false, error: `Toptan fiyat arama hatası: ${err.message}` };
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
  toptanFiyatAra,
  isTavilyConfigured,
};
