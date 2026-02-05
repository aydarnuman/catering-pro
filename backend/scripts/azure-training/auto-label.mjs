/**
 * Azure Custom Model - Otomatik Etiketleme
 * PDF'leri analiz edip tabloları otomatik etiketler
 */

import { DocumentAnalysisClient, AzureKeyCredential } from '@azure/ai-form-recognizer';
import { BlobServiceClient } from '@azure/storage-blob';
import fs from 'fs';
import path from 'path';

const AZURE_ENDPOINT = 'https://catering-doc-ai-123.cognitiveservices.azure.com/';
const AZURE_KEY = '5I9qhCxX15RUpdgFccCwjUIUaffI4sIeZbSBFoYet0uIkOf8bPRCJQQJ99CBAC5RqLJXJ3w3AAALACOGt8H3';
const STORAGE_ACCOUNT = 'cateringtr';
const STORAGE_KEY = 'c1iGE5YMj27VzJpZt4Kj9cRprzIB5j0h1VefqBXt312zcpUW+FC4Bpb/WvQdWfHevFoEoWZgxUmp+ASt+ipGOw==';
const CONTAINER_NAME = 'ihale-training';

// Tablo türü belirleme kuralları
const TABLE_RULES = {
  personel_tablosu: ['personel', 'çalışan', 'görevli', 'unvan', 'pozisyon', 'aşçı', 'garson', 'temizlik'],
  menu_tablosu: ['menü', 'menu', 'yemek listesi', 'haftalık', 'günlük', 'kahvaltı', 'öğle', 'akşam', 'çorba', 'pilav'],
  gramaj_tablosu: ['gramaj', 'gram', 'porsiyon', 'miktar', 'ağırlık', 'kg', 'lt', 'adet'],
  malzeme_listesi: ['malzeme', 'hammadde', 'ürün', 'gıda', 'sebze', 'meyve', 'et', 'süt'],
  fiyat_tablosu: ['fiyat', 'tutar', 'bedel', 'tl', '₺', 'birim fiyat', 'toplam'],
  ogun_dagilimi: ['öğün', 'dağılım', 'sabah', 'ara', 'ana'],
  ceza_kesintileri: ['ceza', 'kesinti', 'yaptırım', 'puan'],
};

