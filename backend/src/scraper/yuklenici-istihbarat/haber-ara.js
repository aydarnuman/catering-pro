/**
 * Haber Arama Modülü (Google News RSS)
 * ─────────────────────────────────────
 * Bir yüklenici hakkında güncel haberleri Google News RSS feed'inden çeker.
 * Puppeteer KULLANMAZ — sadece HTTP isteği yapar, bu yüzden hızlıdır.
 *
 * Kaynak: Google News RSS
 * URL: https://news.google.com/rss/search?q={firma_adi}&hl=tr&gl=TR&ceid=TR:tr
 *
 * Dönen veri formatı:
 * {
 *   haberler: [{ baslik, link, tarih, kaynak, ozet }],
 *   toplam: number,
 *   arama_metni: string,
 *   sorgulama_tarihi: ISO string,
 *   kaynak: "Google News RSS"
 * }
 */

import logger from '../shared/scraper-logger.js';

const MODULE_NAME = 'Haber-Arama';

/**
 * Google News RSS feed'inden haberleri çeker.
 * RSS XML'ini parse ederek yapılandırılmış haber listesi döner.
 *
 * @param {string} firmaAdi - Aranacak firma adı
 * @param {Object} options - Opsiyonel ayarlar
 * @param {number} options.maxSonuc - Maksimum haber sayısı (varsayılan: 20)
 * @returns {Object} Haber sonuçları
 */
export async function araHaberler(firmaAdi, options = {}) {
  const { maxSonuc = 20 } = options;
  const session = logger.createSession(MODULE_NAME);
  session.info(`Haber aranıyor: "${firmaAdi}"`);

  try {
    // Google News RSS URL oluştur
    const aramaMetni = encodeURIComponent(firmaAdi);
    const rssUrl = `https://news.google.com/rss/search?q=${aramaMetni}&hl=tr&gl=TR&ceid=TR:tr`;

    // RSS feed'i çek
    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'application/rss+xml, application/xml, text/xml',
        'Accept-Language': 'tr-TR,tr;q=0.9',
      },
      signal: AbortSignal.timeout(15000), // 15 saniye timeout
    });

    if (!response.ok) {
      throw new Error(`Google News yanıt hatası: ${response.status} ${response.statusText}`);
    }

    const xmlText = await response.text();

    // Basit XML parser (harici bağımlılık gerektirmez)
    const haberler = parseRssItems(xmlText, maxSonuc);

    const result = {
      haberler,
      toplam: haberler.length,
      arama_metni: firmaAdi,
      sorgulama_tarihi: new Date().toISOString(),
      kaynak: 'Google News RSS',
    };

    session.info(`${haberler.length} haber bulundu: "${firmaAdi}"`);
    return session.end(result);
  } catch (error) {
    session.error(`Haber arama hatası: ${error.message}`);
    throw error;
  }
}

/**
 * RSS XML'ini parse ederek haber listesi çıkarır.
 * Harici XML parser bağımlılığı gerektirmez — regex tabanlı basit parser.
 *
 * @param {string} xml - RSS XML metni
 * @param {number} maxSonuc - Maksimum sonuç sayısı
 * @returns {Array} Haber listesi
 */
function parseRssItems(xml, maxSonuc) {
  const haberler = [];

  // <item> bloklarını bul
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
      // HTML etiketlerini temizle
      const temizOzet = description
        ? description
            .replace(/<[^>]*>/g, '')
            .trim()
            .substring(0, 300)
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

/**
 * XML'den belirli bir etiketi çıkarır.
 */
function extractTag(xml, tag) {
  // CDATA bloğunu da yakala
  const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i');
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();

  // Normal etiket
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const normalMatch = xml.match(regex);
  return normalMatch ? normalMatch[1].trim() : '';
}

/**
 * HTML entities decode.
 */
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

/**
 * Tarihi okunabilir formata çevirir.
 * Örnek: "2 gün önce", "15 Oca 2026"
 */
function formatTarih(dateStr) {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Bugün';
    if (diffDays === 1) return 'Dün';
    if (diffDays < 7) return `${diffDays} gün önce`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} hafta önce`;

    // Türkçe ay adları
    const aylar = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    return `${date.getDate()} ${aylar[date.getMonth()]} ${date.getFullYear()}`;
  } catch {
    return dateStr;
  }
}
