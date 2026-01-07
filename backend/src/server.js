import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, query } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Backend .env dosyasını yükle
dotenv.config({ path: path.join(__dirname, '../.env'), override: true });

const app = express();
const PORT = process.env.PORT || process.env.API_PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ 
      status: 'ok', 
      timestamp: result.rows[0].now,
      database: 'connected'
    });
  } catch (error) {
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
import scheduler from './services/sync-scheduler.js';
import tenderScheduler from './services/tender-scheduler.js';

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

// Stats endpoint
app.get('/api/stats', async (req, res) => {
  try {
    // Count tenders
    const tenderResult = await query('SELECT COUNT(*) as total FROM tenders');
    const activeTenderResult = await query("SELECT COUNT(*) as active FROM tenders WHERE tender_date > NOW()");
    
    // Count documents (if table exists)
    let documentsCount = 0;
    try {
      const documentResult = await query('SELECT COUNT(*) as total FROM documents');
      documentsCount = parseInt(documentResult.rows[0].total);
    } catch (e) {
      // Documents table doesn't exist yet, ignore
    }

    // AI Analysis count (estimate based on non-null analysis results)
    let aiAnalysisCount = 0;
    try {
      const aiResult = await query('SELECT COUNT(*) as analyzed FROM tenders WHERE raw_data IS NOT NULL');
      aiAnalysisCount = parseInt(aiResult.rows[0].analyzed);
    } catch (e) {
      // Column doesn't exist yet, ignore
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
    console.error('Stats error:', error);
    res.status(500).json({ 
      error: 'İstatistikler alınamadı',
      details: error.message 
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint bulunamadı' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Sunucu hatası',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 API Server çalışıyor: http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  
  // Otomatik senkronizasyon scheduler'ı başlat
  console.log('🔄 Otomatik senkronizasyon scheduler başlatılıyor...');
  scheduler.start();
  
  // İhale scraper scheduler'ı başlat
  console.log('🔍 İhale scraper scheduler başlatılıyor...');
  tenderScheduler.start();
});

export default app;
