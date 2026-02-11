/**
 * useQueueProgress
 * SSE ile kuyruk işleme progress takibi
 *
 * Queue processor dokümanları işlerken frontend'e gerçek zamanlı bildirim gönderir.
 * EventSource ile /api/documents/queue/progress endpoint'ine bağlanır.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '@/lib/config';

export interface QueueEvent {
  documentId: number;
  filename: string;
  status: 'processing' | 'completed' | 'failed';
  stage?: string;
  message: string;
  error?: string;
  timestamp: number;
}

export interface QueueStatus {
  pending: number;
  queued: number;
  processing: number;
  isProcessing: boolean;
  totalInQueue: number;
}

interface UseQueueProgressOptions {
  /** Otomatik bağlansın mı (default: false) */
  autoConnect?: boolean;
  /** Doküman tamamlandığında callback */
  onDocumentComplete?: (event: QueueEvent) => void;
  /** Hata olduğunda callback */
  onDocumentError?: (event: QueueEvent) => void;
}

interface UseQueueProgressReturn {
  /** Bağlı mı */
  isConnected: boolean;
  /** Kuyruk durumu */
  queueStatus: QueueStatus | null;
  /** Son eventler listesi (max 50) */
  recentEvents: QueueEvent[];
  /** İşlenmekte olan dokümanlar */
  processingDocs: QueueEvent[];
  /** Bağlantıyı başlat */
  connect: () => void;
  /** Bağlantıyı kes */
  disconnect: () => void;
}

const MAX_EVENTS = 50;

export function useQueueProgress(options: UseQueueProgressOptions = {}): UseQueueProgressReturn {
  const { autoConnect = false, onDocumentComplete, onDocumentError } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [recentEvents, setRecentEvents] = useState<QueueEvent[]>([]);
  const [processingDocs, setProcessingDocs] = useState<QueueEvent[]>([]);

  const eventSourceRef = useRef<EventSource | null>(null);
  const onDocumentCompleteRef = useRef(onDocumentComplete);
  const onDocumentErrorRef = useRef(onDocumentError);

  // Callback ref'leri güncelle (stale closure önleme)
  useEffect(() => {
    onDocumentCompleteRef.current = onDocumentComplete;
    onDocumentErrorRef.current = onDocumentError;
  }, [onDocumentComplete, onDocumentError]);

  const addEvent = useCallback((event: QueueEvent) => {
    setRecentEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS));
  }, []);

  const connect = useCallback(() => {
    if (eventSourceRef.current) return;

    const es = new EventSource(`${API_BASE_URL}/api/documents/queue/progress`, {
      withCredentials: true,
    });

    es.onopen = () => {
      setIsConnected(true);
    };

    es.onerror = () => {
      setIsConnected(false);
      // Auto-reconnect (EventSource handles this natively)
    };

    // Kuyruk durumu
    es.addEventListener('queue_status', (e) => {
      try {
        const data = JSON.parse(e.data);
        setQueueStatus(data);
      } catch {}
    });

    // Doküman işleniyor
    es.addEventListener('document_processing', (e) => {
      try {
        const data = JSON.parse(e.data);
        const event: QueueEvent = { ...data, timestamp: Date.now() };

        setProcessingDocs((prev) => {
          const existing = prev.findIndex((d) => d.documentId === data.documentId);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = event;
            return updated;
          }
          return [...prev, event];
        });

        addEvent(event);
      } catch {}
    });

    // Doküman tamamlandı
    es.addEventListener('document_complete', (e) => {
      try {
        const data = JSON.parse(e.data);
        const event: QueueEvent = { ...data, timestamp: Date.now() };

        setProcessingDocs((prev) => prev.filter((d) => d.documentId !== data.documentId));
        addEvent(event);
        onDocumentCompleteRef.current?.(event);
      } catch {}
    });

    // Doküman hata
    es.addEventListener('document_error', (e) => {
      try {
        const data = JSON.parse(e.data);
        const event: QueueEvent = { ...data, timestamp: Date.now() };

        setProcessingDocs((prev) => prev.filter((d) => d.documentId !== data.documentId));
        addEvent(event);
        onDocumentErrorRef.current?.(event);
      } catch {}
    });

    eventSourceRef.current = es;
  }, [addEvent]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    }
  }, []);

  // Auto-connect
  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    return () => disconnect();
  }, [autoConnect, connect, disconnect]);

  return {
    isConnected,
    queueStatus,
    recentEvents,
    processingDocs,
    connect,
    disconnect,
  };
}

export default useQueueProgress;
