#!/usr/bin/env node

/**
 * Azure Document Intelligence Training Data Preparation
 * 
 * Bu script:
 * 1. Supabase'den ve yerel klasörlerden ihale dökümanlarını toplar
 * 2. Azure Blob Storage'a yükler
 * 3. Eğitim için manifest dosyası oluşturur
 * 
 * Gereksinimler:
 * - Azure Blob Storage hesabı
 * - En az 5 farklı ihale dökümanı (10+ önerilir)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Azure Blob Storage config
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const AZURE_TRAINING_CONTAINER = process.env.AZURE_TRAINING_CONTAINER || 'training-data';

// Supabase config
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Local training data folder
const TRAINING_DATA_DIR = path.join(__dirname, 'documents');
const OUTPUT_DIR = path.join(__dirname, 'output');

// Training field definitions
const TRAINING_FIELDS = {
  // Tablo alanları (region olarak işaretlenecek)
  tables: [
    {
      name: 'ornek_menu_tablosu',
      description: 'Örnek menü tablosu (günlük/haftalık yemek listesi)',
      type: 'table',
      required: true,
    },
    {
      name: 'gramaj_tablosu', 
      description: 'Gramaj/porsiyon tablosu (malzeme gramları)',
      type: 'table',
      required: true,
    },
    {
      name: 'personel_tablosu',
      description: 'Personel gereksinimleri tablosu',
      type: 'table',
      required: true,
    },
    {
      name: 'ogun_tablosu',
      description: 'Öğün adetleri tablosu (kahvaltı, öğle, akşam)',
      type: 'table',
      required: false,
    },
    {
      name: 'ceza_tablosu',
      description: 'Ceza koşulları tablosu',
      type: 'table',
      required: false,
    },
  ],
  
  // Metin alanları (text span olarak işaretlenecek)
  text: [
    {
      name: 'ihale_konusu',
      description: 'İhale konusu/başlığı',
      type: 'string',
      required: true,
    },
    {
      name: 'kurum_adi',
      description: 'İhaleyi yapan kurum adı',
      type: 'string',
      required: true,
    },
    {
      name: 'sozlesme_suresi',
      description: 'Sözleşme süresi (ör: 24 ay)',
      type: 'string',
      required: false,
    },
    {
      name: 'yaklasik_maliyet',
      description: 'Yaklaşık maliyet tutarı',
      type: 'currency',
      required: false,
    },
    {
      name: 'gunluk_ogun_sayisi',
      description: 'Günlük toplam öğün sayısı',
      type: 'number',
      required: false,
    },
    {
      name: 'toplam_personel_sayisi',
      description: 'Toplam çalıştırılacak personel sayısı',
      type: 'number',
      required: false,
    },
  ],
  
  // Liste alanları (birden fazla değer)
  arrays: [
    {
      name: 'kalite_gereksinimleri',
      description: 'Kalite ve hijyen gereksinimleri listesi',
      type: 'array',
      itemType: 'string',
      required: false,
    },
    {
      name: 'servis_saatleri',
      description: 'Yemek servis saatleri',
      type: 'array',
      itemType: 'string',
      required: false,
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

async function ensureDirectories() {
  if (!fs.existsSync(TRAINING_DATA_DIR)) {
    fs.mkdirSync(TRAINING_DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

async function collectFromSupabase() {
  console.log('\n📥 Supabase\'den dökümanlar toplanıyor...');
  
  const { data: docs, error } = await supabase
    .from('documents')
    .select('id, filename, original_filename, file_type, tender_id, storage_path')
    .or('original_filename.ilike.%teknik%,original_filename.ilike.%sartname%')
    .eq('file_type', 'application/pdf')
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (error) {
    console.log('  ⚠️  Supabase hatası:', error.message);
    return [];
  }
  
  console.log(`  📄 ${docs?.length || 0} döküman bulundu`);
  
  const downloaded = [];
  
  for (const doc of docs || []) {
    try {
      const storagePath = doc.storage_path || `tenders/${doc.tender_id}/${doc.filename}`;
      
      const { data: signedData } = await supabase.storage
        .from('tender-documents')
        .createSignedUrl(storagePath, 3600);
      
      if (signedData?.signedUrl) {
        const response = await fetch(signedData.signedUrl);
        if (response.ok) {
          const buffer = Buffer.from(await response.arrayBuffer());
          const filename = doc.original_filename || doc.filename;
          const localPath = path.join(TRAINING_DATA_DIR, filename);
          
          fs.writeFileSync(localPath, buffer);
          downloaded.push({ filename, path: localPath, source: 'supabase', tenderId: doc.tender_id });
          console.log(`  ✅ ${filename}`);
        }
      }
    } catch (e) {
      console.log(`  ❌ ${doc.filename}: ${e.message}`);
    }
  }
  
  return downloaded;
}

async function collectFromLocal() {
  console.log('\n📁 Yerel dökümanlar taranıyor...');
  
  const sources = [
    process.env.HOME + '/Desktop',
    process.env.HOME + '/Documents',
    TRAINING_DATA_DIR,
  ];
  
  const found = [];
  
  for (const source of sources) {
    if (!fs.existsSync(source)) continue;
    
    try {
      const entries = fs.readdirSync(source, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(source, entry.name);
        
        if (entry.isDirectory() && entry.name.toLowerCase().includes('ihale')) {
          // İhale klasörlerini tara
          const subFiles = fs.readdirSync(fullPath);
          for (const subFile of subFiles) {
            if (subFile.toLowerCase().endsWith('.pdf') && 
                (subFile.toLowerCase().includes('teknik') || subFile.toLowerCase().includes('sartname'))) {
              const subPath = path.join(fullPath, subFile);
              found.push({ filename: subFile, path: subPath, source: 'local' });
              console.log(`  📄 ${subFile}`);
            }
          }
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
          if (entry.name.toLowerCase().includes('teknik') || entry.name.toLowerCase().includes('sartname')) {
            found.push({ filename: entry.name, path: fullPath, source: 'local' });
            console.log(`  📄 ${entry.name}`);
          }
        }
      }
    } catch (e) {
      // Erişim hatası - devam et
    }
  }
  
  return found;
}

function generateFieldsJson() {
  const fields = {};
  
  // Tablo alanları
  for (const field of TRAINING_FIELDS.tables) {
    fields[field.name] = {
      fieldType: 'table',
      description: field.description,
      isRequired: field.required,
    };
  }
  
  // Metin alanları
  for (const field of TRAINING_FIELDS.text) {
    fields[field.name] = {
      fieldType: field.type === 'currency' ? 'currency' : 
                  field.type === 'number' ? 'number' : 'string',
      description: field.description,
      isRequired: field.required,
    };
  }
  
  // Dizi alanları
  for (const field of TRAINING_FIELDS.arrays) {
    fields[field.name] = {
      fieldType: 'array',
      itemType: field.itemType,
      description: field.description,
      isRequired: field.required,
    };
  }
  
  return { fields };
}

function generateManifest(documents) {
  return {
    $schema: 'https://westus.api.cognitive.microsoft.com/documentintelligence/2024-11-30/schemas/trainingManifest.json',
    modelId: 'ihale-catering-v1',
    description: 'İhale Catering Teknik Şartname Custom Model',
    documents: documents.map(doc => ({
      documentPath: doc.filename,
      sourceDocument: {
        contentType: 'application/pdf',
      },
    })),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║     AZURE DOCUMENT INTELLIGENCE TRAINING DATA PREPARATION           ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  
  await ensureDirectories();
  
  // Dökümanları topla
  const supabaseDocs = await collectFromSupabase();
  const localDocs = await collectFromLocal();
  
  // Benzersiz dökümanlar
  const allDocs = [...supabaseDocs];
  for (const local of localDocs) {
    if (!allDocs.find(d => d.filename === local.filename)) {
      allDocs.push(local);
    }
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log(`📊 TOPLAM: ${allDocs.length} döküman bulundu\n`);
  
  if (allDocs.length < 5) {
    console.log('⚠️  UYARI: Custom model eğitimi için en az 5 döküman gerekiyor!');
    console.log('   Daha fazla ihale dökümanı ekleyin:');
    console.log(`   ${TRAINING_DATA_DIR}/\n`);
  }
  
  // fields.json oluştur
  const fieldsJson = generateFieldsJson();
  const fieldsPath = path.join(OUTPUT_DIR, 'fields.json');
  fs.writeFileSync(fieldsPath, JSON.stringify(fieldsJson, null, 2));
  console.log(`✅ fields.json oluşturuldu: ${fieldsPath}`);
  
  // manifest.json oluştur
  const manifest = generateManifest(allDocs);
  const manifestPath = path.join(OUTPUT_DIR, 'training-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`✅ training-manifest.json oluşturuldu: ${manifestPath}`);
  
  // Döküman listesi
  const docListPath = path.join(OUTPUT_DIR, 'document-list.json');
  fs.writeFileSync(docListPath, JSON.stringify(allDocs, null, 2));
  console.log(`✅ document-list.json oluşturuldu: ${docListPath}`);
  
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('📋 SONRAKİ ADIMLAR:\n');
  console.log('1. Dökümanları Azure Blob Storage\'a yükle:');
  console.log('   - Azure Portal > Storage Account > Containers');
  console.log(`   - "${AZURE_TRAINING_CONTAINER}" container oluştur`);
  console.log(`   - ${TRAINING_DATA_DIR}/ içindeki PDF\'leri yükle\n`);
  
  console.log('2. Document Intelligence Studio\'da etiketle:');
  console.log('   - https://documentintelligence.ai.azure.com/studio');
  console.log('   - Custom extraction models > Create new');
  console.log('   - Blob Storage container\'ı bağla');
  console.log('   - Her döküman için alanları etiketle\n');
  
  console.log('3. Eğitimi başlat ve model ID\'yi kaydet\n');
  
  console.log('4. Model ID\'yi sisteme entegre et:');
  console.log('   AZURE_DOCUMENT_AI_MODEL_ID=ihale-catering-v1');
  console.log('   AZURE_USE_CUSTOM_MODEL=true\n');
  
  // Etiketlenecek alanları göster
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('📝 ETİKETLENECEK ALANLAR:\n');
  
  console.log('TABLOLAR (kritik):');
  TRAINING_FIELDS.tables.forEach(f => {
    console.log(`  ${f.required ? '⭐' : '○'} ${f.name}: ${f.description}`);
  });
  
  console.log('\nMETİN ALANLARI:');
  TRAINING_FIELDS.text.forEach(f => {
    console.log(`  ${f.required ? '⭐' : '○'} ${f.name}: ${f.description}`);
  });
  
  console.log('\nLİSTE ALANLARI:');
  TRAINING_FIELDS.arrays.forEach(f => {
    console.log(`  ○ ${f.name}: ${f.description}`);
  });
}

main().catch(console.error);
