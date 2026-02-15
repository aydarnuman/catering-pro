/**
 * Menu Planlama API Servisleri
 * Reçete, malzeme ve maliyet analizi için merkezi API servisleri
 */

import { api } from '@/lib/api';
import type { ApiResponse } from '../types';

// AI malzeme önerisi response tipleri
export interface AiMalzemeItem {
  malzeme_adi: string;
  miktar: number;
  birim?: string;
  urun_kart_id?: number;
  onerilen_urun_adi?: string;
  kategori?: string;
}

export interface AiMalzemeOneriData {
  malzemeler: AiMalzemeItem[];
}

export interface AiBatchSonuc {
  recete_id: number;
  malzemeler: AiMalzemeItem[];
}

export interface AiBatchOneriData {
  sonuclar: AiBatchSonuc[];
}

// Alt Tip & Gramaj Kuralları tipleri
export interface AltTipTanimi {
  id: number;
  kod: string;
  ad: string;
  kategori_id: number | null;
  kategori_adi?: string;
  kategori_ikon?: string;
  kategori_kodu?: string;
  aciklama?: string;
  ikon?: string;
  sira: number;
  aktif: boolean;
}

export interface GramajKurali {
  id: number;
  sartname_id: number;
  alt_tip_id: number;
  alt_tip_kodu?: string;
  alt_tip_adi?: string;
  alt_tip_ikon?: string;
  kategori_adi?: string;
  kategori_ikon?: string;
  kategori_kodu?: string;
  malzeme_tipi: string;
  gramaj: number;
  birim: string;
  aciklama?: string;
  sira: number;
  aktif: boolean;
}

export interface MalzemeEslesme {
  id: number;
  malzeme_tipi: string;
  eslesen_kelimeler: string[];
  urun_kategori_kodlari: string[];
  aciklama?: string;
}

export interface TopluUygulamaSonuc {
  guncellenen_recete: number;
  guncellenen_malzeme: number;
  toplam_recete: number;
  eslesmeyenler: Array<{ recete_id: number; malzeme_tipi: string }>;
}

export interface AiAltTipOneri {
  recete_id: number;
  recete_adi: string;
  oneri: string | null;
  oneri_adi: string | null;
  gecerli: boolean;
  tum_secenekler: Array<{ kod: string; ad: string; aciklama: string }>;
}

export interface AiGramajOlusturSonuc {
  eklenen: number;
  atlanan: number;
  toplam_alt_tip: number;
  kurallar: Array<{
    alt_tip: string;
    malzeme_tipi: string;
    gramaj: number;
    birim: string;
  }>;
}

export interface AiTopluAltTipSonuc {
  oneriler: Array<{
    recete_id: number;
    recete_adi: string;
    kategori?: string;
    oneri: string | null;
    oneri_id?: number | null;
    oneri_adi: string | null;
    mevcut_alt_tip_id?: number | null;
    mesaj?: string;
  }>;
  toplam: number;
  basarili: number;
}

export interface CreatedUrunKarti {
  id: number;
  ad: string;
}

// Reçete
export interface Recete {
  id: number;
  ad: string;
  kategori?: string;
  porsiyon?: number;
  aciklama?: string;
  malzemeler?: Malzeme[];
  toplam_maliyet?: number;
  toplam_piyasa_maliyet?: number;
  created_at?: string;
  updated_at?: string;
  // Backend'den gelen ek alanlar
  kategori_id?: number;
  kategori_adi?: string;
  kategori_ikon?: string;
  porsiyon_miktar?: number;
  tahmini_maliyet?: number;
  malzeme_sayisi?: number;
  kod?: string;
  hazirlik_suresi?: number;
  pisirme_suresi?: number;
  kalori?: number;
  protein?: number;
  karbonhidrat?: number;
  yag?: number;
  ai_olusturuldu?: boolean;
  proje_id?: number;
  proje_adi?: string;
}

// Malzeme
export interface Malzeme {
  id?: number;
  recete_id?: number;
  urun_adi?: string;
  stok_kart_id?: number;
  urun_kart_id?: number;
  miktar: number;
  birim: string;
  sistem_fiyat?: number;
  piyasa_fiyat?: number;
  maliyet?: number;
}

// Reçete Kategorisi
export interface ReceteKategori {
  id: number;
  ad: string;
  aciklama?: string;
}

