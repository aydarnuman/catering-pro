/**
 * Şartname bazlı reçete maliyet/gramaj önizleme hesaplaması
 * Veriyi değiştirmez, sadece hesaplar ve döner.
 *
 * Eşleşme stratejisi (3 katmanlı):
 * 1. Sözlük eşleşme: malzeme_tip_eslesmeleri tablosundaki anahtar kelimelerle eşleşir
 * 2. Doğrudan isim eşleşme: malzeme adı, kuralın malzeme_tipi'ni içeriyorsa (veya tersi)
 * 3. Fallback alt tip: Reçetenin kendi alt tipi için kural yoksa, şartnamedeki TÜM alt tiplere bakılır
 */
import { query } from '../database.js';
import { donusumCarpaniAl } from '../utils/birim-donusum.js';

/**
 * Sözlük tabanlı eşleşme — TÜM eşleşmeleri spesifikliğe göre sıralı döndürür.
 * "Domates salçası" hem "domates" (kısa) hem "domates salçası" (uzun) kelimesiyle eşleşir;
 * en uzun eşleşme en spesifiktir ve önce denenir.
 * @returns {{ malzeme_tipi: string, score: number }[]}
 */
function malzemeTipiEslestirTumu(malzemeAdi, sozluk) {
  if (!malzemeAdi || !sozluk?.length) return [];
  const normalizedAd = String(malzemeAdi).toLowerCase().trim();

  const matches = [];
  for (const entry of sozluk) {
    const kelimeler = entry.eslesen_kelimeler || [];
    let bestKelimeLen = 0;
    for (const kelime of kelimeler) {
      if (!kelime) continue;
      const nk = String(kelime).toLowerCase().trim();
      if (nk && normalizedAd.includes(nk) && nk.length > bestKelimeLen) {
        bestKelimeLen = nk.length;
      }
    }
    if (bestKelimeLen > 0) {
      matches.push({ malzeme_tipi: entry.malzeme_tipi, score: bestKelimeLen });
    }
  }

  // En uzun eşleşme önce (en spesifik); eşit skorda daha spesifik tip adı önce
  // Ör: "Zeytinyağı"(10) vs "Sıvı yağ"(8) — ikisi de score:10 ise "Zeytinyağı" önce denenir
  matches.sort((a, b) => b.score - a.score || b.malzeme_tipi.length - a.malzeme_tipi.length);
  return matches;
}

/**
 * Sözlük tabanlı eşleşme (1. katman) — en spesifik eşleşmeyi döndürür.
 * gramajKontrolHesapla ve dış kullanım için geriye dönük uyumlu API.
 */
export function malzemeTipiEslestir(malzemeAdi, sozluk) {
  const matches = malzemeTipiEslestirTumu(malzemeAdi, sozluk);
  return matches.length > 0 ? { malzeme_tipi: matches[0].malzeme_tipi } : null;
}

/**
 * Verilen malzeme adının belirli bir kural malzeme tipine uyup uymadığını kontrol eder.
 * Sözlük + doğrudan isim eşleşme ile çalışır. gramajKontrolHesapla için tasarlandı.
 * @param {string} malzemeAdi – reçetedeki malzeme adı (ör: "Zeytinyağı")
 * @param {string} kuralMalzemeTipi – kuralın malzeme_tipi değeri (ör: "Sıvı yağ")
 * @param {Array} sozluk – malzeme_tip_eslesmeleri satırları
 * @returns {boolean}
 */
