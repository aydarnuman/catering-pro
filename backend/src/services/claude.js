import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fromPath } from 'pdf2pic';
import sharp from 'sharp';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { fileTypeFromFile } from 'file-type';
import { execSync } from 'child_process';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Desteklenen dosya formatları
export const SUPPORTED_FORMATS = {
  pdf: ['.pdf'],
  image: ['.png', '.jpg', '.jpeg', '.webp', '.gif'],
  document: ['.docx', '.doc'],
  spreadsheet: ['.xlsx', '.xls'],
  text: ['.txt', '.csv']
};

/**
 * Dosya türünü belirle
 */
export function getFileType(filename) {
  const ext = path.extname(filename).toLowerCase();
  
  if (SUPPORTED_FORMATS.pdf.includes(ext)) return 'pdf';
  if (SUPPORTED_FORMATS.image.includes(ext)) return 'image';
  if (SUPPORTED_FORMATS.document.includes(ext)) return 'document';
  if (SUPPORTED_FORMATS.spreadsheet.includes(ext)) return 'spreadsheet';
  if (SUPPORTED_FORMATS.text.includes(ext)) return 'text';
  
  return 'unknown';
}

/**
 * PDF sayfa sayısını al
 */
async function getPdfPageCount(pdfPath) {
  try {
    // pdf2pic ile sayfa sayısını test et
    const convert = fromPath(pdfPath, {
      density: 100,           
      saveFilename: "test",
      savePath: "/tmp",
      format: "png",
      width: 600,
      height: 800
    });
    
    // İlk sayfayı dene ve hata almazsan devam et
    let pageCount = 1;
    try {
      while (pageCount <= 50) { // Max 50 sayfa kontrol et
        await convert(pageCount);
        pageCount++;
      }
    } catch (error) {
      // Sayfa bulunamazsa dur
      pageCount--;
    }
    
    return Math.max(1, pageCount);
  } catch (error) {
    console.error('PDF sayfa sayısı alınamadı:', error);
    return 1; // Default 1 sayfa
  }
}

/**
 * PDF'i sayfa sayfa görsele çevir (OPTİMİZE - HIZLI)
 */
async function pdfToImages(pdfPath) {
  const options = {
    density: 150,           // Düşürüldü: 300 → 150 (2x hızlı)
    saveFilename: "page",
    savePath: path.dirname(pdfPath),
    format: "png",
    width: 1200,            // Düşürüldü: 2000 → 1200
    height: 1600            // Düşürüldü: 2800 → 1600
  };
  
  const convert = fromPath(pdfPath, options);
  const pageCount = await getPdfPageCount(pdfPath);
  
  console.log(`📄 PDF sayfa sayısı: ${pageCount}`);
  
  const images = [];
  
  // Paralel sayfa dönüşümü (3 sayfa aynı anda)
  const PARALLEL_PAGES = 3;
  
  for (let i = 1; i <= pageCount; i += PARALLEL_PAGES) {
    const pagePromises = [];
    
    for (let j = i; j < i + PARALLEL_PAGES && j <= pageCount; j++) {
      pagePromises.push(
        (async (pageNum) => {
          try {
            const result = await convert(pageNum);
            
            // Sharp ile optimize et (daha agresif sıkıştırma)
            const optimizedPath = result.path.replace('.png', '_optimized.png');
            await sharp(result.path)
              .resize(1000, 1400, { fit: 'inside', withoutEnlargement: true })
              .jpeg({ quality: 75 })  // PNG yerine JPEG (daha küçük)
              .toFile(optimizedPath.replace('.png', '.jpg'));
            
            // Orijinali sil
            try { fs.unlinkSync(result.path); } catch(e) {}
            
            const finalPath = optimizedPath.replace('.png', '.jpg');
            console.log(`✅ Sayfa ${pageNum} görsel: ${finalPath}`);
            return { pageNum, path: finalPath };
          } catch (error) {
            console.error(`❌ Sayfa ${pageNum} dönüştürme hatası:`, error);
            return null;
          }
        })(j)
      );
    }
    
    const results = await Promise.all(pagePromises);
    
    // Sıraya göre ekle
    for (const result of results) {
      if (result) images.push(result.path);
    }
  }
  
  return images;
}

