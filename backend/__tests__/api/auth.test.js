/**
 * Auth API Testleri
 * Kimlik doğrulama endpoint testleri
 *
 * Not: API testleri çalışan bir server gerektirir.
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
    console.warn(`⚠️ Server (${API_URL}) çalışmıyor, auth testleri SKIP edilecek`);
  }
});

describe('Auth API', () => {
  describe('POST /api/auth/login', () => {
    test('Eksik email ile 400 dönmeli', async ({ skip }) => {
      if (!serverAvailable) return skip();

      const response = await request(API_URL)
        .post('/api/auth/login')
        .send({ password: 'test123' })
        .timeout(5000);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    test('Eksik şifre ile 400 dönmeli', async ({ skip }) => {
      if (!serverAvailable) return skip();

      const response = await request(API_URL)
        .post('/api/auth/login')
        .send({ email: 'test@test.com' })
        .timeout(5000);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    test('Yanlış credentials ile 401 dönmeli', async ({ skip }) => {
      if (!serverAvailable) return skip();

      const response = await request(API_URL)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'wrongpassword',
        })
        .timeout(5000);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/auth/me', () => {
    test('Token olmadan 401 dönmeli', async ({ skip }) => {
      if (!serverAvailable) return skip();

      const response = await request(API_URL).get('/api/auth/me').timeout(5000);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    test('Geçersiz token ile 401 dönmeli', async ({ skip }) => {
      if (!serverAvailable) return skip();

      const response = await request(API_URL)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token-12345')
        .timeout(5000);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/register', () => {
    test('Eksik alanlarla 400 dönmeli', async ({ skip }) => {
      if (!serverAvailable) return skip();

      const response = await request(API_URL)
        .post('/api/auth/register')
        .send({ email: 'test@test.com' }) // name ve password eksik
        .timeout(5000);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });
});

describe('Auth Token Validasyonu', () => {
  test('JWT token formatı kontrol edilmeli', () => {
    // JWT format: header.payload.signature
    const validJwtPattern = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;

    const validToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    const invalidToken = 'not-a-valid-token';

    expect(validToken).toMatch(validJwtPattern);
    expect(invalidToken).not.toMatch(validJwtPattern);
  });
});
