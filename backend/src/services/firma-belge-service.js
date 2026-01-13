/**
 * Firma Belgesi Analiz Servisi
 * Vergi levhası, sicil gazetesi, imza sirküleri vb. belgelerden
 * firma bilgilerini AI ile çıkarır
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Belge tiplerine göre çıkarılacak alanlar
const BELGE_TIPLERI = {
  vergi_levhasi: {
    ad: 'Vergi Levhası',
    alanlar: ['unvan', 'vergi_dairesi', 'vergi_no', 'adres', 'faaliyet_kodu', 'nace_kodu'],
    prompt: `Bu bir VERGİ LEVHASI belgesidir. Aşağıdaki bilgileri çıkar:
- Mükellef Ünvanı (firma adı)
- Vergi Dairesi
- Vergi Kimlik Numarası (10 haneli)
- Adres
- Faaliyet Kodu / NACE Kodu
- Vergi Levhası Tarihi`
  },
  sicil_gazetesi: {
    ad: 'Ticaret Sicil Gazetesi',
    alanlar: ['unvan', 'ticaret_sicil_no', 'mersis_no', 'sermaye', 'ortaklar', 'yetkili_adi', 'yetkili_tc'],
    prompt: `Bu bir TİCARET SİCİL GAZETESİ belgesidir. Aşağıdaki bilgileri çıkar:
- Şirket Ünvanı
- Ticaret Sicil Numarası
- MERSİS Numarası (16 haneli)
- Sermaye
- Ortaklar ve Hisse Oranları
- Şirketi Temsile Yetkili Kişi(ler)
- Yetkili TC Kimlik No
- Gazete Tarihi ve Sayısı`
  },
  imza_sirküleri: {
    ad: 'İmza Sirküleri',
    alanlar: ['yetkili_adi', 'yetkili_tc', 'yetkili_unvani', 'imza_yetkisi'],
    prompt: `Bu bir İMZA SİRKÜLERİ belgesidir. Aşağıdaki bilgileri çıkar:
- Yetkili Kişi Adı Soyadı
- TC Kimlik Numarası
- Unvanı (Şirket Müdürü, Genel Müdür vs.)
- İmza Yetkisi Kapsamı (münferit, müşterek vs.)
- Noter Bilgileri ve Tarih`
  },
  faaliyet_belgesi: {
    ad: 'Faaliyet Belgesi / Oda Kayıt Belgesi',
    alanlar: ['unvan', 'oda_sicil_no', 'faaliyet_alanlari'],
    prompt: `Bu bir FAALİYET BELGESİ / ODA KAYIT BELGESİ belgesidir. Aşağıdaki bilgileri çıkar:
- Firma Ünvanı
- Oda Sicil Numarası
- Faaliyet Alanları
- Kayıt Tarihi
- Oda Adı (Ticaret Odası, Sanayi Odası vs.)`
  },
  iso_sertifika: {
    ad: 'ISO Sertifikası',
    alanlar: ['unvan', 'sertifika_no', 'sertifika_turu', 'gecerlilik_tarihi'],
    prompt: `Bu bir ISO SERTİFİKASI belgesidir. Aşağıdaki bilgileri çıkar:
- Firma Ünvanı
- Sertifika Numarası
- Sertifika Türü (ISO 9001, ISO 22000, HACCP vs.)
- Geçerlilik Başlangıç ve Bitiş Tarihi
- Akreditasyon Kuruluşu`
  }
};

/**
 * PDF'den metin çıkar
 */
