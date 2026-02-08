#!/usr/bin/env node
/**
 * Tek yüklenici ihale geçmişi çekici
 * Kullanım: node scripts/scrape-contractor-tenders.mjs [yuklenici_id]
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import puppeteer from 'puppeteer';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const YUKLENICI_ID = parseInt(process.argv[2] || '5', 10);

// ── Yükleniciyi DB'den al ──
const { data: yk, error: ykErr } = await supabase
  .from('yukleniciler')
  .select('id, unvan')
  .eq('id', YUKLENICI_ID)
  .single();

if (ykErr || !yk) { console.error('Yüklenici bulunamadı:', ykErr?.message); process.exit(1); }
console.log(`\n🏢 ${yk.unvan}\n`);

// ── Türkçe büyük harf + encode ──
const upperName = yk.unvan.toLocaleUpperCase('tr-TR');
const encoded = encodeURIComponent(upperName).replace(/%20/g, '+');

// ── Browser aç ──
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });

// ── Login (mevcut login service'i kullan) ──
console.log('🔐 Login...');
const loginService = (await import('../src/scraper/shared/ihalebul-login.js')).default;
await loginService.ensureLoggedIn(page);
console.log('✅ Login OK\n');

// ── Fazlar ──
const PHASES = [
  { label: 'Devam eden', path: '/contracted', extra: '&workend=%3E0', defaultDurum: 'devam' },
  { label: 'Tamamlanan', path: '/contracted', extra: '&workend=%3C0', defaultDurum: 'tamamlandi' },
];

const allTenders = [];
const seenIds = new Set();

for (const phase of PHASES) {
  const baseUrl = `https://www.ihalebul.com/tenders/search${phase.path}?workcategory_in=15&contractortitle_in=${encoded}${phase.extra}`;
  
  let pageNum = 1;
  let phaseCount = 0;
  
  while (pageNum <= 20) {
    const url = pageNum === 1 ? baseUrl : `${baseUrl}&page=${pageNum}`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
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
          const sehir = locDivs.length >= 2 ? locDivs[1] : locDivs[0] || null;
          results.push({
            externalId, baslik, ikn,
            kurum: kurumMatch?.[1]?.trim() || null,
            sehir,
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
    });

    if (tenders.length === 0) break;

    for (const t of tenders) {
      if (t.externalId && seenIds.has(t.externalId)) continue;
      if (t.externalId) seenIds.add(t.externalId);
      t._durum = phase.defaultDurum; // faz bazlı durum
      allTenders.push(t);
      phaseCount++;
    }

    // Sonraki sayfa?
    const hasNext = await page.evaluate(cur => {
      const sel = document.querySelector('select[name="page"]');
      return sel ? cur < sel.querySelectorAll('option').length : false;
    }, pageNum);

    if (!hasNext) break;
    pageNum++;
    await new Promise(r => setTimeout(r, 1500 + Math.random() * 1500));
  }
  
  console.log(`📋 ${phase.label}: ${phaseCount} ihale (${pageNum} sayfa)`);
}

console.log(`\n📊 Toplam: ${allTenders.length} ihale bulundu`);

// ── DB'ye kaydet ──
let saved = 0, errors = 0;

for (const t of allTenders) {
  // Tarih parse
  let sozlesmeTarihi = null;
  if (t.sozlesmeTarihi) {
    const p = t.sozlesmeTarihi.split('.');
    if (p.length === 3) sozlesmeTarihi = `${p[2]}-${p[1]}-${p[0]}`;
  }

  // Durum
  let durum = t._durum || 'bilinmiyor';
  if (t.devamEdiyor) durum = 'devam';
  if (t.tamamlandi) durum = 'tamamlandi';
  if (t.iptalEdildi) durum = 'iptal';
  if (t.fesih && t.fesih.toLowerCase() !== 'yok') durum = 'iptal';
  if (durum === 'bilinmiyor' && t.sozlesmeBedeli) durum = 'tamamlandi';

  // tenders tablosunda var mı?
  let tenderId = null;
  if (t.externalId) {
    const { data: td } = await supabase.from('tenders').select('id').eq('external_id', t.externalId).maybeSingle();
    if (td) tenderId = td.id;
  }

  try {
    if (tenderId) {
      await supabase.from('yuklenici_ihaleleri').upsert({
        yuklenici_id: YUKLENICI_ID, tender_id: tenderId, ihale_basligi: t.baslik,
        kurum_adi: t.kurum, sehir: t.sehir, sozlesme_bedeli: t.sozlesmeBedeli,
        sozlesme_tarihi: sozlesmeTarihi, indirim_orani: t.indirimOrani,
        rol: 'yuklenici', durum, fesih_durumu: t.fesih || null, ikn: t.ikn,
      }, { onConflict: 'yuklenici_id,tender_id,rol' });
    } else {
      // IKN ile duplicate check
      if (t.ikn) {
        const { data: existing } = await supabase.from('yuklenici_ihaleleri')
          .select('id').eq('yuklenici_id', YUKLENICI_ID).eq('ikn', t.ikn).eq('rol', 'yuklenici').maybeSingle();
        if (existing) { saved++; continue; }
      }
      await supabase.from('yuklenici_ihaleleri').insert({
        yuklenici_id: YUKLENICI_ID, tender_id: null, ihale_basligi: t.baslik,
        kurum_adi: t.kurum, sehir: t.sehir, sozlesme_bedeli: t.sozlesmeBedeli,
        sozlesme_tarihi: sozlesmeTarihi, indirim_orani: t.indirimOrani,
        rol: 'yuklenici', durum, fesih_durumu: t.fesih || null, ikn: t.ikn,
      });
    }
    saved++;
  } catch (e) {
    errors++;
    if (errors <= 3) console.error('  ⚠️', t.baslik?.substring(0, 40), e.message?.substring(0, 60));
  }
}

// ── İstatistik güncelle ──
const { count: total } = await supabase.from('yuklenici_ihaleleri').select('id', { count: 'exact', head: true }).eq('yuklenici_id', YUKLENICI_ID);
const { count: tamamlanan } = await supabase.from('yuklenici_ihaleleri').select('id', { count: 'exact', head: true }).eq('yuklenici_id', YUKLENICI_ID).eq('durum', 'tamamlandi');
const { count: devam } = await supabase.from('yuklenici_ihaleleri').select('id', { count: 'exact', head: true }).eq('yuklenici_id', YUKLENICI_ID).eq('durum', 'devam');

await supabase.from('yukleniciler').update({
  katildigi_ihale_sayisi: total,
  tamamlanan_is_sayisi: tamamlanan,
  devam_eden_is_sayisi: devam,
  scraped_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}).eq('id', YUKLENICI_ID);

console.log(`\n✅ ${saved} kaydedildi, ${errors} hata`);
console.log(`📈 DB: ${total} ihale (${tamamlanan} tamamlanan, ${devam} devam eden)`);

await browser.close();
process.exit(0);
