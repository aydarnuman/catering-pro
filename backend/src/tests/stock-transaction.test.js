/**
 * =============================================
 * STOK TRANSACTION GÜVENLİĞİ TEST SÜİTİ
 * =============================================
 *
 * Bu testler transaction güvenliğini doğrular:
 * 1. Rollback testi
 * 2. Concurrency testi
 * 3. Constraint testi
 * 4. Atomicity testi
 *
 * Çalıştırma:
 * npm test -- stock-transaction.test.js
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { query } from '../database.js';
import { withTransaction, selectForUpdate } from '../utils/transaction.js';

describe('Stock Transaction Safety Tests', () => {
  let testUrunId;
  let testDepoId;

  beforeAll(async () => {
    // Test verisi oluştur
    const urunResult = await query(`
      INSERT INTO urun_kartlari (kod, ad, aktif)
      VALUES ('TEST-001', 'Test Ürünü', true)
      RETURNING id
    `);
    testUrunId = urunResult.rows[0].id;

    const depoResult = await query(`
      INSERT INTO depolar (kod, ad, aktif)
      VALUES ('TEST-DEPO', 'Test Deposu', true)
      RETURNING id
    `);
    testDepoId = depoResult.rows[0].id;

    // Başlangıç stoğu
    await query(
      `INSERT INTO urun_depo_durumlari (urun_kart_id, depo_id, miktar)
       VALUES ($1, $2, 100)`,
      [testUrunId, testDepoId]
    );
  });

  afterAll(async () => {
    // Test verilerini temizle
    await query('DELETE FROM urun_depo_durumlari WHERE urun_kart_id = $1', [testUrunId]);
    await query('DELETE FROM urun_hareketleri WHERE urun_kart_id = $1', [testUrunId]);
    await query('DELETE FROM urun_kartlari WHERE id = $1', [testUrunId]);
    await query('DELETE FROM depolar WHERE id = $1', [testDepoId]);
  });

  // =============================================
  // TEST 1: ROLLBACK - Hata durumunda tüm işlemler geri alınmalı
  // =============================================
  it('hata durumunda transaction rollback yapmalı', async () => {
    // Başlangıç stoku
    const oncekiStok = await query(
      'SELECT miktar FROM urun_depo_durumlari WHERE urun_kart_id = $1 AND depo_id = $2',
      [testUrunId, testDepoId]
    );
    const oncekiMiktar = parseFloat(oncekiStok.rows[0].miktar);

    // Başlangıç hareket sayısı
    const oncekiHareket = await query('SELECT COUNT(*) FROM urun_hareketleri WHERE urun_kart_id = $1', [testUrunId]);
    const oncekiHareketSayisi = parseInt(oncekiHareket.rows[0].count);

    // Transaction içinde hata oluştur
    try {
      await withTransaction(async (client) => {
        // 1. Başarılı işlem
        await client.query(
          `INSERT INTO urun_hareketleri (urun_kart_id, hedef_depo_id, hareket_tipi, miktar)
           VALUES ($1, $2, 'GIRIS', 50)`,
          [testUrunId, testDepoId]
        );

        // 2. Stok güncelle
        await client.query(
          `UPDATE urun_depo_durumlari SET miktar = miktar + 50
           WHERE urun_kart_id = $1 AND depo_id = $2`,
          [testUrunId, testDepoId]
        );

        // 3. HATA: Olmayan bir ID'ye insert dene
        await client.query(`INSERT INTO urun_kartlari (id, kod, ad) VALUES (999999999, 'FAIL', 'FAIL')`);
      });
    } catch (error) {
      // Beklenen hata
      expect(error).toBeDefined();
    }

    // Stok değişmemiş olmalı
    const sonrakiStok = await query(
      'SELECT miktar FROM urun_depo_durumlari WHERE urun_kart_id = $1 AND depo_id = $2',
      [testUrunId, testDepoId]
    );
    const sonrakiMiktar = parseFloat(sonrakiStok.rows[0].miktar);

    expect(sonrakiMiktar).toBe(oncekiMiktar);

    // Hareket kaydı eklenmemiş olmalı
    const sonrakiHareket = await query('SELECT COUNT(*) FROM urun_hareketleri WHERE urun_kart_id = $1', [testUrunId]);
    const sonrakiHareketSayisi = parseInt(sonrakiHareket.rows[0].count);

    expect(sonrakiHareketSayisi).toBe(oncekiHareketSayisi);
  });

  // =============================================
  // TEST 2: CONCURRENCY - Aynı anda 2 işlem yarış halinde
  // =============================================
  it('concurrent stok çıkışlarında biri hata almalı', async () => {
    // Stoku 100'e ayarla
    await query(
      `UPDATE urun_depo_durumlari SET miktar = 100
       WHERE urun_kart_id = $1 AND depo_id = $2`,
      [testUrunId, testDepoId]
    );

    // İki paralel stok çıkışı
    const cikis1 = withTransaction(async (client) => {
      const stok = await selectForUpdate(
        client,
        'SELECT miktar FROM urun_depo_durumlari WHERE urun_kart_id = $1 AND depo_id = $2',
        [testUrunId, testDepoId]
      );

      const mevcutMiktar = parseFloat(stok.rows[0].miktar);

      if (mevcutMiktar < 100) {
        throw new Error('Yetersiz stok');
      }

      // Biraz bekle (yarışı simüle et)
      await new Promise((resolve) => setTimeout(resolve, 100));

      await client.query(
        `UPDATE urun_depo_durumlari SET miktar = miktar - 100
         WHERE urun_kart_id = $1 AND depo_id = $2`,
        [testUrunId, testDepoId]
      );

      return 'cikis1-basarili';
    });

    const cikis2 = withTransaction(async (client) => {
      const stok = await selectForUpdate(
        client,
        'SELECT miktar FROM urun_depo_durumlari WHERE urun_kart_id = $1 AND depo_id = $2',
        [testUrunId, testDepoId]
      );

      const mevcutMiktar = parseFloat(stok.rows[0].miktar);

      if (mevcutMiktar < 100) {
        throw new Error('Yetersiz stok');
      }

      await client.query(
        `UPDATE urun_depo_durumlari SET miktar = miktar - 100
         WHERE urun_kart_id = $1 AND depo_id = $2`,
        [testUrunId, testDepoId]
      );

      return 'cikis2-basarili';
    });

    // İki işlemi paralel çalıştır
    const [sonuc1, sonuc2] = await Promise.allSettled([cikis1, cikis2]);

    // Biri başarılı, biri hatalı olmalı
    const basariliSayisi = [sonuc1, sonuc2].filter((s) => s.status === 'fulfilled').length;
    const hataliSayisi = [sonuc1, sonuc2].filter((s) => s.status === 'rejected').length;

    expect(basariliSayisi).toBe(1);
    expect(hataliSayisi).toBe(1);

    // Son stok 0 olmalı (tek bir çıkış başarılı oldu)
    const sonStok = await query(
      'SELECT miktar FROM urun_depo_durumlari WHERE urun_kart_id = $1 AND depo_id = $2',
      [testUrunId, testDepoId]
    );
    expect(parseFloat(sonStok.rows[0].miktar)).toBe(0);
  });

  // =============================================
  // TEST 3: CONSTRAINT - Negatif stok girilememeli
  // =============================================
  it('negatif stok girilememeli (constraint)', async () => {
    await expect(async () => {
      await query(
        `UPDATE urun_depo_durumlari SET miktar = -100
         WHERE urun_kart_id = $1 AND depo_id = $2`,
        [testUrunId, testDepoId]
      );
    }).rejects.toThrow();

    // Stok değişmemiş olmalı
    const stok = await query(
      'SELECT miktar FROM urun_depo_durumlari WHERE urun_kart_id = $1 AND depo_id = $2',
      [testUrunId, testDepoId]
    );
    expect(parseFloat(stok.rows[0].miktar)).toBeGreaterThanOrEqual(0);
  });

  // =============================================
  // TEST 4: ATOMICITY - Tüm işlemler ya tamamen başarılı ya da hiç
  // =============================================
  it('faturadan giriş - tüm kalemler ya kaydedilir ya da hiç', async () => {
    const oncekiStok = await query(
      'SELECT miktar FROM urun_depo_durumlari WHERE urun_kart_id = $1 AND depo_id = $2',
      [testUrunId, testDepoId]
    );
    const oncekiMiktar = parseFloat(oncekiStok.rows[0].miktar);

    // 3 kalemli fatura simülasyonu
    try {
      await withTransaction(async (client) => {
        // Kalem 1: Başarılı
        await client.query(
          `INSERT INTO urun_hareketleri (urun_kart_id, hedef_depo_id, hareket_tipi, miktar)
           VALUES ($1, $2, 'GIRIS', 10)`,
          [testUrunId, testDepoId]
        );
        await client.query(
          `UPDATE urun_depo_durumlari SET miktar = miktar + 10
           WHERE urun_kart_id = $1 AND depo_id = $2`,
          [testUrunId, testDepoId]
        );

        // Kalem 2: Başarılı
        await client.query(
          `INSERT INTO urun_hareketleri (urun_kart_id, hedef_depo_id, hareket_tipi, miktar)
           VALUES ($1, $2, 'GIRIS', 20)`,
          [testUrunId, testDepoId]
        );
        await client.query(
          `UPDATE urun_depo_durumlari SET miktar = miktar + 20
           WHERE urun_kart_id = $1 AND depo_id = $2`,
          [testUrunId, testDepoId]
        );

        // Kalem 3: HATA! - Null constraint
        await client.query(
          `INSERT INTO urun_hareketleri (urun_kart_id, hedef_depo_id, hareket_tipi, miktar)
           VALUES (NULL, $1, 'GIRIS', 30)`,
          [testDepoId]
        );
      });
    } catch (error) {
      // Beklenen hata
      expect(error).toBeDefined();
    }

    // Stok DEĞİŞMEMİŞ olmalı (hiçbir kalem eklenmedi)
    const sonrakiStok = await query(
      'SELECT miktar FROM urun_depo_durumlari WHERE urun_kart_id = $1 AND depo_id = $2',
      [testUrunId, testDepoId]
    );
    const sonrakiMiktar = parseFloat(sonrakiStok.rows[0].miktar);

    expect(sonrakiMiktar).toBe(oncekiMiktar);
  });

  // =============================================
  // TEST 5: VERSION - Optimistic locking çalışıyor mu?
  // =============================================
  it('version column her update\'te artmalı', async () => {
    const oncekiVersion = await query(
      'SELECT version FROM urun_depo_durumlari WHERE urun_kart_id = $1 AND depo_id = $2',
      [testUrunId, testDepoId]
    );
    const oncekiVersionNo = parseInt(oncekiVersion.rows[0].version);

    // Stok güncelle
    await query(
      `UPDATE urun_depo_durumlari SET miktar = miktar + 1
       WHERE urun_kart_id = $1 AND depo_id = $2`,
      [testUrunId, testDepoId]
    );

    const sonrakiVersion = await query(
      'SELECT version FROM urun_depo_durumlari WHERE urun_kart_id = $1 AND depo_id = $2',
      [testUrunId, testDepoId]
    );
    const sonrakiVersionNo = parseInt(sonrakiVersion.rows[0].version);

    expect(sonrakiVersionNo).toBe(oncekiVersionNo + 1);
  });
});

// =============================================
// PERFORMANS TESTLERİ (isteğe bağlı)
// =============================================
describe('Stock Performance Tests', () => {
  it('100 paralel transaction hızlı tamamlanmalı', async () => {
    const baslangic = Date.now();

    const promises = [];
    for (let i = 0; i < 100; i++) {
      promises.push(
        withTransaction(async (client) => {
          await client.query('SELECT 1');
        })
      );
    }

    await Promise.all(promises);

    const sure = Date.now() - baslangic;
    console.log(`100 transaction süresi: ${sure}ms`);

    // 10 saniyeden kısa olmalı
    expect(sure).toBeLessThan(10000);
  }, 15000); // 15 saniye timeout
});
