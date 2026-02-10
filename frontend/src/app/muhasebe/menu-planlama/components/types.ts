import type { MaliyetOzetItem } from '@/lib/api/services/fatura-kalemleri';

// ─── Navigasyon Tipleri ───────────────────────────────────────────

export type SidebarCategory = 'planlama' | 'katalog' | 'analiz';

// ─── Reçete / Yemek Tipleri ───────────────────────────────────────

export interface ReceteYemek {
  id: number;
  kod?: string;
  ad: string;
  kategori?: string;
  sistem_maliyet?: number;
  piyasa_maliyet?: number;
  fatura_maliyet?: number;
  fatura_guncel?: boolean;
  piyasa_guncel?: boolean;
  fiyat_uyari?: string;
  kalori?: number;
  // Yeni alanlar (backend'den gelen veri formatına uygun)
  fiyat?: number;
  fatura_fiyat?: number;
  piyasa_fiyat?: number;
  porsiyon?: number;
}

export interface KategoriInfo {
  kod: string;
  ad: string;
  ikon: string;
  renk: string;
}

export interface ReceteKategori {
  kod: string;
  ad: string;
  ikon: string;
  renk?: string;
  yemekler: ReceteYemek[];
}

export interface SeciliYemek {
  id: string;
  recete_id: number;
  kategori: string;
  ad: string;
  fiyat: number;
  fatura_fiyat?: number;
  piyasa_fiyat?: number;
}

export interface Malzeme {
  id: number;
  malzeme_adi: string;
  miktar: number;
  birim: string;
  stok_kart_id: number | null;
  stok_adi: string | null;
  sistem_fiyat: number | null;
  piyasa_fiyat: number | null;
  stok_birim: string | null;
  fiyat_kaynagi?: string | null;
  varyant_kaynak_adi?: string | null;
  varyant_sayisi?: number;
}

export interface ReceteDetay {
  id: number;
  kod: string;
  ad: string;
  kategori: string;
  porsiyon_gram: number;
  sistem_maliyet: number;
  piyasa_maliyet: number;
  malzemeler: Malzeme[];
}

// ─── Backend Response Tipleri ─────────────────────────────────────

// Backend'den gelen reçete response type'ı
export interface BackendReceteResponse {
  id: number;
  kod: string | null;
  ad: string;
  kategori_id: number | null;
  kategori_adi: string | null;
  kategori_ikon: string | null;
  porsiyon_miktar: number | null;
  hazirlik_suresi: number | null;
  pisirme_suresi: number | null;
  kalori: number | null;
  protein: number | null;
  karbonhidrat: number | null;
  yag: number | null;
  tahmini_maliyet: number | null;
  ai_olusturuldu: boolean | null;
  proje_id: number | null;
  proje_adi: string | null;
  created_at: string | null;
  malzeme_sayisi: number;
}

// Backend'den gelen maliyet analizi response type'ı
export interface BackendMaliyetAnaliziResponse {
  recete: {
    id: number;
    ad: string;
    kod: string | null;
    kategori: string | null;
    ikon: string | null;
    porsiyon: number | null;
    kalori: number | null;
    protein: number | null;
  };
  malzemeler: Array<{
    id: number;
    malzeme_adi: string;
    miktar: number;
    birim: string;
    sistem_fiyat: number;
    piyasa_fiyat: number;
    sistem_toplam: number;
    piyasa_toplam: number;
    piyasa_detay: {
      min: number;
      max: number;
      ort: number;
      tarih: string;
    } | null;
    fiyat_kaynagi?: string | null;
    varyant_kaynak_adi?: string | null;
    varyant_sayisi?: number;
  }>;
  maliyet: {
    sistem: number;
    piyasa: number;
    fark: number;
    fark_yuzde: string;
  };
}

// ─── Şartname Tipleri ─────────────────────────────────────────────

export interface SartnameGramaj {
  id: number;
  yemek_turu: string;
  malzeme_adi?: string;
  porsiyon_gramaj: number;
  birim: string;
  birim_fiyat?: number;
}