export function malzemeKuralaUyarMi(malzemeAdi, kuralMalzemeTipi, sozluk) {
  if (!malzemeAdi || !kuralMalzemeTipi) return false;

  // 1. Sözlük: malzeme adından TÜM olası tipler bul, kural tipi bunlardan biri mi?
  const eslesmeler = malzemeTipiEslestirTumu(malzemeAdi, sozluk);
  if (eslesmeler.some((e) => e.malzeme_tipi === kuralMalzemeTipi)) return true;

  // 2. Doğrudan isim eşleşme
  const ad = String(malzemeAdi).toLowerCase().trim();
  const tip = String(kuralMalzemeTipi).toLowerCase().trim();
  if (!tip) return false;

  // Exact match
  if (ad === tip) return true;

  // Malzeme adı kural tipini İÇERİYORSA eşleşir (ör: "Kuru fasulye yemeği" ⊃ "Kuru fasulye")
  if (tip.length > 3) return ad.includes(tip);

  // Kısa kelime (≤3 harf): kelime sınırı kontrolü (false positive önleme)
  const regex = new RegExp(`\\b${tip.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  return regex.test(ad);
}

/**
 * Doğrudan isim tabanlı eşleşme (2. katman)
 *
 * SADECE TEK YÖN: malzeme adı kuralın malzeme_tipi'ni İÇERİYORSA eşleşir.
 * Ters yön (tip.includes(ad)) KALDIRILD: "Domates" → "Domates salçası" false positive'i önlendi.
 * Birden fazla kural eşleşirse en uzun (en spesifik) tip seçilir.
 */
function dogrudan_isim_eslestir(malzemeAdi, kurallar) {
  if (!malzemeAdi || !kurallar?.length) return null;
  const ad = String(malzemeAdi).toLowerCase().trim();

  // 1) Exact match (tam eşit) — en yüksek öncelik
  for (const k of kurallar) {
    if (k.malzeme_tipi && k.malzeme_tipi.toLowerCase().trim() === ad) {
      return k;
    }
  }

  // 2) Malzeme adı kuralın malzeme tipini İÇERİYORSA eşleşir
  //    En uzun tip eşleşmesi tercih edilir (spesifiklik)
  let bestMatch = null;
  let bestLen = 0;

  for (const k of kurallar) {
    if (!k.malzeme_tipi) continue;
    const tip = k.malzeme_tipi.toLowerCase().trim();

    if (tip.length <= 3) {
      // Kısa kelime: kelime sınırı ile ara
      const regex = new RegExp(`\\b${tip.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(ad) && tip.length > bestLen) {
        bestMatch = k;
        bestLen = tip.length;
      }
    } else {
      // Uzun kelimeler: sadece ad.includes(tip) yönü
      if (ad.includes(tip) && tip.length > bestLen) {
        bestMatch = k;
        bestLen = tip.length;
      }
    }
  }

  return bestMatch;
}

/**
 * Çok katmanlı kural eşleştirme (önizleme ve toplu uygulama ile aynı mantık)
 * 1. Sözlük → alt tip kuralları
 * 2. Doğrudan isim → alt tip kuralları
 * 3. Sözlük → tüm şartname kuralları (fallback)
 * 4. Doğrudan isim → tüm şartname kuralları (fallback)
 * @returns {{ kural: { gramaj: number, birim: string, malzeme_tipi: string }, malzeme_tipi: string, kaynak: string } | null}
 */
export function kuralBul(malzemeAdi, sozluk, altTipKurallari, tumKurallar) {
  // Sözlükten TÜM eşleşmeleri al (en spesifik → en genel sıralı)
  // Böylece "Zeytinyağı" hem "Zeytinyağı" hem "Sıvı yağ" kuralıyla denenebilir
  const eslesmeler = malzemeTipiEslestirTumu(malzemeAdi, sozluk);

  // Katman 1: Sözlük + alt tip kuralları (en spesifik eşleşme önce)
  if (altTipKurallari.length > 0) {
    for (const eslesme of eslesmeler) {
      const kural = altTipKurallari.find((k) => k.malzeme_tipi === eslesme.malzeme_tipi);
      if (kural) return { kural, malzeme_tipi: eslesme.malzeme_tipi, kaynak: 'alt_tip' };
    }
  }

  // Katman 2: Doğrudan isim + alt tip kuralları
  if (altTipKurallari.length > 0) {
    const kural = dogrudan_isim_eslestir(malzemeAdi, altTipKurallari);
    if (kural) return { kural, malzeme_tipi: kural.malzeme_tipi, kaynak: 'alt_tip_direkt' };
  }

  // Katman 3: Sözlük + tüm şartname kuralları (fallback, en spesifik eşleşme önce)
  for (const eslesme of eslesmeler) {
    const kural = tumKurallar.find((k) => k.malzeme_tipi === eslesme.malzeme_tipi);
    if (kural) return { kural, malzeme_tipi: eslesme.malzeme_tipi, kaynak: 'fallback' };
  }

  // Katman 4: Doğrudan isim + tüm şartname kuralları (fallback)
  const kural = dogrudan_isim_eslestir(malzemeAdi, tumKurallar);
  if (kural) return { kural, malzeme_tipi: kural.malzeme_tipi, kaynak: 'fallback_direkt' };

  return null;
}

