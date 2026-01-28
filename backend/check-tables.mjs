import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgres://postgres.vpobejfxqihvgsjwnyku:Numan.4343@aws-1-eu-central-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    // Tüm tabloları listele
    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    console.log('\n=== MEVCUT TABLOLAR ===');
    for (const row of tables.rows) {
      console.log(`- ${row.table_name}`);
    }
    console.log(`\nToplam: ${tables.rows.length} tablo`);
    
    // Ürün/Stok ile ilgili tabloları detaylı incele
    const stockTables = [
      'urun_kartlari',
      'urun_kategorileri', 
      'urun_depo_durumlari',
      'urun_hareketleri',
      'urun_fiyat_gecmisi',
      'urun_tedarikci_eslestirme',
      'stok_kartlari',
      'stok_hareketleri',
      'invoice_items',
      'uyumsoft_invoice_items',
      'receteler',
      'recete_malzemeler',
      'piyasa_fiyat_gecmisi'
    ];
    
    console.log('\n=== ÜRÜN/STOK TABLOLARI DETAY ===');
    
    for (const tableName of stockTables) {
      const exists = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = $1
        ) as exists
      `, [tableName]);
      
      if (exists.rows[0].exists) {
        const columns = await pool.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = $1
          ORDER BY ordinal_position
        `, [tableName]);
        
        const count = await pool.query(`SELECT COUNT(*) as cnt FROM ${tableName}`);
        
        console.log(`\n📦 ${tableName.toUpperCase()} (${count.rows[0].cnt} kayıt)`);
        console.log('   Kolonlar:', columns.rows.map(c => c.column_name).join(', '));
      } else {
        console.log(`\n❌ ${tableName} - TABLO YOK`);
      }
    }
    
  } catch (err) {
    console.error('Hata:', err.message);
  } finally {
    await pool.end();
  }
}

main();
