/**
 * Operasyon Rapor Ureticileri
 * Personel, stok, demirbaş, satın alma raporları.
 * Mevcut export-service fonksiyonlarını yeniden kullanır.
 */

import { query } from '../../database.js';
import {
  createExcel,
  createPDF,
  createPersonelExcel,
  createPersonelPDF,
  createStokExcel,
  createStokPDF,
} from '../export-service.js';
import { registerGenerator, registerReports } from '../report-registry.js';

function fmtPara(val) {
  if (val == null) return '-';
  return `${Number(val).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`;
}

// ── 1. Personel Listesi ──
async function personelListesi(ctx, format) {
  const filters = ctx.filters || {};
  let sql = 'SELECT * FROM personel WHERE 1=1';
  const params = [];
  if (filters.departman) { params.push(filters.departman); sql += ` AND departman = $${params.length}`; }
  if (filters.durum) { params.push(filters.durum); sql += ` AND durum = $${params.length}`; }
  sql += ' ORDER BY tam_ad ASC';

  const result = await query(sql, params);
  const personeller = result.rows || [];

  if (format === 'pdf') {
    const buffer = await createPersonelPDF(personeller);
    return { buffer, filename: `personel-listesi-${Date.now()}.pdf`, contentType: 'application/pdf' };
  }
  const buffer = createPersonelExcel(personeller);
  return { buffer, filename: `personel-listesi-${Date.now()}.xlsx` };
}

// ── 2. Stok Listesi ──
async function stokListesi(ctx, format) {
  const filters = ctx.filters || {};
  let sql = 'SELECT * FROM urunler WHERE 1=1';
  const params = [];
  if (filters.kategori) { params.push(filters.kategori); sql += ` AND kategori = $${params.length}`; }
  sql += ' ORDER BY ad ASC';

  const result = await query(sql, params);
  const stoklar = result.rows || [];

  if (format === 'pdf') {
    const buffer = await createStokPDF(stoklar);
    return { buffer, filename: `stok-listesi-${Date.now()}.pdf`, contentType: 'application/pdf' };
  }
  const buffer = createStokExcel(stoklar);
  return { buffer, filename: `stok-listesi-${Date.now()}.xlsx` };
}

// ── 3. Kritik Stok ──
async function kritikStok(_ctx, format) {
  const result = await query(
    `SELECT * FROM urunler WHERE miktar <= COALESCE(kritik_stok, 0) AND kritik_stok > 0 ORDER BY miktar ASC`
  );
  const stoklar = result.rows || [];

  const data = stoklar.map(s => ({
    'Ürün': s.ad || '-',
    'Kod': s.kod || '-',
    'Miktar': `${s.miktar || 0} ${s.birim || ''}`,
    'Kritik Seviye': s.kritik_stok || 0,
    'Eksik': (s.kritik_stok || 0) - (s.miktar || 0),
  }));

  if (format === 'pdf') {
    const buffer = await createPDF({
      title: 'KRİTİK STOK RAPORU',
      subtitle: `${stoklar.length} ürün kritik seviyede`,
      headers: ['Ürün', 'Kod', 'Miktar', 'Kritik Seviye', 'Eksik'],
      data,
      footer: 'Catering Pro - Stok Yönetimi',
    });
    return { buffer, filename: `kritik-stok-${Date.now()}.pdf`, contentType: 'application/pdf' };
  }
  const buffer = createExcel(data, { sheetName: 'Kritik Stok' });
  return { buffer, filename: `kritik-stok-${Date.now()}.xlsx` };
}

// ── 4. Demirbaş Listesi ──
async function demirbasListesi(_ctx, format) {
  const result = await query('SELECT * FROM demirbaslar ORDER BY ad ASC');
  const demirbaslar = result.rows || [];

  const data = demirbaslar.map(d => ({
    'Demirbaş Adı': d.ad || '-',
    'Kod': d.kod || d.barkod || '-',
    'Kategori': d.kategori || '-',
    'Konum': d.konum || '-',
    'Alış Fiyatı': fmtPara(d.alis_fiyati || d.fiyat),
    'Durum': d.durum || 'Aktif',
    'Alış Tarihi': d.alis_tarihi || '-',
  }));

  if (format === 'pdf') {
    const buffer = await createPDF({
      title: 'DEMİRBAŞ LİSTESİ',
      subtitle: `Toplam ${demirbaslar.length} demirbaş`,
      headers: ['Demirbaş Adı', 'Kod', 'Kategori', 'Konum', 'Alış Fiyatı', 'Durum'],
      data,
      footer: 'Catering Pro - Demirbaş Yönetimi',
    });
    return { buffer, filename: `demirbas-${Date.now()}.pdf`, contentType: 'application/pdf' };
  }
  const buffer = createExcel(data, { sheetName: 'Demirbaş Listesi' });
  return { buffer, filename: `demirbas-${Date.now()}.xlsx` };
}

