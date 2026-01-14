import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, query } from './database.js';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './swagger.js';
import logger, { httpLogger, logError } from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Backend .env dosyasını yükle
dotenv.config({ path: path.join(__dirname, '../.env'), override: true });

const app = express();
const PORT = process.env.PORT || process.env.API_PORT || 3001;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000', 
    'http://127.0.0.1:3000',
    'http://localhost:3002', 
    'http://127.0.0.1:3002'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// HTTP Request Logger (Winston)
app.use(httpLogger);

// Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Catering Pro API Docs'
}));

// Swagger JSON endpoint (for Postman import)
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Sistem sağlık kontrolü
 *     description: API ve veritabanı bağlantı durumunu kontrol eder
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Sistem çalışıyor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 database:
 *                   type: string
 *                   example: connected
 *       500:
 *         description: Sistem hatası
 */
app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ 
      status: 'ok', 
      timestamp: result.rows[0].now,
      database: 'connected'
    });
  } catch (error) {
    logError('Health Check', error);
    res.status(500).json({ 
      status: 'error', 
      message: error.message,
      database: 'disconnected'
    });
  }
});

// Routes
import tendersRouter from './routes/tenders.js';
import documentsRouter from './routes/documents.js';
import authRouter from './routes/auth.js';
import documentProxyRouter from './routes/document-proxy.js';
import contentExtractorRouter from './routes/content-extractor.js';
import uyumsoftRouter from './routes/uyumsoft.js';
import aiRouter from './routes/ai.js';
import invoicesRouter from './routes/invoices.js';
import syncRouter from './routes/sync.js';
import databaseStatsRouter from './routes/database-stats.js';
import carilerRouter from './routes/cariler.js';
import etiketlerRouter from './routes/etiketler.js';
import satinAlmaRouter from './routes/satin-alma.js';
import aiMemoryRouter from './routes/ai-memory.js';
import duplicateCheckRouter from './routes/duplicate-check.js';
import stokRouter from './routes/stok.js';
import personelRouter from './routes/personel.js';
import bordroRouter from './routes/bordro.js';
import izinRouter from './routes/izin.js';
import exportRouter from './routes/export.js';
import importRouter from './routes/import.js';
import demirbasRouter from './routes/demirbas.js';
import kasaBankaRouter from './routes/kasa-banka.js';
import mutabakatRouter from './routes/mutabakat.js';
import bordroImportRouter from './routes/bordro-import.js';
import maasOdemeRouter from './routes/maas-odeme.js';
import projeHareketlerRouter from './routes/proje-hareketler.js';
import projelerRouter from './routes/projeler.js';
import planlamaRouter from './routes/planlama.js';
import menuPlanlamaRouter from './routes/menu-planlama.js';
import tekliflerRouter from './routes/teklifler.js';
import notlarRouter from './routes/notlar.js';
import firmalarRouter from './routes/firmalar.js';
import ihaleSonuclariRouter from './routes/ihale-sonuclari.js';
import searchRouter from './routes/search.js';
import notificationsRouter from './routes/notifications.js';
import tenderDocumentsRouter from './routes/tender-documents.js';
import tenderContentDocumentsRouter from './routes/tender-content-documents.js';
import tenderTrackingRouter from './routes/tender-tracking.js';
import scheduler from './services/sync-scheduler.js';
import tenderScheduler from './services/tender-scheduler.js';
import documentQueueProcessor from './services/document-queue-processor.js';

