/**
 * İhale Rapor Ureticileri
 * 8 rapor: özet, analiz, cetvel, maliyet, KIK hesaplama, teminat/risk, toplu liste, dilekçe
 */

import { query } from '../../database.js';
import {
  createDilekcePDF,
  createExcel,
  createMultiSheetExcel,
  createPDF,
  createSectionedPDF,
} from '../export-service.js';
import { registerGenerator, registerReports } from '../report-registry.js';

// ── Yardımcı fonksiyonlar ──

function fmtPara(val) {
  if (val == null || val === '') return '-';
  return `${Number(val).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`;
}

function fmtTarih(val) {
  if (!val) return '-';
  try {
    return new Date(val).toLocaleDateString('tr-TR');
  } catch {
    return String(val);
  }
}

async function getTenderTracking(tenderId) {
  const result = await query(
    `SELECT tt.*, t.title as ihale_basligi, t.organization_name as kurum,
            t.tender_date as tarih, t.estimated_cost as bedel, t.city, t.external_id, t.url
     FROM tender_tracking tt
     JOIN tenders t ON t.id = tt.tender_id::integer
     WHERE tt.id = $1`,
    [tenderId]
  );
  return result.rows?.[0] || null;
}

async function getAllTrackedTenders(_userId) {
  const result = await query(
    `SELECT tt.*, t.title as ihale_basligi, t.organization_name as kurum,
            t.tender_date as tarih, t.estimated_cost as bedel, t.city, t.external_id, t.url,
            (SELECT COUNT(*) FROM documents d WHERE d.tender_id = tt.tender_id) as dokuman_sayisi
     FROM tender_tracking tt
     JOIN tenders t ON t.id = tt.tender_id::integer
     ORDER BY tt.created_at DESC`
  );
  return result.rows || [];
}

// ── 1. İhale Özet PDF ──

async function ozetPDF(ctx) {
  const tender = await getTenderTracking(ctx.tenderId);
  if (!tender) throw new Error('İhale bulunamadı');

  const analysis = tender.analysis_summary || {};

  const sections = [
    {
      title: 'Genel Bilgiler',
      keyValues: [
        { key: 'İhale Başlığı', value: tender.ihale_basligi },
        { key: 'Kurum', value: tender.kurum },
        { key: 'Tarih', value: fmtTarih(tender.tarih) },
        { key: 'Şehir', value: tender.city },
        { key: 'Yaklaşık Maliyet', value: fmtPara(tender.bedel || tender.yaklasik_maliyet) },
        { key: 'Süre', value: analysis.sure || tender.sure || '-' },
        { key: 'IKN', value: analysis.ikn || '-' },
        { key: 'İhale Türü', value: analysis.ihale_turu || '-' },
        { key: 'Durum', value: tender.status || '-' },
      ],
    },
  ];

  // Özet
  if (analysis.ozet) {
    sections.push({ title: 'AI Analiz Özeti', text: analysis.ozet });
  }

  // Hesaplama bilgileri
  if (tender.yaklasik_maliyet || tender.sinir_deger || tender.bizim_teklif) {
    sections.push({
      title: 'Hesaplama Bilgileri',
      keyValues: [
        { key: 'Yaklaşık Maliyet', value: fmtPara(tender.yaklasik_maliyet) },
        { key: 'Sınır Değer', value: fmtPara(tender.sinir_deger) },
        { key: 'Bizim Teklif', value: fmtPara(tender.bizim_teklif) },
      ],
    });
  }

  // Catering detayları
  if (analysis.kisi_sayisi || analysis.gunluk_ogun_sayisi) {
    sections.push({
      title: 'Catering Bilgileri',
      keyValues: [
        { key: 'Kişi Sayısı', value: analysis.kisi_sayisi || '-' },
        { key: 'Günlük Öğün', value: analysis.gunluk_ogun_sayisi || '-' },
        { key: 'Hizmet Gün Sayısı', value: analysis.hizmet_gun_sayisi || '-' },
        { key: 'Mutfak Tipi', value: analysis.mutfak_tipi || '-' },
        { key: 'Servis Tipi', value: analysis.servis_tipi || '-' },
      ].filter((kv) => kv.value !== '-'),
    });
  }

  // Önemli notlar
  if (analysis.onemli_notlar?.length) {
    sections.push({
      title: 'Önemli Notlar',
      headers: ['Tip', 'Not'],
      data: analysis.onemli_notlar.map((n) => ({ Tip: n.tip || n.type || '-', Not: n.not || n.text || '-' })),
    });
  }

  const buffer = await createSectionedPDF({
    title: 'İHALE ÖZET RAPORU',
    subtitle: `${tender.ihale_basligi} - ${tender.kurum}`,
    sections,
    footer: 'Catering Pro - İhale Merkezi',
  });

  return {
    buffer,
    filename: `ihale-ozet-${tender.id}-${Date.now()}.pdf`,
    contentType: 'application/pdf',
  };
}

