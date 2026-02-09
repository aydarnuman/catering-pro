/**
 * FATURA KALEMLERİ API - TEK KAYNAK
 *
 * Tüm frontend fatura kalem işlemleri bu servis üzerinden.
 * Başka API servisi kullanmak YASAK.
 *
 * Backend: /api/fatura-kalemleri
 */

import { api } from '@/lib/api';

const BASE_URL = '/api/fatura-kalemleri';

// ==================== TİPLER ====================

export interface FaturaOzet {
  ettn: string;
  fatura_no: string;
  tedarikci_vkn: string;
  tedarikci_ad: string;
  fatura_tarihi: string;
  toplam_tutar: number;
  toplam_kalem: number;
  eslesen_kalem: number;
  eslesme_yuzdesi: number;
}

/** Fiyat güncelleme bilgisi (eşleştirme sonrası döner) */
export interface FiyatGuncelleme {
  guncellendi: boolean;
  urun_ad?: string;
  eski_fiyat?: number | null;
  yeni_fiyat?: number;
  sebep?: string;
}

export interface FaturaKalem {
  id: number;
  fatura_ettn: string;
  kalem_sira: number;
  orijinal_urun_adi: string;
  orijinal_urun_kodu: string | null;
  miktar: number;
  birim: string;
  birim_fiyat: number;
  tutar: number;
  kdv_orani: number;
  kdv_tutari: number;
  tedarikci_vkn: string;
  tedarikci_ad: string;
  fatura_tarihi: string;
  urun_id: number | null;
  urun_kod: string | null;
  urun_ad: string | null;
  kategori_ad: string | null;
  eslestirme_tarihi: string | null;
}

export interface UrunArama {
  id: number;
  kod: string;
  ad: string;
  kategori_id: number | null;
  kategori_ad: string | null;
  son_fiyat: number | null;
  ortalama_fiyat: number | null;
}

export interface GuncelFiyat {
  id: number;
  kod: string;
  ad: string;
  kategori_id: number | null;
  son_fiyat: number | null;
  son_fiyat_tarihi: string | null;
  ortalama_fiyat: number | null;
  fatura_sayisi: number;
  fiyat_kaynagi?: 'fatura' | 'gecmis' | 'manuel' | null;
  raf_fiyat?: number | null;
  raf_fiyat_tarihi?: string | null;
}

export interface RafFiyatSonuc {
  id: number;
  urun_kart_id: number;
  stok_kart_id: number | null;
  urun_adi: string;
  piyasa_fiyat_min: number | null;
  piyasa_fiyat_max: number | null;
  piyasa_fiyat_ort: number | null;
  birim_fiyat: number | null;
  kaynaklar: Record<string, unknown> | null;
  arastirma_tarihi: string | null;
  market_adi: string | null;
  marka: string | null;
  ambalaj_miktar: string | null;
  eslestirme_skoru: number | null;
  arama_terimi: string | null;
}

export interface FiyatGecmisi {
  id: number;
  urun_id: number;
  urun_kod: string;
  urun_ad: string;
  orijinal_urun_adi: string;
  tedarikci_vkn: string;
  tedarikci_ad: string;
  miktar: number;
  birim: string;
  birim_fiyat: number;
  tutar: number;
  fatura_tarihi: string;
  fatura_ettn: string;
}

export interface EslesmeDurumu {
  ozet: {
    toplam: number;
    tamEslesen: number;
    kismiEslesen: number;
    hicEslesmemis: number;
  };
  faturalar: Array<{
    fatura_ettn: string;
    fatura_no: string;
    tedarikci: string;
    fatura_tarihi: string;
    toplam_kalem: number;
    eslesen_kalem: number;
    eslesme_yuzdesi: number;
  }>;
}

export interface KategoriHarcama {
  kategori_id: number;
  kategori_ad: string;
  kalem_sayisi: number;
  toplam_tutar: number;
  ortalama_fiyat: number;
}

export interface TedarikciOzet {
  tedarikci_vkn: string;
  tedarikci_ad: string;
  fatura_sayisi: number;
  kalem_sayisi: number;
  toplam_tutar: number;
  ilk_fatura: string;
  son_fatura: string;
}

