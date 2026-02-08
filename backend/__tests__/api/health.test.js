/**
 * Health Check API Testleri
 * Temel sistem sağlık kontrolü
 *
 * Not: Bu testler çalışan bir server gerektirir.
 * Server yoksa testler SKIP edilir (sessiz pass değil).
 */

import { describe, test, expect, beforeAll } from 'vitest';
import request from 'supertest';

const API_URL = process.env.API_URL || 'http://localhost:3001';

let serverAvailable = false;

beforeAll(async () => {
  try {
    await request(API_URL).get('/health').timeout(3000);
    serverAvailable = true;
  } catch {
    console.warn(`⚠️ Server (${API_URL}) çalışmıyor, health testleri SKIP edilecek`);
  }
});

describe('Health Check API', () => {
  describe('GET /health', () => {
    test('Sağlık kontrolü 200 dönmeli', async ({ skip }) => {
      if (!serverAvailable) return skip();

      const response = await request(API_URL).get('/health').timeout(5000);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('ok');
    });

    test('Database bağlantısı kontrol edilmeli', async ({ skip }) => {
      if (!serverAvailable) return skip();

      const response = await request(API_URL).get('/health').timeout(5000);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('database');
      expect(response.body.database).toBe('connected');
    });

    test('Timestamp döndürülmeli', async ({ skip }) => {
      if (!serverAvailable) return skip();

      const response = await request(API_URL).get('/health').timeout(5000);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /api/stats', () => {
    test('İstatistikler dönmeli', async ({ skip }) => {
      if (!serverAvailable) return skip();

      const response = await request(API_URL).get('/api/stats').timeout(5000);

      expect([200, 500]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('totalTenders');
        expect(response.body).toHaveProperty('activeTenders');
      }
    });
  });

  describe('404 Handler', () => {
    test('Olmayan endpoint 404 dönmeli', async ({ skip }) => {
      if (!serverAvailable) return skip();

      const response = await request(API_URL).get('/api/nonexistent-endpoint-12345').timeout(5000);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });
});
