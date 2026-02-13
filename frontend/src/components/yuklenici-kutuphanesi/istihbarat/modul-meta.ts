/**
 * Modül Metadata Tanımları
 * ────────────────────────
 * Dock'ta 5 grup gösterilir. Her grup 1+ backend modülü kapsar.
 * Backend'de 8 modül bağımsız çalışır, frontend sadece gruplayarak gösterir.
 */

import type { DockGrupAdi, DockGrupMeta, IstihbaratModul, ModulDurum, ModulMeta } from '@/types/yuklenici';

// ─── Dock Grup Tanımları (5 adet — UI'da gösterilen) ───────────

export const DOCK_GRUPLARI: DockGrupMeta[] = [
  {
    ad: 'ihale_performansi',
    baslik: 'İhale Performansı',
    aciklama: 'İhale geçmişi, profil analizi ve katılımcılar — tek panelde',
    ikon: 'IconChartPie',
    renk: 'blue',
    kaynak: 'ihalebul.com',
    moduller: ['ihale_gecmisi', 'profil_analizi', 'katilimcilar'],
  },
  // ─── MERKEZ: Şirket Kimliği (özel görünüm) ───
  {
    ad: 'sirket_bilgileri',
    baslik: 'Şirket Kimliği',
    aciklama: 'MERSİS ve Ticaret Sicil Gazetesi kayıtları — Resmi firma profili',
    ikon: 'IconBuilding',
    renk: 'teal',
    kaynak: 'MERSİS + T. Sicil',
    moduller: ['sirket_bilgileri'],
  },
  {
    ad: 'hukuki_durum',
    baslik: 'Hukuki Durum',
    aciklama: 'KİK kararları ve EKAP yasaklı sorgusu — tek panelde',
    ikon: 'IconShieldOff',
    renk: 'red',
    kaynak: 'KİK + EKAP',
    moduller: ['kik_kararlari', 'kik_yasaklilar'],
  },
  {
    ad: 'haberler',
    baslik: 'Haberler',
    aciklama: 'Google News üzerinden güncel haber taraması',
    ikon: 'IconNews',
    renk: 'violet',
    kaynak: 'Google News',
    moduller: ['haberler'],
  },
  {
    ad: 'ai_arastirma',
    baslik: 'AI İstihbarat',
    aciklama: 'Tüm verileri analiz eden yapay zeka destekli kapsamlı rapor',
    ikon: 'IconBrain',
    renk: 'pink',
    kaynak: 'Claude AI',
    moduller: ['ai_arastirma'],
  },
];

// ─── Eski 8'li liste (geriye uyumluluk — backend API'leriyle eşleşir) ───

export const MODUL_LISTESI: ModulMeta[] = [
  {
    ad: 'veri_havuzu',
    baslik: 'Veri Havuzu',
    aciklama: 'Merkez web istihbarat verisi — Tavily aramaları ve çapraz kontrol',
    ikon: 'IconDatabase',
    renk: 'indigo',
    kaynak: 'Tavily + DB',
    puppeteer: false,
  },
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
    ad: 'sirket_bilgileri',
    baslik: 'Şirket Kimliği',
    aciklama: 'MERSİS ve Ticaret Sicil Gazetesi kayıtları',
    ikon: 'IconBuilding',
    renk: 'teal',
    kaynak: 'MERSİS + T. Sicil',
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
    aciklama: 'Tüm verileri analiz eden yapay zeka destekli rapor',
    ikon: 'IconBrain',
    renk: 'pink',
    kaynak: 'Claude AI',
    puppeteer: false,
  },
];

// ─── Yardımcı Fonksiyonlar ───────────────────────────────────

/** Grup adından meta bilgiye erişim */
export function getDockGrupMeta(grupAdi: DockGrupAdi): DockGrupMeta | undefined {
  return DOCK_GRUPLARI.find((g) => g.ad === grupAdi);
}

/** Eski uyumluluk: modül adından meta bilgiye erişim */
export function getModulMeta(modulAdi: string): ModulMeta | undefined {
  return MODUL_LISTESI.find((m) => m.ad === modulAdi);
}

/**
 * Bir grubun birleşik durumunu hesapla:
 * - Herhangi biri 'calisiyor' → 'calisiyor'
 * - Herhangi biri 'hata' (ve hiçbiri calisiyor değilse) → 'hata'
 * - Hepsi 'tamamlandi' → 'tamamlandi'
 * - Aksi halde → 'bekliyor'
 */
export function getGrupDurum(grupAdi: DockGrupAdi, moduller: IstihbaratModul[]): ModulDurum {
  const grup = DOCK_GRUPLARI.find((g) => g.ad === grupAdi);
  if (!grup) return 'bekliyor';

  const altModuller = grup.moduller.map((ad) => moduller.find((m) => m.modul === ad));
  const durumlar = altModuller.map((m) => m?.durum ?? 'bekliyor');

  if (durumlar.some((d) => d === 'calisiyor')) return 'calisiyor';
  if (durumlar.every((d) => d === 'tamamlandi')) return 'tamamlandi';
  if (durumlar.some((d) => d === 'hata')) return 'hata';
  return 'bekliyor';
}

/**
 * Bir grubun en son güncelleme zamanını al
 * (alt modüllerin en güncel updated_at değeri)
 */
export function getGrupSonGuncelleme(grupAdi: DockGrupAdi, moduller: IstihbaratModul[]): string | null {
  const grup = DOCK_GRUPLARI.find((g) => g.ad === grupAdi);
  if (!grup) return null;

  let enYeni: string | null = null;
  for (const ad of grup.moduller) {
    const m = moduller.find((mod) => mod.modul === ad);
    const ts = m?.updated_at || m?.son_guncelleme;
    if (ts && (!enYeni || ts > enYeni)) enYeni = ts;
  }
  return enYeni;
}

/** Durum badge renkleri */
export function getDurumRenk(durum: string): string {
  switch (durum) {
    case 'tamamlandi':
      return 'green';
    case 'calisiyor':
      return 'blue';
    case 'hata':
      return 'red';
    default:
      return 'gray';
  }
}

/** Durum Türkçe etiketleri */
export function getDurumEtiket(durum: string): string {
  switch (durum) {
    case 'tamamlandi':
      return 'Tamamlandı';
    case 'calisiyor':
      return 'Çalışıyor...';
    case 'hata':
      return 'Hata';
    case 'bekliyor':
      return 'Bekliyor';
    default:
      return durum;
  }
}
