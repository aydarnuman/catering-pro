/**
 * Azure Custom Model - Otomatik Etiketleme v2
 * PDF'leri indir, analiz et, etiketle
 */

import { DocumentAnalysisClient, AzureKeyCredential } from '@azure/ai-form-recognizer';
import { BlobServiceClient } from '@azure/storage-blob';
import fs from 'fs';
import path from 'path';
import os from 'os';

const AZURE_ENDPOINT = 'https://catering-doc-ai-123.cognitiveservices.azure.com/';
const AZURE_KEY = '5I9qhCxX15RUpdgFccCwjUIUaffI4sIeZbSBFoYet0uIkOf8bPRCJQQJ99CBAC5RqLJXJ3w3AAALACOGt8H3';
const STORAGE_CONN = 'DefaultEndpointsProtocol=https;AccountName=cateringtr;AccountKey=c1iGE5YMj27VzJpZt4Kj9cRprzIB5j0h1VefqBXt312zcpUW+FC4Bpb/WvQdWfHevFoEoWZgxUmp+ASt+ipGOw==;EndpointSuffix=core.windows.net';
const CONTAINER_NAME = 'ihale-training';

// Tablo türü belirleme kuralları
const TABLE_RULES = {
  personel_tablosu: ['personel', 'çalışan', 'görevli', 'unvan', 'pozisyon', 'aşçı', 'garson', 'temizlik', 'işçi'],
  menu_tablosu: ['menü', 'menu', 'örnek', 'haftalık', 'günlük', 'kahvaltı', 'öğle', 'akşam', 'çorba', 'pilav', 'yemek', 'salata'],
  gramaj_tablosu: ['gramaj', 'gram', 'porsiyon', 'miktar', 'ağırlık', 'gr.', 'gr ', 'g/', 'adet', 'dilim'],
  malzeme_listesi: ['malzeme', 'hammadde', 'ürün', 'gıda', 'sebze', 'meyve', 'et', 'süt', 'tedarik'],
  fiyat_tablosu: ['fiyat', 'tutar', 'bedel', 'tl', '₺', 'birim fiyat', 'maliyet'],
  ogun_dagilimi: ['öğün', 'dağılım', 'sabah', 'ara öğün', 'ana öğün', 'diyet'],
  ceza_kesintileri: ['ceza', 'kesinti', 'yaptırım', 'puan', 'eksik'],
};

