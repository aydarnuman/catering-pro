/**
 * Supabase Backend Client
 * Service Role Key ile tam yetki
 * Lazy initialization - env değişkenleri runtime'da okunur
 */

import { createClient } from '@supabase/supabase-js';

// Lazy initialized client
let _supabase = null;
let _initialized = false;

/**
 * Get or create Supabase client (lazy initialization)
 * Bu fonksiyon çağrıldığında env değişkenleri zaten yüklenmiş olmalı
 */
function getSupabaseClient() {
  if (_initialized) {
    return _supabase;
  }

  _initialized = true;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  const apiKey = supabaseAnonKey || supabaseServiceKey;

  if (!supabaseUrl || !apiKey) {
    return null;
  }

  _supabase = createClient(supabaseUrl, apiKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return _supabase;
}

// Export as getter - her erişimde lazy init kontrol edilir
export const supabase = new Proxy(
  {},
  {
    get(_target, prop) {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error(
          "Supabase client veya storage mevcut değil. Lütfen SUPABASE_SERVICE_KEY environment variable'ını kontrol edin."
        );
      }
      return client[prop];
    },
  }
);

/**
 * Database helper functions
 * Mevcut PostgreSQL query'lerini Supabase'e uyarlıyor
 */

// Query wrapper - mevcut kodu bozmamak için
export async function query(text, params = []) {
  // SQL to Supabase dönüşümü (basit SELECT için)
  if (text.toLowerCase().startsWith('select')) {
    // Tablo adını çıkar
    const tableMatch = text.match(/from\s+(\w+)/i);
    if (tableMatch) {
      const tableName = tableMatch[1];

      // WHERE koşullarını çıkar
      const whereMatch = text.match(/where\s+(.+?)(?:order|limit|$)/i);
      let query = supabase.from(tableName).select('*');

      if (whereMatch) {
        const whereClause = whereMatch[1];
        // Basit eşitlik kontrolü için
        const conditions = whereClause.match(/(\w+)\s*=\s*\$\d+/g);
        if (conditions) {
          conditions.forEach((condition, index) => {
            const field = condition.match(/(\w+)/)[1];
            if (params[index] !== undefined) {
              query = query.eq(field, params[index]);
            }
          });
        }
      }

      // ORDER BY
      const orderMatch = text.match(/order\s+by\s+(\w+)(?:\s+(asc|desc))?/i);
      if (orderMatch) {
        query = query.order(orderMatch[1], {
          ascending: orderMatch[2]?.toLowerCase() !== 'desc',
        });
      }

      // LIMIT
      const limitMatch = text.match(/limit\s+(\d+)/i);
      if (limitMatch) {
        query = query.limit(parseInt(limitMatch[1], 10));
      }

      const { data, error } = await query;

      if (error) throw error;

      return {
        rows: data || [],
        rowCount: data?.length || 0,
      };
    }
  }

  // INSERT INTO için
  if (text.toLowerCase().startsWith('insert')) {
    const tableMatch = text.match(/into\s+(\w+)/i);
    const columnsMatch = text.match(/\(([^)]+)\)/);

    if (tableMatch && columnsMatch) {
      const tableName = tableMatch[1];
      const columns = columnsMatch[1].split(',').map((c) => c.trim());

      // Params'ı object'e dönüştür
      const data = {};
      columns.forEach((col, index) => {
        data[col] = params[index];
      });

      const { data: result, error } = await supabase.from(tableName).insert(data).select();

      if (error) throw error;

      return {
        rows: result || [],
        rowCount: result?.length || 0,
      };
    }
  }

  // UPDATE için
  if (text.toLowerCase().startsWith('update')) {
    const tableMatch = text.match(/update\s+(\w+)/i);
    const setMatch = text.match(/set\s+(.+?)\s+where/i);
    const whereMatch = text.match(/where\s+(.+)/i);

    if (tableMatch && setMatch) {
      const tableName = tableMatch[1];

      // SET clause'u parse et
      const updates = {};
      const setParts = setMatch[1].split(',');
      setParts.forEach((part, index) => {
        const [field] = part.trim().split('=');
        updates[field.trim()] = params[index];
      });

      // WHERE clause'u parse et
      let query = supabase.from(tableName).update(updates);

      if (whereMatch) {
        const whereField = whereMatch[1].match(/(\w+)\s*=/)[1];
        query = query.eq(whereField, params[params.length - 1]);
      }

      const { data, error } = await query.select();

      if (error) throw error;

      return {
        rows: data || [],
        rowCount: data?.length || 0,
      };
    }
  }

  // DELETE için
  if (text.toLowerCase().startsWith('delete')) {
    const tableMatch = text.match(/from\s+(\w+)/i);
    const whereMatch = text.match(/where\s+(\w+)\s*=\s*\$\d+/i);

    if (tableMatch && whereMatch) {
      const tableName = tableMatch[1];
      const whereField = whereMatch[1];

      const { error } = await supabase.from(tableName).delete().eq(whereField, params[0]);

      if (error) throw error;

      return {
        rows: [],
        rowCount: 1,
      };
    }
  }

  // Fallback: Boş sonuç dön
  return {
    rows: [],
    rowCount: 0,
  };
}

