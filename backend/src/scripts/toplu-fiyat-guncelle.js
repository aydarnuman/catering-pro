/**
 * Toplu Fiyat Güncelleme Scripti
 *
 * Fiyatsız ürün kartları için camgöz API'den toplu fiyat çeker.
 * Sonra tüm reçete maliyetlerini yeniden hesaplar.
 *
 * Çalıştırma: cd backend && node src/scripts/toplu-fiyat-guncelle.js
 */

import '../env-loader.js';

import { query } from '../database.js';
import { searchMarketPrices } from '../services/market-scraper.js';
import { savePiyasaFiyatlar } from '../services/piyasa-fiyat-writer.js';

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

// ─── ADIM 1: Fiyatsız ürünleri bul ───────────────────────────

async function getFiyatsizUrunler() {
  const result = await query(`
    SELECT uk.id, uk.ad, uk.varsayilan_birim,
      (SELECT count(*) FROM recete_malzemeler rm WHERE rm.urun_kart_id = uk.id 
       AND rm.recete_id IN (SELECT id FROM receteler WHERE aktif = true)) as kullanim
    FROM urun_kartlari uk
    WHERE uk.aktif = true
      AND COALESCE(uk.manuel_fiyat, uk.aktif_fiyat, uk.son_alis_fiyati) IS NULL
    ORDER BY 
      (SELECT count(*) FROM recete_malzemeler rm WHERE rm.urun_kart_id = uk.id) DESC
  `);
  return result.rows;
}

// ─── ADIM 2: Camgöz'den fiyat çek ve kaydet ──────────────────

async function fiyatCekVeKaydet(urun) {
  try {
    // Ürün adını arama terimine dönüştür
    const aramaTermi = urun.ad
      .replace(/\(.*\)/g, '') // Parantez içini kaldır
      .replace(/\s+/g, ' ')
      .trim();

    // Birim normalize (gr -> kg, ml -> L)
    const birim = urun.varsayilan_birim?.toLowerCase() || 'gr';
    const targetUnit = ['gr', 'g', 'gram'].includes(birim)
      ? 'kg'
      : ['ml', 'mililitre'].includes(birim)
        ? 'L'
        : ['kg', 'kilo'].includes(birim)
          ? 'kg'
          : ['lt', 'litre', 'l'].includes(birim)
            ? 'L'
            : null;

    const result = await searchMarketPrices(aramaTermi, { targetUnit });

    if (!result.success || !result.fiyatlar || result.fiyatlar.length === 0) {
      return { success: false, reason: 'Fiyat bulunamadi' };
    }

    // Fiyatları kaydet
    const saveResult = await savePiyasaFiyatlar({
      urunKartId: urun.id,
      urunAdi: urun.ad,
      fiyatlar: result.fiyatlar,
      kaynakTip: 'market',
      dominantBirim: targetUnit,
      aramaTermi,
      maxKayit: 10,
    });

    // En uygun fiyatı ürün kartına yaz (medyan)
    const fiyatlar = result.fiyatlar
      .filter((f) => f.birimFiyat > 0)
      .map((f) => f.birimFiyat)
      .sort((a, b) => a - b);

    if (fiyatlar.length > 0) {
      // Medyan fiyat (aşırı ucuz/pahalı olanları elemek için)
      const medyanIdx = Math.floor(fiyatlar.length / 2);
      const medyanFiyat = fiyatlar[medyanIdx];

      // Ürün kartı birimini düzelt: urun_kartı gr ama fiyat kg bazlı geliyorsa
      // aktif_fiyat her zaman ürün kartının varsayilan_birim bazında olmalı
      let kaydedilecekFiyat = medyanFiyat;

      // Eğer ürün kartı gr/ml birimli ise, fiyatı kg/L'den gr/ml'ye çevir
      if (['gr', 'g', 'ml'].includes(birim) && targetUnit) {
        // medyanFiyat kg bazlı, ürün kartı gr - dönüştürmeye GEREK YOK
        // çünkü maliyet hesaplama servisi zaten (miktar/1000) * kg_fiyat yapıyor
        // Ama ürün kartına kg bazlı fiyat yazmalıyız
        kaydedilecekFiyat = medyanFiyat; // kg/L bazında
      }

      await query(`UPDATE urun_kartlari SET aktif_fiyat = $2, updated_at = NOW() WHERE id = $1`, [
        urun.id,
        Math.round(kaydedilecekFiyat * 100) / 100,
      ]);

      return {
        success: true,
        fiyat: Math.round(kaydedilecekFiyat * 100) / 100,
        birim: targetUnit || birim,
        kaynak_sayisi: fiyatlar.length,
        saved: saveResult.savedCount,
      };
    }

    return { success: false, reason: 'Gecerli fiyat yok' };
  } catch (err) {
    return { success: false, reason: err.message };
  }
}

// ─── ADIM 3: Reçete maliyetlerini güncelle ────────────────────

