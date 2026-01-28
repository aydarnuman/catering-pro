// Merkezi API Konfigürasyonu
// Tüm API çağrıları bu dosyadan import etmeli

// ÖNEMLI: Bu fonksiyon SADECE client-side'da çalışır
// Build sırasında hiçbir env variable kullanılmaz
// Bu sayede production'da hostname otomatik olarak kullanılır

// Lazy initialization için cache
let cachedApiBaseUrl: string | null = null;

const getApiBaseUrl = (): string => {
  // Cache varsa döndür (performance için)
  if (cachedApiBaseUrl) {
    return cachedApiBaseUrl;
  }

  // Client-side'da hostname'e göre karar ver
  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location;

    // Localhost ise local backend
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      cachedApiBaseUrl = 'http://localhost:3001';
      return cachedApiBaseUrl;
    }

    // Production: aynı hostname'i kullan (Nginx proxy)
    // IP adresi veya domain fark etmez, her ikisi de çalışır
    cachedApiBaseUrl = `${protocol}//${hostname}`;
    return cachedApiBaseUrl;
  }

  // Server-side (SSR) - relative URL kullan
  // Bu sayede SSR sırasında da sorun olmaz
  return '';
};

// Getter function - her çağrıda güncel değer alır
export const getApiBaseUrlDynamic = (): string => {
  return getApiBaseUrl();
};

// Legacy uyumluluk için - ama artık dinamik
export const API_BASE_URL = typeof window !== 'undefined' ? getApiBaseUrl() : '';

// API endpoint'leri için helper - dinamik URL kullanır
export const API_ENDPOINTS = {
  // Auth
  get AUTH_LOGIN() {
    return `${getApiBaseUrl()}/api/auth/login`;
  },
  get AUTH_ME() {
    return `${getApiBaseUrl()}/api/auth/me`;
  },
  get AUTH_REGISTER() {
    return `${getApiBaseUrl()}/api/auth/register`;
  },
  get AUTH_USERS() {
    return `${getApiBaseUrl()}/api/auth/users`;
  },
  get AUTH_PROFILE() {
    return `${getApiBaseUrl()}/api/auth/profile`;
  },
  get AUTH_PASSWORD() {
    return `${getApiBaseUrl()}/api/auth/password`;
  },

  // Health & Stats
  get HEALTH() {
    return `${getApiBaseUrl()}/health`;
  },
  get STATS() {
    return `${getApiBaseUrl()}/api/stats`;
  },

  // Admin
  get ADMIN_STATS() {
    return `${getApiBaseUrl()}/api/database-stats/admin-stats`;
  },
  get ADMIN_HEALTH() {
    return `${getApiBaseUrl()}/api/database-stats/health-detailed`;
  },

  // AI
  get AI_TEMPLATES() {
    return `${getApiBaseUrl()}/api/ai/templates`;
  },
  get AI_AGENT() {
    return `${getApiBaseUrl()}/api/ai/agent`;
  },
  get AI_FEEDBACK() {
    return `${getApiBaseUrl()}/api/ai/feedback`;
  },
  get AI_SETTINGS() {
    return `${getApiBaseUrl()}/api/ai/settings`;
  },

  // Tenders
  get TENDERS() {
    return `${getApiBaseUrl()}/api/tenders`;
  },

  // Documents
  get DOCUMENTS() {
    return `${getApiBaseUrl()}/api/documents`;
  },
};

// Dinamik endpoint oluşturucu
export const getApiUrl = (path: string): string => {
  const baseUrl = getApiBaseUrl();

  // Eğer path zaten /api ile başlıyorsa direkt ekle
  if (path.startsWith('/api/')) {
    return `${baseUrl}${path}`;
  }
  // Değilse /api/ ekle
  return `${baseUrl}/api${path.startsWith('/') ? path : `/${path}`}`;
};
