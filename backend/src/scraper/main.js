import browserManager from './browser-manager.js';
import { scrapeList } from './list-scraper.js';
import { query } from '../database.js';

/**
 * Basit Liste Scraper - Sadece ihaleleri ve dökümanları çeker
 */

async function main() {
  const args = process.argv.slice(2);
  const maxPages = parseInt(getArg(args, '--maxPages') || '5');
  const startPage = parseInt(getArg(args, '--startPage') || '1');

  console.log('🚀 İhale Liste Scraper');
  console.log(`📄 Sayfa: ${startPage} → ${maxPages}`);
  console.log(`📚 Dökümanlar dahil çekilecek`);

  let page = null;

  try {
    // Browser başlat
    page = await browserManager.createPage();

    // Liste scraping (dökümanlar dahil)
    const result = await scrapeList(page, {
      maxPages,
      startPage,
      includeDocuments: true,
      onPageComplete: (pageNum, tenders) => {
        console.log(`✅ Sayfa ${pageNum} tamamlandı (${tenders.length} ihale)`);
      }
    });

    console.log('🎉 Scraper tamamlandı!');
    console.log(`📊 Toplam: ${result.stats.tenders_found} ihale`);
    console.log(`🆕 Yeni: ${result.stats.tenders_new}`);
    console.log(`🔄 Güncellenen: ${result.stats.tenders_updated}`);

  } catch (error) {
    console.error('❌ Hata:', error.message);
    process.exit(1);

  } finally {
    // Temizlik
    if (page) await page.close().catch(() => {});
    await browserManager.close().catch(() => {});
  }
}

/**
 * CLI argüman helper
 */
function getArg(args, name) {
  const arg = args.find(a => a.startsWith(`${name}=`));
  return arg ? arg.split('=')[1] : null;
}

// Çalıştır
main();