app.use('/api/tenders', tendersRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/documents', documentProxyRouter);
app.use('/api/auth', authRouter);
app.use('/api/content', contentExtractorRouter);
app.use('/api/uyumsoft', uyumsoftRouter);
app.use('/api/ai', aiRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/sync', syncRouter);
app.use('/api/database-stats', databaseStatsRouter);
app.use('/api/cariler', carilerRouter);
app.use('/api/etiketler', etiketlerRouter);
app.use('/api/satin-alma', satinAlmaRouter);
app.use('/api/ai/memory', aiMemoryRouter);
app.use('/api/duplicates', duplicateCheckRouter);
app.use('/api/stok', stokRouter);
app.use('/api/personel', personelRouter);
app.use('/api/bordro', bordroRouter);
app.use('/api/izin', izinRouter);
app.use('/api/export', exportRouter);
app.use('/api/import', importRouter);
app.use('/api/demirbas', demirbasRouter);
app.use('/api/kasa-banka', kasaBankaRouter);
app.use('/api/mutabakat', mutabakatRouter);
app.use('/api/bordro-import', bordroImportRouter);
app.use('/api/maas-odeme', maasOdemeRouter);
app.use('/api/proje-hareketler', projeHareketlerRouter);
app.use('/api/projeler', projelerRouter);
app.use('/api/planlama', planlamaRouter);
app.use('/api/menu-planlama', menuPlanlamaRouter);
app.use('/api/teklifler', tekliflerRouter);
app.use('/api/notlar', notlarRouter);
app.use('/api/firmalar', firmalarRouter);
app.use('/api/ihale-sonuclari', ihaleSonuclariRouter);
app.use('/api/search', searchRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/tender-docs', tenderDocumentsRouter);
app.use('/api/tender-content', tenderContentDocumentsRouter);
app.use('/api/tender-tracking', tenderTrackingRouter);

/**
 * @swagger
 * /api/stats:
 *   get:
 *     summary: Genel istatistikler
 *     description: Sistem genelindeki ihale ve döküman istatistiklerini döner
 *     tags: [System]
 *     responses:
 *       200:
 *         description: İstatistikler başarıyla alındı
 */
app.get('/api/stats', async (req, res) => {
  try {
    const tenderResult = await query('SELECT COUNT(*) as total FROM tenders');
    const activeTenderResult = await query("SELECT COUNT(*) as active FROM tenders WHERE tender_date > NOW()");
    
    let documentsCount = 0;
    try {
      const documentResult = await query('SELECT COUNT(*) as total FROM documents');
      documentsCount = parseInt(documentResult.rows[0].total);
    } catch (e) {
      // Documents table doesn't exist yet
    }

    let aiAnalysisCount = 0;
    try {
      const aiResult = await query('SELECT COUNT(*) as analyzed FROM tenders WHERE raw_data IS NOT NULL');
      aiAnalysisCount = parseInt(aiResult.rows[0].analyzed);
    } catch (e) {
      // Column doesn't exist yet
    }

    const stats = {
      totalTenders: parseInt(tenderResult.rows[0].total),
      activeTenders: parseInt(activeTenderResult.rows[0].active),
      expiredTenders: parseInt(tenderResult.rows[0].total) - parseInt(activeTenderResult.rows[0].active),
      totalDocuments: documentsCount,
      aiAnalysisCount: aiAnalysisCount
    };

    res.json(stats);
  } catch (error) {
    logError('Stats', error);
    res.status(500).json({ 
      error: 'İstatistikler alınamadı',
      details: error.message 
    });
  }
});

/**
 * @swagger
 * /api/logs/recent:
 *   get:
 *     summary: Son hata logları
 *     description: Son 50 hata kaydını döner (Admin only)
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Log listesi
 */
app.get('/api/logs/recent', async (req, res) => {
  try {
    const fs = await import('fs').then(m => m.promises);
    const logPath = path.join(__dirname, '../logs');
    
    // Bugünün error log dosyasını oku
    const today = new Date().toISOString().split('T')[0];
    const errorLogFile = path.join(logPath, `error-${today}.log`);
    
    try {
      const content = await fs.readFile(errorLogFile, 'utf-8');
      const lines = content.trim().split('\n').slice(-50); // Son 50 satır
      res.json({
        success: true,
        data: lines,
        file: `error-${today}.log`
      });
    } catch (e) {
      res.json({
        success: true,
        data: [],
        message: 'Bugün için hata kaydı yok'
      });
    }
  } catch (error) {
    logError('Logs API', error);
    res.status(500).json({ error: error.message });
  }
});

// 404 handler
app.use((req, res) => {
  logger.warn(`404 Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: 'Endpoint bulunamadı' });
});

// Error handler
app.use((err, req, res, next) => {
  logError('Unhandled Error', err, { 
    method: req.method, 
    url: req.originalUrl 
  });
  
  res.status(err.status || 500).json({
    error: err.message || 'Sunucu hatası',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 API Server başlatıldı`, { port: PORT });
  logger.info(`📚 API Docs: http://localhost:${PORT}/api-docs`);
  logger.info(`📊 Health check: http://localhost:${PORT}/health`);
  
  // Console'a da yaz (development için)
  console.log(`\n🚀 API Server çalışıyor: http://localhost:${PORT}`);
  console.log(`📚 API Docs: http://localhost:${PORT}/api-docs`);
  console.log(`📊 Health check: http://localhost:${PORT}/health\n`);
  
  // Scheduler'ları başlat
  logger.info('🔄 Otomatik senkronizasyon scheduler başlatılıyor...');
  scheduler.start();
  
  logger.info('🔍 İhale scraper scheduler başlatılıyor...');
  tenderScheduler.start();
  
  logger.info('📋 Document queue processor başlatılıyor...');
  documentQueueProcessor.start();
});

export default app;
