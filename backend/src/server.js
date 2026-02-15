// ENV LOADER MUST BE FIRST - before any other imports!
import './env-loader.js';

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { pool } from './database.js';
import { authenticate, optionalAuth } from './middleware/auth.js';
import { globalErrorHandler, notFoundHandler } from './middleware/error-handler.js';
import { ipAccessControl } from './middleware/ip-access-control.js';
import { adminLimiter, apiLimiter, authLimiter } from './middleware/rate-limiter.js';
import swaggerSpec from './swagger.js';
import logger, { httpLogger, logError } from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const SERVER_CONFIG = {
  DEFAULT_PORT: 3001,
  COMPRESSION_LEVEL: 6,
  COMPRESSION_THRESHOLD: 1024,
  BODY_LIMIT: '50mb',
};

const PORT = process.env.PORT || process.env.API_PORT || SERVER_CONFIG.DEFAULT_PORT;

// Trust proxy - Rate limiter için gerekli (X-Forwarded-For header'ı için)
// Sadece bir proxy'ye güven (nginx) - permissive trust proxy hatasını önler
app.set('trust proxy', 1);

// Middleware
// Security Headers (Helmet)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // Swagger UI için
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Swagger UI için
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false, // Swagger UI için
  })
);

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
  'https://46.101.172.210',
];

app.use(
  cors({
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
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma', 'Expires', 'X-CSRF-Token'],
  })
);

// Cookie Parser
app.use(cookieParser());

// Response Compression - Network trafiğini 3-10x azaltır
app.use(
  compression({
    filter: (req, res) => {
      // Compression'ı devre dışı bırakmak isteyen header'ı kontrol et
      if (req.headers['x-no-compression']) {
        return false;
      }
      // Varsayılan filter'ı kullan (text, json, etc.)
      return compression.filter(req, res);
    },
    level: SERVER_CONFIG.COMPRESSION_LEVEL,
    threshold: SERVER_CONFIG.COMPRESSION_THRESHOLD,
  })
);

app.use(express.json({ limit: SERVER_CONFIG.BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: SERVER_CONFIG.BODY_LIMIT }));

// HTTP Request Logger (Winston)
app.use(httpLogger);

// IP Access Control - Rate limiting'den önce (güvenlik için)
// NOT: Health check ve auth endpoint'leri hariç
app.use((req, res, next) => {
  // Health check ve auth endpoint'leri için IP kontrolü atla
  const skip =
    req.path === '/' ||
    req.path === '/health' ||
    req.path.startsWith('/api-docs') ||
    req.path.startsWith('/api/auth/login') ||
    req.path.startsWith('/api/auth/register');
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
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Catering Pro API Docs',
  })
);

// Swagger JSON endpoint (for Postman import)
app.get('/api-docs.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Root – API bilgisi ve linkler (404 yerine anlamlı yanıt)
app.get('/', (req, res) => {
  const base = `${req.protocol}://${req.get('host') || `localhost:${PORT}`}`;
  res.json({
    name: 'Catering Pro API',
    version: '1.0.0',
    status: 'ok',
    docs: `${base}/api-docs`,
    openApi: `${base}/api-docs.json`,
    health: `${base}/health`,
  });
});

// /api/health alias - /health ile tutarlılık için (her iki URL de çalışsın)
app.get('/api/health', async (req, res) => {
  try {
    const dbResult = await pool.query('SELECT NOW()');
    res.json({
      status: 'ok',
      timestamp: dbResult.rows[0]?.now || new Date().toISOString(),
      database: 'connected',
      uptime: Math.round(process.uptime()),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development',
    });
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'disconnected', message: error.message });
  }
});

