'use client';

/**
 * PDF İstihbarat Raporu Çıktısı
 * ─────────────────────────────
 * Yüklenicinin tüm istihbarat verilerini derleyerek yazdırılabilir
 * bir HTML raporu oluşturur ve tarayıcının yazdırma iletişim kutusunu açar.
 * Kullanıcı buradan PDF olarak kaydedebilir.
 */

import { Button } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconFileTypePdf } from '@tabler/icons-react';
import { useCallback, useState } from 'react';
import { getApiUrl } from '@/lib/config';

interface Props {
  yukleniciId: number;
  yukleniciAdi: string;
}

interface ModulVerisi {
  modul: string;
  durum: string;
  son_guncelleme: string | null;
  veri: Record<string, unknown>;
}

export function PdfRaporButonu({ yukleniciId, yukleniciAdi }: Props) {
  const [hazirlaniyor, setHazirlaniyor] = useState(false);

  const raporOlustur = useCallback(async () => {
    setHazirlaniyor(true);
    try {
      // Tüm modüllerin verilerini çek
      const res = await fetch(getApiUrl(`/contractors/${yukleniciId}/istihbarat`), {
        credentials: 'include',
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Veri çekilemedi');

      const moduller: ModulVerisi[] = json.data.moduller;

      // Her modül için detay verisini çek
      const detaylar: Record<string, Record<string, unknown>> = {};
      for (const m of moduller) {
        if (m.durum === 'tamamlandi') {
          try {
            const vRes = await fetch(
              getApiUrl(`/contractors/${yukleniciId}/modul/${m.modul}/veri`),
              {
                credentials: 'include',
              }
            );
            const vJson = await vRes.json();
            if (vJson.success) {
              detaylar[m.modul] = vJson.data;
            }
          } catch {
            /* sessiz */
          }
        }
      }

      // Fiyat tahmini çek
      let fiyatTahmin: Record<string, unknown> | null = null;
      try {
        const ftRes = await fetch(getApiUrl(`/contractors/${yukleniciId}/fiyat-tahmin`), {
          credentials: 'include',
        });
        const ftJson = await ftRes.json();
        if (ftJson.success) fiyatTahmin = ftJson.data;
      } catch {
        /* sessiz */
      }

      // HTML raporu oluştur
      const html = buildRaporHTML(yukleniciAdi, moduller, detaylar, fiyatTahmin);

      // Yeni pencerede aç ve yazdır
      const raporPencere = window.open('', '_blank', 'width=800,height=600');
      if (!raporPencere) {
        notifications.show({
          title: 'Hata',
          message: 'Popup engelleyici aktif. Lütfen izin verin.',
          color: 'red',
        });
        return;
      }

      raporPencere.document.write(html);
      raporPencere.document.close();

      // Kısa bekleme sonrası yazdırma dialogunu aç
      setTimeout(() => {
        raporPencere.print();
      }, 500);

      notifications.show({
        title: 'Rapor Hazır',
        message: 'Yazdırma penceresinden PDF olarak kaydedin',
        color: 'green',
      });
    } catch (err) {
      console.error('PDF rapor hatası:', err);
      notifications.show({
        title: 'Hata',
        message: err instanceof Error ? err.message : 'Rapor oluşturulamadı',
        color: 'red',
      });
    } finally {
      setHazirlaniyor(false);
    }
  }, [yukleniciId, yukleniciAdi]);

  if (hazirlaniyor) {
    return (
      <Button variant="light" color="red" loading>
        Rapor Hazırlanıyor...
      </Button>
    );
  }

  return (
    <Button
      variant="light"
      color="red"
      leftSection={<IconFileTypePdf size={16} />}
      onClick={raporOlustur}
    >
      PDF Rapor
    </Button>
  );
}

// ─── HTML Rapor Şablonu ──────────────────────────────────────────

function buildRaporHTML(
  firmaAdi: string,
  moduller: ModulVerisi[],
  detaylar: Record<string, Record<string, unknown>>,
  fiyatTahmin: Record<string, unknown> | null
): string {
  const tarih = new Date().toLocaleDateString('tr-TR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const tamamlanan = moduller.filter((m) => m.durum === 'tamamlandi').length;

  // Modül bölümlerini oluştur
  const bolumler = moduller
    .filter((m) => m.durum === 'tamamlandi' && detaylar[m.modul])
    .map((m) => {
      const veri = detaylar[m.modul];
      return renderModulBolum(m.modul, veri, m.son_guncelleme);
    })
    .join('');

  // Fiyat tahmini bölümü
  const fiyatBolum =
    fiyatTahmin && (fiyatTahmin as Record<string, unknown>).yeterli_veri
      ? renderFiyatTahmin(fiyatTahmin)
      : '';

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>İstihbarat Raporu — ${escapeHtml(firmaAdi)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; padding: 30px; line-height: 1.5; }
    .header { text-align: center; border-bottom: 3px solid #1c7ed6; padding-bottom: 15px; margin-bottom: 25px; }
    .header h1 { font-size: 22px; color: #1c7ed6; letter-spacing: 0.05em; }
    .header .subtitle { font-size: 16px; color: #555; margin-top: 4px; font-weight: 600; }
    .meta { display: flex; justify-content: space-between; font-size: 12px; color: #888; margin-bottom: 20px; padding: 8px 12px; background: #f8f9fa; border-radius: 6px; }
    .section { margin-bottom: 24px; page-break-inside: avoid; }
    .section h2 { font-size: 15px; color: #1c7ed6; border-bottom: 2px solid #e7f5ff; padding-bottom: 6px; margin-bottom: 12px; }
    .section h3 { font-size: 12px; color: #495057; margin-bottom: 6px; margin-top: 14px; text-transform: uppercase; letter-spacing: 0.03em; border-left: 3px solid #1c7ed6; padding-left: 8px; }
    .section p, .section li { font-size: 11px; line-height: 1.6; }
    ul { padding-left: 18px; margin-top: 4px; }
    li { margin-bottom: 3px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10px; }
    th, td { border: 1px solid #dee2e6; padding: 4px 6px; text-align: left; vertical-align: top; }
    th { background: #f1f3f5; font-weight: 600; color: #495057; white-space: nowrap; }
    td { word-break: break-word; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 9px; font-weight: 700; letter-spacing: 0.02em; }
    .badge-green { background: #d3f9d8; color: #2b8a3e; }
    .badge-red { background: #ffe3e3; color: #c92a2a; }
    .badge-blue { background: #d0ebff; color: #1864ab; }
    .badge-orange { background: #fff3bf; color: #e67700; }
    .footer { text-align: center; font-size: 10px; color: #aaa; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px; }
    @media print {
      body { padding: 15px; font-size: 10px; }
      .section { page-break-inside: avoid; }
      table { font-size: 9px; }
      th, td { padding: 3px 5px; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>YÜKLENİCİ İSTİHBARAT RAPORU</h1>
    <div class="subtitle">${escapeHtml(firmaAdi)}</div>
  </div>

  <div class="meta">
    <span>Rapor Tarihi: ${tarih}</span>
    <span>Tamamlanan Modül: ${tamamlanan}/${moduller.length}</span>
  </div>

  ${bolumler}
  ${fiyatBolum}

  <div class="footer">
    Bu rapor Catering Pro İstihbarat Merkezi tarafından otomatik oluşturulmuştur. — ${tarih}
  </div>
</body>
</html>`;
}

function renderModulBolum(
  modul: string,
  veri: Record<string, unknown>,
  sonGuncelleme: string | null
): string {
  const baslik = MODUL_BASLIKLAR[modul] || modul;
  const tarih = sonGuncelleme ? new Date(sonGuncelleme).toLocaleDateString('tr-TR') : '';

  let icerik = '';

  switch (modul) {
    // ─── İhale Geçmişi ───────────────────────────────────────────
    case 'ihale_gecmisi': {
      const ihaleler = (veri.ihaleler as Array<Record<string, unknown>>) || [];
      const toplam = (veri.toplam as number) || ihaleler.length;
      icerik = `<p>Toplam <strong>${toplam}</strong> ihale kaydı</p>`;
      if (ihaleler.length > 0) {
        icerik +=
          '<table><tr><th>İhale</th><th>Kurum</th><th>Şehir</th><th>Durum</th><th>Sözleşme Bedeli</th><th>Yaklaşık Maliyet</th><th>İndirim</th><th>Teklif</th><th>Tarih</th></tr>';
        ihaleler.slice(0, 30).forEach((i) => {
          const fesih =
            i.fesih_durumu && i.fesih_durumu !== 'yok'
              ? ` <span class="badge badge-red">Fesih</span>`
              : '';
          icerik += `<tr>
            <td>${escapeHtml(String(i.ihale_basligi || i.ihale_adi || '-'))}${fesih}</td>
            <td>${escapeHtml(String(i.kurum_adi || '-'))}</td>
            <td>${escapeHtml(String(i.sehir || '-'))}</td>
            <td><span class="badge badge-${i.durum === 'tamamlandi' ? 'green' : i.durum === 'iptal' ? 'red' : 'blue'}">${escapeHtml(String(i.durum || '-'))}</span></td>
            <td>${formatNum(i.sozlesme_bedeli as number)}</td>
            <td>${formatNum(i.yaklasik_maliyet as number)}</td>
            <td>${i.indirim_orani ? `%${Number(i.indirim_orani).toFixed(1)}` : '-'}</td>
            <td>${i.gecerli_teklif_sayisi || i.toplam_teklif_sayisi || '-'}</td>
            <td>${i.sozlesme_tarihi ? new Date(i.sozlesme_tarihi as string).toLocaleDateString('tr-TR') : '-'}</td>
          </tr>`;
        });
        icerik += '</table>';
        if (ihaleler.length > 30) {
          icerik += `<p style="text-align:center;color:#888;font-size:11px;">+${ihaleler.length - 30} daha...</p>`;
        }
      }
      break;
    }

    // ─── Profil Analizi ──────────────────────────────────────────
    case 'profil_analizi': {
      const analiz = (veri.analiz as Record<string, unknown>) || {};
      const ozet = analiz.ozet as Record<string, unknown> | undefined;
      const yillikTrend = (analiz.yillik_trend as Array<Record<string, unknown>>) || [];
      const rakipler = (analiz.rakipler as Array<Record<string, unknown>>) || [];
      const idareler = (analiz.idareler as Array<Record<string, unknown>>) || [];
      const sektorler = (analiz.sektorler as Array<Record<string, unknown>>) || [];
      const aktifSehirler = (veri.aktif_sehirler as string[]) || [];

      // Özet istatistikler
      if (ozet) {
        const toplam = ozet.toplam_sozlesme as Record<string, unknown> | undefined;
        const tenzilat = ozet.ort_tenzilat as Record<string, unknown> | undefined;
        const devamEden = ozet.devam_eden as Record<string, unknown> | undefined;
        const tamamlanan = ozet.tamamlanan as Record<string, unknown> | undefined;
        const yillik = ozet.yillik_ortalama as Record<string, unknown> | undefined;
        const isBitirme = ozet.is_bitirme_5yil as Record<string, unknown> | undefined;

        icerik += '<h3>Özet İstatistikler</h3><table><tr>';
        const kartlar: [string, string][] = [];
        if (ozet.gecmis_ihale) kartlar.push(['Toplam İhale', String(ozet.gecmis_ihale)]);
        if (ozet.aktif_ihale) kartlar.push(['Aktif İhale', String(ozet.aktif_ihale)]);
        if (tamamlanan?.sayi) kartlar.push(['Tamamlanan', String(tamamlanan.sayi)]);
        if (devamEden?.sayi) kartlar.push(['Devam Eden', String(devamEden.sayi)]);
        if (toplam?.tutar) kartlar.push(['Toplam Sözleşme', formatNum(toplam.tutar as number)]);
        if (yillik?.tutar) kartlar.push(['Yıllık Ortalama', formatNum(yillik.tutar as number)]);
        if (isBitirme?.tutar)
          kartlar.push(['İş Bitirme (5 Yıl)', formatNum(isBitirme.tutar as number)]);
        if (tenzilat?.yuzde) kartlar.push(['Ort. Tenzilat', `%${tenzilat.yuzde}`]);
        if (ozet.ort_sozlesme_suresi_gun)
          kartlar.push(['Ort. Süre', `${ozet.ort_sozlesme_suresi_gun} gün`]);
        if (ozet.ilk_sozlesme) kartlar.push(['İlk Sözleşme', String(ozet.ilk_sozlesme)]);
        if (ozet.son_sozlesme) kartlar.push(['Son Sözleşme', String(ozet.son_sozlesme)]);

        kartlar.forEach(([k]) => {
          icerik += `<th>${escapeHtml(k)}</th>`;
        });
        icerik += '</tr><tr>';
        kartlar.forEach(([, v]) => {
          icerik += `<td><strong>${escapeHtml(v)}</strong></td>`;
        });
        icerik += '</tr></table>';
      }

      // Yıllık trend
      if (yillikTrend.length > 0) {
        icerik +=
          '<h3>Yıllık Performans</h3><table><tr><th>Yıl</th><th>Tamamlanan</th><th>Devam Eden</th><th>Toplam Sözleşme</th><th>Tenzilat</th></tr>';
        yillikTrend.forEach((t) => {
          icerik += `<tr>
            <td><strong>${escapeHtml(String(t.yil))}</strong></td>
            <td>${(t.tamamlanan as number) || 0}</td>
            <td>${(t.devam_eden as number) || 0}</td>
            <td>${t.toplam_sozlesme ? formatNum(t.toplam_sozlesme as number) : '-'}</td>
            <td>${t.tenzilat_yuzde ? `%${(t.tenzilat_yuzde as number).toFixed(1)}` : '-'}</td>
          </tr>`;
        });
        icerik += '</table>';
      }

      // En sık rakipler
      if (rakipler.length > 0) {
        icerik +=
          '<h3>En Sık Karşılaşılan Rakipler</h3><table><tr><th>Firma</th><th>İhale Sayısı</th><th>Toplam Sözleşme</th></tr>';
        rakipler.slice(0, 10).forEach((r) => {
          icerik += `<tr>
            <td>${escapeHtml(String(r.rakip_adi || '-'))}</td>
            <td>${r.ihale_sayisi || '-'}</td>
            <td>${r.toplam_sozlesme ? formatNum(r.toplam_sozlesme as number) : '-'}</td>
          </tr>`;
        });
        icerik += '</table>';
      }

      // İdareler
      if (idareler.length > 0) {
        icerik +=
          '<h3>En Çok Çalışılan İdareler</h3><table><tr><th>İdare</th><th>İhale Sayısı</th><th>Toplam Sözleşme</th></tr>';
        idareler.slice(0, 8).forEach((d) => {
          const ihaleSayisi = ((d.tamamlanan as number) || 0) + ((d.devam_eden as number) || 0);
          icerik += `<tr>
            <td>${escapeHtml(String(d.idare_adi || '-'))}</td>
            <td>${ihaleSayisi}</td>
            <td>${d.toplam_sozlesme ? formatNum(d.toplam_sozlesme as number) : '-'}</td>
          </tr>`;
        });
        icerik += '</table>';
      }

      // Sektörler
      if (sektorler.length > 0) {
        icerik +=
          '<h3>Sektör Dağılımı</h3><table><tr><th>Sektör</th><th>İhale Sayısı</th><th>Toplam Sözleşme</th></tr>';
        sektorler.slice(0, 6).forEach((s) => {
          const ihaleSayisi = ((s.tamamlanan as number) || 0) + ((s.devam_eden as number) || 0);
          icerik += `<tr>
            <td>${escapeHtml(String(s.sektor_adi || '-'))}</td>
            <td>${ihaleSayisi}</td>
            <td>${s.toplam_sozlesme ? formatNum(s.toplam_sozlesme as number) : '-'}</td>
          </tr>`;
        });
        icerik += '</table>';
      }

      // Aktif şehirler
      if (aktifSehirler.length > 0) {
        icerik += `<h3>Aktif Şehirler (${aktifSehirler.length})</h3><p>`;
        aktifSehirler.forEach((s) => {
          icerik += `<span class="badge badge-blue">${escapeHtml(s)}</span> `;
        });
        icerik += '</p>';
      }

      if (!icerik) icerik = '<p>Analiz verisi henüz yok.</p>';
      break;
    }

    // ─── Katılımcılar ────────────────────────────────────────────
    case 'katilimcilar': {
      const katilimcilar = (veri.katilimcilar as Array<Record<string, unknown>>) || [];
      if (katilimcilar.length === 0) {
        icerik = '<p>Katılımcı verisi bulunamadı.</p>';
      } else {
        icerik = `<p><strong>${katilimcilar.length}</strong> katılımcı kaydı</p>`;
        icerik += '<table><tr><th>İhale</th><th>Şehir</th><th>Sözleşme Bedeli</th></tr>';
        katilimcilar.slice(0, 25).forEach((k) => {
          icerik += `<tr>
            <td>${escapeHtml(String(k.ihale_basligi || k.ihale_adi || '-'))}</td>
            <td>${escapeHtml(String(k.sehir || '-'))}</td>
            <td>${formatNum(k.sozlesme_bedeli as number)}</td>
          </tr>`;
        });
        icerik += '</table>';
        if (katilimcilar.length > 25) {
          icerik += `<p style="text-align:center;color:#888;font-size:11px;">+${katilimcilar.length - 25} daha...</p>`;
        }
      }
      break;
    }

    // ─── KİK Kararları ───────────────────────────────────────────
    case 'kik_kararlari': {
      const kararlar = (veri.kararlar as Array<Record<string, unknown>>) || [];
      if (kararlar.length === 0) {
        icerik =
          '<p class="badge badge-green">KİK kararı bulunamadı — bu olumlu bir işaret olabilir.</p>';
      } else {
        icerik = `<p><strong>${kararlar.length}</strong> KİK kararı bulundu</p>`;
        icerik +=
          '<table><tr><th>İhale</th><th>Kurum</th><th>Şehir</th><th>Bedel</th><th>Tarih</th></tr>';
        kararlar.forEach((k) => {
          const kararTarih = (k.sozlesme_tarihi || k.created_at) as string | undefined;
          icerik += `<tr>
            <td>${escapeHtml(String(k.ihale_basligi || k.ihale_adi || '-'))}</td>
            <td>${escapeHtml(String(k.kurum_adi || '-'))}</td>
            <td>${escapeHtml(String(k.sehir || '-'))}</td>
            <td>${formatNum(k.sozlesme_bedeli as number)}</td>
            <td>${kararTarih ? new Date(kararTarih).toLocaleDateString('tr-TR') : '-'}</td>
          </tr>`;
        });
        icerik += '</table>';
      }
      break;
    }

    // ─── KİK Yasaklılar ─────────────────────────────────────────
    case 'kik_yasaklilar': {
      const yasakliMi = veri.yasakli_mi as boolean;
      const sonuclar = (veri.sonuclar as Array<Record<string, string>>) || [];
      const not = veri.not as string | undefined;

      if (yasakliMi) {
        icerik = `<p class="badge badge-red">DİKKAT: YASAKLI FİRMA — ${sonuclar.length} kayıt tespit edildi</p>`;
        if (sonuclar.length > 0) {
          icerik +=
            '<table><tr><th>Firma</th><th>Yasaklama Tarihi</th><th>Süre</th><th>Neden</th></tr>';
          sonuclar.forEach((s) => {
            icerik += `<tr>
              <td>${escapeHtml(s.firma_adi || '-')}</td>
              <td>${escapeHtml(s.yasaklama_tarihi || '-')}</td>
              <td>${escapeHtml(s.yasaklama_suresi || '-')}</td>
              <td>${escapeHtml(s.yasaklama_nedeni || '-')}</td>
            </tr>`;
          });
          icerik += '</table>';
        }
      } else {
        icerik =
          '<p class="badge badge-green">Yasaklı değil — EKAP yasaklılar listesinde bulunamadı.</p>';
      }
      if (not) icerik += `<p style="font-size:11px;color:#888;">${escapeHtml(not)}</p>`;
      break;
    }

    // ─── Şirket Bilgileri ────────────────────────────────────────
    case 'sirket_bilgileri': {
      const mersis = veri.mersis as Record<string, unknown> | undefined;
      const ticaretSicil = veri.ticaret_sicil as Record<string, unknown> | undefined;

      // MERSİS
      icerik += '<h3>MERSİS — Merkezi Sicil Kayıt Sistemi</h3>';
      if (mersis?.basarili) {
        icerik += '<table>';
        Object.entries(mersis)
          .filter(([key]) => !['basarili', 'not'].includes(key))
          .forEach(([key, value]) => {
            icerik += `<tr><td style="width:35%;color:#666;text-transform:capitalize;">${escapeHtml(key.replace(/_/g, ' '))}</td><td><strong>${escapeHtml(String(value))}</strong></td></tr>`;
          });
        icerik += '</table>';
      } else {
        icerik += `<p style="color:#888;">${escapeHtml((mersis?.not as string) || 'MERSİS verisi alınamadı.')}</p>`;
      }

      // Ticaret Sicil Gazetesi
      icerik += '<h3>Ticaret Sicil Gazetesi İlanları</h3>';
      if (ticaretSicil?.basarili && (ticaretSicil.ilanlar as unknown[])?.length > 0) {
        const ilanlar = ticaretSicil.ilanlar as Array<Record<string, string>>;
        icerik += '<table><tr><th>Tarih</th><th>Tür</th><th>Özet</th></tr>';
        ilanlar.forEach((ilan) => {
          icerik += `<tr>
            <td>${escapeHtml(ilan.ilan_tarihi || '-')}</td>
            <td>${escapeHtml(ilan.ilan_turu || '-')}</td>
            <td>${escapeHtml(ilan.ozet || '-')}</td>
          </tr>`;
        });
        icerik += '</table>';
      } else {
        icerik += `<p style="color:#888;">${escapeHtml((ticaretSicil?.not as string) || 'Ticaret Sicil Gazetesi ilanı bulunamadı.')}</p>`;
      }
      break;
    }

    // ─── Haberler ────────────────────────────────────────────────
    case 'haberler': {
      const hb = (veri.haberler as Array<Record<string, unknown>>) || [];
      const toplam = (veri.toplam as number) || hb.length;
      const aramaMetni = veri.arama_metni as string | undefined;

      if (hb.length === 0) {
        icerik = '<p>Haber bulunamadı.</p>';
      } else {
        icerik = `<p><strong>${toplam}</strong> haber bulundu${aramaMetni ? ` — "${escapeHtml(aramaMetni)}"` : ''}</p>`;
        icerik +=
          '<table><tr><th style="width:45%;">Başlık</th><th>Özet</th><th>Kaynak</th><th>Tarih</th></tr>';
        hb.slice(0, 15).forEach((h) => {
          const ozetText = h.ozet ? stripHtmlTags(String(h.ozet)) : '';
          icerik += `<tr>
            <td><strong>${escapeHtml(String(h.baslik || '-'))}</strong></td>
            <td>${escapeHtml(ozetText.slice(0, 150))}${ozetText.length > 150 ? '...' : ''}</td>
            <td>${escapeHtml(String(h.kaynak || '-'))}</td>
            <td>${escapeHtml(String(h.tarih_okunur || '-'))}</td>
          </tr>`;
        });
        icerik += '</table>';
      }
      break;
    }

    // ─── AI İstihbarat Raporu ────────────────────────────────────
    case 'ai_arastirma': {
      const rapor = veri.rapor as Record<string, unknown> | undefined;
      const hamMetin = veri.ham_metin as string | undefined;

      if (!rapor && hamMetin) {
        // Ham metin varsa göster
        icerik = `<p style="white-space:pre-line;">${escapeHtml(hamMetin)}</p>`;
        break;
      }
      if (!rapor) {
        icerik = '<p>AI raporu henüz oluşturulmamış.</p>';
        break;
      }

      const tehlikeSeviyesi =
        (rapor.tehlike_seviyesi as string) || (rapor.risk_seviyesi as string) || 'orta';
      const tehlikeRenk =
        tehlikeSeviyesi === 'çok yüksek' || tehlikeSeviyesi === 'yüksek'
          ? 'red'
          : tehlikeSeviyesi === 'düşük'
            ? 'green'
            : 'orange';

      icerik += `<p><strong>Tehlike Seviyesi:</strong> <span class="badge badge-${tehlikeRenk}">${escapeHtml(tehlikeSeviyesi.toUpperCase())}</span></p>`;

      // Yeni format (İstihbarat Briefing)
      const eskiFormat = !!(rapor.genel_degerlendirme || rapor.guclu_yonler);

      if (eskiFormat) {
        // Eski SWOT formatı
        if (rapor.genel_degerlendirme)
          icerik += `<h3>Genel Değerlendirme</h3><p style="white-space:pre-line;">${escapeHtml(String(rapor.genel_degerlendirme))}</p>`;

        const guclu = (rapor.guclu_yonler as string[]) || [];
        const zayif = (rapor.zayif_yonler as string[]) || [];
        const firsatlar = (rapor.firsatlar as string[]) || [];
        const tehditler = (rapor.tehditler as string[]) || [];

        if (guclu.length) {
          icerik += '<h3>Güçlü Yönler</h3><ul>';
          guclu.forEach((g) => {
            icerik += `<li>${escapeHtml(g)}</li>`;
          });
          icerik += '</ul>';
        }
        if (zayif.length) {
          icerik += '<h3>Zayıf Yönler</h3><ul>';
          zayif.forEach((z) => {
            icerik += `<li>${escapeHtml(z)}</li>`;
          });
          icerik += '</ul>';
        }
        if (firsatlar.length) {
          icerik += '<h3>Fırsatlar</h3><ul>';
          firsatlar.forEach((f) => {
            icerik += `<li>${escapeHtml(f)}</li>`;
          });
          icerik += '</ul>';
        }
        if (tehditler.length) {
          icerik += '<h3>Tehditler</h3><ul>';
          tehditler.forEach((t) => {
            icerik += `<li>${escapeHtml(t)}</li>`;
          });
          icerik += '</ul>';
        }
        if (rapor.rekabet_stratejisi)
          icerik += `<h3>Rekabet Stratejisi</h3><p style="white-space:pre-line;">${escapeHtml(String(rapor.rekabet_stratejisi))}</p>`;

        const tavsiyeler = (rapor.tavsiyeler as string[]) || [];
        if (tavsiyeler.length) {
          icerik += '<h3>Tavsiyeler</h3><ul>';
          tavsiyeler.forEach((t) => {
            icerik += `<li>${escapeHtml(t)}</li>`;
          });
          icerik += '</ul>';
        }
      } else {
        // Yeni format — İstihbarat Briefing
        const tamMetin = rapor.tam_metin as string;

        if (tamMetin) {
          // Markdown tam metin — basit dönüşüm
          icerik += `<div style="white-space:pre-line;font-size:12px;">${escapeHtml(tamMetin)}</div>`;
        } else {
          if (rapor.ozet_profil)
            icerik += `<h3>Özet Profil</h3><p style="white-space:pre-line;">${escapeHtml(String(rapor.ozet_profil))}</p>`;
          if (rapor.tehlike_gerekce)
            icerik += `<p style="font-style:italic;color:#888;">${escapeHtml(String(rapor.tehlike_gerekce))}</p>`;
          if (rapor.faaliyet_alani)
            icerik += `<h3>Faaliyet Alanı</h3><p style="white-space:pre-line;">${escapeHtml(String(rapor.faaliyet_alani))}</p>`;
          if (rapor.ihale_davranisi)
            icerik += `<h3>İhale Davranışı</h3><p style="white-space:pre-line;">${escapeHtml(String(rapor.ihale_davranisi))}</p>`;
          if (rapor.risk_sinyalleri)
            icerik += `<h3>Risk Sinyalleri</h3><p style="white-space:pre-line;">${escapeHtml(String(rapor.risk_sinyalleri))}</p>`;
          if (rapor.rakip_agi)
            icerik += `<h3>Rakip Ağı</h3><p style="white-space:pre-line;">${escapeHtml(String(rapor.rakip_agi))}</p>`;

          const tavsiyeler = (rapor.stratejik_tavsiyeler as string[]) || [];
          if (tavsiyeler.length) {
            icerik += '<h3>Stratejik Tavsiyeler</h3><ul>';
            tavsiyeler.forEach((t) => {
              icerik += `<li>${escapeHtml(t)}</li>`;
            });
            icerik += '</ul>';
          }
        }
      }

      if (veri.olusturulma_tarihi) {
        icerik += `<p style="font-size:10px;color:#aaa;text-align:right;">Oluşturulma: ${new Date(veri.olusturulma_tarihi as string).toLocaleString('tr-TR')}</p>`;
      }
      break;
    }

    default:
      icerik = '<p>Detay verisi mevcut.</p>';
  }

  return `
  <div class="section">
    <h2>${escapeHtml(baslik)} ${tarih ? `<span style="font-size:11px;color:#999;font-weight:normal;">— Son güncelleme: ${tarih}</span>` : ''}</h2>
    ${icerik}
  </div>`;
}

function renderFiyatTahmin(veri: Record<string, unknown>): string {
  return `
  <div class="section">
    <h2>Fiyat Tahmin Analizi</h2>
    <table>
      <tr><th>Toplam İhale</th><th>Ort. İndirim</th><th>Medyan İndirim</th><th>Min / Max</th><th>Trend</th></tr>
      <tr>
        <td>${veri.toplam_ihale || '-'}</td>
        <td>%${veri.ortalama_indirim || '-'}</td>
        <td>%${veri.medyan_indirim || '-'}</td>
        <td>%${veri.min_indirim || '-'} — %${veri.max_indirim || '-'}</td>
        <td>${veri.trend === 'artiyor' ? 'Artıyor ↑' : veri.trend === 'azaliyor' ? 'Azalıyor ↓' : 'Sabit →'}</td>
      </tr>
    </table>
  </div>`;
}

// ─── Yardımcılar ─────────────────────────────────────────────────

const MODUL_BASLIKLAR: Record<string, string> = {
  ihale_gecmisi: 'İhale Geçmişi',
  profil_analizi: 'Profil Analizi — Yıllık Trend, Rakipler, İdareler, Sektörler',
  katilimcilar: 'Katılımcı Bilgileri',
  kik_kararlari: 'KİK Kararları — Şikayet & İtiraz',
  kik_yasaklilar: 'EKAP Yasaklı Sorgusu',
  sirket_bilgileri: 'Şirket Kimliği — MERSİS & Ticaret Sicil Gazetesi',
  haberler: 'Güncel Haberler — Medya Taraması',
  ai_arastirma: 'AI İstihbarat Raporu — Tehlike Analizi',
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function formatNum(val: number | null | undefined): string {
  if (!val) return '-';
  return `${val.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} TL`;
}
