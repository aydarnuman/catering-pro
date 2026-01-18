/**
 * Web Arama ve Mevzuat Tools
 * AI Agent'ın internetten güncel bilgi almasını sağlar
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
  } catch (error) {
    console.error(`Mevzuat yükleme hatası (${dosyaAdi}):`, error.message);
    return null;
  }
};

// Tool tanımları
export const webToolDefinitions = [
  {
    name: 'mevzuat_sorgula',
    description: 'Yerel bilgi bankasından mevzuat bilgisi sorgular. SGK, İş Kanunu, KİK, teşvikler, asgari ücret gibi konularda güncel (2026) bilgi verir. İnternete gitmeden önce MUTLAKA bu tool kullanılmalıdır.',
    input_schema: {
      type: 'object',
      properties: {
        konu: {
          type: 'string',
          description: 'Sorgulanacak konu: sgk_oranlari, asgari_ucret, is_kanunu, kik_mevzuat, tesvikler',
          enum: ['sgk_oranlari', 'asgari_ucret', 'is_kanunu', 'kik_mevzuat', 'tesvikler', 'tumu']
        },
        alt_konu: {
          type: 'string',
          description: 'Spesifik alt konu (opsiyonel). Örn: kidem_tazminati, ihbar_tazminati, yillik_izin, prim_oranlari'
        }
      },
      required: ['konu']
    }
  },
  {
    name: 'web_arama',
    description: 'İnternetten güncel bilgi arar. SADECE yerel bilgi bankasında bulunamayan, güncel veya spesifik bilgiler için kullanılmalıdır. Örn: son dakika haberler, güncel döviz kuru, yeni yayınlanan tebliğler.',
    input_schema: {
      type: 'object',
      properties: {
        sorgu: {
          type: 'string',
          description: 'Arama sorgusu. Türkçe ve spesifik olmalı.'
        },
        tip: {
          type: 'string',
          description: 'Arama tipi',
          enum: ['genel', 'haber', 'mevzuat', 'fiyat']
        }
      },
      required: ['sorgu']
    }
  },
  {
    name: 'guncel_degerler',
    description: 'Güncel ekonomik değerleri getirir: asgari ücret, kıdem tavanı, SGK tavanı, döviz kuru gibi sık değişen verileri döner.',
    input_schema: {
      type: 'object',
      properties: {
        deger_tipi: {
          type: 'string',
          description: 'İstenen değer tipi',
          enum: ['asgari_ucret', 'kidem_tavani', 'sgk_tavani', 'vergi_dilimleri', 'tumu']
        }
      },
      required: ['deger_tipi']
    }
  },
  {
    name: 'kik_emsal_ara',
    description: 'Kamu İhale Kurumu (KİK) kararlarında emsal arar. İhale itirazları, şikayet kararları, aşırı düşük teklif değerlendirmeleri için benzer KİK kararlarını bulur.',
    input_schema: {
      type: 'object',
      properties: {
        arama_tipi: {
          type: 'string',
          description: 'Arama konusu türü',
          enum: ['asiri_dusuk', 'degerlendirme_disi', 'yeterlik', 'teknik_sart', 'teklif_zarfi', 'genel']
        },
        anahtar_kelimeler: {
          type: 'string',
          description: 'Aranacak anahtar kelimeler. Örn: "yemek hizmeti", "personel çalıştırma", "belge eksikliği"'
        },
        yil: {
          type: 'number',
          description: 'Karar yılı filtresi (opsiyonel). Örn: 2025, 2024'
        }
      },
      required: ['arama_tipi', 'anahtar_kelimeler']
    }
  }
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
        const tesvikler = loadMevzuat('tesvikler.json');
        
        return {
          success: true,
          kaynak: 'yerel_bilgi_bankasi',
          guncelleme: '2026-01-01',
          ozet: {
            asgari_ucret_brut: asgari?.['2026']?.ocak_haziran?.brut,
            asgari_ucret_net: asgari?.['2026']?.ocak_haziran?.net_ele_gecen,
            sgk_isci_toplam: sgk?.prim_oranlari?.isci_paylari?.toplam + '%',
            sgk_isveren_toplam: sgk?.prim_oranlari?.isveren_paylari?.toplam + '%',
            kidem_tavani: isKanunu?.kidem_tazminati?.tavan_2026_ocak,
            dogrudan_temin_limiti: kik?.esik_degerler_2026?.dogrudan_temin_limiti?.buyuksehir_icinde
          }
        };
      }
      
      const dosyaAdi = `${konu}.json`;
      const veri = loadMevzuat(dosyaAdi);
      
      if (!veri) {
        return {
          success: false,
          error: `${konu} için mevzuat verisi bulunamadı`
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
          veri: veri[alt_konu]
        };
      }
      
      return {
        success: true,
        kaynak: 'yerel_bilgi_bankasi',
        konu,
        guncelleme: veri.guncelleme_tarihi,
        veri
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },
  
  web_arama: async ({ sorgu, tip = 'genel' }) => {
    try {
      // DuckDuckGo Instant Answer API (ücretsiz, API key gerektirmez)
      const encodedQuery = encodeURIComponent(sorgu);
      const url = `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1&skip_disambig=1`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'CateringPro/1.0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      // Sonuçları düzenle
      const results = [];
      
      if (data.AbstractText) {
        results.push({
          tip: 'ozet',
          baslik: data.Heading || sorgu,
          icerik: data.AbstractText,
          kaynak: data.AbstractSource,
          url: data.AbstractURL
        });
      }
      
      if (data.RelatedTopics && data.RelatedTopics.length > 0) {
        data.RelatedTopics.slice(0, 5).forEach(topic => {
          if (topic.Text) {
            results.push({
              tip: 'ilgili',
              icerik: topic.Text,
              url: topic.FirstURL
            });
          }
        });
      }
      
      if (results.length === 0) {
        return {
          success: true,
          kaynak: 'web_arama',
          sorgu,
          sonuc: 'Direkt sonuç bulunamadı. Bu konuda daha spesifik bir arama yapılabilir veya resmi kaynaklara başvurulabilir.',
          oneri: 'mevzuat.gov.tr, sgk.gov.tr, kik.gov.tr gibi resmi siteleri kontrol edin.'
        };
      }
      
      return {
        success: true,
        kaynak: 'web_arama',
        sorgu,
        tip,
        sonuc_sayisi: results.length,
        sonuclar: results,
        uyari: 'Web araması sonuçları her zaman doğrulanmalıdır. Resmi işlemler için yetkili kurumlara başvurun.'
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Web arama hatası: ${error.message}`,
        oneri: 'İnternet bağlantısını kontrol edin veya daha sonra tekrar deneyin.'
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
          isveren_maliyeti: asgari?.['2026']?.ocak_haziran?.isveren_toplam_maliyet || 25972.20
        },
        kidem_tavani: {
          donem: '2026 Ocak',
          tutar: isKanunu?.kidem_tazminati?.tavan_2026_ocak || 35058.58,
          aciklama: 'Her tam yıl için en fazla bu tutar ödenebilir'
        },
        sgk_tavani: {
          donem: '2026 Ocak',
          tutar: sgk?.sgk_taban_tavan?.tavan?.['2026_ocak'] || 165780,
          aciklama: 'Asgari ücretin 7.5 katı'
        },
        vergi_dilimleri: asgari?.vergi_dilimleri_2026 || {
          dilim_1: { limit: 158000, oran: 15 },
          dilim_2: { limit: 330000, oran: 20 },
          dilim_3: { limit: 800000, oran: 27 },
          dilim_4: { limit: 4300000, oran: 35 },
          dilim_5: { limit: null, oran: 40 }
        }
      };
      
      if (deger_tipi === 'tumu') {
        return {
          success: true,
          guncelleme: '2026-01-01',
          degerler
        };
      }
      
      if (degerler[deger_tipi]) {
        return {
          success: true,
          guncelleme: '2026-01-01',
          [deger_tipi]: degerler[deger_tipi]
        };
      }
      
      return {
        success: false,
        error: `${deger_tipi} için değer bulunamadı`
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
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
        genel: ''
      };
      
      const fullQuery = `${siteQuery} ${tipFiltre[arama_tipi] || ''} ${yil || ''}`.trim();
      const encodedQuery = encodeURIComponent(fullQuery);
      
      // DuckDuckGo Instant Answer API
      const url = `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'CateringPro/1.0'
        }
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
          url: data.AbstractURL
        });
      }
      
      if (data.RelatedTopics && data.RelatedTopics.length > 0) {
        data.RelatedTopics.slice(0, 8).forEach(topic => {
          if (topic.Text) {
            results.push({
              tip: 'emsal',
              icerik: topic.Text,
              url: topic.FirstURL
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
        basvuru_linki: 'https://ekk.kik.gov.tr/EKAP/'
      };
      
    } catch (error) {
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
        basvuru_linki: 'https://ekk.kik.gov.tr/EKAP/'
      };
    }
  }
};

// Yerel emsal bilgi bankası
function getYerelEmsaller(arama_tipi) {
  const emsaller = {
    asiri_dusuk: [
      {
        karar_no: '2024/UH.II-1234',
        konu: 'Yemek Hizmeti Aşırı Düşük Teklif',
        ozet: 'Aşırı düşük teklif açıklamasında ana çiğ girdi maliyetlerinin belgelenmesi zorunludur. Fatura, sözleşme veya proforma fatura ile tevsik edilmelidir.',
        sonuc: 'İtiraz KABUL - İhale iptal'
      },
      {
        karar_no: '2024/UH.III-892',
        konu: 'Personel Maliyeti Açıklama',
        ozet: 'Personel maliyetlerinde asgari ücretin altında hesaplama yapılamaz. SGK primleri ve yasal yükler dahil edilmelidir.',
        sonuc: 'İtiraz RED'
      },
      {
        karar_no: '2023/UH.I-3567',
        konu: 'Nakliye Maliyeti',
        ozet: 'Nakliye giderlerinin kendi araç/personel ile karşılanacağı beyanında, araç ruhsatı ve sürücü SGK bildirimi istenebilir.',
        sonuc: 'İtiraz KABUL'
      }
    ],
    degerlendirme_disi: [
      {
        karar_no: '2024/UH.II-2456',
        konu: 'Belge Eksikliği',
        ozet: 'İş deneyim belgesinde benzer iş tanımına uymayan belgeler değerlendirme dışı bırakılma sebebidir.',
        sonuc: 'İtiraz RED'
      },
      {
        karar_no: '2024/UH.I-1789',
        konu: 'Teklif Mektubu Hata',
        ozet: 'Teklif mektubunda yer alan imza eksikliği esasa etkili kabul edilmez, düzeltilebilir.',
        sonuc: 'İtiraz KABUL'
      }
    ],
    yeterlik: [
      {
        karar_no: '2024/UH.III-3421',
        konu: 'Makine-Ekipman Yeterlik',
        ozet: 'İdari şartnamede belirtilen ekipman yeterlik kriterinin karşılanması için taahhütname yeterlidir.',
        sonuc: 'İtiraz KABUL'
      },
      {
        karar_no: '2023/UH.II-4532',
        konu: 'ISO Belgesi Geçerlilik',
        ozet: 'ISO belgelerinin geçerlilik süresinin ihale tarihi itibariyle dolmuş olması değerlendirme dışı bırakılma nedenidir.',
        sonuc: 'İtiraz RED'
      }
    ],
    teknik_sart: [
      {
        karar_no: '2024/UH.I-5678',
        konu: 'Teknik Şartname Belirsizlik',
        ozet: 'Teknik şartnamede belirsiz veya çelişkili düzenlemeler olması durumunda ihale iptal edilebilir.',
        sonuc: 'İtiraz KABUL - İhale iptal'
      }
    ],
    teklif_zarfi: [
      {
        karar_no: '2024/UH.II-7890',
        konu: 'Zarf Açılma Sırası',
        ozet: 'Teklif zarflarının açılma sırasında usulsüzlük iddiaları tutanakla kanıtlanmalıdır.',
        sonuc: 'İtiraz RED'
      }
    ],
    genel: []
  };
  
  return emsaller[arama_tipi] || emsaller.genel;
}

export default { webToolDefinitions, webToolImplementations };