// Transaction helper
export async function transaction(callback) {
  // Callback'i doğrudan çalıştır (transaction olmadan)
  const result = await callback({
    query: query, // query fonksiyonunu client olarak kullan
  });
  return result;
}

// Direct Supabase helpers (yeni kod için)
export const db = {
  // Cariler
  cariler: {
    async list(filters = {}) {
      let query = supabase.from('cariler').select('*');

      if (filters.tip) query = query.eq('tip', filters.tip);
      if (filters.aktif !== undefined) query = query.eq('aktif', filters.aktif);
      if (filters.search) query = query.ilike('unvan', `%${filters.search}%`);

      return query.order('unvan');
    },

    async get(id) {
      return supabase.from('cariler').select('*').eq('id', id).single();
    },

    async create(data) {
      return supabase.from('cariler').insert(data).select().single();
    },

    async update(id, data) {
      return supabase.from('cariler').update(data).eq('id', id).select().single();
    },

    async delete(id) {
      return supabase.from('cariler').delete().eq('id', id);
    },
  },

  // Stok
  stok: {
    async list(filters = {}) {
      let query = supabase.from('stok_kartlari').select('*');

      if (filters.kategori) query = query.eq('kategori', filters.kategori);
      if (filters.kritik) query = query.eq('kritik_stok', true);
      if (filters.aktif !== undefined) query = query.eq('aktif', filters.aktif);
      if (filters.search) query = query.ilike('ad', `%${filters.search}%`);

      return query.order('ad');
    },

    async get(id) {
      return supabase.from('stok_kartlari').select('*').eq('id', id).single();
    },

    async create(data) {
      return supabase.from('stok_kartlari').insert(data).select().single();
    },

    async update(id, data) {
      return supabase.from('stok_kartlari').update(data).eq('id', id).select().single();
    },

    async delete(id) {
      return supabase.from('stok_kartlari').delete().eq('id', id);
    },

    async addMovement(data) {
      return supabase.from('stok_hareketleri').insert(data).select().single();
    },

    async getMovements(stokId) {
      return supabase.from('stok_hareketleri').select('*').eq('stok_id', stokId).order('tarih', { ascending: false });
    },
  },

  // Personel
  personel: {
    async list(filters = {}) {
      let query = supabase.from('personeller').select('*');

      if (filters.departman) query = query.eq('departman', filters.departman);
      if (filters.aktif !== undefined) query = query.eq('aktif', filters.aktif);
      if (filters.search) query = query.ilike('tam_ad', `%${filters.search}%`);

      return query.order('tam_ad');
    },

    async get(id) {
      return supabase.from('personeller').select('*').eq('id', id).single();
    },

    async create(data) {
      return supabase.from('personeller').insert(data).select().single();
    },

    async update(id, data) {
      return supabase.from('personeller').update(data).eq('id', id).select().single();
    },

    async delete(id) {
      return supabase.from('personeller').delete().eq('id', id);
    },

    async addPayment(data) {
      return supabase.from('personel_odemeleri').insert(data).select().single();
    },

    async getPayments(personelId) {
      return supabase
        .from('personel_odemeleri')
        .select('*')
        .eq('personel_id', personelId)
        .order('odeme_tarihi', { ascending: false });
    },
  },

  // Gelir-Gider
  gelirGider: {
    async list(filters = {}) {
      let query = supabase.from('gelir_giderler').select('*');

      if (filters.tip) query = query.eq('tip', filters.tip);
      if (filters.kategori) query = query.eq('kategori', filters.kategori);
      if (filters.durum) query = query.eq('durum', filters.durum);
      if (filters.startDate) query = query.gte('tarih', filters.startDate);
      if (filters.endDate) query = query.lte('tarih', filters.endDate);

      return query.order('tarih', { ascending: false });
    },

    async get(id) {
      return supabase.from('gelir_giderler').select('*').eq('id', id).single();
    },

    async create(data) {
      return supabase.from('gelir_giderler').insert(data).select().single();
    },

    async update(id, data) {
      return supabase.from('gelir_giderler').update(data).eq('id', id).select().single();
    },

    async delete(id) {
      return supabase.from('gelir_giderler').delete().eq('id', id);
    },

    async getSummary(_period = 'monthly') {
      return supabase.from('aylik_gelir_gider_ozet').select('*');
    },
  },

  // Kasa-Banka
  kasaBanka: {
    async listAccounts(filters = {}) {
      let query = supabase.from('kasa_banka_hesaplari').select('*');

      if (filters.hesap_tipi) query = query.eq('hesap_tipi', filters.hesap_tipi);
      if (filters.aktif !== undefined) query = query.eq('aktif', filters.aktif);

      return query.order('hesap_adi');
    },

    async getAccount(id) {
      return supabase.from('kasa_banka_hesaplari').select('*').eq('id', id).single();
    },

    async createAccount(data) {
      return supabase.from('kasa_banka_hesaplari').insert(data).select().single();
    },

    async updateAccount(id, data) {
      return supabase.from('kasa_banka_hesaplari').update(data).eq('id', id).select().single();
    },

    async deleteAccount(id) {
      return supabase.from('kasa_banka_hesaplari').delete().eq('id', id);
    },

    async addTransaction(data) {
      return supabase.from('kasa_banka_hareketleri').insert(data).select().single();
    },

    async getTransactions(hesapId) {
      return supabase
        .from('kasa_banka_hareketleri')
        .select('*')
        .eq('hesap_id', hesapId)
        .order('tarih', { ascending: false })
        .order('saat', { ascending: false });
    },
  },

  // Satın Alma
  satinAlma: {
    async listRequests(filters = {}) {
      let query = supabase.from('satin_alma_talepleri').select('*');

      if (filters.durum) query = query.eq('durum', filters.durum);
      if (filters.aciliyet) query = query.eq('aciliyet', filters.aciliyet);
      if (filters.departman) query = query.eq('departman', filters.departman);

      return query.order('talep_tarihi', { ascending: false });
    },

    async getRequest(id) {
      return supabase
        .from('satin_alma_talepleri')
        .select(`
          *,
          satin_alma_kalemleri (*)
        `)
        .eq('id', id)
        .single();
    },

    async createRequest(data) {
      return supabase.from('satin_alma_talepleri').insert(data).select().single();
    },

    async updateRequest(id, data) {
      return supabase.from('satin_alma_talepleri').update(data).eq('id', id).select().single();
    },

    async deleteRequest(id) {
      return supabase.from('satin_alma_talepleri').delete().eq('id', id);
    },

    async addRequestItem(data) {
      return supabase.from('satin_alma_kalemleri').insert(data).select().single();
    },
  },

  // Dashboard verileri için Views
  views: {
    async getCariOzet() {
      return supabase.from('cari_ozet').select('*');
    },

    async getKritikStoklar() {
      return supabase.from('kritik_stoklar').select('*');
    },

    async getAylikGelirGider() {
      return supabase.from('aylik_gelir_gider_ozet').select('*').limit(12);
    },

    async getKasaBankaDurum() {
      return supabase.from('kasa_banka_durum').select('*');
    },
  },
};

// Export pool for compatibility
export const pool = {
  query,
  connect: async () => ({
    query,
    release: () => {},
  }),
};

export default supabase;
