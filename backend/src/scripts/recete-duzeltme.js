/**
 * Reçete Toplu AI Düzeltme Scripti
 *
 * 4 kategoride sorunlu reçeteleri tespit edip otomatik düzeltir:
 * 1. Hazır ürünler (yapım tarifi yerine hazır fiyat)
 * 2. Malzemesiz reçeteler (AI ile malzeme önerisi)
 * 3. Az malzemeli reçeteler (AI ile tamamlama)
 * 4. Maliyet anomalileri (AI ile yeniden oluşturma)
 *
 * Çalıştırma: cd backend && node src/scripts/recete-duzeltme.js
 */

// ENV LOADER MUST BE FIRST
import '../env-loader.js';

import { query } from '../database.js';
import aiAgent from '../services/ai-agent.js';
import { hesaplaReceteMaliyet } from '../services/maliyet-hesaplama-service.js';

// ─── Helpers ──────────────────────────────────────────────────

function log(msg) {
  console.log(`[${new Date().toLocaleTimeString('tr-TR')}] ${msg}`);
}

function logSection(title) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'═'.repeat(60)}`);
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Ürün kartları cache ──────────────────────────────────────

let urunKartlariCache = null;

async function getUrunKartlari() {
  if (urunKartlariCache) return urunKartlariCache;

  const result = await query(`
    SELECT uk.id, uk.ad, uk.varsayilan_birim as birim,
      kat.ad as kategori,
      COALESCE(uk.manuel_fiyat, uk.aktif_fiyat, uk.son_alis_fiyati) as fiyat
    FROM urun_kartlari uk
    LEFT JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
    WHERE uk.aktif = true
    ORDER BY kat.sira, uk.ad
  `);

  urunKartlariCache = result.rows.map((uk) => ({
    id: uk.id,
    ad: uk.ad,
    birim: uk.birim || 'gr',
    kategori: uk.kategori,
    fiyat: Number.parseFloat(uk.fiyat) || 0,
  }));

  return urunKartlariCache;
}

function getUrunListesiText(urunKartlari) {
  const kategorili = {};
  for (const uk of urunKartlari) {
    const kat = uk.kategori || 'Diger';
    if (!kategorili[kat]) kategorili[kat] = [];
    kategorili[kat].push(uk.ad);
  }
  return Object.entries(kategorili)
    .map(([kat, urunler]) => `${kat}: ${urunler.join(', ')}`)
    .join('\n');
}

function matchUrunKarti(malzemeAdi, urunKartlari) {
  const malLower = malzemeAdi.toLowerCase().trim();

  // Birebir eşleşme
  let match = urunKartlari.find((uk) => uk.ad.toLowerCase().trim() === malLower);

  // Fuzzy match
  if (!match) {
    match = urunKartlari.find((uk) => {
      const ukLower = uk.ad.toLowerCase().trim();
      return ukLower.includes(malLower) || malLower.includes(ukLower);
    });
  }

  return match;
}

// ─── ADIM 1: Hazır Ürün Düzeltme ─────────────────────────────

const HAZIR_URUN_MAP = {
  'Beyaz Peynir': { miktar: 60, birim: 'gr', beklenen_fiyat: 8 },
  'Kaşar Peynir': { miktar: 40, birim: 'gr', beklenen_fiyat: 6 },
  Ekmek: { miktar: 125, birim: 'gr', beklenen_fiyat: 4 },
  Simit: { miktar: 120, birim: 'adet', beklenen_fiyat: 10 },
  Yoğurt: { miktar: 150, birim: 'gr', beklenen_fiyat: 8 },
  Ayran: { miktar: 200, birim: 'ml', beklenen_fiyat: 5 },
  Bal: { miktar: 25, birim: 'gr', beklenen_fiyat: 6 },
  Reçel: { miktar: 30, birim: 'gr', beklenen_fiyat: 5 },
  Zeytin: { miktar: 40, birim: 'gr', beklenen_fiyat: 5 },
  Tereyağı: { miktar: 15, birim: 'gr', beklenen_fiyat: 4 },
};

async function adim1HazirUrunDuzelt() {
  logSection('ADIM 1: Hazir Urun Duzeltme');

  const urunKartlari = await getUrunKartlari();
  let duzeltilen = 0;

  for (const [receteAd, config] of Object.entries(HAZIR_URUN_MAP)) {
    // Receteyi bul
    const receteResult = await query('SELECT id, ad, tahmini_maliyet FROM receteler WHERE ad = $1 AND aktif = true', [
      receteAd,
    ]);

    if (receteResult.rows.length === 0) continue;
    const recete = receteResult.rows[0];
    const oncekiMaliyet = Number(recete.tahmini_maliyet) || 0;

    // Mevcut malzemeleri kontrol et - 3+ malzeme varsa yapım tarifi, düzelt
    const malzemeCount = await query('SELECT count(*) as c FROM recete_malzemeler WHERE recete_id = $1', [recete.id]);

    const count = Number(malzemeCount.rows[0].c);
    if (count <= 1 && oncekiMaliyet < config.beklenen_fiyat * 2) {
      log(`  ${receteAd}: Zaten duzgun (${oncekiMaliyet} TL, ${count} malzeme) - ATLANDI`);
      continue;
    }

    // Ürün kartından eşleşen ürünü bul
    const urunMatch = matchUrunKarti(receteAd, urunKartlari);
    if (!urunMatch) {
      log(`  ${receteAd}: Urun karti bulunamadi - ATLANDI`);
      continue;
    }

    // Mevcut malzemeleri sil
    await query('DELETE FROM recete_malzemeler WHERE recete_id = $1', [recete.id]);

    // Tek malzeme olarak hazır ürünü ekle
    const birimFiyat = urunMatch.fiyat || 0;
    const toplamFiyat =
      config.birim === 'gr' || config.birim === 'ml' ? (birimFiyat / 1000) * config.miktar : birimFiyat * config.miktar;

    await query(
      `INSERT INTO recete_malzemeler (recete_id, urun_kart_id, malzeme_adi, miktar, birim, birim_fiyat, toplam_fiyat, fiyat_kaynagi, sira)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'URUN_KARTI', 1)`,
      [
        recete.id,
        urunMatch.id,
        urunMatch.ad,
        config.miktar,
        config.birim,
        birimFiyat,
        Math.round(toplamFiyat * 100) / 100,
      ]
    );

    // Maliyet güncelle
    await query('UPDATE receteler SET tahmini_maliyet = $2 WHERE id = $1', [
      recete.id,
      Math.round(toplamFiyat * 100) / 100,
    ]);

    log(
      `  ${receteAd}: ${oncekiMaliyet.toFixed(2)} TL -> ${toplamFiyat.toFixed(2)} TL (${count} malzeme -> 1 hazir urun)`
    );
    duzeltilen++;
  }

  log(`\n  Sonuc: ${duzeltilen} hazir urun duzeltildi`);
  return duzeltilen;
}

// ─── ADIM 2: Malzemesiz Reçetelere AI Önerisi ────────────────

async function adim2MalzemesizDuzelt() {
  logSection('ADIM 2: Malzemesiz Recetelere AI Malzeme Onerisi');

  const result = await query(`
    SELECT r.id, r.ad, rk.ad as kategori_adi
    FROM receteler r
    LEFT JOIN recete_kategoriler rk ON rk.id = r.kategori_id
    WHERE r.aktif = true
      AND (SELECT count(*) FROM recete_malzemeler rm WHERE rm.recete_id = r.id) = 0
    ORDER BY r.ad
  `);

  const malzemesizler = result.rows;
  log(`  ${malzemesizler.length} malzemesiz recete bulundu`);

  if (malzemesizler.length === 0) return 0;

  const urunKartlari = await getUrunKartlari();
  const urunListesi = getUrunListesiText(urunKartlari);
  let duzeltilen = 0;

  // 3'erli batch'ler halinde isle
  for (let i = 0; i < malzemesizler.length; i += 3) {
    const batch = malzemesizler.slice(i, i + 3);
    const yemekListesi = batch.map((r) => `- ${r.ad} (${r.kategori_adi || 'Genel'})`).join('\n');

    log(
      `  Batch ${Math.floor(i / 3) + 1}/${Math.ceil(malzemesizler.length / 3)}: ${batch.map((r) => r.ad).join(', ')}`
    );

    try {
      const aiResult = await aiAgent.processQuery(
        `Sen bir yemek reçetesi uzmanısın. Aşağıdaki ${batch.length} yemek için standart Türk mutfağı tarifine göre malzeme listesi ve 1 porsiyon gramajları öner.

