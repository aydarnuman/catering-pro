/**
 * Participant Scraper
 *
 * İhale katılımcı listelerini ihalebul.com'dan çeker.
 * URL: /tender/{id}/participants
 *
 * contractors.js route'undaki POST /scrape/participants endpoint'i tarafından kullanılır.
 */

import { query } from '../../database.js';
import loginService from '../shared/ihalebul-login.js';

const DELAY_MIN = 2000;
const DELAY_MAX = 4000;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay() {
  return delay(DELAY_MIN + Math.random() * (DELAY_MAX - DELAY_MIN));
}

/**
 * Batch: Birden fazla ihalenin katılımcılarını sırayla çek
 *
 * @param {import('puppeteer').Page} page
 * @param {Array} tenders - [{ id, external_id, document_links }]
 * @param {Object} options
 * @param {number} options.maxTenders - Maks ihale sayısı
 * @param {Function} options.onProgress - İlerleme callback
 */
export async function batchScrapeParticipants(page, tenders, options = {}) {
  const { maxTenders = 20, onProgress = null } = options;

  const stats = {
    total: Math.min(tenders.length, maxTenders),
    processed: 0,
    total_participants: 0,
    new_contractors: 0,
    errors: 0,
  };

  await loginService.ensureLoggedIn(page);
  await delay(3000);

  const tendersToProcess = tenders.slice(0, maxTenders);

  for (const tender of tendersToProcess) {
    try {
      // document_links'ten participants URL'sini al
      const docLinks =
        typeof tender.document_links === 'string' ? JSON.parse(tender.document_links) : tender.document_links;

      const participantsUrl = docLinks?.probable_participants?.url;
      if (!participantsUrl) {
        stats.processed++;
        continue;
      }

      // Sayfaya git
      await page.goto(participantsUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await randomDelay();

      // Login kontrolü
      if (!(await loginService.isLoggedIn(page))) {
        await loginService.forceRelogin(page);
        await page.goto(participantsUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await randomDelay();
      }

      // Katılımcıları çıkar
      const participants = await extractParticipants(page);

      // DB'ye kaydet
      for (const participant of participants) {
        try {
          const result = await saveParticipant(tender.id, participant);
          stats.total_participants++;
          if (result?.isNewContractor) stats.new_contractors++;
        } catch (_e) {
          stats.errors++;
        }
      }

      stats.processed++;

      if (onProgress) {
        onProgress(stats);
      }

      // Rate limiting
      await delay(2000 + Math.random() * 3000);
    } catch (_error) {
      stats.errors++;
      stats.processed++;
    }
  }

  return { success: true, stats };
}

/**
 * Katılımcı sayfasından firma bilgilerini çıkar
 */
async function extractParticipants(page) {
  return await page.evaluate(() => {
    const participants = [];

    // ihalebul.com katılımcı sayfası genellikle bir tablo veya liste gösterir
    // Tablo satırlarını tara
    const rows = document.querySelectorAll('table tbody tr, .participant-item, .list-group-item');

    rows.forEach((row, rowIndex) => {
      try {
        const text = row.textContent.trim();
        if (!text || text.includes('***') || text.length < 5) return;

        // Tablo satırından firma bilgisi çıkar
        const cells = row.querySelectorAll('td');
        if (cells.length >= 1) {
          // İlk hücre sıra numarası olabilir (sadece rakam)
          const firstCellText = cells[0]?.textContent.trim();
          const isFirstCellIndex = /^\d{1,3}$/.test(firstCellText);

          // Sıra numarası varsa firma adı 2. hücrede, yoksa 1. hücrede
          const sira = isFirstCellIndex ? parseInt(firstCellText, 10) : rowIndex + 1;
          const firmaAdi = isFirstCellIndex && cells.length >= 2 ? cells[1]?.textContent.trim() : firstCellText;

          if (!firmaAdi || firmaAdi.includes('***') || firmaAdi.length < 3) return;

          // Teklif fiyatı (varsa) — sıra numarası ve firma adı hücrelerini atla
          let teklifFiyati = null;
          const startIdx = isFirstCellIndex ? 2 : 1;
          for (let i = startIdx; i < cells.length; i++) {
            const cellText = cells[i].textContent.trim();
            const fiyatMatch = cellText.match(/₺?\s*([\d.,]+(?:\.\d+)?)\s*(?:TL|₺)?/);
            if (fiyatMatch) {
              const parsed = parseFloat(fiyatMatch[1].replace(/\./g, '').replace(',', '.'));
              // Mantıklı bir fiyat mı? (1000 TL'den büyük olmalı)
              if (parsed > 1000) {
                teklifFiyati = parsed;
                break;
              }
            }
          }

          participants.push({
            firmaAdi: firmaAdi.replace(/\s+/g, ' ').trim(),
            teklifFiyati,
            sira,
          });
          return;
        }

        // Liste öğesinden (tablo değilse)
        // Satırdaki ilk anlamlı metin firma adı
        const lines = text
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean);
        if (lines.length > 0) {
          const firmaAdi = lines[0].replace(/\s+/g, ' ').trim();
          if (firmaAdi.length >= 5 && !firmaAdi.includes('***')) {
            participants.push({ firmaAdi, teklifFiyati: null, sira: rowIndex + 1 });
          }
        }
      } catch (_e) {}
    });

    // Eğer tablo/liste bulunamadıysa, sayfa metninden firma adlarını çıkarmayı dene
    if (participants.length === 0) {
      const pageText = document.body.innerText;
      // Firma adı kalıpları (genellikle A.Ş., Ltd., Şti. ile biter)
      const firmaPattern = /([A-ZÇĞİÖŞÜ][^\n]{5,100}(?:A\.Ş\.|Ltd\.|Şti\.|AŞ|LTD|ŞTİ))/gi;
      const matches = pageText.matchAll(firmaPattern);
      let idx = 1;
      for (const match of matches) {
        const firmaAdi = match[1].replace(/\s+/g, ' ').trim();
        if (!firmaAdi.includes('***') && !participants.some((p) => p.firmaAdi === firmaAdi)) {
          participants.push({ firmaAdi, teklifFiyati: null, sira: idx++ });
        }
      }
    }

    return participants;
  });
}

/**
 * Katılımcıyı DB'ye kaydet
 * 1. Yükleniciler tablosunda yoksa ekle
 * 2. yuklenici_ihaleleri tablosuna katilimci olarak ekle
 */
async function saveParticipant(tenderId, participant) {
  let isNewContractor = false;

  // 1. Yüklenici bul veya oluştur
  const unvan = participant.firmaAdi.replace(/\s+/g, ' ').trim();

  let yukleniciResult = await query('SELECT id FROM yukleniciler WHERE unvan = $1', [unvan]);

  if (yukleniciResult.rows.length === 0) {
    // Yeni yüklenici oluştur
    const veriKaynagi = JSON.stringify([{ kaynak: 'katilimci_tarama', tarih: new Date().toISOString() }]);
    yukleniciResult = await query(
      `INSERT INTO yukleniciler (unvan, veri_kaynaklari) VALUES ($1, $2::jsonb) 
       ON CONFLICT (unvan) DO UPDATE SET 
         veri_kaynaklari = (
           SELECT jsonb_agg(DISTINCT elem)
           FROM jsonb_array_elements(
             COALESCE(yukleniciler.veri_kaynaklari, '[]'::jsonb) || $2::jsonb
           ) AS elem
         ),
         updated_at = NOW()
       RETURNING id, (xmax = 0) as is_new`,
      [unvan, veriKaynagi]
    );
    isNewContractor = yukleniciResult.rows[0]?.is_new || false;
  }

  const yukleniciId = yukleniciResult.rows[0].id;

  // 2. İhale katılım kaydı oluştur
  await query(
    `
    INSERT INTO yuklenici_ihaleleri (yuklenici_id, tender_id, rol, sozlesme_bedeli)
    VALUES ($1, $2, 'katilimci', $3)
    ON CONFLICT (yuklenici_id, tender_id, rol) DO UPDATE SET
      sozlesme_bedeli = COALESCE(EXCLUDED.sozlesme_bedeli, yuklenici_ihaleleri.sozlesme_bedeli)
  `,
    [yukleniciId, tenderId, participant.teklifFiyati]
  );

  return { isNewContractor };
}

export default { batchScrapeParticipants };