// Ürün Kartı Fiyat Bilgisi (analiz sayfası için)
export interface UrunKartiFiyat {
  id: number;
  ad: string;
  kod: string | null;
  kategori_id: number | null;
  kategori_adi: string | null;
  varsayilan_birim: string;
  fiyat_birimi: string | null;
  aktif_fiyat: number | null;
  aktif_fiyat_tipi: string | null;
  son_alis_fiyati: number | null;
  manuel_fiyat: number | null;
  guncel_fiyat: number | null;
  son_fiyat_guncelleme: string | null;
  piyasa_fiyati: number | null;
  piyasa_fiyat_tarihi: string | null;
  aktif: boolean;
  recete_sayisi: number;
  // Varyant bilgileri
  ana_urun_id: number | null;
  varyant_sayisi: number;
  varyant_en_ucuz: number | null;
  varyant_en_ucuz_adi: string | null;
}

// Varyant detay bilgisi
export interface UrunVaryant {
  id: number;
  ad: string;
  kod: string | null;
  varyant_tipi: string | null;
  varyant_aciklama: string | null;
  tedarikci_urun_adi: string | null;
  birim: string | null;
  aktif_fiyat: number | null;
  aktif_fiyat_tipi: string | null;
  son_alis_fiyati: number | null;
  manuel_fiyat: number | null;
  son_fiyat_guncelleme: string | null;
  aktif: boolean;
  guncel_fiyat: number | null;
  fiyat_kaynagi: string;
}

// Varyant özet bilgisi
export interface VaryantOzet {
  varyant_sayisi: number;
  fiyatli_varyant_sayisi: number;
  en_ucuz_fiyat: number | null;
  en_ucuz_varyant_adi: string | null;
  en_pahali_fiyat: number | null;
  ortalama_fiyat: number | null;
}

// Varyant listesi response
export interface VaryantListeData {
  varyantlar: UrunVaryant[];
  ozet: VaryantOzet;
}

// Piyasa Sync Durumu
export interface PiyasaSyncDurum {
  isRunning: boolean;
  stats: {
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    lastRunAt: string | null;
    lastError: string | null;
    totalProductsUpdated: number;
  };
  config: {
    schedules: string[];
    maxProductsPerRun: number;
    delayBetweenRequests: number;
  };
  recentLogs: Array<{
    status: string;
    started_at: string;
    finished_at: string;
    details: string;
  }>;
}

// Menu Plan Types
export interface MenuPlanCreatePayload {
  proje_id: number;
  ad: string;
  tip: string;
  baslangic_tarihi: string;
  bitis_tarihi: string;
  varsayilan_kisi_sayisi: number;
}

export interface OgunCreatePayload {
  tarih: string;
  ogun_tipi_id: number;
  kisi_sayisi: number;
}

export interface YemekCreatePayload {
  recete_adi: string;
  sira: number;
  porsiyon_maliyet: number;
}

export interface OgunTipi {
  id: number;
  ad: string;
  kod: string;
  sira: number;
}