// ── 2. AI Analiz PDF ──

async function analizPDF(ctx) {
  const tender = await getTenderTracking(ctx.tenderId);
  if (!tender) throw new Error('İhale bulunamadı');
  const a = tender.analysis_summary || {};

  const sections = [];

  // Teknik şartlar
  if (a.teknik_sartlar?.length) {
    sections.push({
      title: `Teknik Şartlar (${a.teknik_sartlar.length})`,
      headers: ['#', 'Şart', 'Zorunlu'],
      data: a.teknik_sartlar.map((s, i) => ({
        '#': i + 1,
        Şart: s.sart || s.text || s,
        Zorunlu: s.zorunlu ? 'Evet' : 'Hayır',
      })),
    });
  }

  // Birim fiyatlar
  if (a.birim_fiyatlar?.length) {
    sections.push({
      title: `Birim Fiyatlar (${a.birim_fiyatlar.length})`,
      headers: ['Kalem', 'Miktar', 'Birim', 'Fiyat'],
      data: a.birim_fiyatlar.map((b) => ({
        Kalem: b.kalem || b.aciklama || '-',
        Miktar: b.miktar ?? '-',
        Birim: b.birim || '-',
        Fiyat: b.fiyat ? fmtPara(b.fiyat) : '-',
      })),
    });
  }

  // Personel detayları
  if (a.personel_detaylari?.length) {
    sections.push({
      title: `Personel Gereksinimleri (${a.personel_detaylari.length})`,
      headers: ['Pozisyon', 'Adet', 'Ücret Oranı'],
      data: a.personel_detaylari.map((p) => ({
        Pozisyon: p.pozisyon || '-',
        Adet: p.adet ?? '-',
        'Ücret Oranı': p.ucret_orani || '-',
      })),
    });
  }

  // Öğün bilgileri
  if (a.ogun_bilgileri?.length) {
    sections.push({
      title: 'Öğün Bilgileri',
      headers: ['Öğün', 'Kişi Sayısı', 'Detay'],
      data: a.ogun_bilgileri.map((o) => ({
        Öğün: o.ogun || o.tur || '-',
        'Kişi Sayısı': o.kisi_sayisi ?? '-',
        Detay: o.detay || o.aciklama || '-',
      })),
    });
  }

  // Ceza koşulları
  if (a.ceza_kosullari?.length) {
    sections.push({
      title: `Ceza Koşulları (${a.ceza_kosullari.length})`,
      headers: ['Tür', 'Oran', 'Açıklama'],
      data: a.ceza_kosullari.map((c) => ({
        Tür: c.tur || '-',
        Oran: c.oran || '-',
        Açıklama: c.aciklama || '-',
      })),
    });
  }

  // Gerekli belgeler
  if (a.gerekli_belgeler?.length) {
    sections.push({
      title: 'Gerekli Belgeler',
      headers: ['Belge', 'Zorunlu', 'Puan'],
      data: a.gerekli_belgeler.map((b) => ({
        Belge: b.belge || b.ad || '-',
        Zorunlu: b.zorunlu ? 'Evet' : 'Hayır',
        Puan: b.puan ?? '-',
      })),
    });
  }

  // Mali kriterler
  if (a.mali_kriterler) {
    const mk = a.mali_kriterler;
    sections.push({
      title: 'Mali Kriterler',
      keyValues: [
        { key: 'Cari Oran', value: mk.cari_oran || '-' },
        { key: 'Özkaynak', value: mk.ozkaynak || '-' },
        { key: 'İş Deneyimi', value: mk.is_deneyimi || '-' },
        { key: 'Ciro', value: mk.ciro || '-' },
      ].filter((kv) => kv.value !== '-'),
    });
  }

  // Teminat oranları
  if (a.teminat_oranlari) {
    const to = a.teminat_oranlari;
    sections.push({
      title: 'Teminat Oranları',
      keyValues: [
        { key: 'Geçici Teminat', value: to.gecici ? `%${to.gecici}` : '-' },
        { key: 'Kesin Teminat', value: to.kesin ? `%${to.kesin}` : '-' },
        { key: 'Ek Kesin Teminat', value: to.ek_kesin ? `%${to.ek_kesin}` : '-' },
      ].filter((kv) => kv.value !== '-'),
    });
  }

  // Takvim
  if (a.takvim?.length) {
    sections.push({
      title: 'Takvim',
      headers: ['Olay', 'Tarih', 'Gün'],
      data: a.takvim.map((t) => ({
        Olay: t.olay || '-',
        Tarih: t.tarih || '-',
        Gün: t.gun ?? '-',
      })),
    });
  }

  if (sections.length === 0) {
    sections.push({ text: 'Bu ihale için henüz analiz verisi bulunmamaktadır.' });
  }

  const buffer = await createSectionedPDF({
    title: 'DÖKÜMAN ANALİZ RAPORU',
    subtitle: `${tender.ihale_basligi} - ${tender.kurum}`,
    sections,
    footer: 'Catering Pro - AI Döküman Analizi',
  });

  return {
    buffer,
    filename: `ihale-analiz-${tender.id}-${Date.now()}.pdf`,
    contentType: 'application/pdf',
  };
}