/**
 * Tek bir görseli Claude ile analiz et
 */
async function analyzeImage(imagePath, pageNumber) {
  try {
    const imageData = fs.readFileSync(imagePath);
    const base64Image = imageData.toString('base64');
    const ext = path.extname(imagePath).toLowerCase();
    const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 
                     ext === '.webp' ? 'image/webp' : 
                     ext === '.gif' ? 'image/gif' : 'image/png';

    console.log(`🔍 Claude ile sayfa ${pageNumber} analiz ediliyor...`);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: base64Image
              }
            },
            {
              type: 'text',
              text: `Bu ihale şartnamesi sayfasını analiz et. 
            
Sayfadaki TÜM metni oku ve şu bilgileri çıkar:
- İhale başlığı
- Kurum/Kuruluş adı
- İhale tarihi ve saati
- Tahmini bedel
- İş süresi
- Teknik şartlar
- Birim fiyatlar (tablo varsa)
- İletişim bilgileri
- Önemli şartlar ve notlar

JSON formatında yanıt ver:
{
  "sayfa_metni": "Sayfadaki tüm metin...",
  "tespit_edilen_bilgiler": {
    "ihale_basligi": "",
    "kurum": "",
    "tarih": "",
    "bedel": "",
    "sure": "",
    "teknik_sartlar": [],
    "birim_fiyatlar": [],
    "iletisim": {},
    "notlar": []
  }
}`
            }
          ]
        }
      ]
    });

    const responseText = response.content[0].text;
    
    // JSON parse et
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('JSON formatında yanıt bulunamadı');
      }
    } catch (parseError) {
      console.error('JSON parse hatası:', parseError);
      // Fallback: Ham metin döndür
      return {
        sayfa_metni: responseText,
        tespit_edilen_bilgiler: {
          ihale_basligi: "",
          kurum: "",
          tarih: "",
          bedel: "",
          sure: "",
          teknik_sartlar: [],
          birim_fiyatlar: [],
          iletisim: {},
          notlar: []
        }
      };
    }

  } catch (error) {
    console.error(`❌ Sayfa ${pageNumber} analiz hatası:`, error);
    throw error;
  }
}

/**
 * Tüm PDF'i analiz et (ana fonksiyon) - PARALEL VE HIZLI
 */
