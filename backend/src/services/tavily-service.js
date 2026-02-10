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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TAVILY ULTRA-CURRENT CATERING PRICE ENGINE (2026)
// Fiyat doğrulama motoru — yıl bazlı fiyat YASAK,
// gün/hafta bazlı güncel fiyat hedeflenir.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ─── ORTAK REGEX & PARSE ─────────────────────────────────

// Türkçe fiyat regex: "155 TL", "159,90 TL", "1.050,00 TL", "420₺"
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

// ─── 1. TARİH TESPİT MOTORU ─────────────────────────────

const BUGUN = () => new Date();

// Türkçe ay isimleri
const TR_AYLAR = {
  ocak: 0, şubat: 1, mart: 2, nisan: 3, mayıs: 4, haziran: 5,
  temmuz: 6, ağustos: 7, eylül: 8, ekim: 9, kasım: 10, aralık: 11,
};

/**
 * Metin içinden tarih bilgisi çıkar ve gün farkını hesaplar
 * @returns {{ detectedDate: Date|null, gunFark: number, tip: string }}
 */
function _detectDateInText(text) {
  if (!text) return { detectedDate: null, gunFark: Infinity, tip: 'yok' };
  const lower = text.toLowerCase();
  const now = BUGUN();

  // ── Günlük sinyaller (timeScore = 1.0) ──
  if (/\bbugün\b|\bbu ?gün\b|\bgüncel fiyat\b|\bson güncelleme\b/i.test(lower)) {
    return { detectedDate: now, gunFark: 0, tip: 'gun' };
  }

  // ── Haftalık sinyaller (timeScore = 0.85) ──
  if (/\bbu hafta\b|\bbu haftaki\b|\bhaftalık\b|\bson 7 gün\b/i.test(lower)) {
    return { detectedDate: now, gunFark: 3, tip: 'hafta' };
  }

  // ── Açık tarih: "5 Şubat 2026", "05.02.2026", "2026-02-05" ──
  // Pattern A: 5 Şubat 2026 / 5 şubat 2026
  const trDateRegex = /(\d{1,2})\s+(ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)\s+(20\d{2})/gi;
  const trMatch = trDateRegex.exec(lower);
  if (trMatch) {
    const gun = parseInt(trMatch[1], 10);
    const ay = TR_AYLAR[trMatch[2]];
    const yil = parseInt(trMatch[3], 10);
    if (ay !== undefined) {
      const d = new Date(yil, ay, gun);
      const fark = Math.floor((now - d) / 86400000);
      return { detectedDate: d, gunFark: Math.max(0, fark), tip: fark <= 1 ? 'gun' : fark <= 7 ? 'hafta' : fark <= 30 ? 'ay' : 'eski' };
    }
  }

  // Pattern B: 05.02.2026 veya 05/02/2026
  const dotDateRegex = /(\d{2})[./](\d{2})[./](20\d{2})/;
  const dotMatch = dotDateRegex.exec(text);
  if (dotMatch) {
    const d = new Date(parseInt(dotMatch[3], 10), parseInt(dotMatch[2], 10) - 1, parseInt(dotMatch[1], 10));
    const fark = Math.floor((now - d) / 86400000);
    return { detectedDate: d, gunFark: Math.max(0, fark), tip: fark <= 1 ? 'gun' : fark <= 7 ? 'hafta' : fark <= 30 ? 'ay' : 'eski' };
  }

  // Pattern C: 2026-02-05 (ISO)
  const isoDateRegex = /(20\d{2})-(\d{2})-(\d{2})/;
  const isoMatch = isoDateRegex.exec(text);
  if (isoMatch) {
    const d = new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10));
    const fark = Math.floor((now - d) / 86400000);
    return { detectedDate: d, gunFark: Math.max(0, fark), tip: fark <= 1 ? 'gun' : fark <= 7 ? 'hafta' : fark <= 30 ? 'ay' : 'eski' };
  }

  // ── Yıl referansı: "2026" var mı? ──
  if (/\b2026\b/.test(text)) {
    return { detectedDate: null, gunFark: 15, tip: 'ay' };
  }

  // ── Eski/geçersiz sinyaller ──
  if (/\b202[0-4]\b/.test(text) || /\b2025 fiyat/i.test(lower)) {
    return { detectedDate: null, gunFark: 365, tip: 'eski' };
  }

  // Hiçbir tarih sinyali yok
  return { detectedDate: null, gunFark: Infinity, tip: 'yok' };
}

/**
 * Time Freshness Score
 * gün bazlı → 1.0, hafta bazlı → 0.85, ay bazlı → 0.4, diğer → 0
 */
function _calculateTimeScore(dateInfo) {
  switch (dateInfo.tip) {
    case 'gun': return 1.0;
    case 'hafta': return 0.85;
    case 'ay': return 0.4;
    default: return 0;
  }
}

// ─── 2. ZAMAN ODAKLI ARAMA SORGUSU ──────────────────────

