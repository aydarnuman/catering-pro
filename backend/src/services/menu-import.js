import fs from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import pdf from 'pdf-parse/lib/pdf-parse.js';
import XLSX from 'xlsx';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';

/**
 * Menü PDF'i için özel analiz (document-analyzer.js yerine inline)
 * @param {string} prompt - Analiz promptu
 * @returns {Promise<string>}
 */
async function analyzeMenuPrompt(prompt) {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });
  return response.content[0]?.text || '';
}

/**
 * Excel dosyasından menü verilerini parse et
 */
export async function parseExcelMenu(filePath) {
  const wb = XLSX.readFile(filePath);
  const results = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });

    // Tarihleri ve pozisyonlarını bul
    const tarihler = [];
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (!row) continue;

      for (let j = 0; j < row.length; j++) {
        const cell = row[j];
        if (!cell) continue;

        const tarih = parseTarih(String(cell));
        if (tarih) {
          tarihler.push({ row: i, col: j, tarih, tarihStr: cell });
        }
      }
    }

    // Her tarih için yemekleri topla
    for (const t of tarihler) {
      const yemekler = [];

      // Tarih hücresinin altındaki satırları oku
      for (let k = t.row + 1; k < Math.min(t.row + 15, data.length); k++) {
        const yemekRow = data[k];
        if (!yemekRow || !yemekRow[t.col]) continue;

        const yemekAdi = String(yemekRow[t.col]).trim();

        // Başka bir tarih mi?
        if (parseTarih(yemekAdi)) break;

        // Geçersiz satırları atla
        if (isValidYemek(yemekAdi)) {
          yemekler.push(yemekAdi);
        }
      }

      if (yemekler.length > 0) {
        results.push({
          tarih: t.tarih,
          tarihStr: t.tarihStr,
          yemekler,
          ogun: detectOgun(sheetName, yemekler),
        });
      }
    }
  }

  return results;
}

/**
 * PDF dosyasından menü verilerini AI ile analiz et
 */
export async function parsePdfMenu(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const pdfData = await pdf(dataBuffer);
  const text = pdfData.text;

  const prompt = `Bu bir yemek menüsü PDF'inden alınmış metin. 
Metinden tarihleri ve o tarihlere ait yemekleri çıkar.

METİN:
${text.substring(0, 8000)}

ÇIKTI FORMATI (JSON array olarak döndür):
[
  {
    "tarih": "2026-01-15",
    "ogun": "kahvalti|ogle|aksam",
    "yemekler": ["Mercimek Çorbası", "Tavuk Sote", "Pilav", "Salata"]
  }
]

ÖNEMLİ:
- Tarihleri YYYY-MM-DD formatında yaz
- Öğün tipini içerikten tahmin et (kahvaltı malzemeleri varsa kahvalti, vs)
- Sadece yemek isimlerini al, gramaj/kalori bilgilerini alma
- JSON formatında döndür, başka açıklama ekleme`;

  const response = await analyzeMenuPrompt(prompt);

  try {
    // JSON'ı parse et
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (_e) {}

  return [];
}

/**
 * Görsel dosyadan menü verilerini AI ile analiz et
 */
export async function parseImageMenu(filePath) {
  const imageBuffer = fs.readFileSync(filePath);
  const base64 = imageBuffer.toString('base64');
  const mimeType = filePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

  const prompt = `Bu bir yemek menüsü görseli. 
Görselden tarihleri ve o tarihlere ait yemekleri çıkar.

ÇIKTI FORMATI (JSON array olarak döndür):
[
  {
    "tarih": "2026-01-15",
    "ogun": "kahvalti|ogle|aksam",
    "yemekler": ["Mercimek Çorbası", "Tavuk Sote", "Pilav", "Salata"]
  }
]

ÖNEMLİ:
- Tarihleri YYYY-MM-DD formatında yaz
- Öğün tipini içerikten tahmin et
- Sadece yemek isimlerini al
- JSON formatında döndür`;

  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Image veya PDF için uygun content block oluştur
  const isImage = mimeType.startsWith('image/');
  const contentBlock = isImage
    ? {
        type: 'image',
        source: {
          type: 'base64',
          media_type: mimeType,
          data: base64,
        },
      }
    : {
        type: 'document',
        source: {
          type: 'base64',
          media_type: mimeType,
          data: base64,
        },
      };

  const result = await anthropic.messages.create({
    model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [contentBlock, { type: 'text', text: prompt }],
      },
    ],
  });

  const response = result.content[0]?.text || '';

  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (_e) {}

  return [];
}

