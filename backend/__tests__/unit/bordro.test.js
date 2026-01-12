/**
 * Bordro Hesaplama Testleri
 * Kritik: Maaş hesaplamaları doğru olmalı
 */

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
    sgk: 0.155,     // %15.5 (5 puan teşvikli)
    issizlik: 0.02, // %2
    toplam: 0.175   // %17.5
  }
};

const DAMGA_VERGISI_ORANI = 0.00759; // %0.759

// 2026 Asgari Ücret
const ASGARI_UCRET_2026 = 26005.50;
const SGK_TAVAN_2026 = 195041.25; // 7.5 x asgari ücret

// 2026 Vergi Dilimleri
const VERGI_DILIMLERI_2026 = [
  { baslangic: 0, bitis: 158000, oran: 0.15 },
  { baslangic: 158000, bitis: 330000, oran: 0.20 },
  { baslangic: 330000, bitis: 800000, oran: 0.27 },
  { baslangic: 800000, bitis: 4300000, oran: 0.35 },
  { baslangic: 4300000, bitis: Infinity, oran: 0.40 }
];

// 2026 AGİ Oranları
const AGI_ORANLARI_2026 = {
  bekar: 0.50,
  evli_es_calisiyor: 0.50,
  evli_es_calismiyor: 0.60,
  cocuk_1_2: 0.075,
  cocuk_3_plus: 0.10
};

// =====================================================
// YARDIMCI HESAPLAMA FONKSİYONLARI
// =====================================================

/**
 * SGK İşçi Kesintisi Hesapla
 */
function hesaplaSGKIsci(brutMaas) {
  const sgkMatrahi = Math.min(brutMaas, SGK_TAVAN_2026);
  const sgkKesinti = sgkMatrahi * SGK_ORANI.isci.sgk;
  const issizlikKesinti = sgkMatrahi * SGK_ORANI.isci.issizlik;
  return {
    sgkMatrahi,
    sgkKesinti: Math.round(sgkKesinti * 100) / 100,
    issizlikKesinti: Math.round(issizlikKesinti * 100) / 100,
    toplamSGK: Math.round((sgkKesinti + issizlikKesinti) * 100) / 100
  };
}

/**
 * SGK İşveren Kesintisi Hesapla
 */
function hesaplaSGKIsveren(brutMaas) {
  const sgkMatrahi = Math.min(brutMaas, SGK_TAVAN_2026);
  const sgkKesinti = sgkMatrahi * SGK_ORANI.isveren.sgk;
  const issizlikKesinti = sgkMatrahi * SGK_ORANI.isveren.issizlik;
  return {
    sgkMatrahi,
    sgkKesinti: Math.round(sgkKesinti * 100) / 100,
    issizlikKesinti: Math.round(issizlikKesinti * 100) / 100,
    toplamSGK: Math.round((sgkKesinti + issizlikKesinti) * 100) / 100
  };
}

/**
 * Damga Vergisi Hesapla
 */
function hesaplaDamgaVergisi(brutMaas) {
  return Math.round(brutMaas * DAMGA_VERGISI_ORANI * 100) / 100;
}

/**
 * Gelir Vergisi Hesapla (Kümülatif Matrah ile)
 */
function hesaplaGelirVergisi(vergiMatrahi, oncekiKumulatifMatrah = 0) {
  const kumulatifMatrah = oncekiKumulatifMatrah + vergiMatrahi;
  let vergi = 0;
  let kalanMatrah = vergiMatrahi;
  
  for (const dilim of VERGI_DILIMLERI_2026) {
    if (kalanMatrah <= 0) break;
    
    if (oncekiKumulatifMatrah >= dilim.bitis) continue;
    
    const dilimdeKalanAlan = dilim.bitis - Math.max(oncekiKumulatifMatrah, dilim.baslangic);
    const buDilimdeMatrah = Math.min(kalanMatrah, dilimdeKalanAlan);
    
    if (buDilimdeMatrah > 0) {
      vergi += buDilimdeMatrah * dilim.oran;
      kalanMatrah -= buDilimdeMatrah;
    }
  }
  
  return Math.round(vergi * 100) / 100;
}