/**
 * Güncellik sinyali içeren arama sorguları üret
 * Her kategori için 2 sorgu: birincil + yedek
 */
function _buildTimeAwareQueries(urunAdi, kategori, targetUnit) {
  const birimEki = targetUnit === 'kg' ? 'kg fiyatı' : targetUnit === 'L' ? 'litre fiyatı' : 'fiyat';

  // Birincil sorgu: güncellik vurgusu
  const queries = [];

  switch (kategori) {
    case 'taze':
      queries.push(`${urunAdi} güncel ${birimEki} bugün`);
      queries.push(`${urunAdi} bu hafta toptan ${birimEki}`);
      break;
    case 'et_sut':
      queries.push(`${urunAdi} güncel ${birimEki} market`);
      queries.push(`${urunAdi} son fiyat TL`);
      break;
    case 'toptan_buyuk':
      queries.push(`${urunAdi} toptan güncel fiyat`);
      queries.push(`${urunAdi} bu hafta toptan fiyat listesi`);
      break;
    case 'temizlik':
      queries.push(`${urunAdi} güncel fiyat karşılaştırma`);
      break;
    default:
      queries.push(`${urunAdi} güncel ${birimEki}`);
      queries.push(`${urunAdi} son fiyat TL`);
  }

  return queries;
}

// ─── 3. SNIPPET + EXTRACT FİYAT ÇIKARIMI (TIME-AWARE) ───

// Toptan kaynaklar (catering için öncelikli)
const TOPTAN_DOMAINS = new Set([
  'tarimziraat.com', 'hal.gov.tr', 'bizimtoptan.com.tr', 'toptanburada.com',
  'gidamarket.com', 'toptanperakende.com',
]);

function _kaynakTipi(url) {
  if (!url || url === 'ai_ozet') return 'bilinmiyor';
  try {
    const host = new URL(url).hostname.replace('www.', '');
    if (TOPTAN_DOMAINS.has(host)) return 'toptan';
    return 'perakende';
  } catch { return 'bilinmiyor'; }
}

/**
 * Fiyatın etrafındaki metinden ürün bilgisini çıkar
 * "Tavuk Göğsü Kg 199 TL" → "Tavuk Göğsü Kg"
 * "Et ve Tavuk Çeşitleri... Pirzola 249 TL Göğsü 199 TL" → "Göğsü"
 */
function _extractPriceContext(fullText, priceMatch) {
  if (!fullText || !priceMatch) return null;

  const priceIdx = fullText.indexOf(priceMatch[0]);
  if (priceIdx < 0) return null;

  // Fiyattan önceki 80 karakteri al, son cümle/satır sınırına kadar
  const before = fullText.substring(Math.max(0, priceIdx - 80), priceIdx);
  // Son satır sonu veya noktalama sonrası kısmı al
  const lastBreak = Math.max(
    before.lastIndexOf('\n'),
    before.lastIndexOf('.'),
    before.lastIndexOf('|'),
    before.lastIndexOf('·'),
    before.lastIndexOf('—'),
    before.lastIndexOf('-'),
    0
  );
  const beforeContext = before.substring(lastBreak > 0 ? lastBreak + 1 : 0).trim();

  // Fiyattan sonraki 30 karakteri de al (birim bilgisi: "/kg", "TL/lt" vb.)
  const afterStart = priceIdx + priceMatch[0].length;
  const after = fullText.substring(afterStart, afterStart + 30).split(/[\n.|]/)[0].trim();

  const context = `${beforeContext} ${priceMatch[0]} ${after}`.trim();
  return context.length >= 3 ? context : null;
}

/**
 * Arama sonuçlarından TL fiyatlarını çıkarır (tarih + context zenginleştirilmiş)
 */
