/**
 * Import Service - AI Destekli İçe Aktarım Servisi
 * Her türlü dökümanı okur ve veritabanı şemasına map eder
 */

import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import xlsx from 'xlsx';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { query } from '../database.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Temp klasörü
const TEMP_DIR = path.join(__dirname, '../../temp/uploads');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Desteklenen dosya formatları
 */
const SUPPORTED_FORMATS = {
  '.pdf': 'PDF',
  '.xlsx': 'Excel',
  '.xls': 'Excel',
  '.csv': 'CSV',
  '.doc': 'Word',
  '.docx': 'Word',
  '.txt': 'Text',
  '.jpg': 'Image',
  '.jpeg': 'Image',
  '.png': 'Image'
};

/**
 * Hedef tablo şemaları
 */
const TABLE_SCHEMAS = {
  personel: {
    table: 'personeller',
    fields: {
      tam_ad: { type: 'string', required: true, description: 'Ad Soyad' },
      tc_kimlik: { type: 'string', description: 'TC Kimlik Numarası (11 haneli)' },
      email: { type: 'string', description: 'E-posta adresi' },
      telefon: { type: 'string', description: 'Telefon numarası' },
      departman: { type: 'string', description: 'Departman/Birim' },
      pozisyon: { type: 'string', description: 'Görev/Pozisyon' },
      maas: { type: 'number', description: 'Net Maaş (TL)' },
      ise_giris_tarihi: { type: 'date', description: 'İşe Giriş Tarihi (YYYY-MM-DD)' },
      dogum_tarihi: { type: 'date', description: 'Doğum Tarihi (YYYY-MM-DD)' },
      adres: { type: 'string', description: 'Adres' },
      medeni_durum: { type: 'string', description: 'Medeni Durum (Evli/Bekar)' },
      cocuk_sayisi: { type: 'number', description: 'Çocuk Sayısı' }
    }
  },
  stok: {
    table: 'stok_kartlari',
    fields: {
      ad: { type: 'string', required: true, description: 'Ürün Adı' },
      kod: { type: 'string', description: 'Stok Kodu' },
      kategori: { type: 'string', description: 'Kategori' },
      birim: { type: 'string', description: 'Birim (kg, adet, litre)' },
      miktar: { type: 'number', description: 'Mevcut Miktar' },
      birim_fiyat: { type: 'number', description: 'Birim Fiyat (TL)' },
      kritik_stok: { type: 'number', description: 'Kritik Stok Seviyesi' }
    }
  },
  cari: {
    table: 'cariler',
    fields: {
      unvan: { type: 'string', required: true, description: 'Ünvan/Firma Adı' },
      tip: { type: 'string', description: 'Tip (Müşteri/Tedarikçi)' },
      vergi_no: { type: 'string', description: 'Vergi Numarası' },
      vergi_dairesi: { type: 'string', description: 'Vergi Dairesi' },
      telefon: { type: 'string', description: 'Telefon' },
      email: { type: 'string', description: 'E-posta' },
      adres: { type: 'string', description: 'Adres' },
      yetkili_kisi: { type: 'string', description: 'Yetkili Kişi' }
    }
  },
  fatura: {
    table: 'invoices',
    fields: {
      invoice_number: { type: 'string', required: true, description: 'Fatura Numarası' },
      customer_name: { type: 'string', required: true, description: 'Müşteri/Tedarikçi Adı' },
      invoice_date: { type: 'date', description: 'Fatura Tarihi' },
      due_date: { type: 'date', description: 'Vade Tarihi' },
      total_amount: { type: 'number', description: 'Toplam Tutar (TL)' },
      vat_amount: { type: 'number', description: 'KDV Tutarı (TL)' },
      type: { type: 'string', description: 'Tip (SATIS/ALIS)' },
      status: { type: 'string', description: 'Durum (Bekliyor/Onaylandı)' }
    }
  }
};

/**
 * Dosyadan metin çıkar
 */
async function extractText(filePath, ext) {
  console.log(`📄 Metin çıkarılıyor: ${ext}`);
  
  switch (ext.toLowerCase()) {
    case '.pdf':
      return await extractPDF(filePath);
    case '.doc':
    case '.docx':
      return await extractWord(filePath);
    case '.xls':
    case '.xlsx':
      return await extractExcel(filePath);
    case '.csv':
      return await extractCSV(filePath);
    case '.txt':
      return await fs.promises.readFile(filePath, 'utf8');
    case '.jpg':
    case '.jpeg':
    case '.png':
      return await extractFromImage(filePath);
    default:
      throw new Error(`Desteklenmeyen dosya formatı: ${ext}`);
  }
}

