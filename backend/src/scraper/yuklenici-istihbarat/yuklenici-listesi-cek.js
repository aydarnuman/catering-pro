/**
 * Contractor List Scraper
 *
 * ihalebul.com sonuçlanmış ihalelerden yüklenici bilgilerini çeker
 * ve yukleniciler tablosuna UPSERT eder.
 *
 * contractors.js route'undaki POST /scrape endpoint'i tarafından kullanılır.
 */

import { query } from '../../database.js';
import loginService from '../shared/ihalebul-login.js';

const BASE_URL = 'https://www.ihalebul.com/tenders/search?workcategory_in=15';
const PAGE_DELAY_MIN = 2000;
const PAGE_DELAY_MAX = 4000;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay() {
  return delay(PAGE_DELAY_MIN + Math.random() * (PAGE_DELAY_MAX - PAGE_DELAY_MIN));
}

/**
 * Ana scrape fonksiyonu: Sonuçlanmış ihalelerden yüklenici listesi çeker
 *
 * @param {import('puppeteer').Page} page - Puppeteer sayfası
 * @param {Object} options
 * @param {number} options.maxPages - Maksimum sayfa sayısı (varsayılan: 20)
 * @param {Function} options.onPageComplete - Her sayfa tamamlandığında callback
 * @returns {Object} { success, stats, contractors }
 */
export async function scrapeContractorList(page, options = {}) {
  const { maxPages = 20, onPageComplete = null } = options;

  const stats = {
    pages_scraped: 0,
    contractors_found: 0,
    contractors_new: 0,
    contractors_updated: 0,
    errors: 0,
  };

  // Bulunan yüklenicileri topla (unvan -> data)
  const contractorMap = new Map();

  try {
    // Login
    await loginService.ensureLoggedIn(page);
    await delay(3000);

    // Sonuçlanmış ihalelere git (tamamlanan ihaleler listesi)
    const startUrl = `${BASE_URL}&sort=date_desc`;
    await page.goto(startUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await randomDelay();

    let currentPage = 1;

    while (currentPage <= maxPages) {
      // Login kontrolü
      if (!(await loginService.isLoggedIn(page))) {
        await loginService.forceRelogin(page);
        await page.goto(`${BASE_URL}&sort=date_desc&page=${currentPage}`, {
          waitUntil: 'networkidle2',
          timeout: 30000,
        });
        await randomDelay();
      }

      // Sayfayı scroll et (lazy load)
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await delay(1000);

      // İhalelerdeki yüklenici bilgilerini çıkar
      const pageContractors = await extractContractorsFromPage(page);

      if (pageContractors.length === 0) {
        break;
      }

      // Her yükleniciyi map'e ekle (aynı firma birden fazla ihalede olabilir)
      for (const c of pageContractors) {
        if (!c.yukleniciAdi) continue;

        const key = c.yukleniciAdi.toLowerCase().trim();
        if (contractorMap.has(key)) {
          const existing = contractorMap.get(key);
          existing.ihaleSayisi++;
          existing.toplamBedel += c.sozlesmeBedeli || 0;
          existing.indirimler.push(c.indirimOrani);
          if (c.devamEdiyor) existing.devamEdenSayisi++;
          if (c.tamamlandi) existing.tamamlananSayisi++;
          if (c.sehir && !existing.sehirler.includes(c.sehir)) {
            existing.sehirler.push(c.sehir);
          }
          if (!existing.sonTarih || (c.sozlesmeTarihi && c.sozlesmeTarihi > existing.sonTarih)) {
            existing.sonTarih = c.sozlesmeTarihi;
          }
        } else {
          contractorMap.set(key, {
            unvan: c.yukleniciAdi.replace(/\s+/g, ' ').trim(),
            ihaleSayisi: 1,
            toplamBedel: c.sozlesmeBedeli || 0,
            indirimler: [c.indirimOrani],
            sehirler: c.sehir ? [c.sehir] : [],
            sonTarih: c.sozlesmeTarihi || null,
            devamEdenSayisi: c.devamEdiyor ? 1 : 0,
            tamamlananSayisi: c.tamamlandi ? 1 : 0,
          });
        }
      }

      stats.pages_scraped++;
      stats.contractors_found = contractorMap.size;

      // DB'ye kaydet (sayfa bazında)
      const pageStats = await saveContractors(contractorMap);
      stats.contractors_new = pageStats.newCount;
      stats.contractors_updated = pageStats.updatedCount;

      // İhale geçmişi kayıtlarını da yaz (yuklenici_ihaleleri)
      await saveTenderRecords(pageContractors);

      if (onPageComplete) {
        onPageComplete(currentPage, pageContractors, stats);
      }

      // Sonraki sayfa var mı?
      const hasNext = await page.evaluate((current) => {
        const select = document.querySelector('select[name="page"]');
        if (select) {
          const options = Array.from(select.querySelectorAll('option'));
          return current < options.length;
        }
        return false;
      }, currentPage);

      if (!hasNext) break;

      // Sonraki sayfaya git
      await page.goto(`${BASE_URL}&sort=date_desc&page=${currentPage + 1}`, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });
      await randomDelay();
      currentPage++;
    }
  } catch (error) {
    stats.errors++;
    throw error;
  }

  return {
    success: true,
    stats,
    contractors: Array.from(contractorMap.values()),
  };
}

