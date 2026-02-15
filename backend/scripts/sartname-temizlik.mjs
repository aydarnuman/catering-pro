#!/usr/bin/env node
/**
 * Şartname Gramaj Kuralları Temizlik Scripti
 *
 * Sorun: AI (Claude) şartname kuralları üretirken tüm malzeme havuzunu her alt tipe
 * kopyalamış. Örneğin "Tavuklu Çorba" alt tipinde Bisküvi, Simit, Pizza Hamuru gibi
 * 63 kural var; olması gereken 3-8 kural.
 *
 * Çözüm: Her alt tip için Claude'a sorup o yemeğe ait malzemeleri belirle,
 * geri kalanları deaktive et (silmez, aktif=false yapar).
 *
 * Kullanım:
 *   node scripts/sartname-temizlik.mjs --dry-run                    # Sadece rapor
 *   node scripts/sartname-temizlik.mjs --dry-run --sartname-id 12   # Tek şartname rapor
 *   node scripts/sartname-temizlik.mjs                              # Tüm bozuk şartnameleri temizle
 *   node scripts/sartname-temizlik.mjs --sartname-id 12             # Tek şartname temizle
 *   node scripts/sartname-temizlik.mjs --geri-al                    # Son temizliği geri al
 *   node scripts/sartname-temizlik.mjs --geri-al --sartname-id 12   # Tek şartname geri al
 */

import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});
async function query(text, params) {
  return pool.query(text, params);
}

// ── CLI argümanları ──
const args = process.argv.slice(2);
function hasFlag(name) {
  return args.includes(name);
}
function argVal(name, def) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}

const DRY_RUN = hasFlag('--dry-run');
const GERI_AL = hasFlag('--geri-al');
const SARTNAME_ID = argVal('--sartname-id', null);
const BOZUK_ESIK = 10; // alt tip başına >10 kural = bozuk
const TEMIZLIK_BATCH_ID = `temizlik_${new Date().toISOString().replace(/[:.]/g, '-')}`;

// ── Renkli çıktı ──
const C = {
  r: '\x1b[31m',
  g: '\x1b[32m',
  y: '\x1b[33m',
  b: '\x1b[34m',
  m: '\x1b[35m',
  c: '\x1b[36m',
  w: '\x1b[37m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
};
function log(msg) {
  console.log(msg);
}

// ── Claude AI Client ──
function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error(`${C.r}ANTHROPIC_API_KEY env değişkeni gerekli!${C.reset}`);
    process.exit(1);
  }
  return new Anthropic({ apiKey });
}

/**
 * Claude'a bir alt tip için hangi malzemelerin mantıklı olduğunu sor
 */
async function aiFilterMalzemeler(client, altTipAdi, altTipKodu, malzemeTipleri) {
  const prompt = `Türk toplu yemek (catering) sektöründe "${altTipAdi}" (kod: ${altTipKodu}) yemek alt tipi için bir gramaj şartnamesi hazırlanıyor.

Aşağıdaki malzeme tiplerinden HANGİLERİ bu yemek tipinin PORSIYON gramaj kuralında bulunmalı?

Mevcut malzeme listesi:
${malzemeTipleri.map((m) => `- ${m}`).join('\n')}

KURALLAR:
- SADECE bu yemek tipinde gerçekten kullanılan malzemeleri seç
- Bir çorbada Bisküvi, Simit, Pizza Hamuru OLAMAZ
- Bir tatlıda Çiğ et, Balık OLAMAZ
- Her yemek tipi için genellikle 3-8 arasında ana malzeme olur
- Baharatları (tuz, karabiber, kimyon vb.) dahil et SADECE o yemek tipinin karakteristik baharatıysa
- Ortak malzemeler (sıvı yağ, tuz) çoğu yemek tipinde olabilir

Sadece JSON array döndür, açıklama ekleme:
["Malzeme1", "Malzeme2", ...]`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    temperature: 0,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0]?.text || '[]';
  try {
    const jsonStr = text
      .replace(/```json?\n?/g, '')
      .replace(/```/g, '')
      .trim();
    return JSON.parse(jsonStr);
  } catch {
    console.error(`  ${C.r}AI yanıtı parse edilemedi: ${text.slice(0, 200)}${C.reset}`);
    return null;
  }
}

