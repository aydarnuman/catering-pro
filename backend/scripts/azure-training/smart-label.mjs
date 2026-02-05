/**
 * Claude ile Akıllı Etiketleme
 * Her PDF'i Claude'a gönderip kapsamlı label oluşturur
 */

import { BlobServiceClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } from '@azure/storage-blob';
import { DocumentAnalysisClient, AzureKeyCredential } from '@azure/ai-form-recognizer';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';

// Config
const AZURE_ENDPOINT = 'https://catering-doc-ai-123.cognitiveservices.azure.com/';
const AZURE_KEY = '5I9qhCxX15RUpdgFccCwjUIUaffI4sIeZbSBFoYet0uIkOf8bPRCJQQJ99CBAC5RqLJXJ3w3AAALACOGt8H3';
const STORAGE_ACCOUNT = 'cateringtr';
const STORAGE_KEY = 'c1iGE5YMj27VzJpZt4Kj9cRprzIB5j0h1VefqBXt312zcpUW+FC4Bpb/WvQdWfHevFoEoWZgxUmp+ASt+ipGOw==';
const CONTAINER_NAME = 'ihale-training';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

// Etiketlenecek alanlar - KİK Mevzuatına uygun
const FIELDS = {
  tables: [
    // Haftalık Menüler (1-4 hafta)
    { name: 'haftalik_menu_1', keywords: ['1. hafta', 'birinci hafta', '1.hafta', 'i. hafta'] },
    { name: 'haftalik_menu_2', keywords: ['2. hafta', 'ikinci hafta', '2.hafta', 'ii. hafta'] },
    { name: 'haftalik_menu_3', keywords: ['3. hafta', 'üçüncü hafta', '3.hafta', 'iii. hafta'] },
    { name: 'haftalik_menu_4', keywords: ['4. hafta', 'dördüncü hafta', '4.hafta', 'iv. hafta'] },
    // Genel menü tablosu (hafta belirtilmemişse)
    { name: 'menu_tablosu', keywords: ['menü', 'yemek listesi', 'örnek menü', 'günlük menü', 'kahvaltı', 'öğle', 'akşam'] },
    // Gramaj ve Reçete (çiğ girdi burada)
    { name: 'gramaj_tablosu', keywords: ['gramaj', 'porsiyon', 'miktar', 'gram', 'kg', 'lt', 'çiğ girdi', 'reçete', 'hammadde miktarı'] },
    // Personel
    { name: 'personel_tablosu', keywords: ['personel', 'çalışan', 'görevli', 'unvan', 'aşçı', 'garson', 'işçi listesi'] },
    // Malzeme
    { name: 'malzeme_listesi', keywords: ['malzeme', 'hammadde', 'gıda', 'ürün listesi', 'tedarik'] },
    // Fiyat
    { name: 'fiyat_tablosu', keywords: ['fiyat', 'birim fiyat', 'tutar', 'bedel', 'teklif', 'maliyet'] },
    { name: 'birim_fiyat_cetveli', keywords: ['birim fiyat cetveli', 'teklif cetveli', 'fiyat teklif'] },
    // Öğün dağılımı
    { name: 'ogun_dagilimi', keywords: ['öğün dağılım', 'sabah', 'ara öğün', 'ana öğün', 'öğün tablosu'] },
    // Ceza kesintileri
    { name: 'ceza_kesintileri', keywords: ['ceza', 'kesinti', 'yaptırım', 'puan kırma', 'cezai şart'] },
    // Ekipman
    { name: 'ekipman_listesi', keywords: ['ekipman', 'araç gereç', 'demirbaş', 'mutfak malzeme'] },
  ],
  strings: [
    // İhale bilgileri
    { name: 'ihale_konusu', pattern: /ihale(?:nin)?\s*konusu\s*[:\-]?\s*(.+)/i },
    { name: 'ihale_kayit_no', pattern: /(?:İKN|ihale kayıt no|kayıt numarası)\s*[:\-]?\s*(\d{4}\/\d+)/i },
    { name: 'idare_adi', pattern: /(?:idare(?:nin)?\s*adı|kurum(?:un)?\s*adı)\s*[:\-]?\s*(.+)/i },
    
    // Süre bilgileri
    { name: 'sure', pattern: /(?:sözleşme\s*süresi|hizmet\s*süresi|iş\s*süresi)\s*[:\-]?\s*(.+)/i },
    { name: 'hizmet_gun_sayisi', pattern: /(?:hizmet|çalışma|iş)\s*gün(?:ü)?\s*(?:sayısı)?\s*[:\-]?\s*(\d+)/i },
    
    // Kişi ve işçi sayıları (KRİTİK)
    { name: 'kisi_sayisi', pattern: /(?:kişi sayısı|öğrenci sayısı|yemek yiyecek|günlük kişi)\s*[:\-]?\s*(\d+)/i },
    { name: 'isci_sayisi', pattern: /(?:işçi sayısı|personel sayısı|çalışan sayısı|eleman sayısı)\s*[:\-]?\s*(\d+)/i },
    { name: 'ogun_sayisi', pattern: /(?:öğün sayısı|günlük öğün)\s*[:\-]?\s*(\d+)/i },
    
    // Maliyet bilgileri
    { name: 'toplam_tutar', pattern: /(?:toplam tutar|tahmini bedel)\s*[:\-]?\s*([\d\.,]+)/i },
    { name: 'yaklasik_maliyet', pattern: /yaklaşık maliyet\s*[:\-]?\s*([\d\.,]+)/i },
    { name: 'iscilik_orani', pattern: /işçilik oran[ıi]\s*[:\-]?\s*(%?\s*[\d\.,]+)/i },
    
    // Tarihler
    { name: 'ise_baslama_tarihi', pattern: /(?:işe başlama|başlangıç tarihi|başlama tarihi)\s*[:\-]?\s*(\d{1,2}[\.\/]\d{1,2}[\.\/]\d{2,4})/i },
    { name: 'is_bitis_tarihi', pattern: /(?:iş bitim|bitiş tarihi|sona erme)\s*[:\-]?\s*(\d{1,2}[\.\/]\d{1,2}[\.\/]\d{2,4})/i },
    { name: 'teklif_gecerlilik_suresi', pattern: /teklif(?:lerin)?\s*geçerlilik\s*süresi\s*[:\-]?\s*(.+)/i },
    
    // Lokasyon
    { name: 'teslim_yeri', pattern: /(?:teslim|dağıtım|hizmet)\s*yeri\s*[:\-]?\s*(.+)/i },
    { name: 'mutfak_tipi', pattern: /(?:mutfak\s*tipi|hazırlama\s*yeri|üretim yeri)\s*[:\-]?\s*(yerinde|dışarıda|merkezi|taşımalı)/i },
  ]
};

