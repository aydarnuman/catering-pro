import express from 'express';
import { pool, query } from '../database.js';

const router = express.Router();

// =====================================================
// SGK VE VERGİ ORANLARI (2025/2026)
// =====================================================
const SGK_ORANI = {
  isci: {
    sgk: 0.14,      // %14
    issizlik: 0.01, // %1
    toplam: 0.15    // %15
  },
  isveren: {
    sgk: 0.155,     // %15.5 (5 puan teşvikli, normalde %20.5)
    issizlik: 0.02, // %2
    toplam: 0.175   // %17.5
  }
};

const DAMGA_VERGISI_ORANI = 0.00759; // %0.759

// =====================================================
// YARDIMCI FONKSİYONLAR
// =====================================================

// Net maaştan brüt maaş hesapla (tersine hesaplama)
async function nettenBrutHesapla(netMaas, medeniDurum, esCalisiyorMu, cocukSayisi, kumulatifMatrah, yil) {
  // AGİ'yi hesapla
  const agi = await hesaplaAGI(medeniDurum, esCalisiyorMu, cocukSayisi, yil);
  
  // İteratif hesaplama - brüt'ü tahmin edip net'e yakınsama
  let brutTahmin = netMaas * 1.4; // İlk tahmin
  let iterasyon = 0;
  const maxIterasyon = 20;
  const tolerans = 1; // 1 TL tolerans
  
  while (iterasyon < maxIterasyon) {
    // Bu brüt ile net hesapla
    const sgkMatrahi = Math.min(brutTahmin, 199125);
    const sgkIsci = sgkMatrahi * SGK_ORANI.isci.sgk;
    const issizlikIsci = sgkMatrahi * SGK_ORANI.isci.issizlik;
    const toplamIsciSgk = sgkIsci + issizlikIsci;
    
    const vergiMatrahi = brutTahmin - toplamIsciSgk;
    const yeniKumulatif = kumulatifMatrah + vergiMatrahi;
    
    const gelirVergisi = await hesaplaGelirVergisiSync(vergiMatrahi, yeniKumulatif, yil);
    const damgaVergisi = brutTahmin * DAMGA_VERGISI_ORANI;
    
    const hesaplananNet = brutTahmin - toplamIsciSgk - gelirVergisi - damgaVergisi + agi;
    
    const fark = netMaas - hesaplananNet;
    
    if (Math.abs(fark) < tolerans) {
      break;
    }
    
    // Brüt'ü ayarla
    brutTahmin += fark * 1.3; // Farkın biraz fazlasını ekle (kesintiler için)
    iterasyon++;
  }
  
  return Math.round(brutTahmin * 100) / 100;
}

// Senkron gelir vergisi hesaplama (iterasyon için)
async function hesaplaGelirVergisiSync(vergiMatrahi, kumulatifMatrah, yil) {
  // Varsayılan dilimler (2026)
  const dilimler = [
    { baslangic: 0, bitis: 158000, oran: 0.15 },
    { baslangic: 158000, bitis: 330000, oran: 0.20 },
    { baslangic: 330000, bitis: 800000, oran: 0.27 },
    { baslangic: 800000, bitis: 4300000, oran: 0.35 },
    { baslangic: 4300000, bitis: Infinity, oran: 0.40 }
  ];
  
  const oncekiMatrah = kumulatifMatrah - vergiMatrahi;
  let vergi = 0;
  let kalanMatrah = vergiMatrahi;
  
  for (const dilim of dilimler) {
    if (kalanMatrah <= 0) break;
    
    const dilimBaslangic = dilim.baslangic;
    const dilimBitis = dilim.bitis;
    const oran = dilim.oran;
    
    if (oncekiMatrah >= dilimBitis) continue;
    
    const dilimdeKalanAlan = dilimBitis - Math.max(oncekiMatrah, dilimBaslangic);
    const buDilimdeMatrah = Math.min(kalanMatrah, dilimdeKalanAlan);
    
    if (buDilimdeMatrah > 0) {
      vergi += buDilimdeMatrah * oran;
      kalanMatrah -= buDilimdeMatrah;
    }
  }
  
  return Math.round(vergi * 100) / 100;
}

