#!/usr/bin/env node
/**
 * Seed Yükleniciler
 *
 * tenders tablosundaki yuklenici_adi alanından benzersiz firma adlarını çıkarır
 * ve yukleniciler tablosuna seed kaydı oluşturur.
 * Ardından tenders.yuklenici_id FK'larını eşleştirir ve istatistikleri hesaplar.
 *
 * Kullanım:
 *   node backend/scripts/seed-yukleniciler.mjs
 *   node backend/scripts/seed-yukleniciler.mjs --dry-run   # sadece göster, kaydetme
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const DRY_RUN = process.argv.includes('--dry-run');

async function query(text, params) {
  return pool.query(text, params);
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  Yüklenici Seed Script');
  console.log(`  Mod: ${DRY_RUN ? 'DRY RUN (kayıt yok)' : 'GERÇEK (kayıt yapılacak)'}`);
  console.log('═══════════════════════════════════════════\n');

  // 1. tenders tablosundaki benzersiz yüklenici adlarını çek
  console.log('1. Benzersiz yüklenici adları çıkarılıyor...');
  const distinctResult = await query(`
    SELECT 
      yuklenici_adi,
      COUNT(*) as ihale_sayisi,
      SUM(sozlesme_bedeli) FILTER (WHERE sozlesme_bedeli IS NOT NULL) as toplam_bedel,
      AVG(indirim_orani) FILTER (WHERE indirim_orani IS NOT NULL) as ort_indirim,
      array_agg(DISTINCT city) FILTER (WHERE city IS NOT NULL) as sehirler,
      MAX(sozlesme_tarihi) as son_sozlesme,
      MAX(tender_date) as son_ihale
    FROM tenders
    WHERE yuklenici_adi IS NOT NULL 
      AND yuklenici_adi != ''
      AND yuklenici_adi NOT LIKE '%***%'
    GROUP BY yuklenici_adi
    ORDER BY ihale_sayisi DESC
  `);

  const firmalar = distinctResult.rows;
  console.log(`   → ${firmalar.length} benzersiz yüklenici adı bulundu\n`);

  if (firmalar.length === 0) {
    console.log('Hiç yüklenici verisi bulunamadı. tenders tablosunda yuklenici_adi alanı boş.');
    await pool.end();
    return;
  }

  // İlk 10'u göster
  console.log('   En aktif 10 yüklenici:');
  firmalar.slice(0, 10).forEach((f, i) => {
    const bedel = f.toplam_bedel ? `₺${Number(f.toplam_bedel).toLocaleString('tr-TR')}` : 'N/A';
    console.log(`   ${i + 1}. ${f.yuklenici_adi} (${f.ihale_sayisi} ihale, ${bedel})`);
  });
  console.log('');

  if (DRY_RUN) {
    console.log('DRY RUN modu — kayıt yapılmadı.');
    await pool.end();
    return;
  }

  // 2. Mevcut yüklenicileri kontrol et
  console.log('2. Mevcut yükleniciler kontrol ediliyor...');
  const existingResult = await query('SELECT id, unvan FROM yukleniciler');
  const existingMap = new Map(existingResult.rows.map((r) => [r.unvan.toLowerCase().trim(), r.id]));
  console.log(`   → ${existingMap.size} mevcut yüklenici var\n`);

  // 3. Yeni yüklenicileri ekle
  console.log('3. Yükleniciler ekleniyor/güncelleniyor...');
  let newCount = 0;
  let updatedCount = 0;
  let errorCount = 0;

  for (const firma of firmalar) {
    try {
      const unvan = firma.yuklenici_adi.replace(/\s+/g, ' ').trim();
      const sehirler = (firma.sehirler || []).filter(Boolean);

      const result = await query(
        `
        INSERT INTO yukleniciler (
          unvan,
          katildigi_ihale_sayisi,
          tamamlanan_is_sayisi,
          toplam_sozlesme_bedeli,
          ortalama_indirim_orani,
          aktif_sehirler,
          son_ihale_tarihi,
          scraped_at
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, NOW())
        ON CONFLICT (unvan) DO UPDATE SET
          katildigi_ihale_sayisi = EXCLUDED.katildigi_ihale_sayisi,
          tamamlanan_is_sayisi = EXCLUDED.tamamlanan_is_sayisi,
          toplam_sozlesme_bedeli = COALESCE(EXCLUDED.toplam_sozlesme_bedeli, yukleniciler.toplam_sozlesme_bedeli),
          ortalama_indirim_orani = COALESCE(EXCLUDED.ortalama_indirim_orani, yukleniciler.ortalama_indirim_orani),
          aktif_sehirler = EXCLUDED.aktif_sehirler,
          son_ihale_tarihi = COALESCE(EXCLUDED.son_ihale_tarihi, yukleniciler.son_ihale_tarihi),
          updated_at = NOW()
        RETURNING id, (xmax = 0) as is_new
      `,
        [
          unvan,
          parseInt(firma.ihale_sayisi, 10),
          parseInt(firma.ihale_sayisi, 10), // tamamlanan = toplam (sonuçlanan ihaleden geliyor)
          firma.toplam_bedel ? parseFloat(firma.toplam_bedel) : 0,
          firma.ort_indirim ? parseFloat(firma.ort_indirim) : null,
          JSON.stringify(sehirler),
          firma.son_ihale || firma.son_sozlesme || null,
        ]
      );

      if (result.rows[0]?.is_new) newCount++;
      else updatedCount++;
    } catch (error) {
      errorCount++;
      console.error(`   HATA (${firma.yuklenici_adi}): ${error.message}`);
    }
  }

  console.log(`   → ${newCount} yeni, ${updatedCount} güncellendi, ${errorCount} hata\n`);

  // 4. tenders.yuklenici_id FK'larını eşleştir
  console.log('4. tenders.yuklenici_id eşleştiriliyor...');
  const linkResult = await query(`
    UPDATE tenders t
    SET yuklenici_id = y.id
    FROM yukleniciler y
    WHERE t.yuklenici_adi IS NOT NULL
      AND t.yuklenici_id IS NULL
      AND TRIM(t.yuklenici_adi) = y.unvan
  `);
  console.log(`   → ${linkResult.rowCount} ihale yüklenici ile eşleştirildi\n`);

  // 5. Kazanma oranı hesapla
  console.log('5. İstatistikler hesaplanıyor...');
  await query(`
    UPDATE yukleniciler y SET
      kazanma_orani = CASE 
        WHEN y.katildigi_ihale_sayisi > 0 
        THEN ROUND((y.tamamlanan_is_sayisi::numeric / y.katildigi_ihale_sayisi) * 100, 2)
        ELSE 0 
      END,
      updated_at = NOW()
  `);

  // 6. yuklenici_ihaleleri seed (tenders tablosundan)
  console.log('6. yuklenici_ihaleleri tablosu seed ediliyor...');
  const seedIhaleler = await query(`
    INSERT INTO yuklenici_ihaleleri (yuklenici_id, tender_id, ihale_basligi, kurum_adi, sehir, sozlesme_bedeli, sozlesme_tarihi, indirim_orani, rol, durum)
    SELECT 
      y.id,
      t.id,
      t.title,
      t.organization_name,
      t.city,
      t.sozlesme_bedeli,
      t.sozlesme_tarihi,
      t.indirim_orani,
      'yuklenici',
      CASE WHEN t.status = 'completed' THEN 'tamamlandi' ELSE 'devam' END
    FROM tenders t
    JOIN yukleniciler y ON y.id = t.yuklenici_id
    WHERE t.yuklenici_id IS NOT NULL
    ON CONFLICT (yuklenici_id, tender_id, rol) DO NOTHING
  `);
  console.log(`   → ${seedIhaleler.rowCount} ihale-yüklenici kaydı oluşturuldu\n`);

  // 7. Özet
  const finalStats = await query(`
    SELECT 
      COUNT(*) as toplam,
      COUNT(*) FILTER (WHERE toplam_sozlesme_bedeli > 0) as bedelli,
      SUM(toplam_sozlesme_bedeli) as toplam_pazar
    FROM yukleniciler
  `);
  const s = finalStats.rows[0];
  console.log('═══════════════════════════════════════════');
  console.log('  SONUÇ');
  console.log(`  Toplam Yüklenici: ${s.toplam}`);
  console.log(`  Sözleşme Bilgisi Olan: ${s.bedelli}`);
  console.log(`  Toplam Pazar Büyüklüğü: ₺${Number(s.toplam_pazar || 0).toLocaleString('tr-TR')}`);
  console.log('═══════════════════════════════════════════');

  await pool.end();
}

main().catch((err) => {
  console.error('FATAL:', err);
  pool.end().then(() => process.exit(1));
});