/**
 * Sayfadaki ihale kartlarından yüklenici bilgilerini çıkar
 */
async function extractContractorsFromPage(page) {
  return await page.evaluate(() => {
    const results = [];

    document.querySelectorAll('.card.border-secondary.my-2.mx-1').forEach((card) => {
      try {
        const text = card.textContent;

        // Yüklenici adı
        const yukleniciMatch = text.match(/Yüklenici adı:\s*([^\n₺]+)/i);
        if (!yukleniciMatch) return; // Yüklenici yoksa bu kart bizi ilgilendirmiyor

        const yukleniciAdi = yukleniciMatch[1].trim();
        if (!yukleniciAdi || yukleniciAdi.includes('***')) return;

        // Sözleşme bedeli
        const bedelMatch = text.match(/Sözleşme bedeli:\s*₺?([\d.,]+)/i);
        const sozlesmeBedeli = bedelMatch ? parseFloat(bedelMatch[1].replace(/\./g, '').replace(',', '.')) : null;

        // İndirim oranı
        const indirimMatch = text.match(/%\s*([\d.,]+)/);
        const indirimOrani = indirimMatch ? parseFloat(indirimMatch[1].replace(',', '.')) : null;

        // Sözleşme tarihi
        const tarihMatch = text.match(/Sözleşme tarihi:\s*([\d.]+)/i);
        const sozlesmeTarihi = tarihMatch ? tarihMatch[1] : null;

        // Şehir
        const nonLocationTexts = [
          'Ekap',
          'Gazete',
          'İstihbarat',
          'Özel Sektör',
          'Açık ihale',
          'Belli istekliler',
          'Pazarlık',
          'Doğrudan',
        ];
        const locationDivs = Array.from(card.querySelectorAll('.text-dark-emphasis.fw-medium.text-nowrap'))
          .map((d) => d.textContent.trim())
          .filter((t) => t.length > 0 && t.length <= 30 && !nonLocationTexts.some((nl) => t.includes(nl)));
        const sehir = locationDivs.length >= 2 ? locationDivs[1] : locationDivs[0] || null;

        // İhale başlığı ve external ID
        const detailLink = Array.from(card.querySelectorAll('a[href*="/tender/"]')).find((a) =>
          a.href.match(/\/tender\/\d+$/)
        );
        const ihaleBasligi = detailLink ? detailLink.textContent.trim() : null;
        const externalId = detailLink ? detailLink.href.match(/\/tender\/(\d+)$/)?.[1] : null;

        // IKN
        const badge = card.querySelector('.badge.text-info');
        const ikn = badge?.textContent.trim().replace(/^#/, '') || null;

        // Kurum adı
        const kurumMatch = text.match(/(?:İdare adı|İdarenin adı)[:\s]+([^\n]+)/i);
        const kurum = kurumMatch ? kurumMatch[1].trim() : null;

        // Fesih durumu
        const fesihMatch = text.match(/Fesih[:\s]+([^\n]+)/i);
        const fesih = fesihMatch ? fesihMatch[1].trim() : null;

        // Durum tespiti
        const tamamlandi = text.includes('Tamamlandı');
        const devamEdiyor =
          text.includes('Devam Ediyor') || text.includes('Sözleşme Devam') || text.includes('İş Devam');
        const iptalEdildi = text.includes('İptal');

        // Yaklaşık maliyet
        const yaklasikMatch = text.match(/Yaklaşık maliyet:\s*₺?([\d.,]+)/i);
        const yaklasikMaliyet = yaklasikMatch
          ? parseFloat(yaklasikMatch[1].replace(/\./g, '').replace(',', '.'))
          : null;

        // İş başlangıç tarihi
        const basMatch = text.match(/İş başlangıç:\s*([\d.]+)/i);
        const isBaslangic = basMatch ? basMatch[1] : null;

        // İş bitiş tarihi
        const bitisMatch = text.match(/İş bitiş:\s*([\d.]+)/i);
        const isBitis = bitisMatch ? bitisMatch[1] : null;

        results.push({
          yukleniciAdi,
          sozlesmeBedeli,
          indirimOrani,
          sozlesmeTarihi,
          yaklasikMaliyet,
          isBaslangic,
          isBitis,
          sehir,
          ihaleBasligi,
          kurum,
          externalId,
          ikn,
          fesih,
          tamamlandi,
          devamEdiyor,
          iptalEdildi,
        });
      } catch (_e) {
        // Tek kart hatası diğerlerini etkilemesin
      }
    });

    return results;
  });
}

/**
 * Toplanan yüklenici verilerini DB'ye kaydet
 */
async function saveContractors(contractorMap) {
  let newCount = 0;
  let updatedCount = 0;

  for (const [, data] of contractorMap) {
    try {
      const ortIndirim =
        data.indirimler.filter(Boolean).length > 0
          ? data.indirimler.filter(Boolean).reduce((a, b) => a + b, 0) / data.indirimler.filter(Boolean).length
          : null;

      // Sözleşme tarihini parse et (DD.MM.YYYY -> YYYY-MM-DD)
      let sonTarih = null;
      if (data.sonTarih) {
        const parts = data.sonTarih.split('.');
        if (parts.length === 3) {
          sonTarih = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }

      // ihalebul.com analiz URL'si oluştur
      const upperName = data.unvan.toLocaleUpperCase('tr-TR');
      const encodedName = encodeURIComponent(upperName).replace(/%20/g, '+');
      const ihalebulUrl = `https://www.ihalebul.com/analyze?workcategory_in=15&contractortitle_in=${encodedName}`;

      const veriKaynagi = JSON.stringify([{ kaynak: 'liste_tarama', tarih: new Date().toISOString() }]);

      const result = await query(
        `
        INSERT INTO yukleniciler (
          unvan, katildigi_ihale_sayisi, tamamlanan_is_sayisi, devam_eden_is_sayisi,
          toplam_sozlesme_bedeli, ortalama_indirim_orani, aktif_sehirler,
          son_ihale_tarihi, ihalebul_url, veri_kaynaklari, scraped_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10::jsonb, NOW())
        ON CONFLICT (unvan) DO UPDATE SET
          katildigi_ihale_sayisi = GREATEST(yukleniciler.katildigi_ihale_sayisi, EXCLUDED.katildigi_ihale_sayisi),
          tamamlanan_is_sayisi = GREATEST(yukleniciler.tamamlanan_is_sayisi, EXCLUDED.tamamlanan_is_sayisi),
          devam_eden_is_sayisi = GREATEST(yukleniciler.devam_eden_is_sayisi, EXCLUDED.devam_eden_is_sayisi),
          toplam_sozlesme_bedeli = GREATEST(yukleniciler.toplam_sozlesme_bedeli, EXCLUDED.toplam_sozlesme_bedeli),
          ortalama_indirim_orani = COALESCE(EXCLUDED.ortalama_indirim_orani, yukleniciler.ortalama_indirim_orani),
          aktif_sehirler = EXCLUDED.aktif_sehirler,
          son_ihale_tarihi = GREATEST(yukleniciler.son_ihale_tarihi, EXCLUDED.son_ihale_tarihi),
          ihalebul_url = COALESCE(EXCLUDED.ihalebul_url, yukleniciler.ihalebul_url),
          veri_kaynaklari = (
            SELECT jsonb_agg(DISTINCT elem)
            FROM jsonb_array_elements(
              COALESCE(yukleniciler.veri_kaynaklari, '[]'::jsonb) || EXCLUDED.veri_kaynaklari
            ) AS elem
          ),
          scraped_at = NOW(),
          updated_at = NOW()
        RETURNING (xmax = 0) as is_new
      `,
        [
          data.unvan,
          data.ihaleSayisi,
          data.tamamlananSayisi || data.ihaleSayisi,
          data.devamEdenSayisi || 0,
          data.toplamBedel || 0,
          ortIndirim,
          JSON.stringify(data.sehirler),
          sonTarih,
          ihalebulUrl,
          veriKaynagi,
        ]
      );

      if (result.rows[0]?.is_new) newCount++;
      else updatedCount++;
    } catch (_error) {
      // Tek yüklenici hatası diğerlerini etkilemesin
    }
  }

  return { newCount, updatedCount };
}

/**
 * Sayfa kartlarındaki ihale kayıtlarını yuklenici_ihaleleri'ne yaz
 * Bu sayede list scraper da ihale geçmişi oluşturur
 */
async function saveTenderRecords(pageContractors) {
  for (const c of pageContractors) {
    if (!c.yukleniciAdi || !c.ihaleBasligi) continue;

    try {
      // Yüklenici ID bul
      const ykResult = await query('SELECT id FROM yukleniciler WHERE unvan = $1', [
        c.yukleniciAdi.replace(/\s+/g, ' ').trim(),
      ]);
      if (ykResult.rows.length === 0) continue;
      const yukleniciId = ykResult.rows[0].id;

      // tenders tablosunda var mı?
      let tenderId = null;
      if (c.externalId) {
        const tResult = await query('SELECT id FROM tenders WHERE external_id = $1', [c.externalId]);
        if (tResult.rows.length > 0) {
          tenderId = tResult.rows[0].id;
        }
      }

      // Tarih parse helper (DD.MM.YYYY -> YYYY-MM-DD)
      function parseDateDMY(dateStr) {
        if (!dateStr) return null;
        const parts = dateStr.split('.');
        if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
        return null;
      }

      const sozlesmeTarihi = parseDateDMY(c.sozlesmeTarihi);
      const isBaslangic = parseDateDMY(c.isBaslangic);
      const isBitis = parseDateDMY(c.isBitis);

      // Durum belirle
      let durum = 'bilinmiyor';
      if (c.devamEdiyor) durum = 'devam';
      if (c.tamamlandi) durum = 'tamamlandi';
      if (c.iptalEdildi) durum = 'iptal';
      if (c.fesih && c.fesih.toLowerCase() !== 'yok') durum = 'iptal';
      if (durum === 'bilinmiyor' && c.sozlesmeBedeli) durum = 'tamamlandi';

      if (tenderId) {
        // tender_id varsa ON CONFLICT ile upsert
        await query(
          `
          INSERT INTO yuklenici_ihaleleri (
            yuklenici_id, tender_id, ihale_basligi, kurum_adi, sehir,
            sozlesme_bedeli, sozlesme_tarihi, indirim_orani, rol, durum, fesih_durumu, ikn,
            yaklasik_maliyet, is_baslangic, is_bitis
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'yuklenici', $9, $10, $11, $12, $13, $14)
          ON CONFLICT (yuklenici_id, tender_id, rol) DO UPDATE SET
            ihale_basligi = COALESCE(EXCLUDED.ihale_basligi, yuklenici_ihaleleri.ihale_basligi),
            kurum_adi = COALESCE(EXCLUDED.kurum_adi, yuklenici_ihaleleri.kurum_adi),
            sehir = COALESCE(EXCLUDED.sehir, yuklenici_ihaleleri.sehir),
            sozlesme_bedeli = COALESCE(EXCLUDED.sozlesme_bedeli, yuklenici_ihaleleri.sozlesme_bedeli),
            sozlesme_tarihi = COALESCE(EXCLUDED.sozlesme_tarihi, yuklenici_ihaleleri.sozlesme_tarihi),
            indirim_orani = COALESCE(EXCLUDED.indirim_orani, yuklenici_ihaleleri.indirim_orani),
            durum = EXCLUDED.durum,
            fesih_durumu = COALESCE(EXCLUDED.fesih_durumu, yuklenici_ihaleleri.fesih_durumu),
            yaklasik_maliyet = COALESCE(EXCLUDED.yaklasik_maliyet, yuklenici_ihaleleri.yaklasik_maliyet),
            is_baslangic = COALESCE(EXCLUDED.is_baslangic, yuklenici_ihaleleri.is_baslangic),
            is_bitis = COALESCE(EXCLUDED.is_bitis, yuklenici_ihaleleri.is_bitis)
        `,
          [
            yukleniciId,
            tenderId,
            c.ihaleBasligi,
            c.kurum,
            c.sehir,
            c.sozlesmeBedeli,
            sozlesmeTarihi,
            c.indirimOrani,
            durum,
            c.fesih || null,
            c.ikn,
            c.yaklasikMaliyet || null,
            isBaslangic,
            isBitis,
          ]
        );
      } else {
        // tender_id yoksa IKN ile duplicate kontrolü yap
        const existing = c.ikn
          ? await query('SELECT id FROM yuklenici_ihaleleri WHERE yuklenici_id = $1 AND ikn = $2 AND rol = $3', [
              yukleniciId,
              c.ikn,
              'yuklenici',
            ])
          : { rows: [] };

        if (existing.rows.length === 0) {
          await query(
            `
            INSERT INTO yuklenici_ihaleleri (
              yuklenici_id, tender_id, ihale_basligi, kurum_adi, sehir,
              sozlesme_bedeli, sozlesme_tarihi, indirim_orani, rol, durum, fesih_durumu, ikn,
              yaklasik_maliyet, is_baslangic, is_bitis
            ) VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, 'yuklenici', $8, $9, $10, $11, $12, $13)
          `,
            [
              yukleniciId,
              c.ihaleBasligi,
              c.kurum,
              c.sehir,
              c.sozlesmeBedeli,
              sozlesmeTarihi,
              c.indirimOrani,
              durum,
              c.fesih || null,
              c.ikn,
              c.yaklasikMaliyet || null,
              isBaslangic,
              isBitis,
            ]
          );
        }
      }
    } catch (_e) {
      // Tek kayıt hatası diğerlerini etkilemesin
    }
  }
}

export default { scrapeContractorList };
