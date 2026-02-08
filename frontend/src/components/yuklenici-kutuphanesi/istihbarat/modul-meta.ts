/**
 * Modül Metadata Tanımları
 * ────────────────────────
 * Her istihbarat modülünün gösterim bilgilerini merkezi olarak tanımlar.
 * Hem ModulKarti hem ModulDetay bu listeyi kullanır.
 */

import type { ModulMeta } from '@/types/yuklenici';

/**
 * 8 İstihbarat Modülünün Bilgileri
 * Sıralama: Frontend'de gösterilme sırasıdır.
 */
export const MODUL_LISTESI: ModulMeta[] = [
  {
    ad: 'ihale_gecmisi',
    baslik: 'İhale Geçmişi',
    aciklama: 'ihalebul.com üzerinden ihale geçmişi ve sözleşme bilgileri',
    ikon: 'IconFileText',
    renk: 'blue',
    kaynak: 'ihalebul.com',
    puppeteer: true,
  },
  {
    ad: 'profil_analizi',
    baslik: 'Profil Analizi',
    aciklama: 'Yıllık trendler, rakipler, şehirler ve sektör dağılımı',
    ikon: 'IconChartPie',
    renk: 'grape',
    kaynak: 'ihalebul.com',
    puppeteer: true,
  },
  {
    ad: 'katilimcilar',
    baslik: 'Katılımcılar',
    aciklama: 'İhalelerde yarışan diğer firmalar ve teklif detayları',
    ikon: 'IconUsers',
    renk: 'cyan',
    kaynak: 'ihalebul.com',
    puppeteer: true,
  },
  {
    ad: 'kik_kararlari',
    baslik: 'KİK Kararları',
    aciklama: 'Kamu İhale Kurumu şikayet ve itirazen şikayet kararları',
    ikon: 'IconGavel',
    renk: 'red',
    kaynak: 'ihalebul.com',
    puppeteer: true,
  },
  {
    ad: 'kik_yasaklilar',
    baslik: 'Yasaklı Sorgusu',
    aciklama: 'EKAP üzerinden yasaklılar listesi kontrolü',
    ikon: 'IconShieldOff',
    renk: 'orange',
    kaynak: 'ekap.kik.gov.tr',
    puppeteer: true,
  },
  {
    ad: 'sirket_bilgileri',
    baslik: 'Şirket Bilgileri',
    aciklama: 'MERSİS ve Ticaret Sicil Gazetesi kayıtları',
    ikon: 'IconBuilding',
    renk: 'teal',
    kaynak: 'MERSİS + T. Sicil',
    puppeteer: true,
  },
  {
    ad: 'haberler',
    baslik: 'Haberler',
    aciklama: 'Google News üzerinden güncel haber taraması',
    ikon: 'IconNews',
    renk: 'violet',
    kaynak: 'Google News',
    puppeteer: false,
  },
  {
    ad: 'ai_arastirma',
    baslik: 'AI İstihbarat',
    aciklama: 'Tüm verileri analiz eden yapay zeka destekli kapsamlı rapor',
    ikon: 'IconBrain',
    renk: 'pink',
    kaynak: 'Claude AI',
    puppeteer: false,
  },
];

/**
 * Modül adından meta bilgiye erişim
 */
export function getModulMeta(modulAdi: string): ModulMeta | undefined {
  return MODUL_LISTESI.find(m => m.ad === modulAdi);
}

/**
 * Durum badge renkleri
 */
export function getDurumRenk(durum: string): string {
  switch (durum) {
    case 'tamamlandi': return 'green';
    case 'calisiyor': return 'blue';
    case 'hata': return 'red';
    default: return 'gray';
  }
}

/**
 * Durum Türkçe etiketleri
 */
export function getDurumEtiket(durum: string): string {
  switch (durum) {
    case 'tamamlandi': return 'Tamamlandı';
    case 'calisiyor': return 'Çalışıyor...';
    case 'hata': return 'Hata';
    case 'bekliyor': return 'Bekliyor';
    default: return durum;
  }
}