/**
 * PDF'den metin çıkar
 */
async function extractPDF(filePath) {
  const dataBuffer = await fs.promises.readFile(filePath);
  const data = await pdfParse(dataBuffer);
  return data.text;
}

/**
 * Word'den metin çıkar
 */
async function extractWord(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

/**
 * Excel'den yapılandırılmış veri çıkar
 */
async function extractExcel(filePath) {
  const workbook = xlsx.readFile(filePath);
  const results = [];
  
  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const json = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    
    if (json.length > 0) {
      // İlk satır header
      const headers = json[0];
      const rows = json.slice(1);
      
      results.push({
        sheetName,
        headers,
        rows: rows.map(row => {
          const obj = {};
          headers.forEach((header, idx) => {
            if (header) obj[header] = row[idx];
          });
          return obj;
        })
      });
    }
  });
  
  return { type: 'structured', data: results };
}

/**
 * CSV'den yapılandırılmış veri çıkar
 */
async function extractCSV(filePath) {
  const content = await fs.promises.readFile(filePath, 'utf8');
  const lines = content.split('\n').filter(l => l.trim());
  
  if (lines.length === 0) return { type: 'structured', data: [] };
  
  // Delimiter tespit et
  const firstLine = lines[0];
  const delimiter = firstLine.includes(';') ? ';' : ',';
  
  const headers = firstLine.split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map(line => {
    const values = line.split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
    const obj = {};
    headers.forEach((header, idx) => {
      if (header) obj[header] = values[idx];
    });
    return obj;
  });
  
  return { type: 'structured', data: [{ sheetName: 'CSV', headers, rows }] };
}

/**
 * Görüntüden OCR ile metin çıkar (Gemini Vision)
 */
async function extractFromImage(filePath) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
  
  const imageData = await fs.promises.readFile(filePath);
  const base64Image = imageData.toString('base64');
  const mimeType = filePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
  
  const result = await model.generateContent([
    'Bu görseldeki tüm metni oku ve aynen yaz. Tablolar varsa düzgün formatta yaz.',
    {
      inlineData: {
        mimeType,
        data: base64Image
      }
    }
  ]);
  
  const response = await result.response;
  return response.text();
}

/**
 * AI ile veriyi analiz et ve şemaya map et
 */
async function analyzeAndMap(extractedData, targetType) {
  const schema = TABLE_SCHEMAS[targetType];
  if (!schema) {
    throw new Error(`Geçersiz hedef tip: ${targetType}`);
  }
  
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
  
  // Yapılandırılmış veri mi?
  const isStructured = typeof extractedData === 'object' && extractedData.type === 'structured';
  
  const schemaDescription = Object.entries(schema.fields)
    .map(([key, field]) => `- ${key}: ${field.description} (${field.type}${field.required ? ', zorunlu' : ''})`)
    .join('\n');
  
  let prompt;
  
  if (isStructured) {
    // Excel/CSV - zaten tablo formatında
    const firstSheet = extractedData.data[0];
    const sampleRows = firstSheet.rows.slice(0, 5);
    
    prompt = `
Sen bir veri dönüştürme uzmanısın. Aşağıdaki tablo verisini belirtilen şemaya dönüştür.

KAYNAK VERİ:
Sütunlar: ${firstSheet.headers.join(', ')}
Örnek Satırlar: ${JSON.stringify(sampleRows, null, 2)}

HEDEF ŞEMA (${targetType}):
${schemaDescription}

GÖREV:
1. Kaynak sütunları hedef alanlara eşle (mapping)
2. Veri tiplerini dönüştür (tarihler YYYY-MM-DD, sayılar virgülsüz)
3. Eksik zorunlu alanları belirt
4. Tüm satırları dönüştür

JSON formatında yanıt ver:
\`\`\`json
{
  "mapping": {
    "kaynak_sutun1": "hedef_alan1",
    "kaynak_sutun2": "hedef_alan2"
  },
  "records": [
    { "tam_ad": "...", "email": "...", ... },
    ...
  ],
  "warnings": ["Satır 3: email eksik", ...],
  "total": 10,
  "valid": 8
}
\`\`\`
`.trim();

  } else {
    // PDF/Word/Text - serbest metin
    const textPreview = typeof extractedData === 'string' 
      ? extractedData.substring(0, 3000) 
      : JSON.stringify(extractedData).substring(0, 3000);
    
    prompt = `
Sen bir veri çıkarma uzmanısın. Aşağıdaki metinden ${targetType} kayıtlarını çıkar.

METİN:
${textPreview}

HEDEF ŞEMA (${targetType}):
${schemaDescription}

GÖREV:
1. Metindeki tüm ${targetType} kayıtlarını bul
2. Her kaydı şemaya uygun JSON'a dönüştür
3. Tarihler YYYY-MM-DD, sayılar virgülsüz olsun

JSON formatında yanıt ver:
\`\`\`json
{
  "records": [
    { "tam_ad": "...", "email": "...", ... },
    ...
  ],
  "warnings": ["...", ...],
  "total": 5,
  "valid": 4
}
\`\`\`
`.trim();
  }
  
  console.log('🤖 AI analiz yapılıyor...');
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();
  
  // JSON çıkar
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[1]);
  }
  
  // JSON tag'i yoksa direkt parse
  try {
    return JSON.parse(text);
  } catch {
    return { records: [], warnings: ['AI yanıtı parse edilemedi'], total: 0, valid: 0 };
  }
}