/** Fiyat geçerlilik süresi (gün) — tüm sistemlerle tutarlı */
const FIYAT_GECERLILIK_GUN = 90;

function fiyatGuncelMi(tarih) {
  if (!tarih) return false;
  const fiyatTarihi = new Date(tarih);
  const simdi = new Date();
  const gun = Math.floor((simdi - fiyatTarihi) / (1000 * 60 * 60 * 24));
  return gun >= 0 && gun <= FIYAT_GECERLILIK_GUN;
}

/**
 * Fiyat kaynağına göre doğru birim-fiyat çifti belirle.
 * Ürün kartı fiyatları (aktif, son alış, manuel) ürünün fiyat birimi cinsinden,
 * piyasa fiyatları ise urun_fiyat_ozet.birim_tipi cinsinden olabilir.
 * Yanlış birim kullanıldığında fiyat 1000x şişebilir veya düşebilir.
 *
 * Fiyat önceliği (tüm sistemlerle tutarlı):
 *   aktif_fiyat > son_alış (≤90 gün) > piyasa > son_alış (eski) > manuel > varyant > 0
 */
function fiyatVeBirimBelirle(m) {
  const urunBirim = (m.urun_standart_birim || m.urun_fiyat_birimi || 'kg').toLowerCase();
  const sonAlisGuncel = fiyatGuncelMi(m.urun_son_alis_tarihi);

  // > 0 kontrolü: catering'de 0₺ = "fiyat girilmemiş" demek, sonraki kaynağa düş
  // 1. Aktif fiyat
  if (Number(m.urun_aktif_fiyat) > 0) {
    return { birimFiyat: Number(m.urun_aktif_fiyat), fiyatBirimi: urunBirim };
  }
  // 2. Son alış (≤90 gün)
  if (sonAlisGuncel && Number(m.urun_son_alis) > 0) {
    return { birimFiyat: Number(m.urun_son_alis), fiyatBirimi: urunBirim };
  }
  // 3. Piyasa fiyatı — kendi birim_tipi'si varsa onu kullan
  if (Number(m.piyasa_fiyat) > 0) {
    const piyasaBirim = m.piyasa_birim_tipi ? m.piyasa_birim_tipi.toLowerCase() : urunBirim;
    return { birimFiyat: Number(m.piyasa_fiyat), fiyatBirimi: piyasaBirim };
  }
  // 4. Son alış (eski, >90 gün)
  if (Number(m.urun_son_alis) > 0) {
    return { birimFiyat: Number(m.urun_son_alis), fiyatBirimi: urunBirim };
  }
  // 5. Manuel fiyat
  if (Number(m.urun_manuel_fiyat) > 0) {
    return { birimFiyat: Number(m.urun_manuel_fiyat), fiyatBirimi: urunBirim };
  }
  // 6. Varyant fiyatı
  if (Number(m.varyant_fiyat) > 0) {
    return { birimFiyat: Number(m.varyant_fiyat), fiyatBirimi: urunBirim };
  }

  return { birimFiyat: 0, fiyatBirimi: urunBirim };
}

/**
 * Bir reçete için şartnameye göre önizleme maliyet ve porsiyon hesapla
 * @param {number} receteId
 * @param {number} altTipId
 * @param {Array} kurallar - sartname_gramaj_kurallari
 * @param {Array} sozluk - malzeme_tip_eslesmeleri
 * @returns {Promise<{ tahmini_maliyet: number; porsiyon_gram: number }>}
 */
