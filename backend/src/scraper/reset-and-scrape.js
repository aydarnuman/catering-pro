import { query } from '../database.js';
import { execSync } from 'child_process';
import readline from 'readline';

/**
 * Veritabanını temizle ve yeniden scraping yap
 */

async function resetAndScrape() {
  console.log('🗑️  VERİTABANINI TEMİZLE VE YENİDEN SCRAPING YAP');
  console.log('================================================\n');

  // Kullanıcıdan onay al
  const confirmed = await confirmAction();
  if (!confirmed) {
    console.log('❌ İşlem iptal edildi.');
    process.exit(0);
  }

  try {
    // 1. Tüm ihaleleri sil
    console.log('\n🗑️  Tüm ihaleler siliniyor...');
    const deleteResult = await query('DELETE FROM tenders');
    console.log(`✅ ${deleteResult.rowCount} ihale silindi`);

    // 2. Scraper loglarını temizle (opsiyonel)
    console.log('\n🗑️  Eski scraper logları temizleniyor...');
    const logResult = await query('DELETE FROM scraper_logs');
    console.log(`✅ ${logResult.rowCount} log kaydı silindi`);

    // 3. Sequences'leri sıfırla
    console.log('\n🔄 ID sayaçları sıfırlanıyor...');
    await query('ALTER SEQUENCE tenders_id_seq RESTART WITH 1');
    await query('ALTER SEQUENCE scraper_logs_id_seq RESTART WITH 1');
    console.log('✅ Sayaçlar sıfırlandı');

    // 4. Veritabanı durumunu kontrol et
    console.log('\n📊 Veritabanı durumu:');
    const stats = await query('SELECT COUNT(*) as count FROM tenders');
    console.log(`   Toplam ihale: ${stats.rows[0].count}`);

    // 5. Scraping başlat
    console.log('\n🚀 İhale Scraping başlatılıyor...');
    console.log('================================================\n');

    // Sadece liste scraper (dökümanlar dahil)
    execSync('node src/scraper/main.js --maxPages=3 --startPage=1', {
      cwd: '/Users/numanaydar/Desktop/CATERİNG/backend',
      stdio: 'inherit'
    });

    console.log('\n✅ İşlem tamamlandı!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Hata:', error.message);
    console.error(error);
    process.exit(1);
  }
}

/**
 * Kullanıcıdan onay al
 */
function confirmAction() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('⚠️  UYARI: Bu işlem TÜM ihaleleri ve logları silecektir!');
    console.log('⚠️  Bu işlem geri alınamaz!\n');

    rl.question('Devam etmek istediğinize emin misiniz? (evet/hayir): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'evet' || answer.toLowerCase() === 'yes');
    });
  });
}

// Çalıştır
resetAndScrape();

