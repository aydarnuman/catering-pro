/**
 * Yüklenici Haber & İstihbarat Arama Modülü (Tavily + Google News + KİK)
 * ────────────────────────────────────────────────────────────────────────
 * Bir yüklenici hakkında hibrit kaynaklardan güncel istihbarat toplar:
 *
 * 1. Tavily Search  → Zengin web sonuçları + AI özet (birincil kaynak)
 * 2. Google News RSS → Fallback haber kaynağı (Tavily yoksa veya biterse)
 * 3. Tavily Search   → KİK kararları (arsiv.kikkararlari.com'dan)
 * 4. Tavily Extract  → Bulunan KİK karar metinlerinin tam içerikleri
 *
 * Graceful degradation:
 *   Tavily aktif → Tavily sonuçları + KİK sonuçları + Google News
 *   Tavily yok   → Sadece Google News RSS (mevcut davranış)
 *
 * Dönen veri formatı:
 * {
 *   haberler: [{ baslik, link, tarih, kaynak, ozet, kaynak_tipi }],
 *   kik_kararlari: [{ baslik, link, tarih, ozet, tam_metin? }],
 *   ai_ozet: string | null,
 *   toplam: number,
 *   arama_metni: string,
 *   sorgulama_tarihi: ISO string,
 *   kaynaklar: { tavily: number, google_news: number, kik: number }
 * }
 */

import {
  isTavilyConfigured,
  tavilyExtract,
  tavilySearch,
} from '../../services/tavily-service.js';
import logger from '../shared/scraper-logger.js';

const MODULE_NAME = 'Haber-Arama';

/**
 * Yüklenici hakkında hibrit kaynaklardan haber ve istihbarat toplar.
 *
 * @param {string} firmaAdi - Aranacak firma adı
 * @param {Object} options
 * @param {number} options.maxSonuc - Maksimum haber sayısı (varsayılan: 20)
 * @param {boolean} options.kikAra - KİK kararlarını da ara (varsayılan: true)
 * @param {boolean} options.kikTamMetin - KİK karar tam metinlerini çek (varsayılan: false, kredi tasarrufu)
 * @param {boolean} options.derinIcerik - En iyi sonuçların tam içeriğini çek (varsayılan: false)
 * @param {number} options.days - Son N gün (varsayılan: 90)
 * @returns {Object} Haber ve istihbarat sonuçları
 */