export interface SartnameSet {
  id: number;
  kod: string;
  ad: string;
  kurum_adi?: string;
  yil?: number;
  gramajlar?: SartnameGramaj[];
}

// ─── Fiyat Analizi Tipleri ────────────────────────────────────────

// Ürün detay modal – FiyatListeUrun (maliyet özeti + display alanları)
export type SeciliUrunDetayType = MaliyetOzetItem & {
  product_name: string;
  category: string | null;
  urun_id: number;
  avg_unit_price: number;
  min_unit_price: number;
  max_unit_price: number;
  total_amount: number;
  total_quantity: number;
  invoice_count: number;
  clean_product_name?: string;
  standard_unit?: string;
  price_per_unit?: number;
  fiyat_kaynagi?: 'fatura' | 'gecmis' | 'manuel' | null;
  /** urun_kartlari.aktif_fiyat_tipi: FATURA | MANUEL | VARSAYILAN | PIYASA | null */
  aktif_fiyat_tipi?: string | null;
  /** urun_kartlari.manuel_fiyat */
  manuel_fiyat?: number | null;
  /** urun_kartlari.son_alis_fiyati (fatura fiyatı) */
  son_alis_fiyati?: number | null;
  raf_fiyat?: number | null;
  raf_fiyat_tarihi?: string | null;
};

// Son işlemler tablosu satır tipi
export type SonIslemRow = {
  id?: number;
  invoice_date?: string;
  invoice_no?: string;
  supplier_name?: string;
  unit_price?: number;
  quantity?: number;
  line_total?: number;
  description?: string;
  unit?: string;
};

// Tedarikçi analizi satır tipi
export type TedarikciAnalizRow = {
  supplier_name: string;
  invoice_count: number;
  total_quantity: number;
  total_amount: number;
  avg_unit_price: number;
  min_unit_price: number;
  max_unit_price: number;
};

// ─── Gramaj Component Tipleri ─────────────────────────────────────

export interface GramajEditableRowProps {
  gramaj: {
    id: number;
    yemek_turu: string;
    porsiyon_gramaj: number;
    birim: string;
    birim_fiyat?: number;
  };
  sartnameId: number;
  onUpdate: (
    gramajId: number,
    sartnameId: number,
    data: { yemek_turu?: string; porsiyon_gramaj?: number; birim?: string }
  ) => void;
  onDelete: (gramajId: number, sartnameId: number) => void;
}

// Ürün arama tipi
export interface UrunKartiOption {
  id: number;
  kod: string;
  ad: string;
  birim: string;
  son_alis_fiyat?: number;
}

// Yeni Gramaj Ekleme Satırı props
export interface GramajNewRowProps {
  sartnameId: number;
  onAdd: (
    sartnameId: number,
    malzeme: string,
    gramaj: number,
    birim: string,
    birimFiyat?: number
  ) => void;
}

// ─── Sabitler ─────────────────────────────────────────────────────

// Varsayılan kategoriler (backend'den gelmezse kullanılacak)
export const VARSAYILAN_KATEGORILER: KategoriInfo[] = [
  { kod: 'corba', ad: 'Çorbalar', ikon: '🥣', renk: 'orange' },
  { kod: 'sebze', ad: 'Sebze Yemekleri', ikon: '🥬', renk: 'green' },
  { kod: 'bakliyat', ad: 'Bakliyat', ikon: '🫘', renk: 'yellow' },
  { kod: 'tavuk', ad: 'Tavuk Yemekleri', ikon: '🍗', renk: 'orange' },
  { kod: 'et', ad: 'Et Yemekleri', ikon: '🥩', renk: 'red' },
  { kod: 'balik', ad: 'Balık', ikon: '🐟', renk: 'blue' },
  { kod: 'pilav', ad: 'Pilav & Makarna', ikon: '🍚', renk: 'cyan' },
  { kod: 'salata', ad: 'Salatalar', ikon: '🥗', renk: 'lime' },
  { kod: 'tatli', ad: 'Tatlılar', ikon: '🍮', renk: 'pink' },
  { kod: 'icecek', ad: 'İçecekler', ikon: '🥛', renk: 'grape' },
];