// ── 3. Birim Fiyat Cetveli Excel/PDF ──

async function cetvelExcel(ctx) {
  const tender = await getTenderTracking(ctx.tenderId);
  if (!tender) throw new Error('İhale bulunamadı');

  const hesaplama = tender.hesaplama_verileri || {};
  const cetvel = hesaplama.birim_fiyat_cetveli || [];

  if (cetvel.length === 0) {
    // Analiz verisinden dene
    const analysis = tender.analysis_summary || {};
    if (analysis.birim_fiyatlar?.length) {
      const data = analysis.birim_fiyatlar.map((b, i) => ({
        Sıra: i + 1,
        'İş Kalemi': b.kalem || b.aciklama || '-',
        Birim: b.birim || '-',
        Miktar: b.miktar ?? 0,
        'Birim Fiyat (TL)': b.fiyat ?? 0,
        'Tutar (TL)': (b.miktar || 0) * (b.fiyat || 0),
      }));

      const toplam = data.reduce((sum, r) => sum + (r['Tutar (TL)'] || 0), 0);
      data.push({
        Sıra: '',
        'İş Kalemi': 'TOPLAM',
        Birim: '',
        Miktar: '',
        'Birim Fiyat (TL)': '',
        'Tutar (TL)': toplam,
      });

      const buffer = createExcel(data, { sheetName: 'Birim Fiyat Cetveli' });
      return {
        buffer,
        filename: `cetvel-${tender.id}-${Date.now()}.xlsx`,
        previewData: { headers: Object.keys(data[0]), rows: data },
      };
    }
    throw new Error('Birim fiyat cetveli verisi bulunamadı');
  }

  const data = cetvel.map((c, i) => ({
    Sıra: c.sira || i + 1,
    'İş Kalemi': c.isKalemi || c.is_kalemi || '-',
    Birim: c.birim || '-',
    Miktar: c.miktar ?? 0,
    'Birim Fiyat (TL)': c.birimFiyat || c.birim_fiyat || 0,
    'Tutar (TL)': c.tutar || (c.miktar || 0) * (c.birimFiyat || c.birim_fiyat || 0),
  }));

  const toplam = data.reduce((sum, r) => sum + (r['Tutar (TL)'] || 0), 0);
  data.push({ Sıra: '', 'İş Kalemi': 'TOPLAM', Birim: '', Miktar: '', 'Birim Fiyat (TL)': '', 'Tutar (TL)': toplam });

  const buffer = createExcel(data, { sheetName: 'Birim Fiyat Cetveli' });
  return {
    buffer,
    filename: `cetvel-${tender.id}-${Date.now()}.xlsx`,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    previewData: { headers: Object.keys(data[0]), rows: data },
  };
}

