import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

console.log('=== MEVCUT DURUM ===\n');

// Yeni tablolar
const tables = ['urun_fiyat_gecmisi', 'urun_tedarikci_eslestirme', 'urun_depo_durumlari', 'urun_hareketleri'];
for (const t of tables) {
  const exists = await pool.query(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${t}')`);
  console.log(`${t}: ${exists.rows[0].exists ? 'Mevcut' : 'Yok'}`);
}

// Urun kartlari
const urun = await pool.query('SELECT COUNT(*)::int as c FROM urun_kartlari WHERE aktif = true');
console.log(`\nUrun Kartlari (aktif): ${urun.rows[0].c}`);

// Stok kartlari
const stok = await pool.query('SELECT COUNT(*)::int as c FROM stok_kartlari WHERE aktif = true');
console.log(`Stok Kartlari (aktif): ${stok.rows[0].c}`);

// Ornek urun kartlari
console.log('\n=== ORNEK URUN KARTLARI ===');
const ornekler = await pool.query(`
  SELECT uk.id, uk.kod, uk.ad, uk.kategori_id, kat.ad as kategori_adi
  FROM urun_kartlari uk
  LEFT JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
  WHERE uk.aktif = true
  ORDER BY uk.id
  LIMIT 10
`);
ornekler.rows.forEach(r => console.log(`${r.id} | ${r.kod} | ${r.ad} | ${r.kategori_adi}`));

await pool.end();