/**
 * Bozuk şartnameleri bul (alt tip başına >BOZUK_ESIK kural)
 */
async function bozukSartnameleriGetir() {
  const result = await query(`
    SELECT 
      ps.id as sartname_id,
      ps.ad as sartname_adi,
      COUNT(*) as toplam_kural,
      COUNT(DISTINCT sgk.alt_tip_id) as alt_tip_sayisi,
      ROUND(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT sgk.alt_tip_id), 0), 1) as ort_kural
    FROM proje_sartnameleri ps
    JOIN sartname_gramaj_kurallari sgk ON sgk.sartname_id = ps.id AND sgk.aktif = true
    GROUP BY ps.id, ps.ad
    HAVING ROUND(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT sgk.alt_tip_id), 0), 1) > $1
    ORDER BY COUNT(*) DESC
  `, [BOZUK_ESIK]);
  return result.rows;
}

/**
 * Bir şartname için alt tip bazlı kuralları getir
 */
async function altTipKurallariniGetir(sartnameId) {
  const result = await query(`
    SELECT sgk.id, sgk.alt_tip_id, sgk.malzeme_tipi, sgk.gramaj, sgk.birim,
           att.ad as alt_tip_adi, att.kod as alt_tip_kodu
    FROM sartname_gramaj_kurallari sgk
    JOIN alt_tip_tanimlari att ON att.id = sgk.alt_tip_id
    WHERE sgk.sartname_id = $1 AND sgk.aktif = true
    ORDER BY sgk.alt_tip_id, sgk.malzeme_tipi
  `, [sartnameId]);

  // Alt tipe göre grupla
  const grouped = new Map();
  for (const row of result.rows) {
    const key = row.alt_tip_id;
    if (!grouped.has(key)) {
      grouped.set(key, {
        alt_tip_id: row.alt_tip_id,
        alt_tip_adi: row.alt_tip_adi,
        alt_tip_kodu: row.alt_tip_kodu,
        kurallar: [],
      });
    }
    grouped.get(key).kurallar.push(row);
  }
  return [...grouped.values()];
}

/**
 * Bir şartnameyi temizle
 */