async function cetvelPDF(ctx) {
  const excelResult = await cetvelExcel(ctx);
  const tender = await getTenderTracking(ctx.tenderId);
  const previewRows = excelResult.previewData?.rows || [];

  const buffer = await createPDF({
    title: 'BİRİM FİYAT TEKLİF CETVELİ',
    subtitle: `${tender?.ihale_basligi || ''} - ${tender?.kurum || ''}`,
    headers: ['Sıra', 'İş Kalemi', 'Birim', 'Miktar', 'Birim Fiyat (TL)', 'Tutar (TL)'],
    data: previewRows,
    footer: 'Catering Pro - İhale Merkezi',
    orientation: 'landscape',
  });

  return { buffer, filename: `cetvel-${ctx.tenderId}-${Date.now()}.pdf`, contentType: 'application/pdf' };
}

// ── 4. Maliyet Analiz Excel ──

async function maliyetExcel(ctx) {
  const tender = await getTenderTracking(ctx.tenderId);
  if (!tender) throw new Error('İhale bulunamadı');

  const h = tender.hesaplama_verileri || {};
  const md = h.maliyet_detay || {};

  const sheets = [];

  // Özet sayfası
  const ozetData = [
    { Kategori: 'Malzeme', 'Tutar (TL)': md.malzeme || 0 },
    { Kategori: 'Personel', 'Tutar (TL)': md.personel || 0 },
    { Kategori: 'Nakliye', 'Tutar (TL)': md.nakliye || 0 },
    { Kategori: 'Sarf Malzeme', 'Tutar (TL)': md.sarf_malzeme || 0 },
    { Kategori: 'Ekipman', 'Tutar (TL)': md.ekipman || 0 },
    { Kategori: 'Genel Gider', 'Tutar (TL)': md.genel_gider || 0 },
    { Kategori: 'Yasal Giderler', 'Tutar (TL)': md.yasal_giderler || 0 },
    { Kategori: 'Risk Payı', 'Tutar (TL)': md.risk_payi || 0 },
    { Kategori: 'TOPLAM MALİYET', 'Tutar (TL)': h.maliyet_toplam || 0 },
    { Kategori: 'Kâr Oranı (%)', 'Tutar (TL)': h.kar_orani || 0 },
    { Kategori: 'Kâr Tutarı', 'Tutar (TL)': h.kar_tutari || 0 },
    { Kategori: 'TEKLİF FİYATI', 'Tutar (TL)': h.teklif_fiyati || 0 },
  ];
  sheets.push({ name: 'Maliyet Özet', data: ozetData });

  // Personel detay
  const persData = h.personel_maliyet?.pozisyonlar || h.personel?.pozisyonlar || [];
  if (persData.length > 0) {
    sheets.push({
      name: 'Personel Detay',
      data: persData.map((p) => ({
        Pozisyon: p.pozisyon || '-',
        Adet: p.adet || 0,
        'Brüt Maaş': p.brutMaas || p.brut_maas || 0,
        'Aylık Toplam': (p.adet || 0) * (p.brutMaas || p.brut_maas || 0),
      })),
    });
  }

  // Malzeme detay (öğün bazlı)
  const malzData = h.malzeme_maliyet?.ogunler || h.malzeme?.ogunler || [];
  if (malzData.length > 0) {
    sheets.push({
      name: 'Malzeme Detay',
      data: malzData.map((o) => ({
        Öğün: o.ogun || o.ad || '-',
        'Kişi Başı Maliyet': o.kisiBasi || o.kisi_basi || 0,
        'Kişi Sayısı': o.kisiSayisi || o.kisi_sayisi || 0,
        'Günlük Toplam': (o.kisiBasi || o.kisi_basi || 0) * (o.kisiSayisi || o.kisi_sayisi || 0),
      })),
    });
  }

  const buffer = createMultiSheetExcel(sheets);
  return {
    buffer,
    filename: `maliyet-analiz-${tender.id}-${Date.now()}.xlsx`,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    previewData: { headers: Object.keys(ozetData[0]), rows: ozetData },
  };
}

