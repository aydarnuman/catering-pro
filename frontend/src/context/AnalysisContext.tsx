'use client';

/**
 * AnalysisContext
 * Arka planda çalışan döküman analizlerini global olarak yönetir
 * Birden fazla ihale için eşzamanlı analiz desteği
 */

import { notifications } from '@mantine/notifications';
import { IconCheck, IconX } from '@tabler/icons-react';
import type React from 'react';
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { AnalysisProgressData, FileProgress } from '@/components/analysis/AnalysisProgressModal';
import { API_BASE_URL } from '@/lib/config';

// Analiz job tipi
export interface AnalysisJob {
  id: string;
  tenderId: string;
  tenderTitle?: string;
  documentIds: number[];
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  progress: AnalysisProgressData;
  startTime: number;
  endTime?: number;
  results?: any[];
  error?: string;
}

// Context tipi
interface AnalysisContextType {
  jobs: AnalysisJob[];
  activeJobCount: number;
  startBackgroundAnalysis: (tenderId: string, tenderTitle: string, documentIds: number[]) => Promise<string>;
  cancelJob: (jobId: string) => void;
  removeJob: (jobId: string) => void;
  getJobByTenderId: (tenderId: string) => AnalysisJob | undefined;
}

const AnalysisContext = createContext<AnalysisContextType>({
  jobs: [],
  activeJobCount: 0,
  startBackgroundAnalysis: async () => '',
  cancelJob: () => {},
  removeJob: () => {},
  getJobByTenderId: () => undefined,
});

export function AnalysisProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<AnalysisJob[]>([]);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  // Aktif job sayısı
  const activeJobCount = jobs.filter((j) => j.status === 'running').length;

  // Job güncelle
  const updateJob = useCallback((jobId: string, updates: Partial<AnalysisJob>) => {
    setJobs((prev) => prev.map((job) => (job.id === jobId ? { ...job, ...updates } : job)));
  }, []);

  // Arka planda analiz başlat
  const startBackgroundAnalysis = useCallback(
    async (tenderId: string, tenderTitle: string, documentIds: number[]): Promise<string> => {
      const jobId = `analysis-${tenderId}-${Date.now()}`;
      const abortController = new AbortController();
      abortControllersRef.current.set(jobId, abortController);

      // Initial files
      const initialFiles: FileProgress[] = documentIds.map((id, index) => ({
        id,
        filename: `Döküman ${index + 1}`,
        status: 'pending',
      }));

      // Yeni job oluştur
      const newJob: AnalysisJob = {
        id: jobId,
        tenderId,
        tenderTitle,
        documentIds,
        status: 'running',
        progress: {
          current: 0,
          total: documentIds.length,
          message: 'Analiz başlıyor...',
          startTime: Date.now(),
          files: initialFiles,
        },
        startTime: Date.now(),
      };

      setJobs((prev) => [...prev, newJob]);

      // Arka planda çalıştır
      (async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/tender-content/analyze-batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documentIds }),
            credentials: 'include',
            signal: abortController.signal,
          });

          if (!response.ok) {
            throw new Error('Analiz başlatılamadı');
          }

          const reader = response.body?.getReader();
          const decoder = new TextDecoder();

          if (!reader) {
            throw new Error('Stream okunamadı');
          }

          let buffer = '';
          const allResults: any[] = [];

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            const parts = buffer.split('\n\n');
            buffer = parts.pop() || '';

            for (const part of parts) {
              const line = part.trim();
              if (!line.startsWith('data: ') || line.length <= 6) continue;

              try {
                const data = JSON.parse(line.slice(6));

                // Start event - dosya listesini güncelle
                if (data.stage === 'start' && data.files) {
                  updateJob(jobId, {
                    progress: {
                      ...newJob.progress,
                      files: data.files.map((f: any) => ({
                        id: f.id,
                        filename: f.filename,
                        status: 'pending',
                      })),
                    },
                  });
                }

                // Processing event
                if (data.stage === 'processing') {
                  updateJob(jobId, {
                    progress: {
                      current: data.current,
                      total: data.total,
                      message: data.message,
                      startTime: newJob.startTime,
                      currentFile: {
                        id: data.documentId,
                        filename: data.filename,
                        status: 'processing',
                        stage: data.fileStage,
                        stageDetail: data.stageDetail,
                        progress: data.fileProgress,
                      },
                    },
                  });
                }

                // Document complete
                if (data.stage === 'document_complete') {
                  if (data.success && data.analysis) {
                    allResults.push(data);
                  }
                }

                // Complete event
                if (data.stage === 'complete') {
                  updateJob(jobId, {
                    status: 'completed',
                    endTime: Date.now(),
                    results: data.results,
                    progress: {
                      current: data.summary?.total ?? documentIds.length,
                      total: data.summary?.total ?? documentIds.length,
                      message: `Tamamlandı! (${data.summary?.success ?? 0}/${data.summary?.total ?? 0})`,
                      startTime: newJob.startTime,
                    },
                  });

                  // Bildirim göster
                  notifications.show({
                    id: `analysis-complete-${jobId}`,
                    title: '🎉 Analiz Tamamlandı',
                    message: `${tenderTitle || tenderId}: ${data.summary?.success ?? 0} döküman analiz edildi`,
                    color: 'green',
                    icon: <IconCheck size={16} />,
                    autoClose: 10000,
                  });

                  // Browser notification
                  if (Notification.permission === 'granted') {
                    new Notification('Döküman Analizi Tamamlandı', {
                      body: `${tenderTitle || tenderId}: ${data.summary?.success ?? 0} döküman analiz edildi`,
                      icon: '/logo.svg',
                    });
                  }
                }

                // Error
                if (data.stage === 'error') {
                  throw new Error(data.message);
                }
              } catch (parseErr: any) {
                if (parseErr instanceof SyntaxError) continue;
                throw parseErr;
              }
            }
          }
        } catch (error: any) {
          if (error.name === 'AbortError') {
            updateJob(jobId, {
              status: 'cancelled',
              endTime: Date.now(),
              progress: {
                ...newJob.progress,
                message: 'Analiz iptal edildi',
              },
            });
          } else {
            updateJob(jobId, {
              status: 'failed',
              endTime: Date.now(),
              error: error.message,
              progress: {
                ...newJob.progress,
                message: `Hata: ${error.message}`,
              },
            });

            notifications.show({
              id: `analysis-error-${jobId}`,
              title: '❌ Analiz Hatası',
              message: `${tenderTitle || tenderId}: ${error.message}`,
              color: 'red',
              icon: <IconX size={16} />,
              autoClose: 10000,
            });
          }
        } finally {
          abortControllersRef.current.delete(jobId);
        }
      })();

      return jobId;
    },
    [updateJob]
  );

  // Job iptal et
  const cancelJob = useCallback((jobId: string) => {
    const controller = abortControllersRef.current.get(jobId);
    if (controller) {
      controller.abort();
    }
  }, []);

  // Job kaldır (listeden)
  const removeJob = useCallback((jobId: string) => {
    setJobs((prev) => prev.filter((job) => job.id !== jobId));
  }, []);

  // TenderId ile job bul
  const getJobByTenderId = useCallback(
    (tenderId: string) => {
      return jobs.find((j) => j.tenderId === tenderId && j.status === 'running');
    },
    [jobs]
  );

  return (
    <AnalysisContext.Provider
      value={{
        jobs,
        activeJobCount,
        startBackgroundAnalysis,
        cancelJob,
        removeJob,
        getJobByTenderId,
      }}
    >
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis() {
  return useContext(AnalysisContext);
}

export default AnalysisContext;
