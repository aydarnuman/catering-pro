#!/usr/bin/env node

/**
 * Scraper Runner - Basit CLI
 *
 * Kullanım:
 *   node runner.js --mode=list --pages=5     # Liste tara
 *   node runner.js --mode=full --pages=3     # Liste + dökümanlar
 *   node runner.js --mode=single --url=URL   # Tek ihale ekle
 *   node runner.js --mode=cleanup --days=7   # Süresi geçmiş ihaleleri temizle
 */

// .env yükle (CLI çalıştırıldığında)
import '../env-loader.js';

import { query } from '../database.js';
import browserManager from './browser-manager.js';
import documentScraper from './document-scraper.js';
import { scrapeList } from './list-scraper.js';
import logger from './logger.js';
import loginService from './login-service.js';

// Argümanları parse et
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = { mode: 'list', pages: 5, url: null, days: 7 };

  for (const arg of args) {
    if (arg.startsWith('--mode=')) parsed.mode = arg.split('=')[1];
    else if (arg.startsWith('--pages=')) parsed.pages = parseInt(arg.split('=')[1], 10) || 5;
    else if (arg.startsWith('--url=')) parsed.url = arg.split('=')[1];
    else if (arg.startsWith('--days=')) parsed.days = parseInt(arg.split('=')[1], 10) || 7;
    else if (arg === '--help' || arg === '-h') {
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
      onPageComplete: (pageNum) => log.info(`Sayfa ${pageNum} tamamlandı`),
    });

    log.end(result.stats);
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
        const withDocs = tenders.filter((t) => t.document_links && Object.keys(t.document_links).length > 0).length;
        log.info(`Sayfa ${pageNum}: ${tenders.length} ihale, ${withDocs} döküman`);
      },
    });

    log.end(result.stats);
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
    const result = await query(
      `
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
    `,
      [
        externalId,
        details.title,
        details.city,
        details.organization,
        details.teklifTarihi,
        details.yaklasikMaliyet
          ? parseFloat(
              details.yaklasikMaliyet
                .replace(/[^\d.,]/g, '')
                .replace(/\./g, '')
                .replace(',', '.')
            )
          : null,
        details.isinSuresi,
        args.url,
        details.documentLinks ? JSON.stringify(details.documentLinks) : null,
        details.announcementContent,
        details.goodsServicesList ? JSON.stringify(details.goodsServicesList) : null,
        details.zeyilnameContent ? JSON.stringify(details.zeyilnameContent) : null,
        details.correctionNoticeContent,
      ]
    );

    log.end({ id: result.rows[0].id, is_new: result.rows[0].is_new });
  } catch (error) {
    log.error('Hata', { error: error.message });
    throw error;
  } finally {
    if (page) await page.close().catch(() => {});
    await browserManager.close();
  }
}

// Süresi geçmiş ihaleleri temizle
async function runCleanup(args) {
  const log = logger.createSession('Runner:Cleanup');
  const days = args.days || 7;

  try {
    log.info(`Cleanup başlatılıyor: ${days} günden eski expired ihaleler silinecek`);

    // 1. Silinecek ihaleleri bul (expired + ihale tarihi N günden eski)
    const findResult = await query(
      `SELECT id, title, tender_date 
       FROM tenders 
       WHERE status = 'expired' 
         AND tender_date < NOW() - INTERVAL '1 day' * $1
       ORDER BY tender_date ASC`,
      [days]
    );

    const toDelete = findResult.rows;
    log.info(`${toDelete.length} ihale silinecek (${days}+ gün expired)`);

    if (toDelete.length === 0) {
      log.end({ deleted: 0, message: 'Silinecek ihale yok' });
      return;
    }

    const tenderIds = toDelete.map((t) => t.id);

    // 2. İlişkili documents kayıtlarını say
    const docCountResult = await query(
      `SELECT COUNT(*) as c FROM documents WHERE tender_id = ANY($1)`,
      [tenderIds]
    );
    const docCount = parseInt(docCountResult.rows[0].c, 10);

    // 3. Supabase Storage'daki dosyaları temizle (storage_path olanlar)
    let storageDeleted = 0;
    if (docCount > 0) {
      try {
        const { supabase } = await import('../supabase.js');
        const sb = typeof supabase === 'function' ? supabase : supabase;

        if (sb) {
          const docsWithStorage = await query(
            `SELECT storage_path FROM documents 
             WHERE tender_id = ANY($1) AND storage_path IS NOT NULL`,
            [tenderIds]
          );

          // Batch halinde sil (50'şer)
          const paths = docsWithStorage.rows.map((d) => d.storage_path).filter(Boolean);
          for (let i = 0; i < paths.length; i += 50) {
            const batch = paths.slice(i, i + 50);
            try {
              await sb.storage.from('tender-documents').remove(batch);
              storageDeleted += batch.length;
            } catch (storageErr) {
              log.warn(`Storage silme hatası (batch ${i}): ${storageErr.message}`);
            }
          }
        }
      } catch (storageError) {
        log.warn(`Storage temizleme atlandı: ${storageError.message}`);
      }
    }

    // 4. tender_tracking kayıtlarını sil
    await query(`DELETE FROM tender_tracking WHERE tender_id = ANY($1)`, [tenderIds]);

    // 5. documents kayıtları CASCADE ile silinecek, ama açıkça da silelim
    const deletedDocs = await query(`DELETE FROM documents WHERE tender_id = ANY($1) RETURNING id`, [tenderIds]);

    // 6. Tenders kayıtlarını sil
    const deletedTenders = await query(`DELETE FROM tenders WHERE id = ANY($1) RETURNING id`, [tenderIds]);

    const summary = {
      tendersDeleted: deletedTenders.rowCount,
      documentsDeleted: deletedDocs.rowCount,
      storageFilesDeleted: storageDeleted,
      oldestDate: toDelete[0]?.tender_date,
      newestDate: toDelete[toDelete.length - 1]?.tender_date,
    };

    log.info(`Cleanup tamamlandı`, summary);
    log.end(summary);
  } catch (error) {
    log.error('Cleanup hatası', { error: error.message });
    throw error;
  }
}

// Ana fonksiyon
async function main() {
  const args = parseArgs();

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
      case 'cleanup':
        await runCleanup(args);
        break;
      default:
        process.exit(1);
    }
    process.exit(0);
  } catch (_error) {
    process.exit(1);
  }
}

main();
