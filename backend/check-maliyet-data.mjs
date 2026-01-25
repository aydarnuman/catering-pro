import { query } from './src/database.js';

async function kontrol() {
  try {
    console.log('\n🔍 MALİYET HESAPLAMA VERİ KONTROLÜ\n');
    console.log('='.repeat(60));
    
    // 1. Stok kartları fiyat durumu
    const stok = await query(`
      SELECT 
        COUNT(*) as toplam,
        COUNT(CASE WHEN son_alis_fiyati IS NOT NULL AND son_alis_fiyati > 0 THEN 1 END) as fiyatli,
        ROUND(AVG(son_alis_fiyati)::numeric, 2) as ort_fiyat
      FROM stok_kartlari WHERE aktif = true
    `);
    console.log('\n📦 STOK KARTLARI:');
    console.log(`   Toplam: ${stok.rows[0].toplam}`);
    console.log(`   Fiyatlı: ${stok.rows[0].fiyatli}`);
    console.log(`   Fiyatsız: ${stok.rows[0].toplam - stok.rows[0].fiyatli}`);
    console.log(`   Ort. Fiyat: ${stok.rows[0].ort_fiyat || 0} TL`);
    
    // 2. Ürün kartları
    const urun = await query(`
      SELECT 
        COUNT(*) as toplam,
        COUNT(CASE WHEN son_alis_fiyati IS NOT NULL AND son_alis_fiyati > 0 THEN 1 END) as fiyatli,
        ROUND(AVG(son_alis_fiyati)::numeric, 2) as ort_fiyat
      FROM urun_kartlari WHERE aktif = true
    `);
    console.log('\n🏷️ ÜRÜN KARTLARI:');
    console.log(`   Toplam: ${urun.rows[0].toplam}`);
    console.log(`   Fiyatlı: ${urun.rows[0].fiyatli}`);
    console.log(`   Fiyatsız: ${urun.rows[0].toplam - urun.rows[0].fiyatli}`);
    console.log(`   Ort. Fiyat: ${urun.rows[0].ort_fiyat || 0} TL`);
    
    // 3. Reçeteler
    const recete = await query(`
      SELECT 
        COUNT(*) as toplam,
        COUNT(CASE WHEN tahmini_maliyet > 0 THEN 1 END) as maliyetli,
        ROUND(AVG(tahmini_maliyet)::numeric, 2) as ort_maliyet,
        ROUND(MIN(tahmini_maliyet)::numeric, 2) as min_maliyet,
        ROUND(MAX(tahmini_maliyet)::numeric, 2) as max_maliyet
      FROM receteler WHERE aktif = true
    `);
    console.log('\n🍲 REÇETELER:');
    console.log(`   Toplam: ${recete.rows[0].toplam}`);
    console.log(`   Maliyetli: ${recete.rows[0].maliyetli}`);
    console.log(`   Maliyetsiz: ${recete.rows[0].toplam - recete.rows[0].maliyetli}`);
    console.log(`   Ort. Maliyet: ${recete.rows[0].ort_maliyet || 0} TL`);
    console.log(`   Min-Max: ${recete.rows[0].min_maliyet || 0} - ${recete.rows[0].max_maliyet || 0} TL`);
    
    // 4. Reçete malzemeleri
    const malzeme = await query(`
      SELECT 
        COUNT(*) as toplam_satir,
        COUNT(DISTINCT recete_id) as farkli_recete,
        COUNT(CASE WHEN urun_kart_id IS NOT NULL THEN 1 END) as eslestirilmis,
        COUNT(CASE WHEN birim_fiyat > 0 THEN 1 END) as fiyatli
      FROM recete_malzemeler
    `);
    console.log('\n🥕 REÇETE MALZEMELERİ:');
    console.log(`   Toplam Satır: ${malzeme.rows[0].toplam_satir}`);
    console.log(`   Farklı Reçete: ${malzeme.rows[0].farkli_recete}`);
    console.log(`   Ürün Eşleştirilmiş: ${malzeme.rows[0].eslestirilmis}`);
    console.log(`   Fiyatlı: ${malzeme.rows[0].fiyatli}`);
    
    // 5. Piyasa fiyatları
    const piyasa = await query(`
      SELECT 
        COUNT(*) as toplam,
        COUNT(DISTINCT urun_kart_id) as farkli_urun,
        MAX(arastirma_tarihi)::date as son_tarih
      FROM piyasa_fiyat_gecmisi
    `);
    console.log('\n💰 PİYASA FİYATLARI:');
    console.log(`   Toplam Kayıt: ${piyasa.rows[0].toplam}`);
    console.log(`   Farklı Ürün: ${piyasa.rows[0].farkli_urun}`);
    console.log(`   Son Araştırma: ${piyasa.rows[0].son_tarih || 'YOK'}`);
    
    // 6. Menü planları
    const menuPlan = await query(`SELECT COUNT(*) as c FROM menu_planlari`);
    const menuOgun = await query(`SELECT COUNT(*) as c FROM menu_plan_ogunleri`);
    const menuYemek = await query(`SELECT COUNT(*) as c FROM menu_ogun_yemekleri`);
    
    console.log('\n📋 MENÜ PLANLARI:');
    console.log(`   Toplam Plan: ${menuPlan.rows[0].c}`);
    console.log(`   Toplam Öğün: ${menuOgun.rows[0].c}`);
    console.log(`   Yemek Ataması: ${menuYemek.rows[0].c}`);
    
    // 7. Maliyet şablonları
    const sablon = await query(`
      SELECT COUNT(*) as toplam FROM maliyet_menu_sablonlari WHERE aktif = true
    `);
    console.log('\n📊 MALİYET ŞABLONLARI:');
    console.log(`   Aktif Şablon: ${sablon.rows[0].toplam}`);
    
    // SONUÇ
    console.log('\n' + '='.repeat(60));
    console.log('📈 SONUÇ ve EKSİKLER:\n');
    
    const eksikler = [];
    
    if (urun.rows[0].fiyatli == 0) {
      eksikler.push('❌ Ürün kartlarında FİYAT BİLGİSİ YOK!');
    } else if (urun.rows[0].fiyatli < urun.rows[0].toplam / 2) {
      eksikler.push(`⚠️ Ürünlerin sadece %${Math.round(urun.rows[0].fiyatli / urun.rows[0].toplam * 100)}'inde fiyat var`);
    }
    
    if (malzeme.rows[0].toplam_satir == 0) {
      eksikler.push('❌ Reçetelerde MALZEME TANIMI YOK!');
    } else if (malzeme.rows[0].eslestirilmis < malzeme.rows[0].toplam_satir / 2) {
      eksikler.push(`⚠️ Malzemelerin sadece %${Math.round(malzeme.rows[0].eslestirilmis / malzeme.rows[0].toplam_satir * 100)}'i ürün kartına eşleştirilmiş`);
    }
    
    if (recete.rows[0].maliyetli == 0) {
      eksikler.push('❌ Reçetelerde MALİYET HESAPLANMAMIŞ!');
    }
    
    if (piyasa.rows[0].toplam == 0) {
      eksikler.push('⚠️ Piyasa fiyat araştırması yapılmamış');
    }
    
    if (eksikler.length === 0) {
      console.log('✅ Tüm veriler hazır! Maliyet hesaplama yapılabilir.');
    } else {
      eksikler.forEach(e => console.log(e));
    }
    
    // Örnek fiyatsız ürünler
    if (urun.rows[0].toplam - urun.rows[0].fiyatli > 0) {
      const ornekFiyatsiz = await query(`
        SELECT ad, birim 
        FROM urun_kartlari 
        WHERE aktif = true AND (son_alis_fiyati IS NULL OR son_alis_fiyati = 0)
        LIMIT 5
      `);
      console.log('\n⚠️ Fiyatsız Ürün Örnekleri:');
      ornekFiyatsiz.rows.forEach(r => console.log(`   - ${r.ad} (${r.birim})`));
    }
    
    console.log('\n');
    process.exit(0);
  } catch (e) {
    console.error('HATA:', e.message);
    process.exit(1);
  }
}

kontrol();
