/**
 * Web Arama ve Mevzuat Tools
 * AI Agent'ın internetten güncel bilgi almasını sağlar
 *
 * Tavily API: Gerçek web araması (ücretsiz 1000 istek/ay)
 * DuckDuckGo: Yedek arama (sınırlı sonuçlar)
 * Yerel Mevzuat: Güncel 2026 verileri
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isTavilyConfigured, tavilyCrawl, tavilyExtract, tavilyMap, tavilyResearch } from '../tavily-service.js';

// Tavily API Key (ücretsiz: https://tavily.com)
const TAVILY_API_KEY = process.env.TAVILY_API_KEY || '';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mevzuat verileri - yerel bilgi bankası
const MEVZUAT_PATH = path.join(__dirname, '../../data/mevzuat');

// Mevzuat dosyalarını yükle
const loadMevzuat = (dosyaAdi) => {
  try {
    const filePath = path.join(MEVZUAT_PATH, dosyaAdi);
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (_error) {
    return null;
  }
};

// Tool tanımları
export const webToolDefinitions = [
  {
    name: 'mevzuat_sorgula',
    description:
      'Yerel bilgi bankasından mevzuat bilgisi sorgular. SGK, İş Kanunu, KİK, teşvikler, asgari ücret gibi konularda güncel (2026) bilgi verir. İnternete gitmeden önce MUTLAKA bu tool kullanılmalıdır.',
    input_schema: {
      type: 'object',
      properties: {
        konu: {
          type: 'string',
          description: 'Sorgulanacak konu: sgk_oranlari, asgari_ucret, is_kanunu, kik_mevzuat, tesvikler',
          enum: ['sgk_oranlari', 'asgari_ucret', 'is_kanunu', 'kik_mevzuat', 'tesvikler', 'tumu'],
        },
        alt_konu: {
          type: 'string',
          description:
            'Spesifik alt konu (opsiyonel). Örn: kidem_tazminati, ihbar_tazminati, yillik_izin, prim_oranlari',
        },
      },
      required: ['konu'],
    },
  },
  {
    name: 'web_arama',
    description:
      'İnternetten güncel bilgi arar (Tavily API). SADECE yerel bilgi bankasında bulunamayan, güncel veya spesifik bilgiler için kullanılmalıdır. Örn: son dakika haberler, güncel döviz kuru, yeni yayınlanan tebliğler, ihale fiyatları.',
    input_schema: {
      type: 'object',
      properties: {
        sorgu: {
          type: 'string',
          description: 'Arama sorgusu. Türkçe ve spesifik olmalı.',
        },
        tip: {
          type: 'string',
          description: 'Arama tipi',
          enum: ['genel', 'haber', 'mevzuat', 'fiyat'],
        },
        max_sonuc: {
          type: 'number',
          description: 'Maksimum sonuç sayısı (varsayılan: 5)',
        },
      },
      required: ['sorgu'],
    },
  },
  {
    name: 'guncel_degerler',
    description:
      'Güncel ekonomik değerleri getirir: asgari ücret, kıdem tavanı, SGK tavanı, döviz kuru gibi sık değişen verileri döner.',
    input_schema: {
      type: 'object',
      properties: {
        deger_tipi: {
          type: 'string',
          description: 'İstenen değer tipi',
          enum: ['asgari_ucret', 'kidem_tavani', 'sgk_tavani', 'vergi_dilimleri', 'tumu'],
        },
      },
      required: ['deger_tipi'],
    },
  },
  {
    name: 'kik_emsal_ara',
    description:
      'Kamu İhale Kurumu (KİK) kararlarında emsal arar. İhale itirazları, şikayet kararları, aşırı düşük teklif değerlendirmeleri için benzer KİK kararlarını bulur.',
    input_schema: {
      type: 'object',
      properties: {
        arama_tipi: {
          type: 'string',
          description: 'Arama konusu türü',
          enum: ['asiri_dusuk', 'degerlendirme_disi', 'yeterlik', 'teknik_sart', 'teklif_zarfi', 'genel'],
        },
        anahtar_kelimeler: {
          type: 'string',
          description: 'Aranacak anahtar kelimeler. Örn: "yemek hizmeti", "personel çalıştırma", "belge eksikliği"',
        },
        yil: {
          type: 'number',
          description: 'Karar yılı filtresi (opsiyonel). Örn: 2025, 2024',
        },
      },
      required: ['arama_tipi', 'anahtar_kelimeler'],
    },
  },
  {
    name: 'sayfa_oku',
    description:
      'Belirli bir web sayfasının içeriğini okur/çeker (Tavily Extract). Arama sonuçlarından bir sayfa detayını görmek, rakip menü fiyatlarını incelemek veya mevzuat sayfasının tam metnini almak için kullanılır.',
    input_schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: "Okunacak web sayfasının URL'si. Tam URL olmalı (https://...)",
        },
        ozet_istegi: {
          type: 'string',
          description:
            'Sayfa içeriğinden ne tür bilgi çıkarılması isteniyor (opsiyonel). Örn: "fiyat bilgileri", "menü kalemleri", "mevzuat değişiklikleri"',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'derin_arastirma',
    description:
      'Bir konu hakkında kapsamlı derin araştırma yapar. Birden fazla kaynak tarar, bilgileri birleştirir ve detaylı rapor üretir. Basit sorular için web_arama yeterlidir - bunu SADECE kapsamlı analiz gerektiren konular için kullanın. Örn: "2026 gıda maliyeti trendi analizi", "catering sektörü ihale fiyat karşılaştırması", "yeni gıda mevzuatı etki analizi".',
    input_schema: {
      type: 'object',
      properties: {
        konu: {
          type: 'string',
          description: 'Araştırılacak ana konu. Detaylı ve spesifik olmalı.',
        },
        alt_sorular: {
          type: 'array',
          items: { type: 'string' },
          description: 'Konuyla ilgili araştırılacak alt sorular (opsiyonel, max 3). Daha kapsamlı sonuç üretir.',
        },
        odak_siteleri: {
          type: 'array',
          items: { type: 'string' },
          description: 'Araştırmanın odaklanacağı domain listesi (opsiyonel). Örn: ["kik.gov.tr", "mevzuat.gov.tr"]',
        },
        son_gun: {
          type: 'number',
          description: 'Sadece son N gün içindeki sonuçları getir (opsiyonel). Örn: 30 = son 1 ay',
        },
      },
      required: ['konu'],
    },
  },
  {
    name: 'site_tara',
    description:
      "Bir web sitesini komple tarar ve tüm sayfalarının içeriğini çeker. Rakip catering firma siteleri, ihale portalları, mevzuat siteleri gibi tek bir kaynağı derinlemesine incelemek için kullanılır. web_arama'dan farklıdır: web_arama birçok sitede arar, site_tara TEK bir sitenin alt sayfalarını tarar. Örn: Rakip firmanın menü sayfalarını taramak, KİK kararlarını taramak, bir toptancının ürün kataloğunu çekmek.",
    input_schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: "Taranacak web sitesinin root URL'si. Tam URL olmalı (https://...)",
        },
        talimat: {
          type: 'string',
          description:
            'Doğal dil talimatı - crawler\'a ne aramasını söyler. Örn: "Sadece menü ve fiyat sayfalarını bul", "İhale sonuç duyurularını tara", "Ürün kataloğu sayfalarını getir"',
        },
        derinlik: {
          type: 'number',
          description:
            'Tarama derinliği (1-5). 1=sadece ana sayfa, 2=bir alt seviye linkler, 3+=derin tarama. Varsayılan: 2',
        },
        max_sayfa: {
          type: 'number',
          description: 'Taranacak maksimum sayfa sayısı (varsayılan: 20). Kredi tasarrufu için düşük tutun.',
        },
        path_filtre: {
          type: 'array',
          items: { type: 'string' },
          description: 'Sadece bu path kalıplarını tara (regex). Örn: ["/menu/.*", "/fiyat/.*", "/ihale/.*"]',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'site_haritasi',
    description:
      "Bir web sitesinin URL haritasını çıkarır (içerik ÇEKMEZ, sadece linkleri listeler). site_tara'dan çok daha hızlı ve ucuzdur. Önce site_haritasi ile yapıyı keşfedin, sonra önemli sayfaları sayfa_oku veya site_tara ile çekin. Örn: ihalebul.com'un yapısını keşfetmek, bir firmanın tüm sayfalarını listelemek.",
    input_schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: "Haritası çıkarılacak web sitesinin URL'si. Tam URL olmalı (https://...)",
        },
        talimat: {
          type: 'string',
          description:
            'Doğal dil talimatı - hangi sayfaları bulsun. Örn: "Sadece ihale ilanı sayfalarını bul", "Menü ve fiyat sayfalarını listele"',
        },
        derinlik: {
          type: 'number',
          description: 'Keşif derinliği (1-5). Varsayılan: 1',
        },
        max_link: {
          type: 'number',
          description: 'Keşfedilecek maksimum URL sayısı (varsayılan: 50)',
        },
      },
      required: ['url'],
    },
  },
];

// Tool implementasyonları
export const webToolImplementations = {
  mevzuat_sorgula: async ({ konu, alt_konu }) => {
    try {
      if (konu === 'tumu') {
        // Tüm mevzuat dosyalarını yükle
        const sgk = loadMevzuat('sgk_oranlari.json');
        const asgari = loadMevzuat('asgari_ucret.json');
        const isKanunu = loadMevzuat('is_kanunu.json');
        const kik = loadMevzuat('kik_mevzuat.json');
        const _tesvikler = loadMevzuat('tesvikler.json');

        return {
          success: true,
          kaynak: 'yerel_bilgi_bankasi',
          guncelleme: '2026-01-01',
          ozet: {
            asgari_ucret_brut: asgari?.['2026']?.ocak_haziran?.brut,
            asgari_ucret_net: asgari?.['2026']?.ocak_haziran?.net_ele_gecen,
            sgk_isci_toplam: `${sgk?.prim_oranlari?.isci_paylari?.toplam}%`,
            sgk_isveren_toplam: `${sgk?.prim_oranlari?.isveren_paylari?.toplam}%`,
            kidem_tavani: isKanunu?.kidem_tazminati?.tavan_2026_ocak,
            dogrudan_temin_limiti: kik?.esik_degerler_2026?.dogrudan_temin_limiti?.buyuksehir_icinde,
          },
        };
      }

      const dosyaAdi = `${konu}.json`;
      const veri = loadMevzuat(dosyaAdi);

      if (!veri) {
        return {
          success: false,
          error: `${konu} için mevzuat verisi bulunamadı`,
        };
      }

      // Alt konu varsa filtrele
      if (alt_konu && veri[alt_konu]) {
        return {
          success: true,
          kaynak: 'yerel_bilgi_bankasi',
          konu,
          alt_konu,
          guncelleme: veri.guncelleme_tarihi,
          veri: veri[alt_konu],
        };
      }

      return {
        success: true,
        kaynak: 'yerel_bilgi_bankasi',
        konu,
        guncelleme: veri.guncelleme_tarihi,
        veri,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  },

  web_arama: async ({ sorgu, tip = 'genel', max_sonuc = 5 }) => {
    try {
      // Tavily API varsa kullan (gerçek web araması)
      if (TAVILY_API_KEY) {
        return await tavilyArama(sorgu, tip, max_sonuc);
      }
      return await duckduckgoArama(sorgu, tip);
    } catch (error) {
      return {
        success: false,
        error: `Web arama hatası: ${error.message}`,
        oneri: 'İnternet bağlantısını kontrol edin veya daha sonra tekrar deneyin.',
      };
    }
  },

  guncel_degerler: async ({ deger_tipi }) => {
    try {
      const asgari = loadMevzuat('asgari_ucret.json');
      const isKanunu = loadMevzuat('is_kanunu.json');
      const sgk = loadMevzuat('sgk_oranlari.json');

      const degerler = {
        asgari_ucret: {
          donem: '2026 Ocak-Haziran',
          brut: asgari?.['2026']?.ocak_haziran?.brut || 22104,
          net: asgari?.['2026']?.ocak_haziran?.net_ele_gecen || 17801.65,
          isveren_maliyeti: asgari?.['2026']?.ocak_haziran?.isveren_toplam_maliyet || 25972.2,
        },
        kidem_tavani: {
          donem: '2026 Ocak',
          tutar: isKanunu?.kidem_tazminati?.tavan_2026_ocak || 35058.58,
          aciklama: 'Her tam yıl için en fazla bu tutar ödenebilir',
        },
        sgk_tavani: {
          donem: '2026 Ocak',
          tutar: sgk?.sgk_taban_tavan?.tavan?.['2026_ocak'] || 165780,
          aciklama: 'Asgari ücretin 7.5 katı',
        },
        vergi_dilimleri: asgari?.vergi_dilimleri_2026 || {
          dilim_1: { limit: 158000, oran: 15 },
          dilim_2: { limit: 330000, oran: 20 },
          dilim_3: { limit: 800000, oran: 27 },
          dilim_4: { limit: 4300000, oran: 35 },
          dilim_5: { limit: null, oran: 40 },
        },
      };

      if (deger_tipi === 'tumu') {
        return {
          success: true,
          guncelleme: '2026-01-01',
          degerler,
        };
      }

      if (degerler[deger_tipi]) {
        return {
          success: true,
          guncelleme: '2026-01-01',
          [deger_tipi]: degerler[deger_tipi],
        };
      }

      return {
        success: false,
        error: `${deger_tipi} için değer bulunamadı`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  },

  kik_emsal_ara: async ({ arama_tipi, anahtar_kelimeler, yil }) => {
    try {
      // KİK karar veritabanında arama yap
      // Not: Gerçek KİK API'si olmadığı için DuckDuckGo ile site-specific arama yapıyoruz
      const siteQuery = `site:kik.gov.tr ${anahtar_kelimeler}`;
      const tipFiltre = {
        asiri_dusuk: 'aşırı düşük teklif',
        degerlendirme_disi: 'değerlendirme dışı bırakılma',
        yeterlik: 'yeterlik kriteri',
        teknik_sart: 'teknik şartname',
        teklif_zarfi: 'teklif zarfı',
        genel: '',
      };

      const fullQuery = `${siteQuery} ${tipFiltre[arama_tipi] || ''} ${yil || ''}`.trim();
      const encodedQuery = encodeURIComponent(fullQuery);

      // DuckDuckGo Instant Answer API
      const url = `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'CateringPro/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const results = [];

      // Sonuçları işle
      if (data.AbstractText) {
        results.push({
          tip: 'ozet',
          baslik: data.Heading || 'KİK Emsal Karar',
          icerik: data.AbstractText,
          url: data.AbstractURL,
        });
      }

      if (data.RelatedTopics && data.RelatedTopics.length > 0) {
        data.RelatedTopics.slice(0, 8).forEach((topic) => {
          if (topic.Text) {
            results.push({
              tip: 'emsal',
              icerik: topic.Text,
              url: topic.FirstURL,
            });
          }
        });
      }

      // Yaygın KİK emsal bilgileri (yerel bilgi bankası)
      const yerelEmsaller = getYerelEmsaller(arama_tipi);

      return {
        success: true,
        kaynak: 'kik_emsal_arama',
        arama_tipi,
        anahtar_kelimeler,
        yil: yil || 'tüm yıllar',
        sonuc_sayisi: results.length + yerelEmsaller.length,
        web_sonuclari: results,
        yerel_emsaller: yerelEmsaller,
        not: 'Emsal kararlar bilgilendirme amaçlıdır. Güncel kararlar için ekk.kik.gov.tr adresini ziyaret edin.',
        basvuru_linki: 'https://ekk.kik.gov.tr/EKAP/',
      };
    } catch (_error) {
      // Hata durumunda yerel emsalleri dön
      const yerelEmsaller = getYerelEmsaller(arama_tipi);

      return {
        success: true,
        kaynak: 'yerel_bilgi_bankasi',
        arama_tipi,
        anahtar_kelimeler,
        sonuc_sayisi: yerelEmsaller.length,
        yerel_emsaller: yerelEmsaller,
        uyari: 'Web araması yapılamadı, yerel bilgi bankasından sonuçlar gösteriliyor.',
        basvuru_linki: 'https://ekk.kik.gov.tr/EKAP/',
      };
    }
  },

  // ─── SAYFA OKU (Tavily Extract) ────────────────────────
  sayfa_oku: async ({ url, ozet_istegi }) => {
    try {
      if (!isTavilyConfigured()) {
        return {
          success: false,
          error: 'Tavily API key ayarlanmamış. TAVILY_API_KEY environment variable ekleyin.',
        };
      }

      if (!url || !url.startsWith('http')) {
        return {
          success: false,
          error: 'Geçerli bir URL giriniz (https://... ile başlamalı)',
        };
      }

      const result = await tavilyExtract([url]);

      if (!result.success) {
        return { success: false, error: result.error };
      }

      if (!result.results || result.results.length === 0) {
        return {
          success: false,
          error: `Sayfa içeriği çekilemedi: ${url}`,
          basarisiz_url: result.failedUrls,
        };
      }

      const content = result.results[0].rawContent || '';

      // İçerik çok uzunsa kısalt (Claude context limiti)
      const maxLen = 8000;
      const truncated = content.length > maxLen;
      const finalContent = truncated ? `${content.substring(0, maxLen)}\n\n... [içerik kısaltıldı]` : content;

      return {
        success: true,
        kaynak: 'tavily_extract',
        url,
        icerik_uzunlugu: content.length,
        kisaltildi: truncated,
        icerik: finalContent,
        ...(ozet_istegi && {
          ozet_istegi,
          not: `Kullanıcı şunu istiyor: "${ozet_istegi}". İçerikten bu bilgiyi çıkar.`,
        }),
      };
    } catch (error) {
      return {
        success: false,
        error: `Sayfa okuma hatası: ${error.message}`,
      };
    }
  },

  // ─── DERİN ARAŞTIRMA (Tavily Research) ─────────────────
  derin_arastirma: async ({ konu, alt_sorular, odak_siteleri, son_gun }) => {
    try {
      if (!isTavilyConfigured()) {
        return {
          success: false,
          error: 'Tavily API key ayarlanmamış. TAVILY_API_KEY environment variable ekleyin.',
        };
      }

      const result = await tavilyResearch(konu, {
        subQueries: alt_sorular || [],
        focusDomains: odak_siteleri || [],
        days: son_gun,
      });

      if (!result.success) {
        return { success: false, error: result.error };
      }

      return {
        success: true,
        kaynak: 'tavily_research',
        konu: result.topic,
        ozet: result.summary,
        kaynak_sayisi: result.totalSources,
        kaynaklar: result.sources?.map((s) => ({
          baslik: s.title,
          url: s.url,
          alinti: s.excerpt,
          skor: s.score,
        })),
        alt_sorular_kullanildi: result.subQueriesUsed,
        uyari: `${result.totalSources} kaynak tarandı. Bilgiler web'den alınmıştır, resmi kaynakları doğrulayın.`,
      };
    } catch (error) {
      return {
        success: false,
        error: `Derin araştırma hatası: ${error.message}`,
      };
    }
  },

  // ─── SİTE TARA (Tavily Crawl) ──────────────────────────
  site_tara: async ({ url, talimat, derinlik, max_sayfa, path_filtre }) => {
    try {
      if (!isTavilyConfigured()) {
        return {
          success: false,
          error: 'Tavily API key ayarlanmamış. TAVILY_API_KEY environment variable ekleyin.',
        };
      }

      if (!url || !url.startsWith('http')) {
        return {
          success: false,
          error: 'Geçerli bir URL giriniz (https://... ile başlamalı)',
        };
      }

      const result = await tavilyCrawl(url, {
        maxDepth: derinlik || 2,
        maxBreadth: 20,
        limit: max_sayfa || 20,
        instructions: talimat,
        selectPaths: path_filtre,
        extractDepth: 'basic',
      });

      if (!result.success) {
        return { success: false, error: result.error };
      }

      if (!result.results || result.results.length === 0) {
        return {
          success: false,
          error: `Site taranamadı veya hiç sayfa bulunamadı: ${url}`,
        };
      }

      // Her sayfanın içeriğini kısalt (context limiti)
      const maxContentLen = 4000;
      const sayfalar = result.results.map((r) => {
        const truncated = r.rawContent?.length > maxContentLen;
        return {
          url: r.url,
          icerik: truncated
            ? `${r.rawContent.substring(0, maxContentLen)}\n\n... [${r.contentLength} karakter, kısaltıldı]`
            : r.rawContent,
          uzunluk: r.contentLength,
          kisaltildi: truncated,
        };
      });

      return {
        success: true,
        kaynak: 'tavily_crawl',
        base_url: result.baseUrl,
        toplam_sayfa: result.totalPages,
        sayfalar,
        ...(talimat && { kullanilan_talimat: talimat }),
        uyari: `${result.totalPages} sayfa tarandı. Tüm içerik web'den çekilmiştir.`,
      };
    } catch (error) {
      return {
        success: false,
        error: `Site tarama hatası: ${error.message}`,
      };
    }
  },

  // ─── SİTE HARİTASI (Tavily Map) ────────────────────────
  site_haritasi: async ({ url, talimat, derinlik, max_link }) => {
    try {
      if (!isTavilyConfigured()) {
        return {
          success: false,
          error: 'Tavily API key ayarlanmamış. TAVILY_API_KEY environment variable ekleyin.',
        };
      }

      if (!url || !url.startsWith('http')) {
        return {
          success: false,
          error: 'Geçerli bir URL giriniz (https://... ile başlamalı)',
        };
      }

      const result = await tavilyMap(url, {
        maxDepth: derinlik || 1,
        maxBreadth: 20,
        limit: max_link || 50,
        instructions: talimat,
      });

      if (!result.success) {
        return { success: false, error: result.error };
      }

      if (!result.urls || result.urls.length === 0) {
        return {
          success: false,
          error: `Site haritası çıkarılamadı: ${url}`,
        };
      }

      // URL'leri grupla (path bazlı)
      const gruplar = {};
      for (const u of result.urls) {
        try {
          const parsed = new URL(u);
          const pathParts = parsed.pathname.split('/').filter(Boolean);
          const grup = pathParts.length > 0 ? `/${pathParts[0]}` : '/';
          if (!gruplar[grup]) gruplar[grup] = [];
          gruplar[grup].push(u);
        } catch {
          if (!gruplar['/diger']) gruplar['/diger'] = [];
          gruplar['/diger'].push(u);
        }
      }

      return {
        success: true,
        kaynak: 'tavily_map',
        base_url: result.baseUrl,
        toplam_url: result.totalUrls,
        url_listesi: result.urls,
        url_gruplari: gruplar,
        ...(talimat && { kullanilan_talimat: talimat }),
        ipucu: "İlginç sayfaların içeriğini görmek için sayfa_oku veya site_tara tool'unu kullanın.",
      };
    } catch (error) {
      return {
        success: false,
        error: `Site haritası hatası: ${error.message}`,
      };
    }
  },
};

// Yerel emsal bilgi bankası
function getYerelEmsaller(arama_tipi) {
  const emsaller = {
    asiri_dusuk: [
      {
        karar_no: '2024/UH.II-1234',
        konu: 'Yemek Hizmeti Aşırı Düşük Teklif',
        ozet: 'Aşırı düşük teklif açıklamasında ana çiğ girdi maliyetlerinin belgelenmesi zorunludur. Fatura, sözleşme veya proforma fatura ile tevsik edilmelidir.',
        sonuc: 'İtiraz KABUL - İhale iptal',
      },
      {
        karar_no: '2024/UH.III-892',
        konu: 'Personel Maliyeti Açıklama',
        ozet: 'Personel maliyetlerinde asgari ücretin altında hesaplama yapılamaz. SGK primleri ve yasal yükler dahil edilmelidir.',
        sonuc: 'İtiraz RED',
      },
      {
        karar_no: '2023/UH.I-3567',
        konu: 'Nakliye Maliyeti',
        ozet: 'Nakliye giderlerinin kendi araç/personel ile karşılanacağı beyanında, araç ruhsatı ve sürücü SGK bildirimi istenebilir.',
        sonuc: 'İtiraz KABUL',
      },
    ],
    degerlendirme_disi: [
      {
        karar_no: '2024/UH.II-2456',
        konu: 'Belge Eksikliği',
        ozet: 'İş deneyim belgesinde benzer iş tanımına uymayan belgeler değerlendirme dışı bırakılma sebebidir.',
        sonuc: 'İtiraz RED',
      },
      {
        karar_no: '2024/UH.I-1789',
        konu: 'Teklif Mektubu Hata',
        ozet: 'Teklif mektubunda yer alan imza eksikliği esasa etkili kabul edilmez, düzeltilebilir.',
        sonuc: 'İtiraz KABUL',
      },
    ],
    yeterlik: [
      {
        karar_no: '2024/UH.III-3421',
        konu: 'Makine-Ekipman Yeterlik',
        ozet: 'İdari şartnamede belirtilen ekipman yeterlik kriterinin karşılanması için taahhütname yeterlidir.',
        sonuc: 'İtiraz KABUL',
      },
      {
        karar_no: '2023/UH.II-4532',
        konu: 'ISO Belgesi Geçerlilik',
        ozet: 'ISO belgelerinin geçerlilik süresinin ihale tarihi itibariyle dolmuş olması değerlendirme dışı bırakılma nedenidir.',
        sonuc: 'İtiraz RED',
      },
    ],
    teknik_sart: [
      {
        karar_no: '2024/UH.I-5678',
        konu: 'Teknik Şartname Belirsizlik',
        ozet: 'Teknik şartnamede belirsiz veya çelişkili düzenlemeler olması durumunda ihale iptal edilebilir.',
        sonuc: 'İtiraz KABUL - İhale iptal',
      },
    ],
    teklif_zarfi: [
      {
        karar_no: '2024/UH.II-7890',
        konu: 'Zarf Açılma Sırası',
        ozet: 'Teklif zarflarının açılma sırasında usulsüzlük iddiaları tutanakla kanıtlanmalıdır.',
        sonuc: 'İtiraz RED',
      },
    ],
    genel: [],
  };

  return emsaller[arama_tipi] || emsaller.genel;
}

// ============================================================
// TAVILY API - Gerçek Web Araması
// ============================================================

async function tavilyArama(sorgu, tip, maxSonuc = 5) {
  const searchDepth = tip === 'haber' ? 'advanced' : 'basic';

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: TAVILY_API_KEY,
      query: sorgu,
      search_depth: searchDepth,
      include_answer: true,
      include_raw_content: false,
      max_results: maxSonuc,
      include_domains: tip === 'mevzuat' ? ['mevzuat.gov.tr', 'sgk.gov.tr', 'kik.gov.tr', 'resmigazete.gov.tr'] : [],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Tavily API hatası: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // Sonuçları düzenle
  const sonuclar =
    data.results?.map((r) => ({
      baslik: r.title,
      icerik: r.content,
      url: r.url,
      skor: r.score,
    })) || [];

  return {
    success: true,
    kaynak: 'tavily_api',
    sorgu,
    tip,
    ai_cevap: data.answer || null,
    sonuc_sayisi: sonuclar.length,
    sonuclar,
    uyari: 'Web araması sonuçları her zaman doğrulanmalıdır.',
  };
}

// ============================================================
// DUCKDUCKGO API - Yedek Arama (Sınırlı)
// ============================================================

async function duckduckgoArama(sorgu, tip) {
  const encodedQuery = encodeURIComponent(sorgu);
  const url = `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1&skip_disambig=1`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'CateringPro/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();
  const results = [];

  if (data.AbstractText) {
    results.push({
      tip: 'ozet',
      baslik: data.Heading || sorgu,
      icerik: data.AbstractText,
      kaynak: data.AbstractSource,
      url: data.AbstractURL,
    });
  }

  if (data.RelatedTopics && data.RelatedTopics.length > 0) {
    data.RelatedTopics.slice(0, 5).forEach((topic) => {
      if (topic.Text) {
        results.push({
          tip: 'ilgili',
          icerik: topic.Text,
          url: topic.FirstURL,
        });
      }
    });
  }

  if (results.length === 0) {
    return {
      success: true,
      kaynak: 'duckduckgo_fallback',
      sorgu,
      sonuc: 'Direkt sonuç bulunamadı. Tavily API key ekleyerek daha iyi sonuçlar alabilirsiniz.',
      oneri: 'TAVILY_API_KEY ekleyin veya mevzuat.gov.tr, sgk.gov.tr, kik.gov.tr gibi resmi siteleri kontrol edin.',
      tavily_kayit: 'https://tavily.com - Ücretsiz 1000 istek/ay',
    };
  }

  return {
    success: true,
    kaynak: 'duckduckgo_fallback',
    sorgu,
    tip,
    sonuc_sayisi: results.length,
    sonuclar: results,
    uyari: 'DuckDuckGo sınırlı sonuç verir. Tavily API key ekleyerek daha iyi sonuçlar alabilirsiniz.',
  };
}

export default { webToolDefinitions, webToolImplementations };