/**
 * AGİ Hesapla
 */
function hesaplaAGI(medeniDurum, esCalisiyorMu, cocukSayisi) {
  const asgariUcretVergiMatrahi = ASGARI_UCRET_2026 * 0.85; // %15 SGK düşülmüş
  
  let agiOrani = 0;
  
  if (medeniDurum === 'bekar') {
    agiOrani = AGI_ORANLARI_2026.bekar;
  } else if (medeniDurum === 'evli') {
    agiOrani = esCalisiyorMu ? AGI_ORANLARI_2026.evli_es_calisiyor : AGI_ORANLARI_2026.evli_es_calismiyor;
  }
  
  // Çocuk ilavesi
  if (cocukSayisi >= 1 && cocukSayisi <= 2) {
    agiOrani += cocukSayisi * AGI_ORANLARI_2026.cocuk_1_2;
  } else if (cocukSayisi > 2) {
    agiOrani += 2 * AGI_ORANLARI_2026.cocuk_1_2;
    agiOrani += (cocukSayisi - 2) * AGI_ORANLARI_2026.cocuk_3_plus;
  }
  
  const agi = asgariUcretVergiMatrahi * agiOrani * 0.15; // %15 vergi indirimi
  return Math.round(agi * 100) / 100;
}

/**
 * Net Maaş Hesapla
 */
function hesaplaNetMaas(brutMaas, medeniDurum = 'bekar', esCalisiyorMu = false, cocukSayisi = 0, oncekiKumulatifMatrah = 0) {
  const sgk = hesaplaSGKIsci(brutMaas);
  const vergiMatrahi = brutMaas - sgk.toplamSGK;
  const gelirVergisi = hesaplaGelirVergisi(vergiMatrahi, oncekiKumulatifMatrah);
  const damgaVergisi = hesaplaDamgaVergisi(brutMaas);
  const agi = hesaplaAGI(medeniDurum, esCalisiyorMu, cocukSayisi);
  
  const netMaas = brutMaas - sgk.toplamSGK - gelirVergisi - damgaVergisi + agi;
  
  return {
    brutMaas,
    sgkKesinti: sgk.toplamSGK,
    vergiMatrahi,
    gelirVergisi,
    damgaVergisi,
    agi,
    netMaas: Math.round(netMaas * 100) / 100
  };
}

// =====================================================
// TESTLER
// =====================================================

