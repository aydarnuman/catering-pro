import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

dotenv.config();

async function checkPDFPages() {
  const pdfPath = '/tmp/teknik-sartname.pdf';
  
  // PDF bilgisi
  try {
    const { stdout: pdfInfo } = await execAsync(`pdfinfo ${pdfPath} 2>/dev/null || echo "pdfinfo yok"`);
    console.log('=== PDF BİLGİSİ ===');
    console.log(pdfInfo);
  } catch (e) {
    console.log('pdfinfo çalıştırılamadı');
  }
  
  // İlk sayfayı görüntüye çevir
  console.log('\n=== İLK SAYFA GÖRSELİ ===');
  try {
    await execAsync(`pdftoppm -png -f 1 -l 1 -r 150 ${pdfPath} /tmp/page`);
    const files = fs.readdirSync('/tmp').filter(f => f.startsWith('page'));
    console.log('Oluşturulan dosyalar:', files);
    
    // Dosya boyutu
    for (const f of files) {
      const stats = fs.statSync(`/tmp/${f}`);
      console.log(`${f}: ${(stats.size / 1024).toFixed(1)} KB`);
    }
  } catch (e) {
    console.log('pdftoppm çalıştırılamadı:', e.message);
  }
  
  // OCR dene
  console.log('\n=== OCR DENEMESİ ===');
  try {
    await execAsync(`tesseract /tmp/page-1.png /tmp/ocr-result -l tur 2>/dev/null`);
    const ocrText = fs.readFileSync('/tmp/ocr-result.txt', 'utf-8');
    console.log(`OCR sonucu (${ocrText.length} karakter):\n`);
    console.log(ocrText.substring(0, 2000));
    
    // Gramaj ara
    const gramajLines = ocrText.split('\n').filter(l => 
      l.match(/\d+\s*(gr|gram|g|kg|ml)\b/i) ||
      l.toLowerCase().includes('gramaj') ||
      l.toLowerCase().includes('porsiyon')
    );
    
    if (gramajLines.length > 0) {
      console.log('\n\n=== GRAMAJ İÇEREN SATIRLAR ===');
      for (const l of gramajLines) {
        console.log(`  ${l}`);
      }
    }
  } catch (e) {
    console.log('Tesseract çalıştırılamadı:', e.message);
  }
}

checkPDFPages().catch(console.error);
