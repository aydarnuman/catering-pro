#!/usr/bin/env node
/**
 * Azure Document Intelligence Training Data Export Script
 * 
 * Bu script, Supabase'deki en karmaşık ihale dökümanlarını seçer ve
 * Azure Blob Storage'a training data olarak export eder.
 * 
 * Kullanım:
 *   node scripts/export-training-data.mjs [options]
 * 
 * Options:
 *   --count=N       Export edilecek döküman sayısı (default: 3)
 *   --output=DIR    Lokal export dizini (default: ./training-data)
 *   --upload        Azure Blob Storage'a upload et (NOT IMPLEMENTED YET)
 *   --dry-run       Sadece seçilen dökümanları listele, indirme
 * 
 * Seçim Kriterleri:
 *   1. PDF dosyası olmalı (file_type = 'pdf')
 *   2. Teknik şartname veya gramaj içermeli (tech_spec, goods_list)
 *   3. Boyut > 500KB (karmaşıklık göstergesi)
 *   4. Farklı kurumlardan (çeşitlilik)
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import https from 'https';
import path from 'path';
import { config } from 'dotenv';

config();

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_COUNT = 3;
const DEFAULT_OUTPUT_DIR = './training-data';
const MIN_FILE_SIZE = 500 * 1024; // 500KB minimum

// Parse command line args
const args = process.argv.slice(2);
const options = {
  count: DEFAULT_COUNT,
  output: DEFAULT_OUTPUT_DIR,
  upload: false,
  dryRun: false,
};

for (const arg of args) {
  if (arg.startsWith('--count=')) {
    options.count = parseInt(arg.split('=')[1]) || DEFAULT_COUNT;
  } else if (arg.startsWith('--output=')) {
    options.output = arg.split('=')[1];
  } else if (arg === '--upload') {
    options.upload = true;
  } else if (arg === '--dry-run') {
    options.dryRun = true;
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
Azure Document Intelligence Training Data Export

Kullanım:
  node scripts/export-training-data.mjs [options]

Options:
  --count=N       Export edilecek döküman sayısı (default: ${DEFAULT_COUNT})
  --output=DIR    Lokal export dizini (default: ${DEFAULT_OUTPUT_DIR})
  --upload        Azure Blob Storage'a upload et
  --dry-run       Sadece seçilen dökümanları listele

Örnekler:
  node scripts/export-training-data.mjs --count=5 --dry-run
  node scripts/export-training-data.mjs --output=./my-training-data
`);
    process.exit(0);
  }
}

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ═══════════════════════════════════════════════════════════════════════════
// MAIN FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     AZURE TRAINING DATA EXPORT                               ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Options:`);
  console.log(`  Count: ${options.count}`);
  console.log(`  Output: ${options.output}`);
  console.log(`  Dry Run: ${options.dryRun}`);
  console.log('');

  // Step 1: Find best documents for training
  console.log('▶ Step 1: En uygun dökümanları buluyorum...');
  const candidates = await findBestDocuments();

  if (candidates.length === 0) {
    console.log('❌ Uygun döküman bulunamadı!');
    process.exit(1);
  }

  console.log(`✓ ${candidates.length} aday döküman bulundu`);
  console.log('');

  // Step 2: Score and select top N
  console.log('▶ Step 2: Dökümanları puanlıyorum...');
  const selected = await scoreAndSelect(candidates, options.count);

  console.log('');
  console.log('═══ SEÇİLEN DÖKÜMANLAR ═══');
  selected.forEach((doc, i) => {
    console.log(`${i + 1}. ${doc.original_filename}`);
    console.log(`   Tender ID: ${doc.tender_id}`);
    console.log(`   Doc Type: ${doc.doc_type}`);
    console.log(`   Size: ${(doc.file_size / 1024).toFixed(1)} KB`);
    console.log(`   Score: ${doc.score}`);
    console.log(`   Path: ${doc.storage_path || doc.file_path}`);
    console.log('');
  });

  if (options.dryRun) {
    console.log('Dry run mode - indirme yapılmadı.');
    return;
  }

  // Step 3: Download selected documents
  console.log('▶ Step 3: Dökümanları indiriyorum...');
  
  // Create output directory
  const outputDir = path.resolve(options.output);
  const docsDir = path.join(outputDir, 'documents');
  const manifestDir = path.join(outputDir, 'manifests');
  
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }
  if (!fs.existsSync(manifestDir)) {
    fs.mkdirSync(manifestDir, { recursive: true });
  }

  const downloadedDocs = [];

  for (const doc of selected) {
    try {
      const localPath = await downloadDocument(doc, docsDir);
      downloadedDocs.push({
        ...doc,
        localPath,
        localFilename: path.basename(localPath),
      });
      console.log(`   ✓ ${doc.original_filename}`);
    } catch (error) {
      console.log(`   ✗ ${doc.original_filename}: ${error.message}`);
    }
  }

  // Step 4: Create manifest file
  console.log('');
  console.log('▶ Step 4: Manifest dosyası oluşturuyorum...');

  const manifest = {
    version: '1.0',
    created_at: new Date().toISOString(),
    document_count: downloadedDocs.length,
    model_id: 'ihale-teknik-sartname',
    documents: downloadedDocs.map(doc => ({
      filename: doc.localFilename,
      original_filename: doc.original_filename,
      tender_id: doc.tender_id,
      doc_type: doc.doc_type,
      file_size: doc.file_size,
      score: doc.score,
    })),
    fields_to_label: [
      { name: 'gramaj_tablosu', type: 'table', priority: 'high', description: 'Gıda gramajları tablosu' },
      { name: 'personel_tablosu', type: 'table', priority: 'high', description: 'Personel listesi tablosu' },
      { name: 'ogun_turleri', type: 'array', priority: 'high', description: 'Öğün türleri ve miktarları' },
      { name: 'ihale_tarihi', type: 'date', priority: 'medium', description: 'İhale tarihi' },
      { name: 'son_teklif_tarihi', type: 'date', priority: 'medium', description: 'Son teklif tarihi' },
      { name: 'yaklasik_maliyet', type: 'currency', priority: 'medium', description: 'Yaklaşık maliyet' },
      { name: 'kurum_adi', type: 'string', priority: 'medium', description: 'Kurum adı' },
      { name: 'ihale_kayit_no', type: 'string', priority: 'medium', description: 'IKN' },
      { name: 'ceza_kosullari', type: 'array', priority: 'low', description: 'Ceza maddeleri' },
    ],
    labeling_instructions: [
      'Her döküman için TÜM alanları işaretleyin, boş alanları atlayın',
      'Tablolar için önce başlık satırını, sonra veri satırlarını seçin',
      'Gramaj değerlerinde sadece sayı ve birimi seçin (örn: "150 g")',
      'Tutarlılık önemli: aynı alan için hep aynı yeri işaretleyin',
    ],
  };

  const manifestPath = path.join(manifestDir, 'training-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`✓ Manifest: ${manifestPath}`);

  // Summary
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                    EXPORT TAMAMLANDI');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`📁 Export dizini: ${outputDir}`);
  console.log(`📄 Döküman sayısı: ${downloadedDocs.length}`);
  console.log(`📋 Manifest: ${manifestPath}`);
  console.log('');
  console.log('Sonraki adımlar:');
  console.log('1. Azure Blob Storage\'a "training-data" container oluşturun');
  console.log('2. Bu dizini Azure Blob\'a upload edin');
  console.log('3. Document Intelligence Studio\'da model eğitimini başlatın');
  console.log('');
}

// ═══════════════════════════════════════════════════════════════════════════
// DOCUMENT SELECTION
// ═══════════════════════════════════════════════════════════════════════════

async function findBestDocuments() {
  // Query documents with good characteristics for training
  const { data, error } = await supabase
    .from('documents')
    .select('id, tender_id, original_filename, file_path, storage_path, storage_url, file_type, file_size, doc_type, source_type')
    .or('file_type.eq.pdf,file_type.eq..pdf')
    .in('doc_type', ['tech_spec', 'goods_list', 'admin_spec'])
    .not('storage_url', 'is', null)
    .gt('file_size', MIN_FILE_SIZE)
    .order('file_size', { ascending: false })
    .limit(50);

  if (error) {
    console.error('DB query error:', error.message);
    return [];
  }

  return data || [];
}

async function scoreAndSelect(candidates, count) {
  // Score each document
  const scored = candidates.map(doc => {
    let score = 0;

    // Bigger files are likely more complex
    if (doc.file_size > 1000000) score += 3; // > 1MB
    else if (doc.file_size > 500000) score += 2; // > 500KB
    else score += 1;

    // Prefer tech_spec and goods_list (more tables)
    if (doc.doc_type === 'tech_spec') score += 3;
    if (doc.doc_type === 'goods_list') score += 2;
    if (doc.doc_type === 'admin_spec') score += 1;

    // Prefer files with "gramaj" or "teknik" in name
    const name = doc.original_filename.toLowerCase();
    if (name.includes('gramaj')) score += 2;
    if (name.includes('teknik')) score += 1;
    if (name.includes('şartname')) score += 1;

    return { ...doc, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Select top N from different tenders (diversity)
  const selected = [];
  const usedTenders = new Set();

  for (const doc of scored) {
    if (selected.length >= count) break;

    // Prefer documents from different tenders
    if (!usedTenders.has(doc.tender_id) || selected.length < count - 1) {
      selected.push(doc);
      usedTenders.add(doc.tender_id);
    }
  }

  // If not enough, add more from same tenders
  if (selected.length < count) {
    for (const doc of scored) {
      if (selected.length >= count) break;
      if (!selected.find(s => s.id === doc.id)) {
        selected.push(doc);
      }
    }
  }

  return selected;
}

// ═══════════════════════════════════════════════════════════════════════════
// DOWNLOAD
// ═══════════════════════════════════════════════════════════════════════════

async function downloadDocument(doc, outputDir) {
  // Get signed URL from Supabase
  const storagePath = doc.storage_path || extractStoragePath(doc.storage_url);

  if (!storagePath) {
    throw new Error('Storage path not found');
  }

  const { data: urlData, error: urlError } = await supabase.storage
    .from('tender-documents')
    .createSignedUrl(storagePath, 3600);

  if (urlError || !urlData?.signedUrl) {
    throw new Error(`Signed URL error: ${urlError?.message || 'No URL'}`);
  }

  // Create safe filename
  const safeFilename = `tender_${doc.tender_id}_${doc.doc_type}_${doc.id}.pdf`;
  const outputPath = path.join(outputDir, safeFilename);

  // Download file
  await downloadFile(urlData.signedUrl, outputPath);

  return outputPath;
}

function extractStoragePath(url) {
  if (!url) return null;
  
  // Extract path from Supabase storage URL
  // Format: https://xxx.supabase.co/storage/v1/object/public/bucket/path
  const match = url.match(/\/storage\/v1\/object\/(?:public|sign)\/[^/]+\/(.+)/);
  return match ? match[1] : null;
}

function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);

    const doRequest = (targetUrl, redirectCount = 0) => {
      if (redirectCount > 5) {
        reject(new Error('Too many redirects'));
        return;
      }

      const protocol = targetUrl.startsWith('https') ? https : require('http');

      protocol.get(targetUrl, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            doRequest(redirectUrl, redirectCount + 1);
            return;
          }
        }

        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (err) => {
        fs.unlink(outputPath, () => {});
        reject(err);
      });
    };

    doRequest(url);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// RUN
// ═══════════════════════════════════════════════════════════════════════════

main().catch(error => {
  console.error('Export failed:', error.message);
  process.exit(1);
});
