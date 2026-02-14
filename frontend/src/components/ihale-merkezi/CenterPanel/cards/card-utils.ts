/**
 * Kart bilesenleri icin paylasilmis yardimci fonksiyonlar.
 * OzetCards.tsx'ten cikarilmistir.
 */

/** Gercek personel pozisyonu mu, yoksa is yeri/lokasyon mu ayirt et */
export function isRealPersonelPosition(pozisyon: string): boolean {
  if (!pozisyon) return false;
  const trimmed = pozisyon.trim();
  if (/^\d+$/.test(trimmed)) return false;
  if (trimmed.length <= 2) return false;
  const lower = trimmed.toLowerCase();
  const personelKeywords = [
    'aşçı', 'asci', 'aşçıbaşı', 'ascibaşi', 'aşçı başı', 'garson',
    'bulaşıkçı', 'bulasikci', 'temizlik', 'şoför', 'sofor', 'diyetisyen',
    'gıda mühendis', 'gida muhendis', 'gıda teknik', 'gida teknik',
    'kasap', 'fırıncı', 'firinci', 'pastacı', 'pastaci', 'müdür', 'mudur',
    'sorumlu', 'yardımcı', 'yardimci', 'kalfa', 'usta', 'çamaşırcı',
    'camasirci', 'toplam', 'personel', 'işçi', 'isci', 'eleman',
    'diyet aşçı', 'diyet asci', 'kumanyacı', 'kumanyaci', 'depocu', 'ambar',
  ];
  const locationKeywords = [
    'hastane', 'hospital', 'eah', 'üniversite', 'universite', 'okul',
    'lise', 'ilkokul', 'ortaokul', 'fakülte', 'fakulte', 'enstitü', 'enstitu',
    'müdürlüğü', 'mudurlugu', 'başkanlığı', 'baskanligi', 'merkez', 'bina',
    'lojman', 'kışla', 'kisla', 'karakol', 'cezaevi', 'tesis', 'kampüs',
    'kampus', 'şube', 'sube', 'ilçe', 'ilce', 'il ', 'prof.', 'prof ',
    'dr.', 'şehit', 'fizik tedavi', 'rehabilitasyon', 'devlet',
    'eğitim ve araştırma', 'acil durum', 'sağlık', 'saglik', 'poliklinik',
    'dispanser', 'adsm', 'asm', 'tsm', 'trsm',
  ];
  if (locationKeywords.some((kw) => lower.includes(kw))) return false;
  if (personelKeywords.some((kw) => lower.includes(kw))) return true;
  return true;
}

/** Teknik sart metnini cikar (string veya object olabilir) */
export function getTeknikSartTextFromItem(sart: unknown): string {
  if (!sart) return '';
  if (typeof sart === 'string') return sart;
  if (typeof sart === 'object') {
    const obj = sart as Record<string, unknown>;
    return String(obj.madde || obj.text || obj.description || JSON.stringify(sart));
  }
  return String(sart);
}