export async function receteSartnamePreview(receteId, altTipId, kurallar, sozluk) {
  const altTipKurallari = kurallar.filter((k) => Number(k.alt_tip_id) === Number(altTipId));

  const malzemeResult = await query(
    `
    SELECT
      rm.id, rm.malzeme_adi, rm.miktar, rm.birim,
      urk.manuel_fiyat as urun_manuel_fiyat,
      urk.aktif_fiyat as urun_aktif_fiyat,
      urk.son_alis_fiyati as urun_son_alis,
      urk.son_alis_tarihi as urun_son_alis_tarihi,
      urk.varsayilan_birim as urun_birim,
      urk.fiyat_birimi as urun_fiyat_birimi,
      urk.birim as urun_standart_birim,
      COALESCE(
        (SELECT birim_fiyat_ekonomik FROM urun_fiyat_ozet WHERE urun_kart_id = rm.urun_kart_id),
        (
          SELECT piyasa_fiyat_ort
          FROM piyasa_fiyat_gecmisi
          WHERE (urun_kart_id = rm.urun_kart_id AND rm.urun_kart_id IS NOT NULL)
             OR (stok_kart_id = rm.stok_kart_id AND rm.stok_kart_id IS NOT NULL)
          ORDER BY arastirma_tarihi DESC
          LIMIT 1
        )
      ) as piyasa_fiyat,
      (SELECT birim_tipi FROM urun_fiyat_ozet WHERE urun_kart_id = rm.urun_kart_id) as piyasa_birim_tipi,
      get_en_iyi_varyant_fiyat(rm.urun_kart_id) as varyant_fiyat
    FROM recete_malzemeler rm
    LEFT JOIN urun_kartlari urk ON urk.id = rm.urun_kart_id
    WHERE rm.recete_id = $1
    `,
    [receteId]
  );

  let toplamMaliyet = 0;
  let porsiyonGram = 0;

  for (const m of malzemeResult.rows) {
    let miktar = Number(m.miktar) || 0;
    let birim = (m.birim || '').trim().toLowerCase();

    // Çok katmanlı kural eşleştirme
    const sonuc = kuralBul(m.malzeme_adi, sozluk, altTipKurallari, kurallar);
    if (sonuc) {
      miktar = Number(sonuc.kural.gramaj) || 0;
      birim = (sonuc.kural.birim || 'g').trim().toLowerCase();
    }

    const { birimFiyat, fiyatBirimi } = fiyatVeBirimBelirle(m);
    const carpan = await donusumCarpaniAl(birim || 'g', fiyatBirimi, m.urun_kart_id);
    toplamMaliyet += miktar * carpan * birimFiyat;

    // Porsiyon: miktar → gram dönüşümü
    const gCarpan = await donusumCarpaniAl(birim || 'g', 'g', m.urun_kart_id);
    porsiyonGram += miktar * gCarpan;
  }

  return {
    tahmini_maliyet: Math.round(toplamMaliyet * 100) / 100,
    porsiyon_gram: Math.round(porsiyonGram * 100) / 100,
  };
}

/**
 * Reçete malzemeleri için şartname gramaj önizlemesi (modal için)
 * Her malzeme için: mevcut miktar, şartname override, hesaplanan fiyat
 * @param {number} receteId
 * @param {number} sartnameId
 * @returns {Promise<{ malzemeler: Array; alt_tip_id: number|null; toplam_maliyet: number }>}
 */
