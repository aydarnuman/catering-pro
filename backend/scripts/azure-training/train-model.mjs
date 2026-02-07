#!/usr/bin/env node

/**
 * Azure Custom Model - Tek Komutla Tam Eğitim
 * 
 * Bu script:
 * 1. Tüm PDF'leri Azure Blob Storage'a yükler
 * 2. Her PDF için otomatik etiketleme yapar
 * 3. fields.json schema dosyası oluşturur
 * 4. Model eğitimini başlatır
 * 
 * Kullanım:
 *   node train-model.mjs
 */

import { DocumentAnalysisClient, AzureKeyCredential, DocumentModelAdministrationClient } from '@azure/ai-form-recognizer';
import { BlobServiceClient, StorageSharedKeyCredential, generateAccountSASQueryParameters, AccountSASPermissions, AccountSASResourceTypes, AccountSASServices, SASProtocol } from '@azure/storage-blob';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════════════

const CONFIG = {
  azure: {
    endpoint: 'https://catering-doc-ai-123.cognitiveservices.azure.com/',
    key: '5I9qhCxX15RUpdgFccCwjUIUaffI4sIeZbSBFoYet0uIkOf8bPRCJQQJ99CBAC5RqLJXJ3w3AAALACOGt8H3',
  },
  storage: {
    connectionString: 'DefaultEndpointsProtocol=https;AccountName=cateringtr;AccountKey=c1iGE5YMj27VzJpZt4Kj9cRprzIB5j0h1VefqBXt312zcpUW+FC4Bpb/WvQdWfHevFoEoWZgxUmp+ASt+ipGOw==;EndpointSuffix=core.windows.net',
    accountName: 'cateringtr',
    accountKey: 'c1iGE5YMj27VzJpZt4Kj9cRprzIB5j0h1VefqBXt312zcpUW+FC4Bpb/WvQdWfHevFoEoWZgxUmp+ASt+ipGOw==',
    container: 'ihale-training',
  },
  model: {
    id: 'ihale-catering-v5',  // v5 - Gelişmiş öğün ve personel tabloları
    description: 'İhale Teknik Şartname - Öğün, Personel, Gramaj, Menü tablolarını otomatik çıkarır',
  },
  documentsDir: path.join(__dirname, 'documents'),
};

// ═══════════════════════════════════════════════════════════════════════════
// ALAN TANIMLARI - Bu alanlar çıkarılacak
// ═══════════════════════════════════════════════════════════════════════════

const FIELD_DEFINITIONS = {
  // String alanlar
  ihale_kayit_no: { type: 'string', description: 'İhale Kayıt Numarası (2024/123456)' },
  idare_adi: { type: 'string', description: 'İhaleyi yapan kurum adı' },
  ihale_konusu: { type: 'string', description: 'İhale konusu/başlığı' },
  ise_baslama_tarihi: { type: 'date', description: 'İşe başlama tarihi' },
  is_bitis_tarihi: { type: 'date', description: 'İş bitiş tarihi' },
  sure: { type: 'string', description: 'Sözleşme süresi (ay)' },
  toplam_kisi_sayisi: { type: 'number', description: 'Toplam kişi sayısı' },
  gunluk_ogun_sayisi: { type: 'number', description: 'Günlük öğün sayısı' },
  yaklasik_maliyet: { type: 'currency', description: 'Yaklaşık maliyet tutarı' },
  
  // Tablo alanları (array)
  personel_tablosu: { type: 'array', description: 'Personel listesi tablosu' },
  menu_tablosu: { type: 'array', description: 'Örnek menü tablosu' },
  gramaj_tablosu: { type: 'array', description: 'Gramaj/porsiyon tablosu' },
  malzeme_listesi: { type: 'array', description: 'Malzeme listesi' },
  ceza_tablosu: { type: 'array', description: 'Ceza/kesinti tablosu' },
};

