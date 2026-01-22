/**
 * VERİ ANALİZİ - Eski vs Yeni Sistem Kullanım Raporu
 * Bu script veritabanındaki mevcut durumu analiz eder
 *
 * Çalıştırma: node veri-analizi.mjs
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function query(sql, params = []) {
  const result = await pool.query(sql, params);
  return result;
}

async function analizEt() {
  console.log('\n' + '='.repeat(70));
  console.log('📊 VERİ ANALİZİ RAPORU - ESKİ vs YENİ SİSTEM');
  console.log('='.repeat(70) + '\n');

  try {
    // 1. TABLO VARLIK KONTROLÜ
    console.log('🔍 1. TABLO VARLIK KONTROLÜ\n');

    const tablolar = [
      { ad: 'stok_kartlari', sistem: 'ESKİ' },
      { ad: 'stok_depo_durumlari', sistem: 'ESKİ' },
      { ad: 'stok_hareketleri', sistem: 'ESKİ' },
      { ad: 'stok_kategoriler', sistem: 'ESKİ' },
      { ad: 'urun_kartlari', sistem: 'YENİ' },
      { ad: 'urun_depo_durumlari', sistem: 'YENİ' },
      { ad: 'urun_hareketleri', sistem: 'YENİ' },
      { ad: 'urun_kategorileri', sistem: 'YENİ' },
      { ad: 'urun_fiyat_gecmisi', sistem: 'YENİ' },
      { ad: 'urun_tedarikci_eslestirme', sistem: 'YENİ' },
    ];

    for (const tablo of tablolar) {
      try {
        const result = await query(`SELECT COUNT(*) as count FROM ${tablo.ad}`);
        const count = parseInt(result.rows[0].count);
        const emoji = count > 0 ? '✅' : '⚪';
        console.log(`  ${emoji} ${tablo.ad.padEnd(30)} ${tablo.sistem.padEnd(6)} → ${count} kayıt`);
      } catch (e) {
        console.log(`  ❌ ${tablo.ad.padEnd(30)} ${tablo.sistem.padEnd(6)} → TABLO YOK`);
      }
    }

    // 2. ÜRÜN KARTI KARŞILAŞTIRMASI
    console.log('\n' + '-'.repeat(70));
    console.log('📦 2. ÜRÜN KARTI KARŞILAŞTIRMASI\n');

    const eskiUrunler = await query(`
      SELECT COUNT(*) as toplam,
             COUNT(*) FILTER (WHERE aktif = true) as aktif,
             COUNT(*) FILTER (WHERE toplam_stok > 0) as stoklu
      FROM stok_kartlari
    `).catch(() => ({ rows: [{ toplam: 0, aktif: 0, stoklu: 0 }] }));

    const yeniUrunler = await query(`
      SELECT COUNT(*) as toplam,
             COUNT(*) FILTER (WHERE aktif = true) as aktif,
             COUNT(*) FILTER (WHERE toplam_stok > 0) as stoklu
      FROM urun_kartlari
    `).catch(() => ({ rows: [{ toplam: 0, aktif: 0, stoklu: 0 }] }));

    console.log('  Tablo                  Toplam    Aktif    Stoklu');
    console.log('  ' + '-'.repeat(50));
    console.log(`  stok_kartlari (ESKİ)   ${String(eskiUrunler.rows[0].toplam).padStart(6)}   ${String(eskiUrunler.rows[0].aktif).padStart(6)}    ${String(eskiUrunler.rows[0].stoklu).padStart(6)}`);
    console.log(`  urun_kartlari (YENİ)   ${String(yeniUrunler.rows[0].toplam).padStart(6)}   ${String(yeniUrunler.rows[0].aktif).padStart(6)}    ${String(yeniUrunler.rows[0].stoklu).padStart(6)}`);

    // 3. STOK HAREKETLERİ KARŞILAŞTIRMASI
    console.log('\n' + '-'.repeat(70));
    console.log('📈 3. STOK HAREKETLERİ KARŞILAŞTIRMASI\n');

    const eskiHareketler = await query(`
      SELECT
        hareket_tipi,
        COUNT(*) as adet,
        COALESCE(SUM(miktar), 0) as toplam_miktar
      FROM stok_hareketleri
      GROUP BY hareket_tipi
      ORDER BY hareket_tipi
    `).catch(() => ({ rows: [] }));

    const yeniHareketler = await query(`
      SELECT
        hareket_tipi,
        COUNT(*) as adet,
        COALESCE(SUM(miktar), 0) as toplam_miktar
      FROM urun_hareketleri
      GROUP BY hareket_tipi
      ORDER BY hareket_tipi
    `).catch(() => ({ rows: [] }));

    console.log('  ESKİ SİSTEM (stok_hareketleri):');
    if (eskiHareketler.rows.length === 0) {
      console.log('    Kayıt yok');
    } else {
      for (const h of eskiHareketler.rows) {
        console.log(`    ${(h.hareket_tipi || 'NULL').padEnd(12)} → ${String(h.adet).padStart(6)} hareket`);
      }
    }

    console.log('\n  YENİ SİSTEM (urun_hareketleri):');
    if (yeniHareketler.rows.length === 0) {
      console.log('    Kayıt yok');
    } else {
      for (const h of yeniHareketler.rows) {
        console.log(`    ${(h.hareket_tipi || 'NULL').padEnd(12)} → ${String(h.adet).padStart(6)} hareket`);
      }
    }

    // 4. REÇETE MALZEME BAĞLANTILARI
    console.log('\n' + '-'.repeat(70));
    console.log('🍳 4. REÇETE MALZEME BAĞLANTILARI\n');

    const receteMalzeme = await query(`
      SELECT
        COUNT(*) as toplam,
        COUNT(*) FILTER (WHERE stok_kart_id IS NOT NULL) as eski_bagti,
        COUNT(*) FILTER (WHERE urun_kart_id IS NOT NULL) as yeni_bagli,
        COUNT(*) FILTER (WHERE stok_kart_id IS NOT NULL AND urun_kart_id IS NOT NULL) as ikisi_bagli,
        COUNT(*) FILTER (WHERE stok_kart_id IS NULL AND urun_kart_id IS NULL) as baglantisiz
      FROM recete_malzemeler
    `).catch(() => ({ rows: [{ toplam: 0, eski_bagti: 0, yeni_bagli: 0, ikisi_bagli: 0, baglantisiz: 0 }] }));

    const rm = receteMalzeme.rows[0];
    console.log(`  Toplam malzeme kaydı:           ${rm.toplam}`);
    console.log(`  stok_kart_id bağlı (ESKİ):      ${rm.eski_bagti}`);
    console.log(`  urun_kart_id bağlı (YENİ):      ${rm.yeni_bagli}`);
    console.log(`  Her ikisine de bağlı:           ${rm.ikisi_bagli}`);
    console.log(`  Hiçbirine bağlı değil:          ${rm.baglantisiz}`);

    // 5. PİYASA TAKİP LİSTESİ
    console.log('\n' + '-'.repeat(70));
    console.log('💰 5. PİYASA TAKİP LİSTESİ\n');

    const piyasaTakip = await query(`
      SELECT
        COUNT(*) as toplam,
        COUNT(*) FILTER (WHERE stok_kart_id IS NOT NULL) as stok_bagli
      FROM piyasa_takip_listesi
    `).catch(() => ({ rows: [{ toplam: 0, stok_bagli: 0 }] }));

    console.log(`  Toplam takip kaydı:             ${piyasaTakip.rows[0].toplam}`);
    console.log(`  stok_kart_id bağlı:             ${piyasaTakip.rows[0].stok_bagli}`);

    // 6. FATURA STOK İŞLEMLERİ
    console.log('\n' + '-'.repeat(70));
    console.log('🧾 6. FATURA STOK İŞLEMLERİ\n');

    const faturaIslem = await query(`
      SELECT COUNT(*) as toplam FROM fatura_stok_islem
    `).catch(() => ({ rows: [{ toplam: 0 }] }));

    const faturaEslestirmeEski = await query(`
      SELECT COUNT(*) as toplam FROM fatura_urun_eslestirme
    `).catch(() => ({ rows: [{ toplam: 0 }] }));

    const faturaEslestirmeYeni = await query(`
      SELECT COUNT(*) as toplam FROM urun_tedarikci_eslestirme
    `).catch(() => ({ rows: [{ toplam: 0 }] }));

    console.log(`  Fatura stok işlem:              ${faturaIslem.rows[0].toplam}`);
    console.log(`  fatura_urun_eslestirme (ESKİ):  ${faturaEslestirmeEski.rows[0].toplam}`);
    console.log(`  urun_tedarikci_eslestirme(YENİ):${faturaEslestirmeYeni.rows[0].toplam}`);

    // 7. DEPO DURUMLARI
    console.log('\n' + '-'.repeat(70));
    console.log('🏭 7. DEPO DURUMLARI\n');

    const eskiDepo = await query(`
      SELECT
        COUNT(*) as toplam,
        COUNT(*) FILTER (WHERE miktar > 0) as stoklu,
        COALESCE(SUM(miktar), 0) as toplam_miktar
      FROM stok_depo_durumlari
    `).catch(() => ({ rows: [{ toplam: 0, stoklu: 0, toplam_miktar: 0 }] }));

    const yeniDepo = await query(`
      SELECT
        COUNT(*) as toplam,
        COUNT(*) FILTER (WHERE miktar > 0) as stoklu,
        COALESCE(SUM(miktar), 0) as toplam_miktar
      FROM urun_depo_durumlari
    `).catch(() => ({ rows: [{ toplam: 0, stoklu: 0, toplam_miktar: 0 }] }));

    console.log('  Tablo                       Kayıt    Stoklu   Toplam Miktar');
    console.log('  ' + '-'.repeat(60));
    console.log(`  stok_depo_durumlari (ESKİ)  ${String(eskiDepo.rows[0].toplam).padStart(6)}   ${String(eskiDepo.rows[0].stoklu).padStart(6)}   ${parseFloat(eskiDepo.rows[0].toplam_miktar).toFixed(2)}`);
    console.log(`  urun_depo_durumlari (YENİ)  ${String(yeniDepo.rows[0].toplam).padStart(6)}   ${String(yeniDepo.rows[0].stoklu).padStart(6)}   ${parseFloat(yeniDepo.rows[0].toplam_miktar).toFixed(2)}`);

    // 8. ÖNERİLER
    console.log('\n' + '='.repeat(70));
    console.log('💡 ANALİZ SONUCU VE ÖNERİLER');
    console.log('='.repeat(70) + '\n');

    const eskiAktif = parseInt(eskiUrunler.rows[0].aktif) || 0;
    const yeniAktif = parseInt(yeniUrunler.rows[0].aktif) || 0;
    const eskiHareketToplam = eskiHareketler.rows.reduce((sum, h) => sum + parseInt(h.adet), 0);
    const yeniHareketToplam = yeniHareketler.rows.reduce((sum, h) => sum + parseInt(h.adet), 0);

    if (yeniAktif > eskiAktif) {
      console.log('  ✅ YENİ SİSTEM daha fazla aktif ürüne sahip');
      console.log('     → Geçiş başlamış, devam edilmeli');
    } else if (eskiAktif > yeniAktif) {
      console.log('  ⚠️  ESKİ SİSTEM daha fazla aktif ürüne sahip');
      console.log('     → Veri migrasyonu öncelikli yapılmalı');
    }

    if (yeniHareketToplam > 0 && eskiHareketToplam > 0) {
      console.log('  ⚠️  Her iki sistemde de hareket var - KARISIKLIK!');
    } else if (yeniHareketToplam > 0) {
      console.log('  ✅ Hareketler YENİ sistemde');
    } else if (eskiHareketToplam > 0) {
      console.log('  ⚠️  Hareketler ESKİ sistemde - Geçiş gerekli');
    }

    if (parseInt(rm.eski_bagti) > 0 && parseInt(rm.yeni_bagli) === 0) {
      console.log('  ⚠️  Reçeteler tamamen ESKİ sisteme bağlı');
      console.log('     → recete_malzemeler.urun_kart_id migrasyonu gerekli');
    } else if (parseInt(rm.yeni_bagli) > 0) {
      console.log('  ✅ Bazı reçeteler YENİ sisteme bağlı');
    }

    console.log('\n' + '='.repeat(70) + '\n');

  } catch (error) {
    console.error('❌ Hata:', error.message);
  } finally {
    await pool.end();
  }
}

analizEt();
