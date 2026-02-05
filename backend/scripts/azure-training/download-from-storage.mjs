#!/usr/bin/env node

/**
 * Download Training PDFs from Supabase Storage
 * 
 * Supabase storage'daki farklı ihalelerden teknik şartname PDF'lerini
 * training klasörüne indirir.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

const TRAINING_DIR = path.join(__dirname, 'documents');
const TARGET_COUNT = parseInt(process.argv[2]) || 15;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║     DOWNLOAD TRAINING PDFs FROM SUPABASE STORAGE                     ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');
  
  if (!fs.existsSync(TRAINING_DIR)) {
    fs.mkdirSync(TRAINING_DIR, { recursive: true });
  }
  
  // List tender folders
  const { data: tenderFolders } = await supabase.storage
    .from('tender-documents')
    .list('tenders', { limit: 100 });
  
  console.log(`📂 ${tenderFolders?.length || 0} ihale klasörü bulundu\n`);
  
  let downloaded = 0;
  const downloadedTenders = new Set();
  
  for (const folder of tenderFolders || []) {
    if (downloaded >= TARGET_COUNT) break;
    if (folder.id !== null) continue; // Skip files, only process folders
    
    const tenderId = folder.name;
    
    // Skip if already downloaded from this tender
    if (downloadedTenders.has(tenderId)) continue;
    
    // List tech_spec folder
    const { data: techFiles } = await supabase.storage
      .from('tender-documents')
      .list(`tenders/${tenderId}/tech_spec`, { limit: 20 });
    
    // Find PDFs (not duplicates like "Idari-Sartname")
    const pdfs = (techFiles || []).filter(f => {
      const name = f.name.toLowerCase();
      return name.endsWith('.pdf') && 
             !name.includes('idari') && 
             f.metadata?.size > 100000; // >100KB - gerçek döküman
    });
    
    if (pdfs.length === 0) continue;
    
    // Download first unique PDF from this tender
    const pdf = pdfs[0];
    const storagePath = `tenders/${tenderId}/tech_spec/${pdf.name}`;
    const localName = `tender_${tenderId}_teknik.pdf`;
    const localPath = path.join(TRAINING_DIR, localName);
    
    // Skip if already exists
    if (fs.existsSync(localPath)) {
      console.log(`⏭️  Tender ${tenderId}: zaten var`);
      downloadedTenders.add(tenderId);
      downloaded++;
      continue;
    }
    
    console.log(`\n${downloaded + 1}/${TARGET_COUNT}. Tender ${tenderId}`);
    console.log(`   📄 ${pdf.name}`);
    
    // Get signed URL and download
    const { data: signedData, error: signError } = await supabase.storage
      .from('tender-documents')
      .createSignedUrl(storagePath, 3600);
    
    if (signError || !signedData?.signedUrl) {
      console.log(`   ⚠️  Signed URL alınamadı`);
      continue;
    }
    
    try {
      const response = await fetch(signedData.signedUrl);
      if (!response.ok) {
        console.log(`   ⚠️  HTTP ${response.status}`);
        continue;
      }
      
      const buffer = Buffer.from(await response.arrayBuffer());
      
      // Validate PDF
      if (buffer.length < 50000) {
        console.log(`   ⚠️  Çok küçük: ${Math.round(buffer.length / 1024)} KB`);
        continue;
      }
      
      if (buffer.slice(0, 4).toString('ascii') !== '%PDF') {
        console.log(`   ⚠️  Geçerli PDF değil`);
        continue;
      }
      
      // Save
      fs.writeFileSync(localPath, buffer);
      console.log(`   ✅ Kaydedildi: ${localName} (${Math.round(buffer.length / 1024)} KB)`);
      
      downloadedTenders.add(tenderId);
      downloaded++;
      
    } catch (e) {
      console.log(`   ❌ Hata: ${e.message}`);
    }
  }
  
  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  const finalFiles = fs.readdirSync(TRAINING_DIR).filter(f => f.endsWith('.pdf'));
  console.log(`\n📊 SONUÇ: ${finalFiles.length} training PDF (${downloadedTenders.size} farklı ihale)\n`);
  
  finalFiles.forEach((f, i) => {
    const stats = fs.statSync(path.join(TRAINING_DIR, f));
    console.log(`  ${i + 1}. ${f} (${Math.round(stats.size / 1024)} KB)`);
  });
  
  if (finalFiles.length >= 5) {
    console.log('\n✅ Azure Custom Model eğitimi için yeterli döküman var!');
    console.log('\n📋 Sonraki adımlar:');
    console.log('   1. Azure Blob Storage\'a yükle');
    console.log('   2. Document Intelligence Studio\'da etiketle');
    console.log('   3. Model eğitimini başlat');
  } else {
    console.log(`\n⚠️  ${5 - finalFiles.length} döküman daha gerekli.`);
  }
}

main().catch(console.error);
