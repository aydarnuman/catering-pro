/**
 * Supabase Client Configuration
 * Tüm Supabase işlemleri için merkezi client
 */

import { createClient } from '@supabase/supabase-js';

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Type check
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL ve Anon Key tanımlanmalı! .env dosyasını kontrol edin.');
}

// Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Database Types (TypeScript için)
export type Database = {
  public: {
    Tables: {
      // Cariler
      cariler: {
        Row: {
          id: number;
          tip: 'musteri' | 'tedarikci' | 'her_ikisi';
          unvan: string;
          yetkili?: string;
          vergi_no?: string;
          vergi_dairesi?: string;
          telefon?: string;
          email?: string;
          adres?: string;
          il?: string;
          ilce?: string;
          borc: number;
          alacak: number;
          bakiye: number;
          kredi_limiti: number;
          banka_adi?: string;
          iban?: string;
          aktif: boolean;
          notlar?: string;
          created_by?: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['cariler']['Row'], 'id' | 'bakiye' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['cariler']['Insert']>;
      };
      
      // Stok Kartları
      stok_kartlari: {
        Row: {
          id: number;
          kod: string;
          ad: string;
          kategori: string;
          birim: string;
          miktar: number;
          min_stok: number;
          max_stok: number;
          kritik_stok: boolean;
          alis_fiyati: number;
          satis_fiyati: number;
          kdv_orani: number;
          tedarikci_id?: number;
          tedarik_suresi: number;
          raf?: string;
          barkod?: string;
          aktif: boolean;
          notlar?: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['stok_kartlari']['Row'], 'id' | 'kritik_stok' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['stok_kartlari']['Insert']>;
      };
      
      // Personeller
      personeller: {
        Row: {
          id: number;
          sicil_no?: string;
          tc_kimlik: string;
          ad: string;
          soyad: string;
          tam_ad: string;
          telefon?: string;
          email?: string;
          adres?: string;
          departman?: string;
          pozisyon?: string;
          ise_giris_tarihi: string;
          isten_cikis_tarihi?: string;
          aktif: boolean;
          maas: number;
          maas_tipi: 'aylik' | 'haftalik' | 'gunluk' | 'saatlik';
          iban?: string;
          dogum_tarihi?: string;
          cinsiyet?: 'erkek' | 'kadin' | 'diger';
          notlar?: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['personeller']['Row'], 'id' | 'tam_ad' | 'aktif' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['personeller']['Insert']>;
      };
      
      // Gelir-Giderler
      gelir_giderler: {
        Row: {
          id: number;
          tip: 'gelir' | 'gider';
          kategori: string;
          aciklama: string;
          tutar: number;
          kdv_dahil: boolean;
          kdv_orani: number;
          kdv_tutar?: number;
          cari_id?: number;
          fatura_id?: number;
          personel_id?: number;
          odeme_yontemi?: 'nakit' | 'banka' | 'kredi_karti' | 'cek' | 'senet';
          belge_no?: string;
          durum: 'beklemede' | 'odendi' | 'iptal';
          tarih: string;
          vade_tarihi?: string;
          notlar?: string;
          created_by?: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['gelir_giderler']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['gelir_giderler']['Insert']>;
      };
      
      // Kasa-Banka Hesapları
      kasa_banka_hesaplari: {
        Row: {
          id: number;
          hesap_tipi: 'kasa' | 'banka';
          hesap_adi: string;
          banka_adi?: string;
          sube?: string;
          hesap_no?: string;
          iban?: string;
          para_birimi: string;
          bakiye: number;
          kredi_limiti: number;
          gunluk_limit?: number;
          aktif: boolean;
          varsayilan: boolean;
          notlar?: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['kasa_banka_hesaplari']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['kasa_banka_hesaplari']['Insert']>;
      };
      
      // Satın Alma Talepleri
      satin_alma_talepleri: {
        Row: {
          id: number;
          talep_no: string;
          talep_eden: string;
          departman?: string;
          konu: string;
          aciklama?: string;
          aciliyet: 'dusuk' | 'normal' | 'yuksek' | 'acil';
          durum: 'beklemede' | 'onaylandi' | 'reddedildi' | 'tamamlandi' | 'iptal';
          onaylayan?: string;
          onay_tarihi?: string;
          red_nedeni?: string;
          tahmini_tutar?: number;
          gerceklesen_tutar?: number;
          tedarikci_id?: number;
          talep_tarihi: string;
          termin_tarihi?: string;
          tamamlanma_tarihi?: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['satin_alma_talepleri']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['satin_alma_talepleri']['Insert']>;
      };
    };
    Views: {
      cari_ozet: {
        Row: Database['public']['Tables']['cariler']['Row'] & {
          fatura_sayisi: number;
          toplam_islem: number;
        };
      };
      kritik_stoklar: {
        Row: Database['public']['Tables']['stok_kartlari']['Row'] & {
          tedarikci_unvan?: string;
          tedarikci_telefon?: string;
        };
      };
      aylik_gelir_gider_ozet: {
        Row: {
          ay: string;
          toplam_gelir: number;
          toplam_gider: number;
          net_kar: number;
        };
      };
      kasa_banka_durum: {
        Row: Database['public']['Tables']['kasa_banka_hesaplari']['Row'] & {
          bugun_hareket_sayisi: number;
        };
      };
    };
  };
};

// Helper Functions
export const supabaseHelpers = {
  // Auth helpers
  async signIn(email: string, password: string) {
    return await supabase.auth.signInWithPassword({ email, password });
  },
  
  async signUp(email: string, password: string) {
    return await supabase.auth.signUp({ email, password });
  },
  
  async signOut() {
    return await supabase.auth.signOut();
  },
  
  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },
  
  // Database helpers
  async getAll<T>(table: string, filters?: any) {
    let query = supabase.from(table).select('*');
    
    if (filters) {
      Object.keys(filters).forEach(key => {
        query = query.eq(key, filters[key]);
      });
    }
    
    return query;
  },
  
  async getById<T>(table: string, id: number) {
    return await supabase
      .from(table)
      .select('*')
      .eq('id', id)
      .single();
  },
  
  async create<T>(table: string, data: any) {
    return await supabase
      .from(table)
      .insert(data)
      .select()
      .single();
  },
  
  async update<T>(table: string, id: number, data: any) {
    return await supabase
      .from(table)
      .update(data)
      .eq('id', id)
      .select()
      .single();
  },
  
  async delete(table: string, id: number) {
    return await supabase
      .from(table)
      .delete()
      .eq('id', id);
  },
  
  // Realtime subscriptions
  subscribeToTable(table: string, callback: (payload: any) => void) {
    return supabase
      .channel(`public:${table}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table }, 
        callback
      )
      .subscribe();
  },
  
  // Storage helpers (ileride kullanmak için)
  async uploadFile(bucket: string, path: string, file: File) {
    return await supabase.storage
      .from(bucket)
      .upload(path, file);
  },
  
  getPublicUrl(bucket: string, path: string) {
    return supabase.storage
      .from(bucket)
      .getPublicUrl(path);
  }
};

export default supabase;
