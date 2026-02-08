#!/usr/bin/env node
/**
 * Test: Analyze Page Scraper
 * Florya Yemek için analyze-page-scraper'ı test eder
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Dynamic imports - dotenv yüklendikten sonra database.js Pool oluşturulsun
const { default: browserManager } = await import('../src/scraper/shared/browser.js');
const { scrapeAnalyzePage } = await import('../src/scraper/yuklenici-istihbarat/yuklenici-profil-cek.js');

async function main() {
  let page;
  try {
    console.log('=== Analyze Page Scraper Test ===\n');

    const yuklenici = { id: 1, unvan: 'Florya Yemek Ticaret Anonim Şirketi' };
    console.log(`Hedef: ${yuklenici.unvan} (ID: ${yuklenici.id})\n`);

    page = await browserManager.createPage();

    const result = await scrapeAnalyzePage(page, yuklenici, {
      onProgress: (msg) => console.log(`  → ${msg}`),
    });

    console.log('\n=== SONUÇ ===');
    console.log(`Başarılı: ${result.success}`);
    console.log(`Bölüm: ${result.stats.sections_scraped}`);
    console.log(`Toplam Satır: ${result.stats.total_rows}`);
    console.log(`Hatalar: ${result.stats.errors.length}`);

    if (result.data) {
      console.log('\n=== VERİ ÖZETİ ===');
      console.log(`Özet: ${JSON.stringify(result.data.ozet || {}).length} byte`);
      console.log(`Yıllık Trend: ${result.data.yillik_trend?.length || 0} yıl`);
      console.log(`Sektörler: ${result.data.sektorler?.length || 0}`);
      console.log(`İdareler: ${result.data.idareler?.length || 0}`);
      console.log(`Yükleniciler: ${result.data.yukleniciler_listesi?.length || 0}`);
      console.log(`Ortak Girişim: ${result.data.ortak_girisimler?.length || 0}`);
      console.log(`Rakipler: ${result.data.rakipler?.length || 0}`);
      console.log(`Şehirler: ${result.data.sehirler?.length || 0}`);
      console.log(`İhale Türleri: ${result.data.ihale_turleri?.length || 0}`);
      console.log(`İhale Usulleri: ${result.data.ihale_usulleri?.length || 0}`);
      console.log(`Teklif Türleri: ${result.data.teklif_turleri?.length || 0}`);

      if (result.data.rakipler && result.data.rakipler.length > 0) {
        console.log('\n=== İLK 5 RAKİP ===');
        result.data.rakipler.slice(0, 5).forEach((r, i) => {
          console.log(`  ${i + 1}. ${r.rakip_adi} - ${r.ihale_sayisi} ihale`);
        });
      }

      if (result.data.idareler && result.data.idareler.length > 0) {
        console.log('\n=== İLK 5 İDARE ===');
        result.data.idareler.slice(0, 5).forEach((r, i) => {
          console.log(`  ${i + 1}. ${r.idare_adi} - ${r.gecmis} ihale`);
        });
      }
    }

    if (result.error) {
      console.error('\nHATA:', result.error);
    }

    console.log('\n=== TEST TAMAMLANDI ===');
  } catch (error) {
    console.error('HATA:', error.message);
    console.error(error.stack);
  } finally {
    if (page && !page.isClosed()) await page.close().catch(() => {});
    await browserManager.close();
    process.exit(0);
  }
}

main();