export async function analyzePdfWithClaude(pdfPath, onProgress) {
  try {
    const startTime = Date.now();
    console.log(`🚀 Claude PDF analizi başlıyor: ${pdfPath}`);
    
    // 1. PDF → Görseller (paralel)
    if (onProgress) onProgress({ stage: 'converting', message: 'PDF görsellere çevriliyor...' });
    const images = await pdfToImages(pdfPath);
    
    if (images.length === 0) {
      throw new Error('PDF sayfalara dönüştürülemedi');
    }
    
    // 2. Her sayfayı PARALEL analiz et (2 sayfa aynı anda)
    const PARALLEL_ANALYSIS = 2; // Claude rate limit'e dikkat
    const sayfaSonuclari = new Array(images.length);
    let completedPages = 0;
    
    for (let i = 0; i < images.length; i += PARALLEL_ANALYSIS) {
      const batch = images.slice(i, i + PARALLEL_ANALYSIS);
      const batchIndices = batch.map((_, idx) => i + idx);
      
      if (onProgress) {
        onProgress({ 
          stage: 'analyzing', 
          message: `Sayfa ${i + 1}-${Math.min(i + PARALLEL_ANALYSIS, images.length)}/${images.length} analiz ediliyor...`,
          progress: Math.round((completedPages / images.length) * 100)
        });
      }
      
      // Paralel analiz
      const batchPromises = batch.map((imgPath, idx) => 
        analyzeImage(imgPath, batchIndices[idx] + 1)
          .then(result => {
            completedPages++;
            return result;
          })
          .catch(err => {
            console.error(`Sayfa ${batchIndices[idx] + 1} hata:`, err);
            return null;
          })
      );
      
      const batchResults = await Promise.all(batchPromises);
      
      // Sonuçları kaydet
      batchResults.forEach((result, idx) => {
        sayfaSonuclari[batchIndices[idx]] = result;
      });
      
      // Temp görselleri sil
      for (const imgPath of batch) {
        try { fs.unlinkSync(imgPath); } catch (e) {}
      }
    }
    
    // Null sonuçları filtrele
    const validResults = sayfaSonuclari.filter(r => r !== null);
    
    // 3. Sonuçları birleştir
    if (onProgress) onProgress({ stage: 'merging', message: 'Sonuçlar birleştiriliyor...' });
    const birlesikSonuc = mergeSayfalar(validResults);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Claude analizi tamamlandı: ${images.length} sayfa, ${duration}s`);
    
    return {
      success: true,
      toplam_sayfa: images.length,
      analiz: birlesikSonuc,
      ham_sayfalar: validResults,
      sure_saniye: parseFloat(duration)
    };
    
  } catch (error) {
    console.error('❌ Claude PDF analiz hatası:', error);
    throw error;
  }
}

/**
 * Sayfa sonuçlarını birleştir
 */
function mergeSayfalar(sayfalar) {
  const birlesik = {
    tam_metin: '',
    ihale_basligi: '',
    kurum: '',
    tarih: '',
    bedel: '',
    sure: '',
    teknik_sartlar: [],
    birim_fiyatlar: [],
    iletisim: {},
    notlar: []
  };
  
  for (const sayfa of sayfalar) {
    // Metni birleştir
    birlesik.tam_metin += sayfa.sayfa_metni + '\n\n';
    
    // Bilgileri birleştir (boş olmayanları al)
    const bilgi = sayfa.tespit_edilen_bilgiler || {};
    
    if (bilgi.ihale_basligi && !birlesik.ihale_basligi) {
      birlesik.ihale_basligi = bilgi.ihale_basligi;
    }
    if (bilgi.kurum && !birlesik.kurum) {
      birlesik.kurum = bilgi.kurum;
    }
    if (bilgi.tarih && !birlesik.tarih) {
      birlesik.tarih = bilgi.tarih;
    }
    if (bilgi.bedel && !birlesik.bedel) {
      birlesik.bedel = bilgi.bedel;
    }
    if (bilgi.sure && !birlesik.sure) {
      birlesik.sure = bilgi.sure;
    }
    if (bilgi.teknik_sartlar?.length) {
      birlesik.teknik_sartlar.push(...bilgi.teknik_sartlar);
    }
    if (bilgi.birim_fiyatlar?.length) {
      birlesik.birim_fiyatlar.push(...bilgi.birim_fiyatlar);
    }
    if (bilgi.iletisim && Object.keys(bilgi.iletisim).length) {
      birlesik.iletisim = { ...birlesik.iletisim, ...bilgi.iletisim };
    }
    if (bilgi.notlar?.length) {
      birlesik.notlar.push(...bilgi.notlar);
    }
  }
  
  // Duplicateleri temizle
  birlesik.teknik_sartlar = [...new Set(birlesik.teknik_sartlar)];
  birlesik.notlar = [...new Set(birlesik.notlar)];
  
  return birlesik;
}

/**
 * Şehir normalizasyonu (Claude ile)
 */
export async function normalizeCity(cityInput) {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: `Bu metinden Türkiye şehir adını çıkar. Sadece şehir adını yaz, başka bir şey yazma.
        
Metin: "${cityInput}"

Örnek çıktılar: İstanbul, Ankara, İzmir, Bursa`
        }
      ]
    });

    return response.content[0].text.trim();
  } catch (error) {
    console.error('Şehir normalizasyon hatası:', error);
    return cityInput; // Fallback: orijinal değeri döndür
  }
}

/**
 * Doğrudan görsel dosyasını analiz et (PNG, JPG, WEBP)
 */
export async function analyzeImageFile(imagePath, onProgress) {
  try {
    console.log(`🖼️ Görsel analizi başlıyor: ${imagePath}`);
    
    if (onProgress) onProgress({ stage: 'analyzing', message: 'Görsel analiz ediliyor...' });
    
    // Görseli optimize et
    const ext = path.extname(imagePath).toLowerCase();
    const optimizedPath = imagePath.replace(ext, '_optimized.png');
    
    await sharp(imagePath)
      .resize(1600, 2200, { fit: 'inside', withoutEnlargement: true })
      .png({ quality: 90 })
      .toFile(optimizedPath);
    
    const sonuc = await analyzeImage(optimizedPath, 1);
    
    // Temp dosyayı sil
    try { fs.unlinkSync(optimizedPath); } catch (e) {}
    
    console.log(`✅ Görsel analizi tamamlandı`);
    
    return {
      success: true,
      toplam_sayfa: 1,
      analiz: {
        tam_metin: sonuc.sayfa_metni || '',
        ...sonuc.tespit_edilen_bilgiler
      },
      ham_sayfalar: [sonuc]
    };
  } catch (error) {
    console.error('❌ Görsel analiz hatası:', error);
    throw error;
  }
}

/**
 * Word dosyasını analiz et (hem .doc hem .docx destekler)
 * Öncelik: LibreOffice > mammoth > antiword > textutil
 */
export async function analyzeDocxFile(docPath, onProgress) {
  try {
    console.log(`📄 Word analizi başlıyor: ${docPath}`);
    
    if (onProgress) onProgress({ stage: 'extracting', message: 'Word belgesi okunuyor...' });
    
    const ext = path.extname(docPath).toLowerCase();
    let text = '';
    
    // LibreOffice ile dönüştürme (en iyi sonuç)
    const tryLibreOffice = () => {
      const tmpDir = path.dirname(docPath);
      const baseName = path.basename(docPath, ext);
      const tmpTxt = path.join(tmpDir, `${baseName}.txt`);
      
      try {
        // LibreOffice ile txt'ye dönüştür
        execSync(`soffice --headless --convert-to txt:Text --outdir "${tmpDir}" "${docPath}"`, { 
          encoding: 'utf-8', 
          timeout: 60000,
          stdio: 'pipe'
        });
        
        if (fs.existsSync(tmpTxt)) {
          const content = fs.readFileSync(tmpTxt, 'utf-8');
          fs.unlinkSync(tmpTxt);
          console.log(`✅ LibreOffice ile dönüştürüldü`);
          return content;
        }
      } catch (e) {
        console.warn('⚠️ LibreOffice başarısız:', e.message);
      }
      return null;
    };
    
    if (ext === '.docx') {
      // DOCX için önce LibreOffice dene, başarısızsa mammoth
      text = tryLibreOffice();
      if (!text) {
        const result = await mammoth.extractRawText({ path: docPath });
        text = result.value;
        console.log(`✅ mammoth ile dönüştürüldü`);
      }
    } else if (ext === '.doc') {
      // Eski DOC formatı için LibreOffice öncelikli
      text = tryLibreOffice();
      
      if (!text) {
        // Fallback: antiword
        try {
          text = execSync(`antiword "${docPath}"`, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
          console.log(`✅ antiword ile dönüştürüldü`);
        } catch (antiwordError) {
          console.warn('⚠️ antiword başarısız, textutil deneniyor...');
          // Son çare: textutil (macOS yerleşik)
          try {
            const tmpTxt = docPath.replace('.doc', '_tmp.txt');
            execSync(`textutil -convert txt -output "${tmpTxt}" "${docPath}"`, { encoding: 'utf-8' });
            text = fs.readFileSync(tmpTxt, 'utf-8');
            fs.unlinkSync(tmpTxt);
            console.log(`✅ textutil ile dönüştürüldü`);
          } catch (textutilError) {
            throw new Error('DOC dosyası okunamadı. LibreOffice, antiword veya textutil gerekli.');
          }
        }
      }
    } else {
      throw new Error(`Desteklenmeyen Word formatı: ${ext}`);
    }
    
    if (!text || text.trim().length === 0) {
      throw new Error('Word dosyasından metin çıkarılamadı');
    }
    
    console.log(`📝 Word metin çıkarıldı: ${text.length} karakter`);
    
    if (onProgress) onProgress({ stage: 'analyzing', message: 'İçerik analiz ediliyor...' });
    
    // Claude ile analiz et
    const sonuc = await analyzeTextWithClaude(text);
    
    console.log(`✅ Word analizi tamamlandı`);
    
    return {
      success: true,
      toplam_sayfa: 1,
      analiz: sonuc,
      ham_metin: text
    };
  } catch (error) {
    console.error('❌ Word analiz hatası:', error);
    throw error;
  }
}

/**
 * Excel dosyasını analiz et
 */
export async function analyzeExcelFile(excelPath, onProgress) {
  try {
    console.log(`📊 Excel analizi başlıyor: ${excelPath}`);
    
    if (onProgress) onProgress({ stage: 'extracting', message: 'Excel dosyası okunuyor...' });
    
    // Excel'i oku
    const workbook = XLSX.readFile(excelPath);
    const sheets = [];
    let fullText = '';
    
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      const csvData = XLSX.utils.sheet_to_csv(sheet);
      
      sheets.push({
        name: sheetName,
        data: jsonData,
        csv: csvData
      });
      
      fullText += `\n--- Sayfa: ${sheetName} ---\n${csvData}\n`;
    }
    
    if (onProgress) onProgress({ stage: 'analyzing', message: 'Tablo verileri analiz ediliyor...' });
    
    // Claude ile analiz et
    const sonuc = await analyzeTableWithClaude(fullText, sheets);
    
    console.log(`✅ Excel analizi tamamlandı: ${sheets.length} sayfa`);
    
    return {
      success: true,
      toplam_sayfa: sheets.length,
      analiz: sonuc,
      sheets: sheets
    };
  } catch (error) {
    console.error('❌ Excel analiz hatası:', error);
    throw error;
  }
}

/**
 * TXT/CSV dosyasını analiz et
 */
export async function analyzeTextFile(textPath, onProgress) {
  try {
    console.log(`📝 Metin analizi başlıyor: ${textPath}`);
    
    if (onProgress) onProgress({ stage: 'reading', message: 'Dosya okunuyor...' });
    
    const text = fs.readFileSync(textPath, 'utf-8');
    
    if (!text || text.trim().length === 0) {
      throw new Error('Dosya boş');
    }
    
    if (onProgress) onProgress({ stage: 'analyzing', message: 'İçerik analiz ediliyor...' });
    
    const sonuc = await analyzeTextWithClaude(text);
    
    console.log(`✅ Metin analizi tamamlandı`);
    
    return {
      success: true,
      toplam_sayfa: 1,
      analiz: sonuc,
      ham_metin: text
    };
  } catch (error) {
    console.error('❌ Metin analiz hatası:', error);
    throw error;
  }
}

/**
 * Text içeriğini Claude ile analiz et
 */
async function analyzeTextWithClaude(text) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `Bu ihale dökümanını analiz et ve bilgileri çıkar:

${text.substring(0, 15000)}

JSON formatında yanıt ver:
{
  "tam_metin": "Özet...",
  "ihale_basligi": "",
  "kurum": "",
  "tarih": "",
  "bedel": "",
  "sure": "",
  "teknik_sartlar": [],
  "birim_fiyatlar": [],
  "iletisim": {},
  "notlar": []
}`
      }
    ]
  });

  const responseText = response.content[0].text;
  
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {}
  
  return {
    tam_metin: text.substring(0, 5000),
    ihale_basligi: '',
    kurum: '',
    tarih: '',
    bedel: '',
    sure: '',
    teknik_sartlar: [],
    birim_fiyatlar: [],
    iletisim: {},
    notlar: []
  };
}

/**
 * Tablo verilerini Claude ile analiz et
 */
async function analyzeTableWithClaude(csvText, sheets) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `Bu Excel/tablo verilerini analiz et:

${csvText.substring(0, 15000)}

Özellikle şunları bul:
- Birim fiyatlar
- Miktarlar
- Toplam tutarlar
- Ürün/hizmet listesi

JSON formatında yanıt ver:
{
  "tam_metin": "Tablo özeti...",
  "ihale_basligi": "",
  "kurum": "",
  "tarih": "",
  "bedel": "",
  "sure": "",
  "teknik_sartlar": [],
  "birim_fiyatlar": [{"kalem": "", "birim": "", "miktar": "", "fiyat": ""}],
  "iletisim": {},
  "notlar": []
}`
      }
    ]
  });

  const responseText = response.content[0].text;
  
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {}
  
  return {
    tam_metin: csvText.substring(0, 5000),
    ihale_basligi: '',
    kurum: '',
    tarih: '',
    bedel: '',
    sure: '',
    teknik_sartlar: [],
    birim_fiyatlar: [],
    iletisim: {},
    notlar: []
  };
}

/**
 * ZIP dosyasını aç ve içindeki desteklenen dosyaları bul
 */
async function extractZipAndFindFiles(zipPath) {
  const extractDir = path.join(path.dirname(zipPath), `extracted_${Date.now()}`);
  
  // Desteklenen uzantılar
  const supportedExtensions = [
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', 
    '.txt', '.csv', '.png', '.jpg', '.jpeg', '.webp'
  ];
  
  try {
    // ZIP'i aç
    fs.mkdirSync(extractDir, { recursive: true });
    execSync(`unzip -o "${zipPath}" -d "${extractDir}"`, { stdio: 'pipe' });
    
    // Desteklenen dosyaları bul
    const findFiles = (dir) => {
      let files = [];
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          files = files.concat(findFiles(fullPath));
        } else {
          const ext = path.extname(item).toLowerCase();
          if (supportedExtensions.includes(ext)) {
            files.push({ path: fullPath, ext, name: item });
          }
        }
      }
      return files;
    };
    
    const files = findFiles(extractDir);
    console.log(`📦 ZIP açıldı, ${files.length} desteklenen dosya bulundu:`);
    files.forEach(f => console.log(`   - ${f.name} (${f.ext})`));
    
    return { extractDir, files };
  } catch (error) {
    console.error('ZIP açma hatası:', error);
    // Temizle
    try { fs.rmSync(extractDir, { recursive: true, force: true }); } catch(e) {}
    return { extractDir: null, files: [] };
  }
}

/**
 * Gerçek dosya türünü tespit et (içeriğe göre)
 */
async function detectRealFileType(filePath) {
  try {
    const type = await fileTypeFromFile(filePath);
    if (type) {
      console.log(`🔍 Gerçek dosya türü: ${type.mime} (${type.ext})`);
      return type;
    }
    // Fallback: uzantıya bak
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Herhangi bir dosyayı analiz et (ana fonksiyon) - GELİŞMİŞ TÜR TESPİTİ
 */
export async function analyzeFile(filePath, onProgress) {
  // Gerçek dosya türünü tespit et
  const realType = await detectRealFileType(filePath);
  const extensionType = getFileType(filePath);
  
  // ZIP dosyası kontrolü
  if (realType?.ext === 'zip' || realType?.mime === 'application/zip') {
    console.log(`📦 ZIP dosyası tespit edildi, açılıyor...`);
    if (onProgress) onProgress({ stage: 'extracting', message: 'ZIP dosyası açılıyor...' });
    
    const { extractDir, files } = await extractZipAndFindFiles(filePath);
    
    if (files.length === 0) {
      if (extractDir) {
        try { fs.rmSync(extractDir, { recursive: true, force: true }); } catch(e) {}
      }
      throw new Error('ZIP içinde desteklenen dosya bulunamadı');
    }
    
    // Tüm dosyaları analiz et ve birleştir
    const allResults = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (onProgress) {
        onProgress({ 
          stage: 'analyzing', 
          message: `ZIP içi: ${i+1}/${files.length} - ${file.name}`,
          progress: Math.round((i / files.length) * 100)
        });
      }
      
      try {
        let result = null;
        
        // Dosya türüne göre analiz
        if (file.ext === '.pdf') {
          result = await analyzePdfWithClaude(file.path, null);
        } else if (['.doc', '.docx'].includes(file.ext)) {
          result = await analyzeDocxFile(file.path, null);
        } else if (['.xls', '.xlsx'].includes(file.ext)) {
          result = await analyzeExcelFile(file.path, null);
        } else if (['.txt', '.csv'].includes(file.ext)) {
          result = await analyzeTextFile(file.path, null);
        } else if (['.png', '.jpg', '.jpeg', '.webp'].includes(file.ext)) {
          result = await analyzeImageFile(file.path, null);
        }
        
        if (result?.analiz) {
          allResults.push(result.analiz);
          console.log(`✅ ZIP içi dosya analiz edildi: ${file.name}`);
        }
      } catch (e) {
        console.error(`❌ ZIP içi dosya hatası (${file.name}):`, e.message);
      }
    }
    
    // Temizle
    try { fs.rmSync(extractDir, { recursive: true, force: true }); } catch(e) {}
    
    if (allResults.length === 0) {
      throw new Error('ZIP içindeki dosyalar analiz edilemedi');
    }
    
    // Sonuçları birleştir
    const combined = {
      tam_metin: allResults.map(r => r.tam_metin || '').join('\n\n---\n\n'),
      ihale_basligi: allResults.find(r => r.ihale_basligi)?.ihale_basligi || '',
      kurum: allResults.find(r => r.kurum)?.kurum || '',
      tarih: allResults.find(r => r.tarih)?.tarih || '',
      bedel: allResults.find(r => r.bedel)?.bedel || '',
      sure: allResults.find(r => r.sure)?.sure || '',
      teknik_sartlar: [...new Set(allResults.flatMap(r => r.teknik_sartlar || []))],
      birim_fiyatlar: allResults.flatMap(r => r.birim_fiyatlar || []),
      iletisim: Object.assign({}, ...allResults.map(r => r.iletisim || {})),
      notlar: [...new Set(allResults.flatMap(r => r.notlar || []))]
    };
    
    return {
      success: true,
      toplam_sayfa: files.length,
      analiz: combined,
      kaynak: 'zip',
      dosya_sayisi: files.length,
      dosyalar: files.map(f => f.name)
    };
  }
  
  // Normal dosya türü işleme
  let fileType = extensionType;
  
  // Eğer uzantı PDF ama gerçek tür farklıysa uyar
  if (extensionType === 'pdf' && realType && realType.ext !== 'pdf') {
    console.warn(`⚠️ Dosya uzantısı .pdf ama gerçek tür: ${realType.ext}`);
    // Gerçek türe göre işle
    if (realType.ext === 'docx') fileType = 'document';
    else if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(realType.ext)) fileType = 'image';
    else if (['xlsx', 'xls'].includes(realType.ext)) fileType = 'spreadsheet';
  }
  
  console.log(`📁 Dosya tipi: ${fileType} - ${filePath}`);
  
  switch (fileType) {
    case 'pdf':
      return analyzePdfWithClaude(filePath, onProgress);
    case 'image':
      return analyzeImageFile(filePath, onProgress);
    case 'document':
      return analyzeDocxFile(filePath, onProgress);
    case 'spreadsheet':
      return analyzeExcelFile(filePath, onProgress);
    case 'text':
      return analyzeTextFile(filePath, onProgress);
    default:
      throw new Error(`Desteklenmeyen dosya formatı: ${path.extname(filePath)}`);
  }
}

export default {
  analyzePdfWithClaude,
  analyzeImageFile,
  analyzeDocxFile,
  analyzeExcelFile,
  analyzeTextFile,
  analyzeFile,
  analyzeImage,
  normalizeCity,
  getFileType,
  SUPPORTED_FORMATS
};
