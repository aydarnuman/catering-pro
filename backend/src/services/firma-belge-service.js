/**
 * Firma Belgesi Analiz Servisi
 * Vergi levhası, sicil gazetesi, imza sirküleri vb. belgelerden
 * firma bilgilerini AI ile çıkarır
 * 
 * PDF, Word, Excel ve görsel dosyaları destekler
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import xlsx from 'xlsx';

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

// Desteklenen dosya tipleri
const DESTEKLENEN_TIPLER = {
  pdf: ['.pdf'],
  word: ['.doc', '.docx'],
  excel: ['.xls', '.xlsx'],
  image: ['.jpg', '.jpeg', '.png', '.webp', '.gif']
};

/**
 * Dosya tipini belirle
 */
function getFileCategory(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  if (DESTEKLENEN_TIPLER.pdf.includes(ext)) return 'pdf';
  if (DESTEKLENEN_TIPLER.word.includes(ext)) return 'word';
  if (DESTEKLENEN_TIPLER.excel.includes(ext)) return 'excel';
  if (DESTEKLENEN_TIPLER.image.includes(ext)) return 'image';
  
  return 'unknown';
}

/**
 * PDF'den metin çıkar
 */
async function extractTextFromPDF(filePath) {
  try {
    const dataBuffer = await fs.promises.readFile(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text?.trim() || '';
  } catch (error) {
    console.error('PDF metin çıkarma hatası:', error.message);
    return '';
  }
}

/**
 * Word'den metin çıkar
 */
async function extractTextFromWord(filePath) {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value?.trim() || '';
  } catch (error) {
    console.error('Word metin çıkarma hatası:', error.message);
    return '';
  }
}

/**
 * Excel'den metin çıkar
 */