// Menu Planlama API
export const menuPlanlamaAPI = {
  /**
   * Projeleri listele
   */
  async getProjeler(): Promise<ApiResponse<unknown[]>> {
    const response = await api.get('/api/menu-planlama/projeler');
    return response.data;
  },

  /**
   * Öğün tiplerini listele
   */
  async getOgunTipleri(): Promise<ApiResponse<OgunTipi[]>> {
    const response = await api.get('/api/menu-planlama/ogun-tipleri');
    return response.data;
  },

  /**
   * Menü planlarını listele
   */
  async getMenuPlanlari(): Promise<ApiResponse<unknown[]>> {
    const response = await api.get('/api/menu-planlama/menu-planlari');
    return response.data;
  },

  /**
   * Menü planı detayını getir (öğünler ve yemekler dahil)
   */
  async getMenuPlanDetay(planId: number): Promise<
    ApiResponse<{
      id: number;
      proje_id: number;
      proje_adi: string;
      ad: string;
      tip: string;
      baslangic_tarihi: string;
      bitis_tarihi: string;
      varsayilan_kisi_sayisi: number;
      toplam_maliyet: number;
      ogunler: Array<{
        id: number;
        tarih: string;
        ogun_tipi_id: number;
        ogun_tip_adi: string;
        ogun_ikon: string;
        kisi_sayisi: number;
        toplam_maliyet: number;
        porsiyon_maliyet: number;
        yemekler: Array<{
          id: number;
          recete_id: number;
          recete_ad: string;
          recete_kategori: string;
          recete_ikon: string;
          sira: number;
          porsiyon_maliyet: number;
          toplam_maliyet: number;
        }> | null;
      }>;
    }>
  > {
    const response = await api.get(`/api/menu-planlama/menu-planlari/${planId}`);
    return response.data;
  },

  /**
   * Menü planı oluştur
   */
  async createMenuPlan(data: MenuPlanCreatePayload): Promise<ApiResponse<{ id: number }>> {
    const response = await api.post('/api/menu-planlama/menu-planlari', data);
    return response.data;
  },

  /**
   * Menü planı adını güncelle
   */
  async updateMenuPlan(planId: number, data: { ad: string }): Promise<ApiResponse<unknown>> {
    const response = await api.put(`/api/menu-planlama/menu-planlari/${planId}`, data);
    return response.data;
  },

  /**
   * Menü planı sil
   */
  async deleteMenuPlan(planId: number): Promise<ApiResponse<{ message: string }>> {
    const response = await api.delete(`/api/menu-planlama/menu-planlari/${planId}`);
    return response.data;
  },

  /**
   * Plana öğün ekle
   */
  async addOgunToPlan(planId: number, data: OgunCreatePayload): Promise<ApiResponse<{ id: number }>> {
    const response = await api.post(`/api/menu-planlama/menu-planlari/${planId}/ogunler`, data);
    return response.data;
  },

  /**
   * Öğüne yemek ekle
   */
  async addYemekToOgun(ogunId: number, data: YemekCreatePayload): Promise<ApiResponse<unknown>> {
    const response = await api.post(`/api/menu-planlama/ogunler/${ogunId}/yemekler`, data);
    return response.data;
  },

  /**
   * Tüm planı tek istekte kaydet (toplu kaydetme)
   */
  async saveFullPlan(data: {
    proje_id?: number | null;
    ad: string;
    tip: string;
    baslangic_tarihi: string;
    bitis_tarihi: string;
    varsayilan_kisi_sayisi: number;
    ogunler: Array<{
      tarih: string;
      ogun_tipi_id: number;
      kisi_sayisi?: number;
      yemekler: Array<{
        recete_id?: number;
        ad: string;
        fiyat: number;
      }>;
    }>;
  }): Promise<ApiResponse<{ plan_id: number; toplam_ogun: number; toplam_yemek: number }>> {
    const response = await api.post('/api/menu-planlama/menu-planlari/toplu-kaydet', data);
    return response.data;
  },

  /**
   * Reçeteleri listele
   * sartname_id verilirse şartnameye göre gramaj/fiyat önizlemesi döner (DB değişmez)
   */
  async getReceteler(params?: {
    kategori?: string;
    arama?: string;
    limit?: number;
    sartname_id?: number;
  }): Promise<ApiResponse<Recete[]>> {
    const response = await api.get('/api/menu-planlama/receteler', { params });
    return response.data;
  },

  /**
   * Reçete detayını getir
   */
  async getRecete(id: number): Promise<ApiResponse<Recete>> {
    const response = await api.get(`/api/menu-planlama/receteler/${id}`);
    return response.data;
  },

  /**
   * Reçete oluştur
   */
  async createRecete(recete: Partial<Recete>): Promise<ApiResponse<Recete>> {
    const response = await api.post('/api/menu-planlama/receteler', recete);
    return response.data;
  },

  /**
   * Reçete güncelle
   */
  async updateRecete(id: number, recete: Partial<Recete>): Promise<ApiResponse<Recete>> {
    const response = await api.put(`/api/menu-planlama/receteler/${id}`, recete);
    return response.data;
  },

  /**
   * Reçete sil
   */
  async deleteRecete(id: number): Promise<ApiResponse<unknown>> {
    const response = await api.delete(`/api/menu-planlama/receteler/${id}`);
    return response.data;
  },

  /**
   * Reçete kategorilerini getir
   */
  async getKategoriler(): Promise<ApiResponse<ReceteKategori[]>> {
    const response = await api.get('/api/menu-planlama/kategoriler');
    return response.data;
  },

  /**
   * Malzeme ekle/güncelle
   */
  async saveMalzeme(receteId: number, malzeme: Partial<Malzeme>): Promise<ApiResponse<Malzeme>> {
    const response = await api.post(`/api/menu-planlama/receteler/${receteId}/malzemeler`, malzeme);
    return response.data;
  },

  /**
   * Malzeme güncelle
   */
  async updateMalzeme(malzemeId: number, malzeme: Partial<Malzeme>): Promise<ApiResponse<Malzeme>> {
    const response = await api.put(`/api/menu-planlama/malzemeler/${malzemeId}`, malzeme);
    return response.data;
  },

  /**
   * Malzeme sil
   */
  async deleteMalzeme(malzemeId: number): Promise<ApiResponse<unknown>> {
    const response = await api.delete(`/api/menu-planlama/malzemeler/${malzemeId}`);
    return response.data;
  },

  /**
   * Reçete maliyet analizi getir
   * Backend BackendMaliyetAnaliziResponse döndürüyor
   */
  async getMaliyetAnalizi(receteId: number): Promise<ApiResponse<unknown>> {
    const response = await api.get(`/api/maliyet-analizi/receteler/${receteId}/maliyet`);
    return response.data;
  },

  /**
   * Reçetelerin maliyet analizini getir
   * sartname_id verilirse şartnameye göre gramaj/fiyat önizlemesi döner (DB değişmez)
   */
  async getRecetelerMaliyet(params?: { sartname_id?: number }): Promise<ApiResponse<Recete[]>> {
    const response = await api.get('/api/menu-planlama/receteler', {
      params: { limit: 1000, ...params },
    });
    return response.data;
  },

  /**
   * AI malzeme önerisi
   */
  async getAiMalzemeOneri(receteId: number, prompt: string): Promise<ApiResponse<AiMalzemeOneriData>> {
    const response = await api.post(`/api/menu-planlama/receteler/${receteId}/ai-malzeme-oneri`, {
      prompt,
    });
    return response.data;
  },

  /**
   * Toplu AI malzeme önerisi
   */
  async batchAiMalzemeOneri(receteIds: number[]): Promise<ApiResponse<AiBatchOneriData>> {
    const response = await api.post('/api/menu-planlama/receteler/batch-ai-malzeme-oneri', {
      recete_ids: receteIds,
    });
    return response.data;
  },

  /**
   * Ürün kartlarını listele (fiyatlarıyla birlikte)
   */
  async getUrunKartlari(params?: {
    kategori_id?: number;
    arama?: string;
    aktif?: string;
  }): Promise<ApiResponse<UrunKartiFiyat[]>> {
    const response = await api.get('/api/menu-planlama/urun-kartlari', { params });
    return response.data;
  },

  /**
   * Ürün kartı oluştur
   */
  async createUrunKarti(data: {
    ad: string;
    kategori_id?: number;
    varsayilan_birim?: string;
    fiyat_birimi?: string;
  }): Promise<ApiResponse<CreatedUrunKarti>> {
    const response = await api.post('/api/menu-planlama/urun-kartlari', data);
    return response.data;
  },

  /**
   * Ürün kartı varyantlarını listele
   */
  async getUrunVaryantlari(urunKartId: number): Promise<ApiResponse<VaryantListeData>> {
    const response = await api.get(`/api/menu-planlama/urun-kartlari/${urunKartId}/varyantlar`);
    return response.data;
  },

  /**
   * Şartname listesini getir
   */
  async getSartnameListesi(): Promise<ApiResponse<unknown[]>> {
    const response = await api.get('/api/menu-planlama/sartname/liste');
    return response.data;
  },

  /**
   * Şartname detayını getir
   */
  async getSartnameDetay(sartnameId: number): Promise<ApiResponse<unknown>> {
    const response = await api.get(`/api/menu-planlama/sartname/${sartnameId}`);
    return response.data;
  },

  /**
   * Şartname oluştur
   */
  /** Şartname sil (soft delete) */
  async deleteSartname(sartnameId: number): Promise<ApiResponse<unknown>> {
    const response = await api.put(`/api/menu-planlama/sartname/${sartnameId}`, { aktif: false });
    return response.data;
  },

  async createSartname(data: { ad: string; kod?: string; kurum_id?: number }): Promise<ApiResponse<{ id: number }>> {
    const response = await api.post('/api/menu-planlama/sartname', data);
    return response.data;
  },

  /**
   * Şartnameye gramaj ekle
   */
  async addGramaj(
    sartnameId: number,
    data: {
      yemek_turu: string;
      porsiyon_gramaj: number;
      birim: string;
      birim_fiyat?: number;
    }
  ): Promise<ApiResponse<unknown>> {
    const response = await api.post(`/api/menu-planlama/sartname/${sartnameId}/gramaj`, data);
    return response.data;
  },

  /**
   * Gramaj güncelle
   */
  async updateGramaj(
    gramajId: number,
    data: {
      yemek_turu?: string;
      porsiyon_gramaj?: number;
      birim?: string;
    }
  ): Promise<ApiResponse<unknown>> {
    const response = await api.put(`/api/menu-planlama/sartname/gramaj/${gramajId}`, data);
    return response.data;
  },

  /**
   * Gramaj sil
   */
  async deleteGramaj(gramajId: number): Promise<ApiResponse<unknown>> {
    const response = await api.delete(`/api/menu-planlama/sartname/gramaj/${gramajId}`);
    return response.data;
  },

  /**
   * Stok kartları listesi (arama için)
   */
  async getStokKartlariListesi(arama: string): Promise<ApiResponse<unknown[]>> {
    const response = await api.get('/api/menu-planlama/stok-kartlari-listesi', {
      params: { arama },
    });
    return response.data;
  },

  /**
   * Piyasa fiyat senkronizasyon durumunu getir
   */
  async getPiyasaSyncDurum(): Promise<ApiResponse<PiyasaSyncDurum>> {
    const response = await api.get('/api/planlama/piyasa/sync/durum');
    return response.data;
  },

  /**
   * Piyasa fiyat senkronizasyonunu manuel tetikle
   */
  async tetiklePiyasaSync(): Promise<ApiResponse<{ message: string }>> {
    const response = await api.post('/api/planlama/piyasa/sync/tetikle');
    return response.data;
  },

  // =============================================
  // ALT TİP & GRAMAJ KURALLARI (YENİ SİSTEM)
  // =============================================

  /** Alt tipleri listele (kategori gruplanmış) */
  async getAltTipler(): Promise<ApiResponse<AltTipTanimi[]>> {
    const response = await api.get('/api/menu-planlama/sartname/alt-tipler');
    return response.data;
  },

  /** Alt tip ekle */
  async createAltTip(data: {
    kod: string;
    ad: string;
    kategori_id?: number;
    aciklama?: string;
    ikon?: string;
  }): Promise<ApiResponse<AltTipTanimi>> {
    const response = await api.post('/api/menu-planlama/sartname/alt-tipler', data);
    return response.data;
  },

  /** Şartnamenin gramaj kurallarını getir */
  async getGramajKurallari(sartnameId: number): Promise<ApiResponse<GramajKurali[]>> {
    const response = await api.get(`/api/menu-planlama/sartname/${sartnameId}/gramaj-kurallari`);
    return response.data;
  },

  /** Gramaj kuralı ekle */
  async addGramajKurali(
    sartnameId: number,
    data: { alt_tip_id: number; malzeme_tipi: string; gramaj: number; birim?: string; aciklama?: string }
  ): Promise<ApiResponse<GramajKurali>> {
    const response = await api.post(`/api/menu-planlama/sartname/${sartnameId}/gramaj-kurallari`, data);
    return response.data;
  },

  /** Gramaj kuralı güncelle */
  async updateGramajKurali(
    kuralId: number,
    data: { malzeme_tipi?: string; gramaj?: number; birim?: string; aciklama?: string }
  ): Promise<ApiResponse<GramajKurali>> {
    const response = await api.put(`/api/menu-planlama/sartname/gramaj-kurallari/${kuralId}`, data);
    return response.data;
  },

  /** Gramaj kuralı sil */
  async deleteGramajKurali(kuralId: number): Promise<ApiResponse<unknown>> {
    const response = await api.delete(`/api/menu-planlama/sartname/gramaj-kurallari/${kuralId}`);
    return response.data;
  },

  /** Malzeme eşleme sözlüğünü getir */
  async getMalzemeEslesmeleri(): Promise<ApiResponse<MalzemeEslesme[]>> {
    const response = await api.get('/api/menu-planlama/sartname/malzeme-eslesmeleri');
    return response.data;
  },

  /** Reçete–şartname gramaj uyum kontrolü (uygun/düşük/yüksek/eksik) */
  async getGramajKontrol(
    receteId: number,
    params?: { sartname_id?: number; proje_id?: number }
  ): Promise<
    ApiResponse<{
      recete: Record<string, unknown>;
      malzemeler: Array<Record<string, unknown>>;
      gramaj_kontrol: {
        sartname_id: number;
        alt_tip: string;
        sonuclar: Array<{
          malzeme_adi: string | null;
          malzeme_tipi: string;
          recete_gramaj: number | null;
          hedef_gramaj: number;
          birim: string;
          durum: 'uygun' | 'dusuk' | 'yuksek' | 'eksik';
        }>;
        uygun_sayisi: number;
        uyumsuz_sayisi: number;
        toplam_kontrol: number;
      } | null;
      mesaj?: string;
    }>
  > {
    const response = await api.get(`/api/menu-planlama/recete/${receteId}/gramaj-kontrol`, { params });
    return response.data;
  },

  /** Reçete + şartname gramaj önizlemesi (modal için - yeni sistem) */
  async getReceteSartnameGramajOnizleme(
    receteId: number,
    sartnameId: number
  ): Promise<
    ApiResponse<{
      malzemeler: Array<{
        id: number;
        malzeme_adi: string;
        mevcut_miktar: number;
        mevcut_birim: string;
        sartname_gramaj: number | null;
        sartname_birim: string | null;
        kullanilan_miktar: number;
        kullanilan_birim: string;
        hesaplanan_fiyat: number;
        malzeme_tipi: string | null;
        birim_fiyat: number;
      }>;
      alt_tip_id: number | null;
      alt_tip_adi: string | null;
      toplam_maliyet: number;
    }>
  > {
    const response = await api.get(
      `/api/menu-planlama/recete/${receteId}/sartname/${sartnameId}/gramaj-onizleme`
    );
    return response.data;
  },

  /** Toplu gramaj uygula */
  async topluGramajUygula(
    sartnameId: number,
    data: { recete_ids?: number[]; kategori_id?: number; alt_tip_id?: number }
  ): Promise<ApiResponse<TopluUygulamaSonuc>> {
    const response = await api.post(`/api/menu-planlama/sartname/${sartnameId}/toplu-uygula`, data);
    return response.data;
  },

  /** Tek reçete için AI alt tip önerisi */
  async aiAltTipOneri(receteId: number): Promise<ApiResponse<AiAltTipOneri>> {
    const response = await api.post(`/api/menu-planlama/receteler/${receteId}/ai-alt-tip-oneri`);
    return response.data;
  },

  /** Toplu AI alt tip önerisi */
  async aiTopluAltTipOneri(data: {
    recete_ids?: number[];
    alt_tipsiz?: boolean;
  }): Promise<ApiResponse<AiTopluAltTipSonuc>> {
    const response = await api.post('/api/menu-planlama/receteler/ai-toplu-alt-tip-oneri', data);
    return response.data;
  },

  /** Toplu alt tip uygulama */
  async topluAltTipUygula(
    atamalar: Array<{ recete_id: number; alt_tip_kod: string }>
  ): Promise<ApiResponse<{ basarili: number; toplam: number }>> {
    const response = await api.post('/api/menu-planlama/receteler/toplu-alt-tip-uygula', { atamalar });
    return response.data;
  },

  /** Reçetenin alt tip'ini güncelle */
  async updateReceteAltTip(receteId: number, altTipId: number): Promise<ApiResponse<unknown>> {
    const response = await api.put(`/api/menu-planlama/receteler/${receteId}`, { alt_tip_id: altTipId });
    return response.data;
  },

  /** AI ile gramaj kuralları oluştur */
  async aiGramajOlustur(
    sartnameId: number,
    data?: { alt_tip_ids?: number[]; profil?: string }
  ): Promise<ApiResponse<AiGramajOlusturSonuc>> {
    const response = await api.post(`/api/menu-planlama/sartname/${sartnameId}/ai-gramaj-olustur`, data || {});
    return response.data;
  },
};
