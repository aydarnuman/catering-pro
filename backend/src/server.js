// ENV LOADER MUST BE FIRST - before any other imports!
import './env-loader.js';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, query } from './database.js';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './swagger.js';
import logger, { httpLogger, logError } from './utils/logger.js';
import { apiLimiter, authLimiter } from './middleware/rate-limiter.js';
import { globalErrorHandler, notFoundHandler } from './middleware/error-handler.js';
import { csrfProtection } from './middleware/csrf.js';
import { ipAccessControl } from './middleware/ip-access-control.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || process.env.API_PORT || 3001;

// Trust proxy - Rate limiter için gerekli (X-Forwarded-For header'ı için)
// Sadece bir proxy'ye güven (nginx) - permissive trust proxy hatasını önler
app.set('trust proxy', 1);

// Middleware
// Security Headers (Helmet)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Swagger UI için
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Swagger UI için
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Swagger UI için
}));

// CORS yapılandırması - Development ve Production
const allowedOrigins = [
  'http://localhost:3000', 
  'http://127.0.0.1:3000',
  'http://localhost:3002', 
  'http://127.0.0.1:3002',
  // Production domains
  'https://catering-tr.com',
  'https://www.catering-tr.com',
  // Production IP (geçici - domain'e geçince kaldırılabilir)
  'http://46.101.172.210',
  'https://46.101.172.210'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    // Exact match
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // IP adresi pattern kontrolü (46.101.172.210 ile başlayan)
    if (origin.startsWith('http://46.101.172.210') || origin.startsWith('https://46.101.172.210')) {
      return callback(null, true);
    }

    // Localhost pattern kontrolü (development için)
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return callback(null, true);
    }

    logger.warn(`CORS blocked request`, { origin });
    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma', 'Expires', 'X-CSRF-Token']
}));

// Cookie Parser
app.use(cookieParser());

