import './src/env-loader.js';
import { query } from './src/database.js';

try {
  // Tenders tablosu şeması
  const schema = await query(
    "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'tenders' ORDER BY ordinal_position"
  );
  console.log('=== TENDERS TABLOSU ŞEMASI ===');
  schema.rows.forEach(r => console.log('  ' + r.column_name + ': ' + r.data_type + ' (' + r.is_nullable + ')'));
  
  // Mevcut kayıt sayısı
  const count = await query('SELECT COUNT(*) as total FROM tenders');
  console.log('\nToplam ihale: ' + count.rows[0].total);
  
  // scraper_logs tablosu
  const logsSchema = await query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'scraper_logs' ORDER BY ordinal_position"
  );
  console.log('\n=== SCRAPER_LOGS TABLOSU ===');
  if (logsSchema.rows.length > 0) {
    logsSchema.rows.forEach(r => console.log('  ' + r.column_name + ': ' + r.data_type));
  } else {
    console.log('  Tablo bulunamadı');
  }
  
  // documents tablosu
  const docsSchema = await query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'documents' ORDER BY ordinal_position"
  );
  console.log('\n=== DOCUMENTS TABLOSU ===');
  if (docsSchema.rows.length > 0) {
    docsSchema.rows.forEach(r => console.log('  ' + r.column_name + ': ' + r.data_type));
  } else {
    console.log('  Tablo bulunamadı');
  }
  
  process.exit(0);
} catch (e) {
  console.error('HATA:', e.message);
  process.exit(1);
}
