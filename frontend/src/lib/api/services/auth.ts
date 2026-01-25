/**
 * Auth API Servisleri
 * Kimlik doğrulama ve kullanıcı yönetimi için merkezi API servisleri
 */

import { api } from '@/lib/api';
import type { ApiResponse } from '../types';

// Kullanıcı tipi
export interface User {
  id: number;
  email: string;
  ad?: string;
  soyad?: string;
  rol?: string;
  aktif?: boolean;
  [key: string]: any;
}

// Auth API
export const authAPI = {
  /**
   * Giriş yap
   */
  async login(credentials: { email: string; password: string }): Promise<ApiResponse<any>> {
    const response = await api.post('/api/auth/login', credentials);
    return response.data;
  },

  /**
   * Çıkış yap
   */
  async logout(): Promise<ApiResponse<any>> {
    const response = await api.post('/api/auth/logout');
    return response.data;
  },

  /**
   * Mevcut kullanıcı bilgilerini getir
   */
  async getMe(): Promise<ApiResponse<User>> {
    const response = await api.get('/api/auth/me');
    return response.data;
  },

  /**
   * Profil güncelle
   */
  async updateProfile(data: Partial<User>): Promise<ApiResponse<User>> {
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

  /**
   * Kullanıcıları listele (admin)
   */
  async getUsers(): Promise<ApiResponse<User[]>> {
    const response = await api.get('/api/auth/users');
    return response.data;
  },

  /**
   * Kullanıcı oluştur (admin)
   */
  async createUser(user: Partial<User>): Promise<ApiResponse<User>> {
    const response = await api.post('/api/auth/users', user);
    return response.data;
  },

  /**
   * Kullanıcı güncelle (admin)
   */
  async updateUser(id: number, user: Partial<User>): Promise<ApiResponse<User>> {
    const response = await api.put(`/api/auth/users/${id}`, user);
    return response.data;
  },

  /**
   * Kullanıcı sil (admin)
   */
  async deleteUser(id: number): Promise<ApiResponse<any>> {
    const response = await api.delete(`/api/auth/users/${id}`);
    return response.data;
  },
};
