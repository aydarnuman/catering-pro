#!/usr/bin/env node
/**
 * Yüklenici listesini ihalebul.com'dan çek (sadece ad + temel istatistik)
 * Kullanım: node scripts/scrape-contractor-list-full.mjs [maxPages=20]
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import puppeteer from 'puppeteer';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const MAX_PAGES = parseInt(process.argv[2] || '20', 10);

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });

const loginService = (await import('../src/scraper/shared/ihalebul-login.js')).default;
await loginService.ensureLoggedIn(page);
console.log('✅ Login OK\n');

// İlk sayfa - Ara butonuna bas
await page.goto('https://www.ihalebul.com/contractors?workcategory_in=15', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 3000));
await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('button, a'));
  btns.find(b => b.textContent.includes('Ara'))?.click();
});
await new Promise(r => setTimeout(r, 8000));

// Toplam sayfa ve yüklenici sayısı
const totalInfo = await page.evaluate(() => {
  const body = document.body.innerText;
  const totalMatch = body.match(/Toplam bulunan[\s:]*([0-9.]+)/);
  const sel = document.querySelector('select[name="page"]');
  return {
    total: totalMatch?.[1],
    pages: sel ? sel.querySelectorAll('option').length : 0,
  };
});
console.log(`📊 Toplam: ${totalInfo.total} yüklenici, ${totalInfo.pages} sayfa`);
console.log(`📄 ${MAX_PAGES} sayfa taranacak\n`);

const allContractors = [];
let pageNum = 1;

while (pageNum <= Math.min(MAX_PAGES, totalInfo.pages || MAX_PAGES)) {
  if (pageNum > 1) {
    await page.goto(
      `https://ihalebul.com/contractors/search?workcategory_in=15&contractorview_ts_meta=&page=${pageNum}`,
      { waitUntil: 'networkidle2', timeout: 30000 }
    );
    await new Promise(r => setTimeout(r, 4000));
  }

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await new Promise(r => setTimeout(r, 2000));

  const contractors = await page.evaluate(() => {
    const rows = document.querySelectorAll('table tbody tr');
    return Array.from(rows).map(tr => {
      const name = tr.querySelector('td[data-title="Yüklenici adı"]')?.textContent.trim() || '';
      
      // Sayıları çıkar
      const katildigiTd = tr.querySelector('td[data-title="Katıldığı ihaleler"]');
      const devamTd = tr.querySelector('td[data-title="Devam eden işler"]');
      const tamamlananTd = tr.querySelector('td[data-title="Tamamlanan işler"]');
      const toplamTd = tr.querySelector('td[data-title="Toplam sözleşme"]');

      const parseNum = (td) => {
        if (!td) return 0;
        const m = td.textContent.match(/([\d.]+)\s*İhale/);
        return m ? parseInt(m[1].replace(/\./g, ''), 10) : 0;
      };
      const parseMoney = (td) => {
        if (!td) return 0;
        const m = td.textContent.match(/₺([\d.,]+)/);
        return m ? parseFloat(m[1].replace(/\./g, '').replace(',', '.')) : 0;
      };

      // Analyze linki
      const analyzeLink = tr.querySelector('a[href*="/analyze"]')?.href || null;

      return {
        name,
        katildigi: parseNum(katildigiTd),
        devam: parseNum(devamTd),
        tamamlanan: parseNum(tamamlananTd),
        toplamBedel: parseMoney(toplamTd),
        analyzeLink,
      };
    }).filter(c => c.name.length > 2);
  });

  allContractors.push(...contractors);
  process.stdout.write(`  Sayfa ${pageNum}: ${contractors.length} yüklenici (toplam: ${allContractors.length})\r\n`);

  pageNum++;
  await new Promise(r => setTimeout(r, 1500 + Math.random() * 1500));
}

console.log(`\n📋 ${allContractors.length} yüklenici bulundu. DB'ye kaydediliyor...\n`);

let newCount = 0, updatedCount = 0;

for (const c of allContractors) {
  const { data, error } = await supabase.from('yukleniciler')
    .upsert({
      unvan: c.name.replace(/\s+/g, ' ').trim(),
      katildigi_ihale_sayisi: c.katildigi,
      tamamlanan_is_sayisi: c.tamamlanan,
      devam_eden_is_sayisi: c.devam,
      toplam_sozlesme_bedeli: c.toplamBedel,
      ihalebul_url: c.analyzeLink,
      veri_kaynaklari: ['ihalebul'],
      scraped_at: new Date().toISOString(),
    }, { onConflict: 'unvan', ignoreDuplicates: false })
    .select('id');

  if (data?.[0]) {
    // Yeni mi güncelleme mi belirsiz, ama sorun değil
    newCount++;
  }
}

// Sonuç
const { count } = await supabase.from('yukleniciler').select('id', { count: 'exact', head: true });
console.log(`✅ Tamamlandı!`);
console.log(`   Toplam DB'deki yüklenici: ${count}`);
console.log(`   Bu turda işlenen: ${allContractors.length}`);

await browser.close();
process.exit(0);
