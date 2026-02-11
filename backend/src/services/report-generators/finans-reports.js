/**
 * Finans Rapor Ureticileri
 * Fatura, cari, kasa-banka, gelir-gider, proje harcama raporları.
 * Mevcut export-service fonksiyonlarını yeniden kullanır.
 */

import { query } from '../../database.js';
import {
  createCariExcel,
  createCariPDF,
  createExcel,
  createFaturaExcel,
  createFaturaPDF,
  createPDF,
} from '../export-service.js';
import { registerGenerator, registerReports } from '../report-registry.js';

// ── Yardımcı ──
function fmtPara(val) {
  if (val == null) return '-';
  return `${Number(val).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`;
}

// ── 1. Fatura Listesi ──
async function faturaListesi(ctx, format) {
  const filters = ctx.filters || {};
  let sql = 'SELECT * FROM uyumsoft_invoices WHERE 1=1';
  const params = [];

  if (filters.type) {
    params.push(filters.type);
    sql += ` AND type = $${params.length}`;
  }
  if (filters.status) {
    params.push(filters.status);
    sql += ` AND status = $${params.length}`;
  }
  sql += ' ORDER BY invoice_date DESC';

  const result = await query(sql, params);
  const faturalar = result.rows || [];

  if (format === 'pdf') {
    const buffer = await createFaturaPDF(faturalar);
    return { buffer, filename: `fatura-listesi-${Date.now()}.pdf`, contentType: 'application/pdf' };
  }
  const buffer = createFaturaExcel(faturalar);
  return {
    buffer,
    filename: `fatura-listesi-${Date.now()}.xlsx`,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    previewData: {
      headers: ['Fatura No', 'Müşteri', 'Tarih', 'Tutar', 'Durum'],
      rows: faturalar.slice(0, 30).map((f) => ({
        'Fatura No': f.invoice_number,
        Müşteri: f.customer_name,
        Tarih: f.invoice_date,
        Tutar: fmtPara(f.total_amount),
        Durum: f.status,
      })),
    },
  };
}

// ── 2. Vadesi Geçen Faturalar ──
async function vadeliGecen(_ctx, format) {
  const result = await query(
    `SELECT * FROM uyumsoft_invoices WHERE due_date < NOW() AND status != 'Ödendi' ORDER BY due_date ASC`
  );
  const faturalar = result.rows || [];
  if (format === 'pdf') {
    const buffer = await createFaturaPDF(faturalar);
    return { buffer, filename: `vadesi-gecen-${Date.now()}.pdf`, contentType: 'application/pdf' };
  }
  const buffer = createFaturaExcel(faturalar);
  return { buffer, filename: `vadesi-gecen-${Date.now()}.xlsx` };
}

// ── 3. Cari Listesi ──
async function cariListesi(ctx, format) {
  const filters = ctx.filters || {};
  let sql = 'SELECT * FROM cariler WHERE 1=1';
  const params = [];
  if (filters.tip) {
    params.push(filters.tip);
    sql += ` AND tip = $${params.length}`;
  }
  sql += ' ORDER BY unvan ASC';

  const result = await query(sql, params);
  const cariler = result.rows || [];

  if (format === 'pdf') {
    const buffer = await createCariPDF(cariler);
    return { buffer, filename: `cari-listesi-${Date.now()}.pdf`, contentType: 'application/pdf' };
  }
  const buffer = createCariExcel(cariler);
  return { buffer, filename: `cari-listesi-${Date.now()}.xlsx` };
}

// ── 4. Cari Bakiye ──
async function cariBakiye(_ctx, format) {
  const result = await query(`SELECT * FROM cariler WHERE bakiye != 0 ORDER BY bakiye DESC`);
  const cariler = result.rows || [];

  const data = cariler.map((c) => ({
    Ünvan: c.unvan || '-',
    Tip: c.tip || '-',
    Bakiye: fmtPara(c.bakiye),
    Telefon: c.telefon || '-',
  }));

  if (format === 'pdf') {
    const buffer = await createPDF({
      title: 'CARİ BAKİYE RAPORU',
      subtitle: `${cariler.length} cari hesap`,
      headers: ['Ünvan', 'Tip', 'Bakiye', 'Telefon'],
      data,
      footer: 'Catering Pro - Finans',
    });
    return { buffer, filename: `cari-bakiye-${Date.now()}.pdf`, contentType: 'application/pdf' };
  }
  const buffer = createExcel(data, { sheetName: 'Cari Bakiye' });
  return { buffer, filename: `cari-bakiye-${Date.now()}.xlsx` };
}

// ── 5. Kasa/Banka Özet ──
async function kasaBankaOzet(_ctx, format) {
  const result = await query(`SELECT * FROM kasa_banka ORDER BY created_at DESC LIMIT 500`);
  const hareketler = result.rows || [];

  const data = hareketler.map((h) => ({
    Tarih: h.tarih || h.created_at,
    Hesap: h.hesap_adi || '-',
    Tür: h.tur || '-',
    Açıklama: h.aciklama || '-',
    Tutar: fmtPara(h.tutar),
  }));

  if (format === 'pdf') {
    const buffer = await createPDF({
      title: 'KASA / BANKA RAPORU',
      headers: ['Tarih', 'Hesap', 'Tür', 'Açıklama', 'Tutar'],
      data,
      footer: 'Catering Pro - Finans',
    });
    return { buffer, filename: `kasa-banka-${Date.now()}.pdf`, contentType: 'application/pdf' };
  }
  const buffer = createExcel(data, { sheetName: 'Kasa Banka' });
  return { buffer, filename: `kasa-banka-${Date.now()}.xlsx` };
}

