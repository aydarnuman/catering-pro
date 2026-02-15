/**
 * Menü Planlama modülü merkezi query key yönetimi.
 *
 * Tüm TanStack Query key'leri burada tanımlıdır.
 * Key yapısı: ['menuPlanlama', alt-domain, ...parametreler]
 *
 * Avantajlar:
 * - Aynı key'in farklı string'lerle yazılması önlenir
 * - invalidateQueries ile toplu cache temizleme kolaylaşır
 * - IDE autocomplete ile keşfedilebilir
 */

export const menuPlanlamaKeys = {
  // ─── Root ──────────────────────────────────────────────────
  all: ['menuPlanlama'] as const,

  // ─── Projeler ──────────────────────────────────────────────
  projeler: () => [...menuPlanlamaKeys.all, 'projeler'] as const,

  // ─── Öğün Tipleri ──────────────────────────────────────────
  ogunTipleri: () => [...menuPlanlamaKeys.all, 'ogunTipleri'] as const,

  // ─── Menü Planları (kaydedilen) ────────────────────────────
  menuPlanlari: () => [...menuPlanlamaKeys.all, 'menuPlanlari'] as const,

  // ─── Reçeteler ─────────────────────────────────────────────
  receteler: {
    all: () => [...menuPlanlamaKeys.all, 'receteler'] as const,
    liste: (arama?: string, sartnameId?: number | null) =>
      [...menuPlanlamaKeys.receteler.all(), 'liste', { arama, sartnameId }] as const,
    takvim: (arama?: string, kategori?: string, ogunKod?: string) =>
      [...menuPlanlamaKeys.receteler.all(), 'takvim', { arama, kategori, ogunKod }] as const,
    kurum: (arama?: string) => [...menuPlanlamaKeys.receteler.all(), 'kurum', { arama }] as const,
    detay: (id: number | null) => [...menuPlanlamaKeys.receteler.all(), 'detay', id] as const,
    altTip: (id: number | null) => [...menuPlanlamaKeys.receteler.all(), 'altTip', id] as const,
    kategoriler: () => [...menuPlanlamaKeys.receteler.all(), 'kategoriler'] as const,
    kategorilerApi: () => [...menuPlanlamaKeys.receteler.all(), 'kategorilerApi'] as const,
  },

  // ─── Maliyet Analizi ──────────────────────────────────────
  maliyetAnalizi: {
    detay: (receteId: number | null) =>
      [...menuPlanlamaKeys.all, 'maliyetAnalizi', 'detay', receteId] as const,
  },

  // ─── Şartnameler ───────────────────────────────────────────
  sartnameler: {
    all: () => [...menuPlanlamaKeys.all, 'sartnameler'] as const,
    liste: () => [...menuPlanlamaKeys.sartnameler.all(), 'liste'] as const,
    gramajOnizleme: (receteId: number | null, tab?: string) =>
      [...menuPlanlamaKeys.sartnameler.all(), 'gramajOnizleme', receteId, tab] as const,
    gramajKontrol: (receteId: number | null, tab?: string) =>
      [...menuPlanlamaKeys.sartnameler.all(), 'gramajKontrol', receteId, tab] as const,
  },
} as const;
