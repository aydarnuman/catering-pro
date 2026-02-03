/**
 * Firma Belgesi Analiz Servisi (Claude Sonnet)
 * Vergi levhası, sicil gazetesi, imza sirküleri vb. belgelerden
 * firma bilgilerini AI ile çıkarır
 *
 * PDF, Word, Excel ve görsel dosyaları destekler
 */

import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import xlsx from 'xlsx';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';

// Belge tiplerine göre çıkarılacak alanlar
const BELGE_TIPLERI = {
  vergi_levhasi: {
    ad: 'Vergi Levhası',
    alanlar: ['unvan', 'vergi_dairesi', 'vergi_no', 'adres', 'il', 'ilce', 'faaliyet_kodu', 'nace_kodu'],
    prompt: `Bu bir VERGİ LEVHASI belgesidir. Aşağıdaki bilgileri DİKKATLE çıkar:

ÖNEMLİ ALANLAR:
1. MÜKELLEF ÜNVANI (firma adı, şirket adı) - Genellikle en üstte büyük harflerle yazılır
2. VERGİ DAİRESİ - "... Vergi Dairesi" şeklinde yazar
3. VERGİ KİMLİK NUMARASI (VKN) - 10 haneli rakam, genellikle "Vergi Kimlik No:", "VKN:", "T.C. Kimlik No:" gibi etiketlerden sonra gelir
4. ADRES - Açık adres bilgisi
5. İL ve İLÇE - Adres içinden çıkar
6. FAALİYET KODU / NACE KODU - 6 haneli rakam (örn: 562990, 561000)
7. VERGİ LEVHASI TARİHİ

DİKKAT: Vergi Kimlik Numarası (VKN) 10 haneli bir sayıdır ve mutlaka belgede bulunur!`,
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
- Gazete Tarihi ve Sayısı`,
  },
  imza_sirküleri: {
    ad: 'İmza Sirküleri',
    alanlar: ['yetkili_adi', 'yetkili_tc', 'yetkili_unvani', 'imza_yetkisi'],
    prompt: `Bu bir İMZA SİRKÜLERİ belgesidir. Aşağıdaki bilgileri çıkar:
- Yetkili Kişi Adı Soyadı
- TC Kimlik Numarası
- Unvanı (Şirket Müdürü, Genel Müdür vs.)
- İmza Yetkisi Kapsamı (münferit, müşterek vs.)
- Noter Bilgileri ve Tarih`,
  },
  faaliyet_belgesi: {
    ad: 'Faaliyet Belgesi / Oda Kayıt Belgesi',
    alanlar: ['unvan', 'oda_sicil_no', 'faaliyet_alanlari'],
    prompt: `Bu bir FAALİYET BELGESİ / ODA KAYIT BELGESİ belgesidir. Aşağıdaki bilgileri çıkar:
- Firma Ünvanı
- Oda Sicil Numarası
- Faaliyet Alanları
- Kayıt Tarihi
- Oda Adı (Ticaret Odası, Sanayi Odası vs.)`,
  },
  iso_sertifika: {
    ad: 'ISO Sertifikası',
    alanlar: ['unvan', 'sertifika_no', 'sertifika_turu', 'gecerlilik_tarihi'],
    prompt: `Bu bir ISO SERTİFİKASI belgesidir. Aşağıdaki bilgileri çıkar:
- Firma Ünvanı
- Sertifika Numarası
- Sertifika Türü (ISO 9001, ISO 22000, HACCP vs.)
- Geçerlilik Başlangıç ve Bitiş Tarihi
- Akreditasyon Kuruluşu`,
  },
  vekaletname: {
    ad: 'Vekaletname',
    alanlar: ['yetkili_adi', 'yetkili_tc', 'imza_yetkisi'],
    prompt: `Bu bir VEKALETNAME belgesidir. Aşağıdaki bilgileri çıkar:
- Vekil Adı Soyadı
- Vekil TC Kimlik No
- Yetki Kapsamı
- Noter Bilgileri ve Tarih`,
  },
  diger: {
    ad: 'Genel Belge',
    alanlar: ['unvan', 'vergi_no', 'vergi_dairesi', 'adres', 'il', 'ilce', 'yetkili_adi'],
    prompt: `Bu belgeden firma ile ilgili tüm bilgileri çıkar:
- Firma Ünvanı
- Vergi Kimlik Numarası (10 haneli)
- Vergi Dairesi
- Adres, İl, İlçe
- Yetkili Kişi Bilgileri
- Diğer önemli bilgiler`,
  },
};

// Desteklenen dosya tipleri
const DESTEKLENEN_TIPLER = {
  pdf: ['.pdf'],
  word: ['.doc', '.docx'],
  excel: ['.xls', '.xlsx'],
  image: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
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
  } catch (_error) {
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
  } catch (_error) {
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

    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const csv = xlsx.utils.sheet_to_csv(sheet);
      text += `${sheetName}:\n${csv}\n\n`;
    });

    return text.trim();
  } catch (_error) {
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
 * Claude ile analiz yap (text)
 */
async function analyzeWithText(text, _belgeTipi, belgeConfig) {
  const prompt = `
${belgeConfig.prompt}

Aşağıdaki metin içeriğinden firma bilgilerini çıkar.
Lütfen JSON formatında yanıt ver. Bulamadığın alanları null olarak bırak.

\`\`\`json
{
  "unvan": "Firma/Şirket Ünvanı - ZORUNLU",
  "vergi_no": "10 haneli Vergi Kimlik Numarası (VKN) - ZORUNLU, sadece rakamlar",
  "vergi_dairesi": "Vergi Dairesi Adı",
  "adres": "Tam adres",
  "il": "İl (şehir adı)",
  "ilce": "İlçe",
  "telefon": "Telefon numarası",
  "faaliyet_kodu": "6 haneli NACE/Faaliyet kodu",
  "ticaret_sicil_no": "Ticaret sicil numarası",
  "mersis_no": "16 haneli MERSİS numarası",
  "yetkili_adi": "Yetkili kişi adı soyadı",
  "yetkili_tc": "11 haneli TC Kimlik No",
  "yetkili_unvani": "Unvanı (Müdür, Genel Müdür vs.)",
  "imza_yetkisi": "İmza yetkisi açıklaması",
  "belge_tarihi": "Belge tarihi (YYYY-MM-DD)",
  "guven_skoru": 0.85
}
\`\`\`

NOT: vergi_no (VKN) belgede mutlaka bulunur, 10 haneli sayıdır. Bulamazsan tekrar ara!

BELGE METNİ:
${text.slice(0, 15000)}
  `.trim();

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.content[0]?.text || '';
}

/**
 * Claude Vision ile analiz (görsel/PDF)
 */
async function analyzeWithVision(filePath, _belgeTipi, belgeConfig, mimeType) {
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
      '.gif': 'image/gif',
    };
    imageMimeType = mimeMap[ext] || 'application/octet-stream';
  }

  const visionPrompt = `
${belgeConfig.prompt}

Bu belgeyi DİKKATLE incele ve TÜM bilgileri çıkar.
Tüm yazıları, tabloları, sayıları ve etiketleri oku.
ÖZELLİKLE VERGİ KİMLİK NUMARASINI (VKN - 10 haneli) BUL!
Lütfen JSON formatında yanıt ver. Bulamadığın alanları null olarak bırak.

\`\`\`json
{
  "unvan": "Firma/Şirket Ünvanı - ZORUNLU",
  "vergi_no": "10 haneli Vergi Kimlik Numarası (VKN) - ZORUNLU, sadece rakamlar",
  "vergi_dairesi": "Vergi Dairesi Adı",
  "adres": "Tam adres",
  "il": "İl (şehir adı)",
  "ilce": "İlçe",
  "telefon": "Telefon numarası",
  "faaliyet_kodu": "6 haneli NACE/Faaliyet kodu",
  "ticaret_sicil_no": "Ticaret sicil numarası",
  "mersis_no": "16 haneli MERSİS numarası",
  "yetkili_adi": "Yetkili kişi adı soyadı",
  "yetkili_tc": "11 haneli TC Kimlik No",
  "yetkili_unvani": "Unvanı (Müdür, Genel Müdür vs.)",
  "imza_yetkisi": "İmza yetkisi açıklaması",
  "belge_tarihi": "Belge tarihi (YYYY-MM-DD)",
  "guven_skoru": 0.85
}
\`\`\`
  `.trim();

  // PDF için document type, görsel için image type
  const contentBlock =
    imageMimeType === 'application/pdf'
      ? {
          type: 'document',
          source: {
            type: 'base64',
            media_type: imageMimeType,
            data: base64Data,
          },
        }
      : {
          type: 'image',
          source: {
            type: 'base64',
            media_type: imageMimeType,
            data: base64Data,
          },
        };

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [contentBlock, { type: 'text', text: visionPrompt }],
      },
    ],
  });

  return response.content[0]?.text || '';
}

