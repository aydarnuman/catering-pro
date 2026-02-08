import dotenv from 'dotenv';
dotenv.config();

import browserManager from '../src/scraper/shared/browser.js';
import { scrapeContractorTenders } from '../src/scraper/yuklenici-istihbarat/yuklenici-gecmisi-cek.js';

const yuklenici = { 
  id: 5, 
  unvan: 'Danış Kurumsal Hizmetler İnşaat Yemek Hizmetleri Temizlik Gıda Sanayi Ve Ticaret Anonim Şirketi' 
};

async function main() {
  let page;
  try {
    console.log('Başlıyor:', yuklenici.unvan.substring(0, 50) + '...');
    page = await browserManager.createPage();
    console.log('Browser açıldı, scrape başlıyor...\n');

    const result = await scrapeContractorTenders(page, yuklenici, {
      maxPages: 15,
      onPageComplete: (pageNum, tenders, stats) => {
        console.log(`  Sayfa ${pageNum}: ${tenders.length} ihale | Kaydedilen: ${stats.tenders_saved}`);
      }
    });

    console.log('\n=== SONUÇ ===');
    console.log('Bulunan:', result.stats.tenders_found);
    console.log('Kaydedilen:', result.stats.tenders_saved);
    console.log('Hata:', result.stats.errors);
    console.log('Sayfa:', result.stats.pages_scraped);
    if (result.stats.phases) {
      result.stats.phases.forEach(p => console.log(`  ${p.label}: ${p.tenders} ihale, ${p.pages} sayfa`));
    }
  } catch (e) {
    console.error('HATA:', e.message);
    console.error(e.stack);
  } finally {
    if (page && !page.isClosed()) await page.close().catch(() => {});
    await browserManager.close().catch(() => {});
    process.exit(0);
  }
}

main();
