/**
 * Preferences API Servisi
 * Kullanıcı tercihleri için backend API iletişimi
 */

import { api } from '@/lib/api';

export interface PreferencesResponse {
  success: boolean;
  preferences: Record<string, unknown>;
}

export const preferencesAPI = {
  /** Tüm tercihleri getir */
  async getAll(): Promise<PreferencesResponse> {
    const { data } = await api.get('/api/preferences');
    return data;
  },

  /** Tüm tercihleri toplu güncelle */
  async updateAll(preferences: Record<string, unknown>): Promise<{ success: boolean }> {
    const { data } = await api.put('/api/preferences', preferences);
    return data;
  },

  /** Tek bir tercihi güncelle */
  async update(key: string, value: unknown): Promise<{ success: boolean }> {
    const { data } = await api.put(`/api/preferences/${key}`, { value });
    return data;
  },
};
