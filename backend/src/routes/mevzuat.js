import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { query } from '../database.js';
import { tavilySearch, isTavilyConfigured } from '../services/tavily-service.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mevzuat verileri yolu
const MEVZUAT_PATH = path.join(__dirname, '../data/mevzuat');

// Mevzuat dosyasını yükle
const loadMevzuat = (dosyaAdi) => {
  try {
    const filePath = path.join(MEVZUAT_PATH, dosyaAdi);
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (_error) {
    return null;
  }
};

/**
 * Güncel değerleri getir
 * GET /api/mevzuat/guncel-degerler
 */
router.get('/guncel-degerler', async (_req, res) => {
  try {
    const asgariUcret = loadMevzuat('asgari_ucret.json');
    const kikMevzuat = loadMevzuat('kik_mevzuat.json');
    const sgkOranlari = loadMevzuat('sgk_oranlari.json');

    res.json({
      success: true,
      data: {
        asgari_ucret: {
          brut: asgariUcret?.['2026']?.ocak_haziran?.brut || 22104,
          net: asgariUcret?.['2026']?.ocak_haziran?.net_ele_gecen || 17801.65,
          isveren_maliyeti: asgariUcret?.['2026']?.ocak_haziran?.isveren_toplam_maliyet || 25972.2,
          donem: '2026 Ocak-Haziran',
        },
        esik_degerler: {
          mal_hizmet_genel: kikMevzuat?.esik_degerler_2026?.mal_hizmet_alimlari?.genel_butce || 18734124,
          mal_hizmet_diger: kikMevzuat?.esik_degerler_2026?.mal_hizmet_alimlari?.diger_idareler || 31223308,
          yapim_isleri: kikMevzuat?.esik_degerler_2026?.yapim_isleri?.tum_idareler || 686924429,
          dogrudan_temin_buyuksehir:
            kikMevzuat?.esik_degerler_2026?.dogrudan_temin_limiti?.buyuksehir_icinde || 1021827,
          dogrudan_temin_diger: kikMevzuat?.esik_degerler_2026?.dogrudan_temin_limiti?.buyuksehir_disinda || 340648,
        },
        itirazen_sikayet_bedelleri:
          kikMevzuat?.itirazen_sikayet_bedelleri_2025?.bedeller?.map((b) => ({
            alt: b.yaklasik_maliyet_alt,
            ust: b.yaklasik_maliyet_ust,
            bedel: b.bedel,
            aciklama: b.aciklama,
          })) || [],
        sgk_oranlari: {
          isci_toplam: sgkOranlari?.prim_oranlari?.isci_paylari?.toplam || 14,
          isveren_toplam: sgkOranlari?.prim_oranlari?.isveren_paylari?.toplam || 20.5,
        },
        guncelleme_tarihi: '2026-02-01',
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Formülleri getir
 * GET /api/mevzuat/formuller
 */
router.get('/formuller', async (_req, res) => {
  try {
    const kikMevzuat = loadMevzuat('kik_mevzuat.json');

    res.json({
      success: true,
      data: {
        sinir_deger_hizmet: {
          ad: 'Sınır Değer Hesaplama (Hizmet Alımı)',
          formul: 'SD = (YM + T1 + T2 + ... + Tn) / (n + 1) × R',
          aciklama:
            "YM: Yaklaşık Maliyet, Tn: Geçerli teklifler (YM'nin %60'ından düşük ve YM'den yüksek olanlar hariç), R: Sınır değer katsayısı",
        },
        asiri_dusuk_yemek: {
          ad: 'Aşırı Düşük Oran (Yemek İhalesi)',
          formul: '(Ana Çiğ Girdi + İşçilik) / Toplam Teklif',
          oran_alt: kikMevzuat?.asiri_dusuk_teklif?.yemek_ihalesi_formulu?.gecerli_oran_alt || 0.8,
          oran_ust: kikMevzuat?.asiri_dusuk_teklif?.yemek_ihalesi_formulu?.gecerli_oran_ust || 0.95,
          aciklama: 'Hesaplanan oran 0.80 - 0.95 aralığında olmalıdır.',
        },
        personel_dayali: {
          ad: 'Personel Çalıştırılmasına Dayalı Hizmet',
          formul: 'SD = Kar Hariç Yaklaşık Maliyet',
          aciklama:
            'Personel çalıştırılmasına dayalı hizmet alımlarında sınır değer, kar hariç yaklaşık maliyete eşittir.',
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Mevzuat özeti getir
 * GET /api/mevzuat/ozet
 */
router.get('/ozet', async (_req, res) => {
  try {
    const kikMevzuat = loadMevzuat('kik_mevzuat.json');

    res.json({
      success: true,
      data: {
        itiraz_sureleri: kikMevzuat?.itiraz_sureleri || {},
        ihale_usulleri: kikMevzuat?.ihale_usulleri || {},
        yemek_ihalesi_ozel: kikMevzuat?.yemek_ihalesi_ozel || {},
        resmi_tatiller: kikMevzuat?.resmi_tatiller_2026?.tatiller || [],
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Rehber bilgisi getir
 * GET /api/mevzuat/rehber
 */
router.get('/rehber', async (_req, res) => {
  try {
    res.json({
      success: true,
      data: {
        ihale_sureci: [
          'İhale ilanını takip edin (EKAP, ihalebul.com)',
          'İhale dokümanını indirin ve inceleyin',
          'Teknik şartnameyi detaylı okuyun',
          'Yaklaşık maliyet tahminini yapın',
          'Teklif hazırlayın ve kontrol edin',
          'EKAP üzerinden teklif verin',
          'İhale sonucunu takip edin',
          'Gerekirse itiraz sürecini başlatın',
        ],
        sik_hatalar: [
          'İş deneyim belgesinin benzer iş tanımına uymaması',
          'Teklif mektubunda imza eksikliği',
          'Aşırı düşük açıklamada belge eksikliği',
          'İtiraz süresinin kaçırılması',
          'Geçici teminat tutarının yanlış hesaplanması',
        ],
        ipuclari: [
          'Teknik şartnameyi en az 2 kez okuyun',
          'Birim fiyat cetvelini dikkatlice doldurun',
          'Tüm belgeleri kontrol listesi ile doğrulayın',
          'İtiraz sürelerini takvime kaydedin',
          'Benzer işlerde emsal KİK kararlarını inceleyin',
        ],
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Sektör gündemi - Canlı mevzuat ve ihale haberleri
 * GET /api/mevzuat/gundem
 * Query: ?cache=1 (varsayılan: önce DB cache'e bak, 6 saatten eskiyse yenile)
 */
router.get('/gundem', async (req, res) => {
  try {
    // Önce cache kontrol et (sync_logs tablosundan son mevzuat_takip kaydı)
    const forceRefresh = req.query.refresh === '1';
    const cacheHours = 6;

    if (!forceRefresh) {
      try {
        const cached = await query(
          `SELECT details, finished_at FROM sync_logs
           WHERE sync_type = 'mevzuat_takip' AND status = 'success'
           AND finished_at > NOW() - INTERVAL '${cacheHours} hours'
           ORDER BY finished_at DESC LIMIT 1`
        );

        if (cached.rows.length > 0) {
          const details = typeof cached.rows[0].details === 'string'
            ? JSON.parse(cached.rows[0].details)
            : cached.rows[0].details;

          return res.json({
            success: true,
            kaynak: 'cache',
            guncelleme: cached.rows[0].finished_at,
            sonraki_guncelleme: new Date(new Date(cached.rows[0].finished_at).getTime() + cacheHours * 3600000),
            konular: details.konular || [],
          });
        }
      } catch (_dbErr) {
        // DB hatası olursa canlı çek
      }
    }

    // Tavily yoksa statik bilgi dön
    if (!isTavilyConfigured()) {
      return res.json({
        success: true,
        kaynak: 'statik',
        uyari: 'Canlı haber takibi aktif değil (TAVILY_API_KEY gerekli)',
        konular: [],
      });
    }

    // Canlı çek
    const konular = [
      {
        id: 'gida_mevzuat',
        baslik: 'Gıda Mevzuatı',
        sorgu: 'gıda mevzuatı değişiklik tebliğ yönetmelik 2026',
        domainler: ['mevzuat.gov.tr', 'resmigazete.gov.tr', 'tarimorman.gov.tr'],
      },
      {
        id: 'kik_ihale',
        baslik: 'KİK İhale Duyuruları',
        sorgu: 'kamu ihale kurumu yemek hizmeti catering ihale duyurusu 2026',
        domainler: ['kik.gov.tr', 'ekap.kik.gov.tr'],
      },
      {
        id: 'gida_fiyat_trend',
        baslik: 'Gıda Fiyat Trendleri',
        sorgu: 'gıda fiyatları enflasyon artış catering maliyet 2026',
        domainler: [],
      },
    ];

    const sonuclar = [];
    for (const konu of konular) {
      try {
        const result = await tavilySearch(konu.sorgu, {
          searchDepth: 'basic',
          maxResults: 5,
          includeAnswer: true,
          includeDomains: konu.domainler.length > 0 ? konu.domainler : undefined,
          days: 14,
        });

        if (result.success) {
          sonuclar.push({
            konu: konu.id,
            baslik: konu.baslik,
            ozet: result.answer,
            haberler: result.results?.slice(0, 5).map((r) => ({
              baslik: r.title,
              url: r.url,
              ozet: r.content?.substring(0, 200),
              tarih: r.publishedDate,
            })) || [],
          });
        }

        // Rate limit
        await new Promise((r) => setTimeout(r, 500));
      } catch (_err) {
        // Tekil hata, diğerlerine devam
      }
    }

    // Cache'e kaydet
    try {
      await query(
        `INSERT INTO sync_logs (sync_type, status, started_at, finished_at, details)
         VALUES ('mevzuat_takip', 'success', NOW() - INTERVAL '10 seconds', NOW(), $1)`,
        [JSON.stringify({ konular: sonuclar })]
      );
    } catch (_logErr) {
      // Log hatası önemli değil
    }

    res.json({
      success: true,
      kaynak: 'canli',
      guncelleme: new Date(),
      konular: sonuclar,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