/**
 * Tarih string'ini parse et
 */
function parseTarih(str) {
  if (!str) return null;

  // D/M/YY veya DD/MM/YY formatı (1/1/26, 15/1/26)
  let match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (match) {
    const ay = parseInt(match[1], 10);
    const gun = parseInt(match[2], 10);
    const yil = 2000 + parseInt(match[3], 10);
    if (ay >= 1 && ay <= 12 && gun >= 1 && gun <= 31) {
      return `${yil}-${String(ay).padStart(2, '0')}-${String(gun).padStart(2, '0')}`;
    }
  }

  // DD.MM.YYYY formatı
  match = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (match) {
    const gun = parseInt(match[1], 10);
    const ay = parseInt(match[2], 10);
    const yil = parseInt(match[3], 10);
    if (ay >= 1 && ay <= 12 && gun >= 1 && gun <= 31) {
      return `${yil}-${String(ay).padStart(2, '0')}-${String(gun).padStart(2, '0')}`;
    }
  }

  // DD-MM-YYYY formatı
  match = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (match) {
    const gun = parseInt(match[1], 10);
    const ay = parseInt(match[2], 10);
    const yil = parseInt(match[3], 10);
    if (ay >= 1 && ay <= 12 && gun >= 1 && gun <= 31) {
      return `${yil}-${String(ay).padStart(2, '0')}-${String(gun).padStart(2, '0')}`;
    }
  }

  // "15 Ocak 2026" gibi Türkçe format
  const aylar = {
    ocak: '01',
    şubat: '02',
    mart: '03',
    nisan: '04',
    mayıs: '05',
    haziran: '06',
    temmuz: '07',
    ağustos: '08',
    eylül: '09',
    ekim: '10',
    kasım: '11',
    aralık: '12',
  };

  for (const [ayAdi, ayNum] of Object.entries(aylar)) {
    const regex = new RegExp(`(\\d{1,2})\\s*${ayAdi}\\s*(\\d{4})`, 'i');
    match = str.toLowerCase().match(regex);
    if (match) {
      const gun = parseInt(match[1], 10);
      const yil = parseInt(match[2], 10);
      return `${yil}-${ayNum}-${String(gun).padStart(2, '0')}`;
    }
  }

  return null;
}

/**
 * Geçerli yemek ismi mi kontrol et
 */
function isValidYemek(str) {
  if (!str || str.length < 3) return false;

  const invalidPatterns = [
    /^\d+$/, // Sadece sayı
    /^\d+\s*(gr|g|ml|kg|lt|adet|porsiyon)/i, // Gramaj
    /kcal|kkal|kalori|enerji/i,
    /toplam|total/i,
    /^\*+/,
    /çeyrek|yarım|tam/i,
    /500\s*ml/i,
    /gramaj/i,
    /porsiyon/i,
    /^not:/i,
  ];

  for (const pattern of invalidPatterns) {
    if (pattern.test(str)) return false;
  }

  return true;
}

/**
 * Öğün tipini tahmin et
 */
function detectOgun(sheetName, yemekler) {
  const lowerSheet = sheetName.toLowerCase();
  const yemekStr = yemekler.join(' ').toLowerCase();

  // Sheet adından
  if (lowerSheet.includes('kahvaltı') || lowerSheet.includes('kahvalti')) return 'kahvalti';
  if (lowerSheet.includes('öğle') || lowerSheet.includes('ogle')) return 'ogle';
  if (lowerSheet.includes('akşam') || lowerSheet.includes('aksam')) return 'aksam';

  // Yemek içeriğinden
  const kahvaltiKeywords = [
    'peynir',
    'zeytin',
    'yumurta',
    'reçel',
    'bal',
    'tereyağ',
    'simit',
    'börek',
    'poğaça',
    'çay',
    'süt',
  ];
  const aksamKeywords = ['çorba', 'pilav', 'makarna', 'köfte', 'tavuk', 'et', 'balık', 'salata', 'tatlı'];

  let kahvaltiScore = 0;
  let aksamScore = 0;

  for (const kw of kahvaltiKeywords) {
    if (yemekStr.includes(kw)) kahvaltiScore++;
  }

  for (const kw of aksamKeywords) {
    if (yemekStr.includes(kw)) aksamScore++;
  }

  if (kahvaltiScore > aksamScore) return 'kahvalti';
  if (aksamScore > 0) return 'aksam';

  return 'aksam'; // Varsayılan
}
