/**
 * Menu Planlama AI Tools
 * Reçete oluşturma, maliyet optimizasyonu, menü önerileri
 */

import { query } from '../../database.js';
import { searchMarketPrices } from '../market-scraper.js';

// =============================================
// TOOL TANIMLARI
// =============================================

export const menuToolDefinitions = [
  {
    name: 'recete_olustur',
    description: `Yeni bir yemek reçetesi oluşturur. Malzemeler, gramajlar, kalori ve besin değerleri ile tam bir reçete kaydı yapar.
    
Örnek: "Domates çorbası reçetesi oluştur" veya "1 kişilik mantı tarifi ekle"`,
    input_schema: {
      type: 'object',
      properties: {
        ad: { type: 'string', description: 'Yemek adı' },
        kategori: { 
          type: 'string', 
          description: 'Kategori kodu: corba, ana_yemek, pilav_makarna, salata_meze, tatli, icecek, kahvaltilik, kahvalti_paketi'
        },
        malzemeler: {
          type: 'array',
          description: 'Malzeme listesi',
          items: {
            type: 'object',
            properties: {
              ad: { type: 'string', description: 'Malzeme adı' },
              miktar: { type: 'number', description: 'Miktar' },
              birim: { type: 'string', description: 'Birim (g, kg, ml, L, adet)' }
            }
          }
        },
        porsiyon: { type: 'number', description: 'Kaç kişilik (varsayılan: 1)' },
        hazirlik_suresi: { type: 'number', description: 'Hazırlık süresi (dakika)' },
        pisirme_suresi: { type: 'number', description: 'Pişirme süresi (dakika)' },
        tarif: { type: 'string', description: 'Yapılış tarifi' },
        kalori: { type: 'number', description: 'Kalori (kcal/porsiyon)' },
        protein: { type: 'number', description: 'Protein (g/porsiyon)' },
        karbonhidrat: { type: 'number', description: 'Karbonhidrat (g/porsiyon)' },
        yag: { type: 'number', description: 'Yağ (g/porsiyon)' }
      },
      required: ['ad', 'kategori', 'malzemeler']
    }
  },
  {
    name: 'recete_listele',
    description: 'Mevcut reçeteleri kategoriye göre listeler veya arar.',
    input_schema: {
      type: 'object',
      properties: {
        kategori: { type: 'string', description: 'Kategori kodu (opsiyonel)' },
        arama: { type: 'string', description: 'Arama terimi (opsiyonel)' },
        limit: { type: 'number', description: 'Maksimum sonuç sayısı (varsayılan: 20)' }
      }
    }
  },
  {
    name: 'recete_maliyet_hesapla',
    description: 'Bir reçetenin güncel piyasa fiyatlarına göre maliyetini hesaplar.',
    input_schema: {
      type: 'object',
      properties: {
        recete_id: { type: 'number', description: 'Reçete ID' },
        kisi_sayisi: { type: 'number', description: 'Kaç kişilik maliyet (varsayılan: 1)' }
      },
      required: ['recete_id']
    }
  },
  {
    name: 'menu_onerisi',
    description: `Belirtilen kriterlere göre menü önerisi yapar. Proje belirtilirse şartname gramajlarına uygun öneriler sunar.
    
Örnek: "KYK projesi için aylık menü öner" veya "Bütçeye uygun haftalık menü"`,
    input_schema: {
      type: 'object',
      properties: {
        proje_id: { type: 'number', description: 'Proje ID - şartname gramajlarını referans almak için' },
        gun_sayisi: { type: 'number', description: 'Kaç günlük menü (varsayılan: 7)' },
        ogun_tipleri: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'Hangi öğünler: kahvalti, ogle, aksam'
        },
        max_kalori: { type: 'number', description: 'Günlük maksimum kalori limiti' },
        max_porsiyon_maliyet: { type: 'number', description: 'Porsiyon başı maksimum maliyet (TL)' },
        tercih_ettikleri: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'Tercih edilen yemek türleri'
        },
        haric_tutulacaklar: {
          type: 'array',
          items: { type: 'string' },
          description: 'Hariç tutulacak malzemeler/yemekler'
        }
      }
    }
  },
  {
    name: 'maliyet_optimizasyonu',
    description: `Bir reçete veya menü için maliyet optimizasyonu önerileri sunar. 
Alternatif malzemeler, daha ucuz kaynaklar önerir.`,
    input_schema: {
      type: 'object',
      properties: {
        recete_id: { type: 'number', description: 'Reçete ID' },
        hedef_tasarruf_yuzde: { type: 'number', description: 'Hedef tasarruf yüzdesi' }
      },
      required: ['recete_id']
    }
  },
  {
    name: 'besin_analizi',
    description: 'Bir reçete veya günlük menünün besin değerlerini analiz eder.',
    input_schema: {
      type: 'object',
      properties: {
        recete_id: { type: 'number', description: 'Reçete ID' },
        porsiyon: { type: 'number', description: 'Porsiyon sayısı' }
      },
      required: ['recete_id']
    }
  },
  {
    name: 'aylik_menu_olustur',
    description: `Bir proje için aylık menü planı oluşturur ve veritabanına kaydeder.
    
Örnek: "KYK yurdu için Ocak ayı menüsü oluştur" veya "Hastane için haftalık menü planla"

Bu tool:
- Belirtilen proje ve tarih aralığı için menü planı oluşturur
- Mevcut reçetelerden seçim yaparak günlük öğünleri doldurur
- Çeşitlilik sağlar (aynı yemek art arda gelmez)
- Bütçe ve kalori limitlerine uyar
- Sonucu veritabanına kaydeder`,
    input_schema: {
      type: 'object',
      properties: {
        proje_id: { type: 'number', description: 'Proje ID' },
        ay: { type: 'number', description: 'Ay (1-12)' },
        yil: { type: 'number', description: 'Yıl (örn: 2026)' },
        kisi_sayisi: { type: 'number', description: 'Günlük kişi sayısı (varsayılan: 1000)' },
        ogunler: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'Hangi öğünler planlanacak: kahvalti, ogle, aksam (varsayılan: hepsi)'
        },
        max_gunluk_maliyet: { type: 'number', description: 'Kişi başı maksimum günlük maliyet (TL)' },
        ozel_gunler: {
          type: 'array',
          description: 'Özel günler listesi (bayram, tatil vb.)',
          items: {
            type: 'object',
            properties: {
              tarih: { type: 'string', description: 'Tarih (YYYY-MM-DD)' },
              aciklama: { type: 'string', description: 'Özel gün açıklaması' }
            }
          }
        },
        tercihler: { type: 'string', description: 'Ek tercihler veya notlar' }
      },
      required: ['proje_id', 'ay', 'yil']
    }
  },
  {
    name: 'gune_yemek_ekle',
    description: `Belirli bir güne yemek ekler.
    
Örnek: "9 Ocak'a öğle yemeği olarak mercimek çorbası ekle"`,
    input_schema: {
      type: 'object',
      properties: {
        proje_id: { type: 'number', description: 'Proje ID' },
        tarih: { type: 'string', description: 'Tarih (YYYY-MM-DD formatında)' },
        ogun: { type: 'string', description: 'Öğün tipi: kahvalti, ogle, aksam' },
        recete_id: { type: 'number', description: 'Eklenecek reçete ID' },
        kisi_sayisi: { type: 'number', description: 'Kişi sayısı (varsayılan: 1000)' }
      },
      required: ['proje_id', 'tarih', 'ogun', 'recete_id']
    }
  },
  {
    name: 'gun_menusunu_getir',
    description: 'Belirli bir günün menüsünü getirir.',
    input_schema: {
      type: 'object',
      properties: {
        proje_id: { type: 'number', description: 'Proje ID' },
        tarih: { type: 'string', description: 'Tarih (YYYY-MM-DD formatında)' }
      },
      required: ['proje_id', 'tarih']
    }
  }
];

