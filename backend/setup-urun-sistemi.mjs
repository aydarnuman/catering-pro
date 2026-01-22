import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('=== ÜRÜN KARTI SİSTEMİ KURULUMU ===\n');
  
  // 1. pg_trgm extension
  console.log('1. pg_trgm extension...');
  await pool.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
  console.log('   ✅ OK');
  
  // 2. urun_kartlari tablosuna yeni alanlar ekle
  console.log('2. urun_kartlari yeni alanlar...');
  await pool.query(`
    ALTER TABLE urun_kartlari 
    ADD COLUMN IF NOT EXISTS ana_birim_id INTEGER REFERENCES birimler(id),
    ADD COLUMN IF NOT EXISTS barkod VARCHAR(50),
    ADD COLUMN IF NOT EXISTS min_stok DECIMAL(15,3) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS max_stok DECIMAL(15,3),
    ADD COLUMN IF NOT EXISTS kritik_stok DECIMAL(15,3),
    ADD COLUMN IF NOT EXISTS raf_omru_gun INTEGER,
    ADD COLUMN IF NOT EXISTS kdv_orani DECIMAL(5,2) DEFAULT 10,
    ADD COLUMN IF NOT EXISTS aciklama TEXT,
    ADD COLUMN IF NOT EXISTS resim_url VARCHAR(500),
    ADD COLUMN IF NOT EXISTS ortalama_fiyat DECIMAL(15,4),
    ADD COLUMN IF NOT EXISTS son_alis_fiyati DECIMAL(15,4),
    ADD COLUMN IF NOT EXISTS son_alis_tarihi TIMESTAMP,
    ADD COLUMN IF NOT EXISTS toplam_stok DECIMAL(15,3) DEFAULT 0
  `);
  console.log('   ✅ OK');
  
  // 3. Tedarikçi fiyat geçmişi tablosu
  console.log('3. urun_fiyat_gecmisi tablosu...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS urun_fiyat_gecmisi (
      id SERIAL PRIMARY KEY,
      urun_kart_id INTEGER NOT NULL REFERENCES urun_kartlari(id) ON DELETE CASCADE,
      cari_id INTEGER REFERENCES cariler(id) ON DELETE SET NULL,
      fiyat DECIMAL(15,4) NOT NULL,
      birim_id INTEGER REFERENCES birimler(id),
      kdv_dahil BOOLEAN DEFAULT FALSE,
      fatura_ettn VARCHAR(100),
      kaynak VARCHAR(50) DEFAULT 'manuel',
      tarih DATE DEFAULT CURRENT_DATE,
      aciklama VARCHAR(500),
      created_at TIMESTAMP DEFAULT NOW(),
      created_by INTEGER REFERENCES users(id)
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_urun_fiyat_gecmisi_urun ON urun_fiyat_gecmisi(urun_kart_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_urun_fiyat_gecmisi_cari ON urun_fiyat_gecmisi(cari_id)');
  console.log('   ✅ OK');
  
  // 4. Tedarikçi ürün eşleştirme tablosu
  console.log('4. urun_tedarikci_eslestirme tablosu...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS urun_tedarikci_eslestirme (
      id SERIAL PRIMARY KEY,
      urun_kart_id INTEGER NOT NULL REFERENCES urun_kartlari(id) ON DELETE CASCADE,
      cari_id INTEGER REFERENCES cariler(id) ON DELETE SET NULL,
      tedarikci_urun_kodu VARCHAR(100),
      tedarikci_urun_adi VARCHAR(500) NOT NULL,
      tedarikci_urun_adi_normalized VARCHAR(500),
      tedarikci_birimi VARCHAR(20),
      birim_carpani DECIMAL(10,6) DEFAULT 1,
      eslestirme_sayisi INTEGER DEFAULT 1,
      otomatik_pilanmis BOOLEAN DEFAULT FALSE,
      guven_skoru DECIMAL(5,2),
      aktif BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      created_by INTEGER REFERENCES users(id)
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_urun_tedarikci_eslestirme_urun ON urun_tedarikci_eslestirme(urun_kart_id)');
  console.log('   ✅ OK');
  
  // 5. Ürün depo durumları tablosu
  console.log('5. urun_depo_durumlari tablosu...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS urun_depo_durumlari (
      id SERIAL PRIMARY KEY,
      urun_kart_id INTEGER NOT NULL REFERENCES urun_kartlari(id) ON DELETE CASCADE,
      depo_id INTEGER NOT NULL REFERENCES depolar(id) ON DELETE CASCADE,
      miktar DECIMAL(15,3) DEFAULT 0,
      rezerve_miktar DECIMAL(15,3) DEFAULT 0,
      min_stok DECIMAL(15,3),
      max_stok DECIMAL(15,3),
      raf_konum VARCHAR(50),
      son_sayim_tarihi DATE,
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(urun_kart_id, depo_id)
    )
  `);
  console.log('   ✅ OK');
  
  // 6. Ürün hareketleri tablosu
  console.log('6. urun_hareketleri tablosu...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS urun_hareketleri (
      id SERIAL PRIMARY KEY,
      urun_kart_id INTEGER NOT NULL REFERENCES urun_kartlari(id) ON DELETE CASCADE,
      hareket_tipi VARCHAR(20) NOT NULL,
      miktar DECIMAL(15,3) NOT NULL,
      birim_id INTEGER REFERENCES birimler(id),
      birim_fiyat DECIMAL(15,4),
      toplam_tutar DECIMAL(15,2),
      kaynak_depo_id INTEGER REFERENCES depolar(id),
      hedef_depo_id INTEGER REFERENCES depolar(id),
      fatura_id INTEGER,
      uyumsoft_fatura_id INTEGER,
      fatura_ettn VARCHAR(100),
      siparis_id INTEGER,
      cari_id INTEGER REFERENCES cariler(id),
      aciklama VARCHAR(500),
      referans_no VARCHAR(100),
      tarih TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW(),
      created_by INTEGER REFERENCES users(id)
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_urun_hareketleri_urun ON urun_hareketleri(urun_kart_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_urun_hareketleri_tarih ON urun_hareketleri(tarih DESC)');
  console.log('   ✅ OK');
  
  // 7. stok_kartlari arşivle
  console.log('7. stok_kartlari arşivleniyor...');
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stok_kartlari_arsiv (LIKE stok_kartlari INCLUDING ALL)
    `);
    await pool.query('ALTER TABLE stok_kartlari_arsiv ADD COLUMN IF NOT EXISTS arsiv_tarihi TIMESTAMP DEFAULT NOW()');
  } catch (e) {
    // Tablo zaten varsa sorun yok
  }
  
  // Mevcut verileri arşive kopyala (eğer yoksa)
  const arsivCount = await pool.query('SELECT COUNT(*)::int as c FROM stok_kartlari_arsiv');
  if (arsivCount.rows[0].c === 0) {
    await pool.query('INSERT INTO stok_kartlari_arsiv SELECT *, NOW() FROM stok_kartlari');
    console.log('   ✅ Stok kartları arşivlendi');
  } else {
    console.log('   ✅ Arşiv zaten mevcut');
  }
  
  // ÖZET
  console.log('\n=== KURULUM TAMAMLANDI ===');
  const tables = ['urun_fiyat_gecmisi', 'urun_tedarikci_eslestirme', 'urun_depo_durumlari', 'urun_hareketleri', 'stok_kartlari_arsiv'];
  for (const t of tables) {
    const cnt = await pool.query(`SELECT COUNT(*)::int as c FROM ${t}`);
    console.log(`${t}: ${cnt.rows[0].c} kayıt`);
  }
  
  // Ürün kartları durumu
  const urunCount = await pool.query('SELECT COUNT(*)::int as c FROM urun_kartlari WHERE aktif = true');
  console.log(`\nurun_kartlari (aktif): ${urunCount.rows[0].c} ürün`);
  
} catch (err) {
  console.error('❌ Hata:', err.message);
  console.error(err.stack);
}

await pool.end();
