/**
 * Merkezi Error Handling Utilities
 * Tüm hata yönetimi bu dosyadan yönetilir
 */

import { notifications } from '@mantine/notifications';

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
  let title = options.title || 'Hata';

  // Error objesi ise mesajı çıkar
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  } else if (error && typeof error === 'object' && 'message' in error) {
    message = String(error.message);
  }

  // API response hatası
  if (error && typeof error === 'object' && 'response' in error) {
    const apiError = error as { response?: { data?: { error?: string; message?: string } } };
    message = apiError.response?.data?.error || apiError.response?.data?.message || message;
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
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  options?: ErrorOptions
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    showError(error, options);
    return null;
  }
}