async function extractTextFromPDF(filePath) {
  try {
    const dataBuffer = await fs.promises.readFile(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  } catch (error) {
    console.error('PDF metin çıkarma hatası:', error);
    return '';
  }
}

/**
 * Görsel dosyayı base64'e çevir
 */
async function fileToBase64(filePath) {
  const data = await fs.promises.readFile(filePath);
  return data.toString('base64');
}

/**
 * Gemini ile belge analizi
 */
export async function analyzeFirmaBelgesi(filePath, belgeTipi, mimeType) {
  try {
    const belgeConfig = BELGE_TIPLERI[belgeTipi];
    if (!belgeConfig) {
      throw new Error(`Bilinmeyen belge tipi: ${belgeTipi}`);
    }

    console.log(`🔍 Firma belgesi analizi başlıyor: ${belgeConfig.ad}`);

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp'
    });

    // Her zaman görsel tabanlı analiz kullan (PDF dahil)
    // Gemini Vision PDF'leri direkt okuyabiliyor
    const ext = path.extname(filePath).toLowerCase();
    const base64Data = await fileToBase64(filePath);
    
    // MIME type belirle
    let imageMimeType = mimeType;
    if (!imageMimeType) {
      if (ext === '.pdf') imageMimeType = 'application/pdf';
      else if (ext === '.png') imageMimeType = 'image/png';
      else if (ext === '.jpg' || ext === '.jpeg') imageMimeType = 'image/jpeg';
      else if (ext === '.webp') imageMimeType = 'image/webp';
      else imageMimeType = 'application/octet-stream';
    }
    
    console.log(`📄 Belge tipi: ${imageMimeType}, boyut: ${base64Data.length} bytes`);

    const visionPrompt = `
${belgeConfig.prompt}

Bu belgeyi dikkatle incele ve bilgileri çıkar.
Lütfen JSON formatında yanıt ver. Bulamadığın alanları null olarak bırak.

\`\`\`json
{
  "unvan": "Firma/Şirket Ünvanı",
  "vergi_dairesi": "Vergi Dairesi Adı",
  "vergi_no": "10 haneli vergi numarası",
  "ticaret_sicil_no": "Ticaret sicil numarası",
  "mersis_no": "16 haneli MERSİS numarası",
  "adres": "Tam adres",
  "il": "İl",
  "ilce": "İlçe",
  "telefon": "Telefon numarası",
  "yetkili_adi": "Yetkili kişi adı soyadı",
  "yetkili_tc": "TC Kimlik No",
  "yetkili_unvani": "Unvanı (Müdür, Genel Müdür vs.)",
  "imza_yetkisi": "İmza yetkisi açıklaması",
  "faaliyet_kodu": "NACE/Faaliyet kodu",
  "belge_tarihi": "Belge tarihi (YYYY-MM-DD)",
  "guven_skoru": 0.85
}
\`\`\`
    `.trim();

    const result = await model.generateContent([
      visionPrompt,
      {
        inlineData: {
          mimeType: imageMimeType,
          data: base64Data
        }
      }
    ]);

    const response = await result.response;
    return parseGeminiResponse(response.text(), belgeTipi);

  } catch (error) {
    console.error('Firma belgesi analiz hatası:', error);
    throw error;
  }
}

/**
 * Gemini yanıtını parse et
 */
function parseGeminiResponse(text, belgeTipi) {
  try {
    // JSON bloğunu bul
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]);
      return {
        success: true,
        belgeTipi,
        belgeTipiAd: BELGE_TIPLERI[belgeTipi]?.ad || belgeTipi,
        data: cleanAnalysisData(parsed),
        rawResponse: text
      };
    }

    // JSON bloğu yoksa direkt parse dene
    const parsed = JSON.parse(text);
    return {
      success: true,
      belgeTipi,
      belgeTipiAd: BELGE_TIPLERI[belgeTipi]?.ad || belgeTipi,
      data: cleanAnalysisData(parsed),
      rawResponse: text
    };

  } catch (error) {
    console.error('JSON parse hatası:', error);
    return {
      success: false,
      belgeTipi,
      error: 'Belge analiz edilemedi',
      rawResponse: text
    };
  }
}

/**
 * Analiz verilerini temizle
 */
function cleanAnalysisData(data) {
  const cleaned = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (value && value !== 'null' && value !== '...' && value !== 'N/A') {
      // Vergi no temizle (sadece rakam)
      if (key === 'vergi_no' && typeof value === 'string') {
        cleaned[key] = value.replace(/\D/g, '').slice(0, 10);
      }
      // TC temizle
      else if (key === 'yetkili_tc' && typeof value === 'string') {
        cleaned[key] = value.replace(/\D/g, '').slice(0, 11);
      }
      // MERSİS temizle
      else if (key === 'mersis_no' && typeof value === 'string') {
        cleaned[key] = value.replace(/\D/g, '').slice(0, 16);
      }
      else {
        cleaned[key] = value;
      }
    }
  }
  
  return cleaned;
}

/**
 * Desteklenen belge tiplerini döndür
 */
export function getDesteklenenBelgeTipleri() {
  return Object.entries(BELGE_TIPLERI).map(([key, value]) => ({
    value: key,
    label: value.ad,
    alanlar: value.alanlar
  }));
}

export default {
  analyzeFirmaBelgesi,
  getDesteklenenBelgeTipleri
};
