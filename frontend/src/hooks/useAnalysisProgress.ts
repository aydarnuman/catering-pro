/**
 * useAnalysisProgress
 * SSE ile döküman analizi progress yönetimi
 */

import { useCallback, useRef, useState } from 'react';
import type {
  AnalysisProgressData,
  FileProgress,
} from '@/components/analysis/AnalysisProgressModal';
import { API_BASE_URL } from '@/lib/config';

interface AnalysisResult {
  success: boolean;
  documentId: number;
  analysis?: any;
  error?: string;
}

interface UseAnalysisProgressOptions {
  onComplete?: (results: AnalysisResult[]) => void;
  onError?: (error: string) => void;
  onProgress?: (progress: AnalysisProgressData) => void;
}

interface UseAnalysisProgressReturn {
  progress: AnalysisProgressData;
  isAnalyzing: boolean;
  startAnalysis: (documentIds: number[]) => Promise<AnalysisResult[]>;
  cancelAnalysis: () => void;
  resetProgress: () => void;
}

const initialProgress: AnalysisProgressData = {
  current: 0,
  total: 0,
  message: '',
  files: [],
};

export function useAnalysisProgress(
  options: UseAnalysisProgressOptions = {}
): UseAnalysisProgressReturn {
  const { onComplete, onError, onProgress } = options;

  const [progress, setProgress] = useState<AnalysisProgressData>(initialProgress);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);

  // Progress güncelle
  const updateProgress = useCallback(
    (newProgress: Partial<AnalysisProgressData>) => {
      setProgress((prev) => {
        const updated = { ...prev, ...newProgress };
        onProgress?.(updated);
        return updated;
      });
    },
    [onProgress]
  );

  // Analizi başlat
  const startAnalysis = useCallback(
    async (documentIds: number[]): Promise<AnalysisResult[]> => {
      if (isAnalyzing) {
        throw new Error('Analiz zaten devam ediyor');
      }

      setIsAnalyzing(true);
      startTimeRef.current = Date.now();
      abortControllerRef.current = new AbortController();

      // Initial progress with file list
      const initialFiles: FileProgress[] = documentIds.map((id, index) => ({
        id,
        filename: `Döküman ${index + 1}`, // Backend'den gelecek
        status: 'pending',
      }));

      updateProgress({
        current: 0,
        total: documentIds.length,
        message: 'Analiz başlıyor...',
        startTime: startTimeRef.current,
        files: initialFiles,
      });

      const allResults: AnalysisResult[] = [];

      try {
        const response = await fetch(`${API_BASE_URL}/api/tender-content/analyze-batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentIds }),
          credentials: 'include',
          signal: abortControllerRef.current.signal,
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

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // SSE parse
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';

          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith('data: ') || line.length <= 6) continue;

            try {
              const data = JSON.parse(line.slice(6));

              // Processing stage
              if (data.stage === 'processing') {
                const elapsedTime = Date.now() - startTimeRef.current;
                const avgTimePerDoc = data.current > 0 ? elapsedTime / data.current : 0;
                const estimatedRemaining = avgTimePerDoc * (data.total - data.current);

                // Files listesini güncelle
                const updatedFiles =
                  progress.files?.map((f) => {
                    if (f.id === data.documentId) {
                      return {
                        ...f,
                        filename: data.filename || f.filename,
                        status: 'processing' as const,
                        stage: data.fileStage,
                        stageDetail: data.stageDetail,
                        progress: data.fileProgress,
                      };
                    }
                    return f;
                  }) || [];

                updateProgress({
                  current: data.current,
                  total: data.total,
                  message: data.message,
                  estimatedRemaining,
                  currentFile: {
                    id: data.documentId,
                    filename: data.filename || `Döküman ${data.current}`,
                    status: 'processing',
                    stage: data.fileStage,
                    stageDetail: data.stageDetail,
                    progress: data.fileProgress,
                  },
                  files: updatedFiles,
                });
              }

              // Document complete
              if (data.stage === 'document_complete') {
                const updatedFiles =
                  progress.files?.map((f) => {
                    if (f.id === data.documentId) {
                      return {
                        ...f,
                        status: data.success ? ('completed' as const) : ('failed' as const),
                        stage: 'complete' as const,
                        duration: data.duration,
                        error: data.error,
                      };
                    }
                    return f;
                  }) || [];

                updateProgress({ files: updatedFiles });

                if (data.success && data.analysis) {
                  allResults.push({
                    success: true,
                    documentId: data.documentId,
                    analysis: data.analysis,
                  });
                }
              }

              // All complete
              if (data.stage === 'complete') {
                data.results?.forEach((r: any) => {
                  if (
                    r.success &&
                    r.analysis &&
                    !allResults.find((a) => a.documentId === r.documentId)
                  ) {
                    allResults.push(r);
                  }
                });

                updateProgress({
                  current: data.summary?.total ?? documentIds.length,
                  total: data.summary?.total ?? documentIds.length,
                  message: `Tamamlandı! (${data.summary?.success ?? allResults.length}/${data.summary?.total ?? documentIds.length})`,
                });
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

        onComplete?.(allResults);
        return allResults;
      } catch (error: any) {
        if (error.name === 'AbortError') {
          updateProgress({ message: 'Analiz iptal edildi' });
          return [];
        }

        onError?.(error.message);
        throw error;
      } finally {
        setIsAnalyzing(false);
        abortControllerRef.current = null;
      }
    },
    [isAnalyzing, updateProgress, onComplete, onError, progress.files]
  );

  // Analizi iptal et
  const cancelAnalysis = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // Progress sıfırla
  const resetProgress = useCallback(() => {
    setProgress(initialProgress);
    setIsAnalyzing(false);
  }, []);

  return {
    progress,
    isAnalyzing,
    startAnalysis,
    cancelAnalysis,
    resetProgress,
  };
}

export default useAnalysisProgress;