// ── 5. KIK Hesaplama Excel/PDF ──

async function kikHesaplamaExcel(ctx) {
  const tender = await getTenderTracking(ctx.tenderId);
  if (!tender) throw new Error('İhale bulunamadı');

  const h = tender.hesaplama_verileri || {};

  const data = [
    { Parametre: 'Yaklaşık Maliyet', Değer: fmtPara(tender.yaklasik_maliyet || tender.bedel) },
    { Parametre: 'Sınır Değer', Değer: fmtPara(tender.sinir_deger) },
    { Parametre: 'Bizim Teklif', Değer: fmtPara(tender.bizim_teklif) },
    { Parametre: 'İhale Türü', Değer: h.ihale_turu || '-' },
    { Parametre: 'Toplam Maliyet', Değer: fmtPara(h.maliyet_toplam) },
    { Parametre: 'Kâr Oranı', Değer: h.kar_orani ? `%${h.kar_orani}` : '-' },
    { Parametre: 'Teklif Fiyatı', Değer: fmtPara(h.teklif_fiyati) },
  ];

  // Teklif listesi
  const teklifler = h.teklif_listesi || [];
  if (teklifler.length > 0) {
    data.push({ Parametre: '---', Değer: '---' });
    data.push({ Parametre: 'TEKLİF LİSTESİ', Değer: '' });
    teklifler.forEach((t, i) => {
      data.push({ Parametre: `${i + 1}. ${t.firma || 'Firma'}`, Değer: fmtPara(t.tutar) });
    });
  }

  const buffer = createExcel(data, { sheetName: 'KIK Hesaplama' });
  return {
    buffer,
    filename: `kik-hesaplama-${tender.id}-${Date.now()}.xlsx`,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    previewData: { headers: ['Parametre', 'Değer'], rows: data },
  };
}

async function kikHesaplamaPDF(ctx) {
  const excelResult = await kikHesaplamaExcel(ctx);
  const tender = await getTenderTracking(ctx.tenderId);

  const buffer = await createPDF({
    title: 'KIK HESAPLAMA TABLOSU',
    subtitle: `${tender?.ihale_basligi || ''} - ${tender?.kurum || ''}`,
    headers: ['Parametre', 'Değer'],
    data: excelResult.previewData?.rows || [],
    footer: 'Catering Pro - İhale Merkezi',
    orientation: 'portrait',
  });

  return { buffer, filename: `kik-hesaplama-${ctx.tenderId}-${Date.now()}.pdf`, contentType: 'application/pdf' };
}

// ── 6. Teminat & Risk PDF ──

async function teminatRiskPDF(ctx) {
  const tender = await getTenderTracking(ctx.tenderId);
  if (!tender) throw new Error('İhale bulunamadı');

  const h = tender.hesaplama_verileri || {};
  const analysis = tender.analysis_summary || {};
  const to = analysis.teminat_oranlari || {};

  const yaklasikMaliyet = Number(tender.yaklasik_maliyet || tender.bedel || 0);
  const bizimTeklif = Number(tender.bizim_teklif || h.teklif_fiyati || 0);
  const sinirDeger = Number(tender.sinir_deger || 0);

  const sections = [
    {
      title: 'Teminat Hesaplamaları',
      keyValues: [
        { key: 'Yaklaşık Maliyet', value: fmtPara(yaklasikMaliyet) },
        { key: 'Geçici Teminat Oranı', value: to.gecici ? `%${to.gecici}` : '%3' },
        { key: 'Geçici Teminat Tutarı', value: fmtPara(yaklasikMaliyet * (Number(to.gecici || 3) / 100)) },
        { key: 'Kesin Teminat Oranı', value: to.kesin ? `%${to.kesin}` : '%6' },
        { key: 'Kesin Teminat Tutarı', value: fmtPara(bizimTeklif * (Number(to.kesin || 6) / 100)) },
      ],
    },
    {
      title: 'Risk Analizi',
      keyValues: [
        { key: 'Bizim Teklif', value: fmtPara(bizimTeklif) },
        { key: 'Sınır Değer', value: fmtPara(sinirDeger) },
        { key: 'Fark', value: fmtPara(bizimTeklif - sinirDeger) },
        {
          key: 'Aşırı Düşük Riski',
          value: bizimTeklif < sinirDeger ? 'EVET - Aşırı düşük teklif savunması gerekebilir' : 'HAYIR',
        },
      ],
    },
  ];

  // Ceza koşulları
  if (analysis.ceza_kosullari?.length) {
    sections.push({
      title: 'Ceza Koşulları',
      headers: ['Tür', 'Oran', 'Açıklama'],
      data: analysis.ceza_kosullari.map((c) => ({
        Tür: c.tur || '-',
        Oran: c.oran || '-',
        Açıklama: c.aciklama || '-',
      })),
    });
  }

  const buffer = await createSectionedPDF({
    title: 'TEMİNAT & RİSK RAPORU',
    subtitle: `${tender.ihale_basligi} - ${tender.kurum}`,
    sections,
    footer: 'Catering Pro - İhale Merkezi',
  });

  return { buffer, filename: `teminat-risk-${tender.id}-${Date.now()}.pdf`, contentType: 'application/pdf' };
}