async function analyzeAndLabel() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║     OTOMATİK ETİKETLEME - Azure Custom Model                         ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  // Azure clients
  const docClient = new DocumentAnalysisClient(AZURE_ENDPOINT, new AzureKeyCredential(AZURE_KEY));
  const blobService = BlobServiceClient.fromConnectionString(
    `DefaultEndpointsProtocol=https;AccountName=${STORAGE_ACCOUNT};AccountKey=${STORAGE_KEY};EndpointSuffix=core.windows.net`
  );
  const containerClient = blobService.getContainerClient(CONTAINER_NAME);

  // PDF'leri listele
  const blobs = [];
  for await (const blob of containerClient.listBlobsFlat()) {
    if (blob.name.endsWith('.pdf')) {
      blobs.push(blob.name);
    }
  }

  console.log(`📄 ${blobs.length} PDF bulundu\n`);

  const allLabels = {};
  let processedCount = 0;

  for (const blobName of blobs) {
    processedCount++;
    console.log(`\n[${processedCount}/${blobs.length}] ${blobName.substring(0, 50)}...`);

    try {
      // Blob URL oluştur
      const blobClient = containerClient.getBlobClient(blobName);
      const blobUrl = blobClient.url;

      // Layout analizi yap
      console.log('   📊 Layout analizi...');
      const poller = await docClient.beginAnalyzeDocumentFromUrl('prebuilt-layout', blobUrl);
      const result = await poller.pollUntilDone();

      if (!result.tables || result.tables.length === 0) {
        console.log('   ⚠️  Tablo bulunamadı');
        continue;
      }

      console.log(`   ✅ ${result.tables.length} tablo bulundu`);

      // Her tablo için etiket belirle
      const labels = [];
      
      for (let i = 0; i < result.tables.length; i++) {
        const table = result.tables[i];
        
        // Tablo metnini birleştir
        let tableText = '';
        for (const cell of table.cells || []) {
          tableText += (cell.content || '') + ' ';
        }
        tableText = tableText.toLowerCase();

        // Önceki paragrafları da kontrol et (tablo başlığı için)
        let contextText = tableText;
        if (result.paragraphs) {
          const tablePage = table.boundingRegions?.[0]?.pageNumber || 1;
          const tableTop = table.boundingRegions?.[0]?.polygon?.[1] || 0;
          
          // Tablonun üstündeki paragrafları bul
          for (const para of result.paragraphs) {
            const paraPage = para.boundingRegions?.[0]?.pageNumber || 1;
            const paraBottom = para.boundingRegions?.[0]?.polygon?.[5] || 0;
            
            if (paraPage === tablePage && paraBottom < tableTop && (tableTop - paraBottom) < 100) {
              contextText = (para.content || '').toLowerCase() + ' ' + contextText;
            }
          }
        }

        // Tablo türünü belirle
        let bestMatch = null;
        let bestScore = 0;

        for (const [fieldName, keywords] of Object.entries(TABLE_RULES)) {
          let score = 0;
          for (const keyword of keywords) {
            if (contextText.includes(keyword)) {
              score += keyword.length; // Uzun eşleşmeler daha değerli
            }
          }
          if (score > bestScore) {
            bestScore = score;
            bestMatch = fieldName;
          }
        }

        if (bestMatch && bestScore >= 4) {
          console.log(`   📌 Tablo ${i + 1}: ${bestMatch} (skor: ${bestScore})`);
          
          labels.push({
            field: bestMatch,
            tableIndex: i,
            pageNumber: table.boundingRegions?.[0]?.pageNumber || 1,
            boundingBox: table.boundingRegions?.[0]?.polygon || [],
            confidence: Math.min(bestScore / 20, 1),
          });
        }
      }

      // String alanları da bul
      if (result.paragraphs) {
        for (const para of result.paragraphs) {
          const text = (para.content || '').toLowerCase();
          
          // İhale kayıt no
          const iknMatch = text.match(/(\d{4}\/\d+)/);
          if (iknMatch) {
            labels.push({
              field: 'ihale_kayit_no',
              value: iknMatch[1],
              pageNumber: para.boundingRegions?.[0]?.pageNumber || 1,
              boundingBox: para.boundingRegions?.[0]?.polygon || [],
            });
          }

          // İdare adı (büyük harfle yazılmış kurum isimleri)
          if (text.includes('müdürlüğü') || text.includes('hastanesi') || text.includes('başkanlığı')) {
            labels.push({
              field: 'idare_adi',
              value: para.content,
              pageNumber: para.boundingRegions?.[0]?.pageNumber || 1,
              boundingBox: para.boundingRegions?.[0]?.polygon || [],
            });
            break; // İlk bulunan yeterli
          }
        }
      }

      allLabels[blobName] = labels;
      console.log(`   💾 ${labels.length} etiket kaydedildi`);

    } catch (error) {
      console.log(`   ❌ Hata: ${error.message}`);
    }
  }

  // Etiketleri JSON olarak kaydet
  const outputPath = path.join(process.cwd(), 'scripts/azure-training/labels.json');
  fs.writeFileSync(outputPath, JSON.stringify(allLabels, null, 2));
  console.log(`\n\n✅ Tüm etiketler kaydedildi: ${outputPath}`);

  // Özet
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('📊 ÖZET');
  console.log('═══════════════════════════════════════════════════════════════════════');
  
  const fieldCounts = {};
  for (const [file, labels] of Object.entries(allLabels)) {
    for (const label of labels) {
      fieldCounts[label.field] = (fieldCounts[label.field] || 0) + 1;
    }
  }
  
  for (const [field, count] of Object.entries(fieldCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${field}: ${count} etiket`);
  }

  // .labels.json dosyası oluştur (Azure Studio formatında)
  await createStudioLabels(allLabels, containerClient);
}

async function createStudioLabels(allLabels, containerClient) {
  console.log('\n📝 Azure Studio formatında etiket dosyaları oluşturuluyor...');

  for (const [blobName, labels] of Object.entries(allLabels)) {
    if (labels.length === 0) continue;

    const labelFileName = blobName + '.labels.json';
    
    const studioFormat = {
      "$schema": "https://schema.cognitiveservices.azure.com/formrecognizer/2021-03-01/labels.json",
      "document": blobName,
      "labels": labels.map(l => ({
        "label": l.field,
        "value": l.value ? [{ "text": l.value, "boundingBoxes": [l.boundingBox] }] : [],
        "labelType": l.tableIndex !== undefined ? "table" : "field",
      })),
    };

    // Azure Storage'a yükle
    const blockBlobClient = containerClient.getBlockBlobClient(labelFileName);
    await blockBlobClient.upload(
      JSON.stringify(studioFormat, null, 2),
      JSON.stringify(studioFormat, null, 2).length,
      { blobHTTPHeaders: { blobContentType: 'application/json' } }
    );
    
    console.log(`   ✅ ${labelFileName}`);
  }

  console.log('\n🎉 Etiket dosyaları Azure Storage\'a yüklendi!');
  console.log('   Document Intelligence Studio\'yu yenile, etiketler görünecek.');
}

analyzeAndLabel().catch(console.error);
