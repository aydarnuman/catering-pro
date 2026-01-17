#!/usr/bin/env node

/**
 * Scraper Runner - Basit CLI
 * 
 * Kullanım:
 *   node runner.js --mode=list --pages=5     # Liste tara
 *   node runner.js --mode=full --pages=3     # Liste + dökümanlar
 *   node runner.js --mode=single --url=URL   # Tek ihale ekle
 */

// .env yükle (CLI çalıştırıldığında)
import '../env-loader.js';

import browserManager from './browser-manager.js';
import { scrapeList } from './list-scraper.js';
import documentScraper from './document-scraper.js';
import loginService from './login-service.js';
import logger from './logger.js';
import { query } from '../database.js';

// Argümanları parse et
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = { mode: 'list', pages: 5, url: null };
  
  for (const arg of args) {
    if (arg.startsWith('--mode=')) parsed.mode = arg.split('=')[1];
    else if (arg.startsWith('--pages=')) parsed.pages = parseInt(arg.split('=')[1]) || 5;
    else if (arg.startsWith('--url=')) parsed.url = arg.split('=')[1];
    else if (arg === '--help' || arg === '-h') {
      console.log(`
╔═══════════════════════════════════════════════════════╗
║           CATERING PRO SCRAPER v3.0                   ║
╚═══════════════════════════════════════════════════════╝

Kullanım:
  node runner.js --mode=<mod> [seçenekler]

Modlar:
  list    Sadece liste tara (varsayılan)
  full    Liste + döküman içerikleri
  single  Tek ihale ekle (--url gerekli)

Seçenekler:
  --pages=N   Taranacak sayfa sayısı (varsayılan: 5)
  --url=URL   Tek ihale URL'i (single modu için)

Örnekler:
  node runner.js --mode=list --pages=3
  node runner.js --mode=full --pages=5
  node runner.js --mode=single --url=https://ihalebul.com/tender/123
`);
      process.exit(0);
    }
  }
  return parsed;
}

// Liste scraping
async function runList(args) {
  const log = logger.createSession('Runner:List');
  let page = null;

  try {
    page = await browserManager.createPage();
    
    const result = await scrapeList(page, {
      maxPages: args.pages,
      includeDocuments: false,
      onPageComplete: (pageNum) => log.info(`Sayfa ${pageNum} tamamlandı`)
    });

    const summary = log.end(result.stats);
    console.log(`\n✅ Tamamlandı: ${result.stats.tenders_new} yeni, ${result.stats.tenders_updated} güncellenen`);
    
  } catch (error) {
    log.error('Hata', { error: error.message });
    throw error;
  } finally {
    if (page) await page.close().catch(() => {});
    await browserManager.close();
  }
}

// Full scraping (liste + dökümanlar)
async function runFull(args) {
  const log = logger.createSession('Runner:Full');
  let page = null;

  try {
    page = await browserManager.createPage();
    
    const result = await scrapeList(page, {
      maxPages: args.pages,
      includeDocuments: true,
      onPageComplete: (pageNum, tenders) => {
        const withDocs = tenders.filter(t => t.document_links && Object.keys(t.document_links).length > 0).length;
        log.info(`Sayfa ${pageNum}: ${tenders.length} ihale, ${withDocs} döküman`);
      }
    });

    log.end(result.stats);
    console.log(`\n✅ Tamamlandı: ${result.stats.tenders_new} yeni, ${result.stats.tenders_updated} güncellenen`);
    
  } catch (error) {
    log.error('Hata', { error: error.message });
    throw error;
  } finally {
    if (page) await page.close().catch(() => {});
    await browserManager.close();
  }
}

// Tek ihale ekle
async function runSingle(args) {
  if (!args.url) {
    console.error('❌ --url parametresi gerekli');
    process.exit(1);
  }

  const log = logger.createSession('Runner:Single');
  let page = null;

  try {
    page = await browserManager.createPage();
    await loginService.ensureLoggedIn(page);

    // URL'den external_id çıkar
    const match = args.url.match(/\/tender\/(\d+)/);
    if (!match) throw new Error('Geçersiz URL formatı');
    const externalId = match[1];

    // Detayları çek
    const details = await documentScraper.scrapeTenderDetails(page, args.url);

    // Kaydet
    const result = await query(`
      INSERT INTO tenders (external_id, title, city, organization_name, tender_date, estimated_cost,
        work_duration, url, tender_source, category_id, category_name, document_links,
        announcement_content, goods_services_content, zeyilname_content, correction_notice_content)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ihalebul', 15, 'Hazır Yemek - Lokantacılık', $9, $10, $11, $12, $13)
      ON CONFLICT (external_id) DO UPDATE SET
        title = COALESCE(EXCLUDED.title, tenders.title),
        document_links = COALESCE(EXCLUDED.document_links, tenders.document_links),
        announcement_content = COALESCE(EXCLUDED.announcement_content, tenders.announcement_content),
        goods_services_content = COALESCE(EXCLUDED.goods_services_content, tenders.goods_services_content),
        updated_at = NOW()
      RETURNING id, (xmax = 0) as is_new
    `, [
      externalId,
      details.title,
      details.city,
      details.organization,
      details.teklifTarihi,
      details.yaklasikMaliyet ? parseFloat(details.yaklasikMaliyet.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.')) : null,
      details.isinSuresi,
      args.url,
      details.documentLinks ? JSON.stringify(details.documentLinks) : null,
      details.announcementContent,
      details.goodsServicesList ? JSON.stringify(details.goodsServicesList) : null,
      details.zeyilnameContent ? JSON.stringify(details.zeyilnameContent) : null,
      details.correctionNoticeContent
    ]);

    log.end({ id: result.rows[0].id, is_new: result.rows[0].is_new });
    console.log(`\n✅ İhale ${result.rows[0].is_new ? 'eklendi' : 'güncellendi'}: ID ${result.rows[0].id}`);

  } catch (error) {
    log.error('Hata', { error: error.message });
    throw error;
  } finally {
    if (page) await page.close().catch(() => {});
    await browserManager.close();
  }
}

// Ana fonksiyon
async function main() {
  const args = parseArgs();

  console.log(`
╔═══════════════════════════════════════════════════════╗
║           CATERING PRO SCRAPER v3.0                   ║
╚═══════════════════════════════════════════════════════╝

🚀 Mod: ${args.mode.toUpperCase()}
📅 Tarih: ${new Date().toLocaleString('tr-TR')}
`);

  try {
    switch (args.mode) {
      case 'list':
        await runList(args);
        break;
      case 'full':
        await runFull(args);
        break;
      case 'single':
        await runSingle(args);
        break;
      default:
        console.error(`❌ Bilinmeyen mod: ${args.mode}`);
        process.exit(1);
    }
    process.exit(0);
  } catch (error) {
    console.error('\n❌ HATA:', error.message);
    process.exit(1);
  }
}

main();
