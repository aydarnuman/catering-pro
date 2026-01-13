import axios from 'axios';
import { API_BASE_URL } from '@/lib/config';

// Create axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use((config) => {
  // Add auth token if available
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear token and redirect to login
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API functions
export const apiClient = {
  // Tenders
  async getTenders(params?: { page?: number; limit?: number; city?: string; search?: string; status?: string }) {
    const response = await api.get('/api/tenders', { params });
    return response.data;
  },

  async getTenderById(id: string) {
    const response = await api.get(`/api/tenders/${id}`);
    return response.data;
  },

  // Documents
  async uploadDocument(file: File, metadata?: Record<string, any>) {
    const formData = new FormData();
    formData.append('file', file);
    
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata));
    }

    const response = await api.post('/api/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async getDocuments() {
    const response = await api.get('/api/documents');
    return response.data;
  },

  async getTenderDocuments(tenderId: string) {
    const response = await api.get(`/api/documents/list/${tenderId}`);
    return response.data;
  },

  getDocumentDownloadUrl(tenderId: string, docType: string) {
    return `${API_BASE_URL}/api/documents/download/${tenderId}/${docType}`;
  },

  async scrapeDocumentsForTender(tenderId: string) {
    const response = await api.post(`/api/documents/scrape/${tenderId}`);
    return response.data;
  },

  // Health check
  async healthCheck() {
    const response = await api.get('/health');
    return response.data;
  },

  // Stats
  async getStats() {
    const response = await api.get('/api/stats');
    return response.data;
  },
};

export default apiClient;