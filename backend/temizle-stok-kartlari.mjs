import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

console.log('=== STOK KARTLARI TEMİZLİĞİ ===\n');

try {
  // 1. Önce mevcut bağımlılıkları kontrol et
  console.log('1. Bağımlılıklar kontrol ediliyor...');
  
  const receteBagli = await pool.query(`
    SELECT COUNT(*)::int as c FROM recete_malzemeler 
    WHERE stok_kart_id IS NOT NULL
  `);
  console.log(`   - Reçete malzemelerinde: ${receteBagli.rows[0].c} kayıt`);
  
  const hareketBagli = await pool.query(`
    SELECT COUNT(*)::int as c FROM stok_hareketleri 
    WHERE stok_kart_id IS NOT NULL
  `);
  console.log(`   - Stok hareketlerinde: ${hareketBagli.rows[0].c} kayıt`);
  
  // 2. Reçete malzemelerindeki stok_kart_id'leri NULL yap (urun_kart_id kullanılacak)
  console.log('\n2. Reçete malzemeleri güncelleniyor...');
  await pool.query(`UPDATE recete_malzemeler SET stok_kart_id = NULL WHERE stok_kart_id IS NOT NULL`);
  console.log('   ✅ stok_kart_id alanları temizlendi');
  
  // 3. Stok hareketlerini arşivle
  console.log('\n3. Stok hareketleri arşivleniyor...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS stok_hareketleri_arsiv AS 
    SELECT * FROM stok_hareketleri WHERE 1=0
  `);
  await pool.query(`ALTER TABLE stok_hareketleri_arsiv ADD COLUMN IF NOT EXISTS arsiv_tarihi TIMESTAMP DEFAULT NOW()`);
  
  const hareketSayisi = await pool.query(`SELECT COUNT(*)::int as c FROM stok_hareketleri`);
  if (hareketSayisi.rows[0].c > 0) {
    await pool.query(`INSERT INTO stok_hareketleri_arsiv SELECT *, NOW() FROM stok_hareketleri`);
    await pool.query(`DELETE FROM stok_hareketleri`);
    console.log(`   ✅ ${hareketSayisi.rows[0].c} hareket arşivlendi`);
  } else {
    console.log('   ✅ Hareket yok');
  }
  
  // 4. Stok depo durumlarını temizle
  console.log('\n4. Stok depo durumları temizleniyor...');
  await pool.query(`DELETE FROM stok_depo_durumlari`);
  console.log('   ✅ Temizlendi');
  
  // 5. Fiyat geçmişini temizle
  console.log('\n5. Eski fiyat geçmişi temizleniyor...');
  await pool.query(`DELETE FROM piyasa_fiyat_gecmisi WHERE stok_kart_id IS NOT NULL`);
  await pool.query(`DELETE FROM stok_fiyat_gecmisi WHERE stok_kart_id IS NOT NULL`);
  console.log('   ✅ Temizlendi');
  
  // 6. Fatura eşleştirmelerini temizle
  console.log('\n6. Eski fatura eşleştirmeleri temizleniyor...');
  await pool.query(`DELETE FROM fatura_urun_eslestirme`);
  console.log('   ✅ Temizlendi');
  
  // 7. Stok kartlarını devre dışı bırak
  console.log('\n7. Stok kartları devre dışı bırakılıyor...');
  const stokSayisi = await pool.query(`SELECT COUNT(*)::int as c FROM stok_kartlari WHERE aktif = true`);
  await pool.query(`
    UPDATE stok_kartlari 
    SET aktif = false, 
        kod = kod || '_ESKI_' || id,
        updated_at = NOW()
    WHERE aktif = true
  `);
  console.log(`   ✅ ${stokSayisi.rows[0].c} stok kartı devre dışı bırakıldı`);
  
  // ÖZET
  console.log('\n========================================');
  console.log('       TEMİZLİK TAMAMLANDI!');
  console.log('========================================\n');
  
  const urunSayisi = await pool.query(`SELECT COUNT(*)::int as c FROM urun_kartlari WHERE aktif = true`);
  const stokAktif = await pool.query(`SELECT COUNT(*)::int as c FROM stok_kartlari WHERE aktif = true`);
  
  console.log(`Ürün Kartları (aktif): ${urunSayisi.rows[0].c}`);
  console.log(`Stok Kartları (aktif): ${stokAktif.rows[0].c}`);
  
  console.log('\n✅ Artık sadece ÜRÜN KARTLARI sistemi kullanılacak!');
  
} catch (err) {
  console.error('❌ Hata:', err.message);
  console.error(err.stack);
}

await pool.end();
