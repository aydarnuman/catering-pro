#!/usr/bin/env node

/**
 * Azure Training - Çeşitli Kurum Dökümanları Toplu İndirici
 * 
 * Mevcut backend API'yi kullanarak farklı kurum kategorilerinden
 * ihale dökümanlarını toplu olarak indirir.
 * 
 * Akış:
 *   1. DB'den ihaleleri çek ve kurum tipine göre kategorize et
 *   2. Her kategoriden dengeli seçim yap
 *   3. Backend API'yi çağırarak dökümanları Supabase Storage'a indir
 *      (ZIP açma, PDF doğrulama, deduplication hepsi backend tarafında yapılır)
 *   4. Supabase Storage'dan training klasörüne çek (Azure eğitimi için)
 * 
 * ÖNEMLİ: Backend çalışıyor olmalı (npm run dev veya production)
 * 
 * Kullanım:
 *   node fetch-diverse-training.mjs                     # Varsayılan: her kategoriden 3
 *   node fetch-diverse-training.mjs --per-category 5    # Her kategoriden 5
 *   node fetch-diverse-training.mjs --total 30          # Toplam 30 döküman
 *   node fetch-diverse-training.mjs --category hastane  # Sadece hastane
 *   node fetch-diverse-training.mjs --dry-run           # Sadece plan göster
 *   node fetch-diverse-training.mjs --fetch-local       # Storage'dan locale çek
 *   node fetch-diverse-training.mjs --upload-azure      # Locale çektikten sonra Azure Blob'a yükle
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════════════

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const TRAINING_DIR = path.join(__dirname, 'documents');
const DELAY_BETWEEN_TENDERS = 3000; // Backend'e yük binmesin

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ═══════════════════════════════════════════════════════════════════════════
// KURUM KATEGORİZASYONU
// ═══════════════════════════════════════════════════════════════════════════

const CATEGORIES = {
  hastane: {
    label: 'Hastane / Sağlık',
    emoji: '🏥',
    keywords: [
      'hastane', 'sağlık', 'tıp fakültesi', 'tıp merkezi',
      'sağlık müdürlüğü', 'başhekimliği', 'tabip',
      'kızılay', 'ağız diş', 'toplum sağlığı',
    ],
  },
  universite: {
    label: 'Üniversite',
    emoji: '🎓',
    keywords: [
      'üniversite', 'rektörlüğü', 'fakülte', 'yüksekokul',
      'enstitü', 'sks daire', 'sağlık kültür spor',
      'akademi', 'meslek yüksek', 'polis akademisi',
    ],
  },
  okul: {
    label: 'Okul / Milli Eğitim',
    emoji: '🏫',
    keywords: [
      'milli eğitim', 'ilçe milli', 'il milli eğitim',
      'okul', 'lise', 'ilkokul', 'ortaokul',
      'imam hatip', 'meslek lisesi', 'öğretmenevi',
    ],
  },
  askeri: {
    label: 'Askeri Birimler',
    emoji: '⚔️',
    keywords: [
      'komutanlığı', 'tugay', 'alay', 'tabur',
      'jandarma', 'sahil güvenlik', 'kantin',
      'kışla', 'ordu', 'hava kuvvet', 'deniz kuvvet',
      'savunma', 'genelkurmay', 'asker',
    ],
  },
  belediye: {
    label: 'Belediye',
    emoji: '🏛️',
    keywords: [
      'belediye', 'büyükşehir', 'ilçe belediye',
    ],
  },
  sosyal: {
    label: 'Sosyal Hizmetler',
    emoji: '🤝',
    keywords: [
      'sosyal hizmet', 'sosyal yardım', 'aile ve sosyal',
      'göç idaresi', 'huzurevi', 'yurt müdürlüğü',
      'bakım merkezi', 'gençlik ve spor', 'vakıf',
      'kredi yurtlar', 'çocuk esirgeme',
    ],
  },
  cezaevi: {
    label: 'Ceza İnfaz / Adalet',
    emoji: '⚖️',
    keywords: [
      'ceza infaz', 'cezaevi', 'tutukevi', 'adalet', 'adliye',
    ],
  },
};

function categorize(orgName) {
  if (!orgName) return 'diger';
  const lower = orgName.toLowerCase();
  for (const [cat, conf] of Object.entries(CATEGORIES)) {
    if (conf.keywords.some(kw => lower.includes(kw))) return cat;
  }
  return 'diger';
}

// ═══════════════════════════════════════════════════════════════════════════
// CLI ARGUMENTS
// ═══════════════════════════════════════════════════════════════════════════

function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    perCategory: 3,
    total: null,
    category: null,
    dryRun: false,
    fetchLocal: false,
    uploadAzure: false,
  };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--per-category': config.perCategory = parseInt(args[++i]) || 3; break;
      case '--total': config.total = parseInt(args[++i]) || 30; break;
      case '--category': config.category = args[++i]; break;
      case '--dry-run': config.dryRun = true; break;
      case '--fetch-local': config.fetchLocal = true; break;
      case '--upload-azure': config.uploadAzure = true; config.fetchLocal = true; break;
      case '--help':
        console.log(`
Kullanım: node fetch-diverse-training.mjs [options]

ADIM 1 - Dökümanları Supabase'e indir (backend API üzerinden):
  --per-category N   Her kategoriden N ihale (varsayılan: 3)
  --total N          Toplam N ihale
  --category NAME    Sadece belirli kategori
  --dry-run          Sadece plan göster

ADIM 2 - Supabase'den locale/Azure'a çek:
  --fetch-local      Supabase Storage'dan training/ klasörüne indir
  --upload-azure     Locale çek + Azure Blob Storage'a yükle

Örnekler:
  node fetch-diverse-training.mjs --dry-run              # Planı gör
  node fetch-diverse-training.mjs --per-category 5       # Her kategoriden 5 ihale indir
  node fetch-diverse-training.mjs --fetch-local          # Supabase'den PDF'leri locale çek
  node fetch-diverse-training.mjs --upload-azure          # Locale çek + Azure'a yükle
`);
        process.exit(0);
    }
  }
  return config;
}

// ═══════════════════════════════════════════════════════════════════════════
// ADIM 1: Backend API ile toplu indirme
// ═══════════════════════════════════════════════════════════════════════════

async function downloadViaBulkAPI(pool, config) {
  // 1. İhaleleri çek - document_links olan tüm ihaleler (sadece /download/ URL değil)
  const { rows: tenders } = await pool.query(`
    SELECT id, title, organization_name, city,
           document_links::text LIKE '%/download/%' as has_download_url
    FROM tenders
    WHERE document_links IS NOT NULL 
      AND document_links != '{}'
      AND document_links::text != 'null'
    ORDER BY 
      document_links::text LIKE '%/download/%' DESC,
      tender_date DESC NULLS LAST
  `);

  console.log(`  📄 ${tenders.length} ihale (document_links olan)\n`);

  // 2. Kategorize et
  const categorized = {};
  for (const t of tenders) {
    const cat = categorize(t.organization_name);
    if (config.category && cat !== config.category) continue;
    if (!categorized[cat]) categorized[cat] = [];
    categorized[cat].push(t);
  }

  // 3. Plan göster
  const cats = Object.entries(categorized).sort((a, b) => b[1].length - a[1].length);
  
  console.log('📊 KATEGORİ DAĞILIMI:');
  console.log('─'.repeat(65));
  let totalAvailable = 0;
  for (const [cat, items] of cats) {
    const c = CATEGORIES[cat] || { label: 'Diğer', emoji: '📋' };
    const downloadable = items.filter(t => t.has_download_url).length;
    const bar = '█'.repeat(Math.min(Math.round(items.length / 3), 25));
    console.log(`  ${c.emoji} ${c.label.padEnd(25)} ${bar} ${items.length} (${downloadable} direkt link)`);
    totalAvailable += items.length;
  }
  console.log('─'.repeat(65));
  console.log(`  TOPLAM: ${totalAvailable}\n`);

  // 4. Her kategoriden seçim
  const perCat = config.total 
    ? Math.ceil(config.total / cats.length) 
    : config.perCategory;

  const selected = [];
  for (const [cat, items] of cats) {
    // Önce direkt download linki olanları, sonra diğerlerini al
    const sorted = [...items].sort((a, b) => (b.has_download_url ? 1 : 0) - (a.has_download_url ? 1 : 0));
    const pick = sorted.slice(0, Math.min(perCat, sorted.length));
    for (const t of pick) {
      selected.push({ ...t, category: cat });
    }
  }

  console.log(`📥 İNDİRME PLANI: ${selected.length} ihale\n`);
  for (const [cat] of cats) {
    const c = CATEGORIES[cat] || { label: 'Diğer', emoji: '📋' };
    const catCount = selected.filter(s => s.category === cat).length;
    if (catCount > 0) {
      console.log(`  ${c.emoji} ${c.label.padEnd(25)} ${catCount} ihale`);
    }
  }

  if (config.dryRun) {
    console.log('\n🔍 DRY RUN - sadece plan gösterildi.\n');
    console.log('Seçilen ihaleler:');
    for (const s of selected) {
      const c = CATEGORIES[s.category] || { emoji: '📋' };
      console.log(`  ${c.emoji} [${s.id}] ${(s.organization_name || '').substring(0, 55)} ${s.has_download_url ? '✅' : '⏳'}`);
    }
    return;
  }

  // 5. Backend çalışıyor mu kontrol
  console.log(`\n🔗 Backend kontrol ediliyor (${BACKEND_URL})...`);
  try {
    const health = await fetch(`${BACKEND_URL}/health`, { signal: AbortSignal.timeout(5000) });
    if (!health.ok) throw new Error(`HTTP ${health.status}`);
    console.log('  ✅ Backend çalışıyor\n');
  } catch (e) {
    console.log(`  ❌ Backend'e erişilemiyor: ${e.message}`);
    console.log(`  Backend'i başlatın: cd backend && npm run dev\n`);
    process.exit(1);
  }

  // 6. Her ihale için download-documents endpoint'ini çağır
  let success = 0, failed = 0, skipped = 0;

  for (let i = 0; i < selected.length; i++) {
    const tender = selected[i];
    const cat = CATEGORIES[tender.category] || { emoji: '📋', label: 'Diğer' };
    
    console.log(`\n[${i + 1}/${selected.length}] ${cat.emoji} ${(tender.organization_name || 'Bilinmeyen').substring(0, 50)}`);
    console.log(`  İhale #${tender.id}: ${(tender.title || '').substring(0, 55)}`);

    try {
      const resp = await fetch(`${BACKEND_URL}/api/tender-docs/${tender.id}/download-documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(120000), // 2 dakika timeout
      });

      const result = await resp.json();

      if (result.success) {
        const data = result.data || {};
        
        // Merkez Scraper response format:
        // { downloaded: [{docType, filesCount, ...}], contentScraped: [...], failed: [...], skipped: [...] }
        const downloadedItems = data.downloaded || [];
        const contentScrapedItems = data.contentScraped || [];
        const skippedItems = data.skipped || [];
        const failedItems = (data.failed || []).filter(f => f.docType !== 'probable_participants'); // participants hata değil
        const alreadyCount = skippedItems.filter(s => s.reason === 'already_downloaded').length;

        const totalNewFiles = downloadedItems.reduce((sum, d) => sum + (d.filesCount || 1), 0);
        const totalContentScraped = contentScrapedItems.length;

        if (totalNewFiles > 0) {
          const totalSize = downloadedItems.reduce((sum, d) => sum + (d.totalSize || 0), 0);
          const sizeKB = Math.round(totalSize / 1024);
          console.log(`  ✅ ${totalNewFiles} dosya indirildi${sizeKB > 0 ? ` (${sizeKB} KB)` : ''}`);
          for (const d of downloadedItems) {
            console.log(`     📄 ${d.docType}: ${d.filesCount || 1} dosya`);
          }
          if (totalContentScraped > 0) {
            console.log(`     📝 +${totalContentScraped} içerik scrape edildi`);
          }
          success++;
        } else if (totalContentScraped > 0) {
          console.log(`  📝 ${totalContentScraped} içerik scrape edildi (dosya yok)`);
          for (const c of contentScrapedItems) {
            console.log(`     📝 ${c.docType}: ${c.format} (${c.size} ${c.format === 'json_table' ? 'satır' : 'chars'})`);
          }
          success++;
        } else if (alreadyCount > 0) {
          console.log(`  ⏭️  Zaten indirilmiş (${alreadyCount} döküman tipi)`);
          skipped++;
          success++; // Zaten indirilmiş = başarılı sayılır
        } else if (failedItems.length > 0) {
          console.log(`  ❌ İndirme başarısız: ${failedItems.map(f => f.docType + ': ' + (f.error || '').substring(0, 50)).join('; ')}`);
          failed++;
        } else {
          console.log(`  ⚠️  Döküman linki yok veya indirilebilir değil`);
          skipped++;
        }
      } else {
        console.log(`  ❌ API Hata: ${result.error || 'Bilinmeyen hata'}`);
        failed++;
      }
    } catch (e) {
      console.log(`  ❌ Bağlantı hatası: ${e.message}`);
      failed++;
    }

    // Rate limiting
    if (i < selected.length - 1) {
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_TENDERS));
    }
  }

  // 7. Sonuç
  console.log(`\n${'═'.repeat(65)}`);
  console.log('📊 ADIM 1 SONUÇ:');
  console.log(`  ✅ Başarılı: ${success}`);
  console.log(`  ⏭️  Zaten mevcut: ${skipped}`);
  console.log(`  ❌ Hatalı: ${failed}`);
  
  // DB'den güncel döküman sayısı
  const { rows: [{ totalDocs }] } = await pool.query("SELECT COUNT(*) as \"totalDocs\" FROM documents WHERE source_type = 'download'");
  const { rows: [{ techSpecs }] } = await pool.query("SELECT COUNT(*) as \"techSpecs\" FROM documents WHERE doc_type = 'tech_spec' AND storage_path IS NOT NULL");
  console.log(`\n  📁 Supabase'deki toplam indirilen döküman: ${totalDocs}`);
  console.log(`  📄 Teknik Şartname (eğitim için): ${techSpecs}`);
  console.log(`\n  💡 Sonraki adım: node fetch-diverse-training.mjs --fetch-local`);
}

// ═══════════════════════════════════════════════════════════════════════════
// ADIM 2: Supabase Storage'dan locale çekme
// ═══════════════════════════════════════════════════════════════════════════

async function fetchFromStorageToLocal(pool, _config) {
  console.log('📥 Supabase Storage\'dan training dökümanları çekiliyor...\n');

  // Training klasörü hazırla
  if (!fs.existsSync(TRAINING_DIR)) {
    fs.mkdirSync(TRAINING_DIR, { recursive: true });
  }

  const existingFiles = new Set(
    fs.readdirSync(TRAINING_DIR).filter(f => f.endsWith('.pdf'))
  );
  console.log(`  📁 Mevcut lokal dosya: ${existingFiles.size}\n`);

  // DB'den indirilen dökümanları çek (sadece PDF ve teknik şartname ağırlıklı)
  const { rows: docs } = await pool.query(`
    SELECT d.id, d.tender_id, d.filename, d.original_filename, d.storage_path, 
           d.doc_type, d.file_size,
           t.organization_name
    FROM documents d
    JOIN tenders t ON d.tender_id = t.id
    WHERE d.source_type = 'download'
      AND d.storage_path IS NOT NULL
      AND (d.file_type = 'pdf' OR d.filename LIKE '%.pdf')
    ORDER BY 
      CASE d.doc_type 
        WHEN 'tech_spec' THEN 1 
        WHEN 'admin_spec' THEN 2 
        ELSE 3 
      END,
      d.created_at DESC
  `);

  console.log(`  📄 Supabase'de ${docs.length} PDF döküman bulundu\n`);

  if (docs.length === 0) {
    console.log('  ⚠️  Önce ADIM 1\'i çalıştırın: node fetch-diverse-training.mjs --per-category 5\n');
    return [];
  }

  // Kategorize ve filtrele
  const downloadedFiles = [];
  let fetched = 0, skippedExisting = 0, errors = 0;

  for (const doc of docs) {
    const cat = categorize(doc.organization_name);
    
    // Hedef dosya adı: kategori_ihaleId_docType_orijinalAd.pdf
    const safeName = (doc.original_filename || doc.filename || 'document.pdf')
      .replace(/[^a-zA-Z0-9_.-]/g, '_')
      .substring(0, 60);
    const localFilename = `${cat}_t${doc.tender_id}_${doc.doc_type || 'other'}_${safeName}`;
    const localPath = path.join(TRAINING_DIR, localFilename);

    // Zaten var mı?
    if (existingFiles.has(localFilename) || fs.existsSync(localPath)) {
      skippedExisting++;
      downloadedFiles.push({ filename: localFilename, category: cat, tenderId: doc.tender_id, docType: doc.doc_type, organization: doc.organization_name });
      continue;
    }

    try {
      // Supabase Storage'dan indir
      const { data: signedData, error: signError } = await supabase.storage
        .from('tender-documents')
        .createSignedUrl(doc.storage_path, 3600);

      if (signError || !signedData?.signedUrl) {
        console.log(`  ⚠️  Signed URL alınamadı: ${doc.storage_path}`);
        errors++;
        continue;
      }

      const response = await fetch(signedData.signedUrl);
      if (!response.ok) {
        console.log(`  ⚠️  HTTP ${response.status}: ${doc.storage_path}`);
        errors++;
        continue;
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      // PDF doğrulama
      if (buffer.length < 3000) {
        console.log(`  ⚠️  Çok küçük (${buffer.length} byte): ${safeName}`);
        errors++;
        continue;
      }

      if (buffer.slice(0, 4).toString('ascii') !== '%PDF') {
        console.log(`  ⚠️  PDF değil: ${safeName}`);
        errors++;
        continue;
      }

      fs.writeFileSync(localPath, buffer);
      fetched++;
      downloadedFiles.push({ filename: localFilename, category: cat, tenderId: doc.tender_id, docType: doc.doc_type, organization: doc.organization_name, size: buffer.length });

      const catConf = CATEGORIES[cat] || { emoji: '📋', label: 'Diğer' };
      console.log(`  ${catConf.emoji} [${fetched}] ${localFilename.substring(0, 55)} (${Math.round(buffer.length / 1024)} KB)`);
    } catch (e) {
      console.log(`  ❌ ${safeName}: ${e.message}`);
      errors++;
    }
  }

  // Kategori dağılımı
  console.log(`\n${'═'.repeat(65)}`);
  console.log('📊 ADIM 2 SONUÇ:');
  console.log(`  📥 Yeni indirilen: ${fetched}`);
  console.log(`  ⏭️  Zaten mevcut: ${skippedExisting}`);
  console.log(`  ❌ Hata: ${errors}`);
  
  const finalFiles = fs.readdirSync(TRAINING_DIR).filter(f => f.endsWith('.pdf'));
  console.log(`\n  📁 Toplam training PDF: ${finalFiles.length}`);

  // Kategori dağılımı
  console.log('\n  📊 KATEGORİ DAĞILIMI:');
  const catCounts = {};
  for (const f of downloadedFiles) {
    catCounts[f.category] = (catCounts[f.category] || 0) + 1;
  }
  for (const [cat, count] of Object.entries(catCounts).sort((a, b) => b[1] - a[1])) {
    const c = CATEGORIES[cat] || { emoji: '📋', label: 'Diğer' };
    console.log(`     ${c.emoji} ${c.label.padEnd(25)} ${'█'.repeat(count)} ${count}`);
  }

  // Yeterlilik kontrolü
  if (finalFiles.length >= 20) {
    console.log('\n  ✅ İdeal! 20+ döküman - yüksek doğruluklu model eğitilebilir.');
  } else if (finalFiles.length >= 10) {
    console.log('\n  ✅ İyi! 10+ döküman - kabul edilebilir doğruluk.');
  } else if (finalFiles.length >= 5) {
    console.log(`\n  ⚠️  Minimum. ${20 - finalFiles.length} döküman daha önerilir.`);
  } else {
    console.log(`\n  ❌ Yetersiz! En az ${5 - finalFiles.length} döküman daha gerekli.`);
  }

  return downloadedFiles;
}

// ═══════════════════════════════════════════════════════════════════════════
// ADIM 3: Azure Blob Storage'a yükleme
// ═══════════════════════════════════════════════════════════════════════════

async function uploadToAzureBlob(downloadedFiles) {
  console.log('\n📤 Azure Blob Storage\'a yükleniyor...\n');

  let BlobServiceClient;
  try {
    const module = await import('@azure/storage-blob');
    BlobServiceClient = module.BlobServiceClient;
  } catch {
    console.log('❌ @azure/storage-blob paketi yüklü değil: npm install @azure/storage-blob');
    return;
  }

  const connStr = 'DefaultEndpointsProtocol=https;AccountName=cateringtr;AccountKey=c1iGE5YMj27VzJpZt4Kj9cRprzIB5j0h1VefqBXt312zcpUW+FC4Bpb/WvQdWfHevFoEoWZgxUmp+ASt+ipGOw==;EndpointSuffix=core.windows.net';
  const containerName = 'ihale-training';

  const blobService = BlobServiceClient.fromConnectionString(connStr);
  const containerClient = blobService.getContainerClient(containerName);

  if (!(await containerClient.exists())) {
    await containerClient.create({ access: 'blob' });
    console.log('  📦 Container oluşturuldu:', containerName);
  }

  let uploaded = 0, skipped = 0;

  for (const file of downloadedFiles) {
    const filePath = path.join(TRAINING_DIR, file.filename);
    if (!fs.existsSync(filePath)) continue;

    const blobClient = containerClient.getBlockBlobClient(file.filename);
    if (await blobClient.exists()) { skipped++; continue; }

    const buffer = fs.readFileSync(filePath);
    await blobClient.upload(buffer, buffer.length, {
      blobHTTPHeaders: { blobContentType: 'application/pdf' },
      metadata: { category: file.category, tenderId: String(file.tenderId) },
    });

    uploaded++;
    process.stdout.write(`\r  ☁️  Yüklendi: ${uploaded}`);
  }

  console.log(`\n  ✅ ${uploaded} dosya yüklendi, ${skipped} zaten mevcuttu`);
  console.log(`\n  💡 Sonraki adım: node smart-label-v4.mjs (otomatik etiketleme)`);
  console.log(`  💡 Veya: node train-model.mjs (etiketleme + eğitim)`);
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  const config = parseArgs();

  console.log('╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║     AZURE TRAINING - ÇEŞİTLİ KURUM DÖKÜMANLARI İNDİRİCİ                ║');
  console.log('║     Mevcut backend pipeline\'ını kullanarak toplu döküman toplar          ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝\n');

  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    if (config.fetchLocal) {
      // ADIM 2 (ve opsiyonel ADIM 3)
      const files = await fetchFromStorageToLocal(pool, config);
      if (config.uploadAzure && files.length > 0) {
        await uploadToAzureBlob(files);
      }
    } else {
      // ADIM 1: Backend API ile toplu indirme
      await downloadViaBulkAPI(pool, config);
    }
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('\n❌ HATA:', err.message);
  process.exit(1);
});
