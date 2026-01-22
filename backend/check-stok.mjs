import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

try {
  const result = await pool.query(`
    SELECT id, kod, ad, aktif
    FROM stok_kartlari 
    ORDER BY id
    LIMIT 50
  `);

  console.log('=== MEVCUT STOK KARTLARI ===');
  result.rows.forEach(r => console.log(`${r.id} | ${r.kod} | ${r.ad} | aktif:${r.aktif}`));

  const ozet = await pool.query(`
    SELECT 
      COUNT(*)::int as toplam,
      COUNT(*) FILTER (WHERE kod LIKE 'FAT-%')::int as faturadan,
      COUNT(*) FILTER (WHERE kod NOT LIKE 'FAT-%')::int as manuel
    FROM stok_kartlari
  `);
  console.log('\nToplam:', ozet.rows[0].toplam, '| Faturadan:', ozet.rows[0].faturadan, '| Manuel:', ozet.rows[0].manuel);
} catch (err) {
  console.error('Hata:', err.message);
} finally {
  await pool.end();
}
