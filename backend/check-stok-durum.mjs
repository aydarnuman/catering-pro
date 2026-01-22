import './src/env-loader.js';
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function main() {
  try {
    // fatura_stok_islem tablosundaki kayıtlar
    const fsi = await pool.query(`SELECT * FROM fatura_stok_islem ORDER BY islem_tarihi DESC LIMIT 5`);
    console.log('📋 fatura_stok_islem kayıtları:');
    fsi.rows.forEach(r => console.log('  -', r.ettn?.substring(0, 20) + '...', '| Depo:', r.depo_id, '| Tarih:', r.islem_tarihi));
    
    // Stok hareketlerini kontrol et
    const hareketler = await pool.query(`SELECT COUNT(*) as toplam FROM urun_hareketleri`);
    console.log('\n📦 Toplam urun_hareketleri:', hareketler.rows[0].toplam);
    
    // Eski stok hareketleri (arşiv)
    const eskiHareketler = await pool.query(`SELECT COUNT(*) as toplam FROM stok_hareketleri_arsiv`);
    console.log('📦 Toplam stok_hareketleri_arsiv:', eskiHareketler.rows[0].toplam);
    
    // Depo durumlarını kontrol et
    const depo = await pool.query(`SELECT COUNT(*) as toplam, COALESCE(SUM(miktar), 0) as toplam_miktar FROM urun_depo_durumlari`);
    console.log('\n🏭 urun_depo_durumlari:', depo.rows[0]);
    
    // METRO faturası
    const metro = await pool.query(`
      SELECT ui.ettn, ui.sender_name, ui.payable_amount, fsi.id as islem_id
      FROM uyumsoft_invoices ui
      LEFT JOIN fatura_stok_islem fsi ON fsi.ettn = ui.ettn
      WHERE ui.sender_name ILIKE '%METRO%'
      LIMIT 1
    `);
    console.log('\n📄 METRO Fatura:', metro.rows[0]);
    
  } catch (e) {
    console.error('Hata:', e.message);
  } finally {
    pool.end();
  }
}

main();
