/**
 * Merkezi API Type Tanımları
 * Tüm API servisleri için ortak type'lar
 */

// Mevcut types/api.ts'den alınan ortak response type
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

// Generic API response wrapper
export interface ApiListResponse<T> {
  success: boolean;
  data: T[];
  total?: number;
  page?: number;
  limit?: number;
}

// Pagination params
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

// Sort params
export interface SortParams {
  sort?: string;
  order?: 'asc' | 'desc';
}

// Filter params
export interface FilterParams {
  search?: string;
  status?: string;
  [key: string]: any;
}
