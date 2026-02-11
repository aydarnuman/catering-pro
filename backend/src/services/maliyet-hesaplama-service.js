import { query } from '../database.js';
import logger from '../utils/logger.js';

/**
 * Reçete maliyetini hesapla
 * Fiyat önceliği: aktif_fiyat > son_alış > manuel > piyasa > varyant fallback > 0
 */
async function hesaplaReceteMaliyet(receteId) {
  try {
    // Malzemeleri al (ürün kartı fiyatları + piyasa fiyatları + VARYANT FALLBACK)
    const malzemeler = await query(
      `
      SELECT
        rm.*,
        urk.manuel_fiyat as urun_manuel_fiyat,
        urk.aktif_fiyat as urun_aktif_fiyat,
        urk.aktif_fiyat_tipi as urun_aktif_fiyat_tipi,
        urk.son_alis_fiyati as urun_son_alis,
        urk.varsayilan_birim as urun_birim,
        urk.fiyat_birimi as urun_fiyat_birimi,
        urk.ana_urun_id as urun_ana_urun_id,
        -- Piyasa fiyatı: önce özet tablodan (IQR temizli), yoksa eski yöntem
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
        -- VARYANT FALLBACK: Ana ürünün fiyatı yoksa varyantlardan al
        get_en_iyi_varyant_fiyat(rm.urun_kart_id) as varyant_fiyat,
        -- Varyant bilgisi (hangi varyanttan geldiğini göstermek için)
        (SELECT vo.en_ucuz_varyant_adi FROM get_varyant_fiyat_ozet(rm.urun_kart_id) vo) as varyant_kaynak_adi,
        (SELECT vo.varyant_sayisi FROM get_varyant_fiyat_ozet(rm.urun_kart_id) vo) as varyant_sayisi
      FROM recete_malzemeler rm
      LEFT JOIN urun_kartlari urk ON urk.id = rm.urun_kart_id
      WHERE rm.recete_id = $1
    `,
      [receteId]
    );

    let toplamMaliyet = 0;

    for (const m of malzemeler.rows) {
      // Fiyat önceliği: aktif_fiyat > son_alış > manuel > piyasa > VARYANT FALLBACK > 0
      const birimFiyat =
        Number(m.urun_aktif_fiyat) ||
        Number(m.urun_son_alis) ||
        Number(m.urun_manuel_fiyat) ||
        Number(m.piyasa_fiyat) ||
        Number(m.varyant_fiyat) ||
        0;

      // Birim dönüşümü: küçük birim (g/gr/ml) ise 0.001, değilse 1
      const malzemeBirimi = (m.birim || '').toLowerCase();
      const carpan = ['g', 'gr', 'gram', 'ml'].includes(malzemeBirimi) ? 0.001 : 1;
      const maliyet = m.miktar * carpan * birimFiyat;

      // Fiyat kaynağı belirleme (aktif_fiyat_tipi varsa onu kullan)
      let fiyatKaynagi = 'yok';
      if (Number(m.urun_aktif_fiyat) > 0 && m.urun_aktif_fiyat_tipi) {
        fiyatKaynagi = m.urun_aktif_fiyat_tipi;
      } else if (Number(m.urun_son_alis) > 0) fiyatKaynagi = 'FATURA';
      else if (Number(m.urun_manuel_fiyat) > 0) fiyatKaynagi = 'MANUEL';
      else if (Number(m.piyasa_fiyat) > 0) fiyatKaynagi = 'PIYASA';
      else if (Number(m.varyant_fiyat) > 0) fiyatKaynagi = 'VARYANT';

      // Malzeme fiyatını güncelle
      await query(
        `
        UPDATE recete_malzemeler SET
          birim_fiyat = $1,
          toplam_fiyat = $2,
          fiyat_kaynagi = $3
        WHERE id = $4
      `,
        [birimFiyat, Math.round(maliyet * 100) / 100, fiyatKaynagi, m.id]
      );

      toplamMaliyet += maliyet;
    }

    // Reçete maliyetini güncelle
    await query(
      `
      UPDATE receteler SET
        tahmini_maliyet = $1,
        son_hesaplama_tarihi = NOW()
      WHERE id = $2
    `,
      [Math.round(toplamMaliyet * 100) / 100, receteId]
    );

    return toplamMaliyet;
  } catch (error) {
    logger.error(`Reçete ${receteId} maliyet hesaplama hatası: ${error.message}`);
    return 0;
  }
}

