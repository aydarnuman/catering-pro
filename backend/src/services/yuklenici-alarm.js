/**
 * Yüklenici Alarm / Bildirim Servisi
 * ───────────────────────────────────
 * Takipteki yüklenicilerde değişiklik tespit edip otomatik bildirim oluşturur.
 *
 * Kontrol edilen değişiklikler:
 *   - yeni_ihale_kazanim : Yüklenici yeni bir ihale kazandı
 *   - yeni_sehir         : Firma daha önce görmediğimiz bir şehirde göründü
 *   - kik_sikayet        : Firmaya yeni KİK şikayeti açıldı
 *   - yasaklama          : Firma yasaklılar listesine girdi
 *   - fesih              : Firmanın sözleşmesi feshedildi
 *   - fiyat_degisim      : İndirim oranında belirgin değişiklik (>5 puan)
 *
 * Kullanım:
 *   import { checkAlarms } from './yuklenici-alarm.js';
 *   await checkAlarms(yukleniciId, eskiVeri, yeniVeri);
 *
 * Bu servis, scraper'lar veri güncelledikten SONRA çağrılır.
 * Bildirimler yuklenici_bildirimler tablosuna yazılır.
 */

import { query } from '../database.js';
import { logAPI, logError } from '../utils/logger.js';

const MODULE_NAME = 'Yuklenici-Alarm';

/**
 * Bir yüklenici için alarm kontrolü yapar.
 * Eski ve yeni veriyi karşılaştırarak değişiklikleri tespit eder.
 *
 * @param {number} yukleniciId - Yüklenici ID
 * @param {Object} eskiVeri - Önceki durum (opsiyonel, yoksa DB'den çekilir)
 * @param {Object} yeniVeri - Güncel durum
 */