function _extractPricesWithTime(searchResult) {
  const fiyatlar = [];

  // Answer'dan fiyat parse et
  if (searchResult.answer) {
    const answerDateInfo = _detectDateInText(searchResult.answer);
    const matches = [...searchResult.answer.matchAll(PRICE_REGEX)];
    for (const m of matches) {
      const price = parseTurkishPriceTavily(m[0]);
      if (price > 0 && price < 50000) {
        fiyatlar.push({
          fiyat: price,
          kaynak: 'ai_ozet',
          baslik: null,
          priceContext: _extractPriceContext(searchResult.answer, m),
          dateInfo: answerDateInfo,
          timeScore: _calculateTimeScore(answerDateInfo),
          fullText: searchResult.answer,
        });
      }
    }
  }

  // Snippet'lardan fiyat parse et — her URL'den max 2 fiyat
  for (const r of searchResult.results || []) {
    const text = `${r.title || ''} ${r.content || ''}`;
    const dateInfo = _detectDateInText(text);

    // publishedDate varsa Tavily meta'sından da yararlan
    if (r.publishedDate && dateInfo.tip === 'yok') {
      try {
        const pd = new Date(r.publishedDate);
        const fark = Math.floor((BUGUN() - pd) / 86400000);
        dateInfo.detectedDate = pd;
        dateInfo.gunFark = Math.max(0, fark);
        dateInfo.tip = fark <= 1 ? 'gun' : fark <= 7 ? 'hafta' : fark <= 30 ? 'ay' : 'eski';
      } catch { /* ignore parse error */ }
    }

    // Tarih tespit edilemezse Tavily score'una göre varsayımsal skor
    if (dateInfo.tip === 'yok' && r.score) {
      if (r.score >= 0.7) { dateInfo.tip = 'hafta'; dateInfo.gunFark = 5; }
      else if (r.score >= 0.5) { dateInfo.tip = 'ay'; dateInfo.gunFark = 20; }
    }

    const matches = [...text.matchAll(PRICE_REGEX)];
    const snippetPrices = [];

    for (const m of matches) {
      const price = parseTurkishPriceTavily(m[0]);
      if (price > 0 && price < 50000) {
        snippetPrices.push({
          fiyat: price,
          kaynak: r.url,
          baslik: r.title,
          priceContext: _extractPriceContext(text, m),
          dateInfo,
          timeScore: _calculateTimeScore(dateInfo),
          tavilyScore: r.score || 0,
          fullText: text,
          kaynakTipi: _kaynakTipi(r.url),
        });
      }
    }

    // Aynı snippet'ten max 2 fiyat
    // Birim fiyat ifadesi içerenleri (TL/kg, TL/lt) öncelikle seç
    const unitPriceRegex = /(?:tl\s*\/\s*(?:kg|lt|l|kilo|litre))|(?:\/\s*(?:kg|lt|l))/i;
    const withUnit = snippetPrices.filter(p => p.priceContext && unitPriceRegex.test(p.priceContext));
    const withoutUnit = snippetPrices.filter(p => !p.priceContext || !unitPriceRegex.test(p.priceContext));

    // Birim fiyat olanlar önce, geri kalanlar sonra → max 2
    const prioritized = [...withUnit, ...withoutUnit].slice(0, 2);
    fiyatlar.push(...prioritized);
  }

  return fiyatlar;
}

/**
 * Tavily extract sonuçlarından ürün satırlarını çıkarır (time-aware)
 */
function _parseExtractedContentWithTime(rawContent, aramaTermi, targetUnit, sourceUrl) {
  const results = [];
  if (!rawContent) return results;

  // Sayfa genelinde tarih tespiti (en güçlü sinyal)
  const pageDate = _detectDateInText(rawContent.substring(0, 2000)); // İlk 2K'da tarih ara

  // Tarih bulunamazsa: extract zaten yüksek score'lu URL'lerden geldi → haftalık varsay
  if (pageDate.tip === 'yok') {
    pageDate.tip = 'hafta';
    pageDate.gunFark = 5;
  }

  const lines = rawContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length < 5 || trimmed.length > 500) continue;

    const priceMatches = [...trimmed.matchAll(PRICE_REGEX)];
    if (priceMatches.length === 0) continue;

    for (const pm of priceMatches) {
      const fiyat = parseTurkishPriceTavily(pm[0]);
      if (!fiyat || fiyat <= 0 || fiyat >= 50000) continue;

      const priceIdx = trimmed.indexOf(pm[0]);
      let urunMetni = trimmed.substring(0, priceIdx).trim();
      if (urunMetni.length < 3) urunMetni = trimmed;

      // Alaka kontrolü
      const relevanceScore = calculateRelevanceScore(aramaTermi, urunMetni);
      if (relevanceScore < 40) continue;

      // Satır bazlı tarih (varsa satırdan, yoksa sayfa genelinden)
      const lineDate = _detectDateInText(trimmed);
      const dateInfo = lineDate.tip !== 'yok' ? lineDate : pageDate;
      const timeScore = _calculateTimeScore(dateInfo);

      // finalScore hesapla: relevance * 0.6 + timeScore * 40
      const finalScore = relevanceScore * 0.6 + timeScore * 40;
      if (finalScore < 70) continue; // ELENİR

      const parsed = parseProductName(urunMetni);
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
        relevanceScore,
        timeScore,
        finalScore,
        detectedDate: dateInfo.detectedDate,
        kaynak: sourceUrl,
      });
    }
  }

  return results;
}

// ─── 4. AI ANSWER PARSE (TARİH ŞARTLI) ──────────────────

/**
 * Tavily AI answer'dan yapısal fiyat çıkar
 * AI answer = Tavily'nin güncel aramadan ürettiği özet → genellikle güvenilir
 * Tarih yoksa bile timeScore=0.85 ile kabul et (Tavily zaten güncel kaynaklardan üretir)
 */