// =============================================
// TOOL UYGULAMALARI
// =============================================

export const menuToolImplementations = {
  
  // Reçete oluştur
  recete_olustur: async ({ ad, kategori, malzemeler, porsiyon, hazirlik_suresi, pisirme_suresi, tarif, kalori, protein, karbonhidrat, yag }) => {
    try {
      // Kategori ID'sini bul
      const kategoriResult = await query(
        'SELECT id FROM recete_kategoriler WHERE kod = $1',
        [kategori]
      );
      
      if (kategoriResult.rows.length === 0) {
        return { success: false, error: `Kategori bulunamadı: ${kategori}` };
      }
      
      // Kod oluştur
      const kod = ad
        .toUpperCase()
        .replace(/[ğĞ]/g, 'G')
        .replace(/[üÜ]/g, 'U')
        .replace(/[şŞ]/g, 'S')
        .replace(/[ıİ]/g, 'I')
        .replace(/[öÖ]/g, 'O')
        .replace(/[çÇ]/g, 'C')
        .replace(/[^A-Z0-9]/g, '-')
        .substring(0, 20);
      
      // Benzersizliği kontrol et
      const kontrolResult = await query(
        'SELECT COUNT(*) as count FROM receteler WHERE kod LIKE $1',
        [`${kod}%`]
      );
      
      const uniqueKod = kontrolResult.rows[0].count > 0 
        ? `${kod}-${parseInt(kontrolResult.rows[0].count) + 1}` 
        : kod;
      
      // Reçete oluştur
      const receteResult = await query(`
        INSERT INTO receteler (
          kod, ad, kategori_id, porsiyon_miktar,
          hazirlik_suresi, pisirme_suresi, tarif,
          kalori, protein, karbonhidrat, yag,
          ai_olusturuldu
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
        RETURNING id, kod, ad
      `, [
        uniqueKod, ad, kategoriResult.rows[0].id, porsiyon || 1,
        hazirlik_suresi, pisirme_suresi, tarif,
        kalori, protein, karbonhidrat, yag
      ]);
      
      const receteId = receteResult.rows[0].id;
      
      // Malzemeleri ekle
      if (malzemeler && malzemeler.length > 0) {
        for (let i = 0; i < malzemeler.length; i++) {
          const m = malzemeler[i];
          
          // Stok kartı var mı ara
          const stokResult = await query(`
            SELECT id FROM stok_kartlari 
            WHERE ad ILIKE $1 
            LIMIT 1
          `, [`%${m.ad}%`]);
          
          await query(`
            INSERT INTO recete_malzemeler (
              recete_id, stok_kart_id, malzeme_adi, miktar, birim, sira
            ) VALUES ($1, $2, $3, $4, $5, $6)
          `, [
            receteId, 
            stokResult.rows[0]?.id || null,
            m.ad, 
            m.miktar, 
            m.birim || 'g',
            i + 1
          ]);
        }
      }
      
      return {
        success: true,
        recete: receteResult.rows[0],
        malzeme_sayisi: malzemeler?.length || 0,
        mesaj: `"${ad}" reçetesi ${malzemeler?.length || 0} malzeme ile oluşturuldu.`
      };
    } catch (error) {
      console.error('Reçete oluşturma hatası:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Reçete listele
  recete_listele: async ({ kategori, arama, limit = 20 }) => {
    try {
      let whereConditions = ['r.aktif = true'];
      let params = [];
      let paramIndex = 1;
      
      if (kategori) {
        whereConditions.push(`rk.kod = $${paramIndex}`);
        params.push(kategori);
        paramIndex++;
      }
      
      if (arama) {
        whereConditions.push(`r.ad ILIKE $${paramIndex}`);
        params.push(`%${arama}%`);
        paramIndex++;
      }
      
      params.push(limit);
      
      const result = await query(`
        SELECT 
          r.id, r.kod, r.ad,
          rk.ad as kategori,
          rk.ikon,
          r.tahmini_maliyet,
          r.kalori,
          r.porsiyon_miktar,
          COUNT(rm.id) as malzeme_sayisi
        FROM receteler r
        LEFT JOIN recete_kategoriler rk ON rk.id = r.kategori_id
        LEFT JOIN recete_malzemeler rm ON rm.recete_id = r.id
        WHERE ${whereConditions.join(' AND ')}
        GROUP BY r.id, rk.ad, rk.ikon
        ORDER BY r.ad
        LIMIT $${paramIndex}
      `, params);
      
      return {
        success: true,
        toplam: result.rows.length,
        receteler: result.rows.map(r => ({
          id: r.id,
          kod: r.kod,
          ad: `${r.ikon} ${r.ad}`,
          kategori: r.kategori,
          maliyet: r.tahmini_maliyet ? `${r.tahmini_maliyet} TL` : 'Hesaplanmadı',
          kalori: r.kalori ? `${r.kalori} kcal` : '-',
          malzeme_sayisi: parseInt(r.malzeme_sayisi)
        }))
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  
  // Maliyet hesapla
  recete_maliyet_hesapla: async ({ recete_id, kisi_sayisi = 1 }) => {
    try {
      // Reçete bilgisi
      const receteResult = await query(
        'SELECT ad, porsiyon_miktar FROM receteler WHERE id = $1',
        [recete_id]
      );
      
      if (receteResult.rows.length === 0) {
        return { success: false, error: 'Reçete bulunamadı' };
      }
      
      // Malzemeler
      const malzemeResult = await query(`
        SELECT 
          rm.*,
          sk.son_alis_fiyat as sistem_fiyat,
          (SELECT piyasa_fiyat_ort FROM piyasa_fiyat_gecmisi 
           WHERE stok_kart_id = rm.stok_kart_id 
           ORDER BY arastirma_tarihi DESC LIMIT 1) as piyasa_fiyat
        FROM recete_malzemeler rm
        LEFT JOIN stok_kartlari sk ON sk.id = rm.stok_kart_id
        WHERE rm.recete_id = $1
        ORDER BY rm.sira
      `, [recete_id]);
      
      let toplamMaliyet = 0;
      const maliyetDetay = [];
      
      for (const m of malzemeResult.rows) {
        const birimFiyat = m.piyasa_fiyat || m.sistem_fiyat || 0;
        let maliyet = 0;
        const birim = (m.birim || '').toLowerCase();
        
        // Birim dönüşümü
        if (birim === 'g' || birim === 'gr') {
          maliyet = (m.miktar / 1000) * birimFiyat;
        } else if (birim === 'ml') {
          maliyet = (m.miktar / 1000) * birimFiyat;
        } else {
          maliyet = m.miktar * birimFiyat;
        }
        
        toplamMaliyet += maliyet;
        
        maliyetDetay.push({
          malzeme: m.malzeme_adi,
          miktar: `${m.miktar} ${m.birim}`,
          birim_fiyat: birimFiyat,
          maliyet: Math.round(maliyet * 100) / 100,
          kaynak: m.piyasa_fiyat ? 'piyasa' : (m.sistem_fiyat ? 'sistem' : 'bilinmiyor')
        });
      }
      
      const porsiyonMaliyet = toplamMaliyet / (receteResult.rows[0].porsiyon_miktar || 1);
      
      // Reçeteye kaydet
      await query(`
        UPDATE receteler SET 
          tahmini_maliyet = $1,
          son_hesaplama_tarihi = NOW()
        WHERE id = $2
      `, [Math.round(porsiyonMaliyet * 100) / 100, recete_id]);
      
      return {
        success: true,
        recete: receteResult.rows[0].ad,
        porsiyon_maliyet: Math.round(porsiyonMaliyet * 100) / 100,
        toplam_maliyet: Math.round(toplamMaliyet * kisi_sayisi * 100) / 100,
        kisi_sayisi,
        detay: maliyetDetay,
        ozet: `1 porsiyon ${receteResult.rows[0].ad}: ${Math.round(porsiyonMaliyet * 100) / 100} TL, ${kisi_sayisi} kişi: ${Math.round(toplamMaliyet * kisi_sayisi * 100) / 100} TL`
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  
  // Menü önerisi
  menu_onerisi: async ({ proje_id, gun_sayisi = 7, ogun_tipleri, max_kalori, max_porsiyon_maliyet, tercih_ettikleri, haric_tutulacaklar }) => {
    try {
      // Proje şartnamesini al (varsa)
      let sartname = null;
      let sartnameGramajlar = [];
      let ogunYapilari = [];
      
      if (proje_id) {
        // Projenin varsayılan şartnamesini bul
        const sartnameResult = await query(`
          SELECT ps.*, psa.varsayilan
          FROM proje_sartnameleri ps
          JOIN proje_sartname_atamalari psa ON psa.sartname_id = ps.id
          WHERE psa.proje_id = $1 AND ps.aktif = true
          ORDER BY psa.varsayilan DESC
          LIMIT 1
        `, [proje_id]);
        
        if (sartnameResult.rows.length > 0) {
          sartname = sartnameResult.rows[0];
          
          // Şartname gramajlarını al
          const gramajResult = await query(`
            SELECT sg.*, rk.ad as kategori_adi, rk.kod as kategori_kod
            FROM sartname_gramajlari sg
            LEFT JOIN recete_kategoriler rk ON rk.id = sg.kategori_id
            WHERE sg.sartname_id = $1 AND sg.aktif = true
            ORDER BY sg.sira
          `, [sartname.id]);
          sartnameGramajlar = gramajResult.rows;
          
          // Öğün yapılarını al
          const ogunResult = await query(`
            SELECT * FROM sartname_ogun_yapilari
            WHERE sartname_id = $1 AND aktif = true
          `, [sartname.id]);
          ogunYapilari = ogunResult.rows;
        }
      }
      
      // Mevcut reçeteleri al
      const receteResult = await query(`
        SELECT 
          r.id, r.ad, r.kalori, r.tahmini_maliyet,
          rk.kod as kategori_kod, rk.ad as kategori
        FROM receteler r
        JOIN recete_kategoriler rk ON rk.id = r.kategori_id
        WHERE r.aktif = true
        ORDER BY RANDOM()
      `);
      
      const receteler = receteResult.rows;
      
      // Kategoriye göre grupla
      const kategoriler = {
        corba: receteler.filter(r => r.kategori_kod === 'corba'),
        ana_yemek: receteler.filter(r => r.kategori_kod === 'ana_yemek'),
        pilav_makarna: receteler.filter(r => r.kategori_kod === 'pilav_makarna'),
        salata_meze: receteler.filter(r => r.kategori_kod === 'salata_meze'),
        tatli: receteler.filter(r => r.kategori_kod === 'tatli')
      };
      
      // Şartnameden öğün yapısını belirle
      let cesitSayisi = 4; // varsayılan
      if (ogunYapilari.length > 0) {
        const ogle = ogunYapilari.find(o => o.ogun_tipi === 'ogle');
        if (ogle) {
          cesitSayisi = ogle.max_cesit || ogle.min_cesit || 4;
        }
      }
      
      // Menü oluştur
      const menu = [];
      const gunler = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
      
      for (let i = 0; i < gun_sayisi; i++) {
        const gunMenu = {
          gun: gunler[i % 7],
          ogle: [],
          toplam_kalori: 0,
          toplam_maliyet: 0
        };
        
        // Öğle menüsü
        // Çorba
        if (kategoriler.corba.length > 0) {
          const corba = kategoriler.corba[i % kategoriler.corba.length];
          const gramaj = sartnameGramajlar.find(g => g.kategori_kod === 'corba');
          gunMenu.ogle.push({ 
            tip: 'Çorba', 
            ...corba,
            sartname_gramaj: gramaj ? `${gramaj.porsiyon_gramaj} ${gramaj.birim}` : null
          });
          gunMenu.toplam_kalori += parseFloat(corba.kalori || 0);
          gunMenu.toplam_maliyet += parseFloat(corba.tahmini_maliyet || 0);
        }
        
        // Ana yemek
        if (kategoriler.ana_yemek.length > 0) {
          const ana = kategoriler.ana_yemek[i % kategoriler.ana_yemek.length];
          const gramaj = sartnameGramajlar.find(g => g.kategori_kod === 'ana_yemek');
          gunMenu.ogle.push({ 
            tip: 'Ana Yemek', 
            ...ana,
            sartname_gramaj: gramaj ? `${gramaj.porsiyon_gramaj} ${gramaj.birim}` : null
          });
          gunMenu.toplam_kalori += parseFloat(ana.kalori || 0);
          gunMenu.toplam_maliyet += parseFloat(ana.tahmini_maliyet || 0);
        }
        
        // Pilav/Makarna
        if (kategoriler.pilav_makarna.length > 0) {
          const pilav = kategoriler.pilav_makarna[i % kategoriler.pilav_makarna.length];
          const gramaj = sartnameGramajlar.find(g => g.kategori_kod === 'pilav_makarna');
          gunMenu.ogle.push({ 
            tip: 'Pilav/Makarna', 
            ...pilav,
            sartname_gramaj: gramaj ? `${gramaj.porsiyon_gramaj} ${gramaj.birim}` : null
          });
          gunMenu.toplam_kalori += parseFloat(pilav.kalori || 0);
          gunMenu.toplam_maliyet += parseFloat(pilav.tahmini_maliyet || 0);
        }
        
        // Salata
        if (kategoriler.salata_meze.length > 0) {
          const salata = kategoriler.salata_meze[i % kategoriler.salata_meze.length];
          const gramaj = sartnameGramajlar.find(g => g.kategori_kod === 'salata_meze');
          gunMenu.ogle.push({ 
            tip: 'Salata', 
            ...salata,
            sartname_gramaj: gramaj ? `${gramaj.porsiyon_gramaj} ${gramaj.birim}` : null
          });
          gunMenu.toplam_kalori += parseFloat(salata.kalori || 0);
          gunMenu.toplam_maliyet += parseFloat(salata.tahmini_maliyet || 0);
        }
        
        menu.push(gunMenu);
      }
      
      return {
        success: true,
        gun_sayisi,
        sartname_bilgi: sartname ? {
          ad: sartname.ad,
          kurum: sartname.kurum_adi,
          yil: sartname.yil,
          gramaj_sayisi: sartnameGramajlar.length,
          ogun_yapilari: ogunYapilari.map(o => ({
            ogun: o.ogun_tipi,
            cesit: `${o.min_cesit}-${o.max_cesit}`,
            aciklama: o.aciklama
          }))
        } : null,
        menu,
        toplam_maliyet: menu.reduce((sum, g) => sum + g.toplam_maliyet, 0),
        ortalama_gunluk_maliyet: menu.reduce((sum, g) => sum + g.toplam_maliyet, 0) / gun_sayisi,
        not: sartname 
          ? `Bu öneri ${sartname.ad} şartnamesine göre hazırlanmıştır. Gramajlar şartname referansıyla gösterilmiştir.`
          : 'Bu öneri mevcut reçetelere göre yapılmıştır. Proje için şartname atayarak daha hassas sonuçlar alabilirsiniz.'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  
  // Maliyet optimizasyonu
  maliyet_optimizasyonu: async ({ recete_id, hedef_tasarruf_yuzde = 20 }) => {
    try {
      // Reçete ve malzemelerini al
      const receteResult = await query(`
        SELECT r.*, rk.ad as kategori
        FROM receteler r
        JOIN recete_kategoriler rk ON rk.id = r.kategori_id
        WHERE r.id = $1
      `, [recete_id]);
      
      if (receteResult.rows.length === 0) {
        return { success: false, error: 'Reçete bulunamadı' };
      }
      
      const malzemeResult = await query(`
        SELECT rm.*, sk.ad as stok_adi
        FROM recete_malzemeler rm
        LEFT JOIN stok_kartlari sk ON sk.id = rm.stok_kart_id
        WHERE rm.recete_id = $1
        ORDER BY rm.toplam_fiyat DESC NULLS LAST
      `, [recete_id]);
      
      const oneriler = [];
      
      // En pahalı malzemeleri analiz et
      for (const m of malzemeResult.rows) {
        if (m.toplam_fiyat && m.toplam_fiyat > 1) {
          // Piyasa araştırması yap
          try {
            const piyasaSonuc = await searchMarketPrices(m.malzeme_adi);
            
            if (piyasaSonuc && piyasaSonuc.length > 0) {
              const enUcuz = piyasaSonuc.sort((a, b) => a.price - b.price)[0];
              
              if (enUcuz.price < m.birim_fiyat) {
                oneriler.push({
                  malzeme: m.malzeme_adi,
                  mevcut_fiyat: m.birim_fiyat,
                  oneri_fiyat: enUcuz.price,
                  kaynak: enUcuz.market,
                  tasarruf: Math.round((m.birim_fiyat - enUcuz.price) * 100) / 100,
                  tasarruf_yuzde: Math.round((1 - enUcuz.price / m.birim_fiyat) * 100)
                });
              }
            }
          } catch (e) {
            // Piyasa araştırması başarısız, devam et
          }
        }
      }
      
      // Genel öneriler
      const genelOneriler = [
        'Toplu alım yaparak birim maliyeti düşürebilirsiniz',
        'Mevsiminde olan sebze/meyveler daha ucuzdur',
        'Yerel tedarikçilerden alım yaparak nakliye maliyetini azaltabilirsiniz'
      ];
      
      return {
        success: true,
        recete: receteResult.rows[0].ad,
        mevcut_maliyet: receteResult.rows[0].tahmini_maliyet,
        malzeme_onerileri: oneriler,
        genel_oneriler: genelOneriler,
        potansiyel_tasarruf: oneriler.reduce((sum, o) => sum + o.tasarruf, 0)
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  
  // Besin analizi
  besin_analizi: async ({ recete_id, porsiyon = 1 }) => {
    try {
      const receteResult = await query(`
        SELECT r.*, rk.ad as kategori
        FROM receteler r
        JOIN recete_kategoriler rk ON rk.id = r.kategori_id
        WHERE r.id = $1
      `, [recete_id]);
      
      if (receteResult.rows.length === 0) {
        return { success: false, error: 'Reçete bulunamadı' };
      }
      
      const recete = receteResult.rows[0];
      
      // Günlük ihtiyaç yüzdeleri (2000 kcal bazında)
      const gunlukIhtiyac = {
        kalori: 2000,
        protein: 50,
        karbonhidrat: 300,
        yag: 65,
        lif: 25
      };
      
      const kalori = parseFloat(recete.kalori || 0) * porsiyon;
      const protein = parseFloat(recete.protein || 0) * porsiyon;
      const karbonhidrat = parseFloat(recete.karbonhidrat || 0) * porsiyon;
      const yag = parseFloat(recete.yag || 0) * porsiyon;
      const lif = parseFloat(recete.lif || 0) * porsiyon;
      
      return {
        success: true,
        recete: recete.ad,
        kategori: recete.kategori,
        porsiyon,
        besin_degerleri: {
          kalori: {
            miktar: kalori,
            birim: 'kcal',
            gunluk_yuzde: Math.round((kalori / gunlukIhtiyac.kalori) * 100)
          },
          protein: {
            miktar: protein,
            birim: 'g',
            gunluk_yuzde: Math.round((protein / gunlukIhtiyac.protein) * 100)
          },
          karbonhidrat: {
            miktar: karbonhidrat,
            birim: 'g',
            gunluk_yuzde: Math.round((karbonhidrat / gunlukIhtiyac.karbonhidrat) * 100)
          },
          yag: {
            miktar: yag,
            birim: 'g',
            gunluk_yuzde: Math.round((yag / gunlukIhtiyac.yag) * 100)
          },
          lif: {
            miktar: lif,
            birim: 'g',
            gunluk_yuzde: Math.round((lif / gunlukIhtiyac.lif) * 100)
          }
        },
        degerlendirme: kalori > 500 ? 'Yüksek kalorili' : (kalori > 200 ? 'Orta kalorili' : 'Düşük kalorili'),
        protein_orani: protein > 20 ? 'Yüksek proteinli' : 'Normal proteinli'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  
  // Aylık menü oluştur ve veritabanına kaydet
  aylik_menu_olustur: async ({ proje_id, ay, yil, kisi_sayisi = 1000, ogunler, max_gunluk_maliyet, ozel_gunler, tercihler }) => {
    try {
      // Varsayılan öğünler
      const planlanacakOgunler = ogunler || ['kahvalti', 'ogle', 'aksam'];
      
      // Ay bilgilerini hesapla
      const ayBaslangic = `${yil}-${String(ay).padStart(2, '0')}-01`;
      const sonGun = new Date(yil, ay, 0).getDate();
      const ayBitis = `${yil}-${String(ay).padStart(2, '0')}-${sonGun}`;
      
      // Proje bilgisini al
      const projeResult = await query('SELECT ad FROM projeler WHERE id = $1', [proje_id]);
      if (projeResult.rows.length === 0) {
        return { success: false, error: 'Proje bulunamadı' };
      }
      const projeAdi = projeResult.rows[0].ad;
      
      // Proje şartnamesini al (varsa)
      let sartname = null;
      let ogunYapilari = [];
      
      const sartnameResult = await query(`
        SELECT ps.*, psa.varsayilan
        FROM proje_sartnameleri ps
        JOIN proje_sartname_atamalari psa ON psa.sartname_id = ps.id
        WHERE psa.proje_id = $1 AND ps.aktif = true
        ORDER BY psa.varsayilan DESC
        LIMIT 1
      `, [proje_id]);
      
      if (sartnameResult.rows.length > 0) {
        sartname = sartnameResult.rows[0];
        
        // Öğün yapılarını al
        const ogunResult = await query(`
          SELECT * FROM sartname_ogun_yapilari
          WHERE sartname_id = $1 AND aktif = true
        `, [sartname.id]);
        ogunYapilari = ogunResult.rows;
      }
      
      // Ay adı
      const aylar = ['', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
                     'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
      const ayAdi = aylar[ay];
      
      // Menü planı oluştur
      const planResult = await query(`
        INSERT INTO menu_planlari (
          proje_id, ad, tip, baslangic_tarihi, bitis_tarihi,
          varsayilan_kisi_sayisi, durum, notlar
        ) VALUES ($1, $2, 'aylik', $3, $4, $5, 'taslak', $6)
        ON CONFLICT (proje_id, baslangic_tarihi, bitis_tarihi) 
        DO UPDATE SET updated_at = NOW()
        RETURNING id
      `, [
        proje_id, 
        `${projeAdi} - ${ayAdi} ${yil} Menüsü`,
        ayBaslangic, 
        ayBitis, 
        kisi_sayisi,
        tercihler || null
      ]);
      
      const planId = planResult.rows[0].id;
      
      // Reçeteleri kategorilere göre al
      const receteResult = await query(`
        SELECT 
          r.id, r.ad, r.tahmini_maliyet, r.kalori,
          rk.kod as kategori_kod, rk.ikon
        FROM receteler r
        JOIN recete_kategoriler rk ON rk.id = r.kategori_id
        WHERE r.aktif = true
        ORDER BY RANDOM()
      `);
      
      const receteler = receteResult.rows;
      const kategoriler = {
        corba: receteler.filter(r => r.kategori_kod === 'corba'),
        ana_yemek: receteler.filter(r => r.kategori_kod === 'ana_yemek'),
        pilav_makarna: receteler.filter(r => r.kategori_kod === 'pilav_makarna'),
        salata_meze: receteler.filter(r => r.kategori_kod === 'salata_meze'),
        tatli: receteler.filter(r => r.kategori_kod === 'tatli'),
        kahvaltilik: receteler.filter(r => r.kategori_kod === 'kahvaltilik' || r.kategori_kod === 'kahvalti_paketi')
      };
      
      // Öğün tiplerini al
      const ogunTipResult = await query('SELECT id, kod FROM ogun_tipleri WHERE aktif = true');
      const ogunTipMap = {};
      ogunTipResult.rows.forEach(o => { ogunTipMap[o.kod] = o.id; });
      
      // Her gün için menü oluştur
      let eklenenOgunSayisi = 0;
      let eklenenYemekSayisi = 0;
      let toplamMaliyet = 0;
      
      const sonucMenu = [];
      
      for (let gun = 1; gun <= sonGun; gun++) {
        const tarih = `${yil}-${String(ay).padStart(2, '0')}-${String(gun).padStart(2, '0')}`;
        const gunDate = new Date(yil, ay - 1, gun);
        const haftaninGunu = gunDate.getDay(); // 0=Pazar, 6=Cumartesi
        const gunAdi = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'][haftaninGunu];
        
        const gunMenusu = { tarih, gun: gunAdi, ogunler: {} };
        
        for (const ogunKod of planlanacakOgunler) {
          const ogunTipiId = ogunTipMap[ogunKod];
          if (!ogunTipiId) continue;
          
          // Öğün oluştur
          const ogunResult = await query(`
            INSERT INTO menu_plan_ogunleri (
              menu_plan_id, tarih, ogun_tipi_id, kisi_sayisi
            ) VALUES ($1, $2, $3, $4)
            ON CONFLICT (menu_plan_id, tarih, ogun_tipi_id) DO UPDATE SET kisi_sayisi = $4
            RETURNING id
          `, [planId, tarih, ogunTipiId, kisi_sayisi]);
          
          const ogunId = ogunResult.rows[0].id;
          eklenenOgunSayisi++;
          
          // Öğüne göre yemek seç
          let secilenYemekler = [];
          
          if (ogunKod === 'kahvalti') {
            // Kahvaltı için kahvaltılık kategorisi
            if (kategoriler.kahvaltilik.length > 0) {
              const idx = (gun - 1) % kategoriler.kahvaltilik.length;
              secilenYemekler.push(kategoriler.kahvaltilik[idx]);
            }
          } else {
            // Öğle ve akşam için 4 çeşit
            // Çorba
            if (kategoriler.corba.length > 0) {
              const idx = (gun - 1 + (ogunKod === 'aksam' ? 3 : 0)) % kategoriler.corba.length;
              secilenYemekler.push(kategoriler.corba[idx]);
            }
            // Ana yemek
            if (kategoriler.ana_yemek.length > 0) {
              const idx = (gun - 1 + (ogunKod === 'aksam' ? 5 : 0)) % kategoriler.ana_yemek.length;
              secilenYemekler.push(kategoriler.ana_yemek[idx]);
            }
            // Pilav/Makarna
            if (kategoriler.pilav_makarna.length > 0) {
              const idx = (gun - 1 + (ogunKod === 'aksam' ? 2 : 0)) % kategoriler.pilav_makarna.length;
              secilenYemekler.push(kategoriler.pilav_makarna[idx]);
            }
            // Salata/Meze
            if (kategoriler.salata_meze.length > 0) {
              const idx = (gun - 1 + (ogunKod === 'aksam' ? 4 : 0)) % kategoriler.salata_meze.length;
              secilenYemekler.push(kategoriler.salata_meze[idx]);
            }
          }
          
          // Yemekleri ekle
          let sira = 1;
          const ogunYemekleri = [];
          
          for (const yemek of secilenYemekler) {
            const porsiyonMaliyet = parseFloat(yemek.tahmini_maliyet) || 0;
            const yemekToplamMaliyet = porsiyonMaliyet * kisi_sayisi;
            
            await query(`
              INSERT INTO menu_ogun_yemekleri (
                menu_ogun_id, recete_id, sira, porsiyon_maliyet, toplam_maliyet
              ) VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (menu_ogun_id, recete_id) DO UPDATE SET
                porsiyon_maliyet = $4, toplam_maliyet = $5
            `, [ogunId, yemek.id, sira, porsiyonMaliyet, yemekToplamMaliyet]);
            
            eklenenYemekSayisi++;
            toplamMaliyet += porsiyonMaliyet;
            sira++;
            
            ogunYemekleri.push(`${yemek.ikon} ${yemek.ad}`);
          }
          
          gunMenusu.ogunler[ogunKod] = ogunYemekleri;
        }
        
        sonucMenu.push(gunMenusu);
      }
      
      // Plan maliyetini güncelle
      await query(`
        UPDATE menu_planlari SET
          toplam_maliyet = $1,
          gunluk_ortalama_maliyet = $2,
          porsiyon_ortalama_maliyet = $3
        WHERE id = $4
      `, [
        toplamMaliyet * kisi_sayisi,
        (toplamMaliyet * kisi_sayisi) / sonGun,
        toplamMaliyet / eklenenOgunSayisi,
        planId
      ]);
      
      return {
        success: true,
        mesaj: `${projeAdi} için ${ayAdi} ${yil} menüsü başarıyla oluşturuldu!`,
        ozet: {
          plan_id: planId,
          proje: projeAdi,
          donem: `${ayAdi} ${yil}`,
          gun_sayisi: sonGun,
          ogun_sayisi: eklenenOgunSayisi,
          yemek_sayisi: eklenenYemekSayisi,
          kisi_sayisi: kisi_sayisi,
          tahmini_aylik_maliyet: `${Math.round(toplamMaliyet * kisi_sayisi).toLocaleString('tr-TR')} TL`,
          ortalama_gunluk_maliyet: `${Math.round((toplamMaliyet * kisi_sayisi) / sonGun).toLocaleString('tr-TR')} TL`,
          porsiyon_ortalama: `${Math.round(toplamMaliyet / eklenenOgunSayisi * 100) / 100} TL`
        },
        sartname_bilgi: sartname ? {
          ad: sartname.ad,
          kurum: sartname.kurum_adi,
          ogun_yapilari: ogunYapilari.map(o => ({
            ogun: o.ogun_tipi,
            cesit: `${o.min_cesit}-${o.max_cesit}`,
            aciklama: o.aciklama
          }))
        } : null,
        ilk_3_gun: sonucMenu.slice(0, 3),
        not: sartname 
          ? `Menü ${sartname.ad} şartnamesine göre hazırlandı ve tabloya kaydedildi.`
          : 'Menü tabloya kaydedildi. Proje için şartname atayarak daha hassas menüler oluşturabilirsiniz.'
      };
    } catch (error) {
      console.error('Aylık menü oluşturma hatası:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Güne yemek ekle
  gune_yemek_ekle: async ({ proje_id, tarih, ogun, recete_id, kisi_sayisi = 1000 }) => {
    try {
      // Öğün tipi ID'sini al
      const ogunResult = await query('SELECT id FROM ogun_tipleri WHERE kod = $1', [ogun]);
      if (ogunResult.rows.length === 0) {
        return { success: false, error: `Geçersiz öğün tipi: ${ogun}` };
      }
      const ogunTipiId = ogunResult.rows[0].id;
      
      // Reçete bilgisini al
      const receteResult = await query(`
        SELECT r.ad, r.tahmini_maliyet, rk.ikon 
        FROM receteler r
        JOIN recete_kategoriler rk ON rk.id = r.kategori_id
        WHERE r.id = $1
      `, [recete_id]);
      
      if (receteResult.rows.length === 0) {
        return { success: false, error: 'Reçete bulunamadı' };
      }
      const recete = receteResult.rows[0];
      
      // Menü planını bul veya oluştur
      const ay = tarih.substring(0, 7);
      const ayBaslangic = `${ay}-01`;
      const yil = parseInt(tarih.substring(0, 4));
      const ayNum = parseInt(tarih.substring(5, 7));
      const sonGun = new Date(yil, ayNum, 0).getDate();
      const ayBitis = `${ay}-${sonGun}`;
      
      let planResult = await query(`
        SELECT id FROM menu_planlari 
        WHERE proje_id = $1 AND baslangic_tarihi <= $2 AND bitis_tarihi >= $2
      `, [proje_id, tarih]);
      
      let planId;
      if (planResult.rows.length === 0) {
        const newPlanResult = await query(`
          INSERT INTO menu_planlari (proje_id, ad, tip, baslangic_tarihi, bitis_tarihi, varsayilan_kisi_sayisi, durum)
          VALUES ($1, $2, 'aylik', $3, $4, $5, 'taslak')
          RETURNING id
        `, [proje_id, `Menü - ${ay}`, ayBaslangic, ayBitis, kisi_sayisi]);
        planId = newPlanResult.rows[0].id;
      } else {
        planId = planResult.rows[0].id;
      }
      
      // Öğünü bul veya oluştur
      let ogunPlanResult = await query(`
        SELECT id FROM menu_plan_ogunleri 
        WHERE menu_plan_id = $1 AND tarih = $2 AND ogun_tipi_id = $3
      `, [planId, tarih, ogunTipiId]);
      
      let ogunId;
      if (ogunPlanResult.rows.length === 0) {
        const newOgunResult = await query(`
          INSERT INTO menu_plan_ogunleri (menu_plan_id, tarih, ogun_tipi_id, kisi_sayisi)
          VALUES ($1, $2, $3, $4)
          RETURNING id
        `, [planId, tarih, ogunTipiId, kisi_sayisi]);
        ogunId = newOgunResult.rows[0].id;
      } else {
        ogunId = ogunPlanResult.rows[0].id;
      }
      
      // Sıra numarasını bul
      const siraResult = await query(`
        SELECT COALESCE(MAX(sira), 0) + 1 as next_sira 
        FROM menu_ogun_yemekleri WHERE menu_ogun_id = $1
      `, [ogunId]);
      
      const porsiyonMaliyet = parseFloat(recete.tahmini_maliyet) || 0;
      
      // Yemek ekle
      await query(`
        INSERT INTO menu_ogun_yemekleri (menu_ogun_id, recete_id, sira, porsiyon_maliyet, toplam_maliyet)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (menu_ogun_id, recete_id) DO UPDATE SET
          porsiyon_maliyet = $4, toplam_maliyet = $5
      `, [ogunId, recete_id, siraResult.rows[0].next_sira, porsiyonMaliyet, porsiyonMaliyet * kisi_sayisi]);
      
      const ogunAdlari = { kahvalti: 'Kahvaltı', ogle: 'Öğle', aksam: 'Akşam' };
      
      return {
        success: true,
        mesaj: `${recete.ikon} ${recete.ad} → ${tarih} ${ogunAdlari[ogun]} menüsüne eklendi.`,
        detay: {
          tarih,
          ogun: ogunAdlari[ogun],
          yemek: recete.ad,
          porsiyon_maliyet: porsiyonMaliyet,
          toplam_maliyet: porsiyonMaliyet * kisi_sayisi
        }
      };
    } catch (error) {
      console.error('Yemek ekleme hatası:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Gün menüsünü getir
  gun_menusunu_getir: async ({ proje_id, tarih }) => {
    try {
      const result = await query(`
        SELECT 
          ot.kod as ogun,
          ot.ad as ogun_adi,
          ot.ikon as ogun_ikon,
          r.ad as yemek,
          rk.ikon as yemek_ikon,
          moy.porsiyon_maliyet
        FROM menu_planlari mp
        JOIN menu_plan_ogunleri mpo ON mpo.menu_plan_id = mp.id
        JOIN ogun_tipleri ot ON ot.id = mpo.ogun_tipi_id
        JOIN menu_ogun_yemekleri moy ON moy.menu_ogun_id = mpo.id
        JOIN receteler r ON r.id = moy.recete_id
        JOIN recete_kategoriler rk ON rk.id = r.kategori_id
        WHERE mp.proje_id = $1 AND mpo.tarih = $2
        ORDER BY ot.varsayilan_sira, moy.sira
      `, [proje_id, tarih]);
      
      if (result.rows.length === 0) {
        return {
          success: true,
          tarih,
          mesaj: 'Bu gün için henüz menü planlanmamış.',
          menu: {}
        };
      }
      
      // Öğünlere göre grupla
      const menu = {};
      let toplamMaliyet = 0;
      
      result.rows.forEach(row => {
        if (!menu[row.ogun]) {
          menu[row.ogun] = {
            ad: row.ogun_adi,
            ikon: row.ogun_ikon,
            yemekler: []
          };
        }
        menu[row.ogun].yemekler.push({
          ad: row.yemek,
          ikon: row.yemek_ikon,
          maliyet: row.porsiyon_maliyet
        });
        toplamMaliyet += parseFloat(row.porsiyon_maliyet) || 0;
      });
      
      return {
        success: true,
        tarih,
        menu,
        toplam_porsiyon_maliyet: Math.round(toplamMaliyet * 100) / 100
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

export default { menuToolDefinitions, menuToolImplementations };

