/**
 * Scraper Logger Unit Tests
 * Console loglama ve session yaratma
 *
 * Not: DB loglama (LOG_TO_DB) bu testlerde kapalıdır.
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';

// LOG_TO_DB'yi kapalı tutmak için env ayarla
process.env.LOG_TO_DB = 'false';

// Logger modülünü import et
import scraperLogger from '../shared/scraper-logger.js';

// ==================== TESTLER ====================

describe('ScraperLogger', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('log seviyesi', () => {
    test('varsayılan seviye INFO', () => {
      // Logger constructor'ında level = LOG_LEVELS[process.env.LOG_LEVEL] ?? LOG_LEVELS.INFO
      // LOG_LEVELS.INFO = 1
      expect(scraperLogger.level).toBeLessThanOrEqual(1);
    });

    test('setLevel ile seviye değiştirilebilir', () => {
      scraperLogger.setLevel('DEBUG');
      expect(scraperLogger.level).toBe(0);

      scraperLogger.setLevel('ERROR');
      expect(scraperLogger.level).toBe(3);

      // Geri yükle
      scraperLogger.setLevel('INFO');
    });

    test("geçersiz seviye INFO'ya döner", () => {
      scraperLogger.setLevel('INVALID');
      expect(scraperLogger.level).toBe(1); // INFO
    });

    test("null seviye INFO'ya döner", () => {
      scraperLogger.setLevel(null);
      expect(scraperLogger.level).toBe(1);
    });
  });

  describe('log fonksiyonları', () => {
    test('info() mesaj loglar', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await scraperLogger.info('test-module', 'Test mesajı');

      expect(consoleSpy).toHaveBeenCalled();
      const logOutput = consoleSpy.mock.calls[0][0];
      expect(logOutput).toContain('INFO');
      expect(logOutput).toContain('test-module');
      expect(logOutput).toContain('Test mesajı');
    });

    test('warn() mesaj loglar', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await scraperLogger.warn('test-module', 'Uyarı mesajı');

      expect(consoleSpy).toHaveBeenCalled();
      const logOutput = consoleSpy.mock.calls[0][0];
      expect(logOutput).toContain('WARN');
    });

    test('error() mesaj loglar', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await scraperLogger.error('test-module', 'Hata mesajı');

      expect(consoleSpy).toHaveBeenCalled();
      const logOutput = consoleSpy.mock.calls[0][0];
      expect(logOutput).toContain('ERROR');
    });

    test('debug() INFO seviyesinde sessiz kalır', async () => {
      scraperLogger.setLevel('INFO');
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await scraperLogger.debug('test-module', 'Debug mesajı');

      // INFO seviyesinde DEBUG loglanmaz
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    test('debug() DEBUG seviyesinde loglar', async () => {
      scraperLogger.setLevel('DEBUG');
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await scraperLogger.debug('test-module', 'Debug mesajı');

      expect(consoleSpy).toHaveBeenCalled();

      // Seviyeyi geri yükle
      scraperLogger.setLevel('INFO');
    });

    test('data objesi loga dahil edilir', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await scraperLogger.info('test-module', 'Veri mesajı', { key: 'value' });

      expect(consoleSpy).toHaveBeenCalledWith(expect.any(String), { key: 'value' });
    });

    test('boş data objesi dahil edilmez', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await scraperLogger.info('test-module', 'Boş data');

      // 2. argüman boş string olmalı (data olmadığında)
      expect(consoleSpy).toHaveBeenCalledWith(expect.any(String), '');
    });
  });

  describe('createSession', () => {
    test('session objesini oluşturur', () => {
      const session = scraperLogger.createSession('test-scraper');

      expect(session).toHaveProperty('info');
      expect(session).toHaveProperty('warn');
      expect(session).toHaveProperty('error');
      expect(session).toHaveProperty('end');
      expect(typeof session.info).toBe('function');
      expect(typeof session.end).toBe('function');
    });

    test('session.end() süre döner', async () => {
      const _consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const session = scraperLogger.createSession('test-scraper');

      // Kısa bekle
      await new Promise((r) => setTimeout(r, 10));
      const result = session.end({ items: 5 });

      expect(result).toHaveProperty('duration_ms');
      expect(result.duration_ms).toBeGreaterThanOrEqual(0);
      expect(result.items).toBe(5);
    });

    test('session.info() doğru modülü kullanır', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const session = scraperLogger.createSession('my-module');

      await session.info('Session log');

      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][0]).toContain('my-module');
    });
  });
});