async function sartnameTemizle(sartnameId, sartnameAdi, client) {
  log(`\n${C.bold}${C.c}═══ ${sartnameAdi} (ID: ${sartnameId}) ═══${C.reset}`);

  const altTipGruplari = await altTipKurallariniGetir(sartnameId);
  let toplamDeaktive = 0;
  let toplamKorunan = 0;
  let toplamAltTip = 0;
  let atlamaAltTip = 0;
  const detaylar = [];

  for (const grup of altTipGruplari) {
    const kuralSayisi = grup.kurallar.length;

    // Zaten az kuralı olan alt tipleri atla
    if (kuralSayisi <= BOZUK_ESIK) {
      atlamaAltTip++;
      toplamKorunan += kuralSayisi;
      continue;
    }

    toplamAltTip++;
    const malzemeTipleri = grup.kurallar.map((k) => k.malzeme_tipi);

    // Claude'a sor
    const uygunMalzemeler = await aiFilterMalzemeler(
      client,
      grup.alt_tip_adi,
      grup.alt_tip_kodu,
      malzemeTipleri
    );

    if (!uygunMalzemeler) {
      log(`  ${C.y}⚠ ${grup.alt_tip_adi}: AI yanıtı alınamadı, atlanıyor${C.reset}`);
      continue;
    }

    const uygunSet = new Set(uygunMalzemeler.map((m) => m.toLowerCase()));
    const korunanlar = [];
    const deaktiveEdilecekler = [];

    for (const kural of grup.kurallar) {
      if (uygunSet.has(kural.malzeme_tipi.toLowerCase())) {
        korunanlar.push(kural);
      } else {
        deaktiveEdilecekler.push(kural);
      }
    }

    const deaktiveSayisi = deaktiveEdilecekler.length;
    const korunanSayisi = korunanlar.length;
    toplamDeaktive += deaktiveSayisi;
    toplamKorunan += korunanSayisi;

    // Güvenlik: AI çok fazla siliyorsa (1'den az bırakıyorsa) atla
    if (korunanSayisi < 1) {
      log(`  ${C.r}✗ ${grup.alt_tip_adi}: AI hiç malzeme bırakmadı (${kuralSayisi} kural), atlanıyor${C.reset}`);
      toplamDeaktive -= deaktiveSayisi; // geri al
      toplamKorunan += deaktiveSayisi;
      continue;
    }

    const prefix = DRY_RUN ? '[DRY-RUN] ' : '';
    log(
      `  ${C.g}${prefix}${grup.alt_tip_adi}${C.reset}: ${kuralSayisi} → ${C.bold}${korunanSayisi}${C.reset} kural ` +
        `${C.dim}(${deaktiveSayisi} deaktive)${C.reset}`
    );

    if (!DRY_RUN && deaktiveSayisi > 0) {
      const ids = deaktiveEdilecekler.map((k) => k.id);
      await query(
        `UPDATE sartname_gramaj_kurallari 
         SET aktif = false, 
             aciklama = COALESCE(aciklama, '') || ' [' || $2 || ']'
         WHERE id = ANY($1)`,
        [ids, TEMIZLIK_BATCH_ID]
      );
    }

    detaylar.push({
      alt_tip: grup.alt_tip_adi,
      alt_tip_kod: grup.alt_tip_kodu,
      onceki: kuralSayisi,
      sonra: korunanSayisi,
      silinen: deaktiveSayisi,
      korunanMalzemeler: korunanlar.map((k) => k.malzeme_tipi),
      silinenMalzemeler: deaktiveEdilecekler.map((k) => k.malzeme_tipi),
    });

    // Rate limit — Claude API
    await new Promise((r) => setTimeout(r, 300));
  }

  log(`\n  ${C.bold}Özet:${C.reset}`);
  log(`    Kontrol edilen alt tipler: ${toplamAltTip} (${atlamaAltTip} atlanan — zaten ≤${BOZUK_ESIK} kural)`);
  log(`    ${C.g}Korunan kurallar: ${toplamKorunan}${C.reset}`);
  log(`    ${C.r}Deaktive edilen: ${toplamDeaktive}${C.reset}`);

  return { sartnameId, sartnameAdi, toplamDeaktive, toplamKorunan, toplamAltTip, detaylar };
}

/**
 * Son temizliği geri al
 */
async function geriAl(sartnameId) {
  log(`\n${C.bold}${C.y}═══ GERİ ALMA ═══${C.reset}`);

  // En son batch ID'yi bul
  let whereClause = "aciklama LIKE '%[temizlik_%'";
  const params = [];

  if (sartnameId) {
    whereClause += ' AND sartname_id = $1';
    params.push(sartnameId);
  }

  const lastBatch = await query(`
    SELECT DISTINCT 
      substring(aciklama from '\\[temizlik_[^\\]]+\\]') as batch
    FROM sartname_gramaj_kurallari
    WHERE ${whereClause} AND aktif = false
    ORDER BY batch DESC
    LIMIT 1
  `, params);

  if (lastBatch.rows.length === 0) {
    log(`  ${C.y}Geri alınacak temizlik bulunamadı.${C.reset}`);
    return;
  }

  const batchTag = lastBatch.rows[0].batch;
  log(`  Son temizlik batch: ${C.c}${batchTag}${C.reset}`);

  const countResult = await query(`
    SELECT COUNT(*) as sayi
    FROM sartname_gramaj_kurallari
    WHERE aciklama LIKE $1 AND aktif = false
    ${sartnameId ? 'AND sartname_id = $2' : ''}
  `, sartnameId ? [`%${batchTag}%`, sartnameId] : [`%${batchTag}%`]);

  const sayi = countResult.rows[0].sayi;
  log(`  ${C.bold}${sayi}${C.reset} kural geri aktive edilecek`);

  if (DRY_RUN) {
    log(`  ${C.y}[DRY-RUN] Değişiklik yapılmadı${C.reset}`);
    return;
  }

  await query(`
    UPDATE sartname_gramaj_kurallari 
    SET aktif = true,
        aciklama = REPLACE(aciklama, ' ${batchTag}', '')
    WHERE aciklama LIKE $1 AND aktif = false
    ${sartnameId ? 'AND sartname_id = $2' : ''}
  `, sartnameId ? [`%${batchTag}%`, sartnameId] : [`%${batchTag}%`]);

  log(`  ${C.g}✓ ${sayi} kural geri aktive edildi${C.reset}`);
}

