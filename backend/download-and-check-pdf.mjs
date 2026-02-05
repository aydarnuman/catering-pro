import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function downloadAndCheckPDF() {
  const pdfUrl = 'https://vpobejfxqihvgsjwnyku.supabase.co/storage/v1/object/public/tender-documents/tenders/11231/tech_spec/1770109603751-f120a4f4-24_Aylik_Malzeme_Dahil_Yemek_Hizmeti_Alimi_Teknik_Sartnamesi.pdf.pdf';
  
  console.log('PDF indiriliyor...');
  
  // PDF'i indir
  const response = await fetch(pdfUrl);
  const buffer = await response.arrayBuffer();
  fs.writeFileSync('/tmp/teknik-sartname.pdf', Buffer.from(buffer));
  
  console.log('PDF indirildi. Metin çıkarılıyor...\n');
  
  // pdftotext ile metin çıkar
  try {
    await execAsync('pdftotext /tmp/teknik-sartname.pdf /tmp/teknik-sartname.txt');
    const text = fs.readFileSync('/tmp/teknik-sartname.txt', 'utf-8');
    
    console.log(`Toplam karakter: ${text.length}\n`);
    
    // Gramaj ara
    const gramajPatterns = [
      /(\d+)\s*(gr|gram|g)\b/gi,
      /(\d+)\s*kg/gi,
      /(\d+)\s*ml/gi,
      /(\d+)\s*lt/gi,
      /porsiyon[^\n]*\d+/gi,
      /\d+[^\n]*porsiyon/gi,
      /gramaj[^\n]*/gi,
    ];
    
    console.log('=== GRAMAJ İÇEREN SATIRLAR ===\n');
    
    const lines = text.split('\n');
    let gramajLines = [];
    
    for (const line of lines) {
      if (line.match(/\d+\s*(gr|gram|g|kg|ml|lt)\b/i) || 
          line.toLowerCase().includes('gramaj') ||
          line.toLowerCase().includes('porsiyon')) {
        gramajLines.push(line.trim());
      }
    }
    
    // Unique ve boş olmayanları al
    gramajLines = [...new Set(gramajLines)].filter(l => l.length > 5);
    
    console.log(`Gramaj içeren satır sayısı: ${gramajLines.length}\n`);
    
    for (const line of gramajLines.slice(0, 50)) {
      console.log(`  ${line.substring(0, 150)}`);
    }
    
    // Yemek isimleri ve gramajları bul
    console.log('\n\n=== YEMEK-GRAMAJ EŞLEŞMELERİ ===\n');
    
    const yemekGramajPattern = /(çorba|pilav|et|tavuk|köfte|balık|salata|tatlı|meyve|makarna|nohut|fasulye|börek|mantı|kebap)[^\n]*(\d+)\s*(gr|g|gram)/gi;
    const matches = text.match(yemekGramajPattern);
    
    if (matches) {
      for (const m of [...new Set(matches)].slice(0, 30)) {
        console.log(`  ${m}`);
      }
    }
    
  } catch (err) {
    console.log('pdftotext hata:', err.message);
    console.log('Alternatif yöntem deneniyor...');
  }
}

downloadAndCheckPDF().catch(console.error);