// Tablo eşleştirme kuralları
const TABLE_RULES = {
  personel_tablosu: {
    keywords: ['personel', 'çalışan', 'görevli', 'unvan', 'pozisyon', 'aşçı', 'garson', 'temizlik', 'işçi', 'sayısı', 'adet'],
    headerPatterns: ['unvan', 'görev', 'sayı', 'adet', 'pozisyon'],
    minScore: 8,
  },
  menu_tablosu: {
    keywords: ['menü', 'menu', 'örnek', 'haftalık', 'günlük', 'kahvaltı', 'öğle', 'akşam', 'çorba', 'pilav', 'yemek', 'salata', 'tatlı', 'meyve'],
    headerPatterns: ['gün', 'öğün', 'sabah', 'öğle', 'akşam', 'pazartesi', 'salı'],
    minScore: 10,
  },
  gramaj_tablosu: {
    keywords: ['gramaj', 'gram', 'porsiyon', 'miktar', 'ağırlık', 'gr.', 'gr ', 'g/', 'adet', 'dilim', 'ml', 'lt'],
    headerPatterns: ['malzeme', 'gramaj', 'miktar', 'porsiyon', 'birim'],
    minScore: 8,
  },
  malzeme_listesi: {
    keywords: ['malzeme', 'hammadde', 'ürün', 'gıda', 'sebze', 'meyve', 'et', 'süt', 'tedarik', 'liste'],
    headerPatterns: ['sıra', 'malzeme', 'ürün', 'miktar'],
    minScore: 6,
  },
  ceza_tablosu: {
    keywords: ['ceza', 'kesinti', 'yaptırım', 'puan', 'eksik', 'gecikme', 'ihlal'],
    headerPatterns: ['madde', 'ceza', 'kesinti', 'oran'],
    minScore: 6,
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════════════════

function log(msg, type = 'info') {
  const icons = { info: '📋', success: '✅', warn: '⚠️', error: '❌', step: '▶' };
  console.log(`${icons[type] || '  '} ${msg}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 1: PDF'leri Azure Storage'a Yükle
// ═══════════════════════════════════════════════════════════════════════════

async function uploadPDFs(containerClient) {
  log('ADIM 1: PDF\'ler Azure Storage\'a yükleniyor...', 'step');
  
  const pdfFiles = fs.readdirSync(CONFIG.documentsDir)
    .filter(f => f.toLowerCase().endsWith('.pdf'));
  
  log(`${pdfFiles.length} PDF dosyası bulundu`);
  
  let uploaded = 0;
  let skipped = 0;
  
  for (const filename of pdfFiles) {
    const blobClient = containerClient.getBlockBlobClient(filename);
    
    // Zaten var mı?
    const exists = await blobClient.exists();
    if (exists) {
      skipped++;
      continue;
    }
    
    const filePath = path.join(CONFIG.documentsDir, filename);
    const buffer = fs.readFileSync(filePath);
    
    await blobClient.upload(buffer, buffer.length, {
      blobHTTPHeaders: { blobContentType: 'application/pdf' },
    });
    
    uploaded++;
    process.stdout.write(`\r   Yüklendi: ${uploaded}/${pdfFiles.length - skipped}`);
  }
  
  console.log('');
  log(`${uploaded} yeni PDF yüklendi, ${skipped} zaten mevcuttu`, 'success');
  
  return pdfFiles;
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 2: Otomatik Etiketleme
// ═══════════════════════════════════════════════════════════════════════════

async function autoLabel(containerClient, docClient, pdfFiles) {
  log('\nADIM 2: Otomatik etiketleme yapılıyor...', 'step');
  
  const allLabels = {};
  let processed = 0;
  let success = 0;
  
  for (const filename of pdfFiles) {
    processed++;
    const shortName = filename.length > 40 ? filename.substring(0, 37) + '...' : filename;
    process.stdout.write(`\r   [${processed}/${pdfFiles.length}] ${shortName.padEnd(42)}`);
    
    try {
      // PDF'i indir
      const blobClient = containerClient.getBlobClient(filename);
      const downloadResponse = await blobClient.download();
      const chunks = [];
      for await (const chunk of downloadResponse.readableStreamBody) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      
      // Layout analizi
      const poller = await docClient.beginAnalyzeDocument('prebuilt-layout', buffer);
      const result = await poller.pollUntilDone();
      
      // Etiketleri çıkar
      const labels = extractLabels(result, filename);
      allLabels[filename] = labels;
      
      if (labels.length > 0) {
        success++;
        
        // .labels.json dosyasını oluştur ve yükle
        await uploadLabelFile(containerClient, filename, labels);
      }
      
    } catch {
      allLabels[filename] = [];
    }
    
    // Rate limiting
    await sleep(500);
  }
  
  console.log('');
  log(`${success}/${pdfFiles.length} dosya başarıyla etiketlendi`, 'success');
  
  return allLabels;
}

function extractLabels(result, _filename) {
  const labels = [];
  const usedFields = new Set();
  
  // 1. Tabloları etiketle
  if (result.tables) {
    for (let i = 0; i < result.tables.length; i++) {
      const table = result.tables[i];
      
      // Tablo metnini birleştir
      let tableText = '';
      const headers = [];
      
      for (const cell of table.cells || []) {
        const content = (cell.content || '').toLowerCase();
        tableText += content + ' ';
        
        if (cell.rowIndex === 0 || cell.kind === 'columnHeader') {
          headers.push(content);
        }
      }
      
      // Önceki paragrafları da kontrol et (tablo başlığı)
      const tablePage = table.boundingRegions?.[0]?.pageNumber || 1;
      const tableTop = table.boundingRegions?.[0]?.polygon?.[1] || 0;
      
      let headerText = '';
      if (result.paragraphs) {
        for (const para of result.paragraphs) {
          const paraPage = para.boundingRegions?.[0]?.pageNumber || 1;
          const paraBottom = para.boundingRegions?.[0]?.polygon?.[5] || 0;
          
          if (paraPage === tablePage && paraBottom < tableTop && (tableTop - paraBottom) < 100) {
            headerText = (para.content || '').toLowerCase() + ' ' + headerText;
          }
        }
      }
      
      const contextText = headerText + ' ' + tableText;
      
      // En iyi eşleşmeyi bul
      let bestMatch = null;
      let bestScore = 0;
      
      for (const [fieldName, rules] of Object.entries(TABLE_RULES)) {
        if (usedFields.has(fieldName)) continue;
        
        let score = 0;
        
        // Keyword skorlama
        for (const keyword of rules.keywords) {
          const regex = new RegExp(keyword, 'gi');
          const matches = contextText.match(regex);
          if (matches) {
            score += matches.length * 2;
          }
        }
        
        // Header pattern bonus
        for (const pattern of rules.headerPatterns) {
          if (headers.some(h => h.includes(pattern))) {
            score += 5;
          }
        }
        
        if (score > bestScore && score >= rules.minScore) {
          bestScore = score;
          bestMatch = fieldName;
        }
      }
      
      if (bestMatch) {
        usedFields.add(bestMatch);
        labels.push({
          label: bestMatch,
          labelType: 'table',
          value: [{
            tableIndex: i,
            pageNumber: tablePage,
            boundingBox: table.boundingRegions?.[0]?.polygon,
          }],
        });
      }
    }
  }
  
  // 2. String alanları bul
  if (result.paragraphs) {
    for (const para of result.paragraphs) {
      const text = para.content || '';
      const textLower = text.toLowerCase();
      const pageNumber = para.boundingRegions?.[0]?.pageNumber || 1;
      const boundingBox = para.boundingRegions?.[0]?.polygon;
      
      // İhale kayıt no (2024/123456 formatı)
      if (!usedFields.has('ihale_kayit_no')) {
        const iknMatch = text.match(/(\d{4}\/\d{4,6})/);
        if (iknMatch) {
          labels.push({
            label: 'ihale_kayit_no',
            value: [{ text: iknMatch[1], pageNumber, boundingBox }],
          });
          usedFields.add('ihale_kayit_no');
        }
      }
      
      // İdare adı
      if (!usedFields.has('idare_adi') && pageNumber <= 2) {
        if (textLower.includes('müdürlüğü') || textLower.includes('hastanesi') || 
            textLower.includes('başkanlığı') || textLower.includes('üniversitesi') ||
            textLower.includes('belediyesi')) {
          labels.push({
            label: 'idare_adi',
            value: [{ text: text.substring(0, 200), pageNumber, boundingBox }],
          });
          usedFields.add('idare_adi');
        }
      }
      
      // Tarihler
      const dateMatch = text.match(/(\d{1,2}[./]\d{1,2}[./]\d{4})/g);
      if (dateMatch) {
        if (!usedFields.has('ise_baslama_tarihi') && 
            (textLower.includes('başla') || textLower.includes('işe giriş'))) {
          labels.push({
            label: 'ise_baslama_tarihi',
            value: [{ text: dateMatch[0], pageNumber, boundingBox }],
          });
          usedFields.add('ise_baslama_tarihi');
        }
        
        if (!usedFields.has('is_bitis_tarihi') && 
            (textLower.includes('bitiş') || textLower.includes('sona er'))) {
          labels.push({
            label: 'is_bitis_tarihi',
            value: [{ text: dateMatch[dateMatch.length - 1], pageNumber, boundingBox }],
          });
          usedFields.add('is_bitis_tarihi');
        }
      }
      
      // Kişi sayısı
      if (!usedFields.has('toplam_kisi_sayisi')) {
        const kisiMatch = text.match(/toplam\s*(\d+)\s*(kişi|personel|işçi)/i) ||
                         text.match(/(\d+)\s*(kişi|personel).*(toplam|günlük)/i);
        if (kisiMatch) {
          labels.push({
            label: 'toplam_kisi_sayisi',
            value: [{ text: kisiMatch[1], pageNumber, boundingBox }],
          });
          usedFields.add('toplam_kisi_sayisi');
        }
      }
      
      // Öğün sayısı
      if (!usedFields.has('gunluk_ogun_sayisi')) {
        const ogunMatch = text.match(/(\d+)\s*öğün/i) ||
                         text.match(/günde\s*(\d+)/i);
        if (ogunMatch) {
          labels.push({
            label: 'gunluk_ogun_sayisi',
            value: [{ text: ogunMatch[1], pageNumber, boundingBox }],
          });
          usedFields.add('gunluk_ogun_sayisi');
        }
      }
      
      // Yaklaşık maliyet
      if (!usedFields.has('yaklasik_maliyet') && textLower.includes('yaklaşık maliyet')) {
        const tutarMatch = text.match(/([\d.,]+)\s*(tl|türk lirası|₺)/i);
        if (tutarMatch) {
          labels.push({
            label: 'yaklasik_maliyet',
            value: [{ text: tutarMatch[0], pageNumber, boundingBox }],
          });
          usedFields.add('yaklasik_maliyet');
        }
      }
    }
  }
  
  return labels;
}

async function uploadLabelFile(containerClient, pdfFilename, labels) {
  const labelFileName = pdfFilename + '.labels.json';
  
  const studioFormat = {
    "$schema": "https://schema.cognitiveservices.azure.com/formrecognizer/2021-03-01/labels.json",
    "document": pdfFilename,
    "labels": labels,
  };
  
  const blockBlobClient = containerClient.getBlockBlobClient(labelFileName);
  const content = JSON.stringify(studioFormat, null, 2);
  
  await blockBlobClient.upload(content, content.length, {
    blobHTTPHeaders: { blobContentType: 'application/json' },
    overwrite: true,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 3: fields.json Oluştur
// ═══════════════════════════════════════════════════════════════════════════

async function createFieldsJson(containerClient, allLabels) {
  log('\nADIM 3: fields.json oluşturuluyor...', 'step');
  
  // Kullanılan alanları topla
  const usedFields = new Set();
  for (const labels of Object.values(allLabels)) {
    for (const label of labels) {
      usedFields.add(label.label);
    }
  }
  
  // fields.json formatı
  const fieldsJson = {
    "$schema": "https://schema.cognitiveservices.azure.com/formrecognizer/2021-03-01/fields.json",
    "fields": [],
    "definitions": {},
  };
  
  for (const [fieldName, definition] of Object.entries(FIELD_DEFINITIONS)) {
    if (usedFields.has(fieldName)) {
      const fieldDef = {
        fieldKey: fieldName,
        fieldType: definition.type === 'array' ? 'selectionMark' : 'string',
        fieldFormat: definition.type === 'array' ? 'not-specified' : 
                     definition.type === 'date' ? 'date' :
                     definition.type === 'number' ? 'number' :
                     definition.type === 'currency' ? 'currency' : 'not-specified',
      };
      
      if (definition.type === 'array') {
        fieldDef.fieldType = 'array';
        fieldDef.itemType = 'object';
      }
      
      fieldsJson.fields.push(fieldDef);
    }
  }
  
  // Yükle
  const blockBlobClient = containerClient.getBlockBlobClient('fields.json');
  const content = JSON.stringify(fieldsJson, null, 2);
  
  await blockBlobClient.upload(content, content.length, {
    blobHTTPHeaders: { blobContentType: 'application/json' },
    overwrite: true,
  });
  
  log(`${fieldsJson.fields.length} alan tanımı oluşturuldu`, 'success');
  
  // Alanları listele
  console.log('');
  for (const field of fieldsJson.fields) {
    const count = Object.values(allLabels).filter(labels => 
      labels.some(l => l.label === field.fieldKey)
    ).length;
    console.log(`   ${field.fieldKey}: ${count} dokümanda`);
  }
  
  return fieldsJson;
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 4: Model Eğitimi Başlat
// ═══════════════════════════════════════════════════════════════════════════

async function startTraining(adminClient) {
  log('\nADIM 4: Model eğitimi başlatılıyor...', 'step');

  // Container SAS URL oluştur
  const sharedKeyCredential = new StorageSharedKeyCredential(
    CONFIG.storage.accountName,
    CONFIG.storage.accountKey
  );

  const sasToken = generateAccountSASQueryParameters({
    startsOn: new Date(),
    expiresOn: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 saat
    services: AccountSASServices.parse('b').toString(),       // blob
    resourceTypes: AccountSASResourceTypes.parse('sco').toString(), // service, container, object
    permissions: AccountSASPermissions.parse('rl'),           // read, list
    protocol: SASProtocol.Https,
  }, sharedKeyCredential).toString();

  const containerUrl = `https://${CONFIG.storage.accountName}.blob.core.windows.net/${CONFIG.storage.container}?${sasToken}`;

  log(`Container SAS URL oluşturuldu (24 saat geçerli)`);
  log(`Model ID: ${CONFIG.model.id}`);
  log(`Build Mode: neural (Custom Neural Model)`);

  // Mevcut modeli kontrol et
  try {
    const existing = await adminClient.getDocumentModel(CONFIG.model.id);
    if (existing) {
      log(`⚠️  Model "${CONFIG.model.id}" zaten mevcut (oluşturulma: ${existing.createdOn})`, 'warn');
      log(`   Yeni versiyon oluşturuluyor: ${CONFIG.model.id}-${Date.now()}`, 'warn');
      CONFIG.model.id = `${CONFIG.model.id}-${Date.now()}`;
    }
  } catch (_e) {
    // Model bulunamadı = iyi, yeni oluşturulacak
  }

  log(`\n🚀 Eğitim başlatılıyor: ${CONFIG.model.id}...`);
  log('   Bu işlem 1-2 saat sürebilir. İlerlemeyi takip ediyorum...\n');

  try {
    const poller = await adminClient.beginBuildDocumentModel(
      CONFIG.model.id,
      containerUrl,
      'neural',
      {
        description: CONFIG.model.description,
        onProgress: (state) => {
          const pct = state.percentCompleted || 0;
          process.stdout.write(`\r   ⏳ İlerleme: ${pct}% [${state.status || 'running'}]`);
        },
      }
    );

    log('   Eğitim başlatıldı! Poller ID: ' + (poller.operationId || 'N/A'));
    log('   Sonuç bekleniyor...\n');

    // Eğitim tamamlanana kadar bekle
    const model = await poller.pollUntilDone();

    console.log('\n');
    log('═══════════════════════════════════════════════════════════════', 'success');
    log('🎉 MODEL EĞİTİMİ TAMAMLANDI!', 'success');
    log('═══════════════════════════════════════════════════════════════', 'success');
    console.log('');
    console.log(`   Model ID:        ${model.modelId}`);
    console.log(`   Açıklama:        ${model.description || '-'}`);
    console.log(`   Oluşturulma:     ${model.createdOn}`);
    console.log(`   API Version:     ${model.apiVersion || '-'}`);
    console.log(`   Doc Types:       ${Object.keys(model.docTypes || {}).length}`);

    if (model.docTypes) {
      for (const [typeName, typeInfo] of Object.entries(model.docTypes)) {
        const fieldCount = Object.keys(typeInfo.fieldSchema || {}).length;
        console.log(`\n   📋 ${typeName}: ${fieldCount} alan`);
        if (typeInfo.fieldSchema) {
          for (const [fieldName, fieldInfo] of Object.entries(typeInfo.fieldSchema)) {
            console.log(`      - ${fieldName}: ${fieldInfo.type || '?'}`);
          }
        }
      }
    }

    console.log('\n   💡 Sonraki adım: .env dosyasına ekle:');
    console.log(`      AZURE_DOCUMENT_AI_MODEL_ID=${model.modelId}`);
    console.log(`      AZURE_USE_CUSTOM_MODEL=true`);

    return model;
  } catch (error) {
    log(`\n❌ Eğitim hatası: ${error.message}`, 'error');
    if (error.details) {
      log(`   Detay: ${JSON.stringify(error.details)}`, 'error');
    }

    // Fallback: Manuel talimatlar
    console.log('\n   Alternatif: Azure Studio\'da manuel eğitin:');
    console.log('   1. https://documentintelligence.ai.azure.com/studio');
    console.log('   2. "Custom extraction models" > "Create new"');
    console.log('   3. Storage: cateringtr / ihale-training');
    console.log('   4. Model ID: ' + CONFIG.model.id);

    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║     AZURE CUSTOM MODEL - OTOMATIK EĞİTİM                             ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');
  
  // Clients
  const blobService = BlobServiceClient.fromConnectionString(CONFIG.storage.connectionString);
  const containerClient = blobService.getContainerClient(CONFIG.storage.container);
  const docClient = new DocumentAnalysisClient(
    CONFIG.azure.endpoint, 
    new AzureKeyCredential(CONFIG.azure.key)
  );
  const adminClient = new DocumentModelAdministrationClient(
    CONFIG.azure.endpoint,
    new AzureKeyCredential(CONFIG.azure.key)
  );
  
  // Container var mı?
  const exists = await containerClient.exists();
  if (!exists) {
    await containerClient.create({ access: 'blob' });
    log('Container oluşturuldu: ' + CONFIG.storage.container, 'success');
  }
  
  const startTime = Date.now();
  
  // Step 1: Upload
  const pdfFiles = await uploadPDFs(containerClient);
  
  // Step 2: Auto-label
  const allLabels = await autoLabel(containerClient, docClient, pdfFiles);
  
  // Step 3: Create fields.json
  await createFieldsJson(containerClient, allLabels);
  
  // Step 4: Training (otomatik)
  const trainedModel = await startTraining(adminClient);
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(`\n⏱️  Toplam süre: ${elapsed}s`);
  if (trainedModel) {
    console.log(`\n✅ Model eğitimi tamamlandı! Model ID: ${trainedModel.modelId}\n`);
  } else {
    console.log('\n⚠️  Model eğitimi manuel olarak tamamlanmalı.\n');
  }
  
  // Özet istatistikler
  let totalLabels = 0;
  const fieldStats = {};
  for (const labels of Object.values(allLabels)) {
    for (const label of labels) {
      totalLabels++;
      fieldStats[label.label] = (fieldStats[label.label] || 0) + 1;
    }
  }
  
  console.log('📊 ETİKET ÖZETİ:');
  console.log(`   Toplam: ${totalLabels} etiket, ${pdfFiles.length} doküman\n`);
  
  const sorted = Object.entries(fieldStats).sort((a, b) => b[1] - a[1]);
  for (const [field, count] of sorted) {
    const bar = '█'.repeat(Math.min(count, 20));
    console.log(`   ${field.padEnd(22)} ${bar} ${count}`);
  }
}

main().catch(err => {
  console.error('\n❌ HATA:', err.message);
  process.exit(1);
});