// ── 7. Toplu İhale Listesi Excel ──

async function topluListeExcel(ctx) {
  const tenders = await getAllTrackedTenders(ctx.userId);

  const statusLabels = {
    inceleniyor: 'İnceleniyor',
    bekliyor: 'Bekliyor',
    basvuruldu: 'Başvuruldu',
    kazanildi: 'Kazanıldı',
    kaybedildi: 'Kaybedildi',
    iptal: 'İptal',
  };

  const data = tenders.map((t, i) => ({
    '#': i + 1,
    'İhale Başlığı': t.ihale_basligi || '-',
    Kurum: t.kurum || '-',
    Tarih: fmtTarih(t.tarih),
    Şehir: t.city || '-',
    'Yaklaşık Maliyet': fmtPara(t.bedel || t.yaklasik_maliyet),
    'Bizim Teklif': fmtPara(t.bizim_teklif),
    Durum: statusLabels[t.status] || t.status || '-',
    Döküman: t.dokuman_sayisi || 0,
    Eklenme: fmtTarih(t.created_at),
  }));

  const buffer = createExcel(data, { sheetName: 'Takip Edilen İhaleler' });
  return {
    buffer,
    filename: `ihale-listesi-${Date.now()}.xlsx`,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    previewData: { headers: Object.keys(data[0] || {}), rows: data.slice(0, 50) },
  };
}

// ── 8. Dilekçe PDF ──

async function dilekcePDF(ctx) {
  const { tenderId, dilekceType, dilekceContent } = ctx;

  // Eğer content doğrudan geldiyse
  if (dilekceContent) {
    const tender = await getTenderTracking(tenderId);
    const buffer = await createDilekcePDF({
      title: dilekceType || 'DİLEKÇE',
      content: dilekceContent,
      ihale: tender ? { baslik: tender.ihale_basligi, kurum: tender.kurum } : {},
      footer: 'Catering Pro - İhale Merkezi',
    });
    return { buffer, filename: `dilekce-${tenderId}-${Date.now()}.pdf`, contentType: 'application/pdf' };
  }

  // DB'den mevcut dilekçeyi çek
  const result = await query(
    'SELECT * FROM tender_dilekce WHERE tender_tracking_id = $1 ORDER BY updated_at DESC LIMIT 1',
    [tenderId]
  );

  if (!result.rows?.length) throw new Error('Kayıtlı dilekçe bulunamadı');

  const dilekce = result.rows[0];
  const tender = await getTenderTracking(tenderId);

  const typeLabels = {
    asiri_dusuk: 'AŞIRI DÜŞÜK TEKLİF SAVUNMASI',
    idare_sikayet: 'İDAREYE ŞİKAYET DİLEKÇESİ',
    kik_itiraz: 'KİK İTİRAZ DİLEKÇESİ',
    aciklama_cevabi: 'AÇIKLAMA CEVABI',
  };

  const buffer = await createDilekcePDF({
    title: typeLabels[dilekce.dilekce_type] || 'DİLEKÇE',
    content: dilekce.content || '',
    ihale: tender ? { baslik: tender.ihale_basligi, kurum: tender.kurum, ihale_no: tender.external_id } : {},
    footer: 'Catering Pro - İhale Merkezi',
  });

  return { buffer, filename: `dilekce-${tenderId}-${Date.now()}.pdf`, contentType: 'application/pdf' };
}

