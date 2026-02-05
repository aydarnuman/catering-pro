#!/usr/bin/env node

/**
 * Download Training Documents from Tenders
 * 
 * Tenders tablosundaki document_links'lerden teknik şartname PDF'lerini indirir
 * ve training klasörüne kaydeder.
 * 
 * Akış:
 * 1. tenders tablosundan document_links çek
 * 2. tech_spec URL'lerinden dökümanları indir
 * 3. ZIP ise aç, PDF'leri çıkar
 * 4. Training klasörüne kaydet
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import AdmZip from 'adm-zip';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

const TRAINING_DIR = path.join(__dirname, 'documents');
const TARGET_COUNT = parseInt(process.argv[2]) || 10;

// Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Download helper
async function downloadFile(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://www.ihalebul.com/',
        'Accept': '*/*',
      },
      timeout: 60000,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return Buffer.from(await response.arrayBuffer());
  } catch (e) {
    throw new Error(`Download failed: ${e.message}`);
  }
}

// Detect file type from buffer
function detectFileType(buffer) {
  if (buffer.length < 4) return null;
  
  const magic = buffer.slice(0, 4);
  
  // PDF
  if (magic.toString('ascii') === '%PDF') return 'pdf';
  
  // ZIP (PK..)
  if (magic[0] === 0x50 && magic[1] === 0x4B) return 'zip';
  
  // RAR
  if (magic[0] === 0x52 && magic[1] === 0x61 && magic[2] === 0x72) return 'rar';
  
  // DOC (OLE)
  if (magic[0] === 0xD0 && magic[1] === 0xCF) return 'doc';
  
  // DOCX (also ZIP)
  if (magic[0] === 0x50 && magic[1] === 0x4B && magic[2] === 0x03) {
    // Check for docx signature inside
    try {
      const zip = new AdmZip(buffer);
      if (zip.getEntry('[Content_Types].xml')) return 'docx';
    } catch (e) {}
    return 'zip';
  }
  
  return null;
}

// Extract PDFs from ZIP
function extractPdfsFromZip(buffer) {
  const pdfs = [];
  
  try {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();
    
    for (const entry of entries) {
      const name = entry.entryName.toLowerCase();
      
      // Teknik şartname PDF'lerini bul
      if (name.endsWith('.pdf') && (name.includes('teknik') || name.includes('sartname'))) {
        const data = entry.getData();
        
        // PDF doğrulama
        if (data.slice(0, 4).toString('ascii') === '%PDF') {
          pdfs.push({
            name: path.basename(entry.entryName),
            buffer: data,
          });
        }
      }
    }
  } catch (e) {
    console.log(`    ⚠️  ZIP açma hatası: ${e.message}`);
  }
  
  return pdfs;
}

// Main
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║     DOWNLOAD TRAINING DOCUMENTS FROM TENDERS                         ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');
  
  // Ensure directory exists
  if (!fs.existsSync(TRAINING_DIR)) {
    fs.mkdirSync(TRAINING_DIR, { recursive: true });
  }
  
  // Get existing files
  const existingFiles = fs.readdirSync(TRAINING_DIR).filter(f => f.endsWith('.pdf'));
  console.log(`📁 Mevcut training PDF: ${existingFiles.length}\n`);
  
  // Get tenders with tech_spec links
  console.log('📋 Tenders tablosundan döküman linkleri alınıyor...\n');
  
  const { data: tenders, error } = await supabase
    .from('tenders')
    .select('id, title, external_id, document_links')
    .not('document_links', 'is', null)
    .order('created_at', { ascending: false })
    .limit(100);
  
  if (error) {
    console.log('❌ Supabase hatası:', error.message);
    return;
  }
  
  // Filter tenders with tech_spec
  const tendersWithTechSpec = tenders.filter(t => {
    const links = typeof t.document_links === 'string' 
      ? JSON.parse(t.document_links) 
      : t.document_links;
    return links?.tech_spec;
  });
  
  console.log(`📄 tech_spec linki olan ihale: ${tendersWithTechSpec.length}\n`);
  
  let downloaded = existingFiles.length;
  let processed = 0;
  
  for (const tender of tendersWithTechSpec) {
    if (downloaded >= TARGET_COUNT) break;
    
    const links = typeof tender.document_links === 'string'
      ? JSON.parse(tender.document_links)
      : tender.document_links;
    
    const techSpec = links.tech_spec;
    const url = typeof techSpec === 'string' ? techSpec : techSpec?.url;
    
    if (!url) continue;
    
    processed++;
    const title = (tender.title || `tender_${tender.id}`).substring(0, 40);
    console.log(`\n${processed}. [ID: ${tender.id}] ${title}`);
    console.log(`   URL: ${url.substring(0, 70)}...`);
    
    try {
      // Download
      console.log('   📥 İndiriliyor...');
      const buffer = await downloadFile(url);
      console.log(`   📦 ${Math.round(buffer.length / 1024)} KB indirildi`);
      
      // Detect type
      const fileType = detectFileType(buffer);
      console.log(`   🔍 Dosya tipi: ${fileType || 'bilinmiyor'}`);
      
      if (fileType === 'pdf') {
        // Direct PDF
        const filename = `tender_${tender.id}_teknik_sartname.pdf`;
        const filepath = path.join(TRAINING_DIR, filename);
        
        if (!fs.existsSync(filepath)) {
          fs.writeFileSync(filepath, buffer);
          console.log(`   ✅ Kaydedildi: ${filename}`);
          downloaded++;
        } else {
          console.log(`   ⏭️  Zaten var: ${filename}`);
        }
        
      } else if (fileType === 'zip') {
        // Extract from ZIP
        console.log('   📂 ZIP açılıyor...');
        const pdfs = extractPdfsFromZip(buffer);
        
        if (pdfs.length === 0) {
          console.log('   ⚠️  ZIP içinde teknik şartname PDF bulunamadı');
          continue;
        }
        
        for (const pdf of pdfs) {
          if (downloaded >= TARGET_COUNT) break;
          
          const filename = `tender_${tender.id}_${pdf.name}`.replace(/[^a-zA-Z0-9_.-]/g, '_');
          const filepath = path.join(TRAINING_DIR, filename);
          
          if (!fs.existsSync(filepath)) {
            fs.writeFileSync(filepath, pdf.buffer);
            console.log(`   ✅ Çıkarıldı: ${filename} (${Math.round(pdf.buffer.length / 1024)} KB)`);
            downloaded++;
          } else {
            console.log(`   ⏭️  Zaten var: ${filename}`);
          }
        }
        
      } else {
        console.log(`   ⚠️  Desteklenmeyen format: ${fileType || 'bilinmiyor'}`);
      }
      
      // Rate limiting
      await new Promise(r => setTimeout(r, 1500));
      
    } catch (e) {
      console.log(`   ❌ Hata: ${e.message}`);
    }
  }
  
  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  const finalFiles = fs.readdirSync(TRAINING_DIR).filter(f => f.endsWith('.pdf'));
  console.log(`\n📊 SONUÇ: ${finalFiles.length} training PDF hazır\n`);
  
  finalFiles.forEach((f, i) => {
    const stats = fs.statSync(path.join(TRAINING_DIR, f));
    console.log(`  ${i + 1}. ${f} (${Math.round(stats.size / 1024)} KB)`);
  });
  
  if (finalFiles.length >= 5) {
    console.log('\n✅ Yeterli döküman var! Azure eğitimine başlanabilir.');
  } else {
    console.log(`\n⚠️  Custom model için ${5 - finalFiles.length} döküman daha gerekli.`);
  }
}

main().catch(console.error);
