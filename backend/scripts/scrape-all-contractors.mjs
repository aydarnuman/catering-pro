#!/usr/bin/env node
/**
 * Tüm yüklenicilerin ihale geçmişini çek
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import puppeteer from 'puppeteer';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// ── Tüm yüklenicileri al ──
const { data: yukleniciler } = await supabase
  .from('yukleniciler')
  .select('id, unvan')
  .order('katildigi_ihale_sayisi', { ascending: false });

console.log(`\n🏗️  ${yukleniciler.length} yüklenici bulundu\n`);

// ── Browser + Login ──
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });

const loginService = (await import('../src/scraper/shared/ihalebul-login.js')).default;
await loginService.ensureLoggedIn(page);
console.log('✅ Login OK\n');

const PHASES = [
  { label: 'Devam eden', path: '/contracted', extra: '&workend=%3E0', defaultDurum: 'devam' },
  { label: 'Tamamlanan', path: '/contracted', extra: '&workend=%3C0', defaultDurum: 'tamamlandi' },
];

let grandTotal = 0;

for (const yk of yukleniciler) {
  console.log(`\n━━━ ${yk.unvan.substring(0, 55)} (ID:${yk.id}) ━━━`);

  const encoded = encodeURIComponent(yk.unvan.toLocaleUpperCase('tr-TR')).replace(/%20/g, '+');
  const seenIds = new Set();
  const allTenders = [];

  for (const phase of PHASES) {
    const baseUrl = `https://www.ihalebul.com/tenders/search${phase.path}?workcategory_in=15&contractortitle_in=${encoded}${phase.extra}`;
    let pageNum = 1;
    let phaseCount = 0;

    while (pageNum <= 20) {
      // Login kontrol
      if (!(await page.evaluate(() => document.body?.innerText?.includes('Çıkış')).catch(() => false))) {
        await loginService.ensureLoggedIn(page);
      }

      const url = pageNum === 1 ? baseUrl : `${baseUrl}&page=${pageNum}`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 2000));
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
      await new Promise(r => setTimeout(r, 1500));

      const tenders = await page.evaluate(() => {
        const results = [];
        document.querySelectorAll('.card.border-secondary.my-2.mx-1').forEach(card => {
          try {
            const text = card.textContent;
            const link = Array.from(card.querySelectorAll('a[href*="/tender/"]')).find(a => a.href.match(/\/tender\/\d+$/));
            if (!link) return;
            const externalId = link.href.match(/\/tender\/(\d+)$/)?.[1];
            const baslik = link.textContent.trim();
            const badge = card.querySelector('.badge.text-info');
            const ikn = badge?.textContent.trim().replace(/^#/, '') || null;
            const kurumMatch = text.match(/(?:İdare adı|İdarenin adı)[:\s]+([^\n]+)/i);
            const bedelMatch = text.match(/Sözleşme bedeli:\s*₺?([\d.,]+)/i);
            const tarihMatch = text.match(/Sözleşme tarihi:\s*([\d.]+)/i);
            const indirimMatch = text.match(/%\s*([\d.,]+)/);
            const nonLoc = ['Ekap','Gazete','İstihbarat','Özel Sektör','Açık ihale','Belli istekliler','Pazarlık','Doğrudan'];
            const locDivs = Array.from(card.querySelectorAll('.text-dark-emphasis.fw-medium.text-nowrap'))
              .map(d => d.textContent.trim()).filter(t => t.length > 0 && t.length <= 30 && !nonLoc.some(n => t.includes(n)));
            results.push({
              externalId, baslik, ikn,
              kurum: kurumMatch?.[1]?.trim() || null,
              sehir: locDivs.length >= 2 ? locDivs[1] : locDivs[0] || null,
              sozlesmeBedeli: bedelMatch ? parseFloat(bedelMatch[1].replace(/\./g, '').replace(',', '.')) : null,
              sozlesmeTarihi: tarihMatch?.[1] || null,
              indirimOrani: indirimMatch ? parseFloat(indirimMatch[1].replace(',', '.')) : null,
              tamamlandi: text.includes('Tamamlandı'),
              devamEdiyor: text.includes('Devam Ediyor') || text.includes('Sözleşme Devam') || text.includes('İş Devam'),
              iptalEdildi: text.includes('İptal'),
              fesih: text.match(/Fesih[:\s]+([^\n]+)/i)?.[1]?.trim() || null,
            });
          } catch(_) {}
        });
        return results;
      }).catch(() => []);

      if (tenders.length === 0) break;

      for (const t of tenders) {
        if (t.externalId && seenIds.has(t.externalId)) continue;
        if (t.externalId) seenIds.add(t.externalId);
        t._durum = phase.defaultDurum;
        allTenders.push(t);
        phaseCount++;
      }

      const hasNext = await page.evaluate(cur => {
        const sel = document.querySelector('select[name="page"]');
        return sel ? cur < sel.querySelectorAll('option').length : false;
      }, pageNum).catch(() => false);

      if (!hasNext) break;
      pageNum++;
      await new Promise(r => setTimeout(r, 1500 + Math.random() * 1500));
    }

    if (phaseCount > 0) process.stdout.write(`  ${phase.label}: ${phaseCount}`);
  }

  if (allTenders.length === 0) { console.log('  → 0 ihale'); continue; }
  console.log(`  → Toplam: ${allTenders.length}`);

  // DB'ye kaydet
  let saved = 0;
  for (const t of allTenders) {
    let sozlesmeTarihi = null;
    if (t.sozlesmeTarihi) {
      const p = t.sozlesmeTarihi.split('.');
      if (p.length === 3) sozlesmeTarihi = `${p[2]}-${p[1]}-${p[0]}`;
    }
    let durum = t._durum || 'bilinmiyor';
    if (t.devamEdiyor) durum = 'devam';
    if (t.tamamlandi) durum = 'tamamlandi';
    if (t.iptalEdildi) durum = 'iptal';
    if (t.fesih && t.fesih.toLowerCase() !== 'yok') durum = 'iptal';
    if (durum === 'bilinmiyor' && t.sozlesmeBedeli) durum = 'tamamlandi';

    let tenderId = null;
    if (t.externalId) {
      const { data: td } = await supabase.from('tenders').select('id').eq('external_id', t.externalId).maybeSingle();
      if (td) tenderId = td.id;
    }

    try {
      if (tenderId) {
        await supabase.from('yuklenici_ihaleleri').upsert({
          yuklenici_id: yk.id, tender_id: tenderId, ihale_basligi: t.baslik,
          kurum_adi: t.kurum, sehir: t.sehir, sozlesme_bedeli: t.sozlesmeBedeli,
          sozlesme_tarihi: sozlesmeTarihi, indirim_orani: t.indirimOrani,
          rol: 'yuklenici', durum, fesih_durumu: t.fesih || null, ikn: t.ikn,
        }, { onConflict: 'yuklenici_id,tender_id,rol' });
      } else {
        if (t.ikn) {
          const { data: ex } = await supabase.from('yuklenici_ihaleleri')
            .select('id').eq('yuklenici_id', yk.id).eq('ikn', t.ikn).eq('rol', 'yuklenici').maybeSingle();
          if (ex) { saved++; continue; }
        }
        await supabase.from('yuklenici_ihaleleri').insert({
          yuklenici_id: yk.id, tender_id: null, ihale_basligi: t.baslik,
          kurum_adi: t.kurum, sehir: t.sehir, sozlesme_bedeli: t.sozlesmeBedeli,
          sozlesme_tarihi: sozlesmeTarihi, indirim_orani: t.indirimOrani,
          rol: 'yuklenici', durum, fesih_durumu: t.fesih || null, ikn: t.ikn,
        });
      }
      saved++;
    } catch(_) {}
  }

  // İstatistik güncelle
  const { count: total } = await supabase.from('yuklenici_ihaleleri').select('id', { count: 'exact', head: true }).eq('yuklenici_id', yk.id);
  const { count: tam } = await supabase.from('yuklenici_ihaleleri').select('id', { count: 'exact', head: true }).eq('yuklenici_id', yk.id).eq('durum', 'tamamlandi');
  const { count: dev } = await supabase.from('yuklenici_ihaleleri').select('id', { count: 'exact', head: true }).eq('yuklenici_id', yk.id).eq('durum', 'devam');

  await supabase.from('yukleniciler').update({
    katildigi_ihale_sayisi: total, tamamlanan_is_sayisi: tam, devam_eden_is_sayisi: dev,
    scraped_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq('id', yk.id);

  console.log(`  ✅ ${saved} kaydedildi → DB: ${total} (${tam} tam, ${dev} devam)`);
  grandTotal += saved;

  // Rate limit
  await new Promise(r => setTimeout(r, 2000));
}

console.log(`\n🎉 Tamamlandı! Toplam ${grandTotal} ihale kaydedildi.`);
await browser.close();
process.exit(0);