/**
 * Öğün maliyetini güncelle (yemeklerin toplamı → öğün → plan)
 */
async function guncelleOgunMaliyet(ogunId) {
  try {
    // Yemeklerin toplam maliyeti
    const result = await query(
      `
      SELECT
        COALESCE(SUM(toplam_maliyet), 0) as toplam,
        COALESCE(SUM(porsiyon_maliyet), 0) as porsiyon_toplam
      FROM menu_ogun_yemekleri
      WHERE menu_ogun_id = $1
    `,
      [ogunId]
    );

    const toplam = result.rows[0].toplam;

    // Öğün kişi sayısı
    const ogunResult = await query(
      `
      SELECT kisi_sayisi,
             (SELECT varsayilan_kisi_sayisi FROM menu_planlari WHERE id = menu_plan_id) as varsayilan
      FROM menu_plan_ogunleri WHERE id = $1
    `,
      [ogunId]
    );

    const kisiSayisi = ogunResult.rows[0]?.kisi_sayisi || ogunResult.rows[0]?.varsayilan || 1;
    const porsiyonMaliyet = kisiSayisi > 0 ? toplam / kisiSayisi : 0;

    await query(
      `
      UPDATE menu_plan_ogunleri SET
        toplam_maliyet = $1,
        porsiyon_maliyet = $2,
        updated_at = NOW()
      WHERE id = $3
    `,
      [toplam, porsiyonMaliyet, ogunId]
    );

    // Plan toplamını da güncelle
    const planId = await query('SELECT menu_plan_id FROM menu_plan_ogunleri WHERE id = $1', [ogunId]);
    if (planId.rows.length > 0) {
      await guncellePlanMaliyet(planId.rows[0].menu_plan_id);
    }
  } catch (_error) {}
}

/**
 * Plan maliyetini güncelle (tüm öğünlerin toplamı → plan)
 */
async function guncellePlanMaliyet(planId) {
  try {
    const result = await query(
      `
      SELECT
        COALESCE(SUM(toplam_maliyet), 0) as toplam,
        COUNT(DISTINCT tarih) as gun_sayisi
      FROM menu_plan_ogunleri
      WHERE menu_plan_id = $1
    `,
      [planId]
    );

    const toplam = result.rows[0].toplam;
    const gunSayisi = result.rows[0].gun_sayisi || 1;
    const gunlukOrtalama = toplam / gunSayisi;

    // Toplam porsiyon sayısı
    const porsiyonResult = await query(
      `
      SELECT COALESCE(SUM(COALESCE(kisi_sayisi, mp.varsayilan_kisi_sayisi)), 0) as toplam_porsiyon
      FROM menu_plan_ogunleri mpo
      JOIN menu_planlari mp ON mp.id = mpo.menu_plan_id
      WHERE mpo.menu_plan_id = $1
    `,
      [planId]
    );

    const toplamPorsiyon = porsiyonResult.rows[0].toplam_porsiyon || 1;
    const porsiyonOrtalama = toplam / toplamPorsiyon;

    await query(
      `
      UPDATE menu_planlari SET
        toplam_maliyet = $1,
        gunluk_ortalama_maliyet = $2,
        porsiyon_ortalama_maliyet = $3,
        updated_at = NOW()
      WHERE id = $4
    `,
      [toplam, gunlukOrtalama, porsiyonOrtalama, planId]
    );
  } catch (_error) {}
}

export { hesaplaReceteMaliyet, guncelleOgunMaliyet, guncellePlanMaliyet };