async function receteMaliyetGuncelle() {
  // Ürün kartı fiyatlarını recete_malzemeler tablosuna yansıt
  // birim_fiyat = ürün kartının aktif fiyatı (kg/L bazında)
  // toplam_fiyat = (miktar_gr / 1000) * birim_fiyat_kg
  await query(`
    UPDATE recete_malzemeler rm
    SET 
      birim_fiyat = COALESCE(uk.aktif_fiyat, uk.manuel_fiyat, uk.son_alis_fiyati),
      toplam_fiyat = CASE
        WHEN rm.birim IN ('gr', 'g', 'ml') AND uk.varsayilan_birim IN ('kg', 'lt', 'L')
          THEN ROUND((rm.miktar / 1000.0) * COALESCE(uk.aktif_fiyat, uk.manuel_fiyat, uk.son_alis_fiyati), 2)
        WHEN rm.birim IN ('gr', 'g', 'ml') AND uk.varsayilan_birim IN ('gr', 'g', 'ml')
          THEN ROUND((rm.miktar / 1000.0) * COALESCE(uk.aktif_fiyat, uk.manuel_fiyat, uk.son_alis_fiyati), 2)
        WHEN rm.birim = 'adet'
          THEN ROUND(rm.miktar * COALESCE(uk.aktif_fiyat, uk.manuel_fiyat, uk.son_alis_fiyati), 2)
        ELSE ROUND((rm.miktar / 1000.0) * COALESCE(uk.aktif_fiyat, uk.manuel_fiyat, uk.son_alis_fiyati), 2)
      END,
      fiyat_kaynagi = 'PIYASA'
    FROM urun_kartlari uk
    WHERE rm.urun_kart_id = uk.id
      AND uk.aktif = true
      AND COALESCE(uk.aktif_fiyat, uk.manuel_fiyat, uk.son_alis_fiyati) IS NOT NULL
      AND COALESCE(uk.aktif_fiyat, uk.manuel_fiyat, uk.son_alis_fiyati) > 0
  `);

  // Reçete toplam maliyetlerini güncelle
  await query(`
    UPDATE receteler r
    SET tahmini_maliyet = sub.toplam, son_hesaplama_tarihi = NOW()
    FROM (
      SELECT rm.recete_id, COALESCE(SUM(rm.toplam_fiyat), 0) as toplam
      FROM recete_malzemeler rm
      GROUP BY rm.recete_id
    ) sub
    WHERE r.id = sub.recete_id AND r.aktif = true
  `);

  // Sonuç
  const result = await query(`
    SELECT
      count(*) as toplam,
      count(*) FILTER (WHERE tahmini_maliyet > 100) as anomali,
      round(avg(tahmini_maliyet::numeric), 2) as ort_maliyet,
      round(avg(tahmini_maliyet::numeric) FILTER (WHERE tahmini_maliyet < 100), 2) as ort_normal
    FROM receteler WHERE aktif = true AND tahmini_maliyet > 0
  `);

  return result.rows[0];
}

// ─── MAIN ─────────────────────────────────────────────────────

async function main() {
  logSection('TOPLU FIYAT GUNCELLEME (Camgoz API)');

  // Fiyatsız ürünleri bul
  const fiyatsizlar = await getFiyatsizUrunler();
  log(`${fiyatsizlar.length} fiyatsiz urun karti bulundu`);

  // Öncelikli: reçetelerde kullanılanlar
  const oncelikli = fiyatsizlar.filter((u) => Number(u.kullanim) > 0);
  const diger = fiyatsizlar.filter((u) => Number(u.kullanim) === 0);
  log(`${oncelikli.length} tanesi recetelerde kullaniliyor (oncelikli)`);
  log(`${diger.length} tanesi hic kullanilmiyor`);

  logSection('FIYAT CEKME (Camgoz API)');

  let basarili = 0;
  let basarisiz = 0;
  const hatalar = [];

  // Öncelikli ürünler
  for (let i = 0; i < oncelikli.length; i++) {
    const urun = oncelikli[i];
    log(`  [${i + 1}/${oncelikli.length}] ${urun.ad} (${urun.kullanim}x kullanim)`);

    const result = await fiyatCekVeKaydet(urun);
    if (result.success) {
      log(`    -> ${result.fiyat} TL/${result.birim} (${result.kaynak_sayisi} kaynak)`);
      basarili++;
    } else {
      log(`    -> BASARISIZ: ${result.reason}`);
      hatalar.push({ urun: urun.ad, reason: result.reason });
      basarisiz++;
    }

    // Rate limit: her istek arasi 1.5sn bekle
    if (i + 1 < oncelikli.length) {
      await sleep(1500);
    }
  }

  // Kullanılmayanlar da (opsiyonel, hızlıca geç)
  if (diger.length > 0 && diger.length <= 30) {
    log(`\n  Kullanilmayan ${diger.length} urun icin de fiyat cekiliyor...`);
    for (let i = 0; i < diger.length; i++) {
      const urun = diger[i];
      const result = await fiyatCekVeKaydet(urun);
      if (result.success) basarili++;
      else basarisiz++;
      if (i + 1 < diger.length) await sleep(1000);
    }
  }

  logSection('RECETE MALIYET GUNCELLEME');
  log('Tum recete maliyetleri yeniden hesaplaniyor...');
  const maliyetSonuc = await receteMaliyetGuncelle();
  log(`Toplam: ${maliyetSonuc.toplam} recete`);
  log(`Ortalama maliyet: ${maliyetSonuc.ort_maliyet} TL`);
  log(`Ortalama (anomalisiz): ${maliyetSonuc.ort_normal} TL`);
  log(`Anomali (100+ TL): ${maliyetSonuc.anomali}`);

  logSection('SONUC RAPORU');
  log(`Fiyat cekme: ${basarili} basarili, ${basarisiz} basarisiz`);

  if (hatalar.length > 0) {
    log(`\nFiyat bulunamayan urunler:`);
    for (const h of hatalar) {
      log(`  - ${h.urun}: ${h.reason}`);
    }
  }

  log('\nTamamlandi.');
  process.exit(0);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