/**
 * Belge tipini otomatik algıla
 */
async function detectBelgeTipi(filePath, mimeType) {
  const fileCategory = getFileCategory(filePath);

  let content;

  if (fileCategory === 'image' || fileCategory === 'pdf') {
    // Vision ile analiz
    const base64Data = await fileToBase64(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
    };
    const imageMimeType = mimeType || mimeMap[ext] || 'application/pdf';

    const contentBlock =
      imageMimeType === 'application/pdf'
        ? {
            type: 'document',
            source: {
              type: 'base64',
              media_type: imageMimeType,
              data: base64Data,
            },
          }
        : {
            type: 'image',
            source: {
              type: 'base64',
              media_type: imageMimeType,
              data: base64Data,
            },
          };

    content = [
      contentBlock,
      {
        type: 'text',
        text: `Bu belgeye bak ve türünü belirle. Sadece şu tiplerden birini seç:
- vergi_levhasi (Vergi Levhası, VKN belgesi)
- sicil_gazetesi (Ticaret Sicil Gazetesi)
- imza_sirküleri (İmza Sirküleri, Noter onaylı imza)
- faaliyet_belgesi (Faaliyet Belgesi, Oda Kayıt Belgesi, İşletme Kayıt)
- iso_sertifika (ISO, HACCP, TSE, Helal sertifikaları)
- vekaletname (Vekaletname)
- diger (Tanımlanamayan belge)

SADECE belge tipinin key değerini yaz, başka bir şey yazma.
Örnek yanıt: vergi_levhasi`,
      },
    ];
  } else {
    // Metin tabanlı analiz
    let text = '';
    if (fileCategory === 'word') {
      text = await extractTextFromWord(filePath);
    } else if (fileCategory === 'excel') {
      text = await extractTextFromExcel(filePath);
    } else if (fileCategory === 'pdf') {
      text = await extractTextFromPDF(filePath);
    }

    content = [
      {
        type: 'text',
        text: `Bu belge metnine bak ve türünü belirle. Sadece şu tiplerden birini seç:
- vergi_levhasi (Vergi Levhası, VKN belgesi)
- sicil_gazetesi (Ticaret Sicil Gazetesi)
- imza_sirküleri (İmza Sirküleri, Noter onaylı imza)
- faaliyet_belgesi (Faaliyet Belgesi, Oda Kayıt Belgesi, İşletme Kayıt)
- iso_sertifika (ISO, HACCP, TSE, Helal sertifikaları)
- vekaletname (Vekaletname)
- diger (Tanımlanamayan belge)

SADECE belge tipinin key değerini yaz, başka bir şey yazma.

BELGE METNİ:
${text.slice(0, 3000)}`,
      },
    ];
  }

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 100,
    messages: [{ role: 'user', content }],
  });

  const detected = (response.content[0]?.text || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z_]/g, '');

  // Geçerli tip mi kontrol et
  const validTypes = [
    'vergi_levhasi',
    'sicil_gazetesi',
    'imza_sirküleri',
    'faaliyet_belgesi',
    'iso_sertifika',
    'vekaletname',
    'diger',
  ];
  return validTypes.includes(detected) ? detected : 'diger';
}

