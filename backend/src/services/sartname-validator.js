/**
 * Şartname Gramaj Kuralları Sürekli Doğrulama Servisi
 *
 * Periyodik olarak şartname kurallarını kontrol eder ve anomalileri tespit eder:
 * - Alt tip başına çok fazla kural (>12 = bozuk veri)
 * - Aynı malzeme_tipi tüm alt tiplerde tekrar ediyor (kopyalama hatası)
 * - Boş alt tipler (hiç kuralı olmayan)
 * - Kural dağılım anomalisi (std sapma kontrolü)
 *
 * Haftalık çalışır (Pazartesi 06:00), sonuçları loglar ve admin bildirim oluşturur.
 */

import cron from 'node-cron';
import { query } from '../database.js';
import logger from '../utils/logger.js';

const ESIK_KURAL_PER_ALT_TIP = 12; // Alt tip başına maks mantıklı kural sayısı
const ESIK_EVRENSEL_MALZEME = 0.7; // Bir malzeme alt tiplerin >%70'inde varsa şüpheli

/**
 * Tüm şartnameleri doğrula ve anomalileri raporla
 * @returns {{ anomaliler: Array, ozet: Object }}
 */
export async function sartnameDogrula() {
  const anomaliler = [];
  const startTime = Date.now();

  // 1. Tüm şartnameleri al
  const sartnameler = await query(`
    SELECT ps.id, ps.ad,
           COUNT(sgk.id) as toplam_kural,
           COUNT(DISTINCT sgk.alt_tip_id) as alt_tip_sayisi,
           ROUND(COUNT(sgk.id)::numeric / NULLIF(COUNT(DISTINCT sgk.alt_tip_id), 0), 1) as ort_kural
    FROM proje_sartnameleri ps
    LEFT JOIN sartname_gramaj_kurallari sgk ON sgk.sartname_id = ps.id AND sgk.aktif = true
    GROUP BY ps.id, ps.ad
    ORDER BY ps.id
  `);

  for (const s of sartnameler.rows) {
    if (s.toplam_kural === 0) continue;

    // ── Kontrol 1: Alt tip başına kural sayısı ──
    const altTipDetay = await query(
      `
      SELECT sgk.alt_tip_id, att.ad as alt_tip_adi, COUNT(*) as kural_sayisi
      FROM sartname_gramaj_kurallari sgk
      JOIN alt_tip_tanimlari att ON att.id = sgk.alt_tip_id
      WHERE sgk.sartname_id = $1 AND sgk.aktif = true
      GROUP BY sgk.alt_tip_id, att.ad
      ORDER BY COUNT(*) DESC
    `,
      [s.id]
    );

    const bozukAltTipler = altTipDetay.rows.filter((a) => a.kural_sayisi > ESIK_KURAL_PER_ALT_TIP);

    if (bozukAltTipler.length > 0) {
      anomaliler.push({
        tip: 'FAZLA_KURAL',
        ciddiyet: 'YUKSEK',
        sartname_id: s.id,
        sartname_adi: s.ad,
        mesaj: `${bozukAltTipler.length} alt tipte kural sayısı >${ESIK_KURAL_PER_ALT_TIP}`,
        detay: bozukAltTipler.slice(0, 5).map((a) => `${a.alt_tip_adi}: ${a.kural_sayisi}`),
      });
    }

    // ── Kontrol 2: Evrensel malzeme tespiti ──
    if (s.alt_tip_sayisi > 5) {
      const malzemeYayilim = await query(
        `
        SELECT sgk.malzeme_tipi, COUNT(DISTINCT sgk.alt_tip_id) as alt_tip_sayisi
        FROM sartname_gramaj_kurallari sgk
        WHERE sgk.sartname_id = $1 AND sgk.aktif = true
        GROUP BY sgk.malzeme_tipi
        HAVING COUNT(DISTINCT sgk.alt_tip_id) > $2
        ORDER BY COUNT(DISTINCT sgk.alt_tip_id) DESC
      `,
        [s.id, Math.floor(s.alt_tip_sayisi * ESIK_EVRENSEL_MALZEME)]
      );

      // Bazı malzemelerin çok yaygın olması normal (Sıvı yağ, Tuz)
      const BEKLENENYAYGIN = new Set(['sıvı yağ', 'tuz', 'soğan', 'karabiber']);
      const supheliMalzemeler = malzemeYayilim.rows.filter((m) => !BEKLENENYAYGIN.has(m.malzeme_tipi.toLowerCase()));

      if (supheliMalzemeler.length > 3) {
        anomaliler.push({
          tip: 'KOPYALAMA_SUPHESI',
          ciddiyet: 'YUKSEK',
          sartname_id: s.id,
          sartname_adi: s.ad,
          mesaj: `${supheliMalzemeler.length} malzeme alt tiplerin >%${Math.round(ESIK_EVRENSEL_MALZEME * 100)}'inde mevcut (kopyalama hatası?)`,
          detay: supheliMalzemeler
            .slice(0, 5)
            .map((m) => `${m.malzeme_tipi}: ${m.alt_tip_sayisi}/${s.alt_tip_sayisi} alt tipte`),
        });
      }
    }

    // ── Kontrol 3: Kural dağılım anomalisi (std sapma) ──
    if (altTipDetay.rows.length > 3) {
      const sayilar = altTipDetay.rows.map((a) => Number(a.kural_sayisi));
      const ort = sayilar.reduce((a, b) => a + b, 0) / sayilar.length;
      const varyans = sayilar.reduce((sum, v) => sum + (v - ort) ** 2, 0) / sayilar.length;
      const stdSapma = Math.sqrt(varyans);

      // Çok düşük std sapma + yüksek ortalama = hepsi aynı (kopyalama)
      if (ort > 10 && stdSapma < 3) {
        anomaliler.push({
          tip: 'DUSUK_CESITLILIK',
          ciddiyet: 'ORTA',
          sartname_id: s.id,
          sartname_adi: s.ad,
          mesaj: `Tüm alt tipler neredeyse aynı kural sayısına sahip (ort: ${ort.toFixed(1)}, std: ${stdSapma.toFixed(1)}) — kopyalama olabilir`,
          detay: [],
        });
      }
    }
  }

  const sure = Date.now() - startTime;
  const ozet = {
    toplam_sartname: sartnameler.rows.length,
    anomali_sayisi: anomaliler.length,
    yuksek_ciddiyet: anomaliler.filter((a) => a.ciddiyet === 'YUKSEK').length,
    orta_ciddiyet: anomaliler.filter((a) => a.ciddiyet === 'ORTA').length,
    sure_ms: sure,
  };

  return { anomaliler, ozet };
}