export async function araHaberler(firmaAdi, options = {}) {
  const {
    maxSonuc = 20,
    kikAra = true,
    kikTamMetin = false,
    derinIcerik = false,
    days = 90,
  } = options;

  const session = logger.createSession(MODULE_NAME);
  session.info(`Hibrit haber araması başlatılıyor: "${firmaAdi}"`);

  const haberler = [];
  const kikKararlari = [];
  let aiOzet = null;
  const kaynakSayilari = { tavily: 0, google_news: 0, kik: 0 };

  // ─── 1. Tavily Search (birincil kaynak) ───────────────────
  if (isTavilyConfigured()) {
    // Firma adından kısa ad türet (ilk 2-3 kelime yeterli)
    const kisaAd = firmaAdi.split(/\s+/).slice(0, 3).join(' ');

    // Paralel iki arama: biri genel firma haberi, biri ihale bağlamında
    const aramalar = [
      { query: `"${kisaAd}"`, topic: 'general', label: 'genel' },
      { query: `"${kisaAd}" ihale`, topic: 'general', label: 'ihale' },
    ];

    const aramaPromises = aramalar.map((a) =>
      tavilySearch(a.query, {
        searchDepth: 'basic',
        maxResults: 5,
        includeAnswer: a.label === 'genel', // Sadece birinde AI özet al
        days,
        excludeDomains: ['arsiv.kikkararlari.com'],
      }).catch((err) => {
        session.error(`Tavily ${a.label} araması hatası: ${err.message}`);
        return { success: false };
      })
    );

    try {
      const aramaResults = await Promise.all(aramaPromises);
      const gorulenUrller = new Set();

      for (let i = 0; i < aramaResults.length; i++) {
        const tavilyResult = aramaResults[i];
        if (!tavilyResult.success || !tavilyResult.results?.length) continue;

        session.info(`Tavily (${aramalar[i].label}): ${tavilyResult.results.length} sonuç`);
        if (tavilyResult.answer && !aiOzet) aiOzet = tavilyResult.answer;

        for (const r of tavilyResult.results) {
          if (gorulenUrller.has(r.url)) continue; // Çakışmaları atla
          gorulenUrller.add(r.url);

          haberler.push({
            baslik: r.title || '',
            link: r.url || '',
            tarih: r.publishedDate || null,
            tarih_okunur: r.publishedDate ? formatTarih(r.publishedDate) : '',
            kaynak: extractDomain(r.url),
            ozet: r.content ? r.content.substring(0, 400) : '',
            kaynak_tipi: 'tavily',
            skor: r.score || 0,
          });
        }
      }
      kaynakSayilari.tavily = haberler.length;

      if (haberler.length === 0) {
        session.info('Tavily: Her iki aramada da sonuç bulunamadı');
      }
    } catch (err) {
      session.error(`Tavily search hatası: ${err.message}`);
    }

    // ─── 2. KİK Kararları Araması (Tavily ile) ───────────────
    if (kikAra) {
      try {
        const kikResult = await tavilySearch(
          `"${firmaAdi}" site:arsiv.kikkararlari.com`,
          {
            searchDepth: 'basic',
            maxResults: 5,
            includeAnswer: false,
            includeDomains: ['arsiv.kikkararlari.com'],
          }
        );

        if (kikResult.success && kikResult.results?.length > 0) {
          session.info(`KİK Kararları: ${kikResult.results.length} sonuç bulundu`);

          // KİK sonuçlarını ekle
          const kikUrls = [];
          for (const r of kikResult.results) {
            const karar = {
              baslik: r.title || '',
              link: r.url || '',
              tarih: r.publishedDate || null,
              ozet: r.content ? r.content.substring(0, 500) : '',
              tam_metin: null,
            };
            kikKararlari.push(karar);
            if (kikTamMetin && r.url) kikUrls.push(r.url);
          }
          kaynakSayilari.kik = kikResult.results.length;

          // ─── 3. KİK Karar Tam Metinlerini Çek (opsiyonel) ────
          if (kikTamMetin && kikUrls.length > 0) {
            try {
              const extractResult = await tavilyExtract(kikUrls.slice(0, 3)); // max 3 (kredi tasarrufu)
              if (extractResult.success && extractResult.results?.length > 0) {
                session.info(`KİK tam metin: ${extractResult.results.length} karar çekildi`);
                for (const ext of extractResult.results) {
                  const matchingKarar = kikKararlari.find((k) => k.link === ext.url);
                  if (matchingKarar) {
                    // Tam metin çok uzun olabilir, sadece ilk 3000 karakter
                    matchingKarar.tam_metin = ext.rawContent
                      ? ext.rawContent.substring(0, 3000)
                      : null;
                  }
                }
              }
            } catch (extractErr) {
              session.error(`KİK tam metin çekme hatası: ${extractErr.message}`);
            }
          }
        }
      } catch (err) {
        session.error(`KİK karar araması hatası: ${err.message}`);
      }
    }
  } else {
    session.info('Tavily yapılandırılmamış, sadece Google News kullanılacak');
  }

  // ─── 4. Search → Extract zinciri (en iyi sonuçların tam içeriği) ─────
  if (derinIcerik && isTavilyConfigured() && haberler.length > 0) {
    // Extract başarısız olan domain'ler (koruma altında, JS-rendered, captcha vb.)
    const EXTRACT_BLOCKLIST = [
      'ekap.kik.gov.tr',
      'forie.com',
      'turkishexporter.com.tr',
      'find.com.tr',
      'ihalebul.com',       // Login gerektirir
      'linkedin.com',
      'facebook.com',
      'twitter.com',
      'x.com',
    ];

    try {
      const extractUrls = haberler
        .filter((h) => {
          if (h.kaynak_tipi !== 'tavily' || !h.skor || h.skor < 0.3) return false;
          // Blocklist kontrolü
          const domain = extractDomain(h.link);
          return !EXTRACT_BLOCKLIST.some((b) => domain.includes(b));
        })
        .sort((a, b) => (b.skor || 0) - (a.skor || 0))
        .slice(0, 3)
        .map((h) => h.link)
        .filter(Boolean);

      if (extractUrls.length > 0) {
        session.info(`Derin içerik: ${extractUrls.length} sayfa çekiliyor (${extractUrls.map(u => extractDomain(u)).join(', ')})...`);
        const extractResult = await tavilyExtract(extractUrls);

        if (extractResult.success && extractResult.results?.length > 0) {
          session.info(`Derin içerik: ${extractResult.results.length} sayfa başarılı`);
          for (const ext of extractResult.results) {
            const matchHaber = haberler.find((h) => h.link === ext.url);
            if (matchHaber && ext.rawContent) {
              matchHaber.tam_icerik = ext.rawContent.substring(0, 5000);
              if (ext.rawContent.length > matchHaber.ozet.length) {
                matchHaber.ozet = ext.rawContent.substring(0, 600);
              }
            }
          }
        }
        // Failed URL'leri logla
        if (extractResult.failedUrls?.length > 0) {
          session.info(`Derin içerik: ${extractResult.failedUrls.length} sayfa çekilemedi`);
        }
      } else {
        session.info('Derin içerik: Uygun URL bulunamadı (tüm sonuçlar korumalı sitelerden)');
      }
    } catch (extractErr) {
      session.error(`Derin içerik çekme hatası: ${extractErr.message}`);
    }
  }

  // ─── 5. Google News RSS (fallback + ek kaynak) ────────────
  try {
    const gnHaberler = await fetchGoogleNews(firmaAdi, maxSonuc);
    if (gnHaberler.length > 0) {
      session.info(`Google News: ${gnHaberler.length} haber bulundu`);

      // Tavily sonuçlarıyla çakışanları filtrele (aynı başlık/URL)
      const mevcutLinkler = new Set(haberler.map((h) => h.link));
      const mevcutBasliklar = new Set(haberler.map((h) => normalizeBaslik(h.baslik)));

      for (const gn of gnHaberler) {
        const normBaslik = normalizeBaslik(gn.baslik);
        if (!mevcutLinkler.has(gn.link) && !mevcutBasliklar.has(normBaslik)) {
          haberler.push({ ...gn, kaynak_tipi: 'google_news' });
          kaynakSayilari.google_news++;
        }
      }
    }
  } catch (err) {
    session.error(`Google News hatası: ${err.message}`);
  }

  // ─── 6. Sonuçları sırala: Tavily (skorlu) → Google News ───
  haberler.sort((a, b) => {
    // Önce skor (yüksek → düşük), sonra tarih (yeni → eski)
    if ((b.skor || 0) !== (a.skor || 0)) return (b.skor || 0) - (a.skor || 0);
    const dateA = a.tarih ? new Date(a.tarih).getTime() : 0;
    const dateB = b.tarih ? new Date(b.tarih).getTime() : 0;
    return dateB - dateA;
  });

  const result = {
    haberler: haberler.slice(0, maxSonuc),
    kik_kararlari: kikKararlari,
    ai_ozet: aiOzet,
    toplam: haberler.length + kikKararlari.length,
    arama_metni: firmaAdi,
    sorgulama_tarihi: new Date().toISOString(),
    kaynaklar: kaynakSayilari,
  };

  session.info(
    `Toplam: ${result.toplam} sonuç (Tavily: ${kaynakSayilari.tavily}, GNews: ${kaynakSayilari.google_news}, KİK: ${kaynakSayilari.kik})`
  );
  return session.end(result);
}