// ── 6. Gelir-Gider ──
async function gelirGider(_ctx, format) {
  const result = await query(
    `SELECT
       COALESCE(SUM(CASE WHEN type = 'SATIS' THEN total_amount ELSE 0 END), 0) as toplam_gelir,
       COALESCE(SUM(CASE WHEN type = 'ALIS' THEN total_amount ELSE 0 END), 0) as toplam_gider,
       COUNT(*) as fatura_sayisi
     FROM uyumsoft_invoices`
  );
  const summary = result.rows?.[0] || {};

  const data = [
    { Kalem: 'Toplam Gelir (Satış)', Tutar: fmtPara(summary.toplam_gelir) },
    { Kalem: 'Toplam Gider (Alış)', Tutar: fmtPara(summary.toplam_gider) },
    { Kalem: 'Net Durum', Tutar: fmtPara(Number(summary.toplam_gelir) - Number(summary.toplam_gider)) },
    { Kalem: 'Toplam Fatura Sayısı', Tutar: String(summary.fatura_sayisi || 0) },
  ];

  if (format === 'pdf') {
    const buffer = await createPDF({
      title: 'GELİR-GİDER RAPORU',
      headers: ['Kalem', 'Tutar'],
      data,
      footer: 'Catering Pro - Finans',
      orientation: 'portrait',
    });
    return { buffer, filename: `gelir-gider-${Date.now()}.pdf`, contentType: 'application/pdf' };
  }
  const buffer = createExcel(data, { sheetName: 'Gelir Gider' });
  return { buffer, filename: `gelir-gider-${Date.now()}.xlsx` };
}

// ── 7. Proje Harcama ──
async function projeHarcama(_ctx, format) {
  const result = await query(
    `SELECT p.ad, p.butce,
            COALESCE(SUM(ph.tutar), 0) as toplam_harcama
     FROM projeler p
     LEFT JOIN proje_hareketler ph ON ph.proje_id = p.id
     GROUP BY p.id, p.ad, p.butce
     ORDER BY toplam_harcama DESC`
  );
  const projeler = result.rows || [];

  const data = projeler.map((p) => ({
    Proje: p.ad || '-',
    Bütçe: fmtPara(p.butce),
    Harcama: fmtPara(p.toplam_harcama),
    Kalan: fmtPara(Number(p.butce || 0) - Number(p.toplam_harcama || 0)),
  }));

  if (format === 'pdf') {
    const buffer = await createPDF({
      title: 'PROJE HARCAMA RAPORU',
      headers: ['Proje', 'Bütçe', 'Harcama', 'Kalan'],
      data,
      footer: 'Catering Pro - Finans',
    });
    return { buffer, filename: `proje-harcama-${Date.now()}.pdf`, contentType: 'application/pdf' };
  }
  const buffer = createExcel(data, { sheetName: 'Proje Harcama' });
  return { buffer, filename: `proje-harcama-${Date.now()}.xlsx` };
}

// ── Kayıt ──

registerReports([
  {
    id: 'finans-fatura-listesi',
    module: 'finans',
    label: 'Fatura Listesi',
    description: 'Tüm faturaların listesi',
    icon: 'file-invoice',
    formats: ['excel', 'pdf'],
    category: 'fatura',
    generator: 'finans:faturaListesi',
  },
  {
    id: 'finans-vadesi-gecen',
    module: 'finans',
    label: 'Vadesi Geçen Faturalar',
    description: 'Ödenmemiş vadesi geçmiş faturalar',
    icon: 'alert-triangle',
    formats: ['excel', 'pdf'],
    category: 'fatura',
    generator: 'finans:vadeliGecen',
  },
  {
    id: 'finans-cari-listesi',
    module: 'finans',
    label: 'Cari Listesi',
    description: 'Tüm cari hesaplar',
    icon: 'users',
    formats: ['excel', 'pdf'],
    category: 'cari',
    generator: 'finans:cariListesi',
  },
  {
    id: 'finans-cari-bakiye',
    module: 'finans',
    label: 'Cari Bakiye Raporu',
    description: 'Bakiyesi sıfır olmayan cariler',
    icon: 'coin',
    formats: ['excel', 'pdf'],
    category: 'cari',
    generator: 'finans:cariBakiye',
  },
  {
    id: 'finans-kasa-banka',
    module: 'finans',
    label: 'Kasa/Banka Özet',
    description: 'Kasa ve banka hareketleri',
    icon: 'building-bank',
    formats: ['excel', 'pdf'],
    category: 'hesap',
    generator: 'finans:kasaBankaOzet',
  },
  {
    id: 'finans-gelir-gider',
    module: 'finans',
    label: 'Gelir-Gider Raporu',
    description: 'Genel gelir-gider özeti',
    icon: 'chart-bar',
    formats: ['excel', 'pdf'],
    category: 'hesap',
    generator: 'finans:gelirGider',
  },
  {
    id: 'finans-proje-harcama',
    module: 'finans',
    label: 'Proje Harcama Raporu',
    description: 'Proje bazlı bütçe ve harcama durumu',
    icon: 'briefcase',
    formats: ['excel', 'pdf'],
    category: 'proje',
    generator: 'finans:projeHarcama',
  },
]);

registerGenerator('finans', {
  faturaListesi,
  vadeliGecen,
  cariListesi,
  cariBakiye,
  kasaBankaOzet,
  gelirGider,
  projeHarcama,
});

export default { faturaListesi, vadeliGecen, cariListesi, cariBakiye, kasaBankaOzet, gelirGider, projeHarcama };