export async function receteSartnameMalzemeOnizleme(receteId, sartnameId) {
  const receteResult = await query(
    `SELECT r.id, r.alt_tip_id, att.ad as alt_tip_adi FROM receteler r
     LEFT JOIN alt_tip_tanimlari att ON att.id = r.alt_tip_id
     WHERE r.id = $1`,
    [receteId]
  );
  if (receteResult.rows.length === 0) {
    return { malzemeler: [], alt_tip_id: null, toplam_maliyet: 0 };
  }

  const recete = receteResult.rows[0];
  const altTipId = recete.alt_tip_id;

  // Şartnameye ait TÜM kuralları al (fallback için)
  const kurallarResult = await query(
    `SELECT * FROM sartname_gramaj_kurallari WHERE sartname_id = $1 AND aktif = true`,
    [sartnameId]
  );
  const tumKurallar = kurallarResult.rows;

  const sozlukResult = await query('SELECT * FROM malzeme_tip_eslesmeleri WHERE aktif = true');
  const sozluk = sozlukResult.rows;

  // Reçetenin alt tipine özel kurallar
  const altTipKurallari = altTipId ? tumKurallar.filter((k) => Number(k.alt_tip_id) === Number(altTipId)) : [];

  const malzemeResult = await query(
    `
    SELECT rm.id, rm.malzeme_adi, rm.miktar, rm.birim, rm.urun_kart_id,
      urk.manuel_fiyat as urun_manuel_fiyat,
      urk.aktif_fiyat as urun_aktif_fiyat,
      urk.son_alis_fiyati as urun_son_alis,
      urk.son_alis_tarihi as urun_son_alis_tarihi,
      urk.varsayilan_birim as urun_birim,
      urk.fiyat_birimi as urun_fiyat_birimi,
      urk.birim as urun_standart_birim,
      COALESCE(
        (SELECT birim_fiyat_ekonomik FROM urun_fiyat_ozet WHERE urun_kart_id = rm.urun_kart_id),
        (SELECT piyasa_fiyat_ort FROM piyasa_fiyat_gecmisi
         WHERE (urun_kart_id = rm.urun_kart_id AND rm.urun_kart_id IS NOT NULL)
            OR (stok_kart_id = rm.stok_kart_id AND rm.stok_kart_id IS NOT NULL)
         ORDER BY arastirma_tarihi DESC LIMIT 1)
      ) as piyasa_fiyat,
      (SELECT birim_tipi FROM urun_fiyat_ozet WHERE urun_kart_id = rm.urun_kart_id) as piyasa_birim_tipi,
      get_en_iyi_varyant_fiyat(rm.urun_kart_id) as varyant_fiyat
    FROM recete_malzemeler rm
    LEFT JOIN urun_kartlari urk ON urk.id = rm.urun_kart_id
    WHERE rm.recete_id = $1
    ORDER BY rm.sira
    `,
    [receteId]
  );

  const malzemeler = [];
  let toplamMaliyet = 0;

  for (const m of malzemeResult.rows) {
    const mevcutMiktar = Number(m.miktar) || 0;
    const mevcutBirim = (m.birim || 'g').trim().toLowerCase();
    let sartnameGramaj = null;
    let sartnameBirim = null;
    let malzemeTipi = null;

    // Çok katmanlı eşleşme: alt_tip kuralları → tüm şartname kuralları → doğrudan isim
    const sonuc = kuralBul(m.malzeme_adi, sozluk, altTipKurallari, tumKurallar);
    if (sonuc) {
      malzemeTipi = sonuc.malzeme_tipi;
      sartnameGramaj = Number(sonuc.kural.gramaj) || 0;
      sartnameBirim = (sonuc.kural.birim || 'g').trim().toLowerCase();
    }

    const kullanilanMiktar = sartnameGramaj != null ? sartnameGramaj : mevcutMiktar;
    const kullanilanBirim = sartnameBirim || mevcutBirim;

    const { birimFiyat, fiyatBirimi } = fiyatVeBirimBelirle(m);
    const carpan = await donusumCarpaniAl(kullanilanBirim, fiyatBirimi, m.urun_kart_id);
    const hesaplananFiyat = kullanilanMiktar * carpan * birimFiyat;
    toplamMaliyet += hesaplananFiyat;

    // Uyarı tespiti: dönüşüm fallback'e düşmüş veya fiyat eksik
    const uyarilar = [];
    const birimlerFarkli = kullanilanBirim !== fiyatBirimi;
    if (birimlerFarkli && carpan === 1) {
      uyarilar.push(`Birim dönüşümü bulunamadı: ${kullanilanBirim} → ${fiyatBirimi} (çarpan=1 fallback)`);
    }
    if (birimFiyat === 0) {
      uyarilar.push('Fiyat bilgisi bulunamadı');
    }

    malzemeler.push({
      id: m.id,
      malzeme_adi: m.malzeme_adi,
      mevcut_miktar: mevcutMiktar,
      mevcut_birim: mevcutBirim,
      sartname_gramaj: sartnameGramaj,
      sartname_birim: sartnameBirim,
      kullanilan_miktar: Math.round(kullanilanMiktar * 100) / 100,
      kullanilan_birim: kullanilanBirim,
      hesaplanan_fiyat: Math.round(hesaplananFiyat * 100) / 100,
      malzeme_tipi: malzemeTipi,
      birim_fiyat: birimFiyat,
      uyarilar: uyarilar.length > 0 ? uyarilar : undefined,
    });
  }

  // Genel uyarı özeti
  const uyariSayisi = malzemeler.filter((m) => m.uyarilar?.length).length;

  return {
    malzemeler,
    alt_tip_id: altTipId,
    alt_tip_adi: recete.alt_tip_adi,
    toplam_maliyet: Math.round(toplamMaliyet * 100) / 100,
    uyari_sayisi: uyariSayisi,
  };
}
