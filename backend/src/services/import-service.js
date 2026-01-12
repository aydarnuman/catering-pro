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
      maas: { type: 'number', description: 'Brüt Maaş (TL)' },
      ise_giris_tarihi: { type: 'date', description: 'İşe Giriş Tarihi (YYYY-MM-DD)' },
      dogum_tarihi: { type: 'date', description: 'Doğum Tarihi (YYYY-MM-DD)' },
      adres: { type: 'string', description: 'Adres' },
      medeni_durum: { type: 'string', description: 'Medeni Durum (Evli/Bekar)' },
      cocuk_sayisi: { type: 'number', description: 'Çocuk Sayısı' },
      sgk_no: { type: 'string', description: 'SGK/Sigorta Numarası' }
    }
  },
  bordro: {
    table: 'bordro_kayitlari',
    description: 'Aylık bordro/maaş kayıtları - her personel için aylık maaş hesabı',
    fields: {
      personel_id: { type: 'number', description: 'Personel ID (sistemdeki personel ile eşleştirilecek)' },
      personel_adi: { type: 'string', required: true, description: 'Personel Ad Soyad (eşleştirme için)' },
      tc_kimlik: { type: 'string', description: 'TC Kimlik No (eşleştirme için)' },
      sgk_no: { type: 'string', description: 'SGK/Sigorta Numarası' },
      yil: { type: 'number', required: true, description: 'Yıl (2024, 2025, ...)' },
      ay: { type: 'number', required: true, description: 'Ay (1-12)' },
      calisma_gunu: { type: 'number', description: 'Çalışılan gün sayısı' },
      fazla_mesai_saat: { type: 'number', description: 'Fazla mesai saati' },
      brut_maas: { type: 'number', required: true, description: 'Brüt Maaş/Ücret (TL)' },
      fazla_mesai_ucret: { type: 'number', description: 'Fazla mesai ücreti (TL)' },
      ikramiye: { type: 'number', description: 'İkramiye (TL)' },
      prim: { type: 'number', description: 'Prim (TL)' },
      yemek_yardimi: { type: 'number', description: 'Yemek yardımı (TL)' },
      yol_yardimi: { type: 'number', description: 'Yol yardımı (TL)' },
      brut_toplam: { type: 'number', description: 'Brüt Toplam (TL)' },
      sgk_matrahi: { type: 'number', description: 'SGK Matrahı (TL)' },
      sgk_isci: { type: 'number', description: 'SGK İşçi Payı kesintisi (TL)' },
      issizlik_isci: { type: 'number', description: 'İşsizlik Sigortası İşçi Payı (TL)' },
      vergi_matrahi: { type: 'number', description: 'Gelir Vergisi Matrahı (TL)' },
      gelir_vergisi: { type: 'number', description: 'Gelir Vergisi kesintisi (TL)' },
      damga_vergisi: { type: 'number', description: 'Damga Vergisi kesintisi (TL)' },
      agi_tutari: { type: 'number', description: 'Asgari Geçim İndirimi (AGİ) (TL)' },
      net_maas: { type: 'number', required: true, description: 'Net Maaş/Ücret Ödenecek (TL)' },
      sgk_isveren: { type: 'number', description: 'SGK İşveren Payı (TL)' },
      issizlik_isveren: { type: 'number', description: 'İşsizlik Sigortası İşveren Payı (TL)' },
      toplam_maliyet: { type: 'number', description: 'Toplam İşveren Maliyeti (TL)' }
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
  },
  
  // MENÜ / REÇETE ANALİZİ
  menu: {
    table: 'receteler',
    description: 'Menü listesi, yemek programı veya reçete dökümanından yemek çıkarma',
    fields: {
      ad: { type: 'string', required: true, description: 'Yemek adı' },
      kategori: { type: 'string', required: true, description: 'Kategori (corba, ana_yemek, pilav_makarna, salata_meze, tatli, icecek, kahvaltilik)' },
      kalori: { type: 'number', description: 'Kalori (kcal/porsiyon)' },
      protein: { type: 'number', description: 'Protein (g/porsiyon)' },
      karbonhidrat: { type: 'number', description: 'Karbonhidrat (g/porsiyon)' },
      yag: { type: 'number', description: 'Yağ (g/porsiyon)' },
      porsiyon_gramaj: { type: 'number', description: 'Porsiyon gramajı (g)' },
      tarih: { type: 'date', description: 'Menü tarihi (varsa)' },
      ogun: { type: 'string', description: 'Öğün tipi (kahvalti, ogle, aksam)' },
      malzemeler: { type: 'array', description: 'Malzeme listesi (varsa)' }
    }
  },
  
  // ŞARTNAME GRAMAJ ANALİZİ
  gramaj: {
    table: 'sartname_porsiyon_gramajlari',
    description: 'Şartname veya gramaj tablosundan porsiyon bilgisi çıkarma',
    fields: {
      yemek_turu: { type: 'string', required: true, description: 'Yemek türü/adı' },
      kategori: { type: 'string', description: 'Kategori (corba, ana_yemek, vb.)' },
      porsiyon_gramaj: { type: 'number', required: true, description: 'Porsiyon gramajı (g veya ml)' },
      birim: { type: 'string', description: 'Birim (g, ml, adet)' },
      min_gramaj: { type: 'number', description: 'Minimum gramaj (varsa)' },
      max_gramaj: { type: 'number', description: 'Maksimum gramaj (varsa)' },
      aciklama: { type: 'string', description: 'Açıklama/not' }
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
 * NOT: Karmaşık Excel dosyaları için (birleştirilmiş hücreler, çok satırlı header'lar)
 * ham veriyi AI'a gönderiyoruz - AI kendi analiz etsin
 */
async function extractExcel(filePath) {
  const workbook = xlsx.readFile(filePath);
  const results = [];
  
  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const json = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    
    if (json.length > 0) {
      // Karmaşık Excel kontrolü: birleştirilmiş hücreler, çok satırlı header'lar
      const firstRow = json[0] || [];
      const nullCount = firstRow.filter(h => h === null || h === undefined).length;
      const isComplex = nullCount > 3 || json.length < 5 || 
        (json[1] && json[1].some(cell => typeof cell === 'string' && cell.length > 0));
      
      if (isComplex) {
        // Karmaşık format: HAM VERİYİ AI'a gönder
        // TÜM satırları al (max 200 satır - büyük dosyalar için)
        const maxRows = Math.min(json.length, 200);
        const rawRows = json.slice(0, maxRows).map((row, rowIdx) => {
          return row.map((cell, colIdx) => ({
            row: rowIdx,
            col: colIdx,
            value: cell
          })).filter(c => c.value !== null && c.value !== undefined);
        }).filter(row => row.length > 0);
        
        results.push({
          sheetName,
          isComplex: true,
          rawData: rawRows,
          totalRows: json.length,
          // Ayrıca text formatında da gönder (AI için daha kolay)
          textFormat: json.slice(0, maxRows).map((row, i) => 
            `Satır ${i}: ${row.filter(c => c !== null && c !== undefined).join(' | ')}`
          ).join('\n')
        });
      } else {
        // Basit format: Normal işlem
      const headers = json[0];
      const rows = json.slice(1);
      
      results.push({
        sheetName,
          isComplex: false,
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
    const firstSheet = extractedData.data[0];
    
    // Karmaşık Excel formatı mı?
    if (firstSheet.isComplex) {
      // KARMAŞIK FORMAT: Bordro, birleştirilmiş hücreler, çok satırlı header'lar
      prompt = `
Sen bir UZMAN veri analisti ve döküman tanıma uzmanısın. Aşağıdaki KARMAŞIK Excel/tablo verisini analiz et.

Bu dosya muhtemelen:
- Bordro/maaş tablosu
- Birleştirilmiş hücreler içeren rapor
- Çok satırlı header'lar
- Her kayıt için birden fazla satır
olabilir.

HAM VERİ (satır satır):
${firstSheet.textFormat}

HEDEF ŞEMA (${targetType}):
${schemaDescription}

GÖREV:
1. Önce dökümanın YAPISINI anla:
   - Header'lar hangi satır(lar)da?
   - Her kayıt kaç satır kaplıyor?
   - Hangi sütunda hangi veri var?

2. Tüm kayıtları çıkar ve hedef şemaya dönüştür:
   - İsimleri tam_ad olarak al
   - TC/Sigorta numaralarını tc_kimlik olarak al
   - Maaş/ücret bilgilerini bul
   - Tarihleri YYYY-MM-DD formatına çevir
   - Sayıları virgülsüz yap

3. Eğer bazı alanlar bulunamıyorsa, null bırak ama kaydı yine de dahil et.

ÖNEMLİ: Bu bir ${targetType === 'personel' ? 'BORDRO/PERSONEL' : targetType.toUpperCase()} listesi. Her satırda/kayıtta bir kişi/öğe var.

JSON formatında yanıt ver:
\`\`\`json
{
  "detected_structure": {
    "header_rows": [0, 1],
    "data_start_row": 2,
    "rows_per_record": 2,
    "description": "Yapı açıklaması"
  },
  "mapping": {
    "Adı-Soyadı veya sütun3": "tam_ad",
    "T.C.Kimlik No veya sütun4": "tc_kimlik"
  },
  "records": [
    { "tam_ad": "ALİ KIRÇAYIR", "tc_kimlik": "10508424666", "maas": 26005.5, ... },
    ...
  ],
  "warnings": ["Uyarı mesajları..."],
  "total": 25,
  "valid": 25
}
\`\`\`
`.trim();

    } else {
      // BASİT FORMAT: Normal tablo
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
    }

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

/**
 * MENÜ DOKÜMAN ANALİZİ
 * PDF, Excel veya görsel menü listesinden yemekleri çıkarır
 */
export async function analyzeMenuDocument(filePath, originalFilename, options = {}) {
  console.log(`🍽️ Menü analizi başlıyor: ${originalFilename}`);
  
  const ext = path.extname(originalFilename).toLowerCase();
  
  // Format kontrolü
  if (!SUPPORTED_FORMATS[ext]) {
    throw new Error(`Desteklenmeyen dosya formatı: ${ext}`);
  }
  
  // 1. Metin/veri çıkar
  const extractedData = await extractText(filePath, ext);
  console.log(`✅ Veri çıkarıldı`);
  
  // 2. AI ile menü analizi
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
  
  const textContent = typeof extractedData === 'string' 
    ? extractedData 
    : (extractedData.type === 'structured' 
        ? extractedData.data.map(s => s.textFormat || JSON.stringify(s.rows)).join('\n')
        : JSON.stringify(extractedData));
  
  const prompt = `
Sen bir yemek menüsü ve reçete analiz uzmanısın. 
Aşağıdaki dökümanı analiz et ve içindeki TÜM yemekleri çıkar.

DÖKÜMAN İÇERİĞİ:
${textContent.substring(0, 8000)}

GÖREV:
1. Döküman tipini belirle (haftalık menü, aylık program, yemek listesi, reçete, şartname vb.)
2. Tüm yemekleri bul ve kategorize et
3. Varsa besin değerlerini, gramajları ve tarihleri çıkar

KATEGORİLER:
- corba: Çorbalar
- ana_yemek: Et, tavuk, balık, sebze yemekleri, köfte vb.
- pilav_makarna: Pilavlar, makarnalar, börekler
- salata_meze: Salatalar, mezeler, cacık, turşu vb.
- tatli: Tatlılar, komposto, meyve
- icecek: Ayran, çay, meyve suyu vb.
- kahvaltilik: Kahvaltı ürünleri

JSON formatında yanıt ver:
\`\`\`json
{
  "dokuman_tipi": "haftalik_menu | aylik_menu | recete_listesi | sartname | diger",
  "tarih_araligi": "varsa tarih bilgisi",
  "toplam_yemek": 15,
  "yemekler": [
    {
      "ad": "Mercimek Çorbası",
      "kategori": "corba",
      "kalori": 180,
      "protein": 12,
      "karbonhidrat": 28,
      "yag": 4,
      "porsiyon_gramaj": 200,
      "tarih": "2024-01-15",
      "ogun": "ogle",
      "malzemeler": ["mercimek", "soğan", "havuç"]
    }
  ],
  "notlar": "Ek bilgiler..."
}
\`\`\`

ÖNEMLİ:
- Tüm yemekleri bul, hiçbirini atlama
- Kategoriyi doğru belirle
- Besin değerleri yoksa tahmini değer ver
- Türkçe karakterleri koru
`.trim();

  console.log('🤖 AI menü analizi yapılıyor...');
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();
  
  // JSON çıkar
  let analysisResult;
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    analysisResult = JSON.parse(jsonMatch[1]);
  } else {
    try {
      analysisResult = JSON.parse(text);
    } catch {
      analysisResult = { yemekler: [], notlar: 'AI yanıtı parse edilemedi', raw: text };
    }
  }
  
  console.log(`✅ Menü analizi tamamlandı: ${analysisResult.yemekler?.length || 0} yemek bulundu`);
  
  return {
    success: true,
    filename: originalFilename,
    format: SUPPORTED_FORMATS[ext],
    dokuman_tipi: analysisResult.dokuman_tipi,
    tarih_araligi: analysisResult.tarih_araligi,
    yemekler: analysisResult.yemekler || [],
    stats: {
      toplam: analysisResult.yemekler?.length || 0,
      kategoriler: groupByCategory(analysisResult.yemekler || [])
    },
    notlar: analysisResult.notlar
  };
}

/**
 * Yemekleri kategoriye göre grupla
 */
function groupByCategory(yemekler) {
  const groups = {};
  yemekler.forEach(y => {
    const kat = y.kategori || 'diger';
    if (!groups[kat]) groups[kat] = 0;
    groups[kat]++;
  });
  return groups;
}

/**
 * Analiz edilen menüyü reçetelere kaydet
 */
export async function saveMenuAsRecipes(yemekler, options = {}) {
  const results = { inserted: 0, skipped: 0, errors: [] };
  
  // Kategori ID'lerini al
  const kategoriMap = {
    corba: 1, ana_yemek: 2, pilav_makarna: 3, salata_meze: 4,
    tatli: 5, icecek: 6, kahvaltilik: 7, kahvalti_paketi: 8
  };
  
  for (const yemek of yemekler) {
    try {
      const kategoriId = kategoriMap[yemek.kategori] || 2; // default: ana_yemek
      const kod = yemek.ad.substring(0,3).toUpperCase().replace(/[^A-ZĞÜŞİÖÇ]/gi,'X') + '-' + Date.now().toString().slice(-6);
      
      await query(`
        INSERT INTO receteler (kod, ad, kategori_id, porsiyon_miktar, kalori, protein, karbonhidrat, yag, ai_olusturuldu)
        VALUES ($1, $2, $3, 1, $4, $5, $6, $7, true)
        ON CONFLICT (kod) DO NOTHING
      `, [kod, yemek.ad, kategoriId, yemek.kalori, yemek.protein, yemek.karbonhidrat, yemek.yag]);
      
      results.inserted++;
    } catch (error) {
      results.errors.push({ yemek: yemek.ad, error: error.message });
    }
  }
  
  return results;
}

export default {
  processImport,
  confirmImport,
  getSchema,
  getAllSchemas,
  getSupportedFormats,
  analyzeMenuDocument,
  saveMenuAsRecipes
};