function _extractAnswerPricesWithTime(answer, urunAdi, targetUnit) {
  if (!answer) return [];

  const answerDate = _detectDateInText(answer);
  // Eski tarihli cevabı reddet (2024 vs), ama tarihsiz cevabı KABUL ET
  if (answerDate.tip === 'eski') return [];

  // Tarih yoksa bile Tavily AI answer güvenilir → 0.85 ata
  const timeScore = answerDate.tip === 'yok' ? 0.85 : _calculateTimeScore(answerDate);
  const results = [];

  // Pattern 1: "X TL ile Y TL arasında" veya "X-Y TL" veya "X–Y TL"
  const rangeRegex = /(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:TL|₺)?\s*(?:ile|[-–—])\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:TL|₺)/gi;
  for (const rm of answer.matchAll(rangeRegex)) {
    const low = parseTurkishPriceTavily(`${rm[1]} TL`);
    const high = parseTurkishPriceTavily(`${rm[2]} TL`);
    if (low > 0 && high > 0 && low < 50000 && high < 50000) {
      const avg = Math.round(((low + high) / 2) * 100) / 100;
      const { unitPrice, perUnit, ambalajMiktar } = calculateUnitPrice(avg, urunAdi, targetUnit);
      results.push({
        market: 'AI Özet',
        urun: `${urunAdi} (aralık)`,
        fiyat: avg,
        birimFiyat: unitPrice,
        birimTipi: perUnit,
        marka: null,
        urunAdiTemiz: urunAdi,
        ambalajMiktar,
        aramaTermi: urunAdi,
        relevanceScore: 75,
        timeScore,
        finalScore: 75 * 0.6 + timeScore * 40,
        detectedDate: answerDate.detectedDate,
        kaynak: 'ai_ozet_range',
      });
    }
  }

  // Pattern 2: "ortalama X TL" / "yaklaşık X TL" / "genellikle X TL"
  const avgRegex = /(?:ortalama|yaklaşık|genellikle|civarında)\s+(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:TL|₺)/gi;
  for (const am of answer.matchAll(avgRegex)) {
    const price = parseTurkishPriceTavily(`${am[1]} TL`);
    if (price > 0 && price < 50000) {
      const { unitPrice, perUnit, ambalajMiktar } = calculateUnitPrice(price, urunAdi, targetUnit);
      results.push({
        market: 'AI Özet',
        urun: `${urunAdi} (yaklaşık)`,
        fiyat: price,
        birimFiyat: unitPrice,
        birimTipi: perUnit,
        marka: null,
        urunAdiTemiz: urunAdi,
        ambalajMiktar,
        aramaTermi: urunAdi,
        relevanceScore: 70,
        timeScore,
        finalScore: 70 * 0.6 + timeScore * 40,
        detectedDate: answerDate.detectedDate,
        kaynak: 'ai_ozet_avg',
      });
    }
  }

  return results;
}

// ─── 5. CONFIDENCE & SELF-SUFFICIENCY ────────────────────

/**
 * Tavily sonuçlarının kendi başına yeterli olup olmadığını belirle
 * @returns {{ confidence: number, yeterli: boolean, sebep: string }}
 */
function _calculateConfidence(results) {
  if (!results.length) return { confidence: 0, yeterli: false, sebep: 'Sonuç yok' };

  // Ortalama finalScore
  const avgFinalScore = results.reduce((s, r) => s + (r.finalScore || 0), 0) / results.length;

  // Farklı kaynak sayısı (unique domain)
  const kaynaklar = new Set();
  for (const r of results) {
    if (r.kaynak && r.kaynak !== 'ai_ozet' && !r.kaynak.startsWith('ai_ozet')) {
      try { kaynaklar.add(new URL(r.kaynak).hostname); } catch { /* ignore */ }
    }
  }
  const kaynakSayisi = kaynaklar.size;

  // Fiyat tutarlılığı (düşük varyans = yüksek tutarlılık)
  const fiyatlar = results.map((r) => r.birimFiyat).filter(Boolean);
  let fiyatTutarliligi = 0;
  if (fiyatlar.length >= 2) {
    const avg = fiyatlar.reduce((s, p) => s + p, 0) / fiyatlar.length;
    const maxFark = Math.max(...fiyatlar.map((p) => Math.abs(p - avg) / avg));
    fiyatTutarliligi = maxFark <= 0.2 ? 1.0 : maxFark <= 0.4 ? 0.6 : 0.3;
  }

  // Son 7 gün içinde olan sonuç sayısı
  const recentCount = results.filter((r) => r.timeScore >= 0.85).length;

  const confidence =
    (avgFinalScore / 100) * 0.5 +
    Math.min(kaynakSayisi, 5) * 0.04 + // max 0.2
    fiyatTutarliligi * 0.3;

  // Yeterlilik kriterleri (SERT)
  // 1. En az 2 farklı kaynak
  // 2. En az 2'si son 7 gün
  // 3. Fiyat farkı %20'den küçük
  // 4. relevanceScore ortalaması ≥ 75
  const avgRelevance = results.reduce((s, r) => s + (r.relevanceScore || 0), 0) / results.length;

  let yeterli = true;
  let sebep = 'Tavily yeterli';

  if (kaynakSayisi < 2) { yeterli = false; sebep = `Kaynak yetersiz (${kaynakSayisi} < 2)`; }
  else if (recentCount < 2) { yeterli = false; sebep = `Güncel kaynak yetersiz (${recentCount} < 2)`; }
  else if (fiyatTutarliligi < 0.6) { yeterli = false; sebep = 'Fiyat tutarsızlığı yüksek (>%20)'; }
  else if (avgRelevance < 75) { yeterli = false; sebep = `Alaka düşük (${Math.round(avgRelevance)} < 75)`; }
  else if (confidence < 0.75) { yeterli = false; sebep = `Confidence düşük (${confidence.toFixed(2)} < 0.75)`; }

  return { confidence: Math.round(confidence * 100) / 100, yeterli, sebep };
}

