/**
 * Admin Rapor Ureticileri
 * Audit log, kullanıcı listesi, sistem raporu.
 */

import { query } from '../../database.js';
import { createExcel, createPDF, createSectionedPDF } from '../export-service.js';
import { registerGenerator, registerReports } from '../report-registry.js';

// ── 1. Audit Log ──
async function auditLog(ctx, format) {
  const limit = ctx.limit || 1000;
  const result = await query(
    `SELECT al.*, u.tam_ad as kullanici_adi
     FROM audit_logs al
     LEFT JOIN users u ON u.id = al.user_id
     ORDER BY al.created_at DESC
     LIMIT $1`,
    [limit]
  );
  const logs = result.rows || [];

  const data = logs.map((l) => ({
    Tarih: l.created_at ? new Date(l.created_at).toLocaleString('tr-TR') : '-',
    Kullanıcı: l.kullanici_adi || '-',
    İşlem: l.action || '-',
    Modül: l.module || '-',
    Detay: l.details ? (typeof l.details === 'string' ? l.details : JSON.stringify(l.details)).substring(0, 100) : '-',
    IP: l.ip_address || '-',
  }));

  if (format === 'pdf') {
    const buffer = await createPDF({
      title: 'DENETİM KAYITLARI',
      subtitle: `Son ${logs.length} kayıt`,
      headers: ['Tarih', 'Kullanıcı', 'İşlem', 'Modül', 'IP'],
      data: data.map((d) => ({ Tarih: d.Tarih, Kullanıcı: d.Kullanıcı, İşlem: d.İşlem, Modül: d.Modül, IP: d.IP })),
      footer: 'Catering Pro - Yönetim',
    });
    return { buffer, filename: `audit-log-${Date.now()}.pdf`, contentType: 'application/pdf' };
  }
  const buffer = createExcel(data, { sheetName: 'Denetim Kayıtları' });
  return { buffer, filename: `audit-log-${Date.now()}.xlsx` };
}

// ── 2. Kullanıcı Listesi ──
async function kullaniciListesi(_ctx, format) {
  const result = await query(
    `SELECT id, tam_ad, email, rol, aktif, son_giris, created_at FROM users ORDER BY tam_ad ASC`
  );
  const users = result.rows || [];

  const data = users.map((u) => ({
    'Ad Soyad': u.tam_ad || '-',
    'E-posta': u.email || '-',
    Rol: u.rol || '-',
    Durum: u.aktif ? 'Aktif' : 'Pasif',
    'Son Giriş': u.son_giris ? new Date(u.son_giris).toLocaleString('tr-TR') : '-',
    'Kayıt Tarihi': u.created_at ? new Date(u.created_at).toLocaleDateString('tr-TR') : '-',
  }));

  if (format === 'pdf') {
    const buffer = await createPDF({
      title: 'KULLANICI LİSTESİ',
      subtitle: `Toplam ${users.length} kullanıcı`,
      headers: ['Ad Soyad', 'E-posta', 'Rol', 'Durum', 'Son Giriş'],
      data,
      footer: 'Catering Pro - Yönetim',
      orientation: 'landscape',
    });
    return { buffer, filename: `kullanicilar-${Date.now()}.pdf`, contentType: 'application/pdf' };
  }
  const buffer = createExcel(data, { sheetName: 'Kullanıcılar' });
  return { buffer, filename: `kullanicilar-${Date.now()}.xlsx` };
}

// ── 3. Sistem Raporu ──
async function sistemRaporu(_ctx, _format) {
  // Çeşitli istatistikler topla
  const stats = {};

  try {
    const r = await query('SELECT COUNT(*) as c FROM users');
    stats.kullanici = r.rows[0]?.c || 0;
  } catch {
    stats.kullanici = 'N/A';
  }
  try {
    const r = await query('SELECT COUNT(*) as c FROM tenders');
    stats.ihale = r.rows[0]?.c || 0;
  } catch {
    stats.ihale = 'N/A';
  }
  try {
    const r = await query('SELECT COUNT(*) as c FROM tender_tracking');
    stats.takip = r.rows[0]?.c || 0;
  } catch {
    stats.takip = 'N/A';
  }
  try {
    const r = await query('SELECT COUNT(*) as c FROM uyumsoft_invoices');
    stats.fatura = r.rows[0]?.c || 0;
  } catch {
    stats.fatura = 'N/A';
  }
  try {
    const r = await query('SELECT COUNT(*) as c FROM cariler');
    stats.cari = r.rows[0]?.c || 0;
  } catch {
    stats.cari = 'N/A';
  }
  try {
    const r = await query('SELECT COUNT(*) as c FROM urunler');
    stats.urun = r.rows[0]?.c || 0;
  } catch {
    stats.urun = 'N/A';
  }
  try {
    const r = await query('SELECT COUNT(*) as c FROM personeller');
    stats.personel = r.rows[0]?.c || 0;
  } catch {
    stats.personel = 'N/A';
  }
  try {
    const r = await query('SELECT COUNT(*) as c FROM documents');
    stats.dokuman = r.rows[0]?.c || 0;
  } catch {
    stats.dokuman = 'N/A';
  }

  const sections = [
    {
      title: 'Sistem İstatistikleri',
      keyValues: [
        { key: 'Toplam Kullanıcı', value: stats.kullanici },
        { key: 'Toplam İhale', value: stats.ihale },
        { key: 'Takip Edilen İhale', value: stats.takip },
        { key: 'Toplam Fatura', value: stats.fatura },
        { key: 'Toplam Cari', value: stats.cari },
        { key: 'Toplam Ürün/Stok', value: stats.urun },
        { key: 'Toplam Personel', value: stats.personel },
        { key: 'Toplam Döküman', value: stats.dokuman },
      ],
    },
    {
      title: 'Sunucu Bilgileri',
      keyValues: [
        { key: 'Node.js Sürümü', value: process.version },
        { key: 'Platform', value: process.platform },
        { key: 'Uptime', value: `${Math.floor(process.uptime() / 3600)} saat` },
        { key: 'Bellek Kullanımı', value: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB` },
        { key: 'Rapor Tarihi', value: new Date().toLocaleString('tr-TR') },
      ],
    },
  ];

  const buffer = await createSectionedPDF({
    title: 'SİSTEM DURUMU RAPORU',
    subtitle: 'Catering Pro - Genel Bakış',
    sections,
    footer: 'Catering Pro - Yönetim Paneli',
  });

  return { buffer, filename: `sistem-raporu-${Date.now()}.pdf`, contentType: 'application/pdf' };
}

// ── Kayıt ──

registerReports([
  {
    id: 'admin-audit-log',
    module: 'admin',
    label: 'Denetim Kayıtları',
    description: 'Sistem aktivite logları',
    icon: 'history',
    formats: ['excel', 'pdf'],
    category: 'admin',
    generator: 'admin:auditLog',
  },
  {
    id: 'admin-kullanicilar',
    module: 'admin',
    label: 'Kullanıcı Listesi',
    description: 'Tüm sistem kullanıcıları',
    icon: 'users',
    formats: ['excel', 'pdf'],
    category: 'admin',
    generator: 'admin:kullaniciListesi',
  },
  {
    id: 'admin-sistem',
    module: 'admin',
    label: 'Sistem Raporu',
    description: 'Sistem durumu ve istatistikler',
    icon: 'server',
    formats: ['pdf'],
    category: 'admin',
    generator: 'admin:sistemRaporu',
  },
]);

registerGenerator('admin', {
  auditLog,
  kullaniciListesi,
  sistemRaporu,
});

export default { auditLog, kullaniciListesi, sistemRaporu };