// Azure clients
const docClient = new DocumentAnalysisClient(AZURE_ENDPOINT, new AzureKeyCredential(AZURE_KEY));
const sharedKeyCredential = new StorageSharedKeyCredential(STORAGE_ACCOUNT, STORAGE_KEY);
const blobService = BlobServiceClient.fromConnectionString(
  `DefaultEndpointsProtocol=https;AccountName=${STORAGE_ACCOUNT};AccountKey=${STORAGE_KEY};EndpointSuffix=core.windows.net`
);
const containerClient = blobService.getContainerClient(CONTAINER_NAME);

// SAS URL oluştur
function getBlobSasUrl(blobName) {
  const sasToken = generateBlobSASQueryParameters(
    {
      containerName: CONTAINER_NAME,
      blobName: blobName,
      permissions: BlobSASPermissions.parse('r'),
      startsOn: new Date(),
      expiresOn: new Date(new Date().valueOf() + 60 * 60 * 1000), // 1 saat
    },
    sharedKeyCredential
  ).toString();
  
  return `https://${STORAGE_ACCOUNT}.blob.core.windows.net/${CONTAINER_NAME}/${encodeURIComponent(blobName)}?${sasToken}`;
}

// Claude client
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║     AKILLI ETİKETLEME - Claude + Azure Layout                        ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  // PDF'leri listele
  const pdfs = [];
  for await (const blob of containerClient.listBlobsFlat()) {
    if (blob.name.endsWith('.pdf')) {
      pdfs.push(blob.name);
    }
  }

  console.log(`📄 ${pdfs.length} PDF bulundu\n`);

  let processed = 0;
  let errors = 0;

  for (const pdfName of pdfs) {
    processed++;
    console.log(`\n[${'='.repeat(70)}]`);
    console.log(`[${processed}/${pdfs.length}] ${pdfName.substring(0, 60)}...`);

    try {
      // 1. Azure Layout ile analiz et (tablo koordinatları için)
      console.log('   📊 Azure Layout analizi...');
      const blobClient = containerClient.getBlobClient(pdfName);
      const blobSasUrl = getBlobSasUrl(pdfName);
      
      const poller = await docClient.beginAnalyzeDocumentFromUrl('prebuilt-layout', blobSasUrl);
      const layoutResult = await poller.pollUntilDone();

      // 2. PDF içeriğini indir (Claude için)
      console.log('   📥 PDF indiriliyor...');
      const downloadResponse = await blobClient.download();
      const chunks = [];
      for await (const chunk of downloadResponse.readableStreamBody) {
        chunks.push(chunk);
      }
      const pdfBuffer = Buffer.concat(chunks);
      const pdfBase64 = pdfBuffer.toString('base64');

      // 3. Claude ile analiz et
      console.log('   🤖 Claude analizi...');
      const claudeAnalysis = await analyzeWithClaude(pdfBase64, layoutResult);

      // 4. Label dosyası oluştur
      console.log('   🏷️  Label oluşturuluyor...');
      const labels = createLabels(layoutResult, claudeAnalysis);

      if (labels.length === 0) {
        console.log('   ⚠️  Etiketlenecek alan bulunamadı');
        continue;
      }

      // 5. Label dosyasını yükle
      const labelFileName = pdfName + '.labels.json';
      const labelData = {
        document: pdfName,
        labels: labels
      };

      const labelBlobClient = containerClient.getBlockBlobClient(labelFileName);
      await labelBlobClient.upload(
        JSON.stringify(labelData, null, 2),
        JSON.stringify(labelData, null, 2).length,
        { blobHTTPHeaders: { blobContentType: 'application/json' } }
      );

      console.log(`   ✅ ${labels.length} etiket kaydedildi`);
      
      // Etiket detayları
      const tableLabels = labels.filter(l => l.labelType === 'table');
      const stringLabels = labels.filter(l => l.labelType !== 'table');
      console.log(`      - Tablolar: ${tableLabels.map(l => l.label).join(', ') || 'yok'}`);
      console.log(`      - Alanlar: ${stringLabels.map(l => l.label).join(', ') || 'yok'}`);

    } catch (error) {
      errors++;
      console.log(`   ❌ Hata: ${error.message}`);
    }

    // Rate limiting için bekle
    await sleep(2000);
  }

  console.log(`\n${'='.repeat(72)}`);
  console.log(`✅ Tamamlandı: ${processed - errors}/${processed} başarılı`);
  if (errors > 0) console.log(`❌ Hatalar: ${errors}`);
}