// Response Compression - Network trafiğini 3-10x azaltır
app.use(compression({
  filter: (req, res) => {
    // Compression'ı devre dışı bırakmak isteyen header'ı kontrol et
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Varsayılan filter'ı kullan (text, json, etc.)
    return compression.filter(req, res);
  },
  level: 6, // Compression seviyesi (1-9, 6 optimal denge)
  threshold: 1024, // 1KB altındaki yanıtları sıkıştırma
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// HTTP Request Logger (Winston)
app.use(httpLogger);

// CSRF Protection - Cookie parser'dan sonra, route'lardan önce
app.use(csrfProtection);

// IP Access Control - Rate limiting'den önce (güvenlik için)
// NOT: Health check ve auth endpoint'leri hariç
app.use((req, res, next) => {
  // Health check ve auth endpoint'leri için IP kontrolü atla
  const skip = req.path === '/' || req.path === '/health' || req.path.startsWith('/api-docs')
    || req.path.startsWith('/api/auth/login') || req.path.startsWith('/api/auth/register');
  if (skip) {
    return next();
  }
  ipAccessControl(req, res, next);
});

// Rate Limiting - Genel API limiti (DDoS koruması)
app.use('/api', apiLimiter);

// Statik Dosya Sunucusu - Yüklenen belgeler için
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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

// Root – API bilgisi ve linkler (404 yerine anlamlı yanıt)
app.get('/', (req, res) => {
  const base = req.protocol + '://' + (req.get('host') || `localhost:${PORT}`);
  res.json({
    name: 'Catering Pro API',
    version: '1.0.0',
    status: 'ok',
    docs: `${base}/api-docs`,
    openApi: `${base}/api-docs.json`,
    health: `${base}/health`,
  });
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
    // Database bağlantısını test et
    const dbResult = await pool.query('SELECT NOW()');
    const dbConnected = dbResult.rows.length > 0;
    
    // Memory kullanımı
    const memUsage = process.memoryUsage();
    const memInfo = {
      rss: Math.round(memUsage.rss / 1024 / 1024), // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      external: Math.round(memUsage.external / 1024 / 1024), // MB
    };
    
    // Disk kullanımı (sadece process.cwd() için)
    let diskInfo = null;
    try {
      const fs = await import('fs').then(m => m.promises);
      const stats = await fs.statfs(process.cwd());
      diskInfo = {
        free: Math.round(stats.bavail * stats.bsize / 1024 / 1024), // MB
        total: Math.round(stats.blocks * stats.bsize / 1024 / 1024), // MB
        used: Math.round((stats.blocks - stats.bavail) * stats.bsize / 1024 / 1024), // MB
      };
    } catch (diskError) {
      // statfs bazı sistemlerde mevcut olmayabilir, hata verme
      logger.debug('Disk usage bilgisi alınamadı', { error: diskError.message });
    }
    
    // Uptime
    const uptime = Math.round(process.uptime());
    
    res.json({ 
      status: 'ok', 
      timestamp: dbResult.rows[0].now,
      database: dbConnected ? 'connected' : 'disconnected',
      memory: memInfo,
      ...(diskInfo && { disk: diskInfo }),
      uptime: uptime, // saniye
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development',
    });
  } catch (error) {
    logError('Health Check', error);
    res.status(500).json({ 
      status: 'error', 
      message: error.message,
      database: 'disconnected',
      timestamp: new Date().toISOString(),
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
import urunlerRouter from './routes/urunler.js';
import faturaKalemlerRouter from './routes/fatura-kalemler.js';
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
// DEPRECATED: Eski not sistemi - unified_notes'a taşındı (2026-01-29)
// import notlarRouter from './routes/notlar.js';
import unifiedNotesRouter from './routes/notes/index.js';
import firmalarRouter from './routes/firmalar.js';
import ihaleSonuclariRouter from './routes/ihale-sonuclari.js';
import searchRouter from './routes/search.js';
import notificationsRouter from './routes/notifications.js';
import tenderDocumentsRouter from './routes/tender-documents.js';
import tenderContentDocumentsRouter from './routes/tender-content-documents.js';
import tenderTrackingRouter from './routes/tender-tracking.js';
import permissionsRouter from './routes/permissions.js';
import auditLogsRouter from './routes/audit-logs.js';
import mailRouter from './routes/mail.js';
import scraperRouter from './routes/scraper.js';
import maliyetAnaliziRouter from './routes/maliyet-analizi.js';
// DEPRECATED: Eski ihale not sistemi - unified_notes'a taşındı (2026-01-29)
// import tenderNotesRouter from './routes/tender-notes.js';
import tenderDilekceRouter from './routes/tender-dilekce.js';
import socialRouter from './routes/social.js';
import systemRouter from './routes/system.js';
import promptBuilderRouter from './routes/prompt-builder.js';
import preferencesRouter from './routes/preferences.js';
import scheduler from './services/sync-scheduler.js';
import tenderScheduler from './services/tender-scheduler.js';
import documentQueueProcessor from './services/document-queue-processor.js';
import reminderNotificationScheduler from './services/reminder-notification-scheduler.js';
// Migration'lar artık Supabase CLI ile yönetiliyor
// import { runMigrations } from './utils/migration-runner.js';
// Yeni migration oluşturma: supabase migration new <isim>
// Migration uygulama: supabase db push
import systemMonitor from './services/system-monitor.js';

// Auth routes - Özel rate limiter ile (brute-force koruması)
app.use('/api/auth', authLimiter, authRouter);

app.use('/api/tenders', tendersRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/documents', documentProxyRouter);
app.use('/api/content', contentExtractorRouter);
app.use('/api/uyumsoft', uyumsoftRouter);
app.use('/api/ai', aiRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/fatura-kalemleri', faturaKalemlerRouter);
app.use('/api/sync', syncRouter);
app.use('/api/database-stats', databaseStatsRouter);
app.use('/api/cariler', carilerRouter);
app.use('/api/etiketler', etiketlerRouter);
app.use('/api/satin-alma', satinAlmaRouter);
app.use('/api/ai/memory', aiMemoryRouter);
app.use('/api/duplicates', duplicateCheckRouter);
app.use('/api/stok', stokRouter);
app.use('/api/urunler', urunlerRouter);
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
// DEPRECATED: Eski not sistemi - unified_notes'a taşındı (2026-01-29)
// app.use('/api/notlar', notlarRouter);
app.use('/api/notes', unifiedNotesRouter);  // Unified Notes System
app.use('/api/firmalar', firmalarRouter);
app.use('/api/ihale-sonuclari', ihaleSonuclariRouter);
app.use('/api/search', searchRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/tender-docs', tenderDocumentsRouter);
app.use('/api/tender-content', tenderContentDocumentsRouter);
app.use('/api/tender-tracking', tenderTrackingRouter);
app.use('/api/permissions', permissionsRouter);
app.use('/api/audit-logs', auditLogsRouter);
app.use('/api/mail', mailRouter);
app.use('/api/scraper', scraperRouter);
app.use('/api/maliyet-analizi', maliyetAnaliziRouter);
// DEPRECATED: Eski ihale not sistemi - unified_notes'a taşındı (2026-01-29)
// app.use('/api/tender-notes', tenderNotesRouter);
app.use('/api/tender-dilekce', tenderDilekceRouter);
app.use('/api/social', socialRouter);
app.use('/api/system', systemRouter);
app.use('/api/prompt-builder', promptBuilderRouter);
app.use('/api/preferences', preferencesRouter);

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
app.use(notFoundHandler);

// Global Error Handler (en sonda olmalı)
app.use(globalErrorHandler);

// Startup
const startServer = async () => {
  try {
    // Migration'lar artık Supabase CLI ile yönetiliyor
    // Yeni workflow: supabase migration new <isim> && supabase db push
    logger.info('📦 Migration sistemi: Supabase CLI (supabase db push)');
    
    // Server'ı başlat
    app.listen(PORT, () => {
      logger.info(`🚀 Server başlatıldı: http://localhost:${PORT}`);
      logger.info(`📚 API Docs: http://localhost:${PORT}/api-docs`);
      logger.info(`📊 Health check: http://localhost:${PORT}/health`);
      
      // Winston zaten development'ta console'a yazıyor
      
      // Scheduler'ları system monitor'a kaydet
      systemMonitor.registerScheduler('syncScheduler', {
        description: 'Uyumsoft fatura senkronizasyonu',
        nextRun: null,
      });
      systemMonitor.registerScheduler('tenderScheduler', {
        description: 'İhale scraper ve veri toplama',
        nextRun: null,
      });
      systemMonitor.registerScheduler('documentQueue', {
        description: 'Döküman işleme kuyruğu',
        nextRun: null,
      });
      systemMonitor.registerScheduler('reminderScheduler', {
        description: 'Not ve Çek/Senet vade hatırlatıcıları',
        nextRun: null,
      });

      // Scheduler'ları başlat
      logger.info('🔄 Otomatik senkronizasyon scheduler başlatılıyor...');
      scheduler.start();

      logger.info('🔍 İhale scraper scheduler başlatılıyor...');
      tenderScheduler.start();

      logger.info('📋 Document queue processor başlatılıyor...');
      documentQueueProcessor.start();

      logger.info('🔔 Reminder notification scheduler başlatılıyor...');
      reminderNotificationScheduler.start();

      logger.info('📡 System monitor hazır');
    });
    
  } catch (error) {
    logger.error('Server başlatma hatası', { error: error.message });
    process.exit(1);
  }
};

startServer();

export default app;
