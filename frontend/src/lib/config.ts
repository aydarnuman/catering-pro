// Merkezi API Konfigürasyonu
// Tüm API çağrıları bu dosyadan import etmeli

// Runtime ortamını tespit et (browser vs server)
const isServer = typeof window === 'undefined';
const isBrowser = !isServer;

// Production detection: window.location veya env
const getDefaultApiUrl = () => {
  // Browser'daysa, current hostname kullan
  if (isBrowser) {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    
    // localhost ise backend port 3001
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3001';
    }
    
    // Production IP ise aynı IP kullan
    return `${protocol}//${hostname}`;
  }
  
  // Server-side: env'den al veya localhost
  return 'http://localhost:3001';
};

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || getDefaultApiUrl();

// API endpoint'leri için helper
export const API_ENDPOINTS = {
  // Auth
  AUTH_LOGIN: `${API_BASE_URL}/api/auth/login`,
  AUTH_ME: `${API_BASE_URL}/api/auth/me`,
  AUTH_REGISTER: `${API_BASE_URL}/api/auth/register`,
  AUTH_USERS: `${API_BASE_URL}/api/auth/users`,
  AUTH_PROFILE: `${API_BASE_URL}/api/auth/profile`,
  AUTH_PASSWORD: `${API_BASE_URL}/api/auth/password`,
  
  // Health & Stats
  HEALTH: `${API_BASE_URL}/health`,
  STATS: `${API_BASE_URL}/api/stats`,
  
  // Admin
  ADMIN_STATS: `${API_BASE_URL}/api/database-stats/admin-stats`,
  ADMIN_HEALTH: `${API_BASE_URL}/api/database-stats/health-detailed`,
  
  // AI
  AI_TEMPLATES: `${API_BASE_URL}/api/ai/templates`,
  AI_AGENT: `${API_BASE_URL}/api/ai/agent`,
  AI_FEEDBACK: `${API_BASE_URL}/api/ai/feedback`,
  AI_SETTINGS: `${API_BASE_URL}/api/ai/settings`,
  
  // Tenders
  TENDERS: `${API_BASE_URL}/api/tenders`,
  
  // Documents
  DOCUMENTS: `${API_BASE_URL}/api/documents`,
};

// Dinamik endpoint oluşturucu
export const getApiUrl = (path: string) => {
  // Eğer path zaten /api ile başlıyorsa direkt ekle
  if (path.startsWith('/api/')) {
    return `${API_BASE_URL}${path}`;
  }
  // Değilse /api/ ekle
  return `${API_BASE_URL}/api${path.startsWith('/') ? path : '/' + path}`;
};

