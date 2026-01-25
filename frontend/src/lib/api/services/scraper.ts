/**
 * Scraper API Servisleri
 * Scraper yönetimi için merkezi API servisleri
 */

import { api } from '@/lib/api';
import type { ApiResponse } from '../types';

// Scraper Health Response
export interface ScraperHealth {
  status: 'running' | 'stopped' | 'error';
  uptime?: number;
  lastJob?: string;
  error?: string;
}

// Scraper Stats Response
export interface ScraperStats {
  totalJobs: number;
  runningJobs: number;
  completedJobs: number;
  failedJobs: number;
  lastRun?: string;
}

// Scraper Job
export interface ScraperJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  type: string;
  created_at: string;
  completed_at?: string;
  error?: string;
}

// Scraper Log
export interface ScraperLog {
  id: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
}

// Scraper API
export const scraperAPI = {
  /**
   * Scraper sağlık durumunu kontrol et
   */
  async getHealth(): Promise<ApiResponse<ScraperHealth>> {
    const response = await api.get('/api/scraper/health');
    return response.data;
  },

  /**
   * Scraper istatistiklerini getir
   */
  async getStats(): Promise<ApiResponse<ScraperStats>> {
    const response = await api.get('/api/scraper/stats');
    return response.data;
  },

  /**
   * Scraper işlerini listele
   */
  async getJobs(params?: {
    status?: string;
    limit?: number;
  }): Promise<ApiResponse<ScraperJob[]>> {
    const response = await api.get('/api/scraper/jobs', { params });
    return response.data;
  },

  /**
   * Scraper loglarını getir
   */
  async getLogs(params?: {
    level?: string;
    limit?: number;
  }): Promise<ApiResponse<ScraperLog[]>> {
    const response = await api.get('/api/scraper/logs', { params });
    return response.data;
  },

  /**
   * Scraper'ı kontrol et (start, stop, restart)
   */
  async control(action: 'start' | 'stop' | 'restart'): Promise<ApiResponse<any>> {
    const response = await api.post(`/api/scraper/${action}`);
    return response.data;
  },

  /**
   * Manuel ihale ekle
   */
  async addTender(url: string): Promise<ApiResponse<any>> {
    const response = await api.post('/api/scraper/add-tender', { url });
    return response.data;
  },
};