/**
 * Ana içe aktarım fonksiyonu
 */
export async function processImport(filePath, originalFilename, targetType) {
  console.log(`📥 İçe aktarım başlıyor: ${originalFilename} -> ${targetType}`);
  
  const ext = path.extname(originalFilename).toLowerCase();
  
  // Format kontrolü
  if (!SUPPORTED_FORMATS[ext]) {
    throw new Error(`Desteklenmeyen dosya formatı: ${ext}. Desteklenen: ${Object.keys(SUPPORTED_FORMATS).join(', ')}`);
  }
  
  // Şema kontrolü
  if (!TABLE_SCHEMAS[targetType]) {
    throw new Error(`Geçersiz hedef tip: ${targetType}. Geçerli: ${Object.keys(TABLE_SCHEMAS).join(', ')}`);
  }
  
  // 1. Metin/veri çıkar
  const extractedData = await extractText(filePath, ext);
  console.log(`✅ Veri çıkarıldı`);
  
  // 2. AI ile analiz ve mapping
  const analysisResult = await analyzeAndMap(extractedData, targetType);
  console.log(`✅ AI analizi tamamlandı: ${analysisResult.total} kayıt bulundu`);
  
  return {
    success: true,
    filename: originalFilename,
    format: SUPPORTED_FORMATS[ext],
    targetType,
    targetTable: TABLE_SCHEMAS[targetType].table,
    preview: analysisResult.records.slice(0, 10),
    allRecords: analysisResult.records,
    mapping: analysisResult.mapping,
    warnings: analysisResult.warnings || [],
    stats: {
      total: analysisResult.total || analysisResult.records.length,
      valid: analysisResult.valid || analysisResult.records.length,
      invalid: (analysisResult.total || analysisResult.records.length) - (analysisResult.valid || analysisResult.records.length)
    }
  };
}

/**
 * Onaylanan verileri veritabanına kaydet
 */
export async function confirmImport(targetType, records) {
  const schema = TABLE_SCHEMAS[targetType];
  if (!schema) {
    throw new Error(`Geçersiz hedef tip: ${targetType}`);
  }
  
  const results = {
    inserted: 0,
    failed: 0,
    errors: []
  };
  
  for (const record of records) {
    try {
      // Alanları filtrele (sadece şemada olanlar)
      const validFields = {};
      Object.keys(schema.fields).forEach(field => {
        if (record[field] !== undefined && record[field] !== null && record[field] !== '') {
          validFields[field] = record[field];
        }
      });
      
      // SQL oluştur
      const columns = Object.keys(validFields);
      const values = Object.values(validFields);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      
      const sql = `INSERT INTO ${schema.table} (${columns.join(', ')}) VALUES (${placeholders})`;
      
      await query(sql, values);
      results.inserted++;
      
    } catch (error) {
      results.failed++;
      results.errors.push({
        record: record[Object.keys(schema.fields)[0]], // İlk alan (genellikle isim)
        error: error.message
      });
    }
  }
  
  console.log(`📥 İçe aktarım tamamlandı: ${results.inserted} başarılı, ${results.failed} hatalı`);
  
  return results;
}

/**
 * Şema bilgisini döndür
 */
export function getSchema(targetType) {
  return TABLE_SCHEMAS[targetType];
}

/**
 * Tüm şemaları döndür
 */
export function getAllSchemas() {
  return TABLE_SCHEMAS;
}

/**
 * Desteklenen formatları döndür
 */
export function getSupportedFormats() {
  return SUPPORTED_FORMATS;
}

export default {
  processImport,
  confirmImport,
  getSchema,
  getAllSchemas,
  getSupportedFormats
};