YEMEKLER:
${yemekListesi}

MEVCUT ÜRÜN KARTLARI (öncelikle bunlardan seç):
${urunListesi}

FORMAT (JSON):
\`\`\`json
{
  "sonuclar": [
    ${batch
      .map(
        (r) => `{
      "recete_id": ${r.id},
      "malzemeler": [
        {"malzeme_adi": "Ürün adı", "miktar": 100, "birim": "gr"}
      ]
    }`
      )
      .join(',\n    ')}
  ]
}
\`\`\`

KURALLAR:
- Birim: gr, ml, adet
- Miktarlar gerçekçi, 1 porsiyon (250-400g) için
- Öncelikle mevcut ürün kartlarından SEÇ
- Listede yoksa yeni isimle öner`,
        [],
        { maxTokens: 4000, temperature: 0.3 }
      );

      // Parse AI response
      let sonuclar = [];
      try {
        const jsonMatch = aiResult.response.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          sonuclar = JSON.parse(jsonMatch[1]).sonuclar || [];
        } else {
          const objMatch = aiResult.response.match(/\{[\s\S]*"sonuclar"[\s\S]*\}/);
          if (objMatch) sonuclar = JSON.parse(objMatch[0]).sonuclar || [];
        }
      } catch {
        log(`    PARSE HATASI - atlandi`);
        continue;
      }

      // Her reçete için malzemeleri kaydet
      for (const sonuc of sonuclar) {
        const receteId = sonuc.recete_id;
        if (!receteId || !sonuc.malzemeler || sonuc.malzemeler.length === 0) continue;

        for (let sira = 0; sira < sonuc.malzemeler.length; sira++) {
          const mal = sonuc.malzemeler[sira];
          const urunMatch = matchUrunKarti(mal.malzeme_adi, urunKartlari);

          const birimFiyat = urunMatch?.fiyat || 0;
          const miktar = Number(mal.miktar) || 0;
          const birim = mal.birim || 'gr';
          const toplamFiyat = birim === 'gr' || birim === 'ml' ? (birimFiyat / 1000) * miktar : birimFiyat * miktar;

          await query(
            `INSERT INTO recete_malzemeler (recete_id, urun_kart_id, malzeme_adi, miktar, birim, birim_fiyat, toplam_fiyat, fiyat_kaynagi, sira)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              receteId,
              urunMatch?.id || null,
              urunMatch?.ad || mal.malzeme_adi,
              miktar,
              birim,
              birimFiyat,
              Math.round(toplamFiyat * 100) / 100,
              urunMatch ? 'URUN_KARTI' : 'AI_ONERI',
              sira + 1,
            ]
          );
        }

        const receteAd = batch.find((r) => r.id === receteId)?.ad || receteId;
        log(`    ${receteAd}: ${sonuc.malzemeler.length} malzeme eklendi`);
        duzeltilen++;
      }
    } catch (err) {
      log(`    HATA: ${err.message}`);
    }

    // Rate limit - batch arasi bekleme
    if (i + 3 < malzemesizler.length) {
      await sleep(2000);
    }
  }

  log(`\n  Sonuc: ${duzeltilen}/${malzemesizler.length} malzemesiz recete duzeltildi`);
  return duzeltilen;
}

// ─── ADIM 3: Az Malzemeli + Anomali Düzeltme ─────────────────

async function adim3AnomalileriDuzelt() {
  logSection('ADIM 3: Az Malzemeli + Maliyet Anomali Duzeltme');

  // Az malzemeli (1-2 malzeme, hazır ürün hariç)
  const azResult = await query(`
    SELECT r.id, r.ad, r.tahmini_maliyet::numeric as maliyet, rk.ad as kategori_adi,
      (SELECT count(*) FROM recete_malzemeler rm WHERE rm.recete_id = r.id) as malzeme_sayisi
    FROM receteler r
    LEFT JOIN recete_kategoriler rk ON rk.id = r.kategori_id
    WHERE r.aktif = true
      AND (SELECT count(*) FROM recete_malzemeler rm WHERE rm.recete_id = r.id) BETWEEN 1 AND 2
      AND r.ad NOT IN ('Beyaz Peynir','Kaşar Peynir','Ekmek','Simit','Yoğurt','Ayran','Bal','Reçel','Zeytin','Tereyağı')
    ORDER BY r.ad
  `);

  // Maliyet anomalileri (100+ TL)
  const anomaliResult = await query(`
    SELECT r.id, r.ad, r.tahmini_maliyet::numeric as maliyet, rk.ad as kategori_adi,
      (SELECT count(*) FROM recete_malzemeler rm WHERE rm.recete_id = r.id) as malzeme_sayisi
    FROM receteler r
    LEFT JOIN recete_kategoriler rk ON rk.id = r.kategori_id
    WHERE r.aktif = true
      AND r.tahmini_maliyet::numeric > 100
      AND r.ad NOT IN ('Beyaz Peynir','Kaşar Peynir','Ekmek','Simit','Yoğurt','Ayran','Bal','Reçel','Zeytin','Tereyağı')
    ORDER BY r.tahmini_maliyet::numeric DESC
  `);

  // Birleştir (tekrar edenler çıkar)
  const sorunluMap = new Map();
  for (const r of [...azResult.rows, ...anomaliResult.rows]) {
    sorunluMap.set(r.id, r);
  }
  const sorunlular = [...sorunluMap.values()];

  log(
    `  ${azResult.rows.length} az malzemeli + ${anomaliResult.rows.length} anomali = ${sorunlular.length} benzersiz recete`
  );

  if (sorunlular.length === 0) return 0;

  const urunKartlari = await getUrunKartlari();
  const urunListesi = getUrunListesiText(urunKartlari);
  let duzeltilen = 0;

  // Tek tek isle (her biri icin mevcut malzemeleri sil, AI ile yeniden olustur)
  for (let i = 0; i < sorunlular.length; i++) {
    const recete = sorunlular[i];
    const oncekiMaliyet = Number(recete.maliyet) || 0;

    log(
      `  [${i + 1}/${sorunlular.length}] ${recete.ad} (${oncekiMaliyet.toFixed(2)} TL, ${recete.malzeme_sayisi} malzeme)`
    );

    try {
      // Mevcut malzemeleri sil
      await query('DELETE FROM recete_malzemeler WHERE recete_id = $1', [recete.id]);

      const aiResult = await aiAgent.processQuery(
        `Sen bir yemek reçetesi uzmanısın. "${recete.ad}" (${recete.kategori_adi || 'Genel'}) yemeği için standart Türk mutfağı tarifine göre malzeme listesi ve 1 porsiyon gramajları öner.

MEVCUT ÜRÜN KARTLARI (öncelikle bunlardan seç):
${urunListesi}

FORMAT (JSON):
\`\`\`json
{
  "malzemeler": [
    {"malzeme_adi": "Ürün adı", "miktar": 100, "birim": "gr"}
  ]
}
\`\`\`

KURALLAR:
- Birim: gr, ml, adet
- Miktarlar gerçekçi, 1 porsiyon (250-400g) için
- Öncelikle mevcut ürün kartlarından SEÇ`,
        [],
        { maxTokens: 2000, temperature: 0.3 }
      );

      let malzemeler = [];
      try {
        const jsonMatch = aiResult.response.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          malzemeler = JSON.parse(jsonMatch[1]).malzemeler || [];
        }
      } catch {
        log(`    PARSE HATASI - atlandi`);
        continue;
      }

      if (malzemeler.length === 0) {
        log(`    AI bos yanit verdi - atlandi`);
        continue;
      }

      // Malzemeleri kaydet
      for (let sira = 0; sira < malzemeler.length; sira++) {
        const mal = malzemeler[sira];
        const urunMatch = matchUrunKarti(mal.malzeme_adi, urunKartlari);

        const birimFiyat = urunMatch?.fiyat || 0;
        const miktar = Number(mal.miktar) || 0;
        const birim = mal.birim || 'gr';
        const toplamFiyat = birim === 'gr' || birim === 'ml' ? (birimFiyat / 1000) * miktar : birimFiyat * miktar;

        await query(
          `INSERT INTO recete_malzemeler (recete_id, urun_kart_id, malzeme_adi, miktar, birim, birim_fiyat, toplam_fiyat, fiyat_kaynagi, sira)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            recete.id,
            urunMatch?.id || null,
            urunMatch?.ad || mal.malzeme_adi,
            miktar,
            birim,
            birimFiyat,
            Math.round(toplamFiyat * 100) / 100,
            urunMatch ? 'URUN_KARTI' : 'AI_ONERI',
            sira + 1,
          ]
        );
      }

      log(`    ${malzemeler.length} malzeme eklendi`);
      duzeltilen++;
    } catch (err) {
      log(`    HATA: ${err.message}`);
    }

    // Rate limit
    if (i + 1 < sorunlular.length) {
      await sleep(1500);
    }
  }

  log(`\n  Sonuc: ${duzeltilen}/${sorunlular.length} recete duzeltildi`);
  return duzeltilen;
}

// ─── ADIM 4: Toplu Maliyet Hesaplama ─────────────────────────

async function adim4MaliyetHesapla() {
  logSection('ADIM 4: Toplu Maliyet Yeniden Hesaplama');

  const result = await query('SELECT id, ad FROM receteler WHERE aktif = true ORDER BY id');
  const receteler = result.rows;
  log(`  ${receteler.length} aktif recete icin maliyet hesaplanacak`);

  let basarili = 0;
  let hatali = 0;

  for (const recete of receteler) {
    try {
      await hesaplaReceteMaliyet(recete.id);
      basarili++;
    } catch {
      hatali++;
    }
  }

  log(`  Sonuc: ${basarili} basarili, ${hatali} hatali`);
  return { basarili, hatali };
}

// ─── RAPOR ────────────────────────────────────────────────────

async function raporOlustur() {
  logSection('SONUC RAPORU');

  const result = await query(`
    SELECT rk.ad as kategori,
      count(r.id) as recete_sayisi,
      round(avg(r.tahmini_maliyet::numeric), 2) as ort_maliyet,
      round(min(r.tahmini_maliyet::numeric), 2) as min_maliyet,
      round(max(r.tahmini_maliyet::numeric), 2) as max_maliyet
    FROM receteler r
    JOIN recete_kategoriler rk ON rk.id = r.kategori_id
    WHERE r.aktif = true AND r.tahmini_maliyet > 0
    GROUP BY rk.ad
    ORDER BY ort_maliyet DESC
  `);

  console.log('\n  Kategori bazli maliyet dagilimi:');
  console.log('  ' + '-'.repeat(70));
  console.log(
    '  ' + 'Kategori'.padEnd(25) + 'Sayi'.padStart(6) + 'Ort'.padStart(10) + 'Min'.padStart(10) + 'Max'.padStart(10)
  );
  console.log('  ' + '-'.repeat(70));
  for (const r of result.rows) {
    console.log(
      '  ' +
        r.kategori.padEnd(25) +
        String(r.recete_sayisi).padStart(6) +
        `${r.ort_maliyet} TL`.padStart(10) +
        `${r.min_maliyet} TL`.padStart(10) +
        `${r.max_maliyet} TL`.padStart(10)
    );
  }

  // Hala anomali olan reçeteler
  const anomali = await query(`
    SELECT r.ad, r.tahmini_maliyet::numeric as maliyet
    FROM receteler r WHERE r.aktif = true AND r.tahmini_maliyet::numeric > 100
    ORDER BY r.tahmini_maliyet::numeric DESC
  `);

  if (anomali.rows.length > 0) {
    console.log(`\n  UYARI: ${anomali.rows.length} recete hala 100+ TL:`);
    for (const r of anomali.rows) {
      console.log(`    - ${r.ad}: ${Number(r.maliyet).toFixed(2)} TL`);
    }
  } else {
    console.log('\n  Tum receteler 100 TL altinda - BASARILI');
  }

  // Malzemesiz kalan reçeteler
  const malzemesiz = await query(`
    SELECT r.ad FROM receteler r
    WHERE r.aktif = true AND (SELECT count(*) FROM recete_malzemeler rm WHERE rm.recete_id = r.id) = 0
  `);

  if (malzemesiz.rows.length > 0) {
    console.log(`\n  UYARI: ${malzemesiz.rows.length} recete hala malzemesiz:`);
    for (const r of malzemesiz.rows) {
      console.log(`    - ${r.ad}`);
    }
  } else {
    console.log('  Tum recetelerde malzeme var - BASARILI');
  }
}

// ─── MAIN ─────────────────────────────────────────────────────

async function main() {
  logSection('RECETE TOPLU AI DUZELTME SCRIPTI');
  log('Baslaniyor...\n');

  const oncekiDurum = await query(`
    SELECT
      count(*) as toplam,
      count(*) FILTER (WHERE tahmini_maliyet::numeric > 100) as anomali,
      round(avg(tahmini_maliyet::numeric), 2) as ort_maliyet
    FROM receteler WHERE aktif = true AND tahmini_maliyet > 0
  `);
  log(
    `Onceki durum: ${oncekiDurum.rows[0].toplam} recete, ort ${oncekiDurum.rows[0].ort_maliyet} TL, ${oncekiDurum.rows[0].anomali} anomali`
  );

  // Adimlar
  const d1 = await adim1HazirUrunDuzelt();
  const d2 = await adim2MalzemesizDuzelt();
  const d3 = await adim3AnomalileriDuzelt();
  const d4 = await adim4MaliyetHesapla();

  // Sonraki durum
  const sonrakiDurum = await query(`
    SELECT
      count(*) as toplam,
      count(*) FILTER (WHERE tahmini_maliyet::numeric > 100) as anomali,
      round(avg(tahmini_maliyet::numeric), 2) as ort_maliyet
    FROM receteler WHERE aktif = true AND tahmini_maliyet > 0
  `);

  logSection('OZET');
  log(`Hazir urun duzeltme: ${d1}`);
  log(`Malzemesiz duzeltme: ${d2}`);
  log(`Anomali duzeltme: ${d3}`);
  log(`Maliyet hesaplama: ${d4.basarili} basarili, ${d4.hatali} hatali`);
  log(`Onceki ort maliyet: ${oncekiDurum.rows[0].ort_maliyet} TL`);
  log(`Sonraki ort maliyet: ${sonrakiDurum.rows[0].ort_maliyet} TL`);
  log(`Onceki anomali: ${oncekiDurum.rows[0].anomali}`);
  log(`Sonraki anomali: ${sonrakiDurum.rows[0].anomali}`);

  await raporOlustur();

  log('\nTamamlandi.');
  process.exit(0);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
