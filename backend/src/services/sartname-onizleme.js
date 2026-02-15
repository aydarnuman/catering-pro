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
 * Sözlük tabanlı eşleşme (1. katman) – gramaj kontrolü vb. için dışarıda da kullanılır
 */
export function malzemeTipiEslestir(malzemeAdi, sozluk) {
  if (!malzemeAdi || !sozluk?.length) return null;
  const normalizedAd = String(malzemeAdi).toLowerCase().trim();
  for (const entry of sozluk) {
    const kelimeler = entry.eslesen_kelimeler || [];
    for (const kelime of kelimeler) {
      if (kelime && normalizedAd.includes(String(kelime).toLowerCase())) {
        return { malzeme_tipi: entry.malzeme_tipi };
      }
    }
  }
  return null;
}

/**
 * Doğrudan isim tabanlı eşleşme (2. katman)
 * malzeme adı kuralın malzeme_tipi'ni içeriyorsa veya kural malzeme adını içeriyorsa eşleşir
 * Kısa kelimeler (<=3 harf) için sadece tam kelime eşleşmesi yapılır (false positive önleme)
 */
function dogrudan_isim_eslestir(malzemeAdi, kurallar) {
  if (!malzemeAdi || !kurallar?.length) return null;
  const ad = String(malzemeAdi).toLowerCase().trim();

  // 1) Exact match (tam eşit)
  for (const k of kurallar) {
    if (k.malzeme_tipi && k.malzeme_tipi.toLowerCase().trim() === ad) {
      return k;
    }
  }

  // 2) Substring eşleşme — kısa kelimeler için kelime sınırı kontrolü
  for (const k of kurallar) {
    if (!k.malzeme_tipi) continue;
    const tip = k.malzeme_tipi.toLowerCase().trim();

    // Kısa kelime guard: 3 harf veya daha az kelimeler kelime sınırı ile aranır
    if (ad.length <= 3 || tip.length <= 3) {
      const regex = new RegExp(`\\b${ad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(tip)) return k;
      const regexTip = new RegExp(`\\b${tip.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regexTip.test(ad)) return k;
      continue;
    }

    // Uzun kelimeler: normal includes
    if (ad.includes(tip) || tip.includes(ad)) {
      return k;
    }
  }

  return null;
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
  // Katman 1: Sözlük + alt tip kuralları
  const eslesme = malzemeTipiEslestir(malzemeAdi, sozluk);
  if (eslesme && altTipKurallari.length > 0) {
    const kural = altTipKurallari.find((k) => k.malzeme_tipi === eslesme.malzeme_tipi);
    if (kural) return { kural, malzeme_tipi: eslesme.malzeme_tipi, kaynak: 'alt_tip' };
  }

  // Katman 2: Doğrudan isim + alt tip kuralları
  if (altTipKurallari.length > 0) {
    const kural = dogrudan_isim_eslestir(malzemeAdi, altTipKurallari);
    if (kural) return { kural, malzeme_tipi: kural.malzeme_tipi, kaynak: 'alt_tip_direkt' };
  }

  // Katman 3: Sözlük + tüm şartname kuralları (fallback)
  if (eslesme) {
    const kural = tumKurallar.find((k) => k.malzeme_tipi === eslesme.malzeme_tipi);
    if (kural) return { kural, malzeme_tipi: eslesme.malzeme_tipi, kaynak: 'fallback' };
  }

  // Katman 4: Doğrudan isim + tüm şartname kuralları (fallback)
  const kural = dogrudan_isim_eslestir(malzemeAdi, tumKurallar);
  if (kural) return { kural, malzeme_tipi: kural.malzeme_tipi, kaynak: 'fallback_direkt' };

  return null;
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

    const birimFiyat =
      Number(m.urun_aktif_fiyat) ||
      Number(m.urun_son_alis) ||
      Number(m.urun_manuel_fiyat) ||
      Number(m.piyasa_fiyat) ||
      Number(m.varyant_fiyat) ||
      0;

    const fiyatBirimi = (m.urun_standart_birim || m.urun_fiyat_birimi || 'kg').toLowerCase();
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

    const birimFiyat =
      Number(m.urun_aktif_fiyat) ||
      Number(m.urun_son_alis) ||
      Number(m.urun_manuel_fiyat) ||
      Number(m.piyasa_fiyat) ||
      Number(m.varyant_fiyat) ||
      0;

    const fiyatBirimi = (m.urun_standart_birim || m.urun_fiyat_birimi || 'kg').toLowerCase();
    const carpan = await donusumCarpaniAl(kullanilanBirim, fiyatBirimi, m.urun_kart_id);
    const hesaplananFiyat = kullanilanMiktar * carpan * birimFiyat;
    toplamMaliyet += hesaplananFiyat;

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
    });
  }

  return {
    malzemeler,
    alt_tip_id: altTipId,
    alt_tip_adi: recete.alt_tip_adi,
    toplam_maliyet: Math.round(toplamMaliyet * 100) / 100,
  };
}