export interface TedarikciKarsilastirma {
  tedarikci_vkn: string;
  tedarikci_ad: string;
  fatura_sayisi: number;
  ortalama_fiyat: number;
  min_fiyat: number;
  max_fiyat: number;
  son_fatura: string;
}

// Menü maliyet sayfası uyumu (mevcut kullanımlar için)
export interface MaliyetOzetItem {
  urun_id: number;
  urun_kod: string;
  urun_ad: string;
  kategori_id: number | null;
  kategori_ad: string | null;
  fatura_kalem_sayisi: number;
  ortalama_fiyat: number;
  min_fiyat: number;
  max_fiyat: number;
  son_fiyat: number | null;
  son_alis_tarihi: string | null;
  toplam_alinan_miktar: number;
  toplam_harcama: number;
  fiyat_kaynagi?: 'fatura' | 'gecmis' | 'manuel' | null;
  raf_fiyat?: number | null;
  raf_fiyat_tarihi?: string | null;
}

export interface FiyatGecmisiItem {
  urun_id: number;
  urun_kod: string;
  urun_ad: string;
  tedarikci_vkn: string | null;
  tedarikci_ad: string | null;
  birim_fiyat: number;
  miktar: number;
  birim: string | null;
  tutar: number;
  fatura_tarihi: string | null;
  fatura_ettn: string;
  orijinal_urun_adi: string;
}

export interface PriceHistoryData {
  month: string;
  transaction_count?: number;
  total_quantity?: number;
  avg_price: number;
  min_price?: number;
  max_price?: number;
  total_amount?: number;
  change_percent?: number;
  trend?: 'increasing' | 'decreasing' | 'stable';
}

// ==================== API FONKSİYONLARI ====================

async function unwrap<T>(res: {
  data: { success?: boolean; data?: T; error?: string; kaynak?: string };
}): Promise<T> {
  const data = res.data;
  if (!data.success) throw new Error((data as { error?: string }).error || 'İstek başarısız');
  return (data as { data: T }).data as T;
}

