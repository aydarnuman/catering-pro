/**
 * useReportExport - Hızlı rapor indirme hook'u
 * Sayfa içindeki küçük export ikonları için kullanılır.
 */

'use client';

import { notifications } from '@mantine/notifications';
import { useCallback, useState } from 'react';
import { downloadBlob, getFormatExtension, reportsAPI } from '@/lib/api/services/reports';

interface UseReportExportReturn {
  downloadReport: (reportId: string, format: 'excel' | 'pdf', context?: Record<string, unknown>) => Promise<void>;
  isDownloading: boolean;
  downloadingId: string | null;
}

export function useReportExport(): UseReportExportReturn {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const downloadReport = useCallback(async (
    reportId: string,
    format: 'excel' | 'pdf',
    context: Record<string, unknown> = {}
  ) => {
    try {
      setIsDownloading(true);
      setDownloadingId(reportId);

      const blob = await reportsAPI.generate(reportId, format, context);

      // Content-Disposition header'dan filename al veya default oluştur
      const filename = `${reportId}-${new Date().toISOString().split('T')[0]}${getFormatExtension(format)}`;
      downloadBlob(blob, filename);

      notifications.show({
        title: 'İndirildi',
        message: `${filename} başarıyla indirildi`,
        color: 'green',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Rapor indirilemedi';
      notifications.show({
        title: 'Hata',
        message,
        color: 'red',
      });
    } finally {
      setIsDownloading(false);
      setDownloadingId(null);
    }
  }, []);

  return { downloadReport, isDownloading, downloadingId };
}