async function analyzeAndLabel() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║     OTOMATİK ETİKETLEME v2 - Azure Custom Model                      ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  const docClient = new DocumentAnalysisClient(AZURE_ENDPOINT, new AzureKeyCredential(AZURE_KEY));
  const blobService = BlobServiceClient.fromConnectionString(STORAGE_CONN);
  const containerClient = blobService.getContainerClient(CONTAINER_NAME);

  // PDF'leri listele
  const blobs = [];
  for await (const blob of containerClient.listBlobsFlat()) {
    if (blob.name.toLowerCase().endsWith('.pdf')) {
      blobs.push(blob.name);
    }
  }

  console.log(`📄 ${blobs.length} PDF bulundu\n`);

  const allLabels = {};
  let processedCount = 0;
  const tempDir = path.join(os.tmpdir(), 'azure-labeling');
  fs.mkdirSync(tempDir, { recursive: true });

  for (const blobName of blobs.slice(0, 10)) { // İlk 10 PDF
    processedCount++;
    const shortName = blobName.length > 45 ? blobName.substring(0, 42) + '...' : blobName;
    console.log(`\n[${processedCount}/${Math.min(blobs.length, 10)}] ${shortName}`);

    try {
      // PDF'i indir
      console.log('   📥 İndiriliyor...');
      const blobClient = containerClient.getBlobClient(blobName);
      const tempPath = path.join(tempDir, `temp_${processedCount}.pdf`);
      await blobClient.downloadToFile(tempPath);

      // Dosya boyutu kontrol
      const stats = fs.statSync(tempPath);
      if (stats.size < 10000) {
        console.log(`   ⚠️  Dosya çok küçük (${Math.round(stats.size/1024)}KB), atlanıyor`);
        continue;
      }

      // Layout analizi yap
      console.log('   📊 Layout analizi...');
      const fileBuffer = fs.readFileSync(tempPath);
      const poller = await docClient.beginAnalyzeDocument('prebuilt-layout', fileBuffer);
      const result = await poller.pollUntilDone();

      if (!result.tables || result.tables.length === 0) {
        console.log('   ⚠️  Tablo bulunamadı');
        allLabels[blobName] = [];
        continue;
      }

      console.log(`   ✅ ${result.tables.length} tablo, ${result.paragraphs?.length || 0} paragraf bulundu`);

      // Her tablo için etiket belirle
      const labels = [];
      const usedFields = new Set();
      
      for (let i = 0; i < result.tables.length; i++) {
        const table = result.tables[i];
        
        // Tablo metnini birleştir
        let tableText = '';
        for (const cell of table.cells || []) {
          tableText += (cell.content || '') + ' ';
        }
        tableText = tableText.toLowerCase();

        // Tablonun bulunduğu sayfa ve konum
        const tablePage = table.boundingRegions?.[0]?.pageNumber || 1;
        const tablePolygon = table.boundingRegions?.[0]?.polygon || [];
        const tableTop = tablePolygon[1] || 0;

        // Önceki paragrafları da kontrol et (tablo başlığı)
        let headerText = '';
        if (result.paragraphs) {
          for (const para of result.paragraphs) {
            const paraPage = para.boundingRegions?.[0]?.pageNumber || 1;
            const paraPolygon = para.boundingRegions?.[0]?.polygon || [];
            const paraBottom = paraPolygon[5] || 0;
            
            if (paraPage === tablePage && paraBottom < tableTop && (tableTop - paraBottom) < 80) {
              headerText = (para.content || '').toLowerCase() + ' ' + headerText;
            }
          }
        }

        const contextText = headerText + ' ' + tableText;

        // Tablo türünü belirle
        let bestMatch = null;
        let bestScore = 0;

        for (const [fieldName, keywords] of Object.entries(TABLE_RULES)) {
          if (usedFields.has(fieldName)) continue; // Her alan 1 kez
          
          let score = 0;
          for (const keyword of keywords) {
            const regex = new RegExp(keyword, 'gi');
            const matches = contextText.match(regex);
            if (matches) {
              score += matches.length * keyword.length;
            }
          }
          if (score > bestScore) {
            bestScore = score;
            bestMatch = fieldName;
          }
        }

        if (bestMatch && bestScore >= 6) {
          console.log(`   📌 Tablo ${i + 1} (s.${tablePage}): ${bestMatch} (skor: ${bestScore})`);
          usedFields.add(bestMatch);
          
          labels.push({
            field: bestMatch,
            tableIndex: i,
            pageNumber: tablePage,
            rowCount: table.rowCount,
            columnCount: table.columnCount,
            boundingBox: tablePolygon,
          });
        }
      }

      // String alanları bul
      if (result.paragraphs) {
        for (const para of result.paragraphs) {
          const text = para.content || '';
          const textLower = text.toLowerCase();
          
          // İhale kayıt no
          if (!usedFields.has('ihale_kayit_no')) {
            const iknMatch = text.match(/(\d{4}\/\d{4,6})/);
            if (iknMatch) {
              labels.push({
                field: 'ihale_kayit_no',
                value: iknMatch[1],
                pageNumber: para.boundingRegions?.[0]?.pageNumber || 1,
              });
              usedFields.add('ihale_kayit_no');
              console.log(`   📌 ihale_kayit_no: ${iknMatch[1]}`);
            }
          }

          // İdare adı
          if (!usedFields.has('idare_adi')) {
            if (textLower.includes('müdürlüğü') || textLower.includes('hastanesi') || 
                textLower.includes('başkanlığı') || textLower.includes('üniversitesi')) {
              labels.push({
                field: 'idare_adi',
                value: text.substring(0, 200),
                pageNumber: para.boundingRegions?.[0]?.pageNumber || 1,
              });
              usedFields.add('idare_adi');
              console.log(`   📌 idare_adi: ${text.substring(0, 50)}...`);
            }
          }
        }
      }

      allLabels[blobName] = labels;
      console.log(`   💾 Toplam ${labels.length} etiket`);

      // Temp dosyayı sil
      fs.unlinkSync(tempPath);

    } catch (error) {
      console.log(`   ❌ Hata: ${error.message.substring(0, 80)}`);
      allLabels[blobName] = [];
    }
  }

  // Sonuçları kaydet
  const outputPath = path.join(process.cwd(), 'scripts/azure-training/labels.json');
  fs.writeFileSync(outputPath, JSON.stringify(allLabels, null, 2));

  // Özet
  console.log('\n\n═══════════════════════════════════════════════════════════════════════');
  console.log('📊 ÖZET');
  console.log('═══════════════════════════════════════════════════════════════════════');
  
  const fieldCounts = {};
  let totalLabels = 0;
  for (const [file, labels] of Object.entries(allLabels)) {
    for (const label of labels) {
      fieldCounts[label.field] = (fieldCounts[label.field] || 0) + 1;
      totalLabels++;
    }
  }
  
  console.log(`\n   Toplam ${totalLabels} etiket, ${Object.keys(allLabels).length} dosya\n`);
  for (const [field, count] of Object.entries(fieldCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${field}: ${count}`);
  }

  // Azure Studio formatında .labels.json dosyaları oluştur
  console.log('\n\n📝 Azure Studio etiket dosyaları oluşturuluyor...');
  await createStudioLabels(allLabels, containerClient);
}

async function createStudioLabels(allLabels, containerClient) {
  let uploadCount = 0;
  
  for (const [blobName, labels] of Object.entries(allLabels)) {
    if (labels.length === 0) continue;

    const labelFileName = blobName + '.labels.json';
    
    const studioFormat = {
      "$schema": "https://schema.cognitiveservices.azure.com/formrecognizer/2021-03-01/labels.json",
      "document": blobName,
      "labels": labels.map(l => {
        if (l.tableIndex !== undefined) {
          return {
            "label": l.field,
            "labelType": "table",
            "value": [{
              "tableIndex": l.tableIndex,
              "pageNumber": l.pageNumber,
            }],
          };
        } else {
          return {
            "label": l.field,
            "value": [{ 
              "text": l.value,
              "pageNumber": l.pageNumber,
            }],
          };
        }
      }),
    };

    try {
      const blockBlobClient = containerClient.getBlockBlobClient(labelFileName);
      const content = JSON.stringify(studioFormat, null, 2);
      await blockBlobClient.upload(content, content.length, {
        blobHTTPHeaders: { blobContentType: 'application/json' },
        overwrite: true,
      });
      uploadCount++;
    } catch (err) {
      console.log(`   ⚠️  ${labelFileName}: ${err.message}`);
    }
  }

  console.log(`\n✅ ${uploadCount} etiket dosyası Azure Storage'a yüklendi!`);
  console.log('\n🎯 SONRAKİ ADIM:');
  console.log('   1. Document Intelligence Studio\'yu yenile (F5)');
  console.log('   2. Etiketler otomatik görünecek');
  console.log('   3. "Train" butonuna tıkla');
}

analyzeAndLabel().catch(console.error);
