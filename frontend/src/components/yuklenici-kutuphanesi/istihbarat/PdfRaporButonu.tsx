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
            const vRes = await fetch(getApiUrl(`/contractors/${yukleniciId}/modul/${m.modul}/veri`), {
              credentials: 'include',
            });
            const vJson = await vRes.json();
            if (vJson.success) {
              detaylar[m.modul] = vJson.data;
            }
          } catch { /* sessiz */ }
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
      } catch { /* sessiz */ }

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
  fiyatTahmin: Record<string, unknown> | null,
): string {
  const tarih = new Date().toLocaleDateString('tr-TR', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const tamamlanan = moduller.filter(m => m.durum === 'tamamlandi').length;

  // Modül bölümlerini oluştur
  const bolumler = moduller
    .filter(m => m.durum === 'tamamlandi' && detaylar[m.modul])
    .map(m => {
      const veri = detaylar[m.modul];
      return renderModulBolum(m.modul, veri, m.son_guncelleme);
    })
    .join('');

  // Fiyat tahmini bölümü
  const fiyatBolum = fiyatTahmin && (fiyatTahmin as Record<string, unknown>).yeterli_veri
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
    .header h1 { font-size: 22px; color: #1c7ed6; }
    .header .subtitle { font-size: 14px; color: #666; margin-top: 4px; }
    .meta { display: flex; justify-content: space-between; font-size: 12px; color: #888; margin-bottom: 20px; }
    .section { margin-bottom: 20px; page-break-inside: avoid; }
    .section h2 { font-size: 16px; color: #1c7ed6; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 10px; }
    .section h3 { font-size: 13px; color: #555; margin-bottom: 6px; }
    .section p, .section li { font-size: 12px; }
    ul { padding-left: 18px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
    th, td { border: 1px solid #ddd; padding: 5px 8px; text-align: left; }
    th { background: #f5f5f5; font-weight: 600; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; }
    .badge-green { background: #d3f9d8; color: #2b8a3e; }
    .badge-red { background: #ffe3e3; color: #c92a2a; }
    .badge-blue { background: #d0ebff; color: #1864ab; }
    .badge-orange { background: #fff3bf; color: #e67700; }
    .footer { text-align: center; font-size: 10px; color: #aaa; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px; }
    @media print {
      body { padding: 15px; }
      .section { page-break-inside: avoid; }
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

function renderModulBolum(modul: string, veri: Record<string, unknown>, sonGuncelleme: string | null): string {
  const baslik = MODUL_BASLIKLAR[modul] || modul;
  const tarih = sonGuncelleme ? new Date(sonGuncelleme).toLocaleDateString('tr-TR') : '';

  let icerik = '';

  switch (modul) {
    case 'ihale_gecmisi': {
      const ihaleler = (veri.ihaleler as Array<Record<string, unknown>>) || [];
      icerik = `<p>Toplam ${(veri.toplam as number) || ihaleler.length} ihale kaydı</p>`;
      if (ihaleler.length > 0) {
        icerik += '<table><tr><th>İhale</th><th>Şehir</th><th>Durum</th><th>Bedel</th></tr>';
        ihaleler.slice(0, 15).forEach(i => {
          icerik += `<tr>
            <td>${escapeHtml(String(i.ihale_basligi || i.ihale_adi || '-'))}</td>
            <td>${escapeHtml(String(i.sehir || '-'))}</td>
            <td>${escapeHtml(String(i.durum || '-'))}</td>
            <td>${formatNum(i.sozlesme_bedeli as number)}</td>
          </tr>`;
        });
        icerik += '</table>';
      }
      break;
    }
    case 'profil_analizi': {
      const analiz = (veri.analiz as Record<string, unknown>) || veri;
      if (analiz.ozet) icerik += `<p>${escapeHtml(String(analiz.ozet))}</p>`;
      break;
    }
    case 'kik_yasaklilar': {
      const yd = veri as Record<string, unknown>;
      if (yd.yasakli) {
        icerik = `<p class="badge badge-red">YASAKLI</p><p>Süre: ${escapeHtml(String(yd.sure || '-'))}</p><p>Neden: ${escapeHtml(String(yd.neden || '-'))}</p>`;
      } else {
        icerik = '<p class="badge badge-green">Yasaklı değil</p>';
      }
      break;
    }
    case 'sirket_bilgileri': {
      const sb = veri as Record<string, unknown>;
      const mersis = (sb.mersis as Record<string, unknown>) || {};
      if (mersis.firma_adi) icerik += `<p><strong>Firma:</strong> ${escapeHtml(String(mersis.firma_adi))}</p>`;
      if (mersis.merkez_adresi) icerik += `<p><strong>Adres:</strong> ${escapeHtml(String(mersis.merkez_adresi))}</p>`;
      if (mersis.sermaye) icerik += `<p><strong>Sermaye:</strong> ${escapeHtml(String(mersis.sermaye))}</p>`;
      break;
    }
    case 'haberler': {
      const hb = (veri.haberler as Array<Record<string, unknown>>) || [];
      if (hb.length > 0) {
        icerik = '<ul>';
        hb.slice(0, 10).forEach(h => {
          icerik += `<li>${escapeHtml(String(h.baslik || ''))} — ${escapeHtml(String(h.kaynak || ''))}</li>`;
        });
        icerik += '</ul>';
      } else {
        icerik = '<p>Haber bulunamadı.</p>';
      }
      break;
    }
    case 'ai_arastirma': {
      const ai = veri as Record<string, unknown>;
      if (ai.risk_seviyesi) icerik += `<p><strong>Risk Seviyesi:</strong> <span class="badge badge-${ai.risk_seviyesi === 'yuksek' ? 'red' : ai.risk_seviyesi === 'orta' ? 'orange' : 'green'}">${escapeHtml(String(ai.risk_seviyesi))}</span></p>`;
      if (ai.ozet) icerik += `<p>${escapeHtml(String(ai.ozet))}</p>`;
      const guclu = (ai.guclu_yonler as string[]) || [];
      const zayif = (ai.zayif_yonler as string[]) || [];
      if (guclu.length) {
        icerik += '<h3>Güçlü Yönler</h3><ul>';
        guclu.forEach(g => { icerik += `<li>${escapeHtml(g)}</li>`; });
        icerik += '</ul>';
      }
      if (zayif.length) {
        icerik += '<h3>Zayıf Yönler</h3><ul>';
        zayif.forEach(z => { icerik += `<li>${escapeHtml(z)}</li>`; });
        icerik += '</ul>';
      }
      const oneriler = (ai.oneriler as string[]) || [];
      if (oneriler.length) {
        icerik += '<h3>Öneriler</h3><ul>';
        oneriler.forEach(o => { icerik += `<li>${escapeHtml(o)}</li>`; });
        icerik += '</ul>';
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
  profil_analizi: 'Profil Analizi',
  katilimcilar: 'Katılımcı Bilgileri',
  kik_kararlari: 'KİK Kararları',
  kik_yasaklilar: 'KİK Yasaklılar Sorgusu',
  sirket_bilgileri: 'Şirket Bilgileri (MERSİS & Ticaret Sicil)',
  haberler: 'Haberler',
  ai_arastirma: 'AI İstihbarat Raporu',
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatNum(val: number | null | undefined): string {
  if (!val) return '-';
  return val.toLocaleString('tr-TR', { maximumFractionDigits: 0 }) + ' TL';
}