// ═══════════════════════════════════════════════════════════════
// Google News RSS (mevcut fallback mantığı)
// ═══════════════════════════════════════════════════════════════

async function fetchGoogleNews(firmaAdi, maxSonuc) {
  const aramaMetni = encodeURIComponent(firmaAdi);
  const rssUrl = `https://news.google.com/rss/search?q=${aramaMetni}&hl=tr&gl=TR&ceid=TR:tr`;

  const response = await fetch(rssUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      Accept: 'application/rss+xml, application/xml, text/xml',
      'Accept-Language': 'tr-TR,tr;q=0.9',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) return [];

  const xmlText = await response.text();
  return parseRssItems(xmlText, maxSonuc);
}

// ═══════════════════════════════════════════════════════════════
// Yardımcı fonksiyonlar
// ═══════════════════════════════════════════════════════════════

function parseRssItems(xml, maxSonuc) {
  const haberler = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match = itemRegex.exec(xml);

  while (match !== null && haberler.length < maxSonuc) {
    const itemXml = match[1];
    const baslik = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link');
    const pubDate = extractTag(itemXml, 'pubDate');
    const description = extractTag(itemXml, 'description');
    const source = extractTag(itemXml, 'source');

    if (baslik) {
      const temizOzet = description
        ? description.replace(/<[^>]*>/g, '').trim().substring(0, 300)
        : '';

      haberler.push({
        baslik: decodeHtmlEntities(baslik),
        link: link || '',
        tarih: pubDate ? new Date(pubDate).toISOString() : null,
        tarih_okunur: pubDate ? formatTarih(pubDate) : '',
        kaynak: source ? decodeHtmlEntities(source) : '',
        ozet: decodeHtmlEntities(temizOzet),
      });
    }
    match = itemRegex.exec(xml);
  }
  return haberler;
}

function extractTag(xml, tag) {
  const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i');
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();

  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const normalMatch = xml.match(regex);
  return normalMatch ? normalMatch[1].trim() : '';
}

function decodeHtmlEntities(text) {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

function formatTarih(dateStr) {
  try {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Bugün';
    if (diffDays === 1) return 'Dün';
    if (diffDays < 7) return `${diffDays} gün önce`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} hafta önce`;

    const aylar = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    return `${date.getDate()} ${aylar[date.getMonth()]} ${date.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

/**
 * URL'den domain adı çıkarır.
 */
function extractDomain(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return url || '';
  }
}

/**
 * Başlıkları karşılaştırma için normalize eder (çakışma kontrolü).
 */
function normalizeBaslik(baslik) {
  return (baslik || '')
    .toLowerCase()
    .replace(/[^a-zçğıöşü0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
