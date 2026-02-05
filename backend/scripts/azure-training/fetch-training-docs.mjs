#!/usr/bin/env node

/**
 * Azure Training Data Fetcher
 * 
 * ihalebul.com'dan ihale dökümanlarını çeker ve training klasörüne kaydeder
 * 
 * Kullanım:
 *   node fetch-training-docs.mjs --count 10
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

const TRAINING_DIR = path.join(__dirname, 'documents');

// Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ═══════════════════════════════════════════════════════════════════════════
// EKAP/ihalebul.com'dan döküman indirme
// ═══════════════════════════════════════════════════════════════════════════

const IHALEBUL_SEARCH_URL = 'https://www.ihalebul.com/tenders/search?workcategory_in=15';

/**
 * ihalebul.com API'den ihale listesi çek
 */
async function fetchTenderList(page = 1) {
  console.log(`📋 Sayfa ${page} ihaleler çekiliyor...`);
  
  // ihalebul.com direkt JSON API'si yok, HTML scrape gerekiyor
  // Alternatif: Supabase'deki mevcut dökümanları kullan
  
  const { data: docs, error } = await supabase
    .from('documents')
    .select('id, filename, original_filename, file_type, tender_id, storage_path, source_url')
    .in('file_type', ['pdf', 'application/pdf'])
    .order('created_at', { ascending: false });
  
  if (error) {
    console.log('Supabase error:', error.message);
    return [];
  }
  
  return docs || [];
}

/**
 * Supabase storage'dan döküman indir
 */
async function downloadFromSupabase(doc) {
  try {
    const storagePath = doc.storage_path || `tenders/${doc.tender_id}/${doc.filename}`;
    
    const { data: signedData, error: signError } = await supabase.storage
      .from('tender-documents')
      .createSignedUrl(storagePath, 3600);
    
    if (signError || !signedData?.signedUrl) {
      console.log(`  ⚠️  Signed URL alınamadı: ${doc.filename}`);
      return null;
    }
    
    const response = await fetch(signedData.signedUrl);
    if (!response.ok) {
      console.log(`  ⚠️  HTTP ${response.status}: ${doc.filename}`);
      return null;
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());
    
    // PDF doğrulama
    if (buffer.length < 1000) {
      console.log(`  ⚠️  Dosya çok küçük: ${doc.filename}`);
      return null;
    }
    
    const magic = buffer.slice(0, 4).toString('ascii');
    if (magic !== '%PDF') {
      console.log(`  ⚠️  PDF değil: ${doc.filename} (magic: ${magic})`);
      return null;
    }
    
    return buffer;
  } catch (e) {
    console.log(`  ❌ İndirme hatası: ${e.message}`);
    return null;
  }
}

/**
 * ihalebul.com'dan direkt URL ile indir
 */
async function downloadFromUrl(url, filename) {
  try {
    console.log(`  📥 İndiriliyor: ${url.substring(0, 60)}...`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://www.ihalebul.com/',
      },
    });
    
    if (!response.ok) {
      console.log(`  ⚠️  HTTP ${response.status}`);
      return null;
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());
    
    // PDF veya ZIP kontrol
    const magic = buffer.slice(0, 4).toString('ascii');
    if (magic !== '%PDF' && !(buffer[0] === 0x50 && buffer[1] === 0x4B)) {
      console.log(`  ⚠️  Beklenmeyen format: ${magic}`);
      return null;
    }
    
    return { buffer, isZip: buffer[0] === 0x50 && buffer[1] === 0x4B };
  } catch (e) {
    console.log(`  ❌ URL indirme hatası: ${e.message}`);
    return null;
  }
}

/**
 * Storage'daki tüm dosyaları listele
 */
