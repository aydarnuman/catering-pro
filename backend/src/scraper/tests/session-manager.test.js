/**
 * Session Manager Unit Tests
 * Cookie/Session dosya saklama
 *
 * Not: Testler gerçek dosya sistemi kullanır ama
 * session dosyası zaten storage/ altında saklanır.
 */

import { afterAll, beforeEach, describe, expect, test } from 'vitest';
import sessionManager from '../shared/ihalebul-cookie.js';

// ==================== SETUP ====================

// Her test öncesi temiz başla
beforeEach(() => {
  sessionManager.clearSession();
});

// Testler bitince temizle
afterAll(() => {
  sessionManager.clearSession();
});

// ==================== TESTLER ====================

describe('SessionManager', () => {
  describe('saveSession', () => {
    test('session kaydedilir', async () => {
      const cookies = [{ name: 'test', value: 'abc123', domain: '.ihalebul.com' }];
      const session = await sessionManager.saveSession(cookies, 'testuser');

      expect(session).toBeDefined();
      expect(session.id).toMatch(/^sess_/);
      expect(session.cookies).toEqual(cookies);
      expect(session.username).toBe('testuser');
      expect(session.createdAt).toBeGreaterThan(0);
      expect(session.expiresAt).toBeGreaterThan(session.createdAt);
    });

    test('session TTL doğru hesaplanır', async () => {
      const cookies = [{ name: 'sid', value: 'x' }];
      const session = await sessionManager.saveSession(cookies, 'user');

      const expectedTTL = sessionManager.sessionTTL;
      const actualTTL = session.expiresAt - session.createdAt;

      expect(actualTTL).toBe(expectedTTL);
    });
  });

  describe('loadSession', () => {
    test('kaydedilen session yüklenir', async () => {
      const cookies = [{ name: 'auth', value: 'token123' }];
      await sessionManager.saveSession(cookies, 'testuser');

      const loaded = await sessionManager.loadSession();

      expect(loaded).not.toBeNull();
      expect(loaded.cookies).toEqual(cookies);
      expect(loaded.username).toBe('testuser');
    });

    test('lastUsedAt güncellenir', async () => {
      const cookies = [{ name: 'auth', value: 'x' }];
      await sessionManager.saveSession(cookies, 'user');

      const before = Date.now();
      const loaded = await sessionManager.loadSession();
      const after = Date.now();

      expect(loaded.lastUsedAt).toBeGreaterThanOrEqual(before);
      expect(loaded.lastUsedAt).toBeLessThanOrEqual(after);
    });

    test('session yoksa null döner', async () => {
      const loaded = await sessionManager.loadSession();
      expect(loaded).toBeNull();
    });
  });

  describe('clearSession', () => {
    test('session silinir', async () => {
      const cookies = [{ name: 'sid', value: 'abc' }];
      await sessionManager.saveSession(cookies, 'user');

      sessionManager.clearSession();

      const loaded = await sessionManager.loadSession();
      expect(loaded).toBeNull();
    });

    test('session yokken clear çökmez', () => {
      expect(() => sessionManager.clearSession()).not.toThrow();
    });
  });

  describe('isSessionValid', () => {
    test('geçerli session → true', async () => {
      const cookies = [{ name: 'sid', value: 'abc' }];
      await sessionManager.saveSession(cookies, 'user');

      const valid = await sessionManager.isSessionValid();
      expect(valid).toBe(true);
    });

    test('session yoksa → falsy', async () => {
      const valid = await sessionManager.isSessionValid();
      expect(valid).toBeFalsy();
    });

    test('boş cookie listesi → false', async () => {
      await sessionManager.saveSession([], 'user');

      const valid = await sessionManager.isSessionValid();
      expect(valid).toBe(false);
    });
  });

  describe('session ID', () => {
    test('benzersiz session ID üretilir', async () => {
      const session1 = await sessionManager.saveSession([{ name: 'a', value: '1' }], 'u1');
      const id1 = session1.id;

      // Kısa bekle (Date.now() farkı için)
      await new Promise((r) => setTimeout(r, 5));

      const session2 = await sessionManager.saveSession([{ name: 'b', value: '2' }], 'u2');
      const id2 = session2.id;

      expect(id1).not.toBe(id2);
    });
  });
});
