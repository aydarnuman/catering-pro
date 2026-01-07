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
  }
};

export default { webToolDefinitions, webToolImplementations };