// ─── 6. ANA FONKSİYON: tavilyPiyasaAra ──────────────────
/**
 * Tavily Ultra-Current Catering Price Engine
 *
 * Fiyat doğrulama motoru — SADECE güncel (gün/hafta bazlı) fiyatları kabul eder.
 * Yıl bazlı fiyat YASAK. Tarihsiz fiyat ÇÖP.
 *
 * Akış:
 *  1. Güncellik odaklı sorgular üret
 *  2. Referans sitelerde ara → bulamazsa açık web'de ara
 *  3. Her sonuca: relevanceScore + timeScore → finalScore
 *  4. finalScore < 70 → ELEN
 *  5. Confidence hesapla → yeterli değilse fallback flag
 *
 * @param {string} urunAdi - Ürün adı
 * @param {object} [options]
 * @param {string} [options.targetUnit] - Hedef birim (kg/L/adet)
 * @param {string[]} [options.siteler] - Özel site listesi
 * @param {string} [options.searchDepth] - basic/advanced
 * @param {object} [options.stokBilgi] - Stok kartı bilgisi
 * @returns {Object} Fiyat sonuçları + confidence + fallback flag
 */
export async function tavilyPiyasaAra(urunAdi, options = {}) {
  const apiKey = TAVILY_API_KEY();
  if (!apiKey) {
    return { success: false, error: 'TAVILY_API_KEY ayarlanmamış', fiyatlar: [], fallback: true };
  }

  const {
    targetUnit = null,
    siteler = null,
    searchDepth = KREDI_AYARLARI.varsayilanSearchDepth,
    stokBilgi = null,
    mode = 'full', // 'ai_only' = sadece AI answer, 'full' = AI + snippet + extract
  } = options;

  try {
    // ── 1. Kategori tespit & sorgu üret ──
    const { kategori, siteler: otomatikSiteler } = urunIcinSiteler(urunAdi, stokBilgi);
    const includeDomains = siteler || otomatikSiteler;
    const queries = _buildTimeAwareQueries(urunAdi, kategori, targetUnit);

    // ── 2. Tavily Search: referans sitelerde ara ──
    let searchResult = await tavilySearch(queries[0], {
      searchDepth,
      maxResults: 15,
      includeAnswer: true,
      includeDomains,
    });

    let krediSearch = searchDepth === 'advanced' ? 2 : 1;
    krediKullanımıLogla(`piyasa_search:${urunAdi}`, krediSearch);

    // 2b. Domain kısıtlı arama yetersizse → açık web'de ikinci sorgu
    const hasUsefulResults = searchResult.success &&
      searchResult.results?.some((r) => r.score > 0.4);

    if (!hasUsefulResults && queries.length > 1) {
      const fallbackResult = await tavilySearch(queries[1], {
        searchDepth: 'basic',
        maxResults: 15,
        includeAnswer: true,
        // includeDomains YOK → tüm web
      });
      krediSearch += 1;
      krediKullanımıLogla(`piyasa_search_open:${urunAdi}`, 1);

      if (fallbackResult.success) {
        const existingUrls = new Set((searchResult.results || []).map((r) => r.url));
        const newResults = (fallbackResult.results || []).filter((r) => !existingUrls.has(r.url));
        searchResult = {
          ...searchResult,
          success: true,
          answer: searchResult.answer || fallbackResult.answer,
          results: [...(searchResult.results || []), ...newResults],
        };
      }
    }

    if (!searchResult.success) {
      return { success: false, error: searchResult.error, fiyatlar: [], kategori, fallback: true };
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // AI-FIRST MİMARİ:
    // 1. AI answer = BİRİNCİL KAYNAK (zaten anlamlı, bağlamlı)
    // 2. Snippet regex = DOĞRULAMA (AI fiyatını teyit eder)
    // 3. Extract = SON ÇARE (sadece hiç sonuç yoksa)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    const allResults = [];
    let krediExtract = 0;

    // ── ADIM 1: AI ANSWER (BİRİNCİL) ──
    // Tavily AI zaten doğru bağlamda, doğru birimde fiyat veriyor
    // Regex hatası riski yok, çift bölme yok, yanlış ürün eşleşmesi yok
    let aiFiyatlar = [];
    if (searchResult.answer) {
      aiFiyatlar = _extractAnswerPricesWithTime(searchResult.answer, urunAdi, targetUnit);
      for (const ap of aiFiyatlar) {
        allResults.push(ap);
      }
    }

    // AI answer'daki ham fiyatları da al (range/ortalama pattern'e uymayan tekil fiyatlar)
    if (searchResult.answer) {
      const answerDateInfo = _detectDateInText(searchResult.answer);
      // Tarihli cevaplardaki tekil fiyatlar
      if (answerDateInfo.tip !== 'yok' && answerDateInfo.tip !== 'eski') {
        const timeScore = _calculateTimeScore(answerDateInfo);
        const answerMatches = [...searchResult.answer.matchAll(PRICE_REGEX)];
        for (const m of answerMatches) {
          const price = parseTurkishPriceTavily(m[0]);
          if (price > 0 && price < 50000) {
            // AI answer'daki fiyatı birim dönüşümü YAPMADAN al
            // Çünkü AI zaten "kg fiyatı 280 TL" diyorsa 280 = birim fiyat
            const isDup = allResults.some((r) => Math.abs(r.fiyat - price) < 1);
            if (!isDup) {
              allResults.push({
                market: 'AI Özet',
                urun: urunAdi,
                fiyat: price,
                birimFiyat: price, // AI fiyatı = birim fiyat (sorgu zaten birim bazlı)
                birimTipi: targetUnit || 'kg',
                marka: null,
                urunAdiTemiz: urunAdi,
                ambalajMiktar: null,
                aramaTermi: urunAdi,
                relevanceScore: 80,
                timeScore,
                finalScore: 80 * 0.6 + timeScore * 40,
                detectedDate: answerDateInfo.detectedDate,
                kaynak: 'ai_ozet',
                kaynakTipi: 'ai',
              });
            }
          }
        }
      }
    }

    // ── AI_ONLY MOD: Sadece AI answer ile dön (Camgöz birincil olduğunda) ──
    if (mode === 'ai_only') {
      if (allResults.length === 0) {
        return {
          success: false,
          error: `"${urunAdi}" için Tavily AI answer bulunamadı`,
          fiyatlar: [],
          kategori,
          krediKullanimi: krediSearch,
          fallback: true,
          confidence: 0,
          yeterli: false,
        };
      }

      // AI answer sonuçlarıyla hızlı dön — snippet parsing yok
      const prices = allResults.map(f => f.birimFiyat).sort((a, b) => a - b);
      const ekonomikOrt = prices.slice(0, Math.min(5, prices.length)).reduce((s, p) => s + p, 0) / Math.min(5, prices.length);

      return {
        success: true,
        urun: urunAdi,
        aramaTermleri: queries,
        birim: targetUnit || 'kg',
        fiyatlar: allResults,
        toplam_sonuc: allResults.length,
        ekonomik_ortalama: Math.round(ekonomikOrt * 100) / 100,
        kategori,
        krediKullanimi: krediSearch,
        confidence: 0.7, // AI answer = güvenilir ama tek kaynak
        yeterli: false,  // Camgöz birincil olduğunda Tavily hiçbir zaman "yeterli" deme
        fallback: true,   // Her zaman Camgöz ile birleştirilsin
        confidenceSebep: 'AI-only mod (Camgöz tamamlayıcısı)',
        aiAnswer: searchResult.answer || null,
      };
    }

    // AI anchor fiyat — snippet doğrulaması için referans nokta
    const aiAnchor = allResults.length > 0
      ? allResults.reduce((s, r) => s + r.birimFiyat, 0) / allResults.length
      : null;

    // ── ADIM 2: SNIPPET FİYATLARI (DOĞRULAMA ROLÜ) ──
    // AI fiyatıyla tutarlı snippet'ler = güçlendirici
    // AI fiyatından çok sapan snippet'ler = muhtemelen hatalı → ELEN
    const rawPrices = _extractPricesWithTime(searchResult);

    for (const sf of rawPrices) {
      if (sf.kaynak === 'ai_ozet') continue; // AI answer zaten işlendi

      const snippetText = sf.baslik || '';
      if (sf.timeScore < 0.8) continue;

      // Alaka kontrolü
      let relevanceScore = 0;
      let urunMetni = snippetText;
      const contextScore = sf.priceContext ? calculateRelevanceScore(urunAdi, sf.priceContext) : 0;
      const titleScore = snippetText ? calculateRelevanceScore(urunAdi, snippetText) : 0;

      if (contextScore >= titleScore && contextScore > 0) {
        relevanceScore = contextScore;
        urunMetni = sf.priceContext;
      } else {
        relevanceScore = titleScore;
      }

      const finalScore = relevanceScore * 0.6 + sf.timeScore * 40;
      if (finalScore < 70) continue;

      // Birim fiyat hesapla — ÇİFT BÖLME KORUMASI
      // Fiyat zaten "TL/kg", "TL/lt" gibi birim fiyat ifadesiyle geliyorsa
      // calculateUnitPrice'a gönderme (tekrar böler, 1618 TL/kg hatası yapar)
      const parseSource = urunMetni || urunAdi;
      const parsed = parseProductName(parseSource);
      let unitPrice, perUnit, ambalajMiktar;

      const fullContext = (sf.priceContext || snippetText || '').toLowerCase();
      // Fiyat zaten birim fiyat mı? (context veya snippet'te "/kg", "kg fiyat", "Kg:" vb var mı)
      const alreadyUnitPrice = /(?:tl\s*\/\s*(?:kg|lt|l|kilo|litre))|(?:\/\s*(?:kg|lt|l))|(?:kg\s*fiyat)|(?:birim\s*fiyat)|(?:kg[:\s])|(?:\bkg\b.*\btl\b)|(?:\btl\b.*\/\s*kg)/.test(fullContext);

      // Ek kontrol: Snippet'te hem paket miktarı (400g) hem de fiyat (647.50) varsa
      // ve fiyat > 300 ise (paket fiyatı genellikle düşüktür), muhtemelen zaten birim fiyat
      const hasPackageInTitle = /\d+\s*(gr|gram|g|ml)\b/i.test(snippetText);
      const likelyAlreadyUnitPrice = hasPackageInTitle && sf.fiyat > 300 && targetUnit;

      // alreadyUnitPrice bypass: sadece kg/L için geçerli
      // adet biriminde bypass yapma — koli fiyatı adet fiyatı sanılır (yumurta 144 TL/adet hatası)
      const bypassCalc = (alreadyUnitPrice || likelyAlreadyUnitPrice) 
        && targetUnit 
        && (targetUnit === 'kg' || targetUnit === 'L');

      if (bypassCalc) {
        // Fiyat zaten birim fiyat → olduğu gibi kullan (çift bölme engeli)
        unitPrice = sf.fiyat;
        perUnit = targetUnit;
        ambalajMiktar = null;
      } else {
        const calc = calculateUnitPrice(sf.fiyat, parseSource, targetUnit);
        unitPrice = calc.unitPrice;
        perUnit = calc.perUnit;
        ambalajMiktar = calc.ambalajMiktar;
      }

      // ── AI ANCHOR DOĞRULAMASI ──
      // AI fiyatı varsa, snippet fiyatı AI'dan ±%60'tan fazla sapıyorsa → ÇÖP
      // Bu 1618 TL/kg kıyma, 9.4 TL/kg pirinç gibi hataları temizler
      if (aiAnchor && aiAnchor > 0) {
        const sapma = Math.abs(unitPrice - aiAnchor) / aiAnchor;
        if (sapma > 0.6) continue; // AI'dan %60'tan fazla sapan snippet = güvenilmez
      }

      let marketAdi = 'Web';
      if (sf.kaynak) {
        try {
          const urlObj = new URL(sf.kaynak);
          marketAdi = urlObj.hostname.replace('www.', '').split('.')[0];
          marketAdi = marketAdi.charAt(0).toUpperCase() + marketAdi.slice(1);
        } catch { /* ignore */ }
      }

      allResults.push({
        market: marketAdi,
        urun: (sf.priceContext || snippetText || urunAdi).substring(0, 200),
        fiyat: sf.fiyat,
        birimFiyat: unitPrice,
        birimTipi: perUnit,
        marka: parsed.marka || null,
        urunAdiTemiz: parsed.urunAdi,
        ambalajMiktar: ambalajMiktar || parsed.ambalajMiktar,
        aramaTermi: urunAdi,
        relevanceScore,
        timeScore: sf.timeScore,
        finalScore,
        detectedDate: sf.dateInfo?.detectedDate || null,
        kaynak: sf.kaynak,
        kaynakTipi: sf.kaynakTipi || _kaynakTipi(sf.kaynak),
      });
    }

    // ── ADIM 3: EXTRACT (SON ÇARE — sadece hiç sonuç yoksa) ──
    if (allResults.length < 2 && searchResult.results?.length > 0) {
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
            const parsedItems = _parseExtractedContentWithTime(
              er.rawContent, urunAdi, targetUnit, er.url
            );

            let extractMarket = 'Web';
            try {
              const urlObj = new URL(er.url);
              extractMarket = urlObj.hostname.replace('www.', '').split('.')[0];
              extractMarket = extractMarket.charAt(0).toUpperCase() + extractMarket.slice(1);
            } catch { /* ignore */ }

            for (const item of parsedItems) {
              if (item.timeScore < 0.8) continue;
              // Extract sonuçlarına da AI anchor doğrulaması
              if (aiAnchor && aiAnchor > 0) {
                const sapma = Math.abs(item.birimFiyat - aiAnchor) / aiAnchor;
                if (sapma > 0.6) continue;
              }
              item.market = extractMarket;
              item.kaynakTipi = _kaynakTipi(er.url);
              allResults.push(item);
            }
          }
        }
      }
    }

    // ── 5b. AI ANCHOR YOKSA → MEDYAN BAZLI SELF-VALIDATION ──
    // AI answer gelmemişse (kıyma gibi), snippet'ler kendi aralarında tutarlılık kontrolü yapar
    // Medyan hesapla, medyandan ±%80 sapanları ele
    if (!aiAnchor && allResults.length >= 3) {
      const selfPrices = allResults.map(r => r.birimFiyat).sort((a, b) => a - b);
      const selfMedian = selfPrices[Math.floor(selfPrices.length / 2)];
      // Medyandan %80'den fazla sapan = muhtemelen hatalı birim fiyat hesaplaması
      const validated = allResults.filter(r => {
        const sapma = Math.abs(r.birimFiyat - selfMedian) / selfMedian;
        return sapma <= 0.8;
      });
      if (validated.length >= 2) {
        allResults.length = 0;
        allResults.push(...validated);
      }
    }

    // ── 6. Sonuç yoksa → fallback ──
    if (allResults.length === 0) {
      return {
        success: false,
        error: `"${urunAdi}" için güncel (son 7 gün) fiyat bulunamadı`,
        fiyatlar: [],
        kategori,
        krediKullanimi: krediSearch + krediExtract,
        fallback: true,
      };
    }

    // ── 7. Deduplikasyon ──
    const seen = new Set();
    const uniqueResults = allResults.filter((r) => {
      const key = `${r.market}-${r.fiyat}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // ── 8. finalScore'a göre sırala (en güvenilir önce) ──
    uniqueResults.sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));

    // ── 9. IQR Outlier temizleme ──
    // Q1 - 1.5*IQR ile Q3 + 1.5*IQR aralığı dışındakileri ele
    const sortedPrices = uniqueResults.map((f) => f.birimFiyat).sort((a, b) => a - b);
    let cleanResults;
    if (sortedPrices.length >= 4) {
      const q1 = sortedPrices[Math.floor(sortedPrices.length * 0.25)];
      const q3 = sortedPrices[Math.floor(sortedPrices.length * 0.75)];
      const iqr = q3 - q1;
      const lowerBound = q1 - 1.5 * iqr;
      const upperBound = q3 + 1.5 * iqr;
      cleanResults = uniqueResults.filter(
        (f) => f.birimFiyat >= lowerBound && f.birimFiyat <= upperBound
      );
    } else {
      // 4'ten az sonuç: medyan bazlı yumuşak filtre
      const median = sortedPrices[Math.floor(sortedPrices.length / 2)];
      cleanResults = uniqueResults.filter(
        (f) => f.birimFiyat >= median * 0.3 && f.birimFiyat <= median * 2.5
      );
    }
    const finalResults = cleanResults.length >= 2 ? cleanResults : uniqueResults;

    // ── 10. Confidence & self-sufficiency ──
    const { confidence, yeterli, sebep } = _calculateConfidence(finalResults);

    // ── 11. İstatistikler ──
    const prices = finalResults.map((f) => f.birimFiyat).sort((a, b) => a - b);
    const ekonomikOrt =
      prices.slice(0, Math.min(5, prices.length)).reduce((s, p) => s + p, 0) /
      Math.min(5, prices.length);

    // Dominant birim
    const unitCounts = {};
    finalResults.forEach((f) => { unitCounts[f.birimTipi] = (unitCounts[f.birimTipi] || 0) + 1; });
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
      aramaTermleri: queries,
      birim: dominantUnit,
      fiyatlar: finalResults.slice(0, 30),
      min: prices[0],
      max: prices[prices.length - 1],
      ortalama: Math.round(ekonomikOrt * 100) / 100,
      medyan: prices[Math.floor(prices.length / 2)],
      kaynak: 'tavily_referans',
      toplam_sonuc: finalResults.length,
      markalar: Object.keys(markaGruplari).filter((m) => m !== 'Diğer'),
      marka_gruplari: markaGruplari,
      // Ultra-Current meta
      confidence,
      yeterli,           // true = Tavily tek başına yeterli, false = Camgöz fallback
      fallback: !yeterli, // Geriye uyumlu flag
      confidenceSebep: sebep,
      kategori,
      kullanılanSiteler: includeDomains,
      krediKullanimi: krediSearch + krediExtract,
    };
  } catch (err) {
    return { success: false, error: `Tavily piyasa arama hatası: ${err.message}`, fiyatlar: [], fallback: true };
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
