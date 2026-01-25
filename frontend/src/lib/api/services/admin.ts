/**
 * Admin API Servisleri
 * Admin paneli için merkezi API servisleri
 */

import { api } from '@/lib/api';
import { API_BASE_URL } from '@/lib/config';
import type { ApiResponse } from '../types';

// User interface
export interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'user';
  user_type?: 'super_admin' | 'admin' | 'user';
  is_active: boolean;
  isLocked?: boolean;
  lockedUntil?: string;
  failedAttempts?: number;
  lockoutCount?: number;
  created_at: string;
}

// Admin API
export const adminAPI = {
  /**
   * Admin istatistiklerini getir
   */
  async getAdminStats(): Promise<ApiResponse<any>> {
    const response = await api.get('/api/database-stats/admin-stats');
    return response.data;
  },

  /**
   * Detaylı sağlık durumu
   */
  async getHealthDetailed(): Promise<ApiResponse<any>> {
    const response = await api.get('/api/database-stats/health-detailed');
    return response.data;
  },

  // ========== KULLANICI YÖNETİMİ ==========

  /**
   * Tüm kullanıcıları listele
   */
  async getUsers(): Promise<ApiResponse<{ users: User[] }>> {
    const response = await api.get('/api/auth/users');
    return response.data;
  },

  /**
   * Yeni kullanıcı oluştur
   */
  async createUser(data: {
    name: string;
    email: string;
    password: string;
    role?: string;
    user_type?: 'super_admin' | 'admin' | 'user';
    is_active?: boolean;
  }): Promise<ApiResponse<User>> {
    const response = await api.post('/api/auth/register', data);
    return response.data;
  },

  /**
   * Kullanıcı güncelle
   */
  async updateUser(userId: number, data: {
    name?: string;
    email?: string;
    password?: string;
    role?: string;
    user_type?: 'super_admin' | 'admin' | 'user';
    is_active?: boolean;
  }): Promise<ApiResponse<User>> {
    const response = await api.put(`/api/auth/users/${userId}`, data);
    return response.data;
  },

  /**
   * Kullanıcı sil
   */
  async deleteUser(userId: number): Promise<ApiResponse<any>> {
    const response = await api.delete(`/api/auth/users/${userId}`);
    return response.data;
  },

  /**
   * Hesabı kilitle
   */
  async lockUser(userId: number, minutes?: number): Promise<ApiResponse<any>> {
    const response = await api.put(`/api/auth/users/${userId}/lock`, { minutes });
    return response.data;
  },

  /**
   * Hesabı aç
   */
  async unlockUser(userId: number): Promise<ApiResponse<any>> {
    const response = await api.put(`/api/auth/users/${userId}/unlock`);
    return response.data;
  },

  /**
   * Login attempt geçmişi
   */
  async getUserLoginAttempts(userId: number, limit?: number): Promise<ApiResponse<{
    history: any[];
    userStatus: any;
  }>> {
    const response = await api.get(`/api/auth/users/${userId}/login-attempts`, {
      params: { limit: limit || 50 },
    });
    return response.data;
  },

  // ========== AUDIT LOG YÖNETİMİ ==========

  /**
   * Audit logları listele
   */
  async getAuditLogs(params?: {
    page?: number;
    limit?: number;
    user_id?: string;
    action?: string;
    entity_type?: string;
    search?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<ApiResponse<{ logs: any[]; pagination: { totalPages: number } }>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.user_id) searchParams.append('user_id', params.user_id);
    if (params?.action) searchParams.append('action', params.action);
    if (params?.entity_type) searchParams.append('entity_type', params.entity_type);
    if (params?.search) searchParams.append('search', params.search);
    if (params?.start_date) searchParams.append('start_date', params.start_date);
    if (params?.end_date) searchParams.append('end_date', params.end_date);

    const response = await api.get(`/api/audit-logs?${searchParams.toString()}`);
    return response.data;
  },

  /**
   * Audit log özeti
   */
  async getAuditLogSummary(): Promise<ApiResponse<any>> {
    const response = await api.get('/api/audit-logs/summary');
    return response.data;
  },

  /**
   * Audit log filtreleri
   */
  async getAuditLogFilters(): Promise<ApiResponse<any>> {
    const response = await api.get('/api/audit-logs/meta/filters');
    return response.data;
  },

  /**
   * Audit log detayı
   */
  async getAuditLogDetail(logId: number): Promise<ApiResponse<any>> {
    const response = await api.get(`/api/audit-logs/${logId}`);
    return response.data;
  },

  // ========== PROFİL YÖNETİMİ ==========

  /**
   * Profil güncelle
   */
  async updateProfile(data: { name?: string; email?: string }): Promise<ApiResponse<any>> {
    const response = await api.put('/api/auth/profile', data);
    return response.data;
  },

  /**
   * Şifre değiştir
   */
  async changePassword(data: { currentPassword: string; newPassword: string }): Promise<ApiResponse<any>> {
    const response = await api.put('/api/auth/password', data);
    return response.data;
  },

  // ========== GENEL ==========

  /**
   * Global arama
   */
  async search(query: string, limit?: number): Promise<ApiResponse<any>> {
    const response = await api.get('/api/search', {
      params: { q: query, limit: limit || 5 },
    });
    return response.data;
  },

  // ========== BİLDİRİMLER ==========

  /**
   * Okunmamış bildirim sayısı
   */
  async getUnreadNotificationCount(): Promise<ApiResponse<{ count: number }>> {
    const response = await api.get('/api/notifications/unread-count');
    return response.data;
  },

  /**
   * Bildirimleri listele
   */
  async getNotifications(limit?: number): Promise<ApiResponse<any[]>> {
    const response = await api.get('/api/notifications', {
      params: { limit: limit || 10 },
    });
    return response.data;
  },

  /**
   * Bildirimi okundu işaretle
   */
  async markNotificationRead(id: number): Promise<ApiResponse<any>> {
    const response = await api.patch(`/api/notifications/${id}/read`);
    return response.data;
  },

  /**
   * Tüm bildirimleri okundu işaretle
   */
  async markAllNotificationsRead(): Promise<ApiResponse<any>> {
    const response = await api.patch('/api/notifications/read-all');
    return response.data;
  },

  // ========== YETKİLER ==========

  /**
   * Kullanıcının yetkilerini getir
   */
  async getMyPermissions(): Promise<ApiResponse<any>> {
    try {
      // Cache busting ile fresh request
      const response = await api.get('/api/permissions/my', {
        params: { _t: Date.now() }, // Cache busting
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      // 200 OK - başarılı
      if (response.status === 200) {
        return response.data;
      }
      
      // 304 Not Modified - cache'den geliyor, data olabilir veya olmayabilir
      if (response.status === 304) {
        // Eğer data varsa kullan, yoksa tekrar dene
        if (response.data) {
          return response.data;
        }
        // Data yoksa fresh request yap
        const freshResponse = await api.get('/api/permissions/my', {
          params: { _t: Date.now() },
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });
        return freshResponse.data;
      }
      
      // Diğer durumlar
      if (response.data) {
        return response.data;
      }
      
      // Data yoksa hata fırlat
      throw new Error(`Unexpected status: ${response.status}`);
    } catch (error: any) {
      // 401 hatası ise tekrar fırlat (token refresh interceptor handle edecek)
      if (error.response?.status === 401) {
        console.warn('401 hatası - token refresh deneniyor...');
        throw error;
      }
      console.error('getMyPermissions error:', error);
      throw error;
    }
  },

  // ========== DÖKÜMAN ANALİZ ==========

  /**
   * Döküman analiz et
   */
  async analyzeDocument(formData: FormData): Promise<ApiResponse<any>> {
    const response = await api.post('/api/documents/analyze', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // ========== URL HELPERS ==========

  /**
   * API Docs URL'i
   */
  getApiDocsUrl(): string {
    return `${API_BASE_URL}/api-docs`;
  },

  /**
   * Health check URL'i
   */
  getHealthUrl(): string {
    return `${API_BASE_URL}/health`;
  },

  /**
   * Base URL
   */
  getBaseUrl(): string {
    return API_BASE_URL;
  },

  // ========== ADMIN NOTIFICATIONS ==========

  /**
   * Admin bildirimlerini listele
   */
  async getAdminNotifications(params?: {
    limit?: number;
    read?: boolean;
    type?: string;
    severity?: string;
  }): Promise<ApiResponse<{ notifications: any[] }>> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.read !== undefined) searchParams.append('read', params.read.toString());
    if (params?.type) searchParams.append('type', params.type);
    if (params?.severity) searchParams.append('severity', params.severity);

    const response = await api.get(`/api/auth/admin/notifications?${searchParams.toString()}`);
    return response.data;
  },

  /**
   * Okunmamış admin bildirim sayısı
   */
  async getAdminUnreadCount(): Promise<ApiResponse<{ count: number }>> {
    const response = await api.get('/api/auth/admin/notifications/unread-count');
    return response.data;
  },

  /**
   * Admin bildirimi okundu işaretle
   */
  async markAdminNotificationRead(id: number): Promise<ApiResponse<any>> {
    const response = await api.put(`/api/auth/admin/notifications/${id}/read`);
    return response.data;
  },

  /**
   * Tüm admin bildirimlerini okundu işaretle
   */
  async markAllAdminNotificationsRead(): Promise<ApiResponse<any>> {
    const response = await api.put('/api/auth/admin/notifications/read-all');
    return response.data;
  },

  /**
   * Admin bildirimi sil
   */
  async deleteAdminNotification(id: number): Promise<ApiResponse<any>> {
    const response = await api.delete(`/api/auth/admin/notifications/${id}`);
    return response.data;
  },

  // ========== SESSION MANAGEMENT ==========

  /**
   * Aktif oturumları listele
   */
  async getSessions(): Promise<ApiResponse<{ sessions: any[] }>> {
    const response = await api.get('/api/auth/sessions');
    return response.data;
  },

  /**
   * Oturum sonlandır
   */
  async terminateSession(sessionId: number): Promise<ApiResponse<any>> {
    const response = await api.delete(`/api/auth/sessions/${sessionId}`);
    return response.data;
  },

  /**
   * Diğer tüm oturumları sonlandır
   */
  async terminateOtherSessions(): Promise<ApiResponse<{ count: number }>> {
    const response = await api.delete('/api/auth/sessions/other');
    return response.data;
  },

  // ========== IP ACCESS CONTROL ==========

  /**
   * IP kurallarını listele
   */
  async getIpRules(params?: {
    type?: 'whitelist' | 'blacklist';
    active?: boolean;
  }): Promise<ApiResponse<{ rules: any[] }>> {
    const searchParams = new URLSearchParams();
    if (params?.type) searchParams.append('type', params.type);
    if (params?.active !== undefined) searchParams.append('active', params.active.toString());

    const response = await api.get(`/api/auth/admin/ip-rules?${searchParams.toString()}`);
    return response.data;
  },

  /**
   * Yeni IP kuralı ekle
   */
  async createIpRule(data: {
    ipAddress: string;
    type: 'whitelist' | 'blacklist';
    description?: string;
  }): Promise<ApiResponse<any>> {
    const response = await api.post('/api/auth/admin/ip-rules', data);
    return response.data;
  },

  /**
   * IP kuralını güncelle
   */
  async updateIpRule(ruleId: number, data: {
    ipAddress?: string;
    type?: 'whitelist' | 'blacklist';
    description?: string;
    isActive?: boolean;
  }): Promise<ApiResponse<any>> {
    const response = await api.put(`/api/auth/admin/ip-rules/${ruleId}`, data);
    return response.data;
  },

  /**
   * IP kuralını sil
   */
  async deleteIpRule(ruleId: number): Promise<ApiResponse<any>> {
    const response = await api.delete(`/api/auth/admin/ip-rules/${ruleId}`);
    return response.data;
  },
};