// ── Rapor Tanımlarını Kaydet ──

registerReports([
  {
    id: 'ihale-ozet',
    module: 'ihale',
    label: 'İhale Özet Raporu',
    description: 'Seçili ihalenin tüm bilgilerini içeren özet rapor',
    icon: 'file-text',
    formats: ['pdf'],
    requiresContext: true,
    contextType: 'tender',
    category: 'tek-ihale',
    generator: 'ihale:ozetPDF',
  },
  {
    id: 'ihale-analiz',
    module: 'ihale',
    label: 'AI Döküman Analizi',
    description: 'Teknik şartlar, öğün bilgileri, personel, ceza koşulları, teminat oranları',
    icon: 'sparkles',
    formats: ['pdf'],
    requiresContext: true,
    contextType: 'tender',
    category: 'tek-ihale',
    generator: 'ihale:analizPDF',
  },
  {
    id: 'ihale-cetvel',
    module: 'ihale',
    label: 'Birim Fiyat Teklif Cetveli',
    description: 'KIK formatında birim fiyat cetveli',
    icon: 'table',
    formats: ['excel', 'pdf'],
    requiresContext: true,
    contextType: 'tender',
    category: 'tek-ihale',
    generator: 'ihale:cetvel',
  },
  {
    id: 'ihale-maliyet',
    module: 'ihale',
    label: 'Maliyet Analiz Tablosu',
    description: '8 kategori maliyet kırılımı (malzeme, personel, nakliye vb.)',
    icon: 'calculator',
    formats: ['excel'],
    requiresContext: true,
    contextType: 'tender',
    category: 'tek-ihale',
    generator: 'ihale:maliyetExcel',
  },
  {
    id: 'ihale-kik-hesaplama',
    module: 'ihale',
    label: 'KİK Hesaplama Tablosu',
    description: 'Yaklaşık maliyet, sınır değer, teklif listesi',
    icon: 'scale',
    formats: ['excel', 'pdf'],
    requiresContext: true,
    contextType: 'tender',
    category: 'tek-ihale',
    generator: 'ihale:kikHesaplama',
  },
  {
    id: 'ihale-teminat-risk',
    module: 'ihale',
    label: 'Teminat & Risk Raporu',
    description: 'Teminat hesaplamaları ve risk analizi',
    icon: 'shield',
    formats: ['pdf'],
    requiresContext: true,
    contextType: 'tender',
    category: 'tek-ihale',
    generator: 'ihale:teminatRiskPDF',
  },
  {
    id: 'ihale-toplu-liste',
    module: 'ihale',
    label: 'Toplu İhale Listesi',
    description: 'Tüm takip edilen ihalelerin listesi',
    icon: 'list',
    formats: ['excel'],
    requiresContext: false,
    category: 'genel',
    generator: 'ihale:topluListeExcel',
  },
  {
    id: 'ihale-dilekce',
    module: 'ihale',
    label: 'Dilekçe',
    description: 'Kayıtlı dilekçeyi PDF olarak indir',
    icon: 'writing',
    formats: ['pdf'],
    requiresContext: true,
    contextType: 'tender',
    category: 'tek-ihale',
    generator: 'ihale:dilekcePDF',
  },
]);

// Generator fonksiyonlarını kaydet
// format parametresine göre doğru fonksiyon çağrılır
registerGenerator('ihale', {
  ozetPDF,
  analizPDF,
  cetvel: async (ctx, format) => {
    if (format === 'pdf') return cetvelPDF(ctx);
    return cetvelExcel(ctx);
  },
  maliyetExcel,
  kikHesaplama: async (ctx, format) => {
    if (format === 'pdf') return kikHesaplamaPDF(ctx);
    return kikHesaplamaExcel(ctx);
  },
  teminatRiskPDF,
  topluListeExcel,
  dilekcePDF,
});

export default {
  ozetPDF,
  analizPDF,
  cetvelExcel,
  cetvelPDF,
  maliyetExcel,
  kikHesaplamaExcel,
  kikHesaplamaPDF,
  teminatRiskPDF,
  topluListeExcel,
  dilekcePDF,
};