async function extractTextFromExcel(filePath) {
  try {
    const workbook = xlsx.readFile(filePath);
    let text = '';
    
    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const csv = xlsx.utils.sheet_to_csv(sheet);
      text += `${sheetName}:\n${csv}\n\n`;
    });
    
    return text.trim();
  } catch (error) {
    console.error('Excel metin çıkarma hatası:', error.message);
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
 * Metin tabanlı AI analizi (Word, Excel veya PDF metin)
 */
async function analyzeWithText(text, belgeTipi, belgeConfig) {
  const model = genAI.getGenerativeModel({ 
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp'
  });

  const prompt = `
${belgeConfig.prompt}

Aşağıdaki metin içeriğinden firma bilgilerini çıkar.
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

BELGE METNİ:
${text.slice(0, 15000)}
  `.trim();

  const result = await model.generateContent(prompt);
  return result.response.text();
}

/**
 * Vision tabanlı AI analizi (PDF görsel veya resim)
 */
async function analyzeWithVision(filePath, belgeTipi, belgeConfig, mimeType) {
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.0-flash-exp'
  });

  const ext = path.extname(filePath).toLowerCase();
  const base64Data = await fileToBase64(filePath);
  
  // MIME type belirle
  let imageMimeType = mimeType;
  if (!imageMimeType) {
    const mimeMap = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif'
    };
    imageMimeType = mimeMap[ext] || 'application/octet-stream';
  }

  const visionPrompt = `
${belgeConfig.prompt}

Bu belgeyi dikkatle incele ve bilgileri çıkar.
Tüm yazıları, tabloları ve sembolleri oku.
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

  console.log(`📸 Vision analizi: ${imageMimeType}, ${(base64Data.length / 1024).toFixed(1)}KB`);

  const result = await model.generateContent([
    visionPrompt,
    {
      inlineData: {
        mimeType: imageMimeType,
        data: base64Data
      }
    }
  ]);

  return result.response.text();
}

/**
 * Ana analiz fonksiyonu - Akıllı yönlendirme
 */
export async function analyzeFirmaBelgesi(filePath, belgeTipi, mimeType) {
  try {
    const belgeConfig = BELGE_TIPLERI[belgeTipi];
    if (!belgeConfig) {
      throw new Error(`Bilinmeyen belge tipi: ${belgeTipi}`);
    }

    const fileCategory = getFileCategory(filePath);
    console.log(`🔍 Firma belgesi analizi: ${belgeConfig.ad} (${fileCategory})`);

    let responseText;

    switch (fileCategory) {
      case 'word':
        // Word dosyası - metin tabanlı analiz
        console.log('📝 Word dosyası - metin çıkarılıyor...');
        const wordText = await extractTextFromWord(filePath);
        if (wordText.length > 50) {
          responseText = await analyzeWithText(wordText, belgeTipi, belgeConfig);
        } else {
          throw new Error('Word dosyasından metin çıkarılamadı');
        }
        break;

      case 'excel':
        // Excel dosyası - metin tabanlı analiz
        console.log('📊 Excel dosyası - metin çıkarılıyor...');
        const excelText = await extractTextFromExcel(filePath);
        if (excelText.length > 50) {
          responseText = await analyzeWithText(excelText, belgeTipi, belgeConfig);
        } else {
          throw new Error('Excel dosyasından metin çıkarılamadı');
        }
        break;

      case 'pdf':
        // PDF - Önce metin çıkar, başarısızsa Vision kullan
        console.log('📄 PDF dosyası - hybrid analiz...');
        const pdfText = await extractTextFromPDF(filePath);
        
        if (pdfText.length > 100) {
          // Metin bazlı analiz
          console.log(`   ✓ Metin çıkarıldı: ${pdfText.length} karakter`);
          responseText = await analyzeWithText(pdfText, belgeTipi, belgeConfig);
        } else {
          // Vision tabanlı analiz (taranmış PDF)
          console.log('   ⚠ Metin az, Vision kullanılıyor...');
          responseText = await analyzeWithVision(filePath, belgeTipi, belgeConfig, mimeType);
        }
        break;

      case 'image':
        // Görsel - direkt Vision
        console.log('🖼️ Görsel dosya - Vision analizi...');
        responseText = await analyzeWithVision(filePath, belgeTipi, belgeConfig, mimeType);
        break;

      default:
        throw new Error(`Desteklenmeyen dosya formatı: ${path.extname(filePath)}`);
    }

    return parseGeminiResponse(responseText, belgeTipi, fileCategory);

  } catch (error) {
    console.error('❌ Firma belgesi analiz hatası:', error);
    throw error;
  }
}

/**
 * Gemini yanıtını parse et
 */
function parseGeminiResponse(text, belgeTipi, fileCategory) {
  try {
    // JSON bloğunu bul
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    let parsed;
    
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[1]);
    } else {
      // JSON bloğu yoksa direkt parse dene
      parsed = JSON.parse(text);
    }

    return {
      success: true,
      belgeTipi,
      belgeTipiAd: BELGE_TIPLERI[belgeTipi]?.ad || belgeTipi,
      analizMetodu: fileCategory === 'image' || (fileCategory === 'pdf' && !jsonMatch) ? 'vision' : 'text',
      data: cleanAnalysisData(parsed),
      rawResponse: text
    };

  } catch (error) {
    console.error('JSON parse hatası:', error.message);
    return {
      success: false,
      belgeTipi,
      error: 'Belge analiz edilemedi - AI yanıtı parse edilemedi',
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
    if (value && value !== 'null' && value !== '...' && value !== 'N/A' && value !== '-') {
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
      // Telefon formatla
      else if (key === 'telefon' && typeof value === 'string') {
        cleaned[key] = value.replace(/[^\d\s\-\+\(\)]/g, '').trim();
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

/**
 * Desteklenen dosya formatlarını döndür
 */
export function getDesteklenenDosyaFormatlari() {
  return {
    pdf: DESTEKLENEN_TIPLER.pdf,
    word: DESTEKLENEN_TIPLER.word,
    excel: DESTEKLENEN_TIPLER.excel,
    image: DESTEKLENEN_TIPLER.image,
    all: [
      ...DESTEKLENEN_TIPLER.pdf,
      ...DESTEKLENEN_TIPLER.word,
      ...DESTEKLENEN_TIPLER.excel,
      ...DESTEKLENEN_TIPLER.image
    ]
  };
}

export default {
  analyzeFirmaBelgesi,
  getDesteklenenBelgeTipleri,
  getDesteklenenDosyaFormatlari
};