async function analyzeWithClaude(pdfBase64, layoutResult) {
  // Sayfa metinlerini hazırla
  const pageTexts = {};
  
  if (layoutResult.pages) {
    for (const page of layoutResult.pages) {
      const pageNum = page.pageNumber;
      let text = '';
      
      if (page.lines) {
        text = page.lines.map(l => l.content).join('\n');
      }
      
      pageTexts[pageNum] = text;
    }
  }

  // Tablo bilgilerini hazırla
  const tableInfo = [];
  if (layoutResult.tables) {
    for (let i = 0; i < layoutResult.tables.length; i++) {
      const table = layoutResult.tables[i];
      const headerCells = table.cells?.filter(c => c.rowIndex === 0) || [];
      const headers = headerCells.map(c => c.content).join(' | ');
      const pageNum = table.boundingRegions?.[0]?.pageNumber || 1;
      
      tableInfo.push({
        index: i,
        page: pageNum,
        rowCount: table.rowCount,
        columnCount: table.columnCount,
        headers: headers.substring(0, 200)
      });
    }
  }

  const prompt = `Bu bir YEMEK HİZMETİ İHALESİ teknik şartnamesidir. KİK mevzuatına göre kritik alanları bul.

TABLOLAR (tablo indeksini ve sayfayı belirt):

1. HAFTALIK MENÜLER (KRİTİK - en az 2 hafta zorunlu):
- haftalik_menu_1: 1. hafta / Birinci hafta menüsü
- haftalik_menu_2: 2. hafta / İkinci hafta menüsü  
- haftalik_menu_3: 3. hafta / Üçüncü hafta menüsü (varsa)
- haftalik_menu_4: 4. hafta / Dördüncü hafta menüsü (varsa)
- menu_tablosu: Hafta belirtilmemiş genel menü tablosu

2. GRAMAJ VE REÇETECİĞ GİRDİ (KRİTİK):
- gramaj_tablosu: Gramaj/porsiyon/çiğ girdi miktarları tablosu

3. DİĞER TABLOLAR:
- personel_tablosu: Çalışacak personel/işçi listesi
- malzeme_listesi: Hammadde/malzeme listesi
- fiyat_tablosu: Fiyat/maliyet tablosu
- birim_fiyat_cetveli: Birim fiyat teklif cetveli
- ogun_dagilimi: Öğün dağılım tablosu
- ceza_kesintileri: Ceza/kesinti tablosu
- ekipman_listesi: Ekipman/araç gereç listesi

STRING ALANLAR (değeri ve sayfayı belirt):

1. İHALE BİLGİLERİ:
- ihale_konusu: İhalenin konusu
- ihale_kayit_no: İKN numarası (2024/123456 formatında)
- idare_adi: İhaleyi yapan kurum/idare

2. SÜRE BİLGİLERİ:
- sure: Sözleşme/hizmet süresi (örn: 12 ay, 365 gün)
- hizmet_gun_sayisi: Toplam hizmet gün sayısı (KRİTİK)

3. KİŞİ VE İŞÇİ SAYILARI (KRİTİK):
- kisi_sayisi: Günlük yemek yiyecek kişi sayısı
- isci_sayisi: Çalıştırılacak işçi/personel sayısı
- ogun_sayisi: Günlük öğün sayısı

4. MALİYET:
- yaklasik_maliyet: Yaklaşık maliyet tutarı
- toplam_tutar: Toplam tutar
- iscilik_orani: İşçilik oranı (%)

5. TARİHLER:
- ise_baslama_tarihi: İşe başlama tarihi
- is_bitis_tarihi: İş bitiş tarihi

6. LOKASYON:
- teslim_yeri: Yemek teslim/dağıtım yeri
- mutfak_tipi: Mutfak tipi (yerinde/merkezi/taşımalı)

MEVCUT TABLOLAR:
${JSON.stringify(tableInfo, null, 2)}

SAYFA METİNLERİ:
${Object.entries(pageTexts).map(([num, text]) => `--- Sayfa ${num} ---\n${text.substring(0, 3000)}`).join('\n\n')}

JSON formatında yanıt ver:
{
  "tables": [
    {"field": "menu_tablosu", "page": 1, "tableIndex": 0, "confidence": "high/medium/low"},
    ...
  ],
  "strings": [
    {"field": "ihale_konusu", "page": 1, "value": "...", "confidence": "high/medium/low"},
    ...
  ]
}

Sadece bulduğun alanları listele. Bulamadıklarını ekleme.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const text = response.content[0].text;
    
    // JSON parse
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return { tables: [], strings: [] };
  } catch (error) {
    console.log(`   ⚠️  Claude hatası: ${error.message}`);
    return { tables: [], strings: [] };
  }
}

function createLabels(layoutResult, claudeAnalysis) {
  const labels = [];

  // Tablo etiketleri
  if (claudeAnalysis.tables) {
    for (const tableMatch of claudeAnalysis.tables) {
      if (tableMatch.confidence === 'low') continue;
      
      const tableIndex = tableMatch.tableIndex;
      const table = layoutResult.tables?.[tableIndex];
      
      if (table && table.boundingRegions?.[0]) {
        const region = table.boundingRegions[0];
        
        labels.push({
          label: tableMatch.field,
          labelType: 'table',
          value: [{
            pageNumber: region.pageNumber,
            boundingBox: polygonToBox(region.polygon),
            tableIndex: tableIndex
          }]
        });
      }
    }
  }

  // String etiketleri
  if (claudeAnalysis.strings) {
    for (const stringMatch of claudeAnalysis.strings) {
      if (stringMatch.confidence === 'low') continue;
      
      // Sayfadaki metinde değeri ara
      const page = layoutResult.pages?.find(p => p.pageNumber === stringMatch.page);
      if (!page) continue;

      // Değeri içeren satırı bul
      let foundLine = null;
      if (page.lines && stringMatch.value) {
        for (const line of page.lines) {
          if (line.content.toLowerCase().includes(stringMatch.value.toLowerCase().substring(0, 20))) {
            foundLine = line;
            break;
          }
        }
      }

      if (foundLine && foundLine.polygon) {
        labels.push({
          label: stringMatch.field,
          value: [{
            pageNumber: stringMatch.page,
            boundingBox: polygonToBox(foundLine.polygon),
            text: stringMatch.value
          }]
        });
      } else {
        // Koordinat bulunamadıysa sadece sayfa bilgisiyle ekle
        labels.push({
          label: stringMatch.field,
          value: [{
            pageNumber: stringMatch.page,
            text: stringMatch.value
          }]
        });
      }
    }
  }

  return labels;
}

function polygonToBox(polygon) {
  if (!polygon || polygon.length < 4) return null;
  
  // Polygon [x1,y1,x2,y2,...] formatında
  // BoundingBox [left, top, width, height] formatına çevir
  const xs = polygon.filter((_, i) => i % 2 === 0);
  const ys = polygon.filter((_, i) => i % 2 === 1);
  
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const right = Math.max(...xs);
  const bottom = Math.max(...ys);
  
  return [left, top, right - left, bottom - top];
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(console.error);