// Vergi dilimlerine göre gelir vergisi hesaplama
async function hesaplaGelirVergisi(vergiMatrahi, kumulatifMatrah, yil) {
  // Vergi dilimlerini al
  const dilimlerResult = await query(`
    SELECT baslangic, bitis, oran FROM vergi_dilimleri 
    WHERE yil = $1 ORDER BY baslangic
  `, [yil]);
  
  let dilimler = dilimlerResult.rows;
  
  // Dilimler yoksa varsayılan kullan (2026)
  if (dilimler.length === 0) {
    dilimler = [
      { baslangic: 0, bitis: 158000, oran: 0.15 },
      { baslangic: 158000, bitis: 330000, oran: 0.20 },
      { baslangic: 330000, bitis: 800000, oran: 0.27 },
      { baslangic: 800000, bitis: 4300000, oran: 0.35 },
      { baslangic: 4300000, bitis: null, oran: 0.40 }
    ];
  }
  
  // Önceki ayın kümülatif matrahı
  const oncekiMatrah = kumulatifMatrah - vergiMatrahi;
  
  let vergi = 0;
  let kalanMatrah = vergiMatrahi;
  
  for (const dilim of dilimler) {
    if (kalanMatrah <= 0) break;
    
    const dilimBaslangic = parseFloat(dilim.baslangic);
    const dilimBitis = dilim.bitis ? parseFloat(dilim.bitis) : Infinity;
    const oran = parseFloat(dilim.oran);
    
    // Bu dilimde ne kadar matrah var?
    if (oncekiMatrah >= dilimBitis) {
      // Bu dilimi tamamen geçmişiz
      continue;
    }
    
    // Bu dilimde hesaplanacak miktar
    const dilimdeKalanAlan = dilimBitis - Math.max(oncekiMatrah, dilimBaslangic);
    const buDilimdeMatrah = Math.min(kalanMatrah, dilimdeKalanAlan);
    
    if (buDilimdeMatrah > 0) {
      vergi += buDilimdeMatrah * oran;
      kalanMatrah -= buDilimdeMatrah;
    }
  }
  
  return Math.round(vergi * 100) / 100;
}

// AGİ hesaplama
async function hesaplaAGI(medeniDurum, esCalisiyorMu, cocukSayisi, yil) {
  // Asgari ücreti al
  const ay = new Date().getMonth() + 1;
  const donem = ay <= 6 ? 1 : 2;
  
  const asgariResult = await query(`
    SELECT brut_ucret FROM asgari_ucret WHERE yil = $1 AND donem = $2
  `, [yil, donem]);
  
  let asgariUcret = 26500; // Varsayılan 2026
  if (asgariResult.rows.length > 0) {
    asgariUcret = parseFloat(asgariResult.rows[0].brut_ucret);
  }
  
  // AGİ oranları
  let agiOrani = 0.50; // Bekar %50
  
  if (medeniDurum === 'evli') {
    if (esCalisiyorMu) {
      agiOrani = 0.50; // Evli eşi çalışan %50
    } else {
      agiOrani = 0.60; // Evli eşi çalışmayan %60
    }
  }
  
  // Çocuk eklentisi
  if (cocukSayisi >= 1) agiOrani += 0.075;  // 1. çocuk +%7.5
  if (cocukSayisi >= 2) agiOrani += 0.10;   // 2. çocuk +%10
  if (cocukSayisi >= 3) agiOrani += 0.05 * (cocukSayisi - 2);  // 3+ çocuk her biri +%5
  
  // AGİ = Asgari ücret x Oran x %15
  const agi = asgariUcret * agiOrani * 0.15;
  
  return Math.round(agi * 100) / 100;
}

// Engelli vergi indirimi
function hesaplaEngelliIndirimi(engelDerecesi) {
  // 2024 engelli indirimi tutarları (güncellenebilir)
  const indirimler = {
    1: 6900,  // 1. derece
    2: 4000,  // 2. derece
    3: 1700   // 3. derece
  };
  return indirimler[engelDerecesi] || 0;
}

