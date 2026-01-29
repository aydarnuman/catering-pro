/**
 * Personel AI Tools
 * İK Uzmanı + Mali Müşavir için araçlar
 */

import { query } from '../../database.js';

// Tool tanımları
export const personelToolDefinitions = [
  // ==========================================
  // PERSONEL İŞLEMLERİ
  // ==========================================
  {
    name: 'personel_listele',
    description: 'Personelleri listeler. Departman, durum veya proje bazlı filtreleme yapılabilir.',
    input_schema: {
      type: 'object',
      properties: {
        departman: { type: 'string', description: 'Departman filtresi' },
        durum: { type: 'string', enum: ['aktif', 'izinli', 'pasif'], description: 'Durum filtresi' },
        proje_id: { type: 'number', description: 'Proje ID filtresi' },
        limit: { type: 'number', description: 'Maksimum kayıt sayısı', default: 20 },
      },
    },
  },
  {
    name: 'personel_ara',
    description: 'Ad, soyad veya TC kimlik numarasına göre personel arar.',
    input_schema: {
      type: 'object',
      properties: {
        arama: { type: 'string', description: 'Aranacak metin (ad, soyad veya TC)' },
      },
      required: ['arama'],
    },
  },
  {
    name: 'personel_detay',
    description: 'Bir personelin tüm detaylarını getirir (izin, bordro, projeler dahil).',
    input_schema: {
      type: 'object',
      properties: {
        personel_id: { type: 'number', description: 'Personel ID' },
      },
      required: ['personel_id'],
    },
  },
  {
    name: 'personel_istatistik',
    description: 'Personel istatistiklerini getirir (toplam, departman dağılımı, ortalama maaş vb.).',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },

  // ==========================================
  // BORDRO İŞLEMLERİ
  // ==========================================
  {
    name: 'bordro_hesapla',
    description: 'Bir personel için bordro hesaplar. Net maaştan brüt ve toplam maliyeti hesaplar.',
    input_schema: {
      type: 'object',
      properties: {
        personel_id: { type: 'number', description: 'Personel ID' },
        net_maas: { type: 'number', description: 'Hedef net maaş (opsiyonel, personel maaşı kullanılır)' },
      },
      required: ['personel_id'],
    },
  },
  {
    name: 'bordro_karsilastir',
    description: 'İki veya daha fazla personelin bordro maliyetlerini karşılaştırır.',
    input_schema: {
      type: 'object',
      properties: {
        personel_idler: {
          type: 'array',
          items: { type: 'number' },
          description: 'Karşılaştırılacak personel ID listesi',
        },
      },
      required: ['personel_idler'],
    },
  },
  {
    name: 'toplam_maliyet_hesapla',
    description: 'Tüm personelin veya bir departmanın toplam maaş maliyetini hesaplar.',
    input_schema: {
      type: 'object',
      properties: {
        departman: { type: 'string', description: 'Departman filtresi (boş bırakılırsa tümü)' },
        proje_id: { type: 'number', description: 'Proje filtresi' },
      },
    },
  },

  // ==========================================
  // İZİN İŞLEMLERİ
  // ==========================================
  {
    name: 'izin_talep_olustur',
    description: 'Yeni bir izin talebi oluşturur.',
    input_schema: {
      type: 'object',
      properties: {
        personel_id: { type: 'number', description: 'Personel ID' },
        izin_turu: {
          type: 'string',
          enum: ['yillik', 'ucretsiz', 'mazeret', 'rapor', 'evlilik', 'dogum_anne', 'dogum_baba', 'olum'],
          description: 'İzin türü kodu',
        },
        baslangic_tarihi: { type: 'string', description: 'Başlangıç tarihi (YYYY-MM-DD)' },
        bitis_tarihi: { type: 'string', description: 'Bitiş tarihi (YYYY-MM-DD)' },
        aciklama: { type: 'string', description: 'İzin açıklaması' },
      },
      required: ['personel_id', 'izin_turu', 'baslangic_tarihi', 'bitis_tarihi'],
    },
  },
  {
    name: 'izin_listele',
    description: 'İzin taleplerini listeler.',
    input_schema: {
      type: 'object',
      properties: {
        personel_id: { type: 'number', description: 'Personel ID filtresi' },
        durum: { type: 'string', enum: ['beklemede', 'onaylandi', 'reddedildi'], description: 'Durum filtresi' },
      },
    },
  },
  {
    name: 'izin_bakiye_sorgula',
    description: 'Bir personelin izin bakiyesini sorgular.',
    input_schema: {
      type: 'object',
      properties: {
        personel_id: { type: 'number', description: 'Personel ID' },
      },
      required: ['personel_id'],
    },
  },
  {
    name: 'bugun_izinli_listele',
    description: 'Bugün izinli olan personelleri listeler.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },

  // ==========================================
  // KIDEM VE TAZMİNAT
  // ==========================================
  {
    name: 'kidem_hesapla',
    description: 'Bir personelin kıdem tazminatı, ihbar tazminatı ve kullanılmamış izin ücretini hesaplar.',
    input_schema: {
      type: 'object',
      properties: {
        personel_id: { type: 'number', description: 'Personel ID' },
        cikis_tarihi: { type: 'string', description: 'Çıkış tarihi (YYYY-MM-DD, boş bırakılırsa bugün)' },
        cikis_nedeni: {
          type: 'string',
          enum: ['istifa', 'isten_cikarma', 'karsilikli_fesih', 'emeklilik'],
          description: 'Çıkış nedeni',
        },
      },
      required: ['personel_id'],
    },
  },

  // ==========================================
  // YASAL BİLGİ VE MEVZUAT
  // ==========================================
  {
    name: 'mevzuat_bilgi',
    description: 'SGK, vergi, izin hakları ve iş hukuku hakkında bilgi verir.',
    input_schema: {
      type: 'object',
      properties: {
        konu: { type: 'string', description: 'Sorulacak konu (sgk, vergi, izin, kidem, ihbar, asgari_ucret)' },
      },
      required: ['konu'],
    },
  },
];

// Tool implementasyonları
export const personelToolImplementations = {
  // ==========================================
  // PERSONEL İŞLEMLERİ
  // ==========================================
  async personel_listele({ departman, durum, proje_id, limit = 20 }) {
    let sql = `
      SELECT p.*, 
        COALESCE(json_agg(DISTINCT jsonb_build_object(
          'proje_id', pr.id,
          'proje_ad', pr.ad
        )) FILTER (WHERE pr.id IS NOT NULL), '[]') as projeler
      FROM personeller p
      LEFT JOIN proje_personelleri pp ON pp.personel_id = p.id AND pp.aktif = TRUE
      LEFT JOIN projeler pr ON pr.id = pp.proje_id
      WHERE p.isten_cikis_tarihi IS NULL
    `;
    const params = [];
    let idx = 1;

    if (departman) {
      sql += ` AND LOWER(p.departman) LIKE LOWER($${idx})`;
      params.push(`%${departman}%`);
      idx++;
    }
    if (durum) {
      sql += ` AND p.durum = $${idx}`;
      params.push(durum);
      idx++;
    }
    if (proje_id) {
      sql += ` AND p.id IN (SELECT personel_id FROM proje_personelleri WHERE proje_id = $${idx} AND aktif = TRUE)`;
      params.push(proje_id);
      idx++;
    }

    sql += ` GROUP BY p.id ORDER BY p.ad LIMIT $${idx}`;
    params.push(limit);

    const result = await query(sql, params);
    return {
      success: true,
      count: result.rows.length,
      personeller: result.rows.map((p) => ({
        id: p.id,
        ad_soyad: `${p.ad} ${p.soyad}`,
        departman: p.departman,
        pozisyon: p.pozisyon,
        net_maas: p.maas,
        durum: p.durum || 'aktif',
        ise_giris: p.ise_giris_tarihi,
        projeler: p.projeler,
      })),
    };
  },

  async personel_ara({ arama }) {
    const result = await query(
      `
      SELECT id, ad, soyad, departman, pozisyon, maas, tc_kimlik, telefon
      FROM personeller
      WHERE isten_cikis_tarihi IS NULL
      AND (
        LOWER(ad) LIKE LOWER($1) OR 
        LOWER(soyad) LIKE LOWER($1) OR 
        tc_kimlik LIKE $1 OR
        LOWER(ad || ' ' || soyad) LIKE LOWER($1)
      )
      LIMIT 10
    `,
      [`%${arama}%`]
    );

    return {
      success: true,
      count: result.rows.length,
      sonuclar: result.rows.map((p) => ({
        id: p.id,
        ad_soyad: `${p.ad} ${p.soyad}`,
        departman: p.departman,
        pozisyon: p.pozisyon,
        net_maas: p.maas,
        tc_kimlik: p.tc_kimlik,
      })),
    };
  },

  async personel_detay({ personel_id }) {
    const personelResult = await query(`SELECT * FROM personeller WHERE id = $1`, [personel_id]);
    if (personelResult.rows.length === 0) {
      return { success: false, error: 'Personel bulunamadı' };
    }

    const p = personelResult.rows[0];

    // Projeler
    const projelerResult = await query(
      `
      SELECT pr.ad, pp.gorev, pp.baslangic_tarihi
      FROM proje_personelleri pp
      JOIN projeler pr ON pr.id = pp.proje_id
      WHERE pp.personel_id = $1 AND pp.aktif = TRUE
    `,
      [personel_id]
    );

    // İzin bakiyesi
    const izinResult = await query(
      `
      SELECT 
        COALESCE(SUM(CASE WHEN it.kod = 'yillik' AND iz.durum = 'onaylandi' THEN iz.gun_sayisi ELSE 0 END), 0) as kullanilan_yillik
      FROM izin_talepleri iz
      JOIN izin_turleri it ON it.id = iz.izin_turu_id
      WHERE iz.personel_id = $1 AND EXTRACT(YEAR FROM iz.baslangic_tarihi) = EXTRACT(YEAR FROM CURRENT_DATE)
    `,
      [personel_id]
    );

    // Kıdem
    const iseGiris = new Date(p.ise_giris_tarihi);
    const bugun = new Date();
    const kidemGun = Math.floor((bugun - iseGiris) / (1000 * 60 * 60 * 24));
    const kidemYil = (kidemGun / 365).toFixed(1);

    return {
      success: true,
      personel: {
        id: p.id,
        ad_soyad: `${p.ad} ${p.soyad}`,
        tc_kimlik: p.tc_kimlik,
        departman: p.departman,
        pozisyon: p.pozisyon,
        net_maas: p.maas,
        telefon: p.telefon,
        email: p.email,
        ise_giris: p.ise_giris_tarihi,
        durum: p.durum || 'aktif',
        medeni_durum: p.medeni_durum,
        cocuk_sayisi: p.cocuk_sayisi,
      },
      kidem: {
        gun: kidemGun,
        yil: kidemYil,
      },
      projeler: projelerResult.rows,
      izin: {
        yillik_hak: kidemGun >= 365 ? 14 : 0,
        kullanilan: parseInt(izinResult.rows[0].kullanilan_yillik, 10) || 0,
      },
    };
  },

  async personel_istatistik() {
    const result = await query(`
      SELECT 
        COUNT(*) as toplam_personel,
        COUNT(*) FILTER (WHERE durum = 'aktif' OR durum IS NULL) as aktif,
        COUNT(*) FILTER (WHERE durum = 'izinli') as izinli,
        AVG(maas) as ortalama_maas,
        MIN(maas) as min_maas,
        MAX(maas) as max_maas,
        SUM(maas) as toplam_maas
      FROM personeller
      WHERE isten_cikis_tarihi IS NULL
    `);

    const departmanResult = await query(`
      SELECT departman, COUNT(*) as sayi, AVG(maas) as ort_maas
      FROM personeller
      WHERE isten_cikis_tarihi IS NULL AND departman IS NOT NULL
      GROUP BY departman
      ORDER BY sayi DESC
    `);

    return {
      success: true,
      genel: {
        toplam: parseInt(result.rows[0].toplam_personel, 10),
        aktif: parseInt(result.rows[0].aktif, 10),
        izinli: parseInt(result.rows[0].izinli, 10),
        ortalama_net_maas: Math.round(result.rows[0].ortalama_maas),
        toplam_net_maas: Math.round(result.rows[0].toplam_maas),
      },
      departmanlar: departmanResult.rows.map((d) => ({
        departman: d.departman,
        personel_sayisi: parseInt(d.sayi, 10),
        ortalama_maas: Math.round(d.ort_maas),
      })),
    };
  },

  // ==========================================
  // BORDRO İŞLEMLERİ
  // ==========================================
  async bordro_hesapla({ personel_id, net_maas }) {
    const personelResult = await query(`SELECT * FROM personeller WHERE id = $1`, [personel_id]);
    if (personelResult.rows.length === 0) {
      return { success: false, error: 'Personel bulunamadı' };
    }

    const p = personelResult.rows[0];
    const hedefNet = net_maas || parseFloat(p.maas);

    // Net'ten brüt hesapla (basit formül)
    const brutTahmin = hedefNet * 1.4;

    // SGK oranları
    const sgkIsci = brutTahmin * 0.14;
    const issizlikIsci = brutTahmin * 0.01;
    const sgkIsveren = brutTahmin * 0.155;
    const issizlikIsveren = brutTahmin * 0.02;

    // Vergiler
    const vergiMatrahi = brutTahmin - sgkIsci - issizlikIsci;
    const gelirVergisi = vergiMatrahi * 0.15;
    const damgaVergisi = brutTahmin * 0.00759;

    // AGİ
    const agi = p.medeni_durum === 'evli' ? 2500 : 2000;

    const hesaplananNet = brutTahmin - sgkIsci - issizlikIsci - gelirVergisi - damgaVergisi + agi;
    const toplamMaliyet = brutTahmin + sgkIsveren + issizlikIsveren;

    return {
      success: true,
      personel: `${p.ad} ${p.soyad}`,
      bordro: {
        net_maas: Math.round(hesaplananNet),
        brut_maas: Math.round(brutTahmin),
        sgk_isci: Math.round(sgkIsci),
        issizlik_isci: Math.round(issizlikIsci),
        gelir_vergisi: Math.round(gelirVergisi),
        damga_vergisi: Math.round(damgaVergisi),
        agi: agi,
        sgk_isveren: Math.round(sgkIsveren),
        issizlik_isveren: Math.round(issizlikIsveren),
        toplam_maliyet: Math.round(toplamMaliyet),
      },
    };
  },

  async bordro_karsilastir({ personel_idler }) {
    const sonuclar = [];
    for (const id of personel_idler) {
      const bordro = await this.bordro_hesapla({ personel_id: id });
      if (bordro.success) {
        sonuclar.push({
          personel: bordro.personel,
          ...bordro.bordro,
        });
      }
    }

    return {
      success: true,
      karsilastirma: sonuclar,
      toplam_maliyet: sonuclar.reduce((sum, b) => sum + b.toplam_maliyet, 0),
    };
  },

  async toplam_maliyet_hesapla({ departman, proje_id }) {
    let sql = `SELECT id, ad, soyad, maas, departman FROM personeller WHERE isten_cikis_tarihi IS NULL`;
    const params = [];
    let idx = 1;

    if (departman) {
      sql += ` AND LOWER(departman) LIKE LOWER($${idx})`;
      params.push(`%${departman}%`);
      idx++;
    }
    if (proje_id) {
      sql += ` AND id IN (SELECT personel_id FROM proje_personelleri WHERE proje_id = $${idx} AND aktif = TRUE)`;
      params.push(proje_id);
    }

    const result = await query(sql, params);

    let toplamNet = 0;
    let toplamMaliyet = 0;

    for (const p of result.rows) {
      const net = parseFloat(p.maas) || 0;
      toplamNet += net;
      toplamMaliyet += net * 1.65; // Yaklaşık maliyet çarpanı
    }

    return {
      success: true,
      personel_sayisi: result.rows.length,
      toplam_net_maas: Math.round(toplamNet),
      tahmini_toplam_maliyet: Math.round(toplamMaliyet),
      ortalama_maliyet: Math.round(toplamMaliyet / result.rows.length),
    };
  },

  // ==========================================
  // İZİN İŞLEMLERİ
  // ==========================================
  async izin_talep_olustur({ personel_id, izin_turu, baslangic_tarihi, bitis_tarihi, aciklama }) {
    // İzin türü ID'sini bul
    const turResult = await query(`SELECT id FROM izin_turleri WHERE kod = $1`, [izin_turu]);
    if (turResult.rows.length === 0) {
      return { success: false, error: 'Geçersiz izin türü' };
    }

    const gunSayisi = Math.ceil((new Date(bitis_tarihi) - new Date(baslangic_tarihi)) / (1000 * 60 * 60 * 24)) + 1;

    const result = await query(
      `
      INSERT INTO izin_talepleri (personel_id, izin_turu_id, baslangic_tarihi, bitis_tarihi, gun_sayisi, aciklama)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `,
      [personel_id, turResult.rows[0].id, baslangic_tarihi, bitis_tarihi, gunSayisi, aciklama || '']
    );

    return {
      success: true,
      message: `${gunSayisi} günlük ${izin_turu} izin talebi oluşturuldu`,
      talep_id: result.rows[0].id,
    };
  },

  async izin_listele({ personel_id, durum }) {
    let sql = `
      SELECT it.*, p.ad, p.soyad, itur.ad as izin_turu_ad
      FROM izin_talepleri it
      JOIN personeller p ON p.id = it.personel_id
      JOIN izin_turleri itur ON itur.id = it.izin_turu_id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (personel_id) {
      sql += ` AND it.personel_id = $${idx}`;
      params.push(personel_id);
      idx++;
    }
    if (durum) {
      sql += ` AND it.durum = $${idx}`;
      params.push(durum);
    }

    sql += ` ORDER BY it.created_at DESC LIMIT 20`;

    const result = await query(sql, params);

    return {
      success: true,
      count: result.rows.length,
      talepler: result.rows.map((t) => ({
        id: t.id,
        personel: `${t.ad} ${t.soyad}`,
        izin_turu: t.izin_turu_ad,
        baslangic: t.baslangic_tarihi,
        bitis: t.bitis_tarihi,
        gun_sayisi: t.gun_sayisi,
        durum: t.durum,
      })),
    };
  },

  async izin_bakiye_sorgula({ personel_id }) {
    const personelResult = await query(`SELECT ad, soyad, ise_giris_tarihi FROM personeller WHERE id = $1`, [
      personel_id,
    ]);
    if (personelResult.rows.length === 0) {
      return { success: false, error: 'Personel bulunamadı' };
    }

    const p = personelResult.rows[0];
    const kidemGun = Math.floor((Date.now() - new Date(p.ise_giris_tarihi)) / (1000 * 60 * 60 * 24));
    const kidemYil = kidemGun / 365;

    // Yıllık izin hakkı
    let yillikHak = 14;
    if (kidemYil >= 15) yillikHak = 26;
    else if (kidemYil >= 5) yillikHak = 20;

    // Kullanılan izin
    const kullanilanResult = await query(
      `
      SELECT COALESCE(SUM(gun_sayisi), 0) as kullanilan
      FROM izin_talepleri it
      JOIN izin_turleri itur ON itur.id = it.izin_turu_id
      WHERE it.personel_id = $1 AND itur.kod = 'yillik' AND it.durum = 'onaylandi'
      AND EXTRACT(YEAR FROM it.baslangic_tarihi) = EXTRACT(YEAR FROM CURRENT_DATE)
    `,
      [personel_id]
    );

    const kullanilan = parseInt(kullanilanResult.rows[0].kullanilan, 10) || 0;

    return {
      success: true,
      personel: `${p.ad} ${p.soyad}`,
      kidem_yil: kidemYil.toFixed(1),
      yillik_izin: {
        hak: yillikHak,
        kullanilan: kullanilan,
        kalan: yillikHak - kullanilan,
      },
    };
  },

  async bugun_izinli_listele() {
    const result = await query(`
      SELECT p.ad, p.soyad, p.departman, it.baslangic_tarihi, it.bitis_tarihi, itur.ad as izin_turu
      FROM izin_talepleri it
      JOIN personeller p ON p.id = it.personel_id
      JOIN izin_turleri itur ON itur.id = it.izin_turu_id
      WHERE it.durum = 'onaylandi'
      AND CURRENT_DATE BETWEEN it.baslangic_tarihi AND it.bitis_tarihi
    `);

    return {
      success: true,
      count: result.rows.length,
      izinliler: result.rows.map((r) => ({
        personel: `${r.ad} ${r.soyad}`,
        departman: r.departman,
        izin_turu: r.izin_turu,
        donus_tarihi: r.bitis_tarihi,
      })),
    };
  },

  // ==========================================
  // KIDEM VE TAZMİNAT
  // ==========================================
  async kidem_hesapla({ personel_id, cikis_tarihi, cikis_nedeni = 'isten_cikarma' }) {
    const personelResult = await query(`SELECT * FROM personeller WHERE id = $1`, [personel_id]);
    if (personelResult.rows.length === 0) {
      return { success: false, error: 'Personel bulunamadı' };
    }

    const p = personelResult.rows[0];
    const iseGiris = new Date(p.ise_giris_tarihi);
    const cikis = cikis_tarihi ? new Date(cikis_tarihi) : new Date();

    const toplamGun = Math.floor((cikis - iseGiris) / (1000 * 60 * 60 * 24));
    const toplamYil = toplamGun / 365;

    const brutMaas = parseFloat(p.maas) * 1.4;
    const kidemTavani = 45000;
    const kidemMatrahi = Math.min(brutMaas, kidemTavani);

    // Kıdem tazminatı
    const kidemHakki = toplamYil >= 1 && cikis_nedeni !== 'istifa';
    const kidemTazminati = kidemHakki ? Math.round(kidemMatrahi * toplamYil) : 0;

    // İhbar süresi
    let ihbarGun = 14;
    if (toplamGun >= 1080) ihbarGun = 56;
    else if (toplamGun >= 540) ihbarGun = 42;
    else if (toplamGun >= 180) ihbarGun = 28;

    const ihbarHakki = cikis_nedeni !== 'istifa';
    const ihbarTazminati = ihbarHakki ? Math.round((brutMaas / 30) * ihbarGun) : 0;

    // İzin ücreti
    const yillikHak = toplamYil >= 15 ? 26 : toplamYil >= 5 ? 20 : 14;
    const izinUcreti = Math.round((brutMaas / 30) * yillikHak);

    return {
      success: true,
      personel: `${p.ad} ${p.soyad}`,
      calisma: {
        baslangic: p.ise_giris_tarihi,
        toplam_gun: toplamGun,
        toplam_yil: toplamYil.toFixed(1),
      },
      kidem_tazminati: {
        hakki_var: kidemHakki,
        tutar: kidemTazminati,
      },
      ihbar_tazminati: {
        hakki_var: ihbarHakki,
        sure_gun: ihbarGun,
        tutar: ihbarTazminati,
      },
      izin_ucreti: {
        kalan_gun: yillikHak,
        tutar: izinUcreti,
      },
      toplam_tazminat: kidemTazminati + ihbarTazminati + izinUcreti,
    };
  },

  // ==========================================
  // MEVZUAT BİLGİ
  // ==========================================
  async mevzuat_bilgi({ konu }) {
    const bilgiler = {
      sgk: {
        baslik: 'SGK Primleri (2026)',
        icerik: `
• İşçi SGK Primi: %14 (brüt maaş üzerinden)
• İşçi İşsizlik: %1
• İşveren SGK Primi: %15.5 (5510 teşvik: %15.5 düşülebilir)
• İşveren İşsizlik: %2
• SGK Tavan: ~200.000 TL (2026)
• Bildirge: Her ayın 26'sına kadar
• Ödeme: Her ayın sonuna kadar`,
      },
      vergi: {
        baslik: 'Gelir Vergisi Dilimleri (2026)',
        icerik: `
• 0 - 158.000 TL: %15
• 158.000 - 330.000 TL: %20
• 330.000 - 800.000 TL: %27
• 800.000 - 4.300.000 TL: %35
• 4.300.000+ TL: %40
• Damga Vergisi: %0.759 (brüt üzerinden)`,
      },
      izin: {
        baslik: 'Yıllık İzin Hakları',
        icerik: `
• 1-5 yıl arası: 14 gün
• 5-15 yıl arası: 20 gün
• 15 yıl üzeri: 26 gün
• 18 yaş altı: 20 gün (minimum)
• Evlilik İzni: 3 gün (ücretli)
• Doğum İzni (Anne): 16 hafta
• Doğum İzni (Baba): 5 gün
• Ölüm İzni: 3 gün (1. derece yakın)`,
      },
      kidem: {
        baslik: 'Kıdem Tazminatı',
        icerik: `
• Hak Kazanma: En az 1 yıl çalışma
• Hesaplama: Her tam yıl için 30 günlük brüt maaş
• Tavan (2026): ~45.000 TL
• İstifada: Hak yok (haklı nedenle istifa hariç)
• İşveren feshi: Tam hak
• Emeklilik: Tam hak`,
      },
      ihbar: {
        baslik: 'İhbar Süreleri',
        icerik: `
• 0-6 ay: 2 hafta (14 gün)
• 6-18 ay: 4 hafta (28 gün)
• 18-36 ay: 6 hafta (42 gün)
• 36+ ay: 8 hafta (56 gün)
• İhbar Tazminatı: Günlük brüt × süre`,
      },
      asgari_ucret: {
        baslik: 'Asgari Ücret (2026)',
        icerik: `
• Brüt: ~25.000 TL (tahmini)
• Net (bekar): ~20.000 TL
• Net (evli): ~21.000 TL
• AGİ dahil hesaplanır
• Her yıl Ocak'ta güncellenir`,
      },
    };

    const bilgi = bilgiler[konu.toLowerCase()];
    if (!bilgi) {
      return {
        success: false,
        error: `"${konu}" konusu bulunamadı. Geçerli konular: sgk, vergi, izin, kidem, ihbar, asgari_ucret`,
      };
    }

    return {
      success: true,
      ...bilgi,
    };
  },
};

export default { personelToolDefinitions, personelToolImplementations };
