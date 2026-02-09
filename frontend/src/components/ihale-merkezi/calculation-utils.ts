/**
 * KİK İhale Hesaplama Sabitleri ve Yardımcı Fonksiyonlar
 * İhale türü katsayıları yıllık güncellenir (KİK 2025-2026)
 */

// ─── Types ─────────────────────────────────────────────────────

export interface TeklifItem {
  firma: string;
  tutar: number;
}

export type ActiveTool = 'temel' | 'sinir' | 'asiri' | 'teminat';
export type IhaleTuru = 'hizmet' | 'yapim_ustyapi' | 'yapim_altyapi';

// ─── Constants ─────────────────────────────────────────────────

/** İhale türleri için R ve N katsayıları (KİK 2025-2026) */
export const IHALE_KATSAYILARI: Record<IhaleTuru, { katsayi: number; aciklama: string }> = {
  hizmet: {
    katsayi: 0.9, // R katsayısı - KİK tarafından yıllık güncellenir
    aciklama: 'Hizmet Alımı (R=0.90)',
  },
  yapim_ustyapi: {
    katsayi: 1.0, // N katsayısı - B,C,D,E grupları
    aciklama: 'Yapım İşi - Üstyapı (N=1.00)',
  },
  yapim_altyapi: {
    katsayi: 1.2, // N katsayısı - A grubu
    aciklama: 'Yapım İşi - Altyapı (N=1.20)',
  },
};

// ─── Utility Functions ─────────────────────────────────────────

/** İş süresini string'den ay olarak parse et */
export function parseIsSuresiAy(sure: string | undefined): number {
  if (!sure) return 0;
  const match = sure.match(/(\d+)/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (sure.toLowerCase().includes('yıl') || sure.toLowerCase().includes('yil')) {
      return num * 12;
    }
    return num;
  }
  return 0;
}

/** KİK Formülü ile sınır değer hesapla */
export function hesaplaKikSinirDegerFormul(
  teklifler: TeklifItem[],
  yaklasikMaliyet: number,
  ihaleTuru: IhaleTuru
): { sinirDeger: number; gecerliSayisi: number; elenenSayisi: number } | null {
  const gecerliTeklifler = teklifler.filter((t) => t.tutar > 0).map((t) => t.tutar);

  if (gecerliTeklifler.length < 3) return null;
  if (yaklasikMaliyet <= 0) return null;

  const n = gecerliTeklifler.length;

  // Geçerli teklifler: YM'nin %60'ından düşük ve YM'den yüksek olanlar hariç
  const gecerliTekliflerFiltreli = gecerliTeklifler.filter(
    (t) => t >= yaklasikMaliyet * 0.6 && t <= yaklasikMaliyet
  );

  const nFiltreli = gecerliTekliflerFiltreli.length;
  const toplamFiltreli = gecerliTekliflerFiltreli.reduce((a, b) => a + b, 0);

  // Katsayıyı al (R veya N)
  const katsayi = IHALE_KATSAYILARI[ihaleTuru].katsayi;

  // KİK Formülü: SD = ((YM + ∑Tn) / (n+1)) × R
  const sinir = ((yaklasikMaliyet + toplamFiltreli) / (nFiltreli + 1)) * katsayi;

  // Alt sınır: YM'nin %40'ından düşük olamaz
  const sonuc = Math.max(Math.round(sinir), Math.round(yaklasikMaliyet * 0.4));

  return {
    sinirDeger: sonuc,
    gecerliSayisi: nFiltreli,
    elenenSayisi: n - nFiltreli,
  };
}

/** Basit sınır değer hesabı (yaklaşık %85) */
export function hesaplaBasitSinirDeger(yaklasikMaliyet: number): number {
  return yaklasikMaliyet > 0 ? Math.round(yaklasikMaliyet * 0.85) : 0;
}

/** Teminat hesapla */
export function hesaplaTeminatlar(bizimTeklif: number) {
  return {
    geciciTeminat: bizimTeklif > 0 ? bizimTeklif * 0.03 : 0,
    kesinTeminat: bizimTeklif > 0 ? bizimTeklif * 0.06 : 0,
  };
}

/** Risk analizi */
export function hesaplaRiskAnalizi(bizimTeklif: number, sinirDeger: number) {
  const isAsiriDusuk = bizimTeklif > 0 && sinirDeger > 0 && bizimTeklif < sinirDeger;
  const fark = bizimTeklif > 0 && sinirDeger > 0 ? bizimTeklif - sinirDeger : 0;
  const farkYuzde =
    sinirDeger > 0 && bizimTeklif > 0 ? ((bizimTeklif - sinirDeger) / sinirDeger) * 100 : 0;

  return { isAsiriDusuk, fark, farkYuzde };
}