// ── Ana akış ──
async function main() {
  log(`${C.bold}${C.m}╔═══════════════════════════════════════════════════╗${C.reset}`);
  log(`${C.bold}${C.m}║  Şartname Gramaj Kuralları Temizlik Scripti       ║${C.reset}`);
  log(`${C.bold}${C.m}╚═══════════════════════════════════════════════════╝${C.reset}`);
  log('');

  if (DRY_RUN) log(`${C.y}⚡ DRY-RUN modu: Hiçbir değişiklik yapılmayacak${C.reset}\n`);

  // Geri alma modu
  if (GERI_AL) {
    await geriAl(SARTNAME_ID ? Number(SARTNAME_ID) : null);
    await pool.end();
    return;
  }

  // Bozuk şartnameleri bul
  let bozuklar = await bozukSartnameleriGetir();

  if (SARTNAME_ID) {
    bozuklar = bozuklar.filter((b) => b.sartname_id === Number(SARTNAME_ID));
    if (bozuklar.length === 0) {
      // Belirtilen şartname bozuk değilse bile zorla işle
      const tek = await query(
        `SELECT ps.id as sartname_id, ps.ad as sartname_adi, COUNT(*) as toplam_kural,
                COUNT(DISTINCT sgk.alt_tip_id) as alt_tip_sayisi,
                ROUND(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT sgk.alt_tip_id), 0), 1) as ort_kural
         FROM proje_sartnameleri ps
         JOIN sartname_gramaj_kurallari sgk ON sgk.sartname_id = ps.id AND sgk.aktif = true
         WHERE ps.id = $1
         GROUP BY ps.id, ps.ad`,
        [SARTNAME_ID]
      );
      if (tek.rows.length > 0) bozuklar = tek.rows;
    }
  }

  if (bozuklar.length === 0) {
    log(`${C.g}✓ Bozuk şartname bulunamadı (alt tip başına >${BOZUK_ESIK} kural eşiği)${C.reset}`);
    await pool.end();
    return;
  }

  log(`${C.bold}Bozuk şartnameler:${C.reset}`);
  for (const b of bozuklar) {
    log(
      `  ${C.r}•${C.reset} ${b.sartname_adi} — ${b.toplam_kural} kural, ` +
        `${b.alt_tip_sayisi} alt tip, ort: ${b.ort_kural}/alt tip`
    );
  }

  const client = getClient();
  const sonuclar = [];
  let genelToplamDeaktive = 0;
  let genelToplamKorunan = 0;

  for (const sartname of bozuklar) {
    const sonuc = await sartnameTemizle(sartname.sartname_id, sartname.sartname_adi, client);
    sonuclar.push(sonuc);
    genelToplamDeaktive += sonuc.toplamDeaktive;
    genelToplamKorunan += sonuc.toplamKorunan;
  }

  // Genel özet
  log(`\n${C.bold}${C.m}════════════════════════════════════════${C.reset}`);
  log(`${C.bold}GENEL ÖZET${C.reset}`);
  log(`${C.m}════════════════════════════════════════${C.reset}`);
  log(`  Şartname sayısı: ${sonuclar.length}`);
  log(`  ${C.g}Korunan toplam kural: ${genelToplamKorunan}${C.reset}`);
  log(`  ${C.r}Deaktive edilen toplam: ${genelToplamDeaktive}${C.reset}`);
  if (DRY_RUN) {
    log(`\n  ${C.y}Bu bir DRY-RUN idi. Gerçek temizlik için --dry-run olmadan çalıştırın.${C.reset}`);
  } else {
    log(`\n  ${C.g}Batch ID: ${TEMIZLIK_BATCH_ID}${C.reset}`);
    log(`  ${C.dim}Geri almak için: node scripts/sartname-temizlik.mjs --geri-al${C.reset}`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error(`${C.r}HATA: ${err.message}${C.reset}`);
  console.error(err.stack);
  pool.end();
  process.exit(1);
});