/**
 * Ana analiz fonksiyonu - Akıllı yönlendirme
 */
export async function analyzeFirmaBelgesi(filePath, belgeTipi, mimeType) {
  // Belge tipi verilmediyse otomatik algıla
  if (!belgeTipi || belgeTipi === 'auto' || belgeTipi === 'otomatik') {
    belgeTipi = await detectBelgeTipi(filePath, mimeType);
  }

  const belgeConfig = BELGE_TIPLERI[belgeTipi] ||
    BELGE_TIPLERI['diger'] || {
      ad: 'Genel Belge',
      alanlar: ['unvan', 'vergi_no', 'adres'],
      prompt: 'Bu belgeden firma bilgilerini çıkar.',
    };

  const fileCategory = getFileCategory(filePath);

  let responseText;

  switch (fileCategory) {
    case 'word': {
      const wordText = await extractTextFromWord(filePath);
      if (wordText.length > 50) {
        responseText = await analyzeWithText(wordText, belgeTipi, belgeConfig);
      } else {
        throw new Error('Word dosyasından metin çıkarılamadı');
      }
      break;
    }

    case 'excel': {
      const excelText = await extractTextFromExcel(filePath);
      if (excelText.length > 50) {
        responseText = await analyzeWithText(excelText, belgeTipi, belgeConfig);
      } else {
        throw new Error('Excel dosyasından metin çıkarılamadı');
      }
      break;
    }

    case 'pdf': {
      const pdfText = await extractTextFromPDF(filePath);

      if (pdfText.length > 100) {
        responseText = await analyzeWithText(pdfText, belgeTipi, belgeConfig);
      } else {
        responseText = await analyzeWithVision(filePath, belgeTipi, belgeConfig, mimeType);
      }
      break;
    }

    case 'image':
      responseText = await analyzeWithVision(filePath, belgeTipi, belgeConfig, mimeType);
      break;

    default:
      throw new Error(`Desteklenmeyen dosya formatı: ${path.extname(filePath)}`);
  }

  return parseClaudeResponse(responseText, belgeTipi, fileCategory);
}

/**
 * Claude yanıtını parse et
 */
function parseClaudeResponse(text, belgeTipi, fileCategory) {
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
      rawResponse: text,
    };
  } catch (_error) {
    return {
      success: false,
      belgeTipi,
      error: 'Belge analiz edilemedi - AI yanıtı parse edilemedi',
      rawResponse: text,
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
        cleaned[key] = value.replace(/[^\d\s\-+()]/g, '').trim();
      } else {
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
    alanlar: value.alanlar,
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
      ...DESTEKLENEN_TIPLER.image,
    ],
  };
}

export default {
  analyzeFirmaBelgesi,
  getDesteklenenBelgeTipleri,
  getDesteklenenDosyaFormatlari,
};
