/**
 * Frontend Logger
 * Development'ta console'a yazar, production'da API'ye gönderir
 * Tüm console.* kullanımlarını bu logger'a yönlendir
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: unknown;
  timestamp: string;
  url?: string;
  userAgent?: string;
}

class Logger {
  private isDevelopment: boolean;
  private logToApi: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    // Production'da API'ye log göndermek için flag (opsiyonel)
    this.logToApi = process.env.NEXT_PUBLIC_LOG_TO_API === 'true';
  }

  private shouldLog(level: LogLevel): boolean {
    // debug: sadece NEXT_PUBLIC_DEBUG_LOGS=true iken (geliştirme/production fark etmez)
    const debugEnabled = process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true';
    if (level === 'debug') {
      return debugEnabled;
    }

    // Development'ta info/warn/error logla
    if (this.isDevelopment) {
      return true;
    }

    // Production'da sadece warn ve error logla
    return level === 'warn' || level === 'error';
  }

  private async sendToApi(entry: LogEntry): Promise<void> {
    if (!this.logToApi || this.isDevelopment) {
      return;
    }

    try {
      // API endpoint'e log gönder (opsiyonel, backend'de endpoint yoksa çalışmaz)
      await fetch('/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entry),
      }).catch(() => {
        // API'ye gönderilemezse sessizce devam et
      });
    } catch (_error) {
      // Hata durumunda sessizce devam et
    }
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : undefined,
    };

    // Development'ta console'a yaz
    if (this.isDevelopment) {
      const consoleMethod = console[level] || console.log;
      if (data) {
        consoleMethod(`[${level.toUpperCase()}] ${message}`, data);
      } else {
        consoleMethod(`[${level.toUpperCase()}] ${message}`);
      }
    }

    // Production'da API'ye gönder (opsiyonel)
    if (!this.isDevelopment && this.logToApi) {
      this.sendToApi(entry);
    }
  }

  debug(message: string, data?: unknown): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: unknown): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: unknown): void {
    this.log('error', message, data);
  }
}

// Singleton instance
export const logger = new Logger();

// Default export
export default logger;
