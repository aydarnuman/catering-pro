/**
 * Reports API Service - Rapor Merkezi API Servisi
 * Tüm rapor endpoint'lerini saran merkezi servis.
 */

import { api } from '@/lib/api';

export interface ReportDefinition {
  id: string;
  label: string;
  description: string;
  icon: string;
  formats: ('excel' | 'pdf')[];
  requiresContext: boolean;
  contextType: string | null;
  category: string;
}

export interface ReportModule {
  module: string;
  label: string;
  reports: ReportDefinition[];
}

export interface ReportCatalog {
  modules: ReportModule[];
}

export interface ReportRequest {
  reportId: string;
  format?: 'excel' | 'pdf';
  context?: any;
}

export const reportsAPI = {
  /**
   * Rapor kataloğunu getir
   */
  async getCatalog(module?: string): Promise<ReportCatalog> {
    const url = module ? `/api/reports/catalog/${module}` : '/api/reports/catalog';
    const { data } = await api.get<ReportCatalog>(url);
    return data;
  },

  /**
   * Tek rapor üret ve indir
   */
  async generate(
    reportId: string,
    format: 'excel' | 'pdf' = 'pdf',
    context: any = {}
  ): Promise<Blob> {
    const { data } = await api.post(
      '/api/reports/generate',
      { reportId, format, context },
      {
        responseType: 'blob',
      }
    );
    return data;
  },

  /**
   * Rapor ön gösterim
   * PDF için blob döner, Excel için JSON tablo döner
   */
  async preview(
    reportId: string,
    format: 'excel' | 'pdf' = 'pdf',
    context: any = {}
  ): Promise<{ type: 'pdf' | 'table'; data: Blob | { headers: string[]; rows: any[] } }> {
    const { data, headers } = await api.post(
      '/api/reports/preview',
      { reportId, format, context },
      {
        responseType: 'blob',
      }
    );

    const contentType = headers['content-type'] || '';

    if (contentType.includes('application/json')) {
      // JSON blob'u parse et
      const text = await (data as Blob).text();
      const parsed = JSON.parse(text);
      return { type: 'table', data: parsed };
    }

    return { type: 'pdf', data: data as Blob };
  },

  /**
   * Toplu indirme (ZIP)
   */
  async bulk(reports: ReportRequest[]): Promise<Blob> {
    const { data } = await api.post(
      '/api/reports/bulk',
      { reports },
      {
        responseType: 'blob',
      }
    );
    return data;
  },

  /**
   * Raporları mail ile gönder
   */
  async sendMail(
    reports: ReportRequest[],
    email: string,
    subject?: string
  ): Promise<{ success: boolean; message: string }> {
    const { data } = await api.post('/api/reports/mail', { reports, email, subject });
    return data;
  },
};

/**
 * Blob'u dosya olarak indir
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Rapor format uzantısını al
 */
export function getFormatExtension(format: 'excel' | 'pdf'): string {
  return format === 'excel' ? '.xlsx' : '.pdf';
}

/**
 * Rapor format MIME tipini al
 */
export function getFormatMimeType(format: 'excel' | 'pdf'): string {
  return format === 'excel'
    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : 'application/pdf';
}