// =====================================================
// NET'TEN BRÜT VE MALİYET HESAPLA (Önizleme için)
// =====================================================
router.post('/net-brut-hesapla', async (req, res) => {
  try {
    const { 
      net_maas, 
      medeni_durum = 'bekar', 
      es_calisiyormu = false, 
      cocuk_sayisi = 0,
      yemek_yardimi = 0,
      yol_yardimi = 0
    } = req.body;

    if (!net_maas || net_maas <= 0) {
      return res.status(400).json({ success: false, error: 'Net maaş zorunludur' });
    }

    const yil = new Date().getFullYear();
    
    // Net'ten brüt hesapla
    const brutMaas = await nettenBrutHesapla(
      net_maas,
      medeni_durum,
      es_calisiyormu,
      cocuk_sayisi,
      0, // İlk ay için kümülatif 0
      yil
    );

    // Brüt toplam
    const brutToplam = brutMaas + parseFloat(yemek_yardimi || 0) + parseFloat(yol_yardimi || 0);

    // SGK hesapla
    const sgkTavan = 199125;
    const sgkMatrahi = Math.min(brutToplam, sgkTavan);

    const sgkIsci = Math.round(sgkMatrahi * SGK_ORANI.isci.sgk * 100) / 100;
    const issizlikIsci = Math.round(sgkMatrahi * SGK_ORANI.isci.issizlik * 100) / 100;
    const toplamIsciSgk = sgkIsci + issizlikIsci;

    // Vergi hesapla
    const vergiMatrahi = brutToplam - toplamIsciSgk;
    const gelirVergisi = await hesaplaGelirVergisiSync(vergiMatrahi, vergiMatrahi, yil);
    const damgaVergisi = Math.round(brutToplam * DAMGA_VERGISI_ORANI * 100) / 100;

    // AGİ
    const agi = await hesaplaAGI(medeni_durum, es_calisiyormu, cocuk_sayisi, yil);

    // Net maaş doğrulama
    const hesaplananNet = Math.round((brutToplam - toplamIsciSgk - gelirVergisi - damgaVergisi + agi) * 100) / 100;

    // İşveren payı
    const sgkIsveren = Math.round(sgkMatrahi * SGK_ORANI.isveren.sgk * 100) / 100;
    const issizlikIsveren = Math.round(sgkMatrahi * SGK_ORANI.isveren.issizlik * 100) / 100;
    const toplamIsverenSgk = sgkIsveren + issizlikIsveren;

    // Toplam maliyet
    const toplamMaliyet = Math.round((brutToplam + toplamIsverenSgk) * 100) / 100;

    const data = {
      brut_maas: Math.round(brutMaas * 100) / 100,
      brut_toplam: Math.round(brutToplam * 100) / 100,
      sgk_isci: sgkIsci,
      issizlik_isci: issizlikIsci,
      toplam_isci_sgk: Math.round(toplamIsciSgk * 100) / 100,
      gelir_vergisi: gelirVergisi,
      damga_vergisi: damgaVergisi,
      agi_tutari: agi,
      net_maas: hesaplananNet,
      sgk_isveren: sgkIsveren,
      issizlik_isveren: issizlikIsveren,
      toplam_isveren_sgk: Math.round(toplamIsverenSgk * 100) / 100,
      toplam_maliyet: toplamMaliyet
    };
    res.json({ success: true, data });
  } catch (error) {
    console.error('Net-brüt hesaplama hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// BORDRO HESAPLA
// =====================================================
router.post('/hesapla', async (req, res) => {
  try {
    const {
      personel_id,
      yil,
      ay,
      brut_maas,
      fazla_mesai_saat = 0,
      fazla_mesai_carpan = 1.5,
      ikramiye = 0,
      prim = 0,
      yemek_yardimi = 0,
      yol_yardimi = 0,
      diger_kazanc = 0,
      calisma_gunu = 30
    } = req.body;

    if (!personel_id || !yil || !ay || !brut_maas) {
      return res.status(400).json({ success: false, error: 'Personel, yıl, ay ve brüt maaş zorunludur' });
    }

    // Personel bilgilerini al
    const personelResult = await query(`
      SELECT * FROM personeller WHERE id = $1
    `, [personel_id]);

    if (personelResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Personel bulunamadı' });
    }

    const personel = personelResult.rows[0];
    
    // Fazla mesai ücreti hesapla (saatlik ücret x çarpan x saat)
    const saatlikUcret = brut_maas / 225; // Aylık 225 saat
    const fazlaMesaiUcret = Math.round(saatlikUcret * fazla_mesai_carpan * fazla_mesai_saat * 100) / 100;

    // Brüt toplam
    const brutToplam = parseFloat(brut_maas) + fazlaMesaiUcret + 
                       parseFloat(ikramiye) + parseFloat(prim) + 
                       parseFloat(yemek_yardimi) + parseFloat(yol_yardimi) + 
                       parseFloat(diger_kazanc);

    // SGK matrahı (tavan kontrolü - 2026 tahmini: 199.125 TL)
    const sgkTavan = 199125;
    const sgkMatrahi = Math.min(brutToplam, sgkTavan);

    // İşçi SGK kesintileri
    const sgkIsci = Math.round(sgkMatrahi * SGK_ORANI.isci.sgk * 100) / 100;
    const issizlikIsci = Math.round(sgkMatrahi * SGK_ORANI.isci.issizlik * 100) / 100;
    const toplamIsciSgk = sgkIsci + issizlikIsci;

    // Vergi matrahı
    const vergiMatrahi = brutToplam - toplamIsciSgk;

    // Kümülatif matrah hesapla (önceki ayların toplamı)
    const kumulatifResult = await query(`
      SELECT COALESCE(SUM(vergi_matrahi), 0) as toplam
      FROM bordro_kayitlari
      WHERE personel_id = $1 AND yil = $2 AND ay < $3
    `, [personel_id, yil, ay]);
    
    const oncekiKumulatif = parseFloat(kumulatifResult.rows[0].toplam) || 0;
    const yeniKumulatif = oncekiKumulatif + vergiMatrahi;

    // Gelir vergisi
    const gelirVergisi = await hesaplaGelirVergisi(vergiMatrahi, yeniKumulatif, yil);

    // Damga vergisi
    const damgaVergisi = Math.round(brutToplam * DAMGA_VERGISI_ORANI * 100) / 100;

    // AGİ hesapla
    const agi = await hesaplaAGI(
      personel.medeni_durum || 'bekar',
      personel.es_calisiyormu || false,
      personel.cocuk_sayisi || 0,
      yil
    );

    // Net maaş
    const netMaas = Math.round((brutToplam - toplamIsciSgk - gelirVergisi - damgaVergisi + agi) * 100) / 100;

    // İşveren SGK kesintileri
    const sgkIsveren = Math.round(sgkMatrahi * SGK_ORANI.isveren.sgk * 100) / 100;
    const issizlikIsveren = Math.round(sgkMatrahi * SGK_ORANI.isveren.issizlik * 100) / 100;
    const toplamIsverenSgk = sgkIsveren + issizlikIsveren;

    // Toplam maliyet
    const toplamMaliyet = Math.round((brutToplam + toplamIsverenSgk) * 100) / 100;

    const bordro = {
      personel_id,
      personel_ad: `${personel.ad} ${personel.soyad}`,
      yil,
      ay,
      calisma_gunu,
      fazla_mesai_saat,
      
      // Kazançlar
      brut_maas: parseFloat(brut_maas),
      fazla_mesai_ucret: fazlaMesaiUcret,
      ikramiye: parseFloat(ikramiye),
      prim: parseFloat(prim),
      yemek_yardimi: parseFloat(yemek_yardimi),
      yol_yardimi: parseFloat(yol_yardimi),
      diger_kazanc: parseFloat(diger_kazanc),
      brut_toplam: Math.round(brutToplam * 100) / 100,
      
      // SGK
      sgk_matrahi: sgkMatrahi,
      sgk_isci,
      issizlik_isci: issizlikIsci,
      toplam_isci_sgk: Math.round(toplamIsciSgk * 100) / 100,
      
      // Vergiler
      vergi_matrahi: Math.round(vergiMatrahi * 100) / 100,
      kumulatif_matrah: Math.round(yeniKumulatif * 100) / 100,
      gelir_vergisi: gelirVergisi,
      damga_vergisi: damgaVergisi,
      
      // AGİ
      agi_tutari: agi,
      
      // Net
      net_maas: netMaas,
      
      // İşveren
      sgk_isveren: sgkIsveren,
      issizlik_isveren: issizlikIsveren,
      toplam_isveren_sgk: Math.round(toplamIsverenSgk * 100) / 100,
      toplam_maliyet: toplamMaliyet
    };

    res.json({ success: true, data: bordro });
  } catch (error) {
    console.error('Bordro hesaplama hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// BORDRO KAYDET
// =====================================================
router.post('/kaydet', async (req, res) => {
  try {
    const bordro = req.body;

    const result = await query(`
      INSERT INTO bordro_kayitlari (
        personel_id, yil, ay, calisma_gunu, fazla_mesai_saat,
        brut_maas, fazla_mesai_ucret, ikramiye, prim, yemek_yardimi, yol_yardimi, diger_kazanc, brut_toplam,
        sgk_matrahi, sgk_isci, issizlik_isci, toplam_isci_sgk,
        vergi_matrahi, kumulatif_matrah, gelir_vergisi, damga_vergisi,
        agi_tutari, net_maas,
        sgk_isveren, issizlik_isveren, toplam_isveren_sgk, toplam_maliyet,
        odeme_durumu
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17,
        $18, $19, $20, $21,
        $22, $23,
        $24, $25, $26, $27,
        'beklemede'
      )
      ON CONFLICT (personel_id, yil, ay) DO UPDATE SET
        calisma_gunu = EXCLUDED.calisma_gunu,
        fazla_mesai_saat = EXCLUDED.fazla_mesai_saat,
        brut_maas = EXCLUDED.brut_maas,
        fazla_mesai_ucret = EXCLUDED.fazla_mesai_ucret,
        ikramiye = EXCLUDED.ikramiye,
        prim = EXCLUDED.prim,
        yemek_yardimi = EXCLUDED.yemek_yardimi,
        yol_yardimi = EXCLUDED.yol_yardimi,
        diger_kazanc = EXCLUDED.diger_kazanc,
        brut_toplam = EXCLUDED.brut_toplam,
        sgk_matrahi = EXCLUDED.sgk_matrahi,
        sgk_isci = EXCLUDED.sgk_isci,
        issizlik_isci = EXCLUDED.issizlik_isci,
        toplam_isci_sgk = EXCLUDED.toplam_isci_sgk,
        vergi_matrahi = EXCLUDED.vergi_matrahi,
        kumulatif_matrah = EXCLUDED.kumulatif_matrah,
        gelir_vergisi = EXCLUDED.gelir_vergisi,
        damga_vergisi = EXCLUDED.damga_vergisi,
        agi_tutari = EXCLUDED.agi_tutari,
        net_maas = EXCLUDED.net_maas,
        sgk_isveren = EXCLUDED.sgk_isveren,
        issizlik_isveren = EXCLUDED.issizlik_isveren,
        toplam_isveren_sgk = EXCLUDED.toplam_isveren_sgk,
        toplam_maliyet = EXCLUDED.toplam_maliyet,
        updated_at = NOW()
      RETURNING *
    `, [
      bordro.personel_id, bordro.yil, bordro.ay, bordro.calisma_gunu, bordro.fazla_mesai_saat,
      bordro.brut_maas, bordro.fazla_mesai_ucret, bordro.ikramiye, bordro.prim, 
      bordro.yemek_yardimi, bordro.yol_yardimi, bordro.diger_kazanc, bordro.brut_toplam,
      bordro.sgk_matrahi, bordro.sgk_isci, bordro.issizlik_isci, bordro.toplam_isci_sgk,
      bordro.vergi_matrahi, bordro.kumulatif_matrah, bordro.gelir_vergisi, bordro.damga_vergisi,
      bordro.agi_tutari, bordro.net_maas,
      bordro.sgk_isveren, bordro.issizlik_isveren, bordro.toplam_isveren_sgk, bordro.toplam_maliyet
    ]);

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Bordro kaydetme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// TOPLU BORDRO HESAPLA VE KAYDET
// =====================================================
router.post('/toplu-hesapla', async (req, res) => {
  try {
    const { yil, ay, proje_id } = req.body;

    if (!yil || !ay) {
      return res.status(400).json({ success: false, error: 'Yıl ve ay zorunludur' });
    }

    // Aktif personelleri al
    let sql = `
      SELECT p.* FROM personeller p
      WHERE p.durum = 'aktif' OR (p.durum IS NULL AND p.isten_cikis_tarihi IS NULL)
    `;
    const params = [];

    if (proje_id) {
      sql += ` AND p.id IN (SELECT personel_id FROM proje_personelleri WHERE proje_id = $1 AND aktif = TRUE)`;
      params.push(proje_id);
    }

    const personellerResult = await query(sql, params);
    const sonuclar = [];
    const hatalar = [];

    for (const personel of personellerResult.rows) {
      try {
        // PDF/Excel'den import edilmiş kayıt var mı kontrol et - varsa atla
        const existingImport = await query(`
          SELECT id, kaynak FROM bordro_kayitlari 
          WHERE personel_id = $1 AND yil = $2 AND ay = $3 AND kaynak = 'excel_import'
        `, [personel.id, yil, ay]);
        
        if (existingImport.rows.length > 0) {
          console.log(`⏭️ ${personel.ad} ${personel.soyad} için PDF import kaydı var, atlanıyor`);
          continue; // PDF'den import edilmiş, üzerine yazma
        }
        
        // NET MAAŞ - personelin eline geçecek tutar
        const hedefNetMaas = personel.maas || 0;
        if (hedefNetMaas === 0) {
          hatalar.push({ personel_id: personel.id, ad: `${personel.ad} ${personel.soyad}`, hata: 'Maaş bilgisi yok' });
          continue;
        }

        // Kümülatif matrah (önceki aylar)
        const kumulatifResult = await query(`
          SELECT COALESCE(SUM(vergi_matrahi), 0) as toplam
          FROM bordro_kayitlari
          WHERE personel_id = $1 AND yil = $2 AND ay < $3
        `, [personel.id, yil, ay]);
        const oncekiKumulatif = parseFloat(kumulatifResult.rows[0].toplam) || 0;

        // NET'TEN BRÜT HESAPLA
        const brutMaas = await nettenBrutHesapla(
          hedefNetMaas,
          personel.medeni_durum || 'bekar',
          personel.es_calisiyormu || false,
          personel.cocuk_sayisi || 0,
          oncekiKumulatif,
          yil
        );

        // Şimdi brüt üzerinden tam hesaplama yap
        const yemekYardimi = parseFloat(personel.yemek_yardimi) || 0;
        const yolYardimi = parseFloat(personel.yol_yardimi) || 0;

        const brutToplam = brutMaas + yemekYardimi + yolYardimi;

        const sgkTavan = 199125;
        const sgkMatrahi = Math.min(brutToplam, sgkTavan);

        const sgkIsci = Math.round(sgkMatrahi * SGK_ORANI.isci.sgk * 100) / 100;
        const issizlikIsci = Math.round(sgkMatrahi * SGK_ORANI.isci.issizlik * 100) / 100;
        const toplamIsciSgk = sgkIsci + issizlikIsci;

        const vergiMatrahi = brutToplam - toplamIsciSgk;
        const yeniKumulatif = oncekiKumulatif + vergiMatrahi;

        const gelirVergisi = await hesaplaGelirVergisi(vergiMatrahi, yeniKumulatif, yil);
        const damgaVergisi = Math.round(brutToplam * DAMGA_VERGISI_ORANI * 100) / 100;
        const agi = await hesaplaAGI(personel.medeni_durum || 'bekar', personel.es_calisiyormu || false, personel.cocuk_sayisi || 0, yil);

        // Hesaplanan net maaş (hedef'e çok yakın olmalı)
        const netMaas = Math.round((brutToplam - toplamIsciSgk - gelirVergisi - damgaVergisi + agi) * 100) / 100;

        const sgkIsveren = Math.round(sgkMatrahi * SGK_ORANI.isveren.sgk * 100) / 100;
        const issizlikIsveren = Math.round(sgkMatrahi * SGK_ORANI.isveren.issizlik * 100) / 100;
        const toplamIsverenSgk = sgkIsveren + issizlikIsveren;
        const toplamMaliyet = Math.round((brutToplam + toplamIsverenSgk) * 100) / 100;

        // Kaydet
        const insertResult = await query(`
          INSERT INTO bordro_kayitlari (
            personel_id, yil, ay, calisma_gunu, fazla_mesai_saat,
            brut_maas, fazla_mesai_ucret, ikramiye, prim, yemek_yardimi, yol_yardimi, diger_kazanc, brut_toplam,
            sgk_matrahi, sgk_isci, issizlik_isci, toplam_isci_sgk,
            vergi_matrahi, kumulatif_matrah, gelir_vergisi, damga_vergisi,
            agi_tutari, net_maas,
            sgk_isveren, issizlik_isveren, toplam_isveren_sgk, toplam_maliyet,
            kaynak
          ) VALUES ($1,$2,$3,30,0,$4,0,0,0,$5,$6,0,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,'hesaplama')
          ON CONFLICT (personel_id, yil, ay) DO UPDATE SET
            brut_maas = EXCLUDED.brut_maas, brut_toplam = EXCLUDED.brut_toplam,
            sgk_matrahi = EXCLUDED.sgk_matrahi, sgk_isci = EXCLUDED.sgk_isci, 
            issizlik_isci = EXCLUDED.issizlik_isci, toplam_isci_sgk = EXCLUDED.toplam_isci_sgk,
            vergi_matrahi = EXCLUDED.vergi_matrahi, kumulatif_matrah = EXCLUDED.kumulatif_matrah,
            gelir_vergisi = EXCLUDED.gelir_vergisi, damga_vergisi = EXCLUDED.damga_vergisi,
            agi_tutari = EXCLUDED.agi_tutari, net_maas = EXCLUDED.net_maas,
            sgk_isveren = EXCLUDED.sgk_isveren, issizlik_isveren = EXCLUDED.issizlik_isveren,
            toplam_isveren_sgk = EXCLUDED.toplam_isveren_sgk, toplam_maliyet = EXCLUDED.toplam_maliyet,
            kaynak = 'hesaplama',
            updated_at = NOW()
          RETURNING *
        `, [
          personel.id, yil, ay, brutMaas, yemekYardimi, yolYardimi, brutToplam,
          sgkMatrahi, sgkIsci, issizlikIsci, toplamIsciSgk,
          vergiMatrahi, yeniKumulatif, gelirVergisi, damgaVergisi,
          agi, netMaas, sgkIsveren, issizlikIsveren, toplamIsverenSgk, toplamMaliyet
        ]);

        sonuclar.push({
          ...insertResult.rows[0],
          personel_ad: `${personel.ad} ${personel.soyad}`
        });
      } catch (err) {
        hatalar.push({ personel_id: personel.id, ad: `${personel.ad} ${personel.soyad}`, hata: err.message });
      }
    }

    res.json({ 
      success: true,
      data: { basarili: sonuclar.length, hatali: hatalar.length, sonuclar, hatalar }
    });
  } catch (error) {
    console.error('Toplu bordro hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// BORDRO LİSTELE (AY BAZLI)
// =====================================================
router.get('/', async (req, res) => {
  try {
    const { yil, ay, odeme_durumu } = req.query;

    let sql = `
      SELECT b.*, b.kaynak, b.kaynak_dosya, p.ad, p.soyad, p.tc_kimlik, p.departman, p.pozisyon
      FROM bordro_kayitlari b
      JOIN personeller p ON p.id = b.personel_id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (yil) {
      sql += ` AND b.yil = $${paramIndex}`;
      params.push(yil);
      paramIndex++;
    }
    if (ay) {
      sql += ` AND b.ay = $${paramIndex}`;
      params.push(ay);
      paramIndex++;
    }
    if (odeme_durumu) {
      sql += ` AND b.odeme_durumu = $${paramIndex}`;
      params.push(odeme_durumu);
      paramIndex++;
    }

    sql += ` ORDER BY b.yil DESC, b.ay DESC, p.ad, p.soyad`;

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Bordro listeleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// BORDRO ÖZET
// =====================================================
router.get('/ozet/:yil/:ay', async (req, res) => {
  try {
    const { yil, ay } = req.params;

    const result = await query(`
      SELECT 
        COUNT(*) as personel_sayisi,
        COALESCE(SUM(brut_toplam), 0) as toplam_brut,
        COALESCE(SUM(net_maas), 0) as toplam_net,
        COALESCE(SUM(toplam_isci_sgk), 0) as toplam_sgk_isci,
        COALESCE(SUM(toplam_isveren_sgk), 0) as toplam_sgk_isveren,
        COALESCE(SUM(gelir_vergisi), 0) as toplam_gelir_vergisi,
        COALESCE(SUM(damga_vergisi), 0) as toplam_damga_vergisi,
        COALESCE(SUM(agi_tutari), 0) as toplam_agi,
        COALESCE(SUM(toplam_maliyet), 0) as toplam_maliyet,
        COUNT(*) FILTER (WHERE odeme_durumu = 'odendi') as odenen,
        COUNT(*) FILTER (WHERE odeme_durumu = 'beklemede') as bekleyen
      FROM bordro_kayitlari
      WHERE yil = $1 AND ay = $2
    `, [yil, ay]);

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Bordro özet hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// ÖDEME DURUMU GÜNCELLE
// =====================================================
router.patch('/:id/odeme', async (req, res) => {
  try {
    const { id } = req.params;
    const { odeme_durumu, odeme_tarihi, odeme_yontemi } = req.body;

    const result = await query(`
      UPDATE bordro_kayitlari SET
        odeme_durumu = $2,
        odeme_tarihi = $3,
        odeme_yontemi = $4,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id, odeme_durumu, odeme_tarihi || new Date(), odeme_yontemi]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Bordro kaydı bulunamadı' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Ödeme güncelleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// TOPLU ÖDEME
// =====================================================
router.post('/toplu-odeme', async (req, res) => {
  try {
    const { bordro_ids, odeme_yontemi } = req.body;

    if (!bordro_ids || bordro_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'En az bir bordro seçmelisiniz' });
    }

    const result = await query(`
      UPDATE bordro_kayitlari SET
        odeme_durumu = 'odendi',
        odeme_tarihi = CURRENT_DATE,
        odeme_yontemi = $2,
        updated_at = NOW()
      WHERE id = ANY($1)
      RETURNING *
    `, [bordro_ids, odeme_yontemi || 'banka']);

    res.json({ 
      success: true,
      data: { basarili: result.rows.length, kayitlar: result.rows }
    });
  } catch (error) {
    console.error('Toplu ödeme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// DÖNEM BORDRO SİL
// =====================================================
router.delete('/donem-sil', async (req, res) => {
  try {
    const { yil, ay, proje_id } = req.body;

    if (!yil || !ay) {
      return res.status(400).json({ success: false, error: 'Yıl ve ay bilgisi gerekli' });
    }

    let sql = `DELETE FROM bordro_kayitlari WHERE yil = $1 AND ay = $2`;
    const params = [yil, ay];

    // Proje filtresi: 
    // - proje_id varsa o projeyi sil
    // - proje_id yoksa veya 0 ise TÜM kayıtları sil (proje_id NULL olanlar dahil)
    if (proje_id && proje_id !== 0 && proje_id !== '0') {
      sql += ` AND proje_id = $3`;
      params.push(proje_id);
    }
    // Proje seçilmemişse tüm kayıtları sil (proje_id NULL olanlar dahil)

    sql += ` RETURNING id`;

    console.log(`🗑️ Silme sorgusu: ${sql}, params: ${JSON.stringify(params)}`);

    const result = await query(sql, params);

    console.log(`🗑️ ${result.rows.length} bordro kaydı silindi (${ay}/${yil}${proje_id ? `, Proje: ${proje_id}` : ', Tüm projeler'})`);

    res.json({ 
      success: true,
      data: { deleted: result.rows.length, message: `${result.rows.length} bordro kaydı silindi` }
    });
  } catch (error) {
    console.error('Dönem silme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// VERGİ DİLİMLERİ
// =====================================================
router.get('/vergi-dilimleri/:yil', async (req, res) => {
  try {
    const { yil } = req.params;
    const result = await query(`
      SELECT * FROM vergi_dilimleri WHERE yil = $1 ORDER BY baslangic
    `, [yil]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Vergi dilimleri hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// ASGARİ ÜCRET
// =====================================================
router.get('/asgari-ucret/:yil', async (req, res) => {
  try {
    const { yil } = req.params;
    const result = await query(`
      SELECT * FROM asgari_ucret WHERE yil = $1 ORDER BY donem
    `, [yil]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Asgari ücret hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