// ── 5. Satın Alma Siparişleri ──
async function satinAlmaListesi(_ctx, format) {
  const result = await query(
    `SELECT s.*, c.unvan as tedarikci_adi
     FROM siparisler s
     LEFT JOIN cariler c ON c.id = s.cari_id
     ORDER BY s.created_at DESC
     LIMIT 500`
  );
  const siparisler = result.rows || [];

  const data = siparisler.map(s => ({
    'Sipariş No': s.siparis_no || s.id || '-',
    'Tedarikçi': s.tedarikci_adi || '-',
    'Tarih': s.tarih || s.created_at || '-',
    'Toplam Tutar': fmtPara(s.toplam_tutar),
    'Durum': s.durum || '-',
    'Proje': s.proje_adi || '-',
  }));

  if (format === 'pdf') {
    const buffer = await createPDF({
      title: 'SATIN ALMA SİPARİŞLERİ',
      subtitle: `${siparisler.length} sipariş`,
      headers: ['Sipariş No', 'Tedarikçi', 'Tarih', 'Toplam Tutar', 'Durum'],
      data,
      footer: 'Catering Pro - Satın Alma',
    });
    return { buffer, filename: `satin-alma-${Date.now()}.pdf`, contentType: 'application/pdf' };
  }
  const buffer = createExcel(data, { sheetName: 'Satın Alma' });
  return { buffer, filename: `satin-alma-${Date.now()}.xlsx` };
}

// ── 6. Bordro ──
async function bordroRaporu(ctx, format) {
  const donem = ctx.donem || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const result = await query(
    `SELECT b.*, p.tam_ad FROM bordro b JOIN personel p ON p.id = b.personel_id WHERE b.donem = $1 ORDER BY p.tam_ad`,
    [donem]
  );
  const bordrolar = result.rows || [];

  const data = bordrolar.map(b => ({
    'Ad Soyad': b.tam_ad || '-',
    'Dönem': b.donem || donem,
    'Brüt Maaş': fmtPara(b.brut_maas),
    'SGK İşçi': fmtPara(b.sgk_isci),
    'Gelir Vergisi': fmtPara(b.gelir_vergisi),
    'Net Maaş': fmtPara(b.net_maas),
  }));

  if (format === 'pdf') {
    const buffer = await createPDF({
      title: `BORDRO RAPORU - ${donem}`,
      headers: ['Ad Soyad', 'Brüt Maaş', 'SGK İşçi', 'Gelir Vergisi', 'Net Maaş'],
      data,
      footer: 'Catering Pro - Bordro',
    });
    return { buffer, filename: `bordro-${donem}-${Date.now()}.pdf`, contentType: 'application/pdf' };
  }
  const buffer = createExcel(data, { sheetName: `Bordro ${donem}` });
  return { buffer, filename: `bordro-${donem}-${Date.now()}.xlsx` };
}

// ── Kayıt ──

registerReports([
  { id: 'operasyon-personel', module: 'operasyon', label: 'Personel Listesi', description: 'Tüm personel bilgileri', icon: 'users', formats: ['excel', 'pdf'], category: 'personel', generator: 'operasyon:personelListesi' },
  { id: 'operasyon-stok', module: 'operasyon', label: 'Stok Listesi', description: 'Tüm ürün/stok bilgileri', icon: 'package', formats: ['excel', 'pdf'], category: 'stok', generator: 'operasyon:stokListesi' },
  { id: 'operasyon-kritik-stok', module: 'operasyon', label: 'Kritik Stok Raporu', description: 'Kritik seviyenin altındaki ürünler', icon: 'alert-circle', formats: ['excel', 'pdf'], category: 'stok', generator: 'operasyon:kritikStok' },
  { id: 'operasyon-demirbas', module: 'operasyon', label: 'Demirbaş Listesi', description: 'Sabit kıymet ve demirbaş envanterin', icon: 'tool', formats: ['excel', 'pdf'], category: 'demirbas', generator: 'operasyon:demirbasListesi' },
  { id: 'operasyon-satin-alma', module: 'operasyon', label: 'Satın Alma Siparişleri', description: 'Satın alma sipariş kayıtları', icon: 'shopping-cart', formats: ['excel', 'pdf'], category: 'satin-alma', generator: 'operasyon:satinAlmaListesi' },
  { id: 'operasyon-bordro', module: 'operasyon', label: 'Bordro Raporu', description: 'Dönem bazlı bordro bilgileri', icon: 'report-money', formats: ['excel', 'pdf'], category: 'personel', requiresContext: true, contextType: 'donem', generator: 'operasyon:bordroRaporu' },
]);

registerGenerator('operasyon', {
  personelListesi,
  stokListesi,
  kritikStok,
  demirbasListesi,
  satinAlmaListesi,
  bordroRaporu,
});

export default { personelListesi, stokListesi, kritikStok, demirbasListesi, satinAlmaListesi, bordroRaporu };