// DEV TOKEN - Sadece development modunda çalışır
// Backend'i auth token olmadan test etmek için kullanılır
// curl http://localhost:3001/api/dev/token
// curl http://localhost:3001/api/dev/token?email=admin@example.com
if (process.env.NODE_ENV !== 'production') {
  const jwtLib = await import('jsonwebtoken');

  app.get('/api/dev/token', async (req, res) => {
    try {
      const email = req.query.email;
      let user;

      if (email) {
        const result = await pool.query('SELECT id, email, name, role, user_type FROM users WHERE email = $1 AND is_active = true', [email]);
        user = result.rows[0];
      }

      if (!user) {
        // İlk admin kullanıcıyı bul
        const result = await pool.query(
          `SELECT id, email, name, role, user_type FROM users WHERE is_active = true ORDER BY CASE WHEN user_type = 'super_admin' THEN 1 WHEN user_type = 'admin' THEN 2 ELSE 3 END, id ASC LIMIT 1`
        );
        user = result.rows[0];
      }

      if (!user) {
        return res.status(404).json({ success: false, error: 'Aktif kullanıcı bulunamadı' });
      }

      const token = jwtLib.default.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role,
          user_type: user.user_type || 'user',
          firma_id: null,
          type: 'access',
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Cookie'ye de yaz (browser testleri için)
      res.cookie('access_token', token, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000,
        path: '/',
      });

      res.json({
        success: true,
        message: '⚠️ DEV ONLY - Production\'da bu endpoint mevcut değildir',
        token,
        user: { id: user.id, email: user.email, name: user.name, role: user.role, user_type: user.user_type },
        usage: {
          curl: `curl -H "Authorization: Bearer ${token}" http://localhost:${PORT}/api/auth/me`,
          cookie: 'Token cookie\'ye de yazıldı - browser\'dan direkt test edebilirsiniz',
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  logger.info('🔑 DEV TOKEN endpoint aktif: /api/dev/token');
}

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
app.get('/health', async (_req, res) => {
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
      const fs = await import('node:fs').then((m) => m.promises);
      const stats = await fs.statfs(process.cwd());
      diskInfo = {
        free: Math.round((stats.bavail * stats.bsize) / 1024 / 1024), // MB
        total: Math.round((stats.blocks * stats.bsize) / 1024 / 1024), // MB
        used: Math.round(((stats.blocks - stats.bavail) * stats.bsize) / 1024 / 1024), // MB
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

import agentsRouter from './routes/agents.js';
import aiRouter from './routes/ai.js';
import aiMemoryRouter from './routes/ai-memory.js';
import analysisCorrectionsRouter from './routes/analysis-corrections.js';
import auditLogsRouter from './routes/audit-logs.js';
import authRouter from './routes/auth.js';
import bordroRouter from './routes/bordro.js';
import bordroImportRouter from './routes/bordro-import.js';
import carilerRouter from './routes/cariler.js';
import contentExtractorRouter from './routes/content-extractor.js';
import contractorsRouter from './routes/contractors.js';
import databaseStatsRouter from './routes/database-stats.js';
import demirbasRouter from './routes/demirbas.js';
import documentAnnotationsRouter from './routes/document-annotations.js';
import documentProxyRouter from './routes/document-proxy.js';
import documentsRouter from './routes/documents.js';
import duplicateCheckRouter from './routes/duplicate-check.js';
import etiketlerRouter from './routes/etiketler.js';
import exportRouter from './routes/export.js';
import faturaKalemlerRouter from './routes/fatura-kalemler.js';
import firmalarRouter from './routes/firmalar.js';
import ihaleSonuclariRouter from './routes/ihale-sonuclari.js';
import importRouter from './routes/import.js';
import invoicesRouter from './routes/invoices.js';
import izinRouter from './routes/izin.js';
import kasaBankaRouter from './routes/kasa-banka.js';
import kurumMenuleriRouter from './routes/kurum-menuleri.js';
import maasOdemeRouter from './routes/maas-odeme.js';
import mailRouter from './routes/mail.js';
import maliyetAnaliziRouter from './routes/maliyet-analizi.js';
import masaPaketleriRouter from './routes/masa-paketleri.js';
import menuPlanlamaRouter from './routes/menu-planlama.js';
import mevzuatRouter from './routes/mevzuat.js';
import mutabakatRouter from './routes/mutabakat.js';
import unifiedNotesRouter from './routes/notes/index.js';
import notificationsRouter from './routes/notifications.js';
import permissionsRouter from './routes/permissions.js';
import personelRouter from './routes/personel.js';
import planlamaRouter from './routes/planlama.js';
import preferencesRouter from './routes/preferences.js';
import projeHareketlerRouter from './routes/proje-hareketler.js';
import projelerRouter from './routes/projeler.js';
import promptBuilderRouter from './routes/prompt-builder.js';
import reportsRouter from './routes/reports.js';
import satinAlmaRouter from './routes/satin-alma.js';
import scraperRouter from './routes/scraper.js';
import searchRouter from './routes/search.js';
import sektorGundemRouter from './routes/sektor-gundem.js';
import socialRouter from './routes/social.js';
import stokRouter from './routes/stok.js';
import syncRouter from './routes/sync.js';
import systemRouter from './routes/system.js';
import tekliflerRouter from './routes/teklifler.js';
import tenderCardsRouter from './routes/tender-cards.js';
import tenderContentDocumentsRouter from './routes/tender-content-documents.js';
import tenderDilekceRouter from './routes/tender-dilekce.js';
import tenderDocumentsRouter from './routes/tender-documents.js';
import tenderTrackingRouter from './routes/tender-tracking.js';
import tendersRouter from './routes/tenders.js';
import urunlerRouter from './routes/urunler.js';
import uyumsoftRouter from './routes/uyumsoft.js';
import documentQueueProcessor from './services/document-queue-processor.js';
import piyasaSyncScheduler from './services/piyasa-sync-scheduler.js';
import reminderNotificationScheduler from './services/reminder-notification-scheduler.js';
import scheduler from './services/sync-scheduler.js';
import systemMonitor from './services/system-monitor.js';
import tenderScheduler from './services/tender-scheduler.js';

// Auth routes - Özel rate limiter ile (brute-force koruması)
app.use('/api/auth', authLimiter, authRouter);

app.use('/api/tenders', tendersRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/documents', documentProxyRouter);
app.use('/api/content', contentExtractorRouter);
app.use('/api/uyumsoft', uyumsoftRouter);
app.use('/api/ai', aiRouter);
app.use('/api/agents', agentsRouter);
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
app.use('/api/reports', reportsRouter);
app.use('/api/import', importRouter);
app.use('/api/demirbas', demirbasRouter);
app.use('/api/kasa-banka', kasaBankaRouter);
app.use('/api/mutabakat', mutabakatRouter);
app.use('/api/bordro-import', bordroImportRouter);
app.use('/api/maas-odeme', maasOdemeRouter);
app.use('/api/proje-hareketler', projeHareketlerRouter);
app.use('/api/projeler', optionalAuth, projelerRouter);
app.use('/api/planlama', authenticate, planlamaRouter);
app.use('/api/menu-planlama', authenticate, menuPlanlamaRouter);
app.use('/api/kurum-menuleri', authenticate, kurumMenuleriRouter);
app.use('/api/mevzuat', mevzuatRouter);
app.use('/api/sektor-gundem', sektorGundemRouter);
app.use('/api/teklifler', tekliflerRouter);
// DEPRECATED: Eski not sistemi - unified_notes'a taşındı (2026-01-29)
// app.use('/api/notlar', notlarRouter);
app.use('/api/notes', unifiedNotesRouter); // Unified Notes System
app.use('/api/firmalar', firmalarRouter);
app.use('/api/ihale-sonuclari', ihaleSonuclariRouter);
app.use('/api/search', searchRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/tender-docs', tenderDocumentsRouter);
app.use('/api/tender-content', tenderContentDocumentsRouter);
app.use('/api/tender-tracking', tenderTrackingRouter);
app.use('/api/permissions', adminLimiter, permissionsRouter);
app.use('/api/audit-logs', adminLimiter, auditLogsRouter);
app.use('/api/mail', mailRouter);
app.use('/api/scraper', scraperRouter);
app.use('/api/maliyet-analizi', authenticate, maliyetAnaliziRouter);
// DEPRECATED: Eski ihale not sistemi - unified_notes'a taşındı (2026-01-29)
// app.use('/api/tender-notes', tenderNotesRouter);
app.use('/api/tender-dilekce', tenderDilekceRouter);
app.use('/api/social', socialRouter);
app.use('/api/contractors', contractorsRouter);
app.use('/api/system', adminLimiter, systemRouter);
app.use('/api/prompt-builder', promptBuilderRouter);
app.use('/api/preferences', preferencesRouter);
app.use('/api/analysis-corrections', analysisCorrectionsRouter);
app.use('/api/tender-cards', tenderCardsRouter);
app.use('/api/masa-paketleri', masaPaketleriRouter);
app.use('/api/document-annotations', documentAnnotationsRouter);

// --- Rapor Merkezi Generator'ları Kaydet ---
import('./services/report-generators/ihale-reports.js').catch((err) =>
  logger.error('Report generator yuklenemedi', { module: 'ihale-reports', error: err.message })
);
import('./services/report-generators/finans-reports.js').catch((err) =>
  logger.error('Report generator yuklenemedi', { module: 'finans-reports', error: err.message })
);
import('./services/report-generators/operasyon-reports.js').catch((err) =>
  logger.error('Report generator yuklenemedi', { module: 'operasyon-reports', error: err.message })
);
import('./services/report-generators/admin-reports.js').catch((err) =>
  logger.error('Report generator yuklenemedi', { module: 'admin-reports', error: err.message })
);

// Backward-compatible aliases: eski path'ler çalışmaya devam etsin
// /api/stats → /api/system/stats, /api/logs/recent → /api/system/logs/recent
app.get('/api/stats', (req, res, next) => {
  req.url = '/stats';
  systemRouter(req, res, next);
});
app.get('/api/logs/recent', (req, res, next) => {
  req.url = '/logs/recent';
  systemRouter(req, res, next);
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

      logger.info('🛒 Piyasa fiyat sync scheduler başlatılıyor...');
      piyasaSyncScheduler.start();

      logger.info('📡 System monitor hazır');
    });
  } catch (error) {
    logger.error('Server başlatma hatası', { error: error.message });
    process.exit(1);
  }
};

startServer();

// ============================================================
// Temiz Kapatma (Graceful Shutdown)
// ============================================================
// PM2 restart veya sunucu kapatma durumunda veritabani baglantilari
// duzgun sekilde kapatilir. Bu, baglanti sizintisini onler.
// ============================================================

async function gracefulShutdown(signal) {
  logger.info(`${signal} sinyali alindi - temiz kapatma baslatiliyor...`);
  try {
    const { closePool } = await import('./database.js');
    await closePool();
    logger.info('Veritabani baglantilari kapatildi');
  } catch (err) {
    logger.error('Kapatma sirasinda hata', { error: err.message });
  }
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