async function listStorageFiles(folder = '') {
  const allFiles = [];
  
  async function listRecursive(currentPath) {
    const { data: items, error } = await supabase.storage
      .from('tender-documents')
      .list(currentPath, { limit: 1000 });
    
    if (error) {
      console.log(`Storage list error at ${currentPath}:`, error.message);
      return;
    }
    
    for (const item of items || []) {
      const fullPath = currentPath ? `${currentPath}/${item.name}` : item.name;
      
      if (item.id === null) {
        // Folder
        await listRecursive(fullPath);
      } else {
        // File
        allFiles.push({
          name: item.name,
          path: fullPath,
          size: item.metadata?.size,
          mimetype: item.metadata?.mimetype,
        });
      }
    }
  }
  
  await listRecursive(folder);
  return allFiles;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║     AZURE TRAINING DATA FETCHER                                      ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');
  
  // Training klasörü oluştur
  if (!fs.existsSync(TRAINING_DIR)) {
    fs.mkdirSync(TRAINING_DIR, { recursive: true });
  }
  
  // Mevcut training dosyaları
  const existingFiles = fs.readdirSync(TRAINING_DIR).filter(f => f.endsWith('.pdf'));
  console.log(`📁 Mevcut training dosyaları: ${existingFiles.length}\n`);
  
  // 1. Supabase storage'daki tüm dosyaları listele
  console.log('📂 Supabase Storage taranıyor...\n');
  const storageFiles = await listStorageFiles('tenders');
  
  const pdfFiles = storageFiles.filter(f => 
    f.name.toLowerCase().endsWith('.pdf') && 
    (f.name.toLowerCase().includes('teknik') || f.name.toLowerCase().includes('sartname'))
  );
  
  console.log(`  📄 ${storageFiles.length} toplam dosya`);
  console.log(`  📄 ${pdfFiles.length} teknik şartname PDF\n`);
  
  // 2. Her PDF'i indir
  let downloaded = 0;
  const targetCount = parseInt(process.argv[2]) || 10;
  
  for (const file of pdfFiles) {
    if (downloaded >= targetCount) break;
    
    // Zaten var mı?
    const localName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const localPath = path.join(TRAINING_DIR, localName);
    
    if (fs.existsSync(localPath)) {
      console.log(`  ⏭️  Zaten var: ${localName}`);
      downloaded++;
      continue;
    }
    
    console.log(`\n${downloaded + 1}/${targetCount}. ${file.name}`);
    
    // Signed URL al ve indir
    const { data: signedData } = await supabase.storage
      .from('tender-documents')
      .createSignedUrl(file.path, 3600);
    
    if (!signedData?.signedUrl) {
      console.log(`  ⚠️  Signed URL alınamadı`);
      continue;
    }
    
    const response = await fetch(signedData.signedUrl);
    if (!response.ok) {
      console.log(`  ⚠️  HTTP ${response.status}`);
      continue;
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());
    
    // PDF doğrulama
    if (buffer.length < 5000) {
      console.log(`  ⚠️  Çok küçük: ${buffer.length} bytes`);
      continue;
    }
    
    const magic = buffer.slice(0, 4).toString('ascii');
    if (magic !== '%PDF') {
      console.log(`  ⚠️  PDF değil (magic: ${magic.replace(/[^\x20-\x7E]/g, '?')})`);
      continue;
    }
    
    // Kaydet
    fs.writeFileSync(localPath, buffer);
    console.log(`  ✅ Kaydedildi: ${localName} (${Math.round(buffer.length / 1024)}KB)`);
    downloaded++;
  }
  
  // 3. Documents tablosundaki source_url'lerden indir
  if (downloaded < targetCount) {
    console.log('\n\n📋 Documents tablosundan ek dökümanlar indiriliyor...\n');
    
    const { data: docs } = await supabase
      .from('documents')
      .select('id, filename, original_filename, source_url, tender_id')
      .not('source_url', 'is', null)
      .ilike('original_filename', '%teknik%');
    
    for (const doc of docs || []) {
      if (downloaded >= targetCount) break;
      
      const filename = doc.original_filename || doc.filename;
      if (!filename.toLowerCase().includes('teknik')) continue;
      
      const localName = `tender_${doc.tender_id}_${filename}`.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const localPath = path.join(TRAINING_DIR, localName);
      
      if (fs.existsSync(localPath)) continue;
      
      console.log(`${downloaded + 1}/${targetCount}. ${filename} (source_url)`);
      
      const result = await downloadFromUrl(doc.source_url, localName);
      if (result?.buffer && !result.isZip) {
        fs.writeFileSync(localPath, result.buffer);
        console.log(`  ✅ Kaydedildi: ${localName}`);
        downloaded++;
      }
    }
  }
  
  // Sonuç
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  const finalFiles = fs.readdirSync(TRAINING_DIR).filter(f => f.endsWith('.pdf'));
  console.log(`\n📊 SONUÇ: ${finalFiles.length} training PDF hazır\n`);
  
  finalFiles.forEach((f, i) => {
    const stats = fs.statSync(path.join(TRAINING_DIR, f));
    console.log(`  ${i + 1}. ${f} (${Math.round(stats.size / 1024)}KB)`);
  });
  
  if (finalFiles.length < 5) {
    console.log('\n⚠️  Custom model eğitimi için en az 5 PDF gerekli!');
    console.log('   Daha fazla ihale dökümanı sisteme yükleyin veya');
    console.log('   admin panelden scraper çalıştırın.\n');
  } else {
    console.log('\n✅ Yeterli döküman var! Azure eğitimine başlanabilir.\n');
  }
}

main().catch(console.error);