export async function checkAlarms(yukleniciId, eskiVeri = null, yeniVeri = null) {
  try {
    // Eğer eski veri verilmemişse, DB'deki son durumu çek
    if (!eskiVeri) {
      const { rows: [yk] } = await query(
        `SELECT katildigi_ihale_sayisi, kazanma_orani, ortalama_indirim_orani,
                aktif_sehirler, fesih_sayisi, kik_sikayet_sayisi, toplam_sozlesme_bedeli
         FROM yukleniciler WHERE id = $1`,
        [yukleniciId]
      );
      eskiVeri = yk || {};
    }

    // Eğer yeni veri verilmemişse, zaten eski veri DB'den geldi — çıkış
    if (!yeniVeri) return;

    const bildirimler = [];

    // ─── Yeni İhale Kazanımı ─────────────────────────────────────
    if (yeniVeri.katildigi_ihale_sayisi > (eskiVeri.katildigi_ihale_sayisi || 0)) {
      const fark = yeniVeri.katildigi_ihale_sayisi - (eskiVeri.katildigi_ihale_sayisi || 0);
      bildirimler.push({
        tip: 'yeni_ihale_kazanim',
        baslik: `${fark} yeni ihale tespit edildi`,
        icerik: `Toplam ihale sayısı: ${eskiVeri.katildigi_ihale_sayisi || 0} → ${yeniVeri.katildigi_ihale_sayisi}`,
        meta: { eski: eskiVeri.katildigi_ihale_sayisi, yeni: yeniVeri.katildigi_ihale_sayisi },
      });
    }

    // ─── Yeni Şehir ─────────────────────────────────────────────
    const eskiSehirler = new Set(eskiVeri.aktif_sehirler || []);
    const yeniSehirler = yeniVeri.aktif_sehirler || [];
    const yeniEklenenSehirler = yeniSehirler.filter(s => !eskiSehirler.has(s));

    if (yeniEklenenSehirler.length > 0) {
      bildirimler.push({
        tip: 'yeni_sehir',
        baslik: `${yeniEklenenSehirler.length} yeni şehirde faaliyet tespit edildi`,
        icerik: `Yeni şehirler: ${yeniEklenenSehirler.join(', ')}`,
        meta: { yeni_sehirler: yeniEklenenSehirler },
      });
    }

    // ─── KİK Şikayet Artışı ─────────────────────────────────────
    if ((yeniVeri.kik_sikayet_sayisi || 0) > (eskiVeri.kik_sikayet_sayisi || 0)) {
      const fark = yeniVeri.kik_sikayet_sayisi - (eskiVeri.kik_sikayet_sayisi || 0);
      bildirimler.push({
        tip: 'kik_sikayet',
        baslik: `${fark} yeni KİK şikayeti/kararı`,
        icerik: `KİK karar sayısı: ${eskiVeri.kik_sikayet_sayisi || 0} → ${yeniVeri.kik_sikayet_sayisi}`,
        meta: { eski: eskiVeri.kik_sikayet_sayisi, yeni: yeniVeri.kik_sikayet_sayisi },
      });
    }

    // ─── Fesih Artışı ───────────────────────────────────────────
    if ((yeniVeri.fesih_sayisi || 0) > (eskiVeri.fesih_sayisi || 0)) {
      const fark = yeniVeri.fesih_sayisi - (eskiVeri.fesih_sayisi || 0);
      bildirimler.push({
        tip: 'fesih',
        baslik: `${fark} yeni sözleşme feshi tespit edildi`,
        icerik: `Toplam fesih: ${eskiVeri.fesih_sayisi || 0} → ${yeniVeri.fesih_sayisi}`,
        meta: { eski: eskiVeri.fesih_sayisi, yeni: yeniVeri.fesih_sayisi },
      });
    }

    // ─── İndirim Oranı Değişimi (>5 puan) ───────────────────────
    const eskiIndirim = parseFloat(eskiVeri.ortalama_indirim_orani) || 0;
    const yeniIndirim = parseFloat(yeniVeri.ortalama_indirim_orani) || 0;
    const indirimFark = Math.abs(yeniIndirim - eskiIndirim);

    if (eskiIndirim > 0 && indirimFark >= 5) {
      const yon = yeniIndirim > eskiIndirim ? 'arttı' : 'düştü';
      bildirimler.push({
        tip: 'fiyat_degisim',
        baslik: `İndirim oranı belirgin şekilde ${yon}`,
        icerik: `Ortalama indirim: %${eskiIndirim.toFixed(1)} → %${yeniIndirim.toFixed(1)} (${yon === 'arttı' ? '+' : '-'}${indirimFark.toFixed(1)} puan)`,
        meta: {
          eski_indirim: eskiIndirim,
          yeni_indirim: yeniIndirim,
          fark: indirimFark,
          yon,
        },
      });
    }

    // ─── Bildirimleri DB'ye yaz ─────────────────────────────────
    if (bildirimler.length > 0) {
      for (const bildirim of bildirimler) {
        await query(
          `INSERT INTO yuklenici_bildirimler (yuklenici_id, tip, baslik, icerik, meta)
           VALUES ($1, $2, $3, $4, $5)`,
          [yukleniciId, bildirim.tip, bildirim.baslik, bildirim.icerik, JSON.stringify(bildirim.meta)]
        );
      }

      logAPI(MODULE_NAME, {
        yukleniciId,
        bildirimSayisi: bildirimler.length,
        tipler: bildirimler.map(b => b.tip),
      });
    }

    return { bildirim_sayisi: bildirimler.length, bildirimler };
  } catch (error) {
    logError(MODULE_NAME, error);
    // Alarm hatası scraper'ı durdurmamalı
    return { bildirim_sayisi: 0, hata: error.message };
  }
}

/**
 * Yasaklama bildirimi oluşturur.
 * KIK yasaklı modülü tarafından çağrılır.
 *
 * @param {number} yukleniciId
 * @param {Object} yasakBilgisi - { yasaklama_tarihi, yasaklama_suresi, yasaklama_nedeni }
 */
export async function createYasaklamaBildirimi(yukleniciId, yasakBilgisi) {
  try {
    await query(
      `INSERT INTO yuklenici_bildirimler (yuklenici_id, tip, baslik, icerik, meta)
       VALUES ($1, 'yasaklama', $2, $3, $4)`,
      [
        yukleniciId,
        'Firma yasaklılar listesinde tespit edildi!',
        `Yasaklama Tarihi: ${yasakBilgisi.yasaklama_tarihi || 'Bilinmiyor'}\nSüre: ${yasakBilgisi.yasaklama_suresi || 'Bilinmiyor'}\nNeden: ${yasakBilgisi.yasaklama_nedeni || 'Belirtilmemiş'}`,
        JSON.stringify(yasakBilgisi),
      ]
    );
    logAPI(MODULE_NAME, { yukleniciId, tip: 'yasaklama', basarili: true });
  } catch (error) {
    logError(MODULE_NAME, error);
  }
}