/**
 * Doğrulama sonuçlarını admin bildirimine yaz
 */
async function bildirimOlustur(anomaliler, ozet) {
  if (anomaliler.length === 0) return;

  const mesaj = [
    `Şartname doğrulama: ${ozet.anomali_sayisi} anomali tespit edildi`,
    `(${ozet.yuksek_ciddiyet} yüksek, ${ozet.orta_ciddiyet} orta)`,
    '',
    ...anomaliler.slice(0, 10).map((a) => `[${a.ciddiyet}] ${a.sartname_adi}: ${a.mesaj}`),
  ].join('\n');

  try {
    await query(
      `INSERT INTO bildirimler (baslik, mesaj, tip, onem, hedef_rol, okundu)
       VALUES ($1, $2, 'sistem', 'yuksek', 'admin', false)`,
      ['Şartname Anomali Tespiti', mesaj]
    );
  } catch (err) {
    // bildirimler tablosu yoksa sessizce geç
    logger.warn('Bildirim oluşturulamadı (tablo mevcut olmayabilir):', err.message);
  }
}

/**
 * Haftalık doğrulama çalıştır
 */
async function haftalikDogrulama() {
  logger.info('[sartname-validator] Haftalık şartname doğrulama başlatılıyor...');

  try {
    const { anomaliler, ozet } = await sartnameDogrula();

    if (anomaliler.length === 0) {
      logger.info(
        `[sartname-validator] ✓ Anomali yok (${ozet.toplam_sartname} şartname kontrol edildi, ${ozet.sure_ms}ms)`
      );
    } else {
      logger.warn(
        `[sartname-validator] ⚠ ${ozet.anomali_sayisi} anomali tespit edildi ` +
          `(${ozet.yuksek_ciddiyet} yüksek, ${ozet.orta_ciddiyet} orta, ${ozet.sure_ms}ms)`
      );
      for (const a of anomaliler) {
        logger.warn(`  [${a.ciddiyet}] ${a.sartname_adi}: ${a.mesaj}`);
      }

      await bildirimOlustur(anomaliler, ozet);
    }
  } catch (err) {
    logger.error('[sartname-validator] Doğrulama hatası:', err.message);
  }
}

// ── Scheduler ──
const sartnameValidator = {
  start() {
    // Pazartesi 06:00
    cron.schedule('0 6 * * 1', () => {
      haftalikDogrulama();
    });
    logger.info('[sartname-validator] Haftalık doğrulama zamanlandı (Pazartesi 06:00)');

    // İlk çalıştırma — başlangıçta 30sn sonra
    setTimeout(() => {
      haftalikDogrulama();
    }, 30_000);
  },
};

export default sartnameValidator;
export { haftalikDogrulama };
