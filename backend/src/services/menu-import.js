import XLSX from 'xlsx';
import pdf from 'pdf-parse/lib/pdf-parse.js';
import fs from 'fs';
import { analyzeDocument } from './document-analyzer.js';

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
          ogun: detectOgun(sheetName, yemekler)
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

  const response = await analyzeDocument(prompt);
  
  try {
    // JSON'ı parse et
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('PDF parse hatası:', e);
  }
  
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

  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  
  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        mimeType,
        data: base64
      }
    }
  ]);
  
  const response = result.response.text();
  
  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('Image parse hatası:', e);
  }
  
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
    const ay = parseInt(match[1]);
    const gun = parseInt(match[2]);
    const yil = 2000 + parseInt(match[3]);
    if (ay >= 1 && ay <= 12 && gun >= 1 && gun <= 31) {
      return `${yil}-${String(ay).padStart(2, '0')}-${String(gun).padStart(2, '0')}`;
    }
  }
  
  // DD.MM.YYYY formatı
  match = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (match) {
    const gun = parseInt(match[1]);
    const ay = parseInt(match[2]);
    const yil = parseInt(match[3]);
    if (ay >= 1 && ay <= 12 && gun >= 1 && gun <= 31) {
      return `${yil}-${String(ay).padStart(2, '0')}-${String(gun).padStart(2, '0')}`;
    }
  }
  
  // DD-MM-YYYY formatı
  match = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (match) {
    const gun = parseInt(match[1]);
    const ay = parseInt(match[2]);
    const yil = parseInt(match[3]);
    if (ay >= 1 && ay <= 12 && gun >= 1 && gun <= 31) {
      return `${yil}-${String(ay).padStart(2, '0')}-${String(gun).padStart(2, '0')}`;
    }
  }
  
  // "15 Ocak 2026" gibi Türkçe format
  const aylar = {
    'ocak': '01', 'şubat': '02', 'mart': '03', 'nisan': '04',
    'mayıs': '05', 'haziran': '06', 'temmuz': '07', 'ağustos': '08',
    'eylül': '09', 'ekim': '10', 'kasım': '11', 'aralık': '12'
  };
  
  for (const [ayAdi, ayNum] of Object.entries(aylar)) {
    const regex = new RegExp(`(\\d{1,2})\\s*${ayAdi}\\s*(\\d{4})`, 'i');
    match = str.toLowerCase().match(regex);
    if (match) {
      const gun = parseInt(match[1]);
      const yil = parseInt(match[2]);
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
    /^not:/i
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
  const kahvaltiKeywords = ['peynir', 'zeytin', 'yumurta', 'reçel', 'bal', 'tereyağ', 'simit', 'börek', 'poğaça', 'çay', 'süt'];
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