describe('Bordro Hesaplama Testleri', () => {
  
  describe('SGK Kesinti Hesaplamaları', () => {
    
    test('Asgari ücret için SGK işçi kesintisi doğru hesaplanmalı', () => {
      const result = hesaplaSGKIsci(ASGARI_UCRET_2026);
      
      expect(result.sgkMatrahi).toBe(ASGARI_UCRET_2026);
      expect(result.sgkKesinti).toBe(Math.round(ASGARI_UCRET_2026 * 0.14 * 100) / 100);
      expect(result.issizlikKesinti).toBe(Math.round(ASGARI_UCRET_2026 * 0.01 * 100) / 100);
      expect(result.toplamSGK).toBe(Math.round(ASGARI_UCRET_2026 * 0.15 * 100) / 100);
    });
    
    test('Tavan üstü maaş için SGK matrahı tavan ile sınırlanmalı', () => {
      const yuksekMaas = 250000;
      const result = hesaplaSGKIsci(yuksekMaas);
      
      expect(result.sgkMatrahi).toBe(SGK_TAVAN_2026);
      expect(result.sgkMatrahi).toBeLessThan(yuksekMaas);
    });
    
    test('SGK işçi kesinti oranı %15 olmalı', () => {
      const brutMaas = 50000;
      const result = hesaplaSGKIsci(brutMaas);
      
      const beklenenToplam = brutMaas * 0.15;
      expect(result.toplamSGK).toBeCloseTo(beklenenToplam, 2);
    });
    
    test('SGK işveren kesintisi doğru hesaplanmalı', () => {
      const brutMaas = 50000;
      const result = hesaplaSGKIsveren(brutMaas);
      
      // %15.5 SGK + %2 işsizlik = %17.5
      expect(result.toplamSGK).toBeCloseTo(brutMaas * 0.175, 2);
    });
    
  });
  
  describe('Damga Vergisi Hesaplamaları', () => {
    
    test('Damga vergisi oranı %0.759 olmalı', () => {
      const brutMaas = 50000;
      const damgaVergisi = hesaplaDamgaVergisi(brutMaas);
      
      expect(damgaVergisi).toBeCloseTo(brutMaas * 0.00759, 2);
    });
    
    test('Asgari ücret için damga vergisi', () => {
      const damgaVergisi = hesaplaDamgaVergisi(ASGARI_UCRET_2026);
      
      expect(damgaVergisi).toBeGreaterThan(0);
      expect(damgaVergisi).toBeLessThan(ASGARI_UCRET_2026 * 0.01); // %1'den az
    });
    
  });
  
  describe('Gelir Vergisi Hesaplamaları', () => {
    
    test('İlk dilimde (%15) vergi doğru hesaplanmalı', () => {
      const vergiMatrahi = 10000;
      const gelirVergisi = hesaplaGelirVergisi(vergiMatrahi, 0);
      
      expect(gelirVergisi).toBe(10000 * 0.15);
    });
    
    test('Dilim geçişinde vergi doğru hesaplanmalı', () => {
      // 158000 sınırını geçen matrah
      const vergiMatrahi = 20000;
      const oncekiKumulatif = 150000;
      const gelirVergisi = hesaplaGelirVergisi(vergiMatrahi, oncekiKumulatif);
      
      // 8000 TL %15, 12000 TL %20
      const beklenen = (8000 * 0.15) + (12000 * 0.20);
      expect(gelirVergisi).toBeCloseTo(beklenen, 2);
    });
    
    test('Yıl sonu yüksek kümülatif matrahta vergi oranı artmalı', () => {
      const vergiMatrahi = 30000;
      
      const vergiOcak = hesaplaGelirVergisi(vergiMatrahi, 0);
      const vergiAralik = hesaplaGelirVergisi(vergiMatrahi, 300000);
      
      // Aralık'ta daha yüksek dilimde olmalı
      expect(vergiAralik).toBeGreaterThan(vergiOcak);
    });
    
  });
  
  describe('AGİ Hesaplamaları', () => {
    
    test('Bekar için AGİ doğru hesaplanmalı', () => {
      const agi = hesaplaAGI('bekar', false, 0);
      
      expect(agi).toBeGreaterThan(0);
      expect(agi).toBeLessThan(ASGARI_UCRET_2026 * 0.1); // Makul bir aralıkta
    });
    
    test('Evli eş çalışmıyor için AGİ daha yüksek olmalı', () => {
      const agiBekar = hesaplaAGI('bekar', false, 0);
      const agiEvli = hesaplaAGI('evli', false, 0);
      
      expect(agiEvli).toBeGreaterThan(agiBekar);
    });
    
    test('Çocuk sayısı artınca AGİ artmalı', () => {
      const agi0Cocuk = hesaplaAGI('evli', false, 0);
      const agi1Cocuk = hesaplaAGI('evli', false, 1);
      const agi3Cocuk = hesaplaAGI('evli', false, 3);
      
      expect(agi1Cocuk).toBeGreaterThan(agi0Cocuk);
      expect(agi3Cocuk).toBeGreaterThan(agi1Cocuk);
    });
    
  });
  
  describe('Net Maaş Hesaplamaları', () => {
    
    test('Net maaş brüt maaştan düşük olmalı (AGİ dahil)', () => {
      const result = hesaplaNetMaas(50000, 'bekar', false, 0);
      
      expect(result.netMaas).toBeLessThan(result.brutMaas);
    });
    
    test('Asgari ücret için net maaş hesaplaması', () => {
      const result = hesaplaNetMaas(ASGARI_UCRET_2026, 'bekar', false, 0);
      
      expect(result.brutMaas).toBe(ASGARI_UCRET_2026);
      expect(result.sgkKesinti).toBeGreaterThan(0);
      expect(result.gelirVergisi).toBeGreaterThan(0);
      expect(result.damgaVergisi).toBeGreaterThan(0);
      expect(result.agi).toBeGreaterThan(0);
      expect(result.netMaas).toBeGreaterThan(ASGARI_UCRET_2026 * 0.7); // En az %70'i net
    });
    
    test('Tüm kesintiler pozitif olmalı', () => {
      const result = hesaplaNetMaas(75000, 'evli', false, 2);
      
      expect(result.sgkKesinti).toBeGreaterThan(0);
      expect(result.gelirVergisi).toBeGreaterThan(0);
      expect(result.damgaVergisi).toBeGreaterThan(0);
      expect(result.agi).toBeGreaterThan(0);
    });
    
    test('Kümülatif matrah ile yıl sonu net maaş düşmeli', () => {
      const ocakResult = hesaplaNetMaas(75000, 'bekar', false, 0, 0);
      const aralikResult = hesaplaNetMaas(75000, 'bekar', false, 0, 800000);
      
      // Aralık'ta daha yüksek vergi dilimi = daha düşük net
      expect(aralikResult.netMaas).toBeLessThan(ocakResult.netMaas);
    });
    
  });
  
  describe('Edge Cases', () => {
    
    test('Sıfır maaş için hesaplama hata vermemeli', () => {
      expect(() => hesaplaNetMaas(0)).not.toThrow();
      const result = hesaplaNetMaas(0);
      expect(result.netMaas).toBe(result.agi); // Sadece AGİ kalır
    });
    
    test('Çok yüksek maaş için SGK tavanı uygulanmalı', () => {
      const result = hesaplaNetMaas(500000, 'bekar', false, 0);
      
      // SGK kesintisi tavan ile sınırlı olmalı
      expect(result.sgkKesinti).toBe(Math.round(SGK_TAVAN_2026 * 0.15 * 100) / 100);
    });
    
    test('Negatif çocuk sayısı 0 olarak değerlendirilmeli', () => {
      const agiNormal = hesaplaAGI('evli', false, 0);
      const agiNegatif = hesaplaAGI('evli', false, -1);
      
      // Negatif çocuk sayısı mantıklı değil, 0 gibi davranmalı
      expect(agiNegatif).toBeLessThanOrEqual(agiNormal);
    });
    
  });
  
});

describe('Hesaplama Tutarlılığı', () => {
  
  test('Net + Kesintiler = Brüt + AGİ formülü doğrulanmalı', () => {
    const brutMaas = 60000;
    const result = hesaplaNetMaas(brutMaas, 'evli', true, 1);
    
    const toplamKesinti = result.sgkKesinti + result.gelirVergisi + result.damgaVergisi;
    const hesaplananBrut = result.netMaas + toplamKesinti - result.agi;
    
    expect(hesaplananBrut).toBeCloseTo(brutMaas, 0);
  });
  
  test('Aynı parametrelerle tekrarlanan hesaplama aynı sonucu vermeli', () => {
    const params = [50000, 'evli', false, 2, 100000];
    
    const result1 = hesaplaNetMaas(...params);
    const result2 = hesaplaNetMaas(...params);
    
    expect(result1.netMaas).toBe(result2.netMaas);
    expect(result1.gelirVergisi).toBe(result2.gelirVergisi);
  });
  
});