export const faturaKalemleriAPI = {
  // ==================== FATURA İŞLEMLERİ ====================

  /** Faturaları listele (özet bilgilerle) */
  async getFaturalar(
    options: {
      baslangic?: string;
      bitis?: string;
      tedarikci_vkn?: string;
      sadece_eslesmemis?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<FaturaOzet[]> {
    const params = new URLSearchParams();
    if (options.baslangic) params.append('baslangic', options.baslangic);
    if (options.bitis) params.append('bitis', options.bitis);
    if (options.tedarikci_vkn) params.append('tedarikci_vkn', options.tedarikci_vkn);
    if (options.sadece_eslesmemis) params.append('sadece_eslesmemis', 'true');
    if (options.limit != null) params.append('limit', String(options.limit));
    if (options.offset != null) params.append('offset', String(options.offset));
    const res = await api.get<{ success: boolean; data: FaturaOzet[]; error?: string }>(
      `${BASE_URL}/faturalar?${params}`
    );
    return unwrap(res);
  },

  /** Fatura kalemlerini getir */
  async getKalemler(ettn: string): Promise<{
    fatura: Record<string, unknown> | null;
    kalemler: FaturaKalem[];
    kaynak: 'cache' | 'uyumsoft';
  }> {
    const res = await api.get<{
      success: boolean;
      data: { fatura: Record<string, unknown> | null; kalemler: FaturaKalem[] };
      kaynak?: 'cache' | 'uyumsoft';
      error?: string;
    }>(`${BASE_URL}/faturalar/${encodeURIComponent(ettn)}/kalemler`);
    const body = res.data as {
      success: boolean;
      data: { fatura: Record<string, unknown> | null; kalemler: FaturaKalem[] };
      kaynak?: 'cache' | 'uyumsoft';
      error?: string;
    };
    if (!body.success) throw new Error(body.error || 'İstek başarısız');
    return { ...body.data, kaynak: body.kaynak ?? 'cache' };
  },

  // ==================== EŞLEŞTİRME İŞLEMLERİ ====================

  /** Fiyat güncelleme bilgisi (eşleştirme sonrası döner) */
  /** Tek kalemi eşleştir - fiyat güncelleme bilgisi ile birlikte. Opsiyonel: birim_carpani, standart_birim (NPL→KG vb. için). */
  async eslesdir(
    ettn: string,
    sira: number,
    urunId: number,
    opts?: { birim_carpani?: number; standart_birim?: string }
  ): Promise<FaturaKalem & { fiyat_guncelleme?: FiyatGuncelleme | null }> {
    const res = await api.post<{
      success: boolean;
      data: FaturaKalem;
      fiyat_guncelleme?: FiyatGuncelleme | null;
      error?: string;
    }>(`${BASE_URL}/faturalar/${encodeURIComponent(ettn)}/kalemler/${sira}/eslesdir`, {
      urun_id: urunId,
      ...opts,
    });
    const body = res.data;
    if (!body.success) throw new Error(body.error || 'İstek başarısız');
    // fiyat_guncelleme bilgisini data'ya ekle
    return { ...body.data, fiyat_guncelleme: body.fiyat_guncelleme };
  },

  /** Toplu eşleştir */
  async topluEslesdir(
    ettn: string,
    eslesmeler: Array<{ sira: number; urun_id: number }>
  ): Promise<{ eslesen: number; toplam: number; sonuclar: unknown[] }> {
    const res = await api.post<{
      success: boolean;
      data: { eslesen: number; toplam: number; sonuclar: unknown[] };
      error?: string;
    }>(`${BASE_URL}/faturalar/${encodeURIComponent(ettn)}/toplu-eslesdir`, { eslesmeler });
    return unwrap(res);
  },

  /** Otomatik eşleştir: Eşleşmemiş kalemleri geçmiş eşleşmelere göre otomatik eşleştirir */
  async topluOtomatikEslesdir(ettn: string): Promise<{ data: { basarili: number } }> {
    const res = await api.post<{
      success: boolean;
      data: { basarili: number };
      error?: string;
    }>(`${BASE_URL}/faturalar/${encodeURIComponent(ettn)}/otomatik-eslesdir`);
    const body = res.data;
    if (!body.success) throw new Error(body.error || 'Otomatik eşleştirme başarısız');
    return { data: (body as { data: { basarili: number } }).data };
  },

  /** Eşleştirmeyi kaldır */
  async eslesmeKaldir(ettn: string, sira: number): Promise<FaturaKalem> {
    const res = await api.delete<{ success: boolean; data: FaturaKalem; error?: string }>(
      `${BASE_URL}/faturalar/${encodeURIComponent(ettn)}/kalemler/${sira}/eslesme`
    );
    return unwrap(res);
  },

  // ==================== ÜRÜN ARAMA ====================

  /** Ürün ara */
  async urunAra(q: string, limit = 20): Promise<UrunArama[]> {
    if (!q || q.length < 2) return [];
    const res = await api.get<{ success: boolean; data: UrunArama[]; error?: string }>(
      `${BASE_URL}/urunler/ara?q=${encodeURIComponent(q)}&limit=${limit}`
    );
    return unwrap(res);
  },

  /** Ürün önerileri (geçmiş eşleşmeler + fuzzy) */
  async urunOnerileri(urunAdi: string, tedarikciVkn?: string): Promise<UrunArama[]> {
    const params = new URLSearchParams({ urun_adi: urunAdi });
    if (tedarikciVkn) params.append('tedarikci_vkn', tedarikciVkn);
    const res = await api.get<{ success: boolean; data: UrunArama[]; error?: string }>(
      `${BASE_URL}/urunler/oneriler?${params}`
    );
    return unwrap(res);
  },

  /** Öneriler – urunOnerileri ile aynı (alias) */
  getOneriler(urun_adi: string, tedarikci_vkn?: string): Promise<UrunArama[]> {
    return this.urunOnerileri(urun_adi, tedarikci_vkn);
  },

  /** Hızlı ürün oluştur */
  async hizliUrunOlustur(urun: {
    ad: string;
    kod?: string;
    kategori_id?: number;
    birim?: string;
  }): Promise<unknown> {
    const res = await api.post<{ success: boolean; data: unknown; error?: string }>(
      `${BASE_URL}/urunler/hizli-olustur`,
      urun
    );
    return unwrap(res);
  },

  /** Hızlı ürün oluştur – body alias (mevcut sayfa uyumu) */
  hizliOlustur(body: {
    ad: string;
    kategori_id?: number;
    birim_id?: number;
    kod?: string;
    birim?: string;
  }): Promise<unknown> {
    return this.hizliUrunOlustur({
      ad: body.ad,
      kategori_id: body.kategori_id,
      birim: body.birim,
      kod: body.kod,
    });
  },

  // ==================== FİYAT SORGULAMA ====================

  /** Güncel fiyatlar */
  async getGuncelFiyatlar(
    options: { kategori_id?: number; sadece_fiyatli?: boolean } = {}
  ): Promise<GuncelFiyat[]> {
    const params = new URLSearchParams();
    if (options.kategori_id != null) params.append('kategori_id', String(options.kategori_id));
    if (options.sadece_fiyatli) params.append('sadece_fiyatli', 'true');
    const res = await api.get<{ success: boolean; data: GuncelFiyat[]; error?: string }>(
      `${BASE_URL}/fiyatlar/guncel?${params}`
    );
    return unwrap(res);
  },

  /** v_urun_guncel_fiyat – menü maliyet alias */
  getGuncelFiyat(params?: {
    kategori_id?: string;
  }): Promise<{ success: boolean; data: GuncelFiyat[] }> {
    return this.getGuncelFiyatlar({
      kategori_id: params?.kategori_id != null ? Number(params.kategori_id) : undefined,
    }).then((data) => ({ success: true, data }));
  },

  /** Fiyat geçmişi */
  async getFiyatGecmisi(urunId: string | number, limit = 50): Promise<FiyatGecmisiItem[]> {
    const res = await api.get<{ success: boolean; data: FiyatGecmisiItem[]; error?: string }>(
      `${BASE_URL}/fiyatlar/${urunId}/gecmis?limit=${limit}`
    );
    return unwrap(res);
  },

  /** Tedarikçi fiyat karşılaştırması */
  async getTedarikciKarsilastirma(urunId: number | string): Promise<TedarikciKarsilastirma[]> {
    const res = await api.get<{ success: boolean; data: TedarikciKarsilastirma[]; error?: string }>(
      `${BASE_URL}/fiyatlar/tedarikci-karsilastirma?urun_id=${urunId}`
    );
    return unwrap(res);
  },

  // ==================== RAPORLAR ====================

  /** Eşleşme durumu */
  async getEslesmeDurumu(): Promise<EslesmeDurumu> {
    const res = await api.get<{ success: boolean; data: EslesmeDurumu; error?: string }>(
      `${BASE_URL}/raporlar/eslesme-durumu`
    );
    return unwrap(res);
  },

  /** Kategori harcama */
  async getKategoriHarcama(
    options: { baslangic?: string; bitis?: string } = {}
  ): Promise<KategoriHarcama[]> {
    const params = new URLSearchParams();
    if (options.baslangic) params.append('baslangic', options.baslangic);
    if (options.bitis) params.append('bitis', options.bitis);
    const res = await api.get<{ success: boolean; data: KategoriHarcama[]; error?: string }>(
      `${BASE_URL}/raporlar/kategori-harcama?${params}`
    );
    return unwrap(res);
  },

  /** Tedarikçi özeti */
  async getTedarikciOzet(
    options: { baslangic?: string; bitis?: string } = {}
  ): Promise<TedarikciOzet[]> {
    const params = new URLSearchParams();
    if (options.baslangic) params.append('baslangic', options.baslangic);
    if (options.bitis) params.append('bitis', options.bitis);
    const res = await api.get<{ success: boolean; data: TedarikciOzet[]; error?: string }>(
      `${BASE_URL}/raporlar/tedarikci-ozet?${params}`
    );
    return unwrap(res);
  },

  /** Maliyet özeti – menü planlama. Backend /urunler/maliyet-ozet yoksa getGuncelFiyatlar ile fallback. */
  async getMaliyetOzet(params?: {
    urun_id?: string;
    kategori_id?: string;
  }): Promise<{ success: boolean; data: MaliyetOzetItem[] }> {
    try {
      const p = new URLSearchParams();
      if (params?.urun_id) p.append('urun_id', params.urun_id);
      if (params?.kategori_id) p.append('kategori_id', params.kategori_id);
      const res = await api.get<{ success: boolean; data: MaliyetOzetItem[]; error?: string }>(
        `${BASE_URL}/urunler/maliyet-ozet?${p}`
      );
      const d = res.data as { success?: boolean; data?: MaliyetOzetItem[] };
      if (d?.success && Array.isArray(d.data)) return { success: true, data: d.data };
    } catch {
      /* fallback */
    }
    const fiyatlar = await this.getGuncelFiyatlar({
      kategori_id: params?.kategori_id != null ? Number(params.kategori_id) : undefined,
      sadece_fiyatli: false,
    });
    const data: MaliyetOzetItem[] = fiyatlar.map((f) => ({
      urun_id: f.id,
      urun_kod: f.kod,
      urun_ad: f.ad,
      kategori_id: f.kategori_id,
      kategori_ad: null,
      fatura_kalem_sayisi: Number(f.fatura_sayisi) || 0,
      ortalama_fiyat: Number(f.ortalama_fiyat) || 0,
      min_fiyat: Number(f.ortalama_fiyat) || 0,
      max_fiyat: Number(f.son_fiyat ?? f.ortalama_fiyat) || 0,
      son_fiyat: f.son_fiyat ?? null,
      son_alis_tarihi: f.son_fiyat_tarihi ?? null,
      toplam_alinan_miktar: 0,
      toplam_harcama: 0,
      fiyat_kaynagi: f.fiyat_kaynagi ?? null,
      raf_fiyat: f.raf_fiyat ?? null,
      raf_fiyat_tarihi: f.raf_fiyat_tarihi ?? null,
    }));
    return { success: true, data };
  },

  /** Raf fiyatı (piyasa) araştırma sonuçları */
  async getRafFiyat(urunId: number | string): Promise<RafFiyatSonuc[]> {
    const res = await api.get<{ success: boolean; data: RafFiyatSonuc[]; error?: string }>(
      `${BASE_URL}/fiyatlar/${urunId}/raf-fiyat`
    );
    return unwrap(res);
  },

  /** Raf fiyatı araştır (Camgöz.net'ten canlı arama tetikle) */
  async rafFiyatArastir(
    urunAdi: string,
    stokKartId?: number
  ): Promise<{
    success: boolean;
    urun: string;
    piyasa?: { min: number; max: number; ortalama: number; kaynaklar: unknown[] };
    karsilastirma?: { fark_yuzde: number; durum: string };
    oneri?: string;
    error?: string;
  }> {
    const res = await api.post<{
      success: boolean;
      urun: string;
      piyasa?: { min: number; max: number; ortalama: number; kaynaklar: unknown[] };
      karsilastirma?: { fark_yuzde: number; durum: string };
      oneri?: string;
      error?: string;
      // Backend bazen { success, data: {...} } formatında da dönebilir
      data?: {
        success: boolean;
        urun: string;
        piyasa?: { min: number; max: number; ortalama: number; kaynaklar: unknown[] };
        karsilastirma?: { fark_yuzde: number; durum: string };
        oneri?: string;
      };
    }>('/api/planlama/piyasa/hizli-arastir', {
      urun_adi: urunAdi,
      stok_kart_id: stokKartId,
    });
    const d = res.data;
    // Backend iki farklı formatta dönebilir:
    // 1) { success, urun, piyasa, ... } (doğrudan)
    // 2) { success, data: { success, urun, piyasa, ... } } (sarmalı)
    const result = d?.data?.piyasa ? d.data : d;
    if (result?.success && result?.piyasa) {
      return result as {
        success: boolean;
        urun: string;
        piyasa: { min: number; max: number; ortalama: number; kaynaklar: unknown[] };
        karsilastirma?: { fark_yuzde: number; durum: string };
        oneri?: string;
      };
    }
    return { success: false, urun: urunAdi, error: (d as { error?: string })?.error || 'Araştırma başarısız' };
  },

  /** Rapor: fiyat geçmişi – getFiyatGecmisi alias */
  getRaporFiyatGecmisi(urunId: string, limit = 50): Promise<FiyatGecmisiItem[]> {
    return this.getFiyatGecmisi(urunId, limit);
  },

  /** Rapor: maliyet özeti – getMaliyetOzet alias */
  getRaporMaliyetOzet(params?: {
    urun_id?: string;
    kategori_id?: string;
  }): Promise<{ success: boolean; data: MaliyetOzetItem[] }> {
    return this.getMaliyetOzet(params);
  },
};

export default faturaKalemleriAPI;
