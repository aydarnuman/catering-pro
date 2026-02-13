/**
 * Merkezi Error Handling Utilities
 * Tüm hata yönetimi bu dosyadan yönetilir
 *
 * AI Error Collector: Hataları toplar ve God Mode'da AI'a gönderir
 */

import { notifications } from '@mantine/notifications';
import { getApiUrl } from './config';

// ============================================================
// AI ERROR COLLECTOR
// ============================================================

interface CollectedError {
  id: string;
  timestamp: string;
  type: 'error' | 'warning' | 'unhandled' | 'network' | 'api';
  message: string;
  stack?: string;
  url: string;
  userAgent: string;
  componentStack?: string;
  additionalInfo?: Record<string, unknown>;
}

// Bellekte tutulan hatalar (son 50 hata)
const errorBuffer: CollectedError[] = [];
const MAX_ERRORS = 50;

/**
 * Hatayı buffer'a ekle
 */
function addToErrorBuffer(error: CollectedError) {
  errorBuffer.unshift(error);
  if (errorBuffer.length > MAX_ERRORS) {
    errorBuffer.pop();
  }
}

/**
 * Toplanan hataları getir
 */
export function getCollectedErrors(): CollectedError[] {
  return [...errorBuffer];
}

/**
 * Hata buffer'ını temizle
 */
export function clearErrorBuffer() {
  errorBuffer.length = 0;
}

/**
 * Hatayı AI'a gönder (God Mode için)
 */
export async function sendErrorsToAI(errors?: CollectedError[]): Promise<{
  success: boolean;
  analysis?: string;
  suggestions?: string[];
  error?: string;
}> {
  const errorsToSend = errors || errorBuffer;

  if (errorsToSend.length === 0) {
    return { success: true, analysis: 'Gönderilecek hata yok.' };
  }

  try {
    const response = await fetch(getApiUrl('/ai/analyze-errors'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        errors: errorsToSend,
        context: {
          currentUrl: typeof window !== 'undefined' ? window.location.href : '',
          timestamp: new Date().toISOString(),
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
    };
  }
}

/**
 * Global error listener'ları kur
 * Bu fonksiyon app başlangıcında bir kez çağrılmalı
 */
export function initializeErrorCollector() {
  if (typeof window === 'undefined') return;

  // Global unhandled errors
  window.addEventListener('error', (event) => {
    const error: CollectedError = {
      id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      type: 'unhandled',
      message: event.message || 'Unknown error',
      stack: event.error?.stack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      additionalInfo: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    };
    addToErrorBuffer(error);
    console.debug('[ErrorCollector] Unhandled error captured:', error.message);
  });

  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const error: CollectedError = {
      id: `rej_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      type: 'unhandled',
      message: event.reason?.message || String(event.reason) || 'Unhandled promise rejection',
      stack: event.reason?.stack,
      url: window.location.href,
      userAgent: navigator.userAgent,
    };
    addToErrorBuffer(error);
    console.debug('[ErrorCollector] Unhandled rejection captured:', error.message);
  });

  // Console.error override (opsiyonel - geliştirme için)
  const originalConsoleError = console.error;
  console.error = (...args) => {
    const error: CollectedError = {
      id: `console_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      type: 'error',
      message: args.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' '),
      url: window.location.href,
      userAgent: navigator.userAgent,
    };
    addToErrorBuffer(error);
    originalConsoleError.apply(console, args);
  };

  console.info('[ErrorCollector] Initialized - capturing errors for AI analysis');
}

export interface ErrorOptions {
  /** Hata başlığı */
  title?: string;
  /** Hata mesajı */
  message?: string;
  /** Otomatik kapanma süresi (ms) */
  autoClose?: number | false;
  /** Hata rengi */
  color?: string;
  /** Hata sonrası callback */
  onClose?: () => void;
}

/**
 * Standart hata gösterimi
 * @param error - Hata objesi veya string
 * @param options - Ek seçenekler
 */
export function showError(error: unknown, options: ErrorOptions = {}) {
  let message = 'Bir hata oluştu';
  const title = options.title || 'Hata';
  let stack: string | undefined;
  let errorType: CollectedError['type'] = 'error';

  // Error objesi ise mesajı çıkar
  if (error instanceof Error) {
    message = error.message;
    stack = error.stack;
  } else if (typeof error === 'string') {
    message = error;
  } else if (error && typeof error === 'object' && 'message' in error) {
    message = String(error.message);
  }

  // API response hatası
  if (error && typeof error === 'object' && 'response' in error) {
    const apiError = error as { response?: { data?: { error?: string; message?: string } } };
    message = apiError.response?.data?.error || apiError.response?.data?.message || message;
    errorType = 'api';
  }

  // Network hatası kontrolü
  if (isNetworkError(error)) {
    errorType = 'network';
  }

  // Error buffer'a ekle (AI için)
  if (typeof window !== 'undefined') {
    const collectedError: CollectedError = {
      id: `show_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      type: errorType,
      message,
      stack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      additionalInfo: {
        title,
        originalError: error instanceof Error ? error.name : typeof error,
      },
    };
    addToErrorBuffer(collectedError);
  }

  notifications.show({
    title,
    message,
    color: options.color || 'red',
    autoClose: options.autoClose ?? 5000,
    onClose: options.onClose,
  });
}

/**
 * Başarı mesajı göster
 */
export function showSuccess(message: string, title: string = 'Başarılı', options?: { autoClose?: number | false }) {
  notifications.show({
    title,
    message,
    color: 'green',
    autoClose: options?.autoClose ?? 3000,
  });
}

/**
 * Uyarı mesajı göster
 */
export function showWarning(message: string, title: string = 'Uyarı', options?: { autoClose?: number | false }) {
  notifications.show({
    title,
    message,
    color: 'yellow',
    autoClose: options?.autoClose ?? 4000,
  });
}

/**
 * Bilgi mesajı göster
 */
export function showInfo(message: string, title: string = 'Bilgi', options?: { autoClose?: number | false }) {
  notifications.show({
    title,
    message,
    color: 'blue',
    autoClose: options?.autoClose ?? 3000,
  });
}

/**
 * Network hatası kontrolü
 */
export function isNetworkError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String(error.message).toLowerCase();
    return (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('connection') ||
      message.includes('timeout')
    );
  }
  return false;
}

/**
 * API hatası kontrolü
 */
export function isApiError(error: unknown): boolean {
  return error !== null && typeof error === 'object' && 'response' in error;
}

/**
 * Hata mesajını formatla
 */
export function formatErrorMessage(error: unknown, defaultMessage: string = 'Bir hata oluştu'): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object') {
    if ('message' in error) {
      return String(error.message);
    }
    if ('error' in error) {
      return String(error.error);
    }
    if ('response' in error) {
      const apiError = error as { response?: { data?: { error?: string; message?: string } } };
      return apiError.response?.data?.error || apiError.response?.data?.message || defaultMessage;
    }
  }
  return defaultMessage;
}

/**
 * Try-catch wrapper - otomatik hata gösterimi
 */
export async function withErrorHandling<T>(fn: () => Promise<T>, options?: ErrorOptions): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    showError(error, options);
    return null;
  }
}
