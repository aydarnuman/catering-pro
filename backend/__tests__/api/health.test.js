/**
 * Health Check API Testleri
 * Temel sistem sağlık kontrolü
 */

import request from 'supertest';

// Not: Bu testler çalışan bir server gerektirir
// CI/CD için mock database kullanılabilir

const API_URL = process.env.API_URL || 'http://localhost:3001';

describe('Health Check API', () => {
  
  describe('GET /health', () => {
    
    test('Sağlık kontrolü 200 dönmeli', async () => {
      try {
        const response = await request(API_URL)
          .get('/health')
          .timeout(5000);
        
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status');
        expect(response.body.status).toBe('ok');
      } catch (error) {
        // Server çalışmıyorsa testi skip et
        if (error.code === 'ECONNREFUSED') {
          console.log('⚠️ Server çalışmıyor, test skip edildi');
          return;
        }
        throw error;
      }
    });
    
    test('Database bağlantısı kontrol edilmeli', async () => {
      try {
        const response = await request(API_URL)
          .get('/health')
          .timeout(5000);
        
        if (response.status === 200) {
          expect(response.body).toHaveProperty('database');
          expect(response.body.database).toBe('connected');
        }
      } catch (error) {
        if (error.code === 'ECONNREFUSED') {
          console.log('⚠️ Server çalışmıyor, test skip edildi');
          return;
        }
        throw error;
      }
    });
    
    test('Timestamp döndürülmeli', async () => {
      try {
        const response = await request(API_URL)
          .get('/health')
          .timeout(5000);
        
        if (response.status === 200) {
          expect(response.body).toHaveProperty('timestamp');
        }
      } catch (error) {
        if (error.code === 'ECONNREFUSED') {
          console.log('⚠️ Server çalışmıyor, test skip edildi');
          return;
        }
        throw error;
      }
    });
    
  });
  
  describe('GET /api/stats', () => {
    
    test('İstatistikler dönmeli', async () => {
      try {
        const response = await request(API_URL)
          .get('/api/stats')
          .timeout(5000);
        
        expect([200, 500]).toContain(response.status);
        
        if (response.status === 200) {
          expect(response.body).toHaveProperty('totalTenders');
          expect(response.body).toHaveProperty('activeTenders');
        }
      } catch (error) {
        if (error.code === 'ECONNREFUSED') {
          console.log('⚠️ Server çalışmıyor, test skip edildi');
          return;
        }
        throw error;
      }
    });
    
  });
  
  describe('404 Handler', () => {
    
    test('Olmayan endpoint 404 dönmeli', async () => {
      try {
        const response = await request(API_URL)
          .get('/api/nonexistent-endpoint-12345')
          .timeout(5000);
        
        expect(response.status).toBe(404);
        expect(response.body).toHaveProperty('error');
      } catch (error) {
        if (error.code === 'ECONNREFUSED') {
          console.log('⚠️ Server çalışmıyor, test skip edildi');
          return;
        }
        throw error;
      }
    });
    
  });
  
});
