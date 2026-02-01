/**
 * Fiyat Yönetimi Export Utilities
 * CSV ve JSON export fonksiyonları
 */

interface ExportColumn {
  key: string;
  header: string;
  formatter?: (value: any) => string;
}

/**
 * Veriyi CSV formatına dönüştür
 */
export function toCSV<T extends Record<string, any>>(data: T[], columns: ExportColumn[]): string {
  // BOM (Byte Order Mark) for Excel UTF-8 compatibility
  const BOM = '\uFEFF';

  // Header row
  const headers = columns.map((col) => `"${col.header}"`).join(';');

  // Data rows
  const rows = data.map((item) => {
    return columns
      .map((col) => {
        let value = item[col.key];

        // Formatter varsa uygula
        if (col.formatter) {
          value = col.formatter(value);
        }

        // Null/undefined kontrolü
        if (value === null || value === undefined) {
          return '""';
        }

        // Sayı ise Türkçe format (virgül)
        if (typeof value === 'number') {
          return `"${value.toLocaleString('tr-TR')}"`;
        }

        // String escape
        const stringValue = String(value).replace(/"/g, '""');
        return `"${stringValue}"`;
      })
      .join(';');
  });

  return BOM + headers + '\n' + rows.join('\n');
}

/**
 * CSV dosyasını indir
 */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

/**
 * JSON dosyasını indir
 */
export function downloadJSON(data: any, filename: string): void {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Tarih formatlama
 */
export function formatTarih(tarih: string | null): string {
  if (!tarih) return '-';
  return new Date(tarih).toLocaleDateString('tr-TR');
}

/**
 * Fiyat formatlama
 */
export function formatFiyat(fiyat: number | null): string {
  if (!fiyat) return '-';
  return fiyat.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Ürün listesi export kolonları
export const URUN_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'kod', header: 'Ürün Kodu' },
  { key: 'ad', header: 'Ürün Adı' },
  { key: 'kategori_ad', header: 'Kategori' },
  { key: 'varsayilan_birim', header: 'Birim' },
  { key: 'aktif_fiyat', header: 'Aktif Fiyat (TL)', formatter: formatFiyat },
  { key: 'aktif_fiyat_tipi', header: 'Fiyat Kaynağı' },
  { key: 'aktif_fiyat_guven', header: 'Güven (%)' },
  { key: 'aktif_fiyat_guncelleme', header: 'Son Güncelleme', formatter: formatTarih },
  { key: 'guncellik_durumu', header: 'Güncellik Durumu' },
];

// Sözleşme fiyatları export kolonları
export const SOZLESME_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'tedarikci_adi', header: 'Tedarikçi' },
  { key: 'urun_ad', header: 'Ürün Adı' },
  { key: 'urun_kod', header: 'Ürün Kodu' },
  { key: 'fiyat', header: 'Fiyat (TL)', formatter: formatFiyat },
  { key: 'birim', header: 'Birim' },
  { key: 'kategori_ad', header: 'Kategori' },
  { key: 'gecerlilik_baslangic', header: 'Geçerlilik Başlangıç', formatter: formatTarih },
  { key: 'gecerlilik_bitis', header: 'Geçerlilik Bitiş', formatter: formatTarih },
  { key: 'sozlesme_no', header: 'Sözleşme No' },
  { key: 'aktif', header: 'Durum', formatter: (v) => (v ? 'Aktif' : 'Pasif') },
];

// Fiyat geçmişi export kolonları
export const FIYAT_GECMISI_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'urun_ad', header: 'Ürün Adı' },
  { key: 'urun_kod', header: 'Ürün Kodu' },
  { key: 'fiyat', header: 'Fiyat (TL)', formatter: formatFiyat },
  { key: 'kaynak_adi', header: 'Kaynak' },
  { key: 'tarih', header: 'Tarih', formatter: formatTarih },
  { key: 'birim', header: 'Birim' },
];
